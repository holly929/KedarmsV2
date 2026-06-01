const puppeteer = require('puppeteer');

/**
 * Generates a single PDF from multiple demand notice data objects.
 * @param {Array} notices - Array of notice data.
 * @param {string} type - The type of demand notice ('PROPERTY_RATE' or 'BOP').
 * @returns {Promise<Buffer>} - PDF buffer.
 */
async function generateBulkDemandNoticePDF(notices, type) {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const isPropertyRate = type === 'PROPERTY_RATE';

  // Generate HTML content for all notices
  const htmlContent = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; }
          .notice-container {
            padding: 20px;
            page-break-after: always;
          }
          .header { text-align: center; font-weight: bold; font-size: 1.2em; }
          .content { margin-top: 20px; }
          /* Ensure the last notice doesn't have an empty trailing page */
          .notice-container:last-child { page-break-after: auto; }
        </style>
      </head>
      <body>
        ${notices.map(notice => `
          <div class="notice-container">
            <div class="header">
              ${isPropertyRate ? 'PROPERTY RATE DEMAND NOTICE' : 'BUSINESS OPERATING PERMIT (BOP) DEMAND NOTICE'}
            </div>
            <div class="content">
              <p>Reference: ${notice.referenceNumber}</p>
              <p>Recipient: ${notice.recipientName}</p>
              
              ${isPropertyRate ? `
                <p>Property Address: ${notice.propertyAddress || 'N/A'}</p>
                <p>Block/Lot: ${notice.blockLot || 'N/A'}</p>
              ` : `
                <p>Business Name: ${notice.businessName || 'N/A'}</p>
                <p>Business Category: ${notice.category || 'N/A'}</p>
              `}

              <p>Amount Due: $${notice.amount}</p>
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