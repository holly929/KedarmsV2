

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
import { Checkbox } from '@/components/ui/checkbox';
import { useRequirePermission } from '@/hooks/useRequirePermission';
import { PERMISSION_PAGES, usePermissions, UserRole, PermissionPage } from '@/context/PermissionsContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Property, Bop } from '@/lib/types';
import { PrintableContent } from '@/components/bill-dialog';
import { Loader2, Server, Download, UploadCloud, MessageSquare } from 'lucide-react';
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
import { sendSms } from '@/lib/sms-service';


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
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color code, e.g., #F1F5F9").default('#F1F5F9'),
});

const integrationsFormSchema = z.object({
  googleSheetUrl: z.string().url("Please enter a valid Google Sheet URL.").optional().or(z.literal('')),
  bopGoogleSheetUrl: z.string().url("Please enter a valid Google Sheet URL.").optional().or(z.literal('')),
  summaryBillGoogleSheetUrl: z.string().url("Please enter a valid Google Sheet URL.").optional().or(z.literal('')),
});

const smsFormSchema = z.object({
  enableSmsOnNewProperty: z.boolean().default(false),
  newPropertyMessageTemplate: z.string().max(320, "Message cannot exceed 2 SMS pages (320 chars).").optional(),
  enableSmsOnBillGenerated: z.boolean().default(false),
  billGeneratedMessageTemplate: z.string().max(320, "Message cannot exceed 2 SMS pages (320 chars).").optional(),
});

const newYearSmsFormSchema = z.object({
  message: z.string().min(10, "Message must be at least 10 characters.").max(480, "Message is too long."),
});

type AppearanceSettings = z.infer<typeof appearanceFormSchema>;

const ImageUploadPreview = ({ src, alt, dataAiHint }: { src: string | null, alt: string, dataAiHint?: string }) => {
    if (!src) return null;
    return (
        <div className="mt-2 relative aspect-video w-full max-w-[200px] overflow-hidden rounded-md border bg-muted/50 flex items-center justify-center">
             <Image src={src} alt={alt} fill className="object-contain p-2" data-ai-hint={dataAiHint} />
        </div>
    )
}

const permissionPageLabels: Record<PermissionPage, string> = {
  'dashboard': 'Dashboard', 'properties': 'Properties', 'billing': 'Billing', 'bills': 'Bills',
  'reports': 'Reports', 'users': 'User Management', 'settings': 'Settings', 'integrations': 'Integrations',
  'bop': 'BOP Data', 'bop-billing': 'BOP Billing', 'defaulters': 'Defaulters', 'payment': 'Payment', 'activity-logs': 'Activity Logs',
  'summary-bill': 'Summary Bill'
};

const mockPropertyForPreview: Property = {
  id: 'preview-123', 'Owner Name': 'John Preview Doe', 'Phone Number': '024 123 4567',
  'Town': 'Settingsville', 'Suburb': 'Preview Estates', 'Property No': 'PV-001',
  'Valuation List No.': 'VLN-999', 'Account Number': '1234567890', 'Property Type': 'Residential',
  'Rateable Value': 5000, 'Rate Impost': 0.05, 'Sanitation Charged': 50,
  'Previous Balance': 200, 'Total Payment': 100,
};

const PlaceholderGuide = ({ common, property, bop }: { common: string[], property: string[], bop: string[] }) => {
    const renderPlaceholders = (placeholders: string[]) => (
        <div className="flex flex-wrap gap-1">
            {placeholders.map(p => (
                <code key={p} className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-xs font-semibold">
                    {`{{${p}}}`}
                </code>
            ))}
        </div>
    );

    return (
        <div className="text-xs text-muted-foreground space-y-2 rounded-lg border bg-background/50 p-3 mt-2">
            <p className="font-bold mb-1">Available Placeholders:</p>
            {common.length > 0 && <div className="space-y-1"><span>Common:</span> {renderPlaceholders(common)}</div>}
            {property.length > 0 && <div className="space-y-1"><span>For Properties:</span> {renderPlaceholders(property)}</div>}
            {bop.length > 0 && <div className="space-y-1"><span>For BOPs:</span> {renderPlaceholders(bop)}</div>}
        </div>
    );
};

export default function SettingsPage() {
  useRequirePermission();
  const { properties } = usePropertyData();
  const { bopData } = useBopData();
  const { permissions, updatePermissions } = usePermissions();
  const [loading, setLoading] = useState(true);
  const [isSendingNewYearSms, setIsSendingNewYearSms] = useState(false);
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  // Local state for UI previews
  const [billFields, setBillFields] = useState<Record<string, boolean>>({});
  const [localPermissions, setLocalPermissions] = useState(permissions);

  const allContacts = useMemo(() => {
    const contactsMap = new Map<string, Property | Bop>();
    
    properties.forEach(p => {
        const phone = getPropertyValue(p, 'Phone Number');
        if (phone) contactsMap.set(String(phone).trim(), p);
    });

    bopData.forEach(b => {
        const phone = getPropertyValue(b, 'Phone Number');
        if (phone && !contactsMap.has(String(phone).trim())) {
            contactsMap.set(String(phone).trim(), b);
        }
    });

    return Array.from(contactsMap.values());
  }, [properties, bopData]);

  const generalForm = useForm<z.infer<typeof generalFormSchema>>({
    resolver: zodResolver(generalFormSchema),
    defaultValues: store.settings.generalSettings,
  });

  const appearanceForm = useForm<z.infer<typeof appearanceFormSchema>>({
    resolver: zodResolver(appearanceFormSchema),
    defaultValues: store.settings.appearanceSettings,
  });
  
  const integrationsForm = useForm<z.infer<typeof integrationsFormSchema>>({
    resolver: zodResolver(integrationsFormSchema),
    defaultValues: store.settings.integrationsSettings,
  });

  const smsForm = useForm<z.infer<typeof smsFormSchema>>({
    resolver: zodResolver(smsFormSchema),
    defaultValues: store.settings.smsSettings,
  });

  const newYearSmsForm = useForm<z.infer<typeof newYearSmsFormSchema>>({
    resolver: zodResolver(newYearSmsFormSchema),
    defaultValues: {
        message: "Happy New Year from {{Assembly Name}}! This is a friendly reminder that your Property Rate/BOP for {{Year}} is due. Please contact the assembly to make payment. Thank you."
    },
  });

  const resetForms = useCallback(() => {
    generalForm.reset(store.settings.generalSettings);
    appearanceForm.reset(store.settings.appearanceSettings);
    integrationsForm.reset(store.settings.integrationsSettings);
    smsForm.reset(store.settings.smsSettings);
    setBillFields(store.settings.billDisplaySettings || {});
  }, [generalForm, appearanceForm, integrationsForm, smsForm]);
  
  useEffect(() => {
    setLoading(true);
    resetForms();
    setLoading(false);
  }, [resetForms]);
  
  useEffect(() => {
    setLocalPermissions(permissions);
  }, [permissions]);

  const watchedAppearanceForm = appearanceForm.watch();
  
  const settingsForPreview = {
    general: generalForm.getValues(),
    appearance: watchedAppearanceForm
  };

    const handleBackup = () => {
        try {
            const fullStoreData = window.localStorage.getItem('rateease.store');
            if (!fullStoreData) {
                throw new Error("No data found to back up.");
            }
            
            const blob = new Blob([fullStoreData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const timestamp = new Date().toISOString().slice(0, 19).replace('T', '_').replace(/:/g, '-');
            link.download = `rateease-backup-${timestamp}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            toast({
                title: 'Backup Successful',
                description: 'Your data backup file has been downloaded.',
            });
        } catch (error) {
            console.error("Backup failed", error);
            const errorMessage = error instanceof Error ? error.message : 'Could not create the backup file.';
            toast({
                variant: 'destructive',
                title: 'Backup Failed',
                description: errorMessage,
            });
        }
    };

    const handleFileSelectForRestore = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.type === 'application/json') {
                setRestoreFile(file);
                setRestoreError(null);
            } else {
                setRestoreFile(null);
                setRestoreError('Invalid file type. Please select a .json file.');
            }
        }
    };

    const handleRestore = () => {
        if (!restoreFile) {
            setRestoreError('Please select a backup file first.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const restoredStore = JSON.parse(text);

                if (restoredStore && restoredStore.properties !== undefined && restoredStore.users !== undefined && restoredStore.settings !== undefined) {
                    window.localStorage.setItem('rateease.store', JSON.stringify(restoredStore));
                    toast({
                        title: 'Restore Successful',
                        description: 'Application will now reload to apply the restored data.',
                    });
                    
                    setTimeout(() => {
                        window.location.reload();
                    }, 1500);

                } else {
                    throw new Error('The selected file does not appear to be a valid RateEase backup file.');
                }
            } catch (error: any) {
                const message = error.message || 'Failed to read or parse the backup file.';
                setRestoreError(message);
                toast({
                    variant: 'destructive',
                    title: 'Restore Failed',
                    description: message,
                });
            }
        };
        reader.onerror = () => {
            const message = 'Failed to read the selected file.';
            setRestoreError(message);
            toast({ variant: 'destructive', title: 'File Error', description: message });
        }
        reader.readAsText(restoreFile);
    };

  const saveData = (key: keyof typeof store.settings, data: any, friendlyName: string) => {
    store.settings[key] = data;
    saveStore();
    toast({ title: 'Settings Saved', description: `${friendlyName} settings have been updated.` });
    
    if (key === 'generalSettings' || key === 'appearanceSettings') {
        setTimeout(() => window.location.reload(), 500);
    }
  };

  function onGeneralSave(data: z.infer<typeof generalFormSchema>) {
    saveData('generalSettings', data, 'General');
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, fieldName: 'assemblyLogo' | 'ghanaLogo' | 'signature') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        appearanceForm.setValue(fieldName, result, { shouldDirty: true });
      };
      reader.readAsDataURL(file);
    }
  };
  
  const handleFieldToggle = (field: string) => {
    setBillFields(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const onAppearanceSave = () => {
    const appearanceData = appearanceForm.getValues();
    saveData('appearanceSettings', appearanceData, 'Appearance');
    saveData('billDisplaySettings', billFields, 'Bill Display');
  };

  function onIntegrationsSave(data: z.infer<typeof integrationsFormSchema>) {
    saveData('integrationsSettings', data, 'Integrations');
  }
  
  function onSmsSave(data: z.infer<typeof smsFormSchema>) {
    saveData('smsSettings', data, 'SMS');
  }

  async function onSendNewYearSms(data: z.infer<typeof newYearSmsFormSchema>) {
    setIsSendingNewYearSms(true);
    const results = await sendSms(allContacts, data.message);
    const successfulSends = results.filter(r => r.success).length;
    const failedSends = results.filter(r => !r.success && r.error !== 'No phone number');

    setIsSendingNewYearSms(false);

     if (successfulSends > 0) {
       toast({
        title: 'SMS Campaign Sent',
        description: `Successfully dispatched ${successfulSends} messages.`,
      });
    }

    if (failedSends.length > 0) {
         toast({
            variant: 'destructive',
            title: `${failedSends.length} Messages Failed`,
            description: `Could not send messages. First error: ${failedSends[0].error}`,
        });
    }

    if (successfulSends === 0 && failedSends.length === 0) {
         toast({
            variant: 'destructive',
            title: 'No Recipients',
            description: `Could not find any contacts with a valid phone number.`,
        });
    }
  }


  const onPermissionsSave = () => {
    updatePermissions(localPermissions);
  };

  const handlePermissionChange = (role: UserRole, page: string, checked: boolean) => {
    setLocalPermissions(prev => ({
        ...prev,
        [role]: { ...prev[role], [page]: checked }
    }))
  };

  const capitalize = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());

  if (loading) {
    return (
        <div className="flex h-full items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
    );
  }

  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight font-headline">Settings</h1>
      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-6">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="sms">SMS</TabsTrigger>
          <TabsTrigger value="backup">Backup & Restore</TabsTrigger>
        </TabsList>
        
        <TabsContent value="general">
          <Form {...generalForm}>
            <form onSubmit={generalForm.handleSubmit(onGeneralSave)}>
              <Card>
                <CardHeader>
                  <CardTitle>General Settings</CardTitle>
                  <CardDescription>Basic information about your system and assembly.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                   <FormField control={generalForm.control} name="systemName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>System Name</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormDescription>The name of the application displayed in the header and on the login page.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={generalForm.control} name="assemblyName" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assembly Name</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={generalForm.control} name="postalAddress" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postal Address</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField control={generalForm.control} name="contactPhone" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Phone</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={generalForm.control} name="contactEmail" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact Email</FormLabel>
                        <FormControl><Input type="email" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                  <Button type="submit">Save Changes</Button>
                </CardFooter>
              </Card>
            </form>
          </Form>
        </TabsContent>

        <TabsContent value="appearance">
          <Form {...appearanceForm}>
            <form onSubmit={appearanceForm.handleSubmit(onAppearanceSave)}>
              <Card>
                <CardHeader>
                  <CardTitle>Appearance & Branding</CardTitle>
                  <CardDescription>Customize the look and feel of printed bills and the login screen.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-8">
                      <FormField control={appearanceForm.control} name="assemblyLogo" render={({ field }) => (
                          <FormItem>
                              <FormLabel>Assembly Logo</FormLabel>
                              <FormControl><Input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'assemblyLogo')} /></FormControl>
                              <FormDescription>Used on login screen and bills.</FormDescription>
                              <ImageUploadPreview src={field.value} alt="Assembly Logo Preview" dataAiHint="government logo" />
                          </FormItem>
                          )}
                      />
                      <FormField control={appearanceForm.control} name="ghanaLogo" render={({ field }) => (
                          <FormItem>
                              <FormLabel>Ghana Coat of Arms</FormLabel>
                              <FormControl><Input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'ghanaLogo')} /></FormControl>
                              <FormDescription>Used on printed bills.</FormDescription>
                              <ImageUploadPreview src={field.value} alt="Ghana Logo Preview" dataAiHint="ghana coat arms" />
                          </FormItem>
                          )}
                      />
                      <FormField control={appearanceForm.control} name="signature" render={({ field }) => (
                          <FormItem>
                              <FormLabel>Coordinating Director's Signature</FormLabel>
                              <FormControl><Input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'signature')} /></FormControl>
                              <FormDescription>Used on printed bills.</FormDescription>
                              <ImageUploadPreview src={field.value} alt="Signature Preview" dataAiHint="signature" />
                          </FormItem>
                          )}
                      />
                    <FormField control={appearanceForm.control} name="billWarningText" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Bill Warning Text</FormLabel>
                          <FormControl><Textarea {...field} /></FormControl>
                          <FormDescription>This text will appear at the bottom of every bill.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="border-t pt-6">
                      <h3 className="text-lg font-medium">Printing Styles</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                          <FormField control={appearanceForm.control} name="fontFamily" render={({ field }) => (
                              <FormItem><FormLabel>Font Family</FormLabel>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                      <SelectContent>
                                          <SelectItem value="sans">Sans-serif (Inter)</SelectItem>
                                          <SelectItem value="serif">Serif (Tinos)</SelectItem>
                                          <SelectItem value="mono">Monospace (Courier Prime)</SelectItem>
                                      </SelectContent>
                                  </Select>
                              </FormItem>
                          )} />
                          <FormField control={appearanceForm.control} name="fontSize" render={({ field }) => (
                              <FormItem><FormLabel>Base Font Size (px)</FormLabel>
                                  <FormControl><Input type="number" min="8" max="14" {...field} /></FormControl>
                              </FormItem>
                          )} />
                      </div>
                      <div className="mt-4">
                          <FormField control={appearanceForm.control} name="accentColor" render={({ field }) => (
                              <FormItem><FormLabel>Accent Color</FormLabel>
                                  <div className="flex items-center gap-2">
                                      <FormControl><Input type="color" className="p-1 h-10 w-14" {...field} /></FormControl>
                                      <Input type="text" placeholder="#F1F5F9" {...field} />
                                  </div>
                                  <FormDescription>Used for highlighting rows like 'Total Amount Due'.</FormDescription>
                                  <FormMessage />
                              </FormItem>
                          )} />
                      </div>
                    </div>

                    <div className="border-t pt-6 mt-8">
                      <h3 className="text-lg font-medium">Bill Display Fields</h3>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
                        {Object.keys(billFields).map((field) => (
                          <FormItem key={field} className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox checked={billFields[field]} onCheckedChange={() => handleFieldToggle(field)} />
                            </FormControl>
                            <FormLabel className="font-normal">{field}</FormLabel>
                          </FormItem>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="hidden lg:block">
                    <FormLabel>Live Preview</FormLabel>
                    <div className="mt-2 w-full aspect-[210/297] bg-white shadow-lg rounded-lg border p-2 overflow-hidden sticky top-24">
                       <div className="scale-[0.55] origin-top-left -translate-x-4 -translate-y-4" style={{ width: '181%', height: '181%' }}>
                          <PrintableContent
                            property={mockPropertyForPreview} settings={settingsForPreview}
                            displaySettings={billFields} isCompact={false}
                          />
                       </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                  <Button type="submit">Save Appearance</Button>
                </CardFooter>
              </Card>
            </form>
          </Form>
        </TabsContent>

        <TabsContent value="permissions">
            <Card>
                <CardHeader><CardTitle>Role Permissions</CardTitle>
                    <CardDescription>Define which user roles can access each page. Admins always have full access.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <Table><TableHeader><TableRow>
                            <TableHead>Page / Feature</TableHead>
                            {Object.keys(localPermissions).map(role => (
                                <TableHead key={role} className="text-center">{capitalize(role)}</TableHead>
                            ))}
                        </TableRow></TableHeader>
                        <TableBody>
                            {PERMISSION_PAGES.map(page => (
                                <TableRow key={page}>
                                    <TableCell className="font-medium">{permissionPageLabels[page as PermissionPage]}</TableCell>
                                    {Object.keys(localPermissions).map(role => (
                                        <TableCell key={`${role}-${page}`} className="text-center">
                                            <Checkbox
                                                checked={localPermissions[role as UserRole]?.[page as keyof typeof localPermissions[UserRole]]}
                                                onCheckedChange={(checked) => handlePermissionChange(role as UserRole, page, !!checked)}
                                                disabled={role === 'Admin'}
                                            />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody></Table>
                    </div>
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                    <Button onClick={onPermissionsSave}>Save Permissions</Button>
                </CardFooter>
            </Card>
        </TabsContent>

        <TabsContent value="integrations">
          <Form {...integrationsForm}>
            <form onSubmit={integrationsForm.handleSubmit(onIntegrationsSave)}>
              <Card>
                <CardHeader>
                  <CardTitle>Integrations</CardTitle>
                  <CardDescription>Connect to external services like Google Sheets.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                   <FormField control={integrationsForm.control} name="googleSheetUrl" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Google Sheet URL for Property Rate Payments</FormLabel>
                        <FormControl><Input placeholder="https://docs.google.com/spreadsheets/d/..." {...field} /></FormControl>
                        <FormDescription>Link to a Google Sheet to view payments data directly on the Integrations page.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={integrationsForm.control} name="bopGoogleSheetUrl" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Google Sheet URL for BOP Payments</FormLabel>
                        <FormControl><Input placeholder="https://docs.google.com/spreadsheets/d/..." {...field} /></FormControl>
                        <FormDescription>Link to a Google Sheet to view BOP payments data directly on the Integrations page.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField control={integrationsForm.control} name="summaryBillGoogleSheetUrl" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Google Sheet URL for Summary Bills</FormLabel>
                        <FormControl><Input placeholder="https://docs.google.com/spreadsheets/d/..." {...field} /></FormControl>
                        <FormDescription>Link to a Google Sheet to view Summary Bill data directly on the Summary Bill page.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                  <Button type="submit">Save Integration Settings</Button>
                </CardFooter>
              </Card>
            </form>
          </Form>
        </TabsContent>
        
        <TabsContent value="sms" className="space-y-6">
          <Form {...smsForm}>
            <form onSubmit={smsForm.handleSubmit(onSmsSave)}>
              <Card>
                <CardHeader>
                  <CardTitle>SMS Settings (Arkesel)</CardTitle>
                  <CardDescription>Configure your Arkesel account to send SMS notifications.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <Alert variant="destructive">
                      <Server className="h-4 w-4" />
                      <AlertTitle>Important: Server-Side Configuration</AlertTitle>
                      <AlertDescription>
                          For SMS functionality to work, your credentials must be stored securely on the server. Please create a <code className="font-mono text-sm">.env.local</code> file in your project&apos;s root directory and add your <code className="font-mono text-sm">ARKESEL_API_KEY</code> and <code className="font-mono text-sm">ARKESEL_SENDER_ID</code>. The app will restart automatically to apply these changes.
                      </AlertDescription>
                  </Alert>
                  <div className="border-t pt-6 space-y-4">
                     <h3 className="text-lg font-medium">Automatic SMS Notifications</h3>
                     <FormField control={smsForm.control} name="enableSmsOnNewProperty" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <FormLabel className="text-base">SMS on New Property/BOP</FormLabel>
                                <FormDescription>
                                    Automatically send a welcome SMS when a new property or business is added.
                                </FormDescription>
                            </div>
                             <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )} />
                    <FormField control={smsForm.control} name="newPropertyMessageTemplate" render={({ field }) => (
                        <FormItem>
                            <FormLabel>New Property/BOP Message Template</FormLabel>
                            <FormControl><Textarea placeholder="Enter your message here" {...field} className="min-h-[100px]"/></FormControl>
                            <FormDescription>
                                Use placeholders to customize your message.
                            </FormDescription>
                             <PlaceholderGuide
                                common={['Owner Name', 'Phone Number', 'Town', 'Date']}
                                property={['Property No', 'Property Type', 'Suburb']}
                                bop={['Business Name']}
                            />
                            <FormMessage />
                        </FormItem>
                    )} />
                  </div>
                  <div className="border-t pt-6 space-y-4">
                     <FormField control={smsForm.control} name="enableSmsOnBillGenerated" render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                            <div className="space-y-0.5">
                                <FormLabel className="text-base">SMS on Bill Generation</FormLabel>
                                <FormDescription>
                                    Automatically send an SMS when a new bill is generated for a property or BOP.
                                </FormDescription>
                            </div>
                             <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                        </FormItem>
                    )} />
                    <FormField control={smsForm.control} name="billGeneratedMessageTemplate" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Bill Generated Message Template</FormLabel>
                            <FormControl><Textarea placeholder="Enter your message here" {...field} className="min-h-[100px]"/></FormControl>
                             <FormDescription>
                                Use placeholders to customize your message.
                            </FormDescription>
                             <PlaceholderGuide
                                common={['Owner Name', 'Amount Owed', 'Date', 'Year']}
                                property={['Property No', 'Town', 'Suburb']}
                                bop={['Business Name']}
                            />
                            <FormMessage />
                        </FormItem>
                    )} />
                  </div>
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                  <Button type="submit">Save SMS Settings</Button>
                </CardFooter>
              </Card>
            </form>
          </Form>

          <Form {...newYearSmsForm}>
             <form onSubmit={newYearSmsForm.handleSubmit(onSendNewYearSms)}>
                <Card>
                    <CardHeader>
                        <CardTitle>Annual New Year Reminder</CardTitle>
                        <CardDescription>
                            Manually send a bulk SMS reminder to all property and BOP owners. This is useful for New Year greetings or payment reminders.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                         <FormField control={newYearSmsForm.control} name="message" render={({ field }) => (
                            <FormItem>
                                <FormLabel>New Year Reminder Message</FormLabel>
                                <FormControl><Textarea placeholder="Enter your message here" {...field} className="min-h-[100px]"/></FormControl>
                                <FormDescription>
                                    This message will be sent to all contacts with a phone number.
                                </FormDescription>
                                <PlaceholderGuide
                                    common={['Owner Name', 'Date', 'Year', 'Assembly Name']}
                                    property={[]}
                                    bop={[]}
                                />
                                <FormMessage />
                            </FormItem>
                        )} />
                    </CardContent>
                    <CardFooter className="border-t px-6 py-4">
                         <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button disabled={isSendingNewYearSms || allContacts.length === 0}>
                                     {isSendingNewYearSms ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
                                     Send to All ({allContacts.length})
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    You are about to send a bulk SMS to {allContacts.length} recipients. This action cannot be undone. Please confirm the message is correct before proceeding.
                                </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => onSendNewYearSms(newYearSmsForm.getValues())}>
                                    Yes, Send SMS
                                </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </CardFooter>
                </Card>
             </form>
          </Form>
        </TabsContent>
        
        <TabsContent value="backup">
            <Card>
                <CardHeader>
                    <CardTitle>Backup & Restore</CardTitle>
                    <CardDescription>
                       Download all application data to a file for safekeeping, or restore from a backup file.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    <Alert>
                        <Server className="h-4 w-4" />
                        <AlertTitle>How It Works</AlertTitle>
                        <AlertDescription>
                           This tool creates a local JSON file of all your data (properties, users, settings, etc.). You can save this file anywhere, including your Google Drive. Restoring from this file will overwrite all current data.
                        </AlertDescription>
                    </Alert>

                    <div className="p-6 border rounded-lg bg-background/50">
                        <h3 className="text-lg font-medium">Download Backup</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                            Create a complete backup of your system. Keep this file in a safe place.
                        </p>
                        <Button onClick={handleBackup} className="mt-4">
                            <Download className="mr-2 h-4 w-4" />
                            Download Backup File
                        </Button>
                    </div>

                    <div className="p-6 border rounded-lg border-destructive/50">
                        <h3 className="text-lg font-medium text-destructive">Restore from Backup</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                           This will overwrite all data in the application with the content from your backup file. This action cannot be undone.
                        </p>
                        <div className="flex items-center flex-wrap gap-4 mt-4">
                            <Input type="file" accept=".json" onChange={handleFileSelectForRestore} className="max-w-sm" />
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" disabled={!restoreFile}>
                                        <UploadCloud className="mr-2 h-4 w-4" />
                                        Restore Data
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will replace all current application data with the contents of the selected backup file. All unsaved changes will be lost.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleRestore}>
                                            Yes, restore from backup
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                        {restoreError && <p className="text-sm font-medium text-destructive mt-3">{restoreError}</p>}
                    </div>
                </CardContent>
            </Card>
        </TabsContent>

      </Tabs>
    </>
  );
}
