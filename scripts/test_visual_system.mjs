import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { THEMES, THEME_LABELS, DEFAULT_THEME } from '../src/ui/theme.js';
import { PALETTE_GROUPS, PALETTE_NAMES, PALETTE_PRESETS, paletteFamily, palettePreviewCSS } from '../src/ui/palettes.js';
import { BACKGROUND_PRESETS, BG_MODES, backgroundModesForQuality, coerceBackgroundForQuality } from '../src/ui/backgrounds.js';
import { shouldWritePlatonicFaceDepth } from '../src/views/platonic.view.js';
import { SurfaceFXMaterial, makeTriangleBarycentrics } from '../src/fx/fx-surface-material.js';
import { buildSixHundredClassColors } from '../src/views/sixhundred.view.js';
import { FX_BY_ID, effectAvailableForView } from '../src/fx/fx-catalog.js';
import { GALLERY_PRESETS, createGalleryBaseline } from '../src/state/gallery.js';

const REQUIRED_THEME_KEYS = [
  '--bg-0', '--bg-1', '--bg-2', '--bg-3', '--line', '--line-soft',
  '--ink-0', '--ink-1', '--ink-2', '--ink-3',
  '--accent', '--accent-2', '--accent-3', '--accent-4',
];
const hex = /^#[0-9a-f]{6}$/i;
const luminance = color => {
  const channels = color.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};
const contrast = (a, b) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};

const css = readFileSync(new URL('../src/assets/style.css', import.meta.url), 'utf8');
const desktopMain = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
const mobileMain = readFileSync(new URL('../src/mobile/main.js', import.meta.url), 'utf8');
for (const token of [
  '--space-1', '--space-2', '--space-3', '--space-4', '--space-5',
  '--text-xs', '--text-sm', '--text-md', '--text-body',
  '--control-min', '--touch-min', '--duration-fast', '--duration-normal', '--focus-ring',
]) {
  assert.match(css, new RegExp(`${token}:\\s*[^;]+;`), `${token} is defined`);
}
assert.match(css, /@media\s*\(prefers-reduced-motion:\s*reduce\)/, 'reduced motion policy');

const desktopAutoModelSequence = desktopMain.match(/const AUTO_MODEL_SEQUENCE = Object\.freeze\(\[([\s\S]*?)\n\]\);/)?.[1] || '';
const mobileAutoModelSequence = mobileMain.match(/const AUTO_MODEL_SEQUENCE = \[([\s\S]*?)\n\];/)?.[1] || '';
assert.ok(desktopAutoModelSequence, 'desktop auto-model sequence is discoverable');
assert.ok(mobileAutoModelSequence, 'mobile auto-model sequence is discoverable');
assert.doesNotMatch(desktopAutoModelSequence, /view:\s*'dynkin'/, 'desktop showcase excludes manual-only Dynkin diagrams');
assert.doesNotMatch(mobileAutoModelSequence, /modelMode:\s*'dynkin'/, 'mobile showcase excludes manual-only Dynkin diagrams');

const stylesheetNames = ['style.css', 'panel-extra.css', 'panel-v2.css'];
const selectorOwners = new Map();
for (const stylesheet of stylesheetNames) {
  const source = readFileSync(new URL(`../src/assets/${stylesheet}`, import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of source.matchAll(/(^|\})\s*([^@{}][^{}]*)\{/g)) {
    for (const selector of match[2].split(',').map(value => value.trim())) {
      if (!selector || selector.includes('%')) continue;
      if (!selectorOwners.has(selector)) selectorOwners.set(selector, new Set());
      selectorOwners.get(selector).add(stylesheet);
    }
  }
}
const crossFileDuplicates = [...selectorOwners.entries()]
  .filter(([, owners]) => owners.size > 1)
  .map(([selector, owners]) => `${selector}: ${[...owners].join(', ')}`);
assert.deepEqual(crossFileDuplicates, [], 'selectors have one stylesheet owner');

assert.ok(THEMES[DEFAULT_THEME]);
for (const [name, theme] of Object.entries(THEMES)) {
  assert.deepEqual(Object.keys(theme).sort(), [...REQUIRED_THEME_KEYS].sort(), `${name} theme keys`);
  assert.ok(THEME_LABELS[name], `${name} has a display label`);
  for (const value of Object.values(theme)) assert.match(value, hex, `${name} uses six-digit hex tokens`);
  assert.ok(contrast(theme['--ink-0'], theme['--bg-0']) >= 7, `${name} primary text contrast`);
  assert.ok(contrast(theme['--ink-1'], theme['--bg-1']) >= 4.5, `${name} body text contrast`);
  assert.ok(contrast(theme['--ink-2'], theme['--bg-0']) >= 3, `${name} secondary text contrast`);
  assert.ok(contrast(theme['--accent'], theme['--bg-0']) >= 3, `${name} accent contrast`);
}

assert.equal(PALETTE_NAMES.length, new Set(PALETTE_NAMES).size);
const groupedPalettes = PALETTE_GROUPS.flatMap(group => group.palettes);
assert.deepEqual([...groupedPalettes].sort(), [...PALETTE_NAMES].sort(), 'every palette appears in one family');
assert.equal(new Set(groupedPalettes).size, PALETTE_NAMES.length, 'palette families do not overlap');
for (const name of PALETTE_NAMES) {
  const palette = PALETTE_PRESETS[name];
  assert.ok(palette.colors.length >= 2 && palette.colors.length <= 5, `${name} color count`);
  assert.ok(palette.colors.every(color => hex.test(color)), `${name} color values`);
  assert.ok(palette.bgDarken >= 0.85 && palette.bgDarken <= 1, `${name} background darkening`);
  assert.ok(palette.description?.trim(), `${name} description`);
  assert.match(palettePreviewCSS(name, 'spectrum'), /gradient\(/, `${name} preview`);
  assert.ok(PALETTE_GROUPS.some(group => group.id === paletteFamily(name)), `${name} family`);
}

assert.deepEqual(BG_MODES, Object.keys(BACKGROUND_PRESETS));
assert.deepEqual(backgroundModesForQuality('low'), ['void', 'starfield', 'grid', 'eclipse']);
assert.ok(backgroundModesForQuality('medium').length > backgroundModesForQuality('low').length);
assert.equal(backgroundModesForQuality('high').length, BG_MODES.length);
assert.equal(coerceBackgroundForQuality('quantum', 'low'), 'void');
assert.equal(coerceBackgroundForQuality('quantum', 'high'), 'quantum');

for (const shape of ['tetrahedron', 'cube', 'octahedron', 'dodecahedron', 'icosahedron']) {
  assert.equal(shouldWritePlatonicFaceDepth(shape), true, `${shape} faces write depth`);
}
for (const shape of ['stellated_dodecahedron', 'great_dodecahedron', 'great_icosahedron', 'great_stellated_dodecahedron']) {
  assert.equal(shouldWritePlatonicFaceDepth(shape), false, `${shape} transparent overlaps do not write depth`);
}

assert.deepEqual(
  [...makeTriangleBarycentrics(1)],
  [1, 0, 0, 0, 1, 0, 0, 0, 1],
  'surface FX receives one barycentric basis per triangle'
);
const convexSurface = new SurfaceFXMaterial();
const starSurface = new SurfaceFXMaterial({ star: true });
assert.equal(convexSurface.uniforms.uSurfaceRole.value, 0);
assert.equal(starSurface.uniforms.uSurfaceRole.value, 1);
assert.notEqual(convexSurface.customProgramCacheKey(), starSurface.customProgramCacheKey());
const shaderProbe = {
  uniforms: {},
  vertexShader: '#include <common>\n#include <worldpos_vertex>',
  fragmentShader: '#include <common>\n#include <color_fragment>',
};
convexSurface.onBeforeCompile(shaderProbe);
assert.ok(shaderProbe.uniforms.uFXMode === convexSurface.uniforms.uFXMode, 'compiled surface shares runtime FX uniforms');
assert.match(shaderProbe.vertexShader, /vFxBarycentric = fxBarycentric/);
assert.match(shaderProbe.fragmentShader, /diffuseColor = applySurfaceFX/);
convexSurface.dispose();
starSurface.dispose();

const goldClasses = buildSixHundredClassColors('gold');
const rainbowClasses = buildSixHundredClassColors('rainbow');
assert.equal(goldClasses.length, 9);
assert.equal(rainbowClasses.length, 9);
const hueSpan = colors => {
  const hues = colors.map(color => {
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    return hsl.h;
  });
  return Math.max(...hues) - Math.min(...hues);
};
assert.ok(hueSpan(goldClasses) < 0.2, 'gold 600-cell classes stay within the selected warm palette');
assert.ok(hueSpan(rainbowClasses) > 0.5, 'rainbow 600-cell classes retain broad palette coverage');

const galleryViews = new Set(['bloom', 'platonic', 'e8coxeter', 'sixhundred', 'polytope', 'raymarched', 'dynkin']);
assert.equal(GALLERY_PRESETS.length, 22, 'gallery retains its 22 curated scenes');
assert.equal(new Set(GALLERY_PRESETS.map(preset => preset.id)).size, GALLERY_PRESETS.length, 'gallery IDs are unique');
assert.equal(new Set(GALLERY_PRESETS.map(preset => preset.name)).size, GALLERY_PRESETS.length, 'gallery names are unique');
for (const preset of GALLERY_PRESETS) {
  const { settings } = preset;
  assert.ok(preset.description?.trim(), `${preset.id} has a useful description`);
  assert.ok(galleryViews.has(settings.view), `${preset.id} uses a known view`);
  assert.ok(PALETTE_PRESETS[settings.palette], `${preset.id} uses a known palette`);
  assert.ok(BACKGROUND_PRESETS[settings.bgMode || 'void'], `${preset.id} uses a known background`);
  assert.ok(FX_BY_ID[settings.fxMode || 'none'], `${preset.id} uses a known effect`);
  assert.ok(effectAvailableForView(settings.view, settings.fxMode || 'none', 'high'), `${preset.id} effect supports its view`);
}
const galleryBaseline = createGalleryBaseline();
assert.deepEqual(
  {
    vertices: galleryBaseline.showVertices,
    fxShift: galleryBaseline.autoFx,
    modelShift: galleryBaseline.autoModel,
    pointScale: galleryBaseline.pointScale,
    inspector: galleryBaseline.showInspector,
    ambient: galleryBaseline.lightAmbient,
    key: galleryBaseline.lightKey,
    fill: galleryBaseline.lightFill,
    accent: galleryBaseline.lightAccent,
  },
  {
    vertices: false, fxShift: false, modelShift: false, pointScale: 1,
    inspector: false, ambient: 0.55, key: 1.2, fill: 0.6, accent: 1,
  },
  'gallery baseline clears presentation state that would contaminate a curated scene'
);

console.log(`Visual system tests passed: ${Object.keys(THEMES).length} themes, ${PALETTE_NAMES.length} palettes, ${GALLERY_PRESETS.length} gallery scenes.`);
