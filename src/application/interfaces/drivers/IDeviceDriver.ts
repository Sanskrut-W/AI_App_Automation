import { Device } from '../../../core/entities/Device';
import { DeviceState } from '../../../core/enums/DeviceState';

export interface IDeviceDriver {
  listDevices(): Promise<Device[]>;
  startEmulator(avdName: string): Promise<Device>;
  stopEmulator(deviceId: string): Promise<void>;
  getStatus(deviceId: string): Promise<DeviceState>;
  waitForBootCompleted(deviceId: string, timeoutMs?: number): Promise<void>;
}
