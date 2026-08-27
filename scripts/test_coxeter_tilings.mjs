import assert from 'node:assert/strict';
import {
  COXETER_TILING_ORDER,
  COXETER_TILINGS,
  generateCoxeterTiling,
} from '../src/math/coxeter-tilings.js';

const expectedFamilies = { A2: 3, B2: 4, G2: 6, H2: 5 };
const expectedOrders = { A2: 6, B2: 8, G2: 12, H2: 10 };

for (const id of COXETER_TILING_ORDER) {
  const first = generateCoxeterTiling(id, { density: 4, phase: 0.17 });
  const second = generateCoxeterTiling(id, { density: 4, phase: 0.17 });
  assert.equal(first.familyCount, expectedFamilies[id], `${id} family count`);
  assert.equal(first.order, expectedOrders[id], `${id} local order`);
  assert.equal(first.directions.length, expectedFamilies[id], `${id} direction count`);
  assert.ok(first.tileCount > 20, `${id} produces a substantial tile patch`);
  assert.ok(first.vertexCount > 10, `${id} produces vertices`);
  assert.ok(first.edgeCount > first.tileCount, `${id} deduplicates a connected edge field`);
  assert.ok(first.tiles.every(tile => tile.points.length === 4), `${id} tiles are rhombi`);
  assert.ok(first.tiles.every(tile => tile.vertexIndices.length === 4 && tile.vertexIndices.every(index => Number.isInteger(index) && index >= 0 && index < first.vertexCount)), `${id} tile indices reference vertices`);
  assert.ok(first.edges.every(edge => edge.indices.length === 2 && edge.indices.every(index => Number.isInteger(index) && index >= 0 && index < first.vertexCount)), `${id} edge indices reference vertices`);
  assert.ok(first.tiles.every(tile => tile.area > 1e-7), `${id} tiles have positive area`);
  assert.ok(first.tiles.every(tile => tile.points.every(point => point.every(Number.isFinite))), `${id} coordinates are finite`);
  assert.deepEqual(first.tiles, second.tiles, `${id} generation is deterministic`);
  assert.equal(COXETER_TILINGS[id].id, id);
}

const a2 = generateCoxeterTiling('A2', { density: 4 });
assert.deepEqual(a2.angleClasses.map(value => Math.round(value)), [60], 'A2 uses 60° lozenges');
assert.equal(a2.periodic, true);

const h2 = generateCoxeterTiling('H2', { density: 5 });
assert.deepEqual(h2.angleClasses.map(value => Math.round(value)), [36, 72], 'H2 has thin and thick Penrose angles');
assert.ok(Math.abs(h2.goldenRatio - (1 + Math.sqrt(5)) / 2) < 1e-12);
assert.equal(h2.periodic, false);

console.log('Coxeter multigrid tilings passed: A2, B2, G2, H2.');
