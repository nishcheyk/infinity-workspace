'use client';

import React from 'react';
import { Form, Input } from 'antd';
import { Controller } from 'react-hook-form';

interface AuthFormItemProps {
    name: string;
    control: any;
    errors: any;
    placeholder: string;
    prefix: React.ReactNode;
    type?: 'text' | 'password' | 'email';
}

export default function AuthFormItem({
    name,
    control,
    errors,
    placeholder,
    prefix,
    type = 'text'
}: AuthFormItemProps) {
    return (
        <Form.Item
            validateStatus={errors[name] ? 'error' : ''}
            help={errors[name]?.message}
            style={{ marginBottom: 24 }}
        >
            <Controller
                name={name}
                control={control}
                render={({ field }) => {
                    const InputComponent = type === 'password' ? Input.Password : Input;
                    return (
                        <InputComponent
                            {...field}
                            size="large"
                            prefix={React.isValidElement(prefix) ? React.cloneElement(prefix as React.ReactElement<any>, {
                                style: { color: 'rgba(255,255,255,0.4)' }
                            }) : prefix}
                            placeholder={placeholder}
                        />
                    );
                }}
            />
        </Form.Item>
    );
}
