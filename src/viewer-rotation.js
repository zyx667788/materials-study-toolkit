const HOLD_MS = 450;
const MOVE_TOLERANCE = 8;
const SAMPLE_MS = 120;
const RESET_BUTTONS = '#resetButton, #stereoResetButton, #interstitialResetButton, #dislocationResetButton, #ternaryResetButton';

export function createViewerRotation({ host, controls, invalidate }) {
  const canvas = controls.domElement;
  const viewer = host.parentElement;
  const panel = host.closest('[data-module-panel]');
  let toolbar = viewer.querySelector(':scope > .interstitial-view-actions, :scope > .dislocation-view-actions');
  if (!toolbar) {
    toolbar = document.createElement('div');
    toolbar.className = 'viewer-rotation-actions';
    viewer.append(toolbar);
  }
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'viewer-icon-button viewer-rotation-toggle';
  button.dataset.autoRotate = '';
  const icon = document.createElement('img');
  icon.className = 'tool-icon';
  icon.alt = '';
  const startIcon = new URL('../assets/icons/rotate-3d.svg', import.meta.url).href;
  const pauseIcon = new URL('../assets/icons/pause.svg', import.meta.url).href;
  button.append(icon);
  toolbar.prepend(button);

  let spinning = false;
  let holdTimer = 0;
  let gesture = null;
  const pointers = new Set();
  controls.autoRotateSpeed = 2;

  function clearHold() {
    clearTimeout(holdTimer);
    holdTimer = 0;
  }

  function clearMomentum() {
    controls.autoRotate = false;
    if (!controls.enableDamping) return;
    // OrbitControls has no public inertia reset. Flush it without moving the displayed camera.
    const position = controls.object.position.clone();
    const target = controls.target.clone();
    controls.enableDamping = false;
    controls.update(0);
    controls.object.position.copy(position);
    controls.target.copy(target);
    controls.update(0);
    controls.enableDamping = true;
  }

  function sync() {
    const available = controls.enabled && controls.enableRotate;
    if (!available) {
      if (spinning || controls.autoRotate) clearMomentum();
      spinning = false;
      clearHold();
      gesture = null;
    }
    controls.autoRotate = available && spinning && pointers.size === 0;
    button.hidden = !available;
    button.disabled = !available;
    const pressed = String(spinning);
    if (button.getAttribute('aria-pressed') !== pressed) {
      button.setAttribute('aria-pressed', pressed);
      const label = spinning ? '暂停旋转' : '开始旋转';
      button.setAttribute('aria-label', label);
      button.title = label;
      icon.src = spinning ? pauseIcon : startIcon;
    }
  }

  function stop() {
    spinning = false;
    clearMomentum();
    clearHold();
    gesture = null;
    sync();
    invalidate();
  }

  function cancelGesture() {
    clearHold();
    pointers.clear();
    gesture = null;
    sync();
  }

  button.addEventListener('click', () => {
    spinning = !spinning;
    if (!spinning) clearMomentum();
    sync();
    invalidate();
  });

  // Capture before OrbitControls so one-finger rotation and two-finger zoom remain independent.
  canvas.addEventListener('pointerdown', event => {
    if (!controls.enabled || !controls.enableRotate || (event.pointerType === 'mouse' && event.button !== 0)) return;
    pointers.add(event.pointerId);
    if (spinning) clearMomentum();
    clearHold();
    gesture = null;
    if (pointers.size === 1) {
      gesture = { id: event.pointerId, type: event.pointerType,
        x: event.clientX, y: event.clientY, moved: false, held: false,
        samples: [{ x: event.clientX, time: event.timeStamp }] };
      holdTimer = setTimeout(() => {
        if (!gesture || gesture.moved) return;
        gesture.held = true;
        spinning = false;
        clearMomentum();
        sync();
        invalidate();
      }, HOLD_MS);
    }
    sync();
    invalidate();
  }, { capture: true });

  canvas.addEventListener('pointermove', event => {
    if (!gesture || gesture.id !== event.pointerId) return;
    if (Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > MOVE_TOLERANCE) {
      gesture.moved = true;
      clearHold();
    }
    const time = event.timeStamp;
    gesture.samples.push({ x: event.clientX, time });
    while (gesture.samples.length > 2 && time - gesture.samples[0].time > SAMPLE_MS) gesture.samples.shift();
  }, { capture: true });

  function finish(event) {
    if (!pointers.has(event.pointerId)) return;
    clearHold();
    if (event.type === 'pointerup' && gesture?.id === event.pointerId
        && !gesture.held && gesture.moved && ['touch', 'pen'].includes(gesture.type)) {
      const now = event.timeStamp;
      const first = gesture.samples[0];
      const last = gesture.samples[gesture.samples.length - 1];
      const dx = event.clientX - first.x;
      const elapsed = now - first.time;
      const velocity = dx / Math.max(16, elapsed);
      if (now - last.time < SAMPLE_MS && Math.abs(dx) >= 12 && Math.abs(velocity) >= 0.12) {
        // OrbitControls speed is revolutions per minute; match the horizontal flick direction.
        controls.autoRotateSpeed = Math.sign(velocity) * Math.min(6,
          Math.max(0.8, Math.abs(velocity) * 60000 * controls.rotateSpeed / canvas.clientHeight));
        spinning = true;
      }
    }
    pointers.delete(event.pointerId);
    gesture = null;
    sync();
    invalidate();
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(type, finish, { capture: true });
  }
  canvas.addEventListener('contextmenu', event => event.preventDefault());
  panel?.addEventListener('click', event => {
    if (event.target.closest(RESET_BUTTONS)) stop();
  }, { capture: true });
  for (const type of ['click', 'change', 'input']) panel?.addEventListener(type, sync);
  sync();
  return { sync, cancelGesture };
}
