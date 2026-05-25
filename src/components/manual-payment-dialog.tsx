'use client';

import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { usePropertyData } from '@/context/PropertyDataContext';
import { useBopData } from '@/context/BopDataContext';
import { useLicenseData } from '@/context/LicenseDataContext';
import { useAuth } from '@/context/AuthContext';
import { getPropertyValue } from '@/lib/property-utils';
import type { Payment, Property, Bop, License } from '@/lib/types';
import { ReceiptDialog } from './receipt-dialog';
import { sendManualPaymentSms } from '@/lib/sms-service';

const paymentSchema = z.object({
  amount: z.coerce.number().positive('Amount must be positive'),
  date: z.string().min(1, 'Date is required'),
  reference: z.string().optional(),
});

interface ManualPaymentDialogProps {
  item: Property | Bop | License | null;
  type: 'property' | 'bop' | 'license';
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManualPaymentDialog({ item, type, isOpen, onOpenChange }: ManualPaymentDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { updateProperty } = usePropertyData();
  const { updateBop } = useBopData();
  const { updateLicense } = useLicenseData();
  const [showReceipt, setShowReceipt] = React.useState(false);
  const [lastPayment, setLastPayment] = React.useState<Payment | null>(null);

  const form = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      reference: '',
    }
  });

  const onSubmit = (values: z.infer<typeof paymentSchema>) => {
    if (!item || !user) return;

    const newPayment: Payment = {
      id: `man-${Date.now()}`,
      amount: values.amount,
      date: values.date,
      method: 'Cash/Manual',
      reference: values.reference,
      recordedBy: user.name,
    };

    const existingPayments = item.payments || [];
    const updatedPayments = [...existingPayments, newPayment];
    
    // Calculate new totals based on type
    let updatedItem: any = { ...item, payments: updatedPayments };
    if (type === 'property') {
        const currentPaid = Number(getPropertyValue(item, 'Total Payment') || 0);
        updatedItem['Total Payment'] = currentPaid + values.amount;
        updateProperty(updatedItem);
    } else if (type === 'bop') {
        const currentPaid = Number(getPropertyValue(item, 'Payment') || 0);
        updatedItem['Payment'] = currentPaid + values.amount;
        updateBop(updatedItem);
    } else {
        const currentPaid = Number(getPropertyValue(item, 'Payment') || 0);
        updatedItem['Payment'] = currentPaid + values.amount;
        updateLicense(updatedItem);
    }

    setLastPayment(newPayment);
    toast({ title: 'Payment Recorded', description: `GHS ${values.amount.toFixed(2)} added to records.` });
    
    // Trigger SMS notification
    sendManualPaymentSms(updatedItem, newPayment);
    
    setShowReceipt(true);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Manual Payment</DialogTitle>
            <DialogDescription>
              Enter payment details for {getPropertyValue(item, 'Owner Name') || getPropertyValue(item, 'Business Name') || getPropertyValue(item, 'Name of Hotel/Guest House')}.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem><FormLabel>Amount (GHS)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem><FormLabel>Date</FormLabel><FormControl><Input type="date" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <FormField control={form.control} name="reference" render={({ field }) => (
                <FormItem><FormLabel>Receipt/Ref Number</FormLabel><FormControl><Input placeholder="Optional" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit">Save Payment</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {lastPayment && (
          <ReceiptDialog 
            isOpen={showReceipt} 
            onOpenChange={(open) => { setShowReceipt(open); if(!open) onOpenChange(false); }}
            payment={lastPayment}
            item={item!}
          />
      )}
    </>
  );
}
