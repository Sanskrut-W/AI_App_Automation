import { ApplicationManager } from '../../../../../src/application/use-cases/app-management/ApplicationManager';
import { IApkValidator } from '../../../../../src/application/interfaces/apk/IApkValidator';
import { IApkMetadataReader } from '../../../../../src/application/interfaces/apk/IApkMetadataReader';
import { IAppDriver } from '../../../../../src/application/interfaces/drivers/IAppDriver';
import { Application } from '../../../../../src/core/entities/Application';
import { Platform } from '../../../../../src/core/enums/Platform';
import { ApkValidationError } from '../../../../../src/core/errors/ApkValidationError';
import { ApkMetadataError } from '../../../../../src/core/errors/ApkMetadataError';
import { Result } from '../../../../../src/shared/result/Result';
import { createMockLogger } from '../../../support/createMockLogger';

const APK_PATH = '/fake/path/app.apk';
const DEVICE_ID = 'emulator-5554';

const VALID_METADATA = {
  packageName: 'com.example.calculator',
  versionName: '1.0.0',
  versionCode: '1',
  appLabel: 'Calculator',
  launcherActivity: '.MainActivity',
};

function createManager() {
  const apkValidator: jest.Mocked<IApkValidator> = { validate: jest.fn() };
  const metadataReader: jest.Mocked<IApkMetadataReader> = { read: jest.fn() };
  const appDriver: jest.Mocked<IAppDriver> = {
    install: jest.fn(),
    uninstall: jest.fn(),
    launch: jest.fn(),
    terminate: jest.fn(),
    isInstalled: jest.fn(),
  };
  const logger = createMockLogger();
  const manager = new ApplicationManager(apkValidator, metadataReader, appDriver, logger);

  return { manager, apkValidator, metadataReader, appDriver, logger };
}

describe('ApplicationManager', () => {
  describe('validateApk', () => {
    it('delegates to the injected IApkValidator', async () => {
      const { manager, apkValidator } = createManager();
      apkValidator.validate.mockResolvedValue(Result.ok(undefined));

      const result = await manager.validateApk(APK_PATH);

      expect(apkValidator.validate).toHaveBeenCalledWith(APK_PATH);
      expect(result.isOk()).toBe(true);
    });
  });

  describe('readMetadata', () => {
    it('short-circuits with an ApkMetadataError when validation fails, without reading metadata', async () => {
      const { manager, apkValidator, metadataReader } = createManager();
      apkValidator.validate.mockResolvedValue(Result.err(new ApkValidationError('bad apk')));

      const result = await manager.readMetadata(APK_PATH);

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr()).toBeInstanceOf(ApkMetadataError);
      expect(metadataReader.read).not.toHaveBeenCalled();
    });

    it('builds an Application entity (Android platform) from the reader output', async () => {
      const { manager, apkValidator, metadataReader } = createManager();
      apkValidator.validate.mockResolvedValue(Result.ok(undefined));
      metadataReader.read.mockResolvedValue(Result.ok(VALID_METADATA));

      const result = await manager.readMetadata(APK_PATH);

      expect(result.isOk()).toBe(true);
      const application = result.unwrap();
      expect(application).toBeInstanceOf(Application);
      expect(application.packageName).toBe(VALID_METADATA.packageName);
      expect(application.platform).toBe(Platform.ANDROID);
      expect(application.apkPath).toBe(APK_PATH);
    });

    it('propagates the reader error when metadata parsing fails', async () => {
      const { manager, apkValidator, metadataReader } = createManager();
      apkValidator.validate.mockResolvedValue(Result.ok(undefined));
      const readerError = new ApkMetadataError('corrupt manifest');
      metadataReader.read.mockResolvedValue(Result.err(readerError));

      const result = await manager.readMetadata(APK_PATH);

      expect(result.unwrapErr()).toBe(readerError);
    });
  });

  describe('install', () => {
    it('reads metadata then installs via the app driver, returning the Application on success', async () => {
      const { manager, apkValidator, metadataReader, appDriver } = createManager();
      apkValidator.validate.mockResolvedValue(Result.ok(undefined));
      metadataReader.read.mockResolvedValue(Result.ok(VALID_METADATA));
      appDriver.install.mockResolvedValue(undefined);

      const result = await manager.install(DEVICE_ID, APK_PATH);

      expect(appDriver.install).toHaveBeenCalledWith(DEVICE_ID, APK_PATH);
      expect(result.isOk()).toBe(true);
      expect(result.unwrap().packageName).toBe(VALID_METADATA.packageName);
    });

    it('does not call the app driver when the APK is invalid', async () => {
      const { manager, apkValidator, appDriver } = createManager();
      apkValidator.validate.mockResolvedValue(Result.err(new ApkValidationError('bad apk')));

      const result = await manager.install(DEVICE_ID, APK_PATH);

      expect(appDriver.install).not.toHaveBeenCalled();
      expect(result.isErr()).toBe(true);
    });

    it('returns an AppInstallationError when the driver throws', async () => {
      const { manager, apkValidator, metadataReader, appDriver } = createManager();
      apkValidator.validate.mockResolvedValue(Result.ok(undefined));
      metadataReader.read.mockResolvedValue(Result.ok(VALID_METADATA));
      appDriver.install.mockRejectedValue(new Error('adb install failed'));

      const result = await manager.install(DEVICE_ID, APK_PATH);

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toMatch(/adb install failed/);
    });
  });

  describe('uninstall', () => {
    it('delegates to the app driver and returns Ok on success', async () => {
      const { manager, appDriver } = createManager();
      appDriver.uninstall.mockResolvedValue(undefined);

      const result = await manager.uninstall(DEVICE_ID, 'com.example.app');

      expect(appDriver.uninstall).toHaveBeenCalledWith(DEVICE_ID, 'com.example.app');
      expect(result.isOk()).toBe(true);
    });

    it('returns an AppUninstallError when the driver throws', async () => {
      const { manager, appDriver } = createManager();
      appDriver.uninstall.mockRejectedValue(new Error('package not found'));

      const result = await manager.uninstall(DEVICE_ID, 'com.example.app');

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toMatch(/package not found/);
    });
  });

  describe('launch', () => {
    const application = new Application({
      ...VALID_METADATA,
      apkPath: APK_PATH,
      platform: Platform.ANDROID,
    });

    it('launches using the application package name and launcher activity', async () => {
      const { manager, appDriver } = createManager();
      appDriver.launch.mockResolvedValue(undefined);

      const result = await manager.launch(DEVICE_ID, application);

      expect(appDriver.launch).toHaveBeenCalledWith(
        DEVICE_ID,
        application.packageName,
        application.launcherActivity,
      );
      expect(result.isOk()).toBe(true);
    });

    it('returns an AppLaunchError when the driver throws', async () => {
      const { manager, appDriver } = createManager();
      appDriver.launch.mockRejectedValue(new Error('activity not found'));

      const result = await manager.launch(DEVICE_ID, application);

      expect(result.isErr()).toBe(true);
      expect(result.unwrapErr().message).toMatch(/activity not found/);
    });
  });
});
