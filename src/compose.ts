/** The composer: a formatter with no imagination.
 *
 * Only accepted claims can appear in the output, every claim is re-checked
 * against its cited evidence at compose time, and drift throws instead of
 * rendering. Nothing in this file (or this package - see the firewall
 * test) can reach a network or a model: fabrication at the last step is
 * structurally impossible, not merely discouraged. */

import { corpusOf, fabricatedIn, indexEvidence } from './evidence.ts';
import type { Evidence } from './evidence.ts';
import type { ClaimVerdict, Ruling } from './ruling.ts';

export class ComposeIntegrityError extends Error {
  readonly verdict?: ClaimVerdict;

  constructor(message: string, verdict?: ClaimVerdict) {
    super(`compose integrity: ${message}`);
    this.name = 'ComposeIntegrityError';
    this.verdict = verdict;
  }
}

export interface ComposeOptions {
  title?: string;
  /** extra caveats to surface under the disclosure line */
  notes?: string[];
}

/** Claim text is model-authored, and the composed page is Markdown, so
 * claim text that renders as document structure is a forgery vector: a
 * claim carrying a newline, a rule, a heading, a block quote or its own
 * `disclosure:` line composes a second, fake footer above the real one,
 * indistinguishable to the reader. Such a claim invents no identifier, so
 * verbatim has nothing to say about it - which makes this the composer's
 * job, and a refusal rather than an escape: a claim that wants to be a
 * document is drift, exactly like a claim edited after ruling. */
const STRUCTURAL_OPENER = /^\s*(-{3,}|#|>|disclosure:)/m;
const LINE_BREAK = /[\n\r\u2028\u2029]/;

function refuseStructure(verdict: ClaimVerdict): void {
  const text = verdict.claim.text;
  if (LINE_BREAK.test(text)) {
    throw new ComposeIntegrityError(
      'accepted claim text contains a line break; claim text renders as one line, never as document structure',
      verdict
    );
  }
  const opener = STRUCTURAL_OPENER.exec(text);
  if (opener) {
    throw new ComposeIntegrityError(
      `accepted claim text opens with markdown structure (${opener[1]}); a claim may not render as a rule, heading, quote or disclosure line`,
      verdict
    );
  }
}

/** Render a ruling to Markdown. Refusals compose too: an insufficient
 * ruling renders its statement, never an empty confident page. */
export function compose(ruling: Ruling, evidence: Evidence[], opts: ComposeOptions = {}): string {
  const index = indexEvidence(evidence);
  const lines: string[] = [];
  if (opts.title) lines.push(`# ${opts.title}`, '');

  if (ruling.status === 'insufficient') {
    lines.push(ruling.statement, '');
  } else {
    if (ruling.status === 'contested') {
      lines.push(`> contested: ${ruling.statement}`, '');
    }
    for (const verdict of ruling.accepted) {
      // Paranoia at the last gate: the verdict says accepted, the composer
      // still re-derives it. A claim edited after ruling dies here.
      refuseStructure(verdict);
      const cited = verdict.claim.cites.map((id) => index.get(id));
      if (cited.some((e) => e == null)) {
        throw new ComposeIntegrityError(
          `accepted claim cites evidence the composer cannot resolve`,
          verdict
        );
      }
      const corpus = (cited as Evidence[]).map(corpusOf).join('\n');
      const fabricated = fabricatedIn(verdict.claim.text, corpus);
      if (fabricated.length > 0) {
        throw new ComposeIntegrityError(
          `claim text drifted after ruling; token(s) not in cited evidence: ${fabricated.join(', ')}`,
          verdict
        );
      }
      lines.push(`- ${verdict.claim.text} [${verdict.claim.cites.join(', ')}]`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push(
    `disclosure: ${ruling.accepted.length} claim(s) grounded, ${ruling.rejected.length} rejected; checks: ${ruling.chain.join(', ')}`
  );
  for (const note of opts.notes ?? []) lines.push(`note: ${note}`);
  return lines.join('\n');
}
