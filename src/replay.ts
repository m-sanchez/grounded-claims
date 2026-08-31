/** Run records and replay. A record is self-contained JSON: the claims,
 * the evidence, the chain names, and the ruling, canonically hashed. No
 * database, no loader; the record IS the run. replay() re-derives the
 * ruling from the record's own frozen inputs and reports every divergence.
 *
 * Canonical form (the same convention as careful-router): object keys
 * sorted, no insignificant whitespace, SHA-256 hex, and numbers must be
 * finite - the hash is only as trustworthy as the bytes are stable. */

import { createHash } from 'node:crypto';
import type { Claim, Evidence } from './evidence.ts';
import { rule } from './ruling.ts';
import type { Ruling, RulingOptions } from './ruling.ts';

export function canonicalize(value: unknown): string {
  if (value === null) return 'null';
  switch (typeof value) {
    case 'boolean':
      return value ? 'true' : 'false';
    case 'number':
      if (!Number.isFinite(value)) throw new TypeError('non-finite number in canonical form');
      return String(value);
    case 'string':
      return JSON.stringify(value);
    case 'object': {
      if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
      const entries = Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(',')}}`;
    }
    default:
      throw new TypeError(`cannot canonicalize a ${typeof value}`);
  }
}

export const hashOf = (value: unknown): string =>
  createHash('sha256').update(canonicalize(value), 'utf8').digest('hex');

export interface RunRecord {
  version: 1;
  claims: Claim[];
  evidence: Evidence[];
  options: { contestedAbove: number };
  chain: string[];
  ruling: Ruling;
  evidenceHash: string;
  claimsHash: string;
  recordHash: string;
}

/** Freeze a run. The chain travels by name; replay rebuilds the default
 * chain, so records made with custom checks need those checks re-supplied. */
export function record(claims: Claim[], evidence: Evidence[], opts: RulingOptions = {}): RunRecord {
  const ruling = rule(claims, evidence, opts);
  const body = {
    version: 1 as const,
    claims,
    evidence,
    options: { contestedAbove: opts.contestedAbove ?? 0.5 },
    chain: ruling.chain,
    ruling,
    evidenceHash: hashOf(evidence),
    claimsHash: hashOf(claims)
  };
  return { ...body, recordHash: hashOf(body) };
}

export interface ReplayResult {
  identical: boolean;
  hashIntact: boolean;
  divergences: string[];
  reproduced: Ruling;
}

export function replay(rec: RunRecord, opts: RulingOptions = {}): ReplayResult {
  const { recordHash, ...body } = rec;
  const hashIntact =
    hashOf(body) === recordHash &&
    hashOf(rec.evidence) === rec.evidenceHash &&
    hashOf(rec.claims) === rec.claimsHash;

  const reproduced = rule(rec.claims, rec.evidence, {
    ...opts,
    contestedAbove: rec.options.contestedAbove
  });

  const divergences: string[] = [];
  if (!hashIntact) divergences.push('record altered after it was written');
  if (reproduced.status !== rec.ruling.status) {
    divergences.push(`status ${rec.ruling.status} reproduced as ${reproduced.status}`);
  }
  reproduced.verdicts.forEach((v, i) => {
    const then = rec.ruling.verdicts[i];
    if (!then || then.status !== v.status) {
      divergences.push(`claim ${i}: recorded ${then?.status ?? 'missing'}, reproduced ${v.status}`);
    }
  });

  return { identical: divergences.length === 0, hashIntact, divergences, reproduced };
}
