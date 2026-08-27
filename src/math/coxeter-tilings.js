// coxeter-tilings.js — dual multigrid tilings derived from rank-2 roots.
//
// A rank-2 root system supplies a finite set of unoriented root directions.
// Copy each direction into an evenly spaced family of parallel lines, find the
// crossings between every pair of families, then dualize each crossing to one
// rhombus. Three families reproduce a periodic lozenge lattice; four, five,
// and six families expose octagonal, decagonal, and dodecagonal local order.
// H2's fivefold case is the classic pentagrid route to a Penrose-like tiling.

import { generateRank2RootSystem } from './rank2-roots.js';

const TILING_EPSILON = 1e-8;
const TILING_GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export const COXETER_TILING_ORDER = Object.freeze(['A2', 'B2', 'G2', 'H2']);

export const COXETER_TILINGS = Object.freeze({
  A2: Object.freeze({
    id: 'A2',
    label: 'A₂',
    name: 'Hexagonal lozenge lattice',
    order: 6,
    periodic: true,
    familyCount: 3,
    description: 'Three root directions dualize to a repeating lattice of 60° and 120° lozenges.',
  }),
  B2: Object.freeze({
    id: 'B2',
    label: 'B₂',
    name: 'Octagonal multigrid',
    order: 8,
    periodic: false,
    familyCount: 4,
    description: 'Four mirror families create square and 45° rhombus tiles with eightfold local order.',
  }),
  G2: Object.freeze({
    id: 'G2',
    label: 'G₂',
    name: 'Dodecagonal multigrid',
    order: 12,
    periodic: false,
    familyCount: 6,
    description: 'Six root directions weave rhombi into a dense field with twelvefold local order.',
  }),
  H2: Object.freeze({
    id: 'H2',
    label: 'H₂',
    name: 'Penrose pentagrid',
    order: 10,
    periodic: false,
    familyCount: 5,
    description: 'Five golden-ratio root directions dualize to thick and thin Penrose-like rhombi.',
  }),
});

export function generateCoxeterTiling(systemId = 'H2', options = {}) {
  const meta = COXETER_TILINGS[systemId] || COXETER_TILINGS.H2;
  const density = clampInteger(options.density ?? 5, 2, 8);
  const phase = Number.isFinite(Number(options.phase)) ? Number(options.phase) : 0;
  const rootSystem = generateRank2RootSystem(meta.id);
  const directions = rootSystem.roots
    .filter(root => root.angle < Math.PI - TILING_EPSILON)
    .map(root => unit(root.vector));
  const offsets = multigridOffsets(directions.length, phase);
  const extent = density + 0.35;
  const indexLimit = density + 2;
  const rawTiles = [];
  const rawLines = [];

  for (let family = 0; family < directions.length; family++) {
    const normal = directions[family];
    for (let index = -indexLimit; index <= indexLimit; index++) {
      const distance = index + offsets[family];
      const segment = lineCircleSegment(normal, distance, extent);
      if (segment) rawLines.push({ family, index, points: segment });
    }
  }

  for (let familyA = 0; familyA < directions.length; familyA++) {
    for (let familyB = familyA + 1; familyB < directions.length; familyB++) {
      const normalA = directions[familyA];
      const normalB = directions[familyB];
      for (let indexA = -indexLimit; indexA <= indexLimit; indexA++) {
        for (let indexB = -indexLimit; indexB <= indexLimit; indexB++) {
          const crossing = intersectLines(
            normalA,
            indexA + offsets[familyA],
            normalB,
            indexB + offsets[familyB],
          );
          if (!crossing || tilingLength(crossing) > extent) continue;
          const coordinates = directions.map((normal, family) => {
            if (family === familyA) return indexA;
            if (family === familyB) return indexB;
            return Math.ceil(tilingDot(crossing, normal) - offsets[family] - TILING_EPSILON);
          });
          const origin = coordinates.reduce((sum, coefficient, family) => [
            sum[0] + coefficient * directions[family][0],
            sum[1] + coefficient * directions[family][1],
          ], [0, 0]);
          const edgeA = directions[familyA];
          const edgeB = directions[familyB];
          const points = [
            origin,
            add(origin, edgeA),
            add(add(origin, edgeA), edgeB),
            add(origin, edgeB),
          ];
          const center = average(points);
          const angle = acuteAngle(edgeA, edgeB);
          rawTiles.push({
            id: rawTiles.length,
            familyA,
            familyB,
            indexA,
            indexB,
            points,
            center,
            angle,
            angleDegrees: angle * 180 / Math.PI,
            area: Math.abs(polygonArea(points)),
          });
        }
      }
    }
  }

  const normalized = normalizeGeometry(rawTiles, rawLines);
  const vertices = uniqueVertices(normalized.tiles);
  const vertexIndex = new Map(vertices.map(vertex => [pointKey(vertex.point), vertex.id]));
  const tiles = normalized.tiles.map(tile => ({
    ...tile,
    vertexIndices: tile.points.map(point => vertexIndex.get(pointKey(point))),
  }));
  const edges = uniqueEdges(tiles).map(edge => ({
    ...edge,
    indices: edge.points.map(point => vertexIndex.get(pointKey(point))),
  }));
  const angleClasses = uniqueNumbers(tiles.map(tile => tile.angleDegrees), 1e-5)
    .sort((a, b) => a - b);
  const tileTypeCounts = Object.fromEntries(angleClasses.map(angle => [formatAngleKey(angle), 0]));
  for (const tile of tiles) {
    const key = nearestAngleKey(tile.angleDegrees, angleClasses);
    tileTypeCounts[key] = (tileTypeCounts[key] || 0) + 1;
  }

  return {
    ...meta,
    density,
    phase,
    rootSystem,
    directions,
    offsets,
    tiles,
    lines: normalized.lines,
    vertices,
    edges,
    tileCount: tiles.length,
    vertexCount: vertices.length,
    edgeCount: edges.length,
    angleClasses,
    tileTypeCounts,
    goldenRatio: meta.id === 'H2' ? (1 + Math.sqrt(5)) / 2 : null,
  };
}

function multigridOffsets(count, phase) {
  const values = Array.from({ length: count }, (_, index) => (
    0.22 * Math.sin((index + 1) * TILING_GOLDEN_ANGLE + phase)
  ));
  const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(1, count);
  return values.map(value => value - mean);
}

function normalizeGeometry(tiles, lines) {
  if (!tiles.length) return { tiles: [], lines: [] };
  const allPoints = tiles.flatMap(tile => tile.points);
  const minX = Math.min(...allPoints.map(point => point[0]));
  const maxX = Math.max(...allPoints.map(point => point[0]));
  const minY = Math.min(...allPoints.map(point => point[1]));
  const maxY = Math.max(...allPoints.map(point => point[1]));
  const center = [(minX + maxX) / 2, (minY + maxY) / 2];
  const span = Math.max(maxX - minX, maxY - minY, TILING_EPSILON);
  const scale = 2.08 / span;
  const transform = point => [(point[0] - center[0]) * scale, (point[1] - center[1]) * scale];
  return {
    tiles: tiles.map(tile => {
      const points = tile.points.map(transform);
      return {
        ...tile,
        points,
        center: average(points),
        area: Math.abs(polygonArea(points)),
      };
    }),
    lines: normalizeLinesIndependently(lines),
  };
}

function normalizeLinesIndependently(lines) {
  const points = lines.flatMap(line => line.points);
  if (!points.length) return [];
  const radius = Math.max(...points.map(tilingLength), TILING_EPSILON);
  return lines.map(line => ({
    ...line,
    points: line.points.map(point => [point[0] / radius * 1.04, point[1] / radius * 1.04]),
  }));
}

function uniqueVertices(tiles) {
  const byKey = new Map();
  for (const tile of tiles) {
    for (const point of tile.points) {
      const key = pointKey(point);
      if (!byKey.has(key)) byKey.set(key, { id: byKey.size, point });
    }
  }
  return [...byKey.values()];
}

function uniqueEdges(tiles) {
  const byKey = new Map();
  for (const tile of tiles) {
    for (let index = 0; index < tile.points.length; index++) {
      const a = tile.points[index];
      const b = tile.points[(index + 1) % tile.points.length];
      const aKey = pointKey(a);
      const bKey = pointKey(b);
      const key = aKey < bKey ? `${aKey}|${bKey}` : `${bKey}|${aKey}`;
      if (!byKey.has(key)) byKey.set(key, { id: byKey.size, points: [a, b] });
    }
  }
  return [...byKey.values()];
}

function lineCircleSegment(normal, distance, radius) {
  if (Math.abs(distance) > radius) return null;
  const closest = [normal[0] * distance, normal[1] * distance];
  const tangent = [-normal[1], normal[0]];
  const half = Math.sqrt(Math.max(0, radius * radius - distance * distance));
  return [
    [closest[0] - tangent[0] * half, closest[1] - tangent[1] * half],
    [closest[0] + tangent[0] * half, closest[1] + tangent[1] * half],
  ];
}

function intersectLines(normalA, distanceA, normalB, distanceB) {
  const determinant = normalA[0] * normalB[1] - normalA[1] * normalB[0];
  if (Math.abs(determinant) < TILING_EPSILON) return null;
  return [
    (distanceA * normalB[1] - normalA[1] * distanceB) / determinant,
    (normalA[0] * distanceB - distanceA * normalB[0]) / determinant,
  ];
}

function acuteAngle(a, b) {
  const cosine = tilingClamp(Math.abs(tilingDot(a, b)), -1, 1);
  return Math.acos(cosine);
}

function uniqueNumbers(values, epsilon) {
  const unique = [];
  for (const value of values) {
    if (!unique.some(candidate => Math.abs(candidate - value) < epsilon)) unique.push(value);
  }
  return unique;
}

function nearestAngleKey(value, classes) {
  let best = classes[0] ?? value;
  for (const candidate of classes) {
    if (Math.abs(candidate - value) < Math.abs(best - value)) best = candidate;
  }
  return formatAngleKey(best);
}

function formatAngleKey(value) {
  return `${Number(value.toFixed(3))}°`;
}

function pointKey(point) {
  return `${Math.round(point[0] * 1e7)},${Math.round(point[1] * 1e7)}`;
}

function polygonArea(points) {
  let area = 0;
  for (let index = 0; index < points.length; index++) {
    const a = points[index];
    const b = points[(index + 1) % points.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  return area / 2;
}

function average(points) {
  return points.reduce((sum, point) => [sum[0] + point[0], sum[1] + point[1]], [0, 0])
    .map(value => value / Math.max(1, points.length));
}

function unit(vector) {
  const magnitude = tilingLength(vector) || 1;
  return [vector[0] / magnitude, vector[1] / magnitude];
}

function add(a, b) {
  return [a[0] + b[0], a[1] + b[1]];
}

function tilingDot(a, b) {
  return a[0] * b[0] + a[1] * b[1];
}

function tilingLength(vector) {
  return Math.hypot(vector[0], vector[1]);
}

function tilingClamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function clampInteger(value, min, max) {
  return Math.round(tilingClamp(Number(value) || min, min, max));
}
