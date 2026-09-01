/** The vacuous-pass family: two ways for nothing to be certified as
 * something. Both layers used to ship one of them.
 *
 * The turn layer let an answer with zero claims through, because
 * "every claim is grounded" is vacuously true of an empty list. The claim
 * layer let a claim citing nothing through, because "every cite resolves"
 * is vacuously true of an empty cites array, and a claim in plain English
 * has no identifier for verbatim to object to. Same shape, one layer
 * each. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compose } from '../src/compose.ts';
import type { Evidence } from '../src/evidence.ts';
import { runPipeline, standardPipeline } from '../src/gates.ts';
import type { Answer } from '../src/gates.ts';
import { rule } from '../src/ruling.ts';

const EVIDENCE: Evidence[] = [{ id: 'ev-1', text: 'the review cleared the account' }];

test('a claim that cites nothing is not grounded', () => {
  const ruling = rule([{ text: 'the account is definitely clean forever', cites: [] }], EVIDENCE);
  assert.equal(ruling.status, 'insufficient');
  assert.equal(ruling.verdicts[0].status, 'rejected');
  assert.equal(ruling.verdicts[0].failedCheck, 'citations');
  assert.equal(ruling.verdicts[0].code, 'citations/uncited');
});

test('and it never reaches the page with an empty citation bracket', () => {
  const ruling = rule([{ text: 'the account is definitely clean forever', cites: [] }], EVIDENCE);
  const md = compose(ruling, EVIDENCE);
  assert.ok(!md.includes('clean forever ['), 'an empty bracket is a citation-shaped hole');
  assert.match(md, /declined, not composed/);
});

test('an answer with zero claims is a refusal at the turn layer', () => {
  const outcome = runPipeline(
    {
      question: 'what happened',
      retrieved: EVIDENCE,
      capabilities: [],
      draft: { claims: [] }
    },
    standardPipeline({ parse: (d) => d as Answer })
  );
  assert.equal(outcome.outcome, 'refuse');
  assert.equal(outcome.refusal!.code, 'faithfulness/empty-answer');
});
