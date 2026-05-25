'use client';

import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Printer, CheckCircle } from 'lucide-react';
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
  });

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <div className="flex flex-col items-center py-6 text-center space-y-2">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <h2 className="text-xl font-bold">Payment Successfully Recorded</h2>
            <p className="text-sm text-muted-foreground">You can now print a physical receipt for the payer.</p>
        </div>

        <div className="hidden">
            <div ref={receiptRef} className="p-8 text-black bg-white w-[80mm] font-mono text-[10px] leading-tight">
                <div className="text-center border-b pb-2 mb-2">
                    {appearance?.assemblyLogo && <img src={appearance.assemblyLogo} className="mx-auto h-12 mb-1" alt="Logo" />}
                    <h1 className="font-bold text-xs uppercase">{settings?.assemblyName}</h1>
                    <p>{settings?.postalAddress}</p>
                    <p>TEL: {settings?.contactPhone}</p>
                    <p className="font-bold mt-1">OFFICIAL PAYMENT RECEIPT</p>
                </div>
                
                <div className="space-y-1 mb-4">
                    <div className="flex justify-between"><span>DATE:</span><span>{new Date(payment.date).toLocaleDateString()}</span></div>
                    <div className="flex justify-between"><span>METHOD:</span><span className="font-bold">{payment.method}</span></div>
                    <div className="flex justify-between"><span>REF:</span><span>{payment.reference || payment.id}</span></div>
                    <div className="flex justify-between"><span>NAME:</span><span className="text-right">{getPropertyValue(item, 'Owner Name') || getPropertyValue(item, 'Business Name')}</span></div>
                    <div className="flex justify-between"><span>IDENTIFIER:</span><span>{getPropertyValue(item, 'Property No') || getPropertyValue(item, 'S/N') || 'N/A'}</span></div>
                </div>

                <div className="border-y py-2 mb-4">
                    <div className="flex justify-between font-bold text-xs">
                        <span>DESCRIPTION</span>
                        <span>AMOUNT</span>
                    </div>
                    <div className="flex justify-between mt-1">
                        <span>Revenue Payment</span>
                        <span>{payment.amount.toFixed(2)}</span>
                    </div>
                </div>

                <div className="text-right font-bold text-xs mb-4">
                    TOTAL PAID: GHS {payment.amount.toFixed(2)}
                </div>

                <div className="text-center italic mt-6 border-t pt-2">
                    <p>Thank you for your contribution</p>
                    <p className="not-italic mt-2">Issued by: {payment.recordedBy}</p>
                </div>
            </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> Print Receipt</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
