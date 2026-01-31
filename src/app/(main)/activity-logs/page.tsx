
'use client';

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useActivityLogState } from '@/context/ActivityLogContext';
import { useRequirePermission } from '@/hooks/useRequirePermission';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { FileClock, User } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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

export default function ActivityLogsPage() {
  useRequirePermission();
  const activityLogs = useActivityLogState();
  const isMobile = useIsMobile();
  const [filter, setFilter] = React.useState('');
  const [currentPage, setCurrentPage] = React.useState(1);

  const filteredData = React.useMemo(() => {
    if (!filter) return activityLogs;
    return activityLogs.filter(log =>
      log.action.toLowerCase().includes(filter.toLowerCase()) ||
      log.userName.toLowerCase().includes(filter.toLowerCase()) ||
      log.userEmail.toLowerCase().includes(filter.toLowerCase()) ||
      log.details?.toLowerCase().includes(filter.toLowerCase())
    );
  }, [activityLogs, filter]);

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

  if (activityLogs.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center h-[calc(100vh-20rem)]">
            <FileClock className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">No Activities Recorded Yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              User actions will be logged here once they are performed.
            </p>
        </div>
    );
  }

  const renderDesktopView = () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[200px]">User</TableHead>
          <TableHead>Action</TableHead>
          <TableHead>Details</TableHead>
          <TableHead className="w-[200px] text-right">Timestamp</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {paginatedData.map(log => (
          <TableRow key={log.id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback>{log.userName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                    <span className="font-medium text-sm">{log.userName}</span>
                    <span className="text-xs text-muted-foreground">{log.userEmail}</span>
                </div>
              </div>
            </TableCell>
            <TableCell><Badge variant="secondary">{log.action}</Badge></TableCell>
            <TableCell className="text-muted-foreground text-xs">{log.details}</TableCell>
            <TableCell className="text-right text-muted-foreground text-xs">
                 <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger>{formatTimestamp(log.timestamp)}</TooltipTrigger>
                        <TooltipContent>
                            <p>{new Date(log.timestamp).toISOString()}</p>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
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
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                         <Badge variant="secondary">{log.action}</Badge>
                         <p className="text-xs text-muted-foreground">{formatTimestamp(log.timestamp)}</p>
                    </div>
                </CardHeader>
                <CardContent className="space-y-3">
                    {log.details && (
                        <p className="text-sm text-muted-foreground">{log.details}</p>
                    )}
                    <div className="flex items-center gap-3 border-t pt-3">
                        <User className="h-4 w-4 text-muted-foreground"/>
                        <span className="text-sm font-medium">{log.userName}</span>
                        <span className="text-sm text-muted-foreground">({log.userEmail})</span>
                    </div>
                </CardContent>
            </Card>
        ))}
    </div>
  )

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight font-headline">User Activity Logs</h1>
      <Card>
        <CardHeader>
          <CardTitle>Activity Stream</CardTitle>
          <CardDescription>A chronological record of actions performed in the system.</CardDescription>
          <div className="pt-4">
            <Input 
                placeholder="Filter logs by user, action, or details..."
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
