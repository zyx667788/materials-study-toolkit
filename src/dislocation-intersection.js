import * as THREE from "three";
import { createSceneLoop } from "./scene-loop.js?v=20261008-phase-audit-motion";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  analyzeDislocationPair,
  characterLabel,
  classifyDislocationCharacter,
  deriveSlipPlaneNormal,
  formatDirection,
  parseDirection,
} from "./dislocation-analysis.js?v=20261008-phase-audit-motion";
import { downloadCanvasPngWithWatermark } from "./export-watermark.js?v=20261008-phase-audit-motion";
import { arrowLabelPosition, labelRectangle, chooseLabelPosition } from "./dislocation-label-layout.js?v=20261008-phase-audit-motion";

const COLORS = {
  a: 0x7c3aed,
  b: 0xf59e0b,
  kink: 0xd59a2f,
  jog: 0x7757b7,
  unchanged: 0x74808b,
  intersection: 0xd94f79,
  motion: 0x3578a8,
};

const TYPE_DEFAULTS = {
  A: {
    edge: { line: [0, 1, 0], burgers: [1, 0, 0], plane: [0, 0, 1] },
    screw: { line: [1, 0, 0], burgers: [1, 0, 0], plane: [0, 0, 1] },
    mixed: { line: [1, 1, 0], burgers: [1, 0, 0], plane: [0, 0, 1] },
  },
  B: {
    edge: { line: [0, 0, 1], burgers: [0, 1, 0], plane: [1, 0, 0] },
    screw: { line: [0, 0, 1], burgers: [0, 0, 1], plane: [0, 1, 0] },
    mixed: { line: [1, 0, 1], burgers: [0, 0, 1], plane: [0, 1, 0] },
  },
};

const PRESETS = {
  "edge-edge-kink": {
    a: { line: [0, 1, 0], burgers: [1, 0, 0], plane: [0, 0, 1] },
    b: { line: [0, 0, 1], burgers: [1, 0, 0], plane: [0, 1, 0] },
  },
  "edge-edge-jog": {
    a: { line: [0, 1, 0], burgers: [1, 0, 0], plane: [0, 0, 1] },
    b: { line: [0, 0, 1], burgers: [0, 1, 0], plane: [1, 0, 0] },
  },
  "edge-screw": {
    a: { line: [0, 1, 0], burgers: [1, 0, 0], plane: [0, 0, 1] },
    b: { line: [0, 0, 1], burgers: [0, 0, 1], plane: [0, 1, 0] },
  },
  "screw-screw": {
    a: { line: [1, 0, 0], burgers: [1, 0, 0], plane: [0, 0, 1] },
    b: { line: [0, 0, 1], burgers: [0, 0, 1], plane: [0, 1, 0] },
  },
  "mixed-edge": {
    a: { line: [1, 1, 0], burgers: [1, 0, 0], plane: [0, 0, 1] },
    b: { line: [0, 0, 1], burgers: [0, 1, 0], plane: [1, 0, 0] },
  },
};

const STAGE_POINTS = [0, 0.36, 0.55, 1];

export function initDislocationIntersectionModule() {
  const els = {
    host: document.querySelector("#dislocationViewerHost"),
    preset: document.querySelector("#dislocationPresetSelect"),
    inputStatus: document.querySelector("#dislocationInputStatus"),
    playButton: document.querySelector("#dislocationPlayButton"),
    initialButton: document.querySelector("#dislocationInitialButton"),
    progress: document.querySelector("#dislocationProgress"),
    stageButtons: document.querySelectorAll("[data-dislocation-stage]"),
    resetButton: document.querySelector("#dislocationResetButton"),
    exportButton: document.querySelector("#dislocationExportButton"),
    viewerStage: document.querySelector("#dislocationViewerStage"),
    viewerCaption: document.querySelector("#dislocationViewerCaption"),
    summary: document.querySelector("#dislocationSummary"),
    warning: document.querySelector("#dislocationWarning"),
    a: collectInputElements("A"),
    b: collectInputElements("B"),
    resultA: collectResultElements("A"),
    resultB: collectResultElements("B"),
  };

  if (!els.host) return { refresh: () => {} };

  const state = {
    progress: 0,
    playing: false,
    analysis: null,
    lastFrame: performance.now(),
    viewFit: 1,
  };

  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  els.host.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.up.set(0, 0, 1);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.rotateSpeed = 0.64;
  controls.zoomSpeed = 0.82;
  controls.panSpeed = 0.4;
  controls.enablePan = true;
  controls.minDistance = 5;
  controls.maxDistance = 22;

  const staticRoot = new THREE.Group();
  const dynamicRoot = new THREE.Group();
  scene.add(staticRoot, dynamicRoot);

  const hemisphere = new THREE.HemisphereLight(0xf1f5f9, 0x9ca3af, 1.2);
  scene.add(hemisphere);
  const key = new THREE.DirectionalLight(0xe2e8f0, 1.4);
  key.position.set(5.8, -5.2, 7.6);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xcbd5e1, 0.45);
  fill.position.set(-4.6, 3.4, 2.2);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xe2e8f0, 0.35);
  rim.position.set(2.4, 5.2, -3.4);
  scene.add(rim);

  wireUi();
  applyPreset("edge-screw");
  applySceneTheme();
  resetCamera();
  resize();
  createSceneLoop({
    host: els.host, controls,
    render: () => {
      resizeLabels();
      renderer.render(scene, camera);
    },
    advance: animate,
    isAnimating: () => state.playing,
  });

  if ("ResizeObserver" in window) {
    new ResizeObserver(resize).observe(els.host);
  }
  window.addEventListener("resize", resize);
  window.addEventListener("mstool:themechange", () => {
    applySceneTheme();
    rebuildScene();
  });

  return {
    refresh() {
      resize();
      controls.update();
    },
  };

  function wireUi() {
    const presetButtons = document.querySelectorAll("[data-preset]");
    presetButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        applyPreset(btn.dataset.preset);
      });
    });

    els.preset?.addEventListener("change", () => {
      if (els.preset.value !== "custom") applyPreset(els.preset.value);
    });

    [["A", els.a], ["B", els.b]].forEach(([label, group]) => {
      group.type?.addEventListener("change", () => {
        applyTypeDefault(label, group.type.value);
        markCustom();
        analyzeFromInputs();
      });

      [group.line, group.burgers].forEach((input) => {
        input?.addEventListener("change", () => {
          updateDerivedFields(label);
          markCustom();
          analyzeFromInputs();
        });
        input?.addEventListener("keydown", (event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          input.blur();
        });
      });

      group.plane?.addEventListener("change", () => {
        markCustom();
        analyzeFromInputs();
      });
    });

    els.stageButtons.forEach((button, index) => {
      button.addEventListener("click", () => setProgress(STAGE_POINTS[index] ?? 0, false));
    });
    els.progress?.addEventListener("input", () => setProgress(Number(els.progress.value), false));
    els.playButton?.addEventListener("click", togglePlayback);
    els.initialButton?.addEventListener("click", () => setProgress(0, false));
    els.resetButton?.addEventListener("click", resetCamera);
    els.exportButton?.addEventListener("click", exportPng);
  }

  function applyPreset(id) {
    const preset = PRESETS[id];
    if (!preset) return;
    writeConfiguration(els.a, preset.a);
    writeConfiguration(els.b, preset.b);
    els.a.type.value = classifyDislocationCharacter(preset.a.line, preset.a.burgers);
    els.b.type.value = classifyDislocationCharacter(preset.b.line, preset.b.burgers);
    if (els.preset) els.preset.value = id;
    document.querySelectorAll("[data-preset]").forEach((btn) => {
      btn.classList.toggle("is-active", btn.dataset.preset === id);
    });
    setProgress(0, false);
    analyzeFromInputs();
  }

  function applyTypeDefault(label, type) {
    const defaults = TYPE_DEFAULTS[label]?.[type];
    const group = label === "A" ? els.a : els.b;
    if (!defaults || !group) return;
    writeConfiguration(group, defaults);
  }

  function updateDerivedFields(label) {
    const group = label === "A" ? els.a : els.b;
    try {
      const line = parseDirection(group.line.value, `位错 ${label} 的位错线方向`);
      const burgers = parseDirection(group.burgers.value, `位错 ${label} 的柏氏矢量`);
      const character = classifyDislocationCharacter(line, burgers);
      group.type.value = character;
      let fallback = null;
      try {
        fallback = parseDirection(group.plane.value, `位错 ${label} 的滑移面法向`);
      } catch {
        fallback = null;
      }
      const plane = deriveSlipPlaneNormal(line, burgers, fallback);
      group.plane.value = vectorInputValue(plane);
      group.planeHint.textContent = character === "screw"
        ? "螺型位错的滑移面不唯一，可修改 n。"
        : "已由 ξ × b 自动得到。";
    } catch (error) {
      showInputStatus(error.message, true);
    }
  }

  function analyzeFromInputs() {
    try {
      state.analysis = analyzeDislocationPair({
        a: readConfiguration(els.a),
        b: readConfiguration(els.b),
      });
      showInputStatus("矢量关系已更新。", false);
      updateAnalysisPanel();
      rebuildScene();
    } catch (error) {
      state.analysis = null;
      state.playing = false;
      showInputStatus(error.message, true);
      showInvalidAnalysis(error.message);
    }
  }

  function updateAnalysisPanel() {
    if (!state.analysis) return;
    setAnalysisControlsEnabled(true);
    if (els.summary) els.summary.textContent = state.analysis.summary;
    writeResult(els.resultA, state.analysis.a, state.analysis.resultA);
    writeResult(els.resultB, state.analysis.b, state.analysis.resultB);
    if (els.warning) {
      if (state.analysis.warnings.length) {
        els.warning.hidden = false;
        els.warning.textContent = state.analysis.warnings.join(" ");
      } else {
        els.warning.hidden = true;
        els.warning.textContent = "";
      }
    }
    updateStageUi();
  }

  function showInvalidAnalysis(message) {
    state.progress = 0;
    if (els.progress) els.progress.value = "0";
    setAnalysisControlsEnabled(false);
    if (els.summary) els.summary.textContent = "暂无法判定";
    if (els.warning) {
      els.warning.hidden = false;
      els.warning.textContent = message;
    }
    writePendingResult(els.resultA);
    writePendingResult(els.resultB);
    if (els.viewerStage) els.viewerStage.textContent = "输入待修正";
    if (els.viewerCaption) els.viewerCaption.textContent = "满足交割几何条件后，将显示割阶或扭折分析。";
    disposeChildren(staticRoot);
    disposeChildren(dynamicRoot);
    staticRoot.add(makeAxes());
  }

  function setAnalysisControlsEnabled(enabled) {
    els.stageButtons.forEach((button) => { button.disabled = !enabled; });
    if (els.progress) els.progress.disabled = !enabled;
    if (els.playButton) els.playButton.disabled = !enabled;
  }

  function rebuildScene() {
    if (!state.analysis) return;
    disposeChildren(staticRoot);
    staticRoot.add(makeSlipPlane(state.analysis.a.plane, COLORS.a, "滑移面 1"));
    staticRoot.add(makeSlipPlane(state.analysis.b.plane, COLORS.b, "滑移面 2"));
    staticRoot.add(makeAxes());
    drawDynamic();
  }

  function drawDynamic() {
    if (!state.analysis) return;
    disposeChildren(dynamicRoot);
    const { a, b, resultA, resultB } = state.analysis;
    const progress = state.progress;
    const movement = vector3(a.motion);
    const movementOffset = progress <= 0.5
      ? -1.55 * (1 - smoothstep(0, 0.5, progress))
      : 0.78 * smoothstep(0.5, 1, progress);
    const centerA = movement.clone().multiplyScalar(movementOffset);
    const centerB = new THREE.Vector3(0, 0, 0);
    const stepAlpha = smoothstep(0.5, 0.82, progress);

    const lineA = makeDislocationLine({
      center: centerA,
      line: a.line,
      step: b.burgers,
      result: resultA,
      alpha: stepAlpha,
      color: COLORS.a,
      label: "A",
    });
    const lineB = makeDislocationLine({
      center: centerB,
      line: b.line,
      step: a.burgers,
      result: resultB,
      alpha: stepAlpha,
      color: COLORS.b,
      label: "B",
    });
    dynamicRoot.add(lineA.group, lineB.group);

    dynamicRoot.add(makeVectorArrow(
      centerA.clone().addScaledVector(lineA.lineUnit, -1.8).addScaledVector(vector3(a.plane).normalize(), 0.45),
      a.burgers,
      COLORS.a,
      "b1",
    ));
    dynamicRoot.add(makeVectorArrow(
      centerB.clone().addScaledVector(lineB.lineUnit, 1.0).addScaledVector(vector3(b.plane).normalize(), 0.45),
      b.burgers,
      COLORS.b,
      "b2",
    ));
    dynamicRoot.add(makeVectorArrow(
      centerA.clone().addScaledVector(lineA.lineUnit, 1.6).addScaledVector(vector3(a.plane).normalize(), 0.45),
      a.motion,
      COLORS.motion,
      "v",
    ));

    if (progress > 0.39 && progress < 0.75) {
      const pulse = 1 + 0.22 * Math.sin(progress * Math.PI * 18);
      const marker = new THREE.Mesh(
        new THREE.SphereGeometry(0.12 * pulse, 24, 18),
        new THREE.MeshBasicMaterial({
          color: COLORS.intersection,
          transparent: true,
          opacity: Math.max(0.35, 1 - Math.abs(progress - 0.55) * 3.2),
          depthTest: false,
        }),
      );
      marker.renderOrder = 8;
      dynamicRoot.add(marker);
    }
  }

  function setProgress(value, playing) {
    state.progress = THREE.MathUtils.clamp(Number(value) || 0, 0, 1);
    state.playing = playing;
    if (els.progress) els.progress.value = String(state.progress);
    updateStageUi();
    drawDynamic();
  }

  function togglePlayback() {
    if (!state.analysis) return;
    if (state.progress >= 0.999) state.progress = 0;
    state.playing = !state.playing;
    state.lastFrame = performance.now();
    updateStageUi();
    drawDynamic();
  }

  function updateStageUi() {
    const stage = stageForProgress(state.progress);
    els.stageButtons.forEach((button, index) => {
      const active = index === stage.index;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (els.playButton) {
      els.playButton.innerHTML = state.playing
        ? '<span aria-hidden="true">Ⅱ</span> 暂停'
        : '<span aria-hidden="true">▶</span> 播放';
    }
    if (els.viewerStage) els.viewerStage.textContent = stage.title;
    if (els.viewerCaption) {
      els.viewerCaption.textContent = stage.index === 3 && state.analysis
        ? state.analysis.summary
        : stage.caption;
    }
  }

  function applySceneTheme() {
    const dark = isDarkTheme();
    scene.background = new THREE.Color(dark ? 0x171a1f : 0xf9fafb);
    hemisphere.groundColor.set(dark ? 0x26344a : 0x8797a5);
    renderer.toneMappingExposure = dark ? 1.16 : 1.05;
  }

  function resizeLabels() {
    const height = Math.max(1, els.host.clientHeight);
    const width = Math.max(1, els.host.clientWidth);
    camera.updateMatrixWorld(true);
    scene.updateMatrixWorld(true);
    const labels = [];
    scene.traverse((object) => {
      if (object.userData.labelPixels) labels.push(object);
    });
    const priority = object => object.userData.arrow ? 0 : object.userData.labelText.startsWith('滑移面') ? 2 : 1;
    labels.sort((a, b) => priority(a) - priority(b));
    const screen = p => ({ x: (p.x + 1) * width / 2, y: (1 - p.y) * height / 2 });
    const arrows = labels.filter(object => object.userData.arrow).map(object => ({
      start: screen(object.userData.arrow.start.clone().project(camera)),
      end: screen(object.userData.arrow.end.clone().project(camera)),
    }));
    const hostRect = els.host.getBoundingClientRect();
    const occupied = [...els.host.parentElement.querySelectorAll('.dislocation-view-badge, .dislocation-legend, .dislocation-view-actions')]
      .map(element => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left - hostRect.left, right: rect.right - hostRect.left,
          top: rect.top - hostRect.top, bottom: rect.bottom - hostRect.top };
      });
    for (const object of labels) {
      const pixels = object.userData.labelPixels, aspect = object.userData.labelAspect;
      const arrow = object.userData.arrow;
      let anchor, candidates;
      if (arrow) {
        const start = arrow.start.clone().project(camera), end = arrow.end.clone().project(camera);
        anchor = arrow.start.clone().add(arrow.end).multiplyScalar(0.5);
        const depth = Math.abs(anchor.clone().applyMatrix4(camera.matrixWorldInverse).z);
        const worldHeight = 2 * depth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
        const clearance = 10 + 0.085 * height / Math.max(worldHeight, 1e-6);
        const startScreen = screen(start), endScreen = screen(end);
        const dx = endScreen.x - startScreen.x, dy = endScreen.y - startScreen.y, length = Math.hypot(dx, dy) || 1;
        candidates = [0, 18, 36, 54, 72].flatMap(extra => [0, -18, 18, -36, 36, -54, 54].flatMap(shift => [1, -1].map(side => {
          const point = arrowLabelPosition(startScreen, endScreen, pixels * aspect, pixels, clearance + extra, side);
          return { x: point.x + dx / length * shift, y: point.y + dy / length * shift };
        })));
        object.visible = start.z > -1 && start.z < 1 && end.z > -1 && end.z < 1;
      } else {
        object.userData.labelAnchor ||= object.position.clone();
        anchor = object.userData.labelAnchor.clone();
        const base = screen(anchor.clone().project(camera));
        candidates = [base];
        for (let radius = 24; radius <= 144; radius += 24) for (let i = 0; i < 12; i++) {
          const angle = -Math.PI / 2 + i * Math.PI / 6;
          candidates.push({ x: base.x + Math.cos(angle) * radius, y: base.y + Math.sin(angle) * radius });
        }
      }
      const point = chooseLabelPosition(candidates, pixels * aspect, pixels, occupied, arrows, { width, height });
      const depth = anchor.clone().applyMatrix4(camera.matrixWorldInverse).z;
      const ndc = anchor.project(camera);
      object.position.set(point.x / width * 2 - 1, 1 - point.y / height * 2, ndc.z).unproject(camera);
      const worldHeight = 2 * Math.abs(depth) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const size = worldHeight * pixels / height;
      object.scale.set(size * aspect, size, 1);
      if (object.visible) occupied.push(labelRectangle(point, pixels * aspect, pixels));
    }
  }

  function resetCamera() {
    camera.position.set(8.6, -10, 7.1);
    controls.target.set(0, 0, 0.1);
    camera.position.sub(controls.target).multiplyScalar(state.viewFit).add(controls.target);
    camera.lookAt(controls.target);
    camera.near = 0.1;
    camera.far = 100;
    camera.updateProjectionMatrix();
    controls.update();
  }

  function resize() {
    const rect = els.host.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    const viewFit = Math.max(1, 1.06 / camera.aspect);
    camera.position.sub(controls.target).multiplyScalar(viewFit / state.viewFit).add(controls.target);
    state.viewFit = viewFit;
    camera.updateProjectionMatrix();
  }

  function exportPng() {
    resizeLabels();
    controls.update();
    renderer.render(scene, camera);
    downloadCanvasPngWithWatermark(renderer.domElement, "dislocation-intersection.png");
  }

  function animate(now, delta) {
    if (state.playing) {
      state.progress += delta / 5600;
      if (state.progress >= 1) {
        state.progress = 1;
        state.playing = false;
      }
      if (els.progress) els.progress.value = String(state.progress);
      updateStageUi();
      drawDynamic();
    }
  }
}

function collectInputElements(label) {
  return {
    type: document.querySelector(`#dislocation${label}Type`),
    line: document.querySelector(`#dislocation${label}Line`),
    burgers: document.querySelector(`#dislocation${label}Burgers`),
    plane: document.querySelector(`#dislocation${label}Plane`),
    planeHint: document.querySelector(`#dislocation${label}PlaneHint`),
  };
}

function collectResultElements(label) {
  return {
    card: document.querySelector(`#dislocation${label}ResultCard`),
    type: document.querySelector(`#dislocation${label}ActualType`),
    kind: document.querySelector(`#dislocation${label}Result`),
    step: document.querySelector(`#dislocation${label}Step`),
    stepType: document.querySelector(`#dislocation${label}StepType`),
    relation: document.querySelector(`#dislocation${label}Relation`),
    mobility: document.querySelector(`#dislocation${label}Mobility`),
  };
}

function readConfiguration(group) {
  return {
    line: group.line.value,
    burgers: group.burgers.value,
    plane: group.plane.value,
  };
}

function writeConfiguration(group, config) {
  group.line.value = vectorInputValue(config.line);
  group.burgers.value = vectorInputValue(config.burgers);
  group.plane.value = vectorInputValue(config.plane);
  const character = classifyDislocationCharacter(config.line, config.burgers);
  group.planeHint.textContent = character === "screw"
    ? "螺型位错的滑移面不唯一，可修改 n。"
    : "已由 ξ × b 自动得到。";
}

function writeResult(elements, dislocation, result) {
  if (!elements?.card) return;
  elements.card.dataset.result = result.kind;
  if (elements.type) elements.type.textContent = characterLabel(dislocation.character);
  if (elements.kind) elements.kind.textContent = result.kindLabel;
  if (elements.step) elements.step.textContent = `∥ ${result.stepSymbol} = ${formatDirection(result.step)}`;
  if (elements.stepType) elements.stepType.textContent = result.kind === "unchanged"
    ? "与原线重合"
    : `${characterLabel(result.stepCharacter)}台阶段`;
  if (elements.relation) elements.relation.textContent = result.relation;
  if (elements.mobility) elements.mobility.textContent = result.mobility;
}

function writePendingResult(elements) {
  if (!elements?.card) return;
  elements.card.dataset.result = "invalid";
  if (elements.type) elements.type.textContent = "—";
  if (elements.kind) elements.kind.textContent = "待判定";
  if (elements.step) elements.step.textContent = "—";
  if (elements.stepType) elements.stepType.textContent = "—";
  if (elements.relation) elements.relation.textContent = "请先修正上方矢量关系。";
  if (elements.mobility) elements.mobility.textContent = "有效交割条件满足后显示运动分析。";
}

function makeSlipPlane(normalArray, color, label) {
  const normal = vector3(normalArray).normalize();
  const reference = leastParallelAxis(normal);
  const u = new THREE.Vector3().crossVectors(normal, reference).normalize();
  const v = new THREE.Vector3().crossVectors(normal, u).normalize();
  const size = 3.35;
  const corners = [
    u.clone().multiplyScalar(-size).add(v.clone().multiplyScalar(-size)),
    u.clone().multiplyScalar(size).add(v.clone().multiplyScalar(-size)),
    u.clone().multiplyScalar(size).add(v.clone().multiplyScalar(size)),
    u.clone().multiplyScalar(-size).add(v.clone().multiplyScalar(size)),
  ];
  const vertices = new Float32Array([
    ...corners[0].toArray(), ...corners[1].toArray(), ...corners[2].toArray(),
    ...corners[0].toArray(), ...corners[2].toArray(), ...corners[3].toArray(),
  ]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();
  const group = new THREE.Group();
  const plane = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: isDarkTheme() ? 0.09 : 0.075,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  plane.renderOrder = 0;
  group.add(plane);

  const gridPoints = [];
  for (let i = -3; i <= 3; i += 1) {
    const offset = (i / 3) * size;
    gridPoints.push(
      u.clone().multiplyScalar(-size).add(v.clone().multiplyScalar(offset)),
      u.clone().multiplyScalar(size).add(v.clone().multiplyScalar(offset)),
      v.clone().multiplyScalar(-size).add(u.clone().multiplyScalar(offset)),
      v.clone().multiplyScalar(size).add(u.clone().multiplyScalar(offset)),
    );
  }
  const gridGeometry = new THREE.BufferGeometry().setFromPoints(gridPoints);
  const grid = new THREE.LineSegments(
    gridGeometry,
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: isDarkTheme() ? 0.22 : 0.16,
      depthWrite: false,
    }),
  );
  grid.renderOrder = 1;
  group.add(grid);

  const borderPoints = [...corners, corners[0]];
  const border = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(borderPoints),
    new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.52 }),
  );
  group.add(border);
  const labelSprite = makeTextSprite(label, color, 0.7);
  labelSprite.position.copy(u.clone().multiplyScalar(2.85).add(v.clone().multiplyScalar(2.7)));
  group.add(labelSprite);
  return group;
}

function makeDislocationLine({ center, line, step, result, alpha, color, label }) {
  const group = new THREE.Group();
  const lineUnit = vector3(line).normalize();
  const stepUnit = vector3(step).normalize();
  const halfLength = 3.45;
  const stepLength = 0.92 * alpha;
  const joint = center.clone();
  const shifted = joint.clone().add(stepUnit.multiplyScalar(stepLength));
  const start = joint.clone().add(lineUnit.clone().multiplyScalar(-halfLength));
  const end = shifted.clone().add(lineUnit.clone().multiplyScalar(halfLength));
  const radius = 0.075;
  const stepColor = COLORS[result.kind] ?? COLORS.unchanged;
  group.add(makeCylinder(start, joint, color, radius));
  if (stepLength > 0.012) group.add(makeCylinder(joint, shifted, stepColor, radius * 1.2));
  group.add(makeCylinder(shifted, end, color, radius));
  group.add(makeSphere(start, color, radius * 1.18));
  group.add(makeSphere(end, color, radius * 1.18));
  if (stepLength > 0.012) {
    group.add(makeSphere(joint, stepColor, radius * 1.26));
    group.add(makeSphere(shifted, stepColor, radius * 1.26));
  }
  const text = makeTextSprite(label, color, 0.72);
  text.position.copy(start.clone().add(new THREE.Vector3(0, 0, 0.22)));
  group.add(text);
  return { group, lineUnit };
}

function makeVectorArrow(origin, directionArray, color, label, length = 1.15) {
  const group = new THREE.Group();
  const direction = vector3(directionArray).normalize();
  group.add(makeSolidArrow(origin, direction, length, color));
  const text = makeTextSprite(label, color, 0.58);
  text.userData.arrow = { start: origin.clone(), end: origin.clone().addScaledVector(direction, length), label };
  text.position.copy(origin.clone().addScaledVector(direction, 0.58));
  group.add(text);
  return group;
}

function makeAxes() {
  const group = new THREE.Group();
  const origin = new THREE.Vector3(-3.05, -2.9, -2.45);
  [
    { direction: new THREE.Vector3(1, 0, 0), color: 0xc9664c, label: "x" },
    { direction: new THREE.Vector3(0, 1, 0), color: 0x168f7e, label: "y" },
    { direction: new THREE.Vector3(0, 0, 1), color: 0x3578a8, label: "z" },
  ].forEach(({ direction, color, label }) => {
    group.add(makeVectorArrow(origin, direction.toArray(), color, label, 1.1));
  });
  return group;
}

function makeCylinder(start, end, color, radius) {
  const direction = end.clone().sub(start);
  const length = direction.length();
  if (length < 1e-6) return new THREE.Group();
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, length, 12, 1, false),
    new THREE.MeshStandardMaterial({
      color,
      roughness: 0.34,
      metalness: 0.08,
    }),
  );
  mesh.position.copy(start).add(end).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  mesh.castShadow = false;
  return mesh;
}

function makeSphere(position, color, radius) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 18, 12),
    new THREE.MeshStandardMaterial({ color, roughness: 0.3, metalness: 0.08 }),
  );
  mesh.position.copy(position);
  return mesh;
}

function makeSolidArrow(origin, direction, length, color) {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({ color, toneMapped: false });
  const headLength = 0.25;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, length - headLength, 12), material);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.085, headLength, 20), material);
  shaft.position.y = (length - headLength) / 2;
  head.position.y = length - headLength / 2;
  group.add(shaft, head);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
  group.position.copy(origin);
  return group;
}

function makeTextSprite(text, color, scale = 0.6) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  const font = '600 64px Arial, "Microsoft YaHei", sans-serif';
  const subscript = /^b[12]$/.test(text);
  context.font = font;
  canvas.width = Math.ceil(context.measureText(subscript ? 'b' : text).width) + (subscript ? 38 : 0) + 24;
  canvas.height = 94;
  context.font = font;
  context.textBaseline = 'alphabetic';
  context.lineJoin = 'round';
  context.lineWidth = 6;
  context.strokeStyle = isDarkTheme() ? '#191d23' : '#ffffff';
  const ink = new THREE.Color(color);
  if (isDarkTheme()) ink.lerp(new THREE.Color(0xffffff), 0.32);
  context.fillStyle = `#${ink.getHexString()}`;
  const main = subscript ? 'b' : text;
  context.strokeText(main, 12, 65);
  context.fillText(main, 12, 65);
  if (subscript) {
    const x = 12 + context.measureText('b').width;
    context.font = '500 42px Arial, sans-serif';
    context.strokeText(text[1], x, 80);
    context.fillText(text[1], x, 80);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  }));
  sprite.userData.labelPixels = text.startsWith('滑移面') ? 22 : 30;
  sprite.userData.labelText = text;
  sprite.userData.labelAspect = canvas.width / canvas.height;
  sprite.scale.set(scale * sprite.userData.labelAspect, scale, 1);
  sprite.renderOrder = 10;
  return sprite;
}

function stageForProgress(progress) {
  if (progress < 0.25) {
    return { index: 0, title: "初始位置", caption: "A 沿 v 方向滑移，B 固定。" };
  }
  if (progress < 0.5) {
    return { index: 1, title: "接近", caption: "位错 A 靠近位错 B，交割点即将形成。" };
  }
  if (progress < 0.82) {
    return { index: 2, title: "交割", caption: "相交处分别引入平行于另一条柏氏矢量的台阶段。" };
  }
  return { index: 3, title: "交割结果", caption: "根据台阶段是否位于原滑移面内判定缺陷。" };
}

function showInputStatus(message, error) {
  const element = document.querySelector("#dislocationInputStatus");
  if (!element) return;
  element.textContent = message;
  element.dataset.state = error ? "error" : "ok";
}

function markCustom() {
  const select = document.querySelector("#dislocationPresetSelect");
  if (select) select.value = "custom";
  document.querySelectorAll("[data-preset]").forEach((btn) => {
    btn.classList.remove("is-active");
  });
}

function vectorInputValue(vector) {
  return formatDirection(vector).slice(1, -1);
}

function vector3(vector) {
  return new THREE.Vector3(vector[0], vector[1], vector[2]);
}

function leastParallelAxis(vector) {
  const axes = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
  return axes.reduce((best, axis) => (
    Math.abs(vector.dot(axis)) < Math.abs(vector.dot(best)) ? axis : best
  ), axes[0]);
}

function smoothstep(min, max, value) {
  const x = THREE.MathUtils.clamp((value - min) / Math.max(1e-8, max - min), 0, 1);
  return x * x * (3 - 2 * x);
}

function isDarkTheme() {
  return document.documentElement.dataset.theme === "dark";
}

function disposeChildren(root) {
  root.traverse((node) => {
    node.geometry?.dispose?.();
    if (Array.isArray(node.material)) {
      node.material.forEach(disposeMaterial);
    } else {
      disposeMaterial(node.material);
    }
  });
  root.clear();
}

function disposeMaterial(material) {
  if (!material) return;
  material.map?.dispose?.();
  material.dispose?.();
}
