import type { Property, Bill, Bop, License, Payment, SmsLog } from './types';
import { store, saveStore } from './store';
import { getPropertyValue } from './property-utils';
import { toast } from '@/hooks/use-toast';

function compileTemplate(template: string, data: Property | Bop | License | Bill, payment?: Payment): string {
    if (!template) return '';
    const compiled = template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, key) => {
        
        if (key === 'Amount Owed') {
            let amountOwed = 0;
            if ('billType' in data && 'propertySnapshot' in data) {
                amountOwed = data.totalAmountDue;
            } else {
                const p = data as any;
                const rv = Number(String(getPropertyValue(p, 'Rateable Value') || 0).replace(/,/g, '').replace(/[^0-9.-]/g, '')) || 0;
                const ri = Number(String(getPropertyValue(p, 'Rate Impost') || 0).replace(/,/g, '').replace(/[^0-9.-]/g, '')) || 0;
                const sc = Number(String(getPropertyValue(p, 'Sanitation Charged') || 0).replace(/,/g, '').replace(/[^0-9.-]/g, '')) || 0;
                const pb = Number(String(getPropertyValue(p, 'Previous Balance') || 0).replace(/,/g, '').replace(/[^0-9.-]/g, '')) || 0;
                const tp = Number(String(getPropertyValue(p, 'Total Payment') || getPropertyValue(p, 'Payment') || 0).replace(/,/g, '').replace(/[^0-9.-]/g, '')) || 0;
                
                const fee = Number(String(getPropertyValue(p, 'Permit Fee') || getPropertyValue(p, 'Property Rate') || getPropertyValue(p, 'License Fee') || 0).replace(/,/g, '').replace(/[^0-9.-]/g, '')) || 0;
                const bop = Number(String(getPropertyValue(p, 'Bop Amount') || 0).replace(/,/g, '').replace(/[^0-9.-]/g, '')) || 0;
                const arr = Number(String(getPropertyValue(p, 'Arrears') || 0).replace(/,/g, '').replace(/[^0-9.-]/g, '')) || 0;

                const due = rv > 0 ? (rv * ri) + sc + pb : fee + bop + arr;
                amountOwed = due > tp ? due - tp : 0;
            }
            return amountOwed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }

        if (key === 'Amount Paid' && payment) {
            return payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }

        if (key === 'Payment Date' && payment) {
            return new Date(payment.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        }

        if (key === 'Receipt No' && payment) {
            return payment.reference || payment.id;
        }

        if (key === 'Date') {
            return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
        }

        if (key === 'Year') {
            return new Date().getFullYear().toString();
        }

        if (key === 'Assembly Name') {
            return store.settings.generalSettings?.assemblyName || 'The District Assembly';
        }
        
        let value: any;
        if ('propertySnapshot' in data) {
            const bill = data as Bill;
            if (Object.prototype.hasOwnProperty.call(bill, key)) {
                value = (bill as any)[key];
            } else {
                value = getPropertyValue(bill.propertySnapshot, key);
            }
        } else {
            value = getPropertyValue(data as any, key);
        }
        
        if (value !== undefined && value !== null) {
            const strVal = String(value).trim();
            // List of keys that should NEVER be formatted as currency (Identification fields)
            const idKeys = ['name', 'no', 'sn', 'phone', 'account', 'town', 'suburb', 'type', 'hotel', 'business', 'establishment', 'entity', 'owner'];
            const isIdKey = idKeys.some(k => key.toLowerCase().includes(k));

            if (!isIdKey) {
                // Robust numeric check: only format if the string purely represents a number
                const numericPattern = /^-?[\d,]+(\.\d+)?$/;
                if (numericPattern.test(strVal)) {
                    const num = Number(strVal.replace(/,/g, ''));
                    if (!isNaN(num)) {
                         // Skip currency formatting for Rate Impost as it's a small multiplier
                         if (key.toLowerCase().includes('impost')) return strVal;
                         return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    }
                }
            }
        }
        
        return value !== null && value !== undefined ? String(value) : '';
    });
    return compiled;
}

async function sendSingleSms(phoneNumber: string, message: string, recipientName: string = 'Unknown'): Promise<{ success: boolean; error?: string; hint?: string }> {
    const config = store.settings.smsSettings;
    if (!config || config.provider === 'none') {
        return { success: false, error: 'SMS Provider not configured in Settings.' };
    }

    let success = false;
    let errorMsg = '';
    let hintMsg = '';

    try {
        const response = await fetch('/api/sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                phoneNumber, 
                message,
                config 
            }),
        });

        const result = await response.json().catch(() => ({ 
            error: 'Server returned a malformed response.',
            hint: 'The local API route failed. This usually indicates a server-side network restriction.'
        }));

        if (response.ok && result.success === true) {
            success = true;
        } else {
            errorMsg = result.error || 'The SMS gateway rejected the request.';
            hintMsg = result.hint;
        }
    } catch (error: any) {
        errorMsg = `Network Connection Error: ${error.message || 'fetch failed'}`;
        hintMsg = 'The browser could not communicate with the application server route.';
    }

    // RECORD LOG
    const log: SmsLog = {
        id: `sms-${Date.now()}-${Math.random()}`,
        timestamp: new Date().toISOString(),
        recipientName,
        recipientPhone: phoneNumber,
        message,
        status: success ? 'Success' : 'Failed',
        error: errorMsg,
        provider: config.provider
    };
    
    store.smsLogs = [log, ...(store.smsLogs || [])];
    saveStore();

    return { success, error: errorMsg, hint: hintMsg };
}

export async function testSmsConnection(): Promise<{ success: boolean; message?: string; details?: any[]; error?: string; hint?: string }> {
    const config = store.settings.smsSettings;
    try {
        const response = await fetch('/api/sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber: 'DIAGNOSTIC_TEST', config }),
        });
        return await response.json();
    } catch (e: any) {
        return { success: false, error: e.message, hint: 'Failed to even contact the local API route.' };
    }
}

export async function sendSms(items: (Property | Bop | License)[], messageTemplate: string): Promise<{ propertyId: string; success: boolean; error?: string; hint?: string }[]> {
    const smsPromises = items.map(async (item) => {
        const phoneNumber = getPropertyValue(item as any, 'Phone Number');
        const name = getPropertyValue(item as any, 'Owner Name') || getPropertyValue(item as any, 'Business Name') || getPropertyValue(item as any, 'Name of Hotel/Guest House') || 'Unknown';
        
        if (phoneNumber && String(phoneNumber).trim()) {
            const message = compileTemplate(messageTemplate, item);
            const result = await sendSingleSms(String(phoneNumber), message, String(name));
            return { propertyId: item.id, ...result };
        } else {
            return { propertyId: item.id, success: false, error: 'No phone number' };
        }
    });

    const results = await Promise.all(smsPromises);
    return results;
}

export async function sendNewPropertySms(property: Property | Bop | License) {
    const config = store.settings.smsSettings || {};
    const { enableSmsOnNewProperty, newPropertyMessageTemplate } = config;

    if (!enableSmsOnNewProperty || !newPropertyMessageTemplate) return;

    const phoneNumber = getPropertyValue(property as any, 'Phone Number');
    const name = getPropertyValue(property as any, 'Owner Name') || getPropertyValue(property as any, 'Business Name') || getPropertyValue(property as any, 'Name of Hotel/Guest House') || 'Unknown';
    
    if (!phoneNumber || !String(phoneNumber).trim()) return;

    const message = compileTemplate(newPropertyMessageTemplate, property);
    const result = await sendSingleSms(String(phoneNumber), message, String(name));
    
    if(result.success) {
        toast({ title: 'SMS Sent', description: `Registration notification sent to ${phoneNumber}.` });
    } else {
        toast({ variant: 'destructive', title: 'SMS Failed', description: `Could not notify owner: ${result.error}` });
    }
}

export async function sendBillGeneratedSms(bills: Bill[]) {
    const config = store.settings.smsSettings || {};
    const { enableSmsOnBillGenerated, billGeneratedMessageTemplate } = config;

    if (!enableSmsOnBillGenerated || !billGeneratedMessageTemplate) return;

    const results = await Promise.all(bills.map(bill => {
        const phoneNumber = getPropertyValue(bill.propertySnapshot, 'Phone Number');
        const name = getPropertyValue(bill.propertySnapshot, 'Owner Name') || getPropertyValue(bill.propertySnapshot, 'Business Name') || getPropertyValue(bill.propertySnapshot, 'Name of Hotel/Guest House') || 'Unknown';
        
        if (phoneNumber && String(phoneNumber).trim()) {
            const message = compileTemplate(billGeneratedMessageTemplate, bill);
            return sendSingleSms(String(phoneNumber), message, String(name));
        }
        return Promise.resolve({ success: false, error: 'No phone number' });
    }));
    
    const sentCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success && r.error !== 'No phone number').length;

    if (sentCount > 0) {
        toast({ title: 'Notifications Sent', description: `${sentCount} SMS messages dispatched.` });
    }
    if (failCount > 0) {
        toast({ variant: 'destructive', title: 'Batch Errors', description: `${failCount} messages failed. Check SMS settings.` });
    }
}

export async function sendManualPaymentSms(item: Property | Bop | License, payment: Payment) {
    const config = store.settings.smsSettings || {};
    const { enableSmsOnManualPayment, manualPaymentMessageTemplate } = config;

    if (!enableSmsOnManualPayment || !manualPaymentMessageTemplate) return;

    const phoneNumber = getPropertyValue(item as any, 'Phone Number');
    const name = getPropertyValue(item as any, 'Owner Name') || getPropertyValue(item as any, 'Business Name') || getPropertyValue(item as any, 'Name of Hotel/Guest House') || 'Unknown';
    
    if (!phoneNumber || !String(phoneNumber).trim()) return;

    const message = compileTemplate(manualPaymentMessageTemplate, item, payment);
    const result = await sendSingleSms(String(phoneNumber), message, String(name));
    
    if(result.success) {
        toast({ title: 'Payment SMS Sent', description: `Confirmation sent to ${phoneNumber}.` });
    } else {
        toast({ variant: 'destructive', title: 'SMS Failed', description: `Confirmation failed: ${result.error}` });
    }
}
