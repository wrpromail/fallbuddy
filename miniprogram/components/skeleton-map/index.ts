import { PALETTE_COLOR, type BodyPart } from '../../shared/enums';
import { RIG, hotspotsFor } from '../../shared/rig';
import type { AtlasUserChip, HotspotSummary } from '../../shared/types';

interface SpotChip extends AtlasUserChip {
  bg: string;
  border: string;
}

interface SpotView {
  id: BodyPart;
  label: string;
  left: number;
  top: number;
  count: number;
  chips: SpotChip[];
  more: number;
}

interface MapAppearance {
  palette: string;
  expression: string;
  equipped: unknown;
}

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

Component({
  options: { addGlobalClass: true },
  properties: {
    view: { type: String, value: 'front' },
    hotspots: { type: Array, value: [] },
    appearance: { type: Object, value: null },
    reduceMotion: { type: Boolean, value: false },
  },
  data: {
    spots: [] as SpotView[],
    figPalette: 'blue',
    figExpression: 'happy',
    figEquipped: null as unknown,
  },
  observers: {
    'view, hotspots, appearance': function () {
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
      const view = this.data.view === 'back' ? 'back' : 'front';
      const summaries = (this.data.hotspots as HotspotSummary[]) ?? [];
      const byId = new Map<string, HotspotSummary>();
      for (const summary of summaries) byId.set(summary.id, summary);
      const appearance = (this.data.appearance as MapAppearance | null) ?? null;
      const width = RIG.canvas.width;
      const height = RIG.canvas.height;
      const spots: SpotView[] = hotspotsFor(view).map((spot) => {
        const summary = byId.get(spot.id);
        const users = summary?.users ?? [];
        const chips: SpotChip[] = users.slice(0, 2).map((user) => ({
          ...user,
          bg: hexToRgba(PALETTE_COLOR[user.palette], 0.16),
          border: PALETTE_COLOR[user.palette],
        }));
        return {
          id: spot.id,
          label: spot.label,
          left: Math.round((spot.x / width) * 1000) / 10,
          top: Math.round((spot.y / height) * 1000) / 10,
          count: summary?.count ?? 0,
          chips,
          more: Math.max(0, users.length - 2),
        };
      });
      this.setData({
        spots,
        figPalette: appearance?.palette ?? 'blue',
        figExpression: appearance?.expression ?? 'happy',
        figEquipped: appearance?.equipped ?? null,
      });
    },
    onTap(event: WechatMiniprogram.TouchEvent) {
      const dataset = event.currentTarget.dataset as { id: BodyPart; label: string };
      this.triggerEvent('hotspot', { id: dataset.id, label: dataset.label });
    },
  },
});
