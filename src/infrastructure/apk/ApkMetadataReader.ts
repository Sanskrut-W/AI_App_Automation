import AppInfoParser from 'app-info-parser';
import { IApkMetadataReader } from '../../application/interfaces/apk/IApkMetadataReader';
import { ApkMetadataDto } from '../../application/dto/ApkMetadataDto';
import { ApkMetadataError } from '../../core/errors/ApkMetadataError';
import { Result } from '../../shared/result/Result';
import { ILogger } from '../../shared/logger/ILogger';

/** Parses the compiled AndroidManifest.xml inside an APK via app-info-parser (pure JS, no Android SDK required). */
export class ApkMetadataReader implements IApkMetadataReader {
  constructor(private readonly logger: ILogger) {}

  async read(apkPath: string): Promise<Result<ApkMetadataDto, ApkMetadataError>> {
    try {
      const parser = new AppInfoParser(apkPath);
      const raw = await parser.parse();

      const packageName = raw.package;
      if (!packageName) {
        throw new Error('Parsed manifest did not contain a package name.');
      }

      const launcherActivities = raw.application?.launcherActivities ?? [];
      const launcherActivity = launcherActivities[0]?.name ?? null;

      const metadata: ApkMetadataDto = {
        packageName,
        versionName: raw.versionName != null ? String(raw.versionName) : 'unknown',
        versionCode: raw.versionCode != null ? String(raw.versionCode) : 'unknown',
        appLabel: raw.application?.label ?? packageName,
        launcherActivity,
      };

      this.logger.info('Parsed APK metadata', {
        apkPath,
        packageName: metadata.packageName,
        versionName: metadata.versionName,
      });
      return Result.ok(metadata);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn('Failed to parse APK metadata', { apkPath, reason: message });
      return Result.err(
        new ApkMetadataError(`Failed to parse APK metadata for "${apkPath}": ${message}`),
      );
    }
  }
}
