import { TestModule } from '../../shared/paths/TestModules';

export interface ExecuteStoredSuiteRequest {
  packageName: string;
  /** Which module's stored suite to run — modules are executed in isolation, never all together, since e.g. a real login changes app state in ways that would break an unrelated module's suite. */
  module: TestModule;
  /** Runs only this one stored test case instead of the whole module. */
  testCaseId?: string;
  /** Use an already-running device/emulator. Mutually exclusive with avdName. */
  deviceId?: string;
  /** Boot this AVD first. Mutually exclusive with deviceId. */
  avdName?: string;
  bootTimeoutMs?: number;
}
