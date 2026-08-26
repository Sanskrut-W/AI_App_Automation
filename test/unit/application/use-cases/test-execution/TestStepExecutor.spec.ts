import { TestStepExecutor } from '../../../../../src/application/use-cases/test-execution/TestStepExecutor';
import { IInteractionDriver } from '../../../../../src/application/interfaces/drivers/IInteractionDriver';
import { ICaptureDriver } from '../../../../../src/application/interfaces/drivers/ICaptureDriver';
import { IXmlElementParser } from '../../../../../src/application/interfaces/xml/IXmlElementParser';
import { IFileWriter } from '../../../../../src/shared/fs/IFileWriter';
import { IClock } from '../../../../../src/shared/time/IClock';
import { Element, ElementProps } from '../../../../../src/core/entities/Element';
import { TestStep } from '../../../../../src/core/value-objects/TestStep';
import { ActionType } from '../../../../../src/core/enums/ActionType';
import { StepStatus } from '../../../../../src/core/enums/StepStatus';
import { ScrollDirection } from '../../../../../src/core/enums/ScrollDirection';
import { LocatorStrategy } from '../../../../../src/core/enums/LocatorStrategy';
import { ILocatorHealingEngine } from '../../../../../src/application/use-cases/locator-healing/ILocatorHealingEngine';
import { LocatorHealingError } from '../../../../../src/core/errors/LocatorHealingError';
import { Result } from '../../../../../src/shared/result/Result';
import { createMockLogger } from '../../../support/createMockLogger';

function createOverlayElement(overrides: Partial<ElementProps> = {}): Element {
  return new Element({
    elementId: 'close-button-1',
    screenId: 'runtime-overlay-check',
    className: 'android.widget.ImageButton',
    text: 'Skip',
    resourceId: 'com.example.app:id/adSkip',
    accessibilityId: '',
    contentDescription: '',
    bounds: { left: 0, top: 0, right: 100, bottom: 50 },
    clickable: true,
    enabled: true,
    selected: false,
    checked: false,
    isPassword: false,
    parentElementId: null,
    childElementIds: [],
    locators: [
      { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/adSkip', priority: 1 },
    ],
    ...overrides,
  });
}

const LOCATOR = { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/btn' };
const HEALED_LOCATOR = {
  strategy: LocatorStrategy.ACCESSIBILITY_ID,
  value: 'Submit',
  priority: 1,
};

function createStep(overrides: Partial<TestStep> = {}): TestStep {
  return {
    stepNumber: 1,
    action: ActionType.CLICK,
    targetLocator: LOCATOR,
    elementId: null,
    value: null,
    direction: null,
    durationMs: null,
    expectedResult: 'Element responds to a tap.',
    ...overrides,
  };
}

function createMockHealingEngine(): jest.Mocked<ILocatorHealingEngine> {
  return { heal: jest.fn() };
}

function createMocks() {
  const interactionDriver: jest.Mocked<IInteractionDriver> = {
    tap: jest.fn().mockResolvedValue(undefined),
    back: jest.fn().mockResolvedValue(undefined),
    sendKeys: jest.fn().mockResolvedValue(undefined),
    scroll: jest.fn().mockResolvedValue(undefined),
    swipe: jest.fn().mockResolvedValue(undefined),
    getText: jest.fn().mockResolvedValue(''),
    elementExists: jest.fn().mockResolvedValue(true),
  };
  const captureDriver: jest.Mocked<ICaptureDriver> = {
    takeScreenshot: jest.fn().mockResolvedValue(Buffer.from('fake-png')),
    getPageSource: jest.fn(),
    getCurrentPackage: jest.fn(),
    getCurrentActivity: jest.fn(),
  };
  const fileWriter: jest.Mocked<IFileWriter> = { write: jest.fn().mockResolvedValue(undefined) };
  // Defaults to "no overlay found" so every pre-existing test (none of which cares about overlay
  // dismissal) behaves exactly as before; overlay-specific tests override this per case.
  const xmlParser: jest.Mocked<IXmlElementParser> = { parse: jest.fn().mockReturnValue([]) };
  let currentMs = 1_000;
  const clock: jest.Mocked<IClock> = {
    now: jest.fn().mockReturnValue('2026-01-01T00:00:00.000Z'),
    nowMs: jest.fn(() => currentMs),
  };
  const logger = createMockLogger();
  const sleepFn = jest.fn().mockResolvedValue(undefined);

  return {
    interactionDriver,
    captureDriver,
    xmlParser,
    fileWriter,
    clock,
    logger,
    sleepFn,
    advanceClock: (ms: number) => {
      currentMs += ms;
    },
  };
}

function createExecutor(
  mocks: ReturnType<typeof createMocks>,
  locatorHealingEngine?: jest.Mocked<ILocatorHealingEngine>,
) {
  return new TestStepExecutor(
    mocks.interactionDriver,
    mocks.captureDriver,
    mocks.fileWriter,
    mocks.clock,
    mocks.logger,
    mocks.xmlParser,
    locatorHealingEngine,
    { sleepFn: mocks.sleepFn },
  );
}

describe('TestStepExecutor', () => {
  it('executes a CLICK step via tap() and reports PASSED', async () => {
    const mocks = createMocks();
    const executor = createExecutor(mocks);

    const result = await executor.execute(createStep({ action: ActionType.CLICK }));

    expect(mocks.interactionDriver.tap).toHaveBeenCalledWith(LOCATOR);
    expect(result.status).toBe(StepStatus.PASSED);
    expect(result.stepNumber).toBe(1);
    expect(result.stackTrace).toBeNull();
  });

  describe('screenshot checkpoints', () => {
    it('captures and captions a screenshot for a passing step that is a labelled checkpoint', async () => {
      const mocks = createMocks();
      mocks.captureDriver.takeScreenshot.mockResolvedValue(Buffer.from('pass-png'));
      const executor = createExecutor(mocks);

      const result = await executor.execute(
        createStep({
          action: ActionType.CLICK,
          stepNumber: 2,
          screenshotLabel: 'Checking My Bets',
        }),
      );

      expect(result.status).toBe(StepStatus.PASSED);
      expect(result.screenshotPath).not.toBeNull();
      expect(result.screenshotLabel).toBe('Checking My Bets');
      expect(mocks.fileWriter.write).toHaveBeenCalledWith(
        expect.stringContaining('step-2'),
        Buffer.from('pass-png'),
      );
    });

    it('does not capture a screenshot for a passing step with no label', async () => {
      const mocks = createMocks();
      const executor = createExecutor(mocks);

      const result = await executor.execute(createStep({ action: ActionType.CLICK }));

      expect(result.status).toBe(StepStatus.PASSED);
      expect(result.screenshotPath).toBeNull();
      expect(result.screenshotLabel).toBeNull();
      expect(mocks.captureDriver.takeScreenshot).not.toHaveBeenCalled();
    });

    it('still captures a screenshot for an unlabelled step that FAILS, so diagnostics are not lost', async () => {
      const mocks = createMocks();
      mocks.interactionDriver.elementExists.mockResolvedValue(false);
      const executor = createExecutor(mocks);

      const result = await executor.execute(
        createStep({ action: ActionType.VERIFY_ELEMENT_EXISTS }),
      );

      expect(result.status).toBe(StepStatus.FAILED);
      expect(result.screenshotPath).not.toBeNull();
      expect(result.screenshotLabel).toBeNull();
    });

    it('still reports PASSED with a null screenshotPath when a labelled checkpoint cannot be captured', async () => {
      const mocks = createMocks();
      mocks.captureDriver.takeScreenshot.mockRejectedValue(new Error('device disconnected'));
      const executor = createExecutor(mocks);

      const result = await executor.execute(
        createStep({ action: ActionType.CLICK, screenshotLabel: 'Before login' }),
      );

      expect(result.status).toBe(StepStatus.PASSED);
      expect(result.screenshotPath).toBeNull();
    });
  });

  it('executes a TYPE step via sendKeys() with the step value', async () => {
    const mocks = createMocks();
    const executor = createExecutor(mocks);

    const result = await executor.execute(
      createStep({ action: ActionType.TYPE, value: 'hello world' }),
    );

    expect(mocks.interactionDriver.sendKeys).toHaveBeenCalledWith(LOCATOR, 'hello world');
    expect(result.status).toBe(StepStatus.PASSED);
  });

  it('executes a SCROLL step via scroll() with the parsed direction', async () => {
    const mocks = createMocks();
    const executor = createExecutor(mocks);

    const result = await executor.execute(
      createStep({ action: ActionType.SCROLL, targetLocator: null, direction: 'down' }),
    );

    expect(mocks.interactionDriver.scroll).toHaveBeenCalledWith(ScrollDirection.DOWN);
    expect(result.status).toBe(StepStatus.PASSED);
  });

  it('fails a SCROLL step with an invalid direction without calling the driver', async () => {
    const mocks = createMocks();
    const executor = createExecutor(mocks);

    const result = await executor.execute(
      createStep({ action: ActionType.SCROLL, targetLocator: null, direction: 'sideways' }),
    );

    expect(mocks.interactionDriver.scroll).not.toHaveBeenCalled();
    expect(result.status).toBe(StepStatus.FAILED);
    expect(result.message).toMatch(/valid direction/);
  });

  it('executes a SWIPE step via swipe() with coordinates parsed from the step value', async () => {
    const mocks = createMocks();
    const executor = createExecutor(mocks);

    const result = await executor.execute(
      createStep({ action: ActionType.SWIPE, targetLocator: null, value: '400,1850,400,950' }),
    );

    expect(mocks.interactionDriver.swipe).toHaveBeenCalledWith(400, 1850, 400, 950);
    expect(result.status).toBe(StepStatus.PASSED);
  });

  it('fails a SWIPE step with a malformed value without calling the driver', async () => {
    const mocks = createMocks();
    const executor = createExecutor(mocks);

    const result = await executor.execute(
      createStep({ action: ActionType.SWIPE, targetLocator: null, value: '400,not-a-number' }),
    );

    expect(mocks.interactionDriver.swipe).not.toHaveBeenCalled();
    expect(result.status).toBe(StepStatus.FAILED);
    expect(result.message).toMatch(/x1,y1,x2,y2/);
  });

  it('executes a BACK step via back()', async () => {
    const mocks = createMocks();
    const executor = createExecutor(mocks);

    const result = await executor.execute(
      createStep({ action: ActionType.BACK, targetLocator: null }),
    );

    expect(mocks.interactionDriver.back).toHaveBeenCalledTimes(1);
    expect(result.status).toBe(StepStatus.PASSED);
  });

  it('executes a WAIT step by sleeping for durationMs', async () => {
    const mocks = createMocks();
    const executor = createExecutor(mocks);

    const result = await executor.execute(
      createStep({ action: ActionType.WAIT, targetLocator: null, durationMs: 500 }),
    );

    expect(mocks.sleepFn).toHaveBeenCalledWith(500);
    expect(result.status).toBe(StepStatus.PASSED);
    expect(result.message).toContain('500ms');
  });

  it('passes a VERIFY_TEXT step when the actual text matches', async () => {
    const mocks = createMocks();
    mocks.interactionDriver.getText.mockResolvedValue('Result: 42');
    const executor = createExecutor(mocks);

    const result = await executor.execute(
      createStep({ action: ActionType.VERIFY_TEXT, value: 'Result: 42' }),
    );

    expect(result.status).toBe(StepStatus.PASSED);
  });

  it('fails a VERIFY_TEXT step when the actual text does not match', async () => {
    const mocks = createMocks();
    mocks.interactionDriver.getText.mockResolvedValue('Result: 0');
    const executor = createExecutor(mocks);

    const result = await executor.execute(
      createStep({ action: ActionType.VERIFY_TEXT, value: 'Result: 42' }),
    );

    expect(result.status).toBe(StepStatus.FAILED);
    expect(result.message).toMatch(/Expected text/);
  });

  it('passes a VERIFY_ELEMENT_EXISTS step when the element exists', async () => {
    const mocks = createMocks();
    mocks.interactionDriver.elementExists.mockResolvedValue(true);
    const executor = createExecutor(mocks);

    const result = await executor.execute(createStep({ action: ActionType.VERIFY_ELEMENT_EXISTS }));

    expect(result.status).toBe(StepStatus.PASSED);
  });

  it('fails a VERIFY_ELEMENT_EXISTS step when the element does not exist', async () => {
    const mocks = createMocks();
    mocks.interactionDriver.elementExists.mockResolvedValue(false);
    const executor = createExecutor(mocks);

    const result = await executor.execute(createStep({ action: ActionType.VERIFY_ELEMENT_EXISTS }));

    expect(result.status).toBe(StepStatus.FAILED);
    expect(result.message).toMatch(/does not exist/);
  });

  describe('optional steps', () => {
    it("reports PASSED (skipped) instead of failing when an optional step's element is not present", async () => {
      const mocks = createMocks();
      mocks.interactionDriver.elementExists.mockResolvedValue(false);
      const executor = createExecutor(mocks);

      const result = await executor.execute(
        createStep({ action: ActionType.VERIFY_ELEMENT_EXISTS, optional: true }),
      );

      expect(result.status).toBe(StepStatus.PASSED);
      expect(result.message).toMatch(/Skipped \(optional step/);
    });

    it('does not attempt overlay dismissal or locator healing for a skipped optional step', async () => {
      const mocks = createMocks();
      mocks.interactionDriver.tap.mockRejectedValue(new Error('element not interactable'));
      const healingEngine = createMockHealingEngine();
      const executor = createExecutor(mocks, healingEngine);

      await executor.execute(createStep({ action: ActionType.CLICK, optional: true }));

      expect(mocks.captureDriver.getPageSource).not.toHaveBeenCalled();
      expect(healingEngine.heal).not.toHaveBeenCalled();
    });

    it('still reports PASSED normally when an optional step succeeds', async () => {
      const mocks = createMocks();
      const executor = createExecutor(mocks);

      const result = await executor.execute(
        createStep({ action: ActionType.CLICK, optional: true }),
      );

      expect(result.status).toBe(StepStatus.PASSED);
      expect(result.message).toBe('Clicked element.');
    });
  });

  it('fails a step that requires a targetLocator when none is provided', async () => {
    const mocks = createMocks();
    const executor = createExecutor(mocks);

    const result = await executor.execute(
      createStep({ action: ActionType.CLICK, targetLocator: null }),
    );

    expect(mocks.interactionDriver.tap).not.toHaveBeenCalled();
    expect(result.status).toBe(StepStatus.FAILED);
    expect(result.message).toMatch(/requires a targetLocator/);
  });

  it('fails a TYPE step that has no value', async () => {
    const mocks = createMocks();
    const executor = createExecutor(mocks);

    const result = await executor.execute(createStep({ action: ActionType.TYPE, value: null }));

    expect(mocks.interactionDriver.sendKeys).not.toHaveBeenCalled();
    expect(result.status).toBe(StepStatus.FAILED);
    expect(result.message).toMatch(/requires a value/);
  });

  it('captures and saves a screenshot when a step fails', async () => {
    const mocks = createMocks();
    mocks.interactionDriver.tap.mockRejectedValue(new Error('element not interactable'));
    mocks.captureDriver.takeScreenshot.mockResolvedValue(Buffer.from('failure-png'));
    const executor = createExecutor(mocks);

    const result = await executor.execute(createStep({ action: ActionType.CLICK, stepNumber: 3 }));

    expect(result.status).toBe(StepStatus.FAILED);
    expect(result.message).toMatch(/element not interactable/);
    expect(result.screenshotPath).not.toBeNull();
    expect(result.stackTrace).toMatch(/element not interactable/);
    expect(mocks.fileWriter.write).toHaveBeenCalledWith(
      expect.stringContaining('step-3'),
      Buffer.from('failure-png'),
    );
  });

  it('still reports FAILED with a null screenshotPath when the failure screenshot itself cannot be captured', async () => {
    const mocks = createMocks();
    mocks.interactionDriver.tap.mockRejectedValue(new Error('element not interactable'));
    mocks.captureDriver.takeScreenshot.mockRejectedValue(new Error('device disconnected'));
    const executor = createExecutor(mocks);

    const result = await executor.execute(createStep({ action: ActionType.CLICK }));

    expect(result.status).toBe(StepStatus.FAILED);
    expect(result.screenshotPath).toBeNull();
  });

  it('measures step duration using the clock', async () => {
    const mocks = createMocks();
    mocks.interactionDriver.tap.mockImplementation(async () => {
      mocks.advanceClock(250);
    });
    const executor = createExecutor(mocks);

    const result = await executor.execute(createStep({ action: ActionType.CLICK }));

    expect(result.durationMs).toBe(250);
  });

  describe('overlay dismissal', () => {
    it('dismisses a recognized overlay and retries the original step once, before ever attempting locator healing', async () => {
      const mocks = createMocks();
      mocks.captureDriver.getPageSource.mockResolvedValue('<hierarchy/>');
      mocks.xmlParser.parse.mockReturnValue([createOverlayElement()]);
      mocks.interactionDriver.tap
        .mockRejectedValueOnce(new Error('no such element'))
        .mockResolvedValueOnce(undefined) // dismiss tap
        .mockResolvedValueOnce(undefined); // retried original step
      const healingEngine = createMockHealingEngine();
      const executor = createExecutor(mocks, healingEngine);

      const result = await executor.execute(createStep({ action: ActionType.CLICK }));

      expect(mocks.interactionDriver.tap).toHaveBeenNthCalledWith(2, {
        strategy: LocatorStrategy.RESOURCE_ID,
        value: 'com.example.app:id/adSkip',
      });
      expect(mocks.interactionDriver.tap).toHaveBeenNthCalledWith(3, LOCATOR);
      expect(result.status).toBe(StepStatus.PASSED);
      expect(result.message).toMatch(/dismissed an overlay first/);
      expect(healingEngine.heal).not.toHaveBeenCalled();
    });

    it('falls through to locator healing when no overlay is present', async () => {
      const mocks = createMocks();
      mocks.captureDriver.getPageSource.mockResolvedValue('<hierarchy/>');
      mocks.xmlParser.parse.mockReturnValue([]); // no close button found
      mocks.interactionDriver.tap
        .mockRejectedValueOnce(new Error('no such element'))
        .mockResolvedValueOnce(undefined);
      const healingEngine = createMockHealingEngine();
      healingEngine.heal.mockResolvedValue(
        Result.ok({
          elementId: 'element-1',
          healed: true,
          confidence: 0.9,
          matchedElementId: 'candidate-1',
          updatedLocators: [HEALED_LOCATOR],
          aiAssisted: false,
        }),
      );
      const executor = createExecutor(mocks, healingEngine);

      const result = await executor.execute(
        createStep({ action: ActionType.CLICK, elementId: 'element-1' }),
      );

      expect(healingEngine.heal).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(StepStatus.PASSED);
    });

    it('falls through to locator healing when dismissing the overlay does not fix the retried step', async () => {
      const mocks = createMocks();
      mocks.captureDriver.getPageSource.mockResolvedValue('<hierarchy/>');
      mocks.xmlParser.parse.mockReturnValue([createOverlayElement()]);
      mocks.interactionDriver.tap
        .mockRejectedValueOnce(new Error('no such element')) // original attempt
        .mockResolvedValueOnce(undefined) // dismiss tap succeeds
        .mockRejectedValueOnce(new Error('no such element')) // retry after dismiss still fails
        .mockResolvedValueOnce(undefined); // healed retry succeeds
      const healingEngine = createMockHealingEngine();
      healingEngine.heal.mockResolvedValue(
        Result.ok({
          elementId: 'element-1',
          healed: true,
          confidence: 0.9,
          matchedElementId: 'candidate-1',
          updatedLocators: [HEALED_LOCATOR],
          aiAssisted: false,
        }),
      );
      const executor = createExecutor(mocks, healingEngine);

      const result = await executor.execute(
        createStep({ action: ActionType.CLICK, elementId: 'element-1' }),
      );

      expect(healingEngine.heal).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(StepStatus.PASSED);
      expect(result.message).not.toMatch(/dismissed an overlay/);
    });

    it('backs out and skips the retry when dismissing the overlay lands on a real-money screen', async () => {
      // Proven live against Betway ZA: dismissing what looked like an overlay actually navigated
      // onto a Deposit Funds screen. The step must never be retried against that screen — a
      // persistent header element could make the retry falsely "pass" while still on the wrong
      // screen — so this locks in backing out immediately and falling through to locator healing
      // instead.
      const mocks = createMocks();
      mocks.captureDriver.getPageSource.mockResolvedValue('<hierarchy/>');
      mocks.xmlParser.parse
        .mockReturnValueOnce([createOverlayElement()]) // pre-tap overlay scan
        .mockReturnValueOnce([createOverlayElement({ text: 'Voucher Pin', resourceId: '' })]); // post-tap safety check
      mocks.interactionDriver.tap
        .mockRejectedValueOnce(new Error('no such element')) // original attempt
        .mockResolvedValueOnce(undefined); // dismiss tap
      const healingEngine = createMockHealingEngine();
      healingEngine.heal.mockResolvedValue(
        Result.ok({
          elementId: 'element-1',
          healed: false,
          confidence: 0,
          matchedElementId: null,
          updatedLocators: null,
          aiAssisted: false,
        }),
      );
      const executor = createExecutor(mocks, healingEngine);

      const result = await executor.execute(
        createStep({ action: ActionType.CLICK, elementId: 'element-1' }),
      );

      expect(mocks.interactionDriver.tap).toHaveBeenCalledTimes(2);
      expect(mocks.interactionDriver.back).toHaveBeenCalledTimes(1);
      expect(healingEngine.heal).toHaveBeenCalledTimes(1);
      expect(result.status).toBe(StepStatus.FAILED);
      expect(result.message).not.toMatch(/dismissed an overlay/);
    });

    it("stops pressing back once this run's real-money escape limit is reached, leaving later steps to fail without navigating further", async () => {
      // Proven live against Betway ZA: several unrelated test cases each safely backed out of a
      // real-money screen once, but the back() presses accumulated across the run and eventually
      // walked past the app's root screen, surfacing its own "Exit app?" confirmation dialog. Each
      // individual back() is safe; the cascade across a whole run is not, so it's capped.
      const mocks = createMocks();
      mocks.captureDriver.getPageSource.mockResolvedValue('<hierarchy/>');
      let parseCallCount = 0;
      mocks.xmlParser.parse.mockImplementation(() => {
        parseCallCount += 1;
        return parseCallCount % 2 === 1
          ? [createOverlayElement()] // pre-tap overlay scan: has a close-button match
          : [createOverlayElement({ text: 'Voucher Pin', resourceId: '' })]; // post-tap: sensitive, no close button
      });
      let tapCallCount = 0;
      mocks.interactionDriver.tap.mockImplementation(async () => {
        tapCallCount += 1;
        if (tapCallCount % 2 === 1) {
          throw new Error('no such element'); // original attempt on each step
        }
      });
      const healingEngine = createMockHealingEngine();
      healingEngine.heal.mockResolvedValue(
        Result.ok({
          elementId: 'element-1',
          healed: false,
          confidence: 0,
          matchedElementId: null,
          updatedLocators: null,
          aiAssisted: false,
        }),
      );
      const executor = createExecutor(mocks, healingEngine);
      const step = createStep({ action: ActionType.CLICK, elementId: 'element-1' });

      const results = [
        await executor.execute(step),
        await executor.execute(step),
        await executor.execute(step),
        await executor.execute(step),
      ];

      expect(results.every((result) => result.status === StepStatus.FAILED)).toBe(true);
      expect(mocks.interactionDriver.back).toHaveBeenCalledTimes(3);
      expect(mocks.logger.warn).toHaveBeenCalledWith(
        expect.stringMatching(/back-button escapes/),
        expect.objectContaining({ limit: 3 }),
      );
    });

    it('does not attempt overlay dismissal for actions without a locator (e.g. BACK)', async () => {
      const mocks = createMocks();
      mocks.interactionDriver.back.mockRejectedValue(new Error('device disconnected'));
      const executor = createExecutor(mocks);

      const result = await executor.execute(
        createStep({ action: ActionType.BACK, targetLocator: null }),
      );

      expect(mocks.captureDriver.getPageSource).not.toHaveBeenCalled();
      expect(result.status).toBe(StepStatus.FAILED);
    });
  });

  describe('locator healing', () => {
    it('retries and passes a failed step once locator healing succeeds', async () => {
      const mocks = createMocks();
      mocks.captureDriver.getPageSource.mockResolvedValue('<hierarchy/>');
      mocks.interactionDriver.tap
        .mockRejectedValueOnce(new Error('no such element'))
        .mockResolvedValueOnce(undefined);
      const healingEngine = createMockHealingEngine();
      healingEngine.heal.mockResolvedValue(
        Result.ok({
          elementId: 'element-1',
          healed: true,
          confidence: 0.82,
          matchedElementId: 'candidate-1',
          updatedLocators: [HEALED_LOCATOR],
          aiAssisted: false,
        }),
      );
      const executor = createExecutor(mocks, healingEngine);

      const result = await executor.execute(
        createStep({ action: ActionType.CLICK, elementId: 'element-1' }),
      );

      expect(healingEngine.heal).toHaveBeenCalledWith({
        elementId: 'element-1',
        currentXml: '<hierarchy/>',
      });
      expect(mocks.interactionDriver.tap).toHaveBeenNthCalledWith(2, HEALED_LOCATOR);
      expect(result.status).toBe(StepStatus.PASSED);
      expect(result.message).toMatch(/locator healed, confidence=0\.82/);
    });

    it('does not attempt healing when the step has no elementId', async () => {
      const mocks = createMocks();
      mocks.interactionDriver.tap.mockRejectedValue(new Error('no such element'));
      const healingEngine = createMockHealingEngine();
      const executor = createExecutor(mocks, healingEngine);

      const result = await executor.execute(
        createStep({ action: ActionType.CLICK, elementId: null }),
      );

      expect(healingEngine.heal).not.toHaveBeenCalled();
      expect(result.status).toBe(StepStatus.FAILED);
    });

    it('does not attempt healing for actions without a locator (e.g. BACK)', async () => {
      const mocks = createMocks();
      mocks.interactionDriver.back.mockRejectedValue(new Error('device disconnected'));
      const healingEngine = createMockHealingEngine();
      const executor = createExecutor(mocks, healingEngine);

      const result = await executor.execute(
        createStep({ action: ActionType.BACK, targetLocator: null, elementId: 'element-1' }),
      );

      expect(healingEngine.heal).not.toHaveBeenCalled();
      expect(result.status).toBe(StepStatus.FAILED);
    });

    it('reports the original failure when the healing engine finds no confident match', async () => {
      const mocks = createMocks();
      mocks.captureDriver.getPageSource.mockResolvedValue('<hierarchy/>');
      mocks.interactionDriver.tap.mockRejectedValue(new Error('no such element'));
      const healingEngine = createMockHealingEngine();
      healingEngine.heal.mockResolvedValue(
        Result.ok({
          elementId: 'element-1',
          healed: false,
          confidence: 0.2,
          matchedElementId: null,
          updatedLocators: null,
          aiAssisted: false,
        }),
      );
      const executor = createExecutor(mocks, healingEngine);

      const result = await executor.execute(
        createStep({ action: ActionType.CLICK, elementId: 'element-1' }),
      );

      expect(result.status).toBe(StepStatus.FAILED);
      expect(result.message).toMatch(/no such element/);
    });

    it('reports the original failure when the healing engine itself errors', async () => {
      const mocks = createMocks();
      mocks.captureDriver.getPageSource.mockResolvedValue('<hierarchy/>');
      mocks.interactionDriver.tap.mockRejectedValue(new Error('no such element'));
      const healingEngine = createMockHealingEngine();
      healingEngine.heal.mockResolvedValue(Result.err(new LocatorHealingError('repository down')));
      const executor = createExecutor(mocks, healingEngine);

      const result = await executor.execute(
        createStep({ action: ActionType.CLICK, elementId: 'element-1' }),
      );

      expect(result.status).toBe(StepStatus.FAILED);
      expect(result.message).toMatch(/no such element/);
    });

    it('reports the original failure when the retried step still fails after healing', async () => {
      const mocks = createMocks();
      mocks.captureDriver.getPageSource.mockResolvedValue('<hierarchy/>');
      mocks.interactionDriver.tap.mockRejectedValue(new Error('no such element'));
      const healingEngine = createMockHealingEngine();
      healingEngine.heal.mockResolvedValue(
        Result.ok({
          elementId: 'element-1',
          healed: true,
          confidence: 0.75,
          matchedElementId: 'candidate-1',
          updatedLocators: [HEALED_LOCATOR],
          aiAssisted: false,
        }),
      );
      const executor = createExecutor(mocks, healingEngine);

      const result = await executor.execute(
        createStep({ action: ActionType.CLICK, elementId: 'element-1' }),
      );

      expect(result.status).toBe(StepStatus.FAILED);
      expect(result.message).toMatch(/no such element/);
    });
  });
});
