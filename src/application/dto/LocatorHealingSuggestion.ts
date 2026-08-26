export interface LocatorHealingSuggestion {
  /** Index into the candidates array the AI believes is the best match, or null if none look right. */
  matchIndex: number | null;
}
