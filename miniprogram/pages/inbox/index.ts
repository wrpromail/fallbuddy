import { api } from '../../services/api';
import { ACTION_MAP } from '../../shared/actions';
import { ITEM_MAP } from '../../shared/items';
import { relativeTime } from '../../shared/time';
import type { InboxGroup } from '../../shared/types';

function toView(group: InboxGroup) {
  const first = group.events[0];
  const action = ACTION_MAP[first.actionId];
  return {
    id: group.id,
    storyTitle: first.storyTitle,
    emoji: action.fallbackEmoji,
    summary: first.actionId === 'receive_gift'
      ? `收到 ${group.events.length} 份礼物`
      : `${action.name} × ${group.events.length}`,
    timeText: relativeTime(first.createdAt),
    unreadCount: group.unreadCount,
    events: group.events.map((event) => ({
      id: event.id,
      actorId: event.actorId,
      actorName: event.actorName,
      storyId: event.storyId,
      itemName: event.itemDefId ? ITEM_MAP[event.itemDefId]?.name ?? '道具' : '',
      timeText: relativeTime(event.createdAt),
    })),
  };
}

Page({
  data: {
    loading: true,
    updates: [] as { id: string; groupId: string; storyId: string; title: string; body: string }[],
    requests: [] as { id: string; title: string; targetTitle: string; storyId: string; groupId: string }[],
    groups: [] as ReturnType<typeof toView>[],
    openGroupId: '',
    unreadCount: 0,
    nextCursor: null as string | null,
    loadingMore: false,
    error: '',
  },

  loadSequence: 0,

  onShow() {
    void this.load();
  },

  async onPullDownRefresh() {
    await this.load();
    wx.stopPullDownRefresh();
  },

  async load() {
    const sequence = ++this.loadSequence;
    this.setData({ loading: true, loadingMore: false, error: '', openGroupId: '' });
    const [res, links, followed] = await Promise.all([api.interaction.getInboxGroups({ limit: 20 }),
      api.links.requests(), api.story.followedUpdates()]);
    if (sequence === this.loadSequence) this.setData({ requests: links.ok ? links.data : [], updates: followed.ok ? followed.data : [] });
    if (sequence !== this.loadSequence) return;
    if (!res.ok) {
      this.setData({ loading: false, error: res.message, groups: [], unreadCount: 0, nextCursor: null });
      this.syncBadge(0);
      return;
    }
    this.setData({
      loading: false,
      groups: res.data.groups.map(toView),
      unreadCount: res.data.unreadCount,
      nextCursor: res.data.nextCursor,
    });
    this.syncBadge(res.data.unreadCount);
  },

  syncBadge(unread: number) {
    if (unread > 0) wx.setTabBarBadge({ index: 2, text: unread > 99 ? '99+' : String(unread), fail: () => undefined });
    else wx.removeTabBarBadge({ index: 2, fail: () => undefined });
  },

  async onLoadMore() {
    if (!this.data.nextCursor || this.data.loadingMore) return;
    const sequence = this.loadSequence;
    this.setData({ loadingMore: true });
    const res = await api.interaction.getInboxGroups({ cursor: this.data.nextCursor, limit: 20 });
    if (sequence !== this.loadSequence) return;
    if (!res.ok) {
      this.setData({ loadingMore: false });
      wx.showToast({ title: res.message, icon: 'none' });
      return;
    }
    const loaded = new Set(this.data.groups.map((group) => group.id));
    this.setData({
      loadingMore: false,
      groups: [...this.data.groups, ...res.data.groups.filter((group) => !loaded.has(group.id)).map(toView)],
      nextCursor: res.data.nextCursor,
      unreadCount: res.data.unreadCount,
    });
    this.syncBadge(res.data.unreadCount);
  },

  async onMarkAllRead() {
    if (!this.data.unreadCount) return;
    const res = await api.interaction.markRead({ all: true });
    if (!res.ok) wx.showToast({ title: res.message, icon: 'none' });
    else await this.load();
  },

  async onToggleGroup(event: WechatMiniprogram.TouchEvent) {
    const id = String(event.currentTarget.dataset.id);
    const group = this.data.groups.find((item) => item.id === id);
    if (!group) return;
    const open = this.data.openGroupId !== id;
    this.setData({ openGroupId: open ? id : '' });
    if (!open || !group.unreadCount) return;
    const sequence = this.loadSequence;
    const res = await api.interaction.markRead({ groupKey: id });
    if (sequence !== this.loadSequence) return;
    if (!res.ok) {
      wx.showToast({ title: res.message, icon: 'none' });
      return;
    }
    const unreadCount = Math.max(0, this.data.unreadCount - res.data.updatedCount);
    this.setData({
      groups: this.data.groups.map((item) => item.id === id ? { ...item, unreadCount: 0 } : item),
      unreadCount,
    });
    this.syncBadge(unreadCount);
  },

  onReplay(event: WechatMiniprogram.TouchEvent) {
    const { story, id } = event.currentTarget.dataset;
    wx.navigateTo({ url: `/pages/story/detail?storyId=${encodeURIComponent(story)}&eventId=${encodeURIComponent(id)}` });
  },

  async onIgnore(event: WechatMiniprogram.TouchEvent) {
    const res = await api.interaction.ignoreInboxGroup({ groupKey: String(event.currentTarget.dataset.id) });
    if (!res.ok) wx.showToast({ title: res.message, icon: 'none' });
    else await this.load();
  },

  onBlock(event: WechatMiniprogram.TouchEvent) {
    const { id, name } = event.currentTarget.dataset;
    wx.showModal({
      title: `屏蔽${name}？`,
      content: '双方将无法互相互动或赠礼。你可以在设置里取消屏蔽。',
      confirmText: '屏蔽',
      success: async ({ confirm }) => {
        if (!confirm) return;
        const res = await api.interaction.setBlocked({ userId: id, blocked: true });
        wx.showToast({ title: res.ok ? '已屏蔽' : res.message, icon: 'none' });
        if (res.ok) await this.load();
      },
    });
  },

  goAtlas() {
    wx.switchTab({ url: '/pages/atlas/index' });
  },
});
