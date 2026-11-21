const { randomUUID } = require('node:crypto');
const { dayKey } = require('./runtime/shared/time.js');
const { findSensitiveInfo } = require('./runtime/shared/moderation.js');

const MAX_BYTES = 380000;
const DAY = 86400000;

// 微信录音固定为 MPEG-2 Layer III、16 kHz、32 kbps。按帧验证时长。
function audioSeconds(buffer) {
  let offset = 0;
  if (buffer.toString('ascii', 0, 3) === 'ID3' && buffer.length >= 10) {
    const tag = buffer.subarray(6, 10);
    if (tag.some((byte) => byte > 127)) return 0;
    offset = 10 + tag.reduce((size, byte) => size * 128 + byte, 0);
  }
  let frames = 0;
  const rates = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  while (offset + 4 <= buffer.length) {
    const [a, b, c] = buffer.subarray(offset, offset + 3);
    const rate = rates[c >> 4];
    if (a !== 255 || (b & 254) !== 242 || (c & 12) !== 8 || !rate) return 0;
    offset += Math.floor(rate * 72000 / 16000) + ((c >> 1) & 1);
    frames++;
  }
  return offset === buffer.length ? frames * 576 / 16000 : 0;
}

function excerpt(text, limit) {
  return text.slice(0, limit);
}

function providerFromEnv(env = process.env) {
  const base = env.FALLBUDDY_VOICE_BASE_URL;
  const token = env.FALLBUDDY_VOICE_TOKEN;
  const model = env.FALLBUDDY_ASR_MODEL;
  const monthlyLimit = Number(env.FALLBUDDY_VOICE_MONTHLY_LIMIT);
  if (env.FALLBUDDY_VOICE_ENABLED !== '1' || !base?.startsWith('https://') || !token || !model ||
      !Number.isSafeInteger(monthlyLimit) || monthlyLimit < 1) return null;
  async function post(path, body, headers = {}) {
    const res = await fetch(base.replace(/\/$/, '') + path, { method: 'POST', body,
      redirect: 'error', headers: { ...headers, Authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(22000) });
    if (!res.ok) throw new Error('Provider unavailable');
    return res.json();
  }
  return {
    monthlyLimit,
    async transcribe(bytes) {
      const form = new FormData();
      form.append('file', new Blob([bytes], { type: 'audio/mpeg' }), 'recording.mp3');
      form.append('model', model);
      form.append('language', 'zh');
      const asr = await post('/audio/transcriptions', form);
      if (typeof asr.text !== 'string' || !asr.text.trim() || asr.text.length > 4000) throw new Error('Invalid transcript');
      const text = asr.text.trim();
      let title = '';
      let body = excerpt(text, 140);
      if (env.FALLBUDDY_DRAFT_MODEL && !findSensitiveInfo(text).length) {
        try {
          const response = await post('/chat/completions', JSON.stringify({ model: env.FALLBUDDY_DRAFT_MODEL,
            max_tokens: 300, messages: [
              { role: 'system', content: '从口述中摘取连续原文作为标题和正文。仅输出 JSON 对象 title（最多24字）、body（最多140字）。' },
              { role: 'user', content: text },
            ] }), { 'Content-Type': 'application/json' });
          const draft = JSON.parse(response.choices[0].message.content);
          if (typeof draft.title === 'string' && text.includes(draft.title) && draft.title.length <= 24) title = draft.title;
          if (typeof draft.body === 'string' && draft.body.trim() && draft.body.length <= 140 && text.includes(draft.body)) body = draft.body;
        } catch { /* 整理失败时仍返回原始转写供作者编辑。 */ }
      }
      return { text, title, body };
    },
  };
}

function createVoiceHandler({ transaction, store, provider, now = Date.now }) {
  return async (event, openid) => {
    const { method, args } = event;
    const p = args?.[0] ?? {};
    const requestId = typeof p.requestId === 'string' ? p.requestId : '';
    const fail = (code, message) => ({ ok: false, code, message, requestId });
    const ok = (data) => ({ ok: true, code: 'OK', data, requestId });
    if (method === 'available') return ok({ enabled: !!provider });
    if (!requestId || requestId.length > 100 || !['open', 'run', 'cancel'].includes(method)) {
      return fail('VALIDATION_FAILED', '无效的录音请求');
    }
    let bytes;
    if (method === 'run') {
      if (typeof p.audio !== 'string' || p.audio.length > Math.ceil(MAX_BYTES / 3) * 4) return fail('VALIDATION_FAILED', '录音过大');
      bytes = Buffer.from(p.audio, 'base64');
      const seconds = audioSeconds(bytes);
      if (seconds < 14.95 || seconds > 90.15) return fail('VALIDATION_FAILED', '录音须为 15 至 90 秒');
    }
    async function transact(action) {
      return transaction(async (state, write) => {
        const user = state.users.find((u) => u.openid === openid);
        if (!user || state.deletedAccounts?.[store.accountFingerprint(openid)]) return fail('UNAUTHORIZED', '请重新进入小程序');
        const jobs = (state.voiceJobs ?? []).filter((job) => now() - job.at < 32 * DAY);
        const row = jobs.find((job) => job.userId === user.id && job.requestId === requestId);
        const result = action(jobs, row, user.id);
        if (result.ok) {
          state.voiceJobs = jobs;
          await write(state);
        }
        return result;
      });
    }
    if (method === 'cancel') return transact((_jobs, row) => {
      if (row) row.status = 'cancelled';
      return ok({ cancelled: true });
    });
    if (!provider) return fail('UNAVAILABLE', '自动转写尚未启用');
    if (method === 'open') return transact((jobs, row, userId) => {
      if (p.consent !== true) return fail('VALIDATION_FAILED', '请先确认使用自动转写');
      if (row) return row.status === 'open' ? ok({ id: row.id }) : fail('CONFLICT', '此录音任务已处理');
      const day = dayKey(now());
      if (jobs.filter((job) => job.userId === userId && dayKey(job.at) === day).length >= 3 ||
          jobs.filter((job) => dayKey(job.at).slice(0, 7) === day.slice(0, 7)).length >= provider.monthlyLimit) {
        return fail('BUDGET_EXCEEDED', '录音整理额度已用完，可继续手动填写');
      }
      const id = randomUUID();
      jobs.push({ id, userId, requestId, at: now(), status: 'open' });
      return ok({ id });
    });
    const claimed = await transact((_jobs, row) => {
      if (!row || row.id !== p.id || row.status !== 'open' || now() - row.at > 5 * 60000) return fail('CONFLICT', '任务已过期或处理过');
      row.status = 'processing';
      return ok({ id: row.id });
    });
    if (!claimed.ok) return claimed;
    let draft;
    try { draft = await provider.transcribe(bytes); } catch { /* 不记录录音和服务响应。 */ }
    const done = await transact((_jobs, row) => {
      if (row?.status !== 'processing') return fail('CONFLICT', '任务已取消');
      row.status = draft ? 'done' : 'failed';
      return ok({ completed: !!draft });
    });
    if (!done.ok) return done;
    return draft ? ok(draft) : fail('UNAVAILABLE', '暂时无法转写，可重试或手动填写');
  };
}
module.exports = { createVoiceHandler, providerFromEnv, audioSeconds };
