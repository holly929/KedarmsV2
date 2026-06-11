'use client';

import { useState, useEffect, useRef, useMemo, forwardRef, memo } from 'react';
import { useReactToPrint } from 'react-to-print';
import JsBarcode from 'jsbarcode';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Bill } from '@/lib/types';
import { Printer, ShieldCheck } from 'lucide-react';
import { getPropertyValue } from '@/lib/property-utils';
import { store } from '@/lib/store';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const styles = {
  container: {
    backgroundColor: '#ffffff',
    color: '#000000',
    width: '210mm',
    minHeight: '297mm',
    padding: '15mm',
    boxSizing: 'border-box' as const,
    position: 'relative' as const,
    fontFamily: 'system-ui, -apple-system, sans-serif',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden' as const,
  },
  innerBorder: {
    border: '4px double #000000',
    padding: '10px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column' as const,
    position: 'relative' as const,
    flexGrow: 1,
  },
  header: {
    borderBottom: '2px solid #000000',
    paddingBottom: '10px',
    marginBottom: '15px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    textAlign: 'center' as const,
    zIndex: 1,
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 0',
    borderBottom: '1px solid #e5e7eb',
    fontSize: '12px',
    color: '#000000',
  },
  boldRow: {
    fontWeight: 'bold',
    backgroundColor: '#f9fafb',
    borderTop: '1px solid #000000',
    borderBottom: '1px solid #000000',
    padding: '6px 4px',
    color: '#000000',
  },
  totalSection: {
    marginTop: 'auto',
    padding: '15px',
    border: '2px solid #000000',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    color: '#000000',
  },
  footer: {
    marginTop: '20px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    color: '#000000',
  }
};

const parseNumeric = (val: any): number => {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return val;
  const cleaned = String(val).replace(/,/g, '').replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
};

const formatCurrency = (val: any): string => {
  return parseNumeric(val).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const Barcode = memo(({ value }: { value: string }) => {
  const ref = useRef<SVGSVGElement | null>(null);
  useEffect(() => {
    if (ref.current && value) {
      try {
        JsBarcode(ref.current, value, {
          format: "CODE128",
          width: 1.2,
          height: 30,
          margin: 0,
          displayValue: false,
          lineColor: '#000000'
        });
      } catch (e) { console.error(e); }
    }
  }, [value]);
  return <svg ref={ref} style={{ maxWidth: '100%' }} />;
});
Barcode.displayName = 'Barcode';

export const PrintableContent = forwardRef<HTMLDivElement, { 
  data: any; 
  billType: 'property' | 'bop' | 'license'; 
  settings: any; 
  isDemandNotice?: boolean;
  isCompact?: boolean;
}>(function PrintableContent({ data, billType, settings, isDemandNotice }, ref) {

  // React Hooks must be called before any conditional early returns
  const totalAmountDue = useMemo(() => {
    if (!data) return 0;
    const importedTotal = parseNumeric(getPropertyValue(data, 'Amount Due'));
    if (importedTotal !== 0) return importedTotal;

          if (billType === 'property') {
      const rv = parseNumeric(getPropertyValue(data, 'Rateable Value'));
      const ri = parseNumeric(getPropertyValue(data, 'Rate Impost'));
      const tp = parseNumeric(getPropertyValue(data, 'Total Payment'));
      return (rv * ri) - tp;
    } else if (billType === 'bop') {
      return (parseNumeric(getPropertyValue(data, 'Permit Fee')) + parseNumeric(getPropertyValue(data, 'Arrears'))) - parseNumeric(getPropertyValue(data, 'Payment'));
    } else {
      const lf = parseNumeric(getPropertyValue(data, 'Property Rate')) || parseNumeric(getPropertyValue(data, 'License Fee'));
      return (lf + parseNumeric(getPropertyValue(data, 'Bop Amount')) + parseNumeric(getPropertyValue(data, 'Arrears'))) - parseNumeric(getPropertyValue(data, 'Payment'));
    }
  }, [data, billType]);

  const isUnassessed = useMemo(() => {
    if (!data) return false;
    const propType = getPropertyValue(data, 'Property Type');
    if (!propType) return false;
    return billType === 'property' && String(propType).toLowerCase().includes('unassessed');
  }, [data, billType]);

  const headerCaption = useMemo(() => {
    if (settings?.appearance?.demandNoticeCaption && isDemandNotice) return settings.appearance.demandNoticeCaption;
    if (isUnassessed) return 'PROPERTY RATE DEMAND NOTICE(UNASSESSED)';
    return isDemandNotice ? 'DEMAND NOTICE' : 'OFFICIAL BILLING NOTICE';
  }, [settings?.appearance?.demandNoticeCaption, isUnassessed, isDemandNotice]);

  if (!data) {
    return null;
  }

  const identifier = getPropertyValue(data, 'Property No') || getPropertyValue(data, 'S/N') || getPropertyValue(data, 'SN') || 'N/A';
  const owner = (getPropertyValue(data, 'Owner Name') || getPropertyValue(data, 'Business Name') || getPropertyValue(data, 'Name of Hotel/Guest House') || 'N/A').toUpperCase();
  const town = String(getPropertyValue(data, 'Town') || '').toUpperCase();
  const suburb = String(getPropertyValue(data, 'Suburb') || '').toUpperCase();

  return (
    <div ref={ref} style={styles.container}>
      <div style={styles.innerBorder}>
        {settings.appearance?.ghanaLogo && settings.appearance.ghanaLogo !== '' && (
          <img src={settings.appearance.ghanaLogo} alt="Watermark" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', objectFit: 'contain', opacity: 0.05, width: '300px', height: '300px', zIndex: 0, pointerEvents: 'none' }} />
        )}
        
        <header style={styles.header}>
          <div style={{ width: '60px', height: '60px', position: 'relative' }}>
            {settings.appearance?.ghanaLogo && <img src={settings.appearance.ghanaLogo} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="Ghana Logo" />}
          </div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '20px', fontWeight: 'bold', margin: 0, color: '#000000' }}>{settings.general?.assemblyName || 'DISTRICT ASSEMBLY'}</h1>
            <p style={{ fontSize: '10px', fontWeight: 'bold', margin: '4px 0', color: '#000000' }}>LOCAL GOVERNANCE ACT, 2016 (ACT 936)</p>
            <p style={{ fontSize: '12px', margin: 0, color: '#000000' }}>{settings.general?.postalAddress}</p>
            <p style={{ fontSize: '12px', fontWeight: 'bold', color: '#000000' }}>TEL: {settings.general?.contactPhone}</p>
            <div style={{ 
              marginTop: '10px', 
              display: 'inline-block', 
              padding: '4px 20px', 
              backgroundColor: isDemandNotice ? '#dc2626' : '#000000', 
              color: '#ffffff', 
              fontWeight: 'bold',
              fontSize: '14px',
              textTransform: 'uppercase'
            }}>
              {headerCaption}
            </div>
          </div>
          <div style={{ width: '60px', height: '60px', position: 'relative' }}>
            {settings.appearance?.assemblyLogo && <img src={settings.appearance.assemblyLogo} style={{ width: '100%', height: '100%', objectFit: 'contain' }} alt="Assembly Logo" />}
          </div>
        </header>

        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '10px', marginBottom: '15px' }}>
          <div style={{ border: '2px solid #000000', padding: '10px', backgroundColor: '#f9fafb' }}>
            <span style={{ fontSize: '10px', fontWeight: 'bold', color: '#4b5563', display: 'block' }}>BILLED TO:</span>
            <span style={{ fontSize: '16px', fontWeight: '900', display: 'block', color: '#000000' }}>{owner}</span>
            <div style={{ marginTop: '5px' }}>
              <span style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', color: '#000000' }}>TOWN: {town}</span>
              <span style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', color: '#000000' }}>SUBURB: {suburb}</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ border: '2px solid #000000', padding: '4px', textAlign: 'center' }}>
              <span style={{ fontSize: '9px', fontWeight: 'bold', display: 'block', color: '#000000' }}>IDENTIFIER</span>
              <span style={{ fontSize: '12px', fontWeight: 'bold', fontFamily: 'monospace', color: '#000000' }}>{identifier}</span>
            </div>
            <div style={{ border: '2px solid #000000', padding: '4px', textAlign: 'center' }}>
              <span style={{ fontSize: '9px', fontWeight: 'bold', display: 'block', color: '#000000' }}>BILL DATE</span>
              <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#000000' }}>{new Date().toLocaleDateString('en-GB')}</span>
            </div>
          </div>
        </div>

        <div style={{ flexGrow: 1 }}>
          {billType === 'property' ? (
            <>
              <div style={styles.row}><span>ANNUAL RATE CHARGED</span><span>{formatCurrency(parseNumeric(getPropertyValue(data, 'Rateable Value')) * parseNumeric(getPropertyValue(data, 'Rate Impost')))}</span></div>
              <div style={{ ...styles.row, ...styles.boldRow }}><span>CURRENT YEAR DUE</span><span>{formatCurrency(parseNumeric(getPropertyValue(data, 'Rateable Value')) * parseNumeric(getPropertyValue(data, 'Rate Impost')))}</span></div>
              <div style={{ ...styles.row, ...styles.boldRow }}><span>GROSS TOTAL DUE</span><span>{formatCurrency(parseNumeric(getPropertyValue(data, 'Rateable Value')) * parseNumeric(getPropertyValue(data, 'Rate Impost')))}</span></div>
              <div style={styles.row}><span>LESS TOTAL PAYMENTS</span><span>{formatCurrency(getPropertyValue(data, 'Total Payment'))}</span></div>
            </>
          ) : (
            <>
              <div style={styles.row}><span>FIXED LICENSE FEE</span><span>{formatCurrency(getPropertyValue(data, 'Permit Fee') || getPropertyValue(data, 'Property Rate') || getPropertyValue(data, 'License Fee'))}</span></div>
              {billType === 'license' && <div style={styles.row}><span>BOP COMPONENT</span><span>{formatCurrency(getPropertyValue(data, 'Bop Amount'))}</span></div>}
              <div style={styles.row}><span>ARREARS BROUGHT FORWARD</span><span>{formatCurrency(getPropertyValue(data, 'Arrears'))}</span></div>
              <div style={styles.row}><span>LESS PAYMENTS RECEIVED</span><span>{formatCurrency(getPropertyValue(data, 'Payment'))}</span></div>
            </>
          )}
        </div>

        <div style={{ ...styles.totalSection, backgroundColor: isDemandNotice ? '#fee2e2' : (settings.appearance?.accentColor || '#f1f5f9') }}>
          <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#000000' }}>NET PAYABLE (GH₵)</span>
          <span style={{ fontSize: '24px', fontWeight: '900', color: '#000000' }}>{formatCurrency(totalAmountDue)}</span>
        </div>

        <footer style={styles.footer}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: '10px', fontWeight: 'bold', display: 'block', marginBottom: '5px', color: '#000000' }}>SECURE TRACKING</span>
            <Barcode value={`${identifier}|${totalAmountDue.toFixed(2)}`} />
          </div>
          <div style={{ width: '200px', textAlign: 'center' }}>
            <div style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {settings.appearance?.signature && <img src={settings.appearance.signature} style={{ maxHeight: '100%', width: '150px', objectFit: 'contain' }} alt="Signature" />}
            </div>
            <p style={{ borderTop: '1px solid #000000', fontSize: '10px', fontWeight: 'bold', paddingTop: '4px', margin: 0, color: '#000000' }}>COORDINATING DIRECTOR</p>
          </div>
        </footer>

        <div style={{ 
          marginTop: '15px', 
          backgroundColor: isDemandNotice ? '#dc2626' : '#000000', 
          color: '#ffffff', 
          textAlign: 'center', 
          padding: '6px', 
          fontWeight: 'bold', 
          fontSize: '11px',
          textTransform: 'uppercase'
        }}>
          {isDemandNotice ? 'FINAL WARNING: LEGAL ACTION WILL BE TAKEN IF NOT PAID WITHIN 14 DAYS.' : (settings.appearance?.billWarningText || 'PAY AT ONCE OR FACE LEGAL ACTION')}
        </div>
      </div>
    </div>
  );
});
PrintableContent.displayName = 'PrintableContent';

export interface BillDialogProps {
  bill: Bill | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export function BillDialog({ bill, isOpen, onOpenChange }: BillDialogProps) {
  const componentRef = useRef<HTMLDivElement>(null);
  const [isDemandNotice, setIsDemandNotice] = useState(false);
  const [settings, setSettings] = useState<any>({});

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    removeAfterPrint: true
  });

  useEffect(() => {
    if (isOpen) {
      setSettings({
        general: store.settings.generalSettings || {},
        appearance: store.settings.appearanceSettings || {},
      });
    }
  }, [isOpen]);

  if (!bill || !isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[950px] p-0 overflow-hidden border-0">
        <div className="flex h-[85vh]">
          <div className="w-[280px] border-r bg-muted/20 p-6 space-y-6">
            <h3 className="font-bold flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Enforcement</h3>
            <div className="flex items-center justify-between p-4 border rounded-lg bg-white">
              <Label htmlFor="dlg-demand">Demand Notice</Label>
              <Switch id="dlg-demand" checked={isDemandNotice} onCheckedChange={setIsDemandNotice} />
            </div>
          </div>
          <div className="flex-1 bg-slate-200 overflow-auto p-10 flex justify-center">
            <div style={{ transform: 'scale(0.8)', transformOrigin: 'top center' }}>
              <PrintableContent 
                ref={componentRef} 
                data={bill.propertySnapshot} 
                billType={bill.billType} 
                settings={settings}
                isDemandNotice={isDemandNotice}
              />
            </div>
          </div>
        </div>
        <DialogFooter className="p-4 bg-white border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={handlePrint} className={isDemandNotice ? "bg-red-600" : ""}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
