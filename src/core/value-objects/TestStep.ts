import { ActionType } from '../enums/ActionType';
import { ElementLocator } from './ElementLocator';

export interface TestStep {
  stepNumber: number;
  action: ActionType;
  /** Target element for Click/Type/VerifyText/VerifyElementExists; null for Back/Wait/whole-screen Scroll. */
  targetLocator: ElementLocator | null;
  /** Element repository id the targetLocator was derived from — enables locator healing to look up and update the stored element when this locator breaks. Null when targetLocator is null. */
  elementId: string | null;
  /** Text to type (Type) or expected text (VerifyText); null otherwise. */
  value: string | null;
  /** Scroll direction ('up' | 'down' | 'left' | 'right'); null for all other actions. */
  direction: string | null;
  /** Wait duration in milliseconds; null for all other actions. */
  durationMs: number | null;
  expectedResult: string;
  /** When true, a failure (e.g. the target element genuinely isn't present this run) is treated
   * as a no-op pass instead of aborting the test case — for steps that only apply conditionally,
   * such as dismissing a popup that doesn't reliably appear every run. Defaults to false/absent
   * for all other steps, which keep failing (and triggering overlay-dismiss/heal) as before. */
  optional?: boolean;
  /**
   * Marks this step as a reporting checkpoint and captions it, e.g. "Checking My Bets".
   *
   * Screenshots are only captured for labelled steps (plus any step that fails, so failure
   * diagnostics are never lost). Capturing every step produced ~146 images for a single 13-item
   * menu tour, which buried the handful that actually evidence anything; a caption also reads far
   * better in the report than a bare step number and action name.
   */
  screenshotLabel?: string;
}
