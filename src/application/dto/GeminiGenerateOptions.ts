export interface GeminiImageInput {
  mimeType: string;
  /** Base64-encoded image bytes (no data: URI prefix). */
  data: string;
}

export interface GeminiGenerateOptions {
  prompt: string;
  systemInstruction?: string;
  images?: GeminiImageInput[];
}
