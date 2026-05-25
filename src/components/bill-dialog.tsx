
'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useReactToPrint } from 'react-to-print';
import JsBarcode from 'jsbarcode';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Property, Bop, License, Bill } from '@/lib/types';
import { Printer, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getPropertyValue } from '@/lib/property-utils';
import { store } from '@/lib/store';

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
  fontFamily?: 'sans' | 'serif' | 'mono';
  fontSize?: number;
  accentColor?: string;
};

const formatToTwoDecimals = (val: any): string => {
    if (val === undefined || val === null || String(val).trim() === '') return '0.00';
    const cleaned = String(val).replace(/,/g, '').replace(/[^0-9.-]/g, '');
    const num = Number(cleaned);
    if (isNaN(num)) return '0.00';
    return num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const BarcodeComponent = ({ value, isCompact }: { value: string; isCompact: boolean }) => {
    const ref = useRef<SVGSVGElement | null>(null);

    useEffect(() => {
        if (ref.current) {
            try {
                JsBarcode(ref.current, value, {
                    width: isCompact ? 1.0 : 1.4,
                    height: isCompact ? 25 : 35,
                    fontSize: isCompact ? 8 : 10,
                    margin: 0,
                    displayValue: false,
                    background: 'transparent'
                });
            } catch (e) {
                console.error('Barcode generation error:', e);
            }
        }
    }, [value, isCompact]);

    return <svg ref={ref} />;
};

const BillRow = ({ label, value, isBold = false, style = {} }: { label: string; value: string | number; isBold?: boolean; style?: React.CSSProperties }) => (
  <div className={cn("flex justify-between p-1 border-b border-black/30 items-center", isBold ? 'font-bold' : '')} style={style}>
    <span className="text-[0.9em]">{label}</span>
    <span className="text-right">{value}</span>
  </div>
);

export const PrintableContent = React.forwardRef<HTMLDivElement, { 
    property?: Property;
    data?: Property | Bop | License;
    billType?: 'property' | 'bop' | 'license';
    settings: { general?: GeneralSettings, appearance?: AppearanceSettings }; 
    isCompact?: boolean; 
    displaySettings?: Record<string, boolean>;
}>(
  ({ property: propertyProp, data: dataProp, billType: billTypeProp, settings, isCompact = false, displaySettings: displaySettingsProp }, ref) => {
    
    const data = dataProp || propertyProp;
    const billType = billTypeProp || 'property';
    
    const [displaySettings, setDisplaySettings] = useState<Record<string, boolean>>({});

    const { fontFamily, fontSize, accentColor } = settings.appearance || {};

    const fontClass = useMemo(() => ({
        sans: 'font-sans',
        serif: 'font-serif',
        mono: 'font-mono'
    }[fontFamily || 'sans']), [fontFamily]);

    const finalFontSize = useMemo(() => {
        const baseSize = fontSize || 12;
        return isCompact ? Math.max(8, baseSize - 2) : baseSize;
    }, [fontSize, isCompact]);

    const baseStyle = useMemo(() => ({
        fontSize: `${finalFontSize}px`,
        lineHeight: `${finalFontSize * 1.35}px`,
    }), [finalFontSize]);

    const accentStyle = useMemo(() => ({
        backgroundColor: accentColor || '#F1F5F9'
    }), [accentColor]);

    useEffect(() => {
        if (displaySettingsProp && Object.keys(displaySettingsProp).length > 0) {
            setDisplaySettings(displaySettingsProp);
        } else if (data) {
            const allFields = Object.keys(data).reduce((acc, key) => {
                acc[key] = true;
                return acc;
            }, {} as Record<string, boolean>);
            setDisplaySettings(allFields);
        }
    }, [data, displaySettingsProp]);
    
    const getNumericValue = useCallback((key: string): number => {
        if (!data) return 0;
        const val = getPropertyValue(data as any, key);
        if (val === undefined || val === null || String(val).trim() === '') return 0;
        const num = Number(String(val).replace(/,/g, '').replace(/[^0-9.-]/g, ''));
        return isNaN(num) ? 0 : num;
    }, [data]);

    const formatValue = useCallback((valueKey: string) => {
        if (!data) return '...';
        const val = getPropertyValue(data as any, valueKey);
        
        if (val === null || val === undefined || String(val).trim() === '') return '...';
        
        const numericKeys = ['License Fee', 'Bop Amount', 'Arrears', 'Payment', 'Rateable Value', 'Rate Impost', 'Total Payment', 'Permit Fee', 'Sanitation Charged', 'Previous Balance', 'Amount Due', 'Property Rate'];
        
        if (numericKeys.some(k => valueKey.toLowerCase().includes(k.toLowerCase())) || !isNaN(Number(String(val).replace(/,/g, '').replace(/[^0-9.-]/g, '')))) {
            const skipKeys = ['Property No', 'Account Number', 'Phone', 'S/N', 'SN'];
            if (skipKeys.some(k => valueKey.includes(k))) return String(val);

            const num = Number(String(val).replace(/,/g, '').replace(/[^0-9.-]/g, ''));
            if (!isNaN(num)) {
                if (valueKey.toLowerCase().includes('impost')) return String(val);
                return formatToTwoDecimals(num);
            }
        }
        
        return String(val);
    }, [data]);
    
    const normalizeKey = (key: string): string => (key || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const shouldDisplay = (field: string) => {
        const normField = normalizeKey(field);
        const identificationFields = [
            'sn', 'serialnumber', 'serialno', 'no', 'hotel', 'hotelname', 'ownername', 
            'propertyno', 'businessname', 'nameofhotelguesthouse', 'establishment', 'entity'
        ];
        if (identificationFields.includes(normField)) return true;
        
        for (const settingKey in displaySettings) {
             if (normalizeKey(settingKey) === normField) {
                return displaySettings[settingKey];
             }
        }
        return true;
    };
    
    const DetailRow = ({ label, valueKey }: { label: string; valueKey: string; }) => {
        if (!shouldDisplay(valueKey)) return null;
        return <div className="flex border-b border-black/20"><div className="w-1/3 font-bold p-1 bg-black/[0.02]">{label}</div><div className="w-2/3 border-l border-black/20 p-1">{formatValue(valueKey)}</div></div>;
    };

    const DetailRowRight = ({ label, valueKey }: { label: string; valueKey: string; }) => {
        if (!shouldDisplay(valueKey)) return <div className="flex border-b border-black/20"><div className="w-1/2 font-bold p-1 min-h-[1.5em] bg-black/[0.02]"></div><div className="w-1/2 border-l border-black/20 p-1"></div></div>;
        return <div className="flex border-b border-black/20"><div className="w-1/2 font-bold p-1 bg-black/[0.02]">{label}</div><div className="w-1/2 border-l border-black/20 p-1">{formatValue(valueKey)}</div></div>;
    };

    const totalAmountPayable = useMemo(() => {
        if (!data) return '0.00';
        const importedTotal = getPropertyValue(data as any, 'Amount Due');
        if (importedTotal !== undefined && importedTotal !== null && String(importedTotal).trim() !== '') {
            return formatToTwoDecimals(importedTotal);
        }

        let calculated = 0;
        if (billType === 'property') {
            const rv = getNumericValue('Rateable Value');
            const ri = getNumericValue('Rate Impost');
            const sc = getNumericValue('Sanitation Charged');
            const pb = getNumericValue('Previous Balance');
            const tp = getNumericValue('Total Payment');
            calculated = (rv * ri) + sc + pb - tp;
        } else if (billType === 'bop') {
            const pf = getNumericValue('Permit Fee');
            const arr = getNumericValue('Arrears');
            const pay = getNumericValue('Payment');
            calculated = (pf + arr) - pay;
        } else {
            const lf = getNumericValue('Property Rate');
            const bop = getNumericValue('Bop Amount');
            const arr = getNumericValue('Arrears');
            const pay = getNumericValue('Payment');
            calculated = (lf + bop + arr) - pay;
        }
        return formatToTwoDecimals(calculated);
    }, [data, billType, getNumericValue]);

    const billedToName = useMemo(() => {
        if (!data) return '';
        const nameVal = getPropertyValue(data as any, 'Name of Hotel/Guest House') || 
                        getPropertyValue(data as any, 'Hotel Name') ||
                        getPropertyValue(data as any, 'Business Name') || 
                        getPropertyValue(data as any, 'Owner Name') || 
                        getPropertyValue(data as any, 'Entity') || '...';
        return String(nameVal).toUpperCase();
    }, [data]);

    const barcodeValue = useMemo(() => {
        if (!data) return '';
        const idStr = String(getPropertyValue(data as any, 'Property No') || getPropertyValue(data as any, 'S/N') || getPropertyValue(data as any, 'SN') || data.id);
        const nameStr = String(billedToName).substring(0, 15);
        const amtStr = totalAmountPayable.replace(/[^0-9.]/g, '');
        return `${idStr}|${amtStr}|${new Date().getFullYear()}`;
    }, [data, totalAmountPayable, billedToName]);

    const renderPropertyBill = () => {
      const rv = getNumericValue('Rateable Value');
      const ri = getNumericValue('Rate Impost');
      const sc = getNumericValue('Sanitation Charged');
      const pb = getNumericValue('Previous Balance');
      const tp = getNumericValue('Total Payment');
      const charged = rv * ri;
      const totalThisYear = charged + sc;
      const totalBill = totalThisYear + pb;

      return (
        <>
            <div className="flex border-b-2 border-black">
                <div className="w-[67%] border-r-2 border-black">
                    <DetailRow label="OWNER NAME" valueKey="Owner Name" />
                    <DetailRow label="PHONE NUMBER" valueKey="Phone Number" />
                    <DetailRow label="TOWN" valueKey="Town" />
                    <DetailRow label="PROPERTY NO:" valueKey="Property No" />
                    <DetailRow label="VALUATION LIST NO.:" valueKey="Valuation List No." />
                </div>
                <div className="w-[33%]">
                    <DetailRowRight label="SUBURB" valueKey="Suburb" />
                    <DetailRowRight label="ACCOUNT NUMBER" valueKey="Account Number" />
                    <DetailRowRight label="PROPERTY TYPE" valueKey="Property Type" />
                    <div className="font-bold text-center p-1 bg-black/5 border-b border-black/20 text-[0.8em]">AMOUNT (GH&#8373;)</div>
                </div>
            </div>
            <div className="flex">
                <div className="w-[67%] border-r-2 border-black">
                    <div className="flex border-b-2 border-black bg-black/[0.01]">
                        <div className="w-1/3 font-bold flex items-center justify-center p-1 text-center text-[0.8em]">BILLING PARTICULARS</div>
                        <div className="w-1/3 border-x border-black/20 p-1">
                            <div className="font-bold text-[0.7em] text-muted-foreground uppercase">RATEABLE VALUE</div>
                            <div className="flex justify-between items-end"><span>GH&#8373;</span><span className="font-bold">{formatToTwoDecimals(rv)}</span></div>
                        </div>
                        <div className="w-1/3 p-1">
                            <div className="font-bold text-[0.7em] text-muted-foreground uppercase">RATE IMPOST</div>
                            <div className="flex justify-end items-end h-full font-bold"><span>{formatValue('Rate Impost')}</span></div>
                        </div>
                    </div>
                    <BillRow label="AMOUNT CHARGED (Value x Impost)" value={formatToTwoDecimals(charged)} />
                    <BillRow label="SANITATION CHARGED" value={formatToTwoDecimals(sc)} />
                    <BillRow label="UNASSESSED RATE" value="..." />
                    <BillRow label="TOTAL FOR CURRENT YEAR" value={formatToTwoDecimals(totalThisYear)} isBold />
                    <BillRow label="ARREARS / PREVIOUS BALANCE" value={formatToTwoDecimals(pb)} />
                    <BillRow label="TOTAL BILL OUTSTANDING" value={formatToTwoDecimals(totalBill)} isBold />
                    <BillRow label="LESS TOTAL PAYMENT MADE" value={formatToTwoDecimals(tp)} />
                    <div className="flex justify-between p-2 border-b border-black items-center font-bold" style={accentStyle}>
                        <span className="text-[1.1em]">TOTAL AMOUNT PAYABLE</span>
                        <span className="text-right" style={{ fontSize: `${finalFontSize * 1.3}px` }}>GH&#8373; {totalAmountPayable}</span>
                    </div>
                </div>
                <div className="w-[33%] text-right font-bold flex flex-col">
                    <div className="p-1 border-b-2 border-black bg-black/5 text-[0.8em] flex items-center justify-center">FINANCIALS (GH&#8373;)</div>
                    <div className="p-1 border-b border-black/20 flex-1 flex items-center justify-end">{formatToTwoDecimals(charged)}</div>
                    <div className="p-1 border-b border-black/20 flex-1 flex items-center justify-end">{formatToTwoDecimals(sc)}</div>
                    <div className="p-1 border-b border-black/20 flex-1 flex items-center justify-end">...</div>
                    <div className="p-1 border-b border-black/20 flex-1 flex items-center justify-end">{formatToTwoDecimals(totalThisYear)}</div>
                    <div className="p-1 border-b border-black/20 flex-1 flex items-center justify-end">{formatToTwoDecimals(pb)}</div>
                    <div className="p-1 border-b border-black/20 flex-1 flex items-center justify-end">{formatToTwoDecimals(totalBill)}</div>
                    <div className="p-1 border-b border-black/20 flex-1 flex items-center justify-end">{formatToTwoDecimals(tp)}</div>
                    <div className="p-2 border-b border-black flex items-center justify-end" style={accentStyle}>
                        <span style={{ fontSize: `${finalFontSize * 1.3}px` }}>{totalAmountPayable}</span>
                    </div>
                </div>
            </div>
        </>
      )
    }

    const renderBopBill = () => {
      const pf = getNumericValue('Permit Fee');
      const arr = getNumericValue('Arrears');
      const pay = getNumericValue('Payment');
      const totalDue = pf + arr;

      return (
        <>
            <div className="flex border-b-2 border-black">
                <div className="w-[67%] border-r-2 border-black">
                    <DetailRow label="BUSINESS NAME" valueKey="Business Name" />
                    <DetailRow label="OWNER NAME" valueKey="Owner Name" />
                    <DetailRow label="PHONE NUMBER" valueKey="Phone Number" />
                    <DetailRow label="TOWN" valueKey="Town" />
                </div>
                <div className="w-[33%]">
                    <div className="font-bold text-center p-1 bg-black/5 border-b border-black/20 text-[0.8em]">AMOUNT (GH&#8373;)</div>
                </div>
            </div>
            <div className="flex">
                <div className="w-[67%] border-r-2 border-black">
                    <div className="font-bold text-center p-1 border-b-2 border-black bg-black/[0.01] text-[0.8em]">BILLING BREAKDOWN</div>
                    <BillRow label="PERMIT FEE (LICENSE)" value={formatToTwoDecimals(pf)} />
                    <BillRow label="ARREARS" value={formatToTwoDecimals(arr)} />
                    <BillRow label="TOTAL AMOUNT DUE" value={formatToTwoDecimals(totalDue)} isBold />
                    <BillRow label="LESS PAYMENT MADE" value={formatToTwoDecimals(pay)} />
                    <div className="flex justify-between p-2 border-b border-black items-center font-bold" style={accentStyle}>
                        <span className="text-[1.1em]">TOTAL AMOUNT PAYABLE</span>
                        <span className="text-right" style={{ fontSize: `${finalFontSize * 1.3}px` }}>GH&#8373; {totalAmountPayable}</span>
                    </div>
                </div>
                <div className="w-[33%] text-right font-bold flex flex-col">
                    <div className="p-1 border-b-2 border-black bg-black/5 text-[0.8em] flex items-center justify-center">FINANCIALS (GH&#8373;)</div>
                    <div className="p-1 border-b border-black/20 flex-1 flex items-center justify-end">{formatToTwoDecimals(pf)}</div>
                    <div className="p-1 border-b border-black/20 flex-1 flex items-center justify-end">{formatToTwoDecimals(arr)}</div>
                    <div className="p-1 border-b border-black/20 flex-1 flex items-center justify-end">{formatToTwoDecimals(totalDue)}</div>
                    <div className="p-1 border-b border-black/20 flex-1 flex items-center justify-end">{formatToTwoDecimals(pay)}</div>
                    <div className="p-2 border-b border-black flex items-center justify-end" style={accentStyle}>
                        <span style={{ fontSize: `${finalFontSize * 1.3}px` }}>{totalAmountPayable}</span>
                    </div>
                </div>
            </div>
        </>
      )
    }

    const renderLicenseBill = () => {
      const lf = getNumericValue('Property Rate');
      const bop = getNumericValue('Bop Amount');
      const arr = getNumericValue('Arrears');
      const pay = getNumericValue('Payment');
      const totalDue = (lf + bop + arr);

      return (
        <>
            <div className="flex border-b-2 border-black">
                <div className="w-[67%] border-r-2 border-black">
                    <DetailRow label="SERIAL NO (S/N)" valueKey="S/N" />
                    <DetailRow label="HOTEL/ESTABLISHMENT" valueKey="Name of Hotel/Guest House" />
                    <DetailRow label="CONTACT NUMBER" valueKey="Phone Number" />
                </div>
                <div className="w-[33%]">
                    <div className="font-bold text-center p-1 bg-black/5 border-b border-black/20 text-[0.8em]">AMOUNT (GH&#8373;)</div>
                </div>
            </div>
            <div className="flex">
                <div className="w-[67%] border-r-2 border-black">
                    <div className="font-bold text-center p-1 border-b-2 border-black bg-black/[0.01] text-[0.8em]">BILLING BREAKDOWN</div>
                    <BillRow label="PROPERTY RATE FEE" value={formatToTwoDecimals(lf)} />
                    <BillRow label="BOP FEE COMPONENT" value={formatToTwoDecimals(bop)} />
                    <BillRow label="ACCUMULATED ARREARS" value={formatToTwoDecimals(arr)} />
                    <BillRow label="TOTAL AMOUNT DUE" value={formatToTwoDecimals(totalDue)} isBold />
                    <BillRow label="LESS PAYMENTS" value={formatToTwoDecimals(pay)} />
                    <div className="flex justify-between p-2 border-b border-black items-center font-bold" style={accentStyle}>
                        <span className="text-[1.1em]">TOTAL AMOUNT PAYABLE</span>
                        <span className="text-right" style={{ fontSize: `${finalFontSize * 1.3}px` }}>GH&#8373; {totalAmountPayable}</span>
                    </div>
                </div>
                <div className="w-[33%] text-right font-bold flex flex-col">
                    <div className="p-1 border-b-2 border-black bg-black/5 text-[0.8em] flex items-center justify-center">FINANCIALS (GH&#8373;)</div>
                    <div className="p-1 border-b border-black/20 flex-1 flex items-center justify-end">{formatToTwoDecimals(lf)}</div>
                    <div className="p-1 border-b border-black/20 flex-1 flex items-center justify-end">{formatToTwoDecimals(bop)}</div>
                    <div className="p-1 border-b border-black/20 flex-1 flex items-center justify-end">{formatToTwoDecimals(arr)}</div>
                    <div className="p-1 border-b border-black/20 flex-1 flex items-center justify-end">{formatToTwoDecimals(totalDue)}</div>
                    <div className="p-1 border-b border-black/20 flex-1 flex items-center justify-end">{formatToTwoDecimals(pay)}</div>
                    <div className="p-2 border-b border-black flex items-center justify-end" style={accentStyle}>
                        <span style={{ fontSize: `${finalFontSize * 1.3}px` }}>{totalAmountPayable}</span>
                    </div>
                </div>
            </div>
        </>
      )
    }

    if (!data) return <div ref={ref} className="p-8 text-center text-muted-foreground">Loading Bill Data...</div>;

    const assemblyName = settings.general?.assemblyName || 'KWAHU EAST DISTRICT ASSEMBLY';
    const postalAddress = settings.general?.postalAddress || 'P.O. Box 11, ABETIFI';
    const contactPhone = settings.general?.contactPhone || '0242122039/0244971784';

    return (
      <div ref={ref} className={cn("text-black bg-white w-full h-full box-border", fontClass, isCompact ? 'p-2' : 'p-4')} style={baseStyle}>
        <div className="border-[4px] border-double border-black p-2 relative h-full flex flex-col shadow-inner">
          <div className="absolute inset-0 z-0 flex items-center justify-center opacity-[0.08] pointer-events-none">
              {settings.appearance?.ghanaLogo && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={settings.appearance.ghanaLogo} alt="Watermark" width={450} height={450} style={{objectFit: 'contain'}} />
              )}
          </div>
          <div className="relative z-10 flex flex-col flex-grow">
            <header className="flex justify-between items-start mb-4 border-b-2 border-black pb-2">
                <div className="w-1/5 flex justify-start items-center">
                    {settings.appearance?.ghanaLogo && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={settings.appearance.ghanaLogo} alt="Ghana Coat of Arms" style={{ objectFit: 'contain', width: isCompact ? '65px' : '85px', height: 'auto' }} />
                    )}
                </div>
                <div className="w-3/5 text-center">
                    <h1 className="font-extrabold tracking-tight uppercase leading-none mb-1" style={{ fontSize: `${finalFontSize * 1.8}px` }}>{assemblyName}</h1>
                    <p className="font-semibold text-muted-foreground" style={{ fontSize: `${finalFontSize * 1.1}px` }}>{postalAddress}</p>
                    <p className="font-semibold text-muted-foreground" style={{ fontSize: `${finalFontSize}px` }}>TEL: {contactPhone}</p>
                    <div className="mt-3 inline-block px-4 py-1 border-2 border-black font-black tracking-[0.2em] uppercase bg-black text-white" style={{ fontSize: `${finalFontSize * 1.2}px` }}>
                      {billType === 'bop' ? 'B.O.P. BILL' : 'PROPERTY RATE BILL'}
                    </div>
                    <div className="mt-1 font-bold text-[0.8em] tracking-wider uppercase">PROPERTY RATE & B.O.P BILL</div>
                </div>
                <div className="w-1/5 flex justify-end items-center">
                    {settings.appearance?.assemblyLogo && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={settings.appearance.assemblyLogo} alt="Assembly Logo" style={{ objectFit: 'contain', width: isCompact ? '65px' : '85px', height: 'auto' }} />
                    )}
                </div>
            </header>

            <div className="text-center py-2 mb-4 border border-black bg-black/[0.03]">
                <span className="text-[0.7em] font-black block text-muted-foreground tracking-widest uppercase mb-1">BILLED TO:</span>
                <span className="font-black tracking-tight" style={{ fontSize: `${finalFontSize * 1.5}px` }}>{billedToName}</span>
            </div>
            
            <main className="border-2 border-black flex-grow">
                {billType === 'property' ? renderPropertyBill() : billType === 'bop' ? renderBopBill() : renderLicenseBill()}
            </main>
            
            <footer className="mt-auto pt-4 flex flex-col gap-4">
                <div className="flex items-end justify-between gap-8">
                    <div className="flex-1 flex flex-col items-start gap-1">
                        <span className="text-[0.6em] font-bold text-muted-foreground tracking-tighter">SECURE DOCUMENT IDENTIFIER (SDI)</span>
                        {barcodeValue && <BarcodeComponent value={barcodeValue} isCompact={isCompact} />}
                    </div>
                    <div className="w-1/3 text-center">
                        <div className="mx-auto flex items-center justify-center" style={{ minHeight: isCompact ? '40px' : '55px' }}>
                            {settings.appearance?.signature && (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={settings.appearance.signature} alt="Signature" className="max-h-[75px] max-w-full object-contain" />
                            )}
                        </div>
                        <p className="border-t-2 border-black font-black uppercase text-[0.8em] pt-1">COORDINATING DIRECTOR</p>
                    </div>
                </div>
                <div className="font-black text-center p-2 border-2 border-black bg-black text-white tracking-[0.1em] text-[1.1em]">
                    {settings.appearance?.billWarningText || 'PAY AT ONCE OR FACE LEGAL ACTION'}
                </div>
            </footer>
          </div>
        </div>
      </div>
    );
  }
);
PrintableContent.displayName = 'PrintableContent';


export function BillDialog({ bill, isOpen, onOpenChange }: BillDialogProps) {
  const [settings, setSettings] = useState<{general?: GeneralSettings, appearance?: AppearanceSettings}>({});
  const componentRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      setSettings({
          general: store.settings.generalSettings || {},
          appearance: store.settings.appearanceSettings || {},
      });
      setIsLoading(false);
    }
  }, [isOpen]);

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
  });

  if (!bill) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] p-0 overflow-hidden border-0">
        <div className="max-h-[85vh] overflow-y-auto bg-slate-900/10 p-4 md:p-8">
             {isLoading || !settings.general ? (
                <div className="flex flex-col items-center justify-center h-[297mm] bg-white rounded-lg shadow-xl">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="mt-4 font-medium">Generating Document...</p>
                </div>
             ) : (
                <div className="w-[210mm] min-h-[297mm] mx-auto bg-white shadow-2xl">
                <PrintableContent 
                    ref={componentRef} 
                    data={bill.propertySnapshot} 
                    billType={bill.billType} 
                    settings={settings}
                    displaySettings={store.settings.billDisplaySettings}
                />
                </div>
             )}
        </div>
        <DialogFooter className="p-4 bg-white sm:justify-end border-t gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close Viewer</Button>
          <Button onClick={handlePrint} disabled={isLoading} className="shadow-lg">
            <Printer className="mr-2 h-4 w-4" />
            Print Official Copy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
