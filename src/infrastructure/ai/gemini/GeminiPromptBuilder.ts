import { GeminiGenerateOptions } from '../../../application/dto/GeminiGenerateOptions';
import { IGeminiPromptBuilder } from './IGeminiPromptBuilder';

/** Always requests application/json — the mechanism that stops Gemini from returning free text. */
export class GeminiPromptBuilder implements IGeminiPromptBuilder {
  build(options: GeminiGenerateOptions): string {
    const parts: unknown[] = [{ text: options.prompt }];
    for (const image of options.images ?? []) {
      parts.push({ inlineData: { mimeType: image.mimeType, data: image.data } });
    }

    const body: Record<string, unknown> = {
      contents: [
        {
          role: 'user',
          parts,
        },
      ],
      generationConfig: {
        responseMimeType: 'application/json',
      },
    };

    if (options.systemInstruction) {
      body.systemInstruction = {
        role: 'system',
        parts: [{ text: options.systemInstruction }],
      };
    }

    return JSON.stringify(body);
  }
}
