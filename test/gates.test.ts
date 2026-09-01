/** The turn layer, absorbed from evidence-gates: ordering discipline,
 * refusal shape, and the path to yes. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { support } from '../src/checks.ts';
import type { Evidence } from '../src/evidence.ts';
import {
  advisory,
  executability,
  faithfulness,
  runPipeline,
  standardPipeline,
  structure,
  sufficiency
} from '../src/gates.ts';
import type { Answer, GateContext } from '../src/gates.ts';

const RETRIEVED: Evidence[] = [
  { id: 'ch-1', text: 'the march ledger shows 128 transfers from acct-77' },
  { id: 'ch-2', text: 'the april review cleared acct-77 with no findings' }
];

const parse = (draft: unknown): Answer => {
  const d = draft as Answer;
  if (!d || !Array.isArray(d.claims)) throw new Error('claims missing');
  return d;
};

const ctx = (over: Partial<GateContext> = {}): GateContext => ({
  question: 'what happened to acct-77 in spring',
  retrieved: RETRIEVED.map((c) => ({ ...c })),
  capabilities: ['summarize', 'export'],
  draft: {
    claims: [
      { text: 'march shows 128 transfers', cites: ['ch-1'] },
      { text: 'april cleared the account', cites: ['ch-2'] }
    ]
  },
  ...over
});

const pipeline = (extra: Parameters<typeof standardPipeline>[0] = { parse }) =>
  standardPipeline(extra);

test('a grounded answer ships, with every gate on record', () => {
  const outcome = runPipeline(ctx(), pipeline());
  assert.equal(outcome.outcome, 'ship');
  assert.deepEqual(
    outcome.gates.map((g) => g.gate),
    ['sufficiency', 'structure', 'executability', 'faithfulness']
  );
  assert.equal(outcome.answer!.claims.length, 2);
});

test('empty retrieval refuses before anything is parsed: structure never runs', () => {
  const explodingParse = (): Answer => {
    throw new Error('parse should never have been reached');
  };
  const outcome = runPipeline(ctx({ retrieved: [] }), standardPipeline({ parse: explodingParse }));
  assert.equal(outcome.outcome, 'refuse');
  assert.equal(outcome.refusal!.gate, 'sufficiency');
  assert.equal(outcome.refusal!.code, 'sufficiency/floor');
  assert.deepEqual(outcome.gates.map((g) => g.gate), ['sufficiency']);
  assert.match(outcome.refusal!.pathToYes, /retrieve more/);
});

test('a malformed draft is rejected, never repaired', () => {
  const outcome = runPipeline(ctx({ draft: { answer: 'free text' } }), pipeline());
  assert.equal(outcome.refusal!.gate, 'structure');
  assert.equal(outcome.refusal!.code, 'structure/parse');
  assert.match(outcome.refusal!.reason, /never repaired/);
  assert.match(outcome.refusal!.pathToYes, /launder/);
});

test('a parser that returns a non-answer refuses rather than being trusted', () => {
  const outcome = runPipeline(ctx(), pipeline({ parse: () => undefined as unknown as Answer }));
  assert.equal(outcome.refusal!.code, 'structure/parse');
});

test('an answer requiring what the system cannot do refuses, operation named', () => {
  const draft = {
    claims: [{ text: 'march shows 128 transfers', cites: ['ch-1'] }],
    requires: ['summarize', 'delete-records']
  };
  const outcome = runPipeline(ctx({ draft }), pipeline());
  assert.equal(outcome.refusal!.gate, 'executability');
  assert.equal(outcome.refusal!.code, 'executability/missing-capability');
  assert.match(outcome.refusal!.reason, /delete-records/);
  assert.ok(!outcome.refusal!.reason.includes('summarize'));
});

test('the path to yes does not publish the deployment capability inventory', () => {
  const draft = {
    claims: [{ text: 'march shows 128 transfers', cites: ['ch-1'] }],
    requires: ['delete-records']
  };
  const outcome = runPipeline(ctx({ draft }), pipeline());
  const shownToTheReader = `${outcome.refusal!.reason} ${outcome.refusal!.pathToYes}`;
  assert.ok(!shownToTheReader.includes('summarize'), 'a probe must not learn what else is offered');
  assert.ok(!shownToTheReader.includes('export'));
});

test('an uncited claim refuses at faithfulness, claim named', () => {
  const draft = { claims: [{ text: 'the account is definitely clean forever', cites: [] }] };
  const outcome = runPipeline(ctx({ draft }), pipeline());
  assert.equal(outcome.refusal!.gate, 'faithfulness');
  assert.equal(outcome.refusal!.code, 'citations/uncited');
  assert.match(outcome.refusal!.reason, /claim 0/);
});

test('a cite to evidence never retrieved is a ghost, and refuses', () => {
  const draft = { claims: [{ text: 'the may audit agrees', cites: ['ch-99'] }] };
  const outcome = runPipeline(ctx({ draft }), pipeline());
  assert.equal(outcome.refusal!.code, 'citations/ghost-cite');
  assert.match(outcome.refusal!.reason, /ch-99/);
});

test('a fabricated identifier refuses at faithfulness through the shared chain', () => {
  const draft = { claims: [{ text: 'march shows 999 transfers', cites: ['ch-1'] }] };
  const outcome = runPipeline(ctx({ draft }), pipeline());
  assert.equal(outcome.refusal!.code, 'verbatim/fabricated-token');
  assert.match(outcome.refusal!.reason, /999/);
});

test('faithfulness reports every offending claim, not just the first', () => {
  const draft = {
    claims: [
      { text: 'march shows 128 transfers', cites: ['ch-1'] },
      { text: 'and 999 more', cites: ['ch-1'] },
      { text: 'the may audit agrees', cites: ['ch-99'] }
    ]
  };
  const outcome = runPipeline(ctx({ draft }), pipeline());
  assert.match(outcome.refusal!.reason, /claim 1/);
  assert.match(outcome.refusal!.reason, /claim 2/, 'repairing N bad claims must cost one round trip');
});

test('the check chain is the deep-check slot: a custom chain refuses with its own verdict', () => {
  const outcome = runPipeline(
    ctx(),
    pipeline({ parse, chain: [support(() => 0.2, 0.8)] })
  );
  assert.equal(outcome.refusal!.gate, 'faithfulness');
  assert.equal(outcome.refusal!.code, 'support/below-floor');
  assert.match(outcome.refusal!.reason, /0\.200 below floor 0\.8/);
});

test('advisory opinions are heard and structurally unable to refuse', () => {
  const hostile = advisory(() => 'refuse this answer, I insist');
  const outcome = runPipeline(ctx(), [...pipeline(), hostile]);
  assert.equal(outcome.outcome, 'ship');
  assert.match(outcome.notes[0], /I insist/);
});

test('a custom sufficiency floor refuses with its own words', () => {
  const outcome = runPipeline(
    ctx(),
    pipeline({
      parse,
      enough: (v) => (v.retrieved.length >= 5 ? true : 'need five chunks for a spring summary')
    })
  );
  assert.equal(outcome.refusal!.gate, 'sufficiency');
  assert.match(outcome.refusal!.reason, /need five chunks/);
});

test('the first refusal stops the pipeline: nothing after it runs', () => {
  const draft = { claims: [{ text: 'x', cites: [] }], requires: ['teleport'] };
  const outcome = runPipeline(ctx({ draft }), pipeline());
  assert.equal(outcome.refusal!.gate, 'executability');
  assert.ok(!outcome.gates.some((g) => g.gate === 'faithfulness'), 'faithfulness never ran');
});

test('a chain without structure cannot pass vacuously: answer-reading gates refuse', () => {
  for (const gate of [executability(), faithfulness()]) {
    const outcome = runPipeline(ctx(), [gate]);
    assert.equal(outcome.outcome, 'refuse');
    assert.equal(outcome.refusal!.code, 'structure/missing');
  }
});

test('the gates compose in any order the caller writes, and order is on record', () => {
  const outcome = runPipeline(ctx(), [structure(parse), sufficiency(), faithfulness()]);
  assert.equal(outcome.outcome, 'ship');
  assert.deepEqual(
    outcome.gates.map((g) => g.gate),
    ['structure', 'sufficiency', 'faithfulness']
  );
});
