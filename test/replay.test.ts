import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Evidence } from '../src/evidence.ts';
import { canonicalize, hashOf, record, replay } from '../src/replay.ts';
import { Trace } from '../src/trace.ts';

const EVIDENCE: Evidence[] = [
  { id: 'ev-ledger', text: 'account led-4471 made 128 transfers', data: { total: 128 } }
];
const CLAIMS = [
  { text: 'account led-4471 made 128 transfers', cites: ['ev-ledger'] },
  { text: 'led-3131 was the counterparty', cites: ['ev-ledger'] }
];

test('canonical bytes are key-order independent and reject non-finite numbers', () => {
  assert.equal(canonicalize({ b: 1, a: 'x' }), canonicalize({ a: 'x', b: 1 }));
  assert.throws(() => canonicalize({ n: Infinity }));
});

test('the same run produces the same record hash', () => {
  assert.equal(record(CLAIMS, EVIDENCE).recordHash, record(CLAIMS, EVIDENCE).recordHash);
});

test('a record replays identically from its own frozen inputs', () => {
  const rec = record(CLAIMS, EVIDENCE);
  const result = replay(rec);
  assert.ok(result.identical);
  assert.ok(result.hashIntact);
  assert.equal(result.reproduced.status, rec.ruling.status);
});

test('a tampered record fails replay with the divergence named', () => {
  const rec = record(CLAIMS, EVIDENCE);
  const tampered = {
    ...rec,
    ruling: {
      ...rec.ruling,
      verdicts: rec.ruling.verdicts.map((v, i) =>
        i === 1 ? { ...v, status: 'accepted' as const } : v
      )
    }
  };
  const result = replay(tampered);
  assert.ok(!result.identical);
  assert.ok(!result.hashIntact);
  assert.ok(result.divergences.some((d) => /claim 1/.test(d)));
});

test('hashOf is stable across semantically identical values', () => {
  assert.equal(hashOf([{ x: 1, y: 2 }]), hashOf([{ y: 2, x: 1 }]));
});

test('the trace records ordered steps under an injectable clock', () => {
  let t = 0;
  const trace = new Trace(() => (t += 10));
  trace.step('rule', '2 claims').step('compose');
  const report = trace.finish();
  assert.deepEqual(
    report.steps.map((s) => s.name),
    ['rule', 'compose']
  );
  assert.equal(report.elapsedMs, 30);
  assert.equal(report.steps[0].detail, '2 claims');
});
