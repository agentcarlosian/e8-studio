import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FRAGMENT_FX_BRANCHES } from '../src/fx/fx-branches.js';
import { createE8CoxeterView } from '../src/views/e8coxeter.view.js';
import { createBloomView } from '../src/views/bloom.view.js';
import { createPolytope4DView } from '../src/views/polytope4d.view.js';

const data = Object.fromEntries(['e8', 'polytopes4d', 'platonic', 'mckay_subsets']
  .map(name => [name, JSON.parse(fs.readFileSync(new URL(`../data/${name}.json`, import.meta.url)))]));
globalThis.window = { devicePixelRatio: 1, __app: {} };

assert.match(FRAGMENT_FX_BRANCHES, /if \(uFXMode == 2\)/, 'Trail has a point-shader branch');

function pointColors(view) {
  let colors = null;
  view.group.traverse(object => {
    if (object.isPoints && object.geometry?.attributes?.color && !colors) {
      colors = Array.from(object.geometry.attributes.color.array);
    }
  });
  assert.ok(colors?.some(value => value > 0), `${view.name}: visible point colors exist`);
  return colors;
}

function checkTrail(view, params) {
  view.update(0, 0, params);
  const original = pointColors(view);
  params.fxMode = 'trail';
  for (let frame = 1; frame <= 240; frame++) view.update(1 / 60, frame / 60, params);
  assert.deepEqual(pointColors(view), original, `${view.name}: Trail preserves source point colors`);
  params.fxMode = 'none';
  view.update(1 / 60, 5, params);
  assert.deepEqual(pointColors(view), original, `${view.name}: leaving Trail restores exact colors`);
  if (view.onPaletteChange) {
    params.fxMode = 'trail';
    view.onPaletteChange('rainbow');
    view.update(1 / 60, 5, params);
    const recolored = pointColors(view);
    assert.notDeepEqual(recolored, original, `${view.name}: palette change recolors points in Trail`);
    params.fxMode = 'none';
    view.update(1 / 60, 5, params);
    assert.deepEqual(pointColors(view), recolored, `${view.name}: leaving Trail keeps the new palette`);
  }
  view.dispose();
}

const e8Params = {
  shape: 'icosahedron', e8ViewMode: 'coxeter', showEdges: false, showRings: false,
  autoRotate: false, fxMode: 'none', pointScale: 1, opacity: 1,
};
window.__app.params = e8Params;
checkTrail(createE8CoxeterView({ data, palette: 'gold', scale: 1, context: { params: e8Params } }), e8Params);

const bloomParams = {
  shape: 'icosahedron', bloomAmount: 0.5, bloomAuto: false,
  h4TwinReveal: false, fxMode: 'none', pointScale: 1,
};
window.__app.params = bloomParams;
checkTrail(createBloomView({ data, palette: 'gold', scale: 1, context: { params: bloomParams } }), bloomParams);

const polyParams = {
  poly4d: '24cell', morph4d: 0.65, e8MorphT: 0, polyAutoRotate: false,
  showVertices: true, showFaces: true, fxMode: 'none', pointScale: 1,
};
window.__app.params = polyParams;
checkTrail(createPolytope4DView({ data, palette: 'gold', scale: 1, context: { params: polyParams } }), polyParams);

delete globalThis.window;
console.log('Trail preserves point colors across 240 frames and mode exit in E8, Bloom, and 4D.');
