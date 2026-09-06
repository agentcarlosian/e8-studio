// Small, consistent symbols help distinguish the nine mathematical workspaces.
// Presentation metadata stays separate from rendering and export capabilities.
export const VIEW_CARDS = [
  { id: 'bloom', label: 'Bloom', detail: 'Geometry in motion', mark: '<circle cx="16" cy="16" r="11"/><circle cx="16" cy="16" r="6"/><path d="M16 2v28M2 16h28M6 6l20 20M6 26L26 6"/>' },
  { id: 'platonic', label: 'Platonic', detail: 'Solids & duals', mark: '<path d="M16 3 29 11v13L16 31 3 24V11ZM3 11l13 7 13-7M16 18v13M16 3v15"/>' },
  { id: 'e8coxeter', label: 'E₈ Coxeter', detail: '240 roots · 8 rings', mark: '<circle cx="16" cy="16" r="13"/><circle cx="16" cy="16" r="9"/><circle cx="16" cy="16" r="5"/>' },
  { id: 'quasicrystal', label: 'Quasicrystal', detail: 'A window into 8D', mark: '<path d="m16 2 8 24L3 11h26L8 26ZM16 7l10 10-10 10L6 17Z"/>' },
  { id: 'polytope', label: '4D Polytopes', detail: 'Beyond three dimensions', mark: '<path d="M3 3h19v19H3ZM10 10h19v19H10ZM3 3l7 7M22 3l7 7M22 22l7 7M3 22l7 7"/>' },
  { id: 'raymarched', label: 'E₈ SDF', detail: 'Sculpted with light', mark: '<circle cx="16" cy="16" r="12"/><ellipse cx="16" cy="16" rx="6" ry="12"/><path d="M4 16h24M7 8c6 5 12 5 18 0M7 24c6-5 12-5 18 0"/>' },
  { id: 'rootlab', label: 'Root Lab', detail: 'Patterns from reflections', mark: '<path d="M16 2v28M2 16h28M6 6l20 20M6 26L26 6"/><circle cx="16" cy="16" r="3"/><path d="m12 6 4-4 4 4M26 12l4 4-4 4"/>' },
  { id: 'tiling', label: 'Tiling Lab', detail: 'Symmetry without repetition', mark: '<path d="m16 2 13 8v14l-13 8L3 24V10ZM3 10l13 8 13-8M16 18v14M3 24l13-8 13 8M16 2v14"/>' },
  { id: 'dynkin', label: 'Dynkin', detail: 'A map of simple roots', mark: '<path d="M3 20h26M16 20V6"/><circle cx="3" cy="20" r="2"/><circle cx="10" cy="20" r="2"/><circle cx="16" cy="20" r="2"/><circle cx="23" cy="20" r="2"/><circle cx="29" cy="20" r="2"/><circle cx="16" cy="6" r="2"/>' },
];

export function renderViewCards(view) {
  return `<div class="ps-view-switch view-card-grid" role="group" aria-label="Choose a visualization">${VIEW_CARDS.map(card => `
    <button class="view-card ${view === card.id ? 'on' : ''}" aria-pressed="${view === card.id}" data-act="switchView" data-arg="${card.id}" aria-label="Select ${card.label} view" title="${card.detail}">
      <svg viewBox="0 0 32 34" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linejoin="round" aria-hidden="true">${card.mark}</svg>
      <span>${card.label}</span>
    </button>`).join('')}</div>`;
}

export function renderExplorationInvite() {
  let seen = false;
  try { seen = localStorage.getItem('e8_quick_start_seen_v1') === 'true'; } catch {}
  return seen ? '' : `<div class="exploration-invite">
    <div><strong>A little guidance?</strong><p>Meet the geometry in three small steps.</p></div>
    <button data-act="startQuickStart">Start exploring <span aria-hidden="true">↗</span></button>
  </div>`;
}
