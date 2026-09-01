/** The check chain. Each check is named and ordered; each is either
 * decisive or advisory, and that kind is structural: the runner records an
 * advisory result as a note whatever it says. An LLM judge plugged in here
 * can inform the record; it cannot flip an outcome. That is the point. */

import { corpusOf, fabricatedIn } from './evidence.ts';
import type { Claim, Evidence } from './evidence.ts';

export interface CheckResult {
  ok: boolean;
  reason?: string;
  /** stable machine-readable cause, for callers that must route on the
   * failure rather than regex-match the prose. */
  code?: string;
}

export interface Check {
  name: string;
  kind: 'decisive' | 'advisory';
  run: (claim: Claim, cited: Evidence[], missing: string[]) => CheckResult;
}

/** A claim must cite, and every cited id must resolve to an evidence
 * record. The empty-cites case is the vacuous half of the same failure: a
 * claim that cites nothing satisfies "every cite resolves" perfectly and is
 * grounded in nothing at all. */
export function citations(): Check {
  return {
    name: 'citations',
    kind: 'decisive',
    run: (claim, _cited, missing) => {
      if (claim.cites.length === 0) {
        return {
          ok: false,
          code: 'citations/uncited',
          reason: 'cites nothing; a claim grounded in no evidence is not grounded'
        };
      }
      return missing.length === 0
        ? { ok: true }
        : {
            ok: false,
            code: 'citations/ghost-cite',
            reason: `cites evidence that does not exist: ${missing.join(', ')}`
          };
    }
  };
}

/** Identifier-like tokens in the claim must appear in the cited evidence.
 * A number, date, or id the evidence never mentions is named, and the
 * claim dies for it. */
export function verbatim(): Check {
  return {
    name: 'verbatim',
    kind: 'decisive',
    run: (claim, cited) => {
      const corpus = cited.map(corpusOf).join('\n');
      const fabricated = fabricatedIn(claim.text, corpus);
      return fabricated.length === 0
        ? { ok: true }
        : {
            ok: false,
            code: 'verbatim/fabricated-token',
            reason: `token(s) absent from cited evidence: ${fabricated.join(', ')}`
          }
    }
  };
}

/** Is this a promise? Checks here are synchronous by design - the package
 * is offline, so the model call belongs outside it - and an async plug-in
 * is the mistake an adopter is most likely to make. Naming it beats
 * recording "[object Promise]" and shipping. */
const isThenable = (value: unknown): boolean =>
  value != null &&
  (typeof value === 'object' || typeof value === 'function') &&
  typeof (value as { then?: unknown }).then === 'function';

const ASYNC_ADVICE =
  'grounded-claims checks are synchronous; call your model outside the chain and thread the result in';

/** Optional semantic gate: bring your own scorer (NLI, embeddings), state
 * the floor. Score and floor both land in the reason either way. */
export function support(
  scorer: (claim: Claim, cited: Evidence[]) => number,
  floor: number
): Check {
  return {
    name: 'support',
    kind: 'decisive',
    run: (claim, cited) => {
      let score: number;
      try {
        score = scorer(claim, cited);
      } catch (err) {
        return { ok: false, code: 'support/scorer-error', reason: `scorer errored: ${err}; an error is not a pass` };
      }
      if (isThenable(score)) {
        return {
          ok: false,
          code: 'support/async-scorer',
          reason: `scorer returned a promise; ${ASYNC_ADVICE}`
        };
      }
      if (Number.isNaN(score)) {
        return { ok: false, code: 'support/nan', reason: 'scorer returned NaN; not-a-number is not a pass' };
      }
      return score >= floor
        ? { ok: true }
        : {
            ok: false,
            code: 'support/below-floor',
            reason: `support ${score.toFixed(3)} below floor ${floor}`
          };
    }
  };
}

/** An opinion with a microphone and no gavel. Whatever it returns - or
 * however it fails - is recorded; the kind guarantees it never decides. */
export function judge(
  opinion: (claim: Claim, cited: Evidence[]) => string
): Check {
  return {
    name: 'judge',
    kind: 'advisory',
    run: (claim, cited) => {
      try {
        const said = opinion(claim, cited);
        return isThenable(said)
          ? { ok: true, reason: `opinion returned a promise, so it was not read; ${ASYNC_ADVICE}` }
          : { ok: true, reason: said };
      } catch (err) {
        return { ok: true, reason: `judge errored (still advisory): ${err}` };
      }
    }
  };
}

export function defaultChain(): Check[] {
  return [citations(), verbatim()];
}
