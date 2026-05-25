'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ArrowLeft, Loader2, CheckCircle, ShieldCheck, CreditCard, Wallet } from 'lucide-react';
import type { PaymentBill, Property, Bop, Bill, Payment } from '@/lib/types';
import { getPropertyValue } from '@/lib/property-utils';
import { getBillStatus, getBopBillStatus, getLicenseBillStatus } from '@/lib/billing-utils';
import { paymentMethodIcons } from '@/components/payment-method-icons';
import { useToast } from '@/hooks/use-toast';
import { store } from '@/lib/store';

const formatCurrency = (value: number) => `GHS ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const paymentMethods = {
    momo: [
        { id: 'mtn', name: 'MTN Mobile Money' },
        { id: 'vodafone', name: 'Telecel Cash' },
        { id: 'airteltigo', name: 'AirtelTigo Money' },
    ],
    card: [
        { id: 'visa', name: 'Visa' },
        { id: 'mastercard', name: 'Mastercard' },
    ]
};

export default function PaymentPage() {
    const router = useRouter();
    const { toast } = useToast();
    const [bill, setBill] = useState<PaymentBill | null>(null);
    const [amountDue, setAmountDue] = useState(0);
    const [selectedMethod, setSelectedMethod] = useState('mtn');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isPaid, setIsPaid] = useState(false);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        const storedBillJson = localStorage.getItem('paymentBill');
        if (storedBillJson) {
            try {
                const parsedBill: PaymentBill = JSON.parse(storedBillJson);
                setBill(parsedBill);
            } catch (error) {
                toast({ variant: 'destructive', title: 'Error', description: 'Could not load bill details.' });
            }
        }
    }, [toast]);
    
    useEffect(() => {
        if (bill) {
            let due = 0;
            if (bill.type === 'property') {
                const p = bill.data as Property;
                const rv = Number(getPropertyValue(p, 'Rateable Value')) || 0;
                const ri = Number(getPropertyValue(p, 'Rate Impost')) || 0;
                const sc = Number(getPropertyValue(p, 'Sanitation Charged')) || 0;
                const pb = Number(getPropertyValue(p, 'Previous Balance')) || 0;
                const tp = Number(getPropertyValue(p, 'Total Payment')) || 0;
                due = (rv * ri) + sc + pb - tp;
            } else if (bill.type === 'bop') {
                const b = bill.data as Bop;
                due = (Number(getPropertyValue(b, 'Permit Fee')) || 0) + (Number(getPropertyValue(b, 'Arrears')) || 0) - (Number(getPropertyValue(b, 'Payment')) || 0);
            } else {
                const l = bill.data as any;
                due = (Number(getPropertyValue(l, 'Property Rate')) || 0) + (Number(getPropertyValue(l, 'Bop Amount')) || 0) + (Number(getPropertyValue(l, 'Arrears')) || 0) - (Number(getPropertyValue(l, 'Payment')) || 0);
            }
            setAmountDue(due > 0 ? due : 0);
            
            let status = 'Unbilled';
            if (bill.type === 'property') status = getBillStatus(bill.data as Property);
            else if (bill.type === 'bop') status = getBopBillStatus(bill.data as Bop);
            else status = getLicenseBillStatus(bill.data as any);

            if (status === 'Paid') setIsPaid(true);
        }
    }, [bill]);

    const handlePayment = async () => {
        if (!bill) return;
        setIsProcessing(true);

        // Simulate Paystack redirection
        setTimeout(() => {
            const callbackUrl = `/payment/callback?status=success&reference=PAY-${Date.now()}&billId=${bill.data.id}&amount=${amountDue}`;
            router.push(callbackUrl);
        }, 2000);
    };

    if (!isClient) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;
    
    if (!bill) {
        return (
          <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] text-center space-y-4">
            <Wallet className="h-16 w-16 text-muted-foreground opacity-20" />
            <h2 className="text-2xl font-bold">No Transaction Initiated</h2>
            <p className="text-muted-foreground">Please select a record from the billing page to pay online.</p>
            <Button onClick={() => router.back()}>Return to Billing</Button>
          </div>
        );
    }

    const itemName = getPropertyValue(bill.data, 'Owner Name') || getPropertyValue(bill.data, 'Business Name') || getPropertyValue(bill.data, 'Name of Hotel/Guest House') || 'N/A';
    const itemID = getPropertyValue(bill.data, 'Property No') || getPropertyValue(bill.data, 'S/N') || getPropertyValue(bill.data, 'SN') || 'N/A';

    return (
        <div className="max-w-4xl mx-auto py-10 px-4">
            <div className="mb-8">
                <Button variant="ghost" size="sm" onClick={() => router.back()}>
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Records
                </Button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8 items-start">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-primary/20 bg-primary/[0.02]">
                        <CardHeader>
                            <CardTitle className="text-sm font-bold text-primary uppercase tracking-widest">Order Summary</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">Reference ID</label>
                                <p className="font-mono text-sm">{itemID}</p>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">Payer Name</label>
                                <p className="font-bold">{itemName}</p>
                            </div>
                            <Separator />
                            <div className="flex justify-between items-center pt-2">
                                <span className="text-lg font-medium">Total Payable</span>
                                <span className="text-3xl font-black text-primary">{formatCurrency(amountDue)}</span>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg border border-dashed text-xs text-muted-foreground">
                        <ShieldCheck className="h-5 w-5 text-green-600 shrink-0" />
                        <p>Your payment is secured by industry-standard encryption. We never store your card or wallet details.</p>
                    </div>
                </div>

                <Card className="lg:col-span-3 shadow-xl">
                    <CardHeader className="border-b bg-muted/10">
                        <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-primary" /> Secure Checkout</CardTitle>
                        <CardDescription>Select your preferred Paystack payment method.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6">
                        {isPaid || amountDue <= 0 ? (
                            <div className="flex flex-col items-center justify-center text-center py-12 space-y-4">
                                <CheckCircle className="h-20 w-20 text-green-500 animate-bounce" />
                                <h3 className="text-2xl font-black text-green-600">Payment Settled</h3>
                                <p className="text-muted-foreground">This bill has been fully paid or has a zero balance.</p>
                                <Button onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
                            </div>
                        ) : (
                            <RadioGroup value={selectedMethod} onValueChange={setSelectedMethod} className="space-y-4">
                                <div>
                                    <h3 className="mb-3 font-bold text-xs uppercase text-muted-foreground">Mobile Money (Ghana)</h3>
                                    <div className="grid grid-cols-1 gap-2">
                                        {paymentMethods.momo.map(method => {
                                            const Icon = paymentMethodIcons[method.id];
                                            return (
                                                <Label key={method.id} htmlFor={method.id} className="flex items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 cursor-pointer transition-all hover:bg-muted/50 peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/[0.03]">
                                                    <div className="flex items-center gap-3">
                                                        <RadioGroupItem value={method.id} id={method.id} />
                                                        <span className="font-semibold">{method.name}</span>
                                                    </div>
                                                    <div className="h-6 w-10 relative">{Icon && <Icon />}</div>
                                                </Label>
                                            );
                                        })}
                                    </div>
                                </div>
                                <Separator />
                                <div>
                                    <h3 className="mb-3 font-bold text-xs uppercase text-muted-foreground">Cards</h3>
                                    <div className="grid grid-cols-1 gap-2">
                                        {paymentMethods.card.map(method => {
                                            const Icon = paymentMethodIcons[method.id];
                                            return (
                                                <Label key={method.id} htmlFor={method.id} className="flex items-center justify-between rounded-lg border-2 border-muted bg-popover p-4 cursor-pointer transition-all hover:bg-muted/50 peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary [&:has([data-state=checked])]:bg-primary/[0.03]">
                                                    <div className="flex items-center gap-3">
                                                        <RadioGroupItem value={method.id} id={method.id} />
                                                        <span className="font-semibold">{method.name}</span>
                                                    </div>
                                                    <div className="h-6 w-10 relative">{Icon && <Icon />}</div>
                                                </Label>
                                            );
                                        })}
                                    </div>
                                </div>
                            </RadioGroup>
                        )}
                    </CardContent>
                    {!(isPaid || amountDue <= 0) && (
                        <CardFooter className="flex-col items-stretch space-y-4 border-t pt-6 bg-muted/5">
                            <Button size="lg" className="w-full text-lg h-14 font-bold shadow-lg" onClick={handlePayment} disabled={isProcessing}>
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                        Redirecting to Paystack...
                                    </>
                                ) : `Confirm & Pay ${formatCurrency(amountDue)}`}
                            </Button>
                            <p className="text-center text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Powered by Paystack Secure Gateway</p>
                        </CardFooter>
                    )}
                </Card>
            </div>
        </div>
    );
}
