import { levenshteinDistance, textSimilarity } from '../../../../src/shared/text/textSimilarity';

describe('levenshteinDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshteinDistance('calculate', 'calculate')).toBe(0);
  });

  it('returns the length of the other string when one is empty', () => {
    expect(levenshteinDistance('', 'calculate')).toBe(9);
    expect(levenshteinDistance('calculate', '')).toBe(9);
  });

  it('counts single-character edits correctly', () => {
    expect(levenshteinDistance('cat', 'bat')).toBe(1);
    expect(levenshteinDistance('cat', 'cats')).toBe(1);
    expect(levenshteinDistance('cat', 'at')).toBe(1);
  });
});

describe('textSimilarity', () => {
  it('returns 1 for identical strings', () => {
    expect(textSimilarity('Calculate', 'Calculate')).toBe(1);
  });

  it('returns 0 when either string is empty', () => {
    expect(textSimilarity('', 'Calculate')).toBe(0);
    expect(textSimilarity('Calculate', '')).toBe(0);
  });

  it('returns a high but imperfect score for near-identical strings', () => {
    const score = textSimilarity('Calculate', 'Calculatee');

    expect(score).toBeGreaterThan(0.8);
    expect(score).toBeLessThan(1);
  });

  it('returns a low score for very different strings', () => {
    const score = textSimilarity('Calculate', 'Settings menu');

    expect(score).toBeLessThan(0.3);
  });
});
