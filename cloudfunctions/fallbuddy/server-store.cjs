const { AsyncLocalStorage } = require('node:async_hooks');
const { createHash, randomBytes } = require('node:crypto');

const requests = new AsyncLocalStorage();

function requestStore() {
  const request = requests.getStore();
  if (!request) throw new Error('Missing database request context');
  return request;
}

exports.withState = (request, action) => requests.run(request, action);
exports.loadState = () => requestStore().state;
// 云数据库事务已载入一份请求专属的快照。
exports.loadStateForWrite = exports.loadState;
exports.saveState = (state) => Object.assign(requestStore(), { state, dirty: true });
exports.mintInviteToken = () => 'inv_' + randomBytes(24).toString('base64url');
exports.inviteTokenHash = (token) => createHash('sha256').update(token).digest('hex');
exports.publishRequestFingerprint = exports.inviteTokenHash;
exports.accountFingerprint = (openid) => exports.inviteTokenHash('closed-account:' + openid);
exports.platformInteractionsPaused = () => process.env.FALLBUDDY_DISABLE_INTERACTIONS === '1';
exports.platformPollsPaused = () => process.env.FALLBUDDY_DISABLE_POLLS === '1';
