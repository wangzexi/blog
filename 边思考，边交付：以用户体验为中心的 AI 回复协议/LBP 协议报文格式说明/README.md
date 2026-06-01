> 创建: 2025/6/30 15:07:36  |  修改: 2025/7/10 16:56:01

# LBP 协议报文格式说明

## 1. 核心概念

协议围绕以下核心概念构建：`BlockEvent`、`Op` 和 `Block`。

### 1.1. BlockEvent

`BlockEvent` 是协议的基本通信单元，表示对内容块的单次操作。其结构如下：

```TypeScript
type BlockEvent = {
  op: "create" | "update" | "remove";  // 操作类型
  id: string;                          // 块标识符
  ts: number;                          // 时间戳（毫秒级 Unix 时间戳）
  block?: Block;                       // 内容负载
}

```

#### 字段说明：

- **`op`**: 操作类型，指定对块的操作，`"create"`表示创建，`"update"`表示更新，`"remove"`表示删除。

- **`id`**: 块的唯一标识符，用于引用块。

- **`ts`**: 时间戳（毫秒级 Unix 时间戳），表示操作发生的时间。

- **`block`**: 内容负载，具体的数据根据块类型（如文本、图片、视频等）不同而不同。


### 1.2. Op 操作类型

`op` 字段指定块的操作类型，包含三种：

- **`create`**: 创建新的块，必须提供 `block` 字段。

- **`update`**: 更新已存在的块，`block` 字段包含更新后的内容。

- **`remove`**: 删除已存在的块，`block` 可选。


### 1.3. Block

`Block` 定义了块的实际内容。协议支持一系列标准块类型，也可扩展自定义块类型。

```TypeScript
type Block =
	MarkdownBlock
  | ImageBlock
  | VideoBlock
  | ThinkBlock
  | MetaBlock;
```

每个 `Block` 类型包含一个 `type` 字段，表示块的类型，具体块类型将在第4节详细介绍。

---

## 2. 交互流程

客户端与 LLM 服务器之间通过流式事件进行通信，流程如下：

1. 客户端向服务器发送用户消息（例如 HTTP 请求）。

2. 服务器开始处理消息并生成回复。

3. 服务器通过事件流实时向客户端发送 `BlockEvent`。

4. 客户端接收事件并更新 UI。


以下是事件流的示意图：

![image](assets/176166736468.svg)

这种流式方法使得内容可以逐步显示，显著改善用户体验。

---

## 3. 标准块类型

协议定义了以下几种标准块类型，适用于常见的业务场景：

### 3.1. MarkdownBlock

用于渲染支持 Markdown 格式的文本。

```TypeScript
type MarkdownBlock = {
  type: "markdown";
  content?: string;  // 文本内容
}

```

### 3.2. ImageBlock

用于显示图片。

```TypeScript
type ImageBlock = {
  type: "image";
  url?: string | null;  // 图片的 URL
  desc?: string;        // 图片描述
}

```

### 3.3. VideoBlock

用于显示视频内容。

```TypeScript
type VideoBlock = {
  type: "video";
  url?: string;        // 视频 URL
  title?: string;      // 视频标题
  desc?: string;       // 视频描述
  thumbnail?: string;  // 视频缩略图
}

```

### 3.4. ThinkBlock

用于显示思考过程，支持内容流式更新。

```TypeScript
type ThinkBlock = {
  type: "think";
  content?: string;  // 思考内容
}

```

### 3.5. MetaBlock

一个通用块，用于传输任意元数据。

```TypeScript
type MetaBlock = {
  type: "meta";
  [key: string]: any;  // 自定义数据
}

```

---

## 4. 扩展性：自定义卡片

LLM Block Protocol 设计为可扩展的，支持自定义块类型。要定义新的块类型：

1. **定义 Block 结构**：为自定义块创建 `type` 字段并定义其结构。
```TypeScript
type WeatherBlock = {
  type: "weather";  // 自定义类型名称
  location: string;
  temperature: number;
  unit: "celsius" | "fahrenheit";
  forecast: string;
}

```

2. **更新 Block 类型**：将自定义块类型添加到 `Block` 联合类型中。
```TypeScript
type Block =
	MarkdownBlock
  | ImageBlock
  | VideoBlock
  | ThinkBlock
  | MetaBlock
	| WeatherBlock;  // 添加自定义块类型

```


1. **更新客户端和服务器端逻辑**：客户端需实现自定义块的渲染逻辑，服务器端需生成相应的 `BlockEvent`。


---

## 5. 完整示例

以下是一个完整的交互示例，展示用户发送消息并接收多个 `BlockEvent`。

**用户消息**: "请为我解释一个技术概念"

**服务器响应 (BlockEvent 流)**:

1. 创建思考块：
```JSON
{
  "op": "create",
  "id": "think-123",
  "ts": 1678886400000,
  "block": {
    "type": "think",
    "content": "让我整理一下相关概念..."
  }
}

```

2. 创建 Markdown 块：
```JSON
{
  "op": "create",
  "id": "md-456",
  "ts": 1678886401000,
  "block": {
    "type": "markdown",
    "content": "这个概念可以这样理解："
  }
}

```

3. 更新思考块：
```JSON
{
  "op": "update",
  "id": "think-123",
  "ts": 1678886403000,
  "block": {
    "type": "think",
    "content": "考虑到多个因素，我的结论是..."
  }
}

```


客户端按顺序接收并渲染这些块，提供互动的用户体验。

---

## 6. 应用实践建议

### 6.1. 聊天记录的存储与恢复

建议将 `BlockEvent` 的历史记录进行规约，存储最终状态（块的快照），而非每个 `create`、`update`、`remove` 事件。这样可以减少存储和加载复杂度。

### 6.2. 卡片渲染耗时计算

**卡片渲染耗时**应当根据 **第一个 create** 和 **最后一个 update** 事件之间的时间差来计算。这可以帮助我们评估卡片从创建到最终更新所花费的总时间。

### 6.3. 卡片顺序

客户端应根据所有 **`create`** 事件的时间戳 (`ts`) 来排序这些事件，以确保卡片按正确的顺序展示。即，最早的 `create` 事件将决定该卡片的展示顺序。
