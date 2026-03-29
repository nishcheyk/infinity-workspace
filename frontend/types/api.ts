// API Type Definitions

export interface ApiResponse<T> {
    data?: T;
    error?: string;
    message?: string;
}

export interface Document {
    id: string;
    filename: string;
    status: 'uploading' | 'processing' | 'analyzing' | 'completed' | 'failed';
    summary?: string;
    tags?: string[];
    suggestions?: string[];
    chunks?: number;
    created_at?: string;
    updated_at?: string;
}

export interface ChatSession {
    id: string;
    title: string;
    created_at: string;
    updated_at: string;
}

export interface Message {
    role: 'user' | 'assistant';
    content: string;
    sources?: any[];
}

export interface ChatMessage {
    session_id: string;
    message: string;
}

export interface UploadResponse {
    doc_id: string;
    filename: string;
    message: string;
}

export interface UserProfile {
    email: string;
    created_at: string;
}

export interface GraphNode {
    id: string;
    label: string;
    type: string;
    val?: number;
}

export interface GraphLink {
    source: string;
    target: string;
}

export interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
}
