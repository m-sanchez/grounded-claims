/** A record carries its chain by name, and replay rebuilds the default
 * chain unless the caller re-supplies the custom checks. If replay does not
 * compare the two, an auditor who forgets gets a green light from a
 * strictly weaker re-derivation - the worst possible failure mode for an
 * audit tool, because it is silent and it is reassuring. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { citations, support, verbatim } from '../src/checks.ts';
import type { Evidence } from '../src/evidence.ts';
import { record, replay } from '../src/replay.ts';

const EVIDENCE: Evidence[] = [
  { id: 'ev-ledger', text: 'account led-4471 made 128 transfers', data: { total: 128 } }
];
const CLAIMS = [{ text: 'account led-4471 made 128 transfers', cites: ['ev-ledger'] }];

const strict = () => [citations(), verbatim(), support(() => 0.99, 0.7)];

test('a record replayed under a different chain is not identical, and the chain is named', () => {
  const rec = record(CLAIMS, EVIDENCE, { chain: strict() });
  assert.deepEqual(rec.chain, ['citations', 'verbatim', 'support']);

  const careless = replay(rec); // the custom checks were never re-supplied
  assert.equal(careless.identical, false, 'a weaker re-derivation is not a faithful one');
  assert.ok(
    careless.divergences.some((d) => /chain/.test(d) && /support/.test(d)),
    `divergences must name the chain: ${JSON.stringify(careless.divergences)}`
  );
});

test('a record replayed under its own chain is identical', () => {
  const rec = record(CLAIMS, EVIDENCE, { chain: strict() });
  const faithful = replay(rec, { chain: strict() });
  assert.equal(faithful.identical, true, JSON.stringify(faithful.divergences));
  assert.equal(faithful.hashIntact, true);
});

test('a chain rebuilt in the wrong order diverges too: order is part of the run', () => {
  const rec = record(CLAIMS, EVIDENCE, { chain: strict() });
  const reordered = replay(rec, { chain: [verbatim(), citations(), support(() => 0.99, 0.7)] });
  assert.equal(reordered.identical, false);
  assert.ok(reordered.divergences.some((d) => /chain/.test(d)));
});
