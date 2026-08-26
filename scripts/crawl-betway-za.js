const { WebdriverIoSessionFactory } = require('../dist/infrastructure/appium/WebdriverIoSessionFactory');
const { AndroidCapabilitiesBuilder } = require('../dist/infrastructure/android/AndroidCapabilitiesBuilder');
const { AndroidAppiumDriver } = require('../dist/infrastructure/appium/AndroidAppiumDriver');
const { ScreenshotManager } = require('../dist/application/use-cases/capture/ScreenshotManager');
const { XmlHierarchyExtractor } = require('../dist/application/use-cases/capture/XmlHierarchyExtractor');
const { ScreenCaptureService } = require('../dist/application/use-cases/capture/ScreenCaptureService');
const { XmlElementParser } = require('../dist/infrastructure/xml/XmlElementParser');
const { UuidGenerator } = require('../dist/infrastructure/id/UuidGenerator');
const { SystemClock } = require('../dist/infrastructure/time/SystemClock');
const { NodeFileWriter } = require('../dist/infrastructure/persistence/file-system/NodeFileWriter');
const { NodeFileReader } = require('../dist/infrastructure/persistence/file-system/NodeFileReader');
const { FileScreenRepository } = require('../dist/infrastructure/persistence/file-system/FileScreenRepository');
const { FileElementRepository } = require('../dist/infrastructure/persistence/file-system/FileElementRepository');
const { ScreenCrawler } = require('../dist/application/use-cases/crawler/ScreenCrawler');
const { resolveAppPaths } = require('../dist/shared/paths/AppPaths');

const logger = {
  info: (msg, meta) => console.log('[info]', msg, meta ?? ''),
  warn: (msg, meta) => console.warn('[warn]', msg, meta ?? ''),
  error: (msg, err) => console.error('[error]', msg, err ?? ''),
  debug: () => {},
};

const PACKAGE_NAME = 'com.betwayafrica.za';
const DEVICE_ID = 'emulator-5554';
const CONNECTION = { hostname: 'localhost', port: 4723, path: '/', protocol: 'http' };

async function main() {
  const appPaths = resolveAppPaths(PACKAGE_NAME);
  const sessionFactory = new WebdriverIoSessionFactory();
  const capabilitiesBuilder = new AndroidCapabilitiesBuilder();
  const appiumDriver = new AndroidAppiumDriver(sessionFactory, capabilitiesBuilder, logger, CONNECTION);
  const fileWriter = new NodeFileWriter();
  const fileReader = new NodeFileReader();
  const idGenerator = new UuidGenerator();
  const clock = new SystemClock();
  const screenshotManager = new ScreenshotManager(appiumDriver, fileWriter, logger);
  const xmlHierarchyExtractor = new XmlHierarchyExtractor(appiumDriver, fileWriter, logger);
  const xmlElementParser = new XmlElementParser(idGenerator, logger);
  const screenCaptureService = new ScreenCaptureService(
    screenshotManager, xmlHierarchyExtractor, appiumDriver, idGenerator, clock, logger,
    { screenshotDir: appPaths.screenshots, xmlDir: appPaths.xmlDumps },
  );
  const screenRepository = new FileScreenRepository(logger, appPaths.screenRepository);
  const elementRepository = new FileElementRepository(logger, appPaths.elementRepository);

  const crawler = new ScreenCrawler(
    appiumDriver, appiumDriver, screenCaptureService, xmlElementParser,
    screenRepository, elementRepository, fileReader, fileWriter, logger,
    { maxScreens: 25, maxDepth: 8, navigationGraphPath: appPaths.navigationGraph },
  );

  const result = await crawler.crawl({ deviceId: DEVICE_ID, appPackage: PACKAGE_NAME });
  if (result.isErr()) {
    console.error('CRAWL FAILED:', result.unwrapErr().message);
    process.exit(1);
  }
  const summary = result.unwrap();
  console.log('\n=== Crawl complete ===');
  console.log('Screens discovered:', summary.screensDiscovered);
  console.log('Elements visited:', summary.visitedElementIds.length);
  console.log('Navigation graph edges:', summary.navigationGraph.edges.length);
  console.log('Navigation graph screens:', summary.navigationGraph.screenIds.length);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
