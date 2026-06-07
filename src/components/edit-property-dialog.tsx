/* eslint-disable react/no-unescaped-entities */
'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import type { Property } from '@/lib/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getPropertyValue } from '@/lib/property-utils';
import { normalizePhoneNumber } from '@/lib/utils';

interface EditPropertyDialogProps {
  property: Property | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onPropertyUpdate: (property: Property) => void;
}

const propertyFormSchema = z.object({
  'S/N': z.string().optional(),
  'Owner Name': z.string().min(3, 'Owner name must be at least 3 characters.'),
  'Phone Number': z.string().optional(),
  'Town': z.string().min(2, 'Town name is required.'),
  'Suburb': z.string().optional(),
  'Property No': z.string().min(1, 'Property No. is required.'),
  'Valuation List No.': z.string().optional(),
  'Account Number': z.string().optional(),
  'Property Type': z.string().default('Residential'),
  'Rateable Value': z.coerce.number().min(0).default(0),
  'Rate Impost': z.coerce.number().min(0).default(0),
  'Sanitation Charged': z.coerce.number().min(0).default(0),
  'Previous Balance': z.coerce.number().min(0).default(0),
  'Total Payment': z.coerce.number().min(0).default(0),
  'Amount Due': z.coerce.number().min(0).optional(),
});

export function EditPropertyDialog({
  property,
  isOpen,
  onOpenChange,
  onPropertyUpdate,
}: EditPropertyDialogProps) {
  
  const form = useForm<z.infer<typeof propertyFormSchema>>({
    resolver: zodResolver(propertyFormSchema),
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

  useEffect(() => {
    if (property && isOpen) {
       const normalizedData = {
        'S/N': getPropertyValue(property, 'S/N'),
        'Owner Name': getPropertyValue(property, 'Owner Name'),
        'Phone Number': getPropertyValue(property, 'Phone Number'),
        'Town': getPropertyValue(property, 'Town'),
        'Suburb': getPropertyValue(property, 'Suburb'),
        'Property No': getPropertyValue(property, 'Property No'),
        'Valuation List No.': getPropertyValue(property, 'Valuation List No.'),
        'Account Number': getPropertyValue(property, 'Account Number'),
        'Property Type': getPropertyValue(property, 'Property Type') || 'Residential',
        'Rateable Value': getPropertyValue(property, 'Rateable Value') || 0,
        'Rate Impost': getPropertyValue(property, 'Rate Impost') || 0,
        'Sanitation Charged': getPropertyValue(property, 'Sanitation Charged') || 0,
        'Previous Balance': getPropertyValue(property, 'Previous Balance') || 0,
        'Total Payment': getPropertyValue(property, 'Total Payment') || 0,
        'Amount Due': getPropertyValue(property, 'Amount Due'),
      };
      
      form.reset(normalizedData);
    }
  }, [property, isOpen, form]);

  function onSubmit(data: z.infer<typeof propertyFormSchema>) {
    if (property) {
      // Correct phone format on save
      const formattedPhone = normalizePhoneNumber(data['Phone Number']);
      
      const finalAmountDue = data['Amount Due'] !== undefined && data['Amount Due'] !== null 
          ? data['Amount Due'] 
          : calculatedPayable;

      onPropertyUpdate({ 
        ...property, 
        ...data, 
        'Phone Number': formattedPhone,
        'Amount Due': finalAmountDue 
      });
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>Edit Property Record</DialogTitle>
          <DialogDescription>
            Update owner details and billing particulars for this property.
          </DialogDescription>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto p-6 pt-2">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                <div className="space-y-4">
                  <h3 className="font-bold border-b text-sm uppercase tracking-wider text-muted-foreground">1. Owner Details</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <FormField control={form.control} name="S/N" render={({ field }) => (
                        <FormItem>
                          <FormLabel>S/N</FormLabel>
                          <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField control={form.control} name="Owner Name" render={({ field }) => (
                        <FormItem className="md:col-span-2">
                          <FormLabel>Owner&apos;s Full Name</FormLabel>
                          <FormControl><Input {...field} value={field.value ?? ''} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField control={form.control} name="Phone Number" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl><Input {...field} value={field.value ?? ''}/></FormControl>
                          <FormDescription>Will be cleaned to 233 format.</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField control={form.control} name="Town" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Town</FormLabel>
                          <FormControl><Input {...field} value={field.value ?? ''}/></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField control={form.control} name="Suburb" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Suburb</FormLabel>
                          <FormControl><Input {...field} value={field.value ?? ''}/></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                     <FormField control={form.control} name="Property Type" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Property Type</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
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
                          <FormControl><Input {...field} value={field.value ?? ''}/></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField control={form.control} name="Valuation List No." render={({ field }) => (
                          <FormItem>
                            <FormLabel>Valuation List No.</FormLabel>
                            <FormControl><Input {...field} value={field.value ?? ''}/></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField control={form.control} name="Account Number" render={({ field }) => (
                          <FormItem>
                            <FormLabel>Account Number</FormLabel>
                            <FormControl><Input {...field} value={field.value ?? ''}/></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                  </div>
                  
                  <div className="space-y-4 pt-4">
                    <h3 className="font-bold border-b text-sm uppercase tracking-wider text-muted-foreground">2. Billing Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <FormField control={form.control} name="Rateable Value" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Rateable Value (GHS)</FormLabel>
                                <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''}/></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="Rate Impost" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Rate Impost</FormLabel>
                                <FormControl><Input type="number" step="0.0001" {...field} value={field.value ?? ''}/></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                         <FormField control={form.control} name="Sanitation Charged" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Sanitation Charged (GHS)</FormLabel>
                                <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''}/></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                         <FormField control={form.control} name="Previous Balance" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Previous Balance (GHS)</FormLabel>
                                <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''}/></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="Total Payment" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Total Payment (GHS)</FormLabel>
                                <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''}/></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="Amount Due" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-primary font-bold">Manual Amount Due Override</FormLabel>
                                <FormControl><Input type="number" step="0.01" {...field} value={field.value ?? ''}/></FormControl>
                                <FormDescription>Force a specific balance display on bills.</FormDescription>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>
                     <div className="mt-6 bg-muted/50 p-4 rounded-lg border border-primary/20">
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-semibold uppercase tracking-tight">System Calculated Balance:</span>
                            <span className="text-xl font-bold font-mono text-primary">
                                GHS {calculatedPayable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                        </div>
                    </div>
                  </div>
                </div>
              <DialogFooter className="pt-4 border-t sticky bottom-0 bg-background pb-0">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit">Update Record</Button>
              </DialogFooter>
            </form>
          </Form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
