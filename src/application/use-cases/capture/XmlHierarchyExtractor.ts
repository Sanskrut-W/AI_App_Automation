import { ICaptureDriver } from '../../interfaces/drivers/ICaptureDriver';
import { IFileWriter } from '../../../shared/fs/IFileWriter';
import { ILogger } from '../../../shared/logger/ILogger';
import { XmlCaptureError } from '../../../core/errors/XmlCaptureError';
import { XmlSaveError } from '../../../core/errors/XmlSaveError';
import { IXmlHierarchyExtractor } from './IXmlHierarchyExtractor';

export class XmlHierarchyExtractor implements IXmlHierarchyExtractor {
  constructor(
    private readonly captureDriver: ICaptureDriver,
    private readonly fileWriter: IFileWriter,
    private readonly logger: ILogger,
  ) {}

  async capture(): Promise<string> {
    this.logger.debug('Capturing XML hierarchy');
    try {
      const xml = await this.captureDriver.getPageSource();
      this.logger.info('XML hierarchy captured', { length: xml.length });
      return xml;
    } catch (error) {
      throw new XmlCaptureError(`Failed to capture XML hierarchy: ${this.describe(error)}`);
    }
  }

  async save(xml: string, filePath: string): Promise<string> {
    this.logger.debug('Saving XML hierarchy', { filePath });
    try {
      await this.fileWriter.write(filePath, xml);
      this.logger.info('XML hierarchy saved', { filePath });
      return filePath;
    } catch (error) {
      throw new XmlSaveError(`Failed to save XML to "${filePath}": ${this.describe(error)}`);
    }
  }

  private describe(error: unknown): string {
    if (error instanceof Error) {
      this.logger.error('Underlying XML capture error', error);
      return error.message;
    }
    return String(error);
  }
}
