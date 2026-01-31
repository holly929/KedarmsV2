
'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ActivityLog } from '@/lib/types';
import { store, saveStore } from '@/lib/store';
import { useAuth } from './AuthContext';

// Context for the data state
const ActivityLogStateContext = createContext<ActivityLog[] | undefined>(undefined);
// Context for the dispatch function
const ActivityLogDispatchContext = createContext<((action: string, details?: string) => void) | undefined>(undefined);

export function ActivityLogProvider({ children }: { children: React.ReactNode }) {
    const { user } = useAuth();
    const [activityLogs, setActivityLogsState] = useState<ActivityLog[]>(store.activityLogs);

    const addLog = useCallback((action: string, details?: string) => {
        if (!user) {
            console.warn("Attempted to add a log without a logged-in user.");
            return;
        }

        const newLog: ActivityLog = {
            id: `log-${Date.now()}-${Math.random()}`,
            timestamp: new Date().toISOString(),
            userId: user.id,
            userName: user.name,
            userEmail: user.email,
            action,
            details,
        };

        setActivityLogsState(prevLogs => {
            const updatedLogs = [newLog, ...prevLogs];
            store.activityLogs = updatedLogs;
            saveStore();
            return updatedLogs;
        });
    }, [user]);

    return (
        <ActivityLogStateContext.Provider value={activityLogs}>
            <ActivityLogDispatchContext.Provider value={addLog}>
                {children}
            </ActivityLogDispatchContext.Provider>
        </ActivityLogStateContext.Provider>
    );
}

// Hook for components that need to read the logs state
export function useActivityLogState() {
    const context = useContext(ActivityLogStateContext);
    if (context === undefined) {
        throw new Error('useActivityLogState must be used within an ActivityLogProvider');
    }
    return context;
}

// Hook for components that only need to dispatch a new log action
export function useActivityLogDispatch() {
    const context = useContext(ActivityLogDispatchContext);
    if (context === undefined) {
        throw new Error('useActivityLogDispatch must be used within an ActivityLogProvider');
    }
    return context;
}

// This hook remains for any component that might need both, but its usage is now limited.
export function useActivityLog() {
    const activityLogs = useActivityLogState();
    const addLog = useActivityLogDispatch();
    return { activityLogs, addLog };
}
