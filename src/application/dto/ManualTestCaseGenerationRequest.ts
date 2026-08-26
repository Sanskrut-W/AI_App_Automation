import { TestAccount } from '../../core/value-objects/TestAccount';
import { NavigationGraph } from './NavigationGraph';
import { ManualTestCaseInput } from './ManualTestCaseInput';

export interface ManualTestCaseGenerationRequest {
  navigationGraph: NavigationGraph;
  appVersionName: string;
  appVersionCode: string;
  /** Real, already-registered account credentials to resolve steps like "enter mobile number (on
   * which account exists)" — null when none is configured for this package (see
   * ITestAccountRepository), in which case any step that needs one is skipped with a warning
   * rather than typing a blank/made-up value. */
  testAccount: TestAccount | null;
  manualTestCases: ManualTestCaseInput[];
}
