import { ScreenCaptureResult } from '../../dto/ScreenCaptureResult';
import { ScreenCaptureServiceError } from '../../../core/errors/ScreenCaptureServiceError';
import { Result } from '../../../shared/result/Result';

export interface IScreenCaptureService {
  captureScreen(): Promise<Result<ScreenCaptureResult, ScreenCaptureServiceError>>;
}
