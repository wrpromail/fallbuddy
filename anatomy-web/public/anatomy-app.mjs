// anatomy-app.mjs —— 可视化层 + 页面逻辑
// 风格切换（标准解剖 / Q 版骷髅）、视图切换（正/背）、图层切换（骨骼/肌肉/双层）、
// 受伤热力、部位卡片、AI 流式讲解与调侃、战损榜与外部记录注入。

import {
  REGIONS, REGION_MAP, REGION_DEMO,
  distribution, SEVERITY_LABEL,
} from './anatomy-data.mjs';
import * as artStandard from './anatomy-art-standard.mjs';
import * as artQ from './anatomy-art-q.mjs';
import { overlayElement } from './anatomy-art-shared.mjs';
import { Rig } from './anatomy-rig.mjs';

/** 双风格注册表：每种风格自带画法、关节几何与按几何校准的动作表 */
const ART = { standard: artStandard, q: artQ };

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const svg = $('#body');
const gBody = $('#gBody');
const gOverlays = $('#gOverlays');
const gBadges = $('#gBadges');

const state = {
  style: 'standard',
  view: 'front',
  layerMode: 'bones',
  heatOn: true,
  records: [],
  dist: {},
  selected: null,
  reduced: matchMedia('(prefers-reduced-motion: reduce)').matches,
};

let rig = null;
const art = () => ART[state.style];

/* ---------------- 渲染 ---------------- */

function heatFill(regionId) {
  if (!state.heatOn) return 'transparent';
  const level = state.dist[regionId]?.level ?? 0;
  if (!level) return 'transparent';
  return `rgba(217, 74, 58, ${0.13 + level * 0.1})`;
}

function rebuildBody() {
  rig?.destroy();
  const a = art();
  gBody.innerHTML = a.buildBodyMarkup(state.view, state.layerMode);
  rig = new Rig(svg, { joints: a.JOINTS, actions: a.ACTIONS, reduced: state.reduced });
  window.__rig = rig; // 调试/测试钩子：探针可冻结动画采样
}

function renderOverlays() {
  const overlays = art().getOverlays(state.view);
  gOverlays.innerHTML = overlays
    .map((o) => overlayElement(o, { fill: heatFill(o.regionId), selected: o.regionId === state.selected }))
    .join('');
}

function renderBadges() {
  if (!state.heatOn) {
    gBadges.innerHTML = '';
    return;
  }
  const seen = new Set();
  const parts = [];
  for (const o of art().getOverlays(state.view)) {
    if (seen.has(o.regionId)) continue;
    const d = state.dist[o.regionId];
    if (!d || !d.count) continue;
    seen.add(o.regionId);
    const [x, y] = o.label;
    parts.push(
      `<circle cx="${x}" cy="${y}" r="12" fill="#d94a3a" stroke="#fff" stroke-width="2.5"/>` +
      `<text x="${x}" y="${y + 4}" text-anchor="middle" font-size="12" font-weight="700" fill="#fff">${d.count}</text>`,
    );
  }
  gBadges.innerHTML = parts.join('');
}

function severityDots(sev) {
  return `<span class="dots" title="${SEVERITY_LABEL[sev] ?? ''}">${'●'.repeat(sev)}${'○'.repeat(5 - sev)}</span>`;
}

function renderRegionCard() {
  const id = state.selected;
  const empty = $('#regionEmpty');
  const card = $('#regionCard');
  if (!id || !REGION_MAP[id]) {
    empty.hidden = false;
    card.hidden = true;
    return;
  }
  empty.hidden = true;
  card.hidden = false;
  const r = REGION_MAP[id];
  $('#rgName').textContent = r.nameZh;
  const demo = art().ACTIONS[REGION_DEMO[id]];
  $('#btnDemo').textContent = `▶ 演示：${demo?.label ?? '动作'}`;
  $('#rgBones').innerHTML = r.bones.map((b) => `<span class="chip bone">${b}</span>`).join('');
  $('#rgMuscles').innerHTML = r.muscles
    .map((m) => `<li><span class="chip mus">${m.nameZh}</span><span class="role">${m.role}</span></li>`)
    .join('');
  $('#rgMotion').textContent = r.motion;
  $('#rgInjuries').textContent = `常见损伤：${r.injuries}`;

  const d = state.dist[id];
  $('#rgInjured').innerHTML = d?.count
    ? d.members.map((m) => `<span class="chip member">${m.name} ${severityDots(m.severity)}</span>`).join('')
    : '<span class="chip ok">这个部位全员完好 ✔</span>';

  $('#aiText').hidden = true;
}

function renderBoard() {
  const list = $('#recordList');
  const sorted = [...state.records].sort((a, b) => (a.happenedAt < b.happenedAt ? 1 : -1));
  list.innerHTML = sorted.map((r) => {
    const name = r.anonymous ? '匿名群友' : r.member;
    const regionLabel = (REGION_MAP[r.regionId] ?? {}).nameZh ?? r.regionId;
    return `<li class="rec">
      <span class="who">${escapeHtml(name)}</span>
      <span class="badge">${regionLabel}</span>
      ${severityDots(r.severity)}
      <span class="note">${escapeHtml(r.note ?? '')}</span>
      <span class="date">${(r.happenedAt ?? '').slice(5)}</span>
      <button class="del" data-id="${r.id}" title="删除这条演示记录">✕</button>
    </li>`;
  }).join('');
  $('#boardCount').textContent = `共 ${sorted.length} 条`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function renderAll() {
  renderOverlays();
  renderBadges();
  renderRegionCard();
  renderBoard();
}

/* ---------------- 数据 ---------------- */

async function loadRecords() {
  const res = await fetch('/api/records');
  const data = await res.json();
  state.records = data.records ?? [];
  state.dist = distribution(state.records);
}

async function addRecord(body) {
  const res = await fetch('/api/records', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  state.records = data.records;
  state.dist = distribution(state.records);
  renderAll();
}

async function deleteRecord(id) {
  const res = await fetch(`/api/records/${encodeURIComponent(id)}`, { method: 'DELETE' });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  state.records = data.records;
  state.dist = distribution(state.records);
  renderAll();
}

/* ---------------- AI 面板（流式渲染） ---------------- */

let aiBusy = false;

async function callAI(endpoint, body, box) {
  if (aiBusy) return;
  aiBusy = true;
  const btns = [$('#btnExplain'), $('#btnRoast'), $('#btnWholeRoast')];
  btns.forEach((b) => b && (b.disabled = true));
  box.hidden = false;
  box.classList.remove('degraded');
  box.textContent = '生成中…';
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? `HTTP ${res.status}`);
    }
    if (res.headers.get('x-degraded') === '1') box.classList.add('degraded');
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let text = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += dec.decode(value, { stream: true });
      if (text) box.textContent = text;
    }
    if (!text.trim()) {
      box.textContent = '（空响应，请重试）';
      box.classList.add('degraded');
    }
  } catch (err) {
    box.textContent = `调用失败：${err.message}`;
    box.classList.add('degraded');
  } finally {
    aiBusy = false;
    btns.forEach((b) => b && (b.disabled = false));
  }
}

/* ---------------- 事件绑定 ---------------- */

gOverlays.addEventListener('click', (e) => {
  const t = e.target.closest('[data-region]');
  if (!t) return;
  selectRegion(t.dataset.region);
});

function selectRegion(id) {
  state.selected = id;
  renderOverlays();
  renderRegionCard();
  switchTab('region');
  rig?.play(REGION_DEMO[id]);
}

function switchTab(name) {
  $$('.tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === name));
  $('#tabRegion').hidden = name !== 'region';
  $('#tabBoard').hidden = name !== 'board';
}

$$('.tabs button').forEach((b) => b.addEventListener('click', () => switchTab(b.dataset.tab)));

$$('#styleSeg button').forEach((b) =>
  b.addEventListener('click', () => {
    if (state.style === b.dataset.style) return;
    state.style = b.dataset.style;
    $$('#styleSeg button').forEach((x) => x.classList.toggle('on', x === b));
    rebuildBody();
    renderOverlays();
    renderBadges();
    renderRegionCard();
  }),
);

$$('#viewSeg button').forEach((b) =>
  b.addEventListener('click', () => {
    if (state.view === b.dataset.view) return;
    state.view = b.dataset.view;
    $$('#viewSeg button').forEach((x) => x.classList.toggle('on', x === b));
    rebuildBody();
    renderOverlays();
    renderBadges();
  }),
);

$$('#layerSeg button').forEach((b) =>
  b.addEventListener('click', () => {
    if (state.layerMode === b.dataset.layer) return;
    state.layerMode = b.dataset.layer;
    $$('#layerSeg button').forEach((x) => x.classList.toggle('on', x === b));
    rebuildBody();
  }),
);

$('#heatChk').addEventListener('change', (e) => {
  state.heatOn = e.target.checked;
  renderOverlays();
  renderBadges();
});

$$('#motionBtns button').forEach((b) =>
  b.addEventListener('click', () => {
    rig?.play(b.dataset.motion === 'idle' ? null : b.dataset.motion);
  }),
);

$('#btnDemo').addEventListener('click', () => {
  if (state.selected) rig?.play(REGION_DEMO[state.selected]);
});

$('#btnExplain').addEventListener('click', () => {
  if (!state.selected) return;
  callAI('/api/ai/explain', { regionId: state.selected }, $('#aiText'));
});

$('#btnRoast').addEventListener('click', () => {
  if (!state.selected) return;
  callAI('/api/ai/roast', { regionId: state.selected, scope: 'region' }, $('#aiText'));
});

$('#btnWholeRoast').addEventListener('click', () => {
  switchTab('board');
  callAI('/api/ai/roast', { scope: 'whole' }, $('#aiWholeText'));
});

// 添加记录表单
{
  const regionSel = $('#fRegion');
  regionSel.innerHTML = REGIONS.map((r) => `<option value="${r.id}">${r.nameZh}</option>`).join('');
  $('#fSev').addEventListener('input', (e) => ($('#fSevOut').textContent = e.target.value));
  $('#addForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = {
      member: $('#fMember').value.trim() || '匿名群友',
      regionId: regionSel.value,
      severity: Number($('#fSev').value),
      sport: $('#fSport').value || undefined,
      note: $('#fNote').value.trim() || undefined,
      anonymous: $('#fAnon').checked,
      happenedAt: new Date().toISOString().slice(0, 10),
    };
    try {
      await addRecord(body);
      $('#fNote').value = '';
      toast('战损已入册 📖');
    } catch (err) {
      toast(`添加失败：${err.message}`);
    }
  });
}

$('#recordList').addEventListener('click', async (e) => {
  const btn = e.target.closest('.del');
  if (!btn) return;
  try {
    await deleteRecord(btn.dataset.id);
    toast('已删除');
  } catch (err) {
    toast(`删除失败：${err.message}`);
  }
});

/* ---------------- Toast ---------------- */

let toastTimer = null;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 2200);
}

/* ---------------- 启动 ---------------- */

async function init() {
  // 大模型接入状态
  try {
    const h = await (await fetch('/api/health')).json();
    $('#health').textContent = h.llm
      ? `🧠 大模型已接入：${h.model}（流式）`
      : '📴 离线示例模式（未找到 OLLAMA_API_KEY，AI 文案用本地模板兜底）';
    $('#health').classList.toggle('off', !h.llm);
  } catch {
    $('#health').textContent = '📴 服务不可用';
  }
  await loadRecords();
  rebuildBody();
  renderAll();
}

init();
