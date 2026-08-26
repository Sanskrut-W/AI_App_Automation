import { GeminiGenerateOptions } from '../../../application/dto/GeminiGenerateOptions';

/** Builds the exact request body Gemini's generateContent endpoint expects. Gemini-specific — not a generic "any AI provider" abstraction. */
export interface IGeminiPromptBuilder {
  build(options: GeminiGenerateOptions): string;
}
