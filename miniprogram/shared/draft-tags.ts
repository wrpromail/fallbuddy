import { BODY_PART_LABEL, PROTECTIVE_LABEL, SCENARIO_LABEL, type BodyPart, type ProtectiveItem, type Scenario } from './enums';

export type DraftTag = { kind: 'bodyParts'; id: BodyPart; label: string } |
  { kind: 'protections'; id: ProtectiveItem; label: string } | { kind: 'scenario'; id: Scenario; label: string };

export function draftTags(text: string): DraftTag[] {
  const result: DraftTag[] = [];
  // 原文出现也可能是否定或指别人的经历，必须逐项点选。
  for (const [id, label] of Object.entries(BODY_PART_LABEL)) {
    if (label.length > 1 && id !== 'other' && text.includes(label)) result.push({ kind: 'bodyParts', id: id as BodyPart, label });
  }
  for (const [id, label] of Object.entries(PROTECTIVE_LABEL)) {
    if (id !== 'other' && text.includes(label)) result.push({ kind: 'protections', id: id as ProtectiveItem, label });
  }
  for (const [id, label] of Object.entries(SCENARIO_LABEL)) {
    if (id !== 'unknown' && id !== 'other' && text.includes(label)) result.push({ kind: 'scenario', id: id as Scenario, label });
  }
  return result;
}
