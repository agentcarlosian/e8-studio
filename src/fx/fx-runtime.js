// fx-runtime.js — Centralized FX system: pushes FX uniforms to all shader materials
//
// Why this exists:
//   - Each view has its own ShaderMaterial instances with uFXMode/uFXIntensity/uTime
//   - Without centralized pushing, changing FX in the panel does nothing visible
//   - This module walks the scene and updates all FX-aware materials in one place
//
// FX catalog (mirrors src/fx/fx-shader.js shader chunks):
//   0 = none, 1 = glow, 2 = trail, 3 = kaleidoscope, 4 = ripple, 5 = spiral
//
// Plus 3 NEW modes added here:
//   6 = pulse     — radial breathing scale (0.7..1.3 over 2s)
//   7 = chromatic  — RGB split with hue offset per axis
//   8 = fog        — depth-based fade with adjustable density
//
// Usage:
//   import { FXRuntime } from './fx/fx-runtime.js';
//   const fx = new FXRuntime(scene);
//   fx.setMode('glow');
//   fx.setIntensity(0.5);
//   fx.update(time);  // call each frame

// Single source of truth for the name→id mapping lives in fx-shader.js (which
// also defines the matching GLSL branches). Importing it here keeps the central
// FX pusher in sync — previously this file kept its own copy that was missing
// modes 21–23 (hologram/xray/crystal), so setMode() for those pushed `undefined`.
import { FX_MODE_MAP } from './fx-shader.js';

const FX_MODE_NAMES = Object.keys(FX_MODE_MAP);
const NEW_FX_MODES = ['pulse', 'chromatic', 'fog'];

export class FXRuntime {
  constructor(scene) {
    this.scene = scene;
    this.mode = 'none';
    this.intensity = 0.5;
    this.fxMaterials = new Set();
    this.lastTime = 0;
    this._scanMaterials();
  }

  // Walk the scene and collect every ShaderMaterial with uFXMode uniform
  _scanMaterials() {
    this.fxMaterials.clear();
    if (!this.scene) return;
    this.collectFromObject(this.scene);
  }

  registerMaterial(material) {
    if (!material || !material.uniforms || material.uniforms.uFXMode === undefined) return;
    this.fxMaterials.add(material);
    if (material.uniforms.uFXMode) material.uniforms.uFXMode.value = FX_MODE_MAP[this.mode] ?? 0;
    if (material.uniforms.uFXIntensity) material.uniforms.uFXIntensity.value = this.intensity;
  }

  unregisterMaterial(material) {
    if (material) this.fxMaterials.delete(material);
  }

  collectFromObject(object3d) {
    if (!object3d) return;
    object3d.traverse(obj => {
      if (Array.isArray(obj.material)) obj.material.forEach(m => this.registerMaterial(m));
      else this.registerMaterial(obj.material);
    });
  }

  /**
   * Rebuild the tracked-material set from the live scene. Call this after a view
   * swap: collectFromObject() only ADDS, so without a rescan the disposed view's
   * materials linger in fxMaterials forever — a leak that grows every view
   * switch (and every palette shift, which rebuilds the view), making update()
   * iterate a steadily larger set of dead materials each frame.
   */
  rescan() { this._scanMaterials(); }

  setMode(mode) {
    if (!FX_MODE_MAP.hasOwnProperty(mode)) mode = 'none';
    this.mode = mode;
    // NOTE: Do NOT set scene.fog — three.js r170's renderer calls fog.color.getRGB()
    // which was removed from Color in r163. The "fog" FX mode (uFXMode == 8) is
    // handled entirely in the shader's fragment shader via vWorldPos depth fade.
    // Push to all materials
    for (const m of this.fxMaterials) {
      if (m.uniforms.uFXMode) m.uniforms.uFXMode.value = FX_MODE_MAP[mode];
    }
  }

  setIntensity(v) {
    this.intensity = Math.max(0, Math.min(1, v));
    for (const m of this.fxMaterials) {
      if (m.uniforms.uFXIntensity) m.uniforms.uFXIntensity.value = this.intensity;
    }
  }

  // Call each frame to push uTime to every tracked material. Time-dependent FX
  // (glow pulse, ripple, spiral, chromatic shift, …) read uTime in-shader, so
  // this single uniform push animates them all.
  //
  // Note on 'trail': trail decay is intentionally NOT done here. Each view
  // decays its own colour attribute in its update() loop (it knows which
  // BufferGeometry attribute holds the per-vertex colours — pointsGeo for
  // e8coxeter, vGeo for sixhundred/polytope, etc.). Centralising it here would
  // require every view to expose its colour array under a common name; the
  // per-view approach keeps each view self-contained. See e.g.
  // e8coxeter.view.js (~line 1303), platonic.view.js (~line 499).
  update(time) {
    for (const m of this.fxMaterials) {
      if (m.uniforms.uTime) m.uniforms.uTime.value = time;
    }
  }

  // Get the numeric mode (for shader uniforms)
  getModeValue() { return FX_MODE_MAP[this.mode] || 0; }
}

export { FX_MODE_MAP, FX_MODE_NAMES, NEW_FX_MODES };
