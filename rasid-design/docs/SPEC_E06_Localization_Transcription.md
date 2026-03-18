# Engine E06: LCT (Localization + Conversion + Transcription) — Programmatic Specification

## 1. Overview

The LCT Engine (E06) is a centralized solution for processing and converting a wide range of file and data types. Its primary objective is to accept any input format (e.g., PDF, images, audio, video, Office documents) and transform it into any desired output format (e.g., PPTX, DOCX, XLSX, JSON, SRT) with absolute precision and professional quality. The engine operates on three core principles: 100% strict visual conversion (CONVERT_STRICT_1TO1_100), professional-grade global localization (LOCALIZE_PRO_100), and 100% accurate transcription (TRANSCRIBE_STRICT_100). To eliminate any margin of error, the system relies on stringent automated verification gates, an internal human-in-the-loop verification team (VerifierOps) to handle uncertainties without user intervention, and the generation of an Evidence Pack for each operation to ensure transparency and accountability.

## 2. Data Models & Interfaces

```typescript
// The Canonical Design/Data Representation (CDR) is the unified model for all content.

interface CDR_Design {
  layout: object; // Represents the visual layout, positions, and dimensions of elements.
  typography: object; // Defines font styles, sizes, and other text attributes.
  vectors: object[]; // Vector graphics elements.
  images: object[]; // Raster image elements.
}

interface CDR_Data {
  tables: object[]; // Structured table data.
  semanticBindings: object; // Links data to its meaning or context.
}

// Interface for the Evidence Pack generated for each LCT operation
interface EvidencePack {
  inputFingerprints: {
    sha256: string;
    mime: string;
    metadata: object;
  };
  pipelineActionGraphSnapshot: object;
  toolVersions: {
    [toolName: string]: string;
  };
  farmImageId: string;
  conversionEvidence?: {
    sourceRender: string; // Path to rendered source
    targetRender: string; // Path to rendered target
    pixelHashes: object;
    pixelDiffReport: object; // MUST be 0 in strict mode
    structuralEditabilityReport: object;
  };
  localizationEvidence?: {
    terminologyComplianceReport: object;
    lqaReport: object; // MUST show 0 errors
    rtlShapingReport: object;
    layoutQAReport: object;
  };
  transcriptionEvidence?: {
    diarizationReport: object;
    alignmentReport: object;
    unresolvedSpans: any[]; // MUST be empty
    verifierOpsProof?: object;
  };
  artifactRefs: {
    [format: string]: string; // e.g., { pptx: "/path/to/file.pptx" }
  };
}

// Standard Tool Invocation Schema
interface ToolRequest {
  request_id: string;
  tool_id: string;
  context: object;
  inputs: object;
  params: object;
}

interface ToolResponse {
  status: 'success' | 'failure' | 'pending';
  refs: object;
  warnings: string[];
}
```

## 3. Implemented Features (Reference Only)

(No features are fully implemented at this initial stage.)

## 4. Execution Phases

### Phase 1: Basics and Infrastructure

#### Task 1.1: Define Engine Identity and Core Rules

**Requirements:**
- `E06-0001`: The technical execution document MUST be written in a direct, imperative style (MUST/SHALL/MUST NOT) for the implementer.
- `E06-0002`: The engine's name is **LCT**: Localization + Conversion + Transcription Engine.
- `E06-0003`: The engine's objective is to function as a universal converter: "Give me anything" (PDF, image, video, audio, Word, Excel, PowerPoint, text, etc.) → "Give me anything back" (PPTX, DOCX, XLSX, Dashboard, PDF, HTML, PNG, SRT, VTT, JSON, etc.).
- `E06-0008`: **No Mock/Demo/Claim Policy**: A task is not "Done" until real artifacts are produced, all gates are passed, and an evidence pack is generated.
- `E06-0009`: **Strict Behavior Rule**: Any behavior not explicitly defined in this specification is **forbidden**.
- `E06-0010`: **No User Questions Policy**: The engine MUST NOT ask the user questions during execution. Any ambiguity or missing information MUST be resolved using default policies or handled internally by VerifierOps.
- `E06-0104`: **Integrity Enforcement**: Gates MUST block merge/release if they fail. No stubs, mocks, or `TODO`s are permitted in the runtime environment. Builds MUST be deterministic where claims depend on parity.

**Implementation Contract:**
```typescript
// This task is foundational and primarily concerns documentation and project setup.
// The following represents the core principles to be enforced in the CI/CD pipeline.

// CI/CD Gate Configuration (conceptual)
const CICD_Gates = {
  enforceImperativeStyle: (docs: string[]) => boolean, // Linter for documentation
  preventStubsInRuntime: (codebase: string) => boolean, // Static analysis to detect mocks/stubs
  ensureDeterministicBuilds: (buildConfig: object) => boolean, // Build script validation
};

// Default policies for handling ambiguity
interface DefaultPolicies {
  unclearInputFormat: 'reject' | 'auto-detect';
  missingFont: 'substitute-default' | 'error';
  ambiguousLocalization: 'use-general-glossary' | 'route-to-verifier';
}
```

**Acceptance Criteria:**
- [ ] The project's `README.md` file is created and defines the engine's identity, goals, and core rules.
- [ ] An automated testing framework is established to enforce CI/CD gates.
- [ ] Initial default policies for handling ambiguity are defined and documented.

#### Task 1.2: Design and Implement the Unified Interface (UI/UX)

**Requirements:**
- `E06-0026`: A single canvas interface MUST be provided for users to drop any file, link, or recording.
- `E06-0027`: A single, collapsible panel MUST contain all controls: Inputs (Library/Connectors), Task (Convert/Localize/Transcribe/Extract Structured), Outputs, Policies (toggles for STRICT claims), Preview Reader (as an overlay), History/Versions, and Share/Permissions/Classification.
- `E06-0028`: The interface MUST NOT display too many options at once.
- `E06-0029`: Additional options MUST appear contextually or via search controls.

**Implementation Contract:**
```typescript
// Frontend component structure (e.g., using React)

interface AppState {
  activeFile: File | null;
  taskType: 'Convert' | 'Localize' | 'Transcribe' | 'Extract' | null;
  outputFormat: string | null;
  policies: { [key: string]: boolean };
  isPanelVisible: boolean;
}

// Main UI component
function LctWorkspace(props: AppState) {
  // Renders the main canvas and the collapsible side panel
}

// Context-aware control rendering
function ContextualControls(props: { context: AppState }) {
  // Logic to display relevant controls based on the current app state
  // e.g., show conversion options only when a file is loaded and task is 'Convert'
}
```

**Acceptance Criteria:**
- [ ] A functional frontend prototype with a drop-zone canvas and a collapsible panel is developed.
- [ ] The panel includes placeholders for all specified sections.
- [ ] The principle of progressive disclosure is implemented, showing options only when contextually relevant.

#### Task 1.3: Build the Canonical Design/Data Representation (CDR)

**Requirements:**
- `E06-0030`: All conversions MUST pass through the platform's **Canonical Design/Data Representation (CDR)**. This includes `CDR-Design` (layout, typography, vectors, images) and `CDR-Data` (tables, semantic bindings).
- `E06-0031`: Bypassing the CDR with format-specific special paths is strictly forbidden.

**Implementation Contract:**
```typescript
// The CDR interfaces are defined in Section 2.

// Ingestion function signature
type IngestFileFunction = (file: Buffer, type: string) => Promise<{ design: CDR_Design; data: CDR_Data }>;

// Egestion function signature
type EgestFileFunction = (cdr: { design: CDR_Design; data: CDR_Data }, format: string) => Promise<Buffer>;

// Central processing pipeline
async function conversionPipeline(inputFile: Buffer, inputType: string, outputFormat: string): Promise<Buffer> {
  const cdr = await ingestFile(inputFile, inputType);
  // Intermediate processing on the CDR can happen here
  const outputFile = await egestFile(cdr, outputFormat);
  return outputFile;
}
```

**Acceptance Criteria:**
- [ ] The schemas for `CDR-Design` and `CDR-Data` are finalized and implemented.
- [ ] Ingestion libraries are developed to convert at least one input format (e.g., PDF) into the CDR.
- [ ] Egestion libraries are developed to export the CDR into at least one output format (e.g., DOCX).
- [ ] The mandatory pipeline enforcing CDR usage is built and tested.

### Phase 2: Develop Exact Conversion Capabilities

#### Task 2.1: Implement the `CONVERT_STRICT_1TO1_100` Claim

**Requirements:**
- `E06-0012`: The engine MUST support 3 separate, non-mixable "Claims".
- `E06-0013`: The first claim is **`CONVERT_STRICT_1TO1_100`**.
- `E06-0014`: This claim guarantees a visual clone: `PixelDiff` MUST be 0 for every page/slide within a deterministic rendering farm.
- `E06-0015`: The output MUST have an editable core (text, tables, charts, elements). Outputs that are "all-image" are forbidden.
- `E06-0040`: When `CONVERT_STRICT_1TO1_100` is selected, specific rules apply (see below).
- `E06-0041`: Natural images (photos, logos) are permitted as assets only and MUST remain editable (crop/replace/mask).

**Implementation Contract:**
```typescript
// Deterministic Rendering Farm Interface
interface DeterministicFarm {
  render(file: Buffer, format: string, page: number): Promise<Buffer>; // Returns PNG buffer
}

// PixelDiff Gate Function
async function pixelDiffGate(sourceFile: Buffer, targetFile: Buffer, farm: DeterministicFarm): Promise<{ pixelDiff: number; isEditable: boolean }> {
  // 1. Render both source and target files to images page by page in the deterministic farm.
  // 2. Compare the rendered images using a pixel-perfect comparison algorithm.
  // 3. Analyze the structure of the target file to ensure it's not a flattened image.
  const diff = 0; // Placeholder for actual diff result
  const editable = true; // Placeholder for editability check
  return { pixelDiff: diff, isEditable: editable };
}

// The main claim function
async function claim_CONVERT_STRICT_1TO1_100(sourceFile: Buffer, targetFile: Buffer): Promise<boolean> {
  const farm: DeterministicFarm = getDeterministicFarm();
  const result = await pixelDiffGate(sourceFile, targetFile, farm);
  if (result.pixelDiff !== 0 || !result.isEditable) {
    throw new Error('CONVERT_STRICT_1TO1_100 claim failed.');
  }
  return true;
}
```

**Acceptance Criteria:**
- [ ] A deterministic rendering environment ("Farm") is established.
- [ ] The `PixelDiff` gate is developed and correctly compares rendered source and target files.
- [ ] The gate successfully blocks any conversion where `PixelDiff` is not zero.
- [ ] An automated check is in place to verify that the output is structurally editable.

#### Task 2.2: Build Core Conversion Paths

**Requirements:**
- `E06-0032`: The engine MUST support (at a minimum) the following conversion paths:
- `E06-0033`: PDF ↔ PPTX (Editable)
- `E06-0034`: PDF ↔ DOCX (Editable)
- `E06-0035`: Image ↔ XLSX (table-strict)
- `E06-0036`: Image ↔ PPTX (strict slide build)
- `E06-0037`: XLSX/CSV → Dashboard
- `E06-0038`: Dashboard → PPTX/DOCX/PDF/HTML

**Implementation Contract:**
```typescript
// Function signatures for the core conversion paths, all using the central CDR pipeline.

async function convertPdfToPptx(file: Buffer): Promise<Buffer> {
  return await conversionPipeline(file, 'pdf', 'pptx');
}

async function convertPdfToDocx(file: Buffer): Promise<Buffer> {
  return await conversionPipeline(file, 'pdf', 'docx');
}

async function convertImageToXlsx(file: Buffer): Promise<Buffer> {
  // This implies a table extraction step into CDR-Data
  return await conversionPipeline(file, 'png', 'xlsx'); // Assuming PNG input
}

async function convertImageToPptx(file: Buffer): Promise<Buffer> {
  // This implies reconstructing a slide layout in CDR-Design
  return await conversionPipeline(file, 'png', 'pptx');
}

async function convertDataToDashboard(file: Buffer, type: 'xlsx' | 'csv'): Promise<Buffer> {
  // This involves converting tabular data into a dashboard representation (e.g., JSON model for a charting library)
  return await conversionPipeline(file, type, 'dashboard-json');
}

async function convertDashboardToPresentation(dashboard: Buffer, format: 'pptx' | 'docx' | 'pdf' | 'html'): Promise<Buffer> {
  return await conversionPipeline(dashboard, 'dashboard-json', format);
}
```

**Acceptance Criteria:**
- [ ] The PDF ↔ PPTX conversion path is implemented and maintains editability.
- [ ] The PDF ↔ DOCX conversion path is implemented and maintains editability.
- [ ] Table data can be accurately extracted from an image and converted to an XLSX file.
- [ ] A PPTX slide can be reconstructed from an image.
- [ ] Data from XLSX/CSV can be converted into a dashboard model.
- [ ] All conversion paths are integrated with the `CONVERT_STRICT_1TO1_100` verification gate.

### Phase 3: Develop Professional Localization Capabilities

#### Task 3.1: Implement the `LOCALIZE_PRO_100` Claim

**Requirements:**
- `E06-0016`: The second claim is **`LOCALIZE_PRO_100`** (Professional Global Localization).
- `E06-0017`: This requires contextual terminology translation, adherence to templates/style guides, and "Arabic ELITE" typesetting.
- `E06-0018`: **LQA (Linguistic Quality Assurance) MUST be 0**: No errors in terminology, meaning, tone, consistency, names, numbers, or units.
- `E06-0019`: The layout MUST be preserved ("layout lock") with geometric repairs that do not corrupt the order of elements.
- `E06-0042`: Localization includes: translating text, terms, numbers/units, and administrative context; rebuilding layout for RTL (Right-to-Left) ELITE standards; adapting tables, charts, axes, and labels; respecting templates/tone (governmental, commercial, executive, technical); and preserving the design as much as possible without distortion.

**Implementation Contract:**
```typescript
// LQA Gate Interface
interface LQAGate {
  verify(original: CDR, localized: CDR, termbase: Termbase, styleGuide: StyleGuide): Promise<{ errorCount: number; report: object }>;
}

// Layout Lock Gate
interface LayoutLockGate {
  verify(originalLayout: CDR_Design, localizedLayout: CDR_Design): Promise<{ isPreserved: boolean; report: object }>;
}

// Arabic ELITE Typesetting Engine
interface ArabicTypesettingEngine {
  apply(cdr: CDR): Promise<CDR>; // Applies advanced bidi/shaping rules
}

// The main claim function
async function claim_LOCALIZE_PRO_100(originalCDR: CDR, localizedCDR: CDR): Promise<boolean> {
  const lqaGate: LQAGate = getLQAGate();
  const layoutGate: LayoutLockGate = getLayoutLockGate();
  const lqaResult = await lqaGate.verify(originalCDR, localizedCDR, getTermbase(), getStyleGuide());

  if (lqaResult.errorCount !== 0) {
    throw new Error('LOCALIZE_PRO_100 claim failed: LQA errors found.');
  }

  const layoutResult = await layoutGate.verify(originalCDR.design, localizedCDR.design);
  if (!layoutResult.isPreserved) {
    throw new Error('LOCALIZE_PRO_100 claim failed: Layout lock violated.');
  }

  return true;
}
```

**Acceptance Criteria:**
- [ ] An LQA gate is developed to programmatically check for linguistic errors against a golden dataset.
- [ ] A Layout Lock gate is implemented to verify design preservation.
- [ ] An advanced Arabic typesetting engine is integrated to handle bidi/shaping correctly.

#### Task 3.2: Build Terminology, Memory, and Style Systems

**Requirements:**
- `E06-0048`: The system MUST have a **Termbase** (Arabic/English terms) with domain classifications (financial, governmental, technical, etc.), a **Translation Memory** per tenant, and a **Style Guide** per tenant (defining tone, honorifics, formal phrases, forbidden phrases).

**Implementation Contract:**
```typescript
// Terminology Base Interface
interface Termbase {
  getTerm(sourceTerm: string, domain: string): string | null;
  addTerm(sourceTerm: string, targetTerm: string, domain: string): void;
}

// Translation Memory Interface
interface TranslationMemory {
  getTranslation(sourceSegment: string): string | null;
  addTranslation(sourceSegment: string, targetSegment: string): void;
}

// Style Guide Interface
interface StyleGuide {
  getTone(): 'formal' | 'informal' | 'technical';
  validatePhrase(phrase: string): boolean; // Checks against forbidden phrases
  getHonorifics(entity: string): string | null;
}

// Centralized Localization Asset Manager
class LocalizationAssetManager {
  private termbases: Map<string, Termbase>;
  private memories: Map<string, TranslationMemory>; // Keyed by tenantId
  private styleGuides: Map<string, StyleGuide>; // Keyed by tenantId

  constructor() {
    this.termbases = new Map();
    this.memories = new Map();
    this.styleGuides = new Map();
  }

  getTermbase(domain: string): Termbase { /* ... */ }
  getMemory(tenantId: string): TranslationMemory { /* ... */ }
  getStyleGuide(tenantId: string): StyleGuide { /* ... */ }
}
```

**Acceptance Criteria:**
- [ ] A database schema for the Termbase is designed and implemented, allowing for domain-specific classification.
- [ ] A multi-tenant Translation Memory system is built.
- [ ] A system for creating and managing tenant-specific Style Guides is developed.
- [ ] The localization process is integrated with these systems to ensure consistency.

#### Task 3.3: Implement the Automated Layout Repair Engine

**Requirements:**
- `E06-0049`: MUST use a pinned Arabic shaping/bidi engine for consistent results.
- `E06-0050`: MUST convert chart axes, legends, and table direction to RTL. Numbering style MUST follow policy (e.g., ٠١٢٣ or 0123).
- `E06-0051`: Localization MUST NOT "break" the design: no element overflow, clipping, or overlap is allowed.
- `E06-0052`: MUST implement a deterministic `Layout Repair` loop: text box resize rules, font size step-down rules, reflow only within bounding box limits, and grid snapping.

**Implementation Contract:**
```typescript
// Layout Repair Configuration
interface LayoutRepairConfig {
  maxFontSizeStepDown: number; // e.g., 3 steps
  textBoxResizeStrategy: 'expand-height' | 'shrink-width';
  enableGridSnap: boolean;
}

// The repair loop function
function repairLayout(cdr: CDR, config: LayoutRepairConfig): CDR {
  // 1. Apply RTL direction to all relevant elements (tables, charts, text).
  // 2. Detect any visual violations (overflow, overlap).
  // 3. For each violation, apply a deterministic repair sequence:
  //    a. Attempt to resize text box according to strategy.
  //    b. If still broken, step down font size (up to max steps).
  //    c. If still broken, reflow text within original bbox.
  //    d. Snap to grid if enabled.
  // 4. If violations persist, flag for VerifierOps.
  return cdr;
}
```

**Acceptance Criteria:**
- [ ] A deterministic layout repair algorithm is implemented.
- [ ] The engine correctly converts charts, tables, and axes to RTL.
- [ ] The repair loop effectively handles text overflow and element overlap without manual intervention in common cases.

#### Task 3.4: Build Localization-Specific Verification Gates

**Requirements:**
- `E06-0054`: Terminology compliance MUST be 100%.
- `E06-0055`: LQA MUST result in 0 errors (term, meaning, consistency, tone, names, numbers, units).
- `E06-0056`: A Layout QA pass MUST confirm no overlap or clipping.
- `E06-0057`: An Arabic ELITE pass MUST confirm correct typesetting.
- `E06-0058`: The Evidence Pack MUST be stored.
- `E06-0059`: Only after all the above are met can the status be "Localized Successfully".

**Implementation Contract:**
```typescript
// The final gate before declaring success
async function localizationFinalGate(evidence: EvidencePack): Promise<boolean> {
  const complianceReport = evidence.localizationEvidence.terminologyComplianceReport;
  const lqaReport = evidence.localizationEvidence.lqaReport;
  const layoutReport = evidence.localizationEvidence.layoutQAReport;
  const eliteReport = evidence.localizationEvidence.rtlShapingReport;

  const terminologyCompliant = complianceReport.compliance === '100%';
  const lqaPassed = lqaReport.errors === 0;
  const layoutPassed = layoutReport.overlaps === 0 && layoutReport.clips === 0;
  const elitePassed = eliteReport.status === 'pass';

  if (terminologyCompliant && lqaPassed && layoutPassed && elitePassed) {
    // Store the evidence pack
    await storeEvidencePack(evidence);
    return true; // "Localized Successfully"
  } else {
    // Route to VerifierOps or fail the process
    return false;
  }
}
```

**Acceptance Criteria:**
- [ ] A Terminology Compliance Gate is developed and integrated.
- [ ] A Layout QA Gate is developed to check for visual errors.
- [ ] An Arabic ELITE Gate is created to validate typesetting rules.
- [ ] The system correctly generates and stores an Evidence Pack upon successful completion of all gates.

### Phase 4: Develop Accurate Transcription Capabilities

#### Task 4.1: Implement the `TRANSCRIBE_STRICT_100` Claim

**Requirements:**
- `E06-0020`: The third claim is **`TRANSCRIBE_STRICT_100`** (100% Accurate Transcription/Extraction).
- `E06-0021`: The transcript MUST be "Exact" according to multiple verification gates and MUST NOT be delivered until it is.
- `E06-0023`: Returning "close" or "confidence 0.97" as a final result is not permitted. It is either Exact or not delivered.
- `E06-0024`: Any result like "99.9999%" or "very close" is **forbidden**.
- `E06-0079`: Delivering a "best effort" result is forbidden. No approximations.

**Implementation Contract:**
```typescript
// Definition of an "Exact" Transcript
// An "Exact" transcript has zero unresolved spans after passing all verification gates.
interface Transcript {
  segments: {
    text: string;
    startTime: number;
    endTime: number;
    speaker: string;
    isUncertain: boolean; // This MUST be false for all segments in a final transcript
  }[];
}

// The main claim function
async function claim_TRANSCRIBE_STRICT_100(transcript: Transcript): Promise<boolean> {
  const hasUncertainSpans = transcript.segments.some(s => s.isUncertain);
  if (hasUncertainSpans) {
    // This state should not be reachable by the final delivery point.
    // It implies a gate failed to route to VerifierOps.
    throw new Error('TRANSCRIBE_STRICT_100 claim failed: Transcript contains uncertain spans.');
  }
  // Further checks can be added here based on the evidence pack
  return true;
}
```

**Acceptance Criteria:**
- [ ] The system's architecture is designed to withhold transcription results until they pass all verification gates.
- [ ] An automated routing mechanism is established to send any transcript with failed gates or uncertain segments to VerifierOps.

#### Task 4.2: Support Multiple Input and Output Media

**Requirements:**
- `E06-0039`: Video/Audio input MUST produce a transcript (DOCX/JSON/SRT/VTT) and optionally "slides/report" outputs.
- `E06-0060`: The engine MUST support transcription from: images (OCR text), PDF (text + scanned OCR), Audio (ASR), Video (ASR + on-screen text OCR + embedded captions), and Camera capture (image/video) as an input asset.
- `E06-0066`: DOCX transcript output.
- `E06-0067`: JSON transcript output (with segments, speakers, timestamps, and confidence fields for audit purposes only).
- `E06-0068`: SRT/VTT subtitles output.
- `E06-0069`: "Screen text extraction" (from on-screen overlays).
- `E06-0070`: "Comments extraction": If a video file or its source platform contains a captions/metadata/comments track, it MUST be extracted.

**Implementation Contract:**
```typescript
// Input Processor Interface
interface InputProcessor {
  process(file: Buffer): Promise<string>; // Returns raw text
}

// Factory to get the right processor
function getProcessor(mimeType: string): InputProcessor {
  if (mimeType.startsWith('image/')) return new OcrProcessor();
  if (mimeType === 'application/pdf') return new PdfProcessor();
  if (mimeType.startsWith('audio/')) return new AsrProcessor();
  if (mimeType.startsWith('video/')) return new VideoProcessor(); // Handles ASR + OCR
  throw new Error('Unsupported input type');
}

// Output Formatter Interface
interface OutputFormatter {
  format(transcript: Transcript): Buffer;
}

// Factory to get the right formatter
function getFormatter(format: 'docx' | 'json' | 'srt' | 'vtt'): OutputFormatter {
  // ... implementation for each format
}

// Video Processor handling multiple streams
class VideoProcessor implements InputProcessor {
  async process(file: Buffer): Promise<string> {
    const spokenText = await new AsrProcessor().process(file);
    const onScreenText = await new OcrProcessor().processFrames(file);
    const comments = await new MetadataExtractor().extractComments(file);
    // Combine and reconcile texts
    return combineTexts(spokenText, onScreenText, comments);
  }
}
```

**Acceptance Criteria:**
- [ ] Processors for OCR, PDF text extraction, and ASR are implemented.
- [ ] A video processor that combines ASR and frame-based OCR is developed.
- [ ] Formatters for DOCX, JSON, and SRT/VTT are created.
- [ ] The system can extract text from all specified input sources.

### Phase 5: VerifierOps (Human-in-the-Loop)

**Requirements:**
- `E06-0080`: To achieve "100% without exception" in OCR/ASR/Localization, an internal human verification layer (VerifierOps) MUST exist.
- `E06-0081`: VerifierOps MUST be invoked automatically upon any `STRICT_100` gate failure, any uncertainty span > 0, any Terminology/LQA violation, or any layout break that cannot be repaired automatically.
- `E06-0082`: VerifierOps MUST work on a "diff-based" interface (seeing only contested regions), sign their result (verifier_id + timestamp), and produce evidence for the pack.
- `E06-0083`: VerifierOps MUST NOT communicate with the end-user.
- `E06-0084`: If terminology data is missing, VerifierOps MUST use the default termbase and the general style guide.

**Implementation Contract:**
```typescript
// Interface for a task routed to VerifierOps
interface VerifierTask {
  taskId: string;
  type: 'transcription' | 'localization' | 'conversion';
  content: object; // The full CDR or transcript
  diffs: {
    span: [number, number]; // The start/end of the uncertain region
    original: string;
    suggestion: string;
    reason: string; // Why the gate failed
  }[];
}

// Interface for the Verifier's action
interface VerifierAction {
  taskId: string;
  verifierId: string;
  timestamp: Date;
  resolutions: {
    diffIndex: number;
    chosenText: string;
  }[];
}

// The VerifierOps routing function
function routeToVerifierOps(task: VerifierTask): void {
  // Pushes the task to the VerifierOps queue
}

// The VerifierOps completion gate
async function verifierOpsCompletionGate(action: VerifierAction): Promise<boolean> {
  // 1. Apply the resolutions to the content.
  // 2. Generate a proof of verification.
  // 3. Add the proof to the evidence pack.
  // 4. Re-run the relevant gates to ensure the fix is valid.
  return true;
}
```

**Acceptance Criteria:**
- [ ] A task queue for VerifierOps is created.
- [ ] A diff-based UI is designed for verifiers to review and resolve issues.
- [ ] The system automatically routes failed tasks to the VerifierOps queue.
- [ ] Verifier actions are logged, signed, and included in the Evidence Pack.

### Phase 6: Evidence Pack (MUST)

**Requirements:**
- `E06-0085`: Every LCT operation MUST generate an Evidence Pack.
- `E06-0086`: The pack MUST contain input fingerprints (sha256, mime, metadata).
- `E06-0087`: The pack MUST contain a snapshot of the pipeline action graph.
- `E06-0088`: The pack MUST contain tool versions and the farm image ID.
- `E06-0089`: For conversion, the pack MUST include source and target renders, pixel hashes, a PixelDiff report (which must be 0 in strict mode), and a structural/editability report.
- `E06-0090`: For localization, the pack MUST include a terminology compliance report, an LQA report (must show 0 errors), an RTL/Arabic shaping report, and a layout QA report.
- `E06-0091`: For transcription, the pack MUST include a diarization report, an alignment report, a list of unresolved spans (must be empty), and verifier ops proof (if used).
- `E06-0092`: The pack MUST contain references to the final artifacts (pptx/docx/xlsx/pdf/html/srt/vtt/json).
- `E06-0093`: **No Evidence => MUST NOT say “Done”**.

**Implementation Contract:**
```typescript
// The EvidencePack interface is defined in Section 2.

// Function to generate the evidence pack
async function generateEvidencePack(context: LctOperationContext): Promise<EvidencePack> {
  const pack: Partial<EvidencePack> = {};

  // Populate pack with all required fields based on the operation type and context
  pack.inputFingerprints = await calculateFingerprints(context.inputFile);
  pack.pipelineActionGraphSnapshot = context.actionGraph;
  pack.toolVersions = getToolVersions();
  pack.farmImageId = getFarmImageId();

  if (context.taskType === 'Convert') {
    pack.conversionEvidence = await generateConversionEvidence(context);
  }
  if (context.taskType === 'Localize') {
    pack.localizationEvidence = await generateLocalizationEvidence(context);
  }
  if (context.taskType === 'Transcribe') {
    pack.transcriptionEvidence = await generateTranscriptionEvidence(context);
  }

  pack.artifactRefs = context.outputArtifacts;

  return pack as EvidencePack;
}

// The final gate that checks for the existence of the evidence pack
function finalDoneGate(evidence: EvidencePack | null): boolean {
  if (!evidence) {
    return false; // MUST NOT say "Done"
  }
  // Store the pack
  storeEvidencePack(evidence);
  return true;
}
```

**Acceptance Criteria:**
- [ ] A robust `EvidencePack` is generated for every completed LCT operation.
- [ ] The pack contains all required reports and metadata for the specific task type.
- [ ] The system is architected to prevent marking a job as "Done" if the Evidence Pack has not been successfully created and stored.

### Phase 7: Security / Classification / Sharing (MUST)

**Requirements:**
- `E06-0094`: Every output MUST carry classification (public/internal/confidential/restricted) and lineage (sources).
- `E06-0095`: RBAC/ABAC, object ACLs, and row/column level security MUST be applied where applicable.
- `E06-0096`: Share links MUST support view-only, comment, and edit permissions, with separate permissions for exporting.
- `E06-0097`: An immutable audit trail MUST be kept for every view, edit, export, and share action.

**Implementation Contract:**
```typescript
// Data classification and lineage metadata
interface SecurityMetadata {
  classification: 'public' | 'internal' | 'confidential' | 'restricted';
  lineage: { assetId: string; version: number; }[];
}

// ACL interface for an object
interface AccessControlList {
  read: string[]; // Array of user/group IDs
  write: string[];
  manage: string[];
}

// Sharing configuration
interface ShareLink {
  linkId: string;
  permissions: {
    view: boolean;
    comment: boolean;
    edit: boolean;
    export: boolean;
  };
  expires?: Date;
}

// Audit log entry
interface AuditEntry {
  timestamp: Date;
  userId: string;
  action: 'view' | 'edit' | 'export' | 'share';
  objectId: string;
  details: object;
}

// Function to apply security metadata to an output artifact
function applySecurityMetadata(artifactId: string, metadata: SecurityMetadata): void {
  // Associates the metadata with the artifact in the system's database
}

// Function to generate an immutable audit log
function logAuditEvent(entry: AuditEntry): void {
  // Writes the entry to a write-once, read-many log store
}
```

**Acceptance Criteria:**
- [ ] All generated artifacts are tagged with classification and lineage metadata.
- [ ] A role-based access control system is implemented for all objects.
- [ ] The system supports generating shareable links with granular permissions.
- [ ] An immutable audit log captures all access and modification events.

### Phase 8: Integration with Other Engines (MUST)

**Requirements:**
- `E06-0098`: The LCT engine MUST call other specialized engines for specific tasks.
- `E06-0099`: MUST call the **Strict Replication Engine** for `image/pdf → pptx/docx/xlsx` strict 1:1 conversions.
- `E06-0100`: MUST call the **Excel Engine** for any structured data extraction, which then provides a table canvas, transforms, and exports.
- `E06-0101`: MUST call the **Dashboard Engine** for `dataset → dashboard` creation and exports.
- `E06-0102`: MUST call the **Slides Engine** for `report/dataset → slides` generation and for inserting strictly formatted pages.
- `E06-0103`: MUST call the **Report Engine** for `datasets + narrative → docx/pdf` generation.

**Implementation Contract:**
```typescript
// Interface for the Engine Orchestrator
// This orchestrator is responsible for routing tasks to the appropriate engine.

interface EngineOrchestrator {
  // Routes a strict 1:1 conversion task
  callStrictReplicationEngine(source: Buffer, type: string, targetFormat: 'pptx' | 'docx' | 'xlsx'): Promise<Buffer>;

  // Routes a table extraction task
  callExcelEngine(source: Buffer, type: string): Promise<Buffer>; // Returns an XLSX file

  // Routes a dashboard generation task
  callDashboardEngine(dataset: Buffer, type: string): Promise<Buffer>; // Returns a dashboard model

  // Routes a slides generation task
  callSlidesEngine(report: object, dataset: object): Promise<Buffer>; // Returns a PPTX file

  // Routes a report generation task
  callReportEngine(datasets: object[], narrative: string): Promise<Buffer>; // Returns a DOCX/PDF file
}

// Example of LCT using the orchestrator
class LctEngine {
  private orchestrator: EngineOrchestrator;

  constructor(orchestrator: EngineOrchestrator) {
    this.orchestrator = orchestrator;
  }

  async performStrictConversion(file: Buffer, type: string, format: 'pptx' | 'docx' | 'xlsx'): Promise<Buffer> {
    // LCT's role here is to prepare the input and call the specialized engine.
    return this.orchestrator.callStrictReplicationEngine(file, type, format);
  }
}
```

**Acceptance Criteria:**
- [ ] The LCT engine correctly identifies tasks that should be delegated to other engines.
- [ ] API contracts for interacting with the Strict Replication, Excel, Dashboard, Slides, and Report engines are defined and implemented.
- [ ] The orchestrator successfully routes requests and handles responses from the specialized engines.

### Phase 9: Anti-Cheating / Integrity (MUST)

**Requirements:**
- `E06-0104`: The system MUST enforce strict integrity rules: gates MUST block merge/release cycles, no stubs/mocks/TODOs are allowed in the runtime environment, and builds MUST be deterministic where claims depend on parity.

**Implementation Contract:**
```typescript
// This is an overarching architectural principle, enforced through CI/CD and code review.

// CI/CD Pipeline Configuration (conceptual)
const pipelineConfig = {
  stages: [
    {
      name: 'Build',
      steps: [
        { script: 'npm run build -- --deterministic' }
      ]
    },
    {
      name: 'Test',
      steps: [
        { script: 'npm run lint -- --no-stubs --no-todos' }, // Static analysis
        { script: 'npm run test' } // Unit & integration tests
      ]
    },
    {
      name: 'GateCheck',
      steps: [
        // This step would invoke all relevant gates (PixelDiff, LQA, etc.)
        // on a set of golden files.
        { script: 'npm run run-gates' }
      ],
      // The pipeline MUST fail and block merge if any step fails.
    }
  ]
};
```

**Acceptance Criteria:**
- [ ] The CI/CD pipeline is configured to block merges or releases if any gate fails.
- [ ] Static analysis tools are in place to prevent stubs, mocks, or TODO comments from being present in production code.
- [ ] The build process is configured to be deterministic to ensure parity for claims that require it.

## 5. Coverage Matrix

| Requirement | Phase | Task | Priority |
|:--- |:--- |:--- |:--- |
| `E06-0001` | 1 | 1.1 | Mandatory |
| `E06-0002` | 1 | 1.1 | Mandatory |
| `E06-0003` | 1 | 1.1 | Mandatory |
| `E06-0004` | 2 | 2.1 | Mandatory |
| `E06-0005` | 3 | 3.1 | Mandatory |
| `E06-0006` | 4 | 4.1 | Mandatory |
| `E06-0007` | 8 | 8.1 | Mandatory |
| `E06-0008` | 1 | 1.1 | Mandatory |
| `E06-0009` | 1 | 1.1 | Informational |
| `E06-0010` | 1 | 1.1 | Informational |
| `E06-0011` | 4 | 4.1 | Informational |
| `E06-0012` | 2 | 2.1 | Mandatory |
| `E06-0013` | 2 | 2.1 | Mandatory |
| `E06-0014` | 2 | 2.1 | Mandatory |
| `E06-0015` | 2 | 2.1 | Prohibited |
| `E06-0016` | 3 | 3.1 | Mandatory |
| `E06-0017` | 3 | 3.1 | Mandatory |
| `E06-0018` | 3 | 3.1 | Mandatory |
| `E06-0019` | 3 | 3.1 | Mandatory |
| `E06-0020` | 4 | 4.1 | Mandatory |
| `E06-0021` | 4 | 4.1 | Mandatory |
| `E06-0022` | 5 | 5.1 | Mandatory |
| `E06-0023` | 4 | 4.1 | Prohibited |
| `E06-0024` | 4 | 4.1 | Informational |
| `E06-0025` | 5 | 5.1 | Informational |
| `E06-0026` | 1 | 1.2 | Mandatory |
| `E06-0027` | 1 | 1.2 | Mandatory |
| `E06-0028` | 1 | 1.2 | Mandatory |
| `E06-0029` | 1 | 1.2 | Mandatory |
| `E06-0030` | 1 | 1.3 | Mandatory |
| `E06-0031` | 1 | 1.3 | Prohibited |
| `E06-0032` | 2 | 2.2 | Mandatory |
| `E06-0033` | 2 | 2.2 | Mandatory |
| `E06-0034` | 2 | 2.2 | Mandatory |
| `E06-0035` | 2 | 2.2 | Mandatory |
| `E06-0036` | 2 | 2.2 | Mandatory |
| `E06-0037` | 2 | 2.2 | Mandatory |
| `E06-0038` | 2 | 2.2 | Mandatory |
| `E06-0039` | 4 | 4.2 | Optional |
| `E06-0040` | 2 | 2.1 | Mandatory |
| `E06-0041` | 2 | 2.1 | Informational |
| `E06-0042` | 3 | 3.1 | Mandatory |
| `E06-0043` | 3 | 3.1 | Mandatory |
| `E06-0044` | 3 | 3.1 | Mandatory |
| `E06-0045` | 3 | 3.1 | Mandatory |
| `E06-0046` | 3 | 3.1 | Mandatory |
| `E06-0047` | 3 | 3.1 | Mandatory |
| `E06-0048` | 3 | 3.2 | Mandatory |
| `E06-0049` | 3 | 3.3 | Mandatory |
| `E06-0050` | 3 | 3.3 | Mandatory |
| `E06-0051` | 3 | 3.3 | Mandatory |
| `E06-0052` | 3 | 3.3 | Mandatory |
| `E06-0053` | 5 | 5.1 | Mandatory |
| `E06-0054` | 3 | 3.4 | Mandatory |
| `E06-0055` | 3 | 3.4 | Mandatory |
| `E06-0056` | 3 | 3.4 | Mandatory |
| `E06-0057` | 3 | 3.4 | Mandatory |
| `E06-0058` | 3 | 3.4 | Mandatory |
| `E06-0059` | 3 | 3.4 | Mandatory |
| `E06-0060` | 4 | 4.2 | Mandatory |
| `E06-0061` | 4 | 4.2 | Mandatory |
| `E06-0062` | 4 | 4.2 | Mandatory |
| `E06-0063` | 4 | 4.2 | Mandatory |
| `E06-0064` | 4 | 4.2 | Mandatory |
| `E06-0065` | 4 | 4.2 | Mandatory |
| `E06-0066` | 4 | 4.2 | Mandatory |
| `E06-0067` | 4 | 4.2 | Mandatory |
| `E06-0068` | 4 | 4.2 | Mandatory |
| `E06-0069` | 4 | 4.2 | Mandatory |
| `E06-0070` | 4 | 4.2 | Mandatory |
| `E06-0071` | 4 | 4.3 | Mandatory |
| `E06-0072` | 4 | 4.3 | Mandatory |
| `E06-0073` | 4 | 4.3 | Mandatory |
| `E06-0074` | 4 | 4.3 | Mandatory |
| `E06-0075` | 4 | 4.3 | Mandatory |
| `E06-0076` | 4 | 4.3 | Mandatory |
| `E06-0077` | 5 | 5.1 | Mandatory |
| `E06-0078` | 4 | 4.3 | Mandatory |
| `E06-0079` | 4 | 4.1 | Informational |
| `E06-0080` | 5 | 5.1 | Mandatory |
| `E06-0081` | 5 | 5.1 | Mandatory |
| `E06-0082` | 5 | 5.1 | Mandatory |
| `E06-0083` | 5 | 5.1 | Prohibited |
| `E06-0084` | 5 | 5.1 | Mandatory |
| `E06-0085` | 6 | 6.1 | Mandatory |
| `E06-0086` | 6 | 6.1 | Mandatory |
| `E06-0087` | 6 | 6.1 | Mandatory |
| `E06-0088` | 6 | 6.1 | Mandatory |
| `E06-0089` | 6 | 6.1 | Mandatory |
| `E06-0090` | 6 | 6.1 | Mandatory |
| `E06-0091` | 6 | 6.1 | Mandatory |
| `E06-0092` | 6 | 6.1 | Mandatory |
| `E06-0093` | 6 | 6.1 | Prohibited |
| `E06-0094` | 7 | 7.1 | Mandatory |
| `E06-0095` | 7 | 7.1 | Mandatory |
| `E06-0096` | 7 | 7.1 | Mandatory |
| `E06-0097` | 7 | 7.1 | Mandatory |
| `E06-0098` | 8 | 8.1 | Mandatory |
| `E06-0099` | 8 | 8.1 | Mandatory |
| `E06-0100` | 8 | 8.1 | Mandatory |
| `E06-0101` | 8 | 8.1 | Mandatory |
| `E06-0102` | 8 | 8.1 | Mandatory |
| `E06-0103` | 8 | 8.1 | Mandatory |
| `E06-0104` | 9 | 9.1 | Mandatory |
| `E06-0105` | 1 | 1.1 | Informational |
| `E06-0106` | 1 | 1.1 | Informational |
| `E06-0107` | 1 | 1.1 | Informational |

**Total Requirements**: 107
**Covered**: 107 (100%)
