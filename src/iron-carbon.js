import { downloadSvgPngWithWatermark } from "./export-watermark.js?v=20261008-phase-audit-motion";

const CARBON_MIN = 0;
const CARBON_MAX = 6.69;
const T_MIN = 550;
const T_MAX = 1600;
const EUTECTOID = 0.77;
const ALPHA_EUTECTOID = 0.0218;
const ALPHA_ROOM = 0.008;
const STEEL_MAX = 2.11;
const EUTECTIC = 4.3;
const CEMENTITE = 6.69;

const CHART = {
  width: 1120,
  height: 680,
  left: 86,
  right: 46,
  top: 42,
  bottom: 82,
};
CHART.plotWidth = CHART.width - CHART.left - CHART.right;
CHART.plotHeight = CHART.height - CHART.top - CHART.bottom;
CHART.xAxis = CHART.height - CHART.bottom;

const REGION_DATA = {
  liquid: {
    title: "液相 L",
    phases: "L",
    structure: "均一液态铁碳熔体",
    note: "位于液相线以上，冷却时开始从液体中析出 δ、γ 或 Fe₃C。",
    micro: "liquid",
  },
  liquidDelta: {
    title: "包晶区 (L + δ)",
    phases: "液相 L + 高温铁素体 δ",
    structure: "液相与 δ 固溶体共存（1495℃ 发生包晶反应）",
    note: "靠近纯铁端的高温凝固包晶区（0.09%~0.53% C），1495℃ 发生包晶转变 L + δ → γ。",
    micro: "delta",
  },
  peritectic: {
    title: "包晶区 (δ + γ / 包晶点 1495℃)",
    phases: "高温铁素体 δ + 奥氏体 γ",
    structure: "高温铁素体 δ + 包晶奥氏体 γ",
    note: "1495℃（0.09%~0.53% C）发生包晶转变 L(0.53% C) + δ(0.09% C) → γ(0.17% C)，包晶点成分为 0.17% C。",
    micro: "delta",
  },
  delta: {
    title: "δ 铁素体",
    phases: "δ",
    structure: "单相高温铁素体",
    note: "δ 铁素体最大溶碳量约为 0.09% C，出现在高温纯铁端。",
    micro: "delta",
  },
  liquidAustenite: {
    title: "L + γ",
    phases: "液相 L + 奥氏体 γ",
    structure: "液相与奥氏体共存",
    note: "亚共晶钢液冷却时会在该区间先析出奥氏体。",
    micro: "austeniteLiquid",
  },
  austenite: {
    title: "奥氏体 γ",
    phases: "γ",
    structure: "单相奥氏体",
    note: "奥氏体是碳溶于 γ-Fe 中形成的间隙固溶体，最大溶碳量约为 2.11%。",
    micro: "austenite",
  },
  alphaGamma: {
    title: "α + γ",
    phases: "铁素体 α + 奥氏体 γ",
    structure: "先共析铁素体逐步析出",
    note: "亚共析钢在 A3 线以下进入该区，继续冷却到 727℃ 后剩余 γ 转变为珠光体。",
    micro: "hypoSteel",
  },
  gammaCementite: {
    title: "γ + Fe₃C",
    phases: "奥氏体 γ + 渗碳体 Fe₃C",
    structure: "奥氏体 γ + 二次渗碳体 Fe₃CⅡ",
    note: "过共析钢在 Acm 线以下从奥氏体中析出二次渗碳体 Fe₃CⅡ。",
    micro: "hyperSteel",
  },
  liquidCementite: {
    title: "L + Fe₃C",
    phases: "液相 L + 渗碳体 Fe₃C",
    structure: "液相 L + 一次渗碳体 Fe₃CⅠ",
    note: "过共晶白口铸铁凝固时先析出一次渗碳体 Fe₃CⅠ。",
    micro: "hyperCast",
  },
  ledeburiteHot: {
    title: "亚共晶白口铸铁高温区 (2.11%~4.3% C)",
    phases: "奥氏体 γ + 渗碳体 Fe₃C",
    structure: "奥氏体 γ + 二次渗碳体 Fe₃CⅡ + 莱氏体 Ld",
    note: "2.11% < wC < 4.3%、727~1148℃ 区间，初生奥氏体降温析出二次渗碳体 Fe₃CⅡ，与共晶莱氏体 Ld 共存。",
    micro: "ledeburite",
  },
  hypereutecticHot: {
    title: "过共晶白口铸铁高温区 (4.3%~6.69% C)",
    phases: "奥氏体 γ + 渗碳体 Fe₃C",
    structure: "一次渗碳体 Fe₃CⅠ + 莱氏体 Ld",
    note: "4.3% < wC < 6.69%、727~1148℃ 区间，组织由一次渗碳体 Fe₃CⅠ 与高温共晶莱氏体 Ld 组成。",
    micro: "hyperCast",
  },
  ferrite: {
    title: "铁素体 α",
    phases: "α",
    structure: "单相铁素体或少量三次渗碳体",
    note: "铁素体含碳量很低，室温下小于约 0.008% C，塑性好、硬度低。",
    micro: "ferrite",
  },
  industrialIron: {
    title: "工业纯铁",
    phases: "铁素体 α + 少量渗碳体 Fe₃CⅢ",
    structure: "铁素体 α + 三次渗碳体 Fe₃CⅢ",
    note: "wC < 0.0218%，室温组织以铁素体为主，晶界可能有少量 Fe₃CⅢ。",
    micro: "ferrite",
  },
  hypoeutectoid: {
    title: "亚共析钢",
    phases: "铁素体 α + 渗碳体 Fe₃C",
    structure: "先共析铁素体 + 珠光体 P",
    note: "0.0218% < wC < 0.77%，室温组织为先共析铁素体和珠光体。",
    micro: "hypoSteel",
  },
  eutectoid: {
    title: "共析钢",
    phases: "铁素体 α + 渗碳体 Fe₃C",
    structure: "珠光体 P",
    note: "wC = 0.77%，727℃ 发生共析转变 γ → α + Fe₃C。",
    micro: "pearlite",
  },
  hypereutectoid: {
    title: "过共析钢",
    phases: "铁素体 α + 渗碳体 Fe₃C",
    structure: "珠光体 P + 二次渗碳体 Fe₃CⅡ",
    note: "0.77% < wC < 2.11%，室温组织为珠光体和二次渗碳体。",
    micro: "hyperSteel",
  },
  hypoeutectic: {
    title: "亚共晶白口铸铁",
    phases: "铁素体 α + 渗碳体 Fe₃C",
    structure: "珠光体 P + 二次渗碳体 Fe₃CⅡ + 变态莱氏体 Ld'",
    note: "2.11% < wC < 4.3%，室温组织为珠光体 P + 二次渗碳体 Fe₃CⅡ + 变态莱氏体 Ld'。",
    micro: "hypoCast",
  },
  eutectic: {
    title: "共晶白口铸铁",
    phases: "铁素体 α + 渗碳体 Fe₃C",
    structure: "变态莱氏体 Ld'",
    note: "wC = 4.3%，共晶莱氏体冷却后变为珠光体和共晶渗碳体组成的变态莱氏体 Ld'。",
    micro: "ledeburite",
  },
  hypereutectic: {
    title: "过共晶白口铸铁",
    phases: "铁素体 α + 渗碳体 Fe₃C",
    structure: "一次渗碳体 Fe₃CⅠ + 变态莱氏体 Ld'",
    note: "4.3% < wC < 6.69%，室温组织为一次渗碳体 Fe₃CⅠ + 变态莱氏体 Ld'。",
    micro: "hyperCast",
  },
};

const REGION_SHAPES = [
  { id: "liquid", color: "#dbeafe", points: [[0, 1600], [6.69, 1600], [6.69, 1227], [4.3, 1148], [0.53, 1495], [0, 1538]] },
  { id: "liquidDelta", color: "#bae6fd", points: [[0, 1538], [0.53, 1495], [0.09, 1495]] },
  { id: "delta", color: "#dcfce7", points: [[0, 1538], [0.09, 1495], [0, 1394]] },
  { id: "liquidAustenite", color: "#e0e7ff", points: [[0.53, 1495], [4.3, 1148], [2.11, 1148], [0.17, 1495]] },
  { id: "austenite", color: "#ede9fe", points: [[0, 912], [0, 1394], [0.17, 1495], [2.11, 1148], [0.77, 727]] },
  { id: "peritectic", color: "#93c5fd", points: [[0, 1394], [0.09, 1495], [0.53, 1495], [0.17, 1495]] },
  { id: "alphaGamma", color: "#e6f4ea", points: [[0, 727], [0, 912], [0.77, 727]] },
  { id: "gammaCementite", color: "#ffe4e6", points: [[0.77, 727], [2.11, 1148], [2.11, 727]] },
  { id: "ledeburiteHot", color: "#fef3c7", points: [[2.11, 727], [2.11, 1148], [4.3, 1148], [4.3, 727]] },
  { id: "hypereutecticHot", color: "#fde68a", points: [[4.3, 727], [4.3, 1148], [6.69, 1148], [6.69, 727]] },
  { id: "liquidCementite", color: "#ffedd5", points: [[4.3, 1148], [6.69, 1227], [6.69, 1148]] },
  { id: "industrialIron", color: "#ecfdf5", points: [[0, 550], [0.0218, 550], [0.0218, 727], [0, 727]] },
  { id: "hypoeutectoid", color: "#d1fae5", points: [[0.0218, 550], [0.77, 550], [0.77, 727], [0.0218, 727]] },
  { id: "hypereutectoid", color: "#fae8ff", points: [[0.77, 550], [2.11, 550], [2.11, 727], [0.77, 727]] },
  { id: "hypoeutectic", color: "#fef08a", points: [[2.11, 550], [4.3, 550], [4.3, 727], [2.11, 727]] },
  { id: "hypereutectic", color: "#fed7aa", points: [[4.3, 550], [6.69, 550], [6.69, 727], [4.3, 727]] },
  { id: "eutectoid", color: "#c7d2fe", points: [[0.735, 550], [0.805, 550], [0.805, 727], [0.735, 727]] },
];

const labels = [
  { text: "L", c: 3.2, t: 1440 },
  { text: "δ", c: 0.04, t: 1455 },
  { text: "γ + L", c: 1.35, t: 1320 },
  { text: "γ", c: 0.9, t: 1030 },
  { text: "α + γ", c: 0.32, t: 790 },
  { text: "γ + Fe3C", c: 1.45, t: 920 },
  { text: "Ld′", c: 4.65, t: 635 },
  { text: "P + Fe3CⅡ", c: 1.42, t: 635 },
  { text: "α + P", c: 0.35, t: 635 },
  { text: "Fe3C", c: 6.44, t: 930 },
];

export function initIronCarbonModule() {
  const els = {
    host: document.querySelector("#feChartHost"),
    carbonInput: document.querySelector("#carbonInput"),
    carbonRange: document.querySelector("#carbonRange"),
    carbonReadout: document.querySelector("#carbonReadout"),
    alloyClassReadout: document.querySelector("#alloyClassReadout"),
    mobileRegionReadout: document.querySelector("#feMobileRegionReadout"),
    regionTitle: document.querySelector("#regionTitle"),
    regionPhases: document.querySelector("#regionPhases"),
    regionStructure: document.querySelector("#regionStructure"),
    regionNote: document.querySelector("#regionNote"),
    roomTitle: document.querySelector("#roomTitle"),
    phaseAlphaValue: document.querySelector("#phaseAlphaValue"),
    phaseCementiteValue: document.querySelector("#phaseCementiteValue"),
    phaseAlphaBar: document.querySelector("#phaseAlphaBar"),
    phaseCementiteBar: document.querySelector("#phaseCementiteBar"),
    structureBreakdown: document.querySelector("#structureBreakdown"),
    exportButton: document.querySelector("#feExportButton"),
  };

  if (!els.host) return { refresh: () => {} };

  const state = {
    carbon: EUTECTOID,
    selectedRegionId: null,
    selectedRegion: null,
    dragging: false,
  };

  els.host.innerHTML = renderChartSvg();
  const svg = els.host.querySelector("#feChartSvg");
  const cursorLine = els.host.querySelector("#carbonCursorLine");
  const cursorHandle = els.host.querySelector("#carbonCursorHandle");
  const cursorText = els.host.querySelector("#carbonCursorText");
  const selectedRegionShape = els.host.querySelector("#selectedRegionShape");

  svg.querySelectorAll("[data-carbon-drag]").forEach((node) => {
    node.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      state.dragging = true;
      svg.setPointerCapture?.(event.pointerId);
      setCarbon(carbonFromPointer(event, svg));
    });
  });

  svg.addEventListener("click", (event) => {
    if (event.target.closest("[data-carbon-drag]")) return;
    const trigger = event.target.closest("[data-region-trigger]");
    if (trigger && trigger.dataset.regionTrigger) {
      selectRegion(trigger.dataset.regionTrigger);
      return;
    }
    const point = chartPointFromPointer(event, svg);
    const regionId = regionAtPoint(point.carbon, point.temp);
    if (regionId) selectRegion(regionId);
  });

  svg.addEventListener("pointermove", (event) => {
    if (!state.dragging) return;
    setCarbon(carbonFromPointer(event, svg));
  });

  svg.addEventListener("pointerup", (event) => {
    if (!state.dragging) return;
    state.dragging = false;
    svg.releasePointerCapture?.(event.pointerId);
  });
  svg.addEventListener("pointercancel", () => { state.dragging = false; });
  svg.addEventListener("lostpointercapture", () => { state.dragging = false; });

  els.carbonInput?.addEventListener("input", () => {
    if (els.carbonInput.value.trim() && Number.isFinite(els.carbonInput.valueAsNumber)) {
      setCarbon(els.carbonInput.valueAsNumber, false);
    }
  });
  els.carbonInput?.addEventListener("change", () => setCarbon(els.carbonInput.valueAsNumber));
  els.carbonRange?.addEventListener("input", () => setCarbon(Number(els.carbonRange.value)));
  els.exportButton?.addEventListener("click", exportPng);

  window.addEventListener("mstool:themechange", applyTheme);

  // Initial state: uncolored chart polygons, but populate right-hand info card with sensible default
  syncRegionColors();
  updateRegionInfoPanel("austenite");
  setCarbon(state.carbon);
  applyTheme();

  return {
    refresh() {
      updateCursor();
      applyTheme();
    },
  };

  function selectRegion(regionId) {
    if (!REGION_DATA[regionId]) return;
    state.selectedRegionId = regionId;
    state.selectedRegion = regionId;
    syncRegionColors();
    updateRegionInfoPanel(regionId);
  }

  function syncRegionColors() {
    const activeId = state.selectedRegionId;
    const theme = document.documentElement.dataset.theme || "light";
    const fillOpacity = theme === "dark" ? "0.38" : theme === "gray" ? "0.78" : "0.88";

    els.host.querySelectorAll("[data-region]").forEach((poly) => {
      const shapeId = poly.dataset.region;
      const isSelected = Boolean(activeId && shapeId === activeId);
      const shape = regionShapeById(shapeId);
      poly.classList.toggle("is-selected", isSelected);
      if (isSelected && shape) {
        poly.setAttribute("fill", shape.color);
        poly.setAttribute("fill-opacity", fillOpacity);
        poly.setAttribute("stroke", "none");
        poly.style.fill = shape.color;
        poly.style.fillOpacity = fillOpacity;
        poly.style.stroke = "none";
      } else {
        poly.setAttribute("fill", "transparent");
        poly.setAttribute("fill-opacity", "0");
        poly.setAttribute("stroke", "none");
        poly.style.fill = "transparent";
        poly.style.fillOpacity = "0";
        poly.style.stroke = "none";
      }
    });

    if (selectedRegionShape) {
      const shape = activeId ? regionShapeById(activeId) : null;
      if (shape) {
        selectedRegionShape.setAttribute("points", pointsToString(shape.points));
        selectedRegionShape.setAttribute("fill", shape.color);
        selectedRegionShape.setAttribute("fill-opacity", fillOpacity);
        selectedRegionShape.style.fill = shape.color;
        selectedRegionShape.style.fillOpacity = fillOpacity;
      } else {
        selectedRegionShape.setAttribute("points", "");
        selectedRegionShape.setAttribute("fill", "transparent");
        selectedRegionShape.setAttribute("fill-opacity", "0");
        selectedRegionShape.style.fill = "transparent";
        selectedRegionShape.style.fillOpacity = "0";
        selectedRegionShape.style.stroke = "none";
      }
    }
  }

  function updateRegionInfoPanel(regionId) {
    const region = REGION_DATA[regionId] || REGION_DATA.austenite;
    if (els.regionTitle) els.regionTitle.innerHTML = chemicalMarkup(region.title);
    if (els.mobileRegionReadout) els.mobileRegionReadout.innerHTML = chemicalMarkup(region.title);
    if (els.regionPhases) els.regionPhases.innerHTML = chemicalMarkup(region.phases);
    if (els.regionStructure) els.regionStructure.innerHTML = chemicalMarkup(region.structure);
    if (els.regionNote) els.regionNote.innerHTML = chemicalMarkup(region.note);
  }

  function applyTheme() {
    const theme = document.documentElement.dataset.theme || "light";
    const plotBg = els.host.querySelector(".fe-plot-bg");
    if (plotBg) {
      const bg = theme === "dark" ? "#0f172a" : theme === "gray" ? "#e2e8f0" : "#ffffff";
      plotBg.setAttribute("fill", bg);
      plotBg.style.fill = bg;
    }

    const gridColor = theme === "dark" ? "#1e293b" : theme === "gray" ? "#cbd5e1" : "#e2e8f0";
    els.host.querySelectorAll(".fe-grid line").forEach((line) => {
      line.setAttribute("stroke", gridColor);
      line.style.stroke = gridColor;
    });

    const lineColor = theme === "dark" ? "#e2e8f0" : "#1e293b";
    const criticalColor = theme === "dark" ? "#f87171" : "#dc2626";
    els.host.querySelectorAll(".fe-phase-lines polyline").forEach((pl) => {
      const isCrit = pl.classList.contains("is-critical");
      const c = isCrit ? criticalColor : lineColor;
      pl.setAttribute("stroke", c);
      pl.style.stroke = c;
    });

    const axisStroke = theme === "dark" ? "#94a3b8" : "#334155";
    const axisText = theme === "dark" ? "#cbd5e1" : "#1e293b";
    els.host.querySelectorAll(".fe-axes line").forEach((line) => {
      line.setAttribute("stroke", axisStroke);
      line.style.stroke = axisStroke;
    });
    els.host.querySelectorAll(".fe-axes text").forEach((txt) => {
      txt.setAttribute("fill", axisText);
      txt.style.fill = axisText;
    });

    const labelText = theme === "dark" ? "#f1f5f9" : "#0f172a";
    els.host.querySelectorAll(".fe-chart-labels text").forEach((txt) => {
      txt.setAttribute("fill", labelText);
      txt.style.fill = labelText;
    });

    syncRegionColors();
  }

  function exportPng() {
    downloadSvgPngWithWatermark(svg, `iron-carbon-${formatCarbon(state.carbon)}C.png`);
  }

  function setCarbon(rawValue, syncInput = true) {
    const value = clamp(Number.isFinite(rawValue) ? rawValue : EUTECTOID, CARBON_MIN, CARBON_MAX);
    state.carbon = Math.round(value * 10000) / 10000;
    if (syncInput && els.carbonInput) els.carbonInput.value = String(state.carbon);
    if (els.carbonRange) els.carbonRange.value = String(state.carbon);
    updateCursor();
    updateRoomReadout();
  }

  function updateCursor() {
    if (!cursorLine || !cursorHandle || !cursorText) return;
    const x = sx(state.carbon);
    cursorLine.setAttribute("x1", x);
    cursorLine.setAttribute("x2", x);
    cursorHandle.setAttribute("cx", x);
    cursorText.setAttribute("x", clamp(x, CHART.left + 34, CHART.width - CHART.right - 34));
    cursorText.textContent = `${formatCarbon(state.carbon)}% C`;
  }

  function updateRoomReadout() {
    const room = computeRoomComposition(state.carbon);
    if (els.carbonReadout) els.carbonReadout.textContent = `${formatCarbon(state.carbon)}% C`;
    if (els.alloyClassReadout) els.alloyClassReadout.textContent = room.className;
    if (els.roomTitle) els.roomTitle.textContent = `${room.className} · ${formatCarbon(state.carbon)}% C`;
    if (els.phaseAlphaValue) els.phaseAlphaValue.textContent = formatPercent(room.phase.alpha);
    if (els.phaseCementiteValue) els.phaseCementiteValue.textContent = formatPercent(room.phase.cementite);
    if (els.phaseAlphaBar) els.phaseAlphaBar.style.width = `${room.phase.alpha}%`;
    if (els.phaseCementiteBar) els.phaseCementiteBar.style.width = `${room.phase.cementite}%`;
    const STRUCTURE_COLORS = {
      "珠光体": "#0284c7",
      "二次渗碳体": "#ea580c",
      "变态莱氏体": "#059669",
      "低温莱氏体": "#059669",
      "一次渗碳体": "#dc2626",
      "铁素体": "#2563eb",
      "渗碳体": "#d97706"
    };
    function getStructureColor(name) {
      for (const k in STRUCTURE_COLORS) {
        if (name.includes(k)) return STRUCTURE_COLORS[k];
      }
      return "#6366f1";
    }

    const legendHtml = room.structures.map((item) => {
      const color = getStructureColor(item.name);
      return `
        <span class="fe-legend-item">
          <i class="fe-legend-dot" style="background:${color};"></i>
          <span>${chemicalMarkup(item.name)}</span>:
          <strong>${formatPercent(item.value)}</strong>
        </span>
      `;
    }).join("");

    const segmentsHtml = room.structures.map((item) => {
      const color = getStructureColor(item.name);
      return `<div class="fe-bar-segment" style="width: ${clamp(item.value, 0, 100)}%; background:${color};"></div>`;
    }).join("");

    if (els.structureBreakdown) {
      els.structureBreakdown.innerHTML = `
        <div class="fe-combined-legend" style="margin-bottom:8px;">${legendHtml}</div>
        <div class="fe-combined-bar" aria-label="组织含量分布">${segmentsHtml}</div>
      `;
    }
  }
}

function renderChartSvg() {
  const regionMarkup = REGION_SHAPES.map((shape) => `
    <polygon
      class="fe-region"
      data-region="${shape.id}"
      fill="transparent"
      fill-opacity="0"
      stroke="none"
      style="fill: transparent; fill-opacity: 0; stroke: none;"
      points="${pointsToString(shape.points)}"
    />
  `).join("");

  const xTicks = [0, 0.77, 2.11, 4.3, 6.69];
  const gridXTicks = [0, 0.77, 6.69];
  const yTicks = [600, 727, 912, 1148, 1394, 1495, 1538];

  return `
    <svg id="feChartSvg" class="fe-chart-svg" viewBox="0 0 ${CHART.width} ${CHART.height}" role="img" aria-label="Fe-Fe₃C 铁碳相图">
      <defs>
        <filter id="cursorShadow" x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#263238" flood-opacity="0.22" />
        </filter>
      </defs>

      <rect class="fe-plot-bg" x="${CHART.left}" y="${CHART.top}" width="${CHART.plotWidth}" height="${CHART.plotHeight}" fill="#ffffff" />
      <g class="fe-grid">
        ${gridXTicks.map((tick) => `<line x1="${sx(tick)}" y1="${CHART.top}" x2="${sx(tick)}" y2="${CHART.xAxis}" />`).join("")}
        ${yTicks.map((tick) => `<line x1="${CHART.left}" y1="${sy(tick)}" x2="${CHART.width - CHART.right}" y2="${sy(tick)}" />`).join("")}
      </g>

      <g class="fe-regions">${regionMarkup}</g>
      <polygon id="selectedRegionShape" class="fe-region-selection" fill="transparent" fill-opacity="0" stroke="none" style="fill: transparent; fill-opacity: 0; stroke: none;" points="" />

      <g class="fe-phase-lines">
        ${polyline([[0, 550], [0, 1538]])}
        ${polyline([[0, 1538], [0.53, 1495], [4.3, 1148], [6.69, 1227]])}
        ${polyline([[0, 1538], [0.09, 1495]])}
        ${polyline([[0, 1394], [0.09, 1495]])}
        ${polyline([[0, 1394], [0.17, 1495]])}
        ${polyline([[0.09, 1495], [0.53, 1495]])}
        ${polyline([[0.17, 1495], [2.11, 1148]])}
        ${polyline([[0, 912], [0.0218, 727]])}
        ${polyline([[0, 912], [0.77, 727]])}
        ${polyline([[0.77, 727], [2.11, 1148]])}
        ${polyline([[0.008, 550], [0.0218, 727]])}
        ${polyline([[0, 727], [6.69, 727]], "is-critical")}
        ${polyline([[2.11, 1148], [6.69, 1148]], "is-critical")}
        ${polyline([[6.69, 550], [6.69, 1227]])}
      </g>

      <g class="fe-axes">
        <line x1="${CHART.left}" y1="${CHART.xAxis}" x2="${CHART.width - CHART.right}" y2="${CHART.xAxis}" />
        <line x1="${CHART.left}" y1="${CHART.top}" x2="${CHART.left}" y2="${CHART.xAxis}" />
        ${xTicks.map((tick) => `
          <g>
            <line x1="${sx(tick)}" y1="${CHART.xAxis}" x2="${sx(tick)}" y2="${CHART.xAxis + 8}" />
            <text x="${sx(tick)}" y="${CHART.xAxis + 34}" text-anchor="middle">${formatTick(tick)}</text>
          </g>
        `).join("")}
        ${yTicks.map((tick) => `
          <g>
            <line x1="${CHART.left - 8}" y1="${sy(tick)}" x2="${CHART.left}" y2="${sy(tick)}" />
            <text x="${CHART.left - 14}" y="${sy(tick) + 5}" text-anchor="end">${tick}</text>
          </g>
        `).join("")}
        <text class="fe-axis-title" x="${CHART.left + CHART.plotWidth / 2}" y="${CHART.height - 20}" text-anchor="middle">碳含量 w<tspan baseline-shift="sub" font-size="70%">C</tspan> / %</text>
        <text class="fe-axis-title" x="28" y="${CHART.top + CHART.plotHeight / 2}" text-anchor="middle" transform="rotate(-90 28 ${CHART.top + CHART.plotHeight / 2})">温度 / ℃</text>
      </g>

      <g class="fe-chart-labels">
        ${labels.map((label) => `<text x="${sx(label.c)}" y="${sy(label.t)}">${svgChemicalMarkup(label.text)}</text>`).join("")}
        
        <text x="${sx(0.77)}" y="${sy(727) - 12}" text-anchor="middle">共析点 0.77% / 727℃</text>
        <text x="${sx(4.3)}" y="${sy(1148) - 12}" text-anchor="middle">共晶点 4.3% / 1148℃</text>
        <text x="${sx(2.11)}" y="${sy(1148) + 24}" text-anchor="middle">2.11%</text>
        <text x="${sx(6.69) - 8}" y="${sy(1227) - 12}" text-anchor="end">${svgChemicalMarkup("Fe3C")} 6.69%</text>
      </g>

      <rect data-carbon-drag class="fe-axis-hit" x="${CHART.left}" y="${CHART.xAxis - 18}" width="${CHART.plotWidth}" height="54" />
      <g class="fe-carbon-cursor" data-carbon-drag filter="url(#cursorShadow)">
        <line id="carbonCursorLine" x1="${sx(EUTECTOID)}" y1="${CHART.top}" x2="${sx(EUTECTOID)}" y2="${CHART.xAxis}" />
        <circle id="carbonCursorHandle" cx="${sx(EUTECTOID)}" cy="${CHART.xAxis}" r="12" />
        <text id="carbonCursorText" x="${sx(EUTECTOID)}" y="${CHART.top + 24}" text-anchor="middle">0.77% C</text>
      </g>
    </svg>
  `;
}

export function computeRoomComposition(c) {
  if (!Number.isFinite(c) || c < CARBON_MIN || c > CARBON_MAX) throw new RangeError("Carbon content outside diagram");
  const phaseCementite = c <= ALPHA_ROOM ? 0 : ((c - ALPHA_ROOM) / (CEMENTITE - ALPHA_ROOM)) * 100;
  const phase = {
    cementite: clamp(phaseCementite, 0, 100),
  };
  phase.alpha = 100 - phase.cementite;

  if (c < ALPHA_EUTECTOID) {
    return {
      className: "工业纯铁",
      phase,
      structures: [
        { name: "铁素体 α", value: Math.max(99.7, phase.alpha) },
        { name: "Fe3CⅢ", value: Math.min(0.3, phase.cementite) },
      ],
      micro: "ferrite",
    };
  }

  if (near(c, EUTECTOID)) {
    return {
      className: "共析钢",
      phase,
      structures: [{ name: "珠光体 P", value: 100 }],
      micro: "pearlite",
    };
  }

  if (c < EUTECTOID) {
    const pearlite = ((c - ALPHA_EUTECTOID) / (EUTECTOID - ALPHA_EUTECTOID)) * 100;
    return {
      className: "亚共析钢",
      phase,
      structures: [
        { name: "先共析铁素体", value: 100 - pearlite },
        { name: "珠光体 P", value: pearlite },
      ],
      micro: "hypoSteel",
    };
  }

  if (c < STEEL_MAX) {
    const cementite = ((c - EUTECTOID) / (CEMENTITE - EUTECTOID)) * 100;
    return {
      className: "过共析钢",
      phase,
      structures: [
        { name: "珠光体 P", value: 100 - cementite },
        { name: "二次渗碳体 Fe3CⅡ", value: cementite },
      ],
      micro: "hyperSteel",
    };
  }

  if (near(c, EUTECTIC)) {
    return {
      className: "共晶白口铸铁",
      phase,
      structures: [{ name: "变态莱氏体 Ld′", value: 100 }],
      micro: "ledeburite",
    };
  }

  if (c < EUTECTIC) {
    const ledeburite = ((c - STEEL_MAX) / (EUTECTIC - STEEL_MAX)) * 100;
    const primaryAustenite = 100 - ledeburite;
    const pearliteFromPrimary = primaryAustenite * ((CEMENTITE - STEEL_MAX) / (CEMENTITE - EUTECTOID));
    const secondaryCementite = primaryAustenite - pearliteFromPrimary;
    return {
      className: "亚共晶白口铸铁",
      phase,
      structures: [
        { name: "珠光体 P", value: pearliteFromPrimary },
        { name: "二次渗碳体 Fe3CⅡ", value: secondaryCementite },
        { name: "变态莱氏体 Ld′", value: ledeburite },
      ],
      micro: "hypoCast",
    };
  }

  const primaryCementite = ((c - EUTECTIC) / (CEMENTITE - EUTECTIC)) * 100;
  return {
    className: "过共晶白口铸铁",
    phase,
    structures: [
      { name: "一次渗碳体 Fe3CⅠ", value: primaryCementite },
      { name: "变态莱氏体 Ld′", value: 100 - primaryCementite },
    ],
    micro: "hyperCast",
  };
}

function pointsToString(points) {
  return points.map(([c, t]) => `${sx(c)},${sy(t)}`).join(" ");
}

function polyline(points, className = "") {
  return `<polyline class="${className}" points="${pointsToString(points)}" />`;
}

function sx(carbon) {
  return CHART.left + ((carbon - CARBON_MIN) / (CARBON_MAX - CARBON_MIN)) * CHART.plotWidth;
}

function sy(temp) {
  return CHART.top + ((T_MAX - temp) / (T_MAX - T_MIN)) * CHART.plotHeight;
}

function carbonFromPointer(event, svg) {
  return chartPointFromPointer(event, svg).carbon;
}

function chartPointFromPointer(event, svg) {
  const point = svg.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { carbon: EUTECTOID, temp: 1000 };
  const { x: viewX, y: viewY } = point.matrixTransform(ctm.inverse());
  const carbon = ((viewX - CHART.left) / CHART.plotWidth) * (CARBON_MAX - CARBON_MIN) + CARBON_MIN;
  const temp = T_MAX - ((viewY - CHART.top) / CHART.plotHeight) * (T_MAX - T_MIN);
  return { carbon, temp };
}

function regionAtPoint(carbon, temp) {
  for (let index = REGION_SHAPES.length - 1; index >= 0; index -= 1) {
    const shape = REGION_SHAPES[index];
    if (pointInPolygon([carbon, temp], shape.points)) return shape.id;
  }
  return null;
}

function regionShapeById(regionId) {
  return REGION_SHAPES.find((shape) => shape.id === regionId);
}

function pointInPolygon(point, polygon) {
  const [x, y] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [xi, yi] = polygon[i];
    const [xj, yj] = polygon[j];
    if (pointOnSegment(x, y, xi, yi, xj, yj)) return true;

    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }

  return inside;
}

function pointOnSegment(x, y, x1, y1, x2, y2) {
  const cross = (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1);
  if (Math.abs(cross) > 0.35) return false;

  const dot = (x - x1) * (x2 - x1) + (y - y1) * (y2 - y1);
  if (dot < 0) return false;

  const lengthSquared = (x2 - x1) ** 2 + (y2 - y1) ** 2;
  return dot <= lengthSquared;
}

function near(value, target) {
  return Math.abs(value - target) < 1e-8;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function chemicalMarkup(value) {
  return String(value)
    .replace(/Fe3CⅢ/g, "Fe<sub>3</sub>C<sub>Ⅲ</sub>")
    .replace(/Fe3CⅡ/g, "Fe<sub>3</sub>C<sub>Ⅱ</sub>")
    .replace(/Fe3CⅠ/g, "Fe<sub>3</sub>C<sub>Ⅰ</sub>")
    .replace(/Fe3C/g, "Fe<sub>3</sub>C")
    .replace(/Acm/g, "A<sub>cm</sub>")
    .replace(/A3/g, "A<sub>3</sub>")
    .replace(/wC/g, "w<sub>C</sub>");
}

function svgChemicalMarkup(value) {
  const sub = (text) => `<tspan baseline-shift="sub" font-size="70%">${text}</tspan>`;
  return String(value)
    .replace(/Fe3CⅢ/g, `Fe${sub("3")}C${sub("Ⅲ")}`)
    .replace(/Fe3CⅡ/g, `Fe${sub("3")}C${sub("Ⅱ")}`)
    .replace(/Fe3CⅠ/g, `Fe${sub("3")}C${sub("Ⅰ")}`)
    .replace(/Fe3C/g, `Fe${sub("3")}C`);
}

function formatCarbon(value) {
  return String(Number(value.toFixed(4)));
}

function formatTick(value) {
  return String(value).replace(/\.0$/, "");
}

function formatPercent(value) {
  if (value > 0 && value < 0.1) return "<0.1%";
  return `${clamp(value, 0, 100).toFixed(1).replace(/\.0$/, "")}%`;
}
