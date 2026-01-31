
'use client';

import React, { createContext, useContext, useState } from 'react';
import type { Bop } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { sendNewPropertySms } from '@/lib/sms-service';
import { store, saveStore } from '@/lib/store';
import { useActivityLogDispatch } from './ActivityLogContext';

interface BopContextType {
    bopData: Bop[];
    headers: string[];
    setBopData: (data: Bop[], headers: string[]) => void;
    addBop: (bop: Omit<Bop, 'id'>) => void;
    updateBop: (updatedBop: Bop) => void;
    deleteBop: (id: string) => void;
    deleteBops: (ids: string[]) => void;
    deleteAllBop: () => void;
}

const BopContext = createContext<BopContextType | undefined>(undefined);

export function BopProvider({ children }: { children: React.ReactNode }) {
    const { toast } = useToast();
    const addLog = useActivityLogDispatch();
    const [bopData, setBopDataState] = useState<Bop[]>(store.bops);
    const [headers, setHeadersState] = useState<string[]>(store.bopHeaders);
    
    const setAndPersistBopData = (newData: Bop[], newHeaders: string[]) => {
        store.bops = newData;
        store.bopHeaders = newHeaders;
        setBopDataState(newData);
        setHeadersState(newHeaders);
        saveStore();
    };
    
    const addBop = (bop: Omit<Bop, 'id'>) => {
        const newBop: Bop = {
            id: `bop-${Date.now()}`,
            ...bop
        };
        const updatedBopData = [...store.bops, newBop];
        setAndPersistBopData(updatedBopData, headers);
        addLog('Created BOP Record', `Business Name: ${newBop['Business Name']}`);
        sendNewPropertySms(newBop);
    };

    const updateBop = (updatedBop: Bop) => {
        const updatedData = store.bops.map(b => b.id === updatedBop.id ? updatedBop : b);
        setAndPersistBopData(updatedData, headers);
        addLog('Updated BOP Record', `Business Name: ${updatedBop['Business Name']}`);
    };

    const deleteBop = (id: string) => {
        const bopToDelete = store.bops.find(b => b.id === id);
        const updatedData = store.bops.filter(b => b.id !== id);
        setAndPersistBopData(updatedData, headers);
        if (bopToDelete) {
            addLog('Deleted BOP Record', `Business Name: ${bopToDelete['Business Name']}`);
        }
    };
    
    const deleteBops = (ids: string[]) => {
        const updatedData = store.bops.filter(b => !ids.includes(b.id));
        setAndPersistBopData(updatedData, headers);
        addLog('Deleted Multiple BOP Records', `${ids.length} records deleted`);
    }
    
    const deleteAllBop = () => {
        const count = store.bops.length;
        setAndPersistBopData([], []);
        addLog('Deleted All BOP Records', `${count} records deleted`);
    };

    return (
        <BopContext.Provider value={{ bopData, headers, setBopData: setAndPersistBopData, addBop, updateBop, deleteBop, deleteBops, deleteAllBop }}>
            {children}
        </BopContext.Provider>
    );
}

export function useBopData() {
    const context = useContext(BopContext);
    if (context === undefined) {
        throw new Error('useBopData must be used within a BopProvider');
    }
    return context;
}
