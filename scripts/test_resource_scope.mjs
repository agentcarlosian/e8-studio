import assert from 'node:assert/strict';
import { createResourceScope } from '../src/platform/resource-scope.js';

const disposed = [];
const errors = [];
const scope = createResourceScope({ onDisposeError: error => errors.push(error.message) });
const retained = scope.track({ dispose: () => disposed.push('retained') });
scope.track({ dispose: () => disposed.push('owned') });
scope.track({ dispose: () => { throw new Error('expected failure'); } });
scope.release(retained);
scope.dispose();
scope.dispose();

assert.deepEqual(disposed, ['owned']);
assert.deepEqual(errors, ['expected failure']);
assert.equal(scope.size, 0);

scope.track({ dispose: () => disposed.push('late') });
assert.deepEqual(disposed, ['owned', 'late']);
console.log('Resource scope tests passed.');
