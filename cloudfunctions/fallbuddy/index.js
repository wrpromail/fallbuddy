const cloud = require('wx-server-sdk');
const { createHandler, cloudTransaction } = require('./handler.cjs');
const { mockApi } = require('./runtime/services/mock/api.js');
const store = require('./runtime/services/store.js');

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const handle = createHandler({
  api: mockApi,
  store,
  appId: process.env.FALLBUDDY_APP_ID,
  ownerOpenId: process.env.FALLBUDDY_PILOT_OWNER,
  transaction: cloudTransaction(cloud.database()),
  async checkText(content, openid) {
    const response = await cloud.openapi.security.msgSecCheck({ version: 2, scene: 3, openid, content });
    const suggestion = response?.result?.suggest;
    if (!['pass', 'review', 'risky'].includes(suggestion)) throw new Error('No content review decision');
    return suggestion === 'pass';
  },
});

exports.main = (event) => handle(event, cloud.getWXContext());
