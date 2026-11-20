import { GROUPS, MEMBERSHIPS, STORIES, USERS, ME } from '../mock/fixtures';
import type { FixtureStory } from '../mock/fixtures';
import { ITEM_DEFINITIONS, ITEM_MAP } from './items';
import { addDays, isoAt } from './time';
import type { DbState, NotificationRecord, UserRecord } from './db-types';
import type {
  AvatarState,
  LedgerEntry,
  Incident,
  InteractionEvent,
  InventoryItem,
  Membership,
  Story,
  StoryUpdate,
} from './types';


function incidentFromFixture(story: FixtureStory, now: number): Incident {
  const createdAt = isoAt(now, story.hoursAgo);
  return {
    id: `inc_${story.id}`,
    schemaVersion: 1,
    authorId: story.authorId,
    sport: story.sport,
    scenario: story.scenario,
    selfReportedCause: story.cause,
    bodyParts: story.bodyParts,
    impactKind: story.impactKind,
    protectiveItems: story.protectiveItems,
    source: 'manual',
    venueId: null,
    userSummary: story.body.slice(0, 60),
    createdAt,
    updatedAt: createdAt,
  };
}

function storyFromFixture(story: FixtureStory, now: number): Story {
  const createdAt = isoAt(now, story.hoursAgo);
  return {
    id: story.id,
    schemaVersion: 1,
    incidentId: `inc_${story.id}`,
    authorId: story.authorId,
    title: story.title,
    body: story.body,
    tone: story.tone,
    visibilityGroupIds: story.groupIds,
    allowFunnyActions: story.allowFunnyActions,
    allowGifts: story.allowGifts,
    isAnonymous: story.isAnonymous ?? false,
    moderationStatus: 'approved',
    publishStatus: 'published',
    version: 1,
    createdAt,
    updatedAt: createdAt,
  };
}

function cosmeticIds(): string[] {
  return ITEM_DEFINITIONS.filter((item) => item.category === 'cosmetic').map((item) => item.id);
}

const BASE_CONSUMABLES: Record<string, Record<string, number>> = {
  [ME]: { steel_hip_guard: 2, hot_cocoa: 1, comfort_patch: 1 },
  usr_lin: { hot_cocoa: 2, comfort_patch: 1 },
  usr_yu: { comfort_patch: 2 },
  usr_tang: { hot_cocoa: 1 },
  usr_zhou: { hot_cocoa: 2 },
  usr_ma: { steel_hip_guard: 1, comfort_patch: 1 },
};

export function buildMockState(now: number = Date.now()): DbState {
  const users: UserRecord[] = USERS.map((user) => ({
    id: user.id,
    openid: `mock-openid-${user.id}`,
    displayName: user.displayName,
    palette: user.palette,
    avatarId: `avt_${user.id}`,
    createdAt: isoAt(now, user.hoursAgo),
    isMe: user.id === ME,
    preferences: { ...user.preferences },
  }));

  const avatars: AvatarState[] = USERS.map((user) => ({
    id: `avt_${user.id}`,
    ownerId: user.id,
    rigVersion: 'skeleton-rig-v1',
    palette: user.palette,
    equipped: { ...user.equipped },
    expression: user.expression,
    privacy: {
      allowFunnyActions: user.preferences.allowFunnyActions,
      allowGifts: user.preferences.allowGifts,
    },
    version: 1,
  }));

  const groups = GROUPS.map((group) => ({
    id: group.id,
    name: group.name,
    ownerId: group.ownerId,
    joinMode: group.joinMode,
    createdAt: isoAt(now, group.hoursAgo),
  }));

  const memberships: Membership[] = MEMBERSHIPS.map((m) => ({
    groupId: m.groupId,
    userId: m.userId,
    role: m.role,
    status: 'active',
    joinedAt: isoAt(now, m.hoursAgo),
  }));

  const incidents = STORIES.map((story) => incidentFromFixture(story, now));
  const stories = STORIES.map((story) => storyFromFixture(story, now));

  const storyUpdates: StoryUpdate[] = [];
  for (const story of STORIES) {
    for (const update of story.updates ?? []) {
      storyUpdates.push({
        id: `upd_${story.id}_${update.type}`,
        storyId: story.id,
        authorId: story.authorId,
        type: update.type,
        body: update.body,
        visibilityGroupIds: story.groupIds,
        moderationStatus: 'approved',
        createdAt: isoAt(now, update.hoursAgo),
      });
    }
  }

  const inventory: InventoryItem[] = [];
  const ledger: LedgerEntry[] = [];
  const allCosmetics = cosmeticIds();

  for (const user of USERS) {
    for (const itemDefId of allCosmetics) {
      const item = ITEM_MAP[itemDefId];
      inventory.push({
        id: `inv_${user.id}_${itemDefId}`,
        ownerId: user.id,
        itemDefId,
        quantity: 1,
        expiresAt: null,
        version: 1,
      });
      ledger.push({
        operationId: `seed_grant_${user.id}_${item.id}`,
        fromUserId: null,
        toUserId: user.id,
        itemDefId,
        delta: 1,
        eventId: 'seed',
        createdAt: isoAt(now, user.hoursAgo),
      });
    }
    const consumables = BASE_CONSUMABLES[user.id] ?? {};
    for (const [itemDefId, quantity] of Object.entries(consumables)) {
      const def = ITEM_MAP[itemDefId];
      inventory.push({
        id: `inv_${user.id}_${itemDefId}`,
        ownerId: user.id,
        itemDefId,
        quantity,
        expiresAt: addDays(now, def.ttlDays ?? 14),
        version: 1,
      });
      ledger.push({
        operationId: `seed_weekly_${user.id}_${itemDefId}`,
        fromUserId: null,
        toUserId: user.id,
        itemDefId,
        delta: quantity,
        eventId: 'seed',
        createdAt: isoAt(now, 24 * 6),
      });
    }
  }

  const interactions: InteractionEvent[] = [];
  const notifications: NotificationRecord[] = [];

  for (const story of STORIES) {
    let index = 0;
    for (const reaction of story.reactions ?? []) {
      for (const actor of reaction.actors) {
        index += 1;
        const createdAt = isoAt(now, reaction.hoursAgo + index * 0.05);
        const id = `evt_${story.id}_${reaction.actionId}_${actor}`;
        interactions.push({
          id,
          storyId: story.id,
          actorId: actor,
          targetId: story.authorId,
          actionId: reaction.actionId,
          animationVersion: 1,
          status: 'ok',
          createdAt,
        });
        notifications.push({
          id: `ntf_${id}`,
          targetId: story.authorId,
          eventId: id,
          kind: 'interaction',
          readAt: null,
          createdAt,
        });
      }
    }
    if (story.gift) {
      const createdAt = isoAt(now, story.gift.hoursAgo);
      const id = `evt_${story.id}_gift_${story.gift.from}`;
      interactions.push({
        id,
        storyId: story.id,
        actorId: story.gift.from,
        targetId: story.authorId,
        actionId: 'receive_gift',
        itemDefId: story.gift.itemDefId,
        animationVersion: 1,
        status: 'ok',
        createdAt,
      });
      notifications.push({
        id: `ntf_${id}`,
        targetId: story.authorId,
        eventId: id,
        kind: 'interaction',
        readAt: null,
        createdAt,
      });
      // 转移库存：发送方 -1，接收方 +1
      const sender = inventory.find((inv) => inv.ownerId === story.gift!.from && inv.itemDefId === story.gift!.itemDefId);
      if (sender) sender.quantity = Math.max(0, sender.quantity - 1);
      const receiver = inventory.find((inv) => inv.ownerId === story.authorId && inv.itemDefId === story.gift!.itemDefId);
      if (receiver) receiver.quantity += 1;
      else {
        const def = ITEM_MAP[story.gift.itemDefId];
        inventory.push({
          id: `inv_${story.authorId}_${story.gift.itemDefId}`,
          ownerId: story.authorId,
          itemDefId: story.gift.itemDefId,
          quantity: 1,
          expiresAt: addDays(now, def.ttlDays ?? 14),
          version: 1,
        });
      }
      ledger.push({
        operationId: `seed_gift_${story.gift.from}_${story.gift.itemDefId}`,
        fromUserId: story.gift.from,
        toUserId: story.authorId,
        itemDefId: story.gift.itemDefId,
        delta: 1,
        eventId: id,
        createdAt,
      });
    }
  }

  return {
    schemaVersion: 1,
    currentUserId: ME,
    seededAt: new Date(now).toISOString(),
    users,
    avatars,
    groups,
    memberships,
    incidents,
    stories,
    storyUpdates,
    inventory,
    ledger,
    interactions,
    notifications,
    weeklyGrants: [],
    invites: [],
    operations: {},
  };
}

