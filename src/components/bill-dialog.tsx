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
  <div className={cn("flex justify-between p-1 border-b border-black/30 items-center", isBold ? 'font-bold' : '')} style={style}>
    <span className="text-[0.9em]">{label}</span>
    <span className="text-right">{value}</span>
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
        const baseSize = fontSize || 12;
        return isCompact ? Math.max(8, baseSize - 2) : baseSize;
    }, [fontSize, isCompact]);

    const baseStyle = useMemo(() => ({
        fontSize: `${finalFontSize}px`,
        lineHeight: `${finalFontSize * 1.35}px`,
        // Critical optimization for large batches
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
      <div ref={ref} className={cn("text-black bg-white w-full h-full box-border", fontClass, isCompact ? 'p-2' : 'p-4')} style={baseStyle}>
        <div className="border-[4px] border-double border-black p-2 relative h-full flex flex-col shadow-inner">
          <div className="absolute inset-0 z-0 flex items-center justify-center opacity-[0.06] pointer-events-none">
              {settings.appearance?.ghanaLogo && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={settings.appearance.ghanaLogo} alt="Watermark" width={380} height={380} style={{objectFit: 'contain'}} />
              )}
          </div>
          <div className="relative z-10 flex flex-col flex-grow">
            <header className="flex justify-between items-start mb-4 border-b-2 border-black pb-2 text-center">
                <div className="w-[85px] flex justify-start items-center">
                    {settings.appearance?.ghanaLogo && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={settings.appearance.ghanaLogo} alt="Ghana" className="object-contain h-auto" style={{ width: isCompact ? '60px' : '85px' }} />
                    )}
                </div>
                <div className="flex-1 px-2">
                    <h1 className="font-extrabold tracking-tight uppercase leading-none mb-1" style={{ fontSize: `${finalFontSize * 1.8}px` }}>{settings.general?.assemblyName || 'THE DISTRICT ASSEMBLY'}</h1>
                    <p className="text-[10px] font-black uppercase mb-1 tracking-tight border-b-2 border-black inline-block px-2">LOCAL GOVERNANCE ACT, 2016 (ACT 936)</p>
                    <p className="font-semibold text-muted-foreground leading-tight" style={{ fontSize: `${finalFontSize * 1.1}px` }}>{settings.general?.postalAddress || 'P.O. Box'}</p>
                    <p className="font-semibold text-muted-foreground" style={{ fontSize: `${finalFontSize}px` }}>TEL: {settings.general?.contactPhone}</p>
                    
                    <div className={cn("mt-2 inline-block px-4 py-1 border-2 border-black font-black tracking-[0.2em] uppercase", isDemandNotice ? "bg-red-600 text-white border-red-700" : "bg-black text-white")} style={{ fontSize: `${finalFontSize * 1.4}px` }}>
                      {isDemandNotice 
                        ? (settings.appearance?.demandNoticeCaption || 'DEMAND NOTICE') 
                        : 'PROPERTY RATE & B.O.P BILL'}
                    </div>
                </div>
                <div className="w-[85px] flex justify-end items-center">
                    {settings.appearance?.assemblyLogo && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={settings.appearance.assemblyLogo} alt="Logo" className="object-contain h-auto" style={{ width: isCompact ? '60px' : '85px' }} />
                    )}
                </div>
            </header>

            <div className="text-center py-2 mb-4 border border-black bg-black/[0.02]">
                <span className="text-[0.65em] font-black block text-muted-foreground tracking-widest uppercase mb-1">BILLED TO:</span>
                <span className="font-black tracking-tight leading-none" style={{ fontSize: `${finalFontSize * 1.6}px` }}>{billedToName}</span>
                {suburbHeaderDisplay && (
                  <span className="text-[1.2em] font-black block mt-1 tracking-wider text-black border-t border-black/10 pt-1 uppercase">SUBURB: {suburbHeaderDisplay}</span>
                )}
            </div>
            
            <main className="border-2 border-black flex-grow">
                {billType === 'property' ? (
                  <>
                    <div className="flex border-b-2 border-black">
                        <div className="w-[67%] border-r-2 border-black">
                            <div className="flex border-b border-black/20"><div className="w-1/3 font-bold p-1 bg-black/[0.02]">OWNER NAME</div><div className="w-2/3 border-l border-black/20 p-1 font-bold">{formatValue('Owner Name')}</div></div>
                            <div className="flex border-b border-black/20"><div className="w-1/3 font-bold p-1 bg-black/[0.02]">PHONE</div><div className="w-2/3 border-l border-black/20 p-1">{formatValue('Phone Number')}</div></div>
                            <div className="flex border-b border-black/20"><div className="w-1/3 font-bold p-1 bg-black/[0.02]">TOWN</div><div className="w-2/3 border-l border-black/20 p-1">{formatValue('Town')}</div></div>
                            <div className="flex border-b border-black/20"><div className="w-1/3 font-bold p-1 bg-black/[0.02]">SUBURB</div><div className="w-2/3 border-l border-black/20 p-1 font-bold">{formatValue('Suburb')}</div></div>
                            <div className="flex border-b border-black/20"><div className="w-1/3 font-bold p-1 bg-black/[0.02]">PROPERTY NO</div><div className="w-2/3 border-l border-black/20 p-1 font-mono">{formatValue('Property No')}</div></div>
                        </div>
                        <div className="w-[33%]">
                            <div className="flex border-b border-black/20"><div className="w-1/2 font-bold p-1 bg-black/[0.02]">TYPE</div><div className="w-1/2 border-l border-black/20 p-1">{formatValue('Property Type')}</div></div>
                            <div className="font-bold text-center p-1 bg-black/5 border-b border-black/20 text-[0.8em]">AMOUNT (GH&#8373;)</div>
                        </div>
                    </div>
                    <div className="flex">
                        <div className="w-[67%] border-r-2 border-black">
                            <div className="flex border-b-2 border-black bg-black/[0.01]">
                                <div className="w-1/3 font-bold flex items-center justify-center p-1 text-center text-[0.8em]">PARTICULARS</div>
                                <div className="w-1/3 border-x border-black/20 p-1 text-center font-bold text-[0.8em]">RV: {formatToTwoDecimals(financialCalcs.rvValue)}</div>
                                <div className="w-1/3 p-1 text-center font-bold text-[0.8em]">IMPOST: {formatValue('Rate Impost')}</div>
                            </div>
                            <BillRow label="AMOUNT CHARGED" value={formatToTwoDecimals(financialCalcs.chargedValue)} />
                            <BillRow label="SANITATION" value={formatToTwoDecimals(financialCalcs.scValue)} />
                            <BillRow label="TOTAL CURRENT YEAR" value={formatToTwoDecimals(financialCalcs.totalThisYearValue)} isBold />
                            <BillRow label="PREVIOUS BALANCE" value={formatToTwoDecimals(financialCalcs.pbValue)} />
                            <BillRow label="TOTAL OUTSTANDING" value={formatToTwoDecimals(financialCalcs.totalBillValue)} isBold />
                            <BillRow label="LESS PAYMENT" value={formatToTwoDecimals(financialCalcs.tpValue)} />
                            <div className="flex justify-between p-2 border-b border-black items-center font-bold" style={accentStyle}>
                                <span className="text-[1.1em]">TOTAL PAYABLE</span>
                                <span className="text-right" style={{ fontSize: `${finalFontSize * 1.3}px` }}>GH&#8373; {totalAmountPayable}</span>
                            </div>
                        </div>
                        <div className="w-[33%] text-right font-bold flex flex-col">
                            <div className="p-1 border-b-2 border-black bg-black/5 text-[0.8em] flex items-center justify-center">FINANCIALS</div>
                            <div className="p-1 border-b border-black/20 flex-1 flex items-center justify-end">{formatToTwoDecimals(financialCalcs.chargedValue)}</div>
                            <div className="p-1 border-b border-black/20 flex-1 flex items-center justify-end">{formatToTwoDecimals(financialCalcs.scValue)}</div>
                            <div className="p-1 border-b border-black/20 flex-1 flex items-center justify-end">{formatToTwoDecimals(financialCalcs.totalThisYearValue)}</div>
                            <div className="p-1 border-b border-black/20 flex-1 flex items-center justify-end">{formatToTwoDecimals(financialCalcs.pbValue)}</div>
                            <div className="p-1 border-b border-black/20 flex-1 flex items-center justify-end">{formatToTwoDecimals(financialCalcs.totalBillValue)}</div>
                            <div className="p-1 border-b border-black/20 flex-1 flex items-center justify-end">{formatToTwoDecimals(financialCalcs.tpValue)}</div>
                            <div className="p-2 border-b border-black flex items-center justify-end" style={accentStyle}>{totalAmountPayable}</div>
                        </div>
                    </div>
                  </>
                ) : billType === 'bop' ? (
                  <>
                    <div className="flex border-b-2 border-black">
                        <div className="w-[67%] border-r-2 border-black">
                            <div className="flex border-b border-black/20"><div className="w-1/3 font-bold p-1 bg-black/[0.02]">BUSINESS</div><div className="w-2/3 border-l border-black/20 p-1 font-bold">{formatValue('Business Name')}</div></div>
                            <div className="flex border-b border-black/20"><div className="w-1/3 font-bold p-1 bg-black/[0.02]">OWNER</div><div className="w-2/3 border-l border-black/20 p-1 font-bold">{formatValue('Owner Name')}</div></div>
                        </div>
                        <div className="w-[33%]">
                            <div className="font-bold text-center p-1 bg-black/5 border-b border-black/20 text-[0.8em]">AMOUNT (GH&#8373;)</div>
                        </div>
                    </div>
                    <div className="flex">
                        <div className="w-[67%] border-r-2 border-black">
                            <BillRow label="PERMIT FEE" value={formatToTwoDecimals(financialCalcs.pfValue)} />
                            <BillRow label="ARREARS" value={formatToTwoDecimals(getNumericValue('Arrears'))} />
                            <BillRow label="TOTAL DUE" value={formatToTwoDecimals(financialCalcs.bopTotalDueValue)} isBold />
                            <BillRow label="LESS PAYMENT" value={formatToTwoDecimals(getNumericValue('Payment'))} />
                            <div className="flex justify-between p-2 border-b border-black items-center font-bold" style={accentStyle}>
                                <span className="text-[1.1em]">TOTAL PAYABLE</span>
                                <span className="text-right" style={{ fontSize: `${finalFontSize * 1.3}px` }}>GH&#8373; {totalAmountPayable}</span>
                            </div>
                        </div>
                        <div className="w-[33%] text-right font-bold flex flex-col">
                            <div className="p-1 border-b-2 border-black bg-black/5 text-[0.8em] flex items-center justify-center">FINANCIALS</div>
                            <div className="p-1 border-b border-black/20 flex-1 flex items-center justify-end">{formatToTwoDecimals(financialCalcs.pfValue)}</div>
                            <div className="p-1 border-b border-black/20 flex-1 flex items-center justify-end">{formatToTwoDecimals(getNumericValue('Arrears'))}</div>
                            <div className="p-1 border-b border-black/20 flex-1 flex items-center justify-end">{formatToTwoDecimals(financialCalcs.bopTotalDueValue)}</div>
                            <div className="p-1 border-b border-black/20 flex-1 flex items-center justify-end">{formatToTwoDecimals(getNumericValue('Payment'))}</div>
                            <div className="p-2 border-b border-black flex items-center justify-end" style={accentStyle}>{totalAmountPayable}</div>
                        </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex border-b-2 border-black">
                        <div className="w-[67%] border-r-2 border-black">
                            <div className="flex border-b border-black/20"><div className="w-1/3 font-bold p-1 bg-black/[0.02]">SN</div><div className="w-2/3 border-l border-black/20 p-1 font-mono">{formatValue('S/N')}</div></div>
                            <div className="flex border-b border-black/20"><div className="w-1/3 font-bold p-1 bg-black/[0.02]">HOTEL</div><div className="w-2/3 border-l border-black/20 p-1 font-bold">{formatValue('Name of Hotel/Guest House')}</div></div>
                            <div className="flex border-b border-black/20"><div className="w-1/3 font-bold p-1 bg-black/[0.02]">OWNER</div><div className="w-2/3 border-l border-black/20 p-1">{formatValue('Owner Name')}</div></div>
                        </div>
                        <div className="w-[33%]">
                            <div className="font-bold text-center p-1 bg-black/5 border-b border-black/20 text-[0.8em]">AMOUNT (GH&#8373;)</div>
                        </div>
                    </div>
                    <div className="flex">
                        <div className="w-[67%] border-r-2 border-black">
                            <BillRow label="LICENSE FEE" value={formatToTwoDecimals(financialCalcs.lfValue)} />
                            <BillRow label="BOP FEE" value={formatToTwoDecimals(financialCalcs.licenseBopValue)} />
                            <BillRow label="ARREARS" value={formatToTwoDecimals(getNumericValue('Arrears'))} />
                            <BillRow label="TOTAL DUE" value={formatToTwoDecimals(financialCalcs.licenseTotalDueValue)} isBold />
                            <BillRow label="LESS PAYMENT" value={formatToTwoDecimals(getNumericValue('Payment'))} />
                            <div className="flex justify-between p-2 border-b border-black items-center font-bold" style={accentStyle}>
                                <span className="text-[1.1em]">TOTAL PAYABLE</span>
                                <span className="text-right" style={{ fontSize: `${finalFontSize * 1.3}px` }}>GH&#8373; {totalAmountPayable}</span>
                            </div>
                        </div>
                        <div className="w-[33%] text-right font-bold flex flex-col">
                            <div className="p-1 border-b-2 border-black bg-black/5 text-[0.8em] flex items-center justify-center">FINANCIALS</div>
                            <div className="p-1 border-b border-black/20 flex-1 flex items-center justify-end">{formatToTwoDecimals(financialCalcs.lfValue)}</div>
                            <div className="p-1 border-b border-black/20 flex-1 flex items-center justify-end">{formatToTwoDecimals(financialCalcs.licenseBopValue)}</div>
                            <div className="p-1 border-b border-black/20 flex-1 flex items-center justify-end">{formatToTwoDecimals(getNumericValue('Arrears'))}</div>
                            <div className="p-1 border-b border-black/20 flex-1 flex items-center justify-end">{formatToTwoDecimals(financialCalcs.licenseTotalDueValue)}</div>
                            <div className="p-1 border-b border-black/20 flex-1 flex items-center justify-end">{formatToTwoDecimals(getNumericValue('Payment'))}</div>
                            <div className="p-2 border-b border-black flex items-center justify-end" style={accentStyle}>{totalAmountPayable}</div>
                        </div>
                    </div>
                  </>
                )}
            </main>
            
            <footer className="mt-auto pt-4 flex flex-col gap-4">
                <div className="flex items-end justify-between gap-8">
                    <div className="flex-1 flex flex-col items-start gap-1">
                        <span className="text-[0.6em] font-bold text-muted-foreground tracking-tighter">SDI (SECURE IDENTIFIER)</span>
                        {barcodeValue && <BarcodeComponent value={barcodeValue} isCompact={isCompact} />}
                    </div>
                    <div className="w-1/3 text-center">
                        <div className="mx-auto flex items-center justify-center" style={{ minHeight: isCompact ? '35px' : '50px' }}>
                            {settings.appearance?.signature && (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={settings.appearance.signature} alt="Signature" className="max-h-[65px] max-w-full object-contain" />
                            )}
                        </div>
                        <p className="border-t-2 border-black font-black uppercase text-[0.75em] pt-1 leading-none">COORDINATING DIRECTOR</p>
                    </div>
                </div>
                <div className={cn("font-black text-center p-2 border-2 border-black tracking-[0.1em] text-[1.1em]", isDemandNotice ? "bg-red-600 text-white border-red-700" : "bg-black text-white")}>
                    {isDemandNotice 
                      ? 'LEGAL ACTION WILL BE TAKEN IF NOT PAID WITHIN 14 DAYS.'
                      : (settings.appearance?.billWarningText || 'PAY AT ONCE OR FACE LEGAL ACTION')
                    }
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
          <div className="w-[300px] border-r bg-muted/30 p-6 space-y-6">
            <h3 className="text-lg font-bold flex items-center gap-2 font-headline">
                <FileWarning className="h-5 w-5 text-primary" />
                Bill Options
            </h3>
            <div className="space-y-4">
               <div className="flex items-center justify-between space-x-2 border p-3 rounded-lg bg-background">
                  <div className="flex flex-col space-y-1">
                    <Label htmlFor="demand-notice-toggle">Demand Notice</Label>
                    <span className="text-[10px] text-muted-foreground">Legal demand notice mode</span>
                  </div>
                  <Switch 
                    id="demand-notice-toggle" 
                    checked={isDemandNotice} 
                    onCheckedChange={setIsDemandNotice} 
                  />
               </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col">
            <div className="flex-1 overflow-y-auto bg-slate-900/10 p-4 md:p-8">
                 {!settings.general ? (
                    <div className="flex flex-col items-center justify-center h-[297mm] bg-white rounded-lg shadow-xl">
                        <Loader2 className="h-12 w-12 animate-spin text-primary" />
                        <p className="mt-4 font-medium">Preparing Document...</p>
                    </div>
                 ) : (
                    <div className="w-[210mm] min-h-[297mm] mx-auto bg-white shadow-2xl">
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
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              <Button onClick={handlePrint} className={cn("shadow-lg", isDemandNotice ? "bg-red-600 hover:bg-red-700" : "")}>
                <Printer className="mr-2 h-4 w-4" />
                Print {isDemandNotice ? 'Demand Notice' : 'Official Copy'}
              </Button>
            </DialogFooter>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}