import { Application } from '../../../core/entities/Application';
import { ApkValidationError } from '../../../core/errors/ApkValidationError';
import { ApkMetadataError } from '../../../core/errors/ApkMetadataError';
import { AppInstallationError } from '../../../core/errors/AppInstallationError';
import { AppUninstallError } from '../../../core/errors/AppUninstallError';
import { AppLaunchError } from '../../../core/errors/AppLaunchError';
import { Result } from '../../../shared/result/Result';

export interface IApplicationManager {
  validateApk(apkPath: string): Promise<Result<void, ApkValidationError>>;
  readMetadata(apkPath: string): Promise<Result<Application, ApkMetadataError>>;
  install(deviceId: string, apkPath: string): Promise<Result<Application, AppInstallationError>>;
  uninstall(deviceId: string, packageName: string): Promise<Result<void, AppUninstallError>>;
  launch(deviceId: string, application: Application): Promise<Result<void, AppLaunchError>>;
}
