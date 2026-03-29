'use client';

import React, { useState, useEffect } from 'react';
import { Typography, Button, Form, message, Upload, Avatar, Card, Divider } from 'antd';
import { UserOutlined, MailOutlined, LockOutlined, UploadOutlined } from '@ant-design/icons';
import { useAuth } from '../../../context/AuthContext';
import { apiFetch } from '../../../lib/api';
import { useForm } from 'react-hook-form';
import * as yup from 'yup';
import { yupResolver } from '@hookform/resolvers/yup';
import AuthFormItem from '../../../components/shared/AuthFormItem';

const { Title, Text } = Typography;

const profileSchema = yup.object().shape({
    fullName: yup.string().required('Please input your Full Name!'),
    email: yup.string().email('Invalid email').required('Please input your Email!'),
});

const passwordSchema = yup.object().shape({
    currentPassword: yup.string().required('Please input your current password!'),
    newPassword: yup.string().min(6, 'Password must be at least 6 characters').required('Please input your new password!'),
    confirmPassword: yup.string()
        .oneOf([yup.ref('newPassword')], 'Passwords do not match!')
        .required('Please confirm your new password!'),
});

export default function ProfilePage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [passwordLoading, setPasswordLoading] = useState(false);

    const { control: profileControl, handleSubmit: handleProfileSubmit, formState: { errors: profileErrors }, reset: resetProfile } = useForm({
        resolver: yupResolver(profileSchema),
        defaultValues: {
            fullName: user?.full_name || '',
            email: user?.email || '',
        }
    });

    const { control: passwordControl, handleSubmit: handlePasswordSubmit, formState: { errors: passwordErrors }, reset: resetPassword } = useForm({
        resolver: yupResolver(passwordSchema),
        defaultValues: {
            currentPassword: '',
            newPassword: '',
            confirmPassword: '',
        }
    });

    useEffect(() => {
        if (user) {
            resetProfile({
                fullName: user.full_name,
                email: user.email,
            });
        }
    }, [user, resetProfile]);

    const onProfileSubmit = async (values: any) => {
        setLoading(true);
        try {
            await apiFetch('/profile/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    full_name: values.fullName,
                    email: values.email,
                }),
            });
            message.success('Profile updated successfully!');
        } catch (err: unknown) {
            message.error(err instanceof Error ? err.message : 'Failed to update profile');
        } finally {
            setLoading(false);
        }
    };

    const onPasswordSubmit = async (values: any) => {
        setPasswordLoading(true);
        try {
            await apiFetch('/profile/profile/password', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    current_password: values.currentPassword,
                    new_password: values.newPassword,
                }),
            });
            message.success('Password changed successfully!');
            resetPassword({
                currentPassword: '',
                newPassword: '',
                confirmPassword: '',
            });
        } catch (err: unknown) {
            message.error(err instanceof Error ? err.message : 'Failed to change password');
        } finally {
            setPasswordLoading(false);
        }
    };

    const handleAvatarUpload = async (file: any) => {
        const formData = new FormData();
        formData.append('file', file);

        try {
            await apiFetch('/profile/profile/avatar', {
                method: 'POST',
                body: formData,
            });
            message.success('Avatar uploaded successfully!');
        } catch (err: unknown) {
            message.error(err instanceof Error ? err.message : 'Failed to upload avatar');
        }

        return false; // Prevent default upload behavior
    };

    return (
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '40px 20px' }}>
            <Title level={2} style={{ marginBottom: 32 }}>Profile Settings</Title>

            {/* Avatar Section */}
            <Card style={{ marginBottom: 24, borderRadius: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                    <Avatar size={80} icon={<UserOutlined />} />
                    <div>
                        <Title level={4} style={{ margin: 0 }}>{user?.full_name}</Title>
                        <Text type="secondary">{user?.email}</Text>
                        <div style={{ marginTop: 12 }}>
                            <Upload
                                beforeUpload={handleAvatarUpload}
                                showUploadList={false}
                                accept="image/*"
                            >
                                <Button icon={<UploadOutlined />}>Change Avatar</Button>
                            </Upload>
                        </div>
                    </div>
                </div>
            </Card>

            {/* Profile Information */}
            <Card title="Profile Information" style={{ marginBottom: 24, borderRadius: 12 }}>
                <form onSubmit={handleProfileSubmit(onProfileSubmit)}>
                    <AuthFormItem
                        name="fullName"
                        control={profileControl}
                        errors={profileErrors}
                        placeholder="Full Name"
                        prefix={<UserOutlined />}
                    />

                    <AuthFormItem
                        name="email"
                        control={profileControl}
                        errors={profileErrors}
                        placeholder="Email address"
                        prefix={<MailOutlined />}
                        type="email"
                    />

                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={loading}>
                            Update Profile
                        </Button>
                    </Form.Item>
                </form>
            </Card>

            {/* Change Password */}
            <Card title="Change Password" style={{ borderRadius: 12 }}>
                <form onSubmit={handlePasswordSubmit(onPasswordSubmit)}>
                    <AuthFormItem
                        name="currentPassword"
                        control={passwordControl}
                        errors={passwordErrors}
                        placeholder="Current Password"
                        prefix={<LockOutlined />}
                        type="password"
                    />

                    <AuthFormItem
                        name="newPassword"
                        control={passwordControl}
                        errors={passwordErrors}
                        placeholder="New Password"
                        prefix={<LockOutlined />}
                        type="password"
                    />

                    <AuthFormItem
                        name="confirmPassword"
                        control={passwordControl}
                        errors={passwordErrors}
                        placeholder="Confirm New Password"
                        prefix={<LockOutlined />}
                        type="password"
                    />

                    <Form.Item>
                        <Button type="primary" htmlType="submit" loading={passwordLoading}>
                            Change Password
                        </Button>
                    </Form.Item>
                </form>
            </Card>
        </div>
    );
}
