// essays.js — "Why E₈ matters" contextual annotations
//
// Each essay is a short passage shown when the user views the corresponding
// mathematical structure. Designed to reward curiosity without overwhelming
// the visual experience. Most essays fit in <200 words.

export const ESSAYS = {
  // ===== E₈ root system =====
  e8_overview: {
    title: 'Why E₈ matters',
    sourceIds: ['mit-e8-plane', 'aim-e8-technical'],
    body: `E₈ is the largest exceptional simple Lie group. Its root system is a configuration of 240 vectors in 8-dimensional space. The Coxeter-plane view is an orthogonal projection onto a distinguished 2D plane, where the roots form eight concentric circles of 30 projected roots each.

The group W(E₈) — its symmetries — has order 696,729,600. That's 2¹⁴ · 3⁵ · 5² · 7. It acts on the 4₂₁ polytope, the 8-dimensional convex hull of the 240 roots. Because human vision is bound to 3D, we cannot intuit E₈ the way we intuit a cube or an icosahedron — but the Coxeter projection here, and the Petrie polygon, are two of the most informative shadows we've found.`,
  },

  e8_mckay: {
    title: 'The McKay correspondence',
    sourceIds: ['mckay-michigan-notes', 'kostant-gosset-circles'],
    body: `The rotational symmetry group of the icosahedron lifts to the binary icosahedral group, a finite subgroup of SU(2) of order 120. It has nine irreducible complex representations. McKay's construction records how the defining 2-dimensional representation tensors with those irreducibles; the resulting graph is the affine E₈ Dynkin diagram.

The 600-cell provides a related geometric model because its 120 vertices can be identified with the binary icosahedral group as unit quaternions. The Studio's transitions between Platonic solids, the 600-cell, and E₈ are guided visual comparisons; they are not a claim that duplicating a 600-cell literally produces the E₈ root system.`,
  },

  e8_dim: {
    title: 'Why dimension 248?',
    sourceIds: ['aim-e8-technical'],
    body: `The Lie algebra of E₈ has dimension 248. Its Cartan subalgebra contributes 8 dimensions, and each of the 240 roots contributes a one-dimensional root space: 8 + 240 = 248.

E₈ also appears in mathematical physics. One of the two ten-dimensional heterotic string theories has gauge group E₈ × E₈. That physical application is separate from the elementary dimension count shown here.`,
  },

  // ===== 600-cell =====
  sixhundred_overview: {
    title: 'The 600-cell',
    sourceIds: ['mathworld-600-cell'],
    body: `The 600-cell is a regular 4-dimensional polytope with 120 vertices, 720 edges, 1200 triangular faces, and 600 tetrahedral cells. It is not self-dual: its dual is the 120-cell.

After normalization, its 120 vertices lie on the unit 3-sphere in 4D and can be identified with the unit quaternions of the binary icosahedral group. The wireframe here is a 3D projection of those 4D vertices and edges.`,
  },

  sixhundred_conjugacy: {
    title: 'Conjugacy classes',
    body: `The 120 vertices of the 600-cell split into 9 "rotation shells" by angle. Identity (1 vertex, no rotation), 72° and 144° and 216° and 288° (the four icosahedral rotations, 12 each), 120° and 240° (dodecahedral, 20 each), 180° (icosidodecahedral, 30), and antipode (1). Total: 1+12+20+12+30+12+20+12+1 = 120. ✓

These class sizes describe the binary icosahedral group. They do not, by themselves, imply a connection to the Monster group or Monstrous Moonshine.`,
  },

  // ===== Platonic solids =====
  platonic_duals: {
    title: 'Platonic duals',
    body: `Tetra ↔ Tetra (self-dual)
Cube ↔ Octahedron
Dodecahedron ↔ Icosahedron

Each dual pairs a shape whose faces equal the other's vertices. The cube has 6 faces; the octahedron has 6 vertices. The dodecahedron has 12 faces; the icosahedron has 12 vertices. Each pair sits at the same McKay root system level (cube/octa both → E₇, dodeca/icosa both → E₈).

Switch between each pair to compare how faces and vertices trade places.`,
  },

  platonic_phi: {
    title: 'The golden ratio',
    body: `The dodecahedron and icosahedron are built from the golden ratio φ = (1+√5)/2 ≈ 1.618. Vertices are at coordinates like (0, ±1/φ, ±φ) and (±1, ±1, ±1). The icosahedron has 12 vertices, 30 edges, 20 triangular faces.

The same φ occurs in standard coordinates for the 600-cell because that polytope has H₄, or 4-dimensional icosahedral, symmetry.`,
  },

  // ===== Bloom view =====
  bloom_morph: {
    title: 'The morph',
    body: `The "bloom" morphs the source shape through 600-cell-inspired stages until the 240 E₈ roots appear as a 2D projection. It is an app-designed interpolation for comparing structures, not a canonical deformation in Lie theory.

At each phase, the renderer interpolates between a source shape, 600-cell-inspired coordinates, two H₄-like visual layers, and finally the 2D Coxeter projection of E₈. The highlighted points are an illustrative selection chosen by the app; they are not a canonical map from solid vertices to individual E₈ roots.`,
  },

  // ===== Math essays =====
  coxeter: {
    title: 'Coxeter plane',
    sourceIds: ['mit-e8-plane', 'kostant-gosset-circles', 'stembridge-coxeter-planes'],
    body: `A Coxeter element is a product of the eight simple reflections. For E₈ it has order 30. On its Coxeter plane it acts as a rotation through 2π/30, or 12°.

The 240 roots split into eight Coxeter-element orbits of 30 roots. Orthogonal projection onto the Coxeter plane sends each orbit to one circle, producing eight concentric circles with 30 distinct projected roots on each. The radii depend on the normalization of the projection; their ratios, not the app's display scale, are the invariant feature.

The highlighted 30-step path is an orbit of a root under the Coxeter element. In the canonical projection its points appear at 12° intervals on one of the eight circles.`,
  },

  simple_roots: {
    title: 'Simple roots',
    body: `The 240 roots are all ±linear combinations of 8 fundamental "simple roots" α₁..α₈. The Dynkin diagram shows their angles: a line = 120° angle, a double/triple line = different angles.

For E₈, the diagram has one branch. In this studio's convention the chain is α₁—α₂—α₃—α₄—α₅—α₆—α₇, with α₈ attached to α₃. All eight roots have squared length 2, and adjacent roots have inner product −1.`,
  },

  dynkin: {
    title: 'Dynkin diagrams',
    body: `The Dynkin diagram of a simple Lie algebra encodes its entire structure: nodes are simple roots, edges are angles between them. The diagram of E₈ is:
α₁—α₂—α₃—α₄—α₅—α₆—α₇ with α₃—α₈ (one branch, length 1 from α₃).

The 5 Platonic solids correspond to subsets:
• Tetrahedron (T) → E₆
• Cube/Octahedron (O) → E₇
• Dodecahedron/Icosahedron (I) → E₈

This is the McKay correspondence: each Platonic solid's symmetry group "wants to be" a specific root system.`,
  },

  platonic_dual_pairs: {
    title: 'Pairs',
    body: `Tetra ↔ Tetra (self-dual)
Cube ↔ Octa (6 ↔ 8)
Dodeca ↔ Icosa (12 ↔ 20)

Switch between each pair to see the same symmetry from dual viewpoints.`,
  },

  weyl: {
    title: 'The Weyl group',
    sourceIds: ['aim-e8-technical', 'stembridge-coxeter-planes'],
    body: `W(E₈) has order 696,729,600. It is generated by reflections in the simple-root hyperplanes and permutes all 240 roots.

A Coxeter element is formed by multiplying the eight simple reflections in some order. Coxeter elements are conjugate, have order 30 for E₈, and act on the Coxeter plane as a 12° rotation. The Studio's Weyl trail shows a path made from simple reflections; it samples the finite root orbit rather than enumerating all Weyl-group elements.`,
  },

  moonshine: {
    title: 'Monstrous Moonshine',
    body: `In 1979, John McKay noticed: 196,884 = 196,883 + 1, where both numbers are dimensions of representations of the Monster group (the largest sporadic simple group, order ≈ 8×10⁵³). Conway and Norton extended this into "Monstrous Moonshine" — a map between Monster representations and modular functions.

Borcherds proved the Conway–Norton Monstrous Moonshine conjecture using generalized Kac–Moody algebras and vertex-algebra methods. He received a Fields Medal in 1998 in part for this work. Moonshine is a separate story from the McKay correspondence visualized by the Studio.`,
  },

  // ── Track 4 essays (Pickup round 2) ──

  octonions: {
    title: 'The octonions',
    body: `The real numbers, complex numbers, quaternions, and octonions form the only four normed division algebras over ℝ (Hurwitz's theorem, 1898). Each is "twice the dimension" of the previous: ℝ (1), ℂ (2), ℍ (4), 𝕆 (8).

E₈ has rank 8, the same real dimension as the octonions. The 240 roots admit several coordinate descriptions, including a 112-plus-128 decomposition in a standard orthonormal basis. Octonionic constructions also illuminate relationships among exceptional Lie groups, but the shared number eight alone is not a derivation of E₈.

The octonions are non-associative — (a·b)·c ≠ a·(b·c) in general. Their unusual algebra participates in important constructions of exceptional groups. It is more accurate to describe that as a rich relationship than as a single causal explanation for E₈.`,
  },

  quaternions_600cell: {
    title: 'Quaternions and the 600-cell',
    body: `The 120 vertices of the 600-cell are exactly the 120 unit quaternions in the binary icosahedral group. A unit quaternion q = (cos θ, sin θ · v̂) where v̂ is a unit 3-vector — so each vertex encodes both a rotation angle and an axis.

The 9 conjugacy classes of the 600-cell correspond to 9 distinct rotation angles (or pairs of angles): 0° (identity, 1 vertex), ±72°, ±120°, ±144°, 180°, ±216°, ±240°, ±288°, 360° (antipode, 1 vertex). Counts: 1+12+20+12+30+12+20+12+1 = 120. ✓

The view rotates and projects these quaternion coordinates for inspection; dragging the camera is not itself group multiplication. The 720 edges connect vertex pairs at the polytope's edge-length inner product.`,
  },

  petrie_polygon: {
    title: 'The Petrie polygon',
    sourceIds: ['stembridge-coxeter-planes'],
    body: `A Petrie polygon is a skew edge path in which every two consecutive edges, but no three consecutive edges, belong to a common face. For a Coxeter-plane root-system picture, applying a Coxeter element repeatedly to a root gives a 30-step orbit.

In the canonical E₈ Coxeter projection, those 30 points are equally spaced around one of the eight circles. Toggle "Petrie" to emphasize one such Coxeter orbit.`,
  },

  plato_timaeus: {
    title: 'Plato\'s Timaeus',
    body: `In the dialogue *Timaeus* (c. 360 BCE), Plato assigned each of the four elements to a regular solid:
• Fire → Tetrahedron (sharpest, most mobile)
• Air → Octahedron (lightest)
• Water → Icosahedron (most fluid)
• Earth → Cube (most stable, most "at rest")

The fifth solid — the dodecahedron — was reserved for the cosmos itself: "a fifth combination, which God used for the Universe when he decorated it."

This is why the *Timaeus* is cited whenever someone asks "why these five shapes?" They are the only five convex regular polyhedra in 3D space. Much later, the binary tetrahedral, octahedral, and icosahedral rotation groups entered the McKay correspondence with affine E₆, E₇, and E₈.`,
  },

  platonic_elements_why: {
    title: 'Why those elements?',
    body: `Plato's pairings in the *Timaeus* aren't arbitrary — each follows from the *feel* of the solid:

• **Fire → tetrahedron.** The sharpest, pointiest solid, with the fewest faces. Fire is piercing and quick, so it gets the most acute shape.
• **Earth → cube.** The only solid that stacks to fill space with no gaps, and it sits flat and stable on a face. Earth is solid and "at rest", so it gets the cube.
• **Air → octahedron.** Held lightly by two opposite vertices it spins freely — mobile but less piercing than fire.
• **Water → icosahedron.** The roundest solid, with the most faces (20). It rolls and flows, so it gets the most sphere-like shape.

The dodecahedron was left over. With 12 pentagonal faces — and pentagons evoking the zodiac's twelvefold sky — Plato made it the shape "the god used for arranging the constellations on the whole heaven." Aristotle later called this fifth essence *aether*, the source of our word **quintessence** ("fifth thing").`,
  },

  platonic_why_five: {
    title: 'Why exactly five?',
    body: `A Platonic solid needs identical regular polygons meeting the same way at every corner, with at least three faces per corner that bend out of the plane — so the face angles around a vertex must sum to *less* than 360°.

• Equilateral triangles (60° each): 3, 4, or 5 around a vertex → **tetrahedron, octahedron, icosahedron**. Six triangles give exactly 360° (a flat tiling), so the series stops.
• Squares (90°): only 3 fit (270°) → **cube**. Four would be a flat 360°.
• Regular pentagons (108°): only 3 fit (324°) → **dodecahedron**. Four would exceed 360°.
• Hexagons (120°) and larger: three already reach ≥360°, so no solid is possible.

That exhausts the cases — 3 + 1 + 1 = **five**, and no more. Theaetetus (4th c. BCE) is credited with the first proof, and it forms the climax of Euclid's *Elements*: the very last proposition of Book XIII proves the list is complete.`,
  },

  platonic_history: {
    title: 'A 2,400-year story',
    body: `The five regular solids are among the oldest objects in mathematics. The Pythagoreans already knew the tetrahedron, cube, and dodecahedron; Theaetetus added the octahedron and icosahedron and proved the set is complete.

Plato made them cosmological (the *Timaeus*, c. 360 BCE), which is why they bear his name. Euclid gave the definitive constructions and the uniqueness proof (*Elements* Book XIII, c. 300 BCE) — the entire thirteen-book work builds toward it.

In 1596 Kepler tried to explain the spacing of the six known planets by nesting the five solids between spheres (*Mysterium Cosmographicum*). The model was wrong — but chasing it led him to the laws of planetary motion. The solids keep resurfacing: in crystallography, in icosahedral virus capsids, and — through the McKay correspondence — in the exceptional Lie algebras E₆, E₇, and E₈ that this app explores.`,
  },

  bourbaki_e8: {
    title: 'Bourbaki and the E₈ picture',
    body: `Nicolas Bourbaki was the pseudonym of a group of (mostly French) mathematicians who, from the 1930s onward, rewrote mathematics from scratch in a relentlessly formal style. Their *Éléments de mathématique* is famous for being both rigorous and unreadable.

In 1963, Bourbaki published *Lie Groups and Lie Algebras, Chapters 4–6*, which contains a now-iconic diagram of the E₈ root system projected onto a Coxeter plane. Its 240 projected roots lie on eight concentric circles of 30 points each.

It is the diagram your browser is now rendering in color.`,
  },

  why_248: {
    title: 'Why 248 dimensions?',
    body: `E₈ has dimension 248. The quickest count adds the Cartan subalgebra to the root spaces:

dim(E₈) = rank + (number of roots) = 8 + 240 = 248.

There is also a beautiful structural construction. The algebra splits as

𝔢₈ = 𝔰𝔬(16) ⊕ S⁺,

where S⁺ is one of the two half-spinor representations of Spin(16). Counting dimensions:

dim 𝔰𝔬(16) + dim S⁺ = 120 + 128 = 248.

(dim 𝔰𝔬(16) = 16·15/2 = 120; a half-spinor of Spin(2n) has dimension 2ⁿ⁻¹, here 2⁷ = 128.) It is exactly this 120 + 128 split that makes E₈ appear in the heterotic string, whose gauge group is E₈ × E₈.`,
  },

  reflections_art: {
    title: 'Reflections in art and architecture',
    body: `The 17 wallpaper groups — the symmetries of the plane — were classified in the 1890s by Fedorov and Schoenflies, and are visually realized in the Alhambra palace in Granada (14th century Islamic tilework). Every wallpaper pattern is generated by translations plus a small number of reflections and rotations.

Coxeter extended this idea to higher-dimensional reflection groups. The wallpaper groups are 2D; the 3D counterparts are the space groups (230 of them, classifying crystal structures); the 4D counterparts are the Lorentzian reflection groups, which include the symmetry group of E₈.

M.C. Escher, a friend of Coxeter's, used wallpaper-group theory explicitly in his circle-limit drawings (*Circle Limit I–IV*, 1958–1960). Penrose tilings (1974) use reflection groups in non-Euclidean geometry.`,
  },

  affine_e8: {
    title: 'Affine E₈',
    sourceIds: ['springer-e8-highest-root', 'green-affine-kac-moody'],
    body: `The untwisted affine extension E₈⁽¹⁾ adds an affine simple root α₀ associated with the negative of E₈'s highest root. Its extended Dynkin diagram has nine nodes and is still a tree, not a 9-cycle.

The corresponding affine Kac–Moody algebra is infinite-dimensional. It should not be described as a 249-dimensional version of E₈: the additional node changes the algebraic construction rather than merely adding one ordinary basis direction. Affine Kac–Moody algebras occur in areas including representation theory and two-dimensional conformal field theory.`,
  },

  mandelbox_intro: {
    title: 'The mandelbox — fractal folds',
    body: `A mandelbox is a fractal shape defined by iterating three simple operations on every point:
1. **Sphere fold:** if |p| < r_min, p ← (r_fixed²/|p|²)·p
2. **Box fold:** p ← clamp(p, -1, 1)·2 - p
3. **Scale:** p ← scale·p + c   (c is the original input)

When iterated, the input point either escapes or remains bounded under the chosen iteration. In this Studio the fold is mixed with the E₈-inspired render, so it is an artistic effect rather than a mathematical construction of E₈.

The Bloom view defaults its scale to φ² ≈ 2.618 as an aesthetic preset and lets you vary it from 1.5 to 3.5. That default is app-specific; it is not a theorem about a uniquely densest or most stable mandelbox.`,
  },

  // ── Round 9 essays: star polyhedra, 4D rotations, and modern context ──

  kepler_poinsot: {
    title: 'The Kepler–Poinsot star polyhedra',
    body: `Beyond the five convex Platonic solids there are exactly four non-convex regular polyhedra — the Kepler–Poinsot solids, discovered by Kepler (1619) and completed by Poinsot (1809):

• Small stellated dodecahedron {5/2, 5} — 12 pentagram faces
• Great dodecahedron {5, 5/2} — 12 pentagon faces intersecting
• Great icosahedron {3, 5/2} — 20 triangle faces intersecting
• Great stellated dodecahedron {5/2, 3} — 12 pentagram faces

Cauchy proved (1813) that this list is complete: these four, together with the five convex ones, are *all* the regular polyhedra in 3D. The notation {p, q} is the Schläfli symbol — p is the face type (5/2 means a pentagram), q is the number meeting at a vertex.

All four share the full icosahedral symmetry group H₃ (order 120). The great icosahedron and great stellated dodecahedron are duals of each other, as are the small stellated dodecahedron and great dodecahedron. Select any of them in this view to see their vertices — taken straight from the icosahedron and dodecahedron — connected by the "great" edges that make them stars.`,
  },

  rotation_planes_4d: {
    title: 'Rotations in four dimensions',
    body: `In 3D, a rotation is specified by one axis and one angle. In 4D, this is no longer true: a rotation is specified by a *plane* and an angle. ℝ⁴ has six independent rotation planes: XY, XZ, XW, YZ, YW, ZW.

This is why 4D rotation feels so alien. In 3D, composing rotations always stays within the same axis system. In 4D, you can rotate in the XY plane and the ZW plane *simultaneously and independently* — a "double rotation" that has no 3D analogue. A point can trace out a curve that never repeats.

This polytope view exposes all six planes (XY, XZ, XW, YZ, YW, ZW). Move them together and you'll see the tesseract "turn inside out" in ways no 3D intuition predicts. The 4D→3D perspective projection (the w-depth slider) then maps that motion into something your eyes can follow.

Fun fact: in 4D, a rigid object can be rotated to exchange any two perpendicular axes — including the one "pointing into" the 4th dimension. This is why a 4D being could turn a left shoe into a right shoe, an operation impossible in 3D.`,
  },

  schlafli_symbols: {
    title: 'Schläfli symbols',
    body: `Ludwig Schläfli (1852) invented a notation that classifies regular polytopes in any dimension. The symbol {p, q} means: faces are regular p-gons, with q meeting at each vertex.

In 2D: {n} = a regular n-gon. {3} triangle, {5} pentagon, {5/2} pentagram.
In 3D: {p, q}. {4, 3} = cube (squares, 3 per vertex). {5/2, 5} = small stellated dodecahedron.
In 4D: {p, q, r}. {4, 3, 3} = tesseract (cubes, 3 around each edge). {3, 3, 5} = 600-cell.

The general rule: {p, q, r, ...} where each entry constrains the next. E₈'s connection to these symbols runs deep — the 600-cell {3, 3, 5} has exactly 120 vertices, the size of the binary icosahedral group, which is the bridge to E₈'s 240 roots.

Schläfli symbols also reveal duality: {p, q} and {q, p} are dual polyhedra. The cube {4,3} is dual to the octahedron {3,4}. The dodecahedron {5,3} is dual to the icosahedron {3,5}. And the small stellated dodecahedron {5/2, 5} is dual to the great dodecahedron {5, 5/2}.`,
  },

  e8_string_theory: {
    title: 'E₈ and string theory',
    body: `In 1985, Gross, Harvey, Martinec, and Rohm constructed the heterotic string. Consistency of their ten-dimensional construction permits two gauge-group choices: Spin(32)/Z₂ and E₈ × E₈.

Compactifications can break the gauge symmetry and produce lower-dimensional models, but there is no single mandatory split into a visible E₈ and a six-dimensional hidden E₈, and this Studio does not simulate a compactification or make a dark-matter prediction.

The appearance of E₈ × E₈ is an important application of the algebra. It is separate from the elementary root counts and projections shown here.`,
  },

  four_color_polytopes: {
    title: 'Coloring the 600-cell',
    body: `The 600-cell has 1200 triangular faces. The Studio assigns colors to projected vertices and structural subsets to make a dense 3D shadow of the 4D polytope easier to read.

These palettes are visualization choices, not a claimed optimal coloring of the 600-cell's face-adjacency graph. The planar four-color theorem and surface-genus bounds do not directly settle coloring questions for the boundary complex of a 4-polytope.

Use the color modes as navigational aids: they reveal grouping and depth in the projection without changing the underlying 120 vertices, 720 edges, 1200 triangular faces, and 600 tetrahedral cells.`,
  },

  // ── Round 12 essays: the E₈ SDF (raymarched) view ──

  sdf_raymarching: {
    title: 'Raymarching E₈',
    body: `Every other view in this studio draws the 240 roots as points or lines — flat geometry sitting in 3D. This view does something completely different: it treats each root as a small sphere in space, then "raymarches" the scene pixel by pixel to build a real, lit, shadowed solid.

Raymarching works backwards from the camera. For every pixel, a ray steps forward through space; at each step a "signed distance function" reports the distance to the nearest surface, so the ray can advance by exactly that much without overshooting. When the distance drops below a threshold, the ray has hit a root-sphere, and the shader shades it with soft shadows, ambient occlusion, fresnel rim-light, and anisotropic specular.

The result is a deliberately material-looking visualization — a virtual cluster of glowing beads rather than a claim about a physical E₈ object.`,
  },

  sdf_smooth_union: {
    title: 'Smooth union and the 240 spheres',
    body: `The shader's hardest job is merging 240 separate spheres into one continuous surface. The naive operation — \`min(d_a, d_b)\` — gives sharp, ugly creases wherever two spheres touch.

Instead the shader uses *polynomial smooth minimum* (smin): a softened min that blends two distances over a distance \`k\`. Push \`k\` high and the spheres melt into a single organic blob; push it to zero and they snap back to hard beads. The "blend" slider in this view controls exactly this \`k\`.

Between the spheres, 64 "edge cylinders" highlight the strongest Cartan connections — the same neighbour graph as the Coxeter view, but rendered as glowing rods that catch the anisotropic specular. Together the smin-blended spheres and the edge cylinders give E₈ its body: not just a graph, but a sculpture.`,
  },

  // ── Round 13: the 120-cell, completing the regular 4-polytope set ──

  the_120cell: {
    title: 'The 120-cell',
    body: `The 120-cell {5,3,3} is the dual of the 600-cell: where the 600-cell has 120 vertices and 600 tetrahedral cells, the 120-cell has 600 vertices and 120 dodecahedral cells. Each vertex of the 120-cell sits at the centre of a tetrahedral cell of the 600-cell — and vice versa.

Its 600 vertices and 1200 edges make it the densest of the six convex regular 4-polytopes. The faces are 720 pentagons, arranged 3 around each edge. Switch between the 600-cell and the 120-cell in this view to see duality in action: the same φ-based geometry, reciprocated.

Together the 5-cell, tesseract, 16-cell, 24-cell, 600-cell, and 120-cell exhaust the convex regular polytopes of four dimensions — six of them, just as there are five Platonic solids in three.`,
  },
};

// ── Tour mode ───────────────────────────────────────────────────────────
// The Tour auto-cycles through views, narrating each with essays + transitions.
// Triggered by pressing T or clicking "Start tour" in the panel.
// Claim-level provenance for every essay shipped in the UI. The integrity
// suite requires exact coverage and complete source records.
export const ESSAY_PROVENANCE = {
  e8_overview: ['established-mathematics', ['mit-e8-plane', 'aim-e8-technical'], 'Canonical E8 counts and Coxeter geometry; display scale and color are app choices.'],
  e8_mckay: ['interpretation', ['mckay-michigan-notes', 'kostant-gosset-circles'], 'The correspondence is established; Studio transitions are illustrative comparisons, not its construction.'],
  e8_dim: ['established-mathematics', ['aim-e8-technical'], 'The 8 + 240 dimension count is canonical; the physics sentence is contextual.'],
  sixhundred_overview: ['established-mathematics', ['mathworld-600-cell'], 'Element counts, duality, and quaternion realization are established; the wireframe is a projection.'],
  sixhundred_conjugacy: ['established-mathematics', ['mckay-michigan-notes', 'mathworld-600-cell'], 'Class-size discussion concerns the binary icosahedral group represented by the vertices.'],
  platonic_duals: ['established-mathematics', ['mathworld-platonic-solids'], 'Dual pairs and element counts are standard convex-polyhedron facts.'],
  platonic_phi: ['established-mathematics', ['mathworld-platonic-solids', 'mathworld-600-cell'], 'Golden-ratio coordinate appearances are established; visual emphasis is app-designed.'],
  bloom_morph: ['app-designed-visualization', ['mit-e8-plane', 'mathworld-600-cell'], 'The endpoints use sourced objects, but the interpolation and highlighted subsets are wholly app-designed.'],
  coxeter: ['established-mathematics', ['mit-e8-plane', 'kostant-gosset-circles', 'stembridge-coxeter-planes'], 'Coxeter orbits and projection geometry are canonical up to normalization and orientation.'],
  simple_roots: ['established-mathematics', ['aim-e8-technical'], 'Simple-root and Cartan claims use the Studio’s explicitly documented E8 convention.'],
  dynkin: ['interpretation', ['mckay-michigan-notes'], 'Dynkin classification and McKay graphs are established; doorway language is explanatory.'],
  platonic_dual_pairs: ['established-mathematics', ['mathworld-platonic-solids'], 'This compact card states only standard Platonic dual pairs and counts.'],
  weyl: ['established-mathematics', ['aim-e8-technical', 'stembridge-coxeter-planes'], 'Weyl-group order and reflection action are canonical.'],
  moonshine: ['historical-context', ['mactutor-borcherds'], 'Dates and awards are historical context; moonshine is distinct from the McKay correspondence.'],
  octonions: ['interpretation', ['baez-octonions'], 'Octonion and exceptional-group relationships are established, but no single causal construction of E8 is implied.'],
  quaternions_600cell: ['established-mathematics', ['mckay-michigan-notes', 'mathworld-600-cell'], 'The binary icosahedral unit-quaternion model is established; on-screen projection is illustrative.'],
  petrie_polygon: ['established-mathematics', ['stembridge-coxeter-planes'], 'The displayed 30-cycle is a verified Coxeter orbit; styling is app-designed.'],
  plato_timaeus: ['historical-context', ['mactutor-plato'], 'Ancient chronology and attribution are presented as historical scholarship, not modern physics.'],
  platonic_elements_why: ['interpretation', ['mactutor-plato'], 'This explains Plato’s qualitative associations and explicitly does not present them as science.'],
  platonic_why_five: ['established-mathematics', ['mathworld-platonic-solids', 'mactutor-theaetetus'], 'The angular argument proves the five convex regular polyhedra; attribution is historically qualified.'],
  platonic_history: ['historical-context', ['mactutor-plato', 'mactutor-theaetetus', 'mactutor-euclid'], 'The chronology is a concise historical overview with uncertain ancient attributions kept qualified.'],
  bourbaki_e8: ['historical-context', ['mit-e8-plane'], 'The projection’s mathematical properties are sourced; publication-history phrasing is contextual.'],
  why_248: ['established-mathematics', ['aim-e8-technical'], 'The dimension decomposition is canonical; analogies about scale are explanatory.'],
  reflections_art: ['interpretation', ['aim-e8-technical'], 'Mathematical reflection is established; art and architecture comparisons are interpretive.'],
  affine_e8: ['established-mathematics', ['springer-e8-highest-root', 'green-affine-kac-moody'], 'Affine-root and infinite-dimensional algebra statements are sourced and separate from UI layout.'],
  mandelbox_intro: ['app-designed-visualization', ['hart-sphere-tracing'], 'The fold is a rendering feature; parameter values and its visual relationship to E8 are not mathematical claims.'],
  kepler_poinsot: ['established-mathematics', ['mathworld-kepler-poinsot'], 'Names, symbols, and dual pairs concern the four regular star polyhedra.'],
  rotation_planes_4d: ['established-mathematics', ['mathworld-schlafli-symbol'], 'The six coordinate planes and double-rotation explanation are standard 4D geometry.'],
  schlafli_symbols: ['established-mathematics', ['mathworld-schlafli-symbol'], 'Notation and listed regular-polytope examples follow the reference convention.'],
  e8_string_theory: ['historical-context', ['gross-heterotic-string'], 'E8 x E8 is one consistent heterotic gauge group; the visualization does not model string theory.'],
  four_color_polytopes: ['app-designed-visualization', ['mathworld-600-cell'], '600-cell geometry is sourced; the four-color partition and animation are Studio display choices.'],
  sdf_raymarching: ['rendering-technique', ['hart-sphere-tracing'], 'Sphere tracing and signed distance bounds are established; the scene composition is app-designed.'],
  sdf_smooth_union: ['rendering-technique', ['hart-sphere-tracing'], 'Distance operations motivate the renderer; blend parameters and selected rods are app-designed.'],
  the_120cell: ['established-mathematics', ['mathworld-120-cell'], 'Element counts, duality, and Schläfli symbol are established; the projection is app-designed.'],
};

for (const [id, essay] of Object.entries(ESSAYS)) {
  const [claimType, sourceIds, scopeNote] = ESSAY_PROVENANCE[id] || [];
  essay.claimType = claimType;
  essay.sourceIds = sourceIds || essay.sourceIds || [];
  essay.scopeNote = scopeNote;
}

export const TOUR_STOPS = [
  // Each stop has: view to switch to, time to spend (seconds), essay to narrate,
  // optional params to set during the stop.
  { view: 'platonic',    seconds: 18, essay: 'platonic_duals',      params: { shape: 'tetrahedron', fxMode: 'none', palette: 'gold' },
    // Cycle through the five solids so each dual pair is shown in turn.
    // Order matches the essay: tetra (self-dual), cube↔octa, dodeca↔icosa.
    // Cycle through each dual pair one solid at a time.
    cycle: { param: 'shape', intervalMs: 3000, values: ['tetrahedron', 'cube', 'octahedron', 'dodecahedron', 'icosahedron'] } },
  { view: 'platonic',    seconds: 8,  essay: 'platonic_phi',        params: { shape: 'dodecahedron', fxMode: 'glow', fxIntensity: 0.4 } },
  { view: 'bloom',       seconds: 10, essay: 'bloom_morph',         params: { bloomAmount: 0, fxMode: 'pulse', bloomAuto: true } },
  { view: 'bloom',       seconds: 9,  essay: 'e8_mckay',            params: { bloomAmount: 0.75, fxMode: 'glow', palette: 'aurora' } },
  { view: 'sixhundred',  seconds: 10, essay: 'sixhundred_overview', params: { shape: 'icosahedron', fxMode: 'glow', autoRotate: true } },
  { view: 'sixhundred',  seconds: 8,  essay: 'sixhundred_conjugacy', params: { sixhundredClass: 4 } },
  { view: 'e8coxeter',   seconds: 20, essay: 'e8_overview',         params: { e8ViewMode: 'coxeter', showRings: true, palette: 'petrie' },
    // Cycle through the projection modes so each is visible in turn.
    cycle: { param: 'e8ViewMode', intervalMs: 4000, values: ['coxeter', 'petrie', 'h4', 'ortho3d'] } },
  { view: 'e8coxeter',   seconds: 8,  essay: 'coxeter',             params: { showPetrie: true, palette: 'petrie' } },
  { view: 'e8coxeter',   seconds: 8,  essay: 'petrie_polygon',      params: { showPetrie: true, autoRotate: true } },
  { view: 'e8coxeter',   seconds: 8,  essay: 'octonions',           params: { palette: 'cosmic', fxMode: 'aura' } },
  { view: 'e8coxeter',   seconds: 8,  essay: 'why_248',             params: { palette: 'aurora', fxMode: 'glow' } },
  { view: 'bloom',       seconds: 10, essay: 'mandelbox_intro',     params: { bloomMandelbox: true, bloomMandelboxScale: 2.618 } },
  { view: 'e8coxeter',   seconds: 8,  essay: 'moonshine',           params: { palette: 'sunset', fxMode: 'kaleido6' } },
  { view: 'e8coxeter',   seconds: 8,  essay: 'bourbaki_e8',         params: { palette: 'mono' } },
  // ── Round 9 tour stops: new geometry + new FX ──
  { view: 'platonic',    seconds: 10, essay: 'kepler_poinsot',      params: { shape: 'stellated_dodecahedron', palette: 'amber', fxMode: 'crystal' } },
  { view: 'platonic',    seconds: 8,  essay: 'schlafli_symbols',    params: { shape: 'great_icosahedron', palette: 'neon', fxMode: 'hologram' } },
  { view: 'polytope',    seconds: 22, essay: 'rotation_planes_4d',  params: { poly4d: '5cell', polyAutoRotate: true, palette: 'cosmic' },
    // Cycle through the six regular 4-polytopes (now including the 120-cell).
    cycle: { param: 'poly4d', intervalMs: 3500, values: ['5cell', 'tesseract', '16cell', '24cell', '600cell', '120cell'] } },
  // ── Round 12 tour stop: the SDF view (a real shaded solid, not points) ──
  { view: 'raymarched',  seconds: 11, essay: 'sdf_raymarching',     params: { palette: 'mono', sdfBloom: 0.65, sdfEdges: 0.55, sdfAniso: 0.8, autoRotate: true } },
  { view: 'e8coxeter',   seconds: 8,  essay: 'e8_string_theory',    params: { palette: 'aurora', fxMode: 'aura' } },
];

// ── Code-art gallery ────────────────────────────────────────────────────
// Small GLSL fragment-shader one-liners with copy-to-clipboard. Each is a
// self-contained WebGL fragment shader that produces a striking E₈-themed
// pattern. Users can copy and use them as starting points for code art.
export const CODE_ART_SHADERS = [
  {
    title: 'Coxeter rings',
    description: 'A stylized repeating-ring shader inspired by Coxeter-plane imagery; it is not a root-system projection.',
    code: `// Stylized logarithmic rings inspired by Coxeter-plane imagery
// Paste into a WebGL fragment shader's main():
vec2 uv = (gl_FragCoord.xy / iResolution.xy - 0.5) * vec2(iResolution.x / iResolution.y, 1.0) * 4.0;
float phi = 1.6180339887;
float r = length(uv);
float ringIdx = floor(log(r * phi) / log(phi));
float ringR = pow(phi, ringIdx) / phi;
float ringWidth = 0.04;
float d = abs(r - ringR);
float intensity = smoothstep(ringWidth, 0.0, d);
gl_FragColor = vec4(vec3(intensity) * vec3(0.96, 0.82, 0.48), 1.0);`,
  },
  {
    title: 'Petrie 30-cycle',
    description: '30-pointed star traced along the Petrie polygon of E₈.',
    code: `// 30-pointed star (Petrie polygon of E₈)
// Paste into a WebGL fragment shader's main():
vec2 uv = (gl_FragCoord.xy / iResolution.xy - 0.5) * 2.0;
float a = atan(uv.y, uv.x);
float r = length(uv);
float n = 30.0;
float petal = 0.5 + 0.5 * cos(a * n);
float radius = 0.3 + 0.4 * petal;
float line = smoothstep(0.04, 0.0, abs(r - radius));
gl_FragColor = vec4(vec3(0.4, 0.85, 1.0) * line, 1.0);`,
  },
  {
    title: 'Mandelbox E₈ fold',
    description: 'A mandelbox fold that uses E₈ Coxeter-plane coordinates as input.',
    code: `// 6-iteration mandelbox fold, E₈-symmetric
// Paste into a WebGL fragment shader's main():
vec3 p = vec3(gl_FragCoord.xy / iResolution.xy * 2.0 - 1.0, 0.0);
p.x *= iResolution.x / iResolution.y;
vec3 c = p;
float scale = 2.618;  // phi²
for (int i = 0; i < 6; i++) {
  float r2 = dot(p, p);
  if (r2 < 0.25) p *= 0.25 / max(r2, 1e-4);
  else if (r2 < 1.0) p *= 1.0 / max(r2, 1e-4);
  p = clamp(p, vec3(-1.0), vec3(1.0)) * 2.0 - p;
  p = p * scale + c;
}
float glow = exp(-length(p) * 2.0);
gl_FragColor = vec4(vec3(0.6, 0.4, 1.0) * glow, 1.0);`,
  },
  {
    title: 'Golden iris',
    description: 'A 5-fold radial pattern using the golden ratio — common motif in code-art and Islamic geometry.',
    code: `// 5-fold radial pattern (golden iris)
// Paste into a WebGL fragment shader's main():
vec2 uv = (gl_FragCoord.xy / iResolution.xy - 0.5) * 2.0;
uv.x *= iResolution.x / iResolution.y;
float phi = 1.6180339887;
float a = atan(uv.y, uv.x);
float r = length(uv);
float petal = 0.5 + 0.5 * cos(a * 5.0);
float ring = 0.5 + 0.5 * sin(r * 30.0 - a * 5.0);
float intensity = pow(ring, 3.0) * petal;
intensity *= smoothstep(1.5, 0.0, r);
gl_FragColor = vec4(vec3(0.95, 0.75, 0.3) * intensity, 1.0);`,
  },
  {
    title: 'Icosa orbit',
    description: 'Animates a point around an icosahedral orbit — shows the orbit structure of the icosahedral group.',
    code: `// 60-vertex orbit of a point under icosahedral rotations
// Paste into a WebGL fragment shader's main():
vec2 uv = (gl_FragCoord.xy / iResolution.xy - 0.5) * 3.0;
uv.x *= iResolution.x / iResolution.y;
float t = iTime * 0.5;
// Generate the orbit by repeated reflection
vec2 p = vec2(1.0, 0.0);
for (int i = 0; i < 60; i++) {
  float a = 6.2831853 * float(i) / 60.0 + t;
  p = vec2(cos(a), sin(a));
}
float d = length(uv - p);
for (int i = 1; i < 60; i++) {
  float a = 6.2831853 * float(i) / 60.0 + t;
  d = min(d, length(uv - vec2(cos(a), sin(a))));
}
gl_FragColor = vec4(vec3(0.4, 1.0, 0.85), smoothstep(0.05, 0.0, d));`,
  },
  {
    title: 'Lie bracket field',
    description: 'Visualizes the Lie bracket [X, Y] of two random vector fields as a colored curl pattern.',
    code: `// Lie bracket curl field
// Paste into a WebGL fragment shader's main():
vec2 uv = (gl_FragCoord.xy / iResolution.xy - 0.5) * 2.0;
uv.x *= iResolution.x / iResolution.y;
vec2 X = vec2(sin(uv.y * 4.0), cos(uv.x * 4.0));
vec2 Y = vec2(cos(uv.x * 4.0), sin(uv.y * 4.0));
float bracket = X.x * Y.y - X.y * Y.x;  // scalar Lie bracket
vec3 col = vec3(0.5 + 0.5 * sin(bracket * 6.0),
                0.5 + 0.5 * cos(bracket * 4.0),
                0.5 + 0.5 * sin(bracket * 8.0));
gl_FragColor = vec4(col, 1.0);`,
  },
  {
    title: 'Star stellation',
    description: 'A pentagram lattice — the {5/2} star polygon that underlies the small stellated dodecahedron.',
    code: `// {5/2} pentagram lattice (Kepler star)
// Paste into a WebGL fragment shader's main():
vec2 uv = (gl_FragCoord.xy / iResolution.xy - 0.5) * 8.0;
uv.x *= iResolution.x / iResolution.y;
vec2 g = fract(uv) - 0.5;
float r = length(g);
float a = atan(g.y, g.x);
// 5-pointed star: 5-fold petal modulated by 2/5 winding
float star = abs(cos(a * 2.5));
float ring = smoothstep(0.45, 0.5, star * r);
float d = abs(r - star * 0.35);
float line = smoothstep(0.04, 0.0, d);
gl_FragColor = vec4(vec3(1.0, 0.85, 0.2) * line, 1.0);`,
  },
  {
    title: '4D hypercube shadow',
    description: 'Projects a tesseract {4,3,3} rotating in the XW plane down to 2D — a flatland shadow of 4D motion.',
    code: `// Tesseract shadow rotating in the XW plane
// Paste into a WebGL fragment shader's main():
vec2 uv = (gl_FragCoord.xy / iResolution.xy - 0.5) * 2.0;
float t = iTime * 0.5;
// 16 vertices of a tesseract as 4D points (±1,±1,±1,±1), rotated in XW
float minD = 1e9;
for (int i = 0; i < 16; i++) {
  vec4 v = vec4(
    float((i & 1) * 2 - 1),
    float(((i >> 1) & 1) * 2 - 1),
    float(((i >> 2) & 1) * 2 - 1),
    float(((i >> 3) & 1) * 2 - 1));
  // Rotate XW plane
  float c = cos(t), s = sin(t);
  vec4 r = vec4(c*v.x + s*v.w, v.y, v.z, -s*v.x + c*v.w);
  // Project 4D -> 2D (drop z, perspective on w)
  vec2 p = r.xy / (1.0 - 0.25 * r.w);
  minD = min(minD, length(uv - p));
}
float dot = smoothstep(0.06, 0.0, minD);
gl_FragColor = vec4(vec3(0.3, 0.7, 1.0) * dot, 1.0);`,
  },
];

// What context each essay fits in (extended in Track 4)
export const ESSAY_CONTEXTS = {
  e8coxeter: [
    'e8_overview', 'e8_mckay', 'coxeter', 'weyl', 'moonshine',
    'octonions', 'why_248', 'petrie_polygon', 'bourbaki_e8',
    'affine_e8', 'reflections_art', 'mandelbox_intro',
    'e8_string_theory',  // Round 9
  ],
  sixhundred: [
    'sixhundred_overview', 'sixhundred_conjugacy', 'moonshine',
    'quaternions_600cell', 'four_color_polytopes',  // Round 9
  ],
  platonic: [
    'plato_timaeus', 'platonic_elements_why', 'platonic_why_five', 'platonic_history',
    'platonic_duals', 'platonic_phi', 'platonic_dual_pairs',
    'kepler_poinsot', 'schlafli_symbols',  // Round 9: star polyhedra essays
  ],
  bloom: [
    'bloom_morph', 'e8_mckay', 'mandelbox_intro',
  ],
  polytope: ['e8_dim', 'affine_e8', 'rotation_planes_4d', 'schlafli_symbols', 'the_120cell'],
  raymarched: ['sdf_raymarching', 'sdf_smooth_union', 'e8_overview'],
  dynkin: ['dynkin', 'simple_roots'],
};

// Returns an essay by view+index for rotation
export function getEssaysForView(viewId) {
  return ESSAY_CONTEXTS[viewId] || [];
}

export function getEssay(id) {
  return ESSAYS[id];
}
