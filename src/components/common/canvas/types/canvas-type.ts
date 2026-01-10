import type { ReactNode } from 'react';

// ==================== 鼠标模式枚举 ====================

/**
 * Canvas鼠标操作模式
 * - grab: 抓握模式 - 拖动移动画布位置
 * - normal: 常规模式 - 双击元素自动适配显示
 * - move: 移动模式 - 移动画布内部的组件
 */
export type CanvasMode = 'grab' | 'normal' | 'move';

// ==================== 基础类型定义 ====================

/** 2D坐标点 */
export interface Point {
    x: number;
    y: number;
}

/** 画布视图状态 */
export interface ViewState {
    /** 画布偏移量 */
    offset: Point;
    /** 缩放比例 */
    scale: number;
}

/** 可拖拽组件的位置和尺寸 */
export interface CanvasItemData {
    /** 唯一标识符 */
    id: string;
    /** X坐标（画布坐标系） */
    x: number;
    /** Y坐标（画布坐标系） */
    y: number;
    /** 宽度 */
    width?: number;
    /** 高度 */
    height?: number;
    /** 自定义数据 */
    data?: Record<string, unknown>;
}

// ==================== 组件Props类型 ====================

/** Canvas组件的Props */
export interface CanvasProps {
    /** 自定义类名 */
    className?: string;
    /** 画布中的子元素项 */
    items?: CanvasItemData[];
    /** 渲染单个item的函数 */
    renderItem?: (item: CanvasItemData) => ReactNode;
    /** item位置变化时的回调 */
    onItemMove?: (id: string, position: Point) => void;
    /** 视图状态变化时的回调 */
    onViewChange?: (viewState: ViewState) => void;
    /** 最小缩放比例 */
    minScale?: number;
    /** 最大缩放比例 */
    maxScale?: number;
    /** 初始视图状态 */
    initialViewState?: Partial<ViewState>;
    /** 是否显示网格 */
    showGrid?: boolean;
    /** 网格大小 */
    gridSize?: number;
    /** 当前鼠标操作模式 */
    mode?: CanvasMode;
    /** 模式变化时的回调 */
    onModeChange?: (mode: CanvasMode) => void;
    /** 双击item时的回调（常规模式下触发） */
    onItemDoubleClick?: (id: string, item: CanvasItemData) => void;
    /** 自动适配时的边距（像素） */
    fitPadding?: number;
    /** 添加新元素时是否自动适配显示（移动画布使新元素居中） */
    autoFitNewItem?: boolean;
    /** 受控模式：外部控制的缩放比例 */
    scale?: number;
    /** 受控模式：缩放比例变化时的回调 */
    onScaleChange?: (scale: number) => void;
    /** 受控模式：外部控制的偏移量 */
    offset?: Point;
    /** 受控模式：偏移量变化时的回调 */
    onOffsetChange?: (offset: Point) => void;
    /** 受控模式：当前选中的item ID */
    selectedItemId?: string | null;
    /** 选中item时的回调 */
    onItemSelect?: (id: string | null) => void;
}

// ==================== Hook返回类型 ====================

/** useCanvasItems Hook的返回类型 */
export interface UseCanvasItemsReturn {
    /** 当前items列表 */
    items: CanvasItemData[];
    /** 直接设置items */
    setItems: React.Dispatch<React.SetStateAction<CanvasItemData[]>>;
    /** 添加item（自动放置在最后一个item下方） */
    addItem: (item: CanvasItemData | Omit<CanvasItemData, 'x' | 'y'> & Partial<Pick<CanvasItemData, 'x' | 'y'>>) => void;
    /** 移除item */
    removeItem: (id: string) => void;
    /** 更新item位置 */
    updateItemPosition: (id: string, position: Point) => void;
    /** 更新item数据 */
    updateItem: (id: string, updates: Partial<CanvasItemData>) => void;
    /** 清空所有items */
    clearItems: () => void;
}

