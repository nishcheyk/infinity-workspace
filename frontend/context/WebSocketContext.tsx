'use client';

import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';

type MessageListener = (data: any) => void;

interface WebSocketContextType {
    socket: WebSocket | null;
    sendMessage: (msg: any) => void;
    lastMessage: any;
    isConnected: boolean;
    subscribe: (listener: MessageListener) => () => void;
}

const WebSocketContext = createContext<WebSocketContextType>({
    socket: null,
    sendMessage: () => { },
    lastMessage: null,
    isConnected: false,
    subscribe: () => () => { },
});

export const WebSocketProvider = ({ children }: { children: React.ReactNode }) => {
    const { token: stateToken } = useAuth();
    const [socket, setSocket] = useState<WebSocket | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState<any>(null);
    const listeners = useRef<MessageListener[]>([]);
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const reconnectCount = useRef(0);

    const subscribe = useCallback((listener: MessageListener) => {
        listeners.current.push(listener);
        return () => {
            listeners.current = listeners.current.filter(l => l !== listener);
        };
    }, []);

    const connect = useCallback(() => {
        // Always try to get the latest token from localStorage to support apiFetch refreshes
        const currentToken = localStorage.getItem('token') || stateToken;

        if (!currentToken) {
            console.log('[WS] No token available, skipping connection');
            return null;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws';

        console.log(`[WS] Connecting to ${wsUrl} (Attempt ${reconnectCount.current + 1})`);
        const ws = new WebSocket(`${wsUrl}?token=${currentToken}`);

        ws.onopen = () => {
            console.log('[WS] Connected successfully');
            setIsConnected(true);
            setSocket(ws);
            reconnectCount.current = 0; // Reset backoff
        };

        ws.onclose = (event) => {
            console.log(`[WS] Disconnected (Code: ${event.code}, Reason: ${event.reason || 'none'})`);
            setIsConnected(false);
            setSocket(null);

            // Clean up old socket
            ws.onopen = null;
            ws.onclose = null;
            ws.onerror = null;
            ws.onmessage = null;

            // Don't reconnect if it was a policy violation (usually expired/bad token)
            // unless we want to try again with a potentially refreshed token
            if (event.code === 1008) {
                console.log('[WS] Policy violation (1008). Could be expired token.');
            }

            // Exponential backoff: 2s, 4s, 8s, 16s, max 30s
            const delay = Math.min(Math.pow(2, reconnectCount.current) * 1000 + 1000, 30000);
            console.log(`[WS] Reconnecting in ${delay}ms...`);

            if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            reconnectTimeoutRef.current = setTimeout(() => {
                reconnectCount.current++;
                connect();
            }, delay);
        };

        ws.onerror = (err) => {
            console.error('[WS] Error:', err);
        };

        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                listeners.current.forEach(l => l(data));
                setLastMessage(data);
            } catch (e) {
                console.error('[WS] Parse error', e);
            }
        };

        return ws;
    }, [stateToken]);

    useEffect(() => {
        if (stateToken) {
            const ws = connect();
            return () => {
                console.log('[WS] Cleaning up WebSocket effect');
                if (ws) {
                    ws.onclose = null; // Prevent onclose firing during manual cleanup
                    ws.close();
                }
                if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
            };
        }
    }, [stateToken, connect]);

    const sendMessage = useCallback((msg: any) => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(msg));
        } else {
            console.warn('[WS] Cannot send message, socket not open');
        }
    }, [socket]);

    const value = React.useMemo(() => ({
        socket,
        sendMessage,
        lastMessage,
        isConnected,
        subscribe
    }), [socket, sendMessage, lastMessage, isConnected, subscribe]);

    return (
        <WebSocketContext.Provider value={value}>
            {children}
        </WebSocketContext.Provider>
    );
};

export const useWebSocket = () => useContext(WebSocketContext);
