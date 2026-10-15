export function initHomeOverviewModule(selectModuleFn) {
  const root = document.querySelector("#homeOverviewModule");
  if (!root) return { refresh: () => {} };

  // Jump buttons delegation for robust mobile & desktop click handling
  root.addEventListener("click", (e) => {
    const navBtn = e.target.closest("[data-nav-target]");
    if (navBtn) {
      e.preventDefault();
      const target = navBtn.dataset.navTarget;
      if (selectModuleFn && target) {
        selectModuleFn(target, true);
      }
      return;
    }

    // Tapping a card navigates directly to its primary tool
    const card = e.target.closest(".home-card");
    if (card && !e.target.closest("button") && !e.target.closest("a")) {
      const allNavBtns = card.querySelectorAll("[data-nav-target]");
      if (allNavBtns.length >= 1) {
        e.preventDefault();
        const target = allNavBtns[0].dataset.navTarget;
        if (selectModuleFn && target) {
          selectModuleFn(target, true);
        }
      }
    }
  });

  return {
    refresh() {}
  };
}
