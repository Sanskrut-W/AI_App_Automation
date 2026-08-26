import { FetchHttpClient } from '../../../../src/infrastructure/http/FetchHttpClient';

describe('FetchHttpClient', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it('sends the request and returns the status and body text', async () => {
    fetchMock.mockResolvedValue({ status: 200, text: jest.fn().mockResolvedValue('{"ok":true}') });
    const client = new FetchHttpClient();

    const result = await client.request({
      url: 'https://example.com/api',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });

    expect(result).toEqual({ status: 200, body: '{"ok":true}' });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/api',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }),
    );
  });

  it('rejects when the request aborts after timeoutMs elapses', async () => {
    fetchMock.mockImplementation((_url: string, init: RequestInit) => {
      return new Promise((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      });
    });
    const client = new FetchHttpClient();

    await expect(
      client.request({ url: 'https://example.com/api', method: 'POST', timeoutMs: 10 }),
    ).rejects.toThrow();
  });

  it('does not set up an abort timer when no timeoutMs is provided', async () => {
    fetchMock.mockResolvedValue({ status: 200, text: jest.fn().mockResolvedValue('ok') });
    const client = new FetchHttpClient();

    await expect(
      client.request({ url: 'https://example.com/api', method: 'GET' }),
    ).resolves.toEqual({
      status: 200,
      body: 'ok',
    });
  });
});
