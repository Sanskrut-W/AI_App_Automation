import { Result } from '../../../../src/shared/result/Result';

describe('Result', () => {
  it('isOk()/isErr() reflect the constructed variant', () => {
    expect(Result.ok(1).isOk()).toBe(true);
    expect(Result.ok(1).isErr()).toBe(false);
    expect(Result.err('boom').isOk()).toBe(false);
    expect(Result.err('boom').isErr()).toBe(true);
  });

  it('unwrap() returns the value for Ok', () => {
    expect(Result.ok(42).unwrap()).toBe(42);
  });

  it('unwrap() throws the error for Err', () => {
    const error = new Error('failure');
    expect(() => Result.err(error).unwrap()).toThrow(error);
  });

  it('unwrap() wraps a non-Error value in a new Error', () => {
    expect(() => Result.err('plain string reason').unwrap()).toThrow(/plain string reason/);
  });

  it('unwrapErr() returns the error for Err', () => {
    expect(Result.err('boom').unwrapErr()).toBe('boom');
  });

  it('unwrapErr() throws when called on Ok', () => {
    expect(() => Result.ok(1).unwrapErr()).toThrow('Called unwrapErr() on an Ok result');
  });

  it('map() transforms the value for Ok and is a no-op for Err', () => {
    expect(
      Result.ok(2)
        .map((n) => n * 2)
        .unwrap(),
    ).toBe(4);
    expect(
      Result.err<number, string>('boom')
        .map((n) => n * 2)
        .unwrapErr(),
    ).toBe('boom');
  });

  it('mapErr() transforms the error for Err and is a no-op for Ok', () => {
    expect(
      Result.err<number, string>('boom')
        .mapErr((e) => e.toUpperCase())
        .unwrapErr(),
    ).toBe('BOOM');
    expect(
      Result.ok<number, string>(5)
        .mapErr((e) => e.toUpperCase())
        .unwrap(),
    ).toBe(5);
  });
});
