'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { useRequirePermission } from '@/hooks/useRequirePermission';
import { PrintableContent } from '@/components/bill-dialog';
import { Loader2, Download, UploadCloud, Type, Palette, ShieldCheck, Image as ImageIcon, Trash2, RefreshCcw, RotateCcw, ShieldAlert, History } from 'lucide-react';
import { store, saveStore, clearAllTransactionsInStore, factoryResetStore } from '@/lib/store';
import { Separator } from '@/components/ui/separator';
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
import { usePropertyData } from '@/context/PropertyDataContext';
import { useBopData } from '@/context/BopDataContext';
import { useLicenseData } from '@/context/LicenseDataContext';
import { useBillData } from '@/context/BillDataContext';
import { useActivityLogClear, useActivityLogDispatch } from '@/context/ActivityLogContext';

const generalFormSchema = z.object({
  systemName: z.string().min(3, 'System name must be at least 3 characters.'),
  assemblyName: z.string().min(3, 'Assembly name must be at least 3 characters.'),
  postalAddress: z.string().min(5, 'Postal address seems too short.'),
  contactPhone: z.string().min(10, 'Phone number seems too short.'),
  contactEmail: z.string().email(),
});

const appearanceFormSchema = z.object({
  assemblyLogo: z.string().optional(),
  ghanaLogo: z.string().optional(),
  signature: z.string().optional(),
  billWarningText: z.string().max(200).optional(),
  fontFamily: z.enum(['sans', 'serif', 'mono']).default('sans'),
  fontSize: z.coerce.number().min(8).max(14).default(12),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color code").default('#F1F5F9'),
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

const DUMMY_PROPERTY = {
  id: 'preview-123',
  'Owner Name': 'HON. KOFI MANSAH',
  'Property No': 'KE-ABET-001',
  'Town': 'ABETIFI',
  'Suburb': 'CHRISTIAN QUARTERS',
  'Property Type': 'Residential',
  'Rateable Value': 50000,
  'Rate Impost': 0.005,
  'Sanitation Charged': 150,
  'Previous Balance': 200,
  'Total Payment': 100,
};

export default function SettingsPage() {
  useRequirePermission();
  const [loading, setLoading] = useState(true);
  
  const { deleteAllProperties } = usePropertyData();
  const { deleteAllBop } = useBopData();
  const { deleteAllLicense } = useLicenseData();
  const { deleteAllBills } = useBillData();
  const clearLogs = useActivityLogClear();
  const addLog = useActivityLogDispatch();

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
  const appearanceValues = appearanceForm.watch();
  const generalValues = generalForm.watch();

  useEffect(() => {
    setLoading(true);
    generalForm.reset(store.settings.generalSettings);
    appearanceForm.reset(store.settings.appearanceSettings);
    smsForm.reset(store.settings.smsSettings);
    setLoading(false);
  }, [generalForm, appearanceForm, smsForm]);

  const onGeneralSave = (data: z.infer<typeof generalFormSchema>) => {
    store.settings.generalSettings = data;
    saveStore();
    toast({ title: 'General Settings Saved' });
  };

  const onAppearanceSave = (data: z.infer<typeof appearanceFormSchema>) => {
    store.settings.appearanceSettings = data;
    saveStore();
    toast({ title: 'Appearance Settings Saved' });
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
      reader.onloadend = () => {
        appearanceForm.setValue(fieldName, reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClearTransactions = () => {
    clearAllTransactionsInStore();
    addLog('System Maintenance', 'All transaction payments were cleared.');
    toast({ title: 'Transactions Cleared', description: 'All payments across the system have been reset to zero.' });
    setTimeout(() => window.location.reload(), 1000);
  };

  if (loading) return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight font-headline">System Settings</h1>
      
      <Tabs defaultValue="appearance" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto">
          <TabsTrigger value="general" className="py-2">General</TabsTrigger>
          <TabsTrigger value="appearance" className="py-2">Appearance & Branding</TabsTrigger>
          <TabsTrigger value="sms" className="py-2">SMS Gateway</TabsTrigger>
          <TabsTrigger value="backup" className="py-2">Maintenance & Data</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Form {...generalForm}>
            <form onSubmit={generalForm.handleSubmit(onGeneralSave)}>
              <Card>
                <CardHeader>
                  <CardTitle>Assembly Information</CardTitle>
                  <CardDescription>Main contact details used on official documents.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={generalForm.control} name="assemblyName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Assembly Name</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={generalForm.control} name="systemName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Software System Name</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                  <FormField control={generalForm.control} name="postalAddress" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Postal Address</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={generalForm.control} name="contactPhone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Telephone</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                    <FormField control={generalForm.control} name="contactEmail" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Official Email</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </div>
                </CardContent>
                <CardFooter>
                  <Button type="submit">Save General Info</Button>
                </CardFooter>
              </Card>
            </form>
          </Form>
        </TabsContent>

        <TabsContent value="appearance">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
            <Form {...appearanceForm}>
              <form onSubmit={appearanceForm.handleSubmit(onAppearanceSave)} className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><ImageIcon className="h-5 w-5" /> Official Branding</CardTitle>
                    <CardDescription>Upload logos and signatures to customize the bill header and footer.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField control={appearanceForm.control} name="ghanaLogo" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ghana Coat of Arms</FormLabel>
                          <FormControl>
                            <div className="space-y-2">
                              <Input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'ghanaLogo')} />
                              {field.value && <img src={field.value} alt="Preview" className="h-16 object-contain border rounded p-1 bg-muted/20" />}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={appearanceForm.control} name="assemblyLogo" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Assembly Logo</FormLabel>
                          <FormControl>
                            <div className="space-y-2">
                              <Input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'assemblyLogo')} />
                              {field.value && <img src={field.value} alt="Preview" className="h-16 object-contain border rounded p-1 bg-muted/20" />}
                            </div>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>
                    <Separator />
                    <FormField control={appearanceForm.control} name="signature" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Authorized Director's Signature</FormLabel>
                        <FormControl>
                          <div className="space-y-2">
                            <Input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'signature')} />
                            {field.value && <img src={field.value} alt="Signature Preview" className="h-12 object-contain border rounded p-1 bg-muted/20" />}
                          </div>
                        </FormControl>
                        <FormDescription>Will appear above "COORDINATING DIRECTOR" on the bill.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Type className="h-5 w-5" /> Typography & Layout</CardTitle>
                    <CardDescription>Adjust the visual style of the printed documents.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField control={appearanceForm.control} name="fontFamily" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Primary Font</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                            <SelectContent>
                              <SelectItem value="sans">Modern Sans-Serif (Inter)</SelectItem>
                              <SelectItem value="serif">Classic Serif (Tinos)</SelectItem>
                              <SelectItem value="mono">Typewriter (Courier)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )} />
                      <FormField control={appearanceForm.control} name="fontSize" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Base Font Size (px)</FormLabel>
                          <FormControl><Input type="number" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )} />
                    </div>

                    <FormField control={appearanceForm.control} name="accentColor" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2"><Palette className="h-4 w-4" /> Total Section Background Color</FormLabel>
                        <div className="flex items-center gap-4">
                          <FormControl><Input type="color" {...field} className="h-10 w-20 p-1" /></FormControl>
                          <span className="text-sm font-mono text-muted-foreground uppercase">{field.value}</span>
                        </div>
                        <FormDescription>Used to highlight the "Total Amount Payable" section on the bill.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={appearanceForm.control} name="billWarningText" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bottom Warning Text</FormLabel>
                        <FormControl><Textarea {...field} placeholder="e.g. PAY AT ONCE OR FACE LEGAL ACTION" /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </CardContent>
                  <CardFooter>
                    <Button type="submit" className="w-full">Apply Appearance Settings</Button>
                  </CardFooter>
                </Card>
              </form>
            </Form>

            <div className="sticky top-20">
               <Card className="overflow-hidden border-2 border-primary/20">
                <CardHeader className="bg-primary/5 py-3">
                    <CardTitle className="text-sm flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary" /> Live Professional Preview</CardTitle>
                </CardHeader>
                <CardContent className="p-0 bg-muted/30 flex justify-center overflow-auto max-h-[80vh]">
                    <div className="scale-[0.5] sm:scale-[0.6] origin-top py-8">
                        <div className="w-[210mm] min-h-[297mm] mx-auto bg-white shadow-2xl">
                             <PrintableContent 
                                property={DUMMY_PROPERTY as any}
                                settings={{
                                    general: generalValues,
                                    appearance: appearanceValues
                                }}
                            />
                        </div>
                    </div>
                </CardContent>
               </Card>
               <p className="text-xs text-muted-foreground mt-4 text-center">
                 Note: This is a scaled-down preview. Actual print quality is standard A4 high-resolution.
               </p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sms">
          <Form {...smsForm}>
            <form onSubmit={smsForm.handleSubmit(onSmsSave)}>
              <Card>
                <CardHeader><CardTitle>SMS Gateway API Configuration</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <FormField control={smsForm.control} name="provider" render={({ field }) => (
                    <FormItem><FormLabel>Service Provider</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="none">None (Disabled)</SelectItem>
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
                        <FormItem><FormLabel>Arkesel API Key</FormLabel><FormControl><Input type="password" {...field} /></FormControl></FormItem>
                      )} />
                      <FormField control={smsForm.control} name="senderId" render={({ field }) => (
                        <FormItem><FormLabel>Sender ID (Custom Name)</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                      )} />
                    </div>
                  )}

                  <div className="grid gap-6 border-t pt-6">
                    <h3 className="font-bold">Message Templates</h3>
                    <FormField control={smsForm.control} name="manualPaymentMessageTemplate" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Manual Payment Confirmation Template</FormLabel>
                        <FormControl><Textarea {...field} rows={3} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                </CardContent>
                <CardFooter><Button type="submit">Save SMS Configuration</Button></CardFooter>
              </Card>
            </form>
          </Form>
        </TabsContent>

        <TabsContent value="backup">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5" /> Data Backup</CardTitle>
                        <CardDescription>Export and safeguard your local database.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-4 border rounded-lg flex items-center justify-between gap-4">
                            <div>
                                <h4 className="font-bold">System Database Backup</h4>
                                <p className="text-sm text-muted-foreground">Download your local database as a portable JSON file.</p>
                            </div>
                            <Button variant="outline" onClick={() => {
                                const data = localStorage.getItem('rateease.store');
                                const blob = new Blob([data || '{}'], {type: 'application/json'});
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url; a.download = `rateease-backup-${new Date().toISOString().split('T')[0]}.json`;
                                a.click();
                            }}><Download className="mr-2 h-4 w-4" /> Download</Button>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-destructive/20 bg-destructive/[0.02]">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-destructive"><ShieldAlert className="h-5 w-5" /> System Maintenance</CardTitle>
                        <CardDescription>Destructive actions to reset or clear system data.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Clear Transactions */}
                        <div className="p-3 border rounded-lg flex items-center justify-between bg-background">
                            <div>
                                <h4 className="text-sm font-bold">Clear All Transactions</h4>
                                <p className="text-xs text-muted-foreground">Resets all payments to zero across properties and BOPs.</p>
                            </div>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="text-destructive border-destructive/20 hover:bg-destructive hover:text-white">
                                        <RotateCcw className="mr-2 h-3 w-3" /> Clear
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Clear All Transactions?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will reset all payments made to Properties, BOPs, and Hotels to zero. Owner data and imported properties will NOT be deleted.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleClearTransactions} className="bg-destructive text-white">Reset Payments</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>

                        {/* Clear Bill History */}
                        <div className="p-3 border rounded-lg flex items-center justify-between bg-background">
                            <div>
                                <h4 className="text-sm font-bold">Clear Bill History</h4>
                                <p className="text-xs text-muted-foreground">Deletes the log of all generated and printed bills.</p>
                            </div>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="text-destructive border-destructive/20 hover:bg-destructive hover:text-white">
                                        <History className="mr-2 h-3 w-3" /> Clear
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Clear Bill History?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This only removes the history of printed bills. It does not affect payments or property data.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={deleteAllBills} className="bg-destructive text-white">Clear History</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>

                        {/* Clear Activity Logs */}
                        <div className="p-3 border rounded-lg flex items-center justify-between bg-background">
                            <div>
                                <h4 className="text-sm font-bold">Clear Activity Logs</h4>
                                <p className="text-xs text-muted-foreground">Wipes the chronological log of user actions.</p>
                            </div>
                            <Button variant="outline" size="sm" onClick={() => { clearLogs(); toast({ title: 'Logs Cleared' }); }}>
                                <Trash2 className="mr-2 h-3 w-3" /> Wipe
                            </Button>
                        </div>

                        <Separator className="my-2" />

                        {/* Factory Reset */}
                        <div className="p-3 border-2 border-dashed border-destructive/30 rounded-lg flex items-center justify-between bg-destructive/[0.05]">
                            <div>
                                <h4 className="text-sm font-bold text-destructive">Factory System Reset</h4>
                                <p className="text-xs text-muted-foreground">Total wipe of all data, settings, branding, and users.</p>
                            </div>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm">
                                        <RefreshCcw className="mr-2 h-3 w-3" /> RESET SYSTEM
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="text-destructive">PERMANENT SYSTEM RESET</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This is a high-level destructive action. ALL properties, BOPs, payments, users, and branding settings will be permanently destroyed. The system will return to its original blank state.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Abort Action</AlertDialogCancel>
                                        <AlertDialogAction onClick={factoryResetStore} className="bg-destructive text-white">PROCEED WITH RESET</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </CardContent>
                </Card>

                {/* Module-Specific Resets */}
                <Card className="md:col-span-2 border-orange-200 bg-orange-50/20">
                     <CardHeader>
                        <CardTitle className="text-sm flex items-center gap-2 text-orange-600"><Trash2 className="h-4 w-4" /> Reset Module Data</CardTitle>
                        <CardDescription>Delete all records from specific modules to start fresh.</CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <Button variant="outline" className="border-orange-200 hover:bg-orange-500 hover:text-white" onClick={() => { deleteAllProperties(); toast({ title: 'Properties Deleted' }); }}>
                            Reset All Properties
                        </Button>
                        <Button variant="outline" className="border-orange-200 hover:bg-orange-500 hover:text-white" onClick={() => { deleteAllBop(); toast({ title: 'BOP Data Deleted' }); }}>
                            Reset All BOPs
                        </Button>
                        <Button variant="outline" className="border-orange-200 hover:bg-orange-500 hover:text-white" onClick={() => { deleteAllLicense(); toast({ title: 'Hotel Data Deleted' }); }}>
                            Reset All Hotels
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
