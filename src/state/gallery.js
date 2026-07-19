// Curated gallery scenes and their deterministic reset baseline.

export const GALLERY_PRESETS = [
  { id: 'coxeter-rings', name: 'Coxeter Rings', settings: { view: 'e8coxeter', e8ViewMode: 'coxeter', shape: 'icosahedron', compareShape: 'dodecahedron', compareMode: 'overlay', showRings: true, showPetrie: true, showEdges: false, rootDiffusion: true, showWeylMirrors: true, palette: 'petrie', fxMode: 'glow', fxIntensity: 0.45, autoRotate: false, e8MorphT: 0, cameraPath: 'coxeterOrbit' } },
  { id: 'subset-diff', name: 'Subset Difference', settings: { view: 'e8coxeter', e8ViewMode: 'coxeter', shape: 'cube', compareShape: 'octahedron', compareMode: 'difference', showRings: true, showPetrie: false, palette: 'prime', rootDiffusion: true, rootHaloDepth: 3, fxMode: 'edge-glow', fxIntensity: 0.35 } },
  { id: 'sdf-metal', name: 'SDF Metal', settings: { view: 'raymarched', palette: 'mono', sdfBloom: 0.65, sdfEdges: 0.55, sdfAniso: 0.8, autoRotate: true, cameraMode: 'orbit', fxMode: 'none' } },
  { id: 'platonic-bloom', name: 'Platonic Bloom', settings: { view: 'bloom', shape: 'dodecahedron', bloomAmount: 0.58, bloomAuto: true, palette: 'aurora', fxMode: 'pulse', fxIntensity: 0.35, h4TwinReveal: true } },
  { id: '600-bridge', name: '600 Bridge', settings: { view: 'sixhundred', shape: 'icosahedron', palette: 'golden', showEdges: true, autoRotate: true, fxMode: 'heat', fxIntensity: 0.25 } },
  { id: 'weyl-chamber', name: 'Weyl Chamber', settings: { view: 'e8coxeter', e8ViewMode: 'petrie', palette: 'cosmic', showWeylMirrors: true, weylOrbit: true, showPetrie: true, rootDiffusion: true, cameraPath: 'petrieSpiral', fxMode: 'chromatic', fxIntensity: 0.25 } },
  { id: 'twin-600', name: 'Twin 600', settings: { view: 'e8coxeter', e8ViewMode: 'h4', palette: 'sunset', e8Twin600: true, e8MorphT: 0.42, rootDiffusion: false, showWeylMirrors: false, cameraPath: 'h4Reveal', fxMode: 'glow', fxIntensity: 0.3 } },
  { id: 'aurora-borealis', name: 'Aurora Borealis', settings: { view: 'bloom', shape: 'icosahedron', palette: 'aurora', bgMode: 'aurora', bgIntensity: 0.85, bloomAmount: 0.65, bloomAuto: true, fxMode: 'aura', fxIntensity: 0.45, autoRotate: true, rotationSpeed: 0.005, h4TwinReveal: false } },
  { id: 'deep-space', name: 'Deep Space', settings: { view: 'e8coxeter', e8ViewMode: 'coxeter', palette: 'cosmic', bgMode: 'cosmos', bgIntensity: 0.9, showRings: true, showPetrie: false, fxMode: 'glow', fxIntensity: 0.35, cameraPath: 'petrieSpiral' } },
  { id: 'cosmic-dawn', name: 'Cosmic Dawn', settings: { view: 'sixhundred', shape: 'dodecahedron', palette: 'golden', bgMode: 'mandala', bgIntensity: 0.7, autoRotate: true, showEdges: true, fxMode: 'kaleidoscope', fxIntensity: 0.4, rotationSpeed: 0.004 } },
  { id: 'mandala-meditation', name: 'Mandala Meditation', settings: { view: 'platonic', shape: 'dodecahedron', palette: 'petrie', fxMode: 'kaleido6', fxIntensity: 0.5, autoRotate: true, rotationSpeed: 0.003 } },
  { id: 'plasma-storm', name: 'Plasma Storm', settings: { view: 'e8coxeter', e8ViewMode: 'petrie', palette: 'neon', bgMode: 'plasma', bgIntensity: 0.95, showPetrie: true, showWeylMirrors: true, fxMode: 'plasma', fxIntensity: 0.6, cameraPath: 'ringDive', weylOrbit: true } },
  { id: 'tron-grid', name: 'Tron Grid', settings: { view: 'e8coxeter', e8ViewMode: 'ortho3d', palette: 'electric', bgMode: 'grid', bgIntensity: 0.85, autoRotate: true, fxMode: 'wireframe', fxIntensity: 0.5, showRings: true, showPetrie: true } },
  { id: 'milky-meditation', name: 'Milky Meditation', settings: { view: 'bloom', shape: 'icosahedron', palette: 'rose_gold', bgMode: 'cosmos', bgIntensity: 0.8, bloomAmount: 0.4, bloomAuto: true, fxMode: 'fog', fxIntensity: 0.4, autoRotate: true, rotationSpeed: 0.002 } },
  { id: 'living-e8', name: 'Living E8', description: 'A breathing luminous SDF projection in vivid mathematical prime colors.', featured: true, settings: { view: 'raymarched', palette: 'prime', bgMode: 'quantum', bgIntensity: 0.72, e8MorphT: 0.35, autoSliders: ['e8MorphT'], sdfBloom: 0.72, sdfEdges: 0.42, sdfAniso: 0.68, fxMode: 'glow', fxIntensity: 0.32, cameraOrbit: true, cameraPath: 'manual' } },
  { id: 'opal-flux', name: 'Opal Flux', description: 'Soft iridescence moving across an extruded E8 field.', featured: true, settings: { view: 'raymarched', palette: 'opal', bgMode: 'prism', bgIntensity: 0.58, e8MorphT: 0.62, autoSliders: ['e8MorphT'], sdfBloom: 0.5, sdfEdges: 0.62, sdfAniso: 0.85, fxMode: 'iridescent', fxIntensity: 0.38, cameraOrbit: true } },
  { id: 'solar-lattice', name: 'Solar Lattice', description: 'A hot Coxeter lattice edged like a small artificial sun.', featured: true, settings: { view: 'e8coxeter', e8ViewMode: 'coxeter', palette: 'solar_flare', bgMode: 'eclipse', bgIntensity: 0.62, showRings: true, showPetrie: true, showEdges: true, rootDiffusion: true, fxMode: 'edge-glow', fxIntensity: 0.42, cameraPath: 'coxeterOrbit' } },
  { id: 'viridian-chamber', name: 'Viridian Chamber', description: 'Weyl mirrors suspended in a mineral-green atmosphere.', featured: true, settings: { view: 'e8coxeter', e8ViewMode: 'petrie', palette: 'viridian', bgMode: 'aurora', bgIntensity: 0.66, showWeylMirrors: true, weylOrbit: true, rootDiffusion: true, showPetrie: true, fxMode: 'caustic', fxIntensity: 0.3, cameraPath: 'petrieSpiral' } },
  { id: 'ultraviolet-twin', name: 'Ultraviolet Twin', description: 'The twin 600-cell split under an ultraviolet spectrum.', settings: { view: 'e8coxeter', e8ViewMode: 'h4', palette: 'ultraviolet', bgMode: 'cosmos', bgIntensity: 0.82, e8Twin600: true, e8MorphT: 0.48, fxMode: 'chromatic', fxIntensity: 0.34, cameraPath: 'h4Reveal' } },
  { id: 'electric-tesseract', name: 'Electric Tesseract', description: 'A cube-within-cube projection drawn in electric blue.', settings: { view: 'polytope', poly4d: 'tesseract', morph4d: 0.72, palette: 'electric', bgMode: 'grid', bgIntensity: 0.72, polyAutoRotate: true, polyRotationSpeed: 0.14, fxMode: 'wireframe', fxIntensity: 0.38, cameraOrbit: true } },
  { id: 'rose-crystal', name: 'Rose Crystal', description: 'A slow crystalline bloom with warm metallic highlights.', settings: { view: 'platonic', shape: 'great_icosahedron', palette: 'rose_gold', bgMode: 'cosmos', bgIntensity: 0.62, autoRotate: true, rotationSpeed: 0.0025, fxMode: 'crystal', fxIntensity: 0.46 } },
  { id: 'midnight-600', name: 'Midnight 600', description: 'The 600-cell drifting through a blue-violet night field.', settings: { view: 'sixhundred', shape: 'icosahedron', palette: 'midnight', bgMode: 'cosmos', bgIntensity: 0.9, showEdges: true, autoRotate: true, rotationSpeed: 0.003, fxMode: 'nebula', fxIntensity: 0.3 } },
];

export function galleryPresetById(id) {
  return GALLERY_PRESETS.find(preset => preset.id === id) || null;
}

export function adjacentGalleryPreset(currentId, direction = 1) {
  if (!GALLERY_PRESETS.length) return null;
  const step = Number(direction) < 0 ? -1 : 1;
  const current = GALLERY_PRESETS.findIndex(preset => preset.id === currentId);
  const next = current < 0
    ? (step < 0 ? GALLERY_PRESETS.length - 1 : 0)
    : (current + step + GALLERY_PRESETS.length) % GALLERY_PRESETS.length;
  return GALLERY_PRESETS[next];
}

export function createGalleryBaseline() {
  return {
    view: 'e8coxeter', shape: 'icosahedron', poly4d: '24cell',
    compareShape: 'dodecahedron', compareMode: 'off', palette: 'gold',
    blendMode: 'spectrum', shiftMode: 'static', autoSliders: [],
    bgMode: 'void', bgIntensity: 0.7, fxMode: 'none', fxByView: {}, fxIntensity: 0.5,
    opacity: 0.9, rotationSpeed: 0.003, showRings: true, showEdges: false,
    showPetrie: false, e8ViewMode: 'coxeter', e8Spin: 0, e8Tilt: 0,
    e8Roll: 0, e8AutoRotate: false, e8MorphT: 0, e8Twin600: false,
    e8ProjectionAuto: false, showWeylMirrors: false, rootDiffusion: false,
    rootHaloDepth: 3, rootDiffusionSpeed: 1.25, weylOrbit: false,
    weylOrbitFast: false, _weylWord: [], _weylSteps: 0, pickedRoot: null,
    pickedRootPrev: null, hoveredRoot: null, cartanEntry: null,
    _rootDistanceCounts: {}, cartanHighlight: false, cameraPath: 'manual',
    cameraOrbit: false, cameraMode: 'orbit', cameraSpeed: 1,
    cameraDistance: 6, cameraRotation: Math.PI / 6, autoRotate: false,
    autoZoom: false, showAmbient: true, showStarfield: false, bloomAuto: false,
    bloomAmount: 0, shapeTwist: 0, shapeSpike: 0, shapeJitter: 0, morph4d: 0,
    polyRotXY: 0, polyRotZW: 0, polyRotXZ: 0, polyRotYW: 0, polyRotXW: 0,
    polyRotYZ: 0, polyRotationSpeed: 0.18, polyAutoRotate: false,
    sdfSphereR: 0.08, sdfBlend: 0.03, sdfBloom: 0.5, sdfAniso: 0.6,
    sdfEdges: 0.3,
    bloomMandelbox: false, bloomMandelboxScale: 2.618,
    bloomMandelboxIters: 6, bloomMandelboxMix: 0.65,
    h4TwinReveal: false,
  };
}
