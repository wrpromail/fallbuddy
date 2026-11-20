import { loadState } from './services/store';

App({
  onLaunch() {
    // V0 数据源为本地 mock；首次启动会写入演示种子
    loadState();
  },
  onShow() {
    loadState();
  },
});
