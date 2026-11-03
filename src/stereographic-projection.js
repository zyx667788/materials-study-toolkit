import * as THREE from "three";
import { createSceneLoop } from "./scene-loop.js?v=20261008-phase-audit-motion";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { downloadCanvasPngWithWatermark } from "./export-watermark.js?v=20261008-phase-audit-motion";

const SPHERE_RADIUS = 2.45;
const DEFAULT_POLE_KEY = "1,1,1";
const ORDER_PRESETS = {
  1: { poleNormSq: 3, zoneNormSq: 2, desktopLabels: 24, mobileLabels: 16 },
  2: { poleNormSq: 9, zoneNormSq: 6, desktopLabels: 42, mobileLabels: 24 },
  3: { poleNormSq: 27, zoneNormSq: 11, desktopLabels: 60, mobileLabels: 32 },
};
const SYMMETRY_LABELS = {
  fourfold: "\u56db\u91cd\u5bf9\u79f0\u8f74",
  threefold: "\u4e09\u91cd\u5bf9\u79f0\u8f74",
  twofold: "\u4e8c\u91cd\u5bf9\u79f0\u8f74",
  general: "\u4e00\u822c\u65b9\u5411",
};

const ALL_POLES = generatePrimitiveVectors(5, false)
  .filter((item) => item.indices[2] >= 0);
const ALL_ZONES = generatePrimitiveVectors(4, true);
const STANDARD_POLES = ALL_POLES.filter((item) => item.normSq <= 3);
const STANDARD_ZONES = ALL_ZONES.filter((item) => item.normSq <= 3);
const NORTH = new THREE.Vector3(0, 0, 1);
const SOUTH = new THREE.Vector3(0, 0, -SPHERE_RADIUS);
const LOCAL_Z = new THREE.Vector3(0, 0, 1);
const INITIAL_CAMERA_DIRECTION = new THREE.Vector3(0.82, -1, 0.58).normalize();

export function initStereographicProjectionModule() {
  const els = {
    host: document.querySelector("#stereoViewerHost"),
    orderButtons: document.querySelectorAll("[data-stereo-order]"),
    toggles: document.querySelectorAll("[data-stereo-toggle]"),
    resetButton: document.querySelector("#stereoResetButton"),
    exportButton: document.querySelector("#stereoExportButton"),
    centerReadout: document.querySelector("#stereoCenterReadout"),
    poleReadout: document.querySelector("#stereoPoleReadout"),
    viewerCenter: document.querySelector("#stereoViewerCenter"),
  };

  if (!els.host) return { refresh: () => {} };

  const state = {
    order: 2,
    showPoles: true,
    showLabels: true,
    showZones: true,
    showPlane: true,
    selectedKey: DEFAULT_POLE_KEY,
    width: 0,
    height: 0,
    pointerDown: null,
  };

  const scene = new THREE.Scene();
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = stereoToneExposure();
  els.host.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 100);
  camera.up.set(0, 0, 1);
  camera.position.copy(INITIAL_CAMERA_DIRECTION).multiplyScalar(10);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.enablePan = false;
  controls.rotateSpeed = 0.62;
  controls.zoomSpeed = 0.78;
  controls.target.set(0, 0, 0);

  const modelRoot = new THREE.Group();
  const sphereRoot = new THREE.Group();
  const planeRoot = new THREE.Group();
  const planeCurveRoot = new THREE.Group();
  const planePoleRoot = new THREE.Group();
  const planeLabelRoot = new THREE.Group();
  const zoneRoot = new THREE.Group();
  const poleRoot = new THREE.Group();
  const labelRoot = new THREE.Group();
  const selectionRoot = new THREE.Group();
  modelRoot.add(
    sphereRoot,
    planeRoot,
    planeCurveRoot,
    planePoleRoot,
    planeLabelRoot,
    zoneRoot,
    poleRoot,
    labelRoot,
    selectionRoot,
  );
  scene.add(modelRoot);

  const hemisphere = new THREE.HemisphereLight(0xf1f5f9, 0x9ca3af, 1.2);
  scene.add(hemisphere);
  const keyLight = new THREE.DirectionalLight(0xe2e8f0, 1.4);
  keyLight.position.set(5, -6, 8);
  scene.add(keyLight);
  const fillLight = new THREE.DirectionalLight(0xcbd5e1, 0.45);
  fillLight.position.set(-5, 4, 3);
  scene.add(fillLight);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let spherePoleHitMeshes = [];
  let planePoleHitMeshes = [];
  let poleRecords = [];

  wireUi();
  rebuildScene();
  resize();
  createSceneLoop({ host: els.host, controls, render: () => renderer.render(scene, camera) });

  if ("ResizeObserver" in window) {
    new ResizeObserver(resize).observe(els.host);
  }
  window.addEventListener("resize", resize);
  window.addEventListener("mstool:themechange", () => {
    renderer.toneMappingExposure = stereoToneExposure();
    rebuildScene();
  });

  return {
    refresh() {
      requestAnimationFrame(() => {
        resize();
        controls.update();
        renderer.render(scene, camera);
      });
    },
  };

  function wireUi() {
    els.orderButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const nextOrder = Number(button.dataset.stereoOrder);
        if (!ORDER_PRESETS[nextOrder] || nextOrder === state.order) return;
        state.order = nextOrder;
        els.orderButtons.forEach((item) => {
          const active = item === button;
          item.classList.toggle("is-active", active);
          item.setAttribute("aria-pressed", String(active));
        });
        rebuildDataLayers();
      });
    });

    els.toggles.forEach((input) => {
      input.closest(".stereo-check")?.classList.toggle("is-active", input.checked);
      input.addEventListener("change", () => {
        const key = input.dataset.stereoToggle;
        input.closest(".stereo-check")?.classList.toggle("is-active", input.checked);
        if (!(key in state)) return;
        state[key] = input.checked;
        applyVisibility();
      });
    });

    els.resetButton?.addEventListener("click", () => {
      state.selectedKey = DEFAULT_POLE_KEY;
      resetCamera();
      rebuildLabels();
      rebuildSelection();
    });
    els.exportButton?.addEventListener("click", exportPng);

    renderer.domElement.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      state.pointerDown = { x: event.clientX, y: event.clientY };
    });

    renderer.domElement.addEventListener("pointerup", (event) => {
      if (!state.pointerDown) return;
      const distance = Math.hypot(
        event.clientX - state.pointerDown.x,
        event.clientY - state.pointerDown.y,
      );
      state.pointerDown = null;
      if (distance <= 5) selectPoleAt(event);
    });

    renderer.domElement.addEventListener("pointercancel", () => {
      state.pointerDown = null;
    });

    renderer.domElement.addEventListener("dblclick", (event) => {
      event.preventDefault();
      resetCamera();
    });
  }

  function rebuildScene() {
    const palette = currentPalette();
    const theme = currentTheme();
    scene.background = new THREE.Color(palette.background);
    hemisphere.groundColor.set(theme === "dark" ? 0x26354a : theme === "gray" ? 0x7c8b9e : 0x9ca3af);
    clearGroup(sphereRoot);
    clearGroup(planeRoot);
    clearGroup(planeCurveRoot);
    clearGroup(planePoleRoot);
    clearGroup(planeLabelRoot);
    planePoleHitMeshes = [];
    buildSphere(palette);
    buildProjectionPlane(palette);
    buildStandardProjection(palette);
    rebuildDataLayers(palette);
  }

  function rebuildDataLayers(palette = currentPalette()) {
    clearGroup(zoneRoot);
    clearGroup(poleRoot);
    clearGroup(labelRoot);
    spherePoleHitMeshes = [];

    const preset = ORDER_PRESETS[state.order];
    poleRecords = ALL_POLES.filter((record) => record.normSq <= preset.poleNormSq);
    if (!poleRecords.some((record) => record.key === state.selectedKey)) {
      state.selectedKey = DEFAULT_POLE_KEY;
    }

    buildZoneCircles(palette, preset);
    buildPoles(palette);
    buildLabels(palette);
    rebuildSelection(palette);
    applyVisibility();
  }

  function buildSphere(palette) {
    const surfaceGeometry = new THREE.SphereGeometry(SPHERE_RADIUS, 40, 24);
    const surface = new THREE.Mesh(
      surfaceGeometry,
      new THREE.MeshBasicMaterial({
        color: palette.sphereSurface,
        transparent: true,
        opacity: palette.sphereOpacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    surface.renderOrder = 0;
    sphereRoot.add(surface);

    const wire = new THREE.LineSegments(
      new THREE.WireframeGeometry(surfaceGeometry),
      new THREE.LineBasicMaterial({
        color: palette.sphereWire,
        transparent: true,
        opacity: palette.wireOpacity,
        depthWrite: false,
      }),
    );
    wire.renderOrder = 1;
    sphereRoot.add(wire);

    const gridMaterial = new THREE.LineBasicMaterial({
      color: palette.sphereGrid,
      transparent: true,
      opacity: palette.gridOpacity,
      depthWrite: false,
    });

    [-60, -30, 0, 30, 60].forEach((latitude) => {
      const radians = THREE.MathUtils.degToRad(latitude);
      const ringRadius = SPHERE_RADIUS * Math.cos(radians);
      const z = SPHERE_RADIUS * Math.sin(radians);
      const ring = makePlanarCircle(ringRadius, z, gridMaterial, 144);
      ring.renderOrder = 2;
      sphereRoot.add(ring);
    });

    for (let azimuth = 0; azimuth < 180; azimuth += 15) {
      const angle = THREE.MathUtils.degToRad(azimuth);
      const points = [];
      for (let index = 0; index < 144; index += 1) {
        const polar = (index / 144) * Math.PI * 2;
        const radial = SPHERE_RADIUS * Math.sin(polar);
        points.push(new THREE.Vector3(
          radial * Math.cos(angle),
          radial * Math.sin(angle),
          SPHERE_RADIUS * Math.cos(polar),
        ));
      }
      const meridian = makeLineLoop(points, gridMaterial);
      meridian.renderOrder = 2;
      sphereRoot.add(meridian);
    }
  }

  function buildProjectionPlane(palette) {
    const planeRadius = SPHERE_RADIUS * 1.025;
    const disk = new THREE.Mesh(
      new THREE.CircleGeometry(planeRadius, 128),
      new THREE.MeshBasicMaterial({
        color: palette.plane,
        transparent: true,
        opacity: palette.planeOpacity,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    disk.renderOrder = 1;
    planeRoot.add(disk);

    const lineMaterial = new THREE.LineBasicMaterial({
      color: palette.planeGrid,
      transparent: true,
      opacity: palette.planeGridOpacity,
      depthWrite: false,
    });
    const majorMaterial = new THREE.LineBasicMaterial({
      color: palette.planeOutline,
      transparent: true,
      opacity: palette.planeOutlineOpacity,
      depthWrite: false,
    });

    [15, 30, 45, 60, 75].forEach((colatitude) => {
      const radius = stereographicRadius(THREE.MathUtils.degToRad(colatitude)) * SPHERE_RADIUS;
      const circle = makePlanarCircle(radius, 0.006, lineMaterial, 128);
      circle.renderOrder = 3;
      planeRoot.add(circle);
    });

    const radialPositions = [];
    for (let angle = 0; angle < 180; angle += 15) {
      const radians = THREE.MathUtils.degToRad(angle);
      const x = Math.cos(radians) * SPHERE_RADIUS;
      const y = Math.sin(radians) * SPHERE_RADIUS;
      radialPositions.push(-x, -y, 0.006, x, y, 0.006);
    }
    const radialGeometry = new THREE.BufferGeometry();
    radialGeometry.setAttribute("position", new THREE.Float32BufferAttribute(radialPositions, 3));
    const radialLines = new THREE.LineSegments(radialGeometry, lineMaterial);
    radialLines.renderOrder = 3;
    planeRoot.add(radialLines);

    const outline = makePlanarCircle(SPHERE_RADIUS, 0.01, majorMaterial, 192);
    outline.renderOrder = 4;
    planeRoot.add(outline);

    const crossGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-0.1, 0, 0.012),
      new THREE.Vector3(0.1, 0, 0.012),
      new THREE.Vector3(0, -0.1, 0.012),
      new THREE.Vector3(0, 0.1, 0.012),
    ]);
    const cross = new THREE.LineSegments(crossGeometry, majorMaterial);
    cross.renderOrder = 4;
    planeRoot.add(cross);
  }

  function buildStandardProjection(palette) {
    const standardMaterial = new THREE.LineBasicMaterial({
      color: palette.standardCurve,
      transparent: true,
      opacity: palette.standardCurveOpacity,
      depthTest: false,
      depthWrite: false,
    });
    const standardMajorMaterial = new THREE.LineBasicMaterial({
      color: palette.standardCurveMajor,
      transparent: true,
      opacity: palette.standardCurveMajorOpacity,
      depthTest: false,
      depthWrite: false,
    });

    STANDARD_ZONES.forEach((zone) => {
      const curves = makeProjectedGreatCircle(
        zone.vector,
        SPHERE_RADIUS,
        zone.normSq === 1 ? standardMajorMaterial : standardMaterial,
      );
      curves.children.forEach((curve) => {
        curve.renderOrder = 10;
      });
      planeCurveRoot.add(curves);
    });

    const glyphLayer = makeSymmetryGlyphLayer(STANDARD_POLES, {
      baseSize: 0.105,
      hitRadius: 0.16,
      regularColor: palette.standardPole,
      symmetryColor: palette.standardPoleMajor,
      depthTest: false,
      renderOrder: 14,
      positionFor(record) {
        return stereographicProjection(record.vector, SPHERE_RADIUS)
          .setZ(0.025);
      },
      quaternionFor(record, position) {
        if (position.lengthSq() < 0.0001) return new THREE.Quaternion();
        return new THREE.Quaternion().setFromAxisAngle(
          LOCAL_Z,
          Math.atan2(position.y, position.x),
        );
      },
    });
    planePoleRoot.add(glyphLayer.root);
    planePoleHitMeshes = glyphLayer.hitMeshes;

    STANDARD_POLES.forEach((record) => {
      const projected = stereographicProjection(record.vector, SPHERE_RADIUS);
      const labelPosition = projected.clone();
      if (projected.lengthSq() < 0.0001) {
        labelPosition.set(0.2, -0.14, 0.085);
      } else {
        const radial = projected.clone().normalize();
        const offset = projected.length() > SPHERE_RADIUS * 0.88 ? -0.2 : 0.16;
        labelPosition.addScaledVector(radial, offset);
        labelPosition.z = 0.085;
      }

      const sprite = makeTextSprite(
        formatMillerCompact(record.indices),
        palette.standardLabel,
        palette.labelStroke,
        false,
        0.17,
      );
      sprite.position.copy(labelPosition);
      sprite.renderOrder = 24;
      planeLabelRoot.add(sprite);
    });
  }

  function buildZoneCircles(palette, preset) {
    const regularMaterial = new THREE.LineBasicMaterial({
      color: palette.zone,
      transparent: true,
      opacity: palette.zoneOpacity,
      depthWrite: false,
    });
    const majorMaterial = new THREE.LineBasicMaterial({
      color: palette.zoneMajor,
      transparent: true,
      opacity: palette.zoneMajorOpacity,
      depthWrite: false,
    });

    ALL_ZONES
      .filter((zone) => zone.normSq <= preset.zoneNormSq)
      .forEach((zone) => {
        const circle = makeGreatCircle(
          zone.vector,
          SPHERE_RADIUS * 1.008,
          zone.normSq <= 2 ? majorMaterial : regularMaterial,
        );
        circle.renderOrder = 4;
        zoneRoot.add(circle);
      });
  }

  function buildPoles(palette) {
    if (!poleRecords.length) return;

    const glyphLayer = makeSymmetryGlyphLayer(poleRecords, {
      baseSize: 0.1,
      hitRadius: 0.15,
      regularColor: palette.pole,
      symmetryColor: palette.poleMajor,
      depthTest: true,
      renderOrder: 6,
      positionFor(record) {
        return record.vector.clone().multiplyScalar(SPHERE_RADIUS * 1.018);
      },
      quaternionFor(record) {
        return new THREE.Quaternion().setFromUnitVectors(LOCAL_Z, record.vector);
      },
    });
    poleRoot.add(glyphLayer.root);
    spherePoleHitMeshes = glyphLayer.hitMeshes;
  }

  function rebuildLabels() {
    clearGroup(labelRoot);
    buildLabels(currentPalette());
    applyVisibility();
  }

  function buildLabels(palette) {
    const preset = ORDER_PRESETS[state.order];
    const maxLabels = state.width > 0 && state.width < 620
      ? preset.mobileLabels
      : preset.desktopLabels;
    const sorted = [...poleRecords].sort((first, second) => {
      if (first.key === state.selectedKey) return -1;
      if (second.key === state.selectedKey) return 1;
      return first.normSq - second.normSq
        || second.vector.z - first.vector.z
        || first.key.localeCompare(second.key);
    });
    const accepted = [];

    sorted.forEach((record) => {
      if (accepted.length >= maxLabels && record.key !== state.selectedKey) return;
      const selected = record.key === state.selectedKey;
      const minimumSeparation = state.order === 1 ? 0.12 : state.order === 2 ? 0.16 : 0.19;
      const tooClose = accepted.some((other) => (
        record.vector.angleTo(other.vector) < minimumSeparation
      ));
      if (tooClose && !selected) return;
      accepted.push(record);

      const sprite = makeTextSprite(
        formatMillerCompact(record.indices),
        selected ? palette.selectedPole : palette.label,
        palette.labelStroke,
        selected,
      );
      sprite.position.copy(record.vector).multiplyScalar(SPHERE_RADIUS + 0.19);
      sprite.renderOrder = 20;
      labelRoot.add(sprite);
    });
  }

  function rebuildSelection(palette = currentPalette()) {
    clearGroup(selectionRoot);
    const selected = poleRecords.find((record) => record.key === state.selectedKey)
      || ALL_POLES.find((record) => record.key === DEFAULT_POLE_KEY);
    if (!selected) return;

    state.selectedKey = selected.key;
    const polePosition = selected.vector.clone().multiplyScalar(SPHERE_RADIUS);
    const projectedPosition = stereographicProjection(selected.vector, SPHERE_RADIUS);

    const selectedPole = makeSymmetryGlyphMesh(selected, {
      position: polePosition,
      quaternion: new THREE.Quaternion().setFromUnitVectors(LOCAL_Z, selected.vector),
      baseSize: 0.145,
      color: palette.selectedPole,
      depthTest: false,
    });
    selectedPole.renderOrder = 30;
    selectionRoot.add(selectedPole);

    const projectedQuaternion = projectedPosition.lengthSq() < 0.0001
      ? new THREE.Quaternion()
      : new THREE.Quaternion().setFromAxisAngle(
        LOCAL_Z,
        Math.atan2(projectedPosition.y, projectedPosition.x),
      );
    const projectedDot = makeSymmetryGlyphMesh(selected, {
      position: projectedPosition,
      quaternion: projectedQuaternion,
      baseSize: 0.105,
      color: palette.projection,
      depthTest: false,
    });
    projectedDot.renderOrder = 31;
    selectionRoot.add(projectedDot);

    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.17, 0.027, 12, 48),
      new THREE.MeshBasicMaterial({
        color: palette.projection,
        transparent: true,
        opacity: 0.95,
        depthTest: false,
        depthWrite: false,
      }),
    );
    ring.position.copy(projectedPosition);
    ring.renderOrder = 32;
    selectionRoot.add(ring);

    const source = new THREE.Mesh(
      new THREE.SphereGeometry(0.075, 20, 14),
      new THREE.MeshStandardMaterial({
        color: palette.source,
        emissive: palette.source,
        emissiveIntensity: 0.08,
        roughness: 0.45,
        depthTest: false,
      }),
    );
    source.position.copy(SOUTH);
    source.renderOrder = 30;
    selectionRoot.add(source);

    const dashedMaterial = new THREE.LineDashedMaterial({
      color: palette.projection,
      transparent: true,
      opacity: 0.94,
      dashSize: 0.13,
      gapSize: 0.08,
      depthTest: false,
      depthWrite: false,
    });
    const ray = makeLine([SOUTH, polePosition], dashedMaterial);
    ray.computeLineDistances();
    ray.renderOrder = 28;
    selectionRoot.add(ray);

    const poleSegment = makeLine(
      [projectedPosition, polePosition],
      new THREE.LineBasicMaterial({
        color: palette.selectedPole,
        transparent: true,
        opacity: 0.95,
        depthTest: false,
        depthWrite: false,
      }),
    );
    poleSegment.renderOrder = 29;
    selectionRoot.add(poleSegment);

    if (projectedPosition.lengthSq() > 0.0001) {
      const planeRadius = makeLine(
        [new THREE.Vector3(0, 0, 0), projectedPosition],
        new THREE.LineBasicMaterial({
          color: palette.projection,
          transparent: true,
          opacity: 0.52,
          depthTest: false,
          depthWrite: false,
        }),
      );
      planeRadius.renderOrder = 27;
      selectionRoot.add(planeRadius);
    }

    updateReadouts(selected, projectedPosition);
  }

  function applyVisibility() {
    poleRoot.visible = state.showPoles;
    labelRoot.visible = state.showLabels;
    zoneRoot.visible = state.showZones;
    planeRoot.visible = state.showPlane;
    planeCurveRoot.visible = state.showPlane && state.showZones;
    planePoleRoot.visible = state.showPlane && state.showPoles;
    planeLabelRoot.visible = state.showPlane && state.showLabels;
  }

  function selectPoleAt(event) {
    if (!state.showPoles) return;
    const hitMeshes = state.showPlane
      ? [...spherePoleHitMeshes, ...planePoleHitMeshes]
      : spherePoleHitMeshes;
    if (!hitMeshes.length) return;
    const rect = renderer.domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(hitMeshes, false)[0];
    if (!hit || hit.instanceId === undefined) return;
    const record = hit.object.userData.records?.[hit.instanceId];
    if (!record || record.key === state.selectedKey) return;
    state.selectedKey = record.key;
    rebuildLabels();
    rebuildSelection();
  }

  function updateReadouts(selected, projectedPosition) {
    const poleText = formatMillerSpaced(selected.indices, "(", ")");
    const symmetryLabel = SYMMETRY_LABELS[classifyCubicSymmetry(selected.indices)];
    const angle = THREE.MathUtils.radToDeg(Math.acos(clamp(selected.vector.dot(NORTH), -1, 1)));
    const projectedRadius = projectedPosition.length() / SPHERE_RADIUS;
    if (els.centerReadout) els.centerReadout.textContent = poleText;
    if (els.poleReadout) {
      els.poleReadout.textContent = `${symmetryLabel} \u00b7 \u4e0e [0 0 1] \u5939\u89d2 ${angle.toFixed(1)}\u00b0 \u00b7 \u6295\u5f71\u534a\u5f84 ${projectedRadius.toFixed(3)} R`;
    }
    if (els.viewerCenter) {
      els.viewerCenter.textContent = "[0 0 1] \u6807\u51c6\u53d6\u5411";
    }
  }

  function resetCamera() {
    const distance = fittedCameraDistance(camera.aspect);
    controls.target.set(0, 0, 0);
    camera.position.copy(INITIAL_CAMERA_DIRECTION).multiplyScalar(distance);
    camera.up.set(0, 0, 1);
    camera.lookAt(controls.target);
    controls.minDistance = distance * 0.56;
    controls.maxDistance = distance * 2.15;
    controls.update();
  }

  function resize() {
    const rect = els.host.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    const width = Math.round(rect.width);
    const height = Math.round(rect.height);
    const previousAspect = state.width && state.height ? state.width / state.height : 0;
    const nextAspect = width / height;
    const firstVisibleSize = state.width === 0 || state.height === 0;
    const layoutChanged = previousAspect && Math.abs(previousAspect - nextAspect) > 0.08;

    state.width = width;
    state.height = height;
    renderer.setSize(width, height, false);
    camera.aspect = nextAspect;
    camera.updateProjectionMatrix();

    if (firstVisibleSize) {
      resetCamera();
      rebuildLabels();
    } else if (layoutChanged) {
      const direction = camera.position.clone().sub(controls.target).normalize();
      const distance = fittedCameraDistance(nextAspect);
      camera.position.copy(controls.target).addScaledVector(direction, distance);
      controls.minDistance = distance * 0.56;
      controls.maxDistance = distance * 2.15;
      controls.update();
      rebuildLabels();
    }
  }

  function exportPng() {
    controls.update();
    renderer.render(scene, camera);
    const selected = poleRecords.find((record) => record.key === state.selectedKey);
    const suffix = selected
      ? selected.indices.map((value) => value < 0 ? `m${Math.abs(value)}` : value).join("")
      : "111";
    downloadCanvasPngWithWatermark(
      renderer.domElement,
      `stereographic-3d-${suffix}.png`,
    );
  }
}

function stereographicProjection(unitVector, radius) {
  const denominator = 1 + unitVector.z;
  return new THREE.Vector3(
    (unitVector.x / denominator) * radius,
    (unitVector.y / denominator) * radius,
    0,
  );
}

function stereographicRadius(colatitude) {
  return Math.tan(colatitude / 2);
}

function makeGreatCircle(normal, radius, material) {
  const helper = Math.abs(normal.z) < 0.86
    ? new THREE.Vector3(0, 0, 1)
    : new THREE.Vector3(0, 1, 0);
  const basisA = normal.clone().cross(helper).normalize();
  const basisB = normal.clone().cross(basisA).normalize();
  const points = [];

  for (let index = 0; index < 192; index += 1) {
    const angle = (index / 192) * Math.PI * 2;
    points.push(
      basisA.clone()
        .multiplyScalar(Math.cos(angle))
        .addScaledVector(basisB, Math.sin(angle))
        .multiplyScalar(radius),
    );
  }
  return makeLineLoop(points, material);
}

function makeProjectedGreatCircle(normal, radius, material) {
  const helper = Math.abs(normal.z) < 0.86
    ? new THREE.Vector3(0, 0, 1)
    : new THREE.Vector3(0, 1, 0);
  const basisA = normal.clone().cross(helper).normalize();
  const basisB = normal.clone().cross(basisA).normalize();
  const sampleCount = 256;
  const segments = [];
  let segment = [];
  let firstVisible = false;
  let lastVisible = false;

  for (let index = 0; index <= sampleCount; index += 1) {
    const angle = (index / sampleCount) * Math.PI * 2;
    const point = basisA.clone()
      .multiplyScalar(Math.cos(angle))
      .addScaledVector(basisB, Math.sin(angle));
    const visible = point.z >= -1e-7;
    if (index === 0) firstVisible = visible;
    if (index === sampleCount) lastVisible = visible;

    if (visible) {
      const projected = stereographicProjection(point, radius);
      projected.z = 0.018;
      segment.push(projected);
    } else if (segment.length > 1) {
      segments.push(segment);
      segment = [];
    } else {
      segment = [];
    }
  }
  if (segment.length > 1) segments.push(segment);

  if (firstVisible && lastVisible && segments.length > 1) {
    const merged = [
      ...segments[segments.length - 1],
      ...segments[0].slice(1),
    ];
    segments.splice(0, 1, merged);
    segments.pop();
  }

  const group = new THREE.Group();
  segments.forEach((points) => {
    group.add(makeLine(points, material));
  });
  return group;
}

function makeSymmetryGlyphLayer(records, options) {
  const root = new THREE.Group();
  const groupedRecords = new Map();
  records.forEach((record) => {
    const type = classifyCubicSymmetry(record.indices);
    if (!groupedRecords.has(type)) groupedRecords.set(type, []);
    groupedRecords.get(type).push(record);
  });

  groupedRecords.forEach((groupRecords, type) => {
    const color = type === "general"
      ? options.regularColor
      : options.symmetryColor;
    const geometry = createSymmetryGlyphGeometry(type, options.baseSize);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.1,
      roughness: 0.28,
      metalness: 0.03,
      side: THREE.DoubleSide,
      depthTest: options.depthTest,
      depthWrite: options.depthTest,
    });
    const glyphs = new THREE.InstancedMesh(geometry, material, groupRecords.length);
    const matrix = new THREE.Matrix4();
    const scale = new THREE.Vector3(1, 1, 1);

    groupRecords.forEach((record, index) => {
      const position = options.positionFor(record);
      const quaternion = options.quaternionFor?.(record, position)
        || new THREE.Quaternion();
      matrix.compose(position, quaternion, scale);
      glyphs.setMatrixAt(index, matrix);
    });

    glyphs.instanceMatrix.needsUpdate = true;
    glyphs.computeBoundingSphere?.();
    glyphs.renderOrder = options.renderOrder;
    root.add(glyphs);
  });

  const hitGeometry = new THREE.SphereGeometry(options.hitRadius, 10, 8);
  const hitMaterial = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthTest: false,
    depthWrite: false,
    colorWrite: false,
  });
  const hitTargets = new THREE.InstancedMesh(hitGeometry, hitMaterial, records.length);
  const hitMatrix = new THREE.Matrix4();

  records.forEach((record, index) => {
    const position = options.positionFor(record);
    hitMatrix.makeTranslation(position.x, position.y, position.z);
    hitTargets.setMatrixAt(index, hitMatrix);
  });

  hitTargets.instanceMatrix.needsUpdate = true;
  hitTargets.computeBoundingSphere?.();
  hitTargets.userData.records = records;
  root.add(hitTargets);
  return { root, hitMeshes: [hitTargets] };
}

function makeSymmetryGlyphMesh(record, options) {
  const type = classifyCubicSymmetry(record.indices);
  const geometry = createSymmetryGlyphGeometry(type, options.baseSize);
  const material = new THREE.MeshStandardMaterial({
    color: options.color,
    emissive: options.color,
    emissiveIntensity: 0.23,
    roughness: 0.24,
    metalness: 0.1,
    side: THREE.DoubleSide,
    depthTest: options.depthTest,
    depthWrite: options.depthTest,
  });
  const glyph = new THREE.Mesh(geometry, material);
  glyph.position.copy(options.position);
  glyph.quaternion.copy(options.quaternion || new THREE.Quaternion());
  return glyph;
}

function createSymmetryGlyphGeometry(type, baseSize) {
  if (type === "fourfold") {
    const geometry = new THREE.CylinderGeometry(
      baseSize * 0.88,
      baseSize * 0.88,
      baseSize * 0.34,
      4,
      1,
      false,
    );
    geometry.rotateX(Math.PI / 2);
    geometry.rotateZ(Math.PI / 4);
    return geometry;
  }
  if (type === "threefold") {
    const geometry = new THREE.CylinderGeometry(
      baseSize * 0.96,
      baseSize * 0.96,
      baseSize * 0.34,
      3,
      1,
      false,
    );
    geometry.rotateX(Math.PI / 2);
    geometry.rotateZ(-Math.PI / 6);
    return geometry;
  }
  if (type === "twofold") {
    const geometry = new THREE.SphereGeometry(baseSize * 0.72, 18, 10);
    geometry.scale(1.45, 0.66, 0.42);
    return geometry;
  }
  return new THREE.SphereGeometry(baseSize * 0.5, 16, 10);
}

function makePlanarCircle(radius, z, material, segments) {
  const points = [];
  for (let index = 0; index < segments; index += 1) {
    const angle = (index / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      z,
    ));
  }
  return makeLineLoop(points, material);
}

function makeLineLoop(points, material) {
  return new THREE.LineLoop(
    new THREE.BufferGeometry().setFromPoints(points),
    material,
  );
}

function makeLine(points, material) {
  return new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    material,
  );
}

function makeTextSprite(text, color, strokeColor, selected, requestedHeight = null) {
  const canvas = document.createElement("canvas");
  canvas.width = 384;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `${selected ? 800 : 720} 64px "Microsoft YaHei", "PingFang SC", Arial, sans-serif`;
  context.lineJoin = "round";
  context.lineWidth = selected ? 13 : 11;
  context.strokeStyle = strokeColor;
  context.strokeText(text, canvas.width / 2, canvas.height / 2 + 2);
  context.fillStyle = color;
  context.fillText(text, canvas.width / 2, canvas.height / 2 + 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(material);
  const height = requestedHeight ?? (selected ? 0.25 : 0.21);
  sprite.scale.set(height * (canvas.width / canvas.height), height, 1);
  return sprite;
}

function classifyCubicSymmetry(indices) {
  const nonzero = indices
    .map((value) => Math.abs(value))
    .filter((value) => value !== 0);
  if (nonzero.length === 1) return "fourfold";
  if (nonzero.length === 3 && nonzero.every((value) => value === nonzero[0])) {
    return "threefold";
  }
  if (nonzero.length === 2 && nonzero[0] === nonzero[1]) {
    return "twofold";
  }
  return "general";
}

function generatePrimitiveVectors(maxIndex, canonicalAntipodes) {
  const vectors = [];
  for (let h = -maxIndex; h <= maxIndex; h += 1) {
    for (let k = -maxIndex; k <= maxIndex; k += 1) {
      for (let l = -maxIndex; l <= maxIndex; l += 1) {
        if (h === 0 && k === 0 && l === 0) continue;
        if (greatestCommonDivisor3(Math.abs(h), Math.abs(k), Math.abs(l)) !== 1) continue;
        if (canonicalAntipodes && firstNonzero(h, k, l) < 0) continue;
        const normSq = h * h + k * k + l * l;
        vectors.push({
          indices: [h, k, l],
          key: `${h},${k},${l}`,
          normSq,
          vector: new THREE.Vector3(h, k, l).normalize(),
        });
      }
    }
  }
  return vectors.sort((first, second) => (
    first.normSq - second.normSq
    || first.indices[2] - second.indices[2]
    || first.indices[1] - second.indices[1]
    || first.indices[0] - second.indices[0]
  ));
}

function formatMillerCompact(indices) {
  return indices.map((value) => {
    const digits = String(Math.abs(value));
    if (value >= 0) return digits;
    return [...digits].map((digit) => `${digit}\u0305`).join("");
  }).join("");
}

function formatMillerSpaced(indices, open, close) {
  const body = indices
    .map((value) => value < 0 ? `\u2212${Math.abs(value)}` : String(value))
    .join(" ");
  return `${open}${body}${close}`;
}

function currentPalette() {
  const theme = currentTheme();
  if (theme === "dark") {
    return {
      background: "#12161f",
      sphereSurface: "#475569",
      sphereWire: "#334155",
      sphereGrid: "#38bdf8",
      sphereOpacity: 0.04,
      wireOpacity: 0.20,
      gridOpacity: 0.22,
      plane: "#64748b",
      planeOpacity: 0.18,
      planeGrid: "#475569",
      planeGridOpacity: 0.32,
      planeOutline: "#94a3b8",
      planeOutlineOpacity: 0.65,
      standardCurve: "#38bdf8",
      standardCurveMajor: "#818cf8",
      standardCurveOpacity: 0.62,
      standardCurveMajorOpacity: 0.88,
      standardPole: "#67e8f9",
      standardPoleMajor: "#c084fc",
      standardLabel: "#f1f5f9",
      zone: "#a78bfa",
      zoneMajor: "#c084fc",
      zoneOpacity: 0.36,
      zoneMajorOpacity: 0.70,
      pole: "#60a5fa",
      poleMajor: "#a78bfa",
      label: "#f8fafc",
      labelStroke: "rgba(18, 22, 31, 0.95)",
      selectedPole: "#fbbf24",
      projection: "#f43f5e",
      source: "#94a3b8",
    };
  }
  if (theme === "gray") {
    return {
      background: "#dce2ea",
      sphereSurface: "#475569",
      sphereWire: "#64748b",
      sphereGrid: "#0369a1",
      sphereOpacity: 0.06,
      wireOpacity: 0.26,
      gridOpacity: 0.30,
      plane: "#64748b",
      planeOpacity: 0.18,
      planeGrid: "#94a3b8",
      planeGridOpacity: 0.42,
      planeOutline: "#475569",
      planeOutlineOpacity: 0.72,
      standardCurve: "#1d4ed8",
      standardCurveMajor: "#1e3a8a",
      standardCurveOpacity: 0.62,
      standardCurveMajorOpacity: 0.88,
      standardPole: "#0369a1",
      standardPoleMajor: "#3730a3",
      standardLabel: "#0f172a",
      zone: "#6d28d9",
      zoneMajor: "#5b21b6",
      zoneOpacity: 0.38,
      zoneMajorOpacity: 0.68,
      pole: "#1d4ed8",
      poleMajor: "#4338ca",
      label: "#0f172a",
      labelStroke: "rgba(220, 226, 234, 0.96)",
      selectedPole: "#b45309",
      projection: "#be123c",
      source: "#475569",
    };
  }
  return {
    background: "#f8fafc",
    sphereSurface: "#64748b",
    sphereWire: "#94a3b8",
    sphereGrid: "#0284c7",
    sphereOpacity: 0.05,
    wireOpacity: 0.22,
    gridOpacity: 0.26,
    plane: "#94a3b8",
    planeOpacity: 0.16,
    planeGrid: "#cbd5e1",
    planeGridOpacity: 0.36,
    planeOutline: "#64748b",
    planeOutlineOpacity: 0.68,
    standardCurve: "#2563eb",
    standardCurveMajor: "#1e40af",
    standardCurveOpacity: 0.58,
    standardCurveMajorOpacity: 0.85,
    standardPole: "#0284c7",
    standardPoleMajor: "#4338ca",
    standardLabel: "#0f172a",
    zone: "#7c3aed",
    zoneMajor: "#6d28d9",
    zoneOpacity: 0.35,
    zoneMajorOpacity: 0.65,
    pole: "#2563eb",
    poleMajor: "#4f46e5",
    label: "#0f172a",
    labelStroke: "rgba(255, 255, 255, 0.96)",
    selectedPole: "#d97706",
    projection: "#e11d48",
    source: "#64748b",
  };
}

function fittedCameraDistance(aspect) {
  const fitRadius = SPHERE_RADIUS + 0.48;
  const verticalFov = THREE.MathUtils.degToRad(36);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(0.2, aspect));
  const limitingFov = Math.min(verticalFov, horizontalFov);
  return (fitRadius / Math.tan(limitingFov / 2)) * 1.06;
}

function clearGroup(group) {
  const geometries = new Set();
  const materials = new Set();
  const textures = new Set();

  group.traverse((object) => {
    if (object.geometry) geometries.add(object.geometry);
    const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
    objectMaterials.filter(Boolean).forEach((material) => {
      materials.add(material);
      if (material.map) textures.add(material.map);
    });
  });

  group.clear();
  textures.forEach((texture) => texture.dispose());
  materials.forEach((material) => material.dispose());
  geometries.forEach((geometry) => geometry.dispose());
}

function currentTheme() {
  return document.documentElement.dataset.theme || "light";
}

function isDarkTheme() {
  return currentTheme() === "dark";
}

function stereoToneExposure() {
  const theme = currentTheme();
  if (theme === "dark") return 1.16;
  if (theme === "gray") return 1.02;
  return 1.04;
}

function firstNonzero(...values) {
  return values.find((value) => value !== 0) || 0;
}

function greatestCommonDivisor3(a, b, c) {
  return greatestCommonDivisor(greatestCommonDivisor(a, b), c);
}

function greatestCommonDivisor(a, b) {
  let first = a;
  let second = b;
  while (second !== 0) {
    const remainder = first % second;
    first = second;
    second = remainder;
  }
  return first;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
