import { GeminiResponseParser } from '../../../../../src/infrastructure/ai/gemini/GeminiResponseParser';
import { GeminiResponseParsingError } from '../../../../../src/core/errors/GeminiResponseParsingError';

function envelope(text: string): string {
  return JSON.stringify({
    candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP' }],
  });
}

describe('GeminiResponseParser', () => {
  it('extracts and parses the JSON embedded in the candidate text', () => {
    const parser = new GeminiResponseParser();
    const raw = envelope(JSON.stringify({ screenName: 'Home', purpose: 'Landing screen' }));

    const result = parser.parse<{ screenName: string; purpose: string }>(raw);

    expect(result).toEqual({ screenName: 'Home', purpose: 'Landing screen' });
  });

  it('throws GeminiResponseParsingError when the outer response is not valid JSON', () => {
    const parser = new GeminiResponseParser();

    expect(() => parser.parse('not json at all')).toThrow(GeminiResponseParsingError);
  });

  it('throws GeminiResponseParsingError when there are no candidates', () => {
    const parser = new GeminiResponseParser();

    expect(() => parser.parse(JSON.stringify({ candidates: [] }))).toThrow(
      GeminiResponseParsingError,
    );
  });

  it('throws GeminiResponseParsingError when candidates is missing entirely', () => {
    const parser = new GeminiResponseParser();

    expect(() => parser.parse(JSON.stringify({}))).toThrow(GeminiResponseParsingError);
  });

  it('throws GeminiResponseParsingError when the candidate text is free-text, not JSON', () => {
    const parser = new GeminiResponseParser();
    const raw = envelope('Sure! This screen appears to be a login page.');

    expect(() => parser.parse(raw)).toThrow(GeminiResponseParsingError);
  });

  it('throws GeminiResponseParsingError when content.parts is missing', () => {
    const parser = new GeminiResponseParser();
    const raw = JSON.stringify({ candidates: [{ content: {} }] });

    expect(() => parser.parse(raw)).toThrow(GeminiResponseParsingError);
  });
});
