import fs from 'fs';
import path from 'path';
import { TEST_MODULES, TestModule } from './TestModules';

export interface AppPaths {
  root: string;
  screenshots: string;
  xmlDumps: string;
  screenRepository: string;
  elementRepository: string;
  /** Parent folder holding one subfolder per test module (see resolveModuleTestCasesPath) — never written to directly. */
  testCasesRoot: string;
  navigationGraph: string;
  executionScreenshots: string;
  executionLogs: string;
  reports: string;
}

const DEFAULT_APPS_ROOT = path.resolve(process.cwd(), 'artifacts', 'apps');

/** Package names are dot-separated identifiers and safe as directory names as-is; this only guards against the rare pathological one (path separators, leading dots, etc.) since the name ultimately comes from a third-party APK's manifest. */
function sanitizePackageName(packageName: string): string {
  const sanitized = packageName.replace(/[^A-Za-z0-9._-]/g, '_');
  return sanitized.length > 0 ? sanitized : 'unknown-package';
}

/** Every artifact for a given app lives under its own artifacts/apps/<packageName>/ folder — screens, elements, and test cases from different apps are never mixed together, and re-running the same app reuses the same folder. */
export function resolveAppPaths(
  packageName: string,
  appsRoot: string = DEFAULT_APPS_ROOT,
): AppPaths {
  const root = path.join(appsRoot, sanitizePackageName(packageName));

  return {
    root,
    screenshots: path.join(root, 'screenshots'),
    xmlDumps: path.join(root, 'xml-dumps'),
    screenRepository: path.join(root, 'screen-repository'),
    elementRepository: path.join(root, 'element-repository'),
    testCasesRoot: path.join(root, 'test-cases'),
    navigationGraph: path.join(root, 'navigation-graph.json'),
    executionScreenshots: path.join(root, 'execution-screenshots'),
    executionLogs: path.join(root, 'execution-logs'),
    reports: path.join(root, 'reports'),
  };
}

/** Where a specific module's test cases live — artifacts/apps/<packageName>/test-cases/<module>/. Physically isolated per module so e.g. logging in for real during the "login" module's execution never contaminates the "hamburger-menu" module's stored suite or its assumptions about screen state. */
export function resolveModuleTestCasesPath(appPaths: AppPaths, module: TestModule): string {
  return path.join(appPaths.testCasesRoot, module);
}

/** Lists package names that have an existing artifacts/apps/<packageName>/ folder, for CLI app-selection. */
export function listKnownPackageNames(appsRoot: string = DEFAULT_APPS_ROOT): string[] {
  // Uses fs directly rather than IFileReader/IFileWriter — those ports model single-file
  // read/write, not directory listing, and this is a pure filesystem-layout query.
  if (!fs.existsSync(appsRoot)) {
    return [];
  }
  return fs
    .readdirSync(appsRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

/** Lists which of an app's test modules actually have a stored suite (a non-empty test-cases/<module>/ folder). */
export function listKnownModules(appPaths: AppPaths): TestModule[] {
  if (!fs.existsSync(appPaths.testCasesRoot)) {
    return [];
  }
  return fs
    .readdirSync(appPaths.testCasesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name): name is TestModule => (TEST_MODULES as readonly string[]).includes(name))
    .sort();
}
