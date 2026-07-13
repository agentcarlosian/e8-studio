// learning.js - phone-first learning, quiz, and reward content for E8 Studio.
//
// The core app stays fully unlocked after purchase. These rewards are cosmetic
// postcard/backdrop treatments that make learning and creating feel good without
// gating the actual math studio.

export const REWARD_BACKGROUNDS = [
  {
    id: 'coxeter-night',
    name: 'Coxeter Night',
    description: 'A deep gold-and-cyan postcard backdrop for first quiz pass.',
    colors: ['#07070c', '#111827', '#f4d27a', '#6affe8'],
  },
  {
    id: 'aurora-proof',
    name: 'Aurora Proof',
    description: 'A quiet aurora frame unlocked by a daily fact.',
    colors: ['#071016', '#183c45', '#6affe8', '#f4d27a'],
  },
  {
    id: '600-cell-glow',
    name: '600-cell Glow',
    description: 'A warm radial frame unlocked by the 600-cell quiz.',
    colors: ['#09070c', '#352019', '#ffb36a', '#f4d27a'],
  },
  {
    id: 'postcard-prime',
    name: 'Postcard Prime',
    description: 'A high-contrast share frame unlocked by creating a postcard.',
    colors: ['#07070c', '#151522', '#c98aff', '#6affe8'],
  },
  {
    id: 'polytope-prism',
    name: 'Polytope Prism',
    description: 'A cool spectral frame unlocked by the 4D polytope quiz.',
    colors: ['#06080e', '#0f1830', '#6affe8', '#c98aff'],
  },
  {
    id: 'mandelbox-fold',
    name: 'Mandelbox Fold',
    description: 'A warm fractal frame unlocked by the Bloom morph quiz.',
    colors: ['#0a0805', '#2a1a0a', '#ffb36a', '#f4d27a'],
  },
];

// ── Biographies ──────────────────────────────────────────────────────────
// Short cards for the figures named across the essays. Sourced from the same
// material the essays already cite — no new historical claims.
export const BIOGRAPHIES = [
  {
    id: 'plato',
    name: 'Plato',
    dates: 'c. 428–347 BCE',
    field: 'Greek philosophy',
    blurb: `Athenian philosopher who, in the dialogue *Timaeus* (c. 360 BCE), assigned each of the four classical elements to a regular solid — fire to the tetrahedron, air to the octahedron, water to the icosahedron, earth to the cube — and reserved the dodecahedron for the cosmos. The five solids bear his name, though the Pythagoreans knew three of them earlier and Theaetetus completed and proved the set.`,
    related: ['platonic-foundations', 'mckay-correspondence'],
  },
  {
    id: 'theaetetus',
    name: 'Theaetetus',
    dates: 'c. 417–369 BCE',
    field: 'Greek mathematics',
    blurb: `Athenian mathematician credited with the first proof that there are exactly five convex regular polyhedra. He added the octahedron and icosahedron to the three the Pythagoreans already knew. The proof is the climax of Euclid's *Elements* Book XIII. Theaetetus also studied irrationals — Plato named a dialogue after him.`,
    related: ['platonic-foundations'],
  },
  {
    id: 'euclid',
    name: 'Euclid',
    dates: 'c. 325–265 BCE',
    field: 'Greek mathematics',
    blurb: `Author of the *Elements*, the most influential maths text ever written. Its thirteen books build from definitions and postulates to the final propositions of Book XIII, which construct the five Platonic solids and prove no others exist. The "Euclidean" geometry named for him was the only geometry anyone knew for 2200 years.`,
    related: ['platonic-foundations'],
  },
  {
    id: 'kepler',
    name: 'Johannes Kepler',
    dates: '1571–1630',
    field: 'Astronomy, optics',
    blurb: `In *Mysterium Cosmographicum* (1596) Kepler tried to explain the spacing of the six known planets by nesting the five Platonic solids between their spheres. The model was wrong, but chasing it led him to his three laws of planetary motion. He also discovered two of the four regular star polyhedra (the small stellated and great stellated dodecahedra, 1619).`,
    related: ['platonic-foundations'],
  },
  {
    id: 'schlafli',
    name: 'Ludwig Schläfli',
    dates: '1814–1895',
    field: 'Geometry',
    blurb: `Swiss mathematician who, in 1852, invented the {p,q,r,...} notation that classifies regular polytopes in any dimension, and used it to discover the six convex regular 4-polytopes (including the 600-cell). His work was so far ahead of its time that it was largely ignored for decades.`,
    related: [],
  },
  {
    id: 'cartan',
    name: 'Élie Cartan',
    dates: '1869–1951',
    field: 'Lie theory, differential geometry',
    blurb: `French mathematician who completed the classification and representation theory of complex simple Lie algebras, including the exceptional types G2, F4, E6, E7, and E8. The Cartan matrix and Cartan subalgebra bear his name. He also developed the theory of spinors and exterior differential systems.`,
    related: ['e8-roots', 'coxeter-plane'],
  },
  {
    id: 'coxeter',
    name: 'H.S.M. (Donald) Coxeter',
    dates: '1907–2003',
    field: 'Geometry',
    blurb: `British-born, Toronto-based geometer whose 60-year career reinvigorated classical geometry. He defined the Coxeter plane and Coxeter element; the iconic black-and-white projection of E8 onto its Coxeter plane appeared in Bourbaki's 1963 volume that drew on his framework. M.C. Escher was a friend and sought his mathematical advice for the *Circle Limit* woodcuts.`,
    related: ['coxeter-plane', 'e8-roots'],
  },
  {
    id: 'freudenthal',
    name: 'Hans Freudenthal',
    dates: '1905–1990',
    field: 'Lie theory, topology',
    blurb: `Dutch mathematician whose work ranged across topology, Lie theory, and mathematics education. The Freudenthal multiplicity formula computes weight multiplicities in representations of semisimple Lie algebras; his name also appears throughout exceptional-geometry constructions.`,
    related: ['e8-roots'],
  },
  {
    id: 'mckay',
    name: 'John McKay',
    dates: '1939–2022',
    field: 'Group theory, number theory',
    blurb: `British-Canadian mathematician. In 1979 he noticed that 196,884 = 196,883 + 1, where both numbers are dimensions of representations of the Monster group — the seed of "Monstrous Moonshine." In the same period he formulated the McKay correspondence linking finite subgroups of SU(2) (the Platonic symmetries) to the simply-laced Dynkin diagrams E6, E7, E8. The whole premise of this studio rests on that correspondence.`,
    related: ['mckay-correspondence', 'e8-roots'],
  },
  {
    id: 'conway',
    name: 'John H. Conway',
    dates: '1937–2020',
    field: 'Group theory, combinatorics',
    blurb: `British mathematician (Princeton, later life) who, with Simon Norton, formalised "Monstrous Moonshine" into a precise conjecture (1979) connecting the Monster group to modular functions. He also discovered the Conway groups, studied the Leech lattice (closely related to E8's lattice), and invented the *Game of Life*.`,
    related: ['e8-roots'],
  },
  {
    id: 'borcherds',
    name: 'Richard Borcherds',
    dates: 'b. 1959',
    field: 'Lie theory, mathematical physics',
    blurb: `British-American mathematician who proved the Conway–Norton Monstrous Moonshine conjecture using generalized Kac–Moody algebras and vertex-algebra methods. He received a Fields Medal in 1998. Moonshine is historically adjacent to John McKay's work but is distinct from the McKay correspondence shown here.`,
    related: ['e8-roots'],
  },
  {
    id: 'bourbaki',
    name: 'Nicolas Bourbaki',
    dates: 'founded 1935',
    field: 'All of mathematics (collective pseudonym)',
    blurb: `A collective pseudonym used by a shifting group of (mostly French) mathematicians who, from the 1930s onward, rewrote mathematics from scratch in a relentlessly formal style. Their *Éléments de mathématique* is famous for rigour and impenetrability alike. The 1963 volume *Lie Groups and Lie Algebras, Chapters 4–6* contains the now-iconic Coxeter-plane projection of E8 that this studio renders in colour.`,
    related: ['e8-roots', 'coxeter-plane'],
  },
];

// ── Badge definitions ────────────────────────────────────────────────────
// Maps every badge id (from progress.js) to a display name + description.
// Used by the Achievements grid in the Learn section. The `kind` field groups
// badges: 'quiz' | 'daily' | 'created' | 'explore'.
// ── Timeline of E₈ ───────────────────────────────────────────────────────
// A scrollable history of the discoveries behind the structures in this studio.
export const TIMELINE = [
  { year: 'c. 360 BCE', title: 'Plato’s Timaeus', body: 'Plato assigns the five regular solids to the elements. The shapes that bear his name are the entry point to the whole ADE story.' },
  { year: 'c. 300 BCE', title: 'Euclid completes the list', body: 'The final propositions of the Elements Book XIII prove exactly five convex regular polyhedra exist. Theaetetus is credited with the first proof.' },
  { year: '1852', title: 'Schläfli’s higher-dimensional polytopes', body: 'Ludwig Schläfli invents the {p,q,r} notation and discovers the six convex regular 4-polytopes, including the 600-cell and 120-cell.' },
  { year: '1894', title: 'Cartan classifies the Lie algebras', body: 'Élie Cartan, building on Killing’s work, completes the classification and representation theory of complex simple Lie algebras, including G₂, F₄, E₆, E₇, and E₈.' },
  { year: '1935', title: 'Bourbaki founded', body: 'A collective of mostly French mathematicians begins rewriting maths from scratch. Their 1963 Lie-groups volume contains the iconic E₈ Coxeter-plane diagram.' },
  { year: '1948', title: 'Coxeter’s Regular Polytopes', body: 'H.S.M. Coxeter publishes the definitive geometry reference. The Coxeter plane and Coxeter element — the projection this studio renders — bear his name.' },
  { year: '1979', title: 'McKay correspondence + Monstrous Moonshine', body: 'John McKay observes both the ADE/Dynkin correspondence for Platonic symmetries AND the 196,884 = 196,883 + 1 Moonshine identity. The seed of two Fields Medals.' },
  { year: '1985', title: 'The heterotic string', body: 'Gross, Harvey, Martinec & Rohm propose the E₈ × E₈ heterotic string. E₈ is special because its size makes the theory anomaly-free.' },
  { year: '1992', title: 'Borcherds proves Moonshine', body: 'Richard Borcherds proves the Conway–Norton Monstrous Moonshine conjecture using a Kac–Moody algebra built from E₈. Wins the Fields Medal in 1998.' },
  { year: '2007', title: 'The Atlas computation for E₈', body: 'The Atlas of Lie Groups project completes a large Kazhdan–Lusztig–Vogan polynomial computation for the split real form of E₈. The reported output matrix had 453,060 rows and columns and the computation took about 77 hours.' },
];

export const BADGE_INFO = [
  // Quiz badges — one per module (generated dynamically in the panel, but
  // listed here so the achievements grid always shows the full set).
  { id: 'quiz:platonic-foundations', kind: 'quiz', name: 'Platonic Foundations', description: 'Passed the Platonic solids quiz.' },
  { id: 'quiz:sixhundred-basics',    kind: 'quiz', name: '600-cell Basics',       description: 'Passed the 600-cell quiz.' },
  { id: 'quiz:coxeter-plane',        kind: 'quiz', name: 'Coxeter Plane',         description: 'Passed the Coxeter plane quiz.' },
  { id: 'quiz:e8-roots',             kind: 'quiz', name: 'E8 Roots',              description: 'Passed the E8 roots quiz.' },
  { id: 'quiz:mckay-correspondence', kind: 'quiz', name: 'McKay Correspondence',  description: 'Passed the McKay correspondence quiz.' },
  { id: 'quiz:bloom-morph',          kind: 'quiz', name: 'Bloom Morph',           description: 'Passed the Bloom morph quiz.' },
  { id: 'quiz:4d-polytopes',         kind: 'quiz', name: '4D Polytopes',          description: 'Passed the 4D polytope quiz.' },
  { id: 'quiz:e8-sdf',               kind: 'quiz', name: 'E8 SDF',                description: 'Passed the E8 SDF quiz.' },
  // Created
  { id: 'created:first-postcard',    kind: 'created', name: 'First Postcard', description: 'Created your first postcard.' },
  // Exploration (activity-based, no quiz needed)
  { id: 'explore:all-views',         kind: 'explore', name: 'Grand Tour',        description: 'Visited all six primary views.' },
  { id: 'explore:tour-complete',     kind: 'explore', name: 'Guided',            description: 'Finished the guided tour.' },
  { id: 'explore:essay-reader',      kind: 'explore', name: 'Reader',            description: 'Opened 5 distinct essays.' },
  { id: 'explore:exporter',          kind: 'explore', name: 'Exporter',          description: 'Used any export (PNG, SVG, OBJ, or JSON).' },
  { id: 'explore:command-palette',   kind: 'explore', name: 'Power User',        description: 'Opened the command palette (⌘K).' },
];

export const CURIOUS_CARDS = {
  bloom: {
    title: 'Curiosity: the bloom is a bridge',
    body: 'The Bloom view is a visual bridge from a familiar Platonic solid toward the 240-root E8 Coxeter projection.',
  },
  platonic: {
    title: 'Curiosity: five regular solids',
    body: 'The Platonic solids are the only five convex regular polyhedra in 3D. Their symmetries are the doorway into the McKay story.',
  },
  e8coxeter: {
    title: 'Curiosity: eight orbits',
    body: 'The E8 Coxeter projection places 240 roots into eight concentric rings of 30 roots, turning an 8D symmetry into a readable 2D diagram.',
  },
  sixhundred: {
    title: 'Curiosity: the 600-cell',
    body: 'The 600-cell has 120 vertices and 720 edges. It is the 4D shadow behind the binary icosahedral symmetry in this app.',
  },
  polytope: {
    title: 'Curiosity: 4D rotation has six planes',
    body: 'In 4D, rotation happens in planes. The six sliders expose the six coordinate planes of four-dimensional space.',
  },
  raymarched: {
    title: 'Curiosity: an E8 field',
    body: 'The SDF view treats the roots as a field of distance surfaces, making E8 feel less like a diagram and more like a material.',
  },
};

export const DAILY_FACTS = [
  {
    id: 'daily-roots-240',
    title: 'One beautiful fact: 240 roots',
    body: 'E8 has 240 roots. In the Coxeter plane they arrange into eight rings of 30 roots, giving a compact visual fingerprint of the symmetry.',
    presetId: 'coxeter-rings',
    rewardId: 'aurora-proof',
  },
  {
    id: 'daily-duals',
    title: 'One beautiful fact: dual solids',
    body: 'The cube and octahedron are duals, as are the dodecahedron and icosahedron. The tetrahedron is dual to itself.',
    presetId: 'platonic-bloom',
    rewardId: 'coxeter-night',
  },
  {
    id: 'daily-600',
    title: 'One beautiful fact: 600-cell edges',
    body: 'The 600-cell has 720 edges. It is one of the most intricate regular polytopes in four dimensions.',
    presetId: '600-bridge',
    rewardId: '600-cell-glow',
  },
  {
    id: 'daily-mckay',
    title: 'One beautiful fact: McKay correspondence',
    body: 'The classical McKay correspondence associates finite subgroups of SU(2), including the binary polyhedral groups related to Platonic rotations, with affine ADE Dynkin diagrams.',
    presetId: 'weyl-chamber',
    rewardId: 'postcard-prime',
  },
  {
    id: 'daily-octonions',
    title: 'One beautiful fact: the octonions',
    body: 'The octonions form an 8-dimensional non-associative normed division algebra. They participate in important constructions of exceptional Lie groups, but the shared dimension eight is not by itself a derivation of E8.',
    presetId: 'cosmic-dawn',
    rewardId: 'aurora-proof',
  },
  {
    id: 'daily-petrie',
    title: 'One beautiful fact: the Petrie polygon',
    body: 'A verified 30-step Coxeter orbit follows edges of the E8 root polytope. In the canonical Coxeter projection its points lie at equal 12-degree angular intervals on one of the eight circles.',
    presetId: 'weyl-chamber',
    rewardId: 'coxeter-night',
  },
  {
    id: 'daily-moonshine',
    title: 'One beautiful fact: Monstrous Moonshine',
    body: 'In 1979 McKay noticed 196,884 = 196,883 + 1, both dimensions of Monster-group representations. Conway & Norton turned it into a conjecture; Borcherds proved it in 1992 and won the Fields Medal.',
    presetId: 'deep-space',
    rewardId: '600-cell-glow',
  },
  {
    id: 'daily-schlafli',
    title: 'One beautiful fact: Schläfli symbols',
    body: 'Schläfli’s {p,q} notation classifies regular polytopes in any dimension. {3,3,5} is the 600-cell; {5/2,5} is the small stellated dodecahedron. The 5/2 means a pentagram face.',
    presetId: 'platonic-bloom',
    rewardId: 'polytope-prism',
  },
  {
    id: 'daily-weyl-order',
    title: 'One beautiful fact: the Weyl group order',
    body: 'The Weyl group of E8 has order 696,729,600 = 2¹⁴ · 3⁵ · 5² · 7. Every element permutes the 240 roots — yet this enormous group is still finite.',
    presetId: 'twin-600',
    rewardId: 'aurora-proof',
  },
  {
    id: 'daily-248',
    title: 'One beautiful fact: why 248?',
    body: 'dim(E8) = rank + roots = 8 + 240 = 248. Separately, consistency of the ten-dimensional heterotic-string construction permits Spin(32)/Z₂ or E8 × E8 gauge symmetry.',
    presetId: 'coxeter-rings',
    rewardId: 'coxeter-night',
  },
];

export const QUIZ_MODULES = [
  {
    id: 'platonic-foundations',
    title: 'Platonic Foundations',
    rewardId: 'coxeter-night',
    questions: [
      {
        prompt: 'How many convex regular Platonic solids exist in 3D?',
        choices: ['5', '6', '8'],
        answer: 0,
        explanation: 'There are exactly five: tetrahedron, cube, octahedron, dodecahedron, and icosahedron.',
      },
      {
        prompt: 'Which solid is dual to the cube?',
        choices: ['Octahedron', 'Dodecahedron', 'Icosahedron'],
        answer: 0,
        explanation: 'The cube and octahedron exchange faces and vertices under duality.',
      },
      {
        prompt: 'Which Platonic solid is self-dual?',
        choices: ['Tetrahedron', 'Cube', 'Icosahedron'],
        answer: 0,
        explanation: 'The tetrahedron has another tetrahedron as its dual.',
      },
    ],
  },
  {
    id: 'sixhundred-basics',
    title: '600-cell Basics',
    rewardId: '600-cell-glow',
    questions: [
      {
        prompt: 'How many vertices does the 600-cell have?',
        choices: ['120', '240', '600'],
        answer: 0,
        explanation: 'The 600-cell has 120 vertices, 720 edges, and 1200 triangular faces.',
      },
      {
        prompt: 'The 600-cell lives naturally in how many dimensions?',
        choices: ['4', '3', '8'],
        answer: 0,
        explanation: 'It is a regular 4D polytope.',
      },
      {
        prompt: 'Its faces are regular...',
        choices: ['triangles', 'squares', 'pentagons'],
        answer: 0,
        explanation: 'The 600-cell is bounded by 1200 triangular faces.',
      },
    ],
  },
  {
    id: 'coxeter-plane',
    title: 'Coxeter Plane',
    rewardId: 'postcard-prime',
    questions: [
      {
        prompt: 'The Coxeter plane helps visualize E8 by projecting from...',
        choices: ['8D to 2D', '3D to 1D', '4D to 3D'],
        answer: 0,
        explanation: 'The app projects the 8D root system into a special 2D plane.',
      },
      {
        prompt: 'The E8 Coxeter projection in this app shows...',
        choices: ['8 rings', '5 rings', '600 rings'],
        answer: 0,
        explanation: 'The 240 roots land on eight concentric rings, 30 roots per ring.',
      },
      {
        prompt: 'The Petrie polygon highlighted in E8 has length...',
        choices: ['30', '8', '120'],
        answer: 0,
        explanation: 'The E8 Petrie cycle has 30 steps.',
      },
    ],
  },
  {
    id: 'e8-roots',
    title: 'E8 Roots',
    rewardId: 'aurora-proof',
    questions: [
      {
        prompt: 'How many roots are in the E8 root system?',
        choices: ['240', '120', '248'],
        answer: 0,
        explanation: 'E8 has 240 roots. The Lie algebra has dimension 248.',
      },
      {
        prompt: 'E8 has rank...',
        choices: ['8', '4', '12'],
        answer: 0,
        explanation: 'Rank 8 means the Cartan subalgebra has eight dimensions.',
      },
      {
        prompt: 'The app offers root colors based on...',
        choices: ['structural data and display modes', 'random ads', 'user accounts'],
        answer: 0,
        explanation: 'Modes include structural values such as shell or projected radius plus explicit display choices such as index and mono.',
      },
    ],
  },
  {
    id: 'mckay-correspondence',
    title: 'McKay Correspondence',
    rewardId: 'coxeter-night',
    questions: [
      {
        prompt: 'McKay correspondence connects Platonic symmetry to...',
        choices: ['ADE diagrams', 'weather maps', 'prime-only polygons'],
        answer: 0,
        explanation: 'The ADE diagrams are the bridge between finite symmetries and Lie theory.',
      },
      {
        prompt: 'The icosahedron is especially tied to...',
        choices: ['binary icosahedral symmetry', 'square tilings', 'flat tori only'],
        answer: 0,
        explanation: 'The binary icosahedral group is central to the E8/600-cell story.',
      },
      {
        prompt: 'In E8 Studio, choosing a McKay source highlights...',
        choices: ['an illustrative E8 subset', 'external ads', 'private contacts'],
        answer: 0,
        explanation: 'The app highlights an illustrative subset; it is not a canonical vertex-by-vertex McKay map.',
      },
    ],
  },
  {
    id: 'bloom-morph',
    title: 'Bloom Morph',
    rewardId: 'mandelbox-fold',
    questions: [
      {
        prompt: 'The Bloom view morphs a Platonic solid toward...',
        choices: ['the E8 Coxeter projection', 'a single point', 'a 2D square'],
        answer: 0,
        explanation: 'Bloom interpolates from a source solid through 600-cell slices to the 240-root E8 Coxeter plane.',
      },
      {
        prompt: 'How many roots does the morph end at?',
        choices: ['240', '120', '12'],
        answer: 0,
        explanation: 'The morph concludes at the 240 E8 roots arranged on the Coxeter plane.',
      },
      {
        prompt: 'The fractal fold available in Bloom is called a...',
        choices: ['mandelbox', 'tesseract', 'Petrie polygon'],
        answer: 0,
        explanation: 'The Mandelbox control is an app-designed scale-and-fold effect; the φ² preset is a visual choice, not a canonical E8 parameter.',
      },
    ],
  },
  {
    id: '4d-polytopes',
    title: '4D Polytopes',
    rewardId: 'polytope-prism',
    questions: [
      {
        prompt: 'A rotation in 4D is specified by a...',
        choices: ['plane and an angle', 'single axis', 'point only'],
        answer: 0,
        explanation: 'Unlike 3D (axis + angle), 4D rotations live in a plane. ℝ⁴ has six independent rotation planes.',
      },
      {
        prompt: 'How many convex regular polytopes exist in 4D?',
        choices: ['6', '5', '3'],
        answer: 0,
        explanation: 'Six: 5-cell, tesseract, 16-cell, 24-cell, 600-cell, 120-cell. (3D has only five.)',
      },
      {
        prompt: 'The tesseract is the 4D analogue of the 3D...',
        choices: ['cube', 'tetrahedron', 'sphere'],
        answer: 0,
        explanation: 'The tesseract {4,3,3} is the 4-cube — 16 vertices, 32 edges, the 4D extension of the cube {4,3}.',
      },
    ],
  },
  {
    id: 'e8-sdf',
    title: 'E8 SDF',
    rewardId: '600-cell-glow',
    questions: [
      {
        prompt: 'The SDF view renders E8 by...',
        choices: ['raymarching 240 spheres', 'drawing flat dots', 'tiling triangles'],
        answer: 0,
        explanation: 'Each root becomes a small sphere; a raymarcher shades the scene with shadows, AO, and fresnel light.',
      },
      {
        prompt: 'SDF stands for...',
        choices: ['signed distance function', 'standard depth field', 'solid dynamic form'],
        answer: 0,
        explanation: 'A signed distance function reports distance-to-surface, letting rays advance without overshooting.',
      },
      {
        prompt: 'The "blend" slider in SDF controls...',
        choices: ['how much spheres melt together', 'camera speed', 'background colour'],
        answer: 0,
        explanation: 'It is the smin k parameter — high values fuse the 240 spheres into one organic blob.',
      },
    ],
  },
];

export const LEARNING_CONTENT_PROVENANCE = {
  biographies: {
    plato: ['mactutor-plato'], theaetetus: ['mactutor-theaetetus'], euclid: ['mactutor-euclid'],
    kepler: ['mactutor-kepler', 'mathworld-kepler-poinsot'], schlafli: ['mactutor-schlafli'],
    cartan: ['mactutor-cartan'], coxeter: ['mactutor-coxeter', 'stembridge-coxeter-planes'],
    freudenthal: ['mactutor-freudenthal'], mckay: ['mactutor-mckay', 'mckay-michigan-notes'],
    conway: ['mactutor-conway'], borcherds: ['mactutor-borcherds'], bourbaki: ['bourbaki-history'],
  },
  timeline: [
    ['mactutor-plato'], ['mactutor-euclid', 'mactutor-theaetetus'], ['mactutor-schlafli'],
    ['mactutor-cartan'], ['bourbaki-history'], ['mactutor-coxeter'],
    ['mactutor-mckay', 'mactutor-borcherds'], ['gross-heterotic-string'],
    ['mactutor-borcherds'], ['aim-e8-technical'],
  ],
  daily: {
    'daily-roots-240': ['mit-e8-plane'], 'daily-duals': ['mathworld-platonic-solids'],
    'daily-600': ['mathworld-600-cell'], 'daily-mckay': ['mckay-michigan-notes'],
    'daily-octonions': ['baez-octonions'], 'daily-petrie': ['stembridge-coxeter-planes'],
    'daily-moonshine': ['mactutor-borcherds'], 'daily-schlafli': ['mathworld-schlafli-symbol'],
    'daily-weyl-order': ['aim-e8-technical'], 'daily-248': ['aim-e8-technical', 'gross-heterotic-string'],
  },
  quizzes: {
    'platonic-foundations': ['mathworld-platonic-solids'], 'sixhundred-basics': ['mathworld-600-cell'],
    'coxeter-plane': ['mit-e8-plane', 'stembridge-coxeter-planes'], 'e8-roots': ['aim-e8-technical'],
    'mckay-correspondence': ['mckay-michigan-notes'], 'bloom-morph': ['mit-e8-plane', 'mathworld-600-cell'],
    '4d-polytopes': ['mathworld-schlafli-symbol', 'mathworld-120-cell'], 'e8-sdf': ['hart-sphere-tracing'],
  },
  curiosity: {
    bloom: ['mit-e8-plane'], platonic: ['mathworld-platonic-solids'], e8coxeter: ['mit-e8-plane'],
    sixhundred: ['mathworld-600-cell', 'mckay-michigan-notes'], polytope: ['mathworld-schlafli-symbol'],
    raymarched: ['hart-sphere-tracing'],
  },
};

for (const biography of BIOGRAPHIES) {
  biography.claimType = 'historical-context';
  biography.sourceIds = LEARNING_CONTENT_PROVENANCE.biographies[biography.id] || [];
  biography.scopeNote = 'Concise historical biography; dates and attributions follow the linked history sources.';
}
TIMELINE.forEach((entry, index) => {
  entry.id = `timeline-${index + 1}`;
  entry.claimType = 'historical-context';
  entry.sourceIds = LEARNING_CONTENT_PROVENANCE.timeline[index] || [];
  entry.scopeNote = 'Historical milestone; technical claims are limited to the linked source scope.';
});
for (const fact of DAILY_FACTS) {
  fact.claimType = 'established-mathematics';
  fact.sourceIds = LEARNING_CONTENT_PROVENANCE.daily[fact.id] || [];
  fact.scopeNote = 'Short-form fact; visual preset and cosmetic reward are app-designed.';
}
for (const quiz of QUIZ_MODULES) {
  quiz.claimType = quiz.id === 'bloom-morph' ? 'app-designed-visualization' : 'established-mathematics';
  quiz.sourceIds = LEARNING_CONTENT_PROVENANCE.quizzes[quiz.id] || [];
  quiz.scopeNote = quiz.id === 'bloom-morph'
    ? 'Questions distinguish the Studio’s designed morph from its sourced mathematical endpoints.'
    : 'Question explanations are checked against the linked lesson-level sources.';
}
for (const [id, card] of Object.entries(CURIOUS_CARDS)) {
  card.claimType = id === 'bloom' || id === 'raymarched' ? 'app-designed-visualization' : 'established-mathematics';
  card.sourceIds = LEARNING_CONTENT_PROVENANCE.curiosity[id] || [];
  card.scopeNote = 'Compact prompt; metaphorical wording describes the visualization, not a new mathematical relation.';
}

export function dailyFactForDate(date = new Date()) {
  const stamp = date instanceof Date ? date.toISOString().slice(0, 10) : String(date).slice(0, 10);
  let sum = 0;
  for (let i = 0; i < stamp.length; i++) sum += stamp.charCodeAt(i);
  return DAILY_FACTS[sum % DAILY_FACTS.length];
}
