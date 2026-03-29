import { ApiResponse } from '@/types/api';
import { showError } from './notifications';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

/**
 * Get authentication token from localStorage
 */
const getToken = (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('token');
};

/**
 * Centralized API client with error handling
 */
export async function apiFetch<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<ApiResponse<T>> {
    const token = getToken();

    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, {
            ...options,
            headers,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.detail || errorData.message || `HTTP ${response.status}`;

            if (response.status === 401) {
                // Token expired or invalid
                if (typeof window !== 'undefined') {
                    localStorage.removeItem('token');
                    window.location.href = '/login';
                }
            }

            return { error: errorMessage };
        }

        const data = await response.json();
        return { data };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Network error';
        showError('Request Failed', message);
        return { error: message };
    }
}

/**
 * API GET request
 */
export async function apiGet<T>(endpoint: string): Promise<ApiResponse<T>> {
    return apiFetch<T>(endpoint, { method: 'GET' });
}

/**
 * API POST request
 */
export async function apiPost<T>(
    endpoint: string,
    body?: any
): Promise<ApiResponse<T>> {
    return apiFetch<T>(endpoint, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
    });
}

/**
 * API DELETE request
 */
export async function apiDelete<T>(endpoint: string): Promise<ApiResponse<T>> {
    return apiFetch<T>(endpoint, { method: 'DELETE' });
}

/**
 * API PUT request
 */
export async function apiPut<T>(
    endpoint: string,
    body?: any
): Promise<ApiResponse<T>> {
    return apiFetch<T>(endpoint, {
        method: 'PUT',
        body: body ? JSON.stringify(body) : undefined,
    });
}

/**
 * Upload file with progress
 */
export async function apiUpload<T>(
    endpoint: string,
    file: File,
    onProgress?: (percent: number) => void
): Promise<ApiResponse<T>> {
    const token = getToken();
    const formData = new FormData();
    formData.append('file', file);

    return new Promise((resolve) => {
        const xhr = new XMLHttpRequest();

        xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable && onProgress) {
                const percent = Math.round((e.loaded / e.total) * 100);
                onProgress(percent);
            }
        });

        xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try {
                    const data = JSON.parse(xhr.responseText);
                    resolve({ data });
                } catch {
                    resolve({ data: xhr.responseText as any });
                }
            } else {
                try {
                    const errorData = JSON.parse(xhr.responseText);
                    resolve({ error: errorData.detail || errorData.message || `HTTP ${xhr.status}` });
                } catch {
                    resolve({ error: `HTTP ${xhr.status}` });
                }
            }
        });

        xhr.addEventListener('error', () => {
            resolve({ error: 'Network error' });
        });

        xhr.open('POST', `${API_BASE_URL}${endpoint}`);
        if (token) {
            xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        }
        xhr.send(formData);
    });
}
