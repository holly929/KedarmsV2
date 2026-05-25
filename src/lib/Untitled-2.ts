// src/lib/types.ts

export interface PaymentStatusData {
  name: string;  // e.g., 'Paid', 'Pending', 'Overdue'
  value: number; // The count or amount for the chart
  fill?: string; // Optional color for the chart slice
}

// Ensure your existing exports (Property, RevenueByPropertyType, Bill) remain
