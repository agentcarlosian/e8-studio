import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { generateE8Quasicrystal } from '../src/math/e8-quasicrystal.js';
import { compareQuasicrystalPatches, quasicrystalComparisonScales } from '../src/ui/quasicrystal-comparison.js';

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
assert.ok(opened.highlightedPeakIds.size <= 16 && [...opened.highlightedPeakIds].every(id => opened.changedPeakIds.has(id)),
  'only the strongest changed samples are outlined, preserving the intensity display');

const withoutDiffraction = { windowRadius: 1.42, phason: 0, includeDiffraction: false, includeEdges: false };
const shortReach = generateE8Quasicrystal(e8, { ...withoutDiffraction, maxNormSq: 4 });
const longReach = generateE8Quasicrystal(e8, { ...withoutDiffraction, maxNormSq: 6 });
const extended = compareQuasicrystalPatches(shortReach, longReach);
assert.equal(extended.removed.length, 0, 'increasing reach must not mark shared lattice vectors as departed');
assert.equal(extended.added.length, longReach.pointCount - shortReach.pointCount);
const reachScales = quasicrystalComparisonScales(shortReach, longReach, extended.removed);
assert.equal(reachScales.pattern, longReach.displayScale);
assert.ok(shortReach.points.every(point => point.physicalRadius / reachScales.pattern <= 1 + 1e-9),
  'baseline points fit when reach changes');

const movedWindow = generateE8Quasicrystal(e8, {
  ...withoutDiffraction, maxNormSq: 6, windowRadius: 0.8, phason: -1.2,
});
const departed = compareQuasicrystalPatches(longReach, movedWindow).removed;
const movedScales = quasicrystalComparisonScales(longReach, movedWindow, departed);
assert.ok(departed.length > 0 && movedScales.window > movedWindow.windowRadius,
  'the window thumbnail needs space beyond the current acceptance circle');
assert.ok(departed.every(point =>
  Math.hypot(point.internal2[0] - movedWindow.phason, point.internal2[1]) / movedScales.window <= 1 + 1e-9),
  'every departing point fits in the thumbnail');
console.log(`Linked comparison passed: +${opened.added.length} points, ${opened.changedPeaks} changed peaks.`);
