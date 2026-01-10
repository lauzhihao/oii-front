'use client';

import { useRef, useState, useCallback, useEffect, type DragEvent } from 'react';
import { Upload } from 'lucide-react';
import { BaseCanvas, useCanvasItems } from '@/components/common/canvas';
import type { CanvasItemData, Point, ViewState } from '@/components/common/canvas';
import MediaCard, { type MediaType, type MediaCardStatus, type GenerateEventParams } from './MediaCard';
import ScriptCard, { type ScriptFileType, type ScriptParseStatus, type GenerateEventParams as ScriptGenerateEventParams } from './ScriptCard';
import CharacterCard, { type CharacterData } from './CharacterCard';
import CharactersCard, { type CharacterItemData } from './CharactersCard';
import ScriptOverviewCard, { type ScriptOverviewData, type ScriptOverviewStatus } from './ScriptOverviewCard';
import ShotsCard, { type ShotItemData } from './ShotsCard';
import { uploadAndParseScript, createTextFile, uploadJsonToCOS } from '@/actions/script/script-upload';
import { useCreate, type CanvasEvent } from '../provider/CreateProvider';
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

// 支持的文档MIME类型（仅支持 txt/md/pdf/docx）
const SCRIPT_MIME_TYPES: Record<string, ScriptFileType> = {
    'text/plain': 'txt',
    'text/markdown': 'md',
    'application/pdf': 'pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
};

// 根据文件扩展名获取文档类型（用于 MIME 类型未正确识别的情况）
const SCRIPT_EXTENSIONS: Record<string, ScriptFileType> = {
    '.txt': 'txt',
    '.md': 'md',
    '.markdown': 'md',
    '.pdf': 'pdf',
    '.docx': 'docx',
};

// 默认媒体尺寸
const DEFAULT_IMAGE_SIZE = { width: 280, height: 210 };
const DEFAULT_VIDEO_SIZE = { width: 320, height: 240 };
const DEFAULT_SCRIPT_SIZE = { width: 400, height: 300 };
const DEFAULT_CHARACTER_SIZE = { width: 220, height: 320 };
const DEFAULT_SCRIPT_OVERVIEW_SIZE = { width: 720, height: 450 };
const DEFAULT_CHARACTERS_SIZE = { width: 1440, height: 900 };
const DEFAULT_SHOTS_SIZE = { width: 1440, height: 900 };

// 画布元素类型
type CanvasItemType = 'image' | 'video' | 'script' | 'character' | 'script_overview' | 'characters' | 'shots';

// 工具栏固定高度（padding 20px + 输入框 36px + gap 8px + 控件行 32px + border-top 1px + canvas item border 4px = 101px）
const TOOLBAR_HEIGHT = 115;

// 生成的媒体默认尺寸
// idle状态: 只显示工具栏，高度自适应（设为0让canvas使用auto）
const GENERATED_SIZE_IDLE = { width: 280, height: 0 };

/**
 * 根据文件类型获取媒体类型
 */
function getMediaType(file: File): MediaType | null {
    if (IMAGE_MIME_TYPES.includes(file.type)) return 'image';
    if (VIDEO_MIME_TYPES.includes(file.type)) return 'video';
    return null;
}

// 常见文档扩展名（用于检测不支持的文档格式）
const DOCUMENT_EXTENSIONS = ['.txt', '.md', '.markdown', '.pdf', '.docx', '.doc', '.rtf', '.odt', '.pages', '.wps'];

/**
 * 根据文件获取画布元素类型
 */
function getItemType(file: File): { type: CanvasItemType; scriptFileType?: ScriptFileType; unsupported?: boolean } | null {
    // 检查图片类型
    if (IMAGE_MIME_TYPES.includes(file.type)) {
        return { type: 'image' };
    }
    // 检查视频类型
    if (VIDEO_MIME_TYPES.includes(file.type)) {
        return { type: 'video' };
    }
    // 检查文档类型（通过 MIME）
    if (file.type in SCRIPT_MIME_TYPES) {
        return { type: 'script', scriptFileType: SCRIPT_MIME_TYPES[file.type] };
    }
    // 通过扩展名检查文档类型
    const fileName = file.name.toLowerCase();
    for (const [ext, scriptType] of Object.entries(SCRIPT_EXTENSIONS)) {
        if (fileName.endsWith(ext)) {
            return { type: 'script', scriptFileType: scriptType };
        }
    }
    // 检查是否是不支持的文档格式
    for (const ext of DOCUMENT_EXTENSIONS) {
        if (fileName.endsWith(ext)) {
            return { type: 'script', scriptFileType: 'txt', unsupported: true };
        }
    }
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
 * 返回的高度 = 媒体区域高度 + 工具栏高度
 */
function calculateScaledSize(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxMediaHeight: number
): { width: number; height: number } {
    const aspectRatio = originalWidth / originalHeight;
    let width = Math.min(originalWidth, maxWidth);
    let mediaHeight = width / aspectRatio;

    if (mediaHeight > maxMediaHeight) {
        mediaHeight = maxMediaHeight;
        width = mediaHeight * aspectRatio;
    }

    // 总高度 = 媒体区域高度 + 工具栏高度
    return {
        width: Math.round(width),
        height: Math.round(mediaHeight) + TOOLBAR_HEIGHT
    };
}

export default function Content_Create() {
    // 从 Provider 获取方法
    const { startDesign, startCharacterDesign, startGenerateShots, streamStatus, subscribeCanvasEvent } = useCreate();

    // 容器ref
    const containerRef = useRef<HTMLDivElement>(null);

    // 视图状态ref（用于坐标转换），初始缩放 150%
    const viewStateRef = useRef<ViewState>({ scale: 1.5, offset: { x: 0, y: 0 } });

    // 拖拽状态
    const [isDragging, setIsDragging] = useState(false);
    const dragCounterRef = useRef(0);

    // Canvas items 管理
    const { items, setItems, addItem, updateItemPosition, removeItem, updateItem } = useCanvasItems([]);

    // 正在删除的 item ID 集合（用于防止竞态条件）
    const deletingItemsRef = useRef<Set<string>>(new Set());

    // 连接关系管理
    const [connections, setConnections] = useState<Connection[]>([]);

    // 当前激活的 ScriptCard ID（用于角色与剧本连接）
    const activeScriptIdRef = useRef<string | null>(null);

    // 当前激活的 ScriptOverviewCard ID（用于更新）
    const activeScriptOverviewIdRef = useRef<string | null>(null);

    // 当前激活的 CharactersCard ID（用于角色集合更新）
    const activeCharactersIdRef = useRef<string | null>(null);

    // 当前激活的 ShotsCard ID（用于分镜列表更新）
    const activeShotsIdRef = useRef<string | null>(null);

    // 当前激活的剧本 URL（用于生成分镜等任务）
    const activeScriptUrlRef = useRef<string | null>(null);

    // 角色JSON URL（用于上传修改后的数据）
    const charactersJsonUrlRef = useRef<string | null>(null);

    // 角色是否被修改
    const [charactersModified, setCharactersModified] = useState(false);

    // 角色编辑是否锁定
    const [charactersLocked, setCharactersLocked] = useState(false);

    // 视图状态（用于触发连接线重绘），初始缩放 150%
    const [viewState, setViewState] = useState<ViewState>({ scale: 1.5, offset: { x: 0, y: 0 } });

    // 当前选中的item ID
    const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

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
        let lastItemId: string | null = null;
        for (const file of files) {
            const itemTypeInfo = getItemType(file);
            if (!itemTypeInfo) {
                console.warn('[Content_Create] Unsupported file type:', file.type, file.name);
                continue;
            }

            // 计算位置（多文件时偏移）
            const position: Point = {
                x: dropPosition.x + offsetIndex * 30,
                y: dropPosition.y + offsetIndex * 30,
            };

            // 根据类型处理不同的文件
            if (itemTypeInfo.type === 'script' && itemTypeInfo.scriptFileType) {
                // 处理文档文件
                const newItemId = `script-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

                // 检查是否是不支持的格式
                if (itemTypeInfo.unsupported) {
                    // 不支持的格式：直接创建 loaded 状态的卡片，显示警告信息
                    const newItem: CanvasItemData = {
                        id: newItemId,
                        x: position.x,
                        y: position.y,
                        width: DEFAULT_SCRIPT_SIZE.width,
                        height: DEFAULT_SCRIPT_SIZE.height,
                        data: {
                            itemType: 'script' as CanvasItemType,
                            fileName: file.name,
                            fileType: itemTypeInfo.scriptFileType,
                            fileSize: file.size,
                            status: 'loaded' as ScriptParseStatus,
                            content: '',
                            warningMessage: 'Unsupported format. Please enter script content below.',
                            cosKey: '',
                        },
                    };
                    addItem(newItem);
                    lastItemId = newItemId;
                } else {
                    // 支持的格式：创建 parsing 状态并上传解析
                    const newItem: CanvasItemData = {
                        id: newItemId,
                        x: position.x,
                        y: position.y,
                        width: DEFAULT_SCRIPT_SIZE.width,
                        height: DEFAULT_SCRIPT_SIZE.height,
                        data: {
                            itemType: 'script' as CanvasItemType,
                            fileName: file.name,
                            fileType: itemTypeInfo.scriptFileType,
                            fileSize: file.size,
                            status: 'parsing' as ScriptParseStatus,
                            content: '',
                            errorMessage: '',
                            cosKey: '',
                        },
                    };

                    addItem(newItem);
                    lastItemId = newItemId;

                    // 异步上传到 COS 并解析文件内容
                    uploadAndParseScript(file)
                        .then(({ cosKey, content, parsedUrl }) => {
                            setItems((prev) =>
                                prev.map((item) =>
                                    item.id === newItemId
                                        ? { ...item, data: { ...item.data, status: 'loaded' as ScriptParseStatus, content, cosKey, parsedUrl } }
                                        : item
                                )
                            );
                        })
                        .catch((error) => {
                            console.error('[Content_Create] Failed to upload and parse script file:', error);
                            setItems((prev) =>
                                prev.map((item) =>
                                    item.id === newItemId
                                        ? { ...item, data: { ...item.data, status: 'error' as ScriptParseStatus, errorMessage: error.message || 'Failed to upload file' } }
                                        : item
                                )
                            );
                        });
                }
            } else {
                // 处理媒体文件（图片/视频）
                const mediaType = itemTypeInfo.type as MediaType;
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
                        itemHeight = DEFAULT_IMAGE_SIZE.height + TOOLBAR_HEIGHT;
                    }
                } else {
                    itemWidth = DEFAULT_VIDEO_SIZE.width;
                    itemHeight = DEFAULT_VIDEO_SIZE.height + TOOLBAR_HEIGHT;
                }

                const newItemId = `${mediaType}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
                const newItem: CanvasItemData = {
                    id: newItemId,
                    x: position.x,
                    y: position.y,
                    width: itemWidth,
                    height: itemHeight,
                    data: {
                        itemType: mediaType as CanvasItemType,
                        type: mediaType,
                        status: 'completed' as MediaCardStatus,
                        src: url,
                        prompt: '',
                        styleValue: 'realistic',
                        model: mediaType === 'image' ? 'flux' : 'runway',
                    },
                };

                addItem(newItem);
                lastItemId = newItemId;
            }

            offsetIndex++;
        }

        // 选中最后一个拖入的卡片
        if (lastItemId) {
            setSelectedItemId(lastItemId);
        }
    }, [screenToCanvasPosition, addItem, setItems]);

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
            width: GENERATED_SIZE_IDLE.width,
            height: GENERATED_SIZE_IDLE.height,
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

        // 选中新生成的卡片
        setSelectedItemId(newItemId);

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
     * 计算两个卡片之间的最佳连接点位置
     * 根据相对位置自动选择边框中点
     */
    const calculateConnectionPoints = useCallback((
        sourceItem: CanvasItemData,
        targetItem: CanvasItemData
    ): { start: Point; end: Point; direction: 'horizontal' | 'vertical' } => {
        const sourceW = sourceItem.width || 280;
        const sourceH = sourceItem.height || 250;
        const targetW = targetItem.width || 280;
        const targetH = targetItem.height || 250;

        // 计算中心点
        const sourceCenterX = sourceItem.x + sourceW / 2;
        const sourceCenterY = sourceItem.y + sourceH / 2;
        const targetCenterX = targetItem.x + targetW / 2;
        const targetCenterY = targetItem.y + targetH / 2;

        // 计算相对偏移
        const deltaX = targetCenterX - sourceCenterX;
        const deltaY = targetCenterY - sourceCenterY;

        // 判断主要方向：比较水平和垂直距离的绝对值
        const isMainlyVertical = Math.abs(deltaY) > Math.abs(deltaX);

        let start: Point;
        let end: Point;

        if (isMainlyVertical) {
            if (deltaY > 0) {
                // target 在 source 下方
                start = { x: sourceCenterX, y: sourceItem.y + sourceH };
                end = { x: targetCenterX, y: targetItem.y };
            } else {
                // target 在 source 上方
                start = { x: sourceCenterX, y: sourceItem.y };
                end = { x: targetCenterX, y: targetItem.y + targetH };
            }
            return { start, end, direction: 'vertical' };
        } else {
            if (deltaX > 0) {
                // target 在 source 右边
                start = { x: sourceItem.x + sourceW, y: sourceCenterY };
                end = { x: targetItem.x, y: targetCenterY };
            } else {
                // target 在 source 左边
                start = { x: sourceItem.x, y: sourceCenterY };
                end = { x: targetItem.x + targetW, y: targetCenterY };
            }
            return { start, end, direction: 'horizontal' };
        }
    }, []);

    /**
     * 生成贝塞尔曲线路径（用于连接线）
     * 根据卡片相对位置动态计算连接点
     */
    const generateConnectionPath = useCallback((
        sourceItem: CanvasItemData,
        targetItem: CanvasItemData
    ): string => {
        const { start, end, direction } = calculateConnectionPoints(sourceItem, targetItem);

        // 根据方向调整控制点
        let controlOffset: number;
        let path: string;

        if (direction === 'vertical') {
            // 垂直连接：控制点在垂直方向偏移
            controlOffset = Math.abs(end.y - start.y) * 0.4;
            const startControlY = start.y < end.y ? start.y + controlOffset : start.y - controlOffset;
            const endControlY = start.y < end.y ? end.y - controlOffset : end.y + controlOffset;
            path = `M ${start.x} ${start.y} C ${start.x} ${startControlY}, ${end.x} ${endControlY}, ${end.x} ${end.y}`;
        } else {
            // 水平连接：控制点在水平方向偏移
            controlOffset = Math.abs(end.x - start.x) * 0.4;
            const startControlX = start.x < end.x ? start.x + controlOffset : start.x - controlOffset;
            const endControlX = start.x < end.x ? end.x - controlOffset : end.x + controlOffset;
            path = `M ${start.x} ${start.y} C ${startControlX} ${start.y}, ${endControlX} ${end.y}, ${end.x} ${end.y}`;
        }

        return path;
    }, [calculateConnectionPoints]);

    /**
     * 删除item时同时删除相关连接
     */
    const handleRemoveItem = useCallback((itemId: string) => {
        // 标记为正在删除，防止 onSizeChange 竞态条件
        deletingItemsRef.current.add(itemId);
        removeItem(itemId);
        setConnections(prev => prev.filter(
            conn => conn.sourceId !== itemId && conn.targetId !== itemId
        ));
        // 清除相关的激活 ref
        if (activeScriptIdRef.current === itemId) {
            activeScriptIdRef.current = null;
        }
        if (activeScriptOverviewIdRef.current === itemId) {
            activeScriptOverviewIdRef.current = null;
        }
        if (activeCharactersIdRef.current === itemId) {
            activeCharactersIdRef.current = null;
        }
        if (activeShotsIdRef.current === itemId) {
            activeShotsIdRef.current = null;
        }
        // 延迟清理标记
        setTimeout(() => {
            deletingItemsRef.current.delete(itemId);
        }, 100);
    }, [removeItem]);

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
     * 更新item尺寸
     */
    const updateItemSize = useCallback((itemId: string, width: number, height: number) => {
        const item = items.find(i => i.id === itemId);
        if (item) {
            const updatedItem = {
                ...item,
                width,
                height,
            };
            removeItem(itemId);
            addItem(updatedItem);
        }
    }, [items, removeItem, addItem]);

    /**
     * 处理提交生成
     */
    const handleSubmit = useCallback((itemId: string) => {
        const item = items.find(i => i.id === itemId);
        if (!item) return;

        // 更新状态为generating（尺寸由 MediaCard 通过 onSizeChange 自动调整）
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
        // 停止生成，恢复为idle状态（尺寸由 MediaCard 通过 onSizeChange 自动调整）
        updateItemData(itemId, { status: 'idle' as MediaCardStatus });
        console.log('[Content_Create] Stop generation:', itemId);
    }, [updateItemData]);

    /**
     * 处理卡片尺寸变化（用于 MediaCard 的自动尺寸调整）
     */
    const handleSizeChange = useCallback((itemId: string, size: { width: number; height: number }) => {
        // 如果 item 正在被删除，跳过尺寸更新
        if (deletingItemsRef.current.has(itemId)) return;

        const item = items.find(i => i.id === itemId);
        if (!item) return;

        // 只有尺寸真正变化时才更新
        if (item.width === size.width && item.height === size.height) return;

        const updatedItem = {
            ...item,
            width: size.width,
            height: size.height,
        };
        removeItem(itemId);
        addItem(updatedItem);
    }, [items, removeItem, addItem]);

    /**
     * 处理卡片拖拽 resize（使用 updateItem 避免组件重建）
     */
    const handleResize = useCallback((itemId: string, size: { width: number; height: number }) => {
        updateItem(itemId, { width: size.width, height: size.height });
    }, [updateItem]);

    /**
     * 处理 ScriptCard 的分析事件
     */
    const handleScriptGenerate = useCallback((sourceItemId: string, params: ScriptGenerateEventParams) => {
        // 根据分析类型执行不同操作
        if (params.type === 'analyze-script') {
            // 分析剧本
            console.log('[Content_Create] Analyze script:', { sourceItemId, scriptContent: params.scriptContent?.slice(0, 100) });
            // TODO: 实现剧本分析功能
        } else if (params.type === 'analyze-character') {
            // 解析角色
            console.log('[Content_Create] Analyze character:', { sourceItemId, scriptContent: params.scriptContent?.slice(0, 100) });
            // TODO: 实现角色解析功能
        }
    }, []);

    /**
     * 处理 ScriptCard 的内容提交解析
     */
    const handleScriptSubmitContent = useCallback((itemId: string, content: string) => {
        // 1. 更新状态为 parsing，设置 isSubmitting
        setItems((prev) =>
            prev.map((item) =>
                item.id === itemId
                    ? { ...item, data: { ...item.data, status: 'parsing' as ScriptParseStatus, isSubmitting: true } }
                    : item
            )
        );

        // 2. 创建临时文件并上传解析
        const tempFile = createTextFile(content);
        uploadAndParseScript(tempFile)
            .then(({ cosKey, content: parsedContent, parsedUrl }) => {
                setItems((prev) =>
                    prev.map((item) =>
                        item.id === itemId
                            ? {
                                ...item,
                                data: {
                                    ...item.data,
                                    status: 'loaded' as ScriptParseStatus,
                                    content: parsedContent,
                                    cosKey,
                                    parsedUrl,
                                    isSubmitting: false,
                                },
                            }
                            : item
                    )
                );
            })
            .catch((error) => {
                console.error('[Content_Create] Failed to submit and parse content:', error);
                setItems((prev) =>
                    prev.map((item) =>
                        item.id === itemId
                            ? {
                                ...item,
                                data: {
                                    ...item.data,
                                    status: 'error' as ScriptParseStatus,
                                    errorMessage: error.message || 'Failed to parse content',
                                    isSubmitting: false,
                                },
                            }
                            : item
                    )
                );
            });
    }, [setItems]);

    /**
     * 处理开始创作 - 调用聊天接口开始角色设计
     */
    const handleStartCreate = useCallback(async (itemId: string, parsedUrl: string) => {
        console.log('[Content_Create] Start character design with script:', { itemId, parsedUrl });
        // 记录当前激活的 ScriptCard ID，用于后续角色连接
        activeScriptIdRef.current = itemId;
        // 通过 Provider 发起角色设计请求
        await startDesign(parsedUrl);
    }, [startDesign]);

    /**
     * 处理角色提示词更新
     */
    const handleUpdateCharacterPrompt = useCallback((characterId: string, newPrompt: string) => {
        if (!activeCharactersIdRef.current) return;

        setItems(prev => prev.map(item => {
            if (item.id !== activeCharactersIdRef.current) return item;
            const itemData = item.data as { itemType: string; characters?: CharacterItemData[] };
            const updatedCharacters = (itemData.characters || []).map(char => {
                if (char.id !== characterId) return char;
                return { ...char, prompt: newPrompt };
            });
            return {
                ...item,
                data: { ...itemData, characters: updatedCharacters },
            };
        }));

        // 标记为已修改
        setCharactersModified(true);
        console.log('[Content_Create] Character prompt updated:', { characterId, newPrompt: newPrompt.slice(0, 50) });
    }, [setItems]);

    /**
     * 处理开始生成分镜
     * 如果角色数据被修改过，先上传到COS再发送请求
     */
    const handleStartGenerateShots = useCallback(async () => {
        if (!activeScriptUrlRef.current) {
            console.warn('[Content_Create] No script URL available');
            return;
        }

        // 锁定编辑
        setCharactersLocked(true);

        let charactersUrl = charactersJsonUrlRef.current;

        // 如果角色数据被修改过，需要上传新的JSON
        if (charactersModified && activeCharactersIdRef.current) {
            const charactersItem = items.find(item => item.id === activeCharactersIdRef.current);
            if (charactersItem) {
                const itemData = charactersItem.data as { characters?: CharacterItemData[] };
                const characters = itemData.characters || [];

                try {
                    console.log('[Content_Create] Uploading modified characters data...');
                    charactersUrl = await uploadJsonToCOS(characters, 'characters');
                    charactersJsonUrlRef.current = charactersUrl;
                    setCharactersModified(false);
                    console.log('[Content_Create] Characters data uploaded:', charactersUrl);
                } catch (error) {
                    console.error('[Content_Create] Failed to upload characters:', error);
                    setCharactersLocked(false);
                    return;
                }
            }
        }

        // 发送生成分镜请求
        console.log('[Content_Create] Starting generate shots with:', {
            scriptUrl: activeScriptUrlRef.current,
            charactersUrl,
        });
        await startGenerateShots(activeScriptUrlRef.current, charactersUrl || undefined);
    }, [items, charactersModified, startGenerateShots]);

    /**
     * 处理画布事件
     */
    const handleCanvasEvent = useCallback((event: CanvasEvent) => {
        console.log('[Content_Create] Canvas event:', event);

        const { action, params } = event;

        switch (action) {
            case 'set_script_overview':
            case 'add_script_overview': {
                if (!params) break;

                const overviewUrl = params.url as string;
                const title = params.title as string || 'Script Overview';
                const characterCount = params.character_count as number || 0;
                const shotCount = params.shot_count as number || 0;

                // 存储脚本URL以供后续任务使用
                if (overviewUrl) {
                    activeScriptUrlRef.current = overviewUrl;
                }

                // 找到激活的 ScriptCard 位置作为参考
                const activeScript = activeScriptIdRef.current
                    ? items.find(item => item.id === activeScriptIdRef.current)
                    : null;

                // ScriptOverviewCard 位置：在 ScriptCard 下方
                const position: Point = {
                    x: activeScript ? activeScript.x : 100,
                    y: activeScript
                        ? activeScript.y + (activeScript.height || 200) + 40
                        : 300,
                };

                // 创建 ScriptOverviewCard（初始为 loading 状态）
                const newItemId = `script-overview-${Date.now()}`;
                const newItem: CanvasItemData = {
                    id: newItemId,
                    x: position.x,
                    y: position.y,
                    width: DEFAULT_SCRIPT_OVERVIEW_SIZE.width,
                    height: DEFAULT_SCRIPT_OVERVIEW_SIZE.height,
                    data: {
                        itemType: 'script_overview' as CanvasItemType,
                        overviewData: {
                            title,
                        } as ScriptOverviewData,
                        status: 'loading' as ScriptOverviewStatus,
                        characterCount,
                        shotCount,
                        scriptUrl: overviewUrl,
                    },
                };

                // 添加 ScriptOverviewCard 到画布
                addItem(newItem);

                // 记录当前激活的 ScriptOverviewCard ID
                activeScriptOverviewIdRef.current = newItemId;

                // 如果有激活的 ScriptCard，创建连接关系
                if (activeScriptIdRef.current) {
                    const newConnection: Connection = {
                        id: `conn-script-overview-${Date.now()}`,
                        sourceId: activeScriptIdRef.current,
                        targetId: newItemId,
                    };
                    setConnections(prev => [...prev, newConnection]);
                }

                console.log('[Content_Create] Added script overview card (loading):', { newItemId, overviewUrl, title });

                // 如果有 URL，获取完整的 JSON 数据
                if (overviewUrl) {
                    fetch(overviewUrl)
                        .then(response => {
                            if (!response.ok) {
                                throw new Error(`Failed to fetch script overview: ${response.status}`);
                            }
                            return response.json();
                        })
                        .then((data: ScriptOverviewData) => {
                            // 更新 ScriptOverviewCard 数据
                            setItems(prev => prev.map(item => {
                                if (item.id !== newItemId) return item;
                                return {
                                    ...item,
                                    data: {
                                        ...item.data,
                                        overviewData: {
                                            ...data,
                                            title: data.title || title,
                                        },
                                        status: 'completed' as ScriptOverviewStatus,
                                    },
                                };
                            }));
                            console.log('[Content_Create] Script overview data loaded:', data);
                        })
                        .catch(error => {
                            console.error('[Content_Create] Failed to fetch script overview:', error);
                            // 更新为错误状态
                            setItems(prev => prev.map(item => {
                                if (item.id !== newItemId) return item;
                                return {
                                    ...item,
                                    data: {
                                        ...item.data,
                                        status: 'error' as ScriptOverviewStatus,
                                        errorMessage: error.message || 'Failed to load script overview',
                                    },
                                };
                            }));
                        });
                }

                break;
            }

            case 'update_script_overview': {
                if (!params) break;

                // 获取当前激活的 ScriptOverviewCard
                const overviewItemId = activeScriptOverviewIdRef.current;
                if (!overviewItemId) {
                    console.warn('[Content_Create] No active script overview card to update');
                    break;
                }

                // 从 params 中提取更新的数据
                const updateData: Partial<ScriptOverviewData> = {
                    summary: params.summary as string,
                    characters: params.characters as ScriptOverviewData['characters'],
                    shots: params.shots as ScriptOverviewData['shots'],
                };

                // 判断是否完成（可以通过 params.status 或其他字段判断）
                const isCompleted = params.status === 'completed' || params.done === true;

                // 更新 ScriptOverviewCard
                setItems(prev => prev.map(item => {
                    if (item.id !== overviewItemId) return item;

                    const currentData = item.data as {
                        itemType: string;
                        overviewData: ScriptOverviewData;
                        status: ScriptOverviewStatus;
                    };

                    // 合并数据
                    const mergedOverviewData: ScriptOverviewData = {
                        summary: updateData.summary || currentData.overviewData?.summary,
                        characters: updateData.characters || currentData.overviewData?.characters,
                        shots: updateData.shots || currentData.overviewData?.shots,
                    };

                    return {
                        ...item,
                        data: {
                            ...currentData,
                            overviewData: mergedOverviewData,
                            status: isCompleted ? 'completed' : 'streaming',
                        },
                    };
                }));

                console.log('[Content_Create] Updated script overview card:', { overviewItemId, updateData });
                break;
            }

            case 'add_character': {
                if (!params) break;

                // 将角色数据转换为 CharacterItemData 格式
                const newCharacter: CharacterItemData = {
                    id: params.id as string || `char-${Date.now()}`,
                    name: params.name as string || 'Unknown',
                    prompt: params.prompt as string || params.description as string || '',
                    mainImageUrl: params.image_url as string,
                    threeViewUrl: params.three_view_url as string,
                };

                // 检查是否已有激活的 CharactersCard
                if (activeCharactersIdRef.current) {
                    // 更新已有的 CharactersCard，添加新角色
                    setItems(prev => prev.map(item => {
                        if (item.id !== activeCharactersIdRef.current) return item;
                        const itemData = item.data as { itemType: string; characters?: CharacterItemData[] };
                        const existingCharacters = itemData.characters || [];
                        return {
                            ...item,
                            data: {
                                ...itemData,
                                characters: [...existingCharacters, newCharacter],
                            },
                        };
                    }));
                    console.log('[Content_Create] Added character to existing CharactersCard:', { characterId: newCharacter.id });
                } else {
                    // 创建新的 CharactersCard
                    // 找到激活的 ScriptOverviewCard 位置作为参考
                    const activeOverview = activeScriptOverviewIdRef.current
                        ? items.find(item => item.id === activeScriptOverviewIdRef.current)
                        : null;

                    // CharactersCard 位置：在 ScriptOverviewCard 下方
                    const position: Point = {
                        x: activeOverview ? activeOverview.x : 100,
                        y: activeOverview
                            ? activeOverview.y + (activeOverview.height || 450) + 40
                            : 500,
                    };

                    const newItemId = `characters-${Date.now()}`;
                    const newItem: CanvasItemData = {
                        id: newItemId,
                        x: position.x,
                        y: position.y,
                        width: DEFAULT_CHARACTERS_SIZE.width,
                        height: DEFAULT_CHARACTERS_SIZE.height,
                        data: {
                            itemType: 'characters' as CanvasItemType,
                            characters: [newCharacter],
                        },
                    };

                    // 添加 CharactersCard 到画布
                    addItem(newItem);

                    // 记录当前激活的 CharactersCard ID
                    activeCharactersIdRef.current = newItemId;

                    // 从 ScriptOverviewCard 连线到 CharactersCard
                    if (activeScriptOverviewIdRef.current) {
                        const newConnection: Connection = {
                            id: `conn-overview-characters-${Date.now()}`,
                            sourceId: activeScriptOverviewIdRef.current,
                            targetId: newItemId,
                        };
                        setConnections(prev => [...prev, newConnection]);
                    }

                    console.log('[Content_Create] Created CharactersCard:', { newItemId, position });
                }
                break;
            }
            case 'update_character': {
                if (!params || !activeCharactersIdRef.current) break;

                const characterId = params.id as string;
                if (!characterId) break;

                // 更新 CharactersCard 中的指定角色
                setItems(prev => prev.map(item => {
                    if (item.id !== activeCharactersIdRef.current) return item;
                    const itemData = item.data as { itemType: string; characters?: CharacterItemData[] };
                    const updatedCharacters = (itemData.characters || []).map(char => {
                        if (char.id !== characterId) return char;
                        return {
                            ...char,
                            name: params.name as string || char.name,
                            prompt: params.prompt as string || params.description as string || char.prompt,
                            mainImageUrl: params.image_url as string || char.mainImageUrl,
                            threeViewUrl: params.three_view_url as string || char.threeViewUrl,
                        };
                    });
                    return {
                        ...item,
                        data: {
                            ...itemData,
                            characters: updatedCharacters,
                        },
                    };
                }));
                console.log('[Content_Create] Updated character in CharactersCard:', { characterId });
                break;
            }
            case 'add_character_concept': {
                // 添加角色概念图/三视图
                if (!params || !activeCharactersIdRef.current) break;

                const characterId = params.id as string;
                const conceptUrl = params.concept_url as string;
                if (!characterId || !conceptUrl) break;

                // 更新 CharactersCard 中指定角色的三视图
                setItems(prev => prev.map(item => {
                    if (item.id !== activeCharactersIdRef.current) return item;
                    const itemData = item.data as { itemType: string; characters?: CharacterItemData[] };
                    const updatedCharacters = (itemData.characters || []).map(char => {
                        if (char.id !== characterId) return char;
                        return {
                            ...char,
                            threeViewUrl: conceptUrl,
                        };
                    });
                    return {
                        ...item,
                        data: {
                            ...itemData,
                            characters: updatedCharacters,
                        },
                    };
                }));
                console.log('[Content_Create] Added character concept:', { characterId, conceptUrl });
                break;
            }

            case 'add_storyboard': {
                // 添加分镜列表
                if (!params) break;

                const shotsData = params.shots as Array<{
                    id?: string;
                    shot_number?: number;
                    description?: string;
                    thumbnail_url?: string;
                    video_url?: string;
                }> || [];

                // 转换为 ShotItemData 格式
                const shots: ShotItemData[] = shotsData.map((shot, index) => ({
                    id: shot.id || `shot-${Date.now()}-${index}`,
                    shotNumber: shot.shot_number || index + 1,
                    description: shot.description,
                    thumbnailUrl: shot.thumbnail_url,
                    videoUrl: shot.video_url,
                    isGenerating: false,
                }));

                // 检查是否已有激活的 ShotsCard
                if (activeShotsIdRef.current) {
                    // 更新已有的 ShotsCard，添加新分镜
                    setItems(prev => prev.map(item => {
                        if (item.id !== activeShotsIdRef.current) return item;
                        const itemData = item.data as { itemType: string; shots?: ShotItemData[] };
                        const existingShots = itemData.shots || [];
                        return {
                            ...item,
                            data: {
                                ...itemData,
                                shots: [...existingShots, ...shots],
                            },
                        };
                    }));
                    console.log('[Content_Create] Added shots to existing ShotsCard:', { count: shots.length });
                } else {
                    // 创建新的 ShotsCard
                    // 找到激活的 CharactersCard 位置作为参考
                    const activeCharacters = activeCharactersIdRef.current
                        ? items.find(item => item.id === activeCharactersIdRef.current)
                        : null;
                    // 如果没有 CharactersCard，找 ScriptOverviewCard
                    const activeOverview = activeScriptOverviewIdRef.current
                        ? items.find(item => item.id === activeScriptOverviewIdRef.current)
                        : null;

                    const referenceItem = activeCharacters || activeOverview;

                    // ShotsCard 位置：在参考卡片下方
                    const position: Point = {
                        x: referenceItem ? referenceItem.x : 100,
                        y: referenceItem
                            ? referenceItem.y + (referenceItem.height || 450) + 40
                            : 800,
                    };

                    const newItemId = `shots-${Date.now()}`;
                    const newItem: CanvasItemData = {
                        id: newItemId,
                        x: position.x,
                        y: position.y,
                        width: DEFAULT_SHOTS_SIZE.width,
                        height: DEFAULT_SHOTS_SIZE.height,
                        data: {
                            itemType: 'shots' as CanvasItemType,
                            shots,
                        },
                    };

                    // 添加 ShotsCard 到画布
                    addItem(newItem);

                    // 记录当前激活的 ShotsCard ID
                    activeShotsIdRef.current = newItemId;

                    // 从 CharactersCard 或 ScriptOverviewCard 连线到 ShotsCard
                    const sourceId = activeCharactersIdRef.current || activeScriptOverviewIdRef.current;
                    if (sourceId) {
                        const newConnection: Connection = {
                            id: `conn-shots-${Date.now()}`,
                            sourceId,
                            targetId: newItemId,
                        };
                        setConnections(prev => [...prev, newConnection]);
                    }

                    console.log('[Content_Create] Created ShotsCard:', { newItemId, shotCount: shots.length });
                }
                break;
            }

            case 'init_shots': {
                // 初始化分镜卡片（从消息解析得到分镜数量）
                if (!params) break;

                const shotCount = params.shot_count as number;
                const scriptTitle = params.script_title as string;

                if (!shotCount || shotCount <= 0) break;

                // 如果已有激活的 ShotsCard，跳过
                if (activeShotsIdRef.current) {
                    console.log('[Content_Create] ShotsCard already exists, skipping init');
                    break;
                }

                // 创建空的分镜子卡片（状态为generating）
                const shots: ShotItemData[] = Array.from({ length: shotCount }, (_, index) => ({
                    id: `shot-${Date.now()}-${index}`,
                    shotNumber: index + 1,
                    description: undefined,
                    thumbnailUrl: undefined,
                    videoUrl: undefined,
                    isGenerating: true,
                }));

                // 找到激活的 CharactersCard 位置作为参考
                const activeCharacters = activeCharactersIdRef.current
                    ? items.find(item => item.id === activeCharactersIdRef.current)
                    : null;
                const activeOverview = activeScriptOverviewIdRef.current
                    ? items.find(item => item.id === activeScriptOverviewIdRef.current)
                    : null;

                const referenceItem = activeCharacters || activeOverview;

                // ShotsCard 位置：在参考卡片下方
                const position: Point = {
                    x: referenceItem ? referenceItem.x : 100,
                    y: referenceItem
                        ? referenceItem.y + (referenceItem.height || 450) + 40
                        : 800,
                };

                const newItemId = `shots-${Date.now()}`;
                const newItem: CanvasItemData = {
                    id: newItemId,
                    x: position.x,
                    y: position.y,
                    width: DEFAULT_SHOTS_SIZE.width,
                    height: DEFAULT_SHOTS_SIZE.height,
                    data: {
                        itemType: 'shots' as CanvasItemType,
                        shots,
                        scriptTitle,
                    },
                };

                // 添加 ShotsCard 到画布
                addItem(newItem);

                // 记录当前激活的 ShotsCard ID
                activeShotsIdRef.current = newItemId;

                // 从 CharactersCard 连线到 ShotsCard
                if (activeCharactersIdRef.current) {
                    const newConnection: Connection = {
                        id: `conn-shots-${Date.now()}`,
                        sourceId: activeCharactersIdRef.current,
                        targetId: newItemId,
                    };
                    setConnections(prev => [...prev, newConnection]);
                }

                console.log('[Content_Create] Initialized ShotsCard:', { newItemId, shotCount, scriptTitle });
                break;
            }

            case 'update_shot': {
                // 更新单个分镜的数据
                if (!params || !activeShotsIdRef.current) break;

                const shotNumber = params.shot_number as number;
                const prompt = params.prompt as string;
                const videoUrl = params.video_url as string;
                const status = params.status as string;

                if (!shotNumber) break;

                setItems(prev => prev.map(item => {
                    if (item.id !== activeShotsIdRef.current) return item;
                    const itemData = item.data as { itemType: string; shots?: ShotItemData[] };
                    const updatedShots = (itemData.shots || []).map(shot => {
                        if (shot.shotNumber !== shotNumber) return shot;
                        return {
                            ...shot,
                            description: prompt || shot.description,
                            videoUrl: videoUrl || shot.videoUrl,
                            isGenerating: status !== 'completed',
                        };
                    });
                    return {
                        ...item,
                        data: { ...itemData, shots: updatedShots },
                    };
                }));

                console.log('[Content_Create] Updated shot:', { shotNumber, status });
                break;
            }
            case 'highlight':
                // TODO: 高亮指定元素
                console.log('[Content_Create] Highlight:', params);
                break;
            case 'connect':
                // TODO: 创建连接线
                console.log('[Content_Create] Connect:', params);
                break;
            case 'await_confirm':
                // 剧本解析完成，更新状态
                if (activeScriptOverviewIdRef.current) {
                    setItems(prev => prev.map(item => {
                        if (item.id !== activeScriptOverviewIdRef.current) return item;
                        const currentData = item.data as { itemType: string; overviewData: ScriptOverviewData; status: ScriptOverviewStatus };
                        return {
                            ...item,
                            data: {
                                ...currentData,
                                status: 'completed' as ScriptOverviewStatus,
                            },
                        };
                    }));
                }
                console.log('[Content_Create] Await confirm:', params);
                break;
            default:
                console.log('[Content_Create] Unknown canvas action:', action);
        }
    }, [items, addItem, setItems]);

    // 订阅画布事件
    useEffect(() => {
        const unsubscribe = subscribeCanvasEvent(handleCanvasEvent);
        return unsubscribe;
    }, [subscribeCanvasEvent, handleCanvasEvent]);

    /**
     * 渲染画布元素
     */
    const renderItem = useCallback((item: CanvasItemData) => {
        const itemData = item.data || {};
        const itemType = (itemData as { itemType?: CanvasItemType }).itemType;

        // 渲染 CharacterCard
        if (itemType === 'character') {
            const { character } = itemData as { character?: CharacterData };
            if (!character) {
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
                        Invalid Character Data
                    </div>
                );
            }

            return (
                <CharacterCard
                    character={character}
                    onDelete={() => handleRemoveItem(item.id)}
                    onResize={(size) => handleResize(item.id, size)}
                />
            );
        }

        // 渲染 CharactersCard（多角色集合卡片）
        if (itemType === 'characters') {
            const { characters } = itemData as {
                characters?: CharacterItemData[];
            };

            return (
                <CharactersCard
                    characters={characters || []}
                    onDelete={() => handleRemoveItem(item.id)}
                    onUpdatePrompt={handleUpdateCharacterPrompt}
                    onStartGenerate={activeScriptUrlRef.current ? handleStartGenerateShots : undefined}
                    isProcessing={streamStatus === 'streaming'}
                    isLocked={charactersLocked}
                />
            );
        }

        // 渲染 ShotsCard（分镜列表卡片）
        if (itemType === 'shots') {
            const { shots } = itemData as {
                shots?: ShotItemData[];
            };

            return (
                <ShotsCard
                    shots={shots || []}
                    onDelete={() => handleRemoveItem(item.id)}
                    onEditShot={(shotId) => console.log('[Content_Create] Edit shot:', shotId)}
                    onRefreshShot={(shotId) => console.log('[Content_Create] Refresh shot:', shotId)}
                    onCopyShot={(shotId) => console.log('[Content_Create] Copy shot:', shotId)}
                    onDownloadShot={(shotId) => console.log('[Content_Create] Download shot:', shotId)}
                    onDeleteShot={(shotId) => console.log('[Content_Create] Delete shot:', shotId)}
                    onEditShots={() => console.log('[Content_Create] Edit storyboard')}
                    onUpdateFinalVideo={() => console.log('[Content_Create] Update final video')}
                />
            );
        }

        // 渲染 ScriptOverviewCard
        if (itemType === 'script_overview') {
            const { overviewData, status, errorMessage, characterCount, shotCount, scriptUrl } = itemData as {
                overviewData?: ScriptOverviewData;
                status?: ScriptOverviewStatus;
                errorMessage?: string;
                characterCount?: number;
                shotCount?: number;
                scriptUrl?: string;
            };

            return (
                <ScriptOverviewCard
                    data={overviewData || {}}
                    status={status || 'loading'}
                    errorMessage={errorMessage}
                    characterCount={characterCount}
                    shotCount={shotCount}
                    onDelete={() => handleRemoveItem(item.id)}
                    onStartDesign={scriptUrl ? () => startCharacterDesign(scriptUrl) : undefined}
                    isProcessing={streamStatus === 'streaming'}
                />
            );
        }

        // 渲染 ScriptCard
        if (itemType === 'script') {
            const {
                fileName,
                fileType,
                fileSize,
                status,
                content,
                errorMessage,
                isSubmitting,
                warningMessage,
                parsedUrl,
            } = itemData as {
                fileName?: string;
                fileType?: ScriptFileType;
                fileSize?: number;
                status?: ScriptParseStatus;
                content?: string;
                errorMessage?: string;
                isSubmitting?: boolean;
                warningMessage?: string;
                parsedUrl?: string;
            };

            // 检查该 ScriptCard 是否已建立连接
            const isConnected = connections.some(conn => conn.sourceId === item.id);

            return (
                <ScriptCard
                    fileName={fileName || 'Unknown'}
                    fileType={fileType || 'txt'}
                    fileSize={fileSize || 0}
                    status={status || 'parsing'}
                    content={content}
                    parsedUrl={parsedUrl}
                    errorMessage={errorMessage}
                    warningMessage={warningMessage}
                    isSubmitting={isSubmitting}
                    isConnected={isConnected}
                    onDelete={() => handleRemoveItem(item.id)}
                    onGenerate={(params) => handleScriptGenerate(item.id, params)}
                    onSubmitContent={(content) => handleScriptSubmitContent(item.id, content)}
                    onStartCreate={(url) => handleStartCreate(item.id, url)}
                />
            );
        }

        // 渲染 MediaCard（图片/视频）
        const {
            type,
            status,
            src,
            prompt,
            styleValue,
            model,
        } = itemData as {
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
                onSizeChange={(size) => handleSizeChange(item.id, size)}
            />
        );
    }, [connections, handleRemoveItem, handleGenerate, handleScriptGenerate, handleScriptSubmitContent, handleStartCreate, handleResize, handlePromptChange, handleStyleChange, handleModelChange, handleSubmit, handleStop, handleSizeChange, startCharacterDesign, streamStatus, handleUpdateCharacterPrompt, handleStartGenerateShots, charactersLocked]);

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
                selectedItemId={selectedItemId}
                onItemSelect={setSelectedItemId}
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
                        <span className={styles.drag_overlay_hint}>Supports images, videos, and documents (txt, md, pdf, doc)</span>
                    </div>
                </div>
            )}
        </div>
    );
}
