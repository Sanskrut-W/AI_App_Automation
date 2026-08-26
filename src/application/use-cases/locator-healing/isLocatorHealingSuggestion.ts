import { LocatorHealingSuggestion } from '../../dto/LocatorHealingSuggestion';

/** Schema validation for Gemini's locator-healing JSON — rejects anything short of the exact expected shape. */
export function isLocatorHealingSuggestion(value: unknown): value is LocatorHealingSuggestion {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;
  return candidate.matchIndex === null || typeof candidate.matchIndex === 'number';
}
