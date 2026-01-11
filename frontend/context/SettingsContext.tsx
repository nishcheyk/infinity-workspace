'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

interface SettingsContextType {
    voiceURI: string | null;
    setVoiceURI: (uri: string) => void;
    autoPlay: boolean;
    setAutoPlay: (auto: boolean) => void;
    primaryColor: string;
    setPrimaryColor: (color: string) => void;
    secondaryColor: string;
    setSecondaryColor: (color: string) => void;
    availableVoices: SpeechSynthesisVoice[];
}

const SettingsContext = createContext<SettingsContextType>({
    voiceURI: null,
    setVoiceURI: () => { },
    autoPlay: false,
    setAutoPlay: () => { },
    primaryColor: '#722ed1',
    setPrimaryColor: () => { },
    secondaryColor: '#1890ff',
    setSecondaryColor: () => { },
    availableVoices: [],
});

export const SettingsProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useAuth();
    const [voiceURI, setVoiceURI] = useState<string | null>(null);
    const [autoPlay, setAutoPlay] = useState(false);
    const [primaryColor, setPrimaryColor] = useState('#722ed1');
    const [secondaryColor, setSecondaryColor] = useState('#1890ff');
    const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    // Load settings from localStorage when user changes
    useEffect(() => {
        if (typeof window !== 'undefined' && user) {
            const prefix = `user_${user.id}_`;
            const savedVoice = localStorage.getItem(`${prefix}settings_voiceURI`);
            const savedAutoPlay = localStorage.getItem(`${prefix}settings_autoPlay`);
            const savedColor = localStorage.getItem(`${prefix}settings_primaryColor`);
            const savedSecondaryColor = localStorage.getItem(`${prefix}settings_secondaryColor`);

            setVoiceURI(savedVoice || null);
            setAutoPlay(savedAutoPlay === 'true');
            setPrimaryColor(savedColor || '#722ed1');
            setSecondaryColor(savedSecondaryColor || '#1890ff');
            setIsLoaded(true);
        } else if (!user) {
            // Reset to defaults if no user
            setVoiceURI(null);
            setAutoPlay(false);
            setPrimaryColor('#722ed1');
            setSecondaryColor('#1890ff');
            setIsLoaded(false);
        }
    }, [user]);

    // Save settings
    useEffect(() => {
        if (isLoaded && user) {
            const prefix = `user_${user.id}_`;
            if (voiceURI) localStorage.setItem(`${prefix}settings_voiceURI`, voiceURI);
            localStorage.setItem(`${prefix}settings_autoPlay`, String(autoPlay));
            localStorage.setItem(`${prefix}settings_primaryColor`, primaryColor);
            localStorage.setItem(`${prefix}settings_secondaryColor`, secondaryColor);
        }
    }, [voiceURI, autoPlay, primaryColor, secondaryColor, isLoaded, user]);

    useEffect(() => {
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            const updateVoices = () => {
                const voices = window.speechSynthesis.getVoices();
                // Deduplicate by voiceURI to prevent React key errors
                const uniqueVoices = voices.filter((v, index, self) =>
                    index === self.findIndex((t) => t.voiceURI === v.voiceURI)
                );
                setAvailableVoices(uniqueVoices);
                if (!voiceURI && uniqueVoices.length > 0 && isLoaded) {
                    const defaultVoice = uniqueVoices.find(v => v.lang === 'en-US') || uniqueVoices[0];
                    setVoiceURI(defaultVoice.voiceURI);
                }
            };

            window.speechSynthesis.onvoiceschanged = updateVoices;
            updateVoices();
        }
    }, [voiceURI, isLoaded]);

    return (
        <SettingsContext.Provider value={{
            voiceURI, setVoiceURI,
            autoPlay, setAutoPlay,
            primaryColor, setPrimaryColor,
            secondaryColor, setSecondaryColor,
            availableVoices
        }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => useContext(SettingsContext);
