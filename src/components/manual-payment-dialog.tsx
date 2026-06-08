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
import { RefreshCcw, Zap } from 'lucide-react';
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

  const handleInitiateOnline = (amount: number) => {
    if (!item) return;
    
    // Store metadata for the online payment flow
    localStorage.setItem('paymentBill', JSON.stringify({ 
      type, 
      data: item,
      requestedAmount: amount 
    }));
    
    router.push(`/payment/${type}/${item.id}`);
    onOpenChange(false);
  };

  const onSubmit = (values: z.infer<typeof paymentSchema>) => {
    if (!item || !user) return;

    // REDIRECT TO PAYSTACK for online methods
    if (values.method === 'Mobile Money' || values.method === 'Bank Transfer') {
        handleInitiateOnline(values.amount);
        return;
    }

    // Manual Cash Handling
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
    
    const amountField = type === 'property' ? 'Total Payment' : 'Payment';
    const currentPaid = parseNumeric(getPropertyValue(item, amountField));
    
    const updatedItem = { 
      ...item, 
      payments: updatedPayments,
      // Use a type-safe assignment if possible, or ensure item is typed as any for this operation
      [amountField]: currentPaid + values.amount 
    };

    if (type === 'property') updateProperty(updatedItem as Property);
    else if (type === 'bop') updateBop(updatedItem as Bop);
    else updateLicense(updatedItem as License);

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
                      <SelectItem value="Cash">Cash (Manual Recording)</SelectItem>
                      <SelectItem value="Mobile Money">Mobile Money (Paystack Checkout)</SelectItem>
                      <SelectItem value="Bank Transfer">Bank Transfer (Paystack Checkout)</SelectItem>
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

              {selectedMethod === 'Cash' ? (
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
                    <FormDescription>Physical receipt or manual reference number.</FormDescription>
                    <FormMessage />
                    </FormItem>
                )} />
              ) : (
                <div className="bg-primary/5 p-4 rounded-lg border border-primary/20 space-y-2 animate-in zoom-in-95">
                  <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase">
                    <Zap className="h-3 w-3 fill-current" />
                    Paystack Online Checkout
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Recording payment with <strong>{selectedMethod}</strong> will initiate a secure online transaction. You will be redirected to the payment gateway to complete the collection.
                  </p>
                </div>
              )}

              <DialogFooter className="pt-4 gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit" className={selectedMethod !== 'Cash' ? "bg-primary hover:bg-primary/90" : ""}>
                    {selectedMethod === 'Cash' ? 'Record Payment' : 'Initiate Secure Checkout'}
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
