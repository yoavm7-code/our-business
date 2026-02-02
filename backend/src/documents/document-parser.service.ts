import { Injectable } from '@nestjs/common';
import * as fs from 'fs';

const CSV_MIMES = ['text/csv', 'application/csv'];
const EXCEL_MIMES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
  'application/vnd.ms-excel', // .xls
];
const DOCX_MIMES = [
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/msword', // .doc - mammoth may not support; try anyway
];

/**
 * Extracts plain text from structured files (CSV, Excel, DOCX) for AI transaction extraction.
 */
@Injectable()
export class DocumentParserService {
  async getTextFromFile(filePath: string, mimeType: string): Promise<string> {
    if (!fs.existsSync(filePath)) return '';

    const mime = (mimeType || '').toLowerCase();

    if (CSV_MIMES.includes(mime)) {
      return this.readCsvAsText(filePath);
    }
    if (EXCEL_MIMES.includes(mime)) {
      return this.readExcelAsText(filePath);
    }
    if (DOCX_MIMES.includes(mime)) {
      return this.readDocxAsText(filePath);
    }

    return '';
  }

  private readCsvAsText(filePath: string): string {
    const buf = fs.readFileSync(filePath);
    const str = buf.toString('utf-8');
    // Normalize line endings and trim
    return str.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  }

  private readExcelAsText(filePath: string): string {
    // Dynamic require to avoid loading xlsx when not needed
    const XLSX = require('xlsx');
    const workbook = XLSX.readFile(filePath, { cellDates: false, raw: false });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return '';
    const sheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as (string | number)[][];
    const lines = rows.map((row) => (Array.isArray(row) ? row.map((c) => String(c ?? '')).join('\t') : String(row)));
    return lines.join('\n');
  }

  private async readDocxAsText(filePath: string): Promise<string> {
    try {
      const mammoth = require('mammoth');
      const buf = fs.readFileSync(filePath);
      const result = await mammoth.extractRawText({ buffer: buf });
      return (result?.value ?? '').trim();
    } catch {
      return ''; // .doc (binary) not supported; only .docx
    }
  }
}

export const STRUCTURED_MIMES = [...CSV_MIMES, ...EXCEL_MIMES, ...DOCX_MIMES];
