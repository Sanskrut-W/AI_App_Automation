import fs from 'fs';
import os from 'os';
import path from 'path';
import { FileTestCaseRepository } from '../../../../../src/infrastructure/persistence/file-system/FileTestCaseRepository';
import { TestCase, TestCaseProps } from '../../../../../src/core/entities/TestCase';
import { ActionType } from '../../../../../src/core/enums/ActionType';
import { TestPriority } from '../../../../../src/core/enums/TestPriority';
import { LocatorStrategy } from '../../../../../src/core/enums/LocatorStrategy';
import { TestCaseAlreadyExistsError } from '../../../../../src/core/errors/TestCaseAlreadyExistsError';
import { TestCaseNotFoundError } from '../../../../../src/core/errors/TestCaseNotFoundError';
import { createMockLogger } from '../../../support/createMockLogger';

function createTestCase(overrides: Partial<TestCaseProps> = {}): TestCase {
  return new TestCase({
    testCaseId: 'test-case-1',
    screenId: 'screen-1',
    title: 'Home: Calculate button',
    description: 'Lets the user perform a calculation.',
    steps: [
      {
        stepNumber: 1,
        action: ActionType.CLICK,
        targetLocator: {
          strategy: LocatorStrategy.RESOURCE_ID,
          value: 'com.example.app:id/btnCalculate',
        },
        elementId: 'element-1',
        value: null,
        direction: null,
        durationMs: null,
        expectedResult: 'Calculate button responds to a tap.',
      },
    ],
    priority: TestPriority.MEDIUM,
    tags: ['smoke'],
    appVersionName: '1.0.0',
    appVersionCode: '1',
    ...overrides,
  });
}

describe('FileTestCaseRepository', () => {
  let tempDir: string;
  let repository: FileTestCaseRepository;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'test-case-repo-test-'));
    repository = new FileTestCaseRepository(createMockLogger(), tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('add', () => {
    it('persists a new test case as a JSON file named after its testCaseId', async () => {
      await repository.add(createTestCase());

      const raw = fs.readFileSync(path.join(tempDir, 'test-case-1.json'), 'utf-8');
      expect(JSON.parse(raw)).toMatchObject({ testCaseId: 'test-case-1', screenId: 'screen-1' });
    });

    it('throws TestCaseAlreadyExistsError when the testCaseId is already present', async () => {
      await repository.add(createTestCase());

      await expect(repository.add(createTestCase())).rejects.toBeInstanceOf(
        TestCaseAlreadyExistsError,
      );
    });
  });

  describe('findById', () => {
    it('returns null when the test case does not exist', async () => {
      await expect(repository.findById('does-not-exist')).resolves.toBeNull();
    });

    it('returns the test case, including its steps, after it has been added', async () => {
      await repository.add(createTestCase());

      const found = await repository.findById('test-case-1');

      expect(found).toBeInstanceOf(TestCase);
      expect(found?.steps).toHaveLength(1);
      expect(found?.steps[0].action).toBe(ActionType.CLICK);
    });
  });

  describe('exists', () => {
    it('returns false before add() and true after', async () => {
      await expect(repository.exists('test-case-1')).resolves.toBe(false);

      await repository.add(createTestCase());

      await expect(repository.exists('test-case-1')).resolves.toBe(true);
    });
  });

  describe('update', () => {
    it('throws TestCaseNotFoundError when the test case does not exist', async () => {
      await expect(
        repository.update('does-not-exist', { title: 'New title' }),
      ).rejects.toBeInstanceOf(TestCaseNotFoundError);
    });

    it('merges updates into the existing test case, persists them, and preserves other fields', async () => {
      await repository.add(createTestCase());

      const updated = await repository.update('test-case-1', {
        title: 'Renamed',
        priority: TestPriority.HIGH,
      });

      expect(updated.title).toBe('Renamed');
      expect(updated.priority).toBe(TestPriority.HIGH);
      expect(updated.description).toBe('Lets the user perform a calculation.');

      const reloaded = await repository.findById('test-case-1');
      expect(reloaded?.title).toBe('Renamed');
    });

    it('never changes testCaseId or screenId', async () => {
      await repository.add(createTestCase());

      const updated = await repository.update('test-case-1', { title: 'Renamed' });

      expect(updated.testCaseId).toBe('test-case-1');
      expect(updated.screenId).toBe('screen-1');
    });
  });

  describe('findAll', () => {
    it('returns an empty array when no test cases have been added', async () => {
      await expect(repository.findAll()).resolves.toEqual([]);
    });

    it('returns every added test case', async () => {
      await repository.add(createTestCase({ testCaseId: 'test-case-1' }));
      await repository.add(createTestCase({ testCaseId: 'test-case-2' }));

      const testCases = await repository.findAll();

      expect(testCases.map((tc) => tc.testCaseId).sort()).toEqual(['test-case-1', 'test-case-2']);
    });

    it('orders sequenced test cases ascending by sequence, ahead of any unsequenced ones', async () => {
      await repository.add(createTestCase({ testCaseId: 'unsequenced', sequence: undefined }));
      await repository.add(createTestCase({ testCaseId: 'third', sequence: 3 }));
      await repository.add(createTestCase({ testCaseId: 'first', sequence: 1 }));
      await repository.add(createTestCase({ testCaseId: 'second', sequence: 2 }));

      const testCases = await repository.findAll();

      expect(testCases.map((tc) => tc.testCaseId)).toEqual([
        'first',
        'second',
        'third',
        'unsequenced',
      ]);
    });
  });

  describe('exportJson', () => {
    it('returns a JSON string containing every stored test case', async () => {
      await repository.add(createTestCase({ testCaseId: 'test-case-1' }));
      await repository.add(createTestCase({ testCaseId: 'test-case-2' }));

      const json = await repository.exportJson();
      const parsed = JSON.parse(json) as Array<{ testCaseId: string }>;

      expect(parsed.map((tc) => tc.testCaseId).sort()).toEqual(['test-case-1', 'test-case-2']);
    });

    it('returns an empty JSON array when the repository is empty', async () => {
      const json = await repository.exportJson();

      expect(JSON.parse(json)).toEqual([]);
    });
  });
});
