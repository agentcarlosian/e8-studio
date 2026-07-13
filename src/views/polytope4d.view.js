// polytope4d.view.js — Render a 4D regular polytope projected to 3D.
//
// The 4D vertices are rotated in two planes (XY and ZW) using 4×4 rotation
// matrices, then projected to 3D via perspective division on the 4th coordinate
// (controlled by a depth slider). Edges connect adjacent vertices.
//
// Implements: tesseract, 16-cell, 24-cell (the most iconic 4D polytopes).

import * as THREE from 'three';
import { colorAt } from '../ui/palettes.js';
import { LineFXMaterial } from '../fx/fx-line-shader.js';
import { FX_MODE_MAP } from '../fx/fx-shader.js';
import { VERTEX_FX_BRANCHES, FRAGMENT_FX_BRANCHES } from '../fx/fx-branches.js';

const PHI = (1 + Math.sqrt(5)) / 2;

// Build a 4x4 row-major rotation matrix in the (i, j) plane by angle a.
function rot4Plane(i, j, a) {
  const M = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  const c = Math.cos(a), s = Math.sin(a);
  M[i*4+i] = c;  M[i*4+j] = -s;
  M[j*4+i] = s;  M[j*4+j] =  c;
  return M;
}

// Multiply two 4x4 row-major matrices.
function mul4(a, b) {
  const out = new Array(16);
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      let s = 0;
      for (let k = 0; k < 4; k++) s += a[r*4+k] * b[k*4+c];
      out[r*4+c] = s;
    }
  }
  return out;
}

// Apply a 4x4 matrix to a 4-vector (column vector).
function apply4(M, v) {
  return [
    M[0]*v[0] + M[4]*v[1] + M[8]*v[2]  + M[12]*v[3],
    M[1]*v[0] + M[5]*v[1] + M[9]*v[2]  + M[13]*v[3],
    M[2]*v[0] + M[6]*v[1] + M[10]*v[2] + M[14]*v[3],
    M[3]*v[0] + M[7]*v[1] + M[11]*v[2] + M[15]*v[3],
  ];
}

// Perspective projection from 4D to 3D.
// vOffset shifts the "camera" along the 4th axis (slider-controlled depth).
function project4to3(v4, vOffset) {
  const w = v4[3];
  const denom = 1 - 0.4 * vOffset * w;
  return [v4[0] / denom, v4[1] / denom, v4[2] / denom];
}

export function createPolytope4DView({ data, palette, scale: baseScale, context = {} }) {
  const group = new THREE.Group();
  group.name = 'Polytope4D';
  const runtimeParams = () => context.params || (typeof window !== 'undefined' ? window.__app?.params : null) || {};

  const build = (polyName) => {
    while (group.children.length) {
      const c = group.children.pop();
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }
    const p = data.polytopes4d[polyName];
    if (!p) return;

    // Perspective separates the tesseract into an outer and inner cube. Scale
    // its source coordinates down so the enlarged outer cube remains framed.
    const R = polyName === 'tesseract' ? baseScale * 0.6 : baseScale;
    const verts4 = p.verts;
    const edges = p.edges;

    // Center 4D verts (they may already be centered; safety normalize)
    // For polytopes from precompute, they're already centered. We scale to baseScale.

    // Edges — connect every pair of adjacent vertices with line segments
    const edgePositions = [];
    for (const [a, b] of edges) {
      edgePositions.push(
        verts4[a][0] * R, verts4[a][1] * R, verts4[a][2] * R,
        verts4[b][0] * R, verts4[b][1] * R, verts4[b][2] * R,
      );
    }
    const edgeGeo = new THREE.BufferGeometry();
    edgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(edgePositions, 3));
    const edgeMat = new LineFXMaterial({
      color: new THREE.Color(colorAt(palette, 0.7)),
      transparent: true,
      opacity: 0.75,
    });
    const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
    group.add(edgeLines);

    // Save edges + 4D verts for update()
    group.userData.edges = edges;
    group.userData.verts4 = verts4;
    group.userData.edgeLines = edgeLines;
    group.userData.R = R;
    group.userData.nVerts = verts4.length;

    // Vertex points (initially at z=0; positions updated each frame)
    const vPositions = new Float32Array(verts4.length * 3);
    const vColors = new Float32Array(verts4.length * 3);
    const baseVColor = new THREE.Color(colorAt(palette, 0.95));
    for (let i = 0; i < verts4.length; i++) {
      vColors[i*3]     = baseVColor.r;
      vColors[i*3 + 1] = baseVColor.g;
      vColors[i*3 + 2] = baseVColor.b;
    }
    const vGeo = new THREE.BufferGeometry();
    vGeo.setAttribute('position', new THREE.BufferAttribute(vPositions, 3));
    vGeo.setAttribute('color', new THREE.BufferAttribute(vColors, 3));
    const vMat = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: window.devicePixelRatio || 1 },
        uBaseSize: { value: 0.06 * baseScale },
        uOpacity: { value: 1.0 },
        uTime: { value: 0 },
        uFXMode: { value: 0 },
        uFXIntensity: { value: 0.5 },
      },
      vertexShader: `
        attribute vec3 color;
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
          gl_PointSize = uBaseSize * scale * fxS * uPixelRatio * (720.0 / max(0.001, -(modelViewMatrix * vec4(position + fxO, 1.0)).z));
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
    const vPoints = new THREE.Points(vGeo, vMat);
    group.add(vPoints);
    group.userData.vPoints = vPoints;
    // Expose material so update() can set FX uniforms
    group.userData.materials = [vMat];
    group.userData.trailGeo = vGeo;
  };

  const initial = runtimeParams().poly4d || '24cell';
  build(initial);
  let lastPoly = initial;

  // 4D rotation state (two independent rotation angles)
  let angleXY = 0, angleZW = 0, angleXZ = 0, angleYW = 0, angleXW = 0, angleYZ = 0;

  // Compute current 4D rotation matrix from all six angle planes.
  // Round 9 added XZ + YW (4 total); Round 10 completes all 6 planes of ℝ⁴
  // (XY, ZW, XZ, YW, XW, YZ). The six planes are the full general-rotation
  // group of 4D space — together they can reach any orientation. Note 4D
  // rotations don't commute, so the composition order is arbitrary but fixed.
  function computeRotation(aXY, aZW, aXZ, aYW, aXW, aYZ) {
    const rXY = rot4Plane(0, 1, aXY);
    const rZW = rot4Plane(2, 3, aZW);
    const rXZ = rot4Plane(0, 2, aXZ || 0);
    const rYW = rot4Plane(1, 3, aYW || 0);
    const rXW = rot4Plane(0, 3, aXW || 0);
    const rYZ = rot4Plane(1, 2, aYZ || 0);
    return mul4(mul4(mul4(mul4(mul4(rXY, rZW), rXZ), rYW), rXW), rYZ);
  }

  return {
    group,
    object3d: group,
    name: 'polytope4d',

    update(dt, time, params) {
      const cur = runtimeParams().poly4d;
      if (cur && cur !== lastPoly) {
        lastPoly = cur;
        build(cur);
      }

      // Auto-rotate in 4D (all six planes simultaneously for rich motion)
      // unless the user took control via any slider.
      if (params.polyAutoRotate) {
        const speed = params.polyRotationSpeed ?? 0.18;
        angleXY += dt * speed * 1.2;
        angleZW += dt * speed * 0.9;
        angleXZ += dt * speed * 0.7;
        angleYW += dt * speed * 0.5;
        angleXW += dt * speed * 0.4;
        angleYZ += dt * speed * 0.3;
      } else {
        // User-controlled: read from params (slider position is radians)
        angleXY = params.polyRotXY || 0;
        angleZW = params.polyRotZW || 0;
        angleXZ = params.polyRotXZ || 0;
        angleYW = params.polyRotYW || 0;
        angleXW = params.polyRotXW || 0;
        angleYZ = params.polyRotYZ || 0;
      }

      const M = computeRotation(angleXY, angleZW, angleXZ, angleYW, angleXW, angleYZ);
      // The shared Extrude control joins the native W-depth projection.
      const wOffset = (params.morph4d || 0) + (params.e8MorphT || 0) * 1.25;

      const verts4 = group.userData.verts4;
      const R = group.userData.R;
      const nVerts = group.userData.nVerts;

      // Update edge positions (rotate 4D → project 3D)
      const edges = group.userData.edges;
      const edgePositions = group.userData.edgeLines.geometry.attributes.position.array;
      for (let i = 0; i < edges.length; i++) {
        const [a, b] = edges[i];
        const va = apply4(M, verts4[a]);
        const vb = apply4(M, verts4[b]);
        const pa = project4to3(va, wOffset);
        const pb = project4to3(vb, wOffset);
        edgePositions[i*6]     = pa[0] * R;
        edgePositions[i*6 + 1] = pa[1] * R;
        edgePositions[i*6 + 2] = pa[2] * R;
        edgePositions[i*6 + 3] = pb[0] * R;
        edgePositions[i*6 + 4] = pb[1] * R;
        edgePositions[i*6 + 5] = pb[2] * R;
      }
      group.userData.edgeLines.geometry.attributes.position.needsUpdate = true;

      // Update vertex positions
      const vPositions = group.userData.vPoints.geometry.attributes.position.array;
      for (let i = 0; i < nVerts; i++) {
        const v4 = apply4(M, verts4[i]);
        const p3 = project4to3(v4, wOffset);
        vPositions[i*3]     = p3[0] * R;
        vPositions[i*3 + 1] = p3[1] * R;
        vPositions[i*3 + 2] = p3[2] * R;
      }
      group.userData.vPoints.geometry.attributes.position.needsUpdate = true;

      // FX uniform updates + trail decay.
      // Use canonical 11-mode FX map (was hardcoded 6-mode map that silently
      // failed for fog/heat/edge-glow/pulse/chromatic).
      const fxModeId = FX_MODE_MAP[params.fxMode] ?? 0;
      for (const m of group.userData.materials) {
        if (m.uniforms) {
          if (m.uniforms.uFXMode) m.uniforms.uFXMode.value = fxModeId;
          if (m.uniforms.uFXIntensity) m.uniforms.uFXIntensity.value = params.fxIntensity ?? 0.5;
          if (m.uniforms.uTime) m.uniforms.uTime.value = time;
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
      group.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
    },
  };
}
