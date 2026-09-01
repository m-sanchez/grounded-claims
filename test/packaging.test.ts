/** Packaging claims are claims too. "Zero runtime dependencies" and "every
 * documented entry point is exported" are both trivially falsifiable by a
 * careless commit, and neither had a test. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as pkg from '../src/index.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

test('zero runtime dependencies, as the badge and the README both say', () => {
  assert.deepEqual(manifest.dependencies ?? {}, {});
  assert.deepEqual(manifest.peerDependencies ?? {}, {});
  assert.deepEqual(manifest.optionalDependencies ?? {}, {});
  assert.deepEqual(Object.keys(manifest.devDependencies).sort(), ['@types/node', 'typescript']);
});

test('every entry point the README uses is actually exported', () => {
  for (const name of [
    // turn layer
    'runPipeline',
    'standardPipeline',
    'sufficiency',
    'structure',
    'executability',
    'faithfulness',
    'advisory',
    // claim layer
    'rule',
    'judgeClaim',
    'citations',
    'verbatim',
    'support',
    'judge',
    'defaultChain',
    // page and record
    'compose',
    'ComposeIntegrityError',
    'record',
    'replay',
    'canonicalize',
    'hashOf',
    'Trace',
    // evidence
    'corpusOf',
    'fabricatedIn',
    'identifiersIn',
    'indexEvidence',
    'normaliseIdentifier',
    'frozenView'
  ]) {
    assert.equal(typeof (pkg as Record<string, unknown>)[name], 'function', `${name} is exported`);
  }
});

test('the README states the version the package actually is', () => {
  const readme = readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  assert.ok(
    readme.includes(`#v${manifest.version}`),
    `README pins a git tag that is not v${manifest.version}`
  );
});
