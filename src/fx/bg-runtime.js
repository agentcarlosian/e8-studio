// bg-runtime.js — Centralized background system: full-screen quad with 8 shader moods.
//
// Why this exists:
//   - Current background is just `scene.background = Color(0x07070c)` plus an
//     optional starfield Group.
//   - This module replaces both with one full-screen quad whose fragment shader
//     is swapped per "mood". View-agnostic — every view benefits without code
//     changes.
//
// Moods (mirrored in src/ui/panel.js BG array):
//   0 = void       — flat color (matches old default)
//   1 = starfield  — promoted from existing 800-star twinkle shader
//   2 = milkyway   — banded dust + soft glow (Milky-Way style)
//   3 = cosmos     — multi-layer stars + nebula gas
//   4 = aurora     — slow aurora curtains across top
//   5 = mandala    — kaleidoscopic background that responds to view
//   6 = grid       — Tron-style receding grid (good for technical aesthetic)
//   7 = plasma     — full-screen plasma field (cosmetic only)
//
// Usage:
//   import { BGRuntime } from './fx/bg-runtime.js';
//   const bg = new BGRuntime(scene, camera);
//   bg.setMode('milkyway');
//   bg.setIntensity(0.7);
//   bg.update(time, renderer);  // call each frame

import * as THREE from 'three';
import { BG_MODES } from '../ui/backgrounds.js';
export { BG_MODES };

const VOID_FS = /* glsl */`
  uniform vec3 uColor;
  uniform vec2 uTexSize;
  void main() { gl_FragColor = vec4(uColor, 1.0); }
`;

const STARFIELD_FS = /* glsl */`
  // Procedural twinkling starfield — hashed points on a sphere.
  // Round 11 fix: was nearly invisible. The star radius had a *0.01 that made
  // every star sub-pixel; bumped base sizes and added a faint nebula wash so
  // the field reads as a real starfield, not a black void.
  uniform float uTime;
  uniform float uIntensity;
  uniform float uAspect;
  uniform vec2 uTexSize;       // canvas width / height
  uniform float uSeed;         // variation seed
  uniform vec3 uTint;
  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float hash2(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  // Build a star field as a layer of 3D hash grids
  float starLayer(vec2 uv, float scale, float seed) {
    vec2 p = uv * scale;
    vec2 ip = floor(p);
    vec2 fp = fract(p);
    float bright = 0.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 nb = vec2(float(i), float(j));
        vec3 cell = vec3(ip + nb, seed);
        // Per-component construction — GLSL doesn't auto-promote vec2 to vec3
        // when mixed with vec3 in a single expression. (Bug found 2026-06-24.)
        vec3 c = vec3(
          nb.x + 0.5 + 0.4 * hash(cell)        - 0.2,
          nb.y + 0.5 + 0.4 * hash(cell + 1.7)  - 0.2,
          0.5       + 0.4 * hash(cell + 2.3)  - 0.2
        );
        float d = length(fp - c.xy);
        float b = hash(cell + 5.0);
        float tw = 0.6 + 0.4 * sin(uTime * (0.7 + b * 1.5) + b * 12.0);
        // Star radius: b*b biases toward mostly-small with a few large.
        // Round 11: dropped the *0.01 crush; stars are now properly visible.
        float r = 0.02 + b * b * 0.06;
        bright += smoothstep(r, 0.0, d) * tw * (0.5 + b * 0.8);
      }
    }
    return bright;
  }
  void main() {
    // Convert gl_FragCoord to centered UV with correct aspect
    vec2 uv = (gl_FragCoord.xy / uTexSize - 0.5) * vec2(uAspect, 1.0);
    // Two layers: dim many + bright few
    float s1 = starLayer(uv, 18.0, uSeed);
    float s2 = starLayer(uv, 42.0, uSeed + 1.7) * 0.7;
    float stars = (s1 + s2) * uIntensity;
    // Faint nebula wash so it's not pure black between stars
    float neb = hash2(floor(uv * 60.0)) * hash2(floor(uv * 60.0) + 5.0);
    vec3 nebCol = uTint * pow(neb, 3.0) * 0.05 * uIntensity;
    vec3 col = uTint * stars * 1.1 + nebCol;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const MILKYWAY_FS = /* glsl */`
  // Milky-Way: banded dust + soft warm core, sin-distorted over time.
  uniform float uTime;
  uniform float uIntensity;
  uniform float uAspect;
  uniform vec2 uTexSize;
  uniform vec3 uCoreColor;
  uniform vec3 uDustColor;
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 ip = floor(p);
    vec2 fp = fract(p);
    fp = fp * fp * (3.0 - 2.0 * fp);
    float a = hash(ip);
    float b = hash(ip + vec2(1.0, 0.0));
    float c = hash(ip + vec2(0.0, 1.0));
    float d = hash(ip + vec2(1.0, 1.0));
    return mix(mix(a, b, fp.x), mix(c, d, fp.x), fp.y);
  }
  void main() {
    vec2 uv = (gl_FragCoord.xy / uTexSize - 0.5) * vec2(uAspect, 1.0);
    // Band angle: rotate uv by 30° so the band runs diagonally
    float c = cos(0.523), s = sin(0.523);
    vec2 ruv = vec2(c * uv.x - s * uv.y, s * uv.x + c * uv.y);
    // Band: density falls off perpendicular to a line
    float bandY = ruv.y * 0.8 + sin(uv.x * 1.4 + uTime * 0.1) * 0.15;
    float bandMask = exp(-bandY * bandY * 4.0);
    // Wavy noise dust
    float dust = noise(uv * 3.0 + vec2(uTime * 0.05, 0.0));
    dust += 0.5 * noise(uv * 7.0 - vec2(uTime * 0.03, uTime * 0.04));
    dust = dust / 1.5;
    // Sparse star sprinkles on top
    float sp = pow(noise(uv * 80.0 + uTime * 0.01), 12.0) * 1.5;
    // Round 11: dark base + scaled band. Was filling the whole frame bright;
    // now the galaxy is a ribbon on near-black, with the core the brightest part.
    vec3 dark = vec3(0.015, 0.012, 0.025);
    vec3 col = dark
             + uCoreColor * bandMask * (0.3 + dust * 0.5) * uIntensity * 0.5
             + uDustColor * dust * bandMask * 0.25 * uIntensity
             + vec3(0.9, 0.92, 1.0) * sp * 0.6 * uIntensity;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const COSMOS_FS = /* glsl */`
  // Cosmos: multi-layer stars + nebula gas (warm + cool pockets).
  uniform float uTime;
  uniform float uIntensity;
  uniform float uAspect;
  uniform vec2 uTexSize;
  uniform vec3 uGasWarm;
  uniform vec3 uGasCool;
  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 ip = floor(p);
    vec2 fp = fract(p);
    fp = fp * fp * (3.0 - 2.0 * fp);
    return mix(
      mix(hash(ip), hash(ip + vec2(1.0, 0.0)), fp.x),
      mix(hash(ip + vec2(0.0, 1.0)), hash(ip + vec2(1.0, 1.0)), fp.x),
      fp.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return v;
  }
  float starLayer(vec2 uv, float scale) {
    vec2 p = uv * scale;
    vec2 ip = floor(p);
    vec2 fp = fract(p);
    float bright = 0.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 nb = vec2(float(i), float(j));
        vec2 c = nb + 0.5
          + 0.4 * vec2(hash(ip + nb), hash(ip + nb + 7.7)) - 0.2;
        float d = length(fp - c);
        float b = hash(ip + nb + 3.0);
        float r = (0.005 + b * b * 0.025) * scale * 0.01;
        bright += smoothstep(r, 0.0, d) * b;
      }
    }
    return bright;
  }
  void main() {
    vec2 uv = (gl_FragCoord.xy / uTexSize - 0.5) * vec2(uAspect, 1.0);
    // Two star layers
    float s1 = starLayer(uv, 25.0);
    float s2 = starLayer(uv, 65.0) * 0.5;
    float stars = (s1 + s2) * uIntensity;
    // Two nebula pockets (warm + cool)
    float n1 = fbm(uv * 1.6 + vec2(uTime * 0.02, 0.0));
    float n2 = fbm(uv * 2.3 - vec2(0.0, uTime * 0.03));
    vec3 gas = mix(uGasCool, uGasWarm, smoothstep(0.3, 0.7, n1))
             * smoothstep(0.35, 0.7, n2) * uIntensity * 0.6;
    vec3 col = vec3(0.95, 0.97, 1.0) * stars * 0.9 + gas;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const AURORA_FS = /* glsl */`
  // Aurora: slow green/violet curtains drifting across the top half.
  uniform float uTime;
  uniform float uIntensity;
  uniform float uAspect;
  uniform vec2 uTexSize;
  uniform vec3 uAuroraA;
  uniform vec3 uAuroraB;
  float noise(vec2 p) {
    vec2 ip = floor(p);
    vec2 fp = fract(p);
    fp = fp * fp * (3.0 - 2.0 * fp);
    return mix(
      mix(fract(sin(dot(ip, vec2(127.1, 311.7))) * 43758.5453),
          fract(sin(dot(ip + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453), fp.x),
      mix(fract(sin(dot(ip + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453),
          fract(sin(dot(ip + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453), fp.x),
      fp.y
    );
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.0; a *= 0.5; }
    return v;
  }
  void main() {
    vec2 uv = (gl_FragCoord.xy / uTexSize - 0.5) * vec2(uAspect, 1.0);
    // Aurora only above the horizon (uv.y > -0.1)
    float above = smoothstep(-0.1, 0.3, uv.y);
    // Drifting curtain: noise field warped by sin
    vec2 w = uv * vec2(3.0, 6.0) + vec2(uTime * 0.3, 0.0);
    w.y += sin(uv.x * 4.0 + uTime * 0.7) * 0.3;
    float n = fbm(w);
    // Vertical curtain bands
    float bands = 0.0;
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float phase = fi * 1.7 + uTime * (0.3 + fi * 0.15);
      float cy = 0.1 + fi * 0.18 + sin(phase) * 0.06;
      float band = exp(-pow((uv.y - cy) * 7.0, 2.0));
      bands += band * (0.5 + 0.5 * sin(uv.x * 8.0 + phase));
    }
    bands = max(bands, 0.0) * n * above;
    vec3 col = mix(uAuroraA, uAuroraB, n) * bands * uIntensity * 1.2;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const MANDALA_FS = /* glsl */`
  // Mandala: 6-fold kaleidoscope pattern that pulses with time.
  uniform float uTime;
  uniform float uIntensity;
  uniform float uAspect;
  uniform vec2 uTexSize;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  void main() {
    vec2 uv = (gl_FragCoord.xy / uTexSize - 0.5) * vec2(uAspect, 1.0);
    float r = length(uv);
    float a = atan(uv.y, uv.x);
    // 6-fold symmetry
    float a6 = mod(a, 6.2831 / 6.0) - 3.14159 / 6.0;
    vec2 p = vec2(cos(a6), sin(a6)) * r;
    // Concentric rings + radial bands
    float rings = 0.5 + 0.5 * sin(r * 22.0 - uTime * 1.3);
    float spokes = 0.5 + 0.5 * sin(a6 * 6.0 * 2.0 + uTime * 0.7);
    // Pulsing inner glow
    float pulse = exp(-r * 2.5) * (0.7 + 0.3 * sin(uTime * 1.5));
    float m = rings * spokes + pulse * 0.5;
    vec3 col = mix(uColorA, uColorB, m) * m * uIntensity * 0.85;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const GRID_FS = /* glsl */`
  // Tron-style receding grid (camera at z=6 looking down -z).
  // The grid lives on z=0 plane; we project screen-space x,y to world via FOV.
  uniform float uTime;
  uniform float uIntensity;
  uniform float uAspect;
  uniform vec2 uTexSize;
  uniform vec3 uLineColor;
  uniform vec3 uHorizonColor;
  // Standard perspective reprojection: a fragment at screen (s, t) corresponds
  // to a 3D ray from the camera through (s_ndc, t_ndc, -1).
  // We treat the grid as living at z=0 (camera looks toward -z).
  void main() {
    vec2 ndc = gl_FragCoord.xy / uTexSize * 2.0 - 1.0;
    ndc.x *= uAspect;
    // tan(fov/2) for 45° ≈ 0.4142
    vec2 worldXY = ndc * 0.4142 * 6.0;  // 6 = camera distance
    // Distance from nearest grid line (spacing 1.0)
    float lineX = abs(fract(worldXY.x + 0.5) - 0.5);
    float lineY = abs(fract(worldXY.y + 0.5) - 0.5);
    float lineW = fwidth(worldXY.x) * 1.5;  // anti-alias width
    float gx = 1.0 - smoothstep(0.0, lineW, lineX);
    float gy = 1.0 - smoothstep(0.0, lineW, lineY);
    float grid = max(gx, gy);
    // Horizon glow at z=0 (where the grid lies). All fragments are above
    // ground (camera at z=6 looking at origin); fade by world distance.
    float distFade = exp(-length(worldXY) * 0.15);
    float pulse = 0.7 + 0.3 * sin(uTime * 1.5);
    vec3 col = uLineColor * grid * distFade * uIntensity * pulse
             + uHorizonColor * distFade * 0.15 * uIntensity;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const PLASMA_FS = /* glsl */`
  // Full-screen plasma field: classic sin waves in screen space.
  // Round 11 fix: was washing the whole screen to near-white (lum 253).
  // Now uses the plasma value as a glow MASK on a dark base, so only the
  // wave crests are bright — the troughs stay dark, like a lava-lamp.
  uniform float uTime;
  uniform float uIntensity;
  uniform float uAspect;
  uniform vec2 uTexSize;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  void main() {
    vec2 uv = gl_FragCoord.xy / uTexSize;
    vec2 p = uv * 2.0 - 1.0;
    p.x *= uAspect;
    float v = sin(p.x * 6.0 + uTime)
            + sin(p.y * 5.0 - uTime * 1.3)
            + sin((p.x + p.y) * 4.0 + uTime * 0.6)
            + sin(length(p) * 8.0 - uTime * 0.9);
    v = v / 4.0 * 0.5 + 0.5;          // 0..1
    // Sharp glow mask: only crests (v near 1) glow, troughs stay dark.
    float glow = pow(v, 2.5);
    vec3 col = mix(uColorA * 0.04, uColorB, glow) * uIntensity * glow;
    gl_FragColor = vec4(col, 1.0);
  }
`;

// ── Round 11: five new background moods ──────────────────────────────────
// All designed with a dark base + bright accents so they sit in the same
// brightness band (~40-90 avg lum) as the fixed existing moods and never
// wash out the 3D foreground.

const VORTEX_FS = /* glsl */`
  // Vortex: a swirling spiral nebula — logarithmic spiral arms of glowing gas
  // rotating around a bright core. fbm noise breaks the arms into wisps.
  uniform float uTime;
  uniform float uIntensity;
  uniform float uAspect;
  uniform vec2 uTexSize;
  uniform vec3 uCoreColor;
  uniform vec3 uArmColor;
  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p) {
    vec2 ip = floor(p), fp = fract(p); fp = fp * fp * (3.0 - 2.0 * fp);
    return mix(mix(hash(ip), hash(ip + vec2(1,0)), fp.x), mix(hash(ip + vec2(0,1)), hash(ip + vec2(1,1)), fp.x), fp.y);
  }
  float fbm(vec2 p) { float v=0.0, a=0.5; for(int i=0;i<5;i++){v+=a*noise(p);p*=2.0;a*=0.5;} return v; }
  void main() {
    vec2 uv = (gl_FragCoord.xy / uTexSize - 0.5) * vec2(uAspect, 1.0);
    float r = length(uv);
    float a = atan(uv.y, uv.x);
    // Logarithmic spiral: angle increases with log(radius). Two arms.
    float spiral = sin(a * 2.0 + log(max(r, 0.001)) * 6.0 - uTime * 0.8);
    spiral = smoothstep(0.0, 1.0, spiral);
    // Wispy gas via fbm, modulated by the spiral mask
    float gas = fbm(uv * 3.0 + vec2(uTime * 0.05, 0.0));
    float arms = spiral * (0.4 + gas * 0.8) * smoothstep(0.0, 0.15, r);
    // Bright core falloff
    float core = exp(-r * 5.0);
    vec3 dark = vec3(0.01, 0.008, 0.02);
    // Keep the negative space dark, but give the arms enough presence to read
    // behind a dense SDF at the default Environment brightness.
    vec3 col = dark + uArmColor * arms * uIntensity * 0.82 + uCoreColor * core * uIntensity * 1.05;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const OCEAN_FS = /* glsl */`
  // Ocean: underwater caustic light — rippling sine-network of bright lines
  // refracting through a dark teal depth, like sunlight through deep water.
  uniform float uTime;
  uniform float uIntensity;
  uniform float uAspect;
  uniform vec2 uTexSize;
  uniform vec3 uDeepColor;
  uniform vec3 uCausticColor;
  void main() {
    vec2 uv = (gl_FragCoord.xy / uTexSize - 0.5) * vec2(uAspect, 1.0);
    // Caustic network: sum of sines creates a Voronoi-like interference pattern
    float c = 0.0;
    vec2 q = uv * 4.0;
    c += sin(q.x * 1.3 + uTime * 0.7);
    c += sin(q.y * 1.7 - uTime * 0.5);
    c += sin((q.x + q.y) * 1.1 + uTime * 0.6);
    c += sin(length(q) * 1.5 - uTime * 0.4);
    c = c / 4.0 * 0.5 + 0.5;
    // Caustic lines: only the brightest interference ridges glow.
    float caustic = pow(c, 4.0);
    // Depth darkening toward edges
    float depth = 1.0 - smoothstep(0.2, 0.9, length(uv));
    vec3 col = uDeepColor * 0.12 * depth + uCausticColor * caustic * uIntensity * 0.7;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const EMBER_FS = /* glsl */`
  // Ember: glowing fire-coals — a slow fbm heat field where the hottest pockets
  // flare orange-yellow and the rest smolders dark red. Pulsing like a hearth.
  uniform float uTime;
  uniform float uIntensity;
  uniform float uAspect;
  uniform vec2 uTexSize;
  uniform vec3 uHotColor;
  uniform vec3 uCoalColor;
  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float noise(vec2 p) {
    vec2 ip = floor(p), fp = fract(p); fp = fp * fp * (3.0 - 2.0 * fp);
    return mix(mix(hash(ip), hash(ip + vec2(1,0)), fp.x), mix(hash(ip + vec2(0,1)), hash(ip + vec2(1,1)), fp.x), fp.y);
  }
  float fbm(vec2 p) { float v=0.0, a=0.5; for(int i=0;i<5;i++){v+=a*noise(p);p*=2.0;a*=0.5;} return v; }
  void main() {
    vec2 uv = (gl_FragCoord.xy / uTexSize - 0.5) * vec2(uAspect, 1.0);
    // Heat field: fbm drifting upward (flames lick up) + slow pulse
    float heat = fbm(uv * 2.5 + vec2(0.0, uTime * 0.15));
    heat *= 0.7 + 0.3 * sin(uTime * 0.8 + uv.x * 3.0);
    heat = clamp(heat, 0.0, 1.0);
    // Hot pockets only where heat is high; rest is dark coal.
    float flare = smoothstep(0.55, 0.85, heat);
    vec3 col = uCoalColor * heat * 0.25 * uIntensity + uHotColor * flare * uIntensity * 0.9;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const FROST_FS = /* glsl */`
  // Frost: crystalline ice — a Voronoi cell pattern whose edges glow pale blue,
  // like frost spreading across glass. Static-ish, with slow crystalline drift.
  uniform float uTime;
  uniform float uIntensity;
  uniform float uAspect;
  uniform vec2 uTexSize;
  uniform vec3 uFrostColor;
  uniform vec3 uEdgeColor;
  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  void main() {
    vec2 uv = (gl_FragCoord.xy / uTexSize - 0.5) * vec2(uAspect, 1.0);
    vec2 p = uv * 4.0;
    vec2 ip = floor(p), fp = fract(p);
    // Voronoi: nearest cell center distance (F1)
    float minD = 1.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 nb = vec2(float(i), float(j));
        vec2 seed = nb + 0.5 + 0.4 * vec2(hash(ip + nb), hash(ip + nb + 7.7)) - 0.2;
        minD = min(minD, length(fp - seed));
      }
    }
    // Slow crystalline drift
    minD += 0.04 * sin(uTime * 0.5 + uv.x * 8.0) * cos(uTime * 0.3 + uv.y * 8.0);
    // Edges = where minD is large (cell boundaries); interior faint
    float edge = smoothstep(0.35, 0.5, minD);
    float interior = (1.0 - edge) * 0.08;
    vec3 col = uFrostColor * interior * uIntensity + uEdgeColor * edge * uIntensity * 0.5;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const QUANTUM_FS = /* glsl */`
  // Quantum: a probability-field of flickering nodes connected by faint lines —
  // evokes a quantum-foam / particle-network aesthetic. Nodes twinkle in/out.
  uniform float uTime;
  uniform float uIntensity;
  uniform float uAspect;
  uniform vec2 uTexSize;
  uniform vec3 uNodeColor;
  uniform vec3 uLineColor;
  float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  void main() {
    vec2 uv = (gl_FragCoord.xy / uTexSize - 0.5) * vec2(uAspect, 1.0);
    // Grid of quantum nodes; each cell has a node that flickers on/off.
    float scale = 8.0;
    vec2 p = uv * scale;
    vec2 ip = floor(p), fp = fract(p);
    float glow = 0.0;
    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 nb = vec2(float(i), float(j));
        vec2 seed = nb + 0.5 + 0.3 * vec2(hash(ip + nb), hash(ip + nb + 7.7)) - 0.15;
        float d = length(fp - seed);
        // Flicker: each node's intensity oscillates with its own phase
        float phase = hash(ip + nb + 3.0) * 6.28;
        float flick = pow(0.5 + 0.5 * sin(uTime * 2.0 + phase), 4.0);
        glow += smoothstep(0.12, 0.0, d) * flick;
      }
    }
    // Faint lattice lines connecting the grid
    float lx = smoothstep(0.03, 0.0, abs(fp.x - 0.5)) * smoothstep(0.5, 0.0, fp.y);
    float ly = smoothstep(0.03, 0.0, abs(fp.y - 0.5)) * smoothstep(0.5, 0.0, fp.x);
    float lines = (lx + ly) * 0.04;
    vec3 col = uNodeColor * glow * uIntensity * 0.9 + uLineColor * lines * uIntensity;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const ECLIPSE_FS = /* glsl */`
  // Eclipse: an unmistakable occluding lunar disk framed by a living corona.
  uniform float uTime;
  uniform float uIntensity;
  uniform float uAspect;
  uniform vec2 uTexSize;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  void main() {
    vec2 uv = (gl_FragCoord.xy / uTexSize - 0.5) * vec2(uAspect, 1.0);
    vec2 center = vec2(0.18 * sin(uTime * 0.08), 0.06 * cos(uTime * 0.06));
    float r = length(uv - center);
    float corona = exp(-pow((r - 0.27) * 12.0, 2.0));
    float rays = 0.5 + 0.5 * sin(atan(uv.y - center.y, uv.x - center.x) * 12.0 + uTime * 0.35);
    float glow = corona * (0.45 + rays * 0.55);
    float halo = exp(-r * 2.8) * 0.16;
    float disk = 1.0 - smoothstep(0.195, 0.215, r);
    vec3 col = vec3(0.004, 0.005, 0.012) + uColorA * halo + uColorB * glow * uIntensity * 1.05;
    col = mix(col, vec3(0.0), disk);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const SYNTHWAVE_FS = /* glsl */`
  // Synthwave: a sunset disk and perspective grid in a deliberately dark palette.
  uniform float uTime;
  uniform float uIntensity;
  uniform float uAspect;
  uniform vec2 uTexSize;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  uniform vec3 uLineColor;
  void main() {
    vec2 uv = (gl_FragCoord.xy / uTexSize - 0.5) * vec2(uAspect, 1.0);
    float horizon = -0.12;
    float sun = smoothstep(0.32, 0.0, length(uv - vec2(0.0, horizon + 0.20)));
    float stripes = step(0.52, fract((uv.y - horizon) * 18.0));
    sun *= mix(1.0, stripes, smoothstep(horizon - 0.02, horizon + 0.24, uv.y));
    float ground = 1.0 - smoothstep(horizon - 0.02, horizon + 0.02, uv.y);
    vec2 gp = vec2(uv.x / max(0.08, horizon - uv.y), 1.0 / max(0.08, horizon - uv.y));
    float lines = 1.0 - smoothstep(0.0, 0.028, min(abs(fract(gp.x * 6.0) - 0.5), abs(fract(gp.y * 0.7 + uTime * 0.04) - 0.5)));
    vec3 sky = uColorA * (0.025 + smoothstep(horizon, 0.75, uv.y) * 0.08);
    vec3 col = sky + uColorB * sun * uIntensity * 0.78 + uLineColor * lines * ground * uIntensity * 0.45;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const PRISM_FS = /* glsl */`
  // Prism: a glass triangle receiving one warm beam and splitting it to cyan,
  // violet, and rose beams on the other side.
  uniform float uTime;
  uniform float uIntensity;
  uniform float uAspect;
  uniform vec2 uTexSize;
  uniform vec3 uColorA;
  uniform vec3 uColorB;
  void main() {
    vec2 uv = (gl_FragCoord.xy / uTexSize - 0.5) * vec2(uAspect, 1.0);
    vec2 p = uv - vec2(-0.04, 0.0);
    // Signed distance to an equilateral triangle, point facing upward.
    vec2 q = p;
    q.x = abs(q.x) - 0.21;
    q.y = q.y + 0.12;
    if (q.x + 1.73205 * q.y > 0.0) q = vec2(q.x - 1.73205 * q.y, -1.73205 * q.x - q.y) * 0.5;
    q.x -= clamp(q.x, -0.42, 0.0);
    float triangle = -length(q) * sign(q.y);
    float glassEdge = 1.0 - smoothstep(0.004, 0.014, abs(triangle));
    float glass = smoothstep(0.018, -0.018, triangle);
    float incoming = exp(-abs(uv.y + uv.x * 0.03) * 34.0) * smoothstep(-0.88, -0.19, uv.x);
    float cyan = exp(-abs(uv.y - (uv.x - 0.13) * 0.42) * 35.0) * smoothstep(0.08, 0.85, uv.x);
    float violet = exp(-abs(uv.y - (uv.x - 0.13) * 0.02) * 35.0) * smoothstep(0.08, 0.85, uv.x);
    float rose = exp(-abs(uv.y + (uv.x - 0.13) * 0.37) * 35.0) * smoothstep(0.08, 0.85, uv.x);
    vec3 beams = vec3(1.0, 0.72, 0.28) * incoming
      + vec3(0.08, 0.92, 1.0) * cyan
      + uColorA * violet
      + vec3(1.0, 0.18, 0.58) * rose;
    vec3 glassColor = mix(uColorA, uColorB, 0.5 + 0.5 * sin(uTime * 0.2));
    vec3 col = beams * uIntensity * 0.72 + glassColor * (glass * 0.09 + glassEdge * 0.92) * uIntensity;
    gl_FragColor = vec4(col, 1.0);
  }
`;

const COMMON_VS = /* glsl */`
  // Full-screen triangle: position in clip space already.
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Per-mood fragment shader registry
const MOOD_FRAGMENTS = {
  void: VOID_FS,
  starfield: STARFIELD_FS,
  cosmos: COSMOS_FS,
  aurora: AURORA_FS,
  mandala: MANDALA_FS,
  grid: GRID_FS,
  plasma: PLASMA_FS,
  // Round 11
  vortex: VORTEX_FS,
  quantum: QUANTUM_FS,
  eclipse: ECLIPSE_FS,
  synthwave: SYNTHWAVE_FS,
  prism: PRISM_FS,
};

const MOOD_COLORS = {
  void:      { color: [0.027, 0.027, 0.047] },                          // matches current --bg-0
  starfield: { tint:  [0.85, 0.9, 1.0] },
  cosmos:    { warm:  [1.0, 0.55, 0.2],   cool: [0.3, 0.55, 1.0] },
  aurora:    { a:     [0.2, 1.0, 0.5],    b:    [0.7, 0.3, 1.0] },
  mandala:   { a:     [0.8, 0.4, 1.0],    b:    [0.2, 0.8, 1.0] },
  grid:      { line:  [0.4, 0.95, 1.0],   hor:  [0.9, 0.7, 1.0] },
  plasma:    { a:     [1.0, 0.4, 0.7],    b:    [0.4, 0.7, 1.0] },
  // Round 11 — tuned to the dark-base + accent aesthetic.
  vortex:    { core:  [1.0, 0.85, 0.6],   arm:  [0.6, 0.4, 1.0] },
  quantum:   { node:  [0.3, 1.0, 0.85],   line: [0.2, 0.5, 0.8] },
  eclipse:   { a:     [0.16, 0.04, 0.02], b:    [1.0, 0.52, 0.12] },
  synthwave: { a:     [0.22, 0.03, 0.19], b:    [1.0, 0.25, 0.38], line: [0.28, 0.82, 1.0] },
  prism:     { a:     [0.30, 0.20, 1.0],  b:    [0.08, 0.86, 1.0] },
};

export class BGRuntime {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.mode = 'void';
    this.intensity = 0.7;
    this.materials = {};   // mood name -> ShaderMaterial
    this.currentMesh = null;
    this._rendererSize = new THREE.Vector2();
    this._lastWidth = 0;
    this._lastHeight = 0;
    this._lastDpr = 0;
    this._build();
    this.setMode('void');
  }

  _build() {
    // Use a full-screen triangle (3 verts, no UV buffer needed — pos.xy is screen space).
    // Using PlaneGeometry(2, 2) so it covers clip space when not transformed.
    const geo = new THREE.BufferGeometry();
    const verts = new Float32Array([
      -1, -1, 0,
       3, -1, 0,
      -1,  3, 0,
    ]);
    const uvs = new Float32Array([
      0, 0,
      2, 0,
      0, 2,
    ]);
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    this._sharedGeo = geo;

    for (const mood of BG_MODES) {
      const colors = MOOD_COLORS[mood] || {};
      const c = (key) => new THREE.Color(colors[key] || 0xffffff);
      const uniforms = {
        uTime:       { value: 0 },
        uIntensity:  { value: this.intensity },
        uAspect:     { value: 1 },
        uTexSize:    { value: new THREE.Vector2(1, 1) },
        // mood-specific uniforms with safe defaults. Each shader only reads
        // the uniforms it declares; the rest are inert (three.js tolerates
        // extra uniforms on the JS side — only *missing* shader-referenced
        // uniforms would be a problem, and we declare all of them here).
        uColor:        { value: c('color') },
        uTint:         { value: c('tint') },
        uCoreColor:    { value: c('core') },
        uDustColor:    { value: c('dust') },
        uGasWarm:      { value: c('warm') },
        uGasCool:      { value: c('cool') },
        uAuroraA:      { value: c('a') },
        uAuroraB:      { value: c('b') },
        uColorA:       { value: c('a') },
        uColorB:       { value: c('b') },
        uLineColor:    { value: c('line') },
        uHorizonColor: { value: c('hor') },
        // Round 11 new-mood uniforms
        uArmColor:     { value: c('arm') },
        uDeepColor:    { value: c('deep') },
        uCausticColor: { value: c('caustic') },
        uHotColor:     { value: c('hot') },
        uCoalColor:    { value: c('coal') },
        uFrostColor:   { value: c('frost') },
        uEdgeColor:    { value: c('edge') },
        uNodeColor:    { value: c('node') },
        uSeed:         { value: Math.random() * 100 },
      };
      const mat = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: COMMON_VS,
        fragmentShader: MOOD_FRAGMENTS[mood],
        depthWrite: false,
        depthTest: false,
      });
      this.materials[mood] = mat;
    }
  }

  setMode(mode) {
    if (!BG_MODES.includes(mode)) mode = 'void';
    // Each mood owns its own material/uniforms, so a mode swap needs one
    // fresh dimension upload even when the canvas itself did not resize.
    this._lastWidth = 0;
    this._lastHeight = 0;
    this._lastDpr = 0;
    // Remove current mesh
    if (this.currentMesh) {
      this.scene.remove(this.currentMesh);
      this.currentMesh = null;
    }
    this.mode = mode;

    // Void mode is special: don't add a quad at all — let scene.background
    // (set by the palette system) show through. This avoids the bug where
    // the palette-driven scene.background overrode our bg-quad and produced
    // a white/cream canvas instead of the intended dark color.
    // (Bug found 2026-06-25.)
    if (mode === 'void') {
      // Make sure scene.background is restored to a dark color (will be
      // overwritten by the palette system on next render — that's OK, we
      // just want to ensure no stale null state).
      if (!this.scene.background) {
        this.scene.background = new THREE.Color(0x07070c);
      }
      return this.materials[mode];
    }

    // For all other modes: hide scene.background so our shader quad
    // provides the full canvas color.
    this.scene.background = null;

    const mat = this.materials[mode];
    const mesh = new THREE.Mesh(this._sharedGeo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -10000;  // very first
    mesh.name = `bg-${mode}`;
    this.scene.add(mesh);
    this.currentMesh = mesh;
    return mat;
  }

  setIntensity(v) {
    this.intensity = Math.max(0, Math.min(1.5, v));
    for (const m of Object.values(this.materials)) {
      if (m.uniforms.uIntensity) m.uniforms.uIntensity.value = this.intensity;
    }
  }

  update(time, renderer) {
    // Update time + aspect for current material
    const mat = this.materials[this.mode];
    if (mat && mat.uniforms.uTime) mat.uniforms.uTime.value = time;
    if (mat && mat.uniforms.uAspect && renderer) {
      const size = renderer.getSize(this._rendererSize);
      const dpr = renderer.getPixelRatio();
      if (size.x === this._lastWidth && size.y === this._lastHeight && dpr === this._lastDpr) return;
      this._lastWidth = size.x;
      this._lastHeight = size.y;
      this._lastDpr = dpr;
      if (mat.uniforms.uTexSize) mat.uniforms.uTexSize.value.set(size.x * dpr, size.y * dpr);
      mat.uniforms.uAspect.value = (size.x * dpr) / Math.max(1, size.y * dpr);
    }
  }
}
