import type { BodyPart, EquipSlot, Expression, Palette } from './enums';

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
  slot?: 'expression' | EquipSlot;
  src?: string;
  variants?: Record<string, string>;
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
}

export interface RigAppearance {
  palette: Palette;
  equipped: {
    headgear: string | null;
    goggles: string | null;
    outfit: string | null;
    hip_protector: string | null;
    boots: string | null;
  };
  expression: Expression;
}
