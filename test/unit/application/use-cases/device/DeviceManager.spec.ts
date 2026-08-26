import { DeviceManager } from '../../../../../src/application/use-cases/device/DeviceManager';
import { IDeviceDriver } from '../../../../../src/application/interfaces/drivers/IDeviceDriver';
import { Device } from '../../../../../src/core/entities/Device';
import { DeviceState } from '../../../../../src/core/enums/DeviceState';
import { createMockLogger } from '../../../support/createMockLogger';

function createManager() {
  const deviceDriver: jest.Mocked<IDeviceDriver> = {
    listDevices: jest.fn(),
    startEmulator: jest.fn(),
    stopEmulator: jest.fn(),
    getStatus: jest.fn(),
    waitForBootCompleted: jest.fn(),
  };
  const logger = createMockLogger();
  const manager = new DeviceManager(deviceDriver, logger);

  return { manager, deviceDriver, logger };
}

describe('DeviceManager', () => {
  describe('detectEmulators', () => {
    it('returns only emulator devices from the driver output', async () => {
      const { manager, deviceDriver } = createManager();
      const emulator = new Device({
        deviceId: 'emulator-5554',
        isEmulator: true,
        state: DeviceState.DEVICE,
      });
      const physical = new Device({
        deviceId: 'R58M12345',
        isEmulator: false,
        state: DeviceState.DEVICE,
      });
      deviceDriver.listDevices.mockResolvedValue([emulator, physical]);

      const result = await manager.detectEmulators();

      expect(result.isOk()).toBe(true);
      expect(result.unwrap()).toEqual([emulator]);
    });

    it('returns a DeviceDetectionError when the driver throws', async () => {
      const { manager, deviceDriver } = createManager();
      deviceDriver.listDevices.mockRejectedValue(new Error('adb not found'));

      const result = await manager.detectEmulators();

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toMatch(/adb not found/);
    });
  });

  describe('startEmulator', () => {
    it('delegates to the driver and returns the started Device', async () => {
      const { manager, deviceDriver } = createManager();
      const device = new Device({
        deviceId: 'emulator-5554',
        isEmulator: true,
        state: DeviceState.DEVICE,
      });
      deviceDriver.startEmulator.mockResolvedValue(device);

      const result = await manager.startEmulator('Pixel_5_API_33');

      expect(deviceDriver.startEmulator).toHaveBeenCalledWith('Pixel_5_API_33');
      expect(result.unwrap()).toBe(device);
    });

    it('returns an EmulatorStartError when the driver throws', async () => {
      const { manager, deviceDriver } = createManager();
      deviceDriver.startEmulator.mockRejectedValue(new Error('AVD not found'));

      const result = await manager.startEmulator('Bogus_AVD');

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toMatch(/AVD not found/);
    });
  });

  describe('stopEmulator', () => {
    it('delegates to the driver', async () => {
      const { manager, deviceDriver } = createManager();
      deviceDriver.stopEmulator.mockResolvedValue(undefined);

      const result = await manager.stopEmulator('emulator-5554');

      expect(deviceDriver.stopEmulator).toHaveBeenCalledWith('emulator-5554');
      expect(result.isOk()).toBe(true);
    });

    it('returns an EmulatorStopError when the driver throws', async () => {
      const { manager, deviceDriver } = createManager();
      deviceDriver.stopEmulator.mockRejectedValue(new Error('not running'));

      const result = await manager.stopEmulator('emulator-5554');

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toMatch(/not running/);
    });
  });

  describe('checkStatus', () => {
    it('delegates to the driver', async () => {
      const { manager, deviceDriver } = createManager();
      deviceDriver.getStatus.mockResolvedValue(DeviceState.ONLINE);

      const result = await manager.checkStatus('emulator-5554');

      expect(result.unwrap()).toBe(DeviceState.ONLINE);
    });

    it('returns a DeviceStatusError when the driver throws', async () => {
      const { manager, deviceDriver } = createManager();
      deviceDriver.getStatus.mockRejectedValue(new Error('adb server not running'));

      const result = await manager.checkStatus('emulator-5554');

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toMatch(/adb server not running/);
    });
  });

  describe('waitUntilBootCompleted', () => {
    it('delegates to the driver, forwarding an explicit timeout', async () => {
      const { manager, deviceDriver } = createManager();
      deviceDriver.waitForBootCompleted.mockResolvedValue(undefined);

      const result = await manager.waitUntilBootCompleted('emulator-5554', 5000);

      expect(deviceDriver.waitForBootCompleted).toHaveBeenCalledWith('emulator-5554', 5000);
      expect(result.isOk()).toBe(true);
    });

    it('returns an EmulatorBootTimeoutError when the driver throws', async () => {
      const { manager, deviceDriver } = createManager();
      deviceDriver.waitForBootCompleted.mockRejectedValue(new Error('timed out'));

      const result = await manager.waitUntilBootCompleted('emulator-5554');

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toMatch(/timed out/);
    });
  });
});
