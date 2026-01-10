/**
 * Axios HTTP 客户端配置
 * 
 * 主要功能：
 * - 基础配置（baseURL、超时时间等）
 * - 响应拦截器
 * - 错误处理与友好提示
 * - 重试逻辑交给 SWR 更细粒度的管理
 * 
 * TODO：后续可以根据后端的业务错误码，结合 Toast 进行更细粒度、友好的错误反馈
 * TODO：具体业务 actions 中，只需要贴合具体业务的错误处理
 */

import { generateDeviceId, getUserUTCOffset } from '@/utils/firebase/DeviceLocationUtils';
import axios, {
    AxiosError,
    AxiosHeaders,
    AxiosResponse,
    InternalAxiosRequestConfig
} from 'axios';
import { toast } from 'sonner';

// 扩展 AxiosRequestConfig 类型，添加自定义配置选项
declare module 'axios' {
    interface InternalAxiosRequestConfig {
        // 设置为 true 时跳过自动显示错误提示
        skipErrorToast?: boolean;
    }
}

// API 错误响应类型
interface ApiErrorResponse {
    detail?: string;
}

// HTTP 状态码对应的默认错误提示
const HTTP_ERROR_MESSAGES: Record<number, string> = {
    400: 'Request error',
    401: 'Please login first',
    403: 'Access denied',
    404: 'Resource not found',
    422: 'Invalid request parameters',
    500: 'Server error, please try again later',
    502: 'Server error, please try again later',
    503: 'Service unavailable, please try again later',
    504: 'Request timeout, please try again later',
};

/**
 * 获取错误提示信息
 * 优先使用后端返回的 detail 字段，否则使用默认提示
 */
function getErrorMessage(error: AxiosError<ApiErrorResponse>): string {
    // 优先使用后端返回的错误信息
    const detail = error.response?.data?.detail;
    if (detail && typeof detail === 'string') {
        return detail;
    }

    // 根据状态码返回默认提示
    const status = error.response?.status;
    if (status && HTTP_ERROR_MESSAGES[status]) {
        return HTTP_ERROR_MESSAGES[status];
    }

    // 网络错误
    if (error.code === 'ERR_NETWORK') {
        return 'Network error, please check your connection';
    }

    // 请求超时
    if (error.code === 'ECONNABORTED') {
        return 'Request timeout, please try again later';
    }

    // 默认错误提示
    return 'Request failed, please try again later';
}

// 响应数据类型定义
// interface ApiResponse<T = unknown> {
//     data: T;
//     message?: string;
//     status: number;
//     code?: string;
// }

// 基础配置
const BASE_CONFIG = {
    baseURL: process.env.NEXT_PUBLIC_BACKEND_BASE_URL || 'http://localhost:3001',
    timeout: 600000,
    headers: new AxiosHeaders({
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
    }),
};

/**
* 创建并配置 axios 实例
*/
export const apiClient = axios.create(BASE_CONFIG);

/**
* 请求拦截器
*/
apiClient.interceptors.request.use(
    (config) => {
        // 在客户端环境下获取并添加 accessToken
        if (typeof window !== 'undefined') {

            // 在25.10.9版本中，添加了Skip-Authorization的header，用于跳过自动附带 Authorization
            // 允许通过请求头 Skip-Authorization 跳过自动附带 Authorization
            const skipAuthorization = (config.headers as any)['Skip-Authorization'];
            if (skipAuthorization) {
                if (config.headers.Authorization) {
                    delete (config.headers as any).Authorization;
                }
                // 使用后移除该标识，避免传到服务端
                delete (config.headers as any)['Skip-Authorization'];
            }
            // 检查是否已经设置了 Authorization header
            if (!skipAuthorization) {
                if (!config.headers.Authorization) {
                    const accessToken = localStorage.getItem('accessToken');
                    if (accessToken) {
                        config.headers.Authorization = `Bearer ${accessToken}`;
                    }
                }
            }


            // 在25.9.27版本中，又添加了Device-ID的header
            if (!config.headers['Device-ID']) {
                const deviceId = generateDeviceId();
                if (deviceId) {
                    config.headers['Device-ID'] = deviceId;
                }
            }

            // 添加用户时区信息 - 格式为UTC偏移
            if (!config.headers['User-Timezone']) {
                const timezone = getUserUTCOffset();
                if (timezone) {
                    config.headers['User-Timezone'] = timezone;
                }
            }
        }
        // 可选：在开发环境下打印请求信息
        if (process.env.NODE_ENV === 'development') {
            console.log('API Request:', config.method?.toUpperCase(), config.url);
        }
        return config;
    },
    (error) => {
        console.error('请求错误:', error);
        return Promise.reject(error);
    }
);

/**
 * 响应拦截器
 * 统一处理错误响应并显示友好提示
 */
apiClient.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError<ApiErrorResponse>) => {
        const config = error.config as InternalAxiosRequestConfig | undefined;

        // 检查是否需要跳过错误提示
        const skipErrorToast = config?.skipErrorToast;

        if (!skipErrorToast) {
            const message = getErrorMessage(error);
            toast.error(message);
        }

        // 开发环境下打印错误详情
        if (process.env.NODE_ENV === 'development') {
            console.error('[API Error]', {
                url: config?.url,
                method: config?.method?.toUpperCase(),
                status: error.response?.status,
                message: error.message,
                detail: error.response?.data?.detail,
            });
        }

        return Promise.reject(error);
    }
);