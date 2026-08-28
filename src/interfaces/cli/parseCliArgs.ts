import path from 'path';
import { TEST_MODULES, TestModule, isTestModule } from '../../shared/paths/TestModules';

export interface RunCliArgs {
  mode: 'run';
  apkPath: string;
  /** Use an already-running device/emulator. Mutually exclusive with avdName. */
  deviceId?: string;
  /** Boot this AVD first. Mutually exclusive with deviceId. */
  avdName?: string;
  bootTimeoutMs?: number;
  /** Caps how many distinct screens the crawler will explore before stopping. */
  maxScreens?: number;
  /** Caps how deep the crawler's DFS recursion will go. */
  maxDepth?: number;
  /** Both must be given to generate a login test case; omit either to skip it entirely. */
  loginMobileNumber?: string;
  loginPassword?: string;
  /** Crawl and generate as usual, but skip auto-executing the hamburger-menu suite at the end. */
  crawlOnly?: boolean;
}

export interface ExecuteCliArgs {
  mode: 'execute';
  packageName: string;
  /** Which module's stored suite to run — modules never run mixed together. */
  module: TestModule;
  /** Runs only these stored test cases instead of the whole module, in the order given — for
   * iterating on one test case without disturbing the rest of the suite, or for running a chosen
   * few back-to-back in one session. Repeat --test-case-id to add more. */
  testCaseIds?: string[];
  deviceId?: string;
  avdName?: string;
  bootTimeoutMs?: number;
}

/** Generates test cases from a manually-authored Excel sheet, using elements/screenshots already
 * captured by a prior crawl — no APK, no device, no crawl involved (generation is fully offline,
 * same as the other three generators). Run the result later with
 * `--execute-only --module manual`. */
export interface ImportCliArgs {
  mode: 'import';
  packageName: string;
  excelFilePath: string;
}

export interface ListAppsCliArgs {
  mode: 'list-apps';
}

export type CliArgs = RunCliArgs | ExecuteCliArgs | ImportCliArgs | ListAppsCliArgs;

export const USAGE = `Usage:
  npm start -- --apk <path-to-apk> (--device <serial> | --avd <avd-name>) [options]
  npm start -- --execute-only --package <name> --module <name> (--device <serial> | --avd <avd-name>) [options]
  npm start -- --import-test-cases --package <name> --excel-file <path>
  npm start -- --list-apps

Full run (crawl, generate, execute the hamburger-menu module, report):
  --apk <path>              Path to the .apk file to test
  --device <serial>         Use an already-running device/emulator (adb serial)
  --avd <name>              Boot this AVD first, then use it
  --boot-timeout-ms <ms>    Max time to wait for the device to finish booting
  --max-screens <n>         Cap how many distinct screens the crawler explores (default: 100)
  --max-depth <n>           Cap how deep the crawler's DFS recursion goes (default: 20)
  --login-mobile <number>   Mobile number to use for the login test case
  --login-password <pass>   Password to use for the login test case
                            (both required together — omit both to skip login test generation)
  --crawl-only              Skip auto-executing the hamburger-menu suite at the end of this run

Execute-only (no APK, no crawl — just re-runs one module of an app's already-generated suite):
  --execute-only          Switch to execute-only mode
  --package <name>        Package name of a previously-tested app (see --list-apps)
  --module <name>         Which module's stored suite to run: ${TEST_MODULES.join(' | ')}
                          (modules always run in isolation, never mixed together)
  --test-case-id <id>     Optional: run only this stored test case from the module
                          (id is the test case's JSON filename, without .json).
                          Repeatable — several run back-to-back in the order given,
                          sharing one session, with logout teardown between them.
  --device / --avd        Same as above
  --boot-timeout-ms <ms>  Same as above

Import (turns a manually-written Excel test-case sheet into real, executable test cases, using
elements/screenshots a prior crawl already captured — no APK, no device, no crawl):
  --import-test-cases     Switch to import mode
  --package <name>        Package name of a previously-crawled app
  --excel-file <path>     Path to the .xlsx sheet of manually-authored test cases
                          (run the result later with --execute-only --module manual)

  --list-apps             List package names that have a stored test suite

  -h, --help              Show this help message
`;

/** Returns null when help was requested; throws a descriptive Error for any invalid invocation. */
export function parseCliArgs(argv: string[]): CliArgs | null {
  let apkPath: string | undefined;
  let packageName: string | undefined;
  let moduleArg: string | undefined;
  let deviceId: string | undefined;
  let avdName: string | undefined;
  let bootTimeoutMs: number | undefined;
  let maxScreens: number | undefined;
  let maxDepth: number | undefined;
  let loginMobileNumber: string | undefined;
  let loginPassword: string | undefined;
  let excelFilePath: string | undefined;
  const testCaseIds: string[] = [];
  let executeOnly = false;
  let importTestCases = false;
  let listApps = false;
  let crawlOnly = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--apk':
        apkPath = requireValue(argv, i, arg);
        i += 1;
        break;
      case '--package':
        packageName = requireValue(argv, i, arg);
        i += 1;
        break;
      case '--module':
        moduleArg = requireValue(argv, i, arg);
        i += 1;
        break;
      case '--device':
        deviceId = requireValue(argv, i, arg);
        i += 1;
        break;
      case '--avd':
        avdName = requireValue(argv, i, arg);
        i += 1;
        break;
      case '--boot-timeout-ms':
        bootTimeoutMs = requirePositiveInt(argv, i, arg);
        i += 1;
        break;
      case '--max-screens':
        maxScreens = requirePositiveInt(argv, i, arg);
        i += 1;
        break;
      case '--max-depth':
        maxDepth = requirePositiveInt(argv, i, arg);
        i += 1;
        break;
      case '--login-mobile':
        loginMobileNumber = requireValue(argv, i, arg);
        i += 1;
        break;
      case '--login-password':
        loginPassword = requireValue(argv, i, arg);
        i += 1;
        break;
      case '--excel-file':
        excelFilePath = requireValue(argv, i, arg);
        i += 1;
        break;
      case '--test-case-id':
        testCaseIds.push(requireValue(argv, i, arg));
        i += 1;
        break;
      case '--execute-only':
        executeOnly = true;
        break;
      case '--import-test-cases':
        importTestCases = true;
        break;
      case '--crawl-only':
        crawlOnly = true;
        break;
      case '--list-apps':
        listApps = true;
        break;
      case '-h':
      case '--help':
        return null;
      default:
        throw new Error(`Unrecognized argument: "${arg}".\n\n${USAGE}`);
    }
  }

  if (listApps) {
    return { mode: 'list-apps' };
  }

  if (importTestCases) {
    if (!packageName) {
      throw new Error(`Missing required --package argument for --import-test-cases.\n\n${USAGE}`);
    }
    if (!excelFilePath) {
      throw new Error(
        `Missing required --excel-file argument for --import-test-cases.\n\n${USAGE}`,
      );
    }
    return { mode: 'import', packageName, excelFilePath: path.resolve(excelFilePath) };
  }

  if (!deviceId && !avdName) {
    throw new Error(`Either --device or --avd must be provided.\n\n${USAGE}`);
  }
  if (deviceId && avdName) {
    throw new Error(`Provide only one of --device or --avd, not both.\n\n${USAGE}`);
  }

  if (executeOnly) {
    if (!packageName) {
      throw new Error(`Missing required --package argument for --execute-only.\n\n${USAGE}`);
    }
    if (!moduleArg) {
      throw new Error(`Missing required --module argument for --execute-only.\n\n${USAGE}`);
    }
    if (!isTestModule(moduleArg)) {
      throw new Error(
        `Invalid --module value: "${moduleArg}". Must be one of: ${TEST_MODULES.join(', ')}.\n\n${USAGE}`,
      );
    }
    return {
      mode: 'execute',
      packageName,
      module: moduleArg,
      testCaseIds: testCaseIds.length > 0 ? testCaseIds : undefined,
      deviceId,
      avdName,
      bootTimeoutMs,
    };
  }

  if (!apkPath) {
    throw new Error(`Missing required --apk argument.\n\n${USAGE}`);
  }
  if ((loginMobileNumber && !loginPassword) || (!loginMobileNumber && loginPassword)) {
    throw new Error(`--login-mobile and --login-password must be provided together.\n\n${USAGE}`);
  }

  return {
    mode: 'run',
    apkPath: path.resolve(apkPath),
    deviceId,
    avdName,
    bootTimeoutMs,
    maxScreens,
    maxDepth,
    loginMobileNumber,
    loginPassword,
    crawlOnly,
  };
}

function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error(`Missing value for ${flag}.`);
  }
  return value;
}

function requirePositiveInt(argv: string[], index: number, flag: string): number {
  const raw = requireValue(argv, index, flag);
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${flag} value: "${raw}".`);
  }
  return value;
}
