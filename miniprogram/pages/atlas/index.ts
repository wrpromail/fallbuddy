import { api } from '../../services/api';
import type { AtlasData, AtlasStoryCard, AvatarState, GroupSummary } from '../../shared/types';
import type { BodyPart } from '../../shared/enums';

interface HottestBar {
  bodyPart: string;
  label: string;
  count: number;
  pct: number;
}

interface AtlasPageData {
  loading: boolean;
  groups: GroupSummary[];
  groupIndex: number;
  group: GroupSummary | null;
  view: 'front' | 'back';
  period: 'week' | 'all';
  atlas: AtlasData | null;
  hottest: HottestBar[];
  avatar: AvatarState | null;
  sheetOpen: boolean;
  sheetSpot: { id: string; label: string } | null;
  sheetStories: AtlasStoryCard[];
  sheetHeight: number;
  error: string;
  pendingGroupId: string;
}

const LAST_GROUP_KEY = 'shaiyouji.lastGroupId';

Page({
  data: {
    loading: true,
    groups: [],
    groupIndex: 0,
    group: null,
    view: 'front',
    period: 'all',
    atlas: null,
    hottest: [],
    avatar: null,
    sheetOpen: false,
    sheetSpot: null,
    sheetStories: [],
    sheetHeight: 380,
    error: '',
    pendingGroupId: '',
  } as AtlasPageData,

  onLoad(query: Record<string, string | undefined>) {
    if (query.groupId) this.setData({ pendingGroupId: query.groupId });
  },

  onShow() {
    this.load();
  },

  async onPullDownRefresh() {
    await this.load();
    wx.stopPullDownRefresh();
  },

  async load() {
    this.setData({ loading: true, error: '' });
    const [meRes, groupsRes] = await Promise.all([api.auth.ensureUser(), api.group.listMine()]);
    if (!groupsRes.ok) {
      this.setData({ loading: false, error: groupsRes.message });
      return;
    }
    const groups = groupsRes.data;
    if (!groups.length) {
      this.setData({ loading: false, groups: [], group: null, error: '你还没有加入任何圈子' });
      return;
    }
    const preferred =
      this.data.pendingGroupId ||
      (wx.getStorageSync(LAST_GROUP_KEY) as string | undefined) ||
      groups[0].id;
    let index = groups.findIndex((group) => group.id === preferred);
    if (index < 0) index = 0;
    const avatar = meRes.ok ? meRes.data.avatar : null;
    this.setData({ groups, groupIndex: index, group: groups[index], avatar, pendingGroupId: '' });
    await this.refreshAtlas();
    this.setData({ loading: false });
    this.refreshBadge();
  },

  async refreshAtlas() {
    const group = this.data.group;
    if (!group) return;
    const res = await api.group.getAtlas({ groupId: group.id, view: this.data.view, period: this.data.period });
    if (!res.ok) {
      this.setData({ error: res.message });
      return;
    }
    const atlas = res.data;
    const max = Math.max(1, ...atlas.hottest.map((item) => item.count));
    this.setData({
      atlas,
      group: atlas.group,
      hottest: atlas.hottest.map((item) => ({ ...item, pct: Math.round((item.count / max) * 100) })),
      error: '',
    });
    wx.setStorageSync(LAST_GROUP_KEY, atlas.group.id);
  },

  async refreshBadge() {
    const res = await api.interaction.getInbox({ limit: 1 });
    if (!res.ok) return;
    if (res.data.unreadCount > 0) {
      wx.setTabBarBadge({ index: 2, text: String(res.data.unreadCount), fail: () => undefined });
    } else {
      wx.removeTabBarBadge({ index: 2, fail: () => undefined });
    }
  },

  onGroupTap() {
    const { groups } = this.data;
    if (groups.length < 2) {
      wx.showToast({ title: '先在圈子里邀请朋友吧', icon: 'none' });
      return;
    }
    wx.showActionSheet({
      itemList: groups.map((group) => group.name),
      success: (res) => {
        const group = groups[res.tapIndex];
        if (!group) return;
        this.setData({ group, groupIndex: res.tapIndex });
        this.refreshAtlas();
      },
    });
  },

  onSwitchView(event: WechatMiniprogram.TouchEvent) {
    const view = (event.currentTarget.dataset as { view: string }).view === 'back' ? 'back' : 'front';
    if (view === this.data.view) return;
    this.setData({ view });
    this.refreshAtlas();
  },

  onSwitchPeriod(event: WechatMiniprogram.TouchEvent) {
    const period = (event.currentTarget.dataset as { period: string }).period === 'week' ? 'week' : 'all';
    if (period === this.data.period) return;
    this.setData({ period });
    this.refreshAtlas();
  },

  onHotspot(event: WechatMiniprogram.CustomEvent<{ id: string; label: string }>) {
    const atlas = this.data.atlas;
    if (!atlas) return;
    const spot = atlas.hotspots.find((item) => item.id === event.detail.id);
    const stories = atlas.stories.filter((story) => story.bodyParts.includes(event.detail.id as BodyPart));
    if (!spot || !stories.length) {
      wx.showToast({ title: `${event.detail.label}还没有故事`, icon: 'none' });
      return;
    }
    this.setData({
      sheetOpen: true,
      sheetSpot: { id: spot.id, label: spot.label },
      sheetStories: stories,
      sheetHeight: Math.min(620, Math.max(160, stories.length * 230 + 24)),
    });
  },

  closeSheet() {
    this.setData({ sheetOpen: false });
  },

  noop() {
    // 阻止面板点击冒泡到遮罩
  },

  onSelectStory(event: WechatMiniprogram.CustomEvent<{ storyId: string }>) {
    this.setData({ sheetOpen: false });
    const group = this.data.group;
    wx.navigateTo({
      url: `/pages/story/detail?storyId=${event.detail.storyId}${group ? `&groupId=${group.id}` : ''}`,
    });
  },

  onCreate() {
    const group = this.data.group;
    wx.navigateTo({ url: `/pages/incident/create${group ? `?groupId=${group.id}` : ''}` });
  },

  onGroup() {
    const group = this.data.group;
    if (!group) return;
    wx.navigateTo({ url: `/pages/group/index?groupId=${group.id}` });
  },

  onSettings() {
    wx.navigateTo({ url: '/pages/settings/index' });
  },

  onShareAppMessage() {
    const group = this.data.group;
    return {
      title: group ? `${group.name}的战损图鉴 · 摔友记` : '摔友记 · 把运动翻车现场变成共同回忆',
      path: group ? `/pages/atlas/index?groupId=${group.id}` : '/pages/atlas/index',
    };
  },
});
