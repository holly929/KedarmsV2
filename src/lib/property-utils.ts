
import type { Property, License } from '@/lib/types';

const STANDARD_ALIASES: Record<string, string[]> = {
    'Owner Name': ['Owner Name', 'Name of Owner', 'Rate Payer', 'ownername', 'Full Name', 'Owner', 'Billed To', 'Entity', 'Name'],
    'Phone Number': ['Phone Number', 'Phone', 'Telephone', 'phonenumber', 'Phone No', 'Contact', 'Mobile', 'Cell'],
    'Town': ['Town', 'City', 'Location', 'Community', 'District'],
    'Suburb': ['Suburb', 'Area', 'Neighborhood', 'Section', 'Zone'],
    'Property No': ['Property No', 'Property Number', 'propertyno', 'House No', 'House Number', 'Address', 'ID No'],
    'Valuation List No.': ['Valuation List No.', 'Valuation List Number', 'valuationlistno', 'Valuation Number', 'Ref No', 'VLN'],
    'Account Number': ['Account Number', 'Acct No', 'accountnumber', 'Customer No', 'Ref'],
    'Property Type': ['Property Type', 'propertytype', 'Use', 'Category', 'Class'],
    'Rateable Value': ['Rateable Value', 'rateablevalue', 'Value', 'Assessed Value', 'Assessment'],
    'Rate Impost': ['Rate Impost', 'rateimpost', 'Impost', 'Rate', 'Multiplier'],
    'Sanitation Charged': ['Sanitation Charged', 'Sanitation', 'sanitationcharged', 'Sanitation Fee', 'Waste', 'Refuse'],
    'Previous Balance': ['Previous Balance', 'Prev Balance', 'Arrears', 'previousbalance', 'Arrears BF', 'Balance BF', 'Debt', 'Old Balance'],
    'Total Payment': ['Total Payment', 'Amount Paid', 'Payment', 'totalpayment', 'Paid', 'Total Paid', 'Amt Paid'],
    'S/N': ['S/N', 'SN', 'Serial Number', 'Serial No', 'Index', 'No.', 'Serial', 'Number'],
    'Name of Hotel/Guest House': ['Name of Hotel/Guest House', 'Hotel Name', 'Guest House Name', 'Hotel', 'Guest House', 'Business Name', 'Name', 'Establishment', 'Entity', 'Billed To', 'Company'],
    'Property Rate': ['Property Rate', 'License Fee', 'Rate', 'License', 'License Amount', 'Permit Fee', 'License Amt', 'Fee', 'Amount'],
    'License Fee': ['License Fee', 'Property Rate', 'Rate', 'License', 'License Amount', 'Permit Fee', 'License Amt', 'Fee'],
    'Bop Amount': ['Bop Amount', 'BOP', 'Bop Fee', 'BOP Amount', 'BOP Fee', 'Business Operating Permit'],
    'Arrears': ['Arrears', 'Previous Balance', 'Arrears BF', 'Prev Balance', 'Balance BF', 'Debt', 'Owed', 'Outstanding'],
    'Payment': ['Payment', 'Amount Paid', 'Paid', 'Total Payment', 'Amt Paid', 'Credit'],
    'Amount Due': ['Amount Due', 'Total Amount Due', 'Amount Owed', 'Total Due', 'Current Balance', 'Total Payable', 'Grand Total', 'Balance', 'Net Due', 'Total', 'Amount Payable', 'Payable'],
};

/**
 * Gets a property value using a standardized key, searching through common aliases.
 * This function is designed to be robust against variations in Excel column headers.
 */
export const getPropertyValue = (data: Property | License | null, standardKey: string): any => {
    if (!data) return undefined;

    // 1. Try direct access first (fastest)
    if (data[standardKey] !== undefined && data[standardKey] !== null && String(data[standardKey]).trim() !== '') {
        return data[standardKey];
    }

    const keyAliases = STANDARD_ALIASES[standardKey] || [standardKey];
    const dataKeys = Object.keys(data);

    const normalize = (str: string) => (str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    // 2. Try normalized exact match with aliases
    const normalizedAliases = keyAliases.map(normalize);
    for (const pKey of dataKeys) {
        const normalizedPKey = normalize(pKey);
        if (normalizedAliases.includes(normalizedPKey)) {
            const value = data[pKey];
            if (value !== undefined && value !== null && String(value).trim() !== '') {
                return value;
            }
        }
    }
    
    // 3. Try fuzzy substring matching
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

    return undefined;
};
