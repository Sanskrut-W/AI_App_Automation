export interface ILogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error?: Error, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
  /** Returns a logger that automatically attaches `bindings` to every subsequent log line. */
  child(bindings: Record<string, unknown>): ILogger;
}
