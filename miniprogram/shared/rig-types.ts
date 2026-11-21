import type { BodyPart, CarryHand, EquipSlot, Expression, HeadShape, Palette } from './enums';
import type { EquippedGear } from './types';

export type ScreenArm = 'left' | 'right';

export interface LayerBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface RigLayerDef {
  id: string;
  z: number;
  bbox: LayerBox;
  slot?: 'expression' | 'palette' | 'headShape' | EquipSlot;
  src?: string;
  variants?: Record<string, string>;
  arm?: ScreenArm;
  carriedBy?: CarryHand;
}

export interface RigHotspot {
  id: BodyPart;
  label: string;
  x: number;
  y: number;
  r: number;
}

export interface RigDefinition {
  version: 'skeleton-rig-v1';
  canvas: { width: number; height: number };
  anchors: Record<string, { x: number; y: number }>;
  hotspots: { front: RigHotspot[]; back: RigHotspot[] };
  views: { front: RigLayerDef[]; back: RigLayerDef[] };
}

export interface ResolvedLayer {
  id: string;
  z: number;
  src: string;
  left: number;
  top: number;
  width: number;
  height: number;
  arm?: ScreenArm;
  handheld?: boolean;
}

export interface RigAppearance {
  palette: Palette;
  headShape?: HeadShape;
  equipped: EquippedGear;
  carryHand?: CarryHand;
  expression: Expression;
}
