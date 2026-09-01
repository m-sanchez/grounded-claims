/** The family canonical byte form, asserted against the shared fixture.
 *
 * The fixture is a byte-identical copy of the one the sibling packages
 * carry: same accept cases, same expected canonical text, same sha256, same
 * reject kinds. Hashes only mean anything if the bytes behind them are the
 * same bytes everywhere, so this is the test that makes a record written by
 * one package verifiable by another. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { canonicalize, hashOf } from '../src/replay.ts';

interface AcceptCase {
  name: string;
  value: unknown;
  canonical: string;
  sha256: string;
}
interface RejectCase {
  name: string;
  kind: 'nonFinite' | 'unsafeInteger' | 'belowFloor' | 'unsupportedType';
  reason: string;
}

const FIXTURE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'canonical-form.fixture.json'
);
const fixture = JSON.parse(readFileSync(FIXTURE, 'utf8')) as {
  rule: string;
  accept: AcceptCase[];
  reject: RejectCase[];
};

/** The reject cases carry a kind rather than a value, because JSON cannot
 * hold any of them. Rebuild each from its kind. */
function rejectValue(c: RejectCase): unknown {
  switch (c.kind) {
    case 'nonFinite':
      return c.name === 'NaN' ? NaN : c.name === '-Infinity' ? -Infinity : Infinity;
    case 'unsafeInteger':
      return 9007199254740993;
    case 'belowFloor':
      return c.name === 'seven micro' ? 0.000007 : 1e-7;
    case 'unsupportedType':
      return c.name === 'function' ? () => 'no canonical form' : undefined;
  }
}

test('the fixture is the shared one, not a local variant', () => {
  assert.equal(fixture.accept.length, 27);
  assert.equal(fixture.reject.length, 8);
  assert.match(fixture.rule, /keys sorted by code unit/);
  assert.match(fixture.rule, /\|x\| >= 1e-4/);
});

for (const c of fixture.accept) {
  test(`canonical form accepts ${c.name}`, () => {
    assert.equal(canonicalize(c.value), c.canonical, 'canonical text');
    assert.equal(hashOf(c.value), c.sha256, 'sha256 over the canonical text');
  });
}

for (const c of fixture.reject) {
  test(`canonical form refuses ${c.name} (${c.kind})`, () => {
    assert.throws(() => canonicalize(rejectValue(c)), TypeError, c.reason);
  });
}

test('the accept cases the fixture cannot carry are covered here', () => {
  // JSON has no -0, so the fixture stores 0 for the negative-zero case.
  assert.equal(canonicalize(-0), '0');
  assert.equal(hashOf(-0), hashOf(0));
  // undefined-valued properties are omitted rather than rendered.
  assert.equal(canonicalize({ a: 1, b: undefined, c: 3 }), '{"a":1,"c":3}');
});

test('a run record still hashes under the shared rule', () => {
  // The point of adopting the family form: an existing record is unchanged
  // by it, so nothing already written stops verifying.
  const value = { version: 1, options: { contestedAbove: 0.5 }, chain: ['citations', 'verbatim'] };
  assert.equal(
    canonicalize(value),
    '{"chain":["citations","verbatim"],"options":{"contestedAbove":0.5},"version":1}'
  );
});
