'use client';

import React, { useEffect, useState } from 'react';

/**
 * BulkPrintPage - Root level print component
 * This file handles the rendering of multiple demand notices for a batch printing job.
 */

const DemandNoticeTemplate = ({ data }: { data: any }) => (
  <div className="p-8 border-2 border-black mb-8 bg-white min-h-[297mm]">
    <h2 className="text-2xl font-bold text-center border-b-2 border-black pb-2 mb-4">DEMAND NOTICE</h2>
    <div className="space-y-4">
      <p><strong>Property Ref:</strong> {data.propertyRef}</p>
      <p><strong>Owner Name:</strong> {data.ownerName}</p>
      <div className="pt-4 border-t border-dashed border-black/30">
        <p className="text-lg font-bold">Total Amount Due: GHS {data.totalAmount}</p>
      </div>
    </div>
  </div>
);

const BulkPrintPage = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const ids = queryParams.get('ids')?.split(',') || [];
    
    // Fetch logic simulation
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

  if (loading) return <div className="p-12 text-center font-bold">Loading notices for print...</div>;
  if (data.length === 0) return <div className="p-12 text-center font-bold">No notices selected.</div>;

  return (
    <div className="print-container bg-muted/20 min-h-screen p-4">
      <style jsx global>{`
        @media print {
          .no-print { display: none; }
          .printable-notice { break-after: page; page-break-after: always; }
          body { margin: 0; padding: 0; background: white; }
        }
      `}</style>
      {data.map((notice) => (
        <div key={notice.id} className="printable-notice max-w-[210mm] mx-auto">
          <DemandNoticeTemplate data={notice} />
        </div>
      ))}
    </div>
  );
};

export default BulkPrintPage;
