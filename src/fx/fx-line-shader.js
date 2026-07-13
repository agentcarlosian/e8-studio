// fx-line-shader.js — FX-aware line material (drop-in for THREE.LineBasicMaterial)
//
// Why this exists:
//   The FX system (fx-runtime.js FXRuntime) pushes uFXMode/uFXIntensity/uTime to
//   every material that declares those uniforms. But every view's edges, chord
//   lines, ring guides, Petrie polygon, Weyl mirrors, etc. used plain
//   THREE.LineBasicMaterial — which has no FX uniforms — so they received ZERO
//   effects. In edge-heavy views (E8 Coxeter, 600-cell, polytope4d, bloom) the
//   bulk of visible pixels showed no FX response at all, which is why "selecting
//   an effect you can't even tell any changed".
//
//   LineFXMaterial renders lines identically to LineBasicMaterial when uFXMode==0
//   (none), and applies the per-mode COLOR effects (the ones that make sense on
//   thin strokes: glow, chromatic, heat, plasma, caustic, iridescent, nebula,
//   hologram, xray, crystal, voronoi, flowfield, k6, wireframe, aura, ripple-pulse
//   brightness, spiral/kaleido hue) when a mode is active. It is registered by
//   FXRuntime._scanMaterials automatically because it declares uFXMode.
//
// Usage (drop-in swap):
//   - import { LineFXMaterial } from '../fx/fx-line-shader.js';
//   - const mat = new LineFXMaterial({ color: 0xff8800, transparent: true, opacity: 0.4 });
//   - new THREE.LineSegments(geo, mat)   // or LineLoop / Line — identical API
//
// The material's .color and .opacity are kept in sync with uniforms uColor/uOpacity
// so existing code that mutates mat.color.set(...) or mat.opacity = x keeps working.

import * as THREE from 'three';
import { FX_MODE } from './fx-shader.js';

// Line width is effectively locked to 1px by most browsers for non-WEBGL lines,
// but we mirror LineBasicMaterial's property so feature-detection / serialize
// code that reads mat.linewidth doesn't break.
// Vertex shader is assembled per-material so we only declare the `color`
// attribute when vertexColors is requested. Declaring an attribute that no
// geometry provides is legal GLSL (it reads as 0) but some drivers warn;
// keeping it conditional is cleaner and matches LineBasicMaterial's behaviour.
function lineVertexShader(vertexColors) {
  // NOTE on the `color` attribute: for a (non-raw) ShaderMaterial with
  // vertexColors=true three.js's auto-generated prefix already declares
  // `attribute vec3 color;`, so we must NOT redeclare it here (redefinition =
  // compile error). When vertexColors=false three provides no `color` attribute
  // and we simply don't reference it. We hand the per-vertex colour through our
  // own varying `vLineBase` (NOT `vColor`, which three also reserves) so the
  // fragment shader always has a definite base colour: vertex colour * uColor
  // for vertex-coloured lines, plain uColor otherwise.
  return /* glsl */`
    uniform vec3 uColor;
    varying vec3 vLineBase;
    varying vec3 vWorldPos;
    void main() {
      vLineBase = ${vertexColors ? 'color * uColor' : 'uColor'};
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vWorldPos = wp.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
}

const LINE_FS = /* glsl */`
  precision highp float;
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform int uFXMode;
  uniform float uFXIntensity;
  uniform float uTime;
  varying vec3 vWorldPos;
  varying vec3 vLineBase;

  // hsv -> rgb (used by several modes to build a tint from a scalar)
  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  void main() {
    // Base colour comes from the vertex shader: vertex colour * uColor when
    // vertex-coloured (600-cell edges), else plain uColor. FX branches below
    // modulate col from this starting point.
    vec3 col = vLineBase;
    float a = uOpacity;

    // Slightly modulate alpha by world position so stroked geometry "breathes"
    // with the effect even though a 1px line has no interior to tint.
    if (uFXMode == ${(FX_MODE.GLOW)}) {
      // Glow: brighten the whole stroke and add a warm lift.
      col += col * uFXIntensity * 1.4 + vec3(0.15, 0.12, 0.05) * uFXIntensity;
    }
    if (uFXMode == ${(FX_MODE.PULSE)}) {
      // Pulse: breathing brightness along world radius.
      float p = 0.5 + 0.5 * sin(uTime * 3.14159);
      col *= 0.7 + 0.7 * p * uFXIntensity;
    }
    if (uFXMode == ${(FX_MODE.RIPPLE)}) {
      // Ripple: radial wave brightness.
      float r = length(vWorldPos.xy);
      col *= 1.0 + uFXIntensity * 0.7 * sin(r * 8.0 - uTime * 4.0);
    }
    if (uFXMode == ${(FX_MODE.SPIRAL)}) {
      // Spiral: angular hue wave.
      float ang = atan(vWorldPos.y, vWorldPos.x);
      float h = sin(ang * 6.0 + uTime * 2.0) * uFXIntensity * 0.5;
      col += vec3(h, h * 0.4, -h * 0.5);
    }
    if (uFXMode == ${(FX_MODE.KALEIDOSCOPE)}) {
      // Kaleidoscope: position-driven hue.
      float h = sin(vWorldPos.x * 5.0 + vWorldPos.y * 3.0 + uTime) * uFXIntensity * 0.5;
      col.r *= (1.0 + h);
      col.g *= (1.0 + h * 0.4);
      col.b *= (1.0 - h * 0.4);
    }
    if (uFXMode == ${(FX_MODE.CHROMATIC)}) {
      // Chromatic: split the line colour into an RGB prismatic shift by position.
      float ca = uFXIntensity * 0.5;
      float s = sin(vWorldPos.x * 3.0 + vWorldPos.y * 2.0 + uTime * 2.0);
      col += vec3(s, sin(s + 2.094), sin(s + 4.188)) * ca;
    }
    if (uFXMode == ${(FX_MODE.HEAT)}) {
      // Heat: warm near origin, cool far.
      float dist = length(vWorldPos);
      float t = clamp(dist * 0.5, 0.0, 1.0);
      vec3 cool = vec3(0.3, 0.5, 1.0);
      vec3 warm = vec3(1.0, 0.55, 0.15);
      col = mix(warm, cool, t) * (0.6 + length(col) * 0.5) * uFXIntensity + col * (1.0 - uFXIntensity);
    }
    if (uFXMode == ${(FX_MODE.AURA)}) {
      // Aura: cool ethereal lift on strokes.
      col += vec3(0.5, 0.45, 0.9) * uFXIntensity * 0.8;
    }
    if (uFXMode == ${(FX_MODE.VORONOI)}) {
      // Voronoi: tint by hashed 3D cell — gives each chord line a different hue.
      vec3 p = vWorldPos * 2.0;
      vec3 ip = floor(p);
      vec3 tint = 0.5 + 0.5 * cos(6.2831 * (ip * 0.18 + vec3(0.0, 0.33, 0.67)));
      col = mix(col, col * tint * 1.6, uFXIntensity);
    }
    if (uFXMode == ${(FX_MODE.CAUSTIC)}) {
      // Caustic: animated cellular brightness sweep.
      vec3 p = vWorldPos * 1.8 + vec3(0.0, 0.0, uTime * 0.6);
      float c = 0.5 + 0.5 * sin(p.x * 3.0 + sin(p.y * 2.0 + uTime));
      c += 0.5 + 0.5 * sin(p.y * 3.7 + sin(p.z * 2.5 - uTime));
      c /= 2.0;
      vec3 caust = mix(vec3(0.2, 0.6, 1.0), vec3(1.0, 0.8, 0.4), c);
      col = mix(col, col + caust * 0.7, uFXIntensity);
    }
    if (uFXMode == ${(FX_MODE.IRIDESCENT)}) {
      // Iridescent: thin-film hue that travels along the line over time.
      float h = fract(length(vWorldPos) * 0.3 + uTime * 0.15);
      vec3 irid = 0.5 + 0.5 * cos(6.2831 * (h + vec3(0.0, 0.33, 0.67)));
      col = mix(col, col * irid * 1.5, uFXIntensity);
    }
    if (uFXMode == ${(FX_MODE.FLOWFIELD)}) {
      // Flowfield: tint by curl direction (approx).
      float t = uTime * 0.4;
      float dx = sin(vWorldPos.y * 1.7 + t) * cos(vWorldPos.z * 1.3 - t);
      float dy = sin(vWorldPos.z * 1.5 - t) * cos(vWorldPos.x * 1.9 + t * 0.7);
      vec3 flowTint = 0.5 + 0.5 * vec3(dx, dy, sin(vWorldPos.x + t));
      col = mix(col, col * (0.5 + flowTint) * 1.4, uFXIntensity);
    }
    if (uFXMode == ${(FX_MODE.PLASMA)}) {
      // Plasma: classic sin palette.
      float p = sin(vWorldPos.x * 4.0 + uTime) + sin(vWorldPos.y * 3.7 - uTime * 1.3) + sin(vWorldPos.z * 4.3 + uTime * 0.9);
      p = p / 3.0 * 0.5 + 0.5;
      vec3 plas = 0.5 + 0.5 * cos(6.2831 * (p + vec3(0.0, 0.33, 0.67)));
      col = mix(col, col * plas * 1.4, uFXIntensity);
    }
    if (uFXMode == ${(FX_MODE.KALEIDO6)}) {
      // Kaleido6: 6-fold hue.
      float ang = atan(vWorldPos.y, vWorldPos.x);
      float ang6 = mod(ang, 6.2831 / 6.0);
      float h = fract(ang6 / (6.2831 / 6.0) + uTime * 0.15);
      vec3 k6 = 0.5 + 0.5 * cos(6.2831 * (h + vec3(0.0, 0.33, 0.67)));
      col = mix(col, col * k6 * 1.4, uFXIntensity);
    }
    if (uFXMode == ${(FX_MODE.NEBULA)}) {
      // Nebula: warm/cool gas tint from a noise-ish field.
      float d = 0.5 + 0.5 * sin(vWorldPos.x * 1.4 + uTime * 0.4) * cos(vWorldPos.y * 1.7 - uTime * 0.3);
      vec3 gas = mix(vec3(0.3, 0.55, 1.0), vec3(1.0, 0.55, 0.2), smoothstep(-0.5, 0.5, d));
      col = mix(col, col * (1.0 + gas), uFXIntensity);
    }
    if (uFXMode == ${(FX_MODE.WIREFRAME)}) {
      // Wireframe: bright cross-hatch flicker.
      float w = max(abs(sin(vWorldPos.x * 6.0 + vWorldPos.y * 6.0)), abs(sin(vWorldPos.x * 6.0 - vWorldPos.z * 6.0)));
      col = mix(col, vec3(1.0, 0.95, 0.85), uFXIntensity * smoothstep(0.85, 1.0, w));
    }
    if (uFXMode == ${(FX_MODE.HOLOGRAM)}) {
      // Hologram: cyan scanline shimmer.
      float scan = 0.5 + 0.5 * sin(vWorldPos.y * 28.0 - uTime * 6.0);
      float flicker = 0.85 + 0.15 * sin(uTime * 23.0) * sin(uTime * 7.0);
      vec3 holo = vec3(0.2, 0.9, 1.0);
      col = mix(col, col * holo * (0.6 + 0.4 * scan) * flicker, uFXIntensity);
    }
    if (uFXMode == ${(FX_MODE.XRAY)}) {
      // X-ray: bright cyan-white edges.
      col = mix(col, vec3(0.4, 1.0, 0.9) * 1.6, uFXIntensity);
    }
    if (uFXMode == ${(FX_MODE.CRYSTAL)}) {
      // Crystal: prismatic rotating hue.
      float band = fract(length(vWorldPos) * 0.4 + uTime * 0.12);
      vec3 prism = 0.5 + 0.5 * cos(6.2831 * (band + vec3(0.0, 0.33, 0.67)));
      col = mix(col, col * prism * 1.5, uFXIntensity);
    }
    // FOG (mode 8) handled on points via alpha-depth; lines keep full opacity so
    // the structure stays visible — only the point field recedes into depth.

    gl_FragColor = vec4(col, a);
  }
`;

/**
 * A ShaderMaterial that draws lines (LineSegments / LineLoop / Line) and is
 * FX-aware. Constructor mirrors THREE.LineBasicMaterial's useful subset:
 *   { color, opacity, transparent, linewidth, depthWrite, depthTest, blending, visible }
 * Mutating `.color` / `.opacity` afterwards is honoured (synced to uniforms).
 */
export class LineFXMaterial extends THREE.ShaderMaterial {
  constructor(opts = {}) {
    const color = opts.color !== undefined ? new THREE.Color(opts.color) : new THREE.Color(0xffffff);
    const vertexColors = !!opts.vertexColors;
    super({
      uniforms: {
        uColor: { value: color },
        uOpacity: { value: opts.opacity !== undefined ? opts.opacity : 1.0 },
        // FX uniforms — declared so FXRuntime.registerMaterial picks this up.
        uFXMode: { value: FX_MODE.NONE },
        uFXIntensity: { value: 0.5 },
        uTime: { value: 0 },
      },
      vertexShader: lineVertexShader(vertexColors),
      fragmentShader: LINE_FS,
      transparent: opts.transparent !== undefined ? opts.transparent : (opts.opacity !== undefined && opts.opacity < 1.0),
      depthWrite: opts.depthWrite !== undefined ? opts.depthWrite : true,
      depthTest: opts.depthTest !== undefined ? opts.depthTest : true,
      blending: opts.blending !== undefined ? opts.blending : THREE.NormalBlending,
    });
    // Keep a public .color / .opacity so existing mutation code works. We hook
    // the THREE.Color instance straight into uColor so .set(...) propagates.
    this.color = this.uniforms.uColor.value;
    this.vertexColors = vertexColors;
    // linewidth is a no-op in WebGL for lines but LineBasicMaterial exposes it;
    // mirror it for code that reads/writes the property.
    this.linewidth = opts.linewidth || 1.0;
  }

  // Keep .opacity <-> uOpacity in sync (mirrors LineBasicMaterial.opacity).
  // three.js's Material base ctor assigns this.opacity DURING super(), before
  // this.uniforms exists, so the setter must tolerate a missing uniforms bag —
  // it stashes the value on the instance and the getter replays it once the
  // ShaderMaterial ctor has wired up this.uniforms.uOpacity.
  get opacity() { return (this.uniforms && this.uniforms.uOpacity) ? this.uniforms.uOpacity.value : this._opacityFallback; }
  set opacity(v) {
    if (this.uniforms && this.uniforms.uOpacity) this.uniforms.uOpacity.value = v;
    this._opacityFallback = v;
  }
}

// NOTE: do NOT set isLineBasicMaterial on this prototype. three.js's renderer
// gates on that flag to call refreshUniformsLine(), which dereferences the
// built-in `diffuse`/`opacity` uniforms a real LineBasicMaterial carries — our
// custom ShaderMaterial has neither, so the flag would crash every render.
// Raycasting branches on the Object3D type (Line / LineSegments), not on the
// material flag, so leaving it unset is both correct and required.
