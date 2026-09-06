export const BACKGROUND_PRESETS = {
  void:      { label: 'Void',    quality: 'low',    description: 'Flat palette-derived background' },
  starfield: { label: 'Space',   quality: 'low',    description: 'Sparse procedural star field' },
  tide:      { label: 'Tide',    quality: 'high',   description: 'Rolling ocean swells with reflections, sculpted crests, and sea foam' },
  aurora:    { label: 'Cloud',   quality: 'medium', description: 'White billowing clouds, silver light, and soft neutral shadows' },
  cosmos:    { label: 'Cosmos',  quality: 'high',   description: 'A dense galactic star field with luminous star clouds and dark dust lanes' },
  mandala:   { label: 'Mandala', quality: 'high',   description: 'Antique gold relief, blue and teal enamel, engraved rosettes, and a green central eye' },
  plasma:    { label: 'Plasma',  quality: 'high',   description: 'Flowing magenta, orange, and cyan plasma with luminous folds, fine sparks, and a slow color shift' },
  vortex:    { label: 'Vortex',  quality: 'high',   description: 'White hurricane clouds and turbulent rainbands around a dark eye' },
  quantum:   { label: 'Quantum', quality: 'high',   description: 'Hydrogen 4f probability cloud, with luminous density and dark angular nodes' },
  eclipse:   { label: 'Eclipse', quality: 'low',    description: 'Black lunar disk framed by a living amber corona' },
  ember:     { label: 'Ember',   quality: 'medium', description: 'Amber sparks drifting through warm, dark haze' },
  prism:     { label: 'Prism',   quality: 'medium', description: 'A white glass triangle splitting white light into a rainbow' },
};

export const BG_MODES = Object.freeze(Object.keys(BACKGROUND_PRESETS));
const QUALITY_LEVEL = { low: 0, medium: 1, high: 2, auto: 1 };
const BACKGROUND_ALIASES = Object.freeze({ grid: 'tide', synthwave: 'ember', barset: 'ember', cloud: 'aurora', space: 'starfield' });

export function normalizeBackgroundMode(mode) {
  const id = Object.hasOwn(BACKGROUND_ALIASES, mode) ? BACKGROUND_ALIASES[mode] : mode;
  return Object.hasOwn(BACKGROUND_PRESETS, id) ? id : 'void';
}

export function backgroundModesForQuality(quality = 'high') {
  const level = QUALITY_LEVEL[quality] ?? QUALITY_LEVEL.high;
  return BG_MODES.filter(mode => QUALITY_LEVEL[BACKGROUND_PRESETS[mode].quality] <= level);
}

export function coerceBackgroundForQuality(mode, quality = 'high') {
  mode = normalizeBackgroundMode(mode);
  const allowed = backgroundModesForQuality(quality);
  return allowed.includes(mode) ? mode : 'void';
}
