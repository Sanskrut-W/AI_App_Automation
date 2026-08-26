import { IFileReader } from '../../../shared/fs/IFileReader';
import { ILogger } from '../../../shared/logger/ILogger';
import { TestAccount } from '../../../core/value-objects/TestAccount';
import { ITestAccountRepository } from '../../../application/interfaces/repositories/ITestAccountRepository';

type TestAccountsFile = Record<string, TestAccount>;

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

  async findByPackageName(packageName: string): Promise<TestAccount | null> {
    try {
      const raw = await this.fileReader.read(this.filePath);
      const parsed = JSON.parse(raw) as TestAccountsFile;
      const account = parsed[packageName];
      if (!account) {
        this.logger.warn('No test account configured for this package', {
          packageName,
          filePath: this.filePath,
        });
        return null;
      }
      return account;
    } catch (error) {
      this.logger.warn('Failed to read the test accounts file', {
        filePath: this.filePath,
        reason: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }
}
