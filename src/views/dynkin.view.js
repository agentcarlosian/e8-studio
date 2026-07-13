// dynkin.view.js — Render an ADE Dynkin diagram in 3D space (z=0 plane).
//
// Nodes are spheres (Points with custom material); edges are lines.
// Node size scales by node degree; edge color hints at Cartan matrix entry
// (single edges = blue, double = green, triple = red — though ADE only has single).
// Labels α₁..αₙ are drawn as canvas sprites so they stay readable from any angle.

import * as THREE from 'three';
import { colorAt } from '../ui/palettes.js';
import { VERTEX_FX_BRANCHES, FRAGMENT_FX_BRANCHES } from '../fx/fx-branches.js';
import { FX_MODE_MAP } from '../fx/fx-shader.js';

// Convert integer 1-8 to subscript string (₁₂₃₄₅₆₇₈)
const SUB_DIGITS = ['₀','₁','₂','₃','₄','₅','₆','₇','₈','₉'];
function toSubscript(n) {
  return String(n).split('').map(c => SUB_DIGITS[parseInt(c)]).join('');
}

// Create a canvas-rendered text sprite for 3D labels (α₁ etc.)
function makeTextSprite(text, opts = {}) {
  const color = opts.color || '#ffffff';
  const scale = opts.scale || 1;
  const fontSize = 48;
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.font = `bold ${fontSize}px JetBrains Mono, monospace`;
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.95)';
  ctx.shadowBlur = 6;
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(scale * 1.6, scale * 0.8, 1);
  return sprite;
}

export function createDynkinView({ data, palette, scale: baseScale, context = {} }) {
  const group = new THREE.Group();
  group.name = 'Dynkin';
  const runtimeParams = () => context.params || (typeof window !== 'undefined' ? window.__app?.params : null) || {};
  const runtimeCamera = () => context.camera || (typeof window !== 'undefined' ? window.__app?.camera : null) || null;
  const projectedNode = new THREE.Vector3();

  const build = (diagramName) => {
    while (group.children.length) {
      const c = group.children.pop();
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }
    const d = data.dynkin[diagramName];
    if (!d) return;

    // Build subscript labels α₁..αₙ
    const subscripts = [];
    for (let i = 0; i < d.nodes.length; i++) subscripts.push(toSubscript(i + 1));

    // Compute node degrees for sizing
    const degree = new Array(d.nodes.length).fill(0);
    for (const [a, b] of d.edges) { degree[a]++; degree[b]++; }

    // Convert normalized node positions to world units (centered, fit in baseScale)
    // d.nodes positions are already in roughly [-3.5, 3.5] range.
    // We want the diagram to fit within baseScale × 2 world units.
    const nodeScale = (baseScale * 1.5) / 4.0;  // 4-unit spread → fits comfortably

    // Edges
    const linePositions = [];
    for (const [a, b] of d.edges) {
      linePositions.push(
        d.nodes[a][0] * nodeScale, d.nodes[a][1] * nodeScale, 0,
        d.nodes[b][0] * nodeScale, d.nodes[b][1] * nodeScale, 0,
      );
    }
    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
    const edgeMat = new THREE.LineBasicMaterial({
      color: new THREE.Color(colorAt(palette, 0.5)),
      transparent: true,
      opacity: 1.0,
      linewidth: 2,
    });
    group.add(new THREE.LineSegments(edgeGeo, edgeMat));

    // Nodes
    const nodePositions = new Float32Array(d.nodes.length * 3);
    const nodeSizes = new Float32Array(d.nodes.length);
    const nodeColors = new Float32Array(d.nodes.length * 3);
    // Color nodes via hue rotation across the diagram for visual interest
    const baseNodeColor = new THREE.Color(colorAt(palette, 0.6));
    const nodeHsl = { h: 0, s: 0, l: 0 };
    baseNodeColor.getHSL(nodeHsl);
    for (let i = 0; i < d.nodes.length; i++) {
      nodePositions[i*3]     = d.nodes[i][0] * nodeScale;
      nodePositions[i*3 + 1] = d.nodes[i][1] * nodeScale;
      nodePositions[i*3 + 2] = 0;
      nodeSizes[i] = 0.10 + degree[i] * 0.06;
      // Hue rotates across nodes — branch node (last) stands out
      const hueShift = (i / Math.max(1, d.nodes.length - 1) - 0.5) * 0.3;
      const c = new THREE.Color().setHSL(
        (nodeHsl.h + hueShift + 1) % 1,
        Math.min(1, nodeHsl.s + 0.15),
        nodeHsl.l + 0.05
      );
      nodeColors[i*3]     = c.r;
      nodeColors[i*3 + 1] = c.g;
      nodeColors[i*3 + 2] = c.b;
    }
    const nodeGeo = new THREE.BufferGeometry();
    nodeGeo.setAttribute('position', new THREE.BufferAttribute(nodePositions, 3));
    nodeGeo.setAttribute('size', new THREE.BufferAttribute(nodeSizes, 1));
    nodeGeo.setAttribute('color', new THREE.BufferAttribute(nodeColors, 3));

    const nodeMat = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: window.devicePixelRatio || 1 },
        uBaseSize: { value: 0.18 * baseScale },
        uOpacity: { value: 1.0 },
        uTime: { value: 0 },
        uFXMode: { value: 0 },
        uFXIntensity: { value: 0.5 },
      },
      vertexShader: `
        attribute vec3 color;
        attribute float size;
        varying vec3 vColor;
        varying vec3 vWorldPos;
        uniform float uPixelRatio;
        uniform float uBaseSize;
        uniform int uFXMode;
        uniform float uFXIntensity;
        uniform float uTime;
        void main() {
          vColor = color;
          vWorldPos = position;
          float scale = 1.0;
          // FX: ripple / spiral
          if (uFXMode == 4) {
            float r = length(position.xy);
            scale *= 1.0 + uFXIntensity * 0.4 * sin(r * 8.0 - uTime * 4.0);
          }
          if (uFXMode == 5) {
            float a = atan(position.y, position.x);
            scale *= 1.0 + uFXIntensity * 0.5 * sin(a * 6.0 + uTime * 2.0);
          }
          ${VERTEX_FX_BRANCHES}
          // Pixel size with perspective attenuation (matches PointsMaterial sizeAttenuation:true)
          // Approximation: canvas.height/2/tan(fov/2) ≈ 720 for typical 600px canvas + 45° fov
          float persp = 720.0 / max(0.001, -(modelViewMatrix * vec4(position + fxO, 1.0)).z);
          gl_PointSize = uBaseSize * size * scale * fxS * uPixelRatio * persp;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position + fxO, 1.0);
        }
      `,
      fragmentShader: `
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
          float a = smoothstep(0.5, 0.1, d);
          vec3 col = vColor;
          // FX: glow
          if (uFXMode == 1) {
            float g = smoothstep(0.5, 0.05, d) * uFXIntensity * 0.8;
            col += vColor * g * 2.5;
          }
          // FX: kaleidoscope
          if (uFXMode == 3) {
            float h = sin(vWorldPos.x * 5.0 + vWorldPos.y * 3.0) * uFXIntensity * 0.6;
            col.r *= (1.0 + h);
            col.g *= (1.0 + h * 0.4);
            col.b *= (1.0 - h * 0.4);
          }
          ${FRAGMENT_FX_BRANCHES}
          a *= fxA;
          gl_FragColor = vec4(col, a * uOpacity);
          }
          `,
      transparent: true,
      depthWrite: false,
    });
    group.add(new THREE.Points(nodeGeo, nodeMat));
    // Expose material so update() can set FX uniforms
    group.userData.materials = [nodeMat];
    group.userData.trailGeo = nodeGeo;

    // Node labels: α₁, α₂, ... αₙ — drawn as canvas sprites
    for (let i = 0; i < d.nodes.length; i++) {
      const labelSprite = makeTextSprite('α' + subscripts[i], {
        color: '#' + new THREE.Color(nodeColors[i*3], nodeColors[i*3+1], nodeColors[i*3+2])
                          .getHexString(),
        scale: 0.45 * nodeScale,
      });
      labelSprite.position.set(
        d.nodes[i][0] * nodeScale,
        d.nodes[i][1] * nodeScale - 0.18 * nodeScale,  // below the node
        0
      );
      group.add(labelSprite);
    }

    // Live weight labels — HTML overlay divs positioned at projected screen coords
    // λ(t) is a moving vector in R² that cycles through weight space at golden-ratio speed.
    // λᵢ = ⟨λ(t), αᵢ⟩ — the dot product with each simple root.
    // When λᵢ crosses zero, we highlight that node (Weyl chamber wall crossing).
    const lambdaDivs = [];
    const lambdaContainer = document.createElement('div');
    lambdaContainer.id = 'dynkin-lambda-container';
    lambdaContainer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:5;';
    document.querySelector('main').appendChild(lambdaContainer);
    for (let i = 0; i < d.nodes.length; i++) {
      const div = document.createElement('div');
      div.style.cssText = 'position:absolute;font-family:JetBrains Mono,monospace;font-size:11px;color:#fff;text-shadow:0 0 4px rgba(0,0,0,0.95),0 1px 2px rgba(0,0,0,0.8);font-weight:500;transform:translate(-50%,-50%);transition:color 240ms;letter-spacing:0.04em;';
      div.textContent = '0.00';
      lambdaContainer.appendChild(div);
      lambdaDivs.push(div);
    }
    // Track these so update() can dispose them
    group.userData.lambdaDivs = lambdaDivs;
    group.userData.lambdaContainer = lambdaContainer;
    group.userData.PHI = (1 + Math.sqrt(5)) / 2;

    // Weight trajectory trail — small dots showing where λ(t) has been recently
    // Created as HTML overlay divs that fade out as they age
    const TRAIL_LENGTH = 30;
    const trailDots = [];
    const trailContainer = document.createElement('div');
    trailContainer.id = 'dynkin-trail-container';
    trailContainer.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:4;';
    document.querySelector('main').appendChild(trailContainer);
    for (let i = 0; i < TRAIL_LENGTH; i++) {
      const dot = document.createElement('div');
      const opacity = 1 - (i / TRAIL_LENGTH);
      dot.style.cssText = `position:absolute;width:6px;height:6px;border-radius:50%;background:radial-gradient(circle, rgba(255,180,80,${opacity}) 0%, rgba(255,180,80,0) 70%);transform:translate(-50%,-50%);pointer-events:none;`;
      dot.style.left = '50%';
      dot.style.top = '50%';
      trailContainer.appendChild(dot);
      trailDots.push(dot);
    }
    group.userData.trailDots = trailDots;
    group.userData.trailContainer = trailContainer;
    group.userData.trailIdx = 0;
    group.userData.trailHistory = [];

    // Compute layout dimensions for the panel info
    const xs = d.nodes.map(n => n[0]);
    const ys = d.nodes.map(n => n[1]);
    group.userData.bounds = {
      minX: Math.min(...xs) * nodeScale,
      maxX: Math.max(...xs) * nodeScale,
      minY: Math.min(...ys) * nodeScale,
      maxY: Math.max(...ys) * nodeScale,
    };
  };

  const initial = runtimeParams().dynkin || 'E8';
  build(initial);
  let lastDiagram = initial;

  return {
    group,
    object3d: group,
    name: 'dynkin',

    update(dt, time, params) {
      const cur = runtimeParams().dynkin;
      if (cur && cur !== lastDiagram) {
        lastDiagram = cur;
        build(cur);
      }
      if (params.autoRotate) {
        const recScale = params._recording ? (params._recordingMotionScale ?? 0.4) : 1;
        group.rotation.z += dt * params.rotationSpeed * recScale;
      }

      // Live weight animation: λ(t) is a moving vector in 2D that
      // cycles through weight space. λᵢ = ⟨λ(t), αᵢ⟩ in 2D coords.
      // When λᵢ crosses zero, we highlight that node (Weyl chamber crossing).
      const PHI = group.userData.PHI || 1.618;
      const lambdaDivs = group.userData.lambdaDivs;
      const d = data.dynkin[lastDiagram];
      if (lambdaDivs && d && d.nodes) {
        // Compute λ(t) — a circle in weight space at golden-ratio speed
        const tx = time * 0.35;
        const lambda = [
          1.8 * Math.cos(tx) + 0.6 * Math.sin(tx * 2.3 * PHI),
          1.8 * Math.sin(tx * 0.83) + 0.6 * Math.cos(tx * 1.7 * PHI),
        ];
        const nodeScale = (params.baseScale || 1.6) * 1.5 / 4.0;
        const canvas = document.getElementById('canvas');
        const rect = canvas.getBoundingClientRect();
        const W = rect.width, H = rect.height;
        const cam = runtimeCamera();

        // Project a 3D point in the group's local space to canvas pixel coords,
        // using the real three.js camera. Vector3.project() applies the camera's
        // full matrixWorldInverse + projectionMatrix (FOV, distance, rotation),
        // so labels track the diagram exactly as the user orbits/zooms. The
        // group's own world matrix is baked in via group.localToWorld().
        // Reused to avoid per-node allocation.
        const projectV = (x3, y3) => {
          if (!cam) {
            return { x: rect.left + W / 2 + x3 * 110, y: rect.top + H / 2 - y3 * 110 };
          }
          projectedNode.set(x3, y3, 0);
          group.localToWorld(projectedNode); // local diagram coords → world
          projectedNode.project(cam);        // world → normalized device coords [-1,1]
          return {
            x: rect.left + W / 2 + (projectedNode.x * 0.5) * W,
            y: rect.top + H / 2 - (projectedNode.y * 0.5) * H,
          };
        };

        // Walk every node, compute λᵢ, update HTML label
        for (let i = 0; i < d.nodes.length; i++) {
          const alpha = d.nodes[i];
          const dot = lambda[0] * alpha[0] + lambda[1] * alpha[1];
          const sign = dot >= 0 ? '+' : '−';
          const absDot = Math.abs(dot);
          lambdaDivs[i].textContent = sign + absDot.toFixed(2);

          // Project 3D node position to screen using proper perspective
          const x3 = alpha[0] * nodeScale;
          const y3 = alpha[1] * nodeScale;
          const { x: screenX, y: screenY } = projectV(x3, y3);
          lambdaDivs[i].style.left = screenX + 'px';
          lambdaDivs[i].style.top = screenY + 'px';

          // Color: bright orange when crossing zero, white otherwise
          const t = Math.min(1, Math.abs(dot) * 1.2);
          if (t < 0.15) {
            lambdaDivs[i].style.color = '#ff9550'; // crossing — orange highlight
            lambdaDivs[i].style.fontSize = '13px';
          } else {
            lambdaDivs[i].style.color = `rgba(255, 255, 255, ${1 - t * 0.5})`;
            lambdaDivs[i].style.fontSize = '11px';
          }
        }

        // Update weight trajectory trail — record λ position every few frames
        // and place each trail dot at its historical screen position
        const trailDots = group.userData.trailDots;
        const trailIdx = group.userData.trailIdx || 0;
        if (trailDots && trailDots.length > 0) {
          // Sample every ~3 frames so the trail extends nicely
          if (!group.userData.trailFrame) group.userData.trailFrame = 0;
          group.userData.trailFrame++;
          if (group.userData.trailFrame % 3 === 0) {
            const trailPoint = projectV(lambda[0] * nodeScale, lambda[1] * nodeScale);
            // The trail dot at index trailIdx gets this new position;
            // older dots keep their position. New index = (trailIdx + 1) % length
            trailDots[trailIdx].style.left = trailPoint.x + 'px';
            trailDots[trailIdx].style.top = trailPoint.y + 'px';
            group.userData.trailIdx = (trailIdx + 1) % trailDots.length;
          }
        }
      }

      // FX uniform updates + trail decay. Canonical FX map (0–23) so all modes
      // work — the old local map only reached modes 0–5.
      if (group.userData.materials) {
        for (const m of group.userData.materials) {
          if (m.uniforms) {
            if (m.uniforms.uFXMode) m.uniforms.uFXMode.value = FX_MODE_MAP[params.fxMode] ?? 0;
            if (m.uniforms.uFXIntensity) m.uniforms.uFXIntensity.value = params.fxIntensity ?? 0.5;
            if (m.uniforms.uTime) m.uniforms.uTime.value = time;
          }
        }
      }
      // Trail: decay color intensities each frame
      if (params.fxMode === 'trail' && group.userData.trailGeo) {
        const c = group.userData.trailGeo.attributes.color.array;
        for (let i = 0; i < c.length; i++) c[i] *= 0.97;
        group.userData.trailGeo.attributes.color.needsUpdate = true;
      }
    },

    dispose() {
      // Clean up lambda + trail HTML overlay divs
      if (group.userData.lambdaContainer && group.userData.lambdaContainer.parentNode) {
        group.userData.lambdaContainer.parentNode.removeChild(group.userData.lambdaContainer);
      }
      if (group.userData.trailContainer && group.userData.trailContainer.parentNode) {
        group.userData.trailContainer.parentNode.removeChild(group.userData.trailContainer);
      }
      group.userData.lambdaDivs = null;
      group.userData.lambdaContainer = null;
      group.userData.trailDots = null;
      group.userData.trailContainer = null;
      group.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
    },
  };
}
