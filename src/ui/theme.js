// theme.js — Visual theme + layout registry for E8 ⇄ Platonics Studio.
//
// Why this exists:
//   The studio ships with a single dark-gold palette defined as CSS variables
//   on :root in src/assets/style.css. Power users (educators, presenters,
//   print-context reference) want different palettes without touching code.
//
// How it works:
//   - THEMES is a registry of 5 named palettes. Each is a flat map of CSS
//     variable names → values.
//   - applyTheme(name) writes those variables onto document.documentElement
//     at runtime. Existing rules in style.css already reference these vars
//     so the change is immediate and CSS-cascade-friendly.
//   - LAYOUTS mirrors THEMES but writes a body data-layout attribute. CSS
//     rules in style.css branch on [data-layout="..."] for size + chrome
//     visibility. Keeps the JS side free of layout pixel math.
//
// Usage:
//   import { applyTheme, applyLayout, THEMES, LAYOUTS } from './ui/theme.js';
//   applyTheme('paper-ink');
//   applyLayout('wide-canvas');

// Each theme is a complete override of the 13 CSS variables defined in
// src/assets/style.css :root. Values chosen to be readable across views and
// not fight the 3D content's own palette.
export const THEMES = {
  // The original studio palette — dark navy with warm gold accents.
  'dark-gold': {
    '--bg-0': '#07070c',
    '--bg-1': '#0e0e16',
    '--bg-2': '#161622',
    '--bg-3': '#1d1d2c',
    '--line': '#2a2a3a',
    '--line-soft': '#1d1d2c',
    '--ink-0': '#f4f1ea',
    '--ink-1': '#c9c5b9',
    '--ink-2': '#7a7669',
    '--ink-3': '#4a4740',
    '--accent':   '#f4d27a',
    '--accent-2': '#e8a96a',
    '--accent-3': '#c98aff',
    '--accent-4': '#6affe8',
  },
  // High-contrast paper / ink — for screenshots, talks, accessibility.
  'paper-ink': {
    '--bg-0': '#fbf8f1',
    '--bg-1': '#f4efe2',
    '--bg-2': '#ebe5d3',
    '--bg-3': '#dcd5bf',
    '--line': '#9a907a',
    '--line-soft': '#cdc4ab',
    '--ink-0': '#1a1814',
    '--ink-1': '#3a3528',
    '--ink-2': '#5a5240',
    '--ink-3': '#7a7060',
    '--accent':   '#b8881a',
    '--accent-2': '#a06a18',
    '--accent-3': '#7a3aaa',
    '--accent-4': '#1a8a78',
  },
  // Cyberpunk neon — for gallery presets and code-art moods.
  'neon-cyber': {
    '--bg-0': '#02020a',
    '--bg-1': '#08081a',
    '--bg-2': '#101028',
    '--bg-3': '#1a1a3a',
    '--line': '#3a2a6a',
    '--line-soft': '#1a1a3a',
    '--ink-0': '#e8f4ff',
    '--ink-1': '#a8c0e0',
    '--ink-2': '#6878a0',
    '--ink-3': '#404868',
    '--accent':   '#00ffe8',
    '--accent-2': '#ff0090',
    '--accent-3': '#a800ff',
    '--accent-4': '#ffe800',
  },
  // Pure dark — minimal chrome, lets the 3D content dominate.
  'pure-dark': {
    '--bg-0': '#000000',
    '--bg-1': '#080808',
    '--bg-2': '#101010',
    '--bg-3': '#181818',
    '--line': '#282828',
    '--line-soft': '#181818',
    '--ink-0': '#ffffff',
    '--ink-1': '#d0d0d0',
    '--ink-2': '#808080',
    '--ink-3': '#505050',
    '--accent':   '#ffffff',
    '--accent-2': '#d0d0d0',
    '--accent-3': '#a0a0a0',
    '--accent-4': '#e0e0e0',
  },
  // Solarized — academic reference palette by Ethan Schoonover.
  'solarized': {
    '--bg-0': '#002b36',  // base03
    '--bg-1': '#073642',  // base02
    '--bg-2': '#586e75',  // base01
    '--bg-3': '#657b83',  // base00
    '--line': '#93a1a1',
    '--line-soft': '#586e75',
    '--ink-0': '#fdf6e3',  // base3
    '--ink-1': '#eee8d5',  // base2
    '--ink-2': '#839496',  // base0
    '--ink-3': '#586e75',
    '--accent':   '#b58900',  // yellow
    '--accent-2': '#cb4b16',  // orange
    '--accent-3': '#6c71c4',  // violet
    '--accent-4': '#2aa198',  // cyan
  },
};

export const THEME_NAMES = Object.keys(THEMES);
export const DEFAULT_THEME = 'dark-gold';

/**
 * Apply a theme by name. Writes the theme's CSS variables onto
 * document.documentElement, immediately restyling the entire app.
 * Unknown names silently fall back to DEFAULT_THEME.
 */
export function applyTheme(name) {
  const theme = THEMES[name] || THEMES[DEFAULT_THEME];
  const root = document.documentElement;
  for (const [prop, val] of Object.entries(theme)) {
    root.style.setProperty(prop, val);
  }
  // Mark which theme is active for CSS rules that need to branch on it.
  root.setAttribute('data-theme', name in THEMES ? name : DEFAULT_THEME);
}

// ── Display labels (audit #10) ─────────────────────────────────────────
// Theme and layout IDs are stable internal names. Display labels are what
// the panel shows in buttons. Keeping them separate means the labels can
// change without breaking saved configs / URL params / share links.
export const THEME_LABELS = {
  'dark-gold':  'Dark',
  'paper-ink':  'Light',
  'neon-cyber': 'Neon',
  'pure-dark':  'Mono',
  'solarized':  'Solar',
};

// ── Layout modes ──
// Layouts are driven by a `data-layout` attribute on <body>. CSS rules in
// style.css branch on this attribute. JS doesn't need to know pixel values.
//
// DEFAULT_LAYOUT is 'wide-canvas' (Part A, 2026-06-27): the studio ships with
// the wide-canvas layout (no footer, more vertical canvas) as the out-of-box
// experience, and the Layout picker was removed from the panel. LAYOUTS still
// lists every mode so saved configs / URL params referencing 'default' or
// 'compact' resolve correctly — applyLayout() falls back to DEFAULT_LAYOUT for
// any unknown name. 'presentation' is reachable only via the Full-screen button.
export const LAYOUTS = ['default', 'compact', 'wide-canvas', 'presentation'];
export const DEFAULT_LAYOUT = 'wide-canvas';

export const LAYOUT_LABELS = {
  'default':       'Default',
  'compact':       'Compact',
  'wide-canvas':   'Wide canvas',
  'presentation':  'Presentation',
};

export const LAYOUT_DESCRIPTIONS = {
  'default':       'Standard 280px sidebar, header, footer',
  'compact':       '220px sidebar, smaller header/footer',
  'wide-canvas':   '220px sidebar, header, NO footer — more canvas',
  'presentation':  'Full-screen canvas (no chrome)',
};

/**
 * Apply a layout by name. Sets body[data-layout] which CSS rules branch on.
 * 'presentation' also toggles the legacy 'presentation-mode' class for
 * backwards compat with the CSS rules already shipping in style.css.
 *
 * Unknown names (and the now-removed-as-default 'default') fall back to
 * DEFAULT_LAYOUT ('wide-canvas') — see LAYOUTS above.
 */
export function applyLayout(name) {
  if (!LAYOUTS.includes(name) || name === 'default') name = DEFAULT_LAYOUT;
  document.body.setAttribute('data-layout', name);
  document.body.classList.toggle('presentation-mode', name === 'presentation');
}
