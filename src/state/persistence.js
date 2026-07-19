// persistence.js — save/restore user configuration across sessions
//
// Three ways to persist:
//   1. localStorage (auto-save on every param change, restore on next visit)
//   2. URL hash (shareable link: #config=<base64-json>)
//   3. Manual copy/paste (exportConfig() / importConfig() return strings)

const STORAGE_KEY = 'e8_studio_config_v1';

// Params we DO want to save (user preferences)
const PERSISTABLE = new Set([
  'view', 'shape', 'dynkin', 'poly4d', 'palette', 'colorBy', 'autoSliders',
  'opacity', 'rotationSpeed',
  'autoRotate', 'cameraOrbit', 'autoZoom', 'showEdges', 'showRings', 'showPetrie',
  'showAmbient', 'fxMode', 'fxByView', 'fxIntensity', 'advancedStyle',
  'lightAmbient', 'lightKey', 'lightFill', 'lightAccent',
  // Pickup round 2 additions — all of these should persist across reloads
  'bgMode', 'bgIntensity', 'theme', 'layout',
  'bloomAmount', 'bloomAuto', 'bloomSpeed',
  'bloomMandelbox', 'bloomMandelboxScale', 'bloomMandelboxIters', 'bloomMandelboxMix',
  'h4TwinReveal', 'e8Twin600', 'cartanHighlight',
  'shiftMode', 'shiftSpeed',
  'morph4d', 'polyProjectionVersion', 'polyRotXY', 'polyRotZW', 'polyAutoRotate', 'polyRotationSpeed',
  'shapeTwist', 'shapeSpike', 'shapeJitter',
  'polyRotXZ', 'polyRotYW',  // Round 9: extra 4D rotation planes
  'polyRotXW', 'polyRotYZ',  // Round 10: complete all 6 planes of ℝ⁴
  'e8ViewMode', 'e8Spin', 'e8Tilt', 'e8Roll', 'e8AutoRotate',
  'e8MorphT', 'e8ProjectionAuto', 'rootHaloDepth',
  'rootDiffusionSpeed', 'showWeylMirrors', 'weylOrbit', 'weylOrbitFast',
  'showInspector', 'compareMode',
  'sdfSphereR', 'sdfBlend', 'sdfBloom', 'sdfAniso', 'sdfEdges',
  'seed',
  'cameraSpeed', 'cameraDistance', 'cameraRotation',
  'cameraBookmarks', 'compareShape', 'presentationMode', 'teachingMode',
  'adaptivePixelRatio',
  'showStarfield', // legacy — kept for backward-compat reads
  'galleryPreset',
  'mobileQuality', 'reducedMode', 'firstVisualMode', 'activeUnlock',
  // Video export preferences (duration / resolution / fps) — remembered so a
  // re-open of the export modal shows the last choice.
  'clipDuration', 'clipResolution', 'clipFps', 'clipMotionScale',
]);
// Params we DON'T save (session-only).
// Bug fix 2026-06-25: 'intro' was previously listed in PERSISTABLE *and* SKIP
// (SKIP wins, so it never persisted) — a dead/confusing entry. Removed from
// PERSISTABLE above; kept here for clarity since loadConfig could otherwise
// restore a stale 'intro: false' from an older session's localStorage.
const SKIP = new Set(['intro', 'paused']);

let saveTimer = null;
let pendingSave = null;
let onLoadCallback = null;

function configSnapshot(params) {
  const toSave = {};
  for (const k of Object.keys(params)) {
    if (!SKIP.has(k) && PERSISTABLE.has(k)) toSave[k] = params[k];
  }
  return JSON.parse(JSON.stringify(toSave));
}

/** Save current params to localStorage (debounced). */
export function saveConfig(params) {
  if (typeof localStorage === 'undefined') return;
  pendingSave = configSnapshot(params);
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(pendingSave || {}));
      pendingSave = null;
    } catch (e) {
      console.warn('localStorage save failed:', e);
    }
  }, 250);
}

/** Load saved config from localStorage. Returns null if none. */
export function loadConfig() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('localStorage load failed:', e);
    return null;
  }
}

/** Clear saved config from localStorage. */
export function clearConfig() {
  if (typeof localStorage === 'undefined') return;
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
}

/** Export current params to a base64-encoded URL-safe string. */
export function exportConfig(params) {
  const toSave = configSnapshot(params);
  // JSON → base64 (URL-safe)
  const json = JSON.stringify(toSave);
  const b64 = btoa(unescape(encodeURIComponent(json)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return b64;
}

/** Import config from a base64 string. Returns null on parse error. */
export function importConfig(s) {
  try {
    // Add padding back
    let b64 = s.replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    const json = decodeURIComponent(escape(atob(b64)));
    return JSON.parse(json);
  } catch (e) {
    console.warn('Failed to import config:', e);
    return null;
  }
}

/** Build a shareable URL with the config embedded in the hash. */
export function buildShareUrl(params, baseUrl) {
  const code = exportConfig(params);
  const u = new URL(baseUrl || window.location.href);
  u.hash = 'config=' + code;
  return u.toString();
}

/** Read config from the URL hash. Returns null if absent or invalid. */
export function readUrlConfig() {
  if (typeof window === 'undefined') return null;
  const h = window.location.hash;
  if (!h || !h.startsWith('#config=')) return null;
  return importConfig(h.slice('#config='.length));
}

/** Auto-save: call once with current params, and again whenever they change. */
export function startAutoSave(getParams) {
  // Save on every param change (debounced inside saveConfig)
  if (typeof window === 'undefined') return;
  // Save on visibility change (mobile) and unload
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') saveConfig(getParams());
  });
  window.addEventListener('beforeunload', () => saveConfig(getParams()));
}

// Imported config can come from an UNTRUSTED source — the `#config=` share-link
// hash is attacker-controllable, and several params (shape, poly4d, dynkin, …)
// are interpolated into innerHTML by the HUD. All legitimate string values are
// simple identifiers/enums, so we reject any string containing characters that
// could carry markup. This is the chokepoint every load path funnels through
// (readUrlConfig, loadConfig, and the paste importer all call applyConfig).
const SAFE_STRING = /^[\w .:+/\-]{0,80}$/;

function sanitizeConfigValue(v) {
  if (typeof v === 'string') return SAFE_STRING.test(v) ? v : undefined;
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'boolean') return v;
  // Arrays/objects (e.g. cameraBookmarks) are never used as HTML; pass through.
  if (v && typeof v === 'object') return v;
  return undefined;
}

/** Apply a saved config to a params object, preserving non-persistent fields. */
export function applyConfig(target, source) {
  if (!source) return target;
  for (const k of Object.keys(source)) {
    if (!PERSISTABLE.has(k)) continue;
    const clean = sanitizeConfigValue(source[k]);
    if (clean !== undefined) target[k] = clean;
  }
  return target;
}

/** Show a brief "saved" indicator (creates + removes a small DOM element). */
export function showSavedToast(msg) {
  let toast = document.getElementById('e8-saved-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'e8-saved-toast';
    toast.className = 'saved-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg || 'Saved';
  toast.classList.add('visible');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => toast.classList.remove('visible'), 1500);
}
