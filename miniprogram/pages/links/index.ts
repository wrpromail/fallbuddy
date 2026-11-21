import { api } from '../../services/api';
import type { Choice } from '../../shared/community';

type Link = { id: string; otherId: string; title: string; status: string; canReview: boolean; canRevoke: boolean };
Page({
  data: { groupId: '', storyId: '', links: [] as Link[], choices: [] as Choice[], busy: false, error: '' },
  onLoad(query: Record<string, string>) {
    this.setData({ groupId: query.groupId, storyId: query.storyId });
  },
  onShow() { void this.load(); },
  async load() {
    const { groupId, storyId } = this.data;
    const res = await api.links.list({ groupId, storyId });
    this.setData(res.ok ? { ...res.data, error: '' } : { links: [], choices: [], error: res.message });
  },
  async onChoose(event: WechatMiniprogram.PickerChange) {
    const { groupId, storyId, choices, busy } = this.data;
    const choice = choices[Number(event.detail.value)];
    if (busy || !choice) return;
    this.setData({ busy: true });
    const res = await api.links.request({ groupId, storyId, myStoryId: choice.id, requestId: 'link_' + Date.now() });
    wx.showToast({ title: res.ok ? '已请对方确认' : res.message, icon: 'none' });
    await this.load();
    this.setData({ busy: false });
  },
  async onDecide(event: WechatMiniprogram.TouchEvent) {
    const { id, decision } = event.currentTarget.dataset;
    if (this.data.busy) return;
    this.setData({ busy: true });
    const res = await api.links.decide({ id, decision });
    if (!res.ok) wx.showToast({ title: res.message, icon: 'none' });
    await this.load();
    this.setData({ busy: false });
  },
  openStory(event: WechatMiniprogram.TouchEvent) {
    wx.navigateTo({ url: '/pages/story/detail?groupId=' + this.data.groupId + '&storyId=' + event.currentTarget.dataset.id });
  },
});
