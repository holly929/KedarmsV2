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
  Hotel,
  CreditCard,
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
import type { License } from '@/lib/types';
import type { LicenseWithStatus, BillStatus } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { getLicenseBillStatus } from '@/lib/billing-utils';
import { useLicenseData } from '@/context/LicenseDataContext';
import { useAuth } from '@/context/AuthContext';
import { getPropertyValue } from '@/lib/property-utils';
import { SmsDialog } from '@/components/sms-dialog';
import { EditLicenseDialog } from '@/components/edit-license-dialog';

const ROWS_PER_PAGE = 15;

const formatCurrency = (value: any) => {
    const num = Number(String(value || 0).replace(/,/g, ''));
    if (isNaN(num)) return '0.00';
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function LicenseBillingPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { user: authUser } = useAuth();
  const isViewer = authUser?.role === 'Viewer';
  
  const { licenseData, headers, updateLicense, deleteLicense, deleteLicenses } = useLicenseData();
  const [loading, setLoading] = React.useState(true);

  const [filter, setFilter] = React.useState('');
  const [activeTab, setActiveTab] = React.useState('all');
  const [editingLicense, setEditingLicense] = React.useState<License | null>(null);

  const [selectedRows, setSelectedRows] = React.useState<string[]>([]);
  const isMobile = useIsMobile();
  const [currentPage, setCurrentPage] = React.useState(1);
  const [isSmsDialogOpen, setIsSmsDialogOpen] = React.useState(false);
  
  React.useEffect(() => {
    if (licenseData.length >= 0) {
      setLoading(false);
    }
  }, [licenseData]);

  const handleViewBill = (license: License) => {
    localStorage.setItem('selectedLicensesForPrinting', JSON.stringify([license]));
    router.push('/license/print-preview');
  };
  
  const handlePrintSelected = () => {
    if (selectedRows.length > 0) {
      localStorage.setItem('selectedLicensesForPrinting', JSON.stringify(selectedLicenses));
      router.push('/license/print-preview');
    } else {
      toast({
        variant: 'destructive',
        title: 'No Records Selected',
        description: 'Please select at least one record to print.',
      });
    }
  };

  const handlePayOnline = (license: License) => {
    localStorage.setItem('paymentBill', JSON.stringify({ type: 'license', data: license }));
    router.push(`/payment/license/${license.id}`);
  };

  const handleSendSms = () => {
    if (selectedRows.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Records Selected',
        description: 'Please select records to send SMS to.',
      });
      return;
    }
    setIsSmsDialogOpen(true);
  };
  
  const handleDeleteRow = (id: string) => {
    deleteLicense(id);
    setSelectedRows(prev => prev.filter(rowId => rowId !== id));
    toast({ title: 'License Record Deleted', description: `Record has been removed.` });
  }
  
  const handleDeleteSelected = () => {
    deleteLicenses(selectedRows);
    toast({ title: 'License Records Deleted', description: `${selectedRows.length} records have been removed.` });
    setSelectedRows([]);
  }

  const handleLicenseUpdate = (updatedLicense: License) => {
    updateLicense(updatedLicense);
    setEditingLicense(null);
    toast({ title: 'License Record Updated', description: 'The record has been successfully updated.' });
  };

  const licensesWithStatus = React.useMemo<LicenseWithStatus[]>(() => {
    return licenseData.map(p => ({ ...p, status: getLicenseBillStatus(p) }));
  }, [licenseData]);

  const filteredData = React.useMemo(() => {
    let intermediateData = licensesWithStatus;

    if (activeTab !== 'all') {
      intermediateData = intermediateData.filter(
        p => p.status.toLowerCase() === activeTab
      );
    }
    
    if (!filter) return intermediateData;

    return intermediateData.filter((row) =>
      Object.entries(row).some(([key, value]) =>
        key !== 'id' && String(value).toLowerCase().includes(filter.toLowerCase())
      )
    );
  }, [licensesWithStatus, filter, activeTab]);

  const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);

  const paginatedData = React.useMemo(() => {
    return filteredData.slice(
      (currentPage - 1) * ROWS_PER_PAGE,
      currentPage * ROWS_PER_PAGE
    );
  }, [filteredData, currentPage]);
  
  React.useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, filter]);

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

  const selectedLicenses = React.useMemo(() => {
    return licenseData.filter(row => selectedRows.includes(row.id));
  }, [licenseData, selectedRows]);
  
  const statusVariant = (status: BillStatus): 'default' | 'secondary' | 'destructive' | 'outline' => {
      switch(String(status).toLowerCase()) {
          case 'paid': return 'default';
          case 'pending': return 'secondary';
          case 'overdue': return 'destructive';
          default: return 'outline';
      }
  }

  const isAllFilteredSelected = filteredData.length > 0 && selectedRows.length === filteredData.length;
  const isSomeRowsSelected = selectedRows.length > 0 && selectedRows.length < filteredData.length;

  const renderDesktopView = () => (
    <div className="w-full overflow-x-auto">
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
            <TableHead className="w-[120px]">Status</TableHead>
            {headers.map((header) => (
              <TableHead key={header}>{header}</TableHead>
            ))}
            <TableHead><span className="sr-only">Actions</span></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedData.length > 0 ? (
            paginatedData.map((row) => (
              <TableRow key={row.id} data-state={selectedRows.includes(row.id) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox
                    checked={selectedRows.includes(row.id)}
                    onCheckedChange={(checked) => handleSelectRow(row.id, !!checked)}
                    aria-label={`Select row ${row.id}`}
                  />
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                </TableCell>
                {headers.map((header, cellIndex) => {
                  const value = getPropertyValue(row, header);
                  const isCurrency = ['License Fee', 'Bop Amount', 'Arrears', 'Payment', 'Amount Due', 'Property Rate', 'Total Payment'].some(key => header.toLowerCase().includes(key.toLowerCase()));
                  
                  return (
                    <TableCell key={cellIndex} className={cellIndex === 0 ? 'font-medium' : ''}>
                      {typeof value === 'object' && value !== null
                        ? 'View Details'
                        : isCurrency ? `GHS ${formatCurrency(value)}` : String(value ?? '')}
                    </TableCell>
                  );
                })}
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button aria-haspopup="true" size="icon" variant="ghost">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Toggle menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      {getPropertyValue(row, 'Name of Hotel/Guest House') && (getPropertyValue(row, 'License Fee') || getPropertyValue(row, 'Property Rate')) ? (
                        <>
                        <DropdownMenuItem onSelect={() => handleViewBill(row)}>
                          <View className="mr-2 h-4 w-4" />
                          View Bill
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => handlePayOnline(row)}>
                          <CreditCard className="mr-2 h-4 w-4" />
                          Pay Online
                        </DropdownMenuItem>
                        </>
                      ) : null}
                      {!isViewer && (
                        <>
                          <DropdownMenuItem onSelect={() => setEditingLicense(row)}>
                            <FilePenLine className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator/>
                          <DropdownMenuItem onSelect={() => handleDeleteRow(row.id)} className="text-destructive">
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={headers.length + 3} className="h-24 text-center">
                No results found.
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
        <Card key={row.id} data-state={selectedRows.includes(row.id) ? "selected" : undefined} className="data-[state=selected]:bg-muted/50 transition-shadow hover:shadow-lg">
          <CardHeader className="flex flex-row items-start justify-between pb-2">
            <div className="flex items-center space-x-4">
              <Checkbox
                checked={selectedRows.includes(row.id)}
                onCheckedChange={(checked) => handleSelectRow(row.id, !!checked)}
                aria-label={`Select row ${row.id}`}
              />
              <CardTitle className="text-base font-semibold">{getPropertyValue(row, headers[0]) || 'N/A'}</CardTitle>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8 -mt-2">
                  <MoreHorizontal className="h-4 w-4"/>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                {getPropertyValue(row, 'Name of Hotel/Guest House') && (getPropertyValue(row, 'License Fee') || getPropertyValue(row, 'Property Rate')) ? (
                  <>
                  <DropdownMenuItem onSelect={() => handleViewBill(row)}>
                    <View className="mr-2 h-4 w-4" /> View Bill
                  </DropdownMenuItem>
                   <DropdownMenuItem onSelect={() => handlePayOnline(row)}>
                    <CreditCard className="mr-2 h-4 w-4" /> Pay Online
                  </DropdownMenuItem>
                  </>
                ) : null}
                 {!isViewer && (
                   <>
                    <DropdownMenuItem onSelect={() => setEditingLicense(row)}>
                        <FilePenLine className="mr-2 h-4 w-4" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator/>
                    <DropdownMenuItem onSelect={() => handleDeleteRow(row.id)} className="text-destructive">
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </DropdownMenuItem>
                   </>
                 )}
              </DropdownMenuContent>
            </DropdownMenu>
          </CardHeader>
          <CardContent className="space-y-2 text-sm pl-16 pr-6 pb-4">
             <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-muted-foreground">Status</span>
                <Badge variant={statusVariant(row.status)} className="text-xs">{row.status}</Badge>
            </div>
            {headers.slice(1).map(header => {
              const value = getPropertyValue(row, header);
              if (header.toLowerCase() === 'id' || value === undefined || value === null) return null;
              const isCurrency = ['License Fee', 'Bop Amount', 'Arrears', 'Payment', 'Amount Due', 'Property Rate', 'Total Payment'].some(key => header.toLowerCase().includes(key.toLowerCase()));
              
              return (
                <div key={header} className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-muted-foreground">{header}</span>
                  <span className="text-right">{typeof value === 'object' && value !== null ? 'View Details' : isCurrency ? `GHS ${formatCurrency(value)}` : String(value)}</span>
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
  
  if (loading) {
    return (
        <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    );
  }

  if (licenseData.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center h-[calc(100vh-20rem)]">
            <Hotel className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No License Data Found</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Please go to the <Button variant="link" onClick={() => router.push('/license')} className="p-0 h-auto">License Data</Button> page to import your data first.
            </p>
        </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Hotel/Guest House Billing</h1>
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
                <Input
                  placeholder="Filter data..."
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="w-full md:max-w-xs"
                />
                {selectedRows.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                        <Button variant="outline" size="sm" onClick={handlePrintSelected}>
                            <Printer className="h-4 w-4 mr-2"/>
                            Print ({selectedRows.length})
                        </Button>
                        {!isViewer && 
                        <>
                          <Button variant="outline" size="sm" onClick={handleSendSms}>
                              <MessageSquare className="h-4 w-4 mr-2"/>
                              Send SMS ({selectedRows.length})
                          </Button>
                          <Button variant="destructive" size="sm" onClick={handleDeleteSelected}>
                              <Trash2 className="h-4 w-4 mr-2"/>
                              Delete ({selectedRows.length})
                          </Button>
                        </>
                        }
                    </div>
                )}
            </div>
        </div>
        <TabsContent value={activeTab}>
            <Card>
                <CardHeader>
                <CardTitle>License Records</CardTitle>
                <CardDescription>
                    Select records to print bills or perform other actions.
                    {selectedRows.length > 0 && ` (${selectedRows.length} selected of ${filteredData.length})`}
                </CardDescription>
                </CardHeader>
                <CardContent>
                {isMobile ? renderMobileView() : renderDesktopView()}
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
      <EditLicenseDialog
        license={editingLicense}
        isOpen={!!editingLicense}
        onOpenChange={(isOpen) => !isOpen && setEditingLicense(null)}
        onLicenseUpdate={handleLicenseUpdate}
      />
      <SmsDialog
        isOpen={isSmsDialogOpen}
        onOpenChange={setIsSmsDialogOpen}
        selectedProperties={selectedLicenses}
      />
    </>
  );
}
