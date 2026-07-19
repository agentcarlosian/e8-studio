// main.js — bootstrap: load data, build three.js scene, wire lil-gui panel,
// run animation loop, handle view switching.
//
// Architecture:
//   - One persistent three.js Scene + Camera + Renderer
//   - Each view is a { group, update(dt, time, params), dispose() } factory
//   - View switching = dispose current view, create new one, add to scene
//   - lil-gui controls update a shared `params` object read by views each frame

import * as THREE from 'three';

import { PALETTE_NAMES, SHIFT_PRESETS, BLEND_MODES, COLORING_NAMES, e8ColoringT, PALETTE_PRESETS, buildPalette, colorAt, palettePreviewCSS } from './ui/palettes.js';
if (typeof window !== 'undefined') {
  window.SHIFT_PRESETS = SHIFT_PRESETS;
  window.PALETTE_PRESETS = PALETTE_PRESETS;
  window.BLEND_MODES = BLEND_MODES;
}
import { saveConfig, loadConfig, clearConfig, exportConfig, importConfig, readUrlConfig, startAutoSave, applyConfig, showSavedToast } from './state/persistence.js';
import { LearningProgressService } from './state/learning-service.js';
import { ControlPanel, initPanelEvents, updateMotionStatus, focusPanelSearch, formatSliderValue, SLIDER_META, isPanelCollapsed, setPanelCollapsed } from './ui/panel.js';
import { FXRuntime } from './fx/fx-runtime.js';
import {
  FX_MODE_NAMES,
  coerceEffectMode,
  effectAvailableForView,
  effectsForView,
  rememberEffectForView,
  restoreEffectForView,
} from './fx/fx-catalog.js';
import { BGRuntime, BG_MODES } from './fx/bg-runtime.js';
import { backgroundModesForQuality, coerceBackgroundForQuality } from './ui/backgrounds.js';
import { PRESETS, applyPreset } from './state/presets.js';
import { GALLERY_PRESETS, galleryPresetById, adjacentGalleryPreset, createGalleryBaseline } from './state/gallery.js';
import { planViewTransition } from './state/view-transition.js';
import { CameraController, CAMERA_DEFAULT_DISTANCE, CAMERA_TOUCH_DEFAULT_DISTANCE } from './state/camera.js';
import { ExportRecordingService, isCapacitorNative } from './services/export-recording.js';
import { createResourceScope } from './platform/resource-scope.js';
import { FrameHealthController } from './platform/frame-health.js';
import { EssayPanel } from './ui/essays.js';
import { startTour, stopTour, isTourActive, isTourPaused, pauseTour, resumeTour } from './ui/tour.js';
import { ESSAYS, CODE_ART_SHADERS } from './content/essays.js';
import { CURIOUS_CARDS, DAILY_FACTS, REWARD_BACKGROUNDS, BIOGRAPHIES, TIMELINE, dailyFactForDate } from './content/learning.js';
import { LEARNING_PATHS, LEARNING_LESSONS, learningLessonById, adjacentLearningLesson } from './content/curriculum.js';
import { FACT_SOURCES } from './content/sources.js';
import { GLOSSARY, GLOSSARY_GROUPS, getGlossaryMatches, getGlossaryEntry } from './content/glossary.js';
import { getStellation } from './math/stellations.js';
import { findWeylWord, formatWeylWord, weylWordSteps } from './math/weyl.js';
import { deformPlatonicVert, morphActive } from './math/morph.js';
import { applyTheme, applyLayout, THEMES, LAYOUTS, DEFAULT_LAYOUT } from './ui/theme.js';
import { createE8CoxeterView } from './views/e8coxeter.view.js';
import { createPlatonicView } from './views/platonic.view.js';
import { createDynkinView } from './views/dynkin.view.js';
import { createPolytope4DView } from './views/polytope4d.view.js';
import { createSixHundredView } from './views/sixhundred.view.js';
import { createBloomView } from './views/bloom.view.js';
import { createRaymarchedView } from './views/raymarched-e8.view.js';

// Raycaster for hover tooltips
const raycaster = new THREE.Raycaster();
raycaster.params.Points = { threshold: 0.05 };  // larger hit radius for points
const mouseNDC = new THREE.Vector2(-10, -10);   // off-screen by default
let mouseX = 0, mouseY = 0;
const runtimeErrors = [];
const viewFrameHealth = new FrameHealthController({
  failureLimit: 3,
  onFailure(error, health) {
    runtimeErrors.push({
      type: 'view-update',
      view: health.viewId,
      message: error?.message || String(error),
      time: Date.now(),
    });
    if (runtimeErrors.length > 20) runtimeErrors.shift();
  },
  onTrip(error, health) {
    console.error(`[animate] suspended ${health.viewId || 'view'} after repeated update failures:`, error);
    showSavedToast('View animation paused after repeated errors');
  },
});
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    runtimeErrors.push({ type: 'error', message: e.message || String(e.error || e), time: Date.now() });
    if (runtimeErrors.length > 20) runtimeErrors.shift();
  });
  window.addEventListener('unhandledrejection', (e) => {
    runtimeErrors.push({ type: 'rejection', message: String(e.reason?.message || e.reason || 'unhandled rejection'), time: Date.now() });
    if (runtimeErrors.length > 20) runtimeErrors.shift();
  });
}

// Per-session seeded noise for deterministic-but-organic drift
// In dist build, simplex-noise's namespace export is window.__modules.simplexNoise
const simplexNoiseDefault = (typeof window !== 'undefined' && window.__modules && window.__modules.simplexNoise) || null;
const noise2D = simplexNoiseDefault ? simplexNoiseDefault.createNoise2D() : (() => ({ noise2D: () => 0 }))().noise2D;

// ---------- Data ----------
const DATA = {};
async function loadData() {
  // Try inlined data first (for file:// use), fall back to fetch (for http://)
  const trySources = async (name) => {
    if (typeof window !== 'undefined' && window.INLINE_DATA && window.INLINE_DATA[name]) {
      return window.INLINE_DATA[name];
    }
    return fetch('./data/' + name + '.json').then(r => r.json());
  };
  const [e8, e8math, platonic, polytopes4d, dynkin, mckay, mckaySubsets] = await Promise.all([
    trySources('e8'),
    trySources('e8_math'),
    trySources('platonic'),
    trySources('polytopes4d'),
    trySources('dynkin'),
    trySources('mckay'),
    trySources('mckay_subsets'),
  ]);
  DATA.e8 = e8;
  DATA.e8_math = e8math;
  DATA.platonic = platonic;
  DATA.polytopes4d = polytopes4d;
  DATA.dynkin = dynkin;
  DATA.mckay = mckay;
  DATA.mckay_subsets = mckaySubsets;
  setStatus('loaded · 240 roots · 120 600-cell verts');
}

// ---------- Status ----------
function setStatus(msg) {
  document.getElementById('status').textContent = msg;
}

// ---------- View registry ----------
const VIEWS = [
  // Primary tabs — the most visually rich views, by user preference
  { id: 'bloom',       label: 'Bloom',       factory: createBloomView,     primary: true },
  { id: 'platonic',    label: 'Platonic',    factory: createPlatonicView,  primary: true },
  { id: 'e8coxeter',   label: 'E₈ Coxeter',  factory: createE8CoxeterView, primary: true },
  { id: 'sixhundred',  label: '600-cell',    factory: createSixHundredView, primary: true },
  { id: 'polytope',    label: '4D Polytope', factory: createPolytope4DView, primary: true },
  { id: 'raymarched',  label: 'E₈ SDF',      factory: createRaymarchedView, primary: true },
  // Hidden — accessible via ?view=dynkin in URL but not in the main UI
  // Per user feedback: Dynkin's static layout isn't visually compelling enough
  // to justify a tab slot. The view still exists in code for reference.
  { id: 'dynkin',      label: 'Dynkin',      factory: createDynkinView,    primary: false, hidden: true },
];

const PLATONIC_VERTEX_COUNTS = {
  tetrahedron: 4,
  cube: 8,
  octahedron: 6,
  dodecahedron: 20,
  icosahedron: 12,
  // Round 9: Kepler–Poinsot star polyhedra (rendered in the Platonic view).
  stellated_dodecahedron: 12,
  great_dodecahedron: 12,
  great_icosahedron: 12,
  great_stellated_dodecahedron: 20,
};

const COMMAND_ITEMS = [
  { id: 'resetView', label: 'Reset current view', keywords: 'reset view camera angles pose' },
  { id: 'resetCamera', label: 'Reset camera', keywords: 'camera view orbit' },
  { id: 'bookmark1', label: 'Save camera 1', keywords: 'bookmark camera save' },
  { id: 'bookmark2', label: 'Save camera 2', keywords: 'bookmark camera save' },
  { id: 'bookmark3', label: 'Save camera 3', keywords: 'bookmark camera save' },
  { id: 'loadBookmark1', label: 'Load camera 1', keywords: 'bookmark camera load' },
  { id: 'loadBookmark2', label: 'Load camera 2', keywords: 'bookmark camera load' },
  { id: 'loadBookmark3', label: 'Load camera 3', keywords: 'bookmark camera load' },
  { id: 'diagnostics', label: 'Copy diagnostics', keywords: 'debug browser renderer params' },
  { id: 'transparentPng', label: 'Transparent PNG', keywords: 'export image alpha' },
  { id: 'hiResPng', label: 'High-res PNG', keywords: 'export image 2x' },
  { id: 'svg', label: 'SVG diagram', keywords: 'export coxeter petrie vector' },
  { id: 'obj', label: 'OBJ 3D model', keywords: 'export 3d blender unity mesh print obj wavefront' },
  { id: 'geojson', label: 'Geometry JSON', keywords: 'export data json coordinates python processing' },
  { id: 'clip', label: 'Record video clip', keywords: 'export video webm mp4 movie film' },
  { id: 'postcard', label: 'Postcard Studio', keywords: 'share social image story vertical create' },
  { id: 'dailyFact', label: 'Claim daily fact', keywords: 'learn daily streak reward' },
  { id: 'cancelClip', label: 'Cancel recording', keywords: 'export video stop' },
  { id: 'presentation', label: 'Presentation mode', keywords: 'fullscreen clean stage' },
  { id: 'teaching', label: 'Teaching mode', keywords: 'captions explain classroom' },
  { id: 'rootInspector', label: 'Root inspector', keywords: 'e8 selected root drawer' },
  { id: 'rootDiffusion', label: 'Root diffusion', keywords: 'e8 adjacency halo graph distance' },
  { id: 'weylMirrors', label: 'Weyl mirrors', keywords: 'e8 reflection chamber hyperplanes' },
  { id: 'twin600', label: 'Twin 600-cell coloring', keywords: 'h4 e8 split warm cool' },
  { id: 'projectionAuto', label: 'Projection atlas autoplay', keywords: 'e8 morph projection atlas' },
  { id: 'perf', label: 'Performance overlay', keywords: 'fps frame gpu' },
  { id: 'adaptivePixelRatio', label: 'Adaptive pixel ratio', keywords: 'performance resolution fps' },
  { id: 'cameraPath:manual', label: 'Camera path: Manual', keywords: 'cinematic camera' },
  { id: 'cameraPath:coxeterOrbit', label: 'Camera path: Coxeter orbit', keywords: 'cinematic camera' },
  { id: 'cameraPath:ringDive', label: 'Camera path: Ring dive', keywords: 'cinematic camera' },
  { id: 'cameraPath:petrieSpiral', label: 'Camera path: Petrie spiral', keywords: 'cinematic camera' },
  { id: 'cameraPath:h4Reveal', label: 'Camera path: H4 reveal', keywords: 'cinematic camera' },
  ...VIEWS.filter(v => !v.hidden).map(v => ({ id: `view:${v.id}`, label: `View: ${v.label}`, keywords: 'switch view tab' })),
  ...Array.from(GALLERY_PRESETS).map(p => ({ id: `gallery:${p.id}`, label: `Gallery: ${p.name}`, keywords: 'preset curated scene' })),
];

// ---------- Three.js ----------
let scene, camera, renderer, currentView, gui, params;
let camTarget = null;
const cameraController = new CameraController();
let fxRuntime = null; // FXRuntime instance, created in initThree()
let bgRuntime = null; // BGRuntime instance, created in initThree()
let activeViewScope = null;
const learningProgress = new LearningProgressService();
const exportRecording = new ExportRecordingService({
  toast: message => showSavedToast(message),
  onExport: () => awardExplorationBadge('explore:exporter', 'Exporter'),
});
// Tracks which primary views the user has opened this session (for the
// "Grand Tour" exploration badge). Not persisted across reloads — that's fine,
// the badge itself persists once awarded.
const visitedViews = new Set();
// Tracks how many distinct essays the user has opened this session (for the
// "Reader" exploration badge at 5 distinct essays).
const readEssays = new Set();
const perfState = {
  fps: 0,
  frameMs: 0,
  samples: [],
  sampleTotal: 0,
  lastOverlay: 0,
  lastAdjust: 0,
  targetPixelRatio: typeof window !== 'undefined' ? Math.min(window.devicePixelRatio || 1, 2) : 1,
};
let startupStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
let firstFrameMarked = false;
let firstFrameMs = null;
let firstInteractiveMs = null;
let firstView = null;
let firstRenderWatchdogTimer = null;
let webglFallbackUsed = false;
let pageHidden = false;
let renderFailureShown = false;
let projectionAutoStartedAt = 0;
let projectionAutoIndex = 0;
let shiftStartedAt = typeof performance !== 'undefined' ? performance.now() / 1000 : 0;
// Photosensitivity guard: timestamp of the last palette change driven by the
// shift cycle. The shift loop won't change palette more than once per 1.5s,
// regardless of shiftSpeed — keeps cycling below the ~3 Hz seizure threshold.
let lastPaletteShiftAt = 0;

let weylPathTimer = null;  // interval id for the Weyl-path reflection animation

let isDragging = false;  // module-scope so animate() can check it
function clampCameraDistance(value, fallback = CAMERA_DEFAULT_DISTANCE) {
  return cameraController.clampDistance(value, fallback);
}

function updateCameraFromSpherical() {
  cameraController.updateCamera(camera, camTarget, params);
}

// Resync the inertia targets + zero velocity. Call whenever the camera is moved
// programmatically (reset, bookmark load, cinematic/auto-rotate takeover) so
// that when the user next drags, the damping starts from the current pose
// instead of lerping back to a stale target.
function syncCameraTargets() {
  cameraController.syncTargets();
}

// Per-frame damping: ease the actual spherical coords toward the targets and
// apply any leftover flick velocity. Called from animate() only when no
// auto-rotate / cinematic mode is driving the camera. Returns true if it
// moved the camera this frame.
function applyCameraDamping(dt) {
  return cameraController.applyDamping(dt, camera, camTarget, params);
}

function resetCameraPose() {
  const distance = syncDesktopTouchShell() ? CAMERA_TOUCH_DEFAULT_DISTANCE : CAMERA_DEFAULT_DISTANCE;
  cameraController.reset(distance, camera, camTarget, params);
}

// View renderers share one params object, but their animation controllers are
// not interchangeable. Without a transition boundary, leaving Bloom can keep
// bloomAuto alive, leaving 4D can keep six-plane rotation alive, and a camera
// path started in E8 continues to drive every later view. That combination is
// the source of the "wig out until Reset" behaviour.
function stabilizeViewTransition(fromView, toView) {
  const transition = planViewTransition(params, fromView, toView);
  if (!transition.changed) return;
  Object.assign(params, transition.patch);
  cameraController.autoZoomFactor = 1;
  cameraController.lastPath = 'manual';

  // A cinematic path can leave the camera at an extreme angle/distance. Reset
  // only in that case; ordinary manual camera framing survives view switches.
  if (transition.resetCamera) {
    resetCameraPose();
    params.cameraDistance = cameraController.distance;
  } else {
    cameraController.distance = clampCameraDistance(params.cameraDistance, cameraController.distance);
    syncCameraTargets();
    updateCameraFromSpherical();
  }
}

function buildRuntimeContext() {
  return {
    get params() { return params; },
    get camera() { return camera; },
    get renderer() { return renderer; },
    get scene() { return scene; },
    get currentView() { return currentView; },
    raycaster,
    actions: () => window.__app,
    registerFXMaterial(material) { if (fxRuntime) fxRuntime.registerMaterial(material); },
    unregisterFXMaterial(material) { if (fxRuntime) fxRuntime.unregisterMaterial(material); },
    trackResource(resource) { return activeViewScope ? activeViewScope.track(resource) : resource; },
    setParam: (k, v, options) => updateParam(k, v, options),
    save: () => saveConfig(params),
  };
}

const MOBILE_QUALITY = {
  low: { initialDpr: 0.7, maxDpr: 0.85 },
  medium: { initialDpr: 0.9, maxDpr: 1.1 },
  high: { initialDpr: 1.1, maxDpr: 1.35 },
  auto: { initialDpr: 0.85, maxDpr: 1.0 },
};

function currentQualityProfile() {
  const key = params?.reducedMode ? 'low' : (params?.mobileQuality || 'high');
  return MOBILE_QUALITY[key] || MOBILE_QUALITY.auto;
}

function qualityDprCap() {
  const native = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
  return Math.max(0.75, Math.min(native, currentQualityProfile().maxDpr));
}

function initialPixelRatio() {
  const native = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;
  const profile = currentQualityProfile();
  return Math.max(0.75, Math.min(native, profile.initialDpr, profile.maxDpr));
}

function applyQualityProfile({ launch = false } = {}) {
  if (!params) return;
  if (!MOBILE_QUALITY[params.mobileQuality]) params.mobileQuality = 'high';
  if (params.reducedMode) {
    params.mobileQuality = 'low';
    params.fxMode = 'none';
    params.bgMode = 'void';
    params.showAmbient = false;
    params.autoRotate = false;
    params.cameraOrbit = false;
    params.cameraPath = 'manual';
  }
  params.bgMode = coerceBackgroundForQuality(params.bgMode || 'void', params.mobileQuality);
  if (renderer) {
    const next = Math.min(renderer.getPixelRatio(), qualityDprCap());
    renderer.setPixelRatio(next);
    renderer.setSize(renderer.domElement.clientWidth, renderer.domElement.clientHeight, false);
  }
  if (fxRuntime) fxRuntime.setMode(params.fxMode || 'none');
  if (bgRuntime) bgRuntime.setMode(params.bgMode || 'void');
}

function installStartupInteractionProbe() {
  const mark = () => {
    if (firstInteractiveMs == null) firstInteractiveMs = performance.now() - startupStartedAt;
  };
  window.addEventListener('pointerdown', mark, { once: true, capture: true });
  window.addEventListener('keydown', mark, { once: true, capture: true });
  window.addEventListener('input', mark, { once: true, capture: true });
}

function installFirstRenderWatchdog() {
  startupStartedAt = performance.now();
  firstFrameMarked = false;
  firstFrameMs = null;
  firstView = params?.view || null;
  document.body.classList.add('launching');
  clearTimeout(firstRenderWatchdogTimer);
  firstRenderWatchdogTimer = setTimeout(() => {
    if (!firstFrameMarked) {
      showRenderFallback(
        'Still preparing the live render',
        'This device is taking longer than expected. You can retry, or open a reduced-quality mode that keeps the studio responsive.'
      );
    }
  }, 3000);
}

function hideRenderFallback() {
  const el = document.getElementById('render-fallback');
  if (el) el.classList.add('hidden');
}

function showRenderFallback(title, detail) {
  webglFallbackUsed = true;
  renderFailureShown = true;
  let el = document.getElementById('render-fallback');
  if (!el) {
    el = document.createElement('div');
    el.id = 'render-fallback';
    el.className = 'render-fallback';
    document.body.appendChild(el);
  }
  el.classList.remove('hidden');
  el.innerHTML = `
    <div class="fallback-card" role="status" aria-live="polite">
      <div class="fallback-mark" aria-hidden="true">
        <span></span><span></span><span></span><span></span>
      </div>
      <div class="fallback-copy">
        <strong>${svgEsc(title || 'Live render unavailable')}</strong>
        <p>${svgEsc(detail || 'E8 Studio can keep exploring in reduced mode on this device.')}</p>
      </div>
      <div class="fallback-actions">
        <button data-act="retryWebGL">Retry</button>
        <button data-act="enableReducedMode">Reduced mode</button>
      </div>
    </div>
  `;
}

function markFirstFrameRendered() {
  if (firstFrameMarked) return;
  firstFrameMarked = true;
  firstFrameMs = performance.now() - startupStartedAt;
  firstView = params?.view || firstView;
  document.body.classList.remove('launching');
  clearTimeout(firstRenderWatchdogTimer);
  hideRenderFallback();
}

function installWebGLContextHandlers(canvas) {
  if (!canvas) return;
  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    if (params) {
      params.reducedMode = true;
      params.mobileQuality = 'low';
      saveConfig(params);
    }
    showRenderFallback('The live render paused', 'Android reclaimed the graphics context. Reduced mode is ready, or retry after a reload.');
  });
  canvas.addEventListener('webglcontextrestored', () => {
    showSavedToast('Graphics context restored');
    location.reload();
  });
}

function installVisibilityHandlers() {
  if (typeof document === 'undefined') return;
  document.addEventListener('visibilitychange', () => {
    pageHidden = document.visibilityState === 'hidden';
    if (!pageHidden) {
      lastT = performance.now();
      requestAnimationFrame(() => {
        if (!renderer || !camera) return;
        const canvas = renderer.domElement;
        renderer.setSize(canvas.clientWidth, canvas.clientHeight, false);
        camera.aspect = Math.max(1, canvas.clientWidth) / Math.max(1, canvas.clientHeight);
        camera.updateProjectionMatrix();
        try { renderer.render(scene, camera); } catch {}
      });
    }
  });
}

function isSmallTouchScreen() {
  if (typeof window === 'undefined') return false;
  if (isCapacitorNative()) return false;
  const hasTouch = (navigator.maxTouchPoints || 0) > 0;
  const visualWidth = window.visualViewport?.width || window.outerWidth || window.innerWidth || 0;
  const screenWidth = window.screen?.width || visualWidth;
  return hasTouch && Math.min(visualWidth || Infinity, screenWidth || Infinity) <= 760;
}

function setDesktopTouchViewportMeta(enabled) {
  if (typeof document === 'undefined') return;
  const viewport = document.querySelector('meta[name="viewport"]');
  if (!viewport) return;
  if (!viewport.dataset.desktopContent) {
    viewport.dataset.desktopContent = viewport.getAttribute('content') || '';
  }
  const content = enabled
    ? ['width=', 'device-width, initial-scale=1.0, viewport-fit=cover'].join('')
    : viewport.dataset.desktopContent;
  if (viewport.getAttribute('content') !== content) {
    viewport.setAttribute('content', content);
  }
}

function setDesktopTouchViewportVars(enabled) {
  if (typeof document === 'undefined') return;
  const body = document.body;
  if (!body) return;
  if (!enabled) {
    body.style.removeProperty('--desktop-touch-vw');
    body.style.removeProperty('--desktop-touch-vh');
    return;
  }
  const viewport = window.visualViewport;
  const candidates = [
    viewport?.width,
    window.screen?.width,
    window.outerWidth,
    window.innerWidth,
  ].filter((value) => Number.isFinite(value) && value > 0);
  const heightCandidates = [
    viewport?.height,
    window.innerHeight,
    window.screen?.height,
  ].filter((value) => Number.isFinite(value) && value > 0);
  const width = Math.round(Math.max(320, Math.min(...candidates, 760)));
  const height = Math.round(Math.max(480, Math.min(...heightCandidates, 1200)));
  body.style.setProperty('--desktop-touch-vw', `${width}px`);
  body.style.setProperty('--desktop-touch-vh', `${height}px`);
}

function syncDesktopTouchShell() {
  if (typeof document === 'undefined') return false;
  const body = document.body;
  if (!body) return false;
  const enabled = isSmallTouchScreen();
  setDesktopTouchViewportMeta(enabled);
  body.classList.toggle('desktop-touch-shell', enabled);
  setDesktopTouchViewportVars(enabled);
  return enabled;
}

function installDesktopControlsDrawer() {
  if (typeof document === 'undefined') return;
  const body = document.body;
  if (!body) return;

  let toggle = document.getElementById('desktop-controls-toggle');
  if (!toggle) {
    toggle = document.createElement('button');
    toggle.id = 'desktop-controls-toggle';
    toggle.className = 'desktop-controls-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-controls', 'panel');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Open controls');
    toggle.title = 'Controls';
    toggle.textContent = '';
    document.body.appendChild(toggle);
  }

  let close = document.getElementById('desktop-controls-close');
  if (!close) {
    close = document.createElement('button');
    close.id = 'desktop-controls-close';
    close.className = 'desktop-controls-close';
    close.type = 'button';
    close.setAttribute('aria-controls', 'panel');
    close.setAttribute('aria-label', 'Close controls');
    close.title = 'Close';
    close.textContent = '';
    document.body.appendChild(close);
  }

  let backdrop = document.getElementById('desktop-controls-backdrop');
  if (!backdrop) {
    backdrop = document.createElement('button');
    backdrop.id = 'desktop-controls-backdrop';
    backdrop.className = 'desktop-controls-backdrop';
    backdrop.type = 'button';
    backdrop.setAttribute('aria-label', 'Close controls');
    document.body.appendChild(backdrop);
  }

  const setOpen = (open) => {
    body.classList.toggle('desktop-controls-open', !!open);
    toggle.setAttribute('aria-expanded', String(!!open));
    close.setAttribute('aria-expanded', String(!!open));
  };

  const sync = () => {
    const enabled = syncDesktopTouchShell();
    if (!enabled) setOpen(false);
  };

  toggle.addEventListener('click', () => setOpen(true));
  close.addEventListener('click', () => setOpen(false));
  backdrop.addEventListener('click', () => setOpen(false));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && body.classList.contains('desktop-controls-open')) {
      setOpen(false);
    }
  });
  window.addEventListener('resize', sync);
  window.visualViewport?.addEventListener('resize', sync);
  window.visualViewport?.addEventListener('scroll', sync);
  sync();
  requestAnimationFrame(sync);
  setTimeout(sync, 250);
}

function initThree() {
  const canvas = document.getElementById('canvas');
  // Make canvas fill its parent (the <main> grid cell)
  canvas.style.width = '100%';
  canvas.style.display = 'block';
  const w = canvas.clientWidth || canvas.parentElement.clientWidth;
  const h = canvas.clientHeight || canvas.parentElement.clientHeight;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07070c);
  // NOTE: scene.fog intentionally omitted — three.js r170's renderer calls
  // fog.color.getRGB() which was removed from Color in r163, causing a runtime
  // error every frame. Depth-fade FX is handled in the shader (uFXMode == 8)
  // instead, which works without the scene.fog API.

  camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 100);
  camera.position.set(0, 0, 6);

  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'default',
    // alpha: false (was true). The renderer was created with alpha enabled,
    // which left transparent regions that could show through to page chrome
    // instead of the scene.background color. Bug found 2026-06-25:
    // user reported white canvas background even though scene.background
    // was set correctly. Disabling alpha forces the renderer to always
    // composite opaque, so scene.background fills every pixel.
    alpha: false,
    preserveDrawingBuffer: true,
  });
  // Bug fix 2026-06-25: explicitly set clearColor so the GL clear matches
  // the scene background. Without this, three.js sometimes leaves the clear
  // at default (black) but the rendering pipeline might still produce a
  // white framebuffer in some pipelines.
  renderer.setClearColor(new THREE.Color(0x07070c), 1.0);
  renderer.setSize(w, h, false);  // buffer size only
  renderer.setPixelRatio(initialPixelRatio());
  installWebGLContextHandlers(canvas);

  // Lighting setup — three layers for richer depth
  const ambient = new THREE.AmbientLight(0xffffff, 0.55);
  scene.add(ambient);
  // Key light: warm directional from upper-front-right
  const keyLight = new THREE.DirectionalLight(0xffe6c2, 1.2);
  keyLight.position.set(3, 4, 5);
  scene.add(keyLight);
  // Fill light: cool from lower-back-left (rim light)
  const fillLight = new THREE.DirectionalLight(0x88aaff, 0.6);
  fillLight.position.set(-4, -2, -3);
  scene.add(fillLight);
  // Top accent: pink/violet point light
  const accentLight = new THREE.PointLight(0xff77cc, 1.0, 20);
  accentLight.position.set(0, 4, 2);
  scene.add(accentLight);

  // ── Starfield background (idea #36) ──
  // Procedurally generated stars on a large sphere, very low intensity so
  // they sit behind any 3D content. Uses a simple custom shader for the
  // twinkle effect. Disabled by default — toggled via params.showStarfield.
  const starGroup = new THREE.Group();
  starGroup.name = 'starfield';
  const starCount = 800;
  const starPositions = new Float32Array(starCount * 3);
  const starSizes = new Float32Array(starCount);
  const starPhases = new Float32Array(starCount);
  // Use a seeded PRNG (mulberry32) so the stars are deterministic per session
  let starSeed = 0xC0FFEE;
  function sRand() {
    starSeed |= 0; starSeed = (starSeed + 0x6D2B79F5) | 0;
    let t = Math.imul(starSeed ^ starSeed >>> 15, 1 | starSeed);
    t = (t + Math.imul(t ^ t >>> 7, 61 | t)) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  for (let i = 0; i < starCount; i++) {
    // Uniform on a sphere of radius 40 (far behind everything)
    const u = sRand();
    const v = sRand();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = 38 + sRand() * 4;  // 38-42
    starPositions[i*3]     = r * Math.sin(phi) * Math.cos(theta);
    starPositions[i*3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    starPositions[i*3 + 2] = r * Math.cos(phi);
    // Most stars dim, a few bright; sizes log-distributed
    const s = sRand();
    starSizes[i] = 0.04 + (s * s) * 0.5;  // 0.04..0.54, biased to small
    starPhases[i] = sRand() * Math.PI * 2;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
  starGeo.setAttribute('size', new THREE.BufferAttribute(starSizes, 1));
  starGeo.setAttribute('phase', new THREE.BufferAttribute(starPhases, 1));
  const starMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: window.devicePixelRatio || 1 },
    },
    vertexShader: `
      attribute float size;
      attribute float phase;
      uniform float uTime;
      uniform float uPixelRatio;
      varying float vBrightness;
      void main() {
        // Twinkle: sine modulation per-star
        float tw = 0.6 + 0.4 * sin(uTime * 1.5 + phase);
        vBrightness = tw;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = size * uPixelRatio * (300.0 / -mv.z);
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      varying float vBrightness;
      void main() {
        vec2 c = gl_PointCoord - vec2(0.5);
        float d = length(c);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vec3(0.85, 0.9, 1.0) * vBrightness, a * 0.7);
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: false,
  });
  const stars = new THREE.Points(starGeo, starMat);
  stars.renderOrder = -1000;  // behind everything
  stars.frustumCulled = false;
  starGroup.add(stars);
  starGroup.visible = false;  // off by default
  scene.add(starGroup);

  // Update the star uTime every frame (cheaper than rebuilding)
  // Note: defined as a module-level function below so animate() can call it
  // (initThree and animate are separate function scopes).

  // Toggle from outside (used by panel + the toggleStarfield action)
  function setStarfieldVisible(v) { starGroup.visible = !!v; }
  // Expose the star uniform + group to the module-scope updateStarfield()
  _starMatUniformTime = starMat.uniforms.uTime;
  _starGroup = starGroup;

  // Store so we can update intensity from params
  scene.userData.lights = { ambient, keyLight, fillLight, accentLight };



  // Initialize centralized FX runtime — pushes FX uniforms to all shader materials
  fxRuntime = new FXRuntime(scene);
  fxRuntime.setMode(params.fxMode || 'none');
  fxRuntime.setIntensity(params.fxIntensity ?? 0.5);

  // Background runtime: full-screen quad with 8 shader moods.
  // Replaces the legacy `scene.background = Color` + optional starfield group.
  bgRuntime = new BGRuntime(scene, camera);
  bgRuntime.setMode(params.bgMode || 'void');
  bgRuntime.setIntensity(params.bgIntensity ?? 0.7);
  // Note: bg-runtime.setMode handles scene.background itself per mode.
  // For 'void' mode it preserves the palette-driven scene.background;
  // for shader moods it sets scene.background = null so the quad shows through.
  // Legacy starfield (if ever enabled) is now redundant — bgMode === 'starfield'
  // replaces it.
  if (starGroup) starGroup.visible = false;
  // Apply persisted theme + layout immediately on boot, before panel renders.
  applyTheme(params.theme || 'dark-gold');
  applyLayout(params.layout);

  // Simple mouse-orbit controls
  let isDraggingLocal = false;  // shadow of module-scope isDragging
  let lastX = 0, lastY = 0;
  // Start looking down -Z (standard front view), so phi=π/2, theta=0
  // (cameraController.theta, cameraController.phi, cameraController.distance are module-scope — declared above)
  camTarget = new THREE.Vector3(0, 0, 0);

  updateCameraFromSpherical();

  // Multi-touch support: track active pointers and compute pinch distance
  const activePointers = new Map(); // pointerId -> {x, y}
  // Track the down position so a quick tap (no drag) can be detected as a
  // click on the 3D scene rather than a camera-orbit drag.
  const downAt = new Map(); // pointerId -> {x, y, t}

  canvas.addEventListener('pointerdown', (e) => {
    isDragging = true;
    isDraggingLocal = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    downAt.set(e.pointerId, { x: e.clientX, y: e.clientY, t: performance.now() });
    // If we now have 2+ pointers, switch to pinch mode
    if (activePointers.size >= 2) {
      isDragging = false;
      isDraggingLocal = false;
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!activePointers.has(e.pointerId)) return;
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size >= 2) {
      // Pinch zoom: compute distance change between two pointers
      const pts = Array.from(activePointers.values());
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy);
      // Use the first move event to set baseline
      if (canvas._pinchBase == null) {
        canvas._pinchBase = dist;
        canvas._pinchCamBase = cameraController.distanceTarget;
        return;
      }
      const ratio = canvas._pinchBase / dist;
      cameraController.distanceTarget = clampCameraDistance(canvas._pinchCamBase * ratio);
      params.cameraDistance = cameraController.distanceTarget;
      return;
    }

    if (!isDraggingLocal) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    // Update inertia targets (the animate loop lerps the actual values toward
    // these) and track velocity so a released drag keeps spinning briefly.
    cameraController.thetaTarget -= dx * 0.005;
    cameraController.phiTarget  -= dy * 0.005;
    cameraController.phiTarget = Math.max(-Math.PI/2 + 0.01, Math.min(Math.PI/2 - 0.01, cameraController.phiTarget));
    // Velocity = the delta per frame (used for flick on release). Scale by dt
    // is handled in applyCameraDamping; here we just store the raw per-move delta.
    cameraController.thetaVelocity = -dx * 0.005 * 60;  // approx rad/sec at 60fps
    cameraController.phiVelocity  = -dy * 0.005 * 60;
  });
  canvas.addEventListener('pointerup', (e) => {
    isDragging = false;
    isDraggingLocal = false;
    activePointers.delete(e.pointerId);
    canvas._pinchBase = null;
    if (canvas.hasPointerCapture && canvas.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId);
    }
    // Click detection: if the pointer barely moved and was held briefly,
    // treat as a click on the 3D scene (not a drag). Single-pointer only.
    const down = downAt.get(e.pointerId);
    downAt.delete(e.pointerId);
    if (!down) return;
    if (activePointers.size > 0) return;  // multi-touch, not a click
    const dx = e.clientX - down.x;
    const dy = e.clientY - down.y;
    const dist = Math.hypot(dx, dy);
    const heldMs = performance.now() - down.t;
    if (dist < 6 && heldMs < 500) {
      // Compute the NDC and forward to current view
      const rect = canvas.getBoundingClientRect();
      const ndcX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ndcY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      if (currentView && typeof currentView.onClick === 'function') {
        currentView.onClick(ndcX, ndcY, e);
      }
    }
  });
  canvas.addEventListener('pointerleave', (e) => {
    isDragging = false;
    isDraggingLocal = false;
    if (e && e.pointerId != null) activePointers.delete(e.pointerId);
    canvas._pinchBase = null;
  });
  canvas.addEventListener('pointercancel', (e) => {
    isDragging = false;
    isDraggingLocal = false;
    if (e && e.pointerId != null) activePointers.delete(e.pointerId);
    canvas._pinchBase = null;
  });
  canvas.addEventListener('pointermove', (e) => {
    if (isDraggingLocal) return;  // don't update mouse pos during drag
    const rect = canvas.getBoundingClientRect();
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    mouseNDC.x = (mouseX / rect.width) * 2 - 1;
    mouseNDC.y = -((mouseY / rect.height) * 2 - 1);
  });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    cameraController.distanceTarget = clampCameraDistance(cameraController.distanceTarget * (1 + e.deltaY * 0.001));
    params.cameraDistance = cameraController.distanceTarget;
  }, { passive: false });

  // Resize handler
  const onResize = () => {
    const w = canvas.clientWidth || canvas.parentElement.clientWidth;
    const h = canvas.clientHeight || canvas.parentElement.clientHeight;
    if (w > 0 && h > 0) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    }
  };
  window.addEventListener('resize', onResize);
  // Bug fix 2026-06-25: canvas was sometimes rendered at 1000×500 instead of
  // the full available height (~712). The single requestAnimationFrame was
  // firing before CSS grid layout fully settled. Now we (a) call onResize on
  // the next frame AND (b) use a ResizeObserver to catch any later layout
  // changes (font load, theme switch toggling chrome height, etc.).
  requestAnimationFrame(onResize);
  setTimeout(onResize, 100);
  setTimeout(onResize, 500);  // catch late font/layout shifts
  if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
    const ro = new ResizeObserver(onResize);
    ro.observe(canvas.parentElement);
  }
}

// ---------- View router ----------
function switchView(id) {
  // Any user-initiated view switch cancels the intro animation
  params.intro = false;
  const previousView = params.view;
  // FX implementations are renderer-specific. Remember the outgoing choice so
  // SDF can keep Glow while a point view independently keeps (for example)
  // Plasma, without carrying a dead mode across the view boundary.
  rememberEffectForView(params, previousView);
  stabilizeViewTransition(previousView, id);
  // Tear down current view
  if (currentView) {
    try {
      scene.remove(currentView.object3d);
      currentView.dispose();
      if (activeViewScope) activeViewScope.dispose();
    } catch (e) {
      console.warn('[switchView] dispose error:', e);
    }
    currentView = null;
    activeViewScope = null;
  }
  // Find factory
  const def = VIEWS.find(v => v.id === id);
  if (!def || !def.factory) {
    console.warn('View not yet implemented:', id);
    return;
  }
  // Update params
  params.view = id;
  restoreEffectForView(params, id);
  if (fxRuntime) fxRuntime.setMode(params.fxMode);

  // Track exploration: award the "Grand Tour" badge once all 6 primary views
  // have been visited. (Idempotent — recordExplorationBadge no-ops if held.)
  if (def.primary) {
    visitedViews.add(id);
    if (visitedViews.size >= VIEWS.filter(v => v.primary).length) {
      awardExplorationBadge('explore:all-views', 'Grand Tour');
    }
  }

  // Set background to current palette's bg — but only if bgMode is 'void'.
  // For shader bg modes (starfield/milkyway/etc.), bg-quad handles the canvas
  // and scene.background must stay null. (Bug fix 2026-06-25.)
  const pal = buildPalette(params.palette);
  if (params.bgMode === 'void' || !params.bgMode) {
    scene.background = new THREE.Color(pal.bg);
  }
  if (bgRuntime && bgRuntime.mode !== 'void') {
    bgRuntime.scene.background = null;
  }

  // Build new view. baseScale = world-space radius for the largest ring.
  // With camera at z=6 and FOV=45°, the visible half-height at z=0 is ~2.5 units,
  // so 1.6 leaves comfortable margin.
  const baseScale = 1.6;

  // Different views need different data + scale
  // Spread DATA so all fields are visible to views that reach for DATA.X directly
  const data = { ...DATA, e8: DATA.e8, e8_math: DATA.e8_math, platonic: DATA.platonic, polytopes4d: DATA.polytopes4d, dynkin: DATA.dynkin, mckay: DATA.mckay, mckay_subsets: DATA.mckay_subsets };

  activeViewScope = createResourceScope({
    onDisposeError: error => console.warn('[resource-scope] dispose error:', error),
  });
  currentView = def.factory({
    data,
    palette: params.palette,
    scale: baseScale,
    context: buildRuntimeContext(),
  });
  viewFrameHealth.reset(id);
  scene.add(currentView.object3d);
  // rescan() (not collectFromObject) so the OLD view's materials are dropped —
  // otherwise fxRuntime.fxMaterials leaks one view's worth of dead materials per
  // switch (and per palette shift, which rebuilds the view).
  if (fxRuntime) fxRuntime.rescan();

  // Update tabs (both primary tab strip and secondary "More" menu items)
  for (const t of document.querySelectorAll('.tab, .more-item')) {
    t.classList.toggle('active', t.dataset.view === id);
  }
  refreshPanel();
  updateOverlays(id);
  if (window.essayPanel) window.essayPanel.setView(id);
}

function updateOverlays(viewId) {
  const tl = document.getElementById('ov-tl');
  const tr = document.getElementById('ov-tr');
  const bl = document.getElementById('ov-bl');
  const br = document.getElementById('ov-br');

  // Count only visible views so the "view N / M" badge matches the tab strip
  // (Dynkin is hidden/URL-only and must not inflate the total).
  const visibleViews = VIEWS.filter(v => !v.hidden);
  const idx = visibleViews.findIndex(v => v.id === viewId);

  if (viewId === 'platonic') {
    // Round 9: stellations aren't in DATA.platonic / DATA.mckay, so guard for
    // them and show a star-polyhedron overlay instead of crashing on undefined.
    const isStellation = params.shape.startsWith('stellated_') || params.shape.startsWith('great_');
    if (isStellation) {
      const vcount = PLATONIC_VERTEX_COUNTS[params.shape] || 12;
      tl.innerHTML = `<b>${params.shape.toUpperCase()}</b><br>${vcount} verts · 30 edges · Kepler–Poinsot`;
      tr.innerHTML = `★ star polyhedron<br>H₃ symmetry (120)`;
      bl.innerHTML = `drag = rotate<br>scroll = zoom`;
      br.innerHTML = `view ${idx + 1} / ${visibleViews.length}<br>★ regular star solid`;
    } else {
      const s = DATA.platonic[params.shape];
      const m = DATA.mckay[params.shape];
      tl.innerHTML = `<b>${params.shape.toUpperCase()}</b><br>${s.verts.length} verts · ${s.edges.length} edges`;
      tr.innerHTML = `McKay → <b>${m.roots}</b><br>symmetry ${m.symmetry}`;
      bl.innerHTML = `drag = rotate<br>scroll = zoom`;
      br.innerHTML = `view ${idx + 1} / ${visibleViews.length}<br>→ <b>${m.roots}</b>`;
    }
  } else if (viewId === 'dynkin') {
    const d = DATA.dynkin[params.dynkin];
    tl.innerHTML = `<b>${d.name} Dynkin</b><br>${d.nodes.length} nodes · ${d.edges.length} edges`;
    tr.innerHTML = `From: <b>${params.shape}</b>`;
    bl.innerHTML = `Node size = degree`;
    br.innerHTML = `view ${idx + 1} / ${visibleViews.length}<br>root system: <b>${params.dynkin}</b>`;
  } else if (viewId === 'polytope') {
    const p = DATA.polytopes4d[params.poly4d];
    tl.innerHTML = `<b>${params.poly4d.toUpperCase()}</b><br>${p.verts.length} verts · ${p.edges.length} edges`;
    tr.innerHTML = `w-depth = ${params.morph4d.toFixed(2)}<br>4D perspective`;
    bl.innerHTML = `2-axis 4D rotation<br>w-slider = depth`;
    br.innerHTML = `view ${idx + 1} / ${visibleViews.length}<br>4D polytope: <b>${params.poly4d}</b>`;
  } else if (viewId === 'sixhundred') {
    const c = DATA.polytopes4d['600cell'];
    tl.innerHTML = `<b>600-CELL</b><br>120 verts · 720 edges`;
    tr.innerHTML = `9 conjugacy classes<br>1+12+20+12+30+12+20+12+1`;
    bl.innerHTML = `binary icosahedral group<br>= icosa symmetry doubled`;
    br.innerHTML = `view ${idx + 1} / ${visibleViews.length}<br>binary icosahedral Γ`;
  } else if (viewId === 'e8coxeter') {
    const shapeName = params.shape;
    const subsetSize = DATA.mckay_subsets?.[shapeName]?.length || 0;
    const subsetDesc = subsetSize > 0
      ? `${subsetSize} highlighted (${shapeName} symmetry)`
      : `${PLATONIC_VERTEX_COUNTS[shapeName] || 12} highlighted (innermost rings)`;
    tl.innerHTML = `<b>E8 ROOT SYSTEM</b><br>240 roots · Coxeter plane`;
    tr.innerHTML = `8 rings · 30 roots each<br><b>${subsetDesc}</b>`;
    bl.innerHTML = `drag = rotate plane<br>scroll = zoom`;
    br.innerHTML = `view ${idx + 1} / ${visibleViews.length}<br>root system: <b>E₈</b>`;
  } else if (viewId === 'bloom') {
    const t = params.bloomAmount;
    const phase = t < 0.10 ? 'shape' : t < 0.50 ? '600-cell-inspired' : t < 0.75 ? 'two H₄ visual layers' : 'E8 Coxeter plane';
    tl.innerHTML = `<b>BLOOM</b><br>${params.shape} → E8`;
    tr.innerHTML = `t = ${t.toFixed(3)}<br>phase: ${phase}`;
    bl.innerHTML = `slider = time<br>auto = play continuously`;
    br.innerHTML = `view ${idx + 1} / ${visibleViews.length}<br>→ <b>E₈</b>`;
  } else if (viewId === 'raymarched') {
    tl.innerHTML = `<b>E₈ SDF</b><br>240 spheres raymarched`;
    tr.innerHTML = `soft shadows + AO<br>fresnel rim lighting`;
    bl.innerHTML = `drag = orbit camera<br>scroll = zoom`;
    br.innerHTML = `view ${idx + 1} / ${visibleViews.length}<br>liquid-metal E₈`;
  }
}

// ---------- Tabs ----------
function buildTabs() {
  const host = document.getElementById('tabs');
  if (!host) return;
  host.innerHTML = '';
  // Primary tabs: full buttons in the main strip (visible)
  const visibleViews = VIEWS.filter(v => !v.hidden);
  const primary = visibleViews.filter(v => v.primary !== false);
  const secondary = visibleViews.filter(v => v.primary === false);
  for (const v of primary) {
    const btn = document.createElement('button');
    btn.className = 'tab';
    btn.textContent = v.label;
    btn.dataset.view = v.id;
    btn.setAttribute('aria-label', `Switch to ${v.label} view`);
    btn.onclick = () => switchView(v.id);
    host.appendChild(btn);
  }
  // Secondary tabs: tucked into a "More ▾" dropdown to keep them out of the way
  if (secondary.length > 0) {
    const moreBtn = document.createElement('button');
    moreBtn.className = 'tab tab-more';
    moreBtn.textContent = 'More ▾';
    const menu = document.createElement('div');
    menu.className = 'more-menu hidden';
    for (const v of secondary) {
      const item = document.createElement('button');
      item.className = 'more-item';
      item.textContent = v.label;
      item.dataset.view = v.id;
      item.setAttribute('aria-label', `Switch to ${v.label} view`);
      item.onclick = () => { switchView(v.id); menu.classList.add('hidden'); };
      menu.appendChild(item);
    }
    moreBtn.onclick = (e) => {
      e.stopPropagation();
      menu.classList.toggle('hidden');
    };
    document.body.addEventListener('click', () => menu.classList.add('hidden'));
    host.appendChild(moreBtn);
    moreBtn.appendChild(menu);
  }
}

// ---------- Side panel ----------
// ---------- Panel (delegated to ControlPanel in ui/panel.js) ----------
let panel; // ControlPanel instance, set in main()
function buildPanel() {
  if (!panel) {
    panel = new ControlPanel(
      document.getElementById('panel'),
      document.getElementById('status'),
      { params, data: DATA, onAction: () => {} }
    );
    initPanelEvents(panel);
  } else {
    panel.setParams(params);
  }
}
function refreshPanel() {
  if (!panel) {
    buildPanel();
    return;
  }
  panel.setParams(params);
}

// ---------- Params (shared between views + GUI) ----------
function defaultParams() {
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return {
    view: 'e8coxeter',
    shape: 'icosahedron',
    poly4d: '24cell',
    dynkin: 'E8',
    palette: 'gold',
    opacity: 0.9,
    rotationSpeed: 0.003,
    // Bug fix 2026-06-25 (audit issue #1): was !prefersReducedMotion
    // (default true). Combined with e8AutoRotate and polyAutoRotate, the
    // page launched with three independent auto-rotation systems spinning.
    // Now all default to false — motion is opt-in via the toggles.
    autoRotate: false,
    cameraOrbit: false,
    bloomAmount: 0,
    bloomAuto: false,
    bloomSpeed: 0.05,
    // Bug fix 2026-06-25 (round 8 dead-code audit): removed pointSize,
    // lineWeight, showFaces, showVertices — declared in defaults but never
    // read by any view (only persisted, taking up localStorage space).
    // Legacy configs with these keys still load cleanly: loadConfig
    // filters by PERSISTABLE, so missing defaults just don't appear.
    showEdges: false,
    showRings: true,
    showPetrie: false,       // toggle real Hamiltonian 30-cycle (Petrie polygon)
    showAmbient: true,    // ambient simplex-noise drift on camera
    // Bug fix 2026-06-25 (audit #16): removed fogDensity — declared but
    // never read since FX mode 8 ('fog') uses shader-based depth fade via
    // vWorldPos instead of three.js scene.fog. Dead param.
    fxMode: 'none',       // active view's effect; capability-checked by fx-catalog
    fxByView: {},         // remembers one compatible effect choice per renderer
    fxIntensity: 0.5,     // 0-1, controls how strong the FX is
    advancedStyle: false, // keeps the default panel curated and approachable
    panelMode: 'create',  // focused creative controls; learning has its own workspace
    // Lighting controls (rebuilt when these change)
    lightAmbient: 0.55,
    lightKey: 1.2,
    lightFill: 0.6,
    lightAccent: 1.0,
    // Camera movement modes
    cameraMode: 'orbit',  // 'orbit' | 'spiral' | 'figure8' | 'pullback'
    cameraPath: 'manual', // 'manual' | named cinematic camera paths
    cameraSpeed: 1.0,     // multiplier on automatic camera motion
    cameraDistance: CAMERA_DEFAULT_DISTANCE,
    cameraRotation: Math.PI / 6,
    autoZoom: false,      // gentle in/out zoom
    blendMode: 'spectrum', // internal palette-mixing pattern (sampler)
    colorBy: 'shell',      // E8-native coloring: shell|radius|phase|axis|index|mono
    autoSliders: [],       // param keys whose sliders auto-oscillate (per-slider ⟳)
    shapeTwist: 0,         // platonic morph: helical twist about Y by height
    shapeSpike: 0,         // platonic morph: radial spike / stellation amount
    shapeJitter: 0,        // platonic morph: deterministic vertex roughening
    shiftMode: 'static',  // keys from SHIFT_PRESETS
    shiftSpeed: 12,        // seconds per full cycle through the preset
    // Bug fix 2026-06-25 (audit issue #3): was 1.2 — polytope view loaded
    // mid-morph instead of at the canonical shape position. Now 0.
    morph4d: 0,
    polyRotXY: 0,         // user-controlled 4D rotation in XY plane
    polyRotZW: 0,         // user-controlled 4D rotation in ZW plane
    // Round 9: two extra 4D rotation planes for richer polytope manipulation.
    polyRotXZ: 0,         // user-controlled 4D rotation in XZ plane
    polyRotYW: 0,         // user-controlled 4D rotation in YW plane
    // Round 10: complete all 6 rotation planes of ℝ⁴.
    polyRotXW: 0,         // user-controlled 4D rotation in XW plane
    polyRotYZ: 0,         // user-controlled 4D rotation in YZ plane
    // Bug fix 2026-06-25 (audit issue #1): was true. Polytope was spinning on
    // load, joining autoRotate + e8AutoRotate = 3 simultaneous auto-spinners.
    polyAutoRotate: false,
    polyRotationSpeed: 0.18,
    seed: 7,
    paused: false,
    intro: !prefersReducedMotion,
    // SDF rendering controls (Step 2)
    sdfSphereR: 0.08,         // sphere radius (multiplied by baseScale)
    sdfBlend: 0.03,           // smin blend k
    sdfBloom: 0.5,            // bloom post-pass strength
    sdfAniso: 0.6,            // anisotropic specular
    sdfEdges: 0.3,            // edge cylinder highlight
    // E8 view controls
    e8ViewMode: 'coxeter', // 'coxeter' (2D) | 'ortho3d' (R^8 first 3 axes) | 'custom' (user angles)
    // Bug fix 2026-06-25 (audit issue #2): was 0.3/0.5/0.7 — non-zero defaults
    // meant the E8 Coxeter view loaded pre-rotated instead of in the canonical
    // plane position. New users couldn't find the iconic ring pattern on load.
    e8Spin: 0,           // user-controlled rotation around axis (0,1)
    e8Tilt: 0,           // user-controlled rotation around axis (2,3)
    e8Roll: 0,           // user-controlled rotation around axis (4,5)
    e8AutoRotate: false, // audit #1: was true — defaulted to spinning. Now off.
    e8MorphT: 0,           // 0 = flat Coxeter plane, 1 = extruded 3D (rings at depth)
    e8Twin600: false,      // color E8 as two interlaced H4 / 600-cell halves
    e8ProjectionAuto: false,
    weylOrbit: false,      // animate a Weyl orbit trail
    weylOrbitFast: false,  // 4 steps/frame instead of 2
    weylSeed: [1, -1, 0, 0, 0, 0, 0, 0],  // 8D seed root for the orbit
    showWeylMirrors: false,
    rootDiffusion: false,
    rootHaloDepth: 3,
    rootDiffusionSpeed: 1.25,
    cartanHighlight: false, // when on, click a simple root to highlight its 56 neighbors
    showStarfield: false,   // legacy — now driven by bgMode === 'starfield'
    bgMode: 'void',         // background mood: void|starfield|milkyway|cosmos|aurora|mandala|grid|plasma
    bgIntensity: 0.7,       // 0..1.5 multiplier for background shader brightness
    theme: 'dark-gold',      // CSS-variable palette: dark-gold|paper-ink|neon-cyber|pure-dark|solarized
    layout: 'wide-canvas',   // layout mode: wide-canvas (default)|compact|presentation. 'default' is remapped to wide-canvas by applyLayout().
    // Mandelbox fold (Bloom view only) — turns the 240-point E₈ bloom into a
    // fractal-folded attractor. Classical parameters: scale=φ²≈2.618, 6 iters.
    bloomMandelbox: false,
    bloomMandelboxScale: 2.618,
    bloomMandelboxIters: 6,
    bloomMandelboxMix: 0.65,
    h4TwinReveal: true,
    // Interaction layer (Step 3)
    pickedRoot: null,         // root index of last click (null = nothing picked)
    pickedRootPrev: null,     // for Cartan entry between two clicks
    hoveredRoot: null,        // root index under cursor
    cartanEntry: null,        // {from, to, innerProduct, relation}
    // Bug fix 2026-06-25 (audit #16): removed rendererType — was 'webgl'
    // default with no WebGPU implementation. The renderer is always WebGL.
    cameraBookmarks: {},
    compareShape: 'dodecahedron',
    compareMode: 'off',
    // Bug fix 2026-06-25 (audit issue #24): was true. The Cartan matrix
    // inspector is a power-user feature; defaulting to on meant every new
    // user saw an unfamiliar panel on first load. Now opt-in.
    showInspector: false,
    showPerf: false,
    adaptivePixelRatio: true,
    mobileQuality: 'high',
    reducedMode: false,
    firstVisualMode: 'standard',
    activeUnlock: '',
    galleryPreset: '',
    presentationMode: false,
    teachingMode: false,
  };
}

function clampNumber(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

// Enum allow-lists for normalizeParams, built once and cached. This used to be
// rebuilt on EVERY param change — including ~60/s during a slider drag — which
// meant constructing 14 Sets per call for nothing. Lazy-built on first call (by
// then DATA is loaded, so polyIds resolves correctly).
let _paramEnums = null;
function paramEnums() {
  if (_paramEnums) return _paramEnums;
  _paramEnums = {
    view: new Set(VIEWS.map(v => v.id)),
    shape: new Set(['tetrahedron', 'cube', 'octahedron', 'dodecahedron', 'icosahedron',
      // Round 9: Kepler–Poinsot star polyhedra (see math/stellations.js).
      'stellated_dodecahedron', 'great_dodecahedron', 'great_icosahedron', 'great_stellated_dodecahedron']),
    poly: new Set(DATA.polytopes4d ? Object.keys(DATA.polytopes4d) : ['5cell', 'tesseract', '16cell', '24cell', '600cell']),
    palette: new Set(Object.keys(PALETTE_PRESETS)),
    shift: new Set(Object.keys(SHIFT_PRESETS)),
    blend: new Set(Object.keys(BLEND_MODES)),
    colorBy: new Set(COLORING_NAMES),
    fx: new Set(FX_MODE_NAMES),
    bg: new Set(BG_MODES),
    theme: new Set(Object.keys(THEMES)),
    layout: new Set(LAYOUTS),
    cameraMode: new Set(['orbit', 'spiral', 'figure8', 'pullback']),
    cameraPath: new Set(['manual', 'coxeterOrbit', 'ringDive', 'petrieSpiral', 'h4Reveal']),
    e8: new Set(['coxeter', 'ortho3d', 'custom', 'h4', 'petrie']),
    compare: new Set(['off', 'overlay', 'intersection', 'difference']),
    quality: new Set(['auto', 'low', 'medium', 'high']),
  };
  return _paramEnums;
}

function normalizeParams(target) {
  const E = paramEnums();

  if (!E.view.has(target.view)) target.view = 'e8coxeter';
  if (!E.shape.has(target.shape)) target.shape = 'icosahedron';
  if (!E.poly.has(target.poly4d)) target.poly4d = '24cell';
  if (!E.palette.has(target.palette)) target.palette = 'gold';
  if (!E.shape.has(target.compareShape)) target.compareShape = 'dodecahedron';
  if (!E.compare.has(target.compareMode)) target.compareMode = 'off';
  if (!E.shift.has(target.shiftMode)) target.shiftMode = 'static';
  if (!E.blend.has(target.blendMode)) target.blendMode = 'spectrum';
  if (!E.colorBy.has(target.colorBy)) target.colorBy = 'shell';
  if (!E.fx.has(target.fxMode)) target.fxMode = 'none';
  if (!E.bg.has(target.bgMode)) target.bgMode = 'void';
  if (!E.theme.has(target.theme)) target.theme = 'dark-gold';
  if (!E.layout.has(target.layout)) target.layout = 'default';
  if (typeof target.bloomMandelbox !== 'boolean') target.bloomMandelbox = false;
  // Auto-animated slider keys must be an array of strings (invalid keys are
  // ignored at runtime — driveAutoSliders only acts on keys with slider meta).
  if (!Array.isArray(target.autoSliders)) target.autoSliders = [];
  else target.autoSliders = target.autoSliders.filter(k => typeof k === 'string');
  // Backward-compat: if a user has a saved config with showStarfield=true but
  // bgMode unset, snap them to the starfield background.
  if (target.showStarfield && target.bgMode === 'void') target.bgMode = 'starfield';
  if (!E.cameraMode.has(target.cameraMode)) target.cameraMode = 'orbit';
  if (!E.cameraPath.has(target.cameraPath)) target.cameraPath = 'manual';
  if (!E.e8.has(target.e8ViewMode)) target.e8ViewMode = 'coxeter';
  if (!E.quality.has(target.mobileQuality)) target.mobileQuality = 'high';
  if (typeof target.reducedMode !== 'boolean') target.reducedMode = false;
  if (typeof target.advancedStyle !== 'boolean') target.advancedStyle = false;
  if (!['create', 'learn'].includes(target.panelMode)) target.panelMode = 'create';
  if (!target.fxByView || typeof target.fxByView !== 'object' || Array.isArray(target.fxByView)) {
    target.fxByView = {};
  }
  const effectQuality = target.reducedMode ? 'low' : target.mobileQuality;
  const normalizedFxByView = {};
  for (const view of E.view) {
    const remembered = target.fxByView[view];
    if (E.fx.has(remembered)) {
      normalizedFxByView[view] = coerceEffectMode(view, remembered, effectQuality);
    }
  }
  target.fxMode = coerceEffectMode(target.view, target.fxMode, effectQuality);
  normalizedFxByView[target.view] = target.fxMode;
  target.fxByView = normalizedFxByView;
  target.bgMode = coerceBackgroundForQuality(target.bgMode, target.reducedMode ? 'low' : target.mobileQuality);
  if (typeof target.cameraOrbit !== 'boolean') target.cameraOrbit = false;
  if (!['instant', 'standard'].includes(target.firstVisualMode)) target.firstVisualMode = 'standard';
  if (typeof target.activeUnlock !== 'string') target.activeUnlock = '';

  // Numeric params — clamp ALL of them so a corrupt/hostile config (e.g. a
  // crafted #config= link) can't push the camera, FX, or fold params to insane
  // values. clampNumber falls back when the value is non-finite/non-number.
  target.opacity = clampNumber(target.opacity, 0.1, 1, 0.9);
  target.rotationSpeed = clampNumber(target.rotationSpeed, 0, 0.02, 0.003);
  target.fxIntensity = clampNumber(target.fxIntensity, 0, 1, 0.5);
  target.shiftSpeed = clampNumber(target.shiftSpeed, 1, 120, 12);
  target.bgIntensity = clampNumber(target.bgIntensity, 0, 1.5, 0.7);
  // Bug fix 2026-06-25: fallback was 1.2 (mid-morph) even though the canonical
  // default is 0 (round-5 fix). A corrupt persisted value would snap to the
  // wrong canonical pose. Now consistent with defaultParams().
  target.morph4d = clampNumber(target.morph4d, -2, 2, 0);
  // Migrate the old tesseract default, whose zero W-depth collapses pairs of
  // vertices and makes the 16-vertex tesseract look like an ordinary cube.
  if (target.polyProjectionVersion !== 2 && target.poly4d === 'tesseract'
      && Math.abs(target.morph4d) < 1e-9) {
    target.morph4d = 0.65;
  }
  target.polyProjectionVersion = 2;
  target.e8MorphT = clampNumber(target.e8MorphT, 0, 1, 0);
  target.rootHaloDepth = Math.round(clampNumber(target.rootHaloDepth, 1, 5, 3));
  target.rootDiffusionSpeed = clampNumber(target.rootDiffusionSpeed, 0.2, 4, 1.25);
  target.cameraSpeed = clampNumber(target.cameraSpeed, 0.1, 5, 1.0);
  target.cameraDistance = clampNumber(target.cameraDistance, 2.4, 12, CAMERA_DEFAULT_DISTANCE);
  target.cameraRotation = clampNumber(target.cameraRotation, -Math.PI, Math.PI, Math.PI / 6);
  target.polyRotationSpeed = clampNumber(target.polyRotationSpeed, 0.04, 0.6, 0.18);
  target.bloomAmount = clampNumber(target.bloomAmount, 0, 1, 0);
  target.bloomMandelboxScale = clampNumber(target.bloomMandelboxScale, 1.5, 3.5, 2.618);
  target.bloomMandelboxIters = Math.round(clampNumber(target.bloomMandelboxIters, 1, 12, 6));
  target.bloomMandelboxMix = clampNumber(target.bloomMandelboxMix, 0, 1, 0.65);
  target.sdfSphereR = clampNumber(target.sdfSphereR, 0.02, 0.15, 0.08);
  target.sdfBlend = clampNumber(target.sdfBlend, 0, 0.12, 0.03);
  target.sdfBloom = clampNumber(target.sdfBloom, 0, 1, 0.5);
  target.sdfAniso = clampNumber(target.sdfAniso, 0, 1, 0.6);
  target.sdfEdges = clampNumber(target.sdfEdges, 0, 1, 0.3);
  target.shapeTwist = clampNumber(target.shapeTwist, 0, 3, 0);
  target.shapeSpike = clampNumber(target.shapeSpike, 0, 1.5, 0);
  target.shapeJitter = clampNumber(target.shapeJitter, 0, 1, 0);
  // NOTE: e8Spin/e8Tilt/e8Roll and polyRot* are intentionally NOT clamped — the
  // auto-rotate loops accumulate them (e.g. e8coxeter.view.js: `e8Spin += dt`),
  // so they grow past π by design. They're periodic rotation angles, so large
  // values are harmless; clamping them would snap a spinning view back to ±π.
  // Only coerce them to finite numbers so a corrupt config can't inject NaN.
  for (const k of ['e8Spin', 'e8Tilt', 'e8Roll',
                   'polyRotXY', 'polyRotZW', 'polyRotXZ', 'polyRotYW', 'polyRotXW', 'polyRotYZ']) {
    if (target[k] !== undefined && !Number.isFinite(Number(target[k]))) target[k] = 0;
  }
  return target;
}

function updateParam(k, v, options = {}) {
  params[k] = v;
  normalizeParams(params);
  if (options.save !== false) saveConfig(params);
  if (k === 'fxMode' && fxRuntime) fxRuntime.setMode(params.fxMode || 'none');
  if (k === 'fxIntensity' && fxRuntime) fxRuntime.setIntensity(params.fxIntensity ?? 0.5);
  if (k === 'bgMode' && bgRuntime) bgRuntime.setMode(params.bgMode || 'void');
  if (k === 'bgIntensity' && bgRuntime) bgRuntime.setIntensity(params.bgIntensity ?? 0.7);
  if ((k === 'shape' || k === 'poly4d') && window.essayPanel) window.essayPanel.render();
  if (k === 'theme') applyTheme(params.theme);
  if (k === 'layout') applyLayout(params.layout);
  if (k === 'cameraDistance') {
    // A direct zoom-slider change returns camera control to the user instead
    // of being immediately overwritten by a running cinematic path.
    params.cameraPath = 'manual';
    params.cameraOrbit = false;
    params.autoZoom = false;
    cameraController.distance = params.cameraDistance;
    cameraController.autoZoomFactor = 1;
    syncCameraTargets();
    updateCameraFromSpherical();
    if (camera) camera.updateMatrixWorld(true);
  }
  if (k === 'cameraRotation') {
    params.cameraPath = 'manual';
    params.cameraOrbit = false;
    params.autoZoom = false;
    cameraController.theta = params.cameraRotation;
    cameraController.autoZoomFactor = 1;
    syncCameraTargets();
    updateCameraFromSpherical();
    if (camera) camera.updateMatrixWorld(true);
  }
  // Sync legacy showStarfield boolean from new bgMode
  if (k === 'bgMode') {
    params.showStarfield = (params.bgMode === 'starfield');
  }
  if (options.rebuild && currentView) switchView(params.view);
  if (options.overlay || k === 'bloomAmount' || k === 'morph4d' || k === 'e8MorphT') {
    updateOverlays(params.view);
  }
  if (options.refresh !== false) refreshPanel();
}

function cameraSnapshot() {
  return cameraController.snapshot();
}

function applyCameraSnapshot(snapshot) {
  if (!snapshot) return;
  cameraController.restore(snapshot, camera, camTarget, params);
}

function runCommand(id) {
  const app = window.__app;
  if (id && id.startsWith('view:')) {
    app.switchView(id.slice(5));
    return;
  }
  if (id && id.startsWith('gallery:')) {
    app.applyGalleryPreset(id.slice(8));
    return;
  }
  if (id && id.startsWith('cameraPath:')) {
    app.setCameraPath(id.slice(11));
    return;
  }
  const commands = {
    resetView: () => app.resetView(),
    resetCamera: () => app.resetCamera(),
    bookmark1: () => app.saveCameraBookmark(1),
    bookmark2: () => app.saveCameraBookmark(2),
    bookmark3: () => app.saveCameraBookmark(3),
    loadBookmark1: () => app.loadCameraBookmark(1),
    loadBookmark2: () => app.loadCameraBookmark(2),
    loadBookmark3: () => app.loadCameraBookmark(3),
    diagnostics: () => app.copyDiagnostics(),
    transparentPng: () => app.exportTransparentPNG(),
    hiResPng: () => app.exportHighResPNG(2),
    svg: () => app.exportSVG(),
    obj: () => app.exportOBJ(),
    geojson: () => app.exportGeometryJSON(),
    clip: () => app.openVideoExport(),
    postcard: () => app.openPostcardStudio(),
    dailyFact: () => app.claimDailyFact(),
    cancelClip: () => app.cancelExportClip(),
    presentation: () => app.togglePresentationMode(),
    teaching: () => app.toggleTeachingMode(),
    rootInspector: () => app.toggleRootInspector(),
    rootDiffusion: () => app.toggleRootDiffusion(),
    weylMirrors: () => app.toggleWeylMirrors(),
    twin600: () => app.toggleE8Twin600(),
    projectionAuto: () => app.toggleProjectionAuto(),
    perf: () => app.togglePerf(),
    adaptivePixelRatio: () => app.toggleAdaptivePixelRatio(),
  };
  if (commands[id]) commands[id]();
}

function commandMatches(item, query) {
  if (!query) return true;
  const haystack = `${item.label} ${item.keywords || ''}`.toLowerCase();
  return query.toLowerCase().trim().split(/\s+/).every(part => haystack.includes(part));
}

function renderCommandList(host, query = '') {
  const list = host.querySelector('[data-cmd-list]');
  if (!list) return;
  const matches = COMMAND_ITEMS.filter(item => commandMatches(item, query)).slice(0, 18);
  list.innerHTML = matches.map((item, i) =>
    `<button data-cmd="${item.id}" class="${i === 0 ? 'cmd-active' : ''}" role="option" aria-selected="${i === 0 ? 'true' : 'false'}">${item.label}</button>`
  ).join('') || '<div class="cmd-empty">No matching command</div>';
}

function setActiveCommand(host, nextIdx) {
  const buttons = Array.from(host.querySelectorAll('[data-cmd-list] [data-cmd]'));
  if (buttons.length === 0) return;
  const idx = ((nextIdx % buttons.length) + buttons.length) % buttons.length;
  buttons.forEach((button, i) => {
    button.classList.toggle('cmd-active', i === idx);
    button.setAttribute('aria-selected', i === idx ? 'true' : 'false');
  });
  buttons[idx].scrollIntoView({ block: 'nearest' });
}

function ensureCommandPalette() {
  let host = document.getElementById('command-palette');
  if (host) return host;
  host = document.createElement('div');
  host.id = 'command-palette';
  host.className = 'command-palette hidden';
  host.innerHTML = `
    <div class="cmd-box" role="dialog" aria-modal="true" aria-label="Command palette">
      <button class="cmd-close" data-cmd-close aria-label="Close command palette">x</button>
      <input class="cmd-search" data-cmd-search type="search" placeholder="Search commands" aria-label="Search commands" autocomplete="off">
      <div class="cmd-list" data-cmd-list role="listbox" aria-label="Commands"></div>
    </div>
  `;
  renderCommandList(host);
  host.addEventListener('click', (e) => {
    const close = e.target.closest('[data-cmd-close]');
    const button = e.target.closest('[data-cmd]');
    if (close || e.target === host) host.classList.add('hidden');
    if (button) {
      runCommand(button.dataset.cmd);
      host.classList.add('hidden');
    }
  });
  host.addEventListener('input', (e) => {
    if (!e.target.matches('[data-cmd-search]')) return;
    renderCommandList(host, e.target.value);
  });
  host.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      host.classList.add('hidden');
      return;
    }
    const buttons = Array.from(host.querySelectorAll('[data-cmd-list] [data-cmd]'));
    const activeIdx = Math.max(0, buttons.findIndex(button => button.classList.contains('cmd-active')));
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveCommand(host, activeIdx + 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveCommand(host, activeIdx - 1);
    } else if (e.key === 'Enter') {
      const active = buttons[activeIdx] || buttons[0];
      if (active) {
        e.preventDefault();
        runCommand(active.dataset.cmd);
        host.classList.add('hidden');
      }
    }
  });
  document.body.appendChild(host);
  return host;
}

function downloadText(text, name, type = 'text/plain') {
  return exportRecording.downloadText(text, name, type);
}

function svgEsc(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[ch]);
}

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

function ensurePerfOverlay() {
  let el = document.getElementById('perf-overlay');
  if (el) return el;
  el = document.createElement('div');
  el.id = 'perf-overlay';
  el.className = 'perf-overlay';
  el.setAttribute('aria-live', 'polite');
  document.body.appendChild(el);
  return el;
}

function updatePerfOverlay(now) {
  if (!params || !params.showPerf) {
    const el = document.getElementById('perf-overlay');
    if (el) el.classList.add('hidden');
    return;
  }
  if (now - perfState.lastOverlay < 400) return;
  perfState.lastOverlay = now;
  const el = ensurePerfOverlay();
  el.classList.remove('hidden');
  el.innerHTML = `
    <b>${perfState.fps.toFixed(0)} fps</b><br>
    ${perfState.frameMs.toFixed(1)} ms frame<br>
    DPR ${renderer ? renderer.getPixelRatio().toFixed(2) : '-'}
    ${params.adaptivePixelRatio ? '<br>adaptive on' : '<br>adaptive off'}
  `;
}

function updateAdaptivePixelRatio(now) {
  if (!renderer || !params?.adaptivePixelRatio) return;
  if (now - perfState.lastAdjust < 1200 || perfState.samples.length < 30) return;
  perfState.lastAdjust = now;
  const maxDpr = qualityDprCap();
  let next = renderer.getPixelRatio();
  if (perfState.frameMs > 28 && next > 0.8) {
    next = Math.max(0.8, next - 0.15);
  } else if (perfState.frameMs < 17 && next < maxDpr) {
    next = Math.min(maxDpr, next + 0.1);
  }
  if (Math.abs(next - renderer.getPixelRatio()) > 0.01) {
    renderer.setPixelRatio(next);
    renderer.setSize(renderer.domElement.clientWidth, renderer.domElement.clientHeight, false);
  }
}

function updateCinematicCamera(now) {
  return cameraController.applyCinematic(params, now, camera, camTarget);
}

function updateProjectionAtlas(now) {
  if (!params?.e8ProjectionAuto || params.view !== 'e8coxeter') return;
  const modes = ['coxeter', 'petrie', 'h4', 'ortho3d', 'custom'];
  if (!projectionAutoStartedAt) projectionAutoStartedAt = now;
  if (now - projectionAutoStartedAt < 6000) return;
  projectionAutoStartedAt = now;
  projectionAutoIndex = (projectionAutoIndex + 1) % modes.length;
  params.e8ViewMode = modes[projectionAutoIndex];
  if (params.e8ViewMode === 'custom') {
    const t = now / 1000;
    params.e8Spin = Math.sin(t * 0.31) * 1.2;
    params.e8Tilt = Math.cos(t * 0.27) * 1.0;
    params.e8Roll = Math.sin(t * 0.19) * 0.8;
  }
  updateOverlays(params.view);
  refreshPanel();
}

function applyGallerySettings(preset) {
  if (!preset) return;
  Object.assign(params, createGalleryBaseline(), preset.settings);
  params.galleryPreset = preset.id;
  projectionAutoStartedAt = 0;
  projectionAutoIndex = 0;
  cameraController.pathStartedAt = performance.now();
  normalizeParams(params);
  // Start every curated scene from a deterministic camera pose. A named path
  // can then take over without inheriting the previous preset's last frame.
  cameraController.theta = params.cameraRotation;
  cameraController.phi = Math.PI / 3;
  cameraController.distance = params.cameraDistance;
  cameraController.autoZoomFactor = 1;
  syncCameraTargets();
  updateCameraFromSpherical();
  saveConfig(params);
  if (fxRuntime) {
    fxRuntime.setMode(params.fxMode || 'none');
    fxRuntime.setIntensity(params.fxIntensity ?? 0.5);
  }
  // Bug fix 2026-06-25: presets that specify bgMode (e.g. aurora-borealis,
  // deep-space, plasma-storm) need bgRuntime to actually switch. Before this
  // fix, applying a preset set params.bgMode but never updated the bg-quad,
  // so the canvas stayed on whatever bg was active before.
  if (bgRuntime) {
    bgRuntime.setMode(params.bgMode || 'void');
    bgRuntime.setIntensity(params.bgIntensity ?? 0.7);
  }
  switchView(params.view);
  updateOverlays(params.view);
  refreshPanel();
  showSavedToast('Gallery: ' + preset.name);
}

function rewardById(id) {
  return learningProgress.rewardById(id);
}

function quizById(id) {
  return learningProgress.quizById(id);
}

// Award an exploration (activity) badge and surface it via toast + panel
// refresh. Idempotent — if the badge is already held, nothing happens. Central
// here so the 5 award sites stay consistent (toast + achievements-grid sync).
function awardExplorationBadge(badgeId, label) {
  const r = learningProgress.awardBadge(badgeId);
  if (r.granted) {
    showSavedToast('Achievement: ' + label);
    refreshPanel();
  }
}

function learningState() {
  return learningProgress.state(params?.view || 'e8coxeter', CURIOUS_CARDS);
}

function ensureLearningModal() {
  let host = document.getElementById('learning-modal');
  if (host) return host;
  host = document.createElement('div');
  host.id = 'learning-modal';
  host.className = 'learning-modal hidden';
  host.addEventListener('click', (e) => {
    if (e.target === host || e.target.closest('[data-modal-close]')) {
      host.classList.add('hidden');
    }
  });
  document.body.appendChild(host);
  return host;
}

function showLearningModal(html) {
  const host = ensureLearningModal();
  host.innerHTML = `<div class="learning-dialog" role="dialog" aria-modal="true">${html}</div>`;
  host.classList.remove('hidden');
  return host;
}

function openLearningCenter(lessonId = null) {
  const lesson = learningLessonById(lessonId) || LEARNING_LESSONS[0];
  if (!lesson) return;
  const path = LEARNING_PATHS.find(item => item.id === lesson.pathId);
  const quizState = learningProgress.progress.quiz?.[lesson.quizId] || null;
  const lessonComplete = learningProgress.lessonComplete(lesson.id);
  const claimLabels = {
    'established-mathematics': 'Established mathematics',
    interpretation: 'Interpretation',
    'app-designed-visualization': 'App-designed visualization',
    'rendering-technique': 'Rendering technique',
  };
  const pathNavigation = LEARNING_PATHS.map(item => `
    <section class="learning-path ${item.id === lesson.pathId ? 'active' : ''}">
      <div class="learning-path-title">${svgEsc(item.title)}</div>
      ${item.lessons.map(entry => `
        <button class="learning-lesson-link ${entry.id === lesson.id ? 'active' : ''}"
          data-learning-lesson="${svgEsc(entry.id)}" aria-current="${entry.id === lesson.id ? 'step' : 'false'}">
          <span>${svgEsc(entry.title)}</span>
          <small>${learningProgress.lessonComplete(entry.id) ? 'complete' : 'open'}</small>
        </button>
      `).join('')}
    </section>
  `).join('');
  const essayCards = lesson.essayIds.map(id => {
    const essay = ESSAYS[id];
    return `<button class="learning-resource-card" data-learning-essay="${svgEsc(id)}">
      <span>${svgEsc(essay?.title || id)}</span><small>Open reading</small>
    </button>`;
  }).join('');
  const sourceCards = lesson.sourceIds.map(id => {
    const source = FACT_SOURCES[id];
    return `<a class="learning-source-card" href="${svgEsc(source.url)}" target="_blank" rel="noreferrer">
      <span>${svgEsc(source.title)}</span>
      <small>${svgEsc(source.author)} · ${svgEsc(source.tier)}</small>
      <em>${svgEsc(source.scope)}</em>
    </a>`;
  }).join('');
  const previous = adjacentLearningLesson(lesson.id, -1);
  const next = adjacentLearningLesson(lesson.id, 1);
  const host = showLearningModal(`
    <button class="modal-close" data-modal-close aria-label="Close">x</button>
    <div class="learning-center-shell">
      <aside class="learning-center-nav" aria-label="Learning paths">
        <div class="modal-kicker">Learning Center</div>
        <div class="learning-progress-summary">${learningProgress.summary().lessonsComplete}/${learningProgress.summary().lessonsTotal} lessons complete</div>
        ${pathNavigation}
      </aside>
      <article class="learning-center-content">
        <div class="modal-kicker">${svgEsc(path?.title || 'Learning path')} · Lesson ${lesson.lessonIndex + 1}</div>
        <h2>${svgEsc(lesson.title)}</h2>
        <p class="modal-copy">${svgEsc(path?.description || '')}</p>
        <div class="learning-claim-note" data-claim-type="${svgEsc(lesson.claimType)}">
          <strong>${svgEsc(claimLabels[lesson.claimType] || lesson.claimType)}</strong>
          <span>${svgEsc(lesson.claimNote)}</span>
        </div>
        <div class="learning-lesson-status">
          <span>Visualization: ${svgEsc(lesson.view)}</span>
          <span>${quizState?.passedAt ? `Quiz complete · best ${quizState.bestScore}/${quizState.total}` : 'Quiz available'}</span>
        </div>
        <div class="modal-actions learning-primary-actions">
          <button data-learning-open-view="${svgEsc(lesson.view)}">Open visualization</button>
          <button data-learning-quiz="${svgEsc(lesson.quizId)}">${quizState?.passedAt ? 'Review quiz' : 'Take quiz'}</button>
          <button data-learning-complete="${svgEsc(lesson.id)}" aria-pressed="${lessonComplete}">${lessonComplete ? 'Mark incomplete' : 'Mark lesson complete'}</button>
        </div>
        <h3>Readings</h3>
        <div class="learning-resource-grid">${essayCards}</div>
        <h3>Sources and scope</h3>
        <div class="learning-source-list">${sourceCards}</div>
        <div class="learning-lesson-nav">
          <button data-learning-lesson="${svgEsc(previous.id)}">← ${svgEsc(previous.title)}</button>
          <button data-learning-lesson="${svgEsc(next.id)}">${svgEsc(next.title)} →</button>
        </div>
      </article>
    </div>
  `);
  host.querySelector('.learning-dialog')?.classList.add('learning-center-dialog');
  host.querySelectorAll('[data-learning-lesson]').forEach(button => {
    button.addEventListener('click', () => openLearningCenter(button.dataset.learningLesson));
  });
  host.querySelector('[data-learning-open-view]')?.addEventListener('click', event => {
    host.classList.add('hidden');
    switchView(event.currentTarget.dataset.learningOpenView);
  });
  host.querySelector('[data-learning-complete]')?.addEventListener('click', event => {
    learningProgress.setLessonComplete(event.currentTarget.dataset.learningComplete, !lessonComplete);
    openLearningCenter(lesson.id);
    refreshPanel();
  });
  host.querySelector('[data-learning-quiz]')?.addEventListener('click', event => startQuizModule(event.currentTarget.dataset.learningQuiz));
  host.querySelectorAll('[data-learning-essay]').forEach(button => {
    button.addEventListener('click', () => {
      host.classList.add('hidden');
      switchView(lesson.view);
      window.essayPanel?.setEssayById(button.dataset.learningEssay);
    });
  });
}

function startQuizModule(moduleId) {
  const module = quizById(moduleId);
  if (!module) return;
  const previous = learningProgress.progress.quiz?.[module.id];
  const questions = module.questions.map((q, qi) => `
    <fieldset class="quiz-question" data-question="${qi}">
      <legend>${svgEsc(q.prompt)}</legend>
      ${q.choices.map((choice, ci) => `
        <label class="quiz-choice">
          <input type="radio" name="quiz-${module.id}-${qi}" value="${ci}">
          <span>${svgEsc(choice)}</span>
        </label>
      `).join('')}
    </fieldset>
  `).join('');
  const reward = rewardById(module.rewardId);
  const host = showLearningModal(`
    <button class="modal-close" data-modal-close aria-label="Close">x</button>
    <div class="modal-kicker">Low-stakes quiz</div>
    <h2>${svgEsc(module.title)}</h2>
    <p class="modal-copy">Three quick checks. Passing unlocks ${svgEsc(reward?.name || 'a postcard background')}; the whole studio stays unlocked either way.</p>
    ${renderContentProvenance(module)}
    ${previous ? `<p class="modal-small">Best score: ${previous.bestScore || 0} / ${previous.total || module.questions.length}</p>` : ''}
    <form class="quiz-form">${questions}</form>
    <div class="modal-actions">
      <button data-quiz-submit="${module.id}">Check answers</button>
      <button data-modal-close>Later</button>
    </div>
    <div class="quiz-result" aria-live="polite"></div>
  `);
  const submit = host.querySelector('[data-quiz-submit]');
  if (submit) {
    submit.addEventListener('click', () => {
      let score = 0;
      const explanations = [];
      module.questions.forEach((q, qi) => {
        const picked = host.querySelector(`input[name="quiz-${module.id}-${qi}"]:checked`);
        const val = picked ? Number(picked.value) : -1;
        if (val === q.answer) score++;
        explanations.push(`<li class="${val === q.answer ? 'right' : 'miss'}">${svgEsc(q.explanation)}</li>`);
      });
      const result = completeQuizProgress(module.id, score, module.questions.length);
      const resultEl = host.querySelector('.quiz-result');
      if (resultEl) {
        resultEl.innerHTML = `
          <strong>${result.passed ? 'Passed' : 'Nice try'}: ${score} / ${module.questions.length}</strong>
          <p>${result.passed ? 'Reward unlocked. That little click of competence is the point.' : 'No penalty. Read the notes and try again whenever you want.'}</p>
          <ul>${explanations.join('')}</ul>
        `;
      }
      refreshPanel();
    });
  }
}

function renderContentProvenance(record) {
  const labels = {
    'established-mathematics': 'Established mathematics', 'historical-context': 'Historical context',
    interpretation: 'Interpretation', 'app-designed-visualization': 'App-designed visualization',
    'rendering-technique': 'Rendering technique',
  };
  const links = (record.sourceIds || []).map(id => {
    const source = FACT_SOURCES[id];
    return source ? `<a href="${svgEsc(source.url)}" target="_blank" rel="noreferrer">${svgEsc(source.author)}</a>` : '';
  }).filter(Boolean).join(' · ');
  return `<div class="content-provenance"><strong>${svgEsc(labels[record.claimType] || record.claimType)}</strong><span>${svgEsc(record.scopeNote || '')}</span><span>${links}</span></div>`;
}

function completeQuizProgress(moduleId, score, total) {
  const module = quizById(moduleId);
  const result = learningProgress.completeQuiz(moduleId, score, total);
  params.activeUnlock = result.passed ? (module?.rewardId || '') : '';
  if (params.activeUnlock) saveConfig(params);
  showSavedToast(result.passed ? `Unlocked ${rewardById(params.activeUnlock)?.name || 'reward'}` : 'Quiz saved');
  return result;
}

function claimDailyFactAction() {
  const fact = dailyFactForDate();
  const result = learningProgress.claimDaily(fact);
  const preset = galleryPresetById(fact.presetId);
  if (preset) applyGallerySettings(preset);
  showLearningModal(`
    <button class="modal-close" data-modal-close aria-label="Close">x</button>
    <div class="modal-kicker">Daily fact</div>
    <h2>${svgEsc(fact.title)}</h2>
    <p class="modal-copy">${svgEsc(fact.body)}</p>
    ${renderContentProvenance(fact)}
    <div class="unlock-strip">
      <strong>${result.alreadyClaimed ? 'Already claimed today' : 'Claimed'}</strong>
      <span>Streak: ${learningProgress.progress.daily?.streak || 0}</span>
      <span>${svgEsc(rewardById(fact.rewardId)?.name || 'cosmetic reward')}</span>
    </div>
    <div class="modal-actions">
      <button data-act="openPostcardStudio">Make postcard</button>
      <button data-modal-close>Keep exploring</button>
    </div>
  `);
  refreshPanel();
}

// ── Glossary modal ───────────────────────────────────────────────────────
// A searchable reference of the terms used across the essays. Re-uses the
// learning-modal host. `focusId` (optional) opens with a specific entry expanded.
function openGlossaryModal(focusId = null) {
  const focus = focusId ? getGlossaryEntry(focusId) : null;
  const initialQuery = focus ? focus.term : '';
  const renderResults = (query) => {
    const matches = getGlossaryMatches(query);
    if (!matches.length) return '<p class="modal-small">No matching terms.</p>';
    // Group by GLOSSARY_GROUPS order, then render each group's entries.
    const byGroup = {};
    for (const e of matches) (byGroup[e.group] = byGroup[e.group] || []).push(e);
    return GLOSSARY_GROUPS
      .filter(g => byGroup[g])
      .map(g => `
        <div class="glossary-group">
          <div class="modal-kicker">${svgEsc(g)}</div>
          ${byGroup[g].map(e => {
            const isFocus = focus && e.id === focus.id;
            const related = (e.related || []).map(r => {
              const re = getGlossaryEntry(r);
              return re ? `<button class="glossary-related" data-glossary-jump="${svgEsc(r)}">${svgEsc(re.term)}</button>` : '';
            }).join(' ');
            return `
              <div class="glossary-entry ${isFocus ? 'glossary-focus' : ''}">
                <div class="glossary-term">${svgEsc(e.term)}</div>
                <div class="glossary-short">${svgEsc(e.short)}</div>
                ${isFocus || matches.length <= 3 ? `<div class="glossary-long">${svgEsc(e.long)}</div>${renderContentProvenance(e)}${related ? `<div class="glossary-related-row">See also: ${related}</div>` : ''}` : ''}
              </div>
            `;
          }).join('')}
        </div>
      `).join('');
  };

  const host = showLearningModal(`
    <button class="modal-close" data-modal-close aria-label="Close">x</button>
    <div class="modal-kicker">Reference</div>
    <h2>Glossary</h2>
    <input id="glossary-search" type="search" class="glossary-search" placeholder="Search terms…" value="${svgEsc(initialQuery)}" autocomplete="off">
    <div id="glossary-results" aria-live="polite">${renderResults(initialQuery)}</div>
  `);

  const input = host.querySelector('#glossary-search');
  const results = host.querySelector('#glossary-results');
  if (input && results) {
    input.addEventListener('input', () => { results.innerHTML = renderResults(input.value); });
    // Delegated handler for "See also" cross-links.
    results.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-glossary-jump]');
      if (!btn) return;
      const jumpId = btn.dataset.glossaryJump;
      const entry = getGlossaryEntry(jumpId);
      if (entry && input) {
        input.value = entry.term;
        results.innerHTML = renderResults(entry.term);
      }
    });
    input.focus();
  }
}

// ── Biographies modal ────────────────────────────────────────────────────
// Lists every figure; clicking one expands their bio. `focusId` (optional)
// opens scrolled to that person.
function openBiographiesModal(focusId = null) {
  const cards = BIOGRAPHIES.map(b => {
    const isFocus = focusId && b.id === focusId;
    return `
      <div class="biography-card ${isFocus ? 'biography-focus' : ''}" data-bio-id="${svgEsc(b.id)}">
        <div class="biography-head">
          <span class="biography-name">${svgEsc(b.name)}</span>
          <span class="biography-dates">${svgEsc(b.dates)}</span>
        </div>
        <div class="biography-field">${svgEsc(b.field)}</div>
        <div class="biography-blurb">${svgEsc(b.blurb)}</div>
        ${renderContentProvenance(b)}
      </div>
    `;
  }).join('');
  const host = showLearningModal(`
    <button class="modal-close" data-modal-close aria-label="Close">x</button>
    <div class="modal-kicker">Reference</div>
    <h2>People</h2>
    <p class="modal-copy">The mathematicians behind the structures in this studio.</p>
    <div class="biography-list">${cards}</div>
  `);
  if (focusId) {
    const el = host.querySelector(`[data-bio-id="${CSS.escape(focusId)}"]`);
    if (el) el.scrollIntoView({ block: 'center' });
  }
}

// ── Keyboard cheatsheet ───────────────────────────────────────────────────
// A ?-triggered overlay listing every shortcut. Single source of truth: the
// SHORTCUTS array mirrors the keydown handler. Plain modal, no search.
const SHORTCUTS = [
  { group: 'Views',   items: [
    { k: '1–6', d: 'Switch view' },
  ]},
  { group: 'Explore', items: [
    { k: 'T',   d: 'Start / stop guided tour' },
    { k: 'Space', d: 'Pause animation — or the tour, if running' },
    { k: 'I',   d: 'Toggle essay panel' },
    { k: '←/→', d: 'Previous / next essay' },
    { k: 'G',   d: 'Open glossary' },
    { k: 'M', d: 'Jump to Math controls' },
    { k: 'L', d: 'Open Learning Center' },
  ]},
  { group: 'Look',    items: [
    { k: 'B',   d: 'Cycle background mood' },
    { k: '[ / ]', d: 'FX intensity down / up' },
    { k: 'R',   d: 'New random seed' },
    { k: 'H',   d: 'Hide chrome (zen mode)' },
  ]},
  { group: 'Capture', items: [
    { k: 'S',   d: 'Save PNG' },
    { k: 'F',   d: 'Fullscreen' },
    { k: '⌘K / Ctrl+K', d: 'Command palette' },
  ]},
  { group: 'Other',   items: [
    { k: '/',   d: 'Focus control filter' },
    { k: '?',   d: 'This cheatsheet' },
    { k: 'Esc', d: 'Close top layer / exit tour or zen' },
  ]},
];

function openCheatsheetModal() {
  const groups = SHORTCUTS.map(g => `
    <div class="cheat-group">
      <div class="modal-kicker">${svgEsc(g.group)}</div>
      ${g.items.map(it => `
        <div class="cheat-row">
          <kbd class="cheat-key">${svgEsc(it.k)}</kbd>
          <span class="cheat-desc">${svgEsc(it.d)}</span>
        </div>
      `).join('')}
    </div>
  `).join('');
  showLearningModal(`
    <button class="modal-close" data-modal-close aria-label="Close">x</button>
    <div class="modal-kicker">Reference</div>
    <h2>Keyboard shortcuts</h2>
    <p class="modal-copy">Press <kbd class="cheat-key">?</kbd> anytime to see this list.</p>
    <div class="cheat-grid">${groups}</div>
  `);
}

// ── Timeline of E₈ modal ──────────────────────────────────────────────────
function openTimelineModal() {
  const entries = TIMELINE.map(t => `
    <div class="timeline-entry">
      <div class="timeline-year">${svgEsc(t.year)}</div>
      <div class="timeline-body">
        <div class="timeline-title">${svgEsc(t.title)}</div>
        <div class="timeline-desc">${svgEsc(t.body)}</div>
        ${renderContentProvenance(t)}
      </div>
    </div>
  `).join('');
  showLearningModal(`
    <button class="modal-close" data-modal-close aria-label="Close">x</button>
    <div class="modal-kicker">Reference</div>
    <h2>Timeline of E₈</h2>
    <p class="modal-copy">A 2,400-year thread from Plato’s solids to the largest computation in mathematics.</p>
    <div class="timeline-list">${entries}</div>
  `);
}

// ── Interactive proofs modal ──────────────────────────────────────────────
// Two step-through interactives: (1) "Why exactly five?" — pick a face type
// and a face-count-at-a-vertex; the angle-sum bar shows whether it closes
// (a Platonic solid) or not (flat tiling / impossible). (2) "Why 248?" — the
// rank+roots decomposition for E₈.
function openProofsModal() {
  // (state lives on the modal DOM; recomputed on each input event)
  const FACE_TYPES = [
    { id: 'triangle', label: 'Triangle', sides: 3, interior: 60 },
    { id: 'square',   label: 'Square',   sides: 4, interior: 90 },
    { id: 'pentagon', label: 'Pentagon', sides: 5, interior: 108 },
    { id: 'hexagon',  label: 'Hexagon',  sides: 6, interior: 120 },
  ];
  const faceButtons = FACE_TYPES.map(f =>
    `<button class="proof-face-btn" data-face="${f.id}">${f.label} (${f.interior}°)</button>`
  ).join('');

  showLearningModal(`
    <button class="modal-close" data-modal-close aria-label="Close">x</button>
    <div class="modal-kicker">Interactive</div>
    <h2>Proofs</h2>

    <div class="proof-card">
      <div class="proof-title">Why exactly five Platonic solids?</div>
      <p class="proof-copy">A Platonic solid needs identical regular polygons meeting the same way at every vertex — with the face angles summing to <b>less than 360°</b> (so they bend into 3D, not lie flat). Pick a face type and drag the count.</p>
      <div class="seg seg-wrap proof-faces">${faceButtons}</div>
      <div class="proof-count-row">
        <label for="proof-count">Faces meeting at a vertex:</label>
        <input id="proof-count" type="range" min="3" max="6" step="1" value="3" class="proof-count">
        <span id="proof-count-val" class="proof-count-val">3</span>
      </div>
      <div class="proof-sum-row">
        <span id="proof-sum-label" class="proof-sum-label">3 × 60° = 180°</span>
        <div class="proof-bar"><div id="proof-bar-fill" class="proof-bar-fill"></div><div class="proof-bar-limit"></div></div>
        <span class="proof-limit-label">360° (flat)</span>
      </div>
      <div id="proof-verdict" class="proof-verdict"></div>
    </div>

    <div class="proof-card">
      <div class="proof-title">Why dimension 248?</div>
      <p class="proof-copy">The dimension of a Lie algebra = rank (the Cartan subalgebra) + number of roots (the root spaces).</p>
      <div class="proof-decomp">
        <div class="decomp-term"><span class="decomp-num">8</span><span class="decomp-lbl">rank<br><small>Cartan subalgebra</small></span></div>
        <div class="decomp-plus">+</div>
        <div class="decomp-term"><span class="decomp-num">240</span><span class="decomp-lbl">roots<br><small>root spaces</small></span></div>
        <div class="decomp-eq">=</div>
        <div class="decomp-term decomp-answer"><span class="decomp-num">248</span><span class="decomp-lbl">dim E₈</span></div>
      </div>
      <p class="proof-copy">There is also the spinor split: 𝔢₈ = 𝔰𝔬(16) ⊕ S⁺ = 120 + 128 = 248 — which is exactly why E₈ appears in the heterotic string.</p>
    </div>
  `);

  const host = document.getElementById('learning-modal');
  if (!host) return;
  let face = FACE_TYPES[0]; // triangle
  const countInput = host.querySelector('#proof-count');
  const countVal = host.querySelector('#proof-count-val');
  const sumLabel = host.querySelector('#proof-sum-label');
  const barFill = host.querySelector('#proof-bar-fill');
  const verdict = host.querySelector('#proof-verdict');

  const SOLIDS = {
    'triangle-3': { name: 'Tetrahedron', schlafli: '{3,3}' },
    'triangle-4': { name: 'Octahedron',  schlafli: '{3,4}' },
    'triangle-5': { name: 'Icosahedron', schlafli: '{3,5}' },
    'square-3':   { name: 'Cube',        schlafli: '{4,3}' },
    'pentagon-3': { name: 'Dodecahedron',schlafli: '{5,3}' },
  };

  const update = () => {
    const n = parseInt(countInput.value);
    countVal.textContent = n;
    const sum = n * face.interior;
    sumLabel.textContent = `${n} × ${face.interior}° = ${sum}°`;
    const pct = Math.min(100, (sum / 360) * 100);
    barFill.style.width = pct + '%';
    // Verdict
    const key = `${face.id}-${n}`;
    if (sum >= 360) {
      verdict.innerHTML = `<span class="proof-bad">✗ ${sum}° ≥ 360° — ${n === 6 && face.id==='triangle' ? 'flat triangular tiling' : 'impossible (faces would overlap flat)'}.</span>`;
      barFill.style.background = 'var(--warn, #ffd27a)';
    } else if (SOLIDS[key]) {
      const s = SOLIDS[key];
      verdict.innerHTML = `<span class="proof-good">✓ ${s.name} ${s.schlafli} — one of the five.</span>`;
      barFill.style.background = 'var(--good, #7df0b8)';
    } else {
      verdict.innerHTML = `<span class="proof-meh">${sum}° < 360°, but ${face.label.toLowerCase()}s with ${n} at a vertex don't form a regular solid.</span>`;
      barFill.style.background = 'var(--ink-2)';
    }
  };

  host.querySelectorAll('.proof-face-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      host.querySelectorAll('.proof-face-btn').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      face = FACE_TYPES.find(f => f.id === btn.dataset.face);
      // Clamp the slider to the valid 3..max-fits range for this face type.
      const maxThatFits = Math.floor(359 / face.interior);
      countInput.max = Math.max(3, Math.min(6, maxThatFits));
      if (parseInt(countInput.value) > parseInt(countInput.max)) countInput.value = countInput.max;
      update();
    });
  });
  if (countInput) { countInput.addEventListener('input', update); }
  // Default: triangle selected.
  host.querySelector('.proof-face-btn')?.classList.add('on');
  update();
}

// ── Preset browser modal ──────────────────────────────────────────────────
// A grid of curated gallery presets, each card previewed with a palette
// swatch + a one-line summary of its view/FX/background. Clicking applies it.
// (Live per-preset canvas thumbnails would need offscreen renders — palette
// swatches are instant and give each preset's color identity at a glance.)
function openPresetBrowserModal() {
  const VIEW_LABELS = { bloom:'Bloom', platonic:'Platonic', e8coxeter:'E₈', sixhundred:'600-cell', polytope:'4D', raymarched:'SDF' };
  const cards = GALLERY_PRESETS.map(p => {
    const s = p.settings || {};
    const paletteName = s.palette || 'gold';
    const palette = PALETTE_PRESETS[paletteName] || PALETTE_PRESETS.gold;
    const view = VIEW_LABELS[s.view] || s.view || '?';
    const fx = s.fxMode && s.fxMode !== 'none' ? `· ${s.fxMode}` : '';
    const bg = s.bgMode && s.bgMode !== 'void' ? `· ${s.bgMode}` : '';
    return `
      <button class="preset-card" data-preset-id="${svgEsc(p.id)}" title="${svgEsc(p.name)} — click to apply">
        <span class="preset-swatch" style="background:${palettePreviewCSS(paletteName, 'spectrum')}"></span>
        <span class="preset-name">${svgEsc(p.name)}</span>
        <span class="preset-palette">${svgEsc(paletteName.replaceAll('_', ' '))} · ${svgEsc(palette.description)}</span>
        <span class="preset-meta">${view} ${fx} ${bg}</span>
        ${p.description ? `<span class="preset-desc">${svgEsc(p.description)}</span>` : ''}
      </button>
    `;
  }).join('');
  const host = showLearningModal(`
    <button class="modal-close" data-modal-close aria-label="Close">x</button>
    <div class="modal-kicker">Gallery</div>
    <h2>Presets</h2>
    <p class="modal-copy">${GALLERY_PRESETS.length} curated combinations of view, palette, FX, and background. Click to apply.</p>
    <div class="preset-grid">${cards}</div>
  `);
  if (host) {
    host.querySelectorAll('[data-preset-id]').forEach(card => card.addEventListener('click', () => {
      const preset = galleryPresetById(card.dataset.presetId);
      if (!preset) return;
      applyGallerySettings(preset);
      showSavedToast(`Preset: ${preset.name}`);
      host.classList.add('hidden');
    }));
  }
}

// ── Video export modal ────────────────────────────────────────────────────
// Duration / resolution / fps controls for the WebM/MP4 recorder. Defaults to
// 720p @ 30fps (sharp enough to read the root labels and Petrie polyline, but
// not so heavy that mid-range GPUs drop frames mid-recording). Captures the
// live animate loop at a fixed render resolution independent of adaptive DPR.
function openVideoExportModal() {
  // Defaults persisted on params so a re-open remembers the last choice.
  const dur = params.clipDuration ?? 8;
  const res = params.clipResolution ?? '720p';
  const fps = params.clipFps ?? 30;
  const resOpts = [
    { id: '720p',  label: '720p (1280×720)',  w: 1280, h: 720 },
    { id: '1080p', label: '1080p (1920×1080)', w: 1920, h: 1080 },
    { id: '480p',  label: '480p (854×480)',   w: 854,  h: 480 },
  ];
  const fpsOpts = [24, 30, 60];
  const resButtons = resOpts.map(r =>
    `<button class="proof-face-btn ${res === r.id ? 'on' : ''}" data-res="${r.id}">${r.label}</button>`
  ).join('');
  const fpsButtons = fpsOpts.map(f =>
    `<button class="proof-face-btn ${fps === f ? 'on' : ''}" data-fps="${f}">${f} fps</button>`
  ).join('');

  showLearningModal(`
    <button class="modal-close" data-modal-close aria-label="Close">x</button>
    <div class="modal-kicker">Export</div>
    <h2>Record video</h2>
    <p class="modal-copy">Records the live animation at a fixed resolution (independent of the on-screen pixel ratio, so it stays sharp). The render keeps running while you record — orbit, pause the tour, change presets.</p>

    <div class="proof-card">
      <div class="proof-count-row">
        <label for="clip-duration">Duration:</label>
        <input id="clip-duration" type="range" min="2" max="30" step="1" value="${dur}" class="proof-count">
        <span id="clip-duration-val" class="proof-count-val">${dur}s</span>
      </div>
      <div class="ps-subtitle" style="margin:10px 0 4px">Resolution</div>
      <div class="seg seg-wrap proof-faces">${resButtons}</div>
      <div class="ps-subtitle" style="margin:10px 0 4px">Frame rate</div>
      <div class="seg seg-wrap proof-faces">${fpsButtons}</div>
      <div class="proof-count-row" style="margin-top:12px">
        <label for="clip-motion" title="Slow auto-rotation during recording so thin lines stay sharp under video compression">Slow motion:</label>
        <input id="clip-motion" type="range" min="0" max="1" step="0.05" value="${params.clipMotionScale ?? 0.4}" class="proof-count">
        <span id="clip-motion-val" class="proof-count-val">${Math.round((params.clipMotionScale ?? 0.4) * 100)}%</span>
      </div>
      <p class="proof-copy" style="margin-top:4px">Slows auto-rotation & camera paths during recording (without affecting playback speed) so thin edges survive compression. 40% is a good default; lower = sharper lines, higher = livelier motion.</p>
    </div>

    <div class="modal-actions">
      <button data-clip-start><span style="font-size:13px">⏺</span> Start recording</button>
      <button data-modal-close>Cancel</button>
    </div>
    <div class="quiz-result" aria-live="polite"></div>
  `);

  const host = document.getElementById('learning-modal');
  if (!host) return;
  const durInput = host.querySelector('#clip-duration');
  const durVal = host.querySelector('#clip-duration-val');
  const motionInput = host.querySelector('#clip-motion');
  const motionVal = host.querySelector('#clip-motion-val');
  let chosenRes = res, chosenFps = fps;
  const updateDur = () => { durVal.textContent = durInput.value + 's'; };
  const updateMotion = () => {
    motionVal.textContent = Math.round(parseFloat(motionInput.value) * 100) + '%';
  };
  durInput.addEventListener('input', updateDur);
  motionInput.addEventListener('input', updateMotion);
  host.querySelectorAll('[data-res]').forEach(btn => {
    btn.addEventListener('click', () => {
      host.querySelectorAll('[data-res]').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      chosenRes = btn.dataset.res;
    });
  });
  host.querySelectorAll('[data-fps]').forEach(btn => {
    btn.addEventListener('click', () => {
      host.querySelectorAll('[data-fps]').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      chosenFps = parseInt(btn.dataset.fps);
    });
  });
  host.querySelector('[data-clip-start]').addEventListener('click', async () => {
    const seconds = parseInt(durInput.value);
    const resDef = resOpts.find(r => r.id === chosenRes) || resOpts[0];
    const motionScale = parseFloat(motionInput.value);
    // Persist choices for next time.
    params.clipDuration = seconds;
    params.clipResolution = chosenRes;
    params.clipFps = chosenFps;
    params.clipMotionScale = motionScale;
    saveConfig(params);
    // Close the modal so the canvas is fully visible during recording.
    host.classList.add('hidden');
    await window.__app.exportClip(seconds, { width: resDef.w, height: resDef.h, fps: chosenFps, motionScale });
  });
}

function unlockedPostcardRewards() {
  const ids = new Set(learningProgress.progress.unlocked?.backgrounds || []);
  return REWARD_BACKGROUNDS.filter(r => ids.has(r.id));
}

function activePostcardReward() {
  const unlocked = unlockedPostcardRewards();
  return unlocked[unlocked.length - 1] || REWARD_BACKGROUNDS[0];
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight, maxLines = 4) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  lines.forEach((value, idx) => ctx.fillText(value, x, y + idx * lineHeight));
  return lines.length * lineHeight;
}

function drawRoundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function createPostcardCanvas(caption = '', pulse = 0) {
  if (!renderer || !camera) return null;
  try { renderer.render(scene, camera); } catch {}
  const W = 1080;
  const H = 1920;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const reward = activePostcardReward();
  const colors = reward?.colors || ['#07070c', '#11131a', '#f4d27a', '#6affe8'];
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, colors[0]);
  bg.addColorStop(0.55, colors[1]);
  bg.addColorStop(1, '#050508');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W * 0.5, H * 0.43, 20, W * 0.5, H * 0.43, 760);
  glow.addColorStop(0, colors[2]);
  glow.addColorStop(0.35, colors[3]);
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = 0.34 + pulse * 0.08;
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 1;

  const frameX = 78;
  const frameY = 260;
  const frameW = W - frameX * 2;
  const frameH = 1040;
  drawRoundRect(ctx, frameX, frameY, frameW, frameH, 44);
  ctx.fillStyle = 'rgba(7,7,12,0.72)';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = colors[2];
  ctx.stroke();

  const source = renderer.domElement;
  const scale = Math.min((frameW - 48) / source.width, (frameH - 48) / source.height);
  const drawW = source.width * scale;
  const drawH = source.height * scale;
  ctx.drawImage(source, frameX + (frameW - drawW) / 2, frameY + (frameH - drawH) / 2, drawW, drawH);

  ctx.fillStyle = '#f4f1ea';
  ctx.font = '700 74px system-ui, sans-serif';
  ctx.fillText('E8 Studio', 78, 150);
  ctx.font = '500 28px system-ui, sans-serif';
  ctx.fillStyle = '#c9c5b9';
  ctx.fillText(`${params.view || 'e8coxeter'} / ${params.palette || 'gold'} / ${reward?.name || 'Default'}`, 82, 196);

  const copy = caption || 'Today\'s E8 symmetry from E8 Studio';
  ctx.font = '500 44px system-ui, sans-serif';
  ctx.fillStyle = '#f4f1ea';
  wrapCanvasText(ctx, copy, 82, 1410, W - 164, 58, 4);
  ctx.font = '400 28px system-ui, sans-serif';
  ctx.fillStyle = '#6affe8';
  ctx.fillText('Explore exceptional symmetry offline', 82, 1770);
  ctx.textAlign = 'right';
  ctx.fillStyle = '#f4d27a';
  ctx.fillText('e8.studio', W - 82, 1770);
  ctx.textAlign = 'left';
  return canvas;
}

function openPostcardStudioModal() {
  const reward = activePostcardReward();
  const unlocked = unlockedPostcardRewards();
  showLearningModal(`
    <button class="modal-close" data-modal-close aria-label="Close">x</button>
    <div class="modal-kicker">Postcard Studio</div>
    <h2>Create a 9:16 share card</h2>
    <p class="modal-copy">Exports are explicit. Saving locally and sharing are treated the same for rewards.</p>
    <label class="postcard-caption">
      <span>Caption</span>
      <textarea id="postcard-caption" rows="3">Today's E8 symmetry from E8 Studio</textarea>
    </label>
    <div class="unlock-strip">
      <strong>Frame: ${svgEsc(reward?.name || 'Default')}</strong>
      <span>${unlocked.length} unlocked</span>
    </div>
    <div class="modal-actions">
      <button data-act="exportPostcard" data-arg="png">Export PNG</button>
      <button data-act="exportPostcard" data-arg="webm">Export WebM</button>
      <button data-modal-close>Close</button>
    </div>
  `);
}

function postcardCaptionText() {
  const input = document.getElementById('postcard-caption');
  return input ? input.value.trim() : 'Today\'s E8 symmetry from E8 Studio';
}

async function exportPostcardAsset(format = 'png') {
  const caption = postcardCaptionText();
  if (format === 'webm') {
    const blob = await recordPostcardWebM(caption);
    if (blob) {
      learningProgress.recordPostcard('postcard-prime');
      await downloadBlob(blob, `e8_studio_postcard_${Date.now()}.webm`, caption || 'Today\'s E8 symmetry from E8 Studio');
      refreshPanel();
      showSavedToast('Postcard WebM ready');
    }
    return blob;
  }
  const canvas = createPostcardCanvas(caption);
  if (!canvas) {
    showSavedToast('Postcard unavailable');
    return null;
  }
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) return null;
  learningProgress.recordPostcard('postcard-prime');
  await downloadBlob(blob, `e8_studio_postcard_${Date.now()}.png`, caption || 'Today\'s E8 symmetry from E8 Studio');
  refreshPanel();
  showSavedToast('Postcard PNG ready');
  return blob;
}

async function recordPostcardWebM(caption) {
  const canvas = createPostcardCanvas(caption);
  if (!canvas) {
    showSavedToast('Canvas recording unavailable');
    return null;
  }
  const blob = await exportRecording.recordAnimatedCanvas({
    canvas,
    durationMs: 3000,
    fps: 30,
    bitrate: 16_000_000,
    drawFrame(frame, target) {
      const fresh = createPostcardCanvas(caption, Math.sin(frame / 8) * 0.5 + 0.5);
      if (fresh) target.getContext('2d').drawImage(fresh, 0, 0);
    },
  });
  if (!blob) {
    showSavedToast('WebM unavailable; exporting PNG');
    await exportPostcardAsset('png');
  }
  return blob;
}

// ---------- App object exposed for inline handlers ----------
window.__app = {
  get params() { return params; },
  get camera() { return camera; },
  get scene() { return scene; },
  get renderer() { return renderer; },
  get currentView() { return currentView; },
  get raycaster() { return raycaster; },  // shared with views for click/hover
  // Bug fix 2026-06-25: expose bgRuntime so debug scripts (and the panel
  // generator) can introspect its current mode. Was undefined before.
  get bgRuntime() { return bgRuntime; },
  // Exposed for diagnostics/tests (e.g. asserting the FX material set doesn't
  // leak across view switches, or checking the renderer's pixel ratio).
  get fxRuntime() { return fxRuntime; },
  get frameHealth() { return viewFrameHealth.snapshot(); },
  get activeResourceCount() { return activeViewScope?.size || 0; },
  get runtimeErrors() { return runtimeErrors.slice(); },
  get progress() { return learningProgress.progress; },
  get startupMetrics() {
    return { firstFrameMs, firstInteractiveMs, firstView, mobileQuality: params?.mobileQuality, webglFallbackUsed };
  },
  setParam(k, v, options = {}) { updateParam(k, v, { refresh: false, ...options }); },
  stopSliderAuto(key) {
    if (!Array.isArray(params.autoSliders) || !params.autoSliders.includes(key)) return;
    params.autoSliders = params.autoSliders.filter(item => item !== key);
    saveConfig(params);
  },
  getLearningState() { return learningState(); },
  openLearningCenter(lessonId = null) { openLearningCenter(lessonId); },
  getCuriosityCard(view) { return CURIOUS_CARDS[view || params.view] || CURIOUS_CARDS.e8coxeter; },
  startQuiz(moduleId) { startQuizModule(moduleId); },
  completeQuiz(moduleId, score, total) {
    const result = completeQuizProgress(moduleId, score, total);
    refreshPanel();
    return result;
  },
  claimDailyFact() { claimDailyFactAction(); },
  openPostcardStudio() { openPostcardStudioModal(); },
  openGlossary(focusId = null) { openGlossaryModal(focusId); },
  openBiographies(focusId = null) { openBiographiesModal(focusId); },
  openCheatsheet() { openCheatsheetModal(); },
  openTimeline() { openTimelineModal(); },
  openProofs() { openProofsModal(); },
  openPresets() { openPresetBrowserModal(); },
  openVideoExport() { openVideoExportModal(); },
  exportPostcard(format = 'png') { return exportPostcardAsset(format); },
  setMobileQuality(level) {
    if (!MOBILE_QUALITY[level]) return;
    params.mobileQuality = level;
    if (level !== 'low') params.reducedMode = false;
    normalizeParams(params);
    applyQualityProfile();
    // SDF quality controls compile different fixed shader budgets. Rebuild the
    // active material immediately so changing the quality selector takes effect
    // without requiring the user to leave and re-enter the view.
    if (params.view === 'raymarched' && currentView) switchView('raymarched');
    saveConfig(params);
    refreshPanel();
    showSavedToast(`Quality: ${level}`);
  },
  enableReducedMode() {
    params.reducedMode = true;
    params.mobileQuality = 'low';
    if (params.view === 'raymarched') params.view = 'e8coxeter';
    applyQualityProfile();
    saveConfig(params);
    if (!renderer) {
      location.reload();
      return;
    }
    if (currentView) switchView(params.view);
    hideRenderFallback();
    refreshPanel();
    showSavedToast('Reduced mode on');
  },
  retryWebGL() { location.reload(); },
  unlockReward(id) {
    learningProgress.unlock(id);
    refreshPanel();
  },
  showRenderFallbackForTest() {
    showRenderFallback('Test fallback', 'Forced fallback for smoke tests.');
  },
  getPostcardPreviewInfo() {
    const canvas = createPostcardCanvas('Preview');
    return canvas ? { width: canvas.width, height: canvas.height } : null;
  },
  // Cartan matrix explorer: click simple root nodes to select two
  toggleCartan(id) {
    const sel = (params.cartanSelection = params.cartanSelection || []);
    if (sel.includes(id)) {
      params.cartanSelection = sel.filter(x => x !== id);
    } else if (sel.length < 2) {
      params.cartanSelection = [...sel, id];
    } else {
      params.cartanSelection = [id];
    }
    refreshPanel();
  },
  // Weyl orbit: animate a walking trail under random simple reflections
  toggleWeylOrbit() {
    updateParam('weylOrbit', !params.weylOrbit);
  },
  toggleWeylFast() {
    updateParam('weylOrbitFast', !params.weylOrbitFast);
  },
  // Lie bracket triangle cycle
  cycleBracket(dir) {
    const n = 7;  // BRACKET_TRIANGLES.length
    const cur = (params.bracketIndex || 0);
    params.bracketIndex = (cur + dir + n) % n;
    refreshPanel();
  },
  // Renderer: WebGL2 only. WebGPU was a placeholder that never had a real
  // implementation — the toggle just reloaded the page and silently fell back.
  // Removed from the UI; this stub prevents errors if anything still calls it.
  setRenderer(type) {
    showSavedToast('Renderer: WebGL2 (WebGPU not yet implemented)');
  },
  setShape(s) {
    updateParam('shape', s, { refresh: false });
    // Rebuild the 3D view so the new shape is reflected (Platonic wireframe,
    // E8 McKay highlight subset, Bloom source shape, etc.)
    if (currentView) switchView(params.view);
    buildPanel();
    updateOverlays(params.view);
  },
  setCompareShape(s) {
    updateParam('compareShape', s, { overlay: true });
  },
  setCompareMode(m) {
    updateParam('compareMode', m, { overlay: true });
  },
  switchView(v) { switchView(v); },
  setPalette(p) {
    updateParam('palette', p, { refresh: false });
    if (scene) {
      const pal = buildPalette(p);
      // Only write scene.background if bgMode is 'void'. For shader bg modes,
      // bg-quad is responsible for canvas color and scene.background must stay null.
      if (params.bgMode === 'void' || !params.bgMode) {
        scene.background = new THREE.Color(pal.bg);
      }
      if (bgRuntime && bgRuntime.mode !== 'void') {
        bgRuntime.scene.background = null;
      }
    }
    // Call the view's onPaletteChange to update colors in-place (no view
    // rebuild — the change should be instant). If the view doesn't implement
    // onPaletteChange, fall back to a view rebuild as before.
    if (currentView && currentView.onPaletteChange) {
      currentView.onPaletteChange(p);
    } else if (currentView) {
      switchView(params.view);
    }
    refreshPanel();
    updateOverlays(params.view);
  },
  setShiftMode(m) {
    updateParam('shiftMode', m);
    // Bug fix 2026-06-25: shift cycle was anchored to page load time, so
    // picking a shift mode after the page was already open would jump
    // mid-cycle and the first palette change could appear instantly.
    // Anchor to "now" so each shift mode starts a fresh cycle.
    if (typeof performance !== 'undefined') {
      shiftStartedAt = performance.now() / 1000;
      // Allow the first palette change immediately (don't carry over the rate-
      // limit lock from the previous shift mode).
      lastPaletteShiftAt = 0;
    }
  },
  setBlendMode(m) {
    updateParam('blendMode', m, { refresh: false });
    // Re-create current view so all colors re-evaluate with the new blend mode
    if (currentView) switchView(params.view);
    refreshPanel();
  },
  // Choose which mathematical invariant drives the colouring (the E8-native
  // coloring system). The E8 view re-colours in-place on the next frame; other
  // views pick it up on their next rebuild.
  setColorBy(m) {
    updateParam('colorBy', m, { refresh: false });
    refreshPanel();
  },
  // Toggle auto-animation for a single slider. Any number can run at once; the
  // main loop oscillates each between its min and max (see driveAutoSliders).
  toggleSliderAuto(key) {
    const set = new Set(params.autoSliders || []);
    set.has(key) ? set.delete(key) : set.add(key);
    params.autoSliders = [...set];
    saveConfig(params);
    refreshPanel();
  },
  setDynkin(d) { updateParam('dynkin', d, { overlay: true }); },
  setPoly4d(p) {
    updateParam('poly4d', p, { refresh: false });
    // The iconic tesseract projection is a cube within a cube. At W-depth 0,
    // opposite-W vertices coincide and only one cube is visible.
    if (p === 'tesseract' && Math.abs(params.morph4d || 0) < 1e-9) {
      updateParam('morph4d', 0.65, { refresh: false });
    }
    refreshPanel();
    updateOverlays(params.view);
  },
  toggleAutoRotate() {
    updateParam('autoRotate', !params.autoRotate, { refresh: false });
    // The compact panel control means a predictable manual orbit; named
    // cinematic paths remain available through the command palette.
    if (params.autoRotate) {
      params.cameraMode = 'orbit';
      params.cameraPath = 'manual';
    }
    refreshPanel();
  },
  toggleBloomAuto() { updateParam('bloomAuto', !params.bloomAuto); },
  toggleRings() { updateParam('showRings', !params.showRings); },
  toggleEdges() { updateParam('showEdges', !params.showEdges); },
  togglePetrie() { updateParam('showPetrie', !params.showPetrie); },
  toggleRootDiffusion() {
    const enabled = !params.rootDiffusion;
    if (enabled && params.pickedRoot == null) {
      // Diffusion needs an origin. Select a deterministic root so the first
      // click visibly starts the wave instead of appearing to do nothing.
      updateParam('pickedRoot', 0, { refresh: false });
    }
    updateParam('rootDiffusion', enabled);
  },
  toggleWeylMirrors() {
    const enabled = !params.showWeylMirrors;
    if (enabled && params.e8ViewMode !== 'coxeter') {
      updateParam('e8ViewMode', 'coxeter', { refresh: false });
    }
    updateParam('showWeylMirrors', enabled);
  },
  toggleE8Twin600() {
    const enabled = !params.e8Twin600;
    if (enabled && params.compareMode !== 'off') {
      // Comparison highlighting changes point size/brightness and can mask the
      // two-half coloring. Twin 600 is a distinct visualization mode.
      updateParam('compareMode', 'off', { refresh: false });
    }
    updateParam('e8Twin600', enabled);
  },
  toggleProjectionAuto() {
    const enabled = !params.e8ProjectionAuto;
    updateParam('e8ProjectionAuto', enabled, { refresh: false });
    if (enabled) {
      const modes = ['coxeter', 'petrie', 'h4', 'ortho3d', 'custom'];
      projectionAutoIndex = Math.max(0, modes.indexOf(params.e8ViewMode || 'coxeter'));
      projectionAutoStartedAt = performance.now() - 6001;
      updateProjectionAtlas(performance.now());
    } else {
      projectionAutoStartedAt = 0;
      refreshPanel();
    }
  },
  toggleH4TwinReveal() { updateParam('h4TwinReveal', !params.h4TwinReveal); },
  toggleBloomMandelbox() { updateParam('bloomMandelbox', !params.bloomMandelbox); },
  // Reset the full Bloom pose — not just bloomAmount. Audit #17: the old
  // inline "Reset" button only zeroed bloomAmount, so bloomAuto and the
  // Mandelbox params survived, leaving the view still animating/folded.
  resetBloom() {
    updateParam('bloomAmount', 0, { refresh: false });
    updateParam('bloomAuto', false, { refresh: false });
    updateParam('bloomMandelbox', false, { refresh: false });
    refreshPanel();
    updateOverlays(params.view);
  },
  toggleCartanHighlight() { updateParam('cartanHighlight', !params.cartanHighlight); },
  toggleStarfield() {
    // Legacy API — now drives bgMode between 'void' and 'starfield'
    const newMode = params.bgMode === 'starfield' ? 'void' : 'starfield';
    updateParam('bgMode', newMode);
  },
  setBgMode(mode) {
    if (!BG_MODES.includes(mode)) return;
    mode = coerceBackgroundForQuality(mode, params.reducedMode ? 'low' : params.mobileQuality);
    // Bug fix 2026-06-25: updateParam('bgMode', ...) already calls
    // bgRuntime.setMode internally (see the k === 'bgMode' branch in
    // updateParam). Calling it again here rebuilt the bg mesh twice per
    // click. Trust updateParam to do it once.
    updateParam('bgMode', mode);
  },
  setBgIntensity(v) {
    const clamped = Math.max(0, Math.min(1.5, v));
    updateParam('bgIntensity', clamped);
    if (bgRuntime) bgRuntime.setIntensity(clamped);
  },
  setWeylSeed(seedArr) { updateParam('weylSeed', seedArr); },
  clearPick() {
    params.pickedRoot = null;
    params.pickedRootPrev = null;
    params.cartanEntry = null;
    params.weylWord = null;
    params.weylWordStr = null;
    if (weylPathTimer) { clearInterval(weylPathTimer); weylPathTimer = null; }
    refreshPanel();
  },
  // Animate the Weyl-group reflection path from pickedRootPrev → pickedRoot.
  // Computes the shortest word in the simple reflections (cached on params),
  // then steps through each intermediate root, moving the neighbor-highlight
  // so the user sees the reflection sequence play out on the root diagram.
  animateWeylPath() {
    const from = params.pickedRootPrev;
    const to = params.pickedRoot;
    if (from == null || to == null || from === to) return;
    const roots = DATA.e8?.roots8d;
    if (!roots) return;
    // Compute (or reuse) the word + its formatted form.
    if (!params.weylWord || params.weylWordFrom !== from || params.weylWordTo !== to) {
      const word = findWeylWord(roots[from], roots[to]);
      if (!word) { showSavedToast('No Weyl path found'); return; }
      params.weylWord = word;
      params.weylWordStr = formatWeylWord(word);
      params.weylWordFrom = from;
      params.weylWordTo = to;
    }
    const steps = weylWordSteps(roots[from], params.weylWord);
    // Map each intermediate 8D vector back to its root index (for highlighting).
    const vecKey = (v) => v.map(x => Math.round(x * 1e4)).join(',');
    const idxByKey = new Map();
    for (let i = 0; i < roots.length; i++) idxByKey.set(vecKey(roots[i]), i);
    const path = steps.map(s => ({ ...s, rootIdx: idxByKey.get(vecKey(s.vec)) }));
    // Animate: highlight each step for ~700ms. Restore the final pick at the end.
    if (weylPathTimer) clearInterval(weylPathTimer);
    const originalPick = params.pickedRoot;
    let i = 0;
    weylPathTimer = setInterval(() => {
      if (i >= path.length) {
        clearInterval(weylPathTimer); weylPathTimer = null;
        params.pickedRoot = originalPick;
        refreshPanel();
        return;
      }
      const step = path[i];
      if (step.rootIdx != null) {
        params.pickedRoot = step.rootIdx;
        refreshPanel();
      }
      i++;
    }, 700);
    showSavedToast(`Weyl path: ${params.weylWordStr} (${params.weylWord.length} steps)`);
  },
  setE8Mode(m) {
    updateParam('e8ViewMode', m, { overlay: true });
  },
  setFX(mode) {
    const quality = params.reducedMode ? 'low' : (params.mobileQuality || 'high');
    if (!effectAvailableForView(params.view, mode, quality)) {
      showSavedToast(`Effect unavailable for ${params.view}`);
      return;
    }
    updateParam('fxMode', mode);
  },
  toggleAdvancedStyle() {
    updateParam('advancedStyle', !params.advancedStyle);
  },
  setPanelMode(mode) {
    if (!['create', 'learn'].includes(mode)) return;
    updateParam('panelMode', mode, { save: false });
  },
  setCameraMode(mode) {
    updateParam('cameraMode', mode, { refresh: false });
    // A camera mode only drives the camera while auto-rotation is on and no
    // cinematic camera *path* is overriding it. Enable both so picking a mode is
    // immediately visible (otherwise the button looks like it does nothing).
    updateParam('cameraOrbit', true, { refresh: false });
    updateParam('cameraPath', 'manual', { refresh: false });
    refreshPanel();
  },
  setCameraPath(path) {
    cameraController.pathStartedAt = performance.now();
    params.cameraOrbit = false;
    updateParam('cameraPath', path);
    showSavedToast(path === 'manual' ? 'Camera path off' : 'Camera path: ' + path);
  },
  setCameraPreset(preset) {
    params.autoZoom = false;
    if (preset === 'dive') {
      params.cameraOrbit = false;
      params.cameraPath = 'ringDive';
    } else if (preset === 'spiral') {
      params.cameraOrbit = false;
      params.cameraPath = 'petrieSpiral';
    } else {
      params.cameraOrbit = true;
      params.cameraMode = 'orbit';
      params.cameraPath = 'manual';
      cameraController.distance = params.cameraDistance;
      syncCameraTargets();
      updateCameraFromSpherical();
    }
    cameraController.pathStartedAt = performance.now();
    saveConfig(params);
    refreshPanel();
  },
  resetCamera() {
    // Stop every controller that can reclaim the camera on the next frame
    // before applying the canonical pose. Preserve unrelated generators such
    // as Extrude Auto.
    params.cameraOrbit = false;
    params.autoZoom = false;
    params.cameraPath = 'manual';
    params.cameraMode = 'orbit';
    params.cameraSpeed = 1;
    params.autoSliders = (params.autoSliders || [])
      .filter(key => key !== 'cameraDistance' && key !== 'cameraRotation');
    cameraController.autoZoomFactor = 1;
    cameraController.lastPath = 'manual';
    cameraController.pathStartedAt = performance.now();
    resetCameraPose();
    params.cameraDistance = cameraController.distance;
    params.cameraRotation = cameraController.theta;
    if (camera) camera.updateMatrixWorld(true);
    saveConfig(params);
    refreshPanel();
    showSavedToast('Camera reset');
  },
  saveCameraBookmark(slot) {
    const key = `${params.view}:${slot}`;
    params.cameraBookmarks = params.cameraBookmarks || {};
    params.cameraBookmarks[key] = cameraSnapshot();
    saveConfig(params);
    showSavedToast(`Saved camera ${slot}`);
    refreshPanel();
  },
  loadCameraBookmark(slot) {
    const key = `${params.view}:${slot}`;
    const snap = params.cameraBookmarks?.[key];
    if (!snap) {
      showSavedToast(`No camera ${slot} for ${params.view}`);
      return;
    }
    applyCameraSnapshot(snap);
    showSavedToast(`Loaded camera ${slot}`);
  },
  toggleCommandPalette() {
    const host = ensureCommandPalette();
    host.classList.toggle('hidden');
    if (!host.classList.contains('hidden')) {
      // Award the "Power User" exploration badge on first open. (Idempotent.)
      awardExplorationBadge('explore:command-palette', 'Power User');
      const input = host.querySelector('[data-cmd-search]');
      if (input) {
        input.value = '';
        renderCommandList(host);
        requestAnimationFrame(() => input.focus());
      }
    }
  },
  copyDiagnostics() {
    const info = {
      view: params.view,
      currentView: currentView?.name || null,
      renderer: renderer ? {
        type: 'webgl',
        width: renderer.domElement.width,
        height: renderer.domElement.height,
        pixelRatio: renderer.getPixelRatio(),
        maxTextureSize: renderer.capabilities?.maxTextureSize,
        precision: renderer.capabilities?.precision,
      } : null,
      performance: {
        fps: Number(perfState.fps.toFixed(1)),
        frameMs: Number(perfState.frameMs.toFixed(2)),
        adaptivePixelRatio: !!params.adaptivePixelRatio,
        firstFrameMs: firstFrameMs == null ? null : Number(firstFrameMs.toFixed(1)),
        firstInteractiveMs: firstInteractiveMs == null ? null : Number(firstInteractiveMs.toFixed(1)),
        firstView,
        mobileQuality: params.mobileQuality,
        webglFallbackUsed,
      },
      runtimeErrors: runtimeErrors.slice(),
      frameHealth: viewFrameHealth.snapshot(),
      params: { ...params, cameraBookmarks: undefined },
      userAgent: navigator.userAgent,
      url: location.href,
    };
    const text = JSON.stringify(info, null, 2);
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => showSavedToast('Diagnostics copied'),
        () => downloadText(text, 'e8_diagnostics.json', 'application/json')
      );
    } else {
      downloadText(text, 'e8_diagnostics.json', 'application/json');
    }
    return info;
  },
  exportHighResPNG(scale = 2) {
    return exportRecording.exportHighResPNG({ renderer, camera, scene, scale });
  },
  exportTransparentPNG() {
    return exportRecording.exportTransparentPNG({ renderer, camera, scene });
  },
  exportSVG() {
    const svg = svgForCurrentE8();
    if (!svg) {
      showSavedToast('SVG unavailable');
      return;
    }
    downloadText(svg, 'e8_coxeter.svg', 'image/svg+xml');
    showSavedToast('Saved SVG');
  },
  /** Return the E8 Coxeter diagram as an SVG string (for tests / scripting). */
  getE8Svg() { return svgForCurrentE8(); },
  /** Export the current Platonic/star solid as a Wavefront OBJ 3-D model. */
  exportOBJ() {
    const obj = objForShape(params.shape);
    if (!obj) { showSavedToast('OBJ unavailable for this shape'); return; }
    downloadText(obj, `${params.shape}.obj`, 'text/plain');
    showSavedToast(`Saved ${params.shape}.obj`);
  },
  /** Export the current view's geometry as portable JSON (any language). */
  exportGeometryJSON() {
    const data = geometryForView();
    if (!data) { showSavedToast('Geometry unavailable'); return; }
    downloadText(JSON.stringify(data, null, 2), `e8studio_${params.view}_geometry.json`, 'application/json');
    showSavedToast('Saved geometry JSON');
  },
  /** Programmatic access for tests/scripting. */
  getOBJ(name) { return objForShape(name || params.shape); },
  getGeometryJSON() { return geometryForView(); },
  togglePresentationMode() {
    params.presentationMode = !params.presentationMode;
    // Keep legacy class in sync for backwards compat with style.css rules
    document.body.classList.toggle('presentation-mode', params.presentationMode);
    // Drive the new unified layout system. Exit target is DEFAULT_LAYOUT
    // ('wide-canvas') — not 'default' — since wide-canvas is now the standard
    // out-of-chrome experience (Part A). Esc also exits to DEFAULT_LAYOUT.
    updateParam('layout', params.presentationMode ? 'presentation' : DEFAULT_LAYOUT);
    applyLayout(params.presentationMode ? 'presentation' : DEFAULT_LAYOUT);
    saveConfig(params);
    setStatus(params.presentationMode ? 'full screen — press Esc to exit' : 'exited full screen');
    refreshPanel();
  },
  setTheme(name) {
    if (!THEMES[name]) return;
    updateParam('theme', name);
    applyTheme(name);
  },
  setLayout(name) {
    if (!LAYOUTS.includes(name)) return;
    updateParam('layout', name);
    applyLayout(name);
    // Sync legacy presentationMode param so the existing toggle action still works
    params.presentationMode = (name === 'presentation');
  },
  toggleTeachingMode() {
    params.teachingMode = !params.teachingMode;
    document.body.classList.toggle('teaching-mode', params.teachingMode);
    saveConfig(params);
    refreshPanel();
  },
  getPresets() {
    // Expose PRESETS to the panel
    return PRESETS;
  },
  setPreset(id) {
    const preset = PRESETS.find(p => p.id === id);
    if (!preset) return;
    applyPreset(preset, params);
    normalizeParams(params);
    saveConfig(params);
    // Sync FX runtime with the new fxMode
    if (fxRuntime) fxRuntime.setMode(params.fxMode || 'none');
    // Rebuild view in case view/stack changed
    if (currentView) switchView(params.view);
    refreshPanel();
    showSavedToast('✦ ' + preset.name);
  },
  getGalleryPresets() {
    return GALLERY_PRESETS;
  },
  applyGalleryPreset(id) {
    const preset = galleryPresetById(id);
    if (preset) applyGallerySettings(preset);
  },
  stepGalleryPreset(direction = 1) {
    const preset = adjacentGalleryPreset(params.galleryPreset, direction);
    if (preset) applyGallerySettings(preset);
  },
  toggleRootInspector() {
    updateParam('showInspector', !params.showInspector);
  },
  togglePerf() {
    updateParam('showPerf', !params.showPerf);
    updatePerfOverlay(performance.now());
  },
  toggleAdaptivePixelRatio() {
    updateParam('adaptivePixelRatio', !params.adaptivePixelRatio);
    // When turning adaptive OFF, restore native DPR. Otherwise the renderer
    // stays stuck at whatever the adapter last downscaled to (e.g. 0.8), so the
    // user gets a permanently blurry canvas after toggling the feature off.
    if (!params.adaptivePixelRatio && renderer) {
      const dpr = qualityDprCap();
      renderer.setPixelRatio(dpr);
      renderer.setSize(renderer.domElement.clientWidth, renderer.domElement.clientHeight, false);
    }
    showSavedToast(params.adaptivePixelRatio ? 'Adaptive DPR on' : 'Adaptive DPR off');
  },
  // Bug fix 2026-06-25 (fuzzer round 8): togglePause was missing from the
  // app API — only the Space keyboard shortcut could flip params.paused.
  // Adding the method exposes programmatic pause control (used by the
  // fuzzer and any future UI button). Note: paused is in the SKIP set
  // so it doesn't persist across reloads by design.
  togglePause() {
    params.paused = !params.paused;
    if (typeof setStatus === 'function') {
      setStatus(params.paused ? 'paused' : 'running');
    }
    showSavedToast(params.paused ? 'Paused' : 'Running');
  },
  toggleAutoZoom() {
    const enabled = !params.autoZoom;
    updateParam('autoZoom', enabled, { refresh: false });
    if (enabled) {
      params.cameraOrbit = true;
      params.cameraMode = 'orbit';
      params.cameraPath = 'manual';
    }
    refreshPanel();
  },
  toggleE8AutoRotate() {
    updateParam('e8AutoRotate', !params.e8AutoRotate);
  },
  resetE8Angles() {
    params.e8Spin = 0;
    params.e8Tilt = 0;
    params.e8Roll = 0;
    params.e8AutoRotate = false;
    saveConfig(params);
    refreshPanel();
  },
  togglePolyAutoRotate() {
    updateParam('polyAutoRotate', !params.polyAutoRotate);
  },
  resetPolyAngles() {
    // Bug fix 2026-06-25: previously set polyAutoRotate = true, so pressing
    // "Reset" would *start* spinning — surprising and inconsistent with
    // resetE8Angles (which sets its auto-rotate to false). A reset should
    // return to the canonical, still pose. (Matches the round-5 default of
    // polyAutoRotate: false.)
    params.polyRotXY = 0;
    params.polyRotZW = 0;
    params.polyRotXZ = 0;  // Round 9: extra 4D rotation planes
    params.polyRotYW = 0;
    params.polyRotXW = 0;  // Round 10: complete all 6 planes of ℝ⁴
    params.polyRotYZ = 0;
    params.morph4d = params.poly4d === 'tesseract' ? 0.65 : 0;
    params.polyAutoRotate = false;
    saveConfig(params);
    refreshPanel();
  },
  // Round 10: a gentle per-view reset that restores the current view's
  // canonical pose (angles, morph, camera) without nuking palette/fx/shape
  // like resetConfig does. Dispatches to the per-view resetters, then resets
  // the camera. Less destructive than resetConfig, more thorough than the
  // individual angle resets.
  resetView() {
    const v = params.view;
    if (v === 'bloom') window.__app.resetBloom();
    else if (v === 'e8coxeter') window.__app.resetE8Angles();
    else if (v === 'polytope') window.__app.resetPolyAngles();
    // Common resets: stop auto-motion, restore camera pose, clear picks.
    updateParam('autoRotate', false, { refresh: false });
    updateParam('bloomAuto', false, { refresh: false });
    updateParam('cameraPath', 'manual', { refresh: false });
    params.pickedRoot = null;
    params.pickedRootPrev = null;
    params.cartanEntry = null;
    resetCameraPose();
    refreshPanel();
    updateOverlays(params.view);
    showSavedToast('View reset');
  },
  refreshPanel: buildPanel,
  // Focus the panel control-filter search box (nice-to-have #5, '/' shortcut).
  // NOTE: the method name is deliberately distinct from the imported
  // `focusPanelSearch` symbol. build.py rewrites imported names to
  // window.__modules['X'] lookups via a regex that fires on ANY occurrence —
  // including inside object-literal method shorthand. Naming this method
  // `focusPanelSearch` would compile to `window.__modules['focusPanelSearch']()
  // { ... }` (invalid syntax). Same trap as tourStart/startTour; build.py now
  // guards against this and fails loudly if it ever recurs.
  panelSearchFocus() { focusPanelSearch(); },
  toggleEssay() { if (window.essayPanel) window.essayPanel.toggle(); },
  toggleTour() { isTourActive() ? stopTour() : startTour(window.__app); },
  // `tourStart`/`tourStop` are kept distinct from the tour module exports so the
  // dist build's regex (which rewrites imported local names to window.__modules[X]
  // lookups) doesn't mangle method-shorthand syntax. The regex fires anywhere
  // the imported name appears — including inside object-literal method-shorthand
  // — which turns `startTour() { ... }` into `window.__modules['startTour']() { ... }`
  // (invalid JS). The export uses `startTour`/`stopTour`/`isTourActive` from
  // tour.js, but the app actions use these distinct names.
  tourStart() { startTour(window.__app); },
  tourStop()  { stopTour(); },
  // Distinct names (same reason as tourStart/tourStop above) to avoid the dist
  // build's regex rewriter mangling pauseTour/resumeTour method shorthand.
  tourPause()  { pauseTour(); },
  tourResume() { resumeTour(); },
  tourPaused() { return isTourPaused(); },
  // Called by tour.js only on natural completion (not manual stop).
  _onTourComplete() {
    awardExplorationBadge('explore:tour-complete', 'Guided');
  },
  copyCodeArt(idx) {
    const s = CODE_ART_SHADERS[idx];
    if (!s) return;
    const text = `// ${s.title}\n// ${s.description}\n\n${s.code}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        () => showSavedToast(`Copied "${s.title}" to clipboard`),
        () => showSavedToast('Copy failed — see console')
      );
    } else {
      // Fallback: textarea + execCommand
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); showSavedToast(`Copied "${s.title}"`); }
      catch { showSavedToast('Copy failed'); }
      document.body.removeChild(ta);
    }
  },
  essayNext() { if (window.essayPanel) window.essayPanel.next(); },
  essayPrev() { if (window.essayPanel) window.essayPanel.prev(); },
  // Persistence
  sharePage() {
    if (location.protocol === 'file:') {
      showSavedToast('Hosted share link available after GitHub Pages deployment');
      return null;
    }
    const url = new URL(location.pathname, location.origin).toString();
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => showSavedToast('E8 Studio link copied'),
        () => window.prompt('Copy the E8 Studio link:', url)
      );
    } else {
      window.prompt('Copy the E8 Studio link:', url);
    }
    return url;
  },
  shareSnapshot() {
    return exportRecording.exportHighResPNG({ renderer, camera, scene, scale: 1 });
  },
  resetConfig() {
    // Reset all parameters to defaults and reload, no confirm dialog
    clearConfig();
    // Also try to stop any running animations
    try { localStorage.removeItem('e8-config'); } catch (e) {}
    location.reload();
  },
  // Export/recording orchestration lives in services/export-recording.js.
  exportClip(durationSec = 8, opts = {}) {
    return exportRecording.recordClip({ renderer, camera, params, durationSec, options: opts });
  },
  cancelExportClip() {
    return exportRecording.cancelRecording();
  },
  // Surprise: randomize many params at once for discovery
  surprise() {
    const PALETTES = Object.keys(PALETTE_PRESETS);
    const SHAPES = ['tetrahedron','cube','octahedron','dodecahedron','icosahedron'];
    const VIEWS_ARR = ['e8coxeter','sixhundred','platonic','polytope','bloom','raymarched'];
    // Filter out 'random' from shift presets — that mode is broken (changes
    // palette every frame) and never plays well with surprise. Bug fixed
    // 2026-06-25.
    const SHIFT_PRESETS_ARR = Object.keys(SHIFT_PRESETS).filter(k => k !== 'random');
    // Weighted random: skip "none" 70% of the time, skip "static" 70% of the time
    const shiftWeighted = () => Math.random() < 0.7 ? SHIFT_PRESETS_ARR[Math.floor(Math.random()*SHIFT_PRESETS_ARR.length)] : 'static';

    // Pick the renderer first, then select from its real capability list. This
    // prevents Surprise from landing on a visually dead effect.
    if (Math.random() < 0.5) {
      const newView = VIEWS_ARR[Math.floor(Math.random() * VIEWS_ARR.length)];
      if (newView !== params.view) switchView(newView);
    }
    const quality = params.reducedMode ? 'low' : (params.mobileQuality || 'high');
    const compatibleModes = effectsForView(params.view, quality).map(item => item.id);
    const fxWeighted = () => Math.random() < 0.7
      ? compatibleModes[Math.floor(Math.random() * compatibleModes.length)]
      : 'none';
    params.shape = SHAPES[Math.floor(Math.random() * SHAPES.length)];
    params.palette = PALETTES[Math.floor(Math.random() * PALETTES.length)];
    params.fxMode = fxWeighted();
    params.fxIntensity = 0.3 + Math.random() * 0.7;
    params.shiftMode = shiftWeighted();
    // shiftSpeed is in SECONDS (cycle period). Range 1-120s — surprise picks
    // 8-45s which feels "random" without going to extremes.
    params.shiftSpeed = 8 + Math.floor(Math.random() * 37);
    params.opacity = 0.7 + Math.random() * 0.3;
    // 60% chance to auto-rotate, 30% bloom-auto
    if (Math.random() < 0.6) {
      params.autoRotate = true;
      params.rotationSpeed = 0.002 + Math.random() * 0.008;
    }
    if (Math.random() < 0.3 && params.view !== 'bloom') {
      params.bloomAuto = true;
    }
    normalizeParams(params);
    if (fxRuntime) fxRuntime.setMode(params.fxMode);
    saveConfig(params);
    refreshPanel();
    updateOverlays(params.view);
    showSavedToast('✦ Surprise!');
  },
};

// Scroll the focused Create/Learn workspace to a named section.
function scrollToSection(name) {
  const desiredMode = (name === 'math' || name === 'learn') ? 'learn' : 'create';
  if (params.panelMode !== desiredMode) {
    params.panelMode = desiredMode;
    refreshPanel();
    requestAnimationFrame(() => scrollToSection(name));
    return;
  }
  const body = document.getElementById('ps-body');
  if (!body) return;
  // Each section is a .ps-section with a data-section attribute set in render().
  const target = body.querySelector(`[data-section="${name}"]`)
    || (name === 'math' ? body.querySelector('[data-section="learn"]') : null);
  if (target) {
    // Android WebView was unreliable with scrollIntoView() inside the nested
    // panel scroller, so drive the panel body directly.
    const bodyRect = body.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const nextTop = Math.max(0, body.scrollTop + targetRect.top - bodyRect.top - 8);
    body.scrollTop = nextTop;
    // Briefly flash the section title so the user sees where they landed.
    target.classList.remove('ps-flash');
    void target.offsetWidth;  // reflow to restart animation
    target.classList.add('ps-flash');
  }
}

// Bump FX intensity by a delta, clamped to [0, 1] (nice-to-have #6: '['/']').
function adjustFXIntensity(delta) {
  const next = Math.max(0, Math.min(1, (params.fxIntensity ?? 0.5) + delta));
  window.__app.setParam('fxIntensity', next);
  if (fxRuntime) fxRuntime.setIntensity(next);
  setStatus(`FX ${(next * 100).toFixed(0)}%`);
}

// ---------- Animation ----------
let lastT = performance.now();
let introStart = null;
const camDriftBase = { x: 0, y: 0, z: 0 };  // baseline (set when user drags)

// Starfield helpers — defined at module scope so animate() can call them.
let _starMatUniformTime = null;
let _starGroup = null;
function updateStarfield(t) {
  if (_starMatUniformTime) _starMatUniformTime.value = t;
  if (_starGroup && params) {
    const visible = !!params.showStarfield;
    if (_starGroup.visible !== visible) _starGroup.visible = visible;
  }
}
// ── Per-slider auto-animation ────────────────────────────────────────────────
// Each slider opted into params.autoSliders oscillates between its min and max.
// A key-derived phase desynchronises them so several running at once produce
// generative, non-repeating mix-and-match motion.
function autoPhase(key) {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) % 100000;
  return (h / 100000) * Math.PI * 2;
}
function applyAutoParam(key, value) {
  params[key] = value;
  // Most slider params are read by the views each frame; a couple need a push.
  if (key === 'cameraDistance') {
    cameraController.distance = clampCameraDistance(value);
    syncCameraTargets();
    updateCameraFromSpherical();
  } else if (key === 'cameraRotation') {
    cameraController.theta = value;
    syncCameraTargets();
    updateCameraFromSpherical();
  } else if (key === 'fxIntensity' && fxRuntime) fxRuntime.setIntensity(value);
  else if (key === 'bgIntensity' && bgRuntime) bgRuntime.setIntensity(value);
}
function driveAutoSliders(t) {
  const keys = params.autoSliders;
  if (!keys || !keys.length) return;
  // Safety floors for auto-animated params that could otherwise drive flashing
  // or seizure-inducing motion if their oscillation bottoms out. The animate
  // loop also enforces a hard palette-shift rate-limit, but clamping these at
  // the source keeps the on-screen slider from ever showing a dangerous value.
  const AUTO_FLOORS = {
    shiftSpeed: 4,      // seconds per full palette cycle — keeps each palette ≥~0.7s
    fxIntensity: 0,     // no floor needed (visual intensity, not strobe)
    bgIntensity: 0,
  };
  for (const key of keys) {
    const meta = SLIDER_META[key];
    if (!meta) continue;
    let osc = meta.min + (meta.max - meta.min) * (0.5 + 0.5 * Math.sin(t * 0.5 + autoPhase(key)));
    const floor = AUTO_FLOORS[key];
    if (floor != null && osc < floor) osc = floor;
    applyAutoParam(key, osc);
    // Reflect into the on-screen slider if it's currently rendered.
    const el = document.getElementById('slider-' + key);
    if (el) {
      const displayed = el.dataset.invert === 'true' ? meta.min + meta.max - osc : osc;
      el.value = displayed;
      const pct = meta.max > meta.min ? ((displayed - meta.min) / (meta.max - meta.min)) * 100 : 0;
      el.style.setProperty('--fill', Math.max(0, Math.min(100, pct)) + '%');
      const lbl = document.getElementById('slider-val-' + key);
      if (lbl) lbl.textContent = formatSliderValue(key, osc);
    }
  }
}

function animate() {
  requestAnimationFrame(animate);
  if (pageHidden) return;
  const now = performance.now();
  const dt = Math.min(0.1, (now - lastT) / 1000);
  lastT = now;
  const t = now / 1000;
  const frameSample = dt * 1000;
  perfState.samples.push(frameSample);
  perfState.sampleTotal += frameSample;
  if (perfState.samples.length > 60) perfState.sampleTotal -= perfState.samples.shift();
  perfState.frameMs = perfState.sampleTotal / Math.max(1, perfState.samples.length);
  perfState.fps = perfState.frameMs > 0 ? 1000 / perfState.frameMs : 0;
  // Safety: don't run the body of animate() if main() hasn't initialized
  // params yet (the very first frame can race with main's setTimeout).
  if (typeof params === 'undefined' || !params) return;

  // Drive any auto-animated sliders before views read their params this frame.
  driveAutoSliders(t);

  // Push FX uniforms to all scene materials every frame
  if (fxRuntime) fxRuntime.update(t);
  // Background mood uniforms (also pushes the bg-quad's renderOrder so it draws first)
  if (bgRuntime) bgRuntime.update(t, renderer);
  // Starfield uTime + visibility (defined at module scope so they work
  // from animate()).
  updateStarfield(t);

  // scene.fog removed (r170 API incompatibility) — this block is now a no-op.
  // The shader-based fog FX (uFXMode == 8) handles depth fade independently.

  // Apply lighting params to scene lights
  if (scene && scene.userData.lights) {
    const L = scene.userData.lights;
    const setLightIntensity = (light, value) => {
      if (light && light.intensity !== value) light.intensity = value;
    };
    setLightIntensity(L.ambient, params.lightAmbient ?? 0.55);
    setLightIntensity(L.keyLight, params.lightKey ?? 1.2);
    setLightIntensity(L.fillLight, params.lightFill ?? 0.6);
    setLightIntensity(L.accentLight, params.lightAccent ?? 1.0);
  }

  // Camera mode animation: spiral, figure-8, pullback, orbit. These modes
  // drive the actual spherical coords directly; we then resync the inertia
  // targets so the user can take over without a jump. When NO auto/cinematic
  // mode is running, the user owns the camera and applyCameraDamping() eases
  // the real coords toward the (pointer-driven) targets.
  let cameraDrivenByMode = false;
  // When recording video, slow all auto-motion so thin lines move fewer
  // pixels per frame — keeps them sharp under VP9/MP4 temporal compression
  // instead of smearing into a blur. The user still sees live motion; it's
  // just ~40% speed. (params._recordingMotionScale is set by exportClip.)
  const recScale = params._recording ? (params._recordingMotionScale ?? 0.4) : 1;
  if (currentView && params.cameraOrbit) {
    const speed = (params.cameraSpeed || 1.0) * recScale;
    switch (params.cameraMode) {
      case 'orbit':
        cameraController.theta += dt * 0.5 * speed * (params.rotationSpeed / 0.003);
        break;
      case 'spiral':
        cameraController.theta += dt * 0.7 * speed;
        cameraController.phi = Math.PI / 2 + Math.sin(t * 0.4 * speed) * 0.4;
        break;
      case 'figure8':
        cameraController.theta = Math.PI/2 + Math.sin(t * 0.6 * speed) * 0.7;
        cameraController.phi = Math.PI/2 + Math.sin(t * 0.6 * speed * 2) * 0.4;
        break;
      case 'pullback':
        cameraController.distance = 6 + Math.sin(t * 0.3 * speed) * 2.5;
        // Pullback supplies a fresh un-pulsed distance every frame.
        cameraController.autoZoomFactor = 1;
        cameraController.theta += dt * 0.3 * speed;
        break;
    }
    // Auto zoom: gentle in/out pulse
    if (params.autoZoom) {
      const baseDistance = (cameraController.distance || CAMERA_DEFAULT_DISTANCE) / cameraController.autoZoomFactor;
      cameraController.autoZoomFactor = 1 + Math.sin(t * 0.5 * speed) * 0.05;
      cameraController.distance = baseDistance * cameraController.autoZoomFactor;
    } else if (cameraController.autoZoomFactor !== 1) {
      cameraController.distance /= cameraController.autoZoomFactor;
      cameraController.autoZoomFactor = 1;
    }
    // Apply the mode's updated spherical coords to the actual camera. Without
    // this, spiral / figure-8 / pullback updated cameraController.theta/cameraController.phi/cameraController.distance but
    // never moved the camera (orbit only *looked* alive via view group spin).
    if (!isDragging) updateCameraFromSpherical();
    cameraDrivenByMode = true;
  } else if (cameraController.autoZoomFactor !== 1) {
    // Restore the un-pulsed distance when automatic camera motion is disabled.
    cameraController.distance /= cameraController.autoZoomFactor;
    cameraController.autoZoomFactor = 1;
  }
  const cameraPathActive = updateCinematicCamera(now);
  if (cameraPathActive) cameraDrivenByMode = true;

  // If no mode is driving the camera, ease toward the pointer-driven targets
  // (inertia). During an active drag we snap actuals to targets 1:1 so the view
  // tracks the pointer with no lag; damping (and flick velocity) only applies
  // after release.
  if (!cameraDrivenByMode) {
    if (isDragging) {
      cameraController.theta = cameraController.thetaTarget;
      cameraController.phi = cameraController.phiTarget;
      cameraController.distance = cameraController.distanceTarget;
      updateCameraFromSpherical();
    } else {
      applyCameraDamping(dt);
    }
  } else {
    // A mode owns the camera this frame — keep targets in sync so the next
    // user drag doesn't snap back.
    syncCameraTargets();
  }

  // Intro bloom: auto-cycle through VISIBLE views only (skip hidden ones like Dynkin),
  // 4s each, with bloom-t animating. User clicking a view tab cancels the intro.
  if (params.intro && !params.paused) {
    if (introStart === null) introStart = now;
    const elapsed = (now - introStart) / 1000;
    const visibleViews = VIEWS.filter(v => !v.hidden);
    const viewIdx = Math.floor(elapsed / 4) % visibleViews.length;
    const targetView = visibleViews[viewIdx].id;
    if (params.view !== targetView) switchView(targetView);
    if (targetView === 'bloom') {
      params.bloomAmount = (elapsed % 4) / 4;
      updateOverlays('bloom');
    }
    if (elapsed > 24) {
      params.intro = false;
      switchView('e8coxeter');
    }
  }
  updateProjectionAtlas(now);

  // Animated palette shift — cycles through the active preset's palette names.
  // SAFETY: palette changes are rate-limited so they can never strobe fast
  // enough to be uncomfortable or trigger photosensitive responses. Two guards:
  //   (1) cyclePeriod floored at 4s — even with shiftSpeed=1, a full cycle
  //       through all palettes takes ≥4s, so each palette holds for ≥0.5s.
  //   (2) a hard 1.5s minimum gap (lastPaletteShiftAt) between ANY palette
  //       change, regardless of cyclePeriod. ~0.66 Hz is well under the 3 Hz
  //       photosensitive-seizure threshold.
  if (params.shiftMode && params.shiftMode !== 'static') {
    const preset = (window.SHIFT_PRESETS && window.SHIFT_PRESETS[params.shiftMode]) || null;
    let targetPalette = null;
    if (preset && preset.length > 0) {
      // cyclePeriod = seconds for one full pass through the preset list.
      // Floor at 4s: a 6-palette preset then spends ≥0.67s per palette, and
      // the per-change cap below clamps that further to ≥1.5s anyway.
      // Respect prefers-reduced-motion by flooring at a very slow 30s.
      const reducedMotionFloor = (typeof window !== 'undefined' && window.matchMedia
        && window.matchMedia('(prefers-reduced-motion: reduce)').matches) ? 30 : 4;
      const cyclePeriod = Math.max(reducedMotionFloor, params.shiftSpeed || 12);
      const tNorm = ((t - shiftStartedAt) % cyclePeriod) / cyclePeriod;
      const idx = Math.floor(tNorm * preset.length) % preset.length;
      targetPalette = preset[idx];
    } else if (params.shiftMode === 'random') {
      // 'random' wasn't a real preset entry — fall back to a one-shot random pick
      // (rare path; happens if user adds shiftMode='random' to URL params).
      const allNames = Object.keys(window.PALETTE_PRESETS || PALETTE_PRESETS);
      targetPalette = allNames[Math.floor(((t - shiftStartedAt) * 0.7) % 1 * allNames.length) % allNames.length];
    }
    // Hard rate-limit: never change palette more than once per 1.8s. This is
    // the photosensitivity guard — it overrides whatever shiftSpeed requests.
    // 1.8s target keeps the actual measured gap ≥1.5s even with frame-timing
    // jitter, well under the ~3 Hz seizure threshold.
    const minShiftGap = 1.8;
    if (targetPalette && targetPalette !== params.palette && (t - lastPaletteShiftAt) >= minShiftGap) {
      lastPaletteShiftAt = t;
      params.palette = targetPalette;
      if (scene) {
        const pal = buildPalette(targetPalette);
        // Honor bgMode — only set scene.background for void mode (matches the
        // change made in switchView / setPalette — keeps state consistent).
        if (params.bgMode === 'void' || !params.bgMode) {
          scene.background = new THREE.Color(pal.bg);
        }
        if (bgRuntime && bgRuntime.mode !== 'void') {
          bgRuntime.scene.background = null;
        }
      }
      if (currentView && currentView.onPaletteChange) {
        currentView.onPaletteChange(targetPalette);
      } else if (currentView) {
        // No in-place recolour hook for this view — rebuild. The 1.5s cap above
        // means this can't thrash the UI even when shiftSpeed is set very low.
        switchView(params.view);
      }
    }
  }

  // Ambient camera drift — small simplex-noise offset on top of the user's orbit position
  if (params.showAmbient && camera && !isDragging && !cameraPathActive) {
    const nx = noise2D(t * 0.08, 0) * 0.06;
    const ny = noise2D(0, t * 0.08 + 100) * 0.04;
    camera.position.set(cameraController.baseX + nx, cameraController.baseY + ny, cameraController.baseZ);
    camera.lookAt(camTarget);
  } else if (camera) {
    // Reset to baseline when ambient disabled
    camera.position.set(cameraController.baseX, cameraController.baseY, cameraController.baseZ);
    camera.lookAt(camTarget);
  }

  if (currentView && !params.paused) {
    // Guard view.update so one bad frame can't kill the whole render loop —
    // without this, a thrown update() skips render() every frame (frozen canvas
    // + console flood). Log once per view instance, then keep rendering.
    viewFrameHealth.run(() => currentView.update(dt, t, params));
  }

  // Forward hover to the current view (drives size boost + hover state).
  // Only when not dragging and the mouse is over the canvas.
  if (currentView && typeof currentView.onHover === 'function'
      && !isDragging && mouseNDC.x > -1.5) {
    currentView.onHover(mouseNDC.x, mouseNDC.y);
  } else if (currentView && params.hoveredRoot != null) {
    params.hoveredRoot = null;
  }

  // Hover raycast — find which point (if any) is under the cursor
  updateTooltip();

  try {
    renderer.render(scene, camera);
    markFirstFrameRendered();
  } catch (e) {
    if (!renderFailureShown) {
      runtimeErrors.push({ type: 'render', message: e.message || String(e), time: Date.now() });
      console.error('[animate] renderer.render() failed:', e);
      showRenderFallback('The live render stopped', 'Reduced mode can keep E8 Studio responsive on this device.');
    }
    return;
  }
  updateAdaptivePixelRatio(now);
  updatePerfOverlay(now);
  // Live motion pill in the panel header (audit #21). Cheap: short-circuits
  // when the state key is unchanged, so it's safe in the 60fps loop.
  updateMotionStatus(params);
}

// ---------- Tooltip ----------
const tooltipEl = typeof document !== 'undefined' ? document.getElementById('tooltip') : null;

function updateTooltip() {
  if (!tooltipEl || !currentView || !camera) {
    if (tooltipEl) tooltipEl.classList.remove('visible');
    return;
  }
  // Don't show tooltip while dragging
  if (isDragging || mouseNDC.x < -1.5) {
    tooltipEl.classList.remove('visible');
    return;
  }

  // Find points objects in current view
  const pointsObjects = [];
  currentView.object3d.traverse((obj) => {
    if (obj.isPoints && obj.geometry && obj.userData.tooltipData) {
      pointsObjects.push(obj);
    }
  });

  if (pointsObjects.length === 0) {
    tooltipEl.classList.remove('visible');
    return;
  }

  raycaster.setFromCamera(mouseNDC, camera);
  const intersects = raycaster.intersectObjects(pointsObjects, false);

  if (intersects.length === 0) {
    tooltipEl.classList.remove('visible');
    return;
  }

  const hit = intersects[0];
  const idx = hit.index;
  const data = hit.object.userData.tooltipData;
  if (!data || idx == null || !data[idx]) {
    tooltipEl.classList.remove('visible');
    return;
  }
  const info = data[idx];

  // Position tooltip near cursor (offset to avoid covering the point)
  tooltipEl.innerHTML = info.html;
  tooltipEl.style.left = (mouseX + 16) + 'px';
  tooltipEl.style.top  = (mouseY + 16) + 'px';
  tooltipEl.classList.add('visible');
}

// ---------- Init ----------
// Delegated event handling — replaces inline on* handlers so the CSP can drop
// script-src 'unsafe-inline'. UI elements declare their behavior via data-attrs:
//   • buttons:  data-act="appMethod" [data-arg="value"]
//   • sliders:  <input type=range data-param="key" [data-off="companion"]>
// One pair of document-level listeners dispatches them all (and keeps working
// across the panel's frequent innerHTML rebuilds).
function installDelegatedHandlers() {
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.hasAttribute('disabled')) return;
    const fn = window.__app && window.__app[el.dataset.act];
    if (typeof fn !== 'function') return;
    if (!('arg' in el.dataset)) { fn.call(window.__app); return; }
    const raw = el.dataset.arg;
    fn.call(window.__app, /^-?\d+(\.\d+)?$/.test(raw) ? Number(raw) : raw);
  });
  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!el.matches || !el.matches('input[type="range"][data-param]')) return;
    const key = el.dataset.param;
    const raw = parseFloat(el.value);
    const min = parseFloat(el.min), max = parseFloat(el.max);
    const val = el.dataset.invert === 'true' ? min + max - raw : raw;
    if (window.__app) {
      // A manual drag takes ownership from that slider's oscillator. Otherwise
      // the next frame overwrites the value and the control appears broken.
      window.__app.stopSliderAuto?.(key);
      window.__app.setParam(key, val);
      if (el.dataset.off) window.__app.setParam(el.dataset.off, false);
    }
    const label = document.getElementById('slider-val-' + key);
    if (label) label.textContent = formatSliderValue(key, val);
    const pct = max > min ? ((raw - min) / (max - min)) * 100 : 0;
    el.style.setProperty('--fill', Math.max(0, Math.min(100, pct)) + '%');
  });
}

function closeTopAppLayer() {
  const modal = document.getElementById('learning-modal');
  if (modal && !modal.classList.contains('hidden')) {
    modal.classList.add('hidden');
    return true;
  }
  const fallback = document.getElementById('render-fallback');
  if (fallback && !fallback.classList.contains('hidden')) {
    fallback.classList.add('hidden');
    return true;
  }
  const palette = document.getElementById('command-palette');
  if (palette && !palette.classList.contains('hidden')) {
    palette.classList.add('hidden');
    return true;
  }
  if (isTourActive()) {
    stopTour();
    return true;
  }
  if (window.essayPanel?.open) {
    window.essayPanel.open = false;
    window.essayPanel.render();
    return true;
  }
  if (params && (params.layout === 'presentation' || params.presentationMode)) {
    window.__app.setLayout('wide-canvas');
    setStatus('exited full screen');
    return true;
  }
  return false;
}

function installCapacitorHandlers() {
  if (!isCapacitorNative()) return;
  const App = capacitorPlugin('App');
  if (!App || typeof App.addListener !== 'function') return;
  App.addListener('backButton', () => {
    if (closeTopAppLayer()) return;
    if (typeof App.exitApp === 'function') App.exitApp();
  });
}

async function main() {
  installDelegatedHandlers();
  installCapacitorHandlers();
  installVisibilityHandlers();
  installStartupInteractionProbe();
  params = defaultParams();
  installFirstRenderWatchdog();
  // Try restoring from URL hash first, then localStorage
  const urlConfig = readUrlConfig();
  if (urlConfig) {
    applyConfig(params, urlConfig);
    setStatus('loaded shared config from URL');
  } else {
    const saved = loadConfig();
    if (saved) {
      applyConfig(params, saved);
      setStatus('restored saved configuration');
    }
  }
  await loadData();
  normalizeParams(params);
  document.body.classList.toggle('presentation-mode', !!params.presentationMode);
  document.body.classList.toggle('teaching-mode', !!params.teachingMode);

  const touchShellEnabled = syncDesktopTouchShell();
  if (touchShellEnabled) {
    cameraController.distance = Math.max(cameraController.distance, CAMERA_TOUCH_DEFAULT_DISTANCE);
    await new Promise(resolve => requestAnimationFrame(resolve));
  }

  try {
    initThree();
    applyQualityProfile({ launch: true });
  } catch (e) {
    runtimeErrors.push({ type: 'webgl-init', message: e.message || String(e), time: Date.now() });
    console.error(e);
    params.reducedMode = true;
    params.mobileQuality = 'low';
    saveConfig(params);
    showRenderFallback('Live WebGL could not start', 'Reduced mode is ready for this device. You can also retry after closing other apps.');
    return;
  }
  buildTabs();
  refreshPanel();
  installDesktopControlsDrawer();
  // Initialize essay panel. onChange fires on nav/open AND (with {essayId})
  // whenever an essay is shown — used to track the "Reader" exploration badge.
  const onEssayChange = (info) => {
    if (info && info.essayId) {
      readEssays.add(info.essayId);
      if (readEssays.size >= 5) {
        awardExplorationBadge('explore:essay-reader', 'Reader');
      }
    }
    refreshPanel();
  };
  window.essayPanel = new EssayPanel(
    document.getElementById('essays'),
    { params, onChange: onEssayChange }
  );
  window.essayPanel.setView(params.view);
  // Expose essay panel on __app so Tour mode can drive specific essays directly.
  window.__app._essayPanel = window.essayPanel;
  // Delegated click for linkified glossary terms inside essay bodies. The
  // links carry data-glossary-term="<id>"; opening the glossary focused on
  // that term.
  const essaysHostEl = document.getElementById('essays');
  if (essaysHostEl) {
    essaysHostEl.addEventListener('click', (e) => {
      const link = e.target.closest('[data-glossary-term]');
      if (!link) return;
      e.preventDefault();
      openGlossaryModal(link.dataset.glossaryTerm);
    });
  }
  // Bug fix 2026-06-24: previously hardcoded 'e8coxeter' here, which overwrote
  // the persisted view on reload. Now we honor the loaded params.view.
  switchView(params.view);
  startAutoSave(() => params);

  // Welcome card: dismisses on any meaningful interaction, not just tabs.
  // - clicking a tab (user is exploring other views)
  // - changing a panel control (shape, palette, view-mode)
  // - pressing Escape or 'r' (explicit dismiss)
  // - clicking the canvas (user wants to interact with the 3D scene)
  // - after 30s of inactivity (auto-dismiss)
  const welcomeCard = document.getElementById('welcome-card');
  const essaysHost = document.getElementById('essays');
  if (welcomeCard) welcomeCard.classList.remove('hidden');
  // The essay panel lives bottom-center and would overlap the centered welcome
  // card on first load. Hide it until the welcome card is dismissed.
  if (essaysHost) essaysHost.style.visibility = 'hidden';

  let welcomeDismissed = false;
  let welcomeHideTimer = null;
  const dismissWelcome = () => {
    if (welcomeDismissed || !welcomeCard) return;
    welcomeDismissed = true;
    welcomeCard.classList.add('hidden');
    if (essaysHost) essaysHost.style.visibility = '';
    if (welcomeHideTimer) { clearTimeout(welcomeHideTimer); welcomeHideTimer = null; }
  };
  // Tab clicks
  document.getElementById('tabs')?.addEventListener('click', dismissWelcome, { once: true });
  // Side panel changes (select boxes + sliders fire 'change' and 'input')
  document.getElementById('panel').addEventListener('change', dismissWelcome, { once: true, capture: true });
  document.getElementById('panel').addEventListener('input', dismissWelcome, { once: true, capture: true });
  // The welcome card's × close button (no inline handler — CSP-safe).
  welcomeCard?.querySelector('.wc-close')?.addEventListener('click', dismissWelcome);
  // Canvas interaction
  document.getElementById('canvas').addEventListener('pointerdown', dismissWelcome, { once: true });
  // Keyboard escape or 'r'
  const escHandler = (e) => {
    if (e.key === 'Escape' || e.key === 'r' || e.key === 'R') {
      dismissWelcome();
      window.removeEventListener('keydown', escHandler);
    }
  };
  window.addEventListener('keydown', escHandler);
  // Auto-dismiss after 30s as fallback
  welcomeHideTimer = setTimeout(dismissWelcome, 30000);

  animate();

  // Keyboard
  window.addEventListener('keydown', (e) => {
    // Escape exits presentation / full-screen mode first (Part B, 2026-06-27).
    // Previously entering presentation hid the panel — including the only button
    // that could toggle it off — with no key bound to leave, trapping the user.
    // Esc now returns to the default (wide-canvas) layout. Placed before the
    // editable-target guard so it works even if a field had focus.
    if (e.key === 'Escape' && (params.layout === 'presentation' || params.presentationMode)) {
      window.__app.setLayout('wide-canvas');
      setStatus('exited full screen');
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      window.__app.toggleCommandPalette();
      return;
    }
    // Bug fix 2026-06-25: don't hijack keys while the user is typing into an
    // input/textarea/contenteditable (command-palette search, future text
    // fields). Without this guard, pressing 's' to type would save a PNG,
    // 'r' would reseed, space would pause, etc. Cmd/Ctrl+K above still works.
    const t = e.target;
    const isEditable = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
    if (isEditable) return;
    if (params.intro) params.intro = false;  // any keypress dismisses intro
    if (e.key === ' ') {
      // When the tour is running, Space pauses/resumes the TOUR (not the
      // animation) — so you can linger on a stop. Otherwise it toggles the
      // render-animation pause as usual.
      if (isTourActive()) {
        isTourPaused() ? resumeTour() : pauseTour();
        setStatus(isTourPaused() ? 'tour paused' : 'tour resumed');
      } else {
        params.paused = !params.paused;
        setStatus(params.paused ? 'paused' : 'running');
      }
    }
    if (e.key === 's' || e.key === 'S') { window.__app.exportHighResPNG(1); setStatus('saved PNG'); }
    if (e.key === 'r' || e.key === 'R') { params.seed = Math.floor(Math.random()*99999); setStatus('seed ' + params.seed); }
    if (e.key === 'f' || e.key === 'F') { toggleFullscreen(); }
    // Essay panel shortcuts
    if (e.key === 'i' || e.key === 'I') { window.__app.toggleEssay(); }
    if (e.key === 't' || e.key === 'T') { window.__app.toggleTour(); }
    if (e.key === 'ArrowLeft') { window.__app.essayPrev(); }
    if (e.key === 'ArrowRight') { window.__app.essayNext(); }
    // Quick-access section shortcuts (nice-to-have #6). Each jumps to a panel
    // section and, for the search box, focuses it. They use modifier-free
    // letters that don't collide with the existing s/r/f/i/t/space/numbers.
    if (e.key === 'm' || e.key === 'M') { scrollToSection('math'); setStatus('Math section'); }
    if (e.key === 'l' || e.key === 'L') { window.__app.openLearningCenter(); setStatus('Learning Center'); }
    if (e.key === 'g' || e.key === 'G') { window.__app.openGlossary(); setStatus('Glossary'); }
    if (e.key === 'b' || e.key === 'B') {
      // Cycle only the environments available at the active quality tier.
      const modes = backgroundModesForQuality(params.reducedMode ? 'low' : params.mobileQuality);
      const cur = modes.indexOf(params.bgMode || 'void');
      window.__app.setBgMode(modes[(cur + 1) % modes.length]);
    }
    if (e.key === '[') { adjustFXIntensity(-0.1); }
    if (e.key === ']') { adjustFXIntensity(0.1); }
    if (e.key === '/' || e.key === '?') {
      e.preventDefault();
      // Plain '/' focuses the control filter; Shift+/ ('?') opens the cheatsheet.
      if (e.key === '?') {
        window.__app.openCheatsheet();
      } else {
        window.__app.panelSearchFocus();
      }
    }
    // H = hide/show chrome (zen mode). Toggles the existing presentation-mode
    // layout, which collapses header/panel/footer for a pure full-canvas view.
    if (e.key === 'h' || e.key === 'H') {
      window.__app.togglePresentationMode();
    }
    // Number keys map to visible views in order
    const visibleViews = VIEWS.filter(v => !v.hidden);
    const idx = parseInt(e.key) - 1;
    if (idx >= 0 && idx < visibleViews.length) {
      switchView(visibleViews[idx].id);
    }
  });

  // Canvas click dismisses intro too
  document.getElementById('canvas').addEventListener('click', () => {
    if (params.intro) params.intro = false;
  });
}

async function downloadBlob(blob, name, shareText = 'E8 Studio export') {
  return exportRecording.downloadBlob(blob, name, shareText);
}

function toggleFullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
}

// Defer main() call so it runs AFTER all module blocks have registered their
// window.__modules exports. Without this, main() runs synchronously after
// main.js's block but BEFORE persistence.js/panel.js/etc. register themselves.
if (typeof window !== 'undefined') {
  setTimeout(() => main().catch(err => {
    setStatus('ERROR: ' + err.message);
    console.error(err);
  }), 0);
}
