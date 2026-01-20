
'use client';

import React, { useState, useEffect, useCallback } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { useRequirePermission } from '@/hooks/useRequirePermission';
import { PERMISSION_PAGES, usePermissions, UserRole, PermissionPage } from '@/context/PermissionsContext';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Property } from '@/lib/types';
import { PrintableContent } from '@/components/bill-dialog';
import { Loader2 } from 'lucide-react';
import { store, saveStore } from '@/lib/store';

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
});

const smsFormSchema = z.object({
  smsApiUrl: z.string().url("Please enter a valid API URL.").optional().or(z.literal('')),
  smsApiKey: z.string().optional(),
  smsSenderId: z.string().min(3, "Sender ID must be at least 3 characters.").max(11, "Sender ID cannot exceed 11 characters.").optional().or(z.literal('')),
  enableSmsOnNewProperty: z.boolean().default(false),
  newPropertyMessageTemplate: z.string().max(320, "Message cannot exceed 2 SMS pages (320 chars).").optional(),
  enableSmsOnBillGenerated: z.boolean().default(false),
  billGeneratedMessageTemplate: z.string().max(320, "Message cannot exceed 2 SMS pages (320 chars).").optional(),
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

export default function SettingsPage() {
  useRequirePermission();
  const { headers } = usePropertyData();
  const { permissions, updatePermissions } = usePermissions();
  const [loading, setLoading] = useState(true);

  // Local state for UI previews
  const [billFields, setBillFields] = useState<Record<string, boolean>>({});
  const [localPermissions, setLocalPermissions] = useState(permissions);

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

  const saveData = (key: keyof typeof store.settings, data: any, friendlyName: string) => {
    store.settings[key] = data;
    saveStore();
    toast({ title: 'Settings Saved', description: `${friendlyName} settings have been updated.` });
    
    if (key === 'generalSettings') {
        window.dispatchEvent(new Event('storage'));
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
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="permissions">Permissions</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="sms">SMS</TabsTrigger>
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
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                  <Button type="submit">Save Integration Settings</Button>
                </CardFooter>
              </Card>
            </form>
          </Form>
        </TabsContent>
        
        <TabsContent value="sms">
          <Form {...smsForm}>
            <form onSubmit={smsForm.handleSubmit(onSmsSave)}>
              <Card>
                <CardHeader>
                  <CardTitle>SMS Settings</CardTitle>
                  <CardDescription>Configure your SMS provider to send notifications to property owners.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                   <FormField control={smsForm.control} name="smsApiUrl" render={({ field }) => (
                      <FormItem>
                        <FormLabel>SMS Provider API URL</FormLabel>
                        <FormControl><Input placeholder="e.g. https://api.sms-provider.com/sendsms" {...field} /></FormControl>
                        <FormDescription>The endpoint URL for your SMS provider's API.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField control={smsForm.control} name="smsApiKey" render={({ field }) => (
                      <FormItem>
                        <FormLabel>API Key</FormLabel>
                        <FormControl><Input type="password" placeholder="e.g. sk_xxxxxxxxxxxxxxxx" {...field} /></FormControl>
                        <FormDescription>Your secret API key from your SMS provider.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                   <FormField control={smsForm.control} name="smsSenderId" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sender ID</FormLabel>
                        <FormControl><Input placeholder="e.g. RateEase" {...field} /></FormControl>
                        <FormDescription>The name that appears as the sender of the SMS (max 11 characters).</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
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
                                Use placeholders like{' '}
                                <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm">{'{{Owner Name}}'}</code> or{' '}
                                <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm">{'{{Property No}}'}</code> / <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm">{'{{Business Name}}'}</code>.
                            </FormDescription>
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
                                Use placeholders like{' '}
                                <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm">{'{{Owner Name}}'}</code>,{' '}
                                <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm">{'{{Total Amount Due}}'}</code>, or{' '}
                                <code className="relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm">{'{{Year}}'}</code>.
                            </FormDescription>
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
        </TabsContent>

      </Tabs>
    </>
  );
}
