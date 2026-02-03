

import type { Property, Bill, Bop } from './types';
import { store } from './store';
import { getPropertyValue } from './property-utils';
import { toast } from '@/hooks/use-toast';

function compileTemplate(template: string, data: Property | Bop | Bill): string {
    if (!template) return '';
    const compiled = template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (match, key) => {
        
        if (key === 'Amount Owed') {
            let amountOwed = 0;
            if ('billType' in data && 'propertySnapshot' in data) { // It's a Bill
                amountOwed = data.totalAmountDue;
            } else if ('Property No' in data || getPropertyValue(data, 'Property No')) { // It's a Property
                const p = data as Property;
                const rateableValue = Number(getPropertyValue(p, 'Rateable Value')) || 0;
                const rateImpost = Number(getPropertyValue(p, 'Rate Impost')) || 0;
                const sanitation = Number(getPropertyValue(p, 'Sanitation Charged')) || 0;
                const previousBalance = Number(getPropertyValue(p, 'Previous Balance')) || 0;
                const payment = Number(getPropertyValue(p, 'Total Payment')) || 0;
                const due = (rateableValue * rateImpost) + sanitation + previousBalance;
                amountOwed = due > payment ? due - payment : 0;
            } else { // It's a BOP
                const b = data as Bop;
                const permitFee = Number(getPropertyValue(b, 'Permit Fee')) || 0;
                const payment = Number(getPropertyValue(b, 'Payment')) || 0;
                amountOwed = permitFee > payment ? permitFee - payment : 0;
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
        if ('propertySnapshot' in data) { // It's a Bill object
            const bill = data as Bill;
            if (Object.prototype.hasOwnProperty.call(bill, key)) {
                value = (bill as any)[key];
            } else {
                value = getPropertyValue(bill.propertySnapshot, key);
            }
        } else { // It's a Property or Bop object
            value = getPropertyValue(data as Property, key);
        }
        
        if (typeof value === 'number' && ['totalAmountDue', 'Rateable Value', 'Total Payment', 'Permit Fee', 'Payment'].includes(key)) {
            return value.toFixed(2);
        }
        
        return value !== null && value !== undefined ? String(value) : '';
    });
    return compiled;
}


/**
 * Dispatches a request to the internal backend API to send an SMS.
 * @param phoneNumber The recipient's phone number.
 * @param message The message to send.
 * @returns A promise that resolves to an object with success status and optional error.
 */
async function sendSingleSms(phoneNumber: string, message: string): Promise<{ success: boolean; error?: string }> {
    if (!message) {
        const error = 'SMS message is empty. Cannot send.';
        console.error(error);
        return { success: false, error };
    }

    try {
        const response = await fetch('/api/sms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phoneNumber, message }),
        });

        const result = await response.json();

        if (response.ok && result.success === true) {
            console.log(`SMS dispatched via backend for ${phoneNumber}`);
            return { success: true };
        } else {
            const errorMessage = result.error || `An unknown error occurred (status: ${response.status}).`;
            console.error(`Backend SMS API error for ${phoneNumber}:`, errorMessage, result.details);
            return { success: false, error: errorMessage };
        }
    } catch (error) {
        const errorMessage = 'Could not connect to the SMS service.';
        console.error(`Failed to call internal SMS API for ${phoneNumber}:`, error);
        return { success: false, error: errorMessage };
    }
}


/**
 * Sends SMS to multiple properties with a custom message.
 * Used for bulk messaging.
 * @param items An array of properties or BOPs to send SMS to.
 * @param messageTemplate The custom message template.
 * @returns An array of results for each attempt.
 */
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

/**
 * Sends a notification when a new property is created.
 * Triggered from the PropertyDataContext.
 * @param property The newly created property.
 */
export async function sendNewPropertySms(property: Property | Bop) {
    const config = store.settings.smsSettings || {};
    const { enableSmsOnNewProperty, newPropertyMessageTemplate } = config;

    if (!enableSmsOnNewProperty || !newPropertyMessageTemplate) {
        return;
    }

    const phoneNumber = getPropertyValue(property, 'Phone Number');
    if (!phoneNumber || !String(phoneNumber).trim()) {
        console.log("Skipping new property SMS: No phone number found for property ID", property.id);
        return;
    }

    const message = compileTemplate(newPropertyMessageTemplate, property);
    const result = await sendSingleSms(String(phoneNumber), message);
    
    if(result.success) {
        toast({
            title: 'SMS Notification Sent',
            description: `A welcome message was sent to ${phoneNumber}.`,
        });
    } else {
        toast({
            variant: 'destructive',
            title: 'SMS Sending Failed',
            description: result.error || `Could not send SMS to ${phoneNumber}.`,
        });
        console.error(`Failed to send automated new property SMS to ${phoneNumber}.`);
    }
}

/**
 * Sends notifications when new bills are generated.
 * Triggered from the BillDataContext.
 * @param bills An array of newly created bills.
 */
export async function sendBillGeneratedSms(bills: Bill[]) {
    const config = store.settings.smsSettings || {};
    const { enableSmsOnBillGenerated, billGeneratedMessageTemplate } = config;

    if (!enableSmsOnBillGenerated || !billGeneratedMessageTemplate) {
        return;
    }

    const smsPromises = bills.map(bill => {
        const phoneNumber = getPropertyValue(bill.propertySnapshot, 'Phone Number');
        if (phoneNumber && String(phoneNumber).trim()) {
            const message = compileTemplate(billGeneratedMessageTemplate, bill);
            return sendSingleSms(String(phoneNumber), message);
        }
        return Promise.resolve({ success: false, error: 'No phone number' });
    });
    
    const results = await Promise.all(smsPromises);
    const sentCount = results.filter(r => r.success).length;
    const failedResults = results.filter(r => !r.success && r.error !== 'No phone number');

    if (sentCount > 0) {
        toast({
            title: 'Bill Notifications Sent',
            description: `Dispatched ${sentCount} SMS messages to property/business owners.`,
        });
    }

    if (failedResults.length > 0) {
        toast({
            variant: 'destructive',
            title: `${failedResults.length} SMS Notifications Failed`,
            description: `First error: ${failedResults[0].error}`,
        });
    }
}
