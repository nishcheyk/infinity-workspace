'use client';

import React, { useState } from 'react';
import { Typography, Alert, Button, Form, message } from 'antd';
import { MailOutlined, RobotOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import AuthFormItem from '../../components/shared/AuthFormItem';
import { apiFetch } from '../../lib/api';

const { Title, Text } = Typography;

const schema = yup.object().shape({
    email: yup.string().email('Invalid email').required('Please input your Email!'),
});

export default function ForgotPasswordPage() {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [success, setSuccess] = useState(false);

    const { control, handleSubmit, formState: { errors } } = useForm({
        resolver: yupResolver(schema),
        defaultValues: {
            email: '',
        }
    });

    const onSubmit = async (values: any) => {
        setError('');
        setLoading(true);
        try {
            await apiFetch('/auth/forgot-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: values.email }),
            });
            setSuccess(true);
            message.success('Password reset link sent to your email!');
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to send reset link');
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
                        Reset Password
                    </Title>
                    <Text style={{ color: 'rgba(255,255,255,0.6)', display: 'block', textAlign: 'center', marginBottom: 32 }}>
                        Enter your email to receive a password reset link
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

                {success ? (
                    <div style={{ textAlign: 'center' }}>
                        <Alert
                            message="Check your email!"
                            description="If an account exists with that email, you'll receive a password reset link shortly."
                            type="success"
                            showIcon
                            style={{ marginBottom: 24, borderRadius: 12, background: 'rgba(82, 196, 26, 0.1)', border: '1px solid rgba(82, 196, 26, 0.2)', color: '#fff' }}
                        />
                        <Link href="/login">
                            <Button type="primary" block style={{ height: 48, fontSize: 16, fontWeight: 600 }}>
                                Return to Login
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit(onSubmit)}>
                        <AuthFormItem
                            name="email"
                            control={control}
                            errors={errors}
                            placeholder="Email address"
                            prefix={<MailOutlined />}
                            type="email"
                        />

                        <Form.Item style={{ marginBottom: 16 }}>
                            <Button type="primary" htmlType="submit" block loading={loading} style={{ height: 48, fontSize: 16, fontWeight: 600 }}>
                                Send Reset Link
                            </Button>
                        </Form.Item>

                        <div style={{ textAlign: 'center' }}>
                            <Text style={{ color: 'rgba(255,255,255,0.45)' }}>
                                Remember your password? <Link href="/login">Sign in</Link>
                            </Text>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
