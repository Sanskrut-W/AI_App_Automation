import path from 'path';
import { IConfigProvider } from '../shared/config/IConfigProvider';
import { ILogger } from '../shared/logger/ILogger';
import { resolveAppPaths, resolveModuleTestCasesPath } from '../shared/paths/AppPaths';
import { TestModule } from '../shared/paths/TestModules';
import { IPipelineOrchestrator } from '../application/use-cases/pipeline/IPipelineOrchestrator';
import {
  AppScopedServices,
  ModuleScopedServices,
} from '../application/use-cases/pipeline/AppScopedServices';
import { NavigationGraph } from '../application/dto/NavigationGraph';
import { IAiScreenAnalyzer } from '../application/interfaces/ai/IAiScreenAnalyzer';
import { IAiLocatorHealingFallback } from '../application/interfaces/ai/IAiLocatorHealingFallback';
import { IGeminiClient } from '../application/interfaces/ai/IGeminiClient';
import { IStepInterpreter } from '../application/interfaces/ai/IStepInterpreter';
import { StepInterpretationError } from '../core/errors/StepInterpretationError';
import { Result } from '../shared/result/Result';

import { NodeCommandRunner } from '../infrastructure/process/NodeCommandRunner';
import { NodeProcessLauncher } from '../infrastructure/process/NodeProcessLauncher';
import { AdbClient } from '../infrastructure/android/AdbClient';
import { AdbAppDriver } from '../infrastructure/android/AdbAppDriver';
import { EmulatorDriver } from '../infrastructure/android/EmulatorDriver';
import { AndroidCapabilitiesBuilder } from '../infrastructure/android/AndroidCapabilitiesBuilder';
import { FileApkValidator } from '../infrastructure/apk/FileApkValidator';
import { ApkMetadataReader } from '../infrastructure/apk/ApkMetadataReader';
import { WebdriverIoSessionFactory } from '../infrastructure/appium/WebdriverIoSessionFactory';
import { AndroidAppiumDriver } from '../infrastructure/appium/AndroidAppiumDriver';
import { SystemClock } from '../infrastructure/time/SystemClock';
import { UuidGenerator } from '../infrastructure/id/UuidGenerator';
import { NodeFileWriter } from '../infrastructure/persistence/file-system/NodeFileWriter';
import { NodeFileReader } from '../infrastructure/persistence/file-system/NodeFileReader';
import { FileScreenRepository } from '../infrastructure/persistence/file-system/FileScreenRepository';
import { XmlElementParser } from '../infrastructure/xml/XmlElementParser';
import { FileElementRepository } from '../infrastructure/persistence/file-system/FileElementRepository';
import { FetchHttpClient } from '../infrastructure/http/FetchHttpClient';
import { SlidingWindowRateLimiter } from '../infrastructure/rate-limit/SlidingWindowRateLimiter';
import { GeminiPromptBuilder } from '../infrastructure/ai/gemini/GeminiPromptBuilder';
import { GeminiResponseParser } from '../infrastructure/ai/gemini/GeminiResponseParser';
import { GeminiClient } from '../infrastructure/ai/gemini/GeminiClient';
import { loadGeminiConfig } from '../infrastructure/ai/gemini/GeminiClientConfig';
import { GeminiLocatorHealingFallback } from '../infrastructure/ai/gemini/GeminiLocatorHealingFallback';
import { FileTestCaseRepository } from '../infrastructure/persistence/file-system/FileTestCaseRepository';
import { FileTestAccountRepository } from '../infrastructure/persistence/file-system/FileTestAccountRepository';
import { ExcelManualTestCaseReader } from '../infrastructure/persistence/excel/ExcelManualTestCaseReader';
import { ReportGenerator } from '../infrastructure/reporting/ReportGenerator';

import { ApplicationManager } from '../application/use-cases/app-management/ApplicationManager';
import { DeviceManager } from '../application/use-cases/device/DeviceManager';
import { ScreenshotManager } from '../application/use-cases/capture/ScreenshotManager';
import { XmlHierarchyExtractor } from '../application/use-cases/capture/XmlHierarchyExtractor';
import { ScreenCaptureService } from '../application/use-cases/capture/ScreenCaptureService';
import { ScreenCrawler } from '../application/use-cases/crawler/ScreenCrawler';
import { FingerprintEngine } from '../application/use-cases/fingerprint/FingerprintEngine';
import { ScreenAnalysisPromptBuilder } from '../application/use-cases/ai-analysis/ScreenAnalysisPromptBuilder';
import { AiScreenAnalyzer } from '../application/use-cases/ai-analysis/AiScreenAnalyzer';
import { MenuNavigationTestCaseGenerator } from '../application/use-cases/test-generation/MenuNavigationTestCaseGenerator';
import { LoginTestCaseGenerator } from '../application/use-cases/test-generation/LoginTestCaseGenerator';
import { SignUpTestCaseGenerator } from '../application/use-cases/test-generation/SignUpTestCaseGenerator';
import { ManualTestCaseGenerator } from '../application/use-cases/test-generation/ManualTestCaseGenerator';
import { StepInterpreter } from '../application/use-cases/step-interpretation/StepInterpreter';
import { StepInterpretationPromptBuilder } from '../application/use-cases/step-interpretation/StepInterpretationPromptBuilder';
import { LocatorHealingEngine } from '../application/use-cases/locator-healing/LocatorHealingEngine';
import { LocatorHealingPromptBuilder } from '../application/use-cases/locator-healing/LocatorHealingPromptBuilder';
import { TestStepExecutor } from '../application/use-cases/test-execution/TestStepExecutor';
import { TestExecutionEngine } from '../application/use-cases/test-execution/TestExecutionEngine';
import { HtmlReportRenderer } from '../application/use-cases/reporting/HtmlReportRenderer';
import { PipelineOrchestrator } from '../application/use-cases/pipeline/PipelineOrchestrator';

export interface CompositionRoot {
  pipelineOrchestrator: IPipelineOrchestrator;
}

export interface CompositionRootOptions {
  /** Caps how many distinct screens the crawler will explore before stopping. */
  maxScreens?: number;
  /** Caps how deep the crawler's DFS recursion will go. */
  maxDepth?: number;
}

/**
 * Wires every module built so far (device/app management, Appium driving, capture, repositories,
 * crawling, fingerprinting/healing, optional Gemini-backed analysis, test generation/execution,
 * reporting) into a single runnable IPipelineOrchestrator. This is the only place in the codebase
 * that imports concrete infrastructure classes directly — everything else depends only on the
 * ports declared under application/interfaces and application/use-cases.
 */
export function buildCompositionRoot(
  config: IConfigProvider,
  logger: ILogger,
  options: CompositionRootOptions = {},
): CompositionRoot {
  const commandRunner = new NodeCommandRunner();
  const processLauncher = new NodeProcessLauncher();
  const clock = new SystemClock();
  const idGenerator = new UuidGenerator();
  const fileWriter = new NodeFileWriter();
  const fileReader = new NodeFileReader();

  const adbClient = new AdbClient(commandRunner, logger);
  const emulatorDriver = new EmulatorDriver(adbClient, commandRunner, processLauncher, logger);
  const deviceManager = new DeviceManager(emulatorDriver, logger);

  const apkValidator = new FileApkValidator(logger);
  const apkMetadataReader = new ApkMetadataReader(logger);
  const adbAppDriver = new AdbAppDriver(commandRunner, logger);
  const applicationManager = new ApplicationManager(
    apkValidator,
    apkMetadataReader,
    adbAppDriver,
    logger,
  );

  const sessionFactory = new WebdriverIoSessionFactory();
  // UiAutomator2 runs a server on the device and forwards it to this port on the HOST. Two
  // concurrent sessions that both take the default (8200) fight over it, so a parallel run gives
  // each worker its own — see tools/run-parallel.js, which sets APPIUM_SYSTEM_PORT per device.
  const capabilitiesBuilder = new AndroidCapabilitiesBuilder({
    'appium:systemPort': Number(config.getOrDefault('appium.systemPort', 8200)),
  });
  const appiumConnection = {
    hostname: config.getOrDefault('appium.hostname', 'localhost'),
    // Number(): env-var overrides arrive as strings (EnvConfigProvider returns process.env
    // verbatim), and webdriverio needs a real number here.
    port: Number(config.getOrDefault('appium.port', 4723)),
    path: config.getOrDefault('appium.path', '/'),
    protocol: config.getOrDefault('appium.protocol', 'http'),
  };
  // Implements IAppiumDriver + ICaptureDriver + IInteractionDriver — the one shared instance is
  // handed to every collaborator below that needs any of those three ports.
  const appiumDriver = new AndroidAppiumDriver(
    sessionFactory,
    capabilitiesBuilder,
    logger,
    appiumConnection,
  );

  const screenshotManager = new ScreenshotManager(appiumDriver, fileWriter, logger);
  const xmlHierarchyExtractor = new XmlHierarchyExtractor(appiumDriver, fileWriter, logger);
  const xmlElementParser = new XmlElementParser(idGenerator, logger);
  const fingerprintEngine = new FingerprintEngine();

  // Screen analysis (aiScreenAnalyzer) is still built below and available for future use, but the
  // pipeline currently only generates test cases from the hamburger/navigation menu (see
  // MenuNavigationTestCaseGenerator) — it does not call AI screen analysis by default.
  const geminiServices = buildGeminiServices(config, logger, clock, fileReader);

  // Unlike every other Gemini-backed service, manual test case generation has NO deterministic
  // fallback — free-text step interpretation is impossible without it. Rather than making
  // ManualTestCaseGenerator's dependency optional (complicating every caller with a null check),
  // an unconfigured Gemini key produces a stub that fails clearly and only when actually invoked,
  // so the rest of the pipeline (which doesn't need Gemini at all) is unaffected.
  const stepInterpreter: IStepInterpreter = geminiServices
    ? new StepInterpreter(
        geminiServices.geminiClient,
        new StepInterpretationPromptBuilder(),
        fileReader,
        logger,
      )
    : {
        interpret: async () =>
          Result.err(
            new StepInterpretationError(
              'Gemini is not configured (GEMINI_API_KEY missing) — manual test case import requires it.',
            ),
          ),
      };

  // Neither depends on a specific app's package name (a workbook path is given per-call; the
  // credentials file is a single shared lookup keyed by package name internally) — built once.
  const manualTestCaseSource = new ExcelManualTestCaseReader(logger);
  const testAccountRepository = new FileTestAccountRepository(
    fileReader,
    logger,
    path.resolve(process.cwd(), 'config', 'test-accounts.json'),
  );

  // Everything below writes to per-app storage (artifacts/apps/<packageName>/), so it's built
  // fresh for whichever app the pipeline is pointed at, once its package name is known — never
  // shared across two different apps. See AppScopedServices for why.
  const buildAppScopedServices = (packageName: string): AppScopedServices => {
    const appPaths = resolveAppPaths(packageName);

    const screenRepository = new FileScreenRepository(logger, appPaths.screenRepository);
    const elementRepository = new FileElementRepository(logger, appPaths.elementRepository);

    const screenCaptureService = new ScreenCaptureService(
      screenshotManager,
      xmlHierarchyExtractor,
      appiumDriver,
      idGenerator,
      clock,
      logger,
      { screenshotDir: appPaths.screenshots, xmlDir: appPaths.xmlDumps },
    );

    const screenCrawler = new ScreenCrawler(
      appiumDriver,
      appiumDriver,
      screenCaptureService,
      xmlElementParser,
      screenRepository,
      elementRepository,
      fileReader,
      fileWriter,
      logger,
      {
        maxScreens: options.maxScreens,
        maxDepth: options.maxDepth,
        navigationGraphPath: appPaths.navigationGraph,
      },
    );

    const locatorHealingEngine = new LocatorHealingEngine(
      elementRepository,
      xmlElementParser,
      fingerprintEngine,
      logger,
      geminiServices?.aiLocatorHealingFallback,
    );

    const menuNavigationTestCaseGenerator = new MenuNavigationTestCaseGenerator(
      elementRepository,
      idGenerator,
      logger,
    );
    const loginTestCaseGenerator = new LoginTestCaseGenerator(
      elementRepository,
      idGenerator,
      logger,
    );
    const signUpTestCaseGenerator = new SignUpTestCaseGenerator(
      elementRepository,
      idGenerator,
      logger,
    );
    const manualTestCaseGenerator = new ManualTestCaseGenerator(
      elementRepository,
      screenRepository,
      stepInterpreter,
      idGenerator,
      logger,
    );
    const testStepExecutor = new TestStepExecutor(
      appiumDriver,
      appiumDriver,
      fileWriter,
      clock,
      logger,
      xmlElementParser,
      locatorHealingEngine,
      { screenshotDir: appPaths.executionScreenshots },
    );

    // Each module gets its OWN test-case repository (physically separate folder) and its own
    // TestExecutionEngine bound to it — so e.g. logging in for real during the "login" module's
    // execution never touches, or is touched by, the "hamburger-menu" module's stored suite.
    const buildModuleServices = (module: TestModule): ModuleScopedServices => {
      const testCaseRepository = new FileTestCaseRepository(
        logger,
        resolveModuleTestCasesPath(appPaths, module),
      );
      const testExecutionEngine = new TestExecutionEngine(
        appiumDriver,
        testCaseRepository,
        testStepExecutor,
        fileWriter,
        clock,
        logger,
        testAccountRepository,
        { executionLogDir: appPaths.executionLogs },
      );
      return { testCaseRepository, testExecutionEngine };
    };

    const reportGenerator = new ReportGenerator(
      fileReader,
      fileWriter,
      new HtmlReportRenderer(),
      clock,
      logger,
      { reportDir: appPaths.reports, navigationGraphPath: appPaths.navigationGraph },
    );

    const loadNavigationGraph = async (): Promise<NavigationGraph | null> => {
      try {
        const raw = await fileReader.read(appPaths.navigationGraph);
        return JSON.parse(raw) as NavigationGraph;
      } catch (error) {
        logger.warn("Failed to load this app's navigation graph — has it been crawled yet?", {
          packageName,
          navigationGraphPath: appPaths.navigationGraph,
          reason: error instanceof Error ? error.message : String(error),
        });
        return null;
      }
    };

    return {
      screenCrawler,
      screenRepository,
      menuNavigationTestCaseGenerator,
      loginTestCaseGenerator,
      signUpTestCaseGenerator,
      manualTestCaseGenerator,
      buildModuleServices,
      reportGenerator,
      loadNavigationGraph,
    };
  };

  const pipelineOrchestrator = new PipelineOrchestrator(
    deviceManager,
    applicationManager,
    buildAppScopedServices,
    manualTestCaseSource,
    testAccountRepository,
    logger,
  );

  return { pipelineOrchestrator };
}

interface GeminiServices {
  geminiClient: IGeminiClient;
  aiScreenAnalyzer: IAiScreenAnalyzer;
  aiLocatorHealingFallback: IAiLocatorHealingFallback;
}

/** Returns undefined (rather than throwing) when GEMINI_API_KEY isn't configured, so the pipeline can still run without AI analysis/test generation/AI-assisted locator healing. Both services share the same GeminiClient (and therefore the same rate limiter). */
function buildGeminiServices(
  config: IConfigProvider,
  logger: ILogger,
  clock: SystemClock,
  fileReader: NodeFileReader,
): GeminiServices | undefined {
  try {
    const geminiConfig = loadGeminiConfig(config);
    const rateLimiter = new SlidingWindowRateLimiter(
      geminiConfig.rateLimit.maxRequests,
      geminiConfig.rateLimit.windowMs,
      clock,
    );
    const geminiClient = new GeminiClient(
      new FetchHttpClient(),
      new GeminiPromptBuilder(),
      new GeminiResponseParser(),
      rateLimiter,
      logger,
      geminiConfig,
    );

    return {
      geminiClient,
      aiScreenAnalyzer: new AiScreenAnalyzer(
        geminiClient,
        new ScreenAnalysisPromptBuilder(),
        fileReader,
        logger,
      ),
      aiLocatorHealingFallback: new GeminiLocatorHealingFallback(
        geminiClient,
        new LocatorHealingPromptBuilder(),
        logger,
      ),
    };
  } catch (error) {
    logger.warn(
      'Gemini is not configured — AI screen analysis, test case generation, and AI-assisted locator healing will be skipped for this run.',
      { reason: error instanceof Error ? error.message : String(error) },
    );
    return undefined;
  }
}
