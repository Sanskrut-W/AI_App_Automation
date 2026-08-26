import { ScreenAnalysisRequest } from '../../dto/ScreenAnalysisRequest';
import { ScreenAnalysisResult } from '../../dto/ScreenAnalysisResult';
import { ScreenAnalysisError } from '../../../core/errors/ScreenAnalysisError';
import { Result } from '../../../shared/result/Result';

export interface IAiScreenAnalyzer {
  analyze(
    request: ScreenAnalysisRequest,
  ): Promise<Result<ScreenAnalysisResult, ScreenAnalysisError>>;
}
