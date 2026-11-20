import { api } from '../../services/api';
import { ACTION_MAP } from '../../shared/actions';
import {
  CAUSE_LABEL,
  IMPACT_LABEL,
  PROTECTIVE_LABEL,
  SCENARIO_LABEL,
  SPORT_EMOJI,
  SPORT_LABEL,
  UPDATE_TYPE_LABEL,
} from '../../shared/enums';
import { relativeTime } from '../../shared/time';
import type { ActionId, AvatarState, InventoryView, StoryDetail, UserPreferences } from '../../shared/types';
import type { UpdateType } from '../../shared/enums';

interface UpdateView {
  id: string;
  typeLabel: string;
  timeText: string;
  body: string;
}

interface DetailPageData {
  loading: boolean;
  detail: StoryDetail | null;
  error: string;
  myAvatar: AvatarState | null;
  reduceMotion: boolean;
  isMine: boolean;
  groupName: string;
  timeText: string;
  sportLabel: string;
  sportEmoji: string;
  impactLabel: string;
  scenarioLabels: string[];
  causeLabels: string[];
  protectiveLabels: string[];
  updatesView: UpdateView[];
  stageClass: string;
  stageEmoji: string;
  animationHint: string;
  showGift: boolean;
  giftItems: InventoryView[];
  giftHeight: number;
  selectedItem: string;
  pendingStoryId: string;
  pendingGroupId: string;
  pendingAction: string;
}

let reqSeq = 0;
function requestId(): string {
  reqSeq += 1;
  return `req_story_${Date.now()}_${reqSeq}`;
}

type RigHandle = { play?: (actionId: string) => void; stop?: () => void };

Page({
  data: {
    loading: true,
    detail: null,
    error: '',
    myAvatar: null,
    reduceMotion: false,
    isMine: false,
    groupName: '',
    timeText: '',
    sportLabel: '',
    sportEmoji: '',
    impactLabel: '',
    scenarioLabels: [],
    causeLabels: [],
    protectiveLabels: [],
    updatesView: [],
    stageClass: '',
    stageEmoji: '',
    animationHint: '',
    showGift: false,
    giftItems: [],
    giftHeight: 380,
    selectedItem: '',
    pendingStoryId: '',
    pendingGroupId: '',
    pendingAction: '',
  } as DetailPageData,

  animationTimer: 0 as unknown as number,

  onLoad(query: Record<string, string | undefined>) {
    this.setData({
      pendingStoryId: query.storyId ?? '',
      pendingGroupId: query.groupId ?? '',
      pendingAction: query.action ?? '',
    });
    this.load();
  },

  onUnload() {
    if (this.animationTimer) clearTimeout(this.animationTimer);
  },

  async load() {
    if (!this.data.pendingStoryId) {
      this.setData({ loading: false, error: '缺少 storyId' });
      return;
    }
    this.setData({ loading: true, error: '' });
    const [detailRes, meRes] = await Promise.all([
      api.story.getDetail({ storyId: this.data.pendingStoryId, groupId: this.data.pendingGroupId || undefined }),
      api.auth.ensureUser(),
    ]);
    if (!detailRes.ok) {
      this.setData({ loading: false, error: detailRes.message });
      return;
    }
    const detail = detailRes.data;
    const incident = detail.incident;
    const updatesView: UpdateView[] = detail.updates.map((update) => ({
      id: update.id,
      typeLabel: UPDATE_TYPE_LABEL[update.type as UpdateType] ?? '后续',
      timeText: relativeTime(update.createdAt),
      body: update.body,
    }));
    const myAvatar = meRes.ok ? meRes.data.avatar : null;
    const prefs: UserPreferences | null = meRes.ok ? meRes.data.preferences : null;
    this.setData({
      loading: false,
      detail,
      error: '',
      myAvatar,
      reduceMotion: prefs?.reduceMotion ?? false,
      isMine: detail.author.isMe === true,
      groupName: detail.group ? detail.group.name : '私密记录',
      timeText: relativeTime(detail.story.createdAt),
      sportLabel: SPORT_LABEL[incident.sport],
      sportEmoji: SPORT_EMOJI[incident.sport],
      impactLabel: IMPACT_LABEL[incident.impactKind],
      scenarioLabels: incident.scenario.map((item) => SCENARIO_LABEL[item]).filter(Boolean),
      causeLabels: incident.selfReportedCause.map((item) => CAUSE_LABEL[item]).filter(Boolean),
      protectiveLabels: incident.protectiveItems.map((item) => PROTECTIVE_LABEL[item]).filter(Boolean),
      updatesView,
    });
    if (this.data.pendingAction) {
      const action = this.data.pendingAction as ActionId;
      this.setData({ pendingAction: '' });
      setTimeout(() => this.playAction(action), 260);
    }
  },

  playAction(actionId: ActionId) {
    const def = ACTION_MAP[actionId];
    if (!def) return;
    if (this.animationTimer) clearTimeout(this.animationTimer);
    if (this.data.reduceMotion) {
      this.setData({ stageClass: '', stageEmoji: def.fallbackEmoji, animationHint: '已按你的设置使用静态效果' });
      this.animationTimer = setTimeout(() => {
        this.setData({ stageEmoji: '', animationHint: '' });
      }, 1600) as unknown as number;
      return;
    }
    const rig = this.selectComponent('#author-rig') as unknown as RigHandle | null;
    this.setData({
      stageClass: actionId === 'hug' ? 'is-hug' : '',
      stageEmoji: actionId === 'hug' ? '💗' : actionId === 'spin' ? '😵‍💫' : actionId === 'cheer' ? '🎉' : '🎁',
      animationHint: '',
    });
    rig?.play?.(actionId);
    this.animationTimer = setTimeout(() => {
      this.setData({ stageClass: '', stageEmoji: '' });
      rig?.stop?.();
    }, def.durationMs + 700) as unknown as number;
  },

  async onReact(event: WechatMiniprogram.CustomEvent<{ actionId: ActionId }>) {
    const detail = this.data.detail;
    if (!detail) return;
    const actionId = event.detail.actionId;
    if (actionId === 'spin' && !detail.canSpin) {
      wx.showToast({ title: '作者关闭了转圈', icon: 'none' });
      return;
    }
    const res = await api.interaction.react({
      storyId: detail.story.id,
      actionId,
      requestId: requestId(),
    });
    if (!res.ok) {
      wx.showToast({ title: res.message, icon: 'none' });
      return;
    }
    this.playAction(actionId);
    const refreshed = await api.story.getDetail({ storyId: detail.story.id, groupId: this.data.pendingGroupId || undefined });
    if (refreshed.ok) this.setData({ detail: refreshed.data });
  },

  async openGift() {
    const detail = this.data.detail;
    if (!detail) return;
    if (!detail.giftable) {
      wx.showToast({ title: '作者暂时不收礼物', icon: 'none' });
      return;
    }
    const res = await api.inventory.getMine();
    if (!res.ok) {
      wx.showToast({ title: res.message, icon: 'none' });
      return;
    }
    const giftItems = res.data.filter((item) => item.category === 'consumable' && item.quantity > 0);
    this.setData({
      showGift: true,
      giftItems,
      giftHeight: Math.min(440, Math.max(140, giftItems.length * 100 + 16)),
      selectedItem: giftItems[0]?.itemDefId ?? '',
    });
  },

  closeGift() {
    this.setData({ showGift: false });
  },

  noop() {
    // 面板内部点击不关闭
  },

  onSelectItem(event: WechatMiniprogram.CustomEvent<{ itemDefId: string }>) {
    this.setData({ selectedItem: event.detail.itemDefId });
  },

  async confirmGift() {
    const detail = this.data.detail;
    const itemDefId = this.data.selectedItem;
    if (!detail || !itemDefId) {
      wx.showToast({ title: '先选一件装备', icon: 'none' });
      return;
    }
    const res = await api.inventory.gift({
      toUserId: detail.story.authorId,
      storyId: detail.story.id,
      itemDefId,
      requestId: requestId(),
    });
    if (!res.ok) {
      wx.showToast({ title: res.message, icon: 'none' });
      return;
    }
    this.setData({ showGift: false, selectedItem: '' });
    this.playAction('receive_gift');
    wx.showToast({ title: '送到啦，等你朋友的动画', icon: 'none' });
    const refreshed = await api.story.getDetail({ storyId: detail.story.id, groupId: this.data.pendingGroupId || undefined });
    if (refreshed.ok) this.setData({ detail: refreshed.data });
  },

  async onWithdraw() {
    const detail = this.data.detail;
    if (!detail) return;
    wx.showModal({
      title: '撤回这条故事？',
      content: '撤回后它不会继续出现在圈子图鉴里，统计会同步更新。',
      confirmText: '撤回',
      confirmColor: '#D93A3A',
      success: async (result) => {
        if (!result.confirm) return;
        const res = await api.story.withdraw({ storyId: detail.story.id });
        if (!res.ok) {
          wx.showToast({ title: res.message, icon: 'none' });
          return;
        }
        wx.showToast({ title: '已撤回', icon: 'success' });
        setTimeout(
          () => wx.navigateBack({ delta: 1, fail: () => wx.switchTab({ url: '/pages/atlas/index' }) }),
          500,
        );
      },
    });
  },

  onReport() {
    wx.showModal({
      title: '举报入口',
      content: 'V0 本地原型还没有平台审核后台。这条举报不会真正提交，只用于验证交互位置。',
      showCancel: false,
      confirmText: '知道了',
    });
  },

  goAtlas() {
    wx.navigateBack({ delta: 1, fail: () => wx.switchTab({ url: '/pages/atlas/index' }) });
  },

  onShareAppMessage() {
    const detail = this.data.detail;
    return {
      title: detail ? detail.story.title : '摔友记',
      path: detail ? `/pages/story/detail?storyId=${detail.story.id}` : '/pages/atlas/index',
    };
  },
});
