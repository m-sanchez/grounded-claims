/** The seven guarantees the absorbed pipeline did not actually hold.
 *
 * Each of these was run against the evidence-gates source before the move
 * and each failed there; the failures are named in the commit that fixed
 * them. They are kept as tests rather than as prose because the prose was
 * already there and was already wrong. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
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
import type { Answer, Gate, GateContext } from '../src/gates.ts';

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
  draft: { claims: [{ text: 'march shows 128 transfers', cites: ['ch-1'] }] },
  ...over
});

test('an answer with zero claims refuses; vacuous truth is not a pass', () => {
  const outcome = runPipeline(ctx({ draft: { claims: [] } }), standardPipeline({ parse }));
  assert.equal(outcome.outcome, 'refuse');
  assert.equal(outcome.refusal!.gate, 'faithfulness');
  assert.equal(outcome.refusal!.code, 'faithfulness/empty-answer');
});

test('a throwing sufficiency predicate is a named refusal, not a crash', () => {
  const outcome = runPipeline(
    ctx(),
    [
      sufficiency(() => {
        throw new Error('retriever health check timed out');
      })
    ]
  );
  assert.equal(outcome.outcome, 'refuse');
  assert.equal(outcome.refusal!.code, 'sufficiency/predicate-error');
  assert.match(outcome.refusal!.reason, /health check timed out/);
});

test('a throwing custom gate is a named refusal, not a crash', () => {
  const rogue: Gate = {
    name: 'rogue',
    run: () => {
      throw new Error('custom gate exploded');
    }
  };
  const outcome = runPipeline(ctx(), [rogue]);
  assert.equal(outcome.outcome, 'refuse');
  assert.equal(outcome.refusal!.gate, 'rogue');
  assert.equal(outcome.refusal!.code, 'gate/error');
  assert.match(outcome.refusal!.reason, /exploded/);
});

test('a throwing pathToYes still yields a refusal the reader can act on', () => {
  const gate: Gate = {
    name: 'sufficiency',
    run: () => ({
      gate: 'sufficiency',
      status: 'refuse',
      code: 'sufficiency/floor',
      detail: 'nothing was retrieved'
    }),
    pathToYes: () => {
      throw new Error('path generator exploded');
    }
  };
  const outcome = runPipeline(ctx({ retrieved: [] }), [gate]);
  assert.equal(outcome.outcome, 'refuse');
  assert.equal(outcome.refusal!.code, 'sufficiency/floor');
  assert.match(outcome.refusal!.pathToYes, /re-run/);
});

test('a throwing advisory is still advisory: recorded, never a refusal, never a crash', () => {
  const exploding = advisory(() => {
    throw new Error('judge machine on fire');
  });
  const outcome = runPipeline(ctx(), [...standardPipeline({ parse }), exploding]);
  assert.equal(outcome.outcome, 'ship');
  assert.match(outcome.notes.at(-1)!, /contained.*on fire/);
});

test('an advisory gate cannot flip refuse to ship by rewriting the answer', () => {
  const rescuer = advisory((view) => {
    (view.answer as Answer).claims = [{ text: 'march shows 128 transfers', cites: ['ch-1'] }];
    return 'tidied the answer up a bit';
  });
  const outcome = runPipeline(
    ctx({ draft: { claims: [{ text: 'the account is definitely clean forever', cites: [] }] } }),
    [sufficiency(), structure(parse), executability(), rescuer, faithfulness()]
  );
  assert.equal(outcome.outcome, 'refuse', 'an advisory must not rescue an uncited answer');
  assert.equal(outcome.refusal!.code, 'citations/uncited');
});

test('a gate cannot mutate what later gates see, nor what the caller holds', () => {
  const shared = ctx();
  const before = JSON.stringify(shared.retrieved);
  const vandal: Gate = {
    name: 'vandal',
    run: (view) => {
      // Both writes throw against the frozen view; the throw is contained.
      (view.retrieved as Evidence[]).push({ id: 'ch-invented', text: 'whatever it wanted to say' });
      return { gate: 'vandal', status: 'pass', detail: 'ok' };
    }
  };
  const outcome = runPipeline(shared, [vandal, sufficiency(), structure(parse), faithfulness()]);
  assert.equal(JSON.stringify(shared.retrieved), before, 'the caller keeps its own evidence');
  assert.equal(outcome.outcome, 'refuse');
  assert.equal(outcome.refusal!.code, 'gate/error');
});

test('a gate cannot rewrite an evidence record the audit trail will quote', () => {
  const shared = ctx();
  const forger: Gate = {
    name: 'forger',
    run: (view) => {
      (view.retrieved[0] as Evidence).text = 'the march ledger shows 999 transfers';
      return { gate: 'forger', status: 'pass', detail: 'ok' };
    }
  };
  runPipeline(shared, [forger]);
  assert.equal(shared.retrieved[0].text, 'the march ledger shows 128 transfers from acct-77');
});

test('the parsed answer is pipeline state: it cannot be handed in to skip structure', () => {
  const smuggled = {
    question: 'q',
    retrieved: RETRIEVED,
    capabilities: ['summarize'],
    draft: 'never parsed at all',
    answer: { claims: [{ text: 'march shows 128 transfers', cites: ['ch-1'] }] }
  } as GateContext;
  const outcome = runPipeline(smuggled, [executability(), faithfulness()]);
  assert.equal(outcome.outcome, 'refuse');
  assert.equal(outcome.refusal!.code, 'structure/missing');
});

test('two runs of one context cannot share a stale answer', () => {
  const shared = ctx();
  const first = runPipeline(shared, standardPipeline({ parse }));
  assert.equal(first.outcome, 'ship');
  const second = runPipeline({ ...shared, draft: { claims: [] } }, [
    executability(),
    faithfulness()
  ]);
  assert.equal(second.outcome, 'refuse');
  assert.equal(second.refusal!.code, 'structure/missing');
});
