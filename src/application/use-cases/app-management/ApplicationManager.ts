import { Platform } from '../../../core/enums/Platform';
import { Application } from '../../../core/entities/Application';
import { ApkValidationError } from '../../../core/errors/ApkValidationError';
import { ApkMetadataError } from '../../../core/errors/ApkMetadataError';
import { AppInstallationError } from '../../../core/errors/AppInstallationError';
import { AppUninstallError } from '../../../core/errors/AppUninstallError';
import { AppLaunchError } from '../../../core/errors/AppLaunchError';
import { Result } from '../../../shared/result/Result';
import { ILogger } from '../../../shared/logger/ILogger';
import { IApkValidator } from '../../interfaces/apk/IApkValidator';
import { IApkMetadataReader } from '../../interfaces/apk/IApkMetadataReader';
import { IAppDriver } from '../../interfaces/drivers/IAppDriver';
import { IApplicationManager } from './IApplicationManager';

/** Orchestrates APK validation, metadata extraction, and install/uninstall/launch over injected ports. */
export class ApplicationManager implements IApplicationManager {
  constructor(
    private readonly apkValidator: IApkValidator,
    private readonly metadataReader: IApkMetadataReader,
    private readonly appDriver: IAppDriver,
    private readonly logger: ILogger,
  ) {}

  async validateApk(apkPath: string): Promise<Result<void, ApkValidationError>> {
    this.logger.debug('Validating APK', { apkPath });
    return this.apkValidator.validate(apkPath);
  }

  async readMetadata(apkPath: string): Promise<Result<Application, ApkMetadataError>> {
    const validation = await this.apkValidator.validate(apkPath);
    if (validation.isErr()) {
      return Result.err(
        new ApkMetadataError(`Cannot read metadata: ${validation.unwrapErr().message}`),
      );
    }

    this.logger.debug('Reading APK metadata', { apkPath });
    const metadataResult = await this.metadataReader.read(apkPath);
    if (metadataResult.isErr()) {
      return Result.err(metadataResult.unwrapErr());
    }

    const metadata = metadataResult.unwrap();
    const application = new Application({
      ...metadata,
      apkPath,
      platform: Platform.ANDROID,
    });

    this.logger.info('APK metadata extracted', {
      packageName: application.packageName,
      versionName: application.versionName,
    });
    return Result.ok(application);
  }

  async install(
    deviceId: string,
    apkPath: string,
  ): Promise<Result<Application, AppInstallationError>> {
    const metadataResult = await this.readMetadata(apkPath);
    if (metadataResult.isErr()) {
      return Result.err(new AppInstallationError(metadataResult.unwrapErr().message));
    }
    const application = metadataResult.unwrap();

    this.logger.info('Installing application', { deviceId, packageName: application.packageName });
    try {
      await this.appDriver.install(deviceId, apkPath);
    } catch (error) {
      return Result.err(
        new AppInstallationError(
          `Failed to install ${application.packageName} on ${deviceId}: ${this.describe(error)}`,
        ),
      );
    }

    this.logger.info('Application installed successfully', {
      deviceId,
      packageName: application.packageName,
    });
    return Result.ok(application);
  }

  async uninstall(deviceId: string, packageName: string): Promise<Result<void, AppUninstallError>> {
    this.logger.info('Uninstalling application', { deviceId, packageName });
    try {
      await this.appDriver.uninstall(deviceId, packageName);
    } catch (error) {
      return Result.err(
        new AppUninstallError(
          `Failed to uninstall ${packageName} from ${deviceId}: ${this.describe(error)}`,
        ),
      );
    }

    this.logger.info('Application uninstalled successfully', { deviceId, packageName });
    return Result.ok(undefined);
  }

  async launch(deviceId: string, application: Application): Promise<Result<void, AppLaunchError>> {
    this.logger.info('Launching application', {
      deviceId,
      packageName: application.packageName,
      activity: application.launcherActivity,
    });
    try {
      await this.appDriver.launch(deviceId, application.packageName, application.launcherActivity);
    } catch (error) {
      return Result.err(
        new AppLaunchError(
          `Failed to launch ${application.packageName} on ${deviceId}: ${this.describe(error)}`,
        ),
      );
    }

    this.logger.info('Application launched successfully', {
      deviceId,
      packageName: application.packageName,
    });
    return Result.ok(undefined);
  }

  private describe(error: unknown): string {
    if (error instanceof Error) {
      this.logger.error('Underlying driver error', error);
      return error.message;
    }
    return String(error);
  }
}
