/** The package is synchronous on purpose - it is offline, so the model call
 * belongs outside it. But "synchronous" has to be enforced, not assumed: an
 * async opinion or scorer is the single most likely mistake an adopter
 * makes, and it used to be recorded as the note `judge: [object Promise]`
 * with no error and no warning. A guardrail that quietly accepts a
 * misconfiguration is worse than one that refuses it. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { citations, judge, support, verbatim } from '../src/checks.ts';
import type { Evidence } from '../src/evidence.ts';
import { rule } from '../src/ruling.ts';

const EVIDENCE: Evidence[] = [{ id: 'ev-1', text: 'the april review cleared acct-77' }];
const CLAIM = [{ text: 'the april review cleared acct-77', cites: ['ev-1'] }];

test('an async judge says so, instead of recording [object Promise]', () => {
  const ruling = rule(CLAIM, EVIDENCE, {
    // The cast is the point: TypeScript stops this, JavaScript does not,
    // and plenty of adopters reach the chain from untyped glue code.
    chain: [citations(), verbatim(), judge((async () => 'looks fine to me') as never)]
  });
  assert.equal(ruling.verdicts[0].status, 'accepted', 'still advisory, still no gavel');
  const note = ruling.verdicts[0].notes[0];
  assert.ok(!note.includes('[object Promise]'), `silently swallowed: ${note}`);
  assert.match(note, /synchronous/);
});

test('an async scorer is a named rejection, not a nonsense comparison', () => {
  const ruling = rule(CLAIM, EVIDENCE, {
    chain: [citations(), verbatim(), support((() => Promise.resolve(0.9)) as never, 0.7)]
  });
  assert.equal(ruling.verdicts[0].status, 'rejected');
  assert.equal(ruling.verdicts[0].failedCheck, 'support');
  assert.equal(ruling.verdicts[0].code, 'support/async-scorer');
  assert.match(ruling.verdicts[0].reason!, /synchronous/);
});
