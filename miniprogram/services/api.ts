import { mockApi } from './mock/api';
import type { ApiErr } from '../shared/types';
import { CLOUD_ENV_ID } from '../shared/cloud-config';

export const DATA_SOURCE = CLOUD_ENV_ID ? 'cloud' : 'mock';
export type Api = typeof mockApi;

function createCloudApi(): Api {
  // 复用门面的业务签名，云函数只接受同一份白名单中的方法。
  const domains = Object.entries(mockApi).map(([domain, methods]) => [
    domain,
    Object.fromEntries(Object.keys(methods).map((method) => [method, async (...args: unknown[]) => {
      try {
        const response = await wx.cloud.callFunction({
          name: 'fallbuddy',
          data: { domain, method, args },
        });
        const body = response.result;
        if (body && typeof body === 'object' && 'ok' in body) return body;
      } catch {
        // 保留页面未提交的内容，调用方可用原 requestId 重试。
      }
      return { ok: false, code: 'UNAVAILABLE', message: '暂时无法连接服务器，请重试', requestId: '' } satisfies ApiErr;
    }])),
  ]);
  return Object.fromEntries(domains) as Api;
}

export const api: Api = CLOUD_ENV_ID ? createCloudApi() : mockApi;
