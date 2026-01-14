'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    Button,
    Typography,
    Badge,
    Tooltip,
    notification,
    Upload,
    Popconfirm,
    Avatar,
    Space,
    Grid,
    Drawer
} from 'antd';
import {
    UploadOutlined,
    RobotOutlined,
    FileTextOutlined,
    SettingOutlined,
    LogoutOutlined,
    DeleteOutlined,
    PlusOutlined,
    HistoryOutlined,
    MenuOutlined,
    GlobalOutlined,
    SendOutlined
} from '@ant-design/icons';
import { Input } from 'antd';
import type { UploadProps } from 'antd';
import { useAuth } from '../../context/AuthContext';
import { useWebSocket } from '../../context/WebSocketContext';
import { apiFetch } from '../../lib/api';
import ChatInterface from '../../components/dashboard/ChatInterface';
import SettingsModal from '../../components/dashboard/SettingsModal';

const { Text, Title } = Typography;
const { useBreakpoint } = Grid;

interface Document {
    id: string;
    filename: string;
    status: string;
}

export default function Dashboard() {
    const { user, logout, isLoading, token } = useAuth();
    const router = useRouter();
    const { lastMessage, isConnected } = useWebSocket();
    const screens = useBreakpoint();

    const [documents, setDocuments] = useState<Document[]>([]);
    const [sessions, setSessions] = useState<any[]>([]);
    const [activeSessionId, setActiveSessionId] = useState<string | null>(() => {
        if (typeof window !== 'undefined') {
            return localStorage.getItem('last_active_session');
        }
        return null;
    });

    const [settingsVisible, setSettingsVisible] = useState(false);
    const [historyDrawerVisible, setHistoryDrawerVisible] = useState(false);
    const [sidebarVisible, setSidebarVisible] = useState(true);
    const [scrapeUrl, setScrapeUrl] = useState('');
    const [isScraping, setIsScraping] = useState(false);
    const initializationStarted = useRef(false);

    const isMobile = !screens.md;

    // Debugging state sync
    useEffect(() => {
        console.log('[Dashboard] activeSessionId updated:', activeSessionId);
    }, [activeSessionId]);

    useEffect(() => {
        console.log('[Dashboard] connection status:', isConnected);
    }, [isConnected]);

    // Persist session selection
    useEffect(() => {
        if (activeSessionId) {
            localStorage.setItem('last_active_session', activeSessionId);
        }
    }, [activeSessionId]);

    // Auth check
    useEffect(() => {
        if (!isLoading && !user) router.push('/login');
    }, [user, isLoading, router]);

    const fetchData = async () => {
        try {
            if (!token) return;
            const [docs, chatSessionsRaw] = await Promise.all([
                apiFetch<Document[]>('/ingestion/documents', { token }),
                apiFetch<any[]>('/chats', { token })
            ]);

            // Normalize sessions (id vs _id) and filter out ghosts
            const chatSessions = chatSessionsRaw
                .filter(s => (s.id || s._id) && (s.id !== 'undefined' && s._id !== 'undefined'))
                .map(s => ({
                    ...s,
                    id: String(s.id || s._id) // Force to string
                }));

            console.log('[Dashboard] Valid sessions found:', chatSessions.length);
            if (chatSessions.length > 0) {
                console.log('[Dashboard] Top session ID:', chatSessions[0].id);
            }

            setDocuments(docs);
            setSessions(chatSessions);

            // Auto-create if zero sessions found
            if (chatSessions.length === 0 && !initializationStarted.current) {
                console.log('[Dashboard] No sessions found, auto-creating...');
                initializationStarted.current = true;
                await handleNewChat();
                return;
            }

            const storedId = localStorage.getItem('last_active_session');
            const sessionExists = chatSessions.some(s => s.id === storedId);

            console.log('[Dashboard] Auto-selection logic - storedId:', storedId, 'exists:', sessionExists);

            if (!activeSessionId || !sessionExists || activeSessionId === 'undefined') {
                const targetId = sessionExists ? (storedId as string) : chatSessions[0].id;
                console.log('[Dashboard] Initializing active session to:', targetId);
                setActiveSessionId(targetId);
            }
        } catch (e) {
            console.error(e);
        }
    };

    useEffect(() => {
        if (token) fetchData();
    }, [token]);

    const handleNewChat = async () => {
        try {
            console.log('[Dashboard] Creating new chat session...');
            const newSession = await apiFetch<any>('/chats', {
                method: 'POST',
                token: token ?? undefined
            });
            const normalized = { ...newSession, id: newSession.id || newSession._id };
            setSessions(prev => [normalized, ...prev]);
            setActiveSessionId(normalized.id);
            localStorage.setItem('last_active_session', normalized.id);
            if (isMobile) setHistoryDrawerVisible(false);
            notification.success({ message: 'New workspace initialized' });
        } catch (e) {
            console.error('Failed to create new chat', e);
        }
    };

    const handleDeleteSession = async (sessionId: string) => {
        try {
            await apiFetch(`/chats/${sessionId}`, {
                method: 'DELETE',
                token: token ?? undefined
            });
            setSessions(sessions.filter(s => s.id !== sessionId));
            if (activeSessionId === sessionId) {
                console.log('[Dashboard] Active session deleted, resetting to null');
                setActiveSessionId(null);
                localStorage.removeItem('last_active_session');
            }
        } catch (e) {
            console.error('Failed to delete session', e);
        }
    };

    useEffect(() => {
        if (!lastMessage) return;
        if (lastMessage.type === 'ingestion_status') {
            const { doc_id, status, filename } = lastMessage;
            setDocuments(prev => {
                const exists = prev.find(d => d.id === doc_id);
                if (exists) return prev.map(d => d.id === doc_id ? { ...d, status } : d);
                return [{ id: doc_id, filename, status }, ...prev];
            });
            if (status === 'completed') notification.success({ message: `Processed: ${filename}` });
        }
    }, [lastMessage]);

    const handleDeleteDoc = async (docId: string) => {
        try {
            await apiFetch(`/ingestion/documents/${docId}`, {
                token: token ?? undefined,
                method: 'DELETE'
            });
            fetchData();
        } catch (e) {
            console.error(e);
        }
    };

    const uploadProps: UploadProps = {
        name: 'file',
        action: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1'}/ingestion/upload`,
        headers: { authorization: `Bearer ${token}` },
        showUploadList: false,
        onChange(info) {
            if (info.file.status === 'done') {
                notification.success({ message: `${info.file.name} uploaded` });
                fetchData();
            }
        },
    };

    const handleScrape = async () => {
        if (!scrapeUrl.trim() || !token) return;
        try {
            setIsScraping(true);
            await apiFetch<any>('/ingestion/scrape', {
                method: 'POST',
                token,
                body: JSON.stringify({ url: scrapeUrl })
            });
            notification.info({ message: 'Scraping initialized', description: `Extracting intelligence from ${scrapeUrl}` });
            setScrapeUrl('');
            fetchData();
        } catch (e) {
            console.error(e);
            notification.error({ message: 'Scraping failed', description: 'Ensure the URL is accessible' });
        } finally {
            setIsScraping(false);
        }
    };

    const renderHistoryContent = () => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%', overflowY: 'auto', paddingBottom: 20 }}>
            <div>
                <Title level={5} style={{ color: '#fff', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <HistoryOutlined /> Recent Activities
                </Title>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {sessions.length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                            <Text type="secondary" style={{ fontSize: 13 }}>No recent workspaces</Text>
                        </div>
                    )}
                    {sessions.map(s => (
                        <div
                            key={s.id}
                            onClick={() => {
                                console.log('[Dashboard] Manually selecting session:', s.id);
                                setActiveSessionId(s.id);
                                notification.info({
                                    message: 'Workspace Activated',
                                    description: `Switched to ${s.title}`,
                                    placement: 'topRight',
                                    duration: 2
                                });
                                if (isMobile) setHistoryDrawerVisible(false);
                            }}
                            style={{
                                padding: '12px',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                background: activeSessionId === s.id ? 'rgba(142,45,226,0.15)' : 'rgba(255,255,255,0.02)',
                                border: activeSessionId === s.id ? '1px solid var(--accent-primary)' : '1px solid var(--glass-border)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                transition: 'all 0.2s',
                                boxShadow: activeSessionId === s.id ? '0 0 15px rgba(142, 45, 226, 0.2)' : 'none'
                            }}
                        >
                            <Text ellipsis style={{ color: activeSessionId === s.id ? '#fff' : 'rgba(255,255,255,0.6)', maxWidth: '180px', fontWeight: activeSessionId === s.id ? 600 : 400 }}>{s.title}</Text>
                            <Popconfirm title="Delete workspace?" onConfirm={(e) => { e?.stopPropagation(); handleDeleteSession(s.id); }}>
                                <DeleteOutlined style={{ fontSize: 12, opacity: 0.4 }} onClick={e => e.stopPropagation()} />
                            </Popconfirm>
                        </div>
                    ))}
                </div>
            </div>

            <div style={{ flex: 1 }}>
                <Title level={5} style={{ color: '#fff', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <GlobalOutlined /> Intelligence Scrape
                </Title>
                <div style={{ marginBottom: 24 }}>
                    <Input
                        placeholder="https://example.com"
                        value={scrapeUrl}
                        onChange={(e) => setScrapeUrl(e.target.value)}
                        onPressEnter={handleScrape}
                        suffix={
                            <Button
                                type="text"
                                icon={<SendOutlined />}
                                loading={isScraping}
                                onClick={handleScrape}
                                style={{ color: 'var(--accent-primary)' }}
                            />
                        }
                        style={{
                            background: 'rgba(255,255,255,0.02)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '12px',
                            color: '#fff'
                        }}
                    />
                    <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>Playwright-powered deep extraction</Text>
                </div>

                <Title level={5} style={{ color: '#fff', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileTextOutlined /> Knowledge Base
                </Title>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {documents.length === 0 && (
                        <div style={{ padding: '20px', textAlign: 'center', background: 'rgba(255,255,255,0.02)', borderRadius: '12px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                            <Text type="secondary" style={{ fontSize: 13 }}>No documents found</Text>
                        </div>
                    )}
                    {documents.map(doc => (
                        <div
                            key={doc.id}
                            style={{
                                padding: '10px 12px',
                                borderRadius: '10px',
                                background: 'rgba(255,255,255,0.03)',
                                border: '1px solid var(--glass-border)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px'
                            }}
                        >
                            <FileTextOutlined style={{ color: doc.status === 'completed' ? '#52c41a' : '#faad14' }} />
                            <Text ellipsis style={{ flex: 1, color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>{doc.filename}</Text>
                            <Popconfirm title="Remove doc?" onConfirm={() => handleDeleteDoc(doc.id)}>
                                <DeleteOutlined style={{ fontSize: 12, opacity: 0.4 }} />
                            </Popconfirm>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );

    if (isLoading || !user) return <div className="mesh-gradient" />;

    return (
        <div style={{ height: '100vh', width: '100vw', padding: isMobile ? '12px' : '24px', display: 'flex', gap: isMobile ? '12px' : '24px' }}>
            <div className="mesh-gradient" />

            {/* Desktop Navigation Dock */}
            {!isMobile && (
                <div className="glass-panel" style={{ width: '70px', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', gap: '20px' }}>
                    <Avatar size={40} icon={<RobotOutlined />} style={{ background: 'var(--accent-primary)', marginBottom: 20 }} />
                    <Tooltip title="New Chat" placement="right"><Button type="text" icon={<PlusOutlined />} onClick={handleNewChat} style={{ color: '#fff', fontSize: 20 }} /></Tooltip>
                    <Tooltip title="Documents" placement="right"><Upload {...uploadProps}><Button type="text" icon={<UploadOutlined />} style={{ color: '#fff', fontSize: 20 }} /></Upload></Tooltip>
                    <div style={{ flex: 1 }} />
                    <Tooltip title="Toggle History" placement="right"><Button type="text" icon={<HistoryOutlined />} onClick={() => setSidebarVisible(!sidebarVisible)} style={{ color: '#fff', fontSize: 20 }} /></Tooltip>
                    <Tooltip title="Settings" placement="right"><Button type="text" icon={<SettingOutlined />} onClick={() => setSettingsVisible(true)} style={{ color: '#fff', fontSize: 20 }} /></Tooltip>
                    <Tooltip title="Logout" placement="right"><Button type="text" icon={<LogoutOutlined />} onClick={logout} danger style={{ fontSize: 20 }} /></Tooltip>
                </div>
            )}

            {/* Main Chat Workspace */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative', minWidth: 0 }}>
                <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    {/* Header */}
                    <div style={{ padding: isMobile ? '12px 16px' : '16px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                            {isMobile && <Button type="text" icon={<MenuOutlined />} onClick={() => setHistoryDrawerVisible(true)} style={{ color: '#fff' }} />}
                            <div style={{ minWidth: 0 }}>
                                <Title level={isMobile ? 5 : 4} style={{ margin: 0, color: '#fff' }} ellipsis>
                                    {sessions.find(s => s.id === activeSessionId)?.title || "Infinity Workspace"}
                                </Title>
                                {!isMobile && <Text type="secondary" style={{ fontSize: 12 }}>{activeSessionId ? "Active Intelligence" : "Select or create a chat to begin"}</Text>}
                            </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                            {!isMobile && (
                                <Badge
                                    status={isConnected ? "processing" : "default"}
                                    text={<Text style={{ color: isConnected ? '#fff' : 'rgba(255,255,255,0.4)' }}>{isConnected ? "Connected" : "Reconnecting..."}</Text>}
                                />
                            )}
                            {isMobile && (
                                <Space>
                                    <Button type="text" icon={<PlusOutlined />} onClick={handleNewChat} style={{ color: '#fff' }} />
                                    <Button type="text" icon={<SettingOutlined />} onClick={() => setSettingsVisible(true)} style={{ color: '#fff' }} />
                                </Space>
                            )}
                        </div>
                    </div>

                    <div style={{ flex: 1, padding: isMobile ? '0' : '24px', overflow: 'hidden' }}>
                        <ChatInterface
                            key={activeSessionId || 'empty'}
                            sessionId={activeSessionId}
                            onShowHistory={() => isMobile ? setHistoryDrawerVisible(true) : setSidebarVisible(true)}
                            onCreateNew={handleNewChat}
                            onChatComplete={fetchData}
                        />
                    </div>
                </div>
            </div>

            {/* Desktop Sidbar */}
            {!isMobile && sidebarVisible && (
                <div className="glass-panel" style={{ width: '300px', height: '100%', padding: '24px' }}>
                    {renderHistoryContent()}
                </div>
            )}

            {/* Mobile Drawer */}
            <Drawer
                placement="left"
                onClose={() => setHistoryDrawerVisible(false)}
                open={historyDrawerVisible}
                styles={{
                    body: { background: 'rgba(5, 5, 5, 0.9)', backdropFilter: 'blur(20px)', borderRight: '1px solid var(--glass-border)' },
                    header: { background: 'transparent', borderBottom: '1px solid var(--glass-border)' }
                }}
                width="280"
            >
                <div style={{ marginBottom: 20 }}>
                    <Button type="primary" block icon={<LogoutOutlined />} onClick={logout} danger ghost>Sign Out</Button>
                </div>
                {renderHistoryContent()}
            </Drawer>

            <SettingsModal visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
        </div>
    );
}
