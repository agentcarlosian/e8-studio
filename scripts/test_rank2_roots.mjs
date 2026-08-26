import assert from 'node:assert/strict';
import {
  RANK2_ROOT_SYSTEM_ORDER,
  RANK2_ROOT_SYSTEMS,
  coxeterOrbit,
  generateRank2RootSystem,
  reflectAcrossRoot,
} from '../src/math/rank2-roots.js';

const expectedCartan = {
  A2: [[2, -1], [-1, 2]],
  B2: [[2, -2], [-1, 2]],
  G2: [[2, -3], [-1, 2]],
};

for (const id of RANK2_ROOT_SYSTEM_ORDER) {
  const system = generateRank2RootSystem(id);
  const meta = RANK2_ROOT_SYSTEMS[id];
  assert.equal(system.roots.length, meta.rootCount, `${id} root count`);
  assert.equal(system.chamberCount, meta.rootCount, `${id} chamber count`);
  assert.equal(system.chamberAngleDegrees, 180 / meta.coxeterNumber, `${id} chamber angle`);
  assert.equal(system.simpleAngleDegrees, 180 - 180 / meta.coxeterNumber, `${id} simple-root angle`);
  assert.equal(system.longRootCount + system.shortRootCount, meta.rootCount, `${id} length-class counts`);
  assert.equal(system.shortRootCount, meta.longToShortRatio > 1 ? meta.rootCount / 2 : 0, `${id} short-root count`);
  assert.ok(system.roots.every(root => Math.abs(Math.hypot(...root.point) - root.length / meta.longToShortRatio) < 1e-8));

  for (const root of system.roots) {
    for (const mirror of system.simpleRoots) {
      const reflected = reflectAcrossRoot(root.vector, mirror);
      assert.ok(system.roots.some(candidate => (
        Math.abs(candidate.vector[0] - reflected[0]) < 1e-8
        && Math.abs(candidate.vector[1] - reflected[1]) < 1e-8
      )), `${id} is closed under its simple reflections`);
    }
  }

  const orbit = coxeterOrbit(id);
  assert.equal(orbit.length, meta.coxeterNumber, `${id} Coxeter orbit length`);
  const uniqueOrbit = new Set(orbit.map(root => root.map(value => value.toFixed(8)).join(',')));
  assert.equal(uniqueOrbit.size, meta.coxeterNumber, `${id} Coxeter orbit is non-repeating before h`);

  if (expectedCartan[id]) assert.deepEqual(system.cartanMatrix, expectedCartan[id]);
}

const h2 = generateRank2RootSystem('H2');
assert.equal(h2.crystallographic, false);
assert.ok(Math.abs(h2.goldenRatio - (1 + Math.sqrt(5)) / 2) < 1e-12);
assert.ok(Math.abs(h2.cartanMatrix[0][1] + h2.goldenRatio) < 1e-9);
assert.ok(Math.abs(h2.cartanMatrix[1][0] + h2.goldenRatio) < 1e-9);

console.log('Rank-2 root systems passed: A2, B2, G2, H2/I2(5).');
