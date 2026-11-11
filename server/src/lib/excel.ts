import ExcelJS from 'exceljs';
import { excelLocal } from './time.js';
import { currencyDigits } from './util.js';

export type ColType = 'text' | 'int' | 'money' | 'date' | 'datetime' | 'percent';
export type Col = { header: string; key: string; type?: ColType; width?: number; total?: boolean };
export type SheetSpec = { name: string; heading?: string; columns: Col[]; rows: Record<string, unknown>[]; totalsLabel?: string };
export type WorkbookSpec = {
  title: string;
  gymName: string;
  filters: string[];
  currency: string;
  locale: string;
  timezone: string;
  sheets: SheetSpec[];
};

const HEADER_FILL = 'FF1F2937';
const TOTAL_FILL = 'FFF3F4F6';

/** Excel number format for the gym's currency, e.g. "₹"#,##0.00 or "Ksh "#,##0. */
export function moneyFormat(currency: string, locale: string) {
  let symbol = currency;
  try {
    symbol = new Intl.NumberFormat(locale, { style: 'currency', currency, currencyDisplay: 'narrowSymbol' })
      .formatToParts(0)
      .find((p) => p.type === 'currency')?.value ?? currency;
  } catch { /* keep ISO code */ }
  const digits = currencyDigits(currency);
  const num = digits ? `#,##0.${'0'.repeat(digits)}` : '#,##0';
  const sym = `"${symbol.replace(/"/g, '')}${symbol.length > 1 ? ' ' : ''}"`;
  return `${sym}${num};-${sym}${num}`;
}

const colLetter = (n: number) => {
  let s = '';
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
};

/** Title row, gym + generated-at row, filters row, styled header, typed cells, optional totals row. */
export async function buildWorkbook(spec: WorkbookSpec): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = spec.gymName;
  wb.created = new Date();
  const money = moneyFormat(spec.currency, spec.locale);
  const generated = new Intl.DateTimeFormat(spec.locale, { timeZone: spec.timezone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date());

  for (const sh of spec.sheets) {
    const ws = wb.addWorksheet(sh.name.slice(0, 31), { views: [{ state: 'frozen', ySplit: 5 }] });
    const n = sh.columns.length;
    const last = colLetter(Math.max(n, 1));

    ws.mergeCells(`A1:${last}1`);
    ws.getCell('A1').value = sh.heading ? `${spec.title} - ${sh.heading}` : spec.title;
    ws.getCell('A1').font = { bold: true, size: 15 };
    ws.getRow(1).height = 24;
    ws.mergeCells(`A2:${last}2`);
    ws.getCell('A2').value = `${spec.gymName} · Generated ${generated} (${spec.timezone})`;
    ws.getCell('A2').font = { color: { argb: 'FF4B5563' }, size: 10 };
    ws.mergeCells(`A3:${last}3`);
    ws.getCell('A3').value = spec.filters.length ? `Filters: ${spec.filters.join(' · ')}` : 'Filters: none';
    ws.getCell('A3').font = { italic: true, color: { argb: 'FF4B5563' }, size: 10 };

    const header = ws.getRow(5);
    sh.columns.forEach((c, i) => {
      const cell = header.getCell(i + 1);
      cell.value = c.header;
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
      cell.alignment = { vertical: 'middle', horizontal: c.type && c.type !== 'text' ? 'right' : 'left' };
      cell.border = { bottom: { style: 'thin', color: { argb: 'FF111827' } } };
      ws.getColumn(i + 1).width = c.width ?? Math.max(12, Math.min(40, c.header.length + 4));
    });
    header.height = 20;

    sh.rows.forEach((row, r) => {
      const xr = ws.getRow(6 + r);
      sh.columns.forEach((c, i) => {
        const cell = xr.getCell(i + 1);
        const v = row[c.key];
        if (v === null || v === undefined || v === '') { cell.value = null; return; }
        switch (c.type) {
          case 'money': cell.value = Number(v); cell.numFmt = money; break;
          case 'int': cell.value = Number(v); cell.numFmt = '#,##0'; break;
          case 'percent': cell.value = Number(v); cell.numFmt = '0.0%'; break;
          case 'date': cell.value = excelLocal(v as Date, spec.timezone); cell.numFmt = 'dd-mmm-yyyy'; break;
          case 'datetime': cell.value = excelLocal(v as Date, spec.timezone); cell.numFmt = 'dd-mmm-yyyy hh:mm'; break;
          default: cell.value = String(v);
        }
      });
      if (r % 2 === 1) xr.eachCell({ includeEmpty: true }, (cell) => { cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF9FAFB' } }; });
    });

    const first = 6;
    const lastData = 5 + sh.rows.length;
    if (sh.rows.length) ws.autoFilter = { from: { row: 5, column: 1 }, to: { row: lastData, column: Math.max(n, 1) } };

    if (sh.totalsLabel && sh.columns.some((c) => c.total)) {
      const tr = ws.getRow(lastData + 1);
      tr.getCell(1).value = sh.totalsLabel;
      sh.columns.forEach((c, i) => {
        const cell = tr.getCell(i + 1);
        if (c.total) {
          const L = colLetter(i + 1);
          const sum = sh.rows.reduce((s, row) => s + (Number(row[c.key]) || 0), 0);
          cell.value = sh.rows.length ? { formula: `SUM(${L}${first}:${L}${lastData})`, result: sum } : 0;
          cell.numFmt = c.type === 'money' ? money : '#,##0';
        }
        cell.font = { bold: true };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_FILL } };
        cell.border = { top: { style: 'thin', color: { argb: 'FF111827' } } };
      });
    }
    if (!sh.rows.length) ws.getCell('A6').value = 'No data for these filters.';
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}

export const safeFileName = (s: string) => s.replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'report';
