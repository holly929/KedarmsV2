
'use client';

import * as React from 'react';
import { Download, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Pie, PieChart, Cell } from 'recharts';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ChartContainer, ChartTooltipContent, ChartConfig } from '@/components/ui/chart';
import { usePropertyData } from '@/context/PropertyDataContext';
import { getBillStatus, BillStatus } from '@/lib/billing-utils';
import type { Property, PaymentStatusData, RevenueByPropertyType } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { Badge } from '@/components/ui/badge';
import { getPropertyValue } from '@/lib/property-utils';

const formatCurrency = (value: number) => `GHS ${value.toLocaleString()}`;

const chartConfig: ChartConfig = {
  revenue: { label: "Revenue", color: "hsl(var(--primary))" },
  paid: { label: "Paid", color: "hsl(var(--primary))" },
  pending: { label: "Pending", color: "hsl(var(--accent))" },
  overdue: { label: "Overdue", color: "hsl(var(--destructive))" },
  unbilled: { label: "Unbilled", color: "hsl(var(--muted))" },
};

const ROWS_PER_PAGE = 10;

export default function ReportsPage() {
  const { properties, headers } = usePropertyData();
  const [loading, setLoading] = React.useState(true);
  const { toast } = useToast();
  const { user: authUser } = useAuth();
  const isViewer = authUser?.role === 'Viewer';
  const isMobile = useIsMobile();
  
  const [reportData, setReportData] = React.useState<any[]>([]);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [chartData, setChartData] = React.useState<{ status: PaymentStatusData[], byType: RevenueByPropertyType[] } | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);

  const [filters, setFilters] = React.useState({
    status: 'all',
    propertyType: 'all',
  });
  
  React.useEffect(() => {
    if(properties.length >= 0) {
      setLoading(false);
    }
  }, [properties]);

  const totalPages = Math.ceil(reportData.length / ROWS_PER_PAGE);
  const paginatedReportData = React.useMemo(() => {
    return reportData.slice(
        (currentPage - 1) * ROWS_PER_PAGE,
        currentPage * ROWS_PER_PAGE
    );
  }, [reportData, currentPage]);


  const handleFilterChange = (filterName: 'status' | 'propertyType') => (value: string) => {
    setFilters(prev => ({ ...prev, [filterName]: value }));
  };

  const handleGenerateReport = () => {
    setIsGenerating(true);
    setChartData(null);
    
    setTimeout(() => {
      let filteredProperties = properties.map(p => ({...p, status: getBillStatus(p)}));

      if (filters.status !== 'all') {
        filteredProperties = filteredProperties.filter(p => p.status.toLowerCase() === filters.status);
      }
      if (filters.propertyType !== 'all') {
        filteredProperties = filteredProperties.filter(p => getPropertyValue(p, 'Property Type') === filters.propertyType);
      }
      
      setReportData(filteredProperties);
      setCurrentPage(1);

      if (filteredProperties.length > 0) {
        const statusCounts: Record<BillStatus, number> = { 'Paid': 0, 'Pending': 0, 'Overdue': 0, 'Unbilled': 0 };
        const typeRevenue: { [key: string]: number } = {};

        filteredProperties.forEach(p => {
          statusCounts[p.status as BillStatus]++;
          const payment = Number(getPropertyValue(p, 'Total Payment')) || 0;
          const type = getPropertyValue(p, 'Property Type');
          if (type) {
              if (!typeRevenue[type]) typeRevenue[type] = 0;
              typeRevenue[type] += payment;
          }
        });

        const statusChartDataArray: PaymentStatusData[] = [
          { name: 'Paid', value: statusCounts.Paid, fill: 'hsl(var(--primary))' },
          { name: 'Pending', value: statusCounts.Pending, fill: 'hsl(var(--accent))' },
          { name: 'Overdue', value: statusCounts.Overdue, fill: 'hsl(var(--destructive))' },
          { name: 'Unbilled', value: statusCounts.Unbilled, fill: 'hsl(var(--muted))' },
        ];
        
        const statusChartData = statusChartDataArray.filter(d => d.value > 0);

        const typeChartData = Object.entries(typeRevenue).map(([name, revenue]) => ({ name, revenue })).filter(d => d.revenue > 0);

        setChartData({ status: statusChartData, byType: typeChartData });
      }

      setIsGenerating(false);
      toast({
        title: 'Report Generated',
        description: `Found ${filteredProperties.length} records matching your criteria.`,
      });
    }, 500);
  };

  const handleExportExcel = () => {
    if (reportData.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No data to export',
        description: 'Please generate a report first.',
      });
      return;
    }
    
    const exportData = reportData.map(({ status, payments, ...rest }) => rest);

    const worksheet = XLSX.utils.json_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Report');
    
    const fileName = `Report_${new Date().toISOString().slice(0,19).replace('T', '_').replace(/:/g, '-')}.xlsx`;
    XLSX.writeFile(workbook, fileName);

    toast({
        title: 'Export Successful',
        description: `Report downloaded as ${fileName}`,
    });
  };

  const propertyTypes = React.useMemo(() => {
    const types = new Set(properties.map(p => getPropertyValue(p, 'Property Type')).filter(Boolean));
    return Array.from(types) as string[];
  }, [properties]);
  
  if (loading) {
    return (
        <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    );
  }

  const statusVariant = (status: BillStatus): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch(String(status).toLowerCase()) {
        case 'paid': return 'default';
        case 'pending': return 'secondary';
        case 'overdue': return 'destructive';
        default: return 'outline';
    }
  }

  const renderDesktopView = () => (
    <Card>
      <CardContent className="p-0">
          <div className="w-full overflow-x-auto rounded-md border max-h-[500px]">
              <Table>
                  <TableHeader>
                  <TableRow>
                      {headers && headers.length > 0 && headers.map((header) => (
                      <TableHead key={header}>{header}</TableHead>
                      ))}
                  </TableRow>
                  </TableHeader>
                  <TableBody>
                  {paginatedReportData.map((row) => (
                      <TableRow key={row.id}>
                      {headers.map((header) => (
                          <TableCell key={header}>
                          {String(getPropertyValue(row, header) ?? '')}
                          </TableCell>
                      ))}
                      </TableRow>
                  ))}
                  </TableBody>
              </Table>
          </div>
      </CardContent>
      {totalPages > 1 && (
        <CardFooter className="flex justify-between items-center border-t pt-4">
          <span className="text-sm text-muted-foreground">
            Page {currentPage} of {totalPages} ({reportData.length} total records)
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
  )

  const renderMobileView = () => (
    <div className="space-y-4">
      {paginatedReportData.length > 0 ? (
        <>
        {paginatedReportData.map(row => (
          <Card key={row.id} className="transition-shadow hover:shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">{headers && headers.length > 0 ? getPropertyValue(row, headers[0]) || 'N/A' : 'N/A'}</CardTitle>
              <CardDescription>Property No: {getPropertyValue(row, 'Property No') || 'N/A'}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
               <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold text-muted-foreground">Status</span>
                  <Badge variant={statusVariant(row.status as BillStatus)} className="text-xs">{row.status}</Badge>
              </div>
              {[
                { label: 'Property Type', key: 'Property Type' },
                { label: 'Rateable Value', key: 'Rateable Value' },
                { label: 'Town', key: 'Town' },
              ].map(({label, key}) => {
                  const value = getPropertyValue(row, key);
                  if (!value) return null;
                  return (
                    <div key={key} className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-muted-foreground">{label}</span>
                        <span className="text-right">{String(value)}</span>
                    </div>
                  )
              })}
            </CardContent>
          </Card>
        ))}
        {totalPages > 1 && (
            <div className="flex justify-between items-center pt-4">
                <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
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
            </div>
        )}
        </>
      ) : (
        <div className="text-center text-muted-foreground py-12">
          <p>No results found.</p>
        </div>
      )}
    </div>
  );


  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Reports</h1>
        {!isViewer && reportData.length > 0 &&
          <Button onClick={handleExportExcel}>
              <Download className="mr-2 h-4 w-4" />
              Export to Excel
          </Button>
        }
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate Custom Reports</CardTitle>
          <CardDescription>
            Filter your property data to generate and export custom reports.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row items-center gap-4 mb-6">
            <div className="grid gap-2 w-full sm:w-auto">
              <span className="text-sm font-medium">Payment Status</span>
              <Select value={filters.status} onValueChange={handleFilterChange('status')}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                  <SelectItem value="unbilled">Unbilled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2 w-full sm:w-auto">
              <span className="text-sm font-medium">Property Type</span>
              <Select value={filters.propertyType} onValueChange={handleFilterChange('propertyType')}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {propertyTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-grow"></div>
            <div className="mt-auto self-end">
              <Button onClick={handleGenerateReport} disabled={isGenerating}>
                {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Report
              </Button>
            </div>
          </div>
          
           {reportData.length > 0 && chartData && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7 my-6">
                  <Card className="col-span-4">
                      <CardHeader>
                          <CardTitle>Revenue by Property Type</CardTitle>
                          <CardDescription>Based on generated report data.</CardDescription>
                      </CardHeader>
                      <CardContent className="pl-2">
                          <ChartContainer config={chartConfig} className="h-[250px] w-full">
                              <BarChart accessibilityLayer data={chartData.byType}>
                                  <CartesianGrid vertical={false} />
                                  <XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} />
                                  <YAxis tickFormatter={(value) => formatCurrency(value as number)} />
                                  <Tooltip cursor={false} content={<ChartTooltipContent formatter={(value) => formatCurrency(value as number)} />} />
                                  <Bar dataKey="revenue" fill="var(--color-revenue)" radius={8} />
                              </BarChart>
                          </ChartContainer>
                      </CardContent>
                  </Card>
                  <Card className="col-span-4 lg:col-span-3">
                      <CardHeader>
                          <CardTitle>Payment Status Breakdown</CardTitle>
                          <CardDescription>Based on generated report data.</CardDescription>
                      </CardHeader>
                      <CardContent>
                          <ChartContainer config={chartConfig} className="h-[250px] w-full">
                              <PieChart>
                                  <Tooltip content={<ChartTooltipContent hideLabel />} />
                                  <Pie data={chartData.status} dataKey="value" nameKey="name" innerRadius={50} outerRadius={70} strokeWidth={5}>
                                      {chartData.status.map((entry) => (
                                          <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                                      ))}
                                  </Pie>
                              </PieChart>
                          </ChartContainer>
                      </CardContent>
                  </Card>
              </div>
            )}

          <div className="border-t pt-4">
             <h3 className="text-lg font-medium mb-2">Report Preview ({reportData.length} records)</h3>
             {reportData.length > 0 ? (
                isMobile ? renderMobileView() : renderDesktopView()
             ) : (
                <div className="text-center text-muted-foreground py-12">
                    <p>No report generated. Use the filters above and click "Generate Report".</p>
                </div>
             )}
          </div>

        </CardContent>
      </Card>
    </>
  );
}
