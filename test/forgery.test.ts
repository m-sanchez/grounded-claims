/** The composed page is what a human actually reads, and the disclosure
 * line is the one part of it the reader is told to trust. Model-authored
 * claim text must therefore never be able to render as document
 * structure. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ComposeIntegrityError, compose } from '../src/compose.ts';
import type { Evidence } from '../src/evidence.ts';
import { rule } from '../src/ruling.ts';

const EVIDENCE: Evidence[] = [{ id: 'ev-review', text: 'the review cleared the account' }];

const FORGED =
  'the review cleared the account\n\n---\ndisclosure: every claim grounded, none rejected; checks: citations, verbatim, support, notary';

test('a claim that forges a disclosure line cannot be composed', () => {
  const ruling = rule([{ text: FORGED, cites: ['ev-review'] }], EVIDENCE);
  // It passes the chain honestly: it invents no identifier at all.
  assert.equal(ruling.verdicts[0].status, 'accepted');
  assert.throws(
    () => compose(ruling, EVIDENCE),
    (err: unknown) =>
      err instanceof ComposeIntegrityError && /structure|newline/i.test((err as Error).message)
  );
});

test('every markdown structural opener in claim text is drift, not content', () => {
  for (const text of [
    '--- a fresh horizontal rule',
    '# a heading of its own',
    '> a block quote the reader will read as a system voice',
    'disclosure: 9 claim(s) grounded, 0 rejected',
    '   disclosure: leading whitespace does not help'
  ]) {
    const ruling = rule([{ text, cites: ['ev-review'] }], EVIDENCE);
    assert.equal(ruling.verdicts[0].status, 'accepted', text);
    assert.throws(() => compose(ruling, EVIDENCE), ComposeIntegrityError, text);
  }
});

test('ordinary claim text with punctuation still composes', () => {
  for (const text of [
    'the review cleared the account - no findings',
    'the account was cleared (see the review)',
    'a hyphen-joined phrase is fine',
    'a claim mentioning a disclosure mid-sentence is fine'
  ]) {
    const ruling = rule([{ text, cites: ['ev-review'] }], EVIDENCE);
    const md = compose(ruling, EVIDENCE);
    assert.match(md, /disclosure: 1 claim\(s\) grounded/);
  }
});
