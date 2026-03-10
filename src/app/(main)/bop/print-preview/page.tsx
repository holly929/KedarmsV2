'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useReactToPrint } from 'react-to-print';
import Link from 'next/link';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';

import type { Bop, Bill } from '@/lib/types';
import { PrintableContent } from '@/components/bill-dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useBillData } from '@/context/BillDataContext';
import { useToast } from '@/hooks/use-toast';
import { Checkbox } from '@/components/ui/checkbox';
import { store } from '@/lib/store';

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
  fontFamily?: 'sans' | 'serif' | 'mono';
  fontSize?: number;
  accentColor?: string;
};

const BillSheet = React.forwardRef<HTMLDivElement, { bops: Bop[], settings: { general: GeneralSettings, appearance: AppearanceSettings }, billsPerPage: number, isCompact: boolean }>(({ bops, settings, billsPerPage, isCompact }, ref) => {
    
    if (billsPerPage === 4) {
        const bopChunks: Bop[][] = [];
        for (let i = 0; i < bops.length; i += 4) {
            bopChunks.push(bops.slice(i, i + 4));
        }

        return (
            <div ref={ref}>
                {bopChunks.map((chunk, index) => (
                    <div key={index} className="print-page-break w-[210mm] h-[297mm] mx-auto bg-white grid grid-cols-2 grid-rows-2 box-border">
                        {chunk.map((bop) => (
                            <div key={bop.id} className="w-full h-full box-border overflow-hidden flex items-center justify-center border-dashed border-gray-400 [&:nth-child(1)]:border-r [&:nth-child(1)]:border-b [&:nth-child(2)]:border-b [&:nth-child(3)]:border-r">
                               <div className="w-full h-full scale-[0.95] flex items-center justify-center">
                                    <PrintableContent data={bop} billType="bop" settings={settings} isCompact={true} />
                               </div>
                            </div>
                        ))}
                        {Array.from({ length: 4 - chunk.length }).map((_, i) => <div key={`empty-${i}`}></div>)}
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
            <div ref={ref}>
                {bopChunks.map((chunk, index) => (
                    <div key={index} className="print-page-break w-[210mm] h-[297mm] mx-auto bg-white flex flex-col justify-center items-center box-border">
                        {chunk.map((bop, chunkIndex) => (
                            <React.Fragment key={bop.id}>
                               <div className="h-[148.5mm] w-full box-border overflow-hidden flex items-center justify-center">
                                   <div className="w-full h-full scale-[0.95] flex items-center justify-center">
                                        <PrintableContent data={bop} billType="bop" settings={settings} isCompact={isCompact} />
                                   </div>
                               </div>
                               {chunk.length === 2 && chunkIndex === 0 && (
                                   <div className="w-[95%] h-[1px] border-t border-dashed border-gray-400 self-center"></div>
                               )}
                            </React.Fragment>
                        ))}
                         {chunk.length < 2 && <div className="h-[148.5mm] w-full"></div>}
                    </div>
                ))}
            </div>
        );
    }
    
    return (
        <div ref={ref}>
            <div className="print:space-y-0">
                {bops.length > 0 ? (
                    bops.map((bop) => (
                        <div key={bop.id} className="print-page-break w-[210mm] h-[297mm] mx-auto bg-white flex items-center justify-center">
                            <div className="w-full h-full scale-[0.95] flex items-center justify-center">
                                <PrintableContent data={bop} billType="bop" settings={settings} isCompact={isCompact}/>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center h-[calc(100vh-10rem)] text-center">
                        <h2 className="text-2xl font-semibold">No BOP Records to Print</h2>
                        <p className="text-muted-foreground mt-2">
                            It seems no records were selected. Please go back and select some BOP records to print.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
});
BillSheet.displayName = 'BillSheet';


export default function BulkBopPrintPage() {
  const router = useRouter();
  const componentRef = useRef<HTMLDivElement>(null);
  const { addBills } = useBillData();
  const { toast } = useToast();
  
  const [allBops, setAllBops] = useState<Bop[]>([]);
  const [renderedBops, setRenderedBops] = useState<Bop[]>([]);
  const [settings, setSettings] = useState<{general: GeneralSettings, appearance: AppearanceSettings}>({ general: {}, appearance: {} });
  const [isClient, setIsClient] = useState(false);

  const [isPreparing, setIsPreparing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [billsPerPage, setBillsPerPage] = useState(2);
  const [isCompact, setIsCompact] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const loadData = () => {
        try {
            const storedBops = localStorage.getItem('selectedBopsForPrinting');
            if (storedBops) {
                setAllBops(JSON.parse(storedBops));
            }
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
  }, [toast]);

  const recordBills = async () => {
    if (renderedBops.length === 0) return;

    const newBills: Omit<Bill, 'id'>[] = renderedBops.map(b => {
        const permitFee = Number(b['Permit Fee']) || 0;
        const arrears = Number(b['Arrears']) || 0;
        const payment = Number(b['Payment']) || 0;
        const totalAmountDue = (permitFee + arrears) - payment;

        return {
            propertyId: b.id,
            propertySnapshot: b,
            generatedAt: new Date().toISOString(),
            year: new Date().getFullYear(),
            totalAmountDue: totalAmountDue,
            billType: 'bop',
        };
    }).filter(Boolean) as Omit<Bill, 'id'>[];
    
    if (newBills.length > 0) {
        const success = await addBills(newBills);
        if (success) {
          toast({
              title: 'Bills Recorded',
              description: `${newBills.length} BOP bills have been recorded in the bill history.`,
          });
        }
    }
  };

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    onAfterPrint: () => recordBills(),
  });

  const handleGenerateAndPrint = () => {
    if (renderedBops.length === 0) {
        toast({
            variant: 'destructive',
            title: 'No Bills Ready',
            description: 'There are no bills prepared for printing.',
        });
        return;
    };
    handlePrint();
  };

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

  if (!isClient) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isPreparing) {
    return (
      <div className="flex flex-col min-h-screen bg-background">
        <header className="no-print bg-card border-b p-4 flex items-center justify-between sticky top-0 z-10">
          <h1 className="text-xl font-semibold">Preparing Bills...</h1>
        </header>
        <main className="flex-grow flex flex-col items-center justify-center text-center p-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
          <h2 className="text-2xl font-semibold">Please Wait</h2>
          <p className="text-muted-foreground mt-2 max-w-md">
            We are preparing {allBops.length} bills for printing. This may take a moment.
          </p>
          <div className="w-full max-w-md mt-6">
            <Progress value={allBops.length > 0 ? (progress / allBops.length) * 100 : 0} />
            <p className="text-sm text-muted-foreground mt-2">
              {progress} / {allBops.length} bills ready
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="no-print bg-card border-b p-4 flex flex-col sm:flex-row items-center justify-between sticky top-0 z-10 gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
            <Button asChild variant="outline" size="sm">
                <Link href="/bop-billing">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                </Link>
            </Button>
            <h1 className="text-lg sm:text-xl font-semibold">
                Print Preview ({allBops.length} {allBops.length === 1 ? 'Bill' : 'Bills'})
            </h1>
        </div>
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <div className="flex items-center space-x-2">
                <Checkbox id="compact-mode" checked={isCompact || billsPerPage === 4} onCheckedChange={(checked) => setIsCompact(Boolean(checked))} disabled={billsPerPage === 4} />
                <Label htmlFor="compact-mode" className="whitespace-nowrap">Compact Mode</Label>
            </div>
            <div className="flex items-center space-x-2 w-full sm:w-auto">
                <Label htmlFor="bills-per-page" className="whitespace-nowrap">Bills per Page</Label>
                <Select value={String(billsPerPage)} onValueChange={(v) => setBillsPerPage(Number(v))}>
                    <SelectTrigger id="bills-per-page" className="w-full sm:w-[80px]">
                        <SelectValue placeholder="Select" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="1">1</SelectItem>
                        <SelectItem value="2">2</SelectItem>
                        <SelectItem value="4">4</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <Button onClick={handleGenerateAndPrint} disabled={renderedBops.length === 0} className="w-full sm:w-auto">
              <Printer className="mr-2 h-4 w-4" />
              Print & Record Bills
            </Button>
        </div>
      </header>

      <main className="flex-grow flex items-center justify-center p-4 print:hidden">
         <div className="text-center">
            <h2 className="text-2xl font-semibold">Ready to Print</h2>
            <p className="text-muted-foreground mt-2">
                Clicking the print button will open the print dialog and record the bills in your history.
            </p>
            <p className="text-muted-foreground mt-1">Click the "Print & Record Bills" button above to continue.</p>
         </div>
      </main>
      
      {/* Hidden print container - positioned off-screen to keep it rendered in DOM */}
      <div className="absolute -left-[9999px] top-0 pointer-events-none">
        <BillSheet ref={componentRef} bops={renderedBops} settings={settings} billsPerPage={billsPerPage} isCompact={isCompact || billsPerPage === 4} />
      </div>
    </div>
  );
}
