// tiling.view.js — Coxeter multigrids and their dual rhombus tilings.

import * as THREE from 'three';
import { colorAt } from '../ui/palettes.js';
import { LineFXMaterial } from '../fx/fx-line-shader.js';
import { makeTriangleBarycentrics, SurfaceFXMaterial } from '../fx/fx-surface-material.js';
import { generateCoxeterTiling } from '../math/coxeter-tilings.js';

export function createTilingView({ palette, scale: baseScale, context = {} }) {
  const group = new THREE.Group();
  group.name = 'TilingLab';
  const runtimeParams = () => context.params || window.__app?.params || {};
  let construction = null;
  let tilingGroup = null;
  let surface = null;
  let rootGuide = null;
  let activeSignature = '';

  function build(params = runtimeParams()) {
    if (tilingGroup) {
      forEachMaterial(tilingGroup, material => context.unregisterFXMaterial?.(material));
      group.remove(tilingGroup);
      disposeObject(tilingGroup);
    }
    const systemId = params.tilingSystem || 'H2';
    const density = Math.round(params.tilingDensity ?? 5);
    const relief = params.tilingRelief ?? 0.1;
    activeSignature = `${systemId}|${density}|${relief.toFixed(3)}`;
    construction = generateCoxeterTiling(systemId, { density });
    tilingGroup = new THREE.Group();
    tilingGroup.name = `Tiling-${systemId}`;
    group.add(tilingGroup);
    const radius = baseScale;
    const paletteName = params.palette || palette;

    surface = addTileSurface(tilingGroup, construction, radius, relief, paletteName);
    addTileEdges(tilingGroup, construction, radius, relief, paletteName);
    addMultigrid(tilingGroup, construction, radius, paletteName);
    rootGuide = addRootDirections(tilingGroup, construction, radius, paletteName);
    addVertices(tilingGroup, construction, radius, relief, paletteName);
    addTooltipTargets(tilingGroup, construction, radius, relief);
    forEachMaterial(tilingGroup, material => context.registerFXMaterial?.(material));
    applyVisibility(params);
  }

  function applyVisibility(params) {
    const child = name => tilingGroup?.getObjectByName(name);
    if (child('TilingTiles')) child('TilingTiles').visible = params.tilingShowTiles !== false;
    if (child('TilingEdges')) child('TilingEdges').visible = params.tilingShowEdges !== false;
    if (child('TilingGrid')) child('TilingGrid').visible = params.tilingShowGrid === true;
    if (child('TilingRoots')) child('TilingRoots').visible = params.tilingShowRoots !== false;
    if (child('TilingVertices')) child('TilingVertices').visible = params.tilingShowVertices === true;
  }

  build();

  return {
    group,
    object3d: group,
    name: 'tiling',

    update(dt, time, params) {
      const signature = `${params.tilingSystem || 'H2'}|${Math.round(params.tilingDensity ?? 5)}|${(params.tilingRelief ?? 0.1).toFixed(3)}`;
      if (signature !== activeSignature) build(params);
      applyVisibility(params);
      if (params.autoRotate) {
        const motionScale = params._recording ? (params._recordingMotionScale ?? 0.4) : 1;
        group.rotation.z += dt * (params.rotationSpeed || 0.003) * 34 * motionScale;
      }
      const speed = Math.max(0.1, params.tilingFlowSpeed ?? 0.55);
      const motion = params.tilingAnimate !== false ? Math.sin(time * speed * 1.7) : 0;
      updateTileSurfaceFlow(surface, time, speed, params.tilingAnimate !== false);
      if (surface) surface.position.z = motion * (params.tilingRelief ?? 0.1) * 0.04;
      // The root star is an optional construction guide, not part of the flow
      // animation. Keeping it fixed makes the directions readable and avoids
      // a distracting clock-hand effect over the tiling.
      if (rootGuide) rootGuide.rotation.z = 0;
    },

    onPaletteChange(nextPalette) {
      palette = nextPalette;
      build(runtimeParams());
    },

    dispose() {
      forEachMaterial(group, material => context.unregisterFXMaterial?.(material));
      disposeObject(group);
      construction = null;
      surface = null;
      rootGuide = null;
    },
  };
}

function reliefHeight(x, y, relief) {
  if (!relief) return 0;
  const radial = Math.hypot(x, y);
  return relief * (
    Math.sin(radial * 8.5) * 0.42
    + Math.cos(x * 6.2 - y * 4.7) * 0.22
  );
}

function addTileSurface(parent, tiling, radius, relief, palette) {
  const positions = [];
  const colors = [];
  const colorPhases = [];
  for (const tile of tiling.tiles) {
    const phase = tileColorPosition(tile, tiling);
    const color = new THREE.Color(colorAt(palette, phase));
    colorPhases.push(phase);
    for (const index of [0, 1, 2, 0, 2, 3]) {
      const point = tile.points[index];
      positions.push(
        point[0] * radius,
        point[1] * radius,
        reliefHeight(point[0], point[1], relief) * radius,
      );
      colors.push(color.r, color.g, color.b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('fxBarycentric', new THREE.Float32BufferAttribute(makeTriangleBarycentrics(tiling.tiles.length * 2), 3));
  geometry.computeVertexNormals();
  const material = new SurfaceFXMaterial({
    color: 0xffffff,
    vertexColors: true,
    emissive: 0x19110a,
    emissiveIntensity: 0.28,
    roughness: 0.62,
    metalness: 0.08,
    transparent: true,
    opacity: 0.62,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = 'TilingTiles';
  mesh.renderOrder = 1;
  mesh.userData.flow = {
    colorPhases,
    paletteLut: Array.from({ length: 128 }, (_, index) => new THREE.Color(colorAt(palette, index / 128))),
    lastStep: 0,
  };
  parent.add(mesh);
  return mesh;
}

function updateTileSurfaceFlow(surface, time, speed, enabled) {
  const flow = surface?.userData?.flow;
  const color = surface?.geometry?.attributes?.color;
  if (!flow || !color) return false;
  const turn = enabled ? time * speed * 0.045 : 0;
  const step = enabled ? Math.floor(turn * flow.paletteLut.length) : 0;
  if (step === flow.lastStep) return false;
  flow.lastStep = step;
  const lutLength = flow.paletteLut.length;
  flow.colorPhases.forEach((phase, tileIndex) => {
    const colorIndex = Math.floor(positiveTurn(phase + turn) * lutLength) % lutLength;
    const next = flow.paletteLut[colorIndex];
    const start = tileIndex * 6;
    for (let vertex = 0; vertex < 6; vertex++) color.setXYZ(start + vertex, next.r, next.g, next.b);
  });
  color.needsUpdate = true;
  return true;
}

function addTileEdges(parent, tiling, radius, relief, palette) {
  const positions = [];
  const colors = [];
  for (const edge of tiling.edges) {
    const center = [
      (edge.points[0][0] + edge.points[1][0]) / 2,
      (edge.points[0][1] + edge.points[1][1]) / 2,
    ];
    const angle = Math.atan2(center[1], center[0]);
    const color = new THREE.Color(colorAt(palette, positiveTurn(angle / (Math.PI * 2))));
    for (const point of edge.points) {
      positions.push(
        point[0] * radius,
        point[1] * radius,
        reliefHeight(point[0], point[1], relief) * radius + 0.014,
      );
      colors.push(color.r, color.g, color.b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const material = new LineFXMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: 0.56,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.name = 'TilingEdges';
  lines.renderOrder = 3;
  parent.add(lines);
}

function addMultigrid(parent, tiling, radius, palette) {
  const positions = [];
  const colors = [];
  for (const line of tiling.lines) {
    const color = new THREE.Color(colorAt(palette, line.family / Math.max(1, tiling.familyCount - 1)));
    for (const point of line.points) {
      positions.push(point[0] * radius, point[1] * radius, -0.07);
      colors.push(color.r, color.g, color.b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const material = new LineFXMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: 0.25,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.name = 'TilingGrid';
  lines.renderOrder = 0;
  parent.add(lines);
}

function addRootDirections(parent, tiling, radius, palette) {
  const positions = [];
  const colors = [];
  tiling.directions.forEach((direction, index) => {
    const color = new THREE.Color(colorAt(palette, index / tiling.directions.length));
    positions.push(0, 0, 0.12, direction[0] * radius * 0.46, direction[1] * radius * 0.46, 0.12);
    colors.push(color.r, color.g, color.b, color.r, color.g, color.b);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const material = new LineFXMaterial({
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const roots = new THREE.LineSegments(geometry, material);
  roots.name = 'TilingRoots';
  roots.renderOrder = 4;
  parent.add(roots);
  return roots;
}

function addVertices(parent, tiling, radius, relief, palette) {
  const positions = [];
  const colors = [];
  for (const vertex of tiling.vertices) {
    const point = vertex.point;
    const color = new THREE.Color(colorAt(palette, positiveTurn(Math.atan2(point[1], point[0]) / (Math.PI * 2))));
    positions.push(
      point[0] * radius,
      point[1] * radius,
      reliefHeight(point[0], point[1], relief) * radius + 0.022,
    );
    colors.push(color.r, color.g, color.b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const material = new THREE.PointsMaterial({
    size: 0.027,
    color: 0xffffff,
    vertexColors: true,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    sizeAttenuation: true,
    blending: THREE.AdditiveBlending,
  });
  const vertices = new THREE.Points(geometry, material);
  vertices.name = 'TilingVertices';
  vertices.renderOrder = 5;
  parent.add(vertices);
}

function addTooltipTargets(parent, tiling, radius, relief) {
  const positions = [];
  for (const tile of tiling.tiles) {
    positions.push(
      tile.center[0] * radius,
      tile.center[1] * radius,
      reliefHeight(tile.center[0], tile.center[1], relief) * radius + 0.045,
    );
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({
    size: 0.001,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const targets = new THREE.Points(geometry, material);
  targets.name = 'TilingTooltipTargets';
  targets.userData.tooltipData = tiling.tiles.map((tile, index) => ({
    html: `<div class="ttip-head">${tiling.label} tile #${index}</div>
      <div><b>${formatDegrees(tile.angleDegrees)} rhombus</b> · families ${tile.familyA + 1} + ${tile.familyB + 1}</div>
      <div>grid crossing: <b>(${tile.indexA}, ${tile.indexB})</b></div>
      <div class="ttip-coords">dual center = (${tile.center.map(value => Number(value.toFixed(3))).join(', ')})</div>
      <div style="color:var(--muted);margin-top:4px">One multigrid crossing becomes one tile.</div>`,
  }));
  parent.add(targets);
}

function tileColorPosition(tile, tiling) {
  const family = (tile.familyA + tile.familyB * 0.62) / Math.max(1, tiling.familyCount * 1.62);
  const radial = Math.hypot(tile.center[0], tile.center[1]);
  const angular = positiveTurn(Math.atan2(tile.center[1], tile.center[0]) / (Math.PI * 2));
  return positiveTurn(family * 0.54 + angular * 0.31 + radial * 0.18);
}

function formatDegrees(value) {
  return `${Number(value.toFixed(1))}°`;
}

function positiveTurn(value) {
  return ((value % 1) + 1) % 1;
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
