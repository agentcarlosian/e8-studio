import assert from 'node:assert/strict';
import { createHydrogenCloud, hydrogenRadial, hydrogenAngular, QUANTUM_PARTICLE_COUNT } from '../src/fx/quantum-orbitals.js';

// Known hydrogen nodes, independent of the numerical CDF construction.
for (const root of [3-Math.sqrt(3),3+Math.sqrt(3)]) {
  assert.ok(Math.abs(hydrogenRadial(3,0,root*1.5))<1e-12, '3s radial nodes');
}
assert.ok(Math.abs(hydrogenAngular(2,0,1/Math.sqrt(3)))<1e-12, '3d angular node');
assert.ok(Math.abs(hydrogenAngular(3,1,1/Math.sqrt(5)))<1e-12, '4f angular node');
assert.equal(hydrogenAngular(3,1,1),0, '4f m=1 polar node');
assert.equal(hydrogenAngular(3,-1,0.3),hydrogenAngular(3,1,0.3), 'opposite m has equal density');

const cloud=createHydrogenCloud();
assert.equal(cloud.count,QUANTUM_PARTICLE_COUNT);
assert.equal(cloud.data.length,cloud.count*4);
let radius=0,cosineSquared=0,azimuth=0;
for(let i=0;i<cloud.data.length;i+=4) {
  const [x,y,z,density]=cloud.data.subarray(i,i+4),r=Math.hypot(x,y,z);
  assert.ok(r>0 && Number.isFinite(r) && density>=0 && density<=1);
  radius+=r/cloud.bohrToScene;
  cosineSquared+=(y/r)**2;
  azimuth+=x/Math.hypot(x,z);
}
// <r> = [3n²-l(l+1)] a0 / 2; <cos²θ> for l=3, |m|=1 is 7/15.
assert.ok(Math.abs(radius/cloud.count-18)<0.15, `radial distribution: ${radius/cloud.count}`);
assert.ok(Math.abs(cosineSquared/cloud.count-7/15)<0.008, 'angular probability distribution');
assert.ok(Math.abs(azimuth/cloud.count)<0.01, 'uniform azimuth');
const small=createHydrogenCloud({count:64});
assert.deepEqual(small.data,cloud.data.slice(0,256), 'stable nested sampling budgets');
assert.notDeepEqual(small.data,createHydrogenCloud({count:64,seed:7}).data);
for(const options of [{n:0},{n:4,l:4},{m:4},{count:QUANTUM_PARTICLE_COUNT+1},{count:NaN}]) {
  assert.throws(()=>createHydrogenCloud(options),RangeError);
}
const s1=createHydrogenCloud({n:1,l:0,m:0,count:20000});
let groundRadius=0;
for(let i=0;i<s1.data.length;i+=4)groundRadius+=Math.hypot(...s1.data.subarray(i,i+3))/s1.bohrToScene;
assert.ok(Math.abs(groundRadius/s1.count-1.5)<0.025, 'fresh CDF for the 1s state');
console.log('Hydrogen cloud passed: known nodes, radial/angular moments, deterministic sampling, and particle budgets.');
