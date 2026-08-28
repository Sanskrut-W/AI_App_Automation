import { TestModule } from '../../shared/paths/TestModules';

export interface ExecuteStoredSuiteRequest {
  packageName: string;
  /** Which module's stored suite to run — modules are executed in isolation, never all together, since e.g. a real login changes app state in ways that would break an unrelated module's suite. */
  module: TestModule;
  /**
   * Runs only these stored test cases instead of the whole module, in the order given. Several
   * entries share one Appium session and run back-to-back, with the account's logout teardown
   * between them — the same thing a whole-module run does, just narrowed.
   */
  testCaseIds?: string[];
  /** Use an already-running device/emulator. Mutually exclusive with avdName. */
  deviceId?: string;
  /** Boot this AVD first. Mutually exclusive with deviceId. */
  avdName?: string;
  bootTimeoutMs?: number;
}
