
'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useReactToPrint } from 'react-to-print';
import Link from 'next/link';
import { ArrowLeft, Loader2, Printer } from 'lucide-react';
import Image from 'next/image';

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
    };

    const filteredHeaders = headers.filter(h => h && String(h).trim() !== '' && !String(h).toLowerCase().startsWith('__empty'));

  return (
    <div className={cn("text-black bg-white w-full h-full box-border p-8", fontClass)} style={baseStyle}>
      <div className="h-full flex flex-col">
        <header className="mb-4 pb-4">
            <div className="flex justify-between items-center text-center">
                {settings.appearance?.ghanaLogo ? <Image src={settings.appearance.ghanaLogo} alt="Ghana Coat of Arms" className="object-contain" width={80} height={80} /> : <div className="w-[80px]"></div>}
                <div>
                    <h1 className="font-bold tracking-wide text-2xl">{settings.general?.assemblyName?.toUpperCase() || 'DISTRICT ASSEMBLY'}</h1>
                    <p className="text-sm">{settings.general?.postalAddress}</p>
                    <p className="text-sm">TEL: {settings.general?.contactPhone}</p>
                </div>
                {settings.appearance?.assemblyLogo ? <Image src={settings.appearance.assemblyLogo} alt="Assembly Logo" className="object-contain" width={80} height={80} /> : <div className="w-[80px]"></div>}
            </div>
            <h2 className="font-bold tracking-wide text-xl text-center mt-4 border-y-2 border-black py-2">
                SUMMARY BILL - {sheetName.toUpperCase()}
            </h2>
        </header>
        
        <main className="flex-grow">
          <Table>
            <TableHeader>
              <TableRow>
                {filteredHeaders.map(header => <TableHead key={header} className="border border-black text-black font-bold">{header}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(row => (
                <TableRow key={row.id}>
                  {filteredHeaders.map(header => (
                    <TableCell key={header} className="border border-black">{String(row[header] ?? '')}</TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </main>
        
        <footer className="mt-auto pt-16">
            <div className="flex justify-end">
                 <div className="w-1/3 text-center">
                    <div className="mx-auto flex items-center justify-center h-16">
                        {settings.appearance?.signature && (
                            <Image src={settings.appearance.signature} alt="Signature" className="max-h-full max-w-full object-contain" width={150} height={60} data-ai-hint="signature" />
                        )}
                    </div>
                    <p className="border-t-2 border-black max-w-[12rem] mx-auto mt-1 pt-1 font-bold">
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
            const storedWorkbook = localStorage.getItem('summaryBillWorkbookForPrinting');
            const storedActiveSheet = localStorage.getItem('activeSheetForPrinting');

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
    pageStyle: `@media print { 
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .print-page-break { page-break-after: always; } 
        .no-print { display: none; } 
    }`,
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

      <div className="invisible h-0 overflow-hidden print:visible print:h-auto print:overflow-visible">
          {sheetsToRender.length > 0 && (
            <div ref={componentRef}>
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
