/** verbatim is the load-bearing check: the reader never meets the invented
 * number. Substring containment cannot carry that, because the most likely
 * shape of a real numeric hallucination is a digit-substring of something
 * that IS on the page. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IDENTIFIER_PATTERNS, fabricatedIn, identifiersIn } from '../src/evidence.ts';
import type { Evidence } from '../src/evidence.ts';
import { rule } from '../src/ruling.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LEDGER = 'account led-4471 made 128 transfers on 2026-03-01';

test('a fabricated number that is a substring of a real one is still fabricated', () => {
  assert.deepEqual(fabricatedIn('the account made 47 transfers', LEDGER), ['47']);
  assert.deepEqual(fabricatedIn('exactly 12 transfers', LEDGER), ['12']);
  assert.deepEqual(fabricatedIn('account led-447 was involved', LEDGER), ['led-447']);
  assert.deepEqual(fabricatedIn('on 2026-03-02 the review ran', LEDGER), ['2026-03-02']);
  // A truncated date is not a date, so the extractor sees its parts - and
  // each part is reported, because each occurs only inside the real date.
  assert.deepEqual(fabricatedIn('on 2026-03-0 the review ran', LEDGER), ['2026', '03']);
});

test('the digit-substring escape dies at verbatim end to end, token named', () => {
  const evidence: Evidence[] = [{ id: 'ev-ledger', text: LEDGER }];
  const ruling = rule([{ text: 'the account made 47 transfers', cites: ['ev-ledger'] }], evidence);
  assert.equal(ruling.verdicts[0].status, 'rejected');
  assert.equal(ruling.verdicts[0].failedCheck, 'verbatim');
  assert.equal(ruling.verdicts[0].code, 'verbatim/fabricated-token');
  assert.match(ruling.verdicts[0].reason!, /47/);
});

test('normalisation is pinned: separators, trailing zeros and case are not fabrication', () => {
  assert.deepEqual(fabricatedIn('1,280 transfers', 'the ledger records 1280 transfers'), []);
  assert.deepEqual(fabricatedIn('1280 transfers', 'the ledger records 1,280 transfers'), []);
  assert.deepEqual(fabricatedIn('128.00 transfers', 'the ledger records 128 transfers'), []);
  assert.deepEqual(fabricatedIn('128 transfers', 'the ledger records 128.0 transfers'), []);
  assert.deepEqual(fabricatedIn('account LED-4471', LEDGER), []);
  assert.deepEqual(fabricatedIn('TX99 cleared', 'code tx99 cleared'), []);
});

test('structured evidence values count as corpus, exactly as before', () => {
  const evidence: Evidence[] = [
    { id: 'ev', text: 'the march ledger', data: { total: 128, ref: 'led-4471' } }
  ];
  const ruling = rule(
    [{ text: 'led-4471 made 128 transfers', cites: ['ev'] }],
    evidence
  );
  assert.equal(ruling.verdicts[0].status, 'accepted');
});

test('identifier extraction stays linear on input built to make its patterns backtrack', () => {
  const inputs: Record<string, string> = {
    'a caps code whose digit run ends in a lowercase letter': 'AA' + '0'.repeat(50_000) + 'a',
    'a caps code whose digit run ends in an underscore': 'AA' + '0'.repeat(50_000) + '_',
    'hyphenated words with no digit': 'a-'.repeat(25_000),
    'underscore-and-hyphen words with no digit': 'a_-'.repeat(17_000),
    'double-hyphenated words with no digit': 'a--'.repeat(17_000)
  };
  const slow: string[] = [];
  for (const [shape, text] of Object.entries(inputs)) {
    const started = performance.now();
    identifiersIn(text);
    const elapsed = performance.now() - started;
    if (elapsed >= 250) slow.push(`${shape}: ${Math.round(elapsed)} ms`);
  }
  assert.deepEqual(slow, []);
});

const BACKTRACKING_PATTERNS: ReadonlyArray<RegExp> = [
  /\d{4}-\d{2}-\d{2}/g,
  /\b[a-z]+[-_][a-z0-9_-]*\d[a-z0-9_-]*\b/gi,
  /\b[A-Z]{2,}\d+[A-Z0-9]*\b/g,
  /\b\d[\d,.]+\b/g
];

const stringsIn = (value: unknown): string[] =>
  typeof value === 'string'
    ? [value]
    : value !== null && typeof value === 'object'
      ? Object.values(value).flatMap(stringsIn)
      : [];

const repositoryInputs = (): string[] => {
  const fixtures = path.join(ROOT, 'test', 'fixtures');
  const fromFixtures = readdirSync(fixtures).flatMap((file) =>
    stringsIn(JSON.parse(readFileSync(path.join(fixtures, file), 'utf8')))
  );
  const files = [
    'README.md',
    'CLAIMS.md',
    ...readdirSync(path.join(ROOT, 'src')).map((file) => path.join('src', file)),
    ...readdirSync(path.join(ROOT, 'test'))
      .filter((file) => file.endsWith('.ts'))
      .map((file) => path.join('test', file))
  ];
  return [...fromFixtures, ...files.map((file) => readFileSync(path.join(ROOT, file), 'utf8'))];
};

const fuzzInputs = (count: number): string[] => {
  let state = 0x2545f491;
  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
  const symbols = [...'abzAQZ0159_- .,;/\né', 'led', 'TX', 'AB', '4471', '2026-03-01', '--', '_-'];
  return Array.from({ length: count }, () => {
    let text = '';
    for (let n = Math.floor(next() * 32); n > 0; n--) text += symbols[Math.floor(next() * symbols.length)];
    return text;
  });
};

const everyShortString = (alphabet: string[], maxLength: number): string[] => {
  const out = [''];
  for (let start = 0; out[start].length < maxLength; start++) {
    for (const symbol of alphabet) out.push(out[start] + symbol);
  }
  return out;
};

test('the linear identifier patterns match exactly what the backtracking ones matched', () => {
  assert.equal(IDENTIFIER_PATTERNS.length, BACKTRACKING_PATTERNS.length);
  const corpus = [
    ...repositoryInputs(),
    ...fuzzInputs(50_000),
    ...everyShortString(['a', 'B', '0', '_', '-', ' ', '.'], 6)
  ];
  const matches = (pattern: RegExp, text: string): string =>
    JSON.stringify([...text.matchAll(pattern)].map((m) => [m.index, m[0]]));
  for (const text of corpus) {
    BACKTRACKING_PATTERNS.forEach((oracle, i) => {
      const expected = matches(oracle, text);
      const actual = matches(IDENTIFIER_PATTERNS[i], text);
      if (actual !== expected) assert.equal(actual, expected, `pattern ${i} on ${JSON.stringify(text)}`);
    });
  }
});
