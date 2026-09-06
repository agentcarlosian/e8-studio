// Portable geometry records and serializers. Shader appearance belongs in PNG;
// these files deliberately describe mathematical geometry rather than GPU effects.
export function exportModelRecord(data, projectedVertices = null) {
  if (!data) throw new Error('This model has no geometry to export.');
  let vertices = [], edges = [], faces = [], note = 'Model coordinates; lighting and background are not included.';
  if (data.dimension === 4) {
    if (!projectedVertices?.length) throw new Error('Wait for the 4D projection to finish loading.');
    vertices = projectedVertices; edges = data.edges; faces = data.faces || [];
    note = 'Current 4D-to-3D projection. Faces may intersect; use the print export to make solid struts. JSON keeps the original 4D coordinates.';
  } else if (data.verts) {
    vertices = data.verts; edges = data.edges; faces = data.faces;
  } else if (data.nodes) {
    vertices = data.nodes.map(([x,y]) => [x,-y,0]); edges = data.edges.map(e => e.slice(0,2));
  } else if (data.roots) {
    vertices = [[0,0,0], ...data.roots.map(([x,y]) => [x,y,0])];
    edges = data.roots.map((_,i) => [0,i+1]);
  } else if (data.tiles) {
    const index = new Map();
    const add = ([x,y]) => { const key = `${x.toFixed(8)},${y.toFixed(8)}`; if (!index.has(key)) { index.set(key, vertices.length); vertices.push([x,y,0]); } return index.get(key); };
    faces = data.tiles.map(t => t.points.map(add));
    edges = data.edges.map(e => e.map(add));
    note = 'Flat mathematical tiling; animated relief is not included.';
  } else if (data.points) {
    vertices = data.points.map(p => [...p.projected,0]); edges = data.edges;
    note = 'Physical-space lattice patch. JSON also includes the original lattice coordinates and diffraction data.';
  } else if (data.coxeter_projection_2d) {
    vertices = data.coxeter_projection_2d.map(p => [p.x,p.y,0]);
    note = '240 E8 roots in the Coxeter plane. Bloom motion and the SDF surface are shader effects: use PNG to capture their appearance. JSON retains all eight dimensions.';
  }
  vertices = vertices.map(v => v.slice(0,3));
  edges = (edges || []).map(e => e.slice(0,2)); faces = (faces || []).map(f => [...f]);
  if (!vertices.length || !vertices.every(v => v.length === 3 && v.every(Number.isFinite))) throw new Error('Geometry contains invalid coordinates.');
  if (![...edges,...faces].every(f => f.every(i => Number.isInteger(i) && i >= 0 && i < vertices.length))) throw new Error('Geometry contains invalid indices.');
  return { name: data.name || data.view || 'model', vertices, edges, faces, note, data };
}

export function modelOBJ(model) {
  const rows = [`# E8 Studio: ${model.name}`, `# ${model.note}`, `o ${model.name.replace(/[^a-z0-9_-]/gi,'_')}`];
  for (const v of model.vertices) rows.push(`v ${v.join(' ')}`);
  for (const f of model.faces) rows.push(`f ${f.map(i => i+1).join(' ')}`);
  for (const e of model.edges) rows.push(`l ${e.map(i => i+1).join(' ')}`);
  if (!model.faces.length && !model.edges.length) model.vertices.forEach((_,i) => rows.push(`p ${i+1}`));
  return rows.join('\n')+'\n';
}

export function modelPLY(model) {
  return ['ply','format ascii 1.0','comment E8 Studio geometry; coordinates are unitless',
    `element vertex ${model.vertices.length}`,'property float x','property float y','property float z',
    `element face ${model.faces.length}`,'property list uchar int vertex_indices',
    `element edge ${model.edges.length}`,'property int vertex1','property int vertex2','end_header',
    ...model.vertices.map(v => v.join(' ')), ...model.faces.map(f => `${f.length} ${f.join(' ')}`),
    ...model.edges.map(e => e.join(' '))].join('\n')+'\n';
}

export function modelCSV(model) {
  return 'index,x,y,z\r\n'+model.vertices.map((v,i) => [i,...v].join(',')).join('\r\n')+'\r\n';
}

export function modelSVG(model) {
  const min = [0,1].map(k => Math.min(...model.vertices.map(v => v[k])));
  const max = [0,1].map(k => Math.max(...model.vertices.map(v => v[k])));
  const scale = 1080 / Math.max(max[0]-min[0],max[1]-min[1],1e-8);
  const pts = model.vertices.map(v => [600+(v[0]-(min[0]+max[0])/2)*scale,600-(v[1]-(min[1]+max[1])/2)*scale]);
  const paths = model.faces.map(f => `<polygon points="${f.map(i => pts[i].join(',')).join(' ')}" fill="#bfa469" fill-opacity=".08"/>`);
  for (const [a,b] of model.edges) paths.push(`<path d="M${pts[a].join(',')} L${pts[b].join(',')}"/>`);
  for (const p of pts) paths.push(`<circle cx="${p[0]}" cy="${p[1]}" r="3" fill="#bfa469"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200"><title>E8 Studio — orthographic XY diagram</title><g stroke="#bfa469" stroke-width="1.5" fill="none">${paths.join('')}</g></svg>`;
}
