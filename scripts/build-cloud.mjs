import { copyFile, cp, rm } from 'node:fs/promises';

const from = (path) => new URL(path, import.meta.url);
const output = from('../cloudfunctions/fallbuddy/runtime/');
await rm(output, { recursive: true, force: true });
await cp(from('../build/test/miniprogram/'), output, { recursive: true });
await copyFile(from('../cloudfunctions/fallbuddy/server-store.cjs'), new URL('services/store.js', output));
console.log('云函数运行时代码已打包到 cloudfunctions/fallbuddy/runtime/');
