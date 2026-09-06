import { BACKGROUND_PRESETS, normalizeBackgroundMode } from '../ui/backgrounds.js';
/**
 * Mobile scene configuration contract. Keep defaults, supported values, legacy
 * migrations and numeric limits together, independent of DOM or storage effects.
 * Curriculum identifiers arrive after data loading and are supplied by the shell.
 */
import { RANK2_ROOT_SYSTEMS } from '../math/rank2-roots.js';
import { COXETER_TILINGS } from '../math/coxeter-tilings.js';
import { QUASICRYSTAL_REACHES } from '../math/e8-quasicrystal.js';

const MOBILE_CONFIG_REVISION = 1;

const DEFAULT_STATE = {
  configRevision: MOBILE_CONFIG_REVISION,
  view: 'e8coxeter',
  modelMode: 'e8_2d',
  shape: 'icosahedron',
  polytope4d: '24cell',
  dynkinDiagram: 'E8',
  rootSystem: 'A2',
  tilingSystem: 'H2',
  tilingDensity: 5,
  tilingRelief: 0.08,
  tilingShowTiles: true,
  tilingShowEdges: true,
  tilingShowGrid: false,
  tilingShowRoots: false,
  tilingShowVertices: false,
  tilingAnimate: true,
  tilingFlowSpeed: 0.55,
  quasiMode: 'pattern',
  quasiReach: 8,
  quasiWindow: 1.42,
  quasiPhason: 0,
  quasiRelief: 0.08,
  quasiReachAuto: false,
  quasiWindowAuto: false,
  quasiPhasonAuto: false,
  quasiReliefAuto: false,
  quasiShowPoints: true,
  quasiPointHalos: true,
  quasiShowLinks: true,
  quasiShowGuide: true,
  learnTopic: 'auto',
  palette: 'gold',
  background: 'void',
  backgroundBrightness: 0.7,
  quality: 'smooth',
  showRings: true,
  showContext: true,
  showPetrie: false,
  showMirrors: false,
  showEdges: true,
  showVertices: false,
  showRootMirrors: true,
  showRootChambers: true,
  showRootSimple: true,
  showRootOrbit: true,
  highlightSubset: true,
  subset: 'icosahedron',
  pointScale: 1.0,
  pointOpacity: 0.72,
  bloomAmount: 0,
  bloomAuto: false,
  bloomSpeed: 0.08,
  bloomTwinH4: true,
  autoRotate: false,
  autoZoom: false,
  autoExtrude: false,
  autoModel: false,
  autoColor: false,
  autoFx: false,
  colorSpeed: 0.72,
  softFx: false,
  fxMode: 'none',
  fxStrength: 1,
  rotationSpeed: 0.7,
  rotation: 0,
  cameraTilt: 0.28,
  cameraPath: 'manual',
  e8MorphT: 0,
  sdfSphereR: 0.08,
  sdfBlend: 0.03,
  sdfBloom: 0.5,
  sdfAniso: 0.6,
  panX: 0,
  panY: 0,
  zoom: 1,
  selectedRoot: null,
};

const QUALITY = {
  smooth: { label: 'Low', scale: 0.75 },
  balanced: { label: 'Balanced', scale: 1.0 },
  sharp: { label: 'High', scale: () => Math.min(window.devicePixelRatio || 1, 1.5) },
};

// Most models use a restrained cinematic band. E8 Coxeter deliberately uses
// its complete inspection range so Auto-zoom can travel all the way to 2500%.
const AUTO_ZOOM_MIN = 0.7;
const AUTO_ZOOM_MAX = 1.65;
const MANUAL_ZOOM_MIN = 0.55;
const STANDARD_ZOOM_MAX = 3.2;
const E8_COXETER_ZOOM_MAX = 25;

const MOBILE_FX_MODES = [
  { id: 'none', label: 'Off', cost: 'low', description: 'Use clean, unmodified shading.' },
  { id: 'glow', label: 'Glow', cost: 'low', description: 'Add a luminous rim and brighter highlights.' },
  { id: 'pulse', label: 'Pulse', cost: 'low', description: 'Breathe the form gently over time.' },
  { id: 'trail', label: 'Trail', cost: 'medium', description: 'Echo color behind moving geometry.' },
  { id: 'chromatic', label: 'Chrom', name: 'Chromatic', cost: 'low', description: 'Separate color channels across the form.' },
  { id: 'kaleidoscope', label: 'Kaleid', name: 'Kaleidoscope', cost: 'medium', description: 'Mirror light into a kaleidoscopic pattern.' },
  { id: 'ripple', label: 'Ripple', cost: 'low', description: 'Pulse vertices and structural edges in radial waves.' },
  { id: 'spiral', label: 'Spiral', cost: 'low', description: 'Twist light around the view axis.' },
  { id: 'fog', label: 'Fog', cost: 'low', description: 'Fade the structure into atmospheric depth.' },
  { id: 'heat', label: 'Heat', cost: 'low', description: 'Map warm energy bands across the form.' },
  { id: 'edge-glow', label: 'Edge', name: 'Edge glow', cost: 'low', description: 'Emphasize silhouettes and structural edges.' },
  { id: 'aura', label: 'Aura', cost: 'low', description: 'Add a soft animated field around the form.' },
  { id: 'voronoi', label: 'Voronoi', cost: 'high', description: 'Cut a procedural cellular pattern into the view.' },
  { id: 'caustic', label: 'Caustic', cost: 'medium', description: 'Add moving refractive light bands.' },
  { id: 'iridescent', label: 'Irides', name: 'Iridescent', cost: 'low', description: 'Shift color like thin-film light.' },
  { id: 'flowfield', label: 'Flow', name: 'Flow field', cost: 'medium', description: 'Move an animated current across the geometry.' },
  { id: 'plasma', label: 'Plasma', cost: 'medium', description: 'Add animated plasma color bands.' },
  { id: 'kaleido6', label: 'K6', name: 'Kaleido 6', cost: 'medium', description: 'Apply six-fold procedural symmetry.' },
  { id: 'dof', label: 'DOF', name: 'Depth of field', cost: 'medium', description: 'Focus the center while softening depth.' },
  { id: 'nebula', label: 'Nebula', cost: 'medium', description: 'Suspend the form in a drifting cloudy field.' },
  { id: 'wireframe', label: 'Wire', name: 'Wireframe', cost: 'low', description: 'Reduce shading to a technical wire look.' },
  { id: 'hologram', label: 'Holo', name: 'Hologram', cost: 'low', description: 'Add cyan scanlines and digital flicker.' },
  { id: 'xray', label: 'X-ray', cost: 'low', description: 'Reveal cool rims and dark interiors.' },
  { id: 'crystal', label: 'Crystal', cost: 'low', description: 'Add sharp faceted prismatic highlights.' },
];
const SUPPORTED_MOBILE_FX = new Set(MOBILE_FX_MODES.map(mode => mode.id));

const PALETTES = {
  gold: ['#fff2b2', '#f4d27a', '#f0a04b', '#9b4f18'],
  ember: ['#ffd08a', '#ff9550', '#e44b24', '#7f1818'],
  ice: ['#ffffff', '#d6e8ff', '#7fb8ff', '#6076d9'],
  cyan: ['#6affe8', '#3ca7ff', '#ecfffb'],
  ocean: ['#5ec9ff', '#9b4dff'],
  forest: ['#7df9c8', '#00d68f'],
  sunset: ['#ff6b9d', '#ff9550'],
  cosmic: ['#4dffff', '#9b4dff'],
  lavender: ['#c8a2ff', '#ff6b9d'],
  amber: ['#ffb000', '#ff5500'],
  jade: ['#00d68f', '#1e90ff'],
  rainbow: ['#ff3300', '#ffcc00', '#00d68f', '#4dffff', '#9b4dff'],
  fire: ['#ff0066', '#ff3300', '#ffb000'],
  ocean_deep: ['#001f3f', '#0074d9', '#7fdbff'],
  neon: ['#ff00d4', '#00ffea', '#c8ff00'],
  prism: ['#ff0040', '#ffaa00', '#40ff00', '#00aaff', '#aa00ff'],
  aurora: ['#00d68f', '#4dffff', '#c8a2ff', '#ff6b9d'],
  plum: ['#9b4dff', '#ff00d4', '#ff6b9d', '#ff9550'],
  bronze: ['#ffb000', '#ff5500', '#cc3a1a', '#660033'],
  sakura: ['#ffb3d1', '#c8a2ff', '#7fb8ff', '#7fffaf'],
  mono: ['#f0f0f0', '#808080', '#1a1a1a'],
  void: ['#ffffff', '#aaaaaa', '#444444'],
  golden: ['#ffd700', '#ffb000', '#ff7700', '#cc4400'],
  prime: ['#ff0066', '#00ddaa', '#4488ff', '#aa44ff'],
  binary: ['#ffffff', '#000000'],
  terra: ['#8b4513', '#cd853f', '#daa520', '#556b2f'],
  abyss: ['#0fffc0', '#1a8aaa', '#0a3d62', '#4ecdc4'],
  coral: ['#ff6b6b', '#ff9ff3', '#feca57', '#48dbfb'],
  magma: ['#fff200', '#ff8c00', '#ff3300', '#7a0010'],
  obsidian: ['#9b59b6', '#34495e', '#2c3e50', '#000000'],
  cotton: ['#ffb3d9', '#b3d9ff', '#d9ffb3', '#ffffb3'],
  spectral: ['#e1bee7', '#b2dfdb', '#fff9c4', '#ffccbc'],
  synthwave: ['#ff006e', '#fb5607', '#ffbe0b', '#8338ec'],
  cyberpunk: ['#00f5ff', '#ff00ff', '#fffc00', '#ff0080'],
  ultraviolet: ['#1b103f', '#643cff', '#d83cff', '#ff6b9d', '#ffb45e'],
  biolume: ['#062f38', '#00a896', '#00ffd5', '#b8ff70', '#eaffc7'],
  opal: ['#e8ffff', '#9de7ee', '#c5b8ff', '#ffbad2', '#ffd6a0'],
  solar_flare: ['#fffbd1', '#ffe66d', '#ff9f1c', '#ff3d00', '#7a0019'],
  rose_gold: ['#fff0ea', '#f3b6ad', '#c77b6b', '#8e4560', '#3e1738'],
  electric: ['#071a52', '#0066ff', '#00d9ff', '#e8ffff', '#8c7bff'],
  viridian: ['#052e2b', '#087f5b', '#20c997', '#a9e34b', '#ffe066'],
  midnight: ['#050816', '#152b65', '#3f60d9', '#9a7cff', '#ff82bd'],
  petrie: ['#0000ff', '#00ff00', '#ff0000', '#7f7f7f'],
  thread: ['#e0e0f0', '#d0e0e0', '#e0d0d0', '#d0d0e0'],
  vintage: ['#b09090', '#a09090', '#c0a0a0', '#a0a0a0'],
};

const BACKGROUND_BASE_COLORS = {
  void: '#07070c', starfield: '#020817', tide: '#020b14', aurora: '#090b0e',
  cosmos: '#010103', mandala: '#020405', plasma: '#08050e', vortex: '#05030d',
  quantum: '#020b10', eclipse: '#090506', ember: '#0b0304', prism: '#050712',
};
const BACKGROUNDS = Object.fromEntries(Object.entries(BACKGROUND_PRESETS).map(([id, preset]) => [id, {
  label: preset.label, color: BACKGROUND_BASE_COLORS[id], renderer: id === 'void' ? 'flat' : id === 'starfield' ? 'stars' : id,
}]));


const SUPPORTED_SUBSETS = new Set(['icosahedron', 'dodecahedron', 'simple_roots']);
const SUPPORTED_MODEL_MODES = new Set(['bloom', 'e8_2d', 'sdf', 'platonic', 'poly4d', 'rootlab', 'tiling', 'quasicrystal', 'dynkin']);

const LEGACY_MODEL_MODE_MAP = Object.freeze({ e8_3d: 'bloom' });
const STAR_SHAPES = new Set([
  'stellated_dodecahedron',
  'great_dodecahedron',
  'great_icosahedron',
  'great_stellated_dodecahedron',
]);
const SUPPORTED_SHAPES = new Set([
  'tetrahedron',
  'cube',
  'octahedron',
  'dodecahedron',
  'icosahedron',
  ...STAR_SHAPES,
]);
const SUPPORTED_POLYTOPES4D = new Set(['5cell', 'tesseract', '16cell', '24cell', '600cell', '120cell']);
const SUPPORTED_DYNKIN_DIAGRAMS = new Set(['E6', 'E7', 'E8']);

/** Normalize an owned state draft in place; the shell controls when it is saved. */
function normalizeMobileState(next, { learnTopicIds = null } = {}) {
  next.configRevision = MOBILE_CONFIG_REVISION;
  if (LEGACY_MODEL_MODE_MAP[next.modelMode]) next.modelMode = LEGACY_MODEL_MODE_MAP[next.modelMode];
  next.background = normalizeBackgroundMode(next.background);
  if (!PALETTES[next.palette]) next.palette = DEFAULT_STATE.palette;
  if (!BACKGROUNDS[next.background]) next.background = DEFAULT_STATE.background;
  if (!QUALITY[next.quality]) next.quality = DEFAULT_STATE.quality;
  if (!SUPPORTED_MODEL_MODES.has(next.modelMode)) next.modelMode = DEFAULT_STATE.modelMode;
  if (!SUPPORTED_SHAPES.has(next.shape)) next.shape = DEFAULT_STATE.shape;
  if (!SUPPORTED_POLYTOPES4D.has(next.polytope4d)) next.polytope4d = DEFAULT_STATE.polytope4d;
  if (!SUPPORTED_DYNKIN_DIAGRAMS.has(next.dynkinDiagram)) next.dynkinDiagram = DEFAULT_STATE.dynkinDiagram;
  if (!RANK2_ROOT_SYSTEMS[next.rootSystem]) next.rootSystem = DEFAULT_STATE.rootSystem;
  if (!COXETER_TILINGS[next.tilingSystem]) next.tilingSystem = DEFAULT_STATE.tilingSystem;
  if (!['pattern', 'window', 'diffraction'].includes(next.quasiMode)) next.quasiMode = DEFAULT_STATE.quasiMode;
  if (!QUASICRYSTAL_REACHES.includes(Number(next.quasiReach))) next.quasiReach = DEFAULT_STATE.quasiReach;
  if (learnTopicIds?.size > 1 && !learnTopicIds.has(next.learnTopic)) next.learnTopic = DEFAULT_STATE.learnTopic;
  if (!SUPPORTED_SUBSETS.has(next.subset)) next.subset = DEFAULT_STATE.subset;
  next.pointScale = clamp(Number(next.pointScale) || 1, 0.7, 1.8);
  next.pointOpacity = clamp(Number(next.pointOpacity) || DEFAULT_STATE.pointOpacity, 0.3, 1);
  next.backgroundBrightness = clamp(Number(next.backgroundBrightness) || DEFAULT_STATE.backgroundBrightness, 0.3, 1.2);
  next.colorSpeed = clamp(Number(next.colorSpeed) || DEFAULT_STATE.colorSpeed, 0.25, 1.5);
  next.fxStrength = clamp(Number(next.fxStrength) || DEFAULT_STATE.fxStrength, 0.25, 1.5);
  next.bloomAmount = clamp(Number(next.bloomAmount) || 0, 0, 1);
  next.bloomSpeed = clamp(Number(next.bloomSpeed) || DEFAULT_STATE.bloomSpeed, 0.02, 0.25);
  next.rotationSpeed = clamp(Number(next.rotationSpeed) || 0.7, 0.2, 2);
  next.rotation = Number(next.rotation) || 0;
  const cameraTilt = Number(next.cameraTilt);
  next.cameraTilt = clamp(Number.isFinite(cameraTilt) ? cameraTilt : DEFAULT_STATE.cameraTilt, -Math.PI / 3, Math.PI / 3);
  if (!['manual', 'orbit', 'dive', 'spiral'].includes(next.cameraPath)) next.cameraPath = DEFAULT_STATE.cameraPath;
  next.e8MorphT = clamp(Number(next.e8MorphT) || 0, 0, 1);
  const sdfSphereR = Number(next.sdfSphereR);
  const sdfBlend = Number(next.sdfBlend);
  const sdfBloom = Number(next.sdfBloom);
  const sdfAniso = Number(next.sdfAniso);
  next.sdfSphereR = clamp(Number.isFinite(sdfSphereR) ? sdfSphereR : DEFAULT_STATE.sdfSphereR, 0.04, 0.13);
  next.sdfBlend = clamp(Number.isFinite(sdfBlend) ? sdfBlend : DEFAULT_STATE.sdfBlend, 0, 0.1);
  next.sdfBloom = clamp(Number.isFinite(sdfBloom) ? sdfBloom : DEFAULT_STATE.sdfBloom, 0, 1);
  next.sdfAniso = clamp(Number.isFinite(sdfAniso) ? sdfAniso : DEFAULT_STATE.sdfAniso, 0, 1);
  next.tilingDensity = Math.round(clamp(Number(next.tilingDensity) || DEFAULT_STATE.tilingDensity, 2, 6));
  next.tilingRelief = clamp(Number(next.tilingRelief) || 0, 0, 0.3);
  next.tilingFlowSpeed = clamp(Number(next.tilingFlowSpeed) || DEFAULT_STATE.tilingFlowSpeed, 0.1, 2);
  next.quasiReach = Number(next.quasiReach);
  next.quasiWindow = clamp(Number(next.quasiWindow) || DEFAULT_STATE.quasiWindow, 0.8, 2.4);
  next.quasiPhason = clamp(Number(next.quasiPhason) || 0, -1.2, 1.2);
  next.quasiRelief = clamp(Number(next.quasiRelief) || 0, 0, 0.24);
  next.panX = Number(next.panX) || 0;
  next.panY = Number(next.panY) || 0;
  next.zoom = clamp(Number(next.zoom) || 1, MANUAL_ZOOM_MIN, zoomMaxForModel(next.modelMode));
  if (next.selectedRoot != null) {
    const selected = Number(next.selectedRoot);
    next.selectedRoot = Number.isInteger(selected) && selected >= 0 && selected < 240 ? selected : null;
  }
  if (typeof next.showRings !== 'boolean') next.showRings = true;
  if (typeof next.showContext !== 'boolean') next.showContext = true;
  if (typeof next.showPetrie !== 'boolean') next.showPetrie = false;
  if (typeof next.showMirrors !== 'boolean') next.showMirrors = false;
  if (typeof next.showEdges !== 'boolean') next.showEdges = DEFAULT_STATE.showEdges;
  if (typeof next.showVertices !== 'boolean') next.showVertices = false;
  if (typeof next.showRootMirrors !== 'boolean') next.showRootMirrors = DEFAULT_STATE.showRootMirrors;
  if (typeof next.showRootChambers !== 'boolean') next.showRootChambers = DEFAULT_STATE.showRootChambers;
  if (typeof next.showRootSimple !== 'boolean') next.showRootSimple = DEFAULT_STATE.showRootSimple;
  if (typeof next.showRootOrbit !== 'boolean') next.showRootOrbit = DEFAULT_STATE.showRootOrbit;
  if (typeof next.tilingShowTiles !== 'boolean') next.tilingShowTiles = DEFAULT_STATE.tilingShowTiles;
  if (typeof next.tilingShowEdges !== 'boolean') next.tilingShowEdges = DEFAULT_STATE.tilingShowEdges;
  if (typeof next.tilingShowGrid !== 'boolean') next.tilingShowGrid = DEFAULT_STATE.tilingShowGrid;
  if (typeof next.tilingShowRoots !== 'boolean') next.tilingShowRoots = DEFAULT_STATE.tilingShowRoots;
  if (typeof next.tilingShowVertices !== 'boolean') next.tilingShowVertices = DEFAULT_STATE.tilingShowVertices;
  if (typeof next.tilingAnimate !== 'boolean') next.tilingAnimate = DEFAULT_STATE.tilingAnimate;
  if (typeof next.quasiShowPoints !== 'boolean') next.quasiShowPoints = DEFAULT_STATE.quasiShowPoints;
  if (typeof next.quasiPointHalos !== 'boolean') next.quasiPointHalos = DEFAULT_STATE.quasiPointHalos;
  if (typeof next.quasiShowLinks !== 'boolean') next.quasiShowLinks = DEFAULT_STATE.quasiShowLinks;
  if (typeof next.quasiShowGuide !== 'boolean') next.quasiShowGuide = DEFAULT_STATE.quasiShowGuide;
  if (typeof next.quasiReachAuto !== 'boolean') next.quasiReachAuto = false;
  if (typeof next.quasiWindowAuto !== 'boolean') next.quasiWindowAuto = false;
  if (typeof next.quasiPhasonAuto !== 'boolean') next.quasiPhasonAuto = false;
  if (typeof next.quasiReliefAuto !== 'boolean') next.quasiReliefAuto = false;
  if (typeof next.highlightSubset !== 'boolean') next.highlightSubset = true;
  if (typeof next.autoRotate !== 'boolean') next.autoRotate = false;
  if (typeof next.autoZoom !== 'boolean') next.autoZoom = false;
  if (typeof next.autoExtrude !== 'boolean') next.autoExtrude = false;
  if (typeof next.bloomAuto !== 'boolean') next.bloomAuto = false;
  if (typeof next.bloomTwinH4 !== 'boolean') next.bloomTwinH4 = true;
  if (typeof next.autoModel !== 'boolean') next.autoModel = false;
  if (typeof next.autoColor !== 'boolean') next.autoColor = false;
  if (typeof next.autoFx !== 'boolean') next.autoFx = false;
  if (typeof next.softFx !== 'boolean') next.softFx = false;
  if (!SUPPORTED_MOBILE_FX.has(next.fxMode)) next.fxMode = DEFAULT_STATE.fxMode;
  if (next.modelMode === 'sdf' || next.modelMode === 'platonic' || next.modelMode === 'poly4d' || next.modelMode === 'rootlab' || next.modelMode === 'tiling' || next.modelMode === 'quasicrystal') next.selectedRoot = null;
  return next;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function zoomMaxForModel(modelMode) {
  return modelMode === 'e8_2d' ? E8_COXETER_ZOOM_MAX : STANDARD_ZOOM_MAX;
}

function autoZoomMinForModel(modelMode) {
  return modelMode === 'e8_2d' ? MANUAL_ZOOM_MIN : AUTO_ZOOM_MIN;
}

function autoZoomMaxForModel(modelMode) {
  return modelMode === 'e8_2d' ? E8_COXETER_ZOOM_MAX : AUTO_ZOOM_MAX;
}

/** Restore a stored scene without mutating the parsed record or the defaults. */
function restoreMobileState(stored, options) {
  if (!stored || typeof stored !== 'object' || Array.isArray(stored)) {
    throw new TypeError('Stored mobile configuration must be an object.');
  }
  const next = { ...DEFAULT_STATE, ...stored, configRevision: MOBILE_CONFIG_REVISION };
  // Revision 1 introduced desktop chord parity. Later user toggles stay intact.
  if ((Number(stored.configRevision) || 0) < MOBILE_CONFIG_REVISION) next.showEdges = true;
  return normalizeMobileState(next, options);
}

export {
  MOBILE_CONFIG_REVISION,
  DEFAULT_STATE,
  QUALITY,
  AUTO_ZOOM_MIN,
  AUTO_ZOOM_MAX,
  MANUAL_ZOOM_MIN,
  STANDARD_ZOOM_MAX,
  E8_COXETER_ZOOM_MAX,
  MOBILE_FX_MODES,
  SUPPORTED_MOBILE_FX,
  PALETTES,
  BACKGROUNDS,
  SUPPORTED_SUBSETS,
  SUPPORTED_MODEL_MODES,
  STAR_SHAPES,
  SUPPORTED_SHAPES,
  SUPPORTED_POLYTOPES4D,
  SUPPORTED_DYNKIN_DIAGRAMS,
  normalizeMobileState,
  clamp,
  zoomMaxForModel,
  autoZoomMinForModel,
  autoZoomMaxForModel,
  restoreMobileState,
};
