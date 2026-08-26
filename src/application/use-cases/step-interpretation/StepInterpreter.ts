import { StepInterpretationRequest } from '../../dto/StepInterpretationRequest';
import { StepInterpretationResult } from '../../dto/StepInterpretationResult';
import { StepInterpretationError } from '../../../core/errors/StepInterpretationError';
import { Result } from '../../../shared/result/Result';
import { ILogger } from '../../../shared/logger/ILogger';
import { IFileReader } from '../../../shared/fs/IFileReader';
import { IGeminiClient } from '../../interfaces/ai/IGeminiClient';
import { IStepInterpreter } from '../../interfaces/ai/IStepInterpreter';
import { IStepInterpretationPromptBuilder } from './IStepInterpretationPromptBuilder';
import { isStepInterpretationResult } from './isStepInterpretationResult';

const SCREENSHOT_MIME_TYPE = 'image/png';

/**
 * Sends a manually-written test step + the current screen's candidate elements + a screenshot to
 * Gemini and validates the structured interpretation it returns. Mirrors AiScreenAnalyzer's shape
 * exactly, but is a HARD dependency for ManualTestCaseGenerator rather than an optional
 * enhancement: free-text steps cannot be interpreted at all without it.
 */
export class StepInterpreter implements IStepInterpreter {
  constructor(
    private readonly geminiClient: IGeminiClient,
    private readonly promptBuilder: IStepInterpretationPromptBuilder,
    private readonly fileReader: IFileReader,
    private readonly logger: ILogger,
  ) {}

  async interpret(
    request: StepInterpretationRequest,
  ): Promise<Result<StepInterpretationResult, StepInterpretationError>> {
    this.logger.info('Interpreting manual test step with Gemini', {
      stepDescription: request.stepDescription,
      candidateCount: request.candidateElements.length,
    });

    try {
      const screenshot = await this.fileReader.readBinary(request.screenshotPath);

      const prompt = this.promptBuilder.build({
        stepDescription: request.stepDescription,
        expectedResult: request.expectedResult,
        candidateElements: request.candidateElements,
      });

      const geminiResult = await this.geminiClient.generateJson<unknown>({
        prompt,
        images: [{ mimeType: SCREENSHOT_MIME_TYPE, data: screenshot.toString('base64') }],
      });

      if (geminiResult.isErr()) {
        return Result.err(
          new StepInterpretationError(
            `Gemini step interpretation failed: ${geminiResult.unwrapErr().message}`,
          ),
        );
      }

      const raw = geminiResult.unwrap();
      if (!isStepInterpretationResult(raw)) {
        this.logger.warn('Gemini returned a response that failed schema validation', {
          stepDescription: request.stepDescription,
        });
        return Result.err(
          new StepInterpretationError(
            'Gemini response failed schema validation for step interpretation.',
          ),
        );
      }

      const sanitized = this.sanitizeCandidateIndexes(raw, request.candidateElements.length);
      this.logger.info('Step interpretation succeeded', {
        stepDescription: request.stepDescription,
        applicable: sanitized.applicable,
        actionCount: sanitized.actions.length,
      });
      return Result.ok(sanitized);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('Step interpretation failed', error);
      }
      const message = error instanceof Error ? error.message : String(error);
      return Result.err(new StepInterpretationError(`Step interpretation failed: ${message}`));
    }
  }

  /** Gemini's candidateIndex values are bounds-checked here (not in the type guard, which has no
   * access to the candidate count) — an out-of-range index is nulled out exactly like
   * GeminiLocatorHealingFallback already does for matchIndex, rather than trusting the model to
   * always stay in range. */
  private sanitizeCandidateIndexes(
    result: StepInterpretationResult,
    candidateCount: number,
  ): StepInterpretationResult {
    const inRange = (index: number | null): index is number =>
      index !== null && index >= 0 && index < candidateCount;

    return {
      ...result,
      actions: result.actions.map((action) => ({
        ...action,
        candidateIndex: inRange(action.candidateIndex) ? action.candidateIndex : null,
      })),
      expectedResultCheck:
        result.expectedResultCheck && inRange(result.expectedResultCheck.candidateIndex)
          ? result.expectedResultCheck
          : null,
    };
  }
}
