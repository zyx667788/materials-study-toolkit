import { createViewerRotation } from './viewer-rotation.js?v=20261008-phase-audit-motion';

// Render only while visible and when controls, input or animation change the scene.
export function createSceneLoop({ host, controls, render, advance, isAnimating = () => false }) {
  const panel = host.closest('[data-module-panel]');
  let frame = 0;
  let inViewport = true;
  let contextLost = false;
  let previousTime = 0;
  let rotation;
  const visible = () => !document.hidden && !contextLost && inViewport
    && !panel?.classList.contains('is-hidden');

  function invalidate() {
    if (visible() && !frame) frame = requestAnimationFrame(tick);
  }

  function tick(now) {
    frame = 0;
    if (!visible()) return;
    const delta = previousTime ? Math.min(80, now - previousTime) : 0;
    previousTime = now;
    advance?.(now, delta);
    rotation?.sync();
    controls.update(delta / 1000);
    render();
    if (isAnimating() || controls.autoRotate) invalidate();
  }

  function visibilityChanged() {
    previousTime = 0;
    if (!visible()) {
      rotation?.cancelGesture();
      cancelAnimationFrame(frame);
      frame = 0;
    } else invalidate();
  }

  controls.addEventListener('change', invalidate);
  for (const type of ['input', 'change', 'click', 'pointermove']) {
    panel?.addEventListener(type, invalidate);
  }
  window.addEventListener('resize', invalidate);
  window.addEventListener('mstool:themechange', invalidate);
  document.addEventListener('visibilitychange', visibilityChanged);
  new MutationObserver(visibilityChanged).observe(panel || host, { attributes: true, attributeFilter: ['class'] });
  if ('ResizeObserver' in window) new ResizeObserver(invalidate).observe(host);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      inViewport = entry.isIntersecting;
      visibilityChanged();
    }).observe(host);
  }
  const canvas = host.querySelector('canvas');
  canvas?.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    contextLost = true;
    visibilityChanged();
  });
  canvas?.addEventListener('webglcontextrestored', () => {
    contextLost = false;
    visibilityChanged();
  });
  rotation = createViewerRotation({ host, controls, invalidate });
  invalidate();
  return { invalidate };
}

export function disposeSceneChildren(group) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();
  group.traverse(node => {
    if (node.geometry) geometries.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
      if (!material) continue;
      materials.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
    }
  });
  textures.forEach(value => value.dispose());
  materials.forEach(value => value.dispose());
  geometries.forEach(value => value.dispose());
  group.clear();
}
