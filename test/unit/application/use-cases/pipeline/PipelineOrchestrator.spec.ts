import { PipelineOrchestrator } from '../../../../../src/application/use-cases/pipeline/PipelineOrchestrator';
import { IDeviceManager } from '../../../../../src/application/use-cases/device/IDeviceManager';
import { IApplicationManager } from '../../../../../src/application/use-cases/app-management/IApplicationManager';
import { IScreenCrawler } from '../../../../../src/application/use-cases/crawler/IScreenCrawler';
import { IScreenRepository } from '../../../../../src/application/interfaces/repositories/IScreenRepository';
import { IMenuNavigationTestCaseGenerator } from '../../../../../src/application/use-cases/test-generation/IMenuNavigationTestCaseGenerator';
import { ILoginTestCaseGenerator } from '../../../../../src/application/use-cases/test-generation/ILoginTestCaseGenerator';
import { ISignUpTestCaseGenerator } from '../../../../../src/application/use-cases/test-generation/ISignUpTestCaseGenerator';
import { IManualTestCaseGenerator } from '../../../../../src/application/use-cases/test-generation/IManualTestCaseGenerator';
import { IManualTestCaseSource } from '../../../../../src/application/interfaces/manual-test-cases/IManualTestCaseSource';
import { ITestAccountRepository } from '../../../../../src/application/interfaces/repositories/ITestAccountRepository';
import { ITestCaseRepository } from '../../../../../src/application/interfaces/repositories/ITestCaseRepository';
import { ITestExecutionEngine } from '../../../../../src/application/use-cases/test-execution/ITestExecutionEngine';
import { IReportGenerator } from '../../../../../src/application/interfaces/reporting/IReportGenerator';
import { TestModule } from '../../../../../src/shared/paths/TestModules';
import { Device } from '../../../../../src/core/entities/Device';
import { DeviceState } from '../../../../../src/core/enums/DeviceState';
import { Application } from '../../../../../src/core/entities/Application';
import { Platform } from '../../../../../src/core/enums/Platform';
import { Screen, ScreenProps } from '../../../../../src/core/entities/Screen';
import { TestCase } from '../../../../../src/core/entities/TestCase';
import { ActionType } from '../../../../../src/core/enums/ActionType';
import { TestPriority } from '../../../../../src/core/enums/TestPriority';
import { LocatorStrategy } from '../../../../../src/core/enums/LocatorStrategy';
import { TestCaseStatus } from '../../../../../src/core/enums/TestCaseStatus';
import { Result } from '../../../../../src/shared/result/Result';
import { PipelineError } from '../../../../../src/core/errors/PipelineError';
import { EmulatorStartError } from '../../../../../src/core/errors/EmulatorStartError';
import { EmulatorBootTimeoutError } from '../../../../../src/core/errors/EmulatorBootTimeoutError';
import { ApkValidationError } from '../../../../../src/core/errors/ApkValidationError';
import { AppInstallationError } from '../../../../../src/core/errors/AppInstallationError';
import { AppLaunchError } from '../../../../../src/core/errors/AppLaunchError';
import { CrawlError } from '../../../../../src/core/errors/CrawlError';
import { TestCaseGenerationError } from '../../../../../src/core/errors/TestCaseGenerationError';
import { ManualTestCaseSourceError } from '../../../../../src/core/errors/ManualTestCaseSourceError';
import { TestExecutionError } from '../../../../../src/core/errors/TestExecutionError';
import { ReportGenerationError } from '../../../../../src/core/errors/ReportGenerationError';
import { createMockLogger } from '../../../support/createMockLogger';

const APPLICATION = new Application({
  packageName: 'com.example.app',
  versionName: '1.0.0',
  versionCode: '1',
  appLabel: 'Example App',
  launcherActivity: '.MainActivity',
  apkPath: '/apks/app.apk',
  platform: Platform.ANDROID,
});

function createScreen(overrides: Partial<ScreenProps> = {}): Screen {
  return new Screen({
    screenId: 'screen-1',
    screenName: 'Home',
    screenshotPath: '/artifacts/screenshots/screen-1.png',
    xmlPath: '/artifacts/xml-dumps/screen-1.xml',
    packageName: 'com.example.app',
    activityName: '.MainActivity',
    parentScreenId: null,
    navigationPath: ['screen-1'],
    discoveredAt: '2026-01-01T00:00:00.000Z',
    structuralHash: 'hash-1',
    ...overrides,
  });
}

function createTestCase(
  overrides: Partial<{ testCaseId: string; screenId: string; elementId: string }> = {},
): TestCase {
  return new TestCase({
    testCaseId: overrides.testCaseId ?? 'test-case-1',
    screenId: overrides.screenId ?? 'screen-1',
    title: 'Home: Calculate button',
    description: 'purpose',
    steps: [
      {
        stepNumber: 1,
        action: ActionType.CLICK,
        targetLocator: { strategy: LocatorStrategy.RESOURCE_ID, value: 'id/btn' },
        elementId: overrides.elementId ?? 'element-1',
        value: null,
        direction: null,
        durationMs: null,
        expectedResult: 'ok',
      },
    ],
    priority: TestPriority.MEDIUM,
    tags: [],
    appVersionName: '1.0.0',
    appVersionCode: '1',
  });
}

const CRAWL_SUMMARY = {
  rootScreenId: 'screen-1',
  screensDiscovered: 1,
  visitedElementIds: ['element-1'],
  navigationGraph: { rootScreenId: 'screen-1', screenIds: ['screen-1'], edges: [] },
};

const EMPTY_EXECUTION_SUMMARY = { totalTestCases: 0, passed: 0, failed: 0, results: [] };

const EXECUTION_SUMMARY = {
  totalTestCases: 1,
  passed: 1,
  failed: 0,
  results: [
    {
      testCaseId: 'test-case-1',
      screenId: 'screen-1',
      title: 'Home: Calculate button',
      status: TestCaseStatus.PASSED,
      durationMs: 100,
      stepResults: [],
    },
  ],
};

/** One module's own isolated repository + execution engine (see ModuleScopedServices). */
function createModuleServices(seedTestCases: TestCase[] = []) {
  const persistedTestCases: TestCase[] = [...seedTestCases];

  const testCaseRepository: jest.Mocked<ITestCaseRepository> = {
    add: jest.fn(async (testCase: TestCase) => {
      persistedTestCases.push(testCase);
    }),
    update: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(async () => [...persistedTestCases]),
    exists: jest.fn(),
    exportJson: jest.fn(),
  };
  const testExecutionEngine: jest.Mocked<ITestExecutionEngine> = {
    execute: jest.fn().mockResolvedValue(Result.ok(EXECUTION_SUMMARY)),
  };

  return { testCaseRepository, testExecutionEngine };
}

/** The bundle CompositionRoot's buildAppScopedServices(packageName) factory would return â€” freshly built per app, per pipeline run. */
function createServices(seedHamburgerMenuTestCases: TestCase[] = []) {
  const screenCrawler: jest.Mocked<IScreenCrawler> = {
    crawl: jest.fn().mockResolvedValue(Result.ok(CRAWL_SUMMARY)),
  };
  const screenRepository: jest.Mocked<IScreenRepository> = {
    add: jest.fn(),
    update: jest.fn(),
    findById: jest.fn().mockResolvedValue(createScreen()),
    findAll: jest.fn(),
    exists: jest.fn(),
    exportJson: jest.fn(),
  };
  const menuNavigationTestCaseGenerator: jest.Mocked<IMenuNavigationTestCaseGenerator> = {
    generate: jest.fn().mockResolvedValue(Result.ok([createTestCase()])),
  };
  const loginTestCaseGenerator: jest.Mocked<ILoginTestCaseGenerator> = {
    generate: jest.fn().mockResolvedValue(Result.ok([])),
  };
  const signUpTestCaseGenerator: jest.Mocked<ISignUpTestCaseGenerator> = {
    generate: jest.fn().mockResolvedValue(Result.ok([])),
  };
  const manualTestCaseGenerator: jest.Mocked<IManualTestCaseGenerator> = {
    generate: jest.fn().mockResolvedValue(Result.ok([])),
  };
  const reportGenerator: jest.Mocked<IReportGenerator> = {
    generate: jest.fn().mockResolvedValue(
      Result.ok({
        htmlReportPath: '/artifacts/reports/report.html',
        jsonReportPath: '/artifacts/reports/report.json',
      }),
    ),
  };

  const hamburgerMenuModule = createModuleServices(seedHamburgerMenuTestCases);
  const loginModule = createModuleServices([]);
  const signUpModule = createModuleServices([]);
  const manualModule = createModuleServices([]);
  const buildModuleServices = jest.fn((module: TestModule) => {
    if (module === 'login') return loginModule;
    if (module === 'sign-up') return signUpModule;
    if (module === 'manual') return manualModule;
    return hamburgerMenuModule;
  });
  const loadNavigationGraph = jest.fn().mockResolvedValue(CRAWL_SUMMARY.navigationGraph);

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
    // Exposed directly so tests can assert against a specific module's mocks without having to
    // call buildModuleServices themselves.
    hamburgerMenuModule,
    loginModule,
    signUpModule,
    manualModule,
  };
}

type Services = ReturnType<typeof createServices>;

function createMocks() {
  const deviceManager: jest.Mocked<IDeviceManager> = {
    detectEmulators: jest.fn(),
    startEmulator: jest.fn(),
    stopEmulator: jest.fn(),
    checkStatus: jest.fn(),
    waitUntilBootCompleted: jest.fn().mockResolvedValue(Result.ok(undefined)),
  };
  const applicationManager: jest.Mocked<IApplicationManager> = {
    validateApk: jest.fn().mockResolvedValue(Result.ok(undefined)),
    readMetadata: jest.fn(),
    install: jest.fn().mockResolvedValue(Result.ok(APPLICATION)),
    uninstall: jest.fn(),
    launch: jest.fn().mockResolvedValue(Result.ok(undefined)),
  };
  const manualTestCaseSource: jest.Mocked<IManualTestCaseSource> = {
    read: jest.fn().mockResolvedValue(Result.ok([])),
  };
  const testAccountRepository: jest.Mocked<ITestAccountRepository> = {
    findByPackageName: jest.fn().mockResolvedValue(null),
  };
  const logger = createMockLogger();

  return {
    deviceManager,
    applicationManager,
    manualTestCaseSource,
    testAccountRepository,
    logger,
  };
}

function createOrchestrator(
  mocks: ReturnType<typeof createMocks>,
  services: Services,
): PipelineOrchestrator {
  const buildAppScopedServices = jest.fn().mockReturnValue(services);
  return new PipelineOrchestrator(
    mocks.deviceManager,
    mocks.applicationManager,
    buildAppScopedServices,
    mocks.manualTestCaseSource,
    mocks.testAccountRepository,
    mocks.logger,
  );
}

const REQUEST = { apkPath: '/apks/app.apk', deviceId: 'emulator-5554' };

describe('PipelineOrchestrator', () => {
  it('runs the full pipeline end to end and returns a complete PipelineResult', async () => {
    const mocks = createMocks();
    const services = createServices();
    const orchestrator = createOrchestrator(mocks, services);

    const result = await orchestrator.run(REQUEST);

    expect(result.isOk()).toBe(true);
    const pipelineResult = result.unwrap();
    expect(pipelineResult.deviceId).toBe('emulator-5554');
    expect(pipelineResult.application.packageName).toBe('com.example.app');
    expect(pipelineResult.crawlSummary).toEqual(CRAWL_SUMMARY);
    expect(pipelineResult.screensAnalyzed).toBe(0);
    expect(pipelineResult.testCasesGenerated).toBe(1);
    expect(pipelineResult.appDataRoot).toContain('com.example.app');
    expect(pipelineResult.executionSummary).toEqual(EXECUTION_SUMMARY);
    expect(pipelineResult.reportPaths).toEqual({
      htmlReportPath: '/artifacts/reports/report.html',
      jsonReportPath: '/artifacts/reports/report.json',
    });

    expect(mocks.applicationManager.validateApk).toHaveBeenCalledWith('/apks/app.apk');
    expect(mocks.applicationManager.install).toHaveBeenCalledWith('emulator-5554', '/apks/app.apk');
    expect(mocks.applicationManager.launch).toHaveBeenCalledWith('emulator-5554', APPLICATION);
    expect(services.screenCrawler.crawl).toHaveBeenCalledWith({
      deviceId: 'emulator-5554',
      appPackage: 'com.example.app',
      appActivity: '.MainActivity',
    });
    expect(services.hamburgerMenuModule.testCaseRepository.add).toHaveBeenCalledTimes(1);
    // No testCaseIds â€” safe to run the whole stored suite because services are app-scoped.
    expect(services.hamburgerMenuModule.testExecutionEngine.execute).toHaveBeenCalledWith({
      deviceId: 'emulator-5554',
      appPackage: 'com.example.app',
      appActivity: '.MainActivity',
    });
    expect(services.reportGenerator.generate).toHaveBeenCalledWith(EXECUTION_SUMMARY);
  });

  it('always builds/executes the hamburger-menu module specifically, never login or sign-up, during a full run', async () => {
    const mocks = createMocks();
    const services = createServices();
    const orchestrator = createOrchestrator(mocks, services);

    await orchestrator.run(REQUEST);

    expect(services.buildModuleServices).toHaveBeenCalledWith('hamburger-menu');
    expect(services.loginModule.testExecutionEngine.execute).not.toHaveBeenCalled();
    expect(services.signUpModule.testExecutionEngine.execute).not.toHaveBeenCalled();
  });

  it('skips auto-executing the hamburger-menu suite entirely when crawlOnly is requested', async () => {
    const mocks = createMocks();
    const services = createServices();
    const orchestrator = createOrchestrator(mocks, services);

    const result = await orchestrator.run({ ...REQUEST, crawlOnly: true });

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().executionSummary).toEqual(EMPTY_EXECUTION_SUMMARY);
    expect(services.hamburgerMenuModule.testExecutionEngine.execute).not.toHaveBeenCalled();
  });

  it("executes the app's entire stored suite, including test cases left over from a prior run", async () => {
    const mocks = createMocks();
    // A different element than the one this run's menu generator produces (element-1), so this
    // run's generation still adds its own test case and both end up in the stored suite.
    const services = createServices([
      createTestCase({ testCaseId: 'prior-test-case', elementId: 'element-0' }),
    ]);
    const orchestrator = createOrchestrator(mocks, services);

    await orchestrator.run(REQUEST);

    await expect(services.hamburgerMenuModule.testCaseRepository.findAll()).resolves.toHaveLength(
      2,
    );
    expect(services.hamburgerMenuModule.testExecutionEngine.execute).toHaveBeenCalledWith({
      deviceId: 'emulator-5554',
      appPackage: 'com.example.app',
      appActivity: '.MainActivity',
    });
  });

  it('does not attempt execution when there are no test cases at all', async () => {
    const mocks = createMocks();
    const services = createServices();
    services.menuNavigationTestCaseGenerator.generate.mockResolvedValue(Result.ok([]));
    const orchestrator = createOrchestrator(mocks, services);

    const result = await orchestrator.run(REQUEST);

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().executionSummary).toEqual(EMPTY_EXECUTION_SUMMARY);
    expect(services.hamburgerMenuModule.testExecutionEngine.execute).not.toHaveBeenCalled();
  });

  it('skips a menu item that already has a test case from a prior run, but still executes the full stored suite', async () => {
    const mocks = createMocks();
    // Same elementId ('element-1') as the default menuNavigationTestCaseGenerator candidate, so
    // the newly generated candidate is recognized as a duplicate and not re-persisted.
    const services = createServices([createTestCase({ testCaseId: 'existing-1' })]);
    const orchestrator = createOrchestrator(mocks, services);

    const result = await orchestrator.run(REQUEST);

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().testCasesGenerated).toBe(0);
    expect(services.menuNavigationTestCaseGenerator.generate).toHaveBeenCalled();
    expect(services.hamburgerMenuModule.testCaseRepository.add).not.toHaveBeenCalled();
    expect(services.hamburgerMenuModule.testExecutionEngine.execute).toHaveBeenCalled();
  });

  it('generates a login test case when both loginMobileNumber and loginPassword are given', async () => {
    const mocks = createMocks();
    const services = createServices();
    services.loginTestCaseGenerator.generate.mockResolvedValue(
      Result.ok([createTestCase({ testCaseId: 'login-1', elementId: 'login-trigger' })]),
    );
    const orchestrator = createOrchestrator(mocks, services);

    const result = await orchestrator.run({
      ...REQUEST,
      loginMobileNumber: '0000000000',
      loginPassword: 'fake-password',
    });

    expect(result.isOk()).toBe(true);
    // 1 hamburger-menu test case (default mock) + 1 login test case.
    expect(result.unwrap().testCasesGenerated).toBe(2);
    expect(services.loginTestCaseGenerator.generate).toHaveBeenCalledWith(
      expect.objectContaining({ mobileNumber: '0000000000', password: 'fake-password' }),
    );
    await expect(services.loginModule.testCaseRepository.findAll()).resolves.toHaveLength(1);
    // Login is generated but never auto-executed as part of a full run.
    expect(services.loginModule.testExecutionEngine.execute).not.toHaveBeenCalled();
  });

  it('skips login test case generation (with a warning) when credentials are not provided', async () => {
    const mocks = createMocks();
    const services = createServices();
    const orchestrator = createOrchestrator(mocks, services);

    await orchestrator.run(REQUEST);

    expect(services.loginTestCaseGenerator.generate).not.toHaveBeenCalled();
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'Skipping login test case generation: both --login-mobile and --login-password are required.',
    );
  });

  it('generates a sign-up test case whenever the crawl finds one â€” no credentials required', async () => {
    const mocks = createMocks();
    const services = createServices();
    services.signUpTestCaseGenerator.generate.mockResolvedValue(
      Result.ok([createTestCase({ testCaseId: 'signup-1', elementId: 'signup-trigger' })]),
    );
    const orchestrator = createOrchestrator(mocks, services);

    const result = await orchestrator.run(REQUEST);

    expect(result.isOk()).toBe(true);
    // 1 hamburger-menu test case (default mock) + 1 sign-up test case.
    expect(result.unwrap().testCasesGenerated).toBe(2);
    expect(services.signUpTestCaseGenerator.generate).toHaveBeenCalledWith(
      expect.objectContaining({ appVersionName: '1.0.0', appVersionCode: '1' }),
    );
    await expect(services.signUpModule.testCaseRepository.findAll()).resolves.toHaveLength(1);
    // Sign-up is generated but never auto-executed as part of a full run.
    expect(services.signUpModule.testExecutionEngine.execute).not.toHaveBeenCalled();
  });

  it('boots an AVD when no deviceId is given, and uses the resulting device id throughout', async () => {
    const mocks = createMocks();
    const services = createServices();
    mocks.deviceManager.startEmulator.mockResolvedValue(
      Result.ok(
        new Device({ deviceId: 'emulator-9999', isEmulator: true, state: DeviceState.DEVICE }),
      ),
    );
    const orchestrator = createOrchestrator(mocks, services);

    const result = await orchestrator.run({ apkPath: '/apks/app.apk', avdName: 'Pixel_5_API_33' });

    expect(mocks.deviceManager.startEmulator).toHaveBeenCalledWith('Pixel_5_API_33');
    expect(mocks.deviceManager.waitUntilBootCompleted).toHaveBeenCalledWith(
      'emulator-9999',
      undefined,
    );
    expect(result.unwrap().deviceId).toBe('emulator-9999');
    expect(mocks.applicationManager.install).toHaveBeenCalledWith('emulator-9999', '/apks/app.apk');
  });

  it('fails when neither deviceId nor avdName is provided', async () => {
    const mocks = createMocks();
    const services = createServices();
    const orchestrator = createOrchestrator(mocks, services);

    const result = await orchestrator.run({ apkPath: '/apks/app.apk' });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(PipelineError);
    expect(result.unwrapErr().message).toMatch(/Either deviceId or avdName/);
    expect(mocks.applicationManager.validateApk).not.toHaveBeenCalled();
  });

  it('does not persist any test cases when menu navigation test case generation fails, but the run still succeeds', async () => {
    const mocks = createMocks();
    const services = createServices();
    services.menuNavigationTestCaseGenerator.generate.mockResolvedValue(
      Result.err(new TestCaseGenerationError('element repository unavailable')),
    );
    const orchestrator = createOrchestrator(mocks, services);

    const result = await orchestrator.run(REQUEST);

    expect(result.isOk()).toBe(true);
    const pipelineResult = result.unwrap();
    expect(pipelineResult.testCasesGenerated).toBe(0);
    expect(services.hamburgerMenuModule.testCaseRepository.add).not.toHaveBeenCalled();
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'Test case generation failed for module "hamburger-menu"',
      expect.objectContaining({ reason: 'element repository unavailable' }),
    );
  });

  it('fails the whole run when device boot check fails', async () => {
    const mocks = createMocks();
    const services = createServices();
    mocks.deviceManager.waitUntilBootCompleted.mockResolvedValue(
      Result.err(new EmulatorBootTimeoutError('boot timed out')),
    );
    const orchestrator = createOrchestrator(mocks, services);

    const result = await orchestrator.run(REQUEST);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr()).toBeInstanceOf(PipelineError);
    expect(result.unwrapErr().message).toMatch(/Device boot check failed/);
    expect(mocks.applicationManager.validateApk).not.toHaveBeenCalled();
  });

  it('fails the whole run when emulator start fails', async () => {
    const mocks = createMocks();
    const services = createServices();
    mocks.deviceManager.startEmulator.mockResolvedValue(
      Result.err(new EmulatorStartError('AVD not found')),
    );
    const orchestrator = createOrchestrator(mocks, services);

    const result = await orchestrator.run({ apkPath: '/apks/app.apk', avdName: 'missing-avd' });

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toMatch(/Emulator start failed/);
  });

  it('fails the whole run when APK validation fails', async () => {
    const mocks = createMocks();
    const services = createServices();
    mocks.applicationManager.validateApk.mockResolvedValue(
      Result.err(new ApkValidationError('not a valid APK')),
    );
    const orchestrator = createOrchestrator(mocks, services);

    const result = await orchestrator.run(REQUEST);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toMatch(/APK validation failed/);
    expect(mocks.applicationManager.install).not.toHaveBeenCalled();
  });

  it('fails the whole run when app installation fails', async () => {
    const mocks = createMocks();
    const services = createServices();
    mocks.applicationManager.install.mockResolvedValue(
      Result.err(new AppInstallationError('install failed')),
    );
    const orchestrator = createOrchestrator(mocks, services);

    const result = await orchestrator.run(REQUEST);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toMatch(/App installation failed/);
    expect(mocks.applicationManager.launch).not.toHaveBeenCalled();
  });

  it('fails the whole run when app launch fails', async () => {
    const mocks = createMocks();
    const services = createServices();
    mocks.applicationManager.launch.mockResolvedValue(
      Result.err(new AppLaunchError('launch failed')),
    );
    const orchestrator = createOrchestrator(mocks, services);

    const result = await orchestrator.run(REQUEST);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toMatch(/App launch failed/);
    expect(services.screenCrawler.crawl).not.toHaveBeenCalled();
  });

  it('fails the whole run when the crawl fails', async () => {
    const mocks = createMocks();
    const services = createServices();
    services.screenCrawler.crawl.mockResolvedValue(Result.err(new CrawlError('crawl blew up')));
    const orchestrator = createOrchestrator(mocks, services);

    const result = await orchestrator.run(REQUEST);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toMatch(/Screen crawl failed/);
  });

  it('fails the whole run when test execution fails', async () => {
    const mocks = createMocks();
    const services = createServices();
    services.hamburgerMenuModule.testExecutionEngine.execute.mockResolvedValue(
      Result.err(new TestExecutionError('could not create appium session')),
    );
    const orchestrator = createOrchestrator(mocks, services);

    const result = await orchestrator.run(REQUEST);

    expect(result.isErr()).toBe(true);
    expect(result.unwrapErr().message).toMatch(/Test execution failed/);
    expect(services.reportGenerator.generate).not.toHaveBeenCalled();
  });

  it('does not fail the whole run when only report generation fails', async () => {
    const mocks = createMocks();
    const services = createServices();
    services.reportGenerator.generate.mockResolvedValue(
      Result.err(new ReportGenerationError('disk full')),
    );
    const orchestrator = createOrchestrator(mocks, services);

    const result = await orchestrator.run(REQUEST);

    expect(result.isOk()).toBe(true);
    expect(result.unwrap().reportPaths).toBeNull();
    expect(mocks.logger.error).toHaveBeenCalledWith(
      'Report generation failed',
      expect.any(ReportGenerationError),
    );
  });

  describe('executeStoredSuite', () => {
    const EXECUTE_REQUEST = {
      packageName: 'com.example.app',
      module: 'hamburger-menu' as TestModule,
      deviceId: 'emulator-5554',
    };

    it("runs an app's stored suite with no APK/crawl/AI involved, and reports", async () => {
      const mocks = createMocks();
      const services = createServices([createTestCase({ testCaseId: 'stored-1' })]);
      const orchestrator = createOrchestrator(mocks, services);

      const result = await orchestrator.executeStoredSuite(EXECUTE_REQUEST);

      expect(result.isOk()).toBe(true);
      const executeResult = result.unwrap();
      expect(executeResult.deviceId).toBe('emulator-5554');
      expect(executeResult.packageName).toBe('com.example.app');
      expect(executeResult.module).toBe('hamburger-menu');
      expect(executeResult.appDataRoot).toContain('com.example.app');
      expect(executeResult.executionSummary).toEqual(EXECUTION_SUMMARY);
      expect(executeResult.reportPaths).toEqual({
        htmlReportPath: '/artifacts/reports/report.html',
        jsonReportPath: '/artifacts/reports/report.json',
      });

      expect(services.buildModuleServices).toHaveBeenCalledWith('hamburger-menu');
      expect(services.hamburgerMenuModule.testExecutionEngine.execute).toHaveBeenCalledWith({
        deviceId: 'emulator-5554',
        appPackage: 'com.example.app',
      });
      expect(mocks.applicationManager.validateApk).not.toHaveBeenCalled();
      expect(services.screenCrawler.crawl).not.toHaveBeenCalled();
      expect(services.menuNavigationTestCaseGenerator.generate).not.toHaveBeenCalled();
    });

    it('runs only the requested test case when testCaseIds is given, not the whole module', async () => {
      const mocks = createMocks();
      const services = createServices([
        createTestCase({ testCaseId: 'stored-1' }),
        createTestCase({ testCaseId: 'stored-2' }),
      ]);
      const orchestrator = createOrchestrator(mocks, services);

      const result = await orchestrator.executeStoredSuite({
        ...EXECUTE_REQUEST,
        testCaseIds: ['stored-2'],
      });

      expect(result.isOk()).toBe(true);
      expect(services.hamburgerMenuModule.testExecutionEngine.execute).toHaveBeenCalledWith({
        deviceId: 'emulator-5554',
        appPackage: 'com.example.app',
        testCaseIds: ['stored-2'],
      });
    });

    it('passes several requested test cases through in the order given', async () => {
      const mocks = createMocks();
      const services = createServices([
        createTestCase({ testCaseId: 'stored-1' }),
        createTestCase({ testCaseId: 'stored-2' }),
      ]);
      const orchestrator = createOrchestrator(mocks, services);

      const result = await orchestrator.executeStoredSuite({
        ...EXECUTE_REQUEST,
        testCaseIds: ['stored-2', 'stored-1'],
      });

      expect(result.isOk()).toBe(true);
      expect(services.hamburgerMenuModule.testExecutionEngine.execute).toHaveBeenCalledWith({
        deviceId: 'emulator-5554',
        appPackage: 'com.example.app',
        testCaseIds: ['stored-2', 'stored-1'],
      });
    });

    it('fails clearly when a requested test case does not exist in this module', async () => {
      const mocks = createMocks();
      const services = createServices([createTestCase({ testCaseId: 'stored-1' })]);
      const orchestrator = createOrchestrator(mocks, services);

      const result = await orchestrator.executeStoredSuite({
        ...EXECUTE_REQUEST,
        testCaseIds: ['does-not-exist'],
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toMatch(/"does-not-exist" were not found/);
      expect(services.hamburgerMenuModule.testExecutionEngine.execute).not.toHaveBeenCalled();
    });

    it('rejects the whole run when only the second requested test case is missing, before executing anything', async () => {
      const mocks = createMocks();
      const services = createServices([createTestCase({ testCaseId: 'stored-1' })]);
      const orchestrator = createOrchestrator(mocks, services);

      const result = await orchestrator.executeStoredSuite({
        ...EXECUTE_REQUEST,
        testCaseIds: ['stored-1', 'typo-in-second'],
      });

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toMatch(/"typo-in-second"/);
      expect(services.hamburgerMenuModule.testExecutionEngine.execute).not.toHaveBeenCalled();
    });

    it('runs the login module in isolation when requested, never touching the hamburger-menu module', async () => {
      const mocks = createMocks();
      const services = createServices();
      services.loginModule.testCaseRepository.add(createTestCase({ testCaseId: 'login-1' }));
      const orchestrator = createOrchestrator(mocks, services);

      const result = await orchestrator.executeStoredSuite({ ...EXECUTE_REQUEST, module: 'login' });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap().module).toBe('login');
      expect(services.buildModuleServices).toHaveBeenCalledWith('login');
      expect(services.loginModule.testExecutionEngine.execute).toHaveBeenCalled();
      expect(services.hamburgerMenuModule.testExecutionEngine.execute).not.toHaveBeenCalled();
    });

    it('runs the sign-up module in isolation when requested, never touching the hamburger-menu module', async () => {
      const mocks = createMocks();
      const services = createServices();
      services.signUpModule.testCaseRepository.add(createTestCase({ testCaseId: 'signup-1' }));
      const orchestrator = createOrchestrator(mocks, services);

      const result = await orchestrator.executeStoredSuite({
        ...EXECUTE_REQUEST,
        module: 'sign-up',
      });

      expect(result.isOk()).toBe(true);
      expect(result.unwrap().module).toBe('sign-up');
      expect(services.buildModuleServices).toHaveBeenCalledWith('sign-up');
      expect(services.signUpModule.testExecutionEngine.execute).toHaveBeenCalled();
      expect(services.hamburgerMenuModule.testExecutionEngine.execute).not.toHaveBeenCalled();
    });

    it('fails when the app has no stored test cases yet for the requested module', async () => {
      const mocks = createMocks();
      const services = createServices();
      const orchestrator = createOrchestrator(mocks, services);

      const result = await orchestrator.executeStoredSuite(EXECUTE_REQUEST);

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(PipelineError);
      expect(result.unwrapErr().message).toMatch(/No stored test cases found/);
      expect(result.unwrapErr().message).toMatch(/module "hamburger-menu"/);
      expect(services.hamburgerMenuModule.testExecutionEngine.execute).not.toHaveBeenCalled();
    });

    it('fails when device resolution fails', async () => {
      const mocks = createMocks();
      const services = createServices([createTestCase()]);
      mocks.deviceManager.waitUntilBootCompleted.mockResolvedValue(
        Result.err(new EmulatorBootTimeoutError('boot timed out')),
      );
      const orchestrator = createOrchestrator(mocks, services);

      const result = await orchestrator.executeStoredSuite(EXECUTE_REQUEST);

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toMatch(/Device boot check failed/);
    });

    it('fails when execution itself fails', async () => {
      const mocks = createMocks();
      const services = createServices([createTestCase()]);
      services.hamburgerMenuModule.testExecutionEngine.execute.mockResolvedValue(
        Result.err(new TestExecutionError('could not create appium session')),
      );
      const orchestrator = createOrchestrator(mocks, services);

      const result = await orchestrator.executeStoredSuite(EXECUTE_REQUEST);

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toMatch(/Test execution failed/);
    });

    it('does not fail the run when only report generation fails', async () => {
      const mocks = createMocks();
      const services = createServices([createTestCase()]);
      services.reportGenerator.generate.mockResolvedValue(
        Result.err(new ReportGenerationError('disk full')),
      );
      const orchestrator = createOrchestrator(mocks, services);

      const result = await orchestrator.executeStoredSuite(EXECUTE_REQUEST);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap().reportPaths).toBeNull();
    });
  });

  describe('importManualTestCases', () => {
    const IMPORT_REQUEST = {
      packageName: 'com.example.app',
      excelFilePath: '/sheets/betway-za-manual-cases.xlsx',
    };
    const MANUAL_TEST_CASE_INPUT = {
      testCaseName: 'Verify login',
      objective: 'To check login',
      steps: [{ stepNumber: 1, description: 'click login button', expectedResult: 'logged in' }],
    };

    it('reads the navigation graph and Excel sheet, resolves the test account, generates, and persists new test cases', async () => {
      const mocks = createMocks();
      const services = createServices();
      mocks.manualTestCaseSource.read.mockResolvedValue(Result.ok([MANUAL_TEST_CASE_INPUT]));
      mocks.testAccountRepository.findByPackageName.mockResolvedValue({
        mobileNumber: '0000000000',
        password: 'fake-password',
      });
      services.manualTestCaseGenerator.generate.mockResolvedValue(Result.ok([createTestCase()]));
      const orchestrator = createOrchestrator(mocks, services);

      const result = await orchestrator.importManualTestCases(IMPORT_REQUEST);

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual({
        packageName: 'com.example.app',
        excelFilePath: '/sheets/betway-za-manual-cases.xlsx',
        testCasesFound: 1,
        testCasesGenerated: 1,
        appDataRoot: expect.stringContaining('com.example.app'),
      });
      expect(mocks.manualTestCaseSource.read).toHaveBeenCalledWith(IMPORT_REQUEST.excelFilePath);
      expect(mocks.testAccountRepository.findByPackageName).toHaveBeenCalledWith('com.example.app');
      expect(services.manualTestCaseGenerator.generate).toHaveBeenCalledWith(
        expect.objectContaining({
          testAccount: { mobileNumber: '0000000000', password: 'fake-password' },
          manualTestCases: [MANUAL_TEST_CASE_INPUT],
        }),
      );
      expect(services.manualModule.testCaseRepository.add).toHaveBeenCalledWith(createTestCase());
    });

    it('replaces a same-named test case from a prior import instead of duplicating it', async () => {
      const mocks = createMocks();
      const existing = createTestCase({ testCaseId: 'existing-1' });
      const services = createServices();
      services.manualModule.testCaseRepository.findAll.mockResolvedValue([existing]);
      services.manualTestCaseGenerator.generate.mockResolvedValue(
        Result.ok([createTestCase({ testCaseId: 'freshly-generated' })]),
      );
      const orchestrator = createOrchestrator(mocks, services);

      await orchestrator.importManualTestCases(IMPORT_REQUEST);

      expect(services.manualModule.testCaseRepository.update).toHaveBeenCalledWith(
        'existing-1',
        expect.objectContaining({ steps: expect.any(Array) }),
      );
      expect(services.manualModule.testCaseRepository.add).not.toHaveBeenCalled();
    });

    it('resolves testAccount to null (not an error) when no account is configured for this package', async () => {
      const mocks = createMocks();
      const services = createServices();
      mocks.testAccountRepository.findByPackageName.mockResolvedValue(null);
      const orchestrator = createOrchestrator(mocks, services);

      const result = await orchestrator.importManualTestCases(IMPORT_REQUEST);

      expect(result.isOk()).toBe(true);
      expect(services.manualTestCaseGenerator.generate).toHaveBeenCalledWith(
        expect.objectContaining({ testAccount: null }),
      );
    });

    it('fails clearly when this app has never been crawled (no navigation graph)', async () => {
      const mocks = createMocks();
      const services = createServices();
      services.loadNavigationGraph.mockResolvedValue(null);
      const orchestrator = createOrchestrator(mocks, services);

      const result = await orchestrator.importManualTestCases(IMPORT_REQUEST);

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toMatch(/No navigation graph found/);
      expect(mocks.manualTestCaseSource.read).not.toHaveBeenCalled();
    });

    it('fails when reading the Excel sheet fails', async () => {
      const mocks = createMocks();
      const services = createServices();
      mocks.manualTestCaseSource.read.mockResolvedValue(
        Result.err(new ManualTestCaseSourceError('file not found')),
      );
      const orchestrator = createOrchestrator(mocks, services);

      const result = await orchestrator.importManualTestCases(IMPORT_REQUEST);

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toMatch(/file not found/);
    });

    it('fails when manual test case generation itself fails', async () => {
      const mocks = createMocks();
      const services = createServices();
      services.manualTestCaseGenerator.generate.mockResolvedValue(
        Result.err(new TestCaseGenerationError('interpreter misconfigured')),
      );
      const orchestrator = createOrchestrator(mocks, services);

      const result = await orchestrator.importManualTestCases(IMPORT_REQUEST);

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toMatch(/interpreter misconfigured/);
    });
  });
});
