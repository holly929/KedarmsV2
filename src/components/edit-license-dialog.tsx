
'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';

import type { License } from '@/lib/types';
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { getPropertyValue } from '@/lib/property-utils';

interface EditLicenseDialogProps {
  license: License | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onLicenseUpdate: (license: License) => void;
}

const licenseFormSchema = z.object({
  'Record Type': z.array(z.string()).min(1, 'Select at least one record type.'),
  'S/N': z.string().optional(),
  'Name of Hotel/Guest House': z.string().min(3, 'Name is required.'),
  'Phone Number': z.string().optional(),
  'Property Rate': z.coerce.number().min(0, 'Property Rate must be a positive number.'),
  'Bop Amount': z.coerce.number().min(0).default(0),
  'Arrears': z.coerce.number().min(0).default(0),
  'Payment': z.coerce.number().min(0, 'Payment must be a positive number.'),
});

const RECORD_TYPES = ['Property Rate', 'BOP'];

export function EditLicenseDialog({
  license,
  isOpen,
  onOpenChange,
  onLicenseUpdate,
}: EditLicenseDialogProps) {
  
  const form = useForm<z.infer<typeof licenseFormSchema>>({
    resolver: zodResolver(licenseFormSchema),
    defaultValues: {
        'Record Type': ['Property Rate'],
        'S/N': '',
        'Name of Hotel/Guest House': '',
        'Phone Number': '',
        'Property Rate': 0,
        'Bop Amount': 0,
        'Arrears': 0,
        'Payment': 0,
    }
  });

  const watchedValues = form.watch();
  
  const totalAmountDue = React.useMemo(() => {
    const rate = Number(watchedValues['Property Rate']) || 0;
    const bopAmt = Number(watchedValues['Bop Amount']) || 0;
    const arrears = Number(watchedValues['Arrears']) || 0;
    return rate + bopAmt + arrears;
  }, [watchedValues]);

  const totalAmountPayable = React.useMemo(() => {
    const payment = Number(watchedValues['Payment']) || 0;
    return totalAmountDue - payment;
  }, [totalAmountDue, watchedValues]);

  useEffect(() => {
    if (license && isOpen) {
       const recordTypeStr = getPropertyValue(license, 'Record Type') || 'Property Rate';
       const recordTypeArray = String(recordTypeStr).split(',').map((s: string) => s.trim()).filter(Boolean);

       const normalizedData = {
        'Record Type': recordTypeArray.length > 0 ? recordTypeArray : ['Property Rate'],
        'S/N': getPropertyValue(license, 'S/N'),
        'Name of Hotel/Guest House': getPropertyValue(license, 'Name of Hotel/Guest House'),
        'Phone Number': getPropertyValue(license, 'Phone Number'),
        'Property Rate': getPropertyValue(license, 'Property Rate') || getPropertyValue(license, 'License Fee') || 0,
        'Bop Amount': getPropertyValue(license, 'Bop Amount') || 0,
        'Arrears': getPropertyValue(license, 'Arrears') || 0,
        'Payment': getPropertyValue(license, 'Payment') || 0,
      };
      
      form.reset(normalizedData);
    }
  }, [license, isOpen, form]);

  function onSubmit(data: z.infer<typeof licenseFormSchema>) {
    if (license) {
      onLicenseUpdate({ 
        ...license, 
        ...data, 
        'Record Type': data['Record Type'].join(', '),
        'Amount Due': totalAmountDue 
      } as any);
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Record</DialogTitle>
          <DialogDescription>
            Update the record details below.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="Record Type"
                      render={() => (
                        <FormItem>
                          <div className="mb-2">
                            <FormLabel>Record Type</FormLabel>
                          </div>
                          <div className="flex flex-col gap-2">
                            {RECORD_TYPES.map((item) => (
                              <FormField
                                key={item}
                                control={form.control}
                                name="Record Type"
                                render={({ field }) => {
                                  return (
                                    <FormItem
                                      key={item}
                                      className="flex flex-row items-start space-x-3 space-y-0"
                                    >
                                      <FormControl>
                                        <Checkbox
                                          checked={field.value?.includes(item)}
                                          onCheckedChange={(checked) => {
                                            return checked
                                              ? field.onChange([...field.value, item])
                                              : field.onChange(
                                                  field.value?.filter(
                                                    (value) => value !== item
                                                  )
                                                )
                                          }}
                                        />
                                      </FormControl>
                                      <FormLabel className="font-normal cursor-pointer">
                                        {item}
                                      </FormLabel>
                                    </FormItem>
                                  )
                                }}
                              />
                            ))}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField control={form.control} name="S/N" render={({ field }) => (
                        <FormItem>
                          <FormLabel>S/N</FormLabel>
                          <FormControl><Input placeholder="e.g. 001" {...field} value={field.value ?? ''} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField control={form.control} name="Name of Hotel/Guest House" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Name of Hotel/Guest House</FormLabel>
                          <FormControl><Input placeholder="e.g. Adom Hotel" {...field} value={field.value ?? ''} /></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <FormField control={form.control} name="Phone Number" render={({ field }) => (
                        <FormItem>
                          <FormLabel>Phone Number</FormLabel>
                          <FormControl><Input placeholder="e.g. 0244123456" {...field} value={field.value ?? ''}/></FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <div className="border-t pt-4 mt-4">
                    <h3 className="text-lg font-medium">Billing Details</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-2">
                        <FormField control={form.control} name="Property Rate" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Property Rate (GHS)</FormLabel>
                                <FormControl><Input type="number" step="10" {...field} value={field.value ?? ''}/></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="Bop Amount" render={({ field }) => (
                            <FormItem>
                                <FormLabel>BOP Amount (GHS)</FormLabel>
                                <FormControl><Input type="number" step="10" {...field} value={field.value ?? ''}/></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="Arrears" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Arrears (GHS)</FormLabel>
                                <FormControl><Input type="number" step="10" {...field} value={field.value ?? ''}/></FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                        <FormField control={form.control} name="Payment" render={({ field }) => (
                            <FormItem>
                                <FormLabel>Payment (GHS)</FormLabel>
                                <FormControl><Input type="number" step="10" {...field} value={field.value ?? ''}/></FormControl>
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
                </div>
              <DialogFooter className="pt-6">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit">Save Changes</Button>
              </DialogFooter>
            </form>
          </Form>
      </DialogContent>
    </Dialog>
  );
}
