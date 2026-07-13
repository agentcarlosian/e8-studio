// weyl.js — Weyl group actions on E₈ roots
//
// A simple reflection s_α acts on any root β as:
//   s_α(β) = β - 2<α,β>/<α,α> · α
//
// For E₈'s standard normalization <α,α> = 2 (for all simple roots, since E₈ is
// simply-laced). So s_α(β) = β - <α,β>·α.
//
// We don't enumerate all 696M Weyl elements (that would take 696MB just to store
// indices). Instead we:
//   1. Take a seed root β
//   2. Apply random products of simple reflections
//   3. Stop when we revisit a known root or hit a max-length
//   4. Animate the orbit
//
// This gives varied random reflection paths through the finite 240-root orbit
// while keeping memory O(n).

// 8 simple roots of E₈ (even coordinate system — same root lattice as
// data/e8.json, where the half-integer roots ½(±1)⁸ have an EVEN number of
// minus signs). The labelling matches cartan.js's Dynkin diagram: α₁–α₂–α₃–α₄–
// α₅–α₆–α₇ as a chain with α₈ branching off α₃.
//
// CORRECTNESS NOTE: an earlier version used α₁..α₇ = eᵢ−eᵢ₊₁ with α₈ = e₇+e₈.
// That α₈ is a D₈ root and attaches to α₆, so those 8 reflections generate only
// the D₈ Weyl group — their root-system closure is 112 roots, NOT E₈'s 240. The
// roots below are verified to close at 240 with the E₈ Cartan matrix. E₈ genuinely
// needs a half-integer "spinor" simple root (α₄, α₈); it cannot be built from
// integer eᵢ±eⱼ roots alone.
export const SIMPLE_ROOTS_8D = [
  [ 1.0,  1.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0],  // α₁ = e₁ + e₂
  [-1.0,  0.0,  1.0,  0.0,  0.0,  0.0,  0.0,  0.0],  // α₂ = e₃ − e₁
  [ 1.0, -1.0,  0.0,  0.0,  0.0,  0.0,  0.0,  0.0],  // α₃ = e₁ − e₂  (branch node)
  [-0.5,  0.5, -0.5,  0.5,  0.5,  0.5,  0.5,  0.5],  // α₄ = ½ spinor (even # of −)
  [ 0.0,  0.0,  0.0, -1.0, -1.0,  0.0,  0.0,  0.0],  // α₅ = −e₄ − e₅
  [ 0.0,  0.0,  0.0,  1.0,  0.0, -1.0,  0.0,  0.0],  // α₆ = e₄ − e₆
  [ 0.0,  0.0,  0.0,  0.0,  0.0,  1.0, -1.0,  0.0],  // α₇ = e₆ − e₇
  [-0.5,  0.5, -0.5, -0.5,  0.5, -0.5, -0.5, -0.5],  // α₈ = ½ spinor, attaches to α₃
];

const SIMPLE = SIMPLE_ROOTS_8D;

// Inner product in ℝ⁸: <v, w> = Σ vᵢwᵢ
export function dot8(v, w) {
  let s = 0;
  for (let i = 0; i < 8; i++) s += v[i] * w[i];
  return s;
}

// Simple reflection s_α(β) for E₈'s integer basis
// Note: For E₈, <α, α> = 2, so s_α(β) = β - <α,β>·α
export function reflect(simpleIdx, beta) {
  const alpha = SIMPLE[simpleIdx];
  const c = dot8(alpha, beta);
  const result = new Array(8);
  for (let i = 0; i < 8; i++) {
    result[i] = beta[i] - c * alpha[i];
  }
  return result;
}

// Apply a word in the simple reflections to β.
// Word is a list of simple reflection indices (0..7).
export function applyWord(beta, word) {
  let v = beta;
  for (const s of word) v = reflect(s, v);
  return v;
}

// Compare two 8D root vectors (coordinates may be integral or half-integral).
export function rootEq(a, b) {
  for (let i = 0; i < 8; i++) if (a[i] !== b[i]) return false;
  return true;
}

// Generate a Weyl-orbit by walking random words and tracking visited roots.
// Returns { history, currentWord, current } where:
//   - history: array of {beta, word} entries (visited roots + the word that produced them)
//   - currentWord: the word currently being applied (in progress)
//   - current: the current 8D position
//
// For the root seeds used here, W(E₈) acts transitively on all 240 roots, so the
// mathematical orbit has exactly 240 members. This class stores only the
// current random walk and resets when that walk revisits a root.
export class WeylOrbit {
  constructor(seedBeta, maxSteps = 1000) {
    this.seed = seedBeta.slice();
    this.current = seedBeta.slice();
    this.currentWord = [];
    this.history = [{ beta: seedBeta.slice(), word: [] }];
    this.visited = new Map();
    this.visited.set(this._key(seedBeta), 0);
    this.maxSteps = maxSteps;
    this.stepCount = 0;
  }
  _key(v) { return v.join(','); }
  // Take one step: apply a random simple reflection
  step(rng = Math.random) {
    if (this.stepCount >= this.maxSteps) return null;
    const s = Math.floor(rng() * 8);
    this.currentWord = [...this.currentWord, s];
    this.current = reflect(s, this.current);
    this.stepCount++;
    const k = this._key(this.current);
    if (this.visited.has(k)) {
      // Orbit closes — restart from seed
      this.current = this.seed.slice();
      this.currentWord = [];
      this.history = [{ beta: this.seed.slice(), word: [] }];
      this.visited.clear();
      this.visited.set(this._key(this.seed), 0);
      this.stepCount = 0;
      return { type: 'cycle-complete' };
    }
    this.visited.set(k, this.history.length);
    this.history.push({ beta: this.current.slice(), word: this.currentWord.slice() });
    return { type: 'step', beta: this.current, word: this.currentWord };
  }
  // Replay the entire history (for visualization)
  getHistory() { return this.history; }
}

// 8 simple roots as drawable objects for the panel
export function getSimpleRoots() { return SIMPLE.map((v, i) => ({ idx: i, vec: v.slice() })); }

// Project 8D root onto 2D for visualization using Coxeter basis
// Basis vectors u₁, u₂ in ℝ⁸ from data/e8.json (coxeter_basis.re / .im)
export function projectTo2D_Coxeter(beta8d, basisRe, basisIm) {
  return [dot8(beta8d, basisRe), dot8(beta8d, basisIm)];
}

/**
 * Find a shortest word in the simple reflections that maps root `from8d` to
 * root `to8d` (both 8D vectors). Returns an array of simple-reflection indices
 * (each 0..7), or null if no word is found within the step cap.
 *
 * This is a breadth-first search over the Cayley graph of W(E₈) generated by
 * the 8 simple reflections, rooted at `from8d`. Because every root is in the
 * W-orbit of every other root (W acts transitively on roots of a given length,
 * and all 240 E₈ roots have length² = 2), a word always exists; the cap is just
 * a safety bound. The resulting word length is the Weyl-group "distance" between
 * the two roots.
 *
 * `stepCap` defaults to 30 (= the Coxeter number), a conservative search cap
 * for the 240-root graph used by the Studio.
 */
export function findWeylWord(from8d, to8d, stepCap = 30) {
  const targetKey = to8d.map(x => Math.round(x * 1e6)).join(',');
  const startKey = from8d.map(x => Math.round(x * 1e6)).join(',');
  if (startKey === targetKey) return [];
  // BFS frontier: { vec, word }
  const visited = new Map(); // key -> true
  visited.set(startKey, true);
  let frontier = [{ vec: from8d.slice(), word: [] }];
  for (let depth = 0; depth < stepCap && frontier.length; depth++) {
    const next = [];
    for (const node of frontier) {
      for (let s = 0; s < 8; s++) {
        const v = reflect(s, node.vec);
        const k = v.map(x => Math.round(x * 1e6)).join(',');
        if (visited.has(k)) continue;
        if (k === targetKey) return [...node.word, s];
        visited.set(k, true);
        next.push({ vec: v, word: [...node.word, s] });
      }
    }
    frontier = next;
  }
  return null;
}

/**
 * Pretty-print a Weyl word as a reflection product, e.g. [2,0,5] → "s₃·s₁·s₆".
 * The reflections are written right-to-left (the order they act on a vector).
 */
export function formatWeylWord(word) {
  if (!word || !word.length) return 'identity';
  const SUB = ['₀','₁','₂','₃','₄','₅','₆','₇','₈','₉'];
  return word.map(s => 's' + SUB[s + 1]).join('·');
}

/**
 * Compute the intermediate root vectors when applying `word` to `from8d`, one
 * reflection at a time. Returns an array of { vec, step, reflectIdx } where
 * step 0 is the start (from8d itself). Used to animate the reflection path.
 */
export function weylWordSteps(from8d, word) {
  const steps = [{ vec: from8d.slice(), step: 0, reflectIdx: -1 }];
  let v = from8d.slice();
  for (let i = 0; i < word.length; i++) {
    v = reflect(word[i], v);
    steps.push({ vec: v.slice(), step: i + 1, reflectIdx: word[i] });
  }
  return steps;
}
