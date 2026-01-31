

// This file acts as a centralized in-memory database for the application.
// All data contexts will read from and write to this single source of truth,
// ensuring that data is shared and consistent across all user sessions
// within the same server process.

import type { Property, Bop, Bill, User, Payment, ActivityLog } from './types';
import { PERMISSION_PAGES, type RolePermissions, type UserRole } from '@/context/PermissionsContext';

const STORE_KEY = 'rateease.store';

// --- Default Data ---

const defaultAdminUser: User = {
    id: 'user-0',
    name: 'Admin',
    email: 'admin@rateease.gov',
    role: 'Admin',
    password: 'password',
    photoURL: '',
};

const defaultPermissions: RolePermissions = {
  Admin: {
    dashboard: true, properties: true, billing: true, bop: true, 'bop-billing': true, bills: true, defaulters: true, reports: true,
    users: true, settings: true, 'integrations': true, payment: true, 'activity-logs': true, 'summary-bill': true,
  },
  'Data Entry': {
    dashboard: true, properties: true, billing: true, bop: true, 'bop-billing': true, bills: true, defaulters: true, reports: true,
    users: false, settings: false, 'integrations': true, payment: true, 'activity-logs': false, 'summary-bill': true,
  },
  Viewer: {
    dashboard: true, properties: false, billing: false, bop: false, 'bop-billing': false, bills: false, defaulters: false, reports: false,
    users: false, settings: false, 'integrations': false, payment: true, 'activity-logs': false, 'summary-bill': false,
  },
};


// --- Central Store ---

interface AppStore {
    properties: Property[];
    propertyHeaders: string[];
    bops: Bop[];
    bopHeaders: string[];
    summaryBillWorkbook: { [sheetName: string]: { data: Bop[], headers: string[] } };
    bills: Bill[];
    users: User[];
    permissions: RolePermissions;
    activityLogs: ActivityLog[];
    settings: { [key: string]: any };
}

function getDefaultStore(): AppStore {
    return {
        properties: [],
        propertyHeaders: ['Owner Name', 'Property No', 'Town', 'Rateable Value', 'Total Payment'],
        bops: [],
        bopHeaders: ['Business Name', 'Owner Name', 'Phone Number', 'Town', 'Permit Fee', 'Payment'],
        summaryBillWorkbook: {},
        bills: [],
        users: [defaultAdminUser],
        permissions: defaultPermissions,
        activityLogs: [],
        settings: {
            generalSettings: {
                systemName: 'RateEase',
                assemblyName: 'District Assembly',
                postalAddress: 'P.O. Box 1, District Capital',
                contactPhone: '012-345-6789',
                contactEmail: 'contact@assembly.gov.gh'
            },
            appearanceSettings: {},
            integrationsSettings: {},
            smsSettings: {
                enableSmsOnNewProperty: true,
                newPropertyMessageTemplate: "Dear {{Owner Name}}, your property ({{Property No}}) has been registered with the District Assembly. Thank you.",
                enableSmsOnBillGenerated: false,
                billGeneratedMessageTemplate: "Your bill of GHS {{Total Amount Due}} for property {{Property No}} for the year {{Year}} is ready. Please contact the assembly to arrange payment. Thank you.",
            },
            billDisplaySettings: {},
        },
    };
}

let store: AppStore;
let storeInitialized = false;

function loadStore(): AppStore {
    if (typeof window === 'undefined') {
        return getDefaultStore();
    }
    
    if (storeInitialized && store) {
        return store;
    }

    try {
        const stored = window.localStorage.getItem(STORE_KEY);
        if (stored) {
            const parsedStore = JSON.parse(stored);
            const defaultStore = getDefaultStore();
            // Deep merge to ensure all nested default settings are present if missing
            const mergedSettings = {
                ...defaultStore.settings,
                ...parsedStore.settings,
                smsSettings: { // ensure all sms settings are present
                    ...defaultStore.settings.smsSettings,
                    ...(parsedStore.settings?.smsSettings || {})
                }
            };
            parsedStore.settings = mergedSettings;
            
            store = { ...defaultStore, ...parsedStore };

            storeInitialized = true;
            return store;
        }
    } catch (e) {
        console.error("Failed to load store from localStorage", e);
    }

    storeInitialized = true;
    store = getDefaultStore();
    return store;
}

store = loadStore();


export function saveStore() {
    if (typeof window !== 'undefined') {
        try {
            window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
        } catch (e) {
            console.error("Failed to save store to localStorage", e);
        }
    }
}

// Re-export store to be used by contexts
export { store };
