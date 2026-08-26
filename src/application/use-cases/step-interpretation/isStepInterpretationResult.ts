import {
  StepInterpretationResult,
  StepInterpretationActionResult,
} from '../../dto/StepInterpretationResult';

const VALID_ACTIONS = new Set(['click', 'type', 'scroll', 'wait']);
const VALID_FIELD_TYPES = new Set(['literal', 'mobileNumber', 'password', 'none']);
const VALID_DIRECTIONS = new Set(['up', 'down']);

function isValidActionResult(value: unknown): value is StepInterpretationActionResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.action === 'string' &&
    VALID_ACTIONS.has(candidate.action) &&
    (candidate.candidateIndex === null || typeof candidate.candidateIndex === 'number') &&
    typeof candidate.fieldType === 'string' &&
    VALID_FIELD_TYPES.has(candidate.fieldType) &&
    (candidate.literalValue === null || typeof candidate.literalValue === 'string') &&
    (candidate.direction === null ||
      (typeof candidate.direction === 'string' && VALID_DIRECTIONS.has(candidate.direction)))
  );
}

/** Schema validation for Gemini's step-interpretation JSON — rejects anything short of the exact expected shape. */
export function isStepInterpretationResult(value: unknown): value is StepInterpretationResult {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;

  if (typeof candidate.applicable !== 'boolean') {
    return false;
  }
  if (candidate.reason !== null && typeof candidate.reason !== 'string') {
    return false;
  }
  if (!Array.isArray(candidate.actions) || !candidate.actions.every(isValidActionResult)) {
    return false;
  }

  if (candidate.expectedResultCheck !== null) {
    if (
      typeof candidate.expectedResultCheck !== 'object' ||
      candidate.expectedResultCheck === null
    ) {
      return false;
    }
    const check = candidate.expectedResultCheck as Record<string, unknown>;
    if (typeof check.candidateIndex !== 'number' || typeof check.confidence !== 'number') {
      return false;
    }
  }

  return true;
}
