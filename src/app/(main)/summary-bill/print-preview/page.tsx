'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useReactToPrint } from 'react-to-print';
import Link from 'next/link';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';

import type { Bop as SummaryBillData } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { store } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type GeneralSettings = {
  assemblyName?: string;
  postalAddress?: string;
  contactPhone?: string;
};

type AppearanceSettings = {
  assemblyLogo?: string;
  ghanaLogo?: string;
  signature?: string;
  fontFamily?: 'sans' | 'serif' | 'mono';
  fontSize?: number;
};

const PrintableSummaryBill = React.memo(React.forwardRef<HTMLDivElement, {
  data: SummaryBillData[];
  headers: string[];
  settings: { general: GeneralSettings, appearance: AppearanceSettings };
  sheetName: string;
}>(({ data, headers, settings, sheetName }, ref) => {

    const { 
        fontFamily, 
        fontSize, 
    } = settings.appearance || {};

    const fontClass = {
        sans: 'font-sans',
        serif: 'font-serif',
        mono: 'font-mono'
    }[fontFamily || 'sans'];

    const baseStyle = {
        fontSize: `${fontSize || 10}px`,
        lineHeight: `${(fontSize || 10) * 1.4}px`,
        backgroundColor: 'white',
        color: 'black'
    };

    const filteredHeaders = headers.filter(h => h && String(h).trim() !== '' && !String(h).toLowerCase().startsWith('__empty'));

    const assemblyName = settings.general?.assemblyName || 'KWAHU EAST DISTRICT ASSEMBLY';
    const postalAddress = settings.general?.postalAddress || 'P.O. Box 11, ABETIFI';
    const contactPhone = settings.general?.contactPhone || '0242122039/0244971784';

  return (
    <div ref={ref} className={cn("text-black bg-white w-[210mm] h-[297mm] box-border p-8 overflow-hidden relative", fontClass)} style={baseStyle}>
      <div className="h-full flex flex-col">
        <header className="mb-4 pb-4">
            <div className="flex justify-between items-center text-center">
                {settings.appearance?.ghanaLogo ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={settings.appearance.ghanaLogo} alt="Ghana Coat of Arms" style={{ objectFit: 'contain', width: '80px', height: 'auto' }} />
                ) : <div className="w-[80px]"></div>}
                <div className="flex flex-col items-center">
                    <h1 className="font-bold tracking-tight text-3xl uppercase leading-tight">{assemblyName}</h1>
                    <p className="text-base font-medium">{postalAddress}</p>
                    <p className="text-base font-medium">TEL: {contactPhone}</p>
                    <h2 className="font-bold tracking-widest text-xl text-center mt-4 border-y-2 border-black py-2 w-full uppercase">
                        SUMMARY BILL - {sheetName}
                    </h2>
                </div>
                {settings.appearance?.assemblyLogo ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={settings.appearance.assemblyLogo} alt="Assembly Logo" style={{ objectFit: 'contain', width: '80px', height: 'auto' }} />
                ) : <div className="w-[80px]"></div>}
            </div>
        </header>
        
        <main className="flex-grow bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                {filteredHeaders.map(header => <TableHead key={header} className="border border-black text-black font-bold uppercase text-[10px]">{header}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(row => (
                <TableRow key={row.id}>
                  {filteredHeaders.map(header => (
                    <TableCell key={header} className="border border-black text-black text-[9px]">{String(row[header] ?? '')}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </main>
        
        <footer className="mt-auto pt-8 shrink-0 bg-white">
            <div className="flex justify-end">
                 <div className="w-1/3 text-center">
                    <div className="mx-auto flex items-center justify-center h-16">
                        {settings.appearance?.signature && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={settings.appearance.signature} alt="Signature" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                        )}
                    </div>
                    <p className="border-t-2 border-black max-w-[12rem] mx-auto mt-1 pt-1 font-bold text-xs">
                        COORDINATING DIRECTOR
                    </p>
                </div>
            </div>
        </footer>
      </div>
    </div>
  );
}));
PrintableSummaryBill.displayName = 'PrintableSummaryBill';

export default function SummaryBillPrintPage() {
  const router = useRouter();
  const componentRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  const [workbook, setWorkbook] = useState<{[sheetName: string]: { data: SummaryBillData[], headers: string[] }}>({});
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [printScope, setPrintScope] = useState<'current' | 'all'>('current');
  const [settings, setSettings] = useState<{general: GeneralSettings, appearance: AppearanceSettings}>({ general: {}, appearance: {} });
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const loadData = () => {
        try {
            const storedWorkbook = sessionStorage.getItem('summaryBillWorkbookForPrinting');
            const storedActiveSheet = sessionStorage.getItem('activeSheetForPrinting');

            if (storedWorkbook) setWorkbook(JSON.parse(storedWorkbook));
            if (storedActiveSheet) setActiveSheet(storedActiveSheet);

            setSettings({
                general: store.settings.generalSettings || {},
                appearance: store.settings.appearanceSettings || {},
            });
        } catch (error) {
            console.error("Could not load data for printing", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not load data for printing.' });
        }
    }
    loadData();
  }, [toast]);

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
  });
  
  const sheetNames = Object.keys(workbook);
  const currentSheet = workbook[activeSheet];

  const sheetsToRender = useMemo(() => {
    if (printScope === 'all') {
      return sheetNames.map(name => ({ name, ...workbook[name] }));
    }
    if (currentSheet) {
      return [{ name: activeSheet, ...currentSheet }];
    }
    return [];
  }, [printScope, workbook, activeSheet, sheetNames, currentSheet]);

  if (!isClient) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="no-print bg-card border-b p-4 flex items-center justify-between sticky top-0 z-10 gap-4">
        <div className="flex items-center gap-4">
            <Button asChild variant="outline" size="sm">
                <Link href="/summary-bill">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                </Link>
            </Button>
            <h1 className="text-lg sm:text-xl font-semibold">
                Print Preview (Summary Bill)
            </h1>
        </div>
        <div className="flex items-center gap-4">
            {sheetNames.length > 1 && (
                <Select value={printScope} onValueChange={(value) => setPrintScope(value as 'current' | 'all')}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select print scope" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="current">Print Current Sheet</SelectItem>
                        <SelectItem value="all">Print All Sheets</SelectItem>
                    </SelectContent>
                </Select>
            )}
            <Button onClick={handlePrint} disabled={sheetsToRender.length === 0}>
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
        </div>
      </header>
        
      <main className="flex-grow flex items-center justify-center p-4 print:hidden">
         <div className="text-center">
            <h2 className="text-2xl font-semibold">Ready to Print</h2>
             {sheetsToRender.length > 0 ? (
                <>
                <p className="text-muted-foreground mt-2">
                    {printScope === 'all' 
                        ? `This will print all ${sheetsToRender.length} sheets.` 
                        : `This will print the "${activeSheet}" sheet.`}
                </p>
                <p className="text-muted-foreground mt-1">Click the "Print" button above to continue.</p>
                </>
             ) : (
                <p className="text-muted-foreground mt-2 max-w-md">
                    No data was found in the uploaded file. Please go back and upload an Excel file with data to print.
                </p>
             )}
         </div>
      </main>

      {/* PAINT-THROUGH FIXED POSITIONING (Ensures Visibility for Print Capture) */}
      <div className="fixed top-0 left-0 -z-50 pointer-events-none printable-area bg-white text-black opacity-100 print:static print:z-auto" style={{ width: '210mm' }}>
          {sheetsToRender.length > 0 && (
            <div ref={componentRef} className="bg-white">
                {sheetsToRender.map((sheet, index) => (
                    <div key={sheet.name} className={index < sheetsToRender.length - 1 ? 'print-page-break' : ''}>
                       <PrintableSummaryBill data={sheet.data} headers={sheet.headers} settings={settings} sheetName={sheet.name} />
                    </div>
                ))}
            </div>
          )}
      </div>
    </div>
  );
}