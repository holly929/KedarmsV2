'use client';

import { useEffect, useState } from 'react';

/**
 * BulkPrintPage - Consolidated root level print component.
 * This resolves the "Duplicate identifier 'React'" error caused by redundant imports
 * and conflicting snippets in the previous version.
 */

const DemandNoticeTemplate = ({ data }: { data: any }) => (
  <div className="p-8 border-2 border-black mb-8 bg-white min-h-[297mm] flex flex-col">
    <div className="text-center border-b-2 border-black pb-4 mb-6">
      <h1 className="text-3xl font-black tracking-widest uppercase">Demand Notice</h1>
      <p className="text-sm font-bold text-muted-foreground mt-1">Official Revenue Enforcement Document</p>
    </div>
    
    <div className="flex-grow space-y-6">
      <div className="grid grid-cols-2 gap-4 border-b border-dashed border-black/30 pb-4">
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Property Reference</label>
          <p className="font-mono text-lg">{data.propertyRef}</p>
        </div>
        <div>
          <label className="text-[10px] font-bold text-muted-foreground uppercase">Recipient Name</label>
          <p className="font-bold text-lg uppercase">{data.ownerName}</p>
        </div>
      </div>

      <div className="bg-black/5 p-6 border-2 border-black">
        <h3 className="text-sm font-black mb-2 uppercase tracking-tighter text-muted-foreground">Arrears Summary</h3>
        <div className="flex justify-between items-end">
          <span className="text-lg font-bold">Total Outstanding Balance:</span>
          <span className="text-3xl font-black">GHS {data.totalAmount}</span>
        </div>
      </div>

      <div className="mt-12 text-center italic border-t pt-8">
        <p className="text-sm font-bold">"LEGAL ACTION WILL BE TAKEN IF NOT PAID WITHIN 14 DAYS."</p>
      </div>
    </div>
    
    <div className="mt-auto flex justify-between items-end pt-8">
      <div className="w-1/3 border-t-2 border-black pt-1 text-center font-bold text-xs">
        STAMP / DATE
      </div>
      <div className="w-1/3 border-t-2 border-black pt-1 text-center font-bold text-xs uppercase">
        Coordinating Director
      </div>
    </div>
  </div>
);

const BulkPrintPage = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const queryParams = new URLSearchParams(window.location.search);
    const ids = queryParams.get('ids')?.split(',') || [];
    
    // Simulate fetching notice details
    const fetchNotices = async (noticeIds: string[]) => {
        return noticeIds.map(id => ({
            id,
            propertyRef: `PROP-${id}`,
            ownerName: 'Valued Ratepayer',
            totalAmount: '0.00'
        }));
    };

    fetchNotices(ids).then(results => {
        setData(results);
        setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-12 text-center font-bold animate-pulse">Loading notices for batch print...</div>;
  if (data.length === 0) return <div className="p-12 text-center font-bold text-destructive">No notices selected for printing.</div>;

  return (
    <div className="print-container bg-muted/20 min-h-screen p-4">
      <style jsx global>{`
        @media print {
          .no-print { display: none; }
          .printable-notice { break-after: page; page-break-after: always; }
          body { margin: 0; padding: 0; background: white; }
          .print-container { padding: 0; background: transparent; }
        }
      `}</style>
      {data.map((notice) => (
        <div key={notice.id} className="printable-notice max-w-[210mm] mx-auto shadow-xl print:shadow-none mb-8 print:mb-0">
          <DemandNoticeTemplate data={notice} />
        </div>
      ))}
    </div>
  );
};

export default BulkPrintPage;
