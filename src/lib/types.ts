
export type Payment = {
  id: string;
  amount: number;
  date: string;
  method: string;
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
  'Record Type'?: string; // Stored as "License", "BOP", or "License, BOP"
  'S/N'?: string;
  'Name of Hotel/Guest House'?: string;
  'Property Rate'?: number; // License Fee
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
  generatedAt: string; // ISO Date string
  year: number;
  totalAmountDue: number;
  created_at?: string;
  billType: 'property' | 'bop' | 'license';
};

export type PaymentBill = {
  type: 'property' | 'bop' | 'license';
  data: Property | Bop | License;
}

export type RevenueData = {
  month: string;
  revenue: number;
};

export type PaymentStatusData = {
  name: 'Paid' | 'Pending' | 'Overdue' | 'Unbilled';
  value: number;
  fill: string;
};

export type User = {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Data Entry' | 'Viewer';
  password?: string;
  photoURL?: string;
  created_at?: string;
};

export type RevenueByPropertyType = {
  name: string;
  revenue: number;
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
