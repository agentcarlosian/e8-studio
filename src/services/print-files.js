// 3MF Core / OPC: https://3mf.io/spec/ . ZIP entries use the permitted STORE method.
// Geometry is validated by createPrintMesh before these serializers are called.
export function meshSTL(mesh) {
  const bytes=new Uint8Array(84+mesh.faces.length*50), view=new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode('E8 Studio | millimeters | geometry only')); view.setUint32(80,mesh.faces.length,true);
  mesh.faces.forEach((face,i)=>{
    const [a,b,c]=face.map(index=>mesh.vertices[index]),u=b.map((v,k)=>v-a[k]),v=c.map((n,k)=>n-a[k]);
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],len=Math.hypot(...n);
    [...n.map(x=>x/len),...a,...b,...c].forEach((value,j)=>view.setFloat32(84+i*50+j*4,value,true));
  });
  return bytes;
}

function crc32(bytes) {
  let crc=0xffffffff;
  for (const byte of bytes) { crc^=byte; for(let bit=0;bit<8;bit++) crc=(crc>>>1)^((crc&1) ? 0xedb88320 : 0); }
  return (crc^0xffffffff)>>>0;
}

function storedZip(files) {
  const encoder=new TextEncoder(),entries=Object.entries(files).map(([name,text])=>({name:encoder.encode(name),data:encoder.encode(text)}));
  const localSize=entries.reduce((n,e)=>n+30+e.name.length+e.data.length,0),centralSize=entries.reduce((n,e)=>n+46+e.name.length,0);
  const bytes=new Uint8Array(localSize+centralSize+22),v=new DataView(bytes.buffer); let offset=0,central=localSize;
  for(const e of entries) {
    const crc=crc32(e.data),length=e.data.length;
    v.setUint32(offset,0x04034b50,true); v.setUint16(offset+4,20,true); v.setUint16(offset+12,33,true);
    v.setUint32(offset+14,crc,true); v.setUint32(offset+18,length,true); v.setUint32(offset+22,length,true); v.setUint16(offset+26,e.name.length,true);
    bytes.set(e.name,offset+30);bytes.set(e.data,offset+30+e.name.length);
    v.setUint32(central,0x02014b50,true);v.setUint16(central+4,20,true);v.setUint16(central+6,20,true);v.setUint16(central+14,33,true);
    v.setUint32(central+16,crc,true);v.setUint32(central+20,length,true);v.setUint32(central+24,length,true);v.setUint16(central+28,e.name.length,true);v.setUint32(central+42,offset,true);
    bytes.set(e.name,central+46);offset+=30+e.name.length+length;central+=46+e.name.length;
  }
  v.setUint32(central,0x06054b50,true);v.setUint16(central+8,entries.length,true);v.setUint16(central+10,entries.length,true);
  v.setUint32(central+12,centralSize,true);v.setUint32(central+16,localSize,true);
  return bytes;
}

export function mesh3MF(mesh) {
  const vertices=mesh.vertices.map(v=>`<vertex x="${v[0]}" y="${v[1]}" z="${v[2]}"/>`).join('');
  const triangles=mesh.faces.map(f=>`<triangle v1="${f[0]}" v2="${f[1]}" v3="${f[2]}"/>`).join('');
  return storedZip({
    '[Content_Types].xml':'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>',
    '_rels/.rels':'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel" Target="/3D/3dmodel.model"/></Relationships>',
    '3D/3dmodel.model':`<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"><metadata name="Application">E8 Studio</metadata><resources><object id="1" type="model"><mesh><vertices>${vertices}</vertices><triangles>${triangles}</triangles></mesh></object></resources><build><item objectid="1"/></build></model>`,
  });
}
