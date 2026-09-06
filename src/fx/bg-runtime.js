// Full-screen procedural environments shared by every desktop view.
import * as THREE from 'three';
import { BG_MODES, normalizeBackgroundMode } from '../ui/backgrounds.js';
import { STUDIO_BACKGROUND_SHADERS } from './background-shaders.js';
import { createHydrogenCloud, QUANTUM_POINT_VERTEX, QUANTUM_POINT_FRAGMENT } from './quantum-orbitals.js';
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
  ...STUDIO_BACKGROUND_SHADERS,
  void: VOID_FS,
  starfield: STARFIELD_FS,
};

const MOOD_COLORS = {
  void:      { color: [0.027, 0.027, 0.047] },                          // matches current --bg-0
  starfield: { tint:  [0.85, 0.9, 1.0] },
  cosmos:    { a: [0.95, 0.43, 0.26], b: [0.22, 0.31, 0.88] },
  aurora:    { a: [1.0, 1.0, 1.0], b: [0.40, 0.41, 0.42] },
  mandala:   { a: [0.94, 0.70, 0.36], b: [0.44, 0.39, 0.92] },
  tide:      { a: [0.12, 0.88, 0.82], b: [0.06, 0.35, 0.75] },
  plasma:    { a: [1.0, 0.22, 0.39], b: [0.15, 0.57, 1.0] },
  vortex:    { core: [0.0, 0.0, 0.0], arm: [1.0, 1.0, 1.0] },
  quantum:   { a: [0.31, 1.0, 0.83], b: [0.24, 0.48, 0.85] },
  eclipse:   { a:     [0.16, 0.04, 0.02], b:    [1.0, 0.52, 0.12] },
  ember:     { a: [1.0, 0.65, 0.24], b: [0.68, 0.13, 0.025] },
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
    this._animationTime = 0;
    this._lastTime = null;
    this._motionPreference = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
    this._build();
    this.setMode('void');
  }

  _build() {
    // Use a full-screen triangle (3 verts, no UV buffer needed — pos.xy is screen space).
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
      const c = (key) => Array.isArray(colors[key])
        ? new THREE.Color().fromArray(colors[key])
        : new THREE.Color(colors[key] ?? 0xffffff);
      const uniforms = {
        uTime:       { value: 0 },
        uIntensity:  { value: this.intensity },
        uExposure:   { value: 0.85 },
        uAspect:     { value: 1 },
        uTexSize:    { value: new THREE.Vector2(1, 1) },
        // mood-specific uniforms with safe defaults. Each shader only reads
        // the uniforms it declares; the rest are inert (three.js tolerates
        // extra uniforms on the JS side — only *missing* shader-referenced
        // uniforms would be a problem, and we declare all of them here).
        uColor:        { value: c('color') },
        uTint:         { value: c('tint') },
        uCoreColor:    { value: c('core') },
        uColorA:       { value: c('a') },
        uColorB:       { value: c('b') },
        uArmColor:     { value: c('arm') },
        uSeed:         { value: Math.random() * 100 },
      };
      const mat = mood === 'quantum' ? new THREE.RawShaderMaterial({
        uniforms,
        vertexShader: QUANTUM_POINT_VERTEX,
        fragmentShader: QUANTUM_POINT_FRAGMENT,
        blending: THREE.AdditiveBlending,
        // Keep this in the early opaque render queue, behind scene geometry.
        transparent: false,
        depthWrite: false,
        depthTest: false,
      }) : new THREE.ShaderMaterial({
        uniforms,
        vertexShader: COMMON_VS,
        fragmentShader: MOOD_FRAGMENTS[mood],
        depthWrite: false,
        depthTest: false,
      });
      this.materials[mood] = mat;
    }
  }

  _quantumEnvironment() {
    if (this._quantumGroup) return this._quantumGroup;
    const cloud = createHydrogenCloud();
    const interleaved = new THREE.InterleavedBuffer(cloud.data, 4);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.InterleavedBufferAttribute(interleaved, 3, 0));
    geometry.setAttribute('aDensity', new THREE.InterleavedBufferAttribute(interleaved, 1, 3));
    const points = new THREE.Points(geometry, this.materials.quantum);
    points.name = 'quantum-probability-cloud';
    points.frustumCulled = false;
    points.renderOrder = -9999;
    const ground = new THREE.Mesh(this._sharedGeo, new THREE.ShaderMaterial({
      vertexShader: COMMON_VS,
      fragmentShader: 'void main(){gl_FragColor=vec4(0.0,0.0,0.0,1.0);}',
      depthWrite: false, depthTest: false,
    }));
    ground.frustumCulled = false;
    ground.renderOrder = -10000;
    const group = new THREE.Group();
    group.add(ground, points);
    group.userData.orbital = { n: cloud.n, l: cloud.l, m: cloud.m, samples: cloud.count };
    this._quantumGroup = group;
    return group;
  }

  setMode(mode) {
    mode = normalizeBackgroundMode(mode);
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
    const mesh = mode === 'quantum' ? this._quantumEnvironment() : new THREE.Mesh(this._sharedGeo, mat);
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

  update(time, renderer, { paused = false } = {}) {
    const elapsed = this._lastTime === null ? 0 : Math.max(0, Math.min(0.1, time - this._lastTime));
    this._lastTime = time;
    if (!paused && !this._motionPreference?.matches) this._animationTime += elapsed;
    // Update time + aspect for current material
    const mat = this.materials[this.mode];
    if (mat && mat.uniforms.uTime) mat.uniforms.uTime.value = this._animationTime;
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
