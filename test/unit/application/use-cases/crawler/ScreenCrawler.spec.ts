import { ScreenCrawler } from '../../../../../src/application/use-cases/crawler/ScreenCrawler';
import { IAppiumDriver } from '../../../../../src/application/interfaces/drivers/IAppiumDriver';
import { IInteractionDriver } from '../../../../../src/application/interfaces/drivers/IInteractionDriver';
import { IScreenCaptureService } from '../../../../../src/application/use-cases/capture/IScreenCaptureService';
import { IXmlElementParser } from '../../../../../src/application/interfaces/xml/IXmlElementParser';
import { IScreenRepository } from '../../../../../src/application/interfaces/repositories/IScreenRepository';
import { IElementRepository } from '../../../../../src/application/interfaces/repositories/IElementRepository';
import { IFileReader } from '../../../../../src/shared/fs/IFileReader';
import { IFileWriter } from '../../../../../src/shared/fs/IFileWriter';
import { ScreenCaptureResult } from '../../../../../src/application/dto/ScreenCaptureResult';
import { Element, ElementProps } from '../../../../../src/core/entities/Element';
import { LocatorStrategy } from '../../../../../src/core/enums/LocatorStrategy';
import { Platform } from '../../../../../src/core/enums/Platform';
import { AppiumSession } from '../../../../../src/core/entities/AppiumSession';
import { CrawlError } from '../../../../../src/core/errors/CrawlError';
import { ScreenCaptureServiceError } from '../../../../../src/core/errors/ScreenCaptureServiceError';
import { Screen } from '../../../../../src/core/entities/Screen';
import { Result } from '../../../../../src/shared/result/Result';
import { createMockLogger } from '../../../support/createMockLogger';
import { createHash } from 'crypto';

/** Mirrors ScreenCrawler's private computeSignature() so tests can seed a "known from a prior run" screen with a hash that will actually match a given capture/elements pair. */
function computeExpectedSignature(capture: ScreenCaptureResult, elements: Element[]): string {
  const elementSignature = elements
    .map(
      (element) =>
        `${element.className}|${element.resourceId}|${element.text}|${element.clickable}`,
    )
    .sort()
    .join(';');
  const raw = `${capture.packageName}|${capture.activityName}|${elementSignature}`;
  return createHash('sha256').update(raw).digest('hex');
}

function createCapture(overrides: Partial<ScreenCaptureResult> = {}): ScreenCaptureResult {
  return {
    screenId: 'screen-1',
    screenshot: '/artifacts/screenshots/screen-1.png',
    xml: '/artifacts/xml-dumps/screen-1.xml',
    timestamp: '2026-07-20T00:00:00.000Z',
    packageName: 'com.example.app',
    activityName: '.MainActivity',
    ...overrides,
  };
}

function createElement(overrides: Partial<ElementProps> = {}): Element {
  return new Element({
    elementId: 'element-1',
    screenId: 'screen-1',
    className: 'android.widget.Button',
    text: 'Next',
    resourceId: 'com.example.app:id/next',
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
      { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/next', priority: 1 },
    ],
    ...overrides,
  });
}

function createMocks() {
  const appiumDriver: jest.Mocked<IAppiumDriver> = {
    createSession: jest.fn().mockResolvedValue(
      new AppiumSession({
        sessionId: 'session-1',
        deviceId: 'emulator-5554',
        platform: Platform.ANDROID,
      }),
    ),
    destroySession: jest.fn().mockResolvedValue(undefined),
    isSessionActive: jest.fn().mockReturnValue(true),
    getSession: jest.fn().mockReturnValue(null),
    launchApp: jest.fn().mockResolvedValue(undefined),
    closeApp: jest.fn().mockResolvedValue(undefined),
    recoverSession: jest.fn(),
  };
  const interactionDriver: jest.Mocked<IInteractionDriver> = {
    tap: jest.fn().mockResolvedValue(undefined),
    back: jest.fn().mockResolvedValue(undefined),
    sendKeys: jest.fn().mockResolvedValue(undefined),
    clearText: jest.fn().mockResolvedValue(undefined),
    pressImeAction: jest.fn().mockResolvedValue(undefined),
    scroll: jest.fn().mockResolvedValue(undefined),
    swipe: jest.fn().mockResolvedValue(undefined),
    getText: jest.fn().mockResolvedValue(''),
    elementExists: jest.fn().mockResolvedValue(true),
  };
  const captureService: jest.Mocked<IScreenCaptureService> = {
    captureScreen: jest.fn(),
  };
  const xmlParser: jest.Mocked<IXmlElementParser> = {
    parse: jest.fn(),
  };
  const screenRepository: jest.Mocked<IScreenRepository> = {
    add: jest.fn().mockResolvedValue(undefined),
    update: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn().mockResolvedValue([]),
    exists: jest.fn(),
    exportJson: jest.fn(),
  };
  const elementRepository: jest.Mocked<IElementRepository> = {
    add: jest.fn().mockResolvedValue(undefined),
    update: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    search: jest.fn(),
    exists: jest.fn(),
    exportJson: jest.fn(),
  };
  const fileReader: jest.Mocked<IFileReader> = {
    read: jest.fn().mockResolvedValue('<hierarchy/>'),
    readBinary: jest.fn().mockResolvedValue(Buffer.from([])),
  };
  const fileWriter: jest.Mocked<IFileWriter> = { write: jest.fn().mockResolvedValue(undefined) };
  const logger = createMockLogger();

  return {
    appiumDriver,
    interactionDriver,
    captureService,
    xmlParser,
    screenRepository,
    elementRepository,
    fileReader,
    fileWriter,
    logger,
  };
}

type Mocks = ReturnType<typeof createMocks>;

function createCrawler(mocks: Mocks, options: ConstructorParameters<typeof ScreenCrawler>[9] = {}) {
  return new ScreenCrawler(
    mocks.appiumDriver,
    mocks.interactionDriver,
    mocks.captureService,
    mocks.xmlParser,
    mocks.screenRepository,
    mocks.elementRepository,
    mocks.fileReader,
    mocks.fileWriter,
    mocks.logger,
    // Real wall-clock settle waits would make every multi-tap test slow for no reason — instant
    // by default here; tests that care about the settle wait itself override this explicitly.
    { sleepFn: jest.fn().mockResolvedValue(undefined), ...options },
  );
}

describe('ScreenCrawler', () => {
  it('discovers a linear two-screen app, storing screens/elements and building a navigation graph', async () => {
    const mocks = createMocks();
    const crawler = createCrawler(mocks);

    const rootCapture = createCapture({ screenId: 'screen-1' });
    const nextCapture = createCapture({ screenId: 'screen-2', activityName: '.SecondActivity' });
    const rootButton = createElement({ elementId: 'element-1', screenId: 'screen-1' });
    const screen2Label = createElement({
      elementId: 'element-2',
      screenId: 'screen-2',
      className: 'android.widget.TextView',
      text: 'Done',
      resourceId: '',
      clickable: false,
      locators: [
        {
          strategy: LocatorStrategy.XPATH_CLASS_INDEX,
          value: '/android.widget.TextView[1]',
          priority: 4,
        },
      ],
    });

    mocks.captureService.captureScreen
      .mockResolvedValueOnce(Result.ok(rootCapture))
      .mockResolvedValueOnce(Result.ok(nextCapture))
      // backAndRecover's post-back verification capture, confirming we're really back at root.
      .mockResolvedValueOnce(Result.ok(rootCapture));
    mocks.xmlParser.parse
      .mockReturnValueOnce([rootButton])
      .mockReturnValueOnce([screen2Label])
      .mockReturnValueOnce([rootButton]);

    const result = await crawler.crawl({
      deviceId: 'emulator-5554',
      appPackage: 'com.example.app',
    });

    expect(result.isOk()).toBe(true);
    const summary = result.unwrap();
    expect(summary.rootScreenId).toBe('screen-1');
    expect(summary.screensDiscovered).toBe(2);
    expect(summary.visitedElementIds).toEqual(['element-1']);
    expect(summary.navigationGraph.screenIds.sort()).toEqual(['screen-1', 'screen-2']);
    expect(summary.navigationGraph.edges).toEqual([
      { fromScreenId: 'screen-1', toScreenId: 'screen-2', elementId: 'element-1' },
    ]);

    expect(mocks.appiumDriver.createSession).toHaveBeenCalledWith({
      deviceId: 'emulator-5554',
      appPackage: 'com.example.app',
      appActivity: undefined,
    });
    expect(mocks.appiumDriver.launchApp).toHaveBeenCalledWith('com.example.app');
    expect(mocks.screenRepository.add).toHaveBeenCalledTimes(2);
    expect(mocks.elementRepository.add).toHaveBeenCalledTimes(2);
    expect(mocks.interactionDriver.tap).toHaveBeenCalledTimes(1);
    expect(mocks.interactionDriver.back).toHaveBeenCalledTimes(1);
    expect(mocks.fileWriter.write).toHaveBeenCalledWith(
      expect.stringContaining('navigation-graph.json'),
      expect.any(String),
    );
    expect(mocks.appiumDriver.destroySession).toHaveBeenCalledTimes(1);
  });

  it('waits briefly after tapping and before capturing, so a quick UI animation (e.g. a drawer slide-in) has time to settle', async () => {
    // Proven necessary live against Betway ZA: capturing immediately after tapping the hamburger
    // trigger caught the drawer mid-slide-in, before its real content had rendered, so the
    // "opened menu" screen persisted was actually still the screen underneath it.
    const mocks = createMocks();
    const sleepFn = jest.fn().mockResolvedValue(undefined);
    const crawler = createCrawler(mocks, { sleepFn });

    const rootCapture = createCapture({ screenId: 'screen-1' });
    const nextCapture = createCapture({ screenId: 'screen-2', activityName: '.SecondActivity' });
    const rootButton = createElement({ elementId: 'element-1', screenId: 'screen-1' });

    mocks.captureService.captureScreen
      .mockResolvedValueOnce(Result.ok(rootCapture))
      .mockResolvedValueOnce(Result.ok(nextCapture))
      .mockResolvedValueOnce(Result.ok(rootCapture));
    mocks.xmlParser.parse
      .mockReturnValueOnce([rootButton])
      .mockReturnValueOnce([])
      .mockReturnValueOnce([rootButton]);

    await crawler.crawl({ deviceId: 'emulator-5554', appPackage: 'com.example.app' });

    expect(sleepFn).toHaveBeenCalledWith(500);
    const tapOrder = mocks.interactionDriver.tap.mock.invocationCallOrder[0];
    const sleepOrder = sleepFn.mock.invocationCallOrder[0];
    const postTapCaptureOrder = mocks.captureService.captureScreen.mock.invocationCallOrder[1];
    expect(tapOrder).toBeLessThan(sleepOrder);
    expect(sleepOrder).toBeLessThan(postTapCaptureOrder);
  });

  it('does not call back() when a tap does not change the screen signature (e.g. a toggle)', async () => {
    const mocks = createMocks();
    const crawler = createCrawler(mocks);

    const rootCapture = createCapture({ screenId: 'screen-1' });
    const afterToggleCapture = createCapture({ screenId: 'screen-1-recaptured' });
    const toggleButton = createElement({
      elementId: 'element-1',
      text: 'Toggle',
      resourceId: 'com.example.app:id/toggle',
    });

    mocks.captureService.captureScreen
      .mockResolvedValueOnce(Result.ok(rootCapture))
      .mockResolvedValueOnce(Result.ok(afterToggleCapture));
    mocks.xmlParser.parse.mockReturnValueOnce([toggleButton]).mockReturnValueOnce([toggleButton]);

    const result = await crawler.crawl({
      deviceId: 'emulator-5554',
      appPackage: 'com.example.app',
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().screensDiscovered).toBe(1);
    expect(mocks.interactionDriver.back).not.toHaveBeenCalled();
    expect(mocks.screenRepository.add).toHaveBeenCalledTimes(1);
  });

  it('detects a revisited (duplicate) screen and goes back without re-exploring or re-storing it', async () => {
    const mocks = createMocks();
    const crawler = createCrawler(mocks);

    const rootCapture = createCapture({ screenId: 'screen-1' });
    const detailCapture = createCapture({ screenId: 'screen-2', activityName: '.DetailActivity' });
    const backToRootCapture = createCapture({ screenId: 'screen-1-again' });

    const openDetailButton = createElement({ elementId: 'element-1', text: 'Open' });
    const cancelButton = createElement({
      elementId: 'element-2',
      screenId: 'screen-2',
      text: 'Cancel',
      resourceId: 'com.example.app:id/cancel',
    });

    mocks.captureService.captureScreen
      .mockResolvedValueOnce(Result.ok(rootCapture))
      .mockResolvedValueOnce(Result.ok(detailCapture))
      .mockResolvedValueOnce(Result.ok(backToRootCapture))
      // backAndRecover's post-back verification captures: back at detail, then back at root.
      .mockResolvedValueOnce(Result.ok(detailCapture))
      .mockResolvedValueOnce(Result.ok(rootCapture));
    mocks.xmlParser.parse
      .mockReturnValueOnce([openDetailButton])
      .mockReturnValueOnce([cancelButton])
      .mockReturnValueOnce([openDetailButton])
      .mockReturnValueOnce([cancelButton])
      .mockReturnValueOnce([openDetailButton]);

    const result = await crawler.crawl({
      deviceId: 'emulator-5554',
      appPackage: 'com.example.app',
    });

    expect(result.isOk()).toBe(true);
    const summary = result.unwrap();
    expect(summary.screensDiscovered).toBe(2);
    expect(mocks.screenRepository.add).toHaveBeenCalledTimes(2);
    expect(mocks.interactionDriver.back).toHaveBeenCalledTimes(2);
  });

  it('resolves two different paths that reach the same signature within one crawl to the SAME screenId, not an orphan id', async () => {
    // Regression test: previously knownScreens was only ever seeded from a prior run, never
    // updated with screens discovered THIS run — so a second path reaching an already-discovered
    // signature would mint a fresh, never-persisted "orphan" screenId for its graph edge.
    const mocks = createMocks();
    const crawler = createCrawler(mocks);

    const rootCapture = createCapture({ screenId: 'screen-1' });
    const openA = createElement({ elementId: 'element-1', text: 'Open A' });
    const openB = createElement({
      elementId: 'element-2',
      text: 'Open B',
      resourceId: 'com.example.app:id/openB',
    });
    const sharedCaptureA = createCapture({ screenId: 'screen-A', activityName: '.SharedActivity' });
    const sharedCaptureB = createCapture({ screenId: 'screen-B', activityName: '.SharedActivity' });
    const sharedLabel = createElement({
      elementId: 'shared-label',
      screenId: 'screen-A',
      clickable: false,
      className: 'android.widget.TextView',
      text: 'Shared content',
      resourceId: '',
      locators: [
        {
          strategy: LocatorStrategy.XPATH_CLASS_INDEX,
          value: '/android.widget.TextView[1]',
          priority: 4,
        },
      ],
    });

    mocks.captureService.captureScreen
      .mockResolvedValueOnce(Result.ok(rootCapture))
      .mockResolvedValueOnce(Result.ok(sharedCaptureA))
      // backAndRecover's post-back verification capture after exploring openA's subtree.
      .mockResolvedValueOnce(Result.ok(rootCapture))
      .mockResolvedValueOnce(Result.ok(sharedCaptureB))
      // backAndRecover's post-back verification capture after the openB duplicate is detected.
      .mockResolvedValueOnce(Result.ok(rootCapture));
    mocks.xmlParser.parse
      .mockReturnValueOnce([openA, openB])
      .mockReturnValueOnce([sharedLabel])
      .mockReturnValueOnce([openA, openB])
      .mockReturnValueOnce([sharedLabel])
      .mockReturnValueOnce([openA, openB]);

    const result = await crawler.crawl({
      deviceId: 'emulator-5554',
      appPackage: 'com.example.app',
    });

    expect(result.isOk()).toBe(true);
    const summary = result.unwrap();
    expect(summary.screensDiscovered).toBe(2);
    // Only the root and the FIRST encounter of the shared screen get persisted.
    expect(mocks.screenRepository.add).toHaveBeenCalledTimes(2);
    expect(summary.navigationGraph.edges).toEqual([
      { fromScreenId: 'screen-1', toScreenId: 'screen-A', elementId: 'element-1' },
      { fromScreenId: 'screen-1', toScreenId: 'screen-A', elementId: 'element-2' },
    ]);
  });

  it('recognizes the root screen from a prior run, reuses its existing screenId, and skips re-persisting it', async () => {
    const mocks = createMocks();
    const crawler = createCrawler(mocks);

    const rootCapture = createCapture({ screenId: 'screen-1-fresh' });
    const rootButton = createElement({ elementId: 'element-1' });
    const nextCapture = createCapture({ screenId: 'screen-2', activityName: '.SecondActivity' });
    const nextElement = createElement({
      elementId: 'element-2',
      screenId: 'screen-2',
      clickable: false,
      className: 'android.widget.TextView',
      text: 'Done',
      resourceId: '',
      locators: [
        {
          strategy: LocatorStrategy.XPATH_CLASS_INDEX,
          value: '/android.widget.TextView[1]',
          priority: 4,
        },
      ],
    });

    const priorSignature = computeExpectedSignature(rootCapture, [rootButton]);
    mocks.screenRepository.findAll.mockResolvedValue([
      new Screen({
        screenId: 'existing-root-id',
        screenName: 'Home',
        screenshotPath: '/artifacts/screenshots/existing.png',
        xmlPath: '/artifacts/xml-dumps/existing.xml',
        packageName: 'com.example.app',
        activityName: '.MainActivity',
        parentScreenId: null,
        navigationPath: ['existing-root-id'],
        discoveredAt: '2026-01-01T00:00:00.000Z',
        structuralHash: priorSignature,
      }),
    ]);

    mocks.captureService.captureScreen
      .mockResolvedValueOnce(Result.ok(rootCapture))
      .mockResolvedValueOnce(Result.ok(nextCapture))
      // backAndRecover's post-back verification capture, confirming we're really back at root.
      .mockResolvedValueOnce(Result.ok(rootCapture));
    mocks.xmlParser.parse
      .mockReturnValueOnce([rootButton])
      .mockReturnValueOnce([nextElement])
      .mockReturnValueOnce([rootButton]);

    const result = await crawler.crawl({
      deviceId: 'emulator-5554',
      appPackage: 'com.example.app',
    });

    expect(result.isOk()).toBe(true);
    const summary = result.unwrap();
    expect(summary.rootScreenId).toBe('existing-root-id');
    expect(summary.navigationGraph.screenIds).toContain('existing-root-id');
    expect(summary.navigationGraph.screenIds).not.toContain('screen-1-fresh');
    expect(summary.navigationGraph.edges).toEqual([
      { fromScreenId: 'existing-root-id', toScreenId: 'screen-2', elementId: 'element-1' },
    ]);
    // The root was already known from a prior run, so only the genuinely new screen-2 gets persisted.
    expect(mocks.screenRepository.add).toHaveBeenCalledTimes(1);
    expect(mocks.elementRepository.add).toHaveBeenCalledTimes(1);
    // Still explores through the known root to find what's new beyond it.
    expect(mocks.interactionDriver.tap).toHaveBeenCalledTimes(1);
  });

  it('recognizes a non-root screen from a prior run: links to it but does not re-persist it or explore beyond it', async () => {
    const mocks = createMocks();
    const crawler = createCrawler(mocks);

    const rootCapture = createCapture({ screenId: 'screen-1' });
    const detailCapture = createCapture({
      screenId: 'screen-2-fresh',
      activityName: '.DetailActivity',
    });
    const openButton = createElement({ elementId: 'element-1', text: 'Open' });
    const detailElements = [
      createElement({
        elementId: 'element-2',
        screenId: 'screen-2-fresh',
        text: 'Detail label',
        resourceId: '',
        clickable: false,
        className: 'android.widget.TextView',
        locators: [
          {
            strategy: LocatorStrategy.XPATH_CLASS_INDEX,
            value: '/android.widget.TextView[1]',
            priority: 4,
          },
        ],
      }),
    ];

    const priorDetailSignature = computeExpectedSignature(detailCapture, detailElements);
    mocks.screenRepository.findAll.mockResolvedValue([
      new Screen({
        screenId: 'existing-detail-id',
        screenName: 'Detail',
        screenshotPath: '/artifacts/screenshots/existing-detail.png',
        xmlPath: '/artifacts/xml-dumps/existing-detail.xml',
        packageName: 'com.example.app',
        activityName: '.DetailActivity',
        parentScreenId: 'screen-1',
        navigationPath: ['screen-1', 'existing-detail-id'],
        discoveredAt: '2026-01-01T00:00:00.000Z',
        structuralHash: priorDetailSignature,
      }),
    ]);

    mocks.captureService.captureScreen
      .mockResolvedValueOnce(Result.ok(rootCapture))
      .mockResolvedValueOnce(Result.ok(detailCapture))
      // backAndRecover's post-back verification capture, confirming we're really back at root.
      .mockResolvedValueOnce(Result.ok(rootCapture));
    mocks.xmlParser.parse
      .mockReturnValueOnce([openButton])
      .mockReturnValueOnce(detailElements)
      .mockReturnValueOnce([openButton]);

    const result = await crawler.crawl({
      deviceId: 'emulator-5554',
      appPackage: 'com.example.app',
    });

    expect(result.isOk()).toBe(true);
    const summary = result.unwrap();
    expect(summary.navigationGraph.edges).toEqual([
      { fromScreenId: 'screen-1', toScreenId: 'existing-detail-id', elementId: 'element-1' },
    ]);
    // Root is new (persisted); the detail screen is already known, so it's not re-persisted.
    expect(mocks.screenRepository.add).toHaveBeenCalledTimes(1);
    // Already-known screen -> its subtree is not explored -> the crawler backs out of it.
    expect(mocks.interactionDriver.back).toHaveBeenCalledTimes(1);
  });

  it('stops discovering new screens once maxScreens is reached', async () => {
    const mocks = createMocks();
    const crawler = createCrawler(mocks, { maxScreens: 1 });

    mocks.captureService.captureScreen.mockResolvedValue(Result.ok(createCapture()));
    mocks.xmlParser.parse.mockReturnValue([createElement()]);

    const result = await crawler.crawl({
      deviceId: 'emulator-5554',
      appPackage: 'com.example.app',
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().screensDiscovered).toBe(1);
    expect(mocks.interactionDriver.tap).not.toHaveBeenCalled();
  });

  it('stops exploring further once maxDepth is reached, but still stores the screen it stopped at', async () => {
    const mocks = createMocks();
    const crawler = createCrawler(mocks, { maxDepth: 0 });

    mocks.captureService.captureScreen.mockResolvedValue(Result.ok(createCapture()));
    mocks.xmlParser.parse.mockReturnValue([createElement()]);

    const result = await crawler.crawl({
      deviceId: 'emulator-5554',
      appPackage: 'com.example.app',
    });

    expect(result.isOk()).toBe(true);
    expect(mocks.interactionDriver.tap).not.toHaveBeenCalled();
    expect(mocks.screenRepository.add).toHaveBeenCalledTimes(1);
  });

  it('logs and continues to the next element when a tap fails', async () => {
    const mocks = createMocks();
    const crawler = createCrawler(mocks);

    const rootCapture = createCapture({ screenId: 'screen-1' });
    const brokenButton = createElement({ elementId: 'element-1', text: 'Broken' });
    const workingButton = createElement({
      elementId: 'element-2',
      text: 'Working',
      resourceId: 'com.example.app:id/working',
    });
    const nextCapture = createCapture({ screenId: 'screen-2', activityName: '.SecondActivity' });
    const deadEndElement = createElement({
      elementId: 'element-3',
      screenId: 'screen-2',
      clickable: false,
      className: 'android.widget.TextView',
      text: 'Done',
      resourceId: '',
      locators: [
        {
          strategy: LocatorStrategy.XPATH_CLASS_INDEX,
          value: '/android.widget.TextView[1]',
          priority: 4,
        },
      ],
    });

    mocks.interactionDriver.tap
      .mockRejectedValueOnce(new Error('element not interactable'))
      .mockResolvedValueOnce(undefined);
    mocks.captureService.captureScreen
      .mockResolvedValueOnce(Result.ok(rootCapture))
      .mockResolvedValueOnce(Result.ok(nextCapture))
      // backAndRecover's post-back verification capture, confirming we're really back at root.
      .mockResolvedValueOnce(Result.ok(rootCapture));
    mocks.xmlParser.parse
      .mockReturnValueOnce([brokenButton, workingButton])
      .mockReturnValueOnce([deadEndElement])
      .mockReturnValueOnce([brokenButton, workingButton]);

    const result = await crawler.crawl({
      deviceId: 'emulator-5554',
      appPackage: 'com.example.app',
    });

    expect(result.isOk()).toBe(true);
    expect(mocks.interactionDriver.tap).toHaveBeenCalledTimes(2);
    expect(result.unwrap().visitedElementIds).toEqual(['element-2']);
    expect(result.unwrap().screensDiscovered).toBe(2);
  });

  it('falls back to the next locator candidate (e.g. coordinates) when the first one fails to tap', async () => {
    const mocks = createMocks();
    const crawler = createCrawler(mocks);

    const rootCapture = createCapture({ screenId: 'screen-1' });
    const flakyButton = createElement({
      elementId: 'element-1',
      text: 'Sport',
      resourceId: 'com.example.app:id/topNavItemContainer',
      locators: [
        {
          strategy: LocatorStrategy.RESOURCE_ID,
          value: 'com.example.app:id/topNavItemContainer',
          priority: 1,
        },
        { strategy: LocatorStrategy.COORDINATES, value: '200,130', priority: 5 },
      ],
    });
    const nextCapture = createCapture({ screenId: 'screen-2', activityName: '.SecondActivity' });
    const deadEndElement = createElement({
      elementId: 'element-2',
      screenId: 'screen-2',
      clickable: false,
      className: 'android.widget.TextView',
      text: 'Done',
      resourceId: '',
      locators: [
        {
          strategy: LocatorStrategy.XPATH_CLASS_INDEX,
          value: '/android.widget.TextView[1]',
          priority: 4,
        },
      ],
    });

    mocks.interactionDriver.tap
      .mockRejectedValueOnce(new Error("element wasn't found"))
      .mockResolvedValueOnce(undefined);
    mocks.captureService.captureScreen
      .mockResolvedValueOnce(Result.ok(rootCapture))
      .mockResolvedValueOnce(Result.ok(nextCapture))
      // backAndRecover's post-back verification capture, confirming we're really back at root.
      .mockResolvedValueOnce(Result.ok(rootCapture));
    mocks.xmlParser.parse
      .mockReturnValueOnce([flakyButton])
      .mockReturnValueOnce([deadEndElement])
      .mockReturnValueOnce([flakyButton]);

    const result = await crawler.crawl({
      deviceId: 'emulator-5554',
      appPackage: 'com.example.app',
    });

    expect(result.isOk()).toBe(true);
    expect(mocks.interactionDriver.tap).toHaveBeenCalledTimes(2);
    expect(mocks.interactionDriver.tap).toHaveBeenNthCalledWith(1, {
      strategy: LocatorStrategy.RESOURCE_ID,
      value: 'com.example.app:id/topNavItemContainer',
    });
    expect(mocks.interactionDriver.tap).toHaveBeenNthCalledWith(2, {
      strategy: LocatorStrategy.COORDINATES,
      value: '200,130',
    });
    expect(result.unwrap().visitedElementIds).toEqual(['element-1']);
    expect(result.unwrap().screensDiscovered).toBe(2);
  });

  it('skips an element only after every locator candidate has failed to tap', async () => {
    const mocks = createMocks();
    const crawler = createCrawler(mocks);

    const rootCapture = createCapture({ screenId: 'screen-1' });
    const brokenButton = createElement({
      elementId: 'element-1',
      text: 'Broken',
      locators: [
        { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/broken', priority: 1 },
        { strategy: LocatorStrategy.COORDINATES, value: '200,130', priority: 5 },
      ],
    });

    mocks.interactionDriver.tap.mockRejectedValue(new Error("element wasn't found"));
    mocks.captureService.captureScreen.mockResolvedValueOnce(Result.ok(rootCapture));
    mocks.xmlParser.parse.mockReturnValueOnce([brokenButton]);

    const result = await crawler.crawl({
      deviceId: 'emulator-5554',
      appPackage: 'com.example.app',
    });

    expect(result.isOk()).toBe(true);
    expect(mocks.interactionDriver.tap).toHaveBeenCalledTimes(2);
    expect(result.unwrap().visitedElementIds).toEqual([]);
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'Failed to tap element via any locator candidate, skipping it',
      expect.objectContaining({ elementId: 'element-1' }),
    );
  });

  it('returns a CrawlError when the initial screen capture fails, but still destroys the session', async () => {
    const mocks = createMocks();
    const crawler = createCrawler(mocks);
    mocks.captureService.captureScreen.mockResolvedValue(
      Result.err(new ScreenCaptureServiceError('driver unavailable')),
    );

    const result = await crawler.crawl({
      deviceId: 'emulator-5554',
      appPackage: 'com.example.app',
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(CrawlError);
    expect(mocks.appiumDriver.destroySession).toHaveBeenCalledTimes(1);
  });

  it('returns a CrawlError and still destroys the session when launching the app fails', async () => {
    const mocks = createMocks();
    const crawler = createCrawler(mocks);
    mocks.appiumDriver.launchApp.mockRejectedValue(new Error('app not installed'));

    const result = await crawler.crawl({
      deviceId: 'emulator-5554',
      appPackage: 'com.example.app',
    });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(CrawlError);
    expect(mocks.appiumDriver.destroySession).toHaveBeenCalledTimes(1);
  });

  it('excludes a sign-up trigger from normal exploration, but peeks it directly from the root screen', async () => {
    const mocks = createMocks();
    const crawler = createCrawler(mocks);

    const rootCapture = createCapture({ screenId: 'screen-1' });
    // The direct home-screen "Sign Up" button is excluded from normal DFS exploration like Login
    // is, but — unlike a nested sign-up link only reachable through the login form — it IS peeked
    // directly, since it's the real registration entry point end users tap. See exploreScreen's
    // signUpPeek check, which runs before the login-trigger check.
    const signUpButton = createElement({
      elementId: 'element-1',
      text: 'Sign Up',
      resourceId: 'com.example.app:id/signup',
      locators: [
        { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/signup', priority: 1 },
      ],
    });
    const promotionsButton = createElement({
      elementId: 'element-2',
      text: 'Promotions',
      resourceId: 'com.example.app:id/promotions',
      locators: [
        {
          strategy: LocatorStrategy.RESOURCE_ID,
          value: 'com.example.app:id/promotions',
          priority: 1,
        },
      ],
    });
    const signUpFormCapture = createCapture({
      screenId: 'signup-form',
      activityName: '.SignUpActivity',
    });
    const emailInput = createElement({
      elementId: 'element-3',
      screenId: 'signup-form',
      className: 'android.widget.EditText',
      text: '',
      resourceId: 'com.example.app:id/email',
      locators: [
        { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/email', priority: 1 },
      ],
    });
    const nextCapture = createCapture({
      screenId: 'screen-2',
      activityName: '.PromotionsActivity',
    });
    const nextElement = createElement({
      elementId: 'element-4',
      screenId: 'screen-2',
      clickable: false,
      className: 'android.widget.TextView',
      text: 'Promotions list',
      resourceId: '',
      locators: [
        {
          strategy: LocatorStrategy.XPATH_CLASS_INDEX,
          value: '/android.widget.TextView[1]',
          priority: 4,
        },
      ],
    });

    mocks.captureService.captureScreen
      .mockResolvedValueOnce(Result.ok(rootCapture))
      // The sign-up form is WebView-hosted and can still be mid-navigation right after the tap
      // that opened it — waitForSignUpFormToSettle re-captures until two consecutive captures
      // agree, so this needs to appear twice before the crawler treats it as settled.
      .mockResolvedValueOnce(Result.ok(signUpFormCapture))
      .mockResolvedValueOnce(Result.ok(signUpFormCapture))
      // backAndRecover's post-back verification capture after peeking the sign-up form.
      .mockResolvedValueOnce(Result.ok(rootCapture))
      .mockResolvedValueOnce(Result.ok(nextCapture))
      // backAndRecover's post-back verification capture after exploring Promotions.
      .mockResolvedValueOnce(Result.ok(rootCapture));
    mocks.xmlParser.parse
      .mockReturnValueOnce([signUpButton, promotionsButton])
      .mockReturnValueOnce([emailInput])
      .mockReturnValueOnce([emailInput])
      .mockReturnValueOnce([signUpButton, promotionsButton])
      .mockReturnValueOnce([nextElement])
      .mockReturnValueOnce([signUpButton, promotionsButton]);

    const result = await crawler.crawl({
      deviceId: 'emulator-5554',
      appPackage: 'com.example.app',
    });

    expect(result.isOk()).toBe(true);
    expect(mocks.interactionDriver.tap).toHaveBeenCalledTimes(2);
    expect(mocks.interactionDriver.tap).toHaveBeenNthCalledWith(1, {
      strategy: LocatorStrategy.RESOURCE_ID,
      value: 'com.example.app:id/signup',
    });
    expect(mocks.interactionDriver.tap).toHaveBeenNthCalledWith(2, {
      strategy: LocatorStrategy.RESOURCE_ID,
      value: 'com.example.app:id/promotions',
    });
    // The sign-up trigger is tapped (peeked directly from root), but never treated as "visited"
    // exploration — and none of the sign-up form's OWN elements (e.g. emailInput) are ever tapped.
    expect(result.unwrap().visitedElementIds).toEqual(['element-2']);
    expect(result.unwrap().navigationGraph.edges).toEqual(
      expect.arrayContaining([
        { fromScreenId: 'screen-1', toScreenId: 'signup-form', elementId: 'element-1' },
      ]),
    );
  });

  it('prefers the direct home-screen sign-up trigger over the one nested inside the login form when both are present', async () => {
    const mocks = createMocks();
    const crawler = createCrawler(mocks);

    const rootCapture = createCapture({ screenId: 'screen-1' });
    const signUpButton = createElement({
      elementId: 'element-1',
      text: 'Sign Up',
      resourceId: 'com.example.app:id/signup',
      locators: [
        { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/signup', priority: 1 },
      ],
    });
    const loginButton = createElement({
      elementId: 'element-2',
      text: 'Log In',
      resourceId: 'com.example.app:id/login',
      locators: [
        { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/login', priority: 1 },
      ],
    });
    const signUpFormCapture = createCapture({
      screenId: 'signup-form',
      activityName: '.SignUpActivity',
    });
    const emailInput = createElement({
      elementId: 'element-3',
      screenId: 'signup-form',
      className: 'android.widget.EditText',
      text: '',
      resourceId: 'com.example.app:id/email',
      locators: [
        { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/email', priority: 1 },
      ],
    });
    const loginFormCapture = createCapture({
      screenId: 'login-form',
      activityName: '.LoginActivity',
    });
    const mobileInput = createElement({
      elementId: 'element-4',
      screenId: 'login-form',
      className: 'android.widget.EditText',
      text: '',
      resourceId: 'com.example.app:id/mobile',
      locators: [
        { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/mobile', priority: 1 },
      ],
    });

    mocks.captureService.captureScreen
      .mockResolvedValueOnce(Result.ok(rootCapture))
      // waitForSignUpFormToSettle re-captures until two consecutive captures agree.
      .mockResolvedValueOnce(Result.ok(signUpFormCapture))
      .mockResolvedValueOnce(Result.ok(signUpFormCapture))
      // backAndRecover's post-back verification capture after peeking the sign-up form.
      .mockResolvedValueOnce(Result.ok(rootCapture))
      // peekLoginForm's own capture right after tapping the login trigger.
      .mockResolvedValueOnce(Result.ok(loginFormCapture))
      // backAndRecover's post-back verification capture after peeking the login form (its OWN
      // nested sign-up check is skipped here, since signUpPeek is already done).
      .mockResolvedValueOnce(Result.ok(rootCapture));
    mocks.xmlParser.parse
      .mockReturnValueOnce([signUpButton, loginButton])
      .mockReturnValueOnce([emailInput])
      .mockReturnValueOnce([emailInput])
      .mockReturnValueOnce([signUpButton, loginButton])
      .mockReturnValueOnce([mobileInput])
      .mockReturnValueOnce([signUpButton, loginButton]);

    const result = await crawler.crawl({
      deviceId: 'emulator-5554',
      appPackage: 'com.example.app',
    });

    expect(result.isOk()).toBe(true);
    expect(mocks.interactionDriver.tap).toHaveBeenCalledTimes(2);
    expect(mocks.interactionDriver.tap).toHaveBeenNthCalledWith(1, {
      strategy: LocatorStrategy.RESOURCE_ID,
      value: 'com.example.app:id/signup',
    });
    expect(mocks.interactionDriver.tap).toHaveBeenNthCalledWith(2, {
      strategy: LocatorStrategy.RESOURCE_ID,
      value: 'com.example.app:id/login',
    });
    expect(result.unwrap().navigationGraph.edges).toEqual(
      expect.arrayContaining([
        { fromScreenId: 'screen-1', toScreenId: 'signup-form', elementId: 'element-1' },
        { fromScreenId: 'screen-1', toScreenId: 'login-form', elementId: 'element-2' },
      ]),
    );
    // Only one sign-up edge is ever recorded — the direct one — even though the login form is
    // also peeked afterward and could otherwise have exposed its own nested sign-up link.
    expect(
      result.unwrap().navigationGraph.edges.filter((edge) => edge.toScreenId === 'signup-form'),
    ).toHaveLength(1);
  });

  it('peeks at the login form once (captures it, but never explores or submits it), then continues normal exploration', async () => {
    const mocks = createMocks();
    const crawler = createCrawler(mocks);

    const rootCapture = createCapture({ screenId: 'screen-1' });
    const loginButton = createElement({
      elementId: 'element-1',
      text: 'Log In',
      resourceId: 'com.example.app:id/login',
      locators: [
        { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/login', priority: 1 },
      ],
    });
    const promotionsButton = createElement({
      elementId: 'element-2',
      text: 'Promotions',
      resourceId: 'com.example.app:id/promotions',
      locators: [
        {
          strategy: LocatorStrategy.RESOURCE_ID,
          value: 'com.example.app:id/promotions',
          priority: 1,
        },
      ],
    });
    const loginFormCapture = createCapture({
      screenId: 'login-form',
      activityName: '.LoginActivity',
    });
    const mobileInput = createElement({
      elementId: 'element-3',
      screenId: 'login-form',
      className: 'android.widget.EditText',
      text: '',
      resourceId: 'com.example.app:id/mobile',
      locators: [
        { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/mobile', priority: 1 },
      ],
    });
    const nextCapture = createCapture({
      screenId: 'screen-2',
      activityName: '.PromotionsActivity',
    });
    const nextElement = createElement({
      elementId: 'element-4',
      screenId: 'screen-2',
      clickable: false,
      className: 'android.widget.TextView',
      text: 'Promotions list',
      resourceId: '',
      locators: [
        {
          strategy: LocatorStrategy.XPATH_CLASS_INDEX,
          value: '/android.widget.TextView[1]',
          priority: 4,
        },
      ],
    });

    mocks.captureService.captureScreen
      .mockResolvedValueOnce(Result.ok(rootCapture))
      .mockResolvedValueOnce(Result.ok(loginFormCapture))
      // backAndRecover's post-back verification capture after peeking the login form.
      .mockResolvedValueOnce(Result.ok(rootCapture))
      .mockResolvedValueOnce(Result.ok(nextCapture))
      // backAndRecover's post-back verification capture after exploring Promotions.
      .mockResolvedValueOnce(Result.ok(rootCapture));
    mocks.xmlParser.parse
      .mockReturnValueOnce([loginButton, promotionsButton])
      .mockReturnValueOnce([mobileInput])
      .mockReturnValueOnce([loginButton, promotionsButton])
      .mockReturnValueOnce([nextElement])
      .mockReturnValueOnce([loginButton, promotionsButton]);

    const result = await crawler.crawl({
      deviceId: 'emulator-5554',
      appPackage: 'com.example.app',
    });

    expect(result.isOk()).toBe(true);
    expect(mocks.interactionDriver.tap).toHaveBeenCalledTimes(2);
    expect(mocks.interactionDriver.tap).toHaveBeenNthCalledWith(1, {
      strategy: LocatorStrategy.RESOURCE_ID,
      value: 'com.example.app:id/login',
    });
    expect(mocks.interactionDriver.tap).toHaveBeenNthCalledWith(2, {
      strategy: LocatorStrategy.RESOURCE_ID,
      value: 'com.example.app:id/promotions',
    });
    // The login trigger is tapped (peeked), but never treated as "visited" exploration —
    // and none of the login form's OWN elements (e.g. mobileInput) are ever tapped at all.
    expect(result.unwrap().visitedElementIds).toEqual(['element-2']);
    expect(result.unwrap().navigationGraph.edges).toEqual(
      expect.arrayContaining([
        { fromScreenId: 'screen-1', toScreenId: 'login-form', elementId: 'element-1' },
      ]),
    );
    expect(mocks.screenRepository.add).toHaveBeenCalledTimes(3);
    expect(mocks.elementRepository.add).toHaveBeenCalledWith(mobileInput);
  });

  it('also peeks a sign-up form reached from within the peeked login form, nested one level deeper', async () => {
    const mocks = createMocks();
    const crawler = createCrawler(mocks);

    const rootCapture = createCapture({ screenId: 'screen-1' });
    const loginButton = createElement({
      elementId: 'element-1',
      text: 'Log In',
      resourceId: 'com.example.app:id/login',
      locators: [
        { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/login', priority: 1 },
      ],
    });
    const promotionsButton = createElement({
      elementId: 'element-2',
      text: 'Promotions',
      resourceId: 'com.example.app:id/promotions',
      locators: [
        {
          strategy: LocatorStrategy.RESOURCE_ID,
          value: 'com.example.app:id/promotions',
          priority: 1,
        },
      ],
    });
    const loginFormCapture = createCapture({
      screenId: 'login-form',
      activityName: '.LoginActivity',
    });
    const mobileInput = createElement({
      elementId: 'element-3',
      screenId: 'login-form',
      className: 'android.widget.EditText',
      text: '',
      resourceId: 'com.example.app:id/mobile',
      locators: [
        { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/mobile', priority: 1 },
      ],
    });
    const signUpButton = createElement({
      elementId: 'element-signup',
      screenId: 'login-form',
      text: 'Sign Up',
      resourceId: 'com.example.app:id/signUp',
      locators: [
        { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/signUp', priority: 1 },
      ],
    });
    const signUpFormCapture = createCapture({
      screenId: 'signup-form',
      activityName: '.SignUpActivity',
    });
    const signUpField = createElement({
      elementId: 'element-4',
      screenId: 'signup-form',
      className: 'android.widget.EditText',
      text: '',
      resourceId: 'com.example.app:id/email',
      locators: [
        { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/email', priority: 1 },
      ],
    });
    const nextCapture = createCapture({
      screenId: 'screen-2',
      activityName: '.PromotionsActivity',
    });
    const nextElement = createElement({
      elementId: 'element-5',
      screenId: 'screen-2',
      clickable: false,
      className: 'android.widget.TextView',
      text: 'Promotions list',
      resourceId: '',
      locators: [
        {
          strategy: LocatorStrategy.XPATH_CLASS_INDEX,
          value: '/android.widget.TextView[1]',
          priority: 4,
        },
      ],
    });

    mocks.captureService.captureScreen
      .mockResolvedValueOnce(Result.ok(rootCapture))
      .mockResolvedValueOnce(Result.ok(loginFormCapture))
      // The sign-up form is WebView-hosted and can still be mid-navigation right after the tap
      // that opened it — waitForSignUpFormToSettle re-captures until two consecutive captures
      // agree, so this needs to appear twice before the crawler treats it as settled.
      .mockResolvedValueOnce(Result.ok(signUpFormCapture))
      .mockResolvedValueOnce(Result.ok(signUpFormCapture))
      // backAndRecover's post-back verification capture after peeking the sign-up form, back to
      // the login form.
      .mockResolvedValueOnce(Result.ok(loginFormCapture))
      // backAndRecover's post-back verification capture after peeking the login form, back to root.
      .mockResolvedValueOnce(Result.ok(rootCapture))
      .mockResolvedValueOnce(Result.ok(nextCapture))
      // backAndRecover's post-back verification capture after exploring Promotions.
      .mockResolvedValueOnce(Result.ok(rootCapture));
    mocks.xmlParser.parse
      .mockReturnValueOnce([loginButton, promotionsButton])
      .mockReturnValueOnce([mobileInput, signUpButton])
      .mockReturnValueOnce([signUpField])
      .mockReturnValueOnce([signUpField])
      .mockReturnValueOnce([mobileInput, signUpButton])
      .mockReturnValueOnce([loginButton, promotionsButton])
      .mockReturnValueOnce([nextElement])
      .mockReturnValueOnce([loginButton, promotionsButton]);

    const result = await crawler.crawl({
      deviceId: 'emulator-5554',
      appPackage: 'com.example.app',
    });

    expect(result.isOk()).toBe(true);
    expect(mocks.interactionDriver.tap).toHaveBeenCalledTimes(3);
    expect(mocks.interactionDriver.tap).toHaveBeenNthCalledWith(1, {
      strategy: LocatorStrategy.RESOURCE_ID,
      value: 'com.example.app:id/login',
    });
    expect(mocks.interactionDriver.tap).toHaveBeenNthCalledWith(2, {
      strategy: LocatorStrategy.RESOURCE_ID,
      value: 'com.example.app:id/signUp',
    });
    expect(mocks.interactionDriver.tap).toHaveBeenNthCalledWith(3, {
      strategy: LocatorStrategy.RESOURCE_ID,
      value: 'com.example.app:id/promotions',
    });
    // Neither the login form's nor the sign-up form's OWN elements are ever tapped as exploration.
    expect(result.unwrap().visitedElementIds).toEqual(['element-2']);
    expect(result.unwrap().navigationGraph.edges).toEqual(
      expect.arrayContaining([
        { fromScreenId: 'screen-1', toScreenId: 'login-form', elementId: 'element-1' },
        { fromScreenId: 'login-form', toScreenId: 'signup-form', elementId: 'element-signup' },
      ]),
    );
    expect(mocks.screenRepository.add).toHaveBeenCalledTimes(4);
    expect(mocks.elementRepository.add).toHaveBeenCalledWith(signUpField);
  });

  it('persists the sign-up trigger element even when the login form screen itself was already known from a prior run', async () => {
    const mocks = createMocks();
    const crawler = createCrawler(mocks);

    const rootCapture = createCapture({ screenId: 'screen-1' });
    const loginButton = createElement({
      elementId: 'element-1',
      text: 'Log In',
      resourceId: 'com.example.app:id/login',
      locators: [
        { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/login', priority: 1 },
      ],
    });
    const loginFormCapture = createCapture({
      screenId: 'login-form-fresh',
      activityName: '.LoginActivity',
    });
    const mobileInput = createElement({
      elementId: 'element-2',
      screenId: 'login-form-fresh',
      className: 'android.widget.EditText',
      text: '',
      resourceId: 'com.example.app:id/mobile',
      locators: [
        { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/mobile', priority: 1 },
      ],
    });
    const signUpButton = createElement({
      elementId: 'element-signup-fresh',
      screenId: 'login-form-fresh',
      text: 'Sign Up',
      resourceId: 'com.example.app:id/signUp',
      locators: [
        { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/signUp', priority: 1 },
      ],
    });
    const signUpFormCapture = createCapture({
      screenId: 'signup-form',
      activityName: '.SignUpActivity',
    });
    const signUpField = createElement({
      elementId: 'element-3',
      screenId: 'signup-form',
      className: 'android.widget.EditText',
      text: '',
      resourceId: 'com.example.app:id/email',
      locators: [
        { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/email', priority: 1 },
      ],
    });

    // The login form screen was already discovered by an earlier run — only its SIGNATURE is
    // known up front (via screenRepository.findAll()), not any of its individual elements, which
    // this fresh crawl re-parses from scratch (new elementIds every time, per XmlElementParser).
    const priorLoginFormSignature = computeExpectedSignature(loginFormCapture, [
      mobileInput,
      signUpButton,
    ]);
    mocks.screenRepository.findAll.mockResolvedValue([
      new Screen({
        screenId: 'existing-login-form-id',
        screenName: 'Login',
        screenshotPath: '/artifacts/screenshots/existing-login-form.png',
        xmlPath: '/artifacts/xml-dumps/existing-login-form.xml',
        packageName: 'com.example.app',
        activityName: '.LoginActivity',
        parentScreenId: 'screen-1',
        navigationPath: ['screen-1', 'existing-login-form-id'],
        discoveredAt: '2026-01-01T00:00:00.000Z',
        structuralHash: priorLoginFormSignature,
      }),
    ]);

    mocks.captureService.captureScreen
      .mockResolvedValueOnce(Result.ok(rootCapture))
      .mockResolvedValueOnce(Result.ok(loginFormCapture))
      .mockResolvedValueOnce(Result.ok(signUpFormCapture))
      .mockResolvedValueOnce(Result.ok(signUpFormCapture))
      // backAndRecover's post-back verification capture after peeking the sign-up form, back to
      // the login form.
      .mockResolvedValueOnce(Result.ok(loginFormCapture))
      // backAndRecover's post-back verification capture after peeking the login form, back to root.
      .mockResolvedValueOnce(Result.ok(rootCapture));
    mocks.xmlParser.parse
      .mockReturnValueOnce([loginButton])
      .mockReturnValueOnce([mobileInput, signUpButton])
      .mockReturnValueOnce([signUpField])
      .mockReturnValueOnce([signUpField])
      .mockReturnValueOnce([mobileInput, signUpButton])
      .mockReturnValueOnce([loginButton]);

    const result = await crawler.crawl({
      deviceId: 'emulator-5554',
      appPackage: 'com.example.app',
    });

    expect(result.isOk()).toBe(true);
    // The already-known login form screen is never re-persisted, nor are its OTHER elements
    // (mobileInput) — but the sign-up trigger specifically must be, since a graph edge now points
    // at it and nothing else will ever have written it to disk.
    expect(mocks.screenRepository.add).not.toHaveBeenCalledWith(
      expect.objectContaining({ screenId: 'login-form-fresh' }),
    );
    expect(mocks.elementRepository.add).not.toHaveBeenCalledWith(mobileInput);
    expect(mocks.elementRepository.add).toHaveBeenCalledWith(signUpButton);
    expect(result.unwrap().navigationGraph.edges).toEqual(
      expect.arrayContaining([
        {
          fromScreenId: 'existing-login-form-id',
          toScreenId: 'signup-form',
          elementId: 'element-signup-fresh',
        },
      ]),
    );
  });

  it('peeks the login (and nested sign-up) form even when maxScreens is set to 1, since the peek is independent of normal exploration limits', async () => {
    const mocks = createMocks();
    const crawler = createCrawler(mocks, { maxScreens: 1 });

    const rootCapture = createCapture({ screenId: 'screen-1' });
    const loginButton = createElement({
      elementId: 'element-1',
      text: 'Log In',
      resourceId: 'com.example.app:id/login',
      locators: [
        { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/login', priority: 1 },
      ],
    });
    const promotionsButton = createElement({
      elementId: 'element-2',
      text: 'Promotions',
      resourceId: 'com.example.app:id/promotions',
      locators: [
        {
          strategy: LocatorStrategy.RESOURCE_ID,
          value: 'com.example.app:id/promotions',
          priority: 1,
        },
      ],
    });
    const loginFormCapture = createCapture({
      screenId: 'login-form',
      activityName: '.LoginActivity',
    });
    const mobileInput = createElement({
      elementId: 'element-3',
      screenId: 'login-form',
      className: 'android.widget.EditText',
      text: '',
      resourceId: 'com.example.app:id/mobile',
      locators: [
        { strategy: LocatorStrategy.RESOURCE_ID, value: 'com.example.app:id/mobile', priority: 1 },
      ],
    });

    mocks.captureService.captureScreen
      .mockResolvedValueOnce(Result.ok(rootCapture))
      .mockResolvedValueOnce(Result.ok(loginFormCapture))
      // backAndRecover's post-back verification capture after peeking the login form, back to root.
      .mockResolvedValueOnce(Result.ok(rootCapture));
    mocks.xmlParser.parse
      .mockReturnValueOnce([loginButton, promotionsButton])
      .mockReturnValueOnce([mobileInput])
      .mockReturnValueOnce([loginButton, promotionsButton]);

    const result = await crawler.crawl({
      deviceId: 'emulator-5554',
      appPackage: 'com.example.app',
    });

    expect(result.isOk()).toBe(true);
    // The peek fires (login trigger tapped once) even though maxScreens=1 means the main tap loop
    // never gets to explore Promotions at all.
    expect(mocks.interactionDriver.tap).toHaveBeenCalledTimes(1);
    expect(mocks.interactionDriver.tap).toHaveBeenNthCalledWith(1, {
      strategy: LocatorStrategy.RESOURCE_ID,
      value: 'com.example.app:id/login',
    });
    expect(result.unwrap().visitedElementIds).toEqual([]);
    expect(result.unwrap().navigationGraph.edges).toEqual(
      expect.arrayContaining([
        { fromScreenId: 'screen-1', toScreenId: 'login-form', elementId: 'element-1' },
      ]),
    );
  });

  it('never taps a "Confirm to continue"-style exit button (e.g. an Android exit-app confirmation dialog)', async () => {
    const mocks = createMocks();
    const crawler = createCrawler(mocks);

    const rootCapture = createCapture({ screenId: 'screen-1' });
    const cancelButton = createElement({
      elementId: 'element-1',
      text: 'Cancel',
      resourceId: 'com.example.app:id/dialogCancel',
      locators: [
        {
          strategy: LocatorStrategy.RESOURCE_ID,
          value: 'com.example.app:id/dialogCancel',
          priority: 1,
        },
      ],
    });
    const confirmExitButton = createElement({
      elementId: 'element-2',
      text: 'Confirm to continue',
      resourceId: 'com.example.app:id/exitConfirm',
    });
    const nextCapture = createCapture({ screenId: 'screen-2', activityName: '.HomeActivity' });
    const nextElement = createElement({
      elementId: 'element-3',
      screenId: 'screen-2',
      clickable: false,
      className: 'android.widget.TextView',
      text: 'Home',
      resourceId: '',
      locators: [
        {
          strategy: LocatorStrategy.XPATH_CLASS_INDEX,
          value: '/android.widget.TextView[1]',
          priority: 4,
        },
      ],
    });

    mocks.captureService.captureScreen
      .mockResolvedValueOnce(Result.ok(rootCapture))
      .mockResolvedValueOnce(Result.ok(nextCapture))
      // backAndRecover's post-back verification capture, confirming we're really back at root.
      .mockResolvedValueOnce(Result.ok(rootCapture));
    mocks.xmlParser.parse
      .mockReturnValueOnce([cancelButton, confirmExitButton])
      .mockReturnValueOnce([nextElement])
      .mockReturnValueOnce([cancelButton, confirmExitButton]);

    const result = await crawler.crawl({
      deviceId: 'emulator-5554',
      appPackage: 'com.example.app',
    });

    expect(result.isOk()).toBe(true);
    expect(mocks.interactionDriver.tap).toHaveBeenCalledTimes(1);
    expect(mocks.interactionDriver.tap).toHaveBeenCalledWith({
      strategy: LocatorStrategy.RESOURCE_ID,
      value: 'com.example.app:id/dialogCancel',
    });
    expect(result.unwrap().visitedElementIds).toEqual(['element-1']);
  });

  it('recovers when back() unexpectedly lands on a different screen (e.g. an exit-app confirmation dialog) instead of the expected one', async () => {
    const mocks = createMocks();
    const crawler = createCrawler(mocks);

    const rootCapture = createCapture({ screenId: 'screen-1' });
    const rootButton = createElement({ elementId: 'element-1', text: 'Open' });
    const leafCapture = createCapture({ screenId: 'screen-2', activityName: '.LeafActivity' });
    const leafElement = createElement({
      elementId: 'element-2',
      screenId: 'screen-2',
      clickable: false,
      className: 'android.widget.TextView',
      text: 'Leaf label',
      resourceId: '',
      locators: [
        {
          strategy: LocatorStrategy.XPATH_CLASS_INDEX,
          value: '/android.widget.TextView[1]',
          priority: 4,
        },
      ],
    });
    const exitDialogCapture = createCapture({
      screenId: 'exit-dialog',
      activityName: '.MainActivity',
    });
    const cancelButton = createElement({
      elementId: 'element-3',
      screenId: 'exit-dialog',
      text: 'Cancel',
      resourceId: 'com.example.app:id/dialogCancel',
      locators: [
        {
          strategy: LocatorStrategy.RESOURCE_ID,
          value: 'com.example.app:id/dialogCancel',
          priority: 1,
        },
      ],
    });
    const confirmExitButton = createElement({
      elementId: 'element-4',
      screenId: 'exit-dialog',
      text: 'Confirm to continue',
      resourceId: 'com.example.app:id/exitConfirm',
    });

    mocks.captureService.captureScreen
      .mockResolvedValueOnce(Result.ok(rootCapture))
      .mockResolvedValueOnce(Result.ok(leafCapture))
      // Pressing back from the leaf lands on an unexpected exit-confirmation dialog instead of root.
      .mockResolvedValueOnce(Result.ok(exitDialogCapture))
      // backAndRecover's post-dismiss re-verification capture, confirming Cancel actually worked.
      .mockResolvedValueOnce(Result.ok(rootCapture));
    mocks.xmlParser.parse
      .mockReturnValueOnce([rootButton])
      .mockReturnValueOnce([leafElement])
      .mockReturnValueOnce([cancelButton, confirmExitButton])
      .mockReturnValueOnce([rootButton]);

    const result = await crawler.crawl({
      deviceId: 'emulator-5554',
      appPackage: 'com.example.app',
    });

    expect(result.isOk()).toBe(true);
    expect(mocks.interactionDriver.back).toHaveBeenCalledTimes(1);
    expect(mocks.interactionDriver.tap).toHaveBeenCalledTimes(2);
    expect(mocks.interactionDriver.tap).toHaveBeenNthCalledWith(2, {
      strategy: LocatorStrategy.RESOURCE_ID,
      value: 'com.example.app:id/dialogCancel',
    });
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'back() triggered an unexpected screen (e.g. an exit-app confirmation dialog, or a popup ' +
        'it only partially closed); dismissing it',
      expect.objectContaining({ elementId: 'element-3' }),
    );
  });

  it('dismisses an overlay close button on launch before treating the screen as the root', async () => {
    const mocks = createMocks();
    const crawler = createCrawler(mocks);

    const overlayCapture = createCapture({ screenId: 'overlay-1' });
    const closeButton = createElement({
      elementId: 'close-1',
      text: '',
      contentDescription: 'Close',
      resourceId: 'com.example.app:id/btn_close',
      locators: [
        {
          strategy: LocatorStrategy.RESOURCE_ID,
          value: 'com.example.app:id/btn_close',
          priority: 1,
        },
      ],
    });
    const realRootCapture = createCapture({ screenId: 'screen-1' });
    const homeButton = createElement({
      elementId: 'element-1',
      text: 'Home label',
      clickable: false,
      resourceId: '',
      locators: [
        {
          strategy: LocatorStrategy.XPATH_CLASS_INDEX,
          value: '/android.widget.TextView[1]',
          priority: 4,
        },
      ],
    });

    mocks.captureService.captureScreen
      .mockResolvedValueOnce(Result.ok(overlayCapture))
      .mockResolvedValueOnce(Result.ok(realRootCapture));
    mocks.xmlParser.parse.mockReturnValueOnce([closeButton]).mockReturnValueOnce([homeButton]);

    const result = await crawler.crawl({
      deviceId: 'emulator-5554',
      appPackage: 'com.example.app',
    });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().rootScreenId).toBe('screen-1');
    expect(mocks.interactionDriver.tap).toHaveBeenCalledWith({
      strategy: LocatorStrategy.RESOURCE_ID,
      value: 'com.example.app:id/btn_close',
    });
    expect(mocks.screenRepository.add).toHaveBeenCalledTimes(1);
    const persistedScreen = mocks.screenRepository.add.mock.calls[0][0];
    expect(persistedScreen.screenId).toBe('screen-1');
  });

  it('dismisses an overlay that appears after navigating to a new screen', async () => {
    const mocks = createMocks();
    const crawler = createCrawler(mocks);

    const rootCapture = createCapture({ screenId: 'screen-1' });
    const openButton = createElement({ elementId: 'element-1', text: 'Open' });
    const overlayCapture = createCapture({
      screenId: 'overlay-2',
      activityName: '.DetailActivity',
    });
    const closeButton = createElement({
      elementId: 'close-1',
      screenId: 'overlay-2',
      text: '',
      contentDescription: 'Dismiss',
      resourceId: 'com.example.app:id/btn_dismiss',
      locators: [
        {
          strategy: LocatorStrategy.RESOURCE_ID,
          value: 'com.example.app:id/btn_dismiss',
          priority: 1,
        },
      ],
    });
    const detailCapture = createCapture({ screenId: 'screen-2', activityName: '.DetailActivity' });
    const detailElement = createElement({
      elementId: 'element-2',
      screenId: 'screen-2',
      clickable: false,
      className: 'android.widget.TextView',
      text: 'Detail label',
      resourceId: '',
      locators: [
        {
          strategy: LocatorStrategy.XPATH_CLASS_INDEX,
          value: '/android.widget.TextView[1]',
          priority: 4,
        },
      ],
    });

    mocks.captureService.captureScreen
      .mockResolvedValueOnce(Result.ok(rootCapture))
      .mockResolvedValueOnce(Result.ok(overlayCapture))
      .mockResolvedValueOnce(Result.ok(detailCapture))
      // backAndRecover's post-back verification capture, confirming we're really back at root.
      .mockResolvedValueOnce(Result.ok(rootCapture));
    mocks.xmlParser.parse
      .mockReturnValueOnce([openButton])
      .mockReturnValueOnce([closeButton])
      .mockReturnValueOnce([detailElement])
      .mockReturnValueOnce([openButton]);

    const result = await crawler.crawl({
      deviceId: 'emulator-5554',
      appPackage: 'com.example.app',
    });

    expect(result.isOk()).toBe(true);
    expect(mocks.interactionDriver.tap).toHaveBeenCalledTimes(2);
    expect(mocks.interactionDriver.tap).toHaveBeenNthCalledWith(2, {
      strategy: LocatorStrategy.RESOURCE_ID,
      value: 'com.example.app:id/btn_dismiss',
    });
    expect(result.unwrap().navigationGraph.edges).toEqual([
      { fromScreenId: 'screen-1', toScreenId: 'screen-2', elementId: 'element-1' },
    ]);
  });
});
