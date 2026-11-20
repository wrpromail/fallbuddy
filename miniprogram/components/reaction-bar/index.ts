import { ACTIONS, MAX_INTERACTIONS_PER_DAY } from '../../shared/actions';
import type { ActionId, ReactionSummary } from '../../shared/types';

interface ReactionButton {
  id: ActionId;
  name: string;
  emoji: string;
  count: number;
  left: number;
  disabled: boolean;
}

Component({
  options: { addGlobalClass: true },
  properties: {
    reactions: { type: Array, value: [] },
    myReactions: { type: Array, value: [] },
    allowFunny: { type: Boolean, value: true },
    disabled: { type: Boolean, value: false },
  },
  data: {
    buttons: [] as ReactionButton[],
  },
  observers: {
    'reactions, myReactions, allowFunny, disabled': function () {
      this.build();
    },
  },
  lifetimes: {
    attached() {
      this.build();
    },
  },
  methods: {
    build() {
      const totals = new Map<string, number>();
      for (const item of (this.data.reactions as ReactionSummary[]) ?? []) totals.set(item.actionId, item.count);
      const mine = new Map<string, number>();
      for (const item of (this.data.myReactions as ReactionSummary[]) ?? []) mine.set(item.actionId, item.mine);
      const usedToday = [...mine.values()].reduce((sum, count) => sum + count, 0);
      const buttons: ReactionButton[] = ACTIONS.filter((action) => action.id !== 'receive_gift').map((action) => {
        const blocked = action.requiresFunnyConsent && !this.data.allowFunny;
        return {
          id: action.id,
          name: action.name,
          emoji: action.fallbackEmoji,
          count: totals.get(action.id) ?? 0,
          left: Math.max(0, MAX_INTERACTIONS_PER_DAY - usedToday),
          disabled: this.data.disabled || blocked || usedToday >= MAX_INTERACTIONS_PER_DAY,
        };
      });
      this.setData({ buttons });
    },
    onReact(event: WechatMiniprogram.TouchEvent) {
      const { id } = event.currentTarget.dataset as { id: ActionId };
      this.triggerEvent('react', { actionId: id });
    },
    onGift() {
      this.triggerEvent('gift');
    },
  },
});
