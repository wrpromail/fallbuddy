// server.mjs —— AI 解说层服务端 + 数据层网关
// 职责：
//   1. 托管 public/ 静态页面
//   2. 战损记录 API：GET/POST /api/records、DELETE /api/records/:id（外部注入入口）
//   3. 大模型代理：POST /api/ai/explain、POST /api/ai/roast
//      key 只存在于本进程（读 .env），浏览器永远拿不到。
//
// 运行：npm run anatomy   →  http://localhost:7788
// 配置（环境变量）：
//   PORT               默认 7788
//   OLLAMA_API_KEY     直接提供 key（优先）
//   OLLAMA_ENV_FILE    从这个 .env 文件里读 OLLAMA_API_KEY（默认 ~/mcpgwpg/.env）
//   ANATOMY_MODEL      默认 deepseek-v4.1-flash:1017
//   OLLAMA_BASE_URL    默认 https://ollama.com

import http from 'node:http';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import {
  REGION_MAP, REGIONS, validateRecord, regionCardText, distribution, recordLine,
} from './public/anatomy-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 7788);
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = process.env.ANATOMY_DATA_FILE ?? path.join(DATA_DIR, 'records.json');
const PUBLIC_DIR = path.join(__dirname, 'public');
const MODEL = process.env.ANATOMY_MODEL ?? 'deepseek-v4.1-flash:1017';
const LLM_BASE = process.env.OLLAMA_BASE_URL ?? 'https://ollama.com';

/* ---------------- 大模型 key（只留在服务端） ---------------- */

async function loadApiKey() {
  if (process.env.OLLAMA_API_KEY) return process.env.OLLAMA_API_KEY;
  const envFile = process.env.OLLAMA_ENV_FILE ?? path.join(os.homedir(), 'mcpgwpg', '.env');
  if (!existsSync(envFile)) return null;
  const txt = await readFile(envFile, 'utf8');
  const m = txt.match(/^\s*OLLAMA_API_KEY\s*=\s*(\S+)\s*$/m);
  return m ? m[1] : null;
}

const API_KEY = await loadApiKey();

async function callLLM(messages, { temperature = 0.8, maxTokens = 700 } = {}) {
  if (!API_KEY) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 120_000);
  try {
    const res = await fetch(`${LLM_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({ model: MODEL, messages, temperature, max_tokens: maxTokens }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------- 流式输出 ---------------- */

function chunkText(text, size = 24) {
  const out = [];
  for (let i = 0; i < text.length; i += size) out.push(text.slice(i, i + size));
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function streamHeaders(res, degraded) {
  res.writeHead(200, {
    'content-type': 'text/plain; charset=utf-8',
    'cache-control': 'no-cache',
    'x-degraded': degraded ? '1' : '0',
    'access-control-allow-origin': '*',
    'access-control-expose-headers': 'x-degraded',
  });
}

/**
 * 把大模型输出流式转发给浏览器；无 key / 上游失败 / 零内容时，
 * 降级为本地模板并同样按打字机节奏流出（前端体验一致）。
 */
async function streamAI(res, messages, { temperature = 0.8, maxTokens = 700 } = {}, fallbackText) {
  const streamFallback = async () => {
    if (!res.headersSent) streamHeaders(res, true);
    for (const piece of chunkText(fallbackText)) {
      res.write(piece);
      await sleep(24);
    }
    res.end();
  };

  if (!API_KEY) return streamFallback();

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 120_000);
  try {
    const upstream = await fetch(`${LLM_BASE}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({ model: MODEL, messages, temperature, max_tokens: maxTokens, stream: true }),
      signal: ctrl.signal,
    });
    if (!upstream.ok || !upstream.body) return streamFallback();

    let buffer = '';
    let got = false;
    const decoder = new TextDecoder();
    for await (const part of upstream.body) {
      buffer += decoder.decode(part, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        const s = line.trim();
        if (!s.startsWith('data:')) continue;
        const payload = s.slice(5).trim();
        if (payload === '[DONE]') {
          if (!got) break;
          res.end();
          return;
        }
        let delta = null;
        try {
          delta = JSON.parse(payload)?.choices?.[0]?.delta?.content ?? null;
        } catch {
          continue;
        }
        if (delta) {
          if (!got) {
            got = true;
            streamHeaders(res, false); // 收到首片再提交头，失败前还能换降级路径
          }
          res.write(delta);
        }
      }
    }
    if (!got) return streamFallback();
    if (!res.writableEnded) res.end();
  } catch {
    if (!res.headersSent) return streamFallback();
    try { res.end(); } catch { /* 已结束 */ }
  } finally {
    clearTimeout(timer);
  }
  return undefined;
}

/* ---------------- 记录存储 ---------------- */

const SEED = [
  { id: 'seed01', member: '小北', regionId: 'knee', severity: 3, sport: '单板滑雪', note: '换刃失败跪摔，髌骨和雪面硬碰硬', happenedAt: '2026-11-14' },
  { id: 'seed02', member: '阿岚', regionId: 'pelvis_hip', severity: 4, sport: '双板滑雪', note: '下缆车没站稳，一屁股坐进冰碴雪里', happenedAt: '2026-11-08' },
  { id: 'seed03', member: '大力', regionId: 'forearm', severity: 5, sport: '轮滑', note: '经典手撑地，桡骨远端喜提石膏一枚', happenedAt: '2026-11-02' },
  { id: 'seed04', member: '老白', regionId: 'shoulder', severity: 2, sport: '单板滑雪', note: '肩部拍进蘑菇道，抬了三天胳膊', happenedAt: '2026-10-30' },
  { id: 'seed05', member: '妞妞', regionId: 'ankle_foot', severity: 3, sport: '轮滑', note: '内翻崴脚，肿得像塞了个鸡蛋', happenedAt: '2026-10-26' },
  { id: 'seed06', member: '小北', regionId: 'thigh', severity: 2, sport: '双板滑雪', note: '雪道堵车急停，大腿抽筋抗议', happenedAt: '2026-10-24' },
  { id: 'seed07', member: '阿岚', regionId: 'knee', severity: 1, sport: '双板滑雪', note: '跪摔无痛，纯记录凑个图鉴', happenedAt: '2026-10-20' },
  { id: 'seed08', member: '大力', regionId: 'back_spine', severity: 4, sport: '单板滑雪', note: '落地没屈膝，腰替腿挨了这一下', happenedAt: '2026-10-18' },
  { id: 'seed09', member: '匿名群友', anonymous: true, regionId: 'hand', severity: 2, sport: '单板滑雪', note: '被滑雪杖别了一下拇指', happenedAt: '2026-10-15' },
  { id: 'seed10', member: '老白', regionId: 'head', severity: 1, sport: '单板滑雪', note: '头盔着地，头盔裂了头没裂', happenedAt: '2026-10-12' },
];

let records = [];
async function loadRecords() {
  try {
    const raw = JSON.parse(await readFile(DATA_FILE, 'utf8'));
    if (Array.isArray(raw.records)) records = raw.records;
  } catch {
    records = SEED.map((r) => ({ ...r }));
    await persist();
  }
}
async function persist() {
  await mkdir(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  await writeFile(tmp, JSON.stringify({ savedAt: new Date().toISOString(), records }, null, 2));
  await rename(tmp, DATA_FILE);
}

function publicRecords() {
  return records.map(({ id, member, anonymous, regionId, severity, sport, note, happenedAt }) => ({
    id, member: anonymous ? '匿名群友' : member, anonymous: !!anonymous, regionId, severity, sport: sport ?? null, note: note ?? null, happenedAt: happenedAt ?? null,
  }));
}

/* ---------------- AI prompt ---------------- */

const EXPLAIN_SYSTEM = [
  '你是一位运动解剖学讲师，面向滑雪、轮滑等运动爱好者做轻松科普。',
  '规则：只依据给定的资料卡讲解，不要编造资料之外的结论；简体中文；不超过 240 字；',
  '可以用一个生活化的比喻讲清“骨骼与肌肉如何协作”；结尾给一句针对该部位的护具或热身建议。',
].join('');

const ROAST_SYSTEM = [
  '你是「摔友记」群里的毒舌但友善的解说员。',
  '规则：只调侃行为、姿势和运气，不攻击人身，不涉及外貌、性别、地域；',
  '不鼓励危险动作，不拿真实重伤开玩笑；简体中文；不超过 200 字；',
  '结尾必须带一句安全提醒（护具/热身/量力而行）。',
].join('');

function buildExplainPrompt(regionId) {
  const card = regionCardText(regionId);
  if (!card) return null;
  return [
    { role: 'system', content: EXPLAIN_SYSTEM },
    {
      role: 'user',
      content: `${card}\n\n请讲解这个部位“骨骼与肌肉如何协作发力”，以及为什么这类运动容易在这里受伤。`,
    },
  ];
}

function buildRoastPrompt(body) {
  if (body.scope === 'whole') {
    const dist = distribution(publicRecords());
    const top = Object.values(dist).sort((a, b) => b.score - a.score).slice(0, 3);
    const lines = top.length
      ? top.map((d) => {
          const name = REGION_MAP[d.regionId].nameZh;
          return `- ${name}：${d.count} 人次战损，最惨烈程度 ${d.maxSeverity}/5`;
        })
      : '- 暂无任何战损记录';
    return [
      { role: 'system', content: ROAST_SYSTEM },
      {
        role: 'user',
        content: `【全群战损概况】\n${lines.join('\n')}\n\n请对全群的战损分布做一段吐槽式解说。${
          top.length ? '可以点名最“惨烈”的部位。' : '没有记录就先夸夸大家，再提醒别大意。'
        }`,
      },
    ];
  }
  const region = REGION_MAP[body.regionId];
  if (!region) return null;
  const list = publicRecords().filter((r) => r.regionId === body.regionId);
  const lines = list.length
    ? list.map((r) => `- ${recordLine(r)}`).join('\n')
    : '暂无战损记录';
  return [
    { role: 'system', content: ROAST_SYSTEM },
    {
      role: 'user',
      content: `【部位】${region.nameZh}（常见损伤：${region.injuries}）\n【该部位战损】\n${lines}\n\n请对这批战损进行吐槽式解说。${
        list.length ? '可以点名调侃当事人，但保持善意。' : '没有记录就先夸夸大家保持得好，再提醒别大意。'
      }`,
    },
  ];
}

function fallbackExplain(regionId) {
  const r = REGION_MAP[regionId];
  if (!r) return '部位不存在。';
  return [
    '（离线示例文案，未接大模型）',
    `${r.motion}`,
    `${r.injuries}`,
    '建议：护具戴好、热身做足、量力而行。',
  ].join('\n');
}

function fallbackRoast(scope, regionId) {
  if (scope === 'whole') {
    const dist = distribution(publicRecords());
    const total = Object.values(dist).reduce((s, d) => s + d.count, 0);
    return `（离线示例文案，未接大模型）全群已累计 ${total} 人次战损。按这个趋势，护具商应该给贵群发年度感谢信。安全提醒：戴护具、做热身、量力而行。`;
  }
  const list = publicRecords().filter((r) => r.regionId === regionId);
  const name = REGION_MAP[regionId]?.nameZh ?? '该部位';
  return list.length
    ? `（离线示例文案，未接大模型）${name}已经堆了 ${list.length} 条战损，最狠的一条到了 ${Math.max(...list.map((r) => r.severity))}/5。这个部位快成贵群指定售后点了吧？安全提醒：戴护具、做热身、量力而行。`
    : `（离线示例文案，未接大模型）${name}目前零战损——继续保持，别让图鉴圆不上。安全提醒：戴护具、做热身、量力而行。`;
}

/* ---------------- HTTP ---------------- */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

function send(res, status, body, type = 'application/json; charset=utf-8') {
  res.writeHead(status, {
    'content-type': type,
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type',
  });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      try {
        resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {});
      } catch {
        reject(new Error('invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function recordsPayload() {
  return { records: publicRecords(), distribution: distribution(publicRecords()), regions: REGIONS.map((r) => ({ id: r.id, nameZh: r.nameZh })) };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
  const p = url.pathname;

  if (req.method === 'OPTIONS') return send(res, 204, '');

  // ---- API ----
  if (p === '/api/health') {
    return send(res, 200, { ok: true, llm: !!API_KEY, model: MODEL });
  }
  if (p === '/api/anatomy') {
    return send(res, 200, REGIONS);
  }
  if (p === '/api/records' && req.method === 'GET') {
    return send(res, 200, recordsPayload());
  }
  if (p === '/api/records' && req.method === 'POST') {
    let input;
    try {
      input = await readBody(req);
    } catch (err) {
      return send(res, 400, { error: err.message });
    }
    const errors = validateRecord(input);
    if (errors.length) return send(res, 400, { error: errors.join('；') });
    const rec = {
      id: `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
      member: String(input.member ?? '匿名群友').trim().slice(0, 24) || '匿名群友',
      anonymous: !!input.anonymous,
      regionId: input.regionId,
      severity: Number(input.severity),
      sport: input.sport ? String(input.sport).slice(0, 12) : null,
      note: input.note ? String(input.note).slice(0, 80) : null,
      happenedAt: input.happenedAt ?? new Date().toISOString().slice(0, 10),
    };
    records.unshift(rec);
    await persist();
    const payload = recordsPayload();
    return send(res, 201, { created: payload.records.find((record) => record.id === rec.id), ...payload });
  }
  const delMatch = p.match(/^\/api\/records\/([A-Za-z0-9_]+)$/);
  if (delMatch && req.method === 'DELETE') {
    const before = records.length;
    records = records.filter((r) => r.id !== delMatch[1]);
    if (records.length === before) return send(res, 404, { error: 'record not found' });
    await persist();
    return send(res, 200, recordsPayload());
  }
  if (p === '/api/ai/explain' && req.method === 'POST') {
    let body;
    try {
      body = await readBody(req);
    } catch (err) {
      return send(res, 400, { error: err.message });
    }
    const messages = buildExplainPrompt(body.regionId);
    if (!messages) return send(res, 400, { error: 'regionId 不合法' });
    return streamAI(res, messages, { temperature: 0.7, maxTokens: 700 }, fallbackExplain(body.regionId));
  }
  if (p === '/api/ai/roast' && req.method === 'POST') {
    let body;
    try {
      body = await readBody(req);
    } catch (err) {
      return send(res, 400, { error: err.message });
    }
    if (body.scope !== 'whole' && !REGION_MAP[body.regionId]) {
      return send(res, 400, { error: 'regionId 不合法' });
    }
    const messages = buildRoastPrompt(body);
    return streamAI(res, messages, { temperature: 1.0, maxTokens: 520 }, fallbackRoast(body.scope, body.regionId));
  }

  // ---- 静态文件 ----
  if (req.method === 'GET') {
    let file = p === '/' ? '/index.html' : p;
    file = path.normalize(file).replace(/^(\.\.[/\\])+/, '');
    const full = path.join(PUBLIC_DIR, file);
    if (!full.startsWith(PUBLIC_DIR)) return send(res, 403, { error: 'forbidden' });
    try {
      const buf = await readFile(full);
      const type = MIME[path.extname(full)] ?? 'application/octet-stream';
      res.writeHead(200, { 'content-type': type });
      return res.end(buf);
    } catch {
      return send(res, 404, { error: 'not found' });
    }
  }

  return send(res, 404, { error: 'not found' });
});

await loadRecords();
server.listen(PORT, () => {
  console.log(`解剖战损人体已就绪 → http://localhost:${PORT}`);
  console.log(`大模型：${API_KEY ? `${MODEL}（Ollama Cloud）` : '未配置 key，AI 走离线模板兜底'}`);
});
