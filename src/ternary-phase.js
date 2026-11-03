import * as THREE from "three";
import { createTextbookDiagrams, createEutecticDiagrams, polygonArea } from "./ternary-textbook-models.js?v=20261008-phase-audit-motion";
import { createSceneLoop, disposeSceneChildren } from "./scene-loop.js?v=20261008-phase-audit-motion";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { downloadCanvasPngWithWatermark } from "./export-watermark.js?v=20261008-phase-audit-motion";

const LOW_T = 0.04;
const AXIS_TOP_T = 1.02;
const SECTION_NODE_DECIMALS = 3;
const SECTION_SIMPLIFY_TOLERANCE = 0.008;
const SECTION_SMOOTH_SAMPLE_LIMIT = 220;

const TEMP_LABELS = {
  low: "低温",
  eutectic: "三元共晶温度 TE",
  high: "温度 T",
};

const DIAGRAMS = [...createEutecticDiagrams(), ...createTextbookDiagrams()];


function createStableCompoundDiagram() {
  const D = point([0.56, 0.44, 0], 0.78);
  const E1 = point([0.34, 0.2, 0.46], 0.32);
  const E2 = point([0.18, 0.45, 0.37], 0.34);
  const dTop = point([0.56, 0.44, 0], 0.72);
  const dBottom = point([0.56, 0.44, 0], LOW_T);
  const aDE = bezierCurve(point([0.74, 0.26, 0], 0.48), point([0.55, 0.25, 0.2], 0.39), E1, 18);
  const dCE = bezierCurve(D, point([0.42, 0.34, 0.24], 0.5), E1, 18);
  const dBE = bezierCurve(D, point([0.34, 0.48, 0.18], 0.52), E2, 18);
  const bCE = bezierCurve(point([0, 0.54, 0.46], 0.42), point([0.14, 0.48, 0.38], 0.37), E2, 18);

  return {
    id: "stable-compound",
    title: "6. 形成稳定化合物的三元系相图",
    subtitle: "AB 边形成稳定化合物 δ，将体系分成 A-δ-C 与 δ-B-C 两个子三角形",
    guides: makeGuideSpec([aDE, dCE, dBE, bCE], [{ point: D, text: "δ" }, { point: E1, text: "E1" }, { point: E2, text: "E2" }]),
    regions: [
      genericRuledRegion({
        id: "sc-liquid-a",
        title: "L + A",
        phase: "L + A",
        kind: "液固两相区",
        color: 0x0284c7,
        apexTop: point([1, 0, 0], 0.94),
        apexBottom: point([1, 0, 0], E1.t),
        upperBoundary: aDE,
        lowerBoundary: cornerBoundary("A", E1.t, 0.09),
        shape: "A-δ-C 子三角形内的 A 初晶曲面体",
        temperature: "A 初晶液相面以下",
        composition: "A 富集侧",
        note: "稳定化合物 δ 出现后，A-B 边不再是简单二元边，而被 δ 分割成新的相图单元。",
      }),
      genericRuledRegion({
        id: "sc-liquid-delta",
        title: "L + δ",
        phase: "L + δ",
        kind: "化合物初晶区",
        color: 0x6366f1,
        apexTop: D,
        apexBottom: dTop,
        upperBoundary: joinCurves(reverseCurve(dCE), dBE),
        lowerBoundary: compoundBoundary(D.b, 0.44, 0.05),
        shape: "稳定化合物 δ 上方的屋脊状初晶区",
        temperature: "δ 熔点附近至两侧共晶沟",
        composition: "围绕化合物化学计量点",
        note: "稳定化合物在液相面上表现为独立初晶区，类似新增的一个固相顶点。",
      }),
      genericRuledRegion({
        id: "sc-liquid-b",
        title: "L + B",
        phase: "L + B",
        kind: "液固两相区",
        color: 0xd97706,
        apexTop: point([0, 1, 0], 0.88),
        apexBottom: point([0, 1, 0], E2.t),
        upperBoundary: reverseCurve(dBE),
        lowerBoundary: cornerBoundary("B", E2.t, 0.08),
        shape: "δ-B-C 子三角形内的 B 初晶曲面体",
        temperature: "B 初晶液相面以下",
        composition: "B 富集侧",
        note: "B 初晶面与 δ 初晶面之间通过 δ-B 共晶沟分隔。",
      }),
      genericRuledRegion({
        id: "sc-liquid-c",
        title: "L + C",
        phase: "L + C",
        kind: "液固两相区",
        color: 0x7c3aed,
        apexTop: point([0, 0, 1], 0.91),
        apexBottom: point([0, 0, 1], Math.min(E1.t, E2.t)),
        upperBoundary: joinCurves(reverseCurve(bCE), reverseCurve(dCE)),
        lowerBoundary: cornerBoundary("C", E1.t, 0.08),
        shape: "C 端初晶面同时接触两个子三角形共晶沟",
        temperature: "C 初晶液相面以下",
        composition: "C 富集侧",
        note: "C 与 A-δ、δ-B 两个子体系都发生共晶关系，因此 C 初晶面被两组沟线夹持。",
      }),
      curvedRibbonRegion("sc-eutectic-a-d-c", "L + A + δ / L + δ + C", "L + A + δ / L + δ + C", 0x06b6d4, joinCurves(aDE, reverseCurve(dCE)), point([0.74, 0.22, 0.04], E1.t), point([0.36, 0.26, 0.38], E1.t), "A-δ-C 子三角形中的共晶沟"),
      curvedRibbonRegion("sc-eutectic-d-b-c", "L + δ + B / L + B + C", "L + δ + B / L + B + C", 0xea580c, joinCurves(dBE, reverseCurve(bCE)), point([0.38, 0.52, 0.1], E2.t), point([0.08, 0.58, 0.34], E2.t), "δ-B-C 子三角形中的共晶沟"),
      genericRuledRegion({
        id: "sc-delta",
        title: "δ 稳定化合物",
        phase: "δ",
        kind: "中间化合物相区",
        color: 0x4f46e5,
        apexTop: dTop,
        apexBottom: dBottom,
        upperBoundary: compoundBoundary(D.b, 0.42, 0.055),
        lowerBoundary: compoundBoundary(D.b, LOW_T, 0.04),
        shape: "沿 AB 边化学计量点上下延伸的窄脊状相区",
        temperature: "低温至 δ 熔点附近",
        composition: "接近 δ 化学计量成分",
        note: "稳定化合物有固定或窄范围成分，因此在三元空间图中表现为窄脊或窄带。",
      }),
      prismRegion("sc-a-delta", "A + δ", "A + δ", "两固相区", 0x10b981,
        [point([0.9, 0.1, 0], LOW_T), point([0.58, 0.4, 0.02], LOW_T), point([0.46, 0.34, 0.2], LOW_T), point([0.74, 0.14, 0.12], LOW_T)],
        [point([0.82, 0.18, 0], E1.t), point([0.58, 0.38, 0.04], E1.t), point([0.44, 0.34, 0.22], E1.t), point([0.68, 0.18, 0.14], E1.t)],
        "A 与稳定化合物 δ 之间的两固相带", "低于 A-δ-C 共晶沟", "A-δ 连线附近", "δ 将原 A-B 边分割后，A+δ 成为低温重要两相区。"),
      prismRegion("sc-delta-b", "δ + B", "δ + B", "两固相区", 0xf59e0b,
        [point([0.58, 0.4, 0.02], LOW_T), point([0.08, 0.9, 0.02], LOW_T), point([0.16, 0.66, 0.18], LOW_T), point([0.46, 0.34, 0.2], LOW_T)],
        [point([0.58, 0.38, 0.04], E2.t), point([0.12, 0.82, 0.06], E2.t), point([0.2, 0.58, 0.22], E2.t), point([0.44, 0.34, 0.22], E2.t)],
        "δ 与 B 之间的两固相带", "低于 δ-B-C 共晶沟", "δ-B 连线附近", "稳定化合物另一侧与 B 形成两相平衡。"),
      prismRegion("sc-delta-c", "δ + C", "δ + C", "两固相区", 0x8b5cf6,
        [point([0.46, 0.34, 0.2], LOW_T), point([0.08, 0.08, 0.84], LOW_T), point([0.28, 0.3, 0.42], LOW_T), point([0.34, 0.18, 0.48], LOW_T)],
        [point([0.44, 0.34, 0.22], E1.t), point([0.1, 0.12, 0.78], E1.t), point([0.28, 0.3, 0.42], E1.t), point([0.34, 0.22, 0.44], E1.t)],
        "δ 与 C 之间的两固相带", "低于两组子三角形共晶沟", "δ-C 连线附近", "C 与稳定化合物 δ 共同构成两个子体系的公共低温边界。"),
    ],
  };
}

function createFallbackCanvasRenderer() {
  const canvas = document.createElement("canvas");
  let width = 640;
  let height = 480;
  let pixelRatio = 1;
  return {
    domElement: canvas,
    outputColorSpace: "",
    toneMapping: 0,
    toneMappingExposure: 1,
    setPixelRatio(pr) {
      pixelRatio = Math.max(1, pr || 1);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
    },
    setSize(w, h, updateStyle = true) {
      width = Math.max(1, w || 640);
      height = Math.max(1, h || 480);
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      if (updateStyle !== false) {
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
      }
    },
    render(scene, camera) {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.save();
      ctx.scale(pixelRatio, pixelRatio);
      const bgHex = scene.background ? `#${scene.background.getHexString()}` : "#f3f7fa";
      ctx.fillStyle = bgHex;
      ctx.fillRect(0, 0, width, height);
      scene.updateMatrixWorld?.(true);
      camera.updateMatrixWorld?.(true);
      camera.updateProjectionMatrix?.();

      const projectVec = (vec) => {
        const v = vec.clone().project(camera);
        return {
          x: (v.x * 0.5 + 0.5) * width,
          y: (-v.y * 0.5 + 0.5) * height,
          z: v.z,
        };
      };

      const drawList = [];
      scene.traverse((obj) => {
        if (!obj.visible) return;
        let p = obj.parent;
        while (p) {
          if (!p.visible) return;
          p = p.parent;
        }
        if ((obj.isLine || obj.isLineSegments) && obj.geometry?.attributes?.position) {
          const pos = obj.geometry.attributes.position;
          const color = obj.material?.color ? `#${obj.material.color.getHexString()}` : "#334155";
          const alpha = obj.material?.opacity ?? 0.8;
          if (alpha <= 0.01) return;
          const step = obj.isLineSegments ? 2 : 1;
          for (let i = 0; i < pos.count - 1; i += step) {
            const a = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld);
            const b = new THREE.Vector3().fromBufferAttribute(pos, i + 1).applyMatrix4(obj.matrixWorld);
            const pa = projectVec(a);
            const pb = projectVec(b);
            drawList.push({ type: "line", z: (pa.z + pb.z) * 0.5, pa, pb, color, alpha });
          }
        } else if (obj.isSprite && obj.material?.map?.image) {
          const center = new THREE.Vector3().setFromMatrixPosition(obj.matrixWorld);
          const pc = projectVec(center);
          drawList.push({ type: "sprite", z: pc.z - 0.1, pc, img: obj.material.map.image, scale: obj.scale });
        }
      });

      drawList.sort((a, b) => b.z - a.z);
      for (const item of drawList) {
        if (item.type === "line") {
          ctx.strokeStyle = item.color;
          ctx.globalAlpha = item.alpha;
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          ctx.moveTo(item.pa.x, item.pa.y);
          ctx.lineTo(item.pb.x, item.pb.y);
          ctx.stroke();
        } else if (item.type === "sprite" && item.img) {
          ctx.globalAlpha = 1;
          const sw = Math.max(18, item.scale.x * 75);
          const sh = Math.max(12, item.scale.y * 75);
          ctx.drawImage(item.img, item.pc.x - sw / 2, item.pc.y - sh / 2, sw, sh);
        }
      }
      ctx.restore();
    },
  };
}

function createSafeRenderer() {
  const candidates = [
    { antialias: true, alpha: false, preserveDrawingBuffer: true, powerPreference: "high-performance" },
    { antialias: false, alpha: false, preserveDrawingBuffer: true },
    { antialias: false, alpha: false, preserveDrawingBuffer: false },
  ];
  for (const opts of candidates) {
    try {
      const r = new THREE.WebGLRenderer(opts);
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.toneMapping = THREE.ACESFilmicToneMapping;
      r.toneMappingExposure = 1.04;
      return r;
    } catch (_err) {
      // Try next WebGLRenderer configuration
    }
  }
  return createFallbackCanvasRenderer();
}

export function initTernaryPhaseModule() {
  try {
    const els = {
      host: document.querySelector("#ternaryViewerHost"),
      viewPanel: document.querySelector(".ternary-view-panel"),
      diagramSelect: document.querySelector("#ternaryDiagramSelect"),
      diagramButtons: document.querySelector("#ternaryDiagramButtons"),
      diagramSummary: document.querySelector("#ternaryDiagramSummary"),
      sectionPresets: document.querySelector("#ternarySectionPresets"),
      regionList: document.querySelector("#ternaryRegionList"),
      regionSelect: document.querySelector("#ternaryRegionSelect"),
      title: document.querySelector("#ternaryRegionTitle"),
      phase: document.querySelector("#ternaryPhaseReadout"),
      kind: document.querySelector("#ternaryKindReadout"),
      temperature: document.querySelector("#ternaryTemperatureReadout"),
      composition: document.querySelector("#ternaryCompositionReadout"),
      shape: document.querySelector("#ternaryShapeReadout"),
      note: document.querySelector("#ternaryNote"),
      onlyButton: document.querySelector("#ternaryOnlyButton"),
      dragRegionButton: document.querySelector("#ternaryDragRegionButton"),
      resetRegionsButton: document.querySelector("#ternaryResetRegionsButton"),
      resetButton: document.querySelector("#ternaryResetButton"),
      exportButton: document.querySelector("#ternaryExportButton"),
      mobileSectionToggle: document.querySelector("#ternaryMobileSectionToggle"),
      sectionCard: document.querySelector(".ternary-section-card"),
      legend: document.querySelector("#ternaryLegend"),
      sectionModeButtons: document.querySelectorAll("[data-ternary-section-mode]"),
      horizontalSection: document.querySelector("#ternaryHorizontalSection"),
      verticalSection: document.querySelector("#ternaryVerticalSection"),
      sectionTemp: document.querySelector("#ternarySectionTemp"),
      point1A: document.querySelector("#ternaryPoint1A"),
      point1B: document.querySelector("#ternaryPoint1B"),
      point1C: document.querySelector("#ternaryPoint1C"),
      point2A: document.querySelector("#ternaryPoint2A"),
      point2B: document.querySelector("#ternaryPoint2B"),
      point2C: document.querySelector("#ternaryPoint2C"),
      applySectionButton: document.querySelector("#ternaryApplySectionButton"),
      standaloneSectionButton: document.querySelector("#ternaryStandaloneSectionButton"),
      clearSectionButton: document.querySelector("#ternaryClearSectionButton"),
      sectionStatus: document.querySelector("#ternarySectionStatus"),
      returnSpaceButton: document.querySelector("#ternaryReturnSpaceButton"),
      viewModeTitle: document.querySelector("#ternaryViewModeTitle"),
      viewModeMeta: document.querySelector("#ternaryViewModeMeta"),
    };

    if (!els.host) return { refresh: () => {} };

    const state = {
      diagramId: DIAGRAMS[0].id,
      selectedId: DIAGRAMS[0].regions[0].id,
      showOnlySelected: false,
      sectionMode: "horizontal",
      sectionVisible: false,
      sectionStandalone: false,
      sectionTemp: 0.42,
      sectionP1: [1, 0, 0],
      sectionP2: [0, 1, 0],
      dragMode: false,
      draggingRegionId: null,
      dragMoved: false,
      regionOffsets: new Map(),
    };

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(ternarySceneBackground());

    const renderer = createSafeRenderer();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    els.host.innerHTML = "";
    els.host.appendChild(renderer.domElement);

    let cameraFrustum = 4.9;
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
    camera.up.set(0, 0, 1);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.rotateSpeed = 0.68;
    controls.zoomSpeed = 0.82;
    controls.enablePan = true;
    controls.panSpeed = 0.36;

    const root = new THREE.Group();
    const regionRoot = new THREE.Group();
    const guideRoot = new THREE.Group();
    const sectionRoot = new THREE.Group();
    root.add(regionRoot, guideRoot, sectionRoot);
    scene.add(root);

    const ambient = new THREE.HemisphereLight(0xf1f5f9, 0x9ca3af, 1.2);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xe2e8f0, 1.4);
    key.position.set(4.2, -5.2, 6.2);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xcbd5e1, 0.45);
    fill.position.set(-4.5, 2.6, 3.3);
    scene.add(fill);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const dragPlane = new THREE.Plane();
    const dragPoint = new THREE.Vector3();
    const dragOffset = new THREE.Vector3();
    const dragStart = new THREE.Vector2();
    const regionMeshes = new Map();

    wireUi();
    renderDiagramOptions();
    drawDiagram(true);
    resize();
    createSceneLoop({ host: els.host, controls, render: () => renderer.render(scene, camera) });

    if ("ResizeObserver" in window) {
      if (els.host) new ResizeObserver(resize).observe(els.host);
      if (els.legend) new ResizeObserver(updateSectionInsets).observe(els.legend);
    }
    window.addEventListener("resize", resize);
    window.addEventListener("mstool:themechange", () => {
      const theme = document.documentElement.dataset.theme;
      scene.background.set(ternarySceneBackground());
      renderer.toneMappingExposure = theme === "dark" ? 1.16 : theme === "gray" ? 1.0 : 1.04;
      drawDiagram(false);
    });

    return {
      refresh() {
        try {
          resize();
          controls.update();
          renderer.render(scene, camera);
          requestAnimationFrame(() => {
            try {
              resize();
              controls.update();
              renderer.render(scene, camera);
            } catch (_err) {}
          });
        } catch (_err) {}
      },
    };

    function wireUi() {
      els.diagramSelect?.addEventListener("change", () => {
        state.diagramId = els.diagramSelect.value;
        state.selectedId = selectedDiagram().regions[0].id;
        state.sectionVisible = false;
        state.sectionStandalone = false;
        state.regionOffsets.clear();
        disposeSceneChildren(sectionRoot);
        setDragMode(false);
        drawDiagram(true);
      });

      els.regionSelect?.addEventListener("change", () => {
        selectRegion(els.regionSelect.value);
      });

      els.onlyButton?.addEventListener("click", () => {
        state.showOnlySelected = !state.showOnlySelected;
        els.onlyButton.classList.toggle("is-active", state.showOnlySelected);
        els.onlyButton.setAttribute("aria-pressed", String(state.showOnlySelected));
        updateRegionStyles();
      });

      els.dragRegionButton?.addEventListener("click", () => setDragMode(!state.dragMode));
      els.resetRegionsButton?.addEventListener("click", resetRegionPositions);
      els.resetButton?.addEventListener("click", resetActiveView);
      els.exportButton?.addEventListener("click", exportPng);
      els.mobileSectionToggle?.addEventListener("click", () => {
        if (!els.sectionCard) return;
        const open = !els.sectionCard.classList.contains("is-mobile-open");
        els.sectionCard.classList.toggle("is-mobile-open", open);
        els.mobileSectionToggle.setAttribute("aria-expanded", String(open));
        els.mobileSectionToggle.title = open ? "收起截面" : "截面设置";
      });
      els.sectionModeButtons.forEach((button) => {
        button.addEventListener("click", () => {
          state.sectionMode = button.dataset.ternarySectionMode;
          els.sectionModeButtons.forEach((item) => item.classList.toggle("is-active", item === button));
          els.horizontalSection?.classList.toggle("is-hidden", state.sectionMode !== "horizontal");
          els.verticalSection?.classList.toggle("is-hidden", state.sectionMode !== "vertical");
          if (els.sectionStatus) {
            els.sectionStatus.textContent = state.sectionMode === "horizontal"
              ? "水平截面：输入温度 T 后获得该温度下的相区交线。"
              : "垂直截面：输入两个成分点 P1/P2 后获得穿过这两点的垂直剖面。";
          }
        });
      });
      els.applySectionButton?.addEventListener("click", applySectionFromInputs);
      els.standaloneSectionButton?.addEventListener("click", () => {
        if (state.sectionStandalone) exitStandaloneSection();
        else enterStandaloneSection();
      });
      els.returnSpaceButton?.addEventListener("click", exitStandaloneSection);
      els.clearSectionButton?.addEventListener("click", clearSection);

      renderer.domElement.addEventListener("click", (event) => {
        if (state.sectionStandalone || state.dragMoved) {
          state.dragMoved = false;
          return;
        }
        const hit = pickRegion(event);
        if (hit) selectRegion(hit.object.userData.regionId);
      });

      renderer.domElement.addEventListener("pointerdown", (event) => {
        if (!state.dragMode || state.sectionStandalone) return;
        const hit = pickRegion(event);
        if (!hit) return;
        event.preventDefault();
        const regionId = hit.object.userData.regionId;
        selectRegion(regionId);
        state.draggingRegionId = regionId;
        state.dragMoved = false;
        dragStart.set(event.clientX, event.clientY);
        const cameraDirection = new THREE.Vector3();
        camera.getWorldDirection(cameraDirection);
        dragPlane.setFromNormalAndCoplanarPoint(cameraDirection, hit.point);
        const group = regionMeshes.get(regionId)?.group;
        if (group) dragOffset.copy(group.position).sub(regionRoot.worldToLocal(hit.point.clone()));
        renderer.domElement.setPointerCapture?.(event.pointerId);
      });

      renderer.domElement.addEventListener("pointermove", (event) => {
        if (!state.draggingRegionId) return;
        event.preventDefault();
        updatePointer(event);
        raycaster.setFromCamera(pointer, camera);
        if (!raycaster.ray.intersectPlane(dragPlane, dragPoint)) return;
        const group = regionMeshes.get(state.draggingRegionId)?.group;
        if (!group) return;
        group.position.copy(regionRoot.worldToLocal(dragPoint)).add(dragOffset);
        state.regionOffsets.set(state.draggingRegionId, group.position.clone());
        if (dragStart.distanceTo(new THREE.Vector2(event.clientX, event.clientY)) > 3) state.dragMoved = true;
      });

      const endRegionDrag = (event) => {
        if (!state.draggingRegionId) return;
        state.draggingRegionId = null;
        renderer.domElement.releasePointerCapture?.(event.pointerId);
      };
      renderer.domElement.addEventListener("pointerup", endRegionDrag);
      renderer.domElement.addEventListener("pointercancel", endRegionDrag);
    }

    function renderDiagramOptions() {
      if (els.diagramSelect) {
        els.diagramSelect.innerHTML = DIAGRAMS.map((diagram) => `
          <option value="${diagram.id}">${diagram.shortTitle || diagram.title}</option>
        `).join("");
        els.diagramSelect.value = state.diagramId;
      }
      if (els.diagramButtons) {
        els.diagramButtons.innerHTML = DIAGRAMS.map((diagram) => `
          <button class="ternary-diagram-btn${diagram.id === state.diagramId ? " is-active" : ""}" type="button" data-diagram-id="${diagram.id}">
            ${diagram.shortTitle || diagram.title}
          </button>
        `).join("");
        els.diagramButtons.querySelectorAll("[data-diagram-id]").forEach((btn) => {
          btn.addEventListener("click", () => {
            if (state.diagramId === btn.dataset.diagramId) return;
            state.diagramId = btn.dataset.diagramId;
            state.selectedId = selectedDiagram().regions[0].id;
            state.sectionVisible = false;
            state.sectionStandalone = false;
            state.regionOffsets.clear();
            disposeSceneChildren(sectionRoot);
            renderDiagramOptions();
            drawDiagram(true);
          });
        });
      }
    }

    function drawDiagram(resetView) {
      disposeSceneChildren(regionRoot);
      disposeSceneChildren(guideRoot);
      regionMeshes.clear();

      const diagram = selectedDiagram();
      ambient.intensity = diagram.curvedLiquidus ? 0.8 : 1.55;
      key.intensity = diagram.curvedLiquidus ? 2.65 : 2.05;
      fill.intensity = diagram.curvedLiquidus ? 0.42 : 0.72;
      diagram.regions.forEach((region) => {
        const group = makeRegionGroup(region);
        const offset = state.regionOffsets.get(region.id);
        if (offset) group.position.copy(offset);
        regionRoot.add(group);
        regionMeshes.set(region.id, {
          group,
          mesh: group.userData.mesh,
          edges: group.userData.edges,
          liquidus: group.userData.liquidus,
          contours: group.userData.contours,
          region,
        });
      });

      guideRoot.add(makeCompositionGuide(diagram));
      guideRoot.add(makeCotecticGuide(diagram));
      if (els.diagramSummary) els.diagramSummary.textContent = "";
      if (els.sectionPresets) {
        const presets = diagram.checkpoints || [];
        els.sectionPresets.replaceChildren(...presets.map(item => {
          const button = document.createElement('button');
          button.type = 'button';
          button.className = 'segment';
          button.textContent = item.label;
          button.dataset.sectionTemperature = String(item.t);
          button.addEventListener('click', () => {
            els.sectionModeButtons[0]?.click();
            if (els.sectionTemp) els.sectionTemp.value = String(item.t);
            applySectionFromInputs();
            enterStandaloneSection();
          });
          return button;
        }));
      }
      renderRegionControls();
      renderLegend();
      selectRegion(state.selectedId);
      if (state.sectionVisible) drawSectionOverlay();
      updateViewMode();
      if (resetView) resetCamera();
      renderer.render(scene, camera);
    }

    function renderRegionControls() {
      const diagram = selectedDiagram();
      if (els.regionSelect) {
        els.regionSelect.innerHTML = diagram.regions.map((region) => `
          <option value="${region.id}">${region.title}</option>
        `).join("");
        els.regionSelect.value = state.selectedId;
      }

      if (els.regionList) {
        els.regionList.innerHTML = diagram.regions.map((region) => {
          const colorHex = typeof region.color === "number"
            ? `#${region.color.toString(16).padStart(6, "0")}`
            : (region.color || "#3b82f6");
          return `
          <button class="ternary-region-item${region.id === state.selectedId ? " is-active" : ""}" type="button" data-ternary-region="${region.id}" style="--region-accent: ${colorHex};">
            <div class="ternary-region-header">
              <strong class="ternary-region-name">${region.title}</strong>
              <span class="ternary-region-pill">${region.kind}</span>
            </div>
            <p class="ternary-region-detail">${region.shape ? region.shape : ('平衡相：' + region.phase)}</p>
          </button>
        `;
        }).join("");

        els.regionList.querySelectorAll("[data-ternary-region]").forEach((button) => {
          button.addEventListener("click", () => selectRegion(button.dataset.ternaryRegion));
        });
      }
    }

    function renderLegend() {
      if (!els.legend) return;
      const diagram = selectedDiagram();
      const preferredIds = new Set(["liquid-alpha", "liquid-beta", "liquid-gamma", "alpha", "beta", "gamma", "alpha-beta-gamma"]);
      const preferredRegions = diagram.regions.filter((region) => preferredIds.has(region.id));
      const legendRegions = preferredRegions.length ? preferredRegions : diagram.regions.slice(0, 9);
      els.legend.innerHTML = legendRegions
        .map((region) => `<span><i style="background:#${region.color.toString(16).padStart(6, "0")}"></i>${region.title}</span>`)
        .join("");
    }

    function selectRegion(regionId) {
      const diagram = selectedDiagram();
      const region = diagram.regions.find((item) => item.id === regionId) || diagram.regions[0];
      state.selectedId = region.id;

      if (els.regionSelect) els.regionSelect.value = region.id;
      els.regionList?.querySelectorAll("[data-ternary-region]").forEach((button) => {
        button.classList.toggle("is-active", button.dataset.ternaryRegion === region.id);
      });

      if (els.title) els.title.textContent = region.title;
      if (els.phase) els.phase.textContent = region.phase;
      if (els.kind) els.kind.textContent = region.kind;
      if (els.temperature) els.temperature.textContent = region.temperature;
      if (els.composition) els.composition.textContent = region.composition;
      if (els.shape) els.shape.textContent = region.shape;
      if (els.note) els.note.textContent = region.note;
      updateRegionStyles();
      updateViewMode();
      renderer.render(scene, camera);
    }

    function updateRegionStyles() {
      regionMeshes.forEach(({ mesh, edges, liquidus, contours, region }, regionId) => {
        const selected = regionId === state.selectedId;
        const hidden = state.showOnlySelected && !selected;
        const textbook = Boolean(selectedDiagram().curvedLiquidus);
        mesh.visible = !hidden;
        edges.visible = !hidden && (selected || (textbook && region.key !== 'L'));
        mesh.material.color.setHex(selected ? lightenHex(region.color, 0.18) : region.color);
        mesh.material.opacity = textbook
          ? (selected ? (state.showOnlySelected ? 0.56 : 0.34) : region.key === 'L' ? 0 : 0.085)
          : (selected ? 0.68 : 0.15);
        mesh.material.emissive.setHex(selected ? region.color : 0x000000);
        mesh.material.emissiveIntensity = selected ? 0.08 : 0;
        mesh.renderOrder = selected ? 20 : 2;
        edges.material.color.setHex(selected ? ternaryInkColor() : resolveTernaryLineColor(region.edgeColor ?? region.color));
        edges.material.opacity = selected ? 0.9 : textbook ? 0.30 : 0;
        edges.renderOrder = selected ? 21 : region.edgeRenderOrder ?? 3;
        if (liquidus) {
          liquidus.visible = !hidden;
          liquidus.material.opacity = selected ? 0.94 : 0.78;
          liquidus.renderOrder = selected ? 15 : 5;
          contours.visible = !hidden;
          contours.material.opacity = selected ? 0.36 : 0.16;
        }
      });
    }

    function applySectionFromInputs() {
      if (state.sectionMode === "horizontal") {
        const temp = clamp(Number(els.sectionTemp?.value ?? 0.42), LOW_T, AXIS_TOP_T);
        state.sectionTemp = temp;
        if (els.sectionTemp) els.sectionTemp.value = formatSectionNumber(temp);
      } else {
        const p1 = readCompositionPoint(els.point1A, els.point1B, els.point1C);
        const p2 = readCompositionPoint(els.point2A, els.point2B, els.point2C);
        if (!p1 || !p2 || compositionDistance(p1, p2) < 0.02) {
          if (els.sectionStatus) els.sectionStatus.textContent = "垂直截面需要两个不同的成分点，且每个点至少有一个非零成分。";
          return;
        }
        state.sectionP1 = p1;
        state.sectionP2 = p2;
        writeCompositionPoint([els.point1A, els.point1B, els.point1C], p1);
        writeCompositionPoint([els.point2A, els.point2B, els.point2C], p2);
      }
      state.sectionVisible = true;
      if (els.standaloneSectionButton) els.standaloneSectionButton.disabled = false;
      drawSectionOverlay();
      if (state.sectionStandalone) setStandaloneCamera();
    }

    function clearSection() {
      if (state.sectionStandalone) exitStandaloneSection();
      state.sectionVisible = false;
      disposeSceneChildren(sectionRoot);
      if (els.standaloneSectionButton) els.standaloneSectionButton.disabled = true;
      if (els.sectionStatus) els.sectionStatus.textContent = "已清除截面。";
      renderLegend();
      updateViewMode();
    }

    function drawSectionOverlay() {
      disposeSceneChildren(sectionRoot);
      const descriptor = makeSectionDescriptor();
      if (!descriptor) return;

      const planeMesh = descriptor.mode === "horizontal"
        ? makeHorizontalSectionPlane(descriptor.temp)
        : makeVerticalSectionPlane(descriptor.p1, descriptor.p2);
      sectionRoot.add(planeMesh);

      let segmentCount = 0;
      const diagram = selectedDiagram();
      const exactFields = descriptor.mode === 'horizontal' && diagram.sectionAt ? diagram.sectionAt(descriptor.temp) : null;
      const invariant = exactFields && diagram.invariant?.interior && Math.abs(descriptor.temp - diagram.invariant.temp) < 1e-8
        ? diagram.invariant : null;
      if (exactFields) {
        exactFields.forEach(field => sectionRoot.add(makeFilledSectionField(field, descriptor.temp,
          state.sectionStandalone && !(invariant && field.id === `${diagram.id}-Labg`))));
        if (invariant && state.sectionStandalone) sectionRoot.add(makeInvariantSectionGuide(invariant));
        segmentCount = exactFields.length;
        if (els.legend) {
          els.legend.innerHTML = exactFields.map(field => `<span><i style="background:#${field.color.toString(16).padStart(6, '0')}"></i>${field.phase}</span>`).join('');
        }
      } else diagram.regions.forEach((region) => {
        const segments = intersectRegionWithSection(region, descriptor);
        if (!segments.length) return;
        const sectionLines = makeSectionLines(segments, region.color);
        if (!sectionLines.children.length) return;
        segmentCount += sectionLines.userData.segmentCount || 0;
        sectionRoot.add(sectionLines);
      });

      if (state.sectionStandalone) {
        sectionRoot.add(makeStandaloneSectionGuide(descriptor));
      }

      if (els.sectionStatus) {
        els.sectionStatus.textContent = descriptor.mode === "horizontal"
          ? `T = ${formatSectionNumber(descriptor.temp)} · ${segmentCount} ${exactFields ? '个相区' : '条相区交线'} · 归一化温度`
          : `垂直截面 P1=${formatComposition(descriptor.p1)}，P2=${formatComposition(descriptor.p2)}，获得 ${segmentCount} 条相区交线。`;
      }
      updateViewMode();
    }

    function makeSectionDescriptor() {
      if (state.sectionMode === "horizontal") {
        return {
          mode: "horizontal",
          temp: state.sectionTemp,
          plane: new THREE.Plane(new THREE.Vector3(0, 0, 1), -state.sectionTemp * 2.35),
        };
      }

      const p1 = state.sectionP1;
      const p2 = state.sectionP2;
      const start = baryToVector(p1, LOW_T);
      const end = baryToVector(p2, LOW_T);
      const baseDirection = end.clone().sub(start);
      if (baseDirection.lengthSq() < 1e-8) return null;
      const normal = new THREE.Vector3().crossVectors(baseDirection, new THREE.Vector3(0, 0, 1)).normalize();
      return {
        mode: "vertical",
        p1,
        p2,
        plane: new THREE.Plane(normal, -normal.dot(start)),
      };
    }

    function setDragMode(enabled) {
      state.dragMode = Boolean(enabled) && !state.sectionStandalone;
      state.draggingRegionId = null;
      state.dragMoved = false;
      controls.enabled = !state.dragMode;
      controls.enableRotate = !state.sectionStandalone;
      els.dragRegionButton?.classList.toggle("is-active", state.dragMode);
      els.dragRegionButton?.setAttribute("aria-pressed", String(state.dragMode));
      renderer.domElement.style.cursor = state.dragMode ? "grab" : "default";
      updateViewMode();
    }

    function resetRegionPositions() {
      state.regionOffsets.clear();
      regionMeshes.forEach(({ group }) => group.position.set(0, 0, 0));
    }

    function updatePointer(event) {
      const rect = renderer.domElement.getBoundingClientRect();
      const w = Math.max(1, rect.width);
      const h = Math.max(1, rect.height);
      pointer.x = ((event.clientX - rect.left) / w) * 2 - 1;
      pointer.y = -(((event.clientY - rect.top) / h) * 2 - 1);
    }

    function pickRegion(event) {
      updatePointer(event);
      raycaster.setFromCamera(pointer, camera);
      const meshes = [...regionMeshes.values()]
        .filter(item => item.mesh.visible && (item.region.key !== 'L' || item.region.id === state.selectedId))
        .flatMap(item => [item.mesh, item.liquidus].filter(Boolean));
      return raycaster.intersectObjects(meshes, false)[0] || null;
    }

    function enterStandaloneSection() {
      if (!state.sectionVisible) return;
      state.sectionStandalone = true;
      setDragMode(false);
      controls.enableRotate = false;
      controls.enablePan = true;
      drawSectionOverlay();
      setStandaloneCamera();
      updateViewMode();
      if (window.matchMedia('(max-width: 820px)').matches) {
        els.viewPanel?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      }
    }

    function exitStandaloneSection() {
      if (!state.sectionStandalone) return;
      state.sectionStandalone = false;
      controls.enableRotate = true;
      controls.enablePan = true;
      drawSectionOverlay();
      renderLegend();
      resetCamera();
      updateViewMode();
    }

    function setStandaloneCamera() {
      const descriptor = makeSectionDescriptor();
      if (!descriptor) return;
      let center;
      cameraFrustum = 3.6;
      if (descriptor.mode === "horizontal") {
        const aspect = Math.max(1, els.host.clientWidth) / Math.max(1, els.host.clientHeight);
        cameraFrustum = Math.max(2.65, 2.95 / aspect);
        center = new THREE.Vector3(0, 0.35, descriptor.temp * 2.35);
        camera.position.copy(center).add(new THREE.Vector3(0, 0, -7));
        camera.up.set(0, -1, 0);
      } else {
        const corners = [
          baryToVector(descriptor.p1, LOW_T),
          baryToVector(descriptor.p2, LOW_T),
          baryToVector(descriptor.p2, AXIS_TOP_T),
          baryToVector(descriptor.p1, AXIS_TOP_T),
        ];
        center = corners.reduce((sum, point) => sum.add(point), new THREE.Vector3()).multiplyScalar(1 / corners.length);
        const width = corners[0].distanceTo(corners[1]);
        const height = corners[0].distanceTo(corners[3]);
        cameraFrustum = Math.max(3.2, Math.max(width, height) * 1.35);
        camera.position.copy(center).addScaledVector(descriptor.plane.normal, 7);
        camera.up.set(0, 0, 1);
      }
      controls.target.copy(center);
      camera.lookAt(center);
      resize();
      controls.update();
      renderer.render(scene, camera);
    }

    function resetActiveView() {
      if (state.sectionStandalone) setStandaloneCamera();
      else resetCamera();
    }

    function updateViewMode() {
      const region = selectedDiagram().regions.find((item) => item.id === state.selectedId) || selectedDiagram().regions[0];
      regionRoot.visible = !state.sectionStandalone;
      guideRoot.visible = !state.sectionStandalone;
      sectionRoot.visible = state.sectionVisible;
      // Place C at the front in the textbook spatial views; section coordinates stay unchanged.
      root.scale.y = selectedDiagram().curvedLiquidus && !state.sectionStandalone ? -1 : 1;
      els.viewPanel?.classList.toggle("is-section-standalone", state.sectionStandalone);
      updateSectionInsets();
      if (els.returnSpaceButton) els.returnSpaceButton.hidden = !state.sectionStandalone;
      if (els.standaloneSectionButton) {
        els.standaloneSectionButton.disabled = !state.sectionVisible;
        els.standaloneSectionButton.textContent = state.sectionStandalone ? "返回空间图" : "独立查看";
      }
      if (state.sectionStandalone) {
        const descriptor = makeSectionDescriptor();
        if (els.viewModeTitle) els.viewModeTitle.textContent = descriptor?.mode === "horizontal" ? "水平截面" : "垂直截面";
        if (els.viewModeMeta) {
          els.viewModeMeta.textContent = descriptor?.mode === "horizontal"
            ? `T = ${formatSectionNumber(descriptor.temp)}`
            : `P1 ${formatComposition(descriptor.p1)} · P2 ${formatComposition(descriptor.p2)}`;
        }
      } else {
        if (els.viewModeTitle) els.viewModeTitle.textContent = state.dragMode ? "相区分离" : "空间相图";
        if (els.viewModeMeta) els.viewModeMeta.textContent = `${selectedDiagram().shortTitle || selectedDiagram().title} · ${region.title}`;
      }
    }

    function selectedDiagram() {
      return DIAGRAMS.find((diagram) => diagram.id === state.diagramId) || DIAGRAMS[0];
    }

    function resetCamera() {
      const textbook = Boolean(selectedDiagram().curvedLiquidus);
      cameraFrustum = textbook ? 4.5 : 4.85;
      camera.up.set(0, 0, 1);
      camera.position.set(...(textbook ? [0.7, -7, 4.5] : [3.6, -4.8, 3.1]));
      controls.target.set(0, 0, textbook ? 1.16 : 0.86);
      camera.zoom = 1;
      camera.lookAt(controls.target);
      resize();
      controls.update();
    }

    function resize() {
      if (!els.host) return;
      const rect = els.host.getBoundingClientRect();
      const rawWidth = rect.width || els.host.clientWidth || els.viewPanel?.clientWidth || 720;
      const rawHeight = rect.height || els.host.clientHeight || 520;
      const width = Math.max(1, Math.round(rawWidth));
      const height = Math.max(1, Math.round(rawHeight));
      const aspect = width / height;
      const frustum = state.sectionStandalone && state.sectionMode === 'horizontal'
        ? Math.max(2.65, 2.95 / aspect)
        : selectedDiagram().curvedLiquidus && !state.sectionStandalone ? Math.max(cameraFrustum, 3.6 / aspect) : cameraFrustum;
      renderer.setSize(width, height, false);
      camera.left = (-frustum * aspect) / 2;
      camera.right = (frustum * aspect) / 2;
      camera.top = frustum / 2;
      camera.bottom = -frustum / 2;
      camera.updateProjectionMatrix();
    }

    function updateSectionInsets() {
      if (!state.sectionStandalone || !els.viewPanel || !els.legend) return;
      els.viewPanel.style.setProperty('--ternary-section-footer', `${els.legend.offsetHeight + 20}px`);
    }

    function exportPng() {
      renderer.render(scene, camera);
      downloadCanvasPngWithWatermark(renderer.domElement, `ternary-${state.diagramId}-${state.selectedId}.png`);
    }
  } catch (err) {
    console.warn("Ternary phase module initialization error:", err);
    return { refresh: () => {} };
  }
}

export { initTernaryPhaseModule as initTernaryPhase };

export function validateTernaryPhaseDiagrams() {
  const issues = [];
  DIAGRAMS.forEach((diagram) => {
    diagram.regions.forEach((region) => {
      const vertices = region.vertices.map(pointToVector);
      if (vertices.some((vertex) => !Number.isFinite(vertex.x) || !Number.isFinite(vertex.y) || !Number.isFinite(vertex.z))) {
        issues.push(`${region.id}: invalid vertex coordinate`);
      }
      region.vertices.forEach((point, index) => {
        const sum = point.b.reduce((total, value) => total + value, 0);
        if (Math.abs(sum - 1) > 1e-6) issues.push(`${region.id}: barycentric sum at ${index} is ${sum}`);
        if (point.b.some((value) => value < -1e-6 || value > 1 + 1e-6)) issues.push(`${region.id}: barycentric range at ${index}`);
      });
      region.faces.forEach((face, faceIndex) => {
        if (face.length < 3) issues.push(`${region.id}: face ${faceIndex} has fewer than 3 vertices`);
        face.forEach((vertexIndex) => {
          if (vertexIndex < 0 || vertexIndex >= vertices.length) issues.push(`${region.id}: face ${faceIndex} index out of range`);
        });
      });
      region.renderFaces?.forEach((face, faceIndex) => {
        if (face.length < 3) issues.push(`${region.id}: render face ${faceIndex} has fewer than 3 vertices`);
        face.forEach((vertexIndex) => {
          if (vertexIndex < 0 || vertexIndex >= vertices.length) issues.push(`${region.id}: render face ${faceIndex} index out of range`);
        });
      });
      const bounds = new THREE.Box3().setFromPoints(vertices);
      const size = new THREE.Vector3();
      bounds.getSize(size);
      if (size.length() < 0.05) issues.push(`${region.id}: degenerate bounds`);
    });
  });
  issues.push(...validateSharedPhaseBoundaries());
  return issues;
}

function validateSharedPhaseBoundaries() {
  const issues = [];
  const vertexKey = p => [...p.b, p.t].map(value => value.toFixed(8)).join(',');
  for (const diagram of DIAGRAMS) {
    const liquid = diagram.regions.find(region => region.key === 'L');
    const liquidVertices = new Set(liquid.vertices.map(vertexKey));
    for (const region of diagram.regions.filter(region => region.liquidusFaces?.length)) {
      const roofFaces = new Set(region.liquidusFaces);
      if (region.renderFaces.some(face => roofFaces.has(face))) issues.push(`${region.id}: duplicated liquidus surface`);
      const vertices = new Set(region.liquidusFaces.flat());
      if ([...vertices].some(index => !liquidVertices.has(vertexKey(region.vertices[index])))) {
        issues.push(`${region.id}: liquid/solid-liquid boundary mismatch`);
      }
    }
    for (const t of [...diagram.temperatures, ...diagram.checkpoints.map(checkpoint => checkpoint.t)]) {
      const fields = diagram.sectionAt(t);
      if (Math.abs(fields.reduce((area, field) => area + polygonArea(field.polygon), 0) - 0.5) > 1e-8) {
        issues.push(`${diagram.id}: incomplete composition partition at ${t}`);
      }
    }
  }
  return issues;
}

function makeHorizontalSectionPlane(temp) {
  const geometry = new THREE.BufferGeometry();
  const vertices = [
    baryToVector([1, 0, 0], temp),
    baryToVector([0, 1, 0], temp),
    baryToVector([0, 0, 1], temp),
  ];
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices.flatMap((vertex) => vertex.toArray()), 3));
  geometry.setIndex([0, 1, 2]);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color: ternaryInkColor(),
    transparent: true,
    opacity: 0.12,
    side: THREE.DoubleSide,
    depthWrite: false,
  }));
  mesh.renderOrder = 40;
  return mesh;
}

function makeVerticalSectionPlane(p1, p2) {
  const vertices = [
    baryToVector(p1, LOW_T),
    baryToVector(p2, LOW_T),
    baryToVector(p2, AXIS_TOP_T),
    baryToVector(p1, AXIS_TOP_T),
  ];
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices.flatMap((vertex) => vertex.toArray()), 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({
    color: ternaryInkColor(),
    transparent: true,
    opacity: 0.13,
    side: THREE.DoubleSide,
    depthWrite: false,
  }));
  mesh.renderOrder = 40;
  return mesh;
}

function makeStandaloneSectionGuide(descriptor) {
  const group = new THREE.Group();
  const positions = [];
  const addSegment = (start, end) => positions.push(...start.toArray(), ...end.toArray());

  if (descriptor.mode === "horizontal") {
    const corners = [
      baryToVector([1, 0, 0], descriptor.temp),
      baryToVector([0, 1, 0], descriptor.temp),
      baryToVector([0, 0, 1], descriptor.temp),
    ];
    corners.forEach((point, index) => addSegment(point, corners[(index + 1) % 3]));
    for (let step = 1; step < 5; step += 1) {
      const fraction = step / 5;
      addSegment(
        baryToVector([fraction, 1 - fraction, 0], descriptor.temp),
        baryToVector([fraction, 0, 1 - fraction], descriptor.temp),
      );
      addSegment(
        baryToVector([1 - fraction, fraction, 0], descriptor.temp),
        baryToVector([0, fraction, 1 - fraction], descriptor.temp),
      );
      addSegment(
        baryToVector([1 - fraction, 0, fraction], descriptor.temp),
        baryToVector([0, 1 - fraction, fraction], descriptor.temp),
      );
    }
    const center = baryToVector([1 / 3, 1 / 3, 1 / 3], descriptor.temp);
    [
      { text: "A", point: corners[0], color: 0x0284c7 },
      { text: "B", point: corners[1], color: 0xd97706 },
      { text: "C", point: corners[2], color: 0x7c3aed },
    ].forEach(({ text, point, color }) => {
      const labelPosition = point.clone().add(point.clone().sub(center).setZ(0).normalize().multiplyScalar(0.16));
      labelPosition.z += 0.04;
      group.add(makeTextSprite(text, labelPosition, color, 0.22));
    });
  } else {
    const corners = [
      baryToVector(descriptor.p1, LOW_T),
      baryToVector(descriptor.p2, LOW_T),
      baryToVector(descriptor.p2, AXIS_TOP_T),
      baryToVector(descriptor.p1, AXIS_TOP_T),
    ];
    corners.forEach((point, index) => addSegment(point, corners[(index + 1) % 4]));
    for (let step = 1; step < 5; step += 1) {
      const amount = step / 5;
      const temp = THREE.MathUtils.lerp(LOW_T, AXIS_TOP_T, amount);
      addSegment(baryToVector(descriptor.p1, temp), baryToVector(descriptor.p2, temp));
    }
    const midpoint = descriptor.p1.map((value, index) => (value + descriptor.p2[index]) / 2);
    addSegment(baryToVector(midpoint, LOW_T), baryToVector(midpoint, AXIS_TOP_T));
    group.add(makeTextSprite("P1", corners[0].clone().add(new THREE.Vector3(0, 0, -0.1)), 0x0284c7, 0.18));
    group.add(makeTextSprite("P2", corners[1].clone().add(new THREE.Vector3(0, 0, -0.1)), 0xd97706, 0.18));
    group.add(makeTextSprite("T", corners[3].clone().add(new THREE.Vector3(0, 0, 0.12)), ternaryInkColor(), 0.18));
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const lines = new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({
      color: ternaryGridColor(),
      transparent: true,
      opacity: 0.7,
      depthTest: false,
      depthWrite: false,
    }),
  );
  lines.renderOrder = 48;
  group.add(lines);
  return group;
}

function makeInvariantSectionGuide(invariant) {
  const group = new THREE.Group();
  const labels = invariant.vertexLabels;
  const points = [...invariant.polygon, invariant.interior];
  const offsets = [[-0.04, -0.07], [0.04, -0.07], [0.07, 0.07], [0, 0.11]];
  points.forEach((bary, i) => {
    if (bary.some(value => value > 1 - 1e-8)) return;
    const position = baryToVector(bary, invariant.temp);
    const dot = makePoint(position, 0xc54c52, 0.018);
    dot.material.depthTest = false;
    dot.renderOrder = 52;
    group.add(dot);
    group.add(makeTextSprite(labels[i] || invariant.interiorLabel,
      position.clone().add(new THREE.Vector3(...offsets[i], 0)), 0xc54c52, 0.14));
  });
  return group;
}

function makeFilledSectionField(field, temp, labels) {
  const group = new THREE.Group();
  const vertices = field.polygon.map(bary => baryToVector(bary, temp));
  const triangles = THREE.ShapeUtils.triangulateShape(vertices.map(v => new THREE.Vector2(v.x, v.y)), []);
  const positions = triangles.flatMap(face => face.flatMap(index => vertices[index].toArray()));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const mesh = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: field.color,
    transparent: true, opacity: 0.32, side: THREE.DoubleSide, depthTest: false, depthWrite: false, toneMapped: false }));
  mesh.renderOrder = 43;
  group.add(mesh);
  const line = makeLine([...vertices, vertices[0]], ternaryInkColor(), 0.78);
  line.material.depthTest = false;
  line.renderOrder = 49;
  group.add(line);
  if (labels && triangles.length) {
    const candidates = triangles.map(face => {
      const [a, b, c] = face.map(i => vertices[i]);
      const triangle = new THREE.Triangle(a, b, c);
      return { triangle, area: triangle.getArea(), center: a.clone().add(b).add(c).multiplyScalar(1 / 3) };
    }).sort((a, b) => b.area - a.area);
    const label = makeTextSprite(field.phase, candidates[0].center, ternaryInkColor(), 0.17);
    // A label must fit inside a triangulated field; narrow fields remain in the legend.
    const fit = candidates.find(({ triangle, center, area }) => area > 0.065
      && [-1, 1].every(x => [-1, 1].every(y => triangle.containsPoint(center.clone().add(
        new THREE.Vector3(x * (label.scale.x / 2 + 0.015), y * (label.scale.y / 2 + 0.015), 0))))));
    if (fit) {
      label.position.copy(fit.center);
      group.add(label);
    } else {
      label.material.map.dispose();
      label.material.dispose();
    }
  }
  return group;
}

function intersectRegionWithSection(region, descriptor) {
  const vertices = region.vertices.map(pointToVector);
  const rawSegments = [];
  const indices = triangulatePolyhedron(vertices, region.faces);
  for (let i = 0; i < indices.length; i += 3) {
    rawSegments.push(...intersectTriangleWithPlane(indices.slice(i, i + 3).map(j => vertices[j]), descriptor.plane));
  }
  return uniqueSegments(rawSegments);
}

function intersectTriangleWithPlane(triangle, plane) {
  const EPS = 1e-5;
  const distances = triangle.map((point) => plane.distanceToPoint(point));
  if (distances.every((distance) => Math.abs(distance) < EPS)) {
    return [];
  }

  const points = [];
  for (let index = 0; index < 3; index += 1) {
    const next = (index + 1) % 3;
    const a = triangle[index];
    const b = triangle[next];
    const da = distances[index];
    const db = distances[next];

    if (Math.abs(da) < EPS) addUniqueVector(points, a);
    if (da * db < -EPS * EPS) {
      const amount = da / (da - db);
      addUniqueVector(points, a.clone().lerp(b, amount));
    }
    if (Math.abs(db) < EPS) addUniqueVector(points, b);
  }

  if (points.length < 2) return [];
  if (points.length === 2) return [[points[0], points[1]]];
  return [farthestPointPair(points)];
}

function makeSectionLines(segments, color) {
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.96,
    depthTest: false,
    depthWrite: false,
  });
  const group = new THREE.Group();
  let segmentCount = 0;
  let lineCount = 0;

  makeSectionPolylines(segments).forEach((polyline) => {
    const points = smoothSectionPolyline(simplifySectionPolyline(polyline));
    if (points.length < 2) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(points.flatMap((point) => point.toArray()), 3));
    const line = new THREE.Line(geometry, material);
    line.renderOrder = 50;
    group.add(line);
    segmentCount += points.length - 1;
    lineCount += 1;
  });

  group.userData.segmentCount = lineCount;
  group.userData.renderedSegmentCount = segmentCount;
  return group;
}

function makeSectionPolylines(segments) {
  const nodes = new Map();
  const edges = new Map();

  const addNode = (point) => {
    const key = vectorKey(point, SECTION_NODE_DECIMALS);
    if (!nodes.has(key)) {
      nodes.set(key, { key, point: new THREE.Vector3(), count: 0, edges: [] });
    }
    const node = nodes.get(key);
    node.point.add(point);
    node.count += 1;
    return key;
  };

  uniqueSegments(segments).forEach(([a, b]) => {
    const first = addNode(a);
    const second = addNode(b);
    if (first === second) return;
    const key = first < second ? `${first}|${second}` : `${second}|${first}`;
    if (edges.has(key)) return;
    edges.set(key, { key, first, second });
    nodes.get(first).edges.push(key);
    nodes.get(second).edges.push(key);
  });

  nodes.forEach((node) => node.point.divideScalar(node.count));

  const visited = new Set();
  const polylines = [];
  const walk = (startKey, edgeKey) => {
    const points = [nodes.get(startKey).point.clone()];
    let currentKey = startKey;
    let nextEdgeKey = edgeKey;

    while (nextEdgeKey && !visited.has(nextEdgeKey)) {
      visited.add(nextEdgeKey);
      const edge = edges.get(nextEdgeKey);
      const nextKey = edge.first === currentKey ? edge.second : edge.first;
      points.push(nodes.get(nextKey).point.clone());
      const candidates = nodes.get(nextKey).edges.filter((candidate) => !visited.has(candidate));
      if (candidates.length !== 1) break;
      currentKey = nextKey;
      nextEdgeKey = candidates[0];
    }

    if (points.length > 1) polylines.push(points);
  };

  [...nodes.values()]
    .filter((node) => node.edges.length !== 2)
    .forEach((node) => {
      node.edges.forEach((edgeKey) => {
        if (!visited.has(edgeKey)) walk(node.key, edgeKey);
      });
    });

  edges.forEach((edge) => {
    if (!visited.has(edge.key)) walk(edge.first, edge.key);
  });

  return polylines;
}

function simplifySectionPolyline(points) {
  if (points.length < 4 || isClosedPolyline(points)) return points;
  return simplifyOpenPolyline(points, SECTION_SIMPLIFY_TOLERANCE ** 2);
}

function simplifyOpenPolyline(points, toleranceSq) {
  if (points.length <= 2) return points.map((point) => point.clone());

  let maxDistance = -1;
  let splitIndex = -1;
  const start = points[0];
  const end = points[points.length - 1];

  for (let index = 1; index < points.length - 1; index += 1) {
    const distance = pointToSegmentDistanceSq(points[index], start, end);
    if (distance > maxDistance) {
      maxDistance = distance;
      splitIndex = index;
    }
  }

  if (maxDistance <= toleranceSq) return [start.clone(), end.clone()];

  const left = simplifyOpenPolyline(points.slice(0, splitIndex + 1), toleranceSq);
  const right = simplifyOpenPolyline(points.slice(splitIndex), toleranceSq);
  return [...left.slice(0, -1), ...right];
}

function smoothSectionPolyline(points) {
  const closed = isClosedPolyline(points);
  const source = closed ? points.slice(0, -1) : points;
  if (source.length < 5 || hasSharpSectionTurn(source)) return points;

  const sampleCount = Math.min(SECTION_SMOOTH_SAMPLE_LIMIT, Math.max(source.length * 3, source.length + 8));
  const curve = new THREE.CatmullRomCurve3(source, closed, "centripetal", 0.35);
  const smoothed = curve.getPoints(sampleCount);
  if (closed) smoothed.push(smoothed[0].clone());
  return smoothed;
}

function hasSharpSectionTurn(points) {
  for (let index = 1; index < points.length - 1; index += 1) {
    const previous = points[index].clone().sub(points[index - 1]);
    const next = points[index + 1].clone().sub(points[index]);
    if (previous.lengthSq() < 1e-6 || next.lengthSq() < 1e-6) continue;
    if (previous.normalize().dot(next.normalize()) < 0.45) return true;
  }
  return false;
}

function isClosedPolyline(points) {
  return points.length > 2 && points[0].distanceToSquared(points[points.length - 1]) < 1e-6;
}

function pointToSegmentDistanceSq(pointValue, start, end) {
  const segment = end.clone().sub(start);
  const lengthSq = segment.lengthSq();
  if (lengthSq < 1e-8) return pointValue.distanceToSquared(start);
  const amount = clamp(pointValue.clone().sub(start).dot(segment) / lengthSq, 0, 1);
  return pointValue.distanceToSquared(start.clone().add(segment.multiplyScalar(amount)));
}

function addUniqueVector(points, point) {
  if (!points.some((existing) => existing.distanceToSquared(point) < 1e-8)) {
    points.push(point.clone());
  }
}

function farthestPointPair(points) {
  let pair = [points[0], points[1]];
  let maxDistance = -1;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const distance = points[i].distanceToSquared(points[j]);
      if (distance > maxDistance) {
        maxDistance = distance;
        pair = [points[i], points[j]];
      }
    }
  }
  return pair;
}

function uniqueSegments(segments) {
  const seen = new Set();
  const unique = [];
  segments.forEach(([a, b]) => {
    if (a.distanceToSquared(b) < 1e-8) return;
    const first = vectorKey(a);
    const second = vectorKey(b);
    const key = first < second ? `${first}|${second}` : `${second}|${first}`;
    if (seen.has(key)) return;
    seen.add(key);
    unique.push([a.clone(), b.clone()]);
  });
  return unique;
}

function vectorKey(vector, decimals = 4) {
  return [vector.x, vector.y, vector.z].map((value) => value.toFixed(decimals)).join(",");
}

function readCompositionPoint(aInput, bInput, cInput) {
  const raw = [aInput, bInput, cInput].map((input) => Math.max(0, Number(input?.value) || 0));
  const sum = raw.reduce((total, value) => total + value, 0);
  if (sum <= 0) return null;
  return raw.map((value) => value / sum);
}

function writeCompositionPoint(inputs, pointValue) {
  const values = pointValue.map((value) => value * 100);
  const rounded = values.map((value) => Math.round(value));
  let delta = 100 - rounded.reduce((total, value) => total + value, 0);
  const order = values
    .map((value, index) => ({ index, rest: value - Math.floor(value) }))
    .sort((a, b) => b.rest - a.rest);
  for (let i = 0; delta !== 0 && i < order.length; i += 1) {
    const target = order[i].index;
    rounded[target] += delta > 0 ? 1 : -1;
    delta += delta > 0 ? -1 : 1;
  }
  inputs.forEach((input, index) => {
    if (input) input.value = String(Math.max(0, rounded[index]));
  });
}

function compositionDistance(a, b) {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

function formatComposition(value) {
  return `A${Math.round(value[0] * 100)}-B${Math.round(value[1] * 100)}-C${Math.round(value[2] * 100)}`;
}

function formatSectionNumber(value) {
  return value.toFixed(2).replace(/\.?0+$/, "");
}

function genericRuledRegion({
  id,
  title,
  phase,
  kind,
  color,
  apexTop,
  apexBottom,
  upperBoundary,
  lowerBoundary,
  shape,
  temperature,
  composition,
  note,
  liquidus = false,
  radialSegments = 14,
  upperPower = 1.08,
  lowerPower = 0.92,
  upperBow = 0.018,
  lowerBow = -0.006,
}) {
  const mesh = makeRuledVolume(apexTop, apexBottom, upperBoundary, lowerBoundary, {
    liquidus,
    radialSegments: liquidus ? 32 : radialSegments,
    upperPower: liquidus ? 1.5 : upperPower,
    lowerPower,
    upperBow: liquidus ? 0 : upperBow,
    lowerBow,
  });
  return {
    id,
    title,
    phase,
    kind,
    color,
    shape,
    temperature,
    composition,
    note,
    ...mesh,
  };
}

function thinPlateRegion(id, title, phase, kind, color, polygon, temp, thickness, shape, temperature, composition, note) {
  const bottom = polygon.map((item) => point(item.b, temp - thickness));
  const top = polygon.map((item) => point(item.b, temp + thickness));
  return prismRegion(id, title, phase, kind, color, bottom, top, shape, temperature, composition, note);
}

function ternaryThreePhaseRegion(id, title, phase, color, cotecticCurve, firstAxis, secondAxis, shape, temperature, composition, note) {
  const curve = resampleCurve(cotecticCurve, 28);
  const vertices = [];
  const faces = [];
  const rowSize = 3;

  curve.forEach((curvePoint) => {
    vertices.push(
      point(axisBary(firstAxis), curvePoint.t),
      curvePoint,
      point(axisBary(secondAxis), curvePoint.t),
    );
  });

  const indexOf = (row, offset) => row * rowSize + offset;
  for (let row = 0; row < curve.length - 1; row += 1) {
    faces.push(
      [indexOf(row, 0), indexOf(row + 1, 0), indexOf(row + 1, 1), indexOf(row, 1)],
      [indexOf(row, 1), indexOf(row + 1, 1), indexOf(row + 1, 2), indexOf(row, 2)],
      [indexOf(row, 2), indexOf(row + 1, 2), indexOf(row + 1, 0), indexOf(row, 0)],
    );
  }
  faces.push(
    [0, 1, 2],
    [indexOf(curve.length - 1, 0), indexOf(curve.length - 1, 2), indexOf(curve.length - 1, 1)],
  );

  return {
    id,
    title,
    phase,
    kind: "含液三相区",
    color,
    shape,
    temperature,
    composition,
    note,
    vertices,
    faces,
    edgeSegments: [
      curve,
      curve.map((item) => point(axisBary(firstAxis), item.t)),
      curve.map((item) => point(axisBary(secondAxis), item.t)),
      [
        point(axisBary(firstAxis), curve[0].t),
        curve[0],
        point(axisBary(secondAxis), curve[0].t),
        point(axisBary(firstAxis), curve[0].t),
      ],
      [
        point(axisBary(firstAxis), curve[curve.length - 1].t),
        curve[curve.length - 1],
        point(axisBary(secondAxis), curve[curve.length - 1].t),
        point(axisBary(firstAxis), curve[curve.length - 1].t),
      ],
    ],
  };
}

function binarySideTwoSolidRegion(id, title, phase, color, eutecticPoint, firstAxis, secondAxis, shape, temperature, composition, note) {
  const firstLow = point(axisBary(firstAxis), LOW_T);
  const secondLow = point(axisBary(secondAxis), LOW_T);
  const secondTop = point(axisBary(secondAxis), eutecticPoint.t);
  const firstTop = point(axisBary(firstAxis), eutecticPoint.t);
  const vertices = [firstLow, secondLow, secondTop, firstTop];

  return {
    id,
    title,
    phase,
    kind: "二元边界两固相区",
    color,
    edgeColor: 0x1f2933,
    edgeOpacity: 0.72,
    edgeDepthTest: false,
    edgeRenderOrder: 18,
    shape,
    temperature,
    composition,
    note,
    vertices,
    faces: [[0, 1, 2, 3]],
    edgeSegments: [[firstLow, secondLow, secondTop, firstTop, firstLow]],
  };
}

function immiscibleTwoSolidRegion(id, title, phase, color, cotecticCurve, firstAxis, secondAxis, shape, temperature, composition, note) {
  const curve = resampleCurve(cotecticCurve, 28);
  const vertices = [];
  const faces = [];
  const rowSize = 6;

  curve.forEach((curvePoint) => {
    vertices.push(
      point(axisBary(firstAxis), curvePoint.t),
      curvePoint,
      point(axisBary(secondAxis), curvePoint.t),
      point(axisBary(firstAxis), LOW_T),
      lowerCotecticFoot(curvePoint, firstAxis, secondAxis),
      point(axisBary(secondAxis), LOW_T),
    );
  });

  const indexOf = (row, offset) => row * rowSize + offset;
  for (let row = 0; row < curve.length - 1; row += 1) {
    faces.push(
      [indexOf(row, 0), indexOf(row + 1, 0), indexOf(row + 1, 1), indexOf(row, 1)],
      [indexOf(row, 1), indexOf(row + 1, 1), indexOf(row + 1, 2), indexOf(row, 2)],
      [indexOf(row, 4), indexOf(row + 1, 4), indexOf(row + 1, 3), indexOf(row, 3)],
      [indexOf(row, 5), indexOf(row + 1, 5), indexOf(row + 1, 4), indexOf(row, 4)],
      [indexOf(row, 0), indexOf(row, 3), indexOf(row + 1, 3), indexOf(row + 1, 0)],
      [indexOf(row, 2), indexOf(row + 1, 2), indexOf(row + 1, 5), indexOf(row, 5)],
      [indexOf(row, 1), indexOf(row, 4), indexOf(row + 1, 4), indexOf(row + 1, 1)],
    );
  }

  faces.push(
    [0, 1, 2, 5, 4, 3],
    [
      indexOf(curve.length - 1, 0),
      indexOf(curve.length - 1, 3),
      indexOf(curve.length - 1, 4),
      indexOf(curve.length - 1, 5),
      indexOf(curve.length - 1, 2),
      indexOf(curve.length - 1, 1),
    ],
  );

  return {
    id,
    title,
    phase,
    kind: "两固相区",
    color,
    edgeColor: 0x1f2933,
    edgeOpacity: 0.74,
    edgeDepthTest: false,
    edgeRenderOrder: 18,
    shape,
    temperature,
    composition,
    note,
    vertices,
    faces,
    edgeSegments: [
      curve,
      curve.map((item) => point(axisBary(firstAxis), item.t)),
      curve.map((item) => point(axisBary(secondAxis), item.t)),
      curve.map((item) => lowerCotecticFoot(item, firstAxis, secondAxis)),
      [point(axisBary(firstAxis), curve[0].t), point(axisBary(secondAxis), curve[0].t)],
      [point(axisBary(firstAxis), curve[0].t), point(axisBary(firstAxis), LOW_T)],
      [point(axisBary(secondAxis), curve[0].t), point(axisBary(secondAxis), LOW_T)],
      [point(axisBary(firstAxis), curve[curve.length - 1].t), point(axisBary(firstAxis), LOW_T)],
      [point(axisBary(secondAxis), curve[curve.length - 1].t), point(axisBary(secondAxis), LOW_T)],
      [point(axisBary(firstAxis), LOW_T), lowerCotecticFoot(curve[0], firstAxis, secondAxis), point(axisBary(secondAxis), LOW_T)],
      [
        point(axisBary(firstAxis), curve[curve.length - 1].t),
        curve[curve.length - 1],
        point(axisBary(secondAxis), curve[curve.length - 1].t),
      ],
      [
        point(axisBary(firstAxis), LOW_T),
        lowerCotecticFoot(curve[curve.length - 1], firstAxis, secondAxis),
        point(axisBary(secondAxis), LOW_T),
      ],
    ],
  };
}

function axisBary(axis) {
  return [0, 1, 2].map((index) => (index === axis ? 1 : 0));
}

function lowerCotecticFoot(curvePoint, firstAxis, secondAxis) {
  const missingAxis = [0, 1, 2].find((axis) => axis !== firstAxis && axis !== secondAxis);
  const missing = curvePoint.b[missingAxis] * 0.36;
  const pairSum = curvePoint.b[firstAxis] + curvePoint.b[secondAxis];
  const firstShare = pairSum > 1e-8 ? curvePoint.b[firstAxis] / pairSum : 0.5;
  const bary = [0, 0, 0];
  bary[missingAxis] = missing;
  bary[firstAxis] = (1 - missing) * firstShare;
  bary[secondAxis] = (1 - missing) * (1 - firstShare);
  return point(bary, LOW_T);
}

function cornerBoundary(corner, temp, radius) {
  if (corner === "A") {
    return [
      point([1 - radius, radius, 0], temp),
      point([1 - radius, radius * 0.5, radius * 0.5], temp),
      point([1 - radius, 0, radius], temp),
    ];
  }
  if (corner === "B") {
    return [
      point([radius, 1 - radius, 0], temp),
      point([radius * 0.5, 1 - radius, radius * 0.5], temp),
      point([0, 1 - radius, radius], temp),
    ];
  }
  return [
    point([radius, 0, 1 - radius], temp),
    point([radius * 0.5, radius * 0.5, 1 - radius], temp),
    point([0, radius, 1 - radius], temp),
  ];
}

function pureCornerBoundary(corner, temp) {
  const bary = corner === "A" ? [1, 0, 0] : corner === "B" ? [0, 1, 0] : [0, 0, 1];
  return [point(bary, temp), point(bary, temp), point(bary, temp)];
}

function compoundBoundary(center, temp, radius) {
  const [a, b, c] = center;
  return [
    point([a + radius, b - radius, c], temp),
    point([a + radius * 0.35, b - radius * 0.15, c + radius * 0.8], temp),
    point([a - radius * 0.35, b + radius * 0.15, c + radius * 0.8], temp),
    point([a - radius, b + radius, c], temp),
  ];
}

function makeGuideSpec(curves, points = []) {
  return {
    curves: curves.map((curve) => ({ points: curve, color: 0x263238, opacity: 0.82 })),
    points: points.map((item) => ({ color: 0xc44536, ...item })),
  };
}

function curvedPrimaryRegion({ id, title, phase, color, apex, liquidBoundary, solidBoundary, shape, note }) {
  const mesh = makeRuledVolume(apex, apex, liquidBoundary, solidBoundary, {
    liquidus: true,
    radialSegments: 32,
    upperPower: 1.5,
    lowerPower: 0.86,
    upperBow: 0,
    lowerBow: -0.018,
  });
  return {
    id,
    title,
    phase,
    kind: "液固两相区",
    color,
    shape,
    temperature: "液相面以下至对应固相线",
    composition: "从对应纯组元角向两条共晶沟和 E 点弯曲收敛",
    note,
    ...mesh,
  };
}

function singleSolidSolutionRegion({
  id,
  title,
  phase,
  color,
  apexTop,
  apexBottom,
  topBoundary,
  bottomBoundary,
  shape,
  temperature,
  composition,
  note,
}) {
  const mesh = makeRuledVolume(apexTop, apexBottom, topBoundary, bottomBoundary, {
    radialSegments: 16,
    upperPower: 0.78,
    lowerPower: 1,
    upperBow: -0.02,
    lowerBow: 0,
  });
  return {
    id,
    title,
    phase,
    kind: "单相区",
    color,
    shape,
    temperature,
    composition,
    note,
    ...mesh,
  };
}

function curvedRibbonRegion(id, title, phase, color, path, leftAnchor, rightAnchor, shape) {
  const vertices = [];
  const faces = [];
  path.forEach((center, index) => {
    const taper = 0.13 - (index / Math.max(1, path.length - 1)) * 0.045;
    vertices.push(mixPoint(center, leftAnchor, taper), mixPoint(center, rightAnchor, taper));
  });
  for (let index = 0; index < path.length - 1; index += 1) {
    const a = index * 2;
    faces.push([a, a + 1, a + 3, a + 2]);
  }
  return {
    id,
    title,
    phase,
    kind: "含液三相区",
    color,
    shape,
    temperature: "二元共晶沟至三元共晶温度",
    composition: "沿弯曲共晶沟向 E 点汇聚",
    note: "含液三相平衡在空间图中表现为共晶谷线；这里用窄曲带突出其路径和相邻两液固曲面的交线。",
    vertices,
    faces,
    edgeSegments: [
      vertices.filter((_, index) => index % 2 === 0),
      vertices.filter((_, index) => index % 2 === 1),
      path,
    ],
  };
}

function limitedCotecticRegion(id, title, phase, color, liquidPathSource, firstSolidSource, secondSolidSource, shape) {
  const rowCount = Math.max(liquidPathSource.length, firstSolidSource.length, secondSolidSource.length);
  const liquidPath = resampleCurve(liquidPathSource, rowCount);
  const firstSolidShape = resampleCurve(firstSolidSource, rowCount);
  const secondSolidShape = resampleCurve(secondSolidSource, rowCount);
  const firstSolid = firstSolidShape.map((item, index) => point(item.b, liquidPath[index].t));
  const secondSolid = secondSolidShape.map((item, index) => point(item.b, liquidPath[index].t));
  const vertices = [];
  const faces = [];
  const rowSize = 3;

  for (let row = 0; row < rowCount; row += 1) {
    vertices.push(firstSolid[row], liquidPath[row], secondSolid[row]);
  }

  const indexOf = (row, offset) => row * rowSize + offset;
  for (let row = 0; row < rowCount - 1; row += 1) {
    faces.push(
      [indexOf(row, 0), indexOf(row + 1, 0), indexOf(row + 1, 1), indexOf(row, 1)],
      [indexOf(row, 1), indexOf(row + 1, 1), indexOf(row + 1, 2), indexOf(row, 2)],
      [indexOf(row, 2), indexOf(row + 1, 2), indexOf(row + 1, 0), indexOf(row, 0)],
    );
  }
  faces.push(
    [0, 1, 2],
    [indexOf(rowCount - 1, 0), indexOf(rowCount - 1, 2), indexOf(rowCount - 1, 1)],
  );

  const tieRows = [0, Math.floor((rowCount - 1) * 0.34), Math.floor((rowCount - 1) * 0.67), rowCount - 1];

  return {
    id,
    title,
    phase,
    kind: "含液三相区",
    color,
    shape,
    temperature: "二元共晶沟附近至三元共晶温度 TE",
    composition: "液相共晶沟与相邻两条固相线之间的较宽区域",
    note: "固态有限互溶时，L+两固相的三相区不是窄线，而是由液相共晶沟和两侧固相组成曲线共同围成的展开空间区。",
    vertices,
    faces,
    edgeSegments: [
      firstSolid,
      liquidPath,
      secondSolid,
      ...tieRows.map((row) => [firstSolid[row], liquidPath[row], secondSolid[row], firstSolid[row]]),
    ],
  };
}

function limitedTwoSolidRegion(
  id,
  title,
  phase,
  color,
  topFirstSource,
  topSecondSource,
  bottomFirstSource,
  bottomSecondSource,
  shape,
  temperature,
  composition,
  note,
) {
  const rowCount = Math.max(
    topFirstSource.length,
    topSecondSource.length,
    bottomFirstSource.length,
    bottomSecondSource.length,
  );
  const topFirst = resampleCurve(topFirstSource, rowCount);
  const topSecond = resampleCurve(topSecondSource, rowCount);
  const bottomFirst = resampleCurve(bottomFirstSource, rowCount);
  const bottomSecond = resampleCurve(bottomSecondSource, rowCount);
  const vertices = [];
  const faces = [];
  const renderFaces = [];
  const rowSize = 4;

  for (let row = 0; row < rowCount; row += 1) {
    vertices.push(topFirst[row], topSecond[row], bottomSecond[row], bottomFirst[row]);
  }

  const indexOf = (row, offset) => row * rowSize + offset;
  for (let row = 0; row < rowCount - 1; row += 1) {
    const topFace = [indexOf(row, 0), indexOf(row + 1, 0), indexOf(row + 1, 1), indexOf(row, 1)];
    const bottomFace = [indexOf(row, 3), indexOf(row, 2), indexOf(row + 1, 2), indexOf(row + 1, 3)];
    const firstSolvusFace = [indexOf(row, 0), indexOf(row, 3), indexOf(row + 1, 3), indexOf(row + 1, 0)];
    const secondSolvusFace = [indexOf(row, 1), indexOf(row + 1, 1), indexOf(row + 1, 2), indexOf(row, 2)];
    faces.push(
      topFace,
      bottomFace,
      firstSolvusFace,
      secondSolvusFace,
    );
    renderFaces.push(
      bottomFace,
      firstSolvusFace,
      secondSolvusFace,
    );
  }
  const startCap = [0, 1, 2, 3];
  const endCap = [
    indexOf(rowCount - 1, 0),
    indexOf(rowCount - 1, 3),
    indexOf(rowCount - 1, 2),
    indexOf(rowCount - 1, 1),
  ];
  faces.push(startCap, endCap);
  renderFaces.push(startCap, endCap);

  const sectionRows = [0, Math.floor((rowCount - 1) * 0.5), rowCount - 1];

  return {
    id,
    title,
    phase,
    kind: "两固相区",
    color,
    edgeColor: 0x1f2933,
    edgeOpacity: 0.72,
    edgeDepthTest: false,
    edgeRenderOrder: 18,
    shape,
    temperature,
    composition,
    note,
    vertices,
    faces,
    renderFaces,
    edgeSegments: [
      topFirst,
      topSecond,
      bottomFirst,
      bottomSecond,
      ...sectionRows.map((row) => [topFirst[row], topSecond[row], bottomSecond[row], bottomFirst[row], topFirst[row]]),
    ],
  };
}

function prismRegion(id, title, phase, kind, color, bottom, top, shape, temperature, composition, note) {
  const faces = [];
  const count = bottom.length;
  faces.push([...Array(count).keys()].reverse());
  faces.push([...Array(count).keys()].map((index) => index + count));
  for (let index = 0; index < count; index += 1) {
    faces.push([index, (index + 1) % count, ((index + 1) % count) + count, index + count]);
  }
  return {
    id,
    title,
    phase,
    kind,
    color,
    shape,
    temperature,
    composition,
    note,
    vertices: [...bottom, ...top],
    faces,
  };
}

function makeRuledVolume(apexTop, apexBottom, upperBoundarySource, lowerBoundarySource, options) {
  const {
    liquidus = false,
    radialSegments,
    upperPower,
    lowerPower,
    upperBow,
    lowerBow,
  } = options;
  const boundaryCount = Math.max(upperBoundarySource.length, lowerBoundarySource.length);
  const upperBoundary = resampleCurve(upperBoundarySource, boundaryCount);
  const lowerBoundary = resampleCurve(lowerBoundarySource, boundaryCount);
  const vertices = [];
  const faces = [];
  const liquidusFaces = [];
  const rowSize = radialSegments + 1;

  upperBoundary.forEach((boundaryPoint) => {
    for (let step = 0; step <= radialSegments; step += 1) {
      const r = step / radialSegments;
      vertices.push(radialPoint(apexTop, boundaryPoint, r, upperPower, upperBow));
    }
  });

  const lowerStart = vertices.length;
  lowerBoundary.forEach((boundaryPoint) => {
    for (let step = 0; step <= radialSegments; step += 1) {
      const r = step / radialSegments;
      vertices.push(radialPoint(apexBottom, boundaryPoint, r, lowerPower, lowerBow));
    }
  });

  const upperIndex = (line, step) => line * rowSize + step;
  const lowerIndex = (line, step) => lowerStart + line * rowSize + step;

  for (let line = 0; line < boundaryCount - 1; line += 1) {
    for (let step = 0; step < radialSegments; step += 1) {
      const upperFace = [
        upperIndex(line, step),
        upperIndex(line + 1, step),
        upperIndex(line + 1, step + 1),
        upperIndex(line, step + 1),
      ];
      faces.push(upperFace);
      if (liquidus) liquidusFaces.push(upperFace);
      faces.push([
        lowerIndex(line, step + 1),
        lowerIndex(line + 1, step + 1),
        lowerIndex(line + 1, step),
        lowerIndex(line, step),
      ]);
    }
  }

  for (let line = 0; line < boundaryCount - 1; line += 1) {
    faces.push([
      upperIndex(line, radialSegments),
      upperIndex(line + 1, radialSegments),
      lowerIndex(line + 1, radialSegments),
      lowerIndex(line, radialSegments),
    ]);
    faces.push([
      upperIndex(line + 1, 0),
      upperIndex(line, 0),
      lowerIndex(line, 0),
      lowerIndex(line + 1, 0),
    ]);
  }

  for (let step = 0; step < radialSegments; step += 1) {
    faces.push([
      upperIndex(0, step),
      upperIndex(0, step + 1),
      lowerIndex(0, step + 1),
      lowerIndex(0, step),
    ]);
    faces.push([
      upperIndex(boundaryCount - 1, step + 1),
      upperIndex(boundaryCount - 1, step),
      lowerIndex(boundaryCount - 1, step),
      lowerIndex(boundaryCount - 1, step + 1),
    ]);
  }

  const edgeSegments = [
    upperBoundary,
    lowerBoundary,
    rowPoints(vertices, upperIndex, 0, radialSegments),
    rowPoints(vertices, lowerIndex, 0, radialSegments),
    rowPoints(vertices, upperIndex, boundaryCount - 1, radialSegments),
    rowPoints(vertices, lowerIndex, boundaryCount - 1, radialSegments),
    [upperBoundary[0], lowerBoundary[0]],
    [upperBoundary[Math.floor((boundaryCount - 1) / 2)], lowerBoundary[Math.floor((boundaryCount - 1) / 2)]],
    [upperBoundary[boundaryCount - 1], lowerBoundary[boundaryCount - 1]],
  ];

  if (!liquidus) return { vertices, faces, edgeSegments };

  // Clip the actual roof mesh for contours, so they follow the same surface as sections.
  const surfaceContours = [];
  const lowestT = Math.min(...upperBoundary.map(p => p.t));
  for (let t = Math.ceil((lowestT + 0.02) / 0.08) * 0.08; t < apexTop.t - 0.04; t += 0.08) {
    const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -t * 2.35);
    const segments = intersectRegionWithSection({ vertices, faces: liquidusFaces }, { plane });
    surfaceContours.push(...segments.map(segment => segment.map(vectorToPoint)));
  }
  const roof = new Set(liquidusFaces);
  return { vertices, faces, edgeSegments, liquidusFaces, surfaceContours,
    renderFaces: faces.filter(face => !roof.has(face)) };
}

function vectorToPoint(vector) {
  const c = (vector.y + 0.7) / 2.1;
  const b = (1 - c + vector.x / 1.22) / 2;
  return point([1 - b - c, b, c], vector.z / 2.35);
}

function rowPoints(vertices, indexOf, line, radialSegments) {
  const points = [];
  for (let step = 0; step <= radialSegments; step += 1) {
    points.push(vertices[indexOf(line, step)]);
  }
  return points;
}

function radialPoint(apex, boundary, radius, power, bow) {
  const q = Math.pow(radius, power);
  const b = apex.b.map((value, index) => value * (1 - radius) + boundary.b[index] * radius);
  const t = clamp(apex.t * (1 - q) + boundary.t * q + bow * Math.sin(Math.PI * radius), LOW_T, AXIS_TOP_T);
  return point(b, t);
}

function point(b, t) {
  return { b: normalizeBary(b), t };
}

function normalizeBary(values) {
  const sum = values.reduce((total, value) => total + value, 0);
  if (Math.abs(sum) < 1e-8) return [1 / 3, 1 / 3, 1 / 3];
  return values.map((value) => value / sum);
}

function bezierCurve(start, control, end, segments) {
  const curve = [];
  for (let index = 0; index <= segments; index += 1) {
    const u = index / segments;
    const oneMinus = 1 - u;
    const b = [0, 1, 2].map((axis) => (
      start.b[axis] * oneMinus * oneMinus
      + control.b[axis] * 2 * oneMinus * u
      + end.b[axis] * u * u
    ));
    const t = start.t * oneMinus * oneMinus + control.t * 2 * oneMinus * u + end.t * u * u;
    curve.push(point(b, t));
  }
  return curve;
}

function joinCurves(...curves) {
  const joined = [];
  curves.forEach((curve) => {
    curve.forEach((item) => {
      const previous = joined[joined.length - 1];
      if (previous && pointDistance(previous, item) < 1e-8) return;
      joined.push(item);
    });
  });
  return joined;
}

function reverseCurve(curve) {
  return [...curve].reverse();
}

function resampleCurve(curve, count) {
  if (curve.length === count) return curve;
  const sampled = [];
  for (let index = 0; index < count; index += 1) {
    const raw = (index / Math.max(1, count - 1)) * (curve.length - 1);
    const left = Math.floor(raw);
    const right = Math.min(curve.length - 1, left + 1);
    const amount = raw - left;
    sampled.push(mixPoint(curve[left], curve[right], amount));
  }
  return sampled;
}

function syncCurveTemperatures(curve, temperatureSource) {
  const temperatures = resampleCurve(temperatureSource, curve.length);
  return curve.map((item, index) => point(item.b, temperatures[index].t));
}

function pointDistance(a, b) {
  return Math.sqrt(
    (a.b[0] - b.b[0]) ** 2
    + (a.b[1] - b.b[1]) ** 2
    + (a.b[2] - b.b[2]) ** 2
    + (a.t - b.t) ** 2
  );
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function makeRegionGroup(region) {
  const geometry = makePolyhedronGeometry(region.vertices, region.renderFaces || region.faces);
  const material = new THREE.MeshPhysicalMaterial({
    color: region.color,
    roughness: 0.48,
    metalness: 0.03,
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.regionId = region.id;

  const edges = makeRegionEdges(region, region.color);
  const group = new THREE.Group();
  group.add(mesh, edges);
  if (region.liquidusFaces?.length) {
    const liquidus = new THREE.Mesh(makePolyhedronGeometry(region.vertices, region.liquidusFaces, true),
      new THREE.MeshPhysicalMaterial({ color: region.color, roughness: 0.36, metalness: 0,
        clearcoat: 0.18, clearcoatRoughness: 0.4, side: THREE.DoubleSide,
        transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }));
    liquidus.userData.regionId = region.id;
    const contours = makeRegionEdges({ edgeSegments: region.surfaceContours }, ternaryInkColor());
    contours.renderOrder = 16;
    group.add(liquidus, contours);
    group.userData.liquidus = liquidus;
    group.userData.contours = contours;
  }
  group.userData.mesh = mesh;
  group.userData.edges = edges;
  return group;
}

function triangulatePolyhedron(vertices, faces) {
  const indices = [];
  faces.forEach((face) => {
    if (face.length < 3) return;
    if (face.length > 3 && face.every(i => Math.abs(vertices[i].z - vertices[face[0]].z) < 1e-8)) {
      const triangles = THREE.ShapeUtils.triangulateShape(face.map(i => new THREE.Vector2(vertices[i].x, vertices[i].y)), []);
      triangles.forEach(triangle => indices.push(...triangle.map(i => face[i])));
      return;
    }
    for (let index = 1; index < face.length - 1; index += 1) {
      const triangle = [face[0], face[index], face[index + 1]];
      if (isDegenerateTriangle(vertices[triangle[0]], vertices[triangle[1]], vertices[triangle[2]])) continue;
      indices.push(...triangle);
    }
  });
  return indices;
}

function makePolyhedronGeometry(points, faces, weld = false) {
  const vertices = points.map(pointToVector);
  let indices = triangulatePolyhedron(vertices, faces);
  const positions = [];
  if (weld) {
    const unique = new Map();
    const remap = vertices.map(vertex => {
      const key = vertex.toArray().map(v => v.toFixed(7)).join(',');
      if (!unique.has(key)) {
        unique.set(key, positions.length / 3);
        positions.push(...vertex.toArray());
      }
      return unique.get(key);
    });
    indices = indices.map(i => remap[i]);
  } else vertices.forEach(vertex => positions.push(...vertex.toArray()));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}

function isDegenerateTriangle(a, b, c) {
  if (a.distanceToSquared(b) < 1e-8 || b.distanceToSquared(c) < 1e-8 || c.distanceToSquared(a) < 1e-8) return true;
  return b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() < 1e-10;
}

function makeRegionEdges(region, color) {
  const positions = [];
  if (region.edgeSegments?.length) {
    region.edgeSegments.forEach((segment) => {
      for (let index = 0; index < segment.length - 1; index += 1) {
        const start = pointToVector(segment[index]);
        const end = pointToVector(segment[index + 1]);
        if (start.distanceToSquared(end) < 1e-8) continue;
        positions.push(...start.toArray(), ...end.toArray());
      }
    });
  } else {
    const vertices = region.vertices.map(pointToVector);
    const seen = new Set();
    region.faces.forEach((face) => {
      for (let index = 0; index < face.length; index += 1) {
        const a = face[index];
        const b = face[(index + 1) % face.length];
        const key = a < b ? `${a}-${b}` : `${b}-${a}`;
        if (seen.has(key)) continue;
        seen.add(key);
        positions.push(...vertices[a].toArray(), ...vertices[b].toArray());
      }
    });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.36,
    linewidth: region.edgeWidth || 1,
    depthTest: region.edgeDepthTest ?? true,
    depthWrite: false,
  });
  return new THREE.LineSegments(geometry, material);
}

function makeCompositionGuide(diagram) {
  const group = new THREE.Group();
  const base = [
    baryToVector([1, 0, 0], 0),
    baryToVector([0, 1, 0], 0),
    baryToVector([0, 0, 1], 0),
  ];
  const positions = [];
  for (let index = 0; index < 3; index += 1) {
    positions.push(...base[index].toArray(), ...base[(index + 1) % 3].toArray());
  }

  for (let step = 1; step < 5; step += 1) {
    const f = step / 5;
    addGridLine(positions, [f, 1 - f, 0], [f, 0, 1 - f]);
    addGridLine(positions, [1 - f, f, 0], [0, f, 1 - f]);
    addGridLine(positions, [1 - f, 0, f], [0, 1 - f, f]);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  group.add(new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color: ternaryGridColor(), transparent: true, opacity: 0.48 }),
  ));

  const axis = baryToVector([1, 0, 0], 0);
  const axisTop = baryToVector([1, 0, 0], AXIS_TOP_T);
  group.add(makeLine([axis, axisTop], ternaryInkColor(), 0.72));

  [
    { text: "A", point: [1.07, -0.035, -0.035], color: 0x0284c7, scale: 0.24 },
    { text: "B", point: [-0.035, 1.07, -0.035], color: 0xd97706, scale: 0.24 },
    { text: "C", point: [-0.035, -0.035, 1.07], color: 0x7c3aed, scale: 0.24 },
    { text: diagram?.axisTemps?.specialLabel || "TE", vector: baryToVector([1.2, -0.12, -0.08], diagram?.axisTemps?.special ?? 0.32), color: 0xc44536, scale: 0.18 },
  ].forEach((label) => {
    const position = label.vector || baryToVector(label.point, 0);
    group.add(makeTextSprite(label.text, position, label.color, label.scale || 0.18));
  });

  if (diagram?.axisTemps) for (const [name, bary] of [['A', [1, 0, 0]], ['B', [0, 1, 0]], ['C', [0, 0, 1]]]) {
    const top = baryToVector(bary, diagram.axisTemps[name]);
    group.add(makeLine([baryToVector(bary, 0), top], ternaryInkColor(), 0.45));
    group.add(makeTextSprite(`T${name}`, top.clone().add(new THREE.Vector3(0, 0, 0.13)), ternaryInkColor(), 0.19));
  }

  return group;
}

function makeCotecticGuide(diagram) {
  const group = new THREE.Group();
  const guide = diagram?.guides || { curves: [], points: [] };
  guide.curves?.forEach((curve) => {
    group.add(makeLine(
      curve.points.map(pointToVector),
      resolveTernaryLineColor(curve.color ?? 0x263238),
      curve.opacity ?? 0.82,
    ));
  });
  guide.points?.forEach((item) => {
    const color = item.color ?? 0xc44536;
    const position = pointToVector(item.point);
    group.add(makePoint(position, color, diagram.curvedLiquidus ? 0.024 : 0.045));
    group.add(makeTextSprite(item.text, position.clone().add(new THREE.Vector3(0.06, 0.04, 0.055)), color, item.scale || (diagram.curvedLiquidus ? 0.15 : 0.2)));
  });
  return group;
}

function makePoint(position, color, radius) {
  const mesh = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 28, 18),
    new THREE.MeshStandardMaterial({ color, roughness: 0.36, metalness: 0.04 }),
  );
  mesh.position.copy(position);
  return mesh;
}

function makeLine(points, color, opacity) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points.flatMap((point) => point.toArray()), 3));
  return new THREE.Line(
    geometry,
    new THREE.LineBasicMaterial({ color, transparent: true, opacity, depthWrite: false }),
  );
}

function addGridLine(positions, start, end) {
  positions.push(...baryToVector(start, 0).toArray(), ...baryToVector(end, 0).toArray());
}

function pointToVector(point) {
  return baryToVector(point.b, point.t);
}

function baryToVector(bary, temp) {
  const [a, b, c] = bary;
  const x = -1.22 * a + 1.22 * b;
  const y = -0.7 * a - 0.7 * b + 1.4 * c;
  const z = temp * 2.35;
  return new THREE.Vector3(x, y, z);
}

function mixPoint(first, second, amount) {
  return {
    b: first.b.map((value, index) => value * (1 - amount) + second.b[index] * amount),
    t: first.t * (1 - amount) + second.t * amount,
  };
}

function makeTextSprite(text, position, color, scale = 0.2) {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const font = '600 64px Arial, "Microsoft YaHei", sans-serif';
    ctx.font = font;
    canvas.width = Math.ceil(ctx.measureText(text).width) + 20;
    canvas.height = 90;
    ctx.font = font;
    ctx.fillStyle = `#${resolveTernaryLineColor(color).toString(16).padStart(6, "0")}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineWidth = 5;
    ctx.lineJoin = 'round';
    const theme = document.documentElement.dataset.theme;
    ctx.strokeStyle = theme === 'dark' ? '#191d23' : theme === 'gray' ? '#f1f5f9' : '#ffffff';
    ctx.strokeText(text, canvas.width / 2, canvas.height / 2 + 2);
    ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 2);
  } else {
    canvas.width = 120;
    canvas.height = 90;
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, depthTest: false, toneMapped: false }));
  sprite.position.copy(position);
  sprite.scale.set(scale * canvas.width / canvas.height, scale, 1);
  sprite.renderOrder = 55;
  return sprite;
}

function lightenHex(color, amount) {
  const source = new THREE.Color(color);
  const target = new THREE.Color(0xffffff);
  source.lerp(target, amount);
  return source.getHex();
}

function ternarySceneBackground() {
  const theme = document.documentElement.dataset.theme;
  if (theme === "dark") return 0x0f1724;
  if (theme === "gray") return 0xe2e8f0;
  return 0xf3f7fa;
}

function ternaryInkColor() {
  const theme = document.documentElement.dataset.theme;
  if (theme === "dark") return 0xd7e3ed;
  if (theme === "gray") return 0x1e293b;
  return 0x263238;
}

function ternaryGridColor() {
  const theme = document.documentElement.dataset.theme;
  if (theme === "dark") return 0x46586e;
  if (theme === "gray") return 0x64748b;
  return 0x78909c;
}

function resolveTernaryLineColor(color) {
  if (document.documentElement.dataset.theme !== "dark") return color;
  return color === 0x1f2933 || color === 0x263238 ? ternaryInkColor() : color;
}
