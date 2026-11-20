# 摔友记｜API 与云函数约定（草案）

## 0. 通用约定

调用 `wx.cloud.callFunction({ name: 'story', data: { action: 'saveDraft', requestId, payload } })`。云函数以当前调用者的微信身份获取用户 ID，不读取客户端声称的 `actorId` 作为授权依据。

**成功响应**：

```json
{"ok":true,"code":"OK","data":{"storyId":"sty_abc"},"requestId":"req_abc"}
```

**错误响应**：

```json
{"ok":false,"code":"NOT_MEMBER","message":"无权访问该圈子","requestId":"req_abc"}
```

`message` 用于 UI，不能泄露个人信息或内部数据库标识。写入请求必须有 `requestId`，可使用 UUID；服务端按 action + actorId + requestId 去重。

## 1. 身份 / 圈子

| 函数动作 | 参数 | 返回关键数据 | 权限 |
|---|---|---|---|
| `auth.ensureUser` | `displayName?` | `id, displayName, avatarId` | 登录身份 |
| `group.create` | `name, joinMode` | `groupId` | 当前用户 |
| `group.createInvite` | `groupId, ttlHours=48` | `sharePath, expiresAt` | 圈主/管理员 |
| `group.join` | `inviteToken` | `membershipStatus` | token 未过期 |
| `group.listMine` | 无 | `groups[]` | 当前用户 |
| `group.getAtlas` | `groupId, view, period` | `hotspots[], counts, stories[]` | 活跃圈子成员 |
| `group.leave` | `groupId` | `status` | 活跃圈子成员 |

`sharePath` 只能带 invite token，不带可复用的管理凭证。服务端只存 token hash，并应支持撤销及加入次数限制。

## 2. 事故与故事

| 函数动作 | 参数 | 返回关键数据 | 权限 |
|---|---|---|---|
| `story.saveDraft` | `incident, storyDraft` | `draftId, revision` | 本人 |
| `story.publish` | `draftId, revision, visibilityGroupIds[]` | `storyId, status` | 本人 + 审核通过 |
| `story.getDetail` | `storyId, groupId` | `incident, story, updates, reactions` | 本人或成员 |
| `story.appendUpdate` | `storyId, type, body` | `updateId, status` | 作者 |
| `story.withdraw` | `storyId` | `status` | 作者 |
| `story.listMine` | `cursor, limit` | `stories[], nextCursor` | 本人 |

`story.publish` 要检查 `visibilityGroupIds` 全部属于用户可发布的圈子，不能只信任传入 groupId。`story.getDetail` 检查故事是否授权显示于具体 `groupId`；非成员直接返回 `NOT_VISIBLE`，不给出详情。

## 3. Avatar / 道具

| 函数动作 | 参数 | 返回关键数据 |
|---|---|---|
| `avatar.getMine` | 无 | `rigVersion, appearance, equipped` |
| `avatar.updateAppearance` | `appearance, expectedVersion` | `version` |
| `inventory.getMine` | 无 | `items[]` |
| `inventory.claimWeekly` | `weekKey, requestId` | `grantId, items[]` |
| `inventory.gift` | `toUserId, storyId, itemDefId, requestId` | `transferId, eventId` |

一个 `weekKey` 示例：`2026-W47`。服务端使用其自身时区和周定义决定是否允许领取；不信任客户端传来的周次。道具 `ItemDefinition` 必须标记 `transferable = true` 才允许赠送。发放、赠送、消耗记录在 `inventory_ledger`。

## 4. 互动、投票与消息

| 函数动作 | 参数 | 返回关键数据 |
|---|---|---|
| `interaction.react` | `storyId, actionId, requestId` | `eventId` |
| `interaction.linkStory` | `storyId, myStoryId, requestId` | `linkId` |
| `interaction.getInbox` | `cursor, limit` | `events[], nextCursor, unreadCount` |
| `interaction.markRead` | `eventIds[]` | `updatedCount` |
| `poll.listActive` | `groupId` | `polls[]` |
| `poll.vote` | `pollId, candidateId, requestId` | `voteId` |
| `moderation.report` | `targetType, targetId, reason` | `reportId` |

`interaction.react` 需同时校验故事状态、圈子权限、动作类型、作者许可和每日上限。历史互动动画以 `animationVersion` 播放，缺失则静态降级。

## 5. AI 处理

| 函数动作 | 参数 | 返回关键数据 |
|---|---|---|
| `ai.submitVoice` | `draftId, audioObjectKey, durationSeconds, requestId` | `jobId, state=QUEUED` |
| `ai.getJob` | `jobId` | `state, progressStage, preview?` |
| `ai.cancelJob` | `jobId` | `state` |
| `ai.acceptPreview` | `jobId, editedStoryDraft` | `draftId, revision` |

任务状态：`QUEUED → TRANSCRIBING → REDACTING → EXTRACTING → MODERATING → READY_FOR_REVIEW`；失败状态 `FAILED_RETRYABLE/FAILED_FINAL/REJECTED/CANCELED/EXPIRED`。任何 AI 任务都不能直接将草稿状态变成公开 `PUBLISHED`。

## 6. 关键测试

- 同一个 `requestId` 连续调用 `gift` 两次，库存只能转移一次。
- 两个并发 `gift` 抢最后一个物品，最多一笔成功。
- 另一圈子成员用猜到的 `storyId` 请求详情，必须返回 `NOT_VISIBLE`。
- 作者关闭搞笑动作，`spin` 返回 `INTERACTION_DISABLED`。
- AI 队列达到预算或单人次数限制，返回 `BUDGET_EXCEEDED`/`RATE_LIMIT`，仍允许文字投稿。
- 用户撤回后，图鉴统计及他人已加载的缓存需要尽快失效。
