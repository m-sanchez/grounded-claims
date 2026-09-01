/** CLAIMS.md maps every falsifiable claim in the README to the test that
 * enforces it. A map pointing at tests that do not exist is worse than no
 * map, so the map is checked: every reference must resolve to a real test,
 * and every test file must be reachable from it. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const claims = readFileSync(path.join(HERE, '..', 'CLAIMS.md'), 'utf8');

/** `test/foo.test.ts::the name of the test` inside a backtick span. */
const REFERENCE = /`(test\/[a-z0-9.-]+\.test\.ts)::([^`]+)`/g;

const references = [...claims.matchAll(REFERENCE)].map((m) => ({ file: m[1], name: m[2] }));

const sourceOf = new Map<string, string>();
const read = (file: string): string => {
  const cached = sourceOf.get(file);
  if (cached != null) return cached;
  const source = readFileSync(path.join(HERE, '..', file), 'utf8');
  sourceOf.set(file, source);
  return source;
};

test('CLAIMS.md maps enough claims to be a map at all', () => {
  assert.ok(references.length >= 90, `only ${references.length} claim references found`);
});

test('every test CLAIMS.md points at exists', () => {
  const broken: string[] = [];
  for (const ref of references) {
    const source = read(ref.file);
    // A reference may end in a `<placeholder>` for a generated test name;
    // match on the literal prefix in that case.
    const literal = ref.name.split('<')[0];
    const found = ref.name === literal
      ? source.includes(`test('${ref.name}'`) || source.includes(`test(\`${ref.name}\``)
      : new RegExp(`test\\(\`?${literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(source);
    if (!found) broken.push(`${ref.file}::${ref.name}`);
  }
  assert.deepEqual(broken, [], 'CLAIMS.md points at tests that do not exist');
});

test('every test file is reachable from CLAIMS.md', () => {
  const cited = new Set(references.map((r) => r.file));
  const onDisk = readdirSync(HERE)
    .filter((f) => f.endsWith('.test.ts'))
    // this file checks the map; it is not itself a claim in the README
    .filter((f) => f !== 'claims-map.test.ts')
    .map((f) => `test/${f}`);
  assert.deepEqual(
    onDisk.filter((f) => !cited.has(f)),
    [],
    'a test file no claim points at is either unclaimed behaviour or a missing README row'
  );
});
