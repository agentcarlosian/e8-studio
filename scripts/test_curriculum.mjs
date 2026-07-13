import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ESSAYS } from '../src/content/essays.js';
import { QUIZ_MODULES } from '../src/content/learning.js';
import { FACT_SOURCES } from '../src/content/sources.js';
import { LEARNING_PATHS, LEARNING_LESSONS, adjacentLearningLesson, learningLessonById } from '../src/content/curriculum.js';

const pathIds = LEARNING_PATHS.map(path => path.id);
const lessonIds = LEARNING_LESSONS.map(lesson => lesson.id);
assert.equal(new Set(pathIds).size, pathIds.length);
assert.equal(new Set(lessonIds).size, lessonIds.length);
assert.ok(LEARNING_PATHS.every(path => path.title && path.description && path.lessons.length));

const quizIds = new Set(QUIZ_MODULES.map(quiz => quiz.id));
const claimTypes = new Set(['established-mathematics', 'interpretation', 'app-designed-visualization', 'rendering-technique']);
for (const lesson of LEARNING_LESSONS) {
  assert.ok(['bloom', 'platonic', 'e8coxeter', 'sixhundred', 'polytope', 'raymarched'].includes(lesson.view), `${lesson.id} view`);
  assert.ok(lesson.essayIds.length, `${lesson.id} essays`);
  for (const essayId of lesson.essayIds) assert.ok(ESSAYS[essayId], `${lesson.id} essay ${essayId}`);
  assert.ok(quizIds.has(lesson.quizId), `${lesson.id} quiz ${lesson.quizId}`);
  assert.ok(claimTypes.has(lesson.claimType), `${lesson.id} claim type`);
  assert.ok(lesson.claimNote?.length >= 40, `${lesson.id} claim note`);
  assert.ok(lesson.sourceIds.length, `${lesson.id} source coverage`);
  for (const sourceId of lesson.sourceIds) assert.ok(FACT_SOURCES[sourceId], `${lesson.id} source ${sourceId}`);
}
assert.equal(learningLessonById(lessonIds[0])?.id, lessonIds[0]);
assert.equal(adjacentLearningLesson(lessonIds.at(-1), 1)?.id, lessonIds[0]);
assert.equal(adjacentLearningLesson(lessonIds[0], -1)?.id, lessonIds.at(-1));

const artifact = JSON.parse(await readFile(new URL('../data/curriculum.json', import.meta.url), 'utf8'));
assert.equal(artifact.schemaVersion, 1, 'curriculum artifact schema');
assert.deepEqual(artifact.paths.map(path => path.id), pathIds, 'artifact path order');
assert.deepEqual(
  artifact.paths.flatMap(path => path.lessonIds),
  lessonIds,
  'artifact lesson order',
);
assert.deepEqual(artifact.lessons.map(lesson => lesson.id), lessonIds, 'artifact lesson records');
assert.ok(artifact.lessons.every(lesson => claimTypes.has(lesson.claimType) && lesson.claimNote?.length >= 40), 'artifact claim metadata');
assert.ok(artifact.lessons.every(lesson => lesson.sources?.length), 'artifact source coverage');
console.log(`Curriculum tests passed: ${LEARNING_PATHS.length} paths, ${LEARNING_LESSONS.length} lessons.`);
