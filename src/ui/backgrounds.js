export const BACKGROUND_PRESETS = {
  void:      { label: 'Void',    quality: 'low',    description: 'Flat palette-derived background' },
  starfield: { label: 'Stars',   quality: 'low',    description: 'Sparse procedural star field' },
  grid:      { label: 'Grid',    quality: 'low',    description: 'Technical perspective grid' },
  milkyway:  { label: 'Milky',   quality: 'medium', description: 'Banded dust and a warm galactic core' },
  aurora:    { label: 'Aurora',  quality: 'medium', description: 'Slow green and violet curtains' },
  ocean:     { label: 'Ocean',   quality: 'medium', description: 'Underwater caustic light through deep teal' },
  ember:     { label: 'Ember',   quality: 'medium', description: 'Glowing fire-coals with drifting heat' },
  frost:     { label: 'Frost',   quality: 'medium', description: 'Crystalline ice-cell edges' },
  cosmos:    { label: 'Cosmos',  quality: 'high',   description: 'Layered stars and warm/cool nebula gas' },
  deepfield: { label: 'Deep Field', quality: 'medium', description: 'Dense blue-white stars in near-black space' },
  magellan:  { label: 'Magellan', quality: 'high', description: 'Rose and cobalt clouds inspired by satellite galaxies' },
  stardust:  { label: 'Stardust', quality: 'high', description: 'Gold and violet interstellar dust lanes' },
  bluehour:  { label: 'Blue Hour', quality: 'medium', description: 'Quiet indigo star field with icy highlights' },
  mandala:   { label: 'Mandala', quality: 'high',   description: 'Six-fold responsive kaleidoscope' },
  plasma:    { label: 'Plasma',  quality: 'high',   description: 'Full-screen wave-interference field' },
  vortex:    { label: 'Vortex',  quality: 'high',   description: 'Swirling spiral nebula with a bright core' },
  quantum:   { label: 'Quantum', quality: 'high',   description: 'Animated quantum-foam node network' },
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
