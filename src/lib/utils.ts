import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Normalizes phone numbers to the 233XXXXXXXXX format required by Ghanaian gateways.
 * Handles local formats (024...), international (+233...), and common mistakes (233024...).
 */
export function normalizePhoneNumber(phone: string | number | null | undefined): string {
  if (!phone) return "";
  
  // Remove all non-digit characters
  let cleaned = String(phone).replace(/\D/g, "");
  
  // Case 1: 2330244... (User typed country code + local leading zero)
  if (cleaned.startsWith("2330")) {
    cleaned = "233" + cleaned.substring(4);
  } 
  // Case 2: 0244... (Standard local format)
  else if (cleaned.startsWith("0") && cleaned.length === 10) {
    cleaned = "233" + cleaned.substring(1);
  } 
  // Case 3: 244... (9 digit format without leading zero)
  else if (cleaned.length === 9) {
    cleaned = "233" + cleaned;
  }
  // Case 4: Already 12 digits (assume correct 23324...)
  
  return cleaned;
}

/**
 * Parses a value into a numeric format, handling GHS prefixes and other non-numeric characters.
 */
export const parseNumeric = (val: any): number => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  
  // Remove commas and currency prefixes like "GHS"
  const cleaned = String(val)
    .replace(/GHS/gi, '')
    .replace(/,/g, '')
    .trim();
  
  // Use regex to extract the first valid number (including decimals and negatives)
  const match = cleaned.match(/-?\d*\.?\d+/);
  if (match) {
    const num = parseFloat(match[0]);
    return isNaN(num) ? 0 : num;
  }
  
  return 0;
};

/**
 * Formats a value as a currency string with 2 decimal places.
 */
export const formatCurrency = (val: any): string => {
  return parseNumeric(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
