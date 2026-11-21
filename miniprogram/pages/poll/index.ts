import { api } from '../../services/api';
import { AWARDS, type Award, type Choice } from '../../shared/community';

type Candidate = Choice & { mine: boolean; pending: boolean; votes: number; rank: number };
Page({
  data: {
    groupId: '', award: 'safe_landing' as Award, awards: Object.values(AWARDS), awardLabel: AWARDS.safe_landing as string,
    period: '', periods: [] as string[], choices: [] as Choice[], candidates: [] as Candidate[],
    owner: false, paused: false, closed: false, voted: false, busy: false, error: '',
  },
  sequence: 0,
  onLoad(query: Record<string, string>) {
    this.setData({ groupId: query.groupId });
  },
  onShow() { void this.load(); },
  async load() {
    const sequence = ++this.sequence;
    const { groupId, award, period } = this.data;
    this.setData({ busy: true, candidates: [], choices: [] });
    const res = await api.poll.list({ groupId, award, period: period || undefined });
    if (sequence !== this.sequence) return;
    this.setData(res.ok ? { ...res.data, error: '', busy: false } : { error: res.message, busy: false });
  },
  onAward(event: WechatMiniprogram.PickerChange) {
    const award = (Object.keys(AWARDS) as Award[])[Number(event.detail.value)];
    this.setData({ award, awardLabel: AWARDS[award] });
    void this.load();
  },
  onPeriod(event: WechatMiniprogram.PickerChange) {
    this.setData({ period: this.data.periods[Number(event.detail.value)] });
    void this.load();
  },
  onClosePoll() {
    const { groupId, award, period } = this.data;
    wx.showModal({ title: '提前结束这个奖项的投票？', confirmText: '结束投票', success: async ({ confirm }) => {
      if (!confirm) return;
      const res = await api.poll.close({ groupId, award, period });
      if (!res.ok) wx.showToast({ title: res.message, icon: 'none' });
      await this.load();
    } });
  },
  onNominate(event: WechatMiniprogram.PickerChange) {
    const choice = this.data.choices[Number(event.detail.value)];
    if (choice) void this.change(choice.id, 'nominate');
  },
  onAction(event: WechatMiniprogram.TouchEvent) {
    const { id, action } = event.currentTarget.dataset;
    void this.change(id, action);
  },
  async change(storyId: string, action: 'nominate' | 'accept' | 'withdraw' | 'vote') {
    const { groupId, period, award, busy } = this.data;
    if (busy) return;
    this.setData({ busy: true });
    const res = await api.poll.change({ groupId, period, award, storyId, action });
    if (!res.ok) wx.showToast({ title: res.message, icon: 'none' });
    await this.load();
  },
  openStory(event: WechatMiniprogram.TouchEvent) {
    wx.navigateTo({ url: '/pages/story/detail?groupId=' + this.data.groupId + '&storyId=' + event.currentTarget.dataset.id });
  },
  onShareAppMessage() { return { title: '圈内故事评选', path: '/pages/poll/index?groupId=' + this.data.groupId }; },
});
