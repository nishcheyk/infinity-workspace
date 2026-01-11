'use client';

import { useEffect, useRef, useState } from 'react';
import { Input, Button, List, Typography, Grid, theme, Avatar, Space, Badge } from 'antd';
import { SendOutlined, AudioOutlined, UserOutlined, RobotOutlined, StopOutlined, SoundOutlined, LoadingOutlined, HistoryOutlined, PlusOutlined } from '@ant-design/icons';
import { useSettings } from '../../context/SettingsContext';
import { useWebSocket } from '../../context/WebSocketContext';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';

const { TextArea } = Input;
const { Text, Title } = Typography;
const { useBreakpoint } = Grid;
const { useToken } = theme;

interface Message {
    role: 'user' | 'assistant';
    content: string;
}

export interface ChatInterfaceProps {
    sessionId: string | null;
    onShowHistory?: () => void;
    onCreateNew?: () => void;
    onChatComplete?: () => void;
}

export default function ChatInterface({ sessionId, onShowHistory, onCreateNew, onChatComplete }: ChatInterfaceProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const { voiceURI, availableVoices, autoPlay, primaryColor } = useSettings();
    const { sendMessage, isConnected, subscribe } = useWebSocket();
    const { token } = useAuth();
    const screens = useBreakpoint();
    const themeToken = useToken().token;

    const isMobile = !screens.md;

    const synthesisRef = useRef<SpeechSynthesis | null>(null);
    const recognitionRef = useRef<any>(null);
    const accumulatedResponse = useRef('');
    const scrollAnchorRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    const scrollToBottom = () => {
        scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    useEffect(() => {
        console.log('[ChatInterface] Render with sessionId:', sessionId, 'isConnected:', isConnected);
    }, [sessionId, isConnected]);

    // Fetch history
    useEffect(() => {
        const fetchHistory = async () => {
            if (!sessionId || sessionId === 'undefined' || !token) {
                setMessages([]);
                return;
            }
            try {
                setIsLoading(true);
                const history = await apiFetch<any[]>(`/chats/${sessionId}/history`, { token });
                setMessages(history.map(m => ({
                    role: m.role,
                    content: m.content
                })));
            } catch (e) {
                console.error('Failed to load history', e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchHistory();
    }, [sessionId, token]);

    useEffect(() => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            synthesisRef.current = window.speechSynthesis;
        }
    }, []);

    // Handle WebSocket messages
    useEffect(() => {
        const unsubscribe = subscribe((data) => {
            if (data.type === 'chat_start') {
                accumulatedResponse.current = '';
                setIsLoading(true);
            } else if (data.type === 'chat_token') {
                accumulatedResponse.current += data.token;
                setMessages(prev => {
                    const msgs = [...prev];
                    if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
                        msgs[msgs.length - 1].content = accumulatedResponse.current;
                    } else {
                        msgs.push({ role: 'assistant', content: accumulatedResponse.current });
                    }
                    return msgs;
                });
                setIsLoading(false);
            } else if (data.type === 'chat_end') {
                setIsLoading(false);
                // Final commitment to state to ensure React has the latest content
                const finalContent = accumulatedResponse.current.trim();
                setMessages(prev => {
                    const msgs = [...prev];
                    if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
                        msgs[msgs.length - 1].content = finalContent;
                    }
                    return msgs;
                });

                if (autoPlay && finalContent) {
                    speakText(finalContent);
                }

                // Signal parent to refresh titles or history
                if (onChatComplete) {
                    onChatComplete();
                }
            }
        });
        return () => unsubscribe();
    }, [subscribe, autoPlay]);

    const speakText = (text: string) => {
        if (!synthesisRef.current || !text) return;

        window.speechSynthesis.resume();
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);

        if (voiceURI) {
            const selected = availableVoices.find(v => v.voiceURI === voiceURI);
            if (selected) {
                utterance.voice = selected;
            } else {
                // Fallback: search for language match if URI changed
                const langMatch = availableVoices.find(v => v.lang.startsWith('en'));
                if (langMatch) utterance.voice = langMatch;
            }
        }

        utterance.onstart = () => setIsSpeaking(true);
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = (e) => {
            console.error('[TTS] Utterance error:', e);
            setIsSpeaking(false);
        };

        // Final Chrome catch: ensure it's not paused before speaking
        if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
        }

        window.speechSynthesis.speak(utterance);
    };

    // Chrome priming: Audio must be triggered by user gesture
    const primeAudio = () => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            // Speak a silent, 0-length utterance to "unlock" the audio context
            const v = new SpeechSynthesisUtterance("");
            v.volume = 0;
            window.speechSynthesis.speak(v);
        }
    };

    const handleSubmit = async () => {
        if (!input.trim() || !isConnected || !sessionId) return;

        primeAudio(); // Unlock audio on user gesture

        const userMessage = input;
        setInput('');
        accumulatedResponse.current = '';
        setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
        setIsLoading(true);

        sendMessage({
            type: "chat_message",
            text: userMessage,
            session_id: sessionId
        });
    };

    const startVoiceInput = () => {
        if (isListening && recognitionRef.current) {
            recognitionRef.current.stop();
            return;
        }

        primeAudio(); // Unlock audio on user gesture

        if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window)) {
            const SpeechRecognition = (window as any).webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = false;
            recognitionRef.current.lang = 'en-US';
            setIsListening(true);
            recognitionRef.current.onresult = (event: any) => {
                const transcript = event.results[0][0].transcript;
                setInput(transcript);
                setIsListening(false);
                if (transcript.trim()) setTimeout(() => handleSubmit(), 200);
            };
            recognitionRef.current.onend = () => setIsListening(false);
            recognitionRef.current.start();
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
            {/* Message Area */}
            <div style={{
                flex: 1,
                overflowY: 'auto',
                paddingBottom: isMobile ? 120 : 100,
                paddingRight: isMobile ? 4 : 8,
                paddingLeft: isMobile ? 4 : 0
            }}>
                {messages.length === 0 && !isLoading ? (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', opacity: 0.5, padding: 20 }}>
                        <RobotOutlined style={{ fontSize: isMobile ? 48 : 64, marginBottom: 24, color: 'var(--accent-primary)' }} className="floating" />
                        <Title level={isMobile ? 4 : 3} style={{ color: '#fff', textAlign: 'center' }}>How can I assist you today?</Title>
                        <Space style={{ marginTop: 8 }}>
                            {!sessionId && onShowHistory && (
                                <Button
                                    type="text"
                                    icon={<HistoryOutlined />}
                                    onClick={onShowHistory}
                                    style={{ color: 'rgba(255,255,255,0.6)' }}
                                >
                                    Select from History
                                </Button>
                            )}
                            {!sessionId && onCreateNew && (
                                <Button
                                    type="primary"
                                    icon={<PlusOutlined />}
                                    onClick={onCreateNew}
                                    style={{ borderRadius: '12px' }}
                                >
                                    New Workspace
                                </Button>
                            )}
                        </Space>
                    </div>
                ) : (
                    <div style={{ padding: '0 24px' }}>
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                style={{
                                    display: 'flex',
                                    justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                    marginBottom: 24,
                                    width: '100%'
                                }}
                            >
                                <div style={{
                                    maxWidth: isMobile ? '90%' : '75%',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
                                }}>
                                    {msg.role === 'assistant' && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, marginLeft: 4 }}>
                                            <div style={{
                                                width: 32, height: 32, borderRadius: '10px',
                                                background: `linear-gradient(135deg, var(--accent-secondary), var(--accent-primary))`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                                            }}>
                                                <RobotOutlined style={{ color: '#fff' }} />
                                            </div>
                                            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '1px' }}>Intelligence</Text>
                                        </div>
                                    )}
                                    <div style={{
                                        padding: '16px 20px',
                                        borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '4px 20px 20px 20px',
                                        background: msg.role === 'user'
                                            ? `linear-gradient(135deg, var(--accent-primary), var(--accent-primary))`
                                            : 'rgba(255,255,255,0.03)',
                                        border: msg.role === 'user' ? 'none' : '1px solid rgba(255,255,255,0.05)',
                                        color: '#fff',
                                        fontSize: 16,
                                        lineHeight: 1.6,
                                        boxShadow: msg.role === 'user' ? `0 10px 25px -5px ${primaryColor}40` : 'none',
                                        wordBreak: 'break-word',
                                        whiteSpace: 'pre-wrap'
                                    }}>
                                        {msg.content}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div style={{ display: 'flex', gap: 12, margin: '20px 0', alignItems: 'center' }}>
                                {!isMobile && <Avatar icon={<RobotOutlined />} style={{ background: 'rgba(255,255,255,0.1)' }} />}
                                <div style={{ padding: '12px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px 15px 15px 15px', border: '1px solid var(--glass-border)' }}>
                                    <LoadingOutlined style={{ color: 'var(--accent-primary)' }} />
                                </div>
                            </div>
                        )}
                        <div ref={scrollAnchorRef} />
                    </div>
                )}
            </div>

            {/* Floating Input Pill */}
            <div style={{
                position: 'fixed',
                bottom: isMobile ? 12 : 24,
                left: '50%',
                transform: 'translateX(-50%)',
                width: isMobile ? 'calc(100% - 24px)' : '90%',
                maxWidth: '800px',
                zIndex: 1000,
                transition: 'all 0.3s'
            }}>
                <div style={{
                    background: 'rgba(22, 22, 22, 0.7)',
                    backdropFilter: 'blur(30px)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: isMobile ? '20px' : '24px',
                    padding: isMobile ? '4px 8px' : '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: isMobile ? 4 : 8,
                    boxShadow: '0 10px 40px rgba(0,0,0,0.6)'
                }}>
                    <TextArea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={
                            !sessionId ? "Select or create a workspace..." :
                                !isConnected ? "Reconnecting... (You can still type)" :
                                    "Ask the Intelligence anything..."
                        }
                        autoSize={{ minRows: 1, maxRows: 4 }}
                        onPressEnter={(e) => { if (!e.shiftKey && !isMobile) { e.preventDefault(); handleSubmit(); } }}
                        disabled={!sessionId}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            boxShadow: 'none',
                            color: '#fff',
                            fontSize: isMobile ? 15 : 16,
                            padding: isMobile ? '8px 12px' : '8px 16px'
                        }}
                    />
                    <div style={{ display: 'flex', gap: 4 }}>
                        <Button
                            type="text"
                            icon={isListening ? <StopOutlined style={{ color: '#ff4d4f' }} /> : <AudioOutlined style={{ color: 'rgba(255,255,255,0.5)' }} />}
                            onClick={startVoiceInput}
                            disabled={!isConnected || !sessionId}
                            style={{ width: isMobile ? 36 : 40, height: isMobile ? 36 : 40 }}
                            className="ai-glow mobile-only-hide"
                        />
                        <Button
                            type="primary"
                            icon={<SendOutlined />}
                            onClick={handleSubmit}
                            disabled={!isConnected || !sessionId || !input.trim()}
                            style={{
                                borderRadius: isMobile ? '14px' : '16px',
                                height: isMobile ? 36 : 40,
                                width: isMobile ? 36 : 40,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        />
                    </div>
                </div>
            </div>

            {isSpeaking && (
                <div style={{ position: 'fixed', bottom: isMobile ? 80 : 100, left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
                    <Button size="small" danger onClick={() => synthesisRef.current?.cancel()} shape="round" icon={<StopOutlined />}>
                        Stop
                    </Button>
                </div>
            )}
        </div>
    );
}
