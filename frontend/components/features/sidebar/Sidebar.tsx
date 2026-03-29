'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api';
import { useAuth } from '../../../context/AuthContext';
import { useWebSocket } from '../../../context/WebSocketContext';
import { Button, Tooltip, Collapse, Checkbox, notification, Spin } from 'antd';
import { UploadOutlined, LogoutOutlined, FileTextOutlined, FolderOpenOutlined, ExperimentOutlined, FileSearchOutlined } from '@ant-design/icons';

const { Panel } = Collapse;

interface Document {
    id: string;
    filename: string;
    status: 'pending' | 'processing' | 'analyzing' | 'completed' | 'failed' | 'summarizing';
    upload_timestamp: string;
    summary?: string;
    tags?: string[];
    suggestions?: string[];
}

interface Cluster {
    name: string;
    doc_ids: string[];
}

export const Sidebar = () => {
    const { token, logout } = useAuth();
    const { isConnected } = useWebSocket();
    const [documents, setDocuments] = useState<Document[]>([]);
    const [clusters, setClusters] = useState<Cluster[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [isLoadingClusters, setIsLoadingClusters] = useState(false);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isSynthesizing, setIsSynthesizing] = useState(false);

    useEffect(() => {
        if (token) {
            fetchDocuments();
            fetchClusters();
        }
    }, [token]);

    const fetchDocuments = async () => {
        try {
            if (!token) return;
            const docs = await apiFetch<Document[]>('/ingestion/documents', { token });
            setDocuments(docs);
        } catch (error) {
            console.error('Failed to fetch docs', error);
        }
    };

    const fetchClusters = async () => {
        try {
            if (!token) return;
            setIsLoadingClusters(true);
            const data = await apiFetch<Cluster[]>('/ingestion/clusters', { token });
            setClusters(data);
        } catch (err) {
            console.error('Failed to fetch clusters', err);
        } finally {
            setIsLoadingClusters(false);
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files?.length || !token) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('file', e.target.files[0]);

        try {
            const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
            const res = await fetch(`${API_URL}/ingestion/upload`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData,
            });

            if (!res.ok) throw new Error('Upload failed');
            notification.success({ message: 'Upload Started', description: 'Document is being processed.' });
            await fetchDocuments();
        } catch (err) {
            console.error(err);
            notification.error({ message: 'Upload Failed' });
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    const handleSynthesize = async () => {
        if (selectedIds.length === 0) return;
        try {
            setIsSynthesizing(true);
            notification.info({ message: 'Synthesis Started', description: 'Multiple agents are collaborating on your report...' });

            const report = await apiFetch<any>('/intelligence/synthesize', {
                method: 'POST',
                token: token ?? undefined,
                body: JSON.stringify({ doc_ids: selectedIds, topic: "comprehensive research synthesis" })
            });

            // Focus on chat and show report (handled by parent or just notify user)
            notification.success({
                message: 'Report Ready',
                description: 'Check the Knowledge Graph or your Chat history for the synthesized report.'
            });
            setSelectionMode(false);
            setSelectedIds([]);
        } catch (err) {
            notification.error({ message: 'Synthesis Failed' });
        } finally {
            setIsSynthesizing(false);
        }
    };

    const toggleSelection = (docId: string) => {
        setSelectedIds(prev =>
            prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
        );
    };

    const renderDocItem = (doc: Document) => (
        <div key={doc.id} className="flex flex-col p-2 rounded hover:bg-white/5 transition-all group relative">
            <div className="flex items-center">
                {selectionMode ? (
                    <Checkbox
                        checked={selectedIds.includes(doc.id)}
                        onChange={() => toggleSelection(doc.id)}
                        className="mr-3"
                    />
                ) : (
                    <FileTextOutlined className="mr-3 text-gray-400 group-hover:text-blue-400" />
                )}
                <div className="truncate flex-1 text-gray-200 group-hover:text-white text-sm">
                    {doc.filename}
                </div>
            </div>
            <div className="ml-7 mt-1 text-[10px] text-gray-500 uppercase tracking-widest">
                {doc.status}
            </div>
        </div>
    );

    return (
        <div className="w-72 bg-black/40 backdrop-blur-xl text-white flex flex-col h-full border-r border-white/10">
            <div className="p-5 border-b border-white/5">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">Infinity</h1>
                    <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-blue-500 shadow-[0_0_10px_#3b82f6]' : 'bg-red-500'}`} />
                </div>

                <label className="block w-full cursor-pointer">
                    <div className={`flex items-center justify-center w-full px-4 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl transition-all font-medium text-sm shadow-lg shadow-blue-900/20 ${isUploading ? 'opacity-50' : ''}`}>
                        <UploadOutlined className="mr-2" />
                        {isUploading ? 'Uploading...' : 'Quick Ingestion'}
                    </div>
                    <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
                </label>
            </div>

            <div className="p-4 flex gap-2">
                <Button
                    ghost
                    size="small"
                    icon={<ExperimentOutlined />}
                    onClick={() => { setSelectionMode(!selectionMode); setSelectedIds([]); }}
                    className={selectionMode ? 'border-blue-500 text-blue-500' : 'border-white/20 text-white/40'}
                    style={{ flex: 1, height: 32 }}
                >
                    Research Room
                </Button>
                <Button
                    ghost
                    size="small"
                    icon={<FolderOpenOutlined />}
                    onClick={fetchClusters}
                    style={{ height: 32, borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.4)' }}
                >
                    Clustering
                </Button>
            </div>

            {selectionMode && selectedIds.length > 0 && (
                <div className="px-4 py-2">
                    <Button
                        type="primary"
                        icon={<FileSearchOutlined />}
                        onClick={handleSynthesize}
                        loading={isSynthesizing}
                        block
                        className="bg-purple-600 hover:bg-purple-500 border-none rounded-lg"
                    >
                        Synthesize {selectedIds.length} Docs
                    </Button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto px-3 space-y-4 py-2">
                {isLoadingClusters && <div className="text-center p-4"><Spin size="small" /></div>}

                {clusters.length > 0 && clusters.map((cluster, cIdx) => (
                    <div key={cIdx} className="space-y-1">
                        <div className="flex items-center px-1 text-[10px] font-bold text-white/30 uppercase tracking-[2px] mb-2">
                            <FolderOpenOutlined className="mr-2" />
                            {cluster.name}
                        </div>
                        {cluster.doc_ids.map(id => {
                            const doc = documents.find(d => d.id === id);
                            return doc ? renderDocItem(doc) : null;
                        })}
                    </div>
                ))}

                {/* Uncategorized or Full List if no clusters */}
                <div className="space-y-1">
                    <div className="flex items-center px-1 text-[10px] font-bold text-white/30 uppercase tracking-[2px] mb-2">
                        <FileTextOutlined className="mr-2" />
                        All Assets
                    </div>
                    {documents
                        .filter(d => !clusters.some(c => c.doc_ids.includes(d.id)))
                        .map(doc => renderDocItem(doc))}
                </div>
            </div>

            <div className="p-4 border-t border-white/5">
                <Button type="text" danger icon={<LogoutOutlined />} block onClick={logout} className="flex justify-start text-white/40 hover:text-red-400">
                    Infrastructure Exit
                </Button>
            </div>
        </div>
    );
};
