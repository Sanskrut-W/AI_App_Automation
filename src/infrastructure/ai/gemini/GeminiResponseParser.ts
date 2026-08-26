import { GeminiResponseParsingError } from '../../../core/errors/GeminiResponseParsingError';
import { IGeminiResponseParser } from './IGeminiResponseParser';

export class GeminiResponseParser implements IGeminiResponseParser {
  parse<T>(rawResponseBody: string): T {
    let envelope: unknown;
    try {
      envelope = JSON.parse(rawResponseBody);
    } catch (error) {
      throw new GeminiResponseParsingError(
        `Gemini response was not valid JSON: ${this.describe(error)}`,
      );
    }

    const text = this.extractText(envelope);
    if (text === null) {
      throw new GeminiResponseParsingError('Gemini response did not contain any candidate text.');
    }

    try {
      return JSON.parse(text) as T;
    } catch (error) {
      throw new GeminiResponseParsingError(
        `Gemini returned non-JSON content in its response text: ${this.describe(error)}`,
      );
    }
  }

  private extractText(envelope: unknown): string | null {
    if (!this.isRecord(envelope)) {
      return null;
    }
    const candidates = envelope.candidates;
    if (!Array.isArray(candidates) || candidates.length === 0) {
      return null;
    }

    const first: unknown = candidates[0];
    if (!this.isRecord(first) || !this.isRecord(first.content)) {
      return null;
    }

    const parts = first.content.parts;
    if (!Array.isArray(parts) || parts.length === 0) {
      return null;
    }

    const firstPart: unknown = parts[0];
    if (!this.isRecord(firstPart) || typeof firstPart.text !== 'string') {
      return null;
    }

    return firstPart.text;
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
  }

  private describe(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
