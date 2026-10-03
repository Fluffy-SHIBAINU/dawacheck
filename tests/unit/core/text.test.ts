import { collapseWs, decodeEntities, levenshtein, normalizeText, similarity } from '../../../src/core/text';

describe('normalizeText', () => {
  it('uppercases, unifies dashes and joins spaced hyphens', () => {
    expect(normalizeText('nafdac reg. no. a4 – 6238')).toBe('NAFDAC REG. NO. A4-6238');
    expect(normalizeText('A4—6238')).toBe('A4-6238');
    expect(normalizeText('line one\r\nline   two')).toBe('LINE ONE\nLINE TWO');
  });
});

describe('collapseWs', () => {
  it('collapses all whitespace including newlines', () => {
    expect(collapseWs('Tablet\r\nYellow   colored ')).toBe('Tablet Yellow colored');
  });
});

describe('decodeEntities', () => {
  it('decodes numeric and named entities', () => {
    expect(decodeEntities('1 x 500&#039;s')).toBe("1 x 500's");
    expect(decodeEntities('A &amp; B &#8211; C')).toBe('A & B – C');
    expect(decodeEntities('&lt;b&gt; &quot;x&quot;')).toBe('<b> "x"');
  });
});

describe('levenshtein and similarity', () => {
  it('computes edit distance', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('same', 'same')).toBe(0);
  });
  it('computes similarity between 0 and 1', () => {
    expect(similarity('ARTHEGET', 'ARTHEGET')).toBe(1);
    expect(similarity('ARTHEGET', 'ARTHEGFT')).toBeCloseTo(0.875, 3);
    expect(similarity('', '')).toBe(1);
    expect(similarity('MALAQUICK', 'ARTHEGET')).toBeLessThan(0.5);
  });
});
