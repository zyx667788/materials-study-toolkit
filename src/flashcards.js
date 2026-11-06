export async function initFlashcardsModule() {
  const root = document.querySelector("#flashcardsModule");
  if (!root) return { refresh: () => {} };

  const STORAGE_KEY = "mstool.flashcards.v1";
  let questionsData = {
    caikeji: [],
    metallurgy: []
  };

  let state = {
    subject: "all", // 'all'
    currentChapter: "全部",
    currentType: "全部",
    filterStatus: "all", // 'all' | 'unanswered' | 'weak' | 'favorite'
    query: "",
    random: false,
    currentIndex: 0,
    answerRevealed: false,
    selectedOption: null,
    progress: {}, // id: { answered: boolean, userChoice: string, isCorrect: boolean, favorite: boolean, weak: boolean }
  };

  // Load progress
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (saved && typeof saved === "object") {
      state.progress = saved.progress || {};
      if (saved.subject) state.subject = saved.subject;
    }
  } catch (e) {
    console.warn("Failed to load flashcard progress", e);
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        subject: state.subject,
        progress: state.progress
      }));
    } catch (e) {}
  }

  function parseChapterNum(ch) {
    if (!ch) return 9999;
    const m = String(ch).match(/第([一二三四五六七八九十百零\d]+)章/);
    if (!m) return 9999;
    const s = m[1];
    if (/^\d+$/.test(s)) return parseInt(s, 10);
    const map = { 零: 0, 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
    if (s === "十") return 10;
    if (s.startsWith("十")) return 10 + (map[s[1]] || 0);
    if (s.endsWith("十")) return (map[s[0]] || 1) * 10;
    if (s.includes("十")) {
      const [tens, ones] = s.split("十");
      return (map[tens] || 1) * 10 + (map[ones] || 0);
    }
    return map[s] ?? 9999;
  }

  // Fisher-Yates shuffle
  function shuffleArray(arr) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  // Group questions by chapter (preserving textbook chapter order) and shuffle within each chapter
  function groupAndShuffleByChapter(...lists) {
    const chapterMap = new Map();
    const chapterMeta = new Map();
    lists.forEach((list, sourceIdx) => {
      if (!Array.isArray(list)) return;
      for (const q of list) {
        if (!q) continue;
        const ch = q.chapter || "未分类章节";
        if (!chapterMap.has(ch)) {
          chapterMap.set(ch, []);
          chapterMeta.set(ch, {
            sourceIdx,
            orderIdx: chapterMeta.size,
            chapterNum: parseChapterNum(ch)
          });
        }
        chapterMap.get(ch).push(q);
      }
    });

    const sortedChapters = Array.from(chapterMap.keys()).sort((a, b) => {
      const metaA = chapterMeta.get(a);
      const metaB = chapterMeta.get(b);
      if (metaA.sourceIdx !== metaB.sourceIdx) return metaA.sourceIdx - metaB.sourceIdx;
      if (metaA.chapterNum !== metaB.chapterNum) return metaA.chapterNum - metaB.chapterNum;
      return metaA.orderIdx - metaB.orderIdx;
    });

    const result = [];
    for (const ch of sortedChapters) {
      result.push(...shuffleArray(chapterMap.get(ch)));
    }
    return result;
  }

  // Fetch JSON files
  async function loadData() {
    try {
      if (questionsData.caikeji.length === 0) {
        const [res1, res2] = await Promise.all([
          fetch("data/caikeji_questions.json").then(r => r.json()).catch(() => []),
          fetch("data/metallurgy_questions.json").then(r => r.json()).catch(() => [])
        ]);
        const list1 = Array.isArray(res1) ? res1 : [];
        const list2 = Array.isArray(res2) ? res2 : [];
        const fallback = typeof window !== "undefined" && Array.isArray(window.CARDS_DATA) ? window.CARDS_DATA : [];
        questionsData.caikeji = list1.length || list2.length
          ? groupAndShuffleByChapter(list1, list2)
          : groupAndShuffleByChapter(fallback);
        questionsData.metallurgy = [];
      }
    } catch (e) {
      console.error("Failed to load questions data", e);
    }
  }

  await loadData();

  // Ensure #fcChapterSelect exists in DOM right before #fcTypeSelect in .fc-controls-row
  let chSelectEl = root.querySelector("#fcChapterSelect");
  if (!chSelectEl) {
    chSelectEl = document.createElement("select");
    chSelectEl.id = "fcChapterSelect";
    chSelectEl.className = "fc-select";
    chSelectEl.setAttribute("aria-label", "章节筛选");
    const typeSelectEl = root.querySelector("#fcTypeSelect");
    const controlsRow = root.querySelector(".fc-controls-row") || typeSelectEl?.parentElement;
    if (controlsRow && typeSelectEl && typeSelectEl.parentElement === controlsRow) {
      controlsRow.insertBefore(chSelectEl, typeSelectEl);
    } else if (typeSelectEl && typeSelectEl.parentElement) {
      typeSelectEl.parentElement.insertBefore(chSelectEl, typeSelectEl);
    } else if (controlsRow) {
      controlsRow.prepend(chSelectEl);
    }
  }

  function getCurrentBank() {
    return [...questionsData.caikeji, ...questionsData.metallurgy];
  }

  function getChapters() {
    const bank = getCurrentBank();
    const set = new Set(bank.map(q => q.chapter).filter(Boolean));
    const sorted = Array.from(set).sort((a, b) => parseChapterNum(a) - parseChapterNum(b));
    return ["全部", ...sorted];
  }

  function getTypes() {
    const bank = getCurrentBank();
    const set = new Set(bank.map(q => q.type).filter(Boolean));
    return ["全部", ...Array.from(set)];
  }

  function getFilteredList() {
    const bank = getCurrentBank();
    const q = state.query.trim().toLowerCase();
    let list = bank.filter(item => {
      const p = state.progress[item.id] || {};
      const matchChapter = state.currentChapter === "全部" || item.chapter === state.currentChapter;
      const matchType = state.currentType === "全部" || item.type === state.currentType;
      const matchQuery = !q || (item.question + " " + (item.answer || "") + " " + (item.analysis || "")).toLowerCase().includes(q);
      
      let matchStatus = true;
      if (state.filterStatus === "unanswered") matchStatus = !p.answered;
      else if (state.filterStatus === "weak") matchStatus = !!p.weak;
      else if (state.filterStatus === "favorite") matchStatus = !!p.favorite;
      return matchChapter && matchType && matchQuery && matchStatus;
    });

    if (state.random) {
      // Keep consistent pseudo-random by sorting or shuffling
    }
    return list;
  }

  function formatMath(text) {
    if (!text) return "";
    let str = "";
    if (typeof text === "object") {
      str = text.mathText || text.text || text.value || text.label || "";
    } else {
      str = String(text);
    }
    if (window.katex) {
      // Replace $$...$$
      str = str.replace(/\$\$([^$]+)\$\$/g, (_, expr) => {
        try { return window.katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false }); }
        catch { return _; }
      });
      // Replace $...$
      str = str.replace(/\$([^$\n]+)\$/g, (_, expr) => {
        try { return window.katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false }); }
        catch { return _; }
      });
      // Replace \(...\)
      str = str.replace(/\\\(([\s\S]*?)\\\)/g, (_, expr) => {
        try { return window.katex.renderToString(expr.trim(), { displayMode: false, throwOnError: false }); }
        catch { return _; }
      });
      // Replace \[...\]
      str = str.replace(/\\\[([\s\S]*?)\\\]/g, (_, expr) => {
        try { return window.katex.renderToString(expr.trim(), { displayMode: true, throwOnError: false }); }
        catch { return _; }
      });
    }
    return str.replace(/\n/g, "<br>");
  }

  function render() {
    const bank = getCurrentBank();
    const filtered = getFilteredList();

    // Update subject toggle
    root.querySelectorAll(".fc-subj-tab").forEach(tab => {
      tab.classList.toggle("is-active", tab.dataset.subject === "all" || tab.dataset.subject === state.subject);
    });

    // Populate Chapter dropdown if needed
    const chSelect = root.querySelector("#fcChapterSelect");
    if (chSelect && chSelect.dataset.lastSubj !== state.subject) {
      chSelect.dataset.lastSubj = state.subject;
      const chapters = getChapters();
      chSelect.innerHTML = chapters
        .map(ch => `<option value="${escapeHtml(ch)}">${ch === "全部" ? "全部章节" : escapeHtml(ch)}</option>`)
        .join("");
      chSelect.value = state.currentChapter = "全部";
    }

    // Populate Type dropdown if needed
    const typeSelect = root.querySelector("#fcTypeSelect");
    if (typeSelect && typeSelect.dataset.lastSubj !== state.subject) {
      typeSelect.dataset.lastSubj = state.subject;
      const types = getTypes();
      typeSelect.innerHTML = types.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join("");
      typeSelect.value = state.currentType = "全部";
    }

    // Stats
    const answeredCount = bank.filter(q => state.progress[q.id]?.answered).length;
    const weakCount = bank.filter(q => state.progress[q.id]?.weak).length;
    const statsEl = root.querySelector("#fcStatsBadge");
    if (statsEl) {
      statsEl.textContent = `共 ${bank.length} 题 · 筛选 ${filtered.length} 题 · 已做 ${answeredCount} 题 · 错题本 ${weakCount} 题`;
    }

    // Check bounds
    if (state.currentIndex >= filtered.length) {
      state.currentIndex = Math.max(0, filtered.length - 1);
    }
    const currentQ = filtered[state.currentIndex];

    const emptyBox = root.querySelector("#fcEmptyBox");
    const qBox = root.querySelector("#fcQuestionCard");
    if (!currentQ) {
      if (emptyBox) emptyBox.hidden = false;
      if (qBox) qBox.hidden = true;
      return;
    }
    if (emptyBox) emptyBox.hidden = true;
    if (qBox) qBox.hidden = false;

    // Render Question Card
    const p = state.progress[currentQ.id] || {};
    const chapterBadge = root.querySelector("#fcChapterBadge");
    if (chapterBadge) {
      chapterBadge.textContent = currentQ.chapter || "材料专业课";
      chapterBadge.style.background = "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)";
      chapterBadge.style.color = "#ffffff";
      chapterBadge.style.borderColor = "rgba(99, 102, 241, 0.4)";
      chapterBadge.style.boxShadow = "0 2px 8px rgba(59, 130, 246, 0.28)";
      chapterBadge.style.fontWeight = "600";
    }
    root.querySelector("#fcTypeBadge").textContent = currentQ.type || "综合题";
    root.querySelector("#fcIndexText").textContent = `第 ${state.currentIndex + 1} / ${filtered.length} 题`;

    // Question body
    root.querySelector("#fcQuestionText").innerHTML = formatMath(currentQ.question);

    // Figure: show the image when it loads, otherwise a clear placeholder note
    renderQuestionFigure(root, currentQ);

    // Options (for choices)
    const optionsContainer = root.querySelector("#fcOptionsContainer");
    const isChoice = Array.isArray(currentQ.options) && currentQ.options.length > 0;
    if (isChoice) {
      optionsContainer.hidden = false;
      optionsContainer.innerHTML = currentQ.options.map((opt, i) => {
        const optLetter = (typeof opt === "object" && opt?.label) ? opt.label : String.fromCharCode(65 + i);
        const optText = (typeof opt === "object")
          ? (opt.mathText || opt.text || opt.value || "")
          : String(opt || "");
        let optClass = "fc-option-btn";
        if (state.selectedOption === optLetter) {
          const isRight = currentQ.answer && currentQ.answer.includes(optLetter);
          optClass += isRight ? " is-correct" : " is-wrong";
        } else if (state.answerRevealed && currentQ.answer && currentQ.answer.includes(optLetter)) {
          optClass += " is-correct";
        }
        return `
          <button class="${optClass}" data-letter="${optLetter}" type="button">
            <span class="fc-opt-letter">${optLetter}</span>
            <span class="fc-opt-text">${formatMath(optText)}</span>
          </button>
        `;
      }).join("");
    } else {
      optionsContainer.hidden = true;
      optionsContainer.innerHTML = "";
    }

    // Answer & Analysis
    const answerBox = root.querySelector("#fcAnswerBox");
    const revealBtn = root.querySelector("#fcRevealBtn");
    answerBox.hidden = !state.answerRevealed;
    revealBtn.textContent = state.answerRevealed ? "隐藏参考答案" : "查看参考答案与解析";

    if (state.answerRevealed) {
      root.querySelector("#fcCorrectAnswer").innerHTML = `<strong>【答案】</strong> ${formatMath(currentQ.answer || "见详细解析")}`;
      const analysisEl = root.querySelector("#fcAnalysisText");
      const analysisContent = (currentQ.analysis && currentQ.analysis.trim())
        ? currentQ.analysis
        : `本题考查《${currentQ.chapter || "材料专业课"}》核心概念「${currentQ.question}」，解题需紧扣教材标准理论，准确掌握其物理本质、微观特征与典型工程应用。`;
      analysisEl.innerHTML = `<strong>【解析】</strong><br>${formatMath(analysisContent)}`;
      analysisEl.hidden = false;
    }

    // Fav and Weak buttons
    const favBtn = root.querySelector("#fcFavBtn");
    favBtn.textContent = p.favorite ? "★ 已收藏" : "☆ 收藏";
    favBtn.classList.toggle("is-fav", !!p.favorite);

    const weakBtn = root.querySelector("#fcWeakBtn");
    weakBtn.textContent = p.weak ? "⚠️ 移出错题本" : "📌 加入错题本";
    weakBtn.classList.toggle("is-weak", !!p.weak);

    // Pagination
    root.querySelector("#fcPrevBtn").disabled = state.currentIndex <= 0;
    root.querySelector("#fcNextBtn").disabled = state.currentIndex >= filtered.length - 1;

    persist();
  }

  // Event Handlers
  root.addEventListener("click", e => {
    const target = e.target;

    // Subject toggle
    const subjTab = target.closest(".fc-subj-tab");
    if (subjTab) {
      state.subject = subjTab.dataset.subject;
      state.currentIndex = 0;
      state.answerRevealed = false;
      state.selectedOption = null;
      render();
      return;
    }

    // Option click
    const optBtn = target.closest(".fc-option-btn");
    if (optBtn) {
      const letter = optBtn.dataset.letter;
      state.selectedOption = letter;
      state.answerRevealed = true;
      const filtered = getFilteredList();
      const currentQ = filtered[state.currentIndex];
      if (currentQ) {
        const isRight = currentQ.answer && currentQ.answer.includes(letter);
        state.progress[currentQ.id] = {
          ...state.progress[currentQ.id],
          answered: true,
          userChoice: letter,
          isCorrect: isRight,
          weak: !isRight ? true : (state.progress[currentQ.id]?.weak || false)
        };
      }
      render();
      return;
    }

    // Reveal button
    if (target.closest("#fcRevealBtn")) {
      state.answerRevealed = !state.answerRevealed;
      const filtered = getFilteredList();
      const currentQ = filtered[state.currentIndex];
      if (currentQ) {
        state.progress[currentQ.id] = {
          ...state.progress[currentQ.id],
          answered: true
        };
      }
      render();
      return;
    }

    // Favorite toggle
    if (target.closest("#fcFavBtn")) {
      const filtered = getFilteredList();
      const currentQ = filtered[state.currentIndex];
      if (currentQ) {
        const p = state.progress[currentQ.id] || {};
        state.progress[currentQ.id] = { ...p, favorite: !p.favorite };
        render();
      }
      return;
    }

    // Weak toggle
    if (target.closest("#fcWeakBtn")) {
      const filtered = getFilteredList();
      const currentQ = filtered[state.currentIndex];
      if (currentQ) {
        const p = state.progress[currentQ.id] || {};
        state.progress[currentQ.id] = { ...p, weak: !p.weak };
        render();
      }
      return;
    }

    // Prev / Next
    if (target.closest("#fcPrevBtn")) {
      if (state.currentIndex > 0) {
        state.currentIndex--;
        state.answerRevealed = false;
        state.selectedOption = null;
        render();
      }
      return;
    }
    if (target.closest("#fcNextBtn")) {
      const filtered = getFilteredList();
      if (state.currentIndex < filtered.length - 1) {
        state.currentIndex++;
        state.answerRevealed = false;
        state.selectedOption = null;
        render();
      }
      return;
    }

    // Random toggle
    if (target.closest("#fcRandomBtn")) {
      const filtered = getFilteredList();
      if (filtered.length > 0) {
        state.currentIndex = Math.floor(Math.random() * filtered.length);
        state.answerRevealed = false;
        state.selectedOption = null;
        render();
      }
      return;
    }
  });

  // Select Filters
  root.querySelector("#fcChapterSelect")?.addEventListener("change", e => {
    state.currentChapter = e.target.value;
    state.currentIndex = 0;
    state.answerRevealed = false;
    state.selectedOption = null;
    render();
  });

  root.querySelector("#fcTypeSelect")?.addEventListener("change", e => {
    state.currentType = e.target.value;
    state.currentIndex = 0;
    state.answerRevealed = false;
    state.selectedOption = null;
    render();
  });

  root.querySelector("#fcStatusSelect")?.addEventListener("change", e => {
    state.filterStatus = e.target.value;
    state.currentIndex = 0;
    state.answerRevealed = false;
    state.selectedOption = null;
    render();
  });

  root.querySelector("#fcSearchInput")?.addEventListener("input", e => {
    state.query = e.target.value;
    state.currentIndex = 0;
    state.answerRevealed = false;
    state.selectedOption = null;
    render();
  });

  render();

  return {
    refresh() {
      render();
    }
  };
}

const FIGURE_REF_RE = /(如图|下图|上图|见图|图示|图\s*\d+-\d+)/;

function renderQuestionFigure(root, q) {
  const textEl = root.querySelector("#fcQuestionText");
  if (!textEl) return;
  let fig = root.querySelector("#fcQuestionFigure");
  if (!fig) {
    fig = document.createElement("figure");
    fig.id = "fcQuestionFigure";
    fig.className = "fc-question-figure";
    textEl.insertAdjacentElement("afterend", fig);
  }
  fig.replaceChildren();
  const needsFigure = Boolean(q.image) || FIGURE_REF_RE.test(q.question || "");
  fig.hidden = !needsFigure;
  if (!needsFigure) return;

  const showMissing = () => {
    fig.replaceChildren();
    const note = document.createElement("p");
    note.className = "fc-figure-missing";
    note.textContent = "本题配图整理中，可先参考教材对应插图作答。";
    fig.appendChild(note);
  };
  if (!q.image) { showMissing(); return; }

  const img = document.createElement("img");
  img.alt = "题目配图";
  img.loading = "lazy";
  img.decoding = "async";
  img.addEventListener("error", showMissing, { once: true });
  img.src = encodeURI(String(q.image).replace(/^\.?\//, "./"));
  fig.appendChild(img);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
