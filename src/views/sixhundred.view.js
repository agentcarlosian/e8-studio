// sixhundred.view.js — Render the 600-cell (binary icosahedral group)
//
// 120 unit quaternions = 600-cell vertices in R^4.
// 720 edges (chord length 1/φ when radius = 1).
// 9 conjugacy classes by rotation angle from identity (1+12+20+12+30+12+20+12+1).
//
// This is the McKay-correspondence bridge: the icosahedron's rotational
// symmetry gives the 600-cell. The Studio compares this with E8 through McKay
// and H4-inspired projections; two ordinary 600-cells are not literally E8.

import * as THREE from 'three';
import { colorAt } from '../ui/palettes.js';
import { FX_MODE_MAP } from '../fx/fx-shader.js';
import { LineFXMaterial } from '../fx/fx-line-shader.js';
import { VERTEX_FX_BRANCHES, FRAGMENT_FX_BRANCHES } from '../fx/fx-branches.js';

// 9 class labels for legend / color picking
const CLASS_LABELS = [
  '0°',     // identity
  '72°',    // nearest (12)
  '120°',   // next (20)
  '144°',   // (12)
  '180°',   // icosidodecahedron (30)
  '216°',   // (12)
  '240°',   // (20)
  '288°',   // (12)
  '360°',   // antipode of identity
];

// Conjugacy class sizes (1, 12, 20, 12, 30, 12, 20, 12, 1)
const CLASS_SIZES = [1, 12, 20, 12, 30, 12, 20, 12, 1];

function rot4Plane(i, j, a) {
  const M = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
  const c = Math.cos(a), s = Math.sin(a);
  M[i*4+i] = c;  M[i*4+j] = -s;
  M[j*4+i] = s;  M[j*4+j] =  c;
  return M;
}
function mul4(a, b) {
  const out = new Array(16);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
    let s = 0;
    for (let k = 0; k < 4; k++) s += a[r*4+k] * b[k*4+c];
    out[r*4+c] = s;
  }
  return out;
}
function apply4(M, v) {
  return [
    M[0]*v[0] + M[4]*v[1] + M[8]*v[2]  + M[12]*v[3],
    M[1]*v[0] + M[5]*v[1] + M[9]*v[2]  + M[13]*v[3],
    M[2]*v[0] + M[6]*v[1] + M[10]*v[2] + M[14]*v[3],
    M[3]*v[0] + M[7]*v[1] + M[11]*v[2] + M[15]*v[3],
  ];
}
function project4to3(v4, wOffset) {
  const w = v4[3];
  const denom = 1 - 0.4 * wOffset * w;
  return [v4[0] / denom, v4[1] / denom, v4[2] / denom];
}

export function createSixHundredView({ data, palette, scale: baseScale, context = {} }) {
  const group = new THREE.Group();
  group.name = '600cell';
  const runtimeParams = () => context.params || (typeof window !== 'undefined' ? window.__app?.params : null) || {};

  const p = data.polytopes4d['600cell'];
  if (!p) throw new Error('No 600-cell data');

  const R = baseScale;
  const verts4 = p.verts;
  const edges = p.edges;
  const classes = p.conjugacy_classes;

  // 9 colors (one per conjugacy class) — rotate hue through full spectrum
  // using chroma.js's HSL hue shift on the base palette color
  const baseColor = new THREE.Color(colorAt(palette, 0.5));
  const hsl = { h: 0, s: 0, l: 0 };
  baseColor.getHSL(hsl);
  const classColors = CLASS_LABELS.map((_, i) => {
    // Distribute hues across the full 360° wheel — even spaced
    const hueShift = (i - 4) * 0.11;  // -0.44 to +0.44, full spectrum coverage
    const c = new THREE.Color().setHSL(
      (hsl.h + hueShift + 1) % 1,
      Math.min(1, hsl.s + 0.1),
      hsl.l
    );
    return c;
  });

  // Pre-build edge geometry (positions update each frame)
  const edgePositions = new Float32Array(edges.length * 6);
  for (let i = 0; i < edges.length; i++) {
    const [a, b] = edges[i];
    edgePositions[i*6]     = verts4[a][0] * R;
    edgePositions[i*6 + 1] = verts4[a][1] * R;
    edgePositions[i*6 + 2] = verts4[a][2] * R;
    edgePositions[i*6 + 3] = verts4[b][0] * R;
    edgePositions[i*6 + 4] = verts4[b][1] * R;
    edgePositions[i*6 + 5] = verts4[b][2] * R;
  }
  const edgeGeo = new THREE.BufferGeometry();
  edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3));
  // Color edges by the larger (further-from-identity) class of the two endpoints —
  // creates a visual gradient from the "center" outward as icosa → dodeca → icosa → icosidodeca
  const edgeColors = new Float32Array(edges.length * 6);
  for (let i = 0; i < edges.length; i++) {
    const [a, b] = edges[i];
    const cls = Math.max(classes[a], classes[b]);
    const c = classColors[cls];
    edgeColors[i*6]     = c.r;
    edgeColors[i*6 + 1] = c.g;
    edgeColors[i*6 + 2] = c.b;
    edgeColors[i*6 + 3] = c.r;
    edgeColors[i*6 + 4] = c.g;
    edgeColors[i*6 + 5] = c.b;
  }
  edgeGeo.setAttribute('color', new THREE.BufferAttribute(edgeColors, 3));
  const edgeMat = new LineFXMaterial({
    color: 0xffffff,          // multiplied with per-vertex colors in the shader
    vertexColors: true,
    transparent: true,
    opacity: 0.45,
  });
  const edgeLines = new THREE.LineSegments(edgeGeo, edgeMat);
  group.add(edgeLines);

  // Vertex points (positions + per-vertex color update each frame)
  const vPositions = new Float32Array(verts4.length * 3);
  const vColors = new Float32Array(verts4.length * 3);
  const vSizes = new Float32Array(verts4.length);  // for per-vertex pulse
  // Per-vertex "highlight" — 1 if this vertex is in the active McKay subset, else 0
  const vHighlight = new Float32Array(verts4.length);
  for (let i = 0; i < verts4.length; i++) {
    const c = classColors[classes[i]];
    vColors[i*3]     = c.r;
    vColors[i*3 + 1] = c.g;
    vColors[i*3 + 2] = c.b;
    vSizes[i] = 1.0;
  }
  const vGeo = new THREE.BufferGeometry();
  vGeo.setAttribute('position', new THREE.BufferAttribute(vPositions, 3));
  vGeo.setAttribute('color', new THREE.BufferAttribute(vColors, 3));

  // Custom shader for per-vertex pulsing on highlighted subset
  const vMat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uPixelRatio: { value: window.devicePixelRatio || 1 },
      uBaseSize: { value: 0.05 * baseScale },
      uFXMode: { value: 0 },
      uFXIntensity: { value: 0.5 },
    },
    vertexShader: `
      attribute vec3 color;
      attribute float highlight;
      attribute float vsize;
      varying vec3 vColor;
        varying vec3 vWorldPos;
      varying float vHighlight;
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uBaseSize;
      uniform int uFXMode;
      uniform float uFXIntensity;
      void main() {
        vColor = color;
          vWorldPos = position;
        vHighlight = highlight;
        float pulse = 1.0 + highlight * 0.6 * sin(uTime * 3.5 + vsize);
        // FX: ripple / spiral modify pulse
        if (uFXMode == 4) {
          float r = length(position.xy);
          pulse *= 1.0 + uFXIntensity * 0.4 * sin(r * 8.0 - uTime * 4.0);
        }
        if (uFXMode == 5) {
          float a = atan(position.y, position.x);
          pulse *= 1.0 + uFXIntensity * 0.5 * sin(a * 6.0 + uTime * 2.0);
        }
        ${VERTEX_FX_BRANCHES}
        vec4 mv = modelViewMatrix * vec4(position + fxO, 1.0);
        gl_PointSize = uBaseSize * vsize * pulse * fxS * uPixelRatio * (720.0 / max(0.001, -mv.z));
        gl_Position = projectionMatrix * mv;
      }
    `,
    fragmentShader: `
    varying vec3 vColor;
        varying vec3 vWorldPos;
    varying float vHighlight;
    uniform int uFXMode;
    uniform float uFXIntensity;
    uniform float uTime;
    void main() {
      vec2 c = gl_PointCoord - vec2(0.5);
      float d = length(c);
      if (d > 0.5) discard;
      float a = smoothstep(0.5, 0.15, d);
      // Highlighted vertices: bright white halo (much more visible)
      float halo = smoothstep(0.5, 0.45, d) * vHighlight;
      vec3 base = vColor;
      vec3 lit = mix(base, vec3(1.0, 0.95, 0.85), vHighlight * 0.7);
      vec3 col = lit + vec3(halo * 1.2);
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
      gl_FragColor = vec4(col, a);
    }
    `,
    transparent: true,
    depthWrite: false,
  });
  vGeo.setAttribute('highlight', new THREE.BufferAttribute(vHighlight, 1));
  vGeo.setAttribute('vsize', new THREE.BufferAttribute(vSizes, 1));
  const vPoints = new THREE.Points(vGeo, vMat);
  group.add(vPoints);

  // Tooltip data for each vertex — shows class, McKay subset membership
  const CLASS_NAMES = ['identity', 'icosahedral-72°', 'dodeca-120°', 'icosa-144°',
                      'icosidodeca-180°', 'icosa-216°', 'dodeca-240°', 'icosa-288°', 'antipode'];
  vPoints.userData.tooltipData = verts4.map((v, i) => {
    const c = classes[i];
    const size = CLASS_SIZES[c];
    const label = CLASS_NAMES[c];
    return {
      html: `<div class="ttip-head">600-cell vertex #${i}</div>
        <div>class <b>${c}</b> · ${label}</div>
        <div>subgroup size: <b>${size}</b></div>
        <div class="ttip-coords">(${v.map(x => x.toFixed(2)).join(', ')})</div>`
    };
  });

  // Save state for update()
  group.userData.edges = edges;
  group.userData.verts4 = verts4;
  group.userData.R = R;
  group.userData.edgeLines = edgeLines;
  group.userData.vPoints = vPoints;
  // Expose material so update() can set FX uniforms
  group.userData.materials = [vMat];
  group.userData.trailGeo = vGeo;

  let angleXY = 0, angleZW = 0;

  return {
    group,
    object3d: group,
    name: 'sixhundred',

    update(dt, time, params) {
      // Model rotation is independent from camera and 4D-polytope animation.
      const rs = params.autoRotate ? params.rotationSpeed : 0;
      angleXY += dt * rs * 1.0;
      angleZW += dt * rs * 0.8;

      const rXY = rot4Plane(0, 1, angleXY);
      const rZW = rot4Plane(2, 3, angleZW);
      const M = mul4(rXY, rZW);

      // The shared Extrude control joins the existing 4D perspective depth.
      const wOffset = (params.morph4d || 0) + (params.e8MorphT || 0) * 1.25;

      // Update edges
      const ePos = edgeLines.geometry.attributes.position.array;
      const edgesArr = group.userData.edges;
      const verts4Arr = group.userData.verts4;
      for (let i = 0; i < edgesArr.length; i++) {
        const [a, b] = edgesArr[i];
        const va = apply4(M, verts4Arr[a]);
        const vb = apply4(M, verts4Arr[b]);
        const pa = project4to3(va, wOffset);
        const pb = project4to3(vb, wOffset);
        ePos[i*6]     = pa[0] * R;
        ePos[i*6 + 1] = pa[1] * R;
        ePos[i*6 + 2] = pa[2] * R;
        ePos[i*6 + 3] = pb[0] * R;
        ePos[i*6 + 4] = pb[1] * R;
        ePos[i*6 + 5] = pb[2] * R;
      }
      edgeLines.geometry.attributes.position.needsUpdate = true;

      // Update vertex positions (colors stay fixed — class identity doesn't rotate)
      const vPos = vPoints.geometry.attributes.position.array;
      for (let i = 0; i < verts4Arr.length; i++) {
        const v4 = apply4(M, verts4Arr[i]);
        const p3 = project4to3(v4, wOffset);
        vPos[i*3]     = p3[0] * R;
        vPos[i*3 + 1] = p3[1] * R;
        vPos[i*3 + 2] = p3[2] * R;
      }
      vPoints.geometry.attributes.position.needsUpdate = true;

      // Shape-aware highlight: icosahedron and dodecahedron highlight class-1
      // vertices (the 12 nearest neighbors of identity = the icosahedron subset
      // sitting inside the 600-cell). Cube/octa/tetra highlight different subsets
      // (using class 0+8 = identity vertices as the tetrahedron subset, etc.)
      const shared = runtimeParams();
      const shapeName = shared.shape || 'icosahedron';
      let targetClasses = [];
      if (shapeName === 'icosahedron' || shapeName === 'dodecahedron') {
        targetClasses = [1];  // 12 vertices = regular icosahedron
      } else if (shapeName === 'tetrahedron') {
        targetClasses = [0, 4, 8];  // identity + antipode + 180° (6 verts total)
      } else if (shapeName === 'cube' || shapeName === 'octahedron') {
        targetClasses = [0, 2, 6, 8];  // identity + 120° + 240° + antipode
      }
      // Manual conjugacy-class override: if user picked one in the panel, highlight just that class
      if (shared.sixhundredClass != null) {
        const manualCls = shared.sixhundredClass;
        targetClasses = (manualCls >= 0 && manualCls < 9) ? [manualCls] : [];
      }
      let needsUpdate = false;
      for (let i = 0; i < verts4Arr.length; i++) {
        const want = targetClasses.includes(classes[i]) ? 1.0 : 0.0;
        if (vHighlight[i] !== want) { vHighlight[i] = want; needsUpdate = true; }
        // Slight per-vertex phase variation so the pulse is staggered
        const desiredVsize = 0.8 + 0.4 * Math.sin(i * 0.31);
        if (Math.abs(vSizes[i] - desiredVsize) > 0.001) { vSizes[i] = desiredVsize; needsUpdate = true; }
      }
      if (needsUpdate) {
        vPoints.geometry.attributes.highlight.needsUpdate = true;
        vPoints.geometry.attributes.vsize.needsUpdate = true;
      }

      // Update shader time + FX uniforms
      vMat.uniforms.uTime.value = time;
      // Use canonical 11-mode FX map (was hardcoded 6-mode map)
      vMat.uniforms.uFXMode.value = FX_MODE_MAP[params.fxMode] ?? 0;
      vMat.uniforms.uFXIntensity.value = params.fxIntensity ?? 0.5;
      // FX trail: decay color intensities each frame
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
