
'use client';

import React, { createContext, useContext, useState } from 'react';
import { useToast } from '@/hooks/use-toast';
import type { User, PERMISSION_PAGES, PermissionPage, UserRole, RolePermissions } from '@/lib/types';
import { store, saveStore } from '@/lib/store';
import { PERMISSION_PAGES as PERMISSION_PAGES_LIST } from '@/lib/types';

interface PermissionsContextType {
  permissions: RolePermissions;
  updatePermissions: (newPermissions: RolePermissions) => void;
  hasPermission: (role: UserRole, page: string) => boolean;
}

const PermissionsContext = createContext<PermissionsContextType | undefined>(undefined);

export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { toast } = useToast();
  const [permissions, setPermissions] = useState<RolePermissions>(store.permissions);

  const updatePermissions = (newPermissions: RolePermissions) => {
    store.permissions = newPermissions;
    setPermissions(newPermissions);
    saveStore();
    toast({ title: 'Permissions Updated', description: 'User role permissions have been updated.' });
  };

  const hasPermission = (role: UserRole, pagePath: string): boolean => {
    if (role === 'Admin') return true;

    const page = pagePath.split('/')[1] as PermissionPage;
    if (!(PERMISSION_PAGES_LIST as unknown as string[]).includes(page)) {
        return true;
    }
    
    return store.permissions[role]?.[page] ?? false;
  };

  return (
    <PermissionsContext.Provider value={{ permissions, updatePermissions, hasPermission }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  const context = useContext(PermissionsContext);
  if (context === undefined) {
    throw new Error('usePermissions must be used within a PermissionsProvider');
  }
  return context;
}

export { PERMISSION_PAGES_LIST as PERMISSION_PAGES };
