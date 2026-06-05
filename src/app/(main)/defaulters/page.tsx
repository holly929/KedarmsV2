'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Printer } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { usePropertyData } from '@/context/PropertyDataContext';
import { useBopData } from '@/context/BopDataContext';
import { getBillStatus, getBopBillStatus } from '@/lib/billing-utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { getPropertyValue } from '@/lib/property-utils';
import { useAuth } from '@/context/AuthContext';

const ROWS_PER_PAGE = 15;

function DefaulterList({ data, headers, title }: { data: any[], headers: string[], isMobile: boolean, title: string, isViewer: boolean }) {
    const router = useRouter();
    const [filter, setFilter] = React.useState('');
    const [currentPage, setCurrentPage] = React.useState(1);
    const [selectedRows, setSelectedRows] = React.useState<string[]>([]);

    const filteredData = React.useMemo(() => {
        if (!filter) return data;
        const lower = filter.toLowerCase();
        return data.filter(row => Object.values(row).some(v => String(v).toLowerCase().includes(lower)));
    }, [data, filter]);

    const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);
    const paginatedData = React.useMemo(() => filteredData.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE), [filteredData, currentPage]);
    
    React.useEffect(() => { setCurrentPage(1); setSelectedRows([]); }, [filteredData]);

    const handleBulkPrint = () => {
      if (selectedRows.length === 0) return;
      // Use sessionStorage for print selections to avoid QuotaExceededError on localStorage
      const storageKey = title === 'property' ? 'selectedPropertyIdsForPrinting' : 'selectedBopIdsForPrinting';
      sessionStorage.setItem(storageKey, JSON.stringify(selectedRows));
      sessionStorage.setItem('printDemandMode', 'true');
      sessionStorage.setItem('printNoticeType', title.toUpperCase());
      router.push(title === 'property' ? '/properties/print-preview' : '/bop/print-preview');
    };

    return (
        <Card>
            <CardHeader className="flex flex-col sm:flex-row items-center justify-between gap-4">
                <div><CardTitle>Defaulter List</CardTitle></div>
                <div className="flex items-center gap-2">
                    <Input placeholder="Filter list..." value={filter} onChange={e => setFilter(e.target.value)} className="w-full sm:max-w-xs" />
                    {selectedRows.length > 0 && <Button variant="outline" size="sm" onClick={handleBulkPrint}><Printer className="mr-2 h-4 w-4" /> Print Notices ({selectedRows.length})</Button>}
                </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]"><Checkbox checked={selectedRows.length === filteredData.length && filteredData.length > 0} onCheckedChange={c => setSelectedRows(c ? filteredData.map(r => r.id) : [])} /></TableHead>
                    <TableHead>Status</TableHead>
                    {headers.map(h => <TableHead key={h}>{h}</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedData.map(row => (
                    <TableRow key={row.id}>
                      <TableCell><Checkbox checked={selectedRows.includes(row.id)} onCheckedChange={c => setSelectedRows(p => c ? [...p, row.id] : p.filter(rid => rid !== row.id))} /></TableCell>
                      <TableCell><Badge variant="destructive">{row.status}</Badge></TableCell>
                      {headers.map(h => <TableCell key={h}>{String(getPropertyValue(row, h) ?? '')}</TableCell>)}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
        </Card>
    );
}

export default function DefaultersPage() {
  const { properties, headers: pHeaders } = usePropertyData();
  const { bopData, headers: bHeaders } = useBopData();
  const { user } = useAuth();
  const isViewer = user?.role === 'Viewer';
  const isMobile = useIsMobile();

  const propertyDefaulters = React.useMemo(() => properties.map(p => ({ ...p, status: getBillStatus(p) })).filter(p => p.status === 'Overdue' || p.status === 'Pending'), [properties]);
  const bopDefaulters = React.useMemo(() => bopData.map(b => ({ ...b, status: getBopBillStatus(b) })).filter(b => b.status === 'Overdue' || b.status === 'Pending'), [bopData]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight font-headline">Defaulters & Enforcement</h1>
      <Tabs defaultValue="properties">
        <TabsList><TabsTrigger value="properties">Property Rates ({propertyDefaulters.length})</TabsTrigger><TabsTrigger value="bop">BOP ({bopDefaulters.length})</TabsTrigger></TabsList>
        <TabsContent value="properties"><DefaulterList data={propertyDefaulters} headers={pHeaders} isMobile={isMobile} title="property" isViewer={isViewer} /></TabsContent>
        <TabsContent value="bop"><DefaulterList data={bopDefaulters} headers={bHeaders} isMobile={isMobile} title="bop" isViewer={isViewer} /></TabsContent>
      </Tabs>
    </div>
  );
}