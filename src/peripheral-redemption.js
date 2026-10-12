const CLAIM_API_URL = "/api/redemption/claim";

export function initPeripheralRedemptionModule() {
  const els = {
    form: document.querySelector("#redemptionForm"),
    orderInput: document.querySelector("#redemptionOrderInput"),
    submitButton: document.querySelector("#redemptionSubmitButton"),
    feedback: document.querySelector("#redemptionFeedback"),
    result: document.querySelector("#redemptionResult"),
    resultState: document.querySelector("#redemptionResultState"),
    code: document.querySelector("#redemptionCode"),
    copyButton: document.querySelector("#redemptionCopyButton"),
    copyStatus: document.querySelector("#redemptionCopyStatus"),
  };

  if (!els.form || !els.orderInput) return { refresh: () => {} };

  let busy = false;
  let copyResetTimer = 0;

  els.form.addEventListener("submit", handleSubmit);
  els.orderInput.addEventListener("input", () => {
    if (els.feedback.dataset.state === "error") setFeedback("idle", "等待验证");
    hideResult();
  });
  els.copyButton?.addEventListener("click", copyActivationCode);

  return {
    refresh() {
      if (!busy && els.orderInput.matches(":focus")) els.orderInput.select();
    },
  };

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;

    const orderNumber = normalizeOrderNumber(els.orderInput.value);
    els.orderInput.value = orderNumber;
    if (!validOrderNumber(orderNumber)) {
      hideResult();
      setFeedback("error", "订单号输入错误，请核对后重试；仍有问题请联系淘宝客服处理。");
      els.orderInput.focus();
      return;
    }

    setBusy(true);
    hideResult();
    setFeedback("loading", "正在核对订单...");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 12_000);

    try {
      const response = await fetch(CLAIM_API_URL, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber }),
        signal: controller.signal,
      });
      const payload = await readJson(response);
      if (!response.ok || !payload?.ok) {
        showApiError(payload?.code);
        return;
      }

      const activationCode = String(payload.code || "").trim();
      if (!activationCode) throw new Error("empty_activation_code");
      els.code.textContent = activationCode;
      els.resultState.textContent = payload.status === "existing" ? "原激活码已找回" : "领取成功";
      els.copyStatus.textContent = "激活码已与当前订单绑定，请妥善保存。";
      els.result.hidden = false;
      setFeedback("success", payload.status === "existing"
        ? "该订单已经领取过，已返回原激活码。"
        : "订单验证通过，激活码领取成功。");
    } catch (error) {
      const timeoutMessage = error?.name === "AbortError" ? "请求超时，请稍后重试。" : "领取服务暂未连接，请稍后重试或联系淘宝客服处理。";
      setFeedback("error", timeoutMessage);
    } finally {
      window.clearTimeout(timeout);
      setBusy(false);
    }
  }

  function showApiError(code) {
    const messages = {
      invalid_order: "订单号输入错误，请核对后重试；仍有问题请联系淘宝客服处理。",
      code_pool_exhausted: "当前激活码已领完，请联系淘宝客服处理。",
      rate_limited: "操作过于频繁，请稍后再试。",
      service_unavailable: "领取服务暂未开放，请联系淘宝客服处理。",
    };
    setFeedback("error", messages[code] || "领取失败，请稍后重试或联系淘宝客服处理。");
  }

  async function copyActivationCode() {
    const activationCode = els.code.textContent.trim();
    if (!activationCode) return;
    try {
      if (navigator.clipboard?.writeText) {
        try { await navigator.clipboard.writeText(activationCode); }
        catch { fallbackCopy(activationCode); }
      } else {
        fallbackCopy(activationCode);
      }
      window.clearTimeout(copyResetTimer);
      els.copyButton.textContent = "已复制";
      els.copyStatus.textContent = "已复制到剪贴板。";
      copyResetTimer = window.setTimeout(() => {
        els.copyButton.textContent = "一键复制";
        els.copyStatus.textContent = "激活码已与当前订单绑定，请妥善保存。";
      }, 1800);
    } catch {
      els.copyStatus.textContent = "复制失败，请长按激活码手动复制。";
    }
  }

  function setBusy(value) {
    busy = value;
    els.form.setAttribute('aria-busy', String(value));
    els.submitButton.disabled = value;
    els.orderInput.readOnly = value;
    els.submitButton.textContent = value ? "核对中..." : "领取激活码";
  }

  function setFeedback(state, message) {
    els.feedback.dataset.state = state;
    els.feedback.textContent = message;
  }

  function hideResult() {
    window.clearTimeout(copyResetTimer);
    els.result.hidden = true;
    els.code.textContent = "";
    els.copyButton.textContent = "一键复制";
    els.copyStatus.textContent = "";
  }
}

function normalizeOrderNumber(value) {
  return String(value || "").normalize("NFKC").replace(/\s+/g, "").trim();
}

function validOrderNumber(value) {
  return value.length >= 6 && value.length <= 64 && /^[0-9A-Za-z_-]+$/.test(value);
}

async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function fallbackCopy(value) {
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("copy_failed");
}
