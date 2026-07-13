// Pure policy for isolating motion controllers when switching renderers.

export function planViewTransition(params, fromView, toView) {
  if (!fromView || fromView === toView) return { changed: false, resetCamera: false };
  const resetCamera = !!(params.cameraOrbit
    || params.autoZoom
    || (params.cameraPath && params.cameraPath !== 'manual'));
  return {
    changed: true,
    resetCamera,
    patch: {
      cameraOrbit: false,
      autoZoom: false,
      cameraPath: 'manual',
      autoRotate: false,
      bloomAuto: false,
      polyAutoRotate: false,
      e8ProjectionAuto: false,
      weylOrbit: false,
      weylOrbitFast: false,
      autoSliders: (params.autoSliders || []).filter(key => key === 'e8MorphT'),
    },
  };
}
