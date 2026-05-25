'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useSmsLogs } from '@/context/SmsLogContext';
import { useRequirePermission } from '@/hooks/useRequirePermission';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, Phone, User, AlertCircle, CheckCircle2, History } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

const ROWS_PER_PAGE = 20;

const formatTimestamp = (isoString: string) => {
  return new Date(isoString).toLocaleString('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
};

export default function SmsLogsPage() {
  useRequirePermission();
  const { smsLogs, refreshLogs } = useSmsLogs();
  const isMobile = useIsMobile();
  const [filter, setFilter] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);

  React.useEffect(() => {
      refreshLogs();
  }, [refreshLogs]);

  const filteredData = React.useMemo(() => {
    if (!filter) return smsLogs;
    return smsLogs.filter(log =>
      log.recipientName.toLowerCase().includes(filter.toLowerCase()) ||
      log.recipientPhone.includes(filter) ||
      log.message.toLowerCase().includes(filter.toLowerCase()) ||
      log.status.toLowerCase().includes(filter.toLowerCase()) ||
      (log.error || '').toLowerCase().includes(filter.toLowerCase())
    );
  }, [smsLogs, filter]);

  const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);
  const paginatedData = React.useMemo(() => {
    return filteredData.slice(
      (currentPage - 1) * ROWS_PER_PAGE,
      currentPage * ROWS_PER_PAGE
    );
  }, [filteredData, currentPage]);
  
  React.useEffect(() => {
    setCurrentPage(1);
  }, [filteredData]);

  if (smsLogs.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center h-[calc(100vh-20rem)]">
            <History className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No SMS Logs Recorded</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              A history of sent and failed messages will appear here.
            </p>
        </div>
    );
  }

  const renderDesktopView = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[180px]">Recipient</TableHead>
          <TableHead className="w-[120px]">Phone</TableHead>
          <TableHead>Message Content</TableHead>
          <TableHead className="w-[100px]">Status</TableHead>
          <TableHead className="w-[150px] text-right">Timestamp</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {paginatedData.map(log => (
          <TableRow key={log.id} className="text-sm">
            <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                    <User className="h-3 w-3 text-muted-foreground" />
                    {log.recipientName}
                </div>
            </TableCell>
            <TableCell className="font-mono text-xs">
                <div className="flex items-center gap-2">
                    <Phone className="h-3 w-3 text-muted-foreground" />
                    {log.recipientPhone}
                </div>
            </TableCell>
            <TableCell>
                <div className="max-w-[400px] text-xs text-muted-foreground line-clamp-2">
                    {log.message}
                </div>
            </TableCell>
            <TableCell>
              <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                         <Badge variant={log.status === 'Success' ? 'default' : 'destructive'} className="cursor-help">
                            {log.status === 'Success' ? <CheckCircle2 className="h-3 w-3 mr-1" /> : <AlertCircle className="h-3 w-3 mr-1" />}
                            {log.status}
                        </Badge>
                    </TooltipTrigger>
                    {log.error && (
                        <TooltipContent className="bg-destructive text-destructive-foreground">
                            <p className="max-w-xs">{log.error}</p>
                        </TooltipContent>
                    )}
                </Tooltip>
              </TooltipProvider>
            </TableCell>
            <TableCell className="text-right text-muted-foreground text-xs whitespace-nowrap">
                 {formatTimestamp(log.timestamp)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  const renderMobileView = () => (
    <div className="space-y-4">
        {paginatedData.map(log => (
            <Card key={log.id}>
                <CardHeader className="pb-3 border-b">
                    <div className="flex items-center justify-between">
                         <div className="flex flex-col">
                            <span className="font-bold text-sm">{log.recipientName}</span>
                            <span className="text-[10px] font-mono text-muted-foreground">{log.recipientPhone}</span>
                         </div>
                         <Badge variant={log.status === 'Success' ? 'default' : 'destructive'} className="text-[10px]">
                            {log.status}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="pt-3 space-y-2">
                    <p className="text-xs text-muted-foreground italic leading-relaxed">"{log.message}"</p>
                    {log.error && (
                         <div className="bg-destructive/10 text-destructive text-[10px] p-2 rounded border border-destructive/20 flex gap-2 items-start">
                            <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
                            <span>{log.error}</span>
                        </div>
                    )}
                </CardContent>
                <CardFooter className="pt-0 text-[10px] text-muted-foreground justify-end">
                    {formatTimestamp(log.timestamp)}
                </CardFooter>
            </Card>
        ))}
    </div>
  )

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight font-headline">SMS Delivery Logs</h1>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Communication Ledger
          </CardTitle>
          <CardDescription>A complete history of automated and manual SMS notifications.</CardDescription>
          <div className="pt-4">
            <Input 
                placeholder="Search by name, number, or message..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
            {isMobile ? renderMobileView() : renderDesktopView()}
        </CardContent>
        {totalPages > 1 && (
            <CardFooter className="flex justify-between items-center border-t pt-4">
                <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages} ({filteredData.length} total logs)
                </span>
                <div className="flex items-center gap-2">
                    <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
                    disabled={currentPage === 1}
                    >
                    Previous
                    </Button>
                    <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    >
                    Next
                    </Button>
                </div>
            </CardFooter>
        )}
      </Card>
    </>
  );
}
