export function initHomeOverviewModule(selectModuleFn) {
  const root = document.querySelector("#homeOverviewModule");
  if (!root) return { refresh: () => {} };

  // Expand / collapse submenu buttons
  root.querySelectorAll(".home-sub-toggle").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.target;
      const menu = root.querySelector(`#${targetId}`);
      if (!menu) return;
      const isHidden = menu.hidden;
      menu.hidden = !isHidden;
      btn.textContent = isHidden ? "收起二级菜单 -" : "展开二级菜单 +";
    });
  });

  // Jump buttons
  root.querySelectorAll("[data-nav-target]").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.navTarget;
      if (selectModuleFn) selectModuleFn(target, true);
    });
  });

  return {
    refresh() {}
  };
}
