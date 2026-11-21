import { api } from '../../services/api';
import { ACTIONS } from '../../shared/actions';
import {
  CARRY_HANDS, EQUIP_SLOTS, EQUIP_SLOT_LABEL, EXPRESSIONS, EXPRESSION_LABEL, HEAD_SHAPES, PALETTE_COLOR, PALETTES,
  type CarryHand, type EquipSlot, type Expression, type HeadShape, type Palette,
} from '../../shared/enums';
import { ITEM_DEFINITIONS, ITEM_MAP, SNOWBOARD_ID } from '../../shared/items';
import type { RigAppearance } from '../../shared/rig-types';
import type { AtlasStoryCard, AvatarState, InventoryView } from '../../shared/types';

const SHAPE_LABEL: Record<HeadShape, string> = { round: '圆头', soft_square: '方圆头' };
const PALETTE_LABEL: Record<Palette, string> = { blue: '冰蓝', orange: '杏橙', purple: '雾紫', mint: '薄荷' };

type WardrobeOption = {
  id: string;
  name: string;
  src: string;
  owned: boolean;
  desc: string;
};

const WARDROBE = Object.fromEntries(EQUIP_SLOTS.map((slot) => [
  slot, ITEM_DEFINITIONS.filter((item) => item.slot === slot).map((item) => ({
    id: item.id, name: item.name, src: `/assets/${item.assetKey}.png`, desc: item.description,
  })),
]));

interface AvatarPageData {
  loading: boolean;
  avatar: AvatarState | null;
  draft: RigAppearance | null;
  preview: RigAppearance | null;
  view: 'front' | 'back';
  mode: 'full' | 'chip';
  slot: EquipSlot;
  selectedItem: string | null;
  selectedOwned: boolean;
  snowboardSelected: boolean;
  wardrobe: WardrobeOption[];
  ownedIds: string[];
  headShapes: { id: HeadShape; label: string }[];
  expressions: { id: Expression; label: string }[];
  palettes: { id: Palette; color: string; label: string }[];
  slots: { id: EquipSlot; label: string }[];
  actions: { id: string; label: string }[];
  reduceMotion: boolean;
  saving: boolean;
  claimingItem: boolean;
  notice: string;
  error: string;
  outfits: { slot: number; version: number; appearance: RigAppearance | null }[];
  pollBadge: boolean;
  inventory: InventoryView[];
  myStories: AtlasStoryCard[];
  hasDraft: boolean;
  weeklyClaimed: boolean;
  claiming: boolean;
}

let reqSeq = 0;
const requestId = () => `req_avatar_${Date.now()}_${++reqSeq}`;

Page({
  data: {
    loading: true,
    avatar: null,
    draft: null,
    preview: null,
    view: 'front',
    mode: 'full',
    slot: 'headgear',
    selectedItem: null,
    selectedOwned: false,
    snowboardSelected: false,
    wardrobe: [],
    ownedIds: [],
    headShapes: HEAD_SHAPES.map((id) => ({ id, label: SHAPE_LABEL[id] })),
    expressions: EXPRESSIONS.map((id) => ({ id, label: EXPRESSION_LABEL[id] })),
    palettes: PALETTES.map((id) => ({ id, color: PALETTE_COLOR[id], label: PALETTE_LABEL[id] })),
    slots: EQUIP_SLOTS.map((id) => ({ id, label: EQUIP_SLOT_LABEL[id] })),
    actions: ACTIONS.map(({ id, name }) => ({ id, label: name })),
    reduceMotion: false,
    saving: false,
    claimingItem: false,
    notice: '',
    error: '',
    inventory: [],
    outfits: [],
    pollBadge: false,
    myStories: [],
    hasDraft: false,
    weeklyClaimed: false,
    claiming: false,
  } as AvatarPageData,

  onShow() {
    void this.load();
  },

  async onPullDownRefresh() {
    await this.load();
    wx.stopPullDownRefresh();
  },

  async load() {
    if (this.data.saving) return;
    this.setData({ loading: true, error: '' });
    const [avatarRes, invRes, storiesRes, draftRes, weeklyRes, settingsRes, outfitsRes, badgeRes] = await Promise.all([
      api.avatar.getMine(), api.inventory.getMine(), api.story.listMine(), api.story.getDraft(),
      api.inventory.getWeekly(), api.settings.get(), api.avatar.listOutfits(), api.poll.myBadge(),
    ]);
    if (!avatarRes.ok || !invRes.ok) {
      this.setData({ loading: false, error: !avatarRes.ok ? avatarRes.message : '暂时无法读取衣橱，请重试' });
      return;
    }
    const avatar = avatarRes.data;
    this.setData({
      loading: false,
      avatar: this.data.draft ? this.data.avatar : avatar,
      preview: this.data.draft ?? avatar,
      ownedIds: invRes.data.filter((item) => ITEM_MAP[item.itemDefId]?.slot).map((item) => item.itemDefId),
      inventory: invRes.data.filter((item) => item.category !== 'cosmetic'),
      myStories: storiesRes.ok ? storiesRes.data : [],
      outfits: outfitsRes.ok ? outfitsRes.data : [],
      pollBadge: badgeRes.ok && badgeRes.data.earned,
      hasDraft: draftRes.ok && !!draftRes.data,
      weeklyClaimed: weeklyRes.ok && weeklyRes.data.claimed,
      reduceMotion: settingsRes.ok && settingsRes.data.reduceMotion,
    });
    this.refreshWardrobe();
  },

  refreshWardrobe() {
    const slot = this.data.slot;
    const owned = new Set(this.data.ownedIds);
    const selectedItem = this.data.draft?.equipped[slot] ?? null;
    const wardrobe = (WARDROBE[slot] ?? []).filter((item) =>
      ITEM_MAP[item.id]?.category === 'cosmetic' || owned.has(item.id)).map((item) => ({ ...item, owned: owned.has(item.id) }));
    this.setData({ wardrobe, selectedItem, selectedOwned: !!selectedItem && owned.has(selectedItem),
      snowboardSelected: selectedItem === SNOWBOARD_ID });
  },

  onEdit() {
    const avatar = this.data.avatar;
    if (!avatar || this.data.loading || this.data.error) return;
    this.setDraft({
      headShape: avatar.headShape ?? 'round',
      palette: avatar.palette,
      expression: avatar.expression,
      equipped: { ...avatar.equipped },
      carryHand: avatar.carryHand ?? 'right',
    });
  },

  onTryOutfit(event: WechatMiniprogram.TouchEvent) {
    const row = this.data.outfits.find((item) => item.slot === Number(event.currentTarget.dataset.slot));
    if (row?.appearance && !this.data.saving) this.setDraft({ ...row.appearance, equipped: { ...row.appearance.equipped } });
  },

  async onStoreOutfit(event: WechatMiniprogram.TouchEvent) {
    const { slot, clear } = event.currentTarget.dataset;
    const row = this.data.outfits.find((item) => item.slot === Number(slot));
    if (!row || !this.data.avatar || this.data.draft || this.data.saving) return;
    this.setData({ saving: true });
    try {
      const res = await api.avatar.saveOutfit({ slot: row.slot, slotVersion: row.version,
        clear: clear === 'yes', avatarVersion: this.data.avatar.version });
      this.setData({ notice: res.ok ? (clear === 'yes' ? '已移除收藏' : '已收藏当前形象') : res.message });
    } finally {
      this.setData({ saving: false });
      await this.load();
    }
  },

  onRandomOutfit() {
    const draft = this.data.draft;
    if (!draft || this.data.saving) return;
    const pick = <T>(items: readonly T[]): T => items[Math.floor(Math.random() * items.length)];
    const equipped = { ...draft.equipped };
    for (const slot of EQUIP_SLOTS) {
      const choices = this.data.ownedIds.filter((id) => ITEM_MAP[id]?.slot === slot);
      equipped[slot] = pick([null, ...choices]);
    }
    this.setDraft({ headShape: pick(HEAD_SHAPES), expression: pick(EXPRESSIONS), palette: pick(PALETTES),
      equipped, carryHand: pick(CARRY_HANDS) });
  },

  onCancel() {
    if (this.data.saving || this.data.claimingItem) return;
    this.setData({ draft: null, preview: this.data.avatar, notice: '' });
  },

  setDraft(draft: RigAppearance) {
    this.setData({ draft, preview: draft, notice: '' });
    this.refreshWardrobe();
  },

  onShape(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id as HeadShape;
    if (this.data.draft && !this.data.saving && HEAD_SHAPES.includes(id)) this.setDraft({ ...this.data.draft, headShape: id });
  },

  onExpression(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id as Expression;
    if (this.data.draft && !this.data.saving && EXPRESSIONS.includes(id)) this.setDraft({ ...this.data.draft, expression: id });
  },

  onPalette(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id as Palette;
    if (this.data.draft && !this.data.saving && PALETTES.includes(id)) this.setDraft({ ...this.data.draft, palette: id });
  },

  onSlot(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id as EquipSlot;
    if (!EQUIP_SLOTS.includes(id)) return;
    this.setData({ slot: id });
    this.refreshWardrobe();
  },

  onTryGear(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id as string | undefined;
    const { draft, slot, saving } = this.data;
    if (!draft || saving || (id && ITEM_MAP[id]?.slot !== slot)) return;
    if (slot === 'gloves' || slot === 'knee_pads' || slot === 'handheld') this.setData({ mode: 'full' });
    this.setDraft({ ...draft, equipped: { ...draft.equipped, [slot]: id || null } });
  },

  onCarryHand(event: WechatMiniprogram.TouchEvent) {
    const hand = event.currentTarget.dataset.id as CarryHand;
    const { draft, saving } = this.data;
    if (saving || draft?.equipped.handheld !== SNOWBOARD_ID || !CARRY_HANDS.includes(hand)) return;
    this.setData({ mode: 'full' });
    this.setDraft({ ...draft, carryHand: hand });
  },

  async onClaimGear(event: WechatMiniprogram.TouchEvent) {
    const itemDefId = event.currentTarget.dataset.id as string;
    if (this.data.claimingItem || this.data.saving) return;
    this.setData({ claimingItem: true });
    try {
      const res = await api.inventory.claimCosmetic({ itemDefId });
      if (!res.ok) {
        this.setData({ notice: res.message });
        return;
      }
      this.setData({ notice: `已领取${res.data.name}`, ownedIds: [...new Set([...this.data.ownedIds, itemDefId])] });
      this.refreshWardrobe();
    } catch {
      this.setData({ notice: '领取失败，请重试' });
    } finally {
      this.setData({ claimingItem: false });
    }
  },

  onPreview(event: WechatMiniprogram.TouchEvent) {
    const id = event.currentTarget.dataset.id;
    if (id === 'chip') this.setData({ view: 'front', mode: 'chip' });
    else this.setData({ view: id === 'back' ? 'back' : 'front', mode: 'full' });
  },

  onPreviewAction(event: WechatMiniprogram.TouchEvent) {
    this.selectComponent('#avatar-preview')?.play(event.currentTarget.dataset.id);
  },

  async onSave() {
    const { avatar, draft, saving, claimingItem } = this.data;
    if (!avatar || !draft || saving || claimingItem || this.data.loading) return;
    const owned = new Set(this.data.ownedIds);
    const unowned = EQUIP_SLOTS.map((slot) => draft.equipped[slot]).filter((id): id is string => !!id && !owned.has(id));
    if (unowned.length) {
      this.setData({ notice: `请先领取${unowned.map((id) => ITEM_MAP[id]?.name ?? id).join('、')}` });
      return;
    }
    this.setData({ saving: true, notice: '' });
    try {
      const res = await api.avatar.updateAppearance({ appearance: draft, expectedVersion: avatar.version });
      if (!res.ok) {
        if (res.code === 'CONFLICT') {
          const latest = await api.avatar.getMine();
          if (latest.ok) {
            this.setData({ avatar: latest.data, notice: '另一台设备已修改角色。当前试穿已保留，再次保存会应用这套搭配。' });
            return;
          }
        }
        this.setData({ notice: res.message });
        return;
      }
      this.setData({ avatar: res.data.avatar, preview: res.data.avatar, draft: null, notice: '已保存角色' });
    } catch {
      this.setData({ notice: '保存失败，当前搭配已保留，请重试' });
    } finally {
      this.setData({ saving: false });
    }
  },

  onConsume(event: WechatMiniprogram.TouchEvent) {
    const item = this.data.inventory.find((row) => row.itemDefId === event.currentTarget.dataset.id);
    if (!item || item.category !== 'consumable') return;
    wx.showModal({ title: '使用一件' + item.name + '？', content: '确认后将从你的背包扣除一件。', confirmText: '使用',
      success: async ({ confirm }) => {
        if (!confirm) return;
        const res = await api.inventory.consume({ itemDefId: item.itemDefId, version: item.version, requestId: requestId() });
        wx.showToast({ title: res.ok ? '已使用' : res.message, icon: 'none' });
        await this.load();
      },
    });
  },

  async onClaimWeekly() {
    if (this.data.claiming) return;
    this.setData({ claiming: true });
    const res = await api.inventory.claimWeekly({ requestId: requestId() });
    this.setData({ claiming: false });
    if (!res.ok) {
      wx.showToast({ title: res.message, icon: 'none' });
      return;
    }
    wx.showToast({ title: res.data.alreadyGranted ? '本周补给已经领过啦' : '本周补给已到账', icon: 'success' });
    void this.load();
  },

  onNewStory() {
    wx.navigateTo({ url: '/pages/incident/create' });
  },

  onResumeDraft() {
    wx.navigateTo({ url: '/pages/incident/create?resume=1' });
  },

  onSelectStory(event: WechatMiniprogram.CustomEvent<{ storyId: string }>) {
    wx.navigateTo({ url: `/pages/story/detail?storyId=${event.detail.storyId}` });
  },

  onSettings() {
    wx.navigateTo({ url: '/pages/settings/index' });
  },
});
