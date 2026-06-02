'use client';

import * as React from 'react';
import { DollarSign, Home, TrendingUp, AlertCircle, Loader2, BarChart2, Coins, Download, List } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Pie, PieChart, Cell, Legend } from 'recharts';
import * as XLSX from 'xlsx';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { ChartContainer, ChartTooltipContent, ChartConfig, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import type { PaymentStatusData, RevenueByPropertyType } from '@/lib/types';
import { usePropertyData } from '@/context/PropertyDataContext';
import { useBillData } from '@/context/BillDataContext';
import { getPropertyValue } from '@/lib/property-utils';
import { getBillStatus } from '@/lib/billing-utils';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';


const formatCurrency = (value: number) => `GHS ${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const formatDate = (isoString: string) => new Date(isoString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const chartConfig: ChartConfig = {
  revenue: { label: "Revenue", color: "hsl(var(--primary))" },
  billed: { label: "Billed", color: "hsl(var(--muted-foreground))" },
  collected: { label: "Collected", color: "hsl(var(--primary))" },
  paid: { label: "Paid", color: "hsl(var(--primary))" },
  pending: { label: "Pending", color: "hsl(var(--accent))" },
  overdue: { label: "Overdue", color: "hsl(var(--destructive))" },
  properties: { label: "Properties" },
  residential: { label: "Residential", color: "hsl(var(--chart-1))" },
  commercial: { label: "Commercial", color: "hsl(var(--chart-2))" },
  industrial: { label: "Industrial", color: "hsl(var(--chart-3))" },
  other: { label: "Other", color: "hsl(var(--chart-4))" },
};

const EmptyState = ({ message }: { message: string }) => (
    <div className="h-[300px] flex flex-col items-center justify-center text-center">
        <BarChart2 className="h-12 w-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground font-medium">No Data to Display</p>
        <p className="text-muted-foreground text-sm">{message}</p>
    </div>
);


export default function DashboardPage() {
  const { properties } = usePropertyData();
  const { bills } = useBillData();
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);

  const dashboardData = React.useMemo(() => {
    if (properties.length === 0) {
      return {
        totalRevenue: 0,
        totalBilled: 0,
        collectionRate: 0,
        totalOutstanding: 0,
        paymentStatus: [],
        revenueByPropertyType: [],
        propertyTypeCounts: [],
        billedVsCollected: [],
      };
    }

    let calculatedTotalRevenue = 0;
    let calculatedTotalBilled = 0;
    let calculatedTotalOutstanding = 0;
    
    let amountPaid = 0;
    let amountPending = 0;
    let amountOverdue = 0;

    const revenueData: { [key: string]: number } = {};
    const propertyCounts: { [key: string]: number } = {};

    properties.forEach(p => {
        const rateableValue = Number(getPropertyValue(p, 'Rateable Value')) || 0;
        const rateImpost = Number(getPropertyValue(p, 'Rate Impost')) || 0;
        const sanitation = Number(getPropertyValue(p, 'Sanitation Charged')) || 0;
        const previousBalance = Number(getPropertyValue(p, 'Previous Balance')) || 0;
        const payment = Number(getPropertyValue(p, 'Total Payment')) || 0;
        
        const grandTotalDue = (rateableValue * rateImpost) + sanitation + previousBalance;
        calculatedTotalRevenue += payment;
        
        const type = getPropertyValue(p, 'Property Type') || 'Other';
        if (!revenueData[type]) revenueData[type] = 0;
        revenueData[type] += payment;

        if(!propertyCounts[type]) propertyCounts[type] = 0;
        propertyCounts[type]++;

        const billStatus = getBillStatus(p);
        const outstanding = grandTotalDue > payment ? grandTotalDue - payment : 0;
        
        if (grandTotalDue > 0) {
          calculatedTotalBilled += grandTotalDue;
          calculatedTotalOutstanding += outstanding;
          
          switch(billStatus) {
            case 'Paid':
              amountPaid += grandTotalDue;
              break;
            case 'Pending':
              amountPending += outstanding;
              amountPaid += payment;
              break;
            case 'Overdue':
              amountOverdue += outstanding;
               amountPaid += payment;
              break;
            default:
              break;
          }
        }
    });

    const billedVsCollected = [
      { name: 'Financials', billed: calculatedTotalBilled, collected: calculatedTotalRevenue }
    ];
    
    const collectionRate = calculatedTotalBilled > 0 ? (calculatedTotalRevenue / calculatedTotalBilled) * 100 : 0;

    const paymentStatusData: PaymentStatusData[] = [
      { name: 'Paid', value: amountPaid, fill: 'hsl(var(--primary))' },
      { name: 'Pending', value: amountPending, fill: 'hsl(var(--accent))' },
      { name: 'Overdue', value: amountOverdue, fill: 'hsl(var(--destructive))' },
    ];
    
    const paymentStatus = paymentStatusData.filter(d => d.value > 0.01);
    
    const revenueByPropertyType = Object.entries(revenueData)
      .map(([name, revenue]) => ({ name, revenue }))
      .filter(d => d.revenue > 0);

    const propertyTypeCounts = Object.entries(propertyCounts).map(([name, count]) => ({
        name,
        value: count,
        fill: `var(--color-${(name || 'other').toLowerCase().split(' ').join('')})`,
    })).filter(d => d.value > 0);

    return {
      totalRevenue: calculatedTotalRevenue,
      totalBilled: calculatedTotalBilled,
      collectionRate,
      totalOutstanding: calculatedTotalOutstanding,
      paymentStatus,
      revenueByPropertyType,
      propertyTypeCounts,
      billedVsCollected,
    };
  }, [properties]);
  

  const sortedBills = React.useMemo(() => {
    if (!bills) return [];
    // Corrected logic to use 'generatedAt' instead of non-existent 'date'
    return [...bills].sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());
  }, [bills]);
  
  const totalFinancialStatus = React.useMemo(() => dashboardData.paymentStatus.reduce((acc, curr) => acc + curr.value, 0), [dashboardData.paymentStatus]);
  const hasData = properties.length > 0;

  const handleExport = (data: any[], fileName: string) => {
    if (!data || data.length === 0) {
      toast({
        variant: 'destructive',
        title: 'No Data to Export',
        description: 'There is no data available for this chart.',
      });
      return;
    }
    
    try {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
        XLSX.writeFile(workbook, `${fileName}.xlsx`);
        toast({
            title: 'Export Successful',
            description: `Data has been exported to ${fileName}.xlsx`,
        });
    } catch (error) {
        toast({
            variant: 'destructive',
            title: 'Export Failed',
            description: 'Could not export the data.',
        });
    }
  };


  if (loading) {
    return (
        <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between space-y-2">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Dashboard</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue Collected</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(dashboardData.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">Total payments received to date</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Amount Billed</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(dashboardData.totalBilled)}</div>
            <p className="text-xs text-muted-foreground">Total value of all generated bills</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(dashboardData.totalOutstanding)}</div>
            <p className="text-xs text-muted-foreground">Total value of unpaid bills</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Properties in System</CardTitle>
            <Home className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{properties.length.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total properties imported</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 grid-cols-1 lg:grid-cols-7">
        <div className="col-span-1 lg:col-span-4 space-y-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Total Billed vs. Collected</CardTitle>
                        <CardDescription>A comparison of the total amount billed versus what has been collected.</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleExport(dashboardData.billedVsCollected, 'billed_vs_collected_summary')}>
                        <Download className="h-4 w-4 mr-2" />
                        Export
                    </Button>
                </CardHeader>
                <CardContent>
                  {hasData && dashboardData.billedVsCollected.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[300px] w-full">
                      <BarChart accessibilityLayer data={dashboardData.billedVsCollected} layout="vertical" barSize={32} barGap={8}>
                        <CartesianGrid horizontal={false} />
                        <XAxis type="number" dataKey="value" hide />
                        <YAxis type="category" dataKey="name" hide />
                        <Tooltip cursor={{ fill: "hsl(var(--muted))" }} content={<ChartTooltipContent hideLabel formatter={(value) => formatCurrency(value as number)} />} />
                        <Legend content={<ChartLegendContent />} />
                        <Bar dataKey="billed" name="Billed" fill="var(--color-billed)" radius={4} />
                        <Bar dataKey="collected" name="Collected" fill="var(--color-collected)" radius={4} />
                      </BarChart>
                    </ChartContainer>
                  ) : (
                    <EmptyState message="Import data to see a billed vs. collected comparison."/>
                  )}
                </CardContent>
                {hasData && dashboardData.collectionRate > 0 && (
                  <CardFooter className="border-t p-4">
                    <div className="flex w-full items-center gap-2 text-sm">
                        <div className="flex items-center gap-2 font-medium leading-none">
                            <TrendingUp className="h-4 w-4 text-primary" /> Overall Collection Rate: {dashboardData.collectionRate.toFixed(1)}%
                        </div>
                    </div>
                  </CardFooter>
                )}
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Revenue by Property Type</CardTitle>
                  <CardDescription>Total revenue collected from different property types.</CardDescription>
                </div>
                 <Button variant="outline" size="sm" onClick={() => handleExport(dashboardData.revenueByPropertyType, 'revenue_by_property_type')}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                </Button>
              </CardHeader>
              <CardContent className="pl-2">
                {hasData && dashboardData.revenueByPropertyType.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[300px] w-full">
                        <BarChart accessibilityLayer data={dashboardData.revenueByPropertyType}>
                            <CartesianGrid vertical={false} />
                            <XAxis dataKey="name" tickLine={false} tickMargin={10} axisLine={false} />
                            <YAxis tickFormatter={(value) => `GHS ${Number(value) / 1000}k`} />
                            <Tooltip
                            cursor={false}
                            content={<ChartTooltipContent formatter={(value) => formatCurrency(value as number)} />}
                            />
                            <Bar dataKey="revenue" fill="var(--color-revenue)" radius={8} />
                        </BarChart>
                    </ChartContainer>
                ) : (
                    <EmptyState message="Import property data to see revenue breakdown." />
                )}
              </CardContent>
            </Card>
        </div>
        <div className="col-span-1 lg:col-span-3 space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Financial Status</CardTitle>
                  <CardDescription>Breakdown of total billed amount by payment status.</CardDescription>
                </div>
                 <Button variant="outline" size="sm" onClick={() => handleExport(dashboardData.paymentStatus, 'financial_status_summary')}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                </Button>
              </CardHeader>
              <CardContent>
                {hasData && dashboardData.paymentStatus.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[300px] w-full">
                        <PieChart>
                            <Tooltip 
                            content={<ChartTooltipContent 
                                hideLabel 
                                formatter={(value, name) => (
                                <div className="flex min-w-[120px] items-center justify-between">
                                    <span className="capitalize">{name}</span>
                                    <span className="font-bold">{formatCurrency(value as number)}</span>
                                </div>
                                )}
                            />} 
                            />
                            <Pie data={dashboardData.paymentStatus} dataKey="value" nameKey="name" innerRadius={60} outerRadius={80} strokeWidth={5}>
                            {dashboardData.paymentStatus.map((entry) => (
                                <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                            ))}
                            </Pie>
                             <ChartLegend
                              content={<ChartLegendContent nameKey="name" />}
                              verticalAlign="bottom"
                              align="center"
                              wrapperStyle={{paddingTop: '20px'}}
                            />
                        </PieChart>
                    </ChartContainer>
                 ) : (
                    <EmptyState message="Import property data to see financial status." />
                )}
              </CardContent>
               {hasData && dashboardData.paymentStatus.length > 0 && (
                <CardFooter className="border-t pt-4">
                     <div className="flex w-full items-start gap-2 text-sm">
                        <div className="grid gap-2">
                            <div className="flex items-center gap-2 font-medium leading-none">
                            <Coins className="h-4 w-4 text-muted-foreground" /> Total amount represented: {formatCurrency(totalFinancialStatus)}
                            </div>
                        </div>
                    </div>
                </CardFooter>
              )}
            </Card>
             <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Property Type Distribution</CardTitle>
                  <CardDescription>Breakdown of properties by designated type.</CardDescription>
                </div>
                 <Button variant="outline" size="sm" onClick={() => handleExport(dashboardData.propertyTypeCounts.map(({fill, ...rest}) => rest), 'property_type_distribution')}>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                </Button>
              </CardHeader>
              <CardContent>
                {hasData && dashboardData.propertyTypeCounts.length > 0 ? (
                    <ChartContainer config={chartConfig} className="h-[300px] w-full">
                        <PieChart>
                            <Tooltip 
                            content={<ChartTooltipContent 
                                hideLabel
                                formatter={(value, name) => `${value} ${name} Properties`}
                            />} 
                            />
                            <Pie data={dashboardData.propertyTypeCounts} dataKey="value" nameKey="name" innerRadius={0} outerRadius={100} paddingAngle={2} >
                            {dashboardData.propertyTypeCounts.map((entry) => (
                                <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                            ))}
                            </Pie>
                            <ChartLegend
                              content={<ChartLegendContent nameKey="name" />}
                              verticalAlign="bottom"
                              align="center"
                              wrapperStyle={{paddingTop: '20px'}}
                            />
                        </PieChart>
                    </ChartContainer>
                 ) : (
                    <EmptyState message="Import property data to see property distribution." />
                )}
              </CardContent>
            </Card>
        </div>
      </div>
      <Card>
          <CardHeader>
              <CardTitle>Recent Activities</CardTitle>
              <CardDescription>A log of the most recently generated bills in the system.</CardDescription>
          </CardHeader>
          <CardContent>
            {sortedBills.length > 0 ? (
                <div className="w-full overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Property No.</TableHead>
                                <TableHead>Owner Name</TableHead>
                                <TableHead>Date Generated</TableHead>
                                <TableHead>Year</TableHead>
                                <TableHead className="text-right">Amount Due</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedBills.slice(0, 5).map(bill => (
                                <TableRow key={bill.id}>
                                    <TableCell className="font-medium">{getPropertyValue(bill.propertySnapshot, 'Property No') || ''}</TableCell>
                                    <TableCell>{getPropertyValue(bill.propertySnapshot, 'Owner Name') || ''}</TableCell>
                                    <TableCell>{formatDate(bill.generatedAt)}</TableCell>
                                    <TableCell><Badge variant="outline">{bill.year}</Badge></TableCell>
                                    <TableCell className="text-right font-mono">{formatCurrency(bill.totalAmountDue)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                <div className="text-center text-muted-foreground py-12 flex flex-col items-center">
                    <List className="h-12 w-12 text-muted-foreground mb-4" />
                    <p>No recent activities found.</p>
                    <p className="text-sm">Generate some bills to see them here.</p>
                </div>
            )}
          </CardContent>
      </Card>
    </>
  );
}
