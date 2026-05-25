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
  CreditCard,
  Banknote,
  FileWarning,
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
import type { Property } from '@/lib/types';
import type { PropertyWithStatus, BillStatus } from '@/lib/types';
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
  
  const { properties, headers, updateProperty, deleteProperty, deleteProperties } = usePropertyData();
  const [loading, setLoading] = React.useState(true);
  const [filter, setFilter] = React.useState('');
  const [activeTab, setActiveTab] = React.useState('all');
  const [editingProperty, setEditingProperty] = React.useState<Property | null>(null);
  const [paymentItem, setPaymentItem] = React.useState<Property | null>(null);

  const [selectedRows, setSelectedRows] = React.useState<string[]>([]);
  const isMobile = useIsMobile();
  const [currentPage, setCurrentPage] = React.useState(1);
  const [isSmsDialogOpen, setIsSmsDialogOpen] = React.useState(false);

  React.useEffect(() => {
    if (properties.length >= 0) setLoading(false);
  }, [properties]);

  const handleViewBill = (property: Property, isDemand: boolean = false) => {
    localStorage.setItem('selectedPropertiesForPrinting', JSON.stringify([property]));
    localStorage.setItem('printDemandMode', isDemand ? 'true' : 'false');
    router.push('/properties/print-preview');
  };

  const handlePropertyUpdate = (updatedProperty: Property) => {
    updateProperty(updatedProperty);
    setEditingProperty(null);
    toast({ title: 'Record Updated' });
  };

  const propertiesWithStatus = React.useMemo<PropertyWithStatus[]>(() => {
    return properties.map(p => ({ ...p, status: getBillStatus(p) }));
  }, [properties]);

  const filteredData = React.useMemo(() => {
    let intermediateData = propertiesWithStatus;
    if (activeTab !== 'all') intermediateData = intermediateData.filter(p => p.status.toLowerCase() === activeTab);
    if (!filter) return intermediateData;
    return intermediateData.filter((row) =>
      Object.entries(row).some(([key, value]) =>
        key !== 'id' && String(value).toLowerCase().includes(filter.toLowerCase())
      )
    );
  }, [propertiesWithStatus, filter, activeTab]);

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

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <>
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Billing & Payments</h1>
      </div>
      <Tabs defaultValue="all" onValueChange={setActiveTab}>
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="paid">Paid</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="overdue">Overdue</TabsTrigger>
          </TabsList>
           <div className="flex gap-2 w-full md:max-w-md">
                <Input placeholder="Search records..." value={filter} onChange={(e) => setFilter(e.target.value)} />
            </div>
        </div>
        <TabsContent value={activeTab}>
            <Card>
                <CardHeader>
                <CardTitle>Properties</CardTitle>
                <CardDescription>View status and manage payments for all properties.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                        <TableRow>
                            <TableHead>Status</TableHead>
                            <TableHead>Owner</TableHead>
                            <TableHead>Property No</TableHead>
                            <TableHead className="text-right">Amt Paid</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                        </TableHeader>
                        <TableBody>
                        {paginatedData.map((row) => (
                            <TableRow key={row.id}>
                                <TableCell><Badge variant={statusVariant(row.status)}>{row.status}</Badge></TableCell>
                                <TableCell className="font-medium">{getPropertyValue(row, 'Owner Name')}</TableCell>
                                <TableCell>{getPropertyValue(row, 'Property No')}</TableCell>
                                <TableCell className="text-right">{formatValue(getPropertyValue(row, 'Total Payment'), 'Total Payment')}</TableCell>
                                <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal /></Button></DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                    <DropdownMenuItem onSelect={() => handleViewBill(row, false)}><View className="mr-2 h-4 w-4" /> View Bill</DropdownMenuItem>
                                    <DropdownMenuItem onSelect={() => handleViewBill(row, true)} className="text-red-600 focus:text-red-600 focus:bg-red-50"><FileWarning className="mr-2 h-4 w-4" /> View Demand Notice</DropdownMenuItem>
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
            </Card>
        </TabsContent>
      </Tabs>
      
      <EditPropertyDialog property={editingProperty} isOpen={!!editingProperty} onOpenChange={(open) => !open && setEditingProperty(null)} onPropertyUpdate={handlePropertyUpdate} />
      <ManualPaymentDialog item={paymentItem} type="property" isOpen={!!paymentItem} onOpenChange={(open) => !open && setPaymentItem(null)} />
    </>
  );
}
