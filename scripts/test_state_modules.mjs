import assert from 'node:assert/strict';
import {
  GALLERY_PRESETS,
  adjacentGalleryPreset,
  createGalleryBaseline,
  galleryPresetById,
} from '../src/state/gallery.js';
import { CameraController } from '../src/state/camera.js';
import { planViewTransition } from '../src/state/view-transition.js';
import { LearningProgressService } from '../src/state/learning-service.js';
import { ExportRecordingService, isCapacitorNative } from '../src/services/export-recording.js';
import { buildSdfRingLayout, sdfQualityProfile } from '../src/views/raymarched-e8.view.js';
import {
  FX_EFFECTS,
  coerceEffectMode,
  effectAvailableForView,
  effectsForView,
  rememberEffectForView,
  restoreEffectForView,
} from '../src/fx/fx-catalog.js';

assert.equal(GALLERY_PRESETS.length, 22);
assert.equal(new Set(GALLERY_PRESETS.map(preset => preset.id)).size, GALLERY_PRESETS.length);
assert.equal(galleryPresetById('living-e8')?.settings.view, 'raymarched');
assert.equal(galleryPresetById('living-e8')?.settings.palette, 'prime');
assert.equal(adjacentGalleryPreset('coxeter-rings', -1)?.id, 'midnight-600');
assert.equal(adjacentGalleryPreset('midnight-600', 1)?.id, 'coxeter-rings');

const baselineA = createGalleryBaseline();
const baselineB = createGalleryBaseline();
assert.notEqual(baselineA.autoSliders, baselineB.autoSliders);
assert.equal(baselineA.bgMode, 'void');
assert.equal(baselineA.poly4d, '24cell');

const source = {
  cameraOrbit: true,
  autoZoom: true,
  cameraPath: 'ringDive',
  autoRotate: true,
  bloomAuto: true,
  polyAutoRotate: true,
  e8ProjectionAuto: true,
  weylOrbit: true,
  weylOrbitFast: true,
  autoSliders: ['e8MorphT', 'fxIntensity'],
};
const transition = planViewTransition(source, 'e8coxeter', 'platonic');
assert.equal(transition.changed, true);
assert.equal(transition.resetCamera, true);
assert.deepEqual(transition.patch.autoSliders, ['e8MorphT']);
assert.equal(transition.patch.cameraPath, 'manual');
assert.equal(source.cameraPath, 'ringDive'); // policy is pure

const camera = new CameraController();
camera.theta = 2;
camera.distance = 3;
const snapshot = camera.snapshot();
camera.reset(6, null, null, null);
assert.equal(camera.distance, 6);
camera.restore(snapshot, null, null, null);
assert.equal(camera.theta, 2);
assert.equal(camera.distance, 3);
assert.equal(camera.clampDistance(Number.NaN), 6);

const learning = new LearningProgressService({
  quiz: {},
  unlocked: { backgrounds: [] },
  daily: { streak: 0, lastCompletedDate: null },
  postcardsCreated: 0,
  explorationBadges: [],
});
assert.equal(learning.summary().quizTotal, 8);
assert.equal(learning.quizById('e8-roots')?.id, 'e8-roots');
learning.recordPostcard('postcard-prime');
assert.equal(learning.progress.postcardsCreated, 1);

const messages = [];
const exports = new ExportRecordingService({ toast: message => messages.push(message) });
assert.equal(exports.cancelRecording(), false);
assert.equal(messages.at(-1), 'No active recording');
assert.equal(isCapacitorNative(), false);

const e8 = JSON.parse(await import('node:fs').then(
  ({ readFileSync }) => readFileSync(new URL('../data/e8.json', import.meta.url), 'utf8')
));
const ringLayout = buildSdfRingLayout(e8, 1.6);
assert.equal(ringLayout.rings.length, 8);
assert.equal(ringLayout.rootCount, 240);
assert.ok(ringLayout.rings.every(ring => ring.count === 30));
let maxRingEncodingError = 0;
for (const point of e8.proj2d) {
  const ring = ringLayout.rings.find(item => item.id === point.ring);
  const angle = Math.atan2(point.y, point.x);
  const slot = Math.round((angle - ring.phase) / ring.step);
  const reconstructedX = ring.radius * Math.cos(ring.phase + slot * ring.step);
  const reconstructedY = ring.radius * Math.sin(ring.phase + slot * ring.step);
  maxRingEncodingError = Math.max(
    maxRingEncodingError,
    Math.hypot(reconstructedX - point.x * 1.6, reconstructedY - point.y * 1.6)
  );
}
assert.ok(maxRingEncodingError < 1e-10, `ring encoding error ${maxRingEncodingError}`);
assert.equal(sdfQualityProfile({
  params: { mobileQuality: 'high', reducedMode: false },
  device: { deviceMemory: 16, hardwareConcurrency: 12, viewportWidth: 1400 },
}).tier, 'high');
assert.equal(sdfQualityProfile({
  params: { mobileQuality: 'high', reducedMode: false },
  device: { deviceMemory: 4, hardwareConcurrency: 4, viewportWidth: 390, maxTouchPoints: 5 },
}).tier, 'balanced');
assert.equal(sdfQualityProfile({ params: { mobileQuality: 'low' }, device: {} }).tier, 'low');

assert.equal(FX_EFFECTS.length, 24);
assert.deepEqual(
  effectsForView('raymarched').map(item => item.id),
  ['none', 'glow', 'pulse', 'heat', 'iridescent', 'hologram', 'xray']
);
assert.equal(effectsForView('e8coxeter', 'high').length, 24);
assert.equal(effectAvailableForView('raymarched', 'trail', 'high'), false);
assert.equal(effectAvailableForView('e8coxeter', 'voronoi', 'low'), false);
assert.equal(coerceEffectMode('raymarched', 'plasma', 'high'), 'none');
const fxState = {
  view: 'raymarched', fxMode: 'glow', fxByView: {}, mobileQuality: 'high', reducedMode: false,
};
rememberEffectForView(fxState);
fxState.view = 'e8coxeter';
fxState.fxMode = 'plasma';
rememberEffectForView(fxState);
fxState.view = 'raymarched';
assert.equal(restoreEffectForView(fxState, 'raymarched'), 'glow');
assert.equal(fxState.fxByView.e8coxeter, 'plasma');

console.log('ok gallery, camera, SDF quality/effects, view-transition, learning, and export modules');
