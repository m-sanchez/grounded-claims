/** Evidence and claims. One deliberate omission does most of the work here:
 * a claim carries no confidence field. A claim cannot certify itself, so
 * there is nothing on it for downstream code to be tempted to trust. What a
 * claim may do is cite evidence; everything else is decided by checks. */

export interface Evidence {
  id: string;
  text: string;
  /** structured values; matched as strings by the verbatim check */
  data?: Record<string, string | number>;
}

export interface Claim {
  text: string;
  /** evidence ids this claim rests on */
  cites: string[];
}

export function indexEvidence(evidence: Evidence[]): Map<string, Evidence> {
  return new Map(evidence.map((e) => [e.id, e]));
}

/** The searchable corpus of one evidence record: its text plus every data
 * value rendered as a string. */
export function corpusOf(e: Evidence): string {
  const values = e.data ? Object.values(e.data).map(String).join(' ') : '';
  return `${e.text} ${values}`.trim();
}

const IDENTIFIER_PATTERNS: ReadonlyArray<RegExp> = [
  /\d{4}-\d{2}-\d{2}/g, // dates
  /\b[a-z]+[-_][a-z0-9_-]*\d[a-z0-9_-]*\b/gi, // hyphenated ids with a digit
  /\b[A-Z]{2,}\d+[A-Z0-9]*\b/g, // caps codes
  /\b\d[\d,.]+\b/g // numbers with two or more digits
];

/** Identifier-like tokens in a piece of text: the things a reader will take
 * as facts, and the things a fabrication needs. Longest match wins - the
 * parts of a date or a hyphenated id are not separate identifiers - and
 * single digits are ignored; they are grammar more often than data. */
export function identifiersIn(text: string): string[] {
  const spans: Array<{ start: number; end: number; token: string }> = [];
  for (const pattern of IDENTIFIER_PATTERNS) {
    for (const m of text.matchAll(pattern)) {
      const token = m[0].replace(/[,.]$/, '');
      spans.push({ start: m.index, end: m.index + token.length, token });
    }
  }
  const kept = spans.filter(
    (s) =>
      !spans.some(
        (other) => other !== s && other.start <= s.start && other.end >= s.end && other.token.length > s.token.length
      )
  );
  return [...new Set(kept.map((s) => s.token))];
}

/** Identifiers present in `text` but absent from `corpus`, comparison
 * case-insensitive and comma-blind for numbers. */
export function fabricatedIn(text: string, corpus: string): string[] {
  const haystack = corpus.toLowerCase().replace(/,/g, '');
  return identifiersIn(text).filter(
    (token) => !haystack.includes(token.toLowerCase().replace(/,/g, ''))
  );
}
