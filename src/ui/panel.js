// panel.js — Context-sensitive side-panel for E8 ⇄ Platonics Studio
//
// REWORK PRINCIPLES:
//   3 sections, always visible (no tabs to hunt through):
//     1. VIEW — what you're looking at + its specific controls
//     2. STYLE — colors, effects, opacity (universal)
//     3. MATH — per-view math explorers (Cartan, conjugacy, etc.)
//
// Each view shows ONLY its relevant controls. No E8 controls on Platonic.
// No lighting sliders that only affect mesh views when you're on Bloom.

import { PALETTE_GROUPS, PALETTE_PRESETS, SHIFT_PRESETS, COLORINGS, palettePreviewCSS } from './palettes.js';
import { BACKGROUND_PRESETS, backgroundModesForQuality } from './backgrounds.js';
import { renderCartanMatrix } from '../math/cartan.js';
import { renderBrackets } from '../math/brackets.js';
import { THEMES, THEME_LABELS } from './theme.js';
import { CODE_ART_SHADERS, TOUR_STOPS } from '../content/essays.js';
import { BADGE_INFO } from '../content/learning.js';
import { STELLATION_NAMES, STELLATION_LABELS, STELLATION_INFO } from '../math/stellations.js';
import {
  CURATED_LOOKS,
  FX_BY_ID,
  effectAvailableForQuality,
  effectAvailableForView,
  effectsForView,
} from '../fx/fx-catalog.js';

const QUICK_PALETTES = Object.freeze(['gold', 'cosmic', 'prime', 'aurora', 'opal', 'mono']);
const QUICK_BACKGROUNDS = Object.freeze(['void', 'starfield', 'eclipse', 'aurora', 'synthwave', 'prism']);

const SHAPES = ['tetrahedron', 'cube', 'octahedron', 'dodecahedron', 'icosahedron'];

// ── Helper: short shape label (consistent across shape picker + compare subset) ──
function shapeShort(name) {
  return name.replace('hedron', '').slice(0, 4);
}

function renderCameraControls(params, caps) {
  let html = '<div class="ps-subtitle">Camera</div>';
  html += slider('Rotation', 'cameraRotation', params.cameraRotation ?? Math.PI / 6,
    -Math.PI, Math.PI, 0.01, v => `${Math.round(v * 180 / Math.PI)}°`);
  // Camera distance runs opposite to a user's mental model of zoom. Render it
  // inverted so moving right always zooms in (smaller physical distance).
  html += slider('Zoom', 'cameraDistance', params.cameraDistance ?? 6, 2.4, 12, 0.1,
    v => `${Math.round((12 - v) / 9.6 * 100)}%`, undefined, { invert: true });
  if (caps.extrude) {
    // Shared by the point-based E8 projection and the raymarched E8 SDF.
    // Keeping it here makes its cross-view "breathing" behavior discoverable.
    html += slider('Extrude', 'e8MorphT', params.e8MorphT || 0, 0, 1, 0.01, v => v.toFixed(2));
  }
  html += '<div class="seg seg-wrap">';
  html += `<button class="${params.cameraPath === 'manual' && params.cameraOrbit ? 'on' : ''}" data-act="setCameraPreset" data-arg="orbit" title="Continuous camera orbit">Orbit</button>`;
  html += `<button class="${params.cameraPath === 'ringDive' ? 'on' : ''}" data-act="setCameraPreset" data-arg="dive" title="Dive toward the center and back">Dive</button>`;
  html += `<button class="${params.cameraPath === 'petrieSpiral' ? 'on' : ''}" data-act="setCameraPreset" data-arg="spiral" title="Spiral around the structure">Spiral</button>`;
  html += '<button data-act="resetCamera" title="Reset camera position">Reset</button>';
  html += '</div>';
  return html;
}

// ── Helper: which params each view uses ──
const VIEW_CAPABILITIES = {
  bloom:      { shape: true,  rotate: true,  lighting: false, bloom: true,  e8: false, poly: false, sdf: false, extrude: true, math: false },
  platonic:   { shape: true,  rotate: true,  lighting: true,  bloom: false, e8: false, poly: false, sdf: false, extrude: true, math: 'platonic' },
  e8coxeter:  { shape: true,  rotate: true,  lighting: false, bloom: false, e8: true,  poly: false, sdf: false, extrude: true, math: 'e8', coloring: true },
  sixhundred: { shape: true,  rotate: true,  lighting: true,  bloom: false, e8: false, poly: false, sdf: false, extrude: true, math: '600' },
  polytope:   { shape: false, rotate: true,  lighting: true,  bloom: false, e8: false, poly: true,  sdf: false, extrude: true, math: false },
  raymarched: { shape: false, rotate: true,  lighting: false, bloom: false, e8: false, poly: false, sdf: true, extrude: true, math: false },
};

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
  // Featured preview cards are useful for browsing, but not worth permanent
  // space in the focused Create workspace. Advanced users can opt them in.
  if (params.advancedStyle) {
    html += '<div class="gallery-preview-grid">';
    const featured = gallery.filter(preset => preset.featured).slice(0, 4);
    for (const preset of featured) {
      const palette = preset.settings?.palette || 'gold';
      html += `<button class="gallery-preview ${params.galleryPreset === preset.id ? 'on' : ''}" data-act="applyGalleryPreset" data-arg="${preset.id}" title="${preset.description || preset.name}">
        <span class="gallery-preview-swatch" style="background:${palettePreviewCSS(palette, 'spectrum')}"></span>
        <span>${preset.name}</span>
      </button>`;
    }
    html += '</div>';
  }
  html += `<button class="gallery-browse" data-act="openPresets" title="Browse all presets with palette previews">Browse all ${gallery.length} presets</button>`;
  return html;
}

// ── Section 1: VIEW ──
function renderViewSection(params, data) {
  const caps = VIEW_CAPABILITIES[params.view] || {};
  let html = '<div class="ps-section" data-section="view"><div class="ps-title">View</div>';

  // View switcher (always visible)
  html += `<div class="seg seg-wrap ps-view-switch">`;
  for (const v of ['bloom', 'platonic', 'e8coxeter', 'sixhundred', 'polytope', 'raymarched']) {
    const label = v === 'e8coxeter' ? 'E₈' : v === 'sixhundred' ? '600' : v === 'polytope' ? '4D' : v === 'raymarched' ? 'SDF' : v;
    html += `<button class="${params.view === v ? 'on' : ''}" data-act="switchView" data-arg="${v}">${label}</button>`;
  }
  html += '</div>';

  // Keep the essential camera/motion controls near the top. The panel exposes
  // three useful paths; custom mode and bookmark grids stay out of the way.
  if (caps.rotate) html += renderCameraControls(params, caps);

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
      html += `<button class="shape-pill ${active ? 'active' : ''}" data-act="setShape" data-arg="${name}" title="${name}">${short}</button>`;
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
        html += `<button class="shape-pill ${active ? 'active' : ''}" data-act="setShape" data-arg="${name}" title="${name} (Kepler–Poinsot)">${label}</button>`;
      }
      html += '</div>';
    }

    // Platonic morphs. Multi-solid stack modes were removed from the UI: they
    // obscured the selected solid and were not useful in the normal workflow.
    if (params.view === 'platonic') {
      // Parametric shape morphs — deform the solid live. Each is a slider, so it
      // also picks up the ⟳ per-slider auto-animate for generative play.
      html += '<div class="ps-subtitle">Morph</div>';
      html += slider('Twist', 'shapeTwist', params.shapeTwist || 0, 0, 3, 0.02, v => v.toFixed(2));
      html += slider('Spike', 'shapeSpike', params.shapeSpike || 0, 0, 1.5, 0.02, v => v.toFixed(2));
      html += slider('Jitter', 'shapeJitter', params.shapeJitter || 0, 0, 1, 0.02, v => v.toFixed(2));
    }
  }

  // Bloom-specific controls
  if (caps.bloom) {
    html += renderBloomControls(params);
  }

  // E8-specific controls
  if (caps.e8) {
    html += renderE8Controls(params, data);
  }

  // SDF-specific controls (raymarched E₈ view)
  if (caps.sdf) {
    html += renderSDFControls(params, data);
  }

  // Polytope-specific controls
  if (caps.poly) {
    html += renderPolytopeControls(params, data);
  }

  html += renderGalleryControls(params);

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

function renderE8Controls(params, data) {
  const mode = params.e8ViewMode || 'coxeter';
  let html = '<div class="ps-subtitle">E₈ projection</div>';
  html += '<div class="seg seg-wrap">';
  html += `<button class="${mode === 'coxeter' ? 'on' : ''}" data-act="setE8Mode" data-arg="coxeter" title="The canonical 2D Coxeter plane projection (8 rings of 30 roots)">Coxeter</button>`;
  html += `<button class="${mode === 'petrie' ? 'on' : ''}" data-act="setE8Mode" data-arg="petrie" title="Same 2D as Coxeter but emphasizes the Petrie polygon">Petrie</button>`;
  html += `<button class="${mode === 'h4' ? 'on' : ''}" data-act="setE8Mode" data-arg="h4" title="Two interlaced H₄ / 600-cell projections">H₄</button>`;
  // Bug fix 2026-06-25 (audit #7): was 'Rand' (unclear) — actually means
  // project by first 3 axes of R^8. New label 'Axes' is clearer.
  html += `<button class="${mode === 'ortho3d' ? 'on' : ''}" data-act="setE8Mode" data-arg="ortho3d" title="Project to first 3 axes of ℝ⁸ (orthogonal 3D view)">Axes</button>`;
  // And '8D' → 'Spin' for custom (user-rotation) mode.
  html += `<button class="${mode === 'custom' ? 'on' : ''}" data-act="setE8Mode" data-arg="custom" title="Free 8D rotation via Spin/Tilt/Roll sliders below">Spin</button>`;
  html += '</div>';

  html += '<div class="seg">';
  html += `<button class="${params.showRings ? 'on' : ''}" data-act="toggleRings">Rings</button>`;
  html += `<button class="${params.showEdges ? 'on' : ''}" data-act="toggleEdges">Edges</button>`;
  html += `<button class="${params.showPetrie ? 'on' : ''}" data-act="togglePetrie" title="Real Hamiltonian 30-cycle in E₈ edge graph">Petrie</button>`;
  html += '</div>';
  html += '<div class="seg seg-wrap">';
  html += `<button class="${params.rootDiffusion ? 'on' : ''}" data-act="toggleRootDiffusion" title="Animate graph-distance halos from the selected root">Diffusion</button>`;
  html += `<button class="${params.showWeylMirrors ? 'on' : ''}" data-act="toggleWeylMirrors" title="Show simple-reflection mirror lines">Mirrors</button>`;
  html += `<button class="${params.e8Twin600 ? 'on' : ''}" data-act="toggleE8Twin600" title="Color the two projected H₄ layers used by this view">Twin 600</button>`;
  html += `<button class="${params.e8ProjectionAuto ? 'on' : ''}" data-act="toggleProjectionAuto" title="Cycle the projection atlas">Atlas</button>`;
  html += '</div>';
  if (params.rootDiffusion) {
    html += slider('Halo depth', 'rootHaloDepth', params.rootHaloDepth || 3, 1, 5, 1, v => Math.round(v).toString());
    html += slider('Wave speed', 'rootDiffusionSpeed', params.rootDiffusionSpeed || 1.25, 0.2, 4, 0.05, v => v.toFixed(2));
  }

  html += '<div class="ps-subtitle">Compare subset</div>';
  html += '<div class="seg seg-wrap">';
  for (const name of SHAPES) {
    html += `<button class="${(params.compareShape || 'dodecahedron') === name ? 'on' : ''}" data-act="setCompareShape" data-arg="${name}" title="Compare ${name}">${shapeShort(name)}</button>`;
  }
  html += '</div>';
  html += '<div class="seg seg-wrap">';
  for (const modeName of ['off', 'overlay', 'intersection', 'difference']) {
    const label = modeName === 'intersection' ? 'intersect' : modeName === 'difference' ? 'diff' : 'overlay';
    const display = modeName === 'off' ? 'off' : label;
    html += `<button class="${(params.compareMode || 'off') === modeName ? 'on' : ''}" data-act="setCompareMode" data-arg="${modeName}" title="${modeName}">${display}</button>`;
  }
  html += '</div>';
  if ((params.compareMode || 'off') !== 'off') html += `<div class="compare-legend">
    <div><span class="compare-dot" style="background:var(--accent)"></span>${params.shape} primary</div>
    <div><span class="compare-dot" style="background:var(--accent-4)"></span>${params.compareShape || 'dodecahedron'} compare</div>
  </div>`;
  html += toggle('Inspector', params.showInspector !== false, 'toggleRootInspector');

  if (mode === 'custom') {
    html += '<div style="font-size:10px;color:var(--ink-2);margin:6px 0 4px">Rotate in 8D (ℝ⁸) → reproject to 3D</div>';
    html += slider('Spin', 'e8Spin', params.e8Spin || 0, -3.14, 3.14, 0.01, v => v.toFixed(2));
    html += slider('Tilt', 'e8Tilt', params.e8Tilt || 0, -3.14, 3.14, 0.01, v => v.toFixed(2));
    html += slider('Roll', 'e8Roll', params.e8Roll || 0, -3.14, 3.14, 0.01, v => v.toFixed(2));
    html += '<div class="seg">';
    html += `<button class="${params.e8AutoRotate ? 'on' : ''}" data-act="toggleE8AutoRotate">${params.e8AutoRotate ? 'Pause' : 'Anim 8D'}</button>`;
    html += `<button data-act="resetE8Angles">Reset</button>`;
    html += '</div>';
  }

  return html;
}

function renderSDFControls(params, data) {
  let html = '<div class="ps-subtitle">SDF shape &amp; quality</div>';
  html += '<div class="seg" aria-label="SDF render quality">';
  for (const [level, label] of [['low', 'Low'], ['medium', 'Balanced'], ['high', 'High']]) {
    html += `<button class="${params.mobileQuality === level ? 'on' : ''}" data-act="setMobileQuality" data-arg="${level}" title="${label} SDF shader budget">${label}</button>`;
  }
  html += '</div>';
  html += '<div class="ps-help">Quality changes the raymarch budget. Native SDF looks are lightweight surface treatments.</div>';
  html += slider('Sphere radius', 'sdfSphereR', params.sdfSphereR ?? 0.08, 0.02, 0.15, 0.005, v => v.toFixed(3));
  html += slider('Blend (smin)', 'sdfBlend', params.sdfBlend ?? 0.03, 0.0, 0.12, 0.005, v => v.toFixed(3));
  if (params.advancedStyle) {
    html += slider('Highlight bloom', 'sdfBloom', params.sdfBloom ?? 0.5, 0, 1, 0.05, v => Math.round(v * 100) + '%');
    html += slider('Aniso spec', 'sdfAniso', params.sdfAniso ?? 0.6, 0, 1, 0.05, v => Math.round(v * 100) + '%');
    html += slider('Edge cylinders', 'sdfEdges', params.sdfEdges ?? 0.3, 0, 1, 0.05, v => Math.round(v * 100) + '%');
  }
  return html;
}

function renderPolytopeControls(params, data) {
  const polys = data.polytopes4d || {};
  let html = '<div class="ps-subtitle">Polytope</div>';
  html += '<div class="seg seg-wrap">';
  for (const k of Object.keys(polys)) {
    html += `<button class="${params.poly4d === k ? 'on' : ''}" data-act="setPoly4d" data-arg="${k}">${k}</button>`;
  }
  html += '</div>';
  html += slider('w-depth', 'morph4d', params.morph4d || 0, -2, 2, 0.01, v => v.toFixed(2));
  html += slider('4D speed', 'polyRotationSpeed', params.polyRotationSpeed ?? 0.18, 0.04, 0.6, 0.01, v => v.toFixed(2));
  html += slider('Rot XY', 'polyRotXY', params.polyRotXY || 0, -3.14, 3.14, 0.01, v => v.toFixed(2), 'polyAutoRotate');
  html += slider('Rot ZW', 'polyRotZW', params.polyRotZW || 0, -3.14, 3.14, 0.01, v => v.toFixed(2), 'polyAutoRotate');
  // Round 9: two extra 4D rotation planes for richer manipulation.
  html += slider('Rot XZ', 'polyRotXZ', params.polyRotXZ || 0, -3.14, 3.14, 0.01, v => v.toFixed(2), 'polyAutoRotate');
  html += slider('Rot YW', 'polyRotYW', params.polyRotYW || 0, -3.14, 3.14, 0.01, v => v.toFixed(2), 'polyAutoRotate');
  // Round 10: complete all 6 rotation planes of ℝ⁴.
  html += slider('Rot XW', 'polyRotXW', params.polyRotXW || 0, -3.14, 3.14, 0.01, v => v.toFixed(2), 'polyAutoRotate');
  html += slider('Rot YZ', 'polyRotYZ', params.polyRotYZ || 0, -3.14, 3.14, 0.01, v => v.toFixed(2), 'polyAutoRotate');
  html += '<div class="seg">';
  html += `<button class="${params.polyAutoRotate ? 'on' : ''}" data-act="togglePolyAutoRotate">${params.polyAutoRotate ? 'Pause 4D' : 'Animate 4D'}</button>`;
  html += `<button data-act="resetPolyAngles">Reset</button>`;
  html += '</div>';
  return html;
}

// ── Section 2: STYLE ──
function renderStyleSection(params, data) {
  const caps = VIEW_CAPABILITIES[params.view] || {};
  const quality = params.reducedMode ? 'low' : (params.mobileQuality || 'high');
  let html = '<div class="ps-section" data-section="style"><div class="ps-title">Style</div>';

  // The default workflow is intentionally small: pick a look, a palette, and
  // an environment. The full implementation catalog remains one click away.
  html += '<div class="ps-subtitle">Look</div>';
  html += '<div class="look-grid">';
  for (const look of CURATED_LOOKS) {
    if (!effectAvailableForView(params.view, look.mode, quality)) continue;
    const item = FX_BY_ID[look.mode];
    html += `<button class="look-card ${params.fxMode === look.mode ? 'on' : ''}" data-act="setFX" data-arg="${look.mode}" title="${item.description}">
      <span>${look.label}</span><small>${look.description}</small>
    </button>`;
  }
  html += '</div>';
  if (params.view === 'raymarched') {
    html += '<div class="ps-help">These looks are implemented directly in the SDF raymarcher. Point-only effects stay hidden.</div>';
  }
  // Keep this visible even when Look is Off. Hiding it made the control feel
  // like it had vanished; its stored value applies as soon as a Look is chosen.
  html += slider('Strength', 'fxIntensity', params.fxIntensity ?? 0.5, 0, 1, 0.05, v => Math.round(v * 100) + '%');

  // Quick palette row
  html += '<div class="ps-subtitle">Palette</div>';
  const activePalette = PALETTE_PRESETS[params.palette] || PALETTE_PRESETS.gold;
  html += `<div class="palette-active-preview" style="background:${palettePreviewCSS(params.palette, 'spectrum')}">
    <span>${params.palette.replaceAll('_', ' ')}</span>
    <small>${activePalette.description}</small>
  </div>`;
  html += '<div class="swatch-grid quick-swatches">';
  for (const k of QUICK_PALETTES) {
    html += `<button class="swatch ${params.palette === k ? 'active' : ''}"
      style="background:${palettePreviewCSS(k, 'spectrum')}"
      data-act="setPalette" data-arg="${k}" title="${k.replaceAll('_', ' ')} — ${PALETTE_PRESETS[k].description}"
      aria-label="Use ${k.replaceAll('_', ' ')} palette"></button>`;
  }
  html += '</div>';

  // Quick environment row
  html += '<div class="ps-subtitle">Environment</div>';
  html += '<div class="seg seg-wrap">';
  const availableBackgrounds = new Set(backgroundModesForQuality(quality));
  for (const m of QUICK_BACKGROUNDS.filter(mode => availableBackgrounds.has(mode))) {
    const background = BACKGROUND_PRESETS[m];
    html += `<button class="${params.bgMode === m ? 'on' : ''}" data-act="setBgMode" data-arg="${m}" title="${background.description} · ${background.quality} quality">${background.label}</button>`;
  }
  html += '</div>';
  html += slider('BG brightness', 'bgIntensity', params.bgIntensity ?? 0.7, 0, 1.5, 0.05, v => Math.round(v * 100) + '%');

  html += `<button class="ps-advanced-toggle ${params.advancedStyle ? 'on' : ''}" data-act="toggleAdvancedStyle" aria-expanded="${params.advancedStyle ? 'true' : 'false'}">
    ${params.advancedStyle ? 'Hide advanced controls' : 'Show advanced controls'}
  </button>`;

  if (params.advancedStyle) {
    html += '<div class="ps-advanced">';

    html += '<div class="ps-subtitle">All palettes</div><div class="palette-groups">';
    for (const group of PALETTE_GROUPS) {
      html += `<div class="palette-group"><div class="palette-group-label" title="${group.description}">${group.label}</div><div class="swatch-grid">`;
      for (const k of group.palettes) {
        html += `<button class="swatch ${params.palette === k ? 'active' : ''}"
          style="background:${palettePreviewCSS(k, 'spectrum')}"
          data-act="setPalette" data-arg="${k}" title="${k.replaceAll('_', ' ')} — ${PALETTE_PRESETS[k].description}"
          aria-label="Use ${k.replaceAll('_', ' ')} palette"></button>`;
      }
      html += '</div></div>';
    }
    html += '</div>';

    if (caps.coloring) {
      html += '<div class="ps-subtitle">Color by</div><div class="seg seg-wrap">';
      for (const k of Object.keys(COLORINGS)) {
        html += `<button class="${(params.colorBy || 'shell') === k ? 'on' : ''}" data-act="setColorBy" data-arg="${k}" title="${COLORINGS[k]}">${k}</button>`;
      }
      html += '</div>';
    }

    html += '<div class="ps-subtitle">Effect catalog</div><div class="ps-help">Only effects implemented by this view are listed. Cost badges show approximate GPU work.</div>';
    html += '<div class="fx-catalog-grid">';
    for (const item of effectsForView(params.view, quality, { includeUnavailable: true })) {
      const available = effectAvailableForQuality(item.id, quality);
      const unavailableTitle = available ? item.description : `${item.description} Requires a higher quality tier.`;
      html += `<button class="fx-catalog-item ${params.fxMode === item.id ? 'on' : ''} ${available ? '' : 'unavailable'}"
        data-act="setFX" data-arg="${item.id}" title="${unavailableTitle}" ${available ? '' : 'disabled'}>
        <span>${item.label}</span><small class="fx-cost fx-cost-${item.cost}">${item.cost}</small>
      </button>`;
    }
    html += '</div>';

    html += '<div class="ps-subtitle">All backgrounds</div><div class="seg seg-wrap">';
    for (const m of backgroundModesForQuality(quality)) {
      const background = BACKGROUND_PRESETS[m];
      html += `<button class="${params.bgMode === m ? 'on' : ''}" data-act="setBgMode" data-arg="${m}" title="${background.description} · ${background.quality} quality">${background.label}</button>`;
    }
    html += '</div>';

    html += '<div class="ps-subtitle">Theme</div><div class="seg seg-wrap">';
    for (const tname of Object.keys(THEMES)) {
      const label = THEME_LABELS[tname] || tname;
      html += `<button class="${params.theme === tname ? 'on' : ''}" data-act="setTheme" data-arg="${tname}" title="Changes interface chrome only">${label}</button>`;
    }
    html += '</div>';

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

    html += '<div class="ps-subtitle">Color shift</div><div class="seg seg-wrap">';
    for (const k of Object.keys(SHIFT_PRESETS)) {
      html += `<button class="${(params.shiftMode || 'static') === k ? 'on' : ''}" data-act="setShiftMode" data-arg="${k}">${k}</button>`;
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

    html += '<div class="ps-subtitle">Export</div><div class="seg seg-wrap">';
    html += '<button data-act="exportHighResPNG" data-arg="2" title="High-resolution PNG image">PNG</button>';
    html += '<button data-act="exportSVG" title="Scalable vector diagram (E₈ Coxeter)">SVG</button>';
    html += '<button data-act="exportOBJ" title="3D model of the current solid">OBJ</button>';
    html += '<button data-act="exportGeometryJSON" title="Raw geometry as JSON">Data</button>';
    html += '</div></div>';
  }

  html += '</div>';
  return html;
}

// ── Section 3: MATH ──
function renderMathSection(params, data) {
  const caps = VIEW_CAPABILITIES[params.view] || {};
  if (!caps.math) return '';  // no math section for this view

  let html = '<div class="ps-section" data-section="math"><div class="ps-title">Math</div>';

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
  } else if (caps.math === '600') {
    const angles = ['0°', '72°', '120°', '144°', '180°', '216°', '240°', '288°', '360°'];
    const sizes = [1, 12, 20, 12, 30, 12, 20, 12, 1];
    const labels = ['identity', 'icosa', 'dodeca', 'icosa', 'icosidodeca', 'icosa', 'dodeca', 'icosa', 'antipode'];
    html += '<div class="info-box"><span class="info-title">Conjugacy classes</span>';
    for (let c = 0; c < angles.length; c++) {
      html += `<div class="class-row">
        <span class="class-dot" style="background:${classSwatch(c)}"></span>
        <span class="class-label"><b>${angles[c]}</b> · ${labels[c]}</span>
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
    <label class="control-label">${label}</label>
    <input type="range" id="slider-${paramKey}" data-param="${paramKey}"${offAttr}${invertAttr} min="${min}" max="${max}" step="${step}" value="${displayValue}" ${fillStyle}>
    <span class="control-value" id="slider-val-${paramKey}">${formatFn(value)}</span>
    <button class="slider-auto ${auto ? 'on' : ''}" data-act="toggleSliderAuto" data-arg="${paramKey}" title="Auto-animate this slider" aria-label="Auto-animate ${label}">⟳</button>
  </div>`;
}

// ── Helper: toggle button ──
// `act` is a window.__app method name, dispatched via the delegated click
// handler (data-act) so no inline onclick is emitted (CSP: no 'unsafe-inline').
function toggle(label, value, act) {
  return `<div class="control-row">
    <label class="control-label">${label}</label>
    <button class="${value ? 'on' : ''}" data-act="${act}">${value ? 'on' : 'off'}</button>
  </div>`;
}

function renderLearnSection(params) {
  const totalSeconds = TOUR_STOPS.reduce((sum, s) => sum + s.seconds, 0);
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  const learning = (typeof window !== 'undefined' && window.__app?.getLearningState?.()) || null;
  const curiosity = learning?.curiosity;
  const summary = learning?.summary || {};
  const daily = learning?.dailyFact;
  const progress = learning?.progress || {};
  const unlocked = new Set(progress.unlocked?.backgrounds || []);
  return `
    <div class="ps-section" data-section="learn">
      <div class="ps-title">Learn</div>
      <div class="info-box">
        <span class="info-title">Learning Center</span>
        <div style="font-size:10px;color:var(--ink-2);margin:4px 0 6px">
          Follow four ordered paths connecting readings, visualizations, sources, and low-stakes quizzes.
        </div>
        <div class="seg"><button data-act="openLearningCenter">Open curriculum</button></div>
      </div>
      <div class="info-box">
        <span class="info-title">Reference</span>
        <div style="font-size:10px;color:var(--ink-2);margin:4px 0 6px">
          Look up a term, meet the people, or trace the history. Press <kbd>G</kbd> for the glossary.
        </div>
        <div class="seg">
          <button data-act="openGlossary">Glossary</button>
          <button data-act="openBiographies">People</button>
          <button data-act="openTimeline">Timeline</button>
        </div>
      </div>
      ${curiosity ? `
        <div class="info-box curiosity-card">
          <span class="info-title">${escapeHtml(curiosity.title)}</span>
          <div>${escapeHtml(curiosity.body)}</div>
        </div>
      ` : ''}
      <div class="info-box">
        <span class="info-title">Interactive proofs</span>
        <div style="font-size:10px;color:var(--ink-2);margin:4px 0 6px">
          Step through why there are exactly five Platonic solids, and why dim(E₈) = 248.
        </div>
        <div class="seg">
          <button data-act="openProofs">Open proofs</button>
        </div>
      </div>
      <div class="info-box">
        <span class="info-title">Guided tour</span>
        <div style="font-size:10px;color:var(--ink-2);margin:4px 0 6px">
          Auto-cycles through ${TOUR_STOPS.length} views, narrating each with a short essay.
          Total runtime: <b>${mins}m ${secs}s</b>. Press <kbd>T</kbd> to start/stop.
        </div>
        <div class="seg">
          <button data-act="toggleTour">Start tour</button>
        </div>
      </div>
      ${daily ? `
        <div class="info-box daily-card">
          <span class="info-title">${escapeHtml(daily.title)}</span>
          <div style="font-size:10px;color:var(--ink-2);margin:4px 0 6px">${escapeHtml(daily.body)}</div>
          <div class="seg">
            <button data-act="claimDailyFact">${learning.dailyClaimedToday ? 'View today' : 'Claim today'}</button>
            <button data-act="openPostcardStudio">Postcard</button>
          </div>
          <div class="learn-progress">Streak ${summary.streak || 0} - ${summary.quizPassed || 0}/${summary.quizTotal || 0} quizzes - ${summary.postcardsCreated || 0} postcards</div>
        </div>
      ` : ''}
      <div class="ps-subtitle">Quizzes</div>
      <div class="quiz-grid">
        ${(learning?.quizzes || []).map(q => {
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
        ${(learning?.rewards || []).map(r => `
          <div class="reward-card ${unlocked.has(r.id) ? 'unlocked' : 'locked'}" title="${escapeHtml(r.description)}">
            <span class="reward-swatch" style="background:linear-gradient(135deg, ${r.colors.join(',')})"></span>
            <span>${escapeHtml(r.name)}</span>
            <small>${unlocked.has(r.id) ? 'unlocked' : 'cosmetic'}</small>
          </div>
        `).join('')}
      </div>
      <div class="ps-subtitle">Achievements</div>
      <div style="font-size:10px;color:var(--ink-2);margin:4px 0 8px">
        Badges earned by exploring, reading, and passing quizzes. All local — no accounts.
      </div>
      <div class="quiz-grid">
        ${BADGE_INFO.map(b => {
          const earned = (progress.badges || []).includes(b.id);
          return `<div class="quiz-card ${earned ? 'passed' : ''}" title="${escapeHtml(b.description)}">
            <span>${escapeHtml(b.name)}</span>
            <small>${earned ? '✓ earned' : escapeHtml(b.kind)}</small>
          </div>`;
        }).join('')}
      </div>
      <div class="info-box">
        <span class="info-title">Postcard Studio</span>
        <div style="font-size:10px;color:var(--ink-2);margin:4px 0 6px">
          Export a 9:16 PNG or WebM with an editable caption. No rating prompts, no forced posting.
        </div>
        <div class="seg">
          <button data-act="openPostcardStudio">Create postcard</button>
        </div>
      </div>
      <div class="ps-subtitle">Code-art gallery</div>
      <div style="font-size:10px;color:var(--ink-2);margin:4px 0 8px">
        Self-contained GLSL fragment-shader one-liners with E8 themes. Click any card to copy the code.
      </div>
      ${CODE_ART_SHADERS.map((s, idx) => `
        <div class="info-box" style="cursor:pointer" data-act="copyCodeArt" data-arg="${idx}" title="Click to copy">
          <span class="info-title">${escapeHtml(s.title)}</span>
          <div style="font-size:10px;color:var(--ink-2);margin:4px 0">${escapeHtml(s.description)}</div>
          <pre style="font-size:9px;color:var(--ink-1);margin:0;padding:6px;background:var(--bg-0);border:1px solid var(--line);border-radius:3px;overflow-x:auto;white-space:pre;line-height:1.3">${escapeHtml(s.code.slice(0, 200))}${s.code.length > 200 ? '\n...' : ''}</pre>
        </div>
      `).join('')}
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
    this.render();
  }

  setParams(params, options = {}) {
    this.params = params;
    // Always full-render — the new panel is cheap and context changes need full rebuild
    this.render();
  }

  render() {
    try {
      // Refresh the auto-animated set so slider() can render the ⟳ toggle state.
      _autoSliders = new Set(this.params.autoSliders || []);
      // Bug fix 2026-06-25: preserve scroll position across re-renders.
      // Earlier, every setParam call triggered refreshPanel() → full innerHTML
      // rewrite → scrollTop reset to 0. Now we save+restore the scrollTop
      // of the body element across the rewrite.
      const oldBody = this.panelEl.querySelector('#ps-body');
      const oldScrollTop = oldBody ? oldBody.scrollTop : 0;
      this.panelEl.classList.remove('collapsed');
      this.panelEl.innerHTML = `
        <div class="ps-status" id="ps-status"></div>
        <div class="ps-search-wrap" title="Filter controls by name (press / to focus)">
          <input class="ps-search" id="ps-search" type="search" placeholder="Filter controls…" autocomplete="off" aria-label="Filter panel controls">
          <span class="ps-search-kbd" title="Press / to focus">/</span>
        </div>
        <div class="ps-mode-tabs" role="tablist" aria-label="Control workspace">
          <button class="${this.params.panelMode !== 'learn' ? 'on' : ''}" data-act="setPanelMode" data-arg="create" role="tab" aria-selected="${this.params.panelMode !== 'learn' ? 'true' : 'false'}">Create</button>
          <button class="${this.params.panelMode === 'learn' ? 'on' : ''}" data-act="setPanelMode" data-arg="learn" role="tab" aria-selected="${this.params.panelMode === 'learn' ? 'true' : 'false'}">Learn</button>
        </div>
        <div class="ps-scroll" id="ps-body"></div>
        <div class="panel-footer">
          <button data-act="resetConfig" title="Reset all settings"><span style="font-size:13px">↺</span> Reset</button>
          <button data-act="surprise" title="Surprise: randomize view, palette, FX, shape, and shift settings for discovery"><span style="font-size:13px">✦</span> Surprise</button>
          <button data-act="sharePage" title="Copy the hosted E8 Studio link"><span style="font-size:13px">⎘</span> Share</button>
          <button data-act="shareSnapshot" title="Save a snapshot of the current render"><span style="font-size:13px">▣</span> Snapshot</button>
          <button data-act="openVideoExport" title="Record a video clip (720p+)"><span style="font-size:13px">⏺</span> Video</button>
          <button data-act="togglePresentationMode" title="Full screen: hide all chrome (press Esc to exit)"><span style="font-size:13px">⛶</span> Full</button>
          ${this.params.advancedStyle ? `
            <button data-act="togglePerf" title="Toggle performance overlay">Perf</button>
            <button data-act="toggleCommandPalette" title="Open command palette">Cmd</button>
            <button data-act="copyDiagnostics" title="Copy diagnostics">Diag</button>
            <button data-act="openCheatsheet" title="Open keyboard shortcuts">Keys</button>
            <div class="panel-shortcuts" aria-label="Keyboard shortcuts">
              <span><kbd>1–6</kbd> views</span><span><kbd>Space</kbd> pause</span><span><kbd>S</kbd> png</span>
              <span><kbd>T</kbd> tour</span><span><kbd>G</kbd> glossary</span><span><kbd>H</kbd> zen</span>
              <span><kbd>?</kbd> shortcuts</span><span><kbd>⌘K</kbd> commands</span>
            </div>
          ` : ''}
        </div>
      `;
      // Wire the control-filter search box (nice-to-have #5). We re-attach on
      // every render because innerHTML is rebuilt; the current query is
      // preserved across renders via _searchQuery so typing isn't lost.
      const search = this.panelEl.querySelector('#ps-search');
      if (search) {
        search.value = _searchQuery;
        search.addEventListener('input', (e) => {
          _searchQuery = e.target.value;
          applyPanelFilter(_searchQuery);
        });
      }
      const body = this.panelEl.querySelector('#ps-body');
      body.innerHTML = this.params.panelMode === 'learn'
        ? renderMathSection(this.params, this.data) + renderLearnSection(this.params)
        : renderViewSection(this.params, this.data) + renderStyleSection(this.params, this.data);
      applyPanelFilter(_searchQuery);
      // Restore scroll position
      body.scrollTop = oldScrollTop;
      this.renderStatus();
    } catch (e) {
      console.error('Panel render error:', e);
    }
  }

  renderStatus() {
    const el = this.panelEl.querySelector('#ps-status');
    if (!el) return;
    const p = this.params;
    el.innerHTML = `
      <div class="ps-status-row">
        <span class="ps-status-key">${p.view}</span>
        <span class="ps-status-sep">·</span>
        <span class="ps-status-key">${p.shape}</span>
        <span class="ps-status-sep">·</span>
        <span class="ps-status-key">${p.palette}</span>
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
  else if (params.cameraPath && params.cameraPath !== 'manual') key = 'cam';
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
  // No tab events needed — the new panel has no tabs
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

// ── Panel control filter / search (nice-to-have #5) ──────────────────────
// A live filter box that hides control rows whose label doesn't match the
// query. Survives panel re-renders via the module-level _searchQuery. When a
// query is active, sections with no visible rows are hidden too.
let _searchQuery = '';

/** Focus the panel search input (called from the '/' shortcut). */
export function focusPanelSearch() {
  const el = document.getElementById('ps-search');
  if (el) {
    // Expand the panel first if it's collapsed, otherwise the input is hidden.
    if (isPanelCollapsed()) togglePanelCollapsed();
    el.focus();
    el.select();
  }
}

/** Hide controls that don't match the query; hide empty sections.
 *  The panel is organized as `.ps-subtitle` headers each followed by a group
 *  of controls (`.seg` button grids, `.control-row` sliders, etc.). We match
 *  against the subtitle label plus every label/button inside the group, and
 *  hide whole groups (subtitle + body) that don't match. Standalone sliders
 *  without a preceding subtitle are matched on their own label. */
function applyPanelFilter(query) {
  const body = document.getElementById('ps-body');
  if (!body) return;
  const q = (query || '').trim().toLowerCase();
  // Reset: show everything.
  body.querySelectorAll('.ps-hidden').forEach(el => el.classList.remove('ps-hidden'));
  if (!q) return;

  // Walk the children of each section. A `.ps-subtitle` opens a group that
  // includes all following siblings until the next `.ps-subtitle` (or a
  // `.ps-title`/end). Match the group as a whole on its combined text.
  body.querySelectorAll('.ps-section').forEach(section => {
    let sectionHasMatch = false;
    const kids = Array.from(section.children);
    // Group: subtitle + the run of siblings after it until the next subtitle.
    let i = 0;
    while (i < kids.length) {
      const el = kids[i];
      if (el.classList && el.classList.contains('ps-subtitle')) {
        // Collect the subtitle + following siblings until next subtitle.
        const group = [el];
        let j = i + 1;
        while (j < kids.length && !(kids[j].classList && kids[j].classList.contains('ps-subtitle'))) {
          group.push(kids[j]);
          j++;
        }
        const text = group.map(g => g.textContent || '').join(' ').toLowerCase();
        const match = text.includes(q);
        group.forEach(g => g.classList.toggle('ps-hidden', !match));
        if (match) sectionHasMatch = true;
        i = j;
      } else {
        // Standalone element (slider row, info-box, etc.) — match on its own text.
        const text = (el.textContent || '').toLowerCase();
        const match = text.includes(q);
        el.classList.toggle('ps-hidden', !match);
        if (match) sectionHasMatch = true;
        i++;
      }
    }
    section.classList.toggle('ps-hidden', !sectionHasMatch);
  });
}
