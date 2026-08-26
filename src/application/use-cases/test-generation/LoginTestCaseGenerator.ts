import { TestCase } from '../../../core/entities/TestCase';
import { Element } from '../../../core/entities/Element';
import { ActionType } from '../../../core/enums/ActionType';
import { TestPriority } from '../../../core/enums/TestPriority';
import { TestStep } from '../../../core/value-objects/TestStep';
import { ElementLocator } from '../../../core/value-objects/ElementLocator';
import { TestCaseGenerationError } from '../../../core/errors/TestCaseGenerationError';
import { Result } from '../../../shared/result/Result';
import { ILogger } from '../../../shared/logger/ILogger';
import { IIdGenerator } from '../../../shared/id/IIdGenerator';
import { isLoginTriggerElement } from '../../../shared/text/isLoginTriggerElement';
import { IElementRepository } from '../../interfaces/repositories/IElementRepository';
import { NavigationGraph, NavigationGraphEdge } from '../../dto/NavigationGraph';
import { LoginTestCaseRequest } from '../../dto/LoginTestCaseRequest';
import { ILoginTestCaseGenerator } from './ILoginTestCaseGenerator';

const TEXT_INPUT_CLASS_PATTERN = /edittext|autocompletetextview/i;
/** Exact (trimmed) label match on the submit button's own visible text — deliberately NOT reusing
 * isLoginTriggerElement's broader resourceId-inclusive haystack here, since a login form's OTHER
 * fields (forgot-password, sign-up link, etc.) are conventionally given sibling resourceIds that
 * share the same "login"-prefixed naming (e.g. "loginForgotPassword", "loginSignUp") and would
 * false-positive-match a substring check. The button's actual label ("Log In"/"Sign In") doesn't
 * collide with those. */
const SUBMIT_BUTTON_TEXT_PATTERN = /^log\s*in$|^sign\s*in$/i;
/** Gives the login form time to load after tapping the trigger, and the login request time to
 * resolve after submitting, before the next step runs against a still-transitioning screen. */
const LOGIN_SETTLE_MS = 800;

/**
 * Deterministic, navigation-graph-driven generator for a single login test case: finds the
 * screen the crawler's one-time login-form "peek" (see ScreenCrawler.peekLoginForm) landed on,
 * locates its mobile-number input, password input, and submit button, and builds a test case that
 * opens the form, fills in the given credentials, and submits — mirroring
 * MenuNavigationTestCaseGenerator's approach, but for the login flow specifically.
 */
export class LoginTestCaseGenerator implements ILoginTestCaseGenerator {
  constructor(
    private readonly elementRepository: IElementRepository,
    private readonly idGenerator: IIdGenerator,
    private readonly logger: ILogger,
  ) {}

  async generate(
    request: LoginTestCaseRequest,
  ): Promise<Result<TestCase[], TestCaseGenerationError>> {
    try {
      const loginTrigger = await this.findLoginTrigger(request.navigationGraph);
      if (!loginTrigger) {
        this.logger.warn(
          'No login trigger was found in this crawl, skipping login test case generation.',
        );
        return Result.ok([]);
      }
      const { edge, element: triggerElement } = loginTrigger;

      const formElements = await this.elementRepository.search({ screenId: edge.toScreenId });
      const mobileInput = formElements.find(
        (element) => this.isTextInput(element) && !element.isPassword,
      );
      const passwordInput = formElements.find(
        (element) => this.isTextInput(element) && element.isPassword,
      );

      if (!mobileInput || !passwordInput) {
        this.logger.warn(
          'Login form fields (mobile/password input) were not found, skipping login test case generation.',
          {
            screenId: edge.toScreenId,
            mobileInputFound: Boolean(mobileInput),
            passwordInputFound: Boolean(passwordInput),
          },
        );
        return Result.ok([]);
      }

      const submitButton = this.findSubmitButton(formElements, mobileInput, passwordInput);
      if (!submitButton) {
        this.logger.warn(
          'No submit button was confidently identified on the login form; the generated test case will fill the form but not submit it.',
          { screenId: edge.toScreenId },
        );
      }

      const testCase = this.buildTestCase(
        request,
        triggerElement,
        mobileInput,
        passwordInput,
        submitButton,
      );

      this.logger.info('Login test case generation complete', {
        loginScreenId: edge.toScreenId,
        submitButtonFound: Boolean(submitButton),
      });
      return Result.ok([testCase]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Result.err(
        new TestCaseGenerationError(`Failed to generate login test case: ${message}`),
      );
    }
  }

  private async findLoginTrigger(
    graph: NavigationGraph,
  ): Promise<{ edge: NavigationGraphEdge; element: Element } | null> {
    for (const edge of graph.edges) {
      const element = await this.elementRepository.findById(edge.elementId);
      if (element && isLoginTriggerElement(element)) {
        return { edge, element };
      }
    }
    return null;
  }

  private isTextInput(element: Element): boolean {
    return TEXT_INPUT_CLASS_PATTERN.test(element.className) && element.locators.length > 0;
  }

  private findSubmitButton(
    elements: Element[],
    mobileInput: Element,
    passwordInput: Element,
  ): Element | null {
    return (
      elements.find(
        (element) =>
          element.clickable &&
          element.locators.length > 0 &&
          element.elementId !== mobileInput.elementId &&
          element.elementId !== passwordInput.elementId &&
          SUBMIT_BUTTON_TEXT_PATTERN.test(element.text.trim()) &&
          // A screen's title/heading can legitimately share the exact "Log In" label with the
          // real submit button (seen on the actual Betway ZA login screen) — the button is
          // reliably positioned below the password field, the title above it, so require that to
          // tell them apart.
          element.bounds.top > passwordInput.bounds.top,
      ) ?? null
    );
  }

  private buildTestCase(
    request: LoginTestCaseRequest,
    triggerElement: Element,
    mobileInput: Element,
    passwordInput: Element,
    submitButton: Element | null,
  ): TestCase {
    const triggerLocator = this.toLocator(triggerElement);
    const mobileLocator = this.toLocator(mobileInput);
    const passwordLocator = this.toLocator(passwordInput);

    const steps: TestStep[] = [
      {
        stepNumber: 1,
        action: ActionType.VERIFY_ELEMENT_EXISTS,
        targetLocator: triggerLocator,
        elementId: triggerElement.elementId,
        value: null,
        direction: null,
        durationMs: null,
        expectedResult: 'The login button is present.',
      },
      {
        stepNumber: 2,
        action: ActionType.CLICK,
        targetLocator: triggerLocator,
        elementId: triggerElement.elementId,
        value: null,
        direction: null,
        durationMs: null,
        expectedResult: 'Tapping the login button opens the login form.',
      },
      {
        stepNumber: 3,
        action: ActionType.WAIT,
        targetLocator: null,
        elementId: null,
        value: null,
        direction: null,
        durationMs: LOGIN_SETTLE_MS,
        expectedResult: 'The login form finishes opening.',
      },
      {
        stepNumber: 4,
        action: ActionType.VERIFY_ELEMENT_EXISTS,
        targetLocator: mobileLocator,
        elementId: mobileInput.elementId,
        value: null,
        direction: null,
        durationMs: null,
        expectedResult: 'The mobile number input is present.',
      },
      {
        stepNumber: 5,
        action: ActionType.CLICK,
        targetLocator: mobileLocator,
        elementId: mobileInput.elementId,
        value: null,
        direction: null,
        durationMs: null,
        expectedResult: 'The mobile number input gains focus.',
      },
      {
        stepNumber: 6,
        action: ActionType.TYPE,
        targetLocator: mobileLocator,
        elementId: mobileInput.elementId,
        value: request.mobileNumber,
        direction: null,
        durationMs: null,
        expectedResult: 'The mobile number is entered.',
      },
      {
        stepNumber: 7,
        action: ActionType.VERIFY_ELEMENT_EXISTS,
        targetLocator: passwordLocator,
        elementId: passwordInput.elementId,
        value: null,
        direction: null,
        durationMs: null,
        expectedResult: 'The password input is present.',
      },
      {
        stepNumber: 8,
        action: ActionType.CLICK,
        targetLocator: passwordLocator,
        elementId: passwordInput.elementId,
        value: null,
        direction: null,
        durationMs: null,
        expectedResult: 'The password input gains focus.',
      },
      {
        stepNumber: 9,
        action: ActionType.TYPE,
        targetLocator: passwordLocator,
        elementId: passwordInput.elementId,
        value: request.password,
        direction: null,
        durationMs: null,
        expectedResult: 'The password is entered.',
      },
    ];

    if (submitButton) {
      const submitLocator = this.toLocator(submitButton);
      steps.push(
        {
          stepNumber: 10,
          action: ActionType.CLICK,
          targetLocator: submitLocator,
          elementId: submitButton.elementId,
          value: null,
          direction: null,
          durationMs: null,
          expectedResult: 'Submitting the login form logs the user in.',
        },
        {
          stepNumber: 11,
          action: ActionType.WAIT,
          targetLocator: null,
          elementId: null,
          value: null,
          direction: null,
          durationMs: LOGIN_SETTLE_MS,
          expectedResult: 'The login request finishes.',
        },
      );
    }

    return new TestCase({
      testCaseId: this.idGenerator.generate(),
      screenId: mobileInput.screenId,
      title: 'Login: valid credentials',
      description: 'Verifies that a user can log in with a valid mobile number and password.',
      steps,
      priority: TestPriority.HIGH,
      tags: ['login'],
      appVersionName: request.appVersionName,
      appVersionCode: request.appVersionCode,
    });
  }

  private toLocator(element: Element): ElementLocator {
    const [best] = element.locators;
    return { strategy: best.strategy, value: best.value };
  }
}
