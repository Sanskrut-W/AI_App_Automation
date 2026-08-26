import { promises as fsp } from 'fs';
import path from 'path';
import { Screen, ScreenProps } from '../../../core/entities/Screen';
import { ScreenAlreadyExistsError } from '../../../core/errors/ScreenAlreadyExistsError';
import { ScreenNotFoundError } from '../../../core/errors/ScreenNotFoundError';
import { ScreenRepositoryError } from '../../../core/errors/ScreenRepositoryError';
import { IScreenRepository } from '../../../application/interfaces/repositories/IScreenRepository';
import { ScreenUpdate } from '../../../application/dto/ScreenUpdate';
import { ILogger } from '../../../shared/logger/ILogger';

const DEFAULT_STORAGE_DIR = path.resolve(process.cwd(), 'artifacts', 'screen-repository');

/** One JSON file per screen under storageDir — the same "one record per screen" shape a document or SQL row would use. */
export class FileScreenRepository implements IScreenRepository {
  constructor(
    private readonly logger: ILogger,
    private readonly storageDir: string = DEFAULT_STORAGE_DIR,
  ) {}

  async add(screen: Screen): Promise<void> {
    if (await this.exists(screen.screenId)) {
      throw new ScreenAlreadyExistsError(`Screen "${screen.screenId}" already exists.`);
    }

    await this.writeScreenFile(screen);
    this.logger.info('Screen added to repository', { screenId: screen.screenId });
  }

  async update(screenId: string, updates: ScreenUpdate): Promise<Screen> {
    const existing = await this.findById(screenId);
    if (!existing) {
      throw new ScreenNotFoundError(`Cannot update: screen "${screenId}" does not exist.`);
    }

    const updated = new Screen({ ...existing, ...updates });
    await this.writeScreenFile(updated);
    this.logger.info('Screen updated in repository', { screenId });
    return updated;
  }

  async findById(screenId: string): Promise<Screen | null> {
    try {
      const raw = await fsp.readFile(this.filePathFor(screenId), 'utf-8');
      return new Screen(JSON.parse(raw) as ScreenProps);
    } catch (error) {
      if (this.isNotFound(error)) {
        return null;
      }
      throw new ScreenRepositoryError(
        `Failed to read screen "${screenId}": ${this.describe(error)}`,
      );
    }
  }

  async exists(screenId: string): Promise<boolean> {
    return (await this.findById(screenId)) !== null;
  }

  async findAll(): Promise<Screen[]> {
    try {
      await fsp.mkdir(this.storageDir, { recursive: true });
      const entries = await fsp.readdir(this.storageDir);
      const files = entries.filter((entry) => entry.endsWith('.json'));

      const screens = await Promise.all(
        files.map(async (file) => {
          const raw = await fsp.readFile(path.join(this.storageDir, file), 'utf-8');
          return new Screen(JSON.parse(raw) as ScreenProps);
        }),
      );

      return screens.sort((a, b) => a.discoveredAt.localeCompare(b.discoveredAt));
    } catch (error) {
      throw new ScreenRepositoryError(`Failed to list screens: ${this.describe(error)}`);
    }
  }

  async exportJson(): Promise<string> {
    const screens = await this.findAll();
    return JSON.stringify(screens, null, 2);
  }

  private filePathFor(screenId: string): string {
    return path.join(this.storageDir, `${screenId}.json`);
  }

  private async writeScreenFile(screen: Screen): Promise<void> {
    try {
      await fsp.mkdir(this.storageDir, { recursive: true });
      await fsp.writeFile(this.filePathFor(screen.screenId), JSON.stringify(screen, null, 2));
    } catch (error) {
      throw new ScreenRepositoryError(
        `Failed to persist screen "${screen.screenId}": ${this.describe(error)}`,
      );
    }
  }

  private isNotFound(error: unknown): boolean {
    return (error as NodeJS.ErrnoException)?.code === 'ENOENT';
  }

  private describe(error: unknown): string {
    if (error instanceof Error) {
      this.logger.error('Underlying screen repository error', error);
      return error.message;
    }
    return String(error);
  }
}
