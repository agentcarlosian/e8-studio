import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import {
  enumerateE8Lattice,
  generateE8Quasicrystal,
  quasicrystalReliefHeight,
} from '../src/math/e8-quasicrystal.js';
import { createQuasicrystalView } from '../src/views/quasicrystal.view.js';

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
for (const [reach, radius, phason, expectedDigest] of [
  [8, 2.4, 0.31, 'a51418ab602381a9ec463e284efe951d816cedab7e7ad2ccc159bc7452a88581'],
  [6, 2.4, 0.31, '6ad96b7cf3bc8e600d7bedebea606b5b28d8636f11ec0cac3b658188db7c2093'],
  [8, 1.42, 0, 'fa49ca5bdf88b44490b206072bc733b8232db656b316d33187a7fcea7707e8ff'],
  [4, 2.4, 0.31, '94fa565e337440872d22eab3e8661c334335fa9a0f168246dde2b630c11d9c8a'],
  // Cover both dense fast-path radii, the full-radius fallback, and a sparse
  // accepted patch. These hashes pin the ordered links, including sort ties.
  [8, 2, -1.2, '1d8de4b4d9b5d0e75efaa55a256fd34a9f436c43da58f93d19ba5720a9eefa8d'],
  [8, 2.2, 0.31, '5a20e0e6061aaa68fca0b92138b9bf603c4bf01d4e4ae2aff1e7c4fe5a5db29c'],
  [8, 2.4, 1.2, '52d2b943f92f221acc5af2f6963cfb837cbb74ef99f8131a2af83730fdfc8359'],
  [6, 2.4, -1.2, 'caf8f2938f21e9c9ca8a2564aa9a4e11406e1e493194ec9992d71e18cb81e932'],
  [4, 0.8, -1.2, '4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945'],
]) {
  const linked = generateE8Quasicrystal(e8, {
    maxNormSq: reach, windowRadius: radius, phason, includeDiffraction: false,
  });
  const digest = createHash('sha256').update(JSON.stringify(linked.edges)).digest('hex');
  assert.equal(digest, expectedDigest, `link order and endpoints stay identical at reach ${reach}, window ${radius}`);
}
assert.equal(patch.diffraction.length, 240, 'one reciprocal candidate per E8 root');
assert.equal(patch.diffractionCandidateCount, 240, 'E8 reciprocal root-shell count');
assert.ok(patch.points.every(point => point.coords.length === 8));
assert.ok(patch.points.every(point => point.shiftedInternalRadius <= patch.windowRadius + 1e-9));
assert.ok(patch.points.every(point => point.normalized.every(value => Number.isFinite(value))));
assert.ok(patch.points.every(point => Math.hypot(...point.normalized) <= 1 + 1e-9),
  'the fixed reach scale fits every projected candidate');
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

const tightWindow = generateE8Quasicrystal(e8, {
  maxNormSq: 6, windowRadius: 0.8, includeDiffraction: false, includeEdges: false,
});
const wideWindow = generateE8Quasicrystal(e8, {
  maxNormSq: 6, windowRadius: 1.42, includeDiffraction: false, includeEdges: false,
});
const widePoints = new Map(wideWindow.points.map(point => [point.coords.join(','), point]));
assert.equal(tightWindow.displayScale, wideWindow.displayScale,
  'changing the acceptance window must not change the visible-plane scale');
for (const point of tightWindow.points) {
  const retained = widePoints.get(point.coords.join(','));
  assert.ok(retained, 'widening a fixed window retains its selected lattice points');
  assert.deepEqual(point.normalized, retained.normalized,
    'a retained visible-plane point must not move when the window changes');
}

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

const optimizedE8 = structuredClone(e8);
const diffractionSteps = [
  { maxNormSq: 6, windowRadius: 1.42, phason: 0, method: 'full' },
  { maxNormSq: 6, windowRadius: 1.44, phason: 0, method: 'incremental' },
  { maxNormSq: 6, windowRadius: 1.46, phason: 0, method: 'incremental' },
  { maxNormSq: 6, windowRadius: 1.42, phason: 0, method: 'full' }, // cached revisit
  { maxNormSq: 6, windowRadius: 1.43, phason: 0.02, method: 'incremental' },
  { maxNormSq: 4, windowRadius: 1.42, phason: 0, method: 'full' },
  { maxNormSq: 4, windowRadius: 1.44, phason: 0.03, method: 'incremental' },
  { maxNormSq: 8, windowRadius: 1.42, phason: 0, method: 'full' },
  { maxNormSq: 8, windowRadius: 1.44, phason: 0.02, method: 'incremental' },
  { maxNormSq: 8, windowRadius: 2.4, phason: 1.2, method: 'full' },
  { maxNormSq: 8, windowRadius: 2.39, phason: 1.18, method: 'incremental' },
];
for (const { method, ...parameters } of diffractionSteps) {
  const options = { ...parameters, includeEdges: false };
  const optimized = generateE8Quasicrystal(optimizedE8, options);
  const full = generateE8Quasicrystal(structuredClone(e8), options);
  assert.equal(optimized.diffractionComputation, method, `expected ${method} at ${JSON.stringify(parameters)}`);
  assert.equal(optimized.pointCount, full.pointCount);
  const referenceByIndex = new Map(full.diffraction.map(peak => [peak.index, peak]));
  for (const peak of optimized.diffraction) {
    const reference = referenceByIndex.get(peak.index);
    assert.ok(reference && Math.abs(peak.intensity - reference.intensity) < 1e-10,
      `incremental intensity must match full recomputation for sample ${peak.index}`);
    assert.ok(Math.abs(peak.strength - reference.strength) < 1e-10,
      `relative strength must match full recomputation for sample ${peak.index}`);
  }
}

const refreshE8 = structuredClone(e8);
let refreshed;
let beforeRefresh;
for (let step = 0; step <= 33; step++) {
  refreshed = generateE8Quasicrystal(refreshE8, {
    maxNormSq: 4, windowRadius: 1 + step * 0.01, includeEdges: false,
  });
  if (step === 32) beforeRefresh = refreshed;
}
const beforeRefreshFull = generateE8Quasicrystal(structuredClone(e8), {
  maxNormSq: 4, windowRadius: 1.32, includeEdges: false,
});
assert.equal(beforeRefresh.diffractionComputation, 'incremental');
const beforeRefreshReference = new Map(beforeRefreshFull.diffraction.map(peak => [peak.index, peak.intensity]));
assert.ok(beforeRefresh.diffraction.every(peak =>
  Math.abs(peak.intensity - beforeRefreshReference.get(peak.index)) < 1e-10),
  '32 nearby updates stay consistent with full structure-factor values');
assert.equal(refreshed.diffractionComputation, 'full',
  'periodic full recomputation bounds incremental floating-point drift');

const originalWindow = globalThis.window;
globalThis.window = { devicePixelRatio: 1 };
try {
  for (const [mode, baseSize] of [['pattern', 17], ['window', 15], ['diffraction', 22]]) {
    const params = {
      quasiMode: mode, quasiReach: 4, quasiWindow: 1.42, quasiPhason: 0,
      quasiRelief: 0, pointScale: 1.5, autoRotate: false,
    };
    const view = createQuasicrystalView({ data: { e8 }, palette: 'gold', scale: 1, context: { params } });
    view.update(0, 0, params);
    const points = view.group.getObjectByName('QuasicrystalPoints');
    assert.equal(points.material.uniforms.uBaseSize.value, baseSize * params.pointScale,
      `${mode} preserves its mode-specific point size after update`);
    if (mode === 'window') assert.match(points.userData.tooltipData[0].html, /all six hidden coordinates/);
    view.dispose();
  }
} finally {
  if (originalWindow === undefined) delete globalThis.window;
  else globalThis.window = originalWindow;
}

console.log(`E8 quasicrystal passed: ${patch.pointCount} points, ${patch.edgeCount} links, ${patch.diffraction.length} reciprocal peaks.`);
