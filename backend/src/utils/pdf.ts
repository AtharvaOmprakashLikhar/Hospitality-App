import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface PayslipPDFData {
  id: string;
  userName: string;
  userEmail: string;
  propertyName: string;
  month: number;
  year: number;
  baseSalary: number;
  hra: number;
  allowances: number;
  deductions: number;
  grossPay: number;
  netPay: number;
  presentDays: number;
  leaveDays: number;
  absentDays: number;
  generatedAt: Date;
}

/**
 * Generates a payslip PDF binary buffer using pdf-lib.
 */
export async function generatePayslipPDF(data: PayslipPDFData): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  
  const { width, height } = page.getSize();
  
  // Header Panel
  page.drawRectangle({
    x: 0,
    y: height - 100,
    width,
    height: 100,
    color: rgb(0.08, 0.08, 0.12), // Sleek Charcoal Base
  });
  
  page.drawText(data.propertyName, {
    x: 50,
    y: height - 50,
    size: 20,
    font: boldFont,
    color: rgb(1, 1, 1),
  });
  
  page.drawText(`PAYSLIP FOR ${getMonthName(data.month).toUpperCase()} ${data.year}`, {
    x: 50,
    y: height - 80,
    size: 12,
    font: boldFont,
    color: rgb(0.96, 0.72, 0.34), // Amber Accent
  });
  
  // Metadata Section
  let y = height - 150;
  
  const drawMeta = (label: string, value: string, x: number) => {
    page.drawText(label, { x, y, size: 9, font: boldFont, color: rgb(0.5, 0.5, 0.5) });
    page.drawText(value, { x, y: y - 16, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
  };
  
  drawMeta('EMPLOYEE', data.userName, 50);
  drawMeta('EMAIL', data.userEmail, 200);
  drawMeta('SLIP ID', data.id.substring(0, 8).toUpperCase(), 400);
  
  y -= 45;
  drawMeta('PRESENT DAYS', String(data.presentDays), 50);
  drawMeta('LEAVE DAYS', String(data.leaveDays), 200);
  drawMeta('ABSENT DAYS', String(data.absentDays), 400);
  
  // Divider
  y -= 35;
  page.drawLine({
    start: { x: 50, y },
    end: { x: 550, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });
  
  // Table headers
  y -= 25;
  page.drawText('Salary Components', { x: 50, y, size: 11, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
  page.drawText('Amount ($)', { x: 450, y, size: 11, font: boldFont, color: rgb(0.1, 0.1, 0.1) });
  
  const drawTableRow = (label: string, amount: number, isDeduction = false) => {
    y -= 22;
    page.drawText(label, { x: 50, y, size: 10, font, color: rgb(0.2, 0.2, 0.2) });
    const prefix = isDeduction ? '-' : '';
    page.drawText(`${prefix}$${amount.toFixed(2)}`, { 
      x: 450, 
      y, 
      size: 10, 
      font, 
      color: isDeduction ? rgb(0.8, 0.2, 0.2) : rgb(0.2, 0.2, 0.2) 
    });
  };
  
  drawTableRow('Base Salary', data.baseSalary);
  drawTableRow('House Rent Allowance (HRA)', data.hra);
  drawTableRow('Special Allowances', data.allowances);
  drawTableRow('Deductions (Unpaid leaves/Absences)', data.deductions, true);
  
  // Divider
  y -= 20;
  page.drawLine({
    start: { x: 50, y },
    end: { x: 550, y },
    thickness: 1,
    color: rgb(0.85, 0.85, 0.85),
  });
  
  // Gross / Deductions totals
  y -= 22;
  page.drawText('Gross Earnings', { x: 50, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
  page.drawText(`$${data.grossPay.toFixed(2)}`, { x: 450, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
  
  y -= 22;
  page.drawText('Total Deductions', { x: 50, y, size: 10, font, color: rgb(0.1, 0.1, 0.1) });
  page.drawText(`-$${data.deductions.toFixed(2)}`, { x: 450, y, size: 10, font, color: rgb(0.8, 0.2, 0.2) });
  
  // Net take home pay box
  y -= 45;
  page.drawRectangle({
    x: 50,
    y: y - 8,
    width: 500,
    height: 36,
    color: rgb(0.96, 0.96, 0.98),
  });
  
  page.drawText('NET TAKE-HOME PAY', { x: 65, y, size: 11, font: boldFont, color: rgb(0.08, 0.08, 0.12) });
  page.drawText(`$${data.netPay.toFixed(2)}`, { x: 450, y, size: 12, font: boldFont, color: rgb(0.08, 0.6, 0.3) });
  
  // Footer
  y -= 60;
  page.drawText('This payslip is a system-generated document and requires no physical signature.', {
    x: 50,
    y,
    size: 8.5,
    font,
    color: rgb(0.55, 0.55, 0.55),
  });
  
  page.drawText(`Generated via HospitalityOS Salary Portal on ${new Date(data.generatedAt).toLocaleString()}`, {
    x: 50,
    y: y - 14,
    size: 8.5,
    font,
    color: rgb(0.55, 0.55, 0.55),
  });
  
  return await pdfDoc.save();
}

function getMonthName(month: number): string {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[month - 1] || 'Unknown';
}
