const { UuidGenerator } = require('../dist/infrastructure/id/UuidGenerator');
const { FileElementRepository } = require('../dist/infrastructure/persistence/file-system/FileElementRepository');
const { FileTestCaseRepository } = require('../dist/infrastructure/persistence/file-system/FileTestCaseRepository');
const { SignUpTestCaseGenerator } = require('../dist/application/use-cases/test-generation/SignUpTestCaseGenerator');
const { resolveAppPaths, resolveModuleTestCasesPath } = require('../dist/shared/paths/AppPaths');

const logger = {
  info: (msg, meta) => console.log('[info]', msg, meta ?? ''),
  warn: (msg, meta) => console.warn('[warn]', msg, meta ?? ''),
  error: (msg, err) => console.error('[error]', msg, err ?? ''),
  debug: () => {},
};

const PACKAGE_NAME = 'com.betwayafrica.za';
// The direct home-screen "Sign Up" button, captured (with its own Screen record) via an earlier
// live discovery run — see element-repository/00083c66-d6d3-4f01-bea8-9e8662498864.json.
const HOME_SCREEN_ID = '6d74a22e-c965-4c6f-a703-739140e8e922';
const TOOLBAR_REGISTER_ELEMENT_ID = '00083c66-d6d3-4f01-bea8-9e8662498864';
// The sign-up form screen reached by tapping it, from the fully-verified, ANR-free discovery run
// (background task bj2veiecr) — 174 elements, all 5 fields + Next confirmed found and filled.
const SIGN_UP_FORM_SCREEN_ID = '0d3b33ae-1080-4209-9ebe-431a10e74ec3';

async function main() {
  const appPaths = resolveAppPaths(PACKAGE_NAME);
  const idGenerator = new UuidGenerator();
  const elementRepository = new FileElementRepository(logger, appPaths.elementRepository);
  const testCaseRepository = new FileTestCaseRepository(
    logger,
    resolveModuleTestCasesPath(appPaths, 'sign-up'),
  );

  const generator = new SignUpTestCaseGenerator(elementRepository, idGenerator, logger);

  const navigationGraph = {
    rootScreenId: HOME_SCREEN_ID,
    screenIds: [HOME_SCREEN_ID, SIGN_UP_FORM_SCREEN_ID],
    edges: [
      {
        fromScreenId: HOME_SCREEN_ID,
        toScreenId: SIGN_UP_FORM_SCREEN_ID,
        elementId: TOOLBAR_REGISTER_ELEMENT_ID,
      },
    ],
  };

  const result = await generator.generate({
    navigationGraph,
    appVersionName: '5.1.5',
    appVersionCode: '123',
  });

  if (result.isErr()) {
    console.error('Generation failed:', result.unwrapErr().message);
    process.exit(1);
  }

  const testCases = result.unwrap();
  console.log(`Generated ${testCases.length} test case(s).`);
  for (const testCase of testCases) {
    console.log('\n=== Test Case ===');
    console.log('id:', testCase.testCaseId);
    console.log('title:', testCase.title);
    console.log('description:', testCase.description);
    console.log('steps:', testCase.steps.length);
    for (const step of testCase.steps) {
      console.log(
        `  ${String(step.stepNumber).padStart(2, ' ')}. [${step.action}]`,
        step.targetLocator ? `${step.targetLocator.strategy}=${step.targetLocator.value}` : '',
        step.value ? `value="${step.value}"` : '',
        step.durationMs ? `durationMs=${step.durationMs}` : '',
        `— ${step.expectedResult}`,
      );
    }
    await testCaseRepository.add(testCase);
    console.log(`\nPersisted to sign-up test-case repository as ${testCase.testCaseId}.`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
