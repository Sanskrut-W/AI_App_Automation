import { TestExecutionEngine } from '../../../../../src/application/use-cases/test-execution/TestExecutionEngine';
import { ITestStepExecutor } from '../../../../../src/application/use-cases/test-execution/ITestStepExecutor';
import { IAppiumDriver } from '../../../../../src/application/interfaces/drivers/IAppiumDriver';
import { ITestCaseRepository } from '../../../../../src/application/interfaces/repositories/ITestCaseRepository';
import { IFileWriter } from '../../../../../src/shared/fs/IFileWriter';
import { IClock } from '../../../../../src/shared/time/IClock';
import { TestCase, TestCaseProps } from '../../../../../src/core/entities/TestCase';
import { ActionType } from '../../../../../src/core/enums/ActionType';
import { TestPriority } from '../../../../../src/core/enums/TestPriority';
import { LocatorStrategy } from '../../../../../src/core/enums/LocatorStrategy';
import { StepStatus } from '../../../../../src/core/enums/StepStatus';
import { TestCaseStatus } from '../../../../../src/core/enums/TestCaseStatus';
import { StepResult } from '../../../../../src/application/dto/StepResult';
import { TestExecutionError } from '../../../../../src/core/errors/TestExecutionError';
import { createMockLogger } from '../../../support/createMockLogger';

function createTestCase(overrides: Partial<TestCaseProps> = {}): TestCase {
  return new TestCase({
    testCaseId: 'test-case-1',
    screenId: 'screen-1',
    title: 'Home: Calculate button',
    description: 'Lets the user perform a calculation.',
    steps: [
      {
        stepNumber: 1,
        action: ActionType.VERIFY_ELEMENT_EXISTS,
        targetLocator: { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/btn' },
        elementId: 'element-1',
        value: null,
        direction: null,
        durationMs: null,
        expectedResult: 'Element exists.',
      },
      {
        stepNumber: 2,
        action: ActionType.CLICK,
        targetLocator: { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/btn' },
        elementId: 'element-1',
        value: null,
        direction: null,
        durationMs: null,
        expectedResult: 'Element responds to a tap.',
      },
    ],
    priority: TestPriority.MEDIUM,
    tags: [],
    appVersionName: '1.0.0',
    appVersionCode: '1',
    ...overrides,
  });
}

function passedStep(stepNumber: number): StepResult {
  return {
    stepNumber,
    action: ActionType.CLICK,
    status: StepStatus.PASSED,
    message: 'ok',
    screenshotPath: null,
    screenshotLabel: null,
    stackTrace: null,
    durationMs: 10,
  };
}

function failedStep(stepNumber: number): StepResult {
  return {
    stepNumber,
    action: ActionType.CLICK,
    status: StepStatus.FAILED,
    message: 'boom',
    screenshotPath: '/tmp/step-1.png',
    screenshotLabel: null,
    stackTrace: 'Error: boom\n    at somewhere.ts:1:1',
    durationMs: 10,
  };
}

function createMocks() {
  const appiumDriver: jest.Mocked<IAppiumDriver> = {
    createSession: jest.fn().mockResolvedValue({}),
    destroySession: jest.fn().mockResolvedValue(undefined),
    isSessionActive: jest.fn().mockReturnValue(true),
    getSession: jest.fn().mockReturnValue(null),
    launchApp: jest.fn().mockResolvedValue(undefined),
    closeApp: jest.fn().mockResolvedValue(undefined),
    recoverSession: jest.fn(),
  };
  const testCaseRepository: jest.Mocked<ITestCaseRepository> = {
    add: jest.fn(),
    update: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn().mockResolvedValue([]),
    exists: jest.fn(),
    exportJson: jest.fn(),
  };
  const stepExecutor: jest.Mocked<ITestStepExecutor> = {
    execute: jest.fn().mockResolvedValue(passedStep(1)),
  };
  const fileWriter: jest.Mocked<IFileWriter> = { write: jest.fn().mockResolvedValue(undefined) };
  const clock: jest.Mocked<IClock> = {
    now: jest.fn().mockReturnValue('2026-01-01T00:00:00.000Z'),
    nowMs: jest.fn().mockReturnValue(1_000),
  };
  const logger = createMockLogger();

  return { appiumDriver, testCaseRepository, stepExecutor, fileWriter, clock, logger };
}

function createEngine(mocks: ReturnType<typeof createMocks>) {
  return new TestExecutionEngine(
    mocks.appiumDriver,
    mocks.testCaseRepository,
    mocks.stepExecutor,
    mocks.fileWriter,
    mocks.clock,
    mocks.logger,
  );
}

const REQUEST = { deviceId: 'emulator-5554', appPackage: 'com.example.app' };

describe('TestExecutionEngine', () => {
  it('creates a session, launches the app, and runs every persisted test case when no ids are given', async () => {
    const mocks = createMocks();
    mocks.testCaseRepository.findAll.mockResolvedValue([createTestCase()]);
    mocks.stepExecutor.execute
      .mockResolvedValueOnce(passedStep(1))
      .mockResolvedValueOnce(passedStep(2));
    const engine = createEngine(mocks);

    const result = await engine.execute(REQUEST);

    expect(mocks.appiumDriver.createSession).toHaveBeenCalledWith({
      deviceId: 'emulator-5554',
      appPackage: 'com.example.app',
      appActivity: undefined,
    });
    expect(mocks.appiumDriver.launchApp).toHaveBeenCalledWith('com.example.app');
    expect(mocks.stepExecutor.execute).toHaveBeenCalledTimes(2);
    expect(mocks.appiumDriver.destroySession).toHaveBeenCalledTimes(1);

    expect(result.isOk()).toBe(true);
    const summary = result.unwrap();
    expect(summary.totalTestCases).toBe(1);
    expect(summary.passed).toBe(1);
    expect(summary.failed).toBe(0);
    expect(summary.results[0].status).toBe(TestCaseStatus.PASSED);
  });

  it('runs only the requested test case ids, skipping unknown ones', async () => {
    const mocks = createMocks();
    mocks.testCaseRepository.findById.mockImplementation(async (id: string) =>
      id === 'test-case-1' ? createTestCase() : null,
    );
    const engine = createEngine(mocks);

    const result = await engine.execute({
      ...REQUEST,
      testCaseIds: ['test-case-1', 'missing-id'],
    });

    expect(mocks.testCaseRepository.findAll).not.toHaveBeenCalled();
    expect(result.unwrap().totalTestCases).toBe(1);
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'Requested test case not found, skipping',
      expect.objectContaining({ testCaseId: 'missing-id' }),
    );
  });

  it('aborts remaining steps in a test case after the first failure, and marks it FAILED', async () => {
    const mocks = createMocks();
    mocks.testCaseRepository.findAll.mockResolvedValue([createTestCase()]);
    mocks.stepExecutor.execute
      .mockResolvedValueOnce(passedStep(1))
      .mockResolvedValueOnce(failedStep(2));
    const engine = createEngine(mocks);

    const result = await engine.execute(REQUEST);

    expect(mocks.stepExecutor.execute).toHaveBeenCalledTimes(2);
    const summary = result.unwrap();
    expect(summary.results[0].status).toBe(TestCaseStatus.FAILED);
    expect(summary.passed).toBe(0);
    expect(summary.failed).toBe(1);
  });

  it('continues running subsequent test cases after one fails', async () => {
    const mocks = createMocks();
    mocks.testCaseRepository.findAll.mockResolvedValue([
      createTestCase({ testCaseId: 'test-case-1' }),
      createTestCase({ testCaseId: 'test-case-2' }),
    ]);
    mocks.stepExecutor.execute
      .mockResolvedValueOnce(failedStep(1))
      .mockResolvedValueOnce(passedStep(1))
      .mockResolvedValueOnce(passedStep(2));
    const engine = createEngine(mocks);

    const result = await engine.execute(REQUEST);

    const summary = result.unwrap();
    expect(summary.totalTestCases).toBe(2);
    expect(summary.passed).toBe(1);
    expect(summary.failed).toBe(1);
  });

  it('saves an execution log artifact after a successful run', async () => {
    const mocks = createMocks();
    mocks.testCaseRepository.findAll.mockResolvedValue([createTestCase()]);
    const engine = createEngine(mocks);

    await engine.execute(REQUEST);

    expect(mocks.fileWriter.write).toHaveBeenCalledWith(
      expect.stringContaining('execution-'),
      expect.stringContaining('"totalTestCases"'),
    );
  });

  it('destroys the session even when execution throws', async () => {
    const mocks = createMocks();
    mocks.testCaseRepository.findAll.mockRejectedValue(new Error('disk read error'));
    const engine = createEngine(mocks);

    const result = await engine.execute(REQUEST);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(TestExecutionError);
    expect(result.unwrapErr().message).toMatch(/disk read error/);
    expect(mocks.appiumDriver.destroySession).toHaveBeenCalledTimes(1);
  });

  it('does not fail the run when destroySession() itself throws', async () => {
    const mocks = createMocks();
    mocks.testCaseRepository.findAll.mockResolvedValue([createTestCase()]);
    mocks.appiumDriver.destroySession.mockRejectedValue(new Error('already gone'));
    const engine = createEngine(mocks);

    const result = await engine.execute(REQUEST);

    expect(result.isOk()).toBe(true);
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'Ignoring error while destroying session after test execution',
      expect.objectContaining({ reason: 'already gone' }),
    );
  });

  it('returns an empty summary when there are no test cases to run', async () => {
    const mocks = createMocks();
    mocks.testCaseRepository.findAll.mockResolvedValue([]);
    const engine = createEngine(mocks);

    const result = await engine.execute(REQUEST);

    expect(result.isOk()).toBe(true);
    expect(result.unwrap()).toEqual({ totalTestCases: 0, passed: 0, failed: 0, results: [] });
    expect(mocks.stepExecutor.execute).not.toHaveBeenCalled();
  });

  describe('logout teardown', () => {
    const LOGOUT_STEPS = [
      {
        stepNumber: 1,
        action: ActionType.VERIFY_ELEMENT_EXISTS,
        targetLocator: {
          strategy: LocatorStrategy.RESOURCE_ID,
          value: 'com.example.app:id/deposit',
        },
        elementId: null,
        value: null,
        direction: null,
        durationMs: null,
        expectedResult: 'Logged in.',
      },
      {
        stepNumber: 2,
        action: ActionType.CLICK,
        targetLocator: {
          strategy: LocatorStrategy.RESOURCE_ID,
          value: 'com.example.app:id/logout',
        },
        elementId: null,
        value: null,
        direction: null,
        durationMs: null,
        expectedResult: 'Logged out.',
      },
    ];

    function createAccountRepository(logoutSteps: typeof LOGOUT_STEPS | null) {
      return {
        findByPackageName: jest
          .fn()
          .mockResolvedValue(
            logoutSteps ? { mobileNumber: '000', password: 'pw', logoutSteps } : null,
          ),
      };
    }

    it("runs the account's logout recipe after every test case, and it never appears in the report", async () => {
      const mocks = createMocks();
      mocks.testCaseRepository.findAll.mockResolvedValue([
        createTestCase({ testCaseId: 'test-case-1' }),
        createTestCase({ testCaseId: 'test-case-2' }),
      ]);
      mocks.stepExecutor.execute.mockResolvedValue(passedStep(1));
      const accountRepository = createAccountRepository(LOGOUT_STEPS);
      const engine = new TestExecutionEngine(
        mocks.appiumDriver,
        mocks.testCaseRepository,
        mocks.stepExecutor,
        mocks.fileWriter,
        mocks.clock,
        mocks.logger,
        accountRepository,
      );

      const result = await engine.execute(REQUEST);

      const summary = result.unwrap();
      expect(summary.results.map((r) => r.testCaseId)).toEqual(['test-case-1', 'test-case-2']);
      // 2 steps per test case + 2 logout steps run after each of the 2 test cases = 8 calls.
      expect(mocks.stepExecutor.execute).toHaveBeenCalledTimes(8);
      // The device is passed too: it selects which account this device signs in as, so several
      // devices can run at once as different users.
      expect(accountRepository.findByPackageName).toHaveBeenCalledWith(
        'com.example.app',
        'emulator-5554',
      );
    });

    it('stops the teardown at its first failed step (the "logged in?" gate) without touching the test case result', async () => {
      const mocks = createMocks();
      mocks.testCaseRepository.findAll.mockResolvedValue([createTestCase()]);
      mocks.stepExecutor.execute
        .mockResolvedValueOnce(passedStep(1))
        .mockResolvedValueOnce(passedStep(2))
        .mockResolvedValueOnce(failedStep(1)); // teardown's gate check: not logged in
      const accountRepository = createAccountRepository(LOGOUT_STEPS);
      const engine = new TestExecutionEngine(
        mocks.appiumDriver,
        mocks.testCaseRepository,
        mocks.stepExecutor,
        mocks.fileWriter,
        mocks.clock,
        mocks.logger,
        accountRepository,
      );

      const result = await engine.execute(REQUEST);

      const summary = result.unwrap();
      expect(summary.passed).toBe(1);
      expect(summary.results[0].stepResults).toHaveLength(2);
      // 2 test case steps + only the 1 teardown gate step (stops before the 2nd teardown step).
      expect(mocks.stepExecutor.execute).toHaveBeenCalledTimes(3);
    });

    it('does not run any teardown when the account has no logoutSteps configured', async () => {
      const mocks = createMocks();
      mocks.testCaseRepository.findAll.mockResolvedValue([createTestCase()]);
      const accountRepository = createAccountRepository(null);
      const engine = new TestExecutionEngine(
        mocks.appiumDriver,
        mocks.testCaseRepository,
        mocks.stepExecutor,
        mocks.fileWriter,
        mocks.clock,
        mocks.logger,
        accountRepository,
      );

      await engine.execute(REQUEST);

      expect(mocks.stepExecutor.execute).toHaveBeenCalledTimes(2);
    });

    it('does not run any teardown when no account repository was provided at all', async () => {
      const mocks = createMocks();
      mocks.testCaseRepository.findAll.mockResolvedValue([createTestCase()]);
      const engine = createEngine(mocks);

      await engine.execute(REQUEST);

      expect(mocks.stepExecutor.execute).toHaveBeenCalledTimes(2);
    });
  });
});
