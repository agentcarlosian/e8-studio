// Renderer-independent curriculum graph. Desktop and mobile shells consume the
// same ordered paths while retaining separate presentation and navigation UI.
// Experiments only configure models already present in E8 Studio. Proposed
// models remain outside this graph until they arrive as focused, tested
// features in both shells.

const step = (id, title, instruction, question, takeaway, action) => ({
  id, title, instruction, question, takeaway, action,
});

export const LEARNING_PATHS = [
  {
    id: 'solid-foundations',
    title: 'Solid Foundations',
    description: 'Build intuition from regular solids, duality, and four-dimensional analogues.',
    lessons: [
      {
        id: 'why-five-solids', title: 'Why exactly five regular solids?', view: 'platonic', estimatedMinutes: 7, prerequisites: [],
        shortAnswer: 'A regular solid can close only when the identical faces meeting at each vertex leave some angular room to bend. At least three faces must meet, and their angles must total less than 360°. Only five polygon-and-count combinations satisfy that rule.',
        keyIdeas: ['Triangles permit three, four, or five faces at a vertex; squares and pentagons permit three.', 'Three regular hexagons already total 360°, so they lie flat instead of forming a convex corner.'],
        visualEvidence: {
          columns: ['Faces at one vertex', 'Angle total', 'Result'],
          rows: [
            ['3 triangles', '180°', 'Tetrahedron'],
            ['4 triangles', '240°', 'Octahedron'],
            ['5 triangles', '300°', 'Icosahedron'],
            ['3 squares', '270°', 'Cube'],
            ['3 pentagons', '324°', 'Dodecahedron'],
            ['3 hexagons', '360°', 'Flat tiling'],
          ],
        },
        proof: {
          formula: '(p − 2)(q − 2) < 4',
          explanation: 'For regular p-gons with q faces at every vertex, this inequality is the angle-sum condition written in integer form.',
          cases: [
            ['Triangle', '3', 'Tetrahedron'],
            ['Triangle', '4', 'Octahedron'],
            ['Triangle', '5', 'Icosahedron'],
            ['Square', '3', 'Cube'],
            ['Pentagon', '3', 'Dodecahedron'],
          ],
          boundary: 'Three regular hexagons contribute exactly 360°, so they lie flat as a tiling instead of closing into a convex solid.',
        },
        objectives: ['Recognize the five convex regular solids.', 'Explain face–vertex duality.'],
        activity: 'Open each regular solid and match its face type and vertex count to the five angle-sum cases.',
        claimType: 'established-mathematics', claimNote: 'The five-solid classification and dual pairs are standard results for convex regular polyhedra.',
        essayIds: ['platonic_why_five', 'platonic_duals', 'platonic_phi', 'kepler_poinsot'], quizId: 'platonic-foundations', sourceIds: ['mathworld-platonic-solids'],
        experiment: {
          title: 'Test the angle rule', intro: 'Compare valid convex corners with the 360° boundary where regular faces lie flat.',
          steps: [
            step('triangles', 'Count triangular faces', 'Open the icosahedron and focus on one vertex. Count the five triangular faces that meet there.', 'Why can five triangles bend into a convex corner?', 'Five 60° angles total 300°, leaving a 60° angular deficit that lets the faces fold inward.', { view: 'platonic', params: { shape: 'icosahedron', autoRotate: false } }),
            step('pentagons', 'Test the largest valid face', 'Open the dodecahedron and count the three pentagons meeting at one vertex.', 'How much angular room remains at that vertex?', 'Three 108° angles total 324°, leaving 36° of angular deficit.', { view: 'platonic', params: { shape: 'dodecahedron', autoRotate: false } }),
            step('boundary', 'Find the flat boundary', 'Return to the evidence table and compare three hexagons with the five solid cases.', 'Why do three regular hexagons fail to make a sixth Platonic solid?', 'Their 120° angles total exactly 360°, so the faces lie flat instead of bending into a convex corner.', { view: 'platonic', params: { shape: 'dodecahedron', autoRotate: false } }),
          ],
          reflection: 'Exactly five regular arrangements leave positive angular curvature at every vertex.',
        },
        connections: [{ lessonId: 'into-four-dimensions', label: 'Extend regularity into 4D' }],
      },
      {
        id: 'into-four-dimensions', title: 'Into four dimensions', view: 'polytope', estimatedMinutes: 9, prerequisites: ['why-five-solids'],
        shortAnswer: 'A four-dimensional object needs four coordinates instead of three. We cannot see all four directions directly, so E8 Studio projects a 4D polytope into 3D and then onto the screen; the apparent stretching belongs to the projection, not the original regular figure.',
        keyIdeas: ['A 4D rotation acts in one of six coordinate planes.', 'Projection changes appearance while preserving the polytope’s intrinsic vertices and edges.'],
        objectives: ['Read a basic Schläfli symbol.', 'Distinguish projection from intrinsic 4D geometry.'],
        activity: 'Rotate a tesseract in two independent planes and identify projection changes.',
        claimType: 'established-mathematics', claimNote: 'Polytope counts and Schläfli notation are mathematical facts; the animated projection is an explanatory display choice.',
        essayIds: ['rotation_planes_4d', 'schlafli_symbols', 'the_120cell'], quizId: '4d-polytopes', sourceIds: ['mathworld-600-cell'],
        experiment: {
          title: 'Rotate without moving through space', intro: 'A 4D rotation acts in a coordinate plane. Compare two rotations while the tesseract itself remains unchanged.',
          steps: [
            step('baseline', 'Establish the projection', 'Open a stationary tesseract in its cube-within-a-cube projection.', 'Are the inner and outer cubes separate objects?', 'They are parts of one tesseract seen through a 3D projection.', { view: 'polytope', params: { poly4d: 'tesseract', morph4d: 0.65, polyAutoRotate: false, polyRotXY: 0, polyRotZW: 0, polyRotXW: 0 } }),
            step('xw-plane', 'Rotate in the XW plane', 'Apply an XW rotation and follow vertices whose depth changes.', 'Which apparent distortions come from projection rather than the polytope?', 'Edge lengths appear to change on screen even though the intrinsic tesseract remains regular.', { view: 'polytope', params: { poly4d: 'tesseract', morph4d: 0.65, polyAutoRotate: false, polyRotXW: 0.9, polyRotZW: 0 } }),
            step('double-plane', 'Add an independent plane', 'Combine the XW rotation with a ZW rotation.', 'Why can a 4D object have more rotational freedom than a 3D one?', 'Four coordinates provide six coordinate planes, so several independent plane rotations can contribute to one pose.', { view: 'polytope', params: { poly4d: 'tesseract', morph4d: 0.65, polyAutoRotate: false, polyRotXW: 0.9, polyRotZW: 0.7 } }),
          ],
          reflection: 'A changing projection is evidence about viewpoint and rotation, not a deformation of the underlying polytope.',
        },
        connections: [{ lessonId: 'six-hundred-cell', label: 'Meet the most intricate simplicial 4-polytope' }],
      },
    ],
  },
  {
    id: 'coxeter-geometry', title: 'E8 & Coxeter Geometry', description: 'Begin with the E8 picture, then connect it to projections, reflections, and the 600-cell.',
    lessons: [
      {
        id: 'meet-e8', title: 'What am I looking at?', view: 'e8coxeter', estimatedMinutes: 5, prerequisites: [],
        shortAnswer: 'This image is a two-dimensional shadow of E8’s 240 root vectors. The roots live in eight dimensions, where they encode reflection symmetries. E8 Studio projects them onto a special plane so their organization becomes visible as eight rings of 30 points.',
        keyIdeas: ['Each dot is backed by an eight-dimensional vector; its screen position is only a projection.', 'A 30-step Coxeter symmetry divides the 240 roots into eight visible cycles: 8 × 30 = 240.'],
        visualEvidence: {
          columns: ['What you see', 'What it means'],
          rows: [
            ['240 points', 'The full E8 root system'],
            ['8 rings', 'Eight Coxeter orbits'],
            ['30 points per ring', 'The order-30 symmetry cycle'],
            ['Lines and highlights', 'Relationships and display aids, not extra roots'],
          ],
        },
        objectives: ['Identify the dots as projected E8 roots.', 'Separate the eight-dimensional data from its screen projection.'],
        activity: 'Show the ring guides, follow a 30-step orbit, then tap one root to inspect its eight-dimensional data.',
        claimType: 'established-mathematics', claimNote: 'The 240 roots and Coxeter projection are mathematical data; color, glow, and explanatory chord layers are display choices.',
        essayIds: ['e8_overview', 'coxeter', 'why_248', 'bourbaki_e8', 'e8_string_theory'], quizId: 'e8-roots', sourceIds: ['aim-e8-technical', 'mit-e8-plane'],
        experiment: {
          title: 'Read the E8 picture in layers', intro: 'Start with the rings, add one orbit, then inspect the data behind a point.',
          steps: [
            step('rings', 'Count the eight rings', 'Open E8 Coxeter with ring guides on and the Petrie path off.', 'How do the 240 roots divide across the rings?', 'Each of the eight rings contains 30 projected roots, so 8 × 30 = 240.', { view: 'e8coxeter', params: { e8ViewMode: 'coxeter', showRings: true, showPetrie: false, showWeylMirrors: false, autoRotate: false } }),
            step('orbit', 'Follow one 30-step cycle', 'Turn on the Petrie path and trace its equal angular steps around the projection.', 'What returns after one complete cycle?', 'The Coxeter action returns after 30 steps, matching the 30 roots in each visible orbit.', { view: 'e8coxeter', params: { e8ViewMode: 'coxeter', showRings: true, showPetrie: true, showWeylMirrors: false, autoRotate: false } }),
            step('root', 'Inspect one root', 'Tap a root and compare its screen position with the 8D coordinates in the root drawer.', 'What makes the dot an E8 root rather than an ordinary point?', 'Its underlying eight-dimensional coordinates, norm, and inner products—not its screen position.', { view: 'e8coxeter', params: { e8ViewMode: 'coxeter', showRings: true, showPetrie: false, pickedRoot: 0, showInspector: true, autoRotate: false } }),
          ],
          reflection: 'The projection is useful because it turns an eight-dimensional symmetry into a visible thirty-step rhythm without replacing the underlying data.',
        },
        connections: [{ lessonId: 'coxeter-plane', label: 'Learn why this particular projection is special' }, { lessonId: 'roots-reflections', label: 'Explore the vector data behind the dots' }],
      },
      {
        id: 'six-hundred-cell', title: 'The 600-cell', view: 'sixhundred', estimatedMinutes: 8, prerequisites: ['into-four-dimensions'],
        shortAnswer: 'The 600-cell is the regular 4D polytope {3,3,5}: 600 tetrahedral cells meet around 120 vertices. Its vertex coordinates can also be read as the 120 unit quaternions of the binary icosahedral group, which is why it repeatedly appears near exceptional symmetry.',
        keyIdeas: ['Its 120 vertices and 720 edges are intrinsic even when a projection overlaps them.', 'It is dual to the 120-cell and carries strong icosahedral symmetry.'],
        objectives: ['Identify the 600-cell’s basic counts.', 'Relate its vertices to binary icosahedral unit quaternions.'],
        activity: 'Compare vertex classes while rotating the 4D projection.',
        claimType: 'established-mathematics', claimNote: 'Element counts, duality, and the quaternion model are established; screen depth and motion are projection choices.',
        essayIds: ['sixhundred_overview', 'quaternions_600cell', 'sixhundred_conjugacy'], quizId: 'sixhundred-basics', sourceIds: ['mathworld-600-cell'],
        experiment: {
          title: 'Separate structure from projection', intro: 'Hold the 600-cell still, then move it and change the highlighted icosahedral context.',
          steps: [
            step('still', 'Read the still projection', 'Open the 600-cell with all edges visible and pause its rotation.', 'Which counts belong to the polytope even when the drawing overlaps?', 'The 120 vertices and 720 edges are intrinsic; overlap is a consequence of projection.', { view: 'sixhundred', params: { shape: 'icosahedron', showEdges: true, autoRotate: false } }),
            step('rotate', 'Change the projection', 'Start a slow rotation and watch crossings appear and disappear.', 'Did the adjacency of any two vertices change?', 'Rotation changes screen positions but preserves the edge graph.', { view: 'sixhundred', params: { shape: 'icosahedron', showEdges: true, autoRotate: true, rotationSpeed: 0.003 } }),
            step('context', 'Change the symmetry context', 'Use dodecahedral highlighting while keeping the same 600-cell.', 'What changed: the polytope or the subset being emphasized?', 'The underlying 600-cell is unchanged; the Studio is changing the explanatory highlight.', { view: 'sixhundred', params: { shape: 'dodecahedron', showEdges: true, autoRotate: false } }),
          ],
          reflection: 'Mathematical structure survives changes of projection, color, motion, and emphasis.',
        },
        connections: [{ lessonId: 'rank-two-reflections', label: 'Build a root system from two reflections' }, { lessonId: 'coxeter-plane', label: 'Project E8 with a symmetry-adapted plane' }, { lessonId: 'mckay-bridge', label: 'Return to the binary polyhedral bridge' }],
      },
      {
        id: 'rank-two-reflections', title: 'Root systems from reflections', view: 'rootlab', estimatedMinutes: 8, prerequisites: ['six-hundred-cell'],
        shortAnswer: 'Start with two simple roots and reflect each root across the mirror perpendicular to the other. When the angle between the mirrors is a rational fraction of a full turn, repeated reflections close into a finite, symmetric root system such as A2, B2, G2, or H2.',
        keyIdeas: ['Two reflections compose into a rotation.', 'The angle and root-length ratio determine which finite rank-2 system closes.'],
        objectives: ['Generate a finite root system from two simple roots.', 'Compare crystallographic and non-crystallographic rank-2 symmetry.'],
        activity: 'Build A2, G2, and H2 in layers by toggling simple roots, mirrors, chambers, and the Coxeter orbit.',
        claimType: 'established-mathematics', claimNote: 'The roots, reflection closure, Coxeter numbers, chambers, and crystallographic classification are computed from standard rank-2 Coxeter data.',
        essayIds: ['simple_roots', 'weyl'], quizId: 'rank-two-roots', sourceIds: ['magma-rank2-root-systems'],
        experiment: {
          title: 'Grow symmetry from two roots', intro: 'Start with the smallest irreducible rank-2 system, then change its angle and root-length ratio. Each frame is generated by reflection rather than loaded as a drawing.',
          steps: [
            step('a2', 'Generate A2', 'Open A2 with its two simple roots, reflection mirrors, and chambers visible.', 'How do two generating roots produce six roots?', 'Repeated reflection closes after six directions, forming six chambers and the hexagonal A2 root system.', { view: 'rootlab', params: { rootSystem: 'A2', rootShowMirrors: true, rootShowChambers: true, rootShowSimple: true, rootShowOrbit: false } }),
            step('g2', 'Compare two root lengths', 'Switch to G2 and keep the same overlays while comparing its long and short roots.', 'What changed besides the total number of roots?', 'G2 uses two root lengths with ratio square root of three and closes into twelve roots and twelve chambers.', { view: 'rootlab', params: { rootSystem: 'G2', rootShowMirrors: true, rootShowChambers: true, rootShowSimple: true, rootShowOrbit: false } }),
            step('h2', 'Cross the crystallographic boundary', 'Open H2 and turn on its Coxeter orbit to follow the fivefold reflection rhythm.', 'Why is H2 visually regular but not crystallographic?', 'Its fivefold Cartan data involves the golden ratio rather than integers, so it is a finite Coxeter root system but not a crystallographic Lie root system.', { view: 'rootlab', params: { rootSystem: 'H2', rootShowMirrors: true, rootShowChambers: true, rootShowSimple: true, rootShowOrbit: true } }),
          ],
          reflection: 'A large symmetric picture can be generated by a very small rule: two roots and their reflections.',
        },
        connections: [{ lessonId: 'coxeter-multigrids', label: 'Turn root directions into periodic and quasiperiodic tiles' }, { lessonId: 'reading-dynkin', label: 'Compress simple-root relations into diagrams' }],
      },
      {
        id: 'coxeter-multigrids', title: 'From roots to quasicrystals', view: 'tiling', estimatedMinutes: 9, prerequisites: ['rank-two-reflections'],
        shortAnswer: 'Use root directions as normals for families of parallel lines, then replace every crossing by a rhombus whose edges follow those directions. With H2’s fivefold directions, the result has long-range order and repeated local patterns but no translation that repeats the whole plane.',
        keyIdeas: ['A multigrid crossing is dual to one rhombus.', 'Rotational order does not imply translational periodicity.'],
        objectives: ['Explain how a multigrid crossing becomes a dual rhombus.', 'Distinguish local rotational order from translational periodicity.'],
        activity: 'Reveal the H2 pentagrid, then compare its quasiperiodic rhombi with the repeating A2 lozenge lattice.',
        claimType: 'established-mathematics', claimNote: 'Root directions and pentagrid duality are established; this finite crop, its relief, palette, and animated color flow are display choices.',
        essayIds: ['coxeter_multigrids', 'quasiperiodic_order'], quizId: 'coxeter-multigrids', sourceIds: ['magma-rank2-root-systems', 'debruijn-pentagrids'],
        experiment: {
          title: 'Dualize symmetry into tiles', intro: 'Start with fivefold H2, expose the construction lines, then compare its order with a repeating A2 lattice.',
          steps: [
            step('h2-rhombi', 'Read the H2 rhombi', 'Open H2 with tiles, edges, and its central root star visible.', 'Which acute angles repeat across the two rhombus classes?', 'The H2 directions produce rhombi with 36-degree and 72-degree acute angles, reflecting fivefold geometry.', { view: 'tiling', params: { tilingSystem: 'H2', tilingShowTiles: true, tilingShowEdges: true, tilingShowGrid: false, tilingShowRoots: true, tilingAnimate: false, tilingDensity: 5, tilingRelief: 0.08 } }),
            step('pentagrid', 'Reveal the pentagrid', 'Turn on the five generating line families while keeping the dual tiles visible.', 'How does one line crossing correspond to one tile?', 'The two crossing line directions become the two edge directions of the dual rhombus.', { view: 'tiling', params: { tilingSystem: 'H2', tilingShowTiles: true, tilingShowEdges: true, tilingShowGrid: true, tilingShowRoots: true, tilingAnimate: false, tilingDensity: 5, tilingRelief: 0 } }),
            step('periodic-compare', 'Compare periodic A2', 'Switch to A2 with the same tile and multigrid layers visible.', 'What repeats in A2 that does not repeat across the full H2 pattern?', 'A2 has a translational unit cell; H2 has recurring local patches and long-range order without a repeating translation.', { view: 'tiling', params: { tilingSystem: 'A2', tilingShowTiles: true, tilingShowEdges: true, tilingShowGrid: true, tilingShowRoots: true, tilingAnimate: false, tilingDensity: 5, tilingRelief: 0 } }),
          ],
          reflection: 'Symmetry can organize a plane globally without forcing the pattern to repeat by translation.',
        },
        connections: [{ lessonId: 'coxeter-plane', label: 'Scale symmetry-adapted directions from rank 2 to E8' }, { lessonId: 'rank-two-reflections', label: 'Return to the roots that supply the line directions' }],
      },
      {
        id: 'coxeter-plane', title: 'The Coxeter plane', view: 'e8coxeter', estimatedMinutes: 8, prerequisites: ['coxeter-multigrids'],
        shortAnswer: 'The Coxeter plane is a symmetry-adapted 2D slice on which a Coxeter element acts as an ordinary rotation. For E8 the Coxeter number is 30, so the projection turns an eight-dimensional symmetry operation into visible 30-step circular rhythm.',
        keyIdeas: ['The plane is invariant under the chosen Coxeter element.', 'E8’s 240 roots appear as eight orbits of 30 projected roots.'],
        objectives: ['Explain why the projection is structurally special.', 'Recognize the eight 30-root orbits.'],
        activity: 'Toggle rings and the Petrie path, then follow one 30-step orbit.',
        claimType: 'established-mathematics', claimNote: 'The Coxeter projection and root orbits are canonical up to orientation and scale; glow and color are display choices.',
        essayIds: ['coxeter', 'petrie_polygon'], quizId: 'coxeter-plane', sourceIds: ['mit-e8-plane', 'stembridge-coxeter-planes'],
        experiment: {
          title: 'Find the order-30 rhythm', intro: 'Build the Coxeter-plane picture in layers, from rings to one orbit and then reflection context.',
          steps: [
            step('rings', 'Start with the eight rings', 'Show the ring guides and temporarily remove the Petrie path.', 'How can 240 roots divide evenly across eight rings?', 'Each ring contains 30 projected roots: 8 × 30 = 240.', { view: 'e8coxeter', params: { e8ViewMode: 'coxeter', showRings: true, showPetrie: false, showWeylMirrors: false, autoRotate: false } }),
            step('petrie', 'Trace a 30-step orbit', 'Add the Petrie path and follow its equal angular steps.', 'What repeats after one full turn?', 'The Coxeter element has order 30, and this orbit returns after 30 steps.', { view: 'e8coxeter', params: { e8ViewMode: 'coxeter', showRings: true, showPetrie: true, showWeylMirrors: false, autoRotate: false } }),
            step('mirrors', 'Add reflection context', 'Turn on Weyl mirrors while keeping the ring and path structure visible.', 'How do a few generating reflections relate to the much larger root system?', 'Simple reflections generate the Weyl group that permutes all 240 roots.', { view: 'e8coxeter', params: { e8ViewMode: 'coxeter', showRings: true, showPetrie: true, showWeylMirrors: true, autoRotate: false } }),
          ],
          reflection: 'The Coxeter plane is useful because its rotation exposes algebraic order as visible rhythm.',
        },
        connections: [{ lessonId: 'roots-reflections', label: 'Inspect the reflections behind the picture' }, { lessonId: 'distance-fields', label: 'Render the same source points as a field' }],
      },
      {
        id: 'roots-reflections', title: 'Roots and reflections', view: 'e8coxeter', estimatedMinutes: 10, prerequisites: ['coxeter-plane'],
        shortAnswer: 'The E8 roots are 240 vectors of squared length 2 in eight dimensions. Reflecting roots across the hyperplanes perpendicular to eight chosen simple roots generates symmetries that permute the entire set; together these reflections form the E8 Weyl group.',
        keyIdeas: ['A root is defined by coordinates, length, and inner products—not by its screen position.', 'Eight simple roots form a basis whose reflections organize all 240 roots.'],
        objectives: ['Distinguish roots from simple roots.', 'Interpret a Weyl reflection as a symmetry operation.'],
        activity: 'Select a root, inspect its neighbors, and animate a Weyl path.',
        claimType: 'established-mathematics', claimNote: 'Root counts, inner products, and Weyl reflections come from the canonical E8 data; the interface highlighting is explanatory.',
        essayIds: ['e8_overview', 'simple_roots', 'weyl', 'octonions'], quizId: 'e8-roots', sourceIds: ['aim-e8-technical'],
        experiment: {
          title: 'Use one root to navigate 240', intro: 'Select a deterministic root, reveal its graph neighborhood, and then add the simple-reflection mirrors.',
          steps: [
            step('select', 'Choose a root', 'Open the root inspector on root 0 and read its 8D coordinates and opposite root.', 'What makes the displayed point a root rather than merely a dot?', 'Its coordinates, norm, and inner products belong to the canonical E8 root data.', { view: 'e8coxeter', params: { e8ViewMode: 'coxeter', pickedRoot: 0, showInspector: true, rootDiffusion: false, showWeylMirrors: false } }),
            step('neighbors', 'Reveal Cartan neighbors', 'Turn on root diffusion from the selected root.', 'What does graph distance add that screen distance cannot?', 'The diffusion follows root adjacency, so visually nearby points need not be algebraically adjacent.', { view: 'e8coxeter', params: { e8ViewMode: 'coxeter', pickedRoot: 0, showInspector: true, rootDiffusion: true, rootHaloDepth: 3, showWeylMirrors: false } }),
            step('reflect', 'Expose the generators', 'Add the Weyl mirrors while preserving the selected-root context.', 'Why are eight simple roots enough to organize all 240 roots?', 'Their reflections generate the E8 Weyl group; the full root system is closed under those reflections.', { view: 'e8coxeter', params: { e8ViewMode: 'coxeter', pickedRoot: 0, showInspector: true, rootDiffusion: true, showWeylMirrors: true } }),
          ],
          reflection: 'The picture becomes mathematical when selections are tied back to coordinates, inner products, and symmetry actions.',
        },
        connections: [{ lessonId: 'reading-dynkin', label: 'Compress the simple-root data into a graph' }],
      },
    ],
  },
  {
    id: 'exceptional-bridges', title: 'Exceptional Bridges', description: 'Explore the qualified relationships connecting E8 to McKay and H4 imagery.',
    lessons: [
      {
        id: 'reading-dynkin', title: 'Reading Dynkin diagrams', view: 'dynkin', estimatedMinutes: 9, prerequisites: ['roots-reflections'],
        shortAnswer: 'A Dynkin diagram compresses a root system to its simple roots. Each node is one simple root, and each bond records their relative angle and length; E8 therefore needs eight nodes to encode its rank-8 basis even though the full system contains 240 roots.',
        keyIdeas: ['Dynkin nodes represent basis roots, not every root.', 'For simply-laced E8, a bond records inner product −1 under the standard normalization.'],
        objectives: ['Read nodes and bonds as simple-root data.', 'Distinguish finite E8 from affine E8^(1).'],
        activity: 'Switch among E6, E7, and E8 and locate the branch node and rank.',
        claimType: 'established-mathematics', claimNote: 'Finite simply-laced Dynkin diagrams encode simple-root inner products; the McKay graph uses their affine extensions.',
        essayIds: ['dynkin', 'simple_roots', 'affine_e8'], quizId: 'dynkin-diagrams', sourceIds: ['aim-e8-technical', 'mckay-michigan-notes'],
        experiment: {
          title: 'Grow the exceptional diagrams', intro: 'Compare E6, E7, and E8 while tracking rank, branch position, and Cartan-matrix size.',
          steps: [
            step('e6', 'Read E6', 'Open E6 and count six nodes before inspecting its 6 × 6 Cartan matrix.', 'What does each bond mean in a simply-laced diagram?', 'A bond records inner product −1 between the corresponding simple roots under the standard normalization.', { view: 'dynkin', params: { dynkin: 'E6' } }),
            step('e7', 'Extend to E7', 'Switch to E7 and identify the added node without losing the branch.', 'Which property changes immediately when one node is added?', 'The rank and Cartan-matrix dimension both increase from six to seven.', { view: 'dynkin', params: { dynkin: 'E7' } }),
            step('e8', 'Complete E8', 'Switch to E8 and compare its eight nodes with the 240-root visualization.', 'Why does the diagram have eight nodes rather than 240?', 'Dynkin nodes represent a simple-root basis, not every root in the system.', { view: 'dynkin', params: { dynkin: 'E8' } }),
          ],
          reflection: 'A Dynkin diagram is compact because it stores the generating simple-root relationships rather than drawing every root.',
        },
        connections: [{ lessonId: 'mckay-bridge', label: 'See why affine ADE diagrams reappear in group theory' }],
      },
      {
        id: 'mckay-bridge', title: 'McKay correspondence', view: 'e8coxeter', estimatedMinutes: 10, prerequisites: ['reading-dynkin'],
        shortAnswer: 'The McKay correspondence links finite subgroups of SU(2) with affine ADE Dynkin diagrams. The binary icosahedral group corresponds to affine E8; E8 Studio uses that established relationship as context, while its glowing vertex subsets are illustrative highlights rather than a canonical one-to-one root map.',
        keyIdeas: ['Binary polyhedral groups organize into the affine ADE pattern.', 'The mathematical correspondence and the Studio’s visual highlighting are not the same claim.'],
        objectives: ['Relate binary polyhedral groups to affine ADE graphs.', 'Separate the theorem from the Studio’s visual analogy.'],
        activity: 'Compare a McKay highlight with the corresponding affine-diagram reading.',
        claimType: 'interpretation', claimNote: 'The McKay correspondence is established; transitions among solids, the 600-cell, and E8 are a qualified visual analogy, not a literal construction.',
        essayIds: ['e8_mckay', 'affine_e8', 'moonshine'], quizId: 'mckay-correspondence', sourceIds: ['mckay-michigan-notes', 'kostant-gosset-circles'],
        experiment: {
          title: 'Cross three representations carefully', intro: 'Move from an icosahedron to an E8 highlight and finally to E8’s finite Dynkin diagram, noting where the theorem ends and the Studio’s analogy begins.',
          steps: [
            step('solid', 'Start with icosahedral symmetry', 'Open the icosahedron as the familiar geometric source.', 'Why does McKay use a binary group rather than this rotation group directly?', 'The classical correspondence uses finite subgroups of SU(2), which double-cover the rotational polyhedral groups in SO(3).', { view: 'platonic', params: { shape: 'icosahedron', autoRotate: false } }),
            step('highlight', 'Inspect the Studio highlight', 'Open E8 with the icosahedral source selected and compare the highlighted subset with all 240 roots.', 'Is this highlight itself the McKay correspondence?', 'No. It is an explanatory Studio selection; the theorem relates representations of a binary group to an affine ADE graph.', { view: 'e8coxeter', params: { shape: 'icosahedron', compareMode: 'off', showRings: true, showPetrie: false } }),
            step('diagram', 'Return to the diagram', 'Open finite E8 and read its eight simple-root nodes.', 'What must be added for the McKay graph associated with the binary icosahedral group?', 'The McKay graph is affine E8, which has an additional extending node beyond the finite E8 diagram shown here.', { view: 'dynkin', params: { dynkin: 'E8' } }),
          ],
          reflection: 'Good mathematical visualization labels when it is showing a theorem, source data, or a designed analogy.',
        },
        connections: [{ lessonId: 'designed-bloom', label: 'Apply the same theorem-versus-design test to Bloom' }, { lessonId: 'six-hundred-cell', label: 'Revisit binary icosahedral geometry' }],
      },
      {
        id: 'designed-bloom', title: 'The designed Bloom morph', view: 'bloom', estimatedMinutes: 6, prerequisites: ['mckay-bridge'],
        shortAnswer: 'Bloom is an authored visualization, not a canonical mathematical transformation. It interpolates and layers symmetry-derived point sets to make relationships visually suggestive while deliberately separating those artistic choices from claims about E8 itself.',
        keyIdeas: ['The source point sets are mathematical; the morph path, glow, and timing are design choices.', 'A compelling visual analogy can be useful without being an identity or proof.'],
        objectives: ['Identify which endpoints are sourced mathematics.', 'Recognize the interpolation as an artistic construction.'],
        activity: 'Pause the Bloom timeline at three points and describe what is data versus design.',
        claimType: 'app-designed-visualization', claimNote: 'Bloom is an artistic interpolation created for this app. It is not a canonical deformation or mathematical map into E8.',
        essayIds: ['bloom_morph', 'mandelbox_intro'], quizId: 'bloom-morph', sourceIds: ['mit-e8-plane', 'hart-sphere-tracing'],
        experiment: {
          title: 'Audit a beautiful interpolation', intro: 'Pause Bloom at its beginning, middle, and end, then classify what is mathematical data and what is authored motion.',
          steps: [
            step('start', 'Read the source endpoint', 'Pause Bloom at time 0 with the icosahedron selected.', 'Which part of this frame is canonical mathematics?', 'The regular icosahedron and its symmetry data are established; its styling is not.', { view: 'bloom', params: { shape: 'icosahedron', bloomAmount: 0, bloomAuto: false, bloomMandelbox: false } }),
            step('middle', 'Interrogate the transition', 'Move to the midpoint and inspect the in-between geometry.', 'Does the midpoint represent a recognized mathematical object?', 'Not necessarily. The interpolation is authored to be expressive and legible, not to define a canonical object.', { view: 'bloom', params: { shape: 'icosahedron', bloomAmount: 0.5, bloomAuto: false, bloomMandelbox: false } }),
            step('end', 'Read the destination image', 'Move to the final E8-inspired endpoint and compare it with the Coxeter view.', 'What is preserved from the canonical E8 projection?', 'The destination draws on the 240-root Coxeter image, while the path used to reach it remains app-designed.', { view: 'bloom', params: { shape: 'icosahedron', bloomAmount: 1, bloomAuto: false, bloomMandelbox: false } }),
          ],
          reflection: 'An artistic bridge can teach effectively when the interface is explicit about which claims are exact.',
        },
        connections: [{ lessonId: 'distance-fields', label: 'Separate source data from another rendering technique' }],
      },
    ],
  },
  {
    id: 'rendering-mathematics', title: 'Rendering Mathematics', description: 'Separate mathematical data from the visual techniques used to reveal it.',
    lessons: [
      {
        id: 'distance-fields', title: 'Signed-distance rendering', view: 'raymarched', estimatedMinutes: 8, prerequisites: ['coxeter-plane'],
        shortAnswer: 'A signed-distance field assigns every point in space a distance to a surface. E8 Studio places distance primitives at projected root positions and combines them with smooth unions, letting a ray marcher draw one continuous surface without moving or changing the underlying roots.',
        keyIdeas: ['The root coordinates remain fixed while radius and blending change the rendered surface.', 'The resulting surface is a visualization generated from E8 data, not the E8 root system itself.'],
        objectives: ['Explain what a signed distance function returns.', 'Separate E8 source points from the rendered surface.'],
        activity: 'Change sphere radius and blend, then describe which mathematical data stayed fixed.',
        claimType: 'rendering-technique', claimNote: 'Sphere tracing and distance fields are established rendering techniques; this scene’s shapes and composition are app-designed.',
        essayIds: ['sdf_raymarching', 'sdf_smooth_union'], quizId: 'e8-sdf', sourceIds: ['hart-sphere-tracing'],
        experiment: {
          title: 'Change the surface, keep the roots', intro: 'Vary the radius and smooth-union blend while holding the 240 E8 source points fixed.',
          steps: [
            step('separate', 'Resolve individual sources', 'Use small spheres and very little blending.', 'What determines where each surface component begins?', 'Each component is centered on a fixed projected E8 root point.', { view: 'raymarched', params: { sdfSphereR: 0.05, sdfBlend: 0.01, sdfEdges: 0.3, autoRotate: false } }),
            step('grow', 'Grow the field', 'Increase sphere radius while keeping the blend restrained.', 'Did any root coordinate move?', 'No. Only the rendered distance threshold changed.', { view: 'raymarched', params: { sdfSphereR: 0.1, sdfBlend: 0.02, sdfEdges: 0.3, autoRotate: false } }),
            step('merge', 'Smooth the unions', 'Increase blending until neighboring components flow together.', 'Is the merged surface itself the E8 root system?', 'No. It is a surface generated from the root positions by an app-selected distance-field composition.', { view: 'raymarched', params: { sdfSphereR: 0.1, sdfBlend: 0.12, sdfEdges: 0.2, autoRotate: false } }),
          ],
          reflection: 'A rendering can change radically while its mathematical source data remains identical.',
        },
        connections: [{ lessonId: 'coxeter-plane', label: 'Compare the field with the canonical projection' }, { lessonId: 'designed-bloom', label: 'Compare two app-designed presentations' }],
      },
    ],
  },
];

export const LEARNING_LESSONS = LEARNING_PATHS.flatMap((path, pathIndex) =>
  path.lessons.map((lesson, lessonIndex) => Object.freeze({ ...lesson, pathId: path.id, pathIndex, lessonIndex })),
);

export function learningPathById(id) { return LEARNING_PATHS.find(path => path.id === id) || null; }
export function learningLessonById(id) { return LEARNING_LESSONS.find(lesson => lesson.id === id) || null; }
export function learningExperimentStep(lessonId, stepId) { return learningLessonById(lessonId)?.experiment?.steps?.find(entry => entry.id === stepId) || null; }

export function adjacentLearningLesson(id, direction = 1) {
  const index = LEARNING_LESSONS.findIndex(lesson => lesson.id === id);
  if (index < 0) return LEARNING_LESSONS[0] || null;
  return LEARNING_LESSONS[index + (direction < 0 ? -1 : 1)] || null;
}

export function learningLessonForView(view, completedLessonIds = []) {
  const completed = completedLessonIds instanceof Set ? completedLessonIds : new Set(Array.isArray(completedLessonIds) ? completedLessonIds : []);
  const matching = LEARNING_LESSONS.filter(lesson => lesson.view === view);
  return matching.find(lesson => !completed.has(lesson.id)) || matching[0] || LEARNING_LESSONS.find(lesson => !completed.has(lesson.id)) || LEARNING_LESSONS[0] || null;
}

export function learningPrerequisitesMet(lesson, completedLessonIds = []) {
  const completed = completedLessonIds instanceof Set ? completedLessonIds : new Set(Array.isArray(completedLessonIds) ? completedLessonIds : []);
  return (lesson?.prerequisites || []).every(id => completed.has(id));
}
