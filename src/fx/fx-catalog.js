// Canonical user-facing effect catalog and renderer capability policy.
//
// Numeric shader IDs remain in fx-shader.js. This module adds the information
// the UI and router need to avoid presenting a mode that the active renderer
// cannot draw, and to keep expensive modes off constrained quality tiers.

import { FX_MODE_MAP } from './fx-shader.js';

const SHARED_VIEWS = Object.freeze([
  'bloom', 'platonic', 'e8coxeter', 'sixhundred', 'polytope',
]);

const SDF_VIEWS = Object.freeze(['raymarched']);

function effect(id, label, description, {
  cost = 'low', target = 'surface', shared = true, sdf = false,
} = {}) {
  if (!Object.hasOwn(FX_MODE_MAP, id)) {
    throw new Error(`Effect catalog contains unknown shader mode: ${id}`);
  }
  return Object.freeze({
    id,
    shaderId: FX_MODE_MAP[id],
    label,
    description,
    cost,
    target,
    views: Object.freeze([
      ...(shared ? SHARED_VIEWS : []),
      ...(sdf ? SDF_VIEWS : []),
    ]),
  });
}

export const FX_EFFECTS = Object.freeze([
  effect('none', 'Off', 'Use the renderer’s clean, unmodified shading.', { sdf: true }),
  effect('glow', 'Glow', 'Adds a luminous rim and brighter highlights.', { sdf: true }),
  effect('pulse', 'Pulse', 'Breathes the form gently over time.', { target: 'geometry', sdf: true }),
  effect('trail', 'Trail', 'Fades point color history behind moving geometry.', { cost: 'medium', target: 'motion' }),
  effect('chromatic', 'Chrom', 'Separates color channels across the form.'),
  effect('kaleidoscope', 'Kaleid', 'Mirrors point motion into a kaleidoscopic pattern.', { cost: 'medium', target: 'geometry' }),
  effect('ripple', 'Ripple', 'Sends a radial wave through point positions.', { target: 'geometry' }),
  effect('spiral', 'Spiral', 'Twists points around the view axis.', { target: 'geometry' }),
  effect('fog', 'Fog', 'Fades the structure into depth.', { target: 'depth' }),
  effect('heat', 'Heat', 'Maps warm energy bands across the surface.', { sdf: true }),
  effect('edge-glow', 'Edge', 'Emphasizes silhouettes and structural edges.'),
  effect('aura', 'Aura', 'Adds a soft animated field around points.'),
  effect('voronoi', 'Voronoi', 'Cuts a procedural cellular pattern into points.', { cost: 'high', target: 'procedural' }),
  effect('caustic', 'Caustic', 'Adds moving refractive light bands.', { cost: 'medium', target: 'procedural' }),
  effect('iridescent', 'Irides', 'Shifts color with viewing angle like thin-film light.', { sdf: true }),
  effect('flowfield', 'Flow', 'Displaces points through an animated vector field.', { cost: 'medium', target: 'geometry' }),
  effect('plasma', 'Plasma', 'Adds animated plasma color bands.', { cost: 'medium', target: 'procedural' }),
  effect('kaleido6', 'K6', 'Applies six-fold procedural symmetry.', { cost: 'medium', target: 'procedural' }),
  effect('dof', 'DOF', 'Varies point scale and opacity with depth.', { cost: 'medium', target: 'depth' }),
  effect('nebula', 'Nebula', 'Breaks points into a drifting cloudy field.', { cost: 'medium', target: 'procedural' }),
  effect('wireframe', 'Wire', 'Reduces point shading to a technical wire look.'),
  effect('hologram', 'Holo', 'Adds cyan scanlines and digital flicker.', { sdf: true }),
  effect('xray', 'X-ray', 'Reveals the form with cool rims and dark interiors.', { sdf: true }),
  effect('crystal', 'Crystal', 'Adds sharp faceted highlights to point geometry.'),
]);

export const FX_BY_ID = Object.freeze(Object.fromEntries(
  FX_EFFECTS.map(item => [item.id, item])
));

export const FX_MODE_NAMES = Object.freeze(FX_EFFECTS.map(item => item.id));

// Six clear starting points. The underlying mode names remain available in the
// Advanced catalog, but the default UI speaks in creative outcomes.
export const CURATED_LOOKS = Object.freeze([
  Object.freeze({ mode: 'none', label: 'Clean', description: 'Original renderer shading' }),
  Object.freeze({ mode: 'glow', label: 'Luminous', description: 'Bright rim and highlights' }),
  Object.freeze({ mode: 'iridescent', label: 'Prismatic', description: 'View-angle color shift' }),
  Object.freeze({ mode: 'pulse', label: 'Organic', description: 'Slow breathing motion' }),
  Object.freeze({ mode: 'xray', label: 'Technical', description: 'Cool structural silhouette' }),
  Object.freeze({ mode: 'hologram', label: 'Cinematic', description: 'Digital scanline treatment' }),
]);

const COST_RANK = Object.freeze({ low: 0, medium: 1, high: 2 });
const QUALITY_LIMIT = Object.freeze({ auto: 1, low: 0, medium: 1, high: 2 });

export function effectSupportsView(view, mode) {
  const item = FX_BY_ID[mode];
  return Boolean(item && item.views.includes(view));
}

export function effectAvailableForQuality(mode, quality = 'high') {
  const item = FX_BY_ID[mode];
  if (!item) return false;
  const limit = QUALITY_LIMIT[quality] ?? QUALITY_LIMIT.high;
  return COST_RANK[item.cost] <= limit;
}

export function effectAvailableForView(view, mode, quality = 'high') {
  return effectSupportsView(view, mode) && effectAvailableForQuality(mode, quality);
}

export function coerceEffectMode(view, mode, quality = 'high') {
  return effectAvailableForView(view, mode, quality) ? mode : 'none';
}

export function effectsForView(view, quality = 'high', { includeUnavailable = false } = {}) {
  return FX_EFFECTS.filter(item => item.views.includes(view)
    && (includeUnavailable || effectAvailableForQuality(item.id, quality)));
}

export function rememberEffectForView(params, view = params?.view) {
  if (!params || !view) return;
  if (!params.fxByView || typeof params.fxByView !== 'object' || Array.isArray(params.fxByView)) {
    params.fxByView = {};
  }
  params.fxByView[view] = coerceEffectMode(
    view,
    params.fxMode,
    params.reducedMode ? 'low' : (params.mobileQuality || 'high')
  );
}

export function restoreEffectForView(params, view) {
  if (!params || !view) return 'none';
  const quality = params.reducedMode ? 'low' : (params.mobileQuality || 'high');
  const remembered = params.fxByView && typeof params.fxByView === 'object'
    ? params.fxByView[view]
    : 'none';
  const mode = coerceEffectMode(view, remembered, quality);
  if (!params.fxByView || typeof params.fxByView !== 'object' || Array.isArray(params.fxByView)) {
    params.fxByView = {};
  }
  params.fxByView[view] = mode;
  params.fxMode = mode;
  return mode;
}
