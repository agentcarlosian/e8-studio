// e8-quasicrystal.js — finite cut-and-project patches from the E8 lattice.
//
// E8 is self-dual.  We enumerate a finite ball of lattice points, project each
// point onto the canonical Coxeter plane stored in data/e8.json, and retain it
// when its six-dimensional perpendicular component lies inside a spherical
// acceptance window.  The spherical window is an explicit Studio design
// choice: it makes the cut-and-project mechanism inspectable without claiming
// to be a canonical Voronoi-window model set.

const EPSILON = 1e-9;
const latticeCache = new Map();
const patchCache = new WeakMap();
const projectionCache = new WeakMap();
const diffractionStates = new WeakMap();
const MAX_INCREMENTAL_DIFFRACTION_STEPS = 32;
const MAX_INCREMENTAL_CHANGED_FRACTION = 0.5;

export const QUASICRYSTAL_REACHES = Object.freeze([4, 6, 8]);

export function quasicrystalReliefHeight(point, mode = 'pattern', relief = 0, radius = 1) {
  const amount = Number(relief) || 0;
  if (!amount) return 0;
  const coordinates = mode === 'window' ? point?.windowPlot : point?.normalized;
  const x = Number(coordinates?.[0]) || 0;
  const y = Number(coordinates?.[1]) || 0;
  const angle = Math.atan2(y, x);
  const strength = mode === 'diffraction'
    ? Number(point?.strength) || 0
    : Number(point?.acceptance) || 0;
  const bias = mode === 'diffraction' ? 0.28 : 0.4;
  const frequency = mode === 'diffraction' ? 15 : 5;
  const wave = Math.sin(angle * frequency) * (mode === 'diffraction' ? 0.08 : 0.12);
  return amount * radius * (strength - bias + wave);
}

export function enumerateE8Lattice(maxNormSq = 8) {
  const limit = normalizeReach(maxNormSq);
  if (latticeCache.has(limit)) return latticeCache.get(limit);
  const points = [];
  enumerateCoset(0, limit, points);
  enumerateCoset(0.5, limit, points);
  points.sort((a, b) => a.normSq - b.normSq || compareCoordinates(a.coords, b.coords));
  const frozen = Object.freeze(points.map(point => Object.freeze({
    coords: Object.freeze(point.coords),
    normSq: point.normSq,
    coset: point.coset,
  })));
  latticeCache.set(limit, frozen);
  return frozen;
}

export function generateE8Quasicrystal(e8, options = {}) {
  validateE8Projection(e8);
  let patchesForProjection = patchCache.get(e8);
  if (!patchesForProjection) {
    patchesForProjection = new Map();
    patchCache.set(e8, patchesForProjection);
  }
  const maxNormSq = normalizeReach(options.maxNormSq ?? 8);
  const windowRadius = clampFinite(options.windowRadius, 0.8, 2.4, 1.42);
  const phason = clampFinite(options.phason, -1.2, 1.2, 0);
  const physicalRadius = clampFinite(options.physicalRadius, 0.6, Math.sqrt(maxNormSq) + EPSILON, Math.sqrt(maxNormSq));
  const includeDiffraction = options.includeDiffraction !== false;
  const includeEdges = options.includeEdges !== false;
  const cacheKey = [
    maxNormSq,
    windowRadius.toFixed(4),
    phason.toFixed(4),
    physicalRadius.toFixed(4),
    includeDiffraction ? 'd1' : 'd0',
    includeEdges ? 'e1' : 'e0',
  ].join('|');
  if (patchesForProjection.has(cacheKey)) {
    const cached = patchesForProjection.get(cacheKey);
    const state = diffractionStates.get(cached);
    if (state) projectedCandidates(e8, maxNormSq).diffractionState = state;
    return cached;
  }
  const projected = projectedCandidates(e8, maxNormSq);
  const accepted = [];
  for (const point of projected.candidates) {
    if (point.physicalRadius > physicalRadius + EPSILON) continue;
    const shiftedInternalNormSq = Math.max(
      0,
      point.internalNormSq + phason * phason - 2 * phason * point.offsetCoordinate,
    );
    const shiftedInternalRadius = Math.sqrt(shiftedInternalNormSq);
    if (shiftedInternalRadius > windowRadius + EPSILON) continue;
    accepted.push({
      ...point,
      shiftedInternalRadius,
      index: accepted.length,
    });
  }

  // The visible plane must keep one scale for a given reach and projection.
  // Rescaling to the accepted subset makes retained points jump when only the
  // acceptance window moves.
  const displayScale = projected.displayScale;
  for (const point of accepted) {
    point.normalized = [point.projected[0] / displayScale, point.projected[1] / displayScale];
    point.windowPlot = [
      (point.internal2[0] - phason) / windowRadius,
      point.internal2[1] / windowRadius,
    ];
    point.acceptance = Math.max(0, 1 - point.shiftedInternalRadius / windowRadius);
  }

  const edges = includeEdges ? buildProximityEdges(accepted) : [];
  const diffractionResult = includeDiffraction
    ? buildDiffraction(accepted, projected.rootShell, projected, projected.diffractionState)
    : null;
  const diffraction = diffractionResult?.peaks || [];
  if (diffractionResult) projected.diffractionState = diffractionResult.state;
  const shellCounts = Object.fromEntries(QUASICRYSTAL_REACHES.map(shell => [shell, 0]));
  for (const point of accepted) {
    const shell = String(Math.round(point.normSq));
    shellCounts[shell] = (shellCounts[shell] || 0) + 1;
  }

  const result = {
    kind: 'e8-cut-and-project',
    label: 'E8 Quasicrystal',
    description: 'A finite E8 lattice patch selected by a movable spherical window in the six hidden dimensions.',
    sourceDimension: 8,
    physicalDimension: 2,
    internalDimension: 6,
    symmetryOrder: 30,
    maxNormSq,
    windowRadius,
    phason,
    physicalRadius,
    displayScale,
    candidateCount: projected.candidates.length,
    pointCount: accepted.length,
    edgeCount: edges.length,
    diffractionCandidateCount: projected.rootShell.length,
    diffractionComputation: diffractionResult?.method || 'deferred',
    shellCounts,
    projectionBasis: { re: [...projected.re], im: [...projected.im] },
    points: accepted,
    edges,
    diffraction,
  };
  if (diffractionResult) diffractionStates.set(result, diffractionResult.state);
  patchesForProjection.set(cacheKey, result);
  if (patchesForProjection.size > 24) {
    patchesForProjection.delete(patchesForProjection.keys().next().value);
  }
  return result;
}

function projectedCandidates(e8, maxNormSq) {
  let byReach = projectionCache.get(e8);
  if (!byReach) {
    byReach = new Map();
    projectionCache.set(e8, byReach);
  }
  if (byReach.has(maxNormSq)) return byReach.get(maxNormSq);
  const re = normalized(e8.coxeter_basis.re);
  const im = normalized(e8.coxeter_basis.im);
  const [internalX, internalY] = internalAxes(re, im);
  const candidates = enumerateE8Lattice(maxNormSq).map((point, sourceIndex) => projectCandidate(
    point,
    sourceIndex,
    re,
    im,
    internalX,
    internalY,
    internalX,
  ));
  const result = {
    re,
    im,
    candidates,
    displayScale: Math.max(1, ...candidates.map(point => point.physicalRadius)),
    rootShell: candidates.filter(point => Math.abs(point.normSq - 2) < EPSILON),
  };
  byReach.set(maxNormSq, result);
  return result;
}

function enumerateCoset(shift, maxNormSq, output) {
  const coords = new Array(8).fill(0);
  function visit(index, normSq, integerSum) {
    if (index === 8) {
      // For the half-integer coset, sum(x_i) = sum(n_i) + 4, so the same
      // even-parity test applies to its underlying integer coordinates.
      if (Math.abs(normSq) <= maxNormSq + EPSILON && modulo(integerSum, 2) === 0) {
        output.push({ coords: [...coords], normSq: roundHalf(normSq), coset: shift ? 'half' : 'integer' });
      }
      return;
    }
    const remaining = Math.max(0, maxNormSq - normSq);
    const bound = Math.sqrt(remaining) + EPSILON;
    const minInteger = Math.ceil(-bound - shift);
    const maxInteger = Math.floor(bound - shift);
    for (let integer = minInteger; integer <= maxInteger; integer++) {
      const value = integer + shift;
      const nextNormSq = normSq + value * value;
      if (nextNormSq > maxNormSq + EPSILON) continue;
      coords[index] = value;
      visit(index + 1, nextNormSq, integerSum + integer);
    }
  }
  visit(0, 0, 0);
}

function projectCandidate(point, sourceIndex, re, im, internalX, internalY, offsetAxis) {
  const x = dot(point.coords, re);
  const y = dot(point.coords, im);
  const physicalNormSq = x * x + y * y;
  const internalNormSq = Math.max(0, point.normSq - physicalNormSq);
  const offsetCoordinate = dot(point.coords, offsetAxis);
  return {
    sourceIndex,
    coords: point.coords,
    coset: point.coset,
    normSq: point.normSq,
    projected: [x, y],
    physicalRadius: Math.sqrt(physicalNormSq),
    internalRadius: Math.sqrt(internalNormSq),
    internalNormSq,
    offsetCoordinate,
    internal2: [dot(point.coords, internalX), dot(point.coords, internalY)],
  };
}

function internalAxes(re, im) {
  const axes = [];
  for (let seedIndex = 0; seedIndex < 8 && axes.length < 2; seedIndex++) {
    const axis = Array.from({ length: 8 }, (_, index) => index === seedIndex ? 1 : 0);
    subtractProjection(axis, re);
    subtractProjection(axis, im);
    for (const existing of axes) subtractProjection(axis, existing);
    const length = Math.sqrt(dot(axis, axis));
    if (length > 1e-7) axes.push(axis.map(value => value / length));
  }
  if (axes.length !== 2) throw new Error('Could not construct E8 internal-space axes');
  return axes;
}

function buildProximityEdges(points) {
  if (points.length < 2) return [];
  const area = 4;
  const characteristic = Math.sqrt(area / points.length);
  const threshold = Math.max(0.018, Math.min(0.22, characteristic * 1.75));
  const edgeLimit = Math.min(7200, points.length * 4);
  const baseCellX = points.map(point => Math.floor(point.normalized[0] / threshold));
  const baseCellY = points.map(point => Math.floor(point.normalized[1] / threshold));
  // At dense settings the 7,200-link cap is reached well inside the search
  // radius. Use a smaller first radius for the most crowded patches; patches
  // with fewer points need more room to fill the cap. A short pass is exact if
  // it reaches the cap; otherwise use the original full radius. The degree-five
  // bound rules out the short pass for patches that cannot fill the cap.
  if (points.length * 2.5 >= edgeLimit) {
    const firstRadius = threshold * (points.length >= 12000 ? 0.28
      : points.length >= 7000 ? 0.46 : 0.52);
    const nearby = proximityEdgesWithin(points, firstRadius, edgeLimit, baseCellX, baseCellY);
    if (nearby.length === edgeLimit) return nearby;
  }
  return proximityEdgesWithin(points, threshold, edgeLimit, baseCellX, baseCellY);
}

function proximityEdgesWithin(points, radius, edgeLimit, baseCellX, baseCellY) {
  const cellX = new Int32Array(points.length);
  const cellY = new Int32Array(points.length);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let index = 0; index < points.length; index++) {
    const point = points[index];
    cellX[index] = Math.floor(point.normalized[0] / radius);
    cellY[index] = Math.floor(point.normalized[1] / radius);
    minX = Math.min(minX, cellX[index]);
    maxX = Math.max(maxX, cellX[index]);
    minY = Math.min(minY, cellY[index]);
    maxY = Math.max(maxY, cellY[index]);
  }
  // A padded integer grid replaces string keys and per-cell arrays. The
  // padding makes every neighboring cell lookup valid, even at the boundary.
  const stride = maxY - minY + 3;
  const heads = new Int32Array((maxX - minX + 3) * stride);
  heads.fill(-1);
  const next = new Int32Array(points.length);
  for (let index = 0; index < points.length; index++) {
    const key = (cellX[index] - minX + 1) * stride + cellY[index] - minY + 1;
    next[index] = heads[key];
    heads[key] = index;
  }
  const candidates = [];
  const radiusSq = radius * radius * (1 + 1e-12);
  for (let index = 0; index < points.length; index++) {
    const point = points[index];
    const baseKey = (cellX[index] - minX + 1) * stride + cellY[index] - minY + 1;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let otherIndex = heads[baseKey + dx * stride + dy];
          otherIndex !== -1; otherIndex = next[otherIndex]) {
          if (otherIndex <= index) continue;
          const other = points[otherIndex];
          const deltaX = point.normalized[0] - other.normalized[0];
          const deltaY = point.normalized[1] - other.normalized[1];
          if (deltaX * deltaX + deltaY * deltaY > radiusSq) continue;
          const distance = Math.hypot(deltaX, deltaY);
          if (distance > 1e-5 && distance <= radius) candidates.push({ a: index, b: otherIndex, distance });
        }
      }
    }
  }
  // JS sort is stable, so ties in the original full-radius search followed
  // source index, then neighbor-cell order, then neighbor index. Preserve that
  // order even when the short pass uses smaller spatial buckets.
  candidates.sort((a, b) => a.distance - b.distance || a.a - b.a
    || baseCellX[a.b] - baseCellX[b.b]
    || baseCellY[a.b] - baseCellY[b.b]
    || a.b - b.b);
  const degree = new Uint8Array(points.length);
  const edges = [];
  for (const edge of candidates) {
    if (edges.length >= edgeLimit) break;
    if (degree[edge.a] >= 5 || degree[edge.b] >= 5) continue;
    degree[edge.a]++;
    degree[edge.b]++;
    edges.push([edge.a, edge.b]);
  }
  return edges;
}

function buildDiffraction(points, roots, projected, previous) {
  const membership = new Uint8Array(projected.candidates.length);
  const indices = [];
  const added = [];
  for (const point of points) {
    membership[point.sourceIndex] = 1;
    indices.push(point.sourceIndex);
    if (previous && !previous.membership[point.sourceIndex]) added.push(point);
  }
  const removed = previous
    ? previous.indices.filter(index => !membership[index]).map(index => projected.candidates[index])
    : [];
  const changedCount = added.length + removed.length;
  // A nearby slider step changes few selected vectors, so update their
  // structure-factor contributions. Periodic full work limits roundoff drift.
  const incremental = points.length > 0 && previous && previous.real.length === roots.length
    && previous.stepsSinceFull < MAX_INCREMENTAL_DIFFRACTION_STEPS
    && changedCount <= Math.max(64, points.length * MAX_INCREMENTAL_CHANGED_FRACTION);
  const real = incremental ? previous.real.slice() : new Float64Array(roots.length);
  const imaginary = incremental ? previous.imaginary.slice() : new Float64Array(roots.length);
  if (incremental) {
    accumulateStructureFactors(real, imaginary, roots, removed, -1);
    accumulateStructureFactors(real, imaginary, roots, added, 1);
  } else {
    accumulateStructureFactors(real, imaginary, roots, points, 1);
  }
  const state = {
    membership,
    indices,
    real,
    imaginary,
    stepsSinceFull: incremental ? previous.stepsSinceFull + 1 : 0,
  };
  if (!points.length) return { peaks: [], state, method: incremental ? 'incremental' : 'full' };
  const divisor = points.length * points.length;
  const peaks = roots.map((root, index) => ({
    index,
    projected: [...root.projected],
    radius: root.physicalRadius,
    intensity: (real[index] * real[index] + imaginary[index] * imaginary[index]) / divisor,
    normSq: root.normSq,
  }));
  const maxRadius = Math.max(...peaks.map(peak => peak.radius), 1);
  const maxIntensity = Math.max(...peaks.map(peak => peak.intensity), EPSILON);
  return { peaks: peaks
    .map(peak => ({
      ...peak,
      normalized: [peak.projected[0] / maxRadius, peak.projected[1] / maxRadius],
      strength: Math.sqrt(peak.intensity / maxIntensity),
    }))
    .sort((a, b) => b.strength - a.strength || a.radius - b.radius),
    state,
    method: incremental ? 'incremental' : 'full',
  };
}

function accumulateStructureFactors(real, imaginary, roots, points, sign) {
  if (!points.length) return;
  for (let index = 0; index < roots.length; index++) {
    const kx = roots[index].projected[0] * Math.PI * 2;
    const ky = roots[index].projected[1] * Math.PI * 2;
    let realSum = real[index];
    let imaginarySum = imaginary[index];
    for (const point of points) {
      const phase = kx * point.projected[0] + ky * point.projected[1];
      realSum += sign * Math.cos(phase);
      imaginarySum += sign * Math.sin(phase);
    }
    real[index] = realSum;
    imaginary[index] = imaginarySum;
  }
}

function validateE8Projection(e8) {
  const re = e8?.coxeter_basis?.re;
  const im = e8?.coxeter_basis?.im;
  if (!Array.isArray(re) || re.length !== 8 || !Array.isArray(im) || im.length !== 8) {
    throw new TypeError('E8 Coxeter-plane basis must contain two 8D vectors');
  }
}

function normalized(vector) {
  const length = Math.sqrt(dot(vector, vector));
  if (!(length > EPSILON)) throw new TypeError('Projection basis vector cannot be zero');
  return vector.map(value => value / length);
}

function subtractProjection(target, axis) {
  const amount = dot(target, axis);
  for (let index = 0; index < target.length; index++) target[index] -= amount * axis[index];
}

function dot(a, b) {
  let value = 0;
  for (let index = 0; index < a.length; index++) value += a[index] * b[index];
  return value;
}

function normalizeReach(value) {
  const numeric = Number(value);
  return QUASICRYSTAL_REACHES.includes(numeric) ? numeric : 8;
}

function clampFinite(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(min, Math.min(max, numeric));
}

function compareCoordinates(a, b) {
  for (let index = 0; index < a.length; index++) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

function modulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function roundHalf(value) {
  return Math.round(value * 2) / 2;
}
