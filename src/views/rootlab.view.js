// rootlab.view.js — generated rank-2 root systems with mirrors and chambers.

import * as THREE from 'three';
import { colorAt } from '../ui/palettes.js';
import { LineFXMaterial } from '../fx/fx-line-shader.js';
import { makeTriangleBarycentrics, SurfaceFXMaterial } from '../fx/fx-surface-material.js';
import { VERTEX_FX_BRANCHES, FRAGMENT_FX_BRANCHES } from '../fx/fx-branches.js';
import { coxeterOrbit, generateRank2RootSystem } from '../math/rank2-roots.js';

export function createRootLabView({ palette, scale: baseScale, context = {} }) {
  const group = new THREE.Group();
  group.name = 'RootLab';
  const runtimeParams = () => context.params || window.__app?.params || {};
  let activeSystem = null;
  let systemGroup = null;
  let rootMaterial = null;
  let orbitMarker = null;

  function build(systemId) {
    if (systemGroup) {
      forEachMaterial(systemGroup, material => context.unregisterFXMaterial?.(material));
      group.remove(systemGroup);
      disposeObject(systemGroup);
    }
    activeSystem = generateRank2RootSystem(systemId);
    systemGroup = new THREE.Group();
    systemGroup.name = `RootLab-${activeSystem.id}`;
    group.add(systemGroup);

    const radius = baseScale * 1.08;
    const paletteName = runtimeParams().palette || palette;
    addChambers(systemGroup, activeSystem, radius, paletteName);
    addMirrors(systemGroup, activeSystem, radius, paletteName);
    addRootRays(systemGroup, activeSystem, radius, paletteName);
    addRootPolygons(systemGroup, activeSystem, radius, paletteName);
    rootMaterial = addRootPoints(systemGroup, activeSystem, radius, paletteName);
    orbitMarker = addOrbit(systemGroup, activeSystem, radius, paletteName);
    forEachMaterial(systemGroup, material => context.registerFXMaterial?.(material));
    applyVisibility(runtimeParams());
  }

  function applyVisibility(params) {
    const child = name => systemGroup?.getObjectByName(name);
    if (child('RootChambers')) child('RootChambers').visible = params.rootShowChambers !== false;
    if (child('RootMirrors')) child('RootMirrors').visible = params.rootShowMirrors !== false;
    if (child('RootSimple')) child('RootSimple').visible = params.rootShowSimple !== false;
    if (child('RootOrbit')) child('RootOrbit').visible = params.rootShowOrbit !== false;
  }

  build(runtimeParams().rootSystem || 'A2');

  return {
    group,
    object3d: group,
    name: 'rootlab',

    update(dt, time, params) {
      if ((params.rootSystem || 'A2') !== activeSystem?.id) build(params.rootSystem || 'A2');
      applyVisibility(params);
      if (params.autoRotate) {
        const motionScale = params._recording ? (params._recordingMotionScale ?? 0.4) : 1;
        group.rotation.z += dt * (params.rotationSpeed || 0.003) * 50 * motionScale;
      }
      if (orbitMarker && params.rootShowOrbit !== false) {
        const orbit = orbitMarker.userData.orbit || [];
        if (orbit.length) {
          const speed = Math.max(0.1, params.rootOrbitSpeed || 0.7);
          const phase = (time * speed) % orbit.length;
          const index = Math.floor(phase);
          const next = (index + 1) % orbit.length;
          const mix = phase - index;
          const a = orbit[index];
          const b = orbit[next];
          orbitMarker.position.set(
            THREE.MathUtils.lerp(a[0], b[0], mix),
            THREE.MathUtils.lerp(a[1], b[1], mix),
            0.035,
          );
          orbitMarker.rotation.z = Math.atan2(b[1] - a[1], b[0] - a[0]);
          const pulse = 1 + Math.sin(time * 4.2) * 0.09;
          orbitMarker.scale.setScalar(pulse * ((params.fxMode || 'none') === 'none' ? 1 : 1.14));
          const activeStep = orbitMarker.userData.activeStep;
          const positions = activeStep?.geometry?.attributes?.position;
          if (positions) {
            positions.setXYZ(0, a[0], a[1], 0.026);
            positions.setXYZ(1, orbitMarker.position.x, orbitMarker.position.y, 0.026);
            positions.needsUpdate = true;
          }
        }
      }
      if (rootMaterial?.uniforms?.uBaseSize) {
        rootMaterial.uniforms.uBaseSize.value = 24 * (params.pointScale || 1);
      }
    },

    onPaletteChange(nextPalette) {
      palette = nextPalette;
      build(activeSystem?.id || 'A2');
    },

    dispose() {
      forEachMaterial(group, material => context.unregisterFXMaterial?.(material));
      disposeObject(group);
      rootMaterial = null;
      orbitMarker = null;
    },
  };
}

function addChambers(parent, system, radius, palette) {
  const chamberGroup = new THREE.Group();
  chamberGroup.name = 'RootChambers';
  const mirrorAngles = mirrorAnglesFor(system);
  const boundaries = [...mirrorAngles, mirrorAngles[0] + Math.PI];
  for (let i = 0; i < mirrorAngles.length; i++) {
    const a = boundaries[i];
    const b = boundaries[i + 1];
    addWedge(chamberGroup, a, b, radius * 1.12, colorAt(palette, (i + 0.5) / mirrorAngles.length), i, system.chamberCount);
    addWedge(chamberGroup, a + Math.PI, b + Math.PI, radius * 1.12, colorAt(palette, (i + 0.5) / mirrorAngles.length), i + mirrorAngles.length, system.chamberCount);
  }
  parent.add(chamberGroup);
}

function addWedge(parent, start, end, radius, color, index, chamberCount) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, -0.035,
    Math.cos(start) * radius, Math.sin(start) * radius, -0.035,
    Math.cos(end) * radius, Math.sin(end) * radius, -0.035,
  ], 3));
  geometry.setAttribute('fxBarycentric', new THREE.Float32BufferAttribute(makeTriangleBarycentrics(1), 3));
  geometry.computeVertexNormals();
  const referenceChamber = index === chamberCount - 1;
  const material = new SurfaceFXMaterial({
    color,
    emissive: color,
    emissiveIntensity: referenceChamber ? 0.34 : 0.12,
    roughness: 0.78,
    metalness: 0.02,
    transparent: true,
    opacity: referenceChamber ? 0.24 : index % 2 ? 0.065 : 0.11,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const wedge = new THREE.Mesh(geometry, material);
  wedge.userData.referenceChamber = referenceChamber;
  parent.add(wedge);
}

function addMirrors(parent, system, radius, palette) {
  const positions = [];
  for (const angle of mirrorAnglesFor(system)) {
    const x = Math.cos(angle) * radius * 1.16;
    const y = Math.sin(angle) * radius * 1.16;
    positions.push(-x, -y, -0.01, x, y, -0.01);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new LineFXMaterial({
    color: colorAt(palette, 0.12),
    transparent: true,
    opacity: 0.24,
    depthWrite: false,
  });
  const mirrors = new THREE.LineSegments(geometry, material);
  mirrors.name = 'RootMirrors';
  parent.add(mirrors);
}

function addRootRays(parent, system, radius, palette) {
  const positions = [];
  const colors = [];
  for (const root of system.roots) {
    const color = new THREE.Color(colorAt(palette, root.angle / (Math.PI * 2)));
    positions.push(0, 0, 0, root.point[0] * radius, root.point[1] * radius, 0);
    colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const material = new LineFXMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
  });
  const rays = new THREE.LineSegments(geometry, material);
  rays.name = 'RootRays';
  parent.add(rays);

  const simplePositions = system.simpleRoots.flatMap(root => {
    const maxLength = system.longToShortRatio;
    return [0, 0, 0.025, root[0] / maxLength * radius, root[1] / maxLength * radius, 0.025];
  });
  const simpleGeometry = new THREE.BufferGeometry();
  simpleGeometry.setAttribute('position', new THREE.Float32BufferAttribute(simplePositions, 3));
  const simpleMaterial = new LineFXMaterial({
    color: 0xfff2a8,
    transparent: true,
    opacity: 1,
    depthWrite: false,
  });
  const simple = new THREE.LineSegments(simpleGeometry, simpleMaterial);
  simple.name = 'RootSimple';
  parent.add(simple);
}

function addRootPolygons(parent, system, radius, palette) {
  const polygonGroup = new THREE.Group();
  polygonGroup.name = 'RootPolygons';
  for (const [kind, opacity, palettePosition] of [['long', 0.82, 0.08], ['short', 0.66, 0.62]]) {
    const roots = system.roots.filter(root => root.kind === kind);
    if (roots.length < 3) continue;
    const positions = [];
    for (let i = 0; i < roots.length; i++) {
      const a = roots[i].point;
      const b = roots[(i + 1) % roots.length].point;
      positions.push(a[0] * radius, a[1] * radius, 0.008, b[0] * radius, b[1] * radius, 0.008);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new LineFXMaterial({
      color: colorAt(palette, palettePosition),
      transparent: true,
      opacity,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const polygon = new THREE.LineSegments(geometry, material);
    polygon.name = kind === 'long' ? 'LongRootPolygon' : 'ShortRootPolygon';
    polygonGroup.add(polygon);
  }

  const guidePositions = [];
  const guideSteps = 96;
  for (let i = 0; i < guideSteps; i++) {
    const a = i / guideSteps * Math.PI * 2;
    const b = (i + 1) / guideSteps * Math.PI * 2;
    guidePositions.push(
      Math.cos(a) * radius * 1.045, Math.sin(a) * radius * 1.045, -0.018,
      Math.cos(b) * radius * 1.045, Math.sin(b) * radius * 1.045, -0.018,
    );
  }
  const guideGeometry = new THREE.BufferGeometry();
  guideGeometry.setAttribute('position', new THREE.Float32BufferAttribute(guidePositions, 3));
  const guideMaterial = new LineFXMaterial({
    color: colorAt(palette, 0.35),
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
  });
  const guide = new THREE.LineSegments(guideGeometry, guideMaterial);
  guide.name = 'RootBoundaryGuide';
  polygonGroup.add(guide);
  parent.add(polygonGroup);
}

function addRootPoints(parent, system, radius, palette) {
  const positions = [];
  const colors = [];
  const sizes = [];
  const maxLength = system.longToShortRatio;
  for (const root of system.roots) {
    const color = new THREE.Color(colorAt(palette, root.angle / (Math.PI * 2)));
    positions.push(root.point[0] * radius, root.point[1] * radius, 0.02);
    colors.push(color.r, color.g, color.b);
    const simple = system.simpleRoots.some(alpha => (
      Math.abs(alpha[0] / maxLength - root.point[0]) < 1e-7
      && Math.abs(alpha[1] / maxLength - root.point[1]) < 1e-7
    ));
    sizes.push(simple ? 1.35 : root.kind === 'long' ? 1.05 : 0.86);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uBaseSize: { value: 24 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uOpacity: { value: 1 },
      uFXMode: { value: 0 },
      uFXIntensity: { value: 0.5 },
      uTime: { value: 0 },
    },
    vertexShader: `
      attribute float size;
      varying vec3 vColor;
      varying vec3 vWorldPos;
      uniform float uBaseSize;
      uniform float uPixelRatio;
      uniform int uFXMode;
      uniform float uFXIntensity;
      uniform float uTime;
      void main() {
        vColor = color;
        vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
        float localScale = 1.0;
        if (uFXMode == 4) localScale *= 1.0 + uFXIntensity * 0.35 * sin(length(position.xy) * 8.0 - uTime * 4.0);
        if (uFXMode == 6) localScale *= 0.78 + 0.34 * (0.5 + 0.5 * sin(uTime * 3.14159));
        ${VERTEX_FX_BRANCHES}
        vec4 mv = modelViewMatrix * vec4(position + fxO, 1.0);
        gl_PointSize = uBaseSize * size * localScale * fxS * uPixelRatio * (6.0 / max(1.0, -mv.z));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
      precision highp float;
      varying vec3 vColor;
      varying vec3 vWorldPos;
      uniform float uOpacity;
      uniform int uFXMode;
      uniform float uFXIntensity;
      uniform float uTime;
      void main() {
        vec2 c = gl_PointCoord - vec2(0.5);
        float d = length(c);
        if (d > 0.5) discard;
        float disc = smoothstep(0.5, 0.42, d);
        float inner = smoothstep(0.35, 0.27, d);
        float rim = max(0.0, disc - inner);
        float core = smoothstep(0.15, 0.025, d);
        float alpha = max(rim, core * 0.9);
        vec3 col = vColor;
        if (uFXMode == 1) col += vColor * uFXIntensity * 1.3;
        if (uFXMode == 2) {
          float band = 0.5 + 0.5 * sin(dot(vWorldPos.xy, vec2(4.0, 2.7)) - uTime * 3.2);
          col = mix(col * (0.48 + band * 0.52), vec3(col.b, col.r, col.g) * 1.45, uFXIntensity * band);
          alpha *= mix(1.0, 0.55 + band * 0.45, uFXIntensity);
        }
        if (uFXMode == 3) {
          float sector = abs(fract(atan(vWorldPos.y, vWorldPos.x) / 1.0471976 + 0.5) - 0.5) * 2.0;
          col = mix(col, 0.5 + 0.5 * cos(6.2831 * (sector + vec3(0.0, 0.33, 0.67))), uFXIntensity * 0.72);
        }
        if (uFXMode == 7) col += vec3(sin(vWorldPos.x * 4.0 + uTime), sin(vWorldPos.y * 4.0 + uTime + 2.094), sin(uTime + 4.188)) * uFXIntensity * 0.25;
        if (uFXMode == 5) {
          float spin = 0.5 + 0.5 * sin(atan(vWorldPos.y, vWorldPos.x) * 6.0 + uTime * 2.0);
          col = mix(col, vec3(col.g, col.b, col.r) * (0.75 + spin * 0.75), uFXIntensity);
        }
        if (uFXMode == 8) {
          float radialFade = smoothstep(0.25, 1.8, length(vWorldPos.xy));
          col = mix(col, vec3(0.34, 0.62, 0.88), radialFade * uFXIntensity * 0.72);
          alpha *= 1.0 - radialFade * uFXIntensity * 0.55;
        }
        if (uFXMode == 9) {
          float heat = 0.5 + 0.5 * sin(length(vWorldPos.xy) * 6.0 - uTime * 1.8);
          col = mix(col, mix(vec3(0.18, 0.42, 1.0), vec3(1.0, 0.2, 0.02), heat), uFXIntensity * 0.86);
        }
        if (uFXMode == 10) {
          col += vec3(0.55, 0.88, 1.0) * rim * uFXIntensity * 1.5;
          alpha = max(alpha, rim * (0.75 + uFXIntensity * 0.25));
        }
        ${FRAGMENT_FX_BRANCHES}
        gl_FragColor = vec4(col, alpha * uOpacity * fxA);
      }
    `,
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    blending: THREE.AdditiveBlending,
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'RootPoints';
  points.userData.tooltipData = buildRootTooltipData(system);
  parent.add(points);
  return material;
}

function buildRootTooltipData(system) {
  return system.roots.map((root, index) => {
    const simpleIndex = system.simpleRoots.findIndex(simple => (
      Math.abs(simple[0] - root.vector[0]) < 1e-7
      && Math.abs(simple[1] - root.vector[1]) < 1e-7
    ));
    const oppositeIndex = system.roots.findIndex(candidate => (
      Math.abs(candidate.vector[0] + root.vector[0]) < 1e-7
      && Math.abs(candidate.vector[1] + root.vector[1]) < 1e-7
    ));
    const angleDegrees = root.angle * 180 / Math.PI;
    const lengthLabel = system.shortRootCount > 0 ? `${root.kind} root` : 'equal-length root';
    const vector = root.vector.map(formatRootNumber).join(', ');
    const squaredLength = root.length * root.length;
    return {
      html: `<div class="ttip-head">${system.label} root #${index}</div>
        <div><b>${lengthLabel}</b> · angle: <b>${formatRootNumber(angleDegrees)}°</b></div>
        <div>length: <b>${formatRootNumber(root.length)}</b> · squared: <b>${formatRootNumber(squaredLength)}</b></div>
        <div class="ttip-coords">α = (${vector})</div>
        ${oppositeIndex >= 0 ? `<div>opposite: <b>root #${oppositeIndex}</b></div>` : ''}
        ${simpleIndex >= 0 ? `<div style="color:var(--accent);margin-top:4px">★ simple root α${simpleIndex + 1}</div>` : ''}`,
    };
  });
}

function formatRootNumber(value) {
  if (Math.abs(value) < 1e-9) return '0';
  const rounded = Math.round(value);
  if (Math.abs(value - rounded) < 1e-9) return String(rounded);
  return Number(value.toFixed(3)).toString();
}

function addOrbit(parent, system, radius, palette) {
  const maxLength = system.longToShortRatio;
  const orbit = coxeterOrbit(system.id).map(root => [
    root[0] / maxLength * radius,
    root[1] / maxLength * radius,
  ]);
  const positions = [];
  for (let i = 0; i < orbit.length; i++) {
    const a = orbit[i];
    const b = orbit[(i + 1) % orbit.length];
    positions.push(a[0], a[1], 0.012, b[0], b[1], 0.012);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new LineFXMaterial({
    color: colorAt(palette, 0.72),
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  const orbitGroup = new THREE.Group();
  orbitGroup.name = 'RootOrbit';
  orbitGroup.add(new THREE.LineSegments(geometry, material));
  const activeGeometry = new THREE.BufferGeometry();
  activeGeometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.026, 0, 0, 0.026], 3));
  const activeStep = new THREE.Line(activeGeometry, new LineFXMaterial({
    color: colorAt(palette, 0.92),
    transparent: true,
    opacity: 1,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  }));
  activeStep.name = 'CoxeterActiveStep';
  orbitGroup.add(activeStep);

  const markerSize = radius * 0.055;
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(markerSize, 0);
  arrowShape.lineTo(-markerSize * 0.72, markerSize * 0.58);
  arrowShape.lineTo(-markerSize * 0.38, 0);
  arrowShape.lineTo(-markerSize * 0.72, -markerSize * 0.58);
  arrowShape.closePath();
  const marker = new THREE.Mesh(
    new THREE.ShapeGeometry(arrowShape),
    new THREE.MeshBasicMaterial({
      color: colorAt(palette, 0.92),
      transparent: true,
      opacity: 0.96,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  marker.userData.orbit = orbit;
  marker.userData.activeStep = activeStep;
  marker.name = 'CoxeterStepMarker';
  orbitGroup.add(marker);
  parent.add(orbitGroup);
  return marker;
}

function mirrorAnglesFor(system) {
  return system.roots
    .filter(root => root.angle < Math.PI - 1e-7)
    .map(root => root.angle + Math.PI / 2)
    .sort((a, b) => a - b);
}

function disposeObject(root) {
  root.traverse(object => {
    object.geometry?.dispose?.();
    if (Array.isArray(object.material)) object.material.forEach(material => material?.dispose?.());
    else object.material?.dispose?.();
  });
}

function forEachMaterial(root, callback) {
  root?.traverse?.(object => {
    if (Array.isArray(object.material)) object.material.forEach(material => callback(material));
    else if (object.material) callback(object.material);
  });
}
