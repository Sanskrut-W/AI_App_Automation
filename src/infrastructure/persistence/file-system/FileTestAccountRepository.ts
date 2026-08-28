import { IFileReader } from '../../../shared/fs/IFileReader';
import { ILogger } from '../../../shared/logger/ILogger';
import { TestAccount } from '../../../core/value-objects/TestAccount';
import { ITestAccountRepository } from '../../../application/interfaces/repositories/ITestAccountRepository';

/**
 * One package's entry. The single-account form (`mobileNumber`/`password` at the top level) is the
 * original shape and still works; `accounts` + `deviceAccounts` add per-device accounts on top of
 * it, which is what allows several devices to run at the same time as different users.
 */
interface TestAccountsFileEntry extends TestAccount {
  accounts?: Record<string, { mobileNumber: string; password: string }>;
  /** adb serial -> key in `accounts`. */
  deviceAccounts?: Record<string, string>;
}

type TestAccountsFile = Record<string, TestAccountsFileEntry>;

/**
 * Reads real, already-registered test account credentials from a single JSON file (see
 * config/test-accounts.json), keyed by package name. Deliberately separate from IConfigProvider's
 * layered environment config (default/development/production/test.json): this holds per-APP
 * credential data, not runtime environment settings, and there can be one entry per app under
 * test rather than one file per environment.
 */
export class FileTestAccountRepository implements ITestAccountRepository {
  constructor(
    private readonly fileReader: IFileReader,
    private readonly logger: ILogger,
    private readonly filePath: string,
  ) {}

  async findByPackageName(packageName: string, deviceId?: string): Promise<TestAccount | null> {
    try {
      const raw = await this.fileReader.read(this.filePath);
      const parsed = JSON.parse(raw) as TestAccountsFile;
      const entry = parsed[packageName];
      if (!entry) {
        this.logger.warn('No test account configured for this package', {
          packageName,
          filePath: this.filePath,
        });
        return null;
      }
      return this.selectAccount(entry, packageName, deviceId);
    } catch (error) {
      this.logger.warn('Failed to read the test accounts file', {
        filePath: this.filePath,
        reason: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Picks the account this device should sign in as: its assigned named account if it has one,
   * otherwise the package's default. `logoutSteps` always come from the package entry — the
   * teardown recipe is about the app's UI, not about which user is signed in.
   *
   * A device mapped to a name that isn't defined is a configuration mistake worth surfacing, so it
   * warns rather than silently signing in as the default account (which, in a parallel run, would
   * mean two devices sharing one account and logging each other out).
   */
  private selectAccount(
    entry: TestAccountsFileEntry,
    packageName: string,
    deviceId?: string,
  ): TestAccount | null {
    const assignedId = deviceId ? entry.deviceAccounts?.[deviceId] : undefined;

    if (assignedId) {
      const assigned = entry.accounts?.[assignedId];
      if (assigned) {
        this.logger.info('Using the test account assigned to this device', {
          packageName,
          deviceId,
          accountId: assignedId,
        });
        return { ...assigned, accountId: assignedId, logoutSteps: entry.logoutSteps };
      }
      this.logger.warn('Device is mapped to a test account that is not defined', {
        packageName,
        deviceId,
        accountId: assignedId,
      });
    }

    if (!entry.mobileNumber || !entry.password) {
      this.logger.warn('No default test account for this package, and no account for this device', {
        packageName,
        deviceId,
      });
      return null;
    }

    return {
      mobileNumber: entry.mobileNumber,
      password: entry.password,
      logoutSteps: entry.logoutSteps,
    };
  }
}
