// cartan.js — Cartan matrix explorer for E₈
//
// The Cartan matrix of E₈ is 8×8 with diagonal 2s and specific off-diagonal
// values determined by the angle between simple roots:
//   - simple roots adjacent in the Dynkin diagram: <αᵢ,αⱼ> = -1
//   - simple roots with double bond: <αᵢ,αⱼ> = -2
//   - simple roots with triple bond: <αᵢ,αⱼ> = -3
//   - non-adjacent: <αᵢ,αⱼ> = 0
//
// E₈'s Dynkin diagram: α₁—α₂—α₃—α₄—α₅—α₆—α₇ with α₃—α₈ (branch at α₃)
//
// Click two simple roots in the E₈ view to see their angle and Cartan entry.

import { ESSAYS } from '../content/essays.js';

export const E8_DYNKIN = [
  { id: 0, label: 'α₁', x: -3.5, y: 0 },
  { id: 1, label: 'α₂', x: -2.5, y: 0 },
  { id: 2, label: 'α₃', x: -1.5, y: 0 },
  { id: 3, label: 'α₄', x: -0.5, y: 0 },
  { id: 4, label: 'α₅', x:  0.5, y: 0 },
  { id: 5, label: 'α₆', x:  1.5, y: 0 },
  { id: 6, label: 'α₇', x:  2.5, y: 0 },
  { id: 7, label: 'α₈', x: -1.5, y: -1 },  // branch from α₃
];

export const E8_EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [2, 7],
];

// Build 8x8 Cartan matrix: A[i][j] = 2·<αᵢ,αⱼ>/<αⱼ,αⱼ>
// Diagonal: 2 always. Off-diagonal: -1 for adjacent, 0 otherwise (E₈ is simply-laced)
export function buildCartanMatrix() {
  const M = Array.from({ length: 8 }, () => new Int8Array(8));
  for (let i = 0; i < 8; i++) M[i][i] = 2;
  for (const [i, j] of E8_EDGES) {
    M[i][j] = -1;
    M[j][i] = -1;
  }
  return M;
}

// Inner product of two simple roots
export function rootAngle(i, j) {
  if (i === j) return 2;  // <αᵢ,αᵢ> = 2 (by Cartan normalization)
  const M = buildCartanMatrix();
  // M[i][j] = 2·<αᵢ,αⱼ>/<αⱼ,αⱼ> = <αᵢ,αⱼ> (since <αⱼ,αⱼ>=2)
  return M[i][j];
}

// Returns the rendering: a 8x8 grid + highlighted selection
export function renderCartanMatrix(params) {
  const M = buildCartanMatrix();
  const sel = params.cartanSelection || [];
  const a = sel[0], b = sel[1];
  // Build info text
  let info = '';
  if (a != null && b != null) {
    const ang = rootAngle(a, b);
    if (a === b) {
      info = `<α${a+1}, α${a+1}> = ${ang} (always 2, by Cartan normalization)`;
    } else if (ang === -1) {
      info = `<α${a+1}, α${b+1}> = ${ang} — adjacent in Dynkin diagram (angle 120°)`;
    } else if (ang === 0) {
      info = `<α${a+1}, α${b+1}> = 0 — non-adjacent (orthogonal, angle 90°)`;
    } else {
      info = `<α${a+1}, α${b+1}> = ${ang}`;
    }
  } else if (a != null) {
    info = `Selected α${a+1}. Click another root to see <α${a+1}, αⱼ>.`;
  } else {
    info = 'Click two simple roots to see their Cartan entry.';
  }
  return `
    <div class="cartan-grid-wrap">
      <div class="cartan-roots">
        ${E8_DYNKIN.map((r) => {
          const isSel = sel.includes(r.id);
          return `<button class="root-node ${isSel ? 'on' : ''}"
                  data-act="toggleCartan" data-arg="${r.id}"
                  style="left: calc(50% + ${r.x * 30}px); top: calc(50% + ${r.y * 30}px)">
            ${r.label}
          </button>`;
        }).join('')}
        ${E8_EDGES.map(([a_, b_]) => {
          const ra = E8_DYNKIN[a_];
          const rb = E8_DYNKIN[b_];
          return `<svg class="root-edge" style="left: 0; top: 0;">
            <line x1="${50 + ra.x * 30}" y1="${50 - ra.y * 30}"
                  x2="${50 + rb.x * 30}" y2="${50 - rb.y * 30}"
                  stroke="currentColor" stroke-width="1.5"/>
          </svg>`;
        }).join('')}
      </div>
      <div class="cartan-info">${info}</div>
      <div class="cartan-matrix">
        <table>
          ${M.map((row, i) => `
            <tr>
              <th>${E8_DYNKIN[i].label}</th>
              ${Array.from(row, (v, j) => `<td class="${(a === i && b === j) || (a === j && b === i) ? 'on' : ''}">${v}</td>`).join('')}
            </tr>
          `).join('')}
        </table>
      </div>
    </div>
  `;
}
