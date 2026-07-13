// brackets.js — Lie bracket structure of so(8) ⊂ E₈
//
// The Lie algebra of the E₈ root system decomposes as:
//   e₈ = 𝔥 ⊕ Σ_α ℝ·eα
// where 𝔥 is 8-dimensional Cartan subalgebra, and eα are root vectors.
//
// For so(8), the bracket structure on the root vectors is:
//   [eα, eβ] = Nαβ · eα+β     (if α+β is a root)
//   [eα, eβ] = 0              (if α+β is not a root)
//
// In a "Chevalley basis", the structure constants Nαβ are ±1 or ±2, ±3.
//
// For 3 chosen simple roots αᵢ, αⱼ, αₖ (with αᵢ + αⱼ = αₖ), we have:
//   [eαᵢ, eαⱼ] = ±eαₖ
// This is a "commutative triangle" visualization.
//
// This module renders a 2D diagram of root vectors with brackets between them.

// A "bracket triangle" shows whether [eαᵢ, eαⱼ] is a root vector or zero.
//
// KEY FACT: for two distinct SIMPLE roots αᵢ, αⱼ, the difference αⱼ−αᵢ is never a
// root, so the α-string through αⱼ has length 1 and the Chevalley structure
// constant is Nᵢⱼ = ±1 IFF αᵢ+αⱼ is a root — which happens exactly when αᵢ and αⱼ
// are ADJACENT in the Dynkin diagram. For NON-adjacent (orthogonal) simple roots,
// αᵢ+αⱼ is NOT a root and the bracket is 0.
//
// CORRECTNESS NOTE: an earlier version listed α₁+α₃, α₂+α₄, α₇+α₈ as nonzero
// brackets — but those pairs are orthogonal (not Dynkin-adjacent), so their
// bracket is actually 0. Fixed below. (Adjacency per cartan.js E8_EDGES: the
// chain α₁–α₂–α₃–α₄–α₅–α₆–α₇ plus the branch α₃–α₈.)
//
// Each entry: { a, b, root, note }. `root` = whether αₐ+α_b is a root.
export const BRACKET_TRIANGLES = [
  { a: 0, b: 1, root: true,  note: 'α₁, α₂ adjacent → α₁+α₂ is a root' },
  { a: 1, b: 2, root: true,  note: 'α₂, α₃ adjacent → α₂+α₃ is a root' },
  { a: 2, b: 3, root: true,  note: 'α₃, α₄ adjacent → α₃+α₄ is a root' },
  { a: 3, b: 4, root: true,  note: 'α₄, α₅ adjacent → α₄+α₅ is a root' },
  { a: 2, b: 7, root: true,  note: 'α₃, α₈ adjacent (branch) → α₃+α₈ is a root' },
  // Non-adjacent (orthogonal) pairs — the bracket vanishes:
  { a: 0, b: 2, root: false, note: 'α₁, α₃ orthogonal → α₁+α₃ not a root, so [·,·]=0' },
  { a: 1, b: 3, root: false, note: 'α₂, α₄ orthogonal → α₂+α₄ not a root, so [·,·]=0' },
];

// Format a bracket: nonzero → [eαᵢ, eαⱼ] = e(αᵢ+αⱼ) (sign +1 in the standard
// Chevalley normalization for simple-root pairs); zero → [eαᵢ, eαⱼ] = 0.
export function formatBracket(t) {
  const a = t.a + 1, b = t.b + 1;
  return t.root
    ? `[eα${a}, eα${b}] = e(α${a}+α${b})`
    : `[eα${a}, eα${b}] = 0`;
}

// Render the bracket panel section
export function renderBrackets(params) {
  const idx = Math.floor((params.bracketIndex || 0) % BRACKET_TRIANGLES.length);
  const t = BRACKET_TRIANGLES[idx];
  const formatted = formatBracket(t);
  // Apex of the triangle: the sum root when it exists, else ∅ (bracket = 0).
  const apex = t.root ? `α${t.a + 1}+α${t.b + 1}` : '∅';
  const apexStroke = t.root ? 'var(--accent)' : 'var(--ink-2)';
  return `
    <div class="bracket-panel">
      <div class="bracket-header">
        <button data-act="cycleBracket" data-arg="-1" title="Previous">‹</button>
        <span class="bracket-counter">${idx + 1} / ${BRACKET_TRIANGLES.length}</span>
        <button data-act="cycleBracket" data-arg="1" title="Next">›</button>
      </div>
      <div class="bracket-formula">
        <span style="font-family: 'JetBrains Mono', monospace; font-size: 14px;">${formatted}</span>
      </div>
      <div class="bracket-note">${t.note}</div>
      <svg class="bracket-diagram" viewBox="0 0 200 100">
        <!-- Triangle with simple roots at vertices -->
        <line x1="30" y1="80" x2="100" y2="20" stroke="var(--accent)" stroke-width="2"/>
        <line x1="100" y1="20" x2="170" y2="80" stroke="var(--accent)" stroke-width="2"/>
        <line x1="30" y1="80" x2="170" y2="80" stroke="var(--accent)" stroke-width="2" stroke-dasharray="4,4"/>
        <circle cx="30" cy="80" r="10" fill="var(--bg-2)" stroke="var(--accent)" stroke-width="2"/>
        <text x="30" y="84" text-anchor="middle" font-size="11" fill="var(--ink-0)">α${t.a+1}</text>
        <circle cx="100" cy="20" r="10" fill="var(--bg-2)" stroke="${apexStroke}" stroke-width="2"/>
        <text x="100" y="24" text-anchor="middle" font-size="10" fill="var(--ink-0)">${apex}</text>
        <circle cx="170" cy="80" r="10" fill="var(--bg-2)" stroke="var(--accent)" stroke-width="2"/>
        <text x="170" y="84" text-anchor="middle" font-size="11" fill="var(--ink-0)">α${t.b+1}</text>
      </svg>
    </div>
  `;
}
