
import type { Property, Bop, License } from '@/lib/types';
import { getPropertyValue } from './property-utils';

export type BillStatus = 'Paid' | 'Pending' | 'Overdue' | 'Unbilled';

export function getBillStatus(property: Property): BillStatus {
  const rateableValue = Number(getPropertyValue(property, 'Rateable Value')) || 0;
  const basicLevy = Number(getPropertyValue(property, 'Basic Levy')) || 0;
  const totalPayment = Number(getPropertyValue(property, 'Total Payment')) || 0;
  const importedAmountDue = getPropertyValue(property, 'Amount Due');

  const grandTotalDue = rateableValue + basicLevy;

  // If we have an imported Amount Due and no component values, trust the Amount Due
  if (importedAmountDue !== undefined && importedAmountDue !== null && grandTotalDue === 0) {
      const amountDue = Number(importedAmountDue);
      if (amountDue <= 0 && totalPayment > 0) return 'Paid';
      if (amountDue > 0 && totalPayment > 0) return 'Pending';
      if (amountDue > 0) return 'Overdue';
      return 'Unbilled';
  }

  if (grandTotalDue <= 0) {
    return 'Unbilled';
  } 
  
  if (totalPayment >= grandTotalDue) {
    return 'Paid';
  }

  if (totalPayment > 0) { // Implies totalPayment < grandTotalDue from previous check
    return 'Pending';
  }

  return 'Overdue'; // totalPayment <= 0 and grandTotalDue > 0
}

export function getBopBillStatus(bop: Bop): BillStatus {
  const permitFee = Number(getPropertyValue(bop, 'Permit Fee')) || 0;
  const arrears = Number(getPropertyValue(bop, 'Arrears')) || 0;
  const payment = Number(getPropertyValue(bop, 'Payment')) || 0;

  const totalDue = permitFee + arrears;

  if (totalDue <= 0) {
    return 'Unbilled';
  }

  if (payment >= totalDue) {
    return 'Paid';
  }

  if (payment > 0) {
    return 'Pending';
  }

  return 'Overdue';
}

export function getLicenseBillStatus(license: License): BillStatus {
  const licenseFee = Number(getPropertyValue(license, 'License Fee')) || 0;
  const bopAmt = Number(getPropertyValue(license, 'Bop Amount')) || 0;
  const arrears = Number(getPropertyValue(license, 'Arrears')) || 0;
  const payment = Number(getPropertyValue(license, 'Payment')) || 0;

  const totalAmountDue = licenseFee + bopAmt + arrears;

  if (totalAmountDue <= 0) {
    return 'Unbilled';
  }

  if (payment >= totalAmountDue) {
    return 'Paid';
  }

  if (payment > 0) {
    return 'Pending';
  }

  return 'Overdue';
}
