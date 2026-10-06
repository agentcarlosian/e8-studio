import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createE8CoxeterView } from '../src/views/e8coxeter.view.js';

const data = Object.fromEntries(['e8', 'e8_math', 'mckay_subsets']
  .map(name => [name, JSON.parse(fs.readFileSync(new URL(`../data/${name}.json`, import.meta.url)))]));
const params = {
  shape: 'icosahedron', e8ViewMode: 'coxeter', e8MorphT: 0,
  showEdges: true, showRings: true, showPetrie: true,
  cartanHighlight: true, cartanSelection: [0], pickedRoot: 42,
  autoRotate: false, fxMode: 'none', pointScale: 1,
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

function assertAuxiliaryLinesMeetRoots(label) {
  const roots = points.geometry.attributes.position.array;
  const near = (actual, expected, detail) => assert.ok(Math.abs(actual - expected) < 1e-5,
    `${label}: ${detail} ${actual} differs from ${expected}`);
  const petrie = view.group.getObjectByName('petrie-30-cycle');
  const cartan = view.group.getObjectByName('cartan-highlight');
  const picked = view.group.getObjectByName('picked-neighbors');
  assert.ok(petrie?.visible && cartan?.visible && picked?.visible, `${label}: auxiliary lines are visible`);
  const cycle = data.e8_math.petrie_cycle_30;
  const petriePositions = petrie.geometry.attributes.position.array;
  for (let i = 0; i < cycle.length; i++) {
    const root = cycle[i];
    for (let axis = 0; axis < 3; axis++) near(petriePositions[i * 3 + axis],
      roots[root * 3 + axis] + (axis === 2 ? 0.005 : 0), `Petrie root ${root} axis ${axis}`);
  }
  const simple = data.e8_math.simple_root_indices[0];
  const neighbor = data.e8_math.cartan_neighbors.alpha1.neighbors[0];
  const cartanPositions = cartan.geometry.attributes.position.array;
  for (let axis = 0; axis < 3; axis++) {
    near(cartanPositions[axis], roots[simple * 3 + axis] + (axis === 2 ? 0.01 : 0), `Cartan source axis ${axis}`);
    near(cartanPositions[3 + axis], roots[neighbor * 3 + axis] + (axis === 2 ? 0.01 : 0), `Cartan target axis ${axis}`);
  }
  const pickedPositions = picked.geometry.attributes.position.array;
  for (let i = 0; i < pickedPositions.length; i += 6) {
    for (let axis = 0; axis < 3; axis++) near(pickedPositions[i + axis],
      roots[params.pickedRoot * 3 + axis] + (axis === 2 ? 0.015 : 0), `picked source axis ${axis}`);
  }
}

view.update(0, 0, params);
const canonical = positions();
assertEdgesMeetRoots('initial Coxeter');
assertRingsFitRoots('initial Coxeter');
assertAuxiliaryLinesMeetRoots('initial Coxeter');

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
assertAuxiliaryLinesMeetRoots('returned Coxeter');

for (const morph of [0.25, 0.5]) {
  params.e8MorphT = morph;
  view.update(0, 0, params);
  assertEdgesMeetRoots(`Coxeter extrude ${morph}`);
  assertAuxiliaryLinesMeetRoots(`Coxeter extrude ${morph}`);
}
params.cartanSelection = [1];
view.update(0, 0, params);
const secondSimple = data.e8_math.simple_root_indices[1];
const newCartan = view.group.getObjectByName('cartan-highlight').geometry.attributes.position.array;
for (let axis = 0; axis < 3; axis++) assert.ok(
  Math.abs(newCartan[axis] - (points.geometry.attributes.position.array[secondSimple * 3 + axis]
    + (axis === 2 ? 0.01 : 0))) < 1e-5,
  `Cartan selection changed without length change: axis ${axis}`,
);
params.cartanSelection = [0];
view.update(0, 0, params);
assertAuxiliaryLinesMeetRoots('Cartan selection restored');

view.dispose();
delete globalThis.window;
console.log('Coxeter roots, rings, chords, and auxiliary overlays stay aligned through 3D and extrusion changes.');
