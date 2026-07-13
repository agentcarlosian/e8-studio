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
  quality: 'smooth',
  showRings: true,
  showContext: true,
  showPetrie: false,
  showMirrors: false,
  highlightSubset: true,
  subset: 'icosahedron',
  pointScale: 1.0,
  autoRotate: false,
  autoModel: false,
  autoColor: false,
  softFx: false,
  rotationSpeed: 0.7,
  rotation: 0,
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
const FX_PRESETS = [
  { id: 'clean', label: 'Clean', autoColor: false, softFx: false },
  { id: 'pulse', label: 'Pulse', autoColor: false, softFx: true },
  { id: 'color', label: 'Color', autoColor: true, softFx: false },
  { id: 'live', label: 'Live', autoColor: true, softFx: true },
];
const MOTION_PRESETS = [
  { id: 'still', label: 'Still', interaction: 'still' },
  { id: 'orbit', label: 'Orbit', interaction: 'orbit' },
  { id: 'showcase', label: 'Show', name: 'Showcase', interaction: 'showcase' },
];

const PALETTES = {
  gold: ['#f4d27a', '#f0a04b', '#fff4b8'],
  cyan: ['#6affe8', '#3ca7ff', '#ecfffb'],
  mono: ['#f4f1ea', '#9d9789', '#ffffff'],
  ember: ['#ffb36c', '#ff6d43', '#ffe2bd'],
};
const PALETTE_LABELS = {
  gold: 'Gold',
  cyan: 'Cyan',
  mono: 'Mono',
  ember: 'Ember',
};

const RENDER_PALETTES = Object.fromEntries(
  Object.entries(PALETTES).map(([name, colors]) => [name, {
    name,
    colors,
    ringStroke: colorWithAlpha(colors[1], 0.18),
    rayStroke: colorWithAlpha(colors[2], 0.22),
    mirrorStroke: colorWithAlpha('#6affe8', 0.34),
    petrieStroke: colorWithAlpha(colors[2], 0.56),
    glowPetrie: colorWithAlpha(colors[2], 0.12),
    glowSelected: colorWithAlpha(colors[2], 0.34),
    glowNeighbor: colorWithAlpha(colors[2], 0.2),
    glowAntipode: colorWithAlpha(colors[1], 0.18),
    glowSubset: colorWithAlpha(colors[2], 0.14),
  }])
);

const SUPPORTED_SUBSETS = new Set(['icosahedron', 'dodecahedron', 'simple_roots']);
const SUPPORTED_MODEL_MODES = new Set(['e8_2d', 'e8_3d', 'platonic', 'poly4d', 'dynkin']);
const SUPPORTED_SHAPES = new Set(['tetrahedron', 'cube', 'octahedron', 'dodecahedron', 'icosahedron']);
const SUPPORTED_POLYTOPES4D = new Set(['5cell', 'tesseract', '16cell', '24cell', '600cell']);
const SUPPORTED_DYNKIN_DIAGRAMS = new Set(['A3', 'A4', 'A5', 'A7', 'D4', 'D5', 'D6', 'E6', 'E7', 'E8']);
const MODEL_LABELS = {
  e8_2d: 'E8',
  e8_3d: 'E8 3D',
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
};
const POLYTOPE4D_LABELS = {
  '5cell': '5-cell',
  tesseract: 'Tesseract',
  '16cell': '16-cell',
  '24cell': '24-cell',
  '600cell': '600-cell',
};
const DYNKIN_LABELS = {
  A3: 'A3',
  A4: 'A4',
  A5: 'A5',
  A7: 'A7',
  D4: 'D4',
  D5: 'D5',
  D6: 'D6',
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
const AUTO_MODEL_INTERVAL_S = 3.6;
const MOBILE_TOUR_INTERVAL_MS = 4200;
const TAU = Math.PI * 2;
const DRAW_SUBSET = 1;
const DRAW_SELECTED = 2;
const DRAW_NEIGHBOR = 4;
const DRAW_ANTIPODE = 8;
const DRAW_PETRIE = 16;
const BASE_POINT_BUCKET_COUNT = 2;
const AUTO_MODEL_SEQUENCE = [
  { modelMode: 'e8_2d', shape: 'icosahedron' },
  { modelMode: 'e8_3d', shape: 'icosahedron' },
  { modelMode: 'platonic', shape: 'tetrahedron' },
  { modelMode: 'platonic', shape: 'cube' },
  { modelMode: 'platonic', shape: 'octahedron' },
  { modelMode: 'platonic', shape: 'dodecahedron' },
  { modelMode: 'platonic', shape: 'icosahedron' },
  { modelMode: 'poly4d', polytope4d: '24cell' },
  { modelMode: 'poly4d', polytope4d: '600cell' },
  { modelMode: 'dynkin', dynkinDiagram: 'E8' },
];
const SCENE_PRESETS = [
  { id: 'e8_2d', label: 'E8', target: { modelMode: 'e8_2d' } },
  { id: 'e8_3d', label: 'E8 3D', target: { modelMode: 'e8_3d' } },
  { id: 'tetrahedron', label: 'Tet', target: { modelMode: 'platonic', shape: 'tetrahedron' } },
  { id: 'cube', label: 'Cube', target: { modelMode: 'platonic', shape: 'cube' } },
  { id: 'octahedron', label: 'Oct', target: { modelMode: 'platonic', shape: 'octahedron' } },
  { id: 'dodecahedron', label: 'Dod', target: { modelMode: 'platonic', shape: 'dodecahedron' } },
  { id: 'icosahedron', label: 'Ico', target: { modelMode: 'platonic', shape: 'icosahedron' } },
  { id: '5cell', label: '5-cell', target: { modelMode: 'poly4d', polytope4d: '5cell' } },
  { id: 'tesseract', label: 'Tess', target: { modelMode: 'poly4d', polytope4d: 'tesseract' } },
  { id: '16cell', label: '16', target: { modelMode: 'poly4d', polytope4d: '16cell' } },
  { id: '24cell', label: '24', target: { modelMode: 'poly4d', polytope4d: '24cell' } },
  { id: '600cell', label: '600', target: { modelMode: 'poly4d', polytope4d: '600cell' } },
  { id: 'dynkin-e8', label: 'Dynkin', target: { modelMode: 'dynkin', dynkinDiagram: 'E8' } },
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
    id: 'e8-depth',
    label: 'E8 3D',
    target: { modelMode: 'e8_3d' },
    title: 'E8 depth view',
    body: 'The same roots are projected with depth so the lattice structure feels spatial without WebGL.',
    detail: 'Drag or enable Orbit after the tour for movement.',
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
    id: 'e8',
    label: 'E8',
    items: [
      { id: 'e8_2d', label: '2D', name: 'E8 Coxeter', target: { modelMode: 'e8_2d' } },
      { id: 'e8_3d', label: '3D', name: 'E8 3D roots', target: { modelMode: 'e8_3d' } },
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
    id: 'poly4d',
    label: '4D',
    items: [
      { id: 'poly-5cell', label: '5', name: '5-cell', target: { modelMode: 'poly4d', polytope4d: '5cell' } },
      { id: 'poly-tesseract', label: 'Tess', name: 'Tesseract', target: { modelMode: 'poly4d', polytope4d: 'tesseract' } },
      { id: 'poly-16cell', label: '16', name: '16-cell', target: { modelMode: 'poly4d', polytope4d: '16cell' } },
      { id: 'poly-24cell', label: '24', name: '24-cell', target: { modelMode: 'poly4d', polytope4d: '24cell' } },
      { id: 'poly-600cell', label: '600', name: '600-cell', target: { modelMode: 'poly4d', polytope4d: '600cell' } },
    ],
  },
  {
    id: 'dynkin',
    label: 'Dynkin',
    items: [
      { id: 'dynkin-A3', label: 'A3', name: 'A3 Dynkin', target: { modelMode: 'dynkin', dynkinDiagram: 'A3' } },
      { id: 'dynkin-A4', label: 'A4', name: 'A4 Dynkin', target: { modelMode: 'dynkin', dynkinDiagram: 'A4' } },
      { id: 'dynkin-A5', label: 'A5', name: 'A5 Dynkin', target: { modelMode: 'dynkin', dynkinDiagram: 'A5' } },
      { id: 'dynkin-A7', label: 'A7', name: 'A7 Dynkin', target: { modelMode: 'dynkin', dynkinDiagram: 'A7' } },
      { id: 'dynkin-D4', label: 'D4', name: 'D4 Dynkin', target: { modelMode: 'dynkin', dynkinDiagram: 'D4' } },
      { id: 'dynkin-D5', label: 'D5', name: 'D5 Dynkin', target: { modelMode: 'dynkin', dynkinDiagram: 'D5' } },
      { id: 'dynkin-D6', label: 'D6', name: 'D6 Dynkin', target: { modelMode: 'dynkin', dynkinDiagram: 'D6' } },
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
  'autoRotate',
  'autoModel',
  'autoColor',
  'softFx',
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
  e8Projection3DCount: 0,
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
  scenePresetButtonCount: 0,
  scenePresetSelectCount: 0,
  scenePresetSyncSkipCount: 0,
  lastScenePresetId: null,
  lastScenePresetLabel: null,
  lastScenePresetMs: null,
  lastScenePresetTarget: null,
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
let dynkinGeometry = {};
let dynkinHitTargets = [];
let mckayInfo = {};
let curiosityKey = null;
let curiosityIndex = 0;
let subsetSets = {};
let subsetLists = {};
let petrieCycle = [];
let petrieSet = EMPTY_SET;
let simpleRootIndices = [];
let simpleRootOrdinalByIndex = new Map();
let cartanMatrix = [];
let selectedContext = null;
let startedAt = performance.now();
let canvas;
let ctx;
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
let savePending = false;
let saveRequestedAt = 0;
let stylePhase = 0;
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
  if (!PALETTES[next.palette]) next.palette = DEFAULT_STATE.palette;
  if (!QUALITY[next.quality]) next.quality = DEFAULT_STATE.quality;
  if (!SUPPORTED_MODEL_MODES.has(next.modelMode)) next.modelMode = DEFAULT_STATE.modelMode;
  if (!SUPPORTED_SHAPES.has(next.shape)) next.shape = DEFAULT_STATE.shape;
  if (!SUPPORTED_POLYTOPES4D.has(next.polytope4d)) next.polytope4d = DEFAULT_STATE.polytope4d;
  if (!SUPPORTED_DYNKIN_DIAGRAMS.has(next.dynkinDiagram)) next.dynkinDiagram = DEFAULT_STATE.dynkinDiagram;
  if (LEARN_TOPIC_IDS.size > 1 && !LEARN_TOPIC_IDS.has(next.learnTopic)) next.learnTopic = DEFAULT_STATE.learnTopic;
  if (!SUPPORTED_SUBSETS.has(next.subset)) next.subset = DEFAULT_STATE.subset;
  next.pointScale = clamp(Number(next.pointScale) || 1, 0.7, 1.8);
  next.rotationSpeed = clamp(Number(next.rotationSpeed) || 0.7, 0.2, 2);
  next.rotation = Number(next.rotation) || 0;
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
  if (typeof next.highlightSubset !== 'boolean') next.highlightSubset = true;
  if (typeof next.autoRotate !== 'boolean') next.autoRotate = false;
  if (typeof next.autoModel !== 'boolean') next.autoModel = false;
  if (typeof next.autoColor !== 'boolean') next.autoColor = false;
  if (typeof next.softFx !== 'boolean') next.softFx = false;
  if (next.modelMode === 'platonic' || next.modelMode === 'poly4d') next.selectedRoot = null;
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
  const [e8, e8Math, mckaySubsets, platonic, polytopes4d, dynkin, mckay, curriculum] = await Promise.all([
    fetch('data/e8.json').then(r => r.json()),
    fetch('data/e8_math.json').then(r => r.json()),
    fetch('data/mckay_subsets.json').then(r => r.json()),
    fetch('data/platonic.json').then(r => r.json()),
    fetch('data/polytopes4d.json').then(r => r.json()),
    fetch('data/dynkin.json').then(r => r.json()),
    fetch('data/mckay.json').then(r => r.json()),
    fetch('data/curriculum.json').then(r => r.json()),
  ]);
  return { e8, e8_math: e8Math, mckay_subsets: mckaySubsets, platonic, polytopes4d, dynkin, mckay, curriculum };
}

function cacheElements() {
  els.shell = document.querySelector('.mobile-shell');
  canvas = document.getElementById('mobile-canvas');
  ctx = canvas.getContext('2d', { alpha: false });
  els.settingsButton = document.getElementById('settings-button');
  els.qualityChip = document.getElementById('quality-chip');
  els.sceneChip = document.getElementById('scene-chip');
  els.statusToast = document.getElementById('status-toast');
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
  els.modelSelect = document.getElementById('model-select');
  els.shapeField = document.getElementById('shape-field');
  els.shapeSelect = document.getElementById('shape-select');
  els.polytope4DField = document.getElementById('polytope4d-field');
  els.polytope4DSelect = document.getElementById('polytope4d-select');
  els.dynkinField = document.getElementById('dynkin-field');
  els.dynkinSelect = document.getElementById('dynkin-select');
  els.scenePresetGrid = document.getElementById('scene-preset-grid');
  els.scenePresetOutput = document.getElementById('scene-preset-output');
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
  els.fxPresetGrid = document.getElementById('fx-preset-grid');
  els.fxPresetOutput = document.getElementById('fx-preset-output');
  els.pointSize = document.getElementById('point-size');
  els.ringsToggle = document.getElementById('rings-toggle');
  els.autoColorToggle = document.getElementById('auto-color-toggle');
  els.softFxToggle = document.getElementById('soft-fx-toggle');
  els.motionToggle = document.getElementById('motion-toggle');
  els.autoModelToggle = document.getElementById('auto-model-toggle');
  els.motionSpeed = document.getElementById('motion-speed');
  els.motionSpeedGrid = document.getElementById('motion-speed-grid');
  els.motionSpeedOutput = document.getElementById('motion-speed-output');
  els.motionPresetGrid = document.getElementById('motion-preset-grid');
  els.motionPresetOutput = document.getElementById('motion-preset-output');
  els.sectionTabs = [...els.sheet.querySelectorAll('[data-section-tab]')];
  els.sectionPanels = [...els.sheet.querySelectorAll('[data-section]')];
  els.qualityButtons = [...els.sheet.querySelectorAll('[data-quality]')];
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
    const scenePreset = event.target.closest('[data-scene-preset]')?.dataset.scenePreset;
    if (scenePreset) {
      selectScenePreset(scenePreset);
      return;
    }
    const modelShortcut = event.target.closest('[data-model-shortcut]')?.dataset.modelShortcut;
    if (modelShortcut) {
      selectModelShortcut(modelShortcut);
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
    const styleAction = event.target.closest('[data-style-action]')?.dataset.styleAction;
    if (styleAction) {
      handleStyleAction(styleAction);
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
    if (event.target.closest('[data-action="reset-view"]')) resetView();
  });

  els.highlightToggle.addEventListener('change', () => setSettingState({ highlightSubset: els.highlightToggle.checked }, 'highlight-toggle'));
  els.contextToggle.addEventListener('change', () => setSettingState({ showContext: els.contextToggle.checked }, 'context-toggle'));
  els.petrieToggle.addEventListener('change', () => setSettingState({ showPetrie: els.petrieToggle.checked }, 'petrie-toggle'));
  els.mirrorsToggle.addEventListener('change', () => setSettingState({ showMirrors: els.mirrorsToggle.checked }, 'mirrors-toggle'));
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
  els.subsetSelect.addEventListener('change', () => setManualExploreState({ subset: els.subsetSelect.value }, 'subset-select', { syncSubset: true }));
  els.rootRange.addEventListener('input', () => selectRoot(Number(els.rootRange.value), { save: false, interactionType: 'root-scrub' }));
  els.rootRange.addEventListener('change', () => selectRoot(Number(els.rootRange.value), { interactionType: 'root-commit' }));
  els.paletteSelect.addEventListener('change', () => setSettingState({ palette: els.paletteSelect.value }, 'palette-select', { syncPalette: true }));
  els.pointSize.addEventListener('input', () => previewState({ pointScale: Number(els.pointSize.value) }, 'point-size'));
  els.pointSize.addEventListener('change', () => commitLiveControl('point-size'));
  els.ringsToggle.addEventListener('change', () => setSettingState({ showRings: els.ringsToggle.checked }, 'rings-toggle'));
  els.autoColorToggle.addEventListener('change', () => setManualRuntimeState({ autoColor: els.autoColorToggle.checked }, 'auto-color-toggle', { syncFx: true, syncMotionPreset: true }));
  els.softFxToggle.addEventListener('change', () => setManualRuntimeState({ softFx: els.softFxToggle.checked }, 'soft-fx-toggle', { syncFx: true, syncMotionPreset: true }));
  els.motionToggle.addEventListener('change', () => setManualRuntimeState({ autoRotate: els.motionToggle.checked }, 'motion-toggle', { syncMotionPreset: true }));
  els.autoModelToggle.addEventListener('change', () => setManualRuntimeState({ autoModel: els.autoModelToggle.checked }, 'auto-model-toggle', { syncMotionPreset: true }));
  els.motionSpeed.addEventListener('input', () => {
    previewState({ rotationSpeed: Number(els.motionSpeed.value) }, 'motion-speed', { render: false });
    syncMotionSpeedControls();
  });
  els.motionSpeed.addEventListener('change', () => commitLiveControl('motion-speed', { render: false }));

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
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

function handleStyleAction(action) {
  if (!action) return false;
  if (action === 'surprise') return mobileSurprise();
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
  if (modelMode === 'platonic' || modelMode === 'poly4d') return null;
  if (modelMode === 'dynkin') return simpleRootIndices.includes(state.selectedRoot) ? state.selectedRoot : null;
  return state.selectedRoot;
}

function handleMotionAction(action) {
  if (!action) return false;
  if (action === 'still' || action === 'orbit' || action === 'showcase') return selectMotionPreset(action);
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
  return {
    ...base,
    kind: 'e8-root-system',
    name: state.modelMode === 'e8_3d' ? 'e8-3d-roots' : 'e8-coxeter',
    label: state.modelMode === 'e8_3d' ? 'E8 3D roots' : 'E8 Coxeter',
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
  const isDepth = state.modelMode === 'e8_3d';
  const vertices = points.map(point => {
    if (isDepth) {
      const v = e8ModelVector(point.idx);
      return [v.x, v.y, v.z];
    }
    return [point.x, point.y, 0];
  });
  const record = {
    kind: isDepth ? 'e8-root-point-cloud-3d-obj' : 'e8-root-point-cloud-2d-obj',
    name: isDepth ? 'e8-3d-roots' : 'e8-coxeter',
    vertices,
    lines: state.showPetrie ? petrieCycle.map((idx, order) => [idx, petrieCycle[(order + 1) % petrieCycle.length]]) : [],
    faces: [],
    pointsOnly: true,
    note: isDepth ? 'E8 roots exported with the mobile depth coordinate.' : 'E8 Coxeter roots exported on the z=0 plane.',
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

function canvasToPngBlob() {
  return canvasElementToPngBlob(canvas, 'Could not create PNG snapshot');
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

  const srcW = Math.max(1, canvas?.width || 1);
  const srcH = Math.max(1, canvas?.height || 1);
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
  target.drawImage(canvas, 0, 0, srcW, srcH, imageX, imageY, imageW, imageH);
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
  target.fillText('MOBILE V2 / CANVAS 2D', textX, height - pad);
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
  const patch = {
    palette: randomDifferent(palettes, state.palette),
    subset: randomDifferent(subsets, state.subset),
    pointScale: randomChoice([0.9, 1, 1.1, 1.3]),
    showRings: Math.random() > 0.18,
    showPetrie: Math.random() < 0.34,
    showMirrors: Math.random() < 0.28,
    highlightSubset: true,
    showContext: true,
    quality: 'smooth',
    autoRotate: false,
    autoModel: false,
    autoColor: false,
    softFx: false,
    rotationSpeed: DEFAULT_STATE.rotationSpeed,
    rotation: Math.random() * TAU,
    panX: 0,
    panY: 0,
    zoom: 1,
    selectedRoot: null,
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
      autoModel: true,
      autoColor: true,
      softFx: true,
    };
  } else if (mode === 'orbit') {
    patch = {
      autoRotate: true,
      autoModel: false,
    };
  } else {
    patch = {
      autoRotate: false,
      autoModel: false,
      autoColor: false,
      softFx: false,
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
  state = next;
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
  if (options.syncSubset) syncSubsetControls();
  if (options.syncMotionSpeed) syncMotionSpeedControls();
  if (options.syncMotionPreset) syncMotionPresetControls();
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

function resetView() {
  stopMobileTourForManualExplore();
  setState({ rotation: 0, panX: 0, panY: 0, zoom: 1, selectedRoot: null });
  showStatus('View reset');
}

function scenePresetLabel(preset) {
  const target = preset?.target || {};
  if (target.modelMode === 'e8_2d') return 'E8 Coxeter';
  if (target.modelMode === 'e8_3d') return 'E8 3D roots';
  if (target.modelMode === 'platonic') return SHAPE_LABELS[target.shape] || preset.label;
  if (target.modelMode === 'poly4d') return POLYTOPE4D_LABELS[target.polytope4d] || preset.label;
  if (target.modelMode === 'dynkin') return `${DYNKIN_LABELS[target.dynkinDiagram] || preset.label} Dynkin`;
  return preset?.label || 'Scene';
}

function scenePresetMatches(preset) {
  const target = preset?.target;
  if (!target || target.modelMode !== state.modelMode) return false;
  if (target.modelMode === 'platonic') return target.shape === state.shape;
  if (target.modelMode === 'poly4d') return target.polytope4d === state.polytope4d;
  if (target.modelMode === 'dynkin') return target.dynkinDiagram === state.dynkinDiagram;
  return true;
}

function activeScenePreset() {
  return SCENE_PRESETS.find(scenePresetMatches) || null;
}

function renderScenePresetButtons() {
  if (!els.scenePresetGrid) return false;
  els.scenePresetGrid.innerHTML = SCENE_PRESETS.map(preset => (
    `<button type="button" data-scene-preset="${escapeHtml(preset.id)}" aria-label="${escapeHtml(scenePresetLabel(preset))}">${escapeHtml(preset.label)}</button>`
  )).join('');
  metrics.scenePresetButtonCount = SCENE_PRESETS.length;
  return true;
}

function syncScenePresetControls() {
  if (!els.scenePresetGrid) return false;
  const active = activeScenePreset();
  if (els.scenePresetOutput) els.scenePresetOutput.textContent = active ? active.label : sceneStatusText();
  els.scenePresetGrid.querySelectorAll('[data-scene-preset]').forEach(button => {
    const isActive = active?.id === button.dataset.scenePreset;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
  return true;
}

function selectScenePreset(id) {
  const preset = SCENE_PRESETS.find(item => item.id === id);
  if (!preset) return false;
  return setScenePreset(preset.target, {
    interactionType: `scene-preset-${preset.id}`,
    metricKind: 'scene-preset',
    preset,
  });
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
    const label = PALETTE_LABELS[name] || name;
    const dots = colors.map(color => `<i style="--dot:${escapeHtml(color)}"></i>`).join('');
    return `<button type="button" data-palette-swatch="${escapeHtml(name)}" aria-label="${escapeHtml(label)} palette"><span class="palette-dots" aria-hidden="true">${dots}</span><span>${escapeHtml(label)}</span></button>`;
  }).join('');
  metrics.paletteSwatchButtonCount = Object.keys(PALETTES).length;
  return true;
}

function syncPaletteControls() {
  if (els.paletteSelect) els.paletteSelect.value = state.palette;
  const label = PALETTE_LABELS[state.palette] || state.palette;
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
  metrics.lastPaletteSwatchLabel = PALETTE_LABELS[state.palette] || state.palette;
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
    `<button type="button" data-fx-preset="${escapeHtml(preset.id)}" aria-label="${escapeHtml(fxPresetLabel(preset))} FX preset">${escapeHtml(preset.label)}</button>`
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
  showStatus(`FX: ${metrics.lastFxPresetLabel}`);
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
  if (state.autoRotate && state.autoModel && state.autoColor && state.softFx) {
    return MOTION_PRESETS.find(preset => preset.id === 'showcase') || null;
  }
  if (state.autoRotate && !state.autoModel) {
    return MOTION_PRESETS.find(preset => preset.id === 'orbit') || null;
  }
  if (!state.autoRotate && !state.autoModel && !state.autoColor && !state.softFx) {
    return MOTION_PRESETS.find(preset => preset.id === 'still') || null;
  }
  return null;
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
  return true;
}

function selectMotionPreset(id) {
  const preset = MOTION_PRESETS.find(item => item.id === id || item.interaction === id);
  if (!preset) return false;
  if (mobileTourActive) stopMobileTour({ interactionType: 'mobile-tour-manual-runtime-stop', status: false });
  const previous = {
    autoRotate: state.autoRotate,
    autoModel: state.autoModel,
    autoColor: state.autoColor,
    softFx: state.softFx,
  };
  const result = setAutoPreset(preset.interaction);
  const changed = previous.autoRotate !== state.autoRotate
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
  const patch = {
    modelMode: target.modelMode,
    selectedRoot: null,
  };
  if (target.shape) patch.shape = target.shape;
  if (target.polytope4d) patch.polytope4d = target.polytope4d;
  if (target.dynkinDiagram) patch.dynkinDiagram = target.dynkinDiagram;
  if (state.autoModel) patch.autoModel = false;
  return patch;
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
  const interactionType = options.interactionType || 'scene-preset';
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
  if (metricKind === 'scene-preset') {
    metrics.scenePresetSelectCount++;
    metrics.scenePresetSyncSkipCount++;
    metrics.lastScenePresetId = options.preset?.id || null;
    metrics.lastScenePresetLabel = options.preset ? scenePresetLabel(options.preset) : sceneStatusText();
    metrics.lastScenePresetMs = performance.now();
    metrics.lastScenePresetTarget = snapshot;
  } else if (metricKind === 'model-shortcut') {
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
  syncSubsetControls();
  els.rootRange.value = String(state.selectedRoot ?? 0);
  els.rootOutput.textContent = state.selectedRoot == null ? 'None' : `#${state.selectedRoot}`;
  syncRootJumpControls();
  els.zoomOutput.textContent = `${Math.round(state.zoom * 100)}%`;
  els.pointSize.value = String(state.pointScale);
  els.ringsToggle.checked = state.showRings;
  syncFxPresetControls();
  syncMotionPresetControls();
  syncMotionSpeedControls();
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
  if (els.autoModelToggle) els.autoModelToggle.checked = state.autoModel;
  syncScenePresetControls();
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

function activeSceneSummary() {
  if (state.modelMode === 'platonic') {
    const shape = platonicGeometry[state.shape];
    const label = SHAPE_LABELS[state.shape] || state.shape;
    const verts = shape?.verts?.length || 0;
    const edges = shape?.edges?.length || 0;
    const source = activeMckaySource();
    const info = mckayInfo[source] || {};
    return {
      chipStrong: MODEL_LABELS.platonic,
      chipSmall: `${label} / ${verts}v`,
      topbarLabel: `${label} Platonic solid, ${verts} vertices, ${edges} edges`,
      canvasLabel: `${label} Platonic solid visualization with ${verts} vertices and ${edges} edges`,
      infoCopy: `${label} renders desktop Platonic solid data on the mobile Canvas 2D path. Drag, pinch, or enable Motion to inspect it; the McKay bridge links this source to ${info.roots || 'ADE roots'}.`,
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
      infoCopy: `${label} is projected from 4D into a depth view and then drawn with Canvas 2D. Motion rotates the projection without switching to a heavy mobile renderer.`,
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
  if (state.modelMode === 'e8_3d') {
    return {
      chipStrong: MODEL_LABELS.e8_3d,
      chipSmall: '240 roots / depth',
      topbarLabel: 'E8 3D roots, 240 roots, depth projection',
      canvasLabel: 'E8 3D root visualization with 240 roots and depth projection',
      infoCopy: 'The same 240 E8 root vectors are given a lightweight depth coordinate for phone inspection. Tap a root for McKay, Cartan, neighbor, opposite-root, and 8D coordinate context.',
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
  if (state.modelMode === 'platonic' && mckayInfo[state.shape]) return state.shape;
  if (state.modelMode === 'dynkin') {
    if (state.dynkinDiagram === 'E6') return 'tetrahedron';
    if (state.dynkinDiagram === 'E7') return 'cube';
    if (state.dynkinDiagram === 'E8') return 'icosahedron';
  }
  if (state.modelMode === 'poly4d' && state.polytope4d === '600cell') return 'icosahedron';
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
  } else if (state.modelMode === 'e8_3d') {
    notes.push({
      title: 'Depth view',
      body: 'E8 3D reuses the same 240 roots and gives them a phone-friendly depth coordinate.',
      detail: 'Tap still selects roots; drag and Motion rotate the depth cue.',
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
  return typeof q.scale === 'function' ? q.scale() : q.scale;
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

function preparePoints() {
  const proj = data.e8.proj2d;
  const roots = data.e8.roots8d || [];
  platonicGeometry = data.platonic || {};
  platonicFaceCache = new Map();
  polytope4DGeometry = data.polytopes4d || {};
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
      baseSize: 3.4 + (1 - norm) * 5.2,
      baseFillSlot: p.ring / ringBucketCount < 0.5 ? 0 : 1,
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
    const w = window.innerWidth;
    const h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#07070c';
    ctx.fillRect(0, 0, w, h);

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
      stylePhase,
      modelVertices: 0,
      modelProjectedVertices: 0,
      modelEdges: 0,
      modelEdgeStrokes: 0,
      modelFaces: 0,
      modelFaceFills: 0,
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

    if (state.modelMode === 'e8_3d') {
      projectE83DIntoCache(layout, drawStats);
      const projectedAllFrame = projectedPointFrameMetrics(allRootList);
      drawE83DModel(paletteSet, subset, visibleContext, drawStats, interactionLiteFrame);
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

function completeRender(t0, drawStats, projectedAllFrame, liveControlLiteFrame) {
  metrics.renderCount++;
  metrics.lastDrawStats = drawStats;
  metrics.lastRenderAllFrame = projectedAllFrame;
  metrics.lastRenderFrameSource = state.modelMode === 'e8_2d' ? 'projected-points' : state.modelMode;
  metrics.renderFrameReuseCount++;
  metrics.lastProjectionSource = state.modelMode === 'e8_2d' ? 'direct-point-fields' : 'model-projection';
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
  if (state.modelMode !== 'e8_2d') metrics.modelRenderCount++;
  if (state.modelMode === 'e8_3d') metrics.e8Projection3DCount++;
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
  for (const p of points) {
    const x = p.x * cos - p.y * sin;
    const y = p.x * sin + p.y * cos;
    p.sx = originX + x * scale;
    p.sy = originY + y * scale;
    p.size = p.baseSize * pointScale;
    drawStats.projectedPoints++;
    drawStats.baseSizeCacheHits++;
  }
}

function projectModelPoint(x, y, z, layout, modelScale = 1) {
  const yaw = state.rotation;
  const pitch = 0.68;
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
  const scale = layout.scale * modelScale * perspective;
  return {
    x: layout.cx + state.panX + rx * scale,
    y: layout.cy + state.panY + ry * scale,
    z: depth,
    perspective,
  };
}

function e8ModelVector(index) {
  const p = points[index];
  const root = data.e8.roots8d?.[index] || [];
  const z = (
    (root[0] || 0) - (root[1] || 0) +
    (root[2] || 0) - (root[3] || 0) +
    (root[4] || 0) * 0.6 - (root[5] || 0) * 0.6 +
    (root[6] || 0) * 0.35 - (root[7] || 0) * 0.35
  ) / 2.4;
  return { x: (p?.x || 0) * 0.92, y: (p?.y || 0) * 0.92, z };
}

function projectE83DIntoCache(layout, drawStats) {
  const pointScale = state.pointScale;
  for (const p of points) {
    const v = e8ModelVector(p.idx);
    const projected = projectModelPoint(v.x, v.y, v.z, layout, 0.92);
    p.sx = projected.x;
    p.sy = projected.y;
    p.depth = projected.z;
    p.size = Math.max(2.3, p.baseSize * pointScale * (0.72 + projected.perspective * 0.38));
    drawStats.projectedPoints++;
    drawStats.modelProjectedVertices++;
    drawStats.baseSizeCacheHits++;
  }
}

function drawE83DModel(paletteSet, subset, visibleContext, drawStats, interactionLiteFrame) {
  if (visibleContext && !interactionLiteFrame) {
    const rayStats = drawNeighborRays(visibleContext, paletteSet);
    drawStats.rays = rayStats.rays;
    drawStats.rayStrokes = rayStats.strokes;
    drawStats.alphaColorCacheHits += rayStats.colorCacheHits;
  }
  else if (visibleContext) {
    drawStats.raysSkippedForInteraction = visibleContext.neighborCount;
  }
  const ordered = [...points].sort((a, b) => (a.depth || 0) - (b.depth || 0));
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
    if (mask && !interactionLiteFrame) {
      drawStats.glowFills++;
      drawStats.alphaColorCacheHits++;
    }
    drawStats.directPoints++;
    if (interactionLiteFrame && mask) drawStats.glowsSkippedForInteraction++;
    drawStats.directPointFills += drawPoint(p, paletteSet, mask, interactionLiteFrame);
  }
  drawStats.modelVertices = points.length;
}

function normalizedPlatonicVerts(shape) {
  const verts = shape?.verts || [];
  let maxR = 0;
  for (const v of verts) maxR = Math.max(maxR, Math.hypot(v[0], v[1], v[2]));
  const denom = maxR || 1;
  return verts.map(v => [v[0] / denom, v[1] / denom, v[2] / denom]);
}

function platonicFaces(shapeName, shape) {
  if (!shape) return [];
  if (platonicFaceCache.has(shapeName)) return platonicFaceCache.get(shapeName);
  const faces = Array.isArray(shape.faces) ? shape.faces.filter(face => Array.isArray(face) && face.length >= 3) : [];
  platonicFaceCache.set(shapeName, faces);
  return faces;
}

function drawPlatonicModel(layout, paletteSet, drawStats, interactionLiteFrame) {
  const shapeName = SUPPORTED_SHAPES.has(state.shape) ? state.shape : DEFAULT_STATE.shape;
  const shape = platonicGeometry[shapeName] || platonicGeometry[DEFAULT_STATE.shape];
  if (!shape) return null;
  const verts = normalizedPlatonicVerts(shape);
  const projected = verts.map(v => projectModelPoint(v[0], v[1], v[2], layout, 1.04));
  drawStats.modelVertices = verts.length;
  drawStats.modelProjectedVertices = projected.length;
  drawStats.modelEdges = shape.edges?.length || 0;
  drawStats.modelFaces = shape.faces?.length || 0;
  const frame = projectedModelFrameMetrics(projected);

  if (!interactionLiteFrame) {
    const faces = platonicFaces(shapeName, shape)
      .map(face => ({
        face,
        depth: face.reduce((total, idx) => total + (projected[idx]?.z || 0), 0) / face.length,
      }))
      .sort((a, b) => a.depth - b.depth);
    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle = paletteSet.glowSubset;
    ctx.strokeStyle = colorWithAlpha(paletteSet.colors[2], 0.18);
    ctx.lineWidth = 1;
    for (const entry of faces) {
      const first = projected[entry.face[0]];
      if (!first) continue;
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
  }

  ctx.save();
  ctx.lineWidth = interactionLiteFrame ? 1.2 : 1.6;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.strokeStyle = paletteSet.petrieStroke;
  ctx.beginPath();
  for (const edge of shape.edges || []) {
    const a = projected[edge[0]];
    const b = projected[edge[1]];
    if (!a || !b) continue;
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
  drawStats.modelEdgeStrokes = shape.edges?.length ? 1 : 0;
  ctx.restore();

  const ordered = projected
    .map((point, idx) => ({ point, idx }))
    .sort((a, b) => a.point.z - b.point.z);
  ctx.save();
  for (const entry of ordered) {
    const pulse = state.softFx ? 1 + Math.sin(stylePhase * TAU) * 0.07 : 1;
    const radius = Math.max(3.2, 5.8 * (0.8 + entry.point.perspective * 0.3) * state.pointScale * pulse);
    ctx.beginPath();
    ctx.arc(entry.point.x, entry.point.y, radius, 0, TAU);
    ctx.fillStyle = paletteSet.colors[entry.idx % paletteSet.colors.length];
    ctx.fill();
  }
  ctx.restore();
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
    const point = projectModelPoint(x, y, z, layout, polyName === '600cell' ? 1.22 : 1.16);
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

  ctx.save();
  ctx.lineWidth = polyName === '600cell' ? (interactionLiteFrame ? 0.55 : 0.72) : (interactionLiteFrame ? 1 : 1.35);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.globalAlpha = polyName === '600cell' ? 0.48 : 0.66;
  ctx.strokeStyle = paletteSet.petrieStroke;
  ctx.beginPath();
  for (const edge of poly.edges || []) {
    const a = projected[edge[0]];
    const b = projected[edge[1]];
    if (!a || !b) continue;
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
  }
  ctx.stroke();
  drawStats.modelEdgeStrokes = poly.edges?.length ? 1 : 0;
  ctx.restore();

  const classes = Array.isArray(poly.conjugacy_classes) ? poly.conjugacy_classes : null;
  const ordered = projected
    .map((point, idx) => ({ point, idx }))
    .sort((a, b) => a.point.z - b.point.z);
  ctx.save();
  for (const entry of ordered) {
    const cls = classes ? classes[entry.idx] || 0 : entry.idx;
    const pulse = state.softFx ? 1 + Math.sin(stylePhase * TAU + entry.idx * 0.17) * 0.06 : 1;
    const baseRadius = polyName === '600cell' ? 3.1 : 4.8;
    const radius = Math.max(2.4, baseRadius * (0.76 + entry.point.perspective * 0.32) * state.pointScale * pulse);
    ctx.beginPath();
    ctx.arc(entry.point.x, entry.point.y, radius, 0, TAU);
    ctx.fillStyle = paletteSet.colors[cls % paletteSet.colors.length];
    ctx.fill();
    drawStats.directPoints++;
    drawStats.directPointFills++;
  }
  ctx.restore();
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

  ctx.save();
  ctx.lineWidth = interactionLiteFrame ? 2 : 2.5;
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
  drawStats.modelEdgeStrokes = diagram.edges?.length ? 1 : 0;
  ctx.restore();

  const selectedNode = drawStats.dynkinSelectedNode;
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 13px system-ui, sans-serif';
  for (const point of projected) {
    const isSelected = point.index === selectedNode;
    const pulse = state.softFx ? 1 + Math.sin(stylePhase * TAU + point.index * 0.5) * 0.06 : 1;
    const radius = (isSelected ? 17 : 14) * state.pointScale * pulse;
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
  ctx.globalAlpha = 0.72;
  for (let slot = 0; slot < basePointBuckets.length; slot++) {
    const batch = basePointBuckets[slot];
    if (!batch.length) continue;
    ctx.beginPath();
    for (const p of batch) {
      ctx.moveTo(p.sx + p.size, p.sy);
      ctx.arc(p.sx, p.sy, p.size, 0, TAU);
      stats.points++;
    }
    ctx.fillStyle = palette[slot] || palette[0];
    ctx.fill();
    stats.fills++;
    stats.buckets++;
  }
  ctx.restore();
  return stats;
}

function basePointFill(p, palette) {
  return palette[p.baseFillSlot] || palette[0];
}

function drawPoint(p, paletteSet, mask, skipGlow = false) {
  const palette = paletteSet.colors;
  const inSubset = !!(mask & DRAW_SUBSET);
  const selected = !!(mask & DRAW_SELECTED);
  const neighbor = !!(mask & DRAW_NEIGHBOR);
  const antipode = !!(mask & DRAW_ANTIPODE);
  const inPetrie = !!(mask & DRAW_PETRIE);
  const fill = selected || neighbor ? palette[2] : antipode ? palette[1] : inSubset || inPetrie ? palette[2] : basePointFill(p, palette);
  const pulse = state.softFx ? 1 + Math.sin(stylePhase * TAU) * 0.06 : 1;
  const radius = (selected ? p.size + 5 : neighbor ? p.size + 2.5 : inSubset ? p.size + 2 : antipode ? p.size + 1.5 : inPetrie ? p.size + 1 : p.size) * pulse;
  let fills = 0;
  if (!skipGlow && (inSubset || selected || neighbor || antipode || inPetrie)) {
    ctx.beginPath();
    ctx.arc(p.sx, p.sy, radius + 5, 0, TAU);
    ctx.fillStyle = selected ? paletteSet.glowSelected : neighbor ? paletteSet.glowNeighbor : antipode ? paletteSet.glowAntipode : inSubset ? paletteSet.glowSubset : paletteSet.glowPetrie;
    ctx.fill();
    fills++;
  }
  ctx.beginPath();
  ctx.arc(p.sx, p.sy, radius, 0, TAU);
  ctx.fillStyle = fill;
  ctx.globalAlpha = selected ? 1 : neighbor ? 0.96 : inSubset ? 0.92 : antipode ? 0.88 : inPetrie ? 0.9 : 0.72;
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
  if (hasRuntimeAnimation() && !document.hidden && !isSettingsOpen() && !hasActiveInput()) startMotion();
  else stopMotion();
}

function hasRuntimeAnimation() {
  return !!(state.autoRotate || state.autoModel || state.autoColor || state.softFx);
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
    if (elapsed < MOTION_FRAME_INTERVAL_MS) {
      metrics.motionFrameSkipCount++;
      metrics.lastMotionFrameSkipMs = now;
      motionRafId = requestAnimationFrame(tick);
      return;
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (state.autoRotate) state.rotation += dt * state.rotationSpeed * 0.55;
    if (state.autoModel) {
      autoModelElapsed += dt;
      metrics.autoModelFrameCount++;
      if (autoModelElapsed >= AUTO_MODEL_INTERVAL_S) {
        autoModelElapsed = 0;
        advanceAutoModel();
      }
    }
    if (state.autoColor || state.softFx) {
      stylePhase = (stylePhase + dt * (state.autoColor ? 0.72 : 0.42)) % 4096;
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
  markInteraction('pan');
  state.panX = drag.panX + dx;
  state.panY = drag.panY + dy;
  requestRender();
}

function onPointerUp(event) {
  const wasTap = drag && drag.id === event.pointerId && !drag.moved && !gesture;
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
  syncChromeFade(wasTap ? 'tap-end' : 'pan-end');
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
    markInteraction('pan-end');
    syncControls();
    saveState();
    requestSettledRenderAfterInput('pan-end');
  }
  syncMotionLoop();
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
  gesture = {
    distance: snap.distance,
    centerX: snap.centerX,
    centerY: snap.centerY,
    zoom: state.zoom,
    panX: state.panX,
    panY: state.panY,
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
  state.zoom = clamp(gesture.zoom * (snap.distance / gesture.distance), 0.55, 3.2);
  state.panX = gesture.panX + (snap.centerX - gesture.centerX);
  state.panY = gesture.panY + (snap.centerY - gesture.centerY);
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
  state.zoom = clamp(Number(value) || 1, 0.55, 3.2);
  markInteraction('zoom-control');
  saveState();
  syncControls();
  requestRender();
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
  if (state.modelMode === 'platonic' || state.modelMode === 'poly4d') {
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
  const fitted = framePointList(allRootList, interactionType, options);
  if (fitted && !options.silentStatus) showStatus('View fitted');
  return fitted;
}

function framePointList(list, interactionType, options = {}) {
  const modelBounds = pointModelBounds(list);
  if (!modelBounds) return false;
  const layout = layoutForCanvas(1);
  const view = usableViewBounds();
  const modelW = Math.max(0.001, modelBounds.maxX - modelBounds.minX);
  const modelH = Math.max(0.001, modelBounds.maxY - modelBounds.minY);
  const fitW = Math.max(120, view.right - view.left);
  const fitH = Math.max(120, view.bottom - view.top);
  const nextZoom = clamp(Math.min(fitW / (modelW * layout.baseScale), fitH / (modelH * layout.baseScale)), 0.55, 3.2);
  const nextLayout = layoutForCanvas(nextZoom);
  const targetX = (view.left + view.right) / 2;
  const targetY = (view.top + view.bottom) / 2;
  const modelCenterX = (modelBounds.minX + modelBounds.maxX) / 2;
  const modelCenterY = (modelBounds.minY + modelBounds.maxY) / 2;
  markInteraction(interactionType);
  state.zoom = nextZoom;
  state.panX = targetX - nextLayout.cx - modelCenterX * nextLayout.scale;
  state.panY = targetY - nextLayout.cy - modelCenterY * nextLayout.scale;
  syncControls();
  if (options.save !== false) saveState();
  requestRender();
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
  if (state.modelMode === 'e8_3d') {
    const v = e8ModelVector(point.idx);
    const projected = projectModelPoint(v.x, v.y, v.z, layout, 0.92);
    return {
      x: projected.x,
      y: projected.y,
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
  if (state.modelMode === 'e8_3d') {
    return '<strong>E8 3D roots</strong><small>240 roots | depth projection from the E8 vectors</small><small>Tap a root to inspect McKay, Cartan, and neighbor context.</small>';
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
    allFrame: allFrameMetrics(),
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
  renderScenePresetButtons();
  renderModelShortcuts();
  renderPaletteSwatches();
  renderSubsetChips();
  renderRootJumps();
  renderMotionSpeedPresets();
  renderFxPresets();
  renderMotionPresets();
  bindEvents();
  data = await loadData();
  installMobileCurriculum(data.curriculum);
  state.learnTopic = LEGACY_LEARN_TOPIC_MAP[state.learnTopic] || state.learnTopic;
  state = normalizeState(state);
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
    selectScenePreset,
    selectModelShortcut,
    selectFxPreset,
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
