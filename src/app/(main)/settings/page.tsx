'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { usePropertyData } from '@/context/PropertyDataContext';
import { useBopData } from '@/context/BopDataContext';
import { useLicenseData } from '@/context/LicenseDataContext';
import { Checkbox } from '@/components/ui/checkbox';
import { useRequirePermission } from '@/hooks/useRequirePermission';
import { PERMISSION_PAGES, usePermissions } from '@/context/PermissionsContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Property, Bop, License, UserRole, PermissionPage } from '@/lib/types';
import { PrintableContent } from '@/components/bill-dialog';
import { Loader2, Server, Download, UploadCloud, MessageSquare, Phone } from 'lucide-react';
import { store, saveStore } from '@/lib/store';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { getPropertyValue } from '@/lib/property-utils';

const generalFormSchema = z.object({
  systemName: z.string().min(3, 'System name must be at least 3 characters.'),
  assemblyName: z.string().min(3, 'Assembly name must be at least 3 characters.'),
  postalAddress: z.string().min(5, 'Postal address seems too short.'),
  contactPhone: z.string().min(10, 'Phone number seems too short.'),
  contactEmail: z.string().email(),
});

const appearanceFormSchema = z.object({
  assemblyLogo: z.any().optional(),
  ghanaLogo: z.any().optional(),
  signature: z.any().optional(),
  billWarningText: z.string().max(200).optional(),
  fontFamily: z.enum(['sans', 'serif', 'mono']).default('sans'),
  fontSize: z.coerce.number().min(8).max(14).default(12),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color code").default('#F1F5F9'),
});

const integrationsFormSchema = z.object({
  googleSheetUrl: z.string().url().optional().or(z.literal('')),
  bopGoogleSheetUrl: z.string().url().optional().or(z.literal('')),
  summaryBillGoogleSheetUrl: z.string().url().optional().or(z.literal('')),
});

const smsFormSchema = z.object({
  provider: z.enum(['arkesel', 'twilio', 'sms_gh', 'none']),
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
  senderId: z.string().optional(),
  twilioSid: z.string().optional(),
  twilioToken: z.string().optional(),
  twilioFrom: z.string().optional(),
  enableSmsOnNewProperty: z.boolean().default(false),
  newPropertyMessageTemplate: z.string().max(320).optional(),
  enableSmsOnBillGenerated: z.boolean().default(false),
  billGeneratedMessageTemplate: z.string().max(320).optional(),
  enableSmsOnManualPayment: z.boolean().default(false),
  manualPaymentMessageTemplate: z.string().max(320).optional(),
});

const ImageUploadPreview = ({ src, alt }: { src: string | null, alt: string }) => {
    if (!src) return null;
    return (
        <div className="mt-2 relative aspect-video w-full max-w-[200px] overflow-hidden rounded-md border bg-muted/50 flex items-center justify-center">
             {/* eslint-disable-next-line @next/next/no-img-element */}
             <img src={src} alt={alt} style={{ height: '80%', objectFit: 'contain' }} />
        </div>
    )
}

const PlaceholderGuide = ({ common, property, bop, license, payment }: { common: string[], property: string[], bop: string[], license: string[], payment?: string[] }) => (
    <div className="text-xs text-muted-foreground space-y-2 rounded-lg border bg-background/50 p-3 mt-2">
        <p className="font-bold mb-1">Available Placeholders:</p>
        <div className="flex flex-wrap gap-1">
            {[...common, ...property, ...bop, ...license, ...(payment || [])].map(p => (
                <code key={p} className="rounded bg-muted px-1 font-mono">{`{{${p}}}`}</code>
            ))}
        </div>
    </div>
);

export default function SettingsPage() {
  useRequirePermission();
  const { properties } = usePropertyData();
  const { bopData } = useBopData();
  const { licenseData } = useLicenseData();
  const { permissions, updatePermissions } = usePermissions();
  const [loading, setLoading] = useState(true);

  const [billFields, setBillFields] = useState<Record<string, boolean>>({});

  const generalForm = useForm<z.infer<typeof generalFormSchema>>({
    resolver: zodResolver(generalFormSchema),
    defaultValues: store.settings.generalSettings,
  });

  const appearanceForm = useForm<z.infer<typeof appearanceFormSchema>>({
    resolver: zodResolver(appearanceFormSchema),
    defaultValues: store.settings.appearanceSettings,
  });

  const smsForm = useForm<z.infer<typeof smsFormSchema>>({
    resolver: zodResolver(smsFormSchema),
    defaultValues: store.settings.smsSettings,
  });

  const watchedProvider = smsForm.watch('provider');

  useEffect(() => {
    setLoading(true);
    generalForm.reset(store.settings.generalSettings);
    appearanceForm.reset(store.settings.appearanceSettings);
    smsForm.reset(store.settings.smsSettings);
    setBillFields(store.settings.billDisplaySettings || {});
    setLoading(false);
  }, [generalForm, appearanceForm, smsForm]);

  const onGeneralSave = (data: z.infer<typeof generalFormSchema>) => {
    store.settings.generalSettings = data;
    saveStore();
    toast({ title: 'Settings Saved' });
    setTimeout(() => window.location.reload(), 500);
  };

  const onAppearanceSave = () => {
    store.settings.appearanceSettings = appearanceForm.getValues();
    store.settings.billDisplaySettings = billFields;
    saveStore();
    toast({ title: 'Appearance Saved' });
    setTimeout(() => window.location.reload(), 500);
  };

  const onSmsSave = (data: z.infer<typeof smsFormSchema>) => {
    store.settings.smsSettings = data;
    saveStore();
    toast({ title: 'SMS Configuration Saved' });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: 'assemblyLogo' | 'ghanaLogo' | 'signature') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => appearanceForm.setValue(fieldName, reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight font-headline">System Configuration</h1>
      <Tabs defaultValue="general">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="sms">SMS Gateway</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="backup">Data Tools</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Form {...generalForm}>
            <form onSubmit={generalForm.handleSubmit(onGeneralSave)}>
              <Card>
                <CardHeader><CardTitle>Assembly Details</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <FormField control={generalForm.control} name="assemblyName" render={({ field }) => (
                    <FormItem><FormLabel>Assembly Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                   <FormField control={generalForm.control} name="postalAddress" render={({ field }) => (
                    <FormItem><FormLabel>Address</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                   <FormField control={generalForm.control} name="contactPhone" render={({ field }) => (
                    <FormItem><FormLabel>Contact Phone(s)</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                  )} />
                </CardContent>
                <CardFooter><Button type="submit">Update Assembly Info</Button></CardFooter>
              </Card>
            </form>
          </Form>
        </TabsContent>

        <TabsContent value="appearance">
          <Form {...appearanceForm}>
            <form onSubmit={appearanceForm.handleSubmit(onAppearanceSave)}>
              <Card>
                <CardHeader><CardTitle>Branding & Layout</CardTitle></CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <FormField control={appearanceForm.control} name="assemblyLogo" render={({ field }) => (
                      <FormItem><FormLabel>Assembly Logo</FormLabel><FormControl><Input type="file" onChange={(e) => handleFileChange(e, 'assemblyLogo')} /></FormControl><ImageUploadPreview src={field.value} alt="Logo" /></FormItem>
                    )} />
                     <FormField control={appearanceForm.control} name="signature" render={({ field }) => (
                      <FormItem><FormLabel>Director Signature</FormLabel><FormControl><Input type="file" onChange={(e) => handleFileChange(e, 'signature')} /></FormControl><ImageUploadPreview src={field.value} alt="Sig" /></FormItem>
                    )} />
                    <FormField control={appearanceForm.control} name="billWarningText" render={({ field }) => (
                      <FormItem><FormLabel>Bill Footer Warning</FormLabel><FormControl><Textarea {...field} /></FormControl></FormItem>
                    )} />
                  </div>
                  <div className="bg-white p-4 border rounded-lg shadow-inner flex items-center justify-center min-h-[300px]">
                      <p className="text-muted-foreground text-sm">Bill Preview rendering on separate device...</p>
                  </div>
                </CardContent>
                <CardFooter><Button type="submit">Save Branding</Button></CardFooter>
              </Card>
            </form>
          </Form>
        </TabsContent>

        <TabsContent value="sms">
          <Form {...smsForm}>
            <form onSubmit={smsForm.handleSubmit(onSmsSave)}>
              <Card>
                <CardHeader><CardTitle>SMS API Configuration</CardTitle><CardDescription>Choose your provider and enter credentials.</CardDescription></CardHeader>
                <CardContent className="space-y-6">
                  <FormField control={smsForm.control} name="provider" render={({ field }) => (
                    <FormItem><FormLabel>Service Provider</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="none">Disabled</SelectItem>
                          <SelectItem value="arkesel">Arkesel (Ghana)</SelectItem>
                          <SelectItem value="twilio">Twilio (Global)</SelectItem>
                          <SelectItem value="sms_gh">SMS Online GH</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )} />

                  {watchedProvider === 'arkesel' && (
                    <div className="grid gap-4 p-4 border rounded-lg bg-muted/20">
                      <FormField control={smsForm.control} name="apiKey" render={({ field }) => (
                        <FormItem><FormLabel>API Key</FormLabel><FormControl><Input type="password" {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={smsForm.control} name="senderId" render={({ field }) => (
                        <FormItem><FormLabel>Sender ID</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                      )} />
                    </div>
                  )}

                  {watchedProvider === 'twilio' && (
                    <div className="grid gap-4 p-4 border rounded-lg bg-muted/20">
                      <FormField control={smsForm.control} name="twilioSid" render={({ field }) => (
                        <FormItem><FormLabel>Account SID</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={smsForm.control} name="twilioToken" render={({ field }) => (
                        <FormItem><FormLabel>Auth Token</FormLabel><FormControl><Input type="password" {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={smsForm.control} name="twilioFrom" render={({ field }) => (
                        <FormItem><FormLabel>Twilio Number (E.164)</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                      )} />
                    </div>
                  )}

                  <div className="border-t pt-6 space-y-6">
                    <h3 className="font-bold text-lg">Automated Messaging</h3>
                    
                    <div className="space-y-4">
                      <FormField control={smsForm.control} name="enableSmsOnManualPayment" render={({ field }) => (
                        <FormItem className="flex items-center justify-between p-3 border rounded-md">
                          <div>
                            <FormLabel>Enable Auto-SMS on Manual Payment</FormLabel>
                            <FormDescription>Send a receipt confirmation after recording cash/manual payments.</FormDescription>
                          </div>
                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                      )} />
                      <FormField control={smsForm.control} name="manualPaymentMessageTemplate" render={({ field }) => (
                          <FormItem><FormLabel>Payment Confirmation Template</FormLabel><FormControl><Textarea {...field} /></FormControl>
                          <PlaceholderGuide common={['Owner Name', 'Amount Owed', 'Year']} property={[]} bop={[]} license={[]} payment={['Amount Paid', 'Payment Date', 'Receipt No']} />
                          </FormItem>
                      )} />
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                      <FormField control={smsForm.control} name="enableSmsOnBillGenerated" render={({ field }) => (
                        <FormItem className="flex items-center justify-between p-3 border rounded-md">
                          <div>
                            <FormLabel>Enable Auto-SMS on Bill Generation</FormLabel>
                            <FormDescription>Notify users when a new bill is printed or recorded.</FormDescription>
                          </div>
                          <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                      )} />
                       <FormField control={smsForm.control} name="billGeneratedMessageTemplate" render={({ field }) => (
                          <FormItem><FormLabel>Bill Notification Template</FormLabel><FormControl><Textarea {...field} /></FormControl>
                          <PlaceholderGuide common={['Owner Name', 'Amount Owed', 'Year']} property={[]} bop={[]} license={[]} />
                          </FormItem>
                      )} />
                    </div>
                  </div>
                </CardContent>
                <CardFooter><Button type="submit">Activate SMS Gateway</Button></CardFooter>
              </Card>
            </form>
          </Form>
        </TabsContent>
        
        <TabsContent value="backup">
            <Card>
                <CardHeader><CardTitle>System Maintenance</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="p-4 border rounded-lg flex items-center justify-between">
                        <div><h4 className="font-bold">Database Backup</h4><p className="text-sm text-muted-foreground">Download all data as JSON.</p></div>
                        <Button variant="outline" onClick={() => {
                            const data = localStorage.getItem('rateease.store');
                            const blob = new Blob([data || '{}'], {type: 'application/json'});
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url; a.download = `backup-${new Date().toISOString()}.json`;
                            a.click();
                        }}><Download className="mr-2 h-4 w-4" /> Download</Button>
                    </div>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
