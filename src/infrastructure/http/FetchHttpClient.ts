import { HttpRequestOptions, HttpResponse, IHttpClient } from '../../shared/http/IHttpClient';

/** Thin wrapper around Node's built-in fetch, with AbortController-based timeout support. */
export class FetchHttpClient implements IHttpClient {
  async request(options: HttpRequestOptions): Promise<HttpResponse> {
    const controller = new AbortController();
    const timeoutHandle = options.timeoutMs
      ? setTimeout(() => controller.abort(), options.timeoutMs)
      : null;

    try {
      const response = await fetch(options.url, {
        method: options.method,
        headers: options.headers,
        body: options.body,
        signal: controller.signal,
      });
      const body = await response.text();
      return { status: response.status, body };
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }
}
