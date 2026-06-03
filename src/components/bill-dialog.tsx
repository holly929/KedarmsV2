'use client';

import { useState, useEffect, useRef, useMemo, useCallback, forwardRef, memo } from 'react';
import { useReactToPrint } from 'react-to-print';
import JsBarcode from 'jsbarcode';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Property, Bop, License, Bill } from '@/lib/types';
import { Printer, Loader2, FileWarning } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPropertyValue } from '@/lib/property-utils';
import { store } from '@/lib/store';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

interface BillDialogProps {
  bill: Bill | null;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

type GeneralSettings = {
  assemblyName?: string;
  postalAddress?: string;
  contactPhone?: string;
};

type AppearanceSettings = {
  assemblyLogo?: string;
  ghanaLogo?: string;
  signature?: string;
  billWarningText?: string;
  demandNoticeCaption?: string;
  fontFamily?: 'sans' | 'serif' | 'mono';
  fontSize?: number;
  accentColor?: string;
};

const parseNumeric = (val: any): number => {
    if (val === undefined || val === null) return 0;
    if (typeof val === 'number') return val;
    const cleaned = String(val).replace(/,/g, '').replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
};

const formatToTwoDecimals = (val: any): string => {
    const num = parseNumeric(val);
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const BarcodeComponent = memo(({ value, isCompact }: { value: string; isCompact: boolean }) => {
    const ref = useRef<SVGSVGElement | null>(null);

    useEffect(() => {
        if (ref.current && value) {
            try {
                JsBarcode(ref.current, value, {
                    format: "CODE128",
                    width: isCompact ? 1.0 : 1.4,
                    height: isCompact ? 25 : 35,
                    fontSize: isCompact ? 8 : 10,
                    margin: 0,
                    displayValue: false,
                    background: 'transparent'
                });
            } catch (e) {
                // Ignore silent errors for massive batches
            }
        }
    }, [value, isCompact]);

    return <svg ref={ref} className="max-w-full h-auto" />;
});
BarcodeComponent.displayName = 'BarcodeComponent';

const BillRow = ({ label, value, isBold = false, style = {} }: { label: string; value: string | number; isBold?: boolean; style?: React.CSSProperties }) => (
  <div className={cn("flex justify-between p-1 border-b border-black/20 items-center", isBold ? 'font-bold' : '')} style={style}>
    <span className="text-[0.85em] uppercase tracking-tight">{label}</span>
    <span className="text-right font-mono">{value}</span>
  </div>
);

interface PrintableContentProps {
  property?: Property;
  data?: Property | Bop | License;
  billType?: 'property' | 'bop' | 'license';
  settings: { general?: GeneralSettings, appearance?: AppearanceSettings }; 
  isCompact?: boolean; 
  isDemandNotice?: boolean;
}

const PrintableContentBase = forwardRef<HTMLDivElement, PrintableContentProps>(
  ({ property: propertyProp, data: dataProp, billType: billTypeProp, settings, isCompact = false, isDemandNotice = false }, ref) => {
    
    const data = dataProp || propertyProp;
    const billType = billTypeProp || 'property';
    
    const { fontFamily, fontSize, accentColor } = settings.appearance || {};

    const fontClass = useMemo(() => {
      const config: Record<string, string> = {
        sans: 'font-sans',
        serif: 'font-serif',
        mono: 'font-mono'
      };
      return config[fontFamily || 'sans'] || config.sans;
    }, [fontFamily]);

    const finalFontSize = useMemo(() => {
        const baseSize = fontSize || 11;
        return isCompact ? Math.max(8, baseSize - 1.5) : baseSize;
    }, [fontSize, isCompact]);

    const baseStyle = useMemo(() => ({
        fontSize: `${finalFontSize}px`,
        lineHeight: `${finalFontSize * 1.3}px`,
        contain: 'layout style paint',
        transform: 'translateZ(0)',
    }), [finalFontSize]);

    const accentStyle = useMemo(() => ({
        backgroundColor: isDemandNotice ? '#FEE2E2' : (accentColor || '#F1F5F9')
    }), [accentColor, isDemandNotice]);
    
    const getNumericValue = useCallback((key: string): number => {
        if (!data) return 0;
        return parseNumeric(getPropertyValue(data as any, key));
    }, [data]);

    const formatValue = useCallback((valueKey: string) => {
        if (!data) return '...';
        const val = getPropertyValue(data as any, valueKey);
        const strVal = val !== null && val !== undefined ? String(val).trim() : '';
        
        const identityKeys = ['owner', 'name', 'town', 'suburb', 'property no', 's/n', 'sn', 'hotel', 'guest house', 'entity', 'business'];
        const isIdentityField = identityKeys.some(k => valueKey.toLowerCase().includes(k));
        const isZeroPlaceholder = /^[0.]+$/.test(strVal);

        if (isIdentityField && (strVal === '' || isZeroPlaceholder)) return '...';
        
        const numericKeys = ['license fee', 'bop amount', 'arrears', 'payment', 'rateable value', 'rate impost', 'total payment', 'permit fee', 'sanitation charged', 'previous balance', 'amount due', 'property rate'];
        if (numericKeys.some(k => valueKey.toLowerCase().includes(k))) {
            if (valueKey.toLowerCase().includes('impost')) return strVal || '0.00';
            return formatToTwoDecimals(val);
        }
        
        return strVal || '...';
    }, [data]);
    
    const totalAmountPayableNum = useMemo(() => {
        if (!data) return 0;
        const importedTotal = getNumericValue('Amount Due');
        if (importedTotal !== 0) return importedTotal;

        let calculated = 0;
        if (billType === 'property') {
            const rv = getNumericValue('Rateable Value');
            const ri = getNumericValue('Rate Impost');
            const sc = getNumericValue('Sanitation Charged');
            const pb = getNumericValue('Previous Balance');
            const tp = getNumericValue('Total Payment');
            calculated = (rv * ri) + sc + pb - tp;
        } else if (billType === 'bop') {
            calculated = (getNumericValue('Permit Fee') + getNumericValue('Arrears')) - getNumericValue('Payment');
        } else {
            const lf = getNumericValue('Property Rate') || getNumericValue('License Fee');
            calculated = (lf + getNumericValue('Bop Amount') + getNumericValue('Arrears')) - getNumericValue('Payment');
        }
        return calculated;
    }, [data, billType, getNumericValue]);

    const totalAmountPayable = useMemo(() => formatToTwoDecimals(totalAmountPayableNum), [totalAmountPayableNum]);

    const billedToName = useMemo(() => {
        if (!data) return '...';
        const nameVal = getPropertyValue(data as any, 'Owner Name') || getPropertyValue(data as any, 'Business Name') || getPropertyValue(data as any, 'Name of Hotel/Guest House') || '...';
        const strVal = String(nameVal).trim();
        return (/^[0.]+$/.test(strVal) || strVal === '') ? '...' : strVal.toUpperCase();
    }, [data]);

    const suburbHeaderDisplay = useMemo(() => {
      if (!data) return '';
      const subVal = String(getPropertyValue(data as any, 'Suburb') || '').trim();
      return (/^[0.]+$/.test(subVal) || subVal === '') ? '' : subVal.toUpperCase();
    }, [data]);

    const barcodeValue = useMemo(() => {
        if (!data) return '';
        const idStr = String(getPropertyValue(data as any, 'Property No') || getPropertyValue(data as any, 'S/N') || getPropertyValue(data as any, 'SN') || data.id);
        const amtStr = totalAmountPayable.replace(/[^0-9.]/g, '');
        return `${idStr}|${amtStr}|${new Date().getFullYear()}`;
    }, [data, totalAmountPayable]);

    const financialCalcs = useMemo(() => {
        const rvValue = getNumericValue('Rateable Value');
        const riValue = getNumericValue('Rate Impost');
        const scValue = getNumericValue('Sanitation Charged');
        const pbValue = getNumericValue('Previous Balance');
        const tpValue = getNumericValue('Total Payment') || getNumericValue('Payment');
        const chargedValue = rvValue * riValue;
        const totalThisYearValue = chargedValue + scValue;
        const totalBillValue = totalThisYearValue + pbValue;

        const pfValue = getNumericValue('Permit Fee');
        const bopTotalDueValue = (pfValue + getNumericValue('Arrears'));

        const lfValue = getNumericValue('Property Rate') || getNumericValue('License Fee');
        const licenseBopValue = getNumericValue('Bop Amount');
        const licenseTotalDueValue = (lfValue + licenseBopValue + getNumericValue('Arrears'));

        return {
            rvValue, riValue, scValue, pbValue, tpValue, chargedValue, totalThisYearValue, totalBillValue,
            pfValue, bopTotalDueValue,
            lfValue, licenseBopValue, licenseTotalDueValue
        };
    }, [getNumericValue]);

    return (
      <div ref={ref} className={cn("text-black bg-white w-full h-full box-border", fontClass, isCompact ? 'p-1' : 'p-2')} style={baseStyle}>
        <div className="border-[3px] border-double border-black p-2 relative h-full flex flex-col shadow-sm">
          <div className="absolute inset-0 z-0 flex items-center justify-center opacity-[0.05] pointer-events-none">
              {settings.appearance?.ghanaLogo && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={settings.appearance.ghanaLogo} alt="Watermark" width={300} height={300} style={{objectFit: 'contain'}} />
              )}
          </div>
          
          <div className="relative z-10 flex flex-col flex-grow">
            <header className="flex justify-between items-center mb-2 border-b-2 border-black pb-1">
                <div className="w-[70px] flex justify-start">
                    {settings.appearance?.ghanaLogo && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={settings.appearance.ghanaLogo} alt="Ghana" className="object-contain h-auto" style={{ width: '60px' }} />
                    )}
                </div>
                <div className="flex-1 text-center px-1">
                    <h1 className="font-extrabold tracking-tight uppercase leading-tight" style={{ fontSize: `${finalFontSize * 1.5}px` }}>{settings.general?.assemblyName || 'THE DISTRICT ASSEMBLY'}</h1>
                    <p className="text-[9px] font-bold uppercase tracking-tighter mb-0.5">LOCAL GOVERNANCE ACT, 2016 (ACT 936)</p>
                    <p className="font-semibold leading-tight text-[0.9em]">{settings.general?.postalAddress}</p>
                    <p className="font-semibold text-[0.85em]">TEL: {settings.general?.contactPhone}</p>
                    
                    <div className={cn("mt-1 inline-block px-3 py-0.5 border-2 border-black font-black tracking-widest uppercase", isDemandNotice ? "bg-red-600 text-white border-red-700" : "bg-black text-white")} style={{ fontSize: `${finalFontSize * 1.1}px` }}>
                      {isDemandNotice 
                        ? (settings.appearance?.demandNoticeCaption || 'DEMAND NOTICE') 
                        : 'PROPERTY RATE & B.O.P BILL'}
                    </div>
                </div>
                <div className="w-[70px] flex justify-end">
                    {settings.appearance?.assemblyLogo && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={settings.appearance.assemblyLogo} alt="Logo" className="object-contain h-auto" style={{ width: '60px' }} />
                    )}
                </div>
            </header>

            <div className="text-center py-1.5 mb-2 border border-black bg-black/[0.02]">
                <span className="text-[0.6em] font-bold block text-muted-foreground tracking-widest uppercase">BILLED TO:</span>
                <span className="font-black tracking-tight leading-none" style={{ fontSize: `${finalFontSize * 1.4}px` }}>{billedToName}</span>
                {suburbHeaderDisplay && (
                  <span className="text-[1.1em] font-black block mt-0.5 tracking-wider text-black border-t border-black/5 pt-0.5 uppercase">SUBURB: {suburbHeaderDisplay}</span>
                )}
            </div>
            
            <main className="border-2 border-black flex-grow flex flex-col">
                {billType === 'property' ? (
                  <>
                    <div className="flex border-b-2 border-black">
                        <div className="w-[65%] border-r-2 border-black">
                            <div className="flex border-b border-black/10"><div className="w-1/3 font-bold p-1 bg-black/[0.02] text-[0.85em]">OWNER NAME</div><div className="w-2/3 border-l border-black/10 p-1 font-bold truncate">{formatValue('Owner Name')}</div></div>
                            <div className="flex border-b border-black/10"><div className="w-1/3 font-bold p-1 bg-black/[0.02] text-[0.85em]">PHONE NO</div><div className="w-2/3 border-l border-black/10 p-1">{formatValue('Phone Number')}</div></div>
                            <div className="flex border-b border-black/10"><div className="w-1/3 font-bold p-1 bg-black/[0.02] text-[0.85em]">TOWN</div><div className="w-2/3 border-l border-black/10 p-1">{formatValue('Town')}</div></div>
                            <div className="flex border-b border-black/10"><div className="w-1/3 font-bold p-1 bg-black/[0.02] text-[0.85em]">PROPERTY NO</div><div className="w-2/3 border-l border-black/10 p-1 font-mono font-bold">{formatValue('Property No')}</div></div>
                        </div>
                        <div className="w-[35%] flex flex-col">
                            <div className="flex border-b border-black/10 h-1/2"><div className="w-1/2 font-bold p-1 bg-black/[0.02] text-[0.85em]">TYPE</div><div className="w-1/2 border-l border-black/10 p-1 text-center font-bold text-[0.8em]">{formatValue('Property Type')}</div></div>
                            <div className="flex-1 flex flex-col items-center justify-center bg-black/5">
                                <span className="font-bold text-[0.7em] uppercase tracking-tighter">Amount Due</span>
                                <span className="font-black text-[1.1em]">(GH&#8373;)</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-1">
                        <div className="w-[65%] border-r-2 border-black flex flex-col">
                            <div className="flex border-b border-black bg-black/[0.02] text-[0.75em] font-bold">
                                <div className="w-1/3 p-1 text-center">PARTICULARS</div>
                                <div className="w-1/3 border-x border-black/10 p-1 text-center">RV: {formatToTwoDecimals(financialCalcs.rvValue)}</div>
                                <div className="w-1/3 p-1 text-center">IMPOST: {formatValue('Rate Impost')}</div>
                            </div>
                            <div className="flex-grow">
                                <BillRow label="AMOUNT CHARGED" value={formatToTwoDecimals(financialCalcs.chargedValue)} />
                                <BillRow label="SANITATION FEE" value={formatToTwoDecimals(financialCalcs.scValue)} />
                                <BillRow label="CURRENT YEAR TOTAL" value={formatToTwoDecimals(financialCalcs.totalThisYearValue)} isBold />
                                <BillRow label="PREVIOUS BALANCE" value={formatToTwoDecimals(financialCalcs.pbValue)} />
                                <BillRow label="GROSS OUTSTANDING" value={formatToTwoDecimals(financialCalcs.totalBillValue)} isBold />
                                <BillRow label="LESS PAYMENTS" value={formatToTwoDecimals(financialCalcs.tpValue)} />
                            </div>
                            <div className="flex justify-between p-1.5 border-t-2 border-black items-center font-black" style={accentStyle}>
                                <span className="text-[1.05em] uppercase tracking-tighter">TOTAL PAYABLE</span>
                                <span className="text-right" style={{ fontSize: `${finalFontSize * 1.25}px` }}>GH&#8373; {totalAmountPayable}</span>
                            </div>
                        </div>
                        <div className="w-[35%] flex flex-col text-right font-bold">
                            <div className="p-1 border-b border-black bg-black/5 text-[0.7em] text-center">VALUE BREAKDOWN</div>
                            <div className="flex-1 flex flex-col">
                                <div className="p-1 border-b border-black/10 flex-1 flex items-center justify-end font-mono">{formatToTwoDecimals(financialCalcs.chargedValue)}</div>
                                <div className="p-1 border-b border-black/10 flex-1 flex items-center justify-end font-mono">{formatToTwoDecimals(financialCalcs.scValue)}</div>
                                <div className="p-1 border-b border-black/10 flex-1 flex items-center justify-end font-mono">{formatToTwoDecimals(financialCalcs.totalThisYearValue)}</div>
                                <div className="p-1 border-b border-black/10 flex-1 flex items-center justify-end font-mono">{formatToTwoDecimals(financialCalcs.pbValue)}</div>
                                <div className="p-1 border-b border-black/10 flex-1 flex items-center justify-end font-mono">{formatToTwoDecimals(financialCalcs.totalBillValue)}</div>
                                <div className="p-1 border-b border-black/10 flex-1 flex items-center justify-end font-mono">{formatToTwoDecimals(financialCalcs.tpValue)}</div>
                                <div className="p-1.5 border-t-2 border-black flex-1 flex items-center justify-end font-mono text-[1.2em]" style={accentStyle}>{totalAmountPayable}</div>
                            </div>
                        </div>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col flex-1">
                    <div className="grid grid-cols-2 border-b-2 border-black">
                        <div className="p-1 border-r border-black/10"><span className="font-bold text-[0.75em] block text-muted-foreground">NAME/BUSINESS</span><span className="font-bold">{billedToName}</span></div>
                        <div className="p-1"><span className="font-bold text-[0.75em] block text-muted-foreground">ID / SN</span><span className="font-mono font-bold">{formatValue('S/N') || formatValue('Property No')}</span></div>
                    </div>
                    <div className="flex-1">
                        {billType === 'bop' ? (
                            <>
                                <BillRow label="PERMIT FEE (LICENSE)" value={formatToTwoDecimals(financialCalcs.pfValue)} />
                                <BillRow label="ARREARS BF" value={formatToTwoDecimals(getNumericValue('Arrears'))} />
                                <BillRow label="TOTAL DUE" value={formatToTwoDecimals(financialCalcs.bopTotalDueValue)} isBold />
                                <BillRow label="LESS PAYMENT" value={formatToTwoDecimals(getNumericValue('Payment'))} />
                            </>
                        ) : (
                            <>
                                <BillRow label="PROPERTY RATE" value={formatToTwoDecimals(financialCalcs.lfValue)} />
                                <BillRow label="BOP COMPONENT" value={formatToTwoDecimals(financialCalcs.licenseBopValue)} />
                                <BillRow label="ARREARS BF" value={formatToTwoDecimals(getNumericValue('Arrears'))} />
                                <BillRow label="TOTAL DUE" value={formatToTwoDecimals(financialCalcs.licenseTotalDueValue)} isBold />
                                <BillRow label="LESS PAYMENT" value={formatToTwoDecimals(getNumericValue('Payment'))} />
                            </>
                        )}
                    </div>
                    <div className="flex justify-between p-2 border-t-2 border-black items-center font-black" style={accentStyle}>
                        <span className="text-[1.1em] uppercase tracking-widest">TOTAL AMOUNT PAYABLE</span>
                        <span className="text-right" style={{ fontSize: `${finalFontSize * 1.4}px` }}>GH&#8373; {totalAmountPayable}</span>
                    </div>
                  </div>
                )}
            </main>
            
            <footer className="mt-2 pt-1 flex flex-col gap-2">
                <div className="flex items-end justify-between gap-4">
                    <div className="flex-1 flex flex-col items-start">
                        <span className="text-[0.6em] font-bold text-muted-foreground tracking-tighter uppercase mb-0.5">Secure Transaction Identifier</span>
                        {barcodeValue && <BarcodeComponent value={barcodeValue} isCompact={isCompact} />}
                        <span className="text-[0.55em] font-mono opacity-50">{barcodeValue}</span>
                    </div>
                    <div className="w-[180px] text-center">
                        <div className="mx-auto flex items-center justify-center h-10">
                            {settings.appearance?.signature && (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={settings.appearance.signature} alt="Signature" className="max-h-full max-w-full object-contain" />
                            )}
                        </div>
                        <p className="border-t border-black font-bold uppercase text-[0.7em] pt-0.5">COORDINATING DIRECTOR</p>
                    </div>
                </div>
                <div className={cn("font-black text-center p-1.5 border-2 border-black tracking-tighter uppercase leading-tight", isDemandNotice ? "bg-red-600 text-white border-red-700" : "bg-black text-white")} style={{ fontSize: `${finalFontSize * 0.95}px` }}>
                    {isDemandNotice 
                      ? 'FINAL WARNING: LEGAL ACTION WILL BE TAKEN IF NOT PAID WITHIN 14 DAYS.'
                      : (settings.appearance?.billWarningText || 'PAY AT ONCE OR FACE LEGAL ACTION')}
                </div>
            </footer>
          </div>
        </div>
      </div>
    );
  }
);
PrintableContentBase.displayName = 'PrintableContentBase';

export const PrintableContent = memo(PrintableContentBase);

export function BillDialog({ bill, isOpen, onOpenChange }: BillDialogProps) {
  const [settings, setSettings] = useState<{general?: GeneralSettings, appearance?: AppearanceSettings}>({});
  const componentRef = useRef<HTMLDivElement>(null);
  const [isDemandNotice, setIsDemandNotice] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSettings({
          general: store.settings.generalSettings || {},
          appearance: store.settings.appearanceSettings || {},
      });
      setIsDemandNotice(false);
    }
  }, [isOpen]);

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
  });

  if (!bill || !isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[950px] p-0 overflow-hidden border-0">
        <div className="flex h-[90vh]">
          <div className="w-[280px] border-r bg-muted/30 p-6 space-y-6">
            <h3 className="text-lg font-bold flex items-center gap-2 font-headline">
                <FileWarning className="h-5 w-5 text-primary" />
                Bill Designer
            </h3>
            <div className="space-y-4">
               <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg bg-background">
                  <div className="flex flex-col space-y-0.5">
                    <Label htmlFor="demand-notice-toggle">Demand Notice</Label>
                    <span className="text-[10px] text-muted-foreground uppercase font-bold">Enforcement mode</span>
                  </div>
                  <Switch 
                    id="demand-notice-toggle" 
                    checked={isDemandNotice} 
                    onCheckedChange={setIsDemandNotice} 
                  />
               </div>
            </div>
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/10">
                <p className="text-xs text-muted-foreground italic">Printing will automatically record these bills in the transaction history.</p>
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto bg-slate-900/10 p-4 md:p-8">
                 {!settings.general ? (
                    <div className="flex flex-col items-center justify-center h-[297mm] bg-white rounded-lg shadow-xl">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <p className="mt-4 font-medium">Preparing High-Res Preview...</p>
                    </div>
                 ) : (
                    <div className="w-[210mm] min-h-[297mm] mx-auto bg-white shadow-2xl overflow-hidden">
                        <PrintableContent 
                            ref={componentRef} 
                            data={bill.propertySnapshot} 
                            billType={bill.billType} 
                            settings={settings}
                            isDemandNotice={isDemandNotice}
                        />
                    </div>
                 )}
            </div>
            <DialogFooter className="p-4 bg-white sm:justify-end border-t gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handlePrint} className={cn("shadow-lg px-8", isDemandNotice ? "bg-red-600 hover:bg-red-700" : "")}>
                <Printer className="mr-2 h-4 w-4" />
                Print {isDemandNotice ? 'Demand Notice' : 'Official Bill'}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
