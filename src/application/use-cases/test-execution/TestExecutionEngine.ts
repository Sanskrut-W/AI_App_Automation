import path from 'path';
import { TestCase } from '../../../core/entities/TestCase';
import { TestStep } from '../../../core/value-objects/TestStep';
import { TestAccount } from '../../../core/value-objects/TestAccount';
import { TestCaseStatus } from '../../../core/enums/TestCaseStatus';
import { StepStatus } from '../../../core/enums/StepStatus';
import { TestExecutionError } from '../../../core/errors/TestExecutionError';
import { Result } from '../../../shared/result/Result';
import { ILogger } from '../../../shared/logger/ILogger';
import { IClock } from '../../../shared/time/IClock';
import { IFileWriter } from '../../../shared/fs/IFileWriter';
import { IAppiumDriver } from '../../interfaces/drivers/IAppiumDriver';
import { ITestCaseRepository } from '../../interfaces/repositories/ITestCaseRepository';
import { ITestAccountRepository } from '../../interfaces/repositories/ITestAccountRepository';
import { TestExecutionRequest } from '../../dto/TestExecutionRequest';
import { TestExecutionSummary } from '../../dto/TestExecutionSummary';
import { TestCaseResult } from '../../dto/TestCaseResult';
import { StepResult } from '../../dto/StepResult';
import { resolveCredentialTokens } from './resolveCredentialTokens';
import { ITestStepExecutor } from './ITestStepExecutor';
import { ITestExecutionEngine } from './ITestExecutionEngine';

export interface TestExecutionEngineOptions {
  executionLogDir?: string;
}

const DEFAULT_LOG_DIR = path.resolve(process.cwd(), 'artifacts', 'execution-logs');

/**
 * Orchestrates a full test run: resolves which persisted test cases to execute, drives an Appium
 * session through each one step-by-step via ITestStepExecutor, aggregates pass/fail results, and
 * persists an execution log artifact. A failed step aborts only the remaining steps of that test
 * case — other test cases in the run still execute.
 */
export class TestExecutionEngine implements ITestExecutionEngine {
  private readonly executionLogDir: string;

  constructor(
    private readonly appiumDriver: IAppiumDriver,
    private readonly testCaseRepository: ITestCaseRepository,
    private readonly stepExecutor: ITestStepExecutor,
    private readonly fileWriter: IFileWriter,
    private readonly clock: IClock,
    private readonly logger: ILogger,
    private readonly testAccountRepository?: ITestAccountRepository,
    options: TestExecutionEngineOptions = {},
  ) {
    this.executionLogDir = options.executionLogDir ?? DEFAULT_LOG_DIR;
  }

  async execute(
    request: TestExecutionRequest,
  ): Promise<Result<TestExecutionSummary, TestExecutionError>> {
    this.logger.info('Starting test execution', {
      deviceId: request.deviceId,
      appPackage: request.appPackage,
    });

    try {
      // Resolve credentials before the session opens: the account is chosen per device (so two
      // devices can run at once as different users), and an unresolved placeholder must abort the
      // run rather than get typed into a real login form. See resolveCredentialTokens.
      const account = await this.resolveAccount(request.appPackage, request.deviceId);
      const testCases = (await this.resolveTestCases(request.testCaseIds)).map(
        (testCase) =>
          new TestCase({ ...testCase, steps: resolveCredentialTokens(testCase.steps, account) }),
      );
      const logoutSteps = this.resolveLogoutSteps(account);

      await this.appiumDriver.createSession({
        deviceId: request.deviceId,
        appPackage: request.appPackage,
        appActivity: request.appActivity,
      });
      await this.appiumDriver.launchApp(request.appPackage);

      const results: TestCaseResult[] = [];
      for (const testCase of testCases) {
        results.push(await this.executeTestCase(testCase));
        if (logoutSteps) {
          await this.runLogoutTeardown(logoutSteps);
        }
      }

      const summary: TestExecutionSummary = {
        totalTestCases: results.length,
        passed: results.filter((result) => result.status === TestCaseStatus.PASSED).length,
        failed: results.filter((result) => result.status === TestCaseStatus.FAILED).length,
        results,
      };

      await this.saveExecutionLog(summary);

      this.logger.info('Test execution complete', {
        totalTestCases: summary.totalTestCases,
        passed: summary.passed,
        failed: summary.failed,
      });
      return Result.ok(summary);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Test execution failed', error instanceof Error ? error : undefined);
      return Result.err(new TestExecutionError(`Test execution failed: ${message}`));
    } finally {
      try {
        await this.appiumDriver.destroySession();
      } catch (error) {
        this.logger.warn('Ignoring error while destroying session after test execution', {
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }

  private async resolveTestCases(testCaseIds?: string[]): Promise<TestCase[]> {
    if (!testCaseIds || testCaseIds.length === 0) {
      return this.testCaseRepository.findAll();
    }

    const testCases: TestCase[] = [];
    for (const testCaseId of testCaseIds) {
      const testCase = await this.testCaseRepository.findById(testCaseId);
      if (!testCase) {
        this.logger.warn('Requested test case not found, skipping', { testCaseId });
        continue;
      }
      testCases.push(testCase);
    }
    return testCases;
  }

  private async executeTestCase(testCase: TestCase): Promise<TestCaseResult> {
    this.logger.info('Executing test case', {
      testCaseId: testCase.testCaseId,
      title: testCase.title,
    });
    const startedAtMs = this.clock.nowMs();
    const stepResults: StepResult[] = [];

    for (const step of testCase.steps) {
      const stepResult = await this.stepExecutor.execute(step);
      stepResults.push(stepResult);
      if (stepResult.status === StepStatus.FAILED) {
        this.logger.warn('Step failed, aborting remaining steps in this test case', {
          testCaseId: testCase.testCaseId,
          stepNumber: step.stepNumber,
        });
        break;
      }
    }

    const status = stepResults.every((result) => result.status === StepStatus.PASSED)
      ? TestCaseStatus.PASSED
      : TestCaseStatus.FAILED;

    return {
      testCaseId: testCase.testCaseId,
      screenId: testCase.screenId,
      title: testCase.title,
      status,
      durationMs: this.clock.nowMs() - startedAtMs,
      stepResults,
    };
  }

  private async resolveAccount(appPackage: string, deviceId: string): Promise<TestAccount | null> {
    if (!this.testAccountRepository) {
      return null;
    }
    return this.testAccountRepository.findByPackageName(appPackage, deviceId);
  }

  private resolveLogoutSteps(account: TestAccount | null): TestStep[] | null {
    if (!account?.logoutSteps || account.logoutSteps.length === 0) {
      return null;
    }
    return resolveCredentialTokens(account.logoutSteps, account);
  }

  /**
   * Best-effort session reset run after every test case, not just ones known to log in — so no
   * test case ever starts already logged in because some earlier one happened to leave a session
   * behind (proven live: three of Betway ZA's manual test cases failed this exact way, one of
   * them wandering into a real-money screen before the locator-healing/overlay-dismiss safety
   * gates caught it). The recipe's own first step is a "logged in?" gate check, so this silently
   * no-ops on a test case that never logged in — that's what makes it safe to run
   * unconditionally. Never affects the just-recorded TestCaseResult: failures here are logged and
   * swallowed, not surfaced as part of the test case's own outcome.
   */
  private async runLogoutTeardown(logoutSteps: TestStep[]): Promise<void> {
    for (const step of logoutSteps) {
      const stepResult = await this.stepExecutor.execute(step);
      if (stepResult.status === StepStatus.FAILED) {
        this.logger.debug('Logout teardown stopped (either not logged in, or a step failed)', {
          stepNumber: step.stepNumber,
          reason: stepResult.message,
        });
        return;
      }
    }
    this.logger.info('Logout teardown completed');
  }

  private async saveExecutionLog(summary: TestExecutionSummary): Promise<void> {
    try {
      const logPath = path.join(this.executionLogDir, `execution-${this.clock.nowMs()}.json`);
      await this.fileWriter.write(logPath, JSON.stringify(summary, null, 2));
    } catch (error) {
      this.logger.warn('Failed to save execution log artifact', {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
