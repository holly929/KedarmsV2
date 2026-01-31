
'use client';

import React, { createContext, useContext, useState } from 'react';
import type { Property } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { sendNewPropertySms } from '@/lib/sms-service';
import { store, saveStore } from '@/lib/store';
import { useActivityLogDispatch } from './ActivityLogContext';

interface PropertyContextType {
    properties: Property[];
    headers: string[];
    setProperties: (properties: Property[], headers: string[]) => void;
    addProperty: (property: Omit<Property, 'id'>) => void;
    updateProperty: (updatedProperty: Property) => void;
    deleteProperty: (id: string) => void;
    deleteProperties: (ids: string[]) => void;
    deleteAllProperties: () => void;
}

const PropertyContext = createContext<PropertyContextType | undefined>(undefined);

export function PropertyProvider({ children }: { children: React.ReactNode }) {
    const { toast } = useToast();
    const addLog = useActivityLogDispatch();
    const [properties, setPropertiesState] = useState<Property[]>(store.properties);
    const [headers, setHeadersState] = useState<string[]>(store.propertyHeaders);
    
    const setAndPersistProperties = (newProperties: Property[], newHeaders: string[]) => {
        store.properties = newProperties;
        store.propertyHeaders = newHeaders;
        setPropertiesState(newProperties);
        setHeadersState(newHeaders);
        saveStore();
    };
    
    const addProperty = (property: Omit<Property, 'id'>) => {
        const newProperty: Property = {
            id: `prop-${Date.now()}`,
            ...property
        };
        const updatedProperties = [...store.properties, newProperty];
        setAndPersistProperties(updatedProperties, headers);
        addLog('Created Property', `Property No: ${newProperty['Property No']}`);
        sendNewPropertySms(newProperty);
    };

    const updateProperty = (updatedProperty: Property) => {
        const updatedProperties = store.properties.map(p => p.id === updatedProperty.id ? updatedProperty : p);
        setAndPersistProperties(updatedProperties, headers);
        addLog('Updated Property', `Property No: ${updatedProperty['Property No']}`);
    };

    const deleteProperty = (id: string) => {
        const propertyToDelete = store.properties.find(p => p.id === id);
        const updatedProperties = store.properties.filter(p => p.id !== id);
        setAndPersistProperties(updatedProperties, headers);
        if (propertyToDelete) {
             addLog('Deleted Property', `Property No: ${propertyToDelete['Property No']}`);
        }
    };
    
    const deleteProperties = (ids: string[]) => {
        const updatedProperties = store.properties.filter(p => !ids.includes(p.id));
        setAndPersistProperties(updatedProperties, headers);
        addLog('Deleted Multiple Properties', `${ids.length} properties deleted`);
    }
    
    const deleteAllProperties = () => {
        const count = store.properties.length;
        setAndPersistProperties([], []);
        addLog('Deleted All Properties', `${count} properties deleted`);
    };

    return (
        <PropertyContext.Provider value={{ properties, headers, setProperties: setAndPersistProperties, addProperty, updateProperty, deleteProperty, deleteProperties, deleteAllProperties }}>
            {children}
        </PropertyContext.Provider>
    );
}

export function usePropertyData() {
    const context = useContext(PropertyContext);
    if (context === undefined) {
        throw new Error('usePropertyData must be used within a PropertyProvider');
    }
    return context;
}
