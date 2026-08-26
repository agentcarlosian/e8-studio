import assert from 'node:assert/strict';
import {
  MODEL_VIEW_ORDER,
  exportFormatsForView,
  modelCanvasLabel,
  viewSupportsExport,
} from '../src/state/model-registry.js';
import { buildShareUrl, importConfig } from '../src/state/persistence.js';

assert.deepEqual(MODEL_VIEW_ORDER, [
  'bloom', 'platonic', 'e8coxeter', 'sixhundred', 'polytope', 'raymarched', 'rootlab', 'dynkin',
]);

const expectedExports = {
  bloom: ['png', 'data'],
  platonic: ['png', 'obj', 'data'],
  e8coxeter: ['png', 'svg', 'data'],
  sixhundred: ['png', 'data'],
  polytope: ['png', 'data'],
  raymarched: ['png', 'data'],
  rootlab: ['png', 'data'],
  dynkin: ['png', 'svg', 'obj', 'data'],
};

for (const view of MODEL_VIEW_ORDER) {
  assert.deepEqual(exportFormatsForView(view), expectedExports[view], `${view} export contract`);
  assert.equal(viewSupportsExport(view, 'png'), true, `${view} supports PNG`);
  assert.match(modelCanvasLabel(view, {
    shape: 'icosahedron', poly4d: '24cell', rootSystem: 'G2', dynkin: 'E8',
  }), /^Interactive /);
}

const scene = {
  view: 'dynkin', dynkin: 'E8', palette: 'rainbow', bgMode: 'grid',
  cameraDistance: 2.75, cameraRotation: -1.4, cameraPhi: 0.42,
  fxMode: 'glow', theme: 'neon-cyber', layout: 'presentation',
  cameraBookmarks: { 'dynkin:1': { theta: 1, phi: 1, dist: 1 } },
};
const url = new URL(buildShareUrl(scene, 'https://example.test/e8-studio/?old=1#old'));
assert.equal(url.search, '?old=1');
assert.match(url.hash, /^#scene=v1\./);
const restored = importConfig(url.hash.slice('#scene=v1.'.length));
assert.equal(restored.view, 'dynkin');
assert.equal(restored.dynkin, 'E8');
assert.equal(restored.cameraDistance, 2.75);
assert.equal(restored.cameraRotation, -1.4);
assert.equal(restored.cameraPhi, 0.42);
assert.equal(restored.theme, undefined, 'scene links exclude interface theme');
assert.equal(restored.layout, undefined, 'scene links exclude interface layout');
assert.equal(restored.cameraBookmarks, undefined, 'scene links exclude private camera bookmarks');

console.log('Model capability and scene-link contracts passed.');
