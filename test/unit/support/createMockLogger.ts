import { ILogger } from '../../../src/shared/logger/ILogger';

/** A jest.fn()-backed ILogger for asserting on log calls without touching Winston/the filesystem. */
export function createMockLogger(): jest.Mocked<ILogger> {
  const logger: jest.Mocked<ILogger> = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn(),
  };
  logger.child.mockReturnValue(logger);
  return logger;
}
