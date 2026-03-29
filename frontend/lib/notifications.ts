import { notification } from 'antd';

/**
 * Show success notification
 */
export const showSuccess = (message: string, description?: string) => {
    notification.success({
        message,
        description,
        placement: 'topRight',
        duration: 3,
    });
};

/**
 * Show error notification
 */
export const showError = (message: string, description?: string) => {
    notification.error({
        message,
        description,
        placement: 'topRight',
        duration: 4,
    });
};

/**
 * Show info notification
 */
export const showInfo = (message: string, description?: string) => {
    notification.info({
        message,
        description,
        placement: 'topRight',
        duration: 3,
    });
};

/**
 * Show warning notification
 */
export const showWarning = (message: string, description?: string) => {
    notification.warning({
        message,
        description,
        placement: 'topRight',
        duration: 3,
    });
};
