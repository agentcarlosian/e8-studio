// platonic.view.js — Render a single Platonic solid in 3D
//
// Wireframe edges + vertex dots, with optional translucent face fill.
// Drag-rotate comes from the global orbit camera; view adds optional
// per-shape slow auto-rotation.

import * as THREE from 'three';
import { colorAt } from '../ui/palettes.js';
import { VERTEX_FX_BRANCHES, FRAGMENT_FX_BRANCHES } from '../fx/fx-branches.js';
import { FX_MODE_MAP } from '../fx/fx-shader.js';
import { getStellation, STELLATION_NAMES } from '../math/stellations.js';
import { deformPlatonicVert } from '../math/morph.js';
import { LineFXMaterial } from '../fx/fx-line-shader.js';

// Round 9: the four Kepler–Poinsot star polyhedra are not in data/platonic.json
// (their faces are self-intersecting, which doesn't fit the triangle-list
// format). Instead we derive verts/edges at runtime from the same φ-based
// coordinates as the icosahedron/dodecahedron. See math/stellations.js.
const STELLATION_SET = new Set(STELLATION_NAMES);

// ── Convex-hull face triangulation ─────────────────────────────────────────
// The five convex Platonic solids are centred on the origin. Rather than trust
// the `faces` arrays baked into data/platonic.json (which were generated wrong —
// the icosahedron/dodecahedron triangles span non-adjacent vertices and slice
// through the interior), we derive a guaranteed-correct triangulation from the
// vertices here. O(V^4) brute force, but V≤20 so it's a few thousand ops.
//
// Algorithm: a triple of vertices is a hull facet iff every other vertex lies
// on one side of its plane. We collect the distinct supporting planes, gather
// all vertices lying on each (handles coplanar quad/pentagon faces), order them
// CCW about the face centroid, and fan-triangulate with outward winding.
function convexHullFaces(verts) {
  const n = verts.length;
  if (n < 4) return [];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  let maxR = 0;
  for (const v of verts) maxR = Math.max(maxR, Math.hypot(v[0], v[1], v[2]));
  const eps = 1e-4 * (maxR || 1);

  // Collect distinct outward-facing supporting planes.
  const planes = new Map();
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      for (let k = j + 1; k < n; k++) {
        let nrm = cross(sub(verts[j], verts[i]), sub(verts[k], verts[i]));
        const len = Math.hypot(nrm[0], nrm[1], nrm[2]);
        if (len < eps) continue; // collinear triple
        nrm = [nrm[0] / len, nrm[1] / len, nrm[2] / len];
        let d = dot(nrm, verts[i]);
        let pos = 0, neg = 0;
        for (let m = 0; m < n; m++) {
          const s = dot(nrm, verts[m]) - d;
          if (s > eps) pos++; else if (s < -eps) neg++;
        }
        if (pos && neg) continue; // not a hull facet
        // Orient the normal outward (away from the origin-centred centroid).
        if (d < 0) { nrm = [-nrm[0], -nrm[1], -nrm[2]]; d = -d; }
        const key = [nrm[0], nrm[1], nrm[2], d]
          .map(x => Math.round(x / eps)).join(',');
        if (!planes.has(key)) planes.set(key, { nrm, d });
      }
    }
  }

  // Triangulate each planar face polygon.
  const faces = [];
  for (const { nrm, d } of planes.values()) {
    const idx = [];
    for (let m = 0; m < n; m++) {
      if (Math.abs(dot(nrm, verts[m]) - d) < 10 * eps) idx.push(m);
    }
    if (idx.length < 3) continue;
    // 2-D basis in the face plane (u, w) with u×w == nrm (outward).
    let u = Math.abs(nrm[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    const proj = dot(u, nrm);
    u = [u[0] - proj * nrm[0], u[1] - proj * nrm[1], u[2] - proj * nrm[2]];
    const ul = Math.hypot(u[0], u[1], u[2]);
    u = [u[0] / ul, u[1] / ul, u[2] / ul];
    const w = cross(nrm, u);
    const c = [0, 0, 0];
    for (const m of idx) { c[0] += verts[m][0]; c[1] += verts[m][1]; c[2] += verts[m][2]; }
    c[0] /= idx.length; c[1] /= idx.length; c[2] /= idx.length;
    idx.sort((A, B) => {
      const pa = sub(verts[A], c), pb = sub(verts[B], c);
      return Math.atan2(dot(pa, w), dot(pa, u)) - Math.atan2(dot(pb, w), dot(pb, u));
    });
    for (let t = 1; t < idx.length - 1; t++) {
      faces.push([idx[0], idx[t], idx[t + 1]]);
    }
  }
  return faces;
}

export function createPlatonicView({ data, palette, scale: baseScale, context = {} }) {
  const group = new THREE.Group();
  group.name = 'Platonic';
  const runtimeParams = () => context.params || (typeof window !== 'undefined' ? window.__app?.params : null) || {};

  // Resolve current shape via the shared runtime params.
  // Helper: build a single Platonic solid (or star stellation) at the given
  // world scale. Returns { mat: ShaderMaterial } for FX-uniform updating.
  function buildSolid(shapeName, worldScale, colorT, spread = 0.7) {
    const blendMode = runtimeParams().blendMode || 'spectrum';
    // Star polyhedra: pull derived geometry from the stellations module.
    // Fall back to data.platonic for the five convex solids.
    let shape, faces;
    if (STELLATION_SET.has(shapeName)) {
      const st = getStellation(shapeName);
      shape = st ? { verts: st.verts, edges: st.edges } : null;
      // Kepler–Poinsot stars have intentionally self-intersecting faces that are
      // NOT the convex hull, so we must use their explicit face list.
      faces = st ? (st.faces || []) : [];
    } else {
      shape = data.platonic[shapeName];
      // Convex solids: compute a correct triangulation from the hull. The faces
      // in data/platonic.json are wrong (they slice through the solid), so we
      // ignore them entirely here.
      faces = shape ? convexHullFaces(shape.verts) : [];
    }
    if (!shape) return null;
    const verts = shape.verts;
    const edges = shape.edges;
    // Captured for in-place morph deformation (see refillSolid / deformVert).
    let faceGeo = null, lineGeo = null;

    const positions = new Float32Array(verts.length * 3);
    for (let i = 0; i < verts.length; i++) {
      positions[i*3]     = verts[i][0] * worldScale;
      positions[i*3 + 1] = verts[i][1] * worldScale;
      positions[i*3 + 2] = verts[i][2] * worldScale;
    }

    // Per-vertex palette colours, spread around the solid's base colorT by
    // azimuth (angle about Y). Without this the whole solid was one flat colour,
    // so a multi-colour palette (e.g. neon) collapsed to a single hue. `spread`
    // controls how wide a band of the palette wraps the solid (small for stacked
    // modes so the nested solids stay distinguishable).
    const vertColor = verts.map((v) => {
      const az = (Math.atan2(v[2], v[0]) + Math.PI) / (2 * Math.PI); // 0..1
      const tt = Math.max(0, Math.min(1, colorT + (az - 0.5) * spread));
      return new THREE.Color(colorAt(palette, tt, blendMode));
    });

    // Solid faces — translucent fill so the polyhedron reads as 3D, not
    // just a wireframe. Without this the shape looks like dots + lines.
    if (faces.length > 0) {
      const faceVerts = new Float32Array(faces.length * 9);
      const faceCols = new Float32Array(faces.length * 9);
      for (let f = 0; f < faces.length; f++) {
        const [a, b, c] = faces[f];
        faceVerts[f*9]     = positions[a*3];
        faceVerts[f*9 + 1] = positions[a*3 + 1];
        faceVerts[f*9 + 2] = positions[a*3 + 2];
        faceVerts[f*9 + 3] = positions[b*3];
        faceVerts[f*9 + 4] = positions[b*3 + 1];
        faceVerts[f*9 + 5] = positions[b*3 + 2];
        faceVerts[f*9 + 6] = positions[c*3];
        faceVerts[f*9 + 7] = positions[c*3 + 1];
        faceVerts[f*9 + 8] = positions[c*3 + 2];
        const ca = vertColor[a], cb = vertColor[b], cc = vertColor[c];
        faceCols[f*9]   = ca.r; faceCols[f*9+1] = ca.g; faceCols[f*9+2] = ca.b;
        faceCols[f*9+3] = cb.r; faceCols[f*9+4] = cb.g; faceCols[f*9+5] = cb.b;
        faceCols[f*9+6] = cc.r; faceCols[f*9+7] = cc.g; faceCols[f*9+8] = cc.b;
      }
      faceGeo = new THREE.BufferGeometry();
      faceGeo.setAttribute('position', new THREE.Float32BufferAttribute(faceVerts, 3));
      faceGeo.setAttribute('color', new THREE.Float32BufferAttribute(faceCols, 3));
      faceGeo.computeVertexNormals();
      const faceMat = new THREE.MeshStandardMaterial({
        vertexColors: true,                     // per-vertex palette spread
        emissive: new THREE.Color(colorAt(palette, colorT + 0.1, blendMode)),
        emissiveIntensity: 0.25,
        metalness: 0.15,
        roughness: 0.55,
        transparent: true,
        opacity: 0.7,  // high enough that each face is clearly distinct
        side: THREE.DoubleSide,
        depthWrite: true,  // write to depth so back-faces don't bleed through
      });
      group.add(new THREE.Mesh(faceGeo, faceMat));
    }

    // Edges as line segments (slightly fainter)
    if (edges.length > 0) {
      const linePositions = [];
      for (const [a, b] of edges) {
        linePositions.push(
          positions[a*3], positions[a*3+1], positions[a*3+2],
          positions[b*3], positions[b*3+1], positions[b*3+2],
        );
      }
      lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(linePositions, 3));
      const lineMat = new LineFXMaterial({
        color: new THREE.Color(colorAt(palette, colorT, blendMode)),
        transparent: true,
        opacity: 0.7,
      });
      group.add(new THREE.LineSegments(lineGeo, lineMat));
    }

    // Lit vertex spheres — react to scene lights (key, fill, ambient, accent)
    // Use small instanced spheres at each vertex position for proper PBR lighting
    const SPHERE_GEO = new THREE.SphereGeometry(0.045, 12, 10);
    const sphereMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,                          // multiplied by per-instance colour
      emissiveIntensity: 0.6,
      metalness: 0.3,
      roughness: 0.4,
    });
    const sphereInst = new THREE.InstancedMesh(SPHERE_GEO, sphereMat, verts.length);
    const m4 = new THREE.Matrix4();
    for (let i = 0; i < verts.length; i++) {
      m4.makeTranslation(positions[i*3], positions[i*3+1], positions[i*3+2]);
      sphereInst.setMatrixAt(i, m4);
      sphereInst.setColorAt(i, vertColor[i]);   // per-vertex palette spread
    }
    sphereInst.instanceMatrix.needsUpdate = true;
    if (sphereInst.instanceColor) sphereInst.instanceColor.needsUpdate = true;
    group.add(sphereInst);

    // Original small points (kept for FX-aware visualization like glow)
    const vGeo = new THREE.BufferGeometry();
    vGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const vColors = new Float32Array(positions.length);
    for (let i = 0; i < positions.length / 3; i++) {
      const c = vertColor[i] || vertColor[0];
      vColors[i*3]     = c.r;
      vColors[i*3 + 1] = c.g;
      vColors[i*3 + 2] = c.b;
    }
    vGeo.setAttribute('color', new THREE.BufferAttribute(vColors, 3));
    const vMat = new THREE.ShaderMaterial({
      uniforms: {
        uPixelRatio: { value: window.devicePixelRatio || 1 },
        uBaseSize: { value: 0.08 * worldScale },
        uOpacity: { value: 0.95 },
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
          if (uFXMode == 4) {
            float r = length(position.xy);
            scale *= 1.0 + uFXIntensity * 0.4 * sin(r * 8.0 - uTime * 4.0);
          }
          if (uFXMode == 5) {
            float a = atan(position.y, position.x);
            scale *= 1.0 + uFXIntensity * 0.5 * sin(a * 6.0 + uTime * 2.0);
          }
          if (uFXMode == 6) {
            // Pulse: breathing scale 0.7..1.3 over 2s
            float p = sin(uTime * 3.14159) * 0.5 + 0.5;
            scale *= 0.7 + 0.6 * p * uFXIntensity;
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
          if (uFXMode == 1) {
            // Glow: extra outer halo
            float g = smoothstep(0.5, 0.05, d) * uFXIntensity * 0.8;
            col += vColor * g * 2.5;
          }
          if (uFXMode == 3) {
            // Kaleidoscope: position-based hue shift
            float h = sin(vWorldPos.x * 5.0 + vWorldPos.y * 3.0 + uTime) * uFXIntensity * 0.6;
            col.r *= (1.0 + h);
            col.g *= (1.0 + h * 0.4);
            col.b *= (1.0 - h * 0.4);
          }
          if (uFXMode == 7) {
            // Chromatic: RGB prism split
            float ca = uFXIntensity * 0.5;
            float ang = atan(c.y, c.x);
            col += vec3(
              sin(ang * 4.0 + uTime * 2.0) * ca,
              sin(ang * 4.0 + uTime * 2.0 + 2.094) * ca,
              sin(ang * 4.0 + uTime * 2.0 + 4.188) * ca
            );
          }
          if (uFXMode == 8) {
            // Fog: alpha fades with depth (approximate via world-space radius)
            float depth = length(vWorldPos) * 2.0 + 4.0;
            a *= 1.0 - smoothstep(4.0, 14.0, depth) * uFXIntensity;
          }
          ${FRAGMENT_FX_BRANCHES}
          a *= fxA;
          gl_FragColor = vec4(col, a * uOpacity);
        }
      `,
    });
    group.add(new THREE.Points(vGeo, vMat));

    // Record everything the morph deformer needs to rewrite the buffers in place
    // (no object churn → no fxRuntime leak, smooth live morphing + auto-animate).
    group.userData.solids.push({ verts, worldScale, faces, edges, faceGeo, lineGeo, sphereInst, vGeo });
    return vMat;
  }

  // Rewrite one solid's face/edge/sphere/point buffers from its base verts + morph.
  // The deformation lives in math/morph.js so the SVG/OBJ export deforms identically.
  function refillSolid(rec, m) {
    const { verts, worldScale, faces, edges, faceGeo, lineGeo, sphereInst, vGeo } = rec;
    const n = verts.length;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const d = deformPlatonicVert(verts[i][0], verts[i][1], verts[i][2], m);
      pos[i*3] = d[0] * worldScale; pos[i*3+1] = d[1] * worldScale; pos[i*3+2] = d[2] * worldScale;
    }
    if (faceGeo) {
      const fa = faceGeo.attributes.position.array;
      for (let f = 0; f < faces.length; f++) {
        const [a, b, c] = faces[f];
        fa[f*9]=pos[a*3];   fa[f*9+1]=pos[a*3+1]; fa[f*9+2]=pos[a*3+2];
        fa[f*9+3]=pos[b*3]; fa[f*9+4]=pos[b*3+1]; fa[f*9+5]=pos[b*3+2];
        fa[f*9+6]=pos[c*3]; fa[f*9+7]=pos[c*3+1]; fa[f*9+8]=pos[c*3+2];
      }
      faceGeo.attributes.position.needsUpdate = true;
      faceGeo.computeVertexNormals();
    }
    if (lineGeo) {
      const la = lineGeo.attributes.position.array;
      let k = 0;
      for (const [a, b] of edges) {
        la[k++]=pos[a*3]; la[k++]=pos[a*3+1]; la[k++]=pos[a*3+2];
        la[k++]=pos[b*3]; la[k++]=pos[b*3+1]; la[k++]=pos[b*3+2];
      }
      lineGeo.attributes.position.needsUpdate = true;
    }
    if (sphereInst) {
      const m4 = new THREE.Matrix4();
      for (let i = 0; i < n; i++) { m4.makeTranslation(pos[i*3], pos[i*3+1], pos[i*3+2]); sphereInst.setMatrixAt(i, m4); }
      sphereInst.instanceMatrix.needsUpdate = true;
    }
    if (vGeo) {
      vGeo.attributes.position.array.set(pos);
      vGeo.attributes.position.needsUpdate = true;
    }
  }

  // Apply the current morph to every built solid. Returns the morph signature so
  // the caller can skip work when nothing changed.
  function applyMorph(m) {
    const solids = group.userData.solids || [];
    for (const rec of solids) refillSolid(rec, m);
  }

  // Build only the selected solid. The former dual/all/nested stack modes made
  // the model difficult to read and have been removed from the product UI.
  const buildForShape = (shapeName) => {
    while (group.children.length) {
      const c = group.children.pop();
      if (c.geometry) c.geometry.dispose();
      if (c.material) c.material.dispose();
    }
    group.userData.materials = [];
    group.userData.solids = [];

    const R = baseScale;
    const material = buildSolid(shapeName, R, 0.5, 0.95);
    if (material) group.userData.materials.push(material);
  };
  const R = baseScale;
  // Bounding sphere outline (faint)
  const sphereGeo = new THREE.SphereGeometry(R * 1.05, 32, 16);
  const sphereMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(colorAt(palette, 0.3)),
    wireframe: true,
    transparent: true,
    opacity: 0.06,
  });
  group.add(new THREE.Mesh(sphereGeo, sphereMat));

  // Initial build
  const initialShape = runtimeParams().shape || 'icosahedron';
  buildForShape(initialShape);

  let lastShape = initialShape;
  let builtTime = 0;
  let lastMorphSig = null;

  return {
    group,
    object3d: group,
    name: 'platonic',

    update(dt, time, params) {
      // Shared Extrude control: stretch the solid through depth while slightly
      // tightening its face plane, producing a clear push/pull deformation.
      const extrude = Math.max(0, Math.min(1, params.e8MorphT ?? 0));
      group.scale.set(1 - extrude * 0.08, 1 - extrude * 0.08, 1 + extrude * 0.75);
      // Rebuild on shape change
      const cur = runtimeParams().shape;
      let rebuilt = false;
      if (cur && cur !== lastShape) {
        lastShape = cur;
        buildForShape(cur);
        builtTime = time;
        rebuilt = true;
      }
      // Parametric morph (twist / spike / jitter) — deform the solid in place
      // when a morph slider moves (or after a rebuild). Cheap: the solids are
      // ≤20 verts, and we only refill when the signature changes.
      const morph = {
        twist: params.shapeTwist || 0,
        spike: params.shapeSpike || 0,
        jitter: params.shapeJitter || 0,
      };
      const sig = `${morph.twist}|${morph.spike}|${morph.jitter}`;
      if (rebuilt || sig !== lastMorphSig) {
        applyMorph(morph);
        lastMorphSig = sig;
      }
      // Optional model rotation, independent from camera orbit.
      // Slowed during video recording so edges stay sharp under compression.
      if (params.autoRotate) {
        const recScale = params._recording ? (params._recordingMotionScale ?? 0.4) : 1;
        const rs = params.rotationSpeed * recScale;
        group.rotation.y += dt * rs;
        group.rotation.x += dt * rs * 0.4;
      }
      // FX uniform updates + trail decay. Use the canonical name→id map from
      // fx-shader.js so every FX mode (0–23) is reachable — the old local map
      // only covered 0–5, silently disabling modes 6–23 in this view.
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
      group.traverse(obj => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
    },
  };
}
