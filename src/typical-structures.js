import * as THREE from "three";
import { NANOTUBE } from "./nanotube-data.js?v=20261008-phase-audit-motion";
import { createSceneLoop, disposeSceneChildren } from "./scene-loop.js?v=20261008-phase-audit-motion";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { downloadCanvasPngWithWatermark } from "./export-watermark.js?v=20261008-phase-audit-motion";

const ELEMENTS = {
  Al: { color: 0x3b82f6, radius: 0.18 },
  C: { color: 0x1f2937, darkColor: 0x9ca3af, radius: 0.14 },
  Ca: { color: 0xf59e0b, radius: 0.2 },
  Cl: { color: 0x10b981, radius: 0.18 },
  Cs: { color: 0x6366f1, radius: 0.23 },
  F: { color: 0x06b6d4, radius: 0.13 },
  Mg: { color: 0x0ea5e9, radius: 0.18 },
  Na: { color: 0x2563eb, radius: 0.16 },
  O: { color: 0xef4444, radius: 0.12 },
  S: { color: 0xeab308, radius: 0.17 },
  Si: { color: 0x0f766e, darkColor: 0x2dd4bf, radius: 0.15 },
  Ti: { color: 0x8b5cf6, darkColor: 0xa78bfa, radius: 0.15 },
  Zn: { color: 0xd97706, radius: 0.16 },
};

const STRUCTURES = [
  {
    id: "diamond-c",
    category: "atomic",
    title: "金刚石 C",
    formula: "C",
    mpId: "mp-66",
    mpUrl: "https://next-gen.materialsproject.org/materials/mp-66",
    spaceGroup: "Fd-3m (227)",
    coordination: "4",
    lattice: cubic(3.57),
    atoms: diamond("C"),
    bondCutoff: 1.75,
    tangentScale: 1.0,
    description: "典型共价原子晶体，复杂 FCC 结构。每个 C 原子与 4 个最近邻形成正四面体，符合 8-N 规则。",
  },
  {
    id: "graphite-c",
    category: "atomic",
    title: "石墨 C",
    formula: "C",
    mpId: "mp-48",
    mpUrl: "https://next-gen.materialsproject.org/materials/mp-48",
    spaceGroup: "P6₃/mmc (194)",
    coordination: "3 + 层间",
    generator: graphiteModel,
    bondCutoff: 1.52,
    showCell: false,
    repeatable: false,
    description: "石墨由 sp² 碳六角网层堆叠形成，层内 C-C 键约 0.142 nm，层间距约 0.335 nm。",
  },
  {
    id: "graphene-c",
    category: "atomic",
    title: "石墨烯",
    formula: "C",
    mpId: "本地模型",
    mpUrl: "",
    spaceGroup: "二维蜂窝晶格",
    coordination: "3",
    generator: grapheneModel,
    bondCutoff: 1.52,
    showCell: false,
    repeatable: false,
    description: "石墨烯是单层二维蜂窝晶格，也是富勒烯、碳纳米管和石墨的基本结构单元。",
  },
  {
    id: "fullerene-c60",
    category: "atomic",
    title: "富勒烯 C60",
    formula: "C60",
    mpId: "本地模型",
    mpUrl: "",
    spaceGroup: "分子笼状结构",
    coordination: "3",
    generator: fullereneModel,
    bondCutoff: 1.65,
    showCell: false,
    repeatable: false,
    description: "富勒烯是由五元环和六元环组成的中空碳笼，C60 常被称为巴基球。",
  },
  {
    id: "cnt-c",
    category: "atomic",
    title: "碳纳米管",
    formula: "C",
    mpId: "本地模型",
    mpUrl: "",
    spaceGroup: "扶手椅型 (6, 6) · 开口单壁",
    coordination: "3",
    generator: nanotubeModel,
    bondCutoff: 1.55,
    showCell: false,
    repeatable: false,
    description: "ASE 构建的 (6, 6) 扶手椅型单壁碳纳米管，沿轴向显示 6 个周期。管壁为六元环，内部碳原子为三配位；两端截断、不封口，边缘原子配位不完整。",
  },
  {
    id: "nacl",
    category: "ionic",
    title: "NaCl 岩盐结构",
    formula: "NaCl",
    mpId: "mp-22862",
    mpUrl: "https://next-gen.materialsproject.org/materials/mp-22862",
    spaceGroup: "Fm-3m (225)",
    coordination: "6:6",
    lattice: cubic(5.64),
    atoms: [
      ...fcc("Cl"),
      atom("Na", 0.5, 0, 0),
      atom("Na", 0, 0.5, 0),
      atom("Na", 0, 0, 0.5),
      atom("Na", 0.5, 0.5, 0.5),
    ],
    bondCutoff: 3.05,
    bondPairs: [["Na", "Cl"]],
    description: "岩盐结构中 Na⁺ 和 Cl⁻ 都为八面体 6 配位，可视为两套互穿的 FCC 子晶格。",
  },
  {
    id: "cscl",
    category: "ionic",
    title: "CsCl 结构",
    formula: "CsCl",
    mpId: "mp-22865",
    mpUrl: "https://next-gen.materialsproject.org/materials/mp-22865",
    spaceGroup: "Pm-3m (221)",
    coordination: "8:8",
    lattice: cubic(4.12),
    atoms: [
      atom("Cl", 0, 0, 0),
      atom("Cs", 0.5, 0.5, 0.5),
    ],
    bondCutoff: 3.8,
    bondPairs: [["Cs", "Cl"]],
    description: "CsCl 为两套简单立方子晶格互穿，中心离子与 8 个角点异号离子配位。",
  },
  {
    id: "zns",
    category: "ionic",
    title: "ZnS 闪锌矿结构",
    formula: "ZnS",
    mpId: "mp-10695",
    mpUrl: "https://next-gen.materialsproject.org/materials/mp-10695",
    spaceGroup: "F-43m (216)",
    coordination: "4:4",
    lattice: cubic(5.41),
    atoms: [
      ...fcc("S"),
      ...shiftedFcc("Zn", 0.25, 0.25, 0.25),
    ],
    bondCutoff: 2.55,
    bondPairs: [["Zn", "S"]],
    description: "闪锌矿结构中 Zn 与 S 互为四面体配位，与金刚石结构同构但由两种元素占据。",
  },
  {
    id: "wurtzite-zns",
    category: "ionic",
    title: "ZnS 纤锌矿结构",
    formula: "ZnS",
    mpId: "mp-560588",
    mpUrl: "https://next-gen.materialsproject.org/materials/mp-560588",
    spaceGroup: "P6₃mc (186)",
    coordination: "4:4",
    lattice: hexagonal(3.82, 6.26),
    atoms: wurtzite("Zn", "S"),
    bondCutoff: 2.55,
    bondPairs: [["Zn", "S"]],
    description: "纤锌矿属六方晶系，负离子作六方紧密堆积，正离子占据四面体间隙。",
  },
  {
    id: "caf2",
    category: "ionic",
    title: "CaF₂ 萤石结构",
    formula: "CaF₂",
    mpId: "mp-2741",
    mpUrl: "https://next-gen.materialsproject.org/materials/mp-2741",
    spaceGroup: "Fm-3m (225)",
    coordination: "Ca:8 / F:4",
    lattice: cubic(5.46),
    atoms: [
      ...fcc("Ca"),
      atom("F", 0.25, 0.25, 0.25),
      atom("F", 0.25, 0.25, 0.75),
      atom("F", 0.25, 0.75, 0.25),
      atom("F", 0.75, 0.25, 0.25),
      atom("F", 0.75, 0.75, 0.25),
      atom("F", 0.75, 0.25, 0.75),
      atom("F", 0.25, 0.75, 0.75),
      atom("F", 0.75, 0.75, 0.75),
    ],
    bondCutoff: 2.55,
    bondPairs: [["Ca", "F"]],
    description: "萤石结构中 Ca²⁺ 构成 FCC 骨架，F⁻ 填充全部四面体空隙。",
  },
  {
    id: "rutile",
    category: "ionic",
    title: "TiO₂ 金红石结构",
    formula: "TiO₂",
    mpId: "mp-390",
    mpUrl: "https://next-gen.materialsproject.org/materials/mp-390",
    spaceGroup: "P4₂/mnm (136)",
    coordination: "Ti:6 / O:3",
    lattice: tetragonal(4.59, 2.96),
    atoms: [
      atom("Ti", 0, 0, 0),
      atom("Ti", 0.5, 0.5, 0.5),
      atom("O", 0.305, 0.305, 0),
      atom("O", 0.695, 0.695, 0),
      atom("O", 0.805, 0.195, 0.5),
      atom("O", 0.195, 0.805, 0.5),
    ],
    bondCutoff: 2.2,
    bondPairs: [["Ti", "O"]],
    description: "金红石是 TiO₂ 的典型 AB2 型结构，TiO6 八面体沿 c 轴连接。",
  },
  {
    id: "corundum",
    category: "ionic",
    title: "α-Al₂O₃ 刚玉结构",
    formula: "Al₂O₃",
    mpId: "mp-1143",
    mpUrl: "https://next-gen.materialsproject.org/materials/mp-1143",
    spaceGroup: "R-3c (167)",
    coordination: "Al:6 / O:4",
    lattice: hexagonal(4.76, 12.99),
    atoms: corundumAl2O3(),
    bondCutoff: 2.15,
    bondPairs: [["Al", "O"]],
    description: "刚玉结构中 O²⁻ 近似六方密排，Al³⁺ 填充八面体间隙的 2/3。",
  },
  {
    id: "catio3",
    category: "ionic",
    title: "CaTiO₃ 钙钛矿结构",
    formula: "CaTiO₃",
    mpId: "mp-5827",
    mpUrl: "https://next-gen.materialsproject.org/materials/mp-5827",
    spaceGroup: "Pm-3m (221)",
    coordination: "A:12 / B:6",
    lattice: cubic(3.82),
    atoms: [
      atom("Ca", 0, 0, 0),
      atom("Ti", 0.5, 0.5, 0.5),
      atom("O", 0.5, 0.5, 0),
      atom("O", 0.5, 0, 0.5),
      atom("O", 0, 0.5, 0.5),
    ],
    bondCutoff: 2.25,
    bondPairs: [["Ti", "O"], ["Ca", "O"]],
    description: "ABO3 钙钛矿中 Ti 位于 O 八面体中心，[TiO6] 八面体共顶连接，Ca 位于立方体角点并为 12 配位。",
  },
  {
    id: "spinel",
    category: "ionic",
    title: "MgAl₂O₄ 尖晶石结构",
    formula: "MgAl₂O₄",
    mpId: "mp-3536",
    mpUrl: "https://next-gen.materialsproject.org/materials/mp-3536",
    spaceGroup: "Fd-3m (227)",
    coordination: "Mg:4 / Al:6",
    lattice: cubic(8.08),
    atoms: spinelMgAl2O4(),
    bondCutoff: 2.35,
    bondPairs: [["Mg", "O"], ["Al", "O"]],
    description: "尖晶石为 AB2O4 型结构，O²⁻ 近似立方密排，Mg²⁺ 和 Al³⁺ 分别占据四面体与八面体间隙。",
  },
  {
    id: "sio4",
    category: "ionic",
    title: "[SiO₄] 硅氧四面体",
    formula: "SiO₄",
    mpId: "本地模型",
    mpUrl: "",
    spaceGroup: "硅酸盐基本单元",
    coordination: "Si:4",
    generator: sio4Model,
    bondCutoff: 2.2,
    showCell: false,
    repeatable: false,
    bondPairs: [["Si", "O"]],
    description: "硅酸盐结构的基本单元为 [SiO4] 四面体，相邻四面体通常共顶连接，不共棱或共面。",
  },
];

export function initTypicalStructuresModule() {
  const els = {
    host: document.querySelector("#structureViewerHost"),
    listAtomic: document.querySelector("#atomicStructureList"),
    listIonic: document.querySelector("#ionicStructureList"),
    repeatButton: document.querySelector("#structureRepeatButton"),
    bondButton: document.querySelector("#structureBondButton"),
    exportButton: document.querySelector("#structureExportButton"),
    atomScale: document.querySelector("#atomScaleRange"),
    title: document.querySelector("#structureTitle"),
    kind: document.querySelector("#structureKind"),
    spaceGroup: document.querySelector("#structureSpaceGroup"),
    coordination: document.querySelector("#structureCoordination"),
    description: document.querySelector("#structureDescription"),
    link: document.querySelector("#structureMpLink"),
    legend: document.querySelector("#structureLegend"),
    viewerTitle: document.querySelector("#structureViewerTitle"),
    viewerMeta: document.querySelector("#structureViewerMeta"),
  };

  if (!els.host) return { refresh: () => {} };

  const state = {
    selectedId: STRUCTURES[0].id,
    filter: "atomic",
    repeat: 2,
    showBonds: true,
    atomScale: 1,
  };

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(structureSceneBackground());

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = document.documentElement.dataset.theme === "dark" ? 1.18 : 1.08;
  els.host.appendChild(renderer.domElement);

  let cameraFrustum = 3.4;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
  camera.up.set(0, 0, 1);
  camera.position.set(5.1, -6.2, 2.6);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.rotateSpeed = 0.68;
  controls.zoomSpeed = 0.82;

  const root = new THREE.Group();
  scene.add(root);

  scene.add(new THREE.HemisphereLight(0xf1f5f9, 0x9ca3af, 1.2));
  const key = new THREE.DirectionalLight(0xe2e8f0, 1.4);
  key.position.set(4, -5, 7);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xcbd5e1, 0.45);
  fill.position.set(-5, 3, 4);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xe2e8f0, 0.35);
  rim.position.set(-3, 5, -2);
  scene.add(rim);

  wireUi();
  renderStructureList();
  drawSelectedStructure(true);
  resize();
  createSceneLoop({ host: els.host, controls, render: () => renderer.render(scene, camera) });

  if ("ResizeObserver" in window) {
    new ResizeObserver(resize).observe(els.host);
  }
  window.addEventListener("resize", resize);
  window.addEventListener("mstool:themechange", () => {
    scene.background.set(structureSceneBackground());
    renderer.toneMappingExposure = document.documentElement.dataset.theme === "dark" ? 1.18 : 1.08;
    drawSelectedStructure(false);
  });

  return {
    refresh() {
      resize();
      controls.update();
    },
  };

  function wireUi() {
    if (els.filterButtons) {
      els.filterButtons.forEach((button) => {
        button.addEventListener("click", () => {
          state.filter = button.dataset.structureFilter;
          els.filterButtons.forEach((item) => item.classList.toggle("is-active", item === button));
          renderStructureList();
        });
      });
    }

    els.select?.addEventListener("change", () => {
      chooseStructure(els.select.value);
    });

    els.repeatButton.addEventListener("click", () => {
      const structure = selectedStructure();
      if (structure.repeatable === false) return;
      state.repeat = state.repeat === 1 ? 2 : 1;
      els.repeatButton.dataset.repeat = String(state.repeat);
      els.repeatButton.textContent = state.repeat === 1 ? "1×1×1" : "2×2×2";
      drawSelectedStructure(true);
    });

    els.bondButton.addEventListener("click", () => {
      state.showBonds = !state.showBonds;
      els.bondButton.classList.toggle("is-active", state.showBonds);
      drawSelectedStructure(false);
    });

    els.exportButton?.addEventListener("click", exportPng);

    els.atomScale.addEventListener("input", () => {
      state.atomScale = Number(els.atomScale.value);
      drawSelectedStructure(false);
    });
  }

  function renderStructureList() {
    const atomicList = STRUCTURES.filter((s) => s.category === "atomic");
    const ionicList = STRUCTURES.filter((s) => s.category === "ionic");

    const renderItems = (items) => items.map((structure) => `
      <button class="structure-list-item${structure.id === state.selectedId ? " is-active" : ""}" type="button" data-structure-id="${structure.id}">
        <span>${structure.title}</span>
      </button>
    `).join("");

    if (els.listAtomic) els.listAtomic.innerHTML = renderItems(atomicList);
    if (els.listIonic) els.listIonic.innerHTML = renderItems(ionicList);

    if (els.select) {
      els.select.innerHTML = STRUCTURES.map((structure) => `
        <option value="${structure.id}">${structure.title}</option>
      `).join("");
      els.select.value = state.selectedId;
    }

    const allButtons = document.querySelectorAll("[data-structure-id]");
    allButtons.forEach((button) => {
      button.addEventListener("click", () => {
        chooseStructure(button.dataset.structureId);
      });
    });

    return false;
  }

  function chooseStructure(structureId) {
    state.selectedId = structureId;
    renderStructureList();
    drawSelectedStructure(true);
  }

  function drawSelectedStructure(resetView) {
    const structure = selectedStructure();
    disposeSceneChildren(root);

    const model = buildStructureModel(structure, structure.repeatable === false ? 1 : state.repeat);
    const atoms = model.atoms;
    const bounds = model.bounds;

    if (structure.showCell !== false && structure.lattice) {
      root.add(makeCellEdges(structure.lattice, state.repeat, bounds.center));
    }
    root.add(makeAtoms(atoms));
    if (state.showBonds) root.add(makeBonds(atoms, structure, model.bonds));

    updateInfo(structure, atoms.length);
    if (resetView) resetCamera(bounds.radius);
  }

  function selectedStructure() {
    return STRUCTURES.find((structure) => structure.id === state.selectedId) || STRUCTURES[0];
  }

  function updateInfo(structure, atomCount) {
    if (els.title) els.title.textContent = structure.title;
    if (els.kind) els.kind.textContent = structure.category === "atomic" ? "原子结构" : "离子结构";
    if (els.spaceGroup) {
      els.spaceGroup.textContent = structure.spaceGroup;
      if (els.spaceGroup.previousElementSibling) {
        els.spaceGroup.previousElementSibling.textContent = structure.repeatable === false ? "结构特征" : "空间群";
      }
    }
    if (els.coordination) els.coordination.textContent = structure.coordination;
    if (els.viewerTitle) els.viewerTitle.textContent = structure.title;
    if (els.viewerMeta) els.viewerMeta.textContent = `${structure.spaceGroup} · 配位 ${structure.coordination}`;
    const repeatText = structure.repeatable === false ? "本地构建结构" : `${state.repeat}×${state.repeat}×${state.repeat} 超胞`;
    if (els.description) els.description.textContent = `${structure.description} 当前显示 ${repeatText}，共 ${atomCount} 个原子/离子。`;
    if (els.link) {
      if (structure.mpUrl) {
        els.link.href = structure.mpUrl;
        els.link.textContent = `打开 Materials Project：${structure.mpId}`;
        els.link.classList.remove("is-hidden");
      } else {
        els.link.href = "#";
        els.link.textContent = "";
        els.link.classList.add("is-hidden");
      }
    }
    els.repeatButton.disabled = structure.repeatable === false;
    els.repeatButton.textContent = structure.repeatable === false ? "本地模型" : state.repeat === 1 ? "1×1×1" : "2×2×2";
    els.repeatButton.dataset.repeat = String(state.repeat);
    els.repeatButton.classList.toggle("is-active", structure.repeatable !== false && state.repeat === 2);
    els.repeatButton.setAttribute("aria-pressed", String(structure.repeatable !== false && state.repeat === 2));

    const sourceAtoms = structure.generator ? structure.generator().atoms : structure.atoms;
    const elements = [...new Set(sourceAtoms.map((site) => site.element))];
    els.legend.innerHTML = elements.map((element) => {
      const color = `#${elementColor(element).toString(16).padStart(6, "0")}`;
      return `<span><i style="background:${color}"></i>${element}</span>`;
    }).join("");
  }

  function resetCamera(radius) {
    cameraFrustum = Math.max(3.35, radius * 2.55);
    const distance = Math.max(8, radius * 5);
    const viewDirection = new THREE.Vector3(0.82, -1, 0.42).normalize().multiplyScalar(distance);
    camera.up.set(0, 0, 1);
    camera.position.copy(viewDirection);
    controls.target.set(0, 0, 0);
    camera.lookAt(controls.target);
    camera.updateProjectionMatrix();
    controls.update();
  }

  function resize() {
    const rect = els.host.getBoundingClientRect();
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
    const aspect = width / height;
    renderer.setSize(width, height, false);
    camera.left = (-cameraFrustum * aspect) / 2;
    camera.right = (cameraFrustum * aspect) / 2;
    camera.top = cameraFrustum / 2;
    camera.bottom = -cameraFrustum / 2;
    camera.updateProjectionMatrix();
  }

  function exportPng() {
    controls.update();
    renderer.render(scene, camera);
    downloadCanvasPngWithWatermark(renderer.domElement, `structure-${state.selectedId}.png`);
  }


  let _stippleTex = null;
  function makeStippleBumpMap() {
    if (_stippleTex) return _stippleTex;
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
    _stippleTex = texture;
    return texture;
  }

  function makeAtoms(sites) {
    const group = new THREE.Group();
    const geometryCache = new Map();
    const materialCache = new Map();

    sites.forEach((site) => {
      const info = ELEMENTS[site.element] || ELEMENTS.C;
      const color = elementColor(site.element);
      const radius = info.radius * state.atomScale;
      const geometryKey = `${site.element}-${radius.toFixed(3)}`;
      if (!geometryCache.has(geometryKey)) geometryCache.set(geometryKey, new THREE.SphereGeometry(radius, 40, 24));
      if (!materialCache.has(site.element)) {
        materialCache.set(site.element, new THREE.MeshPhysicalMaterial({
          color,
          roughness: 0.55,
          metalness: 0.15,
          clearcoat: 0.2,
          clearcoatRoughness: 0.5,
          bumpMap: null,
          bumpScale: 0,
          emissive: color,
          emissiveIntensity: 0.005,
        }));
      }

      const mesh = new THREE.Mesh(geometryCache.get(geometryKey), materialCache.get(site.element));
      mesh.position.copy(site.position);
      group.add(mesh);
    });

    return group;
  }

  function makeBonds(sites, structure, explicitBonds = []) {
    const group = new THREE.Group();
    const material = new THREE.MeshPhysicalMaterial({
      color: 0xb0bec5,
      roughness: 0.38,
      metalness: 0.02,
      transparent: true,
      opacity: 0.72,
    });

    if (explicitBonds.length) {
      explicitBonds.forEach(([a, b]) => {
        group.add(makeCylinderBetween(sites[a].position, sites[b].position, 0.014, material));
      });
      return group;
    }

    for (let i = 0; i < sites.length; i += 1) {
      for (let j = i + 1; j < sites.length; j += 1) {
        if (!isAllowedBond(sites[i].element, sites[j].element, structure.bondPairs)) continue;
        const distance = sites[i].position.distanceTo(sites[j].position);
        if (distance > structure.bondCutoff || distance < 0.1) continue;
        group.add(makeCylinderBetween(sites[i].position, sites[j].position, 0.014, material));
      }
    }

    return group;
  }
}

function buildStructureModel(structure, repeat) {
  if (structure.generator) {
    const generated = structure.generator();
    const atoms = generated.atoms.map((site) => ({
      element: site.element,
      position: site.position.clone(),
      category: structure.category,
    }));
    const bounds = boundsFromAtoms(atoms);
    atoms.forEach((site) => site.position.sub(bounds.center));
    return {
      atoms,
      bonds: generated.bonds || [],
      bounds: { center: new THREE.Vector3(0, 0, 0), radius: bounds.radius },
    };
  }

  const atoms = expandAtoms(structure, repeat);
  const bounds = cellBounds(structure.lattice, repeat);
  atoms.forEach((site) => site.position.sub(bounds.center));
  return { atoms, bonds: [], bounds };
}

function expandAtoms(structure, repeat) {
  const atoms = [];
  for (let i = 0; i < repeat; i += 1) {
    for (let j = 0; j < repeat; j += 1) {
      for (let k = 0; k < repeat; k += 1) {
        structure.atoms.forEach((site) => {
          const frac = new THREE.Vector3(site.frac[0] + i, site.frac[1] + j, site.frac[2] + k);
          atoms.push({
            element: site.element,
            position: fracToCartesian(frac, structure.lattice),
            category: structure.category,
          });
        });
      }
    }
  }
  return atoms;
}

function boundsFromAtoms(atoms) {
  const box = new THREE.Box3().setFromPoints(atoms.map((site) => site.position));
  const center = new THREE.Vector3();
  box.getCenter(center);
  const size = new THREE.Vector3();
  box.getSize(size);
  return { center, radius: Math.max(1.8, size.length() * 0.5) };
}

function isAllowedBond(a, b, pairs) {
  if (!pairs) return true;
  return pairs.some(([first, second]) => (a === first && b === second) || (a === second && b === first));
}

function makeCellEdges(lattice, repeat, center) {
  const corners = [
    [0, 0, 0], [repeat, 0, 0], [repeat, repeat, 0], [0, repeat, 0],
    [0, 0, repeat], [repeat, 0, repeat], [repeat, repeat, repeat], [0, repeat, repeat],
  ].map((frac) => fracToCartesian(new THREE.Vector3(...frac), lattice).sub(center));
  const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const positions = edges.flatMap(([a, b]) => [...corners[a].toArray(), ...corners[b].toArray()]);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color: 0x78909c, transparent: true, opacity: 0.52 }),
  );
}

function cellBounds(lattice, repeat) {
  const corners = [
    [0, 0, 0], [repeat, 0, 0], [repeat, repeat, 0], [0, repeat, 0],
    [0, 0, repeat], [repeat, 0, repeat], [repeat, repeat, repeat], [0, repeat, repeat],
  ].map((frac) => fracToCartesian(new THREE.Vector3(...frac), lattice));
  const box = new THREE.Box3().setFromPoints(corners);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const size = new THREE.Vector3();
  box.getSize(size);
  return { center, radius: size.length() * 0.5 };
}

function makeCylinderBetween(start, end, radius, material) {
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const direction = end.clone().sub(start);
  const geometry = new THREE.CylinderGeometry(radius, radius, direction.length(), 12);
  const cylinder = new THREE.Mesh(geometry, material);
  cylinder.position.copy(midpoint);
  cylinder.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  return cylinder;
}

function fracToCartesian(frac, lattice) {
  return new THREE.Vector3()
    .addScaledVector(lattice[0], frac.x)
    .addScaledVector(lattice[1], frac.y)
    .addScaledVector(lattice[2], frac.z);
}

function atom(element, x, y, z) {
  return { element, frac: [x, y, z] };
}

function cartAtom(element, x, y, z) {
  return { element, position: new THREE.Vector3(x, y, z) };
}

function cubic(a) {
  return [
    new THREE.Vector3(a, 0, 0),
    new THREE.Vector3(0, a, 0),
    new THREE.Vector3(0, 0, a),
  ];
}

function tetragonal(a, c) {
  return [
    new THREE.Vector3(a, 0, 0),
    new THREE.Vector3(0, a, 0),
    new THREE.Vector3(0, 0, c),
  ];
}

function hexagonal(a, c) {
  return [
    new THREE.Vector3(a, 0, 0),
    new THREE.Vector3(-a / 2, (Math.sqrt(3) * a) / 2, 0),
    new THREE.Vector3(0, 0, c),
  ];
}

function fcc(element) {
  return [
    atom(element, 0, 0, 0),
    atom(element, 0, 0.5, 0.5),
    atom(element, 0.5, 0, 0.5),
    atom(element, 0.5, 0.5, 0),
  ];
}

function shiftedFcc(element, x, y, z) {
  return fcc(element).map((site) => atom(
    element,
    (site.frac[0] + x) % 1,
    (site.frac[1] + y) % 1,
    (site.frac[2] + z) % 1,
  ));
}

function diamond(element) {
  return [
    ...fcc(element),
    ...shiftedFcc(element, 0.25, 0.25, 0.25),
  ];
}

function wurtzite(cation, anion) {
  const u = 0.375;
  return [
    atom(cation, 0, 0, 0),
    atom(cation, 2 / 3, 1 / 3, 0.5),
    atom(anion, 0, 0, u),
    atom(anion, 2 / 3, 1 / 3, (0.5 + u) % 1),
  ];
}

function grapheneModel() {
  const bondLength = 1.42;
  const a1 = new THREE.Vector3(Math.sqrt(3) * bondLength, 0, 0);
  const a2 = new THREE.Vector3((Math.sqrt(3) * bondLength) / 2, 1.5 * bondLength, 0);
  const basis = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3((Math.sqrt(3) * bondLength) / 2, bondLength / 2, 0),
  ];
  const atoms = [];
  for (let i = -3; i <= 3; i += 1) {
    for (let j = -3; j <= 3; j += 1) {
      basis.forEach((offset) => {
        const position = a1.clone().multiplyScalar(i).addScaledVector(a2, j).add(offset);
        if (Math.abs(position.x) < 8.2 && Math.abs(position.y) < 6.0) atoms.push(cartAtom("C", position.x, position.y, 0));
      });
    }
  }
  return { atoms, bonds: bondsByDistance(atoms, 1.52) };
}

function graphiteModel() {
  const base = grapheneModel();
  const layerOffset = new THREE.Vector3(1.23, 0.71, 3.35);
  const atoms = [
    ...base.atoms.map((site) => cartAtom("C", site.position.x, site.position.y, -1.675)),
    ...base.atoms.map((site) => cartAtom("C", site.position.x + layerOffset.x, site.position.y + layerOffset.y, 1.675)),
  ];
  return { atoms, bonds: bondsByDistance(atoms, 1.52) };
}

export function nanotubeModel() {
  return {
    atoms: NANOTUBE.positions.map(([x, y, z]) => cartAtom("C", x, y, z)),
    bonds: NANOTUBE.bonds,
  };
}

function fullereneModel() {
  const phi = (1 + Math.sqrt(5)) / 2;
  const vertices = [
    [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
    [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
    [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize());

  const edges = [];
  for (let i = 0; i < vertices.length; i += 1) {
    for (let j = i + 1; j < vertices.length; j += 1) {
      if (vertices[i].distanceTo(vertices[j]) < 1.08) edges.push([i, j]);
    }
  }

  const atoms = [];
  const edgeAtoms = new Map();
  edges.forEach(([a, b]) => {
    const nearA = vertices[a].clone().multiplyScalar(2 / 3).addScaledVector(vertices[b], 1 / 3).normalize().multiplyScalar(2.25);
    const nearB = vertices[a].clone().multiplyScalar(1 / 3).addScaledVector(vertices[b], 2 / 3).normalize().multiplyScalar(2.25);
    const indexA = atoms.push(cartAtom("C", nearA.x, nearA.y, nearA.z)) - 1;
    const indexB = atoms.push(cartAtom("C", nearB.x, nearB.y, nearB.z)) - 1;
    edgeAtoms.set(`${a}-${b}`, [indexA, indexB]);
  });

  const bonds = [];
  edges.forEach(([a, b]) => bonds.push(edgeAtoms.get(`${a}-${b}`)));
  vertices.forEach((vertex, vertexIndex) => {
    const adjacent = edges
      .filter(([a, b]) => a === vertexIndex || b === vertexIndex)
      .map(([a, b]) => {
        const other = a === vertexIndex ? b : a;
        const pair = a < b ? edgeAtoms.get(`${a}-${b}`) : edgeAtoms.get(`${b}-${a}`);
        return { other, atomIndex: a === vertexIndex ? pair[0] : pair[1] };
      });
    const normal = vertex.clone().normalize();
    const basisX = vertices[adjacent[0].other].clone().sub(vertex).projectOnPlane(normal).normalize();
    const basisY = new THREE.Vector3().crossVectors(normal, basisX).normalize();
    adjacent.sort((left, right) => {
      const angleLeft = Math.atan2(
        vertices[left.other].clone().sub(vertex).dot(basisY),
        vertices[left.other].clone().sub(vertex).dot(basisX),
      );
      const angleRight = Math.atan2(
        vertices[right.other].clone().sub(vertex).dot(basisY),
        vertices[right.other].clone().sub(vertex).dot(basisX),
      );
      return angleLeft - angleRight;
    });
    adjacent.forEach((item, index) => {
      bonds.push([item.atomIndex, adjacent[(index + 1) % adjacent.length].atomIndex]);
    });
  });

  return { atoms, bonds };
}

function corundumAl2O3() {
  return [
    atom("Al", 0, 0, 0.352),
    atom("Al", 0, 0, 0.648),
    atom("Al", 1 / 3, 2 / 3, 0.148),
    atom("Al", 2 / 3, 1 / 3, 0.852),
    atom("O", 0.306, 0, 0.25),
    atom("O", 0, 0.306, 0.25),
    atom("O", 0.694, 0.694, 0.25),
    atom("O", 0.694, 0, 0.75),
    atom("O", 0, 0.694, 0.75),
    atom("O", 0.306, 0.306, 0.75),
  ];
}

function spinelMgAl2O4() {
  return [
    atom("Mg", 0.125, 0.125, 0.125),
    atom("Mg", 0.875, 0.875, 0.875),
    atom("Al", 0.5, 0.5, 0.5),
    atom("Al", 0.5, 0, 0),
    atom("Al", 0, 0.5, 0),
    atom("Al", 0, 0, 0.5),
    atom("O", 0.262, 0.262, 0.262),
    atom("O", 0.262, 0.738, 0.738),
    atom("O", 0.738, 0.262, 0.738),
    atom("O", 0.738, 0.738, 0.262),
    atom("O", 0.738, 0.738, 0.738),
    atom("O", 0.738, 0.262, 0.262),
    atom("O", 0.262, 0.738, 0.262),
    atom("O", 0.262, 0.262, 0.738),
  ];
}

function sio4Model() {
  const r = 1.62;
  const vertices = [
    [1, 1, 1],
    [1, -1, -1],
    [-1, 1, -1],
    [-1, -1, 1],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z).normalize().multiplyScalar(r));
  const atoms = [
    cartAtom("Si", 0, 0, 0),
    ...vertices.map((vertex) => cartAtom("O", vertex.x, vertex.y, vertex.z)),
  ];
  return { atoms, bonds: [[0, 1], [0, 2], [0, 3], [0, 4]] };
}

function bondsByDistance(atoms, cutoff) {
  const bonds = [];
  for (let i = 0; i < atoms.length; i += 1) {
    for (let j = i + 1; j < atoms.length; j += 1) {
      if (atoms[i].position.distanceTo(atoms[j].position) <= cutoff) bonds.push([i, j]);
    }
  }
  return bonds;
}

function elementColor(element) {
  const info = ELEMENTS[element] || ELEMENTS.C;
  return document.documentElement.dataset.theme === "dark" ? (info.darkColor ?? info.color) : info.color;
}

function structureSceneBackground() {
  return document.documentElement.dataset.theme === "dark" ? 0x111318 : 0xfafafa;
}
