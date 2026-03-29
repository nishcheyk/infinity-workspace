import { Empty } from 'antd';
import { ReactNode } from 'react';

interface EmptyStateProps {
    description?: string;
    icon?: ReactNode;
    action?: ReactNode;
}

export default function EmptyState({ description = 'No data', icon, action }: EmptyStateProps) {
    return (
        <div style={{ textAlign: 'center', padding: '50px 20px' }}>
            <Empty
                image={icon || Empty.PRESENTED_IMAGE_SIMPLE}
                description={description}
            >
                {action}
            </Empty>
        </div>
    );
}
