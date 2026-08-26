import { Element } from '../../core/entities/Element';

export interface StepInterpretationRequest {
  stepDescription: string;
  expectedResult: string;
  /** Candidate elements for the screen currently believed to be active (see
   * ManualTestCaseGenerator's screen-tracking) — index-addressed in the response, mirroring
   * LocatorHealingPromptBuilder's existing candidate-list convention so the model returns a
   * position, never a made-up id. */
  candidateElements: Element[];
  /** Path to that screen's screenshot, attached for extra visual context (e.g. recognizing "the
   * three horizontal lines" hamburger icon) the same way AiScreenAnalyzer already does. */
  screenshotPath: string;
}
