const puppeteer = require('puppeteer');

/**
 * Generates a single PDF from multiple demand notice data objects.
 * @param {Array} notices - Array of notice data.
 * @param {string} type - The type of demand notice ('PROPERTY_RATE' or 'BOP').
 * @returns {Promise<Buffer>} - PDF buffer.
 */
async function generateBulkDemandNoticePDF(notices, type) {
  /**
   * Ensures placeholders are rendered professionally for print.
   */
  const formatValue = (val) => {
    if (val === 0 || val === "0") return "0";
    if (!val || String(val).trim() === "") return "...";
    return val;
  };

  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const isPropertyRate = type === 'PROPERTY_RATE';

  // Generate HTML content for all notices
  const htmlContent = `
    <html>
      <head>
        <style>
          @page {
            margin: 0;
            size: A4;
          }
          body { 
            font-family: Arial, sans-serif; 
            background-color: white !important;
            color: black !important;
            margin: 0;
          }
          .notice-container {
            position: relative;
            padding: 40px;
            height: 297mm;
            width: 210mm;
            box-sizing: border-box;
            overflow: hidden;
            page-break-after: always;
            background-color: white !important;
          }
          .header { text-align: center; font-weight: bold; font-size: 1.2em; }
          .content { margin-top: 20px; }
          /* Ensure the last notice doesn't have an empty trailing page */
          .notice-container:last-child { page-break-after: auto; }

          /* Prevent template utilities from hiding content in the PDF */
          .notice-container .hidden, 
          .notice-container [style*="display: none"],
          .notice-container [class*="hidden"] { 
            display: block !important; 
          }
        </style>
      </head>
      <body>
        ${notices.map(notice => `
          <div class="notice-container">
            <div class="header">
              ${isPropertyRate ? 'PROPERTY RATE DEMAND NOTICE' : 'BUSINESS OPERATING PERMIT (BOP) DEMAND NOTICE'}
            </div>
            <div class="content">
              <p>Reference: ${formatValue(notice.referenceNumber)}</p>
              <p>Recipient: ${formatValue(notice.recipientName)}</p>
              
              ${isPropertyRate ? `
                <p>Property Address: ${formatValue(notice.propertyAddress)}</p>
                <p>Block/Lot: ${formatValue(notice.blockLot)}</p>
              ` : `
                <p>Business Name: ${formatValue(notice.businessName)}</p>
                <p>Business Category: ${formatValue(notice.category)}</p>
              `}

              <p>Amount Due: $${formatValue(notice.amount)}</p>
              <p>Due Date: ${new Date(notice.dueDate).toLocaleDateString()}</p>
            </div>
          </div>
        `).join('')}
      </body>
    </html>
  `;

  await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();
  return pdfBuffer;
}

module.exports = { generateBulkDemandNoticePDF };