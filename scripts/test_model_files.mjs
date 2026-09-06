import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createGeometryExporters } from '../src/services/geometry-export.js';
import { exportModelRecord, modelOBJ, modelPLY, modelCSV, modelSVG } from '../src/services/model-files.js';
import { createPrintMesh, validatePrintMesh } from '../src/services/print-mesh.js';
import { meshSTL, mesh3MF } from '../src/services/print-files.js';
const DATA=Object.fromEntries(['e8','platonic','polytopes4d','dynkin'].map(n=>[n,JSON.parse(fs.readFileSync(new URL(`../data/${n}.json`,import.meta.url)))]));
const out=new URL('../smoke_shots/model-files/',import.meta.url);fs.mkdirSync(out,{recursive:true});
const params={shape:'cube',poly4d:'tesseract',dynkin:'E8',rootSystem:'G2',tilingSystem:'H2',tilingDensity:3,quasiReach:2,quasiWindow:1.5,quasiPhason:0};
for(const view of ['platonic','polytope','e8coxeter','bloom','raymarched','rootlab','tiling','quasicrystal','dynkin']) {
  const data=createGeometryExporters(DATA,{...params,view}).geometryForView();
  const projection=data.dimension===4 ? data.verts.map(([x,y,z,w])=>[x/(2.5-w),y/(2.5-w),z/(2.5-w)]) : null;
  const model=exportModelRecord(data,projection);
  assert.equal(modelOBJ(model).split('\nv ').length-1,model.vertices.length);
  assert.match(modelPLY(model),new RegExp(`element vertex ${model.vertices.length}\n`));
  assert.equal(modelCSV(model).trim().split('\r\n').length,model.vertices.length+1);
  assert.match(modelSVG(model),/^<svg/);
  fs.writeFileSync(new URL(`${view}.ply`,out),modelPLY(model));
}
for(const shape of Object.keys(DATA.platonic)) {
  const model=exportModelRecord(createGeometryExporters(DATA,{view:'platonic',shape}).geometryForView());
  const mesh=await createPrintMesh(model,{mode:'solid',size:80});
  assert.ok(mesh.stats.volumeMm3>0);
  const span=[0,1,2].map(k=>Math.max(...mesh.vertices.map(v=>v[k]))-Math.min(...mesh.vertices.map(v=>v[k])));
  assert.ok(Math.abs(Math.max(...span)-80)<1e-4);
  const stl=meshSTL(mesh);assert.equal(stl.length,84+mesh.faces.length*50);
  fs.writeFileSync(new URL(`${shape}.stl`,out),stl);fs.writeFileSync(new URL(`${shape}.3mf`,out),mesh3MF(mesh));
}
const poly=DATA.polytopes4d.tesseract;
const model=exportModelRecord(createGeometryExporters(DATA,{view:'polytope',poly4d:'tesseract'}).geometryForView(),poly.verts.map(([x,y,z,w])=>[x/(2.5-w),y/(2.5-w),z/(2.5-w)]));
const mesh=await createPrintMesh(model,{size:60,thickness:3});
assert.ok(mesh.faces.length>100);
fs.writeFileSync(new URL('tesseract.stl',out),meshSTL(mesh));fs.writeFileSync(new URL('tesseract.3mf',out),mesh3MF(mesh));
assert.throws(()=>validatePrintMesh({...mesh,faces:mesh.faces.slice(1)}),/not closed/);
await assert.rejects(createPrintMesh(model,{size:300,thickness:.5}),/Increase strut/);
const controller=new AbortController();controller.abort();await assert.rejects(createPrintMesh(model,{signal:controller.signal}),{name:'AbortError'});
for (const name of ['5cell','16cell','24cell','120cell','600cell']) {
  const poly=DATA.polytopes4d[name];
  const projected=poly.verts.map(v=>{
    const p=[...v];for(const [a,b,t] of [[0,3,.37],[1,2,.23],[2,3,.51]]) {const x=p[a],y=p[b];p[a]=x*Math.cos(t)-y*Math.sin(t);p[b]=x*Math.sin(t)+y*Math.cos(t);}
    return p.slice(0,3).map(x=>x/(3-p[3]));
  });
  const record=exportModelRecord(createGeometryExporters(DATA,{view:'polytope',poly4d:name}).geometryForView(),projected);
  const result=await createPrintMesh(record,{size:80,thickness:3});
  fs.writeFileSync(new URL(`${name}.stl`,out),meshSTL(result));fs.writeFileSync(new URL(`${name}.3mf`,out),mesh3MF(result));
  console.log(`${name}: ${result.faces.length} closed, oriented triangles`);
}
console.log(`All models: OBJ / PLY / CSV / SVG. Five solid meshes and joined tesseract (${mesh.faces.length} triangles): closure, winding, units, bounds and cancellation passed.`);
