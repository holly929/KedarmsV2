
'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePropertyData } from '@/context/PropertyDataContext';
import { useBopData } from '@/context/BopDataContext';
import type { Payment, Property, Bop } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogDispatch } from '@/context/ActivityLogContext';

const formatCurrency = (value: number) => `GHS ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function CallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const addLog = useActivityLogDispatch();

  const [status, setStatus] = useState<'processing' | 'success' | 'failed'>('processing');
  const [message, setMessage] = useState('Processing your payment...');

  const { updateProperty, properties } = usePropertyData();
  const { updateBop, bopData } = useBopData();

  useEffect(() => {
    const paymentStatus = searchParams.get('status');
    const reference = searchParams.get('reference');
    const billId = searchParams.get('billId');
    const amount = Number(searchParams.get('amount'));

    if (paymentStatus === 'success' && reference && billId && amount) {
      // In a real app, you would call your backend to verify the transaction with the reference
      // For this simulation, we'll just update the data directly
      
      const property = properties.find(p => p.id === billId);
      const bop = bopData.find(b => b.id === billId);

      if (property) {
        const newPayment: Payment = {
          id: reference,
          amount: amount,
          date: new Date().toISOString(),
          method: 'paystack',
        };
        const existingPayments = property.payments || [];
        const updatedPayments = [...existingPayments, newPayment];
        const totalPayment = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
        const updatedRecord = { ...property, payments: updatedPayments, 'Total Payment': totalPayment };
        updateProperty(updatedRecord);
        addLog('Payment Received', `GHS ${amount.toFixed(2)} for Property No: ${property['Property No']}`);
        
        setStatus('success');
        setMessage(`Payment of ${formatCurrency(amount)} for Property No: ${property['Property No']} was successful.`);
        toast({ title: 'Payment Successful', description: `Your payment of ${formatCurrency(amount)} has been recorded.` });

      } else if (bop) {
        const newPayment: Payment = {
          id: reference,
          amount: amount,
          date: new Date().toISOString(),
          method: 'paystack',
        };
        const existingPayments = bop.payments || [];
        const updatedPayments = [...existingPayments, newPayment];
        const totalPayment = updatedPayments.reduce((sum, p) => sum + p.amount, 0);
        const updatedRecord = { ...bop, payments: updatedPayments, 'Payment': totalPayment };
        updateBop(updatedRecord);
        addLog('Payment Received', `GHS ${amount.toFixed(2)} for Business: ${bop['Business Name']}`);

        setStatus('success');
        setMessage(`Payment of ${formatCurrency(amount)} for Business: ${bop['Business Name']} was successful.`);
        toast({ title: 'Payment Successful', description: `Your payment of ${formatCurrency(amount)} has been recorded.` });
      } else {
        setStatus('failed');
        setMessage('Payment verification failed. Bill not found.');
        toast({ variant: 'destructive', title: 'Payment Failed', description: 'Could not find the bill to update.' });
      }
    } else {
      setStatus('failed');
      setMessage('Payment failed or was cancelled.');
      toast({ variant: 'destructive', title: 'Payment Failed', description: 'The payment was not successful.' });
    }
  }, [searchParams, properties, bopData, updateProperty, updateBop, toast, addLog]);

  return (
    <div className="flex h-screen items-center justify-center">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          {status === 'processing' && <Loader2 className="mx-auto h-12 w-12 animate-spin text-muted-foreground" />}
          {status === 'success' && <CheckCircle className="mx-auto h-12 w-12 text-green-500" />}
          {status === 'failed' && <XCircle className="mx-auto h-12 w-12 text-destructive" />}
        </CardHeader>
        <CardContent>
          <h1 className="text-2xl font-bold mb-2 capitalize">{status}</h1>
          <p className="text-muted-foreground">{message}</p>
          <Button onClick={() => router.push('/bills')} className="mt-6">
            Go to Bills
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

const SuspenseFallback = () => (
  <div className="flex h-screen items-center justify-center">
    <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
  </div>
);

export default function PaymentCallbackPage() {
  return (
    <Suspense fallback={<SuspenseFallback />}>
      <CallbackClient />
    </Suspense>
  );
}
