# Engine E05: Reporting Engine — Programmatic Specification

## 1. Overview

## 2. Data Models & Interfaces

## 3. Implemented Features (Reference Only)

## 4. Execution Phases

## 5. Coverage Matrix

## 1. Overview
The E05 Reporting Engine provides an integrated system for generating high-quality, professional reports with advanced support for the Arabic language (Arabic ELITE). It is designed to meet strict governance requirements in government and commercial environments. The engine transforms diverse inputs (text, data, files) into fully editable DOCX documents, with export capabilities to PDF and HTML formats. A key feature is its ability to integrate with various data sources to create data-bound content. The engine supports multiple templates that define both design and writing style. A core principle is the prevention of data fabrication or unsubstantiated claims; the engine MUST produce an "Evidence Pack" with every exported report to ensure transparency and reliability. It operates within a Single Canvas UI to simplify the user experience and follows a Progressive Controls approach to display only context-relevant options, preventing user overload. This document is the sole source of truth for the engine's implementation; any behavior not specified herein is strictly prohibited.

## 2. Data Models & Interfaces
This section defines the core data structures for the Document Intermediate Representation (DOC-IR), which serves as the standardized model for report construction, validation, and export.

```typescript
// ========== ROOT: Document IR ==========

/**
 * The top-level structure for the Document Intermediate Representation (DOC-IR).
 * It encapsulates all metadata, content, and configuration for a single report.
 * E05-0075
 */
interface DocIr {
    /** E05-0076 */
    locale: 'en-US' | 'ar-SA' | 'mixed';
    /** E05-0076 */
    arabic_mode: 'ARABIC_ELITE';

    /** E05-0077 */
    page_setup: PageSetup;

    /** E05-0078 */
    template_refs: {
        brand_kit_id: string;
        report_template_id: string;
        writing_template_id: string;
    };

    /** E05-0079 */
    sections: Section[];

    /** E05-0080 */
    global_fields: {
        report_title: string;
        creation_date: ISO8601Date;
        author: string;
        classification: 'public' | 'internal' | 'confidential' | 'restricted';
        recipients: Recipient[];
    };

    /** E05-0081 */
    references?: Reference[];

    /** E05-0082 */
    data_bindings: DataBinding[];

    /** E05-0083 */
    fingerprints: {
        layout_hash: SHA256Hash;
        style_hash: SHA256Hash;
        writing_hash: SHA256Hash;
        binding_hash: SHA256Hash;
    };
}

// ========== DOCUMENT CONFIGURATION ==========

/** E05-0077 */
interface PageSetup {
    paper_size: 'A4' | 'Letter' | 'Legal';
    margins: {
        top: string; // e.g., "2.54cm"
        bottom: string;
        left: string;
        right: string;
    };
    orientation: 'portrait' | 'landscape';
    is_rtl: boolean;
}

/** E05-0066, E05-0067, E05-0068, E05-0069 */
interface Recipient {
    title: 'H.E.' | 'Mr.' | 'Ms.' | 'Dr.' | 'CEO' | 'معالي' | 'سعادة' | 'الأستاذ' | 'الأستاذة';
    name?: string;
    organization_name: string;
    department?: string;
}

/** E05-0081 */
interface Reference {
    id: string; // e.g., "ref-001"
    citation_key: string; // e.g., "[1]"
    full_text: string;
}

// ========== SECTIONS & BLOCKS ==========

/**
 * Represents a major division of the report.
 * E05-0084, E05-0085, E05-0086, E05-0087, E05-0088
 */
interface Section {
    section_id: UUID;
    index: number;
    title: string;
    kind: 'cover' | 'toc' | 'executive_summary' | 'body' | 'findings' | 'recommendations' | 'appendix' | 'glossary' | 'references' | 'signoff';
    blocks: Block[];
    header_footer_overrides?: {
        header_id?: string;
        footer_id?: string;
    };
    numbering_scheme?: string; // e.g., "1.1, 1.2, ..."
}

/**
 * The fundamental unit of content in a report, represented as a union type.
 * E05-0089, E05-0090, E05-0091, E05-0092
 */
type Block = 
    | HeadingBlock
    | ParagraphBlock
    | BulletListBlock
    | TableBlock
    | ChartBlock
    | KpiCardsBlock
    | FigureBlock
    | CalloutBlock
    | QuoteBlock
    | CodeBlock
    | AppendixTableBlock
    | SignatureBlock
    | PageBreakBlock;

interface BaseBlock {
    block_id: UUID;
    style_ref: string; // ID of a style from the Report Template
    rtl_policy: 'auto' | 'force_rtl';
    data_binding_ref?: string; // ID of a DataBinding
}

interface HeadingBlock extends BaseBlock {
    kind: 'heading';
    content: {
        level: 1 | 2 | 3 | 4 | 5 | 6;
        text: string;
    };
}

interface ParagraphBlock extends BaseBlock {
    kind: 'paragraph';
    content: {
        text: string; // Can contain inline formatting markers
    };
}

interface BulletListBlock extends BaseBlock {
    kind: 'bullets';
    content: {
        items: string[];
    };
}

// ... other block types would be defined here similarly ...

// ========== DATA & TEMPLATES ==========

/** E05-0082 */
interface DataBinding {
    binding_id: string;
    source_id: string; // e.g., dataset UUID
    transform_ir: any; // T-IR representation
    measures_ir: any;  // M-IR representation
}

/** E05-0050 */
interface BrandKit {
    kit_id: UUID;
    name: string;
    colors: { [key: string]: HexColor; }; // e.g., { "primary": "#003366" }
    fonts: { [key: string]: string; }; // e.g., { "body": "Sultan" }
    logo_url: string;
    default_margins: PageSetup['margins'];
}

/** E05-0051 */
interface ReportTemplate {
    template_id: UUID;
    name: string;
    layout: any; // Defines structure, headers, footers
    styles: any[]; // Array of style definitions (e.g., for Heading 1, Body, etc.)
    numbering_schemes: any;
    toc_style: any;
}

/** E05-0052 */
interface WritingTemplate {
    template_id: UUID;
    name: string;
    tone: 'formal' | 'neutral' | 'persuasive' | 'urgent';
    terminology: { [key: string]: string; }; // e.g., { "customer": "client" }
    salutations: any; // Rules for greetings/closings
    recommendation_phrasing: string;
}

type ISO8601Date = string;
type UUID = string;
type SHA256Hash = string;
type HexColor = string;

```

## 3. Implemented Features (Reference Only)
*No features are currently implemented. All requirements will be fulfilled according to the execution plan below.*


### Phase 1: Build the Document Intermediate Representation (DOC-IR)

#### Task 1.1: Design and Implement the Core DOC-IR Structure
**Requirements:**
- `E05-0075`: The executor MUST build a DOC-IR to standardize construction, validation, and export, preventing ad-hoc implementations.
- `E05-0076`: The DOC-IR MUST include `locale` and `arabic_mode` fields.
- `E05-0077`: The DOC-IR MUST include a `page_setup` object with paper size, margins, and RTL settings.
- `E05-0078`: The DOC-IR MUST include `template_refs` for brand, report, and writing templates.
- `E05-0079`: The DOC-IR MUST include an ordered `sections` array.
- `E05-0080`: The DOC-IR MUST include `global_fields` for date, author, classification, and recipients.
- `E05-0081`: The DOC-IR MAY include an optional `references` array.
- `E05-0082`: The DOC-IR MUST include `data_bindings` for tables, charts, and KPIs.
- `E05-0083`: The DOC-IR MUST include `fingerprints` for layout, style, writing, and binding hashes.

**Implementation Contract:**
```typescript
/**
 * @see DocIr interface in Section 2.
 */
function createDocIr(baseConfig: Partial<DocIr>): DocIr;

/**
 * Validates a DocIr object against the official JSON Schema.
 * @returns {{ valid: boolean; errors: string[] }}
 */
function validateDocIr(doc: DocIr): { valid: boolean; errors: string[] };

/**
 * Calculates the SHA256 hash of a given component (layout, style, etc.).
 * @returns {SHA256Hash}
 */
function computeFingerprint(component: any): SHA256Hash;
```

**Acceptance Criteria:**
- [ ] A valid JSON Schema for the `DocIr` is published and accessible.
- [ ] The `createDocIr` function correctly initializes a `DocIr` object with default values.
- [ ] The `validateDocIr` function returns `valid: true` for compliant objects and provides detailed errors for non-compliant ones.
- [ ] `computeFingerprint` function is implemented and produces a verifiable SHA256 hash for each component.

#### Task 1.2: Define Section and Block Components
**Requirements:**
- `E05-0084`: A `Section` MUST have a `section_id`, `index`, and `title`.
- `E05-0085`: A `Section` `kind` MUST be one of the enumerated types (e.g., `cover`, `toc`, `body`).
- `E05-0086`: A `Section` MUST contain an ordered `blocks` array.
- `E05-0087`: A `Section` MAY have optional `header/footer overrides`.
- `E05-0088`: A `Section` MAY have an optional `numbering_scheme`.
- `E05-0089`: A `Block` `kind` MUST be one of the enumerated union types (e.g., `heading`, `paragraph`, `table`).
- `E05-0090`: A `Block` MUST have typed `content` specific to its kind.
- `E05-0091`: A `Block` MAY have an optional `data_binding_ref`.
- `E05-0092`: A `Block` MUST have an `rtl_policy` of either `auto` or `force_rtl`.

**Implementation Contract:**
```typescript
/**
 * @see Section and Block types in Section 2.
 */

/**
 * Creates a new Section.
 * @returns {Section}
 */
function createSection(kind: Section['kind'], title: string): Section;

/**
 * Creates a new Block of a specific kind.
 * @returns {Block}
 */
function createBlock<T extends Block>(kind: T['kind'], content: T['content']): T;
```

**Acceptance Criteria:**
- [ ] The JSON Schema is extended to include definitions and constraints for `Section` and all `Block` types.
- [ ] The `createSection` and `createBlock` factory functions produce valid objects according to the schema.
- [ ] The order of blocks within a section is strictly maintained through all operations.
- [ ] The system correctly applies `header/footer overrides` and `numbering_scheme` during document generation.

### Phase 2: Develop the User Interface and Experience

#### Task 2.1: Build the Main Editing Interface (Report Canvas & Side Panel)
**Requirements:**
- `E05-0012`: The UI MUST consist of a single `Report Canvas` for creation/editing and a single, collapsible `Side Panel`. Multiple pages or windows are forbidden.
- `E05-0020`: The `Report Canvas` MUST be a document editor that includes an `Outline Navigator` and supports block-based content.
- `E05-0021`: The single, collapsible `Side Panel` MUST contain tabs or sections for: Library, Styles & Templates, Data Picker, Blocks, Citations & References, Governance, Export, and History/Versions.

**Implementation Contract:**
```typescript
// High-level component definitions (e.g., in React)

interface ReportCanvasProps {
  docIr: DocIr;
  onDocIrChange: (newDocIr: DocIr) => void;
}

interface SidePanelProps {
  docIr: DocIr;
  activeTab: SidePanelTab;
  onTabChange: (newTab: SidePanelTab) => void;
}

type SidePanelTab = 'library' | 'styles' | 'data' | 'blocks' | 'citations' | 'governance' | 'export' | 'history';
```

**Acceptance Criteria:**
- [ ] The main application view renders a `ReportCanvas` and a `SidePanel`.
- [ ] The `SidePanel` can be collapsed and expanded.
- [ ] The `Outline Navigator` within the `ReportCanvas` accurately reflects the document's section and heading structure in a tree view.
- [ ] Clicking an item in the `Outline Navigator` scrolls the corresponding element in the `ReportCanvas` into view.
- [ ] All sub-modules listed in `E05-0021` are accessible within the `SidePanel`.

#### Task 2.2: Implement Progressive Controls Mechanism
**Requirements:**
- `E05-0022`: The UI MUST NOT display a large number of options at once.
- `E05-0023`: The UI MUST display a limited set of 5-9 context-sensitive controls based on the current selection (e.g., report-level, section, or element controls).
- `E05-0024`: The UI MUST provide a "Search Controls" feature to find any option, avoiding large menus.

**Implementation Contract:**
```typescript
/**
 * A service that tracks the currently selected element in the UI.
 */
class ContextManager {
  private currentSelection: { type: 'report' | 'section' | 'block'; id: string; };

  getSelection(): typeof this.currentSelection;
  setSelection(type: 'report' | 'section' | 'block', id: string): void;
}

/**
 * A function that returns the appropriate control panel component
 * based on the current context.
 */
function getContextualControls(selection: ContextManager['currentSelection']): React.ComponentType;
```

**Acceptance Criteria:**
- [ ] The `ContextManager` correctly identifies the selected element in the `ReportCanvas`.
- [ ] The `SidePanel` dynamically renders different control panels when the user selects the report root, a section, a paragraph, or a table.
- [ ] Each contextual control panel displays only the 5-9 most relevant options.
- [ ] A search bar is present in the `SidePanel` and allows users to find and activate any control/option by name.

#### Task 2.3: Ensure Instant Previews and Prevent UI Freezing
**Requirements:**
- `E05-0025`: Any significant modification MUST produce a quick layout preview within the canvas and a full "Reader" preview (PDF/HTML) on demand.
- `E05-0026`: The UI MUST NOT freeze. Any heavy rendering process MUST be executed as a background job.

**Implementation Contract:**
```typescript
/**
 * A client-side function for generating a fast, low-fidelity preview.
 */
function renderQuickPreview(docIr: DocIr): void; // Renders directly into a canvas element

/**
 * An API endpoint (tRPC procedure) to request a high-fidelity render.
 * @returns {{ jobId: string }}
 */
async function requestFullPreview(docIr: DocIr, format: 'pdf' | 'html'): Promise<{ jobId: string }>;

/**
 * An API endpoint to check the status of a background render job.
 * @returns {{ status: 'pending' | 'completed' | 'failed'; url?: string }}
 */
async function getJobStatus(jobId: string): Promise<{ status: 'pending' | 'completed' | 'failed'; url?: string }>;
```

**Acceptance Criteria:**
- [ ] Changes to styles and layout in the `SidePanel` are reflected in the `ReportCanvas` in under 200ms.
- [ ] Clicking the "Full Preview" button triggers the `requestFullPreview` procedure and displays a loading indicator.
- [ ] The UI remains fully responsive and interactive while a full preview is being generated.
- [ ] When the background job is complete, the generated PDF or HTML is displayed in a modal overlay.

### Phase 3: Core Generation Logic and Content Styles

#### Task 3.1: Implement AUTO and CONTROLLED Generation Flows
**Requirements:**
- `E05-0027`: In `AUTO` mode, the engine MUST generate a full report from a single prompt, optionally with data sources.
- `E05-0028`: The generation pipeline MUST follow the sequence: Intent Manifest → Outline → Narrative Plan → Data Bindings → DOCX Build → QA → Export/Evidence.
- `E05-0029`: The `AUTO` mode MUST operate without asking follow-up questions.
- `E05-0030`: In `CONTROLLED` mode, the user MUST be able to adjust a set of "knobs" in the `Side Panel` before execution.
- `E05-0031` - `E05-0039`: The configurable knobs MUST include `report_type`, `language`, `tone`, `fidelity_mode`, `template_id`, `add_sections`, `citation_mode`, `sensitivity_classification`, and `export_targets`.
- `E05-0040`: After configuration, the generation MUST be triggered by a single run command.

**Implementation Contract:**
```typescript
/**
 * The main orchestrator for the AUTO generation flow.
 */
async function runAutoPipeline(prompt: string, dataSources: DataSource[]): Promise<DocIr>;

/**
 * The main orchestrator for the CONTROLLED generation flow.
 */
async function runControlledPipeline(params: ControlledRunParams): Promise<DocIr>;

interface ControlledRunParams {
    prompt: string;
    dataSources: DataSource[];
    /** E05-0031 */
    report_type: 'executive' | 'technical' | 'audit' | 'government_memo';
    /** E05-0032 */
    language: 'ar' | 'en' | 'mixed';
    /** E05-0033 */
    tone: 'formal' | 'neutral' | 'persuasive' | 'urgent';
    /** E05-0034 */
    fidelity_mode: 'literal_1to1' | 'smart';
    /** E05-0035 */
    template_id: UUID;
    /** E05-0036 */
    add_sections: ('toc' | 'executive_summary' | 'findings' | 'recommendations' | 'appendix')[];
    /** E05-0037 */
    citation_mode: 'off' | 'on';
    citation_style?: 'APA' | 'MLA' | 'Chicago';
    /** E05-0038 */
    sensitivity_classification: 'public' | 'internal' | 'confidential' | 'restricted';
    /** E05-0039 */
    export_targets: ('docx' | 'pdf' | 'html' | 'pptx')[];
}
```

**Acceptance Criteria:**
- [ ] The `runAutoPipeline` function executes the full chain specified in `E05-0028` and produces a valid `DocIr` object.
- [ ] The `Side Panel` contains a form with all the knobs defined in `ControlledRunParams`.
- [ ] The `runControlledPipeline` function correctly uses the user-provided parameters to influence the generation process.
- [ ] Both pipelines execute without any interactive prompts.

#### Task 3.2: Implement Content Fidelity Modes (LITERAL and SMART)
**Requirements:**
- `E05-0041`: `MODE_LITERAL_1TO1` MUST include the user's text verbatim, with no additions, deletions, rephrasing, or auto-corrections.
- `E05-0042`: `MODE_LITERAL_1TO1` MUST preserve all line and paragraph breaks from the source.
- `E05-0043`: In `MODE_LITERAL_1TO1`, pagination MUST only be achieved via page or section breaks, without altering the text.
- `E05-0044`: The engine MUST produce a `literal_hash_in` (from the input) and a `literal_hash_out` (from the generated DOCX text).
- `E05-0045`: The process MUST fail if `literal_hash_in` does not equal `literal_hash_out`.
- `E05-0046`: `MODE_SMART` MUST analyze the request, data, objective, and audience.
- `E05-0047`: `MODE_SMART` MUST write professional content that adheres to the selected `tone` and `Writing Template` style.
- `E05-0048`: `MODE_SMART` MUST NOT fabricate facts. If a required data point is unavailable, it MUST insert a tagged placeholder (e.g., "[DATA REQUIRED: Quarterly Revenue]").
- `E05-0049`: `MODE_SMART` MUST produce a "Content Trace" that links every claim or number to its source (e.g., dataset, table, column, or a specific paragraph in a library document).

**Implementation Contract:**
```typescript
/**
 * Processor for the LITERAL fidelity mode.
 * @returns {{ content: string; literal_hash_out: SHA256Hash }}
 * @throws If hash mismatch occurs.
 */
function processLiteralMode(text: string): { content: string; literal_hash_out: SHA256Hash };

/**
 * Processor for the SMART fidelity mode.
 * @returns {{ content: string; contentTrace: ContentTrace[] }}
 */
async function processSmartMode(prompt: string, context: SmartModeContext): Promise<{ content: string; contentTrace: ContentTrace[] }>;

interface SmartModeContext {
    dataSources: any[];
    writingTemplate: WritingTemplate;
    tone: ControlledRunParams['tone'];
    audience: Recipient[];
}

interface ContentTrace {
    claim: string; // The generated statement or data point
    source: {
        type: 'dataset' | 'document';
        id: UUID;
        location: string; // e.g., "table:sales,column:revenue,row:4" or "paragraph:12"
    };
}
```

**Acceptance Criteria:**
- [ ] In `LITERAL` mode, the text content of the final DOCX is byte-for-byte identical to the input text.
- [ ] The `processLiteralMode` function throws an error if the input and output hashes do not match.
- [ ] In `SMART` mode, the generated text style matches the specified `tone` and `Writing Template`.
- [ ] The `processSmartMode` function inserts clearly marked placeholders for any missing information and does not generate fake data.
- [ ] The `ContentTrace` array is correctly populated, linking generated content back to its precise source.

### Phase 4: Template and Styling Management

#### Task 4.1: Define and Manage Template Types
**Requirements:**
- `E05-0050`: The system MUST support **Brand Kit** templates for colors, fonts, logos, and margins.
- `E05-0051`: The system MUST support **Report Template** templates for layout, styles, numbering, headers/footers, and TOC style.
- `E05-0052`: The system MUST support **Writing Template** templates for tone, style, terminology, salutations, openings, closings, and phrasing of recommendations.

**Implementation Contract:**
```typescript
/**
 * @see BrandKit, ReportTemplate, WritingTemplate interfaces in Section 2.
 */

// API endpoints (tRPC procedures) for template management

async function createTemplate(type: 'brand' | 'report' | 'writing', data: any): Promise<{ templateId: UUID }>;
async function getTemplate(templateId: UUID): Promise<any>;
async function updateTemplate(templateId: UUID, data: any): Promise<{ success: boolean }>;
async function deleteTemplate(templateId: UUID): Promise<{ success: boolean }>;
```

**Acceptance Criteria:**
- [ ] The data models for `BrandKit`, `ReportTemplate`, and `WritingTemplate` are finalized and enforced by the database schema.
- [ ] CRUD (Create, Read, Update, Delete) APIs for all three template types are implemented and functional.
- [ ] A UI is available in the `Side Panel` for users to manage all templates.

#### Task 4.2: Extract Templates from DOCX Documents
**Requirements:**
- `E05-0053`: The system MUST be able to extract a template from an uploaded DOCX file.
- `E05-0054`: The extraction MUST capture styles (Heading 1-n, Body, Caption, Table styles).
- `E05-0055`: The extraction MUST capture numbering and bullet schemes.
- `E05-0056`: The extraction MUST capture page setup (margins, paper size, RTL).
- `E05-0057`: The extraction MUST capture headers and footers, including their rules (e.g., different for first page).
- `E05-0058`: The extraction MUST capture the TOC configuration.
- `E05-0059`: The extraction MUST capture the cover page structure.
- `E05-0060`: The extraction MUST infer a `Writing Ruleset` (greeting patterns, tone lexicon, etc.) from the document's content.

**Implementation Contract:**
```typescript
/**
 * An API endpoint that accepts a DOCX file and returns a set of extracted template objects.
 * @param file A DOCX file buffer.
 * @returns {{ brandKit: Partial<BrandKit>, reportTemplate: Partial<ReportTemplate>, writingTemplate: Partial<WritingTemplate> }}
 */
async function extractTemplatesFromDocx(file: Buffer): Promise<{ 
    brandKit: Partial<BrandKit>;
    reportTemplate: Partial<ReportTemplate>;
    writingTemplate: Partial<WritingTemplate>;
}>;
```

**Acceptance Criteria:**
- [ ] The `extractTemplatesFromDocx` function correctly parses a DOCX file and extracts all specified style and layout information into the corresponding template data structures.
- [ ] The `Writing Ruleset` extractor can identify common patterns for greetings, closings, and terminology.
- [ ] The extracted templates can be saved and used for generating new reports.

#### Task 4.3: Implement Template-Lock
**Requirements:**
- `E05-0061`: The user MUST be able to enable a `template-lock` option for a report.
- `E05-0062`: When `template-lock` is active, the engine MUST strictly adhere to the styles and writing rules of the applied templates.
- `E05-0063`: When `template-lock` is active, the engine MUST NOT introduce any new style that is not present in the template.
- `E05-0064`: The `Evidence Pack` MUST include a `Template Compliance Report` detailing adherence to the locked template.

**Implementation Contract:**
```typescript
/**
 * A validation function run during the generation pipeline.
 * @throws If a style or rule violation is detected.
 */
function enforceTemplateLock(docIr: DocIr, reportTemplate: ReportTemplate, writingTemplate: WritingTemplate): void;

/**
 * Generates the compliance report.
 * @returns {ComplianceReport}
 */
function generateComplianceReport(docIr: DocIr, reportTemplate: ReportTemplate): ComplianceReport;

interface ComplianceReport {
    is_compliant: boolean;
    violations: {
        type: 'style' | 'writing_rule';
        description: string;
    }[];
}
```

**Acceptance Criteria:**
- [ ] A `template-lock` toggle is available in the report settings UI.
- [ ] When enabled, any attempt to apply a non-template style or deviate from a writing rule during generation results in a failure with a clear error message.
- [ ] The `generateComplianceReport` function is executed as part of the export process, and its output is included in the `Evidence Pack`.

#### Task 4.4: Customize Content for Audience and Recipient
**Requirements:**
- `E05-0065` - `E05-0071`: The engine MUST support recipient details including `recipient_title`, `organization_name`, `department`, `tone_profile`, and `formality_level`.
- `E05-0072`: The engine MUST automatically select appropriate openings and closings based on language, tone, writing template, and organizational context (government/commercial).
- `E05-0073`: The engine MUST NOT use culturally inappropriate phrases in Arabic.
- `E05-0074`: The engine MUST allow saving "writing signature blocks" as reusable templates.

**Implementation Contract:**
```typescript
/**
 * A rule engine for selecting the correct salutation and closing.
 */
function getSalutation(context: SalutationContext): string;

interface SalutationContext {
    language: 'ar' | 'en';
    tone: 'formal' | 'neutral';
    recipient: Recipient;
    writingTemplate: WritingTemplate;
    organizationalContext: 'government' | 'commercial';
}

/**
 * API for managing reusable signature blocks.
 */
async function saveSignatureBlock(name: string, content: string): Promise<{ blockId: UUID }>;
async function getSignatureBlock(blockId: UUID): Promise<{ name: string; content: string }>;
```

**Acceptance Criteria:**
- [ ] The `getSalutation` function correctly resolves to the appropriate greeting (e.g., "Dear Mr. Smith," vs. "سعادة الأستاذ/ فلان").
- [ ] A curated and tested list of culturally appropriate Arabic phrases is used.
- [ ] Users can save, manage, and insert pre-defined signature blocks into their reports.

### Phase 5: Data-Bound Blocks

#### Task 5.1: Implement the Data Picker UI
**Requirements:**
- `E05-0093`: The user MUST be able to select a dataset, table, and columns.
- `E05-0094`: The user MUST be able to define filters, joins, and transforms (T-IR).
- `E05-0095`: The user MUST be able to select measures (M-IR).
- `E05-0096`: The user MUST be able to preview a sample of the data before inserting a block.

**Implementation Contract:**
```typescript
// UI component for the Data Picker
interface DataPickerProps {
  onDataBindingSelect: (binding: DataBinding) => void;
}

// API to get data schema
async function getDatasetSchema(datasetId: string): Promise<any>;

// API to get data preview
async function getDataPreview(binding: Partial<DataBinding>): Promise<any[]>;
```

**Acceptance Criteria:**
- [ ] The Data Picker UI allows users to browse and select from available datasets.
- [ ] The user can construct a data query visually (selecting columns, applying filters).
- [ ] A preview of the data is shown in the UI before the block is created.

#### Task 5.2: Implement Data-Bound Blocks
**Requirements:**
- `E05-0098`: A `Table` block MUST be a structured table in the DOCX with a `TableStyle`, support column selection/ordering, and limited, declared conditional formatting.
- `E05-0099`: A `Chart` block MUST be embedded as a vector chart or with an embedded data workbook, and MUST reflect the current filtered dataset.
- `E05-0100`: `KPI cards` MUST display a measure, a threshold, and a trend indicator.

**Implementation Contract:**
```typescript
// Functions to create data-bound blocks
function createTableBlock(binding: DataBinding, options: TableOptions): TableBlock;
function createChartBlock(binding: DataBinding, options: ChartOptions): ChartBlock;
function createKpiCardsBlock(binding: DataBinding, options: KpiOptions): KpiCardsBlock;
```

**Acceptance Criteria:**
- [ ] Table blocks are rendered correctly in the DOCX with the specified data and styles.
- [ ] Chart blocks are generated and embedded correctly, reflecting the data from the `DataBinding`.
- [ ] KPI cards are rendered with the correct measure, threshold, and trend.

#### Task 5.3: Implement Data Refresh
**Requirements:**
- `E05-0101`: When data or recipes are updated, the report MUST be refreshed, a new version MUST be created, and the refresh lineage MUST be recorded.

**Implementation Contract:**
```typescript
// API to trigger a data refresh for a report
async function refreshReportData(reportId: string): Promise<{ newVersionId: string }>;
```

**Acceptance Criteria:**
- [ ] Calling `refreshReportData` updates all data-bound blocks in the report.
- [ ] A new version of the report is created and the old version is preserved.
- [ ] An audit log entry is created for the refresh event.

### Phase 6: Advanced Content Import

#### Task 6.1: Implement Strict Import from PDF/Image
**Requirements:**
- `E05-0102`: If a user inserts a PDF page or image and requests a 1:1 match to an editable Word document, the system MUST use the `STRICT_1TO1_100` Strict Replication Engine. The output MUST be editable content, not an image, and MUST pass a `PixelDiff==0` test in the rendering farm.

**Implementation Contract:**
```typescript
// API to call the Strict Replication Engine
async function importFromPdfOrImage(file: Buffer): Promise<DocIr>;
```

**Acceptance Criteria:**
- [ ] The system can process a PDF or image file and generate an editable DOCX document.
- [ ] The generated DOCX is a faithful, editable reproduction of the original.

### Phase 7: Citations and References

#### Task 7.1: Implement Citation and Reference Management
**Requirements:**
- `E05-0103`: If `citation_mode` is `on`, the system MUST extract sources for numbers/claims from dataset lineage and library files, insert a `References` section, and link each claim to a `source_id`.
- `E05-0104`: The system MUST prevent the fabrication of sources.

**Implementation Contract:**
```typescript
// Function to process citations in a document
function processCitations(docIr: DocIr): DocIr;
```

**Acceptance Criteria:**
- [ ] When `citation_mode` is on, a `References` section is added to the report.
- [ ] In-text citations are added for all data-bound content and claims.
- [ ] The `References` section is populated with the correct source information.

### Phase 8: Governance and Security

#### Task 8.1: Implement Document Classification
**Requirements:**
- `E05-0105`: Each report MUST have a classification: `public`, `internal`, `confidential`, or `restricted`.
- `E05-0106`: The system MUST enforce export and sharing policies based on this classification.

**Implementation Contract:**
```typescript
// This is enforced at the API gateway level based on the DocIr's classification field.
// No specific function, but part of the system's access control logic.

function checkPermissions(user: User, report: DocIr, action: 'export' | 'share'): boolean;
```

**Acceptance Criteria:**
- [ ] A user cannot export a 'restricted' report if they don't have the required permissions.
- [ ] The classification is visibly watermarked on the document if required by policy.

#### Task 8.2: Implement Approvals Workflow
**Requirements:**
- `E05-0107`: The system MUST support a state machine for approvals: `draft` → `review` → `approved` → `published`.
- `E05-0108`: Transitions between states MUST be governed by role-based permissions.
- `E05-0109`: The system MUST record who approved the transition, the timestamp, and a summary of the differences.

**Implementation Contract:**
```typescript
// API to manage approval state transitions
async function changeReportState(reportId: string, newState: 'review' | 'approved' | 'published'): Promise<{ success: boolean }>;
```

**Acceptance Criteria:**
- [ ] A user with a 'reviewer' role can move a report from 'draft' to 'review'.
- [ ] An 'approver' can move a report from 'review' to 'approved'.
- [ ] The approval history is recorded and visible in the report's audit log.

#### Task 8.3: Implement Versioning and Diffing
**Requirements:**
- `E05-0110`: Every save or export action MUST create a new version of the report.
- `E05-0111`: The system MUST support rolling back to a previous version and diffing between versions.

**Implementation Contract:**
```typescript
// API for version management
async function getReportVersions(reportId: string): Promise<Version[]>;
async function rollbackToVersion(reportId: string, versionId: string): Promise<{ newVersionId: string }>;
async function diffVersions(reportId: string, versionA: string, versionB: string): Promise<any>; // Diff format TBD
```

**Acceptance Criteria:**
- [ ] A complete version history is maintained for every report.
- [ ] Users can view and restore previous versions.
- [ ] A visual diff of two versions can be displayed to the user.

#### Task 8.4: Implement Audit Log
**Requirements:**
- `E05-0112`: All `view`, `edit`, `export`, and `share` actions MUST be recorded in an immutable audit log.

**Implementation Contract:**
```typescript
// This is a system-wide service that logs actions.
// All API endpoints will call this service.
async function logAuditEvent(user: User, action: string, details: any): Promise<void>;
```

**Acceptance Criteria:**
- [ ] An audit trail is available for every report, showing all user interactions.
- [ ] The audit log is secure and cannot be altered.

### Phase 9: Export and Rendition

#### Task 9.1: Implement DOCX Export
**Requirements:**
- `E05-0113`: The system MUST produce valid OpenXML (DOCX) documents.
- `E05-0114`: The exported DOCX MUST be fully editable.
- `E05-0115`: The system MUST embed fonts as per policy or provide a list of required fonts.

**Implementation Contract:**
```typescript
// API to export a report to DOCX
async function exportToDocx(reportId: string): Promise<Buffer>;
```

**Acceptance Criteria:**
- [ ] The exported DOCX file can be opened in Microsoft Word without errors.
- [ ] All content in the DOCX is editable.
- [ ] Fonts are correctly embedded or listed as required.

#### Task 9.2: Implement PDF Export
**Requirements:**
- `E05-0116`: The PDF MUST be rendered from the DOC-IR or DOCX in a deterministic rendering farm.
- `E05-0117`: RTL text MUST be rendered correctly.
- `E05-0118`: Headers, footers, and the TOC MUST be correct.

**Implementation Contract:**
```typescript
// API to export a report to PDF
async function exportToPdf(reportId: string): Promise<Buffer>;
```

**Acceptance Criteria:**
- [ ] The exported PDF is a pixel-perfect representation of the report.
- [ ] Arabic text flows correctly from right to left.
- [ ] All navigation elements (TOC, links) are functional.

#### Task 9.3: Implement HTML Export
**Requirements:**
- `E05-0119`: The system MUST produce an HTML reader version that preserves the layout, optionally supports interactive tables, and embeds charts as SVG or Canvas elements.

**Implementation Contract:**
```typescript
// API to export a report to HTML
async function exportToHtml(reportId: string): Promise<string>;
```

**Acceptance Criteria:**
- [ ] The exported HTML page closely matches the report's layout.
- [ ] Tables in the HTML can be sorted and filtered.
- [ ] Charts are interactive.

#### Task 9.4: Implement PPTX Export
**Requirements:**
- `E05-0120`: The system MUST be able to convert key sections (executive summary, findings, KPIs) into slides.
- `E05-0121`: The slides MUST include links back to the full report.

**Implementation Contract:**
```typescript
// API to export a report to PPTX
async function exportToPptx(reportId: string): Promise<Buffer>;
```

**Acceptance Criteria:**
- [ ] A PPTX file is generated containing slides for the main sections of the report.
- [ ] Each slide contains a hyperlink to the full report.

## 5. Coverage Matrix

| Requirement | Phase | Task | Priority |
|:------------|:------|:-----|:---------|
| `E05-0001` | 1 | 1.1 | Mandatory |
| `E05-0002` | 1 | 1.1 | Mandatory |
| `E05-0003` | 1 | 1.1 | Mandatory |
| `E05-0004` | 1 | 1.1 | Mandatory |
| `E05-0005` | 1 | 1.1 | Mandatory |
| `E05-0006` | 1 | 1.1 | Mandatory |
| `E05-0007` | 1 | 1.1 | Mandatory |
| `E05-0008` | 1 | 1.1 | Mandatory |
| `E05-0009` | 1 | 1.1 | Mandatory |
| `E05-0010` | 1 | 1.1 | Mandatory |
| `E05-0011` | 1 | 1.1 | Mandatory |
| `E05-0012` | 2 | 2.1 | Mandatory |
| `E05-0013` | 1 | 1.2 | Mandatory |
| `E05-0014` | 1 | 1.2 | Mandatory |
| `E05-0015` | 1 | 1.2 | Mandatory |
| `E05-0016` | 1 | 1.2 | Mandatory |
| `E05-0017` | 1 | 1.2 | Mandatory |
| `E05-0018` | 1 | 1.2 | Mandatory |
| `E05-0019` | 1 | 1.2 | Mandatory |
| `E05-0020` | 2 | 2.1 | Mandatory |
| `E05-0021` | 2 | 2.1 | Mandatory |
| `E05-0022` | 2 | 2.2 | Mandatory |
| `E05-0023` | 2 | 2.2 | Mandatory |
| `E05-0024` | 2 | 2.2 | Mandatory |
| `E05-0025` | 2 | 2.3 | Mandatory |
| `E05-0026` | 2 | 2.3 | Mandatory |
| `E05-0027` | 3 | 3.1 | Mandatory |
| `E05-0028` | 3 | 3.1 | Mandatory |
| `E05-0029` | 3 | 3.1 | Mandatory |
| `E05-0030` | 3 | 3.1 | Mandatory |
| `E05-0031` | 3 | 3.1 | Mandatory |
| `E05-0032` | 3 | 3.1 | Mandatory |
| `E05-0033` | 3 | 3.1 | Mandatory |
| `E05-0034` | 3 | 3.1 | Mandatory |
| `E05-0035` | 3 | 3.1 | Mandatory |
| `E05-0036` | 3 | 3.1 | Mandatory |
| `E05-0037` | 3 | 3.1 | Mandatory |
| `E05-0038` | 3 | 3.1 | Mandatory |
| `E05-0039` | 3 | 3.1 | Mandatory |
| `E05-0040` | 3 | 3.1 | Mandatory |
| `E05-0041` | 3 | 3.2 | Mandatory |
| `E05-0042` | 3 | 3.2 | Mandatory |
| `E05-0043` | 3 | 3.2 | Mandatory |
| `E05-0044` | 3 | 3.2 | Mandatory |
| `E05-0045` | 3 | 3.2 | Mandatory |
| `E05-0046` | 3 | 3.2 | Mandatory |
| `E05-0047` | 3 | 3.2 | Mandatory |
| `E05-0048` | 3 | 3.2 | Mandatory |
| `E05-0049` | 3 | 3.2 | Mandatory |
| `E05-0050` | 4 | 4.1 | Mandatory |
| `E05-0051` | 4 | 4.1 | Mandatory |
| `E05-0052` | 4 | 4.1 | Mandatory |
| `E05-0053` | 4 | 4.2 | Mandatory |
| `E05-0054` | 4 | 4.2 | Mandatory |
| `E05-0055` | 4 | 4.2 | Mandatory |
| `E05-0056` | 4 | 4.2 | Mandatory |
| `E05-0057` | 4 | 4.2 | Mandatory |
| `E05-0058` | 4 | 4.2 | Mandatory |
| `E05-0059` | 4 | 4.2 | Mandatory |
| `E05-0060` | 4 | 4.2 | Mandatory |
| `E05-0061` | 4 | 4.3 | Mandatory |
| `E05-0062` | 4 | 4.3 | Mandatory |
| `E05-0063` | 4 | 4.3 | Mandatory |
| `E05-0064` | 4 | 4.3 | Mandatory |
| `E05-0065` | 4 | 4.4 | Mandatory |
| `E05-0066` | 4 | 4.4 | Mandatory |
| `E05-0067` | 4 | 4.4 | Optional |
| `E05-0068` | 4 | 4.4 | Mandatory |
| `E05-0069` | 4 | 4.4 | Mandatory |
| `E05-0070` | 4 | 4.4 | Mandatory |
| `E05-0071` | 4 | 4.4 | Mandatory |
| `E05-0072` | 4 | 4.4 | Mandatory |
| `E05-0073` | 4 | 4.4 | Mandatory |
| `E05-0074` | 4 | 4.4 | Mandatory |
| `E05-0075` | 1 | 1.1 | Informational |
| `E05-0076` | 1 | 1.1 | Mandatory |
| `E05-0077` | 1 | 1.1 | Mandatory |
| `E05-0078` | 1 | 1.1 | Mandatory |
| `E05-0079` | 1 | 1.1 | Mandatory |
| `E05-0080` | 1 | 1.1 | Mandatory |
| `E05-0081` | 1 | 1.1 | Optional |
| `E05-0082` | 1 | 1.1 | Mandatory |
| `E05-0083` | 1 | 1.1 | Mandatory |
| `E05-0084` | 1 | 1.2 | Mandatory |
| `E05-0085` | 1 | 1.2 | Mandatory |
| `E05-0086` | 1 | 1.2 | Mandatory |
| `E05-0087` | 1 | 1.2 | Optional |
| `E05-0088` | 1 | 1.2 | Optional |
| `E05-0089` | 1 | 1.2 | Mandatory |
| `E05-0090` | 1 | 1.2 | Mandatory |
| `E05-0091` | 1 | 1.2 | Optional |
| `E05-0092` | 1 | 1.2 | Mandatory |
| `E05-0093` | 5 | 5.1 | Mandatory |
| `E05-0094` | 5 | 5.1 | Mandatory |
| `E05-0095` | 5 | 5.1 | Mandatory |
| `E05-0096` | 5 | 5.1 | Mandatory |
| `E05-0097` | 5 | 5.1 | Mandatory |
| `E05-0098` | 5 | 5.2 | Mandatory |
| `E05-0099` | 5 | 5.2 | Mandatory |
| `E05-0100` | 5 | 5.2 | Mandatory |
| `E05-0101` | 5 | 5.3 | Mandatory |
| `E05-0102` | 6 | 6.1 | Mandatory |
| `E05-0103` | 7 | 7.1 | Mandatory |
| `E05-0104` | 7 | 7.1 | Mandatory |
| `E05-0105` | 8 | 8.1 | Mandatory |
| `E05-0106` | 8 | 8.1 | Mandatory |
| `E05-0107` | 8 | 8.2 | Mandatory |
| `E05-0108` | 8 | 8.2 | Mandatory |
| `E05-0109` | 8 | 8.2 | Mandatory |
| `E05-0110` | 8 | 8.3 | Mandatory |
| `E05-0111` | 8 | 8.3 | Mandatory |
| `E05-0112` | 8 | 8.4 | Mandatory |
| `E05-0113` | 9 | 9.1 | Mandatory |
| `E05-0114` | 9 | 9.1 | Mandatory |
| `E05-0115` | 9 | 9.1 | Mandatory |
| `E05-0116` | 9 | 9.2 | Mandatory |
| `E05-0117` | 9 | 9.2 | Mandatory |
| `E05-0118` | 9 | 9.2 | Mandatory |
| `E05-0119` | 9 | 9.3 | Mandatory |
| `E05-0120` | 9 | 9.4 | Mandatory |
| `E05-0121` | 9 | 9.4 | Mandatory |

**Total Requirements**: 121
**Covered**: 121 (100%)

---

## Supplementary Phases

### Phase 90: Document Export and Verification
#### Task 90.1: Export Data and Verify Rendering
**Requirements:**
- `E05-0122`: The system MUST provide a mechanism to export all underlying data tables and measures to an XLSX file. This file MUST include a dedicated "Lineage" sheet detailing the origin and transformation of each data point.
- `E05-0123`: The system MUST automatically verify render parity between the preview reader and the final exported PDF and HTML artifacts within the rendering farm.
- `E05-0124`: Any detected mismatch in rendering between the preview and exported files MUST be classified as a critical bug and MUST block the document from being marked as "Done".

**Implementation Contract:**
```typescript
interface ExportOptions {
  format: "xlsx";
}

interface ExportResult {
  file: Blob;
  lineage: object;
}

function exportData(options: ExportOptions): Promise<ExportResult>;

interface RenderingVerificationResult {
  isMatch: boolean;
  mismatches: any[];
}

function verifyRendering(): Promise<RenderingVerificationResult>;
```

**Acceptance Criteria:**
- [ ] Exported XLSX file contains all data tables and measures.
- [ ] Lineage sheet in the XLSX file is accurate and complete.
- [ ] Rendering verification process is triggered automatically upon export.
- [ ] No visual discrepancies are found between the preview and the exported PDF/HTML files.

### Phase 91: Layout and Formatting
#### Task 91.1: Ensure Document Integrity
**Requirements:**
- `E05-0125`: The document layout MUST NOT have any content overflow.
- `E05-0126`: The document MUST NOT contain orphan headings.
- `E05-0127`: The Table of Contents (TOC) MUST be correct and accurately reflect the document structure.
- `E05-0128`: All numbering (pages, sections, lists) MUST be correct and sequential.
- `E05-0129`: The document MUST respect the defined margins and safe areas.
- `E05-0141`: The system MUST automatically fix layout breaks, such as page breaks and keep-with-next violations.
- `E05-0142`: The system MUST adjust table widths deterministically to fit the content and page layout.
- `E05-0143`: The system MUST automatically split long tables into continuation pages with repeated headers.
- `E05-0144`: The system MUST regenerate the TOC after any content or layout changes.

**Implementation Contract:**
```typescript
interface LayoutValidationResult {
  hasOverflow: boolean;
  hasOrphanHeadings: boolean;
  isTocCorrect: boolean;
  isNumberingCorrect: boolean;
  areMarginsRespected: boolean;
}

function validateLayout(): Promise<LayoutValidationResult>;
```

**Acceptance Criteria:**
- [ ] The document renders without any content overflowing the page boundaries.
- [ ] No headings are left orphaned at the bottom of a page.
- [ ] The TOC is accurate and all links are functional.
- [ ] All numbering is sequential and correct.
- [ ] The content is within the specified margins and safe areas.

### Phase 92: Arabic Language and Text
#### Task 92.1: Ensure Correct Arabic Text Rendering
**Requirements:**
- `E05-0130`: Arabic text shaping MUST be correct, with all ligatures and contextual forms rendered properly.
- `E05-0131`: Bidirectional text flow (Bidi) MUST be correct, with mixed English and Arabic text displayed in the proper order.
- `E05-0132`: There MUST NOT be any clipped glyphs in the rendered output.
- `E05-0133`: Right-to-left (RTL) tables MUST be rendered correctly, with proper column order and alignment.

**Implementation Contract:**
```typescript
interface ArabicTextValidationResult {
  isShapingCorrect: boolean;
  isBidiCorrect: boolean;
  hasClippedGlyphs: boolean;
  areRtlTablesCorrect: boolean;
}

function validateArabicText(): Promise<ArabicTextValidationResult>;
```

**Acceptance Criteria:**
- [ ] All Arabic text is correctly shaped and rendered.
- [ ] Bidirectional text is displayed in the correct order.
- [ ] No glyphs are clipped or cut off.
- [ ] RTL tables are rendered correctly.

### Phase 93: Data and Content Integrity
#### Task 93.1: Validate Data and Content
**Requirements:**
- `E05-0134`: All data bindings in the document MUST be valid and resolve to a data source.
- `E05-0135`: All measures and calculations MUST be computed correctly.
- `E05-0136`: Missing data MUST be clearly labeled and MUST NOT be represented by silent blanks.
- `E05-0137`: The system MUST apply the appropriate sensitivity policy, including masking of sensitive data if required.
- `E05-0154`: The system MUST record lineage IDs and dataset signatures for all data used in the document.

**Implementation Contract:**
```typescript
interface DataIntegrityValidationResult {
  areBindingsValid: boolean;
  areMeasuresComputed: boolean;
  isMissingDataLabeled: boolean;
  isSensitivityPolicyApplied: boolean;
  areLineageIdsRecorded: boolean;
}

function validateDataIntegrity(): Promise<DataIntegrityValidationResult>;
```

**Acceptance Criteria:**
- [ ] All data bindings are resolved successfully.
- [ ] All calculations and measures are accurate.
- [ ] Missing data is clearly indicated.
- [ ] Sensitive data is masked according to the policy.
- [ ] Lineage information is recorded for all data.

### Phase 94: Writing and Content Generation
#### Task 94.1: Generate High-Quality Content
**Requirements:**
- `E05-0138`: The generated content MUST comply with the tone and style defined in the template.
- `E05-0139`: The generated content MUST NOT use any forbidden phrases.
- `E05-0140`: Recipient addressing in the document MUST be correct.
- `E05-0156`: The system MUST provide a "Report Writer" persona with a specific tone and style.
- `E05-0157`: The system MUST provide a "Data Analyst" persona for generating metrics and insights.
- `E05-0158`: The system MUST provide an "Auditor" persona for identifying quality issues and anomalies.
- `E05-0159`: The system MUST provide an "Executive Summarizer" persona for generating a one-page summary.
- `E05-0160`: The content structure MUST follow the order: Context → Findings → Evidence → Impact → Recommendations.
- `E05-0161`: The system MUST be capable of producing different types of content.
- `E05-0162`: The system MUST NOT invent timelines unless the user explicitly requests placeholders.
- `E05-0163`: The output detail level MUST be adjustable to one of the following: `brief`, `standard`, `deep`, or `audit`.
- `E05-0164`: The system MUST be able to adjust the generated content based on user feedback.

**Implementation Contract:**
```typescript

interface ContentGenerationParams {
  persona: "Report Writer" | "Data Analyst" | "Auditor" | "Executive Summarizer";
  detailLevel: "brief" | "standard" | "deep" | "audit";
}

function generateContent(params: ContentGenerationParams): Promise<string>;
```

**Acceptance Criteria:**
- [ ] The generated content matches the selected persona's tone and style.
- [ ] The content structure follows the specified order.
- [ ] The level of detail in the content matches the selected `output_detail_level`.
- [ ] The system does not generate timelines without user request.

### Phase 95: Quality Assurance and Export
#### Task 95.1: Perform QA and Generate Export Artifacts
**Requirements:**
- `E05-0145`: The system MUST rerun the entire Quality Assurance (QA) process until all checks pass.
- `E05-0146`: For every export or publish action, the system MUST generate a set of artifacts.
- `E05-0147`: The generated artifacts MUST include the document in DOCX, PDF, and HTML formats, and optionally PPTX and XLSX if requested.
- `E05-0148`: The artifacts MUST include render snapshots of the first page and other key pages.
- `E05-0149`: The artifacts MUST include QA reports for layout, Arabic text, data, and writing quality.
- `E05-0150`: The artifacts MUST include a template compliance report.
- `E05-0151`: The artifacts MUST include a literal diff report if the document is a literal translation.
- `E05-0152`: The artifacts MUST include a content trace if the document is a smart generation.
- `E05-0153`: The artifacts MUST include a snapshot of the action graph.
- `E05-0155`: The system MUST NOT allow the document to be marked as "Done" if there is no evidence of QA completion.

**Implementation Contract:**
```typescript
interface ExportArtifacts {
  docx: Blob;
  pdf: Blob;
  html: Blob;
  pptx?: Blob;
  xlsx?: Blob;
  snapshots: Blob[];
  qaReports: object;
  complianceReport: object;
  diffReport?: object;
  contentTrace?: object;
  actionGraph: object;
}

function exportDocument(): Promise<ExportArtifacts>;
```

**Acceptance Criteria:**
- [ ] The QA process is run automatically before every export.
- [ ] All required export artifacts are generated successfully.
- [ ] The document is not marked as "Done" without successful QA.

### Phase 96: Tooling and Infrastructure
#### Task 96.1: Standardize Tooling and Data Formats
**Requirements:**
- `E05-0165`: Every tool in the system MUST follow the standard input/output format: `request_id/tool_id/context/inputs/params` → `output {status, refs, warnings}`.
- `E05-0166`: All data schemas MUST conform to the JSON Schema 2020-12 standard.
- `E05-0167`: This set of requirements represents the minimum operational baseline and MUST NOT be deleted.

**Implementation Contract:**
```typescript
interface ToolInput<T> {
  request_id: string;
  tool_id: string;
  context: object;
  inputs: T;
  params: object;
}

interface ToolOutput<U> {
  status: "success" | "error";
  refs: string[];
  warnings: string[];
  output: U;
}
```

**Acceptance Criteria:**
- [ ] All tools adhere to the specified input/output format.
- [ ] All data schemas are valid according to JSON Schema 2020-12.
- [ ] The core requirements are preserved in the system.
