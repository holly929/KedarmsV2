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

    // Fetch notice details from database
    const notices = await DemandNotice.findAll({
      where: { 
        id: ids,
        noticeType: type // Ensure we only print the requested type
      }
    });

    const pdfBuffer = await generateBulkDemandNoticePDF(notices, type);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="bulk-${type.toLowerCase()}-notices.pdf"`,
      'Content-Length': pdfBuffer.length,
    });

    return res.send(pdfBuffer);
  } catch (error) {
    console.error('Bulk print error:', error);
    return res.status(500).json({ error: 'Failed to generate bulk print' });
  }
}

module.exports = { bulkPrintNotices };