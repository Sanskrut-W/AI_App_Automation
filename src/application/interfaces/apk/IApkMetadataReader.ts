import { Result } from '../../../shared/result/Result';
import { ApkMetadataError } from '../../../core/errors/ApkMetadataError';
import { ApkMetadataDto } from '../../dto/ApkMetadataDto';

export interface IApkMetadataReader {
  read(apkPath: string): Promise<Result<ApkMetadataDto, ApkMetadataError>>;
}
