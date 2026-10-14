// Textbook topology, not fitted thermodynamic data. All temperatures are normalized.
// Adjacent fields share the same vertices in each isothermal section.
const A = [1, 0, 0], B = [0, 1, 0], C = [0, 0, 1];
const LOW = 0.04, TOP = 1.02;
const PHASES = {
  L: ['L', 0x38bdf8], a: ['α', 0x0284c7], b: ['β', 0xd97706], g: ['γ', 0x7c3aed],
  La: ['L + α', 0x0284c7], Lb: ['L + β', 0xd97706], Lg: ['L + γ', 0x7c3aed],
  ab: ['α + β', 0x10b981], ag: ['α + γ', 0x3b82f6], bg: ['β + γ', 0xf43f5e],
  Lab: ['L + α + β', 0x06b6d4], Lag: ['L + α + γ', 0x0f766e], Lbg: ['L + β + γ', 0xea580c],
  abg: ['α + β + γ', 0x8b5cf6], Labg: ['L + α + β + γ', 0xef4444],
};
const mix = (a, b, u) => a.map((v, i) => v + (b[i] - v) * u);
const fraction = (t, high, low) => Math.max(0, Math.min(1, (high - t) / (high - low)));
const p = (b, t) => ({ b: [...b], t });
const along = (a, b, t, high, low) => mix(a, b, fraction(t, high, low));
const liquidAlong = (a, b, t, high, low) => mix(a, b, fraction(t, high, low) ** 0.60);
export const TRANSITION_T = 0.40;
export const TRANSITION_COMPOSITIONS = {
  a: [0.62, 0.30, 0.08], b: [0.16, 0.76, 0.08],
  L: [0.18, 0.34, 0.48], g: [0.52, 0.12, 0.36],
};

export const FOUR_PHASE_PERITECTIC_T = 0.44;
export const FOUR_PHASE_PERITECTIC_COMPOSITIONS = {
  a: [0.70, 0.24, 0.06], b: [0.18, 0.76, 0.06], L: [0.14, 0.24, 0.62],
  g: [0.3068, 0.3700, 0.3232], // 0.28 alpha + 0.25 beta + 0.47 liquid.
};
const PERITECTIC_BINARY = {
  a1: [0.85, 0.15, 0], b1: [0.12, 0.88, 0], e1: [0.48, 0.52, 0],
  a2: [0.80, 0, 0.20], c2: [0.48, 0, 0.52], p2: [0.30, 0, 0.70],
  b2: [0, 0.78, 0.22], c3: [0, 0.46, 0.54], p3: [0, 0.28, 0.72],
};

// AB is eutectic; AC and BC are peritectic. Gamma first appears inside the
// alpha-beta-liquid tie triangle, then three lower-temperature tie triangles separate.
export function fourPhasePeritecticSection(t, level = t) {
  const TA = 0.98, TB = 0.79, TE = 0.64, TP = FOUR_PHASE_PERITECTIC_T;
  const T2 = 0.31, T3 = 0.27, TC = 0.15;
  const P = FOUR_PHASE_PERITECTIC_COMPOSITIONS, E = PERITECTIC_BINARY;
  if (level >= TA) return { L: [A, B, C] };
  const acs = along(A, E.a2, t, TA, T2), acl = liquidAlong(A, E.p2, t, TA, T2);
  const bcs = along(B, E.b2, t, TB, T3), bcl = liquidAlong(B, E.p3, t, TB, T3);
  if (level >= TE) {
    const aa = along(A, E.a1, t, TA, TE), al = liquidAlong(A, E.e1, t, TA, TE);
    const ba = along(B, E.b1, t, TB, TE), bl = liquidAlong(B, E.e1, t, TB, TE);
    return { a: [A, aa, acs], b: [ba, B, bcs],
      La: [aa, al, acl, acs], Lb: [bl, ba, bcs, bcl], L: [al, bl, bcl, C, acl] };
  }
  const aa = along(E.a1, [0.96, 0.04, 0], t, TE, LOW);
  const ba = along(E.b1, [0.04, 0.96, 0], t, TE, LOW);
  if (level >= TP) {
    const a = along(E.a1, P.a, t, TE, TP), b = along(E.b1, P.b, t, TE, TP);
    const l = liquidAlong(E.e1, P.L, t, TE, TP);
    return { a: [A, aa, a, acs], b: [ba, B, bcs, b], ab: [aa, ba, b, a],
      Lab: [a, b, l], La: [a, l, acl, acs], Lb: [b, bcs, bcl, l], L: [l, bcl, C, acl] };
  }
  const a = along(P.a, [0.86, 0.08, 0.06], t, TP, LOW);
  const b = along(P.b, [0.08, 0.86, 0.06], t, TP, LOW);
  const g = along(P.g, [0.08, 0.08, 0.84], t, TP, LOW);
  const fields = { ab: [aa, ba, b, a], abg: [a, b, g] };
  let gammaLeft, gammaRight, solidLeft, solidRight, liquidLeft, liquidRight;
  if (level >= T2) {
    const a2 = along(P.a, E.a2, t, TP, T2);
    gammaLeft = solidLeft = along(P.g, E.c2, t, TP, T2);
    liquidLeft = liquidAlong(P.L, E.p2, t, TP, T2);
    Object.assign(fields, { a: [A, aa, a, a2, acs], ag: [a, g, gammaLeft, a2],
      Lag: [a2, liquidLeft, gammaLeft], La: [a2, liquidLeft, acl, acs] });
  } else {
    const ca = along(E.a2, [0.94, 0, 0.06], t, T2, LOW);
    gammaLeft = along(E.c2, [0.16, 0, 0.84], t, T2, LOW);
    solidLeft = along(E.c2, C, t, T2, TC);
    liquidLeft = mix(C, E.p2, (1 - fraction(t, T2, TC)) ** 1.1);
    Object.assign(fields, { a: [A, aa, a, ca], ag: [ca, a, g, gammaLeft] });
  }
  if (level >= T3) {
    const b2 = along(P.b, E.b2, t, TP, T3);
    gammaRight = solidRight = along(P.g, E.c3, t, TP, T3);
    liquidRight = liquidAlong(P.L, E.p3, t, TP, T3);
    Object.assign(fields, { b: [ba, B, bcs, b2, b], bg: [b, b2, gammaRight, g],
      Lbg: [b2, gammaRight, liquidRight], Lb: [b2, bcs, bcl, liquidRight] });
  } else {
    const cb = along(E.b2, [0, 0.94, 0.06], t, T3, LOW);
    gammaRight = along(E.c3, [0, 0.16, 0.84], t, T3, LOW);
    solidRight = along(E.c3, C, t, T3, TC);
    liquidRight = mix(C, E.p3, (1 - fraction(t, T3, TC)) ** 1.1);
    Object.assign(fields, { b: [ba, B, cb, b], bg: [b, cb, gammaRight, g] });
  }
  if (level < TC) return { ...fields, g: [gammaLeft, g, gammaRight, C] };
  return { ...fields,
    g: [gammaLeft, g, gammaRight, ...(level < T3 ? [solidRight] : []), ...(level < T2 ? [solidLeft] : [])],
    Lg: [solidLeft, liquidLeft, liquidRight, solidRight],
    L: [liquidLeft, liquidRight, ...(level >= T3 ? [bcl] : []), C, ...(level >= T2 ? [acl] : [])] };
}

export function eutecticIsomorphousSection(t, level = t) {
  const TA = 0.90, TB = 1, TC = 0.55, TE = 0.72, TE1 = 0.34;
  if (level >= TB) return { L: [A, B, C] };
  const qB = fraction(t, TB, TE1);
  const bs = mix(B, [0, 0.84, 0.16], qB);
  const bl = mix(B, [0, 0.50, 0.50], qB ** 0.65);
  const qAC = fraction(t, TA, TC);
  const acs = mix(A, C, qAC ** 1.25), acl = mix(A, C, qAC ** 0.60);
  if (level >= TE) {
    const aa = along(A, [0.88, 0.12, 0], t, TA, TE);
    const al = liquidAlong(A, [0.52, 0.48, 0], t, TA, TE);
    const ba = along(B, [0.12, 0.88, 0], t, TB, TE);
    const lb = liquidAlong(B, [0.52, 0.48, 0], t, TB, TE);
    return { a: [A, aa, acs], b: [ba, B, bs],
      La: [aa, al, acl, acs], Lb: [lb, ba, bs, bl], L: [al, lb, bl, C, acl] };
  }
  const aa = along([0.88, 0.12, 0], [0.95, 0.05, 0], t, TE, LOW);
  const ba = along([0.12, 0.88, 0], [0.05, 0.95, 0], t, TE, LOW);
  if (level < TE1) {
    const as = along([0, 0.16, 0.84], [0, 0.06, 0.94], t, TE1, LOW);
    const b0 = along([0, 0.84, 0.16], [0, 0.95, 0.05], t, TE1, LOW);
    return { a: [A, aa, as, C], b: [ba, B, b0], ab: [aa, ba, b0, as] };
  }
  const a = along([0.88, 0.12, 0], [0, 0.16, 0.84], t, TE, TE1);
  const b = along([0.12, 0.88, 0], [0, 0.84, 0.16], t, TE, TE1);
  const l = along([0.52, 0.48, 0], [0, 0.50, 0.50], t, TE, TE1);
  const valley = fraction(t, TE, TE1);
  const bow = 0.50 * valley * (1 - valley);
  l[0] -= bow;
  l[2] += bow;
  const fields = { b: [ba, B, bs, b], ab: [aa, ba, b, a], Lab: [a, b, l], Lb: [b, bs, bl, l] };
  if (level >= TC) return { ...fields,
    a: [A, aa, a, acs], La: [a, l, acl, acs], L: [l, bl, C, acl] };
  const qC = fraction(t, TC, TE1);
  const cs = mix(C, [0, 0.16, 0.84], qC), cl = mix(C, [0, 0.50, 0.50], qC ** 0.65);
  return { ...fields, a: [A, aa, a, cs, C], La: [a, l, cl, cs], L: [l, bl, cl] };
}

export function peritecticEutecticSection(t, level = t) {
  const TA = 0.98, T1 = 0.78, T2 = 0.62, TB = 0.54, TP = TRANSITION_T, TC = 0.25, TE = 0.15;
  const P = TRANSITION_COMPOSITIONS;
  if (level >= TA) return { L: [A, B, C] };
  const acA2 = [0.80, 0, 0.20], acG2 = [0.55, 0, 0.45], acL2 = [0.34, 0, 0.66];
  const abA1 = [0.82, 0.18, 0], abB1 = [0.55, 0.45, 0], abL1 = [0.30, 0.70, 0];
  const acs = along(A, acA2, t, TA, T2), acl = liquidAlong(A, acL2, t, TA, T2);
  if (level >= T1) {
    const abs = along(A, abA1, t, TA, T1), abl = liquidAlong(A, abL1, t, TA, T1);
    return { a: [A, abs, acs], La: [abs, abl, acl, acs], L: [abl, B, C, acl] };
  }
  const aa = level >= TP ? along(abA1, [0.9, 0.1, 0], t, T1, TP)
    : along([0.9, 0.1, 0], [0.96, 0.04, 0], t, TP, LOW);
  const ba = level >= TP ? along(abB1, [0.2, 0.8, 0], t, T1, TP)
    : along([0.2, 0.8, 0], [0.08, 0.92, 0], t, TP, LOW);
  const ca = level >= TP ? along(acA2, [0.9, 0, 0.1], t, T2, TP)
    : along([0.9, 0, 0.1], [0.96, 0, 0.04], t, TP, LOW);
  const ga = level >= TP ? along(acG2, [0.32, 0, 0.68], t, T2, TP)
    : along([0.32, 0, 0.68], [0.12, 0, 0.88], t, TP, LOW);
  const betaEnd = [0, 0.84, 0.16], gammaEnd = [0, 0.20, 0.80], liquidEnd = [0, 0.49, 0.51];
  const bs = level >= TB ? along(abB1, B, t, T1, TB) : along(B, betaEnd, t, TB, TE);
  // Retrograde liquidus branches bow above their chord in a binary T-composition plot.
  const bl = level >= TB ? mix(B, abL1, (1 - fraction(t, T1, TB)) ** 1.35) : mix(B, liquidEnd, fraction(t, TB, TE) ** 0.65);
  const gs = level >= TC ? along(acG2, C, t, T2, TC) : along(C, gammaEnd, t, TC, TE);
  const gl = level >= TC ? mix(C, acL2, (1 - fraction(t, T2, TC)) ** 1.35) : mix(C, liquidEnd, fraction(t, TC, TE) ** 0.65);
  if (level >= TP) {
    const a1 = along(abA1, P.a, t, T1, TP), b = along(abB1, P.b, t, T1, TP);
    const l1 = liquidAlong(abL1, P.L, t, T1, TP);
    const fields = { ab: [aa, ba, b, a1], Lab: [a1, b, l1],
      b: level >= TB ? [ba, bs, b] : [ba, B, bs, b], Lb: [b, bs, bl, l1] };
    if (level >= T2) return { ...fields, a: [A, aa, a1, acs], La: [a1, l1, acl, acs], L: [l1, bl, B, C, acl] };
    const a2 = along(acA2, P.a, t, T2, TP), g = along(acG2, P.g, t, T2, TP);
    const l2 = liquidAlong(acL2, P.L, t, T2, TP);
    return { ...fields, a: [A, aa, a1, a2, ca], La: [a1, l1, l2, a2],
      ag: [ca, a2, g, ga], g: [ga, g, gs], Lag: [a2, l2, g], Lg: [g, l2, gl, gs],
      L: level >= TB ? [l1, bl, B, C, gl, l2] : [l1, bl, C, gl, l2] };
  }
  const a = along(P.a, [0.82, 0.11, 0.07], t, TP, LOW);
  const b = level >= TE ? along(P.b, betaEnd, t, TP, TE)
    : along(betaEnd, [0.05, 0.88, 0.07], t, TE, LOW);
  const g = level >= TE ? along(P.g, gammaEnd, t, TP, TE)
    : along(gammaEnd, [0.06, 0.10, 0.84], t, TE, LOW);
  const fields = { a: [A, aa, a, ca], ab: [aa, ba, b, a], ag: [ca, a, g, ga], abg: [a, b, g] };
  if (level < TE) {
    const b0 = along(betaEnd, [0, 0.93, 0.07], t, TE, LOW);
    const g0 = along(gammaEnd, [0, 0.08, 0.92], t, TE, LOW);
    return { ...fields, b: [ba, B, b0, b], g: [ga, g, g0, C], bg: [b, b0, g0, g] };
  }
  const l = liquidAlong(P.L, liquidEnd, t, TP, TE);
  return { ...fields, b: [ba, B, bs, b], Lb: [b, bs, bl, l], Lbg: [b, l, g],
    g: level >= TC ? [ga, g, gs] : [ga, g, gs, C], Lg: [g, l, gl, gs],
    L: level >= TC ? [l, bl, C, gl] : [l, bl, gl] };
}

export function polygonArea(vertices) {
  return Math.abs(vertices.reduce((sum, a, i) => {
    const b = vertices[(i + 1) % vertices.length];
    return sum + a[1] * b[2] - a[2] * b[1];
  }, 0)) / 2;
}

const CURVE_STEPS = 12;
const TEMPERATURE_STEPS = 28;
const baryKey = bary => bary.map(value => value.toFixed(10)).join(',');
const edgeKey = (a, b) => [baryKey(a), baryKey(b)].sort().join('|');

function liquidusPlan(fields) {
  const liquidEdges = new Set((fields.L || []).map((a, i, polygon) => edgeKey(a, polygon[(i + 1) % polygon.length])));
  const interfaces = new Set();
  for (const key of ['La', 'Lb', 'Lg']) {
    (fields[key] || []).forEach((a, i, polygon) => {
      const edge = edgeKey(a, polygon[(i + 1) % polygon.length]);
      if (liquidEdges.has(edge)) interfaces.add(edge);
    });
  }
  return Object.fromEntries(Object.entries(fields).map(([key, polygon]) => [key,
    polygon.map((a, i) => (key === 'L' || ['La', 'Lb', 'Lg'].includes(key))
      && interfaces.has(edgeKey(a, polygon[(i + 1) % polygon.length])))]));
}

function polygonCentroid(polygon) {
  let area = 0, x = 0, y = 0;
  polygon.forEach((a, i) => {
    const b = polygon[(i + 1) % polygon.length], cross = a[1] * b[2] - b[1] * a[2];
    area += cross;
    x += (a[1] + b[1]) * cross;
    y += (a[2] + b[2]) * cross;
  });
  if (Math.abs(area) < 1e-12) return null;
  x /= 3 * area;
  y /= 3 * area;
  return [1 - x - y, x, y];
}

function liquidusControl(start, end, center, polygon) {
  const midpoint = mix(start, end, 0.5);
  const tangent = end.map((v, i) => v - start[i]);
  const length = Math.hypot(...tangent);
  if (!center || length < 1e-12) return midpoint;
  let normal = [tangent[2] - tangent[1], tangent[0] - tangent[2], tangent[1] - tangent[0]];
  const direction = Math.sign(normal.reduce((s, v, i) => s + v * (center[i] - midpoint[i]), 0));
  normal = normal.map(v => v * direction / Math.hypot(...normal));
  const cross = (a, b) => a[1] * b[2] - a[2] * b[1];
  const winding = Math.sign(polygon.reduce((s, a, i) => s + cross(a, polygon[(i + 1) % polygon.length]), 0));
  let distance = 0.08 * length;
  polygon.forEach((a, i) => {
    const edge = polygon[(i + 1) % polygon.length].map((v, j) => v - a[j]);
    const rate = winding * cross(edge, normal);
    if (rate < -1e-12) {
      const clearance = winding * cross(edge, midpoint.map((v, j) => v - a[j]));
      distance = Math.min(distance, Math.max(0, clearance / -rate) * 0.9);
    }
  });
  return midpoint.map((v, i) => v + normal[i] * distance);
}

// Curve only liquid/solid-liquid interfaces. Tie triangles and invariant faces stay straight.
// Both owners reuse the same Bezier arc, including its sampling order in reverse.
function curveSection(fields, plan = liquidusPlan(fields)) {
  const center = polygonCentroid(fields.L || []);
  const arcs = new Map();
  const rings = {}, curvedFields = {};
  for (const [key, polygon] of Object.entries(fields)) {
    rings[key] = polygon.map((a, i) => {
      const b = polygon[(i + 1) % polygon.length];
      if (!plan[key][i]) return [a, b];
      const id = edgeKey(a, b), forward = baryKey(a) <= baryKey(b);
      if (!arcs.has(id)) {
        const start = forward ? a : b, end = forward ? b : a;
        const control = liquidusControl(start, end, center, fields.L);
        arcs.set(id, Array.from({ length: CURVE_STEPS + 1 }, (_, j) => {
          const u = j / CURVE_STEPS;
          return mix(mix(start, control, u), mix(control, end, u), u);
        }));
      }
      return forward ? arcs.get(id) : [...arcs.get(id)].reverse();
    });
    curvedFields[key] = rings[key].flatMap(arc => arc.slice(0, -1));
  }
  return { fields: curvedFields, rings };
}

function sectionFields(sampler, t, id, invariant) {
  const exact = invariant && Math.abs(t - invariant.temp) < 1e-8;
  let fields = sampler(t);
  if (exact) {
    fields = { ...sampler(t, t - 1e-6) };
    for (const key of invariant.replacedFields || ['abg', 'Lbg']) delete fields[key];
    fields.Labg = invariant.polygon;
  }
  return Object.entries(fields).filter(([, polygon]) => polygonArea(polygon) > 1e-9).map(([key, polygon]) => ({
    id: `${id}-${key}`, phase: PHASES[key][0], color: PHASES[key][1], polygon,
  }));
}

// Sweep a shared polygon partition; the 3D model and the isothermal sections use one source.
function buildDiagram({ id, title, shortTitle, subtitle, temperatures, sampler, notes, guides, invariant, checkpoints, axisTemps, regionIds = {}, phaseLabels = {} }) {
  const regions = new Map();
  for (let segment = 0; segment < temperatures.length - 1; segment++) {
    const high = temperatures[segment], low = temperatures[segment + 1], level = (high + low) / 2;
    const plan = liquidusPlan(sampler(level));
    const rows = Array.from({ length: TEMPERATURE_STEPS + 1 }, (_, i) => {
      const t = high + (low - high) * i / TEMPERATURE_STEPS;
      return { t, ...curveSection(sampler(t, level), plan) };
    });
    for (const key of Object.keys(rows[0].fields)) {
      if (rows.every(row => polygonArea(row.fields[key]) < 1e-9)) continue;
      if (!regions.has(key)) {
        const [defaultPhase, color] = PHASES[key], phase = phaseLabels[key] || defaultPhase;
        const count = phase.split(' + ').length;
        regions.set(key, { id: regionIds[key] || `${id}-${key}`, key, title: phase, phase, color,
          kind: count === 1 ? '单相区' : count === 2 ? '两相区' : '三相平衡区',
          shape: count === 3 ? '等温共轭三角形沿反应曲线扫成的曲边三棱柱' : '与相邻相区共用边界的曲面体',
          temperature: '归一化温度 T；定性教材模型', composition: subtitle,
          note: notes[key] || `${phase} 平衡共存。成分边界为教材拓扑示意，不对应某种实际合金的定量数据。`,
          vertices: [], faces: [], edgeSegments: [], caps: [], liquidusFaces: [], surfaceContours: [],
        });
      }
      const region = regions.get(key), offset = region.vertices.length, count = rows[0].fields[key].length;
      rows.forEach(row => {
        if (row.fields[key].length !== count) throw new Error(`${id}/${key}: changing polygon topology within a temperature interval`);
        region.vertices.push(...row.fields[key].map(bary => p(bary, row.t)));
      });
      region.caps.push({ index: region.faces.length, temp: high });
      region.faces.push(Array.from({ length: count }, (_, i) => offset + count - i - 1));
      const last = offset + (rows.length - 1) * count;
      region.caps.push({ index: region.faces.length, temp: low });
      region.faces.push(Array.from({ length: count }, (_, i) => last + i));
      const liquidusIndices = new Set();
      let cursor = 0;
      rows[0].rings[key].forEach((arc, edge) => {
        if (plan[key][edge] && key !== 'L') {
          for (let j = 0; j < arc.length - 1; j++) liquidusIndices.add(cursor + j);
          for (let row = 7; row < rows.length - 1; row += 7) {
            region.surfaceContours.push(rows[row].rings[key][edge].map(bary => p(bary, rows[row].t)));
          }
        }
        region.edgeSegments.push(rows.map(row => p(row.rings[key][edge][0], row.t)));
        cursor += arc.length - 1;
      });
      for (let row = 0; row < rows.length - 1; row++) for (let j = 0; j < count; j++) {
        const a = offset + row * count + j, b = offset + row * count + (j + 1) % count;
        const face = [a, b, b + count, a + count];
        region.faces.push(face);
        if (liquidusIndices.has(j)) region.liquidusFaces.push(face);
      }
      if (key.length === 3) for (let row = 0; row < rows.length; row += 7) {
        region.edgeSegments.push([...rows[row].fields[key], rows[row].fields[key][0]].map(bary => p(bary, rows[row].t)));
      }
    }
  }
  for (const [key, region] of regions) {
    const internal = new Set(region.caps.filter(({ temp }) => temp > LOW && temp < TOP
      && polygonArea(sampler(temp + 1e-7)[key] || []) > 1e-9
      && polygonArea(sampler(temp - 1e-7)[key] || []) > 1e-9).map(cap => cap.index));
    region.faces = region.faces.filter((_, index) => !internal.has(index));
    const liquidusSet = new Set(region.liquidusFaces);
    region.renderFaces = region.faces.filter(face => !liquidusSet.has(face));
    delete region.caps;
  }
  if (invariant) {
    const polygon = invariant.polygon;
    const vertices = [...polygon, ...(invariant.interior ? [invariant.interior] : [])].map(bary => p(bary, invariant.temp));
    const phase = phaseLabels.Labg || PHASES.Labg[0];
    regions.set('Labg', { id: regionIds.Labg || `${id}-Labg`, key: 'Labg', title: phase, phase, color: PHASES.Labg[1],
      kind: '四相不变平衡面', shape: invariant.shape || '四个平衡相成分构成的等温四边形，无温度厚度',
      temperature: `T = ${invariant.temperatureLabel || 'TP'} = ${invariant.temp}`, composition: invariant.composition || '反应物 α、L 与生成物 β、γ 分别处于两条对角线上',
      note: invariant.note || '包共晶反应 L + α ⇄ β + γ。TP 以上为 L+α+β、L+α+γ 两组三相平衡；TP 以下转为 L+β+γ、α+β+γ。',
      vertices, faces: invariant.interior ? polygon.map((_, i) => [i, (i + 1) % polygon.length, polygon.length]) : [polygon.map((_, i) => i)],
      edgeSegments: [[...vertices.slice(0, polygon.length), vertices[0]],
        ...(invariant.interior ? polygon.map((_, i) => [vertices[i], vertices[polygon.length]]) : [])],
    });
  }
  const all = [...regions.values()].sort((a, b) => ['La', 'Lb', 'Lg', 'Lab', 'Lag', 'Lbg', 'Labg', 'a', 'b', 'g', 'ab', 'ag', 'bg', 'abg', 'L'].indexOf(a.key)
    - ['La', 'Lb', 'Lg', 'Lab', 'Lag', 'Lbg', 'Labg', 'a', 'b', 'g', 'ab', 'ag', 'bg', 'abg', 'L'].indexOf(b.key));
  return { id, title, shortTitle, subtitle, regions: all, curvedLiquidus: true,
    guides: { ...guides, curves: guides.curves.map(points => ({ points })) }, checkpoints, axisTemps,
    sectionAt: t => sectionFields((temp, level) => curveSection(sampler(temp, level)).fields, t, id, invariant).map(field => {
      const key = field.id.slice(id.length + 1);
      return { ...field, id: regionIds[key] || field.id, phase: phaseLabels[key] || field.phase };
    }), invariant, temperatures };
}

function sampledPath(high, low, getPoint) {
  return Array.from({ length: 25 }, (_, i) => { const t = high + (low - high) * i / 24; return p(getPoint(t), t); });
}

const EUTECTIC_POLES = [A, B, C];
const EUTECTIC_MELTING = [0.94, 0.88, 0.91];
const EUTECTIC_PAIR_KEYS = ['ab', 'bg', 'ag'];
const EUTECTIC_TIE_KEYS = ['Lab', 'Lbg', 'Lag'];

// A single isothermal partition supplies every adjoining liquidus, solidus and solvus.
function eutecticSection(t, level, limited) {
  const TE = limited ? 0.32 : 0.28;
  const E = limited ? [0.34, 0.33, 0.33] : [0.33, 0.34, 0.33];
  const edges = limited
    ? [{ e: [0.52, 0.48, 0], te: 0.43 }, { e: [0, 0.52, 0.48], te: 0.42 }, { e: [0.49, 0, 0.51], te: 0.44 }]
    : [{ e: [0.54, 0.46, 0], te: 0.42 }, { e: [0, 0.54, 0.46], te: 0.41 }, { e: [0.48, 0, 0.52], te: 0.43 }];
  const top = EUTECTIC_POLES.map(pole => mix([1 / 3, 1 / 3, 1 / 3], pole, 0.52));
  const bottom = EUTECTIC_POLES.map(pole => mix([1 / 3, 1 / 3, 1 / 3], pole, 0.73));
  const solids = EUTECTIC_POLES.map((pole, i) => limited ? along(top[i], bottom[i], t, TE, LOW) : pole);
  const pairs = edges.map(({ e, te }, i) => {
    const j = (i + 1) % 3, first = EUTECTIC_POLES[i], second = EUTECTIC_POLES[j];
    const firstE = limited ? mix(first, second, 0.20) : first;
    const secondE = limited ? mix(second, first, 0.20) : second;
    if (level >= te) {
      const s1 = along(first, firstE, t, EUTECTIC_MELTING[i], te);
      const s2 = along(second, secondE, t, EUTECTIC_MELTING[j], te);
      return { s1, s2, binary1: s1, binary2: s2,
        l1: liquidAlong(first, e, t, EUTECTIC_MELTING[i], te),
        l2: liquidAlong(second, e, t, EUTECTIC_MELTING[j], te), active: false };
    }
    const binary1 = limited ? along(firstE, mix(first, second, 0.14), t, te, LOW) : first;
    const binary2 = limited ? along(secondE, mix(second, first, 0.14), t, te, LOW) : second;
    const s1 = level < TE ? solids[i] : along(firstE, limited ? top[i] : first, t, te, TE);
    const s2 = level < TE ? solids[j] : along(secondE, limited ? top[j] : second, t, te, TE);
    const l = liquidAlong(e, E, t, te, TE);
    return { s1, s2, binary1, binary2, l1: l, l2: l, active: true };
  });
  const fields = {};
  pairs.forEach((edge, i) => {
    const previous = pairs[(i + 2) % 3], solid = ['a', 'b', 'g'][i];
    fields[solid] = [EUTECTIC_POLES[i], edge.binary1, edge.s1, previous.s2, previous.binary2];
    if (level >= TE) fields[['La', 'Lb', 'Lg'][i]] = [edge.s1, edge.l1, previous.l2, previous.s2];
    if (edge.active) {
      fields[EUTECTIC_PAIR_KEYS[i]] = [edge.binary1, edge.binary2, edge.s2, edge.s1];
      if (level >= TE) fields[EUTECTIC_TIE_KEYS[i]] = [edge.s1, edge.s2, edge.l1];
    }
  });
  if (level >= TE) fields.L = pairs.flatMap(edge => [edge.l1, edge.l2]);
  else fields.abg = solids;
  return fields;
}

export function createEutecticDiagrams() {
  return [false, true].map(limited => {
    const id = limited ? 'limited-eutectic' : 'immiscible-eutectic';
    const TE = limited ? 0.32 : 0.28;
    const sampler = (t, level = t) => eutecticSection(t, level, limited);
    const edges = limited ? [0.43, 0.42, 0.44] : [0.42, 0.41, 0.43];
    const E = limited ? [0.34, 0.33, 0.33] : [0.33, 0.34, 0.33];
    const solidNames = limited ? ['α', 'β', 'γ'] : ['A', 'B', 'C'];
    const sol = EUTECTIC_POLES.map(pole => limited ? mix([1 / 3, 1 / 3, 1 / 3], pole, 0.52) : pole);
    return buildDiagram({ id,
      title: limited ? '固态有限互溶的三元共晶相图' : '固态互不溶解的三元共晶相图',
      shortTitle: limited ? '有限互溶共晶' : '互不溶解共晶',
      subtitle: limited ? 'A-B-C · 有限固溶度；L → α + β + γ' : 'A-B-C · 三个固相无固溶度；L → A + B + C',
      temperatures: [TOP, 0.94, 0.91, 0.88, ...[...edges].sort((a, b) => b - a), TE, LOW], sampler,
      axisTemps: { A: 0.94, B: 0.88, C: 0.91, special: TE, specialLabel: 'TE' },
      regionIds: limited ? { La: 'liquid-alpha', Lb: 'liquid-beta', Lg: 'liquid-gamma',
        Lab: 'cotectic-ab', Lbg: 'cotectic-bc', Lag: 'cotectic-ca', a: 'alpha', b: 'beta', g: 'gamma',
        ab: 'alpha-beta', bg: 'beta-gamma', ag: 'gamma-alpha', abg: 'alpha-beta-gamma' }
        : { La: 'immiscible-liquid-a', Lb: 'immiscible-liquid-b', Lg: 'immiscible-liquid-c',
          Lab: 'immiscible-cotectic-ab', Lbg: 'immiscible-cotectic-bc', Lag: 'immiscible-cotectic-ca', abg: 'immiscible-abc' },
      phaseLabels: limited ? {} : { a: 'A', b: 'B', g: 'C', La: 'L + A', Lb: 'L + B', Lg: 'L + C',
        Lab: 'L + A + B', Lbg: 'L + B + C', Lag: 'L + A + C', abg: 'A + B + C', Labg: 'L + A + B + C' },
      notes: limited ? {
        a: 'α 固溶体沿 A 角延伸到纯 A 熔点，低温固溶度缩小；与 L+α、α+β、α+γ 共用边界。',
        b: 'β 固溶体沿 B 角延伸到纯 B 熔点，低温固溶度缩小。',
        g: 'γ 固溶体沿 C 角延伸到纯 C 熔点，低温固溶度缩小。',
        abg: 'TE 以下的中心三固相区。三角形的三个顶点为平衡固相成分，随固溶度下降向三个纯组元端移动。',
      } : { abg: 'TE 以下，三元成分三角形内部由 A、B、C 三个互不溶固相组成；各固相成分固定为纯组元。' },
      invariant: { temp: TE, polygon: sol, interior: E, replacedFields: ['abg'], temperatureLabel: 'TE',
        vertexLabels: solidNames, interiorLabel: 'E (L)', shape: '等温共晶四相平衡三角形，液相 E 位于三固相成分三角形内部',
        composition: `三个固相为 ${solidNames.join('、')}；液相为 E`,
        note: `TE 处发生 L → ${solidNames.join(' + ')}。三条共晶沟在 E 汇合；TE 以下液相消失。` },
      guides: { curves: edges.map((te, i) => sampledPath(te, TE, t => sampler(t, (te + TE) / 2)[EUTECTIC_TIE_KEYS[i]][2])),
        points: [{ point: p(E, TE), text: 'E' }, ...edges.map((te, i) => ({ point: p(sampler(te, te - 1e-7)[EUTECTIC_TIE_KEYS[i]][2], te), text: `e${['₁', '₂', '₃'][i]}` }))] },
      checkpoints: [{ label: 'T > TE', t: limited ? 0.42 : 0.38 }, { label: 'T = TE', t: TE }, { label: 'T < TE', t: limited ? 0.2 : 0.18 }],
    });
  });
}

export function createTextbookDiagrams() {
  const P = TRANSITION_COMPOSITIONS, TP = TRANSITION_T;
  const ei = buildDiagram({ id: 'eutectic-isomorphous',
    title: '两个共晶型二元系和一个匀晶型二元系构成的三元相图', shortTitle: '两共晶 + 一匀晶',
    subtitle: 'AB、BC：共晶；AC：完全互溶的 α 固溶体',
    temperatures: [TOP, 1, 0.90, 0.72, 0.55, 0.34, LOW], sampler: eutecticIsomorphousSection,
    axisTemps: { A: 0.90, B: 1, C: 0.55, special: 0.72, specialLabel: 'Te' },
    notes: { a: 'A、C 完全互溶，同属 α 固溶体。α 单相区沿整个 AC 边相连，不存在独立 γ 相。',
      Lab: '沿 e → e₁ 降温发生 L → α + β。三相共轭三角形扫成三棱柱，不是三元四相共晶反应。',
      ab: '凝固后的两固相区为 α + β。低温溶解度下降时可再析出另一固相。' },
    guides: { curves: [sampledPath(0.72, 0.34, t => eutecticIsomorphousSection(t, 0.5).Lab[2])],
      points: [{ point: p([0.52, 0.48, 0], 0.72), text: 'e' }, { point: p([0, 0.5, 0.5], 0.34), text: 'e₁' },
        { point: p([0.88, 0.12, 0], 0.72), text: 'a' }, { point: p([0.12, 0.88, 0], 0.72), text: 'b' },
        { point: p([0, 0.16, 0.84], 0.34), text: 'a₁' }, { point: p([0, 0.84, 0.16], 0.34), text: 'b₁' }] },
    checkpoints: [{ label: 'T > Te', t: 0.8 }, { label: 'T = Te', t: 0.72 }, { label: 'Tc > T > Te₁', t: 0.46 }, { label: 'T < Te₁', t: 0.2 }],
  });
  const pe = buildDiagram({ id: 'peritectic-eutectic', title: '包共晶型三元系相图', shortTitle: '包共晶型',
    subtitle: 'AB、AC：包晶；BC：共晶；L + α ⇄ β + γ',
    temperatures: [TOP, 0.98, 0.78, 0.62, 0.54, TP, 0.25, 0.15, LOW], sampler: peritecticEutecticSection,
    axisTemps: { A: 0.98, B: 0.54, C: 0.25, special: TP, specialLabel: 'TP' },
    invariant: { temp: TP, polygon: [P.a, P.b, P.L, P.g] },
    notes: { Lab: 'TP 以上，L + α ⇄ β 包晶三相平衡。与 L+α+γ 三相区在 TP 相接。',
      Lag: 'TP 以上，L + α ⇄ γ 包晶三相平衡。与 L+α+β 三相区在 TP 相接。',
      Lbg: 'TP 以下，L ⇄ β + γ 共晶三相平衡，延伸至 BC 边的二元共晶温度。',
      abg: 'TP 以下的三固相平衡，与含液 L+β+γ 三相区共用 β-γ 边。' },
    guides: { curves: [
      sampledPath(0.78, TP, t => liquidAlong([0.3, 0.7, 0], P.L, t, 0.78, TP)),
      sampledPath(0.62, TP, t => liquidAlong([0.34, 0, 0.66], P.L, t, 0.62, TP)),
      sampledPath(TP, 0.15, t => liquidAlong(P.L, [0, 0.49, 0.51], t, TP, 0.15)),
    ], points: [{ point: p(P.a, TP), text: 'a' }, { point: p(P.b, TP), text: 'b' },
      { point: p(P.g, TP), text: 'c′' }, { point: p(P.L, TP), text: 'p' },
      { point: p([0.30, 0.70, 0], 0.78), text: 'p₁' },
      { point: p([0.34, 0, 0.66], 0.62), text: 'p₂' },
      { point: p([0, 0.49, 0.51], 0.15), text: 'e' }] },
    checkpoints: [{ label: 'T > TP', t: 0.47 }, { label: 'T = TP', t: TP }, { label: 'TP > T > TC', t: 0.32 }, { label: 'T < Te', t: 0.1 }],
  });
  return [ei, pe, createFourPhasePeritecticDiagram()];
}

function createFourPhasePeritecticDiagram() {
  const P = FOUR_PHASE_PERITECTIC_COMPOSITIONS, TP = FOUR_PHASE_PERITECTIC_T, E = PERITECTIC_BINARY;
  return buildDiagram({ id: 'four-phase-peritectic', title: '具有四相平衡包晶转变的三元系相图', shortTitle: '四相平衡包晶',
    subtitle: 'AB：共晶；AC、BC：包晶；L + α + β → γ',
    temperatures: [TOP, 0.98, 0.79, 0.64, TP, 0.31, 0.27, 0.15, LOW], sampler: fourPhasePeritecticSection,
    axisTemps: { A: 0.98, B: 0.79, C: 0.15, special: TP, specialLabel: 'TP' },
    invariant: { temp: TP, polygon: [P.a, P.b, P.L], interior: P.g, replacedFields: ['abg', 'Lag', 'Lbg'],
      vertexLabels: ['a', 'b', 'p'], interiorLabel: 'c (γ)',
      shape: '等温三角形 abp，γ 成分点 c 在三角形内部，无温度厚度',
      composition: 'α(a)、β(b)、L(p) 为三个顶点；生成相 γ(c) 位于三角形内部',
      note: '包晶反应 L + α + β → γ。一般有一个反应相耗尽，另外两个与 γ 构成三相平衡：液相耗尽为 α+β+γ；β 耗尽为 L+α+γ；α 耗尽为 L+β+γ。总体成分恰为 c 且达到平衡时，可全部转为 γ。' },
    notes: {
      Lab: 'TP 以上的 L+α+β 三相区，从 AB 二元共晶线 a₁e₁b₁ 延伸到四相平衡三角形 abp。液相成分沿 e₁ → p 变化。',
      Lag: 'TP 以下，若 β 被耗尽，剩余 L、α 与生成的 γ 共存。沿 p → p₂ 继续发生 L+α → γ，直到 AC 边的二元包晶温度。',
      Lbg: 'TP 以下，若 α 被耗尽，剩余 L、β 与生成的 γ 共存。沿 p → p₃ 继续发生 L+β → γ，直到 BC 边的二元包晶温度。',
      abg: 'TP 以下，若液相被耗尽，剩余 α、β 与生成的 γ 形成三固相区；三角形 abc 随温度下降向低温三固相区延伸。',
      g: 'γ 在四相包晶温度处首先形成，其成分点 c 位于反应物 α-β-L 三角形内部。低温 γ 单相区向 C 端展开。',
      Lg: '四相包晶温度以下出现的 L+γ 两相区，连接两条包晶反应曲线；在 AC、BC 二元包晶反应结束后，继续向纯 C 熔点收敛。',
    },
    guides: { curves: [
      sampledPath(0.64, TP, t => liquidAlong(E.e1, P.L, t, 0.64, TP)),
      sampledPath(TP, 0.31, t => liquidAlong(P.L, E.p2, t, TP, 0.31)),
      sampledPath(TP, 0.27, t => liquidAlong(P.L, E.p3, t, TP, 0.27)),
    ], points: [
      { point: p(E.e1, 0.64), text: 'e₁' }, { point: p(E.a1, 0.64), text: 'a₁' }, { point: p(E.b1, 0.64), text: 'b₁' },
      { point: p(P.a, TP), text: 'a' }, { point: p(P.b, TP), text: 'b' },
      { point: p(P.g, TP), text: 'c' }, { point: p(P.L, TP), text: 'p' },
      { point: p(E.p2, 0.31), text: 'p₂' }, { point: p(E.p3, 0.27), text: 'p₃' },
    ] },
    checkpoints: [{ label: 'T > TP', t: 0.52 }, { label: 'T = TP', t: TP },
      { label: 'T < TP', t: 0.38 }, { label: 'T < TC', t: 0.1 }],
  });
}
