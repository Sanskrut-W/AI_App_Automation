import fs from 'fs';
import os from 'os';
import path from 'path';
import { FileScreenRepository } from '../../../../../src/infrastructure/persistence/file-system/FileScreenRepository';
import { Screen, ScreenProps } from '../../../../../src/core/entities/Screen';
import { ScreenAlreadyExistsError } from '../../../../../src/core/errors/ScreenAlreadyExistsError';
import { ScreenNotFoundError } from '../../../../../src/core/errors/ScreenNotFoundError';
import { createMockLogger } from '../../../support/createMockLogger';

function createScreen(overrides: Partial<ScreenProps> = {}): Screen {
  return new Screen({
    screenId: 'screen-1',
    screenName: 'Home',
    screenshotPath: '/artifacts/screenshots/screen-1.png',
    xmlPath: '/artifacts/xml-dumps/screen-1.xml',
    packageName: 'com.example.calculator',
    activityName: '.MainActivity',
    parentScreenId: null,
    navigationPath: ['screen-1'],
    discoveredAt: '2026-07-20T00:00:00.000Z',
    structuralHash: 'hash-1',
    ...overrides,
  });
}

describe('FileScreenRepository', () => {
  let tempDir: string;
  let repository: FileScreenRepository;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'screen-repo-test-'));
    repository = new FileScreenRepository(createMockLogger(), tempDir);
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('add', () => {
    it('persists a new screen as a JSON file named after its screenId', async () => {
      await repository.add(createScreen());

      const raw = fs.readFileSync(path.join(tempDir, 'screen-1.json'), 'utf-8');
      expect(JSON.parse(raw)).toMatchObject({ screenId: 'screen-1', screenName: 'Home' });
    });

    it('throws ScreenAlreadyExistsError when the screenId is already present', async () => {
      await repository.add(createScreen());

      await expect(repository.add(createScreen())).rejects.toBeInstanceOf(ScreenAlreadyExistsError);
    });
  });

  describe('findById', () => {
    it('returns null when the screen does not exist', async () => {
      await expect(repository.findById('does-not-exist')).resolves.toBeNull();
    });

    it('returns the screen after it has been added', async () => {
      await repository.add(createScreen());

      const found = await repository.findById('screen-1');

      expect(found).toBeInstanceOf(Screen);
      expect(found?.screenName).toBe('Home');
      expect(found?.navigationPath).toEqual(['screen-1']);
    });
  });

  describe('exists', () => {
    it('returns false before add() and true after', async () => {
      await expect(repository.exists('screen-1')).resolves.toBe(false);

      await repository.add(createScreen());

      await expect(repository.exists('screen-1')).resolves.toBe(true);
    });
  });

  describe('update', () => {
    it('throws ScreenNotFoundError when the screen does not exist', async () => {
      await expect(
        repository.update('does-not-exist', { screenName: 'New name' }),
      ).rejects.toBeInstanceOf(ScreenNotFoundError);
    });

    it('merges the given updates into the existing screen, persists them, and preserves other fields', async () => {
      await repository.add(createScreen());

      const updated = await repository.update('screen-1', {
        screenName: 'Home Renamed',
        parentScreenId: 'screen-0',
        navigationPath: ['screen-0', 'screen-1'],
      });

      expect(updated.screenName).toBe('Home Renamed');
      expect(updated.parentScreenId).toBe('screen-0');
      expect(updated.navigationPath).toEqual(['screen-0', 'screen-1']);
      expect(updated.packageName).toBe('com.example.calculator');

      const reloaded = await repository.findById('screen-1');
      expect(reloaded?.screenName).toBe('Home Renamed');
    });

    it('never changes screenId or discoveredAt', async () => {
      await repository.add(createScreen({ discoveredAt: '2026-07-20T00:00:00.000Z' }));

      const updated = await repository.update('screen-1', { screenName: 'Renamed' });

      expect(updated.screenId).toBe('screen-1');
      expect(updated.discoveredAt).toBe('2026-07-20T00:00:00.000Z');
    });
  });

  describe('findAll', () => {
    it('returns an empty array when no screens have been added', async () => {
      await expect(repository.findAll()).resolves.toEqual([]);
    });

    it('returns all added screens sorted by discovery time', async () => {
      await repository.add(
        createScreen({ screenId: 'screen-2', discoveredAt: '2026-07-20T00:00:02.000Z' }),
      );
      await repository.add(
        createScreen({ screenId: 'screen-1', discoveredAt: '2026-07-20T00:00:01.000Z' }),
      );

      const screens = await repository.findAll();

      expect(screens.map((s) => s.screenId)).toEqual(['screen-1', 'screen-2']);
    });
  });

  describe('exportJson', () => {
    it('returns a JSON string containing every stored screen', async () => {
      await repository.add(createScreen({ screenId: 'screen-1' }));
      await repository.add(
        createScreen({ screenId: 'screen-2', discoveredAt: '2026-07-20T00:00:05.000Z' }),
      );

      const json = await repository.exportJson();
      const parsed = JSON.parse(json) as Array<{ screenId: string }>;

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(2);
      expect(parsed.map((s) => s.screenId).sort()).toEqual(['screen-1', 'screen-2']);
    });

    it('returns an empty JSON array when the repository is empty', async () => {
      const json = await repository.exportJson();

      expect(JSON.parse(json)).toEqual([]);
    });
  });
});
