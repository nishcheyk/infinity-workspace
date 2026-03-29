'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Input, Button, List, Typography, Grid, theme, Avatar, Space, Badge, Tooltip, notification } from 'antd';
import { SendOutlined, AudioOutlined, UserOutlined, RobotOutlined, StopOutlined, SoundOutlined, LoadingOutlined, HistoryOutlined, PlusOutlined, CopyOutlined, LikeOutlined, DislikeOutlined, DownloadOutlined, CheckOutlined } from '@ant-design/icons';
import { useSettings } from '../../../context/SettingsContext';
import { useWebSocket } from '../../../context/WebSocketContext';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import ChartRenderer from '../analytics/ChartRenderer';
import { useMicVAD } from "@ricky0123/vad-react";

const { TextArea } = Input;
const { Text, Title } = Typography;
const { useBreakpoint } = Grid;
const { useToken } = theme;

interface Message {
    role: 'user' | 'assistant';
    content: string;
    sources?: any[];
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
    const [coPilotMode, setCoPilotMode] = useState(false);

    const { voiceURI, availableVoices, autoPlay, primaryColor, useBackendTTS } = useSettings();
    const { sendMessage, isConnected, subscribe } = useWebSocket();
    const { token } = useAuth();

    const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
    const [reactions, setReactions] = useState<Record<number, 'like' | 'dislike' | undefined>>({});
    const screens = useBreakpoint();
    const isMobile = !screens.md;

    const synthesisRef = useRef<SpeechSynthesis | null>(null);
    const recognitionRef = useRef<any>(null);
    const accumulatedResponse = useRef('');
    const scrollAnchorRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        scrollAnchorRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

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
                    content: m.content,
                    sources: m.sources
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

    // Handle WebSocket
    useEffect(() => {
        const unsubscribe = subscribe((data) => {
            if (data.type === 'chat_start') {
                accumulatedResponse.current = '';
                setIsLoading(true);
            } else if (data.type === 'chat_token') {
                const tok = data.token || '';
                if (tok.startsWith('__METADATA__:')) {
                    try {
                        const metaStr = tok.replace('__METADATA__:', '').trim();
                        const sources = JSON.parse(metaStr);
                        setMessages(prev => {
                            const msgs = [...prev];
                            if (msgs.length > 0 && msgs[msgs.length - 1].role === 'assistant') {
                                msgs[msgs.length - 1].sources = sources;
                            }
                            return msgs;
                        });
                        return;
                    } catch (e) { }
                }
                accumulatedResponse.current += tok;
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
                const finalContent = accumulatedResponse.current.trim();
                if (autoPlay && finalContent) {
                    speakText(finalContent);
                }
                if (onChatComplete) onChatComplete();
            }
        });
        return () => unsubscribe();
    }, [subscribe, autoPlay]);

    const handleSubmit = async (overrideInput?: string) => {
        const textToSubmit = overrideInput || input;
        if (!textToSubmit.trim() || !isConnected || !sessionId) return;

        primeAudio();
        setInput('');
        accumulatedResponse.current = '';
        setMessages(prev => [...prev, { role: 'user', content: textToSubmit }]);
        setIsLoading(true);

        sendMessage({
            type: "chat_message",
            text: textToSubmit,
            session_id: sessionId
        });
    };

    const vad = useMicVAD({
        startOnLoad: false,
        onSpeechStart: () => {
            if (coPilotMode) setInput('');
        },
        onSpeechEnd: () => {
            if (coPilotMode) {
                // Wait for browser recognition to finalize
                setTimeout(() => {
                    const chatComp = document.getElementById('chat-input-area') as HTMLTextAreaElement;
                    if (chatComp?.value.trim()) {
                        handleSubmit(chatComp.value);
                    }
                }, 1000);
            }
        },
    });

    const startVoiceInput = () => {
        if (isListening && recognitionRef.current) {
            recognitionRef.current.stop();
            if (coPilotMode) vad.pause();
            return;
        }

        primeAudio();

        if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window)) {
            const SpeechRecognition = (window as any).webkitSpeechRecognition;
            recognitionRef.current = new SpeechRecognition();
            recognitionRef.current.continuous = coPilotMode;
            recognitionRef.current.interimResults = true;
            recognitionRef.current.lang = 'en-US';
            setIsListening(true);

            if (coPilotMode) vad.start();

            recognitionRef.current.onresult = (event: any) => {
                let current = "";
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    current += event.results[i][0].transcript;
                }
                setInput(current);

                if (!coPilotMode && event.results[0].isFinal) {
                    setIsListening(false);
                    handleSubmit(current);
                }
            };

            recognitionRef.current.onend = () => {
                if (!coPilotMode) setIsListening(false);
            };
            recognitionRef.current.start();
        }
    };

    const toggleCoPilot = () => {
        const next = !coPilotMode;
        setCoPilotMode(next);
        if (next) {
            notification.info({ message: 'Hands-free Co-Pilot Active' });
            startVoiceInput();
        } else {
            vad.pause();
            if (recognitionRef.current) recognitionRef.current.stop();
            setIsListening(false);
        }
    };

    const speakText = async (text: string) => {
        if (!text) return;
        if (useBackendTTS) {
            try {
                setIsSpeaking(true);
                const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/tts/speak`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text, voice: 'alloy' })
                });
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const audio = new Audio(url);
                audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(url); };
                audio.play();
            } catch (e) { browserSpeak(text); }
        } else { browserSpeak(text); }
    };

    const browserSpeak = (text: string) => {
        if (!synthesisRef.current || !text) return;
        window.speechSynthesis.cancel();
        const u = new SpeechSynthesisUtterance(text);
        if (voiceURI) {
            const v = availableVoices.find(v => v.voiceURI === voiceURI);
            if (v) u.voice = v;
        }
        u.onstart = () => setIsSpeaking(true);
        u.onend = () => setIsSpeaking(false);
        window.speechSynthesis.speak(u);
    };

    const primeAudio = () => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            const v = new SpeechSynthesisUtterance("");
            v.volume = 0;
            window.speechSynthesis.speak(v);
        }
    };

    const renderPart = (part: string, key: any) => {
        if (part.includes('```chart')) {
            const [_, rest] = part.split('```chart');
            if (rest.includes('```')) {
                const [jsonStr, textAfter] = rest.split('```');
                try {
                    const data = JSON.parse(jsonStr.trim());
                    return (
                        <div key={key}>
                            <ChartRenderer type={data.type} data={data.data} title={data.title} />
                            <div style={{ whiteSpace: 'pre-wrap' }}>{textAfter}</div>
                        </div>
                    );
                } catch (e) { return <div key={key} style={{ whiteSpace: 'pre-wrap' }}>{part}</div>; }
            }
        }
        return <div key={key} style={{ whiteSpace: 'pre-wrap' }}>{part}</div>;
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px', paddingBottom: 120 }}>
                {messages.length === 0 && !isLoading ? (
                    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', opacity: 0.5 }}>
                        <RobotOutlined style={{ fontSize: 64, marginBottom: 24, color: 'var(--accent-primary)' }} className="floating" />
                        <Title level={3} style={{ color: '#fff' }}>Autonomous Intelligence Ready</Title>
                    </div>
                ) : (
                    messages.map((msg, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: 24 }}>
                            <div style={{ maxWidth: holds(isMobile, '90%', '75%'), display: 'flex', flexDirection: 'column', alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                                {msg.role === 'assistant' && (
                                    <Space style={{ marginBottom: 8, marginLeft: 4 }}>
                                        <Avatar size="small" icon={<RobotOutlined />} style={{ background: 'linear-gradient(135deg, var(--accent-secondary), var(--accent-primary))' }} />
                                        <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>Intelligence</Text>
                                    </Space>
                                )}
                                <div style={{
                                    padding: '16px 20px',
                                    borderRadius: msg.role === 'user' ? '20px 20px 4px 20px' : '4px 20px 20px 20px',
                                    background: msg.role === 'user' ? 'var(--accent-primary)' : 'rgba(255,255,255,0.03)',
                                    color: '#fff', fontSize: 16, lineHeight: 1.6, border: '1px solid rgba(255,255,255,0.05)'
                                }}>
                                    {msg.role === 'assistant' ? msg.content.split(/(?=```chart)/).map((p, i) => renderPart(p, i)) : msg.content}

                                    {msg.sources && msg.sources.length > 0 && (
                                        <div style={{ marginTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: 12 }}>
                                            <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', display: 'block', marginBottom: 6 }}>Citations</Text>
                                            <Space wrap>
                                                {Array.from(new Set(msg.sources.map(s => s.filename))).map((f: any, i) => (
                                                    <Badge key={i} count={f} style={{ backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.6)', border: 'none' }} />
                                                ))}
                                            </Space>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))
                )}
                <div ref={scrollAnchorRef} />
            </div>

            <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', width: '90%', maxWidth: 800 }}>
                <div className="glass-panel" style={{ padding: 8, display: 'flex', alignItems: 'center', gap: 8, borderRadius: 24 }}>
                    <Tooltip title="Hands-free Conversation">
                        <Button
                            type="text"
                            icon={<SoundOutlined style={{ color: coPilotMode ? 'var(--accent-primary)' : 'rgba(255,255,255,0.3)' }} />}
                            onClick={toggleCoPilot}
                            style={{ width: 40, height: 40 }}
                        />
                    </Tooltip>
                    <TextArea
                        id="chat-input-area"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        placeholder={coPilotMode ? "Co-Pilot Listening..." : "Ask Intelligence..."}
                        autoSize={{ minRows: 1, maxRows: 4 }}
                        onPressEnter={e => { if (!e.shiftKey && !isMobile) { e.preventDefault(); handleSubmit(); } }}
                        style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 16 }}
                    />
                    <Button
                        type="text"
                        icon={isListening ? <StopOutlined style={{ color: '#ff4d4f' }} /> : <AudioOutlined />}
                        onClick={startVoiceInput}
                    />
                    <Button
                        type="primary"
                        icon={<SendOutlined />}
                        onClick={() => handleSubmit()}
                        style={{ borderRadius: 16, height: 40, width: 40 }}
                    />
                </div>
            </div>
            {isSpeaking && (
                <div style={{ position: 'fixed', bottom: 100, left: '50%', transform: 'translateX(-50%)' }}>
                    <Button size="small" danger onClick={() => synthesisRef.current?.cancel()} shape="round" icon={<StopOutlined />}>Stop Voice</Button>
                </div>
            )}
        </div>
    );
}

function holds(cond: boolean, a: string, b: string) { return cond ? a : b; }
