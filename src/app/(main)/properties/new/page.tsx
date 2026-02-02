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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import Link from 'next/link';
import { usePropertyData } from '@/context/PropertyDataContext';
import { useRequirePermission } from '@/hooks/useRequirePermission';
import { CalendarIcon } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

const propertyFormSchema = z.object({
  'Owner Name': z.string().min(3, 'Owner name must be at least 3 characters.'),
  'Phone Number': z.string().optional(),
  'Town': z.string().min(2, 'Town name is required.'),
  'Suburb': z.string().optional(),
  'Property No': z.string().min(1, 'Property No. is required.'),
  'Valuation List No.': z.string().optional(),
  'Account Number': z.string().optional(),
  'Property Type': z.enum(['Residential', 'Commercial', 'Industrial']),
  'Rateable Value': z.coerce.number().positive('Rateable Value must be a positive number.'),
  'Rate Impost': z.coerce.number().positive('Rate Impost must be a positive number.'),
  'Sanitation Charged': z.coerce.number().min(0).default(0),
  'Previous Balance': z.coerce.number().min(0).default(0),
  'Total Payment': z.coerce.number().min(0).default(0),
  'created_at': z.date().optional(),
});


export default function NewPropertyPage() {
    useRequirePermission();
    const router = useRouter();
    const { addProperty } = usePropertyData();

    const form = useForm<z.infer<typeof propertyFormSchema>>({
        resolver: zodResolver(propertyFormSchema),
        defaultValues: {
            'Owner Name': '',
            'Phone Number': '',
            'Town': '',
            'Suburb': '',
            'Property No': '',
            'Valuation List No.': '',
            'Account Number': '',
            'Property Type': 'Residential',
            'Rateable Value': 1000,
            'Rate Impost': 0.05,
            'Sanitation Charged': 0,
            'Previous Balance': 0,
            'Total Payment': 0,
            'created_at': new Date(),
        },
    });
    
    const watchedValues = form.watch();
    const totalAmountPayable = React.useMemo(() => {
        const rateableValue = Number(watchedValues['Rateable Value']) || 0;
        const rateImpost = Number(watchedValues['Rate Impost']) || 0;
        const sanitationCharged = Number(watchedValues['Sanitation Charged']) || 0;
        const previousBalance = Number(watchedValues['Previous Balance']) || 0;
        const totalPayment = Number(watchedValues['Total Payment']) || 0;

        const totalBill = (rateableValue * rateImpost) + sanitationCharged + previousBalance;
        const payable = totalBill - totalPayment;
        return payable;
    }, [watchedValues]);

    function onSubmit(data: z.infer<typeof propertyFormSchema>) {
        try {
            const finalData = {
                ...data,
                created_at: data.created_at?.toISOString() ?? new Date().toISOString(),
            };
            addProperty(finalData);
            toast({
                title: 'Property Added',
                description: `The property for ${data['Owner Name']} has been successfully created.`,
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
        <div className="max-w-4xl mx-auto">
         <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)}>
              <Card>
                <CardHeader>
                  <CardTitle>New Property Details</CardTitle>
                  <CardDescription>Fill in the form to register a new property consistent with billing requirements.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="Owner Name" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Owner's Full Name</FormLabel>
                          <FormControl><Input placeholder="e.g. Ama Serwaa" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField control={form.control} name="Phone Number" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl><Input placeholder="e.g. 0244123456" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField control={form.control} name="Property No" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Property Number</FormLabel>
                          <FormControl><Input placeholder="e.g. AB604" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="Town" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Town</FormLabel>
                          <FormControl><Input placeholder="e.g. Abetifi" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField control={form.control} name="Suburb" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Suburb</FormLabel>
                          <FormControl><Input placeholder="e.g. Christian Qtrs" {...field} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField control={form.control} name="Property Type" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Property Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                                <SelectTrigger>
                                <SelectValue placeholder="Select property type" />
                                </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                                <SelectItem value="Residential">Residential</SelectItem>
                                <SelectItem value="Commercial">Commercial</SelectItem>
                                <SelectItem value="Industrial">Industrial</SelectItem>
                            </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                        )} 
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                            <FormControl><Input placeholder="e.g. 123456789" {...field} /></FormControl>
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
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-2">
                        <FormField control={form.control} name="Rateable Value" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Rateable Value (GHS)</FormLabel>
                                <FormControl><Input type="number" step="10" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="Rate Impost" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Rate Impost</FormLabel>
                                <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                         <FormField control={form.control} name="Sanitation Charged" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Sanitation Charged (GHS)</FormLabel>
                                <FormControl><Input type="number" step="1" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                         <FormField control={form.control} name="Previous Balance" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Previous Balance (GHS)</FormLabel>
                                <FormControl><Input type="number" step="1" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="Total Payment" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Total Payment (GHS)</FormLabel>
                                <FormControl><Input type="number" step="1" {...field} /></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                     <div className="mt-6 bg-muted/50 p-4 rounded-lg">
                        <div className="flex justify-between items-center">
                            <span className="text-lg font-semibold">Total Amount Payable:</span>
                            <span className="text-2xl font-bold font-mono">
                                GHS {totalAmountPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                  </div>
                  
                </CardContent>
                <CardFooter className="border-t px-6 py-4">
                  <Button type="submit">Save Property</Button>
                </CardFooter>
              </Card>
            </form>
          </Form>
        </div>
    </>
  );
}
