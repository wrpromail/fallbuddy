import { api, DATA_SOURCE } from '../../services/api';
import { resetState } from '../../services/store';
import type { UserPreferences } from '../../shared/types';

interface SettingsPageData {
  loading: boolean;
  saving: boolean;
  prefs: UserPreferences;
  appVersion: string;
  dataSource: string;
  isCloud: boolean;
  reduceMotion: boolean;
}

const DEFAULT_PREFS: UserPreferences = {
  allowFunnyActions: true,
  allowGifts: true,
  reduceMotion: false,
  anonymousByDefault: false,
};

Page({
  data: {
    loading: true,
    saving: false,
    prefs: DEFAULT_PREFS,
    appVersion: '0.1.0',
    dataSource: DATA_SOURCE === 'cloud' ? '微信云开发' : '本地演示数据',
    isCloud: DATA_SOURCE === 'cloud',
    reduceMotion: false,
  } as SettingsPageData,

  onLoad() {
    this.load();
  },

  async load() {
    const res = await api.settings.get();
    if (!res.ok) {
      this.setData({ loading: false });
      wx.showToast({ title: res.message, icon: 'none' });
      return;
    }
    this.setData({ loading: false, prefs: res.data, reduceMotion: res.data.reduceMotion });
  },

  async save(patch: Partial<UserPreferences>) {
    const prev = this.data.prefs;
    const next = { ...prev, ...patch };
    this.setData({ prefs: next, reduceMotion: next.reduceMotion });
    const res = await api.settings.update({ preferences: patch });
    if (!res.ok) {
      this.setData({ prefs: prev, reduceMotion: prev.reduceMotion });
      wx.showToast({ title: res.message, icon: 'none' });
    }
  },

  onFunny(event: WechatMiniprogram.SwitchChange) {
    this.save({ allowFunnyActions: event.detail.value });
  },

  onGifts(event: WechatMiniprogram.SwitchChange) {
    this.save({ allowGifts: event.detail.value });
  },

  onReduceMotion(event: WechatMiniprogram.SwitchChange) {
    this.save({ reduceMotion: event.detail.value });
  },

  onAnonymous(event: WechatMiniprogram.SwitchChange) {
    this.save({ anonymousByDefault: event.detail.value });
  },

  onReset() {
    if (this.data.isCloud) return;
    wx.showModal({
      title: '重置本地演示数据？',
      content: '会清空你在这台设备上创建的故事、互动与换装，恢复到初始的 6 位雪友演示数据。',
      confirmText: '重置',
      confirmColor: '#D93A3A',
      success: (result) => {
        if (!result.confirm) return;
        resetState();
        wx.showToast({ title: '已重置', icon: 'success' });
        setTimeout(() => wx.reLaunch({ url: '/pages/atlas/index' }), 600);
      },
    });
  },

  onAbout() {
    wx.showModal({
      title: '关于摔友记 V0',
      content:
        '本地可交互原型：原生 TypeScript 微信小程序 + 本地 mock 数据。角色素材为原创几何造型。V0 不含云函数、录音与 AI，也不会向任何服务器发送数据。上线前需核验微信个人主体服务类目、UGC 审核、隐私保护指引与备案要求。',
      showCancel: false,
      confirmText: '知道了',
    });
  },
});
