'use client';

import * as React from 'react';
import { Download, Loader2, Calendar, Filter, Search, Banknote, Printer } from 'lucide-react';
import * as XLSX from 'xlsx';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePropertyData } from '@/context/PropertyDataContext';
import { useBopData } from '@/context/BopDataContext';
import { useLicenseData } from '@/context/LicenseDataContext';
import { useRequirePermission } from '@/hooks/useRequirePermission';
import type { FlatTransaction, Property, Bop, License } from '@/lib/types';
import { getPropertyValue } from '@/lib/property-utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { useToast } from '@/hooks/use-toast';
import { ReceiptDialog } from '@/components/receipt-dialog';

const ROWS_PER_PAGE = 20;

const formatCurrency = (value: number) => `GHS ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = (isoString: string) => new Date(isoString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

export default function TransactionsPage() {
  useRequirePermission();
  const { properties } = usePropertyData();
  const { bopData } = useBopData();
  const { licenseData } = useLicenseData();
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState('');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [typeFilter, setTypeFilter] = React.useState('all');
  const [currentPage, setCurrentPage] = React.useState(1);
  
  const [receiptItem, setReceiptItem] = React.useState<{item: any, payment: any} | null>(null);

  React.useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 500);
    return () => clearTimeout(timer);
  }, []);

  const allTransactions = React.useMemo(() => {
    const transactions: FlatTransaction[] = [];

    properties.forEach(p => {
        (p.payments || []).forEach(pay => {
            transactions.push({
                ...pay,
                sourceId: p.id,
                sourceName: getPropertyValue(p, 'Owner Name') || 'N/A',
                sourceType: 'property',
                identifier: getPropertyValue(p, 'Property No') || 'N/A',
                rawItem: p
            } as any);
        });
    });

    bopData.forEach(b => {
        (b.payments || []).forEach(pay => {
            transactions.push({
                ...pay,
                sourceId: b.id,
                sourceName: getPropertyValue(b, 'Business Name') || 'N/A',
                sourceType: 'bop',
                identifier: getPropertyValue(b, 'Owner Name') || 'N/A',
                rawItem: b
            } as any);
        });
    });

    licenseData.forEach(l => {
        (l.payments || []).forEach(pay => {
            transactions.push({
                ...pay,
                sourceId: l.id,
                sourceName: getPropertyValue(l, 'Name of Hotel/Guest House') || 'N/A',
                sourceType: 'license',
                identifier: getPropertyValue(l, 'S/N') || 'N/A',
                rawItem: l
            } as any);
        });
    });

    return transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [properties, bopData, licenseData]);

  const filteredData = React.useMemo(() => {
    return allTransactions.filter(tx => {
        const matchesSearch = 
            tx.sourceName.toLowerCase().includes(filter.toLowerCase()) || 
            tx.identifier.toLowerCase().includes(filter.toLowerCase()) ||
            (tx.reference || '').toLowerCase().includes(filter.toLowerCase());
        
        const matchesType = typeFilter === 'all' || tx.sourceType === typeFilter;
        
        let matchesDate = true;
        if (startDate) {
            matchesDate = matchesDate && new Date(tx.date) >= new Date(startDate);
        }
        if (endDate) {
            const end = new Date(endDate);
            end.setHours(23, 59, 59, 999);
            matchesDate = matchesDate && new Date(tx.date) <= end;
        }

        return matchesSearch && matchesType && matchesDate;
    });
  }, [allTransactions, filter, typeFilter, startDate, endDate]);

  const paginatedData = React.useMemo(() => {
    return filteredData.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);
  }, [filteredData, currentPage]);

  const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);

  const handleExport = () => {
    if (filteredData.length === 0) {
        toast({ variant: 'destructive', title: 'No Data', description: 'No transactions found.' });
        return;
    }
    
    const exportRows = filteredData.map(tx => ({
        Date: formatDate(tx.date),
        'Source Type': tx.sourceType.toUpperCase(),
        Identifier: tx.identifier,
        'Payer Name': tx.sourceName,
        'Amount (GHS)': tx.amount,
        Method: tx.method,
        'Reference No': tx.reference || 'N/A',
        'Recorded By': tx.recordedBy || 'System'
    }));

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Transactions');
    XLSX.writeFile(workbook, `Transactions_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({ title: 'Export Successful' });
  };

  const totalCollectedInView = React.useMemo(() => {
      return filteredData.reduce((sum, tx) => sum + tx.amount, 0);
  }, [filteredData]);

  const handlePrintReceipt = (tx: FlatTransaction) => {
      setReceiptItem({ item: (tx as any).rawItem, payment: tx });
  };

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Transaction History</h1>
        <Button onClick={handleExport} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export Ledger
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="md:col-span-1 border-primary/20 bg-primary/[0.02]">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Collection (Filtered)</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold text-primary">{formatCurrency(totalCollectedInView)}</div>
                <p className="text-xs text-muted-foreground">{filteredData.length} transactions listed</p>
            </CardContent>
        </Card>
        
        <Card className="md:col-span-3">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2"><Filter className="h-4 w-4" /> Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Search</label>
                <Input placeholder="Payer, ID, Ref..." value={filter} onChange={e => setFilter(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Type</label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="h-9">
                        <SelectValue placeholder="All Types" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Modules</SelectItem>
                        <SelectItem value="property">Property Rates</SelectItem>
                        <SelectItem value="bop">BOP</SelectItem>
                        <SelectItem value="license">Hotels</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">Start Date</label>
                <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground">End Date</label>
                <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Identifier</TableHead>
                <TableHead>Payer</TableHead>
                <TableHead>Method</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedData.length > 0 ? paginatedData.map(tx => (
                <TableRow key={tx.id}>
                  <TableCell className="text-xs">{formatDate(tx.date)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-[10px]">
                      {tx.sourceType === 'license' ? 'Hotel' : tx.sourceType}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-[10px]">{tx.identifier}</TableCell>
                  <TableCell className="font-medium text-xs truncate max-w-[150px]">{tx.sourceName}</TableCell>
                  <TableCell className="text-xs capitalize">{tx.method}</TableCell>
                  <TableCell className="text-right font-bold font-mono">{formatCurrency(tx.amount)}</TableCell>
                  <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => handlePrintReceipt(tx)} title="Reprint Receipt">
                        <Printer className="h-4 w-4" />
                      </Button>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-48 text-center text-muted-foreground italic">
                    No transactions found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        {totalPages > 1 && (
            <CardFooter className="flex justify-between items-center border-t p-4">
                <p className="text-xs text-muted-foreground">Showing {paginatedData.length} of {filteredData.length}</p>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
                </div>
            </CardFooter>
        )}
      </Card>

      {receiptItem && (
          <ReceiptDialog 
            isOpen={!!receiptItem} 
            onOpenChange={(open) => !open && setReceiptItem(null)}
            payment={receiptItem.payment}
            item={receiptItem.item}
          />
      )}
    </>
  );
}
