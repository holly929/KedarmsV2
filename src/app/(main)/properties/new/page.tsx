'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';
import { usePropertyData } from '@/context/PropertyDataContext';
import { useRequirePermission } from '@/hooks/useRequirePermission';
import { CalendarIcon, RefreshCcw } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn, normalizePhoneNumber } from '@/lib/utils';
import { store } from '@/lib/store';

const propertyFormSchema = z.object({
  'S/N': z.string().min(1, 'S/N is required.'),
  'Owner Name': z.string().min(3, 'Owner name must be at least 3 characters.'),
  'Phone Number': z.string().optional(),
  'Town': z.string().min(2, 'Town name is required.'),
  'Suburb': z.string().optional(),
  'Property No': z.string().min(1, 'Property No. is required.'),
  'Valuation List No.': z.string().optional(),
  'Account Number': z.string().optional(),
  'Property Type': z.string().default('Residential'),
  'Rateable Value': z.coerce.number().min(0).default(0),
  'Rate Impost': z.coerce.number().min(0).default(0.005),
  'Sanitation Charged': z.coerce.number().min(0).default(0),
  'Previous Balance': z.coerce.number().min(0).default(0),
  'Total Payment': z.coerce.number().min(0).default(0),
  'Amount Due': z.coerce.number().min(0).optional(),
  'created_at': z.date().optional(),
});

export default function NewPropertyPage() {
    useRequirePermission();
    const router = useRouter();
    const { addProperty } = usePropertyData();

    const generateSN = () => {
        const systemName = store.settings.generalSettings?.systemName || 'RE';
        const prefix = systemName.replace(/\s+/g, '').toUpperCase();
        const year = new Date().getFullYear();
        const random = Math.floor(1000 + Math.random() * 9000);
        return `${prefix}-PROP-${year}-${random}`;
    };

    const form = useForm<z.infer<typeof propertyFormSchema>>({
        resolver: zodResolver(propertyFormSchema),
        defaultValues: {
            'S/N': generateSN(),
            'Owner Name': '',
            'Phone Number': '',
            'Town': '',
            'Suburb': '',
            'Property No': '',
            'Valuation List No.': '',
            'Account Number': '',
            'Property Type': 'Residential',
            'Rateable Value': 0,
            'Rate Impost': 0.005,
            'Sanitation Charged': 0,
            'Previous Balance': 0,
            'Total Payment': 0,
            'created_at': new Date(),
        },
    });
    
    const watchedValues = form.watch();
    const calculatedPayable = React.useMemo(() => {
        const rateableValue = Number(watchedValues['Rateable Value']) || 0;
        const rateImpost = Number(watchedValues['Rate Impost']) || 0;
        const sanitationCharged = Number(watchedValues['Sanitation Charged']) || 0;
        const previousBalance = Number(watchedValues['Previous Balance']) || 0;
        const totalPayment = Number(watchedValues['Total Payment']) || 0;

        const totalBill = (rateableValue * rateImpost) + sanitationCharged + previousBalance;
        return totalBill - totalPayment;
    }, [watchedValues]);

    function onSubmit(data: z.infer<typeof propertyFormSchema>) {
        try {
            // Clean phone number before saving to ensure SMS capability
            const formattedPhone = normalizePhoneNumber(data['Phone Number']);
            
            const finalAmountDue = data['Amount Due'] !== undefined && data['Amount Due'] !== null 
                ? data['Amount Due'] 
                : calculatedPayable;

            const finalData = {
                ...data,
                'Phone Number': formattedPhone,
                'Amount Due': finalAmountDue,
                created_at: data.created_at?.toISOString() ?? new Date().toISOString(),
            };
            addProperty(finalData);
            toast({
                title: 'Property Added',
                description: `The property for ${data['Owner Name']} has been successfully created. Phone formatted for SMS.`,
            });
            router.push('/properties');
        } catch (error) {
            console.error('Failed to save new property', error);
            toast({
                variant: 'destructive',
                title: 'Save Error',
                description: 'There was a problem saving the property.',
            });
        }
    }

    const handleRegenerateSN = () => {
        form.setValue('S/N', generateSN());
    };

  return (
    <>
        <div className="flex items-center gap-4">
             <Button asChild variant="outline" size="sm">
                <Link href="/properties">
                    Back to Properties
                </Link>
             </Button>
            <h1 className="text-3xl font-bold tracking-tight font-headline">Add New Property</h1>
        </div>
        <div className="max-w-5xl mx-auto py-6">
         <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <Card>
                <CardHeader>
                  <CardTitle>New Property Details</CardTitle>
                  <CardDescription>Register a new property with full billing particulars.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold border-b pb-1">1. Identification & Owner</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                       <FormField control={form.control} name="S/N" render={({ field }) => (
                            <FormItem>
                            <FormLabel>S/N (Serial No.)</FormLabel>
                            <div className="flex gap-2">
                                <FormControl><Input placeholder="Auto-generated" {...field} /></FormControl>
                                <Button type="button" variant="outline" size="icon" onClick={handleRegenerateSN} title="Regenerate S/N">
                                    <RefreshCcw className="h-4 w-4" />
                                </Button>
                            </div>
                            <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="Owner Name" render={({ field }) => (
                            <FormItem className="md:col-span-2">
                            <FormLabel>Owner Name</FormLabel>
                            <FormControl><Input placeholder="Full name of owner" {...field} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )} />
                         <FormField control={form.control} name="Phone Number" render={({ field }) => (
                            <FormItem>
                            <FormLabel>Phone Number</FormLabel>
                            <FormControl><Input placeholder="e.g. 024XXXXXXX" {...field} /></FormControl>
                            <FormDescription>Saved in 233 format for Arkesel.</FormDescription>
                            <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-bold border-b pb-1">2. Location & Property Info</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField control={form.control} name="Town" render={({ field }) => (
                            <FormItem>
                            <FormLabel>Town</FormLabel>
                            <FormControl><Input placeholder="e.g. ABETIFI" {...field} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="Suburb" render={({ field }) => (
                            <FormItem>
                            <FormLabel>Suburb</FormLabel>
                            <FormControl><Input placeholder="e.g. CHRISTIAN QTRS" {...field} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )} />
                         <FormField control={form.control} name="Property Type" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Property Type</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                    <SelectValue placeholder="Select type" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="Residential">Residential</SelectItem>
                                    <SelectItem value="Commercial">Commercial</SelectItem>
                                    <SelectItem value="Industrial">Industrial</SelectItem>
                                    <SelectItem value="Unassessed">Unassessed</SelectItem>
                                </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                            )} 
                        />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <FormField control={form.control} name="Property No" render={({ field }) => (
                            <FormItem>
                            <FormLabel>Property Number</FormLabel>
                            <FormControl><Input placeholder="e.g. AB604" {...field} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="Valuation List No." render={({ field }) => (
                            <FormItem>
                                <FormLabel>Valuation List No.</FormLabel>
                                <FormControl><Input placeholder="e.g. 604" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                        <FormField control={form.control} name="Account Number" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Account Number</FormLabel>
                                <FormControl><Input placeholder="e.g. 12345" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                            )}
                        />
                    </div>
                  </div>
                  
                  <div className="space-y-4">
                    <h3 className="text-lg font-bold border-b pb-1">3. Billing Particulars</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <FormField control={form.control} name="Rateable Value" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Rateable Value (GHS)</FormLabel>
                                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="Rate Impost" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Rate Impost</FormLabel>
                                <FormControl><Input type="number" step="0.0001" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                         <FormField control={form.control} name="Sanitation Charged" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Sanitation Charged (GHS)</FormLabel>
                                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                         <FormField control={form.control} name="Previous Balance" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Previous Balance (Arrears)</FormLabel>
                                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="Total Payment" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Total Payment Made</FormLabel>
                                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="Amount Due" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-primary font-bold">Override Total Amount Due</FormLabel>
                                <FormControl><Input type="number" step="0.01" placeholder="Leave blank to use calculated total" {...field} /></FormControl>
                                <FormDescription>Set this to import a specific balance from your records.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                     <div className="mt-6 bg-muted/50 p-6 rounded-lg border-2 border-primary/20">
                        <div className="flex justify-between items-center">
                            <div className="space-y-1">
                                <span className="text-lg font-bold block">Live Calculation Preview:</span>
                                <span className="text-xs text-muted-foreground uppercase tracking-wider">
                                    (RV * Impost) + Sanitation + Arrears - Payments
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="text-3xl font-black font-mono text-primary">
                                    GHS {calculatedPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>
                    </div>
                  </div>
                  
                </CardContent>
                <CardFooter className="border-t px-6 py-4 flex justify-between bg-muted/10">
                  <p className="text-xs text-muted-foreground italic">Note: All currency fields are formatted to 2 decimal places.</p>
                  <Button type="submit" size="lg">Save Property Record</Button>
                </CardFooter>
              </Card>
            </form>
          </Form>
        </div>
    </>
  );
}
