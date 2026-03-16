/**
 * Seed Services — Excel Engine
 *
 * Adapted algorithms from rasid_core_seed 05_excel_core.
 */

export {
  executeExcelTool,
  listExcelTools,
  getDataset,
  getTable,
  getRecipe,
} from "./excel-ultra-engine.service";
export type {
  ExcelActionContext,
  ExcelToolRequest,
  ExcelToolResponse,
  DatasetRef,
  TableRef,
  ColumnRef,
  RecipeRef,
  ArtifactRef,
  DatasetModel,
  TableModel,
  ColumnModel,
  RecipeModel,
  ArtifactModel,
  ToolWarning,
} from "./excel-ultra-engine.service";

export { FormulaAnalysisService } from "./formula-analysis.service";
export type {
  FormulaParseResult,
  FormulaToken,
  FormulaAST,
  CellReference,
  FunctionCall,
  FormulaError,
  DependencyGraph,
  FormulaEvalResult,
} from "./formula-analysis.service";
