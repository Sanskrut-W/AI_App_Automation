/**
 * Represents an expected success/failure outcome without throwing. Use for recoverable
 * domain failures (e.g. "APK invalid", "app not installed"); let genuine bugs throw instead.
 */
export class Result<T, E> {
  private constructor(
    private readonly ok: boolean,
    private readonly value?: T,
    private readonly error?: E,
  ) {}

  static ok<T, E = never>(value: T): Result<T, E> {
    return new Result<T, E>(true, value, undefined);
  }

  static err<T = never, E = unknown>(error: E): Result<T, E> {
    return new Result<T, E>(false, undefined, error);
  }

  isOk(): boolean {
    return this.ok;
  }

  isErr(): boolean {
    return !this.ok;
  }

  unwrap(): T {
    if (!this.ok) {
      throw this.error instanceof Error
        ? this.error
        : new Error(`Called unwrap() on an Err result: ${String(this.error)}`);
    }
    return this.value as T;
  }

  unwrapErr(): E {
    if (this.ok) {
      throw new Error('Called unwrapErr() on an Ok result');
    }
    return this.error as E;
  }

  map<U>(fn: (value: T) => U): Result<U, E> {
    return this.ok ? Result.ok(fn(this.value as T)) : Result.err(this.error as E);
  }

  mapErr<F>(fn: (error: E) => F): Result<T, F> {
    return this.ok ? Result.ok(this.value as T) : Result.err(fn(this.error as E));
  }
}
