'use client';

import { ConfigProvider, theme } from 'antd';
import StyledComponentsRegistry from '../lib/AntdRegistry';
import { SettingsProvider, useSettings } from '../context/SettingsContext';
import { AuthProvider } from '../context/AuthContext';
import { WebSocketProvider } from '../context/WebSocketContext';
import { useAuth } from '../context/AuthContext';

const ThemeWrapper = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    const { primaryColor, secondaryColor } = useSettings();

    // Use custom colors only if user is logged in
    // Login page gets default theme so User B doesn't see User A's colors
    const customTheme = user ? {
        colorPrimary: primaryColor,
        colorInfo: secondaryColor,
        colorLink: secondaryColor,
        colorBgBase: secondaryColor,
    } : {
        // Default colors for login/register pages
        colorPrimary: '#1890ff',
        colorBgBase: '#000000',
    };

    return (
        <ConfigProvider
            theme={{
                algorithm: theme.darkAlgorithm,
                token: customTheme,
            }}
        >
            {children}
        </ConfigProvider>
    );
};

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <StyledComponentsRegistry>
            <AuthProvider>
                <SettingsProvider>
                    <ThemeWrapper>
                        <WebSocketProvider>
                            {children}
                        </WebSocketProvider>
                    </ThemeWrapper>
                </SettingsProvider>
            </AuthProvider>
        </StyledComponentsRegistry>
    );
}
