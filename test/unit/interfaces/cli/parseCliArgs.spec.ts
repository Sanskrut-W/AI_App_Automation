import path from 'path';
import { parseCliArgs } from '../../../../src/interfaces/cli/parseCliArgs';

describe('parseCliArgs', () => {
  describe('run mode', () => {
    it('parses --apk with --device', () => {
      const args = parseCliArgs(['--apk', 'app.apk', '--device', 'emulator-5554']);

      expect(args).toEqual({
        mode: 'run',
        apkPath: path.resolve('app.apk'),
        deviceId: 'emulator-5554',
        avdName: undefined,
        bootTimeoutMs: undefined,
        maxScreens: undefined,
        maxDepth: undefined,
        loginMobileNumber: undefined,
        loginPassword: undefined,
        crawlOnly: false,
      });
    });

    it('parses --apk with --avd and --boot-timeout-ms', () => {
      const args = parseCliArgs([
        '--apk',
        '/apks/app.apk',
        '--avd',
        'Pixel_5_API_33',
        '--boot-timeout-ms',
        '90000',
      ]);

      expect(args).toEqual({
        mode: 'run',
        apkPath: path.resolve('/apks/app.apk'),
        deviceId: undefined,
        avdName: 'Pixel_5_API_33',
        bootTimeoutMs: 90000,
        maxScreens: undefined,
        maxDepth: undefined,
        loginMobileNumber: undefined,
        loginPassword: undefined,
        crawlOnly: false,
      });
    });

    it('parses --crawl-only', () => {
      const args = parseCliArgs(['--apk', 'app.apk', '--device', 'emulator-5554', '--crawl-only']);

      expect(args).toMatchObject({ mode: 'run', crawlOnly: true });
    });

    it('parses --login-mobile and --login-password together', () => {
      const args = parseCliArgs([
        '--apk',
        'app.apk',
        '--device',
        'emulator-5554',
        '--login-mobile',
        '0000000000',
        '--login-password',
        'fake-password',
      ]);

      expect(args).toMatchObject({
        mode: 'run',
        loginMobileNumber: '0000000000',
        loginPassword: 'fake-password',
      });
    });

    it('throws when only --login-mobile is given without --login-password', () => {
      expect(() =>
        parseCliArgs(['--apk', 'app.apk', '--device', 'x', '--login-mobile', '0000000000']),
      ).toThrow(/--login-mobile and --login-password must be provided together/);
    });

    it('throws when only --login-password is given without --login-mobile', () => {
      expect(() =>
        parseCliArgs(['--apk', 'app.apk', '--device', 'x', '--login-password', 'fake-password']),
      ).toThrow(/--login-mobile and --login-password must be provided together/);
    });

    it('throws when --apk is missing', () => {
      expect(() => parseCliArgs(['--device', 'emulator-5554'])).toThrow(/Missing required --apk/);
    });

    it('parses --max-screens and --max-depth', () => {
      const args = parseCliArgs([
        '--apk',
        'app.apk',
        '--device',
        'emulator-5554',
        '--max-screens',
        '8',
        '--max-depth',
        '5',
      ]);

      expect(args).toMatchObject({ mode: 'run', maxScreens: 8, maxDepth: 5 });
    });

    it('throws for an invalid --max-screens value', () => {
      expect(() =>
        parseCliArgs(['--apk', 'app.apk', '--device', 'x', '--max-screens', '0']),
      ).toThrow(/Invalid --max-screens value/);
      expect(() =>
        parseCliArgs(['--apk', 'app.apk', '--device', 'x', '--max-screens', 'nope']),
      ).toThrow(/Invalid --max-screens value/);
    });

    it('throws for an invalid --max-depth value', () => {
      expect(() =>
        parseCliArgs(['--apk', 'app.apk', '--device', 'x', '--max-depth', '-1']),
      ).toThrow(/Invalid --max-depth value/);
    });
  });

  describe('execute-only mode', () => {
    it('parses --execute-only with --package, --module, and --device', () => {
      const args = parseCliArgs([
        '--execute-only',
        '--package',
        'com.example.app',
        '--module',
        'hamburger-menu',
        '--device',
        'emulator-5554',
      ]);

      expect(args).toEqual({
        mode: 'execute',
        packageName: 'com.example.app',
        module: 'hamburger-menu',
        deviceId: 'emulator-5554',
        avdName: undefined,
        bootTimeoutMs: undefined,
      });
    });

    it('parses --test-case-id to scope execution to a single stored test case', () => {
      const args = parseCliArgs([
        '--execute-only',
        '--package',
        'com.example.app',
        '--module',
        'manual',
        '--test-case-id',
        '11d89f37-072f-4d99-904a-5e374b46cfe8',
        '--device',
        'emulator-5554',
      ]);

      expect(args).toMatchObject({
        mode: 'execute',
        testCaseIds: ['11d89f37-072f-4d99-904a-5e374b46cfe8'],
      });
    });

    it('collects repeated --test-case-id flags in the order given, to run several back-to-back', () => {
      const args = parseCliArgs([
        '--execute-only',
        '--package',
        'com.example.app',
        '--module',
        'manual',
        '--test-case-id',
        'first-case',
        '--test-case-id',
        'second-case',
        '--device',
        'emulator-5554',
      ]);

      expect(args).toMatchObject({
        mode: 'execute',
        testCaseIds: ['first-case', 'second-case'],
      });
    });

    it('leaves testCaseIds undefined when no --test-case-id is given, so the whole module runs', () => {
      const args = parseCliArgs([
        '--execute-only',
        '--package',
        'com.example.app',
        '--module',
        'manual',
        '--device',
        'emulator-5554',
      ]);

      expect(args).toMatchObject({ mode: 'execute' });
      expect((args as { testCaseIds?: string[] }).testCaseIds).toBeUndefined();
    });

    it('parses --module login', () => {
      const args = parseCliArgs([
        '--execute-only',
        '--package',
        'com.example.app',
        '--module',
        'login',
        '--device',
        'emulator-5554',
      ]);

      expect(args).toMatchObject({ mode: 'execute', module: 'login' });
    });

    it('throws when --execute-only is given without --package', () => {
      expect(() =>
        parseCliArgs(['--execute-only', '--module', 'login', '--device', 'emulator-5554']),
      ).toThrow(/Missing required --package argument for --execute-only/);
    });

    it('throws when --execute-only is given without --module', () => {
      expect(() =>
        parseCliArgs([
          '--execute-only',
          '--package',
          'com.example.app',
          '--device',
          'emulator-5554',
        ]),
      ).toThrow(/Missing required --module argument for --execute-only/);
    });

    it('throws for an invalid --module value', () => {
      expect(() =>
        parseCliArgs([
          '--execute-only',
          '--package',
          'com.example.app',
          '--module',
          'bogus-module',
          '--device',
          'emulator-5554',
        ]),
      ).toThrow(/Invalid --module value: "bogus-module"/);
    });
  });

  describe('import mode', () => {
    it('parses --import-test-cases with --package and --excel-file, without requiring a device', () => {
      const args = parseCliArgs([
        '--import-test-cases',
        '--package',
        'com.example.app',
        '--excel-file',
        'cases.xlsx',
      ]);

      expect(args).toEqual({
        mode: 'import',
        packageName: 'com.example.app',
        excelFilePath: path.resolve('cases.xlsx'),
      });
    });

    it('throws when --import-test-cases is given without --package', () => {
      expect(() => parseCliArgs(['--import-test-cases', '--excel-file', 'cases.xlsx'])).toThrow(
        /Missing required --package argument for --import-test-cases/,
      );
    });

    it('throws when --import-test-cases is given without --excel-file', () => {
      expect(() => parseCliArgs(['--import-test-cases', '--package', 'com.example.app'])).toThrow(
        /Missing required --excel-file argument for --import-test-cases/,
      );
    });
  });

  describe('list-apps mode', () => {
    it('parses --list-apps on its own, without requiring a device', () => {
      expect(parseCliArgs(['--list-apps'])).toEqual({ mode: 'list-apps' });
    });
  });

  it('returns null for --help', () => {
    expect(parseCliArgs(['--help'])).toBeNull();
    expect(parseCliArgs(['-h'])).toBeNull();
  });

  it('throws when neither --device nor --avd is given', () => {
    expect(() => parseCliArgs(['--apk', 'app.apk'])).toThrow(
      /Either --device or --avd must be provided/,
    );
  });

  it('throws when both --device and --avd are given', () => {
    expect(() =>
      parseCliArgs(['--apk', 'app.apk', '--device', 'emulator-5554', '--avd', 'Pixel_5']),
    ).toThrow(/only one of --device or --avd/);
  });

  it('throws when a flag is missing its value', () => {
    expect(() => parseCliArgs(['--apk'])).toThrow(/Missing value for --apk/);
    expect(() => parseCliArgs(['--apk', '--device', 'x'])).toThrow(/Missing value for --apk/);
  });

  it('throws for an invalid --boot-timeout-ms value', () => {
    expect(() =>
      parseCliArgs(['--apk', 'app.apk', '--device', 'x', '--boot-timeout-ms', 'not-a-number']),
    ).toThrow(/Invalid --boot-timeout-ms value/);
    expect(() =>
      parseCliArgs(['--apk', 'app.apk', '--device', 'x', '--boot-timeout-ms', '-5']),
    ).toThrow(/Invalid --boot-timeout-ms value/);
  });

  it('throws for an unrecognized argument', () => {
    expect(() => parseCliArgs(['--bogus', 'value'])).toThrow(/Unrecognized argument: "--bogus"/);
  });
});
