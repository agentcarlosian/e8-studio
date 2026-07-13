// tour.js — Guided tour runtime for E8 ⇄ Platonics Studio.
//
// Why this exists:
//   Track 4b (Pickup round 2) — a "tour mode" that auto-cycles through views,
//   narrating each with an essay from src/content/essays.js. Triggered by
//   pressing T or clicking the panel button.
//
// How it works:
//   - TOUR_STOPS is imported from content/essays.js — each stop has
//     {view, seconds, essay, params}.
//   - On start: switch to first stop's view, set its params, open the essay
//     panel with the matching essay, schedule next stop after `seconds`.
//   - On tick: re-render the overlay with progress bar + stop counter.
//   - On stop/escape: clean up timers, restore panel state.
//
// Usage:
//   import { startTour, stopTour, isTourActive } from './ui/tour.js';
//   startTour(app);
//   if (isTourActive()) stopTour();

import { TOUR_STOPS, ESSAYS } from '../content/essays.js';

let _tourTimer = null;          // advance timer (null when paused OR stopped)
let _tourTickTimer = null;      // progress-bar tick interval
let _tourCycleTimer = null;     // param-cycle interval (drives `cycle` stops)
let _tourCycleIdx = 0;          // current index into the active cycle's values
let _tourStopStartedAt = 0;     // performance.now() when the current stop began
let _tourPausedAt = 0;          // when the current pause began (0 = not paused)
let _tourPausedDuration = 0;    // total ms spent paused during this stop
let _tourRemainingMs = 0;       // ms left when paused (used to re-arm the timer)
let _tourCurrentStop = 0;
let _tourApp = null;
let _tourOverlayEl = null;
let _tourPrevEssayOpen = false;
let _tourPrevView = null;
let _tourRunning = false;       // true for the whole session (playing OR paused)

export function isTourActive() {
  return _tourRunning;
}

export function isTourPaused() {
  return _tourRunning && _tourTimer === null;
}

export function startTour(app) {
  if (isTourActive()) return;  // already running
  _tourApp = app;
  _tourCurrentStop = 0;
  _tourRunning = true;
  _tourStopStartedAt = performance.now();
  // Save state we want to restore on stop
  _tourPrevEssayOpen = !!app?._essayPanel?.open;
  _tourPrevView = app?.params?.view || null;
  // Inject overlay UI
  _ensureOverlay();
  _showOverlay();
  _advanceToStop(0);
}

export function stopTour() {
  _tourRunning = false;
  if (_tourTimer) { clearTimeout(_tourTimer); _tourTimer = null; }
  if (_tourTickTimer) { clearInterval(_tourTickTimer); _tourTickTimer = null; }
  if (_tourCycleTimer) { clearInterval(_tourCycleTimer); _tourCycleTimer = null; }
  _tourPausedAt = 0;
  _tourPausedDuration = 0;
  _tourRemainingMs = 0;
  _tourCycleIdx = 0;
  _hideOverlay();
  if (_tourApp && _tourPrevView) {
    try { _tourApp.switchView(_tourPrevView); } catch {}
  }
  if (_tourApp?._essayPanel) {
    _tourApp._essayPanel.open = _tourPrevEssayOpen;
    try { _tourApp._essayPanel.render(); } catch {}
  }
  _tourApp = null;
  _tourCurrentStop = 0;
}

/**
 * Freeze the tour on the current stop: clear the advance timer (so it doesn't
 * move on) and the progress bar stops filling. Resume via resumeTour().
 */
export function pauseTour() {
  if (!_tourRunning || _tourTimer === null) return;  // not playing
  const stop = TOUR_STOPS[_tourCurrentStop];
  if (!stop) return;
  // Capture how much time remained on the advance timer.
  const elapsedMs = performance.now() - _tourStopStartedAt - _tourPausedDuration;
  const totalMs = (stop.seconds || 8) * 1000;
  _tourRemainingMs = Math.max(0, totalMs - elapsedMs);
  clearTimeout(_tourTimer);
  _tourTimer = null;
  // Freeze the param cycle too (so a cycling stop holds its current shape).
  if (_tourCycleTimer) { clearInterval(_tourCycleTimer); _tourCycleTimer = null; }
  _tourPausedAt = performance.now();
  _updateOverlay();  // refresh button label + freeze the bar
}

/**
 * Resume from a paused state: re-arm the advance timer with the remaining time
 * and restart the progress-bar tick. No-op if not paused.
 */
export function resumeTour() {
  if (!_tourRunning || _tourTimer !== null) return;  // not paused
  if (_tourPausedAt) {
    _tourPausedDuration += performance.now() - _tourPausedAt;
    _tourPausedAt = 0;
  }
  // Re-arm with whatever time was left when paused.
  _tourTimer = setTimeout(() => _advanceToStop(_tourCurrentStop + 1), Math.max(200, _tourRemainingMs));
  // Restart the param cycle from where it froze (if this stop has one).
  const stop = TOUR_STOPS[_tourCurrentStop];
  if (stop?.cycle) _startCycle(stop.cycle);
  _updateOverlay();
}

/**
 * Drive a param cycle for the current stop. `cycle` shape:
 *   { param: 'shape', values: ['tetrahedron', 'cube', ...], intervalMs: 2200 }
 * Starting the cycle applies values[_tourCycleIdx] immediately (so a resumed
 * cycle re-applies the shape that was showing when paused), then advances
 * through the rest on an interval. The interval is cleared by stopTour/pause.
 */
function _startCycle(cycle) {
  if (!cycle || !cycle.param || !Array.isArray(cycle.values) || cycle.values.length === 0) return;
  if (_tourCycleTimer) { clearInterval(_tourCycleTimer); _tourCycleTimer = null; }
  const app = _tourApp;
  if (!app) return;
  const intervalMs = Math.max(400, cycle.intervalMs || 2000);
  const apply = () => {
    const v = cycle.values[_tourCycleIdx % cycle.values.length];
    try { app.setParam(cycle.param, v); } catch (e) { console.warn('tour cycle setParam failed:', cycle.param, e); }
    _tourCycleIdx++;
  };
  // Apply the current value immediately, then advance on the interval.
  apply();
  _tourCycleTimer = setInterval(apply, intervalMs);
}

function _advanceToStop(idx) {
  if (idx >= TOUR_STOPS.length) {
    // Natural completion (reached the last stop) — award the "Guided" badge.
    // Manual stop (× button / Esc) goes through stopTour() directly and does
    // NOT award the badge, so the user has to actually sit through the tour.
    const app = _tourApp;
    if (app && typeof app._onTourComplete === 'function') {
      try { app._onTourComplete(); } catch {}
    }
    stopTour();
    return;
  }
  _tourCurrentStop = idx;
  _tourStopStartedAt = performance.now();
  _tourPausedAt = 0;
  _tourPausedDuration = 0;
  _tourRemainingMs = 0;
  // Reset + clear any param cycle from the previous stop.
  _tourCycleIdx = 0;
  if (_tourCycleTimer) { clearInterval(_tourCycleTimer); _tourCycleTimer = null; }
  const stop = TOUR_STOPS[idx];
  const app = _tourApp;
  if (!app) return;
  // 1. Switch view
  if (typeof app.switchView === 'function') {
    try { app.switchView(stop.view); } catch (e) { console.warn('tour view switch failed:', e); }
  }
  // 2. Apply stop params (set one at a time so each triggers refresh)
  if (stop.params) {
    for (const [k, v] of Object.entries(stop.params)) {
      try { app.setParam(k, v); } catch (e) { console.warn('tour setParam failed:', k, e); }
    }
  }
  // 3. Open the essay panel with the matching essay
  if (stop.essay) {
    const e = ESSAYS[stop.essay];
    if (e && typeof app.toggleEssay === 'function') {
      app.toggleEssay();
    }
    // Drive the essay panel's view+index directly so the right essay shows.
    // EssayPanel.setView + .index are public; we expose them via a small adapter.
    if (app._essayPanel && typeof app._essayPanel.setEssayById === 'function') {
      app._essayPanel.setEssayById(stop.essay);
    }
  }
  // 4. Start a param cycle if this stop defines one (e.g. cycling through the
  //    Platonic solids during the "Platonic duals" stop). The first value is
  //    applied immediately; subsequent values advance on intervalMs.
  if (stop.cycle) _startCycle(stop.cycle);
  // 5. Update overlay
  _updateOverlay();
  // 6. Schedule next stop
  if (_tourTimer) clearTimeout(_tourTimer);
  _tourTimer = setTimeout(() => _advanceToStop(idx + 1), (stop.seconds || 8) * 1000);
  // 7. Tick overlay (progress bar)
  if (_tourTickTimer) clearInterval(_tourTickTimer);
  _tourTickTimer = setInterval(_updateOverlay, 100);
}

function _ensureOverlay() {
  if (_tourOverlayEl) return;
  _tourOverlayEl = document.createElement('div');
  _tourOverlayEl.id = 'tour-overlay';
  _tourOverlayEl.innerHTML = `
    <div class="tour-bar">
      <button class="tour-pause" title="Pause (Space or click)">❚❚</button>
      <div class="tour-meta">
        <div class="tour-counter">— / —</div>
        <div class="tour-title">—</div>
      </div>
      <div class="tour-progress"><div class="tour-progress-fill"></div></div>
      <button class="tour-exit" title="Stop tour (T or Esc)">×</button>
    </div>
  `;
  document.body.appendChild(_tourOverlayEl);
  const exit = _tourOverlayEl.querySelector('.tour-exit');
  if (exit) exit.onclick = () => stopTour();
  const pause = _tourOverlayEl.querySelector('.tour-pause');
  if (pause) pause.onclick = () => { isTourPaused() ? resumeTour() : pauseTour(); };
}

function _showOverlay() {
  if (_tourOverlayEl) _tourOverlayEl.classList.add('tour-on');
}

function _hideOverlay() {
  if (_tourOverlayEl) _tourOverlayEl.classList.remove('tour-on');
}

function _updateOverlay() {
  if (!_tourOverlayEl) return;
  const stop = TOUR_STOPS[_tourCurrentStop];
  if (!stop) return;
  const essay = ESSAYS[stop.essay];
  const counter = _tourOverlayEl.querySelector('.tour-counter');
  const title = _tourOverlayEl.querySelector('.tour-title');
  const fill = _tourOverlayEl.querySelector('.tour-progress-fill');
  const pauseBtn = _tourOverlayEl.querySelector('.tour-pause');
  if (counter) counter.textContent = `Stop ${_tourCurrentStop + 1} / ${TOUR_STOPS.length}`;
  if (title) title.textContent = essay ? essay.title : stop.view;
  if (fill) {
    // Elapsed time minus any time spent paused, so the bar freezes while paused
    // and resumes smoothly from the same spot.
    const pausedNow = _tourPausedAt ? (performance.now() - _tourPausedAt) : 0;
    const elapsed = (performance.now() - _tourStopStartedAt - _tourPausedDuration - pausedNow) / 1000;
    const pct = Math.min(100, Math.max(0, (elapsed / (stop.seconds || 8)) * 100));
    fill.style.width = pct.toFixed(1) + '%';
  }
  // Toggle the pause/resume button label + title.
  if (pauseBtn) {
    const paused = isTourPaused();
    pauseBtn.textContent = paused ? '▶' : '❚❚';
    pauseBtn.title = paused ? 'Resume (Space or click)' : 'Pause (Space or click)';
  }
}
