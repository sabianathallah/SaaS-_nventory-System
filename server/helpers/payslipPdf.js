'use strict';
const PDFDocument = require('pdfkit');

const BRAND_RED = '#C8102E';
const GRAY = '#64748B';
const DARK = '#1E293B';
const LINE = '#E2E8F0';

function fmtRp(n) {
  const v = Number(n || 0);
  if (!v) return '-';
  return `Rp ${v.toLocaleString('id-ID')}`;
}
function fmtDate(d) {
  return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

/**
 * Render a payslip PDF as a Buffer.
 * @param {{company: object, employee: object, payslip: object}} data
 */
function renderPayslipPdf({ company, employee, payslip }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // ── Header ──────────────────────────────────────────────
    doc.fontSize(16).fillColor(DARK).font('Helvetica-Bold').text(company.name || '');
    if (company.legalName) {
      doc.fontSize(10).fillColor(DARK).font('Helvetica-Bold').text(company.legalName);
    }
    doc.font('Helvetica').fontSize(8).fillColor(GRAY);
    if (company.address) doc.text(company.address);
    const contactLine = [company.contactEmail, company.contactPhone].filter(Boolean).join(' | ');
    if (contactLine) doc.text(contactLine);

    doc.moveDown(0.6);
    doc.moveTo(left, doc.y).lineTo(left + pageWidth, doc.y).strokeColor(DARK).lineWidth(1).stroke();
    doc.moveDown(1);

    // ── Title + employee info ────────────────────────────────
    doc.fontSize(20).fillColor(DARK).font('Helvetica-Bold').text('Slip Gaji Karyawan');
    doc.moveDown(0.6);

    doc.fontSize(10).font('Helvetica').fillColor(DARK);
    doc.text(employee.name);
    if (employee.nik) doc.text(`NIK ${employee.nik}`);
    doc.text(`Periode Gaji ${fmtDate(payslip.periodStart)} - ${fmtDate(payslip.periodEnd)}`);
    doc.text(`Tanggal Pembayaran ${fmtDate(payslip.paymentDate)}`);
    doc.moveDown(1.2);

    function table(title, rows, totalLabel, totalValue) {
      let y = doc.y;
      doc.rect(left, y, pageWidth, 22).fill(BRAND_RED);
      doc.fillColor('#fff').fontSize(10).font('Helvetica-Bold');
      doc.text(title, left + 8, y + 6, { width: pageWidth - 16, continued: false });
      doc.text('Amount', left, y + 6, { width: pageWidth - 8, align: 'right' });
      y += 22;

      rows.forEach(([label, value]) => {
        y += 8;
        doc.fillColor(DARK).font('Helvetica').fontSize(10);
        doc.text(label, left + 8, y, { width: pageWidth - 100 });
        doc.font('Helvetica-Oblique').text(value, left, y, { width: pageWidth - 8, align: 'right' });
        y += 14;
        doc.moveTo(left, y).lineTo(left + pageWidth, y).strokeColor(LINE).lineWidth(0.5).stroke();
      });

      y += 10;
      doc.font('Helvetica-Bold').fontSize(10).fillColor(DARK);
      doc.text(totalLabel, left + 8, y, { width: pageWidth - 100 });
      doc.text(totalValue, left, y, { width: pageWidth - 8, align: 'right' });
      y += 24;
      doc.y = y;
    }

    table('Earnings', [
      ['Fixed Salary', fmtRp(payslip.fixedSalary)],
      ['Tunjangan Transportasi', fmtRp(payslip.allowanceTransport)],
      ['Tunjangan Makan', fmtRp(payslip.allowanceMeal)],
      ['Overtime', fmtRp(payslip.overtime)],
      ['Bonus', fmtRp(payslip.bonus)],
    ], 'Total Earnings', fmtRp(payslip.totalEarnings));

    doc.moveDown(0.6);

    table('Deductions', [
      ['Potongan Lainnya', fmtRp(payslip.otherDeductions)],
    ], 'Total Deductions', fmtRp(payslip.totalDeductions));

    // ── Net Pay ────────────────────────────────────────────
    doc.moveDown(0.6);
    let netY = doc.y;
    doc.moveTo(left, netY).lineTo(left + pageWidth, netY).strokeColor(DARK).lineWidth(1).stroke();
    netY += 12;
    doc.fontSize(12).font('Helvetica-Bold').fillColor(DARK);
    doc.text('Net Pay', left, netY, { width: pageWidth - 100 });
    doc.text(fmtRp(payslip.netPay), left, netY, { width: pageWidth - 8, align: 'right' });
    doc.y = netY + 30;

    // ── Footer note ────────────────────────────────────────
    doc.fontSize(8).font('Helvetica-Oblique').fillColor(GRAY)
      .text('Catatan: Slip gaji ini dibuat secara otomatis oleh sistem dan sah tanpa tanda tangan basah.', left, doc.y, { width: pageWidth });

    doc.end();
  });
}

module.exports = { renderPayslipPdf };
