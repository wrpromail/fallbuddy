export const AWARDS = {
  safe_landing: '本周最离谱但平安的摔法',
  gear_save: '最佳护具救场',
  funniest: '最有梗运动故事',
} as const;
export type Award = keyof typeof AWARDS;
export type Choice = { id: string; title: string };

export interface StoryLink {
  id: string;
  groupId: string;
  source: string;
  target: string;
  status: 'pending' | 'accepted' | 'revoked';
}

export interface Nomination {
  groupId: string;
  period: string;
  award: Award;
  storyId: string;
  status: 'pending' | 'accepted' | 'withdrawn';
}

export interface Vote {
  groupId: string;
  period: string;
  award: Award;
  userId: string;
  storyId: string;
}
