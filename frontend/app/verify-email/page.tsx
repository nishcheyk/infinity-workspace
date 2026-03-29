'use client';

import React, { useState, useEffect } from 'react';
import { Typography, Alert, Button, Spin } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, RobotOutlined } from '@ant-design/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '../../lib/api';

const { Title, Text } = Typography;

export default function VerifyEmailPage() {
    const [loading, setLoading] = useState(true);
    const [success, setSuccess] = useState(false);
    const [error, setError] = useState('');
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    useEffect(() => {
        const verifyEmail = async () => {
            if (!token) {
                setError('Invalid or missing verification token');
                setLoading(false);
                return;
            }

            try {
                await apiFetch('/auth/verify-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ token }),
                });
                setSuccess(true);
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Failed to verify email');
            } finally {
                setLoading(false);
            }
        };

        verifyEmail();
    }, [token]);

    return (
        <div className="auth-page">
            <div className="mesh-gradient" />

            <div className="glass-panel auth-card animate-slide-up">
                <div className="auth-header">
                    <div className="floating" style={{ display: 'inline-block', marginBottom: 16 }}>
                        {loading ? (
                            <Spin size="large" />
                        ) : success ? (
                            <CheckCircleOutlined style={{ fontSize: 48, color: '#52c41a' }} />
                        ) : (
                            <CloseCircleOutlined style={{ fontSize: 48, color: '#ff4d4f' }} />
                        )}
                    </div>
                    <Title level={2} style={{ color: '#fff', textAlign: 'center', marginBottom: 8, fontWeight: 700 }}>
                        {loading ? 'Verifying Email...' : success ? 'Email Verified!' : 'Verification Failed'}
                    </Title>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', display: 'block', textAlign: 'center', marginBottom: 32 }}>
                        {loading ? 'Please wait while we verify your email' : success ? 'Your email has been successfully verified' : 'There was a problem verifying your email'}
                    </Text>
                </div>

                {error && (
                    <Alert
                        message={error}
                        type="error"
                        showIcon
                        style={{ marginBottom: 24, borderRadius: 12, background: 'rgba(255, 77, 79, 0.1)', border: '1px solid rgba(255, 77, 79, 0.2)', color: '#fff' }}
                    />
                )}

                {!loading && (
                    <Button
                        type="primary"
                        block
                        onClick={() => router.push(success ? '/dashboard' : '/login')}
                        style={{ height: 48, fontSize: 16, fontWeight: 600 }}
                    >
                        {success ? 'Go to Dashboard' : 'Return to Login'}
                    </Button>
                )}
            </div>
        </div>
    );
}
