import { useState, useEffect, useCallback } from 'react';
import { Document } from '@/types/api';
import { apiGet, apiDelete, apiUpload } from '@/lib/apiClient';
import { showSuccess, showError } from '@/lib/notifications';

export function useDocuments() {
    const [documents, setDocuments] = useState<Document[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);

    const fetchDocuments = useCallback(async () => {
        setLoading(true);
        const response = await apiGet<Document[]>('/documents');
        setLoading(false);

        if (response.data) {
            setDocuments(response.data);
        } else if (response.error) {
            showError('Failed to fetch documents', response.error);
        }
    }, []);

    const uploadDocument = useCallback(async (file: File) => {
        setUploading(true);
        const response = await apiUpload('/upload', file);
        setUploading(false);

        if (response.data) {
            showSuccess('Upload started', 'Document is being processed');
            await fetchDocuments();
            return true;
        } else if (response.error) {
            showError('Upload failed', response.error);
            return false;
        }
        return false;
    }, [fetchDocuments]);

    const deleteDocument = useCallback(async (docId: string) => {
        const response = await apiDelete(`/documents/${docId}`);

        if (response.data) {
            showSuccess('Document deleted');
            setDocuments(prev => prev.filter(doc => doc.id !== docId));
            return true;
        } else if (response.error) {
            showError('Delete failed', response.error);
            return false;
        }
        return false;
    }, []);

    useEffect(() => {
        fetchDocuments();
    }, [fetchDocuments]);

    return {
        documents,
        loading,
        uploading,
        fetchDocuments,
        uploadDocument,
        deleteDocument,
    };
}
