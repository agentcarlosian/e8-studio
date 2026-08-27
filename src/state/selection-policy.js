// Deterministic selection policy.
//
// Primary selections (view, shape, projection, preset) replace the state they
// own.  Optional modifiers may stack while the selection is active, but they
// must not leak into the next selection or reappear when a user returns to a
// view later.

const COMMON_MODIFIER_DEFAULTS = Object.freeze({
  autoRotate: false,
  cameraOrbit: false,
  autoZoom: false,
  autoModel: false,
  cameraMode: 'orbit',
  cameraPath: 'manual',
  cameraSpeed: 1,
  bloomAuto: false,
  polyAutoRotate: false,
  e8AutoRotate: false,
  e8ProjectionAuto: false,
  weylOrbit: false,
  weylOrbitFast: false,
  autoSliders: [],
  fxMode: 'none',
  fxByView: {},
  fxIntensity: 0.5,
  autoFx: false,
  fxShiftInterval: 3.2,
  blendMode: 'spectrum',
  shiftMode: 'static',
  shiftSpeed: 12,
  galleryPreset: '',
  showStarfield: false,
  showVertices: false,
  pointScale: 1,
});

const VIEW_MODIFIER_DEFAULTS = Object.freeze({
  bloom: Object.freeze({
    bloomAmount: 0,
    bloomMandelbox: false,
    bloomMandelboxScale: 2.618,
    bloomMandelboxIters: 6,
    bloomMandelboxMix: 0.65,
    h4TwinReveal: true,
    e8MorphT: 0,
  }),
  platonic: Object.freeze({
    shapeTwist: 0,
    shapeSpike: 0,
    shapeJitter: 0,
    e8MorphT: 0,
  }),
  e8coxeter: Object.freeze({
    e8ViewMode: 'coxeter',
    showRings: true,
    showEdges: false,
    showPetrie: false,
    rootDiffusion: false,
    showWeylMirrors: false,
    e8Twin600: false,
    e8ProjectionAuto: false,
    rootDiffusionSpeed: 1.25,
    rootHaloDepth: 3,
    cartanHighlight: false,
    e8Spin: 0,
    e8Tilt: 0,
    e8Roll: 0,
    e8MorphT: 0,
    colorBy: 'shell',
    rootSubset: 'icosahedron',
    compareMode: 'off',
    compareShape: 'dodecahedron',
    showInspector: false,
    pickedRoot: null,
    pickedRootPrev: null,
    hoveredRoot: null,
    cartanEntry: null,
  }),
  sixhundred: Object.freeze({
    showEdges: false,
    e8MorphT: 0,
  }),
  quasicrystal: Object.freeze({
    quasiMode: 'pattern',
    quasiReach: 8,
    quasiWindow: 1.42,
    quasiPhason: 0,
    quasiRelief: 0.08,
    quasiShowPoints: true,
    quasiPointHalos: true,
    quasiShowLinks: true,
    quasiShowGuide: true,
  }),
  polytope: Object.freeze({
    morph4d: 0,
    polyRotXY: 0,
    polyRotXZ: 0,
    polyRotXW: 0,
    polyRotYZ: 0,
    polyRotYW: 0,
    polyRotZW: 0,
    polyRotationSpeed: 0.18,
  }),
  raymarched: Object.freeze({
    sdfSphereR: 0.08,
    sdfBlend: 0.03,
    sdfBloom: 0.5,
    sdfAniso: 0.6,
    sdfEdges: 0.3,
    e8MorphT: 0,
  }),
  rootlab: Object.freeze({
    rootShowMirrors: true,
    rootShowChambers: true,
    rootShowSimple: true,
    rootShowOrbit: true,
    rootOrbitSpeed: 0.7,
  }),
  tiling: Object.freeze({
    tilingDensity: 5,
    tilingRelief: 0.1,
    tilingShowTiles: true,
    tilingShowEdges: true,
    tilingShowGrid: false,
    tilingShowRoots: false,
    tilingShowVertices: false,
    tilingAnimate: true,
    tilingFlowSpeed: 0.55,
  }),
});

function freshCommonDefaults(params = {}) {
  return {
    ...COMMON_MODIFIER_DEFAULTS,
    showAmbient: !params.reducedMode,
    autoSliders: [],
    fxByView: {},
  };
}

export function createViewModifierReset(view, params = {}) {
  const patch = {
    ...freshCommonDefaults(params),
    ...(VIEW_MODIFIER_DEFAULTS[view] || {}),
  };
  // A tesseract is unreadable when fully collapsed, so its clean state keeps
  // the existing intentional half-open framing.
  if (view === 'polytope' && params.poly4d === 'tesseract') patch.morph4d = 0.65;
  return patch;
}

export function createViewSelectionReset(targetView, params = {}) {
  const patch = freshCommonDefaults(params);
  // Clear every view's hidden modifiers, not only the incoming view. This is
  // what prevents settings from returning when a user switches back later.
  for (const defaults of Object.values(VIEW_MODIFIER_DEFAULTS)) Object.assign(patch, defaults);
  if (targetView === 'polytope' && params.poly4d === 'tesseract') patch.morph4d = 0.65;
  return {
    ...patch,
    cameraDistance: 6,
    cameraRotation: Math.PI / 6,
    cameraPhi: Math.PI / 3,
  };
}

export function activeViewModifiers(params, view = params.view) {
  const labels = [];
  if (params.fxMode && params.fxMode !== 'none') labels.push(`FX: ${params.fxMode}`);
  if (params.shiftMode && params.shiftMode !== 'static') labels.push(`color: ${params.shiftMode}`);
  if (params.autoRotate) labels.push('auto rotate');
  if (params.cameraOrbit || (params.cameraPath && params.cameraPath !== 'manual')) labels.push('camera motion');
  if (params.autoZoom) labels.push('auto zoom');
  if (params.autoModel) labels.push('auto model');
  if (params.autoFx) labels.push('FX shift');
  if ((params.autoSliders || []).length) labels.push('auto sliders');

  if (view === 'bloom') {
    if ((params.bloomAmount || 0) > 0) labels.push('bloom');
    if (params.bloomAuto) labels.push('auto bloom');
    if (params.bloomMandelbox) labels.push('Mandelbox');
  } else if (view === 'platonic') {
    if (params.shapeTwist) labels.push('twist');
    if (params.shapeSpike) labels.push('spike');
    if (params.shapeJitter) labels.push('jitter');
  } else if (view === 'e8coxeter') {
    if (params.e8ViewMode && params.e8ViewMode !== 'coxeter') labels.push(`projection: ${params.e8ViewMode}`);
    if (params.showEdges) labels.push('edges');
    if (params.showPetrie) labels.push('Petrie');
    if (params.rootDiffusion) labels.push('diffusion');
    if (params.showWeylMirrors) labels.push('mirrors');
    if (params.e8Twin600) labels.push('twin 600-cell');
    if (params.e8ProjectionAuto) labels.push('atlas');
    if (params.e8AutoRotate) labels.push('8D auto rotate');
    if (params.compareMode && params.compareMode !== 'off') labels.push('comparison');
    if (params.showInspector) labels.push('inspector');
  } else if (view === 'polytope') {
    if (params.polyAutoRotate) labels.push('4D auto rotate');
    if (['polyRotXY', 'polyRotXZ', 'polyRotXW', 'polyRotYZ', 'polyRotYW', 'polyRotZW'].some(key => params[key])) labels.push('4D rotation');
    const cleanMorph = params.poly4d === 'tesseract' ? 0.65 : 0;
    if (Math.abs((params.morph4d || 0) - cleanMorph) > 1e-6) labels.push('4D morph');
  } else if (view === 'raymarched') {
    if (Math.abs((params.sdfSphereR ?? 0.08) - 0.08) > 1e-6
      || Math.abs((params.sdfBlend ?? 0.03) - 0.03) > 1e-6
      || Math.abs((params.sdfBloom ?? 0.5) - 0.5) > 1e-6
      || Math.abs((params.sdfAniso ?? 0.6) - 0.6) > 1e-6
      || Math.abs((params.sdfEdges ?? 0.3) - 0.3) > 1e-6) labels.push('SDF tuning');
    if (params.e8MorphT) labels.push('extrude');
  } else if (view === 'tiling') {
    if (params.tilingShowGrid) labels.push('multigrid');
    if (params.tilingShowVertices) labels.push('vertices');
    if (params.tilingShowTiles === false) labels.push('tiles hidden');
    if (params.tilingShowEdges === false) labels.push('edges hidden');
    if (params.tilingShowRoots) labels.push('root star');
    if (params.tilingAnimate === false) labels.push('flow paused');
    if (Math.abs((params.tilingRelief ?? 0.1) - 0.1) > 1e-6) labels.push('relief');
    if (Math.round(params.tilingDensity ?? 5) !== 5) labels.push('density');
  }
  return labels;
}
