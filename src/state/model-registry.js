// model-registry.js — shared model metadata and capability contracts.
//
// Desktop and mobile historically duplicated labels and feature assumptions,
// which allowed impossible actions (for example, exporting a Dynkin diagram as
// an icosahedron). Keep product-level facts here so panels, accessibility text,
// exports, Learn routing, and tests can agree on what each view represents.

export const MODEL_VIEW_ORDER = Object.freeze([
  'bloom', 'platonic', 'e8coxeter', 'quasicrystal', 'polytope', 'raymarched', 'rootlab', 'tiling', 'dynkin',
]);

export const MODEL_REGISTRY = Object.freeze({
  bloom: Object.freeze({
    label: 'E8 Bloom',
    shortLabel: 'Bloom',
    exports: Object.freeze(['png', 'data']),
    controls: Object.freeze({ shape: true, rotate: true, lighting: false, bloom: true, e8: false, poly: false, sdf: false, extrude: true, math: false }),
  }),
  platonic: Object.freeze({
    label: 'Platonic Solid',
    shortLabel: 'Platonic',
    exports: Object.freeze(['png', 'obj', 'data']),
    controls: Object.freeze({ shape: true, rotate: true, lighting: true, bloom: false, e8: false, poly: false, sdf: false, extrude: true, math: 'platonic' }),
  }),
  e8coxeter: Object.freeze({
    label: 'E8 Coxeter Plane',
    shortLabel: 'E8',
    exports: Object.freeze(['png', 'svg', 'data']),
    controls: Object.freeze({ shape: true, rotate: true, lighting: false, bloom: false, e8: true, poly: false, sdf: false, extrude: true, math: 'e8', coloring: true }),
  }),
  sixhundred: Object.freeze({
    label: '600-cell',
    shortLabel: '600',
    exports: Object.freeze(['png', 'data']),
    controls: Object.freeze({ shape: true, rotate: true, lighting: true, bloom: false, e8: false, poly: false, sdf: false, extrude: true, math: '600' }),
  }),
  quasicrystal: Object.freeze({
    label: 'E8 Quasicrystal Lab',
    shortLabel: 'Quasi',
    exports: Object.freeze(['png', 'data']),
    controls: Object.freeze({ shape: false, rotate: true, lighting: false, bloom: false, e8: false, poly: false, sdf: false, extrude: false, math: 'quasicrystal' }),
  }),
  polytope: Object.freeze({
    label: '4D Polytope',
    shortLabel: '4D',
    exports: Object.freeze(['png', 'data']),
    controls: Object.freeze({ shape: false, rotate: true, lighting: true, bloom: false, e8: false, poly: true, sdf: false, extrude: true, math: false }),
  }),
  raymarched: Object.freeze({
    label: 'E8 SDF',
    shortLabel: 'SDF',
    exports: Object.freeze(['png', 'data']),
    controls: Object.freeze({ shape: false, rotate: true, lighting: false, bloom: false, e8: false, poly: false, sdf: true, extrude: true, math: false }),
  }),
  rootlab: Object.freeze({
    label: 'Root System Lab',
    shortLabel: 'Root Lab',
    exports: Object.freeze(['png', 'data']),
    controls: Object.freeze({ shape: false, rotate: true, lighting: false, bloom: false, e8: false, poly: false, sdf: false, extrude: false, math: 'rootlab' }),
  }),
  tiling: Object.freeze({
    label: 'Coxeter Tiling Lab',
    shortLabel: 'Tilings',
    exports: Object.freeze(['png', 'data']),
    controls: Object.freeze({ shape: false, rotate: true, lighting: false, bloom: false, e8: false, poly: false, sdf: false, extrude: false, math: 'tiling' }),
  }),
  dynkin: Object.freeze({
    label: 'Dynkin Diagram',
    shortLabel: 'Dynkin',
    exports: Object.freeze(['png', 'svg', 'obj', 'data']),
    controls: Object.freeze({ shape: false, rotate: true, lighting: false, bloom: false, e8: false, poly: false, sdf: false, extrude: false, math: 'dynkin' }),
  }),
});

const SHAPE_LABELS = Object.freeze({
  tetrahedron: 'Tetrahedron',
  cube: 'Cube',
  octahedron: 'Octahedron',
  dodecahedron: 'Dodecahedron',
  icosahedron: 'Icosahedron',
  stellated_dodecahedron: 'Small Stellated Dodecahedron',
  great_dodecahedron: 'Great Dodecahedron',
  great_icosahedron: 'Great Icosahedron',
  great_stellated_dodecahedron: 'Great Stellated Dodecahedron',
});

const POLYTOPE_LABELS = Object.freeze({
  '5cell': '5-cell',
  tesseract: 'Tesseract',
  '16cell': '16-cell',
  '24cell': '24-cell',
  '120cell': '120-cell',
  '600cell': '600-cell',
});

const TILING_LABELS = Object.freeze({
  A2: 'Hexagonal lozenge lattice (A2)',
  B2: 'Octagonal multigrid (B2)',
  G2: 'Dodecagonal multigrid (G2)',
  H2: 'Penrose pentagrid (H2)',
});

export function modelRecord(view) {
  return MODEL_REGISTRY[view] || MODEL_REGISTRY.e8coxeter;
}

export function viewCapabilities(view) {
  return modelRecord(view).controls;
}

export function exportFormatsForView(view) {
  return modelRecord(view).exports;
}

export function viewSupportsExport(view, format) {
  return exportFormatsForView(view).includes(format);
}

export function modelDisplayName(view, params = {}) {
  if (view === 'platonic') return SHAPE_LABELS[params.shape] || modelRecord(view).label;
  if (view === 'polytope') return POLYTOPE_LABELS[params.poly4d] || modelRecord(view).label;
  if (view === 'dynkin') return `${params.dynkin || 'E8'} Dynkin Diagram`;
  if (view === 'rootlab') return `${params.rootSystem || 'A2'} Root System`;
  if (view === 'tiling') return TILING_LABELS[params.tilingSystem] || TILING_LABELS.H2;
  if (view === 'quasicrystal') return 'E8 Quasicrystal Lab';
  return modelRecord(view).label;
}

export function modelCanvasLabel(view, params = {}) {
  const subject = modelDisplayName(view, params);
  const detail = view === 'e8coxeter'
    ? 'showing 240 roots on eight Coxeter-plane rings'
    : view === 'bloom'
      ? 'showing a three-dimensional presentation of the 240 E8 roots'
      : view === 'raymarched'
        ? 'rendered as a raymarched distance field'
        : view === 'sixhundred'
          ? 'showing its projected four-dimensional vertices and edges'
          : view === 'polytope'
            ? 'shown as a three-dimensional projection of four-dimensional geometry'
            : view === 'dynkin'
              ? 'showing simple-root nodes and their connections'
              : view === 'rootlab'
                ? 'showing generated roots, reflection mirrors, reflection chambers, and a Coxeter orbit'
              : view === 'tiling'
                ? 'showing a dual multigrid of rhombus tiles generated from rank-2 root directions'
              : view === 'quasicrystal'
                ? 'showing an E8 lattice cut through a movable window in six hidden dimensions'
              : 'showing faces, edges, and optional vertex nodes';
  return `Interactive ${subject} visualization, ${detail}. Drag to rotate and scroll to zoom.`;
}
