import { convexHullFaces } from '../math/convex-hull.js';

const sub = (a,b) => a.map((v,i) => v-b[i]);
const dot = (a,b) => a.reduce((s,v,i) => s+v*b[i],0);
const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];

// Check the actual serialized (float32) coordinates before offering a print file.
export function validatePrintMesh(mesh) {
  if (!mesh.vertices.length || !mesh.faces.length) throw new Error('The print mesh is empty.');
  const edges = new Map(); let volume = 0;
  for (const p of mesh.vertices) if (p.length !== 3 || !p.every(Number.isFinite)) throw new Error('Invalid print coordinate.');
  for (const f of mesh.faces) {
    if (f.length !== 3 || !f.every(i => Number.isInteger(i) && i >= 0 && i < mesh.vertices.length)) throw new Error('Invalid print triangle.');
    const [a,b,c] = f.map(i => mesh.vertices[i]);
    if (Math.hypot(...cross(sub(b,a),sub(c,a))) < 1e-12) throw new Error('A print triangle collapsed. Try a different thickness or rotation.');
    volume += dot(a,cross(b,c))/6;
    f.forEach((v,i) => { const w=f[(i+1)%3], key=v<w ? `${v}:${w}` : `${w}:${v}`;
      const entry=edges.get(key) || [0,0]; entry[0]++; entry[1]+=v<w ? 1 : -1; edges.set(key,entry); });
  }
  if ([...edges.values()].some(([n,d]) => n!==2 || d!==0)) throw new Error('The surface is not closed. Try a thicker strut or a different rotation.');
  if (!(volume > 0)) throw new Error('The surface has no positive enclosed volume.');
  return { triangles: mesh.faces.length, vertices: mesh.vertices.length, volumeMm3: volume };
}

function fit(vertices, size) {
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
  for(const v of vertices) for(let k=0;k<3;k++) { min[k]=Math.min(min[k],v[k]); max[k]=Math.max(max[k],v[k]); }
  const span=Math.max(...max.map((v,k)=>v-min[k]));
  if (!(span>1e-9)) throw new Error('The model has no measurable size.');
  return vertices.map(v=>v.map((x,k)=>(x-(min[k]+max[k])/2)*size/span));
}

// Capsule union sampled on a bounded grid, then a conforming tetrahedral contour.
// All edges share one scalar field, so crossing struts and nodes become one surface.
// Work is yielded between slices; closing the dialog cancels before delivery.
export const createPrintMesh = async function(model, {size=80, thickness=3, mode='struts', signal, onProgress=()=>{}} = {}) {
  if (!Number.isFinite(size) || size<10 || size>300) throw new Error('Choose a size from 10 to 300 mm.');
  if (mode!=='solid' && (!Number.isFinite(thickness) || thickness<0.5 || thickness>20 || thickness>=size/2)) throw new Error('Choose a strut diameter from 0.5 to 20 mm, smaller than half the model size.');
  const pause = async progress => { signal?.throwIfAborted(); onProgress(progress); await new Promise(resolve=>setTimeout(resolve,0)); signal?.throwIfAborted(); };
  await pause(0);
  let mesh;
  if (mode==='solid') {
    if (model.data?.kind!=='polyhedron' || !['tetrahedron','cube','octahedron','dodecahedron','icosahedron'].includes(model.name)) throw new Error('Solid hull export is only available for regular Platonic solids.');
    const vertices=fit(model.vertices,size);
    mesh={vertices,faces:convexHullFaces(vertices)};
  } else {
    if (!model.edges.length) throw new Error('This model has no edges to thicken.');
    const step=thickness/3, radius=thickness/2;
    if (Math.ceil(size/step)+7>144) throw new Error('Increase strut diameter or reduce model size (size / diameter must be 45 or less).');
    const points=fit(model.vertices,size-thickness);
    const low=[0,1,2].map(k=>Math.min(...points.map(v=>v[k]))-radius-2*step);
    const dims=[0,1,2].map(k=>Math.ceil((Math.max(...points.map(v=>v[k]))+radius+2*step-low[k])/step)+1);
    const [nx,ny,nz]=dims, plane=nx*ny;
    const field=new Float32Array(plane*nz).fill(-step*2);
    const position=id=>[low[0]+id%nx*step,low[1]+Math.floor(id/nx)%ny*step,low[2]+Math.floor(id/plane)*step];
    for (let e=0;e<model.edges.length;e++) {
      const [ia,ib]=model.edges[e], a=points[ia], b=points[ib], d=sub(b,a), dd=dot(d,d);
      const samples=Math.max(1,Math.ceil(Math.sqrt(dd)/(step*.8)));
      // Visit only a narrow tube around each edge, not its entire bounding box.
      const visited=new Set();
      for (let s=0;s<=samples;s++) {
        const c=a.map((v,k)=>Math.round((v+d[k]*s/samples-low[k])/step));
        for (let z=Math.max(0,c[2]-3);z<=Math.min(nz-1,c[2]+3);z++)
          for (let y=Math.max(0,c[1]-3);y<=Math.min(ny-1,c[1]+3);y++)
            for (let x=Math.max(0,c[0]-3);x<=Math.min(nx-1,c[0]+3);x++) {
              const id=x+y*nx+z*plane;
              if (visited.has(id)) continue; visited.add(id);
              const p=sub(position(id),a), t=dd ? Math.max(0,Math.min(1,dot(p,d)/dd)) : 0;
              const value=radius-Math.hypot(...p.map((v,k)=>v-t*d[k]));
              // Avoid exact grid-vertex intersections, including after float conversion.
              field[id]=Math.max(field[id],Math.abs(value)<step*1e-5 ? step*1e-5 : value);
            }
      }
      if (e%12===0) await pause(.45*e/model.edges.length);
    }
    const vertices=[], faces=[], cache=new Map();
    const intersect=(a,b)=>{
      const key=a<b ? a*field.length+b : b*field.length+a;
      if (cache.has(key)) return cache.get(key);
      const p=position(a),q=position(b),t=field[a]/(field[a]-field[b]);
      const id=vertices.length; vertices.push(p.map((v,k)=>v+t*(q[k]-v))); cache.set(key,id); return id;
    };
    const tetrahedra=[[0,5,1,6],[0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6]];
    for(let z=0;z<nz-1;z++) {
      for(let y=0;y<ny-1;y++) for(let x=0;x<nx-1;x++) {
        const base=x+y*nx+z*plane, ids=[base,base+1,base+1+nx,base+nx,base+plane,base+plane+1,base+plane+1+nx,base+plane+nx];
        if (ids.every(i=>field[i]>0) || ids.every(i=>field[i]<0)) continue;
        for (const tet of tetrahedra) {
          const inside=tet.map(i=>ids[i]).filter(i=>field[i]>0),outside=tet.map(i=>ids[i]).filter(i=>field[i]<0);
          if (!inside.length || !outside.length) continue;
          const average=list=>list.map(position).reduce((a,p)=>a.map((v,k)=>v+p[k]/list.length),[0,0,0]);
          const outward=sub(average(outside),average(inside));
          let triangles;
          if (inside.length===1) triangles=[outside.map(b=>intersect(inside[0],b))];
          else if(outside.length===1) triangles=[inside.map(a=>intersect(a,outside[0]))];
          else { const [a,b]=inside,[c,d]=outside, ac=intersect(a,c),ad=intersect(a,d),bc=intersect(b,c),bd=intersect(b,d); triangles=[[ac,ad,bc],[ad,bd,bc]]; }
          for (const f of triangles) { const [a,b,c]=f.map(i=>vertices[i]); if(dot(cross(sub(b,a),sub(c,a)),outward)<0) [f[1],f[2]]=[f[2],f[1]]; faces.push(f); }
        }
      }
      if (faces.length>900000) throw new Error('This mesh is too large. Increase strut diameter or reduce model size.');
      if(z%3===0) await pause(.45+.45*z/nz);
    }
    mesh={vertices:fit(vertices,size),faces};
  }
  // Put the lowest point on the build plate. Use the same precision in STL/3MF.
  const bottom=mesh.vertices.reduce((low,v)=>Math.min(low,v[2]),Infinity);
  mesh.vertices=mesh.vertices.map(v=>v.map((x,k)=>Math.fround(x-(k===2 ? bottom : 0))));
  await pause(.95);
  mesh.stats=validatePrintMesh(mesh);
  await pause(1);
  return mesh;
};
