
'use client';

import React, { createContext, useContext, useState } from 'react';
import type { License } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { sendNewPropertySms } from '@/lib/sms-service';
import { store, saveStore } from '@/lib/store';
import { useActivityLogDispatch } from './ActivityLogContext';

interface LicenseContextType {
    licenseData: License[];
    headers: string[];
    setLicenseData: (data: License[], headers: string[]) => void;
    addLicense: (license: Omit<License, 'id'>) => void;
    updateLicense: (updatedLicense: License) => void;
    deleteLicense: (id: string) => void;
    deleteLicenses: (ids: string[]) => void;
    deleteAllLicense: () => void;
}

const LicenseContext = createContext<LicenseContextType | undefined>(undefined);

export function LicenseProvider({ children }: { children: React.ReactNode }) {
    const { toast } = useToast();
    const addLog = useActivityLogDispatch();
    const [licenseData, setLicenseDataState] = useState<License[]>(store.licenses);
    const [headers, setHeadersState] = useState<string[]>(store.licenseHeaders);
    
    const setAndPersistLicenseData = (newData: License[], newHeaders: string[]) => {
        store.licenses = newData;
        store.licenseHeaders = newHeaders;
        setLicenseDataState(newData);
        setHeadersState(newHeaders);
        saveStore();
    };
    
    const addLicense = (license: Omit<License, 'id'>) => {
        const newLicense: License = {
            id: `license-${Date.now()}`,
            ...license
        };
        const updatedLicenseData = [...store.licenses, newLicense];
        setAndPersistLicenseData(updatedLicenseData, headers);
        addLog('Created License Record', `Hotel: ${newLicense['Name of Hotel/Guest House']}`);
        sendNewPropertySms(newLicense);
    };

    const updateLicense = (updatedLicense: License) => {
        const updatedData = store.licenses.map(l => l.id === updatedLicense.id ? updatedLicense : l);
        setAndPersistLicenseData(updatedData, headers);
        addLog('Updated License Record', `Hotel: ${updatedLicense['Name of Hotel/Guest House']}`);
    };

    const deleteLicense = (id: string) => {
        const licenseToDelete = store.licenses.find(l => l.id === id);
        const updatedData = store.licenses.filter(l => l.id !== id);
        setAndPersistLicenseData(updatedData, headers);
        if (licenseToDelete) {
            addLog('Deleted License Record', `Hotel: ${licenseToDelete['Name of Hotel/Guest House']}`);
        }
    };
    
    const deleteLicenses = (ids: string[]) => {
        const updatedData = store.licenses.filter(l => !ids.includes(l.id));
        setAndPersistLicenseData(updatedData, headers);
        addLog('Deleted Multiple License Records', `${ids.length} records deleted`);
    }
    
    const deleteAllLicense = () => {
        const count = store.licenses.length;
        setAndPersistLicenseData([], []);
        addLog('Deleted All License Records', `${count} records deleted`);
    };

    return (
        <LicenseContext.Provider value={{ licenseData, headers, setLicenseData: setAndPersistLicenseData, addLicense, updateLicense, deleteLicense, deleteLicenses, deleteAllLicense }}>
            {children}
        </LicenseContext.Provider>
    );
}

export function useLicenseData() {
    const context = useContext(LicenseContext);
    if (context === undefined) {
        throw new Error('useLicenseData must be used within a LicenseProvider');
    }
    return context;
}
