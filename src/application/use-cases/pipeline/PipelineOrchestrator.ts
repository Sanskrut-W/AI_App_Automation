import { TestCase } from '../../../core/entities/TestCase';
import { Application } from '../../../core/entities/Application';
import { CrawlSummary } from '../../dto/CrawlSummary';
import { TestExecutionSummary } from '../../dto/TestExecutionSummary';
import { ReportGenerationResult } from '../../dto/ReportGenerationResult';
import { PipelineRequest } from '../../dto/PipelineRequest';
import { PipelineResult } from '../../dto/PipelineResult';
import { ExecuteStoredSuiteRequest } from '../../dto/ExecuteStoredSuiteRequest';
import { ExecuteStoredSuiteResult } from '../../dto/ExecuteStoredSuiteResult';
import { ImportManualTestCasesRequest } from '../../dto/ImportManualTestCasesRequest';
import { ImportManualTestCasesResult } from '../../dto/ImportManualTestCasesResult';
import { PipelineError } from '../../../core/errors/PipelineError';
import { ActionType } from '../../../core/enums/ActionType';
import { TestCaseGenerationError } from '../../../core/errors/TestCaseGenerationError';
import { Result } from '../../../shared/result/Result';
import { ILogger } from '../../../shared/logger/ILogger';
import { resolveAppPaths } from '../../../shared/paths/AppPaths';
import { TestModule } from '../../../shared/paths/TestModules';
import { IDeviceManager } from '../device/IDeviceManager';
import { IApplicationManager } from '../app-management/IApplicationManager';
import { IManualTestCaseSource } from '../../interfaces/manual-test-cases/IManualTestCaseSource';
import { ITestAccountRepository } from '../../interfaces/repositories/ITestAccountRepository';
import { AppScopedServices, AppScopedServicesFactory } from './AppScopedServices';
import { IPipelineOrchestrator } from './IPipelineOrchestrator';

/** Version metadata generated test cases carry — same fallback ApkMetadataReader itself uses when
 * an APK's real version can't be determined. Manual test case import never installs an APK (it
 * only reads data a prior crawl already captured), so there's no live version to attach. */
const UNKNOWN_APP_VERSION = 'unknown';

/** The auto-execute step of a full pipeline run only ever runs this module — never login, since
 * a real login changes app state in ways that would break the hamburger-menu suite's assumptions
 * about what's on screen. Use --execute-only --module login to run the login test case instead. */
const AUTO_EXECUTE_MODULE: TestModule = 'hamburger-menu';

const EMPTY_EXECUTION_SUMMARY: TestExecutionSummary = {
  totalTestCases: 0,
  passed: 0,
  failed: 0,
  results: [],
};

/**
 * Top-level "point it at an APK and go" orchestrator: resolves a device, installs and launches
 * the app, then — once the app's package name is known — builds that app's own isolated set of
 * services (its own screen/element/test-case repositories, crawler, executor, and reporter, all
 * scoped to artifacts/apps/<packageName>/ — see AppScopedServices). It crawls every reachable
 * screen (recognizing screens it already knows about from prior runs), generates one test case
 * per hamburger/navigation-menu item (skipping ones already covered by a prior run), executes the
 * app's *entire* stored suite (old + newly generated) every time, and always attempts a final
 * report — even a crawl-only run with zero test cases still gets a report. Each stage that is
 * genuinely required to proceed (device, app, crawl, execution) aborts the whole run on failure;
 * test generation and report generation themselves are non-fatal and only ever degrade with a
 * logged warning.
 */
export class PipelineOrchestrator implements IPipelineOrchestrator {
  constructor(
    private readonly deviceManager: IDeviceManager,
    private readonly applicationManager: IApplicationManager,
    private readonly buildAppScopedServices: AppScopedServicesFactory,
    private readonly manualTestCaseSource: IManualTestCaseSource,
    private readonly testAccountRepository: ITestAccountRepository,
    private readonly logger: ILogger,
  ) {}

  async run(request: PipelineRequest): Promise<Result<PipelineResult, PipelineError>> {
    this.logger.info('Starting end-to-end pipeline run', { apkPath: request.apkPath });

    try {
      const deviceId = await this.resolveDevice(request);

      this.unwrap(await this.applicationManager.validateApk(request.apkPath), 'APK validation');
      const application = this.unwrap(
        await this.applicationManager.install(deviceId, request.apkPath),
        'App installation',
      );
      this.unwrap(await this.applicationManager.launch(deviceId, application), 'App launch');

      const appDataRoot = resolveAppPaths(application.packageName).root;
      const services = this.buildAppScopedServices(application.packageName);

      const crawlSummary = this.unwrap(
        await services.screenCrawler.crawl({
          deviceId,
          appPackage: application.packageName,
          appActivity: application.launcherActivity ?? undefined,
        }),
        'Screen crawl',
      );

      const { screensAnalyzed, testCasesGenerated } = await this.generateTestCases(
        crawlSummary,
        services,
        application.versionName,
        application.versionCode,
        request.loginMobileNumber,
        request.loginPassword,
      );

      // Always execute this app's *entire* stored hamburger-menu suite (old + newly generated) —
      // that's the point of generating once and running repeatedly. Safe to omit testCaseIds here
      // (which would otherwise mean "every test case ever persisted") because this repository is
      // scoped to this app's own hamburger-menu folder alone. The login module (if generated) is
      // deliberately NOT auto-executed here — see AUTO_EXECUTE_MODULE. Skipped entirely when this
      // run only cares about discovery (request.crawlOnly).
      const executionSummary = request.crawlOnly
        ? EMPTY_EXECUTION_SUMMARY
        : await this.autoExecuteHamburgerMenuSuite(services, deviceId, application);

      const reportPaths = await this.generateReport(executionSummary, services);

      this.logger.info('Pipeline run complete', {
        deviceId,
        packageName: application.packageName,
        screensDiscovered: crawlSummary.screensDiscovered,
        testCasesGenerated,
        executed: executionSummary.totalTestCases,
      });

      return Result.ok({
        deviceId,
        application: {
          packageName: application.packageName,
          versionName: application.versionName,
          appLabel: application.appLabel,
        },
        crawlSummary,
        screensAnalyzed,
        testCasesGenerated,
        appDataRoot,
        executionSummary,
        reportPaths,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Pipeline run failed', error instanceof Error ? error : undefined);
      return Result.err(new PipelineError(message));
    }
  }

  async executeStoredSuite(
    request: ExecuteStoredSuiteRequest,
  ): Promise<Result<ExecuteStoredSuiteResult, PipelineError>> {
    this.logger.info('Starting execute-only run against a stored test suite', {
      packageName: request.packageName,
      module: request.module,
    });

    try {
      const deviceId = await this.resolveDevice(request);
      const appDataRoot = resolveAppPaths(request.packageName).root;
      const services = this.buildAppScopedServices(request.packageName);
      const moduleServices = services.buildModuleServices(request.module);

      const storedTestCases = await moduleServices.testCaseRepository.findAll();
      if (storedTestCases.length === 0) {
        throw new Error(
          `No stored test cases found for "${request.packageName}" module "${request.module}" in ${appDataRoot}. ` +
            'Run the full pipeline for this app at least once first.',
        );
      }
      // Check every requested id up front: a typo in the second of three would otherwise only
      // surface after the first has already run against the app.
      const missing = (request.testCaseIds ?? []).filter(
        (id) => !storedTestCases.some((testCase) => testCase.testCaseId === id),
      );
      if (missing.length > 0) {
        throw new Error(
          `Test case(s) ${missing.map((id) => `"${id}"`).join(', ')} were not found in ` +
            `"${request.packageName}" module "${request.module}".`,
        );
      }

      const executionSummary = this.unwrap(
        await moduleServices.testExecutionEngine.execute({
          deviceId,
          appPackage: request.packageName,
          testCaseIds: request.testCaseIds?.length ? request.testCaseIds : undefined,
        }),
        'Test execution',
      );

      const reportPaths = await this.generateReport(executionSummary, services);

      this.logger.info('Execute-only run complete', {
        deviceId,
        packageName: request.packageName,
        module: request.module,
        executed: executionSummary.totalTestCases,
      });

      return Result.ok({
        deviceId,
        packageName: request.packageName,
        module: request.module,
        appDataRoot,
        executionSummary,
        reportPaths,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Execute-only run failed', error instanceof Error ? error : undefined);
      return Result.err(new PipelineError(message));
    }
  }

  /**
   * No APK, no device, no crawl: reads a manually-authored Excel test-case sheet, resolves each
   * free-text step against elements/screenshots a prior crawl already persisted (failing clearly
   * if this app has never been crawled), and stores the resulting test cases in the app's
   * "manual" module — run later via executeStoredSuite({ module: 'manual' }). Re-importing the
   * same sheet replaces same-named test cases rather than duplicating them.
   */
  async importManualTestCases(
    request: ImportManualTestCasesRequest,
  ): Promise<Result<ImportManualTestCasesResult, PipelineError>> {
    this.logger.info('Starting manual test case import', {
      packageName: request.packageName,
      excelFilePath: request.excelFilePath,
    });

    try {
      const appDataRoot = resolveAppPaths(request.packageName).root;
      const services = this.buildAppScopedServices(request.packageName);

      const navigationGraph = await services.loadNavigationGraph();
      if (!navigationGraph) {
        throw new Error(
          `No navigation graph found for "${request.packageName}" in ${appDataRoot}. ` +
            'Run a crawl for this app at least once first (e.g. --apk <path> --crawl-only).',
        );
      }

      const sourceResult = await this.manualTestCaseSource.read(request.excelFilePath);
      if (sourceResult.isErr()) {
        throw new Error(`Failed to read manual test cases: ${sourceResult.unwrapErr().message}`);
      }
      const manualTestCases = sourceResult.unwrap();

      const testAccount = await this.testAccountRepository.findByPackageName(request.packageName);

      const generationResult = await services.manualTestCaseGenerator.generate({
        navigationGraph,
        appVersionName: UNKNOWN_APP_VERSION,
        appVersionCode: UNKNOWN_APP_VERSION,
        testAccount,
        manualTestCases,
      });
      if (generationResult.isErr()) {
        throw new Error(
          `Failed to generate manual test cases: ${generationResult.unwrapErr().message}`,
        );
      }
      const generatedTestCases = generationResult.unwrap();

      const moduleServices = services.buildModuleServices('manual');
      const existingByTitle = new Map(
        (await moduleServices.testCaseRepository.findAll()).map((testCase) => [
          testCase.title,
          testCase,
        ]),
      );

      for (const testCase of generatedTestCases) {
        const existing = existingByTitle.get(testCase.title);
        if (existing) {
          await moduleServices.testCaseRepository.update(existing.testCaseId, {
            description: testCase.description,
            steps: testCase.steps,
            priority: testCase.priority,
            tags: testCase.tags,
            appVersionName: testCase.appVersionName,
            appVersionCode: testCase.appVersionCode,
          });
        } else {
          await moduleServices.testCaseRepository.add(testCase);
        }
      }

      this.logger.info('Manual test case import complete', {
        packageName: request.packageName,
        testCasesFound: manualTestCases.length,
        testCasesGenerated: generatedTestCases.length,
      });

      return Result.ok({
        packageName: request.packageName,
        excelFilePath: request.excelFilePath,
        testCasesFound: manualTestCases.length,
        testCasesGenerated: generatedTestCases.length,
        appDataRoot,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(
        'Manual test case import failed',
        error instanceof Error ? error : undefined,
      );
      return Result.err(new PipelineError(message));
    }
  }

  private async autoExecuteHamburgerMenuSuite(
    services: AppScopedServices,
    deviceId: string,
    application: Application,
  ): Promise<TestExecutionSummary> {
    const autoExecuteServices = services.buildModuleServices(AUTO_EXECUTE_MODULE);
    const storedTestCases = await autoExecuteServices.testCaseRepository.findAll();
    if (storedTestCases.length === 0) {
      return EMPTY_EXECUTION_SUMMARY;
    }
    return this.unwrap(
      await autoExecuteServices.testExecutionEngine.execute({
        deviceId,
        appPackage: application.packageName,
        appActivity: application.launcherActivity ?? undefined,
      }),
      'Test execution',
    );
  }

  private async resolveDevice(request: {
    deviceId?: string;
    avdName?: string;
    bootTimeoutMs?: number;
  }): Promise<string> {
    let deviceId = request.deviceId;

    if (!deviceId) {
      if (!request.avdName) {
        throw new Error('Either deviceId or avdName must be provided.');
      }
      const device = this.unwrap(
        await this.deviceManager.startEmulator(request.avdName),
        'Emulator start',
      );
      deviceId = device.deviceId;
    }

    this.unwrap(
      await this.deviceManager.waitUntilBootCompleted(deviceId, request.bootTimeoutMs),
      'Device boot check',
    );
    return deviceId;
  }

  private async generateTestCases(
    crawlSummary: CrawlSummary,
    services: AppScopedServices,
    appVersionName: string,
    appVersionCode: string,
    loginMobileNumber: string | undefined,
    loginPassword: string | undefined,
  ): Promise<{ screensAnalyzed: number; testCasesGenerated: number }> {
    let testCasesGenerated = 0;

    testCasesGenerated += await this.generateModuleTestCases('hamburger-menu', services, () =>
      services.menuNavigationTestCaseGenerator.generate({
        navigationGraph: crawlSummary.navigationGraph,
        appVersionName,
        appVersionCode,
      }),
    );

    if (loginMobileNumber && loginPassword) {
      testCasesGenerated += await this.generateModuleTestCases('login', services, () =>
        services.loginTestCaseGenerator.generate({
          navigationGraph: crawlSummary.navigationGraph,
          appVersionName,
          appVersionCode,
          mobileNumber: loginMobileNumber,
          password: loginPassword,
        }),
      );
    } else {
      this.logger.warn(
        'Skipping login test case generation: both --login-mobile and --login-password are required.',
      );
    }

    testCasesGenerated += await this.generateModuleTestCases('sign-up', services, () =>
      services.signUpTestCaseGenerator.generate({
        navigationGraph: crawlSummary.navigationGraph,
        appVersionName,
        appVersionCode,
      }),
    );

    return { screensAnalyzed: 0, testCasesGenerated };
  }

  /** Shared by every module's test-case generator: dedupes against what's already stored (by the
   * LAST Click step's elementId — the part that actually distinguishes one generated test case
   * from another, since e.g. every hamburger-menu test case's FIRST Click is the shared trigger)
   * and persists only the genuinely new ones, into that module's own isolated repository. */
  private async generateModuleTestCases(
    module: TestModule,
    services: AppScopedServices,
    generate: () => Promise<Result<TestCase[], TestCaseGenerationError>>,
  ): Promise<number> {
    const { testCaseRepository } = services.buildModuleServices(module);
    const existingTestCases = await testCaseRepository.findAll();
    const coveredElementIds = new Set(
      existingTestCases.flatMap((testCase) =>
        testCase.steps
          .filter((step) => step.action === ActionType.CLICK && step.elementId)
          .map((step) => step.elementId as string),
      ),
    );

    const generationResult = await generate();
    if (generationResult.isErr()) {
      this.logger.warn(`Test case generation failed for module "${module}"`, {
        reason: generationResult.unwrapErr().message,
      });
      return 0;
    }

    let generated = 0;
    for (const testCase of generationResult.unwrap()) {
      const clickSteps = testCase.steps.filter((step) => step.action === ActionType.CLICK);
      const clickStep = clickSteps[clickSteps.length - 1];
      if (clickStep?.elementId && coveredElementIds.has(clickStep.elementId)) {
        this.logger.debug(
          `Already has a test case from a prior run, skipping (module: ${module})`,
          {
            elementId: clickStep.elementId,
          },
        );
        continue;
      }
      await testCaseRepository.add(testCase);
      generated += 1;
    }
    return generated;
  }

  private async generateReport(
    summary: TestExecutionSummary,
    services: AppScopedServices,
  ): Promise<ReportGenerationResult | null> {
    const result = await services.reportGenerator.generate(summary);
    if (result.isErr()) {
      this.logger.error('Report generation failed', result.unwrapErr());
      return null;
    }
    return result.unwrap();
  }

  private unwrap<T, E extends Error>(result: Result<T, E>, stage: string): T {
    if (result.isErr()) {
      throw new Error(`${stage} failed: ${result.unwrapErr().message}`);
    }
    return result.unwrap();
  }
}
