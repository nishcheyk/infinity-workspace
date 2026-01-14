'use client';

import React, { useState } from 'react';
import { Input, Button, Typography, Alert, message, Form } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, RobotOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiFetch } from '../../lib/api';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import AuthFormItem from '../../components/ui/AuthFormItem';
const { Title, Text } = Typography;

const schema = yup.object().shape({
    fullName: yup.string().required('Please input your Full Name!'),
    email: yup.string().email('Invalid email').required('Please input your Email!'),
    password: yup.string().min(6, 'Password must be at least 6 characters').required('Please input your Password!'),
    confirm: yup.string()
        .oneOf([yup.ref('password')], 'Passwords do not match!')
        .required('Please confirm your password!'),
});

export default function SignupPage() {
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const { control, handleSubmit, formState: { errors } } = useForm({
        resolver: yupResolver(schema),
        defaultValues: {
            fullName: '',
            email: '',
            password: '',
            confirm: '',
        }
    });

    const onSubmit = async (values: any) => {
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
                        title={error}
                        type="error"
                        showIcon
                        style={{ marginBottom: 24, borderRadius: 12, background: 'rgba(255, 77, 79, 0.1)', border: '1px solid rgba(255, 77, 79, 0.2)', color: '#fff' }}
                    />
                )}

                <form onSubmit={handleSubmit(onSubmit)}>
                    <AuthFormItem
                        name="fullName"
                        control={control}
                        errors={errors}
                        placeholder="Full Name"
                        prefix={<UserOutlined />}
                    />

                    <AuthFormItem
                        name="email"
                        control={control}
                        errors={errors}
                        placeholder="Email address"
                        prefix={<MailOutlined />}
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

                    <AuthFormItem
                        name="confirm"
                        control={control}
                        errors={errors}
                        placeholder="Confirm Password"
                        prefix={<LockOutlined />}
                        type="password"
                    />

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
                </form>
            </div>
        </div>
    );
}
