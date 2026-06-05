'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import {
  MoreHorizontal,
  Printer,
  Trash2,
  View,
  FilePenLine,
  Loader2,
  MessageSquare,
  Store,
  CreditCard,
  FileWarning,
  Banknote,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import type { Bop } from '@/lib/types';
import type { BopWithStatus, BillStatus } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { getBopBillStatus } from '@/lib/billing-utils';
import { useBopData } from '@/context/BopDataContext';
import { useAuth } from '@/context/AuthContext';
import { EditBopDialog } from '@/components/edit-bop-dialog';
import { getPropertyValue } from '@/lib/property-utils';
import { SmsDialog } from '@/components/sms-dialog';
import { ManualPaymentDialog } from '@/components/manual-payment-dialog';

const ROWS_PER_PAGE = 15;

export default function BopBillingPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { user: authUser } = useAuth();
  const isViewer = authUser?.role === 'Viewer';
  
  const { bopData, headers, updateBop, deleteBop, deleteBops } = useBopData();
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState('');
  const [activeTab, setActiveTab] = React.useState('all');
  const [editingBop, setEditingBop] = React.useState<Bop | null>(null);
  const [paymentItem, setPaymentItem] = React.useState<Bop | null>(null);
  const [smsItems, setSmsItems] = React.useState<Bop[]>([]);
  const [selectedRows, setSelectedRows] = React.useState<string[]>([]);
  const isMobile = useIsMobile();
  const [currentPage, setCurrentPage] = React.useState(1);
  const [isSmsDialogOpen, setIsSmsDialogOpen] = React.useState(false);
  
  React.useEffect(() => {
    if (bopData.length >= 0) setLoading(false);
  }, [bopData]);

  const handleViewBill = (bop: Bop, isDemand: boolean = false) => {
    // Use sessionStorage for print selections to avoid QuotaExceededError on localStorage
    sessionStorage.setItem('selectedBopIdsForPrinting', JSON.stringify([bop.id]));
    sessionStorage.setItem('printDemandMode', isDemand ? 'true' : 'false');
    router.push('/bop/print-preview');
  };
  
  const handlePrintSelected = () => {
    if (selectedRows.length > 0) {
      // Use sessionStorage for print selections to avoid QuotaExceededError on localStorage
      sessionStorage.setItem('selectedBopIdsForPrinting', JSON.stringify(selectedRows));
      sessionStorage.setItem('printDemandMode', 'false');
      router.push('/bop/print-preview');
    } else {
      toast({ variant: 'destructive', title: 'No BOP Records Selected' });
    }
  };

  const bopsWithStatus = React.useMemo<BopWithStatus[]>(() => {
    return bopData.map(p => ({ ...p, status: getBopBillStatus(p) }));
  }, [bopData]);

  const filteredData = React.useMemo(() => {
    let data = bopsWithStatus;
    if (activeTab !== 'all') data = data.filter(p => p.status.toLowerCase() === activeTab);
    if (!filter) return data;
    const lower = filter.toLowerCase();
    return data.filter(row => Object.values(row).some(v => String(v).toLowerCase().includes(lower)));
  }, [bopsWithStatus, filter, activeTab]);

  const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);
  const paginatedData = React.useMemo(() => filteredData.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE), [filteredData, currentPage]);
  
  React.useEffect(() => { setCurrentPage(1); }, [activeTab, filter]);

  const handleSelectAll = (checked: boolean) => setSelectedRows(checked ? filteredData.map(r => r.id) : []);
  const handleSelectRow = (id: string, checked: boolean) => setSelectedRows(p => checked ? [...p, id] : p.filter(rid => rid !== id));

  const statusVariant = (status: BillStatus) => {
      switch(String(status).toLowerCase()) {
          case 'paid': return 'default' as const;
          case 'pending': return 'secondary' as const;
          case 'overdue': return 'destructive' as const;
          default: return 'outline' as const;
      }
  }

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <>
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight font-headline">BOP Billing</h1>
      </div>
      <Tabs defaultValue="all" onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="paid">Paid</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="overdue">Overdue</TabsTrigger>
          </TabsList>
           <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 w-full">
                <Input placeholder="Filter data..." value={filter} onChange={e => setFilter(e.target.value)} className="w-full md:max-w-xs" />
                {selectedRows.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button variant="outline" size="sm" onClick={handlePrintSelected}><Printer className="h-4 w-4 mr-2"/>Print ({selectedRows.length})</Button>
                        {!isViewer && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => { setSmsItems(bopData.filter(r => selectedRows.includes(r.id))); setIsSmsDialogOpen(true); }}><MessageSquare className="h-4 w-4 mr-2"/>SMS ({selectedRows.length})</Button>
                            <Button variant="destructive" size="sm" onClick={() => { deleteBops(selectedRows); setSelectedRows([]); }}><Trash2 className="h-4 w-4 mr-2"/>Delete ({selectedRows.length})</Button>
                          </>
                        )}
                    </div>
                )}
            </div>
        </div>
        <TabsContent value={activeTab}>
            <Card>
                <CardHeader><CardTitle>Business Operating Permits</CardTitle></CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]"><Checkbox checked={selectedRows.length === filteredData.length && filteredData.length > 0} onCheckedChange={c => handleSelectAll(!!c)} /></TableHead>
                        <TableHead>Status</TableHead>
                        {headers.map(h => <TableHead key={h}>{h}</TableHead>)}
                        <TableHead><span className="sr-only">Actions</span></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedData.map(row => (
                        <TableRow key={row.id}>
                          <TableCell><Checkbox checked={selectedRows.includes(row.id)} onCheckedChange={c => handleSelectRow(row.id, !!c)} /></TableCell>
                          <TableCell><Badge variant={statusVariant(row.status)}>{row.status}</Badge></TableCell>
                          {headers.map(h => <TableCell key={h}>{String(getPropertyValue(row, h) ?? '')}</TableCell>)}
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild><Button size="icon" variant="ghost"><MoreHorizontal /></Button></DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={() => handleViewBill(row)}><View className="mr-2 h-4 w-4" /> View Bill</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setPaymentItem(row)}><Banknote className="mr-2 h-4 w-4" /> Record Payment</DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => setEditingBop(row)}><FilePenLine className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
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
        </TabsContent>
      </Tabs>
      <EditBopDialog bop={editingBop} isOpen={!!editingBop} onOpenChange={o => !o && setEditingBop(null)} onBopUpdate={updateBop} />
      <ManualPaymentDialog item={paymentItem} type="bop" isOpen={!!paymentItem} onOpenChange={o => !o && setPaymentItem(null)} />
      <SmsDialog isOpen={isSmsDialogOpen} onOpenChange={setIsSmsDialogOpen} selectedProperties={smsItems} />
    </>
  );
}