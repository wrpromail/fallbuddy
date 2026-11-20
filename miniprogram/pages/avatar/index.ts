import { api } from '../../services/api';
import { EXPRESSIONS, EXPRESSION_LABEL, PALETTE_COLOR, PALETTES } from '../../shared/enums';
import { ITEM_MAP } from '../../shared/items';
import type { Expression, Palette } from '../../shared/enums';
import type { AtlasStoryCard, AvatarState, EquippedGear, InventoryView } from '../../shared/types';

interface GearOption {
  id: string;
  name: string;
  selected: boolean;
}

interface AvatarPageData {
  loading: boolean;
  avatar: AvatarState | null;
  inventory: InventoryView[];
  myStories: AtlasStoryCard[];
  expressions: { id: Expression; label: string; emoji: string; selected: boolean }[];
  palettes: { id: Palette; color: string; selected: boolean }[];
  outfits: GearOption[];
  headgears: GearOption[];
  gogglesOn: boolean;
  hipOn: boolean;
  saving: boolean;
  weeklyClaimed: boolean;
  weeklyItems: InventoryView[];
  claiming: boolean;
  error: string;
}

const EXPRESSION_EMOJI: Record<Expression, string> = {
  happy: '😊',
  surprised: '😮',
  awkward: '😅',
  comfort: '🥺',
  cool: '😎',
};

const OUTFIT_ORDER = ['ski_blue', 'suit_orange', 'vest_mint'];
const HEADGEAR_ORDER = ['beanie_blue', 'helmet_red'];

let reqSeq = 0;
function requestId(): string {
  reqSeq += 1;
  return `req_avatar_${Date.now()}_${reqSeq}`;
}

function gearOptions(ids: string[], equipped: EquippedGear, slot: 'outfit' | 'headgear'): GearOption[] {
  return ids.map((id) => ({ id, name: ITEM_MAP[id]?.name ?? id, selected: equipped[slot] === id }));
}

Page({
  data: {
    loading: true,
    avatar: null,
    inventory: [],
    myStories: [],
    expressions: EXPRESSIONS.map((id) => ({ id, label: EXPRESSION_LABEL[id], emoji: EXPRESSION_EMOJI[id], selected: false })),
    palettes: PALETTES.map((id) => ({ id, color: PALETTE_COLOR[id], selected: false })),
    outfits: [],
    headgears: [],
    gogglesOn: false,
    hipOn: false,
    saving: false,
    weeklyClaimed: false,
    weeklyItems: [],
    claiming: false,
    error: '',
  } as AvatarPageData,

  onShow() {
    this.load();
  },

  async onPullDownRefresh() {
    await this.load();
    wx.stopPullDownRefresh();
  },

  async load() {
    this.setData({ loading: true, error: '' });
    const [avatarRes, invRes, storiesRes, weeklyRes] = await Promise.all([
      api.avatar.getMine(),
      api.inventory.getMine(),
      api.story.listMine(),
      api.inventory.getWeekly(),
    ]);
    if (!avatarRes.ok) {
      this.setData({ loading: false, error: avatarRes.message });
      return;
    }
    const avatar = avatarRes.data;
    const inventory = invRes.ok ? invRes.data : [];
    const owned = new Set(inventory.filter((item) => item.category === 'cosmetic').map((item) => item.itemDefId));
    const outfits = gearOptions(OUTFIT_ORDER.filter((id) => owned.has(id)), avatar.equipped, 'outfit');
    const headgears = [
      { id: '', name: '不戴', selected: !avatar.equipped.headgear },
      ...gearOptions(HEADGEAR_ORDER.filter((id) => owned.has(id)), avatar.equipped, 'headgear'),
    ];
    this.setData({
      loading: false,
      avatar,
      inventory: inventory.filter((item) => item.category !== 'cosmetic'),
      myStories: storiesRes.ok ? storiesRes.data : [],
      outfits,
      headgears,
      gogglesOn: !!avatar.equipped.goggles,
      hipOn: !!avatar.equipped.hip_protector,
      weeklyClaimed: weeklyRes.ok ? weeklyRes.data.claimed : false,
      weeklyItems: weeklyRes.ok ? weeklyRes.data.items : [],
      expressions: EXPRESSIONS.map((id) => ({ id, label: EXPRESSION_LABEL[id], emoji: EXPRESSION_EMOJI[id], selected: avatar.expression === id })),
      palettes: PALETTES.map((id) => ({ id, color: PALETTE_COLOR[id], selected: avatar.palette === id })),
    });
  },

  async apply(patch: { palette?: Palette; expression?: Expression; equipped?: EquippedGear }) {
    const avatar = this.data.avatar;
    if (!avatar || this.data.saving) return;
    const next = {
      palette: patch.palette ?? avatar.palette,
      expression: patch.expression ?? avatar.expression,
      equipped: patch.equipped ?? avatar.equipped,
    };
    this.setData({ saving: true });
    const res = await api.avatar.updateAppearance({ appearance: next, expectedVersion: avatar.version });
    if (!res.ok) {
      this.setData({ saving: false });
      wx.showToast({ title: res.message, icon: 'none' });
      if (res.code === 'CONFLICT') this.load();
      return;
    }
    const updated = res.data.avatar;
    this.setData({
      saving: false,
      avatar: updated,
      expressions: this.data.expressions.map((item) => ({ ...item, selected: item.id === updated.expression })),
      palettes: this.data.palettes.map((item) => ({ ...item, selected: item.id === updated.palette })),
      outfits: this.data.outfits.map((item) => ({ ...item, selected: updated.equipped.outfit === item.id })),
      headgears: this.data.headgears.map((item) => ({
        ...item,
        selected: item.id ? updated.equipped.headgear === item.id : !updated.equipped.headgear,
      })),
      gogglesOn: !!updated.equipped.goggles,
      hipOn: !!updated.equipped.hip_protector,
    });
  },

  onExpression(event: WechatMiniprogram.TouchEvent) {
    const id = (event.currentTarget.dataset as { id: Expression }).id;
    this.apply({ expression: id });
  },

  onPalette(event: WechatMiniprogram.TouchEvent) {
    const id = (event.currentTarget.dataset as { id: Palette }).id;
    this.apply({ palette: id });
  },

  onOutfit(event: WechatMiniprogram.TouchEvent) {
    const avatar = this.data.avatar;
    if (!avatar) return;
    const id = (event.currentTarget.dataset as { id: string }).id;
    this.apply({ equipped: { ...avatar.equipped, outfit: id } });
  },

  onHeadgear(event: WechatMiniprogram.TouchEvent) {
    const avatar = this.data.avatar;
    if (!avatar) return;
    const id = (event.currentTarget.dataset as { id: string }).id;
    this.apply({ equipped: { ...avatar.equipped, headgear: id || null } });
  },

  onGoggles() {
    const avatar = this.data.avatar;
    if (!avatar) return;
    this.apply({ equipped: { ...avatar.equipped, goggles: avatar.equipped.goggles ? null : 'snow_goggles' } });
  },

  onHip() {
    const avatar = this.data.avatar;
    if (!avatar) return;
    this.apply({ equipped: { ...avatar.equipped, hip_protector: avatar.equipped.hip_protector ? null : 'basic_hip_protector' } });
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
    if (res.data.alreadyGranted) {
      wx.showToast({ title: '本周补给已经领过啦', icon: 'none' });
    } else {
      wx.showToast({ title: '本周补给已到账', icon: 'success' });
    }
    this.load();
  },

  onSelectStory(event: WechatMiniprogram.CustomEvent<{ storyId: string }>) {
    wx.navigateTo({ url: `/pages/story/detail?storyId=${event.detail.storyId}` });
  },

  onCreate() {
    wx.navigateTo({ url: '/pages/incident/create' });
  },

  onSettings() {
    wx.navigateTo({ url: '/pages/settings/index' });
  },
});
