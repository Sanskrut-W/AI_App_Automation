/** Base for expected, recoverable domain failures — surfaced via Result<T, E>, never thrown across a use-case boundary. */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = new.target.name;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
