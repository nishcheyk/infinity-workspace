'use client';

import React, { useState, useEffect } from 'react';
import { Typography, Alert, Button, Form, message } from 'antd';
import { LockOutlined, RobotOutlined } from '@ant-design/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import AuthFormItem from '../../components/shared/AuthFormItem';
import { apiFetch } from '../../lib/api';

const { Title, Text } = Typography;

const schema = yup.object().shape({
    password: yup.string().min(6, 'Password must be at least 6 characters').required('Please input your Password!'),
    confirm: yup.string()
        .oneOf([yup.ref('password')], 'Passwords do not match!')
        .required('Please confirm your password!'),
});

export default function ResetPasswordPage() {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');

    const { control, handleSubmit, formState: { errors } } = useForm({
        resolver: yupResolver(schema),
        defaultValues: {
            password: '',
            confirm: '',
        }
    });

    useEffect(() => {
        if (!token) {
            setError('Invalid or missing reset token');
        }
    }, [token]);

    const onSubmit = async (values: any) => {
        if (!token) {
            setError('Invalid reset token');
            return;
        }

        setError('');
        setLoading(true);
        try {
            await apiFetch('/auth/reset-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    token,
                    new_password: values.password
                }),
            });
            message.success('Password reset successfully!');
            router.push('/login');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to reset password');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page">
            <div className="mesh-gradient" />

            <div className="glass-panel auth-card animate-slide-up">
                <div className="auth-header">
                    <div className="floating" style={{ display: 'inline-block', marginBottom: 16 }}>
                        <RobotOutlined style={{ fontSize: 48, color: 'var(--accent-primary)' }} />
                    </div>
                    <Title level={2} style={{ color: '#fff', textAlign: 'center', marginBottom: 8, fontWeight: 700 }}>
                        Create New Password
                    </Title>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', display: 'block', textAlign: 'center', marginBottom: 32 }}>
                        Enter your new password below
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

                <form onSubmit={handleSubmit(onSubmit)}>
                    <AuthFormItem
                        name="password"
                        control={control}
                        errors={errors}
                        placeholder="New Password"
                        prefix={<LockOutlined />}
                        type="password"
                    />

                    <AuthFormItem
                        name="confirm"
                        control={control}
                        errors={errors}
                        placeholder="Confirm New Password"
                        prefix={<LockOutlined />}
                        type="password"
                    />

                    <Form.Item style={{ marginBottom: 16 }}>
                        <Button type="primary" htmlType="submit" block loading={loading} disabled={!token} style={{ height: 48, fontSize: 16, fontWeight: 600 }}>
                            Reset Password
                        </Button>
                    </Form.Item>
                </form>
            </div>
        </div>
    );
}
