/**
 * Formatting & Beautification Engine
 * Namespace: rasid.excel.beautify
 *
 * Handles: header freeze, filters, consistent styles, auto column width,
 * number/date/currency formats, RTL sheets, Arabic fonts, Arabic numerals,
 * cover sheet, summary sheet, TOC/index sheet.
 */

import crypto from 'node:crypto';
import type {
  CellRef,
  SVMCellStyle,
  SVMFont,
  SVMFill,
  SVMBorder,
  SVMAlignment,
  SVMWorkbook,
  SVMSheet,
  SVMFreezePane,
  SVMAutoFilter,
  SVMCell,
} from '../svm/types';

// ─── Configuration Types ────────────────────────────────────────────────────

export interface BeautifyConfig {
  headerRowFreeze: boolean;
  filtersOn: boolean;
  autoColumnWidth: boolean;
  consistentStyles: boolean;
  numberFormat: string;
  dateFormat: string;
  currencyFormat: string;
  currencyCode: string;
  rtl: boolean;
  arabicFonts: boolean;
  arabicNumerals: boolean;
  coverSheet: boolean;
  summarySheet: boolean;
  tocSheet: boolean;
  headerStyle: Partial<SVMCellStyle>;
  bodyStyle: Partial<SVMCellStyle>;
  totalStyle: Partial<SVMCellStyle>;
  templateName: 'finance' | 'ops' | 'executive' | 'rtl_report' | 'default';
}

export interface BeautifyResult {
  beautifyId: string;
  sheetsProcessed: number;
  cellsStyled: number;
  freezePanesSet: number;
  filtersApplied: number;
  coverSheetCreated: boolean;
  summarySheetCreated: boolean;
  tocSheetCreated: boolean;
  timestamp: string;
}

// ─── Presets ────────────────────────────────────────────────────────────────

const ARABIC_FONTS: SVMFont = {
  name: 'Sakkal Majalla',
  size: 12,
  bold: false,
  italic: false,
  underline: false,
  color: '000000',
};

const ARABIC_HEADER_FONT: SVMFont = {
  name: 'Sakkal Majalla',
  size: 14,
  bold: true,
  italic: false,
  underline: false,
  color: 'FFFFFF',
};

const DEFAULT_HEADER_STYLE: SVMCellStyle = {
  font: { name: 'Calibri', size: 12, bold: true, italic: false, underline: false, color: 'FFFFFF' },
  fill: { type: 'pattern', pattern: 'solid', fgColor: '1F5F8B', bgColor: 'FFFFFF' },
  border: {
    top: { style: 'thin', color: '8AA4BF' },
    bottom: { style: 'thin', color: '8AA4BF' },
    left: { style: 'thin', color: '8AA4BF' },
    right: { style: 'thin', color: '8AA4BF' },
  },
  alignment: { horizontal: 'center', vertical: 'middle', wrapText: true, textRotation: 0, readingOrder: 'ltr' },
  numberFormat: null,
  dateFormat: null,
  currencyCode: null,
};

const DEFAULT_BODY_STYLE: SVMCellStyle = {
  font: { name: 'Calibri', size: 11, bold: false, italic: false, underline: false, color: '333333' },
  fill: null,
  border: {
    top: { style: 'thin', color: 'E0E0E0' },
    bottom: { style: 'thin', color: 'E0E0E0' },
    left: { style: 'thin', color: 'E0E0E0' },
    right: { style: 'thin', color: 'E0E0E0' },
  },
  alignment: { horizontal: 'left', vertical: 'middle', wrapText: false, textRotation: 0, readingOrder: 'ltr' },
  numberFormat: null,
  dateFormat: null,
  currencyCode: null,
};

const TEMPLATE_PRESETS: Record<string, Partial<BeautifyConfig>> = {
  finance: {
    numberFormat: '#,##0.00',
    currencyFormat: '#,##0.00 [$SAR]',
    currencyCode: 'SAR',
    dateFormat: 'DD/MM/YYYY',
  },
  ops: {
    numberFormat: '#,##0',
    dateFormat: 'YYYY-MM-DD',
  },
  executive: {
    numberFormat: '#,##0',
    dateFormat: 'DD MMM YYYY',
  },
  rtl_report: {
    rtl: true,
    arabicFonts: true,
    arabicNumerals: true,
    numberFormat: '#,##0',
    dateFormat: 'DD/MM/YYYY',
    currencyFormat: '#,##0 ر.س',
    currencyCode: 'SAR',
  },
  default: {},
};

// ─── Arabic Numeral Conversion ──────────────────────────────────────────────

const ARABIC_NUMERALS: Record<string, string> = {
  '0': '٠', '1': '١', '2': '٢', '3': '٣', '4': '٤',
  '5': '٥', '6': '٦', '7': '٧', '8': '٨', '9': '٩',
};

function toArabicNumerals(value: string): string {
  return value.replace(/[0-9]/g, (d) => ARABIC_NUMERALS[d] ?? d);
}

// ─── Beautifier Engine ──────────────────────────────────────────────────────

export class Beautifier {
  private config: BeautifyConfig;

  constructor(config: Partial<BeautifyConfig> = {}) {
    const templatePreset = TEMPLATE_PRESETS[config.templateName ?? 'default'] ?? {};
    this.config = {
      headerRowFreeze: true,
      filtersOn: true,
      autoColumnWidth: true,
      consistentStyles: true,
      numberFormat: '#,##0',
      dateFormat: 'DD/MM/YYYY',
      currencyFormat: '#,##0.00',
      currencyCode: 'SAR',
      rtl: false,
      arabicFonts: false,
      arabicNumerals: false,
      coverSheet: true,
      summarySheet: true,
      tocSheet: false,
      headerStyle: {},
      bodyStyle: {},
      totalStyle: {},
      templateName: 'default',
      ...templatePreset,
      ...config,
    };
  }

  beautify(workbook: SVMWorkbook): BeautifyResult {
    const beautifyId = `beautify-${crypto.randomUUID()}`;
    let cellsStyled = 0;
    let freezePanesSet = 0;
    let filtersApplied = 0;

    // Create cover sheet if configured
    let coverSheetCreated = false;
    if (this.config.coverSheet) {
      this.createCoverSheet(workbook);
      coverSheetCreated = true;
    }

    // Create summary sheet if configured
    let summarySheetCreated = false;
    if (this.config.summarySheet) {
      this.createSummarySheet(workbook);
      summarySheetCreated = true;
    }

    // Create TOC sheet if configured
    let tocSheetCreated = false;
    if (this.config.tocSheet) {
      this.createTOCSheet(workbook);
      tocSheetCreated = true;
    }

    // Process each data sheet
    for (const [sheetName, sheet] of workbook.sheets) {
      if (sheetName.startsWith('__')) continue; // Skip internal sheets

      // Apply RTL
      if (this.config.rtl) {
        sheet.isRtl = true;
      }

      // Header row freeze
      if (this.config.headerRowFreeze && !sheet.freezePane) {
        sheet.freezePane = { row: 1, col: 0 };
        freezePanesSet++;
      }

      // Auto filters
      if (this.config.filtersOn && !sheet.autoFilter && sheet.dimensions.colCount > 0) {
        sheet.autoFilter = {
          range: `A1:${colNumToLetter(sheet.dimensions.colCount)}${sheet.dimensions.rowCount}`,
          columns: [],
        };
        filtersApplied++;
      }

      // Style header row
      for (let c = 1; c <= sheet.dimensions.colCount; c++) {
        const ref: CellRef = `${sheetName}!${colNumToLetter(c)}1`;
        const cell = sheet.cells.get(ref);
        if (cell) {
          cell.style = this.buildHeaderStyle();
          cellsStyled++;
        }
      }

      // Style body rows
      for (let r = 2; r <= sheet.dimensions.rowCount; r++) {
        for (let c = 1; c <= sheet.dimensions.colCount; c++) {
          const ref: CellRef = `${sheetName}!${colNumToLetter(c)}${r}`;
          const cell = sheet.cells.get(ref);
          if (cell) {
            cell.style = this.buildBodyStyle(cell, r);
            cellsStyled++;
          }
        }
      }

      // Auto column width
      if (this.config.autoColumnWidth) {
        this.autoFitColumns(sheet, sheetName);
      }

      // Apply number/date/currency formats
      this.applyFormats(sheet, sheetName);
    }

    return {
      beautifyId,
      sheetsProcessed: workbook.sheets.size,
      cellsStyled,
      freezePanesSet,
      filtersApplied,
      coverSheetCreated,
      summarySheetCreated,
      tocSheetCreated,
      timestamp: new Date().toISOString(),
    };
  }

  // ─── Style Builders ───────────────────────────────────────────────────

  private buildHeaderStyle(): SVMCellStyle {
    const base = { ...DEFAULT_HEADER_STYLE };
    if (this.config.rtl && base.alignment) {
      base.alignment = { ...base.alignment, readingOrder: 'rtl', horizontal: 'right' };
    }
    if (this.config.arabicFonts) {
      base.font = { ...ARABIC_HEADER_FONT };
    }
    return { ...base, ...this.config.headerStyle } as SVMCellStyle;
  }

  private buildBodyStyle(cell: SVMCell, row: number): SVMCellStyle {
    const base = { ...DEFAULT_BODY_STYLE };

    // Alternating row colors
    if (row % 2 === 0) {
      base.fill = { type: 'pattern', pattern: 'solid', fgColor: 'F5F8FA', bgColor: 'FFFFFF' };
    }

    if (this.config.rtl && base.alignment) {
      base.alignment = { ...base.alignment, readingOrder: 'rtl', horizontal: 'right' };
    }
    if (this.config.arabicFonts) {
      base.font = { ...ARABIC_FONTS };
    }

    // Number alignment
    if (cell.value.type === 'number') {
      if (base.alignment) {
        base.alignment = { ...base.alignment, horizontal: 'right' };
      }
    }

    return { ...base, ...this.config.bodyStyle } as SVMCellStyle;
  }

  // ─── Auto Column Width ────────────────────────────────────────────────

  private autoFitColumns(sheet: SVMSheet, sheetName: string): void {
    for (let c = 1; c <= sheet.dimensions.colCount; c++) {
      let maxWidth = 8; // Minimum width
      for (let r = 1; r <= sheet.dimensions.rowCount; r++) {
        const ref: CellRef = `${sheetName}!${colNumToLetter(c)}${r}`;
        const cell = sheet.cells.get(ref);
        if (cell && cell.value.value !== null) {
          const len = `${cell.value.value}`.length;
          const width = Math.min(Math.max(len + 2, 8), 50); // Min 8, max 50
          if (width > maxWidth) maxWidth = width;
        }
      }
      sheet.dimensions.columnWidths.set(c, maxWidth);
    }
  }

  // ─── Format Application ───────────────────────────────────────────────

  private applyFormats(sheet: SVMSheet, sheetName: string): void {
    for (const [, cell] of sheet.cells) {
      if (!cell.style) continue;

      switch (cell.value.type) {
        case 'number':
          if (!cell.style.numberFormat) {
            cell.style.numberFormat = this.config.numberFormat;
          }
          if (!cell.style.currencyCode && this.config.currencyCode) {
            // Detect currency columns by header name
            cell.style.currencyCode = null; // Only set if column is currency-type
          }
          break;
        case 'date':
          if (!cell.style.dateFormat) {
            cell.style.dateFormat = this.config.dateFormat;
          }
          break;
      }

      // Arabic numerals conversion (stored as display format hint)
      if (this.config.arabicNumerals && cell.value.type === 'number') {
        cell.style.numberFormat = `[${cell.style.numberFormat ?? this.config.numberFormat}]`;
      }
    }
  }

  // ─── Cover Sheet ──────────────────────────────────────────────────────

  private createCoverSheet(workbook: SVMWorkbook): void {
    const name = '__CoverSheet';
    if (workbook.sheets.has(name)) return;

    const sheet: SVMSheet = {
      name,
      index: -1, // Will be reindexed
      cells: new Map(),
      dimensions: { rowCount: 20, colCount: 6, columnWidths: new Map(), rowHeights: new Map() },
      mergedCells: [{ startRow: 1, startCol: 1, endRow: 3, endCol: 6 }],
      freezePane: null,
      autoFilter: null,
      conditionalFormats: [],
      pivotTables: [],
      charts: [],
      isRtl: this.config.rtl,
      tabColor: '1F5F8B',
      hidden: false,
      protection: null,
    };

    // Title
    this.setCoverCell(sheet, name, 1, 1, this.config.rtl ? 'تقرير البيانات' : 'Data Report', {
      font: { ...(this.config.arabicFonts ? ARABIC_HEADER_FONT : DEFAULT_HEADER_STYLE.font!), size: 24 },
      fill: { type: 'pattern', pattern: 'solid', fgColor: '1F5F8B', bgColor: 'FFFFFF' },
      border: null,
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: false, textRotation: 0, readingOrder: this.config.rtl ? 'rtl' : 'ltr' },
      numberFormat: null, dateFormat: null, currencyCode: null,
    });

    // Generated date
    this.setCoverCell(sheet, name, 5, 1, this.config.rtl ? 'تاريخ الإنشاء:' : 'Generated:', null);
    this.setCoverCell(sheet, name, 5, 2, new Date().toISOString().split('T')[0], null);

    // Sheet count
    this.setCoverCell(sheet, name, 6, 1, this.config.rtl ? 'عدد الأوراق:' : 'Sheets:', null);
    this.setCoverCell(sheet, name, 6, 2, `${workbook.sheets.size}`, null);

    // Workbook ID
    this.setCoverCell(sheet, name, 7, 1, this.config.rtl ? 'معرف المصنف:' : 'Workbook ID:', null);
    this.setCoverCell(sheet, name, 7, 2, workbook.workbookId, null);

    workbook.sheets.set(name, sheet);
  }

  // ─── Summary Sheet ────────────────────────────────────────────────────

  private createSummarySheet(workbook: SVMWorkbook): void {
    const name = '__SummarySheet';
    if (workbook.sheets.has(name)) return;

    const sheet: SVMSheet = {
      name,
      index: -1,
      cells: new Map(),
      dimensions: { rowCount: 0, colCount: 4, columnWidths: new Map(), rowHeights: new Map() },
      mergedCells: [],
      freezePane: { row: 1, col: 0 },
      autoFilter: null,
      conditionalFormats: [],
      pivotTables: [],
      charts: [],
      isRtl: this.config.rtl,
      tabColor: '2ECC71',
      hidden: false,
      protection: null,
    };

    // Headers
    const headers = this.config.rtl
      ? ['اسم الورقة', 'عدد الصفوف', 'عدد الأعمدة', 'عدد الصيغ']
      : ['Sheet Name', 'Row Count', 'Column Count', 'Formula Count'];

    for (let c = 0; c < headers.length; c++) {
      this.setCoverCell(sheet, name, 1, c + 1, headers[c], this.buildHeaderStyle());
    }

    let row = 2;
    for (const [sheetName, dataSheet] of workbook.sheets) {
      if (sheetName.startsWith('__')) continue;
      let formulaCount = 0;
      for (const [, cell] of dataSheet.cells) {
        if (cell.value.formula) formulaCount++;
      }

      this.setCoverCell(sheet, name, row, 1, sheetName, null);
      this.setCoverCell(sheet, name, row, 2, dataSheet.dimensions.rowCount, null);
      this.setCoverCell(sheet, name, row, 3, dataSheet.dimensions.colCount, null);
      this.setCoverCell(sheet, name, row, 4, formulaCount, null);
      row++;
    }

    sheet.dimensions.rowCount = row - 1;
    workbook.sheets.set(name, sheet);
  }

  // ─── TOC (Table of Contents) Sheet ────────────────────────────────────

  private createTOCSheet(workbook: SVMWorkbook): void {
    const name = '__TOC';
    if (workbook.sheets.has(name)) return;

    const sheet: SVMSheet = {
      name,
      index: -1,
      cells: new Map(),
      dimensions: { rowCount: 0, colCount: 3, columnWidths: new Map(), rowHeights: new Map() },
      mergedCells: [],
      freezePane: { row: 1, col: 0 },
      autoFilter: null,
      conditionalFormats: [],
      pivotTables: [],
      charts: [],
      isRtl: this.config.rtl,
      tabColor: 'E74C3C',
      hidden: false,
      protection: null,
    };

    const headers = this.config.rtl
      ? ['#', 'اسم الورقة', 'الوصف']
      : ['#', 'Sheet Name', 'Description'];

    for (let c = 0; c < headers.length; c++) {
      this.setCoverCell(sheet, name, 1, c + 1, headers[c], this.buildHeaderStyle());
    }

    let row = 2;
    let idx = 1;
    for (const [sheetName, dataSheet] of workbook.sheets) {
      if (sheetName.startsWith('__')) continue;
      this.setCoverCell(sheet, name, row, 1, idx, null);
      this.setCoverCell(sheet, name, row, 2, sheetName, null);
      this.setCoverCell(sheet, name, row, 3,
        `${dataSheet.dimensions.rowCount} rows × ${dataSheet.dimensions.colCount} columns`, null);
      row++;
      idx++;
    }

    sheet.dimensions.rowCount = row - 1;
    workbook.sheets.set(name, sheet);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private setCoverCell(
    sheet: SVMSheet,
    sheetName: string,
    row: number,
    col: number,
    value: unknown,
    style: SVMCellStyle | null
  ): void {
    const ref: CellRef = `${sheetName}!${colNumToLetter(col)}${row}`;
    sheet.cells.set(ref, {
      ref,
      sheetName,
      row,
      col,
      value: {
        value,
        type: typeof value === 'number' ? 'number' : value === null ? 'blank' : 'string',
        formula: null,
        format: null,
        valueHash: crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16),
      },
      style,
      merge: null,
      conditionalFormats: [],
    });
    if (row > sheet.dimensions.rowCount) sheet.dimensions.rowCount = row;
    if (col > sheet.dimensions.colCount) sheet.dimensions.colCount = col;
  }
}

function colNumToLetter(col: number): string {
  let result = '';
  let c = col;
  while (c > 0) {
    c--;
    result = String.fromCharCode(65 + (c % 26)) + result;
    c = Math.floor(c / 26);
  }
  return result || 'A';
}
