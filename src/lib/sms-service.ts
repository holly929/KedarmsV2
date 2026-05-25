import type { Property, Bill, Bop } from './types';
import { store } from './store';
import { getPropertyValue } from './property-utils';
import { toast } from '@/hooks/use-toast';

function compileTemplate(template: string, data: Property | Bop | Bill): string {
    if (!template) return '';
    const compiled = template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, key) => {
        
        if (key === 'Amount Owed') {
            let amountOwed = 0;
            if ('billType' in data && 'propertySnapshot' in data) {
                amountOwed = data.totalAmountDue;
            } else if ('Property No' in data || getPropertyValue(data, 'Property No')) {
                const p = data as Property;
                const rv = Number(String(getPropertyValue(p, 'Rateable Value') || 0).replace(/,/g, '')) || 0;
                const ri = Number(String(getPropertyValue(p, 'Rate Impost') || 0).replace(/,/g, '')) || 0;
                const sc = Number(String(getPropertyValue(p, 'Sanitation Charged') || 0).replace(/,/g, '')) || 0;
                const pb = Number(String(getPropertyValue(p, 'Previous Balance') || 0).replace(/,/g, '')) || 0;
                const tp = Number(String(getPropertyValue(p, 'Total Payment') || 0).replace(/,/g, '')) || 0;
                const due = (rv * ri) + sc + pb;
                amountOwed = due > tp ? due - tp : 0;
            } else {
                const fee = Number(String(getPropertyValue(data as any, 'Permit Fee') || getPropertyValue(data as any, 'License Fee') || 0).replace(/,/g, '')) || 0;
                const arr = Number(String(getPropertyValue(data as any, 'Arrears') || 0).replace(/,/g, '')) || 0;
                const pay = Number(String(getPropertyValue(data as any, 'Payment') || 0).replace(/,/g, '')) || 0;
                amountOwed = (fee + arrears) - pay;
            }
            return amountOwed.toFixed(2);
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
            value = getPropertyValue(data as Property, key);
        }
        
        if (value !== undefined && value !== null) {
            const num = Number(String(value).replace(/,/g, ''));
            if (!isNaN(num) && !['Property No', 'Account Number', 'Phone', 'S/N'].some(k => key.includes(k))) {
                if (key.toLowerCase().includes('impost')) return String(value);
                return num.toFixed(2);
            }
        }
        
        return value !== null && value !== undefined ? String(value) : '';
    });
    return compiled;
}

async function sendSingleSms(phoneNumber: string, message: string): Promise<{ success: boolean; error?: string }> {
    const config = store.settings.smsSettings;
    if (!config || config.provider === 'none') {
        return { success: false, error: 'SMS Provider not configured.' };
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
            return { success: false, error: result.error || 'Provider error' };
        }
    } catch (error) {
        return { success: false, error: 'Network error' };
    }
}

export async function sendSms(items: (Property | Bop)[], messageTemplate: string): Promise<{ propertyId: string; success: boolean; error?: string }[]> {
    const smsPromises = items.map(async (item) => {
        const phoneNumber = getPropertyValue(item, 'Phone Number');
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

export async function sendNewPropertySms(property: Property | Bop) {
    const config = store.settings.smsSettings || {};
    const { enableSmsOnNewProperty, newPropertyMessageTemplate } = config;

    if (!enableSmsOnNewProperty || !newPropertyMessageTemplate) return;

    const phoneNumber = getPropertyValue(property, 'Phone Number');
    if (!phoneNumber || !String(phoneNumber).trim()) return;

    const message = compileTemplate(newPropertyMessageTemplate, property);
    const result = await sendSingleSms(String(phoneNumber), message);
    
    if(result.success) {
        toast({ title: 'SMS Sent', description: `Notification sent to ${phoneNumber}.` });
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
    if (sentCount > 0) {
        toast({ title: 'Notifications Sent', description: `${sentCount} SMS messages dispatched.` });
    }
}
