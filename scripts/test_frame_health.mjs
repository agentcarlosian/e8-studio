import assert from 'node:assert/strict';
import { FrameHealthController } from '../src/platform/frame-health.js';

const failures = [];
const trips = [];
const health = new FrameHealthController({
  failureLimit: 3,
  onFailure: (_error, state) => failures.push(state),
  onTrip: (_error, state) => trips.push(state),
});

health.reset('bloom');
assert.equal(health.run(() => { throw new Error('transient'); }), false);
assert.equal(health.run(() => {}), true);
assert.equal(health.snapshot().consecutiveFailures, 0);

let calls = 0;
for (let index = 0; index < 3; index += 1) {
  health.run(() => { calls += 1; throw new Error(`failure ${index}`); });
}
assert.equal(health.snapshot().tripped, true);
assert.equal(health.snapshot().totalFailures, 4);
assert.equal(trips.length, 1);
assert.equal(health.run(() => { calls += 1; }), false);
assert.equal(calls, 3);

health.reset('platonic');
assert.deepEqual(health.snapshot(), {
  viewId: 'platonic', consecutiveFailures: 0, totalFailures: 0, tripped: false, lastError: null,
});
assert.equal(health.run(() => {}), true);
assert.equal(failures.length, 4);
console.log('Frame health tests passed.');
