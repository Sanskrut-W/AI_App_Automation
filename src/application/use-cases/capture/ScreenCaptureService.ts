import path from 'path';
import { ScreenCaptureResult } from '../../dto/ScreenCaptureResult';
import { ScreenCaptureServiceError } from '../../../core/errors/ScreenCaptureServiceError';
import { Result } from '../../../shared/result/Result';
import { ILogger } from '../../../shared/logger/ILogger';
import { IClock } from '../../../shared/time/IClock';
import { IIdGenerator } from '../../../shared/id/IIdGenerator';
import { ICaptureDriver } from '../../interfaces/drivers/ICaptureDriver';
import { IScreenshotManager } from './IScreenshotManager';
import { IXmlHierarchyExtractor } from './IXmlHierarchyExtractor';
import { IScreenCaptureService } from './IScreenCaptureService';

export interface ScreenCaptureServiceOptions {
  screenshotDir?: string;
  xmlDir?: string;
}

/** Orchestrates a full screen capture: screenshot + XML + foreground package/activity, saved to disk, timestamped, and returned as structured metadata. */
export class ScreenCaptureService implements IScreenCaptureService {
  private readonly screenshotDir: string;
  private readonly xmlDir: string;

  constructor(
    private readonly screenshotManager: IScreenshotManager,
    private readonly xmlExtractor: IXmlHierarchyExtractor,
    private readonly captureDriver: ICaptureDriver,
    private readonly idGenerator: IIdGenerator,
    private readonly clock: IClock,
    private readonly logger: ILogger,
    options: ScreenCaptureServiceOptions = {},
  ) {
    this.screenshotDir =
      options.screenshotDir ?? path.resolve(process.cwd(), 'artifacts', 'screenshots');
    this.xmlDir = options.xmlDir ?? path.resolve(process.cwd(), 'artifacts', 'xml-dumps');
  }

  async captureScreen(): Promise<Result<ScreenCaptureResult, ScreenCaptureServiceError>> {
    const screenId = this.idGenerator.generate();
    this.logger.info('Capturing screen', { screenId });

    try {
      const [screenshot, xml, packageName, activityName] = await Promise.all([
        this.screenshotManager.capture(),
        this.xmlExtractor.capture(),
        this.captureDriver.getCurrentPackage(),
        this.captureDriver.getCurrentActivity(),
      ]);

      const screenshotPath = path.join(this.screenshotDir, `${screenId}.png`);
      const xmlPath = path.join(this.xmlDir, `${screenId}.xml`);

      await Promise.all([
        this.screenshotManager.save(screenshot, screenshotPath),
        this.xmlExtractor.save(xml, xmlPath),
      ]);

      const result: ScreenCaptureResult = {
        screenId,
        screenshot: screenshotPath,
        xml: xmlPath,
        timestamp: this.clock.now(),
        packageName,
        activityName,
      };

      this.logger.info('Screen capture complete', { screenId, packageName, activityName });
      return Result.ok(result);
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error('Screen capture failed', error, { screenId });
      }
      const message = error instanceof Error ? error.message : String(error);
      return Result.err(
        new ScreenCaptureServiceError(`Failed to capture screen "${screenId}": ${message}`),
      );
    }
  }
}
