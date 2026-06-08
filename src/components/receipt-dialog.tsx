'use client';

import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { Printer, CheckCircle, FileText } from 'lucide-react';
import type { Payment, Property, Bop, License } from '@/lib/types';
import { store } from '@/lib/store';
import { getPropertyValue } from '@/lib/property-utils';

interface ReceiptDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  payment: Payment;
  item: Property | Bop | License;
}

export function ReceiptDialog({ isOpen, onOpenChange, payment, item }: ReceiptDialogProps) {
  const receiptRef = useRef<HTMLDivElement>(null);
  const settings = store.settings.generalSettings;
  const appearance = store.settings.appearanceSettings;

  const handlePrint = useReactToPrint({
    content: () => receiptRef.current,
    removeAfterPrint: true,
  });

  const itemName = getPropertyValue(item, 'Owner Name') || 
                   getPropertyValue(item, 'Business Name') || 
                   getPropertyValue(item, 'Name of Hotel/Guest House') || 'N/A';

  const itemIdentifier = getPropertyValue(item, 'Property No') || 
                         getPropertyValue(item, 'S/N') || 
                         getPropertyValue(item, 'SN') || 'N/A';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
           <div className="flex flex-col items-center py-4 text-center space-y-2">
                <CheckCircle className="h-12 w-12 text-green-500" />
                <DialogTitle className="text-xl font-bold">Transaction Confirmed</DialogTitle>
                <p className="text-sm text-muted-foreground">Official receipt for {itemName}.</p>
            </div>
        </DialogHeader>

        <div className="bg-muted/50 p-4 rounded-lg border border-dashed border-muted-foreground/30 space-y-3">
            <div className="flex justify-between text-xs">
                <span className="font-semibold">Receipt No:</span>
                <span className="font-mono">{payment.reference || payment.id}</span>
            </div>
            <div className="flex justify-between text-xs">
                <span className="font-semibold">Amount Paid:</span>
                <span className="font-bold">GHS {payment.amount.toFixed(2)}</span>
            </div>
             <div className="flex justify-between text-xs">
                <span className="font-semibold">Method:</span>
                <span className="capitalize">{payment.method}</span>
            </div>
        </div>

        {/* HIGH-FIDELITY RENDER BUFFER FOR RECEIPT */}
        <div className="fixed top-0 left-[-9999px] -z-50 pointer-events-none opacity-100 printable-area">
            <div ref={receiptRef} className="p-8 text-black bg-white w-[80mm] font-mono text-[10px] leading-tight">
                <div className="text-center border-b pb-2 mb-4">
                    {appearance?.ghanaLogo && <Image src={appearance.ghanaLogo} width={48} height={48} className="mx-auto mb-1 object-contain" alt="Ghana Logo" unoptimized />}
                    <h1 className="font-bold text-xs uppercase">{settings?.assemblyName}</h1>
                    <p>{settings?.postalAddress}</p>
                    <p>TEL: {settings?.contactPhone}</p>
                    <div className="mt-2 py-1 bg-black text-white font-bold text-[11px] uppercase tracking-widest">
                        OFFICIAL PAYMENT RECEIPT
                    </div>
                </div>
                
                <div className="space-y-1 mb-6">
                    <div className="flex justify-between"><span>DATE:</span><span>{new Date(payment.date).toLocaleString('en-GB')}</span></div>
                    <div className="flex justify-between"><span>METHOD:</span><span className="font-bold uppercase">{payment.method}</span></div>
                    <div className="flex justify-between"><span>REF/RECEIPT:</span><span className="font-bold">{payment.reference || payment.id}</span></div>
                    <div className="flex justify-between"><span>PAYER:</span><span className="text-right font-bold truncate max-w-[120px]">{itemName.toUpperCase()}</span></div>
                    <div className="flex justify-between"><span>ID NO:</span><span className="font-bold">{itemIdentifier}</span></div>
                </div>

                <div className="border-y-2 border-black py-3 mb-6">
                    <div className="flex justify-between font-bold text-[11px]">
                        <span>REVENUE DESCRIPTION</span>
                        <span>TOTAL</span>
                    </div>
                    <div className="flex justify-between mt-2">
                        <span className="italic">Development Levy / BOP / Property Rate</span>
                        <span className="font-bold">{payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                </div>

                <div className="text-right font-black text-[14px] mb-8 p-1 bg-black/5">
                    TOTAL PAID: GHS {payment.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>

                <div className="text-center italic mt-12 border-t pt-4 space-y-4">
                    <p className="text-[8px]">This is a computer generated receipt. No signature required for validation.</p>
                    <div className="mx-auto h-16 w-32 border border-black/10 flex items-center justify-center bg-black/[0.02]">
                         <span className="text-[10px] font-bold text-black/20 tracking-[0.3em] rotate-[-15deg]">VALIDATED</span>
                    </div>
                    <p className="not-italic font-bold text-[8px] uppercase mt-2">Issued by: {payment.recordedBy || 'RateEase System'}</p>
                    <p className="text-[9px] font-black mt-2 tracking-tighter">THANK YOU FOR PAYING YOUR RATES</p>
                </div>
            </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">Dismiss</Button>
          <Button onClick={handlePrint} className="w-full sm:w-auto">
            <Printer className="mr-2 h-4 w-4" /> Print official Receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}