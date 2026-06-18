---
created_at: "2026-06-18 12:56:00 +0800"
updated_at: "2026-06-18 12:56:00 +0800"
---

# 拆解 Multica 功能设计：iPhone 时代前的黑莓手机

本文来自一个下午：我克隆了 [multica-ai/multica](https://github.com/multica-ai/multica)，一个开源 Managed Agents 平台，36K stars。

Multica 是一个"把 Agent 变成队友"的平台。核心是看板，人创建 Issue 分配给 Agent，Agent 自动执行。

下面逐一思考它的每个设计点。不问"这听起来酷不酷"，只看"在真实使用中，这个东西真的需要吗"。

## Squads（小队）

Multica 把多个 Agent 编成小组，指定一个 Leader Agent 来分配任务。

Agent 是全能的，不需要"分配合适的人"这个问题。Agent 之间是调用关系，不是协作关系。人类团队的民主协作模式依赖成员间的多样性，但模型本质上都是同源数据训练出来的，不存在人类个体那种多样性。小队这个抽象不存在。

**结论：不需要。**

## Agent 互相 @

Multica 允许 Agent 之间互 @ 委派工作。

Agent 是执行器，不是社交角色。执行器之间只有调用和被调用，不需要互相喊话。

Agent 之间也不需要消息通道。Agent A 写完代码 commit 到 Git，Agent B 读 diff 就知道发生了什么。消息的带宽远小于直接读工作现场，Git 本身就是 Agent 之间最好的通信协议。

**结论：不需要。**

## Kanban Board（看板）

Multica 用看板跟踪任务进度（TODO → Doing → Done）。

人类任务以天/周为单位，需要看板跟踪进度。Agent 任务几分钟到三五小时，要么在跑，要么跑完了。TODO → Doing → Done 的中间状态几乎不停留。

看板退化为一个审批队列——Agent 产出不一定是代码，可能是分析报告、配置变更、运维操作，排在这里等人确认或驳回。

**结论：不需要。**

## Skills（技能）

Multica 把可复用的说明文档绑定到 Agent 上，执行时注入。

通用技能模型会内化，不需要你写。**具体的 Skill 才有价值。** Skill 应该放在 `项目/.agents/` 里，跟着代码版本控制，而不是放到全局平台。

**结论：不需要。**

## Multi-Provider

Multica 支持 10 多个 coding agent（Claude Code、Codex、Gemini……），每个独立适配。

所有 coding agent 本质是同一个 ReAct Loop，区别只在模型 API 和几个参数。通用抽象就够了，差异收敛到配置层。支持 10 个 Agent 是抽象没做干净，不是产品优势。

**结论：不需要。**

## Autopilot（定时触发）

Multica 支持按 Cron 定时创建 Issue 分配给 Agent。

定时创建 Issue 本质是一个 Cron。

**结论：需要。**

## Runtime Daemon

Multica 用本地常驻进程轮询认领任务、流式回传输出。

Agent 需要执行环境。但不需要常驻进程做心跳、轮询、GC。按需拉起，用完即毁就够了。

**结论：需要。**


## 剩下什么

- **Squads**： 不需要
- **Agent 互相 @**： 不需要
- **Kanban Board**： 不需要
- **Skills 平台**： 不需要
- **Multi-Provider**： 不需要
- **Autopilot**： 需要
- **Runtime Daemon**： 需要

去掉不必要的，剩下的东西很薄：

- **任务触发**： 用户消息、定时器
- **Agent 执行**： 模型推理和调用工具
- **技能**： 在项目目录里
- **人类评审**： 审批列表

## 结语

Agent 本身不需要被管理。不需要名字、头像、profile、小队、角色、看板。人就是主程序员，Agent 是工具，是执行器。管理 Agent 产出的人类评审队列，才是产品该做的事。

Multica 让 Agent 套用人类的协作方式，就像黑莓手机套用电脑的 QWERTY 键盘。

![BlackBerry QWERTY keyboard phone](assets/1.jpeg)
