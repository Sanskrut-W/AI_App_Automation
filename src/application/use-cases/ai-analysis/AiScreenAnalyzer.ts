import { ScreenAnalysisRequest } from '../../dto/ScreenAnalysisRequest';
import { ScreenAnalysisResult } from '../../dto/ScreenAnalysisResult';
import { ScreenAnalysisError } from '../../../core/errors/ScreenAnalysisError';
import { Result } from '../../../shared/result/Result';
import { ILogger } from '../../../shared/logger/ILogger';
import { IFileReader } from '../../../shared/fs/IFileReader';
import { IGeminiClient } from '../../interfaces/ai/IGeminiClient';
import { IAiScreenAnalyzer } from '../../interfaces/ai/IAiScreenAnalyzer';
import { IScreenAnalysisPromptBuilder } from './IScreenAnalysisPromptBuilder';
import { isScreenAnalysisResult } from './isScreenAnalysisResult';

const SCREENSHOT_MIME_TYPE = 'image/png';

/** Sends a screen's screenshot + XML + metadata to Gemini and validates the structured analysis it returns. */
export class AiScreenAnalyzer implements IAiScreenAnalyzer {
  constructor(
    private readonly geminiClient: IGeminiClient,
    private readonly promptBuilder: IScreenAnalysisPromptBuilder,
    private readonly fileReader: IFileReader,
    private readonly logger: ILogger,
  ) {}

  async analyze(
    request: ScreenAnalysisRequest,
  ): Promise<Result<ScreenAnalysisResult, ScreenAnalysisError>> {
    this.logger.info('Analyzing screen with Gemini', {
      packageName: request.packageName,
      activityName: request.activityName,
    });

    try {
      const [xml, screenshot] = await Promise.all([
        this.fileReader.read(request.xmlPath),
        this.fileReader.readBinary(request.screenshotPath),
      ]);

      const prompt = this.promptBuilder.build({
        xml,
        packageName: request.packageName,
        activityName: request.activityName,
      });

      const geminiResult = await this.geminiClient.generateJson<unknown>({
        prompt,
        images: [{ mimeType: SCREENSHOT_MIME_TYPE, data: screenshot.toString('base64') }],
      });

      if (geminiResult.isErr()) {
        return Result.err(
          new ScreenAnalysisError(`Gemini analysis failed: ${geminiResult.unwrapErr().message}`),
        );
      }

      const raw = geminiResult.unwrap();
      if (!isScreenAnalysisResult(raw)) {
        this.logger.warn('Gemini returned a response that failed schema validation', {
          packageName: request.packageName,
        });
        return Result.err(
          new ScreenAnalysisError('Gemini response failed schema validation for screen analysis.'),
        );
      }

      this.logger.info('Screen analysis succeeded', { screenName: raw.screenName });
      return Result.ok(raw);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('Screen analysis failed', error);
      }
      const message = error instanceof Error ? error.message : String(error);
      return Result.err(new ScreenAnalysisError(`Screen analysis failed: ${message}`));
    }
  }
}
