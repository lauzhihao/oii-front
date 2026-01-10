'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, Play, ImageIcon, Film, Plus, Image, Video, Send, Square } from 'lucide-react';
import styles from './MediaCard.module.css';
import { cn } from '@/lib/utils';

// 媒体类型
export type MediaType = 'image' | 'video';

// 媒体卡片状态
export type MediaCardStatus = 'idle' | 'generating' | 'completed';

// 生成类型
export type GenerateType = 'image' | 'video';

// 生成事件参数
export interface GenerateEventParams {
    /** 生成类型 */
    type: GenerateType;
    /** 生成位置（屏幕坐标） */
    position: { x: number; y: number };
}

// 风格选项
const STYLE_OPTIONS = [
    { value: 'realistic', label: 'Realistic' },
    { value: 'anime', label: 'Anime' },
    { value: 'cartoon', label: 'Cartoon' },
    { value: 'oil-painting', label: 'Oil Painting' },
];

// 模型选项 - 图片
const IMAGE_MODEL_OPTIONS = [
    { value: 'flux', label: 'Flux' },
    { value: 'sdxl', label: 'SDXL' },
    { value: 'dalle3', label: 'DALL-E 3' },
];

// 模型选项 - 视频
const VIDEO_MODEL_OPTIONS = [
    { value: 'runway', label: 'Runway' },
    { value: 'pika', label: 'Pika' },
    { value: 'sora', label: 'Sora' },
];

// 媒体卡片Props
export interface MediaCardProps {
    /** 卡片状态 */
    status: MediaCardStatus;
    /** 媒体类型 */
    type: MediaType;
    /** 媒体URL */
    src?: string;
    /** 提示词 */
    prompt?: string;
    /** 风格 */
    styleValue?: string;
    /** 模型 */
    model?: string;
    /** 提示词变化回调 */
    onPromptChange?: (prompt: string) => void;
    /** 风格变化回调 */
    onStyleChange?: (style: string) => void;
    /** 模型变化回调 */
    onModelChange?: (model: string) => void;
    /** 提交生成回调 */
    onSubmit?: () => void;
    /** 停止生成回调 */
    onStop?: () => void;
    /** 删除回调 */
    onDelete?: () => void;
    /** 生成回调 */
    onGenerate?: (params: GenerateEventParams) => void;
    /** 尺寸变化回调 */
    onSizeChange?: (size: { width: number; height: number }) => void;
}

// 连接线起点和终点
interface LinePoints {
    startX: number;
    startY: number;
    endX: number;
    endY: number;
}

/**
 * 媒体卡片组件
 * 照片卡片样式：上部显示媒体内容，下部显示工具栏
 * 状态：idle(初始化) -> generating(生成中) -> completed(生成完毕)
 */
export default function MediaCard({
    status,
    type,
    src,
    prompt = '',
    styleValue = 'realistic',
    model,
    onPromptChange,
    onStyleChange,
    onModelChange,
    onSubmit,
    onStop,
    onDelete,
    onGenerate,
    onSizeChange,
}: MediaCardProps) {
    // 媒体加载状态（仅用于completed状态时媒体的浏览器加载）
    const [isMediaLoading, setIsMediaLoading] = useState(true);

    // 获取模型选项
    const modelOptions = type === 'image' ? IMAGE_MODEL_OPTIONS : VIDEO_MODEL_OPTIONS;
    const defaultModel = modelOptions[0].value;
    const currentModel = model || defaultModel;

    // 是否显示媒体区域（非idle状态时展开）
    const showMediaArea = status !== 'idle';

    // 是否显示loading状态（generating生成中、completed但媒体未加载完）
    const showLoading = status === 'generating' || (status === 'completed' && src && isMediaLoading);

    // 是否禁用输入（generating状态时禁用）
    const isInputDisabled = status === 'generating';

    // 连接线拖拽状态
    const [isDragging, setIsDragging] = useState(false);
    const [linePoints, setLinePoints] = useState<LinePoints | null>(null);

    // 菜单状态
    const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);

    // 连接点按钮ref
    const connectorRef = useRef<HTMLButtonElement>(null);

    // 处理删除点击
    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete?.();
    };

    // 处理媒体加载完成
    const handleMediaLoad = () => {
        setIsMediaLoading(false);
    };

    // 处理提交/停止点击
    const handleSubmitOrStop = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (status === 'generating') {
            onStop?.();
        } else {
            onSubmit?.();
        }
    };

    // 开始拖拽连接线
    const handleConnectorMouseDown = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        const rect = connectorRef.current?.getBoundingClientRect();
        if (!rect) return;

        const startX = rect.left + rect.width / 2;
        const startY = rect.top + rect.height / 2;

        setIsDragging(true);
        setLinePoints({
            startX,
            startY,
            endX: e.clientX,
            endY: e.clientY,
        });
    }, []);

    // 拖拽中更新连接线
    useEffect(() => {
        if (!isDragging) return;

        const handleMouseMove = (e: MouseEvent) => {
            setLinePoints((prev) => prev ? {
                ...prev,
                endX: e.clientX,
                endY: e.clientY,
            } : null);
        };

        const handleMouseUp = (e: MouseEvent) => {
            setIsDragging(false);
            // 显示菜单
            setMenuPosition({ x: e.clientX, y: e.clientY });
            setLinePoints(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    // 关闭菜单
    const handleCloseMenu = useCallback(() => {
        setMenuPosition(null);
    }, []);

    // 处理生成选项点击
    const handleGenerateClick = useCallback((generateType: GenerateType) => {
        if (menuPosition) {
            onGenerate?.({
                type: generateType,
                position: menuPosition,
            });
        }
        setMenuPosition(null);
    }, [onGenerate, menuPosition]);

    // 生成贝塞尔曲线路径
    const generateCurvePath = (points: LinePoints): string => {
        const { startX, startY, endX, endY } = points;
        const controlOffset = Math.abs(endX - startX) * 0.5;
        return `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;
    };

    // textarea ref - 用于自动调整高度
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    // 工具栏 ref - 用于计算实际需要的高度
    const toolbarRef = useRef<HTMLDivElement>(null);

    // 自动调整 textarea 高度
    const adjustTextareaHeight = useCallback(() => {
        const textarea = textareaRef.current;
        if (textarea) {
            textarea.style.height = 'auto';
            textarea.style.height = `${textarea.scrollHeight}px`;
        }
    }, []);

    // 计算并报告卡片需要的尺寸（仅在 idle 状态下）
    const reportSizeIfNeeded = useCallback(() => {
        // 只有 idle 状态（无媒体预览）时才动态计算尺寸
        if (status !== 'idle' || !onSizeChange) return;

        const toolbar = toolbarRef.current;
        if (!toolbar) return;

        requestAnimationFrame(() => {
            const toolbarRect = toolbar.getBoundingClientRect();
            // idle 状态下，高度 = 工具栏高度，宽度保持 280
            onSizeChange({
                width: 280,
                height: Math.ceil(toolbarRect.height),
            });
        });
    }, [status, onSizeChange]);

    // 组件挂载时报告初始尺寸
    useEffect(() => {
        reportSizeIfNeeded();
    }, [reportSizeIfNeeded]);

    // prompt 变化时调整高度并报告尺寸
    useEffect(() => {
        adjustTextareaHeight();
        reportSizeIfNeeded();
    }, [prompt, adjustTextareaHeight, reportSizeIfNeeded]);

    // 处理输入框滚轮事件 - 阻止冒泡到画布
    const handleTextareaWheel = useCallback((e: React.WheelEvent) => {
        e.stopPropagation();
    }, []);

    // 处理提示词变化 - 限制1000字符
    const handlePromptInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const value = e.target.value;
        if (value.length <= 1000) {
            onPromptChange?.(value);
        }
    }, [onPromptChange]);

    return (
        <div className={cn(
            styles.media_card,
            status === 'idle' && styles.media_card_idle
        )}>
            {/* generating状态动画边框 */}
            {status === 'generating' && (
                <div className={styles.media_card_generating_border} />
            )}

            {/* 媒体区域 - 使用 grid 动画展开/收起 */}
            <div className={cn(
                styles.media_area,
                showMediaArea && styles.media_area_expanded
            )}>
                <div className={styles.media_area_inner}>
                    <div className={cn(styles.media_content, showLoading && styles.media_loading)}>
                        {/* Skeleton 加载动画 - generating/媒体加载中时显示 */}
                        {showLoading && (
                            <>
                                <div className={styles.skeleton} />
                                <div className={styles.media_loading_icon}>
                                    {type === 'image' ? (
                                        <ImageIcon className="size-8" />
                                    ) : (
                                        <Film className="size-8" />
                                    )}
                                </div>
                            </>
                        )}

                        {/* 图片 - completed状态且有src时渲染 */}
                        {status === 'completed' && type === 'image' && src && (
                            <img
                                src={src}
                                alt="Generated Image"
                                draggable={false}
                                onLoad={handleMediaLoad}
                                style={{ opacity: isMediaLoading ? 0 : 1, transition: 'opacity 0.3s ease' }}
                            />
                        )}

                        {/* 视频 - completed状态且有src时渲染 */}
                        {status === 'completed' && type === 'video' && src && (
                            <>
                                <video
                                    src={src}
                                    muted
                                    preload="metadata"
                                    onLoadedMetadata={handleMediaLoad}
                                    style={{ opacity: isMediaLoading ? 0 : 1, transition: 'opacity 0.3s ease' }}
                                />
                                {!isMediaLoading && (
                                    <div className={styles.video_overlay}>
                                        <div className={styles.play_icon}>
                                            <Play className="size-5" />
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* 工具栏区域 */}
            <div ref={toolbarRef} className={styles.toolbar}>
                {/* 提示词输入框 */}
                <div className={cn(
                    styles.prompt_input_wrapper,
                    status === 'generating' && styles.prompt_input_wrapper_loading
                )}>
                    <textarea
                        ref={textareaRef}
                        className={styles.prompt_input}
                        placeholder="Enter prompt..."
                        value={prompt}
                        onChange={handlePromptInputChange}
                        onWheel={handleTextareaWheel}
                        disabled={isInputDisabled}
                        maxLength={1000}
                    />
                </div>

                {/* 工具栏控件行 */}
                <div className={styles.toolbar_controls}>
                    {/* 风格选择器 */}
                    <select
                        className={styles.selector}
                        value={styleValue}
                        onChange={(e) => onStyleChange?.(e.target.value)}
                        disabled={isInputDisabled}
                    >
                        {STYLE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>

                    {/* 模型选择器 */}
                    <select
                        className={styles.selector}
                        value={currentModel}
                        onChange={(e) => onModelChange?.(e.target.value)}
                        disabled={isInputDisabled}
                    >
                        {modelOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>

                    {/* 发送/停止按钮 */}
                    <button
                        className={cn(
                            styles.submit_btn,
                            status === 'generating' && styles.submit_btn_stop
                        )}
                        onClick={handleSubmitOrStop}
                        disabled={status === 'idle' && !prompt.trim()}
                        title={status === 'generating' ? 'Stop' : 'Generate'}
                    >
                        {status === 'generating' ? (
                            <Square className="size-3.5" />
                        ) : (
                            <Send className="size-3.5" />
                        )}
                    </button>

                    {/* 删除按钮 */}
                    {onDelete && (
                        <button
                            className={styles.delete_btn}
                            onClick={handleDelete}
                            disabled={status === 'generating'}
                            title="Delete"
                        >
                            <Trash2 className="size-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* 连接点 - 只在completed状态且媒体加载完成时显示 */}
            {status === 'completed' && !isMediaLoading && (
                <div className={styles.connector}>
                    <button
                        ref={connectorRef}
                        className={styles.connector_btn}
                        onMouseDown={handleConnectorMouseDown}
                        title="Generate"
                    >
                        <Plus className="size-3.5" />
                    </button>
                </div>
            )}

            {/* 连接线 - 使用 Portal 渲染到 body */}
            {isDragging && linePoints && typeof document !== 'undefined' && createPortal(
                <svg className={styles.connection_line}>
                    <defs>
                        <linearGradient id="connection-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#4285F4" />
                            <stop offset="50%" stopColor="#34A853" />
                            <stop offset="100%" stopColor="#FBBC05" />
                        </linearGradient>
                    </defs>
                    <path d={generateCurvePath(linePoints)} />
                    <circle cx={linePoints.endX} cy={linePoints.endY} r="6" />
                </svg>,
                document.body
            )}

            {/* 生成菜单 - 使用 Portal 渲染到 body */}
            {menuPosition && typeof document !== 'undefined' && createPortal(
                <>
                    <div className={styles.menu_overlay} onClick={handleCloseMenu} />
                    <div
                        className={styles.generate_menu}
                        style={{
                            left: menuPosition.x,
                            top: menuPosition.y,
                        }}
                    >
                        <button
                            className={styles.generate_menu_item}
                            onClick={() => handleGenerateClick('image')}
                        >
                            <Image className="size-4" />
                            <span>Generate Image</span>
                        </button>
                        <button
                            className={styles.generate_menu_item}
                            onClick={() => handleGenerateClick('video')}
                        >
                            <Video className="size-4" />
                            <span>Generate Video</span>
                        </button>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
}
