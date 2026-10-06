import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createDeferredView } from '../src/platform/deferred-view.js';
import { VIEW_DEFINITIONS } from '../src/platform/view-factories.js';

assert.equal(VIEW_DEFINITIONS.length, 9);
assert.equal(VIEW_DEFINITIONS.filter(view => view.factory).length, 1,
  'the default E8 renderer remains available at first render');

let resolveLoad;
let updates = 0;
let disposals = 0;
let receivedPalette;
const view = createDeferredView({
  name: 'fixture',
  load: () => new Promise(resolve => { resolveLoad = resolve; }),
  options: { palette: 'gold' },
});
view.onPaletteChange('rainbow');
resolveLoad(options => {
  receivedPalette = options.palette;
  return {
    object3d: new THREE.Group(),
    update() { updates++; },
    dispose() { disposals++; },
  };
});
assert.equal(await view.ready, true);
assert.equal(receivedPalette, 'rainbow');
assert.equal(view.object3d.children.length, 1);
view.update(0.016, 1, {});
assert.equal(updates, 1);
view.dispose();
assert.equal(disposals, 1);

let resolveLate;
let lateConstructions = 0;
const abandoned = createDeferredView({
  name: 'abandoned',
  load: () => new Promise(resolve => { resolveLate = resolve; }),
  options: { palette: 'gold' },
});
abandoned.dispose();
resolveLate(() => { lateConstructions++; return { object3d: new THREE.Group() }; });
assert.equal(await abandoned.ready, false);
assert.equal(lateConstructions, 0, 'disposed views never construct after a late import');
console.log('Deferred view lifecycle passed.');
