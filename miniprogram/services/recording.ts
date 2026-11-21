import { CLOUD_ENV_ID } from '../shared/cloud-config';
import type { ApiResponse } from '../shared/types';

export async function voiceCall<T>(method: string, params: Record<string, unknown> = {}): Promise<ApiResponse<T>> {
  if (CLOUD_ENV_ID) {
    try {
      const res = await wx.cloud.callFunction({ name: 'fallbuddy', data: { domain: 'voice', method, args: [params] } });
      if (res.result && typeof res.result === 'object' && 'ok' in res.result) return res.result as ApiResponse<T>;
    } catch { /* 保留本机录音，仍可手动录入。 */ }
  }
  return { ok: false, code: 'UNAVAILABLE', message: '自动转写当前不可用，可回听后手动填写', requestId: '' };
}

interface Listener { stop: (file: string, ms: number, size: number) => void; error: () => void }
let manager: WechatMiniprogram.RecorderManager | undefined;
let listener: Listener | null = null;
let discarded = false;
export function discardAudio(file: string) {
  if (file) wx.getFileSystemManager().unlink({ filePath: file, fail: () => undefined });
}

export function record(owner: Listener) {
  if (listener) return false;
  if (!manager) {
    manager = wx.getRecorderManager();
    manager.onStop(({ tempFilePath, duration, fileSize }) => {
      const active = discarded ? null : listener;
      listener = null;
      if (active) active.stop(tempFilePath, duration, fileSize);
      else discardAudio(tempFilePath);
    });
    manager.onError(() => {
      const active = discarded ? null : listener;
      listener = null;
      active?.error();
    });
  }
  discarded = false;
  listener = owner;
  try {
    manager.start({ duration: 90000, format: 'mp3', sampleRate: 16000, numberOfChannels: 1, encodeBitRate: 32000 });
  } catch { listener = null; return false; }
  return true;
}
export function stopRecording(owner: Listener, discard = false) {
  if (owner !== listener) return;
  if (discard) discarded = true;
  manager?.stop();
}
