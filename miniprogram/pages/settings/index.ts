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
  blocked: { id: string; name: string }[];
  accountDeleted: boolean;
  deleting: boolean;
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
    blocked: [],
    accountDeleted: false,
    deleting: false,
  } as SettingsPageData,

  onLoad() {
    this.load();
  },

  async load() {
    const [res, blocked] = await Promise.all([api.settings.get(), api.interaction.listBlocked()]);
    if (!res.ok) {
      this.setData({ loading: false, accountDeleted: res.code === 'ACCOUNT_DELETED' });
      wx.showToast({ title: res.message, icon: 'none' });
      return;
    }
    this.setData({ loading: false, prefs: res.data, reduceMotion: res.data.reduceMotion,
      blocked: blocked.ok ? blocked.data : [] });
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

  onHideAvatar(event: WechatMiniprogram.SwitchChange) {
    this.save({ hideAvatar: event.detail.value });
  },

  onAnonymous(event: WechatMiniprogram.SwitchChange) {
    this.save({ anonymousByDefault: event.detail.value });
  },

  async onUnblock(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id;
    const res = await api.interaction.setBlocked({ userId: id, blocked: false });
    if (!res.ok) wx.showToast({ title: res.message, icon: 'none' });
    else this.setData({ blocked: this.data.blocked.filter((user) => user.id !== id) });
  },

  onDeleteAccount() {
    if (!this.data.isCloud || this.data.deleting || this.data.accountDeleted) return;
    wx.showModal({
      title: '永久注销账号？',
      content: '你的事故、草稿、角色和背包将被删除，圈友收到的道具会保留。注销立即生效，无法撤销。',
      confirmText: '确认注销',
      confirmColor: '#D93A3A',
      success: async ({ confirm }) => {
        if (!confirm || this.data.deleting) return;
        this.setData({ deleting: true });
        const res = await api.auth.deleteAccount({ confirm: true });
        this.setData({ deleting: false });
        if (!res.ok) {
          wx.showToast({ title: res.message, icon: 'none' });
          return;
        }
        this.setData({ accountDeleted: true, blocked: [], prefs: DEFAULT_PREFS });
        wx.reLaunch({ url: '/pages/settings/index' });
      },
    });
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
      title: '关于摔友记',
      content: this.data.isCloud
        ? '事故、圈子、角色和互动保存在试用云环境。发布和编辑的文字会经过微信内容安全检查。注销会删除账号和个人记录，保留已到账道具的最小交易记录。'
        : '这里使用本机演示数据。可从设置重置在这台设备上创建的故事、互动和角色。',
      showCancel: false,
      confirmText: '知道了',
    });
  },
});
