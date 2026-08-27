import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ESSAYS, ESSAY_PROVENANCE } from '../src/content/essays.js';
import { BIOGRAPHIES, TIMELINE, DAILY_FACTS, QUIZ_MODULES, CURIOUS_CARDS, LEARNING_CONTENT_PROVENANCE } from '../src/content/learning.js';
import { GLOSSARY } from '../src/content/glossary.js';
import { FACT_SOURCES } from '../src/content/sources.js';
import { LEARNING_LESSONS } from '../src/content/curriculum.js';

const claimTypes = new Set(['established-mathematics', 'historical-context', 'interpretation', 'app-designed-visualization', 'rendering-technique']);
const collections = [
  ['essay', Object.entries(ESSAYS).map(([id, value]) => ({ id, ...value }))],
  ['biography', BIOGRAPHIES], ['timeline', TIMELINE], ['daily fact', DAILY_FACTS],
  ['quiz', QUIZ_MODULES], ['curiosity card', Object.entries(CURIOUS_CARDS).map(([id, value]) => ({ id, ...value }))],
  ['glossary entry', GLOSSARY],
];

for (const [kind, records] of collections) {
  assert.ok(records.length, `${kind} collection`);
  for (const record of records) {
    assert.ok(record.id, `${kind} id`);
    assert.ok(claimTypes.has(record.claimType), `${kind} ${record.id} claim type`);
    assert.ok(record.scopeNote?.length >= 35, `${kind} ${record.id} scope note`);
    assert.ok(record.sourceIds?.length, `${kind} ${record.id} source coverage`);
    for (const sourceId of record.sourceIds) assert.ok(FACT_SOURCES[sourceId], `${kind} ${record.id} source ${sourceId}`);
  }
}

assert.deepEqual(Object.keys(ESSAY_PROVENANCE).sort(), Object.keys(ESSAYS).sort(), 'essay provenance exact coverage');
assert.deepEqual(Object.keys(LEARNING_CONTENT_PROVENANCE.biographies).sort(), BIOGRAPHIES.map(item => item.id).sort(), 'biography provenance exact coverage');
assert.equal(LEARNING_CONTENT_PROVENANCE.timeline.length, TIMELINE.length, 'timeline provenance exact coverage');
assert.deepEqual(Object.keys(LEARNING_CONTENT_PROVENANCE.daily).sort(), DAILY_FACTS.map(item => item.id).sort(), 'daily provenance exact coverage');
assert.deepEqual(Object.keys(LEARNING_CONTENT_PROVENANCE.quizzes).sort(), QUIZ_MODULES.map(item => item.id).sort(), 'quiz provenance exact coverage');

for (const [sourceId, source] of Object.entries(FACT_SOURCES)) {
  assert.ok(source.title && source.author && source.scope && source.tier, `source ${sourceId} metadata`);
  assert.match(source.url, /^https:\/\//, `source ${sourceId} HTTPS URL`);
  assert.doesNotMatch(source.url, /^https:\/\/doi\.org\//, `source ${sourceId} links directly to freely readable material`);
}
assert.equal(FACT_SOURCES['hart-sphere-tracing'].url, 'https://graphics.stanford.edu/courses/cs348b-20-spring-content/uploads/hart.pdf', 'Hart source uses the open Stanford-hosted paper');
assert.equal(FACT_SOURCES['gross-heterotic-string'].url, 'https://harvest.aps.org/v2/journals/articles/10.1103/PhysRevLett.54.502/fulltext', 'heterotic-string source uses APS open full text');

const shippedCopy = JSON.stringify({ ESSAYS, BIOGRAPHIES, TIMELINE, DAILY_FACTS, QUIZ_MODULES, GLOSSARY });
for (const stale of [
  'irregular, not regular, 30-gon',
  'which is built from E₈',
  'non-associativity is exactly what makes',
  'one of the few gauge groups quantum mechanics permits',
  'The 3-sphere has genus 0, so the planar bound',
  'q = (cos θ, sin θ',
  'size makes the theory anomaly-free',
  '4D counterparts are the Lorentzian reflection groups',
  'exactly this 120 + 128 split',
]) assert.ok(!shippedCopy.includes(stale), `removed disputed claim: ${stale}`);

assert.ok(CURIOUS_CARDS.dynkin, 'Dynkin has contextual curiosity content');
assert.ok(CURIOUS_CARDS.tiling, 'Tiling Lab has contextual curiosity content');
assert.ok(QUIZ_MODULES.some(quiz => quiz.id === 'dynkin-diagrams'), 'Dynkin has a dedicated quiz');
assert.ok(QUIZ_MODULES.some(quiz => quiz.id === 'coxeter-multigrids'), 'Tiling Lab has a dedicated quiz');

const lessonReadings = new Set(LEARNING_LESSONS.flatMap(lesson => lesson.essayIds || []));
for (const essayId of ['platonic_phi', 'kepler_poinsot', 'sixhundred_conjugacy', 'octonions', 'why_248', 'moonshine', 'bourbaki_e8', 'e8_string_theory']) {
  assert.ok(lessonReadings.has(essayId), `former tour reading ${essayId} is preserved in the self-paced curriculum`);
}

const readProjectFile = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const readme = readProjectFile('README.md');
const indexHtml = readProjectFile('index.html');
const mainJs = readProjectFile('src/main.js');
const panelJs = readProjectFile('src/ui/panel.js');
const mobileHtml = readProjectFile('mobile.html');
const changelog = readProjectFile('CHANGELOG.md');

assert.match(readme, /### Nine interactive views/, 'README view count');
assert.match(readme, /\| \*\*Root Lab\*\* \|/, 'README Root Lab coverage');
assert.match(readme, /\| \*\*Tiling Lab\*\* \|/, 'README Tiling Lab coverage');
assert.match(readme, /\| \*\*Dynkin\*\* \|/, 'README Dynkin view coverage');
assert.match(readme, /use `1–9` for views/, 'README view shortcut range');
assert.match(indexHtml, /nine interactive views/, 'social metadata view count');
assert.match(mainJs, /\{ k: '1–9', d: 'Switch view' \}/, 'in-app view shortcut range');
assert.doesNotMatch(mainJs, /toggleTour|openE8Explorer/, 'timed tour and redundant E8 action are removed');
assert.match(panelJs, /Open Learning Center/, 'Learn panel names the Learning Center explicitly');
assert.doesNotMatch(panelJs, /Guided tour|openE8Explorer/, 'Learn panel has one educational path');
assert.doesNotMatch(mobileHtml, /mobile-tour-details|Guided tour/, 'mobile Learn has one self-paced educational path');
assert.match(changelog, /## 0\.2\.0 — Studio overhaul/, 'current release notes');

console.log(`Content integrity passed: ${collections.reduce((sum, [, records]) => sum + records.length, 0)} records, ${Object.keys(FACT_SOURCES).length} sources.`);
