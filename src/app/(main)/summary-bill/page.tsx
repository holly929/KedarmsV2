
'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  FileUp,
  Trash2,
  Loader2,
  UploadCloud,
  Printer,
  BookCopy,
  AlertCircle,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
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
} from "@/components/ui/alert-dialog";
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSummaryBillData } from '@/context/SummaryBillContext';
import { useAuth } from '@/context/AuthContext';
import { useRequirePermission } from '@/hooks/useRequirePermission';
import type { Bop as SummaryBillData } from '@/lib/types';
import { store } from '@/lib/store';

const ROWS_PER_PAGE = 15;

const getEditableSheetUrl = (originalUrl: string): string => {
  if (!originalUrl) return '';
  const regex = /spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
  const match = originalUrl.match(regex);
  if (match && match[1]) {
    const sheetId = match[1];
    return `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
  }
  return originalUrl;
};


function GoogleSheetIntegrationView() {
  const [sheetUrl, setSheetUrl] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    setIsLoading(true);
    const integrationsSettings = store.settings.integrationsSettings;
    if (integrationsSettings && integrationsSettings.summaryBillGoogleSheetUrl) {
      setSheetUrl(getEditableSheetUrl(integrationsSettings.summaryBillGoogleSheetUrl));
    }
    setIsLoading(false);
  }, []);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Connected Summary Bill Sheet</CardTitle>
        <CardDescription>View and edit your connected summary bill spreadsheet directly.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-64 items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : sheetUrl ? (
          <div className="space-y-4">
             <Alert>
              <Printer className="h-4 w-4" />
              <AlertTitle>How to Print</AlertTitle>
              <AlertDescription>
                To print your data with the app&apos;s formatting, please follow these steps:
                <ol className="list-decimal list-inside mt-2 space-y-1">
                  <li>In the Google Sheet below, go to <strong>File &gt; Download &gt; Microsoft Excel (.xlsx)</strong>.</li>
                  <li>Switch to the &quot;Upload Excel&quot; tab on this page.</li>
                  <li>Upload the downloaded file. You will then be able to print it.</li>
                </ol>
              </AlertDescription>
            </Alert>
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Having trouble viewing or editing?</AlertTitle>
              <AlertDescription>
                To interact with the sheet, you must be logged into the correct Google account in this browser. If it doesn&apos;t load, try opening it in a new tab first, then refresh this page.
              </AlertDescription>
            </Alert>
            <div className="aspect-video w-full rounded-lg border">
              <iframe src={sheetUrl} className="w-full h-full" frameBorder="0" title="Embedded Google Sheet" sandbox="allow-scripts allow-same-origin allow-forms allow-popups">Loading...</iframe>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center h-[calc(100vh-30rem)]">
            <BookCopy className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No Summary Bill Spreadsheet Connected</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Please go to the <Button variant="link" asChild className="p-0 h-auto"><Link href="/settings">Settings</Link></Button> page to connect a Google Sheet.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


export default function SummaryBillPage() {
  useRequirePermission();
  const { toast } = useToast();
  const router = useRouter();
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { user: authUser } = useAuth();
  const isViewer = authUser?.role === 'Viewer';

  const { workbook, setWorkbook, deleteAllSummaryBills } = useSummaryBillData();
  const [loading, setLoading] = React.useState(true);
  
  const [selectedSheet, setSelectedSheet] = React.useState<string>('');
  const [filter, setFilter] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);
  const isMobile = useIsMobile();

  const [importStatus, setImportStatus] = React.useState<{
    inProgress: boolean;
  }>({ inProgress: false });

  const [isDragging, setIsDragging] = React.useState(false);

  const sheetNames = React.useMemo(() => Object.keys(workbook), [workbook]);
  const currentSheetData = React.useMemo(() => workbook[selectedSheet]?.data || [], [workbook, selectedSheet]);
  const currentHeaders = React.useMemo(() => workbook[selectedSheet]?.headers || [], [workbook, selectedSheet]);

  React.useEffect(() => {
    setLoading(false);
  }, []);

  React.useEffect(() => {
    if (sheetNames.length > 0 && !selectedSheet) {
      setSelectedSheet(sheetNames[0]);
    } else if (sheetNames.length === 0 && selectedSheet) {
      setSelectedSheet('');
    }
  }, [sheetNames, selectedSheet]);


  const filteredData = React.useMemo(() => {
    if (!filter) return currentSheetData;
    return currentSheetData.filter((row) =>
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(filter.toLowerCase())
      )
    );
  }, [currentSheetData, filter]);
  
  const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);

  const paginatedData = React.useMemo(() => {
    return filteredData.slice(
      (currentPage - 1) * ROWS_PER_PAGE,
      currentPage * ROWS_PER_PAGE
    );
  }, [filteredData, currentPage]);
  
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filter, selectedSheet]);

  const handlePrint = () => {
    if (Object.keys(workbook).length > 0 && currentSheetData.length > 0) {
      localStorage.setItem('summaryBillWorkbookForPrinting', JSON.stringify(workbook));
      localStorage.setItem('activeSheetForPrinting', selectedSheet);
      router.push('/summary-bill/print-preview');
    } else {
      toast({
        variant: 'destructive',
        title: 'No Data to Print',
        description: 'Please upload an Excel file and select a sheet with data to print.',
      });
    }
  };

  const handleFile = (file: File | undefined) => {
    if (importStatus.inProgress) return;
    if (!file) {
      toast({ variant: 'destructive', title: 'File Error', description: 'No file selected.' });
      return;
    }
    if (!file.type.match(/spreadsheetml\.sheet|excel|sheet$/) && !file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast({ variant: 'destructive', title: 'Invalid File Type', description: 'Please upload an Excel file (.xlsx, .xls).' });
      return;
    }

    setImportStatus({ inProgress: true });

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const fileData = e.target?.result;
        const excelWorkbook = XLSX.read(fileData, { type: 'binary', cellDates: true });
        const newWorkbook: { [sheetName: string]: { data: SummaryBillData[], headers: string[] } } = {};
        
        excelWorkbook.SheetNames.forEach(sheetName => {
            const worksheet = excelWorkbook.Sheets[sheetName];
            
            const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null });
            if (rows.length === 0) return;

            let headerRowIndex = rows.findIndex(row => row.some(cell => cell !== null && String(cell).trim() !== ''));
            if (headerRowIndex === -1) return;

            const headerRow = rows[headerRowIndex];
            const dataRows = rows.slice(headerRowIndex + 1);

            const validHeadersWithIndices = headerRow
                .map((header, index) => ({ header: String(header || '').trim(), index }))
                .filter(h => h.header && !h.header.toLowerCase().startsWith('__empty'));

            const validHeaders = validHeadersWithIndices.map(h => h.header);
            if (validHeaders.length === 0) return;

            const sheetData = dataRows.map((row, rowIndex) => {
                if (row.every(cell => cell === null || String(cell).trim() === '')) return null;
                
                const rowData: { [key: string]: any } = { id: `summary-${sheetName}-${Date.now()}-${rowIndex}` };
                validHeadersWithIndices.forEach(({ header, index }) => {
                    rowData[header] = row[index];
                });
                return rowData as SummaryBillData;
            }).filter((row): row is SummaryBillData => row !== null);


            if (sheetData.length > 0) {
                 newWorkbook[sheetName] = { data: sheetData, headers: validHeaders };
            }
        });

        if (Object.keys(newWorkbook).length === 0) {
          throw new Error("No readable sheets with data found in the file.");
        }

        setWorkbook(newWorkbook);
        setSelectedSheet(Object.keys(newWorkbook)[0]);
        setCurrentPage(1);
        toast({ title: 'Import Successful', description: `${Object.keys(newWorkbook).length} sheet(s) loaded.` });

      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Import Error', description: error.message || 'Failed to parse the Excel file.' });
      } finally {
        setImportStatus({ inProgress: false });
      }
    };
    reader.onerror = () => {
        toast({ variant: 'destructive', title: 'File Read Error', description: 'Could not read the selected file.' });
        setImportStatus({ inProgress: false });
    }
    reader.readAsBinaryString(file);
  };
  
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(event.target.files?.[0]);
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleDragEvents = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
    handleDragEvents(e);
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    handleDragEvents(e);
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    handleDragEvents(e);
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
      e.dataTransfer.clearData();
    }
  };
  
  const handleClearAll = () => {
    deleteAllSummaryBills();
    toast({
        title: 'All Data Deleted',
        description: 'Your summary bill data has been cleared.',
    });
  };

  const renderDesktopView = () => (
    <div className="w-full overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {currentHeaders.map((header, index) => (
              <TableHead key={`${header}-${index}`}>{header}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedData.length > 0 ? (
            paginatedData.map((row) => (
              <TableRow key={row.id}>
                {currentHeaders.map((header, index) => (
                  <TableCell key={`${header}-${index}`} className={index === 0 ? 'font-medium' : ''}>
                    {String(row[header] ?? '')}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={currentHeaders.length || 1} className="h-24 text-center">
                No results found for this sheet.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );

  const renderMobileView = () => (
    <div className="space-y-4">
      {paginatedData.length > 0 ? paginatedData.map(row => (
        <Card key={row.id} className="transition-shadow hover:shadow-lg">
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <CardTitle className="text-base font-semibold">{currentHeaders.length > 0 ? String(row[currentHeaders[0]] ?? 'N/A') : 'N/A'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm pl-6 pr-6 pb-4">
            {currentHeaders.slice(1).map((header, index) => {
              const value = row[header];
              if (header.toLowerCase() === 'id' || value === null || value === undefined || String(value).trim() === '') return null;
              return (
                <div key={`${header}-${index}`} className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-muted-foreground">{header}</span>
                  <span className="text-right">{String(value)}</span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )) : (
        <div className="text-center text-muted-foreground py-12">
          <p>No results found.</p>
        </div>
      )}
    </div>
  );

  const renderDataView = () => (
    <div 
        className="relative"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragEvents}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {(isDragging || importStatus.inProgress) && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg border-2 border-dashed border-primary">
            {importStatus.inProgress ? (
              <div className="flex flex-col items-center text-center p-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4"/>
                <p className="text-lg font-medium text-foreground">Importing data...</p>
                <p className="text-sm text-muted-foreground">Please wait while we process your file.</p>
              </div>
            ) : (
              <>
                <UploadCloud className="h-12 w-12 text-primary mb-4"/>
                <p className="text-lg font-medium text-foreground">Drop your Excel file here</p>
              </>
            )}
          </div>
        )}
        <Card>
            <CardHeader>
            <CardTitle className="font-headline">Summary Bill Data</CardTitle>
            <CardDescription>
                View your imported records. Use the dropdown to switch between sheets.
            </CardDescription>
            <div className="flex flex-col sm:flex-row items-center gap-2 pt-4">
                <Input
                  placeholder="Filter data..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="max-w-full sm:max-w-xs"
                />
                 {sheetNames.length > 1 && (
                    <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                        <SelectTrigger className="w-full sm:w-[200px]">
                            <SelectValue placeholder="Select a sheet" />
                        </SelectTrigger>
                        <SelectContent>
                            {sheetNames.map(name => (
                                <SelectItem key={name} value={name}>{name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                 )}
            </div>
            </CardHeader>
            <CardContent>
            {isMobile ? renderMobileView() : renderDesktopView()}
            </CardContent>
            {totalPages > 1 && (
              <CardFooter className="flex justify-between items-center border-t pt-4">
                <span className="text-sm text-muted-foreground">
                  Page {currentPage} of {totalPages} ({filteredData.length} total records on this sheet)
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </CardFooter>
            )}
        </Card>
    </div>
  )

  const renderEmptyState = () => (
     <div 
        className="relative"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragEvents}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {(isDragging || importStatus.inProgress) && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm rounded-lg border-2 border-dashed border-primary">
            {importStatus.inProgress ? (
                 <div className="flex flex-col items-center text-center p-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary mb-4"/>
                    <p className="text-lg font-medium text-foreground">Importing data...</p>
                    <p className="text-sm text-muted-foreground">Please wait while we process your file.</p>
                </div>
            ) : (
                <>
                <UploadCloud className="h-12 w-12 text-primary mb-4"/>
                <p className="text-lg font-medium text-foreground">Drop your Excel file here</p>
                </>
            )}
            </div>
        )}
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center h-[calc(100vh-20rem)]">
            <UploadCloud className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">Import Your Summary Data</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Drag and drop an Excel file here or use the import button to get started.
            </p>
        </div>
     </div>
  )

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Summary Bill</h1>
      </div>
      
      <Tabs defaultValue="upload" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Upload Excel</TabsTrigger>
            <TabsTrigger value="google-sheet">Google Sheet Connect</TabsTrigger>
        </TabsList>
        <TabsContent value="upload" className="space-y-4">
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div/>
            <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
                {sheetNames.length > 0 && !isViewer && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm">
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete All Data
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete all imported summary bill data from all sheets.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleClearAll}>
                            Yes, delete all
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
                )}
                {!isViewer && 
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={importStatus.inProgress}>
                    {importStatus.inProgress ? <Loader2 className="h-4 w-4 mr-2 animate-spin"/> : <FileUp className="h-4 w-4 mr-2" />}
                    Import
                  </Button>
                }
                {sheetNames.length > 0 && (
                    <Button size="sm" onClick={handlePrint}>
                        <Printer className="h-4 w-4 mr-2" />
                        Print Summary
                    </Button>
                )}
            </div>
          </div>
          
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            accept=".xlsx, .xls"
            disabled={importStatus.inProgress}
          />
          
          {loading ? (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : sheetNames.length > 0 ? renderDataView() : renderEmptyState()}

        </TabsContent>
        <TabsContent value="google-sheet">
            <GoogleSheetIntegrationView />
        </TabsContent>
      </Tabs>
    </>
  );
}
