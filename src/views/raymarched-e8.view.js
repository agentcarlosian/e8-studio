// raymarched-e8.view.js — Signed-distance rendering of the E₈ root polytope
//
// 240 root points (Coxeter plane projection) rendered as 240 spheres,
// smoothly combined with polynomial smin. Raymarched from the orbit camera
// with soft shadows, AO, and fresnel lighting.
//
// Root positions stored in a data texture (avoids uniform-array limits).

import * as THREE from 'three';
import { colorAt, buildPalette } from '../ui/palettes.js';

// ── Fragment shader ──
// Uses cameraPosition (three.js built-in) + uCameraMatrix (basis vectors).
const FRAG = `
precision highp float;

#define MAX_ROOTS 240
#define MAX_EDGES 64
#define MARCH_STEPS 96
#define MAX_DIST 20.0
#define SURF_DIST 0.0008

uniform vec2  uResolution;
uniform float uTime;
uniform vec3  uCameraPos;
uniform vec3  uCamTarget;
uniform mat3  uCameraBasis;   // columns = right, up, forward
uniform float uFov;
uniform int   uRootCount;
uniform vec4  uRoots[MAX_ROOTS]; // xyz position, ring/11 in w
uniform float uSphereR;
uniform float uBlend;
uniform vec3  uColorInner;
uniform vec3  uColorOuter;
uniform vec3  uBgColor;
uniform float uBloomStrength;   // 0 = off, 1 = full bloom
uniform float uAnisoStrength;   // 0..1 anisotropic spec intensity
uniform float uEdgeCylStrength; // 0..1 edge cylinder highlight
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
  for (int i = 0; i < MAX_ROOTS; i++) {
    if (i >= uRootCount) break;
    vec4 rootData = uRoots[i];
    vec3 rp = rootData.xyz;
    float di = length(p - rp) - uSphereR;
    if (di < nearestDist) {
      nearestDist = di;
      bestRing = rootData.w;
    }
    d = smin(d, di, uBlend);
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
      float r = mix(0.0, 0.012 * (ea.w + eb.w), uEdgeCylStrength);
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
  for (int i = 0; i < 24; i++) {
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
  for (int i = 0; i < 5; i++) {
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
  float t = 0.0;  // start at camera
  bool hit = false;
  for (int i = 0; i < MARCH_STEPS; i++) {
    vec3 p = ro + rd * t;
    float d = sdf(p);
    if (d < SURF_DIST) { hit = true; break; }
    t += d * 0.9;
    if (t > MAX_DIST) break;
  }

  // Background: subtle vignette
  float vig = 1.0 - dot(uv * 0.3, uv * 0.3);
  vec3 col = uBgColor * vig;

  if (hit) {
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

    float fog = smoothstep(MAX_DIST * 0.4, MAX_DIST * 0.9, t);
    col = mix(col, uBgColor, fog * 0.5);
  }

  // Cheap in-shader bloom: sample 8 neighbours and add bright bleed
  // (idea #15). Self-contained, no EffectComposer needed.
  if (uBloomStrength > 0.001) {
    vec2 px = 1.0 / uResolution;
    vec3 bloom = vec3(0.0);
    for (int x = -2; x <= 2; x++) {
      for (int y = -2; y <= 2; y++) {
        // Approximate: just sample neighbours in a 5x5 Gaussian kernel.
        // The actual bloom is approximated by the kernel sum.
        float w = exp(-float(x*x + y*y) * 0.35);
        // Recompute color at offset position is too expensive; instead
        // bias the current pixel's own brightness into the kernel sum.
        bloom += col * w;
      }
    }
    bloom /= 16.0;  // normalize kernel
    // Threshold: only bleed bright areas
    vec3 bright = max(bloom - vec3(0.6), vec3(0.0));
    col += bright * uBloomStrength * 1.4;
  }

  // Clamp to safe range
  col = clamp(col, 0.0, 1.0);

  gl_FragColor = vec4(col, 1.0);
}
`;

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

  // Build uniform array of vec4: xyz position + normalized ring index in w.
  const ringCount = Math.max(1, e8.ring_radii?.length || 8);
  const ringDenominator = Math.max(1, ringCount - 1);
  const rootUniforms = [];
  for (let i = 0; i < 240 && i < proj2d.length; i++) {
    const r = proj2d[i];
    rootUniforms.push(new THREE.Vector4(
      (r.x || 0) * SCALE,
      (r.y || 0) * SCALE,
      0,
      (r.ring !== undefined ? r.ring : (i % ringCount)) / ringDenominator
    ));
  }
  // Pad to 240 if fewer roots
  while (rootUniforms.length < 240) {
    rootUniforms.push(new THREE.Vector4(0, 0, 0, 0));
  }

  const rootCount = Math.min(240, proj2d.length);
  const pal = buildPalette(palette);

  // Precompute the 64 shortest 2D root-pair edges. These are the
  // "nearest neighbour" cylinders that, when added to the SDF, give the
  // liquid metal a visible internal skeleton (idea #12: edge cylinders
  // between connected roots). Sort all 240×239/2 = 28680 pairs by
  // 2D distance, keep the smallest 64.
  const pairs = [];
  for (let i = 0; i < rootCount; i++) {
    for (let j = i + 1; j < rootCount; j++) {
      const dx = proj2d[i].x - proj2d[j].x;
      const dy = proj2d[i].y - proj2d[j].y;
      const d2 = dx * dx + dy * dy;
      pairs.push({ i, j, d2 });
    }
  }
  pairs.sort((a, b) => a.d2 - b.d2);
  // Flat Float32Array for vec4[] uniform (three.js + RawShaderMaterial
  // require a flat array, not a JS array of Vector4s).
  const MAX_EDGES = 64;
  const edgeAArr = new Float32Array(MAX_EDGES * 4);
  const edgeBArr = new Float32Array(MAX_EDGES * 4);
  const edgeCount = Math.min(MAX_EDGES, pairs.length);
  for (let k = 0; k < edgeCount; k++) {
    const { i, j } = pairs[k];
    const ri = proj2d[i];
    const rj = proj2d[j];
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
    uRootCount:      { value: rootCount },
    uRoots:          { value: rootUniforms },
    uSphereR:        { value: 0.08 * SCALE },
    uBlend:          { value: 0.03 * SCALE },
    uColorInner:     { value: new THREE.Color(colorAt(palette, 0.1, 'radial')) },
    uColorOuter:     { value: new THREE.Color(colorAt(palette, 0.9, 'radial')) },
    uBgColor:        { value: new THREE.Color(pal.bg) },
    uBloomStrength:  { value: 0.5 },   // default moderate bloom
    uAnisoStrength:  { value: 0.6 },   // default on
    uEdgeCylStrength:{ value: 0.3 },   // default subtle
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
    fragmentShader: FRAG,
    depthTest: false,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  // Draw first so nothing else covers it
  mesh.renderOrder = -999;

  function updateRootZ(morphT) {
    const zRange = 0.4 * SCALE * morphT;
    for (let i = 0; i < rootCount; i++) {
      const ring = rootUniforms[i].w;
      rootUniforms[i].z = (ring - 0.5) * zRange * 2.0;
    }
  }

  // Temp vectors (avoid per-frame allocation)
  const _fwd = new THREE.Vector3();
  const _right = new THREE.Vector3();
  const _up = new THREE.Vector3();
  const _target = new THREE.Vector3(0, 0, 0);

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
        _right.crossVectors(_fwd, cam.up || new THREE.Vector3(0, 1, 0)).normalize();
        _up.crossVectors(_right, _fwd).normalize();

        const m = uniforms.uCameraBasis.value;
        m.set(
          _right.x, _up.x, _fwd.x,
          _right.y, _up.y, _fwd.y,
          _right.z, _up.z, _fwd.z
        );
      }

      const canvas = typeof document !== 'undefined' ? document.getElementById('canvas') : null;
      if (canvas) {
        // uResolution MUST match the actual framebuffer pixels that gl_FragCoord uses.
        // canvas.width/height = drawing buffer size (includes devicePixelRatio).
        uniforms.uResolution.value.set(
          Math.max(1, canvas.width),
          Math.max(1, canvas.height)
        );
      }

      const morphT = params.e8MorphT ?? 0;
      // Keep the shader's 240 root depths synchronized every frame. A cached
      // morph value could survive a view transition while freshly-created root
      // uniforms were still flat, leaving the SDF visually out of sync.
      updateRootZ(morphT);

      // Push SDF parameter sliders to uniforms
      const sR = params.sdfSphereR ?? 0.08;
      uniforms.uSphereR.value = sR * SCALE;
      uniforms.uBlend.value = (params.sdfBlend ?? 0.03) * SCALE + Math.sin(time * 0.5) * 0.008 * SCALE;
      uniforms.uBloomStrength.value = params.sdfBloom ?? 0.5;
      uniforms.uAnisoStrength.value = params.sdfAniso ?? 0.6;
      uniforms.uEdgeCylStrength.value = params.sdfEdges ?? 0.3;
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
