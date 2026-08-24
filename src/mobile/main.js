const STORAGE_KEY = 'e8_mobile_v2_config';
const PROGRESS_KEY = 'e8_progress_v1';

const DEFAULT_STATE = {
  view: 'e8coxeter',
  modelMode: 'e8_2d',
  shape: 'icosahedron',
  polytope4d: '24cell',
  dynkinDiagram: 'E8',
  learnTopic: 'auto',
  palette: 'gold',
  background: 'void',
  backgroundBrightness: 0.7,
  quality: 'smooth',
  showRings: true,
  showContext: true,
  showPetrie: false,
  showMirrors: false,
  showEdges: false,
  showVertices: false,
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
  smooth: { label: 'Smooth', scale: 0.75 },
  balanced: { label: 'Balanced', scale: 1.0 },
  sharp: { label: 'Sharp', scale: () => Math.min(window.devicePixelRatio || 1, 1.5) },
};
const MOTION_SPEED_PRESETS = [
  { id: 'slow', label: 'Slow', value: 0.4 },
  { id: 'medium', label: 'Med', name: 'Medium', value: 0.7 },
  { id: 'fast', label: 'Fast', value: 1.2 },
];
// The manual slider keeps its full inspection range. Auto uses a narrower
// cinematic band so 2D views visibly breathe without spending half the cycle
// cropped far beyond a phone screen.
const AUTO_ZOOM_MIN = 0.7;
const AUTO_ZOOM_MAX = 1.65;
const AUTO_MOTION_RATE = 0.72;
const FX_PRESETS = [
  { id: 'clean', label: 'Static', autoColor: false, softFx: false },
  { id: 'pulse', label: 'Breathe', autoColor: false, softFx: true },
  { id: 'color', label: 'Color Shift', autoColor: true, softFx: false },
  { id: 'live', label: 'Color + Breathe', autoColor: true, softFx: true },
];
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
const MOBILE_FX_MODE_INDEX = Object.freeze(Object.fromEntries(MOBILE_FX_MODES.map((mode, index) => [mode.id, index])));
const ANIMATED_MOBILE_FX = new Set([
  'glow', 'pulse', 'trail', 'chromatic', 'kaleidoscope', 'ripple', 'spiral',
  'aura', 'caustic', 'iridescent', 'flowfield', 'plasma', 'kaleido6',
  'nebula', 'hologram', 'crystal',
]);
const PATTERNED_CANVAS_FX = new Set([
  'kaleidoscope', 'spiral', 'voronoi', 'caustic', 'iridescent',
  'flowfield', 'plasma', 'kaleido6', 'nebula', 'hologram',
]);
const MOTION_PRESETS = [
  { id: 'still', label: 'Still', interaction: 'still' },
  { id: 'orbit', label: 'Orbit', interaction: 'orbit' },
  { id: 'showcase', label: 'Show', name: 'Showcase', interaction: 'showcase' },
];

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
const BACKGROUNDS = {
  void: { label: 'Void', color: '#07070c', renderer: 'flat' },
  starfield: { label: 'Space', color: '#020817', renderer: 'stars' },
  grid: { label: 'Grid', color: '#030b12', renderer: 'grid' },
  aurora: { label: 'Cloud', color: '#030912', renderer: 'aurora' },
  cosmos: { label: 'Cosmos', color: '#050510', renderer: 'cosmos' },
  mandala: { label: 'Mandala', color: '#070510', renderer: 'mandala' },
  plasma: { label: 'Plasma', color: '#08050e', renderer: 'plasma' },
  vortex: { label: 'Vortex', color: '#05030d', renderer: 'vortex' },
  quantum: { label: 'Quantum', color: '#020b10', renderer: 'quantum' },
  eclipse: { label: 'Eclipse', color: '#090506', renderer: 'eclipse' },
  synthwave: { label: 'Barset', color: '#0d0412', renderer: 'synthwave' },
  prism: { label: 'Prism', color: '#050712', renderer: 'prism' },
};
const LEGACY_BACKGROUND_MAP = Object.freeze({ space: 'starfield', cloud: 'aurora' });

function paletteLabel(name) {
  return String(name || '').split('_').map(word => word ? `${word[0].toUpperCase()}${word.slice(1)}` : '').join(' ');
}

const RENDER_PALETTES = Object.fromEntries(
  Object.entries(PALETTES).map(([name, colors]) => {
    const secondary = colors[1] || colors[0];
    const highlight = colors[2] || colors[colors.length - 1] || colors[0];
    const renderColors = colors.length >= 3 ? colors : [colors[0], secondary, highlight];
    return [name, {
      name,
      colors: renderColors,
      ringStroke: colorWithAlpha(secondary, 0.18),
      rayStroke: colorWithAlpha(highlight, 0.22),
      mirrorStroke: colorWithAlpha('#6affe8', 0.34),
      petrieStroke: colorWithAlpha(highlight, 0.56),
      glowPetrie: colorWithAlpha(highlight, 0.12),
      glowSelected: colorWithAlpha(highlight, 0.34),
      glowNeighbor: colorWithAlpha(highlight, 0.2),
      glowAntipode: colorWithAlpha(secondary, 0.18),
      glowSubset: colorWithAlpha(highlight, 0.14),
    }];
  })
);

const SUPPORTED_SUBSETS = new Set(['icosahedron', 'dodecahedron', 'simple_roots']);
const SUPPORTED_MODEL_MODES = new Set(['bloom', 'e8_2d', 'sdf', 'platonic', 'poly4d', 'dynkin']);
const TOUCH_ORBIT_MODEL_MODES = new Set(['bloom', 'sdf', 'platonic', 'poly4d']);
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
const MODEL_LABELS = {
  bloom: 'Bloom',
  e8_2d: 'E8',
  sdf: 'SDF',
  platonic: 'Solid',
  poly4d: '4D',
  dynkin: 'Dynkin',
};
const SHAPE_LABELS = {
  tetrahedron: 'Tetrahedron',
  cube: 'Cube',
  octahedron: 'Octahedron',
  dodecahedron: 'Dodecahedron',
  icosahedron: 'Icosahedron',
  stellated_dodecahedron: 'Small stellated dodecahedron',
  great_dodecahedron: 'Great dodecahedron',
  great_icosahedron: 'Great icosahedron',
  great_stellated_dodecahedron: 'Great stellated dodecahedron',
};
const POLYTOPE4D_LABELS = {
  '5cell': '5-cell',
  tesseract: 'Tesseract',
  '16cell': '16-cell',
  '24cell': '24-cell',
  '600cell': '600-cell',
  '120cell': '120-cell',
};
const DYNKIN_LABELS = {
  E6: 'E6',
  E7: 'E7',
  E8: 'E8',
};
const SUBSET_LABELS = {
  icosahedron: 'icosahedron',
  dodecahedron: 'dodecahedron',
  simple_roots: 'simple roots',
};
const SUBSET_CHIPS = [
  { id: 'icosahedron', label: 'Ico', name: 'Icosahedron' },
  { id: 'dodecahedron', label: 'Dod', name: 'Dodecahedron' },
  { id: 'simple_roots', label: 'Simple', name: 'Simple roots' },
];
const ROOT_JUMPS = [
  { id: 'alpha', label: 'Alpha', name: 'Alpha 1' },
  { id: 'mckay', label: 'McKay', name: 'First subset root' },
  { id: 'near', label: 'Near', name: 'Cartan neighbor', needsSelection: true },
  { id: 'opposite', label: 'Opp', name: 'Opposite root', needsSelection: true },
  { id: 'random', label: 'Rand', name: 'Random root' },
];
const SETTINGS_SECTIONS = new Set(['view', 'style', 'motion', 'quality', 'info']);
const EMPTY_SET = new Set();
const SAVE_DEBOUNCE_MS = 140;
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_PX = 42;
const TAP_JITTER_PX = 3;
const PINCH_JITTER_PX = 3;
const SCENE_CHIP_SWIPE_PX = 28;
const SCENE_CHIP_SWIPE_SLOP_PX = 24;
const SCENE_CHIP_LONG_PRESS_MS = 540;
const STATUS_HIDE_MS = 1400;
const MOTION_FRAME_INTERVAL_MS = 33;
// The complete 56-neighbor E8 graph draws 6,720 chords. Real-device profiling
// showed that the graph—not the individual FX—is the dominant sustained cost.
// Keep every effect available, but pace animated dense-graph frames so the
// main thread retains enough headroom for touch and Android system UI.
const DENSE_E8_MOTION_FRAME_INTERVAL_MS = 50;
const AUTO_MODEL_INTERVAL_S = 3.6;
const MOBILE_TOUR_INTERVAL_MS = 4200;
const TAU = Math.PI * 2;
// The desktop Coxeter overlay's principal line family is the complete
// distance-squared-2 root graph: every root has exactly 56 neighbours.  Keep
// that topology intact on mobile.  Subsampling the pair list by array order
// gave different roots between 4 and 17 lines and produced an asymmetric,
// visibly incorrect web when the user zoomed in.
const MOBILE_E8_CHORD_DISTANCE_SQUARED = 2;
const RIPPLE_COLOR_BANDS = 12;
const RIPPLE_BRIGHTNESS_BANDS = 5;
const DRAW_SUBSET = 1;
const DRAW_SELECTED = 2;
const DRAW_NEIGHBOR = 4;
const DRAW_ANTIPODE = 8;
const DRAW_PETRIE = 16;
const BASE_POINT_BUCKET_COUNT = 5;
const AUTO_MODEL_SEQUENCE = [
  { modelMode: 'e8_2d', shape: 'icosahedron' },
  { modelMode: 'bloom', shape: 'icosahedron' },
  { modelMode: 'sdf', shape: 'icosahedron' },
  { modelMode: 'platonic', shape: 'tetrahedron' },
  { modelMode: 'platonic', shape: 'cube' },
  { modelMode: 'platonic', shape: 'octahedron' },
  { modelMode: 'platonic', shape: 'dodecahedron' },
  { modelMode: 'platonic', shape: 'icosahedron' },
  { modelMode: 'platonic', shape: 'stellated_dodecahedron' },
  { modelMode: 'platonic', shape: 'great_dodecahedron' },
  { modelMode: 'platonic', shape: 'great_icosahedron' },
  { modelMode: 'platonic', shape: 'great_stellated_dodecahedron' },
  { modelMode: 'poly4d', polytope4d: '24cell' },
  { modelMode: 'poly4d', polytope4d: '600cell' },
  { modelMode: 'poly4d', polytope4d: '120cell' },
  { modelMode: 'dynkin', dynkinDiagram: 'E8' },
];
const MOBILE_TOUR_STEPS = [
  {
    id: 'e8-coxeter',
    label: 'E8 roots',
    target: { modelMode: 'e8_2d' },
    title: 'E8 Coxeter plane',
    body: 'The 240 roots land in eight rings of 30. Tap any point when the tour stops to inspect its 8D context.',
    detail: 'This is the fast default phone scene.',
  },
  {
    id: 'designed-bloom',
    label: 'Bloom',
    target: { modelMode: 'bloom' },
    title: 'Designed Bloom',
    body: 'The source solid grows through the 600-cell and twin H4 stages before opening into the Coxeter plane.',
    detail: 'Open View to scrub the Bloom timeline or start Auto.',
  },
  {
    id: 'distance-field',
    label: 'SDF',
    target: { modelMode: 'sdf' },
    title: 'E8 distance field',
    body: 'All 240 Coxeter-plane roots become smoothly joined, shaded spheres in an implicit surface.',
    detail: 'This preserves the desktop SDF composition on a lightweight phone height field.',
  },
  {
    id: 'platonic-bridge',
    label: 'Solids',
    target: { modelMode: 'platonic', shape: 'icosahedron' },
    title: 'Platonic bridge',
    body: 'The regular solids are the symmetry doorway into the McKay correspondence.',
    detail: 'Use View to jump between all five solids.',
  },
  {
    id: 'four-d',
    label: '4D',
    target: { modelMode: 'poly4d', polytope4d: '24cell' },
    title: '4D polytopes',
    body: 'Mobile V2 keeps the 4D models in Canvas 2D with conservative defaults.',
    detail: 'The 24-cell is a useful midpoint before the denser 600-cell.',
  },
  {
    id: 'dynkin-e8',
    label: 'Dynkin',
    target: { modelMode: 'dynkin', dynkinDiagram: 'E8' },
    title: 'Dynkin diagram',
    body: 'Dynkin nodes summarize simple-root relationships through Cartan edges.',
    detail: 'Tap an E8 node to connect the diagram back to a selected root.',
  },
];
const MODEL_SHORTCUT_GROUPS = [
  {
    id: 'views',
    label: 'Views',
    items: [
      { id: 'bloom', label: 'Bloom', name: 'Designed Bloom', target: { modelMode: 'bloom' } },
      { id: 'e8_2d', label: 'E8', name: 'E8 Coxeter', target: { modelMode: 'e8_2d' } },
      { id: 'sdf', label: 'SDF', name: 'E8 distance field', target: { modelMode: 'sdf' } },
    ],
  },
  {
    id: 'solids',
    label: 'Solids',
    items: [
      { id: 'shape-tetrahedron', label: 'Tet', name: 'Tetrahedron', target: { modelMode: 'platonic', shape: 'tetrahedron' } },
      { id: 'shape-cube', label: 'Cube', name: 'Cube', target: { modelMode: 'platonic', shape: 'cube' } },
      { id: 'shape-octahedron', label: 'Oct', name: 'Octahedron', target: { modelMode: 'platonic', shape: 'octahedron' } },
      { id: 'shape-dodecahedron', label: 'Dod', name: 'Dodecahedron', target: { modelMode: 'platonic', shape: 'dodecahedron' } },
      { id: 'shape-icosahedron', label: 'Ico', name: 'Icosahedron', target: { modelMode: 'platonic', shape: 'icosahedron' } },
    ],
  },
  {
    id: 'stars',
    label: 'Star polyhedra',
    items: [
      { id: 'shape-stellated_dodecahedron', label: 'sDod', name: 'Small stellated dodecahedron', target: { modelMode: 'platonic', shape: 'stellated_dodecahedron' } },
      { id: 'shape-great_dodecahedron', label: 'gDod', name: 'Great dodecahedron', target: { modelMode: 'platonic', shape: 'great_dodecahedron' } },
      { id: 'shape-great_icosahedron', label: 'gIco', name: 'Great icosahedron', target: { modelMode: 'platonic', shape: 'great_icosahedron' } },
      { id: 'shape-great_stellated_dodecahedron', label: 'gsDod', name: 'Great stellated dodecahedron', target: { modelMode: 'platonic', shape: 'great_stellated_dodecahedron' } },
    ],
  },
  {
    id: 'poly4d',
    label: '4D',
    items: [
      { id: 'poly-5cell', label: '5', name: '5-cell', target: { modelMode: 'poly4d', polytope4d: '5cell' } },
      { id: 'poly-tesseract', label: 'Tess', name: 'Tesseract', target: { modelMode: 'poly4d', polytope4d: 'tesseract' } },
      { id: 'poly-16cell', label: '16', name: '16-cell', target: { modelMode: 'poly4d', polytope4d: '16cell' } },
      { id: 'poly-24cell', label: '24', name: '24-cell', target: { modelMode: 'poly4d', polytope4d: '24cell' } },
      { id: 'poly-600cell', label: '600', name: '600-cell', target: { modelMode: 'poly4d', polytope4d: '600cell' } },
      { id: 'poly-120cell', label: '120', name: '120-cell', target: { modelMode: 'poly4d', polytope4d: '120cell' } },
    ],
  },
  {
    id: 'dynkin',
    label: 'Dynkin',
    items: [
      { id: 'dynkin-E6', label: 'E6', name: 'E6 Dynkin', target: { modelMode: 'dynkin', dynkinDiagram: 'E6' } },
      { id: 'dynkin-E7', label: 'E7', name: 'E7 Dynkin', target: { modelMode: 'dynkin', dynkinDiagram: 'E7' } },
      { id: 'dynkin-E8', label: 'E8', name: 'E8 Dynkin', target: { modelMode: 'dynkin', dynkinDiagram: 'E8' } },
    ],
  },
];
const MODEL_SHORTCUTS = MODEL_SHORTCUT_GROUPS.flatMap(group => (
  group.items.map(item => ({ ...item, group: group.id, groupLabel: group.label }))
));
const CURIOSITY_FALLBACK = {
  title: 'Context',
  body: 'E8 Studio mobile keeps the explanation close to the active model.',
  detail: 'Change model or select a root to see a more specific note.',
};
let LEARN_TOPICS = [{ id: 'auto', label: 'Auto', name: 'Scene match' }];
let LEARN_TOPIC_IDS = new Set(['auto']);
let LEARN_TOPIC_CYCLE = [];
let curriculumPaths = [];
let curriculumLessons = [];
let learningProgress = loadLearningProgress();
const LEGACY_LEARN_TOPIC_MAP = {
  e8: 'coxeter-plane', solids: 'why-five-solids', mckay: 'mckay-bridge',
  poly4d: 'into-four-dimensions', dynkin: 'roots-reflections',
};

function installMobileCurriculum(curriculum) {
  curriculumPaths = Array.isArray(curriculum?.paths) ? curriculum.paths : [];
  curriculumLessons = Array.isArray(curriculum?.lessons) ? curriculum.lessons : [];
  LEARN_TOPICS = [
    { id: 'auto', label: 'Auto', name: 'Scene match' },
    ...curriculumLessons.map(lesson => ({
      id: lesson.id,
      label: lesson.title.replace(/^The /, '').split(' ').slice(0, 2).join(' '),
      name: lesson.title,
      lesson,
    })),
  ];
  LEARN_TOPIC_IDS = new Set(LEARN_TOPICS.map(topic => topic.id));
  LEARN_TOPIC_CYCLE = LEARN_TOPICS.filter(topic => topic.id !== 'auto');
}
const MOBILE_TOUR_RUNTIME_STATE_KEYS = [
  'modelMode',
  'shape',
  'polytope4d',
  'dynkinDiagram',
  'selectedRoot',
  'bloomAmount',
  'bloomAuto',
  'bloomTwinH4',
  'autoRotate',
  'autoModel',
  'autoColor',
  'softFx',
  'fxMode',
  'showVertices',
];

let metrics = {
  firstRenderMs: null,
  lastRenderMs: null,
  renderCount: 0,
  renderScale: 0,
  canvasResizeCount: 0,
  lastCanvasResizeMs: null,
  lastCanvasResizeScale: null,
  lastCanvasResizeWidth: null,
  lastCanvasResizeHeight: null,
  canvasStyleSyncCount: 0,
  canvasStyleSyncSkipCount: 0,
  lastCanvasStyleSyncMs: null,
  lastCanvasStyleWidth: null,
  lastCanvasStyleHeight: null,
  canvasTransformSetCount: 0,
  canvasTransformSkipCount: 0,
  lastCanvasTransformSetMs: null,
  lastCanvasTransformScale: null,
  settingsCanvasResizeDeferredCount: 0,
  lastSettingsCanvasResizeDeferredMs: null,
  lastSettingsCanvasResizeDeferredScale: null,
  saveCount: 0,
  lastSaveMs: null,
  lastSaveDelayMs: null,
  lastInteractionType: null,
  lastInteractionMs: null,
  statusText: null,
  statusCount: 0,
  lastStatusMs: null,
  lastDrawStats: null,
  lastModelMode: null,
  lastModelLabel: null,
  lastShape: null,
  lastShapeLabel: null,
  lastPolytope4D: null,
  lastPolytope4DLabel: null,
  lastDynkinDiagram: null,
  lastDynkinLabel: null,
  lastDynkinSelectedNode: null,
  lastModelDrawMs: null,
  modelRenderCount: 0,
  modelProjectedVertices: 0,
  modelEdgeStrokes: 0,
  modelFaceFills: 0,
  modelVertexFills: 0,
  e8Projection3DCount: 0,
  bloomDrawCount: 0,
  bloomAutoFrameCount: 0,
  bloomTimelineSyncCount: 0,
  sdfDrawCount: 0,
  platonicDrawCount: 0,
  polytope4DDrawCount: 0,
  dynkinDrawCount: 0,
  dynkinNodeSelectCount: 0,
  lastDynkinNodeSelect: null,
  lastDynkinNodeSelectMs: null,
  mckayInfoSyncCount: 0,
  lastMckaySource: null,
  lastMckayRoots: null,
  lastMckaySymmetry: null,
  lastMckayInfoMs: null,
  curiositySyncCount: 0,
  curiosityNextCount: 0,
  lastCuriosityKey: null,
  lastCuriosityTitle: null,
  lastCuriosityIndex: 0,
  lastCuriosityMs: null,
  learnTopicButtonCount: 0,
  learnTopicSyncCount: 0,
  learnTopicSelectCount: 0,
  learnTopicNextCount: 0,
  learnTopicNoopCount: 0,
  lastLearnTopic: null,
  lastLearnTopicConfigured: null,
  lastLearnTopicTitle: null,
  lastLearnTopicMs: null,
  mobileTourButtonCount: 0,
  mobileTourSyncCount: 0,
  mobileTourStartCount: 0,
  mobileTourStopCount: 0,
  mobileTourStepCount: 0,
  mobileTourNextCount: 0,
  mobileTourPrevCount: 0,
  mobileTourAutoStepCount: 0,
  mobileTourPauseCount: 0,
  mobileTourResumeCount: 0,
  mobileTourStorageGuardCount: 0,
  mobileTourStorageGuardFlushCount: 0,
  mobileTourInactiveStepBlockedCount: 0,
  mobileTourNoopCount: 0,
  lastMobileTourAction: null,
  lastMobileTourPauseReason: null,
  lastMobileTourResumeReason: null,
  lastMobileTourStorageGuardMs: null,
  lastMobileTourStorageGuardKeys: null,
  lastMobileTourStep: 0,
  lastMobileTourStepId: null,
  lastMobileTourLabel: null,
  lastMobileTourTitle: null,
  lastMobileTourMs: null,
  lastMobileTourTarget: null,
  sceneLabelSyncCount: 0,
  lastSceneLabel: null,
  lastCanvasLabel: null,
  lastSceneChipLabel: null,
  lastInfoCopy: null,
  lastSceneLabelMs: null,
  sceneChipStepCount: 0,
  sceneChipSyncSkipCount: 0,
  lastSceneChipStepMs: null,
  lastSceneChipIndex: 0,
  lastSceneChipTarget: null,
  lastSceneChipStoppedAutoModel: false,
  sceneChipSwipeCount: 0,
  sceneChipLongPressCount: 0,
  sceneChipOpenSettingsCount: 0,
  lastSceneChipGesture: null,
  lastSceneChipGestureMs: null,
  lastSceneChipSwipeDirection: null,
  modelShortcutButtonCount: 0,
  modelShortcutSelectCount: 0,
  modelShortcutSyncSkipCount: 0,
  lastModelShortcutId: null,
  lastModelShortcutLabel: null,
  lastModelShortcutGroup: null,
  lastModelShortcutTarget: null,
  lastModelShortcutMs: null,
  paletteSwatchButtonCount: 0,
  paletteSwatchSelectCount: 0,
  paletteSwatchSyncSkipCount: 0,
  lastPaletteSwatch: null,
  lastPaletteSwatchLabel: null,
  lastPaletteSwatchMs: null,
  fxPresetButtonCount: 0,
  fxPresetSelectCount: 0,
  fxPresetSyncSkipCount: 0,
  lastFxPreset: null,
  lastFxPresetLabel: null,
  lastFxPresetMs: null,
  fxModeButtonCount: 0,
  fxModeSelectCount: 0,
  fxModeSyncSkipCount: 0,
  lastFxMode: null,
  lastFxModeLabel: null,
  lastFxModeMs: null,
  motionPresetButtonCount: 0,
  motionPresetSelectCount: 0,
  motionPresetSyncSkipCount: 0,
  lastMotionPreset: null,
  lastMotionPresetLabel: null,
  lastMotionPresetMs: null,
  subsetChipButtonCount: 0,
  subsetChipSelectCount: 0,
  subsetChipSyncSkipCount: 0,
  lastSubsetChip: null,
  lastSubsetChipLabel: null,
  lastSubsetChipMs: null,
  rootJumpButtonCount: 0,
  rootJumpSelectCount: 0,
  rootJumpDisabledCount: 0,
  rootJumpSubsetSwitchCount: 0,
  lastRootJump: null,
  lastRootJumpLabel: null,
  lastRootJumpRoot: null,
  lastRootJumpMs: null,
  motionSpeedPresetButtonCount: 0,
  motionSpeedPresetSelectCount: 0,
  motionSpeedPresetSyncSkipCount: 0,
  lastMotionSpeedPreset: null,
  lastMotionSpeedPresetLabel: null,
  lastMotionSpeedPresetValue: null,
  lastMotionSpeedPresetMs: null,
  settingsOpenRenderCancelCount: 0,
  lastSettingsOpenRenderCancelMs: null,
  lastSettingsOpenRenderCancelReason: null,
  settingsDeferredRenderRequestCount: 0,
  lastSettingsDeferredRenderRequestMs: null,
  lastSettingsDeferredRenderReason: null,
  settingsDeferredRenderFlushCount: 0,
  lastSettingsDeferredRenderFlushMs: null,
  lastSettingsDeferredRenderFlushReason: null,
  renderSuppressedCount: 0,
  lastRenderSuppressedMs: null,
  lastRenderSuppressedReason: null,
  lastRenderAllFrame: null,
  lastRenderFrameSource: null,
  renderFrameReuseCount: 0,
  lastProjectionSource: null,
  lastProjectionCount: 0,
  lastAllFrameWithinView: null,
  viewportChangeCount: 0,
  viewportFitCount: 0,
  lastViewportChangeMs: null,
  lastViewportFitMs: null,
  petrieCycleLength: 0,
  petrieDrawCount: 0,
  lastPetrieDrawMs: null,
  simpleRootCount: 0,
  cartanMatrixSize: 0,
  cartanMatrixNonzeroCount: 0,
  cartanMatrixSelectCount: 0,
  lastCartanMatrixSelectRoot: null,
  lastCartanMatrixSelectOrder: null,
  lastCartanMatrixSelectMs: null,
  cartanMatrixSubsetSwitchCount: 0,
  lastCartanMatrixSubsetSwitchMs: null,
  mirrorDrawCount: 0,
  lastMirrorDrawMs: null,
  settledRenderRequestCount: 0,
  lastSettledRenderRequestMs: null,
  lastSettledRenderRequestReason: null,
  liveControlCount: 0,
  liveControlCommitCount: 0,
  lastLiveControl: null,
  lastLiveControlMs: null,
  lastLiveControlCommit: null,
  lastLiveControlCommitMs: null,
  liveControlLiteRequestCount: 0,
  liveControlLiteRenderCount: 0,
  lastLiveControlLiteRequestMs: null,
  lastLiveControlLiteReason: null,
  lastLiveControlLiteRenderMs: null,
  lastLiveControlLiteDrawStats: null,
  motionFrameTargetMs: MOTION_FRAME_INTERVAL_MS,
  motionFrameRenderCount: 0,
  motionFrameSkipCount: 0,
  autoModelFrameCount: 0,
  autoModelSwitchCount: 0,
  lastAutoModelSwitchMs: null,
  lastAutoModelTarget: null,
  autoColorFrameCount: 0,
  softFxFrameCount: 0,
  autoZoomFrameCount: 0,
  autoExtrudeFrameCount: 0,
  lastStylePhase: 0,
  lastRuntimePalette: null,
  lastMotionFrameRenderMs: null,
  lastMotionFrameSkipMs: null,
  lastMotionFrameDeltaMs: null,
  tapJitterIgnoredCount: 0,
  lastTapJitterIgnoredMs: null,
  lastTapJitterDistance: 0,
  pinchJitterIgnoredCount: 0,
  lastPinchJitterIgnoredMs: null,
  lastPinchJitterDistanceDelta: 0,
  lastPinchJitterCenterDelta: 0,
  selectionAutoPanCount: 0,
  lastSelectionAutoPanMs: null,
  lastSelectionAutoPanDx: 0,
  lastSelectionAutoPanDy: 0,
  selectionUiFullUpdateCount: 0,
  selectionUiLiteUpdateCount: 0,
  selectionUiDeferredDetailCount: 0,
  selectionUiFullDomWriteCount: 0,
  selectionUiFullDomSkipCount: 0,
  lastSelectionUiDomRoot: null,
  lastSelectionUiDomMs: null,
  rootDrawerExpandCount: 0,
  rootDrawerCollapseCount: 0,
  lastRootDrawerToggleMs: null,
  lastRootDrawerToggleReason: null,
  selectionStateNoopSkipCount: 0,
  lastSelectionStateNoopSkip: null,
  lastSelectionStateNoopRoot: null,
  lastSelectionStateNoopSkipMs: null,
  lastSelectionUiMode: null,
  lastSelectionUiReason: null,
  lastSelectionUiMs: null,
  controlSyncCount: 0,
  lastControlSyncMs: null,
  lastControlSyncReason: null,
  settingsTabSyncSkipCount: 0,
  lastSettingsTabSyncSkip: null,
  lastSettingsTabSyncSkipMs: null,
  settingsSectionSwitchCount: 0,
  settingsSectionSwitchSkipCount: 0,
  lastSettingsSectionSwitch: null,
  lastSettingsSectionSwitchMs: null,
  settingsControlSyncSkipCount: 0,
  lastSettingsControlSyncSkip: null,
  lastSettingsControlSyncSkipMs: null,
  settingsStateNoopSkipCount: 0,
  lastSettingsStateNoopSkip: null,
  lastSettingsStateNoopSkipMs: null,
  qualityChipSyncSkipCount: 0,
  lastQualityChipSyncSkipMs: null,
  subsetControlSyncCount: 0,
  lastSubsetControlSyncMs: null,
  snapshotShareCount: 0,
  snapshotShareSuccessCount: 0,
  snapshotShareFallbackCount: 0,
  snapshotShareErrorCount: 0,
  lastSnapshotShareMs: null,
  lastSnapshotShareMode: null,
  lastSnapshotShareName: null,
  lastSnapshotShareBytes: 0,
  lastSnapshotShareWidth: 0,
  lastSnapshotShareHeight: 0,
  lastSnapshotShareError: null,
  postcardShareCount: 0,
  postcardShareSuccessCount: 0,
  postcardShareFallbackCount: 0,
  postcardShareErrorCount: 0,
  lastPostcardShareMs: null,
  lastPostcardShareMode: null,
  lastPostcardShareName: null,
  lastPostcardShareBytes: 0,
  lastPostcardShareWidth: 0,
  lastPostcardShareHeight: 0,
  lastPostcardShareCaption: null,
  lastPostcardShareScene: null,
  lastPostcardShareError: null,
  diagnosticsCopyCount: 0,
  diagnosticsCopySuccessCount: 0,
  diagnosticsCopyFallbackCount: 0,
  diagnosticsCopyErrorCount: 0,
  lastDiagnosticsCopyMs: null,
  lastDiagnosticsCopyMode: null,
  lastDiagnosticsCopyName: null,
  lastDiagnosticsCopyBytes: 0,
  lastDiagnosticsCopyError: null,
  modelDataExportCount: 0,
  modelDataExportSuccessCount: 0,
  modelDataExportFallbackCount: 0,
  modelDataExportErrorCount: 0,
  lastModelDataExportMs: null,
  lastModelDataExportMode: null,
  lastModelDataExportName: null,
  lastModelDataExportBytes: 0,
  lastModelDataExportKind: null,
  lastModelDataExportModel: null,
  lastModelDataExportError: null,
  modelObjExportCount: 0,
  modelObjExportSuccessCount: 0,
  modelObjExportFallbackCount: 0,
  modelObjExportErrorCount: 0,
  lastModelObjExportMs: null,
  lastModelObjExportMode: null,
  lastModelObjExportName: null,
  lastModelObjExportBytes: 0,
  lastModelObjExportKind: null,
  lastModelObjExportModel: null,
  lastModelObjExportVertices: 0,
  lastModelObjExportLines: 0,
  lastModelObjExportFaces: 0,
  lastModelObjExportPoints: 0,
  lastModelObjExportError: null,
  surpriseCount: 0,
  lastSurpriseMs: null,
  lastSurprisePatch: null,
  defaultsResetCount: 0,
  lastDefaultsResetMs: null,
  chromeFadeInCount: 0,
  chromeFadeOutCount: 0,
  lastChromeFadeMs: null,
  lastChromeFadeReason: null,
  stateNoopSkipCount: 0,
  lastStateNoopSkip: null,
  lastStateNoopSkipMs: null,
  liveControlSyncSkipCount: 0,
  lastLiveControlSyncSkip: null,
  lastLiveControlSyncSkipMs: null,
  runtimeErrors: [],
};
let state = loadState();
let data = null;
let points = [];
let allRootList = [];
let ringRadiusFactors = [];
let ringBucketCount = 1;
let basePointBuckets = Array.from({ length: BASE_POINT_BUCKET_COUNT }, () => []);
let directPointQueue = [];
let platonicGeometry = {};
let platonicFaceCache = new Map();
let polytope4DGeometry = {};
let bloomOrder600 = [];
let dynkinGeometry = {};
let dynkinHitTargets = [];
let mckayInfo = {};
let curiosityKey = null;
let curiosityIndex = 0;
let subsetSets = {};
let subsetLists = {};
let petrieCycle = [];
let petrieSet = EMPTY_SET;
let e8ChordEdges = [];
let simpleRootIndices = [];
let simpleRootOrdinalByIndex = new Map();
let cartanMatrix = [];
let selectedContext = null;
let startedAt = performance.now();
let canvas;
let ctx;
let fxSourceCanvas;
let fxSourceContext;
let fxTintCanvas;
let fxTintContext;
let backgroundCanvas;
let backgroundCtx;
let sdfCanvas;
let sdfGl;
let sdfWebglUnavailable = false;
let sdfRingUniformData = new Float32Array(8 * 4);
let sdfPaletteUniformData = new Float32Array(5 * 3);
const sdfPrograms = new Map();
let sdfRasterCanvas;
let sdfRasterContext;
let sdfRasterImageData;
let sdfHeightField;
let sdfCoverageField;
let sdfRingField;
let canvasCssWidth = 0;
let canvasCssHeight = 0;
let canvasTransformScale = null;
let renderRafId = null;
let motionRafId = null;
let mobileTourTimer = null;
let mobileTourActive = false;
let mobileTourIndex = 0;
let mobileTourPausedForSettings = false;
let mobileTourStorageBaseState = null;
let saveTimer = null;
let statusTimer = null;
let resetFeedbackTimer = null;
let savePending = false;
let saveRequestedAt = 0;
let stylePhase = 0;
let motionPhase = 0;
let autoZoomPhaseOffset = 0;
let autoExtrudePhaseOffset = 0;
let autoModelElapsed = 0;
let autoModelIndex = 0;
let drag = null;
let previousSelectedRoot = null;
const activePointers = new Map();
let gestureReleaseIds = new Set();
let gesture = null;
let pendingSettledRenderReason = null;
let liveControlLiteRenderReason = null;
let settingsDeferredRenderReason = null;
let selectionUiDetailsDeferred = false;
let lastSelectionDetailHtml = null;
let settingsCanvasResizeDeferred = false;
let lastTap = null;
let nativeBackHandlerInstalled = false;
let snapshotShareBusy = false;
let chromeFaded = false;
let rootDrawerExpanded = false;
let sceneChipGesture = null;
let suppressNextSceneChipClick = false;

const els = {};

function normalizeLearningProgress(value) {
  const source = value && typeof value === 'object' ? value : {};
  const lessons = {};
  for (const [id, entry] of Object.entries(source.lessons && typeof source.lessons === 'object' ? source.lessons : {})) {
    if (!id) continue;
    if (entry === true) lessons[id] = { completedAt: null };
    else if (entry && typeof entry === 'object') lessons[id] = {
      completedAt: typeof entry.completedAt === 'string' ? entry.completedAt : null,
    };
  }
  return { ...source, lessons };
}

function loadLearningProgress() {
  try {
    return normalizeLearningProgress(JSON.parse(localStorage.getItem(PROGRESS_KEY) || 'null'));
  } catch (error) {
    recordError(error);
    return { lessons: {} };
  }
}

function setMobileLessonComplete(lessonId, complete = true) {
  if (!curriculumLessons.some(lesson => lesson.id === lessonId)) return false;
  learningProgress = normalizeLearningProgress(learningProgress);
  if (complete) learningProgress.lessons[lessonId] = { completedAt: new Date().toISOString() };
  else delete learningProgress.lessons[lessonId];
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(learningProgress));
  } catch (error) {
    recordError(error);
    return false;
  }
  syncLearnPanel();
  showStatus(complete ? 'Lesson complete' : 'Lesson reopened');
  return true;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return normalizeState({ ...DEFAULT_STATE, ...JSON.parse(raw) });
  } catch (error) {
    recordError(error);
  }
  return { ...DEFAULT_STATE };
}

function saveState({ immediate = false } = {}) {
  if (immediate) return flushSave();
  if (!savePending) saveRequestedAt = performance.now();
  savePending = true;
  if (saveTimer) return false;
  saveTimer = setTimeout(flushSave, SAVE_DEBOUNCE_MS);
  return false;
}

function stateForStorage() {
  if (!mobileTourStorageBaseState) return state;
  const stored = { ...state };
  for (const key of MOBILE_TOUR_RUNTIME_STATE_KEYS) stored[key] = mobileTourStorageBaseState[key];
  metrics.mobileTourStorageGuardCount++;
  metrics.lastMobileTourStorageGuardMs = performance.now();
  metrics.lastMobileTourStorageGuardKeys = [...MOBILE_TOUR_RUNTIME_STATE_KEYS];
  return stored;
}

function flushSave() {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  if (!savePending) return false;
  savePending = false;
  try {
    const stored = stateForStorage();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    metrics.saveCount++;
    metrics.lastSaveMs = performance.now();
    metrics.lastSaveDelayMs = metrics.lastSaveMs - saveRequestedAt;
    if (mobileTourStorageBaseState) metrics.mobileTourStorageGuardFlushCount++;
    return true;
  } catch (error) {
    recordError(error);
    return false;
  }
}

function normalizeState(next) {
  if (LEGACY_MODEL_MODE_MAP[next.modelMode]) next.modelMode = LEGACY_MODEL_MODE_MAP[next.modelMode];
  if (LEGACY_BACKGROUND_MAP[next.background]) next.background = LEGACY_BACKGROUND_MAP[next.background];
  if (!PALETTES[next.palette]) next.palette = DEFAULT_STATE.palette;
  if (!BACKGROUNDS[next.background]) next.background = DEFAULT_STATE.background;
  if (!QUALITY[next.quality]) next.quality = DEFAULT_STATE.quality;
  if (!SUPPORTED_MODEL_MODES.has(next.modelMode)) next.modelMode = DEFAULT_STATE.modelMode;
  if (!SUPPORTED_SHAPES.has(next.shape)) next.shape = DEFAULT_STATE.shape;
  if (!SUPPORTED_POLYTOPES4D.has(next.polytope4d)) next.polytope4d = DEFAULT_STATE.polytope4d;
  if (!SUPPORTED_DYNKIN_DIAGRAMS.has(next.dynkinDiagram)) next.dynkinDiagram = DEFAULT_STATE.dynkinDiagram;
  if (LEARN_TOPIC_IDS.size > 1 && !LEARN_TOPIC_IDS.has(next.learnTopic)) next.learnTopic = DEFAULT_STATE.learnTopic;
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
  next.panX = Number(next.panX) || 0;
  next.panY = Number(next.panY) || 0;
  next.zoom = clamp(Number(next.zoom) || 1, 0.55, 3.2);
  if (next.selectedRoot != null) {
    const selected = Number(next.selectedRoot);
    next.selectedRoot = Number.isInteger(selected) && selected >= 0 && selected < 240 ? selected : null;
  }
  if (typeof next.showRings !== 'boolean') next.showRings = true;
  if (typeof next.showContext !== 'boolean') next.showContext = true;
  if (typeof next.showPetrie !== 'boolean') next.showPetrie = false;
  if (typeof next.showMirrors !== 'boolean') next.showMirrors = false;
  if (typeof next.showEdges !== 'boolean') next.showEdges = false;
  if (typeof next.showVertices !== 'boolean') next.showVertices = false;
  if (typeof next.highlightSubset !== 'boolean') next.highlightSubset = true;
  if (typeof next.autoRotate !== 'boolean') next.autoRotate = false;
  if (typeof next.autoZoom !== 'boolean') next.autoZoom = false;
  if (typeof next.autoExtrude !== 'boolean') next.autoExtrude = false;
  if (typeof next.bloomAuto !== 'boolean') next.bloomAuto = false;
  if (typeof next.bloomTwinH4 !== 'boolean') next.bloomTwinH4 = true;
  if (typeof next.autoModel !== 'boolean') next.autoModel = false;
  if (typeof next.autoColor !== 'boolean') next.autoColor = false;
  if (typeof next.softFx !== 'boolean') next.softFx = false;
  if (!SUPPORTED_MOBILE_FX.has(next.fxMode)) next.fxMode = DEFAULT_STATE.fxMode;
  if (next.modelMode === 'sdf' || next.modelMode === 'platonic' || next.modelMode === 'poly4d') next.selectedRoot = null;
  return next;
}

function recordError(error) {
  metrics.runtimeErrors.push({
    message: error?.message || String(error),
    time: Date.now(),
  });
  if (metrics.runtimeErrors.length > 10) metrics.runtimeErrors.shift();
}

function markInteraction(type) {
  metrics.lastInteractionType = type;
  metrics.lastInteractionMs = performance.now();
}

async function loadData() {
  if (window.MOBILE_DATA) return window.MOBILE_DATA;
  const [e8, e8Math, mckaySubsets, platonic, stellations, polytopes4d, dynkin, mckay, curriculum] = await Promise.all([
    fetch('data/e8.json').then(r => r.json()),
    fetch('data/e8_math.json').then(r => r.json()),
    fetch('data/mckay_subsets.json').then(r => r.json()),
    fetch('data/platonic.json').then(r => r.json()),
    fetch('data/stellations.json').then(r => r.json()),
    fetch('data/polytopes4d.json').then(r => r.json()),
    fetch('data/dynkin.json').then(r => r.json()),
    fetch('data/mckay.json').then(r => r.json()),
    fetch('data/curriculum.json').then(r => r.json()),
  ]);
  return { e8, e8_math: e8Math, mckay_subsets: mckaySubsets, platonic, stellations, polytopes4d, dynkin, mckay, curriculum };
}

function cacheElements() {
  els.shell = document.querySelector('.mobile-shell');
  backgroundCanvas = document.getElementById('mobile-background-canvas');
  backgroundCtx = backgroundCanvas.getContext('2d', { alpha: false });
  canvas = document.getElementById('mobile-canvas');
  ctx = canvas.getContext('2d', { alpha: true });
  sdfCanvas = document.getElementById('mobile-sdf-canvas');
  els.settingsButton = document.getElementById('settings-button');
  els.qualityChip = document.getElementById('quality-chip');
  els.sceneChip = document.getElementById('scene-chip');
  els.statusToast = document.getElementById('status-toast');
  els.resetView = document.querySelector('[data-action="reset-view"]');
  els.sheet = document.getElementById('settings-sheet');
  els.sheetBody = els.sheet.querySelector('.sheet-body');
  els.close = document.getElementById('settings-close');
  els.done = document.getElementById('settings-done');
  els.rootDrawer = document.getElementById('root-drawer');
  els.infoCopy = document.getElementById('info-copy');
  els.infoSelection = document.getElementById('info-selection');
  els.mckayCard = document.getElementById('mckay-card');
  els.curiosityCard = document.getElementById('curiosity-card');
  els.learnPanel = document.getElementById('learn-panel');
  els.learnTopicGrid = document.getElementById('learn-topic-grid');
  els.learnTopicOutput = document.getElementById('learn-topic-output');
  els.learnTopicCard = document.getElementById('learn-topic-card');
  els.mobileTourCard = document.getElementById('mobile-tour-card');
  els.mobileTourOutput = document.getElementById('mobile-tour-output');
  els.mobileTourStepOutput = document.getElementById('mobile-tour-step-output');
  els.mobileTourCopy = document.getElementById('mobile-tour-copy');
  els.mobileTourToggle = document.getElementById('mobile-tour-toggle');
  els.mobileTourPrev = document.getElementById('mobile-tour-prev');
  els.mobileTourNext = document.getElementById('mobile-tour-next');
  els.cartanMatrix = document.getElementById('cartan-matrix');
  els.sharePng = document.getElementById('share-png');
  els.sharePostcard = document.getElementById('share-postcard');
  els.copyData = document.getElementById('copy-data');
  els.copyObj = document.getElementById('copy-obj');
  els.copyDiagnostics = document.getElementById('copy-diagnostics');
  els.highlightToggle = document.getElementById('highlight-toggle');
  els.contextToggle = document.getElementById('context-toggle');
  els.petrieToggle = document.getElementById('petrie-toggle');
  els.mirrorsToggle = document.getElementById('mirrors-toggle');
  els.edgesToggle = document.getElementById('edges-toggle');
  els.verticesToggle = document.getElementById('vertices-toggle');
  els.modelSelect = document.getElementById('model-select');
  els.bloomTimelineField = document.getElementById('bloom-timeline-field');
  els.bloomTime = document.getElementById('bloom-time');
  els.bloomTimeOutput = document.getElementById('bloom-time-output');
  els.bloomPhaseOutput = document.getElementById('bloom-phase-output');
  els.bloomAutoButton = document.getElementById('bloom-auto-button');
  els.bloomTwinButton = document.getElementById('bloom-twin-button');
  els.shapeField = document.getElementById('shape-field');
  els.shapeSelect = document.getElementById('shape-select');
  els.polytope4DField = document.getElementById('polytope4d-field');
  els.polytope4DSelect = document.getElementById('polytope4d-select');
  els.dynkinField = document.getElementById('dynkin-field');
  els.dynkinSelect = document.getElementById('dynkin-select');
  els.sdfField = document.getElementById('sdf-field');
  els.sdfRadius = document.getElementById('sdf-radius');
  els.sdfRadiusOutput = document.getElementById('sdf-radius-output');
  els.sdfBlend = document.getElementById('sdf-blend');
  els.sdfBlendOutput = document.getElementById('sdf-blend-output');
  els.sdfBloom = document.getElementById('sdf-bloom');
  els.sdfBloomOutput = document.getElementById('sdf-bloom-output');
  els.sdfAniso = document.getElementById('sdf-aniso');
  els.sdfAnisoOutput = document.getElementById('sdf-aniso-output');
  els.modelShortcutGroups = document.getElementById('model-shortcut-groups');
  els.modelShortcutOutput = document.getElementById('model-shortcut-output');
  els.subsetChipGrid = document.getElementById('subset-chip-grid');
  els.subsetSelect = document.getElementById('subset-select');
  els.subsetOutput = document.getElementById('subset-output');
  els.rootRange = document.getElementById('root-range');
  els.rootOutput = document.getElementById('root-output');
  els.rootJumpGrid = document.getElementById('root-jump-grid');
  els.rootJumpOutput = document.getElementById('root-jump-output');
  els.zoomOutput = document.getElementById('zoom-output');
  els.paletteSwatchGrid = document.getElementById('palette-swatch-grid');
  els.paletteOutput = document.getElementById('palette-output');
  els.paletteSelect = document.getElementById('palette-select');
  els.backgroundSelect = document.getElementById('background-select');
  els.backgroundBrightness = document.getElementById('background-brightness');
  els.backgroundBrightnessOutput = document.getElementById('background-brightness-output');
  els.fxPresetGrid = document.getElementById('fx-preset-grid');
  els.fxPresetOutput = document.getElementById('fx-preset-output');
  els.fxModeGrid = document.getElementById('fx-mode-grid');
  els.fxModeOutput = document.getElementById('fx-mode-output');
  els.fxModeDescription = document.getElementById('fx-mode-description');
  els.pointSize = document.getElementById('point-size');
  els.pointSizeOutput = document.getElementById('point-size-output');
  els.pointOpacity = document.getElementById('point-opacity');
  els.pointOpacityOutput = document.getElementById('point-opacity-output');
  els.ringsToggle = document.getElementById('rings-toggle');
  els.autoColorToggle = document.getElementById('auto-color-toggle');
  els.colorSpeed = document.getElementById('color-speed');
  els.colorSpeedOutput = document.getElementById('color-speed-output');
  els.softFxToggle = document.getElementById('soft-fx-toggle');
  els.fxStrength = document.getElementById('fx-strength');
  els.fxStrengthOutput = document.getElementById('fx-strength-output');
  els.motionToggle = document.getElementById('motion-toggle');
  els.autoModelToggle = document.getElementById('auto-model-toggle');
  els.motionSpeed = document.getElementById('motion-speed');
  els.motionSpeedGrid = document.getElementById('motion-speed-grid');
  els.motionSpeedOutput = document.getElementById('motion-speed-output');
  els.motionPresetGrid = document.getElementById('motion-preset-grid');
  els.motionPresetOutput = document.getElementById('motion-preset-output');
  els.cameraPathOutput = document.getElementById('camera-path-output');
  els.cameraRotation = document.getElementById('camera-rotation');
  els.cameraRotationOutput = document.getElementById('camera-rotation-output');
  els.cameraTilt = document.getElementById('camera-tilt');
  els.cameraTiltOutput = document.getElementById('camera-tilt-output');
  els.cameraZoom = document.getElementById('camera-zoom');
  els.cameraZoomOutput = document.getElementById('camera-zoom-output');
  els.cameraZoomAuto = document.getElementById('camera-zoom-auto');
  els.cameraExtrude = document.getElementById('camera-extrude');
  els.cameraExtrudeOutput = document.getElementById('camera-extrude-output');
  els.cameraExtrudeAuto = document.getElementById('camera-extrude-auto');
  els.sectionTabs = [...els.sheet.querySelectorAll('[data-section-tab]')];
  els.sectionPanels = [...els.sheet.querySelectorAll('[data-section]')];
  els.qualityButtons = [...els.sheet.querySelectorAll('[data-quality]')];
  els.modelContextControls = [...els.sheet.querySelectorAll('[data-model-context]')];
}

function bindEvents() {
  window.addEventListener('resize', handleViewportChange);
  window.addEventListener('orientationchange', () => {
    handleViewportChange();
    setTimeout(forceRender, 120);
  });
  window.addEventListener('pagehide', () => {
    stopMobileTour({ interactionType: 'pagehide-stop-tour', status: false });
    flushSave();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      resetInputState('visibility-hidden');
      stopMobileTour({ interactionType: 'visibility-stop-tour', status: false });
      flushSave();
      stopMotion();
    }
    else {
      requestRender();
      syncMotionLoop();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && handleBackNavigation()) event.preventDefault();
  });

  els.settingsButton.addEventListener('click', () => openSettings());
  els.sceneChip.addEventListener('click', handleSceneChipClick);
  els.sceneChip.addEventListener('pointerdown', onSceneChipPointerDown);
  els.sceneChip.addEventListener('pointermove', onSceneChipPointerMove);
  els.sceneChip.addEventListener('pointerup', onSceneChipPointerUp);
  els.sceneChip.addEventListener('pointercancel', cancelSceneChipGesture);
  els.sceneChip.addEventListener('pointerleave', cancelSceneChipGesture);
  els.sceneChip.addEventListener('contextmenu', (event) => event.preventDefault());
  els.qualityChip.addEventListener('click', cycleQuality);
  els.close.addEventListener('click', () => closeSettings('settings-close'));
  els.done.addEventListener('click', () => closeSettings('settings-done'));
  els.rootDrawer.addEventListener('click', (event) => {
    if (event.target.closest('[data-root-drawer-toggle]')) {
      toggleRootDrawer();
      return;
    }
    const action = event.target.closest('[data-root-action]')?.dataset.rootAction;
    handleRootAction(action);
  });
  els.sheet.addEventListener('click', (event) => {
    const cartanRoot = event.target.closest('[data-cartan-root]')?.dataset.cartanRoot;
    if (cartanRoot != null) {
      selectCartanRoot(Number(cartanRoot));
      return;
    }
    const rootJump = event.target.closest('[data-root-jump]')?.dataset.rootJump;
    if (rootJump) {
      selectRootJump(rootJump);
      return;
    }
    const rootAction = event.target.closest('[data-root-action]')?.dataset.rootAction;
    if (rootAction) {
      handleRootAction(rootAction);
      return;
    }
    const modelShortcut = event.target.closest('[data-model-shortcut]')?.dataset.modelShortcut;
    if (modelShortcut) {
      selectModelShortcut(modelShortcut);
      return;
    }
    const bloomAction = event.target.closest('[data-bloom-action]')?.dataset.bloomAction;
    if (bloomAction) {
      handleBloomAction(bloomAction);
      return;
    }
    const viewAction = event.target.closest('[data-view-action]')?.dataset.viewAction;
    if (viewAction) {
      handleViewAction(viewAction);
      return;
    }
    const subsetChip = event.target.closest('[data-subset-chip]')?.dataset.subsetChip;
    if (subsetChip) {
      selectSubsetChip(subsetChip);
      return;
    }
    const subsetAction = event.target.closest('[data-subset-action]')?.dataset.subsetAction;
    if (subsetAction) {
      handleSubsetAction(subsetAction);
      return;
    }
    const exportAction = event.target.closest('[data-export-action]')?.dataset.exportAction;
    if (exportAction) {
      handleExportAction(exportAction);
      return;
    }
    const fxPreset = event.target.closest('[data-fx-preset]')?.dataset.fxPreset;
    if (fxPreset) {
      selectFxPreset(fxPreset);
      return;
    }
    const fxMode = event.target.closest('[data-fx-treatment]')?.dataset.fxTreatment;
    if (fxMode) {
      selectFxMode(fxMode);
      return;
    }
    const paletteSwatch = event.target.closest('[data-palette-swatch]')?.dataset.paletteSwatch;
    if (paletteSwatch) {
      selectPaletteSwatch(paletteSwatch);
      return;
    }
    const learnTopic = event.target.closest('[data-learn-topic]')?.dataset.learnTopic;
    if (learnTopic) {
      selectLearnTopic(learnTopic);
      return;
    }
    const infoAction = event.target.closest('[data-info-action]')?.dataset.infoAction;
    if (infoAction) {
      handleInfoAction(infoAction);
      return;
    }
    const motionAction = event.target.closest('[data-motion-action]')?.dataset.motionAction;
    if (motionAction) {
      handleMotionAction(motionAction);
      return;
    }
    const motionSpeed = event.target.closest('[data-motion-speed]')?.dataset.motionSpeed;
    if (motionSpeed) {
      selectMotionSpeedPreset(motionSpeed);
      return;
    }
    const appAction = event.target.closest('[data-app-action]')?.dataset.appAction;
    if (appAction) {
      handleAppAction(appAction);
      return;
    }
    const tab = event.target.closest('[data-section-tab]');
    if (tab) {
      openSettings(tab.dataset.sectionTab);
      return;
    }
    const quality = event.target.closest('[data-quality]');
    if (quality) {
      setSettingState({ quality: quality.dataset.quality }, 'quality-setting', { syncQuality: true });
      return;
    }
    const resetButton = event.target.closest('[data-action="reset-view"]');
    if (resetButton) {
      resetView(resetButton);
      return;
    }
  });

  els.highlightToggle.addEventListener('change', () => setSettingState({ highlightSubset: els.highlightToggle.checked }, 'highlight-toggle'));
  els.contextToggle.addEventListener('change', () => setSettingState({ showContext: els.contextToggle.checked }, 'context-toggle'));
  els.petrieToggle.addEventListener('change', () => setSettingState({ showPetrie: els.petrieToggle.checked }, 'petrie-toggle'));
  els.mirrorsToggle.addEventListener('change', () => setSettingState({ showMirrors: els.mirrorsToggle.checked }, 'mirrors-toggle'));
  els.edgesToggle.addEventListener('change', () => setSettingState({ showEdges: els.edgesToggle.checked }, 'edges-toggle'));
  els.verticesToggle.addEventListener('change', () => setSettingState({ showVertices: els.verticesToggle.checked }, 'vertices-toggle'));
  els.modelSelect.addEventListener('change', () => setManualModelState({
    modelMode: els.modelSelect.value,
    autoModel: false,
    selectedRoot: selectedRootForModelMode(els.modelSelect.value),
  }, 'model-select'));
  els.shapeSelect.addEventListener('change', () => setManualModelState({
    shape: els.shapeSelect.value,
    modelMode: 'platonic',
    autoModel: false,
    selectedRoot: null,
  }, 'shape-select'));
  els.polytope4DSelect.addEventListener('change', () => setManualModelState({
    polytope4d: els.polytope4DSelect.value,
    modelMode: 'poly4d',
    autoModel: false,
    selectedRoot: null,
  }, 'polytope4d-select'));
  els.dynkinSelect.addEventListener('change', () => setManualModelState({
    dynkinDiagram: els.dynkinSelect.value,
    modelMode: 'dynkin',
    autoModel: false,
    selectedRoot: els.dynkinSelect.value === 'E8' && simpleRootIndices.includes(state.selectedRoot) ? state.selectedRoot : null,
  }, 'dynkin-select'));
  els.sdfRadius.addEventListener('input', () => {
    previewState({ sdfSphereR: Number(els.sdfRadius.value) }, 'sdf-radius');
    syncSdfControls();
  });
  els.sdfRadius.addEventListener('change', () => commitLiveControl('sdf-radius'));
  els.sdfBlend.addEventListener('input', () => {
    previewState({ sdfBlend: Number(els.sdfBlend.value) }, 'sdf-blend');
    syncSdfControls();
  });
  els.sdfBlend.addEventListener('change', () => commitLiveControl('sdf-blend'));
  els.sdfBloom.addEventListener('input', () => {
    previewState({ sdfBloom: Number(els.sdfBloom.value) }, 'sdf-bloom');
    syncSdfControls();
  });
  els.sdfBloom.addEventListener('change', () => commitLiveControl('sdf-bloom'));
  els.sdfAniso.addEventListener('input', () => {
    previewState({ sdfAniso: Number(els.sdfAniso.value) }, 'sdf-aniso');
    syncSdfControls();
  });
  els.sdfAniso.addEventListener('change', () => commitLiveControl('sdf-aniso'));
  els.bloomTime.addEventListener('input', () => {
    previewState({ bloomAmount: Number(els.bloomTime.value), bloomAuto: false }, 'bloom-time');
    syncBloomControls();
    syncSceneAccessibility(activeSceneSummary());
  });
  els.bloomTime.addEventListener('change', () => commitLiveControl('bloom-time'));
  els.subsetSelect.addEventListener('change', () => setManualExploreState({ subset: els.subsetSelect.value }, 'subset-select', { syncSubset: true }));
  els.rootRange.addEventListener('input', () => selectRoot(Number(els.rootRange.value), { save: false, interactionType: 'root-scrub' }));
  els.rootRange.addEventListener('change', () => selectRoot(Number(els.rootRange.value), { interactionType: 'root-commit' }));
  els.paletteSelect.addEventListener('change', () => setSettingState({ palette: els.paletteSelect.value }, 'palette-select', { syncPalette: true }));
  els.backgroundSelect.addEventListener('change', () => setSettingState({ background: els.backgroundSelect.value }, 'background-select'));
  els.backgroundBrightness.addEventListener('input', () => {
    previewState({ backgroundBrightness: Number(els.backgroundBrightness.value) }, 'background-brightness');
    syncVisualRangeOutputs();
  });
  els.backgroundBrightness.addEventListener('change', () => commitLiveControl('background-brightness'));
  els.pointSize.addEventListener('input', () => {
    previewState({ pointScale: Number(els.pointSize.value) }, 'point-size');
    syncVisualRangeOutputs();
  });
  els.pointSize.addEventListener('change', () => commitLiveControl('point-size'));
  els.pointOpacity.addEventListener('input', () => {
    previewState({ pointOpacity: Number(els.pointOpacity.value) }, 'point-opacity');
    syncVisualRangeOutputs();
  });
  els.pointOpacity.addEventListener('change', () => commitLiveControl('point-opacity'));
  els.ringsToggle.addEventListener('change', () => setSettingState({ showRings: els.ringsToggle.checked }, 'rings-toggle'));
  els.autoColorToggle.addEventListener('change', () => setManualRuntimeState({ autoColor: els.autoColorToggle.checked }, 'auto-color-toggle', { syncFx: true, syncMotionPreset: true }));
  els.colorSpeed.addEventListener('input', () => {
    previewState({ colorSpeed: Number(els.colorSpeed.value) }, 'color-speed', { render: false });
    syncVisualRangeOutputs();
  });
  els.colorSpeed.addEventListener('change', () => commitLiveControl('color-speed', { render: false }));
  els.softFxToggle.addEventListener('change', () => setManualRuntimeState({ softFx: els.softFxToggle.checked }, 'soft-fx-toggle', { syncFx: true, syncMotionPreset: true }));
  els.fxStrength.addEventListener('input', () => {
    previewState({ fxStrength: Number(els.fxStrength.value) }, 'fx-strength');
    syncVisualRangeOutputs();
  });
  els.fxStrength.addEventListener('change', () => commitLiveControl('fx-strength'));
  els.motionToggle.addEventListener('change', () => setManualRuntimeState({
    autoRotate: els.motionToggle.checked,
    cameraPath: els.motionToggle.checked ? (state.cameraPath === 'manual' ? 'orbit' : state.cameraPath) : 'manual',
  }, 'motion-toggle', { syncMotionPreset: true, syncMotionCamera: true }));
  els.autoModelToggle.addEventListener('change', () => setManualRuntimeState({ autoModel: els.autoModelToggle.checked }, 'auto-model-toggle', { syncMotionPreset: true }));
  els.motionSpeed.addEventListener('input', () => {
    previewState({ rotationSpeed: Number(els.motionSpeed.value) }, 'motion-speed', { render: false });
    syncMotionSpeedControls();
  });
  els.motionSpeed.addEventListener('change', () => commitLiveControl('motion-speed', { render: false }));
  els.cameraRotation.addEventListener('input', () => {
    previewState({ rotation: Number(els.cameraRotation.value) * Math.PI / 180, cameraPath: 'manual', autoRotate: false }, 'camera-rotation');
    syncMotionPresetControls();
  });
  els.cameraRotation.addEventListener('change', () => commitLiveControl('camera-rotation'));
  els.cameraTilt.addEventListener('input', () => {
    previewState({ cameraTilt: Number(els.cameraTilt.value) * Math.PI / 180, cameraPath: 'manual', autoRotate: false }, 'camera-tilt');
    syncMotionPresetControls();
  });
  els.cameraTilt.addEventListener('change', () => commitLiveControl('camera-tilt'));
  els.cameraZoom.addEventListener('input', () => {
    previewState({ zoom: Number(els.cameraZoom.value), autoZoom: false }, 'camera-zoom');
    syncCameraControls();
  });
  els.cameraZoom.addEventListener('change', () => commitLiveControl('camera-zoom'));
  els.cameraExtrude.addEventListener('input', () => {
    previewState({ e8MorphT: Number(els.cameraExtrude.value), autoExtrude: false }, 'camera-extrude');
    syncCameraControls();
  });
  els.cameraExtrude.addEventListener('change', () => commitLiveControl('camera-extrude'));

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerCancel);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  installNativeBackHandler();
}

function handleRootAction(action) {
  if (!action) return false;
  if (action === 'neighbor') return selectNeighbor();
  if (action === 'opposite') return selectOpposite();
  if (action === 'clear') return clearSelection();
  if (action === 'prev') return selectAdjacentRoot(-1);
  if (action === 'next') return selectAdjacentRoot(1);
  if (action === 'center') return centerSelectedRoot();
  return false;
}

function handleViewAction(action) {
  if (!action) return false;
  stopMobileTourForManualExplore();
  if (action === 'zoom-out') return stepZoom(-1);
  if (action === 'zoom-in') return stepZoom(1);
  if (action === 'zoom-reset') return setZoom(1);
  if (action === 'surprise') return mobileSurprise();
  if (action === 'fit-all') return fitAllRoots();
  return false;
}

function handleSubsetAction(action) {
  if (!action) return false;
  if (action === 'first') return selectFirstSubsetRoot();
  if (action === 'prev') return selectSubsetRoot(-1);
  if (action === 'next') return selectSubsetRoot(1);
  if (action === 'frame') return frameSubset();
  return false;
}

function handleInfoAction(action) {
  if (!action) return false;
  if (action === 'next-curiosity') return nextCuriosity();
  if (action === 'next-learn-topic') return nextLearnTopic();
  if (action === 'toggle-lesson-complete') {
    const lessonId = activeLearnTopicId();
    return setMobileLessonComplete(lessonId, !learningProgress.lessons?.[lessonId]);
  }
  if (action === 'toggle-tour') return toggleMobileTour();
  if (action === 'start-tour') return startMobileTour();
  if (action === 'stop-tour') return stopMobileTour();
  if (action === 'next-tour-step') return nextMobileTourStep();
  if (action === 'prev-tour-step') return previousMobileTourStep();
  return false;
}

function selectedRootForModelMode(modelMode) {
  if (modelMode === 'sdf' || modelMode === 'platonic' || modelMode === 'poly4d') return null;
  if (modelMode === 'dynkin') return simpleRootIndices.includes(state.selectedRoot) ? state.selectedRoot : null;
  return state.selectedRoot;
}

function handleMotionAction(action) {
  if (!action) return false;
  if (action === 'still' || action === 'orbit' || action === 'showcase') return selectMotionPreset(action);
  if (action === 'camera-orbit') return selectCameraPath('orbit');
  if (action === 'camera-dive') return selectCameraPath('dive');
  if (action === 'camera-spiral') return selectCameraPath('spiral');
  if (action === 'camera-reset') return resetCameraMotion();
  if (action === 'toggle-zoom-auto') return toggleCameraAuto('zoom');
  if (action === 'toggle-extrude-auto') return toggleCameraAuto('extrude');
  return false;
}

function handleAppAction(action) {
  if (!action) return false;
  if (action === 'defaults') return resetMobileDefaults();
  return false;
}

function handleExportAction(action) {
  if (!action) return false;
  if (action === 'share-png') {
    shareSnapshot();
    return true;
  }
  if (action === 'share-postcard') {
    sharePostcard();
    return true;
  }
  if (action === 'copy-data') {
    copyModelData();
    return true;
  }
  if (action === 'copy-obj') {
    copyModelObj();
    return true;
  }
  if (action === 'copy-diagnostics') {
    copyDiagnostics();
    return true;
  }
  return false;
}

function selectCartanRoot(order) {
  const idx = simpleRootIndices[order - 1];
  if (!Number.isInteger(idx)) return false;
  metrics.cartanMatrixSelectCount++;
  metrics.lastCartanMatrixSelectRoot = idx;
  metrics.lastCartanMatrixSelectOrder = order;
  metrics.lastCartanMatrixSelectMs = performance.now();
  if (state.subset !== 'simple_roots') {
    state.subset = 'simple_roots';
    metrics.cartanMatrixSubsetSwitchCount++;
    metrics.lastCartanMatrixSubsetSwitchMs = performance.now();
    syncSubsetControls();
  }
  return selectRoot(idx, { status: true, interactionType: 'cartan-matrix-select' });
}

function capacitorPlugin(name) {
  return typeof window !== 'undefined' ? window.Capacitor?.Plugins?.[name] : null;
}

function isCapacitorNative() {
  const cap = typeof window !== 'undefined' ? window.Capacitor : null;
  if (!cap) return false;
  try {
    if (typeof cap.isNativePlatform === 'function') return cap.isNativePlatform();
    return typeof cap.getPlatform === 'function' && cap.getPlatform() !== 'web';
  } catch {
    return false;
  }
}

function canNativeShareSnapshot() {
  return !!(isCapacitorNative() && capacitorPlugin('Filesystem') && capacitorPlugin('Share'));
}

function snapshotFileName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `e8_mobile_snapshot_${stamp}.png`;
}

function postcardFileName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `e8_mobile_postcard_${stamp}.png`;
}

function diagnosticsFileName() {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `e8_mobile_diagnostics_${stamp}.json`;
}

function safeSlug(value) {
  return String(value || 'model')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'model';
}

function geometryFileName(record) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const model = record?.name || record?.modelMode || state.modelMode;
  return `e8_mobile_${safeSlug(model)}_geometry_${stamp}.json`;
}

function objFileName(record) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const model = record?.name || record?.modelMode || state.modelMode;
  return `e8_mobile_${safeSlug(model)}_model_${stamp}.obj`;
}

function cloneJson(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function objNumber(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(6) : '0.000000';
}

function objIndex(value) {
  return Math.max(1, Math.floor(Number(value) || 0) + 1);
}

function objTextFromParts(record) {
  const vertices = record.vertices || [];
  const faces = record.faces || [];
  const lines = record.lines || [];
  const pointsOnly = !!record.pointsOnly;
  const rows = [
    '# E8 Studio Mobile V2 OBJ',
    `# kind: ${record.kind}`,
    `# model: ${record.name}`,
    `# vertices: ${vertices.length}`,
    `# lines: ${lines.length}`,
    `# faces: ${faces.length}`,
  ];
  if (record.note) rows.push(`# note: ${record.note}`);
  rows.push(`o ${safeSlug(record.name)}`);
  for (const vertex of vertices) rows.push(`v ${objNumber(vertex[0])} ${objNumber(vertex[1])} ${objNumber(vertex[2])}`);
  for (const face of faces) {
    if (Array.isArray(face) && face.length >= 3) rows.push(`f ${face.map(objIndex).join(' ')}`);
  }
  for (const line of lines) {
    if (Array.isArray(line) && line.length >= 2) rows.push(`l ${line.map(objIndex).join(' ')}`);
  }
  if (pointsOnly) {
    for (let idx = 0; idx < vertices.length; idx++) rows.push(`p ${idx + 1}`);
  }
  rows.push('');
  return rows.join('\n');
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('Could not read snapshot blob'));
    reader.onload = () => {
      const value = String(reader.result || '');
      resolve(value.includes(',') ? value.slice(value.indexOf(',') + 1) : value);
    };
    reader.readAsDataURL(blob);
  });
}

function activeGeometryRecord() {
  const scene = activeSceneSummary();
  const base = {
    source: 'E8 Studio Mobile V2',
    exporter: 'mobile-v2-canvas2d',
    modelMode: state.modelMode,
    scene: scene.topbarLabel,
    state: {
      subset: state.subset,
      shape: state.shape,
      polytope4d: state.polytope4d,
      dynkinDiagram: state.dynkinDiagram,
      selectedRoot: state.selectedRoot,
      palette: state.palette,
      quality: state.quality,
    },
  };

  if (state.modelMode === 'platonic') {
    const shape = platonicGeometry[state.shape];
    if (!shape) return null;
    const source = activeMckaySource();
    const info = mckayInfo[source] || {};
    return {
      ...base,
      kind: 'polyhedron',
      name: state.shape,
      label: SHAPE_LABELS[state.shape] || state.shape,
      dimension: 3,
      verts: cloneJson(shape.verts || []),
      edges: cloneJson(shape.edges || []),
      faces: cloneJson(shape.faces || []),
      mckay: {
        source,
        symmetry: info.symmetry || null,
        roots: info.roots || null,
        highlightedRoots: cloneJson(data?.mckay_subsets?.[source] || []),
      },
    };
  }

  if (state.modelMode === 'poly4d') {
    const poly = polytope4DGeometry[state.polytope4d];
    if (!poly) return null;
    const record = {
      ...base,
      kind: '4d-polytope',
      name: state.polytope4d,
      label: POLYTOPE4D_LABELS[state.polytope4d] || state.polytope4d,
      dimension: 4,
      verts: cloneJson(poly.verts || []),
      edges: cloneJson(poly.edges || []),
    };
    if (poly.conjugacy_classes) record.conjugacy_classes = cloneJson(poly.conjugacy_classes);
    return record;
  }

  if (state.modelMode === 'dynkin') {
    const diagram = dynkinGeometry[state.dynkinDiagram];
    if (!diagram) return null;
    return {
      ...base,
      kind: 'dynkin-diagram',
      name: state.dynkinDiagram,
      label: DYNKIN_LABELS[state.dynkinDiagram] || state.dynkinDiagram,
      rank: diagram.nodes?.length || 0,
      nodes: cloneJson(diagram.nodes || []),
      edges: cloneJson(diagram.edges || []),
      selectedSimpleRoot: selectedContext?.simpleRootOrder || null,
    };
  }

  const e8 = data?.e8;
  if (!e8) return null;
  const subset = [...rootSubset()];
  const presentation = state.modelMode === 'bloom'
    ? { name: 'e8-designed-bloom', label: 'Designed Bloom' }
    : state.modelMode === 'sdf'
      ? { name: 'e8-distance-field', label: 'E8 SDF' }
      : { name: 'e8-coxeter', label: 'E8 Coxeter' };
  return {
    ...base,
    kind: 'e8-root-system',
    name: presentation.name,
    label: presentation.label,
    dimension: 8,
    count: points.length,
    roots8d: cloneJson(e8.roots8d || []),
    coxeter_projection_2d: cloneJson(e8.proj2d || []),
    ring_radii: cloneJson(e8.ring_radii || []),
    active_subset: {
      name: state.subset,
      label: SUBSET_LABELS[state.subset] || state.subset,
      indices: subset,
    },
    simple_roots: cloneJson(simpleRootIndices),
    cartan_matrix: cloneJson(cartanMatrix),
    petrie_cycle_30: cloneJson(petrieCycle),
  };
}

function activeObjRecord() {
  if (state.modelMode === 'platonic') {
    const shape = platonicGeometry[state.shape];
    if (!shape) return null;
    const record = {
      kind: 'polyhedron',
      name: state.shape,
      vertices: cloneJson(shape.verts || []),
      lines: cloneJson(shape.edges || []),
      faces: cloneJson(shape.faces || []),
      pointsOnly: false,
      note: 'Canonical Platonic solid mesh from mobile data.',
    };
    record.text = objTextFromParts(record);
    return record;
  }

  if (state.modelMode === 'poly4d') {
    const polyName = SUPPORTED_POLYTOPES4D.has(state.polytope4d) ? state.polytope4d : DEFAULT_STATE.polytope4d;
    const poly = polytope4DGeometry[polyName];
    if (!poly) return null;
    const vertices = normalizedPolytope4DVerts(poly).map((vertex) => {
      const rotated = rotate4DVector(vertex, state.rotation);
      return project4DTo3D(rotated);
    });
    const record = {
      kind: '4d-polytope-projected-obj',
      name: polyName,
      vertices,
      lines: cloneJson(poly.edges || []),
      faces: [],
      pointsOnly: false,
      note: '4D vertices projected into 3D with the current mobile rotation.',
    };
    record.text = objTextFromParts(record);
    return record;
  }

  if (state.modelMode === 'dynkin') {
    const diagramName = SUPPORTED_DYNKIN_DIAGRAMS.has(state.dynkinDiagram) ? state.dynkinDiagram : DEFAULT_STATE.dynkinDiagram;
    const diagram = dynkinGeometry[diagramName];
    if (!diagram) return null;
    const vertices = normalizedDynkinNodes(diagram).map(node => [node[0], node[1], 0]);
    const record = {
      kind: 'dynkin-graph-obj',
      name: diagramName,
      vertices,
      lines: cloneJson(diagram.edges || []),
      faces: [],
      pointsOnly: false,
      note: 'Dynkin diagram exported as nodes and edge lines.',
    };
    record.text = objTextFromParts(record);
    return record;
  }

  if (!points.length) return null;
  const isDepth = state.modelMode === 'bloom';
  const vertices = points.map(point => {
    if (isDepth) {
      return point.bloomVisible
        ? [point.bloomX, point.bloomY, point.bloomZ]
        : [point.x, point.y, 0];
    }
    return [point.x, point.y, 0];
  });
  const record = {
    kind: isDepth ? 'e8-root-point-cloud-3d-obj' : 'e8-root-point-cloud-2d-obj',
    name: state.modelMode === 'bloom' ? 'e8-designed-bloom' : state.modelMode === 'sdf' ? 'e8-distance-field' : 'e8-coxeter',
    vertices,
    lines: state.showPetrie ? petrieCycle.map((idx, order) => [idx, petrieCycle[(order + 1) % petrieCycle.length]]) : [],
    faces: [],
    pointsOnly: true,
    note: isDepth
      ? 'E8 roots exported with the mobile depth coordinate underlying this presentation.'
      : state.modelMode === 'sdf'
        ? 'The 240 Coxeter-plane centres underlying the mobile SDF, exported on z=0.'
        : 'E8 Coxeter roots exported on the z=0 plane.',
  };
  record.text = objTextFromParts(record);
  return record;
}

function canvasElementToPngBlob(sourceCanvas, errorMessage = 'Could not create PNG') {
  return new Promise((resolve, reject) => {
    if (!sourceCanvas) {
      reject(new Error(errorMessage));
      return;
    }
    if (typeof sourceCanvas.toBlob === 'function') {
      sourceCanvas.toBlob(blob => {
        if (blob) resolve(blob);
        else reject(new Error(errorMessage));
      }, 'image/png');
      return;
    }
    try {
      const dataUrl = sourceCanvas.toDataURL('image/png');
      fetch(dataUrl).then(response => response.blob()).then(resolve, reject);
    } catch (error) {
      reject(error);
    }
  });
}

function compositeRenderCanvas() {
  const composite = document.createElement('canvas');
  composite.width = Math.max(1, canvas.width);
  composite.height = Math.max(1, canvas.height);
  const target = composite.getContext('2d', { alpha: false });
  target.drawImage(backgroundCanvas, 0, 0, backgroundCanvas.width, backgroundCanvas.height, 0, 0, composite.width, composite.height);
  target.drawImage(canvas, 0, 0, composite.width, composite.height);
  if (state.modelMode === 'sdf' && sdfCanvas?.classList.contains('active') && sdfGl) {
    target.drawImage(sdfCanvas, 0, 0, sdfCanvas.width, sdfCanvas.height, 0, 0, composite.width, composite.height);
  }
  return composite;
}

function canvasToPngBlob() {
  return canvasElementToPngBlob(compositeRenderCanvas(), 'Could not create PNG snapshot');
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadText(text, name, type = 'text/plain') {
  downloadBlob(new Blob([text], { type }), name);
}

async function shareNativeBlob(blob, name, shareText, shareTitle = 'E8 Studio snapshot') {
  if (!canNativeShareSnapshot()) return false;
  const Filesystem = capacitorPlugin('Filesystem');
  const Share = capacitorPlugin('Share');
  const data = await blobToBase64(blob);
  const file = await Filesystem.writeFile({
    path: name,
    data,
    directory: 'CACHE',
    recursive: true,
  });
  await Share.share({
    title: shareTitle,
    text: shareText,
    url: file.uri,
    dialogTitle: `Share ${shareTitle}`,
  });
  return true;
}

async function shareBrowserBlob(blob, name, shareText, shareTitle = 'E8 Studio snapshot') {
  if (!navigator.share || typeof File === 'undefined') return false;
  const file = new File([blob], name, { type: 'image/png' });
  const payload = { title: shareTitle, text: shareText, files: [file] };
  if (navigator.canShare && !navigator.canShare(payload)) return false;
  await navigator.share(payload);
  return true;
}

async function shareSnapshot(options = {}) {
  if (snapshotShareBusy) {
    return { ok: false, busy: true };
  }
  snapshotShareBusy = true;
  if (els.sharePng) els.sharePng.disabled = true;
  markInteraction('share-png');
  metrics.snapshotShareCount++;
  metrics.lastSnapshotShareMs = performance.now();
  metrics.lastSnapshotShareError = null;
  try {
    forceRender();
    const blob = await canvasToPngBlob();
    const name = snapshotFileName();
    const shareText = `E8 Studio mobile ${activeSceneSummary().topbarLabel} snapshot`;
    const shouldShare = options.share !== false;
    const allowDownload = options.download !== false;
    let mode = 'prepared';
    if (shouldShare && await shareNativeBlob(blob, name, shareText)) {
      mode = 'native';
    } else if (shouldShare && await shareBrowserBlob(blob, name, shareText)) {
      mode = 'browser';
    } else if (allowDownload) {
      downloadBlob(blob, name);
      metrics.snapshotShareFallbackCount++;
      mode = 'download';
    }
    metrics.snapshotShareSuccessCount++;
    metrics.lastSnapshotShareMode = mode;
    metrics.lastSnapshotShareName = name;
    metrics.lastSnapshotShareBytes = blob.size;
    metrics.lastSnapshotShareWidth = canvas.width;
    metrics.lastSnapshotShareHeight = canvas.height;
    showStatus(mode === 'prepared' ? 'Snapshot prepared' : 'Snapshot ready');
    return {
      ok: true,
      mode,
      name,
      bytes: blob.size,
      width: canvas.width,
      height: canvas.height,
    };
  } catch (error) {
    const message = error?.message || String(error);
    metrics.snapshotShareErrorCount++;
    metrics.lastSnapshotShareError = message;
    showStatus('Snapshot unavailable');
    return { ok: false, error: message };
  } finally {
    snapshotShareBusy = false;
    if (els.sharePng) els.sharePng.disabled = false;
  }
}

function postcardCaption() {
  const scene = activeSceneSummary();
  const context = getSelectedContext();
  if (state.selectedRoot != null && context) {
    const point = points[state.selectedRoot];
    return `Root #${state.selectedRoot} | ring ${point?.ring ?? '?'} | ${context.neighborCount} Cartan neighbors`;
  }
  if (state.modelMode === 'platonic') {
    const shape = platonicGeometry[state.shape] || {};
    const info = mckayInfo[activeMckaySource()] || {};
    return `${SHAPE_LABELS[state.shape] || state.shape} | ${shape.verts?.length || 0} vertices | McKay ${info.roots || 'ADE'}`;
  }
  if (state.modelMode === 'poly4d') {
    const poly = polytope4DGeometry[state.polytope4d] || {};
    return `${POLYTOPE4D_LABELS[state.polytope4d] || state.polytope4d} | ${poly.verts?.length || 0} vertices | 4D projection`;
  }
  if (state.modelMode === 'dynkin') {
    const diagram = dynkinGeometry[state.dynkinDiagram] || {};
    return `${DYNKIN_LABELS[state.dynkinDiagram] || state.dynkinDiagram} Dynkin | ${diagram.nodes?.length || 0} nodes | Cartan graph`;
  }
  return scene.topbarLabel;
}

function drawRoundedRect(target, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  target.beginPath();
  target.moveTo(x + r, y);
  target.lineTo(x + width - r, y);
  target.quadraticCurveTo(x + width, y, x + width, y + r);
  target.lineTo(x + width, y + height - r);
  target.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  target.lineTo(x + r, y + height);
  target.quadraticCurveTo(x, y + height, x, y + height - r);
  target.lineTo(x, y + r);
  target.quadraticCurveTo(x, y, x + r, y);
  target.closePath();
}

function drawFitText(target, text, x, y, maxWidth, baseSize, minSize, color, weight = 800) {
  let size = baseSize;
  do {
    target.font = `${weight} ${size}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    if (target.measureText(text).width <= maxWidth || size <= minSize) break;
    size -= 2;
  } while (size > minSize);
  target.fillStyle = color;
  target.fillText(text, x, y);
  return size;
}

function drawWrappedText(target, text, x, y, maxWidth, lineHeight, maxLines) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  let line = '';
  let lines = 0;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (target.measureText(test).width > maxWidth && line) {
      lines++;
      if (lines >= maxLines) {
        target.fillText(`${line.replace(/[.,;:!?]*$/, '')}...`, x, y);
        return y + lineHeight;
      }
      target.fillText(line, x, y);
      line = word;
      y += lineHeight;
    } else {
      line = test;
    }
  }
  if (line && lines < maxLines) {
    target.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
}

function buildPostcardCanvas(options = {}) {
  const width = clamp(Math.round(Number(options.width) || 1080), 360, 2160);
  const height = clamp(Math.round(Number(options.height) || Math.round(width * 16 / 9)), 640, 3840);
  const scene = activeSceneSummary();
  const caption = postcardCaption();
  const topic = learnTopicRecord(activeLearnTopicId());
  const paletteSet = RENDER_PALETTES[state.palette] || RENDER_PALETTES.gold;
  const out = document.createElement('canvas');
  out.width = width;
  out.height = height;
  const target = out.getContext('2d', { alpha: false });
  const pad = Math.round(width * 0.07);
  const accent = paletteSet.colors[0];
  const secondary = paletteSet.colors[1];
  const gradient = target.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, '#07070c');
  gradient.addColorStop(0.58, '#101018');
  gradient.addColorStop(1, colorWithAlpha(secondary, 0.28));
  target.fillStyle = gradient;
  target.fillRect(0, 0, width, height);

  target.globalAlpha = 0.2;
  target.strokeStyle = accent;
  target.lineWidth = Math.max(2, width * 0.003);
  for (let i = 0; i < 5; i++) {
    target.beginPath();
    target.arc(width * 0.5, height * 0.3, width * (0.24 + i * 0.13), 0, TAU);
    target.stroke();
  }
  target.globalAlpha = 1;

  const renderCanvas = compositeRenderCanvas();
  const srcW = Math.max(1, renderCanvas?.width || 1);
  const srcH = Math.max(1, renderCanvas?.height || 1);
  const srcAspect = srcW / srcH;
  const maxImageW = width - pad * 2;
  const maxImageH = Math.round(height * 0.6);
  let imageW = maxImageW;
  let imageH = imageW / srcAspect;
  if (imageH > maxImageH) {
    imageH = maxImageH;
    imageW = imageH * srcAspect;
  }
  const imageX = Math.round((width - imageW) / 2);
  const imageY = Math.round(height * 0.08);
  target.save();
  target.shadowColor = 'rgba(0,0,0,0.34)';
  target.shadowBlur = Math.round(width * 0.035);
  target.fillStyle = '#09090f';
  drawRoundedRect(target, imageX - 8, imageY - 8, imageW + 16, imageH + 16, Math.round(width * 0.035));
  target.fill();
  target.restore();
  target.save();
  drawRoundedRect(target, imageX, imageY, imageW, imageH, Math.round(width * 0.028));
  target.clip();
  target.drawImage(renderCanvas, 0, 0, srcW, srcH, imageX, imageY, imageW, imageH);
  target.restore();

  const textX = pad;
  const textW = width - pad * 2;
  const titleY = imageY + imageH + Math.round(height * 0.075);
  drawFitText(target, 'E8 Studio', textX, titleY, textW, Math.round(width * 0.082), Math.round(width * 0.052), '#f8f4e8', 900);
  drawFitText(target, scene.topbarLabel, textX, titleY + Math.round(width * 0.075), textW, Math.round(width * 0.038), Math.round(width * 0.026), accent, 800);
  target.font = `700 ${Math.round(width * 0.03)}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  target.fillStyle = 'rgba(248,244,232,0.82)';
  let nextY = drawWrappedText(target, caption, textX, titleY + Math.round(width * 0.135), textW, Math.round(width * 0.045), 2);
  target.font = `600 ${Math.round(width * 0.026)}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  target.fillStyle = 'rgba(248,244,232,0.62)';
  nextY = drawWrappedText(target, topic.body, textX, nextY + Math.round(width * 0.026), textW, Math.round(width * 0.038), 3);
  target.fillStyle = colorWithAlpha(accent, 0.9);
  target.fillRect(textX, Math.min(height - pad * 1.65, nextY + Math.round(width * 0.034)), Math.round(width * 0.18), Math.max(3, Math.round(width * 0.006)));
  target.font = `800 ${Math.round(width * 0.024)}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  target.fillStyle = 'rgba(248,244,232,0.56)';
  target.fillText('MOBILE V2 / WEBGL + CANVAS', textX, height - pad);
  target.textAlign = 'right';
  target.fillStyle = colorWithAlpha(accent, 0.82);
  target.fillText(QUALITY[state.quality].label.toUpperCase(), width - pad, height - pad);
  target.textAlign = 'left';

  return {
    canvas: out,
    width,
    height,
    caption,
    scene: scene.topbarLabel,
  };
}

async function postcardToPngBlob(options = {}) {
  const postcard = buildPostcardCanvas(options);
  const blob = await canvasElementToPngBlob(postcard.canvas, 'Could not create PNG postcard');
  return { ...postcard, blob };
}

async function sharePostcard(options = {}) {
  if (snapshotShareBusy) {
    return { ok: false, busy: true };
  }
  snapshotShareBusy = true;
  if (els.sharePostcard) els.sharePostcard.disabled = true;
  markInteraction('share-postcard');
  metrics.postcardShareCount++;
  metrics.lastPostcardShareMs = performance.now();
  metrics.lastPostcardShareError = null;
  try {
    forceRender();
    const postcard = await postcardToPngBlob(options);
    const blob = postcard.blob;
    const name = postcardFileName();
    const shareTitle = 'E8 Studio postcard';
    const shareText = `E8 Studio mobile postcard: ${postcard.caption}`;
    const shouldShare = options.share !== false;
    const allowDownload = options.download !== false;
    let mode = 'prepared';
    if (shouldShare && await shareNativeBlob(blob, name, shareText, shareTitle)) {
      mode = 'native';
    } else if (shouldShare && await shareBrowserBlob(blob, name, shareText, shareTitle)) {
      mode = 'browser';
    } else if (allowDownload) {
      downloadBlob(blob, name);
      metrics.postcardShareFallbackCount++;
      mode = 'download';
    }
    metrics.postcardShareSuccessCount++;
    metrics.lastPostcardShareMode = mode;
    metrics.lastPostcardShareName = name;
    metrics.lastPostcardShareBytes = blob.size;
    metrics.lastPostcardShareWidth = postcard.width;
    metrics.lastPostcardShareHeight = postcard.height;
    metrics.lastPostcardShareCaption = postcard.caption;
    metrics.lastPostcardShareScene = postcard.scene;
    showStatus(mode === 'prepared' ? 'Postcard prepared' : 'Postcard ready');
    return {
      ok: true,
      mode,
      name,
      bytes: blob.size,
      width: postcard.width,
      height: postcard.height,
      caption: postcard.caption,
      scene: postcard.scene,
    };
  } catch (error) {
    const message = error?.message || String(error);
    metrics.postcardShareErrorCount++;
    metrics.lastPostcardShareError = message;
    showStatus('Postcard unavailable');
    return { ok: false, error: message };
  } finally {
    snapshotShareBusy = false;
    if (els.sharePostcard) els.sharePostcard.disabled = false;
  }
}

function buildDiagnostics() {
  return {
    renderer: {
      type: 'canvas2d',
      canvas: canvas ? { width: canvas.width, height: canvas.height } : null,
      css: { width: canvasCssWidth, height: canvasCssHeight },
      renderScale: metrics.renderScale,
      quality: state.quality,
    },
    state: getState(),
    metrics: getMetrics(),
    data: {
      roots: points.length,
      rings: ringRadiusFactors.length,
      subset: {
        name: state.subset,
        size: rootSubset().size,
      },
      petrieCycleLength: petrieCycle.length,
      simpleRootCount: simpleRootIndices.length,
    },
    device: {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      hardwareConcurrency: navigator.hardwareConcurrency || null,
      deviceMemory: navigator.deviceMemory || null,
      maxTouchPoints: navigator.maxTouchPoints || 0,
      dpr: window.devicePixelRatio || 1,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      native: isCapacitorNative(),
    },
    timestamp: new Date().toISOString(),
    url: location.href,
  };
}

async function copyDiagnostics(options = {}) {
  markInteraction('copy-diagnostics');
  metrics.diagnosticsCopyCount++;
  metrics.lastDiagnosticsCopyMs = performance.now();
  metrics.lastDiagnosticsCopyError = null;
  const info = buildDiagnostics();
  const text = JSON.stringify(info, null, 2);
  const name = diagnosticsFileName();
  const shouldCopy = options.copy !== false;
  const allowDownload = options.download !== false;
  let mode = 'prepared';

  try {
    if (shouldCopy && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      mode = 'clipboard';
    } else if (allowDownload) {
      downloadText(text, name, 'application/json');
      metrics.diagnosticsCopyFallbackCount++;
      mode = 'download';
    }
    metrics.diagnosticsCopySuccessCount++;
    metrics.lastDiagnosticsCopyMode = mode;
    metrics.lastDiagnosticsCopyName = name;
    metrics.lastDiagnosticsCopyBytes = new Blob([text], { type: 'application/json' }).size;
    showStatus(mode === 'prepared' ? 'Diagnostics prepared' : 'Diagnostics ready');
    return {
      ok: true,
      mode,
      name,
      bytes: metrics.lastDiagnosticsCopyBytes,
      diagnostics: info,
    };
  } catch (error) {
    const message = error?.message || String(error);
    metrics.diagnosticsCopyErrorCount++;
    metrics.lastDiagnosticsCopyError = message;
    if (allowDownload) {
      try {
        downloadText(text, name, 'application/json');
        metrics.diagnosticsCopyFallbackCount++;
        metrics.diagnosticsCopySuccessCount++;
        metrics.lastDiagnosticsCopyMode = 'download';
        metrics.lastDiagnosticsCopyName = name;
        metrics.lastDiagnosticsCopyBytes = new Blob([text], { type: 'application/json' }).size;
        showStatus('Diagnostics ready');
        return {
          ok: true,
          mode: 'download',
          name,
          bytes: metrics.lastDiagnosticsCopyBytes,
          diagnostics: info,
        };
      } catch (fallbackError) {
        metrics.lastDiagnosticsCopyError = fallbackError?.message || String(fallbackError);
      }
    }
    showStatus('Diagnostics unavailable');
    return { ok: false, error: metrics.lastDiagnosticsCopyError };
  }
}

async function copyModelData(options = {}) {
  markInteraction('copy-data');
  metrics.modelDataExportCount++;
  metrics.lastModelDataExportMs = performance.now();
  metrics.lastModelDataExportError = null;

  const geometry = activeGeometryRecord();
  if (!geometry) {
    const message = 'Geometry unavailable';
    metrics.modelDataExportErrorCount++;
    metrics.lastModelDataExportError = message;
    showStatus('Data unavailable');
    return { ok: false, error: message };
  }

  const text = JSON.stringify(geometry, null, 2);
  const name = geometryFileName(geometry);
  const shouldCopy = options.copy !== false;
  const allowDownload = options.download !== false;
  let mode = 'prepared';

  try {
    if (shouldCopy && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      mode = 'clipboard';
    } else if (allowDownload) {
      downloadText(text, name, 'application/json');
      metrics.modelDataExportFallbackCount++;
      mode = 'download';
    }
    metrics.modelDataExportSuccessCount++;
    metrics.lastModelDataExportMode = mode;
    metrics.lastModelDataExportName = name;
    metrics.lastModelDataExportBytes = new Blob([text], { type: 'application/json' }).size;
    metrics.lastModelDataExportKind = geometry.kind;
    metrics.lastModelDataExportModel = geometry.name;
    showStatus(mode === 'prepared' ? 'Data prepared' : 'Data ready');
    return {
      ok: true,
      mode,
      name,
      bytes: metrics.lastModelDataExportBytes,
      geometry,
    };
  } catch (error) {
    const message = error?.message || String(error);
    metrics.modelDataExportErrorCount++;
    metrics.lastModelDataExportError = message;
    if (allowDownload) {
      try {
        downloadText(text, name, 'application/json');
        metrics.modelDataExportFallbackCount++;
        metrics.modelDataExportSuccessCount++;
        metrics.lastModelDataExportMode = 'download';
        metrics.lastModelDataExportName = name;
        metrics.lastModelDataExportBytes = new Blob([text], { type: 'application/json' }).size;
        metrics.lastModelDataExportKind = geometry.kind;
        metrics.lastModelDataExportModel = geometry.name;
        showStatus('Data ready');
        return {
          ok: true,
          mode: 'download',
          name,
          bytes: metrics.lastModelDataExportBytes,
          geometry,
        };
      } catch (fallbackError) {
        metrics.lastModelDataExportError = fallbackError?.message || String(fallbackError);
      }
    }
    showStatus('Data unavailable');
    return { ok: false, error: metrics.lastModelDataExportError };
  }
}

async function copyModelObj(options = {}) {
  markInteraction('copy-obj');
  metrics.modelObjExportCount++;
  metrics.lastModelObjExportMs = performance.now();
  metrics.lastModelObjExportError = null;

  const obj = activeObjRecord();
  if (!obj) {
    const message = 'OBJ unavailable';
    metrics.modelObjExportErrorCount++;
    metrics.lastModelObjExportError = message;
    showStatus('OBJ unavailable');
    return { ok: false, error: message };
  }

  const text = obj.text;
  const name = objFileName(obj);
  const shouldCopy = options.copy !== false;
  const allowDownload = options.download !== false;
  let mode = 'prepared';

  try {
    if (shouldCopy && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      mode = 'clipboard';
    } else if (allowDownload) {
      downloadText(text, name, 'text/plain');
      metrics.modelObjExportFallbackCount++;
      mode = 'download';
    }
    metrics.modelObjExportSuccessCount++;
    metrics.lastModelObjExportMode = mode;
    metrics.lastModelObjExportName = name;
    metrics.lastModelObjExportBytes = new Blob([text], { type: 'text/plain' }).size;
    metrics.lastModelObjExportKind = obj.kind;
    metrics.lastModelObjExportModel = obj.name;
    metrics.lastModelObjExportVertices = obj.vertices?.length || 0;
    metrics.lastModelObjExportLines = obj.lines?.length || 0;
    metrics.lastModelObjExportFaces = obj.faces?.length || 0;
    metrics.lastModelObjExportPoints = obj.pointsOnly ? obj.vertices?.length || 0 : 0;
    showStatus(mode === 'prepared' ? 'OBJ prepared' : 'OBJ ready');
    return {
      ok: true,
      mode,
      name,
      bytes: metrics.lastModelObjExportBytes,
      obj: {
        kind: obj.kind,
        name: obj.name,
        vertices: metrics.lastModelObjExportVertices,
        lines: metrics.lastModelObjExportLines,
        faces: metrics.lastModelObjExportFaces,
        points: metrics.lastModelObjExportPoints,
        text,
      },
    };
  } catch (error) {
    const message = error?.message || String(error);
    metrics.modelObjExportErrorCount++;
    metrics.lastModelObjExportError = message;
    if (allowDownload) {
      try {
        downloadText(text, name, 'text/plain');
        metrics.modelObjExportFallbackCount++;
        metrics.modelObjExportSuccessCount++;
        metrics.lastModelObjExportMode = 'download';
        metrics.lastModelObjExportName = name;
        metrics.lastModelObjExportBytes = new Blob([text], { type: 'text/plain' }).size;
        metrics.lastModelObjExportKind = obj.kind;
        metrics.lastModelObjExportModel = obj.name;
        metrics.lastModelObjExportVertices = obj.vertices?.length || 0;
        metrics.lastModelObjExportLines = obj.lines?.length || 0;
        metrics.lastModelObjExportFaces = obj.faces?.length || 0;
        metrics.lastModelObjExportPoints = obj.pointsOnly ? obj.vertices?.length || 0 : 0;
        showStatus('OBJ ready');
        return {
          ok: true,
          mode: 'download',
          name,
          bytes: metrics.lastModelObjExportBytes,
          obj: {
            kind: obj.kind,
            name: obj.name,
            vertices: metrics.lastModelObjExportVertices,
            lines: metrics.lastModelObjExportLines,
            faces: metrics.lastModelObjExportFaces,
            points: metrics.lastModelObjExportPoints,
            text,
          },
        };
      } catch (fallbackError) {
        metrics.lastModelObjExportError = fallbackError?.message || String(fallbackError);
      }
    }
    showStatus('OBJ unavailable');
    return { ok: false, error: metrics.lastModelObjExportError };
  }
}

function randomChoice(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function randomDifferent(items, current) {
  const choices = items.filter(item => item !== current);
  return randomChoice(choices.length ? choices : items);
}

function mobileSurprise() {
  const palettes = Object.keys(PALETTES);
  const subsets = [...SUPPORTED_SUBSETS];
  const fxModes = MOBILE_FX_MODES.map(mode => mode.id);
  const patch = {
    palette: randomDifferent(palettes, state.palette),
    subset: randomDifferent(subsets, state.subset),
    pointScale: randomChoice([0.9, 1, 1.1, 1.3]),
    showRings: Math.random() > 0.18,
    showPetrie: Math.random() < 0.34,
    showMirrors: Math.random() < 0.28,
    showVertices: false,
    highlightSubset: true,
    showContext: true,
    quality: 'smooth',
    autoRotate: false,
    autoZoom: false,
    autoExtrude: false,
    autoModel: false,
    autoColor: false,
    softFx: false,
    fxMode: randomDifferent(fxModes, state.fxMode),
    rotationSpeed: DEFAULT_STATE.rotationSpeed,
    rotation: Math.random() * TAU,
    cameraTilt: DEFAULT_STATE.cameraTilt,
    cameraPath: 'manual',
    e8MorphT: 0,
    panX: 0,
    panY: 0,
    zoom: 1,
    selectedRoot: null,
    bloomAmount: DEFAULT_STATE.bloomAmount,
    bloomAuto: false,
    bloomTwinH4: DEFAULT_STATE.bloomTwinH4,
  };
  metrics.surpriseCount++;
  metrics.lastSurpriseMs = performance.now();
  metrics.lastSurprisePatch = { ...patch };
  const result = setState(patch, {
    sync: false,
    syncSkipKind: 'settings',
    interactionType: 'surprise',
    renderReason: 'surprise',
  });
  metrics.settingsControlSyncSkipCount++;
  metrics.lastSettingsControlSyncSkip = 'surprise';
  metrics.lastSettingsControlSyncSkipMs = performance.now();
  syncControlValues();
  showStatus('Surprise ready');
  return result;
}

function setAutoPreset(mode) {
  let patch;
  if (mode === 'showcase') {
    patch = {
      modelMode: 'platonic',
      shape: 'icosahedron',
      selectedRoot: null,
      autoRotate: true,
      autoZoom: false,
      autoExtrude: false,
      autoModel: true,
      autoColor: true,
      softFx: true,
      cameraPath: 'spiral',
    };
  } else if (mode === 'orbit') {
    patch = {
      autoRotate: true,
      autoZoom: false,
      autoExtrude: false,
      autoModel: false,
      cameraPath: 'orbit',
    };
  } else {
    patch = {
      autoRotate: false,
      autoZoom: false,
      autoExtrude: false,
      autoModel: false,
      autoColor: false,
      softFx: false,
      cameraPath: 'manual',
    };
  }
  const interactionType = mode === 'showcase' ? 'auto-preset-showcase' : mode === 'orbit' ? 'auto-preset-orbit' : 'auto-preset-still';
  const result = setState(patch, {
    sync: false,
    syncSkipKind: 'settings',
    interactionType,
    renderReason: interactionType,
  });
  metrics.settingsControlSyncSkipCount++;
  metrics.lastSettingsControlSyncSkip = interactionType;
  metrics.lastSettingsControlSyncSkipMs = performance.now();
  syncControlValues();
  showStatus(mode === 'showcase' ? 'Showcase ready' : mode === 'orbit' ? 'Orbit ready' : 'Still');
  return result;
}

function defaultMobileState() {
  return normalizeState({ ...DEFAULT_STATE });
}

function resetMobileDefaults() {
  stopMobileTour({ interactionType: 'defaults-stop-tour', status: false });
  clearTapMemory();
  const previousQuality = state.quality;
  markInteraction('defaults-reset');
  previousSelectedRoot = state.selectedRoot;
  state = defaultMobileState();
  autoModelElapsed = 0;
  autoModelIndex = currentAutoModelIndex();
  lastSelectionDetailHtml = null;
  selectionUiDetailsDeferred = false;
  metrics.defaultsResetCount++;
  metrics.lastDefaultsResetMs = performance.now();
  metrics.settingsControlSyncSkipCount++;
  metrics.lastSettingsControlSyncSkip = 'defaults-reset';
  metrics.lastSettingsControlSyncSkipMs = metrics.lastDefaultsResetMs;
  saveRequestedAt = performance.now();
  savePending = true;
  flushSave();
  syncControlValues();
  if (state.quality !== previousQuality) {
    if (isSettingsOpen()) deferSettingsCanvasResize();
    else resizeCanvas();
  }
  if (isSettingsOpen()) deferSettingsRender('defaults-reset');
  else requestRender('defaults-reset');
  syncMotionLoop();
  showStatus('Defaults restored');
  return getState();
}

function setState(patch, options = {}) {
  clearTapMemory();
  const next = normalizeState({ ...state, ...patch });
  if (!patchChangesState(patch, next)) {
    const interactionType = options.interactionType || options.renderReason || 'set-state';
    if (options.interactionType) markInteraction(options.interactionType);
    metrics.stateNoopSkipCount++;
    metrics.lastStateNoopSkip = interactionType;
    metrics.lastStateNoopSkipMs = performance.now();
    return getState();
  }
  const previousQuality = state.quality;
  const previousAutoModel = state.autoModel;
  const previousAutoZoom = state.autoZoom;
  const previousAutoExtrude = state.autoExtrude;
  state = next;
  if (state.autoZoom && !previousAutoZoom) syncAutoMotionPhase('zoom');
  if (state.autoExtrude && !previousAutoExtrude) syncAutoMotionPhase('extrude');
  if (state.autoModel && (!previousAutoModel || patch.modelMode != null || patch.shape != null || patch.polytope4d != null || patch.dynkinDiagram != null)) {
    autoModelIndex = currentAutoModelIndex();
    autoModelElapsed = AUTO_MODEL_INTERVAL_S;
  } else if (!state.autoModel) {
    autoModelElapsed = 0;
  }
  if (options.interactionType) markInteraction(options.interactionType);
  if (options.save !== false) saveState();
  if (options.sync === false) {
    if ((options.syncSkipKind || 'live') === 'live') {
      metrics.liveControlSyncSkipCount++;
      metrics.lastLiveControlSyncSkip = options.interactionType || null;
      metrics.lastLiveControlSyncSkipMs = performance.now();
    }
  } else {
    syncControls(options.syncReason || options.interactionType || 'set-state');
  }
  if (state.quality !== previousQuality) {
    if (isSettingsOpen()) deferSettingsCanvasResize();
    else resizeCanvas();
  }
  if (options.render === false) suppressRender(options.renderReason || options.interactionType || 'set-state');
  else requestRender(options.renderReason || options.interactionType || 'set-state');
  syncMotionLoop();
  return getState();
}

function setSettingState(patch, interactionType, options = {}) {
  const next = normalizeState({ ...state, ...patch });
  if (!patchChangesState(patch, next)) {
    clearTapMemory();
    markInteraction(interactionType);
    metrics.settingsStateNoopSkipCount++;
    metrics.lastSettingsStateNoopSkip = interactionType;
    metrics.lastSettingsStateNoopSkipMs = performance.now();
    return getState();
  }
  const result = setState(patch, {
    sync: false,
    syncSkipKind: 'settings',
    interactionType,
    render: options.render,
    renderReason: interactionType,
  });
  metrics.settingsControlSyncSkipCount++;
  metrics.lastSettingsControlSyncSkip = interactionType;
  metrics.lastSettingsControlSyncSkipMs = performance.now();
  if (options.syncQuality) syncQualityControls();
  if (options.syncPalette) syncPaletteControls();
  if (options.syncFx) syncFxPresetControls();
  if (options.syncFxMode) syncFxModeControls();
  if (options.syncSubset) syncSubsetControls();
  if (options.syncMotionSpeed) syncMotionSpeedControls();
  if (options.syncMotionPreset) syncMotionPresetControls();
  if (options.syncMotionCamera) syncCameraControls();
  if (options.syncSdf) syncSdfControls();
  if (options.syncBloom) syncBloomControls();
  if (options.syncModel) {
    syncModelControls();
    updateSelectionUI({ reason: interactionType });
  }
  return result;
}

function setManualModelState(patch, interactionType) {
  if (mobileTourActive) stopMobileTour({ interactionType: 'mobile-tour-manual-model-stop', status: false });
  return setSettingState(patch, interactionType, { syncModel: true });
}

function setManualRuntimeState(patch, interactionType, options = {}) {
  if (mobileTourActive) stopMobileTour({ interactionType: 'mobile-tour-manual-runtime-stop', status: false });
  return setSettingState(patch, interactionType, options);
}

function stopMobileTourForManualExplore() {
  if (!mobileTourActive) return false;
  return !!stopMobileTour({ interactionType: 'mobile-tour-manual-explore-stop', status: false });
}

function setManualExploreState(patch, interactionType, options = {}) {
  stopMobileTourForManualExplore();
  return setSettingState(patch, interactionType, options);
}

function patchChangesState(patch, next) {
  return Object.keys(patch).some(key => next[key] !== state[key]);
}

function previewState(patch, controlName, options = {}) {
  metrics.liveControlCount++;
  metrics.lastLiveControl = controlName;
  metrics.lastLiveControlMs = performance.now();
  const interactionType = `${controlName}-preview`;
  if (options.render !== false && !isSettingsOpen()) requestLiveControlLiteRender(interactionType);
  return setState(patch, { save: false, sync: false, interactionType, render: options.render, renderReason: interactionType });
}

function commitLiveControl(controlName, options = {}) {
  metrics.liveControlCommitCount++;
  metrics.lastLiveControlCommit = controlName;
  metrics.lastLiveControlCommitMs = performance.now();
  const interactionType = `${controlName}-commit`;
  markInteraction(interactionType);
  liveControlLiteRenderReason = null;
  saveState();
  if (options.render === false) suppressRender(interactionType);
  else requestSettledRenderAfterInput(interactionType);
  return true;
}

function showResetFeedback(button = els.resetView) {
  if (!button) return false;
  if (resetFeedbackTimer) clearTimeout(resetFeedbackTimer);
  button.classList.add('is-confirmed');
  button.textContent = 'Reset done';
  resetFeedbackTimer = setTimeout(() => {
    resetFeedbackTimer = null;
    button.classList.remove('is-confirmed');
    button.textContent = 'Reset';
  }, 1200);
  return true;
}

function resetView(button = els.resetView) {
  stopMobileTourForManualExplore();
  motionPhase = 0;
  const activeSelection = {
    modelMode: state.modelMode,
    shape: state.shape,
    polytope4d: state.polytope4d,
    dynkinDiagram: state.dynkinDiagram,
    learnTopic: state.learnTopic,
  };
  setState({
    ...defaultMobileState(),
    ...activeSelection,
  }, { interactionType: 'reset-view' });
  showResetFeedback(button);
  showStatus(`${MODEL_LABELS[state.modelMode] || 'Model'} visuals reset`);
  return true;
}

function modelShortcutLabel(shortcut) {
  return shortcut?.name || shortcut?.label || 'Model';
}

function modelShortcutMatches(shortcut) {
  const target = shortcut?.target;
  if (!target || target.modelMode !== state.modelMode) return false;
  if (target.modelMode === 'platonic') return target.shape === state.shape;
  if (target.modelMode === 'poly4d') return target.polytope4d === state.polytope4d;
  if (target.modelMode === 'dynkin') return target.dynkinDiagram === state.dynkinDiagram;
  return true;
}

function activeModelShortcut() {
  return MODEL_SHORTCUTS.find(modelShortcutMatches) || null;
}

function renderModelShortcuts() {
  if (!els.modelShortcutGroups) return false;
  els.modelShortcutGroups.innerHTML = MODEL_SHORTCUT_GROUPS.map(group => {
    const buttons = group.items.map(shortcut => (
      `<button type="button" data-model-shortcut="${escapeHtml(shortcut.id)}" aria-label="${escapeHtml(modelShortcutLabel(shortcut))}">${escapeHtml(shortcut.label)}</button>`
    )).join('');
    return `<div class="model-shortcut-group" data-model-shortcut-group="${escapeHtml(group.id)}"><strong>${escapeHtml(group.label)}</strong><div class="model-shortcut-grid">${buttons}</div></div>`;
  }).join('');
  metrics.modelShortcutButtonCount = MODEL_SHORTCUTS.length;
  return true;
}

function syncModelShortcutControls() {
  if (!els.modelShortcutGroups) return false;
  const active = activeModelShortcut();
  if (els.modelShortcutOutput) els.modelShortcutOutput.textContent = active ? modelShortcutLabel(active) : sceneStatusText();
  els.modelShortcutGroups.querySelectorAll('[data-model-shortcut]').forEach(button => {
    const isActive = active?.id === button.dataset.modelShortcut;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
  return true;
}

function selectModelShortcut(id) {
  const shortcut = MODEL_SHORTCUTS.find(item => item.id === id);
  if (!shortcut) return false;
  return setScenePreset(shortcut.target, {
    interactionType: `model-shortcut-${shortcut.id}`,
    metricKind: 'model-shortcut',
    modelShortcut: shortcut,
  });
}

function renderPaletteSwatches() {
  if (!els.paletteSwatchGrid) return false;
  els.paletteSwatchGrid.innerHTML = Object.entries(PALETTES).map(([name, colors]) => {
    const label = paletteLabel(name);
    const dots = colors.map(color => `<i style="--dot:${escapeHtml(color)}"></i>`).join('');
    return `<button type="button" data-palette-swatch="${escapeHtml(name)}" aria-label="${escapeHtml(label)} palette"><span class="palette-dots" aria-hidden="true">${dots}</span><span>${escapeHtml(label)}</span></button>`;
  }).join('');
  if (els.paletteSelect) {
    els.paletteSelect.innerHTML = Object.keys(PALETTES).map(name => (
      `<option value="${escapeHtml(name)}">${escapeHtml(paletteLabel(name))}</option>`
    )).join('');
  }
  metrics.paletteSwatchButtonCount = Object.keys(PALETTES).length;
  return true;
}

function syncPaletteControls() {
  if (els.paletteSelect) els.paletteSelect.value = state.palette;
  const label = paletteLabel(state.palette);
  if (els.paletteOutput) els.paletteOutput.textContent = label;
  if (els.paletteSwatchGrid) {
    els.paletteSwatchGrid.querySelectorAll('[data-palette-swatch]').forEach(button => {
      const isActive = button.dataset.paletteSwatch === state.palette;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }
  return true;
}

function selectPaletteSwatch(name) {
  if (!PALETTES[name]) return false;
  const previousPalette = state.palette;
  const result = setSettingState({ palette: name }, `palette-swatch-${name}`, { syncPalette: true });
  if (state.palette === previousPalette) return result;
  metrics.paletteSwatchSelectCount++;
  metrics.paletteSwatchSyncSkipCount++;
  metrics.lastPaletteSwatch = state.palette;
  metrics.lastPaletteSwatchLabel = paletteLabel(state.palette);
  metrics.lastPaletteSwatchMs = performance.now();
  showStatus(`Palette: ${metrics.lastPaletteSwatchLabel}`);
  return result;
}

function fxPresetLabel(preset) {
  return preset?.label || 'FX';
}

function activeFxPreset() {
  return FX_PRESETS.find(preset => preset.autoColor === state.autoColor && preset.softFx === state.softFx) || null;
}

function renderFxPresets() {
  if (!els.fxPresetGrid) return false;
  els.fxPresetGrid.innerHTML = FX_PRESETS.map(preset => (
    `<button type="button" data-fx-preset="${escapeHtml(preset.id)}" aria-label="${escapeHtml(fxPresetLabel(preset))} color and motion preset">${escapeHtml(preset.label)}</button>`
  )).join('');
  metrics.fxPresetButtonCount = FX_PRESETS.length;
  return true;
}

function syncFxPresetControls() {
  if (els.autoColorToggle) els.autoColorToggle.checked = state.autoColor;
  if (els.softFxToggle) els.softFxToggle.checked = state.softFx;
  const active = activeFxPreset();
  if (els.fxPresetOutput) els.fxPresetOutput.textContent = active ? fxPresetLabel(active) : 'Custom';
  if (els.fxPresetGrid) {
    els.fxPresetGrid.querySelectorAll('[data-fx-preset]').forEach(button => {
      const isActive = active?.id === button.dataset.fxPreset;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }
  return true;
}

function colorSpeedLabel(value) {
  if (value < 0.5) return 'Slow';
  if (value < 1) return 'Medium';
  return 'Fast';
}

function syncVisualRangeOutputs() {
  if (els.backgroundBrightnessOutput) els.backgroundBrightnessOutput.textContent = `${Math.round(state.backgroundBrightness * 100)}%`;
  if (els.pointSizeOutput) els.pointSizeOutput.textContent = `${Math.round(state.pointScale * 100)}%`;
  if (els.pointOpacityOutput) els.pointOpacityOutput.textContent = `${Math.round(state.pointOpacity * 100)}%`;
  if (els.colorSpeedOutput) els.colorSpeedOutput.textContent = colorSpeedLabel(state.colorSpeed);
  if (els.fxStrengthOutput) els.fxStrengthOutput.textContent = `${Math.round(state.fxStrength * 100)}%`;
  syncFxSurface();
  return true;
}

function syncVisualControls() {
  if (els.backgroundSelect) els.backgroundSelect.value = state.background;
  if (els.backgroundBrightness) els.backgroundBrightness.value = String(state.backgroundBrightness);
  if (els.pointSize) els.pointSize.value = String(state.pointScale);
  if (els.pointOpacity) els.pointOpacity.value = String(state.pointOpacity);
  if (els.colorSpeed) els.colorSpeed.value = String(state.colorSpeed);
  if (els.fxStrength) els.fxStrength.value = String(state.fxStrength);
  syncVisualRangeOutputs();
  syncFxModeControls();
  return true;
}

function selectFxPreset(id) {
  const preset = FX_PRESETS.find(item => item.id === id);
  if (!preset) return false;
  const previousAutoColor = state.autoColor;
  const previousSoftFx = state.softFx;
  const result = setManualRuntimeState({ autoColor: preset.autoColor, softFx: preset.softFx }, `fx-preset-${preset.id}`, {
    syncFx: true,
    syncMotionPreset: true,
  });
  if (state.autoColor === previousAutoColor && state.softFx === previousSoftFx) return result;
  metrics.fxPresetSelectCount++;
  metrics.fxPresetSyncSkipCount++;
  metrics.lastFxPreset = preset.id;
  metrics.lastFxPresetLabel = fxPresetLabel(preset);
  metrics.lastFxPresetMs = performance.now();
  showStatus(`Color & motion: ${metrics.lastFxPresetLabel}`);
  return result;
}

function fxModeLabel(mode) {
  return mode?.name || mode?.label || 'FX';
}

function activeFxMode() {
  return MOBILE_FX_MODES.find(mode => mode.id === state.fxMode) || MOBILE_FX_MODES[0];
}

function renderFxModes() {
  if (!els.fxModeGrid) return false;
  els.fxModeGrid.innerHTML = MOBILE_FX_MODES.map(mode => (
    `<button type="button" data-fx-treatment="${escapeHtml(mode.id)}" data-fx-cost="${escapeHtml(mode.cost)}" aria-label="${escapeHtml(fxModeLabel(mode))} effect, ${escapeHtml(mode.cost)} GPU cost"><span>${escapeHtml(mode.label)}</span><small>${escapeHtml(mode.cost)}</small></button>`
  )).join('');
  metrics.fxModeButtonCount = MOBILE_FX_MODES.length;
  return true;
}

function syncFxSurface() {
  if (!els.shell) return false;
  const strength = clamp(state.fxStrength, 0.25, 1.5);
  els.shell.dataset.fxMode = state.fxMode;
  els.shell.style.setProperty('--mobile-fx-strength', strength.toFixed(2));
  els.shell.style.setProperty('--mobile-fx-brightness', (1 + strength * 0.13).toFixed(3));
  els.shell.style.setProperty('--mobile-fx-saturation', (1 + strength * 0.32).toFixed(3));
  els.shell.style.setProperty('--mobile-fx-blur', `${(4 + strength * 6).toFixed(1)}px`);
  els.shell.style.setProperty('--mobile-fx-fringe', `${(0.8 + strength * 1.35).toFixed(1)}px`);
  els.shell.style.setProperty('--mobile-fx-alpha', clamp(0.08 + strength * 0.12, 0.1, 0.3).toFixed(3));
  return true;
}

function syncFxModeControls() {
  const active = activeFxMode();
  if (els.fxModeOutput) els.fxModeOutput.textContent = fxModeLabel(active);
  if (els.fxModeDescription) els.fxModeDescription.textContent = active.description;
  if (els.fxModeGrid) {
    els.fxModeGrid.querySelectorAll('[data-fx-treatment]').forEach(button => {
      const isActive = button.dataset.fxTreatment === active.id;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }
  syncFxSurface();
  return true;
}

function selectFxMode(id) {
  const mode = MOBILE_FX_MODES.find(item => item.id === id);
  if (!mode) return false;
  const previous = state.fxMode;
  const result = setManualRuntimeState({ fxMode: mode.id }, `fx-mode-${mode.id}`, { syncFxMode: true });
  if (state.fxMode === previous) return result;
  metrics.fxModeSelectCount++;
  metrics.fxModeSyncSkipCount++;
  metrics.lastFxMode = mode.id;
  metrics.lastFxModeLabel = fxModeLabel(mode);
  metrics.lastFxModeMs = performance.now();
  showStatus(`Effect: ${metrics.lastFxModeLabel}`);
  return result;
}

function subsetChipLabel(name) {
  return SUBSET_CHIPS.find(chip => chip.id === name)?.name || SUBSET_LABELS[name] || name;
}

function renderSubsetChips() {
  if (!els.subsetChipGrid) return false;
  els.subsetChipGrid.innerHTML = SUBSET_CHIPS.map(chip => (
    `<button type="button" data-subset-chip="${escapeHtml(chip.id)}" aria-label="${escapeHtml(chip.name)} subset">${escapeHtml(chip.label)}</button>`
  )).join('');
  metrics.subsetChipButtonCount = SUBSET_CHIPS.length;
  return true;
}

function syncSubsetChipControls() {
  if (!els.subsetChipGrid) return false;
  els.subsetChipGrid.querySelectorAll('[data-subset-chip]').forEach(button => {
    const isActive = button.dataset.subsetChip === state.subset;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
  return true;
}

function selectSubsetChip(name) {
  if (!SUPPORTED_SUBSETS.has(name)) return false;
  const previousSubset = state.subset;
  const result = setManualExploreState({ subset: name }, `subset-chip-${name}`, { syncSubset: true });
  if (state.subset === previousSubset) return result;
  metrics.subsetChipSelectCount++;
  metrics.subsetChipSyncSkipCount++;
  metrics.lastSubsetChip = state.subset;
  metrics.lastSubsetChipLabel = subsetChipLabel(state.subset);
  metrics.lastSubsetChipMs = performance.now();
  showStatus(`Subset: ${metrics.lastSubsetChipLabel}`);
  return result;
}

function rootJumpLabel(id) {
  return ROOT_JUMPS.find(jump => jump.id === id)?.name || id;
}

function renderRootJumps() {
  if (!els.rootJumpGrid) return false;
  els.rootJumpGrid.innerHTML = ROOT_JUMPS.map(jump => (
    `<button type="button" data-root-jump="${escapeHtml(jump.id)}" aria-label="${escapeHtml(rootJumpLabel(jump.id))}">${escapeHtml(jump.label)}</button>`
  )).join('');
  metrics.rootJumpButtonCount = ROOT_JUMPS.length;
  return true;
}

function rootJumpIsDisabled(id, context = selectedContext) {
  if (id === 'near') return !(context?.point?.neighbors?.length);
  if (id === 'opposite') return context?.antipode == null;
  return false;
}

function syncRootJumpControls() {
  if (els.rootJumpOutput) els.rootJumpOutput.textContent = state.selectedRoot == null ? 'None' : `#${state.selectedRoot}`;
  if (!els.rootJumpGrid) return false;
  const context = getSelectedContext();
  els.rootJumpGrid.querySelectorAll('[data-root-jump]').forEach(button => {
    const disabled = rootJumpIsDisabled(button.dataset.rootJump, context);
    button.disabled = disabled;
    button.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  });
  return true;
}

function rootJumpDone(id, root, result) {
  if (!result) return false;
  metrics.rootJumpSelectCount++;
  metrics.lastRootJump = id;
  metrics.lastRootJumpLabel = rootJumpLabel(id);
  metrics.lastRootJumpRoot = root;
  metrics.lastRootJumpMs = performance.now();
  syncRootJumpControls();
  return result;
}

function selectRootJump(id) {
  const jump = ROOT_JUMPS.find(item => item.id === id);
  if (!jump) return false;
  const context = getSelectedContext();
  if (rootJumpIsDisabled(id, context)) {
    metrics.rootJumpDisabledCount++;
    metrics.lastRootJump = id;
    metrics.lastRootJumpLabel = rootJumpLabel(id);
    metrics.lastRootJumpRoot = null;
    metrics.lastRootJumpMs = performance.now();
    showStatus('Select a root first');
    return false;
  }
  let root = null;
  if (id === 'alpha') {
    root = simpleRootIndices[0];
    if (!Number.isInteger(root)) return false;
    if (state.subset !== 'simple_roots') {
      state.subset = 'simple_roots';
      metrics.rootJumpSubsetSwitchCount++;
      syncSubsetControls();
    }
  } else if (id === 'mckay') {
    const list = rootSubsetList();
    root = list[0];
  } else if (id === 'near') {
    const neighbors = context?.point?.neighbors || [];
    root = neighbors.find(idx => idx !== previousSelectedRoot) ?? neighbors[0];
  } else if (id === 'opposite') {
    root = context?.antipode;
  } else if (id === 'random') {
    const choices = allRootList.filter(idx => idx !== state.selectedRoot);
    root = randomChoice(choices.length ? choices : allRootList);
  }
  if (!Number.isInteger(root)) return false;
  const result = selectRoot(root, {
    status: true,
    drawerExpanded: false,
    interactionType: `root-jump-${id}`,
  });
  return rootJumpDone(id, root, result);
}

function motionSpeedPresetLabel(preset) {
  return preset?.name || preset?.label || 'Speed';
}

function activeMotionSpeedPreset() {
  return MOTION_SPEED_PRESETS.find(preset => Math.abs(state.rotationSpeed - preset.value) < 0.01) || null;
}

function motionSpeedOutputText() {
  const preset = activeMotionSpeedPreset();
  return preset ? motionSpeedPresetLabel(preset) : `${Number(state.rotationSpeed.toFixed(1))}x`;
}

function renderMotionSpeedPresets() {
  if (!els.motionSpeedGrid) return false;
  els.motionSpeedGrid.innerHTML = MOTION_SPEED_PRESETS.map(preset => (
    `<button type="button" data-motion-speed="${escapeHtml(preset.id)}" aria-label="${escapeHtml(motionSpeedPresetLabel(preset))} motion speed">${escapeHtml(preset.label)}</button>`
  )).join('');
  metrics.motionSpeedPresetButtonCount = MOTION_SPEED_PRESETS.length;
  return true;
}

function syncMotionSpeedControls() {
  if (els.motionSpeed) els.motionSpeed.value = String(state.rotationSpeed);
  if (els.motionSpeedOutput) els.motionSpeedOutput.textContent = motionSpeedOutputText();
  if (els.motionSpeedGrid) {
    const active = activeMotionSpeedPreset();
    els.motionSpeedGrid.querySelectorAll('[data-motion-speed]').forEach(button => {
      const isActive = active?.id === button.dataset.motionSpeed;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }
  return true;
}

function selectMotionSpeedPreset(id) {
  const preset = MOTION_SPEED_PRESETS.find(item => item.id === id);
  if (!preset) return false;
  const previousSpeed = state.rotationSpeed;
  const result = setSettingState({ rotationSpeed: preset.value }, `motion-speed-preset-${preset.id}`, {
    syncMotionSpeed: true,
    render: false,
  });
  if (Math.abs(state.rotationSpeed - previousSpeed) < 0.01) return result;
  metrics.motionSpeedPresetSelectCount++;
  metrics.motionSpeedPresetSyncSkipCount++;
  metrics.lastMotionSpeedPreset = preset.id;
  metrics.lastMotionSpeedPresetLabel = motionSpeedPresetLabel(preset);
  metrics.lastMotionSpeedPresetValue = preset.value;
  metrics.lastMotionSpeedPresetMs = performance.now();
  showStatus(`Speed: ${metrics.lastMotionSpeedPresetLabel}`);
  return result;
}

function motionPresetLabel(preset) {
  return preset?.name || preset?.label || 'Motion';
}

function activeMotionPreset() {
  if (state.autoRotate && state.autoModel && state.autoColor && state.softFx && !state.autoZoom && !state.autoExtrude) {
    return MOTION_PRESETS.find(preset => preset.id === 'showcase') || null;
  }
  if (state.autoRotate && !state.autoModel && !state.autoZoom && !state.autoExtrude && (state.cameraPath === 'orbit' || state.cameraPath === 'manual')) {
    return MOTION_PRESETS.find(preset => preset.id === 'orbit') || null;
  }
  if (!state.autoRotate && !state.autoZoom && !state.autoExtrude && !state.autoModel && !state.autoColor && !state.softFx) {
    return MOTION_PRESETS.find(preset => preset.id === 'still') || null;
  }
  return null;
}

function cameraPathLabel(path = state.cameraPath) {
  return ({ manual: 'Manual', orbit: 'Orbit', dive: 'Dive', spiral: 'Spiral' })[path] || 'Manual';
}

function syncCameraControls() {
  const rotationDegrees = ((state.rotation * 180 / Math.PI + 180) % 360 + 360) % 360 - 180;
  if (els.cameraPathOutput) els.cameraPathOutput.textContent = cameraPathLabel();
  if (els.cameraRotation) els.cameraRotation.value = String(Math.round(rotationDegrees));
  if (els.cameraRotationOutput) els.cameraRotationOutput.textContent = `${Math.round(rotationDegrees)}°`;
  if (els.cameraTilt) els.cameraTilt.value = String(Math.round(state.cameraTilt * 180 / Math.PI));
  if (els.cameraTiltOutput) els.cameraTiltOutput.textContent = `${Math.round(state.cameraTilt * 180 / Math.PI)}°`;
  if (els.cameraZoom) els.cameraZoom.value = String(state.zoom);
  if (els.cameraZoomOutput) els.cameraZoomOutput.textContent = `${Math.round(state.zoom * 100)}%`;
  if (els.cameraZoomAuto) {
    els.cameraZoomAuto.classList.toggle('active', state.autoZoom);
    els.cameraZoomAuto.setAttribute('aria-pressed', state.autoZoom ? 'true' : 'false');
  }
  if (els.cameraExtrude) els.cameraExtrude.value = String(state.e8MorphT);
  if (els.cameraExtrudeOutput) els.cameraExtrudeOutput.textContent = state.e8MorphT.toFixed(2);
  if (els.cameraExtrudeAuto) {
    els.cameraExtrudeAuto.classList.toggle('active', state.autoExtrude);
    els.cameraExtrudeAuto.setAttribute('aria-pressed', state.autoExtrude ? 'true' : 'false');
  }
  document.querySelectorAll('.camera-path-grid [data-motion-action]').forEach(button => {
    const path = button.dataset.motionAction?.replace('camera-', '');
    const active = path !== 'reset' && path === state.cameraPath && state.autoRotate;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', active ? 'true' : 'false');
  });
  return true;
}

function toggleCameraAuto(kind) {
  const key = kind === 'zoom' ? 'autoZoom' : kind === 'extrude' ? 'autoExtrude' : null;
  if (!key) return false;
  const enabled = !state[key];
  const result = setManualRuntimeState({ [key]: enabled }, `${kind}-auto-toggle`, {
    syncMotionPreset: true,
    syncMotionCamera: true,
  });
  showStatus(`${kind === 'zoom' ? 'Zoom' : 'Extrude'} auto ${enabled ? 'on' : 'off'}`);
  return result;
}

function selectCameraPath(path) {
  if (!['orbit', 'dive', 'spiral'].includes(path)) return false;
  motionPhase = 0;
  const result = setManualRuntimeState({ cameraPath: path, autoRotate: true, autoZoom: false }, `camera-path-${path}`, {
    syncMotionPreset: true,
    syncMotionCamera: true,
  });
  showStatus(`${cameraPathLabel(path)} camera`);
  return result;
}

function resetCameraMotion() {
  motionPhase = 0;
  const result = setManualRuntimeState({
    rotation: 0,
    cameraTilt: DEFAULT_STATE.cameraTilt,
    cameraPath: 'manual',
    autoRotate: false,
    autoZoom: false,
    autoExtrude: false,
    zoom: 1,
    e8MorphT: 0,
    panX: 0,
    panY: 0,
  }, 'camera-reset', { syncMotionPreset: true, syncMotionCamera: true });
  showStatus('Camera reset');
  return result;
}

function renderMotionPresets() {
  if (!els.motionPresetGrid) return false;
  els.motionPresetGrid.innerHTML = MOTION_PRESETS.map(preset => (
    `<button type="button" data-motion-action="${escapeHtml(preset.interaction)}" aria-label="${escapeHtml(motionPresetLabel(preset))} motion preset">${escapeHtml(preset.label)}</button>`
  )).join('');
  metrics.motionPresetButtonCount = MOTION_PRESETS.length;
  return true;
}

function syncMotionPresetControls() {
  if (els.motionToggle) els.motionToggle.checked = state.autoRotate;
  if (els.autoModelToggle) els.autoModelToggle.checked = state.autoModel;
  const active = activeMotionPreset();
  if (els.motionPresetOutput) els.motionPresetOutput.textContent = active ? motionPresetLabel(active) : 'Custom';
  if (els.motionPresetGrid) {
    els.motionPresetGrid.querySelectorAll('[data-motion-action]').forEach(button => {
      const preset = MOTION_PRESETS.find(item => item.interaction === button.dataset.motionAction);
      const isActive = active?.id === preset?.id;
      button.classList.toggle('active', isActive);
      button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    });
  }
  syncCameraControls();
  return true;
}

function selectMotionPreset(id) {
  const preset = MOTION_PRESETS.find(item => item.id === id || item.interaction === id);
  if (!preset) return false;
  if (mobileTourActive) stopMobileTour({ interactionType: 'mobile-tour-manual-runtime-stop', status: false });
  const previous = {
    autoRotate: state.autoRotate,
    autoZoom: state.autoZoom,
    autoExtrude: state.autoExtrude,
    autoModel: state.autoModel,
    autoColor: state.autoColor,
    softFx: state.softFx,
  };
  const result = setAutoPreset(preset.interaction);
  const changed = previous.autoRotate !== state.autoRotate
    || previous.autoZoom !== state.autoZoom
    || previous.autoExtrude !== state.autoExtrude
    || previous.autoModel !== state.autoModel
    || previous.autoColor !== state.autoColor
    || previous.softFx !== state.softFx;
  if (!changed) return result;
  metrics.motionPresetSelectCount++;
  metrics.motionPresetSyncSkipCount++;
  metrics.lastMotionPreset = preset.id;
  metrics.lastMotionPresetLabel = motionPresetLabel(preset);
  metrics.lastMotionPresetMs = performance.now();
  return result;
}

function clearSceneChipTimer() {
  if (!sceneChipGesture?.timer) return false;
  clearTimeout(sceneChipGesture.timer);
  sceneChipGesture.timer = null;
  return true;
}

function cancelSceneChipGesture() {
  clearSceneChipTimer();
  sceneChipGesture = null;
}

function recordSceneChipGesture(kind, extra = {}) {
  metrics.lastSceneChipGesture = kind;
  metrics.lastSceneChipGestureMs = performance.now();
  if (extra.direction) metrics.lastSceneChipSwipeDirection = extra.direction;
}

function suppressSceneChipClickOnce() {
  suppressNextSceneChipClick = true;
  setTimeout(() => {
    suppressNextSceneChipClick = false;
  }, 420);
}

function openSceneSettingsFromChip() {
  suppressSceneChipClickOnce();
  if (sceneChipGesture) sceneChipGesture.longPressFired = true;
  markInteraction('scene-chip-hold-view');
  metrics.sceneChipLongPressCount++;
  metrics.sceneChipOpenSettingsCount++;
  recordSceneChipGesture('hold-view');
  openSettings('view');
  showStatus('View settings');
  return true;
}

function handleSceneChipClick(event) {
  if (suppressNextSceneChipClick) {
    suppressNextSceneChipClick = false;
    event.preventDefault();
    return false;
  }
  recordSceneChipGesture('tap-next');
  return stepScene(1, { interactionType: 'scene-chip-next' });
}

function onSceneChipPointerDown(event) {
  if (event.button != null && event.button !== 0) return;
  clearSceneChipTimer();
  sceneChipGesture = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    longPressFired: false,
    timer: setTimeout(openSceneSettingsFromChip, SCENE_CHIP_LONG_PRESS_MS),
  };
}

function onSceneChipPointerMove(event) {
  if (!sceneChipGesture || sceneChipGesture.pointerId !== event.pointerId) return;
  const dx = event.clientX - sceneChipGesture.startX;
  const dy = event.clientY - sceneChipGesture.startY;
  if (Math.hypot(dx, dy) > SCENE_CHIP_SWIPE_SLOP_PX) clearSceneChipTimer();
}

function onSceneChipPointerUp(event) {
  if (!sceneChipGesture || sceneChipGesture.pointerId !== event.pointerId) return;
  const gesture = sceneChipGesture;
  cancelSceneChipGesture();
  if (gesture.longPressFired) {
    event.preventDefault();
    return;
  }
  const dx = event.clientX - gesture.startX;
  const dy = event.clientY - gesture.startY;
  if (Math.abs(dx) >= SCENE_CHIP_SWIPE_PX && Math.abs(dy) <= SCENE_CHIP_SWIPE_SLOP_PX) {
    const direction = dx < 0 ? 'next' : 'prev';
    suppressSceneChipClickOnce();
    metrics.sceneChipSwipeCount++;
    recordSceneChipGesture(`swipe-${direction}`, { direction });
    stepScene(dx < 0 ? 1 : -1, { interactionType: `scene-chip-swipe-${direction}` });
    event.preventDefault();
  }
}

function cycleQuality() {
  const order = ['smooth', 'balanced'];
  const idx = order.indexOf(state.quality);
  const next = idx === -1 ? 'smooth' : order[(idx + 1) % order.length];
  setState({ quality: next }, {
    sync: false,
    syncSkipKind: 'quality-chip',
    interactionType: 'quality-chip',
    renderReason: 'quality-chip',
  });
  metrics.qualityChipSyncSkipCount++;
  metrics.lastQualityChipSyncSkipMs = performance.now();
  syncQualityControls();
  showStatus(`Quality: ${QUALITY[state.quality].label}`);
}

function scenePatchForTarget(target) {
  // Manual scene selection is a replacement operation. Keep global user
  // preferences and hidden E8-root choices, but clear active animation,
  // selection, and framing so A→B starts from a predictable camera state.
  return {
    modelMode: target.modelMode,
    shape: target.shape || DEFAULT_STATE.shape,
    polytope4d: target.polytope4d || DEFAULT_STATE.polytope4d,
    dynkinDiagram: target.dynkinDiagram || DEFAULT_STATE.dynkinDiagram,
    showVertices: DEFAULT_STATE.showVertices,
    autoRotate: false,
    autoZoom: false,
    autoExtrude: false,
    autoModel: false,
    autoColor: false,
    softFx: false,
    rotationSpeed: DEFAULT_STATE.rotationSpeed,
    rotation: 0,
    cameraTilt: DEFAULT_STATE.cameraTilt,
    cameraPath: 'manual',
    panX: 0,
    panY: 0,
    zoom: 1,
    selectedRoot: null,
  };
}

function sceneTargetSnapshot(index = currentAutoModelIndex(), target = state) {
  return {
    index,
    modelMode: target.modelMode ?? state.modelMode,
    shape: target.shape ?? state.shape,
    polytope4d: target.polytope4d ?? state.polytope4d,
    dynkinDiagram: target.dynkinDiagram ?? state.dynkinDiagram,
  };
}

function sceneStatusText() {
  const scene = activeSceneSummary();
  return `${scene.chipStrong} ${scene.chipSmall}`.trim();
}

function setScenePreset(targetOrIndex, options = {}) {
  let target = null;
  let targetIndex = -1;
  if (Number.isInteger(targetOrIndex)) {
    targetIndex = ((targetOrIndex % AUTO_MODEL_SEQUENCE.length) + AUTO_MODEL_SEQUENCE.length) % AUTO_MODEL_SEQUENCE.length;
    target = AUTO_MODEL_SEQUENCE[targetIndex];
  } else if (targetOrIndex && typeof targetOrIndex === 'object') {
    target = targetOrIndex;
    targetIndex = AUTO_MODEL_SEQUENCE.findIndex(candidate => {
      if (candidate.modelMode !== target.modelMode) return false;
      if (candidate.modelMode === 'platonic') return candidate.shape === target.shape;
      if (candidate.modelMode === 'poly4d') return candidate.polytope4d === target.polytope4d;
      if (candidate.modelMode === 'dynkin') return candidate.dynkinDiagram === target.dynkinDiagram;
      return true;
    });
  }
  if (!target || !SUPPORTED_MODEL_MODES.has(target.modelMode)) return getState();
  const interactionType = options.interactionType || 'model-target';
  if (mobileTourActive && !interactionType.startsWith('mobile-tour')) {
    stopMobileTour({ interactionType: 'mobile-tour-manual-stop', status: false });
  }
  const metricKind = options.metricKind || 'scene-chip';
  const previousAutoModel = state.autoModel;
  const result = setState(scenePatchForTarget(target), {
    sync: false,
    syncSkipKind: metricKind,
    interactionType,
    renderReason: interactionType,
  });
  autoModelIndex = currentAutoModelIndex();
  autoModelElapsed = 0;
  const snapshotIndex = targetIndex >= 0 ? targetIndex : autoModelIndex;
  const snapshot = sceneTargetSnapshot(snapshotIndex, state);
  if (metricKind === 'model-shortcut') {
    metrics.modelShortcutSelectCount++;
    metrics.modelShortcutSyncSkipCount++;
    metrics.lastModelShortcutId = options.modelShortcut?.id || null;
    metrics.lastModelShortcutLabel = options.modelShortcut ? modelShortcutLabel(options.modelShortcut) : sceneStatusText();
    metrics.lastModelShortcutGroup = options.modelShortcut?.group || null;
    metrics.lastModelShortcutTarget = snapshot;
    metrics.lastModelShortcutMs = performance.now();
  } else {
    metrics.sceneChipStepCount++;
    metrics.sceneChipSyncSkipCount++;
    metrics.lastSceneChipStepMs = performance.now();
    metrics.lastSceneChipIndex = snapshotIndex;
    metrics.lastSceneChipTarget = snapshot;
    metrics.lastSceneChipStoppedAutoModel = !!(previousAutoModel && !state.autoModel);
  }
  syncModelControls();
  // Scene replacement also clears color/motion presets and camera framing.
  // Keep those already-rendered controls truthful while the settings sheet is
  // open without paying for a full settings synchronization.
  syncFxPresetControls();
  syncMotionPresetControls();
  syncMotionSpeedControls();
  updateSelectionUI({ reason: interactionType });
  showStatus(`Scene: ${sceneStatusText()}`);
  return result;
}

function stepScene(direction = 1, options = {}) {
  const step = Number(direction) || 1;
  const current = currentAutoModelIndex();
  const next = current + step;
  const interactionType = options.interactionType || (step < 0 ? 'scene-chip-prev' : 'scene-chip-next');
  return setScenePreset(next, { ...options, interactionType });
}

function syncControls(reason = 'sync-controls') {
  metrics.controlSyncCount++;
  metrics.lastControlSyncMs = performance.now();
  metrics.lastControlSyncReason = reason;
  syncControlValues();
}

function syncControlValues() {
  syncQualityControls();
  syncModelControls();
  syncPaletteControls();
  els.highlightToggle.checked = state.highlightSubset;
  els.contextToggle.checked = state.showContext;
  els.petrieToggle.checked = state.showPetrie;
  els.mirrorsToggle.checked = state.showMirrors;
  els.edgesToggle.checked = state.showEdges;
  els.verticesToggle.checked = state.showVertices;
  syncSubsetControls();
  els.rootRange.value = String(state.selectedRoot ?? 0);
  els.rootOutput.textContent = state.selectedRoot == null ? 'None' : `#${state.selectedRoot}`;
  syncRootJumpControls();
  els.zoomOutput.textContent = `${Math.round(state.zoom * 100)}%`;
  syncVisualControls();
  els.ringsToggle.checked = state.showRings;
  syncFxPresetControls();
  syncMotionPresetControls();
  syncMotionSpeedControls();
  syncCameraControls();
  syncMobileTourCard();
  updateSelectionUI();
}

function syncModelControls() {
  if (els.modelSelect) els.modelSelect.value = state.modelMode;
  if (els.shapeSelect) els.shapeSelect.value = state.shape;
  if (els.polytope4DSelect) els.polytope4DSelect.value = state.polytope4d;
  if (els.dynkinSelect) els.dynkinSelect.value = state.dynkinDiagram;
  if (els.shapeField) els.shapeField.classList.toggle('hidden', state.modelMode !== 'platonic');
  if (els.polytope4DField) els.polytope4DField.classList.toggle('hidden', state.modelMode !== 'poly4d');
  if (els.dynkinField) els.dynkinField.classList.toggle('hidden', state.modelMode !== 'dynkin');
  if (els.sdfField) els.sdfField.classList.toggle('hidden', state.modelMode !== 'sdf');
  syncModelContextControls();
  syncSdfControls();
  syncBloomControls();
  if (els.autoModelToggle) els.autoModelToggle.checked = state.autoModel;
  syncModelShortcutControls();
  const scene = activeSceneSummary();
  if (els.sceneChip) {
    const strong = els.sceneChip.querySelector('strong');
    const small = els.sceneChip.querySelector('small');
    if (strong) strong.textContent = scene.chipStrong;
    if (small) small.textContent = scene.chipSmall;
  }
  syncSceneAccessibility(scene);
  syncMckayCard();
  syncCuriosityCard();
}

function modelContextVisible(context) {
  if (context === 'e8-roots') return state.modelMode === 'e8_2d' || state.modelMode === 'bloom';
  if (context === 'e8-only') return state.modelMode === 'e8_2d';
  if (context === 'vertex-models') return state.modelMode === 'platonic' || state.modelMode === 'poly4d';
  return true;
}

function syncModelContextControls() {
  for (const control of els.modelContextControls || []) {
    const visible = modelContextVisible(control.dataset.modelContext);
    control.hidden = !visible;
    control.setAttribute('aria-hidden', visible ? 'false' : 'true');
  }
  return true;
}

function syncSdfControls() {
  if (els.sdfRadius) els.sdfRadius.value = String(state.sdfSphereR);
  if (els.sdfRadiusOutput) els.sdfRadiusOutput.textContent = state.sdfSphereR.toFixed(3);
  if (els.sdfBlend) els.sdfBlend.value = String(state.sdfBlend);
  if (els.sdfBlendOutput) els.sdfBlendOutput.textContent = state.sdfBlend.toFixed(3);
  if (els.sdfBloom) els.sdfBloom.value = String(state.sdfBloom);
  if (els.sdfBloomOutput) els.sdfBloomOutput.textContent = `${Math.round(state.sdfBloom * 100)}%`;
  if (els.sdfAniso) els.sdfAniso.value = String(state.sdfAniso);
  if (els.sdfAnisoOutput) els.sdfAnisoOutput.textContent = `${Math.round(state.sdfAniso * 100)}%`;
  return true;
}

function bloomPhaseLabel(amount = state.bloomAmount) {
  if (amount < 0.1) return 'Shape';
  if (amount < 0.5) return '600-cell';
  if (amount < 0.75) return 'Twin H4';
  if (amount < 0.9) return 'Unfold';
  return 'Coxeter';
}

function syncBloomControls() {
  const active = state.modelMode === 'bloom';
  if (els.bloomTimelineField) els.bloomTimelineField.classList.toggle('hidden', !active);
  syncBloomRuntimeReadout();
  if (els.bloomAutoButton) {
    els.bloomAutoButton.textContent = state.bloomAuto ? 'Pause' : 'Auto';
    els.bloomAutoButton.classList.toggle('active', state.bloomAuto);
    els.bloomAutoButton.setAttribute('aria-pressed', String(state.bloomAuto));
  }
  if (els.bloomTwinButton) {
    els.bloomTwinButton.classList.toggle('active', state.bloomTwinH4);
    els.bloomTwinButton.setAttribute('aria-pressed', String(state.bloomTwinH4));
  }
  metrics.bloomTimelineSyncCount++;
  metrics.lastBloomTimelineSyncMs = performance.now();
  return active;
}

function syncBloomRuntimeReadout() {
  if (els.bloomTime) els.bloomTime.value = String(state.bloomAmount);
  if (els.bloomTimeOutput) els.bloomTimeOutput.textContent = state.bloomAmount.toFixed(2);
  if (els.bloomPhaseOutput) els.bloomPhaseOutput.textContent = bloomPhaseLabel();
  if (state.modelMode === 'bloom' && els.sceneChip) {
    const small = els.sceneChip.querySelector('small');
    if (small) small.textContent = `${bloomPhaseLabel()} / ${state.bloomAmount.toFixed(2)}`;
  }
}

function handleBloomAction(action) {
  if (action === 'toggle-auto') {
    return setManualRuntimeState({ bloomAuto: !state.bloomAuto }, 'bloom-auto-toggle', { syncBloom: true });
  }
  if (action === 'toggle-twin') {
    return setManualRuntimeState({ bloomTwinH4: !state.bloomTwinH4 }, 'bloom-twin-toggle', { syncBloom: true });
  }
  if (action === 'reset') {
    return setManualRuntimeState({ bloomAmount: 0, bloomAuto: false }, 'bloom-reset', { syncBloom: true });
  }
  return false;
}

function activeSceneSummary() {
  if (state.modelMode === 'platonic') {
    const shape = platonicGeometry[state.shape];
    const label = SHAPE_LABELS[state.shape] || state.shape;
    const family = STAR_SHAPES.has(state.shape) ? 'star polyhedron' : 'Platonic solid';
    const verts = shape?.verts?.length || 0;
    const edges = shape?.edges?.length || 0;
    const source = activeMckaySource();
    const info = mckayInfo[source] || {};
    const bridgeCopy = STAR_SHAPES.has(state.shape) ? 'its icosahedral symmetry' : 'this source';
    return {
      chipStrong: MODEL_LABELS.platonic,
      chipSmall: `${label} / ${verts}v`,
      topbarLabel: `${label} ${family}, ${verts} vertices, ${edges} edges`,
      canvasLabel: `${label} ${family} visualization with ${verts} vertices and ${edges} edges`,
      infoCopy: `${label} renders desktop ${family} geometry on the mobile Canvas 2D path. Drag to rotate, pinch to zoom, or enable Motion to inspect it; the McKay bridge links ${bridgeCopy} to ${info.roots || 'ADE roots'}.`,
    };
  }
  if (state.modelMode === 'poly4d') {
    const poly = polytope4DGeometry[state.polytope4d];
    const label = POLYTOPE4D_LABELS[state.polytope4d] || state.polytope4d;
    const verts = poly?.verts?.length || 0;
    const edges = poly?.edges?.length || 0;
    return {
      chipStrong: MODEL_LABELS.poly4d,
      chipSmall: `${label} / ${verts}v`,
      topbarLabel: `${label} 4D polytope, ${verts} vertices, ${edges} edges`,
      canvasLabel: `${label} 4D polytope projection with ${verts} vertices and ${edges} edges`,
      infoCopy: `${label} is projected from 4D into a depth view and then drawn with Canvas 2D. Drag to rotate, pinch to zoom, or enable Motion to animate the projection.`,
    };
  }
  if (state.modelMode === 'dynkin') {
    const diagram = dynkinGeometry[state.dynkinDiagram];
    const label = DYNKIN_LABELS[state.dynkinDiagram] || state.dynkinDiagram;
    const nodes = diagram?.nodes?.length || 0;
    const edges = diagram?.edges?.length || 0;
    const action = state.dynkinDiagram === 'E8'
      ? 'Tap an E8 node to select the matching simple-root context.'
      : 'Use it as a compact Cartan-structure reference.';
    return {
      chipStrong: MODEL_LABELS.dynkin,
      chipSmall: `${label} / ${nodes} nodes`,
      topbarLabel: `${label} Dynkin diagram, ${nodes} simple roots, ${edges} Cartan edges`,
      canvasLabel: `${label} Dynkin diagram visualization with ${nodes} simple roots and ${edges} Cartan edges`,
      infoCopy: `${label} shows simple roots as nodes and Cartan dot -1 relationships as edges. ${action}`,
    };
  }
  if (state.modelMode === 'bloom') {
    return {
      chipStrong: MODEL_LABELS.bloom,
      chipSmall: `${bloomPhaseLabel()} / ${state.bloomAmount.toFixed(2)}`,
      topbarLabel: `Designed Bloom timeline at ${state.bloomAmount.toFixed(2)}, ${bloomPhaseLabel()} phase`,
      canvasLabel: `Designed Bloom visualization in the ${bloomPhaseLabel()} phase`,
      infoCopy: 'Designed Bloom follows the desktop construction: the source solid grows through the 600-cell and twin H4 stages, then opens into the E8 Coxeter plane. Drag to rotate, or open View to scrub the timeline or start Auto.',
    };
  }
  if (state.modelMode === 'sdf') {
    return {
      chipStrong: MODEL_LABELS.sdf,
      chipSmall: 'implicit surface',
      topbarLabel: 'E8 SDF, 240 smoothly joined root spheres',
      canvasLabel: 'E8 signed-distance-field visualization with 240 fused Coxeter-plane root spheres',
      infoCopy: 'The SDF view smoothly joins all 240 Coxeter-plane root spheres into one shaded implicit surface. Drag to rotate and tilt it; pinch to zoom. It preserves the desktop raymarcher composition at a conservative internal resolution for phone performance.',
    };
  }
  return {
    chipStrong: MODEL_LABELS.e8_2d,
    chipSmall: '240 / 8 rings',
    topbarLabel: 'E8 Coxeter, 240 roots, 8 rings',
    canvasLabel: 'E8 Coxeter plane visualization with 240 roots on 8 rings',
    infoCopy: 'The 240 E8 root vectors are projected onto the Coxeter plane, forming eight concentric rings of 30 roots. Tap any point to inspect its ring, McKay membership, 8D coordinates, Cartan neighbor context, opposite root, and optional Petrie or Weyl mirror context.',
  };
}

function syncSceneAccessibility(scene) {
  if (!scene) return;
  const chipLabel = `Scene: ${scene.topbarLabel}. Tap to switch.`;
  if (els.shell) els.shell.setAttribute('aria-label', scene.topbarLabel);
  if (els.sceneChip?.parentElement) els.sceneChip.parentElement.setAttribute('aria-label', scene.topbarLabel);
  if (els.sceneChip) els.sceneChip.setAttribute('aria-label', chipLabel);
  if (canvas) canvas.setAttribute('aria-label', scene.canvasLabel);
  if (els.infoCopy) els.infoCopy.textContent = scene.infoCopy;
  metrics.sceneLabelSyncCount++;
  metrics.lastSceneLabel = scene.topbarLabel;
  metrics.lastCanvasLabel = scene.canvasLabel;
  metrics.lastSceneChipLabel = chipLabel;
  metrics.lastInfoCopy = scene.infoCopy;
  metrics.lastSceneLabelMs = performance.now();
}

function activeMckaySource() {
  if (state.modelMode === 'platonic' && STAR_SHAPES.has(state.shape)) return 'icosahedron';
  if (state.modelMode === 'platonic' && mckayInfo[state.shape]) return state.shape;
  if (state.modelMode === 'dynkin') {
    if (state.dynkinDiagram === 'E6') return 'tetrahedron';
    if (state.dynkinDiagram === 'E7') return 'cube';
    if (state.dynkinDiagram === 'E8') return 'icosahedron';
  }
  if (state.modelMode === 'poly4d' && (state.polytope4d === '600cell' || state.polytope4d === '120cell')) return 'icosahedron';
  if (mckayInfo[state.subset]) return state.subset;
  if (mckayInfo[state.shape]) return state.shape;
  return 'icosahedron';
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function syncMckayCard() {
  if (!els.mckayCard) return false;
  const source = activeMckaySource();
  const info = mckayInfo[source];
  if (!info) {
    els.mckayCard.textContent = 'McKay bridge unavailable.';
    return false;
  }
  const subset = data?.mckay_subsets?.[source] || [];
  const sourceLabel = SHAPE_LABELS[source] || source;
  const subsetText = subset.length ? `${subset.length} illustrative E8 highlights` : 'No illustrative E8 highlight subset in mobile yet';
  metrics.mckayInfoSyncCount++;
  metrics.lastMckaySource = source;
  metrics.lastMckayRoots = info.roots || null;
  metrics.lastMckaySymmetry = info.symmetry || null;
  metrics.lastMckayInfoMs = performance.now();
  els.mckayCard.innerHTML = `<strong>McKay bridge</strong><small>${escapeHtml(sourceLabel)}: binary symmetry ${escapeHtml(info.symmetry)} -&gt; ${escapeHtml(info.roots)}</small><small>${escapeHtml(info.description)}</small><small>${escapeHtml(subsetText)}</small>`;
  return true;
}

function activeCuriosityKey() {
  const selected = state.selectedRoot == null ? 'none' : 'root';
  return `${state.modelMode}|${state.shape}|${state.polytope4d}|${state.dynkinDiagram}|${state.subset}|${selected}`;
}

function activeCuriosityNotes() {
  const source = activeMckaySource();
  const info = mckayInfo[source] || {};
  const sourceLabel = SHAPE_LABELS[source] || source;
  const notes = [];
  if (state.selectedRoot != null && selectedContext) {
    notes.push({
      title: 'Root neighborhood',
      body: `Root #${state.selectedRoot} has ${selectedContext.neighborCount} Cartan-edge neighbors.`,
      detail: 'Near steps through the local graph; Opp jumps to the antipode.',
    });
  }
  if (state.modelMode === 'e8_2d') {
    notes.push({
      title: 'Coxeter plane',
      body: 'The 240 E8 roots land in eight rings of 30 in this projection.',
      detail: 'Petrie and mirror overlays expose different slices of the same root system.',
    });
  } else if (state.modelMode === 'bloom') {
    notes.push({
      title: 'Designed Bloom',
      body: 'A source solid grows through a 600-cell, gains its twin H4 layer, then unfolds into all 240 E8 roots.',
      detail: 'Open View to scrub the construction, pause it, or compare the warm and cool H4 layers.',
    });
  } else if (state.modelMode === 'sdf') {
    notes.push({
      title: 'Distance field',
      body: 'The 240 Coxeter roots blend into a continuously shaded implicit surface rather than another point rendering.',
      detail: 'A compact height field mirrors the desktop sphere union while remaining responsive.',
    });
  } else if (state.modelMode === 'platonic') {
    notes.push({
      title: 'Platonic source',
      body: `${SHAPE_LABELS[state.shape] || state.shape} is the active symmetry source.`,
      detail: `${sourceLabel} points toward ${info.roots || 'ADE roots'} through binary ${info.symmetry || 'symmetry'}.`,
    });
  } else if (state.modelMode === 'poly4d') {
    const poly = polytope4DGeometry[state.polytope4d];
    notes.push({
      title: '4D projection',
      body: `${POLYTOPE4D_LABELS[state.polytope4d] || state.polytope4d} is projected from 4D into depth, then onto canvas.`,
      detail: `${poly?.verts?.length || 0} vertices and ${poly?.edges?.length || 0} edges stay on the Canvas 2D path.`,
    });
  } else if (state.modelMode === 'dynkin') {
    notes.push({
      title: 'Dynkin graph',
      body: `${DYNKIN_LABELS[state.dynkinDiagram] || state.dynkinDiagram} edges encode Cartan dot -1 relationships.`,
      detail: 'In E8, tapping a node selects the matching simple root.',
    });
  }
  notes.push({
    title: 'McKay lens',
    body: `${sourceLabel} links binary symmetry ${info.symmetry || '?'} to ${info.roots || 'ADE roots'}.`,
    detail: 'The bridge explains why Platonic solids, Dynkin diagrams, and E8 belong together.',
  });
  return notes.length ? notes : [CURIOSITY_FALLBACK];
}

function syncCuriosityCard(options = {}) {
  if (!els.curiosityCard) return false;
  const key = activeCuriosityKey();
  const notes = activeCuriosityNotes();
  if (key !== curiosityKey) {
    curiosityKey = key;
    curiosityIndex = 0;
  }
  if (options.advance) curiosityIndex = (curiosityIndex + 1) % notes.length;
  curiosityIndex = Math.max(0, Math.min(curiosityIndex, notes.length - 1));
  const note = notes[curiosityIndex] || CURIOSITY_FALLBACK;
  metrics.curiositySyncCount++;
  metrics.lastCuriosityKey = key;
  metrics.lastCuriosityTitle = note.title;
  metrics.lastCuriosityIndex = curiosityIndex;
  metrics.lastCuriosityMs = performance.now();
  const counter = notes.length > 1 ? `${curiosityIndex + 1}/${notes.length}` : '1/1';
  els.curiosityCard.innerHTML = `<div><strong>${escapeHtml(note.title)}</strong><small>${escapeHtml(note.body)}</small><small>${escapeHtml(note.detail)}</small></div><button id="curiosity-next" type="button" data-info-action="next-curiosity" aria-label="Next context note">Next ${escapeHtml(counter)}</button>`;
  return true;
}

function nextCuriosity() {
  markInteraction('next-curiosity');
  metrics.curiosityNextCount++;
  const updated = syncCuriosityCard({ advance: true });
  if (updated) showStatus('Context updated');
  return updated;
}

function learnTopicById(id) {
  return LEARN_TOPICS.find(topic => topic.id === id) || LEARN_TOPICS[0];
}

function sceneLearnTopicId() {
  if (state.modelMode === 'bloom') return 'designed-bloom';
  if (state.modelMode === 'sdf') return 'distance-fields';
  if (state.modelMode === 'platonic') return 'why-five-solids';
  if (state.modelMode === 'poly4d') return 'into-four-dimensions';
  if (state.modelMode === 'dynkin') return 'roots-reflections';
  return 'coxeter-plane';
}

function activeLearnTopicId() {
  return state.learnTopic === 'auto' ? sceneLearnTopicId() : state.learnTopic;
}

function renderLearnTopics() {
  if (!els.learnTopicGrid) return false;
  els.learnTopicGrid.innerHTML = LEARN_TOPICS.map(topic => (
    `<button type="button" data-learn-topic="${escapeHtml(topic.id)}" aria-label="${escapeHtml(topic.name)} learn topic">${escapeHtml(topic.label)}</button>`
  )).join('');
  metrics.learnTopicButtonCount = LEARN_TOPICS.length;
  return true;
}

function learnTopicRecord(id) {
  const topic = learnTopicById(id);
  if (topic.lesson) {
    const lesson = topic.lesson;
    const path = curriculumPaths.find(item => item.id === lesson.pathId);
    const readingCount = lesson.readings?.length || 0;
    const sourceCount = lesson.sources?.length || 0;
    const sourceDetail = sourceCount
      ? `${sourceCount} scoped source${sourceCount === 1 ? '' : 's'}: ${lesson.sources.map(source => source.author).join('; ')}.`
      : 'Rendering or app-designed lesson; source expansion is still under review.';
    const selectedDetail = lesson.id === 'roots-reflections' && state.selectedRoot != null
      ? ` Selected root #${state.selectedRoot} is available in the root drawer.`
      : '';
    const claimLabels = {
      'established-mathematics': 'Established mathematics',
      interpretation: 'Interpretation',
      'app-designed-visualization': 'App-designed visualization',
      'rendering-technique': 'Rendering technique',
    };
    return {
      ...topic,
      title: lesson.title,
      body: path?.description || 'Shared E8 Studio curriculum lesson.',
      detail: `${claimLabels[lesson.claimType] || lesson.claimType}: ${lesson.claimNote} ${readingCount} reading${readingCount === 1 ? '' : 's'} · ${lesson.quiz?.title || 'quiz'}. ${sourceDetail}${selectedDetail}`,
    };
  }
  const source = activeMckaySource();
  const info = mckayInfo[source] || {};
  const sourceLabel = SHAPE_LABELS[source] || source;
  if (id === 'e8') {
    const context = getSelectedContext();
    const point = state.selectedRoot == null ? null : points[state.selectedRoot];
    const selectedDetail = context && point
      ? `Selected root #${state.selectedRoot}: ring ${point.ring}, ${context.neighborCount} Cartan neighbors, opposite #${context.antipode}.`
      : 'Tap a root or use Jumps to inspect rings, Cartan neighbors, antipodes, and 8D coordinates.';
    return {
      ...topic,
      title: 'E8 roots',
      body: 'E8 has 240 roots in rank 8. The mobile renderer shows the same root data in 2D Coxeter and lightweight depth views.',
      detail: selectedDetail,
    };
  }
  if (id === 'solids') {
    const shapeName = SUPPORTED_SHAPES.has(state.shape) ? state.shape : DEFAULT_STATE.shape;
    const shape = platonicGeometry[shapeName] || {};
    const label = SHAPE_LABELS[shapeName] || shapeName;
    const bridge = mckayInfo[shapeName] || info;
    return {
      ...topic,
      title: 'Platonic solids',
      body: 'The five regular solids are the 3D symmetry doorway into the McKay story.',
      detail: `${label}: ${shape.verts?.length || 0} vertices, ${shape.edges?.length || 0} edges. Binary ${bridge.symmetry || 'symmetry'} points toward ${bridge.roots || 'ADE roots'}.`,
    };
  }
  if (id === 'mckay') {
    const subset = data?.mckay_subsets?.[source] || [];
    return {
      ...topic,
      title: 'McKay bridge',
      body: `${sourceLabel} links binary symmetry ${info.symmetry || '?'} to ${info.roots || 'ADE roots'}.`,
      detail: subset.length
        ? `${subset.length} E8 roots are highlighted for this source. Switch sources in View to compare the bridge.`
        : 'Use a Platonic source, E8 subset, or E6/E7/E8 Dynkin diagram to see the correspondence.',
    };
  }
  if (id === 'poly4d') {
    const polyName = SUPPORTED_POLYTOPES4D.has(state.polytope4d) ? state.polytope4d : DEFAULT_STATE.polytope4d;
    const poly = polytope4DGeometry[polyName] || {};
    const label = POLYTOPE4D_LABELS[polyName] || polyName;
    return {
      ...topic,
      title: '4D polytopes',
      body: 'Mobile V2 projects regular 4D polytopes through a depth cue, then draws them with Canvas 2D.',
      detail: `${label}: ${poly.verts?.length || 0} vertices and ${poly.edges?.length || 0} edges. Motion rotates the projection without enabling a heavy WebGL path.`,
    };
  }
  if (id === 'dynkin') {
    const diagramName = SUPPORTED_DYNKIN_DIAGRAMS.has(state.dynkinDiagram) ? state.dynkinDiagram : DEFAULT_STATE.dynkinDiagram;
    const diagram = dynkinGeometry[diagramName] || {};
    const selected = selectedContext?.simpleRootLabel ? ` Current E8 node: ${selectedContext.simpleRootLabel}.` : '';
    return {
      ...topic,
      title: 'Dynkin diagrams',
      body: 'Dynkin nodes are simple roots; edges mark Cartan dot -1 relationships.',
      detail: `${diagramName}: ${diagram.nodes?.length || 0} nodes and ${diagram.edges?.length || 0} edges.${selected}`,
    };
  }
  return {
    ...topic,
    title: 'Mobile Learn',
    body: 'Pick a compact topic or leave Auto on to follow the active scene.',
    detail: 'The canvas stays clear; Learn lives only in the Info sheet.',
  };
}

function syncLearnPanel() {
  if (!els.learnTopicCard) return false;
  const activeId = activeLearnTopicId();
  const record = learnTopicRecord(activeId);
  const configured = state.learnTopic;
  if (els.learnTopicOutput) {
    els.learnTopicOutput.textContent = configured === 'auto' ? `Auto: ${record.label}` : record.label;
  }
  if (els.learnTopicGrid) {
    els.learnTopicGrid.querySelectorAll('[data-learn-topic]').forEach(button => {
      const isConfigured = button.dataset.learnTopic === configured;
      const isEffective = configured === 'auto' && button.dataset.learnTopic === activeId;
      button.classList.toggle('active', isConfigured);
      button.classList.toggle('effective', isEffective);
      button.setAttribute('aria-pressed', isConfigured ? 'true' : 'false');
    });
  }
  const lessonComplete = !!learningProgress.lessons?.[activeId];
  els.learnTopicCard.innerHTML = `<strong>${escapeHtml(record.title)}</strong><small>${escapeHtml(record.body)}</small><small>${escapeHtml(record.detail)}</small><div class="learn-topic-foot"><button type="button" data-info-action="toggle-lesson-complete" aria-pressed="${lessonComplete}">${lessonComplete ? 'Completed' : 'Mark complete'}</button><button id="learn-topic-next" type="button" data-info-action="next-learn-topic" aria-label="Next learn topic">Next</button></div>`;
  metrics.learnTopicSyncCount++;
  metrics.lastLearnTopic = activeId;
  metrics.lastLearnTopicConfigured = configured;
  metrics.lastLearnTopicTitle = record.title;
  metrics.lastLearnTopicMs = performance.now();
  return true;
}

function selectLearnTopic(id, options = {}) {
  if (!LEARN_TOPIC_IDS.has(id)) return false;
  const interactionType = options.interactionType || `learn-topic-${id}`;
  markInteraction(interactionType);
  if (state.learnTopic === id) {
    metrics.learnTopicNoopCount++;
    syncLearnPanel();
    return getState();
  }
  state.learnTopic = id;
  saveState();
  metrics.learnTopicSelectCount++;
  syncLearnPanel();
  showStatus(`Learn: ${learnTopicById(activeLearnTopicId()).label}`);
  return getState();
}

function nextLearnTopic() {
  const activeId = activeLearnTopicId();
  const index = LEARN_TOPIC_CYCLE.findIndex(topic => topic.id === activeId);
  const next = LEARN_TOPIC_CYCLE[(index + 1 + LEARN_TOPIC_CYCLE.length) % LEARN_TOPIC_CYCLE.length] || LEARN_TOPIC_CYCLE[0];
  metrics.learnTopicNextCount++;
  return selectLearnTopic(next.id, { interactionType: 'next-learn-topic' });
}

function mobileTourStepAt(index = mobileTourIndex) {
  const count = MOBILE_TOUR_STEPS.length;
  const numeric = Number.isFinite(Number(index)) ? Number(index) : 0;
  const safeIndex = ((Math.trunc(numeric) % count) + count) % count;
  return { ...MOBILE_TOUR_STEPS[safeIndex], index: safeIndex };
}

function mobileTourTargetSnapshot(step = mobileTourStepAt()) {
  const target = step.target || {};
  return {
    modelMode: target.modelMode || null,
    shape: target.shape || null,
    polytope4d: target.polytope4d || null,
    dynkinDiagram: target.dynkinDiagram || null,
  };
}

function mobileTourPatchForTarget(target) {
  return {
    ...scenePatchForTarget(target),
    autoRotate: false,
    autoModel: false,
    autoColor: false,
    softFx: false,
    fxMode: DEFAULT_STATE.fxMode,
    bloomAuto: false,
  };
}

function getMobileTourState() {
  const step = mobileTourStepAt();
  return {
    active: mobileTourActive,
    timerActive: !!mobileTourTimer,
    pausedForSettings: mobileTourPausedForSettings,
    index: step.index,
    count: MOBILE_TOUR_STEPS.length,
    intervalMs: MOBILE_TOUR_INTERVAL_MS,
    step: {
      id: step.id,
      label: step.label,
      title: step.title,
      target: { ...step.target },
    },
  };
}

function syncMobileTourCard() {
  if (!els.mobileTourCard) return false;
  const step = mobileTourStepAt();
  const total = MOBILE_TOUR_STEPS.length;
  if (els.mobileTourOutput) els.mobileTourOutput.textContent = mobileTourPausedForSettings ? 'Paused' : mobileTourActive ? 'Running' : 'Ready';
  if (els.mobileTourStepOutput) els.mobileTourStepOutput.textContent = `${step.index + 1}/${total}`;
  if (els.mobileTourCopy) {
    els.mobileTourCopy.innerHTML = `<strong>${escapeHtml(step.title)}</strong><small>${escapeHtml(step.body)}</small><small>${escapeHtml(step.detail)}</small>`;
  }
  if (els.mobileTourToggle) {
    els.mobileTourToggle.textContent = mobileTourActive ? 'Stop' : 'Start';
    els.mobileTourToggle.setAttribute('aria-pressed', mobileTourActive ? 'true' : 'false');
  }
  for (const button of [els.mobileTourPrev, els.mobileTourNext]) {
    if (!button) continue;
    button.disabled = !mobileTourActive;
    button.setAttribute('aria-disabled', mobileTourActive ? 'false' : 'true');
  }
  metrics.mobileTourButtonCount = 3;
  metrics.mobileTourSyncCount++;
  metrics.lastMobileTourStep = step.index;
  metrics.lastMobileTourStepId = step.id;
  metrics.lastMobileTourLabel = step.label;
  metrics.lastMobileTourTitle = step.title;
  metrics.lastMobileTourTarget = mobileTourTargetSnapshot(step);
  metrics.lastMobileTourMs = performance.now();
  return true;
}

function clearMobileTourTimer() {
  if (!mobileTourTimer) return false;
  clearTimeout(mobileTourTimer);
  mobileTourTimer = null;
  return true;
}

function pauseMobileTourForSettings(reason = 'settings-open') {
  if (!mobileTourActive) {
    mobileTourPausedForSettings = false;
    return false;
  }
  const hadTimer = clearMobileTourTimer();
  if (!mobileTourPausedForSettings) {
    metrics.mobileTourPauseCount++;
    metrics.lastMobileTourPauseReason = reason;
    metrics.lastMobileTourMs = performance.now();
  }
  mobileTourPausedForSettings = true;
  syncMobileTourCard();
  return hadTimer;
}

function scheduleMobileTour() {
  clearMobileTourTimer();
  if (!mobileTourActive) {
    mobileTourPausedForSettings = false;
    return false;
  }
  if (isSettingsOpen()) {
    pauseMobileTourForSettings('settings-open');
    return false;
  }
  mobileTourPausedForSettings = false;
  mobileTourTimer = setTimeout(() => {
    mobileTourTimer = null;
    nextMobileTourStep({ auto: true });
  }, MOBILE_TOUR_INTERVAL_MS);
  return true;
}

function resumeMobileTourAfterSettings(reason = 'settings-close') {
  if (!mobileTourActive || !mobileTourPausedForSettings || isSettingsOpen()) return false;
  mobileTourPausedForSettings = false;
  metrics.mobileTourResumeCount++;
  metrics.lastMobileTourResumeReason = reason;
  metrics.lastMobileTourMs = performance.now();
  scheduleMobileTour();
  syncMobileTourCard();
  return true;
}

function applyMobileTourStep(index, options = {}) {
  const step = mobileTourStepAt(index);
  mobileTourIndex = step.index;
  const interactionType = options.interactionType || 'mobile-tour-step';
  const result = setState(mobileTourPatchForTarget(step.target), {
    save: false,
    sync: false,
    syncSkipKind: 'mobile-tour',
    interactionType,
    renderReason: interactionType,
  });
  autoModelIndex = currentAutoModelIndex();
  autoModelElapsed = 0;
  metrics.mobileTourStepCount++;
  metrics.lastMobileTourAction = interactionType;
  metrics.lastMobileTourMs = performance.now();
  syncModelControls();
  syncFxModeControls();
  updateSelectionUI({ reason: interactionType });
  syncMobileTourCard();
  if (options.status !== false) showStatus(`Tour: ${step.label}`);
  return result;
}

function startMobileTour(options = {}) {
  if (mobileTourActive) {
    metrics.mobileTourNoopCount++;
    syncMobileTourCard();
    return getMobileTourState();
  }
  if (savePending) flushSave();
  mobileTourStorageBaseState = getState();
  clearTapMemory();
  mobileTourActive = true;
  mobileTourPausedForSettings = false;
  metrics.mobileTourStartCount++;
  metrics.lastMobileTourAction = 'mobile-tour-start';
  metrics.lastMobileTourMs = performance.now();
  if (options.closeSettings !== false && isSettingsOpen()) closeSettings();
  applyMobileTourStep(options.index ?? 0, {
    interactionType: 'mobile-tour-start',
    status: options.status,
  });
  if (options.schedule !== false) scheduleMobileTour();
  return getMobileTourState();
}

function stopMobileTour(options = {}) {
  const wasActive = mobileTourActive || !!mobileTourTimer;
  clearMobileTourTimer();
  mobileTourPausedForSettings = false;
  if (!wasActive) {
    if (options.countNoop) metrics.mobileTourNoopCount++;
    syncMobileTourCard();
    return false;
  }
  mobileTourActive = false;
  const interactionType = options.interactionType || 'mobile-tour-stop';
  markInteraction(interactionType);
  metrics.mobileTourStopCount++;
  metrics.lastMobileTourAction = interactionType;
  metrics.lastMobileTourMs = performance.now();
  if (savePending) flushSave();
  mobileTourStorageBaseState = null;
  syncMobileTourCard();
  if (options.status !== false) showStatus('Tour stopped');
  return getMobileTourState();
}

function stepMobileTour(direction = 1, options = {}) {
  const step = Number(direction) || 1;
  if (!mobileTourActive && !options.allowInactive) {
    metrics.mobileTourInactiveStepBlockedCount++;
    metrics.lastMobileTourAction = step < 0 ? 'mobile-tour-prev-blocked' : 'mobile-tour-next-blocked';
    metrics.lastMobileTourMs = performance.now();
    syncMobileTourCard();
    return false;
  }
  if (options.auto) metrics.mobileTourAutoStepCount++;
  else if (step < 0) metrics.mobileTourPrevCount++;
  else metrics.mobileTourNextCount++;
  clearMobileTourTimer();
  const interactionType = options.interactionType
    || (options.auto ? 'mobile-tour-auto-step' : step < 0 ? 'mobile-tour-prev' : 'mobile-tour-next');
  applyMobileTourStep(mobileTourIndex + step, {
    interactionType,
    status: options.status,
  });
  if (mobileTourActive && options.schedule !== false) scheduleMobileTour();
  return getMobileTourState();
}

function nextMobileTourStep(options = {}) {
  return stepMobileTour(1, options);
}

function previousMobileTourStep(options = {}) {
  return stepMobileTour(-1, options);
}

function toggleMobileTour(options = {}) {
  return mobileTourActive ? stopMobileTour(options) : startMobileTour(options);
}

function syncQualityControls() {
  els.qualityChip.textContent = QUALITY[state.quality].label;
  els.qualityButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.quality === state.quality);
  });
}

function syncSubsetControls() {
  els.subsetSelect.value = state.subset;
  els.subsetOutput.textContent = subsetStatusText();
  syncSubsetChipControls();
  syncMckayCard();
  syncCuriosityCard();
  syncLearnPanel();
  metrics.subsetControlSyncCount++;
  metrics.lastSubsetControlSyncMs = performance.now();
}

function openSettings(section = 'view') {
  const target = SETTINGS_SECTIONS.has(section) ? section : 'view';
  const wasOpen = isSettingsOpen();
  cancelQueuedRenderForSettings('settings-open');
  if (wasOpen) {
    metrics.settingsTabSyncSkipCount++;
    metrics.lastSettingsTabSyncSkip = target;
    metrics.lastSettingsTabSyncSkipMs = performance.now();
  }
  else {
    syncControls('settings-open');
  }
  els.sheet.classList.remove('hidden');
  els.settingsButton.setAttribute('aria-expanded', 'true');
  applySettingsSection(target);
  pauseMobileTourForSettings('settings-open');
  syncMotionLoop();
}

function activeSettingsSection() {
  return els.sectionPanels?.find(panel => panel.classList.contains('active'))?.dataset.section || null;
}

function applySettingsSection(target) {
  const current = activeSettingsSection();
  metrics.lastSettingsSectionSwitch = target;
  metrics.lastSettingsSectionSwitchMs = performance.now();
  if (current === target) {
    metrics.settingsSectionSwitchSkipCount++;
    if (els.sheetBody) els.sheetBody.scrollTop = 0;
    return false;
  }
  els.sectionTabs.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sectionTab === target);
  });
  els.sectionPanels.forEach(panel => {
    panel.classList.toggle('active', panel.dataset.section === target);
  });
  metrics.settingsSectionSwitchCount++;
  if (els.sheetBody) els.sheetBody.scrollTop = 0;
  return true;
}

function closeSettings(interactionType = null) {
  const wasOpen = isSettingsOpen();
  els.sheet.classList.add('hidden');
  els.settingsButton.setAttribute('aria-expanded', 'false');
  if (wasOpen && interactionType) markInteraction(interactionType);
  if (selectionUiDetailsDeferred) updateSelectionUI({ reason: 'settings-close-flush' });
  flushDeferredSettingsRender();
  resumeMobileTourAfterSettings(interactionType || 'settings-close');
  syncMotionLoop();
  return wasOpen;
}

function handleBackNavigation() {
  clearTapMemory();
  if (isSettingsOpen()) {
    const closed = closeSettings('back-close-settings');
    if (closed) showStatus('Settings closed');
    return closed;
  }
  if (mobileTourActive) return !!stopMobileTour({ interactionType: 'back-stop-tour' });
  if (state.selectedRoot != null && rootDrawerExpanded) return setRootDrawerExpanded(false, 'back-collapse-drawer');
  if (state.selectedRoot != null) return clearSelection('back-clear-selection');
  return false;
}

function installNativeBackHandler() {
  const app = window.Capacitor?.Plugins?.App;
  if (!app || typeof app.addListener !== 'function') return false;
  try {
    const listener = app.addListener('backButton', () => {
      if (handleBackNavigation()) return;
      if (typeof app.exitApp === 'function') app.exitApp();
    });
    if (listener && typeof listener.catch === 'function') listener.catch(recordError);
    nativeBackHandlerInstalled = true;
    return true;
  } catch (error) {
    recordError(error);
    return false;
  }
}

function handleViewportChange() {
  const hadInput = resetInputState('viewport-change');
  metrics.viewportChangeCount++;
  metrics.lastViewportChangeMs = performance.now();
  syncControls();
  const allRootsWereFramed = metrics.lastAllFrameWithinView === true || metrics.lastInteractionType === 'fit-all' || metrics.lastInteractionType === 'viewport-fit-all';
  if (!hadInput && allRootsWereFramed && allRootList.length) {
    const fitted = fitAllRoots('viewport-fit-all', { save: false, silentStatus: true });
    if (fitted) {
      metrics.viewportFitCount++;
      metrics.lastViewportFitMs = performance.now();
      return;
    }
  }
  requestRender('viewport-change');
}

function renderScale() {
  const q = QUALITY[state.quality] || QUALITY.smooth;
  const scale = typeof q.scale === 'function' ? q.scale() : q.scale;
  // The SDF's continuous shading exposes upscaling artifacts far more than
  // points or wireframes do. Keep it at a full CSS-pixel backing store even
  // in Smooth mode; its own raster still follows the selected quality tier.
  if (state.modelMode === 'sdf') return Math.max(1, scale);
  // Smooth mode intentionally uses a small backing store, but sub-pixel
  // Coxeter chords become visibly stair-stepped when magnified.  Raise the
  // floor only for close E8 edge inspection; interaction frames already skip
  // the dense edge graph, so pinch gestures remain responsive.
  if (state.modelMode === 'e8_2d' && state.showEdges && state.zoom > 1.15) {
    return Math.max(1, scale);
  }
  return scale;
}

function activePaletteSet() {
  if (!state.autoColor) return RENDER_PALETTES[state.palette] || RENDER_PALETTES.gold;
  const names = Object.keys(RENDER_PALETTES);
  const offset = Math.floor(stylePhase) % names.length;
  const base = Math.max(0, names.indexOf(state.palette));
  return RENDER_PALETTES[names[(base + offset) % names.length]] || RENDER_PALETTES.gold;
}

function resizeCanvas() {
  const scale = renderScale();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const w = Math.max(1, Math.round(viewportWidth * scale));
  const h = Math.max(1, Math.round(viewportHeight * scale));
  let backingStoreChanged = false;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    backgroundCanvas.width = w;
    backgroundCanvas.height = h;
    backingStoreChanged = true;
    canvasTransformScale = null;
    metrics.canvasResizeCount++;
    metrics.lastCanvasResizeMs = performance.now();
    metrics.lastCanvasResizeScale = scale;
    metrics.lastCanvasResizeWidth = w;
    metrics.lastCanvasResizeHeight = h;
  }
  if (canvasCssWidth !== viewportWidth || canvasCssHeight !== viewportHeight) {
    canvas.style.width = `${viewportWidth}px`;
    canvas.style.height = `${viewportHeight}px`;
    backgroundCanvas.style.width = `${viewportWidth}px`;
    backgroundCanvas.style.height = `${viewportHeight}px`;
    canvasCssWidth = viewportWidth;
    canvasCssHeight = viewportHeight;
    metrics.canvasStyleSyncCount++;
    metrics.lastCanvasStyleSyncMs = performance.now();
    metrics.lastCanvasStyleWidth = viewportWidth;
    metrics.lastCanvasStyleHeight = viewportHeight;
  }
  else {
    metrics.canvasStyleSyncSkipCount++;
  }
  metrics.renderScale = scale;
  settingsCanvasResizeDeferred = false;
  if (backingStoreChanged || canvasTransformScale !== scale) {
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    backgroundCtx.setTransform(scale, 0, 0, scale, 0, 0);
    canvasTransformScale = scale;
    metrics.canvasTransformSetCount++;
    metrics.lastCanvasTransformSetMs = performance.now();
    metrics.lastCanvasTransformScale = scale;
  }
  else {
    metrics.canvasTransformSkipCount++;
  }
}

function deferSettingsCanvasResize() {
  settingsCanvasResizeDeferred = true;
  metrics.settingsCanvasResizeDeferredCount++;
  metrics.lastSettingsCanvasResizeDeferredMs = performance.now();
  metrics.lastSettingsCanvasResizeDeferredScale = renderScale();
  return false;
}

function buildMobileE8ChordEdges(roots) {
  if (!Array.isArray(roots) || roots.length < 2) return [];
  const edges = [];
  for (let i = 0; i < roots.length; i++) {
    const a = roots[i];
    if (!Array.isArray(a)) continue;
    for (let j = i + 1; j < roots.length; j++) {
      const b = roots[j];
      if (!Array.isArray(b)) continue;
      let distanceSquared = 0;
      for (let axis = 0; axis < Math.min(a.length, b.length); axis++) {
        const delta = a[axis] - b[axis];
        distanceSquared += delta * delta;
      }
      if (Math.abs(distanceSquared - MOBILE_E8_CHORD_DISTANCE_SQUARED) < 0.01) {
        edges.push([i, j]);
      }
    }
  }
  return edges;
}

function preparePoints() {
  const proj = data.e8.proj2d;
  const roots = data.e8.roots8d || [];
  e8ChordEdges = buildMobileE8ChordEdges(roots);
  metrics.e8ChordEdgeCount = e8ChordEdges.length;
  const e8ChordDegrees = Array.from({ length: roots.length }, () => 0);
  for (const [a, b] of e8ChordEdges) {
    e8ChordDegrees[a]++;
    e8ChordDegrees[b]++;
  }
  metrics.e8ChordDegreeMin = e8ChordDegrees.length ? Math.min(...e8ChordDegrees) : 0;
  metrics.e8ChordDegreeMax = e8ChordDegrees.length ? Math.max(...e8ChordDegrees) : 0;
  platonicGeometry = { ...(data.platonic || {}), ...(data.stellations || {}) };
  platonicFaceCache = new Map();
  polytope4DGeometry = data.polytopes4d || {};
  const cell600 = polytope4DGeometry['600cell'];
  const classes600 = Array.isArray(cell600?.conjugacy_classes) ? cell600.conjugacy_classes : [];
  const byClass600 = Array.from({ length: 9 }, () => []);
  for (let index = 0; index < (cell600?.verts?.length || 0); index++) {
    const classIndex = clamp(Number(classes600[index]) || 0, 0, byClass600.length - 1);
    byClass600[classIndex].push(index);
  }
  bloomOrder600 = byClass600.flat();
  if (bloomOrder600.length !== 120) bloomOrder600 = Array.from({ length: cell600?.verts?.length || 0 }, (_, index) => index);
  dynkinGeometry = data.dynkin || {};
  mckayInfo = data.mckay || {};
  const ringRadii = data.e8.ring_radii || [];
  const maxR = Math.max(...proj.map(p => p.r));
  const maxRingRadius = ringRadii.reduce((max, r) => Math.max(max, r), 0);
  ringRadiusFactors = maxRingRadius ? ringRadii.filter(r => r !== 0).map(r => r / maxRingRadius * 1.2010611188828348) : [];
  ringBucketCount = Math.max(1, ringRadii.length - 1);
  petrieCycle = (data.e8_math?.petrie_cycle_30 || [])
    .map(idx => Number(idx))
    .filter(idx => Number.isInteger(idx) && idx >= 0 && idx < proj.length);
  petrieSet = petrieCycle.length ? new Set(petrieCycle) : EMPTY_SET;
  metrics.petrieCycleLength = petrieCycle.length;
  simpleRootIndices = (data.e8_math?.simple_root_indices || [])
    .map(idx => Number(idx))
    .filter(idx => Number.isInteger(idx) && idx >= 0 && idx < proj.length);
  simpleRootOrdinalByIndex = new Map(simpleRootIndices.map((idx, order) => [idx, order + 1]));
  cartanMatrix = buildCartanMatrix(roots, simpleRootIndices);
  metrics.simpleRootCount = simpleRootIndices.length;
  metrics.cartanMatrixSize = cartanMatrix.length;
  metrics.cartanMatrixNonzeroCount = cartanMatrix.reduce((count, row) => (
    count + row.reduce((rowCount, value) => rowCount + (Math.abs(value) > 0.001 ? 1 : 0), 0)
  ), 0);
  const subsetSource = { ...(data.mckay_subsets || {}) };
  if (simpleRootIndices.length) subsetSource.simple_roots = simpleRootIndices;
  subsetSets = Object.fromEntries(
    Object.entries(subsetSource).map(([name, roots]) => [name, new Set(Array.isArray(roots) ? roots : [])])
  );
  subsetLists = Object.fromEntries(
    Object.entries(subsetSource).map(([name, roots]) => [
      name,
      Array.isArray(roots) ? (name === 'simple_roots' ? [...roots] : [...roots].sort((a, b) => a - b)) : [],
    ])
  );
  points = proj.map((p, idx) => {
    const norm = maxR ? p.r / maxR : 0;
    return {
      idx,
      x: p.x,
      y: p.y,
      r: p.r,
      ring: p.ring,
      norm,
      // Keep the dense inner Coxeter rings legible on a narrow screen. The
      // former inverse-radius sizing made inner roots almost three times the
      // diameter of outer roots, merging the centre into a bright disc.
      baseSize: 1.9 + norm * 1.15,
      baseFillSlot: Math.min(BASE_POINT_BUCKET_COUNT - 1, Math.floor((p.ring / ringBucketCount) * BASE_POINT_BUCKET_COUNT)),
      drawMask: 0,
      sx: 0,
      sy: 0,
      size: 0,
      membershipNames: [],
      membershipText: 'none',
      simpleRootOrder: null,
      neighbors: [],
      neighborSet: new Set(),
      antipode: null,
      context: null,
    };
  });
  allRootList = points.map(p => p.idx);
  for (const [name, list] of Object.entries(subsetLists)) {
    for (const idx of list) {
      if (points[idx]) points[idx].membershipNames.push(SUBSET_LABELS[name] || name);
    }
  }
  for (const p of points) {
    p.membershipText = p.membershipNames.length ? p.membershipNames.join(', ') : 'none';
    p.simpleRootOrder = simpleRootOrdinalByIndex.get(p.idx) || null;
  }
  for (const p of points) {
    const root = roots[p.idx];
    if (!root) continue;
    const norm = innerProduct(root, root);
    for (let idx = 0; idx < roots.length; idx++) {
      if (idx === p.idx) continue;
      const dot = innerProduct(root, roots[idx]);
      if (Math.abs(dot + 1) < 0.001) p.neighbors.push(idx);
      if (Math.abs(dot + 2) < 0.001) p.antipode = idx;
    }
    p.neighborSet = new Set(p.neighbors);
    p.context = {
      point: p,
      neighbors: p.neighborSet,
      neighborCount: p.neighbors.length,
      antipode: p.antipode,
      coordinates: root.slice(),
      norm,
      neighborDot: -1,
      simpleRootOrder: p.simpleRootOrder,
      simpleRootLabel: p.simpleRootOrder ? `alpha ${p.simpleRootOrder}` : null,
    };
  }
}

function buildCartanMatrix(roots, indices) {
  if (!Array.isArray(roots) || !indices.length) return [];
  return indices.map(rowIdx => indices.map(colIdx => {
    const row = roots[rowIdx];
    const col = roots[colIdx];
    if (!row || !col) return 0;
    const value = innerProduct(row, col);
    const rounded = Math.round(value);
    return Math.abs(value - rounded) < 0.001 ? rounded : Number(value.toFixed(3));
  }));
}

function rootSubset() {
  return subsetSets[state.subset] || EMPTY_SET;
}

function rootSubsetList() {
  return subsetLists[state.subset] || [];
}

function layoutForCanvas(zoom = state.zoom) {
  const topInset = 84;
  const bottomInset = 108;
  const availableH = Math.max(240, window.innerHeight - topInset - bottomInset);
  const availableW = Math.max(120, window.innerWidth - 28);
  const size = Math.min(availableW, availableH);
  const baseScale = size * 0.39;
  return {
    cx: window.innerWidth / 2,
    cy: topInset + availableH / 2,
    topInset,
    bottomInset,
    availableH,
    size,
    baseScale,
    scale: baseScale * zoom,
  };
}

function usableViewBounds() {
  const layout = layoutForCanvas(1);
  const margin = 28;
  return {
    left: margin,
    right: window.innerWidth - margin,
    top: layout.topInset + margin,
    bottom: layout.topInset + layout.availableH - margin,
  };
}

function render() {
  try {
    const t0 = performance.now();
    resizeCanvas();
    setSdfCanvasActive(state.modelMode === 'sdf');
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    backgroundCtx.clearRect(0, 0, w, h);
    const foregroundCtx = ctx;
    ctx = backgroundCtx;
    let backgroundStats;
    try {
      backgroundStats = drawMobileBackground(w, h);
    } finally {
      ctx = foregroundCtx;
    }

    const layout = layoutForCanvas();
    const paletteSet = activePaletteSet();
    const palette = paletteSet.colors;
    const subset = rootSubset();
    selectedContext = getSelectedContext();
    const visibleContext = state.showContext ? selectedContext : null;
    const activeInputFrame = hasActiveInput();
    const liveControlLiteFrame = !activeInputFrame && !!liveControlLiteRenderReason;
    const liveControlLiteReason = liveControlLiteFrame ? liveControlLiteRenderReason : null;
    const interactionLiteFrame = activeInputFrame || liveControlLiteFrame;
    const drawStats = {
      points: 0,
      subsetPoints: 0,
      selectedPoints: 0,
      neighborPoints: 0,
      antipodePoints: 0,
      petriePoints: 0,
      glowPoints: 0,
      glowFills: 0,
      glowsSkippedForInteraction: 0,
      batchedPoints: 0,
      pointBatchFills: 0,
      directPoints: 0,
      directPointFills: 0,
      baseSizeCacheHits: 0,
      fillSlotCacheHits: 0,
      ringScaleFactors: 0,
      projectedPoints: 0,
      projectionObjectAllocs: 0,
      drawMaskWrites: 0,
      directQueuePoints: 0,
      directPointObjectAllocs: 0,
      baseBucketCount: 0,
      alphaColorCacheHits: 0,
      alphaColorRuntimeParses: 0,
      interactionLiteFrame,
      liveControlLiteFrame,
      liveControlLiteReason,
      ringsSkippedForInteraction: 0,
      rings: 0,
      ringStrokes: 0,
      rays: 0,
      raysSkippedForInteraction: 0,
      rayStrokes: 0,
      mirrorLines: 0,
      mirrorStrokes: 0,
      petrieSegments: 0,
      petrieStrokes: 0,
      backgroundMode: backgroundStats.mode,
      backgroundRenderer: backgroundStats.renderer,
      backgroundPrimitives: backgroundStats.primitives,
      modelMode: state.modelMode,
      modelLabel: MODEL_LABELS[state.modelMode] || MODEL_LABELS.e8_2d,
      shape: state.shape,
      shapeLabel: SHAPE_LABELS[state.shape] || state.shape,
      polytope4d: state.polytope4d,
      polytope4dLabel: POLYTOPE4D_LABELS[state.polytope4d] || state.polytope4d,
      dynkinDiagram: state.dynkinDiagram,
      dynkinLabel: DYNKIN_LABELS[state.dynkinDiagram] || state.dynkinDiagram,
      runtimePalette: paletteSet.name || state.palette,
      autoColor: state.autoColor,
      softFx: state.softFx,
      fxMode: state.fxMode,
      stylePhase,
      modelVertices: 0,
      modelProjectedVertices: 0,
      modelEdges: 0,
      modelEdgeStrokes: 0,
      e8ChordEdges: 0,
      e8ChordEdgeStrokes: 0,
      e8EdgesSkippedForInteraction: 0,
      ripplePointCount: 0,
      rippleEdgeSegments: 0,
      rippleEdgeStrokes: 0,
      rippleColorBands: 0,
      rippleBrightnessBands: 0,
      nativeFxApplied: false,
      nativeFxPrimitives: 0,
      nativeFxRenderer: null,
      canvasFxPassApplied: false,
      canvasFxPassPrimitives: 0,
      canvasFxPassRenderer: null,
      modelFaces: 0,
      modelFaceFills: 0,
      modelVertexFills: 0,
      minPointRadius: null,
      maxPointRadius: null,
      sdfRasterSize: 0,
      sdfPixels: 0,
      sdfSpheres: 0,
    };

    if (state.modelMode === 'platonic') {
      const projectedAllFrame = drawPlatonicModel(layout, paletteSet, drawStats, interactionLiteFrame);
      completeRender(t0, drawStats, projectedAllFrame, liveControlLiteFrame);
      return;
    }

    if (state.modelMode === 'poly4d') {
      const projectedAllFrame = drawPolytope4DModel(layout, paletteSet, drawStats, interactionLiteFrame);
      completeRender(t0, drawStats, projectedAllFrame, liveControlLiteFrame);
      return;
    }

    if (state.modelMode === 'dynkin') {
      const projectedAllFrame = drawDynkinModel(layout, paletteSet, drawStats, interactionLiteFrame);
      completeRender(t0, drawStats, projectedAllFrame, liveControlLiteFrame);
      return;
    }

    if (state.modelMode === 'bloom') {
      const visibleBloomPoints = projectBloomIntoCache(layout, drawStats);
      const projectedAllFrame = projectedPointFrameMetrics(visibleBloomPoints);
      drawBloomModel(layout, paletteSet, subset, visibleContext, drawStats, interactionLiteFrame);
      completeRender(t0, drawStats, projectedAllFrame, liveControlLiteFrame);
      return;
    }

    if (state.modelMode === 'sdf') {
      const projectedAllFrame = drawSdfModel(layout, paletteSet, drawStats, interactionLiteFrame);
      completeRender(t0, drawStats, projectedAllFrame, liveControlLiteFrame);
      return;
    }

    if (state.showRings && !interactionLiteFrame) {
      const ringStats = drawRings(layout, paletteSet);
      drawStats.rings = ringStats.rings;
      drawStats.ringStrokes = ringStats.strokes;
      drawStats.ringScaleFactors = ringStats.scaleFactors;
      drawStats.alphaColorCacheHits += ringStats.colorCacheHits;
    }
    else if (state.showRings) {
      drawStats.ringsSkippedForInteraction = ringRadiusFactors.length;
      drawStats.ringScaleFactors = ringRadiusFactors.length;
    }

    projectPointsIntoCache(layout, drawStats);
    const projectedAllFrame = projectedPointFrameMetrics(allRootList);

    if (state.showEdges && !interactionLiteFrame) {
      const edgeStats = drawPaletteEdgeField(points, e8ChordEdges, layout, paletteSet, {
        // Match the desktop's transparent LineSegments treatment.  The full
        // 56-neighbour graph needs much less per-chord energy than the former
        // 1,080-line sample, especially where many chords cross the centre.
        baseAlpha: 0.085,
        baseWidth: 0.62,
        shadowBlur: 0.65,
        alwaysPalette: true,
        composite: 'source-over',
      });
      drawStats.e8ChordEdges = edgeStats.segments;
      drawStats.e8ChordEdgeStrokes = edgeStats.strokes;
      drawStats.modelEdges += edgeStats.segments;
      drawStats.modelEdgeStrokes += edgeStats.strokes;
      recordRippleEdgeStats(drawStats, edgeStats);
    }
    else if (state.showEdges) {
      drawStats.e8EdgesSkippedForInteraction = e8ChordEdges.length;
    }

    if (state.showMirrors) {
      const mirrorStats = drawMirrorLines(layout, paletteSet);
      drawStats.mirrorLines = mirrorStats.lines;
      drawStats.mirrorStrokes = mirrorStats.strokes;
      drawStats.alphaColorCacheHits += mirrorStats.colorCacheHits;
    }

    if (state.showPetrie) {
      const petrieStats = drawPetrieCycle(paletteSet);
      drawStats.petrieSegments = petrieStats.segments;
      drawStats.petrieStrokes = petrieStats.strokes;
      drawStats.alphaColorCacheHits += petrieStats.colorCacheHits;
    }

    if (visibleContext && !interactionLiteFrame) {
      const rayStats = drawNeighborRays(visibleContext, paletteSet);
      drawStats.rays = rayStats.rays;
      drawStats.rayStrokes = rayStats.strokes;
      drawStats.alphaColorCacheHits += rayStats.colorCacheHits;
    }
    else if (visibleContext) {
      drawStats.raysSkippedForInteraction = visibleContext.neighborCount;
    }

    resetPointQueues();
    for (const p of points) {
      const mask =
        (state.highlightSubset && subset.has(p.idx) ? DRAW_SUBSET : 0) |
        (state.selectedRoot === p.idx ? DRAW_SELECTED : 0) |
        (visibleContext?.neighbors.has(p.idx) ? DRAW_NEIGHBOR : 0) |
        (visibleContext?.antipode === p.idx ? DRAW_ANTIPODE : 0) |
        (state.showPetrie && petrieSet.has(p.idx) ? DRAW_PETRIE : 0);
      p.drawMask = mask;
      drawStats.drawMaskWrites++;
      drawStats.points++;
      if (mask & DRAW_SUBSET) drawStats.subsetPoints++;
      if (mask & DRAW_SELECTED) drawStats.selectedPoints++;
      if (mask & DRAW_NEIGHBOR) drawStats.neighborPoints++;
      if (mask & DRAW_ANTIPODE) drawStats.antipodePoints++;
      if (mask & DRAW_PETRIE) drawStats.petriePoints++;
      if (mask) drawStats.glowPoints++;
      if (mask) {
        directPointQueue.push(p);
        continue;
      }
      const bucket = basePointBuckets[p.baseFillSlot] || basePointBuckets[0];
      drawStats.fillSlotCacheHits++;
      bucket.push(p);
    }

    const batchStats = drawBasePointBatches(palette);
    drawStats.batchedPoints = batchStats.points;
    drawStats.pointBatchFills = batchStats.fills;
    drawStats.baseBucketCount = batchStats.buckets;

    drawStats.directQueuePoints = directPointQueue.length;
    for (const p of directPointQueue) {
      drawStats.directPoints++;
      if (interactionLiteFrame) drawStats.glowsSkippedForInteraction++;
      else {
        drawStats.glowFills++;
        drawStats.alphaColorCacheHits++;
      }
      drawStats.directPointFills += drawPoint(p, paletteSet, p.drawMask, interactionLiteFrame);
    }

    completeRender(t0, drawStats, projectedAllFrame, liveControlLiteFrame);
  } catch (error) {
    recordError(error);
  }
}

function ensureCanvasFxBuffers() {
  if (!fxSourceCanvas) {
    fxSourceCanvas = document.createElement('canvas');
    fxSourceContext = fxSourceCanvas.getContext('2d', { alpha: true });
    fxTintCanvas = document.createElement('canvas');
    fxTintContext = fxTintCanvas.getContext('2d', { alpha: true });
  }
  if (!fxSourceContext || !fxTintContext) return false;
  if (fxSourceCanvas.width !== canvas.width || fxSourceCanvas.height !== canvas.height) {
    fxSourceCanvas.width = canvas.width;
    fxSourceCanvas.height = canvas.height;
    fxTintCanvas.width = canvas.width;
    fxTintCanvas.height = canvas.height;
  }
  return true;
}

function captureCanvasFxSource() {
  if (!ensureCanvasFxBuffers()) return false;
  fxSourceContext.setTransform(1, 0, 0, 1, 0, 0);
  fxSourceContext.globalAlpha = 1;
  fxSourceContext.globalCompositeOperation = 'source-over';
  fxSourceContext.filter = 'none';
  fxSourceContext.clearRect(0, 0, fxSourceCanvas.width, fxSourceCanvas.height);
  fxSourceContext.drawImage(canvas, 0, 0);
  return true;
}

function tintCanvasFxSource(color) {
  fxTintContext.setTransform(1, 0, 0, 1, 0, 0);
  fxTintContext.globalAlpha = 1;
  fxTintContext.globalCompositeOperation = 'source-over';
  fxTintContext.filter = 'none';
  fxTintContext.clearRect(0, 0, fxTintCanvas.width, fxTintCanvas.height);
  fxTintContext.drawImage(fxSourceCanvas, 0, 0);
  fxTintContext.globalCompositeOperation = 'source-in';
  fxTintContext.fillStyle = color;
  fxTintContext.fillRect(0, 0, fxTintCanvas.width, fxTintCanvas.height);
  fxTintContext.globalCompositeOperation = 'source-over';
  return fxTintCanvas;
}

function drawCanvasFxImage(source, width, height, options = {}) {
  const cx = options.cx ?? width * 0.5;
  const cy = options.cy ?? height * 0.5;
  ctx.save();
  ctx.globalAlpha = options.alpha ?? 1;
  ctx.globalCompositeOperation = options.composite || 'source-over';
  ctx.filter = options.filter || 'none';
  ctx.translate(cx + (options.dx || 0), cy + (options.dy || 0));
  if (options.rotation) ctx.rotate(options.rotation);
  const scaleX = options.scaleX ?? options.scale ?? 1;
  const scaleY = options.scaleY ?? options.scale ?? 1;
  ctx.scale(scaleX, scaleY);
  ctx.translate(-cx, -cy);
  ctx.drawImage(source, 0, 0, source.width, source.height, 0, 0, width, height);
  ctx.restore();
}

function clipCanvasFxWedge(cx, cy, radius, start, end) {
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx + Math.cos(start) * radius, cy + Math.sin(start) * radius);
  ctx.arc(cx, cy, radius, start, end);
  ctx.closePath();
  ctx.clip();
}

function drawCanvasKaleidoscope(width, height, cx, cy, segments, phase, strength) {
  const wedge = TAU / segments;
  const radius = Math.hypot(width, height) * 1.15;
  for (let index = 0; index < segments; index++) {
    const start = index * wedge - Math.PI * 0.5;
    ctx.save();
    clipCanvasFxWedge(cx, cy, radius, start, start + wedge + 0.002);
    ctx.translate(cx, cy);
    ctx.rotate(index * wedge + phase * 0.035);
    if (index % 2) ctx.scale(-1, 1);
    ctx.rotate(-index * wedge);
    ctx.translate(-cx, -cy);
    ctx.globalAlpha = 0.72 + strength * 0.16;
    ctx.globalCompositeOperation = index % 3 === 0 ? 'lighter' : 'source-over';
    ctx.drawImage(fxSourceCanvas, 0, 0, fxSourceCanvas.width, fxSourceCanvas.height, 0, 0, width, height);
    ctx.restore();
  }
  return segments;
}

function applyNativeCanvasFx(width, height, interactionLiteFrame = false) {
  const mode = state.fxMode;
  if (mode === 'none' || mode === 'ripple' || state.modelMode === 'sdf' || interactionLiteFrame) {
    return { applied: false, primitives: 0, renderer: mode === 'none' ? 'none' : mode === 'ripple' ? 'geometry-ripple' : 'skipped' };
  }
  if (!captureCanvasFxSource()) return { applied: false, primitives: 0, renderer: 'unavailable' };

  const strength = clamp(state.fxStrength, 0.25, 1.5);
  const layout = layoutForCanvas();
  const cx = layout.cx + state.panX;
  const cy = layout.cy + state.panY;
  const phase = stylePhase * TAU;
  const pulse = 0.5 + 0.5 * Math.sin(phase * 0.72);
  const clear = () => ctx.clearRect(0, 0, width, height);
  const drawOriginal = (options = {}) => drawCanvasFxImage(fxSourceCanvas, width, height, { cx, cy, ...options });
  let primitives = 0;

  clear();
  if (mode === 'glow') {
    drawOriginal({ alpha: 0.5 + strength * 0.14, composite: 'lighter', filter: `blur(${3 + strength * 3}px) brightness(1.8)` });
    drawOriginal({ alpha: 0.34, composite: 'lighter', scale: 1.008 + strength * 0.006 });
    drawOriginal();
    primitives = 3;
  } else if (mode === 'pulse') {
    const scale = 0.94 + pulse * (0.07 + strength * 0.035);
    drawOriginal({ alpha: 0.32, composite: 'lighter', filter: `blur(${2 + pulse * 3}px)`, scale: scale * 1.012 });
    drawOriginal({ scale });
    primitives = 2;
  } else if (mode === 'trail') {
    const drift = 4 + strength * 5;
    const angle = phase * 0.16;
    const colors = ['#ff4da6', '#7b5cff', '#4dffff'];
    for (let index = colors.length - 1; index >= 0; index--) {
      const distance = drift * (index + 1);
      const source = tintCanvasFxSource(colors[index]);
      drawCanvasFxImage(source, width, height, {
        cx, cy,
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance,
        rotation: (index + 1) * 0.004,
        alpha: 0.18 + (colors.length - index) * 0.035,
        composite: 'lighter',
      });
      primitives++;
    }
    drawOriginal({ alpha: 0.88 });
    primitives++;
  } else if (mode === 'chromatic') {
    const fringe = 2.5 + strength * 3.5 + pulse * 1.5;
    const red = tintCanvasFxSource('#ff2c7d');
    drawCanvasFxImage(red, width, height, { cx, cy, dx: fringe, alpha: 0.58, composite: 'lighter' });
    const cyan = tintCanvasFxSource('#28e6ff');
    drawCanvasFxImage(cyan, width, height, { cx, cy, dx: -fringe, alpha: 0.58, composite: 'lighter' });
    drawOriginal({ alpha: 0.7 });
    primitives = 3;
  } else if (mode === 'kaleidoscope') {
    primitives = drawCanvasKaleidoscope(width, height, cx, cy, 10, phase, strength);
  } else if (mode === 'spiral') {
    const maxRadius = Math.hypot(width, height) * 0.72;
    const rings = 9;
    for (let index = rings - 1; index >= 0; index--) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, maxRadius * (index + 1) / rings, 0, TAU);
      ctx.clip();
      drawOriginal({ rotation: (index - rings * 0.5) * (0.025 + strength * 0.012) + phase * 0.012, alpha: 0.78 + index / rings * 0.2 });
      ctx.restore();
      primitives++;
    }
  } else if (mode === 'fog') {
    drawOriginal({ alpha: 0.42 + strength * 0.08, filter: `blur(${1.2 + strength}px)` });
    drawOriginal({ alpha: 0.55 });
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    const fog = ctx.createRadialGradient(cx, cy, layout.size * 0.08, cx, cy, layout.size * 0.68);
    fog.addColorStop(0, 'rgba(230,242,255,0.02)');
    fog.addColorStop(0.58, `rgba(180,210,235,${0.12 + strength * 0.08})`);
    fog.addColorStop(1, `rgba(75,92,118,${0.42 + strength * 0.14})`);
    ctx.fillStyle = fog;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
    primitives = 3;
  } else if (mode === 'heat') {
    drawOriginal({ alpha: 0.38 });
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    const heat = ctx.createRadialGradient(cx, cy, 0, cx, cy, layout.size * 0.72);
    heat.addColorStop(0, '#fff26b');
    heat.addColorStop(0.38, '#ff8a24');
    heat.addColorStop(0.72, '#ff214d');
    heat.addColorStop(1, '#4b1dff');
    ctx.globalAlpha = 0.62 + strength * 0.18;
    ctx.fillStyle = heat;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
    drawOriginal({ alpha: 0.24, composite: 'lighter', filter: `blur(${1.5 + strength}px)` });
    primitives = 3;
  } else if (mode === 'edge-glow') {
    const white = tintCanvasFxSource('#f6ffff');
    drawCanvasFxImage(white, width, height, { cx, cy, alpha: 0.7, composite: 'lighter', filter: `blur(${1 + strength}px)` });
    drawOriginal({ alpha: 0.66, filter: 'contrast(1.75) brightness(1.12)' });
    drawOriginal({ alpha: 0.34, composite: 'lighter', scale: 1.006 });
    primitives = 3;
  } else if (mode === 'aura') {
    const auraA = tintCanvasFxSource('#63f6ff');
    drawCanvasFxImage(auraA, width, height, { cx, cy, alpha: 0.4, composite: 'lighter', filter: `blur(${5 + strength * 4}px)`, scale: 1.018 + pulse * 0.015 });
    const auraB = tintCanvasFxSource('#a75cff');
    drawCanvasFxImage(auraB, width, height, { cx, cy, alpha: 0.28, composite: 'lighter', filter: `blur(${10 + strength * 5}px)`, scale: 1.035 + pulse * 0.02 });
    drawOriginal({ alpha: 0.88 });
    primitives = 3;
  } else if (mode === 'voronoi') {
    drawOriginal({ alpha: 0.72, filter: 'contrast(1.35) saturate(1.2)' });
    const cool = tintCanvasFxSource('#72ffe3');
    drawCanvasFxImage(cool, width, height, { cx, cy, dx: 1.5, dy: -1.5, alpha: 0.24, composite: 'lighter' });
    primitives = 2;
  } else if (mode === 'caustic') {
    drawOriginal({ alpha: 0.72, filter: 'contrast(1.2) saturate(1.18)' });
    drawOriginal({ alpha: 0.32, composite: 'lighter', filter: `blur(${1.4 + pulse * 1.4}px)`, scale: 1.004 + pulse * 0.01 });
    primitives = 2;
  } else if (mode === 'iridescent') {
    drawOriginal({ alpha: 0.42 });
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = 0.75;
    const iridescence = typeof ctx.createConicGradient === 'function'
      ? ctx.createConicGradient(phase * 0.035, cx, cy)
      : ctx.createLinearGradient(cx - layout.size * 0.5, cy - layout.size * 0.5, cx + layout.size * 0.5, cy + layout.size * 0.5);
    iridescence.addColorStop(0, '#ff52a8');
    iridescence.addColorStop(0.25, '#64ffff');
    iridescence.addColorStop(0.5, '#ffe36e');
    iridescence.addColorStop(0.75, '#8f5cff');
    iridescence.addColorStop(1, '#ff52a8');
    ctx.fillStyle = iridescence;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
    drawOriginal({ alpha: 0.22, composite: 'lighter', scale: 1.006 });
    primitives = 3;
  } else if (mode === 'flowfield') {
    const slices = 24;
    for (let index = 0; index < slices; index++) {
      const sourceY = Math.round(index * fxSourceCanvas.height / slices);
      const sourceY2 = Math.round((index + 1) * fxSourceCanvas.height / slices);
      const destY = index * height / slices;
      const destH = height / slices + 0.5;
      const offset = Math.sin(index * 0.86 + phase * 0.2) * (3 + strength * 6);
      ctx.drawImage(fxSourceCanvas, 0, sourceY, fxSourceCanvas.width, Math.max(1, sourceY2 - sourceY), offset, destY, width, destH);
      primitives++;
    }
    drawOriginal({ alpha: 0.22, composite: 'lighter' });
    primitives++;
  } else if (mode === 'plasma') {
    drawOriginal({ alpha: 0.34, filter: 'contrast(1.24) saturate(1.5)' });
    ctx.save();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = 0.72;
    const plasma = ctx.createLinearGradient(0, cy - layout.size * 0.6, width, cy + layout.size * 0.6);
    const shift = (stylePhase * 0.08) % 1;
    plasma.addColorStop(0, shift > 0.5 ? '#00f6ff' : '#ff2bd6');
    plasma.addColorStop(0.33, '#754dff');
    plasma.addColorStop(0.66, '#ff6a24');
    plasma.addColorStop(1, shift > 0.5 ? '#ff2bd6' : '#00f6ff');
    ctx.fillStyle = plasma;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
    drawOriginal({ alpha: 0.32, composite: 'lighter', filter: `blur(${1 + pulse}px)` });
    primitives = 3;
  } else if (mode === 'kaleido6') {
    primitives = drawCanvasKaleidoscope(width, height, cx, cy, 6, phase * 1.25, strength);
  } else if (mode === 'dof') {
    drawOriginal({ alpha: 0.76, filter: `blur(${2.4 + strength * 2.2}px) brightness(0.82)` });
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, layout.size * 0.28, 0, TAU);
    ctx.clip();
    drawOriginal({ alpha: 1, filter: 'contrast(1.08)' });
    ctx.restore();
    drawOriginal({ alpha: 0.18, composite: 'lighter', filter: 'blur(7px)' });
    primitives = 3;
  } else if (mode === 'nebula') {
    const violet = tintCanvasFxSource('#9b63ff');
    drawCanvasFxImage(violet, width, height, { cx, cy, alpha: 0.32, composite: 'lighter', filter: `blur(${5 + pulse * 4}px)`, scale: 1.02 });
    drawOriginal({ alpha: 0.76, filter: 'saturate(1.22)' });
    primitives = 2;
  } else if (mode === 'wireframe') {
    const wire = tintCanvasFxSource('#8fffee');
    drawCanvasFxImage(wire, width, height, { cx, cy, alpha: 0.88, composite: 'lighter', filter: 'contrast(1.8)' });
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    drawOriginal({ alpha: 0.58, scale: 0.982 });
    ctx.restore();
    drawOriginal({ alpha: 0.28, filter: 'grayscale(1) contrast(1.55)' });
    primitives = 3;
  } else if (mode === 'hologram') {
    const hologram = tintCanvasFxSource('#55eaff');
    drawCanvasFxImage(hologram, width, height, { cx, cy, alpha: 0.82, composite: 'lighter', filter: `blur(${0.6 + pulse}px)` });
    drawOriginal({ alpha: 0.34 });
    primitives = 2;
  } else if (mode === 'xray') {
    const xray = tintCanvasFxSource('#78fff0');
    drawCanvasFxImage(xray, width, height, { cx, cy, alpha: 0.44, composite: 'lighter', filter: `blur(${2 + strength * 2}px)` });
    drawCanvasFxImage(xray, width, height, { cx, cy, alpha: 0.9, filter: 'contrast(1.7) brightness(0.82)' });
    drawOriginal({ alpha: 0.16, composite: 'lighter' });
    primitives = 3;
  } else if (mode === 'crystal') {
    const segments = 12;
    const radius = Math.hypot(width, height);
    const colors = ['#77edff', '#a978ff', '#ff73ba', '#ffe47d'];
    for (let index = 0; index < segments; index++) {
      const angle = index * TAU / segments - Math.PI * 0.5;
      const crystal = tintCanvasFxSource(colors[index % colors.length]);
      ctx.save();
      clipCanvasFxWedge(cx, cy, radius, angle, angle + TAU / segments + 0.002);
      drawCanvasFxImage(crystal, width, height, {
        cx, cy,
        rotation: Math.sin(phase * 0.09 + index) * 0.008,
        alpha: 0.64,
        composite: 'lighter',
      });
      ctx.restore();
      primitives++;
    }
    drawOriginal({ alpha: 0.5, filter: 'contrast(1.28)' });
    primitives++;
  } else {
    drawOriginal();
    return { applied: false, primitives: 1, renderer: 'fallback' };
  }

  return { applied: primitives > 0, primitives, renderer: `canvas-composite-${mode}` };
}

function drawForegroundFxOverlay(width, height, interactionLiteFrame = false) {
  const mode = state.fxMode;
  if (mode === 'none' || state.modelMode === 'sdf' || interactionLiteFrame) {
    return { applied: false, primitives: 0, renderer: mode === 'none' ? 'none' : 'skipped' };
  }
  if (!PATTERNED_CANVAS_FX.has(mode)) return { applied: false, primitives: 0, renderer: 'filter' };

  const strength = clamp(state.fxStrength, 0.25, 1.5);
  const cx = width * 0.5;
  const cy = height * 0.46;
  const phase = stylePhase * TAU;
  let primitives = 0;
  ctx.save();
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = clamp(0.1 + strength * 0.11, 0.12, 0.28);

  if (mode === 'voronoi') {
    ctx.strokeStyle = 'rgba(106,255,232,0.72)';
    ctx.lineWidth = 1.15;
    const cell = 54;
    for (let y = -cell; y < height + cell; y += cell) {
      for (let x = -cell; x < width + cell; x += cell) {
        const row = Math.round(y / cell);
        const jitter = Math.sin((x + y) * 0.031) * 9;
        ctx.beginPath();
        ctx.moveTo(x + jitter + (row % 2 ? cell * 0.5 : 0), y);
        ctx.lineTo(x + cell * 0.52, y + cell * 0.48);
        ctx.lineTo(x + jitter + (row % 2 ? cell * 0.5 : 0), y + cell);
        ctx.stroke();
        primitives++;
      }
    }
  } else if (mode === 'caustic' || mode === 'nebula' || mode === 'plasma') {
    const centers = mode === 'caustic'
      ? [[0.28, 0.34, '#6affe8'], [0.7, 0.62, '#f4d27a'], [0.52, 0.46, '#9b4dff']]
      : mode === 'nebula'
        ? [[0.25, 0.42, '#9b4dff'], [0.72, 0.5, '#4dffff'], [0.5, 0.7, '#ff6b9d']]
        : [[0.22, 0.3, '#ff00d4'], [0.76, 0.66, '#00ffea'], [0.52, 0.48, '#9b4dff']];
    for (let index = 0; index < centers.length; index++) {
      const [px, py, color] = centers[index];
      const driftX = Math.sin(phase * 0.18 + index * 2.1) * width * 0.05;
      const driftY = Math.cos(phase * 0.16 + index * 1.7) * height * 0.04;
      const gradient = ctx.createRadialGradient(width * px + driftX, height * py + driftY, 0, width * px + driftX, height * py + driftY, Math.max(width, height) * 0.42);
      gradient.addColorStop(0, color);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      primitives++;
    }
  } else if (mode === 'flowfield') {
    ctx.strokeStyle = 'rgba(106,255,232,0.78)';
    ctx.lineWidth = 1.5;
    for (let y = -30; y < height + 30; y += 28) {
      ctx.beginPath();
      for (let x = -30; x < width + 30; x += 18) {
        const waveY = y + Math.sin(x * 0.025 + phase * 0.24 + y * 0.01) * 14;
        if (x < -20) ctx.moveTo(x, waveY);
        else ctx.lineTo(x, waveY);
      }
      ctx.stroke();
      primitives++;
    }
  } else if (mode === 'hologram') {
    ctx.fillStyle = 'rgba(106,255,232,0.76)';
    for (let y = (stylePhase * 18) % 6; y < height; y += 6) {
      ctx.fillRect(0, y, width, 1);
      primitives++;
    }
  } else if (mode === 'iridescent') {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#ff6b9d');
    gradient.addColorStop(0.33, '#6affe8');
    gradient.addColorStop(0.66, '#f4d27a');
    gradient.addColorStop(1, '#9b4dff');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    primitives++;
  } else {
    const spokes = mode === 'kaleido6' ? 6 : mode === 'kaleidoscope' ? 12 : 18;
    ctx.strokeStyle = mode === 'spiral' ? 'rgba(244,210,122,0.76)' : 'rgba(106,255,232,0.72)';
    ctx.lineWidth = 2;
    const maxRadius = Math.hypot(width, height);
    for (let index = 0; index < spokes; index++) {
      const angle = phase * 0.035 + index * TAU / spokes;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.quadraticCurveTo(
        cx + Math.cos(angle + 0.72) * maxRadius * 0.32,
        cy + Math.sin(angle + 0.72) * maxRadius * 0.32,
        cx + Math.cos(angle) * maxRadius,
        cy + Math.sin(angle) * maxRadius,
      );
      ctx.stroke();
      primitives++;
    }
  }

  ctx.restore();
  return { applied: primitives > 0, primitives, renderer: 'foreground-mask' };
}

function completeRender(t0, drawStats, projectedAllFrame, liveControlLiteFrame) {
  const canvasFxPass = applyNativeCanvasFx(window.innerWidth, window.innerHeight, drawStats.interactionLiteFrame);
  drawStats.canvasFxPassApplied = canvasFxPass.applied;
  drawStats.canvasFxPassPrimitives = canvasFxPass.primitives;
  drawStats.canvasFxPassRenderer = canvasFxPass.renderer;
  if (canvasFxPass.applied) {
    drawStats.nativeFxApplied = true;
    drawStats.nativeFxPrimitives += canvasFxPass.primitives;
    drawStats.nativeFxRenderer = canvasFxPass.renderer;
  }
  const fxOverlay = drawForegroundFxOverlay(window.innerWidth, window.innerHeight, drawStats.interactionLiteFrame);
  drawStats.fxOverlayApplied = fxOverlay.applied;
  drawStats.fxOverlayPrimitives = fxOverlay.primitives;
  drawStats.fxRenderer = state.modelMode === 'sdf'
    ? 'sdf-shader'
    : drawStats.nativeFxApplied
      ? drawStats.nativeFxRenderer
      : fxOverlay.renderer;
  metrics.renderCount++;
  metrics.lastDrawStats = drawStats;
  metrics.lastRenderAllFrame = projectedAllFrame;
  metrics.lastRenderFrameSource = state.modelMode === 'e8_2d' ? 'projected-points' : state.modelMode;
  metrics.renderFrameReuseCount++;
  metrics.lastProjectionSource = state.modelMode === 'e8_2d'
    ? 'direct-point-fields'
    : state.modelMode === 'bloom'
      ? 'bloom-depth-points'
      : state.modelMode === 'sdf'
        ? (drawStats.sdfRenderer === 'webgl-raymarch' ? 'sdf-webgl-raymarch' : 'sdf-raster-fallback')
        : 'model-projection';
  metrics.lastProjectionCount = drawStats.projectedPoints || drawStats.modelProjectedVertices || 0;
  metrics.lastAllFrameWithinView = !!projectedAllFrame?.withinView;
  metrics.lastModelMode = state.modelMode;
  metrics.lastModelLabel = drawStats.modelLabel;
  metrics.lastShape = state.shape;
  metrics.lastShapeLabel = drawStats.shapeLabel;
  metrics.lastPolytope4D = state.polytope4d;
  metrics.lastPolytope4DLabel = drawStats.polytope4dLabel;
  metrics.lastDynkinDiagram = state.dynkinDiagram;
  metrics.lastDynkinLabel = drawStats.dynkinLabel;
  metrics.lastDynkinSelectedNode = drawStats.dynkinSelectedNode ?? null;
  metrics.lastRuntimePalette = drawStats.runtimePalette || state.palette;
  metrics.lastStylePhase = stylePhase;
  metrics.lastModelDrawMs = performance.now();
  metrics.modelProjectedVertices = drawStats.modelProjectedVertices || 0;
  metrics.modelEdgeStrokes = drawStats.modelEdgeStrokes || 0;
  metrics.modelFaceFills = drawStats.modelFaceFills || 0;
  metrics.modelVertexFills = drawStats.modelVertexFills || 0;
  if (state.modelMode !== 'e8_2d') metrics.modelRenderCount++;
  if (state.modelMode === 'bloom') {
    metrics.e8Projection3DCount++;
    metrics.bloomDrawCount++;
  }
  if (state.modelMode === 'sdf') metrics.sdfDrawCount++;
  if (state.modelMode === 'platonic') metrics.platonicDrawCount++;
  if (state.modelMode === 'poly4d') metrics.polytope4DDrawCount++;
  if (state.modelMode === 'dynkin') metrics.dynkinDrawCount++;
  metrics.lastRenderMs = performance.now() - t0;
  if (metrics.firstRenderMs == null) metrics.firstRenderMs = performance.now() - startedAt;
  if (liveControlLiteFrame) {
    metrics.liveControlLiteRenderCount++;
    metrics.lastLiveControlLiteRenderMs = performance.now();
    metrics.lastLiveControlLiteDrawStats = drawStats;
    liveControlLiteRenderReason = null;
  }
}

function resetPointQueues() {
  directPointQueue.length = 0;
  for (const bucket of basePointBuckets) bucket.length = 0;
}

function projectPointsIntoCache(layout, drawStats) {
  const cos = Math.cos(state.rotation);
  const sin = Math.sin(state.rotation);
  const originX = layout.cx + state.panX;
  const originY = layout.cy + state.panY;
  const scale = layout.scale;
  const pointScale = state.pointScale;
  const extrude = state.e8MorphT;
  for (const p of points) {
    const x = p.x * cos - p.y * sin;
    const y = p.x * sin + p.y * cos;
    const flatX = originX + x * scale;
    const flatY = originY + y * scale;
    let depthSize = 1;
    if (extrude > 0.0001) {
      // Match the desktop Coxeter extrusion: outer rings travel farther in Z,
      // then blend continuously from the canonical flat projection into the
      // orbitable 3D field. Keeping the flat endpoint explicit avoids a jump
      // when the slider or its Auto oscillator first leaves zero.
      const projected = projectModelPoint(p.x, p.y, p.norm * 0.62, layout, 1, false);
      p.sx = flatX + (projected.x - flatX) * extrude;
      p.sy = flatY + (projected.y - flatY) * extrude;
      p.depth = projected.z * extrude;
      depthSize = 0.84 + projected.perspective * 0.16;
      drawStats.projectionObjectAllocs++;
    } else {
      p.sx = flatX;
      p.sy = flatY;
      p.depth = 0;
    }
    const rippleScale = ripplePointScale(p.r);
    p.size = p.baseSize * pointScale * depthSize * rippleScale;
    if (state.fxMode === 'ripple') {
      drawStats.ripplePointCount++;
      drawStats.nativeFxApplied = true;
      drawStats.nativeFxPrimitives++;
      drawStats.nativeFxRenderer = 'geometry-ripple';
    }
    drawStats.minPointRadius = drawStats.minPointRadius == null ? p.size : Math.min(drawStats.minPointRadius, p.size);
    drawStats.maxPointRadius = drawStats.maxPointRadius == null ? p.size : Math.max(drawStats.maxPointRadius, p.size);
    drawStats.projectedPoints++;
    drawStats.baseSizeCacheHits++;
  }
  drawStats.e8Extrude = extrude;
  drawStats.e8ExtrudedPoints = extrude > 0.0001 ? points.length : 0;
}

function projectModelPoint(x, y, z, layout, modelScale = 1, scaleExtrudeDepth = true) {
  const yaw = state.rotation;
  const pathPitch = state.cameraPath === 'spiral' && state.autoRotate ? Math.sin(motionPhase * 0.72) * 0.24 : 0;
  const pitch = clamp(state.cameraTilt + pathPitch, -Math.PI / 3, Math.PI / 3);
  const pathZoom = state.cameraPath === 'dive' && state.autoRotate
    ? 0.92 + 0.18 * (0.5 + 0.5 * Math.cos(motionPhase * 0.86))
    : 1;
  if (scaleExtrudeDepth) z *= 1 + state.e8MorphT * 0.75;
  const cy = Math.cos(yaw);
  const sy = Math.sin(yaw);
  const cp = Math.cos(pitch);
  const sp = Math.sin(pitch);
  const rx = x * cy - z * sy;
  const rz = x * sy + z * cy;
  const ry = y * cp - rz * sp;
  const rz2 = y * sp + rz * cp;
  const depth = rz2;
  const perspective = 4.2 / Math.max(1.8, 4.2 + depth);
  const scale = layout.scale * modelScale * perspective * pathZoom;
  return {
    x: layout.cx + state.panX + rx * scale,
    y: layout.cy + state.panY + ry * scale,
    z: depth,
    perspective,
  };
}

function projectBloomIntoCache(layout, drawStats) {
  const sourceName = data.platonic?.[state.shape] ? state.shape : 'icosahedron';
  const sourceShape = data.platonic?.[sourceName] || data.platonic?.icosahedron;
  const sourceVerts = normalizedPlatonicVerts(sourceShape);
  const cell600 = polytope4DGeometry['600cell'];
  const cellVerts = normalizedPolytope4DVerts(cell600);
  const nSrc = sourceVerts.length;
  const amount = clamp(state.bloomAmount, 0, 1);
  const phaseMorph = Math.min(1, amount / 0.5);
  const phaseGrow = clamp((amount - 0.1) / 0.4, 0, 1);
  const phaseTwin = clamp((amount - 0.5) / 0.25, 0, 1);
  const phase2D = clamp((amount - 0.75) / 0.25, 0, 1);
  const n600ToShow = Math.floor(120 * phaseGrow);
  const visibleIndices = [];
  const modelScale = 1.07;

  for (const p of points) {
    p.bloomVisible = false;
    p.bloomAlpha = 0;
    p.bloomLayer = p.idx < 120 ? 0 : 1;
  }

  function place(index, x, y, z, baseSize, alpha = 1) {
    const p = points[index];
    if (!p) return;
    p.bloomX = x;
    p.bloomY = y;
    p.bloomZ = z;
    p.bloomBaseSize = baseSize;
    p.bloomVisible = true;
    p.bloomAlpha = alpha;
    visibleIndices.push(index);
  }

  for (let index = 0; index < nSrc; index++) {
    const src = sourceVerts[index];
    const dst = cellVerts[bloomOrder600[index] ?? 0] || [0, 0, 0, 0];
    place(
      index,
      src[0] * (1 - phaseMorph) + dst[0] * phaseMorph,
      src[1] * (1 - phaseMorph) + dst[1] * phaseMorph,
      src[2] * (1 - phaseMorph) + dst[2] * phaseMorph,
      2.5,
    );
  }

  for (let index = nSrc; index < n600ToShow && index < 120; index++) {
    const v = cellVerts[bloomOrder600[index] ?? 0] || [0, 0, 0, 0];
    place(index, v[0], v[1], v[2], 2.05);
  }

  if (phaseTwin > 0) {
    const angle = Math.PI * 0.5 * phaseTwin;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const yShift = -((1 + Math.sqrt(5)) / 2) * 0.25 * phaseTwin;
    for (let index = 0; index < 120; index++) {
      const v = cellVerts[index] || [0, 0, 0, 0];
      const y = v[1] * cos - v[2] * sin + yShift;
      const z = v[1] * sin + v[2] * cos;
      place(120 + index, v[0], y, z, 1.85 + phaseTwin * 0.25, 0.2 + phaseTwin * 0.8);
    }
  }

  if (phase2D > 0) {
    for (const index of visibleIndices) {
      const p = points[index];
      const target = data.e8.proj2d?.[index];
      if (!target) continue;
      p.bloomX = p.bloomX * (1 - phase2D) + target.x * 1.05 * phase2D;
      p.bloomY = p.bloomY * (1 - phase2D) + target.y * 1.05 * phase2D;
      p.bloomZ *= 1 - phase2D;
      p.bloomBaseSize = p.bloomBaseSize * (1 - phase2D) + 2.35 * phase2D;
    }
  }

  for (const index of visibleIndices) {
    const p = points[index];
    const projected = projectModelPoint(p.bloomX, p.bloomY, p.bloomZ, layout, modelScale);
    p.sx = projected.x;
    p.sy = projected.y;
    p.depth = projected.z;
    const rippleScale = ripplePointScale(Math.hypot(p.bloomX, p.bloomY));
    p.size = Math.max(1.35, p.bloomBaseSize * state.pointScale * (0.75 + projected.perspective * 0.34) * rippleScale);
    if (state.fxMode === 'ripple') {
      drawStats.ripplePointCount++;
      drawStats.nativeFxApplied = true;
      drawStats.nativeFxPrimitives++;
      drawStats.nativeFxRenderer = 'geometry-ripple';
    }
    drawStats.minPointRadius = drawStats.minPointRadius == null ? p.size : Math.min(drawStats.minPointRadius, p.size);
    drawStats.maxPointRadius = drawStats.maxPointRadius == null ? p.size : Math.max(drawStats.maxPointRadius, p.size);
    drawStats.projectedPoints++;
    drawStats.modelProjectedVertices++;
    drawStats.baseSizeCacheHits++;
  }

  drawStats.bloomAmount = amount;
  drawStats.bloomPhase = bloomPhaseLabel(amount);
  drawStats.bloomSource = sourceName;
  drawStats.bloomSourceVertices = nSrc;
  drawStats.bloomFirstCellPoints = visibleIndices.filter(index => index < 120).length;
  drawStats.bloomTwinPoints = visibleIndices.filter(index => index >= 120).length;
  drawStats.bloomVisiblePoints = visibleIndices.length;
  drawStats.bloomPhaseMorph = phaseMorph;
  drawStats.bloomPhaseTwin = phaseTwin;
  drawStats.bloomPhase2D = phase2D;
  return visibleIndices;
}

function drawBloomModel(layout, paletteSet, subset, visibleContext, drawStats, interactionLiteFrame) {
  if (visibleContext && state.bloomAmount >= 0.95 && !interactionLiteFrame) {
    const rayStats = drawNeighborRays(visibleContext, paletteSet);
    drawStats.rays = rayStats.rays;
    drawStats.rayStrokes = rayStats.strokes;
    drawStats.alphaColorCacheHits += rayStats.colorCacheHits;
  }
  else if (visibleContext) {
    drawStats.raysSkippedForInteraction = visibleContext.neighborCount;
  }

  const sourceName = data.platonic?.[state.shape] ? state.shape : 'icosahedron';
  const sourceShape = data.platonic?.[sourceName] || data.platonic?.icosahedron;
  const phaseMorph = Math.min(1, state.bloomAmount / 0.5);
  const phaseTwin = clamp((state.bloomAmount - 0.5) / 0.25, 0, 1);
  const sourceEdgeAlpha = Math.max(0, 1 - phaseMorph * 1.2) * 0.82;
  const trailAlpha = Math.sin(phaseTwin * Math.PI) * 0.32;
  let sourceEdges = 0;
  let sourceEdgeStrokes = 0;
  let twinTrails = 0;

  if (sourceEdgeAlpha > 0.005) {
    const visibleSourceEdges = (sourceShape?.edges || []).filter(edge => points[edge[0]]?.bloomVisible && points[edge[1]]?.bloomVisible);
    sourceEdges = visibleSourceEdges.length;
    if (state.fxMode === 'ripple') {
      const edgeStats = drawPaletteEdgeField(points, visibleSourceEdges, layout, paletteSet, {
        baseAlpha: sourceEdgeAlpha,
        baseWidth: interactionLiteFrame ? 1.35 : 2.05,
        shadowBlur: interactionLiteFrame ? 0 : 2.2,
        composite: 'lighter',
      });
      sourceEdgeStrokes = edgeStats.strokes;
      recordRippleEdgeStats(drawStats, edgeStats);
    } else {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = sourceEdgeAlpha;
      ctx.strokeStyle = paletteSet.colors[0];
      ctx.lineWidth = interactionLiteFrame ? 1.35 : 2.05;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (const edge of visibleSourceEdges) {
        const a = points[edge[0]];
        const b = points[edge[1]];
        ctx.moveTo(a.sx, a.sy);
        ctx.lineTo(b.sx, b.sy);
      }
      ctx.stroke();
      ctx.restore();
      sourceEdgeStrokes = visibleSourceEdges.length ? 1 : 0;
    }
  }

  if (trailAlpha > 0.005 && !interactionLiteFrame) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = trailAlpha;
    ctx.strokeStyle = state.bloomTwinH4 ? '#6affe8' : (paletteSet.colors[1] || paletteSet.colors[0]);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let index = 0; index < 12; index++) {
      const a = points[index];
      const b = points[120 + index];
      if (!a?.bloomVisible || !b?.bloomVisible) continue;
      ctx.moveTo(a.sx, a.sy);
      ctx.lineTo(b.sx, b.sy);
      twinTrails++;
    }
    ctx.stroke();
    ctx.restore();
  }

  const ordered = points.filter(point => point.bloomVisible).sort((a, b) => (a.depth || 0) - (b.depth || 0));
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of ordered) {
    const mask =
      (state.highlightSubset && subset.has(p.idx) ? DRAW_SUBSET : 0) |
      (state.selectedRoot === p.idx ? DRAW_SELECTED : 0) |
      (visibleContext?.neighbors.has(p.idx) ? DRAW_NEIGHBOR : 0) |
      (visibleContext?.antipode === p.idx ? DRAW_ANTIPODE : 0) |
      (state.showPetrie && petrieSet.has(p.idx) ? DRAW_PETRIE : 0);
    p.drawMask = mask;
    drawStats.drawMaskWrites++;
    drawStats.points++;
    if (mask & DRAW_SUBSET) drawStats.subsetPoints++;
    if (mask & DRAW_SELECTED) drawStats.selectedPoints++;
    if (mask & DRAW_NEIGHBOR) drawStats.neighborPoints++;
    if (mask & DRAW_ANTIPODE) drawStats.antipodePoints++;
    if (mask & DRAW_PETRIE) drawStats.petriePoints++;
    if (mask) drawStats.glowPoints++;
    if (!interactionLiteFrame) {
      drawStats.glowFills++;
      drawStats.alphaColorCacheHits++;
      ctx.globalAlpha = (mask ? 0.18 : 0.09) * state.fxStrength * p.bloomAlpha;
      ctx.fillStyle = p.bloomLayer && state.bloomTwinH4 ? '#6affe8' : (paletteSet.colors[1] || paletteSet.colors[0]);
      ctx.beginPath();
      ctx.arc(p.sx, p.sy, p.size + (mask ? 5 : 3.2), 0, TAU);
      ctx.fill();
    }
    drawStats.directPoints++;
    if (interactionLiteFrame && mask) drawStats.glowsSkippedForInteraction++;
    const pulse = state.softFx ? 1 + Math.sin(stylePhase * TAU + p.idx * 0.17) * 0.08 * state.fxStrength : 1;
    ctx.globalAlpha = (mask ? 1 : Math.max(0.72, state.pointOpacity)) * p.bloomAlpha;
    ctx.fillStyle = p.bloomLayer && state.bloomTwinH4
      ? '#6affe8'
      : (state.bloomTwinH4 ? (paletteSet.colors[1] || '#f4d27a') : paletteSet.colors[p.baseFillSlot % paletteSet.colors.length]);
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, Math.max(0.85, p.size * pulse), 0, TAU);
    ctx.fill();
    drawStats.directPointFills++;
  }
  ctx.restore();
  drawStats.modelVertices = ordered.length;
  drawStats.modelEdges = sourceEdges + twinTrails;
  drawStats.modelEdgeStrokes = sourceEdgeStrokes + (twinTrails ? 1 : 0);
  drawStats.bloomSourceEdges = sourceEdges;
  drawStats.bloomTwinTrails = twinTrails;
}

const SDF_ROOT_SCALE = 1.55;
const SDF_FOV_RADIANS = 50 * Math.PI / 180;
const SDF_BASE_CAMERA_DISTANCE = 11.0;

const SDF_VERTEX_SHADER = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const SDF_FRAGMENT_TEMPLATE = `
precision highp float;

#define MARCH_STEPS __MARCH_STEPS__
#define ROOT_NEIGHBOR_SPAN __ROOT_NEIGHBOR_SPAN__
#define SHADOW_STEPS __SHADOW_STEPS__
#define AO_STEPS __AO_STEPS__
#define MAX_DIST 22.0
#define SURF_DIST 0.0012

uniform vec2 uResolution;
uniform vec2 uScreenOffset;
uniform float uTime;
uniform vec3 uCameraPos;
uniform mat3 uCameraBasis;
uniform float uFov;
uniform vec4 uRings[8];
uniform float uSphereR;
uniform float uBlend;
uniform float uBloom;
uniform float uAniso;
uniform float uFxStrength;
uniform float uFxMode;
uniform float uMotionPulse;
uniform float uRippleTime;
uniform vec3 uPalette0;
uniform vec3 uPalette1;
uniform vec3 uPalette2;
uniform vec3 uPalette3;
uniform vec3 uPalette4;

float gNearestRing = 0.0;

float smin(float a, float b, float k) {
  if (k < 0.00001) return min(a, b);
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

float sdf(vec3 p) {
  float d = 1000.0;
  float nearestDistance = 1000.0;
  float nearestRing = 0.0;
  float sphereRadius = uSphereR * (1.0 + uMotionPulse * 0.025 * sin(uTime * 2.1));
  float pointAngle = atan(p.y, p.x);
  for (int ringIndex = 0; ringIndex < 8; ringIndex++) {
    vec4 ring = uRings[ringIndex];
    float nearestSlot = floor((pointAngle - ring.y) / ring.z + 0.5);
    float nearestAngle = ring.y + nearestSlot * ring.z;
    // Sample the same symmetric neighbourhood on both sides of a root. A
    // one-sided shortcut makes the chosen neighbour flip at each root centre,
    // producing the 30 radial normal seams that resemble cel shading.
    for (int offset = -ROOT_NEIGHBOR_SPAN; offset <= ROOT_NEIGHBOR_SPAN; offset++) {
      float rootAngle = nearestAngle + float(offset) * ring.z;
      vec3 root = vec3(ring.x * cos(rootAngle), ring.x * sin(rootAngle), ring.w);
      float currentSphereRadius = sphereRadius;
      if (uFxMode > 5.5 && uFxMode < 6.5) {
        currentSphereRadius *= 1.0 + uFxStrength * 0.09 * sin(ring.x * 8.0 - uRippleTime);
      }
      float rootDistance = length(p - root) - currentSphereRadius;
      if (rootDistance < nearestDistance) {
        nearestDistance = rootDistance;
        nearestRing = float(ringIndex) / 7.0;
      }
      d = smin(d, rootDistance, uBlend);
    }
  }
  gNearestRing = nearestRing;
  return d;
}

vec3 surfaceNormal(vec3 p) {
  // A phone raster covers a larger world-space footprint than the desktop
  // renderer. Sampling the normal over that footprint prevents sub-pixel
  // sphere junctions from turning into radial bands when magnified.
  const float e = 0.006;
  const vec2 h = vec2(1.0, -1.0) * 0.5773;
  return normalize(
    h.xyy * sdf(p + h.xyy * e) +
    h.yyx * sdf(p + h.yyx * e) +
    h.yxy * sdf(p + h.yxy * e) +
    h.xxx * sdf(p + h.xxx * e)
  );
}

float softShadow(vec3 ro, vec3 rd) {
  float result = 1.0;
  float t = 0.025;
  for (int i = 0; i < SHADOW_STEPS; i++) {
    float h = sdf(ro + rd * t);
    if (h < 0.001) return 0.0;
    result = min(result, 15.0 * h / t);
    t += clamp(h, 0.025, 0.32);
  }
  return clamp(result, 0.0, 1.0);
}

float ambientOcclusion(vec3 p, vec3 n) {
  float occ = 0.0;
  float weight = 1.0;
  for (int i = 0; i < AO_STEPS; i++) {
    float distance = 0.035 + 0.13 * float(i);
    occ += (distance - sdf(p + n * distance)) * weight;
    weight *= 0.7;
  }
  return clamp(1.0 - 2.4 * occ, 0.0, 1.0);
}

vec3 fxSpectrum(float value) {
  return 0.55 + 0.45 * cos(6.2831853 * (value + vec3(0.0, 0.33, 0.67)));
}

vec3 paletteGradient(float value) {
  float scaled = clamp(value, 0.0, 1.0) * 4.0;
  if (scaled < 1.0) return mix(uPalette0, uPalette1, scaled);
  if (scaled < 2.0) return mix(uPalette1, uPalette2, scaled - 1.0);
  if (scaled < 3.0) return mix(uPalette2, uPalette3, scaled - 2.0);
  return mix(uPalette3, uPalette4, scaled - 3.0);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;
  uv -= uScreenOffset;
  float focalLength = 1.0 / tan(uFov * 0.5);
  vec3 rayOrigin = uCameraPos;
  vec3 rayDirection = normalize(
    uCameraBasis[0] * uv.x +
    uCameraBasis[1] * uv.y +
    uCameraBasis[2] * focalLength
  );

  float t = 0.0;
  float rayEnd = 0.0;
  bool hit = false;
  const float boundRadius = 2.55;
  float boundB = dot(rayOrigin, rayDirection);
  float boundC = dot(rayOrigin, rayOrigin) - boundRadius * boundRadius;
  float discriminant = boundB * boundB - boundC;
  if (discriminant >= 0.0) {
    float boundRoot = sqrt(discriminant);
    t = max(0.0, -boundB - boundRoot);
    rayEnd = min(MAX_DIST, -boundB + boundRoot);
    for (int stepIndex = 0; stepIndex < MARCH_STEPS; stepIndex++) {
      float distance = sdf(rayOrigin + rayDirection * t);
      if (distance < SURF_DIST) {
        hit = true;
        break;
      }
      t += distance * 0.9;
      if (t > rayEnd) break;
    }
  }

  if (!hit) {
    gl_FragColor = vec4(0.0);
    return;
  }

  vec3 p = rayOrigin + rayDirection * t;
  sdf(p);
  // Nearest-ring colouring changes abruptly where two root fields meet. On a
  // blended surface those Voronoi boundaries look like flat cell-shaded tiles.
  // A radial gradient preserves the inner-to-outer palette progression while
  // remaining continuous across every sphere union.
  float ringMix = smoothstep(0.18, 1.92, length(p.xy));
  vec3 n = surfaceNormal(p);
  vec3 keyDirection = normalize(vec3(0.58, 0.72, 0.46));
  vec3 fillDirection = normalize(vec3(-0.45, 0.18, -0.28));
  float softKey = 0.5 + 0.5 * dot(n, keyDirection);
  float softFill = 0.5 + 0.5 * dot(n, fillDirection);
  float viewFacing = max(dot(n, -rayDirection), 0.0);
  float fresnel = pow(1.0 - viewFacing, 2.4);
  float shadow = softShadow(p + n * 0.006, keyDirection);
  float ao = ambientOcclusion(p, n);
  vec3 baseColor = paletteGradient(ringMix);
  float hemisphere = 0.5 + 0.5 * n.y;
  // Start from a bright, continuous material response instead of a dark
  // Lambert base. The old low ambient at grazing angles drew a black ring
  // around every sphere and made the smooth unions resemble cel shading.
  vec3 color = baseColor * (0.58 + softKey * shadow * 0.22 + softFill * 0.1 + hemisphere * 0.06) * ao;
  color += mix(vec3(0.95, 0.97, 1.0), baseColor, 0.25) * fresnel * (0.62 + uBloom * 0.16);

  vec3 halfVector = normalize(keyDirection - rayDirection);
  float standardSpec = pow(max(dot(n, halfVector), 0.0), 26.0);
  vec3 tangent = normalize(cross(n, vec3(0.0, 1.0, 0.0)) + vec3(0.001));
  vec3 bitangent = normalize(cross(n, tangent));
  float anisoSpec = pow(abs(dot(tangent, halfVector)), 36.0) * 0.58
    + pow(abs(dot(bitangent, halfVector)), 82.0) * 0.42;
  color += vec3(1.0) * standardSpec * shadow * 0.18;
  color += vec3(1.0, 0.94, 0.82) * anisoSpec * uAniso * shadow * 0.12;
  float fxMix = clamp(uFxStrength * 0.58, 0.0, 0.92);
  float angle = atan(p.y, p.x);
  float radius = length(p.xy);
  if (uFxMode > 0.5 && uFxMode < 1.5) {
    color += mix(vec3(1.0), baseColor, 0.4) * fresnel * fxMix * 0.85;
  } else if (uFxMode < 2.5 && uFxMode > 1.5) {
    color *= 0.9 + 0.18 * fxMix * sin(uTime * 2.2);
  } else if (uFxMode < 3.5 && uFxMode > 2.5) {
    color = mix(color, vec3(color.b, color.r, color.g), fxMix * 0.28);
  } else if (uFxMode < 4.5 && uFxMode > 3.5) {
    color = mix(color, vec3(color.r * 1.18, color.g, color.b * 1.2), fxMix * (0.35 + 0.35 * n.x));
  } else if (uFxMode < 5.5 && uFxMode > 4.5) {
    float band = 0.55 + 0.45 * abs(cos(angle * 6.0));
    color = mix(color, fxSpectrum(angle / 6.2831853) * band, fxMix * 0.46);
  } else if (uFxMode < 6.5 && uFxMode > 5.5) {
    float wave = sin(radius * 8.0 - uRippleTime);
    color *= clamp(1.0 + uFxStrength * 0.7 * wave, 0.24, 1.7);
    color += baseColor * max(wave, 0.0) * fxMix * 0.16;
  } else if (uFxMode < 7.5 && uFxMode > 6.5) {
    float band = 0.5 + 0.5 * sin(angle * 8.0 + radius * 15.0 - uTime);
    color = mix(color, vec3(1.0, 0.62, 0.18) * (0.6 + band * 0.6), fxMix * 0.36);
  } else if (uFxMode < 8.5 && uFxMode > 7.5) {
    float haze = smoothstep(3.0, 8.0, t);
    color = mix(color, vec3(0.52, 0.6, 0.72), haze * fxMix * 0.58);
  } else if (uFxMode < 9.5 && uFxMode > 8.5) {
    float energy = clamp(dot(color, vec3(0.3, 0.58, 0.12)), 0.0, 1.0);
    color = mix(color, mix(vec3(0.58, 0.02, 0.0), vec3(1.0, 0.88, 0.16), energy), fxMix * 0.68);
  } else if (uFxMode < 10.5 && uFxMode > 9.5) {
    color = mix(color * 0.58, vec3(0.55, 0.95, 1.0), fresnel * fxMix);
  } else if (uFxMode < 11.5 && uFxMode > 10.5) {
    color += mix(vec3(0.18, 0.82, 1.0), vec3(0.68, 0.24, 1.0), ringMix) * fresnel * fxMix * 0.72;
  } else if (uFxMode < 12.5 && uFxMode > 11.5) {
    float cells = abs(sin(p.x * 8.0) * sin(p.y * 8.0) * sin(p.z * 8.0));
    color = mix(color * (0.62 + cells * 0.5), fxSpectrum(cells), fxMix * 0.34);
  } else if (uFxMode < 13.5 && uFxMode > 12.5) {
    float bands = pow(0.5 + 0.5 * sin(p.x * 9.0 + sin(p.y * 7.0 - uTime) * 2.4), 4.0);
    color += vec3(0.22, 0.86, 1.0) * bands * fxMix * 0.72;
  } else if (uFxMode < 14.5 && uFxMode > 13.5) {
    color = mix(color, fxSpectrum(fresnel * 1.8 + angle / 6.2831853), fxMix * (0.28 + fresnel * 0.58));
  } else if (uFxMode < 15.5 && uFxMode > 14.5) {
    float flow = 0.5 + 0.5 * sin(dot(p, vec3(5.0, 8.0, 3.0)) - uTime * 1.2);
    color = mix(color, vec3(0.12, 0.92, 0.82) * (0.5 + flow * 0.7), fxMix * 0.38);
  } else if (uFxMode < 16.5 && uFxMode > 15.5) {
    float plasma = sin(p.x * 6.0 + uTime) + sin(p.y * 7.0 - uTime * 0.7) + sin(p.z * 8.0);
    color = mix(color, fxSpectrum(plasma * 0.14), fxMix * 0.62);
  } else if (uFxMode < 17.5 && uFxMode > 16.5) {
    float symmetry = 0.5 + 0.5 * cos(angle * 6.0);
    color = mix(color, fxSpectrum(symmetry + ringMix * 0.25), fxMix * 0.48);
  } else if (uFxMode < 18.5 && uFxMode > 17.5) {
    float focus = 1.0 - smoothstep(4.0, 8.5, t);
    color *= mix(0.68, 1.08, mix(1.0, focus, fxMix));
  } else if (uFxMode < 19.5 && uFxMode > 18.5) {
    float cloud = 0.5 + 0.5 * sin(dot(p, vec3(3.7, 5.1, 4.3)) + sin(p.x * 6.0));
    color = mix(color, mix(vec3(0.28, 0.08, 0.55), vec3(0.16, 0.78, 0.92), cloud), fxMix * 0.46);
  } else if (uFxMode < 20.5 && uFxMode > 19.5) {
    color = color * (0.42 + fresnel * 0.5) + vec3(0.22, 0.86, 0.94) * fresnel * fxMix;
  } else if (uFxMode < 21.5 && uFxMode > 20.5) {
    float scan = step(0.48, fract(gl_FragCoord.y * 0.24 + uTime * 0.5));
    color = mix(color, vec3(0.1, 0.94, 0.86) * (0.64 + scan * 0.36), fxMix * 0.54);
  } else if (uFxMode < 22.5 && uFxMode > 21.5) {
    color = mix(color * 0.16, vec3(0.38, 0.9, 1.0) * (0.2 + fresnel * 1.25), fxMix);
  } else if (uFxMode < 23.5 && uFxMode > 22.5) {
    float facet = floor((n.x + n.y * 1.7 + n.z * 2.3 + 3.0) * 3.0) / 3.0;
    color = mix(color, fxSpectrum(facet * 0.17 + fresnel), fxMix * 0.5);
    color += vec3(0.86, 0.95, 1.0) * pow(standardSpec, 0.45) * fxMix * 0.42;
  }
  vec3 bright = max(color - vec3(0.64), vec3(0.0));
  color += bright * uBloom * 0.72;
  // A trace of deterministic dither prevents 8-bit mobile gradients from
  // resolving into visible lighting bands when the view is magnified.
  float dither = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) - 0.5;
  color += dither / 255.0;
  color = color / (color + vec3(0.46));
  color = pow(clamp(color, 0.0, 1.0), vec3(0.96));
  gl_FragColor = vec4(color, 1.0);
}`;

const MOBILE_SDF_QUALITY = {
  // Moving frames still need the symmetric root neighbourhood. Compiling it
  // out brought back the angular normal seams that the settled shader removes.
  interactive: { scale: 0.72, marchSteps: 30, neighborSpan: 1, shadowSteps: 0, aoSteps: 0 },
  motion: { scale: 1.0, marchSteps: 38, neighborSpan: 1, shadowSteps: 0, aoSteps: 0 },
  smooth: { scale: 1.0, marchSteps: 42, neighborSpan: 1, shadowSteps: 0, aoSteps: 0 },
  balanced: { scale: 1.0, marchSteps: 48, neighborSpan: 1, shadowSteps: 0, aoSteps: 0 },
  sharp: { scale: 1.25, marchSteps: 60, neighborSpan: 1, shadowSteps: 0, aoSteps: 0 },
};

function sdfShaderSource(profile) {
  return SDF_FRAGMENT_TEMPLATE
    .replaceAll('__MARCH_STEPS__', String(profile.marchSteps))
    .replaceAll('__ROOT_NEIGHBOR_SPAN__', String(profile.neighborSpan))
    .replaceAll('__SHADOW_STEPS__', String(profile.shadowSteps))
    .replaceAll('__AO_STEPS__', String(profile.aoSteps));
}

function compileSdfShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || 'SDF shader compilation failed';
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function createSdfProgram(profileKey) {
  const gl = sdfGl;
  const profile = MOBILE_SDF_QUALITY[profileKey] || MOBILE_SDF_QUALITY.smooth;
  const vertex = compileSdfShader(gl, gl.VERTEX_SHADER, SDF_VERTEX_SHADER);
  const fragment = compileSdfShader(gl, gl.FRAGMENT_SHADER, sdfShaderSource(profile));
  const program = gl.createProgram();
  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program) || 'SDF shader linking failed';
    gl.deleteProgram(program);
    throw new Error(message);
  }
  const uniformNames = [
    'uResolution', 'uScreenOffset', 'uTime', 'uCameraPos', 'uCameraBasis', 'uFov', 'uRings',
    'uSphereR', 'uBlend', 'uBloom', 'uAniso', 'uFxStrength', 'uFxMode', 'uMotionPulse', 'uRippleTime',
    'uPalette0', 'uPalette1', 'uPalette2', 'uPalette3', 'uPalette4',
  ];
  const uniforms = Object.fromEntries(uniformNames.map(name => [name, gl.getUniformLocation(program, name)]));
  const position = gl.getAttribLocation(program, 'aPosition');
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  return { program, profile, uniforms, position, buffer };
}

function ensureSdfWebgl() {
  if (!sdfCanvas || sdfWebglUnavailable) return false;
  if (sdfGl) return true;
  try {
    sdfGl = sdfCanvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      // The SDF canvas is downsampled by the WebView compositor. Premultiplied
      // alpha keeps transparent miss pixels from bleeding black into the
      // opaque silhouette during that filtering step.
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance',
    });
    if (!sdfGl) {
      sdfWebglUnavailable = true;
      return false;
    }
    sdfCanvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      sdfGl = null;
      sdfPrograms.clear();
    });
    sdfCanvas.addEventListener('webglcontextrestored', () => {
      sdfGl = null;
      sdfWebglUnavailable = false;
      sdfPrograms.clear();
      requestRender('sdf-context-restored');
    });
    return true;
  } catch (error) {
    sdfWebglUnavailable = true;
    recordError(error);
    return false;
  }
}

function sdfProgramFor(profileKey) {
  if (sdfPrograms.has(profileKey)) return sdfPrograms.get(profileKey);
  const record = createSdfProgram(profileKey);
  sdfPrograms.set(profileKey, record);
  return record;
}

function normalizeVector3(x, y, z) {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function setSdfCanvasActive(active) {
  if (!sdfCanvas) return false;
  sdfCanvas.classList.toggle('active', !!active);
  sdfCanvas.setAttribute('aria-hidden', active ? 'false' : 'true');
  return !!active;
}

function updateSdfRingUniforms() {
  const scale = SDF_ROOT_SCALE;
  const byRing = Array.from({ length: 8 }, () => []);
  for (const point of points) byRing[clamp(Number(point.ring) || 0, 0, 7)].push(point);
  for (let ringIndex = 0; ringIndex < 8; ringIndex++) {
    const ringPoints = byRing[ringIndex];
    const count = Math.max(1, ringPoints.length);
    const radius = ringPoints.reduce((sum, point) => sum + Math.hypot(point.x, point.y), 0) / count;
    const first = ringPoints[0] || { x: 1, y: 0 };
    const offset = ringIndex * 4;
    sdfRingUniformData[offset] = radius * scale;
    sdfRingUniformData[offset + 1] = Math.atan2(first.y, first.x);
    sdfRingUniformData[offset + 2] = TAU / count;
    sdfRingUniformData[offset + 3] = (ringIndex / 7 - 0.5) * 0.8 * scale * state.e8MorphT;
  }
  return scale;
}

function sdfWorldBoundsRadius() {
  let radius = 0;
  const surfacePadding = (state.sdfSphereR + state.sdfBlend * 0.3) * SDF_ROOT_SCALE;
  for (const point of points) {
    const planarRadius = Math.hypot(point.x, point.y) * SDF_ROOT_SCALE;
    const z = Math.abs((point.ring / 7 - 0.5) * 0.8 * SDF_ROOT_SCALE * state.e8MorphT);
    radius = Math.max(radius, Math.hypot(planarRadius, z) + surfacePadding);
  }
  return Math.max(0.25, radius);
}

function sdfCameraDiveScale() {
  return state.cameraPath === 'dive' && state.autoRotate
    ? 0.82 + 0.22 * (0.5 + 0.5 * Math.cos(motionPhase * 0.86))
    : 1;
}

function sdfCameraDistance() {
  return (SDF_BASE_CAMERA_DISTANCE / Math.sqrt(state.zoom)) * sdfCameraDiveScale();
}

function sdfProjectedFrameMetrics(layout, distance = sdfCameraDistance()) {
  const view = usableViewBounds();
  const worldRadius = sdfWorldBoundsRadius();
  const focalPixels = window.innerHeight / (2 * Math.tan(SDF_FOV_RADIANS * 0.5));
  const safeDistance = Math.max(worldRadius + 0.01, distance);
  const projectedRadius = focalPixels * worldRadius /
    Math.sqrt(Math.max(0.0001, safeDistance * safeDistance - worldRadius * worldRadius));
  const centerX = window.innerWidth * 0.5 + state.panX;
  const centerY = layout.cy + state.panY;
  const minX = centerX - projectedRadius;
  const maxX = centerX + projectedRadius;
  const minY = centerY - projectedRadius;
  const maxY = centerY + projectedRadius;
  return {
    minX,
    maxX,
    minY,
    maxY,
    width: projectedRadius * 2,
    height: projectedRadius * 2,
    withinView: minX >= view.left - 0.5 && maxX <= view.right + 0.5 && minY >= view.top - 0.5 && maxY <= view.bottom + 0.5,
    view,
  };
}

function drawSdfWebglModel(layout, paletteSet, drawStats, interactionLiteFrame) {
  if (!ensureSdfWebgl()) return null;
  try {
    const profileKey = interactionLiteFrame ? 'interactive' : hasRuntimeAnimation() ? 'motion' : state.quality;
    const record = sdfProgramFor(profileKey);
    const { program, profile, uniforms, position, buffer } = record;
    const gl = sdfGl;
    const devicePixelRatio = window.devicePixelRatio || 1;
    const isStaticFrame = !interactionLiteFrame && !hasRuntimeAnimation();
    const selectedMotionBoost = { smooth: 1, balanced: 1.08, sharp: 1.18 }[state.quality] || 1;
    const motionPixelBoost = profileKey === 'motion' ? selectedMotionBoost : 1;
    let pixelBoost = isStaticFrame ? Math.min(devicePixelRatio, 1.75) : motionPixelBoost;
    let rasterScale = profile.scale * pixelBoost;
    // Sharp is the inspection tier: render at the display's native pixel grid
    // so WebView scaling cannot manufacture a dark filtered contour.
    if (isStaticFrame && profileKey === 'sharp') rasterScale = Math.max(rasterScale, devicePixelRatio);
    pixelBoost = rasterScale / profile.scale;
    const width = Math.max(1, Math.round(window.innerWidth * rasterScale));
    const height = Math.max(1, Math.round(window.innerHeight * rasterScale));
    if (sdfCanvas.width !== width || sdfCanvas.height !== height) {
      sdfCanvas.width = width;
      sdfCanvas.height = height;
    }
    sdfCanvas.style.width = `${window.innerWidth}px`;
    sdfCanvas.style.height = `${window.innerHeight}px`;
    gl.viewport(0, 0, width, height);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

    const pathPitch = state.cameraPath === 'spiral' && state.autoRotate ? Math.sin(motionPhase * 0.72) * 0.24 : 0;
    const pitch = clamp(state.cameraTilt + pathPitch, -Math.PI / 3, Math.PI / 3);
    const distance = sdfCameraDistance();
    const cosPitch = Math.cos(pitch);
    const camera = [
      Math.sin(state.rotation) * cosPitch * distance,
      Math.sin(pitch) * distance,
      Math.cos(state.rotation) * cosPitch * distance,
    ];
    const forward = normalizeVector3(-camera[0], -camera[1], -camera[2]);
    const right = normalizeVector3(-forward[2], 0, forward[0]);
    const up = normalizeVector3(
      right[1] * forward[2] - right[2] * forward[1],
      right[2] * forward[0] - right[0] * forward[2],
      right[0] * forward[1] - right[1] * forward[0]
    );
    const cameraBasis = new Float32Array([
      right[0], right[1], right[2],
      up[0], up[1], up[2],
      forward[0], forward[1], forward[2],
    ]);
    const rootScale = updateSdfRingUniforms();
    for (let paletteIndex = 0; paletteIndex < 5; paletteIndex++) {
      const channels = paletteChannelsAt(paletteSet, paletteIndex / 4);
      const offset = paletteIndex * 3;
      sdfPaletteUniformData[offset] = channels[0] / 255;
      sdfPaletteUniformData[offset + 1] = channels[1] / 255;
      sdfPaletteUniformData[offset + 2] = channels[2] / 255;
    }
    const targetX = window.innerWidth * 0.5 + state.panX;
    const targetY = layout.cy + state.panY;
    const screenOffset = [
      2 * (targetX - window.innerWidth * 0.5) / Math.max(1, window.innerHeight),
      (window.innerHeight - 2 * targetY) / Math.max(1, window.innerHeight),
    ];

    gl.uniform2f(uniforms.uResolution, width, height);
    gl.uniform2f(uniforms.uScreenOffset, screenOffset[0], screenOffset[1]);
    gl.uniform1f(uniforms.uTime, stylePhase + motionPhase);
    gl.uniform3f(uniforms.uCameraPos, camera[0], camera[1], camera[2]);
    gl.uniformMatrix3fv(uniforms.uCameraBasis, false, cameraBasis);
    gl.uniform1f(uniforms.uFov, SDF_FOV_RADIANS);
    gl.uniform4fv(uniforms.uRings, sdfRingUniformData);
    gl.uniform1f(uniforms.uSphereR, state.sdfSphereR * rootScale);
    gl.uniform1f(uniforms.uBlend, state.sdfBlend * rootScale);
    gl.uniform1f(uniforms.uBloom, state.sdfBloom);
    gl.uniform1f(uniforms.uAniso, state.sdfAniso);
    gl.uniform1f(uniforms.uFxStrength, state.fxStrength);
    gl.uniform1f(uniforms.uFxMode, MOBILE_FX_MODE_INDEX[state.fxMode] || 0);
    gl.uniform1f(uniforms.uMotionPulse, state.softFx ? state.fxStrength : 0);
    gl.uniform1f(uniforms.uRippleTime, ripplePhaseAngle());
    gl.uniform3f(uniforms.uPalette0, sdfPaletteUniformData[0], sdfPaletteUniformData[1], sdfPaletteUniformData[2]);
    gl.uniform3f(uniforms.uPalette1, sdfPaletteUniformData[3], sdfPaletteUniformData[4], sdfPaletteUniformData[5]);
    gl.uniform3f(uniforms.uPalette2, sdfPaletteUniformData[6], sdfPaletteUniformData[7], sdfPaletteUniformData[8]);
    gl.uniform3f(uniforms.uPalette3, sdfPaletteUniformData[9], sdfPaletteUniformData[10], sdfPaletteUniformData[11]);
    gl.uniform3f(uniforms.uPalette4, sdfPaletteUniformData[12], sdfPaletteUniformData[13], sdfPaletteUniformData[14]);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    drawStats.modelVertices = points.length;
    drawStats.modelFaces = 1;
    drawStats.modelFaceFills = 1;
    drawStats.sdfRenderer = 'webgl-raymarch';
    drawStats.sdfQuality = profileKey;
    drawStats.sdfRasterScale = rasterScale;
    drawStats.sdfStaticPixelBoost = isStaticFrame ? pixelBoost : 1;
    drawStats.sdfMotionPixelBoost = profileKey === 'motion' ? pixelBoost : 1;
    drawStats.sdfRasterSize = Math.min(width, height);
    drawStats.sdfPixels = width * height;
    drawStats.sdfSpheres = points.length;
    drawStats.sdfMarchSteps = profile.marchSteps;
    drawStats.sdfNeighborSpan = profile.neighborSpan;
    drawStats.sdfShadowSteps = profile.shadowSteps;
    drawStats.sdfAoSteps = profile.aoSteps;
    return sdfProjectedFrameMetrics(layout, distance);
  } catch (error) {
    recordError(error);
    sdfWebglUnavailable = true;
    setSdfCanvasActive(false);
    return null;
  }
}

function ensureSdfRaster(size) {
  if (!sdfRasterCanvas) {
    sdfRasterCanvas = document.createElement('canvas');
    sdfRasterContext = sdfRasterCanvas.getContext('2d', { alpha: true });
  }
  if (sdfRasterCanvas.width !== size || sdfRasterCanvas.height !== size || !sdfRasterImageData) {
    sdfRasterCanvas.width = size;
    sdfRasterCanvas.height = size;
    sdfRasterImageData = sdfRasterContext.createImageData(size, size);
    sdfHeightField = new Float32Array(size * size);
    sdfCoverageField = new Float32Array(size * size);
    sdfRingField = new Uint8Array(size * size);
  }
  return !!sdfRasterContext;
}

function colorChannels(hex) {
  const value = String(hex || '#ffffff').replace('#', '').padEnd(6, 'f');
  return [0, 2, 4].map(offset => parseInt(value.slice(offset, offset + 2), 16));
}

function drawSdfFallbackModel(layout, paletteSet, drawStats, interactionLiteFrame) {
  const qualitySize = state.quality === 'sharp' ? 512 : state.quality === 'balanced' ? 400 : 320;
  const rasterSize = interactionLiteFrame ? Math.min(192, qualitySize) : qualitySize;
  if (!ensureSdfRaster(rasterSize)) return null;

  const pixels = sdfRasterImageData.data;
  sdfHeightField.fill(0);
  sdfCoverageField.fill(0);
  sdfRingField.fill(0);

  // The desktop raymarcher is a smooth union of the 240 root spheres, not a
  // generic decorative blob. Build the same Coxeter-plane surface as a small
  // reusable height field: each root contributes a shaded spherical cap and
  // nearby caps blend at their intersections. This keeps the view faithful
  // while avoiding a costly 240-sphere raymarch in a phone WebView.
  const phase = state.rotation + stylePhase * 0.015;
  const cos = Math.cos(phase);
  const sin = Math.sin(phase);
  const half = rasterSize * 0.5;
  const rootScale = rasterSize * 0.338;
  const sphereRadius = rasterSize * 0.047;
  const sphereRadius2 = sphereRadius * sphereRadius;
  const smoothK = Math.max(0.8, sphereRadius * 0.22);
  for (const point of points) {
    const rotatedX = point.x * cos - point.y * sin;
    const rotatedY = point.x * sin + point.y * cos;
    const cx = half + rotatedX * rootScale;
    const cy = half + rotatedY * rootScale;
    const minX = Math.max(0, Math.floor(cx - sphereRadius - 1));
    const maxX = Math.min(rasterSize - 1, Math.ceil(cx + sphereRadius + 1));
    const minY = Math.max(0, Math.floor(cy - sphereRadius - 1));
    const maxY = Math.min(rasterSize - 1, Math.ceil(cy + sphereRadius + 1));
    for (let py = minY; py <= maxY; py++) {
      const dy = py + 0.5 - cy;
      for (let px = minX; px <= maxX; px++) {
        const dx = px + 0.5 - cx;
        const distance2 = dx * dx + dy * dy;
        if (distance2 > sphereRadius2) continue;
        const offset = py * rasterSize + px;
        const height = Math.sqrt(Math.max(0, sphereRadius2 - distance2));
        const previous = sdfHeightField[offset];
        if (previous <= 0) sdfHeightField[offset] = height;
        else {
          const difference = Math.abs(previous - height);
          const blend = Math.max(0, smoothK - difference);
          sdfHeightField[offset] = Math.max(previous, height) + blend * blend / (4 * smoothK);
        }
        const edgeDistance = sphereRadius - Math.sqrt(distance2);
        sdfCoverageField[offset] = Math.max(sdfCoverageField[offset], clamp(edgeDistance * 1.7, 0, 1));
        if (height >= previous) sdfRingField[offset] = point.ring;
      }
    }
  }

  const low = colorChannels(paletteSet.colors[0]);
  const high = colorChannels(paletteSet.colors[Math.min(2, paletteSet.colors.length - 1)]);
  let filledPixels = 0;
  for (let py = 0; py < rasterSize; py++) {
    for (let px = 0; px < rasterSize; px++) {
      const offset = (py * rasterSize + px) * 4;
      const fieldOffset = py * rasterSize + px;
      const coverage = sdfCoverageField[fieldOffset];
      if (coverage <= 0) {
        pixels[offset] = 0;
        pixels[offset + 1] = 0;
        pixels[offset + 2] = 0;
        pixels[offset + 3] = 0;
        continue;
      }
      const leftHeight = sdfHeightField[py * rasterSize + Math.max(0, px - 1)];
      const rightHeight = sdfHeightField[py * rasterSize + Math.min(rasterSize - 1, px + 1)];
      const topHeight = sdfHeightField[Math.max(0, py - 1) * rasterSize + px];
      const bottomHeight = sdfHeightField[Math.min(rasterSize - 1, py + 1) * rasterSize + px];
      const normalX = clamp(leftHeight - rightHeight, -4.5, 4.5);
      const normalY = clamp(topHeight - bottomHeight, -4.5, 4.5);
      const normalZ = 2.4;
      const normalLength = Math.hypot(normalX, normalY, normalZ) || 1;
      const nx = normalX / normalLength;
      const ny = normalY / normalLength;
      const nz = normalZ / normalLength;
      const diffuse = clamp(nx * -0.42 + ny * -0.58 + nz * 0.7, 0, 1);
      const rim = clamp(1 - nz, 0, 1);
      const contour = clamp(1 - coverage, 0, 1);
      const paletteMix = clamp((sdfRingField[fieldOffset] / 7) * 0.78 + nx * 0.14 + 0.08, 0, 1);
      const light = 0.24 + diffuse * 0.72 + rim * 0.24;
      for (let channel = 0; channel < 3; channel++) {
        const base = low[channel] + (high[channel] - low[channel]) * paletteMix;
        pixels[offset + channel] = clamp(Math.round(base * light + 255 * contour * 0.22), 0, 255);
      }
      pixels[offset + 3] = Math.round(coverage * 255);
      filledPixels++;
    }
  }
  sdfRasterContext.putImageData(sdfRasterImageData, 0, 0);

  const diameter = layout.scale * 2.42;
  const left = layout.cx + state.panX - diameter * 0.5;
  const top = layout.cy + state.panY - diameter * 0.5;
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(sdfRasterCanvas, left, top, diameter, diameter);
  ctx.restore();

  drawStats.modelVertices = points.length;
  drawStats.modelFaces = 1;
  drawStats.modelFaceFills = 1;
  drawStats.sdfRasterSize = rasterSize;
  drawStats.sdfPixels = filledPixels;
  drawStats.sdfSpheres = points.length;
  drawStats.sdfRenderer = 'canvas-fallback';
  return projectedModelFrameMetrics([
    { x: left, y: top },
    { x: left + diameter, y: top + diameter },
  ]);
}

function drawSdfModel(layout, paletteSet, drawStats, interactionLiteFrame) {
  setSdfCanvasActive(true);
  const webglFrame = drawSdfWebglModel(layout, paletteSet, drawStats, interactionLiteFrame);
  if (webglFrame) return webglFrame;
  setSdfCanvasActive(false);
  return drawSdfFallbackModel(layout, paletteSet, drawStats, interactionLiteFrame);
}

function normalizedPlatonicVerts(shape) {
  const verts = shape?.verts || [];
  let maxR = 0;
  for (const v of verts) maxR = Math.max(maxR, Math.hypot(v[0], v[1], v[2]));
  const denom = maxR || 1;
  return verts.map(v => [v[0] / denom, v[1] / denom, v[2] / denom]);
}

// The baked dodecahedron and icosahedron triangle lists are unsuitable for
// mobile painter-style rendering: they expose their triangulation and can read
// as diagonals through the solid. Recover the actual convex face polygons from
// the vertices, matching the desktop view's hull-first geometry policy.
function convexHullPolygons(verts) {
  const count = verts.length;
  if (count < 4) return [];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  let maxR = 0;
  for (const v of verts) maxR = Math.max(maxR, Math.hypot(v[0], v[1], v[2]));
  const epsilon = 1e-4 * (maxR || 1);
  const planes = new Map();

  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      for (let k = j + 1; k < count; k++) {
        let normal = cross(sub(verts[j], verts[i]), sub(verts[k], verts[i]));
        const length = Math.hypot(normal[0], normal[1], normal[2]);
        if (length < epsilon) continue;
        normal = [normal[0] / length, normal[1] / length, normal[2] / length];
        let distance = dot(normal, verts[i]);
        let positive = 0;
        let negative = 0;
        for (let m = 0; m < count; m++) {
          const side = dot(normal, verts[m]) - distance;
          if (side > epsilon) positive++;
          else if (side < -epsilon) negative++;
        }
        if (positive && negative) continue;
        if (distance < 0) {
          normal = [-normal[0], -normal[1], -normal[2]];
          distance = -distance;
        }
        const key = [normal[0], normal[1], normal[2], distance]
          .map(value => Math.round(value / epsilon))
          .join(',');
        if (!planes.has(key)) planes.set(key, { normal, distance });
      }
    }
  }

  const polygons = [];
  for (const { normal, distance } of planes.values()) {
    const indices = [];
    for (let i = 0; i < count; i++) {
      if (Math.abs(dot(normal, verts[i]) - distance) < epsilon * 10) indices.push(i);
    }
    if (indices.length < 3) continue;
    let axis = Math.abs(normal[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const projection = dot(axis, normal);
    axis = [
      axis[0] - projection * normal[0],
      axis[1] - projection * normal[1],
      axis[2] - projection * normal[2],
    ];
    const axisLength = Math.hypot(axis[0], axis[1], axis[2]);
    axis = [axis[0] / axisLength, axis[1] / axisLength, axis[2] / axisLength];
    const tangent = cross(normal, axis);
    const center = [0, 0, 0];
    for (const index of indices) {
      center[0] += verts[index][0];
      center[1] += verts[index][1];
      center[2] += verts[index][2];
    }
    center[0] /= indices.length;
    center[1] /= indices.length;
    center[2] /= indices.length;
    indices.sort((a, b) => {
      const pointA = sub(verts[a], center);
      const pointB = sub(verts[b], center);
      return Math.atan2(dot(pointA, tangent), dot(pointA, axis))
        - Math.atan2(dot(pointB, tangent), dot(pointB, axis));
    });
    polygons.push(indices);
  }
  return polygons;
}

function platonicFaces(shapeName, shape) {
  if (!shape) return [];
  if (platonicFaceCache.has(shapeName)) return platonicFaceCache.get(shapeName);
  const faces = STAR_SHAPES.has(shapeName)
    ? (Array.isArray(shape.faces) ? shape.faces.filter(face => Array.isArray(face) && face.length >= 3) : [])
    : convexHullPolygons(shape.verts || []);
  platonicFaceCache.set(shapeName, faces);
  return faces;
}

function projectedPolygonArea(face, projected) {
  let area = 0;
  for (let i = 0; i < face.length; i++) {
    const a = projected[face[i]];
    const b = projected[face[(i + 1) % face.length]];
    if (a && b) area += a.x * b.y - b.x * a.y;
  }
  return area * 0.5;
}

function paletteChannelsAt(paletteSet, value) {
  const colors = paletteSet?.colors?.length ? paletteSet.colors : RENDER_PALETTES.gold.colors;
  if (colors.length === 1) return colorChannels(colors[0]);
  const scaled = clamp(value, 0, 1) * (colors.length - 1);
  const lowerIndex = Math.min(colors.length - 1, Math.floor(scaled));
  const upperIndex = Math.min(colors.length - 1, lowerIndex + 1);
  const amount = scaled - lowerIndex;
  const lower = colorChannels(colors[lowerIndex]);
  const upper = colorChannels(colors[upperIndex]);
  return lower.map((channel, index) => Math.round(channel + (upper[index] - channel) * amount));
}

function paletteColorAt(paletteSet, value) {
  const channels = paletteChannelsAt(paletteSet, value);
  return `rgb(${channels[0]},${channels[1]},${channels[2]})`;
}

function ripplePhaseAngle() {
  // stylePhase advances at a battery-friendly mobile rate. This multiplier
  // restores the roughly four-radians-per-second wave travel used on desktop.
  return stylePhase * TAU * 2.4;
}

function rippleWaveForRadius(radius) {
  return Math.sin(Math.max(0, radius) * 8 - ripplePhaseAngle());
}

function ripplePointScale(radius) {
  if (state.fxMode !== 'ripple') return 1;
  return clamp(1 + state.fxStrength * 0.4 * rippleWaveForRadius(radius), 0.42, 1.62);
}

function projectedRadius(point, layout) {
  const x = Number.isFinite(point?.sx) ? point.sx : point?.x;
  const y = Number.isFinite(point?.sy) ? point.sy : point?.y;
  const originX = layout.cx + state.panX;
  const originY = layout.cy + state.panY;
  return Math.hypot((x || 0) - originX, (y || 0) - originY) / Math.max(1, layout.scale);
}

function drawPaletteEdgeField(projected, edges, layout, paletteSet, options = {}) {
  if (!Array.isArray(edges) || !edges.length) {
    return { segments: 0, strokes: 0, colorBands: 0, brightnessBands: 0, ripple: false };
  }
  const ripple = state.fxMode === 'ripple';
  const colorBandCount = Math.max(1, Number(options.colorBands) || RIPPLE_COLOR_BANDS);
  const brightnessBandCount = ripple ? RIPPLE_BRIGHTNESS_BANDS : 1;
  const buckets = Array.from({ length: colorBandCount * brightnessBandCount }, () => []);
  const usedColors = new Set();
  const usedBrightness = new Set();
  const colorOffset = Number(options.colorOffset) || 0;
  let segments = 0;

  for (const edge of edges) {
    const a = projected[edge[0]];
    const b = projected[edge[1]];
    if (!a || !b) continue;
    const ax = Number.isFinite(a.sx) ? a.sx : a.x;
    const ay = Number.isFinite(a.sy) ? a.sy : a.y;
    const bx = Number.isFinite(b.sx) ? b.sx : b.x;
    const by = Number.isFinite(b.sy) ? b.sy : b.y;
    if (![ax, ay, bx, by].every(Number.isFinite)) continue;
    const midpointX = (ax + bx) * 0.5;
    const midpointY = (ay + by) * 0.5;
    const radius = Math.hypot(
      midpointX - layout.cx - state.panX,
      midpointY - layout.cy - state.panY,
    ) / Math.max(1, layout.scale);
    const wave = rippleWaveForRadius(radius);
    const wave01 = ripple ? clamp(0.5 + wave * 0.5, 0, 1) : 0.5;
    const brightnessBand = ripple
      ? Math.min(brightnessBandCount - 1, Math.floor(wave01 * brightnessBandCount))
      : 0;
    const angleT = (Math.atan2(midpointY - layout.cy - state.panY, midpointX - layout.cx - state.panX) + Math.PI) / TAU;
    const topologyT = ((edge[0] * 37 + edge[1] * 17) % 97) / 96;
    const colorT = ((angleT * 0.46 + topologyT * 0.54 + colorOffset) % 1 + 1) % 1;
    const colorBand = Math.min(colorBandCount - 1, Math.floor(colorT * colorBandCount));
    buckets[brightnessBand * colorBandCount + colorBand].push(edge);
    usedColors.add(colorBand);
    usedBrightness.add(brightnessBand);
    segments++;
  }

  const baseAlpha = clamp(Number(options.baseAlpha) || 0.72, 0.02, 1);
  const baseWidth = Math.max(0.35, Number(options.baseWidth) || 1.2);
  let strokes = 0;
  ctx.save();
  ctx.globalCompositeOperation = options.composite || 'source-over';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let brightnessBand = 0; brightnessBand < brightnessBandCount; brightnessBand++) {
    const wave01 = brightnessBandCount === 1 ? 0.5 : brightnessBand / (brightnessBandCount - 1);
    const brightness = ripple ? 0.28 + wave01 * 1.22 : 1;
    for (let colorBand = 0; colorBand < colorBandCount; colorBand++) {
      const bucket = buckets[brightnessBand * colorBandCount + colorBand];
      if (!bucket.length) continue;
      const color = paletteColorAt(paletteSet, colorBandCount === 1 ? 0 : colorBand / (colorBandCount - 1));
      ctx.globalAlpha = clamp(baseAlpha * brightness, 0.03, 1);
      ctx.lineWidth = baseWidth * (ripple ? 0.8 + wave01 * 0.38 : 1);
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = options.shadowBlur ? Number(options.shadowBlur) * (ripple ? 0.45 + wave01 * 0.8 : 1) : 0;
      ctx.beginPath();
      for (const edge of bucket) {
        const a = projected[edge[0]];
        const b = projected[edge[1]];
        const ax = Number.isFinite(a.sx) ? a.sx : a.x;
        const ay = Number.isFinite(a.sy) ? a.sy : a.y;
        const bx = Number.isFinite(b.sx) ? b.sx : b.x;
        const by = Number.isFinite(b.sy) ? b.sy : b.y;
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
      }
      ctx.stroke();
      strokes++;
    }
  }
  ctx.restore();
  return {
    segments,
    strokes,
    colorBands: usedColors.size,
    brightnessBands: usedBrightness.size,
    ripple,
  };
}

function recordRippleEdgeStats(drawStats, edgeStats) {
  if (state.fxMode !== 'ripple' || !edgeStats?.segments) return false;
  drawStats.rippleEdgeSegments += edgeStats.segments;
  drawStats.rippleEdgeStrokes += edgeStats.strokes;
  drawStats.rippleColorBands = Math.max(drawStats.rippleColorBands, edgeStats.colorBands);
  drawStats.rippleBrightnessBands = Math.max(drawStats.rippleBrightnessBands, edgeStats.brightnessBands);
  drawStats.nativeFxApplied = true;
  drawStats.nativeFxPrimitives += edgeStats.segments;
  drawStats.nativeFxRenderer = 'geometry-ripple';
  return true;
}

function modelEdgeKey(a, b) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

function drawPlatonicModel(layout, paletteSet, drawStats, interactionLiteFrame) {
  const shapeName = SUPPORTED_SHAPES.has(state.shape) ? state.shape : DEFAULT_STATE.shape;
  const shape = platonicGeometry[shapeName] || platonicGeometry[DEFAULT_STATE.shape];
  if (!shape) return null;
  const verts = normalizedPlatonicVerts(shape);
  const projected = verts.map(v => projectModelPoint(v[0], v[1], v[2], layout, 1.04));
  const faces = platonicFaces(shapeName, shape);
  const edges = shape.edges || [];
  const isStar = STAR_SHAPES.has(shapeName);
  drawStats.modelVertices = verts.length;
  drawStats.modelProjectedVertices = projected.length;
  drawStats.modelEdges = edges.length;
  drawStats.modelFaces = faces.length;
  drawStats.modelFacePolygons = faces.length;
  const frame = projectedModelFrameMetrics(projected);

  let visibleEdges = edges;
  if (!interactionLiteFrame) {
    const entries = faces
      .map(face => ({
        face,
        depth: face.reduce((total, idx) => total + (projected[idx]?.z || 0), 0) / face.length,
        front: isStar || projectedPolygonArea(face, projected) < 0,
      }))
      .sort((a, b) => b.depth - a.depth);
    const frontEdgeKeys = new Set();
    if (!isStar) {
      for (const entry of entries) {
        if (!entry.front) continue;
        for (let i = 0; i < entry.face.length; i++) {
          frontEdgeKeys.add(modelEdgeKey(entry.face[i], entry.face[(i + 1) % entry.face.length]));
        }
      }
      visibleEdges = edges.filter(edge => frontEdgeKeys.has(modelEdgeKey(edge[0], edge[1])));
    }

    // Rear structure is drawn first, then covered by the solid faces. This
    // preserves a little depth context without putting every hidden edge on top.
    ctx.save();
    ctx.globalAlpha = isStar ? 0.26 : 0.12;
    ctx.strokeStyle = paletteSet.colors[2] || paletteSet.colors[0];
    ctx.lineWidth = 1.1;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const edge of edges) {
      const a = projected[edge[0]];
      const b = projected[edge[1]];
      if (!a || !b) continue;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    ctx.restore();

    const depths = entries.map(entry => entry.depth);
    const minDepth = depths.length ? Math.min(...depths) : 0;
    const maxDepth = depths.length ? Math.max(...depths) : 1;
    const depthSpan = maxDepth - minDepth || 1;
    ctx.save();
    ctx.lineJoin = 'round';
    for (const entry of entries) {
      const first = projected[entry.face[0]];
      if (!first) continue;
      const depthT = clamp((entry.depth - minDepth) / depthSpan, 0, 1);
      const colorIndex = Math.min(paletteSet.colors.length - 1, Math.floor(depthT * paletteSet.colors.length));
      ctx.globalAlpha = isStar ? 0.22 : (entry.front ? 0.72 : 0.2);
      ctx.fillStyle = paletteSet.colors[colorIndex] || paletteSet.colors[0];
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      for (let i = 1; i < entry.face.length; i++) {
        const point = projected[entry.face[i]];
        if (point) ctx.lineTo(point.x, point.y);
      }
      ctx.closePath();
      ctx.fill();
      drawStats.modelFaceFills++;
    }
    ctx.restore();
    drawStats.modelFrontFaces = entries.filter(entry => entry.front).length;
    drawStats.modelBackFaces = entries.length - drawStats.modelFrontFaces;
    drawStats.modelFaceAlpha = isStar ? 0.22 : 0.72;
    drawStats.modelHiddenEdgeAlpha = isStar ? 0.26 : 0.12;
  }

  const edgeWidth = interactionLiteFrame ? 1.5 : 2.2;
  const edgeAlpha = interactionLiteFrame ? 0.82 : 0.96;
  if (state.fxMode === 'ripple') {
    const edgeStats = drawPaletteEdgeField(projected, visibleEdges, layout, paletteSet, {
      baseAlpha: edgeAlpha,
      baseWidth: edgeWidth,
      shadowBlur: interactionLiteFrame ? 0 : 3,
    });
    drawStats.modelEdgeStrokes = edgeStats.strokes + (interactionLiteFrame ? 0 : 1);
    recordRippleEdgeStats(drawStats, edgeStats);
  } else {
    ctx.save();
    ctx.lineWidth = edgeWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.globalAlpha = edgeAlpha;
    ctx.strokeStyle = paletteSet.colors[0];
    ctx.shadowColor = paletteSet.colors[1] || paletteSet.colors[0];
    ctx.shadowBlur = interactionLiteFrame ? 0 : 3;
    ctx.beginPath();
    for (const edge of visibleEdges) {
      const a = projected[edge[0]];
      const b = projected[edge[1]];
      if (!a || !b) continue;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    ctx.restore();
    drawStats.modelEdgeStrokes = edges.length ? (interactionLiteFrame ? 1 : 2) : 0;
  }
  drawStats.modelVisibleEdges = visibleEdges.length;
  drawStats.modelHiddenEdges = Math.max(0, edges.length - visibleEdges.length);
  drawStats.modelEdgeWidth = edgeWidth;
  drawStats.modelEdgeAlpha = edgeAlpha;
  drawStats.modelEdgeColor = paletteSet.colors[0];

  if (state.showVertices) {
    const ordered = projected
      .map((point, idx) => ({ point, idx }))
      .sort((a, b) => a.point.z - b.point.z);
    ctx.save();
    ctx.globalAlpha = state.pointOpacity;
    for (const entry of ordered) {
      const pulse = state.softFx ? 1 + Math.sin(stylePhase * TAU + entry.idx * 0.17) * 0.06 * state.fxStrength : 1;
      const rippleScale = ripplePointScale(projectedRadius(entry.point, layout));
      const radius = Math.max(2.4, 4.2 * (0.76 + entry.point.perspective * 0.32) * state.pointScale * pulse * rippleScale);
      if (state.fxMode === 'ripple') {
        drawStats.ripplePointCount++;
        drawStats.nativeFxApplied = true;
        drawStats.nativeFxPrimitives++;
        drawStats.nativeFxRenderer = 'geometry-ripple';
      }
      ctx.beginPath();
      ctx.arc(entry.point.x, entry.point.y, radius, 0, TAU);
      ctx.fillStyle = paletteSet.colors[entry.idx % paletteSet.colors.length];
      ctx.fill();
      drawStats.directPoints++;
      drawStats.directPointFills++;
      drawStats.modelVertexFills++;
    }
    ctx.restore();
  }

  return frame;
}

function normalizedPolytope4DVerts(poly) {
  const verts = poly?.verts || [];
  let maxR = 0;
  for (const v of verts) maxR = Math.max(maxR, Math.hypot(v[0], v[1], v[2], v[3]));
  const denom = maxR || 1;
  return verts.map(v => [v[0] / denom, v[1] / denom, v[2] / denom, v[3] / denom]);
}

function rotate4DVector(v, angle) {
  let [x, y, z, w] = v;
  let c = Math.cos(angle);
  let s = Math.sin(angle);
  [x, y] = [x * c - y * s, x * s + y * c];
  c = Math.cos(angle * 0.73 + 0.31);
  s = Math.sin(angle * 0.73 + 0.31);
  [z, w] = [z * c - w * s, z * s + w * c];
  c = Math.cos(angle * 0.47 + 0.18);
  s = Math.sin(angle * 0.47 + 0.18);
  [x, z] = [x * c - z * s, x * s + z * c];
  c = Math.cos(angle * 0.39 + 0.43);
  s = Math.sin(angle * 0.39 + 0.43);
  [y, w] = [y * c - w * s, y * s + w * c];
  return [x, y, z, w];
}

function project4DTo3D(v) {
  const denom = Math.max(0.72, 1.55 - v[3] * 0.34);
  return [v[0] / denom, v[1] / denom, v[2] / denom];
}

function drawPolytope4DModel(layout, paletteSet, drawStats, interactionLiteFrame) {
  const polyName = SUPPORTED_POLYTOPES4D.has(state.polytope4d) ? state.polytope4d : DEFAULT_STATE.polytope4d;
  const poly = polytope4DGeometry[polyName] || polytope4DGeometry[DEFAULT_STATE.polytope4d];
  if (!poly) return null;
  const verts4 = normalizedPolytope4DVerts(poly);
  const projected = verts4.map(v => {
    const rotated = rotate4DVector(v, state.rotation);
    const [x, y, z] = project4DTo3D(rotated);
    const dense = polyName === '600cell' || polyName === '120cell';
    const point = projectModelPoint(x, y, z, layout, dense ? 1.22 : 1.16);
    point.w = rotated[3];
    return point;
  });
  drawStats.points = projected.length;
  drawStats.modelVertices = projected.length;
  drawStats.modelProjectedVertices = projected.length;
  drawStats.modelEdges = poly.edges?.length || 0;
  drawStats.polytope4d = polyName;
  drawStats.polytope4dLabel = POLYTOPE4D_LABELS[polyName] || polyName;
  const frame = projectedModelFrameMetrics(projected);

  const dense = polyName === '600cell' || polyName === '120cell';
  const edgeWidth = dense ? (interactionLiteFrame ? 0.72 : 1.05) : (interactionLiteFrame ? 1.25 : 1.9);
  const edgeAlpha = dense ? (interactionLiteFrame ? 0.58 : 0.74) : (interactionLiteFrame ? 0.82 : 0.96);
  if (state.fxMode === 'ripple') {
    const edgeStats = drawPaletteEdgeField(projected, poly.edges || [], layout, paletteSet, {
      baseAlpha: dense ? edgeAlpha * 0.62 : edgeAlpha * 0.84,
      baseWidth: edgeWidth,
      shadowBlur: interactionLiteFrame ? 0 : (dense ? 0.8 : 2.2),
      composite: 'source-over',
    });
    drawStats.modelEdgeStrokes = edgeStats.strokes;
    recordRippleEdgeStats(drawStats, edgeStats);
  } else {
    ctx.save();
    ctx.lineWidth = edgeWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.globalAlpha = edgeAlpha;
    ctx.strokeStyle = paletteSet.colors[0];
    ctx.shadowColor = paletteSet.colors[1] || paletteSet.colors[0];
    ctx.shadowBlur = interactionLiteFrame ? 0 : (dense ? 1.5 : 3);
    ctx.beginPath();
    for (const edge of poly.edges || []) {
      const a = projected[edge[0]];
      const b = projected[edge[1]];
      if (!a || !b) continue;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    ctx.restore();
    drawStats.modelEdgeStrokes = poly.edges?.length ? 1 : 0;
  }
  drawStats.modelEdgeWidth = edgeWidth;
  drawStats.modelEdgeAlpha = edgeAlpha;
  drawStats.modelEdgeColor = paletteSet.colors[0];

  if (state.showVertices) {
    const classes = Array.isArray(poly.conjugacy_classes) ? poly.conjugacy_classes : null;
    const ordered = projected
      .map((point, idx) => ({ point, idx }))
      .sort((a, b) => a.point.z - b.point.z);
    ctx.save();
    ctx.globalAlpha = state.pointOpacity;
    for (const entry of ordered) {
      const cls = classes ? classes[entry.idx] || 0 : entry.idx;
      const pulse = state.softFx ? 1 + Math.sin(stylePhase * TAU + entry.idx * 0.17) * 0.06 * state.fxStrength : 1;
      const baseRadius = dense ? 2.7 : 4.2;
      const rippleScale = ripplePointScale(projectedRadius(entry.point, layout));
      const radius = Math.max(2, baseRadius * (0.76 + entry.point.perspective * 0.32) * state.pointScale * pulse * rippleScale);
      if (state.fxMode === 'ripple') {
        drawStats.ripplePointCount++;
        drawStats.nativeFxApplied = true;
        drawStats.nativeFxPrimitives++;
        drawStats.nativeFxRenderer = 'geometry-ripple';
      }
      ctx.beginPath();
      ctx.arc(entry.point.x, entry.point.y, radius, 0, TAU);
      ctx.fillStyle = paletteSet.colors[cls % paletteSet.colors.length];
      ctx.fill();
      drawStats.directPoints++;
      drawStats.directPointFills++;
      drawStats.modelVertexFills++;
    }
    ctx.restore();
  }
  return frame;
}

function normalizedDynkinNodes(diagram) {
  const nodes = diagram?.nodes || [];
  if (!nodes.length) return [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const node of nodes) {
    minX = Math.min(minX, node[0]);
    maxX = Math.max(maxX, node[0]);
    minY = Math.min(minY, node[1]);
    maxY = Math.max(maxY, node[1]);
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const span = Math.max(1, maxX - minX, maxY - minY);
  return nodes.map(node => [(node[0] - cx) / span * 2.05, (node[1] - cy) / span * 2.05]);
}

function dynkinSelectedNodeIndex() {
  if (state.dynkinDiagram !== 'E8' || state.selectedRoot == null) return -1;
  return simpleRootIndices.indexOf(state.selectedRoot);
}

function drawDynkinModel(layout, paletteSet, drawStats, interactionLiteFrame) {
  const diagramName = SUPPORTED_DYNKIN_DIAGRAMS.has(state.dynkinDiagram) ? state.dynkinDiagram : DEFAULT_STATE.dynkinDiagram;
  const diagram = dynkinGeometry[diagramName] || dynkinGeometry[DEFAULT_STATE.dynkinDiagram];
  dynkinHitTargets = [];
  if (!diagram) return null;
  const nodes = normalizedDynkinNodes(diagram);
  const angle = state.rotation * 0.35;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const scale = layout.scale * 1.05;
  const projected = nodes.map((node, index) => {
    const x = node[0] * cos - node[1] * sin;
    const y = node[0] * sin + node[1] * cos;
    const point = {
      x: layout.cx + state.panX + x * scale,
      y: layout.cy + state.panY + y * scale,
      z: 0,
      perspective: 1,
      index,
    };
    dynkinHitTargets.push(point);
    return point;
  });
  drawStats.points = projected.length;
  drawStats.modelVertices = projected.length;
  drawStats.modelProjectedVertices = projected.length;
  drawStats.modelEdges = diagram.edges?.length || 0;
  drawStats.dynkinDiagram = diagramName;
  drawStats.dynkinLabel = DYNKIN_LABELS[diagramName] || diagramName;
  drawStats.dynkinSelectedNode = dynkinSelectedNodeIndex();
  const frame = projectedModelFrameMetrics(projected);

  const edgeWidth = interactionLiteFrame ? 2 : 2.5;
  if (state.fxMode === 'ripple') {
    const edgeStats = drawPaletteEdgeField(projected, diagram.edges || [], layout, paletteSet, {
      baseAlpha: 0.88,
      baseWidth: edgeWidth,
      shadowBlur: interactionLiteFrame ? 0 : 2,
    });
    drawStats.modelEdgeStrokes = edgeStats.strokes;
    recordRippleEdgeStats(drawStats, edgeStats);
  } else {
    ctx.save();
    ctx.lineWidth = edgeWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = paletteSet.petrieStroke;
    ctx.beginPath();
    for (const edge of diagram.edges || []) {
      const a = projected[edge[0]];
      const b = projected[edge[1]];
      if (!a || !b) continue;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
    ctx.stroke();
    ctx.restore();
    drawStats.modelEdgeStrokes = diagram.edges?.length ? 1 : 0;
  }

  const selectedNode = drawStats.dynkinSelectedNode;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 13px system-ui, sans-serif';
  for (const point of projected) {
    const isSelected = point.index === selectedNode;
    const pulse = state.softFx ? 1 + Math.sin(stylePhase * TAU + point.index * 0.5) * 0.06 * state.fxStrength : 1;
    const rippleScale = ripplePointScale(projectedRadius(point, layout));
    const radius = (isSelected ? 17 : 14) * state.pointScale * pulse * rippleScale;
    if (state.fxMode === 'ripple') {
      drawStats.ripplePointCount++;
      drawStats.nativeFxApplied = true;
      drawStats.nativeFxPrimitives++;
      drawStats.nativeFxRenderer = 'geometry-ripple';
    }
    if (isSelected && !interactionLiteFrame) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, radius + 10, 0, TAU);
      ctx.fillStyle = paletteSet.glowSelected;
      ctx.fill();
      drawStats.glowFills++;
    }
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, TAU);
    ctx.fillStyle = isSelected ? paletteSet.colors[2] : paletteSet.colors[point.index % paletteSet.colors.length];
    ctx.fill();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = colorWithAlpha('#07070c', 0.7);
    ctx.stroke();
    ctx.fillStyle = '#07070c';
    ctx.fillText(`a${point.index + 1}`, point.x, point.y);
    drawStats.directPoints++;
    drawStats.directPointFills++;
  }
  ctx.restore();
  return frame;
}

function projectedModelFrameMetrics(projected) {
  if (!projected.length) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of projected) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const view = usableViewBounds();
  return {
    minX,
    maxX,
    minY,
    maxY,
    withinView: minX >= view.left && maxX <= view.right && minY >= view.top && maxY <= view.bottom,
    view,
  };
}

function getSelectedContext() {
  if (state.selectedRoot == null) return null;
  const point = points[state.selectedRoot];
  if (!point) return null;
  return point.context;
}

function drawRings(layout, paletteSet) {
  const stats = { rings: 0, strokes: 0, scaleFactors: ringRadiusFactors.length, colorCacheHits: 0 };
  if (!ringRadiusFactors.length) return stats;
  const cx = layout.cx + state.panX;
  const cy = layout.cy + state.panY;
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = paletteSet.ringStroke;
  stats.colorCacheHits++;
  ctx.beginPath();
  for (const factor of ringRadiusFactors) {
    const radius = factor * layout.scale;
    ctx.moveTo(cx + radius, cy);
    ctx.arc(cx, cy, radius, 0, TAU);
    stats.rings++;
  }
  if (stats.rings) {
    ctx.stroke();
    stats.strokes = 1;
  }
  ctx.restore();
  return stats;
}

function drawNeighborRays(context, paletteSet) {
  const selected = context.point;
  const stats = { rays: 0, strokes: 0, colorCacheHits: 0 };
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = paletteSet.rayStroke;
  stats.colorCacheHits++;
  ctx.beginPath();
  for (const idx of context.neighbors) {
    const p = points[idx];
    if (!p) continue;
    ctx.moveTo(selected.sx, selected.sy);
    ctx.lineTo(p.sx, p.sy);
    stats.rays++;
  }
  if (stats.rays) {
    ctx.stroke();
    stats.strokes = 1;
  }
  ctx.restore();
  return stats;
}

function drawMirrorLines(layout, paletteSet) {
  const stats = { lines: 0, strokes: 0, colorCacheHits: 0 };
  if (!simpleRootIndices.length) return stats;
  const cos = Math.cos(state.rotation);
  const sin = Math.sin(state.rotation);
  const cx = layout.cx + state.panX;
  const cy = layout.cy + state.panY;
  const len = layout.scale * 1.85;
  ctx.save();
  ctx.lineWidth = 1;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = paletteSet.mirrorStroke;
  stats.colorCacheHits++;
  ctx.beginPath();
  for (const idx of simpleRootIndices) {
    const p = points[idx];
    if (!p) continue;
    const rx = p.x * cos - p.y * sin;
    const ry = p.x * sin + p.y * cos;
    const mag = Math.hypot(rx, ry) || 1;
    const dx = -ry / mag;
    const dy = rx / mag;
    ctx.moveTo(cx - dx * len, cy - dy * len);
    ctx.lineTo(cx + dx * len, cy + dy * len);
    stats.lines++;
  }
  if (stats.lines) {
    ctx.stroke();
    stats.strokes = 1;
    metrics.mirrorDrawCount++;
    metrics.lastMirrorDrawMs = performance.now();
  }
  ctx.restore();
  return stats;
}

function drawPetrieCycle(paletteSet) {
  const stats = { segments: 0, strokes: 0, colorCacheHits: 0 };
  if (petrieCycle.length < 2) return stats;
  ctx.save();
  ctx.lineWidth = 1.6;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = paletteSet.petrieStroke;
  stats.colorCacheHits++;
  ctx.beginPath();
  for (let i = 0; i <= petrieCycle.length; i++) {
    const p = points[petrieCycle[i % petrieCycle.length]];
    if (!p) continue;
    if (i === 0) ctx.moveTo(p.sx, p.sy);
    else {
      ctx.lineTo(p.sx, p.sy);
      stats.segments++;
    }
  }
  if (stats.segments) {
    ctx.stroke();
    stats.strokes = 1;
    metrics.petrieDrawCount++;
    metrics.lastPetrieDrawMs = performance.now();
  }
  ctx.restore();
  return stats;
}

function drawBasePointBatches(palette) {
  const stats = { points: 0, fills: 0, buckets: 0 };
  ctx.save();
  ctx.globalAlpha = state.pointOpacity;
  for (let slot = 0; slot < basePointBuckets.length; slot++) {
    const batch = basePointBuckets[slot];
    if (!batch.length) continue;
    ctx.beginPath();
    for (const p of batch) {
      ctx.moveTo(p.sx + p.size, p.sy);
      ctx.arc(p.sx, p.sy, p.size, 0, TAU);
      stats.points++;
    }
    ctx.fillStyle = palette[slot % palette.length] || palette[0];
    ctx.fill();
    stats.fills++;
    stats.buckets++;
  }
  ctx.restore();
  return stats;
}

function basePointFill(p, palette) {
  return palette[p.baseFillSlot % palette.length] || palette[0];
}

function drawPoint(p, paletteSet, mask, skipGlow = false) {
  const palette = paletteSet.colors;
  const inSubset = !!(mask & DRAW_SUBSET);
  const selected = !!(mask & DRAW_SELECTED);
  const neighbor = !!(mask & DRAW_NEIGHBOR);
  const antipode = !!(mask & DRAW_ANTIPODE);
  const inPetrie = !!(mask & DRAW_PETRIE);
  const fill = selected || neighbor ? palette[2] : antipode ? palette[1] : inSubset || inPetrie ? palette[2] : basePointFill(p, palette);
  const pulse = state.softFx ? 1 + Math.sin(stylePhase * TAU) * 0.06 * state.fxStrength : 1;
  const radius = (selected ? p.size + 5 : neighbor ? p.size + 2.5 : inSubset ? p.size + 2 : antipode ? p.size + 1.5 : inPetrie ? p.size + 1 : p.size) * pulse;
  let fills = 0;
  if (!skipGlow && (inSubset || selected || neighbor || antipode || inPetrie)) {
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, radius + 5, 0, TAU);
    ctx.fillStyle = selected ? paletteSet.glowSelected : neighbor ? paletteSet.glowNeighbor : antipode ? paletteSet.glowAntipode : inSubset ? paletteSet.glowSubset : paletteSet.glowPetrie;
    ctx.globalAlpha = Math.min(1, state.fxStrength);
    ctx.fill();
    ctx.globalAlpha = 1;
    fills++;
  }
  ctx.beginPath();
  ctx.arc(p.sx, p.sy, radius, 0, TAU);
  ctx.fillStyle = fill;
  ctx.globalAlpha = selected ? 1 : neighbor ? 0.96 : inSubset ? 0.92 : antipode ? 0.88 : inPetrie ? 0.9 : state.pointOpacity;
  ctx.fill();
  fills++;
  ctx.globalAlpha = 1;
  return fills;
}

function colorWithAlpha(hex, alpha) {
  const c = hex.replace('#', '');
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function scaleHexColor(hex, factor) {
  const c = String(hex || '#000000').replace('#', '');
  const channels = [0, 2, 4].map(offset => clamp(Math.round(parseInt(c.slice(offset, offset + 2), 16) * factor), 0, 255));
  return `rgb(${channels[0]},${channels[1]},${channels[2]})`;
}

function backgroundHash(index, seed = 0) {
  const value = Math.sin(index * 127.1 + seed * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

function backgroundAlpha(value) {
  return clamp(value * state.backgroundBrightness, 0, 1);
}

function fillBackgroundBase(width, height, color) {
  // Keep the foundation flat and dark. The previous full-screen radial
  // gradient brightened every scene center and made foreground geometry look
  // fogged even when the selected background was supposed to be empty.
  const factor = 0.72 + state.backgroundBrightness * 0.4;
  ctx.fillStyle = scaleHexColor(color, factor);
  ctx.fillRect(0, 0, width, height);
}

function drawStarfieldBackground(width, height, density = 1) {
  const count = Math.max(44, Math.round((width * height) / 5600 * density));
  ctx.save();
  ctx.fillStyle = `rgba(185, 218, 255, ${backgroundAlpha(0.42)})`;
  ctx.beginPath();
  for (let index = 0; index < count; index++) {
    const x = backgroundHash(index, 1.3) * width;
    const y = backgroundHash(index, 7.1) * height;
    const radius = 0.35 + backgroundHash(index, 4.7) * 0.85;
    ctx.moveTo(x + radius, y);
    ctx.arc(x, y, radius, 0, TAU);
  }
  ctx.fill();
  ctx.fillStyle = `rgba(255, 242, 190, ${backgroundAlpha(0.68)})`;
  ctx.beginPath();
  for (let index = 0; index < count; index += 11) {
    const x = backgroundHash(index, 9.2) * width;
    const y = backgroundHash(index, 2.8) * height;
    const radius = 0.8 + backgroundHash(index, 5.5) * 0.9;
    ctx.moveTo(x + radius, y);
    ctx.arc(x, y, radius, 0, TAU);
  }
  ctx.fill();
  ctx.restore();
  return count + Math.ceil(count / 11);
}

function drawGridBackground(width, height) {
  const horizon = height * 0.54;
  ctx.save();
  ctx.strokeStyle = `rgba(88, 221, 255, ${backgroundAlpha(0.22)})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let index = -8; index <= 8; index++) {
    ctx.moveTo(width * 0.5, horizon);
    ctx.lineTo(width * 0.5 + index * width * 0.12, height);
  }
  for (let index = 1; index <= 14; index++) {
    const t = index / 14;
    const y = horizon + (height - horizon) * t * t;
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
  }
  ctx.stroke();
  ctx.strokeStyle = `rgba(221, 178, 255, ${backgroundAlpha(0.34)})`;
  ctx.beginPath();
  ctx.moveTo(0, horizon);
  ctx.lineTo(width, horizon);
  ctx.stroke();
  ctx.restore();
  return 32;
}

function drawAuroraBackground(width, height) {
  const colors = ['85, 255, 171', '111, 210, 255', '190, 99, 255'];
  ctx.save();
  ctx.lineCap = 'round';
  for (let index = 0; index < colors.length; index++) {
    const y = height * (0.2 + index * 0.075);
    const gradient = ctx.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, `rgba(${colors[index]}, 0)`);
    gradient.addColorStop(0.22, `rgba(${colors[index]}, ${backgroundAlpha(0.12)})`);
    gradient.addColorStop(0.62, `rgba(${colors[index]}, ${backgroundAlpha(0.24)})`);
    gradient.addColorStop(1, `rgba(${colors[index]}, 0)`);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 16 + index * 7;
    ctx.beginPath();
    ctx.moveTo(-30, y + 30);
    ctx.bezierCurveTo(width * 0.2, y - 55, width * 0.58, y + 70, width + 30, y - 25);
    ctx.stroke();
  }
  ctx.restore();
  return colors.length;
}

function drawCosmosBackground(width, height) {
  const pockets = [
    [0.22, 0.28, 0.32, '255, 120, 54'],
    [0.76, 0.62, 0.4, '71, 132, 255'],
    [0.42, 0.82, 0.24, '168, 79, 255'],
  ];
  ctx.save();
  for (const [x, y, radius, color] of pockets) {
    const gradient = ctx.createRadialGradient(width * x, height * y, 0, width * x, height * y, Math.max(width, height) * radius);
    gradient.addColorStop(0, `rgba(${color}, ${backgroundAlpha(0.11)})`);
    gradient.addColorStop(0.52, `rgba(${color}, ${backgroundAlpha(0.045)})`);
    gradient.addColorStop(1, `rgba(${color}, 0)`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.restore();
  return pockets.length + drawStarfieldBackground(width, height, 0.74);
}

function drawMandalaBackground(width, height) {
  const cx = width * 0.5;
  const cy = height * 0.48;
  const radius = Math.min(width, height) * 0.43;
  ctx.save();
  ctx.strokeStyle = `rgba(164, 115, 255, ${backgroundAlpha(0.2)})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let ring = 1; ring <= 8; ring++) {
    const ringRadius = radius * ring / 8;
    ctx.moveTo(cx + ringRadius, cy);
    ctx.arc(cx, cy, ringRadius, 0, TAU);
  }
  for (let spoke = 0; spoke < 24; spoke++) {
    const angle = spoke / 24 * TAU + stylePhase * 0.1;
    ctx.moveTo(cx + Math.cos(angle) * radius * 0.12, cy + Math.sin(angle) * radius * 0.12);
    ctx.lineTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
  }
  ctx.stroke();
  ctx.strokeStyle = `rgba(77, 221, 255, ${backgroundAlpha(0.14)})`;
  ctx.beginPath();
  for (let spoke = 0; spoke < 12; spoke++) {
    const angle = spoke / 12 * TAU;
    for (let ring = 1; ring < 8; ring++) {
      const r = radius * ring / 8;
      const nextR = radius * (ring + 1) / 8;
      ctx.moveTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
      ctx.lineTo(cx + Math.cos(angle + Math.PI / 6) * nextR, cy + Math.sin(angle + Math.PI / 6) * nextR);
    }
  }
  ctx.stroke();
  ctx.restore();
  return 8 + 24 + 84;
}

function drawPlasmaBackground(width, height) {
  const colors = ['255, 72, 154', '101, 123, 255', '80, 234, 218'];
  ctx.save();
  ctx.lineWidth = 1.25;
  for (let band = 0; band < 18; band++) {
    ctx.strokeStyle = `rgba(${colors[band % colors.length]}, ${backgroundAlpha(0.1 + (band % 3) * 0.025)})`;
    ctx.beginPath();
    for (let x = 0; x <= width; x += 8) {
      const y = height * (band + 1) / 19
        + Math.sin(x * 0.025 + band * 0.71 + stylePhase * TAU) * (10 + band % 4 * 4)
        + Math.sin(x * 0.009 - band) * 13;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
  return 18;
}

function drawVortexBackground(width, height) {
  const cx = width * 0.5;
  const cy = height * 0.49;
  const maxRadius = Math.min(width, height) * 0.48;
  ctx.save();
  ctx.lineCap = 'round';
  for (let arm = 0; arm < 4; arm++) {
    ctx.strokeStyle = arm % 2
      ? `rgba(117, 92, 255, ${backgroundAlpha(0.16)})`
      : `rgba(255, 199, 121, ${backgroundAlpha(0.12)})`;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    for (let step = 0; step <= 110; step++) {
      const t = step / 110;
      const angle = arm / 4 * TAU + t * TAU * 2.15 + stylePhase * 0.12;
      const radius = 5 + t * maxRadius;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius * 0.72;
      if (step === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
  return 4;
}

function drawQuantumBackground(width, height) {
  const nodes = Array.from({ length: 26 }, (_, index) => ({
    x: backgroundHash(index, 6.2) * width,
    y: backgroundHash(index, 3.4) * height,
  }));
  let lines = 0;
  const maxDistance = Math.min(width, height) * 0.26;
  ctx.save();
  ctx.strokeStyle = `rgba(68, 155, 224, ${backgroundAlpha(0.16)})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let a = 0; a < nodes.length; a++) {
    for (let b = a + 1; b < nodes.length; b++) {
      if (Math.hypot(nodes[a].x - nodes[b].x, nodes[a].y - nodes[b].y) > maxDistance) continue;
      ctx.moveTo(nodes[a].x, nodes[a].y);
      ctx.lineTo(nodes[b].x, nodes[b].y);
      lines++;
    }
  }
  ctx.stroke();
  ctx.fillStyle = `rgba(91, 255, 211, ${backgroundAlpha(0.48)})`;
  ctx.beginPath();
  for (const node of nodes) {
    ctx.moveTo(node.x + 1.6, node.y);
    ctx.arc(node.x, node.y, 1.6, 0, TAU);
  }
  ctx.fill();
  ctx.restore();
  return lines + nodes.length;
}

function drawEclipseBackground(width, height) {
  const cx = width * 0.5;
  const cy = height * 0.43;
  const radius = Math.min(width, height) * 0.24;
  ctx.save();
  const corona = ctx.createRadialGradient(cx, cy, radius * 0.72, cx, cy, radius * 1.55);
  corona.addColorStop(0, `rgba(255, 174, 70, ${backgroundAlpha(0.52)})`);
  corona.addColorStop(0.4, `rgba(255, 83, 24, ${backgroundAlpha(0.15)})`);
  corona.addColorStop(1, 'rgba(255, 50, 10, 0)');
  ctx.fillStyle = corona;
  ctx.fillRect(cx - radius * 1.7, cy - radius * 1.7, radius * 3.4, radius * 3.4);
  ctx.fillStyle = '#010103';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = `rgba(255, 196, 103, ${backgroundAlpha(0.62)})`;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.restore();
  return 3;
}

function drawSynthwaveBackground(width, height) {
  const horizon = height * 0.56;
  const sunRadius = Math.min(width, height) * 0.18;
  ctx.save();
  const sun = ctx.createLinearGradient(0, horizon - sunRadius, 0, horizon + sunRadius);
  sun.addColorStop(0, `rgba(255, 199, 87, ${backgroundAlpha(0.7)})`);
  sun.addColorStop(1, `rgba(255, 52, 118, ${backgroundAlpha(0.48)})`);
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(width * 0.5, horizon, sunRadius, Math.PI, TAU);
  ctx.fill();
  for (let stripe = 1; stripe <= 5; stripe++) {
    const y = horizon - sunRadius + stripe * sunRadius * 0.3;
    ctx.fillStyle = scaleHexColor('#0d0412', 0.9);
    ctx.fillRect(width * 0.5 - sunRadius, y, sunRadius * 2, 3 + stripe);
  }
  ctx.restore();
  return 7 + drawGridBackground(width, height);
}

function drawPrismBackground(width, height) {
  const cx = width * 0.5;
  const cy = height * 0.5;
  const size = Math.min(width, height) * 0.27;
  ctx.save();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = `rgba(213, 222, 255, ${backgroundAlpha(0.5)})`;
  ctx.beginPath();
  ctx.moveTo(cx, cy - size);
  ctx.lineTo(cx - size * 0.9, cy + size * 0.75);
  ctx.lineTo(cx + size * 0.9, cy + size * 0.75);
  ctx.closePath();
  ctx.stroke();
  const rays = ['255, 80, 92', '255, 193, 75', '88, 255, 175', '79, 196, 255', '177, 93, 255'];
  for (let index = 0; index < rays.length; index++) {
    const y = cy - size * 0.12 + index * size * 0.09;
    ctx.strokeStyle = `rgba(${rays[index]}, ${backgroundAlpha(0.36)})`;
    ctx.beginPath();
    ctx.moveTo(cx + size * 0.15, y);
    ctx.lineTo(width, y + (index - 2) * size * 0.34);
    ctx.stroke();
  }
  ctx.strokeStyle = `rgba(226, 236, 255, ${backgroundAlpha(0.42)})`;
  ctx.beginPath();
  ctx.moveTo(0, cy - size * 0.16);
  ctx.lineTo(cx - size * 0.12, cy - size * 0.06);
  ctx.stroke();
  ctx.restore();
  return rays.length + 2;
}

function drawMobileBackground(width, height) {
  const preset = BACKGROUNDS[state.background] || BACKGROUNDS[DEFAULT_STATE.background];
  fillBackgroundBase(width, height, preset.color);
  let primitives = 1;
  if (preset.renderer === 'stars') primitives += drawStarfieldBackground(width, height);
  else if (preset.renderer === 'grid') primitives += drawGridBackground(width, height);
  else if (preset.renderer === 'aurora') primitives += drawAuroraBackground(width, height);
  else if (preset.renderer === 'cosmos') primitives += drawCosmosBackground(width, height);
  else if (preset.renderer === 'mandala') primitives += drawMandalaBackground(width, height);
  else if (preset.renderer === 'plasma') primitives += drawPlasmaBackground(width, height);
  else if (preset.renderer === 'vortex') primitives += drawVortexBackground(width, height);
  else if (preset.renderer === 'quantum') primitives += drawQuantumBackground(width, height);
  else if (preset.renderer === 'eclipse') primitives += drawEclipseBackground(width, height);
  else if (preset.renderer === 'synthwave') primitives += drawSynthwaveBackground(width, height);
  else if (preset.renderer === 'prism') primitives += drawPrismBackground(width, height);
  return { mode: state.background, renderer: preset.renderer, primitives };
}

function requestRender(reason = 'render') {
  if (isSettingsOpen()) return deferSettingsRender(reason);
  if (renderRafId) return;
  renderRafId = requestAnimationFrame(() => {
    renderRafId = null;
    render();
  });
}

function cancelQueuedRenderForSettings(reason) {
  if (!renderRafId) return false;
  cancelAnimationFrame(renderRafId);
  renderRafId = null;
  metrics.settingsOpenRenderCancelCount++;
  metrics.lastSettingsOpenRenderCancelMs = performance.now();
  metrics.lastSettingsOpenRenderCancelReason = reason;
  return deferSettingsRender(reason);
}

function deferSettingsRender(reason) {
  liveControlLiteRenderReason = null;
  settingsDeferredRenderReason = reason || settingsDeferredRenderReason || 'settings-open';
  metrics.settingsDeferredRenderRequestCount++;
  metrics.lastSettingsDeferredRenderRequestMs = performance.now();
  metrics.lastSettingsDeferredRenderReason = settingsDeferredRenderReason;
  return false;
}

function flushDeferredSettingsRender() {
  if (!settingsDeferredRenderReason) return false;
  const reason = settingsDeferredRenderReason;
  settingsDeferredRenderReason = null;
  metrics.settingsDeferredRenderFlushCount++;
  metrics.lastSettingsDeferredRenderFlushMs = performance.now();
  metrics.lastSettingsDeferredRenderFlushReason = reason;
  requestRender(reason);
  return true;
}

function suppressRender(reason) {
  metrics.renderSuppressedCount++;
  metrics.lastRenderSuppressedMs = performance.now();
  metrics.lastRenderSuppressedReason = reason;
  return false;
}

function requestLiveControlLiteRender(reason) {
  liveControlLiteRenderReason = reason;
  metrics.liveControlLiteRequestCount++;
  metrics.lastLiveControlLiteRequestMs = performance.now();
  metrics.lastLiveControlLiteReason = reason;
  return true;
}

function requestSettledRenderAfterInput(reason) {
  if (hasActiveInput()) {
    pendingSettledRenderReason = reason;
    return false;
  }
  const settledReason = pendingSettledRenderReason || reason;
  pendingSettledRenderReason = null;
  metrics.settledRenderRequestCount++;
  metrics.lastSettledRenderRequestMs = performance.now();
  metrics.lastSettledRenderRequestReason = settledReason;
  requestRender(settledReason);
  return true;
}

function forceRender() {
  if (renderRafId) {
    cancelAnimationFrame(renderRafId);
    renderRafId = null;
  }
  settingsDeferredRenderReason = null;
  render();
}

function showStatus(message) {
  if (!els.statusToast || !message) return false;
  metrics.statusText = message;
  metrics.statusCount++;
  metrics.lastStatusMs = performance.now();
  els.statusToast.textContent = message;
  els.statusToast.classList.remove('hidden');
  if (statusTimer) clearTimeout(statusTimer);
  statusTimer = setTimeout(() => {
    statusTimer = null;
    hideStatus();
  }, STATUS_HIDE_MS);
  return true;
}

function hideStatus() {
  if (statusTimer) {
    clearTimeout(statusTimer);
    statusTimer = null;
  }
  if (els.statusToast) els.statusToast.classList.add('hidden');
  return true;
}

function currentAutoModelIndex() {
  const index = AUTO_MODEL_SEQUENCE.findIndex(target => {
    if (target.modelMode !== state.modelMode) return false;
    if (target.modelMode === 'platonic') return target.shape === state.shape;
    if (target.modelMode === 'poly4d') return target.polytope4d === state.polytope4d;
    if (target.modelMode === 'dynkin') return target.dynkinDiagram === state.dynkinDiagram;
    return true;
  });
  return index >= 0 ? index : 0;
}

function advanceAutoModel() {
  autoModelIndex = (autoModelIndex + 1) % AUTO_MODEL_SEQUENCE.length;
  const target = AUTO_MODEL_SEQUENCE[autoModelIndex];
  previousSelectedRoot = state.selectedRoot;
  state = normalizeState({ ...state, ...target, selectedRoot: null });
  rootDrawerExpanded = false;
  lastSelectionDetailHtml = null;
  selectionUiDetailsDeferred = false;
  syncModelControls();
  updateSelectionUI({ reason: 'auto-model-cycle' });
  metrics.autoModelSwitchCount++;
  metrics.lastAutoModelSwitchMs = performance.now();
  metrics.lastAutoModelTarget = {
    modelMode: state.modelMode,
    shape: state.shape,
    polytope4d: state.polytope4d,
    dynkinDiagram: state.dynkinDiagram,
  };
  return state;
}

function syncMotionLoop() {
  metrics.motionFrameTargetMs = mobileMotionFrameIntervalMs();
  if (hasRuntimeAnimation() && !document.hidden && !isSettingsOpen() && !hasActiveInput()) startMotion();
  else stopMotion();
}

function mobileMotionFrameIntervalMs() {
  return state.modelMode === 'e8_2d' && state.showEdges
    ? DENSE_E8_MOTION_FRAME_INTERVAL_MS
    : MOTION_FRAME_INTERVAL_MS;
}

function syncAutoMotionPhase(kind) {
  const isZoom = kind === 'zoom';
  const min = isZoom ? AUTO_ZOOM_MIN : 0;
  const max = isZoom ? AUTO_ZOOM_MAX : 1;
  const value = isZoom ? state.zoom : state.e8MorphT;
  const normalized = clamp((value - min) / (max - min), 0, 1);
  const offset = Math.asin(clamp(normalized * 2 - 1, -1, 1)) - motionPhase * AUTO_MOTION_RATE;
  if (isZoom) autoZoomPhaseOffset = offset;
  else autoExtrudePhaseOffset = offset;
  return offset;
}

function autoMotionValue(min, max, phaseOffset) {
  const wave = 0.5 + 0.5 * Math.sin(motionPhase * AUTO_MOTION_RATE + phaseOffset);
  return min + (max - min) * wave;
}

function hasRuntimeAnimation() {
  const nativeFxAnimation = ANIMATED_MOBILE_FX.has(state.fxMode);
  return !!(state.autoRotate || state.autoZoom || state.autoExtrude || state.autoModel || state.autoColor || state.softFx || nativeFxAnimation || (state.modelMode === 'bloom' && state.bloomAuto));
}

function startMotion() {
  if (motionRafId || !hasRuntimeAnimation() || document.hidden || isSettingsOpen() || hasActiveInput()) return;
  let last = performance.now();
  const tick = (now) => {
    if (!hasRuntimeAnimation() || document.hidden || isSettingsOpen() || hasActiveInput()) {
      motionRafId = null;
      return;
    }
    const elapsed = now - last;
    const targetFrameMs = mobileMotionFrameIntervalMs();
    metrics.motionFrameTargetMs = targetFrameMs;
    if (elapsed < targetFrameMs) {
      metrics.motionFrameSkipCount++;
      metrics.lastMotionFrameSkipMs = now;
      motionRafId = requestAnimationFrame(tick);
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state.autoRotate || state.autoZoom || state.autoExtrude) {
      motionPhase = (motionPhase + dt * state.rotationSpeed) % 4096;
    }
    if (state.autoRotate) {
      const pathRate = state.cameraPath === 'dive' ? 0.30 : state.cameraPath === 'spiral' ? 0.62 : 0.48;
      state.rotation += dt * state.rotationSpeed * pathRate;
    }
    if (state.autoZoom) {
      state.zoom = autoMotionValue(AUTO_ZOOM_MIN, AUTO_ZOOM_MAX, autoZoomPhaseOffset);
      metrics.autoZoomFrameCount++;
    }
    if (state.autoExtrude) {
      state.e8MorphT = autoMotionValue(0, 1, autoExtrudePhaseOffset);
      metrics.autoExtrudeFrameCount++;
    }
    if (state.modelMode === 'bloom' && state.bloomAuto) {
      state.bloomAmount = (state.bloomAmount + dt * state.bloomSpeed) % 1;
      metrics.bloomAutoFrameCount++;
      syncBloomRuntimeReadout();
    }
    if (state.autoModel) {
      autoModelElapsed += dt;
      metrics.autoModelFrameCount++;
      if (autoModelElapsed >= AUTO_MODEL_INTERVAL_S) {
        autoModelElapsed = 0;
        advanceAutoModel();
      }
    }
    const nativeFxAnimation = ANIMATED_MOBILE_FX.has(state.fxMode);
    if (state.autoColor || state.softFx || nativeFxAnimation) {
      const styleRate = state.autoColor ? state.colorSpeed : state.softFx ? 0.42 * state.fxStrength : 0.26 * state.fxStrength;
      stylePhase = (stylePhase + dt * styleRate) % 4096;
      if (state.autoColor) metrics.autoColorFrameCount++;
      if (state.softFx) metrics.softFxFrameCount++;
    }
    metrics.motionFrameRenderCount++;
    metrics.lastMotionFrameRenderMs = now;
    metrics.lastMotionFrameDeltaMs = elapsed;
    render();
    motionRafId = requestAnimationFrame(tick);
  };
  motionRafId = requestAnimationFrame(tick);
}

function stopMotion() {
  if (motionRafId) {
    cancelAnimationFrame(motionRafId);
    motionRafId = null;
  }
}

function isSettingsOpen() {
  return !!els.sheet && !els.sheet.classList.contains('hidden');
}

function hasActiveInput() {
  return !!drag || !!gesture || activePointers.size > 0 || gestureReleaseIds.size > 0;
}

function syncChromeFade(reason = 'input') {
  const active = hasActiveInput() && !isSettingsOpen();
  if (active === chromeFaded) return false;
  chromeFaded = active;
  if (els.shell) els.shell.classList.toggle('is-interacting', active);
  if (active) metrics.chromeFadeInCount++;
  else metrics.chromeFadeOutCount++;
  metrics.lastChromeFadeMs = performance.now();
  metrics.lastChromeFadeReason = reason;
  return true;
}

function touchDragMode() {
  if (TOUCH_ORBIT_MODEL_MODES.has(state.modelMode)) return 'orbit';
  if (state.modelMode === 'e8_2d' && state.e8MorphT > 0.0001) return 'orbit';
  return 'pan';
}

function onPointerDown(event) {
  if (mobileTourActive) stopMobileTour({ interactionType: 'touch-stop-tour' });
  try {
    canvas.setPointerCapture(event.pointerId);
  } catch (error) {
    if (event.isTrusted) recordError(error);
  }
  gestureReleaseIds.clear();
  activePointers.set(event.pointerId, { id: event.pointerId, x: event.clientX, y: event.clientY });
  syncChromeFade('pointer-down');
  syncMotionLoop();
  if (activePointers.size >= 2) {
    markInteraction('pinch-start');
    beginGesture();
    return;
  }
  markInteraction('touch-start');
  drag = {
    id: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    panX: state.panX,
    panY: state.panY,
    rotation: state.rotation,
    cameraTilt: state.cameraTilt,
    mode: touchDragMode(),
    moved: false,
  };
}

function onPointerMove(event) {
  const pointer = activePointers.get(event.pointerId);
  if (!pointer) return;
  pointer.x = event.clientX;
  pointer.y = event.clientY;
  if (activePointers.size >= 2) {
    updateGesture();
    return;
  }
  if (!drag || drag.id !== event.pointerId) return;
  const dx = event.clientX - drag.x;
  const dy = event.clientY - drag.y;
  const distance = Math.hypot(dx, dy);
  if (!drag.moved && distance <= TAP_JITTER_PX) {
    metrics.tapJitterIgnoredCount++;
    metrics.lastTapJitterIgnoredMs = performance.now();
    metrics.lastTapJitterDistance = distance;
    return;
  }
  drag.moved = true;
  if (drag.mode === 'orbit') {
    markInteraction('orbit-drag');
    state.rotation = drag.rotation + dx * 0.008;
    state.cameraTilt = clamp(drag.cameraTilt - dy * 0.006, -Math.PI / 3, Math.PI / 3);
    state.cameraPath = 'manual';
    state.autoRotate = false;
  } else {
    markInteraction('pan');
    state.panX = drag.panX + dx;
    state.panY = drag.panY + dy;
  }
  requestRender();
}

function onPointerUp(event) {
  const wasTap = drag && drag.id === event.pointerId && !drag.moved && !gesture;
  const dragMode = drag?.mode || 'pan';
  activePointers.delete(event.pointerId);
  try {
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  } catch (error) {
    if (event.isTrusted) recordError(error);
  }
  if (gestureReleaseIds.delete(event.pointerId)) {
    syncChromeFade('gesture-release');
    syncControls();
    requestSettledRenderAfterInput('gesture-release');
    syncMotionLoop();
    return;
  }
  if (gesture) {
    markInteraction('pinch-end');
    syncControls();
    saveState();
    gestureReleaseIds = new Set(activePointers.keys());
    gesture = null;
    drag = null;
    syncChromeFade('pinch-end');
    requestSettledRenderAfterInput('pinch-end');
    syncMotionLoop();
    return;
  }
  drag = null;
  const dragEndReason = `${dragMode}-end`;
  syncChromeFade(wasTap ? 'tap-end' : dragEndReason);
  if (wasTap) {
    if (consumeDoubleTap(event.clientX, event.clientY)) {
      fitAllRoots('double-tap-fit-all', { clearSelection: true });
      syncMotionLoop();
      return;
    }
    rememberTap(event.clientX, event.clientY);
    markInteraction('tap');
    selectNearest(event.clientX, event.clientY);
  }
  else {
    markInteraction(dragEndReason);
    syncControls();
    saveState();
    requestSettledRenderAfterInput(dragEndReason);
  }
  syncMotionLoop();
}

function onPointerCancel() {
  // Android may cancel a pointer when system chrome, accessibility gestures,
  // or another native surface takes ownership.  A cancellation is never a tap
  // and must not participate in double-tap fitting or root selection.
  clearTapMemory();
  const hadInput = resetInputState('pointer-cancel');
  if (hadInput) requestSettledRenderAfterInput('pointer-cancel');
}

function resetInputState(reason = null) {
  const hadInput = hasActiveInput();
  for (const pointerId of activePointers.keys()) {
    try {
      if (canvas.hasPointerCapture?.(pointerId)) canvas.releasePointerCapture(pointerId);
    } catch (error) {
      recordError(error);
    }
  }
  activePointers.clear();
  gestureReleaseIds.clear();
  gesture = null;
  drag = null;
  pendingSettledRenderReason = null;
  liveControlLiteRenderReason = null;
  syncChromeFade(reason || 'input-reset');
  if (hadInput && reason) markInteraction(reason);
  syncMotionLoop();
  return hadInput;
}

function rememberTap(x, y) {
  lastTap = { x, y, time: performance.now() };
}

function clearTapMemory() {
  lastTap = null;
}

function consumeDoubleTap(x, y) {
  const now = performance.now();
  const previous = lastTap;
  lastTap = null;
  if (!previous) return false;
  if (now - previous.time > DOUBLE_TAP_MS) return false;
  return Math.hypot(x - previous.x, y - previous.y) <= DOUBLE_TAP_PX;
}

function beginGesture() {
  const snap = gestureSnapshot();
  if (!snap || snap.distance < 4) return;
  const layout = layoutForCanvas(state.zoom);
  gesture = {
    distance: snap.distance,
    centerX: snap.centerX,
    centerY: snap.centerY,
    zoom: state.zoom,
    panX: state.panX,
    panY: state.panY,
    originX: layout.cx,
    originY: layout.cy,
    moved: false,
  };
  markInteraction('pinch-start');
  drag = null;
}

function updateGesture() {
  if (!gesture) beginGesture();
  if (!gesture) return;
  const snap = gestureSnapshot();
  if (!snap || gesture.distance < 4) return;
  const distanceDelta = Math.abs(snap.distance - gesture.distance);
  const centerDelta = Math.hypot(snap.centerX - gesture.centerX, snap.centerY - gesture.centerY);
  if (!gesture.moved && distanceDelta <= PINCH_JITTER_PX && centerDelta <= PINCH_JITTER_PX) {
    metrics.pinchJitterIgnoredCount++;
    metrics.lastPinchJitterIgnoredMs = performance.now();
    metrics.lastPinchJitterDistanceDelta = distanceDelta;
    metrics.lastPinchJitterCenterDelta = centerDelta;
    return;
  }
  gesture.moved = true;
  state.autoZoom = false;
  state.zoom = clamp(gesture.zoom * (snap.distance / gesture.distance), 0.55, 3.2);
  const zoomRatio = state.zoom / Math.max(0.001, gesture.zoom);
  const anchorX = gesture.centerX - gesture.originX - gesture.panX;
  const anchorY = gesture.centerY - gesture.originY - gesture.panY;
  state.panX = snap.centerX - gesture.originX - anchorX * zoomRatio;
  state.panY = snap.centerY - gesture.originY - anchorY * zoomRatio;
  markInteraction('pinch');
  requestRender();
}

function gestureSnapshot() {
  const pointers = [...activePointers.values()].slice(0, 2);
  if (pointers.length < 2) return null;
  const [a, b] = pointers;
  return {
    distance: Math.hypot(b.x - a.x, b.y - a.y),
    centerX: (a.x + b.x) / 2,
    centerY: (a.y + b.y) / 2,
  };
}

function onWheel(event) {
  event.preventDefault();
  const next = clamp(state.zoom * (event.deltaY > 0 ? 0.92 : 1.08), 0.55, 3.2);
  markInteraction('wheel-zoom');
  setZoom(next);
}

function setZoom(value) {
  state.autoZoom = false;
  state.zoom = clamp(Number(value) || 1, 0.55, 3.2);
  markInteraction('zoom-control');
  saveState();
  syncControls();
  requestRender();
  syncMotionLoop();
  return state.zoom;
}

function stepZoom(direction) {
  const factor = direction > 0 ? 1.18 : 1 / 1.18;
  return setZoom(state.zoom * factor);
}

function selectDynkinNode(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const target of dynkinHitTargets) {
    const d = Math.hypot(target.x - x, target.y - y);
    if (d < bestD) {
      bestD = d;
      best = target;
    }
  }
  if (!best || bestD > 34) {
    clearSelection();
    return false;
  }
  metrics.dynkinNodeSelectCount++;
  metrics.lastDynkinNodeSelect = {
    diagram: state.dynkinDiagram,
    node: best.index + 1,
  };
  metrics.lastDynkinNodeSelectMs = performance.now();
  if (state.dynkinDiagram !== 'E8') {
    clearSelection();
    showStatus(`${state.dynkinDiagram} a${best.index + 1}`);
    return true;
  }
  const root = simpleRootIndices[best.index];
  if (!Number.isInteger(root)) return false;
  if (state.subset !== 'simple_roots') {
    state.subset = 'simple_roots';
    syncSubsetControls();
  }
  return selectRoot(root, { status: true, interactionType: 'dynkin-node-select', drawerExpanded: false });
}

function selectNearest(x, y) {
  if (state.modelMode === 'dynkin') {
    selectDynkinNode(x, y);
    return;
  }
  if (state.modelMode === 'sdf' || state.modelMode === 'platonic' || state.modelMode === 'poly4d') {
    clearSelection();
    return;
  }
  let best = null;
  let bestD = Infinity;
  for (const p of points) {
    const d = Math.hypot(p.sx - x, p.sy - y);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  if (!best || bestD > Math.max(28, best.size + 14)) {
    clearSelection();
    return;
  }
  if (state.selectedRoot === best.idx) {
    clearSelection();
    return;
  }
  selectRoot(best.idx, { status: true, drawerExpanded: false });
}

function selectRoot(idx, options = {}) {
  const next = Number(idx);
  if (!Number.isInteger(next) || !points[next]) return false;
  const interactionType = options.interactionType || 'select-root';
  if (!interactionType.startsWith('mobile-tour')) stopMobileTourForManualExplore();
  if (state.selectedRoot === next && interactionType !== 'root-commit' && options.force !== true) {
    clearTapMemory();
    markInteraction(interactionType);
    metrics.selectionStateNoopSkipCount++;
    metrics.lastSelectionStateNoopSkip = interactionType;
    metrics.lastSelectionStateNoopRoot = next;
    metrics.lastSelectionStateNoopSkipMs = performance.now();
    return true;
  }
  markInteraction(interactionType);
  if (options.save === false) {
    metrics.liveControlCount++;
    metrics.lastLiveControl = interactionType;
    metrics.lastLiveControlMs = performance.now();
    if (!isSettingsOpen()) requestLiveControlLiteRender(options.interactionType || 'select-root-preview');
  }
  else if (interactionType === 'root-commit') {
    metrics.liveControlCommitCount++;
    metrics.lastLiveControlCommit = 'root-scrub';
    metrics.lastLiveControlCommitMs = performance.now();
    liveControlLiteRenderReason = null;
  }
  previousSelectedRoot = state.selectedRoot;
  state.selectedRoot = next;
  if (options.drawerExpanded != null) rootDrawerExpanded = !!options.drawerExpanded;
  updateSelectionUI({
    lite: options.save === false && isSettingsOpen(),
    reason: interactionType,
  });
  if (options.ensureVisible !== false) ensureSelectedRootVisible();
  if (options.save !== false) saveState();
  if (interactionType === 'root-commit') requestSettledRenderAfterInput('root-commit');
  else requestRender(interactionType);
  if (options.status) showStatus(`Root #${next}`);
  return true;
}

function selectAdjacentRoot(direction, options = {}) {
  if (!points.length) return false;
  const current = state.selectedRoot == null ? (direction > 0 ? -1 : points.length) : state.selectedRoot;
  const next = (current + direction + points.length) % points.length;
  return selectRoot(next, options);
}

function selectFirstSubsetRoot() {
  const list = rootSubsetList();
  if (!list.length) return false;
  return selectRoot(list[0], { status: true });
}

function selectSubsetRoot(direction) {
  const list = rootSubsetList();
  if (!list.length) return false;
  const current = list.indexOf(state.selectedRoot);
  if (current === -1) return selectRoot(direction >= 0 ? list[0] : list[list.length - 1], { status: true });
  const next = (current + direction + list.length) % list.length;
  return selectRoot(list[next], { status: true });
}

function frameSubset() {
  stopMobileTourForManualExplore();
  const framed = framePointList(rootSubsetList(), 'frame-subset');
  if (framed) showStatus('Subset framed');
  return framed;
}

function fitAllRoots(interactionType = 'fit-all', options = {}) {
  if (options.clearSelection) {
    previousSelectedRoot = state.selectedRoot;
    state.selectedRoot = null;
    updateSelectionUI();
  }
  const fitted = state.modelMode === 'sdf'
    ? frameSdfModel(interactionType, options)
    : state.modelMode === 'e8_2d'
      ? framePointList(allRootList, interactionType, options)
      : frameProjectedModel(interactionType, options);
  if (fitted && !options.silentStatus) showStatus('View fitted');
  return fitted;
}

function frameSdfModel(interactionType, options = {}) {
  const layout = layoutForCanvas(1);
  const view = usableViewBounds();
  const targetX = (view.left + view.right) * 0.5;
  const targetY = (view.top + view.bottom) * 0.5;
  const fitRadius = Math.max(48, Math.min(
    targetX - view.left,
    view.right - targetX,
    targetY - view.top,
    view.bottom - targetY
  ) * 0.96);
  const worldRadius = sdfWorldBoundsRadius();
  const focalPixels = window.innerHeight / (2 * Math.tan(SDF_FOV_RADIANS * 0.5));
  const requiredDistance = worldRadius * Math.sqrt(1 + (focalPixels / fitRadius) ** 2) + 0.02;
  const nextZoom = clamp((SDF_BASE_CAMERA_DISTANCE / requiredDistance) ** 2, 0.55, 3.2);
  motionPhase = 0;
  setState({
    cameraPath: 'manual',
    autoRotate: false,
    autoZoom: false,
    zoom: nextZoom,
    panX: targetX - window.innerWidth * 0.5,
    panY: targetY - layout.cy,
  }, {
    interactionType,
    save: options.save,
    renderReason: interactionType,
  });
  return true;
}

function framePointList(list, interactionType, options = {}) {
  const modelBounds = pointModelBounds(list);
  if (!modelBounds) return false;
  return frameModelBounds(modelBounds, interactionType, options);
}

function frameProjectedModel(interactionType, options = {}) {
  // A model may have been selected while Settings was open, in which case its
  // normal render is deliberately deferred.  Fit is an explicit visual action,
  // so render once to obtain bounds for the active model rather than reusing
  // the previous model's Coxeter-root frame.
  render();
  const frame = metrics.lastRenderAllFrame;
  if (!frame || metrics.lastModelMode !== state.modelMode) return false;
  const currentLayout = layoutForCanvas(state.zoom);
  const scale = Math.max(0.001, currentLayout.scale);
  const modelBounds = {
    minX: (frame.minX - currentLayout.cx - state.panX) / scale,
    maxX: (frame.maxX - currentLayout.cx - state.panX) / scale,
    minY: (frame.minY - currentLayout.cy - state.panY) / scale,
    maxY: (frame.maxY - currentLayout.cy - state.panY) / scale,
  };
  return frameModelBounds(modelBounds, interactionType, options);
}

function frameModelBounds(modelBounds, interactionType, options = {}) {
  const layout = layoutForCanvas(1);
  const view = usableViewBounds();
  const modelW = Math.max(0.001, modelBounds.maxX - modelBounds.minX);
  const modelH = Math.max(0.001, modelBounds.maxY - modelBounds.minY);
  const fitW = Math.max(120, view.right - view.left);
  const fitH = Math.max(120, view.bottom - view.top);
  // Leave a small visual and floating-point margin. An exact edge-to-edge fit
  // can be reported outside the view by sub-pixel rounding and feels cramped.
  const nextZoom = clamp(Math.min(fitW / (modelW * layout.baseScale), fitH / (modelH * layout.baseScale)) * 0.96, 0.55, 3.2);
  const nextLayout = layoutForCanvas(nextZoom);
  const targetX = (view.left + view.right) / 2;
  const targetY = (view.top + view.bottom) / 2;
  const modelCenterX = (modelBounds.minX + modelBounds.maxX) / 2;
  const modelCenterY = (modelBounds.minY + modelBounds.maxY) / 2;
  markInteraction(interactionType);
  state.autoZoom = false;
  state.zoom = nextZoom;
  state.panX = targetX - nextLayout.cx - modelCenterX * nextLayout.scale;
  state.panY = targetY - nextLayout.cy - modelCenterY * nextLayout.scale;
  syncControls();
  if (options.save !== false) saveState();
  requestRender();
  syncMotionLoop();
  return true;
}

function pointModelBounds(list) {
  if (!list.length) return null;
  const cos = Math.cos(state.rotation);
  const sin = Math.sin(state.rotation);
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const idx of list) {
    const point = points[idx];
    if (!point) continue;
    const x = point.x * cos - point.y * sin;
    const y = point.x * sin + point.y * cos;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (!Number.isFinite(minX)) return null;
  return { minX, minY, maxX, maxY };
}

function subsetFrameMetrics() {
  return pointFrameMetrics(rootSubsetList());
}

function allFrameMetrics() {
  return pointFrameMetrics(allRootList);
}

function projectedPointFrameMetrics(list) {
  if (!list.length) return null;
  const view = usableViewBounds();
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const idx of list) {
    const point = points[idx];
    if (!point) continue;
    minX = Math.min(minX, point.sx);
    minY = Math.min(minY, point.sy);
    maxX = Math.max(maxX, point.sx);
    maxY = Math.max(maxY, point.sy);
  }
  if (!Number.isFinite(minX)) return null;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    withinView: minX >= view.left - 0.5 && maxX <= view.right + 0.5 && minY >= view.top - 0.5 && maxY <= view.bottom + 0.5,
    view,
  };
}

function pointFrameMetrics(list) {
  if (!list.length) return null;
  const layout = layoutForCanvas();
  const view = usableViewBounds();
  const cos = Math.cos(state.rotation);
  const sin = Math.sin(state.rotation);
  const originX = layout.cx + state.panX;
  const originY = layout.cy + state.panY;
  const scale = layout.scale;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const idx of list) {
    const point = points[idx];
    if (!point) continue;
    const x = originX + (point.x * cos - point.y * sin) * scale;
    const y = originY + (point.x * sin + point.y * cos) * scale;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x);
    maxY = Math.max(maxY, y);
  }
  if (!Number.isFinite(minX)) return null;
  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
    withinView: minX >= view.left - 0.5 && maxX <= view.right + 0.5 && minY >= view.top - 0.5 && maxY <= view.bottom + 0.5,
    view,
  };
}

function selectedRootViewBounds() {
  const view = { ...usableViewBounds() };
  if (!isSettingsOpen() && els.rootDrawer && !els.rootDrawer.classList.contains('hidden')) {
    const rect = els.rootDrawer.getBoundingClientRect();
    if (rect.height > 0) view.bottom = Math.min(view.bottom, rect.top - 18);
  }
  return view;
}

function selectedRootFrameMetrics() {
  if (state.selectedRoot == null) return null;
  const point = points[state.selectedRoot];
  if (!point) return null;
  const layout = layoutForCanvas();
  const pos = screenPointFor(point, layout);
  const view = selectedRootViewBounds();
  const pad = Math.max(18, (point.size || 0) + 12);
  return {
    x: pos.x,
    y: pos.y,
    pad,
    withinView: pos.x >= view.left + pad && pos.x <= view.right - pad && pos.y >= view.top + pad && pos.y <= view.bottom - pad,
    view,
  };
}

function ensureSelectedRootVisible() {
  if (isSettingsOpen()) return false;
  const frame = selectedRootFrameMetrics();
  if (!frame || frame.withinView) return false;
  let dx = 0;
  let dy = 0;
  const left = frame.view.left + frame.pad;
  const right = frame.view.right - frame.pad;
  const top = frame.view.top + frame.pad;
  const bottom = frame.view.bottom - frame.pad;
  if (frame.x < left) dx = left - frame.x;
  else if (frame.x > right) dx = right - frame.x;
  if (frame.y < top) dy = top - frame.y;
  else if (frame.y > bottom) dy = bottom - frame.y;
  if (!dx && !dy) return false;
  state.panX += dx;
  state.panY += dy;
  metrics.selectionAutoPanCount++;
  metrics.lastSelectionAutoPanMs = performance.now();
  metrics.lastSelectionAutoPanDx = dx;
  metrics.lastSelectionAutoPanDy = dy;
  return true;
}

function clearSelection(interactionType = 'clear-selection') {
  if (state.selectedRoot == null) return false;
  markInteraction(interactionType);
  previousSelectedRoot = state.selectedRoot;
  state.selectedRoot = null;
  rootDrawerExpanded = false;
  saveState();
  updateSelectionUI();
  requestRender();
  showStatus('Selection cleared');
  return true;
}

function selectOpposite() {
  const context = getSelectedContext();
  if (context?.antipode == null) return false;
  return selectRoot(context.antipode, { status: true, drawerExpanded: true, interactionType: 'opposite-root' });
}

function selectNeighbor() {
  const context = getSelectedContext();
  const neighbors = context?.point?.neighbors || [];
  if (!neighbors.length) return false;
  const next = neighbors.find(idx => idx !== previousSelectedRoot) ?? neighbors[0];
  return selectRoot(next, { status: true, drawerExpanded: true, interactionType: 'neighbor-root' });
}

function centerSelectedRoot() {
  const selected = state.selectedRoot;
  const point = points[selected];
  if (!point) return false;
  const layout = layoutForCanvas();
  const pos = screenPointFor(point, layout);
  clearTapMemory();
  markInteraction('center-root');
  state.panX += layout.cx - pos.x;
  state.panY += layout.cy - pos.y;
  saveState();
  requestRender();
  return true;
}

function setRootDrawerExpanded(expanded, reason = 'root-drawer-toggle') {
  const next = !!expanded;
  if (rootDrawerExpanded === next || state.selectedRoot == null) return false;
  rootDrawerExpanded = next;
  markInteraction(reason);
  if (next) metrics.rootDrawerExpandCount++;
  else metrics.rootDrawerCollapseCount++;
  metrics.lastRootDrawerToggleMs = performance.now();
  metrics.lastRootDrawerToggleReason = reason;
  updateSelectionUI({ reason });
  if (next && ensureSelectedRootVisible()) requestRender(reason);
  return true;
}

function toggleRootDrawer() {
  return setRootDrawerExpanded(!rootDrawerExpanded, 'root-drawer-toggle');
}

function getRootScreenPoint(index) {
  const idx = Number(index);
  const point = points[idx];
  if (!Number.isInteger(idx) || !point) return null;
  const layout = layoutForCanvas();
  const pos = screenPointFor(point, layout);
  return {
    index: idx,
    x: pos.x,
    y: pos.y,
    size: point.size,
  };
}

function getDynkinNodeScreenPoint(order) {
  const node = Number(order) - 1;
  if (!Number.isInteger(node) || node < 0) return null;
  if (!dynkinHitTargets.length || state.modelMode !== 'dynkin') {
    forceRender();
  }
  const point = dynkinHitTargets[node];
  if (!point) return null;
  return {
    order: node + 1,
    x: point.x,
    y: point.y,
  };
}

function screenPointFor(point, layout = layoutForCanvas()) {
  if (state.modelMode === 'dynkin') {
    const node = simpleRootIndices.indexOf(point.idx);
    const target = dynkinHitTargets[node];
    if (target) {
      return {
        x: target.x,
        y: target.y,
      };
    }
  }
  if (state.modelMode === 'bloom') {
    return {
      x: point.bloomVisible ? point.sx : layout.cx + state.panX,
      y: point.bloomVisible ? point.sy : layout.cy + state.panY,
    };
  }
  const cos = Math.cos(state.rotation);
  const sin = Math.sin(state.rotation);
  return {
    x: layout.cx + state.panX + (point.x * cos - point.y * sin) * layout.scale,
    y: layout.cy + state.panY + (point.x * sin + point.y * cos) * layout.scale,
  };
}

function formatRootCoordinate(value) {
  if (Math.abs(value) < 0.001) return '0';
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) < 0.001) return String(rounded);
  return String(Number(value.toFixed(2)));
}

function formatRootCoordinates(coords) {
  return Array.isArray(coords) ? `[${coords.map(formatRootCoordinate).join(', ')}]` : '[?]';
}

function formatScalar(value) {
  return Number.isFinite(value) ? String(Number(value.toFixed(2))) : '?';
}

function renderCartanMatrix() {
  if (!els.cartanMatrix) return false;
  if (!cartanMatrix.length) {
    els.cartanMatrix.textContent = '';
    return false;
  }
  const header = ['<span class="cartan-corner"></span>']
    .concat(simpleRootIndices.map((idx, order) => `<button type="button" class="cartan-head cartan-action" data-cartan-root="${order + 1}" aria-label="Select alpha ${order + 1}">a${order + 1}</button>`))
    .join('');
  const rows = cartanMatrix.map((row, rowIndex) => {
    const cells = row.map(value => {
      const cls = value === 2 ? 'cartan-diag' : value === -1 ? 'cartan-edge' : value === 0 ? 'cartan-zero' : 'cartan-other';
      return `<span class="cartan-cell ${cls}">${formatScalar(value)}</span>`;
    }).join('');
    return `<button type="button" class="cartan-head cartan-action" data-cartan-root="${rowIndex + 1}" aria-label="Select alpha ${rowIndex + 1}">a${rowIndex + 1}</button>${cells}`;
  }).join('');
  els.cartanMatrix.innerHTML = `<strong>Cartan matrix</strong><div class="cartan-grid">${header}${rows}</div>`;
  return true;
}

function selectedRootRelation() {
  if (previousSelectedRoot == null || state.selectedRoot == null || previousSelectedRoot === state.selectedRoot) return null;
  const from = points[previousSelectedRoot];
  const to = points[state.selectedRoot];
  const fromRoot = data?.e8?.roots8d?.[previousSelectedRoot];
  const toRoot = data?.e8?.roots8d?.[state.selectedRoot];
  if (!from || !to || !fromRoot || !toRoot) return null;
  const dot = innerProduct(fromRoot, toRoot);
  return {
    from: previousSelectedRoot,
    to: state.selectedRoot,
    dot,
    relation: relationLabel(dot),
  };
}

function relationLabel(dot) {
  const rounded = Math.round(dot);
  const value = Math.abs(dot - rounded) < 0.001 ? rounded : dot;
  if (value === -2) return 'Opposite root';
  if (value === -1) return 'Cartan edge';
  if (value === 0) return 'Orthogonal';
  if (value === 1) return 'Positive pair';
  if (value === 2) return 'Same root';
  return `${formatScalar(value)} related`;
}

function modelInfoHtml() {
  if (state.modelMode === 'platonic') {
    const shape = platonicGeometry[state.shape];
    return `<strong>${SHAPE_LABELS[state.shape] || state.shape}</strong><small>Platonic solid | ${shape?.verts?.length || 0} vertices | ${shape?.edges?.length || 0} edges</small><small>Drag, pinch, or enable Motion to inspect the projected solid.</small>`;
  }
  if (state.modelMode === 'poly4d') {
    const poly = polytope4DGeometry[state.polytope4d];
    return `<strong>${POLYTOPE4D_LABELS[state.polytope4d] || state.polytope4d}</strong><small>4D regular polytope | ${poly?.verts?.length || 0} vertices | ${poly?.edges?.length || 0} edges</small><small>Projected from 4D to depth, then into the phone canvas.</small>`;
  }
  if (state.modelMode === 'dynkin') {
    const diagram = dynkinGeometry[state.dynkinDiagram];
    return `<strong>${DYNKIN_LABELS[state.dynkinDiagram] || state.dynkinDiagram} Dynkin diagram</strong><small>${diagram?.nodes?.length || 0} simple roots | ${diagram?.edges?.length || 0} Cartan edges</small><small>Tap an E8 node to select its simple root context.</small>`;
  }
  if (state.modelMode === 'bloom') {
    return `<strong>Designed Bloom</strong><small>${escapeHtml(bloomPhaseLabel())} phase | time ${state.bloomAmount.toFixed(2)}</small><small>Source solid -&gt; 600-cell -&gt; twin H4 -&gt; E8 Coxeter plane. Open View to scrub or animate it.</small>`;
  }
  if (state.modelMode === 'sdf') {
    return '<strong>E8 SDF</strong><small>240 smoothly joined root spheres</small><small>A lightweight mobile counterpart to the desktop raymarcher.</small>';
  }
  return 'No root selected.';
}

function updateSelectionUI(options = {}) {
  const lite = !!options.lite;
  metrics.lastSelectionUiMode = lite ? 'lite' : 'full';
  metrics.lastSelectionUiReason = options.reason || null;
  metrics.lastSelectionUiMs = performance.now();
  if (lite) metrics.selectionUiLiteUpdateCount++;
  else metrics.selectionUiFullUpdateCount++;

  const selected = state.selectedRoot;
  selectedContext = getSelectedContext();
  syncRootJumpControls();
  if (selected == null || !data || !selectedContext) {
    lastSelectionDetailHtml = null;
    rootDrawerExpanded = false;
    els.rootDrawer.classList.add('hidden');
    if (state.modelMode === 'e8_2d') els.infoSelection.textContent = 'No root selected.';
    else els.infoSelection.innerHTML = modelInfoHtml();
    els.subsetOutput.textContent = subsetStatusText();
    els.rootRange.value = '0';
    els.rootOutput.textContent = 'None';
    selectionUiDetailsDeferred = false;
    syncCuriosityCard();
    syncLearnPanel();
    return;
  }
  els.rootRange.value = String(selected);
  els.rootOutput.textContent = `#${selected}`;
  els.subsetOutput.textContent = subsetStatusText();
  const point = data.e8.proj2d[selected];
  if (lite) {
    selectionUiDetailsDeferred = true;
    metrics.selectionUiDeferredDetailCount++;
    syncCuriosityCard();
    syncLearnPanel();
    return;
  }
  const subsetText = points[selected]?.membershipText || 'none';
  const title = selectedContext.simpleRootLabel ? `Root #${selected} (${selectedContext.simpleRootLabel})` : `Root #${selected}`;
  const coords = selectedContext.coordinates;
  const coordsText = formatRootCoordinates(coords);
  const normText = formatScalar(selectedContext.norm);
  const summary = `Ring ${point?.ring ?? '?'} | McKay: ${subsetText} | Neighbors: ${selectedContext.neighborCount} | Opposite: #${selectedContext.antipode ?? '?'}`;
  const relation = selectedRootRelation();
  const relationText = relation ? `From #${relation.from}: dot ${formatScalar(relation.dot)} | ${relation.relation}` : '';
  const relationHtml = relation ? `<small class="root-relation">${relationText}</small>` : '';
  const drawerSummary = `Ring ${point?.ring ?? '?'} | McKay: ${subsetText} | Neighbors ${selectedContext.neighborCount}`;
  const drawerToggleText = rootDrawerExpanded ? 'Less' : 'More';
  const drawerToggleLabel = rootDrawerExpanded ? 'Collapse selected root controls' : 'Expand selected root controls';
  const drawerToggle = `<button type="button" class="drawer-summary" data-root-drawer-toggle aria-expanded="${rootDrawerExpanded ? 'true' : 'false'}" aria-label="${drawerToggleLabel}"><span><strong>${title}</strong><small>${drawerSummary}</small></span><span class="drawer-more">${drawerToggleText}</span></button>`;
  const drawerActions = '<div class="drawer-actions drawer-actions-compact"><button type="button" data-root-action="neighbor" aria-label="Select neighbor">Near</button><button type="button" data-root-action="opposite" aria-label="Select opposite root">Opp</button><button type="button" data-root-action="center" aria-label="Focus selected root">Focus</button><button type="button" data-root-action="clear" aria-label="Clear selection">Clear</button></div>';
  const infoActions = '<div class="drawer-actions"><button type="button" data-root-action="neighbor">Neighbor</button><button type="button" data-root-action="opposite">Opposite</button><button type="button" data-root-action="center">Focus</button><button type="button" data-root-action="clear">Clear</button></div>';
  const drawerHtml = `${drawerToggle}${rootDrawerExpanded ? drawerActions : ''}`;
  const infoHtml = `<strong>${title}</strong><small>${summary}</small><code class="root-coords root-coords-block">8D ${coordsText}</code><small>Norm: ${normText} | Cartan neighbors: dot ${selectedContext.neighborDot}</small>${relationHtml}${infoActions}`;
  const detailKey = `${drawerHtml}\n${infoHtml}`;
  if (detailKey === lastSelectionDetailHtml) {
    metrics.selectionUiFullDomSkipCount++;
    metrics.lastSelectionUiDomRoot = selected;
    metrics.lastSelectionUiDomMs = performance.now();
    els.rootDrawer.classList.remove('hidden');
    els.rootDrawer.classList.toggle('expanded', rootDrawerExpanded);
    els.rootDrawer.classList.toggle('collapsed', !rootDrawerExpanded);
    selectionUiDetailsDeferred = false;
    syncCuriosityCard();
    syncLearnPanel();
    return;
  }
  lastSelectionDetailHtml = detailKey;
  metrics.selectionUiFullDomWriteCount++;
  metrics.lastSelectionUiDomRoot = selected;
  metrics.lastSelectionUiDomMs = performance.now();
  els.rootDrawer.innerHTML = drawerHtml;
  els.rootDrawer.classList.remove('hidden');
  els.rootDrawer.classList.toggle('expanded', rootDrawerExpanded);
  els.rootDrawer.classList.toggle('collapsed', !rootDrawerExpanded);
  els.infoSelection.innerHTML = infoHtml;
  selectionUiDetailsDeferred = false;
  syncCuriosityCard();
  syncLearnPanel();
}

function getState() {
  return { ...state };
}

function getMetrics() {
  const relation = selectedRootRelation();
  return {
    ...metrics,
    canvas: canvas ? { width: canvas.width, height: canvas.height } : null,
    viewport: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio || 1 },
    settingsOpen: isSettingsOpen(),
    chromeFaded,
    rootDrawerExpanded,
    rootDrawerHeight: els.rootDrawer && !els.rootDrawer.classList.contains('hidden') ? els.rootDrawer.getBoundingClientRect().height : 0,
    nativeBackHandlerInstalled,
    statusVisible: !!els.statusToast && !els.statusToast.classList.contains('hidden'),
    settingsSection: els.sheet?.querySelector('.settings-section.active')?.dataset.section || null,
    settingsScrollTop: els.sheetBody ? els.sheetBody.scrollTop : 0,
    renderQueued: !!renderRafId,
    settingsDeferredRenderPending: !!settingsDeferredRenderReason,
    settingsDeferredRenderReason,
    settingsCanvasResizeDeferred,
    selectionUiDetailsDeferred,
    mobileTour: getMobileTourState(),
    mobileTourActive,
    mobileTourTimerActive: !!mobileTourTimer,
    mobileTourPausedForSettings,
    mobileTourStorageGuardActive: !!mobileTourStorageBaseState,
    motionActive: !!motionRafId,
    interactionActive: hasActiveInput(),
    motionPausedForInteraction: hasRuntimeAnimation() && hasActiveInput() && !document.hidden && !isSettingsOpen(),
    runtimeAnimationActive: hasRuntimeAnimation(),
    autoModelElapsed,
    autoModelIndex,
    pointerCount: activePointers.size,
    savePending,
    saveQueued: !!saveTimer,
    selectedRoot: state.selectedRoot,
    contextVisible: !!(state.showContext && selectedContext),
    subsetSize: rootSubset().size,
    subsetIndex: subsetIndex(),
    subsetFrame: subsetFrameMetrics(),
    allFrame: state.modelMode === 'e8_2d' ? allFrameMetrics() : metrics.lastRenderAllFrame,
    selectedRootFrame: selectedRootFrameMetrics(),
    selectedContext: selectedContext ? {
      neighborCount: selectedContext.neighborCount,
      antipode: selectedContext.antipode,
      coordinates: selectedContext.coordinates,
      norm: selectedContext.norm,
      neighborDot: selectedContext.neighborDot,
      simpleRootOrder: selectedContext.simpleRootOrder,
      simpleRootLabel: selectedContext.simpleRootLabel,
    } : null,
    selectedRelation: relation ? {
      from: relation.from,
      to: relation.to,
      dot: relation.dot,
      relation: relation.relation,
    } : null,
  };
}

function subsetIndex() {
  const list = rootSubsetList();
  return state.selectedRoot == null ? -1 : list.indexOf(state.selectedRoot);
}

function subsetStatusText() {
  const list = rootSubsetList();
  const idx = subsetIndex();
  return idx === -1 ? `${list.length} roots` : `${idx + 1}/${list.length}`;
}

function getStoredState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (error) {
    recordError(error);
    return null;
  }
}

function innerProduct(a, b) {
  let total = 0;
  for (let i = 0; i < a.length; i++) total += a[i] * b[i];
  return total;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

async function init() {
  cacheElements();
  renderModelShortcuts();
  renderPaletteSwatches();
  renderSubsetChips();
  renderRootJumps();
  renderMotionSpeedPresets();
  renderFxPresets();
  renderFxModes();
  renderMotionPresets();
  bindEvents();
  data = await loadData();
  installMobileCurriculum(data.curriculum);
  state.learnTopic = LEGACY_LEARN_TOPIC_MAP[state.learnTopic] || state.learnTopic;
  state = normalizeState(state);
  syncAutoMotionPhase('zoom');
  syncAutoMotionPhase('extrude');
  renderLearnTopics();
  preparePoints();
  renderCartanMatrix();
  syncControls();
  forceRender();
  syncMotionLoop();
  window.__mobileApp = {
    getState,
    setState,
    setZoom,
    stepZoom,
    selectRoot,
    selectCartanRoot,
    selectAdjacentRoot,
    selectFirstSubsetRoot,
    selectSubsetRoot,
    selectRootJump,
    selectSubsetChip,
    selectMotionSpeedPreset,
    frameSubset,
    fitAllRoots,
    stepScene,
    setScenePreset,
    selectModelShortcut,
    selectFxPreset,
    selectFxMode,
    selectMotionPreset,
    selectLearnTopic,
    nextLearnTopic,
    setLessonComplete: setMobileLessonComplete,
    getLearningProgress() { return JSON.parse(JSON.stringify(learningProgress)); },
    getMobileTourState,
    startMobileTour,
    stopMobileTour,
    toggleMobileTour,
    nextMobileTourStep,
    previousMobileTourStep,
    mobileSurprise,
    resetMobileDefaults,
    shareSnapshot,
    sharePostcard,
    copyModelData,
    copyModelObj,
    copyDiagnostics,
    canNativeShareSnapshot,
    selectNeighbor,
    selectOpposite,
    clearSelection,
    centerSelectedRoot,
    setRootDrawerExpanded,
    toggleRootDrawer,
    getRootScreenPoint,
    getDynkinNodeScreenPoint,
    handleBackNavigation,
    showStatus,
    hideStatus,
    openSettings,
    closeSettings,
    getMetrics,
    flushSave,
    getStoredState,
    forceRender,
  };
}

window.addEventListener('error', (event) => recordError(event.error || event.message));
window.addEventListener('unhandledrejection', (event) => recordError(event.reason));

init().catch((error) => {
  recordError(error);
  document.body.innerHTML = '<main class="mobile-shell"><div class="selection-card" style="margin:24px">Mobile renderer failed to start.</div></main>';
});
