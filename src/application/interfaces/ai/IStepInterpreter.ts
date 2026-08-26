import { StepInterpretationRequest } from '../../dto/StepInterpretationRequest';
import { StepInterpretationResult } from '../../dto/StepInterpretationResult';
import { StepInterpretationError } from '../../../core/errors/StepInterpretationError';
import { Result } from '../../../shared/result/Result';

/** A hard dependency for ManualTestCaseGenerator, unlike IAiLocatorHealingFallback's optional
 * fallback role: free-text manual steps cannot be interpreted at all without this, so a caller
 * with no Gemini key configured should fail fast rather than silently degrade. */
export interface IStepInterpreter {
  interpret(
    request: StepInterpretationRequest,
  ): Promise<Result<StepInterpretationResult, StepInterpretationError>>;
}
