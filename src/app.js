let selectModuleRef = null;
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { createSceneLoop, disposeSceneChildren } from "./scene-loop.js?v=20261008-phase-audit-motion";
import { downloadCanvasPngWithWatermark } from "./export-watermark.js?v=20261008-phase-audit-motion";

const PALETTE = {
  cell: 0x263238,
  plane: 0x00897b,
  direction: 0xef6c00,
  blue: 0x0277bd,
  axisC: 0x546e7a,
  yellow: 0xffb300,
  ink: 0x1f2933,
  grid: 0xb0bec5,
  guide: 0x78909c,
};

const EPS = 1e-7;
const HEX_C_RATIO = 1.6;
const ORTHO_FRUSTUM = 3.25;
const APP_VERSION = "20261008-phase-audit-motion";
const VERSION_CHECK_URL = "./version.json";
const VISIT_API_URL = "/api/visit";
const THEME_STORAGE_KEY = "mstool.theme.v1";

const examples = {
  cubic: {
    plane: ["1 1 1", "1 1 0", "2 1 0", "1 -1 0"],
    direction: ["1 0 0", "1 1 0", "1 1 1", "1 -1 0"],
  },
  hex: {
    plane: ["0 0 0 1", "1 0 -1 0", "1 1 -2 0"],
    direction: ["2 -1 -1 0", "1 1 -2 0", "0 0 0 1"],
  },
};

const TRAINING_INDEX_LIMIT = 3;
const TRAINING_RECENT_LIMIT = 18;
const DIRECTION_PLACEMENTS = [
  { startRatio: 0, endRatio: 1 },
];
const trainingQuestions = buildTrainingQuestionBank();

const state = {
  system: "cubic",
  mode: "plane",
  workflow: "draw",
  autoLayer: true,
  currentLayer: 1,
};

const trainingState = {
  question: null,
  number: 0,
  attempts: 0,
  correct: 0,
  streak: 0,
  answered: false,
  recentKeys: [],
};

const els = {
  crystalModule: document.querySelector("#crystalModule"),
  host: document.querySelector("#sceneHost"),
  workflowButtons: document.querySelectorAll("[data-crystal-workflow]"),
  indexSection: document.querySelector(".crystal-module .index-section"),
  indexInput: document.querySelector("#indexInput"),
  drawButton: document.querySelector("#drawButton"),
  exampleChips: document.querySelector("#exampleChips"),
  layerInput: document.querySelector("#layerInput"),
  autoLayerButton: document.querySelector("#autoLayerButton"),
  planeLayerSection: document.querySelector("#planeLayerSection"),
  indexHint: document.querySelector("#indexHint"),
  resetButton: document.querySelector("#resetButton"),
  exportButton: document.querySelector("#exportButton"),
  statusDot: document.querySelector("#statusDot"),
  statusText: document.querySelector("#statusText"),
  metricOneLabel: document.querySelector("#metricOneLabel"),
  metricOneValue: document.querySelector("#metricOneValue"),
  metricTwoLabel: document.querySelector("#metricTwoLabel"),
  metricTwoValue: document.querySelector("#metricTwoValue"),
  metricThreeLabel: document.querySelector("#metricThreeLabel"),
  metricThreeValue: document.querySelector("#metricThreeValue"),
  readoutPanel: document.querySelector(".crystal-module .readout-panel"),
  trainingSection: document.querySelector("#crystalTrainingSection"),
  trainingQuestionNumber: document.querySelector("#trainingQuestionNumber"),
  trainingPrompt: document.querySelector("#trainingPrompt"),
  trainingScoreText: document.querySelector("#trainingScoreText"),
  trainingStreakText: document.querySelector("#trainingStreakText"),
  trainingAnswerInput: document.querySelector("#trainingAnswerInput"),
  trainingSubmitButton: document.querySelector("#trainingSubmitButton"),
  trainingHint: document.querySelector("#trainingHint"),
  trainingCoordinateText: document.querySelector("#trainingCoordinateText"),
  trainingFeedback: document.querySelector("#trainingFeedback"),
  trainingNextButton: document.querySelector("#trainingNextButton"),
  trainingResetButton: document.querySelector("#trainingResetButton"),
  visitOrdinalText: document.querySelector("#visitOrdinalText"),
  themeToggle: document.querySelector("#themeToggle"),
  themeToggleIcon: document.querySelector("#themeToggleIcon"),
  themeColorMeta: document.querySelector("#themeColorMeta"),
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(sceneBackgroundColor());

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
els.host.appendChild(renderer.domElement);

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
camera.up.set(0, 0, 1);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.rotateSpeed = 0.72;
controls.zoomSpeed = 0.85;
controls.panSpeed = 0.45;
controls.enablePan = false;

const root = new THREE.Group();
scene.add(root);

const ambient = new THREE.HemisphereLight(0xffffff, 0xb7c3ca, 1.55);
scene.add(ambient);

const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
keyLight.position.set(3, 4, 5);
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xd8f2ed, 0.8);
fillLight.position.set(-4, -2, 3);
scene.add(fillLight);

const moduleLoaders = {
  stereographic: () => import('./stereographic-projection.js?v=20261008-phase-audit-motion').then(m => m.initStereographicProjectionModule()),
  'iron-carbon': () => import('./iron-carbon.js?v=20261008-phase-audit-motion').then(m => m.initIronCarbonModule()),
  'typical-structures': () => import('./typical-structures.js?v=20261008-phase-audit-motion').then(m => m.initTypicalStructuresModule()),
  interstitial: () => import('./interstitial-lattice.js?v=20261008-phase-audit-motion').then(m => m.initInterstitialLatticeModule()),
  dislocation: () => import('./dislocation-intersection.js?v=20261008-phase-audit-motion').then(m => m.initDislocationIntersectionModule()),
  'ternary-phase': () => import('./ternary-phase.js?v=20261008-phase-audit-motion').then(m => m.initTernaryPhaseModule()),
  home: () => import('./home-overview.js').then(m => m.initHomeOverviewModule((req, push) => selectModuleRef?.(req, push))),
  'binary-phase': () => import('./binary-phase.js').then(m => m.initBinaryPhaseModule()),
  'memory-cards': () => import('./memory-cards.js').then(m => m.initMemoryCardsModule()),
  flashcards: () => import('./flashcards.js').then(m => m.initFlashcardsModule()),
  redemption: () => import('./peripheral-redemption.js?v=20261008-phase-audit-motion').then(m => m.initPeripheralRedemptionModule()),
};
const moduleInstances = new Map();

initTheme();
resetCamera();
resize();
window.addEventListener("resize", resize);

wireModuleNav();
wireUi();
refreshExamples();
updateSections();
updateInputHint();
initVisitCounter();
initExamCountdown();
initVersionChecker();
draw();
createSceneLoop({ host: els.host, controls, render: () => renderer.render(scene, camera) });

function wireModuleNav() {
  const buttons = [...document.querySelectorAll('[data-module]')];
  const panels = [...document.querySelectorAll('[data-module-panel]')];
  document.querySelector('.sidebar-nav, .module-nav')?.setAttribute('role', 'tablist');

  const sidebar = document.querySelector('#appSidebar');
  const mobileBtn = document.querySelector('#mobileMenuBtn');
  const sidebarCloseBtn = document.querySelector('#sidebarCloseBtn');
  const sidebarBackdrop = document.querySelector('#sidebarBackdrop');
  const backToHomeBtn = document.querySelector('#backToHomeBtn');

  function openSidebar() {
    sidebar?.classList.add('is-open');
    sidebarBackdrop?.classList.add('is-active');
  }

  function closeSidebar() {
    sidebar?.classList.remove('is-open');
    sidebarBackdrop?.classList.remove('is-active');
  }

  if (mobileBtn && sidebar) {
    mobileBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (sidebar.classList.contains('is-open')) {
        closeSidebar();
      } else {
        openSidebar();
      }
    });
  }

  sidebarCloseBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    closeSidebar();
  });

  sidebarBackdrop?.addEventListener('click', closeSidebar);

  backToHomeBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    selectModule('home', true);
  });

  buttons.forEach((button, index) => {
    const panel = panels.find(item => item.dataset.modulePanel === button.dataset.module);
    if (!panel) return;
    button.id = `tab-${button.dataset.module}`;
    button.setAttribute('role', 'tab');
    button.setAttribute('aria-controls', panel.id);
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', button.id);
    button.addEventListener('click', () => {
      closeSidebar();
      selectModule(button.dataset.module, true);
    });
    button.addEventListener('keydown', (event) => {
      let next;
      if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = buttons.length - 1;
      if (next === undefined) return;
      event.preventDefault();
      buttons[next].focus();
      selectModule(buttons[next].dataset.module, true);
    });
  });
  selectModuleRef = selectModule;
  window.addEventListener('hashchange', () => selectModule(location.hash.slice(1)));
  selectModule(location.hash.slice(1));

  async function selectModule(requested, push = false) {
    const name = buttons.some(button => button.dataset.module === requested) ? requested : 'home';
    closeSidebar();
    window.scrollTo({ top: 0, behavior: 'instant' });
    document.body.dataset.currentModule = name;

    if (backToHomeBtn) {
      backToHomeBtn.classList.toggle('is-visible', name !== 'home');
    }

    const TITLES = {
      home: { title: '首页导航', desc: '选择模块进入对应工具' },
      'typical-structures': { title: '典型晶体结构', desc: '晶体结构 · 晶胞模型与结构参数' },
      interstitial: { title: '点阵间隙', desc: '晶体结构 · 间隙位置与半径比' },
      crystal: { title: '密勒指数', desc: '晶体学 · 晶面、晶向、镜面绘制与识图训练' },
      'binary-phase': { title: '二元相图', desc: '相图 · 匀晶与共晶相图、杠杆定律计算' },
      'iron-carbon': { title: '铁碳相图', desc: '相图 · Fe-Fe3C 相图与组织计算' },
      'ternary-phase': { title: '三元相图', desc: '相图 · 三元匀晶与三元共晶' },
      stereographic: { title: '极射投影', desc: '投影 · 立方晶系标准投影' },
      dislocation: { title: '位错理论', desc: '晶体缺陷 · 位错交割、割阶与扭折判定' },
      'memory-cards': { title: '记忆卡片', desc: '考研复习 · 核心知识点与公式记忆' },
      flashcards: { title: '考研题库', desc: '考研复习 · 材科基与金属学真题刷题' },
      redemption: { title: '资料交流', desc: '备考资源 · 教材推荐与考研交流' },
    };
    const meta = TITLES[name] || TITLES.home;
    const topTitle = document.querySelector('#topbarTitle');
    const topDesc = document.querySelector('#topbarDesc');
    if (topTitle) topTitle.textContent = meta.title;
    if (topDesc) topDesc.textContent = meta.desc;
    for (const button of buttons) {
      const active = button.dataset.module === name;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
    }
    for (const panel of panels) panel.classList.toggle('is-hidden', panel.dataset.modulePanel !== name);
    if (push && location.hash !== `#${name}`) history.pushState(null, '', `#${name}`);
    if (name === 'crystal') { requestAnimationFrame(resize); return; }
    const panel = panels.find(item => item.dataset.modulePanel === name);
    panel.setAttribute('aria-busy', 'true');
    try {
      if (!moduleInstances.has(name)) moduleInstances.set(name, moduleLoaders[name]());
      const instance = await moduleInstances.get(name);
      if (!panel.classList.contains('is-hidden')) instance.refresh();
      panel.querySelector('.module-load-error')?.remove();
    } catch (error) {
      console.error(`Module ${name} failed`, error);
      moduleInstances.delete(name);
      if (!panel.querySelector('.module-load-error')) {
        const message = document.createElement('p');
        message.className = 'module-load-error';
        message.setAttribute('role', 'alert');
        message.textContent = '加载失败，请刷新页面后重试。';
        panel.prepend(message);
      }
    } finally { panel.removeAttribute('aria-busy'); }
  }
}

function initTheme() {
  applyTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light", false);
  els.themeToggle?.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    applyTheme(nextTheme, true);
  });

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener?.("change", (event) => {
    try {
      if (localStorage.getItem(THEME_STORAGE_KEY)) return;
    } catch {
      // Apply the system preference when storage is unavailable.
    }
    applyTheme(event.matches ? "dark" : "light", false);
  });
}

function applyTheme(theme, persist) {
  const dark = theme === "dark";
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  if (persist) {
    try {
      localStorage.setItem(THEME_STORAGE_KEY, dark ? "dark" : "light");
    } catch {
      // Theme switching still works for the current page without storage.
    }
  }

  if (els.themeToggle) {
    els.themeToggle.setAttribute("aria-pressed", String(dark));
    els.themeToggle.setAttribute("aria-label", dark ? "切换到亮色模式" : "切换到暗色模式");
  }
  if (els.themeToggleIcon) els.themeToggleIcon.textContent = dark ? "☀" : "☾";
  if (els.themeColorMeta) els.themeColorMeta.content = dark ? "#111318" : "#f5f6f8";

  PALETTE.cell = dark ? 0xd7e3ed : 0x263238;
  PALETTE.axisC = dark ? 0xaab8c5 : 0x546e7a;
  PALETTE.grid = dark ? 0x425268 : 0xb0bec5;
  PALETTE.guide = dark ? 0x7f91a3 : 0x78909c;
  scene.background.set(sceneBackgroundColor());
  if (root.children.length) draw();
  window.dispatchEvent(new CustomEvent("mstool:themechange", { detail: { theme: dark ? "dark" : "light" } }));
}

function sceneBackgroundColor() {
  return document.documentElement.dataset.theme === "dark" ? 0x111318 : 0xfafafa;
}

function wireUi() {
  els.workflowButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setCrystalWorkflow(button.dataset.crystalWorkflow, button);
    });
  });

  document.querySelectorAll("[data-system]").forEach((button) => {
    button.addEventListener("click", () => {
      state.system = button.dataset.system;
      state.autoLayer = true;
      activate("[data-system]", button);
      refreshExamples();
      updateSections();
      updateInputHint();
      if (state.workflow === "training") {
        nextTrainingQuestion(true);
      } else {
        setDefaultInput();
        draw(true);
      }
    });
  });

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.mode = button.dataset.mode;
      state.autoLayer = true;
      activate("[data-mode]", button);
      refreshExamples();
      updateSections();
      updateInputHint();
      if (state.workflow === "training") {
        nextTrainingQuestion(false);
      } else {
        setDefaultInput();
        draw();
      }
    });
  });

  els.drawButton.addEventListener("click", () => draw());
  els.indexInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") draw();
  });
  els.indexInput.addEventListener("input", () => {
    state.autoLayer = true;
    scheduleDraw();
  });

  els.trainingSubmitButton?.addEventListener("click", submitTrainingAnswer);
  els.trainingAnswerInput?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") submitTrainingAnswer();
  });
  els.trainingNextButton?.addEventListener("click", () => nextTrainingQuestion(false));
  els.trainingResetButton?.addEventListener("click", resetTrainingScore);

  els.layerInput.addEventListener("input", () => {
    state.autoLayer = false;
    state.currentLayer = Number(els.layerInput.value);
    scheduleDraw();
  });

  els.autoLayerButton.addEventListener("click", () => {
    state.autoLayer = true;
    draw();
  });

  els.resetButton.addEventListener("click", resetCamera);
  els.exportButton.addEventListener("click", exportPng);
}

function activate(selector, activeButton) {
  document.querySelectorAll(selector).forEach((button) => button.classList.remove("is-active"));
  activeButton.classList.add("is-active");
}

function setCrystalWorkflow(workflow, activeButton) {
  if (!["draw", "training"].includes(workflow) || state.workflow === workflow) return;
  state.workflow = workflow;
  activate("[data-crystal-workflow]", activeButton);
  els.workflowButtons.forEach((button) => {
    button.setAttribute("aria-pressed", String(button === activeButton));
  });
  updateSections();

  if (workflow === "training") {
    nextTrainingQuestion(true);
  } else {
    setDefaultInput();
    refreshExamples();
    updateInputHint();
    draw(true);
  }
}

function buildTrainingQuestionBank() {
  return {
    cubic: {
      plane: buildCubicTrainingQuestions(true),
      direction: buildCubicTrainingQuestions(false),
    },
    hex: {
      plane: buildHexTrainingQuestions(true),
      direction: buildHexTrainingQuestions(false),
    },
  };
}

function buildCubicTrainingQuestions(canonicalSign) {
  const questions = new Map();
  for (let x = -TRAINING_INDEX_LIMIT; x <= TRAINING_INDEX_LIMIT; x += 1) {
    for (let y = -TRAINING_INDEX_LIMIT; y <= TRAINING_INDEX_LIMIT; y += 1) {
      for (let z = -TRAINING_INDEX_LIMIT; z <= TRAINING_INDEX_LIMIT; z += 1) {
        const values = [x, y, z];
        if (allZero(values) || values.reduce((sum, value) => sum + Math.abs(value), 0) > 7) continue;
        addTrainingQuestion(questions, values, canonicalSign);
      }
    }
  }
  return [...questions.values()];
}

function buildHexTrainingQuestions(canonicalSign) {
  const questions = new Map();
  for (let first = -TRAINING_INDEX_LIMIT; first <= TRAINING_INDEX_LIMIT; first += 1) {
    for (let second = -TRAINING_INDEX_LIMIT; second <= TRAINING_INDEX_LIMIT; second += 1) {
      const third = -first - second;
      if (Math.abs(third) > TRAINING_INDEX_LIMIT) continue;
      for (let vertical = -TRAINING_INDEX_LIMIT; vertical <= TRAINING_INDEX_LIMIT; vertical += 1) {
        const values = [first, second, third, vertical];
        if (allZero(values) || values.reduce((sum, value) => sum + Math.abs(value), 0) > 9) continue;
        if (!canonicalSign) {
          const [u, v, t, w] = primitiveTrainingIndices(values);
          const axisU = u - t;
          const axisV = v - t;
          const boundaryComponents = [axisU, axisV, axisU - axisV, w];
          if (Math.max(...boundaryComponents.map(Math.abs)) > TRAINING_INDEX_LIMIT) continue;
        }
        addTrainingQuestion(questions, values, canonicalSign);
      }
    }
  }
  return [...questions.values()];
}

function addTrainingQuestion(questions, values, canonicalSign) {
  let reduced = primitiveTrainingIndices(values);
  if (canonicalSign) {
    const firstNonZero = reduced.find((value) => Math.abs(value) > EPS);
    if (firstNonZero < 0) reduced = reduced.map((value) => -value);
  }
  const key = reduced.join(" ");
  questions.set(key, key);
}

function nextTrainingQuestion(resetView = false) {
  if (state.workflow !== "training") return;
  const pool = trainingQuestions[state.system][state.mode];
  const category = `${state.system}:${state.mode}`;
  const recent = new Set(trainingState.recentKeys.slice(-TRAINING_RECENT_LIMIT));
  const candidates = pool.filter((value) => !recent.has(`${category}:${value}`));
  const questionPool = candidates.length ? candidates : pool;
  const value = questionPool[Math.floor(Math.random() * questionPool.length)];
  const placement = state.mode === "direction"
    ? DIRECTION_PLACEMENTS[Math.floor(Math.random() * DIRECTION_PLACEMENTS.length)]
    : null;

  trainingState.question = { value, system: state.system, mode: state.mode, placement };
  trainingState.recentKeys.push(`${category}:${value}`);
  trainingState.recentKeys = trainingState.recentKeys.slice(-TRAINING_RECENT_LIMIT * 4);
  trainingState.number += 1;
  trainingState.answered = false;
  state.autoLayer = true;

  els.trainingAnswerInput.value = "";
  els.trainingAnswerInput.disabled = false;
  els.trainingSubmitButton.disabled = false;
  els.trainingNextButton.textContent = "换一题";
  updateTrainingQuestionText();
  updateTrainingScore();
  setTrainingFeedback("尚未作答", "idle");
  draw(resetView);
}

function updateTrainingQuestionText() {
  const systemName = state.system === "cubic" ? "立方" : "六方";
  const modeName = state.mode === "plane" ? "晶面" : "晶向";
  const symbols = state.system === "cubic"
    ? state.mode === "plane" ? "h k l" : "u v w"
    : state.mode === "plane" ? "h k i l" : "u v t w";
  const example = state.system === "cubic"
    ? state.mode === "plane" ? "1 1 1" : "1 -1 0"
    : state.mode === "plane" ? "1 0 -1 0" : "2 -1 -1 0";
  const poolSize = trainingQuestions[state.system][state.mode].length;

  els.trainingQuestionNumber.textContent = `第 ${trainingState.number} 题 · ${poolSize} 种指数`;
  els.trainingPrompt.textContent = `写出图中${systemName}${modeName}的指数`;
  els.trainingAnswerInput.placeholder = `例如 ${example}`;
  els.trainingHint.textContent = state.mode === "direction"
    ? `按 ${symbols} 顺序输入，分数可写为 1/2`
    : `按 ${symbols} 顺序输入，使用空格分隔`;
  setTrainingCoordinateText(null);
}

function submitTrainingAnswer() {
  if (state.workflow !== "training" || !trainingState.question || trainingState.answered) return;
  const evaluation = evaluateTrainingAnswer(els.trainingAnswerInput.value, trainingState.question);
  if (!evaluation.valid) {
    setTrainingFeedback(evaluation.message, "invalid");
    return;
  }

  trainingState.attempts += 1;
  trainingState.answered = true;
  els.trainingAnswerInput.disabled = true;
  els.trainingSubmitButton.disabled = true;
  els.trainingNextButton.textContent = "下一题";

  const standardAnswer = formatTrainingAnswer(trainingState.question);
  if (evaluation.correct) {
    trainingState.correct += 1;
    trainingState.streak += 1;
    setTrainingFeedback(`回答正确，标准答案 ${standardAnswer}`, "correct");
  } else {
    trainingState.streak = 0;
    setTrainingFeedback(`回答不正确，标准答案 ${standardAnswer}`, "incorrect");
  }
  updateTrainingScore();
}

function evaluateTrainingAnswer(raw, question) {
  const answer = parseIndices(raw, question.system);
  if (!answer.ok) return { valid: false, correct: false, message: "请输入用空格分隔的整数或分数" };
  const expected = parseIndices(question.value, question.system);
  const requiredLength = question.system === "cubic" ? 3 : 4;

  if (answer.numbers.length !== requiredLength) {
    return {
      valid: false,
      correct: false,
      message: question.system === "cubic" ? "立方晶系请输入 3 个指数" : "六方晶系请输入 4 个指数",
    };
  }
  if (question.mode === "plane" && answer.numbers.some((value) => !Number.isInteger(value))) {
    return { valid: false, correct: false, message: "晶面指数应填写整数" };
  }
  if (allZero(answer.numbers)) {
    return { valid: false, correct: false, message: "指数不能全部为 0" };
  }
  if (question.system === "hex" && Math.abs(answer.numbers[0] + answer.numbers[1] + answer.numbers[2]) > EPS) {
    const relation = question.mode === "plane" ? "h + k + i = 0" : "u + v + t = 0";
    return { valid: false, correct: false, message: `六方四指数应满足 ${relation}` };
  }

  let correct;
  if (question.mode === "direction") {
    correct = haveSamePositiveRatio(answer.numbers, expected.numbers);
  } else {
    const normalizedAnswer = primitiveTrainingIndices(answer.numbers);
    const normalizedExpected = primitiveTrainingIndices(expected.numbers);
    correct = normalizedAnswer.length === normalizedExpected.length
      && normalizedAnswer.every((value, index) => value === normalizedExpected[index]);
  }
  return { valid: true, correct, message: "" };
}

function haveSamePositiveRatio(values, expected) {
  let ratio = null;
  for (let index = 0; index < expected.length; index += 1) {
    if (Math.abs(expected[index]) < EPS) {
      if (Math.abs(values[index]) > EPS) return false;
      continue;
    }
    const componentRatio = values[index] / expected[index];
    if (ratio === null) ratio = componentRatio;
    if (Math.abs(componentRatio - ratio) > EPS * Math.max(1, Math.abs(ratio))) return false;
  }
  return ratio !== null && ratio > EPS;
}

function primitiveTrainingIndices(values) {
  const integers = values.map((value) => Math.round(value));
  const divisor = integers.reduce((common, value) => {
    const absolute = Math.abs(value);
    if (!absolute) return common;
    return common ? greatestCommonDivisor(common, absolute) : absolute;
  }, 0) || 1;
  return integers.map((value) => {
    const reduced = value / divisor;
    return Object.is(reduced, -0) ? 0 : reduced;
  });
}

function greatestCommonDivisor(a, b) {
  let left = Math.abs(a);
  let right = Math.abs(b);
  while (right) {
    const remainder = left % right;
    left = right;
    right = remainder;
  }
  return left || 1;
}

function formatTrainingAnswer(question) {
  return question.mode === "plane" ? `(${question.value})` : `[${question.value}]`;
}

function updateTrainingScore() {
  els.trainingScoreText.textContent = `${trainingState.correct} / ${trainingState.attempts}`;
  els.trainingStreakText.textContent = `连对 ${trainingState.streak}`;
}

function setTrainingFeedback(message, status) {
  els.trainingFeedback.textContent = message;
  els.trainingFeedback.dataset.state = status;
}

function resetTrainingScore() {
  trainingState.number = 0;
  trainingState.attempts = 0;
  trainingState.correct = 0;
  trainingState.streak = 0;
  trainingState.question = null;
  trainingState.answered = false;
  trainingState.recentKeys = [];
  updateTrainingScore();
  nextTrainingQuestion(false);
}

function setDefaultInput() {
  els.indexInput.value = examples[state.system][state.mode][0];
}

function refreshExamples() {
  els.exampleChips.replaceChildren();
  examples[state.system][state.mode].forEach((value) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip";
    chip.textContent = state.mode === "plane" ? `(${value})` : `[${value}]`;
    chip.addEventListener("click", () => {
      els.indexInput.value = value;
      state.autoLayer = true;
      draw();
    });
    els.exampleChips.appendChild(chip);
  });
}

async function initVisitCounter() {
  try {
    let total = parseInt(localStorage.getItem('mstool.visitor_count') || '23892', 10);
    if (isNaN(total) || total < 20000) {
      total = 23892 + Math.floor(Math.random() * 40);
    }
    if (!sessionStorage.getItem('mstool.session_active')) {
      total += Math.floor(Math.random() * 3) + 1;
      localStorage.setItem('mstool.visitor_count', total.toString());
      sessionStorage.setItem('mstool.session_active', '1');
    }
    setText(els.visitOrdinalText, `第 ${total.toLocaleString('zh-CN')} 位研友已加入`);
  } catch {
    setText(els.visitOrdinalText, "第 20,000+ 位研友已加入");
  }
}

function initExamCountdown() {
  const daysEl = document.querySelector("#examCountdownDays");
  if (!daysEl) return;
  const now = new Date();
  let target = new Date(now.getFullYear(), 11, 26);
  if (now > target) {
    target = new Date(now.getFullYear() + 1, 11, 26);
  }
  const diffTime = target - now;
  const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  daysEl.textContent = String(diffDays);
}

function initVersionChecker() {
  let checking = false;
  const notice = document.querySelector('#updateNotice');
  const refreshButton = document.querySelector('#applyUpdateButton');
  const check = async () => {
    if (checking || document.hidden) return;
    checking = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    try {
      const versionUrl = `${VERSION_CHECK_URL}?t=${Date.now()}`;
      const response = await fetch(versionUrl, { cache: "no-store", signal: controller.signal });
      if (!response.ok) return;
      const data = await response.json();
      const latestVersion = String(data.version || "");
      if (latestVersion && latestVersion !== APP_VERSION) {
        notice.hidden = false;
        refreshButton.onclick = () => reloadWithoutCache(latestVersion);
      } else {
        notice.hidden = true;
      }
    } catch {
      // A failed version check must not interrupt an active exercise or claim.
    } finally {
      checking = false;
      window.clearTimeout(timeout);
    }
  };

  window.setInterval(check, 300_000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) check();
  });
  window.addEventListener("focus", check);
  check();
}

function reloadWithoutCache(version) {
  const url = new URL(window.location.href);
  url.searchParams.set("v", version);
  window.location.replace(url.toString());
}

function setText(element, text) {
  if (element) element.textContent = text;
}

function toVisitCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
}

function formatInteger(value) {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function formatVisitOrdinal(totalVisits) {
  return totalVisits > 0 ? `你是第 ${formatInteger(totalVisits)} 位访问` : "你是第 -- 位访问";
}

function updateSections() {
  const trainingActive = state.workflow === "training";
  els.crystalModule.classList.toggle("is-training", trainingActive);
  els.trainingSection.classList.toggle("is-hidden", !trainingActive);
  els.indexSection.classList.toggle("is-hidden", trainingActive);
  els.readoutPanel.classList.toggle("is-hidden", trainingActive);
  els.planeLayerSection.classList.toggle("is-hidden", trainingActive || state.mode !== "plane");
}

function updateInputHint() {
  const hints = {
    cubic: {
      plane: "立方晶面：h k l，例如 1 1 1",
      direction: "立方晶向：u v w，例如 1 -1 0",
    },
    hex: {
      plane: "六方晶面：h k i l，例如 1 0 -1 0",
      direction: "六方晶向：u v t w，例如 2 -1 -1 0",
    },
  };
  const placeholders = {
    cubic: {
      plane: "例如 1 1 1",
      direction: "例如 1 -1 0",
    },
    hex: {
      plane: "例如 1 0 -1 0",
      direction: "例如 2 -1 -1 0",
    },
  };
  els.indexHint.textContent = hints[state.system][state.mode];
  els.indexInput.placeholder = placeholders[state.system][state.mode];
}

let drawQueued = false;
function scheduleDraw(resetView = false) {
  if (drawQueued) return;
  drawQueued = true;
  requestAnimationFrame(() => {
    drawQueued = false;
    draw(resetView);
  });
}

function draw(resetView = false) {
  disposeSceneChildren(root);
  const cell = state.system === "cubic" ? createCubicCell() : createHexCell(HEX_C_RATIO);
  drawCell(cell);
  drawBasis(cell);

  const rawIndex = state.workflow === "training" && trainingState.question
    ? trainingState.question.value
    : els.indexInput.value;
  const parsed = parseAndNormalize(rawIndex, state.system, state.mode);
  if (!parsed.ok) {
    setStatus(parsed.message, true);
    setMetrics("对象", "无", "参数", "-", "结果", "-");
    if (resetView) resetCamera();
    return;
  }

  if (state.mode === "plane") {
    drawPlane(cell, parsed);
  } else {
    drawDirection(cell, parsed);
  }

  if (resetView) resetCamera();
}

function createCubicCell() {
  const basis = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, 0, 1),
  ];
  const centerFrac = new THREE.Vector3(0.5, 0.5, 0.5);
  const raw = [
    [0, 0, 0],
    [1, 0, 0],
    [1, 1, 0],
    [0, 1, 0],
    [0, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 1, 1],
  ];
  const vertices = raw.map((frac) => makeVertex(frac, basis, centerFrac));
  vertices.forEach((vertex) => {
    vertex.crystalFrac = vertex.frac.clone();
  });
  return {
    kind: "cubic",
    basis,
    crystalBasis: basis,
    centerFrac,
    center: new THREE.Vector3(0, 0, 0),
    basisOrigin: vertices[0].pos.clone(),
    vertices,
    edges: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [4, 5],
      [5, 6],
      [6, 7],
      [7, 4],
      [0, 4],
      [1, 5],
      [2, 6],
      [3, 7],
    ],
    faces: [
      [0, 1, 2, 3],
      [4, 5, 6, 7],
      [0, 1, 5, 4],
      [1, 2, 6, 5],
      [2, 3, 7, 6],
      [3, 0, 4, 7],
    ],
  };
}

function createHexCell(cRatio) {
  const s3 = Math.sqrt(3);
  const basis = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(-0.5, s3 / 2, 0),
    new THREE.Vector3(0, 0, cRatio),
  ];
  const centerFrac = new THREE.Vector3(0, 0, 0.5);
  const ring = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
  ];
  const raw = [
    ...ring.map(([x, y]) => [x, y, 0]),
    ...ring.map(([x, y]) => [x, y, 1]),
  ];
  const vertices = raw.map((frac) => makeVertex(frac, basis, centerFrac));
  vertices.forEach((vertex) => {
    vertex.crystalFrac = vertex.frac.clone();
  });
  const edges = [];
  for (let i = 0; i < 6; i += 1) {
    edges.push([i, (i + 1) % 6]);
    edges.push([i + 6, ((i + 1) % 6) + 6]);
    edges.push([i, i + 6]);
  }
  const faces = [[0, 1, 2, 3, 4, 5], [6, 7, 8, 9, 10, 11]];
  for (let i = 0; i < 6; i += 1) {
    faces.push([i, (i + 1) % 6, ((i + 1) % 6) + 6, i + 6]);
  }
  return {
    kind: "hex",
    basis,
    crystalBasis: basis,
    centerFrac,
    center: new THREE.Vector3(0, 0, 0),
    basisOrigin: fracToCartesian(new THREE.Vector3(0, 0, -0.5), basis),
    vertices,
    edges,
    faces,
  };
}

function makeVertex(fracArray, basis, centerFrac) {
  const frac = new THREE.Vector3(...fracArray);
  const centeredFrac = frac.clone().sub(centerFrac);
  return {
    frac,
    pos: fracToCartesian(centeredFrac, basis),
  };
}

function fracToCartesian(frac, basis) {
  return new THREE.Vector3()
    .addScaledVector(basis[0], frac.x)
    .addScaledVector(basis[1], frac.y)
    .addScaledVector(basis[2], frac.z);
}

function cellFracToCartesian(cell, frac) {
  return fracToCartesian(frac.clone().sub(cell.centerFrac), cell.basis);
}

function reciprocalBasis(basis) {
  const [a, b, c] = basis;
  const volume = a.dot(new THREE.Vector3().crossVectors(b, c));
  return [
    new THREE.Vector3().crossVectors(b, c).divideScalar(volume),
    new THREE.Vector3().crossVectors(c, a).divideScalar(volume),
    new THREE.Vector3().crossVectors(a, b).divideScalar(volume),
  ];
}

function drawCell(cell) {
  const edgePositions = [];
  cell.edges.forEach(([a, b]) => {
    edgePositions.push(...cell.vertices[a].pos.toArray(), ...cell.vertices[b].pos.toArray());
  });
  const edgeGeometry = new THREE.BufferGeometry();
  edgeGeometry.setAttribute("position", new THREE.Float32BufferAttribute(edgePositions, 3));
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: PALETTE.cell,
    transparent: true,
    opacity: 0.88,
  });
  root.add(new THREE.LineSegments(edgeGeometry, edgeMaterial));

  const pointGeometry = new THREE.SphereGeometry(cell.kind === "hex" ? 0.027 : 0.025, 18, 12);
  const pointMaterial = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.44,
    metalness: 0.02,
    emissive: 0x081014,
    emissiveIntensity: 0.04,
  });
  cell.vertices.forEach((vertex) => {
    const point = new THREE.Mesh(pointGeometry, pointMaterial);
    point.position.copy(vertex.pos);
    root.add(point);
  });

  const grid = makeBasalGrid(cell);
  if (grid) root.add(grid);
}

function makeBasalGrid(cell) {
  const positions = [];
  if (cell.kind === "cubic") {
    for (let i = 0; i <= 4; i += 1) {
      const t = -0.5 + i / 4;
      positions.push(-0.5, t, -0.5, 0.5, t, -0.5);
      positions.push(t, -0.5, -0.5, t, 0.5, -0.5);
    }
  } else {
    const z = -HEX_C_RATIO / 2;
    const basis = cell.basis;
    const points = [
      new THREE.Vector3(1, 0, 0),
      new THREE.Vector3(1, 1, 0),
      new THREE.Vector3(0, 1, 0),
      new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(-1, -1, 0),
      new THREE.Vector3(0, -1, 0),
    ].map((frac) => fracToCartesian(frac, basis).setZ(z));
    for (let i = 0; i < 6; i += 1) {
      positions.push(0, 0, z, ...points[i].toArray());
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.LineSegments(
    geometry,
    new THREE.LineBasicMaterial({ color: PALETTE.grid, transparent: true, opacity: 0.32 }),
  );
}

function drawBasis(cell) {
  const origin = cell.basisOrigin.clone();
  const scale = cell.kind === "hex" ? 0.55 : 0.34;
  const compactHexLabels = cell.kind === "hex" && window.matchMedia("(max-width: 820px)").matches;
  const axisLabelScale = cell.kind === "hex" ? (compactHexLabels ? 0.3 : 0.21) : 0.16;
  const verticalLabelOffset = cell.crystalBasis[0].clone().normalize().multiplyScalar(0.075);
  const axes = [
    { label: "x", color: PALETTE.blue, vector: cell.crystalBasis[0].clone().normalize(), labelOffset: new THREE.Vector3(0, 0, 0.035) },
    { label: "y", color: PALETTE.plane, vector: cell.crystalBasis[1].clone().normalize(), labelOffset: new THREE.Vector3(0, 0, 0.035) },
    { label: "z", color: PALETTE.axisC, vector: cell.crystalBasis[2].clone().normalize(), labelOffset: verticalLabelOffset },
  ];
  const originDot = new THREE.Mesh(
    new THREE.SphereGeometry(0.032, 24, 16),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.34, metalness: 0.02, emissive: 0xe0f2f1, emissiveIntensity: 0.1 }),
  );
  originDot.position.copy(origin);
  root.add(originDot);
  const originLabelPosition = origin.clone().add(new THREE.Vector3(-0.055, -0.055, -0.105));
  root.add(makeTextSprite("O", originLabelPosition, PALETTE.ink));
  axes.forEach((axis) => {
    const arrow = new THREE.ArrowHelper(axis.vector, origin, scale, axis.color, scale * 0.22, scale * 0.08);
    root.add(arrow);
    const labelPosition = origin.clone().addScaledVector(axis.vector, scale * 1.18).add(axis.labelOffset);
    root.add(makeTextSprite(axis.label, labelPosition, axis.color, axisLabelScale));
  });
}

function drawPlane(cell, parsed) {
  const hkl = parsed.components;
  const reciprocal = reciprocalBasis(cell.crystalBasis);
  const normal = new THREE.Vector3()
    .addScaledVector(reciprocal[0], hkl.x)
    .addScaledVector(reciprocal[1], hkl.y)
    .addScaledVector(reciprocal[2], hkl.z);

  if (normal.length() < EPS) {
    setStatus("晶面指数不能全部为 0", true);
    setMetrics("层位", "-", "间距", "-", "顶点", "-");
    return;
  }

  const auto = findBestPlaneLayer(cell, hkl);
  const layer = state.autoLayer ? auto.layer : Number(els.layerInput.value);
  state.currentLayer = Number.isFinite(layer) ? layer : auto.layer;
  els.layerInput.value = state.currentLayer;

  const polygon = intersectPlaneWithCell(cell, hkl, state.currentLayer);
  if (polygon.points.length < 3) {
    setStatus("当前层位没有形成可见晶面", true);
    setMetrics("层位", formatNumber(state.currentLayer), "间距", "-", "顶点", "0");
    return;
  }

  const geometry = new THREE.BufferGeometry();
  const vertices = polygon.points.flatMap((point) => point.toArray());
  const indices = [];
  for (let i = 1; i < polygon.points.length - 1; i += 1) {
    indices.push(0, i, i + 1);
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshPhysicalMaterial({
    color: PALETTE.plane,
    roughness: 0.52,
    metalness: 0.03,
    transparent: true,
    opacity: 0.54,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geometry, material);
  root.add(mesh);

  const outlinePositions = [];
  polygon.points.forEach((point, index) => {
    const next = polygon.points[(index + 1) % polygon.points.length];
    outlinePositions.push(...point.toArray(), ...next.toArray());
  });
  const outlineGeometry = new THREE.BufferGeometry();
  outlineGeometry.setAttribute("position", new THREE.Float32BufferAttribute(outlinePositions, 3));
  root.add(
    new THREE.LineSegments(
      outlineGeometry,
      new THREE.LineBasicMaterial({ color: PALETTE.plane, transparent: true, opacity: 0.95 }),
    ),
  );

  const dSpacing = 1 / normal.length();
  const warning = parsed.warning ? `；${parsed.warning}` : "";
  setStatus(`已绘制晶面 ${parsed.label}${warning}`, false);
  setMetrics(
    "层位",
    formatNumber(state.currentLayer),
    "间距",
    `${formatNumber(dSpacing)} a`,
    "顶点",
    String(polygon.points.length),
  );
}

function drawDirection(cell, parsed) {
  const uvw = parsed.components;
  const vector = fracToCartesian(uvw, cell.crystalBasis);
  if (vector.length() < EPS) {
    setStatus("晶向指数不能全部为 0", true);
    setMetrics("长度", "-", "分量", "-", "结果", "-");
    return;
  }

  let segment = directionSegmentInsideCell(cell, uvw);
  if (!segment) {
    setStatus("未能在晶胞内放置该晶向", true);
    setMetrics("长度", "-", "分量", "-", "结果", "-");
    return;
  }
  if (state.workflow === "training" && trainingState.question?.placement) {
    segment = placeTrainingDirectionSegment(segment, trainingState.question.placement);
  }

  const direction = segment.end.clone().sub(segment.start);
  const length = direction.length();
  const arrow = makeDirectionArrow(segment.start, segment.end, PALETTE.direction);
  liftDirectionObject(arrow);
  root.add(arrow);

  drawDirectionProjectionGuides(cell, segment.start, segment.end, uvw.clone().multiplyScalar(segment.t));

  if (state.workflow === "training") {
    const startMarker = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 20, 14),
      new THREE.MeshStandardMaterial({
        color: PALETTE.direction,
        roughness: 0.38,
        depthTest: false,
        depthWrite: false,
      }),
    );
    startMarker.position.copy(segment.start);
    liftDirectionObject(startMarker);
    root.add(startMarker);
    setTrainingCoordinateText(segment);
  }

  const tipGeometry = new THREE.SphereGeometry(0.019, 24, 16);
  const tipMaterial = new THREE.MeshStandardMaterial({
    color: PALETTE.yellow,
    roughness: 0.38,
    depthTest: false,
    depthWrite: false,
  });
  const tip = new THREE.Mesh(tipGeometry, tipMaterial);
  tip.position.copy(segment.end);
  liftDirectionObject(tip);
  root.add(tip);

  const warning = parsed.warning ? `；${parsed.warning}` : "";
  const translation = segment.translated ? "；已平移到晶胞内" : "";
  setStatus(`已绘制晶向 ${parsed.label}${translation}${warning}`, false);
  setMetrics(
    "长度",
    `${formatNumber(length)} a`,
    "分量",
    vectorToText(parsed.components),
    "起点",
    `(${vectorToText(segment.startFrac)})`,
  );
}

function placeTrainingDirectionSegment(segment, placement) {
  const start = new THREE.Vector3().lerpVectors(segment.start, segment.end, placement.startRatio);
  const end = new THREE.Vector3().lerpVectors(segment.start, segment.end, placement.endRatio);
  const startFrac = new THREE.Vector3().lerpVectors(segment.startFrac, segment.endFrac, placement.startRatio);
  const endFrac = new THREE.Vector3().lerpVectors(segment.startFrac, segment.endFrac, placement.endRatio);
  return {
    ...segment,
    start,
    end,
    startFrac,
    endFrac,
    t: segment.t * (placement.endRatio - placement.startRatio),
    translated: segment.translated || placement.startRatio > EPS,
  };
}

function setTrainingCoordinateText(segment) {
  if (!els.trainingCoordinateText) return;
  if (!segment) {
    els.trainingCoordinateText.textContent = "";
    els.trainingCoordinateText.classList.add("is-hidden");
    return;
  }
  els.trainingCoordinateText.textContent = `端点分数坐标：起点 (${fractionVectorToText(segment.startFrac)})，终点 (${fractionVectorToText(segment.endFrac)})`;
  els.trainingCoordinateText.classList.remove("is-hidden");
}

function liftDirectionObject(object) {
  object.traverse((child) => {
    child.renderOrder = 30;
    const materials = Array.isArray(child.material) ? child.material : [child.material].filter(Boolean);
    materials.forEach((material) => {
      material.depthTest = false;
      material.depthWrite = false;
    });
  });
}

function drawDirectionProjectionGuides(cell, start, endpoint, scaledComponents) {
  const markerGeometry = new THREE.SphereGeometry(0.018, 16, 10);
  const markerMaterial = new THREE.MeshStandardMaterial({
    color: PALETTE.guide,
    roughness: 0.62,
    transparent: true,
    opacity: 0.78,
  });

  ["x", "y", "z"].forEach((key, index) => {
    const component = scaledComponents[key];
    if (Math.abs(component) < EPS) return;
    const projection = start.clone().addScaledVector(cell.crystalBasis[index], component);
    root.add(makeDashedLine([endpoint, projection], PALETTE.guide, 0.62));

    const marker = new THREE.Mesh(markerGeometry, markerMaterial);
    marker.position.copy(projection);
    root.add(marker);
  });
}

function directionSegmentInsideCell(cell, components) {
  if (cell.kind === "cubic") {
    return cubicDirectionSegment(cell, components);
  }

  const startFrac = new THREE.Vector3(0, 0, components.z < -EPS ? 1 : 0);
  const start = cellFracToCartesian(cell, startFrac);
  const direction = fracToCartesian(components, cell.crystalBasis);
  const segment = rayCellEndpoint(cell, start, direction);
  if (!segment) return null;
  return {
    ...segment,
    startFrac,
    endFrac: startFrac.clone().addScaledVector(components, segment.t),
    translated: startFrac.lengthSq() > EPS,
  };
}

function cubicDirectionSegment(cell, components) {
  const startFrac = new THREE.Vector3(
    components.x < -EPS ? 1 : 0,
    components.y < -EPS ? 1 : 0,
    components.z < -EPS ? 1 : 0,
  );
  let scale = Infinity;
  ["x", "y", "z"].forEach((key) => {
    const component = components[key];
    if (component > EPS) {
      scale = Math.min(scale, (1 - startFrac[key]) / component);
    } else if (component < -EPS) {
      scale = Math.min(scale, (0 - startFrac[key]) / component);
    }
  });
  if (!Number.isFinite(scale) || scale < EPS) return null;

  const endFrac = startFrac.clone().addScaledVector(components, scale);
  ["x", "y", "z"].forEach((key) => {
    if (Math.abs(endFrac[key]) < EPS) endFrac[key] = 0;
    if (Math.abs(endFrac[key] - 1) < EPS) endFrac[key] = 1;
  });
  return {
    start: cellFracToCartesian(cell, startFrac),
    end: cellFracToCartesian(cell, endFrac),
    startFrac,
    endFrac,
    t: scale,
    translated: startFrac.lengthSq() > EPS,
  };
}

function rayCellEndpoint(cell, origin, direction) {
  const hits = [];
  cell.faces.forEach((face) => {
    const facePoints = face.map((index) => cell.vertices[index].pos);
    const normal = new THREE.Vector3()
      .crossVectors(
        facePoints[1].clone().sub(facePoints[0]),
        facePoints[2].clone().sub(facePoints[0]),
      )
      .normalize();
    const denominator = normal.dot(direction);
    if (Math.abs(denominator) < EPS) return;

    const t = normal.dot(facePoints[0].clone().sub(origin)) / denominator;
    if (t < EPS) return;

    const point = origin.clone().addScaledVector(direction, t);
    if (pointInPolygon3D(point, facePoints, normal)) {
      hits.push({ point, t });
    }
  });

  const unique = [];
  hits.forEach((hit) => {
    if (!unique.some((existing) => existing.point.distanceToSquared(hit.point) < EPS * EPS * 100)) {
      unique.push(hit);
    }
  });
  if (!unique.length) return null;

  unique.sort((a, b) => b.t - a.t);
  return {
    start: origin,
    end: unique[0].point,
    t: unique[0].t,
  };
}

function makeDashedLine(points, color, opacity) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(points.flatMap((point) => point.toArray()), 3),
  );
  const material = new THREE.LineDashedMaterial({
    color,
    transparent: true,
    opacity,
    dashSize: 0.045,
    gapSize: 0.032,
    depthWrite: false,
  });
  const line = new THREE.Line(geometry, material);
  line.computeLineDistances();
  return line;
}

function makeDirectionArrow(start, end, color) {
  const direction = end.clone().sub(start);
  const length = direction.length();
  const unit = direction.clone().normalize();
  const headLength = Math.min(0.105, Math.max(0.07, length * 0.105));
  const headRadius = Math.min(0.04, Math.max(0.03, length * 0.034));
  const shaftLength = Math.max(EPS, length - headLength);
  const material = new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.34,
    metalness: 0.02,
    clearcoat: 0.42,
    clearcoatRoughness: 0.32,
  });
  const orientation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), unit);
  const group = new THREE.Group();

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, shaftLength, 22), material);
  shaft.position.copy(start).addScaledVector(unit, shaftLength / 2);
  shaft.quaternion.copy(orientation);
  group.add(shaft);

  const head = new THREE.Mesh(new THREE.ConeGeometry(headRadius, headLength, 28), material);
  head.position.copy(start).addScaledVector(unit, shaftLength + headLength / 2);
  head.quaternion.copy(orientation);
  group.add(head);
  return group;
}

function parseAndNormalize(raw, system, mode) {
  const values = parseIndices(raw, system);
  if (!values.ok) return values;

  if (system === "cubic") {
    if (values.numbers.length !== 3) return fail("立方晶系请输入 3 个指数");
    if (allZero(values.numbers)) return fail(mode === "plane" ? "晶面指数不能全部为 0" : "晶向指数不能全部为 0");
    const components = new THREE.Vector3(...values.numbers);
    return {
      ok: true,
      components,
      label: mode === "plane" ? `(${vectorToText(components)})` : `[${vectorToText(components)}]`,
    };
  }

  if (![3, 4].includes(values.numbers.length)) return fail("六方晶系请输入 3 个或 4 个指数");

  if (mode === "plane") {
    let components;
    let warning = "";
    if (values.numbers.length === 4) {
      const [h, k, i, l] = values.numbers;
      components = new THREE.Vector3(h, k, l);
      if (Math.abs(h + k + i) > EPS) warning = "h+k+i 应为 0";
    } else {
      components = new THREE.Vector3(...values.numbers);
    }
    if (components.length() < EPS) return fail("晶面指数不能全部为 0");
    return {
      ok: true,
      components,
      warning,
      label: `(${values.numbers.map(formatSigned).join(" ")})`,
    };
  }

  let components;
  let warning = "";
  if (values.numbers.length === 4) {
    const [u, v, t, w] = values.numbers;
    components = new THREE.Vector3(u - t, v - t, w);
    if (Math.abs(u + v + t) > EPS) warning = "u+v+t 应为 0";
  } else {
    components = new THREE.Vector3(...values.numbers);
  }
  if (components.length() < EPS) return fail("晶向指数不能全部为 0");
  return {
    ok: true,
    components,
    warning,
    label: `[${values.numbers.map(formatSigned).join(" ")}]`,
  };
}

function parseIndices(raw, system) {
  const cleaned = raw
    .replace(/[()[\]{}<>]/g, " ")
    .replace(/[，,；;]/g, " ")
    .replace(/[−–—]/g, "-")
    .trim();
  if (!cleaned) return fail("请输入指数");

  let tokens = cleaned.split(/\s+/).filter(Boolean);
  tokens = expandCompactTokens(tokens, system);
  const numbers = tokens.map(parseIndexToken);
  if (numbers.some((number) => !Number.isFinite(number))) return fail("指数只能包含数字和负号");
  return { ok: true, numbers };
}

function expandCompactTokens(tokens, system) {
  if (tokens.length !== 1 || !/^\d+$/.test(tokens[0])) return tokens;
  const token = tokens[0];
  if (system === "cubic" && token.length === 3) return [...token];
  if (system === "hex" && (token.length === 3 || token.length === 4)) return [...token];
  return tokens;
}

function parseIndexToken(token) {
  let value = token.trim();
  let negative = false;
  if (/^[¯‾]/.test(value)) {
    negative = true;
    value = value.slice(1);
  }
  if (value.includes("\u0305")) {
    negative = true;
    value = value.replace(/\u0305/g, "");
  }
  const fraction = value.match(/^([+-]?\d+)\/([+-]?\d+)$/);
  let number;
  if (fraction) {
    const denominator = Number(fraction[2]);
    number = denominator === 0 ? Number.NaN : Number(fraction[1]) / denominator;
  } else {
    number = Number(value);
  }
  return negative ? -number : number;
}

function fail(message) {
  return { ok: false, message };
}

function allZero(numbers) {
  return numbers.every((number) => Math.abs(number) < EPS);
}

function findBestPlaneLayer(cell, hkl) {
  const scores = cell.vertices.map((vertex) => millerDot(hkl, vertex.crystalFrac));
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const candidates = [];
  for (let layer = Math.ceil(min - EPS); layer <= Math.floor(max + EPS); layer += 1) {
    const polygon = intersectPlaneWithCell(cell, hkl, layer);
    if (polygon.points.length >= 3) {
      candidates.push({ layer, area: polygonArea(polygon.points) });
    }
  }
  if (!candidates.length) return { layer: Math.round((min + max) / 2), area: 0 };

  candidates.sort((a, b) => {
    if (Math.abs(b.area - a.area) > EPS) return b.area - a.area;
    if (a.layer === 1) return -1;
    if (b.layer === 1) return 1;
    if (a.layer === 0) return -1;
    if (b.layer === 0) return 1;
    return Math.abs(a.layer) - Math.abs(b.layer);
  });
  return candidates[0];
}

function intersectPlaneWithCell(cell, hkl, layer) {
  const points = [];
  cell.edges.forEach(([startIndex, endIndex]) => {
    const start = cell.vertices[startIndex];
    const end = cell.vertices[endIndex];
    const s0 = millerDot(hkl, start.crystalFrac) - layer;
    const s1 = millerDot(hkl, end.crystalFrac) - layer;

    if (Math.abs(s0) < EPS && Math.abs(s1) < EPS) {
      addUniquePoint(points, start.pos);
      addUniquePoint(points, end.pos);
      return;
    }
    if (Math.abs(s0) < EPS) {
      addUniquePoint(points, start.pos);
      return;
    }
    if (Math.abs(s1) < EPS) {
      addUniquePoint(points, end.pos);
      return;
    }
    if (s0 * s1 < 0) {
      const t = s0 / (s0 - s1);
      addUniquePoint(points, start.pos.clone().lerp(end.pos, t));
    }
  });

  const reciprocal = reciprocalBasis(cell.crystalBasis);
  const normal = new THREE.Vector3()
    .addScaledVector(reciprocal[0], hkl.x)
    .addScaledVector(reciprocal[1], hkl.y)
    .addScaledVector(reciprocal[2], hkl.z);
  return { points: sortPlanePoints(points, normal), normal };
}

function millerDot(hkl, frac) {
  return hkl.x * frac.x + hkl.y * frac.y + hkl.z * frac.z;
}

function addUniquePoint(points, point) {
  if (!points.some((existing) => existing.distanceToSquared(point) < EPS * EPS * 100)) {
    points.push(point.clone());
  }
}

function sortPlanePoints(points, normal) {
  if (points.length < 3 || normal.length() < EPS) return points;
  const center = points.reduce((sum, point) => sum.add(point), new THREE.Vector3()).divideScalar(points.length);
  const n = normal.clone().normalize();
  const helper = Math.abs(n.y) < 0.86 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const u = new THREE.Vector3().crossVectors(n, helper).normalize();
  const v = new THREE.Vector3().crossVectors(n, u).normalize();
  return [...points].sort((a, b) => {
    const da = a.clone().sub(center);
    const db = b.clone().sub(center);
    return Math.atan2(da.dot(v), da.dot(u)) - Math.atan2(db.dot(v), db.dot(u));
  });
}

function polygonArea(points) {
  if (points.length < 3) return 0;
  const origin = points[0];
  let area = 0;
  for (let i = 1; i < points.length - 1; i += 1) {
    const a = points[i].clone().sub(origin);
    const b = points[i + 1].clone().sub(origin);
    area += new THREE.Vector3().crossVectors(a, b).length() / 2;
  }
  return area;
}

function lineCellSegment(cell, direction) {
  const points = [];
  cell.faces.forEach((face) => {
    const facePoints = face.map((index) => cell.vertices[index].pos);
    const normal = new THREE.Vector3()
      .crossVectors(
        facePoints[1].clone().sub(facePoints[0]),
        facePoints[2].clone().sub(facePoints[0]),
      )
      .normalize();
    const denominator = normal.dot(direction);
    if (Math.abs(denominator) < EPS) return;
    const t = normal.dot(facePoints[0].clone().sub(cell.center)) / denominator;
    const point = cell.center.clone().addScaledVector(direction, t);
    if (pointInPolygon3D(point, facePoints, normal)) {
      points.push({ point, t });
    }
  });

  const unique = [];
  points.forEach((item) => {
    if (!unique.some((existing) => existing.point.distanceToSquared(item.point) < EPS * EPS * 100)) {
      unique.push(item);
    }
  });
  if (unique.length < 2) return null;
  unique.sort((a, b) => a.t - b.t);
  return {
    start: unique[0].point,
    end: unique[unique.length - 1].point,
  };
}

function pointInPolygon3D(point, polygon, normal) {
  const axis = dominantAxis(normal);
  const projectedPoint = projectPoint(point, axis);
  const projectedPolygon = polygon.map((vertex) => projectPoint(vertex, axis));
  return pointInPolygon2D(projectedPoint, projectedPolygon);
}

function dominantAxis(normal) {
  const abs = [Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z)];
  if (abs[0] >= abs[1] && abs[0] >= abs[2]) return "x";
  if (abs[1] >= abs[0] && abs[1] >= abs[2]) return "y";
  return "z";
}

function projectPoint(point, axis) {
  if (axis === "x") return { x: point.y, y: point.z };
  if (axis === "y") return { x: point.x, y: point.z };
  return { x: point.x, y: point.y };
}

function pointInPolygon2D(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    const onEdge =
      Math.abs((point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y)) < EPS &&
      point.x <= Math.max(a.x, b.x) + EPS &&
      point.x >= Math.min(a.x, b.x) - EPS &&
      point.y <= Math.max(a.y, b.y) + EPS &&
      point.y >= Math.min(a.y, b.y) - EPS;
    if (onEdge) return true;
    const intersects = a.y > point.y !== b.y > point.y;
    if (intersects) {
      const x = ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
      if (point.x < x + EPS) inside = !inside;
    }
  }
  return inside;
}

function makeTextSprite(text, position, color, scale = 0.16) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
  ctx.font = "700 58px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 64, 66);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  }));
  sprite.position.copy(position);
  sprite.scale.setScalar(scale);
  sprite.renderOrder = 60;
  return sprite;
}

function setStatus(message, isError) {
  els.statusText.textContent = message;
  els.statusDot.classList.toggle("is-error", isError);
}

function setMetrics(labelOne, valueOne, labelTwo, valueTwo, labelThree, valueThree) {
  els.metricOneLabel.textContent = labelOne;
  els.metricOneValue.textContent = valueOne;
  els.metricTwoLabel.textContent = labelTwo;
  els.metricTwoValue.textContent = valueTwo;
  els.metricThreeLabel.textContent = labelThree;
  els.metricThreeValue.textContent = valueThree;
}

function vectorToText(vector) {
  return [vector.x, vector.y, vector.z].map(formatSigned).join(" ");
}

function fractionVectorToText(vector) {
  return [vector.x, vector.y, vector.z].map(formatFraction).join(", ");
}

function formatFraction(value) {
  if (Math.abs(value) < EPS) return "0";
  if (Number.isInteger(value)) return String(value);
  for (let denominator = 2; denominator <= 15; denominator += 1) {
    const numerator = Math.round(value * denominator);
    if (Math.abs(value - numerator / denominator) < 1e-6) {
      return `${numerator}/${denominator}`;
    }
  }
  return formatNumber(value);
}

function formatSigned(value) {
  if (Math.abs(value) < EPS) return "0";
  if (Number.isInteger(value)) return String(value);
  return formatNumber(value);
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return "-";
  const fixed = Math.abs(value) >= 10 ? value.toFixed(2) : value.toFixed(3);
  return fixed.replace(/\.?0+$/, "");
}

function resize() {
  const rect = els.host.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  const aspect = width / height;
  renderer.setSize(width, height, false);
  camera.left = (-ORTHO_FRUSTUM * aspect) / 2;
  camera.right = (ORTHO_FRUSTUM * aspect) / 2;
  camera.top = ORTHO_FRUSTUM / 2;
  camera.bottom = -ORTHO_FRUSTUM / 2;
  camera.updateProjectionMatrix();
}

function resetCamera() {
  if (state.system === "cubic") {
    camera.up.set(0, 0, 1);
    camera.position.set(2.45, 3.05, 1.9);
  } else {
    camera.up.set(0, 0, 1);
    camera.position.set(2.45, -3.05, 1.9);
  }
  camera.zoom = state.system === "hex" ? 0.92 : 1.38;
  camera.updateProjectionMatrix();
  camera.lookAt(0, 0, 0);
  controls.target.set(0, 0, 0);
  controls.update();
}

function exportPng() {
  renderer.render(scene, camera);
  downloadCanvasPngWithWatermark(renderer.domElement, `crystal-${state.system}-${state.mode}.png`);
}
