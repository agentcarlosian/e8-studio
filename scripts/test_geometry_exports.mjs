import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createGeometryExporters } from '../src/services/geometry-export.js';
import { polytopeFaces } from '../src/math/polytope-faces.js';
const data = Object.fromEntries(['e8','e8_math','platonic','polytopes4d','dynkin','mckay_subsets'].map(name => [name, JSON.parse(fs.readFileSync(new URL(`../data/${name}.json`, import.meta.url)))]));
const make = params => createGeometryExporters(data, { shape: 'cube', palette: 'gold', ...params });
const cube = make({ view: 'platonic' });
assert.equal(cube.objForCurrentView().split('\nv ').length - 1, 8);
assert.equal(cube.objForCurrentView().split('\nf ').length - 1, 12);
assert.equal(cube.geometryForView().dimension, 3);
for (const shape of Object.keys(data.platonic)) {
  const geometry = make({ view: 'platonic', shape }).geometryForView();
  for (const [a,b,c] of geometry.faces) {
    const origin=geometry.verts[a], u=geometry.verts[b].map((v,i)=>v-origin[i]), v=geometry.verts[c].map((v,i)=>v-origin[i]);
    const normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    assert.ok(geometry.verts.every(p=>p.reduce((s,x,i)=>s+(x-origin[i])*normal[i],0)<1e-5), `${shape}: exported triangles must lie on the outward hull`);
  }
}
const before = JSON.stringify(data.platonic.cube);
const twisted = make({ view: 'platonic', shapeTwist: 1 });
assert.notDeepEqual(twisted.geometryForView().verts, cube.geometryForView().verts);
assert.equal(JSON.stringify(data.platonic.cube), before, 'exports must not mutate canonical geometry');
assert.match(twisted.objForCurrentView(), /# morph: twist=1/);
for (const view of ['bloom', 'e8coxeter', 'raymarched']) {
  const out = make({ view });
  assert.equal(out.geometryForView().roots8d.length, 240);
  assert.equal(out.objForCurrentView().split('\nv ').length - 1, 240);
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
for (const [name, count] of Object.entries({ '5cell': 10, tesseract: 24, '16cell': 32, '24cell': 96, '600cell': 1200, '120cell': 720 })) {
  const poly = data.polytopes4d[name], faces = polytopeFaces(name, poly);
  assert.equal(faces.length, count, `${name}: polygonal 2-face count`);
  const edges = new Set(poly.edges.map(([a, b]) => [a, b].sort((a, b) => a-b).join(':')));
  for (const face of faces) {
    assert.equal(new Set(face).size, face.length);
    face.forEach((a, i) => assert.ok(edges.has([a, face[(i+1)%face.length]].sort((a,b)=>a-b).join(':'))));
  }
  const exporter = make({ view: 'polytope', poly4d: name });
  const projected = poly.verts.map(v => v.slice(0, 3));
  const obj = exporter.objForCurrentView(projected);
  assert.equal(obj.split('\nv ').length - 1, poly.verts.length);
  assert.equal(obj.split('\nf ').length - 1, count);
  assert.equal(obj.split('\nl ').length - 1, poly.edges.length);
  assert.ok(exporter.geometryForView().verts.every(v => v.length === 4));
  assert.equal(exporter.objForCurrentView([[NaN, 0, 0]]), null);
}
assert.equal(make({ view: 'rootlab', rootSystem: 'G2' }).geometryForView().rootCount, 12);
assert.equal(make({ view: 'tiling', tilingSystem: 'G2', tilingDensity: 4 }).geometryForView().name, 'G2');
assert.equal(make({ view: 'platonic', shape: 'not-a-shape' }).objForCurrentView(), null);
console.log('Geometry serializers passed: canonical data, morphs, SVG, OBJ, and view dispatch.');
