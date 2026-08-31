import { test } from 'node:test';
import assert from 'node:assert/strict';
import { citations, judge, support, verbatim } from '../src/checks.ts';
import { identifiersIn } from '../src/evidence.ts';
import type { Evidence } from '../src/evidence.ts';
import { rule } from '../src/ruling.ts';

const EVIDENCE: Evidence[] = [
  { id: 'ev-ledger', text: 'account led-4471 made 128 transfers in 2026-03', data: { total: 128 } },
  { id: 'ev-review', text: 'the March review cleared account led-4471', data: { reviewed: 'yes' } },
  { id: 'ev-flags', text: 'two flags raised, both withdrawn' }
];

test('a claim grounded in its citations is accepted', () => {
  const ruling = rule(
    [{ text: 'account led-4471 made 128 transfers', cites: ['ev-ledger'] }],
    EVIDENCE
  );
  assert.equal(ruling.status, 'grounded');
  assert.equal(ruling.accepted.length, 1);
});

test('a phantom citation dies at the citations check, named', () => {
  const ruling = rule([{ text: 'all clear', cites: ['ev-ghost'] }], EVIDENCE);
  assert.equal(ruling.verdicts[0].status, 'rejected');
  assert.equal(ruling.verdicts[0].failedCheck, 'citations');
  assert.match(ruling.verdicts[0].reason!, /ev-ghost/);
});

test('a fabricated identifier dies at verbatim, and the token is named', () => {
  const ruling = rule(
    [{ text: 'account led-4471 made 999 transfers', cites: ['ev-ledger'] }],
    EVIDENCE
  );
  assert.equal(ruling.verdicts[0].failedCheck, 'verbatim');
  assert.match(ruling.verdicts[0].reason!, /999/);
});

test('the judge is structurally unable to rescue a bad claim', () => {
  const flattering = judge(() => 'this claim is excellent and certainly true');
  const ruling = rule(
    [{ text: 'account led-9999 is clean', cites: ['ev-ledger'] }],
    EVIDENCE,
    { chain: [flattering, ...[citations(), verbatim()]] }
  );
  assert.equal(ruling.verdicts[0].status, 'rejected');
  assert.match(ruling.verdicts[0].notes[0], /excellent/); // heard, recorded
  assert.equal(ruling.verdicts[0].failedCheck, 'verbatim'); // and overruled
});

test('the judge is structurally unable to sink a good claim', () => {
  const hostile = judge(() => 'reject this, I hate it');
  const ruling = rule(
    [{ text: 'the review cleared account led-4471', cites: ['ev-review'] }],
    EVIDENCE,
    { chain: [...[citations(), verbatim()], hostile] }
  );
  assert.equal(ruling.verdicts[0].status, 'accepted');
  assert.match(ruling.verdicts[0].notes[0], /hate/);
});

test('a support scorer below its floor is decisive, with both numbers stated', () => {
  const ruling = rule(
    [{ text: 'two flags raised', cites: ['ev-flags'] }],
    EVIDENCE,
    { chain: [...[citations(), verbatim()], support(() => 0.41, 0.7)] }
  );
  assert.equal(ruling.verdicts[0].failedCheck, 'support');
  assert.match(ruling.verdicts[0].reason!, /0\.410 below floor 0\.7/);
});

test('zero survivors is insufficient: declined, not composed', () => {
  const ruling = rule(
    [
      { text: 'account led-8888 exists', cites: ['ev-ledger'] },
      { text: 'nothing here', cites: ['ev-ghost'] }
    ],
    EVIDENCE
  );
  assert.equal(ruling.status, 'insufficient');
  assert.match(ruling.statement, /declined, not composed/);
});

test('a mostly-rejected answer ships its survivors contested', () => {
  const ruling = rule(
    [
      { text: 'the review cleared account led-4471', cites: ['ev-review'] },
      { text: 'account led-1111 was involved', cites: ['ev-ledger'] },
      { text: 'exactly 777 transfers happened', cites: ['ev-ledger'] }
    ],
    EVIDENCE
  );
  assert.equal(ruling.status, 'contested');
  assert.equal(ruling.accepted.length, 1);
  assert.match(ruling.statement, /2 of 3/);
});

test('identifier extraction sees dates, ids, codes, and multi-digit numbers only', () => {
  const found = identifiersIn('on 2026-03-01 account led-4471 sent 1,280 via TX99; 3 people knew');
  assert.deepEqual(found.sort(), ['1,280', '2026-03-01', 'TX99', 'led-4471'].sort());
  assert.ok(!found.includes('3'), 'single digits are grammar, not data');
  assert.ok(!found.includes('4471'), 'parts of a larger identifier are not separate identifiers');
});
