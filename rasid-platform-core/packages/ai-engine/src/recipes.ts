/**
 * Operation Memory / Recipes module:
 *  - Every operation is logged as a T-IR recipe with metadata
 *  - Recipes can be replayed on new files
 *  - Recipes can be edited and versioned
 *  - Recipes can be applied to a folder on a schedule (e.g., monthly)
 */

import { createHash } from "node:crypto";
import type { TirStep } from "./conversational-query";

export type RecipeMetadata = {
  name: string;
  description: string;
  domain?: string;
  tags: string[];
  created_by: string;
  tenant_ref: string;
  workspace_id: string;
};

export type RecipeVersion = {
  version_id: string;
  version_number: number;
  steps: TirStep[];
  metadata: RecipeMetadata;
  created_at: string;
  change_summary: string;
};

export type Recipe = {
  recipe_id: string;
  current_version: number;
  versions: RecipeVersion[];
  metadata: RecipeMetadata;
  created_at: string;
  updated_at: string;
  replay_count: number;
  last_replayed_at: string | null;
};

export type RecipeReplayInput = {
  recipe_id: string;
  version_number?: number;
  file_ref: string;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  actor_ref: string;
};

export type RecipeReplayResult = {
  replay_id: string;
  recipe_id: string;
  version_used: number;
  file_ref: string;
  steps_executed: number;
  steps_skipped: number;
  skipped_reasons: string[];
  output_columns: string[];
  output_row_count: number;
  output_rows: Array<Record<string, unknown>>;
  replayed_at: string;
  lineage_ref: string;
};

export type ScheduledRecipeApplication = {
  schedule_id: string;
  recipe_id: string;
  folder_ref: string;
  cron_expression: string;
  tenant_ref: string;
  workspace_id: string;
  enabled: boolean;
  last_run_at: string | null;
  next_run_at: string;
  created_by: string;
  created_at: string;
};

const hashId = (value: string): string => createHash("sha256").update(value).digest("hex").slice(0, 16);
const now = (): string => new Date().toISOString();

let replayCounter = 0;
const nextReplayId = (): string => `replay-${++replayCounter}-${Date.now()}`;

export class RecipeEngine {
  private recipes = new Map<string, Recipe>();
  private schedules = new Map<string, ScheduledRecipeApplication>();

  /**
   * Create a new recipe from T-IR steps captured during a conversational query.
   */
  createRecipe(params: {
    steps: TirStep[];
    metadata: RecipeMetadata;
  }): Recipe {
    const recipeId = `recipe-${hashId(`${params.metadata.name}:${Date.now()}`)}`;
    const versionId = `${recipeId}-v1`;

    const version: RecipeVersion = {
      version_id: versionId,
      version_number: 1,
      steps: params.steps,
      metadata: params.metadata,
      created_at: now(),
      change_summary: "Initial version."
    };

    const recipe: Recipe = {
      recipe_id: recipeId,
      current_version: 1,
      versions: [version],
      metadata: params.metadata,
      created_at: now(),
      updated_at: now(),
      replay_count: 0,
      last_replayed_at: null
    };

    this.recipes.set(recipeId, recipe);
    return recipe;
  }

  /**
   * Update a recipe with new steps, creating a new version.
   */
  updateRecipe(params: {
    recipe_id: string;
    steps: TirStep[];
    change_summary: string;
    updated_by: string;
  }): Recipe {
    const recipe = this.recipes.get(params.recipe_id);
    if (!recipe) {
      throw new Error(`Recipe not found: ${params.recipe_id}`);
    }

    const newVersionNumber = recipe.current_version + 1;
    const versionId = `${recipe.recipe_id}-v${newVersionNumber}`;

    const newVersion: RecipeVersion = {
      version_id: versionId,
      version_number: newVersionNumber,
      steps: params.steps,
      metadata: { ...recipe.metadata, created_by: params.updated_by },
      created_at: now(),
      change_summary: params.change_summary
    };

    recipe.versions.push(newVersion);
    recipe.current_version = newVersionNumber;
    recipe.updated_at = now();

    return recipe;
  }

  /**
   * Get a recipe by ID.
   */
  getRecipe(recipeId: string): Recipe | null {
    return this.recipes.get(recipeId) ?? null;
  }

  /**
   * List recipes for a workspace.
   */
  listRecipes(tenantRef: string, workspaceId: string): Recipe[] {
    return [...this.recipes.values()].filter(
      (r) => r.metadata.tenant_ref === tenantRef && r.metadata.workspace_id === workspaceId
    );
  }

  /**
   * Replay a recipe on new data. The recipe steps are applied to the provided rows.
   * Only operates on real data — does not invent inputs.
   */
  replayRecipe(input: RecipeReplayInput): RecipeReplayResult {
    const recipe = this.recipes.get(input.recipe_id);
    if (!recipe) {
      throw new Error(`Recipe not found: ${input.recipe_id}`);
    }

    const versionNumber = input.version_number ?? recipe.current_version;
    const version = recipe.versions.find((v) => v.version_number === versionNumber);
    if (!version) {
      throw new Error(`Recipe version not found: ${input.recipe_id} v${versionNumber}`);
    }

    const replayId = nextReplayId();
    let currentRows = [...input.rows];
    let currentColumns = [...input.columns];
    let stepsExecuted = 0;
    let stepsSkipped = 0;
    const skippedReasons: string[] = [];

    for (const step of version.steps) {
      try {
        switch (step.kind) {
          case "select_columns": {
            const cols = (step.params["columns"] as string[]) ?? [];
            const availableCols = cols.filter((c) => currentColumns.includes(c));
            const missingCols = cols.filter((c) => !currentColumns.includes(c));
            if (missingCols.length > 0) {
              skippedReasons.push(`select_columns: missing columns ${missingCols.join(", ")}`);
              if (availableCols.length === 0) {
                stepsSkipped++;
                continue;
              }
            }
            currentRows = currentRows.map((r) => {
              const filtered: Record<string, unknown> = {};
              for (const c of availableCols) {
                if (c in r) filtered[c] = r[c];
              }
              return filtered;
            });
            currentColumns = availableCols;
            stepsExecuted++;
            break;
          }
          case "filter_rows": {
            // Skip ambiguous filters from original query context
            if (step.params["condition"] === "extracted_from_query") {
              stepsSkipped++;
              skippedReasons.push("filter_rows: original filter was query-specific and not portable.");
              continue;
            }
            stepsExecuted++;
            break;
          }
          case "sort": {
            const sortCol = step.params["column"] as string;
            if (!currentColumns.includes(sortCol)) {
              stepsSkipped++;
              skippedReasons.push(`sort: column "${sortCol}" not found in target data.`);
              continue;
            }
            const dir = step.params["direction"] as string;
            currentRows.sort((a, b) => {
              const va = Number(a[sortCol]);
              const vb = Number(b[sortCol]);
              if (!Number.isNaN(va) && !Number.isNaN(vb)) {
                return dir === "desc" ? vb - va : va - vb;
              }
              return dir === "desc"
                ? String(b[sortCol] ?? "").localeCompare(String(a[sortCol] ?? ""))
                : String(a[sortCol] ?? "").localeCompare(String(b[sortCol] ?? ""));
            });
            stepsExecuted++;
            break;
          }
          case "limit": {
            const lim = (step.params["limit"] as number) ?? 1000;
            currentRows = currentRows.slice(0, lim);
            stepsExecuted++;
            break;
          }
          case "group_by": {
            const groupCols = (step.params["group_columns"] as string[]) ?? [];
            const available = groupCols.filter((c) => currentColumns.includes(c));
            if (available.length === 0) {
              stepsSkipped++;
              skippedReasons.push(`group_by: group columns not found in target data.`);
              continue;
            }
            const groups = new Map<string, Array<Record<string, unknown>>>();
            for (const row of currentRows) {
              const key = available.map((c) => String(row[c] ?? "")).join("||");
              if (!groups.has(key)) groups.set(key, []);
              groups.get(key)!.push(row);
            }
            currentRows = [...groups.entries()].map(([, g]) => ({
              ...g[0]!,
              _group_count: g.length
            }));
            stepsExecuted++;
            break;
          }
          case "aggregate": {
            const aggCol = step.params["column"] as string;
            if (!currentColumns.includes(aggCol)) {
              stepsSkipped++;
              skippedReasons.push(`aggregate: column "${aggCol}" not found.`);
              continue;
            }
            const aggType = step.params["aggregation"] as string;
            const outputCol = (step.params["output_column"] as string) ?? `${aggType}_${aggCol}`;
            const values = currentRows.map((r) => Number(r[aggCol])).filter((v) => !Number.isNaN(v));

            let result = 0;
            if (aggType === "sum") result = values.reduce((a, b) => a + b, 0);
            else if (aggType === "avg") result = values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
            else if (aggType === "count") result = values.length;
            else if (aggType === "max") result = values.length > 0 ? Math.max(...values) : 0;
            else if (aggType === "min") result = values.length > 0 ? Math.min(...values) : 0;

            if (currentRows.length > 0) {
              currentRows[0]![outputCol] = Math.round(result * 100) / 100;
            }
            if (!currentColumns.includes(outputCol)) {
              currentColumns.push(outputCol);
            }
            stepsExecuted++;
            break;
          }
          case "deduplicate": {
            const seen = new Set<string>();
            currentRows = currentRows.filter((r) => {
              const key = JSON.stringify(r);
              if (seen.has(key)) return false;
              seen.add(key);
              return true;
            });
            stepsExecuted++;
            break;
          }
          default:
            stepsSkipped++;
            skippedReasons.push(`${step.kind}: unsupported step kind for replay.`);
            break;
        }
      } catch (err) {
        stepsSkipped++;
        skippedReasons.push(`${step.kind}: execution error — ${err instanceof Error ? err.message : "unknown"}`);
      }
    }

    // Update recipe replay stats
    recipe.replay_count++;
    recipe.last_replayed_at = now();

    return {
      replay_id: replayId,
      recipe_id: input.recipe_id,
      version_used: versionNumber,
      file_ref: input.file_ref,
      steps_executed: stepsExecuted,
      steps_skipped: stepsSkipped,
      skipped_reasons: skippedReasons,
      output_columns: currentRows.length > 0 ? Object.keys(currentRows[0]!) : currentColumns,
      output_row_count: currentRows.length,
      output_rows: currentRows,
      replayed_at: now(),
      lineage_ref: `lineage-replay-${replayId}`
    };
  }

  /**
   * Schedule a recipe to be applied to a folder on a recurring basis.
   */
  scheduleRecipe(params: {
    recipe_id: string;
    folder_ref: string;
    cron_expression: string;
    tenant_ref: string;
    workspace_id: string;
    created_by: string;
  }): ScheduledRecipeApplication {
    const recipe = this.recipes.get(params.recipe_id);
    if (!recipe) {
      throw new Error(`Recipe not found: ${params.recipe_id}`);
    }

    const scheduleId = `schedule-${hashId(`${params.recipe_id}:${params.folder_ref}:${Date.now()}`)}`;

    // Compute approximate next run (simple monthly calculation)
    const nextRun = new Date();
    nextRun.setMonth(nextRun.getMonth() + 1);
    nextRun.setDate(1);
    nextRun.setHours(0, 0, 0, 0);

    const schedule: ScheduledRecipeApplication = {
      schedule_id: scheduleId,
      recipe_id: params.recipe_id,
      folder_ref: params.folder_ref,
      cron_expression: params.cron_expression,
      tenant_ref: params.tenant_ref,
      workspace_id: params.workspace_id,
      enabled: true,
      last_run_at: null,
      next_run_at: nextRun.toISOString(),
      created_by: params.created_by,
      created_at: now()
    };

    this.schedules.set(scheduleId, schedule);
    return schedule;
  }

  /**
   * List scheduled recipe applications for a workspace.
   */
  listSchedules(tenantRef: string, workspaceId: string): ScheduledRecipeApplication[] {
    return [...this.schedules.values()].filter(
      (s) => s.tenant_ref === tenantRef && s.workspace_id === workspaceId
    );
  }

  /**
   * Enable or disable a scheduled recipe.
   */
  toggleSchedule(scheduleId: string, enabled: boolean): ScheduledRecipeApplication {
    const schedule = this.schedules.get(scheduleId);
    if (!schedule) {
      throw new Error(`Schedule not found: ${scheduleId}`);
    }
    schedule.enabled = enabled;
    return schedule;
  }

  /**
   * Delete a recipe and all its schedules.
   */
  deleteRecipe(recipeId: string): boolean {
    const deleted = this.recipes.delete(recipeId);
    // Also remove associated schedules
    for (const [id, schedule] of this.schedules.entries()) {
      if (schedule.recipe_id === recipeId) {
        this.schedules.delete(id);
      }
    }
    return deleted;
  }

  /**
   * Get version history of a recipe.
   */
  getVersionHistory(recipeId: string): RecipeVersion[] {
    const recipe = this.recipes.get(recipeId);
    return recipe?.versions ?? [];
  }
}
