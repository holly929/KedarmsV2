
import type { Property, License } from '@/lib/types';

const STANDARD_ALIASES: Record<string, string[]> = {
    'Owner Name': ['Owner Name', 'Name of Owner', 'Rate Payer', 'ownername', 'Full Name'],
    'Phone Number': ['Phone Number', 'Phone', 'Telephone', 'phonenumber', 'Phone No', 'Contact'],
    'Town': ['Town', 'City', 'Location'],
    'Suburb': ['Suburb', 'Area', 'Neighborhood'],
    'Property No': ['Property No', 'Property Number', 'propertyno', 'House No', 'House Number'],
    'Valuation List No.': ['Valuation List No.', 'Valuation List Number', 'valuationlistno', 'Valuation Number', 'Ref No'],
    'Account Number': ['Account Number', 'Acct No', 'accountnumber', 'Customer No'],
    'Property Type': ['Property Type', 'propertytype', 'Use'],
    'Rateable Value': ['Rateable Value', 'rateablevalue', 'Value'],
    'Rate Impost': ['Rate Impost', 'rateimpost', 'Impost'],
    'Sanitation Charged': ['Sanitation Charged', 'Sanitation', 'sanitationcharged', 'Sanitation Fee'],
    'Previous Balance': ['Previous Balance', 'Prev Balance', 'Arrears', 'previousbalance', 'Arrears BF', 'Balance BF'],
    'Total Payment': ['Total Payment', 'Amount Paid', 'Payment', 'totalpayment', 'Paid'],
    'S/N': ['S/N', 'SN', 'Serial Number', 'Serial No', 'Index'],
    'Name of Hotel/Guest House': ['Name of Hotel/Guest House', 'Hotel Name', 'Guest House Name', 'Business Name', 'Name', 'Establishment'],
    'License Fee': ['License Fee', 'Property Rate', 'Rate', 'License', 'License Amount', 'Permit Fee'],
    'Bop Amount': ['Bop Amount', 'BOP', 'Bop Fee', 'BOP Amount', 'BOP Fee'],
    'Arrears': ['Arrears', 'Previous Balance', 'Arrears BF', 'Prev Balance', 'Balance BF', 'Debt'],
    'Payment': ['Payment', 'Amount Paid', 'Paid', 'Total Payment'],
    'Amount Due': ['Amount Due', 'Total Amount Due', 'Amount Owed', 'Total Due', 'Current Balance', 'Total Payable', 'Grand Total'],
};

/**
 * Gets a property value using a standardized key, searching through common aliases.
 * This function is designed to be robust against variations in Excel column headers.
 * @param data The property or license object to search within.
 * @param standardKey The standardized key for the value to retrieve (e.g., 'Owner Name').
 * @returns The found value, or undefined if not found.
 */
export const getPropertyValue = (data: Property | License | null, standardKey: string): any => {
    if (!data) return undefined;

    const keyAliases = STANDARD_ALIASES[standardKey] || [standardKey];
    const dataKeys = Object.keys(data);

    const normalize = (str: string) => (str || '').toLowerCase().replace(/[\s._-]/g, '');
    const tokenize = (str: string): string[] => (str || '').toLowerCase().match(/\w+/g) || [];

    // --- Pass 1: Exact normalized match ---
    for (const alias of keyAliases) {
        const normalizedAlias = normalize(alias);
        for (const pKey of dataKeys) {
            if (normalize(pKey) === normalizedAlias) {
                const value = data[pKey];
                if (value !== undefined && value !== null && String(value).trim() !== '') {
                    return value;
                }
            }
        }
    }
    
    // --- Pass 2: Substring inclusion on normalized keys ---
    for (const alias of keyAliases) {
        const normalizedAlias = normalize(alias);
        if (normalizedAlias.length < 3) continue;

        for (const pKey of dataKeys) {
            const normalizedPKey = normalize(pKey);
            if (['id', 'status'].includes(normalizedPKey)) continue;

            if (normalizedPKey.includes(normalizedAlias) || normalizedAlias.includes(normalizedPKey)) {
                const value = data[pKey];
                if (value !== undefined && value !== null && String(value).trim() !== '') {
                    return value;
                }
            }
        }
    }

    // --- Pass 3: Token-based matching ---
    for (const alias of keyAliases) {
        const aliasTokens = tokenize(alias);
        if (aliasTokens.length === 0) continue;

        for (const pKey of dataKeys) {
            if (['id', 'status'].includes(normalize(pKey))) continue;
            
            const pKeyTokens = tokenize(pKey);
            if (pKeyTokens.length === 0) continue;
            
            const allTokensFound = aliasTokens.every(aliasToken => (pKeyTokens as string[]).includes(aliasToken));

            if (allTokensFound) {
                 const value = data[pKey];
                if (value !== undefined && value !== null && String(value).trim() !== '') {
                    return value;
                }
            }
        }
    }

    // Fallback for keys that might not be in the alias list but exist on the object
    const directValue = data[standardKey];
    if (directValue !== undefined && directValue !== null && String(directValue).trim() !== '') {
      return directValue;
    }

    return undefined;
};
