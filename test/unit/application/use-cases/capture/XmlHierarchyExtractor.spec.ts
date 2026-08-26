import { XmlHierarchyExtractor } from '../../../../../src/application/use-cases/capture/XmlHierarchyExtractor';
import { ICaptureDriver } from '../../../../../src/application/interfaces/drivers/ICaptureDriver';
import { IFileWriter } from '../../../../../src/shared/fs/IFileWriter';
import { XmlCaptureError } from '../../../../../src/core/errors/XmlCaptureError';
import { XmlSaveError } from '../../../../../src/core/errors/XmlSaveError';
import { createMockLogger } from '../../../support/createMockLogger';

function createExtractor() {
  const captureDriver: jest.Mocked<ICaptureDriver> = {
    takeScreenshot: jest.fn(),
    getPageSource: jest.fn(),
    getCurrentPackage: jest.fn(),
    getCurrentActivity: jest.fn(),
  };
  const fileWriter: jest.Mocked<IFileWriter> = { write: jest.fn() };
  const logger = createMockLogger();
  const extractor = new XmlHierarchyExtractor(captureDriver, fileWriter, logger);

  return { extractor, captureDriver, fileWriter, logger };
}

describe('XmlHierarchyExtractor', () => {
  describe('capture', () => {
    it('returns the XML hierarchy string from the capture driver', async () => {
      const { extractor, captureDriver } = createExtractor();
      captureDriver.getPageSource.mockResolvedValue('<hierarchy/>');

      const result = await extractor.capture();

      expect(result).toBe('<hierarchy/>');
    });

    it('throws XmlCaptureError when the driver fails', async () => {
      const { extractor, captureDriver } = createExtractor();
      captureDriver.getPageSource.mockRejectedValue(new Error('no active session'));

      await expect(extractor.capture()).rejects.toBeInstanceOf(XmlCaptureError);
    });
  });

  describe('save', () => {
    it('writes the XML via the file writer and returns the path', async () => {
      const { extractor, fileWriter } = createExtractor();

      const savedPath = await extractor.save('<hierarchy/>', '/tmp/xml/abc.xml');

      expect(fileWriter.write).toHaveBeenCalledWith('/tmp/xml/abc.xml', '<hierarchy/>');
      expect(savedPath).toBe('/tmp/xml/abc.xml');
    });

    it('throws XmlSaveError when writing fails', async () => {
      const { extractor, fileWriter } = createExtractor();
      fileWriter.write.mockRejectedValue(new Error('disk full'));

      await expect(extractor.save('<hierarchy/>', '/tmp/x.xml')).rejects.toBeInstanceOf(
        XmlSaveError,
      );
    });
  });
});
