'use client';

import React, { useState } from 'react';
import { Form, Input, Button, Typography, Alert, message, Space } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, RobotOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';

const { Title, Text } = Typography;

export default function SignupPage() {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const onFinish = async (values: any) => {
        setError('');
        setLoading(true);
        try {
            await apiFetch('/auth/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: values.email,
                    password: values.password,
                    full_name: values.fullName
                }),
            });
            message.success('Intelligence profile created! Logging in...');
            router.push('/login');
        } catch (err: any) {
            setError(err.message || 'Signup failed');
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
                    <Title level={2} style={{ color: '#fff', textAlign: 'center', marginBottom: 8, fontWeight: 700 }}>Initialize Account</Title>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', display: 'block', textAlign: 'center', marginBottom: 32 }}>Create your private AI intelligence hub</Text>
                </div>

                {error && (
                    <Alert
                        message={error}
                        type="error"
                        showIcon
                        style={{ marginBottom: 24, borderRadius: 12, background: 'rgba(255, 77, 79, 0.1)', border: '1px solid rgba(255, 77, 79, 0.2)', color: '#fff' }}
                    />
                )}

                <Form
                    name="signup_form"
                    onFinish={onFinish}
                    size="large"
                    layout="vertical"
                >
                    <Form.Item
                        name="fullName"
                        rules={[{ required: true, message: 'Please input your Full Name!' }]}
                    >
                        <Input
                            prefix={<UserOutlined style={{ color: 'rgba(255,255,255,0.4)' }} />}
                            placeholder="Full Name"
                        />
                    </Form.Item>

                    <Form.Item
                        name="email"
                        rules={[{ required: true, message: 'Please input your Email!' }, { type: 'email', message: 'Invalid email' }]}
                    >
                        <Input
                            prefix={<MailOutlined style={{ color: 'rgba(255,255,255,0.4)' }} />}
                            placeholder="Email address"
                        />
                    </Form.Item>

                    <Form.Item
                        name="password"
                        rules={[{ required: true, message: 'Please input your Password!' }, { min: 6, message: 'Password must be at least 6 characters' }]}
                    >
                        <Input.Password
                            prefix={<LockOutlined style={{ color: 'rgba(255,255,255,0.4)' }} />}
                            placeholder="Password"
                        />
                    </Form.Item>

                    <Form.Item style={{ marginBottom: 16 }}>
                        <Button type="primary" htmlType="submit" block loading={loading} style={{ height: 48, fontSize: 16, fontWeight: 600 }}>
                            Initialize Profile
                        </Button>
                    </Form.Item>

                    <div style={{ textAlign: 'center' }}>
                        <Text style={{ color: 'rgba(255,255,255,0.45)' }}>
                            Already a member? <Link href="/login">Return to workspace</Link>
                        </Text>
                    </div>
                </Form>
            </div>
        </div>
    );
}
