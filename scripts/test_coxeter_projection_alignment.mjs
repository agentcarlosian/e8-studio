import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createE8CoxeterView } from '../src/views/e8coxeter.view.js';

const data = Object.fromEntries(['e8', 'e8_math', 'mckay_subsets']
  .map(name => [name, JSON.parse(fs.readFileSync(new URL(`../data/${name}.json`, import.meta.url)))]));
const params = {
  shape: 'icosahedron', e8ViewMode: 'coxeter', e8MorphT: 0,
  showEdges: true, showRings: true, autoRotate: false, fxMode: 'none', pointScale: 1,
};
globalThis.window = { devicePixelRatio: 1, __app: { params } };
const view = createE8CoxeterView({ data, palette: 'gold', scale: 1, context: { params } });
const points = view.group.children.find(object => object.isPoints && object.geometry?.attributes?.color);
const edges = view.group.getObjectByName('edges');
const rings = view.group.getObjectByName('ring-guides');
const positions = () => Array.from(points.geometry.attributes.position.array);

function assertEdgesMeetRoots(label) {
  const rootPositions = points.geometry.attributes.position.array;
  for (const segment of edges.children) {
    const pairs = segment.userData.chordPairs;
    const endpoints = segment.geometry.attributes.position.array;
    for (let pair = 0; pair < pairs.length; pair += 2) {
      const [a, b] = [pairs[pair], pairs[pair + 1]];
      for (let coordinate = 0; coordinate < 3; coordinate++) {
        assert.equal(endpoints[pair * 3 + coordinate], rootPositions[a * 3 + coordinate], `${label}: first edge endpoint`);
        assert.equal(endpoints[pair * 3 + 3 + coordinate], rootPositions[b * 3 + coordinate], `${label}: second edge endpoint`);
      }
    }
  }
}

function assertRingsFitRoots(label) {
  const rootPositions = points.geometry.attributes.position.array;
  let maxRootRadius = 0;
  for (let i = 0; i < rootPositions.length; i += 3) {
    maxRootRadius = Math.max(maxRootRadius, Math.hypot(rootPositions[i], rootPositions[i + 1]));
  }
  const outerRing = rings.children.at(-1).geometry.attributes.position.array;
  const ringRadius = Math.hypot(outerRing[0], outerRing[1]);
  // Ring radii are rounded to three decimals in the precomputed JSON.
  assert.ok(Math.abs(maxRootRadius - ringRadius) < 0.002, `${label}: outer ring matches root radius`);
}

view.update(0, 0, params);
const canonical = positions();
assertEdgesMeetRoots('initial Coxeter');
assertRingsFitRoots('initial Coxeter');

Object.assign(params, { e8ViewMode: 'custom', e8Spin: 0.4, e8Tilt: 0.2, e8Roll: 0.1, e8AutoRotate: false });
view.update(0, 0, params);
assertEdgesMeetRoots('custom 3D');

params.e8MorphT = 0.4;
view.update(0, 0, params);
assertEdgesMeetRoots('extruded custom 3D');

params.showEdges = false;
params.e8Spin = 0.7;
view.update(0, 0, params);
params.showEdges = true;
view.update(0, 0, params);
assertEdgesMeetRoots('edges restored after hidden reprojection');

Object.assign(params, { e8ViewMode: 'coxeter', e8MorphT: 0 });
view.update(0, 0, params);
assert.deepEqual(positions(), canonical, '3D to Coxeter restores exact canonical root coordinates');
assertEdgesMeetRoots('returned Coxeter');
assertRingsFitRoots('returned Coxeter');

view.dispose();
delete globalThis.window;
console.log('Coxeter roots, rings, and chord endpoints stay aligned through 3D and extrusion changes.');
