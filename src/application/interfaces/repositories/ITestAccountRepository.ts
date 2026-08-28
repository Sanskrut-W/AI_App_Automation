import { TestAccount } from '../../../core/value-objects/TestAccount';

/** Storage-agnostic lookup of a real test account's credentials, keyed by app package name. */
export interface ITestAccountRepository {
  /**
   * @param deviceId Optional adb serial. When the package has several named accounts mapped to
   * devices, this selects the one assigned to that device — which is what lets two devices run in
   * parallel signed in as different accounts. Falls back to the package's default account when the
   * device has no assignment.
   */
  findByPackageName(packageName: string, deviceId?: string): Promise<TestAccount | null>;
}
