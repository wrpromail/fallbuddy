import { ACTION_MAP } from '../../shared/actions';
import type { ActionId, EquippedGear } from '../../shared/types';
import type { Expression, HeadShape, Palette } from '../../shared/enums';
import { DEFAULT_EQUIPPED, resolveRigLayers } from '../../shared/rig';
import type { ResolvedLayer } from '../../shared/rig-types';

interface RigData {
  layers: ResolvedLayer[];
  cls: string;
  emoji: string;
}

interface RigInstance {
  _timer?: number;
}

Component({
  options: { addGlobalClass: true },
  properties: {
    view: { type: String, value: 'front' },
    mode: { type: String, value: 'full' },
    palette: { type: String, value: 'blue' },
    headShape: { type: String, value: 'round' },
    expression: { type: String, value: 'happy' },
    equipped: { type: Object, value: null },
    action: { type: String, value: '' },
    reduceMotion: { type: Boolean, value: false },
  },
  data: {
    layers: [] as ResolvedLayer[],
    cls: '',
    emoji: '',
  } as RigData,
  observers: {
    'view, mode, palette, headShape, expression, equipped': function () {
      this.rebuild();
    },
  },
  lifetimes: {
    attached() {
      this.rebuild();
    },
    detached() {
      const timer = (this as unknown as RigInstance)._timer;
      if (timer) clearTimeout(timer);
    },
  },
  methods: {
    rebuild() {
      const view = this.data.view === 'back' ? 'back' : 'front';
      const mode = this.data.mode === 'chip' ? 'chip' : 'full';
      const equipped = (this.data.equipped as EquippedGear | null) ?? DEFAULT_EQUIPPED;
      const layers = resolveRigLayers(
        view,
        {
          headShape: this.data.headShape as HeadShape,
          palette: this.data.palette as Palette,
          expression: this.data.expression as Expression,
          equipped,
        },
        mode,
      );
      this.setData({ layers });
    },

    /** 播放一次动作；开启「减少动效」时降级为静态表情 + emoji */
    play(actionId: string) {
      const def = ACTION_MAP[actionId as ActionId];
      if (!def) return;
      const instance = this as unknown as RigInstance;
      if (instance._timer) clearTimeout(instance._timer);
      const reduce = this.data.reduceMotion;
      const actionClass = def.id === 'receive_gift' ? 'is-gift' : `is-${def.id}`;
      this.setData({
        cls: reduce ? 'is-static' : actionClass,
        emoji: reduce ? '🙂' : def.fallbackEmoji,
      });
      instance._timer = setTimeout(() => {
        this.setData({ cls: '', emoji: '' });
      }, reduce ? 1200 : def.durationMs + 200) as unknown as number;
    },

    stop() {
      const instance = this as unknown as RigInstance;
      if (instance._timer) clearTimeout(instance._timer);
      this.setData({ cls: '', emoji: '' });
    },
  },
});
