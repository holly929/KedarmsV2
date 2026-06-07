'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { usePropertyData } from '@/context/PropertyDataContext';
import { useBopData } from '@/context/BopDataContext';
import { useLicenseData } from '@/context/LicenseDataContext';
import { useAuth } from '@/context/AuthContext';
import { getPropertyValue } from '@/lib/property-utils';
import type { Payment, Property, Bop, License } from '@/lib/types';
import { ReceiptDialog } from './receipt-dialog';
import { sendManualPaymentSms } from '@/lib/sms-service';
import { RefreshCcw, CreditCard, Banknote, Landmark } from 'lucide-react';
import { store } from '@/lib/store';

const paymentSchema = z.object({
  amount: z.coerce.number().positive('Amount must be positive'),
  date: z.string().min(1, 'Date is required'),
  reference: z.string().min(1, 'Receipt/Ref number is required'),
  method: z.enum(['Cash', 'Mobile Money', 'Bank Transfer']).default('Cash'),
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
  const router = useRouter();
  const { updateProperty } = usePropertyData();
  const { updateBop } = useBopData();
  const { updateLicense } = useLicenseData();
  const [showReceipt, setShowReceipt] = React.useState(false);
  const [lastPayment, setLastPayment] = React.useState<Payment | null>(null);

  const generateReceiptNo = () => {
    const systemName = store.settings.generalSettings?.systemName || 'RE';
    const prefix = systemName.replace(/\s+/g, '').toUpperCase();
    const year = new Date().getFullYear();
    const random = Math.floor(100000 + Math.random() * 900000);
    return `${prefix}-${year}-${random}`;
  };

  const form = useForm<z.infer<typeof paymentSchema>>({
    resolver: zodResolver(paymentSchema),
    defaultValues: {
      amount: 0,
      date: new Date().toISOString().split('T')[0],
      reference: '',
      method: 'Cash',
    }
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({
        amount: 0,
        date: new Date().toISOString().split('T')[0],
        reference: generateReceiptNo(),
        method: 'Cash',
      });
    }
  }, [isOpen, form]);

  const handleInitiateOnline = () => {
    if (!item) return;
    const amount = form.getValues('amount');
    if (amount <= 0) {
      toast({ variant: 'destructive', title: 'Invalid Amount', description: 'Enter an amount before paying online.' });
      return;
    }
    
    localStorage.setItem('paymentBill', JSON.stringify({ type, data: item }));
    router.push(`/payment/${type}/${item.id}`);
    onOpenChange(false);
  };

  const onSubmit = (values: z.infer<typeof paymentSchema>) => {
    if (!item || !user) return;

    // AUTOMATIC PAYSTACK INITIATION for non-cash methods
    if (values.method === 'Mobile Money' || values.method === 'Bank Transfer') {
        handleInitiateOnline();
        return;
    }

    const newPayment: Payment = {
      id: `man-${Date.now()}`,
      amount: values.amount,
      date: values.date,
      method: values.method,
      reference: values.reference,
      recordedBy: user.name,
    };

    const existingPayments = item.payments || [];
    const updatedPayments = [...existingPayments, newPayment];
    
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
    toast({ title: 'Payment Recorded', description: `${values.method} payment of GHS ${values.amount.toFixed(2)} recorded.` });
    
    sendManualPaymentSms(updatedItem, newPayment);
    setShowReceipt(true);
  };

  const selectedMethod = form.watch('method');

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              Collect revenue for {getPropertyValue(item, 'Owner Name') || getPropertyValue(item, 'Business Name') || getPropertyValue(item, 'Name of Hotel/Guest House')}.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField control={form.control} name="method" render={({ field }) => (
                <FormItem>
                  <FormLabel>Payment Method</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Cash">Cash (Manual)</SelectItem>
                      <SelectItem value="Mobile Money">Mobile Money (MoMo Checkout)</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer (Checkout)</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="amount" render={({ field }) => (
                <FormItem>
                  <FormLabel>Amount to Pay (GHS)</FormLabel>
                  <FormControl>
                    <Input type="number" step="0.01" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              
              <FormField control={form.control} name="date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Transaction Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {selectedMethod === 'Cash' && (
                <FormField control={form.control} name="reference" render={({ field }) => (
                    <FormItem>
                    <FormLabel>Receipt / Transaction Ref</FormLabel>
                    <div className="flex gap-2">
                        <FormControl>
                        <Input placeholder="REF-XXXXXX" {...field} />
                        </FormControl>
                        <Button 
                        type="button" 
                        variant="outline" 
                        size="icon" 
                        onClick={() => form.setValue('reference', generateReceiptNo())}
                        >
                        <RefreshCcw className="h-4 w-4" />
                        </Button>
                    </div>
                    <FormDescription>Official receipt or network transaction ID.</FormDescription>
                    <FormMessage />
                    </FormItem>
                )} />
              )}

              {(selectedMethod === 'Mobile Money' || selectedMethod === 'Bank Transfer') && (
                <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 space-y-2">
                   <p className="text-xs font-semibold text-primary uppercase">Direct Checkout Enabled</p>
                   <p className="text-xs text-muted-foreground italic">Clicking &quot;Initiate Secure Payment&quot; below will open the Paystack portal automatically.</p>
                </div>
              )}

              <DialogFooter className="pt-4 gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit">
                    {selectedMethod === 'Cash' ? 'Record & Print Receipt' : 'Initiate Secure Payment'}
                </Button>
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
