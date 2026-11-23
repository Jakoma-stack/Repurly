import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// A schema drift regression test for the committed SQL migration journal.
// It checks table/column coverage, not types, constraints or index equivalence.
test('every declared Drizzle table column exists in a journaled SQL migration', () => {
  const schema = readFileSync('drizzle/schema.ts', 'utf8');
  const journal = JSON.parse(readFileSync('drizzle/migrations/meta/_journal.json', 'utf8')) as {
    entries: Array<{ tag: string }>;
  };
  const sql = journal.entries
    .map(({ tag }) => readFileSync('drizzle/migrations/' + tag + '.sql', 'utf8'))
    .join('\n');

  const actual = new Map<string, Set<string>>();
  for (const match of sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)? "([^"]+)" \(([\s\S]*?)\);/g)) {
    const columns = actual.get(match[1]) ?? new Set<string>();
    for (const col of match[2].matchAll(/^\s*"([^"]+)"\s+(?:uuid|varchar|text|integer|boolean|jsonb|timestamp|numeric|date|double precision|"[^"]+")/gm)) {
      columns.add(col[1]);
    }
    actual.set(match[1], columns);
  }
  for (const match of sql.matchAll(/ALTER TABLE "([^"]+)" ADD COLUMN(?: IF NOT EXISTS)? "([^"]+)"/g)) {
    const columns = actual.get(match[1]) ?? new Set<string>();
    columns.add(match[2]);
    actual.set(match[1], columns);
  }

  const missing: string[] = [];
  for (const table of schema.matchAll(/export const \w+ = pgTable\("([^"]+)", \{([\s\S]*?)\}\);/g)) {
    const declared = [...table[2].matchAll(/^\s*\w+:\s+\w+\("([^"]+)"/gm)].map((m) => m[1]);
    for (const column of declared) {
      if (!actual.get(table[1])?.has(column)) missing.push(table[1] + '.' + column);
    }
  }
  assert.deepEqual(missing, []);
});
