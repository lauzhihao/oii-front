# Daoer API 文档

## 基础信息

- **Base URL**: `https://df.jwd.group/daoer-api`
- **认证方式**: API Key (可选，未配置时无需认证)
    - Header: `Authorization: Bearer <api_key>` 或 `X-API-Key: <api_key>`

  ---

## 接口列表

### 1. 健康检查

**GET** `/health`

检查服务是否正常运行。

**响应示例**:
  ```json
  {
    "status": "ok"
  }
```
  ---
  2. COS 预签名上传

  POST /api/cos/presign

  生成腾讯云 COS 预签名 URL，用于客户端直传文件。

  请求体:
  ```json
  {
    "key": "uploads/2024/01/example.jpg",
    "content_type": "image/jpeg",
    "expires": 3600
  }
```
  | 字段         | 类型    | 必填 | 说明                                          |
  |--------------|---------|------|-----------------------------------------------|
  | key          | string  | 是   | 文件在存储桶中的路径                          |
  | content_type | string  | 否   | 文件 MIME 类型，默认 application/octet-stream |
  | expires      | integer | 否   | URL 有效期(秒)，默认 3600，范围 60-86400      |

  响应示例:
  {
    "url": "https://bucket.cos.ap-beijing.myqcloud.com/uploads/...",
    "method": "PUT",
    "headers": {
      "Content-Type": "image/jpeg"
    },
    "expires_at": 1704672000
  }

  前端上传示例:
  // 1. 获取预签名 URL
  const presign = await fetch('/daoer-api/api/cos/presign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      key: `uploads/${Date.now()}.jpg`,
      content_type: file.type
    })
  }).then(r => r.json());

  // 2. 直传文件到 COS
  await fetch(presign.url, {
    method: 'PUT',
    headers: presign.headers,
    body: file
  });

  ---
  3. 聊天补全 (OpenAI 兼容)

  POST /v1/chat/completions

  OpenAI 兼容的聊天接口，支持流式响应 (SSE)。

  请求体:
  {
    "model": "gpt-4o-mini",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user", "content": "Hello!"}
    ],
    "temperature": 0.7,
    "max_tokens": 1000,
    "stream": false
  }

  | 字段               | 类型    | 必填 | 说明                          |
  |--------------------|---------|------|-------------------------------|
  | model              | string  | 否   | 模型名称，默认使用服务端配置  |
  | messages           | array   | 是   | 消息列表                      |
  | messages[].role    | string  | 是   | 角色: system, user, assistant |
  | messages[].content | string  | 是   | 消息内容                      |
  | temperature        | number  | 否   | 温度 0-2，默认 0.7            |
  | max_tokens         | integer | 否   | 最大生成 token 数             |
  | stream             | boolean | 否   | 是否流式响应，默认 false      |
  | top_p              | number  | 否   | Top-p 采样 0-1，默认 1.0      |

  非流式响应 (stream: false):
  {
    "id": "chatcmpl-abc123",
    "object": "chat.completion",
    "created": 1704672000,
    "model": "gpt-4o-mini",
    "choices": [
      {
        "index": 0,
        "message": {
          "role": "assistant",
          "content": "Hello! How can I help you today?"
        },
        "finish_reason": "stop"
      }
    ],
    "usage": {
      "prompt_tokens": 20,
      "completion_tokens": 10,
      "total_tokens": 30
    }
  }

  流式响应 (stream: true):

  返回 SSE (Server-Sent Events) 格式:

  data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1704672000,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"role":"assistant"},"finish_reason":null}]}

  data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1704672000,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"content":"Hello"},"finish_reason":null}]}

  data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1704672000,"model":"gpt-4o-mini","choices":[{"index":0,"delta":{"content":"!"},"finish_reason":null}]}

  data: [DONE]

  前端流式调用示例:
  const response = await fetch('/daoer-api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: 'Hello!' }],
      stream: true
    })
  });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value);
    const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

    for (const line of lines) {
      const data = line.slice(6);
      if (data === '[DONE]') break;

      const parsed = JSON.parse(data);
      const content = parsed.choices[0]?.delta?.content;
      if (content) {
        console.log(content); // 逐字输出
      }
    }
  }

  ---
  错误响应

  所有接口错误返回统一格式:

  {
    "detail": "错误描述信息"
  }

  | HTTP 状态码 | 说明                  |
  |-------------|-----------------------|
  | 401         | 未授权 (API Key 无效) |
  | 422         | 请求参数验证失败      |
  | 500         | 服务器内部错误        |
  | 503         | 服务不可用 (配置缺失) |