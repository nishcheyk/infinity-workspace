import { Spin } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';

interface LoadingSpinnerProps {
    size?: 'small' | 'default' | 'large';
    tip?: string;
}

export default function LoadingSpinner({ size = 'default', tip }: LoadingSpinnerProps) {
    return (
        <div style={{ textAlign: 'center', padding: '50px 0' }}>
            <Spin
                indicator={<LoadingOutlined style={{ fontSize: size === 'large' ? 48 : size === 'small' ? 16 : 24 }} spin />}
                tip={tip}
                size={size}
            />
        </div>
    );
}
