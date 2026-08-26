/** Infra-level transport failure, carrying whether the retry loop should try again. Converted to a GeminiClientError at the client boundary. */
export class GeminiRequestError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'GeminiRequestError';
    Object.setPrototypeOf(this, GeminiRequestError.prototype);
  }
}
