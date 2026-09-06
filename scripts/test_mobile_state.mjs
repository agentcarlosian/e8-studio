import assert from 'node:assert/strict';
import {
  DEFAULT_STATE,
  MOBILE_CONFIG_REVISION,
  SUPPORTED_MODEL_MODES,
  normalizeMobileState,
  restoreMobileState,
  zoomMaxForModel,
  autoZoomMinForModel,
  autoZoomMaxForModel,
} from '../src/mobile/state.js';


const defaultsBefore = { ...DEFAULT_STATE };
const legacy = { modelMode: 'e8_3d', background: 'space', showEdges: false, zoom: 5 };
const restored = restoreMobileState(legacy);
assert.equal(restored.modelMode, 'bloom');
assert.equal(restored.background, 'starfield');
assert.equal(restoreMobileState({ background: 'cloud' }).background, 'aurora');
assert.equal(restored.showEdges, true, 'pre-revision scenes adopt full chord topology once');
assert.equal(restored.zoom, 3.2, 'legacy 3D camera uses the model zoom limit');
assert.equal(restored.configRevision, MOBILE_CONFIG_REVISION);
assert.deepEqual(legacy, { modelMode: 'e8_3d', background: 'space', showEdges: false, zoom: 5 });
assert.equal(restoreMobileState({ configRevision: 1, showEdges: false }).showEdges, false,
  'an explicit edge toggle survives future launches');

const tiling = {
  ...DEFAULT_STATE,
  modelMode: 'tiling',
  tilingSystem: 'B2',
  tilingDensity: 6,
  tilingRelief: 0.24,
  tilingShowTiles: false,
  tilingShowEdges: false,
  tilingShowGrid: true,
  tilingShowRoots: true,
  tilingShowVertices: true,
  tilingAnimate: false,
  tilingFlowSpeed: 1.5,
};
assert.deepEqual(restoreMobileState(JSON.parse(JSON.stringify(tiling))), tiling,
  'reopening a tiling preserves every scene control');

const quasi = {
  ...DEFAULT_STATE,
  modelMode: 'quasicrystal',
  quasiMode: 'diffraction',
  quasiReach: 6,
  quasiWindow: 1.1,
  quasiPhason: -0.5,
  quasiRelief: 0.16,
  quasiReachAuto: true,
  quasiWindowAuto: true,
  quasiPhasonAuto: true,
  quasiReliefAuto: true,
  quasiShowPoints: false,
  quasiPointHalos: false,
  quasiShowLinks: false,
  quasiShowGuide: false,
};
assert.deepEqual(restoreMobileState(JSON.parse(JSON.stringify(quasi))), quasi,
  'reopening a quasicrystal preserves its inspection and animation controls');

for (const modelMode of SUPPORTED_MODEL_MODES) {
  const next = normalizeMobileState({ ...DEFAULT_STATE, modelMode, zoom: 100, selectedRoot: 17 });
  assert.equal(next.zoom, modelMode === 'e8_2d' ? 25 : 3.2);
  assert.equal(next.zoom, zoomMaxForModel(modelMode), 'manual and restored cameras share limits');
  assert.equal(next.selectedRoot, ['bloom', 'e8_2d', 'dynkin'].includes(modelMode) ? 17 : null,
    `${modelMode} must keep only applicable root selections`);
  assert.equal(autoZoomMinForModel(modelMode), modelMode === 'e8_2d' ? 0.55 : 0.7);
  assert.equal(autoZoomMaxForModel(modelMode), modelMode === 'e8_2d' ? 25 : 1.65);
}

const invalid = restoreMobileState({
  modelMode: 'missing', palette: 'missing', shape: 'missing', rootSystem: 'missing',
  tilingSystem: 'missing', tilingDensity: -3, tilingRelief: 9, tilingAnimate: 'true',
  selectedRoot: 240, quasiReach: 5, sdfSphereR: 'invalid', sdfBlend: 0, sdfBloom: 0,
});
assert.equal(invalid.modelMode, 'e8_2d');
assert.equal(invalid.palette, 'gold');
assert.equal(invalid.shape, 'icosahedron');
assert.equal(invalid.rootSystem, 'A2');
assert.equal(invalid.tilingSystem, 'H2');
assert.equal(invalid.tilingDensity, 2);
assert.equal(invalid.tilingRelief, 0.3);
assert.equal(invalid.tilingAnimate, true);
assert.equal(invalid.selectedRoot, null);
assert.equal(invalid.quasiReach, 8);
assert.equal(invalid.sdfSphereR, 0.08);
assert.equal(invalid.sdfBlend, 0, 'zero blend is an intentional surface control value');
assert.equal(invalid.sdfBloom, 0);

const lesson = restoreMobileState({ learnTopic: 'coxeter-plane' });
assert.equal(lesson.learnTopic, 'coxeter-plane', 'loading storage before curriculum retains the lesson');
assert.equal(normalizeMobileState(lesson, { learnTopicIds: new Set(['auto', 'root-systems']) }).learnTopic, 'auto',
  'loaded curriculum can reject stale lesson IDs');
for (const malformed of [null, [], 'scene', 3, true]) assert.throws(() => restoreMobileState(malformed), TypeError);
assert.deepEqual(DEFAULT_STATE, defaultsBefore, 'normalization must not overwrite reset defaults');
console.log('Mobile state: migration, scene persistence, camera limits and curriculum contracts passed.');
