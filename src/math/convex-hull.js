// The five convex Platonic solids are centred on the origin. Rather than trust
// the `faces` arrays baked into data/platonic.json (which were generated wrong —
// the icosahedron/dodecahedron triangles span non-adjacent vertices and slice
// through the interior), we derive a guaranteed-correct triangulation from the
// vertices here. O(V^4) brute force, but V≤20 so it's a few thousand ops.
//
// Algorithm: a triple of vertices is a hull facet iff every other vertex lies
// on one side of its plane. We collect the distinct supporting planes, gather
// all vertices lying on each (handles coplanar quad/pentagon faces), order them
// CCW about the face centroid, and fan-triangulate with outward winding.
export function convexHullFaces(verts) {
  const n = verts.length;
  if (n < 4) return [];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  let maxR = 0;
  for (const v of verts) maxR = Math.max(maxR, Math.hypot(v[0], v[1], v[2]));
  const eps = 1e-4 * (maxR || 1);

  // Collect distinct outward-facing supporting planes.
  const planes = new Map();
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        let nrm = cross(sub(verts[j], verts[i]), sub(verts[k], verts[i]));
        const len = Math.hypot(nrm[0], nrm[1], nrm[2]);
        if (len < eps) continue; // collinear triple
        nrm = [nrm[0] / len, nrm[1] / len, nrm[2] / len];
        let d = dot(nrm, verts[i]);
        let pos = 0, neg = 0;
        for (let m = 0; m < n; m++) {
          const s = dot(nrm, verts[m]) - d;
          if (s > eps) pos++; else if (s < -eps) neg++;
        }
        if (pos && neg) continue; // not a hull facet
        // Orient the normal outward (away from the origin-centred centroid).
        if (d < 0) { nrm = [-nrm[0], -nrm[1], -nrm[2]]; d = -d; }
        const key = [nrm[0], nrm[1], nrm[2], d]
          .map(x => Math.round(x / eps)).join(',');
        if (!planes.has(key)) planes.set(key, { nrm, d });
      }
    }
  }

  // Triangulate each planar face polygon.
  const faces = [];
  for (const { nrm, d } of planes.values()) {
    const idx = [];
    for (let m = 0; m < n; m++) {
      if (Math.abs(dot(nrm, verts[m]) - d) < 10 * eps) idx.push(m);
    }
    if (idx.length < 3) continue;
    // 2-D basis in the face plane (u, w) with u×w == nrm (outward).
    let u = Math.abs(nrm[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const proj = dot(u, nrm);
    u = [u[0] - proj * nrm[0], u[1] - proj * nrm[1], u[2] - proj * nrm[2]];
    const ul = Math.hypot(u[0], u[1], u[2]);
    u = [u[0] / ul, u[1] / ul, u[2] / ul];
    const w = cross(nrm, u);
    const c = [0, 0, 0];
    for (const m of idx) { c[0] += verts[m][0]; c[1] += verts[m][1]; c[2] += verts[m][2]; }
    c[0] /= idx.length; c[1] /= idx.length; c[2] /= idx.length;
    idx.sort((A, B) => {
      const pa = sub(verts[A], c), pb = sub(verts[B], c);
      return Math.atan2(dot(pa, w), dot(pa, u)) - Math.atan2(dot(pb, w), dot(pb, u));
    });
    for (let t = 1; t < idx.length - 1; t++) {
      faces.push([idx[0], idx[t], idx[t + 1]]);
    }
  }
  return faces;
}

