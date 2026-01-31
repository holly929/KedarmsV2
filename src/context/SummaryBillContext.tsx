
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { Bop as SummaryBillData } from '@/lib/types'; // Re-using Bop as it is a flexible key-value store
import { store, saveStore } from '@/lib/store';
import { useActivityLogDispatch } from './ActivityLogContext';

interface SummaryBillContextType {
    workbook: { [sheetName: string]: { data: SummaryBillData[], headers: string[] } };
    setWorkbook: (workbook: { [sheetName: string]: { data: SummaryBillData[], headers: string[] } }) => void;
    deleteAllSummaryBills: () => void;
}

const SummaryBillContext = createContext<SummaryBillContextType | undefined>(undefined);

export function SummaryBillProvider({ children }: { children: React.ReactNode }) {
    const addLog = useActivityLogDispatch();
    const [workbook, setWorkbookState] = useState<{ [sheetName: string]: { data: SummaryBillData[], headers: string[] } }>(store.summaryBillWorkbook || {});
    
    const setAndPersistWorkbook = (newWorkbook: { [sheetName: string]: { data: SummaryBillData[], headers: string[] } }) => {
        store.summaryBillWorkbook = newWorkbook;
        setWorkbookState(newWorkbook);
        saveStore();
    };

    const deleteAllSummaryBills = () => {
        const count = Object.values(store.summaryBillWorkbook || {}).reduce((acc, sheet) => acc + sheet.data.length, 0);
        setAndPersistWorkbook({});
        if (count > 0) {
            addLog('Cleared Summary Bills', `${count} records deleted from all sheets`);
        }
    };

    return (
        <SummaryBillContext.Provider value={{ workbook, setWorkbook: setAndPersistWorkbook, deleteAllSummaryBills }}>
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
