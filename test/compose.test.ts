import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ComposeIntegrityError, compose } from '../src/compose.ts';
import type { Evidence } from '../src/evidence.ts';
import { rule } from '../src/ruling.ts';

const EVIDENCE: Evidence[] = [
  { id: 'ev-ledger', text: 'account led-4471 made 128 transfers', data: { total: 128 } },
  { id: 'ev-review', text: 'the review cleared account led-4471' }
];

test('only accepted claims appear, and the disclosure counts everything', () => {
  const ruling = rule(
    [
      { text: 'account led-4471 made 128 transfers', cites: ['ev-ledger'] },
      { text: 'account led-2222 was hidden', cites: ['ev-ledger'] }
    ],
    EVIDENCE
  );
  const md = compose(ruling, EVIDENCE, { title: 'Ledger review' });
  assert.match(md, /128 transfers/);
  assert.ok(!md.includes('led-2222'));
  assert.match(md, /disclosure: 1 claim\(s\) grounded, 1 rejected; checks: citations, verbatim/);
});

test('an insufficient ruling composes its refusal, never an empty page', () => {
  const ruling = rule([{ text: 'led-9999 acted alone', cites: ['ev-ledger'] }], EVIDENCE);
  const md = compose(ruling, EVIDENCE);
  assert.match(md, /declined, not composed/);
  assert.ok(!md.includes('led-9999 acted alone ['));
});

test('a contested ruling carries its marker above the survivors', () => {
  const ruling = rule(
    [
      { text: 'the review cleared account led-4471', cites: ['ev-review'] },
      { text: 'led-1111 was there', cites: ['ev-ledger'] },
      { text: '777 transfers', cites: ['ev-ledger'] }
    ],
    EVIDENCE
  );
  const md = compose(ruling, EVIDENCE);
  assert.match(md, /> contested: 2 of 3/);
});

test('a claim edited after ruling dies at the composer, not on the page', () => {
  const ruling = rule(
    [{ text: 'account led-4471 made 128 transfers', cites: ['ev-ledger'] }],
    EVIDENCE
  );
  ruling.accepted[0].claim.text = 'account led-4471 made 128 transfers to acct-6606';
  assert.throws(
    () => compose(ruling, EVIDENCE),
    (err: unknown) =>
      err instanceof ComposeIntegrityError && /acct-6606/.test(err.message)
  );
});

test('evidence swapped out from under an accepted claim also dies at compose', () => {
  const ruling = rule(
    [{ text: 'account led-4471 made 128 transfers', cites: ['ev-ledger'] }],
    EVIDENCE
  );
  assert.throws(
    () => compose(ruling, [EVIDENCE[1]]),
    (err: unknown) => err instanceof ComposeIntegrityError && /cannot resolve/.test(err.message)
  );
});
