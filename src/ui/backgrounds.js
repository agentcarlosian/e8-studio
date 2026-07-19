export const BACKGROUND_PRESETS = {
  void:      { label: 'Void',    quality: 'low',    description: 'Flat palette-derived background' },
  starfield: { label: 'Space',   quality: 'low',    description: 'Sparse procedural star field' },
  grid:      { label: 'Grid',    quality: 'low',    description: 'Technical perspective grid' },
  aurora:    { label: 'Cloud',   quality: 'medium', description: 'Slow green and violet cloud curtains' },
  cosmos:    { label: 'Cosmos',  quality: 'high',   description: 'Layered stars and warm/cool nebula gas' },
  mandala:   { label: 'Mandala', quality: 'high',   description: 'Six-fold responsive kaleidoscope' },
  plasma:    { label: 'Plasma',  quality: 'high',   description: 'Full-screen wave-interference field' },
  vortex:    { label: 'Vortex',  quality: 'high',   description: 'Swirling spiral nebula with a bright core' },
  quantum:   { label: 'Quantum', quality: 'high',   description: 'Animated quantum-foam node network' },
  eclipse:   { label: 'Eclipse', quality: 'low',    description: 'Black lunar disk framed by a living amber corona' },
  synthwave: { label: 'Barset',  quality: 'medium', description: 'Neon sunset over a receding horizon grid' },
  prism:     { label: 'Prism',   quality: 'medium', description: 'Glass triangle splitting a beam into colored light' },
};

export const BG_MODES = Object.freeze(Object.keys(BACKGROUND_PRESETS));
const QUALITY_LEVEL = { low: 0, medium: 1, high: 2, auto: 1 };

export function backgroundModesForQuality(quality = 'high') {
  const level = QUALITY_LEVEL[quality] ?? QUALITY_LEVEL.high;
  return BG_MODES.filter(mode => QUALITY_LEVEL[BACKGROUND_PRESETS[mode].quality] <= level);
}

export function coerceBackgroundForQuality(mode, quality = 'high') {
  const allowed = backgroundModesForQuality(quality);
  return allowed.includes(mode) ? mode : 'void';
}
