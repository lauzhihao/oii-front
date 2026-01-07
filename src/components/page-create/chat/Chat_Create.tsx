'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Spinner } from '@/components/ui/spinner';
import { CheckCircle2, Circle, Sparkles, Image, MessageSquare, Plus } from 'lucide-react';
import styles from './ChatCreate.module.css';
import {
    ChatMessage,
    StepItem,
    TagItem,
    mockAssistant,
    mockFetchChatStream,
    mockSendMessage,
} from './mock-chat-stream';

/**
 * 聊天创建组件
 * 左侧对话面板，用于与 AI 助手进行交互
 */
export default function Chat_Create() {
    // 消息列表
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    // 是否正在加载
    const [isLoading, setIsLoading] = useState(true);
    // 是否正在流式响应
    const [isStreaming, setIsStreaming] = useState(false);
    // 当前流式文本
    const [streamingText, setStreamingText] = useState('');
    // 消息容器引用
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 滚动到底部
    const scrollToBottom = useCallback(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, []);

    // 初始化加载消息
    useEffect(() => {
        let isMounted = true;
        setMessages([]); // 重置消息列表，防止 Strict Mode 重复添加
        setIsLoading(true);
        mockFetchChatStream(
            (message) => {
                if (isMounted) {
                    setMessages((prev) => [...prev, message]);
                }
            },
            () => {
                if (isMounted) {
                    setIsLoading(false);
                }
            }
        );
        return () => {
            isMounted = false;
        };
    }, []);

    // 消息更新时滚动到底部
    useEffect(() => {
        scrollToBottom();
    }, [messages, streamingText, scrollToBottom]);

    // 处理发送消息（预留接口）
    const handleSendMessage = useCallback(async (text: string) => {
        if (!text.trim() || isStreaming) return;

        setIsStreaming(true);
        setStreamingText('');

        await mockSendMessage(
            text,
            (responseText) => {
                setStreamingText(responseText);
            },
            () => {
                // 完成后添加到消息列表
                setMessages((prev) => [
                    ...prev,
                    {
                        id: `msg-${Date.now()}`,
                        type: 'text',
                        content: streamingText,
                        timestamp: Date.now(),
                    },
                ]);
                setStreamingText('');
                setIsStreaming(false);
            }
        );
    }, [isStreaming, streamingText]);

    return (
        <div className={styles['chat-create']}>
            {/* 头部区域 */}
            <header className={styles['chat-create__header']}>
                <Avatar className={styles['chat-create__avatar']}>
                    <AvatarImage src={mockAssistant.avatar} alt={mockAssistant.name} />
                    <AvatarFallback className={styles['chat-create__avatar-fallback']}>
                        <Sparkles className={styles['chat-create__avatar-icon']} />
                    </AvatarFallback>
                </Avatar>
                <span className={styles['chat-create__name']}>{mockAssistant.name}</span>
            </header>

            {/* 消息区域 */}
            <div className={styles['chat-create__messages']}>
                {messages.map((message) => (
                    <MessageItem key={message.id} message={message} />
                ))}

                {/* 流式响应显示 */}
                {isStreaming && streamingText && (
                    <div className={styles['chat-create__message']}>
                        <p className={styles['chat-create__text']}>{streamingText}</p>
                    </div>
                )}

                {/* 加载状态 */}
                {isLoading && (
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

            </footer>
        </div>
    );
}

/**
 * 消息项组件
 */
function MessageItem({ message }: { message: ChatMessage }) {
    switch (message.type) {
        case 'text':
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

        case 'tag':
            return (
                <div className={styles['chat-create__message']}>
                    <p className={styles['chat-create__text']}>
                        {message.content}{' '}
                        {message.tags?.map((tag) => (
                            <TagBadge key={tag.id} tag={tag} />
                        ))}
                        {' '}in another
                    </p>
                </div>
            );

        case 'description':
            return (
                <div className={styles['chat-create__message']}>
                    <div className={styles['chat-create__description']}>
                        {message.content}
                    </div>
                </div>
            );

        case 'step':
            return (
                <div className={styles['chat-create__message']}>
                    <div className={styles['chat-create__steps']}>
                        {message.steps?.map((step) => (
                            <StepItemComponent key={step.id} step={step} />
                        ))}
                    </div>
                </div>
            );

        default:
            return null;
    }
}

/**
 * 标签徽章组件
 */
function TagBadge({ tag }: { tag: TagItem }) {
    return (
        <span
            className={cn(
                styles['chat-create__tag'],
                tag.variant === 'primary' && styles['chat-create__tag--primary']
            )}
        >
            {tag.label}
        </span>
    );
}

/**
 * 步骤项组件
 */
function StepItemComponent({ step }: { step: StepItem }) {
    return (
        <div className={styles['chat-create__step']}>
            <div className={styles['chat-create__step-icon']}>
                {step.status === 'completed' ? (
                    <CheckCircle2
                        size={18}
                        className={styles['chat-create__step-icon--completed']}
                    />
                ) : step.status === 'in_progress' ? (
                    <Spinner className={styles['chat-create__step-icon--progress']} />
                ) : (
                    <Circle
                        size={18}
                        className={styles['chat-create__step-icon--pending']}
                    />
                )}
            </div>
            <div className={styles['chat-create__step-content']}>
                <span className={styles['chat-create__step-title']}>{step.title}</span>
                {step.description && (
                    <span className={styles['chat-create__step-desc']}>{step.description}</span>
                )}
            </div>
        </div>
    );
}
