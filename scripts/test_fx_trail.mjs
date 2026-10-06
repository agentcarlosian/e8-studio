import assert from 'node:assert/strict';
import fs from 'node:fs';
import { FRAGMENT_FX_BRANCHES } from '../src/fx/fx-branches.js';
import { createE8CoxeterView } from '../src/views/e8coxeter.view.js';
import { createBloomView } from '../src/views/bloom.view.js';
import { createPolytope4DView } from '../src/views/polytope4d.view.js';
import { createPlatonicView } from '../src/views/platonic.view.js';
import { createDynkinView } from '../src/views/dynkin.view.js';
import { createSixHundredView } from '../src/views/sixhundred.view.js';

const data = Object.fromEntries(['e8', 'polytopes4d', 'platonic', 'mckay_subsets', 'dynkin']
  .map(name => [name, JSON.parse(fs.readFileSync(new URL(`../data/${name}.json`, import.meta.url)))]));
globalThis.window = { devicePixelRatio: 1, __app: {} };
const main = fakeElement();
globalThis.document = {
  createElement(tag) {
    const element = fakeElement();
    if (tag === 'canvas') element.getContext = () => ({ fillText() {} });
    return element;
  },
  querySelector: selector => selector === 'main' ? main : null,
  getElementById: id => id === 'canvas' ? {
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  } : null,
};

function fakeElement() {
  return {
    style: {}, children: [], parentNode: null,
    appendChild(child) { child.parentNode = this; this.children.push(child); },
    removeChild(child) { this.children.splice(this.children.indexOf(child), 1); child.parentNode = null; },
    remove() { this.parentNode?.removeChild(this); },
  };
}

assert.match(FRAGMENT_FX_BRANCHES, /if \(uFXMode == 2\)/, 'Trail has a point-shader branch');

function sourceColors(view) {
  const colors = [];
  view.group.traverse(object => {
    if (object.geometry?.attributes?.color) colors.push(Array.from(object.geometry.attributes.color.array));
  });
  assert.ok(colors.some(buffer => buffer.some(value => value > 0)), `${view.name}: source colors exist`);
  return colors;
}

function checkTrail(view, params) {
  view.update(0, 0, params);
  const original = sourceColors(view);
  params.fxMode = 'trail';
  for (let frame = 1; frame <= 240; frame++) view.update(1 / 60, frame / 60, params);
  assert.deepEqual(sourceColors(view), original, `${view.name}: Trail preserves source colors`);
  params.fxMode = 'none';
  view.update(1 / 60, 5, params);
  assert.deepEqual(sourceColors(view), original, `${view.name}: leaving Trail restores exact colors`);
  if (view.onPaletteChange) {
    params.fxMode = 'trail';
    view.onPaletteChange('rainbow');
    view.update(1 / 60, 5, params);
    const recolored = sourceColors(view);
    assert.notDeepEqual(recolored, original, `${view.name}: palette change recolors points in Trail`);
    params.fxMode = 'none';
    view.update(1 / 60, 5, params);
    assert.deepEqual(sourceColors(view), recolored, `${view.name}: leaving Trail keeps the new palette`);
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

const platonicParams = { shape: 'icosahedron', showVertices: true, showFaces: true,
  fxMode: 'none', pointScale: 1, blendMode: 'spectrum' };
window.__app.params = platonicParams;
checkTrail(createPlatonicView({ data, palette: 'gold', scale: 1, context: { params: platonicParams } }), platonicParams);

const dynkinParams = { dynkin: 'E8', fxMode: 'none', pointScale: 1, autoRotate: false };
window.__app.params = dynkinParams;
checkTrail(createDynkinView({ data, palette: 'gold', scale: 1, context: { params: dynkinParams } }), dynkinParams);

const sixParams = { fxMode: 'none', pointScale: 1, autoRotate: false };
window.__app.params = sixParams;
checkTrail(createSixHundredView({ data, palette: 'gold', scale: 1, context: { params: sixParams } }), sixParams);

delete globalThis.window;
delete globalThis.document;
console.log('Trail preserves source colors across 240 frames and mode exit in six views.');
