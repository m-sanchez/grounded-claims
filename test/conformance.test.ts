/** The conformance corpus: one adversarial case per failure the package is
 * supposed to stop, run through both layers, with the expected verdict
 * written down per layer - including the cases a layer legitimately does
 * not cover, which are recorded rather than left to pass quietly.
 *
 * The who-refuses-what matrix in the README is generated from this run and
 * asserted against the README text, so the published table cannot drift
 * away from what the code does. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ComposeIntegrityError, compose } from '../src/compose.ts';
import type { Claim, Evidence } from '../src/evidence.ts';
import { runPipeline, standardPipeline } from '../src/gates.ts';
import type { Answer } from '../src/gates.ts';
import { rule } from '../src/ruling.ts';

interface LayerExpectation {
  outcome?: string;
  status?: string;
  code?: string | null;
  composeThrows?: string;
  notCovered?: string;
}
interface Case {
  name: string;
  failure: string;
  draft: unknown;
  editAcceptedClaim?: string;
  turn: LayerExpectation;
  claim: LayerExpectation;
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(
  readFileSync(path.join(HERE, 'fixtures', 'conformance.fixture.json'), 'utf8')
) as { evidence: Evidence[]; capabilities: string[]; cases: Case[] };

const parse = (draft: unknown): Answer => {
  const d = draft as Answer;
  if (!d || !Array.isArray(d.claims)) throw new Error('claims missing');
  return d;
};

const claimsOf = (draft: unknown): Claim[] => {
  const d = draft as Answer;
  return d && Array.isArray(d.claims) ? d.claims.map((c) => ({ ...c, cites: [...c.cites] })) : [];
};

const matrix: string[] = [];

for (const c of fixture.cases) {
  test(`conformance: ${c.name} - turn layer`, () => {
    if (c.turn.notCovered && c.turn.outcome == null) {
      assert.ok(c.turn.notCovered.length > 20, 'a not-covered case must say why');
      return;
    }
    const outcome = runPipeline(
      {
        question: 'what happened to acct-77 in spring',
        retrieved: fixture.evidence,
        capabilities: fixture.capabilities,
        draft: c.draft
      },
      standardPipeline({ parse })
    );
    assert.equal(outcome.outcome, c.turn.outcome, `${c.name}: turn outcome`);
    if (c.turn.code) assert.equal(outcome.refusal!.code, c.turn.code, `${c.name}: turn code`);
  });

  test(`conformance: ${c.name} - claim layer`, () => {
    if (c.claim.notCovered) {
      assert.ok(c.claim.notCovered.length > 20, 'a not-covered case must say why');
      return;
    }
    const ruling = rule(claimsOf(c.draft), fixture.evidence);
    assert.equal(ruling.status, c.claim.status, `${c.name}: claim status`);
    if (c.claim.code) {
      assert.equal(ruling.rejected[0].code, c.claim.code, `${c.name}: claim code`);
    }
    if (c.claim.composeThrows) {
      if (c.editAcceptedClaim) ruling.accepted[0].claim.text += c.editAcceptedClaim;
      assert.throws(
        () => compose(ruling, fixture.evidence),
        (err: unknown) =>
          err instanceof ComposeIntegrityError &&
          new RegExp(c.claim.composeThrows!).test(err.message),
        `${c.name}: compose must refuse`
      );
    }
  });
}

const cell = (e: LayerExpectation): string => {
  if (e.composeThrows) return 'refuses at compose';
  if (e.notCovered) return 'not covered by design';
  if (e.code) return `refuses (\`${e.code}\`)`;
  if (e.outcome === 'refuse' || e.status === 'insufficient') return 'refuses';
  return 'ships';
};

test('the who-refuses-what matrix in the README is the measured one', () => {
  for (const c of fixture.cases) {
    matrix.push(`| ${c.name} | ${cell(c.turn)} | ${cell(c.claim)} |`);
  }
  const readme = readFileSync(path.join(HERE, '..', 'README.md'), 'utf8');
  const missing = matrix.filter((row) => !readme.includes(row));
  assert.deepEqual(
    missing,
    [],
    `the README matrix is out of date; these rows are what the code does:\n${matrix.join('\n')}`
  );
});
