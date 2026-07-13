import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: key => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, String(value)),
};

const { normalizeProgress, setLessonComplete } = await import('../src/state/progress.js');

const migrated = normalizeProgress({ lessons: { 'coxeter-plane': true, 'mckay-bridge': { completedAt: '2026-01-02T03:04:05.000Z' } } });
assert.deepEqual(migrated.lessons['coxeter-plane'], { completedAt: null });
assert.equal(migrated.lessons['mckay-bridge'].completedAt, '2026-01-02T03:04:05.000Z');

const completed = setLessonComplete(migrated, 'distance-fields', true, '2026-02-03T04:05:06.000Z');
assert.equal(completed.lessons['distance-fields'].completedAt, '2026-02-03T04:05:06.000Z');
assert.equal(JSON.parse(store.get('e8_progress_v1')).lessons['distance-fields'].completedAt, '2026-02-03T04:05:06.000Z');

const reopened = setLessonComplete(completed, 'distance-fields', false);
assert.equal(reopened.lessons['distance-fields'], undefined);
assert.equal(reopened.lessons['mckay-bridge'].completedAt, '2026-01-02T03:04:05.000Z');
console.log('Learning progress migration and completion tests passed.');
