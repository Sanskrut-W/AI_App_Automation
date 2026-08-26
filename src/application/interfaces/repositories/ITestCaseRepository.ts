import { TestCase } from '../../../core/entities/TestCase';
import { TestCaseUpdate } from '../../dto/TestCaseUpdate';

/**
 * Storage contract for generated test cases — the same storage-agnostic shape as
 * IScreenRepository/IElementRepository, for the same future-database-swap reason.
 */
export interface ITestCaseRepository {
  add(testCase: TestCase): Promise<void>;
  update(testCaseId: string, updates: TestCaseUpdate): Promise<TestCase>;
  findById(testCaseId: string): Promise<TestCase | null>;
  findAll(): Promise<TestCase[]>;
  exists(testCaseId: string): Promise<boolean>;
  exportJson(): Promise<string>;
}
