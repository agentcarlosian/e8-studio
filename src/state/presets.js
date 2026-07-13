// presets.js — Hand-crafted view configurations for quick exploration
//
// Each preset is a partial params override that gets merged with the user's
// current config when applied. This lets users discover interesting views
// without having to manually tune 10+ sliders.

export const PRESETS = [
  {
    id: 'classic-e8',
    name: 'Classic E8',
    description: 'Default: gold palette, E8 Coxeter projection, static',
    icon: '◉',
    params: {
      palette: 'gold',
      blendMode: 'spectrum',
      shiftMode: 'static',
      fxMode: 'none',
      autoRotate: false,
    },
  },
  {
    id: 'rainbow-flow',
    name: 'Rainbow Flow',
    description: 'Vibrant rainbow palette cycling through 7 colors',
    icon: '🌈',
    params: {
      palette: 'rainbow',
      blendMode: 'spectrum',
      shiftMode: 'rainbow',
      shiftSpeed: 2.5,
      fxMode: 'glow',
      fxIntensity: 0.7,
      autoRotate: true,
      cameraMode: 'orbit',
    },
  },
  {
    id: 'breathing-pulse',
    name: 'Breathing Pulse',
    description: 'Cosmic purple palette with pulse breathing',
    icon: '💓',
    params: {
      palette: 'cosmic',
      blendMode: 'spectrum',
      shiftMode: 'static',
      fxMode: 'pulse',
      fxIntensity: 0.8,
      autoRotate: false,
    },
  },
  {
    id: 'nested-rainbow',
    name: 'Prism Rainbow',
    description: 'Prism spectrum with a flowing Platonic solid',
    icon: '⬡',
    params: {
      palette: 'prism',
      blendMode: 'spectrum',
      shiftMode: 'rainbow',
      shiftSpeed: 1.5,
      fxMode: 'glow',
      fxIntensity: 0.6,
      autoRotate: true,
    },
  },
  {
    id: 'cosmic-figure8',
    name: 'Cosmic Figure-8',
    description: 'Cosmic palette + Figure-8 camera + Chromatic FX',
    icon: '∞',
    params: {
      palette: 'cosmic',
      blendMode: 'spectrum',
      shiftMode: 'static',
      fxMode: 'chromatic',
      fxIntensity: 0.6,
      autoRotate: true,
      cameraMode: 'figure8',
      cameraSpeed: 0.8,
    },
  },
  {
    id: 'fire-bloom',
    name: 'Fire Bloom',
    description: 'Fire gradient palette + Bloom view + Trail FX',
    icon: '🜂',
    params: {
      palette: 'fire',
      blendMode: 'spectrum',
      shiftMode: 'fire',
      shiftSpeed: 1.0,
      fxMode: 'trail',
      fxIntensity: 0.5,
      autoRotate: false,
      view: 'bloom',
      bloomAmount: 0.5,
    },
  },
  {
    id: 'mystic-mirror',
    name: 'Mystic Mirror',
    description: 'Plum gradient with mirror blend mode',
    icon: '✦',
    params: {
      palette: 'plum',
      blendMode: 'mirror',
      shiftMode: 'static',
      fxMode: 'kaleidoscope',
      fxIntensity: 0.6,
      autoRotate: false,
    },
  },
  {
    id: 'deep-fog',
    name: 'Deep Fog',
    description: 'Void palette with depth fog FX',
    icon: '☁',
    params: {
      palette: 'void',
      blendMode: 'spectrum',
      shiftMode: 'static',
      fxMode: 'fog',
      fxIntensity: 0.7,
      autoRotate: true,
      cameraMode: 'pullback',
    },
  },
];

export function applyPreset(preset, params) {
  // Shallow merge: preset overrides current params for the keys it defines
  for (const k of Object.keys(preset.params)) {
    params[k] = preset.params[k];
  }
  return params;
}
