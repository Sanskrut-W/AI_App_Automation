import { Result } from '../../../shared/result/Result';
import { ApkValidationError } from '../../../core/errors/ApkValidationError';

export interface IApkValidator {
  validate(apkPath: string): Promise<Result<void, ApkValidationError>>;
}
