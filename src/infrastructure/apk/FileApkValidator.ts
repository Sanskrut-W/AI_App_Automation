import { promises as fsp } from 'fs';
import path from 'path';
import { IApkValidator } from '../../application/interfaces/apk/IApkValidator';
import { ApkValidationError } from '../../core/errors/ApkValidationError';
import { Result } from '../../shared/result/Result';
import { ILogger } from '../../shared/logger/ILogger';

const ZIP_MAGIC_BYTES = Buffer.from([0x50, 0x4b, 0x03, 0x04]); // "PK\x03\x04" — APKs are ZIP archives

/** Shallow, fast validation (extension, existence, ZIP magic bytes) — not a full archive-integrity check. */
export class FileApkValidator implements IApkValidator {
  constructor(private readonly logger: ILogger) {}

  async validate(apkPath: string): Promise<Result<void, ApkValidationError>> {
    if (path.extname(apkPath).toLowerCase() !== '.apk') {
      return this.fail(apkPath, `File does not have an .apk extension: ${apkPath}`);
    }

    let stats;
    try {
      stats = await fsp.stat(apkPath);
    } catch {
      return this.fail(apkPath, `APK file does not exist: ${apkPath}`);
    }

    if (!stats.isFile() || stats.size === 0) {
      return this.fail(apkPath, `APK file is empty or not a regular file: ${apkPath}`);
    }

    const magicBytes = await this.readMagicBytes(apkPath, ZIP_MAGIC_BYTES.length);
    if (!magicBytes.equals(ZIP_MAGIC_BYTES)) {
      return this.fail(apkPath, `File is not a valid ZIP/APK archive: ${apkPath}`);
    }

    this.logger.debug('APK passed validation', { apkPath });
    return Result.ok(undefined);
  }

  private fail(apkPath: string, message: string): Result<void, ApkValidationError> {
    this.logger.warn(message, { apkPath });
    return Result.err(new ApkValidationError(message));
  }

  private async readMagicBytes(apkPath: string, length: number): Promise<Buffer> {
    const handle = await fsp.open(apkPath, 'r');
    try {
      const buffer = Buffer.alloc(length);
      await handle.read(buffer, 0, length, 0);
      return buffer;
    } finally {
      await handle.close();
    }
  }
}
