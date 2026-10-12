// Put the complete label rectangle beside the projected arrow, even when foreshortened.
export function arrowLabelPosition(start, end, width, height, clearance = 10, side = 1) {
  const dx = end.x - start.x, dy = end.y - start.y, length = Math.hypot(dx, dy);
  const nx = length > 0.01 ? -dy / length : 1;
  const ny = length > 0.01 ? dx / length : 0;
  const distance = Math.abs(nx) * width / 2 + Math.abs(ny) * height / 2 + clearance;
  return { x: (start.x + end.x) / 2 + nx * distance * side,
    y: (start.y + end.y) / 2 + ny * distance * side };
}

export function labelRectangle(point, width, height, padding = 0) {
  return { left: point.x - width / 2 - padding, right: point.x + width / 2 + padding,
    top: point.y - height / 2 - padding, bottom: point.y + height / 2 + padding };
}

export function rectangleIntersectsSegment(rect, start, end) {
  let low = 0, high = 1;
  for (const [axis, min, max] of [['x', 'left', 'right'], ['y', 'top', 'bottom']]) {
    const delta = end[axis] - start[axis];
    if (Math.abs(delta) < 1e-8) {
      if (start[axis] < rect[min] || start[axis] > rect[max]) return false;
    } else {
      const a = (rect[min] - start[axis]) / delta, b = (rect[max] - start[axis]) / delta;
      low = Math.max(low, Math.min(a, b));
      high = Math.min(high, Math.max(a, b));
      if (low > high) return false;
    }
  }
  return true;
}

export function chooseLabelPosition(candidates, width, height, occupied, arrows, viewport) {
  const fits = rect => rect.left >= 3 && rect.right <= viewport.width - 3 && rect.top >= 3 && rect.bottom <= viewport.height - 3;
  const overlap = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  return candidates.find(point => {
    const rect = labelRectangle(point, width, height, 4);
    return fits(rect) && !occupied.some(box => overlap(rect, box))
      && !arrows.some(arrow => rectangleIntersectsSegment(rect, arrow.start, arrow.end));
  }) || candidates.find(point => fits(labelRectangle(point, width, height))) || candidates[0];
}
