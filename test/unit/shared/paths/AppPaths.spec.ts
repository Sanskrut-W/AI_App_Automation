import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  resolveAppPaths,
  resolveModuleTestCasesPath,
  listKnownPackageNames,
  listKnownModules,
} from '../../../../src/shared/paths/AppPaths';

describe('resolveAppPaths', () => {
  it('nests every artifact path under artifacts/apps/<packageName>/', () => {
    const paths = resolveAppPaths('com.betwayafrica.za', '/artifacts/apps');

    const root = path.join('/artifacts/apps', 'com.betwayafrica.za');
    expect(paths.root).toBe(root);
    expect(paths.screenshots).toBe(path.join(root, 'screenshots'));
    expect(paths.xmlDumps).toBe(path.join(root, 'xml-dumps'));
    expect(paths.screenRepository).toBe(path.join(root, 'screen-repository'));
    expect(paths.elementRepository).toBe(path.join(root, 'element-repository'));
    expect(paths.testCasesRoot).toBe(path.join(root, 'test-cases'));
    expect(paths.navigationGraph).toBe(path.join(root, 'navigation-graph.json'));
    expect(paths.executionScreenshots).toBe(path.join(root, 'execution-screenshots'));
    expect(paths.executionLogs).toBe(path.join(root, 'execution-logs'));
    expect(paths.reports).toBe(path.join(root, 'reports'));
  });

  it('gives two different packages two entirely separate roots', () => {
    const a = resolveAppPaths('com.example.appone', '/artifacts/apps');
    const b = resolveAppPaths('com.example.apptwo', '/artifacts/apps');

    expect(a.root).not.toBe(b.root);
  });

  it('sanitizes characters that are unsafe as a directory name', () => {
    const paths = resolveAppPaths('com.example/../evil', '/artifacts/apps');

    expect(paths.root).toBe(path.join('/artifacts/apps', 'com.example_.._evil'));
  });

  it('falls back to a placeholder name for an empty package name', () => {
    const paths = resolveAppPaths('', '/artifacts/apps');

    expect(paths.root).toBe(path.join('/artifacts/apps', 'unknown-package'));
  });
});

describe('listKnownPackageNames', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-paths-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns an empty array when the apps root does not exist', () => {
    expect(listKnownPackageNames(path.join(tempDir, 'does-not-exist'))).toEqual([]);
  });

  it('lists only directories, sorted, ignoring stray files', () => {
    fs.mkdirSync(path.join(tempDir, 'com.example.b'));
    fs.mkdirSync(path.join(tempDir, 'com.example.a'));
    fs.writeFileSync(path.join(tempDir, 'not-a-package.txt'), 'x');

    expect(listKnownPackageNames(tempDir)).toEqual(['com.example.a', 'com.example.b']);
  });
});

describe('resolveModuleTestCasesPath', () => {
  it("nests a module's test cases under testCasesRoot/<module>/", () => {
    const paths = resolveAppPaths('com.betwayafrica.za', '/artifacts/apps');

    expect(resolveModuleTestCasesPath(paths, 'hamburger-menu')).toBe(
      path.join(paths.testCasesRoot, 'hamburger-menu'),
    );
    expect(resolveModuleTestCasesPath(paths, 'login')).toBe(
      path.join(paths.testCasesRoot, 'login'),
    );
  });
});

describe('listKnownModules', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'app-paths-modules-test-'));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns an empty array when the test-cases root does not exist', () => {
    const paths = resolveAppPaths('com.example.app', tempDir);

    expect(listKnownModules(paths)).toEqual([]);
  });

  it('lists only known, existing module subfolders, sorted', () => {
    const paths = resolveAppPaths('com.example.app', tempDir);
    fs.mkdirSync(path.join(paths.testCasesRoot, 'login'), { recursive: true });
    fs.mkdirSync(path.join(paths.testCasesRoot, 'hamburger-menu'), { recursive: true });
    fs.mkdirSync(path.join(paths.testCasesRoot, 'not-a-real-module'), { recursive: true });

    expect(listKnownModules(paths)).toEqual(['hamburger-menu', 'login']);
  });
});
