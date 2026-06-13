'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  FileUp,
  MoreHorizontal,
  PlusCircle,
  Trash2,
  View,
  Loader2,
  UploadCloud,
  FilePenLine,
  Wallet,
} from 'lucide-react';
import * as XLSX from 'xlsx';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { Property } from '@/lib/types';
import { EditPropertyDialog } from '@/components/edit-property-dialog';
import { PropertyPaymentHistoryDialog } from '@/components/property-payment-history-dialog';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { usePropertyData } from '@/context/PropertyDataContext';
import { useAuth } from '@/context/AuthContext';
import { getPropertyValue } from '@/lib/property-utils';
import { Progress } from '@/components/ui/progress';

const ROWS_PER_PAGE = 15;
const IMPORT_CHUNK_SIZE = 200;

const DEFAULT_SYSTEM_HEADERS = [
    'S/N', 
    'Owner Name', 
    'Property No', 
    'Town', 
    'Suburb', 
    'Property Type', 
    'Basic Levy',
    'Amount', 
    'Rateable Value', 
    'Rate Impost', 
    'Sanitation Charged', 
    'Previous Balance', 
    'Total Payment', 
    'Amount Due'
];

import { parseNumeric, formatCurrency } from '@/lib/utils';

const formatValue = (value: any, header: string) => {
    if (value === undefined || value === null || String(value).trim() === '') return '';
    const skipFormatting = ['Property No', 'Account Number', 'Valuation List No.', 'Phone Number', 'S/N', 'SN', 'ID', 'Town', 'Suburb', 'Owner', 'Type'];
    const isCurrencyHeader = !skipFormatting.some(k => header.toLowerCase().includes(k.toLowerCase()));
    const isRateImpost = header.toLowerCase().includes('rate impost');

    if (isRateImpost) return String(value);

    if (isCurrencyHeader) {
        const num = parseNumeric(value);
        return formatCurrency(num);
    }
    return String(value);
}

export default function PropertiesPage() {
  const { toast } = useToast();
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { user: authUser } = useAuth();
  const isViewer = authUser?.role === 'Viewer';

  const { properties, headers, setProperties, deleteProperty, updateProperty, deleteAllProperties } = usePropertyData();
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState('');
  const [editingProperty, setEditingProperty] = React.useState<Property | null>(null);
  const [viewingPaymentsProperty, setViewingPaymentsProperty] = React.useState<Property | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const isMobile = useIsMobile();

  const [importStatus, setImportStatus] = React.useState<{ inProgress: boolean; total: number; processed: number; }>({ inProgress: false, total: 0, processed: 0 });
  const [isDragging, setIsDragging] = React.useState(false);

  React.useEffect(() => {
    if(properties.length >= 0) setLoading(false);
  }, [properties]);

  const filteredData = React.useMemo(() => {
    if (!filter) return properties;
    const lowerFilter = filter.toLowerCase();
    return properties.filter((row) =>
      Object.values(row).some((value) => String(value).toLowerCase().includes(lowerFilter))
    );
  }, [properties, filter]);
  
  const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);

  const paginatedData = React.useMemo(() => {
    return filteredData.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);
  }, [filteredData, currentPage]);
  
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filter]);

  const handleViewBill = (property: Property) => {
    sessionStorage.setItem('selectedPropertyIdsForPrinting', JSON.stringify([property.id]));
    sessionStorage.setItem('printDemandMode', 'false');
    sessionStorage.setItem('printNoticeType', 'PROPERTY_RATE');
    router.push('/properties/print-preview');
  };

  const handleFile = (file: File | undefined) => {
    if (importStatus.inProgress) return;
    if (!file) return;
    
    setImportStatus({ inProgress: true, total: 0, processed: 0 });
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const fileData = e.target?.result;
        const workbook = XLSX.read(fileData, { type: 'array', cellDates: true });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
        
        let headerRowIndex = rows.findIndex(row => (row || []).filter(cell => cell !== null && String(cell).trim() !== '').length >= 3);
        if (headerRowIndex === -1) throw new Error("No header row found.");

        const headerRow = rows[headerRowIndex];
        const dataRows = rows.slice(headerRowIndex + 1);
        const validIndices = headerRow.map((h, i) => ({ header: String(h || '').trim(), index: i })).filter(h => h.header && !h.header.toLowerCase().startsWith('__empty'));
        
        setImportStatus(prev => ({ ...prev, total: dataRows.length }));
        let allNewData: Property[] = [];
        let currentIndex = 0;
        
        const processChunk = () => {
          if (currentIndex >= dataRows.length) {
            setProperties(allNewData, Array.from(new Set([...DEFAULT_SYSTEM_HEADERS, ...validIndices.map(h => h.header)])));
            setImportStatus({ inProgress: false, total: 0, processed: 0 });
            toast({ title: 'Import Successful', description: `${allNewData.length} records loaded.` });
            return;
          }
          const nextIndex = Math.min(currentIndex + IMPORT_CHUNK_SIZE, dataRows.length);
          dataRows.slice(currentIndex, nextIndex).forEach((row, i) => {
            if (!row || row.every(c => c === null)) return;
            const rowData: any = { id: `imp-${Date.now()}-${currentIndex + i}` };
            validIndices.forEach(({ header, index }) => { 
                let val = row[index];
                const isCurrencyHeader = !['Property No', 'Account Number', 'Valuation List No.', 'Phone Number', 'S/N', 'SN', 'ID', 'Town', 'Suburb', 'Owner', 'Type'].some(k => header.toLowerCase().includes(k.toLowerCase()));
                const isRateImpost = header.toLowerCase().includes('rate impost');
                
                if (isCurrencyHeader && !isRateImpost) {
                    rowData[header] = parseNumeric(val);
                } else {
                    rowData[header] = val;
                }
            });
            allNewData.push(rowData);
          });
          setImportStatus(p => ({ ...p, processed: nextIndex }));
          currentIndex = nextIndex;
          setTimeout(processChunk, 0);
        };
        processChunk();
      } catch (err: any) {
        setImportStatus({ inProgress: false, total: 0, processed: 0 });
        toast({ variant: 'destructive', title: 'Import Error', description: err.message });
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleDeleteRow = (id: string) => {
    deleteProperty(id);
    toast({ title: 'Property Deleted' });
  }

  return (
    <>
      <input type="file" ref={fileInputRef} onChange={e => handleFile(e.target.files?.[0])} style={{ display: 'none' }} accept=".xlsx, .xls" />
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Properties</h1>
        {!isViewer && 
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importStatus.inProgress}>
              {importStatus.inProgress ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <FileUp className="mr-2 h-4 w-4" />}
              Import
            </Button>
            <Button size="sm" onClick={() => router.push('/properties/new')}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add Property
            </Button>
          </div>
        }
      </div>
      
      {loading ? <div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div> : (
        <div onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); handleFile(e.dataTransfer.files[0]); }}>
          <Card>
            <CardHeader>
              <CardTitle>Manage Properties</CardTitle>
              <CardDescription>View and manage {properties.length} imported properties.</CardDescription>
              <Input placeholder="Filter properties..." value={filter} onChange={e => setFilter(e.target.value)} className="max-w-sm mt-4" />
            </CardHeader>
            <CardContent>
              <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {DEFAULT_SYSTEM_HEADERS.map(h => <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>)}
                      {!isViewer && <TableHead><span className="sr-only">Actions</span></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedData.map((row) => (
                      <TableRow key={row.id}>
                        {DEFAULT_SYSTEM_HEADERS.map((h, i) => (
                          <TableCell key={h} className={cn(i === 1 ? 'font-bold' : '', "whitespace-nowrap")}>
                            {formatValue(getPropertyValue(row, h), h)}
                          </TableCell>
                        ))}
                        {!isViewer && 
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => setViewingPaymentsProperty(row)}><Wallet className="mr-2 h-4 w-4" /> Payments</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => handleViewBill(row)}><View className="mr-2 h-4 w-4" /> View Bill</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setEditingProperty(row)}><FilePenLine className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => handleDeleteRow(row.id)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4" /> Delete</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        }
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            {totalPages > 1 && (
              <CardFooter className="flex justify-between items-center border-t pt-4">
                <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
                </div>
              </CardFooter>
            )}
          </Card>
        </div>
      )}

      <EditPropertyDialog property={editingProperty} isOpen={!!editingProperty} onOpenChange={open => !open && setEditingProperty(null)} onPropertyUpdate={updateProperty} />
      <PropertyPaymentHistoryDialog property={viewingPaymentsProperty} isOpen={!!viewingPaymentsProperty} onOpenChange={open => !open && setViewingPaymentsProperty(null)} />
    </>
  );
}