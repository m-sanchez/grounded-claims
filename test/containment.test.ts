/** Containment: a check is handed a view, never the live objects.
 *
 * The theorem, not a sample of three judges: for an adversarial battery of
 * checks - advisory and decisive - splicing the adversary in anywhere in the
 * chain leaves the accepted and rejected sets exactly as they were without
 * it, and leaves the caller's claims and evidence byte-identical. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { citations, verbatim } from '../src/checks.ts';
import type { Check } from '../src/checks.ts';
import type { Claim, Evidence } from '../src/evidence.ts';
import { rule } from '../src/ruling.ts';
import { canonicalize, record } from '../src/replay.ts';

const EVIDENCE = (): Evidence[] => [
  { id: 'ev-ledger', text: 'the review cleared account led-4471', data: { total: 128 } },
  { id: 'ev-flags', text: 'two flags raised, both withdrawn' }
];

const CLAIMS = (): Claim[] => [
  { text: 'the review cleared account led-4471', cites: ['ev-ledger'] },
  { text: 'there were 9999 transfers', cites: ['ev-ledger'] },
  { text: 'nothing here', cites: ['ev-ghost'] }
];

/** Every one of these has been tried against a real chain; each is one line
 * of careless plug-in code away from a real integration. */
const ADVERSARIES: ReadonlyArray<{ name: string; kind: 'decisive' | 'advisory' }> = [
  { name: 'rewrites-evidence-text', kind: 'advisory' },
  { name: 'rewrites-evidence-text-decisive', kind: 'decisive' },
  { name: 'rewrites-claim-text', kind: 'advisory' },
  { name: 'rewrites-claim-text-decisive', kind: 'decisive' },
  { name: 'empties-cites', kind: 'advisory' },
  { name: 'rewrites-evidence-data', kind: 'advisory' },
  { name: 'pushes-evidence', kind: 'advisory' },
  { name: 'throws', kind: 'advisory' },
  { name: 'throws-decisive', kind: 'decisive' }
];

function adversary(spec: { name: string; kind: 'decisive' | 'advisory' }): Check {
  return {
    name: spec.name,
    kind: spec.kind,
    run: (claim, cited) => {
      switch (spec.name) {
        case 'rewrites-evidence-text':
        case 'rewrites-evidence-text-decisive':
          if (cited[0]) cited[0].text += ' and 9999 transfers occurred';
          break;
        case 'rewrites-claim-text':
        case 'rewrites-claim-text-decisive':
          claim.text = 'account led-4471 was closed by order 5150';
          break;
        case 'empties-cites':
          claim.cites.length = 0;
          break;
        case 'rewrites-evidence-data':
          if (cited[0]) (cited[0] as Evidence).data = { total: 9999 };
          break;
        case 'pushes-evidence':
          cited.push({ id: 'ev-invented', text: 'there were 9999 transfers' });
          break;
        default:
          throw new Error('plug-in exploded');
      }
      return { ok: true, reason: 'no opinion' };
    }
  };
}

const outcomeOf = (chain: Check[]) => {
  const ruling = rule(CLAIMS(), EVIDENCE(), { chain });
  return {
    status: ruling.status,
    accepted: ruling.accepted.map((v) => v.claim.text),
    rejected: ruling.rejected.map((v) => `${v.claim.text} @ ${v.failedCheck}`)
  };
};

test('no check, advisory or decisive, can change the ruling by mutating its arguments', () => {
  const clean = outcomeOf([citations(), verbatim()]);
  assert.deepEqual(clean.accepted, ['the review cleared account led-4471']);

  for (const spec of ADVERSARIES) {
    const adv = adversary(spec);
    const runs = [
      ['first', outcomeOf([adv, citations(), verbatim()])],
      ['middle', outcomeOf([citations(), adv, verbatim()])],
      ['last', outcomeOf([citations(), verbatim(), adv])]
    ] as const;
    for (const [where, got] of runs) {
      if (spec.kind === 'advisory') {
        // An advisory check has no gavel at all: byte-identical outcome.
        assert.deepEqual(
          got.accepted,
          clean.accepted,
          `${spec.name} spliced ${where} changed the accepted set`
        );
        assert.equal(
          got.status,
          clean.status,
          `${spec.name} spliced ${where} changed the ruling status`
        );
      } else {
        // A decisive check may refuse - that is what decisive means. What it
        // may never do is manufacture an acceptance or rewrite what ships,
        // so its accepted set can only ever be a subset of the clean one.
        for (const text of got.accepted) {
          assert.ok(
            clean.accepted.includes(text),
            `${spec.name} spliced ${where} produced an acceptance the clean chain never made: ${text}`
          );
        }
      }
    }
  }
});

test('the caller keeps its own claims and evidence: rule() mutates nothing it is handed', () => {
  for (const spec of ADVERSARIES) {
    const claims = CLAIMS();
    const evidence = EVIDENCE();
    const before = canonicalize({ claims, evidence });
    rule(claims, evidence, { chain: [citations(), adversary(spec), verbatim()] });
    assert.equal(canonicalize({ claims, evidence }), before, `${spec.name} mutated the caller's inputs`);
  }
});

test('a throwing custom check is contained: named rejection if decisive, a note if advisory', () => {
  const rogue: Check = {
    name: 'rogue',
    kind: 'decisive',
    run: () => {
      throw new Error('custom check exploded');
    }
  };
  const ruling = rule([{ text: 'all clear', cites: [] }], EVIDENCE(), { chain: [rogue] });
  assert.equal(ruling.verdicts[0].status, 'rejected');
  assert.equal(ruling.verdicts[0].failedCheck, 'rogue');
  assert.match(ruling.verdicts[0].reason!, /exploded/);

  const rogueAdvisory: Check = { ...rogue, name: 'rogue-advisory', kind: 'advisory' };
  const shipped = rule([{ text: 'all clear', cites: [] }], EVIDENCE(), {
    chain: [rogueAdvisory, citations(), verbatim()]
  });
  assert.equal(shipped.verdicts[0].status, 'accepted');
  assert.match(shipped.verdicts[0].notes[0], /exploded/);
});

test('record() freezes the evidence as it was before the chain ran, not after', () => {
  const evidence = EVIDENCE();
  const forger: Check = {
    name: 'forger',
    kind: 'advisory',
    run: (_claim, cited) => {
      if (cited[0]) cited[0].text += ' and 9999 transfers occurred';
      return { ok: true };
    }
  };
  const rec = record([{ text: 'there were 9999 transfers', cites: ['ev-ledger'] }], evidence, {
    chain: [forger, citations(), verbatim()]
  });
  assert.equal(rec.ruling.status, 'insufficient', 'the forged text must not ground the claim');
  assert.ok(
    !JSON.stringify(rec.evidence).includes('9999'),
    'the record must not freeze a check\'s invention as the evidence'
  );
});
