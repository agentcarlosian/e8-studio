// A linked, deliberately schematic reading of one finite E8 cut-and-project
// patch. The window thumbnail shows two coordinates of the hidden 6D space;
// diffraction is the finite patch's computed structure factor.
import { generateE8Quasicrystal } from '../math/e8-quasicrystal.js';

const DIFFRACTION_DELTA_THRESHOLD = 0.0005; // 0.05 percentage point of normalized intensity
const MAX_HIGHLIGHTED_SAMPLES = 16;

export function compareQuasicrystalPatches(baseline, current) {
  // sourceIndex is only an index within one reach's candidate list. The same
  // lattice vector has a different index when a larger reach adds candidates.
  const latticeKey = point => point.coords.join(',');
  const before = new Set(baseline.points.map(latticeKey));
  const after = new Set(current.points.map(latticeKey));
  const added = current.points.filter(point => !before.has(latticeKey(point)));
  const removed = baseline.points.filter(point => !after.has(latticeKey(point)));
  const oldPeaks = new Map(baseline.diffraction.map(peak => [peak.index, peak.intensity]));
  const changed = current.diffraction.map(peak => ({
    index: peak.index,
    delta: Math.abs(peak.intensity - (oldPeaks.get(peak.index) ?? 0)),
  })).filter(peak => peak.delta >= DIFFRACTION_DELTA_THRESHOLD)
    .sort((a, b) => b.delta - a.delta || a.index - b.index);
  const changedPeakIds = new Set(changed.map(peak => peak.index));
  const highlightedPeakIds = new Set(changed.slice(0, MAX_HIGHLIGHTED_SAMPLES).map(peak => peak.index));
  return { added, removed, changedPeaks: changedPeakIds.size, changedPeakIds, highlightedPeakIds };
}

export function quasicrystalComparisonScales(baseline, current, removed = []) {
  // Keep the visible-plane scale steady across window and phason changes,
  // while allowing a reach change to reveal the larger finite patch.
  const pattern = Math.max(baseline.displayScale, current.displayScale);
  // A point that left the six-dimensional window may lie beyond the current
  // two-coordinate circle. Fit it too, then draw the circle at its true size.
  const window = removed.reduce((extent, point) => Math.max(extent,
    Math.hypot(point.internal2[0] - current.phason, point.internal2[1])), current.windowRadius);
  return { pattern, window };
}

export function createQuasicrystalComparison(mount, e8) {
  const host = document.createElement('section');
  host.className = 'quasi-comparison';
  host.hidden = true;
  host.setAttribute('aria-label', 'Linked quasicrystal comparison');
  host.innerHTML = `
    <header class="quasi-comparison-head">
      <div><span>ONE CUT · THREE READINGS</span><h2>Compare the same E8 patch</h2></div>
      <button type="button" data-act="toggleQuasiComparison" aria-label="Close comparison">×</button>
    </header>
    <p class="quasi-comparison-intro">Move Window or Phason in View. All three diagrams use the same selection rule.</p>
    <div class="quasi-comparison-stats" role="status" aria-live="polite" aria-atomic="true"></div>
    <div class="quasi-comparison-grid">
      <button type="button" data-act="setQuasiMode" data-arg="pattern" data-quasi-mode="pattern">
        <canvas data-quasi-canvas="pattern" aria-hidden="true"></canvas><strong>Pattern</strong><small>Accepted points in the visible plane</small>
      </button>
      <button type="button" data-act="setQuasiMode" data-arg="window" data-quasi-mode="window">
        <canvas data-quasi-canvas="window" aria-hidden="true"></canvas><strong>Window</strong><small>Two of six hidden coordinates</small>
      </button>
      <button type="button" data-act="setQuasiMode" data-arg="diffraction" data-quasi-mode="diffraction">
        <canvas data-quasi-canvas="diffraction" aria-hidden="true"></canvas><strong>Diffraction</strong><small>Sampled intensity: size and brightness</small>
      </button>
    </div>
    <div class="quasi-comparison-foot"><span><i class="quasi-added"></i> entered <i class="quasi-removed"></i> left since baseline</span><button type="button" data-act="resetQuasiComparisonBaseline">Use current as baseline</button></div>
    <p class="quasi-comparison-scope">Studio's six-dimensional window is spherical; only two coordinates are shown. Its circle shrinks to fit departures. Size and brightness encode finite-patch intensity; teal rings mark up to 16 largest changes.</p>`;
  mount.appendChild(host);

  let open = false;
  let currentView = 'quasicrystal';
  let baseline = null;
  let latest = null;
  let latestParams = null;
  let pendingFrame = 0;

  function patchFor(params) {
    return generateE8Quasicrystal(e8, {
      maxNormSq: params.quasiReach,
      windowRadius: params.quasiWindow,
      phason: params.quasiPhason,
      includeDiffraction: true,
      includeEdges: false,
    });
  }

  function paint(canvas, points, position, { highlighted = [], departed = [], windowGuideRadius = 0, intensity = false } = {}) {
    const width = Math.max(120, Math.round(canvas.getBoundingClientRect().width || 180));
    const height = 100;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = '#080a12';
    ctx.fillRect(0, 0, width, height);
    const size = Math.min(width * 0.43, height * 0.43);
    const dot = (point, color, radius, outline = false) => {
      const xy = position(point);
      ctx.beginPath();
      ctx.arc(width / 2 + xy[0] * size, height / 2 - xy[1] * size, radius, 0, Math.PI * 2);
      if (outline) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.2;
        ctx.stroke();
      } else {
        ctx.fillStyle = color;
        ctx.fill();
      }
    };
    if (windowGuideRadius) {
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, windowGuideRadius * size, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(249, 208, 111, .68)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    if (intensity) {
      const markerSize = peak => 0.75 + 3.2 * Math.max(0, Math.min(1, peak.strength));
      for (const peak of points) {
        const strength = Math.max(0, Math.min(1, peak.strength));
        dot(peak, `rgba(249, 208, 111, ${0.18 + 0.72 * strength})`, markerSize(peak));
      }
      for (const peak of highlighted) dot(peak, '#6ce3d2', markerSize(peak) + 1.4, true);
      return;
    }
    for (const point of points) dot(point, 'rgba(249, 208, 111, .60)', 1.1);
    for (const point of departed) dot(point, '#fb825d', 2.1);
    for (const point of highlighted) dot(point, '#6ce3d2', 2.1);
  }

  function render() {
    if (!open || currentView !== 'quasicrystal' || !latest) return;
    const delta = compareQuasicrystalPatches(baseline, latest);
    host.querySelector('.quasi-comparison-stats').textContent =
      `${latest.pointCount} accepted of ${latest.candidateCount} tested · +${delta.added.length} entered · −${delta.removed.length} left · ${delta.changedPeaks}/${latest.diffraction.length} intensities changed (≥0.05 percentage point)`;
    host.querySelectorAll('[data-quasi-mode]').forEach(button => {
      const active = button.dataset.quasiMode === latestParams.quasiMode;
      button.setAttribute('aria-pressed', String(active));
      button.classList.toggle('active', active);
    });
    const scales = quasicrystalComparisonScales(baseline, latest, delta.removed);
    const patternPosition = point => point.projected.map(value => value / scales.pattern);
    const windowPosition = point => [
      (point.internal2[0] - latest.phason) / scales.window,
      point.internal2[1] / scales.window,
    ];
    paint(host.querySelector('[data-quasi-canvas="pattern"]'), latest.points,
      patternPosition, { highlighted: delta.added, departed: delta.removed });
    paint(host.querySelector('[data-quasi-canvas="window"]'), latest.points,
      windowPosition, { highlighted: delta.added, departed: delta.removed,
        windowGuideRadius: latest.windowRadius / scales.window });
    paint(host.querySelector('[data-quasi-canvas="diffraction"]'), latest.diffraction,
      peak => peak.normalized, { intensity: true,
        highlighted: latest.diffraction.filter(peak => delta.highlightedPeakIds.has(peak.index)) });
  }

  function update(params) {
    if (!open || currentView !== 'quasicrystal') return;
    latestParams = { ...params };
    if (pendingFrame) cancelAnimationFrame(pendingFrame);
    pendingFrame = requestAnimationFrame(() => {
      pendingFrame = 0;
      try {
        latest = patchFor(latestParams);
        if (!baseline) baseline = latest;
        render();
      } catch (error) {
        host.querySelector('.quasi-comparison-stats').textContent = `Comparison unavailable: ${error.message}`;
      }
    });
  }

  function setView(view, params) {
    currentView = view;
    host.hidden = !open || view !== 'quasicrystal';
    mount.classList.toggle('quasi-comparing', !host.hidden);
    if (!host.hidden) update(params);
  }

  function show(params) {
    open = true;
    baseline = null;
    setView('quasicrystal', params);
  }

  function hide() {
    open = false;
    host.hidden = true;
    mount.classList.remove('quasi-comparing');
    if (pendingFrame) cancelAnimationFrame(pendingFrame);
    pendingFrame = 0;
  }

  function resetBaseline() {
    if (pendingFrame) {
      cancelAnimationFrame(pendingFrame);
      pendingFrame = 0;
      latest = patchFor(latestParams);
    }
    if (!latest) return;
    baseline = latest;
    render();
  }

  window.addEventListener('resize', render);
  return { show, hide, update, setView, resetBaseline,
    focusClose() { host.querySelector('.quasi-comparison-head button')?.focus({ preventScroll: true }); },
    get open() { return open; } };
}
