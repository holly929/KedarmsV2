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
