// mandelbox.js — Mandelbox fold math + GLSL injection.
//
// Why this exists:
//   The Bloom view renders 240 E₈ points across the Coxeter plane + 600-cell
//   slices. With the mandelbox enabled, each point's position is fed through
//   sphere-fold → box-fold → scale iterations, producing a beautiful
//   E₈-symmetric fractal fold that wraps the whole constellation.
//
//   The math: for a position p, the fold is iterated N times:
//     1. Sphere fold: if |p| < r, p *= r²/|p|²; else if |p| < 1, p *= 1/|p|²
//     2. Box fold: p = clamp(p, -1, 1) * 2 - p
//     3. Scale: p = p * scale + c   (c is the original position)
//   When this converges, the result is a tightly folded attractor that
//   preserves the input's gross shape while twisting it fractally.
//
// Usage in Bloom view's vertex shader:
//   import { VERTEX_MANDELBOX_FN } from '../fx/mandelbox.js';
//   ...
//   ${VERTEX_MANDELBOX_FN}     // declares vec3 mandelboxFold(vec3 p)
//   vec3 fxPos = mandelboxFold(position + fxO);
//   vec4 mv = modelViewMatrix * vec4(fxPos, 1.0);
//
// Parameters (per-shader-call via uniform):
//   uMandelboxEnable  float  0/1  — gate the fold (avoids branching in tight loops)
//   uMandelboxScale   float  1.5..3.5 — fold scale (golden ratio ~2.618 is the
//                                         classical mandelbox sweet spot)
//   uMandelboxIters   int    4..12     — iteration count (more = finer folds)
//   uMandelboxMix     float  0..1      — mix between original and folded position

export const VERTEX_MANDELBOX_FN = /* glsl */`
  // Mandelbox fold: iterate sphere-fold, box-fold, scale N times.
  // Returns the folded position (not mixed — caller applies uMandelboxMix).
  //
  // Classical constants (White & Nylander, 2010):
  //   rMin = 0.5, rFixed = 1.0, scale = 2.618 (golden ratio squared)
  vec3 mandelboxFold(vec3 p) {
    if (uMandelboxEnable < 0.5) return p;
    float rMin = 0.5;
    float rFixed = 1.0;
    float scale = uMandelboxScale;
    int iters = int(uMandelboxIters);
    vec3 c = p;
    for (int i = 0; i < 12; i++) {
      if (i >= iters) break;
      // Sphere fold
      float r2 = dot(p, p);
      if (r2 < rMin * rMin) {
        float t = (rFixed * rFixed) / max(r2, 1e-6);
        p *= t;
      } else if (r2 < rFixed * rFixed) {
        float t = rFixed * rFixed / max(r2, 1e-6);
        p *= t;
      }
      // Box fold
      p = clamp(p, vec3(-1.0), vec3(1.0)) * 2.0 - p;
      // Scale + offset
      p = p * scale + c;
    }
    return p;
  }
`;

// Reference parameters for users. Not enforced — just documentation.
// The Bloom view passes these via uniforms.
export const MANDELBOX_DEFAULTS = {
  enable: 0,         // off by default; user opts in
  scale: 2.618,      // golden ratio squared — classical mandelbox sweet spot
  iters: 6,          // 4..12 — 6 is a good balance of detail vs perf
  mix: 0.65,         // 0..1 — partial blend keeps the E8 structure legible
};
