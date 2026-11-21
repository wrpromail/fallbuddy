#!/usr/bin/env node
/** 从 V0 mock 种子导出可校验的数据快照（build/data/），供 Schema 校验与文档引用。 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { buildMockState } = require('../build/test/miniprogram/shared/mock-build.js');
const { RIG } = require('../build/test/miniprogram/shared/rig.js');
const { ACTIONS } = require('../build/test/miniprogram/shared/actions.js');
const { ITEM_DEFINITIONS, WEEKLY_GRANT } = require('../build/test/miniprogram/shared/items.js');

const OUT = resolve(import.meta.dirname, '..', 'build', 'data');
mkdirSync(OUT, { recursive: true });

const state = buildMockState(Date.now());

// 与 schemas/incident.schema.json 对齐的字段投影（内部字段不参与校验）
const incidents = state.incidents.map((incident) => ({
  schemaVersion: incident.schemaVersion,
  sport: incident.sport,
  scenario: incident.scenario,
  selfReportedCause: incident.selfReportedCause,
  bodyParts: incident.bodyParts,
  impactKind: incident.impactKind,
  protectiveItems: incident.protectiveItems,
  source: incident.source,
  venueId: incident.venueId,
  userSummary: incident.userSummary,
  happenedOn: incident.happenedOn,
}));

const avatars = state.avatars.map((avatar) => ({
  rigVersion: avatar.rigVersion,
  palette: avatar.palette,
  headShape: avatar.headShape ?? 'round',
  equipped: avatar.equipped,
  carryHand: avatar.carryHand,
  expression: avatar.expression,
  privacy: avatar.privacy,
}));

const stories = state.stories.map((story) => ({
  id: story.id,
  title: story.title,
  body: story.body,
  tone: story.tone,
  authorId: story.authorId,
  visibility: story.visibility,
  visibilityGroupIds: story.visibilityGroupIds,
  allowFunnyActions: story.allowFunnyActions,
  allowGifts: story.allowGifts,
  isAnonymous: story.isAnonymous,
  moderationStatus: story.moderationStatus,
  publishStatus: story.publishStatus,
  createdAt: story.createdAt,
}));

const groups = state.groups.map((group) => ({
  id: group.id,
  name: group.name,
  ownerId: group.ownerId,
  joinMode: group.joinMode,
}));

const memberships = state.memberships.map((m) => ({
  groupId: m.groupId,
  userId: m.userId,
  role: m.role,
  status: m.status,
}));

writeFileSync(join(OUT, 'incidents.json'), JSON.stringify(incidents, null, 2));
writeFileSync(join(OUT, 'avatars.json'), JSON.stringify(avatars, null, 2));
writeFileSync(join(OUT, 'stories.json'), JSON.stringify(stories, null, 2));
writeFileSync(join(OUT, 'groups.json'), JSON.stringify({ groups, memberships }, null, 2));
writeFileSync(join(OUT, 'actions.json'), JSON.stringify({ version: 1, actions: ACTIONS }, null, 2));
writeFileSync(join(OUT, 'items.json'), JSON.stringify({ version: 1, items: ITEM_DEFINITIONS, weeklyGrant: WEEKLY_GRANT }, null, 2));
writeFileSync(join(OUT, 'rig.json'), JSON.stringify(RIG, null, 2));

console.log(`exported ${incidents.length} incidents / ${avatars.length} avatars / ${stories.length} stories → ${OUT}`);
