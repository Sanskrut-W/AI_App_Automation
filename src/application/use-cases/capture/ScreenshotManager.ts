import { ICaptureDriver } from '../../interfaces/drivers/ICaptureDriver';
import { IFileWriter } from '../../../shared/fs/IFileWriter';
import { ILogger } from '../../../shared/logger/ILogger';
import { ScreenshotCaptureError } from '../../../core/errors/ScreenshotCaptureError';
import { ScreenshotSaveError } from '../../../core/errors/ScreenshotSaveError';
import { IScreenshotManager } from './IScreenshotManager';

export class ScreenshotManager implements IScreenshotManager {
  constructor(
    private readonly captureDriver: ICaptureDriver,
    private readonly fileWriter: IFileWriter,
    private readonly logger: ILogger,
  ) {}

  async capture(): Promise<Buffer> {
    this.logger.debug('Capturing screenshot');
    try {
      const screenshot = await this.captureDriver.takeScreenshot();
      this.logger.info('Screenshot captured', { bytes: screenshot.length });
      return screenshot;
    } catch (error) {
      throw new ScreenshotCaptureError(`Failed to capture screenshot: ${this.describe(error)}`);
    }
  }

  async save(screenshot: Buffer, filePath: string): Promise<string> {
    this.logger.debug('Saving screenshot', { filePath });
    try {
      await this.fileWriter.write(filePath, screenshot);
      this.logger.info('Screenshot saved', { filePath });
      return filePath;
    } catch (error) {
      throw new ScreenshotSaveError(
        `Failed to save screenshot to "${filePath}": ${this.describe(error)}`,
      );
    }
  }

  private describe(error: unknown): string {
    if (error instanceof Error) {
      this.logger.error('Underlying screenshot error', error);
      return error.message;
    }
    return String(error);
  }
}
