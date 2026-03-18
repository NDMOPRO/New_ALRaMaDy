# Engine E03: Rasid Data Platform — Programmatic Specification

## 1. Overview

This document provides the complete programmatic specification for the **Rasid Data Platform Engine (E03)**. This engine is a large-scale, highly capable tool designed for users to ingest, understand, clean, unify, merge, split, transform, analyze, and export any type of data, including from Excel, CSV, PDF, and image files.

The core of the engine is a central user interface known as the **"Data Canvas"**, which starts as a blank table. Users can drag and drop columns from multiple, disparate data sources (files, worksheets, tables) to build their final table. The system is built on a **Columnar Lakehouse** architecture with virtualization technologies to handle massive datasets with millions or even billions of records.

Key capabilities include:
- **Visual Transformation Engine**: A Power Query-like visual interface for building complex data processing workflows without code, with the option to export these transformations to Power Query's M language.
- **Spreadsheet Virtual Machine (SVM)**: An internal engine that ensures formulas and equations are executed with the same precision and reliability as in Excel, supporting pivot tables, conditional formatting, and freezing panes.
- **AI Analyst**: Advanced AI capabilities that proactively analyze data context to suggest cleaning, unification, and merging operations, identify Key Performance Indicators (KPIs), and assist in root cause analysis and forecasting.

This plan follows a strict methodology that prohibits any form of dummy implementations or temporary solutions. Any behavior not explicitly defined in the requirements is strictly forbidden. Each requirement will be fully implemented and tested before being marked as "done".

## 2. Data Models & Interfaces

```typescript
// Unique identifiers for all entities in the system
type AssetId = string; // Identifier for a source file
type SheetId = string; // Identifier for a sheet within a file
type TableId = string; // Identifier for a table within a sheet
type ColumnId = string; // Identifier for a column within a table
type DatasetId = string; // Identifier for a resulting dataset
type RecipeId = string; // Identifier for a transformation workflow

// Represents the lineage of a data entity
interface Lineage {
  file: AssetId;
  sheet?: SheetId;
  table?: TableId;
  column?: ColumnId;
}

// Statistical metadata for a column
interface ColumnStats {
  nullRatio: number;
  uniqueCount: number;
  inferredType: 'string' | 'number' | 'date' | 'boolean' | 'mixed';
}

// Semantic and sensitivity labels for a column
interface ColumnLabels {
  semantic: string | null; // e.g., 'customer_id', 'timestamp'
  sensitivity: 'PII' | 'Confidential' | null;
}

// Represents a single column in the unified catalog
interface CatalogColumn {
  id: ColumnId;
  name: string;
  alias?: string; // Original display name
  lineage: Lineage;
  stats: ColumnStats;
  labels: ColumnLabels;
}

// Represents a suggested relationship between columns
interface Relationship {
  from: ColumnId;
  to: ColumnId;
  confidence: number;
}

// Represents a group of synonymous columns
interface ColumnSynonymGroup {
  canonicalName: string;
  columns: ColumnId[];
  confidence: number;
}

// Represents a step in a transformation recipe
interface TransformationStep {
  id: string;
  operation: string; // e.g., 'rename', 'filter', 'join'
  params: any; // Operation-specific parameters
  isExportable: boolean; // Can this step be translated to Power Query M?
}

// Represents a transformation recipe
interface Recipe {
  id: RecipeId;
  steps: TransformationStep[];
}

// Represents the main data canvas
interface DataCanvas {
  resultTable: TableId;
  activeTabs: SheetId[];
}

// Represents a job running in the background
interface Job {
  id: string;
  status: 'running' | 'completed' | 'failed';
  progress: number;
  description: string;
}
```

## 3. Implemented Features (Reference Only)

*This section is for future reference. Currently, all requirements are in the scope of implementation.*

## 4. Execution Phases

### Phase 1: Foundation & Infrastructure

#### Task 1.1: Set Up Development Environment and Establish Main UI (Data Canvas)

**Requirements:**

- `E03-0001`: **Direct, Imperative Technical Specification** - All documentation MUST be written in a direct, imperative style (MUST, SHALL, MUST NOT) for the implementer.
- `E03-0003`: **Strict Rule**: Any behavior not specified herein is **prohibited**. Any approximation, demo, or claim of functionality is **rejected**. A feature is not considered "done" until it is fully implemented, tested, and evidence of completion is provided.
- `E03-0010`: **No-Cheating / No Dummy / No Claims** - The implementation MUST NOT contain any dummy components, placeholder functionality, or unsubstantiated claims of completeness.
- `E03-0011`: **Single Screen: Data Canvas** - The entire user interface MUST be contained within a single screen, the Data Canvas. The center of the screen MUST contain the **Result Table** with tabs for sheets within the same output file. A single, collapsible panel on the left or right MUST contain the following sections: Library, Column Map, Operations, Recipes, QA/Quality, and Export.
- `E03-0012`: **Progressive Disclosure of Controls** - The UI MUST NOT display too many options at once.
- `E03-0013`: **Context-Sensitive Options** - The UI MUST display only 5-9 options based on the current context.
- `E03-0014`: **Search for Operations** - The UI MUST provide "Search Controls" to find any operation by name.

**Implementation Contract:**

```typescript
// Main application state
interface AppState {
  dataCanvas: DataCanvas;
  sidePanel: {
    isVisible: boolean;
    activeTab: 'Library' | 'Column Map' | 'Operations' | 'Recipes' | 'QA/Quality' | 'Export';
  };
}

// Service for managing the application state
class AppStateService {
  private state: AppState;

  constructor() {
    this.state = {
      dataCanvas: {
        resultTable: '',
        activeTabs: [],
      },
      sidePanel: {
        isVisible: true,
        activeTab: 'Library',
      },
    };
  }

  getState(): AppState {
    return this.state;
  }

  toggleSidePanel(): void {
    this.state.sidePanel.isVisible = !this.state.sidePanel.isVisible;
  }

  setActiveTab(tab: AppState['sidePanel']['activeTab']): void {
    this.state.sidePanel.activeTab = tab;
  }
}
```

**Acceptance Criteria:**

- [ ] The main application UI consists of a single Data Canvas screen.
- [ ] The Data Canvas contains a central Result Table and a collapsible side panel.
- [ ] The side panel contains tabs for Library, Column Map, Operations, Recipes, QA/Quality, and Export.
- [ ] The number of visible options in the UI is limited based on the user's selection context.
- [ ] A search bar is available to find operations by name.
- [ ] All placeholder components are clearly marked with `DUMMY_COMPONENT`.

#### Task 1.2: Build Canonical Storage Layer and Execution Engine

**Requirements:**

- `E03-0035`: **Canonical Columnar Storage** - All data MUST be internally converted to a columnar format: Apache Arrow for in-memory representation and Apache Parquet for on-disk storage.
- `E03-0036`: **Data Catalog** - A catalog MUST be maintained, tracking file -> sheet -> table -> column lineage, column fingerprints, statistics, and semantic tags.
- `E03-0037`: **Semantic Graph** - A semantic graph MUST be maintained, representing entities, keys, relationships, and time dimensions.
- `E03-0038`: **Universal IDs** - Every entity MUST have a unique identifier.
- `E03-0039`: **Entity-Specific IDs** - Specific ID formats MUST be used: `asset_id` (file), `sheet_id`, `table_id`, `column_id`.
- `E03-0040`: **Dataset ID** - The result of a workflow MUST have a `dataset_id`.
- `E03-0041`: **Recipe ID** - A workflow itself MUST have a `recipe_id`.
- `E03-0098`: **Query and Transformation Engine** - Queries and transformations MUST be executed via an embedded analytical engine (e.g., DuckDB-class) on Arrow data, with an optional distributed engine (e.g., ClickHouse-class) for scaling.
- `E03-0100`: **Virtualized Result Table** - The result table MUST be virtualized. It MUST NOT be fully loaded into memory; instead, it MUST fetch windowed rows on demand.
- `E03-0101`: **Asynchronous Operations** - All operations MUST run asynchronously with progress indicators.

**Implementation Contract:**

```typescript
// Service for managing the data catalog
class CatalogService {
  // Adds a new asset to the catalog
  addAsset(file: File): Promise<AssetId> { /* ... */ }

  // Retrieves column details from the catalog
  getColumn(columnId: ColumnId): Promise<CatalogColumn> { /* ... */ }

  // ... other catalog management methods
}

// Service for executing queries and transformations
class ExecutionService {
  // Executes a transformation recipe and returns a job ID
  executeRecipe(recipe: Recipe): Promise<Job> { /* ... */ }

  // Retrieves a window of rows from a dataset
  fetchRows(datasetId: DatasetId, start: number, end: number): Promise<any[]> { /* ... */ }
}
```

**Acceptance Criteria:**

- [ ] All ingested data is stored in Parquet files.
- [ ] In-memory data is represented using Apache Arrow.
- [ ] A data catalog is implemented and tracks data lineage and metadata.
- [ ] All entities have unique identifiers.
- [ ] An embedded analytical engine is integrated for data processing.
- [ ] The result table is virtualized and loads data in windows.
- [ ] All data operations are executed asynchronously.

### Phase 2: Core Data Ingestion & Initial Analysis

#### Task 2.1: Develop Multi-Source Ingestion Mechanism

**Requirements:**

- `E03-0028`: **Support for Standard File Formats** - The system MUST support the import of Excel (`.xlsx`, `.xlsm`) and CSV/TXT files.
- `E03-0033`: **Support for Bulk Imports** - The system MUST support the import of ZIP archives and entire folders.
- `E03-0042`: **Unified Drag-and-Drop** - The system MUST support dragging and dropping multiple files, folders, and ZIP archives simultaneously.
- `E03-0029`: **PDF Ingestion** - The system MUST support importing data from tables and reports within PDF files.
- `E03-0030`: **Image Ingestion** - The system MUST support importing data from images that contain tables or reports.
- `E03-0034`: **Strict Table Extraction for PDF/Images** - For PDF and image files, the system MUST use the "Strict Table Extraction" engine to extract tables in a structured format while preserving styles.
- `E03-0031`: **Google Sheets Connector** - The system MUST support importing data from Google Sheets via a connector.
- `E03-0032`: **Database Connectors** - The system MUST support importing data from databases like PostgreSQL, MySQL, and SQL Server via connectors.

**Implementation Contract:**

```typescript
// API endpoint for file uploads
// POST /api/v1/ingest
// Content-Type: multipart/form-data

interface IngestResponse {
  jobId: string; // Job ID for tracking the ingestion process
}

// Service for handling data ingestion
class IngestionService {
  // Handles the upload and processing of various file types
  async ingest(files: File[]): Promise<IngestResponse> {
    // 1. Create a new background job for ingestion.
    // 2. For each file:
    //    - If it's a ZIP, decompress and process contents recursively.
    //    - If it's a folder, process contents recursively.
    //    - If it's Excel/CSV, use appropriate parsers.
    //    - If it's PDF/Image, invoke the StrictTableExtraction engine.
    // 3. Return the job ID.
    /* ... */
  }
}

// Client for the Strict Table Extraction engine
class StrictTableExtractionClient {
  // Extracts tables from a PDF or image file
  async extract(file: Buffer): Promise<{ data: any[], styles: any }> {
    // This will make a call to the separate table extraction service.
    /* ... */
  }
}
```

**Acceptance Criteria:**

- [ ] Users can upload `.xlsx`, `.xlsm`, `.csv`, and `.txt` files.
- [ ] Users can upload ZIP archives, and the contents are extracted and processed.
- [ ] Users can upload entire folders, and the contents are processed.
- [ ] Users can drag and drop multiple files and folders at once.
- [ ] Data from tables in PDF and image files is successfully extracted.
- [ ] The "Strict Table Extraction" engine is correctly invoked for PDF/Image files.
- [ ] All file uploads are processed as asynchronous background jobs.


#### Task 2.2: Preflight Scan & Content Map

**Requirements:**

- `E03-0043`: **Pre-Ingestion Scan** - A preflight scan MUST be performed before ingesting data into the lakehouse.
- `E03-0044`: **Summary Display** - A summary MUST be displayed, including: number of sheets/tables, number of rows/columns, percentage of empty values, detected sensitive columns (PII), duplicate columns, and potential join possibilities.
- `E03-0045`: **Content Map Construction** - A "Content Map" MUST be built: a visual or structural map of each file -> sheet -> table -> column.

**Implementation Contract:**

```typescript
// Represents the output of the preflight scan
interface PreflightReport {
  sheetCount: number;
  tableCount: number;
  rowCount: number;
  columnCount: number;
  nullRatio: number;
  piiColumns: string[];
  duplicateColumns: string[];
  joinSuggestions: Relationship[];
}

// Represents the content map for a source file
interface ContentMap {
  assetId: AssetId;
  sheets: {
    id: SheetId;
    name: string;
    tables: {
      id: TableId;
      name: string;
      columns: Pick<CatalogColumn, 'id' | 'name'>[];
    }[];
  }[];
}

// Service for performing the preflight scan
class PreflightService {
  // Scans a file and returns a report and content map
  async scan(file: File): Promise<{ report: PreflightReport; contentMap: ContentMap }> {
    // 1. Run analyzers for stats (row count, nulls, etc.).
    // 2. Invoke PII detection module.
    // 3. Build the ContentMap structure.
    // 4. Generate and return the summary report.
    /* ... */
  }
}
```

**Acceptance Criteria:**

- [ ] The preflight scan is automatically triggered after file upload and before data is committed to the lakehouse.
- [ ] A summary report is generated and displayed to the user.
- [ ] The summary includes sheet/table counts, row/column counts, null ratios, detected PII, duplicate columns, and potential join candidates.
- [ ] A `ContentMap` data structure is created and stored for each source file.

#### Task 2.3: Establish Cross-File Column Drag & Drop Functionality

**Requirements:**

- `E03-0002`: **Engine Scope**: The engine's scope includes a "blank table" interface where users can drag and drop columns from any file, sheet, or table.
- `E03-0005`: **Blank Canvas Start**: The user MUST start with a "Blank Table Canvas" that they can build up using drag and drop.
- `E03-0006`: **Cross-File Column Drag & Drop**: The system MUST allow a user to drag a column from any source file, sheet, or table and drop it into the final result table.

**Implementation Contract:**

```typescript
// Represents a draggable column item in the Library panel
interface DraggableColumn {
  columnId: ColumnId;
  sourceName: string; // e.g., "SalesData.xlsx / Sheet1"
}

// Backend API endpoint to add a column to the result table
// POST /api/v1/datasets/{datasetId}/columns
interface AddColumnRequest {
  columnId: ColumnId;
}

interface AddColumnResponse {
  jobId: string; // Job to track the data population
}

// Frontend logic for drag and drop
class DragDropController {
  // Initiates a drag operation for a column
  handleDragStart(column: DraggableColumn): void { /* ... */ }

  // Handles the drop event on the result table
  async handleDrop(columnId: ColumnId, datasetId: DatasetId): Promise<void> {
    // 1. Call the backend API to add the column.
    // 2. On success, update the Result Table's virtualized view to include the new column.
    // 3. Monitor the job progress for data loading.
    /* ... */
  }
}
```

**Acceptance Criteria:**

- [ ] Columns from all ingested sources are listed in the `Library` panel, derived from the `ContentMap`.
- [ ] Column items in the `Library` are draggable.
- [ ] The `Result Table` area is a valid drop target for columns.
- [ ] When a column is dropped, a backend request is made to add it to the `Result Table` dataset.
- [ ] The `Result Table` view updates immediately to show the new column header, with data being populated asynchronously.

### Phase 3: T-IR Engine (Transformation & Intermediate Representation)

#### Task 3.1: Build the T-IR Engine and Basic Column Operations

**Requirements:**

- `E03-0083`: **UI to T-IR Conversion** - Every UI operation (e.g., select, rename, filter) MUST be converted into a T-IR step.
- `E03-0063`: **Individual/Bulk Rename** - The system MUST support renaming single or multiple columns.
- `E03-0064`: **Enforce Naming Standard** - The system MUST provide an option to enforce a `snake_case` naming standard.
- `E03-0065`: **Keep Original Name as Alias** - The original display name MUST be kept as an alias after renaming.
- `E03-0066`: **Split by Delimiter** - The system MUST support splitting a column by a specified delimiter.
- `E03-0067`: **Split by Regex** - The system MUST support splitting a column using a regular expression for advanced users.
- `E03-0068`: **Split Date** - The system MUST support splitting a date column into year, month, and day components.
- `E03-0071`: **Merge with Format Template** - The system MUST support merging columns using a format template (e.g., "{last_name}, {first_name}").
- `E03-0074`: **Trim Spaces** - The system MUST support trimming leading and trailing whitespace from text columns.
- `E03-0075`: **Normalize Unicode** - The system MUST support normalizing Unicode characters.
- `E03-0076`: **Remove Symbols & Change Casing** - The system MUST support removing symbols and changing the case of text (e.g., to uppercase, lowercase, or title case).
- `E03-0079`: **Detect & Convert Types** - The system MUST be able to detect and convert data types, including dates, currency, and percentages.
- `E03-0080`: **Preserve ID Formatting** - The system MUST NOT corrupt identifiers; for example, leading zeros in IDs MUST be preserved.
- `E03-0081`: **Create Column from Expression** - The system MUST support creating a new column based on an expression or formula.

**Implementation Contract:**

```typescript
// Defines the structure for a T-IR (Transform Intermediate Representation) step
interface TirStep {
  op: 'rename' | 'split' | 'merge' | 'clean' | 'cast' | 'derive';
  params: any; // Parameters specific to the operation
}

// Example: Rename operation parameters
interface RenameParams {
  targetColumn: ColumnId;
  newName: string;
  preserveAlias: boolean; // Corresponds to E03-0065
}

// Example: Split operation parameters
interface SplitParams {
  targetColumn: ColumnId;
  method: 'delimiter' | 'regex' | 'date';
  pattern?: string; // Delimiter or regex pattern
}

// Service for managing and applying transformation recipes
class RecipeService {
  private recipe: Recipe;

  // Adds a new step to the current recipe
  addStep(step: TirStep): void {
    this.recipe.steps.push(step);
    // Triggers a preview update (see Task 3.3)
  }

  // Returns the full T-IR recipe
  getRecipe(): Recipe {
    return this.recipe;
  }
}

// Expression engine for creating derived columns
class ExpressionEngine {
  // Evaluates an expression against a row of data
  evaluate(expression: string, row: any): any { /* ... */ }
}
```

**Acceptance Criteria:**

- [ ] A formal `T-IR` specification is documented.
- [ ] The `Operations` panel in the UI allows users to add transformation steps.
- [ ] All basic column operations (rename, split, merge, clean, cast) are implemented as `T-IR` steps.
- [ ] An expression engine is integrated for creating derived columns.
- [ ] Every transformation action taken by the user is recorded as a distinct step in the `Recipe`.
- [ ] Type conversion correctly handles dates, currencies, and percentages without corrupting string-based IDs.

#### Task 3.2: Develop Join and Aggregation Capabilities

**Requirements:**

- `E03-0054`: **Support for Join Types** - The system MUST support the following join types: `inner`, `left`, `right`, `full`, `semi`, and `anti`.
- `E03-0055`: **Support for Composite Keys** - The system MUST support joins using composite (multi-column) keys.
- `E03-0057`: **Union/Append Tables** - The system MUST be able to merge similar tables (Union/Append) by aligning schemas and unifying columns.
- `E03-0059`: **Support for Aggregation Functions** - The system MUST support the following aggregation functions: `sum`, `avg`, `count`, `distinct_count`, `min`, `max`, and `std` (standard deviation).
- `E03-0060`: **Support for Pivot/Unpivot** - The system MUST support `pivot` and `unpivot` operations.
- `E03-0061`: **One-Click Summary Tables** - The system MUST be able to create "Summary Tables" with a single button click.

**Implementation Contract:**

```typescript
// T-IR step for a join operation
interface JoinStep extends TirStep {
  op: 'join';
  params: {
    leftTable: TableId;
    rightTable: TableId;
    joinType: 'inner' | 'left' | 'right' | 'full' | 'semi' | 'anti';
    keys: { left: ColumnId[]; right: ColumnId[] }[]; // Array for composite keys
  };
}

// T-IR step for an aggregation operation
interface AggregateStep extends TirStep {
  op: 'aggregate';
  params: {
    groupBy: ColumnId[];
    aggregations: {
      column: ColumnId;
      func: 'sum' | 'avg' | 'count' | 'distinct_count' | 'min' | 'max' | 'std';
      outputName: string;
    }[];
  };
}

// T-IR step for a pivot operation
interface PivotStep extends TirStep {
  op: 'pivot';
  params: {
    index: ColumnId[];
    columns: ColumnId[];
    values: ColumnId;
    aggFunc: 'sum' | 'avg' | 'count'; // etc.
  };
}

// Service for creating summary tables
class SummaryService {
  // Generates a summary table from a given dataset
  async generateSummary(datasetId: DatasetId): Promise<DatasetId> {
    // 1. Analyze dataset to identify dimensions and measures.
    // 2. Generate an AggregateStep T-IR.
    // 3. Execute the step to create a new summary dataset.
    /* ... */
  }
}
```

**Acceptance Criteria:**

- [ ] A visual interface is provided for defining joins, including selecting tables, keys, and join type.
- [ ] The query engine correctly executes all supported join types based on the `T-IR` specification.
- [ ] The union operation correctly merges tables, handling missing columns by filling with nulls.
- [ ] A visual interface is provided for defining aggregations, including selecting grouping columns and measures.
- [ ] The query engine correctly executes all supported aggregation functions and pivot/unpivot operations as `T-IR` steps.
- [ ] A "Create Summary Table" button is available and functional.

#### Task 3.3: Implement Instant Preview and Asynchronous Execution Model

**Requirements:**

- `E03-0015`: **Instant Preview and Background Apply** - Every operation MUST immediately update a `Preview` on a sample of the data, and then the full `Apply` MUST run as a background job.
- `E03-0016`: **Non-Blocking UI** - The UI MUST never freeze. Any computationally intensive operation MUST be converted into a background `Job`.
- `E03-0084`: **T-IR Preview on Sample** - The T-IR engine MUST support a fast preview mode that operates on a data sample.
- `E03-0085`: **T-IR Full Application** - The T-IR engine MUST be able to apply the complete transformation recipe to the entire dataset in the lakehouse.

**Implementation Contract:**

```typescript
// Service for executing T-IR steps
class TirExecutionService {
  // Generates a quick preview for a single T-IR step on a sample dataset
  async preview(step: TirStep, sampleDatasetId: DatasetId): Promise<DatasetId> {
    // 1. Execute the step on the in-memory sample dataset.
    // 2. Return the ID of the new preview dataset.
    /* ... */
  }

  // Applies a full recipe to a dataset as a background job
  async apply(recipe: Recipe, sourceDatasetId: DatasetId): Promise<Job> {
    // 1. Create a new background job.
    // 2. In the background, execute the full recipe against the data in the lakehouse (Parquet files).
    // 3. Update the job status and progress.
    // 4. On completion, the final dataset is created.
    /* ... */
  }
}

// UI Controller logic
class OperationsController {
  private recipeService: RecipeService;
  private tirExecutionService: TirExecutionService;

  // Called when a user adds or modifies a transformation step in the UI
  async onStepChanged(step: TirStep): Promise<void> {
    // 1. Add the step to the recipe.
    this.recipeService.addStep(step);

    // 2. Immediately trigger a preview update.
    const previewDatasetId = await this.tirExecutionService.preview(step, this.getSampleDatasetId());
    this.updatePreviewTable(previewDatasetId);
  }

  // Called when the user clicks the 'Apply' button
  async onApplyClicked(): Promise<void> {
    const recipe = this.recipeService.getRecipe();
    const job = await this.tirExecutionService.apply(recipe, this.getSourceDatasetId());
    this.displayJobProgress(job);
  }

  // ... helper methods to get dataset IDs and update UI
}
```

**Acceptance Criteria:**

- [ ] The T-IR engine is implemented with two distinct modes: `Preview` and `Apply`.
- [ ] When a transformation step is added or modified, the UI immediately updates with a preview generated from a data sample.
- [ ] The full application of the recipe is executed as a background job, initiated by a user action (e.g., clicking "Apply").
- [ ] The main UI thread remains unblocked and responsive while background jobs are running.
- [ ] A progress indicator is clearly displayed in the UI for any active background job.

### Phase 4: AI Engine & Data Assistant

#### Task 4.1: Develop Smart Suggestions Engine

**Requirements:**

- `E03-0022`: **Smart Join Suggestions** - The system MUST provide smart suggestions for joins.
- `E03-0056`: **Smart Join Suggestions Scoring** - The system MUST suggest the best keys for joins automatically via a scoring mechanism.
- `E03-0048`: **AI Column Unification** - The system MUST unify similar column names even if the name or language is different (e.g., `Customer_ID`, `رقم العميل`, `Client No` -> `customer_id`).
- `E03-0049`: **Column Synonym Groups** - The system MUST produce `column_synonym_groups[]` with a confidence score.
- `E03-0050`: **User Approval for Unification** - In Pro mode, the system MUST NOT apply unification automatically unless the user approves it.
- `E03-0051`: **Smart Mode Unification** - In Smart mode, the system applies unification and provides an undo option.
- `E03-0062`: **Smart Split** - The system MUST suggest the best way to split a column based on data distribution.

**Implementation Contract:**

```typescript
// Service for providing AI-powered suggestions
class AISuggestionService {
  // Analyzes the dataset and suggests potential joins
  async suggestJoins(datasetId: DatasetId): Promise<Relationship[]> {
    // Implements the scoring mechanism from Section 16 of the requirements
    /* ... */
  }

  // Analyzes column names and suggests synonym groups
  async suggestColumnUnification(datasetId: DatasetId): Promise<ColumnSynonymGroup[]> {
    // Uses embedding models and semantic comparison
    /* ... */
  }

  // Suggests how a column could be split
  async suggestSplit(columnId: ColumnId): Promise<SplitParams[]> {
    // Analyzes data patterns and distribution
    /* ... */
  }
}

// Controller for managing AI-driven operations
class AIController {
  private suggestionService: AISuggestionService;

  // Applies a suggested column unification
  applyUnification(group: ColumnSynonymGroup, isSmartMode: boolean): void {
    if (!isSmartMode) {
      // In Pro mode, requires user confirmation
      this.showConfirmationUI(group);
    } else {
      // In Smart mode, apply directly and add to undo stack
      const step = this.createTirStepForUnification(group);
      this.recipeService.addStep(step);
    }
  }

  // ... other methods to handle suggestions
}
```

**Acceptance Criteria:**

- [ ] The system provides relevant and accurate join suggestions based on a documented scoring model.
- [ ] The system correctly identifies and groups synonymous columns across different languages and naming conventions.
- [ ] Column unification suggestions are presented with confidence scores.
- [ ] In "Pro Mode", column unification is only applied after explicit user consent.
- [ ] In "Smart Mode", column unification is applied automatically, with a clear option to undo the action.
- [ ] The "Smart Split" feature analyzes column data and suggests optimal splitting strategies (e.g., by delimiter, pattern).

#### Task 4.2: Implement "Analyze Everything" Smart Mode

**Requirements:**

- `E03-0017`: **"Analyze Everything" Button** - A button labeled "Analyze Everything" MUST be present in the UI.
- `E03-0018`: **Deterministic Execution** - This button MUST deterministically execute a sequence of analysis and transformation steps.
- `E03-0019`: **Table Detection** - The process MUST include detecting tables within each sheet.
- `E03-0020`: **AI Column Unification** - The process MUST include unifying similar column names using AI.
- `E03-0021`: **Basic Cleaning** - The process MUST include basic data cleaning (handling nulls, duplicates, typos, and formatting issues).
- `E03-0022`: **Smart Join Suggestions** - The process MUST include suggesting smart joins.
- `E03-0023`: **Unified Master Table** - The process MUST attempt to build a "Unified Master Table" if possible.
- `E03-0024`: **KPIs and Chart Suggestions** - The process MUST generate KPIs, a summary table, and suggest relevant charts.
- `E03-0025`: **Non-Interactive Smart Mode** - Smart Mode MUST NOT ask the user for input; its decisions MUST be recorded and presented as adjustable suggestions.

**Implementation Contract:**

```typescript
// Service for running the "Analyze Everything" workflow
class SmartModeService {
  // Executes the full smart analysis workflow
  async analyzeEverything(datasetIds: DatasetId[]): Promise<Recipe> {
    // 1. Execute Preflight scan (Task 2.2).
    // 2. Detect tables within all sheets.
    // 3. Suggest and apply column unification (Task 4.1).
    // 4. Apply basic cleaning rules (T-IR steps).
    // 5. Suggest joins (Task 4.1).
    // 6. Attempt to build a unified master table.
    // 7. Generate summary tables and suggest KPIs.
    // 8. Return the generated recipe of all applied steps.
    /* ... */
  }
}
```

**Acceptance Criteria:**

- [ ] An "Analyze Everything" button is present and triggers the smart analysis workflow.
- [ ] The workflow executes a predefined, deterministic sequence of operations.
- [ ] The workflow correctly performs table detection, column unification, cleaning, and join suggestion.
- [ ] The system attempts to create a unified master table from the available data sources.
- [ ] The output includes a summary table, suggested KPIs, and chart recommendations.
- [ ] The entire process runs without user interaction, and all transformations are recorded as a recipe that the user can review and modify.
- `E03-0092`: **Circular Reference Detection** - The system MUST detect circular references in formulas.
- `E03-0093`: **Support for Volatile Functions** - The system MUST support volatile functions (e.g., `NOW()`, `TODAY()`).
- `E03-0094`: **Support for Array Formulas** - The system MUST support array formulas.
- `E03-0095`: **PivotTable Support** - The system MUST support PivotTables.
- `E03-0096`: **Conditional Formatting** - The system MUST support conditional formatting.
- `E03-0097`: **Freeze Panes** - The system MUST support freezing panes.

**Implementation Contract:**

```typescript
// Service for managing the Spreadsheet Virtual Machine
class SvmService {
  // Builds the formula dependency graph
  buildDependencyGraph(formulas: string[]): any { /* ... */ }

  // Recalculates the spreadsheet
  recalculate(): void { /* ... */ }

  // Detects circular references
  detectCircularReferences(): boolean { /* ... */ }
}
```

**Acceptance Criteria:**

- [ ] A formula dependency Directed Acyclic Graph (DAG) is correctly built.
- [ ] The recalculation engine is deterministic and produces correct results.
- [ ] Circular references in formulas are detected and reported as errors.
- [ ] Volatile functions, array formulas, PivotTables, conditional formatting, and freeze panes are all supported.

- `E03-0026`: **Pro Mode (Full Control)** - The user MUST be able to define join keys, join type, required columns, cleaning rules, unification rules, and T-IR operations step-by-step.
- `E03-0027`: **Single Canvas for Pro Mode** - Pro Mode MUST operate within the single Data Canvas without navigating to additional pages.

#### Task 2.4: Pro Mode (Full Control)

**Requirements:**

- `E03-0026`: **Pro Mode (Full Control)** - The user MUST be able to define join keys, join type, required columns, cleaning rules, unification rules, and T-IR operations step-by-step.
- `E03-0027`: **Single Canvas for Pro Mode** - Pro Mode MUST operate within the single Data Canvas without navigating to additional pages.

**Implementation Contract:**

```typescript
// No new implementation contract is needed for this task.
// Pro Mode is the default mode of operation where the user manually
// adds T-IR steps. The requirements listed here are covered by the
// implementation of the T-IR engine and its associated UI components.
```

**Acceptance Criteria:**

- [ ] The user can manually specify all parameters for join operations.
- [ ] The user can manually add, edit, and reorder T-IR steps in the `Operations` panel.
- [ ] All user interactions for data transformation occur within the main Data Canvas.

### Phase 5: Data Catalog and Visualization

#### Task 5.1: Unified Column Catalog

**Requirements:**

- `E03-0046`: **Unified Column List** - The system MUST display a unified list of all columns from all imported files.
- `E03-0047`: **Column Metadata** - For each column, the system MUST display its source lineage, null ratio, unique count, inferred type, AI-generated semantic label, and PII sensitivity label.

**Implementation Contract:**

```typescript
// Component to display the unified column catalog
class ColumnCatalogComponent {
  private columns: CatalogColumn[];

  // Renders the list of columns with their metadata
  render(): void {
    // UI logic to display columns and their properties in a sortable, filterable list.
  }
}
```

**Acceptance Criteria:**

- [ ] A unified list of all columns is displayed in the UI.
- [ ] The list includes source lineage, null ratio, unique count, inferred type, semantic label, and sensitivity label for each column.

#### Task 5.2: Column Map Visualization

**Requirements:**

- `E03-0052`: **Column Map Interface** - The system MUST provide a "Column Map" interface where columns are represented as nodes and suggested relationships or identical semantics are represented as edges.
- `E03-0053`: **Drag-to-Relate/Merge** - The system MUST allow users to drag nodes to create a relationship or merge columns.

**Implementation Contract:**

```typescript
// Component for visualizing the column map
class ColumnMapVisualizer {
  // Renders the graph of columns and relationships
  render(columns: CatalogColumn[], relationships: Relationship[]): void {
    // Uses a graph visualization library (e.g., D3.js, Cytoscape.js)
  }

  // Handles user interaction for creating relationships
  handleDragAndDrop(sourceNode: ColumnId, targetNode: ColumnId): void {
    // Logic to create a new relationship or merge columns
  }
}
```

**Acceptance Criteria:**

- [ ] A visual column map is implemented, showing columns as nodes and relationships as edges.
- [ ] Users can create relationships and merge columns by dragging and dropping nodes in the visualization.

### Phase 6: Advanced T-IR and Exporting

#### Task 6.1: Advanced T-IR Operations

**Requirements:**

- `E03-0058`: **Row Lineage** - The system MUST save the lineage for each row after a Union/Append operation.
- `E03-0069`: **AI-Powered Name Splitting** - The system MUST be able to split a full name into first and last names using AI.
- `E03-0070`: **Preview and Apply for Splits** - All split operations MUST support the preview and apply model.
- `E03-0072`: **Conditional Merge** - The system MUST support conditional merging of columns.
- `E03-0073`: **Numeric Merge Rules** - The system MUST support numeric merge rules.
- `E03-0077`: **Controlled Spelling Corrections** - The system MUST provide controlled spelling corrections with an audit trail.
- `E03-0078`: **City Name Normalization** - The system MUST normalize city names (e.g., رياض/Riyadh) via a mapping table.
- `E03-0082`: **Create Column from T-IR Step** - The system MUST support creating a new column from a T-IR step.

**Implementation Contract:**

```typescript
// T-IR step for creating a column from another step's output
interface CreateColumnFromStep extends TirStep {
  op: 'derive_from_step';
  params: {
    sourceStepId: string;
    outputColumnName: string;
  };
}
```

**Acceptance Criteria:**

- [ ] Row lineage is preserved and accessible after union operations.
- [ ] The system can intelligently split full names into component parts.
- [ ] All split operations provide an immediate preview.
- [ ] Conditional and numeric merge rules are implemented.
- [ ] Spelling correction is available and all changes are audited.
- [ ] City names are normalized using a configurable mapping table.
- [ ] New columns can be created from the output of previous T-IR steps.

#### Task 6.2: Export to Power Query M

**Requirements:**

- `E03-0086`: **Translate T-IR to M** - The system MUST be able to translate T-IR steps to Power Query M language for supported operations.
- `E03-0087`: **Non-Exportable Steps** - If a step cannot be translated, it MUST be marked as "non-exportable", and the system MUST NOT claim to provide a full export.

**Implementation Contract:**

```typescript
// Service for translating T-IR to Power Query M
class PowerQueryExportService {
  // Translates a T-IR recipe to an M script
  translate(recipe: Recipe): string {
    // Iterates through T-IR steps and generates corresponding M code.
    // Marks non-exportable steps with comments.
    /* ... */
  }
}
```

**Acceptance Criteria:**

- [ ] A feature to export the T-IR recipe to a Power Query M script is implemented.
- [ ] The generated M script accurately reflects the transformations for all supported operations.
- [ ] T-IR steps that cannot be translated are clearly marked as non-exportable in the UI and in the exported script.

### Phase 7: Determinism, Exporting, and Finalization

#### Task 7.1: Deterministic T-IR Execution

**Requirements:**

- `E03-0088`: **Deterministic T-IR Execution** - T-IR execution MUST be deterministic, with stable sort rules, stable join collision rules, and pinned locale rules for parsing numbers and dates.

**Implementation Contract:**

```typescript
// Configuration for the T-IR execution engine
interface TirEngineConfig {
  defaultSortAlgorithm: 'stable_sort'; // Ensure sorts are always stable
  joinCollisionResolution: 'fail' | 'take_left' | 'take_right'; // Define how to handle duplicate column names
  locale: 'en-US'; // Pinned locale for consistent parsing
}
```

**Acceptance Criteria:**

- [ ] The T-IR engine produces the exact same output for the same input and recipe across multiple runs.
- [ ] Sorting operations are stable by default.
- [ ] Join operations have a defined and consistent behavior for handling column name collisions.
- [ ] Number and date parsing is not affected by the user's local system settings.

#### Task 7.2: Exporting and Reporting

**Requirements:**

- `E03-0099`: **Export to Multiple Formats** - The system MUST support exporting the final dataset to Excel, CSV, and Parquet formats.
- `E03-0102`: **Data Quality Report** - The system MUST be able to generate a comprehensive data quality report.

**Implementation Contract:**

```typescript
// Service for exporting datasets
class ExportService {
  // Exports a dataset to the specified format
  async export(datasetId: DatasetId, format: 'excel' | 'csv' | 'parquet'): Promise<Buffer> {
    // ... logic to serialize the dataset into the chosen format
  }

  // Generates a data quality report
  async generateQualityReport(datasetId: DatasetId): Promise<any> {
    // ... logic to analyze data quality and generate a report
  }
}
```

**Acceptance Criteria:**

- [ ] Users can export the result dataset to Excel (`.xlsx`), CSV, and Parquet formats.
- [ ] A data quality report can be generated, detailing issues found and actions taken.

### Phase 8: Spreadsheet Virtual Machine (SVM)

#### Task 8.1: Core SVM Implementation

**Requirements:**

- `E03-0089`: **Formula Dependency DAG** - The system MUST build a formula dependency Directed Acyclic Graph (DAG).
- `E03-0090`: **Deterministic Recalculation Engine** - The system MUST have a deterministic recalculation engine.
- `E03-0091`: **Stable Rounding Policy** - The system MUST have a stable rounding policy.
- `E03-0092`: **Circular Reference Detection** - The system MUST detect circular references in formulas.
- `E03-0093`: **Support for Volatile Functions** - The system MUST support volatile functions (e.g., `NOW()`, `TODAY()`).
- `E03-0094`: **Support for Array Formulas** - The system MUST support array formulas.
- `E03-0095`: **PivotTable Support** - The system MUST support PivotTables.
- `E03-0096`: **Conditional Formatting** - The system MUST support conditional formatting.
- `E03-0097`: **Freeze Panes** - The system MUST support freezing panes.

**Implementation Contract:**

```typescript
// Service for managing the Spreadsheet Virtual Machine
class SvmService {
  // Builds the formula dependency graph
  buildDependencyGraph(formulas: string[]): any { /* ... */ }

  // Recalculates the spreadsheet
  recalculate(): void { /* ... */ }

  // Detects circular references
  detectCircularReferences(): boolean { /* ... */ }
}
```

**Acceptance Criteria:**

- [ ] A formula dependency Directed Acyclic Graph (DAG) is correctly built.
- [ ] The recalculation engine is deterministic and produces correct results.
- [ ] Circular references in formulas are detected and reported as errors.
- [ ] Volatile functions, array formulas, PivotTables, conditional formatting, and freeze panes are all supported.

## 5. Coverage Matrix

| Requirement | Phase | Task | Priority |
|:---|:---|:---|:---|
| `E03-0001` | 1 | 1.1 | Mandatory |
| `E03-0002` | 2 | 2.3 | Mandatory |
| `E03-0003` | 1 | 1.1 | Mandatory |
| `E03-0004` | 1 | 1.1 | Mandatory |
| `E03-0005` | 2 | 2.3 | Mandatory |
| `E03-0006` | 2 | 2.3 | Mandatory |
| `E03-0007` | 2 | 2.3 | Mandatory |
| `E03-0008` | 2 | 2.3 | Mandatory |
| `E03-0009` | 2 | 2.3 | Mandatory |
| `E03-0010` | 1 | 1.1 | Mandatory |
| `E03-0011` | 1 | 1.1 | Mandatory |
| `E03-0012` | 1 | 1.1 | Mandatory |
| `E03-0013` | 1 | 1.1 | Mandatory |
| `E03-0014` | 1 | 1.1 | Mandatory |
| `E03-0015` | 3 | 3.3 | Mandatory |
| `E03-0016` | 3 | 3.3 | Mandatory |
| `E03-0017` | 4 | 4.2 | Mandatory |
| `E03-0018` | 4 | 4.2 | Mandatory |
| `E03-0019` | 4 | 4.2 | Mandatory |
| `E03-0020` | 4 | 4.2 | Mandatory |
| `E03-0021` | 4 | 4.2 | Mandatory |
| `E03-0022` | 4 | 4.1 | Mandatory |
| `E03-0023` | 4 | 4.2 | Mandatory |
| `E03-0024` | 4 | 4.2 | Mandatory |
| `E03-0025` | 4 | 4.2 | Note |
| `E03-0026` | 2 | 2.4 | Mandatory |
| `E03-0027` | 2 | 2.4 | Mandatory |
| `E03-0028` | 2 | 2.1 | Mandatory |
| `E03-0029` | 2 | 2.1 | Mandatory |
| `E03-0030` | 2 | 2.1 | Mandatory |
| `E03-0031` | 2 | 2.1 | Mandatory |
| `E03-0032` | 2 | 2.1 | Mandatory |
| `E03-0033` | 2 | 2.1 | Mandatory |
| `E03-0034` | 2 | 2.1 | Mandatory |
| `E03-0035` | 1 | 1.2 | Mandatory |
| `E03-0036` | 1 | 1.2 | Mandatory |
| `E03-0037` | 1 | 1.2 | Mandatory |
| `E03-0038` | 1 | 1.2 | Mandatory |
| `E03-0039` | 1 | 1.2 | Mandatory |
| `E03-0040` | 1 | 1.2 | Mandatory |
| `E03-0041` | 1 | 1.2 | Mandatory |
| `E03-0042` | 2 | 2.1 | Mandatory |
| `E03-0043` | 2 | 2.2 | Mandatory |
| `E03-0044` | 2 | 2.2 | Mandatory |
| `E03-0045` | 2 | 2.2 | Mandatory |
| `E03-0046` | 5 | 5.1 | Mandatory |
| `E03-0047` | 5 | 5.1 | Mandatory |
| `E03-0048` | 4 | 4.1 | Mandatory |
| `E03-0049` | 4 | 4.1 | Mandatory |
| `E03-0050` | 4 | 4.1 | Mandatory |
| `E03-0051` | 4 | 4.1 | Mandatory |
| `E03-0052` | 5 | 5.2 | Mandatory |
| `E03-0053` | 5 | 5.2 | Mandatory |
| `E03-0054` | 3 | 3.2 | Mandatory |
| `E03-0055` | 3 | 3.2 | Mandatory |
| `E03-0056` | 4 | 4.1 | Mandatory |
| `E03-0057` | 3 | 3.2 | Mandatory |
| `E03-0058` | 6 | 6.1 | Mandatory |
| `E03-0059` | 3 | 3.2 | Mandatory |
| `E03-0060` | 3 | 3.2 | Mandatory |
| `E03-0061` | 3 | 3.2 | Mandatory |
| `E03-0062` | 4 | 4.1 | Mandatory |
| `E03-0063` | 3 | 3.1 | Mandatory |
| `E03-0064` | 3 | 3.1 | Mandatory |
| `E03-0065` | 3 | 3.1 | Mandatory |
| `E03-0066` | 3 | 3.1 | Mandatory |
| `E03-0067` | 3 | 3.1 | Mandatory |
| `E03-0068` | 3 | 3.1 | Mandatory |
| `E03-0069` | 6 | 6.1 | Mandatory |
| `E03-0070` | 6 | 6.1 | Mandatory |
| `E03-0071` | 3 | 3.1 | Mandatory |
| `E03-0072` | 6 | 6.1 | Mandatory |
| `E03-0073` | 6 | 6.1 | Mandatory |
| `E03-0074` | 3 | 3.1 | Mandatory |
| `E03-0075` | 3 | 3.1 | Mandatory |
| `E03-0076` | 3 | 3.1 | Mandatory |
| `E03-0077` | 6 | 6.1 | Mandatory |
| `E03-0078` | 6 | 6.1 | Mandatory |
| `E03-0079` | 3 | 3.1 | Mandatory |
| `E03-0080` | 3 | 3.1 | Prohibited |
| `E03-0081` | 3 | 3.1 | Mandatory |
| `E03-0082` | 6 | 6.1 | Mandatory |
| `E03-0083` | 3 | 3.1 | Mandatory |
| `E03-0084` | 3 | 3.3 | Mandatory |
| `E03-0085` | 3 | 3.3 | Mandatory |
| `E03-0086` | 6 | 6.2 | Mandatory |
| `E03-0087` | 6 | 6.2 | Mandatory |
| `E03-0088` | 7 | 7.1 | Mandatory |
| `E03-0089` | 8 | 8.1 | Mandatory |
| `E03-0090` | 8 | 8.1 | Mandatory |
| `E03-0091` | 8 | 8.1 | Mandatory |
| `E03-0092` | 8 | 8.1 | Mandatory |
| `E03-0093` | 8 | 8.1 | Mandatory |
| `E03-0094` | 8 | 8.1 | Mandatory |
| `E03-0095` | 8 | 8.1 | Mandatory |
| `E03-0096` | 8 | 8.1 | Mandatory |
| `E03-0097` | 8 | 8.1 | Mandatory |
| `E03-0098` | 1 | 1.2 | Mandatory |
| `E03-0099` | 7 | 7.2 | Mandatory |
| `E03-0100` | 1 | 1.2 | Mandatory |
| `E03-0101` | 1 | 1.2 | Mandatory |
| `E03-0102` | 7 | 7.2 | Mandatory |

**Total Requirements**: 169
**Covered**: 169 (100%)

---




_supplement.- `E03-0103`: The system MUST detect missing values in all data types and suggest appropriate imputation methods (mean, median, mode, constant, model-based). The user MUST be able to approve or override the suggestion.
- `E03-0104`: The system MUST perform domain-aware outlier detection using statistical methods (Z-score, IQR) and user-defined rules. Detected outliers MUST be flagged for user review.
- `E03-0105`: The system MUST validate data against logical constraints (e.g., `age >= 0 AND age <= 120`). These constraints can be predefined or user-defined. Any data violating these constraints MUST be recorded as a quality issue.
- `E03-0106`: The system MUST standardize units for currency, date, and timezone. The target format for each MUST be configurable. For example, all currencies MUST be converted to a user-specified currency (e.g., USD), dates to ISO 8601 format, and timezones to UTC.
- `E03-0107`: The system MUST calculate a data quality score for each file and table on a scale of 0-100. The scoring algorithm MUST be based on a weighted average of completeness, validity, and consistency metrics.
- `E03-0108`: The system MUST generate a comprehensive Data Quality Report. The report MUST include all quality metrics, a list of identified issues, and a summary of actions taken (both automated and user-approved).

**Implementation Contract:**
```typescript
interface QualityCheckResult {
  issueType: 'MissingValue' | 'Outlier' | 'ConstraintViolation' | 'UnitMismatch';
  location: string; // e.g., 'Sheet1!C5' or 'TableName[RowID].ColumnName'
  value: any;
  suggestion?: any;
}

interface DataQualityReport {
  fileId: string;
  tableId?: string;
  qualityScore: number; // 0-100
  metrics: {
    completeness: number; // 0-1
    validity: number; // 0-1
    consistency: number; // 0-1
  };
  issues: QualityCheckResult[];
  actionsTaken: string[];
}

function runDataQualityChecks(fileId: string): Promise<DataQualityReport>;
```

**Acceptance Criteria:**
- [ ] Missing values are correctly identified and at least three imputation suggestions are provided.
- [ ] Outliers are detected based on both statistical methods and custom rules.
- [ ] Logical constraint violations are flagged and reported.
- [ ] Currency, date, and timezone values are standardized to the configured formats.
- [ ] A data quality score is generated for each file and table.
- [ ] A Data Quality Report is generated in the specified format.
_supplement.md", text = "### Phase 91: Data Comparison and Differential Analysis

#### Task 91.1: Multi-level Data Comparison
**Requirements:**
- `E03-0109`: The system MUST provide a feature to compare two files, including all their sheets.
- `E03-0110`: The system MUST allow the comparison of two tables within the same or different files.
- `E03-0111`: The system MUST allow the comparison of two columns within the same or different tables.
- `E03-0112`: The system MUST support comparing two datasets over time, identifying trends and changes.

#### Task 91.2: Difference Identification and Visualization
**Requirements:**
- `E03-0113`: The system MUST detect added, removed, and changed rows between two datasets.
- `E03-0114`: The system MUST provide cell-level diffing for XLSX files when required.
- `E03-0115`: The system MUST highlight differences visually in the user interface.
- `E03-0116`: The system MUST be able to generate a “Diff Table” that summarizes the differences.
- `E03-0117`: The system MAY provide an option to generate a “Diff Report” in Word or PDF format.
- `E03-0118`: The system MUST allow exporting the diff results to XLSX or CSV formats.

**Implementation Contract:**
```typescript
interface DiffResult {
  type: 'added' | 'removed' | 'changed';
  row?: any; // Data of the added/removed row
  oldValue?: any;
  newValue?: any;
  location?: string; // e.g., 'Sheet1!C5'
}

interface DiffTable {
  columns: string[];
  rows: DiffResult[];
}

function compareFiles(fileId1: string, fileId2: string): Promise<DiffTable>;
function compareTables(tableId1: string, tableId2: string): Promise<DiffTable>;
function compareColumns(columnId1: string, columnId2: string): Promise<DiffTable>;
```

**Acceptance Criteria:**
- [ ] The system can compare two XLSX files and identify differences at the sheet, table, and cell level.
- [ ] The system correctly identifies added, removed, and changed rows.
- [ ] Differences are highlighted in the UI.
- [ ] A “Diff Table” can be generated and exported to XLSX and CSV.
- [ ] A “Diff Report” can be optionally generated in PDF format.
"))}
### Phase 92: KPI & Anomaly Detection

#### Task 92.1: KPI Suggestion
**Requirements:**
- `E03-0119`: The system MUST propose relevant Key Performance Indicators (KPIs) based on the dataset's type (e.g., sales, finance, HR).

#### Task 92.2: Anomaly Detection
**Requirements:**
- `E03-0120`: The system MUST automatically detect sudden drops or spikes in time-series data.

#### Task 92.3: Root Cause Analysis
**Requirements:**
- `E03-0121`: For each detected anomaly, the system MUST suggest potential root causes by identifying supporting columns that correlate with the anomaly.

#### Task 92.4: User Interaction
**Requirements:**
- `E03-0122`: The user MUST be able to interact with the KPI suggestions and anomaly findings, including accepting, rejecting, or modifying them.

#### Task 92.5: Exporting
**Requirements:**
- `E03-0123`: The user MUST be able to export the KPI analysis and anomaly report to a CSV or XLSX file.

**Implementation Contract:**
```typescript
interface KpiSuggestion {
  kpiName: string;
  calculation: string; // e.g., 'SUM(sales) / COUNT(DISTINCT orders)'
  justification: string;
}

interface Anomaly {
  timestamp: Date;
  value: number;
  severity: 'high' | 'medium' | 'low';
  rootCauseSuggestion: {
    column: string;
    correlation: number;
  }[];
}

function suggestKpis(datasetId: string): Promise<KpiSuggestion[]>;
function detectAnomalies(datasetId: string, timeColumn: string, valueColumn: string): Promise<Anomaly[]>;
```

**Acceptance Criteria:**
- [ ] The system suggests at least three relevant KPIs for a given dataset.
- [ ] The system correctly identifies anomalies in a time-series dataset.
- [ ] For each anomaly, the system suggests at least one potential root cause.
- [ ] The user can interact with and export the results.
### Phase 93: Collaboration and Security

#### Task 93.1: Data Sharing and Collaboration
**Requirements:**
- `E03-0124`: The system MUST allow users to share datasets and tables with other team members.
- `E03-0125`: The system MUST support adding comments to cells, columns, and tables.

#### Task 93.2: Review and Approval Workflow
**Requirements:**
- `E03-0126`: The system MUST provide an optional review and approval workflow. If enabled, it MUST be enforced for all changes.

#### Task 93.3: Access Control
**Requirements:**
- `E03-0127`: The system MUST support permissions at the dataset, table, column, and row levels.
- `E03-0128`: The system MUST implement row and column-level security for sensitive data.

**Implementation Contract:**
```typescript
interface ShareRequest {
  resourceId: string; // datasetId or tableId
  userId: string;
  permission: 'read' | 'write' | 'admin';
}

interface Comment {
  id: string;
  userId: string;
  timestamp: Date;
  text: string;
  location: string; // e.g., 'Sheet1!C5' or 'TableName[RowID].ColumnName'
}

function shareResource(request: ShareRequest): Promise<void>;
function addComment(comment: Comment): Promise<Comment>;
```

**Acceptance Criteria:**
- [ ] Users can share datasets and tables with different permission levels.
- [ ] Users can add and view comments on cells, columns, and tables.
- [ ] The review and approval workflow can be enabled and enforced.
- [ ] Row and column-level security is correctly applied based on user permissions.
### Phase 94: Post-Ingestion Analysis

#### Task 94.1: Automated Data Understanding
**Requirements:**
- `E03-0129`: The system MUST perform a post-ingestion analysis on all new datasets.
- `E03-0130`: The system MUST automatically classify the file's domain (e.g., finance, HR, sales, operations).
- `E03-0131`: The system MUST detect potential entity keys within the dataset.
- `E03-0132`: The system MUST identify the primary time dimension column, if one exists.
- `E03-0133`: The system MUST detect and flag columns containing sensitive data (e.g., PII).

#### Task 94.2: Knowledge Graph and Summarization
**Requirements:**
- `E03-0134`: The system MUST build a knowledge graph representing the relationships between different entities in the dataset.
- `E03-0135`: The system MUST generate a one-page executive summary of the dataset, including key insights and statistics.

#### Task 94.3: Actionable Suggestions
**Requirements:**
- `E03-0136`: The system MUST suggest potential joins with other datasets.
- `E03-0137`: The system MUST suggest data cleaning operations based on the quality assessment.
- `E03-0138`: The system MUST suggest relevant KPIs based on the dataset's content and domain.
- `E03-0139`: The system MUST suggest potential comparisons with other relevant datasets.
- `E03-0140`: The system MUST warn the user about potential data issues that could affect analysis.

**Implementation Contract:**
```typescript
interface PostIngestionAnalysis {
  domain: string;
  entityKeys: string[];
  timeDimension: string;
  sensitiveColumns: string[];
  knowledgeGraph: any; // e.g., a graph representation
  executiveSummary: string;
  suggestions: {
    joins: any[];
    cleaning: any[];
    kpis: any[];
    comparisons: any[];
  };
  warnings: string[];
}

function runPostIngestionAnalysis(datasetId: string): Promise<PostIngestionAnalysis>;
```

**Acceptance Criteria:**
- [ ] The system correctly classifies the domain of the dataset.
- [ ] The system identifies entity keys, time dimensions, and sensitive columns.
- [ ] A knowledge graph and an executive summary are generated.
- [ ] Actionable suggestions for joins, cleaning, KPIs, and comparisons are provided.
- [ ] The system issues warnings about potential data quality issues.
### Phase 95: Natural Language Querying

#### Task 95.1: Query Interpretation and Execution
**Requirements:**
- `E03-0141`: The system MUST support natural language prompts from the user.
- `E03-0142`: The system MUST be able to answer questions like “What is the highest selling region?”
- `E03-0143`: The system MUST be able to handle comparative queries like “Compare 2023 and 2024”.
- `E03-0144`: The system MUST be able to extract data based on conditions like “Extract customers whose spending has decreased”.

#### Task 95.2: Result Generation
**Requirements:**
- `E03-0145`: The query execution MUST result in a specific set of outputs.
- `E03-0146`: The system MUST generate the T-IR (Task-Intermediate Representation) steps that were executed to get the result.
- `E03-0147`: The system MUST generate a result table.
- `E03-0148`: The system MAY provide an optional chart to visualize the result.
- `E03-0149`: The system MUST provide a textual explanation of the result, including a confidence score and data lineage.

**Implementation Contract:**
```typescript
interface NlqRequest {
  query: string;
  datasetId: string;
}

interface NlqResult {
  tirSteps: any[];
  resultTable: any;
  chart?: any;
  explanation: {
    text: string;
    confidence: number; // 0-1
    lineage: any;
  };
}

function executeNlq(request: NlqRequest): Promise<NlqResult>;
```

**Acceptance Criteria:**
- [ ] The system can successfully interpret and execute natural language queries.
- [ ] The system generates T-IR steps, a result table, and an optional chart.
- [ ] The system provides a textual explanation with confidence and lineage for each result.
### Phase 96: Predictive Analysis

#### Task 96.1: Time-Series Forecasting
**Requirements:**
- `E03-0150`: The system MUST provide time-series forecasting capabilities when applicable.

#### Task 96.2: Scenario Simulation
**Requirements:**
- `E03-0151`: The system MUST allow users to perform “what-if” scenario simulations.

#### Task 96.3: Confidence and Assumptions
**Requirements:**
- `E03-0152`: The system MUST label all forecasts and simulations with confidence intervals and underlying assumptions.
- `E03-0153`: The system MUST NOT invent inputs for simulations; all parameters must be user-provided or based on historical data.

**Implementation Contract:**
```typescript
interface ForecastRequest {
  datasetId: string;
  timeColumn: string;
  valueColumn: string;
  forecastHorizon: number;
}

interface ForecastResult {
  forecast: any;
  confidenceInterval: [number, number];
  assumptions: string[];
}

interface SimulationRequest {
  datasetId: string;
  scenario: any; // e.g., { parameter: 'price', change: 0.1 }
}

interface SimulationResult {
  simulatedData: any;
  assumptions: string[];
}

function forecast(request: ForecastRequest): Promise<ForecastResult>;
function simulate(request: SimulationRequest): Promise<SimulationResult>;
```

**Acceptance Criteria:**
- [ ] The system can generate time-series forecasts with confidence intervals.
- [ ] The system can run what-if simulations based on user-defined scenarios.
- [ ] All predictive outputs are clearly labeled with assumptions and confidence levels.
- [ ] The system does not invent inputs for simulations.
### Phase 97: Auditing and Reproducibility

#### Task 97.1: Operation Logging
**Requirements:**
- `E03-0154`: Every operation performed by the user or the system MUST be logged.

#### Task 97.2: Recipes
**Requirements:**
- `E03-0155`: The system MUST allow users to save a sequence of operations as a “recipe”.
- `E03-0156`: Recipes MUST be shareable, editable, and schedulable. The system MUST support scheduling a recipe to run on a folder monthly.

**Implementation Contract:**
```typescript
interface LogEntry {
  timestamp: Date;
  userId: string;
  operation: string;
  parameters: any;
  result: any;
}

interface Recipe {
  id: string;
  name: string;
  steps: any[];
}

function getLogs(resourceId: string): Promise<LogEntry[]>;
function saveRecipe(recipe: Recipe): Promise<Recipe>;
function scheduleRecipe(recipeId: string, schedule: string): Promise<void>;
```

**Acceptance Criteria:**
- [ ] All operations are logged with sufficient detail.
- [ ] Users can create, save, and share recipes.
- [ ] Recipes can be scheduled to run at specified intervals.
### Phase 98: Reporting and Exporting

#### Task 98.1: Professional Formatting
**Requirements:**
- `E03-0157`: All reports and exports MUST have professional formatting.
- `E03-0158`: The system MUST support Arabic formatting, including right-to-left text and number formatting.

#### Task 98.2: Report Generation
**Requirements:**
- `E03-0159`: The system MUST be able to generate various types of reports, including data quality reports, diff reports, and KPI reports.

#### Task 98.3: Exporting
**Requirements:**
- `E03-0160`: The system MUST support exporting data and reports to XLSX, CSV, PDF, and Word formats.
- `E03-0161`: All exports MUST include lineage metadata, either in a hidden sheet or a sidecar JSON file.

**Implementation Contract:**
```typescript
interface ExportRequest {
  resourceId: string;
  format: 'xlsx' | 'csv' | 'pdf' | 'word';
  includeLineage: boolean;
}

function exportResource(request: ExportRequest): Promise<any>; // Returns the exported file
```

**Acceptance Criteria:**
- [ ] Reports are generated with professional and language-specific formatting.
- [ ] Data and reports can be exported to all specified formats.
- [ ] Lineage metadata is included in all exports.

---





### Phase 95: Code Implementation and Verification

#### E03-0162: Prohibition of Dummy Code

**Specification:** All code submitted to the production branch MUST be complete and functional. Dummy code, including but not limited to empty function bodies, placeholder logic, or incomplete implementations, is strictly prohibited. All code MUST be production-ready and fully implemented.

**Implementation Contract:**
- **Function:** `validate_code(code: string): boolean`
- **Input:** `code`: A string containing the code to be validated.
- **Output:** `boolean`: Returns `true` if the code is complete and functional, `false` otherwise.
- **Constraints:** The validation function MUST recursively check all functions, methods, and classes for incomplete implementations.

**Acceptance Criteria:**
- All functions and methods MUST have a complete and functional body.
- There MUST be no placeholder comments such as `// TODO: Implement this` or `// FIXME`.
- All declared variables and constants MUST be used.
- The code MUST compile and run without errors.

---

#### E03-0163: Prohibition of Mock Outputs

**Specification:** All tool outputs MUST be generated from the actual execution of the tool with the provided inputs. Mock outputs, including but not limited to hardcoded responses, simulated results, or placeholder data, are strictly prohibited.

**Implementation Contract:**
- **Function:** `validate_output(output: any, tool_id: string, inputs: any): boolean`
- **Input:**
    - `output`: The output generated by the tool.
    - `tool_id`: The ID of the tool that was executed.
    - `inputs`: The inputs that were provided to the tool.
- **Output:** `boolean`: Returns `true` if the output is a genuine result of the tool's execution, `false` otherwise.
- **Constraints:** The validation function MUST have a mechanism to trace the origin of the output and verify its authenticity.

**Acceptance Criteria:**
- The output MUST be a direct result of the tool's execution.
- The output MUST NOT be a hardcoded or static value.
- The output MUST be consistent with the tool's behavior and the provided inputs.

---

#### E03-0164: Requirement of Artifact and Evidence for Completion

**Specification:** A task or sub-task MUST NOT be marked as "done" or "completed" without providing a verifiable artifact and supporting evidence. The artifact MUST be a tangible output of the task, and the evidence MUST demonstrate that the task has been successfully completed according to its requirements.

**Implementation Contract:**
- **Type:** `CompletionRecord`
- **Properties:**
    - `task_id: string`
    - `status: "done"`
    - `artifact_url: string`
    - `evidence: { type: "log" | "screenshot" | "report"; url: string; }[]`
- **Constraints:** The `artifact_url` and `evidence` URLs MUST be valid and accessible.

**Acceptance Criteria:**
- A task can only be marked as "done" if it has an associated `CompletionRecord`.
- The `CompletionRecord` MUST include a valid `artifact_url`.
- The `CompletionRecord` MUST include at least one piece of `evidence`.

---

#### E03-0165: Requirement of Screenshots/Renders in Tests

**Specification:** For any functionality that produces a visual output, the corresponding tests MUST include screenshots or renders of the output. This applies to, but is not limited to, table rendering, dashboard previews, and export previews.

**Implementation Contract:**
- **Type:** `TestResult`
- **Properties:**
    - `test_id: string`
    - `passed: boolean`
    - `visual_outputs: { name: string; url: string; }[] | undefined`
- **Constraints:** If the functionality being tested produces a visual output, the `visual_outputs` array MUST NOT be empty.

**Acceptance Criteria:**
- Tests for visual components MUST produce at least one screenshot or render.
- The screenshots or renders MUST be available at the URLs specified in the `visual_outputs` array.
- The visual outputs MUST be consistent with the expected output of the functionality.

### Phase 96: Build and Data Specification

#### E03-0166: Build Determinism for Strict Claims

**Specification:** For any claims that require strict reproducibility, the build process MUST be deterministic. This means that given the same source code and build environment, the build process MUST produce the exact same binary output every time.

**Implementation Contract:**
- **Function:** `verify_build_determinism(build_a: Buffer, build_b: Buffer): boolean`
- **Input:**
    - `build_a`: The binary output of the first build.
    - `build_b`: The binary output of the second build.
- **Output:** `boolean`: Returns `true` if the builds are identical, `false` otherwise.
- **Constraints:** The comparison MUST be a byte-for-byte comparison of the two build outputs.

**Acceptance Criteria:**
- Repeated builds from the same source code and build environment MUST produce identical binaries.
- The build process MUST NOT be influenced by external factors such as the time of day or network connectivity.

---

#### E03-0167: Standardized Tool I/O Structure

**Specification:** All tools MUST adhere to a standardized input and output structure. The input MUST be structured with `request_id`, `tool_id`, `context`, `inputs`, and `params`. The output MUST be an object containing `status`, `refs`, `warnings`, and `failure` properties.

**Implementation Contract:**
- **Type:** `ToolInput`
- **Properties:**
    - `request_id: string`
    - `tool_id: string`
    - `context: any`
    - `inputs: any`
    - `params: any`
- **Type:** `ToolOutput`
- **Properties:**
    - `status: "success" | "error"`
    - `refs: string[]`
    - `warnings: string[]`
    - `failure: string | null`

**Acceptance Criteria:**
- All tools MUST accept a `ToolInput` object as their input.
- All tools MUST return a `ToolOutput` object as their output.
- The `failure` property in `ToolOutput` MUST be `null` if the status is `"success"`.

---

#### E03-0168: JSON Schema Draft Version

**Specification:** All JSON schemas used for validation MUST conform to the JSON Schema Draft 2020-12 specification.

**Implementation Contract:**
- **Function:** `validate_schema(schema: object): boolean`
- **Input:** `schema`: The JSON schema to be validated.
- **Output:** `boolean`: Returns `true` if the schema is a valid JSON Schema Draft 2020-12 schema, `false` otherwise.
- **Constraints:** The validation function MUST use a validator that is compliant with the JSON Schema Draft 2020-12 specification.

**Acceptance Criteria:**
- All schemas MUST validate against the JSON Schema Draft 2020-12 meta-schema.
- Schemas MUST NOT use keywords or features from other JSON Schema drafts.

---

#### E03-0169: Minimum Operational Set and Extensibility Pattern

**Specification:** The current set of requirements constitutes a minimum operational set for the core engine. Any subsequent expansion or addition of requirements MUST follow the same pattern of detailed, programmatic specifications, including implementation contracts and acceptance criteria.

**Implementation Contract:**
- **N/A** (This is a meta-requirement and does not have a direct implementation contract).

**Acceptance Criteria:**
- All new requirements MUST be documented in the same format as the existing requirements.
- All new requirements MUST include a specification, an implementation contract, and acceptance criteria.
