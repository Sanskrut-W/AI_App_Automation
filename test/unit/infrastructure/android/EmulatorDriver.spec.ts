import { EmulatorDriver } from '../../../../src/infrastructure/android/EmulatorDriver';
import { AdbClient } from '../../../../src/infrastructure/android/AdbClient';
import { DeviceState } from '../../../../src/core/enums/DeviceState';
import { CommandResult, ICommandRunner } from '../../../../src/shared/process/ICommandRunner';
import { IProcessLauncher } from '../../../../src/shared/process/IProcessLauncher';
import { createMockLogger } from '../../support/createMockLogger';

function commandResult(overrides: Partial<CommandResult> = {}): CommandResult {
  return { stdout: '', stderr: '', exitCode: 0, ...overrides };
}

function createMockAdbClient() {
  return {
    run: jest.fn(),
    runGlobal: jest.fn(),
  } as unknown as jest.Mocked<AdbClient>;
}

interface DriverOverrides {
  startArgs?: string[];
  startTimeoutMs?: number;
  pollIntervalMs?: number;
}

function createDriver(overrides: DriverOverrides = {}) {
  const adbClient = createMockAdbClient();
  const commandRunner: jest.Mocked<ICommandRunner> = { run: jest.fn() };
  const processLauncher: jest.Mocked<IProcessLauncher> = { launchDetached: jest.fn() };
  const logger = createMockLogger();
  const driver = new EmulatorDriver(
    adbClient,
    commandRunner,
    processLauncher,
    logger,
    'emulator',
    overrides.startArgs ?? [],
    overrides.startTimeoutMs ?? 60_000,
    overrides.pollIntervalMs ?? 1_000,
  );
  return { driver, adbClient, commandRunner, processLauncher, logger };
}

describe('EmulatorDriver', () => {
  describe('listDevices', () => {
    it('parses "adb devices -l" output into Device[]', async () => {
      const { driver, adbClient } = createDriver();
      adbClient.runGlobal.mockResolvedValue(
        commandResult({
          stdout:
            'List of devices attached\n' +
            'emulator-5554          device product:sdk_gphone64_x86_64\n' +
            'R58M12345              device usb:1-1\n' +
            '\n',
        }),
      );

      const devices = await driver.listDevices();

      expect(devices).toHaveLength(2);
      expect(devices[0]).toMatchObject({
        deviceId: 'emulator-5554',
        isEmulator: true,
        state: DeviceState.DEVICE,
      });
      expect(devices[1]).toMatchObject({
        deviceId: 'R58M12345',
        isEmulator: false,
        state: DeviceState.DEVICE,
      });
    });

    it('maps offline/unauthorized/unrecognized adb states correctly', async () => {
      const { driver, adbClient } = createDriver();
      adbClient.runGlobal.mockResolvedValue(
        commandResult({
          stdout:
            'List of devices attached\n' +
            'emulator-5556          offline\n' +
            'ABCD1234               unauthorized\n' +
            'XYZ9999                no permissions\n',
        }),
      );

      const devices = await driver.listDevices();

      expect(devices.map((d) => d.state)).toEqual([
        DeviceState.OFFLINE,
        DeviceState.UNAUTHORIZED,
        DeviceState.UNKNOWN,
      ]);
    });

    it('returns an empty array when no devices are connected', async () => {
      const { driver, adbClient } = createDriver();
      adbClient.runGlobal.mockResolvedValue(
        commandResult({ stdout: 'List of devices attached\n\n' }),
      );

      const devices = await driver.listDevices();

      expect(devices).toEqual([]);
    });
  });

  describe('startEmulator', () => {
    it('throws when the requested AVD is not in "emulator -list-avds"', async () => {
      const { driver, commandRunner } = createDriver();
      commandRunner.run.mockResolvedValue(commandResult({ stdout: 'Pixel_5_API_33\n' }));

      await expect(driver.startEmulator('Nonexistent_AVD')).rejects.toThrow(/was not found/);
    });

    it('throws a clear error when "emulator -list-avds" itself fails', async () => {
      const { driver, commandRunner } = createDriver();
      commandRunner.run.mockResolvedValue(
        commandResult({ exitCode: -1, stderr: 'command not found' }),
      );

      await expect(driver.startEmulator('Pixel_5_API_33')).rejects.toThrow(
        /Failed to list available AVDs/,
      );
    });

    it('spawns the emulator and resolves once a new emulator serial appears', async () => {
      const { driver, adbClient, commandRunner, processLauncher } = createDriver({
        startArgs: ['-no-window'],
        pollIntervalMs: 10,
      });
      commandRunner.run.mockResolvedValue(commandResult({ stdout: 'Pixel_5_API_33\n' }));
      adbClient.runGlobal
        .mockResolvedValueOnce(commandResult({ stdout: 'List of devices attached\n' })) // before-snapshot
        .mockResolvedValueOnce(commandResult({ stdout: 'List of devices attached\n' })) // still starting
        .mockResolvedValue(
          commandResult({ stdout: 'List of devices attached\nemulator-5554          device\n' }),
        );

      const device = await driver.startEmulator('Pixel_5_API_33');

      expect(processLauncher.launchDetached).toHaveBeenCalledWith('emulator', [
        '-avd',
        'Pixel_5_API_33',
        '-no-window',
      ]);
      expect(device.deviceId).toBe('emulator-5554');
    });

    it('throws when no new emulator appears before the timeout', async () => {
      const { driver, adbClient, commandRunner } = createDriver({
        startTimeoutMs: 30,
        pollIntervalMs: 10,
      });
      commandRunner.run.mockResolvedValue(commandResult({ stdout: 'Pixel_5_API_33\n' }));
      adbClient.runGlobal.mockResolvedValue(
        commandResult({ stdout: 'List of devices attached\n' }),
      );

      await expect(driver.startEmulator('Pixel_5_API_33')).rejects.toThrow(/Timed out/);
    });
  });

  describe('stopEmulator', () => {
    it('runs "adb -s <deviceId> emu kill"', async () => {
      const { driver, adbClient } = createDriver();
      adbClient.run.mockResolvedValue(commandResult());

      await driver.stopEmulator('emulator-5554');

      expect(adbClient.run).toHaveBeenCalledWith('emulator-5554', ['emu', 'kill']);
    });

    it('throws when the adb command fails', async () => {
      const { driver, adbClient } = createDriver();
      adbClient.run.mockResolvedValue(commandResult({ exitCode: 1, stderr: 'device not found' }));

      await expect(driver.stopEmulator('emulator-5554')).rejects.toThrow(/device not found/);
    });
  });

  describe('getStatus', () => {
    it('returns NOT_FOUND when the device is not in "adb devices"', async () => {
      const { driver, adbClient } = createDriver();
      adbClient.runGlobal.mockResolvedValue(
        commandResult({ stdout: 'List of devices attached\n' }),
      );

      await expect(driver.getStatus('emulator-5554')).resolves.toBe(DeviceState.NOT_FOUND);
    });

    it('returns OFFLINE without checking boot state', async () => {
      const { driver, adbClient } = createDriver();
      adbClient.runGlobal.mockResolvedValue(
        commandResult({ stdout: 'List of devices attached\nemulator-5554          offline\n' }),
      );

      await expect(driver.getStatus('emulator-5554')).resolves.toBe(DeviceState.OFFLINE);
      expect(adbClient.run).not.toHaveBeenCalled();
    });

    it('returns BOOTING when adb reports "device" but sys.boot_completed is not yet 1', async () => {
      const { driver, adbClient } = createDriver();
      adbClient.runGlobal.mockResolvedValue(
        commandResult({ stdout: 'List of devices attached\nemulator-5554          device\n' }),
      );
      adbClient.run.mockResolvedValue(commandResult({ stdout: '\n' }));

      await expect(driver.getStatus('emulator-5554')).resolves.toBe(DeviceState.BOOTING);
    });

    it('returns ONLINE when adb reports "device" and sys.boot_completed is 1', async () => {
      const { driver, adbClient } = createDriver();
      adbClient.runGlobal.mockResolvedValue(
        commandResult({ stdout: 'List of devices attached\nemulator-5554          device\n' }),
      );
      adbClient.run.mockResolvedValue(commandResult({ stdout: '1\n' }));

      await expect(driver.getStatus('emulator-5554')).resolves.toBe(DeviceState.ONLINE);
    });
  });

  describe('waitForBootCompleted', () => {
    it('resolves once sys.boot_completed reports 1', async () => {
      const { driver, adbClient } = createDriver({ pollIntervalMs: 5 });
      adbClient.run
        .mockResolvedValueOnce(commandResult({ stdout: '\n' }))
        .mockResolvedValueOnce(commandResult({ stdout: '1\n' }));

      await expect(driver.waitForBootCompleted('emulator-5554', 1000)).resolves.toBeUndefined();
    });

    it('throws when the timeout elapses before boot completes', async () => {
      const { driver, adbClient } = createDriver({ pollIntervalMs: 5 });
      adbClient.run.mockResolvedValue(commandResult({ stdout: '\n' }));

      await expect(driver.waitForBootCompleted('emulator-5554', 30)).rejects.toThrow(/Timed out/);
    });
  });
});
