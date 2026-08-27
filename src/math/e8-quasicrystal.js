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
  if (patchesForProjection.has(cacheKey)) return patchesForProjection.get(cacheKey);
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

  const maxProjectedRadius = Math.max(...accepted.map(point => point.physicalRadius), 1);
  const maxInternalPlotRadius = Math.max(...accepted.map(point => Math.hypot(point.internal2[0] - phason, point.internal2[1])), windowRadius, 1);
  for (const point of accepted) {
    point.normalized = [point.projected[0] / maxProjectedRadius, point.projected[1] / maxProjectedRadius];
    point.windowPlot = [
      (point.internal2[0] - phason) / maxInternalPlotRadius,
      point.internal2[1] / maxInternalPlotRadius,
    ];
    point.acceptance = Math.max(0, 1 - point.shiftedInternalRadius / windowRadius);
  }

  const edges = includeEdges ? buildProximityEdges(accepted) : [];
  const diffraction = includeDiffraction ? buildDiffraction(accepted, projected.rootShell) : [];
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
    candidateCount: projected.candidates.length,
    pointCount: accepted.length,
    edgeCount: edges.length,
    diffractionCandidateCount: projected.rootShell.length,
    shellCounts,
    projectionBasis: { re: [...projected.re], im: [...projected.im] },
    points: accepted,
    edges,
    diffraction,
  };
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
  const cellSize = threshold;
  const buckets = new Map();
  points.forEach((point, index) => {
    const key = gridKey(point.normalized, cellSize);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(index);
  });
  const candidates = [];
  points.forEach((point, index) => {
    const bx = Math.floor(point.normalized[0] / cellSize);
    const by = Math.floor(point.normalized[1] / cellSize);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const nearby = buckets.get(`${bx + dx},${by + dy}`) || [];
        for (const otherIndex of nearby) {
          if (otherIndex <= index) continue;
          const other = points[otherIndex];
          const distance = Math.hypot(
            point.normalized[0] - other.normalized[0],
            point.normalized[1] - other.normalized[1],
          );
          if (distance > 1e-5 && distance <= threshold) candidates.push({ a: index, b: otherIndex, distance });
        }
      }
    }
  });
  candidates.sort((a, b) => a.distance - b.distance);
  const degree = new Uint8Array(points.length);
  const edgeLimit = Math.min(7200, points.length * 4);
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

function buildDiffraction(points, roots) {
  if (!points.length) return [];
  const peaks = roots.map((root, index) => {
    const kx = root.projected[0] * Math.PI * 2;
    const ky = root.projected[1] * Math.PI * 2;
    let real = 0;
    let imaginary = 0;
    for (const point of points) {
      const phase = kx * point.projected[0] + ky * point.projected[1];
      real += Math.cos(phase);
      imaginary += Math.sin(phase);
    }
    const intensity = (real * real + imaginary * imaginary) / (points.length * points.length);
    return {
      index,
      projected: [...root.projected],
      radius: root.physicalRadius,
      intensity,
      normSq: root.normSq,
    };
  });
  const maxRadius = Math.max(...peaks.map(peak => peak.radius), 1);
  const maxIntensity = Math.max(...peaks.map(peak => peak.intensity), EPSILON);
  return peaks
    .map(peak => ({
      ...peak,
      normalized: [peak.projected[0] / maxRadius, peak.projected[1] / maxRadius],
      strength: Math.sqrt(peak.intensity / maxIntensity),
    }))
    .sort((a, b) => b.strength - a.strength || a.radius - b.radius);
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

function gridKey(point, cellSize) {
  return `${Math.floor(point[0] / cellSize)},${Math.floor(point[1] / cellSize)}`;
}

function modulo(value, divisor) {
  return ((value % divisor) + divisor) % divisor;
}

function roundHalf(value) {
  return Math.round(value * 2) / 2;
}
