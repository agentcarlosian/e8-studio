import { LEARNING_PATHS, learningLessonById, adjacentLearningLesson } from '../content/curriculum.js';
import { ESSAYS } from '../content/essays.js';
import { FACT_SOURCES } from '../content/sources.js';

function svgEsc(value) {
  return String(value).replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch]);
}

export function regularCorner(faceSides, facesAtVertex) {
  const p = Number(faceSides), q = Number(facesAtVertex);
  if (!Number.isInteger(p) || !Number.isInteger(q) || p < 3 || p > 8 || q < 3 || q > 6) return null;
  const angle = 180 * (p - 2) / p;
  const total = angle * q;
  const solid = ({ '3,3': 'Tetrahedron', '3,4': 'Octahedron', '3,5': 'Icosahedron', '4,3': 'Cube', '5,3': 'Dodecahedron' })[`${p},${q}`];
  return { angle, total, deficit: 360 - total, label: solid || (Math.abs(total - 360) < 0.00001 ? 'Flat arrangement' : 'Too much angle for a convex corner') };
}

function cornerExplorerHtml() {
  return `<section class="learning-corner" aria-labelledby="corner-title"><span class="modal-kicker">Try a small calculation</span><h3 id="corner-title">Will this corner close?</h3><p>Choose a regular face and how many meet. A convex corner needs a total below 360°.</p><div class="learning-corner-controls"><label>Face shape<select data-corner-sides><option value="3">Triangle · 3 sides</option><option value="4" selected>Square · 4 sides</option><option value="5">Pentagon · 5 sides</option><option value="6">Hexagon · 6 sides</option><option value="7">Heptagon · 7 sides</option><option value="8">Octagon · 8 sides</option></select></label><label>Faces at a vertex<select data-corner-count>${[3, 4, 5, 6].map(n => `<option value="${n}">${n} faces</option>`).join('')}</select></label></div><div class="learning-corner-result"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="47" class="corner-track"/><circle cx="60" cy="60" r="47" class="corner-used" pathLength="360" transform="rotate(-90 60 60)"/><text x="60" y="58" text-anchor="middle" data-corner-degrees></text><text x="60" y="77" text-anchor="middle" class="corner-caption">of 360°</text></svg><div role="status" aria-live="polite" data-corner-result></div></div><small>The ring measures the angle budget; it is not a drawing of the folded solid. The five valid choices are listed below.</small></section>`;
}

export function renderLearningHome(learningProgress, activeView = 'e8coxeter') {
  const summary = learningProgress.summary();
  const currentLesson = learningProgress.recommendedLesson(activeView) || learningLessonById('meet-e8');
  const pathCards = LEARNING_PATHS.map((path, index) => {
    const complete = path.lessons.filter(lesson => learningProgress.lessonComplete(lesson.id)).length;
    const next = path.lessons.find(lesson => !learningProgress.lessonComplete(lesson.id)) || path.lessons[0];
    return `<button class="learning-home-path" data-learning-lesson="${svgEsc(next.id)}">
      <span class="learning-home-path-number">0${index + 1}</span>
      <span class="learning-home-path-copy"><strong>${svgEsc(path.title)}</strong><small>${svgEsc(path.description)}</small><em>${complete}/${path.lessons.length} lessons complete · ${svgEsc(next.title)} →</em></span>
    </button>`;
  }).join('');
  return `
    <button class="modal-close" data-modal-close aria-label="Close Learning Center">×</button>
    <div class="learning-home">
      <header class="learning-home-hero">
        <div class="learning-home-kicker">E8 STUDIO · LEARNING CENTER</div>
        <h2 id="learning-home-title">Start with a question.<br>Test it in the Studio.</h2>
        <p>Build intuition with one idea at a time: read a short explanation, try a guided scene, then check what you noticed. Your progress stays on this device.</p>
        <div class="learning-home-actions">
          <button class="learning-home-primary" data-learning-lesson="why-five-solids">Begin with regular solids <span aria-hidden="true">↗</span></button>
          <button data-learning-lesson="${svgEsc(currentLesson.id)}">Open this view's lesson <span aria-hidden="true">→</span></button>
        </div>
        <div class="learning-home-progress" role="status">${summary.lessonsComplete} of ${summary.lessonsTotal} lessons complete</div>
      </header>
      <section class="learning-home-questions" aria-labelledby="learning-home-questions-title">
        <div class="learning-home-section-heading"><span>CHOOSE A QUESTION</span><h3 id="learning-home-questions-title">What are you curious about?</h3></div>
        <div class="learning-home-question-grid">
          <button data-learning-lesson="why-five-solids"><span>01 · SHAPES</span><strong>Why are there exactly five regular solids?</strong><small>Start with one corner and an angle you can count.</small></button>
          <button data-learning-lesson="meet-e8"><span>02 · E8</span><strong>What are the 240 dots?</strong><small>See what a two-dimensional projection shows and hides.</small></button>
          <button data-learning-lesson="e8-cut-project"><span>03 · PATTERNS</span><strong>How can 8D make a 2D pattern?</strong><small>Use visible and hidden coordinates to select points.</small></button>
        </div>
      </section>
      <section class="learning-home-paths" aria-labelledby="learning-home-paths-title">
        <div class="learning-home-section-heading"><span>FOUR ROUTES</span><h3 id="learning-home-paths-title">Follow a path</h3></div>
        <div class="learning-home-path-grid">${pathCards}</div>
      </section>
    </div>`;
}

// Presentation receives progress; the shell owns persistence and scene changes.
export function renderLearningCenter(lesson, learningProgress) {
  const path = LEARNING_PATHS.find(item => item.id === lesson.pathId);
  const quizState = learningProgress.progress.quiz?.[lesson.quizId] || null;
  const lessonComplete = learningProgress.lessonComplete(lesson.id);
  const experimentState = learningProgress.experimentState(lesson.id);
  const learningSummary = learningProgress.summary();
  const overallProgress = learningSummary.lessonsTotal
    ? Math.round((learningSummary.lessonsComplete / learningSummary.lessonsTotal) * 100)
    : 0;
  const pathLessonIndex = Math.max(0, path?.lessons.findIndex(entry => entry.id === lesson.id) ?? 0);
  const lessonViewLabel = ({
    bloom: 'Bloom',
    platonic: 'Platonic solids',
    e8coxeter: 'E₈ Coxeter',
    sixhundred: '600-cell',
    polytope: '4D polytopes',
    raymarched: 'E₈ SDF',
    rootlab: 'Root Lab',
    tiling: 'Tiling Lab',
    quasicrystal: 'Quasicrystal Lab',
    dynkin: 'Dynkin diagrams',
  })[lesson.view] || lesson.view;
  const claimLabels = {
    'established-mathematics': 'Established mathematics',
    interpretation: 'Interpretation',
    'app-designed-visualization': 'App-designed visualization',
    'rendering-technique': 'Rendering technique',
  };
  const pathNavigation = LEARNING_PATHS.map(item => {
    const pathComplete = item.lessons.filter(entry => learningProgress.lessonComplete(entry.id)).length;
    return `
    <section class="learning-path ${item.id === lesson.pathId ? 'active' : ''}" data-learning-path>
      <div class="learning-path-title"><span>${svgEsc(item.title)}</span><small>${pathComplete}/${item.lessons.length}</small></div>
      ${item.lessons.map((entry, entryIndex) => `
        <button class="learning-lesson-link ${entry.id === lesson.id ? 'active' : ''}"
          data-learning-lesson="${svgEsc(entry.id)}" data-learning-search="${svgEsc([item.title, entry.title, entry.shortAnswer, entry.guide?.level, ...(entry.guide?.terms || []).map(term => term[0])].join(' ').toLocaleLowerCase())}" aria-current="${entry.id === lesson.id ? 'step' : 'false'}">
          <span class="learning-lesson-copy"><span class="learning-lesson-index">${String(entryIndex + 1).padStart(2, '0')}</span><span>${svgEsc(entry.title)}</span></span>
          <small>${learningProgress.lessonComplete(entry.id) ? '✓ Done' : `${entry.estimatedMinutes} min`}</small>
        </button>
      `).join('')}
    </section>
  `; }).join('');
  const essayCards = lesson.essayIds.map(id => {
    const essay = ESSAYS[id];
    return `<button class="learning-resource-card" data-learning-essay="${svgEsc(id)}">
      <span>${svgEsc(essay?.title || id)}</span><small>Open reading</small>
    </button>`;
  }).join('');
  const sourceCards = lesson.sourceIds.map(id => {
    const source = FACT_SOURCES[id];
    return `<a class="learning-source-card" href="${svgEsc(source.url)}" target="_blank" rel="noreferrer">
      <span>${svgEsc(source.title)}</span>
      <small>${svgEsc(source.author)}</small>
      <em>${svgEsc(source.scope)}</em>
    </a>`;
  }).join('');
  const previous = adjacentLearningLesson(lesson.id, -1);
  const next = adjacentLearningLesson(lesson.id, 1);
  const prerequisiteCards = lesson.prerequisites.length
    ? lesson.prerequisites.map(id => {
      const prerequisite = learningLessonById(id);
      const complete = learningProgress.lessonComplete(id);
      return `<button class="learning-prerequisite ${complete ? 'complete' : ''}" data-learning-lesson="${svgEsc(id)}"><span>${complete ? '✓' : '○'} ${svgEsc(prerequisite?.title || id)}</span><small>${complete ? 'complete' : 'recommended first'}</small></button>`;
    }).join('')
    : '<div class="learning-prerequisite complete"><span>Start here</span><small>no prerequisites</small></div>';
  const experimentSteps = (lesson.experiment?.steps || []).map((entry, index) => {
    const observed = experimentState.completedSteps.has(entry.id);
    return `<article class="learning-experiment-step ${observed ? 'complete' : ''}">
      <div class="learning-experiment-step-head"><span>${index + 1}</span><strong>${svgEsc(entry.title)}</strong><small>${observed ? 'observed' : 'ready'}</small></div>
      <p>${svgEsc(entry.instruction)}</p>
      <div class="learning-experiment-question"><span>Notice</span>${svgEsc(entry.question)}</div>
      <details class="learning-reveal" ${observed ? 'open' : ''}><summary>Reveal explanation</summary><div class="learning-experiment-takeaway">${svgEsc(entry.takeaway)}</div></details>
      <div class="learning-experiment-step-actions">
        <button data-learning-run-step="${svgEsc(entry.id)}">Run in Studio</button>
        <button data-learning-observe-step="${svgEsc(entry.id)}" aria-pressed="${observed}">${observed ? '✓ Observed' : 'Mark observed'}</button>
      </div>
    </article>`;
  }).join('');
  const connectionCards = (lesson.connections || []).map(connection => {
    const target = learningLessonById(connection.lessonId);
    return `<button class="learning-connection-card" data-learning-lesson="${svgEsc(connection.lessonId)}"><span>${svgEsc(connection.label)}</span><small>${svgEsc(target?.title || connection.lessonId)} →</small></button>`;
  }).join('');
  const proofHtml = lesson.proof ? `
    <section class="learning-proof" aria-labelledby="learning-proof-title">
      <header class="learning-proof-header"><span id="learning-proof-title">Why this works</span><code>${svgEsc(lesson.proof.formula)}</code></header>
      <p>${svgEsc(lesson.proof.explanation)}</p>
      <div class="learning-proof-table" role="table" aria-label="Valid regular solid cases">
        <div role="row" class="learning-proof-row learning-proof-head"><span role="columnheader">Face</span><span role="columnheader">At each vertex</span><span role="columnheader">Solid</span></div>
        ${(lesson.proof.cases || []).map(([face, count, solid]) => `<div role="row" class="learning-proof-row"><span role="cell">${svgEsc(face)}</span><span role="cell">${svgEsc(count)}</span><span role="cell">${svgEsc(solid)}</span></div>`).join('')}
      </div>
      <p class="learning-proof-boundary">${svgEsc(lesson.proof.boundary)}</p>
    </section>` : '';
  const guide = lesson.guide;
  const evidence = lesson.visualEvidence;
  const evidenceHtml = evidence?.rows?.length ? `<section class="learning-evidence"><h3>Read the evidence</h3><div class="learning-table-wrap"><table><caption>${svgEsc(lesson.title)} — visual reference</caption><thead><tr>${evidence.columns.map(column => `<th scope="col">${svgEsc(column)}</th>`).join('')}</tr></thead><tbody>${evidence.rows.map(row => `<tr>${row.map((cell, i) => i === 0 ? `<th scope="row">${svgEsc(cell)}</th>` : `<td>${svgEsc(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>` : '';
  const nextStep = experimentState.nextStep;
  return `
    <button class="modal-close" data-modal-close aria-label="Close Learning Center">×</button>
    <div class="learning-center-shell" data-learning-current="${svgEsc(lesson.id)}">
      <details class="learning-library" open>
        <summary class="learning-library-toggle">Browse lessons <span>${learningSummary.lessonsTotal} lessons · ${LEARNING_PATHS.length} paths</span></summary>
      <aside class="learning-center-nav" aria-label="Learning paths">
        <div class="learning-nav-header">
          <div class="modal-kicker">Learning Center</div>
          <div class="learning-progress-summary"><strong>${learningSummary.lessonsComplete}</strong><span>of ${learningSummary.lessonsTotal} lessons</span><em>${overallProgress}%</em></div>
          <div class="learning-overall-progress" role="progressbar" aria-label="Curriculum progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${overallProgress}"><span style="width:${overallProgress}%"></span></div>
          <p class="learning-library-intro">Follow a path or explore any lesson. Your progress stays on this device.</p>
          <label class="learning-search-label" for="learning-search">Find a lesson</label>
          <input id="learning-search" type="search" placeholder="Try rings, 4D, or reflection" autocomplete="off" aria-controls="learning-path-list">
          <div class="learning-search-status" role="status" aria-live="polite"></div>
        </div>
        <div id="learning-path-list">${pathNavigation}</div>
        <div class="learning-search-empty" hidden><strong>No lessons found</strong><p>Try a concept such as roots, projection, or symmetry.</p><button type="button" data-learning-clear>Show all lessons</button></div>
      </aside>
      </details>
      <article class="learning-center-content" aria-label="Lesson reader" tabindex="0">
        <header class="learning-lesson-hero" id="learning-read" tabindex="-1">
          <button class="learning-home-back" data-learning-home>← All learning paths</button>
          <div class="learning-lesson-eyebrow">
            <div class="modal-kicker">${svgEsc(path?.title || 'Learning path')}</div>
            <span>Lesson ${pathLessonIndex + 1} of ${path?.lessons.length || 1}</span>
          </div>
          <h2 id="learning-lesson-title">${svgEsc(lesson.title)}</h2>
          ${guide?.whyItMatters ? `<p class="learning-lesson-purpose">${svgEsc(guide.whyItMatters)}</p>` : ''}
          <div class="learning-lesson-status" aria-label="Lesson details">
            <span>${svgEsc(guide?.level || 'Explore')}</span>
            <span>${svgEsc(lessonViewLabel)}</span>
            <span>${lesson.estimatedMinutes || 5} min</span>
            <span>${quizState?.passedAt ? `Quiz ${quizState.bestScore}/${quizState.total}` : 'Quiz included'}</span>
            <span class="${lessonComplete ? 'is-complete' : ''}">${lessonComplete ? '✓ Completed' : 'Ready to begin'}</span>
          </div>
          <div class="learning-hero-action"><button class="learning-action-primary" data-learning-run-step="${svgEsc(nextStep?.id || '')}">${experimentState.completedCount ? 'Continue experiment' : 'Start guided experiment'} <span aria-hidden="true">↗</span></button><small>Read at your pace, then try ${experimentState.total} steps in the Studio.</small></div>
        </header>
        <nav class="learning-section-nav" aria-label="In this lesson"><button data-learning-jump="learning-read"><span>01</span> Understand</button><button data-learning-jump="learning-experiment-title"><span>02</span> Try it</button><button data-learning-jump="learning-check-title"><span>03</span> Check</button><button data-learning-jump="learning-more-title"><span>04</span> Sources</button></nav>
        <section class="learning-answer" aria-labelledby="learning-answer-title">
          <span id="learning-answer-title">The short answer</span>
          <p>${svgEsc(lesson.shortAnswer || lesson.claimNote)}</p>
          <ul>${(lesson.keyIdeas || lesson.objectives || []).map(idea => `<li>${svgEsc(idea)}</li>`).join('')}</ul>
        </section>
        ${guide ? `<section class="learning-worked-example"><span class="modal-kicker">MAKE IT CONCRETE</span><h3>${svgEsc(guide.example.title)}</h3><p>${svgEsc(guide.example.body)}</p></section><section class="learning-concepts"><h3>Words for what you just saw</h3><dl>${guide.terms.map(([term, definition]) => `<div><dt>${svgEsc(term)}</dt><dd>${svgEsc(definition)}</dd></div>`).join('')}</dl></section>` : ''}
        ${lesson.id === 'why-five-solids' ? cornerExplorerHtml() : ''}
        ${evidenceHtml}
        ${proofHtml}
        ${guide ? `<aside class="learning-distinction"><strong>Keep this distinction</strong><p>${svgEsc(guide.misconception)}</p></aside>` : ''}
        <div class="learning-activity">
          <strong>See it for yourself</strong>
          <span>${svgEsc(lesson.activity || 'Open the visualization and compare what changes with what stays mathematically fixed.')}</span>
        </div>
        <div class="modal-actions learning-primary-actions"><button data-learning-open-view="${svgEsc(lesson.view)}">Explore this view freely →</button></div>
        <section class="learning-experiment" aria-labelledby="learning-experiment-title">
          <header class="learning-experiment-header">
            <div><span>Guided Studio experiment</span><h3 id="learning-experiment-title" tabindex="-1">${svgEsc(lesson.experiment?.title || 'Try it yourself')}</h3></div>
            <strong>${experimentState.completedCount}/${experimentState.total} <small>explored</small></strong>
          </header>
          <div class="learning-experiment-body">
            <p>${svgEsc(lesson.experiment?.intro || lesson.activity)}</p>
            <div class="learning-experiment-progress" role="progressbar" aria-label="Experiment progress" aria-valuemin="0" aria-valuemax="${experimentState.total}" aria-valuenow="${experimentState.completedCount}"><span style="width:${experimentState.total ? (experimentState.completedCount / experimentState.total) * 100 : 0}%"></span></div>
            <div class="learning-experiment-steps">${experimentSteps}</div>
            <div class="learning-experiment-reflection"><span>Reflect</span>${svgEsc(lesson.experiment?.reflection || '')}</div>
          </div>
        </section>
        ${guide ? `<section class="learning-recall"><h3 id="learning-check-title" tabindex="-1">Check your understanding</h3><p>${svgEsc(guide.check.question)}</p><details class="learning-reveal"><summary>Reveal answer</summary><p>${svgEsc(guide.check.answer)}</p></details></section>` : ''}
        <section class="learning-check">
          <div><span>Put the ideas together</span><strong>A short quiz, with explanations</strong></div>
          <div class="modal-actions learning-check-actions">
            <button data-learning-quiz="${svgEsc(lesson.quizId)}">${quizState?.passedAt ? 'Review quiz' : 'Take quiz'}</button>
          </div>
        </section>
        <nav class="learning-lesson-nav" aria-label="Lesson navigation">
          <button type="button" class="learning-lesson-nav-button" ${previous ? `data-learning-lesson="${svgEsc(previous.id)}"` : 'disabled'} aria-label="${previous ? `Previous lesson: ${svgEsc(previous.title)}` : 'Start of curriculum'}">← Previous</button>
          <button type="button" class="learning-lesson-nav-button learning-lesson-nav-finish ${lessonComplete ? 'is-complete' : ''}" data-learning-complete="${svgEsc(lesson.id)}" aria-pressed="${lessonComplete}">${lessonComplete ? '✓ Complete' : 'Finish lesson'}</button>
          <button type="button" class="learning-lesson-nav-button learning-lesson-nav-next" ${next ? `data-learning-lesson="${svgEsc(next.id)}"` : 'disabled'} aria-label="${next ? `Next lesson: ${svgEsc(next.title)}` : 'Curriculum complete'}">Next →</button>
        </nav>
        <details class="learning-more">
          <summary id="learning-more-title" class="learning-more-header">Sources, readings, and lesson details</summary>
          <div class="learning-more-body">
            <p class="modal-copy">${svgEsc(path?.description || '')}</p>
            <div class="learning-claim-note" data-claim-type="${svgEsc(lesson.claimType)}">
              <strong>${svgEsc(claimLabels[lesson.claimType] || lesson.claimType)}</strong>
              <span>${svgEsc(lesson.claimNote)}</span>
            </div>
            <h3>Recommended foundation</h3>
            <div class="learning-prerequisite-grid">${prerequisiteCards}</div>
            <h3>Lesson objectives</h3>
            <ul class="learning-objectives">${(lesson.objectives || []).map(objective => `<li>${svgEsc(objective)}</li>`).join('')}</ul>
            <h3>Readings</h3>
            <div class="learning-resource-grid">${essayCards}</div>
            <h3>Sources and scope</h3>
            <div class="learning-source-list">${sourceCards}</div>
            <h3>Connect the ideas</h3>
            <div class="learning-connection-grid">${connectionCards}</div>
          </div>
        </details>
      </article>
    </div>
  `;
}

export function captureLearningCenterUiState(host) {
  const library = host?.querySelector?.('.learning-library');
  if (!library) return null;
  return {
    lessonId: host.querySelector('[data-learning-current]')?.dataset.learningCurrent || null,
    query: host.querySelector('#learning-search')?.value || '',
    libraryOpen: library.open,
    libraryScrollTop: host.querySelector('.learning-center-nav')?.scrollTop || 0,
    sourcesOpen: !!host.querySelector('.learning-more')?.open,
    recallOpen: !!host.querySelector('.learning-recall details')?.open,
  };
}

export function bindLearningCenterNavigation(host, savedState = null) {
  const library = host.querySelector('.learning-library');
  const narrow = window.matchMedia('(max-width: 760px)');
  const adapt = () => { library.open = !narrow.matches; };
  adapt();
  if (savedState) library.open = savedState.libraryOpen;
  narrow.addEventListener('change', adapt);
  const input = host.querySelector('#learning-search');
  if (savedState) input.value = savedState.query;
  const links = [...host.querySelectorAll('[data-learning-search]')];
  const paths = [...host.querySelectorAll('[data-learning-path]')];
  const filter = () => {
    const words = input.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    let count = 0;
    for (const link of links) {
      link.hidden = !words.every(word => link.dataset.learningSearch.includes(word));
      if (!link.hidden) count++;
    }
    for (const path of paths) path.hidden = !path.querySelector('[data-learning-search]:not([hidden])');
    host.querySelector('.learning-search-empty').hidden = count > 0;
    host.querySelector('.learning-search-status').textContent = words.length ? `${count} ${count === 1 ? 'lesson' : 'lessons'} found` : `${links.length} lessons to explore`;
  };
  input.addEventListener('input', filter);
  host.querySelector('[data-learning-clear]').addEventListener('click', () => { input.value = ''; filter(); input.focus(); });
  filter();
  if (savedState) {
    const nav = host.querySelector('.learning-center-nav');
    requestAnimationFrame(() => {
      if (nav?.isConnected) nav.scrollTop = savedState.libraryScrollTop;
    });
    if (savedState.lessonId === host.querySelector('[data-learning-current]')?.dataset.learningCurrent) {
      const sources = host.querySelector('.learning-more');
      const recall = host.querySelector('.learning-recall details');
      if (sources) sources.open = savedState.sourcesOpen;
      if (recall) recall.open = savedState.recallOpen;
    }
  }
  const cornerSides = host.querySelector('[data-corner-sides]');
  const cornerCount = host.querySelector('[data-corner-count]');
  if (cornerSides && cornerCount) {
    const updateCorner = () => {
      const corner = regularCorner(cornerSides.value, cornerCount.value);
      if (!corner) return;
      const fmt = n => Number(n.toFixed(1));
      host.querySelector('.corner-used').setAttribute('stroke-dasharray', `${Math.min(corner.total, 360)} 360`);
      host.querySelector('[data-corner-degrees]').textContent = `${fmt(corner.total)}°`;
      host.querySelector('[data-corner-result]').innerHTML = `<strong>${svgEsc(corner.label)}</strong><p>${cornerCount.value} × ${fmt(corner.angle)}° = ${fmt(corner.total)}°</p><span>${corner.deficit > 0 ? `${fmt(corner.deficit)}° left to fold` : Math.abs(corner.deficit) < 0.00001 ? 'No angular room remains.' : `${fmt(-corner.deficit)}° over the angle budget`}</span>`;
    };
    cornerSides.addEventListener('change', updateCorner);
    cornerCount.addEventListener('change', updateCorner);
    updateCorner();
  }
  host.querySelectorAll('[data-learning-jump]').forEach(button => {
    button.addEventListener('click', () => {
      const target = host.querySelector(`#${button.dataset.learningJump}`);
      if (target?.closest('details.learning-more')) target.closest('details.learning-more').open = true;
      target?.focus({ preventScroll: true });
      target?.scrollIntoView({ block: 'start', behavior: 'instant' });
    });
  });
  return () => narrow.removeEventListener('change', adapt);
}
