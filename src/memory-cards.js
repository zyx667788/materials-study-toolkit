import { CARDS } from "./cards-data.js";
import { MEDIA } from "./cards-media.js";

export function initMemoryCardsModule() {
  const root = document.querySelector("#memoryCardsModule");
  if (!root) return { refresh: () => {} };

  const STORAGE_KEY = "mstool.memory_cards.progress.v1";
  let state = {
    currentId: CARDS[0]?.id || "",
    category: "全部",
    frequency: "all",
    status: "all",
    query: "",
    random: false,
    revealed: false,
    progress: {}, // id: { rating: 'known'|'uncertain'|'forgot', favorite: boolean }
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (saved && typeof saved === "object") {
      state.progress = saved.progress || {};
      if (saved.currentId && CARDS.some(c => c.id === saved.currentId)) {
        state.currentId = saved.currentId;
      }
    }
  } catch (e) {
    console.warn("Failed to load memory cards progress", e);
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        currentId: state.currentId,
        progress: state.progress
      }));
    } catch (e) {}
  }

  // Cache search text
  const searchIndex = new Map(
    CARDS.map(c => [
      c.id,
      [c.title, c.definition, c.traits, c.hint, c.scope, c.body, c.extra, c.example]
        .join(" ")
        .replace(/<[^>]+>/g, "")
        .toLowerCase()
    ])
  );

  function getFilteredCards() {
    const q = state.query.trim().toLowerCase();
    let list = CARDS.filter(c => {
      const p = state.progress[c.id] || {};
      const matchCat = state.category === "全部" || c.type === state.category;
      const matchFreq = state.frequency === "all" || c.freq === state.frequency;
      const matchQuery = !q || (searchIndex.get(c.id) || "").includes(q);
      let matchStatus = true;
      if (state.status === "favorite") matchStatus = !!p.favorite;
      else if (state.status === "known") matchStatus = p.rating === "known";
      else if (state.status === "new") matchStatus = !p.rating;
      else if (state.status === "weak") matchStatus = p.rating === "forgot" || p.rating === "uncertain";
      return matchCat && matchFreq && matchQuery && matchStatus;
    });

    if (state.random) {
      list = [...list].sort(() => 0.5 - Math.random());
    } else {
      const FREQ_RANK = { "高频": 1, "中频": 2, "低频": 3 };
      list.sort((a, b) => (FREQ_RANK[a.freq] || 99) - (FREQ_RANK[b.freq] || 99));
    }
    return list;
  }

  function render() {
    const list = getFilteredCards();
    if (!list.some(c => c.id === state.currentId)) {
      state.currentId = list[0]?.id || "";
    }
    const currentCard = list.find(c => c.id === state.currentId);
    const currentIndex = list.indexOf(currentCard);

    // Update counts & badges
    const knownCount = CARDS.filter(c => state.progress[c.id]?.rating === "known").length;
    const weakCount = CARDS.filter(c => ["forgot", "uncertain"].includes(state.progress[c.id]?.rating)).length;
    
    const countEl = root.querySelector("#memCountBadge");
    if (countEl) countEl.textContent = `${list.length} 张卡片 (已掌握 ${knownCount}/${CARDS.length} · 薄弱 ${weakCount})`;

    // Category tabs
    root.querySelectorAll(".mem-cat-tab").forEach(tab => {
      tab.classList.toggle("is-active", tab.dataset.category === state.category);
    });

    // Card List Sidebar
    const listContainer = root.querySelector("#memCardList");
    if (listContainer) {
      listContainer.innerHTML = list.map((c, i) => {
        const p = state.progress[c.id] || {};
        const ratingClass = p.rating ? `is-${p.rating}` : "is-unseen";
        const favIcon = p.favorite ? "★ " : "";
        const activeClass = c.id === state.currentId ? "is-active" : "";
        return `
          <button class="mem-list-item ${activeClass} ${ratingClass}" data-id="${c.id}" type="button">
            <span class="mem-item-idx">${String(i + 1).padStart(2, "0")}</span>
            <span class="mem-item-title">${favIcon}${escapeHtml(c.title)}</span>
            <span class="mem-item-freq badge-${c.freq}">${c.freq}</span>
          </button>
        `;
      }).join("");
    }

    // Card View
    const emptyView = root.querySelector("#memEmptyView");
    const cardView = root.querySelector("#memCardWrapper");
    if (!currentCard) {
      if (emptyView) emptyView.hidden = false;
      if (cardView) cardView.hidden = true;
      return;
    }
    if (emptyView) emptyView.hidden = true;
    if (cardView) cardView.hidden = false;

    // Fill current card content
    const p = state.progress[currentCard.id] || {};
    root.querySelector("#memTitle").textContent = currentCard.title;
    root.querySelector("#memType").textContent = currentCard.type;
    const freqBadge = root.querySelector("#memFreq");
    freqBadge.textContent = currentCard.freq + "考点";
    freqBadge.className = `badge-${currentCard.freq}`;

    const scopeBadge = root.querySelector("#memScope");
    if (currentCard.scope) {
      scopeBadge.textContent = currentCard.scope;
      scopeBadge.hidden = false;
    } else {
      scopeBadge.hidden = true;
    }

    const favBtn = root.querySelector("#memFavBtn");
    favBtn.textContent = p.favorite ? "★ 已收藏" : "☆ 收藏";
    favBtn.classList.toggle("is-fav", !!p.favorite);

    // Front: study prompt (线索已按客户要求移除，避免雷同)
    const frontHint = root.querySelector("#memFrontHint");
    if (frontHint) {
      frontHint.textContent = "思考核心概念后，点击“展开答案”核对专业课知识要点";
    }

    // Back / Revealed Answer
    const answerPanel = root.querySelector("#memAnswerPanel");
    const revealBtn = root.querySelector("#memRevealBtn");
    answerPanel.hidden = !state.revealed;
    revealBtn.textContent = state.revealed ? "收起答案" : "展开答案 (空格/回车)";

    if (state.revealed) {
      let bodyHtml = "";
      if (currentCard.formula) bodyHtml += `<div class="mem-formula">${currentCard.formula}</div>`;
      if (currentCard.definition) {
        bodyHtml += `<p class="mem-definition">${currentCard.definitionHtml || escapeHtml(currentCard.definition)}</p>`;
      }
      if (currentCard.traits) {
        bodyHtml += `<p class="mem-traits"><strong>【核心特点】</strong> ${currentCard.traitsHtml || escapeHtml(currentCard.traits)}</p>`;
      }
      if (currentCard.body) bodyHtml += `<div class="mem-body">${currentCard.body}</div>`;
      if (currentCard.extra) bodyHtml += `<div class="mem-extra"><strong>【补充说明】</strong> ${currentCard.extra}</div>`;
      if (currentCard.example) bodyHtml += `<div class="mem-example"><strong>【典型例子】</strong> ${currentCard.example}</div>`;

      root.querySelector("#memAnswerText").innerHTML = bodyHtml;

      // Diagram / Media
      const diagramContainer = root.querySelector("#memDiagramContainer");
      let diagContent = "";
      if (currentCard.simple && MEDIA.diagrams && MEDIA.diagrams[currentCard.simple]) {
        diagContent += `<div class="mem-svg-diagram">${MEDIA.diagrams[currentCard.simple]}</div>`;
      }
      if (currentCard.images && currentCard.images.length > 0) {
        diagContent += currentCard.images.map(imgName => {
          return `<img class="mem-ref-img" src="assets/${imgName}" alt="${escapeHtml(currentCard.title)}" loading="lazy" />`;
        }).join("");
      }
      if (diagramContainer) {
        diagramContainer.innerHTML = diagContent;
        diagramContainer.hidden = !diagContent;
      }
    }

    // Pagination
    root.querySelector("#memPrevBtn").disabled = currentIndex <= 0;
    root.querySelector("#memNextBtn").disabled = currentIndex >= list.length - 1;
    root.querySelector("#memProgressText").textContent = `${currentIndex + 1} / ${list.length}`;

    // Rating buttons state
    root.querySelectorAll(".mem-rate-btn").forEach(b => {
      b.disabled = !state.revealed;
      b.classList.toggle("is-selected", p.rating === b.dataset.rate);
    });

    persist();
  }

  // Event Listeners
  root.addEventListener("click", e => {
    const target = e.target;
    // Category tab
    const catTab = target.closest(".mem-cat-tab");
    if (catTab) {
      state.category = catTab.dataset.category;
      state.revealed = false;
      render();
      return;
    }

    // List item click
    const item = target.closest(".mem-list-item");
    if (item) {
      state.currentId = item.dataset.id;
      state.revealed = false;
      render();
      return;
    }

    // Reveal toggle
    if (target.closest("#memRevealBtn")) {
      state.revealed = !state.revealed;
      render();
      return;
    }

    // Rating buttons
    const rateBtn = target.closest(".mem-rate-btn");
    if (rateBtn && state.revealed && state.currentId) {
      const rating = rateBtn.dataset.rate;
      state.progress[state.currentId] = {
        ...state.progress[state.currentId],
        rating: rating,
      };
      persist();
      // Auto advance to next card
      const list = getFilteredCards();
      const idx = list.findIndex(c => c.id === state.currentId);
      if (idx < list.length - 1) {
        state.currentId = list[idx + 1].id;
        state.revealed = false;
      }
      render();
      return;
    }

    // Favorite toggle
    if (target.closest("#memFavBtn")) {
      const p = state.progress[state.currentId] || {};
      state.progress[state.currentId] = { ...p, favorite: !p.favorite };
      persist();
      render();
      return;
    }

    // Prev / Next
    if (target.closest("#memPrevBtn")) {
      const list = getFilteredCards();
      const idx = list.findIndex(c => c.id === state.currentId);
      if (idx > 0) {
        state.currentId = list[idx - 1].id;
        state.revealed = false;
        render();
      }
      return;
    }
    if (target.closest("#memNextBtn")) {
      const list = getFilteredCards();
      const idx = list.findIndex(c => c.id === state.currentId);
      if (idx < list.length - 1) {
        state.currentId = list[idx + 1].id;
        state.revealed = false;
        render();
      }
      return;
    }

    // Reset filters
    if (target.closest("#memResetBtn")) {
      state.category = "全部";
      state.frequency = "all";
      state.status = "all";
      state.query = "";
      root.querySelector("#memFreqSelect").value = "all";
      root.querySelector("#memStatusSelect").value = "all";
      root.querySelector("#memSearchInput").value = "";
      state.revealed = false;
      render();
      return;
    }

    // Random toggle
    if (target.closest("#memRandomBtn")) {
      state.random = !state.random;
      target.closest("#memRandomBtn").classList.toggle("is-active", state.random);
      render();
      return;
    }
  });

  // Select filters
  const freqSelect = root.querySelector("#memFreqSelect");
  if (freqSelect) {
    freqSelect.addEventListener("change", e => {
      state.frequency = e.target.value;
      state.revealed = false;
      render();
    });
  }

  const statusSelect = root.querySelector("#memStatusSelect");
  if (statusSelect) {
    statusSelect.addEventListener("change", e => {
      state.status = e.target.value;
      state.revealed = false;
      render();
    });
  }

  const searchInput = root.querySelector("#memSearchInput");
  if (searchInput) {
    searchInput.addEventListener("input", e => {
      state.query = e.target.value;
      state.revealed = false;
      render();
    });
  }

  // Keyboard navigation
  window.addEventListener("keydown", e => {
    const isVisible = !root.classList.contains("is-hidden");
    if (!isVisible) return;
    if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;

    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      state.revealed = !state.revealed;
      render();
    } else if (e.key === "ArrowLeft") {
      const list = getFilteredCards();
      const idx = list.findIndex(c => c.id === state.currentId);
      if (idx > 0) {
        state.currentId = list[idx - 1].id;
        state.revealed = false;
        render();
      }
    } else if (e.key === "ArrowRight") {
      const list = getFilteredCards();
      const idx = list.findIndex(c => c.id === state.currentId);
      if (idx < list.length - 1) {
        state.currentId = list[idx + 1].id;
        state.revealed = false;
        render();
      }
    } else if (e.key === "1" && state.revealed) {
      rateCurrent("forgot");
    } else if (e.key === "2" && state.revealed) {
      rateCurrent("uncertain");
    } else if (e.key === "3" && state.revealed) {
      rateCurrent("known");
    }
  });

  function rateCurrent(rating) {
    if (!state.currentId) return;
    state.progress[state.currentId] = {
      ...state.progress[state.currentId],
      rating: rating,
    };
    persist();
    const list = getFilteredCards();
    const idx = list.findIndex(c => c.id === state.currentId);
    if (idx < list.length - 1) {
      state.currentId = list[idx + 1].id;
      state.revealed = false;
    }
    render();
  }

  render();

  return {
    refresh() {
      render();
    }
  };
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}
