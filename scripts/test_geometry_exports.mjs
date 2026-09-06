import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createGeometryExporters } from '../src/services/geometry-export.js';
const data = Object.fromEntries(['e8','e8_math','platonic','polytopes4d','dynkin','mckay_subsets'].map(name => [name, JSON.parse(fs.readFileSync(new URL(`../data/${name}.json`, import.meta.url)))]));
const make = params => createGeometryExporters(data, { shape: 'cube', palette: 'gold', ...params });
const cube = make({ view: 'platonic' });
assert.equal(cube.objForCurrentView().split('\nv ').length - 1, 8);
assert.equal(cube.objForCurrentView().split('\nf ').length - 1, 12);
assert.equal(cube.geometryForView().dimension, 3);
const before = JSON.stringify(data.platonic.cube);
const twisted = make({ view: 'platonic', shapeTwist: 1 });
assert.notDeepEqual(twisted.geometryForView().verts, cube.geometryForView().verts);
assert.equal(JSON.stringify(data.platonic.cube), before, 'exports must not mutate canonical geometry');
assert.match(twisted.objForCurrentView(), /# morph: twist=1/);
for (const view of ['bloom', 'e8coxeter', 'raymarched']) {
  const out = make({ view });
  assert.equal(out.geometryForView().roots8d.length, 240);
  assert.equal(out.objForCurrentView(), null);
}
const svg = make({ view: 'e8coxeter', showPetrie: true }).svgForCurrentView();
assert.equal((svg.match(/<title>E8 root /g) || []).length, 240);
assert.match(svg, /<polyline/);
for (const id of ['E6','E7','E8']) {
  const out = make({ view: 'dynkin', dynkin: id });
  assert.equal(out.geometryForView().nodes.length, Number(id.slice(1)));
  assert.equal(out.objForCurrentView().split('\nv ').length - 1, Number(id.slice(1)));
  assert.match(out.svgForCurrentView(), new RegExp(`${id} Dynkin diagram`));
}
assert.equal(make({ view: 'polytope', poly4d: '600cell' }).geometryForView().verts.length, 120);
assert.equal(make({ view: 'rootlab', rootSystem: 'G2' }).geometryForView().rootCount, 12);
assert.equal(make({ view: 'tiling', tilingSystem: 'G2', tilingDensity: 4 }).geometryForView().name, 'G2');
assert.equal(make({ view: 'platonic', shape: 'not-a-shape' }).objForCurrentView(), null);
console.log('Geometry serializers passed: canonical data, morphs, SVG, OBJ, and view dispatch.');
