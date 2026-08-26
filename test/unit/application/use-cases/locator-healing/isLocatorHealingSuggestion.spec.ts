import { isLocatorHealingSuggestion } from '../../../../../src/application/use-cases/locator-healing/isLocatorHealingSuggestion';

describe('isLocatorHealingSuggestion', () => {
  it('accepts a numeric matchIndex', () => {
    expect(isLocatorHealingSuggestion({ matchIndex: 2 })).toBe(true);
  });

  it('accepts a null matchIndex', () => {
    expect(isLocatorHealingSuggestion({ matchIndex: null })).toBe(true);
  });

  it('rejects a missing matchIndex', () => {
    expect(isLocatorHealingSuggestion({})).toBe(false);
  });

  it('rejects a non-numeric, non-null matchIndex', () => {
    expect(isLocatorHealingSuggestion({ matchIndex: '2' })).toBe(false);
  });

  it('rejects non-object values', () => {
    expect(isLocatorHealingSuggestion(null)).toBe(false);
    expect(isLocatorHealingSuggestion('nope')).toBe(false);
    expect(isLocatorHealingSuggestion(42)).toBe(false);
  });
});
