// e8coxeter.view.js — E8 root system with interactive 3D exploration
//
// Renders the 240 E8 roots in R^8, projected to 3D via a user-controlled plane.
// Default is the canonical Coxeter plane (2D). User can:
//   - Switch to a 3D orthographic projection (first 3 axes of R^8)
//   - Rotate the 8D projection plane around its 4th axis ("spin")
//   - Rotate around multiple axes simultaneously
//   - Toggle McMullen chord-length edges
//   - Adjust point sizes, opacity, animation speed
//
// This is the "playground" view — the most interactive one.

import * as THREE from 'three';
import { colorAt, e8ColoringT } from '../ui/palettes.js';
import { reflect as weylReflect, dot8 } from '../math/weyl.js';
import { VERTEX_FX_BRANCHES, FRAGMENT_FX_BRANCHES } from '../fx/fx-branches.js';
import { FX_MODE_MAP } from '../fx/fx-shader.js';
import { LineFXMaterial } from '../fx/fx-line-shader.js';

const PHI = (1 + Math.sqrt(5)) / 2;

// The 8 distinct chord lengths of the 600-cell chord diagram
const CHORD_VALUES = [
  Math.sqrt(2 - PHI), 1, Math.sqrt(3 - PHI), Math.sqrt(2),
  PHI, Math.sqrt(3), Math.sqrt(2 + PHI), 2,
];

const PLATONIC_VERTEX_COUNTS = {
  tetrahedron: 4, cube: 8, octahedron: 6,
  dodecahedron: 20, icosahedron: 12,
};

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

// Build an 8x8 orthonormal basis by Gram-Schmidt from any list of 8 R^8 vectors
function gramSchmidt8(vectors) {
  const basis = [];
  for (const v of vectors) {
    let u = v.slice();
    for (const b of basis) {
      const dot = u.reduce((s, x, i) => s + x * b[i], 0);
      for (let i = 0; i < 8; i++) u[i] -= dot * b[i];
    }
    const len = Math.hypot(...u);
    if (len > 1e-9) basis.push(u.map(x => x / len));
  }
  return basis;
}

export function createE8CoxeterView({ data, palette, scale: baseScale, context = {} }) {
  const group = new THREE.Group();
  group.name = 'E8Coxeter';

  // Resolve E8 data
  const e8data = data.e8 || data;
  const proj = e8data.proj2d;          // precomputed 2D Coxeter projection (default)
  const ringRadii = e8data.ring_radii;
  const ringCounts = e8data.ring_counts;
  const roots8d = e8data.roots8d;
  const maxR = Math.max(...ringRadii);
  const coxBasis = e8data.coxeter_basis;  // { re: [8 floats], im: [8 floats] }

  // --- View state (shared with main.js via params) ---
  // We extend params via custom keys; defaults if absent
  const getParam = (key, def) => {
    const shared = context.params;
    return shared && shared[key] !== undefined ? shared[key] : def;
  };
  // Map ring index → palette color. Refactored to a function so the
  // colors can be re-computed when the palette changes (without a
  // full view rebuild). The colors go through HSL boost for visibility
  // and per-ring hue variation so the eight rings are visually distinct
  // even on "warm" palettes like gold.
  //
  // IMPORTANT: We use a FIXED per-ring hue offset (rainbow spread) instead
  // of the palette's hue, so the eight rings are always visually distinct
  // (red→orange→yellow→green→cyan→blue→magenta as you move outward). The
  // palette's blendMode modulates the saturation/lightness.
  function computeRingColors(palName) {
    // Spread the eight rings across distinct hue stops.
    const ringHues = ringRadii.map((_, i) => (i / ringRadii.length) * 0.95);
    return ringHues.map((h, i) => {
      const c = new THREE.Color();
      // Get palette saturation/lightness at this ring position
      const t = i / Math.max(1, ringRadii.length - 1);
      const palColor = new THREE.Color(colorAt(palName, t, 'spectrum'));
      const palHsl = {};
      palColor.getHSL(palHsl);
      // Use rainbow hue but palette's saturation/lightness
      const sat = Math.max(0.5, Math.min(1, palHsl.s * 1.1));
      const lit = Math.max(0.5, Math.min(0.78, palHsl.l * 1.3 + 0.15));
      c.setHSL(h, sat, lit);
      return c;
    });
  }
  let ringColors = computeRingColors(palette);

  // Apply a per-ring size + intensity scale. Outer rings = slightly larger
  // and slightly brighter so the structure has a clear depth gradient
  // (inner rings cluster, outer rings are spread out, big and visible).
  function computeRingSizeBoost() {
    const boost = [];
    for (let i = 0; i < ringRadii.length; i++) {
      const t = i / Math.max(1, ringRadii.length - 1);
      // Outer rings (t→1) get larger boost, inner (t→0) get less
      boost.push(1.0 + t * 0.4);
    }
    return boost;
  }
  const ringSizeBoost = computeRingSizeBoost();

  // --- Points geometry (240 dots) ---
  const pointsGeo = new THREE.BufferGeometry();
  const positions = new Float32Array(proj.length * 3);
  const colors = new Float32Array(proj.length * 3);
  const sizes = new Float32Array(proj.length);
  // Stored for extrusion morph (2D ↔ 3D)
  const initialX = new Float32Array(proj.length);
  const initialY = new Float32Array(proj.length);
  const initialZ = new Float32Array(proj.length);
  const highlights = new Float32Array(proj.length);
  const rootDistances = new Float32Array(proj.length);
  const projectionBasePositions = new Float32Array(proj.length * 3);
  rootDistances.fill(99);

  // baseScale: world-space radius for the largest ring in the default Coxeter view
  const scaleK = baseScale / maxR;

  for (let i = 0; i < proj.length; i++) {
    const p = proj[i];
    positions[i*3]     = p.x * scaleK;
    positions[i*3 + 1] = p.y * scaleK;
    positions[i*3 + 2] = 0;
    const c = ringColors[p.ring];
    colors[i*3]     = c.r;
    colors[i*3 + 1] = c.g;
    colors[i*3 + 2] = c.b;
    sizes[i] = (1 - p.r / maxR) * 10 + 5;  // 5..15 pixels — visible against black bg
    // Store original 2D coords for morph
    initialX[i] = p.x * baseScale;
    initialY[i] = p.y * baseScale;
    // Compute a "natural 3D" position: extrude along z by depth proportional to ring
    // Inner rings closer to z=0, outer rings further out
    const depth = p.r / maxR;  // 0..1
    initialZ[i] = depth * baseScale * 0.6;  // max extrusion ~60% of baseScale
  }

  pointsGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  pointsGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  pointsGeo.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
  pointsGeo.setAttribute('highlight', new THREE.BufferAttribute(highlights, 1));
  pointsGeo.setAttribute('rootDistance', new THREE.BufferAttribute(rootDistances, 1));
  projectionBasePositions.set(positions);

  function captureProjectionBase() {
    projectionBasePositions.set(pointsGeo.attributes.position.array);
  }

  // Map root i to a palette position t∈[0,1] from the chosen MATHEMATICAL
  // invariant (see COLORINGS in palettes.js). Delegates to the shared e8ColoringT
  // so the live view and the SVG export colour identically.
  const coloringT = (i, mode) =>
    e8ColoringT(mode, proj[i], roots8d[i], i, proj.length, ringRadii.length, maxR);

  let activePalette = palette;
  let lastTwin600 = null;
  let lastColorBy = null;
  function applyPointColors(palName, colorBy = 'shell', twin600 = false) {
    activePalette = palName;
    const cAttr = pointsGeo.attributes.color;
    for (let i = 0; i < proj.length; i++) {
      // twin600 overlays the two interlaced 600-cell halves; otherwise colour by
      // the selected structural invariant.
      const t = twin600
        ? (i < 120 ? 0.2 : 0.8)
        : coloringT(i, colorBy);
      const col = new THREE.Color(colorAt(palName, t));
      cAttr.array[i*3] = col.r;
      cAttr.array[i*3 + 1] = col.g;
      cAttr.array[i*3 + 2] = col.b;
    }
    cAttr.needsUpdate = true;
  }

  // Shader material: per-point size, time-based pulse on highlighted points
  // Plus FX mode uniforms for visual effects
  const pointsMat = new THREE.ShaderMaterial({
    uniforms: {
      uPixelRatio: { value: window.devicePixelRatio || 1 },
      uOpacity: { value: 0.95 },
      uTime: { value: 0 },
      uFXMode: { value: 0 },     // 0=none, 1=glow, 2=trail, 3=kaleidoscope, 4=ripple, 5=spiral
      uFXIntensity: { value: 0.5 },
      uRootDiffusion: { value: 0 },
      uDiffusionTime: { value: 0 },
    },
    vertexShader: `
      attribute float size;
      attribute float highlight;
      attribute float rootDistance;
      varying vec3 vColor;
      varying float vHighlight;
      varying float vRootDistance;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec4 vClipPos;  // clip-space position passed to fragment for fog/edge-glow
      uniform float uPixelRatio;
      uniform float uTime;
      uniform int uFXMode;
      uniform float uFXIntensity;
      uniform float uRootDiffusion;
      uniform float uDiffusionTime;
      void main() {
        vColor = color;
        vHighlight = highlight;
        vRootDistance = rootDistance;
        vUv = position.xy;
        float wave = 0.0;
        if (uRootDiffusion > 0.5 && rootDistance < 8.5) {
          wave = 1.0 - smoothstep(0.0, 0.75, abs(uDiffusionTime - rootDistance));
        }
        float pulse = 1.0 + 0.25 * highlight * sin(uTime * 3.0) + wave * (1.1 / (1.0 + rootDistance * 0.22));
        // FX: ripple — wave-based size pulse
        float ripple = 1.0;
        if (uFXMode == 4) {
          float r = length(position.xy);
          ripple = 1.0 + uFXIntensity * 0.4 * sin(r * 8.0 - uTime * 4.0);
        }
        // FX: spiral — rotating scaling
        float spiral = 1.0;
        if (uFXMode == 5) {
          float a = atan(position.y, position.x);
          spiral = 1.0 + uFXIntensity * 0.5 * sin(a * 6.0 + uTime * 2.0);
        }
        // FX: pulse — breathing 0.7..1.3
        float pulseFX = 1.0;
        if (uFXMode == 6) {
          float p = sin(uTime * 3.14159) * 0.5 + 0.5;
          pulseFX = 0.7 + 0.6 * p * uFXIntensity + (1.0 - uFXIntensity);
        }
        // FX: edge-glow — pulse near view frustum edges
        float edgeFX = 1.0;
        if (uFXMode == 10) {
          vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          vec2 ndc = clip.xy / max(clip.w, 0.001);
          float edge = max(abs(ndc.x), abs(ndc.y));
          edgeFX = 1.0 + uFXIntensity * 0.6 * smoothstep(0.7, 1.0, edge);
        }
        gl_PointSize = size * pulse * ripple * spiral * pulseFX * edgeFX * uPixelRatio * (1.0 + highlight * 1.5);
        ${VERTEX_FX_BRANCHES}
        // Apply vertex FX scale (caustic/plasma/kaleido6/dof/wireframe)
        gl_PointSize *= fxS;
        // Flowfield position offset (mode 15)
        vec3 fxPos = position + fxO;
        vec4 mv = modelViewMatrix * vec4(fxPos, 1.0);
        gl_Position = projectionMatrix * mv;
        vWorldPos = (modelMatrix * vec4(fxPos, 1.0)).xyz;
        vClipPos = gl_Position;  // pass clip-space pos to fragment for fog/edge
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vHighlight;
      varying float vRootDistance;
      varying vec2 vUv;
      varying vec3 vWorldPos;
      varying vec4 vClipPos;  // clip-space position for fog/edge-glow in fragment
      uniform float uOpacity;
      uniform float uTime;
      uniform int uFXMode;
      uniform float uFXIntensity;
      uniform float uRootDiffusion;
      uniform float uDiffusionTime;
      void main() {
        vec2 c = gl_PointCoord - vec2(0.5);
        float d = length(c);
        if (d > 0.5) discard;
        float a = smoothstep(0.5, 0.25, d);
        float halo = smoothstep(0.5, 0.4, d) * vHighlight * 0.6;
        vec3 col = vColor * (1.0 + halo) + vec3(halo);
        if (uRootDiffusion > 0.5 && vRootDistance < 8.5) {
          float wave = 1.0 - smoothstep(0.0, 0.75, abs(uDiffusionTime - vRootDistance));
          vec3 dcol = vec3(1.0);
          if (vRootDistance < 0.5) dcol = vec3(1.0, 0.95, 0.65);
          else if (vRootDistance < 1.5) dcol = vec3(0.25, 1.0, 0.88);
          else if (vRootDistance < 2.5) dcol = vec3(0.68, 0.42, 1.0);
          else if (vRootDistance < 3.5) dcol = vec3(1.0, 0.45, 0.72);
          else dcol = vec3(0.45, 0.72, 1.0);
          col = mix(col, dcol, clamp(0.2 + wave * 0.85, 0.0, 1.0));
          a *= 1.0 + wave * 0.45;
        }
        // FX: glow — extra outer halo
        if (uFXMode == 1) {
          float g = smoothstep(0.5, 0.1, d) * uFXIntensity * 0.5;
          col += vColor * g * 2.0;
        }
        // FX: kaleidoscope — hue shift based on point index and time
        if (uFXMode == 3) {
          float h = sin(vUv.x * 5.0 + vUv.y * 3.0 + uTime) * uFXIntensity * 0.5;
          col.r *= (1.0 + h);
          col.g *= (1.0 + h * 0.5);
          col.b *= (1.0 - h * 0.5);
        }
        // FX: chromatic — RGB prism split on point edge
        if (uFXMode == 7) {
          float ca = uFXIntensity * 0.5;
          float ang = atan(c.y, c.x);
          col.r += sin(ang * 4.0 + uTime * 2.0) * ca;
          col.g += sin(ang * 4.0 + uTime * 2.0 + 2.094) * ca;
          col.b += sin(ang * 4.0 + uTime * 2.0 + 4.188) * ca;
        }
        // FX: heat — warm center, cool outer
        if (uFXMode == 9) {
          float dist = length(vWorldPos);
          float t = clamp(dist * 0.5, 0.0, 1.0);
          vec3 cool = vec3(0.2, 0.4, 1.0);
          vec3 warm = vec3(1.0, 0.6, 0.1);
          vec3 heat = mix(warm, cool, t);
          col = heat * (0.5 + length(col) * 0.5) * uFXIntensity + col * (1.0 - uFXIntensity);
        }
        // FX: edge-glow — brighten at view edges
        if (uFXMode == 10) {
          vec2 ndc = vClipPos.xy / max(vClipPos.w, 0.001);
          float edge = max(abs(ndc.x), abs(ndc.y));
          col += vec3(1.0, 0.9, 0.6) * smoothstep(0.6, 1.0, edge) * uFXIntensity * 0.8;
        }
        // FX: fog — alpha fade with depth
        if (uFXMode == 8) {
          // camera-relative depth from clip-space z
          float depth = vClipPos.w;  // w is camera-space z distance (positive)
          a *= 1.0 - smoothstep(4.0, 14.0, depth) * uFXIntensity;
        }
        ${FRAGMENT_FX_BRANCHES}
        // Apply vertex FX alpha (voronoi/nebula)
        a *= fxA;
        gl_FragColor = vec4(col, a * uOpacity);
      }
    `,
    vertexColors: true,
    transparent: true,
    depthWrite: false,
  });

  const points = new THREE.Points(pointsGeo, pointsMat);
  group.add(points);

  // Tooltip data
  const roots8dForTip = e8data.roots8d;
  const buildTipData = (highlightSet) => proj.map((p, i) => {
    const r = roots8dForTip[i];
    const rstr = r.map(x => x.toFixed(2)).join(', ');
    const inSubset = highlightSet.has(i);
    return {
      html: `<div class="ttip-head">E8 root #${i}</div>
        <div>ring: <b>${p.ring}</b> · radius: <b>${p.r.toFixed(3)}</b></div>
        <div class="ttip-coords">(${rstr})</div>
        ${inSubset ? '<div style="color:var(--accent);margin-top:4px">★ illustrative source highlight</div>' : ''}`
    };
  });
  points.userData.tooltipData = buildTipData(new Set());

  // --- Ring guides (eight thin circles) ---
  const ringGroup = new THREE.Group();
  ringGroup.name = 'ring-guides';
  for (let i = 0; i < ringRadii.length; i++) {
    const r = ringRadii[i] * scaleK;
    const seg = 128;
    const pts = [];
    for (let s = 0; s <= seg; s++) {
      const a = (s / seg) * Math.PI * 2;
      pts.push(Math.cos(a) * r, Math.sin(a) * r, 0);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const m = new LineFXMaterial({
      color: ringColors[i],
      transparent: true,
      opacity: 0.12,
    });
    ringGroup.add(new THREE.LineLoop(g, m));
  }
  group.add(ringGroup);

  // --- 30-gon outline (Petrie polygon) ---
  const outerR = ringRadii[ringRadii.length - 1] * scaleK * 1.05;
  const triacontagon = [];
  for (let s = 0; s < 30; s++) {
    const a = (s / 30) * Math.PI * 2;
    triacontagon.push(Math.cos(a) * outerR, Math.sin(a) * outerR, 0);
  }
  const tg = new THREE.BufferGeometry();
  tg.setAttribute('position', new THREE.Float32BufferAttribute(triacontagon, 3));
  const tm = new LineFXMaterial({
    color: ringColors[ringColors.length - 1],
    transparent: true,
    opacity: 0.25,
  });
  const triMesh = new THREE.LineLoop(tg, tm);
  group.add(triMesh);

  // --- McMullen chord-length edges (built lazily) ---
  const edgeGroup = new THREE.Group();
  edgeGroup.name = 'edges';
  const roots8dForEdges = e8data.roots8d;

  // Edge topology (which roots connect, grouped by 8 chord-distance classes) is
  // FIXED — it doesn't depend on the projection. Compute the O(240²) pairing ONCE
  // and cache it; reprojections only move the endpoints.
  let chordTopology = null;
  let edgeLines = [];        // the per-chord LineSegments, for in-place updates
  function computeChordTopology() {
    const chordEdges = [[], [], [], [], [], [], [], []];
    for (let i = 0; i < 240; i++) {
      const ri = roots8dForEdges[i];
      for (let j = i + 1; j < 240; j++) {
        const rj = roots8dForEdges[j];
        let d2 = 0;
        for (let k = 0; k < 8; k++) { const d = ri[k] - rj[k]; d2 += d * d; }
        const d = Math.sqrt(d2);
        let bestIdx = 0, bestErr = Math.abs(d - CHORD_VALUES[0]);
        for (let c = 1; c < 8; c++) {
          const err = Math.abs(d - CHORD_VALUES[c]);
          if (err < bestErr) { bestErr = err; bestIdx = c; }
        }
        if (bestErr < 0.05) chordEdges[bestIdx].push(i, j);
      }
    }
    return chordEdges;
  }

  function writeEdgePositions(seg) {
    const pairs = seg.userData.chordPairs;
    const pts = pointsGeo.attributes.position.array;
    const out = seg.geometry.attributes.position.array;
    for (let i = 0; i < pairs.length; i += 2) {
      const a = pairs[i], b = pairs[i + 1];
      out[i*3]     = pts[a*3];     out[i*3 + 1] = pts[a*3 + 1]; out[i*3 + 2] = pts[a*3 + 2];
      out[i*3 + 3] = pts[b*3];     out[i*3 + 4] = pts[b*3 + 1]; out[i*3 + 5] = pts[b*3 + 2];
    }
    seg.geometry.attributes.position.needsUpdate = true;
  }

  function buildEdges() {
    while (edgeGroup.children.length) {
      const c = edgeGroup.children.pop();
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }
    edgeLines = [];
    if (!chordTopology) chordTopology = computeChordTopology();
    for (let c = 0; c < 8; c++) {
      const pairs = chordTopology[c];
      if (pairs.length === 0) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pairs.length * 3), 3));
      // activePalette (the LIVE palette), not the creation-time `palette` — else a
      // per-frame rebuild (spin mode) would stomp onPaletteChange's recolour.
      const mat = new LineFXMaterial({
        color: new THREE.Color(colorAt(activePalette, c / 7)), transparent: true,
        opacity: c === 3 ? 0.45 : c === 7 ? 0.20 : 0.10,
      });
      const seg = new THREE.LineSegments(geo, mat);
      seg.userData.chordPairs = pairs;
      writeEdgePositions(seg);
      edgeGroup.add(seg);
      edgeLines.push(seg);
    }
  }

  // Refresh edge endpoints from the current projection WITHOUT rebuilding
  // geometries/materials — cheap enough to run every frame in spin mode, and it
  // preserves the materials so palette recolours stick.
  function syncEdgePositions() {
    if (edgeLines.length === 0) { buildEdges(); return; }
    for (const seg of edgeLines) writeEdgePositions(seg);
  }
  buildEdges();
  group.add(edgeGroup);

  // Center dot
  const centerGeo = new THREE.BufferGeometry();
  centerGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0], 3));
  group.add(new THREE.Points(centerGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.01, sizeAttenuation: false })));

  // --- Petrie 30-cycle (real Hamiltonian cycle in E₈ edge graph) ---
  // Built lazily from data.e8_math.petrie_cycle_30 (precomputed). When
  // params.showPetrie is on, this polyline traces a 30-vertex closed cycle
  // where each consecutive pair is connected by an E₈ edge (⟨α,β⟩ = −1).
  let petrieLine = null;
  // Helper: get the shared params object from the runtime context. The
  // window fallback keeps older debug embeds working while the app migrates.
  function sharedParams() {
    return context.params || (window.__app && window.__app.params ? window.__app.params : null);
  }

  function runtimeCamera() {
    return context.camera || window.__app?.camera || null;
  }

  function runtimeRaycaster() {
    return context.raycaster || window.__app?.raycaster || null;
  }

  function refreshAppPanel() {
    const actions = context.actions?.();
    if (actions && typeof actions.refreshPanel === 'function') actions.refreshPanel();
  }

  function rebuildPetrieLine() {
    const sharedP = sharedParams();
    if (petrieLine) {
      group.remove(petrieLine);
      petrieLine.geometry.dispose();
      petrieLine.material.dispose();
      petrieLine = null;
    }
    if (!sharedP || !sharedP.showPetrie) return;
    const cycle = data.e8_math && data.e8_math.petrie_cycle_30;
    if (!cycle || cycle.length < 2) return;
    // Use live 2D positions, plus the closing edge back to start
    const n = cycle.length;
    const pts = new Float32Array((n + 1) * 3);
    for (let i = 0; i < n; i++) {
      const idx = cycle[i];
      pts[i*3]     = positions[idx*3];
      pts[i*3 + 1] = positions[idx*3 + 1];
      pts[i*3 + 2] = positions[idx*3 + 2] + 0.005;  // sit slightly in front of points
    }
    // Close the cycle
    pts[n*3]     = pts[0];
    pts[n*3 + 1] = pts[1];
    pts[n*3 + 2] = pts[2];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const m = new LineFXMaterial({
      color: 0xaa66ff, transparent: true, opacity: 0.55,
    });
    petrieLine = new THREE.Line(g, m);
    petrieLine.name = 'petrie-30-cycle';
    group.add(petrieLine);
  }

  // --- Cartan neighbor highlight (8 simple roots, 56 neighbors each) ---
  // When params.cartanHighlight is on AND a simple root is selected via
  // params.cartanSelection[0], light up its 56 Cartan neighbors.
  let cartanHighlightLines = null;
  const simpleRootIndices = (data.e8_math && data.e8_math.simple_root_indices) || [];
  const mirrorGroup = new THREE.Group();
  mirrorGroup.name = 'weyl-mirror-chamber';
  const mirrorMaterials = [];
  function buildMirrorChamber() {
    while (mirrorGroup.children.length) {
      const line = mirrorGroup.children.pop();
      if (line.geometry) line.geometry.dispose();
      if (line.material) line.material.dispose();
    }
    mirrorMaterials.length = 0;
    const len = baseScale * 1.85;
    for (let i = 0; i < simpleRootIndices.length; i++) {
      const idx = simpleRootIndices[i];
      const p = proj[idx];
      if (!p) continue;
      const nx = p.x;
      const ny = p.y;
      const mag = Math.hypot(nx, ny) || 1;
      const dx = -ny / mag;
      const dy = nx / mag;
      const pts = new Float32Array([
        -dx * len, -dy * len, 0.035,
         dx * len,  dy * len, 0.035,
      ]);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
      const m = new LineFXMaterial({
        color: 0x6affe8,
        transparent: true,
        opacity: 0.28,
      });
      const line = new THREE.Line(g, m);
      line.name = `weyl-mirror-${i + 1}`;
      mirrorMaterials.push(m);
      mirrorGroup.add(line);
    }
  }
  buildMirrorChamber();
  mirrorGroup.visible = false;
  group.add(mirrorGroup);

  function rebuildCartanHighlight() {
    const sharedP = sharedParams();
    if (cartanHighlightLines) {
      group.remove(cartanHighlightLines);
      cartanHighlightLines.geometry.dispose();
      cartanHighlightLines.material.dispose();
      cartanHighlightLines = null;
    }
    if (!sharedP || !sharedP.cartanHighlight) return;
    const sel = sharedP.cartanSelection || [];
    if (sel.length === 0) return;
    const simpleIdx = simpleRootIndices[sel[0]];
    if (simpleIdx == null) return;
    const neighbors = (data.e8_math?.cartan_neighbors?.[`alpha${sel[0]+1}`]?.neighbors) || [];
    if (neighbors.length === 0) return;
    const pts = new Float32Array(neighbors.length * 2 * 3);
    const sx = positions[simpleIdx*3], sy = positions[simpleIdx*3+1], sz = positions[simpleIdx*3+2];
    for (let i = 0; i < neighbors.length; i++) {
      const nIdx = neighbors[i];
      pts[i*6]     = sx;
      pts[i*6 + 1] = sy;
      pts[i*6 + 2] = sz + 0.01;
      pts[i*6 + 3] = positions[nIdx*3];
      pts[i*6 + 4] = positions[nIdx*3 + 1];
      pts[i*6 + 5] = positions[nIdx*3 + 2] + 0.01;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const m = new LineFXMaterial({
      color: 0x66ddff, transparent: true, opacity: 0.4,
    });
    cartanHighlightLines = new THREE.LineSegments(g, m);
    cartanHighlightLines.name = 'cartan-highlight';
    group.add(cartanHighlightLines);
    // Also bump up the size of the simple root + its neighbors via a marker
    // — handled in update() via params._cartanHighlight set
    if (sharedP) sharedP._cartanHighlight = { simpleIdx, neighborCount: neighbors.length };
  }

  // Rebuild helpers for both — called on demand.
  // The Petrie 30-cycle is mathematically a 2D (Coxeter-plane) feature; in
  // 3D rotation modes the cycle points get scattered, so we hide it then.
  // Cartan highlight also looks confusing in 3D since 56 lines fan out to
  // rotated positions — restrict it to Coxeter (2D) mode for clarity.
  function maybeRebuildPetrieAndCartan(force = false) {
    const sharedP = sharedParams();
    if (!sharedP) return;
    const is2D = (sharedP.e8ViewMode || 'coxeter') === 'coxeter';
    const wantPetrie = !!sharedP.showPetrie && is2D;
    const wantCartan = !!sharedP.cartanHighlight && (sharedP.cartanSelection || []).length > 0 && is2D;
    if (wantPetrie || force) rebuildPetrieLine();
    if (wantCartan || force) rebuildCartanHighlight();
    if (petrieLine) petrieLine.visible = wantPetrie;
    if (cartanHighlightLines) cartanHighlightLines.visible = wantCartan;
  }

  // --- Picked-root neighbor highlight (idea #46: click → highlight 56) ---
  // When the user clicks a root, this draws 56 cyan lines from it to each
  // of its 56 Cartan-connected neighbors. Each E₈ root has exactly 56
  // neighbors — the magic of the E₈ root system.
  let pickedNeighborLines = null;
  let lastPicked = null;
  let lastPickedForNeighbors = null;
  let lastHovered = null;

  // Precompute the E₈ root adjacency once (it's a constant of the system).
  // Two roots are adjacent iff <α,β> = -1 (since E₈ is simply-laced).
  // For 240 roots this is 28680 pairs; we only need the neighbors of any
  // picked root, so compute lazily per click.
  const adjCache = new Map();  // rootIdx → array of neighbor indices
  function neighborsOf(rootIdx) {
    if (adjCache.has(rootIdx)) return adjCache.get(rootIdx);
    const r = roots8d[rootIdx];
    const nbrs = [];
    for (let j = 0; j < 240; j++) {
      if (j === rootIdx) continue;
      // Inner product of integer roots; ⟨α,β⟩ ∈ {-2,-1,0,1,2,3,4}
      let ip = 0;
      for (let k = 0; k < 8; k++) ip += r[k] * roots8d[j][k];
      if (ip === -1) nbrs.push(j);
    }
    adjCache.set(rootIdx, nbrs);
    return nbrs;
  }

  let lastDistanceRoot = null;
  let lastHaloDepth = -1;
  let diffusionStartedAt = 0;
  function rebuildRootDistances(rootIdx, maxDepth, paramsForCounts) {
    rootDistances.fill(99);
    const counts = {};
    if (rootIdx == null || rootIdx < 0 || rootIdx >= 240) {
      pointsGeo.attributes.rootDistance.needsUpdate = true;
      if (paramsForCounts) paramsForCounts._rootDistanceCounts = {};
      return;
    }
    const queue = [rootIdx];
    rootDistances[rootIdx] = 0;
    counts[0] = 1;
    for (let qi = 0; qi < queue.length; qi++) {
      const cur = queue[qi];
      const d = rootDistances[cur];
      if (d >= maxDepth) continue;
      for (const nbr of neighborsOf(cur)) {
        if (rootDistances[nbr] <= d + 1) continue;
        rootDistances[nbr] = d + 1;
        counts[d + 1] = (counts[d + 1] || 0) + 1;
        queue.push(nbr);
      }
    }
    pointsGeo.attributes.rootDistance.needsUpdate = true;
    if (paramsForCounts) paramsForCounts._rootDistanceCounts = counts;
  }

  function rebuildPickedNeighbors() {
    const sharedP = sharedParams();
    if (pickedNeighborLines) {
      group.remove(pickedNeighborLines);
      pickedNeighborLines.geometry.dispose();
      pickedNeighborLines.material.dispose();
      pickedNeighborLines = null;
    }
    const picked = sharedP?.pickedRoot;
    if (picked == null) return;
    const nbrs = neighborsOf(picked);
    if (nbrs.length === 0) return;
    const pts = new Float32Array(nbrs.length * 2 * 3);
    const sx = positions[picked*3], sy = positions[picked*3+1], sz = positions[picked*3+2];
    for (let i = 0; i < nbrs.length; i++) {
      const nIdx = nbrs[i];
      pts[i*6]     = sx;
      pts[i*6 + 1] = sy;
      pts[i*6 + 2] = sz + 0.015;
      pts[i*6 + 3] = positions[nIdx*3];
      pts[i*6 + 4] = positions[nIdx*3 + 1];
      pts[i*6 + 5] = positions[nIdx*3 + 2] + 0.015;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    const m = new LineFXMaterial({
      color: 0x00ffaa, transparent: true, opacity: 0.6,
    });
    pickedNeighborLines = new THREE.LineSegments(g, m);
    pickedNeighborLines.name = 'picked-neighbors';
    group.add(pickedNeighborLines);
  }

  // --- 3D projection state ---
  // We allow the user to override the default 2D Coxeter projection with a 3D rotation
  // of the entire 8D root cloud. The rotation is applied to the pointsGeo.positions.
  let currentBasis3D = null;     // 3 vectors in R^8 — the basis for projection
  let lastViewMode = 'coxeter';
  let lastSpin = -1;
  let lastTilt = -1;
  let lastRoll = -1;
  let lastMcKayShape = '';
  let lastCompareShape = '';
  let lastCompareMode = '';

  // Compute a 3D orthographic projection basis from 3 angles
  function computeBasis3D(spin, tilt, roll) {
    // Three rotation angles in R^8: spin around e8 axis, tilt, roll.
    // We compose them as 3 separate 2-plane rotations in R^8, applied to fixed axes.
    function rotPlane(i, j, a) {
      const M = Array(64).fill(0);
      for (let k = 0; k < 8; k++) M[k*8 + k] = 1;
      const c = Math.cos(a), s = Math.sin(a);
      M[i*8 + i] = c;  M[i*8 + j] = -s;
      M[j*8 + i] = s;  M[j*8 + j] =  c;
      return M;
    }
    function mul8(a, b) {
      const out = Array(64).fill(0);
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        let s = 0;
        for (let k = 0; k < 8; k++) s += a[r*8+k] * b[k*8+c];
        out[r*8+c] = s;
      }
      return out;
    }
    // Spin: rotation in plane (0, 1) — x/y in R^8
    // Tilt: rotation in plane (2, 3) — z/w in R^8
    // Roll: rotation in plane (4, 5) — u/v in R^8
    const m = mul8(rotPlane(0, 1, spin), mul8(rotPlane(2, 3, tilt), rotPlane(4, 5, roll)));
    // Extract the first 3 rows of m as the projection basis
    return [
      Array.from(m.slice(0, 8)),
      Array.from(m.slice(8, 16)),
      Array.from(m.slice(16, 24)),
    ];
  }

  // Seeded random number generator (mulberry32) — produces reproducible 3D bases
  function mulberry32(seed) {
    return function() {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // Generate a 3D orthographic projection basis by sampling 3 RANDOM unit vectors
  // in R^8 and orthonormalizing them. This gives a true 3D spread of points —
  // unlike PCA on E8 (which has high symmetry and gives degenerate bases).
  function generateRandomBasis(seed) {
    const rand = mulberry32(seed);
    function randVec() {
      // 8 Gaussian-ish samples via Box-Muller
      const v = [];
      for (let i = 0; i < 8; i++) {
        const u1 = Math.max(1e-9, rand()), u2 = rand();
        v.push(Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2));
      }
      return v;
    }
    function norm(v) {
      const len = Math.hypot(...v) || 1;
      return v.map(x => x / len);
    }
    function projectOut(u, v) {
      const dot = u.reduce((s, x, i) => s + x * v[i], 0);
      return u.map((x, i) => x - dot * v[i]);
    }
    // 3 random vectors, then Gram-Schmidt
    const a = norm(randVec());
    const b = norm(projectOut(randVec(), a));
    const c = norm(projectOut(projectOut(randVec(), a), b));
    return [a, b, c];
  }

  function h4Basis() {
    return [
      [1, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 0, 0, 0],
      [0, 0, 1, 0, 0, 0, 0, 0],
    ];
  }

  function petrieBasis() {
    const seedVectors = [
      coxBasis?.re || [1, 0, 0, 0, 0, 0, 0, 0],
      coxBasis?.im || [0, 1, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 0, 0, 0],
      [0, 0, 1, 0, 0, 0, 0, 0],
    ];
    const basis = gramSchmidt8(seedVectors);
    while (basis.length < 3) basis.push(h4Basis()[basis.length]);
    return basis.slice(0, 3);
  }

  function applyBasis3D(basis) {
    // Apply basis to roots8d to get 3D positions
    const verts = pointsGeo.attributes.position.array;
    for (let i = 0; i < 240; i++) {
      const r = roots8dForEdges[i];
      verts[i*3]     = r[0]*basis[0][0] + r[1]*basis[0][1] + r[2]*basis[0][2] + r[3]*basis[0][3]
                     + r[4]*basis[0][4] + r[5]*basis[0][5] + r[6]*basis[0][6] + r[7]*basis[0][7];
      verts[i*3 + 1] = r[0]*basis[1][0] + r[1]*basis[1][1] + r[2]*basis[1][2] + r[3]*basis[1][3]
                     + r[4]*basis[1][4] + r[5]*basis[1][5] + r[6]*basis[1][6] + r[7]*basis[1][7];
      verts[i*3 + 2] = r[0]*basis[2][0] + r[1]*basis[2][1] + r[2]*basis[2][2] + r[3]*basis[2][3]
                     + r[4]*basis[2][4] + r[5]*basis[2][5] + r[6]*basis[2][6] + r[7]*basis[2][7];
    }
    pointsGeo.attributes.position.needsUpdate = true;

    // Rebuild edges ONCE per applyBasis3D call (was being called multiple
    // times per frame before, causing perf issues). Only sync if edges
    // are actually shown (skip when hidden to avoid wasted work).
    // Get showEdges via sharedParams() (this function is module-scope, not
    // in update()'s scope, so it can't access the local `params`).
    const sharedP = sharedParams();
    if (sharedP && sharedP.showEdges) syncEdgePositions();
  }

  function applyCoxeterBasis() {
    // Reset to the precomputed 2D Coxeter projection
    const verts = pointsGeo.attributes.position.array;
    for (let i = 0; i < 240; i++) {
      verts[i*3]     = proj[i].x * scaleK;
      verts[i*3 + 1] = proj[i].y * scaleK;
      verts[i*3 + 2] = 0;
    }
    pointsGeo.attributes.position.needsUpdate = true;
    syncEdgePositions();  // re-set edges to 2D Coxeter positions (in place)
  }

  // --- McKay highlight ---
  const mckaySubsets = data.mckay_subsets || (data.e8 && data.e8.mckay_subsets) || {};
  const SHAPE_SUBSETS = {
    icosahedron:  mckaySubsets.icosahedron  || [0,1,2,3,4,5,6,7,8,9,10,11],
    dodecahedron: mckaySubsets.dodecahedron || [0,1,2,3,4,5,6,7,8,9,10,11],
    cube:         mckaySubsets.cube         || [],
    octahedron:   mckaySubsets.octahedron   || [],
    tetrahedron:  mckaySubsets.tetrahedron  || [],
  };
  const getHighlightIndices = (shapeName) => {
    const subset = SHAPE_SUBSETS[shapeName];
    if (subset && subset.length > 0) return new Set(subset);
    const nTarget = PLATONIC_VERTEX_COUNTS[shapeName] || 12;
    const indexed = proj.map((p, i) => ({ i, r: p.r }));
    indexed.sort((a, b) => a.r - b.r);
    return new Set(indexed.slice(0, nTarget).map(x => x.i));
  };

  function highlightWeight(primary, compare, mode) {
    if (mode === 'off') return 0.0;
    if (mode === 'intersection') return primary && compare ? 1.4 : 0.0;
    if (mode === 'difference') return primary && !compare ? 1.0 : !primary && compare ? 0.65 : 0.0;
    return primary && compare ? 1.4 : primary ? 1.0 : compare ? 0.55 : 0.0;
  }

  const initialShape = sharedParams()?.shape || 'icosahedron';
  let currentHighlight = getHighlightIndices(initialShape);
  let currentCompareHighlight = getHighlightIndices(sharedParams()?.compareShape || 'dodecahedron');

  // Initialize highlights array
  for (let i = 0; i < proj.length; i++) {
    const primary = currentHighlight.has(i);
    const compare = currentCompareHighlight.has(i);
    highlights[i] = highlightWeight(primary, compare, sharedParams()?.compareMode || 'off');
  }
  points.userData.tooltipData = buildTipData(currentHighlight);

  // ----- Weyl orbit overlay -----
  // Shows a trail of the Weyl orbit of a chosen root β, generated by walking
  // random simple reflections. Trail is drawn as a polyline that fades.
  let orbitState = null;
  let orbitTrail = null;
  let orbitHeadMarker = null;     // pulses at the current trail tip
  let orbitSeedMarker = null;     // marks the starting root
  const ORBIT_MAX_POINTS = 120;
  function rebuildOrbitTrail() {
    const sharedP = sharedParams();
    if (orbitTrail) {
      group.remove(orbitTrail);
      orbitTrail.geometry.dispose();
      orbitTrail.material.dispose();
      orbitTrail = null;
    }
    if (orbitHeadMarker) {
      group.remove(orbitHeadMarker);
      orbitHeadMarker.geometry.dispose();
      orbitHeadMarker.material.dispose();
      orbitHeadMarker = null;
    }
    if (orbitSeedMarker) {
      group.remove(orbitSeedMarker);
      orbitSeedMarker.geometry.dispose();
      orbitSeedMarker.material.dispose();
      orbitSeedMarker = null;
    }
    if (!sharedP || !sharedP.weylOrbit) return;
    // Trail line (orange)
    const orbitGeo = new THREE.BufferGeometry();
    orbitGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(ORBIT_MAX_POINTS * 3), 3));
    const orbitMat = new LineFXMaterial({ color: 0xff9966, transparent: true, opacity: 0.85 });
    orbitTrail = new THREE.Line(orbitGeo, orbitMat);
    group.add(orbitTrail);
    // Trail-head pulsing marker (bright white-yellow ring, billboarded)
    const headGeo = new THREE.RingGeometry(0.05, 0.08, 32);
    const headMat = new THREE.MeshBasicMaterial({ color: 0xffeeaa, side: THREE.DoubleSide, transparent: true, opacity: 0.95 });
    orbitHeadMarker = new THREE.Mesh(headGeo, headMat);
    orbitHeadMarker.renderOrder = 999;  // draw on top
    group.add(orbitHeadMarker);
    // Seed root marker (large bright ring, always at the start)
    const seedGeo = new THREE.RingGeometry(0.08, 0.11, 32);
    const seedMat = new THREE.MeshBasicMaterial({ color: 0xff5555, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    orbitSeedMarker = new THREE.Mesh(seedGeo, seedMat);
    orbitSeedMarker.renderOrder = 999;
    group.add(orbitSeedMarker);
    orbitState = {
      seed: (sharedP && sharedP.weylSeed && sharedP.weylSeed.length === 8) ? sharedP.weylSeed.slice() : [1, -1, 0, 0, 0, 0, 0, 0],
      current: null,
      points: [],
      counter: 0,
      word: [],            // sequence of simple reflection indices applied so far
      headPulse: 0,
    };
    orbitState.current = orbitState.seed.slice();
    orbitState.points = [orbitState.current.slice()];
  }

  return {
    group,
    object3d: group,
    name: 'e8coxeter',

    // Click handler: raycast and pick the nearest root, then highlight its
    // 56 Cartan-connected neighbors. Second click on a different root shows
    // the Cartan entry between the two (idea #47: drag between two roots).
    // NOTE: uses window.__app.params to get the shared params (no free
    // `params` variable in this module).
    onClick(ndcX, ndcY) {
      const sharedParams = context.params || window.__app?.params;
      const cam = runtimeCamera();
      if (!sharedParams || !cam) return;
      // Use the global raycaster (shared with the tooltip system)
      const rc = runtimeRaycaster();
      if (!rc) return;
      rc.setFromCamera({ x: ndcX, y: ndcY }, cam);
      // Only intersect THIS view's points object
      const hits = rc.intersectObject(points, false);
      if (hits.length === 0) {
        // Clicked empty space — clear the pick
        sharedParams.pickedRoot = null;
        sharedParams.pickedRootPrev = null;
        sharedParams.cartanEntry = null;
        refreshAppPanel();
        return;
      }
      const idx = hits[0].index;
      const prev = sharedParams.pickedRoot;
      sharedParams.pickedRoot = idx;
      if (prev != null && prev !== idx) {
        // Second click: compute Cartan entry between prev and idx
        let ip = 0;
        for (let k = 0; k < 8; k++) ip += roots8d[prev][k] * roots8d[idx][k];
        sharedParams.pickedRootPrev = prev;
        sharedParams.cartanEntry = {
          from: prev, to: idx,
          innerProduct: ip,
          // 0=orthogonal, ±1=adjacent, ±2=double, ±3=triple, ±4=longer
          relation: ip === 0 ? 'orthogonal' :
                    ip === -1 ? 'adjacent (⟨α,β⟩=-1)' :
                    ip === 1 ? 'reflection' :
                    ip === -2 ? 'long edge' :
                    ip === 2 ? 'long sum' :
                    `${ip}-related`,
        };
      } else {
        sharedParams.cartanEntry = null;
      }
      // Trigger a panel refresh so the new "Pick: root #N" box appears
      refreshAppPanel();
    },

    // Hover handler: set params.hoveredRoot (drives tooltip + size boost)
    // NOTE: this method is called from animate() every frame the cursor is
    // over the canvas. It must reference the SHARED params object via
    // window.__app.params (not via a free `params` variable, which is not
    // in scope in this module).
    onHover(ndcX, ndcY) {
      const sharedParams = context.params || window.__app?.params;
      const cam = runtimeCamera();
      if (!sharedParams || !cam) return;
      const rc = runtimeRaycaster();
      if (!rc) return;
      rc.setFromCamera({ x: ndcX, y: ndcY }, cam);
      const hits = rc.intersectObject(points, false);
      if (hits.length > 0) {
        sharedParams.hoveredRoot = hits[0].index;
      } else {
        sharedParams.hoveredRoot = null;
      }
    },

    update(dt, time, params) {
      const shared = params || sharedParams() || {};
      const shapeName = shared.shape || 'icosahedron';

      // View mode: 'coxeter' (default 2D), 'ortho3d' (first 3 axes of R^8), or 'custom' (user angles)
      const viewMode = shared.e8ViewMode || 'coxeter';
      const spin = (shared.e8Spin ?? 0);
      const tilt = (shared.e8Tilt ?? 0);
      const roll = (shared.e8Roll ?? 0);

      // Detect changes
      const projChanged = viewMode !== lastViewMode
        || (viewMode === 'custom' && (spin !== lastSpin || tilt !== lastTilt || roll !== lastRoll));
      if (projChanged) {
        lastViewMode = viewMode;
        lastSpin = spin; lastTilt = tilt; lastRoll = roll;
        if (viewMode === 'coxeter') {
          applyCoxeterBasis();
        } else if (viewMode === 'h4') {
          applyBasis3D(h4Basis());
        } else if (viewMode === 'petrie') {
          applyBasis3D(petrieBasis());
        } else if (viewMode === 'ortho3d') {
          // Use random orthonormal basis in R^8 — gives a true 3D spread.
          // Seeded so the basis is reproducible per-session.
          applyBasis3D(generateRandomBasis(params.seed || 42));
        } else {
          const basis = computeBasis3D(spin, tilt, roll);
          applyBasis3D(basis);
        }
        // Scale positions to fit the visible area (auto-fit to baseScale)
        // After basis transformation, positions may be larger — normalize.
        const verts = pointsGeo.attributes.position.array;
        let maxAbs = 0;
        for (let i = 0; i < verts.length; i++) {
          const a = Math.abs(verts[i]);
          if (a > maxAbs) maxAbs = a;
        }
        if (maxAbs > 0) {
          const fit = baseScale / maxAbs * 0.85;
          for (let i = 0; i < verts.length; i++) verts[i] *= fit;
          pointsGeo.attributes.position.needsUpdate = true;
        }
        captureProjectionBase();
      }

      // --- Extrude morph: blend 2D Coxeter projection (z=0) with 3D position (z=depth) ---
      // morphT = 0 → flat 2D,  morphT = 1 → extruded 3D
      const morphT = Math.max(0, Math.min(1, shared.e8MorphT ?? 0));
      {
        const verts = pointsGeo.attributes.position.array;
        for (let i = 0; i < initialX.length; i++) {
          verts[i*3] = projectionBasePositions[i*3];
          verts[i*3 + 1] = projectionBasePositions[i*3 + 1];
          verts[i*3 + 2] = projectionBasePositions[i*3 + 2] * (1 - morphT) + initialZ[i] * morphT;
        }
        pointsGeo.attributes.position.needsUpdate = true;
      }

      // --- Weyl orbit trail --
      // Walk random simple reflections on the seed root and draw the trail.
      // Only meaningful in Coxeter (2D) mode — the trail projects 8D points
      // to 2D via the live pointsGeo positions, which only works when the
      // 240 roots are at their canonical 2D coords. In 3D modes the projection
      // is invalidated.
      if (params.weylOrbit && (params.e8ViewMode || 'coxeter') === 'coxeter') {
        if (!orbitState) rebuildOrbitTrail();
        if (orbitState) {
          // Take 2-3 random steps per frame so the trail builds up
          const steps = params.weylOrbitFast ? 4 : 2;
          for (let i = 0; i < steps; i++) {
            const s = Math.floor(Math.random() * 8);
            orbitState.current = weylReflect(s, orbitState.current);
            orbitState.word.push(s);
            orbitState.points.push(orbitState.current.slice());
            if (orbitState.points.length > ORBIT_MAX_POINTS) {
              orbitState.points.shift();
            }
            if (orbitState.word.length > 24) {
              orbitState.word.shift();
            }
          }
          // Project all orbit points to current 2D coords (using the live "positions" array)
          const arr = orbitTrail.geometry.attributes.position.array;
          let headX = 0, headY = 0, headZ = 0;
          for (let i = 0; i < orbitState.points.length; i++) {
            const p = orbitState.points[i];
            // The Coxeter projection is encoded in positions[i*3] / positions[i*3+1] for the
            // matching Coxeter-projected root. We look it up by closest 8D match in proj.
            let bestI = 0, bestD = Infinity;
            for (let j = 0; j < proj.length; j++) {
              const dx = p[0] - roots8d[j][0];
              const dy = p[1] - roots8d[j][1];
              const dz = p[2] - roots8d[j][2];
              const dw = p[3] - roots8d[j][3];
              const d = dx*dx+dy*dy+dz*dz+dw*dw;
              if (d < bestD) { bestD = d; bestI = j; }
            }
            arr[i*3]     = positions[bestI*3];
            arr[i*3 + 1] = positions[bestI*3 + 1];
            arr[i*3 + 2] = positions[bestI*3 + 2] * 0.5;  // sit slightly in front
            if (i === orbitState.points.length - 1) {
              headX = arr[i*3]; headY = arr[i*3 + 1]; headZ = arr[i*3 + 2];
            }
          }
          orbitTrail.geometry.setDrawRange(0, orbitState.points.length);
          orbitTrail.geometry.attributes.position.needsUpdate = true;
          // Position the trail-head pulsing marker at the current tip
          if (orbitHeadMarker) {
            orbitHeadMarker.position.set(headX, headY, headZ + 0.02);
            const pulse = 1 + 0.4 * Math.sin(time * 6.0);
            orbitHeadMarker.scale.setScalar(pulse);
          }
          // Position the seed marker at the starting root
          if (orbitSeedMarker) {
            // Find seed in proj
            let bestI = 0, bestD = Infinity;
            for (let j = 0; j < proj.length; j++) {
              const dx = orbitState.seed[0] - roots8d[j][0];
              const dy = orbitState.seed[1] - roots8d[j][1];
              const dz = orbitState.seed[2] - roots8d[j][2];
              const dw = orbitState.seed[3] - roots8d[j][3];
              const d = dx*dx+dy*dy+dz*dz+dw*dw;
              if (d < bestD) { bestD = d; bestI = j; }
            }
            orbitSeedMarker.position.set(
              positions[bestI*3], positions[bestI*3 + 1], positions[bestI*3 + 2] * 0.5 + 0.02
            );
          }
          // Expose the reflection word so the panel can display it
          params._weylWord = orbitState.word.slice();
          params._weylSteps = orbitState.word.length;
        }
      } else if (orbitState && (params.e8ViewMode || 'coxeter') !== 'coxeter') {
        // Switched out of Coxeter mode — disable orbit so it doesn't
        // project 8D points onto scrambled 3D positions. User can re-enable
        // in 2D mode.
        params.weylOrbit = false;
        if (orbitTrail) {
          group.remove(orbitTrail);
          orbitTrail.geometry.dispose();
          orbitTrail.material.dispose();
          orbitTrail = null;
        }
        if (orbitHeadMarker) {
          group.remove(orbitHeadMarker);
          orbitHeadMarker.geometry.dispose();
          orbitHeadMarker.material.dispose();
          orbitHeadMarker = null;
        }
        if (orbitSeedMarker) {
          group.remove(orbitSeedMarker);
          orbitSeedMarker.geometry.dispose();
          orbitSeedMarker.material.dispose();
          orbitSeedMarker = null;
        }
        orbitState = null;
        params._weylWord = [];
        params._weylSteps = 0;
      } else if (orbitState) {
        // Disabled — clean up
        if (orbitTrail) {
          group.remove(orbitTrail);
          orbitTrail.geometry.dispose();
          orbitTrail.material.dispose();
          orbitTrail = null;
        }
        if (orbitHeadMarker) {
          group.remove(orbitHeadMarker);
          orbitHeadMarker.geometry.dispose();
          orbitHeadMarker.material.dispose();
          orbitHeadMarker = null;
        }
        if (orbitSeedMarker) {
          group.remove(orbitSeedMarker);
          orbitSeedMarker.geometry.dispose();
          orbitSeedMarker.material.dispose();
          orbitSeedMarker = null;
        }
        orbitState = null;
        params._weylWord = [];
        params._weylSteps = 0;
      }

      // Auto-rotation (z-axis spin on the rendered group). When recording
      // video, slow the spin so thin chord lines move fewer pixels per frame
      // and stay sharp under video compression (no smearing).
      if (params.autoRotate) {
        const recScale = params._recording ? (params._recordingMotionScale ?? 0.4) : 1;
        group.rotation.z += dt * params.rotationSpeed * recScale;
      }

      // Animated 3D exploration: when in custom 3D mode, ALWAYS animate
      // the spin/tilt sliders so the user sees the root cloud rotate
      // continuously (even if they didn't enable autoRotate). The only
      // way to stop it is to switch back to 2D Coxeter mode.
      // 8D: use co-prime frequencies so the rotation never repeats (the 240
      // roots trace a quasi-periodic Lissajous-like path through 8D).
      // Speed: 0.9/0.6/0.45 rad/sec — ~1.5× what it was, very visible motion.
      if (params.e8ViewMode === 'custom') {
        // Auto-rotate by default — if the user pauses, they can click PAUSE
        const speed = params.e8AutoRotate === false ? 0 : 1.0;
        params.e8Spin = (params.e8Spin || 0) + dt * 0.9 * speed;
        params.e8Tilt = (params.e8Tilt || 0) + dt * 0.6 * speed;
        params.e8Roll = (params.e8Roll || 0) + dt * 0.45 * speed;
      }

      // Ring guides + 30-gon outline only make sense in Coxeter (2D) mode
      const showRings = !!(params.showRings) && (params.e8ViewMode === 'coxeter');
      ringGroup.visible = showRings;
      triMesh.visible = showRings;
      edgeGroup.visible = params.showEdges;
      const is2D = (params.e8ViewMode || 'coxeter') === 'coxeter';
      const picked = params.pickedRoot;

      const haloDepth = Math.max(1, Math.min(5, Math.round(params.rootHaloDepth || 3)));
      if (!params.rootDiffusion) {
        if (lastDistanceRoot !== null) {
          rebuildRootDistances(null, haloDepth, params);
          lastDistanceRoot = null;
        }
      } else if (picked !== lastDistanceRoot || haloDepth !== lastHaloDepth) {
        rebuildRootDistances(picked, haloDepth, params);
        diffusionStartedAt = time;
        lastDistanceRoot = picked;
        lastHaloDepth = haloDepth;
      }

      const twin600 = !!params.e8Twin600;
      const colorBy = params.colorBy || 'shell';
      if (twin600 !== lastTwin600 || colorBy !== lastColorBy) {
        applyPointColors(activePalette, colorBy, twin600);
        lastTwin600 = twin600;
        lastColorBy = colorBy;
      }

      mirrorGroup.visible = !!params.showWeylMirrors && is2D;
      if (mirrorGroup.visible) {
        const activeMirror = orbitState?.word?.length
          ? orbitState.word[orbitState.word.length - 1]
          : Math.floor(time * 0.7) % Math.max(1, mirrorMaterials.length);
        for (let i = 0; i < mirrorMaterials.length; i++) {
          const hot = i === activeMirror;
          mirrorMaterials[i].opacity = hot ? 0.78 + 0.16 * Math.sin(time * 5) : 0.28;
          mirrorMaterials[i].color.set(hot ? 0xf4d27a : 0x6affe8);
        }
      }

      // Update opacity + FX uniforms
      pointsMat.uniforms.uOpacity.value = params.opacity ?? 0.95;
      pointsMat.uniforms.uTime.value = time;
      // FX mode: 0=none, 1=glow, 2=trail, 3=kaleidoscope, 4=ripple, 5=spiral,
      //          6=pulse, 7=chromatic, 8=fog, 9=heat, 10=edge-glow
      pointsMat.uniforms.uFXMode.value = FX_MODE_MAP[params.fxMode] ?? 0;
      pointsMat.uniforms.uFXIntensity.value = params.fxIntensity ?? 0.5;
      pointsMat.uniforms.uRootDiffusion.value = params.rootDiffusion && picked != null ? 1 : 0;
      pointsMat.uniforms.uDiffusionTime.value = ((time - diffusionStartedAt) * (params.rootDiffusionSpeed || 1.25)) % (haloDepth + 1.75);
      // FX trail: leave ghost positions behind by storing previous frame
      if (params.fxMode === 'trail') {
        // Decay all colors slightly so previous frames fade out
        // (visual hack: a simple alpha reduction via color intensity)
        const c = pointsGeo.attributes.color.array;
        for (let i = 0; i < c.length; i++) c[i] *= 0.97;
        pointsGeo.attributes.color.needsUpdate = true;
      }

      // Highlight updates on shape or comparison-shape change
      const compareShape = params.compareShape || 'dodecahedron';
      const compareMode = params.compareMode || 'off';
      if (shapeName !== lastMcKayShape || compareShape !== lastCompareShape || compareMode !== lastCompareMode) {
        lastMcKayShape = shapeName;
        lastCompareShape = compareShape;
        lastCompareMode = compareMode;
        currentHighlight = getHighlightIndices(shapeName);
        currentCompareHighlight = getHighlightIndices(compareShape);
        for (let i = 0; i < proj.length; i++) {
          const primary = currentHighlight.has(i);
          const compare = currentCompareHighlight.has(i);
          highlights[i] = highlightWeight(primary, compare, compareMode);
        }
        pointsGeo.attributes.highlight.needsUpdate = true;
        points.userData.tooltipData = buildTipData(currentHighlight);
      }

      // --- Petrie + Cartan highlight: rebuild when projection changes ---
      // Both features are 2D-only (Coxeter plane). In 3D modes the cycle
      // vertices get scattered to scrambled positions, so we hide them.
      if (projChanged) {
        // Positions changed → redraw Petrie + Cartan lines to match
        if (petrieLine) rebuildPetrieLine();
        if (cartanHighlightLines) rebuildCartanHighlight();
      }
      // Detect toggles + selection changes (cheap comparison)
      const wantPetrie = !!params.showPetrie && is2D;
      const wantCartan = !!params.cartanHighlight && (params.cartanSelection || []).length > 0 && is2D;
      const havePetrie = !!(petrieLine && petrieLine.visible);
      const haveCartan = !!(cartanHighlightLines && cartanHighlightLines.visible);
      if (wantPetrie !== havePetrie || wantCartan !== haveCartan) {
        maybeRebuildPetrieAndCartan();
      } else if (wantCartan && params._cartanSelectionVersion !== params.cartanSelection?.length) {
        // Selection length changed (user clicked a different root) — rebuild
        rebuildCartanHighlight();
        params._cartanSelectionVersion = params.cartanSelection?.length;
      }

      // --- Picked root: pulse + size boost the sphere ---
      if (picked != null && picked !== lastPicked) {
        // The picked point is grown via a per-vertex scale. The existing
        // `size` attribute is the base size; we overlay a picked boost.
        for (let i = 0; i < sizes.length; i++) {
          const baseSize = (1 - proj[i].r / maxR) * 10 + 5;  // 5..15
          sizes[i] = i === picked ? baseSize * 2.4 : baseSize;
        }
        pointsGeo.attributes.size.needsUpdate = true;
        lastPicked = picked;
      } else if (picked == null && lastPicked != null) {
        // Unpicked — restore sizes
        for (let i = 0; i < sizes.length; i++) {
          sizes[i] = (1 - proj[i].r / maxR) * 10 + 5;  // 5..15
        }
        pointsGeo.attributes.size.needsUpdate = true;
        lastPicked = null;
      }
      // Hover: subtle scale boost on the currently-hovered point
      const hovered = params.hoveredRoot;
      if (hovered != null && hovered !== lastHovered) {
        for (let i = 0; i < sizes.length; i++) {
          if (i === hovered) {
            const baseSize = (1 - proj[i].r / maxR) * 10 + 5;  // 5..15
            if (i !== picked) sizes[i] = baseSize * 1.4;
          } else if (i !== picked && i !== lastHovered) {
            const baseSize = (1 - proj[i].r / maxR) * 10 + 5;
            sizes[i] = baseSize;
          }
        }
        // Restore lastHovered to base
        if (lastHovered != null && lastHovered !== picked) {
          const baseSize = (1 - proj[lastHovered].r / maxR) * 10 + 5;  // 5..15
          sizes[lastHovered] = baseSize;
        }
        pointsGeo.attributes.size.needsUpdate = true;
        lastHovered = hovered;
      } else if (hovered == null && lastHovered != null) {
        if (lastHovered !== picked) {
          const baseSize = (1 - proj[lastHovered].r / maxR) * 10 + 5;  // 5..15
          sizes[lastHovered] = baseSize;
          pointsGeo.attributes.size.needsUpdate = true;
        }
        lastHovered = null;
      }

      // --- Picked-root neighbor highlight: 56 cyan lines ---
      const wantPickedNeighbors = picked != null && is2D;
      const havePickedNeighbors = !!(pickedNeighborLines && pickedNeighborLines.visible);
      if (wantPickedNeighbors !== havePickedNeighbors) {
        if (wantPickedNeighbors) rebuildPickedNeighbors();
        if (pickedNeighborLines) pickedNeighborLines.visible = wantPickedNeighbors;
      } else if (wantPickedNeighbors && picked !== lastPickedForNeighbors) {
        rebuildPickedNeighbors();
        lastPickedForNeighbors = picked;
      }
    },

    // Called by main.js when the user clicks a palette swatch. Re-computes
    // the per-ring colors and updates the GPU buffer in place. This makes
    // the color change immediate (no need to switch views).
    onPaletteChange(newPalette) {
      activePalette = newPalette;
      ringColors = computeRingColors(newPalette);
      applyPointColors(newPalette, sharedParams()?.colorBy || 'shell', !!sharedParams()?.e8Twin600);
      // Also update edge line colors
      if (edgeGroup && edgeGroup.children.length > 0) {
        for (let c = 0; c < edgeGroup.children.length; c++) {
          if (edgeGroup.children[c].material) {
            edgeGroup.children[c].material.color.set(colorAt(newPalette, c / 7, 'spectrum'));
          }
        }
      }
    },

    dispose() {
      pointsGeo.dispose();
      pointsMat.dispose();
      ringGroup.children.forEach(line => { line.geometry.dispose(); line.material.dispose(); });
      mirrorGroup.children.forEach(line => { line.geometry.dispose(); line.material.dispose(); });
      edgeGroup.children.forEach(line => { line.geometry.dispose(); line.material.dispose(); });
      tg.dispose(); tm.dispose();
      if (petrieLine) { petrieLine.geometry.dispose(); petrieLine.material.dispose(); }
      if (cartanHighlightLines) { cartanHighlightLines.geometry.dispose(); cartanHighlightLines.material.dispose(); }
      if (pickedNeighborLines) { pickedNeighborLines.geometry.dispose(); pickedNeighborLines.material.dispose(); }
      if (orbitTrail) { orbitTrail.geometry.dispose(); orbitTrail.material.dispose(); }
      if (orbitHeadMarker) { orbitHeadMarker.geometry.dispose(); orbitHeadMarker.material.dispose(); }
      if (orbitSeedMarker) { orbitSeedMarker.geometry.dispose(); orbitSeedMarker.material.dispose(); }
      // Clear the pick so the next view starts clean
      const shared = sharedParams();
      if (shared) {
        shared.pickedRoot = null;
        shared.pickedRootPrev = null;
        shared.cartanEntry = null;
      }
    },
  };
}
