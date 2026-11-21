// anatomy-qa.mjs —— 解剖战损人体组件的自动化回归
// 自建服务（临时数据文件 + 无 LLM key → 覆盖离线降级路径），
// 用 puppeteer 驱动：结构 → 双风格像素 → 交互 → API 注入/删除 → 流式 → 截图。
// 视觉断言用“光栅化采样颜色”，不依赖肉眼。

import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const PORT = Number(process.env.ANATOMY_QA_PORT ?? 7799);
const BASE = `http://localhost:${PORT}`;
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SHOTS = 'preview/screens';

const tmpDir = await mkdtemp(path.join(tmpdir(), 'anatomy-qa-'));
const server = spawn(process.execPath, ['anatomy-web/server.mjs'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    PORT: String(PORT),
    OLLAMA_ENV_FILE: path.join(tmpDir, 'no-such-env'), // QA 不接真模型，测离线兜底
    ANATOMY_DATA_FILE: path.join(tmpDir, 'qa-records.json'),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
server.stdout.on('data', (d) => process.stdout.write(`[server] ${d}`));
server.stderr.on('data', (d) => process.stderr.write(`[server:err] ${d}`));

const checks = [];
const check = (ok, msg) => {
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + msg);
  checks.push(ok);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitHealth(tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(`${BASE}/api/health`);
      if (res.ok) return await res.json();
    } catch {}
    await sleep(150);
  }
  throw new Error('server 未起来');
}

const api = {
  addRecord: (body) =>
    fetch(`${BASE}/api/records`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }).then(async (r) => [r.status, await r.json()]),
  delRecord: (id) => fetch(`${BASE}/api/records/${id}`, { method: 'DELETE' }).then(async (r) => [r.status, await r.json()]),
};

async function badgeAt(x, y) {
  return page.evaluate(
    (x, y) => {
      for (const t of document.querySelectorAll('#gBadges text')) {
        if (Math.abs(+t.getAttribute('x') - x) < 1 && Math.abs(+t.getAttribute('y') - (y + 4)) < 1) {
          return t.textContent;
        }
      }
      return null;
    },
    x,
    y,
  );
}

let page;
let browser;
try {
  // ---- 服务面 ----
  const health = await waitHealth();
  check(health.ok, `health ok（llm=${health.llm}，应为 false 走离线）`);

  const regions = await fetch(`${BASE}/api/anatomy`).then((r) => r.json());
  check(regions.length === 14, `anatomy 卡片 14 个（实际 ${regions.length}）`);

  let [st, body] = await api.addRecord({ member: '', regionId: 'knee', severity: 9 });
  check(st === 400, `非法记录被拒（severity 越界 → ${st}）`);
  [, body] = await api.addRecord({ member: 'x', regionId: 'nope', severity: 2 });
  check(String(body.error ?? '').includes('部位不合法'), `非法部位被拒（${body.error}）`);

  // ---- 页面 ----
  browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900, deviceScaleFactor: 2 });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && pageErrors.push(m.text()));
  await page.goto(BASE, { waitUntil: 'networkidle0' });
  await sleep(900);

  check((await page.$eval('#health', (el) => el.textContent)).includes('离线'), '页面显示离线模式徽标');

  await page.click('#referencePlates summary');
  await page.$$eval('.plate-grid img', (images) => Promise.all(images.map((image) => image.decode())));
  check(await page.$$eval('.plate-grid img', (images) => images.length === 4 && images.every((image) =>
    image.naturalWidth === 600 && image.naturalHeight === 900)), '四张标准解剖正背图加载成功');
  check(await page.$$eval('.plate-grid a', (links) => links.every((link) =>
    link.href === link.querySelector('img').src)), '每张标准图可独立打开原图');
  await page.click('#referencePlates summary');

  const struct = await page.evaluate(() => ({
    joints: document.querySelectorAll('#gBody [id^="j:"]').length,
    overlays: document.querySelectorAll('#gOverlays .ov').length,
    badges: document.querySelectorAll('#gBadges circle').length,
  }));
  check(struct.joints === 16, `16 个关节组（实际 ${struct.joints}）`);
  check(struct.overlays === 21, `正面 21 个热区（实际 ${struct.overlays}）`);
  check(struct.badges >= 8, `种子数据徽标 ≥8（实际 ${struct.badges}）`);

  // ---- 像素采样（冻结动画后光栅化） ----
  const sample = async (style, view, layer, pts) => {
    await page.click(`[data-style="${style}"]`);
    await page.click(`[data-view="${view}"]`);
    await page.click(`[data-layer="${layer}"]`);
    await sleep(250);
    return page.evaluate(async (pts) => {
      window.__rig?.destroy();
      window.__rig = null;
      document.querySelectorAll('#gBody [id^="j:"]').forEach((g) => g.removeAttribute('transform'));
      if (document.querySelector('#heatChk')?.checked) document.querySelector('#heatChk').click();
      const svg = document.querySelector('#body');
      const xml = new XMLSerializer().serializeToString(svg);
      const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error('raster'));
        i.src = url;
      });
      const c = document.createElement('canvas');
      c.width = 520; c.height = 760;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#f6f1e6';
      ctx.fillRect(0, 0, 520, 760);
      ctx.drawImage(img, 0, 0, 520, 760);
      return pts.map(([name, x, y]) => {
        const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
        return [name, r * 65536 + g * 256 + b];
      });
    }, pts);
  };
  const BONE = 0xf0e8d4, MUS = 0xd98a75, PAPER = 0xf6f1e6;
  const near = (got, want, tol = 45) => Math.hypot(
    ((got >> 16) & 255) - ((want >> 16) & 255),
    ((got >> 8) & 255) - ((want >> 8) & 255),
    (got & 255) - (want & 255),
  ) <= tol;

  // 标准解剖
  let s = await sample('standard', 'front', 'bones', [['skull', 260, 80], ['sternum', 260, 230], ['patella', 228, 570], ['cervical', 260, 152], ['calcaneus', 224, 710], ['empty', 60, 60]]);
  check(near(s[0][1], BONE) && near(s[1][1], BONE) && near(s[2][1], BONE) && near(s[3][1], BONE) && near(s[4][1], BONE),
    `标准·骨骼落位（颅骨/胸骨/髌骨/颈椎/跟骨 #${s.map((x) => x[1].toString(16)).join(',')}）`);
  check(near(s[5][1], PAPER, 30), '标准·画布角落为纸面');

  s = await sample('standard', 'front', 'muscles', [['pec', 232, 232], ['abs', 248, 311], ['quad', 232, 480], ['scm', 251, 164], ['skullArea', 260, 80]]);
  check(near(s[0][1], MUS) && near(s[1][1], MUS) && near(s[2][1], MUS) && near(s[3][1], MUS, 60), '标准·肌肉落位（胸/腹/股直/胸锁乳突）');
  check(near(s[4][1], PAPER, 35), '标准·肌肉层正确隐藏颅骨');

  s = await sample('standard', 'back', 'muscles', [['trap', 260, 200], ['glute', 222, 460], ['calf', 228, 610], ['ham', 217, 530]]);
  check(near(s[0][1], MUS, 60) && near(s[1][1], MUS) && near(s[2][1], MUS) && near(s[3][1], MUS), '标准·背面肌肉落位（斜方/臀/腓肠/腘绳）');

  // Q 版
  s = await sample('q', 'front', 'bones', [['skull', 260, 130], ['sternum', 260, 250], ['patella', 228, 476], ['empty', 60, 60]]);
  check(near(s[0][1], BONE) && near(s[1][1], BONE) && near(s[2][1], BONE), `Q版·骨骼落位（颅骨/胸骨/髌骨 #${s.map((x) => x[1].toString(16)).join(',')}）`);
  check(near(s[3][1], PAPER, 30), 'Q版·画布角落为纸面');

  s = await sample('q', 'front', 'muscles', [['pec', 230, 262], ['abs', 247, 302], ['quad', 234, 424], ['skullArea', 260, 130]]);
  check(near(s[0][1], MUS) && near(s[1][1], MUS) && near(s[2][1], MUS), 'Q版·肌肉落位（胸/腹/股四头）');
  check(near(s[3][1], PAPER, 35), 'Q版·肌肉层正确隐藏颅骨');

  s = await sample('q', 'back', 'muscles', [['trap', 260, 232], ['glute', 228, 398], ['calf', 228, 512]]);
  check(near(s[0][1], MUS) && near(s[1][1], MUS) && near(s[2][1], MUS), 'Q版·背面肌肉落位（斜方/臀/腓肠）');

  // 恢复热力 + 标准风格
  await page.click('[data-style="standard"]');
  await page.click('[data-view="front"]');
  await page.click('[data-layer="bones"]');
  await page.click('#heatChk');
  await sleep(200);

  // ---- 交互：部位卡片 ----
  await page.click('[data-region="knee"]');
  await sleep(300);
  check((await page.$eval('#rgName', (el) => el.textContent)) === '膝', '点膝 → 面板显示「膝」');
  const roster = await page.$eval('#rgInjured', (el) => el.textContent);
  check(roster.includes('小北') && roster.includes('阿岚'), '膝部战损名单含种子记录（小北/阿岚）');
  check((await badgeAt(228, 570)) === '2', '膝部徽标 = 2');

  // ---- AI 离线兜底（流式打字机） ----
  await page.click('#btnExplain');
  await page.waitForFunction(() => {
    const t = document.querySelector('#aiText').textContent;
    return !document.querySelector('#aiText').hidden && t.includes('离线示例') && t.length > 30 && !t.startsWith('生成中');
  }, { timeout: 8000 });
  const aiText = await page.$eval('#aiText', (el) => el.textContent);
  check(aiText.includes('离线示例') && aiText.includes('髌骨'), `AI 讲解离线兜底（流式，${aiText.length} 字）`);
  check(await page.evaluate(() => document.querySelector('#aiText').classList.contains('degraded')), '降级样式已标记');

  // ---- 表单注入 ----
  await page.click('.tabs [data-tab="board"]');
  await page.type('#fMember', '测试群友');
  await page.select('#fRegion', 'knee');
  await page.$eval('#fSev', (el) => {
    el.value = '3';
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.click('#addForm .primary');
  await page.waitForFunction(() => document.querySelector('#toast').textContent.includes('入册'), { timeout: 8000 });
  check((await badgeAt(228, 570)) === '3', '表单添加后膝部徽标 = 3');

  // ---- 外部 API 注入 + 删除 ----
  const [, created] = await api.addRecord({ member: '外部注入君', regionId: 'head', severity: 2, note: '来自 curl' });
  check(created.created?.regionId === 'head', `外部 POST /api/records 成功（${created.created?.member}）`);
  check(created.distribution?.head?.count === 2, '服务端分布聚合 head=2');
  await page.reload({ waitUntil: 'networkidle0' });
  await sleep(900);
  check((await badgeAt(260, 100)) === '2', '刷新后头部徽标 = 2');

  const { records } = await fetch(`${BASE}/api/records`).then((r) => r.json());
  const toDel = records.filter((r) => r.member === '测试群友' || r.member === '外部注入君').map((r) => r.id);
  check(toDel.length === 2, '找到两条 QA 注入记录');
  for (const id of toDel) {
    const [st2] = await api.delRecord(id);
    check(st2 === 200, `DELETE ${id} → ${st2}`);
  }
  const [st3] = await api.delRecord('r_nonexistent');
  check(st3 === 404, '删除不存在的记录 → 404');

  // ---- 动作引擎（Q 版下验证同一动作表） ----
  await page.click('[data-motion="fall"]');
  await sleep(400);
  check(await page.evaluate(() => window.__rig?.playing === true), '摔倒回放动作在播放（标准）');
  await sleep(4000);
  check(await page.evaluate(() => window.__rig?.playing === false), '动作结束回到待机（标准）');
  await page.click('[data-style="q"]');
  await sleep(200);
  await page.click('[data-motion="wave"]');
  await sleep(400);
  check(await page.evaluate(() => window.__rig?.playing === true), 'Q 版挥手动作在播放');
  await sleep(3000);

  // ---- 背面视图 ----
  await page.click('[data-style="standard"]');
  await page.click('[data-view="back"]');
  await sleep(300);
  check((await page.$$eval('[data-region="back_spine"]', (els) => els.length)) === 1, '背面含 back_spine 热区');

  // ---- 页面错误 ----
  check(pageErrors.length === 0, `无页面错误${pageErrors.length ? '：' + pageErrors.join(' / ') : ''}`);

  // ---- 文档截图 ----
  await page.click('[data-view="front"]');
  await page.click('[data-layer="bones"]');
  await sleep(600);
  await page.screenshot({ path: `${SHOTS}/anatomy-front.png` });
  await page.click('[data-layer="both"]');
  await page.click('[data-region="knee"]');
  await sleep(600);
  await page.screenshot({ path: `${SHOTS}/anatomy-panel.png` });
  await page.click('[data-style="q"]');
  await page.click('[data-layer="bones"]');
  await sleep(600);
  await page.screenshot({ path: `${SHOTS}/anatomy-q.png` });
  await page.click('[data-view="back"]');
  await sleep(600);
  await page.screenshot({ path: `${SHOTS}/anatomy-back.png` });
  console.log('截图已写入 preview/screens/anatomy-*.png');
} catch (err) {
  check(false, `QA 异常中断：${err.message}`);
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  await rm(tmpDir, { recursive: true, force: true }).catch(() => {});
}

const failed = checks.filter((c) => !c).length;
console.log(failed ? `\n${failed}/${checks.length} 项失败` : `\n全部 ${checks.length} 项通过`);
process.exit(failed ? 1 : 0);
