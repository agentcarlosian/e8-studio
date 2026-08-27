import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  enumerateE8Lattice,
  generateE8Quasicrystal,
  quasicrystalReliefHeight,
} from '../src/math/e8-quasicrystal.js';

const e8 = JSON.parse(await readFile(new URL('../data/e8.json', import.meta.url), 'utf8'));
assert.equal(enumerateE8Lattice(4).length, 2401, 'E8 lattice ball through squared norm 4');
assert.equal(enumerateE8Lattice(6).length, 9121, 'E8 lattice ball through squared norm 6');
assert.equal(enumerateE8Lattice(8).length, 26641, 'E8 lattice ball through squared norm 8');

const patch = generateE8Quasicrystal(e8);
assert.equal(patch.sourceDimension, 8);
assert.equal(patch.physicalDimension, 2);
assert.equal(patch.internalDimension, 6);
assert.equal(patch.symmetryOrder, 30);
assert.ok(patch.pointCount > 100, `expected a substantial patch, received ${patch.pointCount}`);
assert.ok(patch.edgeCount > patch.pointCount, 'proximity graph should reveal local structure');
assert.equal(patch.diffraction.length, 240, 'one reciprocal candidate per E8 root');
assert.equal(patch.diffractionCandidateCount, 240, 'E8 reciprocal root-shell count');
assert.ok(patch.points.every(point => point.coords.length === 8));
assert.ok(patch.points.every(point => point.shiftedInternalRadius <= patch.windowRadius + 1e-9));
assert.ok(patch.points.every(point => point.normalized.every(value => Number.isFinite(value))));
assert.equal(quasicrystalReliefHeight(patch.points[0], 'pattern', 0), 0, 'zero relief keeps the pattern flat');
assert.notEqual(
  quasicrystalReliefHeight(patch.points[0], 'window', 0.2),
  quasicrystalReliefHeight(patch.points.at(-1), 'window', 0.2),
  'window relief follows acceptance depth',
);
assert.notEqual(
  quasicrystalReliefHeight(patch.diffraction[0], 'diffraction', 0.2),
  quasicrystalReliefHeight(patch.diffraction.at(-1), 'diffraction', 0.2),
  'diffraction relief follows reciprocal intensity',
);

const shifted = generateE8Quasicrystal(e8, { phason: 0.35 });
assert.notDeepEqual(
  shifted.points.map(point => point.sourceIndex),
  patch.points.map(point => point.sourceIndex),
  'moving the internal-space window should change the selected lattice patch',
);

const alternateProjection = structuredClone(e8);
[alternateProjection.coxeter_basis.re, alternateProjection.coxeter_basis.im] = [
  alternateProjection.coxeter_basis.im,
  alternateProjection.coxeter_basis.re,
];
const alternatePatch = generateE8Quasicrystal(alternateProjection);
assert.deepEqual(alternatePatch.projectionBasis.re, patch.projectionBasis.im);
assert.deepEqual(alternatePatch.projectionBasis.im, patch.projectionBasis.re);
assert.notStrictEqual(alternatePatch, patch, 'patch caches must remain scoped to their E8 projection data');

const cleanPatternPatch = generateE8Quasicrystal(e8, { includeDiffraction: false, includeEdges: false });
assert.equal(cleanPatternPatch.pointCount, patch.pointCount, 'deferred diffraction must not change the projected patch');
assert.equal(cleanPatternPatch.diffraction.length, 0, 'pattern mode can defer structure-factor work');
assert.equal(cleanPatternPatch.diffractionCandidateCount, 240, 'deferred patches still report the reciprocal candidate count');
assert.equal(cleanPatternPatch.edges.length, 0, 'non-pattern readings can defer the local display graph');

console.log(`E8 quasicrystal passed: ${patch.pointCount} points, ${patch.edgeCount} links, ${patch.diffraction.length} reciprocal peaks.`);
