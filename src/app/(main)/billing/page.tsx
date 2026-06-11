'use client';

import * as React from 'react';
import { useRouter } from &apos;next/navigation&apos;;
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
} from &apos;lucide-react&apos;;

import { Badge } from &apos;@/components/ui/badge&apos;;
import { Button } from &apos;@/components/ui/button&apos;;
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from &apos;@/components/ui/card&apos;;
import { Checkbox } from &apos;@/components/ui/checkbox&apos;;
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from &apos;@/components/ui/dropdown-menu&apos;;
import { Input } from &apos;@/components/ui/input&apos;;
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from &apos;@/components/ui/table&apos;;
import { Tabs, TabsContent, TabsList, TabsTrigger } from &apos;@/components/ui/tabs&apos;;
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from &apos;@/components/ui/select&apos;;
import type { Property, PropertyWithStatus, BillStatus } from &apos;@/lib/types&apos;;
import { useToast } from &apos;@/hooks/use-toast&apos;;
import { useIsMobile } from &apos;@/hooks/use-mobile&apos;;
import { getBillStatus } from &apos;@/lib/billing-utils&apos;;
import { usePropertyData } from &apos;@/context/PropertyDataContext&apos;;
import { useAuth } from &apos;@/context/AuthContext&apos;;
import { EditPropertyDialog } from &apos;@/components/edit-property-dialog&apos;;
import { getPropertyValue } from &apos;@/lib/property-utils&apos;;
import { SmsDialog } from &apos;@/components/sms-dialog&apos;;
import { ManualPaymentDialog } from &apos;@/components/manual-payment-dialog&apos;;

const ROWS_PER_PAGE = 15;

const formatValue = (value: any, header: string) =&gt; {
    if (value === undefined || value === null || String(value).trim() === '') return '0.00';
    const skipFormatting = ['Property No', 'Account Number', 'Valuation List No.', 'Phone Number', 'S/N', 'ID', 'Town', 'Suburb', 'Owner', 'Type'];
    const isCurrencyHeader = !skipFormatting.some(k => header.toLowerCase().includes(k.toLowerCase()));
    const num = typeof value === &apos;number&apos; ? value : Number(String(value).replace(/,/g, &apos;&apos;));
    if (!isNaN(num) && isCurrencyHeader) {
        return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    &#125;
    return String(value);
&#125;

export default function BillingPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { user: authUser } = useAuth();
  const isViewer = authUser?.role === &apos;Viewer&apos;;
  
  const { properties, updateProperty, deleteProperties } = usePropertyData();
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState(&apos;&apos;);
  const [activeTab, setActiveTab] = React.useState(&apos;all&apos;);
  const [selectedTown, setSelectedTown] = React.useState(&apos;all&apos;);
  const [selectedSuburb, setSelectedSuburb] = React.useState(&apos;all&apos;);
  const [editingProperty, setEditingProperty] = React.useState<Property | null>(null);
  const [paymentItem, setPaymentItem] = React.useState<Property | null>(null);
  const [smsItems, setSmsItems] = React.useState<Property[]>([]);
  const [isSmsDialogOpen, setIsSmsDialogOpen] = React.useState(false);
  const [selectedRows, setSelectedRows] = React.useState<string[]>([]);

  const isMobile = useIsMobile();
  const [currentPage, setCurrentPage] = React.useState(1);

  React.useEffect(() =&gt; {
    if (properties.length >= 0) setLoading(false);
  &#125;, [properties]);

  const handleViewBill = (property: Property, isDemand: boolean = false) =&gt; {
    const type = getPropertyValue(property, 'Type')?.toLowerCase().includes('bop') ? 'BOP' : 'PROPERTY_RATE';
    // Use sessionStorage for print selections to avoid QuotaExceededError on localStorage
    sessionStorage.setItem('selectedPropertyIdsForPrinting', JSON.stringify([property.id]));
    sessionStorage.setItem('printDemandMode', isDemand ? 'true' : 'false');
    sessionStorage.setItem('printNoticeType', type);
    router.push('/properties/print-preview');
  };

  const handlePrintSelected = () =&gt; {
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
    &#125;
  &#125;;

  const handlePropertyUpdate = (updatedProperty: Property) =&gt; {
    updateProperty(updatedProperty);
    setEditingProperty(null);
    toast({ title: 'Record Updated' });
  &#125;;

  const handleSelectAll = (checked: boolean) =&gt; {
    if (checked) {
      setSelectedRows(filteredData.map(row => row.id));
    &#125; else {
      setSelectedRows([]);
    }
  &#125;;
  
  const handleSelectRow = (id: string, checked: boolean) =&gt; {
    if (checked) {
      setSelectedRows(prev => [...prev, id]);
    &#125; else {
      setSelectedRows(prev => prev.filter(rowId => rowId !== id));
    &#125;
  &#125;;

  const selectedProperties = React.useMemo(() =&gt; {
    return properties.filter(row => selectedRows.includes(row.id));
  &#125;, [properties, selectedRows]);

  const towns = React.useMemo(() =&gt; {
    const set = new Set<string>();
    properties.forEach(p =&gt; {
        const t = getPropertyValue(p, 'Town');
        if (t && String(t).trim() !== '' && String(t) !== '0' && String(t) !== '00') set.add(String(t).trim().toUpperCase());
    });
    return Array.from(set).sort();
  &#125;, [properties]);

  const suburbs = React.useMemo(() =&gt; {
    const set = new Set<string>();
    properties.forEach(p =&gt; {
        const t = getPropertyValue(p, 'Town');
        const s = getPropertyValue(p, 'Suburb');
        if (s && String(s).trim() !== '' && String(s) !== '0' && String(s) !== '00' && (selectedTown === 'all' || String(t).trim().toUpperCase() === selectedTown)) {
            set.add(String(s).trim().toUpperCase());
        }
    &#125;);
    return Array.from(set).sort();
  &#125;, [properties, selectedTown]);

  const handleDeleteSelected = () =&gt; {
    deleteProperties(selectedRows);
    toast({ title: 'Properties Deleted', description: `${selectedRows.length} records have been removed.` &#125;);
    setSelectedRows([]);
  &#125;

  const propertiesWithStatus = React.useMemo<PropertyWithStatus[]>(() =&gt; {
    return properties.map(p => ({ ...p, status: getBillStatus(p) }));
  &#125;, [properties]);

  const filteredData = React.useMemo(() =&gt; {
    let intermediateData = propertiesWithStatus;
    if (activeTab !== 'all') intermediateData = intermediateData.filter(p => p.status.toLowerCase() === activeTab);
    
    if (selectedTown !== &apos;all&apos;) {
        intermediateData = intermediateData.filter(p => String(getPropertyValue(p, &apos;Town&apos;)).trim().toUpperCase() === selectedTown);
    &#125;
    
    if (selectedSuburb !== &apos;all&apos;) {
        intermediateData = intermediateData.filter(p => String(getPropertyValue(p, 'Suburb')).trim().toUpperCase() === selectedSuburb);
    }

    if (!filter) return intermediateData;
    return intermediateData.filter((row) =>
      Object.entries(row).some(([key, value]) =>
        key !== &apos;id&apos; && String(value).toLowerCase().includes(filter.toLowerCase())
      )
    );
  &#125;, [propertiesWithStatus, filter, activeTab, selectedTown, selectedSuburb]);

  const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);

  React.useEffect(() =&gt; {
    setCurrentPage(1);
    setSelectedRows([]);
  }, [activeTab, filter, selectedTown, selectedSuburb]);

  const paginatedData = React.useMemo(() =&gt; {
    return filteredData.slice((currentPage - 1) * ROWS_PER_PAGE, currentPage * ROWS_PER_PAGE);
  }, [filteredData, currentPage]);
  
  const statusVariant = (status: BillStatus) =&gt; {
      switch(String(status).toLowerCase()) {
          case 'paid': return 'default' as const;
          case 'pending': return 'secondary' as const;
          case 'overdue': return 'destructive' as const;
          default: return 'outline' as const;
      }
  &#125;

  const handleSendBulkSms = () =&gt; {
    if (selectedRows.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Records Selected',
        description: 'Please select records to send SMS to.',
      });
      return;
    &#125;
    setSmsItems(selectedProperties);
    setIsSmsDialogOpen(true);
  &#125;;

  const handleSendSingleSms = (property: Property) =&gt; {
      setSmsItems([property]);
      setIsSmsDialogOpen(true);
  };

  const isAllFilteredSelected = filteredData.length > 0 && selectedRows.length === filteredData.length;
  const isSomeRowsSelected = selectedRows.length &gt; 0 && selectedRows.length < filteredData.length;

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <>
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Billing & Payments</h1>
      </div>
      <Tabs defaultValue="all" onValueChange={setActiveTab}&gt;
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
                        onChange={(e) => setFilter(e.target.value)&#125; 
                        className=&quot;pl-8 w-full md:max-w-xs&quot;
                    /&gt;
                </div>
                {selectedRows.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={handlePrintSelected}&gt;
                        <Printer className="h-4 w-4 mr-2"/>
                        Print ({selectedRows.length})
                    </Button>
                    {!isViewer && (
                        <>
                        <Button variant="outline" size="sm" onClick={handleSendBulkSms}&gt;
                            <MessageSquare className="h-4 w-4 mr-2"/>
                            Send SMS ({selectedRows.length})
                        </Button>
                        <Button variant="destructive" size="sm" onClick={handleDeleteSelected}&gt;
                            <Trash2 className="h-4 w-4 mr-2"/>
                            Delete ({selectedRows.length})
                        </Button>
                        </>
                    )&#125;
                    </div>
                )&#125;
            </div>
          </div>

          <Card className="bg-muted/20 border-dashed">
            <CardContent className="p-4 flex flex-col md:flex-row items-end gap-4">
                <div className="grid gap-1.5 flex-1">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> Filter by Town
                    </label>
                    <Select value={selectedTown} onValueChange={(v) => { setSelectedTown(v); setSelectedSuburb('all'); }&#125;&gt;
                        <SelectTrigger className="bg-background h-9">
                            <SelectValue placeholder="All Towns" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Towns</SelectItem>
                            {towns.map(t => <SelectItem key={t} value={t}&gt;{t}</SelectItem>)&#125;
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-1.5 flex-1">
                    <label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" /> Filter by Suburb
                    </label>
                    <Select value={selectedSuburb} onValueChange={setSelectedSuburb}&gt;
                        <SelectTrigger className="bg-background h-9">
                            <SelectValue placeholder="All Suburbs" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Suburbs</SelectItem>
                            {suburbs.map(s => <SelectItem key={s} value={s}&gt;{s}</SelectItem>)&#125;
                        </SelectContent>
                    </Select>
                </div>
                {(selectedTown !== 'all' || selectedSuburb !== 'all') && (
                    <Button variant="ghost" size="sm" onClick={() => { setSelectedTown('all'); setSelectedSuburb('all'); }&#125; className=&quot;h-9&quot;&gt;
                        Clear Filters
                    </Button>
                )&#125;
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
                                  onCheckedChange={(checked) => handleSelectAll(!!checked)&#125;
                                  aria-label=&quot;Select all rows&quot;
                                /&gt;
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
                            <TableRow key={row.id} data-state={selectedRows.includes(row.id) ? "selected" : undefined}&gt;
                                <TableCell>
                                    <Checkbox
                                      checked={selectedRows.includes(row.id)}
                                      onCheckedChange={(checked) => handleSelectRow(row.id, !!checked)&#125;
                                      aria-label={`Select row ${row.id}`&#125;
                                    /&gt;
                                </TableCell>
                                <TableCell><Badge variant={statusVariant(row.status)}&gt;{row.status}</Badge></TableCell>
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
                                    <DropdownMenuItem onSelect={() => handleViewBill(row, false)&#125;&gt;
                                      <View className="mr-2 h-4 w-4" /> 
                                      View Bill
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => handleViewBill(row, true)&#125; className=&quot;text-red-600 focus:text-red-600 focus:bg-red-50&quot;&gt;
                                      <FileWarning className="mr-2 h-4 w-4" /> 
                                      View Demand Notice
                                    </DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => handleSendSingleSms(row)&#125;&gt;<MessageSquare className="mr-2 h-4 w-4" /> Send SMS</DropdownMenuItem>
                                    {!isViewer && (
                                        <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem onSelect={() => setPaymentItem(row)&#125;&gt;<Banknote className="mr-2 h-4 w-4" /> Record Payment</DropdownMenuItem>
                                        <DropdownMenuItem onSelect={() => setEditingProperty(row)&#125;&gt;<FilePenLine className="mr-2 h-4 w-4" /> Edit</DropdownMenuItem>
                                        </>
                                    )&#125;
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))&#125;
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
                        onClick={() => setCurrentPage(prev =&gt; Math.max(prev - 1, 1))&#125;
                        disabled={currentPage === 1}
                      &gt;
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev =&gt; Math.min(prev + 1, totalPages))&#125;
                        disabled={currentPage === totalPages}
                      &gt;
                        Next
                      </Button>
                    </div>
                  </CardFooter>
                )&#125;
            </Card>
        </TabsContent>
      </Tabs>
      
      <EditPropertyDialog property={editingProperty} isOpen={!!editingProperty} onOpenChange={(open) => !open && setEditingProperty(null)&#125; onPropertyUpdate={handlePropertyUpdate} /&gt;
      <ManualPaymentDialog item={paymentItem} type=&quot;property&quot; isOpen={!!paymentItem} onOpenChange={(open) => !open && setPaymentItem(null)&#125; /&gt;
      <SmsDialog isOpen={isSmsDialogOpen} onOpenChange={setIsSmsDialogOpen} selectedProperties={smsItems} /&gt;
    </>
  );
}