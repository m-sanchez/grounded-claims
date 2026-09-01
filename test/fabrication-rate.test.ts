/** Measure the verbatim check against an adversarial corpus, and pin the
 * numbers the README publishes - the misses included.
 *
 * A guarantee with no number attached is a mood. This test is the source of
 * the fabrication table in the README: if the counts move, the table is
 * wrong and the build says so. */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { fabricatedIn } from '../src/evidence.ts';

interface Case {
  name: string;
  category: string;
  fabricated: boolean;
  claim: string;
  corpus: string;
}

const FIXTURE = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'fabrication.fixture.json'
);
const cases: Case[] = JSON.parse(readFileSync(FIXTURE, 'utf8')).cases;

const tallyBy = (predicate: (c: Case) => boolean): Map<string, { caught: number; total: number }> => {
  const byCategory = new Map<string, { caught: number; total: number }>();
  for (const c of cases.filter(predicate)) {
    const row = byCategory.get(c.category) ?? { caught: 0, total: 0 };
    row.total += 1;
    if (fabricatedIn(c.claim, c.corpus).length > 0) row.caught += 1;
    byCategory.set(c.category, row);
  }
  return byCategory;
};

test('the published fabrication table is the measured one', () => {
  const flagged = (c: Case) => fabricatedIn(c.claim, c.corpus).length > 0;
  const fabrications = cases.filter((c) => c.fabricated);
  const faithful = cases.filter((c) => !c.fabricated);

  const caught = fabrications.filter(flagged);
  const missed = fabrications.filter((c) => !flagged(c));
  const falseAlarms = faithful.filter(flagged);

  // Printed so the numbers in the README can be re-derived by anyone
  // running the suite, not taken on trust.
  const rows = [...tallyBy(() => true).entries()]
    .map(([category, r]) => `  ${category.padEnd(20)} ${r.caught}/${r.total} flagged`)
    .join('\n');
  console.log(
    `fabrication corpus: ${cases.length} cases\n${rows}\n` +
      `  caught ${caught.length}/${fabrications.length} fabrications, ` +
      `${missed.length} missed, ${falseAlarms.length} false alarms on ${faithful.length} faithful claims`
  );

  assert.equal(cases.length, 42, 'corpus size');
  assert.equal(fabrications.length, 28);
  assert.equal(faithful.length, 14);
  assert.equal(caught.length, 21, 'fabrications caught');
  assert.equal(missed.length, 7, 'fabrications missed');
  assert.equal(falseAlarms.length, 0, 'faithful claims wrongly flagged');

  // Every miss is a known blind spot, named in the README. A new miss in
  // a category verbatim is supposed to cover fails here.
  const blindSpots = new Set(['unit-blindness', 'negation-blindness', 'relation-blindness']);
  for (const c of missed) {
    assert.ok(blindSpots.has(c.category), `unexpected miss outside a documented blind spot: ${c.name}`);
  }
});

test('every category verbatim claims to cover is covered completely', () => {
  const covered = ['digit-substring', 'id-fragment', 'transposition', 'date', 'code', 'invention'];
  for (const category of covered) {
    const row = tallyBy((c) => c.category === category).get(category)!;
    assert.equal(row.caught, row.total, `${category}: ${row.caught}/${row.total} caught`);
  }
});

test('every row of the published per-category table is the measured one', () => {
  // The README prints these ratios; if any of them moves, the README is
  // wrong and this fails rather than the table quietly rotting.
  const published: Record<string, string> = {
    'digit-substring': '5/5',
    'id-fragment': '2/2',
    transposition: '2/2',
    date: '3/3',
    code: '2/2',
    invention: '6/6',
    'unit-blindness': '1/3',
    'negation-blindness': '0/2',
    'relation-blindness': '0/3',
    faithful: '0/14'
  };
  const measured = tallyBy(() => true);
  assert.deepEqual(
    Object.fromEntries([...measured].map(([k, r]) => [k, `${r.caught}/${r.total}`])),
    published
  );
});
