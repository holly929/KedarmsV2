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
  Banknote,
  FileWarning,
  MapPin,
  Search,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Property, PropertyWithStatus, BillStatus } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { getBillStatus } from '@/lib/billing-utils';
import { usePropertyData } from '@/context/PropertyDataContext';
import { useAuth } from '@/context/AuthContext';
import { EditPropertyDialog } from '@/components/edit-property-dialog';
import { getPropertyValue } from '@/lib/property-utils';
import { SmsDialog } from '@/components/sms-dialog';
import { ManualPaymentDialog } from '@/components/manual-payment-dialog';

const ROWS_PER_PAGE = 15;

const formatValue = (value: any, header: string) => {
    if (value === undefined || value === null || String(value).trim() === '') return '0.00';
    const skipFormatting = ['Property No', 'Account Number', 'Valuation List No.', 'Phone Number', 'S/N', 'ID', 'Town', 'Suburb', 'Owner', 'Type'];
    const isCurrencyHeader = !skipFormatting.some(k => header.toLowerCase().includes(k.toLowerCase()));
    const num = typeof value === 'number' ? value : Number(String(value).replace(/,/g, ''));
    if (!isNaN(num) && isCurrencyHeader) {
        return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return String(value);
}

export default function BillingPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { user: authUser } = useAuth();
  const isViewer = authUser?.role === 'Viewer';
  
  const { properties, updateProperty, deleteProperties } = usePropertyData();
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState('');
  const [activeTab, setActiveTab] = React.useState('all');
  const [selectedTown, setSelectedTown] = React.useState('all');
  const [selectedSuburb, setSelectedSuburb] = React.useState('all');
  const [editingProperty, setEditingProperty] = React.useState<Property | null>(null);
  const [paymentItem, setPaymentItem] = React.useState<Property | null>(null);
  const [smsItems, setSmsItems] = React.useState<Property[]>([]);
  const [isSmsDialogOpen, setIsSmsDialogOpen] = React.useState(false);
  const [selectedRows, setSelectedRows] = React.useState<string[]>([]);

  const isMobile = useIsMobile();
  const [currentPage, setCurrentPage] = React.useState(1);

  React.useEffect(() => {
    if (properties.length >= 0) setLoading(false);
  }, [properties]);

  const handleViewBill = (property: Property, isDemand: boolean = false) => {
    const type = getPropertyValue(property, 'Type')?.toLowerCase().includes('bop') ? 'BOP' : 'PROPERTY_RATE';
    // Use sessionStorage for print selections to avoid QuotaExceededError on localStorage
    sessionStorage.setItem('selectedPropertyIdsForPrinting', JSON.stringify([property.id]));
    sessionStorage.setItem('printDemandMode', isDemand ? 'true' : 'false');
    sessionStorage.setItem('printNoticeType', type);
    router.push('/properties/print-preview');
  };

  const handlePrintSelected = () => {
    if (selectedRows.length > 0) {
      const type = getPropertyValue(selectedProperties[0], 'Type')?.toLowerCase().includes('bop') ? 'BOP' : 'PROPERTY_RATE';
      // Use sessionStorage for print selections to avoid QuotaExceededError on localStorage
      sessionStorage.setItem('selectedPropertyIdsForPrinting', JSON.stringify(selectedRows));
      sessionStorage.setItem('printDemandMode', 'false');
      sessionStorage.setItem('printNoticeType', type);
      router.push('/properties/print-preview');
    } else {
      toast({
        variant: 'destructive',
        title: 'No Properties Selected',
        description: 'Please select at least one property to print.',
      });
    }
  };

  const handlePropertyUpdate = (updatedProperty: Property) => {
    updateProperty(updatedProperty);
    setEditingProperty(null);
    toast({ title: 'Record Updated' });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRows(filteredData.map(row => row.id));
    } else {
      setSelectedRows([]);
    }
  };
  
  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedRows(prev => [...prev, id]);
    } else {
      setSelectedRows(prev => prev.filter(rowId => rowId !== id));
    }
  };

  const selectedProperties = React.useMemo(() => {
    return properties.filter(row => selectedRows.includes(row.id));
  }, [properties, selectedRows]);

  const towns = React.useMemo(() => {
    const set = new Set<string>();
    properties.forEach(p => {
        const t = getPropertyValue(p, 'Town');
        if (t && String(t).trim() !== '' && String(t) !== '0' && String(t) !== '00') set.add(String(t).trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [properties]);

  const suburbs = React.useMemo(() => {
    const set = new Set<string>();
    properties.forEach(p => {
        const t = getPropertyValue(p, 'Town');
        const s = getPropertyValue(p, 'Suburb');
        if (s && String(s).trim() !== '' && String(s) !== '0' && String(s) !== '00' && (selectedTown === 'all' || String(t).trim().toUpperCase() === selectedTown)) {
            set.add(String(s).trim().toUpperCase());
        }
    });
    return Array.from(set).sort();
  }, [properties, selectedTown]);

  const handleDeleteSelected = () => {
    deleteProperties(selectedRows);
    toast({ title: 'Properties Deleted', description: `${selectedRows.length} records have been removed.` });
    setSelectedRows([]);
  }

  const propertiesWithStatus = React.useMemo<PropertyWithStatus[]>(() => {
    return properties.map(p => ({ ...p, status: getBillStatus(p) }));
  }, [properties]);

  const filteredData = React.useMemo(() => {
    let intermediateData = propertiesWithStatus;
    if (activeTab !== 'all') intermediateData = intermediateData.filter(p => p.status.toLowerCase() === activeTab);
    
    if (selectedTown !== 'all') {
        intermediateData = intermediateData.filter(p => String(getPropertyValue(p, 'Town')).trim().toUpperCase() === selectedTown);
    }
    
    if (selectedSuburb !== 'all') {
        intermediateData = intermediateData.filter(p => String(getPropertyValue(p, 'Suburb')).trim().toUpperCase() === selectedSuburb);
    }

    if (!filter) return intermediateData;
    return intermediateData.filter((row) =>
      Object.entries(row).some(([key, value]) =>
        key !== 'id' && String(value).toLowerCase().includes(filter.toLowerCase())
      )
    );
  }, [propertiesWithStatus, filter, activeTab, selectedTown, selectedSuburb]);

  const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);

  React.useEffect(() => {
    setCurrentPage(1);
    setSelectedRows([]);
  }, [activeTab, filter, selectedTown, selectedSuburb]);

  const paginatedData = React.useMemo(() => {
    return filteredData.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);
  }, [filteredData, currentPage]);
  
  const statusVariant = (status: BillStatus) => {
      switch(String(status).toLowerCase()) {
          case 'paid': return 'default' as const;
          case 'pending': return 'secondary' as const;
          case 'overdue': return 'destructive' as const;
          default: return 'outline' as const;
      }
  }

  const handleSendBulkSms = () => {
    if (selectedRows.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Records Selected',
        description: 'Please select records to send SMS to.',
      });
      return;
    }
    setSmsItems(selectedProperties);
    setIsSmsDialogOpen(true);
  };

  const handleSendSingleSms = (property: Property) => {
      setSmsItems([property]);
      setIsSmsDialogOpen(true);
  };

  const isAllFilteredSelected = filteredData.length > 0 && selectedRows.length === filteredData.length;
  const isSomeRowsSelected = selectedRows.length > 0 && selectedRows.length < filteredData.length;

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <>
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Billing & Payments</h1>
      </div>
      <Tabs defaultValue="all" onValueChange={setActiveTab}>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="paid">Paid</TabsTrigger>
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="overdue">Overdue</TabsTrigger>
            </TabsList>
            
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 w-full md:w-auto">
                <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search records..." 
                        value={filter} 
                        onChange={(e) => setFilter(e.target.value)} 
                        className="pl-8 w-full md:max-w-xs"
                    />
                </div>
                {selectedRows.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={handlePrintSelected}>
                        <Printer className="h-4 w-4 mr-2"/>
                        Print ({selectedRows.length})
                    </Button>
                    {!isViewer && (
                        <>
                        <Button variant="outline" size="sm" onClick={handleSendBulkSms}>
                            <MessageSquare className="h-4 w-4 mr-2"/>
                            Send SMS ({selectedRows.length})
                        </Button>
                        <Button variant="destructive" size="sm" onClick={handleDeleteSelected}>
                            <Trash2 className="h-4 w-4 mr-2"/>
                            Delete ({selectedRows.length})
                        </Button>
                        </>
                    )}
                    </div>
                )}
            </div>
          </div>

          <Card className="bg-muted/20 border-dashed">
            <CardContent className="p-4 flex flex-col md:flex-row items-end gap-4">
                <div className="grid gap-1.5 flex-1">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> Filter by Town
                    </label>
                    <Select value={selectedTown} onValueChange={(v) => { setSelectedTown(v); setSelectedSuburb('all'); }}>
                        <SelectTrigger className="bg-background h-9">
                            <SelectValue placeholder="All Towns" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Towns</SelectItem>
                            {towns.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-1.5 flex-1">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> Filter by Suburb
                    </label>
                    <Select value={selectedSuburb} onValueChange={setSelectedSuburb}>
                        <SelectTrigger className="bg-background h-9">
                            <SelectValue placeholder="All Suburbs" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Suburbs</SelectItem>
                            {suburbs.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                {(selectedTown !== 'all' || selectedSuburb !== 'all') && (
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedTown('all'); setSelectedSuburb('all'); }} className="h-9">
                        Clear Filters
                    </Button>
                )}
            </CardContent>
          </Card>
        </div>

        <TabsContent value="all">
            <Card>
                <CardHeader>
                <CardTitle>Properties</CardTitle>
                <CardDescription>View status and manage payments for filtered records.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]">
                                <Checkbox
                                  checked={isAllFilteredSelected ? true : isSomeRowsSelected ? 'indeterminate' : false}
                                  onCheckedChange={(checked) => handleSelectAll(!!checked)}
                                  aria-label="Select all rows"
                                />
                            </TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Owner</TableHead>
                            <TableHead>Location</TableHead>
                            <TableHead>Property No</TableHead>
                            <TableHead className="text-right">Amt Paid</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {paginatedData.map((row) => (
                            <TableRow key={row.id} data-state={selectedRows.includes(row.id) ? "selected" : undefined}>
                                <TableCell>
                                    <Checkbox
                                      checked={selectedRows.includes(row.id)}
                                      onCheckedChange={(checked) => handleSelectRow(row.id, !!checked)}
                                      aria-label={`Select row ${row.id}`}
                                    />
                                </TableCell>
                                <TableCell><Badge variant={statusVariant(row.status)}>{row.status}</Badge></TableCell>
                                <TableCell className="font-medium">{getPropertyValue(row, 'Owner Name')}</TableCell>
                                <TableCell className="text-xs">
                                    <div className="font-semibold">{getPropertyValue(row, 'Town')}</div>
                                    <div className="text-muted-foreground">{getPropertyValue(row, 'Suburb')}</div>
                                </TableCell>
                                <TableCell>{getPropertyValue(row, 'Property No')}</TableCell>
                                <TableCell className="text-right">{formatValue(getPropertyValue(row, 'Total Payment'), 'Total Payment')}</TableCell>
                                <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                    <DropdownMenuItem onSelect={() => handleViewBill(row, false)}>
                                      <View className="mr-2 h-4 w-4" /> 
                                      View Bill
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => handleViewBill(row, true)} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                                      <FileWarning className="mr-2 h-4 w-4" /> 
                                      View Demand Notice
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => handleSendSingleSms(row)}><MessageSquare className="mr-2 h-4 w-4" /> Send SMS</DropdownMenuItem>
                                    {!isViewer && (
                                        <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onSelect={() => setPaymentItem(row)}><Banknote className="mr-2 h-4 w-4" /> Record Payment</DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => setEditingProperty(row)}><FilePenLine className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                        </>
                                    )}
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
                    <span className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages} ({filteredData.length} total records)
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
        </TabsContent>
      </Tabs>
      
      <EditPropertyDialog property={editingProperty} isOpen={!!editingProperty} onOpenChange={(open) => !open && setEditingProperty(null)} onPropertyUpdate={handlePropertyUpdate} />
      <ManualPaymentDialog item={paymentItem} type="property" isOpen={!!paymentItem} onOpenChange={(open) => !open && setPaymentItem(null)} />
      <SmsDialog isOpen={isSmsDialogOpen} onOpenChange={setIsSmsDialogOpen} selectedProperties={smsItems} />
    </>
  );
}