const { DemandNotice } = require('../models');
const { generateBulkDemandNoticePDF } = require('../services/pdfService');

async function bulkPrintNotices(req, res) {
  try {
    const { ids, type } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'No notice IDs provided' });
    }

    if (!type || !['PROPERTY_RATE', 'BOP'].includes(type)) {
      return res.status(400).json({ error: 'A valid notice type (PROPERTY_RATE or BOP) is required' });
    }

    // Fetch notice details from database with ordering for easier physical distribution
    const notices = await DemandNotice.findAll({
      where: { 
        id: ids,
        noticeType: type // Ensure we only print the requested type
      },
      order: [['id', 'ASC']]
    });

    if (!notices || notices.length === 0) {
      return res.status(404).json({ 
        error: 'No matching demand notices found for the provided IDs and type' 
      });
    }

    const pdfBuffer = await generateBulkDemandNoticePDF(notices, type);
    const timestamp = new Date().getTime();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="bulk-${type.toLowerCase()}-notices-${timestamp}.pdf"`,
      'Content-Length': pdfBuffer.length,
      'Cache-Control': 'no-cache'
    });

    return res.send(pdfBuffer);
  } catch (error) {
    console.error('[Bulk Print Error]:', {
      message: error.message,
      stack: error.stack,
      requestedIds: req.body.ids,
      type: req.body.type
    });
    return res.status(500).json({ error: 'Failed to generate bulk print' });
  }
}

module.exports = { bulkPrintNotices };