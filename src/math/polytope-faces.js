// The regular 4-polytopes' polygonal 2-faces are their shortest edge cycles.
// Cache topology by the immutable canonical geometry, never by its projection.
const polytopeFaceCache = new WeakMap();
const faceSides = { '5cell': 3, tesseract: 4, '16cell': 3, '24cell': 3, '600cell': 3, '120cell': 5 };

export function polytopeFaces(name, geometry) {
  if (!geometry || !faceSides[name]) return [];
  if (polytopeFaceCache.has(geometry)) return polytopeFaceCache.get(geometry);
  const adjacency = geometry.verts.map(() => new Set());
  for (const [a, b] of geometry.edges) { adjacency[a].add(b); adjacency[b].add(a); }
  const faces = [], length = faceSides[name];
  for (let start = 0; start < adjacency.length; start++) {
    const walk = path => {
      const last = path[path.length - 1];
      if (path.length === length) {
        // Minimum index first, then one of the two winding directions.
        if (adjacency[last].has(start) && path[1] < last) faces.push(path);
        return;
      }
      for (const next of adjacency[last]) {
        if (next > start && !path.includes(next)) walk([...path, next]);
      }
    };
    walk([start]);
  }
  polytopeFaceCache.set(geometry, faces);
  return faces;
}

export function triangulatePolytopeFaces(faces) {
  return faces.flatMap(face => face.slice(1, -1).map((index, i) => [face[0], index, face[i + 2]]));
}
