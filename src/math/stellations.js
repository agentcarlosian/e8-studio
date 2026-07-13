// stellations.js — Kepler–Poinsot star polyhedra geometry (Round 9).
//
// The four regular star polyhedra (non-convex regular polyhedra):
//   small stellated dodecahedron  {5/2, 5}   12 verts · 30 edges · 12 pentagram faces
//   great dodecahedron            {5, 5/2}   12 verts · 30 edges · 12 pentagon faces
//   great icosahedron             {3, 5/2}   12 verts · 30 edges · 20 triangle faces
//   great stellated dodecahedron  {5/2, 3}   20 verts · 30 edges · 12 pentagram faces
//
// All four share the symmetry group of the icosahedron (H3, order 120) — so each
// has 12 or 20 vertices taken directly from the icosahedron / dodecahedron vertex
// sets. The difference is in the edges/faces: the star polyhedra connect vertices
// that the convex ones do not (the "great" connection). This is why stellation is
// the natural companion to the Platonic study — same vertices, richer topology.
//
// We generate them at runtime rather than storing in data/platonic.json so the
// geometry is always derived from the same φ-based coordinates as the icosahedron.

const PHI = (1 + Math.sqrt(5)) / 2; // golden ratio
const INV_PHI = 1 / PHI;

// Icosahedron vertices (12): three golden rectangles on the coordinate planes.
const ICOSA_VERTS = [
  [0, 1, PHI], [0, 1, -PHI], [0, -1, PHI], [0, -1, -PHI],
  [1, PHI, 0], [1, -PHI, 0], [-1, PHI, 0], [-1, -PHI, 0],
  [PHI, 0, 1], [PHI, 0, -1], [-PHI, 0, 1], [-PHI, 0, -1],
];

// Dodecahedron vertices (20): (±1,±1,±1) plus (0, ±1/φ, ±φ) and cyclic perms.
const DODECA_VERTS = [
  [1, 1, 1], [1, 1, -1], [1, -1, 1], [1, -1, -1],
  [-1, 1, 1], [-1, 1, -1], [-1, -1, 1], [-1, -1, -1],
  [0, INV_PHI, PHI], [0, INV_PHI, -PHI], [0, -INV_PHI, PHI], [0, -INV_PHI, -PHI],
  [INV_PHI, PHI, 0], [INV_PHI, -PHI, 0], [-INV_PHI, PHI, 0], [-INV_PHI, -PHI, 0],
  [PHI, 0, INV_PHI], [PHI, 0, -INV_PHI], [-PHI, 0, INV_PHI], [-PHI, 0, -INV_PHI],
];

// Normalize each vertex to the unit sphere so all shapes share a bounding radius.
function normalizeAll(verts) {
  return verts.map(([x, y, z]) => {
    const r = Math.hypot(x, y, z) || 1;
    return [x / r, y / r, z / r];
  });
}

/**
 * Build the edges of a polyhedron: connect every pair of vertices whose
 * Euclidean distance is within `tol` of `targetDist` (the edge length).
 * This is how we derive star-polyhedron edges — the "great" connection joins
 * vertices one step further apart than the convex edge.
 */
function edgesByDistance(verts, targetDist, tol = 0.06) {
  const edges = [];
  for (let i = 0; i < verts.length; i++) {
    for (let j = i + 1; j < verts.length; j++) {
      const d = Math.hypot(
        verts[i][0] - verts[j][0],
        verts[i][1] - verts[j][1],
        verts[i][2] - verts[j][2],
      );
      if (Math.abs(d - targetDist) < tol) edges.push([i, j]);
    }
  }
  return edges;
}

/**
 * Build an adjacency list from a list of edges.
 */
function buildAdjacency(numVerts, edges) {
  const adj = Array.from({ length: numVerts }, () => []);
  for (const [i, j] of edges) { adj[i].push(j); adj[j].push(i); }
  return adj;
}

/**
 * Find the planar 5-cycles (pentagram faces) in a star polyhedron's edge graph.
 *
 * A Kepler–Poinsot {5/2} face is a self-intersecting pentagram: 5 vertices
 * connected by "great" edges in a closed cycle, AND the 5 vertices are coplanar.
 * The edge graph has many 5-cycles (72 for the stellated dodecahedron's
 * 30 edges), but only 12 are planar — those are the true faces. Planarity is
 * tested by defining a plane from the first 3 vertices and checking the other
 * 2 lie on it (within tolerance).
 *
 * Returns faces as triangle-fan triples: each pentagram [v0,v1,v2,v3,v4] →
 * [[v0,v1,v2],[v0,v2,v3],[v0,v3,v4]] so the existing convex face-renderer
 * (which expects a triangle list) draws a filled pentagram.
 */
function pentagramFaces(verts, edges) {
  const adj = buildAdjacency(verts.length, edges);
  const seen = new Set();
  const triangles = [];

  const planar5 = (idx) => {
    const v = idx.map(k => verts[k]);
    const e1 = [v[1][0]-v[0][0], v[1][1]-v[0][1], v[1][2]-v[0][2]];
    const e2 = [v[2][0]-v[0][0], v[2][1]-v[0][1], v[2][2]-v[0][2]];
    const n = [e1[1]*e2[2]-e1[2]*e2[1], e1[2]*e2[0]-e1[0]*e2[2], e1[0]*e2[1]-e1[1]*e2[0]];
    const off = n[0]*v[0][0] + n[1]*v[0][1] + n[2]*v[0][2];
    return Math.abs(n[0]*v[3][0]+n[1]*v[3][1]+n[2]*v[3][2]-off) < 0.05
        && Math.abs(n[0]*v[4][0]+n[1]*v[4][1]+n[2]*v[4][2]-off) < 0.05;
  };

  const dfs = (start) => {
    const path = [start];
    const visit = (v) => {
      if (path.length === 5) {
        if (adj[v].includes(start) && planar5(path)) {
          const key = [...path].sort((a, b) => a - b).join(',');
          if (!seen.has(key)) {
            seen.add(key);
            // Fan-triangulate the pentagram into 3 triangles.
            const [a, b, c, d, e] = path;
            triangles.push([a, b, c], [a, c, d], [a, d, e]);
          }
        }
        return;
      }
      for (const next of adj[v]) {
        if (!path.includes(next) && next !== start) {
          path.push(next);
          visit(next);
          path.pop();
        }
      }
    };
    visit(start);
  };

  for (let s = 0; s < verts.length; s++) dfs(s);
  return triangles;
}

/**
 * Find the planar 5-cycles in the edge graph and re-order each one into a
 * CONVEX pentagon (great dodecahedron {5, 5/2}). The great dodecahedron's 12
 * faces are ordinary convex pentagons drawn from the same 5 planar vertices
 * the pentagram finder locates — but wound in non-crossing angular order around
 * the face centroid instead of the self-intersecting {5/2} order.
 *
 * Returns a triangle list (3 per face) for the convex face-renderer.
 */
function convexPentagonFaces(verts, edges) {
  const adj = buildAdjacency(verts.length, edges);
  const seen = new Set();
  const triangles = [];

  const planar5 = (idx) => {
    const v = idx.map(k => verts[k]);
    const e1 = [v[1][0]-v[0][0], v[1][1]-v[0][1], v[1][2]-v[0][2]];
    const e2 = [v[2][0]-v[0][0], v[2][1]-v[0][1], v[2][2]-v[0][2]];
    const n = [e1[1]*e2[2]-e1[2]*e2[1], e1[2]*e2[0]-e1[0]*e2[2], e1[0]*e2[1]-e1[1]*e2[0]];
    const off = n[0]*v[0][0] + n[1]*v[0][1] + n[2]*v[0][2];
    return Math.abs(n[0]*v[3][0]+n[1]*v[3][1]+n[2]*v[3][2]-off) < 0.05
        && Math.abs(n[0]*v[4][0]+n[1]*v[4][1]+n[2]*v[4][2]-off) < 0.05;
  };

  // Build a 2D basis (u, w) in the face's plane, then sort the 5 vertices by
  // polar angle around their centroid → convex (non-self-intersecting) winding.
  const convexOrder = (idx) => {
    const v = idx.map(k => verts[k]);
    const c = [0, 0, 0];
    for (const p of v) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; }
    c[0] /= 5; c[1] /= 5; c[2] /= 5;
    // u = first vertex offset (normalized); w = a second offset made ⊥ to u.
    const u = [v[0][0]-c[0], v[0][1]-c[1], v[0][2]-c[2]];
    const ul = Math.hypot(u[0], u[1], u[2]) || 1;
    u[0] /= ul; u[1] /= ul; u[2] /= ul;
    let w = [v[1][0]-c[0], v[1][1]-c[1], v[1][2]-c[2]];
    const dot = w[0]*u[0] + w[1]*u[1] + w[2]*u[2];
    w = [w[0]-dot*u[0], w[1]-dot*u[1], w[2]-dot*u[2]];
    const wl = Math.hypot(w[0], w[1], w[2]) || 1;
    w[0] /= wl; w[1] /= wl; w[2] /= wl;
    return idx
      .map(k => {
        const p = verts[k];
        const x = p[0]*u[0] + p[1]*u[1] + p[2]*u[2];
        const y = p[0]*w[0] + p[1]*w[1] + p[2]*w[2];
        return { k, a: Math.atan2(y, x) };
      })
      .sort((a, b) => a.a - b.a)
      .map(o => o.k);
  };

  const dfs = (start) => {
    const path = [start];
    const visit = (v) => {
      if (path.length === 5) {
        if (adj[v].includes(start) && planar5(path)) {
          const key = [...path].sort((a, b) => a - b).join(',');
          if (!seen.has(key)) {
            seen.add(key);
            // Re-wind the same 5 vertices as a convex pentagon, then fan-triangulate.
            const [a, b, c, d, e] = convexOrder(path);
            triangles.push([a, b, c], [a, c, d], [a, d, e]);
          }
        }
        return;
      }
      for (const next of adj[v]) {
        if (!path.includes(next) && next !== start) {
          path.push(next);
          visit(next);
          path.pop();
        }
      }
    };
    visit(start);
  };

  for (let s = 0; s < verts.length; s++) dfs(s);
  return triangles;
}

/**
 * Find the triangular faces (great icosahedron {3, 5/2}). The great icosahedron
 * has 20 triangular faces; each is a 3-cycle in the great-edge graph. Returns
 * the triangles directly (1 triple per face) — no winding fix-up needed since a
 * triangle is always planar and convex.
 */
function triangleFaces(verts, edges) {
  const adj = buildAdjacency(verts.length, edges);
  const triangles = [];
  for (let i = 0; i < verts.length; i++) {
    for (const j of adj[i]) {
      if (j <= i) continue;
      for (const k of adj[j]) {
        if (k <= j) continue;
        if (adj[k].includes(i)) triangles.push([i, j, k]);
      }
    }
  }
  return triangles;
}

// Faces for the star polyhedra are computed lazily in getStellation(): the
// {5/2}-based polyhedra get pentagram faces; {5,5/2} gets convex pentagons;
// {3,5/2} gets triangles. All four now have filled faces.

export const STELLATIONS = {
  // Small stellated dodecahedron {5/2, 5}: 12 icosahedron vertices, 30 edges.
  // The pentagram faces join vertices at the "great" icosahedral distance
  // (one step further than the convex edge). On the unit sphere this is ≈1.701,
  // verified to produce exactly 30 edges + 12 pentagram faces from the set.
  stellated_dodecahedron: {
    verts: normalizeAll(ICOSA_VERTS),
    edges: null,
    faces: null,                       // computed by getStellation() via pentagramFaces()
    faceType: 'pentagram',  // {5/2, ...} → 12 self-intersecting pentagram faces
    edgeDist: 1.701,
  },
  // Great dodecahedron {5, 5/2}: same 12 vertices, 12 CONVEX PENTAGON faces
  // from the great-edge graph (re-wound into non-crossing order). Same edge
  // length as the stellated dodecahedron (the great icosahedral distance).
  great_dodecahedron: {
    verts: normalizeAll(ICOSA_VERTS),
    edges: null,
    faces: null,
    faceType: 'convexPentagon',  // {5, 5/2} → 12 convex pentagon faces
    edgeDist: 1.701,
  },
  // Great icosahedron {3, 5/2}: 12 vertices, 20 TRIANGLE faces — the 3-cycles
  // of the great-edge graph.
  great_icosahedron: {
    verts: normalizeAll(ICOSA_VERTS),
    edges: null,
    faces: null,
    faceType: 'triangle',  // {3, 5/2} → 20 triangle faces
    edgeDist: 1.701,
  },
  // Great stellated dodecahedron {5/2, 3}: 20 dodecahedron vertices, 30 edges.
  // The longest non-antipodal dodecahedral distance (≈1.868) gives 30 edges.
  // {5/2} faces → 12 pentagrams.
  great_stellated_dodecahedron: {
    verts: normalizeAll(DODECA_VERTS),
    edges: null,
    faces: null,
    faceType: 'pentagram',  // {5/2, ...} → 12 pentagram faces
    edgeDist: 1.868,
  },
};

/**
 * Get a fully-realized stellation geometry (verts/edges/faces) with edges
 * computed from the edge-length heuristic and faces computed per face type.
 * Returns null for unknown shapes.
 *
 * Faces: all four Kepler–Poinsot solids now have filled faces.
 *   - stellated_dodecahedron      {5/2, 5}  → 12 pentagram faces
 *   - great_stellated_dodecahedron {5/2, 3} → 12 pentagram faces
 *   - great_dodecahedron          {5, 5/2}  → 12 convex pentagon faces
 *   - great_icosahedron           {3, 5/2}  → 20 triangle faces
 * Pentagrams and convex pentagons both come from planar 5-cycles in the
 * great-edge graph (12 each); the difference is the winding (self-intersecting
 * vs. convex). Triangles are the 3-cycles of the great-edge graph.
 */
export function getStellation(name) {
  const s = STELLATIONS[name];
  if (!s) return null;
  if (!s.edges) {
    s.edges = edgesByDistance(s.verts, s.edgeDist);
  }
  if (!s.faces) {
    switch (s.faceType) {
      case 'pentagram':      s.faces = pentagramFaces(s.verts, s.edges); break;
      case 'convexPentagon': s.faces = convexPentagonFaces(s.verts, s.edges); break;
      case 'triangle':       s.faces = triangleFaces(s.verts, s.edges); break;
      default:               s.faces = [];
    }
  }
  return {
    verts: s.verts,
    edges: s.edges,
    faces: s.faces,
  };
}

export const STELLATION_NAMES = Object.keys(STELLATIONS);

// Short display labels for the panel (compact row).
export const STELLATION_LABELS = {
  stellated_dodecahedron: 'sDodec',
  great_dodecahedron: 'gDodec',
  great_icosahedron: 'gIcosa',
  great_stellated_dodecahedron: 'gsDodec',
};

// Schläfli symbols + face/edge/vertex counts for the math panel.
// {p, q}: faces are p-gons (5/2 = pentagram), q meet at each vertex.
// V − E + F = 2 still holds for the vertex/edge/face *counts* even though the
// faces self-intersect (the Euler characteristic is topological, not geometric).
export const STELLATION_INFO = {
  stellated_dodecahedron: {
    name: 'Small stellated dodecahedron',
    schlafli: '{5/2, 5}',
    verts: 12, edges: 30, faces: 12,
    faceType: 'pentagram (5/2)',
    discoverer: 'Kepler, 1619',
  },
  great_dodecahedron: {
    name: 'Great dodecahedron',
    schlafli: '{5, 5/2}',
    verts: 12, edges: 30, faces: 12,
    faceType: 'pentagon (5)',
    discoverer: 'Poinsot, 1809',
  },
  great_icosahedron: {
    name: 'Great icosahedron',
    schlafli: '{3, 5/2}',
    verts: 12, edges: 30, faces: 20,
    faceType: 'triangle (3)',
    discoverer: 'Poinsot, 1809',
  },
  great_stellated_dodecahedron: {
    name: 'Great stellated dodecahedron',
    schlafli: '{5/2, 3}',
    verts: 20, edges: 30, faces: 12,
    faceType: 'pentagram (5/2)',
    discoverer: 'Kepler, 1619',
  },
};
