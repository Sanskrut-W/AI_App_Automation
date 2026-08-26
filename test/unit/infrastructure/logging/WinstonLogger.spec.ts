import fs from 'fs';
import os from 'os';
import path from 'path';
import { WinstonLogger } from '../../../../src/infrastructure/logging/WinstonLogger';
import { pollUntil } from '../../../../src/shared/utils/poll';

describe('WinstonLogger', () => {
  let logDir: string;

  beforeEach(() => {
    logDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wtl-test-'));
  });

  afterEach(() => {
    fs.rmSync(logDir, { recursive: true, force: true });
  });

  it('creates the log directory and writes to combined.log', async () => {
    const logger = WinstonLogger.create({ logDir, console: false });
    const combinedLogPath = path.join(logDir, 'combined.log');

    logger.info('hello world');

    // Winston's file transport flushes asynchronously; poll instead of a fixed delay so this
    // isn't flaky under system load (a fixed 100ms wait was observed to take 123ms once).
    const written = await pollUntil(
      async () =>
        fs.existsSync(combinedLogPath) && fs.statSync(combinedLogPath).size > 0 ? true : null,
      { timeoutMs: 2000, intervalMs: 20 },
    );

    expect(written).toBe(true);
  });

  it('does not throw when logging at any level', () => {
    const logger = WinstonLogger.create({ logDir, console: false });

    expect(() => {
      logger.info('info message');
      logger.warn('warn message');
      logger.debug('debug message');
      logger.error('error message', new Error('boom'));
    }).not.toThrow();
  });

  it('produces a child logger that also implements ILogger', () => {
    const logger = WinstonLogger.create({ logDir, console: false });
    const child = logger.child({ runId: 'run-123' });

    expect(() => child.info('child log line')).not.toThrow();
    expect(typeof child.child).toBe('function');
  });
});
