import assert from 'node:assert/strict';
import {
  MODEL_VIEW_ORDER,
  exportFormatsForView,
  modelCanvasLabel,
  viewSupportsExport,
} from '../src/state/model-registry.js';
import { GALLERY_PRESETS } from '../src/state/gallery.js';
import {
  applyConfig, buildShareUrl, exportConfig, readUrlConfig,
} from '../src/state/persistence.js';

assert.deepEqual(MODEL_VIEW_ORDER, [
  'bloom', 'platonic', 'e8coxeter', 'quasicrystal', 'polytope', 'raymarched', 'rootlab', 'tiling', 'dynkin',
]);

const expectedExports = Object.fromEntries(MODEL_VIEW_ORDER.map(view => [view, ['png', 'svg', 'obj', 'ply', 'csv', 'data', ...(['platonic','polytope'].includes(view) ? ['3mf','stl'] : [])]]));

for (const view of MODEL_VIEW_ORDER) {
  assert.deepEqual(exportFormatsForView(view), expectedExports[view], `${view} export contract`);
  assert.equal(viewSupportsExport(view, 'png'), true, `${view} supports PNG`);
  assert.match(modelCanvasLabel(view, {
    shape: 'icosahedron', poly4d: '24cell', rootSystem: 'G2', tilingSystem: 'H2', dynkin: 'E8',
  }), /^Interactive /);
}

const sharedVisuals = {
  palette: 'rainbow', blendMode: 'mirror', colorBy: 'phase', bgMode: 'tide', bgIntensity: 0.6,
  opacity: 0.75, pointScale: 1.25, showAmbient: false,
  showVertices: true, showEdges: true, showRings: false, showPetrie: true,
  rotationSpeed: 0.005, autoRotate: true, cameraOrbit: false, autoZoom: false, autoModel: false,
  cameraDistance: 2.75, cameraRotation: -1.4, cameraPhi: 0.42,
  cameraSpeed: 0.8, cameraPath: 'ringDive', cameraMode: 'spiral', autoSliders: ['e8MorphT'],
  fxMode: 'glow', fxIntensity: 0.4, autoFx: true, fxShiftInterval: 4,
  shiftMode: 'static', shiftSpeed: 9, seed: 0,
  lightAmbient: 0.4, lightKey: 0.8, lightFill: 0.6, lightAccent: 0.5,
};

const viewScenes = {
  bloom: {
    shape: 'dodecahedron', bloomAmount: 0.58, bloomAuto: true, bloomSpeed: 0.08,
    bloomMandelbox: true, bloomMandelboxScale: 2.8, bloomMandelboxIters: 8,
    bloomMandelboxMix: 0.4, h4TwinReveal: false, e8MorphT: 0.2,
  },
  platonic: { shape: 'great_icosahedron', shapeTwist: 0.2, shapeSpike: 0.3, shapeJitter: 0.1 },
  e8coxeter: {
    shape: 'cube', e8ViewMode: 'custom', e8Spin: 0.2, e8Tilt: -0.3, e8Roll: 0.4,
    e8AutoRotate: true, e8MorphT: 0.5, e8Twin600: true, e8ProjectionAuto: false,
    rootSubset: 'octahedron', rootDiffusion: true, rootHaloDepth: 4, rootDiffusionSpeed: 1.6,
    showWeylMirrors: true, weylOrbit: true, weylOrbitFast: false, cartanHighlight: true,
    compareShape: 'octahedron', compareMode: 'difference',
  },
  quasicrystal: {
    quasiMode: 'window', quasiReach: 10, quasiWindow: 1.6, quasiPhason: -0.35, quasiRelief: 0,
    quasiShowPoints: false, quasiPointHalos: false, quasiShowLinks: false, quasiShowGuide: true,
  },
  polytope: {
    poly4d: 'tesseract', morph4d: 0, polyProjectionVersion: 2,
    polyRotXY: 0.1, polyRotZW: 0.2, polyRotXZ: 0.3, polyRotYW: 0.4, polyRotXW: 0.5,
    polyRotYZ: 0.6, polyAutoRotate: true, polyRotationSpeed: 0.3,
  },
  raymarched: { sdfSphereR: 0.1, sdfBlend: 0, sdfBloom: 0.6, sdfAniso: 0.8, sdfEdges: 0.4 },
  rootlab: {
    rootSystem: 'G2', rootShowMirrors: false, rootShowChambers: true,
    rootShowSimple: false, rootShowOrbit: true, rootOrbitSpeed: 1.2,
  },
  tiling: {
    tilingSystem: 'B2', tilingDensity: 7, tilingRelief: 0,
    tilingShowTiles: false, tilingShowEdges: true, tilingShowGrid: true,
    tilingShowRoots: true, tilingShowVertices: true, tilingAnimate: false, tilingFlowSpeed: 1.25,
  },
  dynkin: { dynkin: 'D4' },
};

const personalState = {
  theme: 'neon-cyber', layout: 'presentation', panelMode: 'learn',
  cameraBookmarks: { 'dynkin:1': { theta: 1, phi: 1, dist: 1 } },
  mobileQuality: 'high', reducedMode: true, adaptivePixelRatio: false,
  firstVisualMode: 'instant', activeUnlock: 'reward', galleryPreset: 'coxeter-rings',
  presentationMode: true, teachingMode: true, showInspector: true, showPerf: true,
  fxByView: { tiling: 'glow' }, clipDuration: 12, clipResolution: '1080p', clipFps: 60,
  clipMotionScale: 0.8, intro: false, paused: true, pickedRoot: 12, hoveredRoot: 8,
};

function readHash(hash) {
  const originalWindow = globalThis.window;
  try {
    globalThis.window = { location: { hash } };
    return readUrlConfig();
  } finally {
    if (originalWindow === undefined) delete globalThis.window;
    else globalThis.window = originalWindow;
  }
}

function assertSceneRoundTrip(scene, label) {
  const source = { ...scene, ...personalState };
  const before = structuredClone(source);
  const url = new URL(buildShareUrl(source, 'https://example.test/e8-studio/?old=1#old'));
  assert.equal(url.search, '?old=1');
  assert.match(url.hash, /^#scene=v1\.[A-Za-z0-9_-]+$/);
  const decoded = readHash(url.hash);
  assert.deepEqual(decoded, scene, `${label}: scene fields survive and personal state stays out`);

  // Exercise the same decode-and-apply boundary used at startup: testing the
  // encoded payload alone missed cameraPath/cameraMode being dropped on apply.
  const recipient = { theme: 'paper-ink', layout: 'compact', mobileQuality: 'low', paused: false };
  const expected = { ...recipient, ...scene };
  assert.equal(applyConfig(recipient, decoded), recipient, `${label}: updates the live params object`);
  assert.deepEqual(recipient, expected, `${label}: applied scene retains recipient preferences`);
  assert.deepEqual(source, before, `${label}: sharing leaves sender state unchanged`);
}

assert.deepEqual(Object.keys(viewScenes), MODEL_VIEW_ORDER, 'every public view has a scene fixture');
for (const [view, settings] of Object.entries(viewScenes)) {
  assertSceneRoundTrip({ ...sharedVisuals, view, ...settings }, view);
}
for (const tilingSystem of ['A2', 'B2', 'G2', 'H2']) {
  assertSceneRoundTrip({ view: 'tiling', ...viewScenes.tiling, tilingSystem }, `${tilingSystem} tiling`);
}
// Presets cover combinations visitors can actually create, including the
// legacy 600-cell route and animation controls used by featured scenes.
for (const preset of GALLERY_PRESETS) {
  assertSceneRoundTrip(preset.settings, `gallery ${preset.id}`);
}

const legacyScene = { view: 'dynkin', dynkin: 'E8', palette: 'gold', cameraDistance: 3 };
assert.deepEqual(applyConfig({}, readHash('#config=' + exportConfig(legacyScene))), legacyScene,
  'original unversioned links still restore');
const previousV1Scene = { view: 'tiling', palette: 'aurora' };
assert.deepEqual(applyConfig({ tilingSystem: 'H2', tilingDensity: 5 },
  readHash('#scene=v1.' + exportConfig(previousV1Scene))),
{ tilingSystem: 'H2', tilingDensity: 5, ...previousV1Scene },
'older v1 links retain defaults for absent fields');
assert.equal(readHash('#scene=v2.future'), null, 'unrecognized scene versions are not applied');

const additionalSavedState = {
  cameraMode: 'figure8', cameraPath: 'h4Reveal', blendMode: 'mirror', rootDiffusion: true,
  ...viewScenes.tiling,
};
assert.deepEqual(applyConfig({}, readHash('#config=' + exportConfig(additionalSavedState))),
  additionalSavedState, 'scene controls also survive the manual configuration export/import path');

console.log('Model capability and scene-link contracts passed.');
