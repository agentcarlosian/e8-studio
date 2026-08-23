// Pure policy for isolating selection-owned state when switching renderers.

import { createViewSelectionReset } from './selection-policy.js';

export function planViewTransition(params, fromView, toView, options = {}) {
  if (!fromView || fromView === toView) return { changed: false, resetCamera: false };
  if (options.resetSelection === false) {
    return { changed: true, resetCamera: false, patch: {} };
  }
  return {
    changed: true,
    resetCamera: true,
    patch: createViewSelectionReset(toView, params),
  };
}
