import type { Property, Bill, Bop, License, Payment } from './types';
import { store } from './store';
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
            const num = Number(String(value).replace(/,/g, '').replace(/[^0-9.-]/g, ''));
            if (!isNaN(num) && !['Property No', 'Account Number', 'Phone', 'S/N', 'SN'].some(k => key.includes(k))) {
                if (key.toLowerCase().includes('impost')) return String(value);
                return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            }
        }
        
        return value !== null && value !== undefined ? String(value) : '';
    });
    return compiled;
}

async function sendSingleSms(phoneNumber: string, message: string): Promise<{ success: boolean; error?: string }> {
    const config = store.settings.smsSettings;
    if (!config || config.provider === 'none') {
        return { success: false, error: 'SMS Provider not configured in Settings.' };
    }

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

        const result = await response.json();
        if (response.ok && result.success === true) {
            return { success: true };
        } else {
            // Return actual error message from backend route
            return { success: false, error: result.error || 'Provider rejected the request.' };
        }
    } catch (error: any) {
        // This is usually a client-side network error or browser block
        return { success: false, error: `Connection Error: ${error.message || 'Check your internet'}` };
    }
}

export async function sendSms(items: (Property | Bop | License)[], messageTemplate: string): Promise<{ propertyId: string; success: boolean; error?: string }[]> {
    const smsPromises = items.map(async (item) => {
        const phoneNumber = getPropertyValue(item as any, 'Phone Number');
        if (phoneNumber && String(phoneNumber).trim()) {
            const message = compileTemplate(messageTemplate, item);
            const result = await sendSingleSms(String(phoneNumber), message);
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
    if (!phoneNumber || !String(phoneNumber).trim()) return;

    const message = compileTemplate(newPropertyMessageTemplate, property);
    const result = await sendSingleSms(String(phoneNumber), message);
    
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
        if (phoneNumber && String(phoneNumber).trim()) {
            const message = compileTemplate(billGeneratedMessageTemplate, bill);
            return sendSingleSms(String(phoneNumber), message);
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
    if (!phoneNumber || !String(phoneNumber).trim()) return;

    const message = compileTemplate(manualPaymentMessageTemplate, item, payment);
    const result = await sendSingleSms(String(phoneNumber), message);
    
    if(result.success) {
        toast({ title: 'Payment SMS Sent', description: `Confirmation sent to ${phoneNumber}.` });
    } else {
        toast({ variant: 'destructive', title: 'SMS Failed', description: `Confirmation failed: ${result.error}` });
    }
}
