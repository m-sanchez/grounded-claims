/** The firewall is a test, and it covers the whole package: no file under
 * src/ may import a network primitive, an HTTP client, a model SDK, or a
 * process spawner. Offline by proof, not by promise. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'src');

const FORBIDDEN: ReadonlyArray<RegExp> = [
  /from\s+['"]node:https?['"]/,
  /from\s+['"]node:net['"]/,
  /from\s+['"]node:dgram['"]/,
  /from\s+['"]node:child_process['"]/,
  /\bfetch\s*\(/,
  /from\s+['"](axios|undici|ws|got|node-fetch)['"]/,
  /from\s+['"]@?anthropic/i,
  /from\s+['"]openai/i,
  /ollama/i,
  /XMLHttpRequest|WebSocket|EventSource/
];

// recursive: a file added in a subdirectory tomorrow is covered today
const files = readdirSync(SRC, { recursive: true })
  .map(String)
  .filter((f) => f.endsWith('.ts'));

test('the src tree exists and is non-trivial (sanity)', () => {
  assert.ok(files.length >= 5);
});

for (const file of files) {
  test(`firewall: src/${file} imports no network, model, or process primitive`, () => {
    const source = readFileSync(path.join(SRC, file), 'utf8');
    for (const pattern of FORBIDDEN) {
      assert.ok(
        !pattern.test(source),
        `src/${file} matches forbidden pattern ${pattern}`
      );
    }
  });
}
