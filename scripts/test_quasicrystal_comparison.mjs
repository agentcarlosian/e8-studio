import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateE8Quasicrystal } from '../src/math/e8-quasicrystal.js';
import { compareQuasicrystalPatches } from '../src/ui/quasicrystal-comparison.js';

const e8 = JSON.parse(readFileSync(new URL('../data/e8.json', import.meta.url), 'utf8'));
const options = { maxNormSq: 8, phason: 0, includeDiffraction: true, includeEdges: false };
const smaller = generateE8Quasicrystal(e8, { ...options, windowRadius: 1.36 });
const larger = generateE8Quasicrystal(e8, { ...options, windowRadius: 1.50 });
const opened = compareQuasicrystalPatches(smaller, larger);
const closed = compareQuasicrystalPatches(larger, smaller);

assert.ok(opened.added.length > 0, 'wider window accepts additional lattice points');
assert.equal(opened.removed.length, 0, 'widening a fixed window does not remove points');
assert.equal(opened.added.length, larger.pointCount - smaller.pointCount);
assert.equal(closed.removed.length, opened.added.length);
assert.equal(closed.added.length, 0);
assert.ok(opened.changedPeaks > 0, 'finite-patch peak intensities respond to the changed selection');
console.log(`Linked comparison passed: +${opened.added.length} points, ${opened.changedPeaks} changed peaks.`);
