'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle, XCircle, Printer } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePropertyData } from '@/context/PropertyDataContext';
import { useBopData } from '@/context/BopDataContext';
import { useLicenseData } from '@/context/LicenseDataContext';
import type { Payment, Property, Bop, License } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useActivityLogDispatch } from '@/context/ActivityLogContext';
import { ReceiptDialog } from '@/components/receipt-dialog';

const formatCurrency = (value: number) => `GHS ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function CallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const addLog = useActivityLogDispatch();

  const [status, setStatus] = useState<'processing' | 'success' | 'failed'>('processing');
  const [message, setMessage] = useState('Processing your payment...');
  const [lastPayment, setLastPayment] = useState<Payment | null>(null);
  const [targetItem, setTargetItem] = useState<Property | Bop | License | null>(null);
  const [showReceipt, setShowReceipt] = useState(false);

  const { updateProperty, properties } = usePropertyData();
  const { updateBop, bopData } = useBopData();
  const { updateLicense, licenseData } = useLicenseData();

  useEffect(() => {
    const paymentStatus = searchParams.get('status');
    const reference = searchParams.get('reference');
    const billId = searchParams.get('billId');
    const amount = Number(searchParams.get('amount'));

    if (paymentStatus === 'success' && reference && billId && amount) {
      const property = properties.find(p => p.id === billId);
      const bop = bopData.find(b => b.id === billId);
      const license = licenseData.find(l => l.id === billId);

      const newPayment: Payment = {
        id: reference,
        amount: amount,
        date: new Date().toISOString(),
        method: 'Paystack Online',
        reference: reference,
        recordedBy: 'System (Online)',
      };

      if (property) {
        const updatedRecord = { 
            ...property, 
            payments: [...(property.payments || []), newPayment],
            'Total Payment': (Number(property['Total Payment']) || 0) + amount 
        };
        updateProperty(updatedRecord);
        setTargetItem(updatedRecord);
        setLastPayment(newPayment);
        addLog('Payment Received', `Online: GHS ${amount.toFixed(2)} for Property No: ${property['Property No']}`);
        setStatus('success');
        setMessage(`Payment of ${formatCurrency(amount)} was successful.`);
      } else if (bop) {
        const updatedRecord = { 
            ...bop, 
            payments: [...(bop.payments || []), newPayment],
            'Payment': (Number(bop['Payment']) || 0) + amount 
        };
        updateBop(updatedRecord);
        setTargetItem(updatedRecord);
        setLastPayment(newPayment);
        addLog('Payment Received', `Online: GHS ${amount.toFixed(2)} for Business: ${bop['Business Name']}`);
        setStatus('success');
        setMessage(`Payment of ${formatCurrency(amount)} was successful.`);
      } else if (license) {
        const updatedRecord = { 
            ...license, 
            payments: [...(license.payments || []), newPayment],
            'Payment': (Number(license['Payment']) || 0) + amount 
        };
        updateLicense(updatedRecord);
        setTargetItem(updatedRecord);
        setLastPayment(newPayment);
        addLog('Payment Received', `Online: GHS ${amount.toFixed(2)} for Hotel: ${license['Name of Hotel/Guest House']}`);
        setStatus('success');
        setMessage(`Payment of ${formatCurrency(amount)} was successful.`);
      } else {
        setStatus('failed');
        setMessage('Payment verification failed. Record not found.');
      }
    } else if (paymentStatus === 'failed') {
        setStatus('failed');
        setMessage('Your payment was declined or cancelled.');
    }
  }, [searchParams, properties, bopData, licenseData, updateProperty, updateBop, updateLicense, addLog]);

  return (
    <div className="flex h-screen items-center justify-center bg-muted/30">
      <Card className="w-full max-w-md text-center shadow-lg">
        <CardHeader className="pt-8">
          {status === 'processing' && <Loader2 className="mx-auto h-16 w-16 animate-spin text-primary" />}
          {status === 'success' && <CheckCircle className="mx-auto h-16 w-16 text-green-500" />}
          {status === 'failed' && <XCircle className="mx-auto h-16 w-16 text-destructive" />}
          <CardTitle className="text-2xl mt-4 capitalize">{status}</CardTitle>
        </CardHeader>
        <CardContent className="pb-8">
          <p className="text-muted-foreground">{message}</p>
        </CardContent>
        <CardFooter className="flex flex-col gap-3 pb-8 px-8">
          {status === 'success' && (
              <Button className="w-full" size="lg" onClick={() => setShowReceipt(true)}>
                <Printer className="mr-2 h-4 w-4" /> Print Official Receipt
              </Button>
          )}
          <Button variant="outline" className="w-full" onClick={() => router.push('/dashboard')}>
            Return to Dashboard
          </Button>
        </CardFooter>
      </Card>

      {lastPayment && targetItem && (
          <ReceiptDialog 
            isOpen={showReceipt} 
            onOpenChange={setShowReceipt}
            payment={lastPayment}
            item={targetItem}
          />
      )}
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
