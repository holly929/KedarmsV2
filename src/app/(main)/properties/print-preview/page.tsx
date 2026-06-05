'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useReactToPrint } from 'react-to-print';
import Link from 'next/link';
import { ArrowLeft, Loader2, Printer, CheckCircle } from 'lucide-react';

import type { Property } from '@/lib/types';
import { PrintableContent } from '@/components/bill-dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useBillData } from '@/context/BillDataContext';
import { usePropertyData } from '@/context/PropertyDataContext';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { getPropertyValue } from '@/lib/property-utils';
import { store } from '@/lib/store';
import { cn } from '@/lib/utils';

type GeneralSettings = { assemblyName?: string; postalAddress?: string; contactPhone?: string; };
type AppearanceSettings = { assemblyLogo?: string; ghanaLogo?: string; signature?: string; billWarningText?: string; demandNoticeCaption?: string; fontFamily?: 'sans' | 'serif' | 'mono'; fontSize?: number; accentColor?: string; };

const BillSheet = React.forwardRef<HTMLDivElement, { properties: Property[], settings: { general: GeneralSettings, appearance: AppearanceSettings }, billsPerPage: number, isCompact: boolean, isDemandNotice: boolean }>(({ properties, settings, billsPerPage, isCompact, isDemandNotice }, ref) => {
    
    const sheetStyle = { backgroundColor: 'white', minHeight: '297mm' };

    if (billsPerPage === 4) {
        const chunks: Property[][] = [];
        for (let i = 0; i < properties.length; i += 4) chunks.push(properties.slice(i, i + 4));
        return (
            <div ref={ref} style={sheetStyle} className="bg-white text-black">
                {chunks.map((chunk, index) => (
                    <div key={index} className="print-page-break w-[210mm] h-[297mm] mx-auto bg-white grid grid-cols-2 grid-rows-2 box-border overflow-hidden">
                        {chunk.map(p => (
                            <div key={p.id} className="w-full h-full box-border overflow-hidden border-dashed border-gray-300 [&:nth-child(1)]:border-r [&:nth-child(1)]:border-b [&:nth-child(2)]:border-b [&:nth-child(3)]:border-r p-1 break-inside-avoid">
                                <div className="w-full h-full transform scale-[0.98] origin-center">
                                    <PrintableContent data={p} billType="property" settings={settings} isCompact={true} isDemandNotice={isDemandNotice} />
                                </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        );
    }
    if (billsPerPage === 2) {
        const chunks: Property[][] = [];
        for (let i = 0; i < properties.length; i += 2) chunks.push(properties.slice(i, i + 2));
        return (
            <div ref={ref} style={sheetStyle} className="bg-white text-black">
                {chunks.map((chunk, index) => (
                    <div key={index} className="print-page-break w-[210mm] h-[297mm] mx-auto bg-white flex flex-col box-border overflow-hidden">
                        {chunk.map((p, ci) => (
                            <div key={p.id} className="h-[148.5mm] w-full box-border overflow-hidden p-1 relative break-inside-avoid">
                                <div className="w-full h-full transform scale-[0.98] origin-center">
                                    <PrintableContent data={p} billType="property" settings={settings} isCompact={isCompact} isDemandNotice={isDemandNotice} />
                                </div>
                                {chunk.length === 2 && ci === 0 && <div className="absolute bottom-0 left-[5%] right-[5%] h-[1px] border-t border-dashed border-gray-400"></div>}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        );
    }
    return (
        <div ref={ref} style={sheetStyle} className="bg-white text-black">
            {properties.map(p => (
                <div key={p.id} className="print-page-break w-[210mm] h-[297mm] mx-auto bg-white overflow-hidden p-2 break-inside-avoid">
                    <PrintableContent data={p} billType="property" settings={settings} isCompact={isCompact} isDemandNotice={isDemandNotice} />
                </div>
            ))}
        </div>
    );
});
BillSheet.displayName = 'BillSheet';

export default function BulkPrintPage() {
  const router = useRouter();
  const componentRef = useRef<HTMLDivElement>(null);
  const { addBills, bills } = useBillData();
  const { properties } = usePropertyData();
  const { toast } = useToast();
  
  const [allProperties, setAllProperties] = useState<Property[]>([]);
  const [renderedProperties, setRenderedProperties] = useState<Property[]>([]);
  const [settings, setSettings] = useState<{general: GeneralSettings, appearance: AppearanceSettings}>({ general: {}, appearance: {} });
  const [isClient, setIsClient] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [billsPerPage, setBillsPerPage] = useState(2);
  const [isCompact, setIsCompact] = useState(false);
  const [isDemandNotice, setIsDemandNotice] = useState(false);

  useEffect(() => { setIsClient(true); }, []);

  useEffect(() => {
    if (!isClient) return;
    const idsJson = sessionStorage.getItem('selectedPropertyIdsForPrinting');
    const billIdsJson = sessionStorage.getItem('selectedBillIdsForPrinting');
    const demand = sessionStorage.getItem('printDemandMode') === 'true';
    
    if (idsJson) {
      const ids = JSON.parse(idsJson);
      const source = properties.filter(p => ids.includes(p.id));
      setAllProperties(source);
    } else if (billIdsJson) {
      const ids = JSON.parse(billIdsJson);
      const source = bills.filter(b => ids.includes(b.id)).map(b => b.propertySnapshot as Property);
      setAllProperties(source);
    }

    setIsDemandNotice(demand);
    setSettings({ general: store.settings.generalSettings || {}, appearance: store.settings.appearanceSettings || {} });
  }, [isClient, properties, bills]);

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    onAfterPrint: async () => {
      const newBills = renderedProperties.map(p => ({
        propertyId: p.id,
        propertySnapshot: p,
        generatedAt: new Date().toISOString(),
        year: new Date().getFullYear(),
        totalAmountDue: Number(getPropertyValue(p, 'Amount Due')) || 0,
        billType: 'property' as const,
      }));
      await addBills(newBills);
      toast({ title: 'Bills Recorded' });
    }
  });

  useEffect(() => {
    if (allProperties.length > 0 && isClient) {
        setIsPreparing(true); setRenderedProperties([]); setProgress(0);
        let current = 0; const chunk = 40;
        const render = () => {
            if (current >= allProperties.length) { setIsPreparing(false); return; }
            const next = Math.min(current + chunk, allProperties.length);
            setRenderedProperties(p => [...p, ...allProperties.slice(current, next)]);
            setProgress(next); current = next;
            setTimeout(render, 10);
        };
        render();
    }
  }, [allProperties, isClient]);

  if (!isClient) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="no-print bg-card border-b p-4 flex justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
            <Button asChild variant="outline" size="sm"><Link href="/billing"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link></Button>
            <h1 className="text-xl font-semibold">Batch Print ({allProperties.length})</h1>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2 border px-3 py-1 rounded-md bg-red-50 dark:bg-red-950/20">
                <Checkbox id="demand-mode" checked={isDemandNotice} onCheckedChange={(checked) => setIsDemandNotice(Boolean(checked))} />
                <Label htmlFor="demand-mode" className="whitespace-nowrap text-red-700 dark:text-red-400 font-bold">Demand Notice</Label>
            </div>
            <Select value={String(billsPerPage)} onValueChange={v => setBillsPerPage(Number(v))}><SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">1</SelectItem><SelectItem value="2">2</SelectItem><SelectItem value="4">4</SelectItem></SelectContent></Select>
            <Button onClick={() => handlePrint()} disabled={isPreparing} className={cn(isDemandNotice ? "bg-red-600 hover:bg-red-700" : "")}>
                <Printer className="mr-2 h-4 w-4" />Print
            </Button>
        </div>
      </header>
      <main className="flex-grow flex flex-col items-center justify-center p-4 print:hidden">
         {isPreparing ? <div className="w-full max-w-md"><Progress value={(progress / allProperties.length) * 100} /><p className="mt-2 text-center">Preparing {progress} / {allProperties.length}</p></div> : <div className="text-center space-y-2"><CheckCircle className="h-12 w-12 text-green-500 mx-auto" /><p className="text-muted-foreground font-medium">Ready to Print. Check the "Demand Notice" toggle above if needed.</p></div>}
      </main>
      
      {/* 
          OFF-CANVAS RENDERING STRATEGY:
          We use absolute positioning far to the left with opacity 1. 
          This ensures the browser layout engine fully paints the content, 
          styles, and barcode hooks before react-to-print captures them.
      */}
      <div className="absolute left-[-9999px] top-0 pointer-events-none bg-white text-black" style={{ width: '210mm' }}>
        <div ref={componentRef} className="bg-white">
            <BillSheet properties={renderedProperties} settings={settings} billsPerPage={billsPerPage} isCompact={isCompact || billsPerPage === 4} isDemandNotice={isDemandNotice} />
        </div>
      </div>
    </div>
  );
}
