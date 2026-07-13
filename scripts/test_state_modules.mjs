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

console.log('ok gallery, camera, view-transition, learning, and export modules');
