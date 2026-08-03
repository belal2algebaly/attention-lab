const defs = [
  { id: 'image', label: 'Product image', icon: '▧', desc: 'Identify the product', category: 'core' },
  { id: 'title', label: 'Product title', icon: 'T', desc: 'Understand what it is', category: 'core' },
  { id: 'rating', label: 'Reviews', icon: '★', desc: 'Evaluate trust', category: 'core' },
  { id: 'price', label: 'Price', icon: '$', desc: 'Evaluate cost', category: 'core' },
  { id: 'discount', label: 'Discount badge', icon: '%', desc: 'Adds offer context', category: 'extra' },
  { id: 'variants', label: 'Size / options', icon: '⌘', desc: 'Make a required choice', category: 'core' },
  { id: 'sizeChart', label: 'Size chart', icon: '尺', desc: 'Helps option confidence', category: 'extra' },
  { id: 'trust', label: 'Trust badges', icon: '✓', desc: 'Reduces risk', category: 'extra' },
  { id: 'shipping', label: 'Shipping info', icon: '↗', desc: 'Reduces delivery uncertainty', category: 'extra' },
  { id: 'returns', label: 'Returns policy', icon: '↺', desc: 'Reduces purchase anxiety', category: 'extra' },
  { id: 'cta', label: 'Add to cart', icon: '＋', desc: 'Complete the next action', category: 'core' },
  { id: 'stickyCta', label: 'Sticky CTA bar', icon: '▁', desc: 'Secondary action support', category: 'extra' }
];

const initialDefaults = {
  image: [16, 22],
  title: [16, 258],
  rating: [16, 314],
  price: [16, 360],
  variants: [16, 420],
  cta: [16, 500]
};

const recommendedTaskOrder = ['image', 'title', 'rating', 'price', 'discount', 'variants', 'sizeChart', 'trust', 'shipping', 'returns', 'cta', 'stickyCta'];
const criticalIds = ['image', 'title', 'price', 'variants', 'cta'];

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

const presets = {
  balanced: {image:[16,22],title:[16,258],rating:[16,314],price:[16,360],variants:[16,420],sizeChart:[210,424],cta:[16,500],shipping:[16,565],returns:[16,625]},
  conversion: {image:[16,22],title:[16,250],price:[16,305],rating:[210,309],discount:[245,250],variants:[16,365],sizeChart:[220,371],trust:[16,430],cta:[16,490],shipping:[16,555],stickyCta:[16,690]},
  contentHeavy: {image:[16,22],title:[16,258],rating:[16,314],price:[16,360],discount:[235,360],variants:[16,430],sizeChart:[220,436],shipping:[16,500],returns:[16,560],trust:[16,620],cta:[16,690]}
};

function applyPreset(name) {
  if (!presets[name]) return;
  [...placed.values()].forEach(el => el.remove());
  placed.clear();
  Object.entries(presets[name]).forEach(([id, pos]) => add(id, pos[0], pos[1]));
  screen.scrollTop = 0;
  schedule();
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function uniq(arr) { return [...new Set(arr)]; }
function labelFor(id) { return defs.find(d => d.id === id)?.label || id; }

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
    x: parseFloat(el.style.left) + el.offsetWidth / 2,
    y: parseFloat(el.style.top) + el.offsetHeight / 2
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

function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

function renderPalette() {
  palette.innerHTML = '';
  defs.forEach(d => {
    const el = document.createElement('div');
    el.className = 'palette-item';
    el.dataset.id = d.id;
    el.draggable = true;
    el.innerHTML = `
      <span class="palette-icon">${d.icon}</span>
      <span>
        <strong>${d.label}</strong>
        <small>${d.desc}${d.category === 'extra' ? ' · optional' : ''}</small>
      </span>`;
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

function createItemMarkup(d) {
  return `<strong>${d.label}</strong><small>${d.desc}</small>`;
}

function add(id, x, y) {
  const d = defs.find(v => v.id === id);
  if (!d) return;

  let el = placed.get(id);
  if (!el) {
    el = document.createElement('div');
    el.className = 'canvas-item';
    el.dataset.type = id;
    el.innerHTML = createItemMarkup(d);
    el.addEventListener('pointerdown', startDrag);
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
  syncPalette();
  schedule();
}

function reset() {
  [...placed.values()].forEach(el => el.remove());
  placed.clear();
  Object.entries(initialDefaults).forEach(([id, pos]) => add(id, pos[0], pos[1]));
  presetSelect.value = 'custom';
  screen.scrollTop = 0;
  schedule();
}

contentLayer.addEventListener('dragover', e => e.preventDefault());
contentLayer.addEventListener('drop', e => {
  e.preventDefault();
  if (!dragId) return;
  presetSelect.value = 'custom';
  const rect = contentLayer.getBoundingClientRect();
  const x = e.clientX - rect.left - 74;
  const y = e.clientY - rect.top - 24 + screen.scrollTop;
  add(dragId, x, y);
  dragId = null;
});

function startDrag(e) {
  if (e.button !== undefined && e.button !== 0) return;
  presetSelect.value = 'custom';
  const el = e.currentTarget;
  active = {
    el,
    startLeft: parseFloat(el.style.left) || 0,
    startTop: parseFloat(el.style.top) || 0,
    startPointerX: e.clientX,
    startPointerY: e.clientY,
    startScroll: screen.scrollTop,
    pointerId: e.pointerId
  };
  el.classList.add('dragging');
  el.setPointerCapture?.(e.pointerId);
  e.preventDefault();
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

function visibilityMap() {
  const entries = [...placed.entries()];
  const per = {};
  entries.forEach(([id]) => per[id] = 1);

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const [aId, aEl] = entries[i];
      const [bId, bEl] = entries[j];
      const area = overlap(box(aEl), box(bEl));
      if (!area) continue;
      per[aId] = Math.max(0, per[aId] - area / (aEl.offsetWidth * aEl.offsetHeight));
      per[bId] = Math.max(0, per[bId] - area / (bEl.offsetWidth * bEl.offsetHeight));
    }
  }
  return per;
}

function visibleBeforeScroll(id) {
  if (!placed.has(id)) return false;
  return box(placed.get(id)).y < 530;
}

function applyOcclusionStyles(per) {
  placed.forEach((el, id) => {
    const hiddenPct = Math.round((1 - (per[id] ?? 1)) * 100);
    el.classList.toggle('occluded', hiddenPct > 4);
    el.classList.toggle('critical-highlight', criticalIds.includes(id));
    el.dataset.hidden = hiddenPct;
  });
}

function sequenceScore() {
  const present = recommendedTaskOrder.filter(id => placed.has(id));
  if (present.length < 2) return 0;
  let good = 0;
  for (let i = 1; i < present.length; i++) {
    const prev = center(placed.get(present[i - 1]));
    const next = center(placed.get(present[i]));
    if (next.y >= prev.y - 14) good++;
  }
  return Math.round((good / (present.length - 1)) * 100);
}

function groupingScore() {
  const pairs = [
    ['title', 'price'],
    ['price', 'variants'],
    ['variants', 'sizeChart'],
    ['variants', 'cta'],
    ['cta', 'trust'],
    ['cta', 'shipping'],
    ['shipping', 'returns']
  ];
  const vals = pairs
    .filter(([a, b]) => placed.has(a) && placed.has(b))
    .map(([a, b]) => clamp(120 - (dist(center(placed.get(a)), center(placed.get(b))) / 3), 0, 100));
  return vals.length ? Math.round(vals.reduce((s, v) => s + v, 0) / vals.length) : 0;
}

function buildReactions(per) {
  const reactions = [];

  if (placed.has('sizeChart') && placed.has('variants')) {
    const d = dist(center(placed.get('sizeChart')), center(placed.get('variants')));
    if (d > 220) reactions.push('Where is the size chart? I expect it next to the variants, not far away.');
  }
  if (placed.has('price') && placed.has('title')) {
    const d = dist(center(placed.get('price')), center(placed.get('title')));
    if (d > 220) reactions.push('I found the product name, but I had to search for the price.');
  }
  if (placed.has('cta') && placed.has('variants')) {
    const d = dist(center(placed.get('cta')), center(placed.get('variants')));
    if (d > 220) reactions.push('The purchase button feels disconnected from the option selection.');
  }
  if (placed.has('shipping') && placed.has('cta')) {
    const d = dist(center(placed.get('shipping')), center(placed.get('cta')));
    if (d > 260) reactions.push('I want shipping details closer to the decision zone.');
  }
  if (placed.has('returns') && placed.has('cta')) {
    const d = dist(center(placed.get('returns')), center(placed.get('cta')));
    if (d > 280) reactions.push('I’m unsure about returns because the policy feels too far away.');
  }

  Object.entries(per).forEach(([id, v]) => {
    if (v < 0.9) reactions.push(`${labelFor(id)} is being covered, so I may miss it.`);
  });

  if (!visibleBeforeScroll('price')) reactions.push('I did not see the price before scrolling.');
  if (!visibleBeforeScroll('variants')) reactions.push('I cannot choose size quickly because options are below the first viewport.');
  if (!visibleBeforeScroll('cta')) reactions.push('The next step is hidden below the first viewport.');
  if (placed.size > 9) reactions.push('There is a lot competing for my attention. I need clearer prioritization.');
  if (placed.has('discount') && placed.has('price') && dist(center(placed.get('discount')), center(placed.get('price'))) > 180) reactions.push('The discount does not feel connected to the price.');

  return uniq(reactions).slice(0, 6);
}

function evidenceFor(findings, critical) {
  const evidence = [];
  if (critical.length) evidence.push('Visibility and visual crowding: hidden or overlapped critical content cannot support a clear decision.');
  if (findings.some(f => /size chart|variants|price|purchase button|decision zone/i.test(f))) evidence.push('Gestalt proximity / grouping: related elements are easier to interpret when they are near one another.');
  if (findings.some(f => /before scrolling|viewport/i.test(f))) evidence.push('Initial viewport attention: early-visible information is easier to discover in the first scan.');
  if (findings.some(f => /search|sequence|disconnected|next step/i.test(f))) evidence.push('Task-flow support and information scent: shoppers move better when the sequence of information matches the purchase task.');
  if (modeSelect.value === 'gutenberg') evidence.push('Gutenberg diagram is included as a comparison heuristic only, not as a universal law.');
  if (!evidence.length) evidence.push('All major recommendations currently align with visibility, grouping, and task-flow support.');
  return uniq(evidence).slice(0, 5);
}

function updateCharacter(score, critical, reactions) {
  const stage = document.getElementById('characterStage');
  const mood = document.getElementById('characterMood');
  const quote = document.getElementById('characterQuote');
  const sub = document.getElementById('characterSubtext');

  let state = 'hesitant';
  let moodText = 'Hesitant';
  let quoteText = 'I need to look around before I can decide.';
  let subText = 'The page is usable, but something in the flow still slows me down.';

  if (score >= 86) {
    state = 'satisfied';
    moodText = 'Satisfied';
    quoteText = 'Everything feels clear. I know what to do next.';
    subText = 'The key information is visible, grouped, and in a usable order.';
  } else if (score >= 70) {
    state = 'good';
    moodText = 'Comfortable';
    quoteText = 'This is mostly clear, but one thing still makes me pause.';
    subText = reactions[0] || 'A small layout issue is slowing the decision.';
  } else if (score < 50 || critical.length) {
    state = 'critical';
    moodText = 'Confused';
    quoteText = reactions[0] || 'I cannot find the information I need.';
    subText = 'Critical content is missing, hidden, or too disconnected to support the task.';
  }

  stage.dataset.mood = state;
  mood.textContent = moodText;
  quote.textContent = quoteText;
  sub.textContent = subText;
}

function drawPath(per) {
  pathLayer.innerHTML = '';
  let ids = recommendedTaskOrder.filter(id => placed.has(id) && (per[id] ?? 1) > 0.5);
  if (modeSelect.value === 'gutenberg') ids = ['title', 'image', 'price', 'cta'].filter(id => placed.has(id) && (per[id] ?? 1) > 0.5);
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

function attentionWeight(id, per) {
  let w = 0;
  const vis = per[id] ?? 0;
  const visibleBoost = visibleBeforeScroll(id) ? 18 : 0;
  const base = {
    image: 22, title: 18, rating: 10, price: 16, discount: 10, variants: 15,
    sizeChart: 8, trust: 7, shipping: 7, returns: 6, cta: 20, stickyCta: 14
  }[id] || 5;
  w += base + visibleBoost + (vis * 28);
  if (id === 'sizeChart' && placed.has('variants')) w += clamp(14 - (dist(center(placed.get('sizeChart')), center(placed.get('variants'))) / 22), -8, 10);
  if (id === 'cta' && placed.has('variants')) w += clamp(16 - (dist(center(placed.get('cta')), center(placed.get('variants'))) / 18), -10, 12);
  return Math.max(0, Math.round(w));
}

function drawHeatmap(per) {
  heatmapLayer.innerHTML = '';
  heatmapLayer.classList.toggle('active', heatmapActive);
  if (!heatmapActive) return;

  const ranked = [...placed.entries()].map(([id, el]) => ({ id, el, point: center(el), weight: attentionWeight(id, per) })).sort((a, b) => b.weight - a.weight);
  ranked.forEach((entry, idx) => {
    const { point, weight } = entry;
    const spot = document.createElement('div');
    const size = clamp(weight * 2.9, 80, 250);
    const color = weight > 55 ? 'rgba(255,96,78,.50)' : weight > 43 ? 'rgba(255,176,66,.42)' : 'rgba(255,223,98,.30)';
    spot.className = 'heat-spot';
    spot.style.left = `${point.x}px`;
    spot.style.top = `${point.y}px`;
    spot.style.width = `${size}px`;
    spot.style.height = `${size}px`;
    spot.style.background = `radial-gradient(circle, ${color} 0%, rgba(255,224,115,.20) 42%, rgba(255,250,240,0) 78%)`;
    heatmapLayer.appendChild(spot);

    if (idx < 3) {
      const tag = document.createElement('div');
      tag.className = 'heat-tag';
      tag.style.left = `${point.x}px`;
      tag.style.top = `${point.y}px`;
      tag.textContent = idx + 1;
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
  applyOcclusionStyles(per);

  const critical = [];
  criticalIds.forEach(id => {
    if (!placed.has(id)) critical.push(`${labelFor(id)} is missing.`);
    else if ((per[id] ?? 1) < 0.85) critical.push(`${labelFor(id)} is ${Math.round((1 - per[id]) * 100)}% hidden.`);
  });
  if (placed.has('sizeChart') && !placed.has('variants')) critical.push('Size chart is present without option selectors, so its context is unclear.');

  const visVals = Object.values(per);
  const visibilityScore = visVals.length ? Math.round((visVals.reduce((a, b) => a + b, 0) / visVals.length) * 100) : 0;
  const seqScore = sequenceScore();
  const groupScore = groupingScore();

  let modeFit = seqScore;
  if (modeSelect.value === 'grouping') modeFit = Math.round((groupScore + visibilityScore) / 2);
  if (modeSelect.value === 'gutenberg') {
    const titleOk = placed.has('title') ? (center(placed.get('title')).x < contentLayer.clientWidth * 0.58 && center(placed.get('title')).y < 430) : false;
    const ctaOk = placed.has('cta') ? (center(placed.get('cta')).x > contentLayer.clientWidth * 0.42 && center(placed.get('cta')).y > 380) : false;
    modeFit = Math.round(((titleOk ? 100 : 38) + (ctaOk ? 100 : 38)) / 2);
  }

  const findings = [];
  if (seqScore < 72) findings.push('Reorder the page so the shopper can move from product identity to price, options, and action without backtracking.');
  if (groupScore < 72) findings.push('Pull related elements closer together so they read as one decision block.');
  if (!visibleBeforeScroll('price')) findings.push('Move the price into the initial viewport so the shopper can evaluate the offer early.');
  if (!visibleBeforeScroll('variants')) findings.push('Move the size / options selector closer to the top of the product decision area.');
  if (!visibleBeforeScroll('cta')) findings.push('Bring Add to Cart higher or provide a supporting sticky CTA so the next step is easier to find.');

  if (placed.has('sizeChart') && placed.has('variants') && dist(center(placed.get('sizeChart')), center(placed.get('variants'))) > 220) findings.push('Place the size chart close to the variants because users expect help exactly where they choose a size.');
  if (placed.has('trust') && placed.has('cta') && dist(center(placed.get('trust')), center(placed.get('cta'))) > 260) findings.push('Place trust badges closer to the action area so reassurance supports the decision moment.');
  if (placed.has('shipping') && placed.has('cta') && dist(center(placed.get('shipping')), center(placed.get('cta'))) > 260) findings.push('Move shipping information closer to the CTA so uncertainty is reduced at the moment of choice.');

  Object.entries(per).forEach(([id, v]) => {
    if (v < 0.95) findings.push(`${labelFor(id)} is partially covered. Remove overlap so it stays recognizable.`);
  });
  if (modeSelect.value === 'gutenberg') findings.push('Use Gutenberg only as a comparison lens. Do not let it override product-page task requirements.');

  let score = Math.round((visibilityScore * 0.38) + (seqScore * 0.30) + (groupScore * 0.20) + (modeFit * 0.12));
  if (critical.length) score = Math.min(score, 44);
  if (!visibleBeforeScroll('price')) score -= 8;
  if (!visibleBeforeScroll('cta')) score -= 8;
  if (!visibleBeforeScroll('variants')) score -= 6;
  score = clamp(score, 0, 100);

  if (!critical.length && findings.length === 0) findings.push('All critical elements are visible, logically ordered, and grouped in a way that supports the shopping task.');

  const reactions = buildReactions(per);
  const evidence = evidenceFor(findings, critical);

  updateUI({
    score,
    visibilityScore,
    seqScore,
    groupScore,
    critical,
    findings: uniq(findings).slice(0, 7),
    reactions,
    evidence
  });
  drawPath(per);
  drawHeatmap(per);
}

function updateList(id, items) {
  const ul = document.getElementById(id);
  ul.innerHTML = '';
  if (!items.length) items = ['No items yet.'];
  items.forEach(text => {
    const li = document.createElement('li');
    li.textContent = text;
    ul.appendChild(li);
  });
}

function updateUI(r) {
  document.getElementById('score').textContent = r.score;
  document.getElementById('scoreFill').style.width = `${r.score}%`;
  document.getElementById('scoreState').textContent = grade(r.score);
  document.getElementById('visibility').textContent = r.visibilityScore;
  document.getElementById('sequence').textContent = r.seqScore;
  document.getElementById('grouping').textContent = r.groupScore;

  const criticalBanner = document.getElementById('criticalBanner');
  criticalBanner.hidden = !r.critical.length;
  criticalBanner.textContent = r.critical[0] || '';

  document.getElementById('shopperText').textContent =
    r.score >= 85 ? 'The shopper can identify the product, evaluate it, choose options, and act with very little searching.' :
    r.score >= 70 ? 'The page is workable, but a few spatial relationships still slow the decision.' :
    r.score >= 50 ? 'The shopper needs to search around and reconstruct the decision flow.' :
    'Critical information is missing, buried, or disconnected, so the purchase path feels difficult.';

  updateList('findings', (r.critical.concat(r.findings)).slice(0, 7));
  updateList('reactions', r.reactions);
  updateList('evidenceList', r.evidence);
  updateCharacter(r.score, r.critical, r.reactions);

  const primary = r.critical[0] || r.reactions[0] || r.findings[0] || 'No major friction detected';
  const nextMove = r.score >= 85 ? 'Keep the layout and validate it with real users' : (r.findings[0] || 'Reduce distance between related elements');
  document.getElementById('primaryFriction').textContent = primary;
  document.getElementById('bestNextMove').textContent = nextMove;
}

modeSelect.addEventListener('change', () => {
  document.getElementById('modeText').textContent =
    modeSelect.value === 'task' ? 'Can the shopper identify, evaluate, choose and act?' :
    modeSelect.value === 'grouping' ? 'Are related elements close, visible, and easy to read as one group?' :
    'Does the layout loosely resemble the Gutenberg diagonal heuristic?';
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
