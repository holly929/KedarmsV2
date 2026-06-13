import type { Property, Bop, License, Bill, User, Payment, ActivityLog, RolePermissions, SmsSettings, SmsLog } from './types';

const STORE_KEY = 'rateease.store';

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
    license: true, 'license-billing': true, transactions: true, 'sms-logs': true,
  },
  'Data Entry': {
    dashboard: true, properties: true, billing: true, bop: true, 'bop-billing': true, bills: true, defaulters: true, reports: true,
    users: false, settings: false, 'integrations': true, payment: true, 'activity-logs': false, 'summary-bill': true,
    license: true, 'license-billing': true, transactions: true, 'sms-logs': true,
  },
  Viewer: {
    dashboard: true, properties: false, billing: false, bop: false, 'bop-billing': false, bills: false, defaulters: false, reports: false,
    users: false, settings: false, 'integrations': false, payment: true, 'activity-logs': false, 'summary-bill': false,
    license: false, 'license-billing': false, transactions: true, 'sms-logs': false,
  },
};

interface AppStore {
    properties: Property[];
    propertyHeaders: string[];
    bops: Bop[];
    bopHeaders: string[];
    licenses: License[];
    licenseHeaders: string[];
    summaryBillWorkbook: { [sheetName: string]: { data: Bop[], headers: string[] } };
    bills: Bill[];
    users: User[];
    permissions: RolePermissions;
    activityLogs: ActivityLog[];
    smsLogs: SmsLog[];
    settings: { [key: string]: any };
}

function getDefaultStore(): AppStore {
    return {
        properties: [],
        propertyHeaders: [
            'S/N', 
            'Owner Name', 
            'Property No', 
            'Town', 
            'Suburb', 
            'Property Type', 
            'Rateable Value', 
            'Rate Impost', 
            'Basic Levy', 
            'Previous Balance', 
            'Total Payment', 
            'Amount Due'
        ],
        bops: [],
        bopHeaders: ['Business Name', 'Owner Name', 'Phone Number', 'Town', 'Permit Fee', 'Arrears', 'Payment'],
        licenses: [],
        licenseHeaders: ['Record Type', 'S/N', 'Name of Hotel/Guest House', 'Property Rate', 'Bop Amount', 'Arrears', 'Amount Due', 'Payment'],
        summaryBillWorkbook: {},
        bills: [],
        users: [defaultAdminUser],
        permissions: defaultPermissions,
        activityLogs: [],
        smsLogs: [],
        settings: {
            generalSettings: {
                systemName: 'RateEase',
                assemblyName: 'KWAHU EAST DISTRICT ASSEMBLY',
                postalAddress: 'P.O. Box 11, ABETIFI',
                contactPhone: '0242122039/0244971784',
                contactEmail: 'info@kwahueast.gov.gh'
            },
            appearanceSettings: {
                demandNoticeCaption: 'DEMAND NOTICE',
                billWarningText: 'PAY AT ONCE OR FACE LEGAL ACTION',
                fontFamily: 'sans',
                fontSize: 12,
                accentColor: '#F1F5F9',
            },
            integrationsSettings: {},
            paystackSettings: {
                publicKey: '',
                secretKey: '',
                isLive: false,
            },
            smsSettings: {
                provider: 'none',
                enableSmsOnNewProperty: true,
                newPropertyMessageTemplate: "Dear {{Owner Name}}, your property/license ({{Property No}}{{Name of Hotel/Guest House}}) has been registered with the District Assembly. Thank you.",
                enableSmsOnBillGenerated: true,
                billGeneratedMessageTemplate: "Your bill of GHS {{Amount Owed}} for {{Property No}}{{Name of Hotel/Guest House}} for the year {{Year}} is ready. Please contact the assembly to arrange payment. Thank you.",
                enableSmsOnManualPayment: true,
                manualPaymentMessageTemplate: "Dear {{Owner Name}}, we have received your payment of GHS {{Amount Paid}} on {{Payment Date}}. Your new balance is GHS {{Amount Owed}}. Receipt No: {{Receipt No}}. Thank you.",
            },
            billDisplaySettings: {
                showBasicLevy: true,
                showAnnualRate: true,
                showGrossTotal: true,
                showArrears: true,
                showTotalPayment: false,
                showNetPayable: true,
                customFields: []
            },
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
            const mergedSettings = {
                ...defaultStore.settings,
                ...parsedStore.settings,
                smsSettings: {
                    ...defaultStore.settings.smsSettings,
                    ...(parsedStore.settings?.smsSettings || {})
                },
                paystackSettings: {
                    ...defaultStore.settings.paystackSettings,
                    ...(parsedStore.settings?.paystackSettings || {})
                },
                billDisplaySettings: {
                    ...defaultStore.settings.billDisplaySettings,
                    ...(parsedStore.settings?.billDisplaySettings || {})
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

export function clearAllTransactionsInStore() {
    store.bills = [];
    store.properties = store.properties.map(p => ({ ...p, payments: [], 'Total Payment': 0 }));
    store.bops = store.bops.map(b => ({ ...b, payments: [], 'Payment': 0 }));
    store.licenses = store.licenses.map(l => ({ ...l, payments: [], 'Payment': 0 }));
    saveStore();
}

export function factoryResetStore() {
    const defaultStore = getDefaultStore();
    if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORE_KEY, JSON.stringify(defaultStore));
        window.localStorage.removeItem('rateease.user');
        window.location.reload();
    }
}

export { store };
