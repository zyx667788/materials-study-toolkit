import { downloadSvgPngWithWatermark } from "./export-watermark.js?v=20261008-phase-audit-motion";

export function initBinaryPhaseModule() {
  const root = document.querySelector("#binaryPhaseModule");
  if (!root) return { refresh: () => {} };

  // Systems data
  const SYSTEMS = {
    cuni: {
      name: "Cu-Ni 匀晶相图",
      type: "isomorphous",
      elementA: "Cu",
      elementB: "Ni",
      wMin: 0,
      wMax: 100,
      tMin: 900,
      tMax: 1500,
      defaultW: 40.0,
      defaultT: 1250,
      meltingA: 1083,
      meltingB: 1455,
      // Liquidus & Solidus parameter curves
      liquidus: (w) => 1083 + 2.7 * w + 0.0102 * w * w,
      solidus: (w) => 1083 + 1.8 * w + 0.0192 * w * w,
      // Inverse functions for tie-line composition
      cLiquid: (t) => {
        if (t <= 1083) return 0;
        if (t >= 1455) return 100;
        // Solve 1083 + 2.7w + 0.0102w^2 = t
        const a = 0.0102, b = 2.7, c = 1083 - t;
        const w = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
        return Math.max(0, Math.min(100, w));
      },
      cSolid: (t) => {
        if (t <= 1083) return 0;
        if (t >= 1455) return 100;
        const a = 0.0192, b = 1.8, c = 1083 - t;
        const w = (-b + Math.sqrt(b * b - 4 * a * c)) / (2 * a);
        return Math.max(0, Math.min(100, w));
      }
    },
    pbsn: {
      name: "Pb-Sn 共晶相图",
      type: "eutectic",
      elementA: "Pb",
      elementB: "Sn",
      wMin: 0,
      wMax: 100,
      tMin: 20,
      tMax: 360,
      defaultW: 61.9,
      defaultT: 250,
      meltingA: 327.5,
      meltingB: 232,
      tEutectic: 183,
      wEutectic: 61.9,
      wAlphaMax: 19.2,
      wBetaMax: 97.5,
      wAlphaRoom: 2.0,
      wBetaRoom: 99.0,
    },
    ptag: {
      name: "Pt-Ag 包晶相图",
      type: "peritectic",
      elementA: "Pt",
      elementB: "Ag",
      wMin: 0,
      wMax: 100,
      tMin: 400,
      tMax: 1800,
      defaultW: 71.0,
      defaultT: 1174,
      meltingA: 1769,
      meltingB: 962,
      tPeritectic: 1186,
      wPeritecticL: 66.3,
      wPeritecticAlpha: 10.5,
      wPeritecticBeta: 42.5,
      wBetaMax: 55.0,
      wBetaRoom: 90.0,
    }
  };

  let state = {
    systemKey: "cuni",
    w: 40.0,
    t: 1250,
  };

  const els = {
    tabs: root.querySelectorAll(".bp-sys-tab"),
    wSlider: root.querySelector("#bpCompSlider"),
    tSlider: root.querySelector("#bpTempSlider"),
    wReadout: root.querySelector("#bpCompReadout"),
    tReadout: root.querySelector("#bpTempReadout"),
    wMinLabel: root.querySelector("#bpCompMinLabel"),
    wMaxLabel: root.querySelector("#bpCompMaxLabel"),
    tMinLabel: root.querySelector("#bpTempMinLabel"),
    tMaxLabel: root.querySelector("#bpTempMaxLabel"),
    svg: root.querySelector("#bpSvg"),
    exportBtn: root.querySelector("#bpExportBtn"),
    phaseTitle: root.querySelector("#bpPhaseTitle"),
    phaseBar: root.querySelector("#bpPhaseBar"),
    microTitle: root.querySelector("#bpMicroTitle"),
    microBar: root.querySelector("#bpMicroBar"),
    compCard: root.querySelector("#bpCardComp"),
    stateCard: root.querySelector("#bpCardState"),
    tempCard: root.querySelector("#bpCardTemp"),
  };

  function updateSystem(key) {
    state.systemKey = key;
    const sys = SYSTEMS[key];
    state.w = sys.defaultW;
    state.t = sys.defaultT;

    els.wSlider.min = sys.wMin;
    els.wSlider.max = sys.wMax;
    els.wSlider.step = 0.1;
    els.wSlider.value = state.w;

    els.tSlider.min = sys.tMin;
    els.tSlider.max = sys.tMax;
    els.tSlider.step = 1;
    els.tSlider.value = state.t;

    els.wMinLabel.textContent = sys.elementA;
    els.wMaxLabel.textContent = sys.elementB;
    els.tMinLabel.textContent = `${sys.tMin}℃ (${sys.elementA}熔点)`;
    els.tMaxLabel.textContent = `${sys.tMax}℃ (${sys.elementB}熔点)`;

    els.tabs.forEach(tab => {
      tab.classList.toggle("is-active", tab.dataset.sys === key);
    });

    render();
  }

  function render() {
    const sys = SYSTEMS[state.systemKey];
    const w = parseFloat(state.w);
    const t = parseFloat(state.t);

    els.wReadout.textContent = `${w.toFixed(1)}%${sys.elementB}`;
    els.tReadout.textContent = `${Math.round(t)}℃`;

    if (state.systemKey === "cuni") {
      renderCuNi(w, t, sys);
    } else if (state.systemKey === "pbsn") {
      renderPbSn(w, t, sys);
    } else if (state.systemKey === "ptag") {
      renderPtAg(w, t, sys);
    }
  }

  function renderCuNi(w, t, sys) {
    const TL = sys.liquidus(w);
    const TS = sys.solidus(w);

    let phaseState = "";
    let lPercent = 0, sPercent = 0;
    let cL = 0, cS = 0;

    if (t >= TL) {
      phaseState = "单一液相区 L";
      lPercent = 100;
      sPercent = 0;
      cL = w;
      cS = null;
    } else if (t <= TS) {
      phaseState = "单一固相区 α";
      lPercent = 0;
      sPercent = 100;
      cL = null;
      cS = w;
    } else {
      phaseState = "L + α 两相区 (结晶进行中)";
      cL = sys.cLiquid(t);
      cS = sys.cSolid(t);
      if (cS > cL) {
        lPercent = ((cS - w) / (cS - cL)) * 100;
        sPercent = ((w - cL) / (cS - cL)) * 100;
      }
    }

    lPercent = Math.max(0, Math.min(100, lPercent));
    sPercent = Math.max(0, Math.min(100, sPercent));

    // Update Right Panel
    els.phaseTitle.textContent = `${sys.name} · 相组成`;
    els.phaseBar.innerHTML = `
      <div class="bp-bar-seg" style="width:${lPercent}%;background:#2563eb;">${lPercent > 8 ? `液相 L (${cL ? cL.toFixed(1) : '-'}%Ni) ${lPercent.toFixed(1)}%` : ''}</div>
      <div class="bp-bar-seg" style="width:${sPercent}%;background:#d97706;">${sPercent > 8 ? `固相 α (${cS ? cS.toFixed(1) : '-'}%Ni) ${sPercent.toFixed(1)}%` : ''}</div>
    `;

    els.microTitle.textContent = `组织组成物`;
    els.microBar.innerHTML = `
      <div class="bp-bar-seg" style="width:${sPercent}%;background:#d97706;">${sPercent > 8 ? `α 晶粒 (先结晶) ${sPercent.toFixed(1)}%` : ''}</div>
      <div class="bp-bar-seg" style="width:${lPercent}%;background:#2563eb;">${lPercent > 8 ? `剩余液相 ${lPercent.toFixed(1)}%` : ''}</div>
    `;

    els.compCard.innerHTML = `<span class="bp-meta-label">合金成分</span><strong>${w.toFixed(1)}%Ni</strong>`;
    els.stateCard.innerHTML = `<span class="bp-meta-label">状态</span><strong>${phaseState}</strong>`;
    els.tempCard.innerHTML = `<span class="bp-meta-label">相变温度</span><strong>液 ${Math.round(TL)}℃ / 固 ${Math.round(TS)}℃<br>${cL !== null ? `C_L=${cL.toFixed(1)}%` : ''} ${cS !== null ? `C_S=${cS.toFixed(1)}%` : ''}</strong>`;

    drawDiagramCuNi(w, t, sys, cL, cS, TL, TS);
  }

  function drawDiagramCuNi(w, t, sys, cL, cS, TL, TS) {
    // Map w: [0, 100] -> [70, 670], t: [900, 1500] -> [350, 40]
    const mapX = (val) => 70 + (val / 100) * 600;
    const mapY = (val) => 350 - ((val - 900) / 600) * 310;

    let liquidPath = `M ${mapX(0)} ${mapY(1083)}`;
    let solidPath = `M ${mapX(0)} ${mapY(1083)}`;
    for (let curW = 1; curW <= 100; curW += 2) {
      liquidPath += ` L ${mapX(curW)} ${mapY(sys.liquidus(curW))}`;
      solidPath += ` L ${mapX(curW)} ${mapY(sys.solidus(curW))}`;
    }

    const curX = mapX(w);
    const curY = mapY(t);

    let tieLineSvg = "";
    if (cL !== null && cS !== null && t > TS && t < TL) {
      const lx = mapX(cL);
      const sx = mapX(cS);
      tieLineSvg = `
        <line x1="${lx}" y1="${curY}" x2="${sx}" y2="${curY}" stroke="#10b981" stroke-width="2.5" stroke-dasharray="4 4" />
        <circle cx="${lx}" cy="${curY}" r="4" fill="#2563eb" />
        <circle cx="${sx}" cy="${curY}" r="4" fill="#d97706" />
        <line x1="${lx}" y1="${curY}" x2="${lx}" y2="350" stroke="#94a3b8" stroke-dasharray="3 3" />
        <line x1="${sx}" y1="${curY}" x2="${sx}" y2="350" stroke="#94a3b8" stroke-dasharray="3 3" />
      `;
    }

    els.svg.innerHTML = `
      <defs>
        <pattern id="bpGrid" width="60" height="31" patternUnits="userSpaceOnUse">
          <path d="M 60 0 L 0 0 0 31" fill="none" stroke="#f1f5f9" stroke-width="1"/>
        </pattern>
      </defs>
      <rect x="70" y="40" width="600" height="310" fill="url(#bpGrid)" stroke="#cbd5e1" />
      
      <!-- Axis Lines -->
      <line x1="70" y1="350" x2="670" y2="350" stroke="#475569" stroke-width="2"/>
      <line x1="70" y1="40" x2="70" y2="350" stroke="#475569" stroke-width="2"/>
      <line x1="670" y1="40" x2="670" y2="350" stroke="#475569" stroke-width="2"/>

      <!-- Phase curves -->
      <path d="${liquidPath}" fill="none" stroke="#2563eb" stroke-width="3"/>
      <path d="${solidPath}" fill="none" stroke="#dc2626" stroke-width="3"/>

      <!-- Labels inside diagram -->
      <text x="350" y="110" font-size="14" fill="#2563eb" font-weight="bold" text-anchor="middle">L 液相</text>
      <text x="350" y="240" font-size="13" fill="#047857" font-weight="bold" text-anchor="middle">L + α</text>
      <text x="490" y="310" font-size="14" fill="#dc2626" font-weight="bold" text-anchor="middle">α 固溶体</text>
      <text x="75" y="${mapY(1083) + 16}" font-size="11" fill="#475569">Cu 1083℃</text>
      <text x="665" y="${mapY(1455) - 6}" font-size="11" fill="#475569" text-anchor="end">Ni 1455℃</text>

      <!-- Tie line -->
      ${tieLineSvg}

      <!-- Current Point -->
      <line x1="${curX}" y1="40" x2="${curX}" y2="350" stroke="#10b981" stroke-width="1.5" stroke-dasharray="4 4"/>
      <line x1="70" y1="${curY}" x2="670" y2="${curY}" stroke="#10b981" stroke-width="1.5" stroke-dasharray="4 4"/>
      <circle cx="${curX}" cy="${curY}" r="6" fill="#10b981" stroke="#ffffff" stroke-width="2"/>
      <rect x="${Math.min(540, Math.max(75, curX - 60))}" y="${curY > 80 ? curY - 24 : curY + 10}" width="128" height="20" rx="4" class="bp-svg-badge-bg" fill="#ffffff" fill-opacity="0.92" stroke="#10b981" stroke-width="1"/>
      <text x="${Math.min(540, Math.max(75, curX - 60)) + 64}" y="${curY > 80 ? curY - 10 : curY + 24}" font-size="11" fill="#065f46" font-weight="bold" text-anchor="middle">${w.toFixed(1)}%Ni / ${Math.round(t)}℃</text>

      <!-- Axes Tick Labels -->
      <text x="70" y="370" font-size="12" fill="#64748b" text-anchor="middle">0 (Cu)</text>
      <text x="220" y="370" font-size="12" fill="#64748b" text-anchor="middle">25</text>
      <text x="370" y="370" font-size="12" fill="#64748b" text-anchor="middle">50</text>
      <text x="520" y="370" font-size="12" fill="#64748b" text-anchor="middle">75</text>
      <text x="670" y="370" font-size="12" fill="#64748b" text-anchor="middle">100 (Ni)</text>
      <text x="370" y="405" font-size="13" fill="#334155" font-weight="bold" text-anchor="middle">成分 w(Ni) / %</text>

      <text x="60" y="354" font-size="11" fill="#64748b" text-anchor="end">900</text>
      <text x="60" y="250" font-size="11" fill="#64748b" text-anchor="end">1100</text>
      <text x="60" y="146" font-size="11" fill="#64748b" text-anchor="end">1300</text>
      <text x="60" y="44" font-size="11" fill="#64748b" text-anchor="end">1500</text>
      <text x="45" y="25" font-size="13" fill="#334155" font-weight="bold">T / ℃</text>
    `;
  }

  function renderPbSn(w, t, sys) {
    // Eutectic Pb-Sn logic
    const mapX = (val) => 70 + (val / 100) * 600;
    const mapY = (val) => 350 - ((val - 20) / 340) * 310;

    let phaseState = "";
    let lPercent = 0, alphaPercent = 0, betaPercent = 0;
    let microSegments = [];

    const tL_left = 327.5 - ((327.5 - 183) / 61.9) * w;
    const tL_right = 183 + ((232 - 183) / (100 - 61.9)) * (w - 61.9);

    if (t >= sys.tEutectic) {
      if (w < sys.wEutectic) {
        if (t >= tL_left) {
          phaseState = "单一液相区 L";
          lPercent = 100;
          microSegments = [{ label: "液相熔体 L", percent: 100, color: "#2563eb" }];
        } else {
          phaseState = "L + α 两相区 (初生 α 结晶中)";
          const cL = Math.min(61.9, Math.max(0, (327.5 - t) * (61.9 / (327.5 - 183))));
          const cS = Math.min(19.2, Math.max(0, (327.5 - t) * (19.2 / (327.5 - 183))));
          if (cL > cS) {
            lPercent = Math.max(0, Math.min(100, ((w - cS) / (cL - cS)) * 100));
            alphaPercent = 100 - lPercent;
          } else {
            lPercent = 50; alphaPercent = 50;
          }
          microSegments = [
            { label: "初生 α 晶粒", percent: alphaPercent, color: "#d97706" },
            { label: "高温剩余液相 L", percent: lPercent, color: "#2563eb" }
          ];
        }
      } else {
        if (t >= tL_right) {
          phaseState = "单一液相区 L";
          lPercent = 100;
          microSegments = [{ label: "液相熔体 L", percent: 100, color: "#2563eb" }];
        } else {
          phaseState = "L + β 两相区 (初生 β 结晶中)";
          const cL = Math.max(61.9, Math.min(100, 61.9 + (t - 183) * ((100 - 61.9) / (232 - 183))));
          const cS = Math.max(97.5, Math.min(100, 97.5 + (t - 183) * ((100 - 97.5) / (232 - 183))));
          if (cS > cL) {
            lPercent = Math.max(0, Math.min(100, ((cS - w) / (cS - cL)) * 100));
            betaPercent = 100 - lPercent;
          } else {
            lPercent = 50; betaPercent = 50;
          }
          microSegments = [
            { label: "高温剩余液相 L", percent: lPercent, color: "#2563eb" },
            { label: "初生 β 晶粒", percent: betaPercent, color: "#7c3aed" }
          ];
        }
      }
    } else {
      // 室温/低于183℃固相区
      if (w <= 19.2) {
        alphaPercent = 100;
        betaPercent = 0;
        phaseState = "单一 α 固溶体区";
        microSegments = [{ label: "α 晶粒", percent: 100, color: "#d97706" }];
      } else if (w >= 97.5) {
        alphaPercent = 0;
        betaPercent = 100;
        phaseState = "单一 β 固溶体区";
        microSegments = [{ label: "β 晶粒", percent: 100, color: "#7c3aed" }];
      } else {
        alphaPercent = Math.max(0, Math.min(100, ((97.5 - w) / (97.5 - 19.2)) * 100));
        betaPercent = 100 - alphaPercent;

        if (Math.abs(w - 61.9) < 0.2) {
          phaseState = "共晶合金 (全部为共晶体)";
          microSegments = [{ label: "共晶体 (α+β)E", percent: 100, color: "#ec4899" }];
        } else if (w < 61.9) {
          phaseState = "亚共晶合金 (先共晶 α + 共晶体)";
          const alphaPro = Math.max(0, Math.min(100, ((61.9 - w) / (61.9 - 19.2)) * 100));
          const eutectic = 100 - alphaPro;
          microSegments = [
            { label: "初生 α 晶粒", percent: alphaPro, color: "#d97706" },
            { label: "共晶体 (α+β)E", percent: eutectic, color: "#ec4899" }
          ];
        } else {
          phaseState = "过共晶合金 (初生 β + 共晶体)";
          const betaPro = Math.max(0, Math.min(100, ((w - 61.9) / (97.5 - 61.9)) * 100));
          const eutectic = 100 - betaPro;
          microSegments = [
            { label: "共晶体 (α+β)E", percent: eutectic, color: "#ec4899" },
            { label: "初生 β 晶粒", percent: betaPro, color: "#7c3aed" }
          ];
        }
      }
    }

    alphaPercent = Math.max(0, Math.min(100, alphaPercent));
    betaPercent = Math.max(0, Math.min(100, betaPercent));
    lPercent = Math.max(0, Math.min(100, lPercent));

    els.phaseTitle.textContent = `${sys.name} · 相组成`;
    els.phaseBar.innerHTML = `
      ${lPercent > 0 ? `<div class="bp-bar-seg" style="width:${lPercent.toFixed(1)}%;background:#2563eb;">${lPercent > 8 ? `液相 L ${lPercent.toFixed(1)}%` : ''}</div>` : ''}
      ${alphaPercent > 0 ? `<div class="bp-bar-seg" style="width:${alphaPercent.toFixed(1)}%;background:#d97706;">${alphaPercent > 8 ? `α 相 ${alphaPercent.toFixed(1)}%` : ''}</div>` : ''}
      ${betaPercent > 0 ? `<div class="bp-bar-seg" style="width:${betaPercent.toFixed(1)}%;background:#7c3aed;">${betaPercent > 8 ? `β 相 ${betaPercent.toFixed(1)}%` : ''}</div>` : ''}
    `;

    els.microTitle.textContent = `组织组成物`;
    els.microBar.innerHTML = microSegments
      .filter((seg) => seg.percent > 0)
      .map((seg) => `
        <div class="bp-bar-seg" style="width:${seg.percent.toFixed(1)}%;background:${seg.color};">
          ${seg.percent > 8 ? `${seg.label} ${seg.percent.toFixed(1)}%` : ''}
        </div>
      `).join("");

    els.compCard.innerHTML = `<span class="bp-meta-label">合金成分</span><strong>${w.toFixed(1)}%Sn</strong>`;
    els.stateCard.innerHTML = `<span class="bp-meta-label">状态</span><strong>${phaseState}</strong>`;
    els.tempCard.innerHTML = `<span class="bp-meta-label">特征温度</span><strong>共晶线 183℃<br>共晶成分 61.9%Sn</strong>`;

    const curX = mapX(w);
    const curY = mapY(t);

    els.svg.innerHTML = `
      <defs>
        <pattern id="bpGrid2" width="60" height="31" patternUnits="userSpaceOnUse">
          <path d="M 60 0 L 0 0 0 31" fill="none" stroke="#f1f5f9" stroke-width="1"/>
        </pattern>
      </defs>
      <rect x="70" y="40" width="600" height="310" fill="url(#bpGrid2)" stroke="#cbd5e1" />
      
      <!-- Liquidus & Solvus -->
      <line x1="${mapX(0)}" y1="${mapY(327.5)}" x2="${mapX(61.9)}" y2="${mapY(183)}" stroke="#2563eb" stroke-width="3"/>
      <line x1="${mapX(61.9)}" y1="${mapY(183)}" x2="${mapX(100)}" y2="${mapY(232)}" stroke="#2563eb" stroke-width="3"/>
      
      <!-- Eutectic Line -->
      <line x1="${mapX(19.2)}" y1="${mapY(183)}" x2="${mapX(97.5)}" y2="${mapY(183)}" stroke="#dc2626" stroke-width="2.5" stroke-dasharray="4 2"/>
      
      <!-- Solidus -->
      <line x1="${mapX(0)}" y1="${mapY(327.5)}" x2="${mapX(19.2)}" y2="${mapY(183)}" stroke="#d97706" stroke-width="2.5"/>
      <line x1="${mapX(100)}" y1="${mapY(232)}" x2="${mapX(97.5)}" y2="${mapY(183)}" stroke="#d97706" stroke-width="2.5"/>
      <line x1="${mapX(19.2)}" y1="${mapY(183)}" x2="${mapX(2)}" y2="${mapY(20)}" stroke="#d97706" stroke-width="2"/>
      <line x1="${mapX(97.5)}" y1="${mapY(183)}" x2="${mapX(99)}" y2="${mapY(20)}" stroke="#d97706" stroke-width="2"/>

      <text x="350" y="100" font-size="14" fill="#2563eb" font-weight="bold" text-anchor="middle">L 液相</text>
      <text x="${mapX(61.9)}" y="${mapY(183) + 20}" font-size="11" fill="#dc2626" font-weight="bold" text-anchor="middle">E: 183℃ 共晶线 (61.9% Sn)</text>
      <text x="120" y="320" font-size="13" fill="#d97706" font-weight="bold">α</text>
      <text x="640" y="320" font-size="13" fill="#7c3aed" font-weight="bold">β</text>
      <text x="370" y="300" font-size="14" fill="#475569" font-weight="bold" text-anchor="middle">α + β</text>

      <!-- Current Point -->
      <line x1="${curX}" y1="40" x2="${curX}" y2="350" stroke="#10b981" stroke-width="1.5" stroke-dasharray="4 4"/>
      <line x1="70" y1="${curY}" x2="670" y2="${curY}" stroke="#10b981" stroke-width="1.5" stroke-dasharray="4 4"/>
      <circle cx="${curX}" cy="${curY}" r="6" fill="#10b981" stroke="#ffffff" stroke-width="2"/>
      <rect x="${Math.min(540, Math.max(75, curX - 60))}" y="${curY > 80 ? curY - 24 : curY + 10}" width="128" height="20" rx="4" class="bp-svg-badge-bg" fill="#ffffff" fill-opacity="0.92" stroke="#10b981" stroke-width="1"/>
      <text x="${Math.min(540, Math.max(75, curX - 60)) + 64}" y="${curY > 80 ? curY - 10 : curY + 24}" font-size="11" fill="#065f46" font-weight="bold" text-anchor="middle">${w.toFixed(1)}%Sn / ${Math.round(t)}℃</text>

      <!-- Labels -->
      <text x="70" y="370" font-size="12" fill="#64748b" text-anchor="middle">0 (Pb)</text>
      <text x="${mapX(19.2)}" y="370" font-size="11" fill="#64748b" text-anchor="middle">19.2</text>
      <text x="${mapX(61.9)}" y="370" font-size="11" fill="#64748b" text-anchor="middle">61.9</text>
      <line x1="${mapX(97.5)}" y1="350" x2="${mapX(97.5)}" y2="382" stroke="#94a3b8" stroke-width="1" stroke-dasharray="2 2"/>
      <text x="${mapX(97.5)}" y="394" font-size="10" fill="#64748b" text-anchor="middle">97.5</text>
      <text x="670" y="370" font-size="12" fill="#64748b" text-anchor="middle">100 (Sn)</text>
      <text x="370" y="405" font-size="13" fill="#334155" font-weight="bold" text-anchor="middle">成分 w(Sn) / %</text>
    `;
  }

  function renderPtAg(w, t, sys) {
    // Peritectic Pt-Ag logic
    const mapX = (val) => 70 + (val / 100) * 600;
    const mapY = (val) => 350 - ((val - 400) / 1400) * 310;

    let phaseState = "";
    if (t >= sys.tPeritectic) {
      phaseState = "高温单/两相区 (L 或 L+α)";
    } else {
      phaseState = "包晶反应完成及固溶体转变区";
    }

    els.phaseTitle.textContent = `${sys.name} · 相组成`;
    els.phaseBar.innerHTML = `
      <div class="bp-bar-seg" style="width:60%;background:#2563eb;">包晶相 β (42.5%Ag) 60%</div>
      <div class="bp-bar-seg" style="width:40%;background:#d97706;">剩余 α (10.5%Ag) 40%</div>
    `;

    els.microTitle.textContent = `组织组成物 (400-1800℃)`;
    els.microBar.innerHTML = `
      <div class="bp-bar-seg" style="width:100%;background:#2563eb;">实测温度下组织动态平衡 100%</div>
    `;

    els.compCard.innerHTML = `<span class="bp-meta-label">合金成分</span><strong>${w.toFixed(1)}%Ag</strong>`;
    els.stateCard.innerHTML = `<span class="bp-meta-label">状态</span><strong>${phaseState}</strong>`;
    els.tempCard.innerHTML = `<span class="bp-meta-label">包晶特征</span><strong>包晶线 1186℃<br>L(66.3%) + α(10.5%) → β(42.5%)</strong>`;

    const curX = mapX(w);
    const curY = mapY(t);

    els.svg.innerHTML = `
      <defs>
        <pattern id="bpGrid3" width="60" height="31" patternUnits="userSpaceOnUse">
          <path d="M 60 0 L 0 0 0 31" fill="none" stroke="#f1f5f9" stroke-width="1"/>
        </pattern>
      </defs>
      <rect x="70" y="40" width="600" height="310" fill="url(#bpGrid3)" stroke="#cbd5e1" />
      
      <!-- Liquidus -->
      <line x1="${mapX(0)}" y1="${mapY(1769)}" x2="${mapX(66.3)}" y2="${mapY(1186)}" stroke="#2563eb" stroke-width="3"/>
      <line x1="${mapX(66.3)}" y1="${mapY(1186)}" x2="${mapX(100)}" y2="${mapY(962)}" stroke="#2563eb" stroke-width="3"/>
      
      <!-- Peritectic Line at 1186 -->
      <line x1="${mapX(10.5)}" y1="${mapY(1186)}" x2="${mapX(66.3)}" y2="${mapY(1186)}" stroke="#dc2626" stroke-width="2.5"/>
      <circle cx="${mapX(42.5)}" cy="${mapY(1186)}" r="4" fill="#dc2626" />
      <rect x="${mapX(42.5) - 130}" y="${mapY(1186) - 22}" width="260" height="18" rx="4" class="bp-svg-badge-bg" fill="#ffffff" fill-opacity="0.92" stroke="#dc2626" stroke-width="0.75"/>
      <text x="${mapX(42.5)}" y="${mapY(1186) - 9}" font-size="11" fill="#dc2626" font-weight="bold" text-anchor="middle">包晶线 1186℃: L(66.3%) + α(10.5%) → β(42.5%)</text>

      <!-- Solidus & Solvus -->
      <line x1="${mapX(0)}" y1="${mapY(1769)}" x2="${mapX(10.5)}" y2="${mapY(1186)}" stroke="#d97706" stroke-width="2.5"/>
      <line x1="${mapX(10.5)}" y1="${mapY(1186)}" x2="${mapX(2)}" y2="${mapY(400)}" stroke="#d97706" stroke-width="2"/>
      <line x1="${mapX(42.5)}" y1="${mapY(1186)}" x2="${mapX(100)}" y2="${mapY(962)}" stroke="#7c3aed" stroke-width="2.5"/>

      <text x="350" y="90" font-size="14" fill="#2563eb" font-weight="bold" text-anchor="middle">L 液相</text>
      <text x="300" y="190" font-size="13" fill="#047857" font-weight="bold">L + α</text>
      <text x="350" y="270" font-size="14" fill="#475569" font-weight="bold" text-anchor="middle">α + β</text>
      <text x="120" y="320" font-size="13" fill="#d97706" font-weight="bold">α</text>
      <text x="620" y="320" font-size="13" fill="#7c3aed" font-weight="bold">β</text>

      <!-- Current Point -->
      <line x1="${curX}" y1="40" x2="${curX}" y2="350" stroke="#10b981" stroke-width="1.5" stroke-dasharray="4 4"/>
      <line x1="70" y1="${curY}" x2="670" y2="${curY}" stroke="#10b981" stroke-width="1.5" stroke-dasharray="4 4"/>
      <circle cx="${curX}" cy="${curY}" r="6" fill="#10b981" stroke="#ffffff" stroke-width="2"/>
      <rect x="${Math.min(540, Math.max(75, curX - 60))}" y="${curY > 80 ? curY - 24 : curY + 10}" width="128" height="20" rx="4" class="bp-svg-badge-bg" fill="#ffffff" fill-opacity="0.92" stroke="#10b981" stroke-width="1"/>
      <text x="${Math.min(540, Math.max(75, curX - 60)) + 64}" y="${curY > 80 ? curY - 10 : curY + 24}" font-size="11" fill="#065f46" font-weight="bold" text-anchor="middle">${w.toFixed(1)}%Ag / ${Math.round(t)}℃</text>

      <!-- Labels -->
      <text x="70" y="370" font-size="12" fill="#64748b" text-anchor="middle">0 (Pt)</text>
      <text x="${mapX(10.5)}" y="370" font-size="11" fill="#64748b" text-anchor="middle">10.5</text>
      <text x="${mapX(42.5)}" y="370" font-size="11" fill="#64748b" text-anchor="middle">42.5</text>
      <text x="${mapX(66.3)}" y="370" font-size="11" fill="#64748b" text-anchor="middle">66.3</text>
      <text x="670" y="370" font-size="12" fill="#64748b" text-anchor="middle">100 (Ag)</text>
      <text x="370" y="405" font-size="13" fill="#334155" font-weight="bold" text-anchor="middle">成分 w(Ag) / %</text>
    `;
  }

  // Event Listeners
  els.tabs.forEach(tab => {
    tab.addEventListener("click", () => updateSystem(tab.dataset.sys));
  });

  els.wSlider.addEventListener("input", e => {
    state.w = parseFloat(e.target.value);
    render();
  });

  els.tSlider.addEventListener("input", e => {
    state.t = parseFloat(e.target.value);
    render();
  });

  els.exportBtn?.addEventListener("click", () => {
    downloadSvgPngWithWatermark(els.svg, `${SYSTEMS[state.systemKey].name}.png`);
  });

  updateSystem("cuni");

  return {
    refresh() {
      render();
    }
  };
}
