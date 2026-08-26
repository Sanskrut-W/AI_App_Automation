import { Device } from '../../../core/entities/Device';
import { DeviceState } from '../../../core/enums/DeviceState';
import { DeviceDetectionError } from '../../../core/errors/DeviceDetectionError';
import { EmulatorStartError } from '../../../core/errors/EmulatorStartError';
import { EmulatorStopError } from '../../../core/errors/EmulatorStopError';
import { DeviceStatusError } from '../../../core/errors/DeviceStatusError';
import { EmulatorBootTimeoutError } from '../../../core/errors/EmulatorBootTimeoutError';
import { Result } from '../../../shared/result/Result';

export interface IDeviceManager {
  detectEmulators(): Promise<Result<Device[], DeviceDetectionError>>;
  startEmulator(avdName: string): Promise<Result<Device, EmulatorStartError>>;
  stopEmulator(deviceId: string): Promise<Result<void, EmulatorStopError>>;
  checkStatus(deviceId: string): Promise<Result<DeviceState, DeviceStatusError>>;
  waitUntilBootCompleted(
    deviceId: string,
    timeoutMs?: number,
  ): Promise<Result<void, EmulatorBootTimeoutError>>;
}
