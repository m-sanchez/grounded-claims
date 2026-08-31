/** The check chain. Each check is named and ordered; each is either
 * decisive or advisory, and that kind is structural: the runner records an
 * advisory result as a note whatever it says. An LLM judge plugged in here
 * can inform the record; it cannot flip an outcome. That is the point. */

import { corpusOf, fabricatedIn } from './evidence.ts';
import type { Claim, Evidence } from './evidence.ts';

export interface CheckResult {
  ok: boolean;
  reason?: string;
}

export interface Check {
  name: string;
  kind: 'decisive' | 'advisory';
  run: (claim: Claim, cited: Evidence[], missing: string[]) => CheckResult;
}

/** Every cited id must resolve to an evidence record. */
export function citations(): Check {
  return {
    name: 'citations',
    kind: 'decisive',
    run: (_claim, _cited, missing) =>
      missing.length === 0
        ? { ok: true }
        : { ok: false, reason: `cites evidence that does not exist: ${missing.join(', ')}` }
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
        : { ok: false, reason: `token(s) absent from cited evidence: ${fabricated.join(', ')}` }
    }
  };
}

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
      const score = scorer(claim, cited);
      return score >= floor
        ? { ok: true }
        : { ok: false, reason: `support ${score.toFixed(3)} below floor ${floor}` };
    }
  };
}

/** An opinion with a microphone and no gavel. Whatever it returns is
 * recorded; the kind guarantees it never decides. */
export function judge(
  opinion: (claim: Claim, cited: Evidence[]) => string
): Check {
  return {
    name: 'judge',
    kind: 'advisory',
    run: (claim, cited) => ({ ok: true, reason: opinion(claim, cited) })
  };
}

export function defaultChain(): Check[] {
  return [citations(), verbatim()];
}
