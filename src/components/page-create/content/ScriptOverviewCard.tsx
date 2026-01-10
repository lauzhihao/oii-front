'use client';

import { Trash2, User, Film, Loader2, Sparkles, Play } from 'lucide-react';
import styles from './ScriptOverviewCard.module.css';

// ==================== 类型定义 ====================

/** 角色关键信息（匹配后端 key_details 结构） */
export interface CharacterKeyDetails {
    /** 站位描述 */
    positioning?: string;
    /** 道具描述 */
    props?: string[];
    /** 物品方向 */
    items_direction?: string;
    /** 其他关键信息 */
    other?: string;
    /** 扩展字段 */
    [key: string]: unknown;
}

/** 角色信息 */
export interface ScriptCharacter {
    /** 角色 ID */
    id?: string;
    /** 角色名称 */
    name: string;
    /** 性别 */
    gender?: string;
    /** 年龄 */
    age?: number | string | null;
    /** 年龄组 */
    age_group?: string;
    /** 详细描述 */
    description?: string;
    /** 关键内容 */
    key_details?: CharacterKeyDetails;
}

/** 分镜信息 */
export interface ScriptShot {
    /** 镜头编号 */
    shot_number: number;
    /** 镜头描述 */
    description: string;
}

/** 剧本解析数据 */
export interface ScriptOverviewData {
    /** 剧本标题 */
    title?: string;
    /** 剧本摘要 */
    summary?: string;
    /** 角色清单 */
    characters?: ScriptCharacter[];
    /** 分镜描述 */
    shots?: ScriptShot[];
}

/** 解析状态 */
export type ScriptOverviewStatus = 'loading' | 'streaming' | 'completed' | 'error';

/** ScriptOverviewCard Props */
export interface ScriptOverviewCardProps {
    /** 解析数据 */
    data: ScriptOverviewData;
    /** 解析状态 */
    status: ScriptOverviewStatus;
    /** 错误信息 */
    errorMessage?: string;
    /** 角色数量（加载时预览） */
    characterCount?: number;
    /** 分镜数量（加载时预览） */
    shotCount?: number;
    /** 删除回调 */
    onDelete?: () => void;
    /** 开始角色设计回调 */
    onStartDesign?: () => void;
    /** 是否正在处理 */
    isProcessing?: boolean;
}

// ==================== 组件 ====================

/**
 * 剧本解析概览卡片组件
 * 用于显示剧本的摘要、角色清单、分镜描述
 */
export default function ScriptOverviewCard({
    data,
    status,
    errorMessage,
    characterCount,
    shotCount,
    onDelete,
    onStartDesign,
    isProcessing,
}: ScriptOverviewCardProps) {
    // 处理删除
    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete?.();
    };

    // 处理开始设计
    const handleStartDesign = (e: React.MouseEvent) => {
        e.stopPropagation();
        onStartDesign?.();
    };

    // 渲染角色关键信息
    const renderKeyDetails = (key_details?: CharacterKeyDetails) => {
        if (!key_details) return null;

        const details: { label: string; value: string }[] = [];

        if (key_details.positioning) {
            details.push({ label: 'Position', value: key_details.positioning });
        }
        if (key_details.props && key_details.props.length > 0) {
            details.push({ label: 'Props', value: key_details.props.join(', ') });
        }
        if (key_details.items_direction) {
            details.push({ label: 'Direction', value: key_details.items_direction });
        }
        if (key_details.other) {
            details.push({ label: 'Note', value: key_details.other });
        }

        // 处理其他自定义字段
        Object.entries(key_details).forEach(([key, value]) => {
            if (!['positioning', 'props', 'items_direction', 'other'].includes(key) && value) {
                details.push({ label: key, value: String(value) });
            }
        });

        if (details.length === 0) return null;

        return (
            <div className={styles.key_details}>
                {details.map((detail, index) => (
                    <span key={index} className={styles.key_detail_item}>
                        <span className={styles.key_detail_label}>{detail.label}:</span>
                        <span className={styles.key_detail_value}>{detail.value}</span>
                    </span>
                ))}
            </div>
        );
    };

    return (
        <div className={styles.script_overview_card}>
            {/* 头部 */}
            <div className={styles.header}>
                <div className={styles.header_title}>
                    <Sparkles className="size-5" />
                    <span>{data.title || 'Script Overview'}</span>
                </div>
                <div className={styles.header_actions}>
                    {(status === 'loading' || status === 'streaming') && (
                        <Loader2 className="size-4 animate-spin text-purple-400" />
                    )}
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

            {/* 内容区域 */}
            <div className={styles.content}>
                {/* 加载状态 */}
                {status === 'loading' && (
                    <div className={styles.loading_container}>
                        <Loader2 className="size-6 animate-spin" />
                        <span>Loading script overview...</span>
                        {(characterCount !== undefined || shotCount !== undefined) && (
                            <div className={styles.loading_preview}>
                                {characterCount !== undefined && characterCount > 0 && (
                                    <span className={styles.preview_tag}>
                                        <User className="size-3" />
                                        {characterCount} characters
                                    </span>
                                )}
                                {shotCount !== undefined && shotCount > 0 && (
                                    <span className={styles.preview_tag}>
                                        <Film className="size-3" />
                                        {shotCount} shots
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* 错误状态 */}
                {status === 'error' && (
                    <div className={styles.error_container}>
                        <span className={styles.error_text}>{errorMessage || 'Failed to analyze script'}</span>
                    </div>
                )}

                {/* 剧本摘要 */}
                {data.summary && (
                    <div className={styles.section}>
                        <div className={styles.section_header}>
                            <span className={styles.section_title}>剧本摘要</span>
                        </div>
                        <div className={styles.section_content}>
                            <p className={styles.summary_text}>{data.summary}</p>
                        </div>
                    </div>
                )}

                {/* 角色列表 */}
                {data.characters && data.characters.length > 0 && (
                    <div className={styles.section}>
                        <div className={styles.section_header}>
                            <span className={styles.section_title}>角色列表</span>
                        </div>
                        <div className={styles.section_content}>
                            <div className={styles.characters_list}>
                                {data.characters.map((char, index) => (
                                    <div key={char.id || index} className={styles.character_item}>
                                        <div className={styles.character_header}>
                                            <span className={styles.character_name}>{char.name}</span>
                                        </div>
                                        {char.description && (
                                            <p className={styles.character_description}>{char.description}</p>
                                        )}
                                        {renderKeyDetails(char.key_details)}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* 分镜描述 */}
                {data.shots && data.shots.length > 0 && (
                    <div className={styles.section}>
                        <div className={styles.section_header}>
                            <span className={styles.section_title}>分镜描述</span>
                        </div>
                        <div className={styles.section_content}>
                            <div className={styles.shots_list}>
                                {data.shots.map((shot, index) => (
                                    <div key={shot.shot_number || index} className={styles.shot_item}>
                                        <div className={styles.shot_header}>
                                            <span className={styles.shot_number}>镜头 {shot.shot_number}</span>
                                        </div>
                                        <p className={styles.shot_description}>{shot.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* 流式加载指示器 */}
                {status === 'streaming' && (
                    <div className={styles.streaming_indicator}>
                        <Loader2 className="size-4 animate-spin" />
                        <span>Receiving data...</span>
                    </div>
                )}
            </div>

            {/* 工具栏 - 仅在 completed 状态时显示 */}
            {status === 'completed' && onStartDesign && (
                <div className={styles.toolbar}>
                    <button
                        className={styles.start_btn}
                        onClick={handleStartDesign}
                        disabled={isProcessing}
                        title="Start character design"
                    >
                        {isProcessing ? (
                            <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                            <Play className="size-3.5" />
                        )}
                        <span>{isProcessing ? 'Processing' : 'Start'}</span>
                    </button>
                </div>
            )}
        </div>
    );
}
