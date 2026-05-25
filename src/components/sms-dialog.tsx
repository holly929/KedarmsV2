'use client';

import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Loader2, MessageSquare } from 'lucide-react';

import type { Property, Bop, License } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { sendSms } from '@/lib/sms-service';
import { getPropertyValue } from '@/lib/property-utils';
import { getBopBillStatus, getBillStatus, getLicenseBillStatus } from '@/lib/billing-utils';

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
  
  const form = useForm<z.infer<typeof smsFormSchema>>({
    resolver: zodResolver(smsFormSchema),
    defaultValues: {
      message: "",
    },
  });

  useEffect(() => {
    if (isOpen && selectedProperties.length > 0) {
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
             defaultMessage = "Dear {{Owner Name}}, your BOP payment of GHS {{Amount Owed}} for '{{Business Name}}' is overdue as of {{Date}}. Please contact the District Assembly.";
         } else if (isHotel) {
             defaultMessage = "Dear {{Name of Hotel/Guest House}}, your license/rate payment of GHS {{Amount Owed}} is overdue as of {{Date}}. Please contact the District Assembly.";
         } else {
            defaultMessage = "Dear {{Owner Name}}, your property rate payment of GHS {{Amount Owed}} for property '{{Property No}}' is overdue as of {{Date}}. Please contact the assembly to arrange payment.";
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
             toast({
                variant: 'destructive',
                title: `${failedSends.length} Messages Failed`,
                description: `Check your SMS provider settings. Error: ${failedSends[0].error}`,
            });
        }
        
        if (successfulSends === 0 && failedSends.length === 0) {
             toast({
                variant: 'destructive',
                title: 'No Valid Recipients',
                description: 'None of the selected items have a valid phone number.',
            });
        }

        if (successfulSends > 0) {
            onOpenChange(false);
        }
    } catch (error) {
        toast({
            variant: 'destructive',
            title: 'System Error',
            description: 'An unexpected error occurred while sending SMS.',
        });
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
              ? `Sending a message to ${getPropertyValue(selectedProperties[0] as any, 'Owner Name') || 'this owner'}.`
              : `Compose a message to send to ${recipientCount} selected recipients with phone numbers.`}
            You can use placeholders like {'{{Owner Name}}'}.
          </DialogDescription>
        </DialogHeader>
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