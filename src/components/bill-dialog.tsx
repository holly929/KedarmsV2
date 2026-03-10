
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
import Image from 'next/image';

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

    const { 
        fontFamily, 
        fontSize, 
        accentColor 
    } = settings.appearance || {};

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
        if (displaySettingsProp) {
            setDisplaySettings(displaySettingsProp);
        } else if (data) {
            const allFields = Object.keys(data).reduce((acc, key) => {
                acc[key] = true;
                return acc;
            }, {} as Record<string, boolean>);
            setDisplaySettings(allFields);
        }
    }, [data, displaySettingsProp]);
    
    const getNumber = (key: string): number | null => {
        if (!data) return null;
        const value = getPropertyValue(data as any, key);
        if (value === null || value === undefined || String(value).trim() === '') return null;
        const cleanedValue = String(value).replace(/[^0-9.-]/g, '');
        if (cleanedValue === '') return null;
        const num = Number(cleanedValue);
        return isNaN(num) ? null : num;
    };

    const formatAmount = useCallback((amount: number | null) => (amount != null ? amount.toFixed(2) : '0.00'), []);
    
    const formatValue = useCallback((valueKey: string) => {
        if (!data) return '...';
        const val = getPropertyValue(data as any, valueKey);
        return val != null && val !== '' ? String(val) : '...';
    }, [data]);
    
    const normalizeDisplayKey = (key: string): string => {
        return (key || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    }

    const shouldDisplay = (field: string) => {
        const normalizedSearchKey = normalizeDisplayKey(field);
        for (const settingKey in displaySettings) {
             if (normalizeDisplayKey(settingKey) === normalizedSearchKey) {
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

    // Calculations
    const { totalAmountPayable, barcodeValue } = useMemo(() => {
        let finalAmount = 0;
        let finalBarcode = '';

        if (!data) {
            return { totalAmountPayable: 0, barcodeValue: '' };
        }

        if (billType === 'property') {
            const property = data as Property;
            const rateableValue = getNumber('Rateable Value');
            const rateImpost = getNumber('Rate Impost');
            const sanitationCharged = getNumber('Sanitation Charged');
            const previousBalance = getNumber('Previous Balance');
            const totalPayment = getNumber('Total Payment');
            const amountCharged = (rateableValue != null && rateImpost != null) ? rateableValue * rateImpost : 0;
            const totalThisYear = amountCharged + (sanitationCharged || 0);
            finalAmount = totalThisYear + (previousBalance || 0) - (totalPayment || 0);
            
            const propertyNo = formatValue('Property No');
            const ownerName = (formatValue('Owner Name') || '').substring(0, 20);
            const amount = formatAmount(finalAmount);
            const year = new Date().getFullYear();
            finalBarcode = `${propertyNo}|${ownerName}|${amount}|${year}`;
        } else if (billType === 'bop') {
            const bop = data as Bop;
            const permitFee = getNumber('Permit Fee');
            const arrears = getNumber('Arrears');
            const payment = getNumber('Payment');
            finalAmount = (permitFee || 0) + (arrears || 0) - (payment || 0);

            const businessName = (formatValue('Business Name') || '').substring(0, 20);
            const amount = formatAmount(finalAmount);
            const year = new Date().getFullYear();
            finalBarcode = `${bop.id}|${businessName}|${amount}|${year}`;
        } else { // License
            const license = data as License;
            const propertyRate = getNumber('Property Rate');
            const arrears = getNumber('Arrears');
            const payment = getNumber('Payment');
            finalAmount = (propertyRate || 0) + (arrears || 0) - (payment || 0);

            const hotelName = (formatValue('Name of Hotel/Guest House') || '').substring(0, 20);
            const amount = formatAmount(finalAmount);
            const year = new Date().getFullYear();
            finalBarcode = `${license.id}|${hotelName}|${amount}|${year}`;
        }
        return { totalAmountPayable: finalAmount, barcodeValue: finalBarcode };
    }, [data, billType, formatValue, formatAmount]);


    const renderPropertyBill = () => {
      const rateableValue = getNumber('Rateable Value');
      const rateImpost = getNumber('Rate Impost');
      const sanitationCharged = getNumber('Sanitation Charged');
      const previousBalance = getNumber('Previous Balance');
      const totalPayment = getNumber('Total Payment');
      const amountCharged = (rateableValue != null && rateImpost != null) ? rateableValue * rateImpost : null;
      const totalThisYear = (amountCharged ?? 0) + (sanitationCharged ?? 0);
      const totalBill = totalThisYear + (previousBalance || 0);

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
                            <div className="flex justify-between items-end"><span>GH&#8373;</span><span>{formatAmount(rateableValue)}</span></div>
                        </div>
                        <div className="w-1/3 p-1">
                            <div className="font-bold">RATE IMPOST</div>
                            <div className="flex justify-end items-end h-full"><span>{formatValue('Rate Impost')}</span></div>
                        </div>
                    </div>
                    <BillRow label="AMOUNT CHARGED (Rateable Value * Rate Impost)" value={formatAmount(amountCharged)} />
                    <BillRow label="SANITATION CHARGED" value={formatAmount(sanitationCharged)} />
                    <BillRow label="UNASSESSED RATE" value="..." />
                    <BillRow label="TOTAL THIS YEAR" value={formatAmount(totalThisYear)} isBold />
                    <BillRow label="PREVIOUS BALANCE" value={formatAmount(previousBalance)} />
                    <BillRow label="TOTAL BILL" value={formatAmount(totalBill)} isBold />
                    <BillRow label="TOTAL PAYMENT" value={formatAmount(totalPayment)} />
                    <div className="flex justify-between p-1 border-b border-black items-center font-bold" style={accentStyle}>
                        <span>TOTAL AMOUNT PAYABLE</span>
                        <span className="text-right" style={{ fontSize: `${finalFontSize * 1.2}px` }}>{formatAmount(totalAmountPayable)}</span>
                    </div>
                </div>
                <div className="w-[33%] text-right font-bold">
                    <div className="p-1 border-b-2 border-black flex items-end justify-end">FINANCIAL DETAILS</div>
                    <div className="p-1 border-b border-black">{formatAmount(amountCharged)}</div>
                    <div className="p-1 border-b border-black">{formatAmount(sanitationCharged)}</div>
                    <div className="p-1 border-b border-black">...</div>
                    <div className="p-1 border-b border-black">{formatAmount(totalThisYear)}</div>
                    <div className="p-1 border-b border-black">{formatAmount(previousBalance)}</div>
                    <div className="p-1 border-b border-black">{formatAmount(totalBill)}</div>
                    <div className="p-1 border-b border-black">{formatAmount(totalPayment)}</div>
                    <div className="p-1 border-b border-black flex items-center justify-end" style={accentStyle}>
                        <span style={{ fontSize: `${finalFontSize * 1.2}px` }}>{formatAmount(totalAmountPayable)}</span>
                    </div>
                </div>
            </div>
        </>
      )
    }

    const renderBopBill = () => {
      const permitFee = getNumber('Permit Fee');
      const arrears = getNumber('Arrears');
      const payment = getNumber('Payment');
      const totalAmountDue = (permitFee || 0) + (arrears || 0);

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
                    <BillRow label="PERMIT FEE (LICENSE)" value={formatAmount(permitFee)} />
                    <BillRow label="ARREARS" value={formatAmount(arrears)} />
                    <BillRow label="AMOUNT DUE" value={formatAmount(totalAmountDue)} isBold />
                    <BillRow label="PAYMENT" value={formatAmount(payment)} />
                    <div className="flex justify-between p-1 border-b border-black items-center font-bold" style={accentStyle}>
                        <span>TOTAL AMOUNT PAYABLE</span>
                        <span className="text-right" style={{ fontSize: `${finalFontSize * 1.2}px` }}>{formatAmount(totalAmountPayable)}</span>
                    </div>
                </div>
                <div className="w-[33%] text-right font-bold">
                    <div className="p-1 border-b-2 border-black flex items-end justify-end">FINANCIAL DETAILS</div>
                    <div className="p-1 border-b border-black">{formatAmount(permitFee)}</div>
                    <div className="p-1 border-b border-black">{formatAmount(arrears)}</div>
                    <div className="p-1 border-b border-black">{formatAmount(totalAmountDue)}</div>
                    <div className="p-1 border-b border-black">{formatAmount(payment)}</div>
                    <div className="p-1 border-b border-black flex items-center justify-end" style={accentStyle}>
                        <span style={{ fontSize: `${finalFontSize * 1.2}px` }}>{formatAmount(totalAmountPayable)}</span>
                    </div>
                </div>
            </div>
        </>
      )
    }

    const renderLicenseBill = () => {
      const propertyRate = getNumber('Property Rate');
      const arrears = getNumber('Arrears');
      const payment = getNumber('Payment');
      const totalAmountDue = (propertyRate || 0) + (arrears || 0);

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
                    <BillRow label="LICENSE FEE" value={formatAmount(propertyRate)} />
                    <BillRow label="ARREARS" value={formatAmount(arrears)} />
                    <BillRow label="AMOUNT DUE" value={formatAmount(totalAmountDue)} isBold />
                    <BillRow label="PAYMENT" value={formatAmount(payment)} />
                    <div className="flex justify-between p-1 border-b border-black items-center font-bold" style={accentStyle}>
                        <span>TOTAL AMOUNT PAYABLE</span>
                        <span className="text-right" style={{ fontSize: `${finalFontSize * 1.2}px` }}>{formatAmount(totalAmountPayable)}</span>
                    </div>
                </div>
                <div className="w-[33%] text-right font-bold">
                    <div className="p-1 border-b-2 border-black flex items-end justify-end">FINANCIAL DETAILS</div>
                    <div className="p-1 border-b border-black">{formatAmount(propertyRate)}</div>
                    <div className="p-1 border-b border-black">{formatAmount(arrears)}</div>
                    <div className="p-1 border-b border-black">{formatAmount(totalAmountDue)}</div>
                    <div className="p-1 border-b border-black">{formatAmount(payment)}</div>
                    <div className="p-1 border-b border-black flex items-center justify-end" style={accentStyle}>
                        <span style={{ fontSize: `${finalFontSize * 1.2}px` }}>{formatAmount(totalAmountPayable)}</span>
                    </div>
                </div>
            </div>
        </>
      )
    }

    if (!data) {
        return <div ref={ref}>Loading...</div>;
    }

    return (
      <div ref={ref} className={cn("text-black bg-white w-full h-full box-border", fontClass, isCompact ? 'p-1' : 'p-2')} style={baseStyle}>
        <div className="border-[3px] border-black p-1 relative h-full flex flex-col">
          <div className="absolute inset-0 z-0 flex items-center justify-center opacity-20 pointer-events-none">
              {settings.appearance?.ghanaLogo && (
                  <Image src={settings.appearance.ghanaLogo} alt="Watermark" width={400} height={400} style={{objectFit: 'contain'}} />
              )}
          </div>
          <div className="relative z-10 flex flex-col flex-grow">
            <header className="flex justify-between items-start mb-2">
                <div className="w-1/4 flex justify-start items-center">
                    {settings.appearance?.ghanaLogo && <Image src={settings.appearance.ghanaLogo} alt="Ghana Coat of Arms" className="object-contain" width={isCompact ? 60: 70} height={isCompact ? 60: 70} />}
                </div>
                <div className="w-1/2 text-center">
                    <h1 className="font-bold tracking-wide" style={{ fontSize: `${finalFontSize * 1.5}px` }}>{settings.general?.assemblyName?.toUpperCase() || 'DISTRICT ASSEMBLY'}</h1>
                    <h2 className="font-bold tracking-wide" style={{ fontSize: `${finalFontSize * 1.3}px` }}>
                      {billType === 'property' ? 'PROPERTY RATE BILL' : billType === 'bop' ? 'B.O.P. BILL' : 'LICENSE BILL'}
                    </h2>
                    <p style={{ fontSize: `${finalFontSize * 0.9}px` }}>{settings.general?.postalAddress}</p>
                    <p style={{ fontSize: `${finalFontSize * 0.9}px` }}>TEL: {settings.general?.contactPhone}</p>
                </div>
                <div className="w-1/4 flex justify-end items-center">
                    {settings.appearance?.assemblyLogo && <Image src={settings.appearance.assemblyLogo} alt="Assembly Logo" className="object-contain" width={isCompact ? 60: 70} height={isCompact ? 60: 70} />}
                </div>
            </header>
            
            <main className="border-t-2 border-b-2 border-black flex-grow">
                {billType === 'property' ? renderPropertyBill() : billType === 'bop' ? renderBopBill() : renderLicenseBill()}
            </main>
            
            <footer className="mt-auto pt-2">
                <div className="flex items-end justify-between gap-2">
                    <div className="flex-1">
                        {barcodeValue && (
                           <BarcodeComponent value={barcodeValue} isCompact={isCompact} />
                        )}
                    </div>
                    <div className="flex-1 text-center">
                        <div className="mx-auto flex items-center justify-center" style={{ minHeight: isCompact ? '30px' : '40px' }}>
                            {settings.appearance?.signature && (
                                <Image src={settings.appearance.signature} alt="Signature" className="max-h-[64px] max-w-full object-contain" width={128} height={64} data-ai-hint="signature" />
                            )}
                        </div>
                        <p className="border-t-2 border-black max-w-[12rem] mx-auto mt-1 pt-1 font-bold">
                            COORDINATING DIRECTOR
                        </p>
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
      // Simulate loading settings - in a real app this might be async
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
