export interface HttpRequestOptions {
  url: string;
  method: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

export interface HttpResponse {
  status: number;
  body: string;
}

export interface IHttpClient {
  request(options: HttpRequestOptions): Promise<HttpResponse>;
}
