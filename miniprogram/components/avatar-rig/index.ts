import { ACTION_MAP } from '../../shared/actions';
import type { ActionId, EquippedGear } from '../../shared/types';
import type { Expression, HeadShape, Palette } from '../../shared/enums';
import { DEFAULT_EQUIPPED, RIG, resolveRigLayers } from '../../shared/rig';
import type { ResolvedLayer, ScreenArm } from '../../shared/rig-types';

interface RigArm {
  side: ScreenArm;
  origin: string;
  layers: ResolvedLayer[];
}

const ARMS = (['left', 'right'] as const).map((side) => {
  const { x, y } = RIG.anchors[`shoulder_screen_${side}`];
  return { side, origin: `${x}% ${y}%` };
});

interface RigData {
  layers: ResolvedLayer[];
  arms: RigArm[];
  cls: string;
  emoji: string;
}

interface RigInstance {
  _timer?: number;
  _ready?: boolean;
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
    carryHand: { type: String, value: 'right' },
    action: { type: String, value: '' },
    reduceMotion: { type: Boolean, value: false },
  },
  data: {
    layers: [] as ResolvedLayer[],
    arms: [],
    cls: '',
    emoji: '',
  } as RigData,
  observers: {
    'view, mode, palette, headShape, expression, equipped, carryHand': function () {
      this.rebuild();
    },
    action: function (action: string) {
      if (!(this as unknown as RigInstance)._ready) return;
      if (action) this.play(action);
      else this.stop();
    },
  },
  lifetimes: {
    attached() {
      (this as unknown as RigInstance)._ready = true;
      this.rebuild();
      if (this.data.action) this.play(this.data.action);
    },
    detached() {
      const instance = this as unknown as RigInstance;
      instance._ready = false;
      const timer = instance._timer;
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
          carryHand: this.data.carryHand === 'left' ? 'left' : 'right',
        },
        mode,
      );
      const arms = mode === 'full'
        ? ARMS.map((arm) => ({ ...arm, layers: layers.filter((layer) => layer.arm === arm.side) }))
        : [];
      this.setData({ layers: layers.filter((layer) => !layer.arm), arms });
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
