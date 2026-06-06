'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useReactToPrint } from 'react-to-print';
import Link from 'next/link';
import { ArrowLeft, Loader2, Printer, CheckCircle, ShieldCheck } from 'lucide-react';

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
    
    const sheetStyle = { backgroundColor: '#ffffff', minHeight: '297mm' };

    if (billsPerPage === 4) {
        const chunks: Property[][] = [];
        for (let i = 0; i < properties.length; i += 4) chunks.push(properties.slice(i, i + 4));
        return (
            <div ref={ref} style={sheetStyle} className="bg-[#ffffff] text-[#000000]">
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
            <div ref={ref} style={sheetStyle} className="bg-[#ffffff] text-[#000000]">
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
        <div ref={ref} style={sheetStyle} className="bg-[#ffffff] text-[#000000]">
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
  const [isPreparing, setIsPreparing] = useState(true);
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
    
    let source: Property[] = [];
    if (idsJson) {
      const ids = JSON.parse(idsJson);
      source = properties.filter(p => ids.includes(p.id));
    } else if (billIdsJson) {
      const ids = JSON.parse(billIdsJson);
      source = bills.filter(b => ids.includes(b.id)).map(b => b.propertySnapshot as Property);
    }
    setAllProperties(source);
    setIsDemandNotice(demand);
    setSettings({ general: store.settings.generalSettings || {}, appearance: store.settings.appearanceSettings || {} });
  }, [isClient, properties, bills]);

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    removeAfterPrint: true,
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
      toast({ title: 'Batch Recorded' });
    }
  });

  useEffect(() => {
    if (allProperties.length > 0 && isClient) {
        setIsPreparing(true); 
        setRenderedProperties([]); 
        setProgress(0);
        let current = 0; 
        const chunk = 50;
        const render = () => {
            if (current >= allProperties.length) { 
                setIsPreparing(false); 
                return; 
            }
            const next = Math.min(current + chunk, allProperties.length);
            setRenderedProperties(prev => [...prev, ...allProperties.slice(current, next)]);
            setProgress(next); 
            current = next;
            setTimeout(render, 50); // Increased timeout to allow browser to paint
        };
        render();
    } else if (allProperties.length === 0 && isClient) {
        setIsPreparing(false);
    }
  }, [allProperties, isClient]);

  if (!isClient) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="flex flex-col min-h-screen bg-slate-50">
      <header className="no-print bg-white border-b p-4 flex justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="sm"><Link href="/billing"><ArrowLeft className="h-4 w-4 mr-2" />Back</Link></Button>
            <div className="flex flex-col">
                <h1 className="text-lg font-bold leading-none">Property Batch Print</h1>
                <span className="text-xs text-muted-foreground">{allProperties.length} documents loaded</span>
            </div>
        </div>
        <div className="flex items-center gap-4">
            <div className="flex items-center space-x-2 border-2 px-3 py-1.5 rounded-md bg-red-50 border-red-100">
                <Checkbox id="demand-mode" checked={isDemandNotice} onCheckedChange={(checked) => setIsDemandNotice(Boolean(checked))} />
                <Label htmlFor="demand-mode" className="whitespace-nowrap text-red-700 font-bold text-xs uppercase">Demand Notice</Label>
            </div>
            <div className="flex items-center gap-2">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground">Layout</Label>
                <Select value={String(billsPerPage)} onValueChange={v => setBillsPerPage(Number(v))}><SelectTrigger className="w-[100px] h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">1 Per Page</SelectItem><SelectItem value="2">2 Per Page</SelectItem><SelectItem value="4">4 Per Page</SelectItem></SelectContent></Select>
            </div>
            <Button onClick={() => handlePrint()} disabled={isPreparing || allProperties.length === 0} className={cn("h-9 px-8 font-bold", isDemandNotice ? "bg-red-600 hover:bg-red-700" : "bg-primary")}>
                <Printer className="mr-2 h-4 w-4" />Print Batch
            </Button>
        </div>
      </header>

      <main className="flex-grow flex flex-col items-center p-8 no-print">
         {isPreparing ? (
            <div className="w-full max-w-md mt-20 text-center space-y-4">
                <Loader2 className="h-10 w-10 animate-spin mx-auto text-primary" />
                <div className="space-y-1">
                    <p className="font-bold">Building High-Fidelity Buffer...</p>
                    <Progress value={allProperties.length > 0 ? (progress / allProperties.length) * 100 : 0} className="h-2" />
                    <p className="text-xs text-muted-foreground">{progress} of {allProperties.length} rendered</p>
                </div>
            </div>
         ) : allProperties.length === 0 ? (
            <div className="mt-20 text-center space-y-4">
                <div className="bg-muted h-16 w-16 rounded-full flex items-center justify-center mx-auto">
                    <FileWarning className="h-8 w-8 text-muted-foreground" />
                </div>
                <h2 className="text-xl font-bold">No Records Selected</h2>
                <p className="text-muted-foreground">Go back to properties and select at least one item to print.</p>
                <Button asChild><Link href="/billing">Return to Billing</Link></Button>
            </div>
         ) : (
            <div className="space-y-12 w-full flex flex-col items-center">
                <div className="text-center space-y-2">
                    <div className="bg-green-100 text-green-700 rounded-full h-12 w-12 flex items-center justify-center mx-auto shadow-sm">
                        <CheckCircle className="h-7 w-7" />
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight">Documents Ready</h2>
                    <p className="text-muted-foreground max-w-sm mx-auto">Verify the layout below. The content is painted in a high-fidelity buffer to ensure perfect print quality.</p>
                </div>
                
                <div className="scale-[0.5] md:scale-[0.6] lg:scale-[0.7] origin-top bg-white p-12 rounded-3xl shadow-2xl border-4 border-slate-200">
                     <div className="flex items-center gap-2 mb-6 text-slate-400 font-bold uppercase tracking-widest text-xs border-b pb-4">
                        <ShieldCheck className="h-5 w-5" />
                        Live Preview Stream (A4 Standard)
                     </div>
                     <BillSheet properties={renderedProperties} settings={settings} billsPerPage={billsPerPage} isCompact={isCompact || billsPerPage === 4} isDemandNotice={isDemandNotice} />
                </div>
            </div>
         )}
      </main>
      
      <div className="fixed top-0 left-[-9999px] -z-50 pointer-events-none opacity-100 bg-[#ffffff] text-[#000000] printable-area" style={{ width: '210mm' }}>
        <div ref={componentRef} className="bg-[#ffffff]">
            <BillSheet properties={renderedProperties} settings={settings} billsPerPage={billsPerPage} isCompact={isCompact || billsPerPage === 4} isDemandNotice={isDemandNotice} />
        </div>
      </div>
    </div>
  );
}