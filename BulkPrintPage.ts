// BulkPrintPage.tsx
import React, { useEffect, useState } from 'react';

// Note: DemandNoticeTemplate should be defined or imported from a valid path
const DemandNoticeTemplate = ({ data }: { data: any }) => (
  <div>
    <h2>Demand Notice</h2>
    <p>Property: {data.propertyRef}</p>
    <p>Owner: {data.ownerName}</p>
    <p>Amount: {data.totalAmount}</p>
  </div>
);

const BulkPrintPage = () => {
  const [data, setData] = useState<any[]>([]);
  
  useEffect(() => {
    const queryParams = new URLSearchParams(window.location.search);
    const ids = queryParams.get('ids')?.split(',') || [];
    // Mock fetch logic
    const fetchNotices = async (ids: string[]) => {
        return ids.map(id => ({
            id,
            propertyRef: `PROP-${id}`,
            ownerName: 'Owner Name',
            totalAmount: '0.00'
        }));
    };
    fetchNotices(ids).then(results => setData(results));
  }, []);

  if (data.length === 0) return <div>Loading notices...</div>;

  return (
    <div className="print-container">
      {data.map((notice) => (
        <div key={notice.id} className="printable-notice">
          <DemandNoticeTemplate data={notice} />
        </div>
      ))}
    </div>
  );
};

export default BulkPrintPage;

// Example selection logic snippet (as a separate component to avoid duplication)
export const DemandNoticeList = ({ notices }: { notices: any[] }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkPrint = () => {
    if (selectedIds.length === 0) return alert("Select at least one notice.");
    const idParams = selectedIds.join(',');
    window.open(`/print/bulk-demand-notices?ids=${idParams}`, '_blank');
  };

  return (
    <div>
      <button onClick={handleBulkPrint} disabled={selectedIds.length === 0}>
        Print Selected ({selectedIds.length})
      </button>
      <div className="mt-4">
          {notices.map(n => (
              <div key={n.id} className="flex items-center gap-2">
                  <input type="checkbox" onChange={() => toggleSelection(n.id)} checked={selectedIds.includes(n.id)} />
                  <span>{n.ownerName}</span>
              </div>
          ))}
      </div>
    </div>
  );
};
