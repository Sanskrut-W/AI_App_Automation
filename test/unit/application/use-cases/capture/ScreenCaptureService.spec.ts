import path from 'path';
import { ScreenCaptureService } from '../../../../../src/application/use-cases/capture/ScreenCaptureService';
import { IScreenshotManager } from '../../../../../src/application/use-cases/capture/IScreenshotManager';
import { IXmlHierarchyExtractor } from '../../../../../src/application/use-cases/capture/IXmlHierarchyExtractor';
import { ICaptureDriver } from '../../../../../src/application/interfaces/drivers/ICaptureDriver';
import { IIdGenerator } from '../../../../../src/shared/id/IIdGenerator';
import { IClock } from '../../../../../src/shared/time/IClock';
import { ScreenCaptureServiceError } from '../../../../../src/core/errors/ScreenCaptureServiceError';
import { createMockLogger } from '../../../support/createMockLogger';

const SCREENSHOT_DIR = '/artifacts/screenshots';
const XML_DIR = '/artifacts/xml-dumps';

function createService() {
  const screenshotManager: jest.Mocked<IScreenshotManager> = {
    capture: jest.fn(),
    save: jest.fn(),
  };
  const xmlExtractor: jest.Mocked<IXmlHierarchyExtractor> = { capture: jest.fn(), save: jest.fn() };
  const captureDriver: jest.Mocked<ICaptureDriver> = {
    takeScreenshot: jest.fn(),
    getPageSource: jest.fn(),
    getCurrentPackage: jest.fn(),
    getCurrentActivity: jest.fn(),
  };
  const idGenerator: jest.Mocked<IIdGenerator> = {
    generate: jest.fn().mockReturnValue('screen-1'),
  };
  const clock: jest.Mocked<IClock> = {
    now: jest.fn().mockReturnValue('2026-07-20T00:00:00.000Z'),
    nowMs: jest.fn().mockReturnValue(1784001600000),
  };
  const logger = createMockLogger();

  const service = new ScreenCaptureService(
    screenshotManager,
    xmlExtractor,
    captureDriver,
    idGenerator,
    clock,
    logger,
    { screenshotDir: SCREENSHOT_DIR, xmlDir: XML_DIR },
  );

  return { service, screenshotManager, xmlExtractor, captureDriver, idGenerator, clock, logger };
}

describe('ScreenCaptureService', () => {
  it('captures screenshot + XML + package/activity, saves both files, and returns structured metadata', async () => {
    const { service, screenshotManager, xmlExtractor, captureDriver } = createService();
    const screenshotBuffer = Buffer.from([1, 2, 3]);
    screenshotManager.capture.mockResolvedValue(screenshotBuffer);
    xmlExtractor.capture.mockResolvedValue('<hierarchy/>');
    captureDriver.getCurrentPackage.mockResolvedValue('com.example.calculator');
    captureDriver.getCurrentActivity.mockResolvedValue('.MainActivity');

    const result = await service.captureScreen();

    expect(result.isOk()).toBe(true);
    const metadata = result.unwrap();
    const expectedScreenshotPath = path.join(SCREENSHOT_DIR, 'screen-1.png');
    const expectedXmlPath = path.join(XML_DIR, 'screen-1.xml');

    expect(metadata).toEqual({
      screenId: 'screen-1',
      screenshot: expectedScreenshotPath,
      xml: expectedXmlPath,
      timestamp: '2026-07-20T00:00:00.000Z',
      packageName: 'com.example.calculator',
      activityName: '.MainActivity',
    });
    expect(screenshotManager.save).toHaveBeenCalledWith(screenshotBuffer, expectedScreenshotPath);
    expect(xmlExtractor.save).toHaveBeenCalledWith('<hierarchy/>', expectedXmlPath);
  });

  it('generates a fresh screenId for every capture', async () => {
    const { service, screenshotManager, xmlExtractor, captureDriver, idGenerator } =
      createService();
    screenshotManager.capture.mockResolvedValue(Buffer.from([1]));
    xmlExtractor.capture.mockResolvedValue('<hierarchy/>');
    captureDriver.getCurrentPackage.mockResolvedValue('com.example.app');
    captureDriver.getCurrentActivity.mockResolvedValue('.MainActivity');
    idGenerator.generate.mockReturnValueOnce('screen-1').mockReturnValueOnce('screen-2');

    const first = await service.captureScreen();
    const second = await service.captureScreen();

    expect(first.unwrap().screenId).toBe('screen-1');
    expect(second.unwrap().screenId).toBe('screen-2');
  });

  it('returns a ScreenCaptureServiceError when screenshot capture fails', async () => {
    const { service, screenshotManager, xmlExtractor, captureDriver } = createService();
    screenshotManager.capture.mockRejectedValue(new Error('driver unavailable'));
    xmlExtractor.capture.mockResolvedValue('<hierarchy/>');
    captureDriver.getCurrentPackage.mockResolvedValue('com.example.app');
    captureDriver.getCurrentActivity.mockResolvedValue('.MainActivity');

    const result = await service.captureScreen();

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ScreenCaptureServiceError);
    expect(result.unwrapErr().message).toMatch(/driver unavailable/);
  });

  it('returns a ScreenCaptureServiceError (not a thrown exception) when saving fails', async () => {
    const { service, screenshotManager, xmlExtractor, captureDriver } = createService();
    screenshotManager.capture.mockResolvedValue(Buffer.from([1]));
    xmlExtractor.capture.mockResolvedValue('<hierarchy/>');
    captureDriver.getCurrentPackage.mockResolvedValue('com.example.app');
    captureDriver.getCurrentActivity.mockResolvedValue('.MainActivity');
    screenshotManager.save.mockRejectedValue(new Error('disk full'));

    const result = await service.captureScreen();

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(ScreenCaptureServiceError);
  });

  it('defaults to artifacts/screenshots and artifacts/xml-dumps when no directories are configured', async () => {
    const screenshotManager: jest.Mocked<IScreenshotManager> = {
      capture: jest.fn(),
      save: jest.fn(),
    };
    const xmlExtractor: jest.Mocked<IXmlHierarchyExtractor> = {
      capture: jest.fn(),
      save: jest.fn(),
    };
    const captureDriver: jest.Mocked<ICaptureDriver> = {
      takeScreenshot: jest.fn(),
      getPageSource: jest.fn(),
      getCurrentPackage: jest.fn().mockResolvedValue('com.example.app'),
      getCurrentActivity: jest.fn().mockResolvedValue('.MainActivity'),
    };
    const idGenerator: jest.Mocked<IIdGenerator> = {
      generate: jest.fn().mockReturnValue('screen-1'),
    };
    const clock: jest.Mocked<IClock> = {
      now: jest.fn().mockReturnValue('2026-07-20T00:00:00.000Z'),
      nowMs: jest.fn().mockReturnValue(1784001600000),
    };
    screenshotManager.capture.mockResolvedValue(Buffer.from([1]));
    xmlExtractor.capture.mockResolvedValue('<hierarchy/>');

    const service = new ScreenCaptureService(
      screenshotManager,
      xmlExtractor,
      captureDriver,
      idGenerator,
      clock,
      createMockLogger(),
    );

    const result = await service.captureScreen();

    expect(result.unwrap().screenshot).toBe(
      path.resolve(process.cwd(), 'artifacts', 'screenshots', 'screen-1.png'),
    );
    expect(result.unwrap().xml).toBe(
      path.resolve(process.cwd(), 'artifacts', 'xml-dumps', 'screen-1.xml'),
    );
  });
});
