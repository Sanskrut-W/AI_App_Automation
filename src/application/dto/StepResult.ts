import { ActionType } from '../../core/enums/ActionType';
import { StepStatus } from '../../core/enums/StepStatus';

export interface StepResult {
  stepNumber: number;
  action: ActionType;
  status: StepStatus;
  message: string;
  /** Path to the screenshot for this step; null when the step is not a labelled checkpoint and did
   * not fail, or if the capture itself failed. */
  screenshotPath: string | null;
  /** The step's `screenshotLabel`, shown as the caption above its screenshot in the report; null
   * for unlabelled steps (including failures, which are captured for diagnostics but uncaptioned). */
  screenshotLabel: string | null;
  /** error.stack captured at failure time; null on success. */
  stackTrace: string | null;
  durationMs: number;
}
