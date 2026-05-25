export type Payment = {
  id: string;
  amount: number;
  date: string;
  method: string;
  reference?: string;
  recordedBy?: string;
};

export type Property = {
  id: string;
  'Property No'?: string;
  'Owner Name'?: string;
  'Phone Number'?: string;
  'Town'?: string;
  'Suburb'?: string;
  'Valuation List No.'?: string;
  'Account Number'?: string;
  'Property Type'?: 'Residential' | 'Commercial' | 'Industrial' | string;
  'Rateable Value'?: number;
  'Rate Impost'?: number;
  'Sanitation Charged'?: number;
  'Previous Balance'?: number;
  'Total Payment'?: number;
  created_at?: string;
  payments?: Payment[];
  [key: string]: any;
};

export type Bop = {
  id: string;
  'Business Name'?: string;
  'Owner Name'?: string;
  'Phone Number'?: string;
  'Town'?: string;
  'Permit Fee'?: number;
  'Arrears'?: number;
  'Payment'?: number;
  created_at?: string;
  payments?: Payment[];
  [key: string]: any;
}

export type License = {
  id: string;
  'Record Type'?: string;
  'S/N'?: string;
  'Name of Hotel/Guest House'?: string;
  'License Fee'?: number; 
  'Bop Amount'?: number;
  'Arrears'?: number;
  'Amount Due'?: number;
  'Payment'?: number;
  'Phone Number'?: string;
  created_at?: string;
  payments?: Payment[];
  [key: string]: any;
}

export type BillStatus = 'Paid' | 'Pending' | 'Overdue' | 'Unbilled';

export type PropertyWithStatus = Property & {
  status: BillStatus;
};

export type BopWithStatus = Bop & {
  status: BillStatus;
};

export type LicenseWithStatus = License & {
  status: BillStatus;
};

export type Bill = {
  id: string;
  propertyId: string;
  propertySnapshot: Property | Bop | License;
  generatedAt: string;
  year: number;
  totalAmountDue: number;
  created_at?: string;
  billType: 'property' | 'bop' | 'license';
};

export type PaymentBill = {
  type: 'property' | 'bop' | 'license';
  data: Property | Bop | License;
}

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Data Entry' | 'Viewer';
  password?: string;
  photoURL?: string;
  created_at?: string;
};

export const PERMISSION_PAGES = [
  'dashboard', 'properties', 'billing', 'bop', 'bop-billing', 'license', 'license-billing', 'bills', 'defaulters', 'reports', 'users', 'settings', 'integrations', 'payment', 'activity-logs', 'summary-bill', 'transactions', 'sms-logs'
] as const;

export type PermissionPage = typeof PERMISSION_PAGES[number];
export type UserRole = User['role'];
export type RolePermissions = Record<UserRole, Partial<Record<PermissionPage, boolean>>>;

export type SmsProvider = 'arkesel' | 'twilio' | 'sms_gh' | 'none';

export type SmsSettings = {
  provider: SmsProvider;
  apiKey?: string;
  apiSecret?: string;
  senderId?: string;
  twilioSid?: string;
  twilioToken?: string;
  twilioFrom?: string;
  enableSmsOnNewProperty: boolean;
  newPropertyMessageTemplate: string;
  enableSmsOnBillGenerated: boolean;
  billGeneratedMessageTemplate: string;
  enableSmsOnManualPayment: boolean;
  manualPaymentMessageTemplate: string;
};

export type SmsLog = {
  id: string;
  timestamp: string;
  recipientName: string;
  recipientPhone: string;
  message: string;
  status: 'Success' | 'Failed';
  error?: string;
  provider: string;
};

export type ActivityLog = {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userEmail: string;
  action: string;
  details?: string;
};

export type FlatTransaction = Payment & {
    sourceId: string;
    sourceName: string;
    sourceType: 'property' | 'bop' | 'license';
    identifier: string;
};

export interface PaymentStatusData {
  name: string;
  value: number;
  fill?: string;
}

export interface RevenueByPropertyType {
  name: string;
  revenue: number;
}
