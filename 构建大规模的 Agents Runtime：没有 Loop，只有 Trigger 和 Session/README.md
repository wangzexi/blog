---
created_at: "2026-06-17 01:54:00 +0800"
updated_at: "2026-06-17 01:54:00 +0800"
---

# 构建大规模的 Agents Runtime：没有 Loop，只有 Trigger 和 Session

系统的核心只有两个状态转移函数。

**Agent 是一个状态转移函数**：`session' = step(session, model, tools?)`
它把当前 Session 交给 model，由 model 推理后决定下一步的 Session 长什么样。Agent 不循环、不常驻。它只在这个函数被调用时存在。

**Trigger 也是一个状态转移函数**：`session' = trigger(session, event)`
它把外部事件（用户消息、工具结果、定时器、Webhook 等）追加到 Session 中。Trigger 不调 model，不调工具，只负责更新 Session 的事件日志。

**Harness 是编排这它们的调度器。**每次 trigger 到来，由它执行一次完整的 load → trigger → step → save 生命周期，然后退出。

```
on trigger(session_id, event):
    session = load(session_id)
    session = trigger(session, event)        ← 注入事件
    session = step(session, model, tools?)    ← 模型处理
    save(session)
```

## 为什么容器不是 Agent

大部分框架的默认假设：一个 Agent = 一个容器。

```
Agent Loop + Browser + Terminal + Files 全部塞进同一个容器
```

问题是：生命周期完全不同的两种东西被绑在了一起。

一种是模型的思考：读消息、推理、决定调用工具。几十 MB 内存，挂了重启就行。

另一种是工具执行环境：Chrome、Node、Python、文件系统。几 GB，随时可能崩。

绑在一起带来两个问题：

**故障。** 容器崩了，状态和计算一起丢。

**资源。** 容器一直在线，Agent Loop 空等、工具环境空占，即使没有任务也在消耗资源。

解法是把两者拆开：状态（Session）持久化到存储，计算（模型推理、工具执行）按需拉起。

拆开之后，外部输入和模型推理自然变成两个独立的状态转移函数：Trigger 负责注入事件，Step 负责用模型更新 Session。两个函数各自独立、各自可替换、各自按需调度。


## 一切皆是 Trigger

**Trigger 是一个状态转移函数。输入 Session + 外部事件，输出更新后的 Session。**

```
trigger(session, event):
    session.events.append(event)
    return session
```

不调 Model，不调 Tool。就是纯粹的状态更新。所有外部交互都是 Trigger，没有例外。

| 场景 | Trigger 类型 |
|------|-------------|
| 用户发消息 | `UserMessage` |
| 工具执行完 | `ToolFinished` |
| 定时器触发 | `TimerExpired` |
| 外部系统回调 | `WebhookReceived` |
| 上下文快满了 | `ContextPressure` |
| 人工审批通过 | `HumanApproved` |
| 子 Agent 完成 | `AgentFinished` |


## 不再需要持续在线的 Agent Loop

传统 Agent 框架：

```
while True:
    think()
    act()
    observe()    ← 进程一直活着，占着内存，等着东西
```

这个模型：

```
不跑时 → 不存在
触发来 → 拉起 → 处理 → 保存 → 销毁
```

工具跑两小时：Model 已经下线了。用户三天没来：Session 在存储里，零资源消耗。

Agent 生命周期里没有"在线等待"这个状态。唯一的持久存在是 Session。

**这是大规模调度的前提。** 没有常驻的 Agent，就没有空转的资源。所有计算按需拉起、用完即毁。同一个 Harness 池可以服务数十万个 Session：谁被 trigger 唤醒就处理谁，处理完就接待下一个。资源利用率只取决于 trigger 频率，不取决于 Session 数量。


## Harness 是调度器

Harness 是整个运行时的调度器。它负责队列消费、触发优先级、状态持久化、现场恢复，以及编排两个状态转移函数。

Step 是 Harness 的执行单元。Model 是唯一必需的执行器，Tool 和 SubAgent 是可注入的能力：

```
纯对话 Agent：    step(session, model)
写代码 Agent：    step(session, model, [Terminal, FileSystem, Browser])
研究 Agent：      step(session, model, [Search, Browser, FileSystem])
```

从 Harness 视角看，SubAgent 就是一个 Tool：都是注入 step 的执行器，执行结果都以 trigger 返回。

一次 Harness 处理过程：

```
1. 从队列取出下一个 trigger
2. 恢复 Session（按策略：replay / summary / cold start）
   同时挂载 Workspace（外存，存放 Agent 产出的文件）
3. trigger 注入事件
4. step 调 Model、路由 Tool
   如果 model 发起工具调用，step 立即 dispatch 工具并结束。
   工具的结果通过触发器重新进入队列。
5. 写回 Session
6. 卸载 Workspace（可选）
7. 退出
```

Session 像内存，记录"做过什么、正在做什么"。Workspace 像外存，记录"产出了什么"——文件、代码、报告、数据。Workspace 不需要恢复，直接挂载即可。


## Trigger 的现场恢复

Session 存储在事件日志中（类似内存），Workspace 存储在文件系统中（类似外存）。恢复主要针对 Session——Workspace 直接挂载即可，不需要重建。

三种恢复方式，对应 Trigger 加载 Session 的三种策略：

**Replay**：把完整的对话历史加载到 Session 中。适合短时间中断（KV Cache 还在，消息未冷）。

```
trigger_replay(session_id, event):
    session = load_full_history(session_id)
    session.events.append(event)
    return session
```

**Summary**：只加载压缩后的摘要，不加载完整历史。适合几小时到一天的中断。

```
trigger_summary(session_id, event):
    session = load_summary(session_id)
    session.events.append(event)
    return session
```

**Cold Start**：不加载 Session，只挂载 Workspace。Agent 通过读取工作区文件自己恢复现场。适合一天以上的中断。

```
trigger_cold_start(session_id, event):
    session = load_workspace(session_id)
    session.events.append(event)
    return session
```

恢复策略也可以由 Agent 自己提议。Agent 挂起前可以告诉 Harness 下次怎么唤醒它：

```json
{
  "trigger": "ToolFinished",
  "resume_policy": {
    "strategy": "replay",
    "include_recent_events": 20
  }
}
```

Harness 有最终裁决权：Agent 提议，Harness 根据成本和时间间隔降级。

## Context 压力也是 Trigger

Session 会膨胀。100 万条 Event 之后，模型吃不下。

Harness 不替 Model 压缩，只提供信号：

```
ContextWindow 紧张
  → Trigger 发 ContextPressure 信号
  → Model 收到信号，自己决定怎么总结、压缩、归档
```

## 最终形态

系统只有三个角色：

- **Agent** = **`session' = step(session, model, tools?)`**。不循环、不常驻。
- **Trigger** = **`session' = trigger(session, event)`**。统一外部输入。
- **Harness** = 编排以上两个函数的调度器。一次 trigger 一次处理，处理完退出。

## 附录：Anthropic 的架构也走到这里

Anthropic 在 2026 年 4 月的 Engineering Blog《[Scaling Managed Agents: Decoupling the brain from the hands](https://www.anthropic.com/engineering/managed-agents)》里把 Agent 拆成了三样东西：Session、Harness、Sandbox。

他们没有走到"Agent 是状态转移函数"这一步，但每一个设计决策：Session 持久化、Harness 无状态、Sandbox 远程化、事件驱动唤醒，都是同一个抽象的不同投影。
