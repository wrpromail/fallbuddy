import { api } from '../../services/api';
import type { GroupMemberView, GroupSummary } from '../../shared/types';

interface GroupPageData {
  loading: boolean;
  error: string;
  group: GroupSummary | null;
  members: GroupMemberView[];
  isOwner: boolean;
  canInvite: boolean;
  invite: { token: string; sharePath: string; expiresAt: string } | null;
  inviteLoading: boolean;
  joining: boolean;
}

function roleLabel(role: string): string {
  if (role === 'owner') return '圈主';
  if (role === 'admin') return '管理员';
  return '成员';
}

Page({
  data: {
    loading: true,
    error: '',
    group: null,
    members: [],
    isOwner: false,
    canInvite: false,
    invite: null,
    inviteLoading: false,
    joining: false,
  } as GroupPageData,

  pendingGroupId: '',
  pendingToken: '',

  onLoad(query: Record<string, string | undefined>) {
    this.pendingGroupId = query.groupId ?? '';
    this.pendingToken = query.inviteToken ?? '';
    this.bootstrap();
  },

  async onPullDownRefresh() {
    await this.load();
    wx.stopPullDownRefresh();
  },

  async bootstrap() {
    if (this.pendingToken) {
      this.setData({ joining: true });
      const res = await api.group.join({ inviteToken: this.pendingToken });
      this.setData({ joining: false });
      if (res.ok) {
        this.pendingGroupId = res.data.groupId;
        wx.showToast({ title: res.data.status === 'already_member' ? '你已经在圈子里了' : '加入成功', icon: 'none' });
      } else {
        wx.showToast({ title: res.message, icon: 'none' });
      }
      this.pendingToken = '';
    }
    await this.load();
  },

  async load() {
    this.setData({ loading: true, error: '' });
    const groupsRes = await api.group.listMine();
    if (!groupsRes.ok) {
      this.setData({ loading: false, error: groupsRes.message });
      return;
    }
    const groups = groupsRes.data;
    const group = groups.find((item) => item.id === this.pendingGroupId) ?? groups[0] ?? null;
    if (!group) {
      this.setData({ loading: false, error: '你还没有加入任何圈子' });
      return;
    }
    const membersRes = await api.group.getMembers(group.id);
    const members = membersRes.ok
      ? membersRes.data.map((member) => ({ ...member, roleLabel: roleLabel(member.role) }))
      : [];
    this.setData({
      loading: false,
      group,
      members: members as GroupMemberView[],
      isOwner: group.role === 'owner',
      canInvite: group.role === 'owner' || group.role === 'admin',
    });
    wx.setNavigationBarTitle({ title: group.name });
  },

  async onCreateInvite() {
    const group = this.data.group;
    if (!group || this.data.inviteLoading) return;
    this.setData({ inviteLoading: true });
    const res = await api.group.createInvite({ groupId: group.id, ttlHours: 48 });
    this.setData({ inviteLoading: false });
    if (!res.ok) {
      wx.showToast({ title: res.message, icon: 'none' });
      return;
    }
    this.setData({ invite: { token: res.data.token, sharePath: res.data.sharePath, expiresAt: res.data.expiresAt } });
  },

  onCopyInvite() {
    const invite = this.data.invite;
    if (!invite) return;
    wx.setClipboardData({
      data: invite.sharePath,
      success: () => wx.showToast({ title: '邀请路径已复制', icon: 'none' }),
    });
  },

  onLeave() {
    const group = this.data.group;
    if (!group) return;
    wx.showModal({
      title: `退出「${group.name}」？`,
      content: '退出后你会立刻失去这个圈子的故事与图鉴访问权限。你发布过的故事仍会保留给其他成员。',
      confirmText: '退出',
      confirmColor: '#D93A3A',
      success: async (result) => {
        if (!result.confirm) return;
        const res = await api.group.leave({ groupId: group.id });
        if (!res.ok) {
          wx.showToast({ title: res.message, icon: 'none' });
          return;
        }
        wx.showToast({ title: '已退出圈子', icon: 'none' });
        this.pendingGroupId = '';
        this.setData({ invite: null });
        this.load();
      },
    });
  },

  onShareAppMessage() {
    const group = this.data.group;
    const invite = this.data.invite;
    return {
      title: group ? `来「${group.name}」看看大家的战损图鉴` : '摔友记',
      path: invite ? invite.sharePath : group ? `/pages/group/index?groupId=${group.id}` : '/pages/atlas/index',
    };
  },
});
