// bloom.view.js — The "formula" view: continuous morph from a Platonic solid
// through a 600-cell slice to the E8 root system in the Coxeter plane.
//
// Timeline (t ∈ [0, 1]):
//   t = 0.00  — icosahedron (12 vertices, golden rectangles)
//   t = 0.10  — first 12 vertices of 600-cell (an icosahedron)
//   t = 0.25  — through 600-cell slice: 12 + 20 + 12 = 44 vertices visible
//   t = 0.50  — full 600-cell (120 verts)
//   t = 0.75  — app-designed second H₄-like layer fills all 240 slots
//   t = 1.00  — projected to 2D Coxeter plane
//
// The viewer sees a single morphing structure grow and then unfold into 2D.

import * as THREE from 'three';
import { colorAt } from '../ui/palettes.js';
import { FX_MODE_MAP } from '../fx/fx-shader.js';
import { VERTEX_FX_BRANCHES, FRAGMENT_FX_BRANCHES } from '../fx/fx-branches.js';
import { VERTEX_MANDELBOX_FN, MANDELBOX_DEFAULTS } from '../fx/mandelbox.js';
import { LineFXMaterial } from '../fx/fx-line-shader.js';

export function createBloomView({ data, palette, scale: baseScale, context = {} }) {
  // Track the active palette live so the shift cycle can recolour this view
  // WITHOUT a full rebuild (the per-frame color loop reads `activePalette`).
  // Without this, palette shifts would rebuild the whole bloom every change.
  let activePalette = palette;
  const group = new THREE.Group();
  group.name = 'Bloom';
  const runtimeParams = () => context.params || (typeof window !== 'undefined' ? window.__app?.params : null) || {};

  const R = baseScale;
  const verts8d = data.e8.roots8d;
  const proj2d = data.e8.proj2d;
  const cell600 = data.polytopes4d['600cell'];
  const verts4_600 = cell600.verts;
  const classes = cell600.conjugacy_classes;

  // Get current shape's vertex count.
  // Round 10 fix: stellations (Kepler–Poinsot star polyhedra added in Round 9)
  // are NOT in data.platonic, so a stellation as the active shape would make
  // srcShape undefined and crash at .verts. They're also not meaningful bloom
  // sources (they're not in the McKay → 600-cell → E8 chain), so fall back to
  // the icosahedron — the canonical bloom source — for any non-convex shape.
  const bloomShapeName = (name) => data.platonic[name] ? name : 'icosahedron';
  const shapeName = bloomShapeName(runtimeParams().shape || 'icosahedron');
  const srcShape = data.platonic[shapeName];
  const sourceVerts = srcShape.verts;

  // State: per-slot 3D positions for up to 240 points, opacity, etc.
  // We'll create 240 slots; the first 12 come from the icosahedron initially,
  // the next 108 grow in from the 600-cell slice as t increases,
  // and the next 120 come from an app-designed second H₄-like visual layer.
  const N = 240;
  const positions = new Float32Array(N * 3);
  const colors = new Float32Array(N * 3);
  const opacities = new Float32Array(N);
  const sizes = new Float32Array(N);
  const visible = new Uint8Array(N);  // 0 = hidden, 1 = visible

  // Edge connectivity: tracks from source-shape vertices to their 600-cell destinations.
  // As t advances, these lines visualize the correspondence.
  // Two sets of edges:
  //   - "shape edges" (0..nSrc-1 → first nSrc of order600)
  //   - "600-cell edges" (subset of 600-cell's 720 edges, drawn faintly)
  const edgesGeo = new THREE.BufferGeometry();
  const edgePositions = new Float32Array(N * 12);  // up to N edge segments, 6 floats each
  edgesGeo.setAttribute('position', new THREE.BufferAttribute(edgePositions, 3));
  edgesGeo.setDrawRange(0, 0);
  const edgesMat = new LineFXMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.18,
    depthWrite: false,
  });
  const edgeLines = new THREE.LineSegments(edgesGeo, edgesMat);
  group.add(edgeLines);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  // setDrawRange controls how many vertices are drawn
  geo.setDrawRange(0, 0);

  // Custom shader for soft round additive points (Bloom aesthetic)
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: window.devicePixelRatio || 1 },
      uSize: { value: 18 * baseScale },  // base pixel size
      uOpacity: { value: 0.95 },
      uTime: { value: 0 },
      uFXMode: { value: 0 },
      uFXIntensity: { value: 0.5 },
      // Mandelbox fold uniforms (used by VERTEX_MANDELBOX_FN injected below).
      // Driven by params.bloomMandelbox* via the bloomMandelbox action set
      // and the per-frame uniform pump at the bottom of update().
      uMandelboxEnable: { value: 0 },
      uMandelboxScale:  { value: MANDELBOX_DEFAULTS.scale },
      uMandelboxIters:  { value: MANDELBOX_DEFAULTS.iters },
      uMandelboxMix:    { value: MANDELBOX_DEFAULTS.mix },
    },
    vertexShader: `
      attribute vec3 color;
      varying vec3 vColor;
        varying vec3 vWorldPos;
      uniform float uPixelRatio;
      uniform float uSize;
      uniform int uFXMode;
      uniform float uFXIntensity;
        uniform float uTime;
      // Mandelbox fold uniforms (declared here so VERTEX_MANDELBOX_FN can read them)
      uniform float uMandelboxEnable;
      uniform float uMandelboxScale;
      uniform float uMandelboxIters;
      uniform float uMandelboxMix;
      ${VERTEX_MANDELBOX_FN}
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
        // Apply mandelbox fold to the FX-displaced position, then mix with original
        vec3 foldedPos = mandelboxFold(position + fxO);
        vec3 fxPos = mix(position + fxO, foldedPos, uMandelboxMix);
        vec4 mv = modelViewMatrix * vec4(fxPos, 1.0);
        gl_PointSize = uSize * scale * fxS * uPixelRatio;
        gl_Position = projectionMatrix * mv;
        vWorldPos = (modelMatrix * vec4(fxPos, 1.0)).xyz;
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
        float a = smoothstep(0.5, 0.2, d);
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
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  group.add(points);

  // Reuse colors in the per-frame 240-point recolor loop. Constructing fresh
  // THREE.Color instances here used to create tens of thousands of short-lived
  // objects per second while Bloom was animating.
  const frameColor = new THREE.Color();
  const twinCoolColor = new THREE.Color(0x6affe8);
  const twinWarmColor = new THREE.Color(0xf4d27a);

  // Save state
  let lastShape = shapeName;
  let lastT = -1;

  // 4D rotation for 600-cell phase
  let angleXY = 0, angleZW = 0;
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

  // Color helper — lerp between two palette stops (uses the live palette)
  function colorLerp(t, fromName, toName) {
    const a = new THREE.Color(colorAt(activePalette, fromName));
    const b = new THREE.Color(colorAt(activePalette, toName));
    return a.lerp(b, t);
  }

  function rebuildShape() {
    // Reset positions for the first N=12 source-shape vertices
    // (other slots will be set during update)
    for (let i = 0; i < N; i++) {
      positions[i*3]     = 0;
      positions[i*3 + 1] = 0;
      positions[i*3 + 2] = 0;
      visible[i] = 0;
    }
  }
  rebuildShape();

  return {
    group,
    object3d: group,
    name: 'bloom',

    update(dt, time, params) {
      const t = Math.max(0, Math.min(1, params.bloomAmount));

      // Auto-advance if enabled
      if (params.bloomAuto) {
        params.bloomAmount += dt * params.bloomSpeed;
        if (params.bloomAmount > 1) params.bloomAmount -= 1;
        if (context.setParam) context.setParam('bloomAmount', params.bloomAmount, { refresh: false, save: false, overlay: true });
      }

      const curShapeRaw = runtimeParams().shape || 'icosahedron';
      // Same stellation guard as construction (Round 10): Bloom only morphs
      // convex Platonic sources; non-convex shapes fall back to icosahedron.
      const curShape = data.platonic[curShapeRaw] ? curShapeRaw : 'icosahedron';
      if (curShape !== lastShape) {
        lastShape = curShape;
        rebuildShape();
      }

      const srcVerts = data.platonic[lastShape].verts;
      const nSrc = srcVerts.length;

      // Phase 1 (t ∈ [0, 0.10]): pure source shape
      // Phase 2 (t ∈ [0.10, 0.50]): grow 600-cell vertices in
      //   order: first 12 (icosa class 72°) then next 20 (dodeca class 120°)
      //   then 12 (icosa 144°) then 30 (icosidodeca 180°) then 12+20+12+1 (rest)
      // Phase 3 (t ∈ [0.50, 0.75]): second 600-cell grows at +φ offset
      //   = the 240 vertices of E8 in 4D H₄+H₄·φ slice
      // Phase 4 (t ∈ [0.75, 1.00]): collapse to 2D Coxeter projection
      //   (x,y from proj2d[i], z=0)

      const order600 = []; // ordered by conjugacy class distance from identity
      // class 0 (identity) → 1 vert
      // class 1 (72°) → 12
      // class 2 (120°) → 20
      // class 3 (144°) → 12
      // class 4 (180°) → 30
      // class 5 (216°) → 12
      // class 6 (240°) → 20
      // class 7 (288°) → 12
      // class 8 (360°) → 1
      // We'll add them in this canonical order (so the slice "grows outward")
      // so the morph visibly passes through icosa → dodeca → icosa → icosidodeca → ...
      // Indexed by 600-cell vertex index
      if (order600.length === 0) {
        const byClass = [[], [], [], [], [], [], [], [], []];
        for (let i = 0; i < verts4_600.length; i++) {
          byClass[classes[i]].push(i);
        }
        order600.push(...byClass[0]);
        order600.push(...byClass[1]);
        order600.push(...byClass[2]);
        order600.push(...byClass[3]);
        order600.push(...byClass[4]);
        order600.push(...byClass[5]);
        order600.push(...byClass[6]);
        order600.push(...byClass[7]);
        order600.push(...byClass[8]);
      }

      // Clear slots
      for (let i = 0; i < N; i++) {
        positions[i*3]     = 0;
        positions[i*3 + 1] = 0;
        positions[i*3 + 2] = 0;
        sizes[i] = 0;
        visible[i] = 0;
      }

      // Phase 1 + 2: morph source verts to first 600-cell verts
      // Source has nSrc verts (4–20). We map them to the first nSrc of order600.
      // As t goes 0 → 0.5, morph from src to 600-cell.
      const phaseMorph = Math.min(1, t / 0.5);
      for (let i = 0; i < nSrc; i++) {
        const src = srcVerts[i];
        const dst4 = verts4_600[order600[i] || 0];
        // Lerp in 3D (project dst4 to 3D)
        const dst3 = [dst4[0] * R, dst4[1] * R, dst4[2] * R];
        positions[i*3]     = src[0] * R * (1 - phaseMorph) + dst3[0] * phaseMorph;
        positions[i*3 + 1] = src[1] * R * (1 - phaseMorph) + dst3[1] * phaseMorph;
        positions[i*3 + 2] = src[2] * R * (1 - phaseMorph) + dst3[2] * phaseMorph;
        sizes[i] = 0.08;
        visible[i] = 1;
      }

      // Source-shape edges: render the source solid's wireframe during phase 1
      // (fades out as t→0.5 since the morphing positions no longer correspond to the shape)
      let sourceEdgeCount = 0;
      if (phaseMorph < 0.95) {
        const shapeEdges = srcShape.edges;
        // Fade edges from full visibility at t=0 to invisible by t≈0.5
        const edgeFade = Math.max(0, 1 - phaseMorph * 1.2);
        for (const [a, b] of shapeEdges) {
          const ax = positions[a*3],     ay = positions[a*3+1], az = positions[a*3+2];
          const bx = positions[b*3],     by = positions[b*3+1], bz = positions[b*3+2];
          if (!isFinite(ax) || !isFinite(bx)) continue;
          const off = sourceEdgeCount * 6;
          if (off + 6 > edgePositions.length) break;
          edgePositions[off]     = ax; edgePositions[off+1] = ay; edgePositions[off+2] = az;
          edgePositions[off+3]   = bx; edgePositions[off+4] = by; edgePositions[off+5] = bz;
          sourceEdgeCount++;
        }
        edgesMat.opacity = 0.35 * edgeFade;
      }
      // Reveal more 600-cell verts from t=0.10 onward
      // up to all 120 by t=0.50
      const phaseGrow = Math.max(0, Math.min(1, (t - 0.10) / 0.40));
      const n600ToShow = Math.floor(120 * phaseGrow);
      for (let i = nSrc; i < n600ToShow && i < 120; i++) {
        const v4 = verts4_600[order600[i] || 0];
        positions[i*3]     = v4[0] * R;
        positions[i*3 + 1] = v4[1] * R;
        positions[i*3 + 2] = v4[2] * R;
        sizes[i] = 0.06;
        visible[i] = 1;
      }

      // Phase 3: add second 600-cell copy, rotated 90° about X axis from the first
      // (approximates the two-concentric-600-cells structure of the 4_21 polytope)
      // from t=0.50 to 0.75
      const phase2nd = Math.max(0, Math.min(1, (t - 0.50) / 0.25));
      const PHI = (1 + Math.sqrt(5)) / 2;
      const COS_A = Math.cos(Math.PI / 2 * phase2nd);  // 0 → 1
      const SIN_A = Math.sin(Math.PI / 2 * phase2nd);  // 0 → 1
      if (phase2nd > 0) {
        for (let i = 0; i < 120; i++) {
          const v4 = verts4_600[i];
          // Rotate about X axis by phase2nd*90°: (y,z) → (y·c - z·s, y·s + z·c)
          const x = v4[0] * R;
          const y = v4[1] * R * COS_A - v4[2] * R * SIN_A;
          const z = v4[1] * R * SIN_A + v4[2] * R * COS_A;
          // Slowly offset along y too — gives a sense of the two cells
          // being on parallel hyperplanes that come together
          const yShift = -PHI * 0.25 * R * phase2nd;
          positions[(120 + i)*3]     = x;
          positions[(120 + i)*3 + 1] = y + yShift;
          positions[(120 + i)*3 + 2] = z;
          sizes[120 + i] = 0.06;
          visible[120 + i] = 1;
        }
      }

      // Phase 4: project to Coxeter plane (t ∈ [0.75, 1.00])
      // At t=1.0, all 240 slots show proj2d[i] (x, y, z=0)
      // We blend from the 600-cell position to the 2D projection
      const phase2D = Math.max(0, Math.min(1, (t - 0.75) / 0.25));
      if (phase2D > 0) {
        for (let i = 0; i < 240; i++) {
          if (visible[i] === 0 && i < 120) {
            // Not yet revealed in 600-cell phase — skip
            continue;
          }
          // Current position from earlier phases is in positions[i*3..]
          const curX = positions[i*3];
          const curY = positions[i*3 + 1];
          const curZ = positions[i*3 + 2];

          // Target: Coxeter plane (x, y) scaled
          const p2 = proj2d[i];
          const tgtX = p2.x * R * 1.4;
          const tgtY = p2.y * R * 1.4;
          const tgtZ = 0;

          positions[i*3]     = curX * (1 - phase2D) + tgtX * phase2D;
          positions[i*3 + 1] = curY * (1 - phase2D) + tgtY * phase2D;
          positions[i*3 + 2] = curZ * (1 - phase2D) + tgtZ * phase2D;
          sizes[i] = 0.05 + 0.03 * phase2D;
        }
      }

      // Shared Extrude control: pull the evolving point field into layered
      // depth. Positions are regenerated each frame, so this is stable under
      // both the Bloom timeline and the Extrude auto oscillator.
      const extrude = Math.max(0, Math.min(1, params.e8MorphT ?? 0));
      if (extrude > 0) {
        for (let i = 0; i < N; i++) {
          if (!visible[i]) continue;
          const x = positions[i * 3];
          const y = positions[i * 3 + 1];
          const phase = Math.atan2(y, x) * 3 + i * 0.17;
          positions[i * 3 + 2] += Math.sin(phase) * extrude * 0.62;
        }
      }

      // Colors: blend palette across the bloom
      // First nSrc verts are warm, next batch cooler, last 120 coolest
      for (let i = 0; i < N; i++) {
        if (visible[i] === 0) {
          colors[i*3] = 0; colors[i*3+1] = 0; colors[i*3+2] = 0;
          continue;
        }
        let paletteT = i / N;
        if (params.h4TwinReveal) {
          const ringPulse = 0.08 * Math.sin(time * 1.7 + i * 0.13);
          paletteT = i < 120 ? 0.16 + ringPulse : 0.78 - ringPulse;
        }
        const c = frameColor.set(colorAt(activePalette, Math.max(0, Math.min(1, paletteT)), params.blendMode || 'spectrum'));
        if (params.h4TwinReveal && i >= 120) {
          c.lerp(twinCoolColor, 0.28 + phase2nd * 0.22);
        } else if (params.h4TwinReveal) {
          c.lerp(twinWarmColor, 0.18);
        }
        colors[i*3]     = c.r;
        colors[i*3 + 1] = c.g;
        colors[i*3 + 2] = c.b;
      }

      // Mark buffers dirty
      geo.attributes.position.needsUpdate = true;
      geo.attributes.color.needsUpdate = true;

      // Find highest visible index + 1 = draw range
      let maxVisible = 0;
      for (let i = N - 1; i >= 0; i--) {
        if (visible[i]) { maxVisible = i + 1; break; }
      }
      geo.setDrawRange(0, maxVisible);

      // Update edge geometry: source-shape edges (phase 1) + McKay-correspondence trails
      let edgeCount = sourceEdgeCount;  // start where source edges left off
      const drawShapeEdges = phaseMorph > 0.01 && phaseMorph < 0.99;
      if (drawShapeEdges) {
        for (let i = 0; i < Math.min(nSrc, 12); i++) {
          const a = positions[i*3],     aY = positions[i*3+1], aZ = positions[i*3+2];
          const b = positions[(120+i)*3], bY = positions[(120+i)*3+1], bZ = positions[(120+i)*3+2];
          if (!isFinite(a) || !isFinite(b)) continue;
          const off = edgeCount * 6;
          if (off + 6 > edgePositions.length) break;
          edgePositions[off]     = a;  edgePositions[off+1] = aY; edgePositions[off+2] = aZ;
          edgePositions[off+3]   = b;  edgePositions[off+4] = bY; edgePositions[off+5] = bZ;
          edgeCount++;
        }
      }
      edgesGeo.setDrawRange(0, edgeCount);
      edgesGeo.attributes.position.needsUpdate = true;
      // Edge opacity = source edges fade (phase 1) + McKay trails fade (peak in middle).
      // Bug found 2026-06-24: previous code used Math.max(edgesMat.opacity, trailOpacity)
      // which only ever grew — cycling bloomAmount 0→1→0 left edges permanently opaque.
      const edgeFade = Math.max(0, 1 - phaseMorph * 1.2);
      const sourceEdgeOpacity = 0.35 * edgeFade;
      const trailOpacity = 0.22 * Math.sin(phaseMorph * Math.PI);
      edgesMat.opacity = Math.max(sourceEdgeOpacity, trailOpacity);

      // FX uniform updates + trail decay
      // Use the canonical 11-mode map from fx-shader.js (previously was a
      // 6-mode local map that silently broke when panel exposed more modes).
      group.userData.materials = [mat];
      group.userData.trailGeo = geo;
      if (group.userData.materials) {
        for (const m of group.userData.materials) {
          if (m.uniforms) {
            if (m.uniforms.uFXMode) m.uniforms.uFXMode.value = FX_MODE_MAP[params.fxMode] ?? 0;
            if (m.uniforms.uFXIntensity) m.uniforms.uFXIntensity.value = params.fxIntensity ?? 0.5;
            if (m.uniforms.uTime) m.uniforms.uTime.value = time;
            // Mandelbox fold uniforms — Bloom-only feature.
            if (m.uniforms.uMandelboxEnable) m.uniforms.uMandelboxEnable.value = params.bloomMandelbox ? 1 : 0;
            if (m.uniforms.uMandelboxScale)  m.uniforms.uMandelboxScale.value  = params.bloomMandelboxScale ?? MANDELBOX_DEFAULTS.scale;
            if (m.uniforms.uMandelboxIters)  m.uniforms.uMandelboxIters.value  = Math.max(1, Math.min(12, Math.round(params.bloomMandelboxIters ?? MANDELBOX_DEFAULTS.iters)));
            if (m.uniforms.uMandelboxMix)    m.uniforms.uMandelboxMix.value    = params.bloomMandelboxMix ?? MANDELBOX_DEFAULTS.mix;
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
      geo.dispose();
      mat.dispose();
      edgesGeo.dispose();
      edgesMat.dispose();
    },

    // Live palette change: just update the tracked palette name — the per-frame
    // color loop picks it up next frame, so no geometry rebuild needed.
    onPaletteChange(newPalette) { activePalette = newPalette; },
  };
}
