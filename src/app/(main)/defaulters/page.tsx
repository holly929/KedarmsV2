'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Download, Loader2, MessageSquare, Trash2, Home, Store, AlertTriangle, Users, Printer, FileWarning, MapPin } from 'lucide-react';
import * as XLSX from 'xlsx';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartContainer, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePropertyData } from '@/context/PropertyDataContext';
import { useBopData } from '@/context/BopDataContext';
import { useLicenseData } from '@/context/LicenseDataContext';
import { getBillStatus, getBopBillStatus, getLicenseBillStatus, BillStatus } from '@/lib/billing-utils';
import type { Property, Bop, License, PropertyWithStatus, BopWithStatus, LicenseWithStatus } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { getPropertyValue } from '@/lib/property-utils';
import { SmsDialog } from '@/components/sms-dialog';
import { useAuth } from '@/context/AuthContext';

const formatCurrency = (value: number) => `GHS ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const chartConfig: ChartConfig = {
  count: { label: "Count", color: "hsl(var(--destructive))" },
  amount: { label: "Amount Owed", color: "hsl(var(--destructive))" },
};

const ROWS_PER_PAGE = 15;

const EmptyState = ({ title, message }: { title: string, message: string }) => (
    <div className="h-[400px] flex flex-col items-center justify-center text-center rounded-lg border-2 border-dashed p-12">
        <AlertTriangle className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-muted-foreground text-sm mt-2">{message}</p>
    </div>
);

interface DefaulterListProps<T extends Property | Bop | License> {
    data: (T extends Property ? PropertyWithStatus : T extends Bop ? BopWithStatus : LicenseWithStatus)[];
    headers: string[];
    isMobile: boolean;
    onDelete: (ids: string[]) => void;
    title: 'property' | 'bop' | 'license';
    isViewer: boolean;
}

function DefaulterList<T extends Property | Bop | License>({ data, headers, isMobile, onDelete, title, isViewer }: DefaulterListProps<T>) {
    const { toast } = useToast();
    const [filter, setFilter] = React.useState('');
    const [currentPage, setCurrentPage] = React.useState(1);
    const [selectedRows, setSelectedRows] = React.useState<string[]>([]);
    const [isSmsDialogOpen, setIsSmsDialogOpen] = React.useState(false);

    const filteredData = React.useMemo(() => {
        if (!filter) return data;
        return data.filter((row) =>
          Object.values(row).some((value) =>
            String(value).toLowerCase().includes(filter.toLowerCase())
          )
        );
    }, [data, filter]);

    const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);
    const paginatedData = React.useMemo(() => {
        return filteredData.slice(
          (currentPage - 1) * ROWS_PER_PAGE,
          currentPage * ROWS_PER_PAGE
        );
    }, [filteredData, currentPage]);
    
    React.useEffect(() => {
        setCurrentPage(1);
        setSelectedRows([]);
    }, [filteredData]);

    const handleSelectAll = (checked: boolean) => {
        setSelectedRows(checked ? filteredData.map(row => row.id) : []);
    };
    
    const handleSelectRow = (id: string, checked: boolean) => {
        setSelectedRows(prev => checked ? [...prev, id] : prev.filter(rowId => rowId !== id));
    };

    const handleDeleteSelected = () => {
        onDelete(selectedRows);
        toast({ title: 'Records Deleted', description: `${selectedRows.length} defaulter records have been removed.` });
        setSelectedRows([]);
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
    
    const selectedItems = React.useMemo(() => {
        return data.filter(row => selectedRows.includes(row.id));
    }, [data, selectedRows]);

    const chartDataByTown = React.useMemo(() => {
        const counts: { [key: string]: number } = {};
        filteredData.forEach(item => {
            const town = getPropertyValue(item as any, 'Town') || 'Unknown';
            counts[town] = (counts[town] || 0) + 1;
        });
        return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count);
    }, [filteredData]);

    const chartDataByType = React.useMemo(() => {
        const counts: { [key: string]: number } = {};
        filteredData.forEach(item => {
            const type = getPropertyValue(item as any, 'Property Type') || 'Unknown';
            counts[type] = (counts[type] || 0) + 1;
        });
        return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a,b) => b.count - a.count);
    }, [filteredData]);
    
    const totalAmountOwed = React.useMemo(() => {
        return filteredData.reduce((acc, item) => {
            if (title === 'property') {
                const p = item as Property;
                const rateableValue = Number(getPropertyValue(p, 'Rateable Value')) || 0;
                const rateImpost = Number(getPropertyValue(p, 'Rate Impost')) || 0;
                const sanitation = Number(getPropertyValue(p, 'Sanitation Charged')) || 0;
                const previousBalance = Number(getPropertyValue(p, 'Previous Balance')) || 0;
                const payment = Number(getPropertyValue(p, 'Total Payment')) || 0;
                const due = (rateableValue * rateImpost) + sanitation + previousBalance;
                const outstanding = due > payment ? due - payment : 0;
                return acc + outstanding;
            } else if (title === 'bop') {
                const b = item as Bop;
                const permitFee = Number(getPropertyValue(b, 'Permit Fee')) || 0;
                const payment = Number(getPropertyValue(b, 'Payment')) || 0;
                const outstanding = (permitFee + (Number(getPropertyValue(b, 'Arrears')) || 0)) - payment;
                return acc + (outstanding > 0 ? outstanding : 0);
            } else {
                const l = item as License;
                const rate = Number(getPropertyValue(l, 'Property Rate')) || 0;
                const arrears = Number(getPropertyValue(l, 'Arrears')) || 0;
                const payment = Number(getPropertyValue(l, 'Payment')) || 0;
                const due = rate + arrears;
                const outstanding = due > payment ? due - payment : 0;
                return acc + outstanding;
            }
        }, 0);
    }, [filteredData, title]);

    const handleExport = () => {
        if (filteredData.length === 0) {
            toast({ variant: 'destructive', title: 'No Data to Export' });
            return;
        }
        const worksheet = XLSX.utils.json_to_sheet(filteredData.map(({id, status, payments, ...rest}) => rest));
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Defaulters');
        XLSX.writeFile(workbook, `${title}_defaulters_report.xlsx`);
        toast({ title: 'Export Successful', description: `Downloaded ${title}_defaulters_report.xlsx` });
    };

    const isAllFilteredSelected = filteredData.length > 0 && selectedRows.length === filteredData.length;
    const isSomeRowsSelected = selectedRows.length > 0 && selectedRows.length < filteredData.length;

    const statusVariant = (status: BillStatus): 'default' | 'secondary' | 'destructive' | 'outline' => {
      switch(String(status).toLowerCase()) {
          case 'paid': return 'default';
          case 'pending': return 'secondary';
          case 'overdue': return 'destructive';
          default: return 'outline';
      }
    }
    
    if (data.length === 0 && !filter) {
        return <EmptyState title={`No ${title.toUpperCase()} Defaulters`} message="All accounts are settled, or no overdue items were found."/>
    }

    const renderDesktopView = () => (
      <div className="w-full overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {!isViewer && <TableHead className="w-[50px]">
                <Checkbox
                  checked={isAllFilteredSelected ? true : isSomeRowsSelected ? 'indeterminate' : false}
                  onCheckedChange={(checked) => handleSelectAll(!!checked)}
                />
              </TableHead>}
              <TableHead className="w-[120px]">Status</TableHead>
              {headers && headers.length > 0 && headers.map((header) => (
                <TableHead key={header}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((row) => (
              <TableRow key={row.id}>
                {!isViewer && <TableCell>
                  <Checkbox 
                    checked={selectedRows.includes(row.id)}
                    onCheckedChange={(checked) => handleSelectRow(row.id, !!checked)}
                  />
                </TableCell>}
                <TableCell><Badge variant={statusVariant(row.status)}>{row.status}</Badge></TableCell>
                {headers.map((header, cellIndex) => {
                  const value = getPropertyValue(row as any, header);
                  return (
                    <TableCell key={cellIndex} className={cellIndex === 0 ? 'font-medium' : ''}>
                      {typeof value === 'object' && value !== null
                        ? 'View Details'
                        : String(value ?? '')}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );

    const renderMobileView = () => (
        <div className="space-y-4">
            {paginatedData.map(row => (
                <Card key={row.id} className="transition-shadow hover:shadow-lg">
                    <CardHeader className="flex flex-row items-center gap-4 pb-2">
                        {!isViewer && <Checkbox checked={selectedRows.includes(row.id)} onCheckedChange={(checked) => handleSelectRow(row.id, !!checked)} />}
                        <CardTitle className="text-base font-semibold">{headers && headers.length > 0 ? getPropertyValue(row as any, headers[0]) || 'N/A' : 'N/A'}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm pl-6 pr-6 pb-4">
                        <div className="flex justify-between items-center text-xs">
                          <span className="font-semibold text-muted-foreground">Status</span>
                          <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                        </div>
                        {headers && headers.length > 0 && headers.slice(1).map(header => {
                        const value = getPropertyValue(row as any, header);
                        if (header.toLowerCase() === 'id' || !value) return null;
                        return (
                            <div key={header} className="flex justify-between items-center text-xs">
                            <span className="font-semibold text-muted-foreground">{header}</span>
                            <span className="text-right">
                              {typeof value === 'object' && value !== null
                                ? 'View Details'
                                : String(value)}
                            </span>
                            </div>
                        );
                        })}
                    </CardContent>
                </Card>
            ))}
        </div>
    )

    return (
        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Defaulters</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{filteredData.length}</div>
                        <p className="text-xs text-muted-foreground">Total records with an outstanding balance</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total Amount Owed</CardTitle>
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(totalAmountOwed)}</div>
                        <p className="text-xs text-muted-foreground">Total outstanding balance from defaulters</p>
                    </CardContent>
                </Card>
                 <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle className="text-sm font-medium">Defaulters by {title === 'property' ? 'Type' : 'Area'}</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <ChartContainer config={chartConfig} className="h-[100px] w-full">
                            <BarChart accessibilityLayer data={title === 'property' ? chartDataByType.slice(0,5) : chartDataByTown.slice(0,5)} layout="vertical" margin={{ left: 10, right: 10, top: 0, bottom: 0}}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={5} className="text-xs" interval={0} width={80} />
                                <Tooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                                <Bar dataKey="count" fill="var(--color-count)" radius={4} layout="vertical" />
                            </BarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
            </div>
            
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                         <div>
                            <CardTitle>Defaulter List</CardTitle>
                            <CardDescription>A list of all records with an outstanding payment balance.</CardDescription>
                         </div>
                         <div className="flex items-center gap-2 w-full sm:w-auto">
                            <Input
                              placeholder="Filter list..."
                              value={filter}
                              onChange={(e) => setFilter(e.target.value)}
                              className="w-full sm:max-w-xs"
                            />
                            <Button variant="outline" size="sm" onClick={handleExport}>
                                <Download className="h-4 w-4 mr-2" />
                                Export
                            </Button>
                         </div>
                    </div>
                     {!isViewer && selectedRows.length > 0 && (
                        <div className="flex items-center gap-2 flex-wrap mt-4">
                            <span className="text-sm text-muted-foreground">{selectedRows.length} of {filteredData.length} selected</span>
                            <Button variant="outline" size="sm" onClick={handleSendSms}>
                                <MessageSquare className="h-4 w-4 mr-2"/>
                                Send SMS ({selectedRows.length})
                            </Button>
                            <Button variant="destructive" size="sm" onClick={handleDeleteSelected}>
                                <Trash2 className="h-4 w-4 mr-2"/>
                                Delete ({selectedRows.length})
                            </Button>
                        </div>
                    )}
                </CardHeader>
                <CardContent>
                    {paginatedData.length === 0 ? (
                      <div className="h-64 flex items-center justify-center text-muted-foreground">No results found for your filter.</div>
                    ) : (
                      isMobile ? renderMobileView() : renderDesktopView()
                    )}
                </CardContent>
                {totalPages > 1 && (
                    <CardFooter className="flex justify-between items-center border-t pt-4">
                        <span className="text-sm text-muted-foreground">
                          Page {currentPage} of {totalPages} ({filteredData.length} total defaulters)
                        </span>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(p - 1, 1))} disabled={currentPage === 1}>Previous</Button>
                          <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))} disabled={currentPage === totalPages}>Next</Button>
                        </div>
                    </CardFooter>
                )}
            </Card>
            <SmsDialog isOpen={isSmsDialogOpen} onOpenChange={setIsSmsDialogOpen} selectedProperties={selectedItems} />
        </div>
    );
}

export default function DefaultersPage() {
  const router = useRouter();
  const { properties, headers: propertyHeaders, deleteProperties } = usePropertyData();
  const { bopData, headers: bopHeaders, deleteBops } = useBopData();
  const { licenseData, headers: licenseHeaders, deleteLicenses } = useLicenseData();
  const { user: authUser } = useAuth();
  const isViewer = authUser?.role === 'Viewer';
  const isMobile = useIsMobile();
  const { toast } = useToast();

  const [selectedTown, setSelectedTown] = React.useState('all');
  const [selectedSuburb, setSelectedSuburb] = React.useState('all');

  const propertyDefaulters = React.useMemo<PropertyWithStatus[]>(() => {
    return properties
      .map(p => ({ ...p, status: getBillStatus(p) }))
      .filter(p => p.status === 'Overdue' || p.status === 'Pending');
  }, [properties]);

  const bopDefaulters = React.useMemo<BopWithStatus[]>(() => {
    return bopData
      .map(b => ({ ...b, status: getBopBillStatus(b) }))
      .filter(b => b.status === 'Overdue' || b.status === 'Pending');
  }, [bopData]);

  const licenseDefaulters = React.useMemo<LicenseWithStatus[]>(() => {
    return licenseData
      .map(l => ({ ...l, status: getLicenseBillStatus(l) }))
      .filter(l => l.status === 'Overdue' || l.status === 'Pending');
  }, [licenseData]);

  const towns = React.useMemo(() => {
    const set = new Set<string>();
    properties.forEach(p => {
        const t = getPropertyValue(p, 'Town');
        if (t) set.add(String(t).trim().toUpperCase());
    });
    return Array.from(set).sort();
  }, [properties]);

  const suburbs = React.useMemo(() => {
    const set = new Set<string>();
    properties.forEach(p => {
        const t = getPropertyValue(p, 'Town');
        const s = getPropertyValue(p, 'Suburb');
        if (s && (selectedTown === 'all' || String(t).trim().toUpperCase() === selectedTown)) {
            set.add(String(s).trim().toUpperCase());
        }
    });
    return Array.from(set).sort();
  }, [properties, selectedTown]);

  const filteredForBulk = React.useMemo(() => {
      return propertyDefaulters.filter(p => {
          const townMatch = selectedTown === 'all' || String(getPropertyValue(p, 'Town')).trim().toUpperCase() === selectedTown;
          const suburbMatch = selectedSuburb === 'all' || String(getPropertyValue(p, 'Suburb')).trim().toUpperCase() === selectedSuburb;
          return townMatch && suburbMatch;
      });
  }, [propertyDefaulters, selectedTown, selectedSuburb]);

  const handleBulkPrintDemand = () => {
    if (filteredForBulk.length === 0) {
        toast({ variant: 'destructive', title: 'No Records', description: 'No defaulters found for the selected location.' });
        return;
    }
    localStorage.setItem('selectedPropertiesForPrinting', JSON.stringify(filteredForBulk));
    localStorage.setItem('printDemandMode', 'true');
    localStorage.setItem('printNoticeType', 'PROPERTY_RATE');
    router.push('/properties/print-preview');
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Defaulters & Enforcement</h1>
      </div>

      <Card className="border-red-200 bg-red-50/10">
        <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-red-600">
                <FileWarning className="h-5 w-5" />
                <CardTitle className="text-lg">Batch Demand Notices</CardTitle>
            </div>
            <CardDescription>Filter by location to print demand notices for all matching defaulters.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col md:flex-row items-end gap-4">
            <div className="grid gap-2 flex-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Town
                </label>
                <Select value={selectedTown} onValueChange={(v) => { setSelectedTown(v); setSelectedSuburb('all'); }}>
                    <SelectTrigger className="bg-background">
                        <SelectValue placeholder="All Towns" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Towns</SelectItem>
                        {towns.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="grid gap-2 flex-1">
                <label className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Suburb
                </label>
                <Select value={selectedSuburb} onValueChange={setSelectedSuburb}>
                    <SelectTrigger className="bg-background">
                        <SelectValue placeholder="All Suburbs" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Suburbs</SelectItem>
                        {suburbs.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <Button className="bg-red-600 hover:bg-red-700 h-10 px-8" onClick={handleBulkPrintDemand}>
                <Printer className="mr-2 h-4 w-4" />
                Print {filteredForBulk.length} Demand Notices
            </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="properties" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="properties">
              <Home className="mr-2 h-4 w-4"/> Property Rates ({propertyDefaulters.length})
          </TabsTrigger>
          <TabsTrigger value="bop">
               <Store className="mr-2 h-4 w-4"/> BOP ({bopDefaulters.length})
          </TabsTrigger>
          <TabsTrigger value="license">
               <Hotel className="mr-2 h-4 w-4"/> License ({licenseDefaulters.length})
          </TabsTrigger>
        </TabsList>
        <TabsContent value="properties">
            <DefaulterList 
                data={propertyDefaulters}
                headers={propertyHeaders}
                isMobile={isMobile}
                onDelete={deleteProperties}
                title="property"
                isViewer={isViewer}
            />
        </TabsContent>
        <TabsContent value="bop">
             <DefaulterList 
                data={bopDefaulters}
                headers={bopHeaders}
                isMobile={isMobile}
                onDelete={deleteBops}
                title="bop"
                isViewer={isViewer}
            />
        </TabsContent>
        <TabsContent value="license">
             <DefaulterList 
                data={licenseDefaulters}
                headers={licenseHeaders}
                isMobile={isMobile}
                onDelete={deleteLicenses}
                title="license"
                isViewer={isViewer}
            />
        </TabsContent>
      </Tabs>
    </>
  );
}
