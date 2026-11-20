/**
 * 业务 API 门面。
 * V0 全部走本地 mock（wx.setStorageSync 持久化）；V1 只需把 mockApi 换成云函数适配器，
 * 页面与类型无需改动。
 */
import { mockApi } from './mock/api';

export const DATA_SOURCE: 'mock' | 'cloud' = 'mock';
export const api = mockApi;
export type Api = typeof api;
