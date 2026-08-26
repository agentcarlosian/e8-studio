import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ESSAYS } from '../src/content/essays.js';
import { QUIZ_MODULES } from '../src/content/learning.js';
import { FACT_SOURCES } from '../src/content/sources.js';
import { LEARNING_PATHS, LEARNING_LESSONS, adjacentLearningLesson, learningLessonById, learningLessonForView } from '../src/content/curriculum.js';

const pathIds = LEARNING_PATHS.map(path => path.id);
const lessonIds = LEARNING_LESSONS.map(lesson => lesson.id);
assert.equal(new Set(pathIds).size, pathIds.length);
assert.equal(new Set(lessonIds).size, lessonIds.length);
assert.ok(LEARNING_PATHS.every(path => path.title && path.description && path.lessons.length));

const quizIds = new Set(QUIZ_MODULES.map(quiz => quiz.id));
const claimTypes = new Set(['established-mathematics', 'interpretation', 'app-designed-visualization', 'rendering-technique']);
for (const lesson of LEARNING_LESSONS) {
  assert.ok(['bloom', 'platonic', 'e8coxeter', 'sixhundred', 'polytope', 'raymarched', 'dynkin'].includes(lesson.view), `${lesson.id} view`);
  assert.ok(Number.isInteger(lesson.estimatedMinutes) && lesson.estimatedMinutes > 0, `${lesson.id} estimated time`);
  assert.ok(Array.isArray(lesson.objectives) && lesson.objectives.length >= 2, `${lesson.id} objectives`);
  assert.ok(Array.isArray(lesson.prerequisites), `${lesson.id} prerequisites`);
  assert.ok(lesson.activity?.length >= 30, `${lesson.id} activity`);
  assert.ok(lesson.essayIds.length, `${lesson.id} essays`);
  for (const essayId of lesson.essayIds) assert.ok(ESSAYS[essayId], `${lesson.id} essay ${essayId}`);
  assert.ok(quizIds.has(lesson.quizId), `${lesson.id} quiz ${lesson.quizId}`);
  assert.ok(claimTypes.has(lesson.claimType), `${lesson.id} claim type`);
  assert.ok(lesson.claimNote?.length >= 40, `${lesson.id} claim note`);
  assert.ok(lesson.sourceIds.length, `${lesson.id} source coverage`);
  for (const sourceId of lesson.sourceIds) assert.ok(FACT_SOURCES[sourceId], `${lesson.id} source ${sourceId}`);
  assert.ok(lesson.experiment?.title && lesson.experiment?.intro && lesson.experiment?.reflection, `${lesson.id} guided experiment`);
  assert.equal(lesson.experiment.steps?.length, 3, `${lesson.id} three-stage experiment`);
  assert.equal(new Set(lesson.experiment.steps.map(step => step.id)).size, 3, `${lesson.id} unique experiment steps`);
  for (const step of lesson.experiment.steps) {
    assert.ok(step.title && step.instruction?.length >= 25, `${lesson.id}/${step.id} instruction`);
    assert.ok(step.question?.endsWith('?'), `${lesson.id}/${step.id} observation question`);
    assert.ok(step.takeaway?.length >= 35, `${lesson.id}/${step.id} takeaway`);
    assert.ok(step.action?.view && step.action?.params && typeof step.action.params === 'object', `${lesson.id}/${step.id} Studio action`);
  }
  assert.ok(Array.isArray(lesson.connections) && lesson.connections.length, `${lesson.id} concept connections`);
  for (const connection of lesson.connections) assert.ok(lessonIds.includes(connection.lessonId) && connection.label, `${lesson.id} connection ${connection.lessonId}`);
}
assert.equal(learningLessonById(lessonIds[0])?.id, lessonIds[0]);
assert.equal(adjacentLearningLesson(lessonIds.at(-1), 1), null);
assert.equal(adjacentLearningLesson(lessonIds[0], -1), null);
assert.equal(learningLessonForView('dynkin')?.id, 'reading-dynkin');
assert.equal(learningLessonForView('e8coxeter', new Set(['coxeter-plane']))?.id, 'roots-reflections');

const answerPositions = new Set(QUIZ_MODULES.flatMap(quiz => quiz.questions.map(question => question.answer)));
assert.deepEqual(answerPositions, new Set([0, 1, 2]), 'quiz correct answers are position-balanced');
assert.ok(QUIZ_MODULES.every(quiz => quiz.questions.some(question => question.answer !== 0)), 'no quiz teaches first-answer bias');

const artifact = JSON.parse(await readFile(new URL('../data/curriculum.json', import.meta.url), 'utf8'));
assert.equal(artifact.schemaVersion, 3, 'curriculum artifact schema');
assert.deepEqual(artifact.paths.map(path => path.id), pathIds, 'artifact path order');
assert.deepEqual(
  artifact.paths.flatMap(path => path.lessonIds),
  lessonIds,
  'artifact lesson order',
);
assert.deepEqual(artifact.lessons.map(lesson => lesson.id), lessonIds, 'artifact lesson records');
assert.ok(artifact.lessons.every(lesson => claimTypes.has(lesson.claimType) && lesson.claimNote?.length >= 40), 'artifact claim metadata');
assert.ok(artifact.lessons.every(lesson => lesson.sources?.length), 'artifact source coverage');
assert.ok(artifact.lessons.every(lesson => lesson.objectives?.length >= 2 && lesson.activity && lesson.estimatedMinutes > 0), 'artifact learning design fields');
assert.ok(artifact.lessons.every(lesson => lesson.experiment?.steps?.length === 3 && lesson.connections?.length), 'artifact guided experiments and connections');
console.log(`Curriculum tests passed: ${LEARNING_PATHS.length} paths, ${LEARNING_LESSONS.length} lessons.`);
