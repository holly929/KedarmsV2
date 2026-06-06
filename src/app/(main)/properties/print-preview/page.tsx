'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useReactToPrint } from 'react-to-print';
import Link from 'next/link';
import { ArrowLeft, Loader2, Printer, CheckCircle } from 'lucide-react';
import type { Property } from '@/lib/types';
import { PrintableContent } from '@/components/bill-dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useBillData } from '@/context/BillDataContext';
import { usePropertyData } from '@/context/PropertyDataContext';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { store } from '@/lib/store';
import { getPropertyValue } from '@/lib/property-utils';

export default function PropertyPrintPreviewPage() {
  const router = useRouter();
  const componentRef = useRef<HTMLDivElement>(null);
  const { addBills } = useBillData();
  const { properties } = usePropertyData();
  const { toast } = useToast();
  
  const [selectedItems, setSelectedItems] = useState<Property[]>([]);
  const [settings, setSettings] = useState<any>({ general: {}, appearance: {} });
  const [isDemandNotice, setIsDemandNotice] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const idsJson = sessionStorage.getItem('selectedPropertyIdsForPrinting');
    const demand = sessionStorage.getItem('printDemandMode') === 'true';
    
    if (idsJson) {
      const ids = JSON.parse(idsJson);
      const filtered = properties.filter(p => ids.includes(p.id));
      setSelectedItems(filtered);
    }
    
    setIsDemandNotice(demand);
    setSettings({ 
      general: store.settings.generalSettings || {}, 
      appearance: store.settings.appearanceSettings || {} 
    });
    setIsReady(true);
  }, [properties]);

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    removeAfterPrint: true,
    onAfterPrint: () => {
      const newBills = selectedItems.map(p => ({
        propertyId: p.id,
        propertySnapshot: p,
        generatedAt: new Date().toISOString(),
        year: new Date().getFullYear(),
        totalAmountDue: Number(getPropertyValue(p, 'Amount Due')) || 0,
        billType: 'property' as const,
      }));
      addBills(newBills);
      toast({ title: 'Print job recorded in history' });
    }
  });

  if (!isReady) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <header className="no-print bg-white border-b p-4 flex justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <Button asChild variant="ghost" size="sm"><Link href="/billing"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link></Button>
          <h1 className="font-bold">Property Print Preview ({selectedItems.length})</h1>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2 border px-3 py-1.5 rounded-md bg-red-50">
            <Checkbox id="demand" checked={isDemandNotice} onCheckedChange={(c) => setIsDemandNotice(!!c)} />
            <Label htmlFor="demand" className="text-red-700 font-bold text-xs uppercase">Demand Mode</Label>
          </div>
          <Button onClick={handlePrint} className={isDemandNotice ? "bg-red-600 hover:bg-red-700" : ""}>
            <Printer className="mr-2 h-4 w-4" /> Print Now
          </Button>
        </div>
      </header>

      <main className="flex-grow p-10 flex flex-col items-center gap-10 no-print">
        <div className="text-center">
           <CheckCircle className="h-10 w-10 text-green-500 mx-auto mb-2" />
           <h2 className="text-xl font-bold">Documents Loaded</h2>
           <p className="text-sm text-muted-foreground">Verify the layout below before printing.</p>
        </div>
        <div className="space-y-10">
          {selectedItems.map(item => (
            <div key={item.id} className="shadow-2xl bg-white scale-[0.7] sm:scale-[0.8] lg:scale-[1.0] origin-top">
              <PrintableContent data={item} billType="property" settings={settings} isDemandNotice={isDemandNotice} />
            </div>
          ))}
        </div>
      </main>

      {/* HIDDEN PRINT TARGET */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0 }}>
        <div ref={componentRef}>
          {selectedItems.map((item, idx) => (
            <div key={item.id} style={{ pageBreakAfter: idx === selectedItems.length - 1 ? 'auto' : 'always' }}>
              <PrintableContent data={item} billType="property" settings={settings} isDemandNotice={isDemandNotice} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
