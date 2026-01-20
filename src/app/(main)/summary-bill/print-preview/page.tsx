
'use client';

import React, { useState, useEffect, useRef } from 'react';
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

const PrintableSummaryBill = React.forwardRef<HTMLDivElement, {
  data: SummaryBillData[];
  headers: string[];
  settings: { general: GeneralSettings, appearance: AppearanceSettings };
}>(({ data, headers, settings }, ref) => {

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
        fontSize: `${fontSize || 12}px`,
        lineHeight: `${(fontSize || 12) * 1.4}px`,
    };

    const formatDate = (date: Date) => {
        const day = date.getDate();
        const month = date.toLocaleString('default', { month: 'long' }).toUpperCase();
        const year = date.getFullYear();
        return `${day} ${month}, ${year}`;
    };

  return (
    <div ref={ref} className={cn("text-black bg-white w-full h-full box-border p-8", fontClass)} style={baseStyle}>
      <div className="h-full flex flex-col">
        <header className="flex justify-between items-start mb-4 border-b-2 border-black pb-4">
            <div className="w-1/4 flex justify-start items-center">
                {settings.appearance?.ghanaLogo && <Image src={settings.appearance.ghanaLogo} alt="Ghana Coat of Arms" className="object-contain" width={80} height={80} />}
            </div>
            <div className="w-1/2 text-center">
                <h1 className="font-bold tracking-wide text-2xl">{settings.general?.assemblyName?.toUpperCase() || 'DISTRICT ASSEMBLY'}</h1>
                <h2 className="font-bold tracking-wide text-xl">SUMMARY BILL</h2>
                <p className="text-sm">{settings.general?.postalAddress}</p>
                <p className="text-sm">TEL: {settings.general?.contactPhone}</p>
            </div>
            <div className="w-1/4 flex justify-end items-center">
                {settings.appearance?.assemblyLogo && <Image src={settings.appearance.assemblyLogo} alt="Assembly Logo" className="object-contain" width={80} height={80} />}
            </div>
        </header>

        <p className="text-right mb-4">Date: {formatDate(new Date())}</p>
        
        <main className="flex-grow">
          <Table>
            <TableHeader>
              <TableRow>
                {headers.map(header => <TableHead key={header} className="border border-black text-black font-bold">{header}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map(row => (
                <TableRow key={row.id}>
                  {headers.map(header => (
                    <TableCell key={header} className="border border-black">{row[header]}</TableCell>
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
});
PrintableSummaryBill.displayName = 'PrintableSummaryBill';

export default function SummaryBillPrintPage() {
  const router = useRouter();
  const componentRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  
  const [data, setData] = useState<SummaryBillData[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [settings, setSettings] = useState<{general: GeneralSettings, appearance: AppearanceSettings}>({ general: {}, appearance: {} });
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const loadData = () => {
        try {
            const storedData = localStorage.getItem('selectedSummaryBillsForPrinting');
            const storedHeaders = localStorage.getItem('summaryBillHeadersForPrinting');
            if (storedData) setData(JSON.parse(storedData));
            if (storedHeaders) setHeaders(JSON.parse(storedHeaders));

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

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    pageStyle: `@media print { 
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .print-page-break { page-break-after: always; } 
        .no-print { display: none; } 
    }`,
  });

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
        <Button onClick={handlePrint} disabled={data.length === 0}>
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
      </header>

      {data.length > 0 ? (
         <main className="flex-grow bg-muted/40 p-8">
            <div className="w-[210mm] min-h-[297mm] mx-auto bg-white shadow-lg">
                <PrintableSummaryBill ref={componentRef} data={data} headers={headers} settings={settings} />
            </div>
         </main>
      ) : (
         <div className="flex-grow flex items-center justify-center text-center">
            <div>
                <h2 className="text-2xl font-semibold">No Data to Display</h2>
                <p className="text-muted-foreground mt-2">
                    Please go back and upload an Excel file to generate a summary bill.
                </p>
            </div>
        </div>
      )}
    </div>
  );
}
