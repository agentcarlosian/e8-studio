// palettes.js — multi-color palette system with blending patterns.
//
// Each preset in PALETTE_PRESETS is keyed by its name and defines:
//   - colors:         2-5 base hex colors that get blended
//   - bgDarken:       0..1 how strongly the bg color is darkened (1 = black bg)
//   - description:    human-readable label shown in the palette picker tooltip
//
// The *blend mode* (how those colors are combined) is NOT stored per-palette —
// it's a separate global control (params.blendMode, one of BLEND_MODES) passed
// into colorAt(name, t, blendMode). Any palette can be drawn with any blend.

import chroma from 'chroma-js';

// 24 multi-color palette presets — each has 2-4 colors that get blended.
// "bgDarken" is how strongly to darken the brightest color toward black for the background.
export const PALETTE_PRESETS = {
  // Mono / single-hue variants — kept for the minimalists
  gold:       { colors: ['#fff2b2', '#f4d27a', '#f0a04b', '#9b4f18'], bgDarken: 0.93, description: 'luminous warm gold' },
  ember:      { colors: ['#ffd08a', '#ff9550', '#e44b24', '#7f1818'], bgDarken: 0.94, description: 'banked ember glow' },
  ice:        { colors: ['#ffffff', '#d6e8ff', '#7fb8ff', '#6076d9'], bgDarken: 0.94, description: 'glacial blue light' },

  // Two-color complementary blends
  ocean:      { colors: ['#5ec9ff', '#9b4dff'], bgDarken: 0.92, description: 'ocean + violet' },
  forest:     { colors: ['#7df9c8', '#00d68f'], bgDarken: 0.92, description: 'mint + jade' },
  sunset:     { colors: ['#ff6b9d', '#ff9550'], bgDarken: 0.92, description: 'pink + ember' },
  cosmic:     { colors: ['#4dffff', '#9b4dff'], bgDarken: 0.94, description: 'cyan + violet' },
  lavender:   { colors: ['#c8a2ff', '#ff6b9d'], bgDarken: 0.93, description: 'lavender + pink' },
  amber:      { colors: ['#ffb000', '#ff5500'], bgDarken: 0.92, description: 'amber + orange' },
  jade:       { colors: ['#00d68f', '#1e90ff'], bgDarken: 0.92, description: 'jade + blue' },

  // Three-color gradients — bolder
  rainbow:    { colors: ['#ff3300', '#ffcc00', '#00d68f', '#4dffff', '#9b4dff'], bgDarken: 0.94, description: '5-color spectrum' },
  fire:       { colors: ['#ff0066', '#ff3300', '#ffb000'], bgDarken: 0.93, description: 'fire gradient' },
  ocean_deep: { colors: ['#001f3f', '#0074d9', '#7fdbff'], bgDarken: 0.95, description: 'ocean depths' },
  neon:       { colors: ['#ff00d4', '#00ffea', '#c8ff00'], bgDarken: 0.94, description: 'neon synth' },
  prism:      { colors: ['#ff0040', '#ffaa00', '#40ff00', '#00aaff', '#aa00ff'], bgDarken: 0.95, description: 'prism spectrum' },

  // Four-color rich gradients
  aurora:     { colors: ['#00d68f', '#4dffff', '#c8a2ff', '#ff6b9d'], bgDarken: 0.94, description: 'aurora borealis' },
  plum:       { colors: ['#9b4dff', '#ff00d4', '#ff6b9d', '#ff9550'], bgDarken: 0.94, description: 'plum + magenta' },
  bronze:     { colors: ['#ffb000', '#ff5500', '#cc3a1a', '#660033'], bgDarken: 0.93, description: 'bronze metal' },
  sakura:     { colors: ['#ffb3d1', '#c8a2ff', '#7fb8ff', '#7fffaf'], bgDarken: 0.93, description: 'cherry blossom' },

  // Tri-tone neutral
  mono:       { colors: ['#f0f0f0', '#808080', '#1a1a1a'], bgDarken: 0.97, description: 'monochrome' },
  void:       { colors: ['#ffffff', '#aaaaaa', '#444444'], bgDarken: 0.99, description: 'pure void' },

  // Mathematical — based on constants
  golden:     { colors: ['#ffd700', '#ffb000', '#ff7700', '#cc4400'], bgDarken: 0.94, description: 'φ-golden gradient' },
  prime:      { colors: ['#ff0066', '#00ddaa', '#4488ff', '#aa44ff'], bgDarken: 0.94, description: 'prime colors' },
  binary:     { colors: ['#ffffff', '#000000'], bgDarken: 0.96, description: 'black/white' },

  // Earthy
  terra:      { colors: ['#8b4513', '#cd853f', '#daa520', '#556b2f'], bgDarken: 0.95, description: 'earth tones' },

  // ── Round 11 curated palettes — broader aesthetic range ──
  // Each pairs naturally with one or more of the new background moods.

  // Deep-sea / abyssal — pairs with the Ocean + Frost backgrounds.
  abyss:      { colors: ['#0fffc0', '#1a8aaa', '#0a3d62', '#4ecdc4'], bgDarken: 0.96, description: 'deep abyssal teal' },
  coral:      { colors: ['#ff6b6b', '#ff9ff3', '#feca57', '#48dbfb'], bgDarken: 0.93, description: 'coral reef' },

  // Volcanic / molten — pairs with the Ember background.
  magma:      { colors: ['#fff200', '#ff8c00', '#ff3300', '#7a0010'], bgDarken: 0.95, description: 'molten magma' },
  obsidian:   { colors: ['#9b59b6', '#34495e', '#2c3e50', '#000000'], bgDarken: 0.98, description: 'obsidian + violet' },

  // Ethereal pastels — soft, high-key, dreamlike.
  cotton:     { colors: ['#ffb3d9', '#b3d9ff', '#d9ffb3', '#ffffb3'], bgDarken: 0.90, description: 'cotton candy' },
  spectral:   { colors: ['#e1bee7', '#b2dfdb', '#fff9c4', '#ffccbc'], bgDarken: 0.93, description: 'soft spectral mist' },

  // High-energy neon variants — distinct from the existing 'neon'.
  synthwave:  { colors: ['#ff006e', '#fb5607', '#ffbe0b', '#8338ec'], bgDarken: 0.95, description: '80s synthwave' },
  cyberpunk:  { colors: ['#00f5ff', '#ff00ff', '#fffc00', '#ff0080'], bgDarken: 0.96, description: 'cyberpunk signage' },

  // Studio palettes designed around luminous point clouds and SDF surfaces.
  ultraviolet:{ colors: ['#1b103f', '#643cff', '#d83cff', '#ff6b9d', '#ffb45e'], bgDarken: 0.97, description: 'ultraviolet bloom' },
  biolume:    { colors: ['#062f38', '#00a896', '#00ffd5', '#b8ff70', '#eaffc7'], bgDarken: 0.97, description: 'living bioluminescence' },
  opal:       { colors: ['#e8ffff', '#9de7ee', '#c5b8ff', '#ffbad2', '#ffd6a0'], bgDarken: 0.94, description: 'iridescent opal' },
  solar_flare:{ colors: ['#fffbd1', '#ffe66d', '#ff9f1c', '#ff3d00', '#7a0019'], bgDarken: 0.96, description: 'white-hot solar flare' },
  rose_gold:  { colors: ['#fff0ea', '#f3b6ad', '#c77b6b', '#8e4560', '#3e1738'], bgDarken: 0.95, description: 'rose gold metal' },
  electric:   { colors: ['#071a52', '#0066ff', '#00d9ff', '#e8ffff', '#8c7bff'], bgDarken: 0.98, description: 'electric blue arc' },
  viridian:   { colors: ['#052e2b', '#087f5b', '#20c997', '#a9e34b', '#ffe066'], bgDarken: 0.97, description: 'viridian mineral' },
  midnight:   { colors: ['#050816', '#152b65', '#3f60d9', '#9a7cff', '#ff82bd'], bgDarken: 0.98, description: 'midnight celestial' },

  // ── E8 reference palettes — based on canonical Wikipedia visualizations ──

  // Petrie: the canonical E8 chord-class coloring from E8Petrie.svg
  // 4 pure colors map to the 4 major chord-distance classes.
  // #0000FF blue (short), #00FF00 green (medium-short),
  // #FF0000 red (medium-long), #7F7F7F gray (longest).
  // On a black background so the colors pop like the original.
  petrie:     { colors: ['#0000ff', '#00ff00', '#ff0000', '#7f7f7f'], bgDarken: 0.99, description: 'E8 chord-class (Petrie)' },

  // Thread: the bright pastel style of E8-with-thread.jpg
  // Near-white core with soft lavender, teal, and pink point colors.
  // Light, airy feel on a dark navy background.
  thread:     { colors: ['#e0e0f0', '#d0e0e0', '#e0d0d0', '#d0d0e0'], bgDarken: 0.96, description: 'E8 thread (pastel)' },

  // Vintage: the muted warm-gray printed look of the 2010 E8 photo
  // Dusty taupe and warm grays, earthy and desaturated.
  vintage:    { colors: ['#b09090', '#a09090', '#c0a0a0', '#a0a0a0'], bgDarken: 0.95, description: 'E8 vintage (warm gray)' },
};

// ── Structure colorings ─────────────────────────────────────────────────────
// What drives an element's color is a MATHEMATICAL INVARIANT of that element, not
// a generic gradient pattern. This is deliberately specific to the exceptional-
// geometry domain: "color by Coxeter shell / projection phase / ℝ⁸ axis" only
// means something here, which is what gives the tool its own identity (vs. a
// generic parametric-pattern generator). The chosen invariant produces a
// position t∈[0,1] that samples the active palette via colorAt().
export const COLORINGS = {
  shell:  'Coxeter shell — which concentric ring of the projection',
  radius: 'Coxeter radius — continuous distance in the projection plane',
  phase:  'Coxeter phase — rotation angle of the Petrie projection',
  axis:   'Coordinate axis — dominant of the eight ℝ⁸ basis directions',
  index:  'Index order — sequential through the root list',
  mono:   'Single hue — one palette color',
};
export const COLORING_NAMES = Object.keys(COLORINGS);

/**
 * Map an E8 root to a palette position t∈[0,1] from a structural invariant
 * (see COLORINGS). Shared by the live E8 view AND the SVG export so colours stay
 * consistent between screen and the exported vector.
 *   p        — projected root { x, y, r, ring }
 *   root8d   — the root's 8-D coordinates (for 'axis')
 *   i, n     — index and total count (for 'index')
 *   ringCount, maxR — projection metadata
 */
export function e8ColoringT(mode, p, root8d, i, n, ringCount, maxR) {
  switch (mode) {
    case 'radius': return maxR > 0 ? p.r / maxR : 0;
    case 'phase':  return (Math.atan2(p.y, p.x) + Math.PI) / (2 * Math.PI);
    case 'axis': {
      let mi = 0, mv = -1;
      for (let k = 0; k < 8; k++) { const a = Math.abs(root8d[k]); if (a > mv) { mv = a; mi = k; } }
      return mi / 7;
    }
    case 'index': return i / Math.max(1, n - 1);
    case 'mono':  return 0.5;
    case 'shell':
    default:      return (p.ring || 0) / Math.max(1, ringCount - 1);
  }
}

// Low-level palette-mixing patterns (how the colors of a multi-color palette are
// combined once a position t is chosen). These are internal — the user-facing
// control is COLORINGS above. `spectrum` is the default sampler.
export const BLEND_MODES = {
  spectrum:  'mix all colors smoothly along a gradient',
  sector:    'split colors by angle/position (color wheels)',
  radial:    'inner color → outer color (radial gradient)',
  random:    'random color per element',
  mirror:    'reflect colors across center',
};

// Animated color-shift presets — each cycles through several palettes
export const SHIFT_PRESETS = {
  static:    [],
  sunset:    ['ember', 'sunset', 'amber', 'plum'],
  rainbow:   ['rainbow', 'prism', 'aurora', 'neon', 'cosmic', 'golden'],
  fire:      ['fire', 'ember', 'amber', 'bronze'],
  cool:      ['ocean_deep', 'cosmic', 'ice', 'ocean', 'jade'],
  warm:      ['amber', 'sunset', 'plum', 'golden'],
  earth:     ['terra', 'bronze', 'amber', 'golden'],
  petrie:    ['petrie', 'thread', 'gold', 'vintage'],  // E8 reference palettes
  // Round 11: shift cycles through the new palette families.
  abyss:     ['abyss', 'ocean_deep', 'coral', 'cosmic'],   // deep-sea cycle
  synth:     ['synthwave', 'cyberpunk', 'neon', 'plum'],   // neon-energy cycle
  dream:     ['cotton', 'spectral', 'sakura', 'aurora'],   // ethereal pastel cycle
  ultraviolet: ['midnight', 'ultraviolet', 'plum', 'electric'],
  biolume:   ['abyss', 'biolume', 'viridian', 'aurora'],
  mineral:   ['opal', 'rose_gold', 'ice', 'gold'],
  solar:     ['gold', 'solar_flare', 'magma', 'ember'],
  // Note: the random-mode entry was removed 2026-06-25 — it changed palette
  // every frame, producing a strobing/wig-out effect. The animate loop now
  // filters out random from the picker entirely.
};

const ROLE_KEYS = ['bg', 'p', 's', 't', 'q', 'ink'];

/** Pick a color from a palette at parametric position t∈[0,1] using a blend mode. */
export function colorAt(name, t, blendMode = 'spectrum') {
  const p = PALETTE_PRESETS[name] || PALETTE_PRESETS.gold;
  const colors = p.colors;
  if (!colors || colors.length === 0) return '#888888';
  if (colors.length === 1) return colors[0];

  switch (blendMode) {
    case 'spectrum': {
      // Smooth interpolation along the color list
      const tt = Math.max(0, Math.min(1, t));
      const segs = colors.length - 1;
      const idx = Math.min(Math.floor(tt * segs), segs - 1);
      const local = (tt * segs) - idx;
      return chroma.scale([colors[idx], colors[idx + 1]])(local).hex();
    }
    case 'sector': {
      // Round-robin assignment by fractional position
      const idx = Math.floor(t * colors.length) % colors.length;
      return colors[idx];
    }
    case 'radial': {
      // Bicolor fade (inner → outer uses first→last color)
      const tt = Math.max(0, Math.min(1, t));
      return chroma.scale([colors[0], colors[colors.length - 1]])(tt).hex();
    }
    case 'random': {
      // Deterministic-ish: hash t to pick a color
      const idx = Math.floor(Math.abs(Math.sin(t * 12345.678 + name.length)) * colors.length) % colors.length;
      return colors[idx];
    }
    case 'mirror': {
      // Reflect: 0..0.5 fades from colors[0] to last, 0.5..1 fades back
      const tt = Math.max(0, Math.min(1, t));
      const phase = tt < 0.5 ? tt * 2 : (1 - tt) * 2;
      return chroma.scale([colors[0], colors[colors.length - 1]])(phase).hex();
    }
    default:
      return colors[Math.floor(t * colors.length) % colors.length];
  }
}

/** Build a palette object with named roles for the page chrome. */
export function buildPalette(name) {
  const p = PALETTE_PRESETS[name] || PALETTE_PRESETS.gold;
  const base = p.colors[0];
  // Background: take the SECOND color (or last) and darken it heavily
  const bgColor = p.colors[p.colors.length - 1] || base;
  const bg = chroma.mix(bgColor, '#000000', p.bgDarken, 'lab').hex();
  // Foreground roles sampled from the palette
  const out = {};
  ROLE_KEYS.forEach((role, i) => {
    out[role] = colorAt(name, (i + 0.5) / ROLE_KEYS.length, 'spectrum');
  });
  out.bg = bg;
  return out;
}

export const PALETTE_NAMES = Object.keys(PALETTE_PRESETS);

export const PALETTE_FAMILIES = {
  essentials: { label: 'Essentials', description: 'Clear, restrained studio defaults' },
  nature: { label: 'Nature', description: 'Mineral, oceanic, botanical, and atmospheric color' },
  energy: { label: 'Energy', description: 'Neon, spectral, and high-intensity gradients' },
  mathematical: { label: 'Mathematical', description: 'Reference and structure-led color systems' },
};

const PALETTE_FAMILY_MEMBERS = {
  essentials: ['gold', 'ember', 'ice', 'mono', 'void'],
  nature: ['ocean', 'forest', 'sunset', 'lavender', 'amber', 'jade', 'ocean_deep', 'aurora', 'terra', 'abyss', 'coral', 'magma', 'obsidian', 'cotton', 'spectral', 'sakura', 'biolume', 'opal', 'rose_gold', 'viridian'],
  energy: ['cosmic', 'rainbow', 'fire', 'neon', 'prism', 'plum', 'bronze', 'synthwave', 'cyberpunk', 'ultraviolet', 'solar_flare', 'electric', 'midnight'],
  mathematical: ['golden', 'prime', 'binary', 'petrie', 'thread', 'vintage'],
};

export const PALETTE_GROUPS = Object.freeze(Object.entries(PALETTE_FAMILIES).map(([id, meta]) => ({
  id,
  ...meta,
  palettes: Object.freeze(PALETTE_FAMILY_MEMBERS[id] || []),
})));

export function paletteFamily(name) {
  return PALETTE_GROUPS.find(group => group.palettes.includes(name))?.id || 'essentials';
}

/** Render a small CSS background that previews a palette+blend combination. */
export function palettePreviewCSS(name, blendMode) {
  const p = PALETTE_PRESETS[name];
  if (!p) return '#888';
  if (blendMode === 'spectrum') {
    return `linear-gradient(90deg, ${p.colors.join(', ')})`;
  }
  if (blendMode === 'sector') {
    return `conic-gradient(${p.colors.map((c, i) => `${c} ${i * 360 / p.colors.length}deg ${(i + 1) * 360 / p.colors.length}deg`).join(', ')})`;
  }
  if (blendMode === 'radial') {
    return `radial-gradient(circle, ${p.colors[0]} 0%, ${p.colors[p.colors.length - 1]} 100%)`;
  }
  return `linear-gradient(45deg, ${p.colors.join(', ')})`;
}
