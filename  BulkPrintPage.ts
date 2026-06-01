// BulkPrintPage.tsx
import React, { useEffect, useState } from 'react';
import { DemandNoticeTemplate } from './templates/DemandNoticeTemplate';

const BulkPrintPage = () => {
  const [data, setData] = useState<any[]>([]);
  const queryParams = new URLSearchParams(window.location.search);
  const ids = queryParams.get('ids')?.split(',') || [];

  useEffect(() => {
    // Fetch all demand notices by the list of IDs
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
/* print.css */
@media print {
  /* Hide UI elements like buttons or navbars */
  .no-print {
    display: none;
  }

  /* Force a page break after each notice */
  .printable-notice {
    break-after: page;
    page-break-after: always; /* Fallback for older browsers */
  }

  /* Reset margins for printing */
  body {
    margin: 0;
    padding: 0;
  }
}
// /src/controllers/demandNoticeController.ts

export const getBulkDemandNotices = async (req: Request, res: Response) => {
  const { ids } = req.body; // Use POST body for large batches

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "No IDs provided" });
  }

  const notices = await prisma.demandNotice.findMany({
    where: {
      id: { in: ids }
    },
    // Optimization: Only select fields required for the print template
    select: {
      id: true,
      propertyRef: true,
      ownerName: true,
      totalAmount: true,
      dueDate: true,
      // Avoid fetching large binary blobs or unnecessary relations
    }
  });

  return res.json(notices);
};
// Example selection logic in a React-based UI
import React, { useState } from 'react';

const DemandNoticeList = ({ notices }) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleBulkPrint = () => {
    if (selectedIds.length === 0) return alert("Select at least one notice.");
    
    // Redirect to a dedicated print page with IDs in query params
    const idParams = selectedIds.join(',');
    window.open(`/print/bulk-demand-notices?ids=${idParams}`, '_blank');
  };

  return (
    <div>
      <button onClick={handleBulkPrint} disabled={selectedIds.length === 0}>
        Print Selected ({selectedIds.length})
      </button>
      {/* Render your table with checkboxes here */}
    </div>
  );
};
