'use client';

import { useRef, useState, useCallback, type DragEvent } from 'react';
import { Upload } from 'lucide-react';
import { BaseCanvas, useCanvasItems } from '@/components/common/canvas';
import type { CanvasItemData, Point, ViewState } from '@/components/common/canvas';
import MediaCard, { type MediaType, type MediaCardStatus, type GenerateEventParams } from './MediaCard';
import styles from './Content_Create.module.css';

// 连接关系
interface Connection {
    id: string;
    sourceId: string;
    targetId: string;
}

// 支持的图片MIME类型
const IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'];

// 支持的视频MIME类型
const VIDEO_MIME_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];

// 默认媒体尺寸
const DEFAULT_IMAGE_SIZE = { width: 280, height: 210 };
const DEFAULT_VIDEO_SIZE = { width: 320, height: 240 };

// 生成的媒体默认尺寸（包含菜单区40px）
const GENERATED_SIZE = { width: 280, height: 250 };

/**
 * 根据文件类型获取媒体类型
 */
function getMediaType(file: File): MediaType | null {
    if (IMAGE_MIME_TYPES.includes(file.type)) return 'image';
    if (VIDEO_MIME_TYPES.includes(file.type)) return 'video';
    return null;
}

/**
 * 获取图片实际尺寸
 */
function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
        img.onerror = reject;
        img.src = url;
    });
}

/**
 * 计算等比缩放尺寸
 */
function calculateScaledSize(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
): { width: number; height: number } {
    const aspectRatio = originalWidth / originalHeight;
    let width = Math.min(originalWidth, maxWidth);
    let height = width / aspectRatio;

    if (height > maxHeight) {
        height = maxHeight;
        width = height * aspectRatio;
    }

    // 额外增加菜单区高度(40px)
    return { width: Math.round(width), height: Math.round(height) + 40 };
}

export default function Content_Create() {
    // 容器ref
    const containerRef = useRef<HTMLDivElement>(null);

    // 视图状态ref（用于坐标转换），初始缩放 150%
    const viewStateRef = useRef<ViewState>({ scale: 1.5, offset: { x: 0, y: 0 } });

    // 拖拽状态
    const [isDragging, setIsDragging] = useState(false);
    const dragCounterRef = useRef(0);

    // Canvas items 管理
    const { items, addItem, updateItemPosition, removeItem } = useCanvasItems([]);

    // 连接关系管理
    const [connections, setConnections] = useState<Connection[]>([]);

    // 视图状态（用于触发连接线重绘），初始缩放 150%
    const [viewState, setViewState] = useState<ViewState>({ scale: 1.5, offset: { x: 0, y: 0 } });

    /**
     * 屏幕坐标转画布坐标
     */
    const screenToCanvasPosition = useCallback((screenX: number, screenY: number): Point => {
        const container = containerRef.current;
        if (!container) return { x: 0, y: 0 };

        const rect = container.getBoundingClientRect();
        const { scale, offset } = viewStateRef.current;

        const relativeX = screenX - rect.left;
        const relativeY = screenY - rect.top;

        return {
            x: (relativeX - offset.x) / scale,
            y: (relativeY - offset.y) / scale,
        };
    }, []);

    /**
     * 处理拖拽进入
     */
    const handleDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current++;
        if (dragCounterRef.current === 1) {
            setIsDragging(true);
        }
    }, []);

    /**
     * 处理拖拽移动
     */
    const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'copy';
    }, []);

    /**
     * 处理拖拽离开
     */
    const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounterRef.current--;
        if (dragCounterRef.current === 0) {
            setIsDragging(false);
        }
    }, []);

    /**
     * 处理文件放置
     */
    const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();

        // 重置拖拽状态
        dragCounterRef.current = 0;
        setIsDragging(false);

        // 获取放置位置
        const dropPosition = screenToCanvasPosition(e.clientX, e.clientY);

        // 获取文件列表
        const files = Array.from(e.dataTransfer.files);
        if (files.length === 0) return;

        // 处理每个文件
        let offsetIndex = 0;
        for (const file of files) {
            const mediaType = getMediaType(file);
            if (!mediaType) {
                console.warn('[Content_Create] Unsupported file type:', file.type);
                continue;
            }

            // 创建预览URL
            const url = URL.createObjectURL(file);

            // 计算尺寸
            let itemWidth: number;
            let itemHeight: number;

            if (mediaType === 'image') {
                try {
                    const dimensions = await getImageDimensions(url);
                    const scaled = calculateScaledSize(
                        dimensions.width,
                        dimensions.height,
                        DEFAULT_IMAGE_SIZE.width,
                        DEFAULT_IMAGE_SIZE.height
                    );
                    itemWidth = scaled.width;
                    itemHeight = scaled.height;
                } catch {
                    itemWidth = DEFAULT_IMAGE_SIZE.width;
                    itemHeight = DEFAULT_IMAGE_SIZE.height + 40;
                }
            } else {
                itemWidth = DEFAULT_VIDEO_SIZE.width;
                itemHeight = DEFAULT_VIDEO_SIZE.height + 40;
            }

            // 计算位置（多文件时偏移）
            const position: Point = {
                x: dropPosition.x + offsetIndex * 30,
                y: dropPosition.y + offsetIndex * 30,
            };

            // 创建item - 拖入文件直接为completed状态
            const newItem: CanvasItemData = {
                id: `${mediaType}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                x: position.x,
                y: position.y,
                width: itemWidth,
                height: itemHeight,
                data: {
                    type: mediaType,
                    status: 'completed' as MediaCardStatus,
                    src: url,
                    prompt: '',
                    styleValue: 'realistic',
                    model: mediaType === 'image' ? 'flux' : 'runway',
                },
            };

            addItem(newItem);
            offsetIndex++;
        }
    }, [screenToCanvasPosition, addItem]);

    /**
     * 处理视图变化
     */
    const handleViewChange = useCallback((newViewState: ViewState) => {
        viewStateRef.current = newViewState;
        setViewState(newViewState);
    }, []);

    /**
     * 处理生成事件 - 创建新的idle状态媒体卡片
     */
    const handleGenerate = useCallback((sourceItemId: string, params: GenerateEventParams) => {
        // 将屏幕坐标转换为画布坐标
        const canvasPosition = screenToCanvasPosition(params.position.x, params.position.y);

        // 创建新的媒体item（idle状态，等待用户输入prompt）
        const newItemId = `generated-${params.type}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
        const newItem: CanvasItemData = {
            id: newItemId,
            x: canvasPosition.x,
            y: canvasPosition.y,
            width: GENERATED_SIZE.width,
            height: GENERATED_SIZE.height,
            data: {
                type: params.type as MediaType,
                status: 'idle' as MediaCardStatus,
                src: '',
                prompt: '',
                styleValue: 'realistic',
                model: params.type === 'image' ? 'flux' : 'runway',
            },
        };

        // 添加新item
        addItem(newItem);

        // 创建连接关系
        const newConnection: Connection = {
            id: `conn-${Date.now()}`,
            sourceId: sourceItemId,
            targetId: newItemId,
        };
        setConnections(prev => [...prev, newConnection]);

        console.log('[Content_Create] Generate new card:', { sourceItemId, params, newItemId });
    }, [screenToCanvasPosition, addItem]);

    /**
     * 生成贝塞尔曲线路径（用于连接线）
     */
    const generateConnectionPath = useCallback((
        sourceItem: CanvasItemData,
        targetItem: CanvasItemData
    ): string => {
        // 源点：右边框中间
        const startX = sourceItem.x + (sourceItem.width || 280);
        const startY = sourceItem.y + (sourceItem.height || 250) / 2;

        // 目标点：左边框中间
        const endX = targetItem.x;
        const endY = targetItem.y + (targetItem.height || 250) / 2;

        // 控制点偏移
        const controlOffset = Math.abs(endX - startX) * 0.5;

        return `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;
    }, []);

    /**
     * 删除item时同时删除相关连接
     */
    const handleRemoveItem = useCallback((itemId: string) => {
        removeItem(itemId);
        setConnections(prev => prev.filter(
            conn => conn.sourceId !== itemId && conn.targetId !== itemId
        ));
    }, [removeItem]);

    /**
     * 更新item数据
     */
    const updateItemData = useCallback((itemId: string, dataUpdate: Record<string, unknown>) => {
        // 找到对应的item并更新其data
        const item = items.find(i => i.id === itemId);
        if (item) {
            const updatedItem = {
                ...item,
                data: { ...item.data, ...dataUpdate },
            };
            // 使用updateItemPosition来触发更新（保持位置不变）
            removeItem(itemId);
            addItem(updatedItem);
        }
    }, [items, removeItem, addItem]);

    /**
     * 处理提示词变化
     */
    const handlePromptChange = useCallback((itemId: string, prompt: string) => {
        updateItemData(itemId, { prompt });
    }, [updateItemData]);

    /**
     * 处理风格变化
     */
    const handleStyleChange = useCallback((itemId: string, styleValue: string) => {
        updateItemData(itemId, { styleValue });
    }, [updateItemData]);

    /**
     * 处理模型变化
     */
    const handleModelChange = useCallback((itemId: string, model: string) => {
        updateItemData(itemId, { model });
    }, [updateItemData]);

    /**
     * 处理提交生成
     */
    const handleSubmit = useCallback((itemId: string) => {
        const item = items.find(i => i.id === itemId);
        if (!item) return;

        // 更新状态为generating
        updateItemData(itemId, { status: 'generating' as MediaCardStatus });

        // TODO: 调用实际的生成API
        console.log('[Content_Create] Submit generation:', {
            itemId,
            type: item.data?.type,
            prompt: item.data?.prompt,
            style: item.data?.styleValue,
            model: item.data?.model,
        });

        // 模拟生成完成（3秒后）- 实际应该由API回调处理
        setTimeout(() => {
            // 生成一个模拟的结果图片
            const mockSrc = `https://picsum.photos/seed/${itemId}/400/300`;
            updateItemData(itemId, {
                status: 'completed' as MediaCardStatus,
                src: mockSrc,
            });
        }, 3000);
    }, [items, updateItemData]);

    /**
     * 处理停止生成
     */
    const handleStop = useCallback((itemId: string) => {
        // 停止生成，恢复为idle状态
        updateItemData(itemId, { status: 'idle' as MediaCardStatus });
        console.log('[Content_Create] Stop generation:', itemId);
    }, [updateItemData]);

    /**
     * 渲染画布元素
     */
    const renderItem = useCallback((item: CanvasItemData) => {
        const {
            type,
            status,
            src,
            prompt,
            styleValue,
            model,
        } = (item.data || {}) as {
            type?: MediaType;
            status?: MediaCardStatus;
            src?: string;
            prompt?: string;
            styleValue?: string;
            model?: string;
        };

        if (!type) {
            return (
                <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#f5f5f5',
                    borderRadius: '8px',
                }}>
                    Unknown Item
                </div>
            );
        }

        return (
            <MediaCard
                status={status || 'idle'}
                type={type}
                src={src}
                prompt={prompt}
                styleValue={styleValue}
                model={model}
                onPromptChange={(newPrompt) => handlePromptChange(item.id, newPrompt)}
                onStyleChange={(newStyle) => handleStyleChange(item.id, newStyle)}
                onModelChange={(newModel) => handleModelChange(item.id, newModel)}
                onSubmit={() => handleSubmit(item.id)}
                onStop={() => handleStop(item.id)}
                onDelete={() => handleRemoveItem(item.id)}
                onGenerate={(params) => handleGenerate(item.id, params)}
            />
        );
    }, [handleRemoveItem, handleGenerate, handlePromptChange, handleStyleChange, handleModelChange, handleSubmit, handleStop]);

    return (
        <div
            ref={containerRef}
            className={styles.content_create}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <BaseCanvas
                items={items}
                renderItem={renderItem}
                onItemMove={updateItemPosition}
                onViewChange={handleViewChange}
                showGrid={true}
                mode="move"
                autoFitNewItem={false}
                initialViewState={{ scale: 1.5, offset: { x: 0, y: 0 } }}
            />

            {/* 持久连接线层 */}
            <svg
                className={styles.connections_layer}
                style={{
                    transform: `translate(${viewState.offset.x}px, ${viewState.offset.y}px) scale(${viewState.scale})`,
                    transformOrigin: '0 0',
                }}
            >
                <defs>
                    <linearGradient id="persistent-connection-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#4285F4" />
                        <stop offset="50%" stopColor="#34A853" />
                        <stop offset="100%" stopColor="#FBBC05" />
                    </linearGradient>
                </defs>
                {connections.map(conn => {
                    const sourceItem = items.find(item => item.id === conn.sourceId);
                    const targetItem = items.find(item => item.id === conn.targetId);
                    if (!sourceItem || !targetItem) return null;
                    return (
                        <path
                            key={conn.id}
                            d={generateConnectionPath(sourceItem, targetItem)}
                        />
                    );
                })}
            </svg>

            {/* 拖拽提示遮罩 */}
            {isDragging && (
                <div className={styles.drag_overlay}>
                    <div className={styles.drag_overlay_content}>
                        <div className={styles.drag_overlay_icon}>
                            <Upload className="size-6" />
                        </div>
                        <span className={styles.drag_overlay_title}>Drop files here</span>
                        <span className={styles.drag_overlay_hint}>Supports images and videos</span>
                    </div>
                </div>
            )}
        </div>
    );
}
