import * as THREE from 'three';

// Keep the view router synchronous while a non-default renderer module loads.
// A disposed proxy never constructs a late view, which prevents rapid switches
// from resurrecting old WebGL resources.
export function createDeferredView({ name, load, options, onReady, onError }) {
  const object3d = new THREE.Group();
  object3d.name = `${name}-loading`;
  let actual = null;
  let resolvedFactory = null;
  let disposed = false;
  let pendingPalette = options.palette;

  const proxy = {
    name,
    object3d,
    get realView() { return actual; },
    get resolvedFactory() { return resolvedFactory; },
    update(...args) { actual?.update?.(...args); },
    onClick(...args) { return actual?.onClick?.(...args); },
    onHover(...args) { return actual?.onHover?.(...args); },
    onPaletteChange(palette) {
      pendingPalette = palette;
      if (actual?.onPaletteChange) actual.onPaletteChange(palette);
    },
    getProjectedVertices(...args) { return actual?.getProjectedVertices?.(...args); },
    getConstruction(...args) { return actual?.getConstruction?.(...args); },
    dispose() {
      disposed = true;
      actual?.dispose?.();
      actual = null;
      object3d.clear();
    },
  };
  proxy.ready = load().then(factory => {
    if (disposed) return false;
    resolvedFactory = factory;
    const next = factory({ ...options, palette: pendingPalette });
    if (disposed) {
      next.dispose?.();
      return false;
    }
    actual = next;
    object3d.add(next.object3d);
    onReady?.(proxy);
    return true;
  }).catch(error => {
    if (!disposed) onError?.(error, proxy);
    return false;
  });
  return proxy;
}
