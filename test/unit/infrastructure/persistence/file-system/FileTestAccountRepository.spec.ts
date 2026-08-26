import { FileTestAccountRepository } from '../../../../../src/infrastructure/persistence/file-system/FileTestAccountRepository';
import { IFileReader } from '../../../../../src/shared/fs/IFileReader';
import { createMockLogger } from '../../../support/createMockLogger';

function createMocks() {
  const fileReader: jest.Mocked<IFileReader> = {
    read: jest.fn(),
    readBinary: jest.fn(),
  };
  const logger = createMockLogger();
  return { fileReader, logger };
}

const FILE_PATH = 'config/test-accounts.json';

describe('FileTestAccountRepository', () => {
  it('returns the account for a known package name', async () => {
    const mocks = createMocks();
    mocks.fileReader.read.mockResolvedValue(
      JSON.stringify({
        'com.betwayafrica.za': { mobileNumber: '0000000000', password: 'fake-password' },
      }),
    );
    const repository = new FileTestAccountRepository(mocks.fileReader, mocks.logger, FILE_PATH);

    const account = await repository.findByPackageName('com.betwayafrica.za');

    expect(account).toEqual({ mobileNumber: '0000000000', password: 'fake-password' });
    expect(mocks.fileReader.read).toHaveBeenCalledWith(FILE_PATH);
  });

  it('returns null and logs a warning when the package has no configured account', async () => {
    const mocks = createMocks();
    mocks.fileReader.read.mockResolvedValue(
      JSON.stringify({ 'com.other.app': { mobileNumber: '1', password: '2' } }),
    );
    const repository = new FileTestAccountRepository(mocks.fileReader, mocks.logger, FILE_PATH);

    const account = await repository.findByPackageName('com.betwayafrica.za');

    expect(account).toBeNull();
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'No test account configured for this package',
      expect.objectContaining({ packageName: 'com.betwayafrica.za' }),
    );
  });

  it('returns null and logs a warning (not throw) when the file does not exist', async () => {
    const mocks = createMocks();
    mocks.fileReader.read.mockRejectedValue(new Error('ENOENT: no such file or directory'));
    const repository = new FileTestAccountRepository(mocks.fileReader, mocks.logger, FILE_PATH);

    const account = await repository.findByPackageName('com.betwayafrica.za');

    expect(account).toBeNull();
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'Failed to read the test accounts file',
      expect.objectContaining({ filePath: FILE_PATH }),
    );
  });

  it('returns null and logs a warning (not throw) when the file contains invalid JSON', async () => {
    const mocks = createMocks();
    mocks.fileReader.read.mockResolvedValue('{ not valid json');
    const repository = new FileTestAccountRepository(mocks.fileReader, mocks.logger, FILE_PATH);

    const account = await repository.findByPackageName('com.betwayafrica.za');

    expect(account).toBeNull();
    expect(mocks.logger.warn).toHaveBeenCalledWith(
      'Failed to read the test accounts file',
      expect.anything(),
    );
  });
});
