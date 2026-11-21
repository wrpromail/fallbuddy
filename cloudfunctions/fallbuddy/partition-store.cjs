const META_COLLECTION = 'fallbuddy_server_state';
const META_ID = 'pilot-v1';
const PAGE_BYTES = 240_000;

const TABLES = {
  voiceJobs: ['fallbuddy_operations', 'list'],
  follows: ['fallbuddy_interactions', 'list'],
  outfits: ['fallbuddy_identity', 'list'],
  storyLinks: ['fallbuddy_stories', 'list'],
  nominations: ['fallbuddy_groups', 'list'],
  closedPolls: ['fallbuddy_groups', 'list'],
  votes: ['fallbuddy_groups', 'list'],
  pollBadges: ['fallbuddy_inventory', 'list'],
  users: ['fallbuddy_identity', 'list'],
  avatars: ['fallbuddy_identity', 'list'],
  blocks: ['fallbuddy_identity', 'map'],
  deletedAccounts: ['fallbuddy_identity', 'map'],
  groups: ['fallbuddy_groups', 'list'],
  invites: ['fallbuddy_groups', 'list'],
  interactionControls: ['fallbuddy_groups', 'list'],
  memberships: ['fallbuddy_memberships', 'list'],
  incidents: ['fallbuddy_stories', 'list'],
  stories: ['fallbuddy_stories', 'list'],
  storyUpdates: ['fallbuddy_stories', 'list'],
  storyDrafts: ['fallbuddy_stories', 'map'],
  reports: ['fallbuddy_stories', 'list'],
  inventory: ['fallbuddy_inventory', 'list'],
  ledger: ['fallbuddy_inventory', 'list'],
  weeklyGrants: ['fallbuddy_inventory', 'list'],
  interactions: ['fallbuddy_interactions', 'list'],
  notifications: ['fallbuddy_interactions', 'list'],
  ignoredInbox: ['fallbuddy_interactions', 'map'],
  operations: ['fallbuddy_operations', 'map'],
  storyPublishes: ['fallbuddy_operations', 'map'],
};

function pack(entries, limit) {
  const pages = [];
  let rows = [];
  let bytes = 2;
  for (const entry of entries) {
    const row = JSON.stringify(entry);
    const size = Buffer.byteLength(row);
    if (size + 2 > limit) throw new Error('Partition row exceeds storage limit');
    if (bytes + size + (rows.length ? 1 : 0) > limit) {
      pages.push('[' + rows.join(',') + ']');
      rows = [];
      bytes = 2;
    }
    bytes += size + (rows.length ? 1 : 0);
    rows.push(row);
  }
  if (rows.length) pages.push('[' + rows.join(',') + ']');
  return pages;
}

function address(transaction, table, index) {
  const [collection] = TABLES[table];
  // The collection's primary _id index locates every partition without collection scans.
  return transaction.collection(collection).doc(`${table}-${index}`);
}

async function readSplit(transaction, manifest) {
  if (manifest.layoutVersion !== 2 || !manifest.pages || !manifest.scalars) {
    throw new Error('Partition layout has not been provisioned');
  }
  const state = { ...manifest.scalars };
  const pages = {};
  for (const [table, [, kind]] of Object.entries(TABLES)) {
    if (!Object.hasOwn(manifest.pages, table)) continue;
    const count = manifest.pages[table];
    if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid partition count');
    const rows = [];
    const encoded = [];
    for (let index = 0; index < count; index++) {
      const { data } = await address(transaction, table, index).get();
      if (typeof data?.rows !== 'string') throw new Error('Missing partition');
      for (const row of JSON.parse(data.rows)) rows.push(row);
      encoded.push(data.rows);
    }
    state[table] = kind === 'map' ? Object.fromEntries(rows) : rows;
    pages[table] = encoded;
  }
  return { state, pages };
}

async function writeSplit(transaction, meta, previous, state, pageBytes) {
  const changes = [];
  const pages = {};
  const scalars = {};
  const revision = (previous.revision ?? 0) + 1;
  for (const [field, value] of Object.entries(state)) {
    if (!Object.hasOwn(TABLES, field)) scalars[field] = value;
  }
  for (const [table, [, kind]] of Object.entries(TABLES)) {
    const before = previous.pages[table] ?? [];
    const value = state[table];
    const next = value === undefined ? [] : pack(kind === 'map' ? Object.entries(value) : value, pageBytes);
    if (value !== undefined) pages[table] = next.length;
    for (let index = 0; index < Math.max(before.length, next.length); index++) {
      if (before[index] !== next[index]) changes.push({ table, index, rows: next[index] });
    }
  }
  for (const { table, index, rows } of changes) {
    const document = address(transaction, table, index);
    if (rows === undefined) await document.remove();
    else await document.set({ data: { field: table, page: index, rows } });
  }
  // Replacing the legacy document drops the old copy only if all partitions commit.
  await meta.set({ data: { layoutVersion: 2, revision, pages, scalars } });
}

function cloudTransaction(db, { pageBytes = PAGE_BYTES } = {}) {
  return async (action) => {
    let committedResult;
    // wx-server-sdk resolves with no callback result. On retry, load a new manifest.
    await db.runTransaction(async (transaction) => {
      const meta = transaction.collection(META_COLLECTION).doc(META_ID);
      const { data } = await meta.get();
      const isLegacy = typeof data?.snapshot === 'string' && data.layoutVersion === undefined;
      const previous = isLegacy
        ? { state: JSON.parse(data.snapshot), pages: {} }
        : { ...await readSplit(transaction, data ?? {}), revision: data.revision };
      let next = previous.state;
      let dirty = isLegacy;
      committedResult = await action(previous.state, async (state) => {
        next = state;
        dirty = true;
      });
      if (dirty) await writeSplit(transaction, meta, previous, next, pageBytes);
    });
    return committedResult;
  };
}

module.exports = { cloudTransaction };
