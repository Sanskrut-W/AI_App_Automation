import { promises as fsp } from 'fs';
import path from 'path';
import { TestCase, TestCaseProps } from '../../../core/entities/TestCase';
import { TestCaseAlreadyExistsError } from '../../../core/errors/TestCaseAlreadyExistsError';
import { TestCaseNotFoundError } from '../../../core/errors/TestCaseNotFoundError';
import { TestCaseRepositoryError } from '../../../core/errors/TestCaseRepositoryError';
import { ITestCaseRepository } from '../../../application/interfaces/repositories/ITestCaseRepository';
import { TestCaseUpdate } from '../../../application/dto/TestCaseUpdate';
import { ILogger } from '../../../shared/logger/ILogger';

const DEFAULT_STORAGE_DIR = path.resolve(process.cwd(), 'artifacts', 'test-cases');

/** One JSON file per test case under storageDir — mirrors FileScreenRepository/FileElementRepository's storage shape. */
export class FileTestCaseRepository implements ITestCaseRepository {
  constructor(
    private readonly logger: ILogger,
    private readonly storageDir: string = DEFAULT_STORAGE_DIR,
  ) {}

  async add(testCase: TestCase): Promise<void> {
    if (await this.exists(testCase.testCaseId)) {
      throw new TestCaseAlreadyExistsError(`Test case "${testCase.testCaseId}" already exists.`);
    }

    await this.writeTestCaseFile(testCase);
    this.logger.info('Test case added to repository', {
      testCaseId: testCase.testCaseId,
      screenId: testCase.screenId,
    });
  }

  async update(testCaseId: string, updates: TestCaseUpdate): Promise<TestCase> {
    const existing = await this.findById(testCaseId);
    if (!existing) {
      throw new TestCaseNotFoundError(`Cannot update: test case "${testCaseId}" does not exist.`);
    }

    const updated = new TestCase({ ...existing, ...updates });
    await this.writeTestCaseFile(updated);
    this.logger.info('Test case updated in repository', { testCaseId });
    return updated;
  }

  async findById(testCaseId: string): Promise<TestCase | null> {
    try {
      const raw = await fsp.readFile(this.filePathFor(testCaseId), 'utf-8');
      return new TestCase(JSON.parse(raw) as TestCaseProps);
    } catch (error) {
      if (this.isNotFound(error)) {
        return null;
      }
      throw new TestCaseRepositoryError(
        `Failed to read test case "${testCaseId}": ${this.describe(error)}`,
      );
    }
  }

  async exists(testCaseId: string): Promise<boolean> {
    return (await this.findById(testCaseId)) !== null;
  }

  async findAll(): Promise<TestCase[]> {
    try {
      await fsp.mkdir(this.storageDir, { recursive: true });
      const entries = await fsp.readdir(this.storageDir);
      const files = entries.filter((entry) => entry.endsWith('.json'));

      const testCases = await Promise.all(
        files.map(async (file) => {
          const raw = await fsp.readFile(path.join(this.storageDir, file), 'utf-8');
          return new TestCase(JSON.parse(raw) as TestCaseProps);
        }),
      );

      // Array.prototype.sort is stable (guaranteed since ES2019), so test cases without a
      // sequence keep their original (directory-listing) relative order, appended after every
      // sequenced one.
      return testCases.sort(
        (a, b) => (a.sequence ?? Number.MAX_SAFE_INTEGER) - (b.sequence ?? Number.MAX_SAFE_INTEGER),
      );
    } catch (error) {
      throw new TestCaseRepositoryError(`Failed to list test cases: ${this.describe(error)}`);
    }
  }

  async exportJson(): Promise<string> {
    const testCases = await this.findAll();
    return JSON.stringify(testCases, null, 2);
  }

  private filePathFor(testCaseId: string): string {
    return path.join(this.storageDir, `${testCaseId}.json`);
  }

  private async writeTestCaseFile(testCase: TestCase): Promise<void> {
    try {
      await fsp.mkdir(this.storageDir, { recursive: true });
      await fsp.writeFile(this.filePathFor(testCase.testCaseId), JSON.stringify(testCase, null, 2));
    } catch (error) {
      throw new TestCaseRepositoryError(
        `Failed to persist test case "${testCase.testCaseId}": ${this.describe(error)}`,
      );
    }
  }

  private isNotFound(error: unknown): boolean {
    return (error as NodeJS.ErrnoException)?.code === 'ENOENT';
  }

  private describe(error: unknown): string {
    if (error instanceof Error) {
      this.logger.error('Underlying test case repository error', error);
      return error.message;
    }
    return String(error);
  }
}
