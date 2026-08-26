import { ScreenshotManager } from '../../../../../src/application/use-cases/capture/ScreenshotManager';
import { ICaptureDriver } from '../../../../../src/application/interfaces/drivers/ICaptureDriver';
import { IFileWriter } from '../../../../../src/shared/fs/IFileWriter';
import { ScreenshotCaptureError } from '../../../../../src/core/errors/ScreenshotCaptureError';
import { ScreenshotSaveError } from '../../../../../src/core/errors/ScreenshotSaveError';
import { createMockLogger } from '../../../support/createMockLogger';

function createManager() {
  const captureDriver: jest.Mocked<ICaptureDriver> = {
    takeScreenshot: jest.fn(),
    getPageSource: jest.fn(),
    getCurrentPackage: jest.fn(),
    getCurrentActivity: jest.fn(),
  };
  const fileWriter: jest.Mocked<IFileWriter> = { write: jest.fn() };
  const logger = createMockLogger();
  const manager = new ScreenshotManager(captureDriver, fileWriter, logger);

  return { manager, captureDriver, fileWriter, logger };
}

describe('ScreenshotManager', () => {
  describe('capture', () => {
    it('returns the screenshot bytes from the capture driver', async () => {
      const { manager, captureDriver } = createManager();
      const buffer = Buffer.from([1, 2, 3]);
      captureDriver.takeScreenshot.mockResolvedValue(buffer);

      const result = await manager.capture();

      expect(result).toBe(buffer);
    });

    it('throws ScreenshotCaptureError when the driver fails', async () => {
      const { manager, captureDriver } = createManager();
      captureDriver.takeScreenshot.mockRejectedValue(new Error('no active session'));

      await expect(manager.capture()).rejects.toBeInstanceOf(ScreenshotCaptureError);
    });
  });

  describe('save', () => {
    it('writes the screenshot via the file writer and returns the path', async () => {
      const { manager, fileWriter } = createManager();
      const buffer = Buffer.from([1, 2, 3]);

      const savedPath = await manager.save(buffer, '/tmp/screens/abc.png');

      expect(fileWriter.write).toHaveBeenCalledWith('/tmp/screens/abc.png', buffer);
      expect(savedPath).toBe('/tmp/screens/abc.png');
    });

    it('throws ScreenshotSaveError when writing fails', async () => {
      const { manager, fileWriter } = createManager();
      fileWriter.write.mockRejectedValue(new Error('disk full'));

      await expect(manager.save(Buffer.from([1]), '/tmp/x.png')).rejects.toBeInstanceOf(
        ScreenshotSaveError,
      );
    });
  });
});
