// Renderer-independent curriculum graph. Desktop and mobile shells consume the
// same ordered paths while retaining separate presentation and navigation UI.
export const LEARNING_PATHS = [
  {
    id: 'solid-foundations',
    title: 'Solid Foundations',
    description: 'Build intuition from regular solids, duality, and four-dimensional analogues.',
    lessons: [
      { id: 'why-five-solids', title: 'Why only five?', view: 'platonic', claimType: 'established-mathematics', claimNote: 'The five-solid classification and dual pairs are standard results for convex regular polyhedra.', essayIds: ['platonic_why_five', 'platonic_duals'], quizId: 'platonic-foundations', sourceIds: ['mathworld-platonic-solids'] },
      { id: 'into-four-dimensions', title: 'Into four dimensions', view: 'polytope', claimType: 'established-mathematics', claimNote: 'Polytope counts and Schläfli notation are mathematical facts; the animated projection is an explanatory display choice.', essayIds: ['rotation_planes_4d', 'schlafli_symbols', 'the_120cell'], quizId: '4d-polytopes', sourceIds: ['mathworld-600-cell'] },
    ],
  },
  {
    id: 'coxeter-geometry',
    title: 'Coxeter Geometry',
    description: 'Move from the 600-cell to projections, reflections, and E8 roots.',
    lessons: [
      { id: 'six-hundred-cell', title: 'The 600-cell', view: 'sixhundred', claimType: 'established-mathematics', claimNote: 'Element counts, duality, and the quaternion model are established; screen depth and motion are projection choices.', essayIds: ['sixhundred_overview', 'quaternions_600cell'], quizId: 'sixhundred-basics', sourceIds: ['mathworld-600-cell'] },
      { id: 'coxeter-plane', title: 'The Coxeter plane', view: 'e8coxeter', claimType: 'established-mathematics', claimNote: 'The Coxeter projection and root orbits are canonical up to orientation and scale; glow and color are display choices.', essayIds: ['coxeter', 'petrie_polygon'], quizId: 'coxeter-plane', sourceIds: ['mit-e8-plane', 'stembridge-coxeter-planes'] },
      { id: 'roots-reflections', title: 'Roots and reflections', view: 'e8coxeter', claimType: 'established-mathematics', claimNote: 'Root counts, inner products, and Weyl reflections come from the canonical E8 data; the interface highlighting is explanatory.', essayIds: ['e8_overview', 'simple_roots', 'weyl'], quizId: 'e8-roots', sourceIds: ['aim-e8-technical'] },
    ],
  },
  {
    id: 'exceptional-bridges',
    title: 'Exceptional Bridges',
    description: 'Explore the qualified relationships connecting E8 to McKay and H4 imagery.',
    lessons: [
      { id: 'mckay-bridge', title: 'McKay correspondence', view: 'e8coxeter', claimType: 'interpretation', claimNote: 'The McKay correspondence is established; transitions among solids, the 600-cell, and E8 are a qualified visual analogy, not a literal construction.', essayIds: ['e8_mckay', 'affine_e8'], quizId: 'mckay-correspondence', sourceIds: ['mckay-michigan-notes', 'kostant-gosset-circles'] },
      { id: 'designed-bloom', title: 'The designed Bloom morph', view: 'bloom', claimType: 'app-designed-visualization', claimNote: 'Bloom is an artistic interpolation created for this app. It is not a canonical deformation or mathematical map into E8.', essayIds: ['bloom_morph', 'mandelbox_intro'], quizId: 'bloom-morph', sourceIds: ['mit-e8-plane', 'hart-sphere-tracing'] },
    ],
  },
  {
    id: 'rendering-mathematics',
    title: 'Rendering Mathematics',
    description: 'Separate mathematical data from the visual techniques used to reveal it.',
    lessons: [
      { id: 'distance-fields', title: 'Signed-distance rendering', view: 'raymarched', claimType: 'rendering-technique', claimNote: 'Sphere tracing and distance fields are established rendering techniques; this scene’s shapes and composition are app-designed.', essayIds: ['sdf_raymarching', 'sdf_smooth_union'], quizId: 'e8-sdf', sourceIds: ['hart-sphere-tracing'] },
    ],
  },
];

export const LEARNING_LESSONS = LEARNING_PATHS.flatMap((path, pathIndex) =>
  path.lessons.map((lesson, lessonIndex) => Object.freeze({
    ...lesson,
    pathId: path.id,
    pathIndex,
    lessonIndex,
  })),
);

export function learningPathById(id) {
  return LEARNING_PATHS.find(path => path.id === id) || null;
}

export function learningLessonById(id) {
  return LEARNING_LESSONS.find(lesson => lesson.id === id) || null;
}

export function adjacentLearningLesson(id, direction = 1) {
  const index = LEARNING_LESSONS.findIndex(lesson => lesson.id === id);
  if (index < 0) return LEARNING_LESSONS[0] || null;
  return LEARNING_LESSONS[(index + (direction < 0 ? -1 : 1) + LEARNING_LESSONS.length) % LEARNING_LESSONS.length];
}
