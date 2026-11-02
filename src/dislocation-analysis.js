const EPS = 1e-8;
const DIRECTION_TOLERANCE = 1e-5;

export const DISLOCATION_STAGES = [
  {
    key: "initial",
    index: 0,
    progress: 0,
    label: "起始",
    title: "起始位置",
    caption: "A 沿 v 方向滑移，B 固定。",
  },
  {
    key: "cross",
    index: 1,
    progress: 0.55,
    label: "交割",
    title: "交割",
    caption: "相交处分别引入平行于另一条柏氏矢量的台阶段。",
  },
  {
    key: "result",
    index: 2,
    progress: 1,
    label: "结果",
    title: "交割结果",
    caption: "根据台阶段是否位于原滑移面内判定缺陷。",
  },
];

export function parseDirection(value, label = "方向") {
  if (Array.isArray(value)) {
    return validateVector(value.map(Number), label);
  }

  const cleaned = String(value ?? "")
    .replace(/[\[\](){}<>]/g, " ")
    .replace(/[，,；;]/g, " ")
    .replace(/[−–—]/g, "-")
    .trim();
  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length !== 3) {
    throw new Error(`${label}需要 3 个分量，例如 1 0 -1`);
  }

  return validateVector(tokens.map((token) => parseComponent(token, label)), label);
}

export function classifyDislocationCharacter(line, burgers) {
  const xi = validateVector(line.map(Number), "位错线方向");
  const b = validateVector(burgers.map(Number), "柏氏矢量");
  const cosine = Math.abs(dot(xi, b)) / (norm(xi) * norm(b));
  if (1 - cosine <= DIRECTION_TOLERANCE) return "screw";
  if (cosine <= DIRECTION_TOLERANCE) return "edge";
  return "mixed";
}

export function deriveSlipPlaneNormal(line, burgers, fallback = null) {
  const xi = validateVector(line.map(Number), "位错线方向");
  const b = validateVector(burgers.map(Number), "柏氏矢量");
  const normal = cross(xi, b);
  if (norm(normal) > EPS) return reduceDirection(normal);

  if (fallback) {
    const candidate = validateVector(fallback.map(Number), "滑移面法向");
    if (Math.abs(dot(candidate, xi)) / (norm(candidate) * norm(xi)) <= DIRECTION_TOLERANCE) {
      return reduceDirection(candidate);
    }
  }

  const axis = leastParallelAxis(xi);
  return reduceDirection(cross(xi, axis));
}

export function glideDirection(line, plane) {
  const xi = validateVector(line.map(Number), "位错线方向");
  const n = validateVector(plane.map(Number), "滑移面法向");
  if (normalizedDot(n, xi) > DIRECTION_TOLERANCE) throw new Error("位错线不在滑移面内，无法确定面内运动方向。");
  const velocity = cross(n, xi), length = norm(velocity);
  return velocity.map(value => value / length);
}

export function analyzeDislocationPair(input) {
  const a = normalizeDislocation(input.a, "A");
  const b = normalizeDislocation(input.b, "B");
  validateIntersectionGeometry(a, b);
  const resultA = analyzeHost(a, b, "A", "B", "b₂");
  const resultB = analyzeHost(b, a, "B", "A", "b₁");

  return {
    a,
    b,
    resultA,
    resultB,
    warnings: [],
    summary: `A：${resultA.kindLabel} · B：${resultB.kindLabel}`,
  };
}

export function formatDirection(vector) {
  return `[${vector.map(formatComponent).join(" ")}]`;
}

export function characterLabel(character) {
  return {
    edge: "刃型",
    screw: "螺型",
    mixed: "混合型",
  }[character] || "未知";
}

function normalizeDislocation(input, label) {
  const line = parseDirection(input.line, `位错 ${label} 的位错线方向`);
  const burgers = parseDirection(input.burgers, `位错 ${label} 的柏氏矢量`);
  const character = classifyDislocationCharacter(line, burgers);
  const plane = input.plane
    ? parseDirection(input.plane, `位错 ${label} 的滑移面法向`)
    : deriveSlipPlaneNormal(line, burgers);
  const linePlaneDeviation = normalizedDot(plane, line);
  const burgersPlaneDeviation = normalizedDot(plane, burgers);
  const errors = [];

  if (linePlaneDeviation > DIRECTION_TOLERANCE) {
    errors.push(`位错 ${label} 的位错线 ξ${subscript(label)} 不在所设滑移面内。`);
  }
  if (burgersPlaneDeviation > DIRECTION_TOLERANCE) {
    errors.push(`位错 ${label} 的柏氏矢量 b${subscript(label)} 不在所设滑移面内。`);
  }
  if (errors.length) throw new Error(`${errors.join(" ")} 请调整滑移面法向。`);

  return {
    label,
    line,
    burgers,
    plane,
    motion: glideDirection(line, plane),
    character,
    warnings: [],
  };
}

function validateIntersectionGeometry(a, b) {
  const lineSine = norm(cross(a.line, b.line)) / (norm(a.line) * norm(b.line));
  if (lineSine <= DIRECTION_TOLERANCE) {
    throw new Error("ξ₁ 与 ξ₂ 平行，不能形成单一交割点，请调整位错线方向。");
  }

  const planeSine = norm(cross(a.plane, b.plane)) / (norm(a.plane) * norm(b.plane));
  if (planeSine <= DIRECTION_TOLERANCE) {
    throw new Error("Π₁ 与 Π₂ 重合或平行，不属于两个不同滑移面上的位错交割。");
  }
}

function analyzeHost(host, other, hostLabel, otherLabel, stepSymbol) {
  const step = other.burgers.slice();
  const lineSine = norm(cross(host.line, step)) / (norm(host.line) * norm(step));
  const planeDeviation = normalizedDot(host.plane, step);
  const stepCharacter = classifyDislocationCharacter(step, host.burgers);

  let kind;
  if (lineSine <= DIRECTION_TOLERANCE) {
    kind = "unchanged";
  } else if (planeDeviation <= DIRECTION_TOLERANCE) {
    kind = "kink";
  } else {
    kind = "jog";
  }

  const kindLabel = {
    unchanged: "线形不变",
    kink: "扭折",
    jog: "割阶",
  }[kind];

  return {
    hostLabel,
    otherLabel,
    kind,
    kindLabel,
    step,
    stepSymbol,
    stepCharacter,
    planeDeviation,
    lineSine,
    relation: relationText(kind, hostLabel, stepSymbol),
    mobility: mobilityText(kind, host.character),
  };
}

function relationText(kind, hostLabel, stepSymbol) {
  if (kind === "unchanged") {
    return `${stepSymbol} 与 ξ${subscript(hostLabel)} 平行，台阶段和原位错线重合。`;
  }
  if (kind === "kink") {
    return `n${subscript(hostLabel)} · ${stepSymbol} = 0，台阶段仍在原滑移面内。`;
  }
  return `n${subscript(hostLabel)} · ${stepSymbol} ≠ 0，台阶段离开原滑移面。`;
}

function mobilityText(kind, hostCharacter) {
  if (kind === "unchanged") return "交割后位错线方向不发生可见改变。";
  if (kind === "kink") return "扭折仍在原滑移面内，通常可在线张力作用下移动或消失。";
  if (hostCharacter === "screw") {
    return "螺型位错上的割阶会阻碍继续滑移；割阶随位错运动需要攀移，并可能留下空位或间隙原子。";
  }
  if (hostCharacter === "edge") {
    return "基本割阶通常只有一个原子间距，常可随刃型位错一道移动；较长割阶仍会增加滑移阻力。";
  }
  return "割阶使位错离开原滑移面，通常增加运动阻力；其刃型分量可能需要攀移。";
}

function parseComponent(token, label) {
  const fraction = token.match(/^([+-]?(?:\d+(?:\.\d+)?|\.\d+))\/([+-]?(?:\d+(?:\.\d+)?|\.\d+))$/);
  if (fraction) {
    const denominator = Number(fraction[2]);
    if (Math.abs(denominator) < EPS) throw new Error(`${label}中不能出现分母 0`);
    return Number(fraction[1]) / denominator;
  }
  const value = Number(token);
  if (!Number.isFinite(value)) throw new Error(`${label}包含无法识别的分量“${token}”`);
  return value;
}

function validateVector(vector, label) {
  if (vector.length !== 3 || !vector.every(Number.isFinite)) {
    throw new Error(`${label}需要 3 个有效分量`);
  }
  if (norm(vector) < EPS) throw new Error(`${label}不能为零矢量`);
  return vector;
}

function normalizedDot(a, b) {
  return Math.abs(dot(a, b)) / (norm(a) * norm(b));
}

function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function norm(vector) {
  return Math.hypot(...vector);
}

function leastParallelAxis(vector) {
  const unit = vector.map((value) => value / norm(vector));
  const axes = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  return axes.reduce((best, axis) => (
    Math.abs(dot(unit, axis)) < Math.abs(dot(unit, best)) ? axis : best
  ), axes[0]);
}

function reduceDirection(vector) {
  const cleaned = vector.map((value) => (Math.abs(value) < EPS ? 0 : value));
  if (cleaned.every((value) => Math.abs(value - Math.round(value)) < 1e-7)) {
    const integers = cleaned.map(Math.round);
    const divisor = integers.reduce((value, item) => gcd(value, Math.abs(item)), 0) || 1;
    const reduced = integers.map((value) => value / divisor);
    const first = reduced.find((value) => value !== 0) || 1;
    return first < 0 ? reduced.map((value) => -value) : reduced;
  }
  const scale = Math.max(...cleaned.map(Math.abs)) || 1;
  const reduced = cleaned.map((value) => Number((value / scale).toFixed(4)));
  const first = reduced.find((value) => Math.abs(value) > EPS) || 1;
  return first < 0 ? reduced.map((value) => -value) : reduced;
}

function gcd(a, b) {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) [x, y] = [y, x % y];
  return x;
}

function formatComponent(value) {
  if (Math.abs(value - Math.round(value)) < 1e-7) return String(Math.round(value));
  return String(Number(value.toFixed(3)));
}

function subscript(label) {
  return label === "A" ? "₁" : "₂";
}
