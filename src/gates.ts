/** The turn layer: gates that rule on a whole answer, in order.
 *
 * The check chain (checks.ts) rules on one claim at a time. This rules on
 * the turn: is the retrieval enough to answer from at all, did the draft
 * parse, does the answer require operations this deployment offers, and is
 * every claim in it grounded. Composition order is most of the design - the
 * first refusal stops the pipeline, and every gate after it never runs,
 * because a refusal that kept processing would be a warning, and warnings
 * ship.
 *
 * The two layers share one vocabulary rather than translating between two:
 * a statement IS a Claim, a retrieved chunk IS an Evidence, and the
 * faithfulness gate is the check chain applied per claim, not a second
 * implementation of citation resolution.
 *
 * Every plug-in point here is contained. A gate is handed a frozen view, so
 * it cannot rewrite what the gates after it see; and every caller-supplied
 * function - the sufficiency predicate, the parser, a custom gate's run,
 * its pathToYes, an advisory opinion - is wrapped, so a plug-in that throws
 * becomes a named refusal rather than a 500 on the request. */

import type { Check } from './checks.ts';
import { defaultChain } from './checks.ts';
import { containedFailure, frozenView } from './containment.ts';
import { indexEvidence } from './evidence.ts';
import type { Claim, Evidence } from './evidence.ts';
import { judgeClaim } from './ruling.ts';

/** An answer is a set of claims plus the operations acting on it requires. */
export interface Answer {
  claims: Claim[];
  /** operations this answer depends on (export, notify, recompute, ...) */
  requires?: string[];
}

/** What the caller supplies. There is deliberately no `answer` field: the
 * parsed answer is pipeline state, produced by the structure gate, so no
 * caller can hand one in and skip the parse. */
export interface GateContext {
  question: string;
  retrieved: Evidence[];
  /** operations this deployment actually offers */
  capabilities: string[];
  /** the model's raw output, before any gate has touched it */
  draft: unknown;
}

/** What a gate sees: the context, frozen, plus the parsed answer once the
 * structure gate has produced one. Earlier gates see `answer` undefined,
 * which is how a chain missing structure() refuses instead of passing
 * vacuously. */
export interface GateView {
  readonly question: string;
  readonly retrieved: readonly Evidence[];
  readonly capabilities: readonly string[];
  readonly draft: unknown;
  readonly answer?: Answer;
}

export interface GateResult {
  gate: string;
  status: 'pass' | 'refuse' | 'advisory';
  detail: string;
  /** stable machine-readable cause on a refusal */
  code?: string;
  /** a gate may hand a parsed answer to the gates after it */
  answer?: Answer;
}

export interface Refusal {
  gate: string;
  /** stable machine-readable cause: route on this, never on the prose */
  code: string;
  reason: string;
  pathToYes: string;
}

export interface PipelineOutcome {
  outcome: 'ship' | 'refuse';
  gates: GateResult[];
  refusal?: Refusal;
  notes: string[];
  /** the parsed answer, on a run that shipped */
  answer?: Answer;
}

export interface Gate {
  name: string;
  run: (view: GateView) => GateResult;
  pathToYes?: (view: GateView) => string;
}

/** Gate: sufficiency. Before any answer exists: is the retrieval enough to
 * answer from at all? The default floor is one evidence record; bring a
 * stricter predicate for real deployments. Refusing here is the cheapest
 * refusal in the pipeline - nothing has been generated yet, provided the
 * caller defers generation until the pipeline asks for the draft. */
export function sufficiency(
  enough: (view: GateView) => true | string = (view) =>
    view.retrieved.length > 0 ? true : 'nothing was retrieved'
): Gate {
  return {
    name: 'sufficiency',
    run: (view) => {
      let verdict: true | string;
      try {
        verdict = enough(view);
      } catch (err) {
        // A retriever health check that times out is a refusal, not a 500.
        return {
          gate: 'sufficiency',
          status: 'refuse',
          code: 'sufficiency/predicate-error',
          detail: containedFailure('the sufficiency predicate', err)
        };
      }
      return verdict === true
        ? {
            gate: 'sufficiency',
            status: 'pass',
            detail: `${view.retrieved.length} evidence record(s) retrieved`
          }
        : { gate: 'sufficiency', status: 'refuse', code: 'sufficiency/floor', detail: verdict };
    },
    pathToYes: () => 'retrieve more, widen the sources, or narrow the question'
  };
}

/** Gate: structure. The draft is parsed, never interpreted and never
 * repaired: a parse that fails is a refusal, not an invitation to fix the
 * output on the model's behalf. On success the parsed answer enters the
 * pipeline's own state for the gates downstream. */
export function structure(parse: (draft: unknown) => Answer): Gate {
  return {
    name: 'structure',
    run: (view) => {
      try {
        const answer = parse(view.draft);
        if (answer == null || !Array.isArray(answer.claims)) {
          return {
            gate: 'structure',
            status: 'refuse',
            code: 'structure/parse',
            detail: 'the parser returned something that is not an answer; a draft is rejected, never repaired'
          };
        }
        return {
          gate: 'structure',
          status: 'pass',
          detail: `${answer.claims.length} claim(s) parsed`,
          answer
        };
      } catch (err) {
        return {
          gate: 'structure',
          status: 'refuse',
          code: 'structure/parse',
          detail: `draft rejected, never repaired: ${err}`
        };
      }
    },
    pathToYes: () => 'regenerate against the schema; repair here would launder the malformation'
  };
}

/** A gate that reads the parsed answer refuses when no gate produced one:
 * nothing passes by not being measured. */
const NO_ANSWER = (gate: string): GateResult => ({
  gate,
  status: 'refuse',
  code: 'structure/missing',
  detail: 'no parsed answer reached this gate; compose the chain with structure() ahead of it'
});

/** Gate: executability. A well-formed answer can still describe something
 * this system cannot do. Everything the answer requires must be a
 * capability this deployment actually offers. */
export function executability(): Gate {
  return {
    name: 'executability',
    run: (view) => {
      if (view.answer == null) return NO_ANSWER('executability');
      const missing = (view.answer.requires ?? []).filter(
        (op) => !view.capabilities.includes(op)
      );
      return missing.length === 0
        ? {
            gate: 'executability',
            status: 'pass',
            detail: 'every required operation is offered here'
          }
        : {
            gate: 'executability',
            status: 'refuse',
            code: 'executability/missing-capability',
            detail: `requires what this system does not do: ${missing.join(', ')}`
          };
    },
    // Deliberately does not enumerate the deployment's capabilities: a
    // refusal the reader is shown must not publish the internal operation
    // inventory to whoever probed for it.
    pathToYes: () => 'restate without the operation this deployment does not offer'
  };
}

/** Gate: faithfulness. Every claim in the answer goes through the check
 * chain - citation resolution, verbatim, and whatever else the caller
 * composed - so this gate is the claim layer applied to a whole turn rather
 * than a second implementation of the same rules.
 *
 * An answer with no claims refuses. A fluent page standing on nothing is
 * the failure this package exists to prevent, and vacuous truth over an
 * empty list is exactly how it gets shipped. */
export function faithfulness(chain?: Check[]): Gate {
  return {
    name: 'faithfulness',
    run: (view) => {
      if (view.answer == null) return NO_ANSWER('faithfulness');
      const claims = view.answer.claims;
      if (claims.length === 0) {
        return {
          gate: 'faithfulness',
          status: 'refuse',
          code: 'faithfulness/empty-answer',
          detail: 'an answer with no claims is a refusal, not a pass: there is nothing to ground'
        };
      }
      const checks = chain ?? defaultChain();
      const index = indexEvidence(view.retrieved as Evidence[]);
      const failures = claims
        .map((claim, i) => ({ i, verdict: judgeClaim(claim, index, checks) }))
        .filter((f) => f.verdict.status === 'rejected');
      if (failures.length === 0) {
        return {
          gate: 'faithfulness',
          status: 'pass',
          detail: `${claims.length} claim(s), every one grounded in the evidence it cites`
        };
      }
      // Every violation, not the first: repairing N bad claims should cost
      // one regeneration, not N.
      return {
        gate: 'faithfulness',
        status: 'refuse',
        code: failures[0].verdict.code ?? 'faithfulness/rejected',
        detail: failures
          .map((f) => `claim ${f.i} (${f.verdict.failedCheck}): ${f.verdict.reason}`)
          .join('; ')
      };
    },
    pathToYes: () => 'cite retrieved evidence for every claim, or drop the claim'
  };
}

/** Gate: advisory. The human's stand-ins: style checks, model judges,
 * second opinions. Heard, recorded, and structurally unable to refuse -
 * whatever the opinion says, or however it fails, the status is advisory,
 * and the view it is handed is frozen so it cannot decide by acting
 * either. */
export function advisory(opinion: (view: GateView) => string): Gate {
  return {
    name: 'advisory',
    run: (view) => {
      try {
        return { gate: 'advisory', status: 'advisory', detail: opinion(view) };
      } catch (err) {
        return {
          gate: 'advisory',
          status: 'advisory',
          detail: containedFailure('the advisory opinion', err)
        };
      }
    }
  };
}

/** Run gates in the given order over the pipeline's own state. The caller's
 * context is never mutated and never even reachable: each gate is handed a
 * frozen deep copy, so a gate cannot rewrite what the gates after it see,
 * and a gate that tries throws - which is contained, and becomes a named
 * refusal rather than a silent outcome flip. */
export function runPipeline(ctx: GateContext, gates: Gate[]): PipelineOutcome {
  const base = frozenView({
    question: ctx.question,
    retrieved: ctx.retrieved,
    capabilities: ctx.capabilities
  });
  let answer: Answer | undefined;
  const results: GateResult[] = [];
  const notes: string[] = [];

  const viewFor = (): GateView =>
    Object.freeze({
      question: base.question,
      retrieved: base.retrieved,
      capabilities: base.capabilities,
      draft: ctx.draft, // opaque caller data: passed through, never copied
      ...(answer != null ? { answer: frozenView(answer) } : {})
    });

  for (const gate of gates) {
    const view = viewFor();
    let result: GateResult;
    try {
      result = gate.run(view);
    } catch (err) {
      result = {
        gate: gate.name,
        status: 'refuse',
        code: 'gate/error',
        detail: containedFailure(`gate ${gate.name}`, err)
      };
    }
    results.push(result);
    if (result.answer != null) answer = result.answer;
    if (result.status === 'advisory') {
      notes.push(`${result.gate}: ${result.detail}`);
      continue;
    }
    if (result.status === 'refuse') {
      let pathToYes: string;
      try {
        pathToYes = gate.pathToYes?.(view) ?? 'address the named condition and re-run';
      } catch (err) {
        pathToYes = `${containedFailure('the path-to-yes generator', err)}; address the named condition and re-run`;
      }
      return {
        outcome: 'refuse',
        gates: results,
        refusal: {
          gate: result.gate,
          code: result.code ?? `${result.gate}/refused`,
          reason: result.detail,
          pathToYes
        },
        notes
      };
    }
  }
  return { outcome: 'ship', gates: results, notes, ...(answer != null ? { answer } : {}) };
}

/** The standard composition, in the order that makes each refusal as cheap
 * as it can be: sufficiency before anything is generated, then structure,
 * executability, faithfulness, and the advisory voices last. */
export function standardPipeline(config: {
  parse: (draft: unknown) => Answer;
  enough?: (view: GateView) => true | string;
  /** the check chain faithfulness runs per claim; defaults to citations + verbatim */
  chain?: Check[];
  opinions?: Array<(view: GateView) => string>;
}): Gate[] {
  return [
    sufficiency(config.enough),
    structure(config.parse),
    executability(),
    faithfulness(config.chain),
    ...(config.opinions ?? []).map(advisory)
  ];
}
