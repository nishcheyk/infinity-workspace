'use client';

import React, { useEffect, useState } from 'react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { useWebSocket } from '../../context/WebSocketContext';
import { Button } from 'antd'; // Using AntD Button now since we switched
import { UploadOutlined, LogoutOutlined, FileTextOutlined } from '@ant-design/icons';

interface Document {
    id: string;
    filename: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    upload_timestamp: string;
}

export const Sidebar = () => {
    const { token, logout } = useAuth();
    const { lastMessage, isConnected } = useWebSocket();
    const [documents, setDocuments] = useState<Document[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        if (token) {
            fetchDocuments();
        }
    }, [token]);

    // Listen for WebSocket updates
    useEffect(() => {
        if (lastMessage && lastMessage.type === 'ingestion_status') {
            setDocuments(prev => prev.map(doc =>
                doc.id === lastMessage.doc_id
                    ? { ...doc, status: lastMessage.status }
                    : doc
            ));
            // Also refresh list if new doc added or just simply rely on internal state
            if (lastMessage.status === 'completed' || lastMessage.status === 'failed') {
                fetchDocuments();
            }
        }
    }, [lastMessage]);

    const fetchDocuments = async () => {
        try {
            if (!token) return;
            const docs = await apiFetch<Document[]>('/ingestion/documents', { token });
            setDocuments(docs);
        } catch (error) {
            console.error('Failed to fetch docs', error);
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
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData,
            });

            if (!res.ok) throw new Error('Upload failed');
            await fetchDocuments();
        } catch (err) {
            console.error(err);
            alert("Upload failed");
        } finally {
            setIsUploading(false);
            e.target.value = '';
        }
    };

    return (
        <div className="w-64 bg-gray-900 text-white flex flex-col h-full border-r border-gray-800">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center">
                <h1 className="text-xl font-bold text-white">AI Docs</h1>
                <div title={isConnected ? "Connected" : "Disconnected"} className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            </div>

            <div className="p-4">
                <label className="block w-full cursor-pointer">
                    <div className={`
                        flex items-center justify-center w-full px-4 py-2 
                        border border-gray-700 rounded hover:border-blue-500 
                        transition-colors bg-gray-800 text-sm
                        ${isUploading ? 'opacity-50' : ''}
                    `}>
                        <UploadOutlined className="mr-2" />
                        {isUploading ? 'Uploading...' : 'Upload File'}
                    </div>
                    <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.docx,.txt"
                        onChange={handleFileUpload}
                        disabled={isUploading}
                    />
                </label>
            </div>

            <div className="flex-1 overflow-y-auto px-2 space-y-1">
                {documents.map((doc) => (
                    <div key={doc.id} className="flex items-center p-2 rounded hover:bg-gray-800 text-sm group">
                        <FileTextOutlined className="mr-2 text-gray-400" />
                        <div className="truncate flex-1">
                            <div className="truncate text-gray-200">{doc.filename}</div>
                            <div className={`text-xs ${doc.status === 'completed' ? 'text-green-500' :
                                    doc.status === 'processing' ? 'text-yellow-500' :
                                        doc.status === 'failed' ? 'text-red-500' : 'text-gray-500'
                                }`}>
                                {doc.status}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <div className="p-4 border-t border-gray-800">
                <Button
                    type="text"
                    danger
                    icon={<LogoutOutlined />}
                    className="w-full text-left pl-0 hover:bg-gray-800"
                    onClick={logout}
                >
                    Sign Out
                </Button>
            </div>
        </div>
    );
};
