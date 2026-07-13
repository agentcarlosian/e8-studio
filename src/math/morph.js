// math/morph.js — parametric vertex deformations for the Platonic solids.
//
// Shared by the live Platonic view (src/views/platonic.view.js) and the geometry
// export (src/main.js) so a morphed solid EXPORTS exactly as it RENDERS — twist
// + spike + jitter compose identically in both, with no risk of the two drifting.
//
//   m = { twist, spike, jitter }   (all default 0 = the undeformed solid)
//     twist  — helical rotation about Y by an angle proportional to height (y)
//     spike  — radial push-out by a per-vertex amount (spiky / stellated look)
//     jitter — deterministic positional roughening (crystalline)
//
// Takes the raw vertex components and returns the deformed [x, y, z].

export function deformPlatonicVert(vx, vy, vz, m) {
  let x = vx, y = vy, z = vz;
  if (m.spike) {
    const f = 1 + m.spike * (0.5 + 0.5 * Math.sin(vx * 12.9 + vy * 78.2 + vz * 37.7));
    x *= f; y *= f; z *= f;
  }
  if (m.twist) {
    const a = m.twist * y;
    const c = Math.cos(a), s = Math.sin(a);
    const nx = x * c - z * s, nz = x * s + z * c;
    x = nx; z = nz;
  }
  if (m.jitter) {
    x += m.jitter * 0.3 * Math.sin(vx * 23.1 + 1.7);
    y += m.jitter * 0.3 * Math.sin(vy * 19.3 + 4.2);
    z += m.jitter * 0.3 * Math.sin(vz * 27.7 + 2.9);
  }
  return [x, y, z];
}

/** True when any morph component is active (worth applying). */
export function morphActive(m) {
  return !!(m && (m.twist || m.spike || m.jitter));
}
