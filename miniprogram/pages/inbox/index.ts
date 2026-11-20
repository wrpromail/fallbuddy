import { api } from '../../services/api';
import { ACTION_MAP } from '../../shared/actions';
import { ITEM_MAP } from '../../shared/items';
import { relativeTime } from '../../shared/time';
import type { ActionId, InboxEvent } from '../../shared/types';

interface EventView {
  id: string;
  actionId: ActionId;
  storyId: string;
  actorName: string;
  text: string;
  emoji: string;
  timeText: string;
  read: boolean;
  itemIcon: string;
  itemName: string;
}

interface InboxPageData {
  loading: boolean;
  events: EventView[];
  unreadCount: number;
  nextCursor: string | null;
  loadingMore: boolean;
  error: string;
}

Page({
  data: {
    loading: true,
    events: [],
    unreadCount: 0,
    nextCursor: null,
    loadingMore: false,
    error: '',
  } as InboxPageData,

  onShow() {
    this.load();
  },

  async onPullDownRefresh() {
    await this.load();
    wx.stopPullDownRefresh();
  },

  async load() {
    this.setData({ loading: true, error: '' });
    const res = await api.interaction.getInbox({ limit: 20 });
    if (!res.ok) {
      this.setData({ loading: false, error: res.message });
      return;
    }
    this.setData({
      loading: false,
      events: res.data.events.map((event) => this.toView(event)),
      unreadCount: res.data.unreadCount,
      nextCursor: res.data.nextCursor,
    });
    this.syncBadge(res.data.unreadCount);
  },

  toView(event: InboxEvent): EventView {
    const action = ACTION_MAP[event.actionId];
    const item = event.itemDefId ? ITEM_MAP[event.itemDefId] : undefined;
    const text =
      event.actionId === 'receive_gift'
        ? `送你一件「${item?.name ?? '装备'}」`
        : `${action?.name ?? '互动'}了你的故事`;
    return {
      id: event.id,
      actionId: event.actionId,
      storyId: event.storyId,
      actorName: event.actorName,
      text,
      emoji: action?.fallbackEmoji ?? '💬',
      timeText: relativeTime(event.createdAt),
      read: event.read,
      itemIcon: item && item.category !== 'cosmetic' ? `/assets/items/${item.id}.png` : item?.icon ?? '',
      itemName: item?.name ?? '',
    };
  },

  syncBadge(unread: number) {
    if (unread > 0) {
      wx.setTabBarBadge({ index: 2, text: String(unread), fail: () => undefined });
    } else {
      wx.removeTabBarBadge({ index: 2, fail: () => undefined });
    }
  },

  async onLoadMore() {
    if (!this.data.nextCursor || this.data.loadingMore) return;
    this.setData({ loadingMore: true });
    const res = await api.interaction.getInbox({ cursor: this.data.nextCursor, limit: 20 });
    if (!res.ok) {
      this.setData({ loadingMore: false });
      return;
    }
    this.setData({
      loadingMore: false,
      events: [...this.data.events, ...res.data.events.map((event) => this.toView(event))],
      nextCursor: res.data.nextCursor,
    });
  },

  async onMarkAllRead() {
    if (!this.data.unreadCount) return;
    const ids = this.data.events.map((event) => event.id);
    const res = await api.interaction.markRead({ eventIds: ids });
    if (!res.ok) {
      wx.showToast({ title: res.message, icon: 'none' });
      return;
    }
    this.setData({
      events: this.data.events.map((event) => ({ ...event, read: true })),
      unreadCount: 0,
    });
    this.syncBadge(0);
    wx.showToast({ title: '都看完啦', icon: 'none' });
  },

  async onTapEvent(event: WechatMiniprogram.TouchEvent) {
    const dataset = event.currentTarget.dataset as { index: number };
    const item = this.data.events[dataset.index];
    if (!item) return;
    if (!item.read) {
      await api.interaction.markRead({ eventIds: [item.id] });
      const events = this.data.events.slice();
      events[dataset.index] = { ...item, read: true };
      const unreadCount = Math.max(0, this.data.unreadCount - 1);
      this.setData({ events, unreadCount });
      this.syncBadge(unreadCount);
    }
    wx.navigateTo({ url: `/pages/story/detail?storyId=${item.storyId}&action=${item.actionId}` });
  },

  goAtlas() {
    wx.switchTab({ url: '/pages/atlas/index' });
  },
});
