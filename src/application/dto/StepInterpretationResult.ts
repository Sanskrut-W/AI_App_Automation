export type StepInterpretationAction = 'click' | 'type' | 'scroll' | 'wait';
/** Deliberately keeps the model's job to "classify and locate," not "invent realistic data" —
 * mobileNumber/password resolve to a real ITestAccountRepository value in code afterward, exactly
 * like the sign-up generator resolves its own random data in code rather than asking Gemini for
 * it. */
export type StepInterpretationFieldType = 'literal' | 'mobileNumber' | 'password' | 'none';
export type StepInterpretationScrollDirection = 'up' | 'down';

export interface StepInterpretationActionResult {
  action: StepInterpretationAction;
  /** Index into the request's candidateElements array; null for a 'wait' action. */
  candidateIndex: number | null;
  fieldType: StepInterpretationFieldType;
  /** Only set when fieldType === 'literal' — a value actually present in the step's own text. */
  literalValue: string | null;
  /** Only set when action === 'scroll'. */
  direction: StepInterpretationScrollDirection | null;
}

export interface StepInterpretationExpectedResultCheck {
  candidateIndex: number;
  confidence: number;
}

export interface StepInterpretationResult {
  /** False when the step describes something that doesn't correspond to any action in this app at
   * all (e.g. a website-only "enter the URL..." step) — the caller skips the row entirely rather
   * than forcing a wrong guess. */
  applicable: boolean;
  reason: string | null;
  actions: StepInterpretationActionResult[];
  /** An assertion derived from the Expected Result column, when confidently resolvable; null
   * otherwise — never guessed. */
  expectedResultCheck: StepInterpretationExpectedResultCheck | null;
}
