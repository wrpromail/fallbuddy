/**
 * 服务端输入校验：mock 与 V1 云函数共用同一份规则。
 *
 * 枚举与数组约束对齐 shaiyouji_implementation_kit/schemas/incident.schema.json
 * （scenario / selfReportedCause / bodyParts 上限 3 且 uniqueItems，
 * protectiveItems 受枚举约束）；标题/正文长度对齐方案 §4.3（1–24 字 / 1–140 字）。
 *
 * 返回 null 表示合法；返回字符串为可直接展示给用户的错误文案。
 * 页面不调用本模块——校验只发生在服务端入口。
 */
import {
  BODY_PARTS,
  CAUSES,
  IMPACT_KINDS,
  PROTECTIVE_ITEMS,
  SCENARIOS,
  SPORTS,
  TONES,
} from './enums';
import type { CreateStoryInput } from './types';

function inEnum(allowed: readonly string[], value: unknown): boolean {
  return typeof value === 'string' && allowed.includes(value);
}

interface ListRules {
  allowed: readonly string[];
  min: number;
  max: number;
  /** 不是数组或数量越界时的提示 */
  invalid: string;
  dup: string;
  unknown: string;
}

/** 受控枚举多选校验：数量区间 → 去重 → 逐项枚举成员 */
function checkEnumList(value: unknown, rules: ListRules): string | null {
  if (!Array.isArray(value) || value.length < rules.min || value.length > rules.max) {
    return rules.invalid;
  }
  if (new Set(value).size !== value.length) return rules.dup;
  for (const item of value) {
    if (!inEnum(rules.allowed, item)) return rules.unknown;
  }
  return null;
}

export function validateCreateStoryInput(input: CreateStoryInput, draft = false): string | null {
  if (!input || !input.incident || !input.story) return '内容不完整';
  const { incident, story } = input;
  if (incident.source !== undefined && !['manual', 'ai_assisted'].includes(incident.source)) return '记录来源无效';

  if (typeof story.title !== 'string' || typeof story.body !== 'string') return '标题与正文不能为空';
  const title = story.title.trim();
  const body = story.body.trim();
  if ((!draft && !title) || title.length > 24) return '标题需要 1–24 个字';
  if ((!draft && !body) || body.length > 140) return '正文需要 1–140 个字';
  if (incident.userSummary !== undefined && (typeof incident.userSummary !== 'string' || incident.userSummary.length > 140)) {
    return '事故自述最多 140 个字';
  }
  if (incident.happenedOn !== undefined) {
    if (typeof incident.happenedOn !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(incident.happenedOn)) {
      return '发生日期无效';
    }
    const date = new Date(incident.happenedOn + 'T00:00:00Z');
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== incident.happenedOn) {
      return '发生日期无效';
    }
  }

  if (!inEnum(SPORTS, incident.sport)) return '运动类型不可用';

  const scenarioError = checkEnumList(incident.scenario, {
    allowed: SCENARIOS,
    min: draft ? 0 : 1,
    max: 3,
    invalid: '请选择 1–3 个发生背景',
    dup: '发生背景不能重复选择',
    unknown: '发生背景包含未知选项',
  });
  if (scenarioError) return scenarioError;

  const causeError = checkEnumList(incident.selfReportedCause, {
    allowed: CAUSES,
    min: draft ? 0 : 1,
    max: 3,
    invalid: '请选择 1–3 个自述原因，或标记为「原因未知」',
    dup: '自述原因不能重复选择',
    unknown: '自述原因包含未知选项',
  });
  if (causeError) return causeError;

  const bodyPartError = checkEnumList(incident.bodyParts, {
    allowed: BODY_PARTS,
    min: draft ? 0 : 1,
    max: 3,
    invalid: '请选择 1–3 个身体部位',
    dup: '身体部位不能重复选择',
    unknown: '身体部位包含未知选项',
  });
  if (bodyPartError) return bodyPartError;

  if (!inEnum(IMPACT_KINDS, incident.impactKind)) return '伤情情况不可用';

  const protectiveError = checkEnumList(incident.protectiveItems, {
    allowed: PROTECTIVE_ITEMS,
    min: 0,
    max: PROTECTIVE_ITEMS.length,
    invalid: '护具选择无效',
    dup: '护具不能重复选择',
    unknown: '护具包含未知选项',
  });
  if (protectiveError) return protectiveError;

  if (!inEnum(TONES, story.tone)) return '语气不可用';
  if (story.visibility !== undefined && story.visibility !== 'groups' && story.visibility !== 'self') {
    return '可见范围不可用';
  }
  const groups = story.visibilityGroupIds;
  if (groups !== undefined && (!Array.isArray(groups) || groups.some((id) => typeof id !== 'string' || !id))) {
    return '可见圈子无效';
  }
  if (
    typeof story.allowFunnyActions !== 'boolean' ||
    typeof story.allowGifts !== 'boolean' ||
    typeof story.isAnonymous !== 'boolean'
  ) {
    return '互动设置不合法';
  }
  return null;
}
