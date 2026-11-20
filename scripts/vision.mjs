#!/usr/bin/env node
// 开发辅助：用 Gemini 多模态模型检视截图/素材，输出文字评审。
// 用法: node scripts/vision.mjs <image> "<prompt>" [model]
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

const [, , file, prompt, modelArg] = process.argv;
if (!file || !prompt) {
  console.error('usage: node scripts/vision.mjs <image> "<prompt>" [model]');
  process.exit(2);
}
const key = process.env.GEMINI_API_KEY || (() => {
  const raw = readFileSync(process.env.HOME + '/.gemini/antigravity-cli/gemini-api.env', 'utf8');
  return raw.match(/GEMINI_API_KEY=['"]?([^'"\n]+)/)[1];
})();
const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[extname(file).toLowerCase()] || 'image/png';
const model = modelArg || 'gemini-2.5-flash';
const body = {
  contents: [{ role: 'user', parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: readFileSync(file).toString('base64') } }] }],
  generationConfig: { temperature: 0.2, maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 0 } },
};
const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
  body: JSON.stringify(body),
});
const json = await res.json();
if (!res.ok) { console.error(JSON.stringify(json).slice(0, 800)); process.exit(1); }
const text = json.candidates?.[0]?.content?.parts?.map(p => p.text).join('\n') ?? '(no text)';
if (json.candidates?.[0]?.finishReason && json.candidates[0].finishReason !== 'STOP') console.error('[finish]', json.candidates[0].finishReason);
console.log(text.trim());
