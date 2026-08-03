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

function getInitialDefaults() {
  const mobile = window.matchMedia('(max-width: 700px)').matches;
  return mobile ? {
    image: [10, 12],
    title: [10, 154],
    rating: [10, 202],
    price: [10, 250],
    variants: [10, 298],
    cta: [10, 346],
    trust: [10, 394]
  } : {
    image: [16, 22],
    title: [16, 258],
    rating: [16, 318],
    price: [16, 378],
    variants: [16, 438],
    cta: [16, 498],
    trust: [16, 558]
  };
}

const stages = [
  ['image', 'title', 'rating'],
  ['price', 'discount'],
  ['variants', 'sizeChart'],
  ['cta', 'stickyCta']
];

const taskPath = ['image', 'title', 'rating', 'price', 'discount', 'variants', 'sizeChart', 'cta', 'trust', 'shipping', 'returns', 'stickyCta'];
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

// Semantic placement rules model what each PDP element means, not only where it sits.
// Exact pixel values are responsive heuristics; scores are comparison indices, not human probabilities.
const semanticRules = {
  identity: ['image', 'title', 'rating'],
  required: ['image', 'title', 'price', 'variants', 'cta'],
  recommended: ['rating', 'discount', 'sizeChart', 'trust', 'shipping', 'returns'],
  optional: ['stickyCta']
};

const palette = document.getElementById('palette');
const mobilePalette = document.getElementById('mobilePalette');
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
  balanced: { image:[16,22], title:[16,258], rating:[16,330], price:[16,398], variants:[16,466], sizeChart:[16,538], cta:[16,606], shipping:[16,678], returns:[16,746] },
  conversion: { image:[16,22], title:[16,250], rating:[16,318], price:[16,386], discount:[16,454], variants:[16,522], sizeChart:[16,594], cta:[16,662], trust:[16,734], shipping:[16,802], stickyCta:[16,910] },
  contentHeavy: { image:[16,22], title:[16,258], rating:[16,330], price:[16,398], discount:[16,466], variants:[16,534], sizeChart:[16,606], cta:[16,674], shipping:[16,746], returns:[16,814], trust:[16,882] }
};

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function uniq(arr) { return [...new Set(arr)]; }
function labelFor(id) { return defs.find(d => d.id === id)?.label || id; }
function importanceFor(id) { return defs.find(d => d.id === id)?.importance || 0.5; }
function round2(n) { return Math.round(n * 100) / 100; }
function fmt(n) { return Number.isFinite(n) ? n.toFixed(2) : '—'; }

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
  const marker = document.querySelector('.viewport-marker');
  if (marker && contentLayer) {
    const boundary = marker.offsetTop - contentLayer.offsetTop;
    if (boundary > 120) return boundary;
  }
  return Math.max(260, screen.clientHeight - 110);
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

function buildPaletteItem(d, mobile = false) {
  const el = document.createElement(mobile ? 'button' : 'div');
  el.className = mobile ? 'mobile-palette-item' : 'palette-item';
  el.dataset.id = d.id;
  if (!mobile) el.draggable = true;
  el.type = mobile ? 'button' : undefined;
  el.innerHTML = `
    <span class="palette-icon">${d.icon}</span>
    <span>
      <strong>${d.label}</strong>
      <small>${d.desc}${d.category === 'extra' ? ' · optional' : ''}</small>
    </span>`;

  if (!mobile) el.addEventListener('dragstart', () => dragId = d.id);
  el.addEventListener('click', () => {
    if (!placed.has(d.id)) {
      const p = getInitialDefaults()[d.id] || [16, Math.min(contentLayer.scrollHeight - 90, 580 + (placed.size * 44))];
      add(d.id, p[0], p[1]);
      selectedElementId = d.id;
      updateActiveLabel();
    } else {
      selectedElementId = d.id;
      updateActiveLabel();
      placed.get(d.id)?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
    }
    if (mobile) closeMobileElementSheet();
  });
  return el;
}

function renderPalette() {
  palette.innerHTML = '';
  if (mobilePalette) mobilePalette.innerHTML = '';
  defs.forEach(d => {
    palette.appendChild(buildPaletteItem(d, false));
    if (mobilePalette) mobilePalette.appendChild(buildPaletteItem(d, true));
  });
  syncPalette();
}

function syncPalette() {
  document.querySelectorAll('.palette-item, .mobile-palette-item').forEach(el => el.classList.toggle('used', placed.has(el.dataset.id)));
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
  if (active?.el) active.el.classList.remove('dragging');
  active = null;
  dragId = null;
  document.removeEventListener('pointermove', moveDrag);
  [...placed.values()].forEach(el => el.remove());
  placed.clear();
  presetSelect.value = 'custom';
  modeSelect.value = 'task';
  screen.scrollTop = 0;
  selectedElementId = null;
  lastComposite = 0;
  Object.entries(getInitialDefaults()).forEach(([id, pos]) => add(id, pos[0], pos[1]));
  syncPalette();
  updateActiveLabel();
  requestAnimationFrame(() => {
    screen.scrollTop = 0;
    analyze();
  });
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
  const b = box(placed.get(id));
  const boundary = viewportBoundary();
  const depth = Math.max(0, b.y - boundary);
  const belowFoldDecay = Math.exp(-depth / Math.max(1, boundary * 0.78));
  // A very small within-viewport depth term keeps the model continuous without
  // pretending that a one-pixel move creates a proven behavioral change.
  const withinViewportDepth = Math.min(b.y, boundary) / Math.max(1, boundary);
  const withinViewportFactor = 1 - 0.035 * withinViewportDepth;
  return clamp(100 * belowFoldDecay * withinViewportFactor, 0, 100);
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
  const scale = clamp(contentLayer.clientWidth / 380, 0.72, 1.22);
  relationshipRules.forEach(rule => {
    if (!placed.has(rule.a) || !placed.has(rule.b)) return;
    const gap = edgeGap(box(placed.get(rule.a)), box(placed.get(rule.b)));
    const comfortableGap = rule.ideal * scale;
    const decayRange = rule.tolerance * scale;
    // Proximity is monotonic: being closer than the comfortable range is not penalized here.
    // Overlap and excessive tightness are handled independently by crowding/occlusion.
    const excess = Math.max(0, gap - comfortableGap);
    const score = clamp(100 * Math.exp(-Math.pow(excess / Math.max(1, decayRange), 1.35)), 0, 100);
    details.push({ ...rule, ideal: comfortableGap, tolerance: decayRange, gap, score });
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



function normalizedVerticalPosition(id) {
  if (!placed.has(id)) return 1.5;
  return center(placed.get(id)).y / Math.max(1, viewportBoundary());
}

function relationDetail(relations, a, b) {
  return relations.find(r => r.a === a && r.b === b) || relations.find(r => r.a === b && r.b === a);
}

function proximityScore(relations, a, b) {
  return relationDetail(relations, a, b)?.score ?? 0;
}

function orderScore(a, b, softness = 0.07) {
  if (!placed.has(a) || !placed.has(b)) return 0;
  const h = Math.max(1, viewportBoundary());
  const dy = (center(placed.get(b)).y - center(placed.get(a)).y) / h;
  return sigmoid(dy / softness) * 100;
}

function earlyPlacementScore(id, preferred = 0.62, decay = 0.42) {
  if (!placed.has(id)) return 0;
  const y = normalizedVerticalPosition(id);
  if (y <= preferred) return 100 - y * 2.5;
  return clamp(100 * Math.exp(-(y - preferred) / decay), 0, 100);
}

function nearSameDecisionZone(a, b) {
  if (!placed.has(a) || !placed.has(b)) return 0;
  const h = Math.max(1, viewportBoundary());
  const dy = Math.abs(center(placed.get(a)).y - center(placed.get(b)).y) / h;
  return clamp(100 * Math.exp(-Math.pow(dy / 0.22, 1.35)), 0, 100);
}

function semanticPlacementAudit(per, relations) {
  const scores = {};
  const violations = [];
  const notices = [];
  const y = id => normalizedVerticalPosition(id);
  const vis = id => (per[id] ?? 0) * 100;
  const combine = parts => {
    const valid = parts.filter(v => Number.isFinite(v));
    if (!valid.length) return 0;
    // Geometric mean means one badly placed semantic dependency cannot hide behind averages.
    return Math.exp(valid.reduce((sum, v) => sum + Math.log(Math.max(1, v)), 0) / valid.length);
  };

  // Identity can be image-first OR title/reviews-first. What matters is a compact, early identity cluster.
  const identityPresent = semanticRules.identity.filter(id => placed.has(id));
  const identityEarly = identityPresent.length ? identityPresent.map(id => earlyPlacementScore(id, 0.70, 0.50)) : [0];
  const identityLinks = [];
  [['image','title'],['image','rating'],['title','rating']].forEach(([a,b]) => {
    if (placed.has(a) && placed.has(b)) identityLinks.push(proximityScore(relations,a,b));
  });
  const identityScore = combine(identityEarly.concat(identityLinks.length ? identityLinks : [70]));
  identityPresent.forEach(id => scores[id] = combine([identityScore, vis(id)]));

  if (placed.has('price')) {
    const identityText = ['title','rating'].filter(id => placed.has(id));
    const identityBottom = identityText.length ? Math.max(...identityText.map(id => box(placed.get(id)).bottom)) : (placed.has('image') ? box(placed.get('image')).bottom : 0);
    const priceBox = box(placed.get('price'));
    const identityRelation = Math.max(proximityScore(relations,'title','price'), placed.has('image') ? nearSameDecisionZone('image','price') : 0);
    const afterIdentity = sigmoid((priceBox.y - identityBottom + 70) / 35) * 100;
    scores.price = combine([vis('price'), earlyPlacementScore('price',0.88,0.38), identityRelation, afterIdentity]);
    if (y('price') > 1.12) violations.push({severity:'high', id:'price', text:'Price is too deep. It should appear in the early evaluation area, close to product identity.'});
    if (placed.has('variants') && orderScore('price','variants') < 55) violations.push({severity:'high', id:'price', text:'Price should be understood before the shopper reaches product options.'});
  } else scores.price = 0;

  if (placed.has('discount')) {
    const closeToPrice = proximityScore(relations,'price','discount');
    const sameZone = nearSameDecisionZone('price','discount');
    const beforeChoice = placed.has('variants') ? orderScore('discount','variants') : 100;
    const beforeAction = placed.has('cta') ? orderScore('discount','cta') : 100;
    scores.discount = combine([vis('discount'), closeToPrice, sameZone, beforeChoice, beforeAction]);
    if (!placed.has('price')) violations.push({severity:'high', id:'discount', text:'Discount badge has no price to qualify, so its meaning is disconnected.'});
    else if (closeToPrice < 68 || sameZone < 65) violations.push({severity:'high', id:'discount', text:'Discount badge should sit beside or directly around the price, not as a separate section.'});
    if (placed.has('cta') && center(placed.get('discount')).y > box(placed.get('cta')).bottom) violations.push({severity:'high', id:'discount', text:'Discount badge appears after Add to cart. Offer context should be understood before the action.'});
  }

  if (placed.has('variants')) {
    scores.variants = combine([vis('variants'), earlyPlacementScore('variants',1.18,0.50), placed.has('price') ? orderScore('price','variants') : 0]);
    if (placed.has('price') && orderScore('price','variants') < 55) violations.push({severity:'high', id:'variants', text:'Variants appear before the price is clearly evaluated.'});
    if (placed.has('cta') && orderScore('variants','cta') < 55) violations.push({severity:'critical', id:'variants', text:'Product options must come before Add to cart.'});
  } else scores.variants = 0;

  if (placed.has('sizeChart')) {
    const close = proximityScore(relations,'variants','sizeChart');
    const sameZone = nearSameDecisionZone('variants','sizeChart');
    const beforeAction = placed.has('cta') ? orderScore('sizeChart','cta') : 100;
    scores.sizeChart = combine([vis('sizeChart'), close, sameZone, beforeAction]);
    if (!placed.has('variants')) violations.push({severity:'high', id:'sizeChart', text:'Size chart is present without a size or option selector.'});
    else if (close < 72 || sameZone < 68) violations.push({severity:'high', id:'sizeChart', text:'Size chart should be attached to the size/options decision, not placed elsewhere on the page.'});
    if (placed.has('cta') && center(placed.get('sizeChart')).y > box(placed.get('cta')).bottom) violations.push({severity:'high', id:'sizeChart', text:'Size guidance appears after Add to cart, when it is already too late to support selection.'});
  } else if (placed.has('variants')) notices.push('Size chart is not placed. Add it when sizing uncertainty is relevant to the product.');

  if (placed.has('cta')) {
    const pair = proximityScore(relations,'variants','cta');
    const afterVariants = placed.has('variants') ? orderScore('variants','cta') : 0;
    scores.cta = combine([vis('cta'), foldScoreFor('cta'), pair, afterVariants]);
    if (placed.has('variants') && pair < 62) violations.push({severity:'critical', id:'cta', text:'Add to cart is disconnected from the option-selection area.'});
    if (foldScoreFor('cta') < 42) violations.push({severity:'critical', id:'cta', text:'Add to cart is too deep to provide a clear next action.'});
  } else scores.cta = 0;

  if (placed.has('rating')) {
    scores.rating = combine([vis('rating'), earlyPlacementScore('rating',0.82,0.55), Math.max(proximityScore(relations,'title','rating'), proximityScore(relations,'image','rating'))]);
  } else notices.push('Reviews are not placed. Social proof is recommended when rating data exists.');

  ['trust','shipping','returns'].forEach(id => {
    if (!placed.has(id)) {
      notices.push(`${labelFor(id)} is not placed. It is optional, but can reduce uncertainty when relevant.`);
      return;
    }
    const anchor = id === 'returns' && placed.has('shipping') ? 'shipping' : 'cta';
    const relation = anchor === 'shipping' ? proximityScore(relations,'shipping','returns') : proximityScore(relations,'cta',id);
    const notTooEarly = placed.has('cta') ? sigmoid((center(placed.get(id)).y - center(placed.get('cta')).y + 130) / 55) * 100 : 55;
    scores[id] = combine([vis(id), relation, notTooEarly]);
    if (placed.has('cta') && relation < 52) violations.push({severity:'medium', id, text:`${labelFor(id)} should support the purchase area rather than appear as unrelated content.`});
  });

  if (placed.has('stickyCta')) {
    const boundary = viewportBoundary();
    const stickyY = box(placed.get('stickyCta')).bottom;
    const viewportBottomFit = clamp(100 * Math.exp(-Math.abs(stickyY - boundary) / Math.max(50,boundary*.28)),0,100);
    scores.stickyCta = combine([vis('stickyCta'), viewportBottomFit]);
    if (viewportBottomFit < 55) violations.push({severity:'medium', id:'stickyCta', text:'Sticky CTA should behave like a viewport action bar, not ordinary page content.'});
  }

  semanticRules.required.forEach(id => {
    if (!placed.has(id)) violations.push({severity:'critical', id, text:`${labelFor(id)} is missing from the product decision flow.`});
  });

  const missing = defs.filter(d => !placed.has(d.id)).map(d => d.label);
  if (missing.length) notices.unshift(`Missing from the canvas: ${missing.join(', ')}.`);

  const weights = {image:.8,title:1, rating:.55,price:1.2,discount:.65,variants:1.2,sizeChart:.7,cta:1.35,trust:.45,shipping:.55,returns:.4,stickyCta:.35};
  let total=0, weight=0;
  Object.entries(scores).forEach(([id,score])=>{ const w=weights[id]||.5; total+=score*w; weight+=w; });
  let overall = weight ? total/weight : 0;
  const severityPenalty = violations.reduce((sum,v)=>sum+({critical:13,high:8,medium:4}[v.severity]||2),0);
  overall = clamp(overall-severityPenalty,0,100);
  return {overall,scores,violations,notices};
}

function criticalCoverageScore(per) {
  let total = 0;
  let weights = 0;
  const weightsMap = { image:0.72, title:0.88, price:1.0, variants:1.0, cta:1.18 };
  criticalIds.forEach(id => {
    const w = weightsMap[id] || 1;
    const present = placed.has(id) ? 1 : 0;
    const visible = placed.has(id) ? (per[id] ?? 0) : 0;
    total += 100 * present * visible * w;
    weights += w;
  });
  return weights ? total / weights : 0;
}

function actionReadinessScore(per) {
  if (!placed.has('cta')) return 0;
  const ctaVis = per.cta ?? 0;
  const ctaFold = foldScoreFor('cta') / 100;
  const variantPresent = placed.has('variants') ? 1 : 0;
  const variantVis = placed.has('variants') ? (per.variants ?? 0) : 0;
  let pairScore = 0;
  if (placed.has('variants')) {
    const relation = relationScores().find(r => r.a === 'variants' && r.b === 'cta');
    pairScore = relation ? relation.score / 100 : 0;
  }
  const primary = 100 * Math.pow(Math.max(0.0001, ctaVis * ctaFold), 0.68);
  const selection = 100 * variantPresent * variantVis;
  let score = 0.48 * primary + 0.24 * selection + 0.28 * (100 * pairScore);

  // A sticky CTA is support, not a replacement for a deeply buried primary action.
  if (placed.has('stickyCta')) {
    const stickySupport = (per.stickyCta ?? 0) * (foldScoreFor('stickyCta') / 100) * 12;
    score += stickySupport;
  }
  return clamp(score, 0, 100);
}

function decisionContinuityScore(per, relations) {
  const required = ['title','price','variants','cta'];
  if (required.some(id => !placed.has(id))) return 0;
  const pairKeys = [['title','price'],['price','variants'],['variants','cta']];
  const pairScores = pairKeys.map(([a,b]) => {
    const r = relations.find(x => x.a === a && x.b === b);
    return r ? r.score : 0;
  });
  const vertical = pairKeys.map(([a,b]) => sigmoid((center(placed.get(b)).y - center(placed.get(a)).y) / 28) * 100);
  const visibility = required.map(id => (per[id] ?? 0) * 100);
  const all = pairScores.concat(vertical, visibility);
  // Geometric mean prevents one broken stage from being hidden by strong averages elsewhere.
  const gm = Math.exp(all.reduce((sum,v) => sum + Math.log(Math.max(1,v)), 0) / all.length);
  return clamp(gm, 0, 100);
}

function taskFailureCaps(score, metrics, per) {
  let capped = score;
  if (!placed.has('cta')) capped = Math.min(capped, 24);
  if (!placed.has('variants')) capped = Math.min(capped, 30);
  if (!placed.has('price')) capped = Math.min(capped, 34);
  if (!placed.has('title')) capped = Math.min(capped, 38);
  if (!placed.has('image')) capped = Math.min(capped, 48);

  if (placed.has('cta')) {
    const fold = foldScoreFor('cta');
    const ctaVisible = (per.cta ?? 0) * 100;
    let foldCap = 100;
    if (fold < 18) foldCap = placed.has('stickyCta') ? 52 + 0.33 * fold : 38 + 0.22 * fold;
    else if (fold < 32) foldCap = placed.has('stickyCta') ? 58 + 0.64 * (fold - 18) : 42 + 0.86 * (fold - 18);
    else if (fold < 50) foldCap = 54 + (fold - 32);
    capped = Math.min(capped, foldCap);
    if (ctaVisible < 85) capped = Math.min(capped, 28 + 0.19 * ctaVisible);
  }

  if (metrics.action < 45) capped = Math.min(capped, 40 + 0.20 * metrics.action);
  if (metrics.continuity < 50) capped = Math.min(capped, 44 + 0.20 * metrics.continuity);
  if (metrics.critical < 82) capped = Math.min(capped, 45 + 0.207 * metrics.critical);
  return clamp(capped, 0, 100);
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
  return 0.13 * metrics.visibility + 0.11 * metrics.sequence + 0.10 * metrics.grouping + 0.08 * metrics.fold + 0.09 * metrics.spatial + 0.09 * metrics.relationship + 0.07 * metrics.scan + 0.06 * metrics.crowding + 0.12 * metrics.action + 0.09 * metrics.continuity + 0.06 * metrics.critical;
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

function buildReactions(per, relations, metrics, semanticAudit) {
  const reactions = [];
  semanticAudit.violations.slice().sort((a,b)=>({critical:0,high:1,medium:2}[a.severity]-{critical:0,high:1,medium:2}[b.severity])).slice(0,3).forEach(v=>reactions.push(v.text));
  const weakestRelation = [...relations].sort((a, b) => a.score - b.score)[0];
  if (weakestRelation && weakestRelation.score < 62) {
    reactions.push(`${weakestRelation.label} feels disconnected (${Math.round(weakestRelation.gap)}px edge gap).`);
  }
  if (!placed.has('price')) reactions.push('I cannot evaluate the offer because the price is missing.');
  if (!placed.has('variants')) reactions.push('I cannot make the required product choice.');
  if (!placed.has('cta')) reactions.push('I cannot see the next action.');
  else if (foldScoreFor('cta') < 32) reactions.push('I understand the product, but the purchase action is too far down the page.');

  Object.entries(per).forEach(([id, v]) => {
    if (v < 0.92) reactions.push(`${labelFor(id)} is ${Math.round((1 - v) * 100)}% covered.`);
  });

  if (metrics.fold < 68) reactions.push('Important information is losing discoverability as it moves deeper below the initial viewport.');
  if (metrics.scan < 65) reactions.push('The reading path requires extra horizontal movement or backward scanning.');
  if (metrics.crowding < 70) reactions.push('Nearby elements are increasing crowding pressure and visual competition.');
  if (metrics.sequence < 70) reactions.push('The decision stages are not progressing in a stable top-to-bottom order.');
  if (metrics.action < 60) reactions.push('The page explains the product better than it enables the purchase.');
  if (metrics.continuity < 60) reactions.push('I lose the connection between the offer, the choice, and the action.');

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
  if (metrics.action < 78) reasons.push('Action readiness uses a bottleneck rule: CTA visibility, depth, option-to-action proximity, and selection availability must all remain usable.');
  if (metrics.continuity < 78) reasons.push('Decision continuity uses a geometric mean so one broken stage cannot be hidden by high averages elsewhere.');
  if (metrics.spatial < 82) reasons.push('Semantic placement checks each element by role: offer context stays with price, selection help stays with variants, and purchase support stays near the action zone.');
  if (modeSelect.value === 'gutenberg') {
    reasons.push('Gutenberg contributes only as a comparison heuristic and cannot override missing or obscured task-critical elements.');
  }
  reasons.push('The displayed numbers are model indices for comparison, not biometric eye-tracking probabilities.');
  return uniq(reasons).slice(0, 5);
}

function drawPath(per) {
  pathLayer.innerHTML = '';
  let ids = stages.flatMap(stage => stage.filter(id => placed.has(id) && (per[id] ?? 1) > 0.45).sort((a,b)=>center(placed.get(a)).y-center(placed.get(b)).y));
  const support = ['trust','shipping','returns'].filter(id => placed.has(id) && (per[id] ?? 1) > 0.45).sort((a,b)=>center(placed.get(a)).y-center(placed.get(b)).y);
  ids = ids.concat(support.filter(id => !ids.includes(id)));
  if (modeSelect.value === 'gutenberg') ids = ['title', 'image', 'price', 'cta'].filter(id => placed.has(id) && (per[id] ?? 1) > 0.45).sort((a,b)=>center(placed.get(a)).y-center(placed.get(b)).y);
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
  const actionModifier = id === 'cta' ? (0.55 + 0.45 * metrics.action / 100) : 1;
  return clamp(100 * visibility * (0.48 + 0.30 * fold + 0.22 * importance) * (0.88 + metrics.grouping / 833) * actionModifier, 0, 100);
}

function drawHeatmap(per, metrics) {
  heatmapLayer.innerHTML = '';
  heatmapLayer.classList.toggle('active', heatmapActive);
  if (!heatmapActive) return;

  const ranked = [...placed.entries()]
    .map(([id, el]) => ({ id, point: center(el), score: elementAttention(id, per, metrics) }))
    .sort((a, b) => b.score - a.score);

  const maxScore = ranked[0]?.score || 1;
  const minScore = ranked[ranked.length - 1]?.score || 0;
  const spread = Math.max(8, maxScore - minScore);

  ranked.forEach((entry, idx) => {
    const normalized = clamp((entry.score - minScore) / spread, 0, 1);
    const size = 72 + normalized * 170;
    const palette = normalized >= .78
      ? { core:'rgba(239,68,68,.62)', mid:'rgba(249,115,22,.32)' }
      : normalized >= .52
        ? { core:'rgba(249,115,22,.54)', mid:'rgba(250,204,21,.28)' }
        : normalized >= .28
          ? { core:'rgba(250,204,21,.44)', mid:'rgba(163,230,53,.20)' }
          : { core:'rgba(59,130,246,.30)', mid:'rgba(34,197,94,.14)' };

    const spot = document.createElement('div');
    spot.className = 'heat-spot';
    spot.style.left = `${entry.point.x}px`;
    spot.style.top = `${entry.point.y}px`;
    spot.style.width = `${size}px`;
    spot.style.height = `${size}px`;
    spot.style.opacity = `${0.58 + normalized * 0.38}`;
    spot.style.background = `radial-gradient(circle, ${palette.core} 0%, ${palette.mid} 38%, rgba(255,255,255,0) 76%)`;
    heatmapLayer.appendChild(spot);

    if (idx < 4) {
      const tag = document.createElement('div');
      tag.className = 'heat-tag';
      tag.style.left = `${entry.point.x}px`;
      tag.style.top = `${entry.point.y}px`;
      tag.textContent = `${idx + 1}`;
      tag.title = `${labelFor(entry.id)} attention index: ${entry.score.toFixed(1)}`;
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
  const spatialBase = spatialExpectationScore(relations);
  const semanticAudit = semanticPlacementAudit(per, relations);
  const spatial = 0.32 * spatialBase + 0.68 * semanticAudit.overall;
  const relationship = relationshipIntegrityScore(relations, per);
  const sequence = sequenceScoreContinuous();
  const scan = scanEfficiencyScore();
  const crowding = crowdingControlScore(per);
  const attention = attentionPotentialScore(per, grouping, fold, spatial);
  const action = actionReadinessScore(per);
  const continuity = decisionContinuityScore(per, relations);
  const criticalCoverage = criticalCoverageScore(per);

  const metrics = { visibility, grouping, fold, spatial, relationship, sequence, scan, crowding, attention, action, continuity, critical: criticalCoverage };
  let composite = applyHardConstraints(modeScore(metrics), per);
  composite = taskFailureCaps(composite, metrics, per);
  const semanticCritical = semanticAudit.violations.filter(v => v.severity === 'critical');
  const semanticHigh = semanticAudit.violations.filter(v => v.severity === 'high');
  if (semanticCritical.length) composite = Math.min(composite, 44);
  else if (semanticHigh.length >= 2) composite = Math.min(composite, 58);
  else if (semanticHigh.length === 1) composite = Math.min(composite, 69);
  composite = clamp(composite, 0, 100);
  lastComposite = composite;

  applyOcclusionStyles(per);

  const critical = [];
  // Action blockers are prioritized because they stop task completion.
  if (!placed.has('cta')) critical.push('Add to cart is missing, so the purchase task cannot be completed.');
  else if ((per.cta ?? 1) < 0.85) critical.push(`Add to cart is ${Math.round((1 - per.cta) * 100)}% hidden.`);
  else if (foldScoreFor('cta') < 32) critical.push(`Add to cart is too deep in the page to support action readiness (${foldScoreFor('cta').toFixed(1)} discoverability).`);

  if (placed.has('variants') && placed.has('cta')) {
    const vr = relations.find(r => r.a === 'variants' && r.b === 'cta');
    if (vr && vr.score < 42) critical.push(`Variants and Add to cart are disconnected (${Math.round(vr.gap)}px edge gap).`);
  }

  criticalIds.filter(id => id !== 'cta').forEach(id => {
    if (!placed.has(id)) critical.push(`${labelFor(id)} is missing.`);
    else if ((per[id] ?? 1) < 0.85) critical.push(`${labelFor(id)} is ${Math.round((1 - per[id]) * 100)}% hidden.`);
  });

  semanticAudit.violations.filter(v => v.severity === 'critical').forEach(v => critical.push(v.text));

  const findings = [];
  semanticAudit.violations.filter(v => v.severity !== 'critical').forEach(v => findings.push(v.text));
  semanticAudit.notices.slice(0, 3).forEach(v => findings.push(v));
  const weakestRelations = [...relations].sort((a, b) => a.score - b.score).slice(0, 2);
  weakestRelations.forEach(r => {
    if (r.score < 72) findings.push(`Reduce the ${Math.round(r.gap)}px edge gap for ${r.label}; current relationship score is ${r.score.toFixed(1)}.`);
  });
  if (fold < 74) findings.push('Move high-importance elements upward gradually; fold discoverability is decaying with vertical depth.');
  if (sequence < 74) findings.push('Improve the vertical progression between decision stages to reduce order reversals.');
  if (scan < 74) findings.push('Reduce horizontal detours and backward scanning between decision stages.');
  if (crowding < 74) findings.push('Increase separation or remove overlap where nearby elements create crowding pressure.');
  if (relationship < 74) findings.push('Strengthen the visibility and distance of semantically related element pairs.');
  if (action < 74) findings.push('Improve action readiness: keep the primary CTA visible, reachable after option selection, and close to the variants.');
  if (continuity < 74) findings.push('Repair the title → price → variants → CTA decision chain; one weak stage is lowering the whole path.');
  if (criticalCoverage < 90) findings.push('Restore full visibility for all task-critical elements; averages cannot compensate for a weak critical stage.');
  if (modeSelect.value === 'gutenberg') findings.push('Treat Gutenberg as a comparison heuristic only; product-task constraints remain primary.');
  if (!critical.length && findings.length === 0) findings.push('The current layout has strong continuous scores across visibility, flow, grouping, and relationship integrity.');

  const reactions = buildReactions(per, relations, metrics, semanticAudit);
  const evidence = scientificReasons(metrics, relations, per);

  updateUI({ composite, metrics, critical, findings: uniq(findings).slice(0, 9), reactions, evidence, semanticAudit });
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

  const actionBlocked = critical.some(x => /Add to cart|Product options must|Variants and Add/i.test(x));
  const hasCritical = critical.length > 0;

  let state = 'hesitant';
  let moodText = 'Hesitant';
  let quoteText = reactions[0] || 'I need to look around before I can decide.';
  let subText = 'The page works, but the decision path still requires extra effort.';

  if (actionBlocked) {
    state = 'critical';
    moodText = 'Blocked';
    quoteText = reactions.find(x => /purchase action|next action|explains the product/i.test(x)) || 'I understand parts of the page, but I cannot complete the purchase confidently.';
    subText = 'The purchase action is missing, too deep, hidden, or disconnected from option selection.';
  } else if (score < 65 || hasCritical) {
    state = 'critical';
    moodText = score < 40 ? 'Frustrated' : 'Confused';
    quoteText = reactions[0] || 'This page is making me work too hard.';
    subText = 'Low clarity means important information is hidden, misplaced, crowded, or disconnected.';
  } else if (score < 80) {
    state = 'hesitant';
    moodText = 'Uncertain';
    quoteText = reactions[0] || 'I can continue, but I still need to search.';
    subText = 'The layout is usable, but the weak score should still feel visibly uncomfortable.';
  } else if (score < 90) {
    state = 'good';
    moodText = 'Comfortable';
    quoteText = reactions[0] || 'This is mostly clear, with one relationship still slowing me down.';
    subText = 'The shopper can progress, but the page is not yet fully resolved.';
  } else {
    state = 'satisfied';
    moodText = 'Satisfied';
    quoteText = 'Everything feels clear. I know what to do next.';
    subText = 'Critical elements are visible, semantically related, and arranged in a low-cost scan path.';
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


function updateElementDiagnosis(r) {
  const el = document.getElementById('elementDiagnosis');
  if (!el) return;
  if (!selectedElementId) {
    el.textContent = 'Select an element to see whether its meaning, order, and relationships are correct.';
    return;
  }
  const score = r.semanticAudit?.scores?.[selectedElementId];
  const issue = r.semanticAudit?.violations?.find(v => v.id === selectedElementId);
  if (issue) el.textContent = issue.text;
  else if (Number.isFinite(score)) el.textContent = `${labelFor(selectedElementId)} semantic placement: ${score.toFixed(1)} / 100.`;
  else el.textContent = `${labelFor(selectedElementId)} is not currently part of the active layout.`;
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
  document.getElementById('actionReadiness').textContent = fmt(r.metrics.action);
  document.getElementById('decisionContinuity').textContent = fmt(r.metrics.continuity);
  document.getElementById('criticalCoverage').textContent = fmt(r.metrics.critical);
  updateActiveLabel();
  updateDelta(score);
  updateElementDiagnosis(r);

  const criticalBanner = document.getElementById('criticalBanner');
  criticalBanner.hidden = !r.critical.length;
  criticalBanner.textContent = r.critical[0] || '';

  document.getElementById('shopperText').textContent =
    score >= 85 && r.metrics.action >= 80 ? 'The shopper can identify, evaluate, choose, and act with low simulated scan cost.' :
    score >= 70 ? 'The layout is workable, but small spatial changes still alter grouping, discoverability, and scan efficiency.' :
    score >= 50 ? 'The shopper needs extra scanning to reconstruct relationships between important elements.' :
    'Critical information is missing, obscured, crowded, or placed in a high-cost decision path.';

  updateList('findings', r.critical.concat(r.findings).slice(0, 9));
  updateList('reactions', r.reactions);
  updateList('evidenceList', r.evidence);
  updateCharacter(score, r.critical, r.reactions);

  const primary = r.critical[0] || r.reactions[0] || r.findings[0] || 'No major friction detected';
  const nextMove = score >= 85 ? 'Validate the model with real users or controlled testing' : (r.findings[0] || 'Reduce distance between related elements');
  document.getElementById('primaryFriction').textContent = primary;
  document.getElementById('bestNextMove').textContent = nextMove;
}


function openMobileElementSheet() {
  const sheet = document.getElementById('mobileElementSheet');
  const btn = document.getElementById('mobileAddBtn');
  if (!sheet) return;
  sheet.hidden = false;
  requestAnimationFrame(() => sheet.classList.add('open'));
  btn?.setAttribute('aria-expanded', 'true');
  document.body.classList.add('sheet-open');
}

function closeMobileElementSheet() {
  const sheet = document.getElementById('mobileElementSheet');
  const btn = document.getElementById('mobileAddBtn');
  if (!sheet || sheet.hidden) return;
  sheet.classList.remove('open');
  btn?.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('sheet-open');
  setTimeout(() => { if (!sheet.classList.contains('open')) sheet.hidden = true; }, 220);
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

document.getElementById('mobileAddBtn')?.addEventListener('click', openMobileElementSheet);
document.getElementById('mobileSheetClose')?.addEventListener('click', closeMobileElementSheet);
document.getElementById('mobileSheetBackdrop')?.addEventListener('click', closeMobileElementSheet);
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMobileElementSheet(); });


function openWelcome() {
  const modal = document.getElementById('welcomeModal');
  if (!modal) return;
  modal.hidden = false;
  document.body.classList.add('welcome-open');
  requestAnimationFrame(() => modal.classList.add('is-visible'));
}

function closeWelcome() {
  const modal = document.getElementById('welcomeModal');
  if (!modal) return;
  modal.classList.remove('is-visible');
  document.body.classList.remove('welcome-open');
  window.setTimeout(() => { modal.hidden = true; }, 260);
  try { sessionStorage.setItem('attentionLabWelcomeSeen', '1'); } catch (_) {}
}

document.getElementById('welcomeStartBtn')?.addEventListener('click', closeWelcome);
document.getElementById('welcomeCloseBtn')?.addEventListener('click', closeWelcome);
document.getElementById('welcomeBackdrop')?.addEventListener('click', closeWelcome);

renderPalette();
setTimeout(() => {
  reset();
  let seen = false;
  try { seen = sessionStorage.getItem('attentionLabWelcomeSeen') === '1'; } catch (_) {}
  if (!seen) openWelcome();
}, 50);
