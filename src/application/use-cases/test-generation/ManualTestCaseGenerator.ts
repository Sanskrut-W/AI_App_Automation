import { TestCase } from '../../../core/entities/TestCase';
import { Element } from '../../../core/entities/Element';
import { TestStep } from '../../../core/value-objects/TestStep';
import { TestPriority } from '../../../core/enums/TestPriority';
import { TestCaseGenerationError } from '../../../core/errors/TestCaseGenerationError';
import { TestAccount } from '../../../core/value-objects/TestAccount';
import { Result } from '../../../shared/result/Result';
import { ILogger } from '../../../shared/logger/ILogger';
import { IIdGenerator } from '../../../shared/id/IIdGenerator';
import { IElementRepository } from '../../interfaces/repositories/IElementRepository';
import { IScreenRepository } from '../../interfaces/repositories/IScreenRepository';
import { IStepInterpreter } from '../../interfaces/ai/IStepInterpreter';
import { StepInterpretationActionResult } from '../../dto/StepInterpretationResult';
import { ManualTestCaseInput, ManualTestCaseStepInput } from '../../dto/ManualTestCaseInput';
import { ManualTestCaseGenerationRequest } from '../../dto/ManualTestCaseGenerationRequest';
import { IManualTestCaseGenerator } from './IManualTestCaseGenerator';
import {
  verifyStep,
  clickStep,
  typeStep,
  scrollStep,
  waitStep,
  toLocator,
} from './TestStepBuilder';

const DEFAULT_SCROLL_DIRECTION = 'down';
/** Manual steps occasionally describe waiting in plain language ("wait for the page to load")
 * without a duration — this mirrors the generic settle-waits already used elsewhere in the
 * codebase for a screen transition to finish. */
const DEFAULT_WAIT_DURATION_MS = 1500;

/**
 * Generates test cases from manually-authored, free-text QA test cases (see
 * IManualTestCaseSource) — as opposed to the other three generators, which derive test cases
 * purely from what the autonomous crawler discovered. Requires the app to have already been
 * crawled at least once: this generator only reads already-persisted screens/elements, it never
 * drives a live device itself.
 *
 * For each step, in order, it: gathers candidate elements for the screen currently believed to be
 * active (starting at the navigation graph's root), asks IStepInterpreter which real element(s)
 * the step's free text refers to and what to do with them, builds the corresponding TestStep(s),
 * and — after a click whose target has an outgoing navigation-graph edge — advances to the screen
 * that edge leads to before interpreting the next step. A step the interpreter marks as
 * inapplicable to a native app (e.g. a website-only "enter the URL..." step) is skipped, not
 * force-guessed; likewise an action the interpreter couldn't confidently resolve.
 */
export class ManualTestCaseGenerator implements IManualTestCaseGenerator {
  constructor(
    private readonly elementRepository: IElementRepository,
    private readonly screenRepository: IScreenRepository,
    private readonly stepInterpreter: IStepInterpreter,
    private readonly idGenerator: IIdGenerator,
    private readonly logger: ILogger,
  ) {}

  async generate(
    request: ManualTestCaseGenerationRequest,
  ): Promise<Result<TestCase[], TestCaseGenerationError>> {
    try {
      const testCases: TestCase[] = [];
      for (const manualTestCase of request.manualTestCases) {
        const testCase = await this.generateOne(manualTestCase, request);
        if (testCase) {
          testCases.push(testCase);
        }
      }

      this.logger.info('Manual test case generation complete', {
        requested: request.manualTestCases.length,
        generated: testCases.length,
      });
      return Result.ok(testCases);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.err(
        new TestCaseGenerationError(`Failed to generate manual test cases: ${message}`),
      );
    }
  }

  private async generateOne(
    manualTestCase: ManualTestCaseInput,
    request: ManualTestCaseGenerationRequest,
  ): Promise<TestCase | null> {
    let currentScreenId = request.navigationGraph.rootScreenId;
    const steps: TestStep[] = [];
    let stepNumber = 1;

    for (const step of manualTestCase.steps) {
      const screen = await this.screenRepository.findById(currentScreenId);
      if (!screen) {
        this.logger.warn(
          'Could not find the currently-tracked screen in the repository; skipping the rest of this test case',
          {
            testCaseName: manualTestCase.testCaseName,
            stepNumber: step.stepNumber,
            currentScreenId,
          },
        );
        break;
      }

      const candidates = await this.gatherCandidates(currentScreenId);

      const interpretation = await this.stepInterpreter.interpret({
        stepDescription: step.description,
        expectedResult: step.expectedResult,
        candidateElements: candidates,
        screenshotPath: screen.screenshotPath,
      });

      if (interpretation.isErr()) {
        this.logger.warn('Step interpretation failed; skipping this step', {
          testCaseName: manualTestCase.testCaseName,
          stepNumber: step.stepNumber,
          reason: interpretation.unwrapErr().message,
        });
        continue;
      }

      const result = interpretation.unwrap();
      if (!result.applicable) {
        this.logger.info('Skipping a step with no equivalent action in this app', {
          testCaseName: manualTestCase.testCaseName,
          stepNumber: step.stepNumber,
          reason: result.reason,
        });
        continue;
      }

      for (const action of result.actions) {
        const built = this.buildStepsForAction(
          action,
          candidates,
          stepNumber,
          step,
          request.testAccount,
        );
        if (!built) {
          continue;
        }
        steps.push(...built.steps);
        stepNumber += built.steps.length;

        if (built.targetElement) {
          const edge = request.navigationGraph.edges.find(
            (candidateEdge) =>
              candidateEdge.fromScreenId === currentScreenId &&
              candidateEdge.elementId === built.targetElement?.elementId,
          );
          if (edge) {
            currentScreenId = edge.toScreenId;
          }
        }
      }

      if (result.expectedResultCheck) {
        const checkedElement = candidates[result.expectedResultCheck.candidateIndex];
        steps.push(
          verifyStep(stepNumber++, toLocator(checkedElement), checkedElement, step.expectedResult),
        );
      }
    }

    if (steps.length === 0) {
      this.logger.warn(
        'No steps could be generated for this manual test case; skipping it entirely',
        { testCaseName: manualTestCase.testCaseName },
      );
      return null;
    }

    return new TestCase({
      testCaseId: this.idGenerator.generate(),
      screenId: request.navigationGraph.rootScreenId,
      title: manualTestCase.testCaseName,
      description: manualTestCase.objective,
      steps,
      priority: TestPriority.HIGH,
      tags: ['manual'],
      appVersionName: request.appVersionName,
      appVersionCode: request.appVersionCode,
    });
  }

  /** Screen-scoped first; falls back to a search across every persisted element for this app only
   * if the current screen has none at all (e.g. screen-tracking drifted) — NOT whenever the
   * interpreter merely fails to resolve a match, since a screen's full element set (including
   * elements the crawler itself never tapped or recorded an edge for — e.g. a link reachable only
   * by scrolling) is already persisted in full by any capture of that screen. */
  private async gatherCandidates(screenId: string): Promise<Element[]> {
    const scoped = await this.elementRepository.search({ screenId });
    if (scoped.length > 0) {
      return scoped;
    }
    return this.elementRepository.findAll();
  }

  private buildStepsForAction(
    action: StepInterpretationActionResult,
    candidates: Element[],
    startStepNumber: number,
    step: ManualTestCaseStepInput,
    testAccount: TestAccount | null,
  ): { steps: TestStep[]; targetElement: Element | null } | null {
    let stepNumber = startStepNumber;

    if (action.action === 'scroll') {
      return {
        steps: [
          scrollStep(
            stepNumber,
            action.direction ?? DEFAULT_SCROLL_DIRECTION,
            `Scrolling ${action.direction ?? DEFAULT_SCROLL_DIRECTION} reveals more of the screen.`,
          ),
        ],
        targetElement: null,
      };
    }

    if (action.action === 'wait') {
      return {
        steps: [waitStep(stepNumber, DEFAULT_WAIT_DURATION_MS, step.expectedResult)],
        targetElement: null,
      };
    }

    const element =
      action.candidateIndex !== null ? (candidates[action.candidateIndex] ?? null) : null;
    if (!element) {
      this.logger.warn('Could not confidently resolve an element for this action; skipping it', {
        stepNumber: step.stepNumber,
        action: action.action,
      });
      return null;
    }
    const locator = toLocator(element);

    if (action.action === 'click') {
      return {
        steps: [
          verifyStep(stepNumber++, locator, element, `The target element is present.`),
          clickStep(stepNumber, locator, element, step.expectedResult),
        ],
        targetElement: element,
      };
    }

    // action.action === 'type'
    const value = this.resolveTypeValue(action, testAccount);
    if (value === null) {
      this.logger.warn('Could not resolve a value to type for this action; skipping it', {
        stepNumber: step.stepNumber,
        fieldType: action.fieldType,
      });
      return null;
    }

    return {
      steps: [
        verifyStep(stepNumber++, locator, element, 'The input field is present.'),
        clickStep(stepNumber++, locator, element, 'The input field gains focus.'),
        typeStep(stepNumber, locator, element, value, step.expectedResult),
      ],
      targetElement: element,
    };
  }

  /** Deliberately keeps the interpreter's job to "classify the field," not "invent realistic
   * data" — mobileNumber/password resolve to the real configured account here, in code, exactly
   * like the sign-up generator resolves its own random data in code rather than asking Gemini. */
  private resolveTypeValue(
    action: StepInterpretationActionResult,
    testAccount: TestAccount | null,
  ): string | null {
    switch (action.fieldType) {
      case 'literal':
        return action.literalValue;
      case 'mobileNumber':
        if (!testAccount) {
          this.logger.warn(
            'This step needs a real account mobile number, but no test account is configured for this package',
          );
          return null;
        }
        return testAccount.mobileNumber;
      case 'password':
        if (!testAccount) {
          this.logger.warn(
            'This step needs a real account password, but no test account is configured for this package',
          );
          return null;
        }
        return testAccount.password;
      case 'none':
      default:
        return null;
    }
  }
}
