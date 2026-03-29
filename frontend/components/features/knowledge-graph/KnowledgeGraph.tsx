'use client';

import React, { useEffect, useState, useRef } from 'react';
import dynamic from 'next/dynamic';
import { Button, Spin, Typography, Space, Tooltip, Empty, Badge } from 'antd';
import { CloseOutlined, RetweetOutlined, LinkOutlined, SearchOutlined } from '@ant-design/icons';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';

const { Title, Text } = Typography;

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
    ssr: false,
    loading: () => (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.2)' }}>
            <Spin size="large" tip="Initializing Neural Map..." />
        </div>
    )
});

interface GraphData {
    nodes: any[];
    links: any[];
}

interface Mention {
    doc_id: string;
    filename: string;
    text: string;
}

interface KnowledgeGraphProps {
    onClose: () => void;
}

export default function KnowledgeGraph({ onClose }: KnowledgeGraphProps) {
    const { token } = useAuth();
    const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
    const [loading, setLoading] = useState(true);
    const [selectedEntity, setSelectedEntity] = useState<any>(null);
    const [mentions, setMentions] = useState<Mention[]>([]);
    const [loadingMentions, setLoadingMentions] = useState(false);
    const graphRef = useRef<any>(null);

    const fetchGraph = async () => {
        try {
            setLoading(true);
            const res = await apiFetch<GraphData>('/intelligence/graph', { token: token ?? undefined });
            console.log('Graph Data Received:', res);
            setData(res);
        } catch (error: any) {
            console.error('Failed to fetch graph data', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchGraph();
    }, []);

    const getColor = (node: any) => {
        switch (node.type) {
            case 'DOCUMENT': return '#8e2de2';
            case 'ORG': return '#ff4d4f';
            case 'PERSON': return '#52c41a';
            case 'PRODUCT': return '#faad14';
            default: return '#1890ff';
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: 0, left: 0, width: '100vw', height: '100vh',
            zIndex: 9999, background: '#050505',
            display: 'flex', flexDirection: 'column'
        }}>
            {/* STABLE HEADER - NOT ABSOLUTE */}
            <div style={{
                padding: '16px 24px',
                borderBottom: '1px solid rgba(255,255,255,0.1)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                background: 'rgba(10,10,10,0.95)',
                zIndex: 10001
            }}>
                <div>
                    <Title level={4} style={{ margin: 0, color: '#fff', fontSize: '18px' }}>Neural Knowledge Map</Title>
                    <Text style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>Exploring {data.nodes.length} Intelligence Nodes</Text>
                </div>
                <Space size="middle">
                    <Button
                        icon={<RetweetOutlined />}
                        onClick={fetchGraph}
                        loading={loading}
                        style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                        Sync
                    </Button>
                    <Button
                        type="primary"
                        danger
                        icon={<CloseOutlined />}
                        onClick={onClose}
                        size="large"
                        style={{ borderRadius: '8px', fontWeight: 'bold' }}
                    >
                        Close Map
                    </Button>
                </Space>
            </div>

            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
                {loading && data.nodes.length === 0 ? (
                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Spin size="large" />
                    </div>
                ) : (
                    <ForceGraph3D
                        ref={graphRef}
                        graphData={data}
                        nodeLabel={(node: any) => `<div style="padding: 8px; background: #111; border: 1px solid ${getColor(node)}; border-radius: 4px;">${node.name}</div>`}
                        nodeColor={getColor}
                        nodeRelSize={6}
                        backgroundColor="#050505"
                        onNodeClick={(node: any) => setSelectedEntity(node)}
                    />
                )}

                {/* Legend Overlay */}
                <div style={{ position: 'absolute', bottom: 30, left: 30, padding: 20, background: 'rgba(0,0,0,0.85)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', zIndex: 10000 }}>
                    <Space direction="vertical" size={8}>
                        <Badge color="#8e2de2" text="Documents" style={{ color: '#fff' }} />
                        <Badge color="#ff4d4f" text="Organizations" style={{ color: '#fff' }} />
                        <Badge color="#52c41a" text="People" style={{ color: '#fff' }} />
                        <Badge color="#faad14" text="Products" style={{ color: '#fff' }} />
                    </Space>
                </div>
            </div>

            {/* Entity Side Panel */}
            {selectedEntity && (
                <div style={{
                    position: 'fixed', right: 0, top: 0, bottom: 0, width: 400,
                    background: 'rgba(10,10,10,0.98)', borderLeft: '1px solid rgba(255,255,255,0.1)',
                    zIndex: 10002, padding: 24, overflowY: 'auto'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                        <Title level={3} style={{ color: '#fff', margin: 0 }}>{selectedEntity.name}</Title>
                        <Button icon={<CloseOutlined />} type="text" onClick={() => setSelectedEntity(null)} style={{ color: '#fff' }} />
                    </div>
                    <Text type="secondary" style={{ display: 'block', marginBottom: 20 }}>Type: {selectedEntity.type}</Text>
                    <Empty description="No further details available for this node type." />
                </div>
            )}
        </div>
    );
}
