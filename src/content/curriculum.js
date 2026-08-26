// Renderer-independent curriculum graph. Desktop and mobile shells consume the
// same ordered paths while retaining separate presentation and navigation UI.
// Experiments only configure models already present in E8 Studio; proposed
// future models such as root-system generators and tilings live outside this
// curriculum and can arrive in focused feature PRs.

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
        id: 'why-five-solids', title: 'Why only five?', view: 'platonic', estimatedMinutes: 7, prerequisites: [],
        objectives: ['Recognize the five convex regular solids.', 'Explain face–vertex duality.'],
        activity: 'Switch among all five solids and compare one dual pair.',
        claimType: 'established-mathematics', claimNote: 'The five-solid classification and dual pairs are standard results for convex regular polyhedra.',
        essayIds: ['platonic_why_five', 'platonic_duals'], quizId: 'platonic-foundations', sourceIds: ['mathworld-platonic-solids'],
        experiment: {
          title: 'Find a dual pair', intro: 'Compare a familiar solid with its dual and watch faces exchange roles with vertices.',
          steps: [
            step('tetrahedron', 'Begin with the self-dual case', 'Open the tetrahedron and count four triangular faces and four vertices.', 'Why can the tetrahedron be its own dual?', 'Replacing each face by a vertex produces another tetrahedron because both counts are four.', { view: 'platonic', params: { shape: 'tetrahedron', autoRotate: false } }),
            step('cube', 'Inspect the cube', 'Open the cube and compare its six faces with its eight vertices.', 'Which counts should its dual reverse?', 'A dual must have eight faces and six vertices.', { view: 'platonic', params: { shape: 'cube', autoRotate: false } }),
            step('octahedron', 'Reveal the dual', 'Switch to the octahedron and compare it directly with the cube.', 'What stayed regular while the counts exchanged?', 'The cube and octahedron exchange faces and vertices while preserving their shared symmetry group.', { view: 'platonic', params: { shape: 'octahedron', autoRotate: false } }),
          ],
          reflection: 'Duality changes the description of a regular solid without discarding its symmetry.',
        },
        connections: [{ lessonId: 'into-four-dimensions', label: 'Extend regularity into 4D' }],
      },
      {
        id: 'into-four-dimensions', title: 'Into four dimensions', view: 'polytope', estimatedMinutes: 9, prerequisites: ['why-five-solids'],
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
    id: 'coxeter-geometry', title: 'Coxeter Geometry', description: 'Move from the 600-cell to projections, reflections, and E8 roots.',
    lessons: [
      {
        id: 'six-hundred-cell', title: 'The 600-cell', view: 'sixhundred', estimatedMinutes: 8, prerequisites: ['into-four-dimensions'],
        objectives: ['Identify the 600-cell’s basic counts.', 'Relate its vertices to binary icosahedral unit quaternions.'],
        activity: 'Compare vertex classes while rotating the 4D projection.',
        claimType: 'established-mathematics', claimNote: 'Element counts, duality, and the quaternion model are established; screen depth and motion are projection choices.',
        essayIds: ['sixhundred_overview', 'quaternions_600cell'], quizId: 'sixhundred-basics', sourceIds: ['mathworld-600-cell'],
        experiment: {
          title: 'Separate structure from projection', intro: 'Hold the 600-cell still, then move it and change the highlighted icosahedral context.',
          steps: [
            step('still', 'Read the still projection', 'Open the 600-cell with all edges visible and pause its rotation.', 'Which counts belong to the polytope even when the drawing overlaps?', 'The 120 vertices and 720 edges are intrinsic; overlap is a consequence of projection.', { view: 'sixhundred', params: { shape: 'icosahedron', showEdges: true, autoRotate: false } }),
            step('rotate', 'Change the projection', 'Start a slow rotation and watch crossings appear and disappear.', 'Did the adjacency of any two vertices change?', 'Rotation changes screen positions but preserves the edge graph.', { view: 'sixhundred', params: { shape: 'icosahedron', showEdges: true, autoRotate: true, rotationSpeed: 0.003 } }),
            step('context', 'Change the symmetry context', 'Use dodecahedral highlighting while keeping the same 600-cell.', 'What changed: the polytope or the subset being emphasized?', 'The underlying 600-cell is unchanged; the Studio is changing the explanatory highlight.', { view: 'sixhundred', params: { shape: 'dodecahedron', showEdges: true, autoRotate: false } }),
          ],
          reflection: 'Mathematical structure survives changes of projection, color, motion, and emphasis.',
        },
        connections: [{ lessonId: 'coxeter-plane', label: 'Project E8 with a symmetry-adapted plane' }, { lessonId: 'mckay-bridge', label: 'Return to the binary polyhedral bridge' }],
      },
      {
        id: 'coxeter-plane', title: 'The Coxeter plane', view: 'e8coxeter', estimatedMinutes: 8, prerequisites: ['six-hundred-cell'],
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
        objectives: ['Distinguish roots from simple roots.', 'Interpret a Weyl reflection as a symmetry operation.'],
        activity: 'Select a root, inspect its neighbors, and animate a Weyl path.',
        claimType: 'established-mathematics', claimNote: 'Root counts, inner products, and Weyl reflections come from the canonical E8 data; the interface highlighting is explanatory.',
        essayIds: ['e8_overview', 'simple_roots', 'weyl'], quizId: 'e8-roots', sourceIds: ['aim-e8-technical'],
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
        objectives: ['Relate binary polyhedral groups to affine ADE graphs.', 'Separate the theorem from the Studio’s visual analogy.'],
        activity: 'Compare a McKay highlight with the corresponding affine-diagram reading.',
        claimType: 'interpretation', claimNote: 'The McKay correspondence is established; transitions among solids, the 600-cell, and E8 are a qualified visual analogy, not a literal construction.',
        essayIds: ['e8_mckay', 'affine_e8'], quizId: 'mckay-correspondence', sourceIds: ['mckay-michigan-notes', 'kostant-gosset-circles'],
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
