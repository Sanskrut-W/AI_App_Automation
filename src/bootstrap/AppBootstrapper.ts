import { EnvConfigProvider } from '../shared/config/EnvConfigProvider';
import { IConfigProvider } from '../shared/config/IConfigProvider';
import { ILogger } from '../shared/logger/ILogger';
import { WinstonLogger } from '../infrastructure/logging/WinstonLogger';

export interface BootstrappedEnvironment {
  config: IConfigProvider;
  logger: ILogger;
}

// Populated as later modules introduce required settings (e.g. "ai.geminiApiKey").
const REQUIRED_CONFIG_KEYS: string[] = [];

/**
 * Composition root for environment concerns: loads + validates config, then
 * constructs the logger from it. Fails fast if a required key is missing.
 */
export function bootstrap(): BootstrappedEnvironment {
  const config = new EnvConfigProvider({ requiredKeys: REQUIRED_CONFIG_KEYS });
  config.validate();

  const logger = WinstonLogger.create({
    level: config.getOrDefault('logging.level', 'info'),
  });

  logger.info('Application environment initialized successfully', {
    environment: process.env.NODE_ENV ?? 'development',
  });

  return { config, logger };
}
