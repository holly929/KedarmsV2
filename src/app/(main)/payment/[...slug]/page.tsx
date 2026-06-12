'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Loader2, CheckCircle, ShieldCheck, CreditCard, Wallet, Phone, Zap } from 'lucide-react';
import type { PaymentBill, Property, Bop, License } from '@/lib/types';
import { getPropertyValue } from '@/lib/property-utils';
import { getBillStatus, getBopBillStatus, getLicenseBillStatus } from '@/lib/billing-utils';
import { paymentMethodIcons } from '@/components/payment-method-icons';
import { useToast } from '@/hooks/use-toast';
import { normalizePhoneNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

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
    const [bill, setBill] = useState<(PaymentBill & { requestedAmount?: number }) | null>(null);
    const [amountDue, setAmountDue] = useState(0);
    const [selectedMethod, setSelectedMethod] = useState('mtn');
    const [phone, setPhone] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [isPaid, setIsPaid] = useState(false);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        const storedBillJson = localStorage.getItem('paymentBill');
        if (storedBillJson) {
            try {
                const parsedBill = JSON.parse(storedBillJson);
                setBill(parsedBill);
                
                const existingPhone = getPropertyValue(parsedBill.data, 'Phone Number');
                if (existingPhone) {
                    setPhone(String(existingPhone));
                }
            } catch (error) {
                toast({ variant: 'destructive', title: 'Error', description: 'Could not load bill details.' });
            }
        }
    }, [toast]);
    
    useEffect(() => {
        if (bill) {
            // If a specific amount was requested in the dialog, use it.
            if (bill.requestedAmount && bill.requestedAmount > 0) {
                setAmountDue(bill.requestedAmount);
                return;
            }

            let due = 0;
            if (bill.type === 'property') {
                const p = bill.data as Property;
                const rv = Number(getPropertyValue(p, 'Rateable Value')) || 0;
                const bl = Number(getPropertyValue(p, 'Basic Levy')) || 0;
                const tp = Number(getPropertyValue(p, 'Total Payment')) || 0;
                const importedDue = getPropertyValue(p, 'Amount Due');
                
                due = rv + bl - tp;
                
                // If calculation is 0 but we have an imported amount due, trust the imported value
                if (due === 0 && importedDue !== undefined && importedDue !== null) {
                    due = Number(importedDue);
                }
            } else if (bill.type === 'bop') {
                const b = bill.data as Bop;
                due = (Number(getPropertyValue(b, 'Permit Fee')) || 0) + (Number(getPropertyValue(b, 'Arrears')) || 0) - (Number(getPropertyValue(b, 'Payment')) || 0);
            } else {
                const l = bill.data as any;
                due = (Number(getPropertyValue(l, 'Property Rate')) || Number(getPropertyValue(l, 'License Fee')) || 0) + (Number(getPropertyValue(l, 'Bop Amount')) || 0) + (Number(getPropertyValue(l, 'Arrears')) || 0) - (Number(getPropertyValue(l, 'Payment')) || 0);
            }
            setAmountDue(due > 0 ? due : 0);
            
            let status = 'Unbilled';
            if (bill.type === 'property') status = getBillStatus(bill.data as Property);
            else if (bill.type === 'bop') status = getBopBillStatus(bill.data as Bop);
            else status = getLicenseBillStatus(bill.data as any);

            if (status === 'Paid') setIsPaid(true);
        }
    }, [bill]);

    const isMomo = ['mtn', 'vodafone', 'airteltigo'].includes(selectedMethod);
    const normalized = normalizePhoneNumber(phone);
    const isValidPhone = normalized.length >= 10;

    const handlePayment = async () => {
        if (!bill) return;
        if (isMomo && !isValidPhone) {
            toast({ variant: 'destructive', title: 'Invalid Phone', description: 'Please enter a valid phone number for the wallet.' });
            return;
        }

        setIsProcessing(true);

        // Simulation of Paystack checkout process
        setTimeout(() => {
            const callbackUrl = `/payment/callback?status=success&reference=PAY-${Date.now()}&billId=${bill.data.id}&amount=${amountDue}&phone=${phone}`;
            router.push(callbackUrl);
        }, 2500);
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
                    <Card className="border-primary/20 bg-primary/[0.02] shadow-sm">
                        <CardHeader className="pb-3">
                            <CardTitle className="text-xs font-bold text-primary uppercase tracking-widest">Transaction Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">Reference ID</label>
                                <p className="font-mono text-sm">{itemID}</p>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">Billed To</label>
                                <p className="font-bold text-lg leading-tight">{itemName}</p>
                            </div>
                            <Separator />
                            <div className="pt-2">
                                <label className="text-[10px] font-bold text-muted-foreground uppercase">Payment Amount</label>
                                <p className="text-3xl font-black text-primary">{formatCurrency(amountDue)}</p>
                                {bill.requestedAmount && (
                                    <p className="text-[10px] text-muted-foreground mt-1 italic">Partial payment requested from dashboard.</p>
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-lg space-y-3">
                        <div className="flex items-center gap-2 text-blue-700 font-bold text-sm">
                            <Zap className="h-4 w-4" />
                            Direct Momo Prompt
                        </div>
                        <p className="text-xs text-blue-600 leading-relaxed">
                            Once initiated, a secure authorization prompt will be sent directly to the specified phone number. The user must enter their secret PIN to complete the transaction.
                        </p>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg border border-dashed text-xs text-muted-foreground">
                        <ShieldCheck className="h-5 w-5 text-green-600 shrink-0" />
                        <p>Secured by Paystack. All data is encrypted and handled via PCI-compliant infrastructure.</p>
                    </div>
                </div>

                <Card className="lg:col-span-3 shadow-2xl border-2">
                    <CardHeader className="border-b bg-muted/5">
                        <CardTitle className="flex items-center gap-2 font-headline"><CreditCard className="h-5 w-5 text-primary" /> Secure Checkout</CardTitle>
                        <CardDescription>Select your wallet and enter the recipient phone number.</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-8 space-y-8">
                        {isPaid || (amountDue <= 0 && !bill.requestedAmount) ? (
                            <div className="flex flex-col items-center justify-center text-center py-12 space-y-4">
                                <CheckCircle className="h-20 w-20 text-green-500 animate-bounce" />
                                <h3 className="text-2xl font-black text-green-600">Bill Already Settled</h3>
                                <p className="text-muted-foreground">This record has no outstanding balance.</p>
                                <Button onClick={() => router.push('/dashboard')}>Go to Dashboard</Button>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-4">
                                    <h3 className="font-bold text-xs uppercase text-muted-foreground tracking-tighter">1. Select Payment Method</h3>
                                    <RadioGroup value={selectedMethod} onValueChange={setSelectedMethod} className="grid grid-cols-1 gap-2">
                                        {[...paymentMethods.momo, ...paymentMethods.card].map(method => {
                                            const Icon = paymentMethodIcons[method.id];
                                            const isActive = selectedMethod === method.id;
                                            return (
                                                <Label 
                                                    key={method.id} 
                                                    htmlFor={method.id} 
                                                    className={cn(
                                                        "flex items-center justify-between rounded-xl border-2 p-4 cursor-pointer transition-all hover:bg-muted/30",
                                                        isActive ? "border-primary bg-primary/[0.04]" : "border-muted"
                                                    )}
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <RadioGroupItem value={method.id} id={method.id} />
                                                        <span className="font-bold">{method.name}</span>
                                                    </div>
                                                    <div className="h-6 w-10 relative opacity-80">{Icon && <Icon />}</div>
                                                </Label>
                                            );
                                        })}
                                    </RadioGroup>
                                </div>

                                {isMomo && (
                                    <div className="space-y-4 p-6 bg-primary/[0.02] border-2 border-primary/20 rounded-2xl animate-in zoom-in-95 duration-300">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="momo-phone" className="text-sm font-black uppercase text-primary tracking-widest">2. Input Wallet Number</Label>
                                            {isValidPhone && <Badge className="bg-green-500">Validated</Badge>}
                                        </div>
                                        <div className="relative">
                                            <Phone className="absolute left-4 top-4 h-6 w-6 text-muted-foreground" />
                                            <Input 
                                                id="momo-phone"
                                                type="tel"
                                                placeholder="e.g. 0244123456" 
                                                className="pl-14 h-16 text-2xl font-mono tracking-[0.2em] border-primary/30 focus-visible:ring-primary focus-visible:ring-offset-2"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                                autoFocus
                                            />
                                        </div>
                                        <p className="text-xs text-muted-foreground flex items-center gap-2 italic">
                                            <Zap className="h-3 w-3 text-orange-500" />
                                            Money will be debited from this number via a Direct Momo Push.
                                        </p>
                                    </div>
                                )}
                            </>
                        )}
                    </CardContent>
                    {!(isPaid || (amountDue <= 0 && !bill.requestedAmount)) && (
                        <CardFooter className="flex-col items-stretch space-y-4 border-t p-8 bg-muted/5">
                            <Button 
                                size="lg" 
                                className="w-full text-xl h-20 font-black shadow-xl rounded-2xl transition-transform active:scale-95" 
                                onClick={handlePayment} 
                                disabled={isProcessing || (isMomo && !isValidPhone)}
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="mr-3 h-6 w-6 animate-spin" />
                                        Triggering Momo Prompt...
                                    </>
                                ) : (
                                    <>
                                        <Zap className="mr-2 h-5 w-5 fill-current" />
                                        PAY {formatCurrency(amountDue)} NOW
                                    </>
                                )}
                            </Button>
                            <div className="flex items-center justify-center gap-2 opacity-40">
                                <span className="text-[10px] font-bold uppercase tracking-widest">Powering Revenue Mobilization</span>
                                <Separator className="w-8" />
                                <span className="text-[10px] font-bold">PAYSTACK SECURE</span>
                            </div>
                        </CardFooter>
                    )}
                </Card>
            </div>
        </div>
    );
}
