'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Trash2, User, Users, Crown, Skull, UserCircle } from 'lucide-react';
import styles from './CharacterCard.module.css';
import { cn } from '@/lib/utils';

// ==================== 类型定义 ====================

/** 角色类型 */
export type CharacterRole = 'protagonist' | 'antagonist' | 'supporting' | 'minor';

/** 年龄组 */
export type AgeGroup = 'child' | 'teenager' | 'young_adult' | 'adult' | 'middle_aged' | 'elderly';

/** 性别 */
export type Gender = 'male' | 'female' | 'other';

/** 角色数据 */
export interface CharacterData {
    id: string;
    name: string;
    description?: string;
    gender?: Gender;
    age?: number | null;
    age_group?: AgeGroup;
    role?: CharacterRole;
    importance?: number;
    personality?: string[];
    image_url?: string;
}

/** CharacterCard Props */
export interface CharacterCardProps {
    /** 角色数据 */
    character: CharacterData;
    /** 是否正在生成图片 */
    isGenerating?: boolean;
    /** 删除回调 */
    onDelete?: () => void;
    /** 尺寸调整回调 */
    onResize?: (size: { width: number; height: number }) => void;
    /** 点击生成图片 */
    onGenerateImage?: () => void;
}

// ==================== 工具函数 ====================

/**
 * 获取角色类型标签和样式
 */
function getRoleInfo(role?: CharacterRole): { label: string; className: string; icon: React.ReactNode } {
    switch (role) {
        case 'protagonist':
            return { label: 'Protagonist', className: styles.role_protagonist, icon: <Crown className="size-3" /> };
        case 'antagonist':
            return { label: 'Antagonist', className: styles.role_antagonist, icon: <Skull className="size-3" /> };
        case 'supporting':
            return { label: 'Supporting', className: styles.role_supporting, icon: <Users className="size-3" /> };
        case 'minor':
            return { label: 'Minor', className: styles.role_minor, icon: <User className="size-3" /> };
        default:
            return { label: 'Character', className: '', icon: <UserCircle className="size-3" /> };
    }
}

/**
 * 获取性别显示文本
 */
function getGenderLabel(gender?: Gender): string {
    switch (gender) {
        case 'male': return 'Male';
        case 'female': return 'Female';
        case 'other': return 'Other';
        default: return '';
    }
}

/**
 * 获取年龄组显示文本
 */
function getAgeGroupLabel(ageGroup?: AgeGroup): string {
    switch (ageGroup) {
        case 'child': return 'Child';
        case 'teenager': return 'Teenager';
        case 'young_adult': return 'Young Adult';
        case 'adult': return 'Adult';
        case 'middle_aged': return 'Middle Aged';
        case 'elderly': return 'Elderly';
        default: return '';
    }
}

// ==================== 组件 ====================

// 最小尺寸限制
const MIN_WIDTH = 200;
const MIN_HEIGHT = 180;

/**
 * 角色卡片组件
 * 用于在画布上显示角色信息
 */
export default function CharacterCard({
    character,
    isGenerating = false,
    onDelete,
    onResize,
    onGenerateImage,
}: CharacterCardProps) {
    const cardRef = useRef<HTMLDivElement>(null);

    // resize 相关状态
    const [isResizing, setIsResizing] = useState(false);
    const resizeStartRef = useRef<{ mouseX: number; mouseY: number; width: number; height: number } | null>(null);
    const DRAG_THRESHOLD = 3;
    const hasDraggedRef = useRef(false);

    const roleInfo = getRoleInfo(character.role);

    // 处理删除
    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        onDelete?.();
    };

    // 开始 resize
    const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
        e.stopPropagation();
        e.preventDefault();

        const card = cardRef.current;
        if (!card) return;

        const rect = card.getBoundingClientRect();
        resizeStartRef.current = {
            mouseX: e.clientX,
            mouseY: e.clientY,
            width: rect.width,
            height: rect.height,
        };
        hasDraggedRef.current = false;
        setIsResizing(true);
    }, []);

    // resize 拖拽中
    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!resizeStartRef.current || !onResize) return;

            const { mouseX, mouseY, width, height } = resizeStartRef.current;
            const deltaX = e.clientX - mouseX;
            const deltaY = e.clientY - mouseY;

            // 检查是否超过拖拽阈值
            if (!hasDraggedRef.current) {
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                if (distance < DRAG_THRESHOLD) {
                    return;
                }
                hasDraggedRef.current = true;
            }

            const newWidth = Math.max(MIN_WIDTH, width + deltaX);
            const newHeight = Math.max(MIN_HEIGHT, height + deltaY);

            onResize({ width: Math.round(newWidth), height: Math.round(newHeight) });
        };

        const handleMouseUp = () => {
            setIsResizing(false);
            resizeStartRef.current = null;
            hasDraggedRef.current = false;
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing, onResize]);

    return (
        <div ref={cardRef} className={cn(styles.character_card, isResizing && styles.character_card_resizing)}>
            {/* 头部：角色名称和操作 */}
            <div className={styles.header}>
                <div className={cn(styles.role_badge, roleInfo.className)}>
                    {roleInfo.icon}
                    <span>{roleInfo.label}</span>
                </div>
                <div className={styles.header_actions}>
                    {onDelete && (
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

            {/* 角色图片区域 */}
            <div className={styles.image_container}>
                {character.image_url ? (
                    <img
                        src={character.image_url}
                        alt={character.name}
                        className={styles.character_image}
                    />
                ) : (
                    <div className={styles.image_placeholder}>
                        <UserCircle className="size-12 text-gray-300" />
                        {isGenerating ? (
                            <span className={styles.generating_text}>Generating...</span>
                        ) : (
                            onGenerateImage && (
                                <button
                                    className={styles.generate_btn}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onGenerateImage();
                                    }}
                                >
                                    Generate Image
                                </button>
                            )
                        )}
                    </div>
                )}
            </div>

            {/* 角色信息 */}
            <div className={styles.info_section}>
                <h3 className={styles.character_name}>{character.name}</h3>
                {character.description && (
                    <p className={styles.character_description}>{character.description}</p>
                )}

                {/* 元信息标签 */}
                <div className={styles.meta_tags}>
                    {character.gender && (
                        <span className={styles.meta_tag}>{getGenderLabel(character.gender)}</span>
                    )}
                    {character.age && (
                        <span className={styles.meta_tag}>Age {character.age}</span>
                    )}
                    {!character.age && character.age_group && (
                        <span className={styles.meta_tag}>{getAgeGroupLabel(character.age_group)}</span>
                    )}
                    {character.importance && (
                        <span className={styles.meta_tag}>Importance: {character.importance}</span>
                    )}
                </div>

                {/* 性格标签 */}
                {character.personality && character.personality.length > 0 && (
                    <div className={styles.personality_tags}>
                        {character.personality.slice(0, 3).map((trait, index) => (
                            <span key={index} className={styles.personality_tag}>
                                {trait}
                            </span>
                        ))}
                        {character.personality.length > 3 && (
                            <span className={styles.personality_more}>
                                +{character.personality.length - 3}
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Resize handle */}
            <div
                className={styles.resize_handle}
                onMouseDown={handleResizeMouseDown}
                title="Drag to resize"
            />
        </div>
    );
}
