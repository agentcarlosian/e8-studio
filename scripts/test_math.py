#!/usr/bin/env python3
"""Math-correctness regression test for the Lie-theory layer.

These are the bugs UI-fuzzing is blind to — wrong math that still renders fine:
  1. weyl.js's simple roots must generate E8 (root-system closure = 240), not the
     D8 sublattice (112) an earlier version produced.
  2. Their Cartan matrix must be a valid simply-laced E8 matrix (diag 2, off-diag
     in {0,-1}).
  3. brackets.js's `root` flags must match reality: [eαᵢ,eαⱼ] is nonzero iff
     αᵢ+αⱼ is a root iff the simple roots are Dynkin-adjacent.

Pure Node (the math modules import nothing), so it's fast and needs no browser.
Run: python scripts/test_math.py
"""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

JS = r"""
import { SIMPLE_ROOTS_8D } from './src/math/weyl.js';
import { BRACKET_TRIANGLES } from './src/math/brackets.js';
import { ESSAYS, ESSAY_CONTEXTS, TOUR_STOPS } from './src/content/essays.js';
import { FACT_SOURCES } from './src/content/sources.js';
import fs from 'node:fs';

const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
const key = v => v.map(x => (x === 0 ? 0 : x)).join(',');  // normalize -0 -> 0

function rootSystemClosure(S) {
  const set = new Map();
  S.forEach(r => set.set(key(r), r));
  let changed = true;
  while (changed) {
    changed = false;
    for (const r of [...set.values()]) {
      for (const al of S) {
        const c = dot(al, r);               // integer for E8 (even lattice)
        const nr = r.map((x, i) => x - c * al[i]);
        if (Math.abs(dot(nr, nr) - 2) < 1e-9 && !set.has(key(nr))) {
          set.set(key(nr), nr); changed = true;
        }
      }
    }
  }
  return set;
}

const fails = [];
const generatedE8 = JSON.parse(fs.readFileSync('./data/e8.json', 'utf8'));
if (JSON.stringify(generatedE8.simple_roots) !== JSON.stringify(SIMPLE_ROOTS_8D)) {
  fails.push('generated E8 simple roots differ from src/math/weyl.js');
}
const roots = rootSystemClosure(SIMPLE_ROOTS_8D);
if (roots.size !== 240) fails.push(`Weyl closure = ${roots.size} (want 240 = E8, not 112 = D8)`);

for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
  const A = Math.round(2 * dot(SIMPLE_ROOTS_8D[i], SIMPLE_ROOTS_8D[j]) / dot(SIMPLE_ROOTS_8D[j], SIMPLE_ROOTS_8D[j]));
  if (i === j && A !== 2) fails.push(`Cartan[${i}][${i}] = ${A} (want 2)`);
  if (i !== j && A !== 0 && A !== -1) fails.push(`Cartan[${i}][${j}] = ${A} (want 0 or -1)`);
}

for (const t of BRACKET_TRIANGLES) {
  const sum = SIMPLE_ROOTS_8D[t.a].map((x, i) => x + SIMPLE_ROOTS_8D[t.b][i]);
  const isRoot = roots.has(key(sum));   // αa+αb a root?  <=> bracket nonzero
  if (isRoot !== t.root) fails.push(`bracket (α${t.a + 1}, α${t.b + 1}): flag root=${t.root} but actual=${isRoot}`);
}

// Essay integrity: every essay referenced by a view context or the guided tour
// must actually be defined (no dangling references / typos).
const referenced = new Set();
for (const ids of Object.values(ESSAY_CONTEXTS)) for (const id of ids) referenced.add(id);
for (const stop of TOUR_STOPS) if (stop.essay) referenced.add(stop.essay);
for (const id of referenced) if (!ESSAYS[id]) fails.push(`essay reference '${id}' has no definition`);

for (const [essayId, essay] of Object.entries(ESSAYS)) {
  for (const sourceId of essay.sourceIds || []) {
    if (!FACT_SOURCES[sourceId]) fails.push(`essay '${essayId}' has unknown source '${sourceId}'`);
  }
}
for (const [sourceId, source] of Object.entries(FACT_SOURCES)) {
  if (!source.title || !source.scope || !source.tier || !source.url?.startsWith('https://')) {
    fails.push(`fact source '${sourceId}' is incomplete`);
  }
}

if (fails.length) { console.log('FAIL:\n  ' + fails.join('\n  ')); process.exit(1); }
console.log(`math OK: E8 Weyl closure = 240, Cartan valid, ${BRACKET_TRIANGLES.length} bracket flags correct, ${referenced.size} essay refs resolve`);
"""


def check_geometry_data() -> list[str]:
    """Validate the committed geometry data against known mathematical counts."""
    import json
    import numpy as np
    fails = []
    data = ROOT / "data"

    # Platonic solids: vertex/edge/face counts + Euler's formula V - E + F = 2
    # (faces here are triangles; F is the polygon-face count, derived per solid).
    plat = json.loads((data / "platonic.json").read_text())
    plat_expect = {  # verts, edges, polygon-faces
        "tetrahedron": (4, 6, 4), "cube": (8, 12, 6), "octahedron": (6, 12, 8),
        "dodecahedron": (20, 30, 12), "icosahedron": (12, 30, 20),
    }
    for name, (v, e, f) in plat_expect.items():
        s = plat.get(name, {})
        nv, ne = len(s.get("verts", [])), len(s.get("edges", []))
        if (nv, ne) != (v, e):
            fails.append(f"platonic {name}: {nv}v/{ne}e (want {v}v/{e}e)")
        if nv - ne + f != 2:
            fails.append(f"platonic {name}: Euler V-E+F = {nv-ne+f} (want 2)")

    # 4D regular polytopes
    poly = json.loads((data / "polytopes4d.json").read_text())
    poly_expect = {"5cell": (5, 10), "tesseract": (16, 32), "16cell": (8, 24),
                   "24cell": (24, 96), "600cell": (120, 720)}
    for name, (v, e) in poly_expect.items():
        s = poly.get(name, {})
        nv, ne = len(s.get("verts", [])), len(s.get("edges", []))
        if (nv, ne) != (v, e):
            fails.append(f"4D {name}: {nv}v/{ne}e (want {v}v/{e}e)")
    # 600-cell conjugacy classes = binary icosahedral group 2I (order 120, 9 classes)
    cs = poly.get("600cell", {}).get("class_sizes", [])
    if len(cs) != 9 or sum(cs) != 120:
        fails.append(f"600cell conjugacy classes {cs} (want 9 classes summing to 120)")

    # E8 root system: 240 roots
    e8 = json.loads((data / "e8.json").read_text())
    if e8.get("count") != 240 or len(e8.get("roots8d", [])) != 240:
        fails.append(f"E8 roots: count={e8.get('count')} (want 240)")
    counts = e8.get("ring_counts", [])
    radii = e8.get("ring_radii", [])
    if counts != [30] * 8 or len(radii) != 8 or any(r <= 0 for r in radii):
        fails.append(f"E8 Coxeter rings: radii={radii}, counts={counts} (want 8 positive radii, 30 roots each)")
    projected = {(round(p["x"], 9), round(p["y"], 9)) for p in e8.get("proj2d", [])}
    if len(projected) != 240:
        fails.append(f"E8 Coxeter projection has {len(projected)} distinct points (want 240)")

    # Rebuild the Coxeter element independently from the committed simple roots.
    # This catches the former D8/E8 generator mismatch even when a projection
    # happens to contain 240 entries and the renderer looks plausible.
    simple = np.asarray(e8.get("simple_roots", []), dtype=float)
    roots8 = np.asarray(e8.get("roots8d", []), dtype=float)
    if simple.shape != (8, 8):
        fails.append(f"E8 simple-root matrix has shape {simple.shape} (want 8x8)")
    else:
        gram = simple @ simple.T
        degrees = sorted(int(np.count_nonzero(np.isclose(row, -1.0))) for row in gram)
        if not np.allclose(np.diag(gram), 2.0) or degrees != [1, 1, 1, 2, 2, 2, 2, 3]:
            fails.append(f"simple-root Gram graph is not E8 (degrees={degrees})")
        coxeter = np.eye(8)
        for alpha in simple:
            reflection = np.eye(8) - np.outer(alpha, alpha)
            coxeter = reflection @ coxeter
        if not np.allclose(np.linalg.matrix_power(coxeter, 30), np.eye(8), atol=1e-8):
            fails.append("generated Coxeter element does not have order dividing 30")
        orbit_lengths = []
        unseen = {tuple(np.round(root, 8)) for root in roots8}
        while unseen:
            start = np.asarray(next(iter(unseen)))
            current = start.copy()
            orbit = set()
            for _ in range(31):
                key = tuple(np.round(current, 8))
                if key in orbit:
                    break
                orbit.add(key)
                current = coxeter @ current
            orbit_lengths.append(len(orbit))
            unseen.difference_update(orbit)
        if sorted(orbit_lengths) != [30] * 8:
            fails.append(f"Coxeter root orbits are {sorted(orbit_lengths)} (want eight 30-cycles)")
    return fails


def main() -> int:
    # --no-warnings silences the typeless-package-json notice; we can't set
    # "type":"module" in package.json because electron/main.js uses CommonJS.
    r = subprocess.run(["node", "--no-warnings", "--input-type=module", "-e", JS],
                       cwd=ROOT, capture_output=True, text=True)
    sys.stdout.write(r.stdout)
    if r.stderr:
        sys.stderr.write(r.stderr)

    data_fails = check_geometry_data()
    if data_fails:
        print("FAIL (geometry data):\n  " + "\n  ".join(data_fails))
    else:
        print("geometry data OK: Platonic/4D counts + canonical E8 Coxeter 8x30 projection")
    return r.returncode or (1 if data_fails else 0)


if __name__ == "__main__":
    raise SystemExit(main())
