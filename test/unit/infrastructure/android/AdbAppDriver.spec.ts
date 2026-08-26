import { AdbAppDriver } from '../../../../src/infrastructure/android/AdbAppDriver';
import { AdbCommandError } from '../../../../src/infrastructure/android/AdbCommandError';
import { ICommandRunner, CommandResult } from '../../../../src/shared/process/ICommandRunner';
import { createMockLogger } from '../../support/createMockLogger';

function createMockRunner(result: Partial<CommandResult> = {}): jest.Mocked<ICommandRunner> {
  return {
    run: jest.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0, ...result }),
  };
}

describe('AdbAppDriver', () => {
  const deviceId = 'emulator-5554';

  it('install() runs "adb -s <device> install -r <apk>"', async () => {
    const runner = createMockRunner();
    const driver = new AdbAppDriver(runner, createMockLogger());

    await driver.install(deviceId, '/path/to/app.apk');

    expect(runner.run).toHaveBeenCalledWith('adb', [
      '-s',
      deviceId,
      'install',
      '-r',
      '/path/to/app.apk',
    ]);
  });

  it('install() throws AdbCommandError when adb reports a Failure[...] even with exit code 0', async () => {
    const runner = createMockRunner({
      exitCode: 0,
      stdout: 'Failure [INSTALL_FAILED_ALREADY_EXISTS]',
    });
    const driver = new AdbAppDriver(runner, createMockLogger());

    await expect(driver.install(deviceId, '/path/to/app.apk')).rejects.toBeInstanceOf(
      AdbCommandError,
    );
  });

  it('uninstall() runs "adb -s <device> uninstall <package>" and throws on non-zero exit', async () => {
    const runner = createMockRunner({ exitCode: 1, stderr: 'no such package' });
    const driver = new AdbAppDriver(runner, createMockLogger());

    await expect(driver.uninstall(deviceId, 'com.example.app')).rejects.toBeInstanceOf(
      AdbCommandError,
    );
    expect(runner.run).toHaveBeenCalledWith('adb', [
      '-s',
      deviceId,
      'uninstall',
      'com.example.app',
    ]);
  });

  it('launch() with an activity runs "am start -n package/activity"', async () => {
    const runner = createMockRunner();
    const driver = new AdbAppDriver(runner, createMockLogger());

    await driver.launch(deviceId, 'com.example.app', '.MainActivity');

    expect(runner.run).toHaveBeenCalledWith('adb', [
      '-s',
      deviceId,
      'shell',
      'am',
      'start',
      '-n',
      'com.example.app/.MainActivity',
    ]);
  });

  it('launch() without an activity falls back to the monkey launcher trick', async () => {
    const runner = createMockRunner();
    const driver = new AdbAppDriver(runner, createMockLogger());

    await driver.launch(deviceId, 'com.example.app');

    expect(runner.run).toHaveBeenCalledWith('adb', [
      '-s',
      deviceId,
      'shell',
      'monkey',
      '-p',
      'com.example.app',
      '-c',
      'android.intent.category.LAUNCHER',
      '1',
    ]);
  });

  it('terminate() runs "am force-stop"', async () => {
    const runner = createMockRunner();
    const driver = new AdbAppDriver(runner, createMockLogger());

    await driver.terminate(deviceId, 'com.example.app');

    expect(runner.run).toHaveBeenCalledWith('adb', [
      '-s',
      deviceId,
      'shell',
      'am',
      'force-stop',
      'com.example.app',
    ]);
  });

  it('isInstalled() returns true only on an exact package match', async () => {
    const runner = createMockRunner({
      stdout: 'package:com.example.app.demo\npackage:com.example.app\n',
    });
    const driver = new AdbAppDriver(runner, createMockLogger());

    await expect(driver.isInstalled(deviceId, 'com.example.app')).resolves.toBe(true);
  });

  it('isInstalled() returns false when no exact match is present', async () => {
    const runner = createMockRunner({ stdout: 'package:com.example.app.demo\n' });
    const driver = new AdbAppDriver(runner, createMockLogger());

    await expect(driver.isInstalled(deviceId, 'com.example.app')).resolves.toBe(false);
  });

  it('isInstalled() throws AdbCommandError when adb itself fails', async () => {
    const runner = createMockRunner({ exitCode: 1, stderr: 'device offline' });
    const driver = new AdbAppDriver(runner, createMockLogger());

    await expect(driver.isInstalled(deviceId, 'com.example.app')).rejects.toBeInstanceOf(
      AdbCommandError,
    );
  });
});
