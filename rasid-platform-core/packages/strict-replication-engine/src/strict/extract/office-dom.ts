/**
 * Office Document Extraction — PPTX / DOCX / XLSX as inputs
 *
 * Extracts Office object model deterministically for CDR building.
 * Supports: presentations, word processing, spreadsheets.
 */

import { randomUUID } from 'crypto';
import { readFile } from 'fs/promises';
import type {
  AssetRef,
  Warning,
  ColorRGBA,
  TransformMatrix,
} from '../cdr/types';
import type { ToolRequest, ToolResponse } from '../tools/registry';

// ─── Office DOM Types ─────────────────────────────────────────────────

export interface OfficeDomRef {
  dom_id: string;
  format: 'pptx' | 'docx' | 'xlsx';
}

// ── PPTX DOM ──────────────────────────────────────────────────────────
export interface PptxShape {
  shape_id: string;
  shape_type: 'text_box' | 'image' | 'chart' | 'table' | 'group' | 'auto_shape' | 'smart_art';
  x_emu: number;
  y_emu: number;
  w_emu: number;
  h_emu: number;
  rotation: number;
  transform: TransformMatrix;
  z_index: number;
  text?: {
    text: string;
    font_family: string;
    font_size_pt: number;
    font_weight: number;
    font_color: ColorRGBA;
    alignment: string;
    direction: 'LTR' | 'RTL';
    paragraphs: PptxParagraph[];
  };
  image_ref?: string;
  fill?: { type: string; color?: ColorRGBA };
  stroke?: { width_emu: number; color: ColorRGBA };
  children?: PptxShape[];
}

export interface PptxParagraph {
  text: string;
  runs: PptxTextRun[];
  alignment: string;
  spacing_before_pt: number;
  spacing_after_pt: number;
}

export interface PptxTextRun {
  text: string;
  font_family: string;
  font_size_pt: number;
  font_weight: number;
  font_style: 'normal' | 'italic';
  color: ColorRGBA;
  underline: boolean;
}

export interface PptxSlide {
  slide_number: number;
  width_emu: number;
  height_emu: number;
  layout_name: string;
  shapes: PptxShape[];
  notes?: string;
  background?: { type: string; color?: ColorRGBA };
}

export interface PptxDom {
  slide_count: number;
  slides: PptxSlide[];
  slide_width_emu: number;
  slide_height_emu: number;
  master_slides: string[];
  embedded_fonts: string[];
  theme_colors: ColorRGBA[];
}

// ── DOCX DOM ──────────────────────────────────────────────────────────
export interface DocxParagraph {
  text: string;
  style: string;
  alignment: string;
  direction: 'LTR' | 'RTL';
  spacing_before_pt: number;
  spacing_after_pt: number;
  line_spacing: number;
  indent_emu: number;
  runs: DocxTextRun[];
}

export interface DocxTextRun {
  text: string;
  font_family: string;
  font_size_pt: number;
  font_weight: number;
  font_style: 'normal' | 'italic';
  color: ColorRGBA;
  underline: boolean;
  strike: boolean;
}

export interface DocxTable {
  rows: number;
  cols: number;
  cells: DocxTableCell[];
  col_widths_emu: number[];
  borders: Record<string, { width_emu: number; color: ColorRGBA }>;
}

export interface DocxTableCell {
  row: number;
  col: number;
  row_span: number;
  col_span: number;
  paragraphs: DocxParagraph[];
  shading?: ColorRGBA;
}

export interface DocxSection {
  section_index: number;
  width_emu: number;
  height_emu: number;
  margin_top_emu: number;
  margin_bottom_emu: number;
  margin_left_emu: number;
  margin_right_emu: number;
  paragraphs: DocxParagraph[];
  tables: DocxTable[];
  images: DocxImage[];
  headers: DocxParagraph[];
  footers: DocxParagraph[];
}

export interface DocxImage {
  image_ref: string;
  width_emu: number;
  height_emu: number;
  x_emu: number;
  y_emu: number;
  anchor_type: 'inline' | 'floating';
}

export interface DocxDom {
  section_count: number;
  sections: DocxSection[];
  embedded_fonts: string[];
  styles: Record<string, { font_family: string; font_size_pt: number }>;
}

// ── XLSX DOM ──────────────────────────────────────────────────────────
export interface XlsxCell {
  row: number;
  col: number;
  value: string | number | boolean | null;
  formula?: string;
  format?: string;
  font?: {
    family: string;
    size_pt: number;
    weight: number;
    color: ColorRGBA;
  };
  fill?: ColorRGBA;
  alignment?: { horizontal: string; vertical: string; wrap: boolean };
  borders?: Record<string, { style: string; color: ColorRGBA }>;
}

export interface XlsxConditionalFormat {
  range: string;
  type: 'cell_is' | 'color_scale' | 'data_bar' | 'icon_set' | 'formula';
  operator?: string;
  values?: (string | number)[];
  format_id: string;
}

export interface XlsxChart {
  chart_type: string;
  title: string;
  data_range: string;
  x_axis: { title: string; min?: number; max?: number };
  y_axis: { title: string; min?: number; max?: number };
  series: XlsxChartSeries[];
  legend_position: string;
  anchor: { from_row: number; from_col: number; to_row: number; to_col: number };
}

export interface XlsxChartSeries {
  name: string;
  values_range: string;
  categories_range: string;
  color?: ColorRGBA;
}

export interface XlsxSheet {
  name: string;
  index: number;
  rows: number;
  cols: number;
  cells: XlsxCell[];
  merged_cells: { start_row: number; start_col: number; end_row: number; end_col: number }[];
  col_widths_px: number[];
  row_heights_px: number[];
  freeze_pane?: { row: number; col: number };
  conditional_formats: XlsxConditionalFormat[];
  charts: XlsxChart[];
  auto_filters?: { range: string };
}

export interface XlsxDom {
  sheet_count: number;
  sheets: XlsxSheet[];
  defined_names: Record<string, string>;
  embedded_fonts: string[];
}

// ─── Unified Office DOM ───────────────────────────────────────────────
export type OfficeDom =
  | { format: 'pptx'; data: PptxDom }
  | { format: 'docx'; data: DocxDom }
  | { format: 'xlsx'; data: XlsxDom };

// ─── In-memory storage ───────────────────────────────────────────────
const officeDomStore = new Map<string, OfficeDom>();

export function getOfficeDom(ref: OfficeDomRef): OfficeDom | undefined {
  return officeDomStore.get(ref.dom_id);
}

// ─── PPTX Extraction ─────────────────────────────────────────────────

async function extractPptxDom(buffer: Buffer, warnings: Warning[]): Promise<PptxDom> {
  // Parse OOXML ZIP structure for PPTX
  // Extract slide dimensions, shapes, text, images from XML
  const slideXmlPattern = /ppt\/slides\/slide\d+\.xml/;

  // Attempt ZIP-based extraction using raw buffer analysis
  const slides: PptxSlide[] = [];
  const localFileHeaders = findZipEntries(buffer);
  const slideEntries = localFileHeaders.filter(e => slideXmlPattern.test(e.name)).sort((a, b) => a.name.localeCompare(b.name));

  for (let i = 0; i < slideEntries.length; i++) {
    const entry = slideEntries[i];
    const xmlContent = extractZipEntryContent(buffer, entry);
    if (xmlContent) {
      const slide = parseSlideXml(xmlContent, i + 1);
      slides.push(slide);
    }
  }

  if (slides.length === 0) {
    warnings.push({
      code: 'PPTX_NO_SLIDES',
      message: 'No slides extracted from PPTX, creating minimal DOM',
      severity: 'warning',
    });
    slides.push({
      slide_number: 1,
      width_emu: 9144000,
      height_emu: 6858000,
      layout_name: 'blank',
      shapes: [],
    });
  }

  // Extract presentation dimensions
  let slideWidth = 9144000;
  let slideHeight = 6858000;
  const presEntry = localFileHeaders.find(e => e.name === 'ppt/presentation.xml');
  if (presEntry) {
    const presXml = extractZipEntryContent(buffer, presEntry);
    if (presXml) {
      const sldSzMatch = presXml.match(/sldSz[^>]*cx="(\d+)"[^>]*cy="(\d+)"/);
      if (sldSzMatch) {
        slideWidth = parseInt(sldSzMatch[1], 10);
        slideHeight = parseInt(sldSzMatch[2], 10);
      }
    }
  }

  return {
    slide_count: slides.length,
    slides,
    slide_width_emu: slideWidth,
    slide_height_emu: slideHeight,
    master_slides: [],
    embedded_fonts: [],
    theme_colors: [],
  };
}

function parseSlideXml(xml: string, slideNumber: number): PptxSlide {
  const shapes: PptxShape[] = [];
  let zIndex = 0;

  // Parse shape elements (p:sp)
  const spPattern = /<p:sp\b[\s\S]*?<\/p:sp>/g;
  let spMatch: RegExpExecArray | null;
  while ((spMatch = spPattern.exec(xml)) !== null) {
    const spXml = spMatch[0];
    const offMatch = spXml.match(/<a:off\s+x="(\d+)"\s+y="(\d+)"/);
    const extMatch = spXml.match(/<a:ext\s+cx="(\d+)"\s+cy="(\d+)"/);
    const x = offMatch ? parseInt(offMatch[1], 10) : 0;
    const y = offMatch ? parseInt(offMatch[2], 10) : 0;
    const w = extMatch ? parseInt(extMatch[1], 10) : 0;
    const h = extMatch ? parseInt(extMatch[2], 10) : 0;

    const textMatches = spXml.match(/<a:t>([\s\S]*?)<\/a:t>/g);
    const textContent = textMatches ? textMatches.map(t => t.replace(/<\/?a:t>/g, '')).join('') : '';

    const shape: PptxShape = {
      shape_id: randomUUID(),
      shape_type: textContent ? 'text_box' : 'auto_shape',
      x_emu: x,
      y_emu: y,
      w_emu: w,
      h_emu: h,
      rotation: 0,
      transform: [1, 0, 0, 1, 0, 0],
      z_index: zIndex++,
    };

    if (textContent) {
      shape.text = {
        text: textContent,
        font_family: 'Arial',
        font_size_pt: 12,
        font_weight: 400,
        font_color: { r: 0, g: 0, b: 0, a: 255 },
        alignment: 'start',
        direction: 'LTR',
        paragraphs: [{
          text: textContent,
          runs: [{ text: textContent, font_family: 'Arial', font_size_pt: 12, font_weight: 400, font_style: 'normal' as const, color: { r: 0, g: 0, b: 0, a: 255 }, underline: false }],
          alignment: 'start',
          spacing_before_pt: 0,
          spacing_after_pt: 0,
        }],
      };
    }
    shapes.push(shape);
  }

  return {
    slide_number: slideNumber,
    width_emu: 9144000,
    height_emu: 6858000,
    layout_name: 'blank',
    shapes,
  };
}

// ─── DOCX Extraction ──────────────────────────────────────────────────

async function extractDocxDom(buffer: Buffer, warnings: Warning[]): Promise<DocxDom> {
  const localFileHeaders = findZipEntries(buffer);
  const docEntry = localFileHeaders.find(e => e.name === 'word/document.xml');

  if (docEntry) {
    const docXml = extractZipEntryContent(buffer, docEntry);
    if (docXml) {
      const paragraphs = parseDocxParagraphs(docXml);
      return {
        section_count: 1,
        sections: [{
          section_index: 0,
          width_emu: 7772400,
          height_emu: 10058400,
          margin_top_emu: 914400,
          margin_bottom_emu: 914400,
          margin_left_emu: 914400,
          margin_right_emu: 914400,
          paragraphs,
          tables: [],
          images: [],
          headers: [],
          footers: [],
        }],
        embedded_fonts: [],
        styles: {},
      };
    }
  }

  warnings.push({ code: 'DOCX_NO_CONTENT', message: 'Could not extract document.xml from DOCX', severity: 'warning' });
  return {
    section_count: 1,
    sections: [{ section_index: 0, width_emu: 7772400, height_emu: 10058400, margin_top_emu: 914400, margin_bottom_emu: 914400, margin_left_emu: 914400, margin_right_emu: 914400, paragraphs: [], tables: [], images: [], headers: [], footers: [] }],
    embedded_fonts: [],
    styles: {},
  };
}

function parseDocxParagraphs(xml: string): DocxParagraph[] {
  const paragraphs: DocxParagraph[] = [];
  const paraPattern = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let paraMatch: RegExpExecArray | null;

  while ((paraMatch = paraPattern.exec(xml)) !== null) {
    const paraXml = paraMatch[0];
    const textMatches = paraXml.match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g);
    const text = textMatches ? textMatches.map(t => t.replace(/<w:t[^>]*>|<\/w:t>/g, '')).join('') : '';
    if (text.trim()) {
      paragraphs.push({
        text, style: 'Normal', alignment: 'start', direction: 'LTR', spacing_before_pt: 0, spacing_after_pt: 0, line_spacing: 1.15, indent_emu: 0,
        runs: [{ text, font_family: 'Calibri', font_size_pt: 11, font_weight: 400, font_style: 'normal', color: { r: 0, g: 0, b: 0, a: 255 }, underline: false, strike: false }],
      });
    }
  }
  return paragraphs;
}

// ─── XLSX Extraction ──────────────────────────────────────────────────

async function extractXlsxDom(buffer: Buffer, warnings: Warning[]): Promise<XlsxDom> {
  const localFileHeaders = findZipEntries(buffer);
  const sheetEntries = localFileHeaders.filter(e => /xl\/worksheets\/sheet\d+\.xml/.test(e.name)).sort((a, b) => a.name.localeCompare(b.name));

  const sheets: XlsxSheet[] = [];
  for (let i = 0; i < sheetEntries.length; i++) {
    const content = extractZipEntryContent(buffer, sheetEntries[i]);
    if (content) {
      sheets.push(parseSheetXml(content, `Sheet${i + 1}`, i));
    }
  }

  if (sheets.length === 0) {
    warnings.push({ code: 'XLSX_NO_SHEETS', message: 'No sheets extracted from XLSX', severity: 'warning' });
    sheets.push({ name: 'Sheet1', index: 0, rows: 0, cols: 0, cells: [], merged_cells: [], col_widths_px: [], row_heights_px: [], conditional_formats: [], charts: [] });
  }

  return { sheet_count: sheets.length, sheets, defined_names: {}, embedded_fonts: [] };
}

function parseSheetXml(xml: string, name: string, index: number): XlsxSheet {
  const cells: XlsxCell[] = [];
  let maxRow = 0;
  let maxCol = 0;

  const cellPattern = /<c\s+r="([A-Z]+)(\d+)"[^>]*>([\s\S]*?)<\/c>/g;
  let cellMatch: RegExpExecArray | null;
  while ((cellMatch = cellPattern.exec(xml)) !== null) {
    const col = colStringToNumber(cellMatch[1]);
    const row = parseInt(cellMatch[2], 10);
    maxRow = Math.max(maxRow, row);
    maxCol = Math.max(maxCol, col);
    const valueMatch = cellMatch[3].match(/<v>([\s\S]*?)<\/v>/);
    const formulaMatch = cellMatch[3].match(/<f>([\s\S]*?)<\/f>/);
    const rawVal = valueMatch ? valueMatch[1] : null;
    cells.push({
      row: row - 1,
      col: col - 1,
      value: rawVal !== null ? (isNaN(Number(rawVal)) ? rawVal : Number(rawVal)) : null,
      formula: formulaMatch ? formulaMatch[1] : undefined,
    });
  }

  let freezePane: { row: number; col: number } | undefined;
  const freezeMatch = xml.match(/<pane[^>]*ySplit="(\d+)"[^>]*xSplit="(\d+)"/);
  if (freezeMatch) freezePane = { row: parseInt(freezeMatch[1], 10), col: parseInt(freezeMatch[2], 10) };

  const mergedCells: XlsxSheet['merged_cells'] = [];
  const mergePattern = /<mergeCell\s+ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"\/>/g;
  let mergeMatch: RegExpExecArray | null;
  while ((mergeMatch = mergePattern.exec(xml)) !== null) {
    mergedCells.push({ start_row: parseInt(mergeMatch[2], 10) - 1, start_col: colStringToNumber(mergeMatch[1]) - 1, end_row: parseInt(mergeMatch[4], 10) - 1, end_col: colStringToNumber(mergeMatch[3]) - 1 });
  }

  return { name, index, rows: maxRow, cols: maxCol, cells, merged_cells: mergedCells, col_widths_px: [], row_heights_px: [], freeze_pane: freezePane, conditional_formats: [], charts: [] };
}

function colStringToNumber(col: string): number {
  let result = 0;
  for (let i = 0; i < col.length; i++) result = result * 26 + (col.charCodeAt(i) - 64);
  return result;
}

// ─── ZIP Parser (Minimal deterministic) ───────────────────────────────

interface ZipEntry {
  name: string;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number;
  dataOffset: number;
}

function findZipEntries(buffer: Buffer): ZipEntry[] {
  const entries: ZipEntry[] = [];
  let offset = 0;

  while (offset < buffer.length - 4) {
    // Local file header signature: PK\x03\x04
    if (buffer[offset] === 0x50 && buffer[offset + 1] === 0x4B && buffer[offset + 2] === 0x03 && buffer[offset + 3] === 0x04) {
      const compressionMethod = buffer.readUInt16LE(offset + 8);
      const compressedSize = buffer.readUInt32LE(offset + 18);
      const uncompressedSize = buffer.readUInt32LE(offset + 22);
      const nameLength = buffer.readUInt16LE(offset + 26);
      const extraLength = buffer.readUInt16LE(offset + 28);
      const name = buffer.subarray(offset + 30, offset + 30 + nameLength).toString('utf8');
      const dataOffset = offset + 30 + nameLength + extraLength;

      entries.push({ name, compressedSize, uncompressedSize, compressionMethod, dataOffset });
      offset = dataOffset + compressedSize;
    } else {
      offset++;
    }
  }

  return entries;
}

function extractZipEntryContent(buffer: Buffer, entry: ZipEntry): string | null {
  if (entry.compressionMethod === 0) {
    // Stored (no compression)
    return buffer.subarray(entry.dataOffset, entry.dataOffset + entry.uncompressedSize).toString('utf8');
  }

  if (entry.compressionMethod === 8) {
    // Deflated — use zlib
    try {
      const zlib = require('zlib') as typeof import('zlib');
      const compressed = buffer.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize);
      const decompressed = zlib.inflateRawSync(compressed);
      return decompressed.toString('utf8');
    } catch {
      return null;
    }
  }

  return null;
}

// ─── Tool Handlers ────────────────────────────────────────────────────

export async function handleExtractPptxDom(
  request: ToolRequest<{ office_asset: AssetRef }, Record<string, unknown>>
): Promise<ToolResponse<{ office_dom: OfficeDomRef }>> {
  const { office_asset } = request.inputs;
  const warnings: Warning[] = [];
  try {
    const buffer = await readFile(office_asset.uri);
    const pptxDom = await extractPptxDom(buffer, warnings);
    const domId = randomUUID();
    officeDomStore.set(domId, { format: 'pptx', data: pptxDom });
    return { request_id: request.request_id, tool_id: 'extract.office_pptx', status: 'ok', refs: { office_dom: { dom_id: domId, format: 'pptx' } }, warnings };
  } catch (error) {
    return { request_id: request.request_id, tool_id: 'extract.office_pptx', status: 'failed', refs: { office_dom: { dom_id: '', format: 'pptx' } }, warnings: [{ code: 'PPTX_EXTRACT_FAILED', message: error instanceof Error ? error.message : String(error), severity: 'error' }] };
  }
}

export async function handleExtractDocxDom(
  request: ToolRequest<{ office_asset: AssetRef }, Record<string, unknown>>
): Promise<ToolResponse<{ office_dom: OfficeDomRef }>> {
  const { office_asset } = request.inputs;
  const warnings: Warning[] = [];
  try {
    const buffer = await readFile(office_asset.uri);
    const docxDom = await extractDocxDom(buffer, warnings);
    const domId = randomUUID();
    officeDomStore.set(domId, { format: 'docx', data: docxDom });
    return { request_id: request.request_id, tool_id: 'extract.office_docx', status: 'ok', refs: { office_dom: { dom_id: domId, format: 'docx' } }, warnings };
  } catch (error) {
    return { request_id: request.request_id, tool_id: 'extract.office_docx', status: 'failed', refs: { office_dom: { dom_id: '', format: 'docx' } }, warnings: [{ code: 'DOCX_EXTRACT_FAILED', message: error instanceof Error ? error.message : String(error), severity: 'error' }] };
  }
}

export async function handleExtractXlsxDom(
  request: ToolRequest<{ office_asset: AssetRef }, Record<string, unknown>>
): Promise<ToolResponse<{ office_dom: OfficeDomRef }>> {
  const { office_asset } = request.inputs;
  const warnings: Warning[] = [];
  try {
    const buffer = await readFile(office_asset.uri);
    const xlsxDom = await extractXlsxDom(buffer, warnings);
    const domId = randomUUID();
    officeDomStore.set(domId, { format: 'xlsx', data: xlsxDom });
    return { request_id: request.request_id, tool_id: 'extract.office_xlsx', status: 'ok', refs: { office_dom: { dom_id: domId, format: 'xlsx' } }, warnings };
  } catch (error) {
    return { request_id: request.request_id, tool_id: 'extract.office_xlsx', status: 'failed', refs: { office_dom: { dom_id: '', format: 'xlsx' } }, warnings: [{ code: 'XLSX_EXTRACT_FAILED', message: error instanceof Error ? error.message : String(error), severity: 'error' }] };
  }
}
