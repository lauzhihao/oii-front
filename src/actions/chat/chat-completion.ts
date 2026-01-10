/**
 * 聊天补全接口
 *
 * 调用后端 LangGraph 封装的通用聊天入口
 * 支持 AI Agent 流式通信协议 v1.0
 */

import { apiClient } from '@/lib/axios';

// ==================== 类型定义 ====================

/** 消息角色 */
export type MessageRole = 'system' | 'user' | 'assistant';

/** 任务类型 */
export type TaskType = 'character_design' | 'scene_design' | 'storyboard' | 'video_generate' | 'script_analysis' | 'generate_shots' | 'general';

/** 消息元数据 */
export interface MessageMetadata {
    /** 任务类型 */
    task?: TaskType;
    /** 剧本 URL */
    script_url?: string;
    /** 会话 ID（用于断点续聊） */
    session_id?: string;
    /** 其他扩展字段 */
    [key: string]: unknown;
}

/** 聊天消息 */
export interface ChatMessage {
    role: MessageRole;
    content: string;
    metadata?: MessageMetadata;
}

/** 聊天请求参数 */
export interface ChatCompletionRequest {
    /** 消息列表 */
    messages: ChatMessage[];
    /** 模型名称（可选，使用服务端默认配置） */
    model?: string;
    /** 温度 0-2 */
    temperature?: number;
    /** 最大生成 token 数 */
    max_tokens?: number;
    /** 是否流式响应 */
    stream?: boolean;
}

// ==================== 流式协议类型 ====================

/** 流式消息类型 */
export type StreamChunkType = 'message' | 'thinking' | 'tool_start' | 'tool_end' | 'canvas' | 'error';

/** 画布操作类型 */
export type CanvasAction =
    | 'add_character'
    | 'update_character'
    | 'add_character_concept'
    | 'add_scene'
    | 'add_storyboard'
    | 'add_script_overview'
    | 'set_script_overview'
    | 'update_script_overview'
    | 'connect'
    | 'highlight'
    | 'zoom_to'
    | 'clear';

/** 流式消息数据 */
export interface StreamChunkData {
    /** 动作标识 */
    action?: CanvasAction | string;
    /** 动作参数 */
    params?: Record<string, unknown>;
    /** 工具名称 */
    tool_name?: string;
    /** 执行结果 */
    result?: unknown;
    /** 错误码 */
    code?: string;
    /** 是否可重试 */
    retry_able?: boolean;
    /** 详细信息 */
    details?: string;
}

/** 流式消息块 */
export interface StreamChunk {
    /** 消息类型 */
    type: StreamChunkType;
    /** 文本内容 */
    content?: string;
    /** 结构化数据 */
    data?: StreamChunkData;
    /** 时间戳 */
    timestamp?: number;
}

/** 流式回调处理器 */
export interface StreamCallbacks {
    /** 收到消息文本 */
    onMessage?: (content: string) => void;
    /** 收到思考过程 */
    onThinking?: (content: string) => void;
    /** 工具开始调用 */
    onToolStart?: (toolName: string, content?: string) => void;
    /** 工具调用完成 */
    onToolEnd?: (toolName: string, result?: unknown) => void;
    /** 画布操作指令 */
    onCanvas?: (action: CanvasAction | string, params?: Record<string, unknown>) => void;
    /** 错误 */
    onError?: (content: string, code?: string, retryAble?: boolean) => void;
    /** 流式完成 */
    onDone?: () => void;
    /** 原始 chunk（用于调试或自定义处理） */
    onRawChunk?: (chunk: StreamChunk) => void;
}

// ==================== API 函数 ====================

/**
 * 发送聊天请求（流式）
 * 支持 AI Agent 流式通信协议
 */
export async function sendChatStream(
    request: ChatCompletionRequest,
    callbacks: StreamCallbacks
): Promise<void> {
    const baseURL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || '';

    const response = await fetch(`${baseURL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            // 从 localStorage 获取 token
            ...(typeof window !== 'undefined' && localStorage.getItem('accessToken')
                ? { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
                : {}),
        },
        body: JSON.stringify({
            ...request,
            stream: true,
        }),
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Chat request failed: ${response.status} ${response.statusText} ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        // 保留最后一个可能不完整的行
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (!line.startsWith('data: ')) continue;

            let data = line.slice(6).trim();

            // 兼容后端返回 "data: data: {...}" 的情况
            if (data.startsWith('data: ')) {
                data = data.slice(6).trim();
            }

            // 检查结束标记
            if (data === '[DONE]') {
                callbacks.onDone?.();
                return;
            }

            if (!data) continue;

            try {
                const chunk = JSON.parse(data) as StreamChunk;

                // 原始 chunk 回调
                callbacks.onRawChunk?.(chunk);

                // 根据类型分发
                switch (chunk.type) {
                    case 'message':
                        if (chunk.content) {
                            callbacks.onMessage?.(chunk.content);
                        }
                        break;

                    case 'thinking':
                        if (chunk.content) {
                            callbacks.onThinking?.(chunk.content);
                        }
                        break;

                    case 'tool_start':
                        if (chunk.data?.tool_name) {
                            callbacks.onToolStart?.(chunk.data.tool_name, chunk.content);
                        }
                        break;

                    case 'tool_end':
                        if (chunk.data?.tool_name) {
                            callbacks.onToolEnd?.(chunk.data.tool_name, chunk.data.result);
                        }
                        break;

                    case 'canvas':
                        if (chunk.data?.action) {
                            callbacks.onCanvas?.(chunk.data.action, chunk.data.params);
                        }
                        break;

                    case 'error':
                        callbacks.onError?.(
                            chunk.content || 'Unknown error',
                            chunk.data?.code,
                            chunk.data?.retry_able
                        );
                        break;
                }
            } catch (e) {
                console.warn('[chat-completion] Failed to parse chunk:', data, e);
            }
        }
    }

    callbacks.onDone?.();
}

/**
 * 创建 AbortController 用于取消请求
 */
export function createAbortController(): AbortController {
    return new AbortController();
}

/**
 * 发送可取消的聊天请求（流式）
 */
export async function sendChatStreamWithAbort(
    request: ChatCompletionRequest,
    callbacks: StreamCallbacks,
    abortController: AbortController
): Promise<void> {
    const baseURL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL || '';

    const response = await fetch(`${baseURL}/v1/chat/completions`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(typeof window !== 'undefined' && localStorage.getItem('accessToken')
                ? { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
                : {}),
        },
        body: JSON.stringify({
            ...request,
            stream: true,
        }),
        signal: abortController.signal,
    });

    if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Chat request failed: ${response.status} ${response.statusText} ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('Response body is not readable');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.startsWith('data: ')) continue;

                let data = line.slice(6).trim();

                // 兼容后端返回 "data: data: {...}" 的情况
                if (data.startsWith('data: ')) {
                    data = data.slice(6).trim();
                }

                // 检查结束标记
                if (data === '[DONE]') {
                    callbacks.onDone?.();
                    return;
                }

                if (!data) continue;

                try {
                    const chunk = JSON.parse(data) as StreamChunk;
                    callbacks.onRawChunk?.(chunk);

                    switch (chunk.type) {
                        case 'message':
                            if (chunk.content) callbacks.onMessage?.(chunk.content);
                            break;
                        case 'thinking':
                            if (chunk.content) callbacks.onThinking?.(chunk.content);
                            break;
                        case 'tool_start':
                            if (chunk.data?.tool_name) callbacks.onToolStart?.(chunk.data.tool_name, chunk.content);
                            break;
                        case 'tool_end':
                            if (chunk.data?.tool_name) callbacks.onToolEnd?.(chunk.data.tool_name, chunk.data.result);
                            break;
                        case 'canvas':
                            if (chunk.data?.action) callbacks.onCanvas?.(chunk.data.action, chunk.data.params);
                            break;
                        case 'error':
                            callbacks.onError?.(chunk.content || 'Unknown error', chunk.data?.code, chunk.data?.retry_able);
                            break;
                    }
                } catch (e) {
                    console.warn('[chat-completion] Failed to parse chunk:', data, e);
                }
            }
        }
    } finally {
        reader.releaseLock();
    }

    callbacks.onDone?.();
}

// ==================== 便捷函数 ====================

/**
 * 开始角色设计
 */
export async function startCharacterDesign(
    scriptUrl: string,
    callbacks: StreamCallbacks
): Promise<void> {
    const message: ChatMessage = {
        role: 'user',
        content: '请根据剧本开始角色设计',
        metadata: {
            task: 'character_design',
            script_url: scriptUrl,
            is_debug: true,
        },
    };

    const request: ChatCompletionRequest = {
        messages: [message],
    };

    await sendChatStream(request, callbacks);
}

/**
 * 开始剧本解析
 * 解析剧本内容，提取摘要、角色清单、分镜描述等
 */
export async function startScriptAnalysis(
    scriptUrl: string,
    callbacks: StreamCallbacks
): Promise<void> {
    const message: ChatMessage = {
        role: 'user',
        content: '请解析剧本内容，提取剧本摘要、角色清单和分镜描述',
        metadata: {
            task: 'script_analysis',
            script_url: scriptUrl,
            is_debug: true,
        },
    };

    const request: ChatCompletionRequest = {
        messages: [message],
    };

    await sendChatStream(request, callbacks);
}

/**
 * 开始生成分镜
 * 根据剧本和角色信息生成分镜列表
 */
export async function startGenerateShots(
    scriptUrl: string,
    callbacks: StreamCallbacks,
    charactersUrl?: string
): Promise<void> {
    const message: ChatMessage = {
        role: 'user',
        content: '请根据剧本和角色信息生成分镜列表',
        metadata: {
            task: 'generate_shots',
            script_url: scriptUrl,
            ...(charactersUrl && { characters_url: charactersUrl }),
            is_debug: true,
        },
    };

    const request: ChatCompletionRequest = {
        messages: [message],
    };

    await sendChatStream(request, callbacks);
}
