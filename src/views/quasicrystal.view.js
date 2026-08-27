// quasicrystal.view.js — E8 cut-and-project patterns, windows, and diffraction.

import * as THREE from 'three';
import { colorAt } from '../ui/palettes.js';
import { generateE8Quasicrystal, quasicrystalReliefHeight } from '../math/e8-quasicrystal.js';

export function createQuasicrystalView({ data, palette, scale: baseScale, context = {} }) {
  const group = new THREE.Group();
  group.name = 'QuasicrystalLab';
  const runtimeParams = () => context.params || window.__app?.params || {};
  let modelGroup = null;
  let construction = null;
  let pointMaterial = null;
  let activeSignature = '';

  function build(params = runtimeParams()) {
    if (modelGroup) {
      group.remove(modelGroup);
      disposeObject(modelGroup);
    }
    const mode = params.quasiMode || 'pattern';
    const maxNormSq = Number(params.quasiReach) || 8;
    const windowRadius = Number(params.quasiWindow) || 1.42;
    const phason = Number(params.quasiPhason) || 0;
    const relief = Number(params.quasiRelief) || 0;
    activeSignature = signature(params);
    construction = generateE8Quasicrystal(data.e8, {
      maxNormSq,
      windowRadius,
      phason,
      includeDiffraction: mode === 'diffraction',
      includeEdges: mode === 'pattern',
    });
    modelGroup = new THREE.Group();
    modelGroup.name = `Quasicrystal-${mode}`;
    group.add(modelGroup);

    const paletteName = params.palette || palette;
    if (mode === 'window') buildWindow(modelGroup, construction, baseScale, relief, paletteName);
    else if (mode === 'diffraction') buildDiffraction(modelGroup, construction, baseScale, relief, paletteName);
    else buildPattern(modelGroup, construction, baseScale, relief, paletteName);
    applyVisibility(params);
  }

  function applyVisibility(params) {
    const child = name => modelGroup?.getObjectByName(name);
    if (child('QuasicrystalPoints')) child('QuasicrystalPoints').visible = params.quasiShowPoints !== false;
    if (child('QuasicrystalLinks')) child('QuasicrystalLinks').visible = params.quasiShowLinks !== false;
    if (child('QuasicrystalGuide')) child('QuasicrystalGuide').visible = params.quasiShowGuide !== false;
    if (pointMaterial?.uniforms?.uShowRim) pointMaterial.uniforms.uShowRim.value = params.quasiPointHalos === false ? 0 : 1;
  }

  build();

  return {
    group,
    object3d: group,
    name: 'quasicrystal',

    update(dt, time, params) {
      if (signature(params) !== activeSignature) build(params);
      applyVisibility(params);
      if (params.autoRotate) {
        const motionScale = params._recording ? (params._recordingMotionScale ?? 0.4) : 1;
        group.rotation.z += dt * (params.rotationSpeed || 0.003) * 42 * motionScale;
      }
      if (pointMaterial?.uniforms?.uBaseSize) {
        pointMaterial.uniforms.uBaseSize.value = 17 * (params.pointScale || 1);
      }
    },

    onPaletteChange(nextPalette) {
      palette = nextPalette;
      build(runtimeParams());
    },

    getConstruction() {
      return construction;
    },

    dispose() {
      disposeObject(group);
      construction = null;
      pointMaterial = null;
    },
  };

  function buildPattern(parent, patch, radius, relief, paletteName) {
    addPatternGuide(parent, patch, radius, paletteName);
    addPatternLinks(parent, patch, radius, relief, paletteName);
    pointMaterial = addPatternPoints(parent, patch, radius, relief, paletteName);
  }

  function buildWindow(parent, patch, radius, relief, paletteName) {
    addWindowGuide(parent, patch, radius, paletteName);
    pointMaterial = addWindowPoints(parent, patch, radius, relief, paletteName);
  }

  function buildDiffraction(parent, patch, radius, relief, paletteName) {
    addDiffractionGuide(parent, patch, radius, paletteName);
    pointMaterial = addDiffractionPeaks(parent, patch, radius, relief, paletteName);
  }
}

function signature(params) {
  return [
    params.quasiMode || 'pattern',
    Number(params.quasiReach) || 8,
    Number(params.quasiWindow ?? 1.42).toFixed(3),
    Number(params.quasiPhason ?? 0).toFixed(3),
    Number(params.quasiRelief ?? 0.08).toFixed(3),
  ].join('|');
}

function addPatternGuide(parent, patch, radius, palette) {
  const positions = [];
  const colors = [];
  for (let index = 0; index < patch.symmetryOrder; index++) {
    const angle = index * Math.PI * 2 / patch.symmetryOrder;
    const color = new THREE.Color(colorAt(palette, index / patch.symmetryOrder));
    positions.push(0, 0, -0.05, Math.cos(angle) * radius * 1.03, Math.sin(angle) * radius * 1.03, -0.05);
    colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const guide = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
  }));
  guide.name = 'QuasicrystalGuide';
  guide.renderOrder = 0;
  parent.add(guide);
}

function addPatternLinks(parent, patch, radius, relief, palette) {
  const positions = [];
  const colors = [];
  for (const [aIndex, bIndex] of patch.edges) {
    const a = patch.points[aIndex];
    const b = patch.points[bIndex];
    const phase = positiveTurn((Math.atan2(a.normalized[1] + b.normalized[1], a.normalized[0] + b.normalized[0]) / (Math.PI * 2)) + 0.5);
    const color = new THREE.Color(colorAt(palette, phase));
    for (const point of [a, b]) {
      positions.push(
        point.normalized[0] * radius,
        point.normalized[1] * radius,
        reliefZ(point, relief, radius),
      );
      colors.push(color.r, color.g, color.b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: 0.46,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.name = 'QuasicrystalLinks';
  lines.renderOrder = 2;
  parent.add(lines);
}

function addPatternPoints(parent, patch, radius, relief, palette) {
  const positions = [];
  const colors = [];
  const sizes = [];
  for (const point of patch.points) {
    const angle = positiveTurn(Math.atan2(point.normalized[1], point.normalized[0]) / (Math.PI * 2));
    const shell = positiveTurn(point.normSq / (patch.maxNormSq + 2));
    const color = new THREE.Color(colorAt(palette, angle * 0.62 + shell * 0.38));
    positions.push(
      point.normalized[0] * radius,
      point.normalized[1] * radius,
      reliefZ(point, relief, radius) + 0.014,
    );
    colors.push(color.r, color.g, color.b);
    sizes.push(0.62 + point.acceptance * 0.72 + (point.normSq <= 2 ? 0.35 : 0));
  }
  return addPointCloud(parent, {
    name: 'QuasicrystalPoints', positions, colors, sizes,
    baseSize: 17,
    tooltipData: patch.points.map((point, index) => ({
      html: `<div class="ttip-head">E8 lattice point #${index}</div>
        <div><b>shell ‖x‖² = ${formatNumber(point.normSq)}</b> · ${point.coset} coset</div>
        <div>visible radius: <b>${formatNumber(point.physicalRadius)}</b></div>
        <div>hidden radius: <b>${formatNumber(point.shiftedInternalRadius)}</b> / ${formatNumber(patch.windowRadius)}</div>
        <div class="ttip-coords">x = (${point.coords.map(formatNumber).join(', ')})</div>
        <div style="color:var(--muted);margin-top:4px">Accepted because its six-dimensional hidden component lies inside the window.</div>`,
    })),
  });
}

function addWindowGuide(parent, patch, radius, palette) {
  const group = new THREE.Group();
  group.name = 'QuasicrystalGuide';
  const rings = [0.25, 0.5, 0.75, 1];
  rings.forEach((ring, ringIndex) => {
    const points = Array.from({ length: 121 }, (_, index) => {
      const angle = index / 120 * Math.PI * 2;
      return new THREE.Vector3(Math.cos(angle) * radius * ring, Math.sin(angle) * radius * ring, -0.04);
    });
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const line = new THREE.Line(geometry, new THREE.LineBasicMaterial({
      color: colorAt(palette, 0.12 + ringIndex * 0.2),
      transparent: true,
      opacity: ring === 1 ? 0.72 : 0.17,
      depthWrite: false,
    }));
    group.add(line);
  });
  const axes = new THREE.BufferGeometry();
  axes.setAttribute('position', new THREE.Float32BufferAttribute([
    -radius, 0, -0.05, radius, 0, -0.05,
    0, -radius, -0.05, 0, radius, -0.05,
  ], 3));
  group.add(new THREE.LineSegments(axes, new THREE.LineBasicMaterial({
    color: colorAt(palette, 0.55), transparent: true, opacity: 0.22, depthWrite: false,
  })));
  parent.add(group);
}

function addWindowPoints(parent, patch, radius, relief, palette) {
  const positions = [];
  const colors = [];
  const sizes = [];
  for (const point of patch.points) {
    const color = new THREE.Color(colorAt(palette, 0.08 + point.acceptance * 0.82));
    positions.push(
      point.windowPlot[0] * radius,
      point.windowPlot[1] * radius,
      quasicrystalReliefHeight(point, 'window', relief, radius),
    );
    colors.push(color.r, color.g, color.b);
    sizes.push(0.52 + point.acceptance * 0.86);
  }
  return addPointCloud(parent, {
    name: 'QuasicrystalPoints', positions, colors, sizes,
    baseSize: 15,
    tooltipData: patch.points.map((point, index) => ({
      html: `<div class="ttip-head">Window sample #${index}</div>
        <div><b>two coordinates of the hidden 6D component</b></div>
        <div>hidden radius: <b>${formatNumber(point.shiftedInternalRadius)}</b></div>
        <div>window radius: <b>${formatNumber(patch.windowRadius)}</b></div>
        <div style="color:var(--muted);margin-top:4px">The circle is a readable 2D slice of the spherical six-dimensional acceptance window.</div>`,
    })),
  });
}

function addDiffractionGuide(parent, patch, radius, palette) {
  const group = new THREE.Group();
  group.name = 'QuasicrystalGuide';
  const radii = [...new Set(patch.diffraction.map(peak => peak.radius.toFixed(6)))].map(Number).sort((a, b) => a - b);
  const maxRadius = Math.max(...radii, 1);
  radii.forEach((ring, index) => {
    const points = Array.from({ length: 121 }, (_, step) => {
      const angle = step / 120 * Math.PI * 2;
      const r = radius * ring / maxRadius;
      return new THREE.Vector3(Math.cos(angle) * r, Math.sin(angle) * r, -0.04);
    });
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    group.add(new THREE.Line(geometry, new THREE.LineBasicMaterial({
      color: colorAt(palette, index / Math.max(1, radii.length - 1)),
      transparent: true,
      opacity: 0.14 + index / Math.max(1, radii.length - 1) * 0.08,
      depthWrite: false,
    })));
  });
  parent.add(group);
}

function addDiffractionPeaks(parent, patch, radius, relief, palette) {
  const positions = [];
  const colors = [];
  const sizes = [];
  for (const peak of patch.diffraction) {
    const angle = positiveTurn(Math.atan2(peak.normalized[1], peak.normalized[0]) / (Math.PI * 2));
    const color = new THREE.Color(colorAt(palette, angle));
    positions.push(
      peak.normalized[0] * radius,
      peak.normalized[1] * radius,
      quasicrystalReliefHeight(peak, 'diffraction', relief, radius),
    );
    colors.push(color.r, color.g, color.b);
    sizes.push(0.34 + peak.strength * 1.9);
  }
  return addPointCloud(parent, {
    name: 'QuasicrystalPoints', positions, colors, sizes,
    baseSize: 22,
    tooltipData: patch.diffraction.map((peak, index) => ({
      html: `<div class="ttip-head">Reciprocal peak #${index}</div>
        <div><b>relative strength ${formatNumber(peak.strength)}</b></div>
        <div>structure-factor intensity: <b>${formatNumber(peak.intensity)}</b></div>
        <div>reciprocal radius: <b>${formatNumber(peak.radius)}</b></div>
        <div style="color:var(--muted);margin-top:4px">The 240 reciprocal candidates come from E8's self-dual root shell.</div>`,
    })),
  });
}

function addPointCloud(parent, { name, positions, colors, sizes, baseSize, tooltipData }) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
  const material = createPointMaterial(baseSize);
  const points = new THREE.Points(geometry, material);
  points.name = name;
  points.renderOrder = 4;
  points.userData.tooltipData = tooltipData;
  parent.add(points);
  return material;
}

function createPointMaterial(baseSize) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uBaseSize: { value: baseSize },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uOpacity: { value: 0.96 },
      uShowRim: { value: 1 },
    },
    vertexShader: `
      attribute float size;
      varying vec3 vColor;
      uniform float uBaseSize;
      uniform float uPixelRatio;
      void main() {
        vColor = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uBaseSize * size * uPixelRatio * (6.0 / max(1.0, -mv.z));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec3 vColor;
      uniform float uOpacity;
      uniform float uShowRim;
      void main() {
        vec2 c = gl_PointCoord - vec2(0.5);
        float d = length(c);
        if (d > 0.5) discard;
        float disc = smoothstep(0.5, 0.36, d);
        float core = smoothstep(0.22, 0.02, d);
        float rim = smoothstep(0.5, 0.42, d) - smoothstep(0.39, 0.31, d);
        float haloAlpha = max(core, rim * 0.95) * disc;
        float solidAlpha = disc;
        float alpha = mix(solidAlpha, haloAlpha, uShowRim);
        vec3 col = vColor + core * vColor * mix(0.22, 0.48, uShowRim);
        gl_FragColor = vec4(col, alpha * uOpacity);
      }
    `,
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
  });
}

function reliefZ(point, relief, radius) {
  return quasicrystalReliefHeight(point, 'pattern', relief, radius);
}

function positiveTurn(value) {
  return ((value % 1) + 1) % 1;
}

function formatNumber(value) {
  if (Math.abs(value) < 1e-9) return '0';
  const doubled = Math.round(value * 2);
  if (Math.abs(value * 2 - doubled) < 1e-9) return doubled % 2 ? `${doubled}/2` : String(doubled / 2);
  return Number(value.toFixed(3)).toString();
}

function disposeObject(root) {
  root.traverse(object => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) object.material.forEach(material => material?.dispose?.());
    else object.material?.dispose?.();
  });
}
