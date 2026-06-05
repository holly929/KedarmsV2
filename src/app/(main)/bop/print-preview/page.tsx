'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useReactToPrint } from 'react-to-print';
import Link from 'next/link';
import { ArrowLeft, Loader2, Printer, FileWarning } from 'lucide-react';

import type { Bop, Bill } from '@/lib/types';
import { PrintableContent } from '@/components/bill-dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useBillData } from '@/context/BillDataContext';
import { useBopData } from '@/context/BopDataContext';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { store } from '@/lib/store';
import { getPropertyValue } from '@/lib/property-utils';
import { cn } from '@/lib/utils';

type GeneralSettings = {
  assemblyName?: string;
  postalAddress?: string;
  contactPhone?: string;
};

type AppearanceSettings = {
  assemblyLogo?: string;
  ghanaLogo?: string;
  signature?: string;
  billWarningText?: string;
  demandNoticeCaption?: string;
  fontFamily?: 'sans' | 'serif' | 'mono';
  fontSize?: number;
  accentColor?: string;
};

const BillSheet = React.forwardRef<HTMLDivElement, { bops: Bop[], settings: { general: GeneralSettings, appearance: AppearanceSettings }, billsPerPage: number, isCompact: boolean, isDemandNotice: boolean }>(({ bops, settings, billsPerPage, isCompact, isDemandNotice }, ref) => {
    
    const sheetStyle = { backgroundColor: 'white', minHeight: '297mm' };

    if (billsPerPage === 4) {
        const bopChunks: Bop[][] = [];
        for (let i = 0; i < bops.length; i += 4) {
            bopChunks.push(bops.slice(i, i + 4));
        }

        return (
            <div ref={ref} style={sheetStyle} className="bg-white text-black">
                {bopChunks.map((chunk, index) => (
                    <div key={index} className="print-page-break w-[210mm] h-[297mm] mx-auto bg-white grid grid-cols-2 grid-rows-2 box-border overflow-hidden">
                        {chunk.map((bop) => (
                            <div key={bop.id} className="w-full h-full box-border overflow-hidden border-dashed border-gray-400 [&:nth-child(1)]:border-r [&:nth-child(1)]:border-b [&:nth-child(2)]:border-b [&:nth-child(3)]:border-r break-inside-avoid">
                               <div className="w-full h-full transform scale-[0.98] origin-center flex items-center justify-center">
                                    <PrintableContent data={bop} billType="bop" settings={settings} isCompact={true} isDemandNotice={isDemandNotice} />
                               </div>
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        );
    }
    
    if (billsPerPage === 2) {
        const bopChunks: Bop[][] = [];
        for (let i = 0; i < bops.length; i += 2) {
            bopChunks.push(bops.slice(i, i + 2));
        }

        return (
            <div ref={ref} style={sheetStyle} className="bg-white text-black">
                {bopChunks.map((chunk, index) => (
                    <div key={index} className="print-page-break w-[210mm] h-[297mm] mx-auto bg-white flex flex-col box-border overflow-hidden">
                        {chunk.map((bop, chunkIndex) => (
                            <div key={bop.id} className="h-[148.5mm] w-full box-border overflow-hidden relative break-inside-avoid">
                               <div className="w-full h-full transform scale-[0.98] origin-center flex items-center justify-center">
                                    <PrintableContent data={bop} billType="bop" settings={settings} isCompact={isCompact} isDemandNotice={isDemandNotice} />
                               </div>
                               {chunk.length === 2 && chunkIndex === 0 && (
                                   <div className="absolute bottom-0 left-[5%] right-[5%] h-[1px] border-t border-dashed border-gray-400"></div>
                               )}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        );
    }
    
    return (
        <div ref={ref} style={sheetStyle} className="bg-white text-black">
            {bops.map((bop) => (
                <div key={bop.id} className="print-page-break w-[210mm] h-[297mm] mx-auto bg-white overflow-hidden p-2 break-inside-avoid">
                    <div className="w-full h-full flex items-center justify-center">
                        <PrintableContent data={bop} billType="bop" settings={settings} isCompact={isCompact} isDemandNotice={isDemandNotice} />
                    </div>
                </div>
            ))}
        </div>
    );
});
BillSheet.displayName = 'BillSheet';


export default function BulkBopPrintPage() {
  const router = useRouter();
  const componentRef = useRef<HTMLDivElement>(null);
  const { addBills, bills } = useBillData();
  const { bopData } = useBopData();
  const { toast } = useToast();
  
  const [allBops, setAllBops] = useState<Bop[]>([]);
  const [renderedBops, setRenderedBops] = useState<Bop[]>([]);
  const [settings, setSettings] = useState<{general: GeneralSettings, appearance: AppearanceSettings}>({ general: {}, appearance: {} });
  const [isClient, setIsClient] = useState(false);

  const [isPreparing, setIsPreparing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [billsPerPage, setBillsPerPage] = useState(2);
  const [isCompact, setIsCompact] = useState(false);
  const [isDemandNotice, setIsDemandNotice] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient) return;

    const loadData = () => {
        try {
            const storedIdsJson = sessionStorage.getItem('selectedBopIdsForPrinting');
            const storedBillIdsJson = sessionStorage.getItem('selectedBillIdsForPrinting');
            const initialDemand = sessionStorage.getItem('printDemandMode') === 'true';
            
            let sourceBops: Bop[] = [];

            if (storedIdsJson) {
                const ids = JSON.parse(storedIdsJson);
                sourceBops = bopData.filter(b => ids.includes(b.id));
            } else if (storedBillIdsJson) {
                const ids = JSON.parse(storedBillIdsJson);
                const selectedBills = bills.filter(b => ids.includes(b.id));
                sourceBops = selectedBills.map(b => b.propertySnapshot as Bop);
            }
            
            if (sourceBops.length > 0) {
                setAllBops(sourceBops);
            }
            
            setIsDemandNotice(initialDemand);
            
            setSettings({
                general: store.settings.generalSettings || {},
                appearance: store.settings.appearanceSettings || {},
            });
        } catch (error) {
            console.error("Could not load data", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not load data for printing.' });
        }
    }
    loadData();
  }, [isClient, bopData, bills, toast]);

  const recordBills = async () => {
    if (renderedBops.length === 0) return;

    const newBills = renderedBops.map(b => ({
            propertyId: b.id,
            propertySnapshot: b,
            generatedAt: new Date().toISOString(),
            year: new Date().getFullYear(),
            totalAmountDue: Number(getPropertyValue(b, 'Amount Due')) || 0,
            billType: 'bop' as const,
    }));
    
    await addBills(newBills);
    toast({ title: 'Bills Recorded' });
  };

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    onAfterPrint: () => recordBills(),
  });

  useEffect(() => {
    if (allBops.length > 0 && isClient) {
        setIsPreparing(true);
        setRenderedBops([]);
        setProgress(0);
        
        const bopsToRender = [...allBops];
        let currentIndex = 0;
        const chunkSize = 20;

        const renderChunk = () => {
            if (currentIndex >= bopsToRender.length) {
                setIsPreparing(false);
                return;
            }

            const nextIndex = Math.min(currentIndex + chunkSize, bopsToRender.length);
            const chunk = bopsToRender.slice(currentIndex, nextIndex);
            setRenderedBops(prev => [...prev, ...chunk]);
            setProgress(nextIndex);
            currentIndex = nextIndex;

            setTimeout(renderChunk, 10);
        };
        
        renderChunk();
    }
  }, [allBops, isClient]);

  if (!isClient) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="no-print bg-card border-b p-4 flex justify-between sticky top-0 z-50">
        <div className="flex items-center gap-4">
            <Button asChild variant="outline" size="sm"><Link href="/bop-billing"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link></Button>
            <h1 className="text-xl font-semibold">BOP Print ({allBops.length})</h1>
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

      <main className="flex-grow flex items-center justify-center p-4 print:hidden">
         {isPreparing ? <div className="w-full max-w-md"><Progress value={(progress / allBops.length) * 100} /><p className="mt-2 text-center">Preparing {progress} / {allBops.length}</p></div> : <p className="font-medium text-muted-foreground italic">Ready to Print</p>}
      </main>
      
      {/* 
          OFF-CANVAS RENDERING STRATEGY:
          We use absolute positioning far to the left with opacity 1. 
          This ensures the browser layout engine fully paints the content, 
          styles, and barcode hooks before react-to-print captures them.
      */}
      <div className="absolute left-[-9999px] top-0 pointer-events-none bg-white text-black" style={{ width: '210mm' }}>
        <div ref={componentRef} className="bg-white">
            <BillSheet bops={renderedBops} settings={settings} billsPerPage={billsPerPage} isCompact={isCompact || billsPerPage === 4} isDemandNotice={isDemandNotice} />
        </div>
      </div>
    </div>
  );
}
