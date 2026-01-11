'use client';

import { Modal, Select, Switch, Slider, Typography, Space, Divider, Button } from 'antd';
import { useSettings } from '../../context/SettingsContext';
import { SendOutlined, AudioOutlined, UserOutlined, RobotOutlined, StopOutlined, SoundOutlined, LoadingOutlined, HistoryOutlined, PlusOutlined, BgColorsOutlined } from '@ant-design/icons';

const { Text, Title } = Typography;

interface SettingsModalProps {
    visible: boolean;
    onClose: () => void;
}

export default function SettingsModal({ visible, onClose }: SettingsModalProps) {
    const {
        availableVoices,
        voiceURI,
        setVoiceURI,
        autoPlay,
        setAutoPlay,
        primaryColor,
        setPrimaryColor,
        secondaryColor,
        setSecondaryColor
    } = useSettings();

    return (
        <Modal
            title={<Title level={4} style={{ margin: 0, color: '#fff', fontSize: 20 }}>Intelligence Configuration</Title>}
            open={visible}
            onCancel={onClose}
            footer={null}
            width={580}
            styles={{
                mask: { backdropFilter: 'blur(10px)' },
                body: {
                    background: 'rgba(15, 15, 15, 0.85)',
                    backdropFilter: 'blur(30px)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
                    borderRadius: '28px',
                    padding: '32px'
                },
                header: {
                    background: 'transparent',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
                    padding: '20px 32px',
                    marginBottom: 0
                }
            }}
        >
            <div style={{ padding: '8px 0' }}>
                <Space direction="vertical" size={32} style={{ width: '100%' }}>

                    {/* Voice Selection */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                            <SoundOutlined style={{ color: 'var(--accent-primary)', fontSize: 18 }} />
                            <div>
                                <Text strong style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15 }}>AI Voice Intelligence</Text>
                                <Text type="secondary" style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', display: 'block' }}>Select from your system's available intelligence cores</Text>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <Select
                                style={{ flex: 1 }}
                                placeholder="Select a voice personality"
                                value={voiceURI}
                                onChange={setVoiceURI}
                                className="glass-select"
                                showSearch
                                optionFilterProp="label"
                                options={availableVoices.map(v => ({
                                    label: `${v.name} [${v.lang}]`,
                                    value: v.voiceURI
                                }))}
                            />
                            <Button
                                icon={<SoundOutlined />}
                                onClick={() => {
                                    if (typeof window !== 'undefined' && window.speechSynthesis) {
                                        window.speechSynthesis.cancel();
                                        const utterance = new SpeechSynthesisUtterance("Intelligence system online. Audio confirmed.");
                                        const selected = availableVoices.find(v => v.voiceURI === voiceURI);
                                        if (selected) utterance.voice = selected;
                                        window.speechSynthesis.speak(utterance);
                                    }
                                }}
                                style={{ borderRadius: '12px' }}
                            >
                                Test
                            </Button>
                        </div>
                        <div style={{ marginTop: 12, padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                            <Text style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                                <PlusOutlined style={{ marginRight: 6 }} />
                                Tip: Install more voices in your System Settings &gt; Time &amp; Language &gt; Speech to unlock more options here.
                            </Text>
                        </div>
                    </div>

                    <Divider style={{ borderColor: 'rgba(255,255,255,0.05)', margin: 0 }} />

                    {/* Auto Play Toggle */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <AudioOutlined style={{ color: 'var(--accent-primary)', fontSize: 18 }} />
                            <div>
                                <Text strong style={{ color: 'rgba(255,255,255,0.9)', display: 'block', fontSize: 15 }}>Instant Audio Response</Text>
                                <Text type="secondary" style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Automatically speak AI responses as they arrive</Text>
                            </div>
                        </div>
                        <Switch checked={autoPlay} onChange={setAutoPlay} />
                    </div>

                    <Divider style={{ borderColor: 'rgba(255,255,255,0.05)', margin: 0 }} />

                    {/* Theme Accents */}
                    <div>
                        <div style={{ marginBottom: 28 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                <BgColorsOutlined style={{ color: 'var(--accent-primary)', fontSize: 18 }} />
                                <Text strong style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15 }}>Primary Accent Color</Text>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                                {[
                                    '#8e2de2', '#1890ff', '#f5222d', '#52c41a', '#faad14',
                                    '#ff0099', '#00f2fe', '#f9d423', '#fff', '#70e1f5'
                                ].map(color => (
                                    <div
                                        key={color}
                                        onClick={() => setPrimaryColor(color)}
                                        style={{
                                            width: 36, height: 36, borderRadius: '50%', background: color, cursor: 'pointer',
                                            border: primaryColor === color ? '3px solid #fff' : '2px solid transparent',
                                            boxShadow: primaryColor === color ? `0 0 15px ${color}80` : 'none',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            transform: primaryColor === color ? 'scale(1.1)' : 'scale(1)'
                                        }}
                                    />
                                ))}
                            </div>
                        </div>

                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                                <BgColorsOutlined style={{ color: 'var(--accent-secondary)', fontSize: 18 }} />
                                <Text strong style={{ color: 'rgba(255,255,255,0.9)', fontSize: 15 }}>Secondary Glow Color</Text>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                                {[
                                    '#4a00e0', '#00d2ff', '#fb4d3d', '#45b649', '#f6d365',
                                    'rgba(255,255,255,0.3)', '#ec008c', '#667db6', '#009fff', '#ad5389'
                                ].map(color => (
                                    <div
                                        key={color}
                                        onClick={() => setSecondaryColor(color)}
                                        style={{
                                            width: 36, height: 36, borderRadius: '12px', background: color, cursor: 'pointer',
                                            border: secondaryColor === color ? '3px solid #fff' : '2px solid transparent',
                                            boxShadow: secondaryColor === color ? `0 0 15px ${color}80` : 'none',
                                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                                            transform: secondaryColor === color ? 'scale(1.1)' : 'scale(1)'
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                    </div>
                </Space>
            </div>

            <style jsx global>{`
                .ant-modal-close {
                    color: rgba(255,255,255,0.5) !important;
                }
                .ant-modal-close:hover {
                    color: #fff !important;
                }
                .ant-select-selector {
                    background: rgba(255,255,255,0.05) !important;
                    border: 1px solid rgba(255,255,255,0.1) !important;
                    color: #fff !important;
                    height: 40px !important;
                    padding-top: 4px !important;
                }
                .ant-select-selection-item {
                    color: #fff !important;
                }
                .ant-select-arrow {
                    color: rgba(255,255,255,0.5) !important;
                }
            `}</style>
        </Modal>
    );
}
