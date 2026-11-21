import type { ApiResponse, ErrorCode } from '../../shared/types';

let requestSeq = 0;

export function nextRequestId(): string {
  requestSeq += 1;
  return `req_${Date.now().toString(36)}_${requestSeq}_${Math.random().toString(36).slice(2, 6)}`;
}

export function ok<T>(data: T, requestId: string): ApiResponse<T> {
  // 模拟云端序列化，避免调用方拿到内部对象引用
  return { ok: true, code: 'OK', data: JSON.parse(JSON.stringify(data)) as T, requestId };
}

export function fail(code: ErrorCode, message: string, requestId: string): ApiResponse<never> {
  return { ok: false, code, message, requestId };
}
