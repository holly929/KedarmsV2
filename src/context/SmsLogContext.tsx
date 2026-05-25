'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { SmsLog } from '@/lib/types';
import { store, saveStore } from '@/lib/store';

const SmsLogContext = createContext<{
    smsLogs: SmsLog[];
    clearSmsLogs: () => void;
    refreshLogs: () => void;
} | undefined>(undefined);

export function SmsLogProvider({ children }: { children: React.ReactNode }) {
    const [smsLogs, setSmsLogs] = useState<SmsLog[]>(store.smsLogs || []);

    const clearSmsLogs = useCallback(() => {
        store.smsLogs = [];
        setSmsLogs([]);
        saveStore();
    }, []);

    const refreshLogs = useCallback(() => {
        setSmsLogs([...(store.smsLogs || [])]);
    }, []);

    return (
        <SmsLogContext.Provider value={{ smsLogs, clearSmsLogs, refreshLogs }}>
            {children}
        </SmsLogContext.Provider>
    );
}

export function useSmsLogs() {
    const context = useContext(SmsLogContext);
    if (context === undefined) {
        throw new Error('useSmsLogs must be used within an SmsLogProvider');
    }
    return context;
}
