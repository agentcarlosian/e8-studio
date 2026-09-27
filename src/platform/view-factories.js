import { createE8CoxeterView } from '../views/e8coxeter.view.js';

// The default view is available at first render. Other renderers load only
// when selected. The standalone builder resolves these loaders to its already
// inlined modules, keeping file:// artifacts self-contained.
export const VIEW_DEFINITIONS = Object.freeze([
  { id: 'bloom', label: 'Bloom', name: 'bloom', load: () => import('../views/bloom.view.js').then(m => m.createBloomView), primary: true },
  { id: 'platonic', label: 'Platonic', name: 'platonic', load: () => import('../views/platonic.view.js').then(m => m.createPlatonicView), primary: true },
  { id: 'e8coxeter', label: 'E₈ Coxeter', name: 'e8coxeter', factory: createE8CoxeterView, primary: true },
  { id: 'quasicrystal', label: 'Quasicrystal', name: 'quasicrystal', load: () => import('../views/quasicrystal.view.js').then(m => m.createQuasicrystalView), primary: true },
  { id: 'polytope', label: '4D Polytope', name: 'polytope4d', load: () => import('../views/polytope4d.view.js').then(m => m.createPolytope4DView), primary: true },
  { id: 'raymarched', label: 'E₈ SDF', name: 'raymarchedE8', load: () => import('../views/raymarched-e8.view.js').then(m => m.createRaymarchedView), primary: true },
  { id: 'rootlab', label: 'Root Lab', name: 'rootlab', load: () => import('../views/rootlab.view.js').then(m => m.createRootLabView), primary: false },
  { id: 'tiling', label: 'Tiling Lab', name: 'tiling', load: () => import('../views/tiling.view.js').then(m => m.createTilingView), primary: false },
  { id: 'dynkin', label: 'Dynkin', name: 'dynkin', load: () => import('../views/dynkin.view.js').then(m => m.createDynkinView), primary: false },
]);
