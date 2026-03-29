import { useState, useEffect, useCallback } from 'react';
import { ChatSession } from '@/types/api';
import { apiGet, apiPost, apiDelete } from '@/lib/apiClient';
import { showSuccess, showError } from '@/lib/notifications';

export function useChatSessions() {
    const [sessions, setSessions] = useState<ChatSession[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchSessions = useCallback(async () => {
        setLoading(true);
        const response = await apiGet<ChatSession[]>('/chats');
        setLoading(false);

        if (response.data) {
            setSessions(response.data);
        } else if (response.error) {
            showError('Failed to fetch chat sessions', response.error);
        }
    }, []);

    const createSession = useCallback(async () => {
        const response = await apiPost<ChatSession>('/chats');

        if (response.data) {
            await fetchSessions();
            return response.data.id;
        } else if (response.error) {
            showError('Failed to create session', response.error);
            return null;
        }
        return null;
    }, [fetchSessions]);

    const deleteSession = useCallback(async (sessionId: string) => {
        const response = await apiDelete(`/chats/${sessionId}`);

        if (response.data) {
            showSuccess('Chat deleted');
            setSessions(prev => prev.filter(s => s.id !== sessionId));
            return true;
        } else if (response.error) {
            showError('Delete failed', response.error);
            return false;
        }
        return false;
    }, []);

    useEffect(() => {
        fetchSessions();
    }, [fetchSessions]);

    return {
        sessions,
        loading,
        fetchSessions,
        createSession,
        deleteSession,
    };
}
