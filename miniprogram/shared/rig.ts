import { RIG_DATA } from './rig.generated';
import type { EquipSlot, Expression } from './enums';
import type { LayerBox, ResolvedLayer, RigAppearance, RigDefinition, RigHotspot, RigLayerDef } from './rig-types';
import { EQUIP_SLOTS } from './enums';
import { SNOWBOARD_ID } from './items';

export const RIG = RIG_DATA as unknown as RigDefinition;

export const DEFAULT_EQUIPPED: RigAppearance['equipped'] = {
  headgear: 'beanie_blue',
  goggles: null,
  outfit: 'ski_blue',
  hip_protector: 'basic_hip_protector',
  boots: null,
};

const CHIP_LAYER_IDS = ['head', 'face', 'headgear', 'goggles'];

function pct(value: number): number {
  return Math.round(value * 10000) / 100;
}

function unionBox(boxes: LayerBox[]): LayerBox {
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  const right = Math.max(...boxes.map((b) => b.x + b.w));
  const bottom = Math.max(...boxes.map((b) => b.y + b.h));
  return { x, y, w: right - x, h: bottom - y };
}

function layerSource(layer: RigLayerDef, appearance: RigAppearance): string | null {
  if (layer.slot === 'expression') {
    return layer.variants?.[appearance.expression] ?? layer.variants?.happy ?? null;
  }
  if (layer.slot === 'palette') return layer.variants?.[appearance.palette] ?? layer.variants?.blue ?? null;
  if (layer.slot === 'headShape') {
    return layer.variants?.[`${appearance.headShape || 'round'}-${appearance.palette}`]
      ?? layer.variants?.[`round-${appearance.palette}`] ?? layer.variants?.['round-blue'] ?? null;
  }
  if (layer.slot) {
    const value = appearance.equipped[layer.slot];
    if (!value) return null;
    return layer.variants?.[value] ?? null;
  }
  return layer.src ?? null;
}

/**
 * 解析一个视图实际要渲染的图层。
 * mode=full：整只角色；mode=chip：头像小徽章（只取头/帽/雪镜并按并集裁剪）。
 */
export function resolveRigLayers(
  view: 'front' | 'back',
  appearance: RigAppearance,
  mode: 'full' | 'chip' = 'full',
): ResolvedLayer[] {
  const layers = RIG.views[view] ?? RIG.views.front;
  const active: { layer: RigLayerDef; src: string }[] = [];
  for (const layer of layers) {
    if (layer.carriedBy && layer.carriedBy !== (appearance.carryHand ?? 'right')) continue;
    const src = layerSource(layer, appearance);
    if (!src) continue;
    if (mode === 'chip' && !CHIP_LAYER_IDS.includes(layer.id)) continue;
    active.push({ layer, src });
  }
  if (!active.length) return [];
  let box = { x: 0, y: 0, w: RIG.canvas.width, h: RIG.canvas.height };
  if (mode === 'chip') {
    const crop = unionBox(active.map(({ layer }) => layer.bbox));
    const side = Math.max(crop.w, crop.h);
    box = { x: crop.x - (side - crop.w) / 2, y: crop.y - (side - crop.h) / 2, w: side, h: side };
  }
  return active.map(({ layer, src }) => ({
    id: layer.id,
    z: layer.z,
    src,
    left: pct((layer.bbox.x - box.x) / box.w),
    top: pct((layer.bbox.y - box.y) / box.h),
    width: pct(layer.bbox.w / box.w),
    height: pct(layer.bbox.h / box.h),
    arm: layer.arm,
    handheld: layer.slot === 'handheld',
  }));
}

export function hotspotsFor(view: 'front' | 'back'): RigHotspot[] {
  return RIG.hotspots[view];
}

export function hotspotList(): RigHotspot[] {
  const seen = new Map<string, RigHotspot>();
  for (const view of ['front', 'back'] as const) {
    for (const spot of RIG.hotspots[view]) {
      if (!seen.has(spot.id)) seen.set(spot.id, spot);
    }
  }
  return [...seen.values()];
}

/** 从 rig 变体里推导可选的装备项（供角色页展示，真实权限仍由库存决定） */
export function equipmentVariants(): Record<EquipSlot, string[]> {
  return Object.fromEntries(EQUIP_SLOTS.map((slot) => {
    const keys = RIG.views.front.filter((layer) => layer.slot === slot)
      .flatMap((layer) => Object.keys(layer.variants ?? {}));
    return [slot, [...new Set(keys)]];
  })) as Record<EquipSlot, string[]>;
}

export function expressionVariants(): Expression[] {
  const head = RIG.views.front.find((l) => l.slot === 'expression');
  return (head?.variants ? Object.keys(head.variants) : ['happy']) as Expression[];
}

export function appearanceEquals(a: RigAppearance, b: RigAppearance): boolean {
  return (
    a.palette === b.palette &&
    a.expression === b.expression &&
    (a.headShape ?? 'round') === (b.headShape ?? 'round') &&
    (a.equipped.handheld !== SNOWBOARD_ID || (a.carryHand ?? 'right') === (b.carryHand ?? 'right')) &&
    EQUIP_SLOTS.every((slot) => (a.equipped[slot] ?? null) === (b.equipped[slot] ?? null))
  );
}
