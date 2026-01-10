/**
 * 剧本文件上传与解析
 *
 * 流程：
 * 1. 获取 COS 预签名 URL
 * 2. 直传文件到 COS
 * 3. 调用后端接口解析文件内容
 */

import { apiClient } from '@/lib/axios';

// ==================== 类型定义 ====================

/** COS 预签名响应 */
interface PresignResponse {
    url: string;
    method: string;
    headers: Record<string, string>;
    expires_at: number;
}

/** 合规检查结果 */
interface ModerationResult {
    is_safe: boolean;
    category: string | null;
    reason: string | null;
}

/** 脚本解析响应 */
interface ParseResponse {
    cos_key: string;
    url: string;
    message: string | null;
    moderation: ModerationResult | null;
}

/** 上传并解析的结果 */
export interface UploadAndParseResult {
    cosKey: string;
    content: string;
    /** 解析后的 MD 文件 URL */
    parsedUrl: string;
}

/** 合规检查错误 */
export class ModerationError extends Error {
    category: string | null;
    reason: string | null;

    constructor(message: string, category: string | null, reason: string | null) {
        super(message);
        this.name = 'ModerationError';
        this.category = category;
        this.reason = reason;
    }
}

// ==================== 工具函数 ====================

/**
 * 生成 COS 存储路径
 * 格式: scripts/{年}/{月}/{时间戳}-{随机字符串}.{扩展名}
 */
function generateCosKey(fileName: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).slice(2, 8);

    // 提取文件扩展名
    const ext = fileName.split('.').pop()?.toLowerCase() || 'txt';

    return `scripts/${year}/${month}/${timestamp}-${randomStr}.${ext}`;
}

/**
 * 根据文件名获取 MIME 类型（仅支持 txt/md/pdf/docx）
 */
function getContentType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
        txt: 'text/plain',
        md: 'text/markdown',
        pdf: 'application/pdf',
        docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    return mimeTypes[ext || ''] || 'application/octet-stream';
}

// ==================== API 函数 ====================

/**
 * 获取 COS 预签名 URL
 */
async function getPresignUrl(
    key: string,
    contentType: string
): Promise<PresignResponse> {
    const response = await apiClient.post<PresignResponse>('/api/cos/presign', {
        key,
        content_type: contentType,
        expires: 3600,
    });
    return response.data;
}

/**
 * 上传文件到 COS
 * 使用预签名 URL 直传
 */
async function uploadFileToCOS(
    file: File,
    presign: PresignResponse
): Promise<void> {
    // 使用原生 fetch 直传到 COS，避免 axios 拦截器干扰
    const response = await fetch(presign.url, {
        method: presign.method,
        headers: presign.headers,
        body: file,
    });

    if (!response.ok) {
        throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }
}

/**
 * 调用后端接口解析脚本内容
 * @returns 包含解析后的内容和 URL
 */
async function parseScriptContent(cosKey: string): Promise<{ content: string; parsedUrl: string }> {
    // local 环境下添加调试参数
    const isDebug = process.env.NEXT_PUBLIC_IS_DEBUG === 'true';

    const response = await apiClient.post<ParseResponse>('/api/script/parse', {
        cos_key: cosKey,
        ...(isDebug && { is_debug: true }),
    });

    const { url, message, moderation } = response.data;

    // 检查合规性
    if (moderation && !moderation.is_safe) {
        throw new ModerationError(
            message || 'Content moderation failed',
            moderation.category,
            moderation.reason
        );
    }

    // 如果有错误消息但不是合规问题
    if (message) {
        throw new Error(message);
    }

    // 从 URL 获取解析后的 MD 内容
    const contentResponse = await fetch(url);
    if (!contentResponse.ok) {
        throw new Error(`Failed to fetch parsed content: ${contentResponse.status}`);
    }
    const content = await contentResponse.text();

    return { content, parsedUrl: url };
}

// ==================== 导出函数 ====================

/**
 * 将字符串内容创建为临时 txt 文件
 *
 * @param content 文本内容
 * @param fileName 文件名（可选，默认为时间戳命名）
 * @returns File 对象
 */
export function createTextFile(content: string, fileName?: string): File {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const name = fileName || `script-${Date.now()}.txt`;
    return new File([blob], name, { type: 'text/plain' });
}

/**
 * 上传并解析剧本文件
 *
 * 完整流程：获取预签名 -> 上传到 COS -> 调用解析接口 -> 获取解析内容
 *
 * @param file 要上传的文件
 * @returns 包含 cosKey、解析内容和解析后 URL 的结果
 * @throws {ModerationError} 当内容不合规时抛出
 */
export async function uploadAndParseScript(
    file: File
): Promise<UploadAndParseResult> {
    // 1. 生成存储路径
    const cosKey = generateCosKey(file.name);
    const contentType = getContentType(file.name);

    // 2. 获取预签名 URL
    const presign = await getPresignUrl(cosKey, contentType);

    // 3. 上传文件到 COS
    await uploadFileToCOS(file, presign);

    // 4. 调用后端解析并获取内容
    const { content, parsedUrl } = await parseScriptContent(cosKey);

    return {
        cosKey,
        content,
        parsedUrl,
    };
}

/**
 * 生成 JSON 文件的 COS 存储路径
 */
function generateJsonCosKey(prefix: string): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).slice(2, 8);

    return `${prefix}/${year}/${month}/${timestamp}-${randomStr}.json`;
}

/**
 * 上传 JSON 数据到 COS
 *
 * @param data 要上传的数据对象
 * @param prefix COS 路径前缀（如 'characters'）
 * @returns 上传后的 COS URL
 */
export async function uploadJsonToCOS<T>(
    data: T,
    prefix: string = 'data'
): Promise<string> {
    // 1. 生成存储路径
    const cosKey = generateJsonCosKey(prefix);
    const contentType = 'application/json';

    // 2. 获取预签名 URL
    const presign = await getPresignUrl(cosKey, contentType);

    // 3. 创建 JSON 文件
    const jsonContent = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8' });
    const file = new File([blob], 'data.json', { type: 'application/json' });

    // 4. 上传到 COS
    await uploadFileToCOS(file, presign);

    // 5. 返回可访问的 URL（去掉预签名参数）
    const url = new URL(presign.url);
    return `${url.origin}${url.pathname}`;
}
