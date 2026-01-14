'use client';

import React, { useState } from 'react';
import { Typography, Alert, Button, Form } from 'antd';
import { UserOutlined, LockOutlined, RobotOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/api';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import AuthFormItem from '../../components/ui/AuthFormItem';

const { Title, Text } = Typography;

const schema = yup.object().shape({
    email: yup.string().email('Invalid email').required('Please input your Email!'),
    password: yup.string().required('Please input your Password!'),
});

export default function LoginPage() {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login } = useAuth();

    const { control, handleSubmit, formState: { errors } } = useForm({
        resolver: yupResolver(schema),
        defaultValues: {
            email: '',
            password: '',
        }
    });

    const onSubmit = async (values: any) => {
        setError('');
        setLoading(true);
        try {
            const data = await apiFetch<{ access_token: string; refresh_token: string }>('/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: new URLSearchParams({ username: values.email, password: values.password }).toString(),
            });
            login(data.access_token, data.refresh_token);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Login failed');
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
                    <Title level={2} style={{ color: '#fff', textAlign: 'center', marginBottom: 8, fontWeight: 700 }}>Welcome Back</Title>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', display: 'block', textAlign: 'center', marginBottom: 32 }}>Access your intelligent workspace</Text>
                </div>

                {error && (
                    <Alert
                        title={error}
                        type="error"
                        showIcon
                        style={{ marginBottom: 24, borderRadius: 12, background: 'rgba(255, 77, 79, 0.1)', border: '1px solid rgba(255, 77, 79, 0.2)', color: '#fff' }}
                    />
                )}

                <form onSubmit={handleSubmit(onSubmit)}>
                    <AuthFormItem
                        name="email"
                        control={control}
                        errors={errors}
                        placeholder="Email address"
                        prefix={<UserOutlined />}
                        type="email"
                    />

                    <AuthFormItem
                        name="password"
                        control={control}
                        errors={errors}
                        placeholder="Password"
                        prefix={<LockOutlined />}
                        type="password"
                    />

                    <Form.Item style={{ marginBottom: 16 }}>
                        <Button type="primary" htmlType="submit" block loading={loading} style={{ height: 48, fontSize: 16, fontWeight: 600 }}>
                            Sign In
                        </Button>
                    </Form.Item>

                    <div style={{ textAlign: 'center' }}>
                        <Text style={{ color: 'rgba(255,255,255,0.45)' }}>
                            New here? <Link href="/signup">Create workspace account</Link>
                        </Text>
                    </div>
                </form>
            </div>
        </div>
    );
}
