import { api } from '../../services/api';
import { formatDate } from '../../shared/time';
import type { GroupMemberView, GroupSummary, PublicUser, StoryReport } from '../../shared/types';

interface GroupPageData {
  loading: boolean;
  error: string;
  group: GroupSummary | null;
  groups: GroupSummary[];
  creating: boolean;
  createSaving: boolean;
  groupName: string;
  requiresApproval: boolean;
  members: GroupMemberView[];
  isOwner: boolean;
  canInvite: boolean;
  invite: { id: string; sharePath: string } | null;
  invites: { id: string; expires: string; uses: number; maxUses: number }[];
  inviteLoading: boolean;
  joining: boolean;
  pendingApproval: boolean;
  joinRequests: PublicUser[];
  reports: (Pick<StoryReport, 'id' | 'storyId'> & { reasonLabel: string })[];
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
      groups: [],
      creating: false,
      createSaving: false,
      groupName: '',
      requiresApproval: true,
    members: [],
    isOwner: false,
    canInvite: false,
    invite: null,
      invites: [],
    inviteLoading: false,
    joining: false,
    pendingApproval: false,
    joinRequests: [],
    reports: [],
  } as GroupPageData,

  pendingGroupId: '',
  pendingToken: '',
  loadSequence: 0,
  createAttempt: null as { signature: string; requestId: string } | null,

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
        const pendingApproval = res.data.status === 'pending';
        this.setData({ pendingApproval });
        if (pendingApproval) {
          wx.showToast({ title: '申请已提交，等待圈主确认', icon: 'none' });
        } else {
          wx.showToast({ title: res.data.status === 'already_member' ? '你已经在圈子里了' : '加入成功', icon: 'none' });
        }
      } else {
        wx.showToast({ title: res.message, icon: 'none' });
      }
      this.pendingToken = '';
    }
    await this.load();
  },

  async load() {
    const sequence = ++this.loadSequence;
    this.setData({ loading: true, error: '' });
    const groupsRes = await api.group.listMine();
    if (sequence !== this.loadSequence) return;
    if (!groupsRes.ok) {
      this.setData({ loading: false, error: groupsRes.message });
      return;
    }
    const groups = groupsRes.data;
    const selected = groups.find((item) => item.id === this.pendingGroupId);
    const group = selected ?? (this.data.pendingApproval ? null : groups[0]) ?? null;
    if (!group) {
      this.setData({ groups, group: null, canInvite: false, invite: null, invites: [], loading: false,
        error: this.data.pendingApproval ? '等待圈主批准，下拉刷新查看结果' : '你还没有加入任何圈子' });
      return;
    }
    const canInvite = group.role === 'owner' || group.role === 'admin';
    const [membersRes, requestsRes, reportsRes, invitesRes] = await Promise.all([
      api.group.getMembers(group.id),
      canInvite ? api.group.getJoinRequests(group.id) : null,
      canInvite ? api.moderation.listReports(group.id) : null,
      canInvite ? api.group.listInvites(group.id) : null,
    ]);
    if (sequence !== this.loadSequence) return;
    const members = membersRes.ok
      ? membersRes.data.map((member) => ({ ...member, roleLabel: roleLabel(member.role) }))
      : [];
    this.setData({
      loading: false,
      groups,
      group,
      pendingApproval: false,
      members: members as GroupMemberView[],
      isOwner: group.role === 'owner',
      canInvite,
      invite: this.data.group?.id === group.id && canInvite ? this.data.invite : null,
      invites: invitesRes?.ok ? invitesRes.data.map((item) => ({ ...item, expires: formatDate(item.expiresAt) })) : [],
      joinRequests: requestsRes?.ok ? requestsRes.data : [],
      reports: reportsRes?.ok ? reportsRes.data.map((report) => ({
        ...report,
        reasonLabel: { privacy: '泄露个人信息', abuse: '骚扰或攻击', other: '其他' }[report.reason],
      })) : [],
    });
    wx.setNavigationBarTitle({ title: group.name });
  },

  onChooseGroup(event: WechatMiniprogram.PickerChange) {
    const group = this.data.groups[Number(event.detail.value)];
    if (!group) return;
    this.pendingGroupId = group.id;
    this.setData({ pendingApproval: false });
    void this.load();
  },

  onToggleCreate() {
    if (!this.data.createSaving) this.setData({ creating: !this.data.creating });
  },

  onGroupName(event: WechatMiniprogram.Input) {
    this.setData({ groupName: event.detail.value });
  },

  onJoinMode(event: WechatMiniprogram.SwitchChange) {
    this.setData({ requiresApproval: event.detail.value });
  },

  async onCreateGroup() {
    const name = this.data.groupName.trim();
    if (this.data.createSaving || !name) return;
    const joinMode = this.data.requiresApproval ? 'approval' : 'open';
    const signature = JSON.stringify({ name, joinMode });
    if (this.createAttempt?.signature !== signature) {
      this.createAttempt = { signature, requestId: `group_${Date.now()}_${Math.random().toString(36).slice(2)}` };
    }
    this.setData({ createSaving: true });
    const res = await api.group.create({ name, joinMode, requestId: this.createAttempt.requestId });
    this.setData({ createSaving: false });
    if (!res.ok) {
      wx.showToast({ title: res.message, icon: 'none' });
      return;
    }
    this.createAttempt = null;
    this.pendingGroupId = res.data.id;
    this.setData({ creating: false, groupName: '', pendingApproval: false });
    await this.load();
  },

  async onReviewMember(event: WechatMiniprogram.TouchEvent) {
    const { group, canInvite } = this.data;
    if (!group || !canInvite) return;
    const { id, action } = event.currentTarget.dataset;
    const result = await api.group.reviewMember({ groupId: group.id, userId: id, approve: action === 'approve' });
    if (!result.ok) wx.showToast({ title: result.message, icon: 'none' });
    await this.load();
  },

  onOpenReportedStory(event: WechatMiniprogram.TouchEvent) {
    const group = this.data.group;
    const { id } = event.currentTarget.dataset;
    if (!group) return;
    wx.navigateTo({ url: `/pages/story/detail?storyId=${id}&groupId=${group.id}` });
  },

  onResolveReport(event: WechatMiniprogram.TouchEvent) {
    const { group, canInvite } = this.data;
    const { id, action } = event.currentTarget.dataset;
    if (!group || !canInvite || (action !== 'hide' && action !== 'dismiss')) return;
    wx.showModal({
      title: action === 'hide' ? '隐藏这条故事？' : '关闭这条举报？',
      success: async ({ confirm }) => {
        if (!confirm) return;
        const result = await api.moderation.resolveReport({ groupId: group.id, reportId: id, decision: action });
        if (!result.ok) wx.showToast({ title: result.message, icon: 'none' });
        await this.load();
      },
    });
  },

  async onCreateInvite() {
    const group = this.data.group;
    if (!group || !this.data.canInvite || this.data.inviteLoading) return;
    this.setData({ inviteLoading: true });
    const res = await api.group.createInvite({ groupId: group.id, ttlHours: 48 });
    this.setData({ inviteLoading: false });
    if (!res.ok) {
      wx.showToast({ title: res.message, icon: 'none' });
      return;
    }
    if (this.data.group?.id !== group.id) return;
    this.setData({ invite: { id: res.data.id, sharePath: res.data.sharePath } });
    await this.load();
  },

  onRevokeInvite(event: WechatMiniprogram.TouchEvent) {
    const { group, canInvite } = this.data;
    const id = String(event.currentTarget.dataset.id);
    if (!group || !canInvite) return;
    wx.showModal({
      title: '撤销这条邀请？',
      content: '旧链接将失效。已提交的申请仍可审批。',
      success: async ({ confirm }) => {
        if (!confirm) return;
        const res = await api.group.revokeInvite({ groupId: group.id, inviteId: id });
        if (!res.ok) wx.showToast({ title: res.message, icon: 'none' });
        if (res.ok && this.data.invite?.id === id) this.setData({ invite: null });
        await this.load();
      },
    });
  },

  onTransfer(event: WechatMiniprogram.TouchEvent) {
    const { group, isOwner } = this.data;
    const member = this.data.members.find((item) => item.userId === event.currentTarget.dataset.id && !item.isMe);
    if (!group || !isOwner || !member) return;
    wx.showModal({
      title: '转让圈主？',
      content: `${member.displayName} 将成为圈主，你将成为管理员。`,
      confirmText: '转让',
      success: async ({ confirm }) => {
        if (!confirm) return;
        const res = await api.group.transferOwner({ groupId: group.id, userId: member.userId });
        if (!res.ok) wx.showToast({ title: res.message, icon: 'none' });
        await this.load();
      },
    });
  },

  async onPauseInteractions(event: WechatMiniprogram.SwitchChange) {
    const { group, canInvite } = this.data;
    if (!group || !canInvite) return;
    const res = await api.group.setInteractionsPaused({ groupId: group.id, paused: event.detail.value });
    if (!res.ok) wx.showToast({ title: res.message, icon: 'none' });
    await this.load();
  },

  onCopyInvite() {
    const invite = this.data.invite;
    if (!invite) return;
    wx.setClipboardData({
      data: invite.sharePath,
      success: () => wx.showToast({ title: '邀请路径已复制', icon: 'none' }),
    });
  },

  onLeave(event: WechatMiniprogram.TouchEvent) {
    const group = this.data.group;
    if (!group) return;
    const retainStories = event.currentTarget.dataset.retain === 'yes';
    wx.showModal({
      title: `退出「${group.name}」？`,
      content: retainStories ? '以前发到这个圈子的故事仍对其他成员可见。' :
        '移除此圈子的故事访问权限。若故事也发到了其他圈子，其他圈子的访问权限会保留。',
      confirmText: '退出',
      confirmColor: '#D93A3A',
      success: async (result) => {
        if (!result.confirm) return;
        const res = await api.group.leave({ groupId: group.id, retainStories });
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
