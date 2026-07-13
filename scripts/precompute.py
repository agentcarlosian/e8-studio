#!/usr/bin/env python3
"""Precompute all geometric data for E8 ↔ Platonics Studio.

Outputs JSON files in ../data/. Each file is consumed by the JS app at load time.
"""
import json
import os
import math
import numpy as np
from itertools import product, combinations

PHI = (1 + math.sqrt(5)) / 2
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')
os.makedirs(OUT_DIR, exist_ok=True)


def write_json(name, obj):
    path = os.path.join(OUT_DIR, name)
    with open(path, 'w') as f:
        json.dump(obj, f, separators=(',', ':'))
    print(f"  {name}: {os.path.getsize(path):,} bytes")


# ============================================================================
# E8 ROOT SYSTEM
# ============================================================================
print("E8 roots...")

def build_e8():
    roots = []
    # Type 1: ±e_i ± e_j (i < j) — 112 roots
    for i, j in combinations(range(8), 2):
        for s1 in [1, -1]:
            for s2 in [1, -1]:
                v = [0.0] * 8
                v[i] = s1
                v[j] = s2
                roots.append(v)
    # Type 2: ½(±1, ±1, ..., ±1) with even number of minuses — 128 roots
    for signs in product([1, -1], repeat=8):
        if sum(1 for s in signs if s == -1) % 2 == 0:
            roots.append([0.5 * s for s in signs])
    roots = np.array(roots)
    assert len(roots) == 240
    assert np.allclose(np.sum(roots**2, axis=1), 2.0), "Roots not unit-length"
    return roots


def build_simple_roots():
    """E8 simple roots in the even-coordinate realization used by the app.

    Keep this basis synchronized with ``src/math/weyl.js``.  The tempting
    all-integer basis e_i-e_{i+1}, e_7+e_8 is D8, not E8; using it here gives
    the wrong Coxeter element and a non-canonical 12-radius projection.
    """
    return np.array([
        [ 1.0,  1.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0],
        [-1.0,  0.0,  1.0,  0.0,  0.0,  0.0,  0.0,  0.0],
        [ 1.0, -1.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0],
        [-0.5,  0.5, -0.5,  0.5,  0.5,  0.5,  0.5,  0.5],
        [ 0.0,  0.0,  0.0, -1.0, -1.0,  0.0,  0.0,  0.0],
        [ 0.0,  0.0,  0.0,  1.0,  0.0, -1.0,  0.0,  0.0],
        [ 0.0,  0.0,  0.0,  0.0,  0.0,  1.0, -1.0,  0.0],
        [-0.5,  0.5, -0.5, -0.5,  0.5, -0.5, -0.5, -0.5],
    ])


def coxeter_element(simple=None):
    """Return a Coxeter element built from the chosen E8 simple roots."""
    S = build_simple_roots() if simple is None else np.asarray(simple, dtype=float)
    # Coxeter element = product of all simple reflections
    C = np.eye(8)
    for a in S:
        reflection = np.eye(8) - 2 * np.outer(a, a) / (a @ a)
        C = reflection @ C
    return C


def coxeter_basis():
    """Compute Coxeter plane basis via the Coxeter element of E8 (h=30)."""
    C = coxeter_element()

    eigvals, eigvecs = np.linalg.eig(C)
    # Eigenvalue closest to e^(2πi/30) (Coxeter eigenvalue for h=30)
    target = np.exp(1j * 2 * np.pi / 30)
    idx = np.argmin(np.abs(eigvals - target))
    v = eigvecs[:, idx]
    v_re = v.real / np.linalg.norm(v.real)
    v_im = v.imag / np.linalg.norm(v.imag)
    return v_re, v_im


def build_e8_data():
    roots = build_e8()
    simple = build_simple_roots()
    v_re, v_im = coxeter_basis()

    proj_x = (roots @ v_re).astype(float).tolist()
    proj_y = (roots @ v_im).astype(float).tolist()
    radii = [math.sqrt(x*x + y*y) for x, y in zip(proj_x, proj_y)]

    # Group roots into Coxeter rings by radius (within tolerance)
    rings = {}
    for i, r in enumerate(radii):
        key = round(r, 3)
        rings.setdefault(key, []).append(i)
    ring_radii = sorted(rings.keys())
    ring_counts = [len(rings[r]) for r in ring_radii]
    distinct_points = {
        (round(proj_x[i], 9), round(proj_y[i], 9)) for i in range(len(roots))
    }
    assert len(ring_radii) == 8, f"E8 Coxeter plane: expected 8 radii, got {ring_radii}"
    assert ring_counts == [30] * 8, f"E8 Coxeter plane: expected 8x30 roots, got {ring_counts}"
    assert len(distinct_points) == 240, "E8 Coxeter projection must be injective on the roots"

    return {
        'count': 240,
        'roots8d': roots.tolist(),
        'simple_roots': simple.tolist(),
        'coxeter_basis': {'re': v_re.tolist(), 'im': v_im.tolist()},
        'proj2d': [{'x': proj_x[i], 'y': proj_y[i], 'r': radii[i], 'ring': ring_radii.index(round(radii[i], 3))} for i in range(240)],
        'ring_radii': ring_radii,
        'ring_counts': ring_counts,
    }


def build_e8_math(e8_data):
    """Build companion indices from the same canonical E8 realization.

    Keeping this generated prevents the renderer's selected simple roots and
    Coxeter orbit from silently drifting away from ``data/e8.json``.
    """
    roots = np.asarray(e8_data['roots8d'], dtype=float)
    simple = np.asarray(e8_data['simple_roots'], dtype=float)
    root_index = {tuple(np.round(root, 8)): i for i, root in enumerate(roots)}
    simple_indices = [root_index[tuple(np.round(alpha, 8))] for alpha in simple]

    cartan_neighbors = {}
    for i, root_idx in enumerate(simple_indices):
        # Edges of the E8 root polytope join roots with inner product 1,
        # equivalently squared Euclidean distance 2.  Each root has 56.
        neighbors = [
            j for j, beta in enumerate(roots)
            if j != root_idx and abs(float(simple[i] @ beta) - 1.0) < 1e-9
        ]
        assert len(neighbors) == 56, f"alpha{i + 1}: expected 56 root-polytope neighbors"
        cartan_neighbors[f'alpha{i + 1}'] = {
            'idx': root_idx,
            'neighbors': neighbors,
            'count': len(neighbors),
        }

    coxeter = coxeter_element(simple)
    outer_ring = len(e8_data['ring_radii']) - 1
    start_idx = next(i for i, p in enumerate(e8_data['proj2d']) if p['ring'] == outer_ring)
    current = roots[start_idx].copy()
    cycle = []
    for _ in range(30):
        idx = root_index[tuple(np.round(current, 8))]
        cycle.append(idx)
        current = coxeter @ current
    assert len(set(cycle)) == 30, "E8 Coxeter orbit must contain 30 distinct roots"
    assert np.allclose(current, roots[start_idx]), "E8 Coxeter orbit must close after 30 steps"
    assert all(e8_data['proj2d'][i]['ring'] == outer_ring for i in cycle)
    assert all(
        abs(float(roots[cycle[i]] @ roots[cycle[(i + 1) % 30]]) - 1.0) < 1e-9
        for i in range(30)
    ), "outer Coxeter orbit must follow edges of the E8 root polytope"

    return {
        'petrie_cycle_30': cycle,
        'simple_root_indices': simple_indices,
        'cartan_neighbors': cartan_neighbors,
        'coxeter_number': 30,
        'weyl_group_order': 696729600,
        'dim': 248,
        'rank': 8,
    }


# ============================================================================
# PLATONIC SOLIDS
# ============================================================================
print("Platonic solids...")

def nearest_edges(verts):
    """Edges of a regular solid = all vertex pairs at the minimum pairwise
    distance (every edge has equal length). Robust replacement for hand-tuned
    dot-product thresholds, which were brittle and produced 0 edges for the
    normalized dodecahedron."""
    V = [np.array(v, dtype=float) for v in verts]
    n = len(V)
    dists = [float(np.linalg.norm(V[i] - V[j])) for i in range(n) for j in range(i + 1, n)]
    dmin = min(dists)
    tol = 1e-3 * dmin
    return [[i, j] for i in range(n) for j in range(i + 1, n)
            if abs(float(np.linalg.norm(V[i] - V[j])) - dmin) < tol]


def convex_faces(verts):
    """Triangulate the convex hull of origin-centred vertices.

    Returns a list of [a, b, c] index triples with outward-facing winding.
    A vertex triple is a hull facet iff every other vertex lies on one side of
    its plane; coplanar facets (cube squares, dodecahedron pentagons) are then
    gathered, ordered CCW about their centroid, and fan-triangulated.
    """
    V = [np.array(v, dtype=float) for v in verts]
    n = len(V)
    if n < 4:
        return []
    maxr = max(float(np.linalg.norm(v)) for v in V) or 1.0
    eps = 1e-4 * maxr
    planes = {}
    for i in range(n):
        for j in range(i + 1, n):
            for k in range(j + 1, n):
                nrm = np.cross(V[j] - V[i], V[k] - V[i])
                ln = float(np.linalg.norm(nrm))
                if ln < eps:
                    continue
                nrm = nrm / ln
                d = float(nrm @ V[i])
                s = np.array([float(nrm @ V[m]) - d for m in range(n)])
                if np.any(s > eps) and np.any(s < -eps):
                    continue  # not a hull facet
                if d < 0:
                    nrm, d = -nrm, -d  # orient outward
                key = tuple(np.round(np.append(nrm, d) / eps).astype(int))
                planes.setdefault(key, (nrm, d))
    faces = []
    for nrm, d in planes.values():
        idx = [m for m in range(n) if abs(float(nrm @ V[m]) - d) < 10 * eps]
        if len(idx) < 3:
            continue
        u = np.array([1.0, 0, 0]) if abs(nrm[0]) < 0.9 else np.array([0, 1.0, 0])
        u = u - (u @ nrm) * nrm
        u = u / np.linalg.norm(u)
        w = np.cross(nrm, u)
        c = sum(V[m] for m in idx) / len(idx)
        idx.sort(key=lambda m: math.atan2(float((V[m] - c) @ w), float((V[m] - c) @ u)))
        for t in range(1, len(idx) - 1):
            faces.append([idx[0], idx[t], idx[t + 1]])
    return faces


def platonic_solids():
    out = {}

    # Tetrahedron
    out['tetrahedron'] = {
        'verts': [[1,1,1], [1,-1,-1], [-1,1,-1], [-1,-1,1]],
        'edges': [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]],
    }

    # Cube
    cube_v = [(s1,s2,s3) for s1 in (-1,1) for s2 in (-1,1) for s3 in (-1,1)]
    cube_e = []
    for i in range(8):
        for j in range(i+1, 8):
            if sum(abs(a-b) for a,b in zip(cube_v[i], cube_v[j])) == 2:
                cube_e.append([i, j])
    out['cube'] = {'verts': cube_v, 'edges': cube_e}

    # Octahedron
    oct_v = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]
    oct_e = []
    for i in range(6):
        for j in range(i+1, 6):
            if sum((a-b)**2 for a,b in zip(oct_v[i], oct_v[j])) == 2:
                oct_e.append([i, j])
    out['octahedron'] = {'verts': oct_v, 'edges': oct_e}

    # Dodecahedron — golden ratio construction
    dod = []
    for s1 in (-1,1):
        for s2 in (-1,1):
            for s3 in (-1,1):
                dod.append([s1,s2,s3])
    for triple in [(0, 1/PHI, PHI),(0, 1/PHI, -PHI),(0, -1/PHI, PHI),(0, -1/PHI, -PHI),
                    (1/PHI, PHI, 0),(1/PHI, -PHI, 0),(-1/PHI, PHI, 0),(-1/PHI, -PHI, 0),
                    (PHI, 0, 1/PHI),(PHI, 0, -1/PHI),(-PHI, 0, 1/PHI),(-PHI, 0, -1/PHI)]:
        dod.append(list(triple))
    dod = [(np.array(v)/np.linalg.norm(v)).tolist() for v in dod]
    out['dodecahedron'] = {'verts': dod, 'edges': nearest_edges(dod)}

    # Icosahedron
    ico = []
    for s1 in (-1,1):
        for s2 in (-1,1):
            ico.append([0, s1, s2*PHI])
    for s1 in (-1,1):
        for s2 in (-1,1):
            ico.append([s1, s2*PHI, 0])
    for s1 in (-1,1):
        for s2 in (-1,1):
            ico.append([s1*PHI, 0, s2])
    ico = [(np.array(v)/np.linalg.norm(v)).tolist() for v in ico]
    ico_e = []
    for i in range(12):
        for j in range(i+1, 12):
            d = sum(a*b for a,b in zip(ico[i], ico[j]))
            if abs(d - 1/math.sqrt(5)) < 0.02:
                ico_e.append([i, j])
    out['icosahedron'] = {'verts': ico, 'edges': ico_e}

    # Derive correct triangulated faces from the convex hull. (Earlier versions
    # of this file shipped no faces, and a downstream tool then baked in WRONG
    # triangles — spanning non-adjacent vertices — that sliced through the solid.)
    expected_faces = {'tetrahedron': 4, 'cube': 12, 'octahedron': 8,
                      'dodecahedron': 36, 'icosahedron': 20}
    expected_edges = {'tetrahedron': 6, 'cube': 12, 'octahedron': 12,
                      'dodecahedron': 30, 'icosahedron': 30}
    for name, solid in out.items():
        solid['faces'] = convex_faces(solid['verts'])
        ef, ee = len(solid['faces']), len(solid['edges'])
        wf, we = expected_faces[name], expected_edges[name]
        print(f"    {name}: {len(solid['verts'])} verts, {ee} edges, {ef} tris")
        assert ef == wf, f"{name}: {ef} face triangles, expected {wf}"
        assert ee == we, f"{name}: {ee} edges, expected {we}"

    return out


# ============================================================================
# 4D POLYTOPES (including 600-cell)
# ============================================================================
print("4D polytopes...")

def polytopes_4d():
    out = {}

    # 5-cell (4-simplex)
    v5 = [[1,1,1,-1/math.sqrt(5)], [1,-1,-1,-1/math.sqrt(5)], [-1,1,-1,-1/math.sqrt(5)], [-1,-1,1,-1/math.sqrt(5)], [0,0,0,math.sqrt(5)-1/math.sqrt(5)]]
    out['5cell'] = {'verts': v5, 'edges': [[i,j] for i in range(5) for j in range(i+1,5)]}

    # Tesseract
    tess_v = [(s1,s2,s3,s4) for s1 in (-1,1) for s2 in (-1,1) for s3 in (-1,1) for s4 in (-1,1)]
    tess_e = []
    for i in range(16):
        for j in range(i+1, 16):
            if sum(abs(a-b) for a,b in zip(tess_v[i], tess_v[j])) == 2:
                tess_e.append([i, j])
    out['tesseract'] = {'verts': tess_v, 'edges': tess_e}

    # 16-cell
    cell16_v = [[1,0,0,0],[-1,0,0,0],[0,1,0,0],[0,-1,0,0],[0,0,1,0],[0,0,-1,0],[0,0,0,1],[0,0,0,-1]]
    cell16_e = []
    for i in range(8):
        for j in range(i+1, 8):
            if sum(a*b for a,b in zip(cell16_v[i], cell16_v[j])) == 0:
                cell16_e.append([i, j])
    out['16cell'] = {'verts': cell16_v, 'edges': cell16_e}

    # 24-cell
    v24 = []
    for positions in [(0,1), (0,2), (0,3), (1,2), (1,3), (2,3)]:
        for s1 in (-1,1):
            for s2 in (-1,1):
                v = [0,0,0,0]
                v[positions[0]] = s1
                v[positions[1]] = s2
                v24.append(v)
    # 24-cell edges are the MINIMAL-distance pairs. Vertices are permutations of
    # (±1,±1,0,0) with |v|²=2, and an edge has squared length 2, i.e. inner
    # product <v,w> = (|v|²+|w|²−|v−w|²)/2 = (2+2−2)/2 = 1. (The previous rule used
    # <v,w>≈0, which is the NEXT shell — it gave 72 edges instead of the correct 96.)
    e24 = []
    for i in range(24):
        for j in range(i+1, 24):
            d = sum(a*b for a,b in zip(v24[i], v24[j]))
            if abs(d - 1) < 0.01:
                e24.append([i, j])
    out['24cell'] = {'verts': v24, 'edges': e24}

    # 600-cell — Wikipedia construction:
    #   Type A: 8 vertices  — permutations of (±1, 0, 0, 0)
    #   Type B: 16 vertices — (±½, ±½, ±½, ±½) all 16 sign combos
    #   Type C: 96 vertices — even permutations of ½(0, ±1, ±φ, ±φ⁻¹)
    # Total: 120
    v600 = []

    # Type A: (±1, 0, 0, 0) and coordinate permutations
    for i in range(4):
        v = [0.0] * 4
        v[i] = 1.0
        v600.append(v[:])
        v[i] = -1.0
        v600.append(v[:])

    # Type B: all sign combinations of (±½, ±½, ±½, ±½)
    for s in product([-0.5, 0.5], repeat=4):
        v600.append(list(s))

    # Type C: even permutations of ½(0, ±1, ±φ, ±φ⁻¹) for all sign choices
    # "Even permutations" of a 4-tuple = permutations of sign +1 (12 of 24)
    base = [0.0, 1.0, PHI, 1.0/PHI]
    EVEN_PERMS = []  # all permutations of (0,1,2,3) with even parity
    from itertools import permutations
    for p in permutations([0, 1, 2, 3]):
        # parity: count inversions
        inv = sum(1 for i in range(4) for j in range(i+1, 4) if p[i] > p[j])
        if inv % 2 == 0:
            EVEN_PERMS.append(p)

    for signs in product([-1, 1], repeat=4):
        # signs[0] multiplies base[0]=0, so it's irrelevant; use signs for (1, φ, φ⁻¹)
        signed_base = [0.0, signs[1]*1.0, signs[2]*PHI, signs[3]/PHI]
        # Apply each even permutation
        for perm in EVEN_PERMS:
            v = [signed_base[perm[i]] * 0.5 for i in range(4)]  # scale by ½
            v600.append(v)

    # Dedupe (rounding can cause near-duplicates)
    seen = set()
    unique = []
    for v in v600:
        key = tuple(round(x, 6) for x in v)
        if key not in seen:
            seen.add(key)
            unique.append(v)
    assert len(unique) == 120, f"600-cell expected 120 verts, got {len(unique)}"
    # Normalize to unit radius (construction is unit-length, safety check)
    v600 = [(np.array(v) / np.linalg.norm(v)).tolist() for v in unique]

    # Edges: connect vertices at squared distance = 1/φ² ≈ 0.382 (unit-radius edge length)
    edge_sq = 1.0 / (PHI**2)
    e600 = []
    for i in range(120):
        for j in range(i+1, 120):
            d2 = sum((a-b)**2 for a, b in zip(v600[i], v600[j]))
            if abs(d2 - edge_sq) < 0.02:
                e600.append([i, j])
    # Should be 720 edges
    print(f"    600cell edges: {len(e600)} (expected 720)")

    # Classify vertices into 9 conjugacy classes by rotation angle from identity.
    # Identity = one of the 120 vertices. Pick v600[0] as identity.
    # As unit quaternions (since 600-cell vertices lie on S³ ⊂ R⁴), dot product with
    # identity gives cos(θ/2) where θ is the rotation angle in SO(3).
    # The 9 classes have angles {0, 72, 120, 144, 180, 216, 240, 288, 360} degrees,
    # giving half-angle cosines {1, cos36, cos60, cos72, 0, cos108, cos120, cos144, -1}.
    identity = v600[0]  # [1, 0, 0, 0]
    half_angles = [1.0, math.cos(math.radians(36)), math.cos(math.radians(60)),
                   math.cos(math.radians(72)), 0.0,
                   math.cos(math.radians(108)), math.cos(math.radians(120)),
                   math.cos(math.radians(144)), -1.0]
    class_sizes = [1, 12, 20, 12, 30, 12, 20, 12, 1]
    dot_classes = []
    for v in v600:
        d = sum(a*b for a, b in zip(v, identity))
        cls = min(range(9), key=lambda k: abs(d - half_angles[k]))
        dot_classes.append(cls)

    # Sanity-check that class counts match expected
    from collections import Counter
    actual = Counter(dot_classes)
    expected = {i: c for i, c in enumerate(class_sizes)}
    if dict(actual) != expected:
        print(f"    WARNING: 600-cell class counts {dict(actual)} != expected {expected}")
    else:
        print(f"    600cell conjugacy classes OK: {class_sizes}")

    out['600cell'] = {
        'verts': v600,
        'edges': e600,
        'conjugacy_classes': dot_classes,
        'class_sizes': class_sizes,
    }

    # ── 120-cell {5,3,3} — the dual of the 600-cell ──
    # The 120-cell has 600 vertices, 1200 edges, 720 pentagonal faces, 120
    # dodecahedral cells. As the dual of the 600-cell {3,3,5}, its 600 vertices
    # are the centers of the 600-cell's 600 tetrahedral cells. We find those
    # cells as the 4-cliques of the 600-cell's edge graph, take each cell's
    # centroid, and normalize to the unit 3-sphere. Edges then connect
    # centroid-pairs at the (single) 120-cell edge length.
    adj600 = [set() for _ in range(120)]
    for a, b in e600:
        adj600[a].add(b)
        adj600[b].add(a)
    cells600 = []
    for i in range(120):
        nbrs = [x for x in adj600[i] if x > i]
        for a, b, c in combinations(nbrs, 3):
            if a in adj600[b] and a in adj600[c] and b in adj600[c]:
                cells600.append([i, a, b, c])
    assert len(cells600) == 600, f"600-cell tetrahedral cells: expected 600, got {len(cells600)}"

    def _normalize4(p):
        r = math.sqrt(sum(x * x for x in p)) or 1.0
        return [x / r for x in p]

    v120 = []
    seen120 = set()
    for cell in cells600:
        centroid = [sum(v600[idx][k] for idx in cell) / 4 for k in range(4)]
        p = _normalize4(centroid)
        key = tuple(round(x, 6) for x in p)
        if key not in seen120:
            seen120.add(key)
            v120.append(p)
    assert len(v120) == 600, f"120-cell verts: expected 600, got {len(v120)}"

    # Edge length = the smallest pairwise distance (sampled; the {5,3,3} has
    # a single edge length). Build the edge list by matching that distance.
    sample_d = sorted(
        math.sqrt(sum((v120[i][k] - v120[j][k]) ** 2 for k in range(4)))
        for i in range(min(50, len(v120)))
        for j in range(i + 1, len(v120))
    )
    edge_len120 = sample_d[0]
    e120 = []
    for i in range(600):
        for j in range(i + 1, 600):
            d = math.sqrt(sum((v120[i][k] - v120[j][k]) ** 2 for k in range(4)))
            if abs(d - edge_len120) < 0.01:
                e120.append([i, j])
    print(f"    120cell edges: {len(e120)} (expected 1200)")
    assert len(e120) == 1200, f"120-cell edges: expected 1200, got {len(e120)}"

    out['120cell'] = {
        'verts': v120,
        'edges': e120,
    }

    return out


# ============================================================================
# DYNKIN DIAGRAMS (ADE only, with edges + node positions)
# ============================================================================
print("Dynkin diagrams...")

def dynkin_diagrams():
    out = {}
    # Layout: (node_positions, edges, name)
    # Node positions normalized so diagram fits in [-3.5, 3.5] horizontally
    out['A3']  = {'nodes': [[-1.5,0],[-0.5,0],[0.5,0],[1.5,0]], 'edges': [[0,1],[1,2],[2,3]], 'name': 'A₃'}
    out['A4']  = {'nodes': [[-2,0],[-1,0],[0,0],[1,0],[2,0]], 'edges': [[0,1],[1,2],[2,3],[3,4]], 'name': 'A₄'}
    out['A5']  = {'nodes': [[-2.5,0],[-1.5,0],[-0.5,0],[0.5,0],[1.5,0],[2.5,0]], 'edges': [[0,1],[1,2],[2,3],[3,4],[4,5]], 'name': 'A₅'}
    out['A7']  = {'nodes': [[i-3.5,0] for i in range(8)], 'edges': [[i,i+1] for i in range(7)], 'name': 'A₇'}

    out['D4']  = {'nodes': [[-1.5,0],[-0.5,0],[0.5,0],[0.5,-1],[0.5,1]], 'edges': [[0,1],[1,2],[2,3],[2,4]], 'name': 'D₄'}
    out['D5']  = {'nodes': [[-2,0],[-1,0],[0,0],[1,0],[1,1],[1,-1]], 'edges': [[0,1],[1,2],[2,3],[3,4],[3,5]], 'name': 'D₅'}
    out['D6']  = {'nodes': [[-2.5,0],[-1.5,0],[-0.5,0],[0.5,0],[1.5,0],[1.5,1],[1.5,-1]], 'edges': [[0,1],[1,2],[2,3],[3,4],[4,5],[4,6]], 'name': 'D₆'}

    # E series: legs of length 5-2-3 (or 4-2-3 / 3-2-3 for E6/E7)
    out['E6']  = {'nodes': [[-2.5,0],[-1.5,0],[-0.5,0],[0.5,0],[1.5,0],[-0.5,-1]],
                  'edges': [[0,1],[1,2],[2,3],[3,4],[2,5]], 'name': 'E₆'}
    out['E7']  = {'nodes': [[-3,0],[-2,0],[-1,0],[0,0],[1,0],[2,0],[-1,-1]],
                  'edges': [[0,1],[1,2],[2,3],[3,4],[4,5],[2,6]], 'name': 'E₇'}
    out['E8']  = {'nodes': [[-3.5,0],[-2.5,0],[-1.5,0],[-0.5,0],[0.5,0],[1.5,0],[2.5,0],[-1.5,-1]],
                  'edges': [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[2,7]], 'name': 'E₈'}

    return out


# ============================================================================
# McKAY CORRESPONDENCE (CORRECTED)
# ============================================================================
print("McKay correspondence...")

def mckay_table():
    # Classical McKay correspondence: finite subgroups of SU(2) map to affine
    # ADE diagrams through the tensor-product graph of their irreducible reps.
    return {
        'tetrahedron':  {'symmetry': 'T',  'roots': 'E6', 'description': 'Binary tetrahedral group (24 elements) ↔ affine E₆ McKay diagram'},
        'cube':         {'symmetry': 'O',  'roots': 'E7', 'description': 'Binary octahedral group (48 elements) ↔ affine E₇ McKay diagram'},
        'octahedron':   {'symmetry': 'O',  'roots': 'E7', 'description': 'Binary octahedral group (48 elements) ↔ affine E₇ McKay diagram (dual solid: cube)'},
        'dodecahedron': {'symmetry': 'I',  'roots': 'E8', 'description': 'Binary icosahedral group (120 elements) ↔ affine E₈ McKay diagram'},
        'icosahedron':  {'symmetry': 'I',  'roots': 'E8', 'description': 'Binary icosahedral group (120 elements) ↔ affine E₈ McKay diagram; its unit quaternions form a 600-cell'},
    }


# ============================================================================
# RUN
# ============================================================================
if __name__ == '__main__':
    e8_data = build_e8_data()
    write_json('e8.json', e8_data)
    write_json('e8_math.json', build_e8_math(e8_data))
    write_json('platonic.json', platonic_solids())
    write_json('polytopes4d.json', polytopes_4d())
    write_json('dynkin.json', dynkin_diagrams())
    write_json('mckay.json', mckay_table())
    print("\nDone. Files in:", OUT_DIR)
