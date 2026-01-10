'use client';

import * as React from 'react';
import {
    startScriptAnalysis,
    startCharacterDesign as startCharacterDesignAPI,
    startGenerateShots as startGenerateShotsAPI,
    type StreamCallbacks,
    type CanvasAction,
} from '@/actions/chat/chat-completion';
import { useCreateStore } from '../stores/create-store';

// ==================== 类型定义 ====================

/** 聊天消息类型 */
export type ChatMessageType = 'message' | 'thinking' | 'tool' | 'error' | 'user' | 'canvas';

/** 工具状态 */
export type ToolStatus = 'running' | 'done' | 'failed';

/** 聊天消息 */
export interface ChatMessageItem {
    id: string;
    type: ChatMessageType;
    content: string;
    /** 工具名称（tool类型专用） */
    toolName?: string;
    /** 工具状态（tool类型专用） */
    toolStatus?: ToolStatus;
    /** 工具结果 */
    toolResult?: unknown;
    /** 错误码 */
    errorCode?: string;
    /** 是否可重试 */
    retryAble?: boolean;
    /** 时间戳 */
    timestamp: number;
    /** Canvas 动作数据（canvas类型专用） */
    canvasData?: {
        action: string;
        params?: Record<string, unknown>;
    };
}

/** 流式状态 */
export type StreamStatus = 'idle' | 'streaming' | 'error';

/** 画布事件 */
export interface CanvasEvent {
    action: CanvasAction | string;
    params?: Record<string, unknown>;
    timestamp: number;
}

/** 画布事件监听器 */
export type CanvasEventListener = (event: CanvasEvent) => void;

/** CreateContext 的值类型 */
interface CreateContextProps {
    // 步骤控制
    step: string;
    setStep: (step: string) => void;

    // 聊天消息
    messages: ChatMessageItem[];
    addMessage: (message: Omit<ChatMessageItem, 'id' | 'timestamp'>) => void;
    clearMessages: () => void;

    // 流式状态
    streamStatus: StreamStatus;

    // 开始剧本解析
    startDesign: (scriptUrl: string) => Promise<void>;

    // 开始角色设计
    startCharacterDesign: (scriptUrl: string) => Promise<void>;

    // 开始生成分镜
    startGenerateShots: (scriptUrl: string, charactersUrl?: string) => Promise<void>;

    // 停止当前流式请求
    stopStream: () => void;

    // 画布事件
    subscribeCanvasEvent: (listener: CanvasEventListener) => () => void;
}

// ==================== Context ====================

const CreateContext = React.createContext<CreateContextProps | null>(null);

/**
 * useCreate Hook
 */
export function useCreate(): CreateContextProps {
    const context = React.useContext(CreateContext);
    if (!context) {
        throw new Error('useCreate must be used within a CreateProvider');
    }
    return context;
}

// ==================== Provider ====================

interface CreateProviderProps {
    children: React.ReactNode;
    initialStep?: string;
}

/**
 * CreateProvider 组件
 * 管理聊天状态、流式响应、画布事件分发
 */
export function CreateProvider({
    children,
    initialStep = 'init',
}: CreateProviderProps) {
    // 步骤状态
    const [step, setStep] = React.useState(initialStep);

    // 聊天消息列表
    const [messages, setMessages] = React.useState<ChatMessageItem[]>([]);

    // 流式状态
    const [streamStatus, setStreamStatus] = React.useState<StreamStatus>('idle');

    // AbortController 用于取消请求
    const abortControllerRef = React.useRef<AbortController | null>(null);

    // 画布事件监听器
    const canvasListenersRef = React.useRef<Set<CanvasEventListener>>(new Set());

    // 生成消息 ID
    const generateMessageId = React.useCallback(() => {
        return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    }, []);

    // 添加消息
    const addMessage = React.useCallback((message: Omit<ChatMessageItem, 'id' | 'timestamp'>) => {
        const newMessage: ChatMessageItem = {
            ...message,
            id: generateMessageId(),
            timestamp: Date.now(),
        };
        setMessages(prev => [...prev, newMessage]);
    }, [generateMessageId]);

    // 更新现有消息（按条件查找并更新）
    const updateMessage = React.useCallback((
        predicate: (msg: ChatMessageItem) => boolean,
        updater: (msg: ChatMessageItem) => ChatMessageItem
    ) => {
        setMessages(prev => prev.map(msg => predicate(msg) ? updater(msg) : msg));
    }, []);

    // 替换或添加消息（按条件查找，找到则替换，否则添加）
    const upsertMessage = React.useCallback((
        predicate: (msg: ChatMessageItem) => boolean,
        message: Omit<ChatMessageItem, 'id' | 'timestamp'>
    ) => {
        setMessages(prev => {
            const existingIndex = prev.findIndex(predicate);
            if (existingIndex !== -1) {
                // 替换现有消息，保留原id
                const updated = [...prev];
                updated[existingIndex] = {
                    ...message,
                    id: prev[existingIndex].id,
                    timestamp: Date.now(),
                };
                return updated;
            } else {
                // 添加新消息
                return [...prev, {
                    ...message,
                    id: generateMessageId(),
                    timestamp: Date.now(),
                }];
            }
        });
    }, [generateMessageId]);

    // 清空消息
    const clearMessages = React.useCallback(() => {
        setMessages([]);
    }, []);

    // 订阅画布事件
    const subscribeCanvasEvent = React.useCallback((listener: CanvasEventListener) => {
        canvasListenersRef.current.add(listener);
        // 返回取消订阅函数
        return () => {
            canvasListenersRef.current.delete(listener);
        };
    }, []);

    // 分发画布事件
    const dispatchCanvasEvent = React.useCallback((action: CanvasAction | string, params?: Record<string, unknown>) => {
        const event: CanvasEvent = {
            action,
            params,
            timestamp: Date.now(),
        };
        canvasListenersRef.current.forEach(listener => {
            try {
                listener(event);
            } catch (e) {
                console.error('[CreateProvider] Canvas event listener error:', e);
            }
        });
    }, []);

    // 停止流式请求
    const stopStream = React.useCallback(() => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
        setStreamStatus('idle');
    }, []);

    // 开始剧本解析
    const startDesign = React.useCallback(async (scriptUrl: string) => {
        // 如果正在流式响应，先停止
        if (streamStatus === 'streaming') {
            stopStream();
        }

        // 自动打开聊天窗口
        useCreateStore.getState().setChatOpen(true);

        // 添加用户消息
        addMessage({
            type: 'user',
            content: '开始剧本解析',
        });

        setStreamStatus('streaming');

        // 创建 AbortController
        abortControllerRef.current = new AbortController();

        const callbacks: StreamCallbacks = {
            onMessage: (content) => {
                // 每条message独立添加为消息气泡
                addMessage({
                    type: 'message',
                    content,
                });
            },
            onThinking: (content) => {
                // thinking消息：替换现有的thinking，只保留最新一条
                upsertMessage(
                    (msg) => msg.type === 'thinking',
                    { type: 'thinking', content }
                );
            },
            onToolStart: (toolName, content) => {
                // tool_start：按toolName替换，同一工具只显示最新状态
                upsertMessage(
                    (msg) => msg.type === 'tool' && msg.toolName === toolName,
                    {
                        type: 'tool',
                        content: content || `Calling ${toolName}...`,
                        toolName,
                        toolStatus: 'running',
                    }
                );
            },
            onToolEnd: (toolName, result) => {
                // tool_end：更新对应工具的状态为完成
                const hasError = result && typeof result === 'object' && 'error' in result;
                updateMessage(
                    (msg) => msg.type === 'tool' && msg.toolName === toolName,
                    (msg) => ({
                        ...msg,
                        content: hasError ? `${toolName} failed` : `${toolName} completed`,
                        toolStatus: hasError ? 'failed' : 'done',
                        toolResult: result,
                        timestamp: Date.now(),
                    })
                );
            },
            onCanvas: (action, params) => {
                // 分发画布事件
                dispatchCanvasEvent(action, params);

                // 如果是添加角色操作，同时添加一条 canvas 消息到聊天
                if (action === 'add_character' && params) {
                    const name = params.name as string || 'Unknown';
                    addMessage({
                        type: 'canvas',
                        content: `Added character: ${name}`,
                        canvasData: {
                            action,
                            params,
                        },
                    });
                }

                // 如果是设置/添加剧本概览操作，添加一条 canvas 消息到聊天
                if ((action === 'set_script_overview' || action === 'add_script_overview') && params) {
                    const title = params.title as string || 'Script Overview';
                    addMessage({
                        type: 'canvas',
                        content: `Script analysis completed: ${title}`,
                        canvasData: {
                            action,
                            params,
                        },
                    });
                }

                // 如果是更新剧本概览操作，添加一条 canvas 消息到聊天
                if (action === 'update_script_overview' && params) {
                    addMessage({
                        type: 'canvas',
                        content: 'Script analysis updated',
                        canvasData: {
                            action,
                            params,
                        },
                    });
                }
            },
            onError: (content, code, retryAble) => {
                addMessage({
                    type: 'error',
                    content,
                    errorCode: code,
                    retryAble,
                });
                setStreamStatus('error');
            },
            onDone: () => {
                setStreamStatus('idle');
                abortControllerRef.current = null;
            },
        };

        try {
            await startScriptAnalysis(scriptUrl, callbacks);
        } catch (error) {
            // 如果是用户主动取消，不显示错误
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('[CreateProvider] Stream aborted by user');
                return;
            }

            console.error('[CreateProvider] startDesign error:', error);
            addMessage({
                type: 'error',
                content: error instanceof Error ? error.message : 'Unknown error',
            });
            setStreamStatus('error');
        }
    }, [streamStatus, stopStream, addMessage, upsertMessage, updateMessage, dispatchCanvasEvent]);

    // 开始角色设计
    const startCharacterDesign = React.useCallback(async (scriptUrl: string) => {
        // 如果正在流式响应，先停止
        if (streamStatus === 'streaming') {
            stopStream();
        }

        // 自动打开聊天窗口
        useCreateStore.getState().setChatOpen(true);

        // 添加用户消息
        addMessage({
            type: 'user',
            content: '开始角色设计',
        });

        setStreamStatus('streaming');

        // 创建 AbortController
        abortControllerRef.current = new AbortController();

        const callbacks: StreamCallbacks = {
            onMessage: (content) => {
                addMessage({
                    type: 'message',
                    content,
                });
            },
            onThinking: (content) => {
                upsertMessage(
                    (msg) => msg.type === 'thinking',
                    { type: 'thinking', content }
                );
            },
            onToolStart: (toolName, content) => {
                upsertMessage(
                    (msg) => msg.type === 'tool' && msg.toolName === toolName,
                    {
                        type: 'tool',
                        content: content || `Calling ${toolName}...`,
                        toolName,
                        toolStatus: 'running',
                    }
                );
            },
            onToolEnd: (toolName, result) => {
                const hasError = result && typeof result === 'object' && 'error' in result;
                updateMessage(
                    (msg) => msg.type === 'tool' && msg.toolName === toolName,
                    (msg) => ({
                        ...msg,
                        content: hasError ? `${toolName} failed` : `${toolName} completed`,
                        toolStatus: hasError ? 'failed' : 'done',
                        toolResult: result,
                        timestamp: Date.now(),
                    })
                );
            },
            onCanvas: (action, params) => {
                dispatchCanvasEvent(action, params);

                if (action === 'add_character' && params) {
                    const name = params.name as string || 'Unknown';
                    addMessage({
                        type: 'canvas',
                        content: `Added character: ${name}`,
                        canvasData: {
                            action,
                            params,
                        },
                    });
                }
            },
            onError: (content, code, retryAble) => {
                addMessage({
                    type: 'error',
                    content,
                    errorCode: code,
                    retryAble,
                });
                setStreamStatus('error');
            },
            onDone: () => {
                setStreamStatus('idle');
                abortControllerRef.current = null;
            },
        };

        try {
            await startCharacterDesignAPI(scriptUrl, callbacks);
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('[CreateProvider] Stream aborted by user');
                return;
            }

            console.error('[CreateProvider] startCharacterDesign error:', error);
            addMessage({
                type: 'error',
                content: error instanceof Error ? error.message : 'Unknown error',
            });
            setStreamStatus('error');
        }
    }, [streamStatus, stopStream, addMessage, upsertMessage, updateMessage, dispatchCanvasEvent]);

    // 开始生成分镜
    const startGenerateShots = React.useCallback(async (scriptUrl: string, charactersUrl?: string) => {
        // 如果正在流式响应，先停止
        if (streamStatus === 'streaming') {
            stopStream();
        }

        // 自动打开聊天窗口
        useCreateStore.getState().setChatOpen(true);

        // 添加用户消息
        addMessage({
            type: 'user',
            content: '开始生成分镜',
        });

        setStreamStatus('streaming');

        // 创建 AbortController
        abortControllerRef.current = new AbortController();

        const callbacks: StreamCallbacks = {
            onMessage: (content) => {
                addMessage({
                    type: 'message',
                    content,
                });

                // 检测 "Found X shots for 'title'" 消息，分发初始化事件
                const shotCountMatch = content.match(/Found (\d+) shots for '([^']+)'/);
                if (shotCountMatch) {
                    const shotCount = parseInt(shotCountMatch[1], 10);
                    const scriptTitle = shotCountMatch[2];
                    dispatchCanvasEvent('init_shots', {
                        shot_count: shotCount,
                        script_title: scriptTitle,
                    });
                }
            },
            onThinking: (content) => {
                upsertMessage(
                    (msg) => msg.type === 'thinking',
                    { type: 'thinking', content }
                );
            },
            onToolStart: (toolName, content) => {
                upsertMessage(
                    (msg) => msg.type === 'tool' && msg.toolName === toolName,
                    {
                        type: 'tool',
                        content: content || `Calling ${toolName}...`,
                        toolName,
                        toolStatus: 'running',
                    }
                );
            },
            onToolEnd: (toolName, result) => {
                const hasError = result && typeof result === 'object' && 'error' in result;
                updateMessage(
                    (msg) => msg.type === 'tool' && msg.toolName === toolName,
                    (msg) => ({
                        ...msg,
                        content: hasError ? `${toolName} failed` : `${toolName} completed`,
                        toolStatus: hasError ? 'failed' : 'done',
                        toolResult: result,
                        timestamp: Date.now(),
                    })
                );
            },
            onCanvas: (action, params) => {
                dispatchCanvasEvent(action, params);

                if (action === 'add_storyboard' && params) {
                    const shotCount = (params.shots as unknown[])?.length || 0;
                    addMessage({
                        type: 'canvas',
                        content: `Generated ${shotCount} shots`,
                        canvasData: {
                            action,
                            params,
                        },
                    });
                }
            },
            onError: (content, code, retryAble) => {
                addMessage({
                    type: 'error',
                    content,
                    errorCode: code,
                    retryAble,
                });
                setStreamStatus('error');
            },
            onDone: () => {
                setStreamStatus('idle');
                abortControllerRef.current = null;
            },
        };

        try {
            await startGenerateShotsAPI(scriptUrl, callbacks, charactersUrl);
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.log('[CreateProvider] Stream aborted by user');
                return;
            }

            console.error('[CreateProvider] startGenerateShots error:', error);
            addMessage({
                type: 'error',
                content: error instanceof Error ? error.message : 'Unknown error',
            });
            setStreamStatus('error');
        }
    }, [streamStatus, stopStream, addMessage, upsertMessage, updateMessage, dispatchCanvasEvent]);

    // 组件卸载时清理
    React.useEffect(() => {
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    const contextValue = React.useMemo<CreateContextProps>(() => ({
        step,
        setStep,
        messages,
        addMessage,
        clearMessages,
        streamStatus,
        startDesign,
        startCharacterDesign,
        startGenerateShots,
        stopStream,
        subscribeCanvasEvent,
    }), [
        step,
        setStep,
        messages,
        addMessage,
        clearMessages,
        streamStatus,
        startDesign,
        startCharacterDesign,
        startGenerateShots,
        stopStream,
        subscribeCanvasEvent,
    ]);

    return (
        <CreateContext.Provider value={contextValue}>
            {children}
        </CreateContext.Provider>
    );
}

export default CreateProvider;
