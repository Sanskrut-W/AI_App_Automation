import path from 'path';
import { Element } from '../../../core/entities/Element';
import { ActionType } from '../../../core/enums/ActionType';
import { StepStatus } from '../../../core/enums/StepStatus';
import { ScrollDirection } from '../../../core/enums/ScrollDirection';
import { TestStep } from '../../../core/value-objects/TestStep';
import { ElementLocator } from '../../../core/value-objects/ElementLocator';
import { ILogger } from '../../../shared/logger/ILogger';
import { IClock } from '../../../shared/time/IClock';
import { IFileWriter } from '../../../shared/fs/IFileWriter';
import { IInteractionDriver } from '../../interfaces/drivers/IInteractionDriver';
import { ICaptureDriver } from '../../interfaces/drivers/ICaptureDriver';
import { IXmlElementParser } from '../../interfaces/xml/IXmlElementParser';
import { StepResult } from '../../dto/StepResult';
import { ITestStepExecutor } from './ITestStepExecutor';
import { ILocatorHealingEngine } from '../locator-healing/ILocatorHealingEngine';
import { isCloseButtonElement } from '../../../shared/text/isCloseButtonElement';
import { isCancelElement } from '../../../shared/text/isCancelElement';
import { isSensitiveFinancialElement } from '../../../shared/text/isSensitiveFinancialElement';

export interface TestStepExecutorOptions {
  screenshotDir?: string;
  sleepFn?: (ms: number) => Promise<void>;
}

const HEALABLE_ACTIONS: readonly ActionType[] = [
  ActionType.CLICK,
  ActionType.TYPE,
  ActionType.VERIFY_TEXT,
  ActionType.VERIFY_ELEMENT_EXISTS,
];

/**
 * Proven live against Betway ZA: each individual back()-escape from a real-money screen is safe on
 * its own, but a run with several unrelated incidents (stale locators drifting into deposit/promo
 * screens repeatedly across many test cases) can rack up enough consecutive back() presses to walk
 * straight past the app's root screen and trigger its own "Exit app?" confirmation dialog — which
 * then blocks every later test case until something dismisses it. Capping how many back()-escapes
 * a single run will attempt bounds that cascade; past the limit, the step is left to fail cleanly
 * (already the safe outcome) rather than risking navigating further than intended.
 */
const MAX_SENSITIVE_SCREEN_BACK_ESCAPES_PER_RUN = 3;

const DEFAULT_SCREENSHOT_DIR = path.resolve(process.cwd(), 'artifacts', 'execution-screenshots');
const DEFAULT_SLEEP: (ms: number) => Promise<void> = (ms) =>
  new Promise((resolve) => setTimeout(resolve, ms));
const SCROLL_DIRECTIONS: readonly string[] = Object.values(ScrollDirection);

/**
 * Converts a single TestStep into the matching Appium command, times it, and — on failure —
 * captures a screenshot for debugging. No AI involved: the action-to-command mapping is a fixed
 * switch over ActionType. If a locator healing engine is injected, a failed locator-driven step
 * (Click/Type/VerifyText/VerifyElementExists) is retried once with a freshly healed locator
 * before being reported as failed, so execution can continue past a broken locator.
 */
export class TestStepExecutor implements ITestStepExecutor {
  private readonly screenshotDir: string;
  private readonly sleepFn: (ms: number) => Promise<void>;
  private sensitiveScreenBackEscapes = 0;

  constructor(
    private readonly interactionDriver: IInteractionDriver,
    private readonly captureDriver: ICaptureDriver,
    private readonly fileWriter: IFileWriter,
    private readonly clock: IClock,
    private readonly logger: ILogger,
    private readonly xmlParser: IXmlElementParser,
    private readonly locatorHealingEngine?: ILocatorHealingEngine,
    options: TestStepExecutorOptions = {},
  ) {
    this.screenshotDir = options.screenshotDir ?? DEFAULT_SCREENSHOT_DIR;
    this.sleepFn = options.sleepFn ?? DEFAULT_SLEEP;
  }

  async execute(step: TestStep): Promise<StepResult> {
    const startedAtMs = this.clock.nowMs();
    this.logger.debug('Executing test step', { stepNumber: step.stepNumber, action: step.action });

    try {
      const message = await this.perform(step);
      const screenshotPath = await this.captureScreenshot(step);
      return this.buildResult(step, StepStatus.PASSED, message, screenshotPath, null, startedAtMs);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      const stackTrace = error instanceof Error ? (error.stack ?? null) : null;
      this.logger.warn('Test step failed', {
        stepNumber: step.stepNumber,
        action: step.action,
        reason,
      });

      if (step.optional) {
        this.logger.info('Optional step did not apply this run; skipping it and continuing', {
          stepNumber: step.stepNumber,
          reason,
        });
        const screenshotPath = await this.captureScreenshot(step);
        return this.buildResult(
          step,
          StepStatus.PASSED,
          `Skipped (optional step, condition not met): ${reason}`,
          screenshotPath,
          null,
          startedAtMs,
        );
      }

      const overlayMessage = await this.tryDismissOverlay(step);
      if (overlayMessage) {
        const screenshotPath = await this.captureScreenshot(step);
        return this.buildResult(
          step,
          StepStatus.PASSED,
          overlayMessage,
          screenshotPath,
          null,
          startedAtMs,
        );
      }

      const healedMessage = await this.tryHeal(step, reason);
      if (healedMessage) {
        const screenshotPath = await this.captureScreenshot(step);
        return this.buildResult(
          step,
          StepStatus.PASSED,
          healedMessage,
          screenshotPath,
          null,
          startedAtMs,
        );
      }

      const screenshotPath = await this.captureScreenshot(step, StepStatus.FAILED);
      return this.buildResult(
        step,
        StepStatus.FAILED,
        reason,
        screenshotPath,
        stackTrace,
        startedAtMs,
      );
    }
  }

  /**
   * On failure of a locator-driven step, checks whether an unexpected overlay (ad/promo/consent
   * dialog) is now covering the screen — the same class of close/dismiss/skip control
   * `ScreenCrawler.dismissOverlays` already recognizes and taps past during a crawl (see
   * `isCloseButtonElement`) — and if so, dismisses it and retries the ORIGINAL step once. Tried
   * BEFORE locator healing: a blocking overlay looks identical to "the locator broke" from the
   * failure alone, but re-identifying via fingerprint/AI matching would be wasted work (and could
   * heal onto the wrong element) when the real fix is just tapping "Skip" and trying again.
   * Returns the retried step's success message, or null if no overlay was found or dismissing it
   * didn't resolve the failure.
   */
  private async tryDismissOverlay(step: TestStep): Promise<string | null> {
    if (!step.targetLocator || !HEALABLE_ACTIONS.includes(step.action)) {
      return null;
    }

    try {
      const currentXml = await this.captureDriver.getPageSource();
      const elements = this.xmlParser.parse(currentXml, 'runtime-overlay-check');
      const closeButton = elements.find(
        (element) =>
          element.clickable &&
          element.locators.length > 0 &&
          (isCloseButtonElement(element) || isCancelElement(element)),
      );
      if (!closeButton) {
        return null;
      }

      this.logger.warn(
        'Recognized what looks like an overlay blocking the step; dismissing it and retrying',
        { stepNumber: step.stepNumber, elementId: closeButton.elementId },
      );
      const [dismissLocator] = closeButton.locators;
      await this.interactionDriver.tap({
        strategy: dismissLocator.strategy,
        value: dismissLocator.value,
      });

      // Proven live against Betway ZA: this exact tap once landed on an unrelated element whose
      // dismissal cascaded into a Deposit Funds screen — verify_element_exists(toolbarLogin), the
      // very next step, then passed anyway because that header persists on almost every screen,
      // masking the drift until a later coordinate-healing fallback typed into a Voucher Pin
      // field. Re-checking for a real-money screen here, before ever retrying the original step,
      // catches the drift at its source instead of trusting that "the tap didn't throw" means it
      // went somewhere safe.
      const afterDismissXml = await this.captureDriver.getPageSource();
      const afterDismissElements = this.xmlParser.parse(afterDismissXml, 'runtime-overlay-check');
      const sensitiveElement = afterDismissElements.find(isSensitiveFinancialElement);
      if (sensitiveElement) {
        this.logger.warn(
          'Dismissing the overlay landed on what looks like a real-money flow (deposit/withdraw/voucher/payment); backing out instead of proceeding',
          { stepNumber: step.stepNumber, elementId: sensitiveElement.elementId },
        );
        await this.tryEscapeSensitiveScreen(afterDismissElements);
        return null;
      }

      const message = await this.perform(step);
      this.logger.info('Step passed after dismissing an overlay', {
        stepNumber: step.stepNumber,
      });
      return `${message} (dismissed an overlay first)`;
    } catch (error) {
      this.logger.debug('Overlay dismissal did not resolve the step failure', {
        stepNumber: step.stepNumber,
        reason: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /** Best-effort escape from an unexpectedly-reached real-money screen: prefer the screen's own
   * close/cancel control (safer than the hardware back button, which some payment webviews
   * intercept with an "are you sure?" prompt) and fall back to back() if none is recognized. */
  private async tryEscapeSensitiveScreen(elements: Element[]): Promise<void> {
    const closeButton = elements.find(
      (element) =>
        element.clickable &&
        element.locators.length > 0 &&
        (isCloseButtonElement(element) || isCancelElement(element)),
    );
    try {
      if (closeButton) {
        const [locator] = closeButton.locators;
        await this.interactionDriver.tap({ strategy: locator.strategy, value: locator.value });
      } else if (this.sensitiveScreenBackEscapes < MAX_SENSITIVE_SCREEN_BACK_ESCAPES_PER_RUN) {
        this.sensitiveScreenBackEscapes += 1;
        await this.interactionDriver.back();
      } else {
        this.logger.warn(
          "Reached this run's limit on back-button escapes from a real-money screen; leaving the step to fail rather than risking navigating further than intended",
          { limit: MAX_SENSITIVE_SCREEN_BACK_ESCAPES_PER_RUN },
        );
      }
    } catch (error) {
      this.logger.warn('Failed to back out of a real-money screen', {
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /** On failure of a locator-driven step, attempts deterministic locator healing and retries the step once. Returns the retried step's success message, or null if healing did not resolve the failure. */
  private async tryHeal(step: TestStep, failureReason: string): Promise<string | null> {
    if (!this.locatorHealingEngine || !step.elementId || !HEALABLE_ACTIONS.includes(step.action)) {
      return null;
    }

    this.logger.warn('Attempting locator healing after step failure', {
      stepNumber: step.stepNumber,
      elementId: step.elementId,
      reason: failureReason,
    });

    try {
      const currentXml = await this.captureDriver.getPageSource();
      const healResult = await this.locatorHealingEngine.heal({
        elementId: step.elementId,
        currentXml,
      });

      if (healResult.isErr()) {
        this.logger.warn('Locator healing itself failed', {
          stepNumber: step.stepNumber,
          reason: healResult.unwrapErr().message,
        });
        return null;
      }

      const healed = healResult.unwrap();
      const healedLocator = healed.updatedLocators?.[0];
      if (!healed.healed || !healedLocator) {
        return null;
      }

      const message = await this.perform({ ...step, targetLocator: healedLocator });
      this.logger.info('Step passed after locator healing', {
        stepNumber: step.stepNumber,
        elementId: step.elementId,
        confidence: healed.confidence,
      });
      return `${message} (locator healed, confidence=${healed.confidence.toFixed(2)})`;
    } catch (error) {
      this.logger.warn('Step still fails after locator healing', {
        stepNumber: step.stepNumber,
        reason: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private async perform(step: TestStep): Promise<string> {
    switch (step.action) {
      case ActionType.CLICK:
        await this.interactionDriver.tap(this.requireLocator(step));
        return 'Clicked element.';
      case ActionType.TYPE: {
        const locator = this.requireLocator(step);
        const value = this.requireValue(step);
        await this.interactionDriver.sendKeys(locator, value);
        return 'Typed text into element.';
      }
      case ActionType.SCROLL:
        await this.interactionDriver.scroll(this.requireScrollDirection(step));
        return 'Scrolled screen.';
      case ActionType.SWIPE: {
        const [fromX, fromY, toX, toY] = this.requireSwipeCoordinates(step);
        await this.interactionDriver.swipe(fromX, fromY, toX, toY);
        return 'Swiped screen.';
      }
      case ActionType.BACK:
        await this.interactionDriver.back();
        return 'Navigated back.';
      case ActionType.WAIT: {
        const durationMs = step.durationMs ?? 0;
        await this.sleepFn(durationMs);
        return `Waited ${durationMs}ms.`;
      }
      case ActionType.VERIFY_TEXT: {
        const locator = this.requireLocator(step);
        const expected = this.requireValue(step);
        const actual = await this.interactionDriver.getText(locator);
        if (actual !== expected) {
          throw new Error(`Expected text "${expected}" but found "${actual}".`);
        }
        return `Verified text equals "${expected}".`;
      }
      case ActionType.VERIFY_ELEMENT_EXISTS: {
        const locator = this.requireLocator(step);
        const exists = await this.interactionDriver.elementExists(locator);
        if (!exists) {
          throw new Error(`Element (${locator.strategy}="${locator.value}") does not exist.`);
        }
        return 'Verified element exists.';
      }
      default:
        throw new Error(`Unsupported action type: ${String(step.action)}`);
    }
  }

  private requireLocator(step: TestStep): ElementLocator {
    if (!step.targetLocator) {
      throw new Error(`Step ${step.stepNumber} (${step.action}) requires a targetLocator.`);
    }
    return step.targetLocator;
  }

  private requireValue(step: TestStep): string {
    if (step.value === null) {
      throw new Error(`Step ${step.stepNumber} (${step.action}) requires a value.`);
    }
    return step.value;
  }

  private requireScrollDirection(step: TestStep): ScrollDirection {
    if (!step.direction || !SCROLL_DIRECTIONS.includes(step.direction)) {
      throw new Error(
        `Step ${step.stepNumber} (${step.action}) requires a valid direction (${SCROLL_DIRECTIONS.join(', ')}).`,
      );
    }
    return step.direction as ScrollDirection;
  }

  /** Parses a SWIPE step's "x1,y1,x2,y2" value (mirrors how the COORDINATES locator strategy
   * packs a position into a plain string) into four raw pixel coordinates. */
  private requireSwipeCoordinates(step: TestStep): [number, number, number, number] {
    const parts = (step.value ?? '').split(',').map((part) => Number(part.trim()));
    if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
      throw new Error(
        `Step ${step.stepNumber} (${step.action}) requires a value formatted as "x1,y1,x2,y2".`,
      );
    }
    return parts as [number, number, number, number];
  }

  /**
   * Captures a screenshot only when it is worth something: either the step is a labelled
   * reporting checkpoint (`screenshotLabel`), or it failed and the image is needed to diagnose
   * why. Capturing every step instead produced ~146 images for one 13-item menu tour — over a
   * gigabyte per handful of runs — and buried the few that actually evidence anything.
   *
   * Best-effort: a capture failure never fails the step itself.
   */
  private async captureScreenshot(
    step: TestStep,
    status: StepStatus = StepStatus.PASSED,
  ): Promise<string | null> {
    if (!step.screenshotLabel && status !== StepStatus.FAILED) {
      return null;
    }

    try {
      const screenshot = await this.captureDriver.takeScreenshot();
      const screenshotPath = path.join(
        this.screenshotDir,
        `step-${step.stepNumber}-${this.clock.nowMs()}.png`,
      );
      await this.fileWriter.write(screenshotPath, screenshot);
      return screenshotPath;
    } catch (error) {
      this.logger.warn('Failed to capture step screenshot', {
        stepNumber: step.stepNumber,
        reason: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private buildResult(
    step: TestStep,
    status: StepStatus,
    message: string,
    screenshotPath: string | null,
    stackTrace: string | null,
    startedAtMs: number,
  ): StepResult {
    return {
      stepNumber: step.stepNumber,
      action: step.action,
      status,
      message,
      screenshotPath,
      screenshotLabel: step.screenshotLabel ?? null,
      stackTrace,
      durationMs: this.clock.nowMs() - startedAtMs,
    };
  }
}
