# 解剖战损人体 · 基础组件 01

> 可动的双风格骨骼肌肉框架（解剖示意 / Q 版骷髅）+ 群友受伤分布 + 大模型流式讲解与调侃。
> 摔友记从「Q 版骷髅热点」升级为解剖级战损图鉴的地基。

```bash
npm run anatomy        # → http://localhost:7788
npm run anatomy:qa     # 36 项自动化回归（自建临时服务，不接真模型）
```

## 组件分层

| 层 | 文件 | 职责 |
|---|---|---|
| 人体模型层·数据 | `public/anatomy-data.mjs` | 14 个解剖区域的结构化卡片（骨骼 / 肌肉与分工 / 协作方式 / 常见损伤）、记录校验、分布聚合。**是 AI prompt 的事实来源，防幻觉** |
| 人体模型层·画法（共享） | `public/anatomy-art-shared.mjs` | 双描骨骼线、平滑肌块、长骨/骨骺、椎骨链、覆盖层元素等绘制原语 |
| 人体模型层·画法（标准解剖） | `public/anatomy-art-standard.mjs` | 约 7 头身的解剖学画法：颅骨（颅顶/眶/鼻切迹/颧/齿/下颌）、颈椎、9 对肋 + 胸骨柄体剑突、真骨盆（髂骨翼/耻骨弓/闭孔/髋臼）、带骨骺的长骨、腕-掌-指骨分节、跗-跖-趾骨；肌肉按起止走向（胸大肌扇形、腹直肌腱划、股四头肌三束、斜方菱形、背阔翼、腘绳双束、腓肠双头 + 跟腱） |
| 人体模型层·画法（Q 版骷髅） | `public/anatomy-art-q.mjs` | 约 4 头身、与小程序 Q 版角色同调性：大头短肢、圆钝骨骺、简化但保真的短肋弓/迷你骨盆/双节指骨 |
| 运动层 | `public/anatomy-rig.mjs` | 关节角度引擎：待机呼吸/重心晃动为程序化姿势；动作 = 关键帧插值。**关节几何与动作角度由各风格模块提供**（同一关节 id，标准版手臂长所以挥手用肘部带动，Q 版整臂高举） |
| 可视化层 | `public/anatomy-app.mjs` + `anatomy.css` + `index.html` | 风格切换（标准/Q 版）、正/背、骨骼/肌肉/双层、受伤热力（5 档）与徽标、部位卡片、战损榜、记录表单 |
| AI 解说层 + 数据网关 | `server.mjs` | 静态托管；记录 API；**LLM 流式代理（key 只在服务端）**；上游 SSE → 纯文本分块转发；无 key 或失败时降级为本地模板，且同样按打字机节奏流出 |

设计要点：

- **双风格，同一份语义**：两种画法导出同一接口（`buildBodyMarkup / getOverlays / JOINTS / ACTIONS`），共用同一套部位热区与战损数据——标准版负责“讲清楚”，Q 版负责“玩起来”。
- **视图无关的数据**：解剖卡片是纯数据，渲染只是它的投影。给大模型的 prompt 也由它拼装，讲解不越界。
- **动画是展示层**：所有姿势都是关节角度，不影响记录与分布的事实数据；`prefers-reduced-motion` 时幅度降到 25%。动作角度按风格肢体长度分别校准过（标准版 250px 的手臂整臂上举会出画，所以挥手改为肘部带动）。
- **调侃有边界**：prompt 强制「只损行为不攻击人身、结尾必须带安全提醒」；匿名记录在进入 prompt 前就脱敏成「匿名群友」。

## HTTP API

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/health` | 服务与大模型接入状态 |
| GET | `/api/anatomy` | 14 张解剖卡片 |
| GET | `/api/records` | 全量记录 + 分布聚合 |
| POST | `/api/records` | **外部注入**：`{member, regionId, severity(1-5), sport?, note?, happenedAt?, anonymous?}`，字段校验后返回全量数据 |
| DELETE | `/api/records/:id` | 删除一条 |
| POST | `/api/ai/explain` | `{regionId}` → **流式**（text/plain 分块）讲解“骨骼与肌肉如何协作” |
| POST | `/api/ai/roast` | `{regionId, scope:'region'}` 或 `{scope:'whole'}` → 流式吐槽 |

AI 端点响应头 `x-degraded: 0|1` 标识是否为离线兜底；正文为流式纯文本，浏览器边收边渲染（实测 deepseek-v4.1-flash 首包约 1.8s，52 个分片平滑流出）。

外部注入示例（群机器人 / 定时任务可用）：

```bash
curl -X POST http://localhost:7788/api/records \
  -H 'content-type: application/json' \
  -d '{"member":"老白","regionId":"knee","severity":3,"sport":"单板滑雪","note":"又卡刃了"}'
```

记录持久化在 `anatomy-web/data/records.json`（已在 .gitignore，删掉后下次启动重新生成种子）。

## 大模型配置

服务端按以下顺序找 key（浏览器永远拿不到）：

1. 环境变量 `OLLAMA_API_KEY`
2. `OLLAMA_ENV_FILE` 指定的 .env 文件（默认 `~/mcpgwpg/.env`）里的 `OLLAMA_API_KEY`

模型与端点：`ANATOMY_MODEL`（默认 `deepseek-v4.1-flash:1017`）、`OLLAMA_BASE_URL`（默认 `https://ollama.com`，OpenAI 兼容端点，`stream: true`）。没配 key 时页面顶部显示「离线示例模式」，讲解/调侃返回本地模板文案并模拟打字机流出，交互链路照样可测。

## 回归

`npm run anatomy:qa` 自建临时服务（独立端口 + 临时数据文件 + 无 LLM key），36 项断言覆盖：

- 服务面：health / 卡片数量 / 非法记录拒绝 / 注入-删除往返 / 404
- 结构面：16 关节组、21 热区、种子徽标
- **视觉面（双风格）**：冻结动画后把 SVG 光栅化，在颅骨/胸骨/髌骨/颈椎/跟骨/胸大肌/腹直肌/股直肌/斜方肌/臀大肌/腓肠肌等实心形状内部取色断言——不依赖肉眼；Q 版单独一组采样
- 交互面：点膝出卡片、AI 流式离线兜底 + 降级标记、表单注入徽标 +1、摔倒/挥手动作起播与归位（两种风格）、背面视图
- 产出文档截图 `preview/screens/anatomy-*.png`（标准正/背、双层面板、Q 版）

## 后续接入路径

- **小程序**：`web-view` 直接嵌本页（域名需备案进白名单）；或降级方案——把 `anatomy-data` 的卡片与聚合逻辑原样搬进小程序，用现有 `skeleton-map` 组件做静态版。
- **3D**：解剖卡片与记录 schema 均为视图无关数据；接 3D 时只需新写一个渲染器消费同一份 `anatomy-data`。
- **流式增强**：当前已是逐字流出；如需中止/重生成，前端加 AbortController 即可，服务端无需改动。
