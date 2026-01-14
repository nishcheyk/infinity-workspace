const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

interface FetchOptions extends RequestInit {
    token?: string;
}

export async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { token, ...fetchOptions } = options;
    const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
    };

    if (token) {
        (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
    }

    let res = await fetch(`${API_URL}${endpoint}`, {
        ...fetchOptions,
        headers,
    });

    // Handle session expiration (401)
    if (res.status === 401 && !endpoint.includes('/auth/refresh') && !endpoint.includes('/auth/login')) {
        const storedRefreshToken = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
        if (storedRefreshToken) {
            try {
                // Try to refresh
                const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ refresh_token: storedRefreshToken })
                });

                if (refreshRes.ok) {
                    const data = await refreshRes.json();
                    localStorage.setItem('token', data.access_token);
                    localStorage.setItem('refreshToken', data.refresh_token);

                    // Retry original request with new token
                    (headers as Record<string, string>)['Authorization'] = `Bearer ${data.access_token}`;
                    res = await fetch(`${API_URL}${endpoint}`, {
                        ...fetchOptions,
                        headers,
                    });
                }
            } catch (e) {
                console.error('Refresh attempt failed', e);
            }
        }
    }

    if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || 'API request failed');
    }

    return res.json();
}
