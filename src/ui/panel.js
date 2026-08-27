// panel.js — Context-sensitive side-panel for E8 ⇄ Platonics Studio
//
// REWORK PRINCIPLES:
//   Three focused workspaces:
//     1. VIEW — what you're looking at + its specific controls
//     2. VISUALS — palettes, color motion, backgrounds, and effects
//     3. LEARN — orientation, curriculum, and per-view mathematics
//
// Each view shows ONLY its relevant controls. No E8 controls on Platonic.
// No lighting sliders that only affect mesh views when you're on Bloom.

import { PALETTE_PRESETS, SHIFT_PRESETS, COLORINGS, colorAt, palettePreviewCSS } from './palettes.js';
import { BACKGROUND_PRESETS, backgroundModesForQuality } from './backgrounds.js';
import { renderCartanMatrix } from '../math/cartan.js';
import { renderBrackets } from '../math/brackets.js';
import { THEMES, THEME_LABELS } from './theme.js';
import { CODE_ART_SHADERS } from '../content/essays.js';
import { BADGE_INFO } from '../content/learning.js';
import { activeViewModifiers } from '../state/selection-policy.js';
import { exportFormatsForView, viewCapabilities } from '../state/model-registry.js';
import { STELLATION_NAMES, STELLATION_LABELS, STELLATION_INFO } from '../math/stellations.js';
import { generateRank2RootSystem, RANK2_ROOT_SYSTEM_ORDER } from '../math/rank2-roots.js';
import { COXETER_TILING_ORDER, generateCoxeterTiling } from '../math/coxeter-tilings.js';
import { generateE8Quasicrystal, QUASICRYSTAL_REACHES } from '../math/e8-quasicrystal.js';
import {
  CURATED_LOOKS,
  FX_BY_ID,
  effectAvailableForQuality,
  effectAvailableForView,
  effectsForView,
} from '../fx/fx-catalog.js';

const PANEL_WORKSPACES = Object.freeze(['scene', 'style', 'learn']);
const PANEL_WORKSPACE_LABELS = Object.freeze({ scene: 'View', style: 'Visuals', learn: 'Learn' });

const SHAPES = ['tetrahedron', 'cube', 'octahedron', 'dodecahedron', 'icosahedron'];

function panelWorkspace(params) {
  return params.panelMode === 'create' ? 'scene'
    : PANEL_WORKSPACES.includes(params.panelMode) ? params.panelMode
    : 'scene';
}

function pressed(active) {
  return `aria-pressed="${active ? 'true' : 'false'}"`;
}

function formatAngle(value) {
  return `${Number.isInteger(value) ? value : Number(value.toFixed(1))}°`;
}

// ── Helper: short shape label (consistent across shape picker + compare subset) ──
function shapeShort(name) {
  return name.replace('hedron', '').slice(0, 4);
}

function renderCameraControls(params, caps) {
  let html = '<div class="ps-subtitle">Camera</div>';
  html += slider('Orbit angle', 'cameraRotation', params.cameraRotation ?? Math.PI / 6,
    -Math.PI, Math.PI, 0.01, v => `${Math.round(v * 180 / Math.PI)}°`);
  // Camera distance runs opposite to a user's mental model of zoom. Render it
  // inverted so moving right always zooms in (smaller physical distance).
  html += slider('Zoom', 'cameraDistance', params.cameraDistance ?? 6, 0.45, 12, 0.05,
    v => `${Math.round(100 * 6 / Math.max(0.24, v))}%`, undefined, { invert: true });
  if (caps.extrude) {
    // Shared by the point-based E8 projection and the raymarched E8 SDF.
    // Keeping it here makes its cross-view "breathing" behavior discoverable.
    html += slider('Extrude', 'e8MorphT', params.e8MorphT || 0, 0, 1, 0.01, v => v.toFixed(2));
  }
  html += '<div class="seg seg-wrap">';
  html += `<button class="${params.cameraPath === 'manual' && params.cameraOrbit ? 'on' : ''}" ${pressed(params.cameraPath === 'manual' && params.cameraOrbit)} data-act="setCameraPreset" data-arg="orbit" title="Move the camera around the model from side to side">Orbit</button>`;
  html += `<button class="${params.cameraPath === 'ringDive' ? 'on' : ''}" ${pressed(params.cameraPath === 'ringDive')} data-act="setCameraPreset" data-arg="dive" title="Dive toward the center and back">Dive</button>`;
  html += `<button class="${params.cameraPath === 'petrieSpiral' ? 'on' : ''}" ${pressed(params.cameraPath === 'petrieSpiral')} data-act="setCameraPreset" data-arg="spiral" title="Spiral around the structure">Spiral</button>`;
  html += '<button data-act="resetCamera" title="Reset camera position">Reset</button>';
  html += '</div>';
  html += '<div class="ps-subtitle">Motion</div>';
  html += '<div class="seg seg-wrap">';
  html += `<button class="${params.autoRotate ? 'on' : ''}" ${pressed(params.autoRotate)} data-act="toggleAutoRotate" title="Rotate the model itself in a continuous circular spin">Spin</button>`;
  html += `<button class="${params.autoZoom ? 'on' : ''}" ${pressed(params.autoZoom)} data-act="toggleAutoZoom" title="Travel through the full useful zoom range">Auto zoom</button>`;
  html += `<button class="${params.autoModel ? 'on' : ''}" ${pressed(params.autoModel)} data-act="toggleAutoModel" title="Cycle through the Studio's visual showcase">Auto model</button>`;
  html += '</div>';
  html += slider('Spin speed', 'rotationSpeed', params.rotationSpeed ?? 0.003, 0.0005, 0.02, 0.0005, v => `${(v / 0.003).toFixed(1)}×`);
  html += slider('Camera speed', 'cameraSpeed', params.cameraSpeed ?? 1, 0.2, 2, 0.05, v => `${v.toFixed(2)}×`);
  return html;
}

function renderShapeMorphDisclosure(params, uiState = {}) {
  const morphParams = ['shapeTwist', 'shapeSpike', 'shapeJitter'];
  const morphActive = morphParams.some(name => Math.abs(params[name] || 0) > 0.001)
    || morphParams.some(name => (params.autoSliders || []).includes(name));
  const morphOpen = uiState.openDisclosures?.has('shape-morph');
  let html = `<details class="control-disclosure" data-panel-disclosure="shape-morph" ${morphOpen ? 'open' : ''}>
    <summary id="panel-disclosure-shape-morph"><span>Morph</span><small>${morphActive ? 'active deformations' : 'optional deformations'}</small></summary>
    <div class="control-disclosure-body">`;
  html += slider('Twist', 'shapeTwist', params.shapeTwist || 0, 0, 3, 0.02, v => v.toFixed(2));
  html += slider('Spike', 'shapeSpike', params.shapeSpike || 0, 0, 1.5, 0.02, v => v.toFixed(2));
  html += slider('Jitter', 'shapeJitter', params.shapeJitter || 0, 0, 1, 0.02, v => v.toFixed(2));
  html += '</div></details>';
  return html;
}

function renderGalleryControls(params) {
  const gallery = (typeof window !== 'undefined' && window.__app?.getGalleryPresets?.()) || [];
  if (!gallery.length) return '';
  let html = '<div class="ps-subtitle">Gallery</div>';
  const activeIndex = gallery.findIndex(preset => preset.id === params.galleryPreset);
  const activePreset = activeIndex >= 0 ? gallery[activeIndex] : null;
  html += `<div class="gallery-nav">
    <button data-act="stepGalleryPreset" data-arg="-1" title="Previous gallery preset" aria-label="Previous gallery preset">←</button>
    <div class="gallery-nav-current" title="${activePreset?.description || 'Use the arrows to select a gallery preset'}">
      <span>${activePreset?.name || 'Select preset'}</span>
      <small>${activeIndex >= 0 ? `${activeIndex + 1} / ${gallery.length}` : `${gallery.length} presets`}</small>
    </div>
    <button data-act="stepGalleryPreset" data-arg="1" title="Next gallery preset" aria-label="Next gallery preset">→</button>
  </div>`;
  html += `<button class="gallery-browse" data-act="openPresets" title="Browse all presets with palette previews">Browse all ${gallery.length} presets</button>`;
  return html;
}

// ── Section 1: VIEW ──
function renderViewSection(params, data, uiState = {}) {
  const caps = viewCapabilities(params.view);
  let html = '<div class="ps-section" data-section="view"><div class="ps-title">View</div>';

  // View switcher (always visible)
  html += `<div class="seg seg-wrap ps-view-switch">`;
  for (const v of ['bloom', 'platonic', 'e8coxeter', 'quasicrystal', 'polytope', 'raymarched', 'rootlab', 'tiling', 'dynkin']) {
    const label = v === 'e8coxeter' ? 'E₈' : v === 'quasicrystal' ? 'Quasi' : v === 'polytope' ? '4D' : v === 'raymarched' ? 'SDF' : v === 'rootlab' ? 'Roots' : v === 'tiling' ? 'Tilings' : v === 'dynkin' ? 'Dynkin' : v;
    html += `<button class="${params.view === v ? 'on' : ''}" ${pressed(params.view === v)} data-act="switchView" data-arg="${v}" aria-label="Select ${label} view">${label}</button>`;
  }
  html += '</div>';

  // Gallery changes the whole scene, so keep it directly beneath the primary
  // view selector instead of burying it below camera and per-view controls.
  html += renderGalleryControls(params);

  if (params.view === 'quasicrystal') {
    const patch = generateE8Quasicrystal(data.e8, {
      maxNormSq: params.quasiReach,
      windowRadius: params.quasiWindow,
      phason: params.quasiPhason,
      includeDiffraction: false,
      includeEdges: false,
    });
    const modeLabels = { pattern: 'Pattern', window: 'Window', diffraction: 'Diffraction' };
    html += '<div class="ps-subtitle">Projection</div><div class="seg seg-wrap">';
    for (const mode of ['pattern', 'window', 'diffraction']) {
      html += `<button class="${params.quasiMode === mode ? 'on' : ''}" ${pressed(params.quasiMode === mode)} data-act="setQuasiMode" data-arg="${mode}" title="${modeLabels[mode]} view of the cut-and-project construction">${modeLabels[mode]}</button>`;
    }
    html += '</div>';
    html += '<div class="ps-subtitle">Lattice reach</div><div class="seg">';
    for (const reach of QUASICRYSTAL_REACHES) {
      html += `<button class="${params.quasiReach === reach ? 'on' : ''}" ${pressed(params.quasiReach === reach)} data-act="setQuasiReach" data-arg="${reach}" title="Enumerate E8 lattice points through squared norm ${reach}">‖x‖² ≤ ${reach}</button>`;
    }
    html += '</div>';
    html += '<div class="ps-subtitle">Layers</div><div class="seg seg-wrap">';
    html += `<button class="${params.quasiShowPoints ? 'on' : ''}" ${pressed(params.quasiShowPoints)} data-act="toggleQuasiPoints" title="Accepted E8 lattice points">Points</button>`;
    html += `<button class="${params.quasiPointHalos ? 'on' : ''}" ${pressed(params.quasiPointHalos)} data-act="toggleQuasiPointHalos" title="Luminous annular rims around projected points">Point halos</button>`;
    html += `<button class="${params.quasiShowLinks ? 'on' : ''}" ${pressed(params.quasiShowLinks)} data-act="toggleQuasiLinks" title="Local proximity graph in the projected patch" ${params.quasiMode === 'pattern' ? '' : 'disabled'}>Links</button>`;
    html += `<button class="${params.quasiShowGuide ? 'on' : ''}" ${pressed(params.quasiShowGuide)} data-act="toggleQuasiGuide" title="30-fold axes, acceptance window, or reciprocal rings">Guide</button>`;
    html += '</div>';
    html += slider('Window', 'quasiWindow', params.quasiWindow ?? 1.42, 0.8, 2.4, 0.02, value => value.toFixed(2));
    html += slider('Phason', 'quasiPhason', params.quasiPhason ?? 0, -1.2, 1.2, 0.02, value => value.toFixed(2));
    html += slider('Relief', 'quasiRelief', params.quasiRelief ?? 0.08, 0, 0.32, 0.01, value => value.toFixed(2));
    html += `<div class="root-lab-readout" aria-label="E8 cut-and-project facts">
      <div><strong>${patch.pointCount}</strong><span>accepted</span></div>
      <div><strong>${patch.candidateCount}</strong><span>tested</span></div>
      <div><strong>2 + 6</strong><span>dimensions</span></div>
      <div><strong>30</strong><span>fold order</span></div>
    </div>
    <div class="root-lab-equation"><span>Cut rule</span><code>‖x⊥ − w‖ ≤ ${patch.windowRadius.toFixed(2)}</code></div>
    <div class="ps-help root-lab-lengths">Project E8 lattice points into the Coxeter plane; keep only those whose hidden six-dimensional component falls inside the movable window.</div>`;
  }

  if (params.view === 'rootlab') {
    const rootSystem = generateRank2RootSystem(params.rootSystem);
    const matrix = rootSystem.cartanMatrix.map(row => `[${row.join(', ')}]`).join(' ');
    const lengthSummary = rootSystem.shortRootCount
      ? `${rootSystem.longRootCount} long · ${rootSystem.shortRootCount} short`
      : `${rootSystem.longRootCount} equal-length`;
    html += '<div class="ps-subtitle">Root system</div><div class="seg seg-wrap">';
    for (const id of RANK2_ROOT_SYSTEM_ORDER) {
      html += `<button class="${params.rootSystem === id ? 'on' : ''}" ${pressed(params.rootSystem === id)} data-act="setRootSystem" data-arg="${id}" title="Explore the ${id} rank-2 root system">${id.replace('2', '₂')}</button>`;
    }
    html += '</div>';
    html += '<div class="ps-subtitle">Structure</div><div class="seg seg-wrap root-lab-toggles">';
    html += `<button class="${params.rootShowMirrors ? 'on' : ''}" ${pressed(params.rootShowMirrors)} data-act="toggleRootMirrors" title="Reflection hyperplanes perpendicular to the roots">Mirrors</button>`;
    html += `<button class="${params.rootShowChambers ? 'on' : ''}" ${pressed(params.rootShowChambers)} data-act="toggleRootChambers" title="Fundamental sectors cut out by the mirrors">Chambers</button>`;
    html += `<button class="${params.rootShowSimple ? 'on' : ''}" ${pressed(params.rootShowSimple)} data-act="toggleRootSimple" title="The two generating simple roots">Simple roots</button>`;
    html += `<button class="${params.rootShowOrbit ? 'on' : ''}" ${pressed(params.rootShowOrbit)} data-act="toggleRootOrbit" title="Orbit of a root under the Coxeter element">Coxeter orbit</button>`;
    html += '</div>';
    if (params.rootShowOrbit) html += slider('Orbit speed', 'rootOrbitSpeed', params.rootOrbitSpeed ?? 0.7, 0.1, 2, 0.05, value => `${value.toFixed(2)}×`);
    html += `<div class="root-lab-readout" aria-label="${rootSystem.id} construction facts">
      <div><strong>${rootSystem.rootCount}</strong><span>roots</span></div>
      <div><strong>${rootSystem.coxeterNumber}</strong><span>Coxeter h</span></div>
      <div><strong>${formatAngle(rootSystem.chamberAngleDegrees)}</strong><span>chamber</span></div>
      <div><strong>${formatAngle(rootSystem.simpleAngleDegrees)}</strong><span>simple angle</span></div>
    </div>
    <div class="root-lab-equation"><span>${rootSystem.crystallographic ? 'Cartan' : 'Reflection'}</span><code>${matrix}</code></div>
    <div class="ps-help root-lab-lengths">${lengthSummary} roots · generated live from two reflections</div>`;
  }

  if (params.view === 'tiling') {
    const tiling = generateCoxeterTiling(params.tilingSystem, { density: params.tilingDensity });
    const angles = tiling.angleClasses.map(formatAngle).join(' · ');
    html += '<div class="ps-subtitle">Root directions</div><div class="seg seg-wrap">';
    for (const id of COXETER_TILING_ORDER) {
      html += `<button class="${params.tilingSystem === id ? 'on' : ''}" ${pressed(params.tilingSystem === id)} data-act="setTilingSystem" data-arg="${id}" title="Build the ${id} Coxeter multigrid">${id.replace('2', '₂')}</button>`;
    }
    html += '</div>';
    html += '<div class="ps-subtitle">Layers</div><div class="seg seg-wrap tiling-layer-toggles">';
    html += `<button class="${params.tilingShowTiles ? 'on' : ''}" ${pressed(params.tilingShowTiles)} data-act="toggleTilingTiles" title="Filled rhombi dual to grid crossings">Tiles</button>`;
    html += `<button class="${params.tilingShowEdges ? 'on' : ''}" ${pressed(params.tilingShowEdges)} data-act="toggleTilingEdges" title="Shared tile boundaries">Edges</button>`;
    html += `<button class="${params.tilingShowGrid ? 'on' : ''}" ${pressed(params.tilingShowGrid)} data-act="toggleTilingGrid" title="Parallel mirror families used by the construction">Multigrid</button>`;
    html += `<button class="${params.tilingShowRoots ? 'on' : ''}" ${pressed(params.tilingShowRoots)} data-act="toggleTilingRoots" title="Root directions that become tile edges">Root star</button>`;
    html += `<button class="${params.tilingShowVertices ? 'on' : ''}" ${pressed(params.tilingShowVertices)} data-act="toggleTilingVertices" title="Unique vertices of the dual tiling">Vertices</button>`;
    html += `<button class="${params.tilingAnimate ? 'on' : ''}" ${pressed(params.tilingAnimate)} data-act="toggleTilingAnimate" title="Gently animate the construction">Flow</button>`;
    html += '</div>';
    html += slider('Density', 'tilingDensity', params.tilingDensity ?? 5, 2, 8, 1, value => `${Math.round(value)}`);
    html += slider('Relief', 'tilingRelief', params.tilingRelief ?? 0.1, 0, 0.45, 0.01, value => value.toFixed(2));
    if (params.tilingAnimate) html += slider('Flow speed', 'tilingFlowSpeed', params.tilingFlowSpeed ?? 0.55, 0.1, 2, 0.05, value => `${value.toFixed(2)}×`);
    html += `<div class="root-lab-readout tiling-readout" aria-label="${tiling.label} tiling facts">
      <div><strong>${tiling.tileCount}</strong><span>tiles</span></div>
      <div><strong>${tiling.familyCount}</strong><span>grids</span></div>
      <div><strong>${tiling.order}</strong><span>local order</span></div>
      <div><strong>${tiling.periodic ? 'yes' : 'no'}</strong><span>periodic</span></div>
    </div>
    <div class="root-lab-equation"><span>Rhomb angles</span><code>${angles}</code></div>
    <div class="ps-help root-lab-lengths">${tiling.name} · ${tiling.description}</div>`;
  }

  // Shape selector — only if this view uses shapes
  if (caps.shape) {
    const platonic = data.platonic || {};
    // The shape pills mean different things per view: in Platonic they pick the
    // rendered solid; in E8/600 they pick the McKay *source* whose corresponding
    // roots get highlighted; in Bloom they pick the solid the bloom grows from.
    // Label contextually so it isn't mistaken for a solid-renderer in E8 view.
    const shapeLabel = params.view === 'platonic' ? 'Platonic solid'
      : params.view === 'bloom' ? 'Source solid'
      : 'McKay source';
    const shapeHint = params.view === 'platonic' ? 'The Platonic solid to render'
      : params.view === 'bloom' ? 'The solid the bloom grows from'
      : 'Highlights the E₈ roots corresponding to this solid (McKay correspondence)';
    html += `<div class="ps-subtitle" title="${shapeHint}">${shapeLabel}</div>`;
    html += '<div class="shape-row">';
    for (const name of SHAPES) {
      if (!platonic[name]) continue;
      const active = params.shape === name;
      const short = shapeShort(name);
      html += `<button class="shape-pill ${active ? 'active' : ''}" ${pressed(active)} data-act="setShape" data-arg="${name}" title="${name}" aria-label="Select ${name}">${short}</button>`;
    }
    html += '</div>';

    // Round 9: Kepler–Poinsot star polyhedra (Platonic view only).
    // These four non-convex regular polyhedra share H₃ symmetry with the
    // icosahedron/dodecahedron — same vertices, richer topology.
    if (params.view === 'platonic') {
      html += '<div class="ps-subtitle">★ Star polyhedra</div>';
      html += '<div class="shape-row">';
      for (const name of STELLATION_NAMES) {
        const active = params.shape === name;
        const label = STELLATION_LABELS[name] || name;
        html += `<button class="shape-pill ${active ? 'active' : ''}" ${pressed(active)} data-act="setShape" data-arg="${name}" title="${name} (Kepler–Poinsot)" aria-label="Select ${name}">${label}</button>`;
      }
      html += '</div>';
    }

    if (params.view === 'platonic') {
      // Vertex nodes are structural, not a deformation. Keep this important
      // point-sphere toggle discoverable even though the optional morph tools
      // move into a disclosure below.
      html += toggle('Vertex nodes', !!params.showVertices, 'toggleVertices');

      // Camera and motion are the primary way users explore a solid. Present
      // them in full where the old Morph block used to dominate the panel.
      if (caps.rotate) {
        html += `<div class="primary-camera-controls">${renderCameraControls(params, caps)}</div>`;
      }
    }
  }

  if (params.view === 'dynkin') {
    html += '<div class="ps-subtitle">Dynkin diagram</div><div class="seg">';
    for (const diagram of ['E6', 'E7', 'E8']) {
      html += `<button class="${params.dynkin === diagram ? 'on' : ''}" ${pressed(params.dynkin === diagram)} data-act="setDynkin" data-arg="${diagram}">${diagram.replace('E', 'E₀').replace('₀6', '₆').replace('₀7', '₇').replace('₀8', '₈')}</button>`;
    }
    html += '</div>';
  }

  // Bloom-specific controls
  if (caps.bloom) {
    html += renderBloomControls(params);
  }

  // E8-specific controls
  if (caps.e8) {
    html += renderE8Controls(params, data, uiState);
  }

  // SDF-specific controls (raymarched E₈ view)
  if (caps.sdf) {
    html += renderSDFControls(params, data);
  }

  // Polytope-specific controls
  if (caps.poly) {
    html += renderPolytopeControls(params, data);
  }

  const activeModifiers = activeViewModifiers(params);
  if (activeModifiers.length) {
    html += `<div class="info-box" style="margin-top:10px">
      <span class="info-title">Active modifiers</span>
      <div class="ps-help">${activeModifiers.join(' · ')}</div>
      <div class="seg" style="margin-top:6px"><button data-act="clearViewModifiers">Clear modifiers</button></div>
    </div>`;
  }

  // Keep camera and motion fully visible in every model. Platonic places them
  // beside the model picker above; other views retain their existing order.
  if (caps.rotate && params.view !== 'platonic') {
    html += `<div class="primary-camera-controls">${renderCameraControls(params, caps)}</div>`;
  }

  // Parametric shape deformations are optional specialist controls. Preserve
  // them at the bottom without letting them crowd out everyday navigation.
  if (params.view === 'platonic') {
    html += renderShapeMorphDisclosure(params, uiState);
  }
  if (caps.e8) html += renderE8ExploreControls(params, data, uiState);

  html += '</div>';
  return html;
}

function renderBloomControls(params) {
  const t = params.bloomAmount || 0;
  const phases = ['shape', '600-cell-inspired', '600-cell', 'two H₄ layers', 'Coxeter plane'];
  const bounds = [0, 0.10, 0.50, 0.75, 0.90, 1.0];
  const curIdx = bounds.findIndex((b, i) => t >= b && t < bounds[i + 1]);
  return `
    <div class="ps-subtitle">Bloom timeline</div>
    ${slider('Time', 'bloomAmount', t, 0, 1, 0.005, v => v.toFixed(2), 'bloomAuto')}
    <div class="seg">
      <button class="${params.bloomAuto ? 'on' : ''}" data-act="toggleBloomAuto">${params.bloomAuto ? 'Pause' : 'Auto'}</button>
      <button class="${params.h4TwinReveal ? 'on' : ''}" data-act="toggleH4TwinReveal">Twin H4</button>
      <button data-act="resetBloom" title="Reset Bloom timeline, auto-play, and Mandelbox fold">Reset</button>
    </div>
    <div class="ps-phase">${curIdx >= 0 ? phases[curIdx] : 'done'}</div>
    <div class="ps-subtitle">Mandelbox fold</div>
    <div class="seg">
      <button class="${params.bloomMandelbox ? 'on' : ''}" data-act="toggleBloomMandelbox">${params.bloomMandelbox ? 'On' : 'Off'}</button>
    </div>
    <div style="opacity:${params.bloomMandelbox ? 1 : 0.4}; transition: opacity 0.2s">
      ${slider('Scale', 'bloomMandelboxScale', params.bloomMandelboxScale ?? 2.618, 1.5, 3.5, 0.01, v => v.toFixed(2))}
      ${slider('Iterations', 'bloomMandelboxIters', params.bloomMandelboxIters ?? 6, 1, 12, 1, v => Math.round(v).toString())}
      ${slider('Mix', 'bloomMandelboxMix', params.bloomMandelboxMix ?? 0.65, 0, 1, 0.05, v => Math.round(v * 100) + '%')}
    </div>
  `;
}

function renderE8Controls(params, data, uiState = {}) {
  const mode = params.e8ViewMode || 'coxeter';
  let html = '<div class="ps-subtitle">E₈ projection</div>';
  html += '<div class="seg seg-wrap">';
  html += `<button class="${mode === 'coxeter' ? 'on' : ''}" ${pressed(mode === 'coxeter')} data-act="setE8Mode" data-arg="coxeter" title="The canonical 2D Coxeter plane projection (8 rings of 30 roots)">Coxeter</button>`;
  html += `<button class="${mode === 'petrie' ? 'on' : ''}" ${pressed(mode === 'petrie')} data-act="setE8Mode" data-arg="petrie" title="Same 2D as Coxeter but emphasizes the Petrie polygon">Petrie plane</button>`;
  html += `<button class="${mode === 'h4' ? 'on' : ''}" ${pressed(mode === 'h4')} data-act="setE8Mode" data-arg="h4" title="Two interlaced H₄ / 600-cell projections">H₄</button>`;
  // Bug fix 2026-06-25 (audit #7): was 'Rand' (unclear) — actually means
  // project by first 3 axes of R^8. New label 'Axes' is clearer.
  html += `<button class="${mode === 'ortho3d' ? 'on' : ''}" ${pressed(mode === 'ortho3d')} data-act="setE8Mode" data-arg="ortho3d" title="Project to first 3 axes of ℝ⁸ (orthogonal 3D view)">Axes</button>`;
  // And '8D' → 'Spin' for custom (user-rotation) mode.
  html += `<button class="${mode === 'custom' ? 'on' : ''}" ${pressed(mode === 'custom')} data-act="setE8Mode" data-arg="custom" title="Free 8D rotation via Spin/Tilt/Roll sliders below">Spin</button>`;
  html += '</div>';

  // Separate passive drawing guides from modes that animate or reinterpret the
  // projection. The old flat model grid hid that important distinction.
  html += '<div class="ps-subtitle overlay-title"><span>Overlays</span><button data-act="resetE8Overlays" title="Return overlays to Rings only">Reset</button></div>';
  html += '<div class="overlay-group-label">Structure guides</div>';
  html += '<div class="overlay-structure-grid">';
  html += overlayOption('Rings', '8 shells', params.showRings, 'toggleRings');
  html += overlayOption('Edges', 'root graph', params.showEdges, 'toggleEdges');
  html += overlayOption('Petrie path', '30-cycle', params.showPetrie, 'togglePetrie', 'Real Hamiltonian 30-cycle in the E₈ edge graph');
  html += '</div>';
  html += '<div class="overlay-group-label">Symmetry &amp; motion</div>';
  html += '<div class="overlay-explorer-grid">';
  html += overlayOption('Root diffusion', 'distance wave', params.rootDiffusion, 'toggleRootDiffusion', 'Animate graph-distance halos from the selected root');
  html += overlayOption('Weyl mirrors', 'reflection axes', params.showWeylMirrors, 'toggleWeylMirrors', 'Show simple-reflection mirror lines');
  html += overlayOption('Twin H₄', 'paired 600-cells', params.e8Twin600, 'toggleE8Twin600', 'Color the two projected H₄ layers used by this view');
  html += overlayOption('Auto atlas', 'cycle projections', params.e8ProjectionAuto, 'toggleProjectionAuto', 'Cycle through the projection atlas');
  html += '</div>';
  if (params.rootDiffusion) {
    html += slider('Halo depth', 'rootHaloDepth', params.rootHaloDepth || 3, 1, 5, 1, v => Math.round(v).toString());
    html += slider('Wave speed', 'rootDiffusionSpeed', params.rootDiffusionSpeed || 1.25, 0.2, 4, 0.05, v => v.toFixed(2));
  }

  if (mode === 'custom') {
    html += '<div style="font-size:10px;color:var(--ink-2);margin:6px 0 4px">Rotate in 8D (ℝ⁸) → reproject to 3D</div>';
    html += slider('Spin', 'e8Spin', params.e8Spin || 0, -3.14, 3.14, 0.01, v => v.toFixed(2));
    html += slider('Tilt', 'e8Tilt', params.e8Tilt || 0, -3.14, 3.14, 0.01, v => v.toFixed(2));
    html += slider('Roll', 'e8Roll', params.e8Roll || 0, -3.14, 3.14, 0.01, v => v.toFixed(2));
    html += '<div class="seg">';
    html += `<button class="${params.e8AutoRotate ? 'on' : ''}" ${pressed(params.e8AutoRotate)} data-act="toggleE8AutoRotate">${params.e8AutoRotate ? 'Pause' : 'Anim 8D'}</button>`;
    html += `<button data-act="resetE8Angles">Reset</button>`;
    html += '</div>';
  }

  return html;
}

function renderE8ExploreControls(params, data, uiState = {}) {
  const exploreOpen = uiState.openDisclosures?.has('e8-explore')
    || (params.compareMode || 'off') !== 'off';
  let html = `<details class="control-disclosure" data-panel-disclosure="e8-explore" ${exploreOpen ? 'open' : ''}>
    <summary id="panel-disclosure-e8-explore"><span>Compare &amp; inspect roots</span><small>subsets · inspector · root browser</small></summary>
    <div class="control-disclosure-body">`;
  html += '<div class="ps-subtitle">Compare subset</div>';
  html += '<div class="seg seg-wrap">';
  for (const name of SHAPES) {
    html += `<button class="${(params.compareShape || 'dodecahedron') === name ? 'on' : ''}" ${pressed((params.compareShape || 'dodecahedron') === name)} data-act="setCompareShape" data-arg="${name}" title="Compare ${name}">${shapeShort(name)}</button>`;
  }
  html += '</div>';
  html += '<div class="seg seg-wrap">';
  for (const modeName of ['off', 'overlay', 'intersection', 'difference']) {
    const label = modeName === 'intersection' ? 'intersect' : modeName === 'difference' ? 'diff' : 'overlay';
    const display = modeName === 'off' ? 'off' : label;
    html += `<button class="${(params.compareMode || 'off') === modeName ? 'on' : ''}" ${pressed((params.compareMode || 'off') === modeName)} data-act="setCompareMode" data-arg="${modeName}" title="${modeName}">${display}</button>`;
  }
  html += '</div>';
  if ((params.compareMode || 'off') !== 'off') html += `<div class="compare-legend">
    <div><span class="compare-dot" style="background:var(--accent)"></span>${params.shape} primary</div>
    <div><span class="compare-dot" style="background:var(--accent-4)"></span>${params.compareShape || 'dodecahedron'} compare</div>
  </div>`;
  html += toggle('Inspector', params.showInspector !== false, 'toggleRootInspector');

  const subsetName = params.rootSubset || 'icosahedron';
  const subset = subsetName === 'simple_roots'
    ? (data.e8_math?.simple_root_indices || [])
    : (data.mckay_subsets?.[subsetName] || []);
  const subsetPosition = subset.indexOf(params.pickedRoot);
  html += '<div class="ps-subtitle">Root browser</div>';
  html += '<div class="seg seg-wrap">';
  for (const [id, label] of [['icosahedron', 'Icosa'], ['dodecahedron', 'Dodeca'], ['simple_roots', 'Simple α']]) {
    html += `<button class="${subsetName === id ? 'on' : ''}" ${pressed(subsetName === id)} data-act="setRootSubset" data-arg="${id}">${label}</button>`;
  }
  html += '</div>';
  html += `<div class="ps-help root-browser-summary">${subset.length} roots · ${subsetPosition >= 0 ? `${subsetPosition + 1} / ${subset.length} · root #${params.pickedRoot}` : 'choose a root'}</div>`;
  html += '<div class="seg seg-wrap">';
  html += '<button data-act="firstSubsetRoot">First</button>';
  html += '<button data-act="stepSubsetRoot" data-arg="-1" aria-label="Previous subset root">← Prev</button>';
  html += '<button data-act="stepSubsetRoot" data-arg="1" aria-label="Next subset root">Next →</button>';
  html += '<button data-act="frameRootSubset">Frame subset</button>';
  html += '</div>';
  html += '<div class="seg seg-wrap">';
  html += '<button data-act="jumpRoot" data-arg="alpha">α₁</button>';
  html += '<button data-act="jumpRoot" data-arg="neighbor">Neighbor</button>';
  html += '<button data-act="jumpRoot" data-arg="opposite">Opposite</button>';
  html += '<button data-act="jumpRoot" data-arg="random">Random</button>';
  html += '</div>';
  html += '</div></details>';
  return html;
}

function overlayOption(label, detail, active, action, title = '') {
  return `<button class="overlay-option ${active ? 'on' : ''}" ${pressed(active)} data-act="${action}"${title ? ` title="${title}"` : ''}>
    <span class="overlay-indicator" aria-hidden="true"></span>
    <span class="overlay-copy"><strong>${label}</strong><small>${detail}</small></span>
  </button>`;
}

function renderSDFControls(params, data) {
  let html = '<div class="ps-subtitle">SDF shape</div>';
  html += '<div class="ps-help">The global Render quality selector above also changes this view’s raymarch budget.</div>';
  html += slider('Sphere radius', 'sdfSphereR', params.sdfSphereR ?? 0.08, 0.02, 0.15, 0.005, v => v.toFixed(3));
  html += slider('Blend (smin)', 'sdfBlend', params.sdfBlend ?? 0.03, 0.0, 0.12, 0.005, v => v.toFixed(3));
  html += slider('Highlight bloom', 'sdfBloom', params.sdfBloom ?? 0.5, 0, 1, 0.05, v => Math.round(v * 100) + '%');
  html += slider('Aniso spec', 'sdfAniso', params.sdfAniso ?? 0.6, 0, 1, 0.05, v => Math.round(v * 100) + '%');
  html += slider('Edge cylinders', 'sdfEdges', params.sdfEdges ?? 0.3, 0, 1, 0.05, v => Math.round(v * 100) + '%');
  return html;
}

function renderPolytopeControls(params, data) {
  const polys = data.polytopes4d || {};
  const preferredOrder = ['5cell', 'tesseract', '16cell', '24cell', '120cell', '600cell'];
  const polyKeys = [
    ...preferredOrder.filter(key => polys[key]),
    ...Object.keys(polys).filter(key => !preferredOrder.includes(key)),
  ];
  let html = '<div class="ps-subtitle">Polytope</div>';
  html += '<div class="seg seg-wrap">';
  for (const k of polyKeys) {
    html += `<button class="${params.poly4d === k ? 'on' : ''}" ${pressed(params.poly4d === k)} data-act="setPoly4d" data-arg="${k}">${k}</button>`;
  }
  html += '</div>';
  html += toggle('Vertex nodes', !!params.showVertices, 'toggleVertices');
  html += '<div class="ps-subtitle">4D projection</div>';
  html += '<div class="ps-help">Change how strongly the fourth coordinate affects the 3D projection.</div>';
  html += slider('4D depth', 'morph4d', params.morph4d || 0, -2, 2, 0.01, v => v.toFixed(2));
  html += '<div class="ps-subtitle">4D motion</div>';
  html += slider('Rotation speed', 'polyRotationSpeed', params.polyRotationSpeed ?? 0.18, 0.04, 0.6, 0.01, v => v.toFixed(2));
  html += '<div class="seg">';
  html += `<button class="${params.polyAutoRotate ? 'on' : ''}" data-act="togglePolyAutoRotate">${params.polyAutoRotate ? 'Pause 4D' : 'Animate 4D'}</button>`;
  html += '<button data-act="resetPolyAngles">Reset angles</button>';
  html += '</div>';
  html += '<div class="ps-subtitle">Rotation planes</div>';
  html += '<div class="ps-help">Each slider rotates through one coordinate plane of four-dimensional space.</div>';
  html += slider('XY plane', 'polyRotXY', params.polyRotXY || 0, -3.14, 3.14, 0.01, v => v.toFixed(2), 'polyAutoRotate');
  html += slider('ZW plane', 'polyRotZW', params.polyRotZW || 0, -3.14, 3.14, 0.01, v => v.toFixed(2), 'polyAutoRotate');
  html += slider('XZ plane', 'polyRotXZ', params.polyRotXZ || 0, -3.14, 3.14, 0.01, v => v.toFixed(2), 'polyAutoRotate');
  html += slider('YW plane', 'polyRotYW', params.polyRotYW || 0, -3.14, 3.14, 0.01, v => v.toFixed(2), 'polyAutoRotate');
  html += slider('XW plane', 'polyRotXW', params.polyRotXW || 0, -3.14, 3.14, 0.01, v => v.toFixed(2), 'polyAutoRotate');
  html += slider('YZ plane', 'polyRotYZ', params.polyRotYZ || 0, -3.14, 3.14, 0.01, v => v.toFixed(2), 'polyAutoRotate');
  return html;
}

// ── Section 2: VISUALS ──
function renderStyleSection(params, data, uiState = {}) {
  const caps = viewCapabilities(params.view);
  const quality = params.reducedMode ? 'low' : (params.mobileQuality || 'high');
  let html = '<div class="ps-section" data-section="style"><div class="ps-title">Visuals</div>';

  // Background establishes the canvas before color and effects are layered on.
  html += '<div class="ps-subtitle">Background</div><div class="seg seg-wrap">';
  for (const m of backgroundModesForQuality(quality)) {
    const background = BACKGROUND_PRESETS[m];
    html += `<button class="${params.bgMode === m ? 'on' : ''}" ${pressed(params.bgMode === m)} data-act="setBgMode" data-arg="${m}" title="${background.description} · ${background.quality} quality">${background.label}</button>`;
  }
  html += '</div>';
  html += slider('Brightness', 'bgIntensity', params.bgIntensity ?? 0.7, 0, 1.5, 0.05, v => Math.round(v * 100) + '%');

  // Keep the full color catalog together rather than splitting it into
  // subjective named families.
  html += '<div class="ps-subtitle">Palette</div>';
  const activePalette = PALETTE_PRESETS[params.palette] || PALETTE_PRESETS.gold;
  html += `<div class="palette-active-preview" style="background:${palettePreviewCSS(params.palette, 'spectrum')}">
    <span>${params.palette.replaceAll('_', ' ')}</span>
    <small>${activePalette.description}</small>
  </div>`;
  const paletteKeys = Object.keys(PALETTE_PRESETS);
  const paletteExpanded = !!uiState.paletteExpanded;
  let visiblePalettes = paletteExpanded ? paletteKeys : paletteKeys.slice(0, 18);
  if (!paletteExpanded && !visiblePalettes.includes(params.palette)) {
    visiblePalettes = [...visiblePalettes.slice(0, -1), params.palette];
  }
  html += `<div class="swatch-grid all-swatches" id="desktop-palette-grid" aria-label="Color palettes">`;
  for (const k of visiblePalettes) {
    html += `<button class="swatch ${params.palette === k ? 'active' : ''}"
      style="background:${palettePreviewCSS(k, 'spectrum')}"
      ${pressed(params.palette === k)} data-act="setPalette" data-arg="${k}" title="${k.replaceAll('_', ' ')} — ${PALETTE_PRESETS[k].description}"
      aria-label="Use ${k.replaceAll('_', ' ')} palette"></button>`;
  }
  html += '</div>';
  html += `<button class="palette-expand" data-panel-act="togglePaletteExpanded" aria-expanded="${paletteExpanded}" aria-controls="desktop-palette-grid">${paletteExpanded ? 'Collapse palettes' : `Expand all ${paletteKeys.length} palettes`}</button>`;

  // Animated palette changes are a primary creative control, not an advanced
  // option, so they follow the static palette picker directly.
  html += '<div class="ps-subtitle">Color shift</div><div class="seg seg-wrap">';
  for (const k of Object.keys(SHIFT_PRESETS)) {
    html += `<button class="${(params.shiftMode || 'static') === k ? 'on' : ''}" ${pressed((params.shiftMode || 'static') === k)} data-act="setShiftMode" data-arg="${k}">${k}</button>`;
  }
  html += '</div>';
  if ((params.shiftMode || 'static') !== 'static') {
    html += slider('Cycle', 'shiftSpeed', Math.max(4, params.shiftSpeed || 12), 4, 120, 1, v => {
      const n = Math.round(v);
      if (n < 60) return n + 's';
      const m = Math.floor(n / 60);
      const s = n % 60;
      return s === 0 ? m + 'm' : m + 'm ' + s + 's';
    });
  }

  if (caps.coloring) {
    html += '<div class="ps-subtitle">Color by</div><div class="seg seg-wrap">';
    for (const k of Object.keys(COLORINGS)) {
      html += `<button class="${(params.colorBy || 'shell') === k ? 'on' : ''}" ${pressed((params.colorBy || 'shell') === k)} data-act="setColorBy" data-arg="${k}" title="${COLORINGS[k]}">${k}</button>`;
    }
    html += '</div>';
  }

  if (params.view === 'quasicrystal') {
    html += '<div class="ps-subtitle">Clean render</div><div class="ps-help">Effects are disabled in the Quasicrystal Lab. Its lightweight point-and-link renderer keeps the full E8 patch responsive; palettes and color shift remain available.</div>';
  } else {
    html += '<div class="ps-subtitle">Effects</div><div class="ps-help">Effects supported by this view are shown here. Cost badges indicate approximate GPU work.</div>';
    html += '<div class="fx-catalog-grid">';
    for (const item of effectsForView(params.view, quality, { includeUnavailable: true })) {
      const available = effectAvailableForQuality(item.id, quality);
      const unavailableTitle = available ? item.description : `${item.description} Requires a higher quality tier.`;
      html += `<button class="fx-catalog-item ${params.fxMode === item.id ? 'on' : ''} ${available ? '' : 'unavailable'}"
        ${pressed(params.fxMode === item.id)} data-act="setFX" data-arg="${item.id}" title="${unavailableTitle}" ${available ? '' : 'disabled'}>
        <span>${item.label}</span><small class="fx-cost fx-cost-${item.cost}">${item.cost}</small>
      </button>`;
    }
    html += '</div>';
    html += slider('Strength', 'fxIntensity', params.fxIntensity ?? 0.5, 0, 1, 0.05, v => Math.round(v * 100) + '%');
    html += toggle('FX shift', !!params.autoFx, 'toggleFXShift');
    if (params.autoFx) {
      html += slider('FX interval', 'fxShiftInterval', params.fxShiftInterval ?? 3.2, 2, 20, 0.2, v => `${v.toFixed(1)}s`);
    }
    if (params.view === 'raymarched') {
      html += '<div class="ps-help">All catalog effects use native raymarched surface treatments in SDF view.</div>';
    }
  }

  if (params.view !== 'raymarched') {
    html += slider('Point size', 'pointScale', params.pointScale ?? 1, 0.7, 1.8, 0.05, v => `${Math.round(v * 100)}%`);
  }
  if (caps.lighting !== false || params.view === 'e8coxeter' || params.view === 'bloom') {
    html += slider('Opacity', 'opacity', params.opacity ?? 0.9, 0.1, 1, 0.05, v => Math.round(v * 100) + '%');
  }
  if (caps.lighting) {
    html += '<div class="ps-subtitle">Mesh lighting</div>';
    html += slider('Ambient', 'lightAmbient', params.lightAmbient ?? 0.55, 0, 2, 0.05, v => v.toFixed(2));
    html += slider('Key', 'lightKey', params.lightKey ?? 1.2, 0, 3, 0.05, v => v.toFixed(2));
    html += slider('Fill', 'lightFill', params.lightFill ?? 0.6, 0, 2, 0.05, v => v.toFixed(2));
    html += slider('Accent', 'lightAccent', params.lightAccent ?? 1.0, 0, 3, 0.05, v => v.toFixed(2));
  }

  if (params.view !== 'quasicrystal') {
    // The six curated looks are shortcuts into the effect catalog. Keeping them
    // near the bottom makes them optional accelerators rather than the hierarchy.
    html += '<div class="ps-subtitle">Quick looks</div>';
    html += '<div class="look-grid">';
    for (const look of CURATED_LOOKS) {
      if (!effectAvailableForView(params.view, look.mode, quality)) continue;
      const item = FX_BY_ID[look.mode];
      html += `<button class="look-card ${params.fxMode === look.mode ? 'on' : ''}" ${pressed(params.fxMode === look.mode)} data-act="setFX" data-arg="${look.mode}" title="${item.description}">
        <span>${look.label}</span><small>${look.description}</small>
      </button>`;
    }
    html += '</div>';
  }

  // Theme affects the interface chrome rather than the artwork, so it comes
  // after all scene-facing appearance controls.
  html += '<div class="ps-subtitle">Interface theme</div><div class="seg seg-wrap">';
  for (const tname of Object.keys(THEMES)) {
    const label = THEME_LABELS[tname] || tname;
    html += `<button class="${params.theme === tname ? 'on' : ''}" ${pressed(params.theme === tname)} data-act="setTheme" data-arg="${tname}" title="Changes interface chrome only">${label}</button>`;
  }
  html += '</div>';

  const exportFormats = exportFormatsForView(params.view);
  html += '<div class="ps-subtitle">Export</div><div class="seg seg-wrap">';
  if (exportFormats.includes('png')) html += '<button data-act="exportHighResPNG" data-arg="2" title="High-resolution image of this view">PNG</button>';
  if (exportFormats.includes('svg')) html += '<button data-act="exportSVG" title="Scalable vector diagram of this view">SVG</button>';
  if (exportFormats.includes('obj')) html += '<button data-act="exportOBJ" title="Wavefront geometry for this view">OBJ</button>';
  if (exportFormats.includes('data')) html += '<button data-act="exportGeometryJSON" title="Canonical model data as JSON">Data</button>';
  html += '</div>';

  html += '</div>';
  return html;
}

// ── Section 3: MATH ──
function renderMathSection(params, data) {
  const caps = viewCapabilities(params.view);
  if (!caps.math) return '';  // no math section for this view

  const subject = caps.math === 'e8' ? 'the E₈ root system'
    : caps.math === '600' ? 'the 600-cell'
    : caps.math === 'dynkin' ? 'the selected Dynkin diagram'
    : caps.math === 'rootlab' ? 'the selected rank-2 root system'
    : caps.math === 'tiling' ? 'the selected Coxeter multigrid'
    : caps.math === 'quasicrystal' ? 'the E8 cut-and-project construction'
    : 'the selected solid';
  let html = `<div class="ps-section" data-section="math"><div class="ps-title">Math lab</div>
    <div class="ps-help learn-math-intro">Interactive details for ${subject}. Change the active View to open a different lab.</div>`;

  if (caps.math === 'e8') {
    html += `<div class="info-box">
      <span class="info-title">E₈ root system</span>
      Rank 8 · dim 248 · Weyl 696,729,600<br>
      Coxeter h = 30<br>
      240 roots on 8 rings (${data.e8?.ring_counts?.join('+') || '?'} = 240)
    </div>`;
    // ── Weyl orbit controls (moved from VIEW section) ──
    html += `<div class="info-box" style="margin-top:8px">
      <span class="info-title">Weyl orbit trail</span>
      <div style="font-size:10px;color:var(--ink-2);margin:4px 0 6px">
        Animate a root β walking random simple reflections<br>
        through the W(E₈) group of 696,729,600 elements.
      </div>
      <div class="seg">
        <button class="${params.weylOrbit ? 'on' : ''}" data-act="toggleWeylOrbit">${params.weylOrbit ? 'Stop' : 'Start'}</button>
        <button class="${params.weylOrbitFast ? 'on' : ''}" data-act="toggleWeylFast">Fast</button>
      </div>
      ${params.weylOrbit ? `<div style="font-size:10px;color:var(--accent);margin-top:6px;font-family:'JetBrains Mono',monospace">
        seed: [${(params.weylSeed || [1,-1,0,0,0,0,0,0]).join(',')}]<br>
        word: ${(params._weylWord || []).map(w => 's<sub>' + (w+1) + '</sub>').join(' · ') || '—'}<br>
        steps: ${params._weylSteps || 0}
      </div>` : ''}
    </div>`;
    html += `<div class="info-box" style="margin-top:8px">
      <span class="info-title">Cartan matrix</span>
      <div style="font-size:10px;color:var(--ink-2);margin-bottom:4px">Click two simple roots</div>
      <div class="seg" style="margin-bottom:6px">
        <button class="${params.cartanHighlight ? 'on' : ''}" data-act="toggleCartanHighlight">${params.cartanHighlight ? 'Highlight on' : 'Highlight off'}</button>
      </div>
      ${renderCartanMatrix(params)}
      ${params.cartanHighlight && params.cartanSelection?.[0] != null && data.e8_math?.cartan_neighbors?.[`alpha${params.cartanSelection[0]+1}`] ?
        `<div style="font-size:10px;color:var(--accent);margin-top:6px">
          α${params.cartanSelection[0]+1} has ${data.e8_math.cartan_neighbors[`alpha${params.cartanSelection[0]+1}`].count} Cartan neighbors
          (each E₈ root has exactly 56)
        </div>` : ''}
    </div>`;
    html += `<div class="info-box" style="margin-top:8px">
      <span class="info-title">Lie brackets [eαᵢ, eαⱼ]</span>
      ${renderBrackets(params)}
    </div>`;
    // Pick inspector: shown when a root is clicked.
    if (params.showInspector !== false && params.pickedRoot != null) {
      const pickIdx = params.pickedRoot;
      const pickInfo = data.e8_math?.cartan_neighbors?.[`alpha${pickIdx+1}`] ||
                       (() => {
                         // Use the live adjacency from the 240 roots
                         return { idx: pickIdx, neighbors: [], count: 0 };
                       })();
      // Compute the 8D coords for display
      const r = data.e8?.roots8d?.[pickIdx];
      const rstr = r ? `(${r.map(x => x.toFixed(2)).join(', ')})` : '?';
      const ipw = r ? `|β|² = ${r.reduce((s, x) => s + x*x, 0).toFixed(2)}` : '';
      const ring = data.e8?.proj2d?.[pickIdx]?.ring ?? '?';
      const memberships = [];
      for (const name of SHAPES) {
        if ((data.mckay_subsets?.[name] || []).includes(pickIdx)) memberships.push(name);
      }
      let neighborCount = pickInfo.count || 0;
      if (r && !neighborCount) {
        for (const other of data.e8?.roots8d || []) {
          let ip = 0;
          for (let k = 0; k < 8; k++) ip += r[k] * other[k];
          if (Math.abs(ip + 1) < 1e-9) neighborCount++;
        }
      }
      const inPrimary = (data.mckay_subsets?.[params.shape] || []).includes(pickIdx);
      const inCompare = (data.mckay_subsets?.[params.compareShape || 'dodecahedron'] || []).includes(pickIdx);
      const distanceCounts = params._rootDistanceCounts || {};
      let entryHTML = '';
      if (params.cartanEntry) {
        const ce = params.cartanEntry;
        // The Weyl word A→B is computed lazily in main.js when the button is
        // clicked. Only show the word line if the cached word matches the
        // CURRENT pair (so a new two-root pick doesn't show a stale word).
        const wordMatches = params.weylWord && params.weylWordFrom === ce.from && params.weylWordTo === ce.to;
        const weylLine = wordMatches
          ? `<div style="font-size:10px;color:var(--accent-4);margin-top:3px">
               Weyl path α${ce.from+1}→α${ce.to+1}: <b>${params.weylWordStr}</b>
               <span style="color:var(--ink-2)">(${params.weylWord.length} reflections)</span>
             </div>`
          : '';
        entryHTML = `<div style="font-size:10px;color:var(--accent);margin-top:4px">
          <b>⟨α${ce.from+1}, α${ce.to+1}⟩ = ${ce.innerProduct}</b><br>
          ${ce.relation}
        </div>
        ${weylLine}
        <div class="seg" style="margin-top:4px">
          <button data-act="animateWeylPath">${wordMatches ? 'Replay' : 'Show Weyl path'} α${ce.from+1}→α${ce.to+1}</button>
        </div>`;
      }
      html += `<div class="info-box" style="margin-top:8px;border:1px solid var(--accent)">
        <span class="info-title">Pick: root #${pickIdx}</span>
        <div class="inspector-grid">
          <span>ring</span><b>${ring}</b>
          <span>norm</span><b>${ipw || '?'}</b>
          <span>neighbors</span><b>${neighborCount}</b>
          <span>halo</span><b>${Object.keys(distanceCounts).length ? Object.entries(distanceCounts).map(([d, n]) => `d${d}:${n}`).join(' ') : 'off'}</b>
          <span>primary</span><b>${inPrimary ? params.shape : 'no'}</b>
          <span>compare</span><b>${inCompare ? (params.compareShape || 'dodecahedron') : 'no'}</b>
          <span>McKay</span><b>${memberships.join(', ') || 'root-only'}</b>
        </div>
        <div style="font-size:10px;font-family:'JetBrains Mono',monospace;color:var(--ink-1);margin-top:6px">
          ${rstr}
        </div>
        ${entryHTML}
        <div class="seg" style="margin-top:6px">
          <button data-act="clearPick">Clear pick</button>
        </div>
      </div>`;
    }
  } else if (caps.math === 'rootlab') {
    const system = generateRank2RootSystem(params.rootSystem);
    const matrixValue = value => Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '');
    const matrixRows = system.cartanMatrix.map(row => `<tr>${row.map(value => `<td>${matrixValue(value)}</td>`).join('')}</tr>`).join('');
    html += `<div class="info-box root-lab-info">
      <span class="info-title">${system.label} · ${system.name}</span>
      Rank <b>2</b> · ${system.rootCount} roots · Coxeter number <b>${system.coxeterNumber}</b><br>
      ${system.chamberCount} reflection chambers · family <b>${system.family}</b><br>
      ${system.crystallographic ? 'Crystallographic' : 'Non-crystallographic'}${system.longToShortRatio > 1 ? ` · long/short = √${Math.round(system.longToShortRatio ** 2)}` : ' · equal root lengths'}
    </div>`;
    html += `<div class="info-box" style="margin-top:8px">
      <span class="info-title">What the construction shows</span>
      <div class="ps-help">${system.description}</div>
      The two gold simple roots generate every displayed root by repeated reflection. Their mirrors bound a fundamental chamber; composing the two reflections produces the ${system.coxeterNumber}-step orbit.
    </div>`;
    html += `<div class="info-box" style="margin-top:8px">
      <span class="info-title">${system.crystallographic ? 'Cartan matrix' : 'Generalized reflection matrix'}</span>
      <div class="cartan-scroll"><table class="dynkin-cartan" aria-label="${system.id} reflection matrix"><tbody>${matrixRows}</tbody></table></div>
      ${system.goldenRatio ? `<div class="ps-help">The off-diagonal value is −φ, where φ = ${(system.goldenRatio).toFixed(6)}. This is why H₂ connects naturally to pentagonal and Penrose geometry.</div>` : ''}
    </div>`;
  } else if (caps.math === 'tiling') {
    const tiling = generateCoxeterTiling(params.tilingSystem, { density: params.tilingDensity });
    const typeRows = Object.entries(tiling.tileTypeCounts)
      .map(([angle, count]) => `<div class="class-row"><span class="class-dot" style="background:${colorAt(params.palette, Number.parseFloat(angle) / 90)}"></span><span class="class-label"><b>${angle}</b> rhombi</span><span class="class-size">${count}</span></div>`)
      .join('');
    html += `<div class="info-box root-lab-info">
      <span class="info-title">${tiling.label} · ${tiling.name}</span>
      ${tiling.familyCount} line families · ${tiling.order}-fold local order · ${tiling.tileCount} rhombi<br>
      <b>${tiling.periodic ? 'Periodic' : 'Quasiperiodic'}</b> at equal grid spacing
    </div>`;
    html += `<div class="info-box" style="margin-top:8px">
      <span class="info-title">From roots to tiles</span>
      <div class="ps-help">The unoriented roots become normals for parallel line families. Every crossing of two families is dualized into one rhombus whose edges follow those two root directions.</div>
      ${typeRows}
    </div>`;
    html += `<div class="info-box" style="margin-top:8px">
      <span class="info-title">Why symmetry does not force repetition</span>
      Local rotational order describes the patches around points; periodicity asks whether one translation repeats the entire plane. ${tiling.periodic ? 'The three-family A₂ construction has both.' : `The ${tiling.familyCount}-family ${tiling.label} field keeps its local order without a global repeating translation.`}
      ${tiling.goldenRatio ? `<div class="ps-help">H₂ produces 36° and 72° rhombi. Their diagonal relationships contain φ ≈ ${tiling.goldenRatio.toFixed(6)}, connecting the pentagrid to Penrose geometry.</div>` : ''}
    </div>`;
  } else if (caps.math === 'quasicrystal') {
    const patch = generateE8Quasicrystal(data.e8, {
      maxNormSq: params.quasiReach,
      windowRadius: params.quasiWindow,
      phason: params.quasiPhason,
      includeDiffraction: false,
      includeEdges: false,
    });
    html += `<div class="info-box root-lab-info">
      <span class="info-title">E8 cut-and-project set</span>
      Source lattice <b>8D</b> · visible plane <b>2D</b> · hidden space <b>6D</b><br>
      ${patch.pointCount} accepted from ${patch.candidateCount} finite candidates · <b>30-fold</b> Coxeter order
    </div>`;
    html += `<div class="info-box" style="margin-top:8px">
      <span class="info-title">How the cut works</span>
      <div class="ps-help">Every E8 lattice point splits into a visible Coxeter-plane component x∥ and a perpendicular component x⊥. The Studio draws x∥ only when x⊥ lies inside the acceptance window.</div>
      Moving the Phason control translates that hidden window. Points enter and leave the visible patch without turning the result into a periodic lattice.
    </div>`;
    html += `<div class="info-box" style="margin-top:8px">
      <span class="info-title">Three readings of one construction</span>
      <b>Pattern</b> shows accepted points and a display-only local proximity graph.<br>
      <b>Window</b> shows two readable coordinates of the six-dimensional acceptance test.<br>
      <b>Diffraction</b> evaluates reciprocal candidates from E8's 240-root shell; bright peaks expose long-range order.
      <div class="ps-help">The spherical acceptance window is an explicit Studio visualization choice, not a claim of a unique canonical E8 quasicrystal window.</div>
    </div>`;
  } else if (caps.math === 'dynkin') {
    const diagram = data.dynkin?.[params.dynkin];
    const rank = diagram?.nodes?.length || 0;
    const edgeSet = new Set((diagram?.edges || []).flatMap(([a, b]) => [`${a}:${b}`, `${b}:${a}`]));
    const degrees = Array.from({ length: rank }, (_, node) =>
      (diagram?.edges || []).filter(edge => edge.includes(node)).length);
    const branchNode = degrees.findIndex(degree => degree >= 3);
    const matrixRows = Array.from({ length: rank }, (_, row) =>
      `<tr>${Array.from({ length: rank }, (_, column) => {
        const value = row === column ? 2 : edgeSet.has(`${row}:${column}`) ? -1 : 0;
        return `<td>${value}</td>`;
      }).join('')}</tr>`).join('');
    html += `<div class="info-box">
      <span class="info-title">${escapeHtml(diagram?.name || params.dynkin)} finite diagram</span>
      Rank <b>${rank}</b> · ${diagram?.edges?.length || 0} bonds · simply-laced<br>
      ${branchNode >= 0 ? `Branch node: <b>α${branchNode + 1}</b> (degree ${degrees[branchNode]})` : 'Unbranched chain'}
    </div>`;
    html += `<div class="info-box" style="margin-top:8px">
      <span class="info-title">Cartan matrix from the graph</span>
      <div class="ps-help">2 on the diagonal, −1 across a bond, and 0 otherwise.</div>
      <div class="cartan-scroll"><table class="dynkin-cartan" aria-label="${escapeHtml(params.dynkin)} Cartan matrix"><tbody>${matrixRows}</tbody></table></div>
    </div>`;
  } else if (caps.math === '600') {
    const sizes = [1, 12, 20, 12, 30, 12, 20, 12, 1];
    const labels = ['identity', 'class A', 'class B', 'class C', 'class D', 'class E', 'class F', 'class G', 'central antipode'];
    html += '<div class="info-box"><span class="info-title">Binary icosahedral conjugacy classes</span><div class="ps-help">Quaternion and SO(3) angles use a double-cover convention, so this view labels classes by size instead of conflating the two angles.</div>';
    for (let c = 0; c < sizes.length; c++) {
      html += `<div class="class-row">
        <span class="class-dot" style="background:${classSwatch(c)}"></span>
        <span class="class-label"><b>C${c + 1}</b> · ${labels[c]}</span>
        <span class="class-size">${sizes[c]}</span>
      </div>`;
    }
    html += '</div>';
  } else if (caps.math === 'platonic') {
    // Round 10: stellations get their own info box with Schläfli symbol + counts.
    const isStellation = STELLATION_INFO[params.shape];
    if (isStellation) {
      const chi = isStellation.verts - isStellation.edges + isStellation.faces;
      html += `<div class="info-box">
        <span class="info-title">${isStellation.name}</span>
        Schläfli symbol: <b>${isStellation.schlafli}</b><br>
        ${isStellation.verts} vertices · ${isStellation.edges} edges · ${isStellation.faces} ${isStellation.faceType} faces<br>
        V − E + F = <b>${chi}</b> · H₃ symmetry (order 120) · ${isStellation.discoverer}
      </div>`;
    } else {
      const s = data.platonic?.[params.shape];
      const m = data.mckay?.[params.shape];
      if (s) {
        html += `<div class="info-box">
          <span class="info-title">${params.shape}</span>
          ${s.verts.length} vertices · ${s.edges.length} edges<br>
          McKay → <b>${m?.roots || '?'}</b> (symmetry ${m?.symmetry || '?'})
        </div>`;
      }
    }
  }

  html += '</div>';
  return html;
}

// Registry of per-slider value formatters, keyed by param. Populated by slider()
// on each render and read by the delegated 'input' handler (see main.js) so the
// live label can update without an inline oninput (CSP: no 'unsafe-inline').
export const SLIDER_FMT = {};
// Registry of per-slider {min,max}, used by the per-slider AUTO animator in the
// main loop (which sliders are auto-driven is params.autoSliders).
export const SLIDER_META = {};

/** Format a slider's current value for its label. */
export function formatSliderValue(paramKey, value) {
  const fn = SLIDER_FMT[paramKey];
  return fn ? fn(value) : String(value);
}

// Set of param keys currently auto-animated — refreshed from params on each
// render so slider() can show the ⟳ toggle in its active state.
let _autoSliders = new Set();

// ── Helper: slider HTML ──
// Round 9 facelift: each slider sets a --fill CSS variable (percentage) so the
// accent-colored track fill in style.css renders without extra JS per frame.
// `off`, when given, is a companion param the input handler sets false on drag
// (e.g. nudging a rotation slider turns its auto-rotate off).
function slider(label, paramKey, value, min, max, step, formatFn, off, options = {}) {
  SLIDER_FMT[paramKey] = formatFn;
  SLIDER_META[paramKey] = { min, max };
  const displayValue = options.invert ? min + max - value : value;
  const fillPct = max > min ? ((displayValue - min) / (max - min)) * 100 : 0;
  const fillStyle = `style="--fill:${Math.max(0, Math.min(100, fillPct)).toFixed(1)}%"`;
  const offAttr = off ? ` data-off="${off}"` : '';
  const invertAttr = options.invert ? ' data-invert="true"' : '';
  // ⟳ auto-animate toggle: when on, the main loop oscillates this param between
  // min and max. Several can run at once for generative mix-and-match motion.
  const auto = _autoSliders.has(paramKey);
  return `<div class="control-row">
    <label class="control-label" for="slider-${paramKey}">${label}</label>
    <input type="range" id="slider-${paramKey}" data-param="${paramKey}"${offAttr}${invertAttr} min="${min}" max="${max}" step="${step}" value="${displayValue}" ${fillStyle}>
    <span class="control-value" id="slider-val-${paramKey}">${formatFn(value)}</span>
    <button class="slider-auto ${auto ? 'on' : ''}" ${pressed(auto)} data-act="toggleSliderAuto" data-arg="${paramKey}" title="Auto-animate this slider" aria-label="Auto-animate ${label}">⟳</button>
  </div>`;
}

// ── Helper: toggle button ──
// `act` is a window.__app method name, dispatched via the delegated click
// handler (data-act) so no inline onclick is emitted (CSP: no 'unsafe-inline').
function toggle(label, value, act) {
  return `<div class="control-row ps-toggle-row">
    <span class="control-label">${label}</span>
    <button class="ps-toggle-button ${value ? 'on' : ''}" ${pressed(value)} data-act="${act}" aria-label="${label}: ${value ? 'on' : 'off'}">
      <span class="ps-toggle-track" aria-hidden="true"><span class="ps-toggle-thumb"></span></span>
      <span class="ps-toggle-state">${value ? 'On' : 'Off'}</span>
    </button>
  </div>`;
}

function renderLearnSection(params) {
  const learning = (typeof window !== 'undefined' && window.__app?.getLearningState?.()) || null;
  const rootSystem = params.view === 'rootlab' ? generateRank2RootSystem(params.rootSystem) : null;
  const curiosity = rootSystem ? {
    title: 'From two reflections to a root system',
    body: `The two simple roots of ${rootSystem.label} generate all ${rootSystem.rootCount} roots. Compare A₂, B₂, G₂, and H₂ to see how one angle and one length ratio change the entire symmetry.`,
  } : learning?.curiosity;
  const summary = learning?.summary || {};
  const daily = learning?.dailyFact;
  const progress = learning?.progress || {};
  const unlocked = new Set(progress.unlocked?.backgrounds || []);
  const quizzes = learning?.quizzes || [];
  const rewards = learning?.rewards || [];
  const earnedBadges = new Set(progress.badges || []);
  const recognizedBadgeCount = BADGE_INFO.filter(badge => earnedBadges.has(badge.id)).length;
  const recommendedLesson = learning?.recommendedLesson;
  const orientation = rootSystem ? `
      <div class="info-box learn-orientation" data-learn-orientation>
        <span class="info-title">Rank-2 roots at a glance</span>
        <div class="learn-fact-strip" aria-label="Key ${rootSystem.id} facts">
          <div><strong>${rootSystem.rootCount}</strong><span>roots</span></div>
          <div><strong>${rootSystem.coxeterNumber}</strong><span>Coxeter h</span></div>
          <div><strong>${rootSystem.chamberCount}</strong><span>chambers</span></div>
        </div>
        <p>A <b>root system</b> is a set of vectors closed under reflection in the mirrors perpendicular to those vectors. In rank 2, the whole construction fits on one plane.</p>
        <p>${escapeHtml(rootSystem.description)} The moving marker follows one orbit of the Coxeter element—the product of the two simple reflections.</p>
      </div>` : `
      <div class="info-box learn-orientation" data-learn-orientation>
        <span class="info-title">E₈ at a glance</span>
        <div class="learn-fact-strip" aria-label="Key E8 facts">
          <div><strong>240</strong><span>roots</span></div>
          <div><strong>8</strong><span>rings</span></div>
          <div><strong>30×</strong><span>symmetry</span></div>
        </div>
        <p>The exceptional Lie algebra E<sub>8</sub> is shown through its 240 <b>root vectors</b>, projected from eight dimensions onto the <b>Coxeter plane</b>.</p>
        <p>Those roots land on <b>eight concentric rings</b>. The Petrie path traces a 30-step orbit; bright roots are an illustrative McKay-source highlight.</p>
      </div>`;
  return `
    <div class="ps-section" data-section="learn">
      <div class="ps-title">Learn</div>

      <button class="learning-center-launch" data-act="openLearningCenter" aria-label="Open Learning Center">
        <span>Open Learning Center</span>
        <small>${summary.lessonsComplete || 0}/${summary.lessonsTotal || 0} lessons complete${recommendedLesson ? ` · Continue with ${escapeHtml(recommendedLesson.title)}` : ''}</small>
      </button>

      ${curiosity ? `
        <div class="ps-subtitle">In this view</div>
        <div class="info-box curiosity-card">
          <span class="info-title">${escapeHtml(curiosity.title)}</span>
          <div>${escapeHtml(curiosity.body)}</div>
        </div>
      ` : ''}

      ${orientation}

      <div class="ps-subtitle">More learning</div>
      <div class="learn-path-grid" data-learn-paths>
        <button class="learn-path-card" data-act="openProofs">
          <span>Interactive proofs</span><small>Build the ideas step by step</small>
        </button>
      </div>

      ${daily ? `
        <div class="ps-subtitle">Today's discovery</div>
        <div class="info-box daily-card">
          <span class="info-title">${escapeHtml(daily.title)}</span>
          <div style="font-size:10px;color:var(--ink-2);margin:4px 0 6px">${escapeHtml(daily.body)}</div>
          <div class="seg"><button data-act="claimDailyFact">${learning.dailyClaimedToday ? 'View today' : 'Claim today'}</button></div>
        </div>
      ` : ''}

      <div class="ps-subtitle">Reference</div>
      <div class="learn-reference-grid">
        <button data-act="openGlossary"><span>Glossary</span><small>terms</small></button>
        <button data-act="openBiographies"><span>People</span><small>thinkers</small></button>
        <button data-act="openTimeline"><span>Timeline</span><small>history</small></button>
      </div>

      <details class="learn-disclosure" data-learn-disclosure="progress">
        <summary><span>Progress &amp; challenges</span><small>${summary.quizPassed || 0}/${summary.quizTotal || 0} quizzes · ${recognizedBadgeCount}/${BADGE_INFO.length} badges</small></summary>
        <div class="learn-disclosure-body">
          <div class="learn-progress-stats">
            <div><strong>${summary.streak || 0}</strong><span>day streak</span></div>
            <div><strong>${summary.lessonsComplete || 0}/${summary.lessonsTotal || 0}</strong><span>lessons</span></div>
            <div><strong>${summary.experimentsComplete || 0}/${summary.experimentsTotal || 0}</strong><span>experiments</span></div>
            <div><strong>${summary.quizPassed || 0}</strong><span>quizzes</span></div>
          </div>
          <div class="ps-subtitle">Quizzes</div>
          <div class="quiz-grid">
            ${quizzes.map(q => {
              const qState = progress.quiz?.[q.id] || {};
              const passed = !!qState.passedAt;
              return `<button class="quiz-card ${passed ? 'passed' : ''}" data-act="startQuiz" data-arg="${q.id}">
                <span>${escapeHtml(q.title)}</span>
                <small>${passed ? `Best ${qState.bestScore || 0}/${qState.total || q.questions.length}` : `${q.questions.length} questions`}</small>
              </button>`;
            }).join('')}
          </div>
          <div class="ps-subtitle">Rewards</div>
          <div class="reward-grid">
            ${rewards.map(r => `
              <div class="reward-card ${unlocked.has(r.id) ? 'unlocked' : 'locked'}" title="${escapeHtml(r.description)}">
                <span class="reward-swatch" style="background:linear-gradient(135deg, ${r.colors.join(',')})"></span>
                <span>${escapeHtml(r.name)}</span>
                <small>${unlocked.has(r.id) ? 'unlocked' : 'cosmetic'}</small>
              </div>
            `).join('')}
          </div>
          <div class="ps-subtitle">Achievements</div>
          <div class="ps-help">Earned by exploring, reading, and passing quizzes. Progress stays on this device.</div>
          <div class="quiz-grid">
            ${BADGE_INFO.map(b => {
              const earned = earnedBadges.has(b.id);
              return `<div class="quiz-card ${earned ? 'passed' : ''}" title="${escapeHtml(b.description)}">
                <span>${escapeHtml(b.name)}</span>
                <small>${earned ? '✓ earned' : escapeHtml(b.kind)}</small>
              </div>`;
            }).join('')}
          </div>
        </div>
      </details>

      <details class="learn-disclosure" data-learn-disclosure="creative">
        <summary><span>Create &amp; experiment</span><small>postcards · shader sketches</small></summary>
        <div class="learn-disclosure-body">
          <div class="info-box learn-creative-card">
            <span class="info-title">Postcard Studio</span>
            <div class="ps-help">Export a vertical PNG or WebM with your own caption.</div>
            <div class="seg"><button data-act="openPostcardStudio">Create postcard</button></div>
          </div>
          <div class="ps-subtitle">Code-art gallery</div>
          <div class="ps-help">Self-contained E₈ fragment-shader sketches. Select one to copy its code.</div>
          ${CODE_ART_SHADERS.map((s, idx) => `
            <button class="learn-code-card" data-act="copyCodeArt" data-arg="${idx}" title="Copy ${escapeHtml(s.title)} shader code">
              <span>${escapeHtml(s.title)}</span><small>${escapeHtml(s.description)}</small>
            </button>
          `).join('')}
        </div>
      </details>
    </div>
  `;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// ── Helper: conjugacy class swatch ──
function classSwatch(cls) {
  return `hsl(${(((cls - 4) * 0.11 + 1) * 360) % 360}, 70%, 60%)`;
}

// ── Panel controller ──

export class ControlPanel {
  constructor(panelEl, statusEl, { params, data, onAction }) {
    this.panelEl = panelEl;
    this.statusEl = statusEl;
    this.params = params;
    this.data = data;
    this.onAction = onAction;
    this.lastShape = params.shape;
    this.lastView = params.view;
    this.lastPalette = params.palette;
    this.lastFx = params.fxMode;
    this.workspaceScroll = { scene: 0, style: 0, learn: 0 };
    this.paletteExpanded = false;
    this.openDisclosures = new Set();
    this.renderedWorkspace = null;
    this.render();
  }

  setParams(params, options = {}) {
    this.params = params;
    // Always full-render — the new panel is cheap and context changes need full rebuild
    this.render();
  }

  render() {
    try {
      const focusDescriptor = this.captureFocus();
      // Refresh the auto-animated set so slider() can render the ⟳ toggle state.
      _autoSliders = new Set(this.params.autoSliders || []);
      // Bug fix 2026-06-25: preserve scroll position across re-renders.
      // Earlier, every setParam call triggered refreshPanel() → full innerHTML
      // rewrite → scrollTop reset to 0. Now we save+restore the scrollTop
      // of the body element across the rewrite.
      const oldBody = this.panelEl.querySelector('#ps-body');
      if (oldBody && this.renderedWorkspace) {
        this.workspaceScroll[this.renderedWorkspace] = oldBody.scrollTop;
      }
      const workspace = panelWorkspace(this.params);
      this.panelEl.classList.remove('collapsed');
      this.panelEl.innerHTML = `
        <div class="ps-status" id="ps-status" role="status" aria-live="polite" aria-atomic="true"></div>
        <div class="ps-mode-tabs" role="tablist" aria-label="Control workspace">
          ${PANEL_WORKSPACES.map(mode => `<button id="panel-tab-${mode}" class="${workspace === mode ? 'on' : ''}" data-act="setPanelMode" data-arg="${mode}" role="tab" aria-controls="ps-body" aria-selected="${workspace === mode ? 'true' : 'false'}" tabindex="${workspace === mode ? '0' : '-1'}">${PANEL_WORKSPACE_LABELS[mode]}</button>`).join('')}
        </div>
        <div class="ps-global-quality" role="group" aria-label="Render quality">
          <span class="ps-global-quality-label">Quality</span>
          <div class="ps-quality-options">
            ${[['low', 'Low'], ['medium', 'Balanced'], ['high', 'High']].map(([level, label]) => `<button class="${this.params.mobileQuality === level ? 'on' : ''}" ${pressed(this.params.mobileQuality === level)} data-act="setMobileQuality" data-arg="${level}" title="Set global render quality to ${label}">${label}</button>`).join('')}
          </div>
        </div>
        <div class="ps-scroll" id="ps-body" role="tabpanel" aria-labelledby="panel-tab-${workspace}"></div>
        <div class="panel-footer" role="group" aria-label="Studio actions">
          <button data-act="resetConfig" title="Reset this model's visuals and motion"><span style="font-size:13px">↺</span> Reset</button>
          <button data-act="surprise" title="Surprise: randomize view, palette, FX, shape, and shift settings for discovery"><span style="font-size:13px">✦</span> Surprise</button>
          <button data-act="shareSnapshot" title="Save a snapshot of the current render"><span style="font-size:13px">▣</span> Snapshot</button>
          <button data-act="sharePage" title="Copy the hosted E8 Studio link"><span style="font-size:13px">⎘</span> Share</button>
          <button data-act="togglePresentationMode" title="Full screen: hide all chrome (press Esc to exit)"><span style="font-size:13px">⛶</span> Full</button>
          <details class="panel-tools-menu" data-panel-disclosure="footer-tools" ${this.openDisclosures.has('footer-tools') ? 'open' : ''}>
            <summary id="panel-disclosure-footer-tools" title="Open more studio tools">Tools</summary>
            <div class="panel-tools-popover">
              <button data-act="openVideoExport" title="Record a video clip (720p+)"><span aria-hidden="true">⏺</span> Video</button>
              <button data-act="togglePerf" title="Toggle the frames-per-second overlay">FPS overlay</button>
              <button data-act="toggleCommandPalette" title="Open the command palette">Commands</button>
              <button data-act="copyDiagnostics" title="Copy browser and renderer diagnostics">Diagnostics</button>
              <button data-act="openCheatsheet" title="Open keyboard shortcuts">Keyboard help</button>
            </div>
          </details>
        </div>
      `;
      const body = this.panelEl.querySelector('#ps-body');
      body.innerHTML = workspace === 'learn'
        ? renderLearnSection(this.params) + renderMathSection(this.params, this.data)
        : workspace === 'style'
          ? renderStyleSection(this.params, this.data, this)
          : renderViewSection(this.params, this.data, this);
      // Each workspace owns its own position. Switching tabs never lands the
      // user halfway through an unrelated group of controls.
      body.scrollTop = this.workspaceScroll[workspace] || 0;
      this.renderedWorkspace = workspace;
      this.renderStatus();
      this.restoreFocus(focusDescriptor);
    } catch (e) {
      console.error('Panel render error:', e);
    }
  }

  captureFocus() {
    const active = document.activeElement;
    if (!active || !this.panelEl.contains(active)) return null;
    if (active.id) return { id: active.id };
    if (active.dataset?.panelAct) return { panelAct: active.dataset.panelAct };
    if (active.dataset?.act) return { act: active.dataset.act, arg: active.dataset.arg ?? null };
    if (active.dataset?.param) return { param: active.dataset.param };
    return null;
  }

  restoreFocus(descriptor) {
    if (!descriptor) return;
    let target = descriptor.id ? document.getElementById(descriptor.id) : null;
    if (!target && descriptor.panelAct) {
      target = [...this.panelEl.querySelectorAll('[data-panel-act]')]
        .find(node => node.dataset.panelAct === descriptor.panelAct);
    }
    if (!target && descriptor.act) {
      target = [...this.panelEl.querySelectorAll('[data-act]')]
        .find(node => node.dataset.act === descriptor.act && (node.dataset.arg ?? null) === descriptor.arg);
    }
    if (!target && descriptor.param) {
      target = [...this.panelEl.querySelectorAll('[data-param]')]
        .find(node => node.dataset.param === descriptor.param);
    }
    target?.focus?.({ preventScroll: true });
  }

  renderStatus() {
    const el = this.panelEl.querySelector('#ps-status');
    if (!el) return;
    const p = this.params;
    const viewLabel = ({ e8coxeter: 'E₈', sixhundred: '600-cell', polytope: '4D', raymarched: 'SDF' })[p.view]
      || p.view;
    const selection = p.view === 'polytope' ? p.poly4d
      : p.view === 'dynkin' ? p.dynkin
      : p.view === 'rootlab' ? p.rootSystem
      : p.view === 'tiling' ? p.tilingSystem
      : p.view === 'raymarched' ? '240 roots'
      : p.shape;
    const selectionLabel = String(selection || '').replaceAll('_', ' ');
    const paletteLabel = String(p.palette || '').replaceAll('_', ' ');
    el.innerHTML = `
      <div class="ps-status-row">
        <span class="ps-status-key">${viewLabel}</span>
        <span class="ps-status-sep">·</span>
        <span class="ps-status-key">${selectionLabel}</span>
        <span class="ps-status-sep">·</span>
        <span class="ps-status-key">${paletteLabel}</span>
        <span class="ps-status-sep">·</span>
        <span class="ps-motion" id="ps-motion" title="Animation state — updates live"></span>
      </div>
    `;
    // Seed the motion pill with the current state right after render so it
    // isn't blank until the next animate frame.
    updateMotionStatus(p);
  }
}

/**
 * Live motion-state pill for the panel header (audit #21).
 * Updates a small #ps-motion element (when present) with the current
 * animation state: paused / camera path / auto-rotate / bloom / idle.
 * Safe to call every frame — it short-circuits when the DOM node is missing
 * or the state hasn't changed since the last write.
 */
const MOTION_STATES = {
  paused:   { label: '⏸ paused',  cls: 'is-paused' },
  intro:    { label: '✦ intro',    cls: 'is-active' },
  cam:      { label: '🎥 path',    cls: 'is-active' },
  model:    { label: '✦ models',   cls: 'is-active' },
  zoom:     { label: '↕ zoom',     cls: 'is-active' },
  fx:       { label: '✧ FX',       cls: 'is-active' },
  spinOrbit:{ label: '↻ spin + orbit', cls: 'is-active' },
  orbit:    { label: '↻ orbit',   cls: 'is-active' },
  flux:     { label: '↕ flux',    cls: 'is-active' },
  rotate:   { label: '↻ rotate',  cls: 'is-active' },
  bloom:    { label: '▶ bloom',   cls: 'is-active' },
  idle:     { label: '● idle',    cls: 'is-idle' },
};
let _lastMotionKey = null;
export function updateMotionStatus(params) {
  if (!params) return;
  let key;
  if (params.paused) key = 'paused';
  else if (params.intro) key = 'intro';
  else if (params.autoModel) key = 'model';
  else if (params.cameraPath && params.cameraPath !== 'manual') key = 'cam';
  else if (params.autoZoom) key = 'zoom';
  else if (params.autoFx) key = 'fx';
  else if (params.cameraOrbit && (params.autoRotate || params.e8AutoRotate || params.polyAutoRotate)) key = 'spinOrbit';
  else if (params.cameraOrbit) key = 'orbit';
  else if ((params.autoSliders || []).includes('e8MorphT')) key = 'flux';
  else if (params.autoRotate || params.e8AutoRotate || params.polyAutoRotate) key = 'rotate';
  else if (params.bloomAuto) key = 'bloom';
  else key = 'idle';
  // Only touch the DOM when the state actually changes (cheap guard so this
  // can sit in the 60fps animate loop without causing layout work).
  if (key === _lastMotionKey) return;
  _lastMotionKey = key;
  const el = document.getElementById('ps-motion');
  if (!el) return;
  const s = MOTION_STATES[key];
  el.textContent = s.label;
  el.className = 'ps-motion ' + s.cls;
}

export function initPanelEvents(panel) {
  const root = panel?.panelEl || panel;
  if (!root || root.dataset.workspaceKeysBound === 'true') return;
  root.dataset.workspaceKeysBound = 'true';
  root.addEventListener('click', event => {
    const action = event.target.closest?.('[data-panel-act]')?.dataset.panelAct;
    if (action !== 'togglePaletteExpanded') return;
    panel.paletteExpanded = !panel.paletteExpanded;
    panel.render();
  });
  root.addEventListener('toggle', event => {
    const details = event.target.closest?.('details[data-panel-disclosure]');
    if (!details || !panel.openDisclosures) return;
    if (details.open) panel.openDisclosures.add(details.dataset.panelDisclosure);
    else panel.openDisclosures.delete(details.dataset.panelDisclosure);
  }, true);
  root.addEventListener('keydown', event => {
    const tab = event.target.closest?.('.ps-mode-tabs [role="tab"]');
    if (!tab || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = [...root.querySelectorAll('.ps-mode-tabs [role="tab"]')];
    const current = tabs.indexOf(tab);
    const next = event.key === 'Home' ? 0
      : event.key === 'End' ? tabs.length - 1
      : (current + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault();
    tabs[next].focus();
    tabs[next].click();
  });
}

// Legacy panel collapse is disabled. Mobile V2 owns the phone UI; the desktop
// Studio keeps its desktop sidebar even on touch devices.
export function isPanelCollapsed() {
  return false;
}

export function setPanelCollapsed(collapsed) {
  const el = document.getElementById('panel');
  if (el) el.classList.remove('collapsed');
  return false;
}

export function togglePanelCollapsed() {
  return false;
}
