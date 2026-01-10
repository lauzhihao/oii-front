'use client';

import { useState, useCallback } from 'react';
import { Trash2, Pencil, RefreshCw, Check, X, Loader2, ImageIcon, UserCircle, Play } from 'lucide-react';
import styles from './CharactersCard.module.css';
import { cn } from '@/lib/utils';

// ==================== 类型定义 ====================

/** 角色数据 */
export interface CharacterItemData {
    /** 角色ID */
    id: string;
    /** 角色名称 */
    name: string;
    /** 角色提示词 */
    prompt?: string;
    /** 角色主图 URL（9:16 比例） */
    mainImageUrl?: string;
    /** 三视图 URL */
    threeViewUrl?: string;
    /** 是否正在生成主图 */
    isGeneratingMain?: boolean;
    /** 是否正在生成三视图 */
    isGeneratingThreeView?: boolean;
}

/** CharactersCard Props */
export interface CharactersCardProps {
    /** 角色列表 */
    characters: CharacterItemData[];
    /** 删除整个卡片回调 */
    onDelete?: () => void;
    /** 更新角色提示词回调 */
    onUpdatePrompt?: (characterId: string, newPrompt: string) => void;
    /** 刷新角色回调（重新生成） */
    onRefresh?: (characterId: string) => void;
    /** 生成主图回调 */
    onGenerateMainImage?: (characterId: string) => void;
    /** 生成三视图回调 */
    onGenerateThreeView?: (characterId: string) => void;
    /** 开始生成分镜回调 */
    onStartGenerate?: () => void;
    /** 是否正在处理中 */
    isProcessing?: boolean;
    /** 是否锁定编辑（禁用编辑和刷新按钮） */
    isLocked?: boolean;
}

// ==================== 子组件：角色子卡片 ====================

interface CharacterSubCardProps {
    character: CharacterItemData;
    onUpdatePrompt?: (newPrompt: string) => void;
    onRefresh?: () => void;
    onGenerateMainImage?: () => void;
    onGenerateThreeView?: () => void;
    isLocked?: boolean;
}

function CharacterSubCard({
    character,
    onUpdatePrompt,
    onRefresh,
    onGenerateMainImage,
    onGenerateThreeView,
    isLocked,
}: CharacterSubCardProps) {
    // 编辑状态
    const [isEditing, setIsEditing] = useState(false);
    const [editPrompt, setEditPrompt] = useState(character.prompt || '');

    // 进入编辑模式
    const handleEdit = useCallback(() => {
        if (isLocked) return;
        setEditPrompt(character.prompt || '');
        setIsEditing(true);
    }, [character.prompt, isLocked]);

    // 保存编辑
    const handleSave = useCallback(() => {
        onUpdatePrompt?.(editPrompt);
        setIsEditing(false);
    }, [editPrompt, onUpdatePrompt]);

    // 取消编辑
    const handleCancel = useCallback(() => {
        setEditPrompt(character.prompt || '');
        setIsEditing(false);
    }, [character.prompt]);

    // 刷新
    const handleRefresh = useCallback(() => {
        if (isLocked) return;
        onRefresh?.();
    }, [onRefresh, isLocked]);

    return (
        <div className={styles.sub_card}>
            {/* 子卡片头部 */}
            <div className={styles.sub_card_header}>
                <h4 className={styles.sub_card_title}>{character.name}</h4>
                <div className={styles.sub_card_actions}>
                    {isEditing ? (
                        <>
                            <button
                                className={cn(styles.action_btn, styles.action_btn_save)}
                                onClick={handleSave}
                                title="Save"
                            >
                                <Check className="size-4" />
                            </button>
                            <button
                                className={cn(styles.action_btn, styles.action_btn_cancel)}
                                onClick={handleCancel}
                                title="Cancel"
                            >
                                <X className="size-4" />
                            </button>
                        </>
                    ) : (
                        <>
                            <button
                                className={cn(styles.action_btn, isLocked && styles.action_btn_disabled)}
                                onClick={handleEdit}
                                title="Edit prompt"
                                disabled={isLocked}
                            >
                                <Pencil className="size-3.5" />
                            </button>
                            <button
                                className={cn(styles.action_btn, isLocked && styles.action_btn_disabled)}
                                onClick={handleRefresh}
                                title="Refresh"
                                disabled={isLocked}
                            >
                                <RefreshCw className="size-3.5" />
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* 角色提示词 */}
            <div className={styles.prompt_section}>
                {isEditing ? (
                    <textarea
                        className={styles.prompt_textarea}
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        placeholder="Enter character prompt..."
                        autoFocus
                    />
                ) : (
                    <p className={styles.prompt_text}>
                        {character.prompt || 'No prompt available'}
                    </p>
                )}
            </div>

            {/* 图片区域 */}
            <div className={styles.images_section}>
                {/* 角色主图 (9:16 比例) */}
                <div className={styles.main_image_container}>
                    {character.mainImageUrl ? (
                        <img
                            src={character.mainImageUrl}
                            alt={`${character.name} main`}
                            className={styles.main_image}
                        />
                    ) : (
                        <div className={styles.image_placeholder}>
                            {character.isGeneratingMain ? (
                                <Loader2 className="size-8 animate-spin text-gray-400" />
                            ) : (
                                <>
                                    <UserCircle className="size-16 text-gray-300" />
                                    <span className={styles.placeholder_text}>Character</span>
                                    {onGenerateMainImage && (
                                        <button
                                            className={styles.generate_btn}
                                            onClick={onGenerateMainImage}
                                        >
                                            Generate
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                    <span className={styles.image_label}>Main</span>
                </div>

                {/* 三视图 */}
                <div className={styles.three_view_container}>
                    {character.threeViewUrl ? (
                        <img
                            src={character.threeViewUrl}
                            alt={`${character.name} three view`}
                            className={styles.three_view_image}
                        />
                    ) : (
                        <div className={styles.image_placeholder}>
                            {character.isGeneratingThreeView ? (
                                <Loader2 className="size-8 animate-spin text-gray-400" />
                            ) : (
                                <>
                                    <ImageIcon className="size-12 text-gray-300" />
                                    <span className={styles.placeholder_text}>Three View</span>
                                    {onGenerateThreeView && (
                                        <button
                                            className={styles.generate_btn}
                                            onClick={onGenerateThreeView}
                                        >
                                            Generate
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                    <span className={styles.image_label}>Three View</span>
                </div>
            </div>
        </div>
    );
}

// ==================== 主组件 ====================

/**
 * 角色集合卡片组件
 * 用于在画布上显示多个角色的详细信息
 */
export default function CharactersCard({
    characters,
    onDelete,
    onUpdatePrompt,
    onRefresh,
    onGenerateMainImage,
    onGenerateThreeView,
    onStartGenerate,
    isProcessing,
    isLocked,
}: CharactersCardProps) {
    // 处理删除
    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete?.();
    };

    // 处理开始生成
    const handleStartGenerate = useCallback(() => {
        if (!isProcessing) {
            onStartGenerate?.();
        }
    }, [isProcessing, onStartGenerate]);

    return (
        <div className={styles.characters_card}>
            {/* 头部 */}
            <div className={styles.header}>
                <div className={styles.header_title}>
                    <span>Characters</span>
                    <span className={styles.character_count}>{characters.length}</span>
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

            {/* 角色列表 */}
            <div className={styles.characters_grid}>
                {characters.length === 0 ? (
                    <div className={styles.empty_state}>
                        <p>No characters available</p>
                    </div>
                ) : (
                    characters.map((character) => (
                        <CharacterSubCard
                            key={character.id}
                            character={character}
                            onUpdatePrompt={onUpdatePrompt ? (newPrompt) => onUpdatePrompt(character.id, newPrompt) : undefined}
                            onRefresh={onRefresh ? () => onRefresh(character.id) : undefined}
                            onGenerateMainImage={onGenerateMainImage ? () => onGenerateMainImage(character.id) : undefined}
                            onGenerateThreeView={onGenerateThreeView ? () => onGenerateThreeView(character.id) : undefined}
                            isLocked={isLocked}
                        />
                    ))
                )}
            </div>

            {/* 底部工具栏 */}
            {onStartGenerate && (
                <div className={styles.footer}>
                    <button
                        className={cn(styles.start_btn, isProcessing && styles.start_btn_disabled)}
                        onClick={handleStartGenerate}
                        disabled={isProcessing}
                    >
                        {isProcessing ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <Play className="size-4" />
                        )}
                        <span>{isProcessing ? 'Processing' : 'Start'}</span>
                    </button>
                </div>
            )}
        </div>
    );
}
