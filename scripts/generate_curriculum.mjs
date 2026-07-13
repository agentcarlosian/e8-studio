import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { LEARNING_PATHS, LEARNING_LESSONS } from '../src/content/curriculum.js';
import { ESSAYS } from '../src/content/essays.js';
import { QUIZ_MODULES } from '../src/content/learning.js';
import { FACT_SOURCES } from '../src/content/sources.js';

const quizById = new Map(QUIZ_MODULES.map(quiz => [quiz.id, quiz]));
const paths = LEARNING_PATHS.map(path => ({
  id: path.id,
  title: path.title,
  description: path.description,
  lessonIds: path.lessons.map(lesson => lesson.id),
}));
const lessons = LEARNING_LESSONS.map(lesson => ({
  id: lesson.id,
  title: lesson.title,
  view: lesson.view,
  pathId: lesson.pathId,
  lessonIndex: lesson.lessonIndex,
  claimType: lesson.claimType,
  claimNote: lesson.claimNote,
  readings: lesson.essayIds.map(id => ({ id, title: ESSAYS[id]?.title || id })),
  quiz: { id: lesson.quizId, title: quizById.get(lesson.quizId)?.title || lesson.quizId },
  sources: lesson.sourceIds.map(id => ({ id, ...FACT_SOURCES[id] })),
}));
const payload = { schemaVersion: 1, paths, lessons };
const destination = fileURLToPath(new URL('../data/curriculum.json', import.meta.url));
await writeFile(destination, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(`Curriculum artifact written: data/curriculum.json (${lessons.length} lessons)`);
