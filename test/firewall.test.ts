/** The firewall is a test, and it covers the whole package: no file under
 * src/ may import a network primitive, an HTTP client, a model SDK, or a
 * process spawner. Offline by proof, not by promise.
 *
 * Two halves, because either alone is decoration: the lint must find
 * nothing in src/, AND the lint must be shown to find the things it claims
 * to find. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FORBIDDEN, KNOWN_ESCAPES } from './network-patterns.ts';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

// recursive: a file added in a subdirectory tomorrow is covered today
const files = readdirSync(SRC, { recursive: true })
  .map(String)
  .filter((f) => f.endsWith('.ts'));

test('the src tree exists and is non-trivial (sanity)', () => {
  assert.ok(files.length >= 5);
});

test('the lint catches every escape it claims to, dynamic imports included', () => {
  for (const snippet of KNOWN_ESCAPES) {
    assert.ok(
      FORBIDDEN.some((pattern) => pattern.test(snippet)),
      `no forbidden pattern matches: ${snippet}`
    );
  }
});

test('the lint is not a rubber stamp: ordinary source passes it', () => {
  for (const snippet of [
    "import { createHash } from 'node:crypto';",
    "import path from 'node:path';",
    "const corpus = cited.map(corpusOf).join('\\n');",
    'export function rule(claims: Claim[], evidence: Evidence[]): Ruling {'
  ]) {
    assert.ok(
      !FORBIDDEN.some((pattern) => pattern.test(snippet)),
      `a forbidden pattern wrongly matches ordinary source: ${snippet}`
    );
  }
});

for (const file of files) {
  test(`firewall: src/${file} imports no network, model, or process primitive`, () => {
    const source = readFileSync(path.join(SRC, file), 'utf8');
    for (const pattern of FORBIDDEN) {
      assert.ok(!pattern.test(source), `src/${file} matches forbidden pattern ${pattern}`);
    }
  });
}
