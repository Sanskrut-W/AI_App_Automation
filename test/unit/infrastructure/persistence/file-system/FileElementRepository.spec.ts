import fs from 'fs';
import os from 'os';
import path from 'path';
import { FileElementRepository } from '../../../../../src/infrastructure/persistence/file-system/FileElementRepository';
import { Element, ElementProps } from '../../../../../src/core/entities/Element';
import { LocatorStrategy } from '../../../../../src/core/enums/LocatorStrategy';
import { ElementAlreadyExistsError } from '../../../../../src/core/errors/ElementAlreadyExistsError';
import { ElementNotFoundError } from '../../../../../src/core/errors/ElementNotFoundError';
import { createMockLogger } from '../../../support/createMockLogger';

function createElement(overrides: Partial<ElementProps> = {}): Element {
  return new Element({
    elementId: 'element-1',
    screenId: 'screen-1',
    className: 'android.widget.Button',
    text: 'Calculate',
    resourceId: 'com.example.app:id/btnCalculate',
    accessibilityId: '',
    contentDescription: '',
    bounds: { left: 100, top: 200, right: 300, bottom: 260 },
    clickable: true,
    enabled: true,
    selected: false,
    checked: false,
    isPassword: false,
    parentElementId: null,
    childElementIds: [],
    locators: [
      {
        strategy: LocatorStrategy.RESOURCE_ID,
        value: 'com.example.app:id/btnCalculate',
        priority: 1,
      },
    ],
    ...overrides,
  });
}

describe('FileElementRepository', () => {
  let tempDir: string;
  let repository: FileElementRepository;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'element-repo-test-'));
    repository = new FileElementRepository(createMockLogger(), tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('add', () => {
    it('persists a new element as a JSON file named after its elementId', async () => {
      await repository.add(createElement());

      const raw = fs.readFileSync(path.join(tempDir, 'element-1.json'), 'utf-8');
      expect(JSON.parse(raw)).toMatchObject({
        elementId: 'element-1',
        className: 'android.widget.Button',
      });
    });

    it('throws ElementAlreadyExistsError when the elementId is already present', async () => {
      await repository.add(createElement());

      await expect(repository.add(createElement())).rejects.toBeInstanceOf(
        ElementAlreadyExistsError,
      );
    });
  });

  describe('findById', () => {
    it('returns null when the element does not exist', async () => {
      await expect(repository.findById('does-not-exist')).resolves.toBeNull();
    });

    it('returns the element, including its locators, after it has been added', async () => {
      await repository.add(createElement());

      const found = await repository.findById('element-1');

      expect(found).toBeInstanceOf(Element);
      expect(found?.locators).toEqual([
        {
          strategy: LocatorStrategy.RESOURCE_ID,
          value: 'com.example.app:id/btnCalculate',
          priority: 1,
        },
      ]);
    });
  });

  describe('exists', () => {
    it('returns false before add() and true after', async () => {
      await expect(repository.exists('element-1')).resolves.toBe(false);

      await repository.add(createElement());

      await expect(repository.exists('element-1')).resolves.toBe(true);
    });
  });

  describe('update', () => {
    it('throws ElementNotFoundError when the element does not exist', async () => {
      await expect(
        repository.update('does-not-exist', { text: 'New text' }),
      ).rejects.toBeInstanceOf(ElementNotFoundError);
    });

    it('merges updates into the existing element, persists them, and preserves other fields', async () => {
      await repository.add(createElement());

      const updated = await repository.update('element-1', { text: 'Updated', enabled: false });

      expect(updated.text).toBe('Updated');
      expect(updated.enabled).toBe(false);
      expect(updated.className).toBe('android.widget.Button');

      const reloaded = await repository.findById('element-1');
      expect(reloaded?.text).toBe('Updated');
    });

    it('never changes elementId or screenId', async () => {
      await repository.add(createElement());

      const updated = await repository.update('element-1', { text: 'Updated' });

      expect(updated.elementId).toBe('element-1');
      expect(updated.screenId).toBe('screen-1');
    });
  });

  describe('findAll', () => {
    it('returns an empty array when no elements have been added', async () => {
      await expect(repository.findAll()).resolves.toEqual([]);
    });

    it('returns every added element', async () => {
      await repository.add(createElement({ elementId: 'element-1' }));
      await repository.add(
        createElement({ elementId: 'element-2', className: 'android.widget.EditText' }),
      );

      const elements = await repository.findAll();

      expect(elements.map((e) => e.elementId).sort()).toEqual(['element-1', 'element-2']);
    });
  });

  describe('search', () => {
    beforeEach(async () => {
      await repository.add(
        createElement({
          elementId: 'element-1',
          screenId: 'screen-1',
          className: 'android.widget.Button',
          text: 'Calculate',
          clickable: true,
          enabled: true,
        }),
      );
      await repository.add(
        createElement({
          elementId: 'element-2',
          screenId: 'screen-1',
          className: 'android.widget.EditText',
          text: '',
          resourceId: '',
          contentDescription: 'Amount input field',
          clickable: false,
          enabled: true,
          locators: [],
        }),
      );
      await repository.add(
        createElement({
          elementId: 'element-3',
          screenId: 'screen-2',
          className: 'android.widget.Button',
          text: 'Cancel',
          resourceId: '',
          clickable: true,
          enabled: false,
          locators: [],
        }),
      );
    });

    it('filters by exact screenId', async () => {
      const results = await repository.search({ screenId: 'screen-1' });

      expect(results.map((e) => e.elementId).sort()).toEqual(['element-1', 'element-2']);
    });

    it('filters by exact className', async () => {
      const results = await repository.search({ className: 'android.widget.Button' });

      expect(results.map((e) => e.elementId).sort()).toEqual(['element-1', 'element-3']);
    });

    it('filters by boolean flags such as clickable and enabled together', async () => {
      const results = await repository.search({ clickable: true, enabled: true });

      expect(results.map((e) => e.elementId)).toEqual(['element-1']);
    });

    it('filters by case-insensitive substring match on text', async () => {
      const results = await repository.search({ text: 'calc' });

      expect(results.map((e) => e.elementId)).toEqual(['element-1']);
    });

    it('filters by case-insensitive substring match on contentDescription', async () => {
      const results = await repository.search({ contentDescription: 'AMOUNT' });

      expect(results.map((e) => e.elementId)).toEqual(['element-2']);
    });

    it('combines multiple criteria with AND semantics', async () => {
      const results = await repository.search({
        screenId: 'screen-1',
        className: 'android.widget.Button',
      });

      expect(results.map((e) => e.elementId)).toEqual(['element-1']);
    });

    it('returns an empty array when nothing matches', async () => {
      const results = await repository.search({ className: 'android.widget.CheckBox' });

      expect(results).toEqual([]);
    });
  });

  describe('exportJson', () => {
    it('returns a JSON string containing every stored element', async () => {
      await repository.add(createElement({ elementId: 'element-1' }));
      await repository.add(createElement({ elementId: 'element-2' }));

      const json = await repository.exportJson();
      const parsed = JSON.parse(json) as Array<{ elementId: string }>;

      expect(parsed.map((e) => e.elementId).sort()).toEqual(['element-1', 'element-2']);
    });

    it('returns an empty JSON array when the repository is empty', async () => {
      const json = await repository.exportJson();

      expect(JSON.parse(json)).toEqual([]);
    });
  });
});
