import assert from 'node:assert/strict';
import { ESSAYS, ESSAY_PROVENANCE } from '../src/content/essays.js';
import { BIOGRAPHIES, TIMELINE, DAILY_FACTS, QUIZ_MODULES, CURIOUS_CARDS, LEARNING_CONTENT_PROVENANCE } from '../src/content/learning.js';
import { GLOSSARY } from '../src/content/glossary.js';
import { FACT_SOURCES } from '../src/content/sources.js';

const claimTypes = new Set(['established-mathematics', 'historical-context', 'interpretation', 'app-designed-visualization', 'rendering-technique']);
const collections = [
  ['essay', Object.entries(ESSAYS).map(([id, value]) => ({ id, ...value }))],
  ['biography', BIOGRAPHIES], ['timeline', TIMELINE], ['daily fact', DAILY_FACTS],
  ['quiz', QUIZ_MODULES], ['curiosity card', Object.entries(CURIOUS_CARDS).map(([id, value]) => ({ id, ...value }))],
  ['glossary entry', GLOSSARY],
];

for (const [kind, records] of collections) {
  assert.ok(records.length, `${kind} collection`);
  for (const record of records) {
    assert.ok(record.id, `${kind} id`);
    assert.ok(claimTypes.has(record.claimType), `${kind} ${record.id} claim type`);
    assert.ok(record.scopeNote?.length >= 35, `${kind} ${record.id} scope note`);
    assert.ok(record.sourceIds?.length, `${kind} ${record.id} source coverage`);
    for (const sourceId of record.sourceIds) assert.ok(FACT_SOURCES[sourceId], `${kind} ${record.id} source ${sourceId}`);
  }
}

assert.deepEqual(Object.keys(ESSAY_PROVENANCE).sort(), Object.keys(ESSAYS).sort(), 'essay provenance exact coverage');
assert.deepEqual(Object.keys(LEARNING_CONTENT_PROVENANCE.biographies).sort(), BIOGRAPHIES.map(item => item.id).sort(), 'biography provenance exact coverage');
assert.equal(LEARNING_CONTENT_PROVENANCE.timeline.length, TIMELINE.length, 'timeline provenance exact coverage');
assert.deepEqual(Object.keys(LEARNING_CONTENT_PROVENANCE.daily).sort(), DAILY_FACTS.map(item => item.id).sort(), 'daily provenance exact coverage');
assert.deepEqual(Object.keys(LEARNING_CONTENT_PROVENANCE.quizzes).sort(), QUIZ_MODULES.map(item => item.id).sort(), 'quiz provenance exact coverage');

for (const [sourceId, source] of Object.entries(FACT_SOURCES)) {
  assert.ok(source.title && source.author && source.scope && source.tier, `source ${sourceId} metadata`);
  assert.match(source.url, /^https:\/\//, `source ${sourceId} HTTPS URL`);
}

const shippedCopy = JSON.stringify({ ESSAYS, BIOGRAPHIES, TIMELINE, DAILY_FACTS, QUIZ_MODULES, GLOSSARY });
for (const stale of [
  'irregular, not regular, 30-gon',
  'which is built from E₈',
  'non-associativity is exactly what makes',
  'one of the few gauge groups quantum mechanics permits',
  'The 3-sphere has genus 0, so the planar bound',
]) assert.ok(!shippedCopy.includes(stale), `removed disputed claim: ${stale}`);

console.log(`Content integrity passed: ${collections.reduce((sum, [, records]) => sum + records.length, 0)} records, ${Object.keys(FACT_SOURCES).length} sources.`);
