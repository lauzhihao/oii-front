'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/spinner';
import {
    Sparkles,
    Brain,
    Wrench,
    CheckCircle2,
    AlertCircle,
    User,
    StopCircle,
    AlertTriangle,
    Users,
    ChevronRight,
} from 'lucide-react';
import styles from './ChatCreate.module.css';
import { useCreate, type ChatMessageItem } from '../provider/CreateProvider';

// AI 助手信息
const assistant = {
    name: 'Creative Director',
    avatar: '',
};

/**
 * 聊天创建组件
 * 左侧对话面板，用于与 AI 助手进行交互
 */
export default function Chat_Create() {
    // 从 Provider 获取状态
    const { messages, streamStatus, stopStream } = useCreate();

    // 消息容器引用
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 滚动到底部
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // 消息更新时滚动到底部
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    return (
        <div className={styles['chat-create']}>
            {/* 头部区域 */}
            <header className={styles['chat-create__header']}>
                <Avatar className={styles['chat-create__avatar']}>
                    <AvatarImage src={assistant.avatar} alt={assistant.name} />
                    <AvatarFallback className={styles['chat-create__avatar-fallback']}>
                        <Sparkles className={styles['chat-create__avatar-icon']} />
                    </AvatarFallback>
                </Avatar>
                <span className={styles['chat-create__name']}>{assistant.name}</span>

                {/* 流式状态指示器 */}
                {streamStatus === 'streaming' && (
                    <button
                        className={styles['chat-create__stop-btn']}
                        onClick={stopStream}
                        title="Stop"
                    >
                        <StopCircle className="size-4" />
                    </button>
                )}
            </header>

            {/* 消息区域 */}
            <div className={styles['chat-create__messages']}>
                {/* 空状态提示 */}
                {messages.length === 0 && streamStatus === 'idle' && (
                    <div className={styles['chat-create__empty']}>
                        <Sparkles className={styles['chat-create__empty-icon']} />
                        <p>Upload a script and click Start to begin</p>
                    </div>
                )}

                {/* 消息列表 */}
                {messages.map((message) => (
                    <MessageItem key={message.id} message={message} />
                ))}

                {/* 流式加载指示器 */}
                {streamStatus === 'streaming' && (
                    <div className={styles['chat-create__loading']}>
                        <Spinner className={styles['chat-create__spinner']} />
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* 提示文字 */}
            <div className={styles['chat-create__hint']}>
                <p>Let your imagination run wild and start animating!</p>
            </div>

            {/* 底部工具栏 */}
            <footer className={styles['chat-create__toolbar']}>
                {/* 预留输入框位置 */}
            </footer>
        </div>
    );
}

/**
 * 消息项组件
 */
function MessageItem({ message }: { message: ChatMessageItem }) {
    switch (message.type) {
        case 'user':
            return (
                <div className={cn(styles['chat-create__message'], styles['chat-create__message--user'])}>
                    <div className={styles['chat-create__user-badge']}>
                        <User className="size-3" />
                    </div>
                    <p className={styles['chat-create__text']}>{message.content}</p>
                </div>
            );

        case 'message': {
            // 检测 [WARN] 前缀
            const isWarning = message.content.startsWith('[WARN]');
            if (isWarning) {
                const warningContent = message.content.replace(/^\[WARN\]\s*/, '');
                return (
                    <div className={cn(styles['chat-create__message'], styles['chat-create__message--warning'])}>
                        <div className={styles['chat-create__warning-icon']}>
                            <AlertTriangle className="size-3.5" />
                        </div>
                        <p className={styles['chat-create__warning-text']}>{warningContent}</p>
                    </div>
                );
            }

            return (
                <div className={styles['chat-create__message']}>
                    <p className={styles['chat-create__text']}>
                        {message.content.split('\n').map((line, i) => (
                            <span key={i}>
                                {line}
                                {i < message.content.split('\n').length - 1 && <br />}
                            </span>
                        ))}
                    </p>
                </div>
            );
        }

        case 'thinking':
            return (
                <div className={cn(styles['chat-create__message'], styles['chat-create__message--thinking'])}>
                    <div className={styles['chat-create__thinking-icon']}>
                        <Brain className="size-3.5" />
                    </div>
                    <p className={styles['chat-create__thinking-text']}>{message.content}</p>
                </div>
            );

        case 'tool':
            return <ToolMessageItem message={message} />;

        case 'canvas':
            return <CanvasMessageItem message={message} />;

        case 'error':
            return (
                <div className={cn(styles['chat-create__message'], styles['chat-create__message--error'])}>
                    <div className={styles['chat-create__error-icon']}>
                        <AlertCircle className="size-4" />
                    </div>
                    <div className={styles['chat-create__error-content']}>
                        <p className={styles['chat-create__error-text']}>{message.content}</p>
                        {message.retryAble && (
                            <button className={styles['chat-create__retry-btn']}>
                                Retry
                            </button>
                        )}
                    </div>
                </div>
            );

        default:
            return null;
    }
}

/**
 * 工具消息项组件 - 支持结果可视化
 */
function ToolMessageItem({ message }: { message: ChatMessageItem }) {
    const { toolName, toolStatus, toolResult } = message;

    return (
        <div className={cn(styles['chat-create__message'], styles['chat-create__message--tool'])}>
            <div className={cn(
                styles['chat-create__tool-icon'],
                toolStatus === 'done' && styles['chat-create__tool-icon--done'],
                toolStatus === 'failed' && styles['chat-create__tool-icon--failed']
            )}>
                {toolStatus === 'running' && <Spinner className="size-3.5" />}
                {toolStatus === 'done' && <CheckCircle2 className="size-3.5" />}
                {toolStatus === 'failed' && <AlertCircle className="size-3.5" />}
            </div>
            <div style={{ flex: 1 }}>
                <p className={styles['chat-create__tool-text']}>
                    {message.content}
                </p>
                {/* 工具结果可视化 */}
                {toolStatus === 'done' && toolResult != null && (
                    <ToolResultDisplay toolName={toolName} result={toolResult} />
                )}
            </div>
        </div>
    );
}

/**
 * 工具结果展示组件
 */
function ToolResultDisplay({ toolName, result }: { toolName?: string; result: unknown }) {
    if (!toolName || !result || typeof result !== 'object') return null;

    const data = result as Record<string, unknown>;

    // character_extractor - 显示角色标签列表
    if (toolName === 'character_extractor' && Array.isArray(data.characters)) {
        return (
            <div className={styles['chat-create__tool-result']}>
                <div className={styles['chat-create__character-tags']}>
                    {(data.characters as string[]).map((char, i) => (
                        <span key={i} className={styles['chat-create__character-tag']}>
                            {char}
                        </span>
                    ))}
                </div>
            </div>
        );
    }

    // text_to_image - 显示图片缩略图
    if (toolName === 'text_to_image' && typeof data.image_url === 'string') {
        return (
            <div className={styles['chat-create__tool-result']}>
                <div className={styles['chat-create__image-preview']}>
                    <img src={data.image_url} alt="Generated" loading="lazy" />
                </div>
            </div>
        );
    }

    // prompt_generator - 显示 prompt 截断预览
    if (toolName === 'prompt_generator' && typeof data.prompt === 'string') {
        return (
            <div className={styles['chat-create__tool-result']}>
                <p className={styles['chat-create__prompt-preview']}>
                    {data.prompt}
                </p>
            </div>
        );
    }

    return null;
}

/**
 * Canvas 角色卡片消息组件
 */
function CanvasMessageItem({ message }: { message: ChatMessageItem }) {
    const { canvasData } = message;

    if (!canvasData || canvasData.action !== 'add_character' || !canvasData.params) {
        return null;
    }

    const { name, description, image_url, role } = canvasData.params as {
        name?: string;
        description?: string;
        image_url?: string;
        role?: string;
    };

    return (
        <div className={cn(styles['chat-create__message'], styles['chat-create__message--canvas'])}>
            <div className={styles['chat-create__canvas-image']}>
                {image_url ? (
                    <img src={image_url} alt={name || 'Character'} loading="lazy" />
                ) : (
                    <div className={styles['chat-create__canvas-image-placeholder']}>
                        <Users className="size-5" />
                    </div>
                )}
            </div>
            <div className={styles['chat-create__canvas-info']}>
                <span className={styles['chat-create__canvas-name']}>{name || 'Unknown'}</span>
                {description && (
                    <span className={styles['chat-create__canvas-desc']}>{description}</span>
                )}
                {role && (
                    <span className={styles['chat-create__canvas-role']}>{role}</span>
                )}
            </div>
            <div className={styles['chat-create__canvas-action']}>
                <ChevronRight className="size-4" />
            </div>
        </div>
    );
}
