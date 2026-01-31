'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { store, saveStore } from '@/lib/store';

interface UserContextType {
    users: User[];
    addUser: (user: Omit<User, 'id'>) => void;
    updateUser: (updatedUser: User) => void;
    deleteUser: (id: string) => void;
    loading: boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
    const { toast } = useToast();
    const [users, setUsersState] = useState<User[]>(store.users);
    const [loading, setLoading] = useState(false);

    const setAndPersistUsers = (newUsers: User[]) => {
        store.users = newUsers;
        setUsersState(newUsers);
        saveStore();
    };

    const addUser = (user: Omit<User, 'id'>) => {
        const newUser: User = {
            id: `user-${Date.now()}`,
            ...user
        };
        const updatedUsers = [...store.users, newUser];
        setAndPersistUsers(updatedUsers);
    };

    const updateUser = (updatedUser: User) => {
        const updatedUsers = store.users.map(u => u.id === updatedUser.id ? updatedUser : u);
        setAndPersistUsers(updatedUsers);
    };

    const deleteUser = (id: string) => {
        const userToDelete = store.users.find(u => u.id === id);
        if (!userToDelete) return;
        
        if (userToDelete?.email === 'admin@rateease.gov') {
            toast({ variant: 'destructive', title: 'Delete Error', description: 'The default admin user cannot be deleted.' });
            return;
        }
        const updatedUsers = store.users.filter(u => u.id !== id);
        setAndPersistUsers(updatedUsers);
    };

    return (
        <UserContext.Provider value={{ users, addUser, updateUser, deleteUser, loading }}>
            {children}
        </UserContext.Provider>
    );
}

export function useUserData() {
    const context = useContext(UserContext);
    if (context === undefined) {
        throw new Error('useUserData must be used within a UserProvider');
    }
    return context;
}
