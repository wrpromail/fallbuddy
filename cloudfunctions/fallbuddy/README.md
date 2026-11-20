# 摔友记单圈子云端试用

源码使用微信小程序云函数身份和云数据库事务。默认客户端使用本地演示数据。试用版采用单圈子和单事务文档，写入上限为 800 KB，适合小范围验证。超过上限时写入失败并保留已存数据。扩大试用规模前需要拆分数据集合和索引。

## 测试环境部署

1. 在微信开发者工具使用实际测试小程序 AppID 导入仓库，从该小程序关联的测试云环境启用 CloudBase。将环境 ID 填入 `miniprogram/shared/cloud-config.ts`。
2. 建立 `fallbuddy_server_state` 集合，权限设为仅服务端可读写。创建固定文档 ID `pilot-v1`，其中 `snapshot` 为**字符串**字段，初始值为：

   ```json
   {"schemaVersion":1,"seededAt":"","users":[],"avatars":[],"groups":[],"memberships":[],"incidents":[],"stories":[],"storyUpdates":[],"inventory":[],"ledger":[],"interactions":[],"notifications":[],"weeklyGrants":[],"invites":[],"operations":{}}
   ```

3. 在仓库根目录运行 `npm run build:cloud`，上传 `cloudfunctions/fallbuddy/` 并在云端安装依赖。运行时用 Node.js 18 或更新版本。设置云函数环境变量 `FALLBUDDY_APP_ID` 为测试小程序 AppID，`FALLBUDDY_PILOT_OWNER` 为指定圈主在该小程序的 OpenID。云函数配置需启用微信内容安全接口 `security.msgSecCheck`。
4. 圈主第一次打开小程序时创建试用圈子。圈主发出邀请，在圈子页审批申请。微信文本安全检查涵盖发布、编辑和追加后续的文字。待审核、风险或接口不可用时，页面可以保留用户填写的内容供修改或重试。

## 验收

`npm run test:cloud` 使用内存事务和替身内容审核，运行打包后的真实业务代码。云端验收需要两个授权微信账号，检查入圈审批、重复发布、两台设备编辑冲突、改为私密后从旧链接访问、内容审核及举报隐藏。云端和本地演示状态各自保存。
