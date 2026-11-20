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
import { ANONYMOUS_APPEARANCE } from '../../shared/avatar';
import type { AvatarState, CreateStoryInput, GroupSummary, StoryDraft, UserPreferences } from '../../shared/types';

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

type ConflictStatus = '' | 'loading' | 'ready' | 'missing' | 'retry' | 'unavailable';

interface CreatePageData {
  loading: boolean;
  loadError: string;
  editing: boolean;
  draftAvailable: boolean;
  savingDraft: boolean;
  conflictStatus: ConflictStatus;
  latestFields: { label: string; value: string }[];
  mustSaveNewDraft: boolean;
  happenedOn: string;
  userSummary: string;
  groups: GroupSummary[];
  groupChips: GroupChip[];
  myAvatar: AvatarState | null;
  avatarPalette: string;
  avatarHeadShape: string;
  avatarExpression: string;
  avatarEquipped: unknown;
  anonymousAppearance: typeof ANONYMOUS_APPEARANCE;
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
  return `req_incident_${Date.now().toString(36)}_${reqSeq}_${Math.random().toString(36).slice(2)}`;
}

function toggle<T>(list: T[], value: T, max: number): { list: T[]; limited: boolean } {
  if (list.includes(value)) return { list: list.filter((item) => item !== value), limited: false };
  if (list.length >= max) return { list, limited: true };
  return { list: [...list, value], limited: false };
}

Page({
  data: {
    loading: true,
    loadError: '',
    editing: false,
    draftAvailable: false,
    savingDraft: false,
    conflictStatus: '',
    latestFields: [],
    mustSaveNewDraft: false,
    happenedOn: '',
    userSummary: '',
    groups: [],
    groupChips: [],
    myAvatar: null,
    avatarPalette: 'blue',
    avatarHeadShape: 'round',
    avatarExpression: 'happy',
    avatarEquipped: null,
    anonymousAppearance: ANONYMOUS_APPEARANCE,
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
    parts: options(BODY_PARTS, BODY_PART_LABEL),
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

  storyId: '',
  version: 0,
  draft: null as StoryDraft | null,
  usingDraft: false,
  latest: null as StoryDraft | null,
  lastSubmission: null as { signature: string; id: string } | null,
  lastDraftSave: null as { signature: string; id: string } | null,

  onLoad(query: Record<string, string | undefined>) {
    this.storyId = query.storyId ?? '';
    this.setData({ editing: !!this.storyId });
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
    this.load(query.resume === '1');
  },

  async load(resume: boolean) {
    const [groupsRes, meRes, draftRes, detailRes] = await Promise.all([
      api.group.listMine(),
      api.auth.ensureUser(),
      this.storyId ? null : api.story.getDraft(),
      this.storyId ? api.story.getDetail({ storyId: this.storyId }) : null,
    ]);
    if (!groupsRes.ok || !meRes.ok || (draftRes && !draftRes.ok) || (detailRes && !detailRes.ok)) {
      this.setData({ loading: false, loadError: '无法加载记录，请返回后重试' });
      return;
    }
    if (detailRes?.ok && (!detailRes.data.viewerIsAuthor || detailRes.data.story.publishStatus !== 'published')) {
      this.setData({ loading: false, loadError: '这条记录当前不可编辑' });
      return;
    }
    const groups = groupsRes.data;
    const prefs: UserPreferences = meRes.data.preferences;
    const avatar = meRes.data.avatar;
    this.draft = draftRes?.ok ? draftRes.data : null;
    this.setData({
      groups,
      groupChips: groups.map((group) => ({ id: group.id, name: group.name, memberCount: group.memberCount, checked: false })),
      myAvatar: avatar,
      avatarPalette: avatar?.palette ?? 'blue',
      avatarHeadShape: avatar?.headShape ?? 'round',
      avatarExpression: avatar?.expression ?? 'happy',
      avatarEquipped: avatar?.equipped ?? null,
      isAnonymous: prefs.anonymousByDefault,
      allowGifts: prefs.allowGifts,
      draftAvailable: !!this.draft,
    });
    if (detailRes?.ok) {
      const { incident, story } = detailRes.data;
      this.version = story.version;
      this.applyInput({ incident, story });
    } else if (resume && this.draft) {
      this.usingDraft = true;
      this.applyInput(this.draft.input);
    }
    this.setData({ loading: false });
    this.refreshSubmitState();
  },

  applyInput({ incident, story }: CreateStoryInput) {
    const { sport, scenario, selfReportedCause, bodyParts, impactKind, protectiveItems } = incident;
    const { title, body, tone, visibilityGroupIds } = story;
    const userSummary = incident.userSummary ?? '';
    this.setData({
      sport,
      scenario,
      cause: selfReportedCause,
      bodyParts,
      impactKind,
      protectiveItems,
      tone,
      title,
      body,
      userSummary,
      happenedOn: incident.happenedOn ?? '',
      titleLen: title.length,
      bodyLen: body.length,
      sports: markSelected(this.data.sports, [sport]),
      scenarios: markSelected(this.data.scenarios, scenario),
      causes: markSelected(this.data.causes, selfReportedCause),
      parts: markSelected(this.data.parts, bodyParts),
      impacts: markSelected(this.data.impacts, [impactKind]),
      protections: markSelected(this.data.protections, protectiveItems),
      tones: markSelected(this.data.tones, [tone]),
      selectedPartLabels: bodyParts.map((part) => BODY_PART_LABEL[part]),
      presets: PRESETS[bodyParts[0]] ?? FALLBACK_PRESETS,
      impactLabel: IMPACT_LABEL[impactKind],
      toneLabel: TONE_LABEL[tone],
      sensitive: sensitiveWarning([title, body, userSummary].join(' ')),
      isAnonymous: story.isAnonymous,
      allowFunnyActions: story.allowFunnyActions,
      allowGifts: story.allowGifts,
      selfOnly: story.visibility === 'self',
      groupChips: this.data.groupChips.map((group) => ({
        ...group,
        checked: visibilityGroupIds.includes(group.id),
      })),
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
    this.setData({ canSubmit: canSubmit && !this.data.loading && !this.data.loadError &&
      !this.data.conflictStatus && !this.data.mustSaveNewDraft });
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
      this.toggleBodyPart(dataset.id as BodyPart);
    } else {
      const result = toggle(this.data.protectiveItems, dataset.id as ProtectiveItem, 7);
      if (result.limited) return this.tooMany('护具最多选 7 个');
      this.setData({ protectiveItems: result.list, protections: markSelected(this.data.protections, result.list) });
    }
    this.refreshSubmitState();
  },

  onSelectPart(event: WechatMiniprogram.CustomEvent<{ id: BodyPart }>) {
    this.toggleBodyPart(event.detail.id);
    this.refreshSubmitState();
  },

  toggleBodyPart(part: BodyPart) {
    if (!BODY_PARTS.includes(part)) return;
    const result = toggle(this.data.bodyParts, part, 3);
    if (result.limited) return this.tooMany('身体部位最多选 3 个');
    const first = result.list[0];
    this.setData({
      bodyParts: result.list,
      parts: markSelected(this.data.parts, result.list),
      selectedPartLabels: result.list.map((id) => BODY_PART_LABEL[id]),
      presets: first ? (PRESETS[first] ?? FALLBACK_PRESETS) : FALLBACK_PRESETS,
    });
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
    this.setData({ body, bodyLen: body.length, sensitive: sensitiveWarning([body, this.data.userSummary].join(' ')) });
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

  onHappenedOn(event: WechatMiniprogram.PickerChange) {
    this.setData({ happenedOn: String(event.detail.value) });
  },

  onClearDate() {
    this.setData({ happenedOn: '' });
  },

  onSummaryInput(event: WechatMiniprogram.Input) {
    const userSummary = event.detail.value;
    this.setData({ userSummary, sensitive: sensitiveWarning([this.data.body, userSummary].join(' ')) });
  },

  formInput(): CreateStoryInput {
    const data = this.data;
    return {
      incident: {
        sport: data.sport,
        scenario: data.scenario,
        selfReportedCause: data.cause,
        bodyParts: data.bodyParts,
        impactKind: data.impactKind,
        protectiveItems: data.protectiveItems,
        userSummary: data.userSummary.trim() || undefined,
        happenedOn: data.happenedOn || undefined,
      },
      story: {
        title: data.title.trim(),
        body: data.body.trim(),
        tone: data.tone,
        visibility: data.selfOnly ? 'self' : 'groups',
        visibilityGroupIds: data.selfOnly ? [] : data.groupChips.filter((group) => group.checked).map((group) => group.id),
        allowFunnyActions: data.allowFunnyActions,
        allowGifts: data.allowGifts,
        isAnonymous: data.isAnonymous,
      },
    };
  },

  onResumeDraft() {
    if (!this.draft || this.data.savingDraft || this.data.submitting || this.data.conflictStatus) return;
    const draft = this.draft;
    wx.showModal({
      title: '继续写私人草稿',
      content: '打开已保存的内容后，当前表单里尚未保存的修改会被替换。',
      confirmText: '打开草稿',
      success: ({ confirm }) => {
        if (!confirm) return;
        this.usingDraft = true;
        this.applyInput(draft.input);
      },
    });
  },

  onSaveDraft() {
    if (this.storyId || this.data.loading || this.data.loadError || this.data.submitting || this.data.savingDraft ||
      this.data.conflictStatus) return;
    if (!this.draft || this.usingDraft) {
      void this.saveDraft();
      return;
    }
    wx.showModal({
      title: '替换已保存的草稿？',
      content: '每个账号保留一份已保存的私人草稿。',
      confirmText: '替换',
      success: ({ confirm }) => {
        if (confirm) void this.saveDraft();
      },
    });
  },

  async saveDraft() {
    if (this.data.conflictStatus || this.data.savingDraft || this.data.submitting) return;
    const input = this.formInput();
    const version = this.draft?.version ?? 0;
    const signature = JSON.stringify({ input, version });
    if (this.lastDraftSave?.signature !== signature) this.lastDraftSave = { signature, id: requestId() };
    this.setData({ savingDraft: true });
    try {
      const res = await api.story.saveDraft({ input, version, requestId: this.lastDraftSave.id });
      if (!res.ok) {
        if (res.code === 'CONFLICT') await this.onRefreshLatest();
        else wx.showToast({ title: res.message, icon: 'none' });
        return;
      }
      this.draft = res.data;
      this.usingDraft = true;
      this.setData({ draftAvailable: true, mustSaveNewDraft: false });
      this.refreshSubmitState();
      wx.showToast({ title: '已保存私人草稿', icon: 'success' });
    } catch {
      wx.showToast({ title: '草稿保存失败，请重试', icon: 'none' });
    } finally {
      this.setData({ savingDraft: false });
    }
  },

  async onRefreshLatest() {
    if (this.data.conflictStatus === 'loading') return;
    this.latest = null;
    this.setData({ conflictStatus: 'loading', latestFields: [] }, () => {
      wx.pageScrollTo({ selector: '#version-conflict', duration: 200 });
    });
    this.refreshSubmitState();
    try {
      if (this.storyId) {
        const res = await api.story.getDetail({ storyId: this.storyId });
        if (!res.ok) {
          this.setData({ conflictStatus: res.code === 'UNAVAILABLE' ? 'retry' : 'unavailable' });
          return;
        }
        const { incident, story, viewerIsAuthor } = res.data;
        if (!viewerIsAuthor || story.publishStatus !== 'published' || story.moderationStatus === 'hidden') {
          this.setData({ conflictStatus: 'unavailable' });
          return;
        }
        this.latest = { input: { incident, story }, version: story.version, updatedAt: story.updatedAt };
      } else {
        const res = await api.story.getDraft();
        if (!res.ok) {
          this.setData({ conflictStatus: 'retry' });
          return;
        }
        this.latest = res.data;
      }
      if (this.latest) {
        this.setData({ conflictStatus: 'ready', latestFields: this.describeLatest(this.latest.input) });
      } else {
        this.setData({ conflictStatus: 'missing' });
      }
    } catch {
      this.setData({ conflictStatus: 'retry' });
    }
  },

  describeLatest({ incident, story }: CreateStoryInput) {
    const circles = story.visibilityGroupIds.map((id) =>
      this.data.groups.find((group) => group.id === id)?.name ?? '已退出的圈子');
    return [
      { label: '标题', value: story.title },
      { label: '故事正文', value: story.body },
      { label: '事故自述', value: incident.userSummary ?? '' },
      { label: '发生日期', value: incident.happenedOn ?? '' },
      { label: '运动', value: SPORT_LABEL[incident.sport] },
      { label: '发生背景', value: incident.scenario.map((id) => SCENARIO_LABEL[id]).join('、') },
      { label: '自述原因', value: incident.selfReportedCause.map((id) => CAUSE_LABEL[id]).join('、') },
      { label: '身体部位', value: incident.bodyParts.map((id) => BODY_PART_LABEL[id]).join('、') },
      { label: '当时情况', value: IMPACT_LABEL[incident.impactKind] },
      { label: '当时戴了', value: incident.protectiveItems.map((id) => PROTECTIVE_LABEL[id]).join('、') },
      { label: '可见范围', value: story.visibility === 'self' ? '仅自己可见' : circles.join('、') },
      { label: '匿名展示', value: story.isAnonymous ? '开启' : '关闭' },
      { label: '搞笑动作', value: story.allowFunnyActions ? '开启' : '关闭' },
      { label: '收礼物', value: story.allowGifts ? '开启' : '关闭' },
      { label: '语气', value: TONE_LABEL[story.tone] },
    ];
  },

  onUseLatest() {
    if (this.data.conflictStatus !== 'ready' || !this.latest) return;
    const latest = this.latest;
    wx.showModal({
      title: '使用已保存版本？',
      content: '本页尚未保存的内容将被替换。',
      confirmText: '使用此版',
      success: ({ confirm }) => {
        if (confirm && this.latest === latest) this.finishConflict(true);
      },
    });
  },

  onKeepEdits() {
    if (this.data.conflictStatus === 'ready' || this.data.conflictStatus === 'missing') this.finishConflict(false);
  },

  finishConflict(useLatest: boolean) {
    const latest = this.latest;
    if (this.storyId) {
      if (!latest) return;
      this.version = latest.version;
    } else {
      this.draft = latest;
      this.usingDraft = true;
    }
    this.latest = null;
    this.lastSubmission = null;
    this.lastDraftSave = null;
    this.setData({
      conflictStatus: '', latestFields: [], draftAvailable: !!this.draft,
      mustSaveNewDraft: !this.storyId && !latest,
    });
    if (useLatest && latest) this.applyInput(latest.input);
    else this.refreshSubmitState();
  },

  async onSubmit() {
    if (!this.data.canSubmit || this.data.submitting || this.data.savingDraft) return;
    const input = this.formInput();
    const draftVersion = this.usingDraft ? this.draft?.version ?? 0 : undefined;
    const signature = JSON.stringify({ input, version: this.version, draftVersion });
    if (this.lastSubmission?.signature !== signature) this.lastSubmission = { signature, id: requestId() };
    const id = this.lastSubmission.id;
    this.setData({ submitting: true });
    try {
      const res = this.storyId
        ? await api.story.update({ storyId: this.storyId, version: this.version, input, requestId: id })
        : await api.story.publish({
          input,
          requestId: id,
          draftVersion,
        });
      if (!res.ok) {
        if (res.code === 'CONFLICT') {
          await this.onRefreshLatest();
        } else {
          wx.showToast({ title: res.message, icon: 'none' });
        }
        return;
      }
      wx.showToast({ title: this.storyId ? '已保存修改' : '已记录', icon: 'success' });
      if (this.storyId) {
        wx.navigateBack({ fail: () => wx.redirectTo({ url: `/pages/story/detail?storyId=${this.storyId}` }) });
      } else {
        wx.redirectTo({ url: `/pages/story/detail?storyId=${res.data.storyId}` });
      }
    } catch {
      wx.showToast({ title: '暂时无法提交，请重试', icon: 'none' });
    } finally {
      this.setData({ submitting: false });
    }
  },
});
