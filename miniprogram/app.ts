import { loadState } from './services/store';
import { CLOUD_ENV_ID } from './shared/cloud-config';

App({
  onLaunch() {
    if (CLOUD_ENV_ID) {
      wx.cloud.init({ env: CLOUD_ENV_ID });
    } else {
      loadState();
    }
  },
});
