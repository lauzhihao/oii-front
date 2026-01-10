# 项目知识库

> 本文件记录项目相关的设计决策、协议约定、架构规范等重要信息。
> **修改规则**: AI 必须在用户明确同意后才能追加或修改本文件内容。

---

## 目录

- [1. AI Agent 流式通信协议](#1-ai-agent-流式通信协议)

---

## 1. AI Agent 流式通信协议

**版本**: v1.0
**创建时间**: 2026-01-08
**用途**: 短视频创作 AI Agent 前后端通信规范

### 1.1 基础信息

- **接口**: `POST /v1/chat/completions`
- **传输**: Server-Sent Events (SSE)
- **编码**: UTF-8 JSON

### 1.2 请求格式

```json
{
  "messages": [
    {
      "role": "user",
      "content": "用户输入的文本",
      "metadata": {
        "task": "character_design",
        "script_url": "https://xxx.com/script.md",
        "session_id": "可选，会话ID用于断点续聊"
      }
    }
  ],
  "stream": true
}
```

#### 任务类型 (metadata.task)

| task | 说明 |
|------|------|
| `character_design` | 角色设计 |
| `scene_design` | 场景设计 |
| `storyboard` | 分镜生成 |
| `video_generate` | 视频生成 |
| `general` | 通用对话（默认） |

### 1.3 响应格式 (SSE)

每行格式: `data: {JSON}\n\n`

结束标记: `data: [DONE]\n\n`

#### 消息类型定义

```typescript
interface StreamChunk {
  /** 消息类型 */
  type: 'message' | 'thinking' | 'tool_start' | 'tool_end' | 'canvas' | 'error';

  /** 文本内容（用于展示） */
  content?: string;

  /** 结构化数据（用于执行动作） */
  data?: {
    /** 动作标识 */
    action?: string;
    /** 动作参数 */
    params?: Record<string, unknown>;
    /** 工具名称（tool_start/tool_end 时使用） */
    tool_name?: string;
    /** 执行结果（tool_end 时使用） */
    result?: unknown;
  };

  /** 时间戳 */
  timestamp?: number;
}
```

#### 消息类型说明

| type | 用途 | 前端处理 |
|------|------|----------|
| `message` | AI 回复文本 | 显示在聊天气泡中，支持流式追加 |
| `thinking` | 思考过程 | 显示为淡色/折叠的思考气泡 |
| `tool_start` | 开始调用工具 | 显示工具调用指示器（loading） |
| `tool_end` | 工具调用完成 | 更新指示器状态，显示结果 |
| `canvas` | 画布操作指令 | 执行画布渲染/更新 |
| `error` | 错误信息 | 显示错误提示 |

### 1.4 画布操作指令 (canvas)

#### 指令列表

```typescript
type CanvasAction =
  | 'add_character'      // 添加角色卡片
  | 'update_character'   // 更新角色信息
  | 'add_scene'          // 添加场景
  | 'add_storyboard'     // 添加分镜
  | 'connect'            // 创建连接线
  | 'highlight'          // 高亮元素
  | 'zoom_to'            // 缩放到指定元素
  | 'clear';             // 清空画布
```

#### 指令参数示例

**添加角色**:
```json
{
  "type": "canvas",
  "data": {
    "action": "add_character",
    "params": {
      "id": "char_001",
      "name": "小明",
      "description": "25岁程序员，性格内向",
      "avatar_url": "https://xxx.com/avatar.png",
      "position": { "x": 100, "y": 200 }
    }
  }
}
```

**创建连接**:
```json
{
  "type": "canvas",
  "data": {
    "action": "connect",
    "params": {
      "source_id": "script_001",
      "target_id": "char_001",
      "label": "主角"
    }
  }
}
```

**高亮元素**:
```json
{
  "type": "canvas",
  "data": {
    "action": "highlight",
    "params": {
      "id": "char_001",
      "duration": 2000
    }
  }
}
```

### 1.5 完整交互示例

用户点击 START 开始角色设计，完整的 SSE 流：

```
data: {"type":"message","content":"@角色设计总监已就位，马上开工！"}

data: {"type":"thinking","content":"正在分析剧本结构..."}

data: {"type":"thinking","content":"识别到 3 个主要角色：小明、小红、老王"}

data: {"type":"tool_start","data":{"tool_name":"character_generator"},"content":"正在生成角色「小明」..."}

data: {"type":"canvas","data":{"action":"add_character","params":{"id":"char_001","name":"小明","description":"25岁，软件工程师","status":"generating"}}}

data: {"type":"tool_end","data":{"tool_name":"character_generator","result":{"avatar_url":"https://..."}}}

data: {"type":"canvas","data":{"action":"update_character","params":{"id":"char_001","avatar_url":"https://...","status":"completed"}}}

data: {"type":"message","content":"角色「小明」已生成完成！"}

data: {"type":"message","content":"接下来生成「小红」，请稍等..."}

data: [DONE]
```

### 1.6 错误处理

```json
{
  "type": "error",
  "content": "角色生成失败，请重试",
  "data": {
    "code": "GENERATION_FAILED",
    "retry_able": true,
    "details": "图像生成服务超时"
  }
}
```

#### 错误码

| code | 说明 | retry_able |
|------|------|------------|
| `RATE_LIMIT` | 请求频率限制 | true |
| `GENERATION_FAILED` | 生成失败 | true |
| `INVALID_SCRIPT` | 剧本格式错误 | false |
| `SERVICE_UNAVAILABLE` | 服务不可用 | true |

### 1.7 前端反馈接口（可选）

如果需要前端反馈执行结果给后端（如画布操作完成），可在后续消息中携带：

```json
{
  "messages": [...],
  "metadata": {
    "feedback": {
      "action_id": "canvas_add_character_001",
      "status": "success",
      "result": { "rendered_at": 1704672000 }
    }
  }
}
```

### 1.8 注意事项

1. **流式追加**: `message` 类型可能分多个 chunk 发送，前端需追加显示
2. **顺序保证**: SSE 保证消息顺序，前端按顺序处理即可
3. **幂等性**: `canvas` 操作应设计为幂等，相同 id 重复执行不会产生重复元素
4. **超时处理**: 建议前端设置 30s 超时，超时后提示用户

---

<!-- 后续知识条目在此追加 -->
