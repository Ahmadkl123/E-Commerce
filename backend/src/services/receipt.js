const PDFDocument = require('pdfkit');

// Builds the PDF receipt a customer downloads for one of their orders.
// The design follows the storefront: near-black ink, warm grey hairlines and
// generous white space.

const COLORS = {
  ink: '#141414',
  muted: '#6b6862',
  line: '#dedad3',
  paper: '#f4f2ee',
  success: '#2f6f4e',
  successBg: '#e3efe7',
  warn: '#8a5a12',
  warnBg: '#f6ecd9',
};

const PAGE = { size: 'A4', margin: 50 };
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const money = (value) => currency.format(Number(value) || 0);

function formatDate(value) {
  return new Date(value).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

const METHOD_LABELS = {
  stripe: 'Card (Stripe)',
  card: 'Card',
  paypal: 'PayPal',
  apple_pay: 'Apple Pay',
  google_pay: 'Google Pay',
};

/**
 * Renders the receipt and resolves with the PDF as a Buffer.
 * order: { id, total, status, payment_method, payment_details, payment_reference, created_at }
 * items: [{ product_name, quantity, unit_price }]
 */
function buildReceipt({ order, items, customerEmail }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      ...PAGE,
      bufferPages: true, // lets the footer be drawn on every page at the end
      info: { Title: `Kestrel receipt - Order #${order.id}`, Author: 'Kestrel Storefront' },
    });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = PAGE.margin;
    const right = doc.page.width - PAGE.margin;
    const width = right - left;

    // ---- Header band ----
    doc.rect(0, 0, doc.page.width, 150).fill(COLORS.ink);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(24).text('Kestrel', left, 52);
    doc.font('Helvetica').fontSize(9).fillColor('#a9a59d').text('STOREFRONT', left, 82, { characterSpacing: 2 });

    doc.font('Helvetica').fontSize(9).fillColor('#a9a59d')
      .text('RECEIPT', left, 50, { width, align: 'right', characterSpacing: 2 });
    doc.font('Helvetica-Bold').fontSize(28).fillColor('#ffffff')
      .text(`#${order.id}`, left, 64, { width, align: 'right' });
    doc.font('Helvetica').fontSize(9).fillColor('#a9a59d')
      .text(`${formatDate(order.created_at)} at ${formatTime(order.created_at)}`, left, 100, { width, align: 'right' });

    // ---- Summary cards: order number, date, status ----
    let y = 180;
    const colW = width / 3;
    const meta = [
      ['ORDER NUMBER', `#${order.id}`],
      ['ORDER DATE', formatDate(order.created_at)],
    ];
    meta.forEach(([label, value], i) => {
      const x = left + i * colW;
      doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text(label, x, y, { characterSpacing: 1.2 });
      doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.ink).text(value, x, y + 15);
    });

    const paid = order.status === 'paid';
    const statusX = left + 2 * colW;
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted).text('STATUS', statusX, y, { characterSpacing: 1.2 });
    const statusText = String(order.status || 'pending').toUpperCase();
    doc.font('Helvetica-Bold').fontSize(9);
    const pillW = doc.widthOfString(statusText, { characterSpacing: 1 }) + 20;
    doc.roundedRect(statusX, y + 12, pillW, 20, 10).fill(paid ? COLORS.successBg : COLORS.warnBg);
    doc.fillColor(paid ? COLORS.success : COLORS.warn)
      .text(statusText, statusX, y + 18, { width: pillW, align: 'center', characterSpacing: 1 });

    // ---- Billed to / Payment ----
    y += 60;
    doc.rect(left, y, width, 78).fill(COLORS.paper);
    const half = width / 2;
    const boxPad = 18;

    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted)
      .text('BILLED TO', left + boxPad, y + boxPad, { characterSpacing: 1.2 });
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.ink)
      .text(customerEmail || 'Customer', left + boxPad, y + boxPad + 15, { width: half - boxPad * 2, ellipsis: true, lineBreak: false });

    const payX = left + half + boxPad;
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted)
      .text('PAYMENT', payX, y + boxPad, { characterSpacing: 1.2 });
    const method = METHOD_LABELS[order.payment_method] || 'Not paid yet';
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.ink)
      .text(order.payment_details || method, payX, y + boxPad + 15, { width: half - boxPad * 2, ellipsis: true, lineBreak: false });
    if (order.payment_reference) {
      doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted)
        .text(`Ref. ${order.payment_reference}`, payX, y + boxPad + 32, { width: half - boxPad * 2, ellipsis: true, lineBreak: false });
    }

    // ---- Items table ----
    y += 110;
    const cols = { item: left, qty: left + width * 0.58, unit: left + width * 0.68, amount: left + width * 0.84 };
    const colWidth = { item: width * 0.55, qty: width * 0.1, unit: width * 0.16, amount: width * 0.16 };

    const drawTableHead = () => {
      doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted);
      doc.text('ITEM', cols.item, y, { characterSpacing: 1.2 });
      doc.text('QTY', cols.qty, y, { width: colWidth.qty, align: 'center', characterSpacing: 1.2 });
      doc.text('UNIT PRICE', cols.unit, y, { width: colWidth.unit, align: 'right', characterSpacing: 1.2 });
      doc.text('AMOUNT', cols.amount, y, { width: colWidth.amount, align: 'right', characterSpacing: 1.2 });
      y += 16;
      doc.moveTo(left, y).lineTo(right, y).lineWidth(1).strokeColor(COLORS.ink).stroke();
      y += 12;
    };
    drawTableHead();

    let subtotal = 0;
    for (const item of items) {
      const name = item.product_name || 'Removed product';
      const amount = Number(item.unit_price) * item.quantity;
      subtotal += amount;

      doc.font('Helvetica-Bold').fontSize(10.5);
      const rowH = Math.max(doc.heightOfString(name, { width: colWidth.item }), 14);

      // Start a new page when the row would run into the totals/footer area.
      if (y + rowH + 24 > doc.page.height - 120) {
        doc.addPage();
        y = PAGE.margin;
        drawTableHead();
      }

      doc.fillColor(COLORS.ink).text(name, cols.item, y, { width: colWidth.item });
      doc.font('Helvetica').fontSize(10.5).fillColor(COLORS.ink);
      doc.text(String(item.quantity), cols.qty, y, { width: colWidth.qty, align: 'center' });
      doc.fillColor(COLORS.muted).text(money(item.unit_price), cols.unit, y, { width: colWidth.unit, align: 'right' });
      doc.fillColor(COLORS.ink).text(money(amount), cols.amount, y, { width: colWidth.amount, align: 'right' });

      y += rowH + 12;
      doc.moveTo(left, y).lineTo(right, y).lineWidth(0.6).strokeColor(COLORS.line).stroke();
      y += 12;
    }

    // ---- Totals ----
    if (y + 130 > doc.page.height - 80) {
      doc.addPage();
      y = PAGE.margin;
    }
    const totalsX = left + width * 0.55;
    const totalsW = width * 0.45;
    const totalRow = (label, value) => {
      doc.font('Helvetica').fontSize(10).fillColor(COLORS.muted).text(label, totalsX, y);
      doc.fillColor(COLORS.ink).text(value, totalsX, y, { width: totalsW, align: 'right' });
      y += 20;
    };
    y += 6;
    totalRow('Subtotal', money(subtotal));
    totalRow('Shipping', 'Free');
    totalRow('Tax', 'Included');

    y += 6;
    doc.rect(totalsX, y, totalsW, 44).fill(COLORS.ink);
    doc.font('Helvetica').fontSize(9).fillColor('#a9a59d')
      .text(paid ? 'TOTAL PAID' : 'TOTAL DUE', totalsX + 16, y + 17, { characterSpacing: 1.2 });
    doc.font('Helvetica-Bold').fontSize(16).fillColor('#ffffff')
      .text(money(order.total), totalsX, y + 13, { width: totalsW - 16, align: 'right' });

    // ---- Footer (on every page) ----
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0; // the footer sits inside the bottom margin
      const fy = doc.page.height - 80;
      doc.moveTo(left, fy).lineTo(right, fy).lineWidth(0.6).strokeColor(COLORS.line).stroke();
      doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.ink)
        .text('Thank you for shopping with Kestrel.', left, fy + 14, { lineBreak: false });
      doc.font('Helvetica').fontSize(8).fillColor(COLORS.muted)
        .text('Keep this receipt for your records. Card numbers are never stored by Kestrel.', left, fy + 30, { lineBreak: false });
      doc.text(`Page ${i - range.start + 1} of ${range.count}`, left, fy + 14, { width, align: 'right', lineBreak: false });
    }

    doc.end();
  });
}

module.exports = { buildReceipt };
