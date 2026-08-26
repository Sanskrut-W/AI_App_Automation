/** Extracts and parses the generated JSON out of Gemini's response envelope. Throws GeminiResponseParsingError if anything short of well-formed JSON comes back — enforces "never free text" on the way in, not just on the way out. */
export interface IGeminiResponseParser {
  parse<T>(rawResponseBody: string): T;
}
