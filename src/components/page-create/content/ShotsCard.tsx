'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Trash2, Pencil, RefreshCw, MoreHorizontal, Play, Copy, Download, X } from 'lucide-react';
import styles from './ShotsCard.module.css';
import { cn } from '@/lib/utils';

// ==================== 类型定义 ====================

/** 分镜数据 */
export interface ShotItemData {
    /** 分镜ID */
    id: string;
    /** 镜头编号 */
    shotNumber: number;
    /** 分镜描述 */
    description?: string;
    /** 视频预览图 URL */
    thumbnailUrl?: string;
    /** 视频 URL */
    videoUrl?: string;
    /** 是否正在生成 */
    isGenerating?: boolean;
}

/** ShotsCard Props */
export interface ShotsCardProps {
    /** 分镜列表 */
    shots: ShotItemData[];
    /** 删除整个卡片回调 */
    onDelete?: () => void;
    /** 编辑分镜回调 */
    onEditShot?: (shotId: string) => void;
    /** 刷新分镜回调 */
    onRefreshShot?: (shotId: string) => void;
    /** 复制分镜回调 */
    onCopyShot?: (shotId: string) => void;
    /** 下载分镜回调 */
    onDownloadShot?: (shotId: string) => void;
    /** 删除分镜回调 */
    onDeleteShot?: (shotId: string) => void;
    /** 编辑分镜按钮回调 */
    onEditShots?: () => void;
    /** 更新最终视频回调 */
    onUpdateFinalVideo?: () => void;
}

// ==================== 子组件：分镜子卡片 ====================

interface ShotSubCardProps {
    shot: ShotItemData;
    onEdit?: () => void;
    onRefresh?: () => void;
    onCopy?: () => void;
    onDownload?: () => void;
    onDelete?: () => void;
}

function ShotSubCard({
    shot,
    onEdit,
    onRefresh,
    onCopy,
    onDownload,
    onDelete,
}: ShotSubCardProps) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);

    // 点击外部关闭菜单
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setShowMenu(false);
            }
        };
        if (showMenu) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [showMenu]);

    // 播放/暂停视频
    const handlePlayClick = useCallback(() => {
        if (shot.videoUrl) {
            setIsPlaying(true);
        }
    }, [shot.videoUrl]);

    // 关闭视频
    const handleCloseVideo = useCallback(() => {
        setIsPlaying(false);
        if (videoRef.current) {
            videoRef.current.pause();
            videoRef.current.currentTime = 0;
        }
    }, []);

    // 菜单操作
    const handleMenuAction = useCallback((action: 'copy' | 'download' | 'delete') => {
        setShowMenu(false);
        switch (action) {
            case 'copy':
                onCopy?.();
                break;
            case 'download':
                onDownload?.();
                break;
            case 'delete':
                onDelete?.();
                break;
        }
    }, [onCopy, onDownload, onDelete]);

    return (
        <div className={styles.shot_card}>
            {/* 视频预览区域 */}
            <div className={styles.preview_container}>
                {isPlaying && shot.videoUrl ? (
                    <div className={styles.video_wrapper}>
                        <video
                            ref={videoRef}
                            src={shot.videoUrl}
                            className={styles.video_player}
                            controls
                            autoPlay
                        />
                        <button
                            className={styles.close_video_btn}
                            onClick={handleCloseVideo}
                        >
                            <X className="size-4" />
                        </button>
                    </div>
                ) : (
                    <div className={styles.thumbnail_wrapper} onClick={handlePlayClick}>
                        {shot.thumbnailUrl ? (
                            <img
                                src={shot.thumbnailUrl}
                                alt={`Shot ${shot.shotNumber}`}
                                className={styles.thumbnail}
                            />
                        ) : (
                            <div className={styles.thumbnail_placeholder}>
                                <Play className="size-8 text-gray-400" />
                            </div>
                        )}
                        {shot.videoUrl && (
                            <div className={styles.play_overlay}>
                                <Play className="size-10" />
                            </div>
                        )}
                        {shot.isGenerating && (
                            <div className={styles.generating_overlay}>
                                <span>Generating...</span>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 分镜信息 */}
            <div className={styles.shot_info}>
                <h4 className={styles.shot_title}>Shot {shot.shotNumber}</h4>
                <p className={styles.shot_description}>
                    {shot.description || 'No description'}
                </p>
            </div>

            {/* 底部操作栏 */}
            <div className={styles.shot_actions}>
                {/* 左侧：编辑和刷新 */}
                <div className={styles.actions_left}>
                    <button
                        className={styles.action_btn}
                        onClick={onEdit}
                        title="Edit"
                    >
                        <Pencil className="size-3.5" />
                    </button>
                    <button
                        className={styles.action_btn}
                        onClick={onRefresh}
                        title="Refresh"
                    >
                        <RefreshCw className="size-3.5" />
                    </button>
                </div>

                {/* 右侧：更多菜单 */}
                <div className={styles.actions_right} ref={menuRef}>
                    <button
                        className={styles.action_btn}
                        onClick={() => setShowMenu(!showMenu)}
                        title="More"
                    >
                        <MoreHorizontal className="size-4" />
                    </button>

                    {/* 下拉菜单 */}
                    {showMenu && (
                        <div className={styles.dropdown_menu}>
                            <button
                                className={styles.menu_item}
                                onClick={() => handleMenuAction('copy')}
                            >
                                <Copy className="size-3.5" />
                                <span>Copy</span>
                            </button>
                            <button
                                className={styles.menu_item}
                                onClick={() => handleMenuAction('download')}
                            >
                                <Download className="size-3.5" />
                                <span>Download</span>
                            </button>
                            <button
                                className={cn(styles.menu_item, styles.menu_item_danger)}
                                onClick={() => handleMenuAction('delete')}
                            >
                                <Trash2 className="size-3.5" />
                                <span>Delete</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ==================== 主组件 ====================

/**
 * 分镜列表卡片组件
 * 用于在画布上显示分镜列表
 */
export default function ShotsCard({
    shots,
    onDelete,
    onEditShot,
    onRefreshShot,
    onCopyShot,
    onDownloadShot,
    onDeleteShot,
    onEditShots,
    onUpdateFinalVideo,
}: ShotsCardProps) {
    // 处理删除
    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete?.();
    };

    return (
        <div className={styles.shots_card}>
            {/* 头部 */}
            <div className={styles.header}>
                <div className={styles.header_title}>
                    <span>Storyboard</span>
                    <span className={styles.shot_count}>{shots.length}</span>
                </div>
                <div className={styles.header_actions}>
                    {onDelete && (
                        <button
                            className={styles.delete_btn}
                            onClick={handleDelete}
                            title="Delete"
                        >
                            <Trash2 className="size-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* 分镜网格 */}
            <div className={styles.shots_grid}>
                {shots.length === 0 ? (
                    <div className={styles.empty_state}>
                        <p>No shots available</p>
                    </div>
                ) : (
                    shots.map((shot) => (
                        <ShotSubCard
                            key={shot.id}
                            shot={shot}
                            onEdit={onEditShot ? () => onEditShot(shot.id) : undefined}
                            onRefresh={onRefreshShot ? () => onRefreshShot(shot.id) : undefined}
                            onCopy={onCopyShot ? () => onCopyShot(shot.id) : undefined}
                            onDownload={onDownloadShot ? () => onDownloadShot(shot.id) : undefined}
                            onDelete={onDeleteShot ? () => onDeleteShot(shot.id) : undefined}
                        />
                    ))
                )}
            </div>

            {/* 底部按钮 */}
            <div className={styles.footer}>
                <button
                    className={styles.footer_btn}
                    onClick={onEditShots}
                >
                    <Pencil className="size-4" />
                    <span>Edit Storyboard</span>
                </button>
                <button
                    className={cn(styles.footer_btn, styles.footer_btn_primary)}
                    onClick={onUpdateFinalVideo}
                >
                    <Play className="size-4" />
                    <span>Update Final Video</span>
                </button>
            </div>
        </div>
    );
}
