// raymarched-e8.view.js — Signed-distance rendering of the E₈ root polytope
//
// 240 root points (Coxeter plane projection) rendered as 240 spheres,
// smoothly combined with polynomial smin. Raymarched from the orbit camera
// with soft shadows, AO, and fresnel lighting.
//
// The Coxeter projection is exactly eight regular 30-point rings. Encoding the
// radius/phase/step of each ring lets the shader recover nearby root positions
// without scanning all 240 roots for every ray step.

import * as THREE from 'three';
import { colorAt, buildPalette } from '../ui/palettes.js';
import { effectsForView } from '../fx/fx-catalog.js';

// ── Fragment shader ──
// Uses cameraPosition (three.js built-in) + uCameraMatrix (basis vectors).
const FRAG_TEMPLATE = `
precision highp float;

#define MAX_RINGS __MAX_RINGS__
#define MAX_EDGES __MAX_EDGES__
#define ROOT_NEIGHBOR_SPAN __ROOT_NEIGHBOR_SPAN__
#define MARCH_STEPS __MARCH_STEPS__
#define SHADOW_STEPS __SHADOW_STEPS__
#define AO_STEPS __AO_STEPS__
#define MAX_DIST 20.0
#define SURF_DIST 0.0008

uniform vec2  uResolution;
uniform float uTime;
uniform vec3  uCameraPos;
uniform vec3  uCamTarget;
uniform mat3  uCameraBasis;   // columns = right, up, forward
uniform float uFov;
uniform int   uRingCount;
uniform vec4  uRings[MAX_RINGS]; // radius, phase, angular step, z depth
uniform float uSphereR;
uniform float uBlend;
uniform vec3  uColorInner;
uniform vec3  uColorOuter;
uniform vec3  uBgColor;
uniform float uBloomStrength;   // 0 = off, 1 = full bloom
uniform float uAnisoStrength;   // 0..1 anisotropic spec intensity
uniform float uEdgeCylStrength; // 0..1 edge cylinder highlight
uniform int   uFXMode;          // shared catalog ID; SDF implements a curated subset
uniform float uFXIntensity;     // 0..1 native SDF look strength
uniform int   uEdgeCount;
uniform vec4  uEdgesA[MAX_EDGES]; // xyz endpoint + radius-weight in w
uniform vec4  uEdgesB[MAX_EDGES];

float gNearestRing = 0.0;

float smin(float a, float b, float k) {
  // Guard k: uSdfBlend (the blend slider) bottoms out at 0, and (b-a)/0 is NaN
  // when the two distances coincide — which poisons the whole raymarch. At k≈0
  // the intended behaviour is a hard min anyway.
  if (k < 1e-5) return min(a, b);
  float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
  return mix(b, a, h) - k * h * (1.0 - h);
}

// Cylinder SDF between two 3D points, radius r. Used for "edge cylinders"
// between connected E₈ root pairs (idea #12: visual structure between
// nearby roots without rendering a full mesh).
float sdCappedCylinder(vec3 p, vec3 a, vec3 b, float r) {
  vec3 ba = b - a;
  vec3 pa = p - a;
  float t = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
  return length(pa - ba * t) - r;
}

float sdf(vec3 p) {
  float d = 1e9;
  float bestRing = 0.0;
  float nearestDist = 1e9;
  float sphereRadius = uSphereR;
  if (uFXMode == 6) {
    // Native SDF Pulse: alter the implicit surface itself. The positive base
    // keeps the effect visible even when the time wave crosses zero.
    sphereRadius *= 1.0 + uFXIntensity * (0.12 + 0.08 * sin(uTime * 2.1));
  }
  float pointAngle = atan(p.y, p.x);
  for (int i = 0; i < MAX_RINGS; i++) {
    if (i >= uRingCount) break;
    vec4 ring = uRings[i];
    float nearestSlot = floor((pointAngle - ring.y) / ring.z + 0.5);
    for (int offset = -ROOT_NEIGHBOR_SPAN; offset <= ROOT_NEIGHBOR_SPAN; offset++) {
      float rootAngle = ring.y + (nearestSlot + float(offset)) * ring.z;
      vec3 rp = vec3(ring.x * cos(rootAngle), ring.x * sin(rootAngle), ring.w);
      float di = length(p - rp) - sphereRadius;
      if (di < nearestDist) {
        nearestDist = di;
        bestRing = float(i) / max(1.0, float(uRingCount - 1));
      }
      d = smin(d, di, uBlend);
    }
  }
  // Edge cylinders: only for "nearby" pairs (cheap heuristic — only the
  // 28 closest pairs of the 240 roots by 2D distance). Stored in a
  // precomputed list built in JS; we sample a small fixed budget here.
  // EdgeCylStrength=0 disables this loop entirely.
  if (uEdgeCylStrength > 0.001) {
    for (int i = 0; i < MAX_EDGES; i++) {
      if (i >= uEdgeCount) break;
      vec4 ea = uEdgesA[i];
      vec4 eb = uEdgesB[i];
      vec3 a = ea.xyz;
      vec3 b = eb.xyz;
      float r = 0.024 * uEdgeCylStrength;
      float dc = sdCappedCylinder(p, a, b, r);
      d = smin(d, dc, uBlend * 0.5);
    }
  }
  gNearestRing = bestRing;
  return d;
}

vec3 calcNormal(vec3 p) {
  const float eps = 0.001;
  const vec2 h = vec2(1.0, -1.0) * 0.5773;
  return normalize(
    h.xyy * sdf(p + h.xyy * eps) +
    h.yyx * sdf(p + h.yyx * eps) +
    h.yxy * sdf(p + h.yxy * eps) +
    h.xxx * sdf(p + h.xxx * eps)
  );
}

float softShadow(vec3 ro, vec3 rd, float mint, float maxt) {
  float res = 1.0;
  float t = mint;
  for (int i = 0; i < SHADOW_STEPS; i++) {
    float h = sdf(ro + rd * t);
    if (h < 0.001) return 0.0;
    res = min(res, 16.0 * h / t);
    t += clamp(h, 0.02, 0.3);
    if (t > maxt) break;
  }
  return clamp(res, 0.0, 1.0);
}

float calcAO(vec3 p, vec3 n) {
  float occ = 0.0;
  float sca = 1.0;
  for (int i = 0; i < AO_STEPS; i++) {
    float hr = 0.02 + 0.12 * float(i);
    float dd = sdf(p + n * hr);
    occ += (hr - dd) * sca;
    sca *= 0.7;
  }
  return clamp(1.0 - 2.5 * occ, 0.0, 1.0);
}

void main() {
  // Proper perspective ray generation from the orbit camera.
  // uCameraBasis columns = [right, up, forward] in world-space.
  vec2 uv = (gl_FragCoord.xy / uResolution.xy) * 2.0 - 1.0;
  uv.x *= uResolution.x / uResolution.y;

  vec3 ro = uCameraPos;
  float focalLength = 1.0 / tan(uFov * 0.5);
  // Column 0 = right, Column 1 = up, Column 2 = forward
  vec3 rd = normalize(uCameraBasis[0] * uv.x + uCameraBasis[1] * uv.y + uCameraBasis[2] * focalLength);

  // Raymarch
  float t = 0.0;
  float rayEnd = 0.0;
  bool hit = false;
  // All eight rings, their maximum extrusion, and the largest sphere/blend
  // fit inside this conservative bound. Most screen rays miss it entirely, so
  // avoid running the SDF loop for background pixels.
  const float boundRadius = 2.6;
  float boundB = dot(ro, rd);
  float boundC = dot(ro, ro) - boundRadius * boundRadius;
  float boundHit = boundB * boundB - boundC;
  if (boundHit >= 0.0) {
    float boundRoot = sqrt(boundHit);
    t = max(0.0, -boundB - boundRoot);
    rayEnd = min(MAX_DIST, -boundB + boundRoot);
    for (int i = 0; i < MARCH_STEPS; i++) {
      vec3 p = ro + rd * t;
      float d = sdf(p);
      if (d < SURF_DIST) { hit = true; break; }
      t += d * 0.9;
      if (t > rayEnd) break;
    }
  }

  // Missed rays remain transparent so the shared Environment renderer is
  // visible behind the SDF. Previously this painted uBgColor over the full
  // canvas, which made every non-Void environment appear to do nothing.
  vec3 col = vec3(0.0);
  float alpha = 0.0;

  if (hit) {
    alpha = 1.0;
    vec3 p = ro + rd * t;
    vec3 n = calcNormal(p);

    vec3 keyDir  = normalize(vec3( 0.6,  0.7,  0.5));
    vec3 fillDir = normalize(vec3(-0.4,  0.2, -0.3));

    float diff = max(dot(n, keyDir), 0.0);
    float fill = max(dot(n, fillDir), 0.0) * 0.3;
    float fresnel = pow(1.0 - max(dot(n, -rd), 0.0), 3.0);

    // Soft-shadow visibility is also reused by the optional cool tint below.
    float shadow = softShadow(p + n * 0.003, keyDir, 0.02, 4.0);

    // AO boost at ring intersections (idea #20): sample AO more deeply.
    float ao = calcAO(p, n);
    // Extra "crease" term — where two rings meet, surface is in a dip
    float crease = pow(1.0 - ao, 1.5) * 0.35;
    ao = clamp(ao - crease, 0.0, 1.0);

    vec3 baseCol = mix(uColorInner, uColorOuter, gNearestRing);
    float wrap = max(0.0, (dot(n, keyDir) + 0.3) / 1.3);

    col = baseCol * (diff * shadow * 0.85 + fill + 0.15) * ao;
    col += baseCol * wrap * 0.25;
    col += vec3(0.6, 0.7, 1.0) * fresnel * 0.4 * shadow;
    col += baseCol * fresnel * 0.3;

    // Specular — standard + anisotropic (idea #19). Anisotropy stretches
    // the highlight along the local "grain" (approximated as the world
    // up axis blended with the normal). Gives streakier, more metallic
    // reflections on the spheres.
    vec3 sh = normalize(keyDir - rd);
    float specStd = pow(max(dot(n, sh), 0.0), 32.0);
    // Anisotropic: stretch spec exponent by mixing T and B tangents
    vec3 T = normalize(cross(n, vec3(0.0, 1.0, 0.0)) + vec3(0.001));
    vec3 B = normalize(cross(n, T));
    float anisoT = pow(max(dot(T, sh), 0.0), 24.0);
    float anisoB = pow(max(dot(B, sh), 0.0), 80.0);
    float specAniso = (anisoT * 0.6 + anisoB * 0.4) * uAnisoStrength;
    col += vec3(1.0) * specStd * shadow * 0.5;
    col += vec3(1.0, 0.95, 0.85) * specAniso * shadow * 0.7;

    // Native raymarched looks. These deliberately use the shared catalog IDs,
    // but their semantics are surface-native rather than copied from the point
    // shaders. Each branch is constant-cost and safe on the Low tier.
    if (uFXMode == 1) {
      // Glow: emissive surface plus a strong Fresnel rim.
      vec3 emission = mix(baseCol, vec3(1.0), 0.35);
      col += emission * uFXIntensity * (0.16 + fresnel * 0.95);
    }
    if (uFXMode == 9) {
      // Heat: warm bands flow across ring depth and world-space height.
      float heatBand = 0.5 + 0.5 * sin(gNearestRing * 13.0 + p.y * 3.2 - uTime * 1.4);
      vec3 heatCol = mix(vec3(0.16, 0.005, 0.002), vec3(1.0, 0.82, 0.12), heatBand);
      col = mix(col, heatCol * (0.42 + diff * 0.75 + fresnel * 0.55), uFXIntensity * 0.86);
    }
    if (uFXMode == 14) {
      // Iridescent: inexpensive thin-film approximation from view angle.
      float film = dot(n, -rd) * 1.8 + gNearestRing * 0.72 + uTime * 0.08;
      vec3 prism = 0.52 + 0.48 * cos(6.28318 * (film + vec3(0.00, 0.33, 0.67)));
      col = mix(col, prism * (0.38 + diff * 0.62 + fresnel * 0.9), uFXIntensity * 0.82);
    }
    if (uFXMode == 21) {
      // Hologram: scanlines and subtle digital flicker without a post pass.
      float scan = 0.62 + 0.38 * sin(gl_FragCoord.y * 0.34 - uTime * 5.0);
      float flicker = 0.92 + 0.08 * sin(uTime * 17.0 + p.x * 5.0);
      vec3 holo = vec3(0.04, 0.82, 1.0) * (0.32 + fresnel * 1.25 + diff * 0.42) * scan * flicker;
      col = mix(col, holo, uFXIntensity * 0.9);
    }
    if (uFXMode == 22) {
      // X-ray: suppress the interior lighting and retain a cool silhouette.
      float rim = smoothstep(0.04, 0.88, fresnel);
      vec3 xray = vec3(0.02, 0.16, 0.24) + vec3(0.18, 0.82, 1.0) * (rim * 1.45 + (1.0 - ao) * 0.35);
      col = mix(col, xray, uFXIntensity * 0.9);
    }

    float fog = smoothstep(MAX_DIST * 0.4, MAX_DIST * 0.9, t);
    col = mix(col, uBgColor, fog * 0.5);
  }

  // The previous "bloom" loop added the current pixel to itself 25 times; it
  // never sampled a neighbour. This equivalent highlight bloom avoids that
  // fixed per-pixel loop while retaining the luminous response.
  if (hit && uBloomStrength > 0.001) {
    vec3 bright = max(col - vec3(0.68), vec3(0.0));
    col += bright * uBloomStrength * 0.9;
  }

  // Clamp to safe range
  col = clamp(col, 0.0, 1.0);

  gl_FragColor = vec4(col, alpha);
}
`;

export function sdfQualityProfile(context = {}) {
  const params = context.params || {};
  const nav = typeof navigator !== 'undefined' ? navigator : {};
  const device = context.device || {};
  const forced = typeof window !== 'undefined' && window.__forceSdfSafeMode === true;
  const memory = Number(device.deviceMemory ?? nav.deviceMemory);
  const cores = Number(device.hardwareConcurrency ?? nav.hardwareConcurrency);
  const touchPoints = Number(device.maxTouchPoints ?? nav.maxTouchPoints);
  const viewportWidth = Number(device.viewportWidth
    ?? (typeof window !== 'undefined' ? window.innerWidth : 0));
  const brave = Boolean(device.brave ?? nav.brave);
  const constrained = (memory > 0 && memory <= 6) || (cores > 0 && cores <= 6);
  const compactTouch = touchPoints > 0 && viewportWidth > 0 && viewportWidth <= 900;
  const lowQuality = params.reducedMode || params.mobileQuality === 'low';
  const balanced = brave || constrained || compactTouch
    || params.mobileQuality === 'medium' || params.mobileQuality === 'auto';
  if (forced || lowQuality) {
    return {
      tier: 'low', safe: true, rootNeighborSpan: 0, maxEdges: 1,
      edgeLimit: 0, marchSteps: 36, shadowSteps: 0, aoSteps: 0,
    };
  }
  if (balanced) {
    return {
      tier: 'balanced', safe: true, rootNeighborSpan: 1, maxEdges: 12,
      edgeLimit: 12, marchSteps: 48, shadowSteps: 4, aoSteps: 1,
    };
  }
  return {
    tier: 'high', safe: false, rootNeighborSpan: 2, maxEdges: 28,
    edgeLimit: 28, marchSteps: 64, shadowSteps: 8, aoSteps: 2,
  };
}

function fragmentShaderFor(profile, ringCount) {
  return FRAG_TEMPLATE
    .replaceAll('__MAX_RINGS__', String(Math.max(1, ringCount)))
    .replaceAll('__MAX_EDGES__', String(profile.maxEdges))
    .replaceAll('__ROOT_NEIGHBOR_SPAN__', String(profile.rootNeighborSpan))
    .replaceAll('__MARCH_STEPS__', String(profile.marchSteps))
    .replaceAll('__SHADOW_STEPS__', String(profile.shadowSteps))
    .replaceAll('__AO_STEPS__', String(profile.aoSteps));
}

export function buildSdfRingLayout(e8, scale = 1) {
  const points = Array.isArray(e8?.proj2d) ? e8.proj2d : [];
  const byRing = new Map();
  for (const point of points) {
    const ringId = Number.isInteger(point.ring) ? point.ring : 0;
    if (!byRing.has(ringId)) byRing.set(ringId, []);
    byRing.get(ringId).push(point);
  }
  const rings = [...byRing.entries()]
    .sort(([a], [b]) => a - b)
    .map(([id, ringPoints]) => {
      const count = ringPoints.length;
      const radius = ringPoints.reduce(
        (sum, point) => sum + Math.hypot(Number(point.x) || 0, Number(point.y) || 0),
        0
      ) / Math.max(1, count);
      const first = ringPoints[0] || { x: 1, y: 0 };
      return {
        id,
        count,
        radius: radius * scale,
        phase: Math.atan2(Number(first.y) || 0, Number(first.x) || 0),
        step: (Math.PI * 2) / Math.max(1, count),
      };
    });
  return { rings, rootCount: points.length };
}

const VERT = `
attribute vec3 position;
void main() {
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

export function createRaymarchedView({ data, palette, scale: baseScale, context = {} }) {
  const e8 = data.e8 || data;
  const proj2d = e8.proj2d || [];
  const SCALE = baseScale || 1.6;
  const quality = sdfQualityProfile(context);

  const ringLayout = buildSdfRingLayout(e8, SCALE);
  const ringUniforms = ringLayout.rings.map(
    ring => new THREE.Vector4(ring.radius, ring.phase, ring.step, 0)
  );
  const ringCount = ringUniforms.length;
  const rootCount = ringLayout.rootCount;
  const pal = buildPalette(palette);

  // Precompute the shortest 2D root-pair edges up to the active quality budget.
  // These are the
  // "nearest neighbour" cylinders that, when added to the SDF, give the
  // liquid metal a visible internal skeleton (idea #12: edge cylinders
  // between connected roots). Sort all 240×239/2 = 28680 pairs by
  // 2D distance, keeping only the tier's small fixed budget.
  const pairs = [];
  for (let i = 0; i < rootCount; i++) {
    for (let j = i + 1; j < rootCount; j++) {
      const a = proj2d[i];
      const b = proj2d[j];
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d2 = dx * dx + dy * dy;
      pairs.push({ i, j, d2 });
    }
  }
  pairs.sort((a, b) => a.d2 - b.d2);
  // Flat Float32Array for vec4[] uniform (three.js + RawShaderMaterial
  // require a flat array, not a JS array of Vector4s).
  const MAX_EDGES = quality.maxEdges;
  const edgeAArr = new Float32Array(MAX_EDGES * 4);
  const edgeBArr = new Float32Array(MAX_EDGES * 4);
  const edgeCount = Math.min(quality.edgeLimit, pairs.length);
  const edgeRingPairs = [];
  for (let k = 0; k < edgeCount; k++) {
    const { i, j } = pairs[k];
    const ri = proj2d[i];
    const rj = proj2d[j];
    edgeRingPairs.push([ri.ring || 0, rj.ring || 0]);
    edgeAArr[k*4]     = ri.x * SCALE;
    edgeAArr[k*4 + 1] = ri.y * SCALE;
    edgeAArr[k*4 + 2] = 0;
    edgeAArr[k*4 + 3] = 1.0;
    edgeBArr[k*4]     = rj.x * SCALE;
    edgeBArr[k*4 + 1] = rj.y * SCALE;
    edgeBArr[k*4 + 2] = 0;
    edgeBArr[k*4 + 3] = 1.0;
  }

  const uniforms = {
    uResolution:     { value: new THREE.Vector2(800, 600) },
    uTime:           { value: 0 },
    uCameraPos:      { value: new THREE.Vector3(0, 0, 4) },
    uCamTarget:      { value: new THREE.Vector3(0, 0, 0) },
    uCameraBasis:    { value: new THREE.Matrix3() },
    uFov:            { value: Math.PI / 4 },
    uRingCount:      { value: ringCount },
    uRings:          { value: ringUniforms },
    uSphereR:        { value: 0.08 * SCALE },
    uBlend:          { value: 0.03 * SCALE },
    uColorInner:     { value: new THREE.Color(colorAt(palette, 0.1, 'radial')) },
    uColorOuter:     { value: new THREE.Color(colorAt(palette, 0.9, 'radial')) },
    uBgColor:        { value: new THREE.Color(pal.bg) },
    uBloomStrength:  { value: 0.5 },   // default moderate bloom
    uAnisoStrength:  { value: 0.6 },   // default on
    uEdgeCylStrength:{ value: 0.3 },   // default subtle
    uFXMode:         { value: 0 },
    uFXIntensity:    { value: 0.5 },
    uEdgeCount:      { value: edgeCount },
    uEdgesA:         { value: edgeAArr },
    uEdgesB:         { value: edgeBArr },
  };

  // RawShaderMaterial: we declare all attributes/uniforms ourselves.
  // ShaderMaterial prepends built-in declarations that conflict with our
  // custom fullscreen-quad vertex shader.
  const geo = new THREE.PlaneGeometry(2, 2);
  const mat = new THREE.RawShaderMaterial({
    uniforms,
    vertexShader: VERT,
    fragmentShader: fragmentShaderFor(quality, ringCount),
    depthTest: false,
    depthWrite: false,
    transparent: true,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mat.userData.sdfQuality = {
    ...quality,
    ringCount,
    representedRoots: rootCount,
    sampledRootsPerSdf: ringCount * (quality.rootNeighborSpan * 2 + 1),
    edgeCount,
  };
  mat.userData.effectModes = effectsForView(
    'raymarched',
    quality.tier === 'balanced' ? 'medium' : quality.tier
  ).map(item => item.id);
  mesh.frustumCulled = false;
  // Draw first so nothing else covers it
  mesh.renderOrder = -999;

  function updateRootZ(morphT) {
    const zRange = 0.4 * SCALE * morphT;
    const denominator = Math.max(1, ringCount - 1);
    for (let i = 0; i < ringCount; i++) {
      const normalizedRing = i / denominator;
      ringUniforms[i].w = (normalizedRing - 0.5) * zRange * 2.0;
    }
    for (let i = 0; i < edgeCount; i++) {
      const [ringA, ringB] = edgeRingPairs[i];
      edgeAArr[i * 4 + 2] = (ringA / denominator - 0.5) * zRange * 2.0;
      edgeBArr[i * 4 + 2] = (ringB / denominator - 0.5) * zRange * 2.0;
    }
  }

  // Temp vectors (avoid per-frame allocation)
  const _fwd = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _up = new THREE.Vector3();
  const _target = new THREE.Vector3(0, 0, 0);
  const _defaultUp = new THREE.Vector3(0, 1, 0);
  const canvas = context.renderer?.domElement
    || (typeof document !== 'undefined' ? document.getElementById('canvas') : null);
  let lastCanvasWidth = 0;
  let lastCanvasHeight = 0;
  let lastMorphT = Number.NaN;

  return {
    group: mesh,
    object3d: mesh,
    name: 'raymarchedE8',
    update(dt, time, params) {
      uniforms.uTime.value = time;

      const cam = context.camera || (typeof window !== 'undefined' ? window.__app?.camera : null);
      if (cam) {
        uniforms.uCameraPos.value.copy(cam.position);
        uniforms.uFov.value = cam.fov ? cam.fov * Math.PI / 180 : Math.PI / 4;

        // Build camera basis: columns = [right, up, forward]
        // forward points from camera toward the look-at target
        _fwd.subVectors(_target, cam.position).normalize();
        _right.crossVectors(_fwd, cam.up || _defaultUp).normalize();
        _up.crossVectors(_right, _fwd).normalize();

        const m = uniforms.uCameraBasis.value;
        m.set(
          _right.x, _up.x, _fwd.x,
          _right.y, _up.y, _fwd.y,
          _right.z, _up.z, _fwd.z
        );
      }

      if (canvas && (canvas.width !== lastCanvasWidth || canvas.height !== lastCanvasHeight)) {
        // uResolution MUST match the actual framebuffer pixels that gl_FragCoord uses.
        // canvas.width/height = drawing buffer size (includes devicePixelRatio).
        lastCanvasWidth = canvas.width;
        lastCanvasHeight = canvas.height;
        uniforms.uResolution.value.set(Math.max(1, canvas.width), Math.max(1, canvas.height));
      }

      const morphT = params.e8MorphT ?? 0;
      // Ring and edge depths only change when the morph control changes.
      if (morphT !== lastMorphT) {
        lastMorphT = morphT;
        updateRootZ(morphT);
      }

      // Push SDF parameter sliders to uniforms
      const sR = params.sdfSphereR ?? 0.08;
      uniforms.uSphereR.value = sR * SCALE;
      uniforms.uBlend.value = (params.sdfBlend ?? 0.03) * SCALE + Math.sin(time * 0.5) * 0.008 * SCALE;
      uniforms.uBloomStrength.value = quality.safe ? Math.min(params.sdfBloom ?? 0.5, 0.35) : (params.sdfBloom ?? 0.5);
      uniforms.uAnisoStrength.value = params.sdfAniso ?? 0.6;
      uniforms.uEdgeCylStrength.value = edgeCount === 0
        ? 0
        : (quality.safe ? Math.min(params.sdfEdges ?? 0.3, 0.2) : (params.sdfEdges ?? 0.3));
    },
    onPaletteChange(palName) {
      const newPal = buildPalette(palName);
      uniforms.uColorInner.value.set(colorAt(palName, 0.1, 'radial'));
      uniforms.uColorOuter.value.set(colorAt(palName, 0.9, 'radial'));
      uniforms.uBgColor.value.set(newPal.bg);
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
