
'use client';

import * as React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useLicenseData } from '@/context/LicenseDataContext';
import { useRequirePermission } from '@/hooks/useRequirePermission';
import { CalendarIcon } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const licenseFormSchema = z.object({
  'S/N': z.string().optional(),
  'Name of Hotel/Guest House': z.string().min(3, 'Name is required.'),
  'Phone Number': z.string().optional(),
  'Property Rate': z.coerce.number().min(0, 'Property rate must be a positive number.'),
  'Arrears': z.coerce.number().min(0, 'Arrears must be a positive number.'),
  'Payment': z.coerce.number().min(0, 'Payment must be a positive number.'),
  'created_at': z.date().optional(),
});


export default function NewLicensePage() {
    useRequirePermission();
    const router = useRouter();
    const { addLicense } = useLicenseData();

    const form = useForm<z.infer<typeof licenseFormSchema>>({
        resolver: zodResolver(licenseFormSchema),
        defaultValues: {
            'S/N': '',
            'Name of Hotel/Guest House': '',
            'Phone Number': '',
            'Property Rate': 0,
            'Arrears': 0,
            'Payment': 0,
            'created_at': new Date(),
        },
    });

    const watchedValues = form.watch();
    const totalAmountDue = React.useMemo(() => {
        const rate = Number(watchedValues['Property Rate']) || 0;
        const arrears = Number(watchedValues['Arrears']) || 0;
        return rate + arrears;
    }, [watchedValues]);

    const totalAmountPayable = React.useMemo(() => {
        const payment = Number(watchedValues['Payment']) || 0;
        return totalAmountDue - payment;
    }, [totalAmountDue, watchedValues]);

    function onSubmit(data: z.infer<typeof licenseFormSchema>) {
        try {
            const finalData = {
                ...data,
                'Amount Due': totalAmountDue,
                created_at: data.created_at?.toISOString() ?? new Date().toISOString(),
            };
            addLicense(finalData);
            toast({
                title: 'License Record Added',
                description: `The record for ${data['Name of Hotel/Guest House']} has been successfully created.`,
            });
            router.push('/license');
        } catch (error) {
            console.error('Failed to save new license record', error);
            toast({
                variant: 'destructive',
                title: 'Save Error',
                description: 'There was a problem saving the license record.',
            });
        }
    }

  return (
    <>
        <div className="flex items-center gap-4">
             <Button asChild variant="outline" size="sm">
                <Link href="/license">
                    Back to License Data
                </Link>
             </Button>
            <h1 className="text-3xl font-bold tracking-tight font-headline">Add New License Record</h1>
        </div>
        <div className="max-w-4xl mx-auto">
         <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <Card>
                <CardHeader>
                  <CardTitle>License Record Details</CardTitle>
                  <CardDescription>Fill in the form to register a new Hotel/Guest House License.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="S/N" render={({ field }) => (
                        <FormItem>
                          <FormLabel>S/N</FormLabel>
                          <FormControl><Input placeholder="e.g. 001" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField control={form.control} name="Name of Hotel/Guest House" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name of Hotel/Guest House</FormLabel>
                          <FormControl><Input placeholder="e.g. Adom Hotel" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField control={form.control} name="Phone Number" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl><Input placeholder="e.g. 0244123456" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField
                        control={form.control}
                        name="created_at"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                            <FormLabel>Date Created</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                <FormControl>
                                    <Button
                                    variant={"outline"}
                                    className={cn(
                                        "w-full pl-3 text-left font-normal",
                                        !field.value && "text-muted-foreground"
                                    )}
                                    >
                                    {field.value ? (
                                        format(field.value, "PPP")
                                    ) : (
                                        <span>Pick a date</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                </FormControl>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    mode="single"
                                    selected={field.value}
                                    onSelect={field.onChange}
                                    disabled={(date) =>
                                    date > new Date() || date < new Date("1900-01-01")
                                    }
                                    initialFocus
                                />
                                </PopoverContent>
                            </Popover>
                            <FormMessage />
                            </FormItem>
                        )}
                        />
                  </div>
                  
                  <div className="border-t pt-4 mt-4">
                    <h3 className="text-lg font-medium">Billing Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                        <FormField control={form.control} name="Property Rate" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Property Rate (GHS)</FormLabel>
                                <FormControl><Input type="number" step="10" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                         <FormField control={form.control} name="Arrears" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Arrears (GHS)</FormLabel>
                                <FormControl><Input type="number" step="10" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                         <FormField control={form.control} name="Payment" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Payment Made (GHS)</FormLabel>
                                <FormControl><Input type="number" step="10" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                     <div className="mt-6 bg-muted/50 p-4 rounded-lg space-y-2">
                        <div className="flex justify-between items-center text-muted-foreground">
                            <span className="font-medium">Calculated Amount Due:</span>
                            <span className="font-mono">
                                GHS {totalAmountDue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-muted">
                            <span className="text-lg font-semibold">Total Amount Payable:</span>
                            <span className="text-2xl font-bold font-mono">
                                GHS {totalAmountPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                  </div>
                  
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                  <Button type="submit">Save License Record</Button>
                </CardFooter>
              </Card>
            </form>
          </Form>
        </div>
    </>
  );
}
