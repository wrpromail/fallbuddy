import { api } from '../../services/api';
import { ACTION_MAP } from '../../shared/actions';
import {
  BODY_PART_LABEL,
  CAUSE_LABEL,
  IMPACT_LABEL,
  PROTECTIVE_LABEL,
  SCENARIO_LABEL,
  SPORT_EMOJI,
  SPORT_LABEL,
  UPDATE_TYPE_LABEL,
  UPDATE_TYPES,
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
  hugActor: NonNullable<StoryDetail['replay']>['actorAppearance'] | null;
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
  bodyPartLabels: string[];
  canEdit: boolean;
  composingUpdate: boolean;
  updateTypeIndex: number;
  updateTypeLabels: string[];
  updateBody: string;
  updateSaving: boolean;
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
  pendingReplayId: string;
}

let reqSeq = 0;
function requestId(): string {
  reqSeq += 1;
  return `req_story_${Date.now()}_${reqSeq}`;
}

type RigHandle = { play?: (actionId: string) => void; stop?: () => void };

function audienceLabel(detail: StoryDetail): string {
  if (detail.story.publishStatus === 'withdrawn') return '故事已撤回';
  if (detail.story.visibility === 'self') return '仅自己可见';
  if (detail.story.moderationStatus !== 'approved') return '圈友暂不可见';
  if (detail.viewerIsAuthor) {
    const audiences = detail.authorAudiences ?? [
      ...(detail.group ? [detail.group] : []),
      ...(detail.retainedAudiences ?? []),
    ];
    if (audiences.length) {
      const names = audiences.map(({ name }) => `「${name}」`).join('、');
      return detail.retainedAudiences?.length ? `仍对${names}可见` : `对${names}可见`;
    }
  }
  return detail.group?.name ?? '圈内可见';
}

Page({
  data: {
    loading: true,
    detail: null,
    error: '',
    myAvatar: null,
    hugActor: null,
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
    bodyPartLabels: [],
    canEdit: false,
    composingUpdate: false,
    updateTypeIndex: 0,
    updateTypeLabels: UPDATE_TYPES.map((type) => UPDATE_TYPE_LABEL[type]),
    updateBody: '',
    updateSaving: false,
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
    pendingReplayId: '',
  } as DetailPageData,

  animationTimer: 0 as unknown as number,
  replayTimer: 0 as unknown as number,
  loadSequence: 0,

  composerVersion: 0,
  lastUpdate: null as { signature: string; id: string } | null,

  onLoad(query: Record<string, string | undefined>) {
    this.setData({
      pendingStoryId: query.storyId ?? '',
      pendingGroupId: query.groupId ?? '',
      pendingReplayId: query.eventId ?? '',
    });
  },

  onShow() {
    this.load();
  },

  onUnload() {
    this.loadSequence += 1;
    if (this.replayTimer) clearTimeout(this.replayTimer);
    if (this.animationTimer) clearTimeout(this.animationTimer);
  },

  async load() {
    if (!this.data.pendingStoryId) {
      this.setData({ loading: false, error: '缺少 storyId' });
      return;
    }
    const sequence = ++this.loadSequence;
    this.setData({ loading: true, error: '' });
    const [detailRes, meRes] = await Promise.all([
      api.story.getDetail({
        storyId: this.data.pendingStoryId,
        groupId: this.data.pendingGroupId || undefined,
        replayEventId: this.data.pendingReplayId || undefined,
      }),
      api.auth.ensureUser(),
    ]);
    if (sequence !== this.loadSequence) return;
    if (!detailRes.ok) {
      this.setData({ loading: false, error: detailRes.message, detail: null, updatesView: [], canEdit: false });
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
      isMine: detail.viewerIsAuthor,
      groupName: audienceLabel(detail),
      timeText: relativeTime(detail.story.createdAt),
      sportLabel: SPORT_LABEL[incident.sport],
      sportEmoji: SPORT_EMOJI[incident.sport],
      impactLabel: IMPACT_LABEL[incident.impactKind],
      scenarioLabels: incident.scenario.map((item) => SCENARIO_LABEL[item]).filter(Boolean),
      causeLabels: incident.selfReportedCause.map((item) => CAUSE_LABEL[item]).filter(Boolean),
      protectiveLabels: incident.protectiveItems.map((item) => PROTECTIVE_LABEL[item]).filter(Boolean),
      updatesView,
      bodyPartLabels: incident.bodyParts.map((part) => BODY_PART_LABEL[part]),
      canEdit: detail.viewerIsAuthor && detail.story.publishStatus === 'published' && detail.story.moderationStatus !== 'hidden',
    });
    if (this.data.pendingReplayId) {
      const replay = detail.replay;
      this.setData({ pendingReplayId: '' });
      if (replay) {
        this.replayTimer = setTimeout(() => {
          if (sequence === this.loadSequence) this.playAction(replay.actionId, replay.actorAppearance);
        }, 260) as unknown as number;
      } else {
        wx.showToast({ title: '这条互动已无法回放', icon: 'none' });
      }
    }
  },

  async onFollow() {
    const detail = this.data.detail;
    if (!detail?.group) return;
    const res = await api.story.setFollow({ groupId: detail.group.id, storyId: detail.story.id, follow: !detail.following });
    if (!res.ok) wx.showToast({ title: res.message, icon: 'none' });
    await this.load();
  },

  onEditStory() {
    if (!this.data.canEdit || !this.data.detail) return;
    wx.navigateTo({ url: `/pages/incident/create?storyId=${this.data.detail.story.id}` });
  },

  onComposeUpdate() {
    if (!this.data.composingUpdate) this.composerVersion = this.data.detail?.story.version ?? 0;
    this.setData({ composingUpdate: !this.data.composingUpdate });
  },

  onUpdateType(event: WechatMiniprogram.PickerChange) {
    this.setData({ updateTypeIndex: Number(event.detail.value) });
  },

  onUpdateBody(event: WechatMiniprogram.Input) {
    this.setData({ updateBody: event.detail.value });
  },

  async onSaveUpdate() {
    const { detail, canEdit, updateBody, updateTypeIndex, updateSaving } = this.data;
    if (!detail || !canEdit || updateSaving || !updateBody.trim()) return;
    const body = updateBody.trim();
    const type = UPDATE_TYPES[updateTypeIndex];
    const expectedVersion = this.composerVersion || detail.story.version;
    const signature = JSON.stringify([detail.story.id, expectedVersion, type, body]);
    if (signature !== this.lastUpdate?.signature) this.lastUpdate = { signature, id: requestId() };
    this.setData({ updateSaving: true });
    try {
      const res = await api.story.appendUpdate({
        storyId: detail.story.id, expectedVersion, type, body, requestId: this.lastUpdate.id,
      });
      if (!res.ok) {
        if (res.code === 'CONFLICT') {
          await this.load();
          this.composerVersion = this.data.detail?.story.version ?? expectedVersion;
        }
        wx.showToast({ title: res.message, icon: 'none' });
        return;
      }
      this.lastUpdate = null;
      this.setData({ composingUpdate: false, updateBody: '', updateTypeIndex: 0 });
      await this.load();
    } catch {
      wx.showToast({ title: '暂时无法保存后续，请重试', icon: 'none' });
    } finally {
      this.setData({ updateSaving: false });
    }
  },

  onWithdrawUpdate(event: WechatMiniprogram.TouchEvent) {
    const detail = this.data.detail;
    if (!detail || !this.data.isMine) return;
    const { id } = event.currentTarget.dataset as { id: string };
    wx.showModal({
      title: '撤回这条后续？',
      confirmText: '撤回',
      success: async ({ confirm }) => {
        if (!confirm) return;
        const res = await api.story.withdrawUpdate({ storyId: detail.story.id, updateId: id });
        if (!res.ok) {
          wx.showToast({ title: res.message, icon: 'none' });
          return;
        }
        await this.load();
      },
    });
  },

  playAction(actionId: ActionId, actor?: NonNullable<DetailPageData['hugActor']>) {
    const def = ACTION_MAP[actionId];
    if (!def) return;
    if (this.animationTimer) clearTimeout(this.animationTimer);
    if (this.data.reduceMotion) {
      this.setData({ stageClass: '', hugActor: null, stageEmoji: def.fallbackEmoji, animationHint: '已按你的设置使用静态效果' });
      this.animationTimer = setTimeout(() => {
        this.setData({ stageEmoji: '', animationHint: '' });
      }, 1600) as unknown as number;
      return;
    }
    const rig = this.selectComponent('#author-rig') as unknown as RigHandle | null;
    this.setData({
      stageClass: actionId === 'hug' ? 'is-hug' : '',
      hugActor: actionId === 'hug' ? actor ?? this.data.myAvatar : null,
      stageEmoji: actionId === 'hug' ? '💗' : actionId === 'spin' ? '😵‍💫' : actionId === 'cheer' ? '🎉' : '🎁',
      animationHint: '',
    });
    rig?.play?.(actionId);
    this.animationTimer = setTimeout(() => {
      this.setData({ stageClass: '', stageEmoji: '', hugActor: null });
      rig?.stop?.();
    }, def.durationMs + 700) as unknown as number;
  },

  async onReact(event: WechatMiniprogram.CustomEvent<{ actionId: ActionId }>) {
    const detail = this.data.detail;
    if (!detail) return;
    if (!detail.canInteract) {
      wx.showToast({ title: '这条故事暂时不能互动', icon: 'none' });
      return;
    }
    const actionId = event.detail.actionId;
    if (actionId === 'spin' && !detail.canSpin) {
      wx.showToast({ title: '作者关闭了转圈', icon: 'none' });
      return;
    }
    const res = await api.interaction.react({
      groupId: detail.group?.id,
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
      groupId: detail.group?.id,
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

  onDeleteStory() {
    const detail = this.data.detail;
    if (!detail?.viewerIsAuthor) return;
    wx.showModal({
      title: '永久删除这条事故记录？',
      content: '事故、故事和后续会从你的记录、圈子和对方的消息中移除。已到账的道具保留在接收方背包。此操作无法撤销。',
      confirmText: '永久删除',
      confirmColor: '#D93A3A',
      success: async ({ confirm }) => {
        if (!confirm) return;
        const res = await api.story.delete({ storyId: detail.story.id, version: detail.story.version });
        if (!res.ok && res.code !== 'NOT_FOUND') {
          if (res.code === 'CONFLICT') await this.load();
          wx.showToast({ title: res.message, icon: 'none' });
          return;
        }
        wx.showToast({ title: '已删除', icon: 'success' });
        wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/atlas/index' }) });
      },
    });
  },

  onReport() {
    const detail = this.data.detail;
    if (!detail?.group || detail.viewerIsAuthor) return;
    const { group, story } = detail;
    const reasons = ['privacy', 'abuse', 'other'] as const;
    wx.showActionSheet({
      itemList: ['泄露个人信息', '骚扰或攻击', '其他'],
      success: async ({ tapIndex }) => {
        const reason = reasons[tapIndex];
        if (!reason) return;
        const result = await api.moderation.reportStory({
          storyId: story.id, groupId: group.id, reason, requestId: requestId(),
        });
        wx.showToast({ title: result.ok ? '已提交举报' : result.message, icon: 'none' });
      },
    });
  },

  goAtlas() {
    wx.navigateBack({ delta: 1, fail: () => wx.switchTab({ url: '/pages/atlas/index' }) });
  },

  onShareAppMessage() {
    const detail = this.data.detail;
    if (detail && (detail.story.visibility === 'self' || detail.story.moderationStatus !== 'approved' || detail.story.publishStatus !== 'published')) {
      return { title: '摔友记 · 把运动翻车现场变成共同回忆', path: '/pages/atlas/index' };
    }
    return {
      title: detail ? detail.story.title : '摔友记',
      path: detail ? `/pages/story/detail?storyId=${detail.story.id}` : '/pages/atlas/index',
    };
  },
});
