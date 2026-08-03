const defs = [
  { id: 'image', label: 'Product image', icon: '▧', desc: 'Identify the product', category: 'core', importance: 1.00 },
  { id: 'title', label: 'Product title', icon: 'T', desc: 'Understand what it is', category: 'core', importance: 0.92 },
  { id: 'rating', label: 'Reviews', icon: '★', desc: 'Evaluate trust', category: 'core', importance: 0.58 },
  { id: 'price', label: 'Price', icon: '$', desc: 'Evaluate cost', category: 'core', importance: 0.90 },
  { id: 'discount', label: 'Discount badge', icon: '%', desc: 'Adds offer context', category: 'extra', importance: 0.48 },
  { id: 'variants', label: 'Size / options', icon: '⌘', desc: 'Make a required choice', category: 'core', importance: 0.88 },
  { id: 'sizeChart', label: 'Size chart', icon: '尺', desc: 'Helps option confidence', category: 'extra', importance: 0.52 },
  { id: 'trust', label: 'Trust badges', icon: '✓', desc: 'Reduces risk', category: 'extra', importance: 0.44 },
  { id: 'shipping', label: 'Shipping info', icon: '↗', desc: 'Reduces delivery uncertainty', category: 'extra', importance: 0.55 },
  { id: 'returns', label: 'Returns policy', icon: '↺', desc: 'Reduces purchase anxiety', category: 'extra', importance: 0.42 },
  { id: 'cta', label: 'Add to cart', icon: '＋', desc: 'Complete the next action', category: 'core', importance: 1.00 },
  { id: 'stickyCta', label: 'Sticky CTA bar', icon: '▁', desc: 'Secondary action support', category: 'extra', importance: 0.72 }
];

const initialDefaults = {
  image: [16, 22],
  title: [16, 258],
  rating: [16, 314],
  price: [16, 360],
  variants: [16, 420],
  cta: [16, 500]
};

const stages = [
  ['image', 'title', 'rating'],
  ['price', 'discount'],
  ['variants', 'sizeChart'],
  ['trust', 'shipping', 'returns'],
  ['cta', 'stickyCta']
];

const taskPath = ['image', 'title', 'rating', 'price', 'discount', 'variants', 'sizeChart', 'trust', 'shipping', 'returns', 'cta', 'stickyCta'];
const criticalIds = ['image', 'title', 'price', 'variants', 'cta'];

const relationshipRules = [
  { a: 'image', b: 'title', ideal: 42, tolerance: 150, weight: 0.88, label: 'Image ↔ title' },
  { a: 'image', b: 'rating', ideal: 70, tolerance: 175, weight: 0.52, label: 'Image ↔ reviews' },
  { a: 'title', b: 'rating', ideal: 52, tolerance: 130, weight: 0.70, label: 'Title ↔ reviews' },
  { a: 'title', b: 'price', ideal: 78, tolerance: 150, weight: 1.00, label: 'Title ↔ price' },
  { a: 'price', b: 'discount', ideal: 36, tolerance: 105, weight: 0.72, label: 'Price ↔ discount' },
  { a: 'price', b: 'variants', ideal: 92, tolerance: 170, weight: 0.92, label: 'Price ↔ variants' },
  { a: 'variants', b: 'sizeChart', ideal: 34, tolerance: 105, weight: 1.00, label: 'Variants ↔ size chart' },
  { a: 'variants', b: 'cta', ideal: 92, tolerance: 175, weight: 1.00, label: 'Variants ↔ CTA' },
  { a: 'cta', b: 'trust', ideal: 72, tolerance: 175, weight: 0.66, label: 'CTA ↔ trust' },
  { a: 'cta', b: 'shipping', ideal: 88, tolerance: 205, weight: 0.76, label: 'CTA ↔ shipping' },
  { a: 'shipping', b: 'returns', ideal: 58, tolerance: 160, weight: 0.52, label: 'Shipping ↔ returns' },
  { a: 'cta', b: 'stickyCta', ideal: 190, tolerance: 360, weight: 0.38, label: 'Primary CTA ↔ sticky CTA' }
];

const palette = document.getElementById('palette');
const screen = document.getElementById('screen');
const contentLayer = document.getElementById('contentLayer');
const pathLayer = document.getElementById('pathLayer');
const heatmapLayer = document.getElementById('heatmapLayer');
const emptyHint = document.getElementById('emptyHint');
const modeSelect = document.getElementById('modeSelect');
const heatmapBtn = document.getElementById('heatmapBtn');
const presetSelect = document.getElementById('presetSelect');

let placed = new Map();
let dragId = null;
let active = null;
let heatmapActive = false;
let raf = false;
let lastComposite = 0;
let selectedElementId = null;

const presets = {
  balanced: { image:[16,22], title:[16,258], rating:[16,314], price:[16,360], variants:[16,420], sizeChart:[210,424], cta:[16,500], shipping:[16,565], returns:[16,625] },
  conversion: { image:[16,22], title:[16,250], price:[16,305], rating:[210,309], discount:[245,250], variants:[16,365], sizeChart:[220,371], trust:[16,430], cta:[16,490], shipping:[16,555], stickyCta:[16,690] },
  contentHeavy: { image:[16,22], title:[16,258], rating:[16,314], price:[16,360], discount:[235,360], variants:[16,430], sizeChart:[220,436], shipping:[16,500], returns:[16,560], trust:[16,620], cta:[16,690] }
};

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function uniq(arr) { return [...new Set(arr)]; }
function labelFor(id) { return defs.find(d => d.id === id)?.label || id; }
function importanceFor(id) { return defs.find(d => d.id === id)?.importance || 0.5; }
function round2(n) { return Math.round(n * 100) / 100; }
function fmt(n) { return Number.isFinite(n) ? n.toFixed(1) : '—'; }

function sigmoid(x) { return 1 / (1 + Math.exp(-x)); }
function gaussianPenalty(distance, ideal, tolerance) {
  const sigma = Math.max(1, tolerance / 2.15);
  const z = (distance - ideal) / sigma;
  return Math.exp(-0.5 * z * z) * 100;
}

function schedule() {
  if (raf) return;
  raf = true;
  requestAnimationFrame(() => {
    raf = false;
    analyze();
  });
}

function center(el) {
  return {
    x: (parseFloat(el.style.left) || 0) + el.offsetWidth / 2,
    y: (parseFloat(el.style.top) || 0) + el.offsetHeight / 2
  };
}

function box(el) {
  const x = parseFloat(el.style.left) || 0;
  const y = parseFloat(el.style.top) || 0;
  const w = el.offsetWidth;
  const h = el.offsetHeight;
  return { x, y, w, h, right: x + w, bottom: y + h };
}

function overlap(a, b) {
  const w = Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x));
  const h = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y));
  return w * h;
}

function edgeGap(a, b) {
  const dx = Math.max(a.x - b.right, b.x - a.right, 0);
  const dy = Math.max(a.y - b.bottom, b.y - a.bottom, 0);
  return Math.hypot(dx, dy);
}

function centerDistance(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function viewportBoundary() {
  if (window.innerWidth <= 390) return 414;
  if (window.innerWidth <= 700) return 446;
  return 548;
}

function applyPreset(name) {
  if (!presets[name]) return;
  [...placed.values()].forEach(el => el.remove());
  placed.clear();
  Object.entries(presets[name]).forEach(([id, pos]) => add(id, pos[0], pos[1]));
  screen.scrollTop = 0;
  selectedElementId = null;
  schedule();
}

function renderPalette() {
  palette.innerHTML = '';
  defs.forEach(d => {
    const el = document.createElement('div');
    el.className = 'palette-item';
    el.dataset.id = d.id;
    el.draggable = true;
    el.innerHTML = `
      <span class="palette-icon">${d.icon}</span>
      <span><strong>${d.label}</strong><small>${d.desc}${d.category === 'extra' ? ' · optional' : ''}</small></span>`;
    el.addEventListener('dragstart', () => dragId = d.id);
    el.addEventListener('click', () => {
      if (!placed.has(d.id)) {
        const p = initialDefaults[d.id] || [16, 580 + (placed.size * 44)];
        add(d.id, p[0], p[1]);
      }
    });
    palette.appendChild(el);
  });
  syncPalette();
}

function syncPalette() {
  document.querySelectorAll('.palette-item').forEach(el => el.classList.toggle('used', placed.has(el.dataset.id)));
  emptyHint.style.display = placed.size ? 'none' : 'grid';
}

function add(id, x, y) {
  const d = defs.find(v => v.id === id);
  if (!d) return;

  let el = placed.get(id);
  if (!el) {
    el = document.createElement('div');
    el.className = 'canvas-item';
    el.dataset.type = id;
    el.innerHTML = `<strong>${d.label}</strong><small>${d.desc}</small>`;
    el.addEventListener('pointerdown', startDrag);
    el.addEventListener('click', () => {
      selectedElementId = id;
      updateActiveLabel();
    });
    el.addEventListener('dblclick', () => remove(id));
    contentLayer.appendChild(el);
    placed.set(id, el);
  }

  const maxX = contentLayer.clientWidth - el.offsetWidth - 8;
  const maxY = contentLayer.scrollHeight - el.offsetHeight - 8;
  el.style.left = clamp(x, 6, maxX) + 'px';
  el.style.top = clamp(y, 10, maxY) + 'px';
  syncPalette();
  schedule();
}

function remove(id) {
  placed.get(id)?.remove();
  placed.delete(id);
  if (selectedElementId === id) selectedElementId = null;
  syncPalette();
  schedule();
}

function reset() {
  [...placed.values()].forEach(el => el.remove());
  placed.clear();
  Object.entries(initialDefaults).forEach(([id, pos]) => add(id, pos[0], pos[1]));
  presetSelect.value = 'custom';
  screen.scrollTop = 0;
  selectedElementId = null;
  lastComposite = 0;
  schedule();
}

contentLayer.addEventListener('dragover', e => e.preventDefault());
contentLayer.addEventListener('drop', e => {
  e.preventDefault();
  if (!dragId) return;
  presetSelect.value = 'custom';
  const rect = contentLayer.getBoundingClientRect();
  add(dragId, e.clientX - rect.left - 74, e.clientY - rect.top - 24 + screen.scrollTop);
  selectedElementId = dragId;
  dragId = null;
});

function startDrag(e) {
  if (e.button !== undefined && e.button !== 0) return;
  presetSelect.value = 'custom';
  const el = e.currentTarget;
  selectedElementId = el.dataset.type;
  active = {
    el,
    startLeft: parseFloat(el.style.left) || 0,
    startTop: parseFloat(el.style.top) || 0,
    startPointerX: e.clientX,
    startPointerY: e.clientY,
    startScroll: screen.scrollTop,
    startScore: lastComposite,
    pointerId: e.pointerId
  };
  el.classList.add('dragging');
  el.setPointerCapture?.(e.pointerId);
  e.preventDefault();
  updateActiveLabel();
  document.addEventListener('pointermove', moveDrag, { passive: false });
  document.addEventListener('pointerup', endDrag, { once: true });
}

function moveDrag(e) {
  if (!active) return;
  e.preventDefault();
  autoScrollScreen(e.clientY);

  const el = active.el;
  const deltaX = e.clientX - active.startPointerX;
  const deltaY = e.clientY - active.startPointerY + (screen.scrollTop - active.startScroll);
  const maxX = contentLayer.clientWidth - el.offsetWidth - 8;
  const maxY = contentLayer.scrollHeight - el.offsetHeight - 8;

  el.style.left = clamp(active.startLeft + deltaX, 6, maxX) + 'px';
  el.style.top = clamp(active.startTop + deltaY, 10, maxY) + 'px';
  schedule();
}

function autoScrollScreen(clientY) {
  const rect = screen.getBoundingClientRect();
  const edge = 70;
  if (clientY > rect.bottom - edge) screen.scrollTop += 18;
  else if (clientY < rect.top + edge) screen.scrollTop -= 18;
}

function endDrag() {
  if (active?.el) active.el.classList.remove('dragging');
  active = null;
  document.removeEventListener('pointermove', moveDrag);
  schedule();
}

function updateActiveLabel() {
  const label = document.getElementById('activeElementLabel');
  label.textContent = selectedElementId ? `${labelFor(selectedElementId)} sensitivity` : 'Move any element';
}

function visibilityMap() {
  const entries = [...placed.entries()];
  const per = {};
  entries.forEach(([id]) => per[id] = 1);

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [aId, aEl] = entries[i];
      const [bId, bEl] = entries[j];
      const a = box(aEl);
      const b = box(bEl);
      const area = overlap(a, b);
      if (!area) continue;
      per[aId] = Math.max(0, per[aId] - area / (a.w * a.h));
      per[bId] = Math.max(0, per[bId] - area / (b.w * b.h));
    }
  }
  return per;
}

function weightedVisibility(per) {
  let total = 0;
  let weights = 0;
  placed.forEach((_, id) => {
    const w = importanceFor(id);
    total += (per[id] ?? 0) * w;
    weights += w;
  });
  return weights ? (total / weights) * 100 : 0;
}

function foldScoreFor(id) {
  if (!placed.has(id)) return 0;
  const y = center(placed.get(id)).y;
  const boundary = viewportBoundary();
  const centerPoint = boundary * 0.52;
  const scale = boundary * 0.42;
  return clamp(100 * Math.exp(-Math.max(0, y - centerPoint) / scale), 0, 100);
}

function weightedFoldDiscoverability() {
  let total = 0;
  let weights = 0;
  placed.forEach((_, id) => {
    const w = importanceFor(id);
    total += foldScoreFor(id) * w;
    weights += w;
  });
  return weights ? total / weights : 0;
}

function relationScores() {
  const details = [];
  relationshipRules.forEach(rule => {
    if (!placed.has(rule.a) || !placed.has(rule.b)) return;
    const gap = edgeGap(box(placed.get(rule.a)), box(placed.get(rule.b)));
    const score = gaussianPenalty(gap, rule.ideal, rule.tolerance);
    details.push({ ...rule, gap, score });
  });
  return details;
}

function groupingScoreContinuous(relations) {
  if (!relations.length) return 0;
  let total = 0;
  let weights = 0;
  relations.forEach(r => {
    total += r.score * r.weight;
    weights += r.weight;
  });
  return total / weights;
}

function spatialExpectationScore(relations) {
  const rules = [];
  relations.forEach(r => rules.push({ score: r.score, weight: r.weight }));

  const directional = [
    ['price', 'variants', 22],
    ['variants', 'cta', 34],
    ['image', 'price', 32],
    ['title', 'price', 24]
  ];
  directional.forEach(([a, b, softness]) => {
    if (!placed.has(a) || !placed.has(b)) return;
    const dy = center(placed.get(b)).y - center(placed.get(a)).y;
    rules.push({ score: sigmoid(dy / softness) * 100, weight: 0.85 });
  });

  if (!rules.length) return 0;
  const total = rules.reduce((s, r) => s + r.score * r.weight, 0);
  const weight = rules.reduce((s, r) => s + r.weight, 0);
  return total / weight;
}

function stageCentroid(stage) {
  const ids = stage.filter(id => placed.has(id));
  if (!ids.length) return null;
  const points = ids.map(id => center(placed.get(id)));
  return {
    x: points.reduce((s, p) => s + p.x, 0) / points.length,
    y: points.reduce((s, p) => s + p.y, 0) / points.length
  };
}

function sequenceScoreContinuous() {
  const centroids = stages.map(stageCentroid).filter(Boolean);
  if (centroids.length < 2) return 0;
  const scores = [];
  for (let i = 1; i < centroids.length; i++) {
    const dy = centroids[i].y - centroids[i - 1].y;
    scores.push(sigmoid(dy / 26) * 100);
  }
  return scores.reduce((s, v) => s + v, 0) / scores.length;
}

function scanEfficiencyScore() {
  const centroids = stages.map(stageCentroid).filter(Boolean);
  if (centroids.length < 2) return 0;
  let path = 0;
  let verticalProgress = 0;
  let backtrack = 0;
  for (let i = 1; i < centroids.length; i++) {
    path += centerDistance(centroids[i - 1], centroids[i]);
    const dy = centroids[i].y - centroids[i - 1].y;
    verticalProgress += Math.max(0, dy);
    backtrack += Math.max(0, -dy);
  }
  const direct = Math.max(1, centerDistance(centroids[0], centroids[centroids.length - 1]));
  const detourRatio = path / direct;
  const horizontalCost = Math.max(0, detourRatio - 1);
  const backtrackRatio = backtrack / Math.max(1, verticalProgress + backtrack);
  return clamp(100 * Math.exp(-0.70 * horizontalCost - 2.2 * backtrackRatio), 0, 100);
}

function crowdingControlScore(per) {
  const entries = [...placed.entries()];
  if (!entries.length) return 0;
  let risk = 0;
  let pairs = 0;
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [aId, aEl] = entries[i];
      const [bId, bEl] = entries[j];
      const a = box(aEl);
      const b = box(bEl);
      const gap = edgeGap(a, b);
      const overlapRisk = 1 - Math.min(per[aId] ?? 1, per[bId] ?? 1);
      const proximityRisk = Math.exp(-gap / 34);
      const importance = (importanceFor(aId) + importanceFor(bId)) / 2;
      risk += (0.68 * overlapRisk + 0.32 * proximityRisk) * importance;
      pairs++;
    }
  }
  const normalized = pairs ? risk / pairs : 0;
  return clamp(100 * Math.exp(-2.25 * normalized), 0, 100);
}

function relationshipIntegrityScore(relations, per) {
  if (!relations.length) return 0;
  let total = 0;
  let weights = 0;
  relations.forEach(r => {
    const visibility = Math.min(per[r.a] ?? 0, per[r.b] ?? 0);
    const combined = r.score * visibility;
    total += combined * r.weight;
    weights += r.weight;
  });
  return total / weights;
}

function attentionPotentialScore(per, grouping, fold, spatial) {
  let total = 0;
  let weights = 0;
  placed.forEach((_, id) => {
    const importance = importanceFor(id);
    const visibility = per[id] ?? 0;
    const foldComponent = foldScoreFor(id) / 100;
    const local = 100 * visibility * (0.48 + 0.32 * foldComponent + 0.20 * importance);
    total += local * importance;
    weights += importance;
  });
  const base = weights ? total / weights : 0;
  return clamp(base * 0.70 + grouping * 0.12 + spatial * 0.10 + fold * 0.08, 0, 100);
}

function modeScore(metrics) {
  if (modeSelect.value === 'grouping') {
    return 0.30 * metrics.visibility + 0.28 * metrics.grouping + 0.22 * metrics.relationship + 0.20 * metrics.crowding;
  }
  if (modeSelect.value === 'gutenberg') {
    const title = placed.get('title');
    const cta = placed.get('cta');
    const w = contentLayer.clientWidth;
    const h = viewportBoundary();
    const titleScore = title ? gaussianPenalty(center(title).x, w * 0.28, w * 0.55) * gaussianPenalty(center(title).y, h * 0.22, h * 0.70) / 100 : 0;
    const ctaScore = cta ? gaussianPenalty(center(cta).x, w * 0.70, w * 0.60) * gaussianPenalty(center(cta).y, h * 0.76, h * 0.75) / 100 : 0;
    const gutenberg = clamp((titleScore + ctaScore) / 2, 0, 100);
    return 0.26 * metrics.visibility + 0.18 * metrics.grouping + 0.16 * metrics.sequence + 0.15 * metrics.fold + 0.25 * gutenberg;
  }
  return 0.20 * metrics.visibility + 0.18 * metrics.sequence + 0.14 * metrics.grouping + 0.12 * metrics.fold + 0.12 * metrics.spatial + 0.10 * metrics.relationship + 0.08 * metrics.scan + 0.06 * metrics.crowding;
}

function applyHardConstraints(score, per) {
  let adjusted = score;
  criticalIds.forEach(id => {
    if (!placed.has(id)) adjusted -= 10 * importanceFor(id);
    else {
      const visibility = per[id] ?? 0;
      adjusted -= Math.pow(1 - visibility, 1.25) * 26 * importanceFor(id);
    }
  });
  return clamp(adjusted, 0, 100);
}

function buildReactions(per, relations, metrics) {
  const reactions = [];
  const weakestRelation = [...relations].sort((a, b) => a.score - b.score)[0];
  if (weakestRelation && weakestRelation.score < 62) {
    reactions.push(`${weakestRelation.label} feels disconnected (${Math.round(weakestRelation.gap)}px edge gap).`);
  }
  if (!placed.has('price')) reactions.push('I cannot evaluate the offer because the price is missing.');
  if (!placed.has('variants')) reactions.push('I cannot make the required product choice.');
  if (!placed.has('cta')) reactions.push('I cannot see the next action.');

  Object.entries(per).forEach(([id, v]) => {
    if (v < 0.92) reactions.push(`${labelFor(id)} is ${Math.round((1 - v) * 100)}% covered.`);
  });

  if (metrics.fold < 68) reactions.push('Important information is losing discoverability as it moves deeper below the initial viewport.');
  if (metrics.scan < 65) reactions.push('The reading path requires extra horizontal movement or backward scanning.');
  if (metrics.crowding < 70) reactions.push('Nearby elements are increasing crowding pressure and visual competition.');
  if (metrics.sequence < 70) reactions.push('The decision stages are not progressing in a stable top-to-bottom order.');

  return uniq(reactions).slice(0, 6);
}

function scientificReasons(metrics, relations, per) {
  const reasons = [];
  if (metrics.crowding < 78 || Object.values(per).some(v => v < 0.95)) {
    reasons.push('Crowding and occlusion are modeled continuously from overlap and edge spacing; recognition difficulty rises as surrounding elements get closer.');
  }
  if (metrics.grouping < 78 || metrics.relationship < 78) {
    reasons.push('Gestalt proximity is modeled with continuous distance-decay functions across semantically related pairs.');
  }
  if (metrics.fold < 78) {
    reasons.push('Initial-view discoverability decays gradually with vertical depth rather than switching at a single fold threshold.');
  }
  if (metrics.scan < 78 || metrics.sequence < 78) {
    reasons.push('Scan efficiency combines stage order, path length, horizontal detours, and backward movement.');
  }
  if (modeSelect.value === 'gutenberg') {
    reasons.push('Gutenberg contributes only as a comparison heuristic and cannot override missing or obscured task-critical elements.');
  }
  reasons.push('The displayed numbers are model indices for comparison, not biometric eye-tracking probabilities.');
  return uniq(reasons).slice(0, 5);
}

function drawPath(per) {
  pathLayer.innerHTML = '';
  let ids = taskPath.filter(id => placed.has(id) && (per[id] ?? 1) > 0.45);
  if (modeSelect.value === 'gutenberg') ids = ['title', 'image', 'price', 'cta'].filter(id => placed.has(id) && (per[id] ?? 1) > 0.45);
  if (ids.length < 2) return;

  const ns = 'http://www.w3.org/2000/svg';
  const pts = ids.map(id => center(placed.get(id)));

  const under = document.createElementNS(ns, 'polyline');
  under.setAttribute('points', pts.map(p => `${p.x},${p.y}`).join(' '));
  under.setAttribute('fill', 'none');
  under.setAttribute('stroke', 'rgba(220,231,138,.50)');
  under.setAttribute('stroke-width', '9');
  under.setAttribute('stroke-linecap', 'round');
  under.setAttribute('stroke-linejoin', 'round');
  pathLayer.appendChild(under);

  const line = document.createElementNS(ns, 'polyline');
  line.setAttribute('points', pts.map(p => `${p.x},${p.y}`).join(' '));
  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', '#8d8578');
  line.setAttribute('stroke-width', '3');
  line.setAttribute('stroke-dasharray', '6 6');
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('stroke-linejoin', 'round');
  pathLayer.appendChild(line);

  pts.forEach((p, i) => {
    const ring = document.createElementNS(ns, 'circle');
    ring.setAttribute('cx', p.x);
    ring.setAttribute('cy', p.y);
    ring.setAttribute('r', '14');
    ring.setAttribute('fill', 'rgba(220,231,138,.82)');
    ring.setAttribute('stroke', '#c7d36a');
    ring.setAttribute('stroke-width', '1');
    pathLayer.appendChild(ring);

    const core = document.createElementNS(ns, 'circle');
    core.setAttribute('cx', p.x);
    core.setAttribute('cy', p.y);
    core.setAttribute('r', '10');
    core.setAttribute('fill', '#fffcef');
    core.setAttribute('stroke', '#8d8578');
    core.setAttribute('stroke-width', '1.2');
    pathLayer.appendChild(core);

    const t = document.createElementNS(ns, 'text');
    t.setAttribute('x', p.x);
    t.setAttribute('y', p.y + 4);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('font-size', '9');
    t.setAttribute('font-weight', '800');
    t.setAttribute('fill', '#595449');
    t.textContent = i + 1;
    pathLayer.appendChild(t);
  });
}

function elementAttention(id, per, metrics) {
  const visibility = per[id] ?? 0;
  const fold = foldScoreFor(id) / 100;
  const importance = importanceFor(id);
  return clamp(100 * visibility * (0.48 + 0.30 * fold + 0.22 * importance) * (0.88 + metrics.grouping / 833), 0, 100);
}

function drawHeatmap(per, metrics) {
  heatmapLayer.innerHTML = '';
  heatmapLayer.classList.toggle('active', heatmapActive);
  if (!heatmapActive) return;

  const ranked = [...placed.entries()]
    .map(([id, el]) => ({ id, point: center(el), score: elementAttention(id, per, metrics) }))
    .sort((a, b) => b.score - a.score);

  ranked.forEach((entry, idx) => {
    const size = clamp(entry.score * 2.65, 76, 250);
    const color = entry.score > 70 ? 'rgba(255,96,78,.50)' : entry.score > 52 ? 'rgba(255,176,66,.42)' : 'rgba(255,223,98,.30)';
    const spot = document.createElement('div');
    spot.className = 'heat-spot';
    spot.style.left = `${entry.point.x}px`;
    spot.style.top = `${entry.point.y}px`;
    spot.style.width = `${size}px`;
    spot.style.height = `${size}px`;
    spot.style.background = `radial-gradient(circle, ${color} 0%, rgba(255,224,115,.20) 42%, rgba(255,250,240,0) 78%)`;
    heatmapLayer.appendChild(spot);

    if (idx < 3) {
      const tag = document.createElement('div');
      tag.className = 'heat-tag';
      tag.style.left = `${entry.point.x}px`;
      tag.style.top = `${entry.point.y}px`;
      tag.textContent = `${idx + 1}`;
      heatmapLayer.appendChild(tag);
    }
  });
}

function grade(n) {
  if (n >= 85) return 'Strong';
  if (n >= 70) return 'Good';
  if (n >= 50) return 'Needs work';
  return 'Critical';
}

function analyze() {
  const per = visibilityMap();
  const relations = relationScores();
  const visibility = weightedVisibility(per);
  const grouping = groupingScoreContinuous(relations);
  const fold = weightedFoldDiscoverability();
  const spatial = spatialExpectationScore(relations);
  const relationship = relationshipIntegrityScore(relations, per);
  const sequence = sequenceScoreContinuous();
  const scan = scanEfficiencyScore();
  const crowding = crowdingControlScore(per);
  const attention = attentionPotentialScore(per, grouping, fold, spatial);

  const metrics = { visibility, grouping, fold, spatial, relationship, sequence, scan, crowding, attention };
  let composite = applyHardConstraints(modeScore(metrics), per);
  composite = clamp(composite, 0, 100);
  lastComposite = composite;

  applyOcclusionStyles(per);

  const critical = [];
  criticalIds.forEach(id => {
    if (!placed.has(id)) critical.push(`${labelFor(id)} is missing.`);
    else if ((per[id] ?? 1) < 0.85) critical.push(`${labelFor(id)} is ${Math.round((1 - per[id]) * 100)}% hidden.`);
  });

  const findings = [];
  const weakestRelations = [...relations].sort((a, b) => a.score - b.score).slice(0, 2);
  weakestRelations.forEach(r => {
    if (r.score < 72) findings.push(`Reduce the ${Math.round(r.gap)}px edge gap for ${r.label}; current relationship score is ${r.score.toFixed(1)}.`);
  });
  if (fold < 74) findings.push('Move high-importance elements upward gradually; fold discoverability is decaying with vertical depth.');
  if (sequence < 74) findings.push('Improve the vertical progression between decision stages to reduce order reversals.');
  if (scan < 74) findings.push('Reduce horizontal detours and backward scanning between decision stages.');
  if (crowding < 74) findings.push('Increase separation or remove overlap where nearby elements create crowding pressure.');
  if (relationship < 74) findings.push('Strengthen the visibility and distance of semantically related element pairs.');
  if (modeSelect.value === 'gutenberg') findings.push('Treat Gutenberg as a comparison heuristic only; product-task constraints remain primary.');
  if (!critical.length && findings.length === 0) findings.push('The current layout has strong continuous scores across visibility, flow, grouping, and relationship integrity.');

  const reactions = buildReactions(per, relations, metrics);
  const evidence = scientificReasons(metrics, relations, per);

  updateUI({ composite, metrics, critical, findings: uniq(findings).slice(0, 7), reactions, evidence });
  drawPath(per);
  drawHeatmap(per, metrics);
}

function applyOcclusionStyles(per) {
  placed.forEach((el, id) => {
    const hiddenPct = Math.round((1 - (per[id] ?? 1)) * 100);
    el.classList.toggle('occluded', hiddenPct > 4);
    el.classList.toggle('critical-highlight', criticalIds.includes(id));
    el.dataset.hidden = hiddenPct;
  });
}

function updateCharacter(score, critical, reactions) {
  const stage = document.getElementById('characterStage');
  const mood = document.getElementById('characterMood');
  const quote = document.getElementById('characterQuote');
  const sub = document.getElementById('characterSubtext');

  let state = 'hesitant';
  let moodText = 'Hesitant';
  let quoteText = 'I need to look around before I can decide.';
  let subText = reactions[0] || 'Small spatial changes are affecting the model continuously.';

  if (score >= 86) {
    state = 'satisfied';
    moodText = 'Satisfied';
    quoteText = 'Everything feels clear. I know what to do next.';
    subText = 'Critical elements are visible, related, and arranged in a low-cost scan path.';
  } else if (score >= 70) {
    state = 'good';
    moodText = 'Comfortable';
    quoteText = 'This is mostly clear, but one relationship still makes me pause.';
  } else if (score < 50 || critical.length) {
    state = 'critical';
    moodText = 'Confused';
    quoteText = reactions[0] || 'I cannot find the information I need.';
    subText = 'Critical content is missing, hidden, crowded, or disconnected.';
  }

  stage.dataset.mood = state;
  mood.textContent = moodText;
  quote.textContent = quoteText;
  sub.textContent = subText;
}

function updateList(id, items) {
  const ul = document.getElementById(id);
  ul.innerHTML = '';
  (items.length ? items : ['No items yet.']).forEach(text => {
    const li = document.createElement('li');
    li.textContent = text;
    ul.appendChild(li);
  });
}

function updateDelta(score) {
  const el = document.getElementById('liveDelta');
  const delta = active ? score - active.startScore : 0;
  el.textContent = `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`;
  el.className = `live-delta ${delta > 0.005 ? 'positive' : delta < -0.005 ? 'negative' : 'neutral'}`;
}

function updateUI(r) {
  const score = r.composite;
  document.getElementById('score').textContent = fmt(score);
  document.getElementById('scoreFill').style.width = `${score}%`;
  document.getElementById('scoreState').textContent = grade(score);
  document.getElementById('visibility').textContent = fmt(r.metrics.visibility);
  document.getElementById('sequence').textContent = fmt(r.metrics.sequence);
  document.getElementById('grouping').textContent = fmt(r.metrics.grouping);

  document.getElementById('attentionPotential').textContent = fmt(r.metrics.attention);
  document.getElementById('foldDiscoverability').textContent = fmt(r.metrics.fold);
  document.getElementById('spatialExpectation').textContent = fmt(r.metrics.spatial);
  document.getElementById('relationshipIntegrity').textContent = fmt(r.metrics.relationship);
  document.getElementById('scanEfficiency').textContent = fmt(r.metrics.scan);
  document.getElementById('crowdingControl').textContent = fmt(r.metrics.crowding);
  updateActiveLabel();
  updateDelta(score);

  const criticalBanner = document.getElementById('criticalBanner');
  criticalBanner.hidden = !r.critical.length;
  criticalBanner.textContent = r.critical[0] || '';

  document.getElementById('shopperText').textContent =
    score >= 85 ? 'The shopper can identify, evaluate, choose, and act with low simulated scan cost.' :
    score >= 70 ? 'The layout is workable, but small spatial changes still alter grouping, discoverability, and scan efficiency.' :
    score >= 50 ? 'The shopper needs extra scanning to reconstruct relationships between important elements.' :
    'Critical information is missing, obscured, crowded, or placed in a high-cost decision path.';

  updateList('findings', r.critical.concat(r.findings).slice(0, 7));
  updateList('reactions', r.reactions);
  updateList('evidenceList', r.evidence);
  updateCharacter(score, r.critical, r.reactions);

  const primary = r.critical[0] || r.reactions[0] || r.findings[0] || 'No major friction detected';
  const nextMove = score >= 85 ? 'Validate the model with real users or controlled testing' : (r.findings[0] || 'Reduce distance between related elements');
  document.getElementById('primaryFriction').textContent = primary;
  document.getElementById('bestNextMove').textContent = nextMove;
}

modeSelect.addEventListener('change', () => {
  document.getElementById('modeText').textContent =
    modeSelect.value === 'task' ? 'Continuous model of task flow, grouping, visibility, fold depth, and scan cost.' :
    modeSelect.value === 'grouping' ? 'Continuous model of proximity, overlap, crowding, and semantic relationships.' :
    'Gutenberg comparison blended with task-critical constraints and visibility.';
  schedule();
});

presetSelect.addEventListener('change', () => {
  if (presetSelect.value !== 'custom') applyPreset(presetSelect.value);
});

heatmapBtn.addEventListener('click', () => {
  heatmapActive = !heatmapActive;
  heatmapBtn.setAttribute('aria-pressed', String(heatmapActive));
  schedule();
});

document.getElementById('resetBtn').addEventListener('click', reset);
screen.addEventListener('scroll', schedule);
window.addEventListener('resize', schedule);

const dialog = document.getElementById('methodDialog');
document.getElementById('methodBtn').addEventListener('click', () => dialog.showModal());
document.getElementById('closeDialog').addEventListener('click', () => dialog.close());
dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });

renderPalette();
setTimeout(reset, 50);
