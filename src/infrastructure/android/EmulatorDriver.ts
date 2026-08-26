import { Device } from '../../core/entities/Device';
import { DeviceState } from '../../core/enums/DeviceState';
import { IDeviceDriver } from '../../application/interfaces/drivers/IDeviceDriver';
import { ICommandRunner } from '../../shared/process/ICommandRunner';
import { IProcessLauncher } from '../../shared/process/IProcessLauncher';
import { ILogger } from '../../shared/logger/ILogger';
import { pollUntil } from '../../shared/utils/poll';
import { AdbClient } from './AdbClient';

const DEVICES_HEADER = /^list of devices attached/i;

/** IDeviceDriver implementation backed by the Android SDK "emulator" CLI plus adb. */
export class EmulatorDriver implements IDeviceDriver {
  constructor(
    private readonly adbClient: AdbClient,
    private readonly commandRunner: ICommandRunner,
    private readonly processLauncher: IProcessLauncher,
    private readonly logger: ILogger,
    private readonly emulatorPath: string = 'emulator',
    private readonly startArgs: string[] = [],
    private readonly startTimeoutMs: number = 60_000,
    private readonly pollIntervalMs: number = 1_000,
  ) {}

  async listDevices(): Promise<Device[]> {
    const result = await this.adbClient.runGlobal(['devices', '-l']);
    return this.parseDevicesOutput(result.stdout);
  }

  async startEmulator(avdName: string): Promise<Device> {
    const availableAvds = await this.listAvailableAvds();
    if (!availableAvds.includes(avdName)) {
      throw new Error(
        `AVD "${avdName}" was not found. Available AVDs: ${availableAvds.join(', ') || '(none)'}`,
      );
    }

    const before = new Set((await this.listDevices()).map((device) => device.deviceId));
    this.logger.info('Launching emulator process', { avdName, emulatorPath: this.emulatorPath });
    this.processLauncher.launchDetached(this.emulatorPath, ['-avd', avdName, ...this.startArgs]);

    const started = await pollUntil(
      async () => {
        const current = await this.listDevices();
        return current.find((device) => device.isEmulator && !before.has(device.deviceId)) ?? null;
      },
      { timeoutMs: this.startTimeoutMs, intervalMs: this.pollIntervalMs },
    );

    if (!started) {
      throw new Error(`Timed out waiting for emulator "${avdName}" to appear in "adb devices".`);
    }

    this.logger.info('Emulator is visible to adb', { avdName, deviceId: started.deviceId });
    return started;
  }

  async stopEmulator(deviceId: string): Promise<void> {
    const result = await this.adbClient.run(deviceId, ['emu', 'kill']);
    if (result.exitCode !== 0) {
      throw new Error(
        `Failed to stop emulator "${deviceId}": ${(result.stderr || result.stdout).trim()}`,
      );
    }
  }

  async getStatus(deviceId: string): Promise<DeviceState> {
    const devices = await this.listDevices();
    const device = devices.find((candidate) => candidate.deviceId === deviceId);
    if (!device) {
      return DeviceState.NOT_FOUND;
    }
    if (device.state !== DeviceState.DEVICE) {
      return device.state;
    }
    return (await this.isBootCompleted(deviceId)) ? DeviceState.ONLINE : DeviceState.BOOTING;
  }

  async waitForBootCompleted(deviceId: string, timeoutMs = 120_000): Promise<void> {
    const completed = await pollUntil(
      async () => ((await this.isBootCompleted(deviceId)) ? true : null),
      { timeoutMs, intervalMs: this.pollIntervalMs },
    );

    if (!completed) {
      throw new Error(
        `Timed out after ${timeoutMs}ms waiting for "${deviceId}" to finish booting.`,
      );
    }
  }

  private async isBootCompleted(deviceId: string): Promise<boolean> {
    const result = await this.adbClient.run(deviceId, ['shell', 'getprop', 'sys.boot_completed']);
    return result.exitCode === 0 && result.stdout.trim() === '1';
  }

  private async listAvailableAvds(): Promise<string[]> {
    const result = await this.commandRunner.run(this.emulatorPath, ['-list-avds']);
    if (result.exitCode !== 0) {
      throw new Error(
        `Failed to list available AVDs via "${this.emulatorPath} -list-avds" (exit ${result.exitCode}): ` +
          `${(result.stderr || result.stdout).trim()}`,
      );
    }
    return result.stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  private parseDevicesOutput(stdout: string): Device[] {
    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !DEVICES_HEADER.test(line))
      .map((line) => {
        const [deviceId, rawState] = line.split(/\s+/);
        return new Device({
          deviceId,
          isEmulator: deviceId.startsWith('emulator-'),
          state: this.mapRawState(rawState),
        });
      });
  }

  private mapRawState(rawState: string | undefined): DeviceState {
    switch (rawState) {
      case 'device':
        return DeviceState.DEVICE;
      case 'offline':
        return DeviceState.OFFLINE;
      case 'unauthorized':
        return DeviceState.UNAUTHORIZED;
      default:
        return DeviceState.UNKNOWN;
    }
  }
}
