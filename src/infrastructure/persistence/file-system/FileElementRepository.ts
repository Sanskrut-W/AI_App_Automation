import { promises as fsp } from 'fs';
import path from 'path';
import { Element, ElementProps } from '../../../core/entities/Element';
import { ElementAlreadyExistsError } from '../../../core/errors/ElementAlreadyExistsError';
import { ElementNotFoundError } from '../../../core/errors/ElementNotFoundError';
import { ElementRepositoryError } from '../../../core/errors/ElementRepositoryError';
import { IElementRepository } from '../../../application/interfaces/repositories/IElementRepository';
import { ElementUpdate } from '../../../application/dto/ElementUpdate';
import { ElementSearchCriteria } from '../../../application/dto/ElementSearchCriteria';
import { ILogger } from '../../../shared/logger/ILogger';

const DEFAULT_STORAGE_DIR = path.resolve(process.cwd(), 'artifacts', 'element-repository');
/** Caps concurrent file reads in findAll() — a large crawl can accumulate tens of thousands of
 * element files, and reading them all at once via a single Promise.all exhausts the OS's open
 * file handle limit (EMFILE), especially on Windows. */
const READ_BATCH_SIZE = 200;

/** One JSON file per element under storageDir — mirrors FileScreenRepository's storage shape. */
export class FileElementRepository implements IElementRepository {
  constructor(
    private readonly logger: ILogger,
    private readonly storageDir: string = DEFAULT_STORAGE_DIR,
  ) {}

  async add(element: Element): Promise<void> {
    if (await this.exists(element.elementId)) {
      throw new ElementAlreadyExistsError(`Element "${element.elementId}" already exists.`);
    }

    await this.writeElementFile(element);
    this.logger.info('Element added to repository', {
      elementId: element.elementId,
      screenId: element.screenId,
    });
  }

  async update(elementId: string, updates: ElementUpdate): Promise<Element> {
    const existing = await this.findById(elementId);
    if (!existing) {
      throw new ElementNotFoundError(`Cannot update: element "${elementId}" does not exist.`);
    }

    const updated = new Element({ ...existing, ...updates });
    await this.writeElementFile(updated);
    this.logger.info('Element updated in repository', { elementId });
    return updated;
  }

  async findById(elementId: string): Promise<Element | null> {
    try {
      const raw = await fsp.readFile(this.filePathFor(elementId), 'utf-8');
      return new Element(JSON.parse(raw) as ElementProps);
    } catch (error) {
      if (this.isNotFound(error)) {
        return null;
      }
      throw new ElementRepositoryError(
        `Failed to read element "${elementId}": ${this.describe(error)}`,
      );
    }
  }

  async exists(elementId: string): Promise<boolean> {
    return (await this.findById(elementId)) !== null;
  }

  async findAll(): Promise<Element[]> {
    try {
      await fsp.mkdir(this.storageDir, { recursive: true });
      const entries = await fsp.readdir(this.storageDir);
      const files = entries.filter((entry) => entry.endsWith('.json'));

      const elements: Element[] = [];
      for (let i = 0; i < files.length; i += READ_BATCH_SIZE) {
        const batch = files.slice(i, i + READ_BATCH_SIZE);
        const batchElements = await Promise.all(
          batch.map(async (file) => {
            const raw = await fsp.readFile(path.join(this.storageDir, file), 'utf-8');
            return new Element(JSON.parse(raw) as ElementProps);
          }),
        );
        elements.push(...batchElements);
      }
      return elements;
    } catch (error) {
      throw new ElementRepositoryError(`Failed to list elements: ${this.describe(error)}`);
    }
  }

  async search(criteria: ElementSearchCriteria): Promise<Element[]> {
    const all = await this.findAll();
    return all.filter((element) => this.matches(element, criteria));
  }

  async exportJson(): Promise<string> {
    const elements = await this.findAll();
    return JSON.stringify(elements, null, 2);
  }

  private matches(element: Element, criteria: ElementSearchCriteria): boolean {
    if (criteria.screenId !== undefined && element.screenId !== criteria.screenId) {
      return false;
    }
    if (criteria.className !== undefined && element.className !== criteria.className) {
      return false;
    }
    if (criteria.resourceId !== undefined && element.resourceId !== criteria.resourceId) {
      return false;
    }
    if (
      criteria.accessibilityId !== undefined &&
      element.accessibilityId !== criteria.accessibilityId
    ) {
      return false;
    }
    if (criteria.clickable !== undefined && element.clickable !== criteria.clickable) {
      return false;
    }
    if (criteria.enabled !== undefined && element.enabled !== criteria.enabled) {
      return false;
    }
    if (criteria.selected !== undefined && element.selected !== criteria.selected) {
      return false;
    }
    if (criteria.checked !== undefined && element.checked !== criteria.checked) {
      return false;
    }
    if (
      criteria.text !== undefined &&
      !element.text.toLowerCase().includes(criteria.text.toLowerCase())
    ) {
      return false;
    }
    if (
      criteria.contentDescription !== undefined &&
      !element.contentDescription.toLowerCase().includes(criteria.contentDescription.toLowerCase())
    ) {
      return false;
    }
    return true;
  }

  private filePathFor(elementId: string): string {
    return path.join(this.storageDir, `${elementId}.json`);
  }

  private async writeElementFile(element: Element): Promise<void> {
    try {
      await fsp.mkdir(this.storageDir, { recursive: true });
      await fsp.writeFile(this.filePathFor(element.elementId), JSON.stringify(element, null, 2));
    } catch (error) {
      throw new ElementRepositoryError(
        `Failed to persist element "${element.elementId}": ${this.describe(error)}`,
      );
    }
  }

  private isNotFound(error: unknown): boolean {
    return (error as NodeJS.ErrnoException)?.code === 'ENOENT';
  }

  private describe(error: unknown): string {
    if (error instanceof Error) {
      this.logger.error('Underlying element repository error', error);
      return error.message;
    }
    return String(error);
  }
}
