import * as THREE from "three";
import { createSceneLoop } from "./scene-loop.js?v=20261008-phase-audit-motion";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { downloadCanvasPngWithWatermark } from "./export-watermark.js?v=20261008-phase-audit-motion";

const COLORS = {
  lattice: 0x0891b2,
  center: 0x4f46e5,
  octa: 0xd97706,
  tetra: 0x7c3aed,
  packingPlane: 0x0891b2,
  packingDirection: 0xd96d43,
};

const LATTICES = {
  bcc: {
    code: "BCC",
    name: "体心立方",
    title: "体心立方 BCC",
    centerLabel: "顶点与体心骨架原子",
    atomCount: "2",
    coordination: "8",
    octaCount: "6",
    tetraCount: "12",
    closePlane: "(110)",
    closeDirection: "[111]",
    note: "BCC 没有严格意义上的完全密排面，{110} 是原子面密度最大的晶面族，⟨111⟩ 为密排方向。间隙数量按一个晶胞折合计算。",
    tangentRadius: Math.sqrt(3) / 2,
    build: buildBccModel,
  },
  fcc: {
    code: "FCC",
    name: "面心立方",
    title: "面心立方 FCC",
    centerLabel: "顶点与面心骨架原子",
    atomCount: "4",
    coordination: "12",
    octaCount: "4",
    tetraCount: "8",
    closePlane: "(111)",
    closeDirection: "[110]",
    note: "FCC 的密排面为 {111}，密排方向为 ⟨110⟩。每个晶胞含 4 个八面体位和 8 个四面体位。",
    tangentRadius: 1 / Math.sqrt(2),
    build: buildFccModel,
  },
  hcp: {
    code: "HCP",
    name: "六方密排",
    title: "六方密排 HCP",
    centerLabel: "密排层骨架原子",
    atomCount: "6",
    coordination: "12",
    octaCount: "6",
    tetraCount: "12",
    closePlane: "(0001)",
    closeDirection: "[112̄0]",
    note: "HCP 的密排面为基面 (0001)，密排方向为 ⟨112̄0⟩。模型采用理想轴比 c/a = 1.633。",
    tangentRadius: 0.66,
    build: buildHcpModel,
  },
};

export function validateInterstitialLattices() {
  const expected = {
    bcc: { vertices: 8, centers: 1, octaSites: 18, tetraSites: 24 },
    fcc: { vertices: 8, centers: 6, octaSites: 13, tetraSites: 8 },
    hcp: { vertices: 12, centers: 5, octaSites: 6, tetraSites: 20 },
  };
  const issues = [];
  const summary = {};

  Object.entries(LATTICES).forEach(([id, definition]) => {
    const model = definition.build();
    summary[id] = {
      vertices: model.vertices.length,
      centers: model.centers.length,
      octaSites: model.octaSites.length,
      tetraSites: model.tetraSites.length,
    };
    Object.entries(expected[id]).forEach(([key, count]) => {
      if (model[key].length !== count) {
        issues.push(`${id}.${key}: expected ${count}, received ${model[key].length}`);
      }
    });

    [...model.vertices, ...model.centers, ...model.octaSites, ...model.tetraSites].forEach((point, index) => {
      if (![point.x, point.y, point.z].every(Number.isFinite)) {
        issues.push(`${id}: non-finite coordinate at point ${index}`);
      }
    });

    [
      ...model.outlineOctaSites.map((site) => ({ site, count: 6, kind: "octa" })),
      ...model.outlineTetraSites.map((site) => ({ site, count: 4, kind: "tetra" })),
    ].forEach(({ site, count, kind }, index) => {
      const neighbors = nearestUniquePoints(site, model.extendedHosts, count);
      if (neighbors.length !== count) {
        issues.push(`${id}.${kind}[${index}]: expected ${count} neighbors, received ${neighbors.length}`);
        return;
      }
      const distances = neighbors.map((point) => Math.sqrt(site.distanceToSquared(point)));
      const ratio = Math.max(...distances) / Math.max(1e-8, Math.min(...distances));
      if (ratio > 1.5) {
        issues.push(`${id}.${kind}[${index}]: coordination distortion ratio ${ratio.toFixed(3)}`);
      }
    });
  });

  return { ok: issues.length === 0, issues, summary };
}

export function initInterstitialLatticeModule() {
  const els = {
    host: document.querySelector("#interstitialViewerHost"),
    latticeButtons: document.querySelectorAll("[data-interstitial-lattice]"),
    toggleButtons: document.querySelectorAll("[data-interstitial-toggle]"),
    atomRadius: document.querySelector("#interstitialAtomRadius"),
    atomRadiusValue: document.querySelector("#interstitialAtomRadiusValue"),
    centerLabel: document.querySelector("#interstitialCenterLabel"),
    title: document.querySelector("#interstitialTitle"),
    atomCount: document.querySelector("#interstitialAtomCount"),
    coordination: document.querySelector("#interstitialCoordination"),
    octaCount: document.querySelector("#interstitialOctaCount"),
    tetraCount: document.querySelector("#interstitialTetraCount"),
    closePlaneLabel: document.querySelector("#interstitialClosePlaneLabel"),
    closeDirectionLabel: document.querySelector("#interstitialCloseDirectionLabel"),
    closePlaneReadout: document.querySelector("#interstitialClosePlaneReadout"),
    closeDirectionReadout: document.querySelector("#interstitialCloseDirectionReadout"),
    note: document.querySelector("#interstitialNote"),
    viewerCode: document.querySelector("#interstitialViewerCode"),
    viewerName: document.querySelector("#interstitialViewerName"),
    viewerStats: document.querySelector("#interstitialViewerStats"),
    resetButton: document.querySelector("#interstitialResetButton"),
    exportButton: document.querySelector("#interstitialExportButton"),
    ratioReadout: document.querySelector("#interstitialRatioReadout"),
    tangentBadge: document.querySelector("#interstitialTangentBadge"),
  };

  if (!els.host) return { refresh: () => {} };

  const state = {
    lattice: "bcc",
    atomRadius: Number(els.atomRadius?.value) || 0.34,
    visible: {
      vertices: true,
      centers: true,
      octaOutline: true,
      octaAtoms: false,
      tetraOutline: true,
      tetraAtoms: false,
      closePlane: false,
      closeDirection: false,
    },
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
  renderer.toneMappingExposure = 1.08;
  els.host.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.up.set(0, 0, 1);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.075;
  controls.rotateSpeed = 0.66;
  controls.zoomSpeed = 0.82;
  controls.panSpeed = 0.42;
  controls.enablePan = true;
  controls.minDistance = 3.2;
  controls.maxDistance = 14;

  const root = new THREE.Group();
  scene.add(root);

  const hemisphere = new THREE.HemisphereLight(0xf1f5f9, 0x9ca3af, 1.2);
  scene.add(hemisphere);
  const key = new THREE.DirectionalLight(0xe2e8f0, 1.4);
  key.position.set(4.8, -5.6, 7.4);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xcbd5e1, 0.45);
  fill.position.set(-5.2, 2.8, 3.8);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xe2e8f0, 0.35);
  rim.position.set(2.2, 5.6, -2.4);
  scene.add(rim);

  wireUi();
  const initDef = LATTICES[state.lattice];
  const initialCenterEl = document.querySelector("#interstitialCenterLabel");
  if (initialCenterEl && initDef?.centerLabel) initialCenterEl.textContent = initDef.centerLabel;
  applySceneTheme();
  drawLattice(true);
  resize();
  createSceneLoop({ host: els.host, controls, render: () => renderer.render(scene, camera) });

  if ("ResizeObserver" in window) {
    new ResizeObserver(resize).observe(els.host);
  }
  window.addEventListener("resize", resize);
  window.addEventListener("mstool:themechange", () => {
    applySceneTheme();
    drawLattice(false);
  });

  return {
    refresh() {
      resize();
      controls.update();
    },
  };

  function wireUi() {
    els.latticeButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const lattice = button.dataset.interstitialLattice;
        if (!LATTICES[lattice] || state.lattice === lattice) return;
        state.lattice = lattice;
        els.latticeButtons.forEach((item) => item.classList.toggle("is-active", item === button));
        const definition = LATTICES[lattice];
        const centerLabelEl = document.querySelector("#interstitialCenterLabel");
        if (centerLabelEl && definition.centerLabel) {
          centerLabelEl.textContent = definition.centerLabel;
        }
        const planeEl = document.querySelector("#interstitialPlaneReadout");
        if (planeEl && definition.closePlane) {
          planeEl.textContent = definition.closePlane;
        }
        const dirEl = document.querySelector("#interstitialDirectionReadout");
        if (dirEl && definition.closeDirection) {
          dirEl.textContent = definition.closeDirection;
        }
        if (els.atomRadius && definition.tangentRadius) {
          els.atomRadius.max = definition.tangentRadius.toFixed(3);
          state.atomRadius = Math.min(definition.tangentRadius * 0.42, definition.tangentRadius);
          els.atomRadius.value = state.atomRadius.toFixed(3);
          if (els.atomRadiusValue) els.atomRadiusValue.value = state.atomRadius.toFixed(2);
        }
        drawLattice(true);
      });
    });

    els.toggleButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.dataset.interstitialToggle;
        if (key === "latticeAtoms") {
          const next = !(state.visible.vertices || state.visible.centers);
          state.visible.vertices = next;
          state.visible.centers = next;
          button.classList.toggle("is-active", next);
          button.setAttribute("aria-pressed", String(next));
          drawLattice(false);
          return;
        }
        if (!(key in state.visible)) return;
        state.visible[key] = !state.visible[key];
        button.classList.toggle("is-active", state.visible[key]);
        button.setAttribute("aria-pressed", String(state.visible[key]));
        drawLattice(false);
      });
    });

    els.atomRadius?.addEventListener("input", () => {
      state.atomRadius = Number(els.atomRadius.value);
      if (els.atomRadiusValue) els.atomRadiusValue.value = state.atomRadius.toFixed(2);
      const definition = LATTICES[state.lattice];
      if (els.ratioReadout && definition.tangentRadius) {
        const ratio = (state.atomRadius / definition.tangentRadius).toFixed(3);
        els.ratioReadout.textContent = `${ratio} × r_max`;
      }
      if (els.tangentBadge && definition.tangentRadius) {
        const isTangent = state.atomRadius >= definition.tangentRadius - 0.005;
        els.tangentBadge.textContent = isTangent ? "✔ 相切" : "未相切";
        els.tangentBadge.classList.toggle("is-tangent", isTangent);
      }
      drawLattice(false);
    });

    els.resetButton?.addEventListener("click", () => resetCamera(currentModel()));
    els.exportButton?.addEventListener("click", exportPng);
  }

  function drawLattice(resetView) {
    disposeChildren(root);
    const definition = LATTICES[state.lattice];
    const model = definition.build();

    root.add(makeCellEdges(model.cellEdges));
    root.add(makeGroundGrid(model.floorZ));

    if (state.visible.vertices) {
      root.add(makeAtomGroup(model.vertices, state.atomRadius, COLORS.lattice));
    }
    if (state.visible.centers) {
      root.add(makeAtomGroup(model.centers, state.atomRadius, COLORS.center));
    }
    if (state.visible.octaOutline) {
      model.outlineOctaSites.forEach((site) => {
        root.add(makeCoordinationOutline(site, model.extendedHosts, 6, COLORS.octa));
      });
    }
    if (state.visible.tetraOutline) {
      model.outlineTetraSites.forEach((site) => {
        root.add(makeCoordinationOutline(site, model.extendedHosts, 4, COLORS.tetra));
      });
    }
    if (state.visible.octaAtoms) {
      root.add(makeInterstitialAtoms(model.octaSites, state.atomRadius * 0.46, COLORS.octa));
    }
    if (state.visible.tetraAtoms) {
      root.add(makeInterstitialAtoms(model.tetraSites, state.atomRadius * 0.38, COLORS.tetra));
    }
    if (state.visible.closePlane) {
      root.add(makePackingPlane(model.packing.plane, COLORS.packingPlane));
    }
    if (state.visible.closeDirection) {
      root.add(makePackingDirection(model.packing.direction, COLORS.packingDirection));
    }

    updateInfo(definition);
    if (resetView) resetCamera(model);
  }

  function currentModel() {
    return LATTICES[state.lattice].build();
  }

  function updateInfo(definition) {
    if (els.centerLabel) els.centerLabel.textContent = definition.centerLabel;
    if (els.title) els.title.textContent = definition.title;
    if (els.atomCount) els.atomCount.textContent = definition.atomCount;
    if (els.coordination) els.coordination.textContent = definition.coordination;
    if (els.octaCount) els.octaCount.textContent = definition.octaCount;
    if (els.tetraCount) els.tetraCount.textContent = definition.tetraCount;
    if (els.closePlaneLabel) els.closePlaneLabel.textContent = definition.closePlane;
    if (els.closeDirectionLabel) els.closeDirectionLabel.textContent = definition.closeDirection;
    if (els.closePlaneReadout) els.closePlaneReadout.textContent = definition.closePlane;
    if (els.closeDirectionReadout) els.closeDirectionReadout.textContent = definition.closeDirection;
    if (els.note) els.note.textContent = definition.note;
    if (els.viewerCode) els.viewerCode.textContent = definition.code;
    if (els.viewerName) els.viewerName.textContent = definition.name;
    if (els.viewerStats) els.viewerStats.textContent = `(${definition.atomCount} 原子)`;
    if (els.ratioReadout && definition.tangentRadius) {
      const ratio = (state.atomRadius / definition.tangentRadius).toFixed(3);
      els.ratioReadout.textContent = `${ratio} × r_max`;
    }
    if (els.tangentBadge) {
      const isTangent = state.atomRadius >= definition.tangentRadius - 0.005;
      els.tangentBadge.textContent = isTangent ? "✔ 相切" : "未相切";
      els.tangentBadge.classList.toggle("is-tangent", isTangent);
    }
  }

  function applySceneTheme() {
    const theme = currentTheme();
    const dark = theme === "dark";
    scene.background = new THREE.Color(sceneBackground());
    hemisphere.groundColor.set(dark ? 0x26354a : theme === "gray" ? 0x7c8b9e : 0x9ca3af);
    renderer.toneMappingExposure = dark ? 1.2 : theme === "gray" ? 1.04 : 1.08;
  }

  function resetCamera(model) {
    const distance = model.cameraDistance;
    camera.position.set(distance * 0.72, -distance, distance * 0.66);
    controls.target.set(0, 0, 0);
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
    camera.updateProjectionMatrix();
  }

  function exportPng() {
    controls.update();
    renderer.render(scene, camera);
    downloadCanvasPngWithWatermark(renderer.domElement, `lattice-${state.lattice}-interstitial.png`);
  }
}

function buildBccModel() {
  const corners = cubeCornerFractions();
  const centers = [[0.5, 0.5, 0.5]];
  const faceCenters = cubicFaceCenters();
  const edgeCenters = cubicEdgeCenters();
  const tetraSites = bccTetrahedralSites();
  return buildCubicModel({
    vertices: corners,
    centers,
    basis: [[0, 0, 0], [0.5, 0.5, 0.5]],
    octaSites: [...faceCenters, ...edgeCenters],
    tetraSites,
    outlineOctaSites: [[0.5, 0.5, 0], [0.5, 0, 0]],
    outlineTetraSites: [[0.5, 0.25, 0], [0.25, 0.5, 0]],
    packing: {
      plane: [[0, 0, 0], [1, 1, 0], [1, 1, 1], [0, 0, 1]],
      direction: [
        [[0, 0, 0], [1, 1, 1]],
        [[1, 1, 0], [0, 0, 1]],
      ],
    },
  });
}

function buildFccModel() {
  const corners = cubeCornerFractions();
  const centers = cubicFaceCenters();
  const edgeCenters = cubicEdgeCenters();
  const tetraSites = [];
  [0.25, 0.75].forEach((x) => {
    [0.25, 0.75].forEach((y) => {
      [0.25, 0.75].forEach((z) => tetraSites.push([x, y, z]));
    });
  });
  return buildCubicModel({
    vertices: corners,
    centers,
    basis: [[0, 0, 0], [0, 0.5, 0.5], [0.5, 0, 0.5], [0.5, 0.5, 0]],
    octaSites: [[0.5, 0.5, 0.5], ...edgeCenters],
    tetraSites,
    outlineOctaSites: [[0.5, 0.5, 0.5], [0.5, 0, 0]],
    outlineTetraSites: [[0.25, 0.25, 0.25], [0.75, 0.75, 0.75]],
    packing: {
      plane: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
      direction: [[0, 1, 0], [1, 0, 0]],
    },
  });
}

function buildCubicModel(spec) {
  const converter = (frac) => new THREE.Vector3(
    (frac[0] - 0.5) * 2,
    (frac[1] - 0.5) * 2,
    (frac[2] - 0.5) * 2,
  );
  const cornerVectors = spec.vertices.map(converter);
  const edgeIndices = [
    [0, 1], [1, 3], [3, 2], [2, 0],
    [4, 5], [5, 7], [7, 6], [6, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const cellEdges = edgeIndices.map(([a, b]) => [cornerVectors[a], cornerVectors[b]]);
  const extendedHosts = [];
  for (let i = -2; i <= 2; i += 1) {
    for (let j = -2; j <= 2; j += 1) {
      for (let k = -2; k <= 2; k += 1) {
        spec.basis.forEach((site) => {
          extendedHosts.push(converter([site[0] + i, site[1] + j, site[2] + k]));
        });
      }
    }
  }
  return {
    vertices: spec.vertices.map(converter),
    centers: spec.centers.map(converter),
    octaSites: spec.octaSites.map(converter),
    tetraSites: spec.tetraSites.map(converter),
    outlineOctaSites: spec.outlineOctaSites.map(converter),
    outlineTetraSites: spec.outlineTetraSites.map(converter),
    packing: {
      plane: spec.packing.plane.map(converter),
      direction: Array.isArray(spec.packing.direction[0]) && Array.isArray(spec.packing.direction[0][0])
        ? spec.packing.direction.map(pair => pair.map(converter))
        : spec.packing.direction.map(converter),
    },
    extendedHosts,
    cellEdges,
    floorZ: -1.22,
    cameraDistance: 6.75,
  };
}

function buildHcpModel() {
  const a = 1.32;
  const layerSpacing = a * Math.sqrt(2 / 3);
  const bottomZ = -layerSpacing;
  const topZ = layerSpacing;
  const ring = hexRing(a);
  const bottom = ring.map((point) => new THREE.Vector3(point.x, point.y, bottomZ));
  const top = ring.map((point) => new THREE.Vector3(point.x, point.y, topZ));
  const basalCenters = [
    new THREE.Vector3(0, 0, bottomZ),
    new THREE.Vector3(0, 0, topZ),
  ];

  const insideRadius = a / Math.sqrt(3);
  const bLayer = radialPoints(insideRadius, [30, 150, 270], 0);
  const vertices = [...bottom, ...top];
  const centers = [...basalCenters, ...bLayer];
  const cellEdges = [];
  for (let index = 0; index < 6; index += 1) {
    const next = (index + 1) % 6;
    cellEdges.push([bottom[index], bottom[next]]);
    cellEdges.push([top[index], top[next]]);
    cellEdges.push([bottom[index], top[index]]);
  }

  const octaPlanar = radialPoints(insideRadius, [90, 210, 330], 0);
  const octaSites = [
    ...octaPlanar.map((point) => point.clone().setZ(-layerSpacing / 2)),
    ...octaPlanar.map((point) => point.clone().setZ(layerSpacing / 2)),
  ];

  const aLayerVisible = [new THREE.Vector3(0, 0, 0), ...ring];
  const tetraSites = [
    ...bLayer.map((point) => point.clone().setZ((-3 * layerSpacing) / 4)),
    ...aLayerVisible.map((point) => point.clone().setZ(-layerSpacing / 4)),
    ...aLayerVisible.map((point) => point.clone().setZ(layerSpacing / 4)),
    ...bLayer.map((point) => point.clone().setZ((3 * layerSpacing) / 4)),
  ];

  const a1 = new THREE.Vector3(a, 0, 0);
  const a2 = new THREE.Vector3(a / 2, (Math.sqrt(3) * a) / 2, 0);
  const offsetB = a1.clone().add(a2).multiplyScalar(1 / 3);
  const extendedHosts = [];
  for (let layer = -4; layer <= 4; layer += 1) {
    const offset = Math.abs(layer % 2) === 0 ? offsetB : new THREE.Vector3();
    for (let i = -4; i <= 4; i += 1) {
      for (let j = -4; j <= 4; j += 1) {
        extendedHosts.push(
          offset
            .clone()
            .addScaledVector(a1, i)
            .addScaledVector(a2, j)
            .setZ(layer * layerSpacing),
        );
      }
    }
  }

  return {
    vertices,
    centers,
    octaSites,
    tetraSites,
    outlineOctaSites: [
      octaPlanar[0].clone().setZ(-layerSpacing / 2),
      octaPlanar[1].clone().setZ(layerSpacing / 2),
    ],
    outlineTetraSites: [
      bLayer[0].clone().setZ((-3 * layerSpacing) / 4),
      new THREE.Vector3(0, 0, -layerSpacing / 4),
      new THREE.Vector3(0, 0, layerSpacing / 4),
      bLayer[1].clone().setZ((3 * layerSpacing) / 4),
    ],
    packing: {
      plane: ring.map((point) => point.clone().setZ(0)),
      direction: [
        new THREE.Vector3(-a, 0, 0),
        new THREE.Vector3(a, 0, 0),
      ],
    },
    extendedHosts,
    cellEdges,
    floorZ: bottomZ - 0.28,
    cameraDistance: 7.75,
  };
}

function cubeCornerFractions() {
  return [
    [0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0],
    [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1],
  ];
}

function cubicFaceCenters() {
  return [
    [0.5, 0.5, 0], [0.5, 0.5, 1],
    [0.5, 0, 0.5], [0.5, 1, 0.5],
    [0, 0.5, 0.5], [1, 0.5, 0.5],
  ];
}

function cubicEdgeCenters() {
  const sites = [];
  [0, 1].forEach((fixedA) => {
    [0, 1].forEach((fixedB) => {
      sites.push([0.5, fixedA, fixedB]);
      sites.push([fixedA, 0.5, fixedB]);
      sites.push([fixedA, fixedB, 0.5]);
    });
  });
  return uniqueFractionalSites(sites);
}

function bccTetrahedralSites() {
  const sites = [];
  [0, 1].forEach((boundary) => {
    [0.25, 0.75].forEach((quarter) => {
      sites.push([0.5, quarter, boundary], [quarter, 0.5, boundary]);
      sites.push([boundary, 0.5, quarter], [boundary, quarter, 0.5]);
      sites.push([0.5, boundary, quarter], [quarter, boundary, 0.5]);
    });
  });
  return uniqueFractionalSites(sites);
}

function uniqueFractionalSites(sites) {
  const seen = new Set();
  return sites.filter((site) => {
    const key = site.map((value) => value.toFixed(3)).join("-");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hexRing(radius) {
  return radialPoints(radius, [0, 60, 120, 180, 240, 300], 0);
}

function radialPoints(radius, degrees, z) {
  return degrees.map((degree) => {
    const angle = THREE.MathUtils.degToRad(degree);
    return new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius, z);
  });
}

function makeCellEdges(edges) {
  const positions = edges.flatMap(([start, end]) => [...start.toArray(), ...end.toArray()]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const theme = currentTheme();
  const material = new THREE.LineBasicMaterial({
    color: themeInkColor(),
    transparent: true,
    opacity: theme === "dark" ? 0.72 : theme === "gray" ? 0.66 : 0.58,
  });
  return new THREE.LineSegments(geometry, material);
}

function makeGroundGrid(z) {
  const theme = currentTheme();
  const color = theme === "dark" ? 0x4b5563 : theme === "gray" ? 0x94a3b8 : 0xd1d5db;
  const grid = new THREE.GridHelper(7.2, 18, color, color);
  grid.rotation.x = Math.PI / 2;
  grid.position.z = z;
  grid.material.transparent = true;
  grid.material.opacity = theme === "dark" ? 0.2 : theme === "gray" ? 0.32 : 0.28;
  grid.material.depthWrite = false;
  return grid;
}

let _stippleTexture = null;
function makeStippleBumpMap() {
  if (_stippleTexture) return _stippleTexture;
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 3200; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const r = Math.random() * 1.2 + 0.3;
    const alpha = Math.random() * 0.12;
    ctx.fillStyle = Math.random() > 0.5 ? `rgba(0,0,0,${alpha})` : `rgba(255,255,255,${alpha})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  _stippleTexture = texture;
  return texture;
}

function makeAtomGroup(points, radius, color) {
  const group = new THREE.Group();
  const geometry = new THREE.SphereGeometry(radius, 38, 24);
  const material = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.55,
    metalness: 0.15,
    clearcoat: 0.2,
    clearcoatRoughness: 0.5,
    bumpMap: makeStippleBumpMap(),
    bumpScale: 0.008,
    emissive: color,
    emissiveIntensity: 0.005,
  });
  points.forEach((point) => {
    const atom = new THREE.Mesh(geometry, material);
    atom.position.copy(point);
    group.add(atom);
  });
  return group;
}

function makeInterstitialAtoms(points, radius, color) {
  const group = new THREE.Group();
  const geometry = new THREE.SphereGeometry(Math.max(0.075, radius), 34, 20);
  const material = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.6,
    metalness: 0.12,
    clearcoat: 0.15,
    clearcoatRoughness: 0.55,
    bumpMap: makeStippleBumpMap(),
    bumpScale: 0.006,
    emissive: color,
    emissiveIntensity: 0.004,
  });
  points.forEach((point) => {
    const atom = new THREE.Mesh(geometry, material);
    atom.position.copy(point);
    group.add(atom);
  });
  return group;
}

function makePackingPlane(points, color) {
  const group = new THREE.Group();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(points.flatMap((point) => point.toArray()), 3));
  const indices = [];
  for (let index = 1; index < points.length - 1; index += 1) {
    indices.push(0, index, index + 1);
  }
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const theme = currentTheme();
  const plane = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: theme === "dark" ? 0.22 : theme === "gray" ? 0.20 : 0.16,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  plane.renderOrder = 7;
  group.add(plane);

  const borderGeometry = new THREE.BufferGeometry().setFromPoints([...points, points[0]]);
  const border = new THREE.Line(
    borderGeometry,
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.96,
      depthTest: false,
      depthWrite: false,
    }),
  );
  border.renderOrder = 28;
  group.add(border);
  return group;
}

function makePackingDirection(input, color) {
  const group = new THREE.Group();
  if (!input) return group;
  const pairs = (Array.isArray(input[0]) && Array.isArray(input[0][0])) || (Array.isArray(input[0]) && input[0][0] instanceof THREE.Vector3)
    ? input
    : [input];

  for (const [start, end] of pairs) {
    if (!start || !end) continue;
    const direction = end.clone().sub(start);
    const length = direction.length();
    if (length < 1e-8) continue;
    direction.normalize();
    const coneLength = Math.min(0.3, length * 0.18);
    const shaftLength = Math.max(0.08, length - coneLength);
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.34,
      metalness: 0.04,
      emissive: color,
      emissiveIntensity: isDarkTheme() ? 0.2 : 0.06,
      depthTest: false,
      depthWrite: false,
    });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, shaftLength, 16), material);
    shaft.position.copy(start).addScaledVector(direction, shaftLength / 2);
    shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    shaft.renderOrder = 30;
    group.add(shaft);

    const head = new THREE.Mesh(new THREE.ConeGeometry(0.12, coneLength, 20), material);
    head.position.copy(start).addScaledVector(direction, shaftLength + coneLength / 2);
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    head.renderOrder = 31;
    group.add(head);

    const origin = new THREE.Mesh(new THREE.SphereGeometry(0.065, 20, 12), material);
    origin.position.copy(start);
    origin.renderOrder = 31;
    group.add(origin);
  }
  return group;
}

function makeCoordinationOutline(site, hostPoints, coordination, color) {
  const group = new THREE.Group();
  const neighbors = nearestUniquePoints(site, hostPoints, coordination);
  if (neighbors.length < coordination) return group;

  const pairs = [];
  for (let a = 0; a < neighbors.length; a += 1) {
    for (let b = a + 1; b < neighbors.length; b += 1) {
      pairs.push({ a, b, distance: neighbors[a].distanceToSquared(neighbors[b]) });
    }
  }
  pairs.sort((left, right) => left.distance - right.distance);
  const edgeCount = coordination === 4 ? 6 : 12;
  const outlinePositions = pairs
    .slice(0, edgeCount)
    .flatMap(({ a, b }) => [...neighbors[a].toArray(), ...neighbors[b].toArray()]);
  const spokePositions = neighbors.flatMap((neighbor) => [...site.toArray(), ...neighbor.toArray()]);

  const outlineGeometry = new THREE.BufferGeometry();
  outlineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(outlinePositions, 3));
  const outlineMaterial = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.92,
    depthTest: false,
    depthWrite: false,
  });
  const outline = new THREE.LineSegments(outlineGeometry, outlineMaterial);
  outline.renderOrder = 20;
  group.add(outline);

  const spokeGeometry = new THREE.BufferGeometry();
  spokeGeometry.setAttribute("position", new THREE.Float32BufferAttribute(spokePositions, 3));
  const spokeMaterial = new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.24,
    depthTest: false,
    depthWrite: false,
  });
  const spokes = new THREE.LineSegments(spokeGeometry, spokeMaterial);
  spokes.renderOrder = 19;
  group.add(spokes);

  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 24, 14),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.92,
      depthTest: false,
      depthWrite: false,
    }),
  );
  marker.position.copy(site);
  marker.renderOrder = 21;
  group.add(marker);
  return group;
}

function nearestUniquePoints(origin, points, count) {
  const unique = [];
  [...points]
    .sort((a, b) => origin.distanceToSquared(a) - origin.distanceToSquared(b))
    .forEach((point) => {
      if (unique.length >= count) return;
      if (unique.some((item) => item.distanceToSquared(point) < 1e-10)) return;
      unique.push(point);
    });
  return unique;
}

function disposeChildren(group) {
  group.traverse((object) => {
    object.geometry?.dispose?.();
    const materials = Array.isArray(object.material) ? object.material : [object.material].filter(Boolean);
    materials.forEach((material) => {
      material.map?.dispose?.();
      material.dispose?.();
    });
  });
  group.clear();
}

function currentTheme() {
  return document.documentElement.dataset.theme || "light";
}

function isDarkTheme() {
  return currentTheme() === "dark";
}

function sceneBackground() {
  const theme = currentTheme();
  if (theme === "dark") return 0x12161f;
  if (theme === "gray") return 0xdce2ea;
  return 0xf8fafc;
}

function themeInkColor() {
  const theme = currentTheme();
  if (theme === "dark") return 0xd7e3ed;
  if (theme === "gray") return 0x1e293b;
  return 0x263442;
}
