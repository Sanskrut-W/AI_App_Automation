import fs from 'fs';
import path from 'path';
import winston from 'winston';
import { ILogger } from '../../shared/logger/ILogger';
import { redactSensitiveData } from './redactFormat';

export interface WinstonLoggerOptions {
  level?: string;
  logDir?: string;
  console?: boolean;
}

function buildWinstonLogger(options: WinstonLoggerOptions): winston.Logger {
  const logDir = options.logDir ?? path.resolve(process.cwd(), 'logs');
  fs.mkdirSync(logDir, { recursive: true });

  const baseFormat = winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    redactSensitiveData(),
  );

  const transports: winston.transport[] = [
    new winston.transports.File({
      filename: path.join(logDir, 'combined.log'),
      format: winston.format.combine(baseFormat, winston.format.json()),
    }),
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      level: 'error',
      format: winston.format.combine(baseFormat, winston.format.json()),
    }),
  ];

  if (options.console ?? true) {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          baseFormat,
          winston.format.colorize(),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const rest = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
            return `[${String(timestamp)}] ${level}: ${String(message)}${rest}`;
          }),
        ),
      }),
    );
  }

  return winston.createLogger({
    level: options.level ?? 'info',
    format: baseFormat,
    transports,
  });
}

/** ILogger adapter backed by Winston. Construct via {@link WinstonLogger.create}. */
export class WinstonLogger implements ILogger {
  private constructor(private readonly logger: winston.Logger) {}

  static create(options: WinstonLoggerOptions = {}): WinstonLogger {
    return new WinstonLogger(buildWinstonLogger(options));
  }

  info(message: string, meta: Record<string, unknown> = {}): void {
    this.logger.info(message, meta);
  }

  warn(message: string, meta: Record<string, unknown> = {}): void {
    this.logger.warn(message, meta);
  }

  error(message: string, error?: Error, meta: Record<string, unknown> = {}): void {
    this.logger.error(message, { ...meta, errorMessage: error?.message, stack: error?.stack });
  }

  debug(message: string, meta: Record<string, unknown> = {}): void {
    this.logger.debug(message, meta);
  }

  child(bindings: Record<string, unknown>): ILogger {
    return new WinstonLogger(this.logger.child(bindings));
  }
}
