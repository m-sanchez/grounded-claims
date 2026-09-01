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

/** Compare two identifiers as the same fact written twice: case-folded,
 * thousands separators dropped, and a decimal fraction's trailing zeros
 * trimmed. 1,280 and 1280 are one number; so are 128.00 and 128. */
export function normaliseIdentifier(token: string): string {
  const bare = token.toLowerCase().replace(/,/g, '');
  return /^-?\d+\.\d+$/.test(bare) ? bare.replace(/0+$/, '').replace(/\.$/, '') : bare;
}

const escapeForRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Does `token` stand on its own in the corpus, or is it sitting inside a
 * longer identifier? The boundary is deliberately not `\b`, which is happy
 * on either side of a digit run: nothing alphanumeric and no hyphen or
 * underscore may touch either end, and a following decimal point plus
 * digit disqualifies too, because 128 is not 128.5. */
function standsAlone(token: string, corpus: string): boolean {
  const pattern = new RegExp(
    `(?<![0-9A-Za-z_-])${escapeForRegExp(token)}(?![0-9A-Za-z_-])(?!\\.\\d)`,
    'i'
  );
  return pattern.test(corpus);
}

/** Identifiers present in `text` but absent from `corpus`.
 *
 * Token boundaries, never substrings. Substring containment is the failure
 * this package exists to prevent: a hallucinated number is most often a
 * digit-substring of a real one on the same page, so `includes()` accepts
 * 47 against led-4471 and 12 against 128 - the exact shape of the lie.
 *
 * The corpus goes through the same identifiersIn pass as the claim, both
 * sides are normalised, and the token sets are compared. A claim token the
 * extractor never produces from the corpus (a caps code buried in
 * lowercase prose, say) gets one more chance: it must appear in the raw
 * corpus standing alone. */
export function fabricatedIn(text: string, corpus: string): string[] {
  const present = new Set(identifiersIn(corpus).map(normaliseIdentifier));
  return identifiersIn(text).filter((token) => {
    const normalised = normaliseIdentifier(token);
    if (present.has(normalised)) return false;
    return !standsAlone(token, corpus) && !standsAlone(normalised, corpus);
  });
}
