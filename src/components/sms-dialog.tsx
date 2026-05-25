'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, MessageSquare, AlertCircle } from 'lucide-react';

import type { Property, Bop, License } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { sendSms } from '@/lib/sms-service';
import { getPropertyValue } from '@/lib/property-utils';
import { getBopBillStatus, getBillStatus, getLicenseBillStatus } from '@/lib/billing-utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface SmsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  selectedProperties: (Property | Bop | License)[];
}

const smsFormSchema = z.object({
  message: z.string().min(10, "Message must be at least 10 characters.").max(480, "Message is too long."),
});

export function SmsDialog({ isOpen, onOpenChange, selectedProperties }: SmsDialogProps) {
  const { toast } = useToast();
  const [isSending, setIsSending] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  
  const form = useForm<z.infer<typeof smsFormSchema>>({
    resolver: zodResolver(smsFormSchema),
    defaultValues: {
      message: "",
    },
  });

  useEffect(() => {
    if (isOpen && selectedProperties.length > 0) {
      setLastError(null);
      const firstItem = selectedProperties[0];
      const isBop = !!getPropertyValue(firstItem as any, 'Business Name');
      const isHotel = !!getPropertyValue(firstItem as any, 'Name of Hotel/Guest House');
      
      let status = 'Unbilled';
      if (isBop) {
          status = getBopBillStatus(firstItem as Bop);
      } else if (isHotel) {
          status = getLicenseBillStatus(firstItem as License);
      } else {
          status = getBillStatus(firstItem as Property);
      }

      const isDefaulter = status === 'Overdue' || status === 'Pending';

      let defaultMessage = "";
      if (isDefaulter) {
         if (isBop) {
             defaultMessage = "Dear {{Owner Name}}, your BOP payment of GHS {{Amount Owed}} for '{{Business Name}}' is overdue. Please contact the Assembly.";
         } else if (isHotel) {
             defaultMessage = "Dear {{Name of Hotel/Guest House}}, your license/rate payment of GHS {{Amount Owed}} is overdue. Please contact the Assembly.";
         } else {
            defaultMessage = "Dear {{Owner Name}}, your property rate payment of GHS {{Amount Owed}} for '{{Property No}}' is overdue. Please contact the Assembly.";
         }
      } else {
        defaultMessage = "Dear {{Owner Name}}, this is a notification from the District Assembly regarding your records. Current balance: GHS {{Amount Owed}}. Thank you.";
      }

      form.reset({ message: defaultMessage });
      setIsSending(false);
    }
  }, [isOpen, form, selectedProperties]);

  const recipientCount = selectedProperties.filter(p => getPropertyValue(p as any, 'Phone Number')).length;

  async function onSubmit(data: z.infer<typeof smsFormSchema>) {
    setIsSending(true);
    setLastError(null);

    try {
        const results = await sendSms(selectedProperties, data.message);
        const successfulSends = results.filter(r => r.success).length;
        const failedSends = results.filter(r => !r.success && r.error !== 'No phone number');

        if (successfulSends > 0) {
           toast({
            title: 'SMS Dispatched',
            description: `Successfully sent ${successfulSends} message(s).`,
          });
        }

        if (failedSends.length > 0) {
            setLastError(failedSends[0].error || "Check your SMS provider settings.");
        }
        
        if (successfulSends === 0 && failedSends.length === 0) {
             setLastError("None of the selected items have a valid phone number.");
        }

        if (successfulSends > 0 && failedSends.length === 0) {
            onOpenChange(false);
        }
    } catch (error: any) {
        setLastError(error.message || "An unexpected system error occurred.");
    } finally {
        setIsSending(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-6 w-6 text-primary" />
            Send SMS Notification
          </DialogTitle>
          <DialogDescription>
            {selectedProperties.length === 1 
              ? `Sending to ${getPropertyValue(selectedProperties[0] as any, 'Owner Name') || 'this owner'}.`
              : `Composer for ${recipientCount} selected recipients.`}
          </DialogDescription>
        </DialogHeader>
        
        {lastError && (
            <Alert variant="destructive" className="my-2">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Dispatch Failed</AlertTitle>
                <AlertDescription>{lastError}</AlertDescription>
            </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Message Content</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={6}
                      placeholder="Type your message here..."
                      disabled={isSending}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSending}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSending || recipientCount === 0}>
                {isSending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  `Send SMS (${recipientCount})`
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
