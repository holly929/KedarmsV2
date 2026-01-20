
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Bop as SummaryBillData } from '@/lib/types'; // Re-using Bop as it is a flexible key-value store
import { store, saveStore } from '@/lib/store';
import { useActivityLog } from './ActivityLogContext';

interface SummaryBillContextType {
    summaryBillData: SummaryBillData[];
    headers: string[];
    setSummaryBillData: (data: SummaryBillData[], headers: string[]) => void;
    deleteAllSummaryBills: () => void;
}

const SummaryBillContext = createContext<SummaryBillContextType | undefined>(undefined);

export function SummaryBillProvider({ children }: { children: React.ReactNode }) {
    const { addLog } = useActivityLog();
    const [summaryBillData, setSummaryBillDataState] = useState<SummaryBillData[]>([]);
    const [headers, setHeadersState] = useState<string[]>([]);
    
    useEffect(() => {
        setSummaryBillDataState(store.summaryBills || []);
        setHeadersState(store.summaryBillHeaders || []);
    }, []);

    const setAndPersistData = (newData: SummaryBillData[], newHeaders: string[]) => {
        store.summaryBills = newData;
        store.summaryBillHeaders = newHeaders;
        setSummaryBillDataState(newData);
        setHeadersState(newHeaders);
        saveStore();
    };

    const deleteAllSummaryBills = () => {
        const count = store.summaryBills.length;
        setAndPersistData([], []);
        addLog('Cleared Summary Bills', `${count} records deleted`);
    };

    return (
        <SummaryBillContext.Provider value={{ summaryBillData, headers, setSummaryBillData: setAndPersistData, deleteAllSummaryBills }}>
            {children}
        </SummaryBillContext.Provider>
    );
}

export function useSummaryBillData() {
    const context = useContext(SummaryBillContext);
    if (context === undefined) {
        throw new Error('useSummaryBillData must be used within a SummaryBillProvider');
    }
    return context;
}
