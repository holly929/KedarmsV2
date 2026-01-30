
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useRequirePermission } from '@/hooks/useRequirePermission';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { BookCopy, AlertCircle, Loader2, Info, Server } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { store } from '@/lib/store';

const getEditableSheetUrl = (originalUrl: string): string => {
  if (!originalUrl) return '';
  const regex = /spreadsheets\/d\/([a-zA-Z0-9-_]+)/;
  const match = originalUrl.match(regex);
  if (match && match[1]) {
    const sheetId = match[1];
    return `https://docs.google.com/spreadsheets/d/${sheetId}/edit`;
  }
  return '';
};

function GoogleSheetIntegration({ settingKey, title, description, emptyStateText }: { settingKey: 'googleSheetUrl' | 'bopGoogleSheetUrl' | 'summaryBillGoogleSheetUrl', title: string, description: string, emptyStateText: string }) {
  const [sheetUrl, setSheetUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    const integrationsSettings = store.settings.integrationsSettings;
    if (integrationsSettings && integrationsSettings[settingKey]) {
        setSheetUrl(getEditableSheetUrl(integrationsSettings[settingKey]));
    }
    setIsLoading(false);
  }, [settingKey]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : sheetUrl ? (
          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Having trouble editing?</AlertTitle>
              <AlertDescription>
                To view and edit the sheet, you must be logged into the correct Google account in this browser. If the sheet doesn't load, try opening it in a new tab first, then refresh this page.
              </AlertDescription>
            </Alert>
            <div className="aspect-video w-full rounded-lg border">
              <iframe
                src={sheetUrl}
                className="w-full h-full"
                frameBorder="0"
                title="Embedded Google Sheet"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              >
                Loading...
              </iframe>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 text-center h-[calc(100vh-30rem)]">
            <BookCopy className="h-12 w-12 text-muted-foreground" />
            <h3 className="mt-4 text-lg font-semibold">{emptyStateText}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Please go to the <Button variant="link" asChild className="p-0 h-auto"><Link href="/settings">Settings</Link></Button> page to connect a Google Sheet.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SmsFeatureInfo() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Automated SMS Notifications</CardTitle>
        <CardDescription>
          Keep property owners informed with automatic SMS alerts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>How It Works</AlertTitle>
          <AlertDescription>
            The system can automatically send SMS notifications when key events happen, such as when a new property is registered or a new bill is generated.
          </AlertDescription>
        </Alert>
        <Alert>
          <Server className="h-4 w-4" />
          <AlertTitle>Configuration Required</AlertTitle>
          <AlertDescription>
            This feature is powered by Infobip. To enable it, you must configure your Infobip API credentials and message templates on the Settings page.
          </AlertDescription>
        </Alert>
      </CardContent>
      <CardFooter>
         <Button asChild>
            <Link href="/settings">Go to Settings</Link>
          </Button>
      </CardFooter>
    </Card>
  )
}

export default function IntegrationsPage() {
  useRequirePermission();

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight font-headline">Integrations</h1>
      </div>
      
      <Tabs defaultValue="sheets" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sheets">Property Rates Sheet</TabsTrigger>
          <TabsTrigger value="bop-sheets">BOP Sheet</TabsTrigger>
          <TabsTrigger value="sms">SMS</TabsTrigger>
        </TabsList>
        <TabsContent value="sheets">
          <GoogleSheetIntegration 
            settingKey="googleSheetUrl"
            title="Property Rate Payments"
            description="View and edit your connected property rate payments spreadsheet."
            emptyStateText="No Property Rate Spreadsheet Connected"
          />
        </TabsContent>
        <TabsContent value="bop-sheets">
          <GoogleSheetIntegration 
            settingKey="bopGoogleSheetUrl"
            title="BOP Payments"
            description="View and edit your connected Business Operating Permit (BOP) payments spreadsheet."
            emptyStateText="No BOP Spreadsheet Connected"
          />
        </TabsContent>
         <TabsContent value="sms">
          <SmsFeatureInfo />
        </TabsContent>
      </Tabs>
    </>
  );
}
