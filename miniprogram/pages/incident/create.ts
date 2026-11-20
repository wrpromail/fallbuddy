import { api } from '../../services/api';
import {
  BODY_PARTS,
  BODY_PART_LABEL,
  CAUSES,
  CAUSE_LABEL,
  IMPACT_KINDS,
  IMPACT_LABEL,
  PROTECTIVE_ITEMS,
  PROTECTIVE_LABEL,
  SCENARIOS,
  SCENARIO_LABEL,
  SPORTS,
  SPORT_EMOJI,
  SPORT_LABEL,
  TONES,
  TONE_LABEL,
  type BodyPart,
  type Cause,
  type ImpactKind,
  type ProtectiveItem,
  type Scenario,
  type Sport,
  type Tone,
} from '../../shared/enums';
import { sensitiveWarning } from '../../shared/moderation';
import type { AvatarState, GroupSummary, UserPreferences } from '../../shared/types';

interface Option<T extends string> {
  id: T;
  label: string;
  emoji?: string;
  selected: boolean;
}

function options<T extends string>(ids: readonly T[], labels: Record<T, string>, emojis?: Record<T, string>): Option<T>[] {
  return ids.map((id) => ({ id, label: labels[id], emoji: emojis ? emojis[id] : undefined, selected: false }));
}

function markSelected<T extends string>(list: Option<T>[], selected: T[]): Option<T>[] {
  return list.map((item) => ({ ...item, selected: selected.includes(item.id) }));
}

interface GroupChip {
  id: string;
  name: string;
  memberCount: number;
  checked: boolean;
}

interface CreatePageData {
  loading: boolean;
  groups: GroupSummary[];
  groupChips: GroupChip[];
  myAvatar: AvatarState | null;
  avatarPalette: string;
  avatarExpression: string;
  avatarEquipped: unknown;
  sports: Option<Sport>[];
  scenarios: Option<Scenario>[];
  causes: Option<Cause>[];
  parts: Option<BodyPart>[];
  impacts: Option<ImpactKind>[];
  protections: Option<ProtectiveItem>[];
  tones: Option<Tone>[];
  sport: Sport;
  scenario: Scenario[];
  cause: Cause[];
  bodyParts: BodyPart[];
  impactKind: ImpactKind;
  protectiveItems: ProtectiveItem[];
  tone: Tone;
  title: string;
  body: string;
  titleLen: number;
  bodyLen: number;
  isAnonymous: boolean;
  allowFunnyActions: boolean;
  allowGifts: boolean;
  selfOnly: boolean;
  presets: string[];
  sensitive: string;
  selectedPartLabels: string[];
  impactLabel: string;
  toneLabel: string;
  submitting: boolean;
  canSubmit: boolean;
}

const PRESETS: Partial<Record<BodyPart, string[]>> = {
  tailbone: ['尾椎渡劫记', '雪地坐姿标准动作', '我的屁股先下班了'],
  head: ['差一点就飞升', '头盔替我挡了一劫', '雪堆比我更懂缓冲'],
  back: ['后背和雪地的第一次接触', '空中转体半周半'],
  waist: ['腰：我只是路过', '排队时被雪板绊了一下'],
  shoulder_l: ['肩膀说它有点懵', '左肩的意外加班'],
  shoulder_r: ['肩膀说它有点懵', '右肩的意外加班'],
  wrist_l: ['手腕说它今天不想上班', '手先着地的标准示范'],
  wrist_r: ['手腕说它今天不想上班', '手先着地的标准示范'],
  knee_l: ['膝盖的今日复盘', '护膝救场实录'],
  knee_r: ['膝盖的今日复盘', '护膝救场实录'],
  ankle_l: ['脚踝的意外假期', '雪鞋有点不听话'],
  ankle_r: ['脚踝的意外假期', '雪鞋有点不听话'],
};

const FALLBACK_PRESETS = ['今天在雪里打了个滚', '一次不太优雅的落地', '平安回家的乌龙'];

let reqSeq = 0;
function requestId(): string {
  reqSeq += 1;
  return `req_publish_${Date.now()}_${reqSeq}`;
}

function toggle<T>(list: T[], value: T, max: number): { list: T[]; limited: boolean } {
  if (list.includes(value)) return { list: list.filter((item) => item !== value), limited: false };
  if (list.length >= max) return { list, limited: true };
  return { list: [...list, value], limited: false };
}

Page({
  data: {
    loading: true,
    groups: [],
    groupChips: [],
    myAvatar: null,
    avatarPalette: 'blue',
    avatarExpression: 'happy',
    avatarEquipped: null,
    sports: [
      { id: 'ski_double', label: SPORT_LABEL.ski_double, emoji: SPORT_EMOJI.ski_double, selected: true },
      ...SPORTS.filter((id) => id !== 'ski_double').map((id) => ({
        id,
        label: SPORT_LABEL[id],
        emoji: SPORT_EMOJI[id],
        selected: false,
      })),
    ],
    scenarios: options(SCENARIOS, SCENARIO_LABEL),
    causes: options(CAUSES, CAUSE_LABEL),
    parts: options(BODY_PARTS.filter((id) => id !== 'other'), BODY_PART_LABEL),
    impacts: options(IMPACT_KINDS, IMPACT_LABEL).map((item) => ({ ...item, selected: item.id === 'near_miss' })),
    protections: options(PROTECTIVE_ITEMS, PROTECTIVE_LABEL),
    tones: options(TONES, TONE_LABEL).map((item) => ({ ...item, selected: item.id === 'humorous' })),
    sport: 'ski_double',
    scenario: [],
    cause: [],
    bodyParts: [],
    impactKind: 'near_miss',
    protectiveItems: [],
    tone: 'humorous',
    title: '',
    body: '',
    titleLen: 0,
    bodyLen: 0,
    isAnonymous: false,
    allowFunnyActions: false,
    allowGifts: true,
    selfOnly: false,
    presets: FALLBACK_PRESETS,
    sensitive: '',
    selectedPartLabels: [],
    impactLabel: IMPACT_LABEL.near_miss,
    toneLabel: TONE_LABEL.humorous,
    submitting: false,
    canSubmit: false,
  } as CreatePageData,

  pendingGroupId: '',

  onLoad(query: Record<string, string | undefined>) {
    this.pendingGroupId = query.groupId ?? '';
    if (query.bodyPart) {
      const part = query.bodyPart as BodyPart;
      if ((BODY_PARTS as readonly string[]).includes(part)) {
        this.setData({
          bodyParts: [part],
          parts: markSelected(this.data.parts, [part]),
          selectedPartLabels: [BODY_PART_LABEL[part]],
          presets: PRESETS[part] ?? FALLBACK_PRESETS,
        });
      }
    }
    this.load();
  },

  async load() {
    const [groupsRes, meRes] = await Promise.all([api.group.listMine(), api.auth.ensureUser()]);
    const groups = groupsRes.ok ? groupsRes.data : [];
    const prefs: UserPreferences | null = meRes.ok ? meRes.data.preferences : null;
    const avatar = meRes.ok ? meRes.data.avatar : null;
    const pending = this.pendingGroupId;
    const checkedIndex = pending ? groups.findIndex((group) => group.id === pending) : 0;
    const groupChips: GroupChip[] = groups.map((group, index) => ({
      id: group.id,
      name: group.name,
      memberCount: group.memberCount,
      checked: index === Math.max(0, checkedIndex),
    }));
    this.setData({
      loading: false,
      groups,
      groupChips,
      myAvatar: avatar,
      avatarPalette: avatar?.palette ?? 'blue',
      avatarExpression: avatar?.expression ?? 'happy',
      avatarEquipped: avatar?.equipped ?? null,
      isAnonymous: prefs?.anonymousByDefault ?? false,
      // 方案 4.2 建议默认关闭；作者可在发布页手动打开
      allowFunnyActions: false,
      allowGifts: prefs?.allowGifts ?? true,
    });
    this.refreshSubmitState();
  },

  refreshSubmitState() {
    const { title, body, bodyParts, scenario, cause, groupChips, selfOnly } = this.data;
    const canSubmit =
      title.trim().length > 0 &&
      body.trim().length > 0 &&
      bodyParts.length >= 1 &&
      scenario.length >= 1 &&
      cause.length >= 1 &&
      (selfOnly || groupChips.some((group) => group.checked));
    this.setData({ canSubmit });
  },

  onSport(event: WechatMiniprogram.TouchEvent) {
    const id = (event.currentTarget.dataset as { id: Sport }).id;
    this.setData({
      sport: id,
      sports: this.data.sports.map((item) => ({ ...item, selected: item.id === id })),
    });
  },

  onImpact(event: WechatMiniprogram.TouchEvent) {
    const id = (event.currentTarget.dataset as { id: ImpactKind }).id;
    const serious = id === 'stopped_activity' || id === 'prefer_not_to_say';
    const tone: Tone = serious ? 'supportive' : 'humorous';
    this.setData({
      impactKind: id,
      impactLabel: IMPACT_LABEL[id],
      impacts: this.data.impacts.map((item) => ({ ...item, selected: item.id === id })),
      tone,
      toneLabel: TONE_LABEL[tone],
      tones: this.data.tones.map((item) => ({ ...item, selected: item.id === tone })),
      allowFunnyActions: serious ? false : this.data.allowFunnyActions,
    });
  },

  onTone(event: WechatMiniprogram.TouchEvent) {
    const id = (event.currentTarget.dataset as { id: Tone }).id;
    this.setData({
      tone: id,
      toneLabel: TONE_LABEL[id],
      tones: this.data.tones.map((item) => ({ ...item, selected: item.id === id })),
    });
  },

  onMulti(event: WechatMiniprogram.TouchEvent) {
    const dataset = event.currentTarget.dataset as { kind: 'scenario' | 'cause' | 'bodyParts' | 'protections'; id: string };
    if (dataset.kind === 'scenario') {
      const result = toggle(this.data.scenario, dataset.id as Scenario, 3);
      if (result.limited) return this.tooMany('发生背景最多选 3 个');
      this.setData({ scenario: result.list, scenarios: markSelected(this.data.scenarios, result.list) });
    } else if (dataset.kind === 'cause') {
      const result = toggle(this.data.cause, dataset.id as Cause, 3);
      if (result.limited) return this.tooMany('原因最多选 3 个');
      this.setData({ cause: result.list, causes: markSelected(this.data.causes, result.list) });
    } else if (dataset.kind === 'bodyParts') {
      const result = toggle(this.data.bodyParts, dataset.id as BodyPart, 3);
      if (result.limited) return this.tooMany('身体部位最多选 3 个');
      const first = result.list[0];
      this.setData({
        bodyParts: result.list,
        parts: markSelected(this.data.parts, result.list),
        selectedPartLabels: result.list.map((part) => BODY_PART_LABEL[part]),
        presets: first ? (PRESETS[first] ?? FALLBACK_PRESETS) : FALLBACK_PRESETS,
      });
    } else {
      const result = toggle(this.data.protectiveItems, dataset.id as ProtectiveItem, 7);
      if (result.limited) return this.tooMany('护具最多选 7 个');
      this.setData({ protectiveItems: result.list, protections: markSelected(this.data.protections, result.list) });
    }
    this.refreshSubmitState();
  },

  tooMany(message: string) {
    wx.showToast({ title: message, icon: 'none' });
  },

  onTitleInput(event: WechatMiniprogram.Input) {
    const title = event.detail.value;
    this.setData({ title, titleLen: title.length });
    this.refreshSubmitState();
  },

  onBodyInput(event: WechatMiniprogram.Input) {
    const body = event.detail.value;
    this.setData({ body, bodyLen: body.length, sensitive: sensitiveWarning(body) });
    this.refreshSubmitState();
  },

  onPreset(event: WechatMiniprogram.TouchEvent) {
    const title = (event.currentTarget.dataset as { title: string }).title;
    this.setData({ title, titleLen: title.length });
    this.refreshSubmitState();
  },

  onToggleGroup(event: WechatMiniprogram.TouchEvent) {
    if (this.data.selfOnly) return;
    const id = (event.currentTarget.dataset as { id: string }).id;
    const groupChips = this.data.groupChips.map((group) => (group.id === id ? { ...group, checked: !group.checked } : group));
    this.setData({ groupChips });
    this.refreshSubmitState();
  },

  onSelfOnly(event: WechatMiniprogram.SwitchChange) {
    this.setData({ selfOnly: event.detail.value });
    this.refreshSubmitState();
  },

  onAnonymous(event: WechatMiniprogram.SwitchChange) {
    this.setData({ isAnonymous: event.detail.value });
  },

  onFunny(event: WechatMiniprogram.SwitchChange) {
    this.setData({ allowFunnyActions: event.detail.value });
  },

  onGifts(event: WechatMiniprogram.SwitchChange) {
    this.setData({ allowGifts: event.detail.value });
  },

  async onSubmit() {
    if (this.data.submitting) return;
    const { title, body, bodyParts, scenario, cause, groupChips } = this.data;
    if (!title.trim()) return wx.showToast({ title: '先起个标题吧', icon: 'none' });
    if (!body.trim()) return wx.showToast({ title: '写一句当时的经过', icon: 'none' });
    if (!bodyParts.length) return wx.showToast({ title: '选一下身体部位', icon: 'none' });
    if (!scenario.length) return wx.showToast({ title: '选一下发生背景', icon: 'none' });
    if (!cause.length) return wx.showToast({ title: '选一下原因，或选「原因未知」', icon: 'none' });
    const groupIds = this.data.selfOnly
      ? []
      : groupChips.filter((group) => group.checked).map((group) => group.id);
    if (!this.data.selfOnly && !groupIds.length) {
      return wx.showToast({ title: '至少选择一个可见圈子，或选择「仅自己可见」', icon: 'none' });
    }

    this.setData({ submitting: true });
    const res = await api.story.publish({
      requestId: requestId(),
      input: {
        incident: {
          sport: this.data.sport,
          scenario,
          selfReportedCause: cause,
          bodyParts,
          impactKind: this.data.impactKind,
          protectiveItems: this.data.protectiveItems,
          userSummary: body,
        },
        story: {
          title: title.trim(),
          body: body.trim(),
          tone: this.data.tone,
          visibility: this.data.selfOnly ? 'self' : 'groups',
          visibilityGroupIds: groupIds,
          allowFunnyActions: this.data.allowFunnyActions,
          allowGifts: this.data.allowGifts,
          isAnonymous: this.data.isAnonymous,
        },
      },
    });
    this.setData({ submitting: false });
    if (!res.ok) {
      wx.showToast({ title: res.message, icon: 'none' });
      return;
    }
    wx.showToast({ title: '发布成功', icon: 'success' });
    setTimeout(() => {
      wx.redirectTo({ url: `/pages/story/detail?storyId=${res.data.storyId}${groupIds[0] ? `&groupId=${groupIds[0]}` : ''}` });
    }, 500);
  },
});
