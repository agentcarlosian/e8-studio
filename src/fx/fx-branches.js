// fx-branches.js — GLSL code blocks for FX modes 11-20 (the "new" modes).
//
// Why this exists separately:
//   Each view in src/views/ defines its own custom vertex/fragment shader
//   inline (with bespoke varyings, uniforms, and per-view logic). To keep
//   the new FX modes (aura, voronoi, caustic, iridescent, flowfield, plasma,
//   kaleido6, dof, nebula, wireframe) working across every view without
//   duplicating the GLSL in seven files, we expose them as plain strings
//   that views can splice into their own shader source.
//
// Usage in a view's vertex shader (after the existing uFXMode branches):
//
//   import { fxVertexFXBranch } from '../fx/fx-branches.js';
//   vertexShader: `
//     ...existing vertex shader...
//     float scaleFX = ripple * spiral * pulseFX * edgeFX * ${fxVertexFXBranch(position, size)}
//     gl_PointSize = size * pulse * ... * scaleFX * uPixelRatio;
//   `
//
// Usage in a view's fragment shader:
//
//   import { fxFragmentFXBranch } from '../fx/fx-branches.js';
//   fragmentShader: `
//     ...existing fragment shader...
//     vec3 col = ...;
//     col = ${fxFragmentFXBranch(col, gl_PointCoord, vWorldPos, a)}
//     gl_FragColor = vec4(col, a * uOpacity);
//   `
//
// The branches all check `if (uFXMode == N)` so they compile in views that
// don't apply the mode. They use uniforms uFXMode, uFXIntensity, uTime,
// and rely on projectionMatrix / modelViewMatrix / modelMatrix being
// already-declared by the calling view.

/**
 * Vertex shader branches — return a string that updates the local `s`
 * variable (scale multiplier) and the local `a` variable (alpha modifier).
 * Caller is responsible for multiplying gl_PointSize by `s` and `gl_FragColor.a` by `a`.
 *
 * Inputs the calling shader must have in scope:
 *   - vec3 position (the vertex position)
 *   - varying vec3 vWorldPos (or equivalent — precomputed)
 *   - uniform int uFXMode, uniform float uFXIntensity, uniform float uTime
 */
export const VERTEX_FX_BRANCHES = /* glsl */`
  // ── New FX modes 11-20 — vertex stage ──
  float fxS = 1.0;
  float fxA = 1.0;
  vec3 fxO = vec3(0.0);
  if (uFXMode == 13) {
    vec3 p = position * 1.8 + vec3(0.0, 0.0, uTime * 0.6);
    float v1 = sin(p.x + sin(p.y * 2.0 + uTime));
    float v2 = sin(p.y * 1.3 + sin(p.z * 1.7 - uTime));
    float v3 = sin(p.z + cos(p.x * 1.1 + uTime * 0.8));
    fxS *= 1.0 + uFXIntensity * 0.5 * (v1 + v2 + v3) / 3.0;
  }
  if (uFXMode == 16) {
    float p = sin(position.x * 4.0 + uTime)
            + sin(position.y * 3.7 - uTime * 1.3)
            + sin(position.z * 4.3 + uTime * 0.9);
    fxS *= 1.0 + uFXIntensity * 0.25 * (p / 3.0);
  }
  if (uFXMode == 17) {
    float a6 = atan(position.y, position.x);
    float r6 = length(position.xy);
    fxS *= 1.0 + uFXIntensity * 0.35 * sin(a6 * 6.0 + uTime * 1.6) * smoothstep(0.0, 1.0, r6);
  }
  if (uFXMode == 18) {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float depth = -mv.z;
    fxS *= 1.0 + uFXIntensity * smoothstep(2.0, 12.0, depth) * 0.8;
  }
  if (uFXMode == 20) {
    float w = abs(sin(position.x * 6.0)) * abs(sin(position.y * 6.0)) * abs(sin(position.z * 6.0));
    fxS *= 1.0 + uFXIntensity * 0.6 * pow(w, 4.0);
  }
  if (uFXMode == 12) {
    vec3 p = position * 3.5;
    vec3 ip = floor(p);
    vec3 fp = fract(p);
    float minDist = 1.0;
    for (int z = -1; z <= 1; z++) {
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec3 nb = vec3(float(x), float(y), float(z));
          vec3 seed = nb + 0.5
            + 0.5 * vec3(
                sin(ip + nb).x,
                sin((ip + nb).y * 1.7),
                sin((ip + nb).z * 2.3)
              );
          float dd = length(seed - fp);
          minDist = min(minDist, dd);
        }
      }
    }
    fxA *= mix(1.0, minDist * 2.5, uFXIntensity);
  }
  if (uFXMode == 19) {
    float d = 0.5 + 0.5 * sin(position.x * 1.4 + uTime * 0.4)
                 * cos(position.y * 1.7 - uTime * 0.3)
                 * sin(position.z * 1.1 + uTime * 0.2);
    fxA *= mix(1.0, smoothstep(0.0, 0.7, d), uFXIntensity);
  }
  if (uFXMode == 15) {
    float t = uTime * 0.4;
    fxO.x += sin(position.y * 1.7 + t) * cos(position.z * 1.3 - t) * uFXIntensity * 0.3;
    fxO.y += sin(position.z * 1.5 - t) * cos(position.x * 1.9 + t * 0.7) * uFXIntensity * 0.3;
    fxO.z += sin(position.x * 1.1 + t * 0.9) * cos(position.y * 1.4 + t) * uFXIntensity * 0.3;
  }
  // ── Round 9 modes (vertex) ──
  if (uFXMode == 21) {
    // Hologram: vertical scanline breathing on size
    float scan = 0.5 + 0.5 * sin(position.y * 10.0 - uTime * 3.0);
    fxS *= 1.0 + uFXIntensity * 0.3 * scan;
  }
  if (uFXMode == 23) {
    // Crystal: subtle hexagonal faceting pulse
    float a = atan(position.y, position.x);
    fxS *= 1.0 + uFXIntensity * 0.18 * sin(a * 6.0 + uTime * 0.7);
  }
`;

/**
 * Fragment shader branches — takes a base color and mutates it.
 * Caller is responsible for assigning the return value back to the color.
 *
 * Inputs the calling shader must have in scope:
 *   - vec3 col (the current fragment color)
 *   - vec2 c (gl_PointCoord - 0.5 — local radial coords inside the point sprite)
 *   - varying vec3 vWorldPos (world-space point position)
 *   - uniform int uFXMode, uniform float uFXIntensity, uniform float uTime
 *   - uniform mat4 projectionMatrix, modelViewMatrix (for dof/edge-glow depth)
 */
export const FRAGMENT_FX_BRANCHES = /* glsl */`
  // ── New FX modes 11-20 — fragment stage ──
  // fxA defaults to 1.0; vertex branches (12, 19) may write to it via fxAlpha.
  // Declaring it here so callers that only inject fragment branches still compile.
  float fxA = 1.0;
  if (uFXMode == 11) {
    float rim = pow(length(c), 2.0);
    col += vec3(0.9, 0.85, 1.0) * rim * uFXIntensity * 1.6;
  }
  if (uFXMode == 12) {
    vec3 p = vWorldPos * 3.5;
    vec3 ip = floor(p);
    vec3 fp = fract(p);
    float minDist = 1.0;
    vec3 cellCenter = vec3(0.0);
    for (int z = -1; z <= 1; z++) {
      for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
          vec3 nb = vec3(float(x), float(y), float(z));
          vec3 seed = nb + 0.5
            + 0.5 * vec3(
                sin(ip + nb).x,
                sin((ip + nb).y * 1.7),
                sin((ip + nb).z * 2.3)
              );
          float dd = length(seed - fp);
          if (dd < minDist) {
            minDist = dd;
            cellCenter = ip + nb;
          }
        }
      }
    }
    vec3 tint = 0.5 + 0.5 * cos(6.2831 * (cellCenter * 0.18 + vec3(0.0, 0.33, 0.67)));
    col = mix(col, col * tint * 1.6, uFXIntensity);
  }
  if (uFXMode == 13) {
    vec3 p = vWorldPos * 1.8 + vec3(0.0, 0.0, uTime * 0.6);
    float cc = 0.5 + 0.5 * sin(p.x * 3.0 + sin(p.y * 2.0 + uTime));
    cc += 0.5 + 0.5 * sin(p.y * 3.7 + sin(p.z * 2.5 - uTime));
    cc += 0.5 + 0.5 * sin(p.z * 4.1 + sin(p.x * 2.0 + uTime * 0.7));
    cc /= 3.0;
    vec3 caust = mix(vec3(0.2, 0.6, 1.0), vec3(1.0, 0.8, 0.4), cc);
    float dd = length(c);
    col = mix(col, col + caust * 0.8, uFXIntensity * smoothstep(0.5, 0.0, dd));
  }
  if (uFXMode == 14) {
    float ang = atan(c.y, c.x);
    float h = fract(ang / 6.2831 + uTime * 0.1 + length(c) * 1.5);
    vec3 irid = 0.5 + 0.5 * cos(6.2831 * (h + vec3(0.0, 0.33, 0.67)));
    col = mix(col, col * irid * 1.5, uFXIntensity * (1.0 - length(c)));
  }
  if (uFXMode == 15) {
    float t = uTime * 0.4;
    vec3 dir = vec3(
      sin(vWorldPos.y * 1.7 + t) * cos(vWorldPos.z * 1.3 - t),
      sin(vWorldPos.z * 1.5 - t) * cos(vWorldPos.x * 1.9 + t * 0.7),
      sin(vWorldPos.x * 1.1 + t * 0.9) * cos(vWorldPos.y * 1.4 + t)
    );
    float m = length(dir);
    vec3 flowTint = 0.5 + 0.5 * dir / max(m, 0.001);
    col = mix(col, col * (0.4 + flowTint) * 1.5, uFXIntensity);
  }
  if (uFXMode == 16) {
    float p = sin(vWorldPos.x * 4.0 + uTime)
            + sin(vWorldPos.y * 3.7 - uTime * 1.3)
            + sin(vWorldPos.z * 4.3 + uTime * 0.9);
    p = p / 3.0 * 0.5 + 0.5;
    vec3 plas = 0.5 + 0.5 * cos(6.2831 * (p + vec3(0.0, 0.33, 0.67)));
    col = mix(col, col * plas * 1.4, uFXIntensity);
  }
  if (uFXMode == 17) {
    float ang = atan(c.y, c.x);
    float ang6 = mod(ang, 6.2831 / 6.0);
    float h = fract(ang6 / (6.2831 / 6.0) + uTime * 0.15);
    vec3 k6 = 0.5 + 0.5 * cos(6.2831 * (h + vec3(0.0, 0.33, 0.67)));
    col = mix(col, col * k6 * 1.4, uFXIntensity * (1.0 - length(c)));
  }
  if (uFXMode == 18) {
    // DOF: tint near and far with bokeh-like color shift — depth is approximated
    // from the world-space radius (no modelViewMatrix available in fragment)
    float depth = length(vWorldPos) * 2.0 + 4.0;
    float near = smoothstep(0.5, 2.0, depth);
    float far = smoothstep(6.0, 14.0, depth);
    vec3 warmBokeh = vec3(1.0, 0.85, 0.6);
    vec3 coolBokeh = vec3(0.6, 0.75, 1.0);
    vec3 bokeh = mix(warmBokeh, coolBokeh, far);
    col = mix(col, col * (1.0 + bokeh * 0.5), uFXIntensity * max(near, far));
  }
  if (uFXMode == 19) {
    float dd = 0.5 + 0.5 * sin(vWorldPos.x * 1.4 + uTime * 0.4)
                   * cos(vWorldPos.y * 1.7 - uTime * 0.3)
                   * sin(vWorldPos.z * 1.1 + uTime * 0.2);
    vec3 gasWarm = vec3(1.0, 0.55, 0.2);
    vec3 gasCool = vec3(0.3, 0.55, 1.0);
    vec3 gas = mix(gasCool, gasWarm, smoothstep(-0.5, 0.5, dd));
    col = mix(col, col * (1.0 + gas), uFXIntensity * smoothstep(0.0, 0.7, dd));
  }
  if (uFXMode == 20) {
    float hLine = abs(sin(vWorldPos.x * 6.0 + vWorldPos.y * 6.0));
    float vLine = abs(sin(vWorldPos.x * 6.0 - vWorldPos.z * 6.0));
    float wires = smoothstep(0.95, 1.0, max(hLine, vLine));
    col = mix(col, vec3(1.0, 0.95, 0.85), uFXIntensity * wires);
  }
  // ── Round 9 modes (fragment) ──
  if (uFXMode == 21) {
    // Hologram: cyan scanlines + flicker + rim glow
    float scan = 0.5 + 0.5 * sin(vWorldPos.y * 28.0 - uTime * 6.0);
    float flicker = 0.85 + 0.15 * sin(uTime * 23.0) * sin(uTime * 7.0);
    vec3 holo = vec3(0.2, 0.9, 1.0);
    col = mix(col, col * holo * (0.6 + 0.4 * scan) * flicker + holo * 0.15 * (1.0 - length(c)), uFXIntensity);
    col *= 0.7 + 0.3 * scan;
  }
  if (uFXMode == 22) {
    // X-ray: bright thin rims, dark cores
    float rim = smoothstep(0.2, 0.5, length(c));
    vec3 xrayCol = vec3(0.4, 1.0, 0.9) * pow(rim, 1.5) * 1.8;
    col = mix(col, xrayCol + col * 0.15 * (1.0 - rim), uFXIntensity);
  }
  if (uFXMode == 23) {
    // Crystal: faceted prismatic refraction with hex edges
    float a = atan(c.y, c.x);
    float band = fract(a * 0.955 / 6.2831 + length(c) * 4.0 + uTime * 0.12);
    vec3 prism = 0.5 + 0.5 * cos(6.2831 * (band + vec3(0.0, 0.33, 0.67)));
    float hexEdge = smoothstep(0.92, 1.0, abs(sin(a * 6.0)));
    col = mix(col, col * prism * 1.5 + vec3(1.0) * hexEdge * 0.3, uFXIntensity * (1.0 - length(c) * 0.5));
  }
`;
