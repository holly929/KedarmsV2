
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
                    width: isCompact ? 1.2 : 1.5,
                    height: isCompact ? 30 : 40,
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
  <div className={cn("flex justify-between p-1 border-b border-black items-center", isBold ? 'font-bold' : '')} style={style}>
    <span>{label}</span>
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
        lineHeight: `${finalFontSize * 1.3}px`,
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
        const identificationFields = ['sn', 'serialnumber', 'hotel', 'hotelname', 'ownername', 'propertyno', 'businessname', 'nameofhotelguesthouse'];
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
        return <div className="flex"><div className="w-1/3 font-bold border-b border-black p-1">{label}</div><div className="w-2/3 border-b border-l border-black p-1">{formatValue(valueKey)}</div></div>;
    };

    const DetailRowRight = ({ label, valueKey }: { label: string; valueKey: string; }) => {
        if (!shouldDisplay(valueKey)) return <div className="flex"><div className="w-1/2 font-bold border-b border-black p-1 min-h-[1.5em]"></div><div className="w-1/2 border-b border-l border-black p-1"></div></div>;
        return <div className="flex"><div className="w-1/2 font-bold border-b border-black p-1">{label}</div><div className="w-1/2 border-b border-l border-black p-1">{formatValue(valueKey)}</div></div>;
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
        return String(getPropertyValue(data as any, 'Name of Hotel/Guest House') || getPropertyValue(data as any, 'Owner Name') || getPropertyValue(data as any, 'Business Name') || '...').toUpperCase();
    }, [data]);

    const barcodeValue = useMemo(() => {
        if (!data) return '';
        const id = String(getPropertyValue(data as any, 'Property No') || getPropertyValue(data as any, 'S/N') || data.id);
        const nameStr = String(billedToName).substring(0, 20);
        return `${id}|${nameStr}|${totalAmountPayable}|${new Date().getFullYear()}`;
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
                    <div className="font-bold text-center p-1">AMOUNT (GH&#8373;)</div>
                </div>
            </div>
            <div className="flex">
                <div className="w-[67%] border-r-2 border-black">
                    <div className="flex border-b-2 border-black">
                        <div className="w-1/3 font-bold flex items-center justify-center p-1 text-center">BILLING DETAILS</div>
                        <div className="w-1/3 border-x border-black p-1">
                            <div className="font-bold">RATEABLE VALUE</div>
                            <div className="flex justify-between items-end"><span>GH&#8373;</span><span>{formatToTwoDecimals(rv)}</span></div>
                        </div>
                        <div className="w-1/3 p-1">
                            <div className="font-bold">RATE IMPOST</div>
                            <div className="flex justify-end items-end h-full"><span>{formatValue('Rate Impost')}</span></div>
                        </div>
                    </div>
                    <BillRow label="AMOUNT CHARGED (Rateable Value * Rate Impost)" value={formatToTwoDecimals(charged)} />
                    <BillRow label="SANITATION CHARGED" value={formatToTwoDecimals(sc)} />
                    <BillRow label="UNASSESSED RATE" value="..." />
                    <BillRow label="TOTAL THIS YEAR" value={formatToTwoDecimals(totalThisYear)} isBold />
                    <BillRow label="PREVIOUS BALANCE" value={formatToTwoDecimals(pb)} />
                    <BillRow label="TOTAL BILL" value={formatToTwoDecimals(totalBill)} isBold />
                    <BillRow label="TOTAL PAYMENT" value={formatToTwoDecimals(tp)} />
                    <div className="flex justify-between p-1 border-b border-black items-center font-bold" style={accentStyle}>
                        <span>TOTAL AMOUNT PAYABLE</span>
                        <span className="text-right" style={{ fontSize: `${finalFontSize * 1.2}px` }}>{totalAmountPayable}</span>
                    </div>
                </div>
                <div className="w-[33%] text-right font-bold">
                    <div className="p-1 border-b-2 border-black flex items-end justify-end">FINANCIAL DETAILS</div>
                    <div className="p-1 border-b border-black">{formatToTwoDecimals(charged)}</div>
                    <div className="p-1 border-b border-black">{formatToTwoDecimals(sc)}</div>
                    <div className="p-1 border-b border-black">...</div>
                    <div className="p-1 border-b border-black">{formatToTwoDecimals(totalThisYear)}</div>
                    <div className="p-1 border-b border-black">{formatToTwoDecimals(pb)}</div>
                    <div className="p-1 border-b border-black">{formatToTwoDecimals(totalBill)}</div>
                    <div className="p-1 border-b border-black">{formatToTwoDecimals(tp)}</div>
                    <div className="p-1 border-b border-black flex items-center justify-end" style={accentStyle}>
                        <span style={{ fontSize: `${finalFontSize * 1.2}px` }}>{totalAmountPayable}</span>
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
                    <div className="font-bold text-center p-1">AMOUNT (GH&#8373;)</div>
                </div>
            </div>
            <div className="flex">
                <div className="w-[67%] border-r-2 border-black">
                    <div className="font-bold text-center p-1 border-b-2 border-black">BILLING DETAILS</div>
                    <BillRow label="PERMIT FEE (LICENSE)" value={formatToTwoDecimals(pf)} />
                    <BillRow label="ARREARS" value={formatToTwoDecimals(arr)} />
                    <BillRow label="AMOUNT DUE" value={formatToTwoDecimals(totalDue)} isBold />
                    <BillRow label="PAYMENT" value={formatToTwoDecimals(pay)} />
                    <div className="flex justify-between p-1 border-b border-black items-center font-bold" style={accentStyle}>
                        <span>TOTAL AMOUNT PAYABLE</span>
                        <span className="text-right" style={{ fontSize: `${finalFontSize * 1.2}px` }}>{totalAmountPayable}</span>
                    </div>
                </div>
                <div className="w-[33%] text-right font-bold">
                    <div className="p-1 border-b-2 border-black flex items-end justify-end">FINANCIAL DETAILS</div>
                    <div className="p-1 border-b border-black">{formatToTwoDecimals(pf)}</div>
                    <div className="p-1 border-b border-black">{formatToTwoDecimals(arr)}</div>
                    <div className="p-1 border-b border-black">{formatToTwoDecimals(totalDue)}</div>
                    <div className="p-1 border-b border-black">{formatToTwoDecimals(pay)}</div>
                    <div className="p-1 border-b border-black flex items-center justify-end" style={accentStyle}>
                        <span style={{ fontSize: `${finalFontSize * 1.2}px` }}>{totalAmountPayable}</span>
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
                    <DetailRow label="S/N" valueKey="S/N" />
                    <DetailRow label="HOTEL/GUEST HOUSE" valueKey="Name of Hotel/Guest House" />
                    <DetailRow label="PHONE NUMBER" valueKey="Phone Number" />
                </div>
                <div className="w-[33%]">
                    <div className="font-bold text-center p-1">AMOUNT (GH&#8373;)</div>
                </div>
            </div>
            <div className="flex">
                <div className="w-[67%] border-r-2 border-black">
                    <div className="font-bold text-center p-1 border-b-2 border-black">BILLING DETAILS</div>
                    <BillRow label="PROPERTY RATE" value={formatToTwoDecimals(lf)} />
                    <BillRow label="BOP AMOUNT" value={formatToTwoDecimals(bop)} />
                    <BillRow label="ARREARS" value={formatToTwoDecimals(arr)} />
                    <BillRow label="AMOUNT DUE" value={formatToTwoDecimals(totalDue)} isBold />
                    <BillRow label="PAYMENT" value={formatToTwoDecimals(pay)} />
                    <div className="flex justify-between p-1 border-b border-black items-center font-bold" style={accentStyle}>
                        <span>TOTAL AMOUNT PAYABLE</span>
                        <span className="text-right" style={{ fontSize: `${finalFontSize * 1.2}px` }}>{totalAmountPayable}</span>
                    </div>
                </div>
                <div className="w-[33%] text-right font-bold">
                    <div className="p-1 border-b-2 border-black flex items-end justify-end">FINANCIAL DETAILS</div>
                    <div className="p-1 border-b border-black">{formatToTwoDecimals(lf)}</div>
                    <div className="p-1 border-b border-black">{formatToTwoDecimals(bop)}</div>
                    <div className="p-1 border-b border-black">{formatToTwoDecimals(arr)}</div>
                    <div className="p-1 border-b border-black">{formatToTwoDecimals(totalDue)}</div>
                    <div className="p-1 border-b border-black">{formatToTwoDecimals(pay)}</div>
                    <div className="p-1 border-b border-black flex items-center justify-end" style={accentStyle}>
                        <span style={{ fontSize: `${finalFontSize * 1.2}px` }}>{totalAmountPayable}</span>
                    </div>
                </div>
            </div>
        </>
      )
    }

    if (!data) return <div ref={ref}>Loading Data...</div>;

    const assemblyName = settings.general?.assemblyName || 'KWAHU EAST DISTRICT ASSEMBLY';
    const postalAddress = settings.general?.postalAddress || 'P.O. Box 11, ABETIFI';
    const contactPhone = settings.general?.contactPhone || '0242122039/0244971784';

    return (
      <div ref={ref} className={cn("text-black bg-white w-full h-full box-border", fontClass, isCompact ? 'p-1' : 'p-2')} style={baseStyle}>
        <div className="border-[3px] border-black p-1 relative h-full flex flex-col">
          <div className="absolute inset-0 z-0 flex items-center justify-center opacity-20 pointer-events-none">
              {settings.appearance?.ghanaLogo && (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={settings.appearance.ghanaLogo} alt="Watermark" width={400} height={400} style={{objectFit: 'contain'}} />
              )}
          </div>
          <div className="relative z-10 flex flex-col flex-grow">
            <header className="flex justify-between items-start mb-2">
                <div className="w-1/4 flex justify-start items-center pt-2">
                    {settings.appearance?.ghanaLogo && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={settings.appearance.ghanaLogo} alt="Ghana Coat of Arms" style={{ objectFit: 'contain', width: isCompact ? '60px' : '70px', height: 'auto' }} />
                    )}
                </div>
                <div className="w-1/2 text-center space-y-0.5">
                    <h1 className="font-bold tracking-tight uppercase" style={{ fontSize: `${finalFontSize * 1.6}px` }}>{assemblyName}</h1>
                    <p className="font-medium" style={{ fontSize: `${finalFontSize}px` }}>{postalAddress}</p>
                    <p className="font-medium" style={{ fontSize: `${finalFontSize}px` }}>TEL: {contactPhone}</p>
                    <h2 className="font-extrabold tracking-widest mt-2 border-t border-black pt-1 uppercase" style={{ fontSize: `${finalFontSize * 1.4}px` }}>
                      {billType === 'property' || billType === 'license' ? 'PROPERTY RATE BILL' : 'B.O.P. BILL'}
                    </h2>
                </div>
                <div className="w-1/4 flex justify-end items-center pt-2">
                    {settings.appearance?.assemblyLogo && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={settings.appearance.assemblyLogo} alt="Assembly Logo" style={{ objectFit: 'contain', width: isCompact ? '60px' : '70px', height: 'auto' }} />
                    )}
                </div>
            </header>

            <div className="text-center py-2 mb-2 border-y border-black bg-muted/10">
                <span className="text-xs font-bold block">BILLED TO:</span>
                <span className="text-lg font-extrabold tracking-tight" style={{ fontSize: `${finalFontSize * 1.4}px` }}>{billedToName}</span>
            </div>
            
            <main className="border-t border-b border-black flex-grow">
                {billType === 'property' ? renderPropertyBill() : billType === 'bop' ? renderBopBill() : renderLicenseBill()}
            </main>
            
            <footer className="mt-auto pt-2">
                <div className="flex items-end justify-between gap-2">
                    <div className="flex-1">
                        {barcodeValue && <BarcodeComponent value={barcodeValue} isCompact={isCompact} />}
                    </div>
                    <div className="flex-1 text-center">
                        <div className="mx-auto flex items-center justify-center" style={{ minHeight: isCompact ? '30px' : '40px' }}>
                            {settings.appearance?.signature && (
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img src={settings.appearance.signature} alt="Signature" className="max-h-[64px] max-w-full object-contain" width={128} height={64} />
                            )}
                        </div>
                        <p className="border-t-2 border-black max-w-[12rem] mx-auto mt-1 pt-1 font-bold">COORDINATING DIRECTOR</p>
                    </div>
                </div>
                <div className="font-bold text-center mt-2">
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
      <DialogContent className="sm:max-w-[850px] p-0">
        <div className="max-h-[80vh] overflow-y-auto bg-muted">
          <div className="py-8">
             {isLoading || !settings.general ? (
                <div className="flex items-center justify-center h-[297mm]">
                    <Loader2 className="h-8 w-8 animate-spin" />
                </div>
             ) : (
                <div className="w-[210mm] min-h-[297mm] mx-auto bg-white shadow-lg">
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
        </div>
        <DialogFooter className="p-6 bg-muted sm:justify-end border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          <Button onClick={handlePrint} disabled={isLoading}>
            <Printer className="mr-2 h-4 w-4" />
            Print Bill
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
