import { api } from '../../services/api';
import type { GroupMemberView, GroupSummary, PublicUser, StoryReport } from '../../shared/types';

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
    members: [],
    isOwner: false,
    canInvite: false,
    invite: null,
    inviteLoading: false,
    joining: false,
    pendingApproval: false,
    joinRequests: [],
    reports: [],
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
    this.setData({ loading: true, error: '' });
    const groupsRes = await api.group.listMine();
    if (!groupsRes.ok) {
      this.setData({ loading: false, error: groupsRes.message });
      return;
    }
    const groups = groupsRes.data;
    const group = groups.find((item) => item.id === this.pendingGroupId) ?? groups[0] ?? null;
    if (!group) {
      this.setData({ loading: false, error: this.data.pendingApproval ? '等待圈主批准，下拉刷新查看结果' : '你还没有加入任何圈子' });
      return;
    }
    const canInvite = group.role === 'owner' || group.role === 'admin';
    const [membersRes, requestsRes, reportsRes] = await Promise.all([
      api.group.getMembers(group.id),
      canInvite ? api.group.getJoinRequests(group.id) : null,
      canInvite ? api.moderation.listReports(group.id) : null,
    ]);
    const members = membersRes.ok
      ? membersRes.data.map((member) => ({ ...member, roleLabel: roleLabel(member.role) }))
      : [];
    this.setData({
      loading: false,
      group,
      members: members as GroupMemberView[],
      isOwner: group.role === 'owner',
      canInvite,
      joinRequests: requestsRes?.ok ? requestsRes.data : [],
      reports: reportsRes?.ok ? reportsRes.data.map((report) => ({
        ...report,
        reasonLabel: { privacy: '泄露个人信息', abuse: '骚扰或攻击', other: '其他' }[report.reason],
      })) : [],
    });
    wx.setNavigationBarTitle({ title: group.name });
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
