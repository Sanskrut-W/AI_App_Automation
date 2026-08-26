export interface IConfigProvider {
  get<T>(key: string): T;
  getOrDefault<T>(key: string, defaultValue: T): T;
  validate(): void;
}
