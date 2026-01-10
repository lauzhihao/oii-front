'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, FileText, FileType, File, AlertCircle, AlertTriangle, Plus, BookOpen, Users, Loader2, Pencil, Check, X, Play } from 'lucide-react';
import MarkdownRenderer from '@/components/common/markdown/MarkdownRenderer';
import styles from './ScriptCard.module.css';
import { cn } from '@/lib/utils';

// ==================== 类型定义 ====================

/** 支持的剧本文件类型（仅支持 txt/md/pdf/docx） */
export type ScriptFileType = 'txt' | 'md' | 'pdf' | 'docx';

/** 解析状态 */
export type ScriptParseStatus = 'parsing' | 'loaded' | 'error';

/** 生成类型 */
export type GenerateType = 'analyze-script' | 'analyze-character';

/** 生成事件参数 */
export interface GenerateEventParams {
    type: GenerateType;
    position: { x: number; y: number };
    /** 剧本内容（可作为生成参考） */
    scriptContent?: string;
}

/** ScriptCard Props */
export interface ScriptCardProps {
    /** 文件名 */
    fileName: string;
    /** 文件类型 */
    fileType: ScriptFileType;
    /** 文件大小（字节） */
    fileSize: number;
    /** 解析状态 */
    status: ScriptParseStatus;
    /** 文本内容（解析后） */
    content?: string;
    /** 解析后的 URL */
    parsedUrl?: string;
    /** 错误信息 */
    errorMessage?: string;
    /** 警告信息（如不支持的格式） */
    warningMessage?: string;
    /** 是否正在提交解析 */
    isSubmitting?: boolean;
    /** 是否已建立连接（只读模式） */
    isConnected?: boolean;
    /** 删除回调 */
    onDelete?: () => void;
    /** 生成回调 */
    onGenerate?: (params: GenerateEventParams) => void;
    /** 内容变更回调 */
    onContentChange?: (content: string) => void;
    /** 提交内容解析回调 */
    onSubmitContent?: (content: string) => void;
    /** 开始创作回调（传入 parsedUrl） */
    onStartCreate?: (parsedUrl: string) => void;
}

// ==================== 工具函数 ====================

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * 获取文件类型图标样式
 */
function getFileIconClass(fileType: ScriptFileType): string {
    switch (fileType) {
        case 'txt':
            return styles.file_icon_txt;
        case 'md':
            return styles.file_icon_md;
        case 'pdf':
            return styles.file_icon_pdf;
        case 'docx':
            return styles.file_icon_doc;
        default:
            return '';
    }
}

/**
 * 获取文件类型图标
 */
function FileIcon({ fileType }: { fileType: ScriptFileType }) {
    switch (fileType) {
        case 'txt':
            return <FileText className="size-4" />;
        case 'md':
            return <FileType className="size-4" />;
        case 'pdf':
        case 'docx':
            return <File className="size-4" />;
        default:
            return <FileText className="size-4" />;
    }
}

// ==================== 组件 ====================

/**
 * 剧本卡片组件
 * 用于显示和管理拖入的文档文件（txt, md, pdf, doc）
 */
export default function ScriptCard({
    fileName,
    fileType,
    fileSize,
    status,
    content = '',
    parsedUrl,
    errorMessage,
    warningMessage,
    isSubmitting = false,
    isConnected = false,
    onDelete,
    onGenerate,
    onContentChange,
    onSubmitContent,
    onStartCreate,
}: ScriptCardProps) {
    // 是否处于编辑模式
    const [isEditing, setIsEditing] = useState(false);

    // 可编辑内容
    const [editableContent, setEditableContent] = useState(content);

    // 原始内容（用于判断是否修改）
    const [originalContent, setOriginalContent] = useState(content);

    // 是否展开内容（保留但不再使用）
    const [isExpanded, setIsExpanded] = useState(false);

    // 连接线拖拽状态
    const [isDragging, setIsDragging] = useState(false);
    const [linePoints, setLinePoints] = useState<{
        startX: number;
        startY: number;
        endX: number;
        endY: number;
    } | null>(null);

    // 菜单状态
    const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);

    // 连接点按钮ref
    const connectorRef = useRef<HTMLButtonElement>(null);

    // 处理删除点击
    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete?.();
    };

    // 切换展开/折叠
    const toggleExpand = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsExpanded(!isExpanded);
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
                scriptContent: editableContent,
            });
        }
        setMenuPosition(null);
    }, [onGenerate, menuPosition, editableContent]);

    // 处理内容编辑
    const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newContent = e.target.value;
        setEditableContent(newContent);
        onContentChange?.(newContent);
    }, [onContentChange]);

    // 处理提交解析
    const handleSubmitContent = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (editableContent.trim() && onSubmitContent) {
            onSubmitContent(editableContent);
        }
    }, [editableContent, onSubmitContent]);

    // 同步外部content变化
    useEffect(() => {
        setEditableContent(content);
        setOriginalContent(content);
    }, [content]);

    // 判断内容是否被修改
    const isContentModified = editableContent !== originalContent;

    // 进入编辑模式
    const handleEnterEdit = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setIsEditing(true);
    }, []);

    // 保存编辑
    const handleSaveEdit = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setOriginalContent(editableContent);
        setIsEditing(false);
        onContentChange?.(editableContent);
    }, [editableContent, onContentChange]);

    // 取消编辑
    const handleCancelEdit = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        setEditableContent(originalContent);
        setIsEditing(false);
    }, [originalContent]);

    // 处理开始创作
    const handleStartCreate = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        if (isContentModified && onSubmitContent) {
            // 内容有修改，重新上传解析
            onSubmitContent(editableContent);
        } else if (parsedUrl && onStartCreate) {
            // 内容无修改，直接开始创作
            onStartCreate(parsedUrl);
        }
    }, [isContentModified, editableContent, parsedUrl, onSubmitContent, onStartCreate]);

    // 生成贝塞尔曲线路径
    const generateCurvePath = (points: typeof linePoints): string => {
        if (!points) return '';
        const { startX, startY, endX, endY } = points;
        const controlOffset = Math.abs(endX - startX) * 0.5;
        return `M ${startX} ${startY} C ${startX + controlOffset} ${startY}, ${endX - controlOffset} ${endY}, ${endX} ${endY}`;
    };

    return (
        <div className={styles.script_card}>
            {/* 头部：文件信息 */}
            <div className={styles.header}>
                <div className={cn(styles.file_icon, getFileIconClass(fileType))}>
                    <FileIcon fileType={fileType} />
                </div>
                <span className={styles.file_name} title={fileName}>
                    {fileName}
                </span>
                <div className={styles.header_actions}>
                    {status === 'loaded' && !isEditing && !isConnected && (
                        <button
                            className={styles.edit_btn}
                            onClick={handleEnterEdit}
                            title="Edit"
                        >
                            <Pencil className="size-3.5" />
                        </button>
                    )}
                    {status === 'loaded' && isEditing && (
                        <>
                            <button
                                className={styles.save_btn}
                                onClick={handleSaveEdit}
                                title="Save"
                            >
                                <Check className="size-3.5" />
                            </button>
                            <button
                                className={styles.cancel_btn}
                                onClick={handleCancelEdit}
                                title="Cancel"
                            >
                                <X className="size-3.5" />
                            </button>
                        </>
                    )}
                    {!isEditing && !isConnected && onDelete && (
                        <button
                            className={styles.delete_btn}
                            onClick={handleDelete}
                            title="Delete"
                        >
                            <Trash2 className="size-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* 内容区域 */}
            {status === 'parsing' && (
                <div className={styles.loading_container}>
                    <div className={styles.loading_spinner} />
                    <span className={styles.loading_text}>Parsing...</span>
                </div>
            )}

            {status === 'error' && (
                <div className={styles.error_container}>
                    <AlertCircle className={cn('size-6', styles.error_icon)} />
                    <span className={styles.error_text}>
                        {errorMessage || 'Failed to parse file'}
                    </span>
                </div>
            )}

            {status === 'loaded' && (
                <div className={styles.content_area}>
                    {warningMessage && (
                        <div className={styles.warning_container}>
                            <AlertTriangle className="size-4" />
                            <span>{warningMessage}</span>
                        </div>
                    )}
                    {isEditing ? (
                        <textarea
                            className={styles.content_textarea}
                            value={editableContent}
                            onChange={handleContentChange}
                            placeholder="Enter script content here..."
                            maxLength={2000}
                        />
                    ) : (
                        <div className={styles.content_preview}>
                            <MarkdownRenderer content={editableContent || '(Empty)'} variant="content" />
                        </div>
                    )}
                </div>
            )}

            {/* 底部：元信息 */}
            <div className={styles.footer}>
                <div className={styles.meta_info}>
                    <span className={styles.file_type_badge}>{fileType}</span>
                    <span>{formatFileSize(fileSize)}</span>
                    {isContentModified && (
                        <span className={styles.modified_badge}>Modified</span>
                    )}
                </div>
                {/* 开始创作按钮 - 仅在 loaded 状态且非编辑模式且未连接时显示 */}
                {status === 'loaded' && !isEditing && !isConnected && onStartCreate && (
                    <button
                        className={cn(
                            styles.create_btn,
                            isSubmitting && styles.create_btn_loading
                        )}
                        onClick={handleStartCreate}
                        disabled={isSubmitting || !editableContent.trim()}
                        title={isContentModified ? 'Re-parse and start' : 'Start creating'}
                    >
                        {isSubmitting ? (
                            <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                            <Play className="size-3.5" />
                        )}
                        <span>{isSubmitting ? 'Processing' : 'Start'}</span>
                    </button>
                )}
            </div>

            {/* 连接点 - 只在loaded状态且未连接时显示 */}
            {status === 'loaded' && !isConnected && (
                <div className={styles.connector}>
                    <button
                        ref={connectorRef}
                        className={styles.connector_btn}
                        onMouseDown={handleConnectorMouseDown}
                        title="Generate from script"
                    >
                        <Plus className="size-3" />
                    </button>
                </div>
            )}

            {/* 连接线 - 使用 Portal 渲染到 body */}
            {isDragging && linePoints && typeof document !== 'undefined' && createPortal(
                <svg
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        pointerEvents: 'none',
                        zIndex: 9999,
                    }}
                >
                    <defs>
                        <linearGradient id="script-connection-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#4285F4" />
                            <stop offset="50%" stopColor="#34A853" />
                            <stop offset="100%" stopColor="#FBBC05" />
                        </linearGradient>
                    </defs>
                    <path
                        d={generateCurvePath(linePoints)}
                        fill="none"
                        stroke="url(#script-connection-gradient)"
                        strokeWidth="2"
                        strokeLinecap="round"
                    />
                    <circle
                        cx={linePoints.endX}
                        cy={linePoints.endY}
                        r="6"
                        fill="url(#script-connection-gradient)"
                    />
                </svg>,
                document.body
            )}

            {/* 生成菜单 - 使用 Portal 渲染到 body */}
            {menuPosition && typeof document !== 'undefined' && createPortal(
                <>
                    <div
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100vw',
                            height: '100vh',
                            zIndex: 9998,
                        }}
                        onClick={handleCloseMenu}
                    />
                    <div
                        style={{
                            position: 'fixed',
                            left: menuPosition.x,
                            top: menuPosition.y,
                            transform: 'translate(-50%, -50%)',
                            background: 'white',
                            borderRadius: '12px',
                            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
                            padding: '8px',
                            zIndex: 9999,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                            minWidth: '160px',
                        }}
                    >
                        <button
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 12px',
                                border: 'none',
                                background: 'transparent',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                color: '#333',
                                transition: 'background 0.2s',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            onClick={() => handleGenerateClick('analyze-script')}
                        >
                            <BookOpen className="size-4" />
                            <span>分析剧本</span>
                        </button>
                        <button
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                padding: '10px 12px',
                                border: 'none',
                                background: 'transparent',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '14px',
                                color: '#333',
                                transition: 'background 0.2s',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            onClick={() => handleGenerateClick('analyze-character')}
                        >
                            <Users className="size-4" />
                            <span>解析角色</span>
                        </button>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
}
