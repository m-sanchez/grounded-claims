/** verbatim is the load-bearing check: the reader never meets the invented
 * number. Substring containment cannot carry that, because the most likely
 * shape of a real numeric hallucination is a digit-substring of something
 * that IS on the page. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fabricatedIn } from '../src/evidence.ts';
import type { Evidence } from '../src/evidence.ts';
import { rule } from '../src/ruling.ts';

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
