import assert from 'node:assert/strict';

process.env.TZ = 'America/Chicago';

const store = new Map();
globalThis.localStorage = {
  getItem: key => store.get(key) ?? null,
  setItem: (key, value) => store.set(key, String(value)),
};

const { localDateKey, normalizeProgress, setLessonComplete, setExperimentStepComplete } = await import('../src/state/progress.js');

const localLateNight = new Date(2026, 0, 2, 23, 30, 0);
assert.equal(localDateKey(localLateNight), '2026-01-02', 'daily progress follows the user local calendar');

const migrated = normalizeProgress({ lessons: { 'coxeter-plane': true, 'mckay-bridge': { completedAt: '2026-01-02T03:04:05.000Z' } } });
assert.deepEqual(migrated.lessons['coxeter-plane'], { completedAt: null });
assert.equal(migrated.lessons['mckay-bridge'].completedAt, '2026-01-02T03:04:05.000Z');

const completed = setLessonComplete(migrated, 'distance-fields', true, '2026-02-03T04:05:06.000Z');
assert.equal(completed.lessons['distance-fields'].completedAt, '2026-02-03T04:05:06.000Z');
assert.equal(JSON.parse(store.get('e8_progress_v1')).lessons['distance-fields'].completedAt, '2026-02-03T04:05:06.000Z');

const reopened = setLessonComplete(completed, 'distance-fields', false);
assert.equal(reopened.lessons['distance-fields'], undefined);
assert.equal(reopened.lessons['mckay-bridge'].completedAt, '2026-01-02T03:04:05.000Z');

const observed = setExperimentStepComplete(reopened, 'coxeter-plane', 'rings', true, '2026-02-04T05:06:07.000Z');
assert.deepEqual(observed.experiments['coxeter-plane'].completedSteps, ['rings']);
const observedAgain = setExperimentStepComplete(observed, 'coxeter-plane', 'rings', true);
assert.deepEqual(observedAgain.experiments['coxeter-plane'].completedSteps, ['rings'], 'experiment steps stay unique');
const unobserved = setExperimentStepComplete(observedAgain, 'coxeter-plane', 'rings', false);
assert.deepEqual(unobserved.experiments['coxeter-plane'].completedSteps, []);
console.log('Learning progress migration and completion tests passed.');
