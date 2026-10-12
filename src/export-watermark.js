const WATERMARK_TEXT = "材料考研工具箱";

export function downloadCanvasPngWithWatermark(sourceCanvas, filename) {
  const width = sourceCanvas.width;
  const height = sourceCanvas.height;
  if (!width || !height) return;

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = width;
  exportCanvas.height = height;
  const ctx = exportCanvas.getContext("2d");
  ctx.drawImage(sourceCanvas, 0, 0, width, height);
  drawTiltedWatermark(ctx, width, height);

  const link = document.createElement("a");
  link.download = filename;
  link.href = exportCanvas.toDataURL("image/png");
  link.click();
}

export function downloadSvgPngWithWatermark(sourceSvg, filename) {
  const clone = sourceSvg.cloneNode(true);
  inlineSvgStyles(sourceSvg, clone);
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const rect = sourceSvg.viewBox.baseVal;
  const width = Math.round(rect?.width || sourceSvg.getBoundingClientRect().width || 1120);
  const height = Math.round(rect?.height || sourceSvg.getBoundingClientRect().height || 680);
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));

  const svgText = new XMLSerializer().serializeToString(clone);
  const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const image = new Image();

  image.onload = () => {
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = width;
    exportCanvas.height = height;
    const ctx = exportCanvas.getContext("2d");
    ctx.fillStyle = "#fbfdfe";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    drawTiltedWatermark(ctx, width, height);
    URL.revokeObjectURL(url);

    const link = document.createElement("a");
    link.download = filename;
    link.href = exportCanvas.toDataURL("image/png");
    link.click();
  };

  image.onerror = () => {
    URL.revokeObjectURL(url);
  };

  image.src = url;
}

function drawTiltedWatermark(ctx, width, height) {
  const fontSize = clamp(Math.round(width * 0.038), 22, 56);
  ctx.save();
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.PI / 7);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `800 ${fontSize}px "Microsoft YaHei", "PingFang SC", Arial, sans-serif`;
  ctx.lineWidth = Math.max(1.2, fontSize * 0.04);

  const textWidth = ctx.measureText(WATERMARK_TEXT).width;
  const xSpacing = textWidth + fontSize * 3.8;
  const ySpacing = fontSize * 3.8;
  const span = Math.sqrt(width * width + height * height);

  for (let y = -span; y <= span; y += ySpacing) {
    for (let x = -span; x <= span; x += xSpacing) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
      ctx.strokeText(WATERMARK_TEXT, x, y);
      ctx.fillStyle = "rgba(31, 41, 51, 0.085)";
      ctx.fillText(WATERMARK_TEXT, x, y);
    }
  }

  ctx.restore();
}

function inlineSvgStyles(sourceSvg, cloneSvg) {
  const sourceNodes = [sourceSvg, ...sourceSvg.querySelectorAll("*")];
  const cloneNodes = [cloneSvg, ...cloneSvg.querySelectorAll("*")];
  const properties = [
    "fill",
    "fill-opacity",
    "stroke",
    "stroke-width",
    "stroke-opacity",
    "stroke-linecap",
    "stroke-linejoin",
    "opacity",
    "font-family",
    "font-size",
    "font-weight",
    "text-anchor",
    "paint-order",
  ];

  sourceNodes.forEach((node, index) => {
    const clone = cloneNodes[index];
    if (!clone || !(node instanceof Element)) return;
    const computed = window.getComputedStyle(node);
    const styleText = properties
      .map((property) => `${property}:${computed.getPropertyValue(property)}`)
      .join(";");
    clone.setAttribute("style", `${clone.getAttribute("style") || ""};${styleText}`);
  });
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
