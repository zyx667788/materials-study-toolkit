(() => {
  "use strict";

  const DATA_URL = "data/questions.json";
  const STORAGE_PREFIX = "metallurgy-heat-treatment-flashcard:v1";
  const STORAGE_KEYS = {
    weak: `${STORAGE_PREFIX}:weak-ids`,
    excluded: `${STORAGE_PREFIX}:excluded-ids`,
    stats: `${STORAGE_PREFIX}:stats`
  };
  const TYPE_ORDER = [
    "名词解释",
    "选择题",
    "填空题",
    "判断题",
    "综合题"
  ];

  const state = {
    questions: [],
    currentChapter: "全部章节",
    currentType: "",
    typeOrigin: "home",
    listReturn: "homeScreen",
    practiceReturn: "homeScreen",
    queue: [],
    index: 0,
    current: null,
    selectedAnswers: [],
    answerChecked: false
  };

  const $ = (id) => document.getElementById(id);
  let toastTimer = 0;

  function readStored(key, fallback) {
    try {
      const value = JSON.parse(localStorage.getItem(key) || "null");
      return value ?? fallback;
    } catch (error) {
      console.warn(`无法读取本地记录：${key}`, error);
      return fallback;
    }
  }

  function writeStored(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`无法保存本地记录：${key}`, error);
      showToast("浏览器未允许保存学习记录");
    }
  }

  const getWeakIds = () => readStored(STORAGE_KEYS.weak, []);
  const setWeakIds = (ids) => writeStored(STORAGE_KEYS.weak, [...new Set(ids)]);
  const getExcludedIds = () => readStored(STORAGE_KEYS.excluded, []);
  const setExcludedIds = (ids) => writeStored(STORAGE_KEYS.excluded, [...new Set(ids)]);
  const getStats = () => readStored(STORAGE_KEYS.stats, {});
  const setStats = (stats) => writeStored(STORAGE_KEYS.stats, stats);

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#039;"
    })[character]);
  }

  function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#096;");
  }

  function toArray(value) {
    if (Array.isArray(value)) return value;
    if (value && typeof value === "object") return [value];
    return [];
  }

  function showToast(message) {
    const toast = $("toast");
    window.clearTimeout(toastTimer);
    toast.textContent = message;
    toast.classList.add("show");
    toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function showScreen(screenId) {
    document.querySelectorAll(".screen").forEach((screen) => {
      screen.classList.toggle("active", screen.id === screenId);
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function isExcluded(question) {
    return Boolean(question && getExcludedIds().includes(question.id));
  }

  function activeQuestions() {
    const excluded = new Set(getExcludedIds());
    return state.questions.filter((question) => !excluded.has(question.id));
  }

  function reconcileStoredQuestionIds() {
    const validIds = new Set(state.questions.map((question) => question.id));
    setWeakIds(getWeakIds().filter((id) => validIds.has(id)));
    setExcludedIds(getExcludedIds().filter((id) => validIds.has(id)));
  }

  function chineseChapterNumber(chapter) {
    const match = String(chapter || "").match(/^第([零〇一二两三四五六七八九十百千\d]+)章/);
    if (!match) return Number.MAX_SAFE_INTEGER;
    if (/^\d+$/.test(match[1])) return Number.parseInt(match[1], 10);

    const digits = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
    const units = { 十: 10, 百: 100, 千: 1000 };
    let total = 0;
    let current = 0;
    [...match[1]].forEach((character) => {
      if (Object.prototype.hasOwnProperty.call(digits, character)) {
        current = digits[character];
      } else if (units[character]) {
        total += (current || 1) * units[character];
        current = 0;
      }
    });
    return total + current;
  }

  function compareChapters(left, right) {
    return chineseChapterNumber(left) - chineseChapterNumber(right)
      || String(left).localeCompare(String(right), "zh-CN", { numeric: true });
  }

  function chaptersFor(type = "", source = activeQuestions()) {
    return [...new Set(source
      .filter((question) => !type || question.type === type)
      .map((question) => question.chapter))]
      .sort(compareChapters);
  }

  function availableTypes(source = activeQuestions()) {
    const found = new Set(source.map((question) => question.type));
    const known = TYPE_ORDER.filter((type) => found.has(type));
    const extra = [...found].filter((type) => !TYPE_ORDER.includes(type)).sort((a, b) => a.localeCompare(b, "zh-CN"));
    return [...known, ...extra];
  }

  function filteredQuestions(type = "", chapter = "全部章节", source = activeQuestions()) {
    return source.filter((question) => {
      const matchesType = !type || type === "全部" || question.type === type;
      const matchesChapter = !chapter || chapter === "全部章节" || question.chapter === chapter;
      return matchesType && matchesChapter;
    });
  }

  function shuffle(items) {
    const result = [...items];
    for (let index = result.length - 1; index > 0; index -= 1) {
      const target = Math.floor(Math.random() * (index + 1));
      [result[index], result[target]] = [result[target], result[index]];
    }
    return result;
  }

  function renderMathText(mathText, fallbackText = "") {
    const fallback = String(fallbackText ?? "");
    const source = String(mathText || fallback);
    if (!source) return "";
    if (!window.katex) return escapeHtml(fallback || source).replace(/\n/g, "<br>");

    const pattern = /\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/g;
    let html = "";
    let previousIndex = 0;
    let match;

    while ((match = pattern.exec(source))) {
      html += escapeHtml(source.slice(previousIndex, match.index)).replace(/\n/g, "<br>");
      const displayMode = match[1] !== undefined;
      const formula = displayMode ? match[1] : match[2];
      try {
        const rendered = window.katex.renderToString(formula, {
          displayMode,
          output: "htmlAndMathml",
          throwOnError: true,
          strict: "ignore",
          trust: false
        });
        html += `<span class="${displayMode ? "math-display" : "math-inline"}">${rendered}</span>`;
      } catch (error) {
        console.warn("KaTeX 公式渲染失败", formula, error);
        html += `<code>${escapeHtml(formula)}</code>`;
      }
      previousIndex = pattern.lastIndex;
    }

    html += escapeHtml(source.slice(previousIndex)).replace(/\n/g, "<br>");
    return html;
  }

  function imageRecord(image, fallbackAlt) {
    if (typeof image === "string") return { src: image, alt: fallbackAlt };
    if (image && typeof image === "object" && image.src) {
      return { src: image.src, alt: image.alt || fallbackAlt };
    }
    return null;
  }

  function renderImages(images, className, fallbackAlt) {
    return toArray(images)
      .map((image) => imageRecord(image, fallbackAlt))
      .filter(Boolean)
      .map(({ src, alt }) => `<img class="${className}" src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}" loading="lazy">`)
      .join("");
  }

  function renderContentBlocks({ blocks, mathText, text, images, formulaImages, imageAlt, formulaAlt }) {
    const normalizedBlocks = toArray(blocks);
    if (normalizedBlocks.length) {
      return normalizedBlocks.map((block) => {
        const body = block.text || block.mathText
          ? `<div class="content-block">${renderMathText(block.mathText, block.text || "")}</div>`
          : "";
        return body
          + renderImages(block.images, "question-image", imageAlt)
          + renderImages(block.formulaImages, "formula-image", formulaAlt);
      }).join("");
    }

    return `<div class="content-block">${renderMathText(mathText, text || "")}</div>`
      + renderImages(images, "question-image", imageAlt)
      + renderImages(formulaImages, "formula-image", formulaAlt);
  }

  function renderMetrics() {
    const active = activeQuestions();
    const activeIds = new Set(active.map((question) => question.id));
    const weakCount = getWeakIds().filter((id) => activeIds.has(id)).length;
    const excludedCount = getExcludedIds().length;
    $("metrics").innerHTML = [
      { icon: "Σ", value: active.length, label: "总题量" },
      { icon: "△", value: weakCount, label: "薄弱题" },
      { icon: "—", value: excludedCount, label: "不学题" }
    ].map((metric) => `
      <div class="metric">
        <span class="metric-icon" aria-hidden="true">${metric.icon}</span>
        <span><b>${metric.value}</b><small>${metric.label}</small></span>
      </div>
    `).join("");
  }

  function renderChapterGrid() {
    const source = activeQuestions();
    const chapters = chaptersFor("", source);
    $("chapterGrid").innerHTML = chapters.length
      ? chapters.map((chapter) => {
        const count = source.filter((question) => question.chapter === chapter).length;
        return `
          <button class="choice-card" type="button" data-open-chapter="${escapeAttribute(chapter)}">
            <span><b>${escapeHtml(chapter)}</b><small>${count} 题</small></span>
            <span class="choice-arrow" aria-hidden="true">›</span>
          </button>`;
      }).join("")
      : '<div class="inline-empty">暂无可学习章节</div>';
  }

  function renderTypeGrid() {
    const source = activeQuestions();
    const types = availableTypes(source);
    $("typeGrid").innerHTML = types.length
      ? types.map((type) => {
        const count = source.filter((question) => question.type === type).length;
        return `
          <button class="choice-card" type="button" data-open-type="${escapeAttribute(type)}" data-origin="home">
            <span><b>${escapeHtml(type)}</b><small>${count} 题</small></span>
            <span class="choice-arrow" aria-hidden="true">›</span>
          </button>`;
      }).join("")
      : '<div class="inline-empty">暂无可练习题型</div>';
  }

  function renderHome() {
    renderMetrics();
    renderChapterGrid();
    renderTypeGrid();
  }

  function goHome() {
    renderHome();
    showScreen("homeScreen");
  }

  function setPracticeTab(mode) {
    const chapterActive = mode !== "type";
    $("chapterTab").classList.toggle("active", chapterActive);
    $("typeTab").classList.toggle("active", !chapterActive);
    $("chapterTab").setAttribute("aria-selected", String(chapterActive));
    $("typeTab").setAttribute("aria-selected", String(!chapterActive));
    $("chapterPanel").classList.toggle("active", chapterActive);
    $("typePanel").classList.toggle("active", !chapterActive);
  }

  function openChapter(chapter) {
    state.currentChapter = chapter;
    state.typeOrigin = "chapter";
    $("chapterTitle").textContent = chapter;
    const source = filteredQuestions("", chapter);
    const types = availableTypes(source);
    $("chapterTypeGrid").innerHTML = types.length
      ? types.map((type) => {
        const count = source.filter((question) => question.type === type).length;
        return `
          <button class="choice-card" type="button" data-open-type="${escapeAttribute(type)}" data-origin="chapter">
            <span><b>${escapeHtml(type)}</b><small>${count} 题</small></span>
            <span class="choice-arrow" aria-hidden="true">›</span>
          </button>`;
      }).join("")
      : '<div class="inline-empty">本章暂无可练习题目</div>';
    showScreen("chapterScreen");
  }

  function selectOptions(values, selected) {
    return values.map((value) => `<option value="${escapeAttribute(value)}"${value === selected ? " selected" : ""}>${escapeHtml(value)}</option>`).join("");
  }

  function openType(type, chapter = "全部章节", origin = "home") {
    state.currentType = type;
    state.currentChapter = origin === "chapter" ? chapter : "全部章节";
    state.typeOrigin = origin;
    $("typeTitle").textContent = origin === "chapter" ? `${chapter} · ${type}` : type;
    $("typeChapterField").hidden = origin === "chapter";
    const chapters = chaptersFor(type);
    $("typeChapterSelect").innerHTML = selectOptions(["全部章节", ...chapters], state.currentChapter);
    showScreen("typeScreen");
  }

  function selectedTypeChapter() {
    return state.typeOrigin === "chapter" ? state.currentChapter : $("typeChapterSelect").value;
  }

  function startQueue(items, returnScreen) {
    const queue = items.filter((question) => question && !isExcluded(question));
    if (!queue.length) {
      showToast("当前没有可练习的题目");
      return;
    }
    state.queue = queue;
    state.index = 0;
    state.practiceReturn = returnScreen;
    renderCurrentQuestion();
    showScreen("practiceScreen");
  }

  function correctOptionLabels(question) {
    if (Array.isArray(question.correctOptions)) {
      return question.correctOptions.map((label) => String(label).toUpperCase());
    }
    return [...new Set(String(question.answer || "").toUpperCase().match(/[A-Z]/g) || [])];
  }

  function isMultipleChoice(question) {
    return Boolean(question.multiple) || correctOptionLabels(question).length > 1;
  }

  function normalizedJudgment(answer) {
    const value = String(answer || "").trim();
    if (["对", "正确", "√", "true"].includes(value.toLowerCase())) return "对";
    if (["错", "错误", "×", "false"].includes(value.toLowerCase())) return "错";
    return "";
  }

  function normalizedOptions(question) {
    return toArray(question.options).map((option, index) => {
      if (typeof option === "string") {
        return { label: String.fromCharCode(65 + index), text: option };
      }
      return {
        ...option,
        label: String(option.label || String.fromCharCode(65 + index)).toUpperCase()
      };
    });
  }

  function feedbackMarkup(isCorrect, correctAnswer) {
    if (!state.answerChecked) return "";
    return `<div class="answer-feedback ${isCorrect ? "correct" : "wrong"}" role="status">${
      isCorrect ? "回答正确" : `回答错误，正确答案：${escapeHtml(correctAnswer)}`
    }</div>`;
  }

  function renderAnswerControls(question) {
    if (question.type === "判断题") {
      const correct = normalizedJudgment(question.answer);
      const choices = [
        { value: "对", label: "√ 正确" },
        { value: "错", label: "× 错误" }
      ];
      const buttons = choices.map((choice) => {
        const selected = state.selectedAnswers.includes(choice.value);
        const classes = [
          "option",
          "judgment-option",
          selected ? "selected" : "",
          state.answerChecked && choice.value === correct ? "correct" : "",
          state.answerChecked && selected && choice.value !== correct ? "wrong" : ""
        ].filter(Boolean).join(" ");
        return `<button class="${classes}" type="button" data-judgment="${choice.value}"${state.answerChecked ? " disabled" : ""}>${choice.label}</button>`;
      }).join("");
      const selectedCorrectly = state.selectedAnswers[0] === correct;
      $("optionsBox").innerHTML = `<div class="judgment-grid">${buttons}</div>${feedbackMarkup(selectedCorrectly, correct === "对" ? "√ 正确" : "× 错误")}`;
      return;
    }

    const options = normalizedOptions(question);
    if (!options.length) {
      $("optionsBox").innerHTML = "";
      return;
    }

    const correctLabels = correctOptionLabels(question);
    const multiple = isMultipleChoice(question);
    const buttons = options.map((option) => {
      const selected = state.selectedAnswers.includes(option.label);
      const isCorrect = correctLabels.includes(option.label);
      const classes = [
        "option",
        selected ? "selected" : "",
        state.answerChecked && isCorrect ? "correct" : "",
        state.answerChecked && selected && !isCorrect ? "wrong" : ""
      ].filter(Boolean).join(" ");
      const optionBody = renderMathText(option.mathText, option.text || "")
        + renderImages(option.images, "question-image", "选项配图")
        + renderImages(option.formulaImages, "formula-image", "选项公式");
      return `
        <button class="${classes}" type="button" data-option="${escapeAttribute(option.label)}"${state.answerChecked ? " disabled" : ""}>
          <span class="option-label">${escapeHtml(option.label)}</span>
          <span>${optionBody}</span>
        </button>`;
    }).join("");

    const confirm = multiple && !state.answerChecked
      ? `<button class="button primary confirm-choice" type="button" data-action="confirm-choice"${state.selectedAnswers.length ? "" : " disabled"}>确定答案</button>`
      : "";
    const selected = [...state.selectedAnswers].sort().join("");
    const expected = [...correctLabels].sort().join("");
    $("optionsBox").innerHTML = `<div class="option-list">${buttons}</div>${confirm}${feedbackMarkup(selected === expected, correctLabels.join("、"))}`;
  }

  function hasContent(...values) {
    return values.some((value) => {
      if (Array.isArray(value)) return value.length > 0;
      if (value && typeof value === "object") return Object.keys(value).length > 0;
      return Boolean(value);
    });
  }

  function renderCurrentQuestion() {
    const question = state.queue[state.index];
    state.current = question;
    state.selectedAnswers = [];
    state.answerChecked = false;

    const progress = state.queue.length ? ((state.index + 1) / state.queue.length) * 100 : 0;
    $("progressText").textContent = `${state.index + 1} / ${state.queue.length}`;
    $("progressBar").style.width = `${progress}%`;
    $("questionType").textContent = question.type;
    $("questionChapter").textContent = question.chapter;
    $("questionText").innerHTML = renderContentBlocks({
      blocks: question.questionBlocks,
      mathText: question.questionMath,
      text: question.question,
      images: question.images || (question.image ? [question.image] : []),
      formulaImages: question.formulaImages,
      imageAlt: "题目配图",
      formulaAlt: "题目公式"
    });

    renderAnswerControls(question);
    const answer = renderContentBlocks({
      blocks: question.answerBlocks,
      mathText: question.answerMath,
      text: question.answer || "暂无答案",
      images: question.answerImages || (question.answerImage ? [question.answerImage] : []),
      formulaImages: question.answerFormulaImages,
      imageAlt: "答案配图",
      formulaAlt: "答案公式"
    });
    const analysis = hasContent(question.analysis, question.analysisMath, question.analysisBlocks, question.analysisImages, question.analysisFormulaImages)
      ? `<section class="answer-section analysis"><h3>解析</h3>${renderContentBlocks({
        blocks: question.analysisBlocks,
        mathText: question.analysisMath,
        text: question.analysis,
        images: question.analysisImages,
        formulaImages: question.analysisFormulaImages,
        imageAlt: "解析配图",
        formulaAlt: "解析公式"
      })}</section>`
      : "";
    $("answerPanel").innerHTML = `<section class="answer-section"><h3>答案</h3>${answer}</section>${analysis}`;
    $("answerPanel").classList.remove("show");
    const answerToggle = document.querySelector('[data-action="toggle-answer"]');
    answerToggle.setAttribute("aria-expanded", "false");
    $("questionMeta").textContent = `题目编号：${question.id}`;
  }

  function chooseOption(label) {
    if (!state.current || state.answerChecked) return;
    if (isMultipleChoice(state.current)) {
      state.selectedAnswers = state.selectedAnswers.includes(label)
        ? state.selectedAnswers.filter((item) => item !== label)
        : [...state.selectedAnswers, label];
    } else {
      state.selectedAnswers = [label];
      state.answerChecked = true;
    }
    renderAnswerControls(state.current);
  }

  function chooseJudgment(value) {
    if (!state.current || state.answerChecked) return;
    state.selectedAnswers = [value];
    state.answerChecked = true;
    renderAnswerControls(state.current);
  }

  function confirmChoice() {
    if (!state.current || state.answerChecked || !state.selectedAnswers.length) return;
    state.answerChecked = true;
    renderAnswerControls(state.current);
  }

  function toggleAnswer() {
    const panel = $("answerPanel");
    const toggle = document.querySelector('[data-action="toggle-answer"]');
    const open = panel.classList.toggle("show");
    toggle.setAttribute("aria-expanded", String(open));
  }

  function moveQuestion(direction) {
    const target = state.index + direction;
    if (target < 0) {
      showToast("已经是第一题了");
      return;
    }
    if (target >= state.queue.length) {
      showToast("已经是最后一题了");
      return;
    }
    state.index = target;
    renderCurrentQuestion();
  }

  function markCurrent(mark) {
    if (!state.current) return;
    const weak = new Set(getWeakIds());
    if (mark === "known") weak.delete(state.current.id);
    if (mark === "weak") weak.add(state.current.id);
    setWeakIds([...weak]);

    const stats = getStats();
    stats[mark] = (stats[mark] || 0) + 1;
    setStats(stats);

    if (state.index < state.queue.length - 1) {
      state.index += 1;
      renderCurrentQuestion();
      showToast(mark === "known" ? "已标记为掌握" : "已加入薄弱题");
    } else {
      showToast("本轮练习完成");
      returnFromPractice();
    }
    renderHome();
  }

  function returnFromPractice() {
    if (state.practiceReturn === "chapterScreen") {
      openChapter(state.currentChapter);
      return;
    }
    if (state.practiceReturn === "typeScreen") {
      openType(state.currentType, state.currentChapter, state.typeOrigin);
      return;
    }
    if (state.practiceReturn === "listScreen" || state.practiceReturn === "searchScreen") {
      showScreen(state.practiceReturn);
      return;
    }
    goHome();
  }

  function requestExcludeCurrent() {
    if (!state.current) return;
    const dialog = $("excludeDialog");
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else if (window.confirm("确定将这道题移入不学题库吗？")) {
      excludeCurrentQuestion();
    }
  }

  function excludeCurrentQuestion() {
    if (!state.current) return;
    const excluded = new Set(getExcludedIds());
    excluded.add(state.current.id);
    setExcludedIds([...excluded]);
    state.queue = state.queue.filter((question) => question.id !== state.current.id);
    if (state.index >= state.queue.length) state.index = state.queue.length - 1;
    renderHome();

    if (state.queue.length) {
      renderCurrentQuestion();
      showToast("已移入不学题库");
    } else {
      showToast("本轮题目已全部移出");
      returnFromPractice();
    }
  }

  function questionExcerpt(question) {
    return String(question.question || question.questionMath || "未命名题目")
      .replace(/\\\[|\\\]|\\\(|\\\)/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function listItemMarkup(question, returnScreen) {
    return `
      <button class="list-item" type="button" data-open-question="${escapeAttribute(question.id)}" data-return-screen="${returnScreen}">
        <span><b>${escapeHtml(questionExcerpt(question))}</b><small>${escapeHtml(question.type)} · ${escapeHtml(question.chapter)}</small></span>
        <span class="choice-arrow" aria-hidden="true">›</span>
      </button>`;
  }

  function populateListFilters(type, chapter) {
    const types = availableTypes();
    $("listTypeSelect").innerHTML = selectOptions(["全部", ...types], type);
    updateListChapterOptions(chapter);
  }

  function updateListChapterOptions(preferred = "全部章节") {
    const type = $("listTypeSelect").value;
    const chapters = chaptersFor(type === "全部" ? "" : type);
    const selected = ["全部章节", ...chapters].includes(preferred) ? preferred : "全部章节";
    $("listChapterSelect").innerHTML = selectOptions(["全部章节", ...chapters], selected);
  }

  function openList({ title, type = "全部", chapter = "全部章节", returnScreen = "homeScreen" }) {
    state.listReturn = returnScreen;
    $("listTitle").textContent = title;
    populateListFilters(type, chapter);
    renderList();
    showScreen("listScreen");
  }

  function renderList() {
    const type = $("listTypeSelect").value;
    const chapter = $("listChapterSelect").value;
    const questions = filteredQuestions(type, chapter);
    $("listBox").innerHTML = questions.length
      ? `<p class="list-summary">共 ${questions.length} 题</p><div class="question-list">${questions.map((question) => listItemMarkup(question, "listScreen")).join("")}</div>`
      : '<div class="inline-empty">当前筛选条件下暂无题目</div>';
  }

  function backFromList() {
    if (state.listReturn === "chapterScreen") {
      openChapter(state.currentChapter);
      return;
    }
    if (state.listReturn === "typeScreen") {
      openType(state.currentType, state.currentChapter, state.typeOrigin);
      return;
    }
    goHome();
  }

  function searchableText(question) {
    return [
      question.id,
      question.oldId,
      question.chapter,
      question.type,
      question.question,
      question.questionMath,
      question.answer,
      question.answerMath,
      question.analysis,
      question.analysisMath,
      question.tag,
      JSON.stringify(question.options || [])
    ].filter(Boolean).join(" ").toLowerCase();
  }

  function openSearch() {
    $("searchInput").value = "";
    $("searchBox").innerHTML = '<div class="inline-empty">输入关键词后开始搜索</div>';
    showScreen("searchScreen");
    window.setTimeout(() => $("searchInput").focus(), 100);
  }

  function renderSearch() {
    const keyword = $("searchInput").value.trim().toLowerCase();
    if (!keyword) {
      $("searchBox").innerHTML = '<div class="inline-empty">输入关键词后开始搜索</div>';
      return;
    }
    const matches = activeQuestions().filter((question) => searchableText(question).includes(keyword));
    const visibleMatches = matches.slice(0, 120);
    $("searchBox").innerHTML = visibleMatches.length
      ? `<p class="list-summary">找到 ${matches.length} 题${matches.length > 120 ? "，当前显示前 120 题" : ""}</p><div class="question-list">${visibleMatches.map((question) => listItemMarkup(question, "searchScreen")).join("")}</div>`
      : '<div class="inline-empty">没有找到匹配题目，换个关键词试试</div>';
  }

  function openQuestion(questionId, returnScreen) {
    const question = state.questions.find((item) => item.id === questionId);
    if (question) startQueue([question], returnScreen);
  }

  function renderExcludedList() {
    const excluded = new Set(getExcludedIds());
    const questions = state.questions.filter((question) => excluded.has(question.id));
    $("excludedBox").innerHTML = questions.length
      ? `<p class="list-summary">共 ${questions.length} 题</p><div class="question-list">${questions.map((question) => `
        <div class="list-item excluded-item">
          <span><b>${escapeHtml(questionExcerpt(question))}</b><small>${escapeHtml(question.type)} · ${escapeHtml(question.chapter)}</small></span>
          <button class="restore-button" type="button" data-restore-question="${escapeAttribute(question.id)}">恢复</button>
        </div>`).join("")}</div>`
      : '<div class="inline-empty">不学题库目前是空的</div>';
  }

  function openExcluded() {
    renderExcludedList();
    showScreen("excludedScreen");
  }

  function restoreQuestion(questionId) {
    setExcludedIds(getExcludedIds().filter((id) => id !== questionId));
    renderExcludedList();
    renderHome();
    showToast("已恢复到正常题库");
  }

  function clearExcluded() {
    if (!getExcludedIds().length) {
      showToast("不学题库已经是空的");
      return;
    }
    if (!window.confirm("确定恢复不学题库中的全部题目吗？")) return;
    setExcludedIds([]);
    renderExcludedList();
    renderHome();
    showToast("已恢复全部题目");
  }

  async function copyWeChat() {
    const wechatId = "matsci_";
    let copied = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(wechatId);
        copied = true;
      }
    } catch {
      copied = false;
    }
    if (!copied) {
      const input = document.createElement("textarea");
      input.value = wechatId;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      copied = document.execCommand("copy");
      input.remove();
    }
    showToast(copied ? "微信号已复制" : `微信号：${wechatId}`);
  }

  function handleAction(action) {
    const weakIds = new Set(getWeakIds());
    const chapter = state.currentChapter;
    const typeChapter = selectedTypeChapter();
    const actions = {
      home: goHome,
      "random-all": () => startQueue(shuffle(activeQuestions()), "homeScreen"),
      weak: () => startQueue(activeQuestions().filter((question) => weakIds.has(question.id)), "homeScreen"),
      "all-list": () => openList({ title: "全部题目" }),
      search: openSearch,
      excluded: openExcluded,
      "type-back": () => state.typeOrigin === "chapter" ? openChapter(chapter) : goHome(),
      "chapter-random": () => startQueue(shuffle(filteredQuestions("", chapter)), "chapterScreen"),
      "chapter-weak": () => startQueue(filteredQuestions("", chapter).filter((question) => weakIds.has(question.id)), "chapterScreen"),
      "chapter-list": () => openList({ title: `${chapter} · 全部题目`, chapter, returnScreen: "chapterScreen" }),
      "type-sequence": () => startQueue(filteredQuestions(state.currentType, typeChapter), "typeScreen"),
      "type-random": () => startQueue(shuffle(filteredQuestions(state.currentType, typeChapter)), "typeScreen"),
      "type-weak": () => startQueue(filteredQuestions(state.currentType, typeChapter).filter((question) => weakIds.has(question.id)), "typeScreen"),
      "type-list": () => openList({ title: `${state.currentType} · 全部题目`, type: state.currentType, chapter: typeChapter, returnScreen: "typeScreen" }),
      "practice-back": returnFromPractice,
      "toggle-answer": toggleAnswer,
      previous: () => moveQuestion(-1),
      next: () => moveQuestion(1),
      "mark-known": () => markCurrent("known"),
      "mark-weak": () => markCurrent("weak"),
      "exclude-current": requestExcludeCurrent,
      "confirm-choice": confirmChoice,
      "list-back": backFromList,
      "clear-excluded": clearExcluded,
      "copy-wechat": copyWeChat
    };
    if (actions[action]) actions[action]();
  }

  function bindEvents() {
    document.addEventListener("click", (event) => {
      const actionButton = event.target.closest("[data-action]");
      if (actionButton) {
        handleAction(actionButton.dataset.action);
        return;
      }

      const tab = event.target.closest("[data-tab]");
      if (tab) {
        setPracticeTab(tab.dataset.tab);
        return;
      }

      const chapterButton = event.target.closest("[data-open-chapter]");
      if (chapterButton) {
        openChapter(chapterButton.dataset.openChapter);
        return;
      }

      const typeButton = event.target.closest("[data-open-type]");
      if (typeButton) {
        const origin = typeButton.dataset.origin || "home";
        openType(typeButton.dataset.openType, state.currentChapter, origin);
        return;
      }

      const optionButton = event.target.closest("[data-option]");
      if (optionButton) {
        chooseOption(optionButton.dataset.option);
        return;
      }

      const judgmentButton = event.target.closest("[data-judgment]");
      if (judgmentButton) {
        chooseJudgment(judgmentButton.dataset.judgment);
        return;
      }

      const questionButton = event.target.closest("[data-open-question]");
      if (questionButton) {
        openQuestion(questionButton.dataset.openQuestion, questionButton.dataset.returnScreen);
        return;
      }

      const restoreButton = event.target.closest("[data-restore-question]");
      if (restoreButton) restoreQuestion(restoreButton.dataset.restoreQuestion);
    });

    $("typeChapterSelect").addEventListener("change", (event) => {
      if (state.typeOrigin !== "chapter") state.currentChapter = event.target.value;
    });
    $("listTypeSelect").addEventListener("change", () => {
      updateListChapterOptions();
      renderList();
    });
    $("listChapterSelect").addEventListener("change", renderList);
    $("searchInput").addEventListener("input", renderSearch);
    $("excludeDialog").addEventListener("close", (event) => {
      if (event.target.returnValue === "confirm") excludeCurrentQuestion();
    });
  }

  function normalizeQuestion(question) {
    return {
      ...question,
      id: String(question.id || "").trim(),
      chapter: String(question.chapter || "未分类章节").trim(),
      type: String(question.type || "未分类题型").trim(),
      question: String(question.question || "").trim()
    };
  }

  async function loadQuestionBank() {
    $("bankStatus").classList.add("loading");
    try {
      const response = await fetch(DATA_URL, { cache: "no-cache" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("题库根节点必须是数组");
      state.questions = data.map(normalizeQuestion).filter((question) => question.id && (question.question || question.questionMath || question.questionBlocks));
      reconcileStoredQuestionIds();
      renderHome();
      $("bankStatus").classList.remove("loading");
      $("bankStatus").textContent = `题库已就绪 · ${state.questions.length} 题`;
    } catch (error) {
      console.error("题库载入失败", error);
      $("bankStatus").classList.remove("loading");
      $("bankStatus").textContent = "题库载入失败";
      $("errorMessage").textContent = location.protocol === "file:"
        ? "请运行 npm run dev，并通过 http://127.0.0.1:4173 打开网站。"
        : `无法读取 ${DATA_URL}，请检查文件和 JSON 格式。`;
      showScreen("errorScreen");
    }
  }

  bindEvents();
  loadQuestionBank();
})();
