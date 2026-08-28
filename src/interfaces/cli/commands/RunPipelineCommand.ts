import { bootstrap } from '../../../bootstrap/AppBootstrapper';
import { buildCompositionRoot } from '../../../bootstrap/CompositionRoot';
import { PipelineResult } from '../../../application/dto/PipelineResult';
import { ExecuteStoredSuiteResult } from '../../../application/dto/ExecuteStoredSuiteResult';
import { ImportManualTestCasesResult } from '../../../application/dto/ImportManualTestCasesResult';
import { listKnownPackageNames } from '../../../shared/paths/AppPaths';
import { parseCliArgs, USAGE } from '../parseCliArgs';

/** Thin CLI entrypoint: parses argv, wires the composition root, runs the requested mode, and prints a human-readable summary. */
export async function runPipelineCommand(argv: string[]): Promise<void> {
  let args;
  try {
    args = parseCliArgs(argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }

  if (!args) {
    console.log(USAGE);
    return;
  }

  if (args.mode === 'list-apps') {
    printKnownApps();
    return;
  }

  const { config, logger } = bootstrap();

  if (args.mode === 'execute') {
    const { pipelineOrchestrator } = buildCompositionRoot(config, logger);
    const result = await pipelineOrchestrator.executeStoredSuite({
      packageName: args.packageName,
      module: args.module,
      testCaseIds: args.testCaseIds,
      deviceId: args.deviceId,
      avdName: args.avdName,
      bootTimeoutMs: args.bootTimeoutMs,
    });

    if (result.isErr()) {
      console.error(`\nExecution failed: ${result.unwrapErr().message}\n`);
      process.exitCode = 1;
      return;
    }

    printExecuteSummary(result.unwrap());
    return;
  }

  if (args.mode === 'import') {
    const { pipelineOrchestrator } = buildCompositionRoot(config, logger);
    const result = await pipelineOrchestrator.importManualTestCases({
      packageName: args.packageName,
      excelFilePath: args.excelFilePath,
    });

    if (result.isErr()) {
      console.error(`\nImport failed: ${result.unwrapErr().message}\n`);
      process.exitCode = 1;
      return;
    }

    printImportSummary(result.unwrap());
    return;
  }

  const { pipelineOrchestrator } = buildCompositionRoot(config, logger, {
    maxScreens: args.maxScreens,
    maxDepth: args.maxDepth,
  });

  const result = await pipelineOrchestrator.run({
    apkPath: args.apkPath,
    deviceId: args.deviceId,
    avdName: args.avdName,
    bootTimeoutMs: args.bootTimeoutMs,
    loginMobileNumber: args.loginMobileNumber,
    loginPassword: args.loginPassword,
    crawlOnly: args.crawlOnly,
  });

  if (result.isErr()) {
    console.error(`\nPipeline failed: ${result.unwrapErr().message}\n`);
    process.exitCode = 1;
    return;
  }

  printSummary(result.unwrap());
}

function printKnownApps(): void {
  const packageNames = listKnownPackageNames();
  if (packageNames.length === 0) {
    console.log(
      '\nNo apps have a stored test suite yet. Run the full pipeline against one first.\n',
    );
    return;
  }
  console.log('\nApps with a stored test suite:');
  packageNames.forEach((name) => console.log(`  - ${name}`));
  console.log('');
}

function printSummary(summary: PipelineResult): void {
  const { application, crawlSummary, executionSummary } = summary;
  console.log('\n=== Pipeline complete ===');
  console.log(`Device:                ${summary.deviceId}`);
  console.log(
    `App:                   ${application.appLabel} (${application.packageName} v${application.versionName})`,
  );
  console.log(`Screens discovered:    ${crawlSummary.screensDiscovered}`);
  console.log(`Screens AI-analyzed:   ${summary.screensAnalyzed}`);
  console.log(`Test cases generated:  ${summary.testCasesGenerated} (new this run)`);
  console.log(
    `Test cases executed:   ${executionSummary.totalTestCases} (${executionSummary.passed} passed, ${executionSummary.failed} failed)`,
  );
  console.log(`App data folder:       ${summary.appDataRoot}`);
  printReportPaths(summary.reportPaths);
  console.log('==========================\n');
}

function printExecuteSummary(summary: ExecuteStoredSuiteResult): void {
  const { executionSummary } = summary;
  console.log('\n=== Execute-only run complete ===');
  console.log(`Device:                ${summary.deviceId}`);
  console.log(`Package:               ${summary.packageName}`);
  console.log(`Module:                ${summary.module}`);
  console.log(
    `Test cases executed:   ${executionSummary.totalTestCases} (${executionSummary.passed} passed, ${executionSummary.failed} failed)`,
  );
  console.log(`App data folder:       ${summary.appDataRoot}`);
  printReportPaths(summary.reportPaths);
  console.log('==================================\n');
}

function printImportSummary(summary: ImportManualTestCasesResult): void {
  console.log('\n=== Import complete ===');
  console.log(`Package:               ${summary.packageName}`);
  console.log(`Excel file:            ${summary.excelFilePath}`);
  console.log(`Test cases found:      ${summary.testCasesFound}`);
  console.log(`Test cases generated:  ${summary.testCasesGenerated}`);
  console.log(`App data folder:       ${summary.appDataRoot}`);
  console.log('Run them with: --execute-only --module manual --device <serial> (or --avd <name>)');
  console.log('==================================\n');
}

function printReportPaths(reportPaths: PipelineResult['reportPaths']): void {
  if (reportPaths) {
    console.log(`HTML report:           ${reportPaths.htmlReportPath}`);
    console.log(`JSON report:           ${reportPaths.jsonReportPath}`);
  } else {
    console.log('Report generation failed — see the logs above for details.');
  }
}
