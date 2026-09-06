import { colorAt, e8ColoringT } from '../ui/palettes.js';
import { getStellation } from '../math/stellations.js';
import { deformPlatonicVert, morphActive } from '../math/morph.js';
import { generateRank2RootSystem } from '../math/rank2-roots.js';
import { generateCoxeterTiling } from '../math/coxeter-tilings.js';
import { generateE8Quasicrystal } from '../math/e8-quasicrystal.js';
import { viewSupportsExport } from '../state/model-registry.js';

// Pure document serializers: no renderer, browser storage, or delivery effects.
// Each context uses the caller's current scene so resets cannot leave stale state.
function svgEsc(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[ch]);
}

export function createGeometryExporters(DATA, params) {
  function subsetForShape(shapeName) {
    const subset = DATA.mckay_subsets?.[shapeName] || [];
    return new Set(Array.isArray(subset) ? subset : []);
  }

  function compareWeight(primary, compare, mode) {
    if (mode === 'off') return 0;
    if (mode === 'intersection') return primary && compare ? 1.5 : 0;
    if (mode === 'difference') return primary && !compare ? 1.15 : !primary && compare ? 0.75 : 0;
    return primary && compare ? 1.5 : primary ? 1.05 : compare ? 0.65 : 0;
  }

  // ── Geometry export (assets for other projects) ──────────────────────────────
  // Resolve a shape name to its raw geometry (3-D convex Platonic solid or
  // self-intersecting Kepler–Poinsot star), regardless of the current view.
  function shapeGeometry(name) {
    if (DATA.platonic && DATA.platonic[name]) return DATA.platonic[name];
    const st = getStellation(name);
    return st ? { verts: st.verts, edges: st.edges, faces: st.faces } : null;
  }

  // The active Platonic morph (twist/spike/jitter) — exports apply it so a morphed
  // solid exports exactly as it renders (3D-print your twisted creation).
  function currentMorph() {
    return { twist: params.shapeTwist || 0, spike: params.shapeSpike || 0, jitter: params.shapeJitter || 0 };
  }
  function morphedVerts(verts, m) {
    return morphActive(m) ? verts.map(v => deformPlatonicVert(v[0], v[1], v[2], m)) : verts;
  }

  // Wavefront OBJ for a Platonic/star solid — the universal 3-D interchange format
  // (imports into Blender / Unity / Maya, and 3-D-prints directly). OBJ indices
  // are 1-based. `l` lines carry the wireframe edges alongside the `f` faces.
  function objForShape(name) {
    const g = shapeGeometry(name);
    if (!g || !g.verts) return null;
    const m = currentMorph();
    const verts = morphedVerts(g.verts, m), faces = g.faces || [], edges = g.edges || [];
    const num = (x) => Number(x).toFixed(6);
    let s = `# E8 <-> Platonics Studio — ${name}\n`;
    s += `# ${verts.length} vertices, ${edges.length} edges, ${faces.length} triangles\n`;
    if (morphActive(m)) s += `# morph: twist=${m.twist} spike=${m.spike} jitter=${m.jitter}\n`;
    s += `o ${name}\n`;
    for (const v of verts) s += `v ${num(v[0])} ${num(v[1])} ${num(v[2])}\n`;
    for (const f of faces) s += `f ${f[0] + 1} ${f[1] + 1} ${f[2] + 1}\n`;
    for (const e of edges) s += `l ${e[0] + 1} ${e[1] + 1}\n`;
    return s;
  }

  function objForDynkin(name) {
    const diagram = DATA.dynkin?.[name];
    if (!diagram?.nodes) return null;
    const num = value => Number(value).toFixed(6);
    let text = `# E8 Studio — ${name} Dynkin diagram\n`;
    text += '# Diagram nodes lie in the z=0 plane; OBJ lines encode bonds.\n';
    text += `o dynkin_${name}\n`;
    for (const node of diagram.nodes) text += `v ${num(node[0])} ${num(-node[1])} 0.000000\n`;
    for (const edge of diagram.edges || []) text += `l ${edge[0] + 1} ${edge[1] + 1}\n`;
    return text;
  }

  function objForCurrentView() {
    if (!viewSupportsExport(params.view, 'obj')) return null;
    if (params.view === 'platonic') return objForShape(params.shape);
    if (params.view === 'dynkin') return objForDynkin(params.dynkin);
    return null;
  }

  // A clean, documented geometry record for the CURRENT view — portable to any
  // language (Python, Processing, three.js, …). Keeps the canonical coordinates
  // (8-D for E8, 4-D for polytopes, 3-D for solids) rather than the screen
  // projection, so downstream tools can project/render however they like.
  function geometryForView() {
    const meta = { source: 'E8 <-> Platonics Studio', view: params.view };
    const v = params.view;
    if (v === 'polytope') {
      const p = DATA.polytopes4d?.[params.poly4d];
      return p && { ...meta, kind: '4d-polytope', name: params.poly4d, dimension: 4, verts: p.verts, edges: p.edges };
    }
    if (v === 'sixhundred') {
      const p = DATA.polytopes4d?.['600cell'];
      return p && { ...meta, kind: '4d-polytope', name: '600cell', dimension: 4, verts: p.verts, edges: p.edges, conjugacy_classes: p.conjugacy_classes };
    }
    if (v === 'dynkin') {
      const diagram = DATA.dynkin?.[params.dynkin];
      return diagram && {
        ...meta,
        kind: 'dynkin-diagram',
        name: params.dynkin,
        label: diagram.name || params.dynkin,
        rank: diagram.nodes?.length || 0,
        nodes: diagram.nodes || [],
        edges: diagram.edges || [],
      };
    }
    if (v === 'rootlab') {
      const rootSystem = generateRank2RootSystem(params.rootSystem);
      return {
        ...meta,
        kind: 'rank-2-root-system',
        name: rootSystem.id,
        label: rootSystem.label,
        rank: 2,
        rootCount: rootSystem.rootCount,
        coxeterNumber: rootSystem.coxeterNumber,
        crystallographic: rootSystem.crystallographic,
        simpleRoots: rootSystem.simpleRoots,
        roots: rootSystem.roots.map(root => root.vector),
        cartanMatrix: rootSystem.cartanMatrix,
      };
    }
    if (v === 'tiling') {
      const tiling = generateCoxeterTiling(params.tilingSystem, { density: params.tilingDensity });
      return {
        ...meta,
        kind: 'coxeter-multigrid-tiling',
        name: tiling.id,
        label: tiling.label,
        density: tiling.density,
        periodic: tiling.periodic,
        localSymmetryOrder: tiling.order,
        familyCount: tiling.familyCount,
        directions: tiling.directions,
        offsets: tiling.offsets,
        tiles: tiling.tiles.map(tile => ({
          familyA: tile.familyA,
          familyB: tile.familyB,
          gridIndices: [tile.indexA, tile.indexB],
          angleDegrees: tile.angleDegrees,
          points: tile.points,
        })),
        edges: tiling.edges.map(edge => edge.points),
      };
    }
    if (v === 'quasicrystal') {
      const patch = generateE8Quasicrystal(DATA.e8, {
        maxNormSq: params.quasiReach,
        windowRadius: params.quasiWindow,
        phason: params.quasiPhason,
      });
      return {
        ...meta,
        kind: patch.kind,
        label: patch.label,
        sourceDimension: patch.sourceDimension,
        physicalDimension: patch.physicalDimension,
        internalDimension: patch.internalDimension,
        symmetryOrder: patch.symmetryOrder,
        maxNormSq: patch.maxNormSq,
        windowRadius: patch.windowRadius,
        phason: patch.phason,
        projectionBasis: patch.projectionBasis,
        points: patch.points.map(point => ({
          lattice: point.coords,
          projected: point.projected,
          internalRadius: point.shiftedInternalRadius,
          normSq: point.normSq,
          coset: point.coset,
        })),
        edges: patch.edges,
        diffraction: patch.diffraction.map(peak => ({
          projected: peak.projected,
          intensity: peak.intensity,
          strength: peak.strength,
        })),
      };
    }
    if (v === 'e8coxeter' || v === 'raymarched' || v === 'bloom') {
      const e8 = DATA.e8;
      return e8 && { ...meta, kind: 'e8-root-system', dimension: 8, count: 240,
        roots8d: e8.roots8d, coxeter_projection_2d: e8.proj2d, ring_radii: e8.ring_radii };
    }
    const g = shapeGeometry(params.shape);
    if (!g) return null;
    const m = currentMorph();
    const rec = { ...meta, kind: 'polyhedron', name: params.shape, dimension: 3,
      verts: morphedVerts(g.verts, m), edges: g.edges || [], faces: g.faces || [] };
    if (morphActive(m)) rec.morph = m;
    return rec;
  }

  function svgForCurrentE8() {
    const e8 = DATA.e8;
    if (!e8 || !e8.proj2d) return null;
    const size = 1200;
    const pad = 80;
    const maxR = Math.max(...e8.ring_radii);
    const scale = (size / 2 - pad) / maxR;
    const primarySet = subsetForShape(params.shape);
    const compareSet = subsetForShape(params.compareShape);
    const mode = params.compareMode || 'off';
    const paletteName = params.palette || 'gold';
    const colorBy = params.colorBy || 'shell';
    const ringCount = (e8.ring_radii || []).length;
    const rings = (e8.ring_radii || []).map((r, i) => {
      const rr = r * scale;
      const color = colorAt(paletteName, i / Math.max(1, e8.ring_radii.length - 1));
      return `<circle cx="${size / 2}" cy="${size / 2}" r="${rr.toFixed(2)}" fill="none" stroke="${svgEsc(color)}" stroke-opacity="0.16" stroke-width="1"/>`;
    }).join('\n');
    const petrie = params.showPetrie && DATA.e8_math?.petrie_cycle_30
      ? `<polyline points="${DATA.e8_math.petrie_cycle_30.concat(DATA.e8_math.petrie_cycle_30[0]).map((idx) => {
          const p = e8.proj2d[idx];
          return `${(size / 2 + p.x * scale).toFixed(2)},${(size / 2 - p.y * scale).toFixed(2)}`;
        }).join(' ')}" fill="none" stroke="#aa66ff" stroke-opacity="0.7" stroke-width="3"/>`
      : '';
    const points = e8.proj2d.map((p, i) => {
      const x = size / 2 + p.x * scale;
      const y = size / 2 - p.y * scale;
      // Colour by the same structural invariant the screen uses, so the exported
      // vector matches what the user sees.
      const t = e8ColoringT(colorBy, p, e8.roots8d?.[i] || [], i, e8.proj2d.length, ringCount, maxR);
      const color = colorAt(paletteName, t);
      const weight = compareWeight(primarySet.has(i), compareSet.has(i), mode);
      const radius = weight ? 5.5 + weight * 2.5 : 3.8;
      const stroke = primarySet.has(i) && compareSet.has(i) ? '#ffffff' : primarySet.has(i) ? '#f4d27a' : compareSet.has(i) ? '#6affe8' : 'none';
      const strokeWidth = weight ? 2 : 0;
      const label = `E8 root ${i}; ring ${p.ring}; ${params.shape}${primarySet.has(i) ? ' primary' : ''}; ${params.compareShape}${compareSet.has(i) ? ' compare' : ''}`;
      return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${radius.toFixed(2)}" fill="${svgEsc(color)}" opacity="${weight ? '0.98' : '0.72'}" stroke="${stroke}" stroke-width="${strokeWidth}"><title>${svgEsc(label)}</title></circle>`;
    }).join('\n');
    const comparing = mode !== 'off' && params.compareShape && params.compareShape !== params.shape;
    const title = comparing
      ? `E8 Coxeter diagram - ${params.shape} vs ${params.compareShape} (${mode}); colour by ${colorBy}`
      : `E8 Coxeter diagram - ${params.shape}; colour by ${colorBy}`;
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <title>${svgEsc(title)}</title>
  <rect width="100%" height="100%" fill="#07070c"/>
  <g>${rings}</g>
  ${petrie}
  <g>${points}</g>
  </svg>`;
  }

  function svgForCurrentDynkin() {
    const diagram = DATA.dynkin?.[params.dynkin];
    if (!diagram?.nodes?.length) return null;
    const width = 1200;
    const height = 700;
    const padding = 120;
    const xs = diagram.nodes.map(node => Number(node[0]));
    const ys = diagram.nodes.map(node => Number(node[1]));
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanX = Math.max(1, maxX - minX);
    const spanY = Math.max(1, maxY - minY);
    const scale = Math.min((width - padding * 2) / spanX, (height - padding * 2) / spanY);
    const point = node => ({
      x: width / 2 + (node[0] - (minX + maxX) / 2) * scale,
      y: height / 2 - (node[1] - (minY + maxY) / 2) * scale,
    });
    const edgeMarkup = (diagram.edges || []).map(edge => {
      const a = point(diagram.nodes[edge[0]]);
      const b = point(diagram.nodes[edge[1]]);
      return `<line x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}" stroke="#e7c76b" stroke-width="10" stroke-linecap="round"/>`;
    }).join('\n');
    const nodeMarkup = diagram.nodes.map((node, index) => {
      const p = point(node);
      const fill = colorAt(params.palette || 'gold', index / Math.max(1, diagram.nodes.length - 1));
      return `<g><circle cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="31" fill="${svgEsc(fill)}" stroke="#fff4c2" stroke-width="5"><title>Simple root ${index + 1}</title></circle><text x="${p.x.toFixed(2)}" y="${(p.y + 7).toFixed(2)}" fill="#07070c" font-family="monospace" font-size="22" text-anchor="middle">${index + 1}</text></g>`;
    }).join('\n');
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <title>${svgEsc(params.dynkin)} Dynkin diagram</title>
  <rect width="100%" height="100%" fill="#07070c"/>
  <text x="60" y="70" fill="#ffe082" font-family="monospace" font-size="30">${svgEsc(diagram.name || params.dynkin)} Dynkin diagram</text>
  <g>${edgeMarkup}</g>
  <g>${nodeMarkup}</g>
  </svg>`;
  }

  function svgForCurrentView() {
    if (!viewSupportsExport(params.view, 'svg')) return null;
    if (params.view === 'e8coxeter') return svgForCurrentE8();
    if (params.view === 'dynkin') return svgForCurrentDynkin();
    return null;
  }

  return { objForShape, objForCurrentView, geometryForView, svgForCurrentView, svgForCurrentE8 };
}
