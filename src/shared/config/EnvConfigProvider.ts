import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { IConfigProvider } from './IConfigProvider';
import { ConfigValidationError } from './ConfigValidationError';

type ConfigObject = Record<string, unknown>;

export interface EnvConfigProviderOptions {
  /** Directory containing default.json / {NODE_ENV}.json. Defaults to "<cwd>/config". */
  configDir?: string;
  /** Dot-path keys (e.g. "logging.level") that must resolve to a value during validate(). */
  requiredKeys?: string[];
  /** Path to a specific .env file. Defaults to dotenv's standard ".env" lookup. */
  envFilePath?: string;
}

/**
 * Layered configuration: environment variables override "config/{NODE_ENV}.json",
 * which overrides "config/default.json". A dot-path key (e.g. "logging.level") maps
 * to an env var override of "LOGGING_LEVEL".
 */
export class EnvConfigProvider implements IConfigProvider {
  private readonly config: ConfigObject;
  private readonly requiredKeys: string[];

  constructor(options: EnvConfigProviderOptions = {}) {
    dotenv.config({ path: options.envFilePath });

    const configDir = options.configDir ?? path.resolve(process.cwd(), 'config');
    const environment = process.env.NODE_ENV ?? 'development';

    const defaults = this.readJsonFile(path.join(configDir, 'default.json'));
    const envSpecific = this.readJsonFile(path.join(configDir, `${environment}.json`));

    this.config = this.deepMerge(defaults, envSpecific);
    this.requiredKeys = options.requiredKeys ?? [];
  }

  get<T>(key: string): T {
    const value = this.resolve(key);
    if (value === undefined) {
      throw new ConfigValidationError(`Missing required configuration key: "${key}"`);
    }
    return value as T;
  }

  getOrDefault<T>(key: string, defaultValue: T): T {
    const value = this.resolve(key);
    return value === undefined ? defaultValue : (value as T);
  }

  validate(): void {
    const missing = this.requiredKeys.filter((key) => this.resolve(key) === undefined);
    if (missing.length > 0) {
      throw new ConfigValidationError(
        `Missing required configuration keys: ${missing.join(', ')}. ` +
          'Check your .env file and config/*.json files.',
      );
    }
  }

  private resolve(key: string): unknown {
    const envKey = key.toUpperCase().replace(/\./g, '_');
    if (process.env[envKey] !== undefined) {
      return process.env[envKey];
    }

    return key.split('.').reduce<unknown>((acc, segment) => {
      if (acc !== null && typeof acc === 'object' && segment in (acc as ConfigObject)) {
        return (acc as ConfigObject)[segment];
      }
      return undefined;
    }, this.config);
  }

  private readJsonFile(filePath: string): ConfigObject {
    if (!fs.existsSync(filePath)) {
      return {};
    }
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as ConfigObject;
  }

  private deepMerge(base: ConfigObject, override: ConfigObject): ConfigObject {
    const result: ConfigObject = { ...base };

    for (const [key, value] of Object.entries(override)) {
      const baseValue = result[key];
      const bothPlainObjects =
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        baseValue !== null &&
        typeof baseValue === 'object' &&
        !Array.isArray(baseValue);

      result[key] = bothPlainObjects
        ? this.deepMerge(baseValue as ConfigObject, value as ConfigObject)
        : value;
    }

    return result;
  }
}
