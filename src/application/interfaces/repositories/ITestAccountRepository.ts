import { TestAccount } from '../../../core/value-objects/TestAccount';

/** Storage-agnostic lookup of a real test account's credentials, keyed by app package name. */
export interface ITestAccountRepository {
  findByPackageName(packageName: string): Promise<TestAccount | null>;
}
