// essays.js — Floating essay panel component
//
// Renders a small expandable panel showing contextual essays about the current
// math view. Toggleable via the ⓘ button or 'I' key. Persistent across views
// (each view's "essay stack" is remembered).

import { ESSAYS, ESSAY_CONTEXTS, getEssay } from '../content/essays.js';
import { GLOSSARY } from '../content/glossary.js';
import { FACT_SOURCES } from '../content/sources.js';

const CLAIM_LABELS = {
  'established-mathematics': 'Established mathematics',
  'historical-context': 'Historical context',
  interpretation: 'Interpretation',
  'app-designed-visualization': 'App-designed visualization',
  'rendering-technique': 'Rendering technique',
};

const SELECTION_NOTES = {
  tetrahedron: ['The tetrahedron', 'The simplest Platonic solid has 4 triangular faces, 4 vertices, and 6 edges. It is self-dual.'],
  cube: ['The cube', 'The cube {4,3} has 6 square faces, 8 vertices, and 12 edges. Its dual is the octahedron, and cubes tile ordinary space.'],
  octahedron: ['The octahedron', 'The octahedron {3,4} has 8 triangular faces and 6 vertices. It is the dual of the cube.'],
  dodecahedron: ['The dodecahedron', 'The dodecahedron {5,3} has 12 pentagonal faces and 20 vertices. Its coordinates involve the golden ratio.'],
  icosahedron: ['The icosahedron', 'The icosahedron {3,5} has 20 triangular faces and 12 vertices. It is dual to the dodecahedron.'],
  stellated_dodecahedron: ['Small stellated dodecahedron', 'This regular star polyhedron {5/2,5} uses 12 pentagram faces and has icosahedral symmetry.'],
  great_dodecahedron: ['Great dodecahedron', 'The great dodecahedron {5,5/2} has intersecting pentagonal faces and is dual to the small stellated dodecahedron.'],
  great_icosahedron: ['Great icosahedron', 'The great icosahedron {3,5/2} is built from 20 intersecting triangular faces.'],
  great_stellated_dodecahedron: ['Great stellated dodecahedron', 'This regular star polyhedron {5/2,3} has pentagram faces and is dual to the great icosahedron.'],
  '5cell': ['The 5-cell', 'The 5-cell {3,3,3} is the 4D simplex: 5 vertices, 10 edges, and 5 tetrahedral cells.'],
  tesseract: ['The tesseract', 'The tesseract {4,3,3} is the 4D cube. Its 16 vertices project as two cube-like layers joined through depth.'],
  '16cell': ['The 16-cell', 'The 16-cell {3,3,4} has 8 vertices and 16 tetrahedral cells. It is dual to the tesseract.'],
  '24cell': ['The 24-cell', 'The self-dual 24-cell {3,4,3} has 24 octahedral cells and no regular 3D analogue.'],
  '600cell': ['The 600-cell', 'The 600-cell {3,3,5} has 120 vertices and 600 tetrahedral cells. Its vertices model unit quaternions of the binary icosahedral group.'],
  '120cell': ['The 120-cell', 'The 120-cell {5,3,3} has 600 vertices and 120 dodecahedral cells. It is dual to the 600-cell.'],
};

// Build a term→id map for linkification. Only the primary term string is
// linkified (not the long/short fields) to keep the regex cheap and avoid
// over-linking. Terms are sorted longest-first so "Coxeter plane" matches
// before "Coxeter".
const TERM_TO_ID = new Map();
for (const g of GLOSSARY) TERM_TO_ID.set(g.term, g.id);
const LINKABLE_TERMS = [...TERM_TO_ID.keys()].sort((a, b) => b.length - a.length);
// Escape regex special chars in a term.
const TERM_REGEX = new RegExp(
  '\\b(' + LINKABLE_TERMS.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')\\b',
  'g',
);

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[c]);
}

// Escape, then wrap known glossary terms in <a data-glossary-term="id"> links.
// The click is handled by a delegated listener in main.js (which owns the
// glossary modal).
function linkifyBody(text) {
  const escaped = escapeHtml(text);
  return escaped.replace(TERM_REGEX, (match) => {
    const id = TERM_TO_ID.get(match);
    return id ? `<a class="essay-term" data-glossary-term="${id}" tabindex="0">${match}</a>` : match;
  });
}

export class EssayPanel {
  constructor(host, { params, onChange }) {
    this.host = host;
    this.params = params;
    this.onChange = onChange;
    // Default CLOSED so the essay doesn't block the 3D canvas. User can
    // press I or click the ⓘ button to open it.
    this.open = false;
    this.index = 0;
    this.lastView = null;
    this.render();
  }

  // Call when the view changes to reset the essay stack
  setView(viewId) {
    if (viewId !== this.lastView) {
      this.index = 0;
      this.lastView = viewId;
      this.render();
    }
  }

  toggle() {
    this.open = !this.open;
    this.render();
  }

  next() {
    const ids = ESSAY_CONTEXTS[this.lastView] || [];
    this.index = (this.index + 1) % Math.max(1, ids.length);
    this.render();
  }

  prev() {
    const ids = ESSAY_CONTEXTS[this.lastView] || [];
    const n = Math.max(1, ids.length);
    this.index = (this.index - 1 + n) % n;
    this.render();
  }

  /**
   * Jump to a specific essay by ID (used by Tour mode).
   * Updates this.lastView to the context list that contains this essay so the
   * counter ("N / M") still makes sense, then renders.
   */
  setEssayById(id) {
    if (!ESSAYS[id]) return;
    // Find which view-context contains this essay
    for (const [viewId, ids] of Object.entries(ESSAY_CONTEXTS)) {
      const idx = ids.indexOf(id);
      if (idx >= 0) {
        this.lastView = viewId;
        this.index = idx;
        if (!this.open) {
          this.open = true;
        }
        this.render();
        return;
      }
    }
    // Fallback: just render the essay without changing context
    this.open = true;
    this.render();
  }

  render() {
    if (!this.host) return;
    // Mirror open state onto <body> so CSS can reposition the tour bar (it
    // centers in the canvas when the essay is closed, and shifts left to
    // leave room for the right-docked essay when open).
    if (typeof document !== 'undefined' && document.body) {
      document.body.classList.toggle('essay-open', this.open);
    }
    if (!this.open) {
      this.host.innerHTML = `<button class="essay-toggle" title="Show essays (I)">ⓘ</button>`;
      const btn = this.host.querySelector('.essay-toggle');
      if (btn) btn.onclick = () => this.toggle();
      return;
    }
    const ids = ESSAY_CONTEXTS[this.lastView] || [];
    const id = ids[this.index] || null;
    const e = id ? getEssay(id) : null;
    const selection = this.lastView === 'platonic' ? this.params.shape : this.lastView === 'polytope' ? this.params.poly4d : null;
    const note = SELECTION_NOTES[selection];
    // Notify the host app so it can track the "Reader" exploration badge.
    if (id && typeof this.onChange === 'function') {
      try { this.onChange({ essayId: id }); } catch {}
    }
    this.host.innerHTML = `
      <div class="essay-panel">
        <div class="essay-header">
          <button class="essay-toggle" title="Hide (I)" data-act="toggleEssay">ⓘ</button>
          <div class="essay-nav">
            <button data-act="essayPrev" title="Previous (←)" ${ids.length <= 1 ? 'disabled' : ''}>‹</button>
            <span class="essay-counter">${ids.length > 0 ? (this.index + 1) + ' / ' + ids.length : '0 / 0'}</span>
            <button data-act="essayNext" title="Next (→)" ${ids.length <= 1 ? 'disabled' : ''}>›</button>
          </div>
        </div>
        ${e ? `
          <div class="essay-title">${e.title}</div>
          <div class="essay-provenance" data-claim-type="${escapeHtml(e.claimType)}">
            <strong>${escapeHtml(CLAIM_LABELS[e.claimType] || e.claimType)}</strong>
            <span>${escapeHtml(e.scopeNote)}</span>
            <span>${e.sourceIds.map(sourceId => {
              const source = FACT_SOURCES[sourceId];
              return `<a href="${escapeHtml(source.url)}" target="_blank" rel="noreferrer">${escapeHtml(source.author)}</a>`;
            }).join(' · ')}</span>
          </div>
          ${note ? `<div class="essay-selection"><small>Current selection</small><strong>${escapeHtml(note[0])}</strong><p>${escapeHtml(note[1])}</p></div>` : ''}
          <div class="essay-body">${this._formatBody(e.body)}</div>
        ` : `
          <div class="essay-empty">No essays for this view yet.</div>
        `}
      </div>
    `;
  }

  _formatBody(body) {
    // Convert paragraphs (double newlines) to <p>, newlines to <br>, and
    // linkify known glossary terms. Escaping happens inside linkifyBody so the
    // inserted <a> tags survive intact.
    return body
      .trim()
      .split(/\n\n+/)
      .map(p => `<p>${linkifyBody(p).replace(/\n/g, '<br>')}</p>`)
      .join('');
  }
}
