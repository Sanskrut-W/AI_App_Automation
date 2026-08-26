import { AdbClient } from '../../../../src/infrastructure/android/AdbClient';
import { ICommandRunner } from '../../../../src/shared/process/ICommandRunner';
import { createMockLogger } from '../../support/createMockLogger';

function createMockRunner(): jest.Mocked<ICommandRunner> {
  return { run: jest.fn().mockResolvedValue({ stdout: '', stderr: '', exitCode: 0 }) };
}

describe('AdbClient', () => {
  it('run() prefixes args with "-s <deviceId>"', async () => {
    const runner = createMockRunner();
    const client = new AdbClient(runner, createMockLogger());

    await client.run('emulator-5554', ['shell', 'getprop', 'sys.boot_completed']);

    expect(runner.run).toHaveBeenCalledWith('adb', [
      '-s',
      'emulator-5554',
      'shell',
      'getprop',
      'sys.boot_completed',
    ]);
  });

  it('runGlobal() runs adb without a device prefix', async () => {
    const runner = createMockRunner();
    const client = new AdbClient(runner, createMockLogger());

    await client.runGlobal(['devices', '-l']);

    expect(runner.run).toHaveBeenCalledWith('adb', ['devices', '-l']);
  });

  it('uses a custom adb path when provided', async () => {
    const runner = createMockRunner();
    const client = new AdbClient(runner, createMockLogger(), '/opt/android-sdk/platform-tools/adb');

    await client.runGlobal(['devices']);

    expect(runner.run).toHaveBeenCalledWith('/opt/android-sdk/platform-tools/adb', ['devices']);
  });

  it('returns the underlying command result', async () => {
    const runner = createMockRunner();
    runner.run.mockResolvedValue({ stdout: 'ok', stderr: '', exitCode: 0 });
    const client = new AdbClient(runner, createMockLogger());

    const result = await client.run('emulator-5554', ['emu', 'kill']);

    expect(result).toEqual({ stdout: 'ok', stderr: '', exitCode: 0 });
  });
});
