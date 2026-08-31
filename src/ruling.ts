/** Run the chain over every claim; rule on the answer as a whole.
 *
 * The runner enforces the structural rule the chain promises: a decisive
 * check that fails ends the claim with the check named; an advisory result
 * becomes a note whatever it said. The answer-level ruling derives from
 * counts alone - claims carry no confidence, so there is no number to
 * argue with, only outcomes. */

import { indexEvidence } from './evidence.ts';
import type { Claim, Evidence } from './evidence.ts';
import type { Check } from './checks.ts';
import { defaultChain } from './checks.ts';

export interface ClaimVerdict {
  claim: Claim;
  status: 'accepted' | 'rejected';
  /** which decisive check ended it, when one did */
  failedCheck?: string;
  reason?: string;
  /** advisory output, and any oddities worth keeping */
  notes: string[];
}

export type RulingStatus = 'grounded' | 'contested' | 'insufficient';

export interface Ruling {
  status: RulingStatus;
  verdicts: ClaimVerdict[];
  accepted: ClaimVerdict[];
  rejected: ClaimVerdict[];
  /** the sentence the reader gets when nothing survives */
  statement: string;
  chain: string[];
}

export interface RulingOptions {
  chain?: Check[];
  /** Rejected fraction STRICTLY above which the survivors ship contested.
   * The default 0.5 means exactly half rejected still ships grounded
   * (2 of 4 rejected: grounded; 3 of 4: contested). Lower it for a
   * touchier answer. */
  contestedAbove?: number;
}

export function judgeClaim(claim: Claim, evidence: Map<string, Evidence>, chain: Check[]): ClaimVerdict {
  const cited = claim.cites.map((id) => evidence.get(id)).filter((e): e is Evidence => e != null);
  const missing = claim.cites.filter((id) => !evidence.has(id));
  const notes: string[] = [];
  for (const check of chain) {
    const result = check.run(claim, cited, missing);
    if (check.kind === 'advisory') {
      if (result.reason) notes.push(`${check.name}: ${result.reason}`);
      continue; // advisory is structurally unable to reject
    }
    if (!result.ok) {
      return { claim, status: 'rejected', failedCheck: check.name, reason: result.reason, notes };
    }
  }
  return { claim, status: 'accepted', notes };
}

export function rule(claims: Claim[], evidence: Evidence[], opts: RulingOptions = {}): Ruling {
  const chain = opts.chain ?? defaultChain();
  const contestedAbove = opts.contestedAbove ?? 0.5;
  const index = indexEvidence(evidence);
  const verdicts = claims.map((c) => judgeClaim(c, index, chain));
  const accepted = verdicts.filter((v) => v.status === 'accepted');
  const rejected = verdicts.filter((v) => v.status === 'rejected');

  let status: RulingStatus;
  let statement: string;
  if (accepted.length === 0) {
    status = 'insufficient';
    statement =
      claims.length === 0
        ? 'no claims were offered; there is nothing to ground'
        : `no claim survived the chain (${rejected.length} rejected); the answer is declined, not composed`;
  } else if (verdicts.length > 0 && rejected.length / verdicts.length > contestedAbove) {
    status = 'contested';
    statement = `${rejected.length} of ${verdicts.length} claims rejected; the surviving claims ship marked contested`;
  } else {
    status = 'grounded';
    statement = `${accepted.length} claim(s) grounded against the evidence`;
  }

  return { status, verdicts, accepted, rejected, statement, chain: chain.map((c) => c.name) };
}
