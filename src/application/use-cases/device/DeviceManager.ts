import { Device } from '../../../core/entities/Device';
import { DeviceState } from '../../../core/enums/DeviceState';
import { DeviceDetectionError } from '../../../core/errors/DeviceDetectionError';
import { EmulatorStartError } from '../../../core/errors/EmulatorStartError';
import { EmulatorStopError } from '../../../core/errors/EmulatorStopError';
import { DeviceStatusError } from '../../../core/errors/DeviceStatusError';
import { EmulatorBootTimeoutError } from '../../../core/errors/EmulatorBootTimeoutError';
import { Result } from '../../../shared/result/Result';
import { ILogger } from '../../../shared/logger/ILogger';
import { IDeviceDriver } from '../../interfaces/drivers/IDeviceDriver';
import { IDeviceManager } from './IDeviceManager';

/** Orchestrates emulator detection, lifecycle (start/stop), status checks, and boot-wait over an injected IDeviceDriver. */
export class DeviceManager implements IDeviceManager {
  constructor(
    private readonly deviceDriver: IDeviceDriver,
    private readonly logger: ILogger,
  ) {}

  async detectEmulators(): Promise<Result<Device[], DeviceDetectionError>> {
    this.logger.debug('Detecting connected emulators');
    try {
      const devices = await this.deviceDriver.listDevices();
      const emulators = devices.filter((device) => device.isEmulator);
      this.logger.info('Emulator detection complete', { count: emulators.length });
      return Result.ok(emulators);
    } catch (error) {
      return Result.err(
        new DeviceDetectionError(`Failed to detect emulators: ${this.describe(error)}`),
      );
    }
  }

  async startEmulator(avdName: string): Promise<Result<Device, EmulatorStartError>> {
    this.logger.info('Starting emulator', { avdName });
    try {
      const device = await this.deviceDriver.startEmulator(avdName);
      this.logger.info('Emulator started', { avdName, deviceId: device.deviceId });
      return Result.ok(device);
    } catch (error) {
      return Result.err(
        new EmulatorStartError(`Failed to start emulator "${avdName}": ${this.describe(error)}`),
      );
    }
  }

  async stopEmulator(deviceId: string): Promise<Result<void, EmulatorStopError>> {
    this.logger.info('Stopping emulator', { deviceId });
    try {
      await this.deviceDriver.stopEmulator(deviceId);
      this.logger.info('Emulator stopped', { deviceId });
      return Result.ok(undefined);
    } catch (error) {
      return Result.err(
        new EmulatorStopError(`Failed to stop emulator "${deviceId}": ${this.describe(error)}`),
      );
    }
  }

  async checkStatus(deviceId: string): Promise<Result<DeviceState, DeviceStatusError>> {
    this.logger.debug('Checking device status', { deviceId });
    try {
      const state = await this.deviceDriver.getStatus(deviceId);
      return Result.ok(state);
    } catch (error) {
      return Result.err(
        new DeviceStatusError(`Failed to check status of "${deviceId}": ${this.describe(error)}`),
      );
    }
  }

  async waitUntilBootCompleted(
    deviceId: string,
    timeoutMs?: number,
  ): Promise<Result<void, EmulatorBootTimeoutError>> {
    this.logger.info('Waiting for device to finish booting', { deviceId, timeoutMs });
    try {
      await this.deviceDriver.waitForBootCompleted(deviceId, timeoutMs);
      this.logger.info('Device finished booting', { deviceId });
      return Result.ok(undefined);
    } catch (error) {
      return Result.err(
        new EmulatorBootTimeoutError(
          `"${deviceId}" did not finish booting: ${this.describe(error)}`,
        ),
      );
    }
  }

  private describe(error: unknown): string {
    if (error instanceof Error) {
      this.logger.error('Underlying device driver error', error);
      return error.message;
    }
    return String(error);
  }
}
