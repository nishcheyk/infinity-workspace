'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '../lib/api';

interface User {
    id: string;
    email: string;
    full_name?: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    refreshToken: string | null;
    login: (token: string, refreshToken: string) => void;
    logout: () => void;
    isLoading: boolean;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    token: null,
    refreshToken: null,
    login: () => { },
    logout: () => { },
    isLoading: true,
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [refreshToken, setRefreshToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();

    const fetchUser = async (authToken: string) => {
        try {
            console.log('Fetching user data...');
            const userData = await apiFetch<User>('/auth/me', { token: authToken });
            console.log('User data fetched:', userData);
            setUser(userData);
        } catch (error) {
            console.error('Failed to fetch user', error);
            logout();
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        const storedRefreshToken = localStorage.getItem('refreshToken');
        if (storedToken) {
            setToken(storedToken);
            setRefreshToken(storedRefreshToken);
            fetchUser(storedToken);
        } else {
            setIsLoading(false);
        }
    }, []);

    // Automatic token refresh every 15 minutes
    useEffect(() => {
        if (!refreshToken) return;

        const interval = setInterval(async () => {
            try {
                console.log('Attempting token refresh...');
                const response = await apiFetch<{ access_token: string, refresh_token: string }>('/auth/refresh', {
                    method: 'POST',
                    body: JSON.stringify({ refresh_token: refreshToken })
                });

                localStorage.setItem('token', response.access_token);
                localStorage.setItem('refreshToken', response.refresh_token);
                setToken(response.access_token);
                setRefreshToken(response.refresh_token);
                console.log('Token refreshed successfully');
            } catch (error) {
                console.error('Failed to refresh token automatically', error);
                // Don't logout automatically to avoid annoying users, apiFetch will handle it if needed
            }
        }, 15 * 60 * 1000);

        return () => clearInterval(interval);
    }, [refreshToken]);

    const login = (newToken: string, newRefreshToken: string) => {
        localStorage.setItem('token', newToken);
        localStorage.setItem('refreshToken', newRefreshToken);
        setToken(newToken);
        setRefreshToken(newRefreshToken);
        fetchUser(newToken);
        router.push('/dashboard');
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');
        setToken(null);
        setRefreshToken(null);
        setUser(null);
        router.push('/login');
    };

    return (
        <AuthContext.Provider value={{ user, token, refreshToken, login, logout, isLoading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
