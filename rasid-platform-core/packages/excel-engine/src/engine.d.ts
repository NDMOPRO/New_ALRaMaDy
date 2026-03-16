import ExcelJS from "exceljs";
import { RegistryBootstrap } from "@rasid/capability-registry";
import { type Artifact, type AuditEvent, type CanonicalRepresentation, type EvidencePack, type FailureReason, type FormulaGraphState, type LineageEdge, type PivotMetadata, type Publication, type StyleMetadata, type TransformationPlan, type TransformationResult, type Warning, type Workbook, type WorkbookPackage, type WorkbookVersion } from "@rasid/contracts";
import { z } from "zod";
declare const ExcelImportRequestSchema: z.ZodObject<{
    run_id: z.ZodString;
    tenant_ref: z.ZodString;
    workspace_id: z.ZodString;
    project_id: z.ZodString;
    created_by: z.ZodString;
    requested_mode: z.ZodDefault<z.ZodEnum<["easy", "advanced"]>>;
    media_type: z.ZodEnum<["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel", "application/vnd.ms-excel.sheet.macroEnabled.12", "text/csv", "text/tab-separated-values"]>;
    input_path: z.ZodString;
    output_root: z.ZodString;
}, "strip", z.ZodTypeAny, {
    run_id: string;
    tenant_ref: string;
    workspace_id: string;
    project_id: string;
    created_by: string;
    requested_mode: "easy" | "advanced";
    media_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" | "application/vnd.ms-excel" | "application/vnd.ms-excel.sheet.macroEnabled.12" | "text/csv" | "text/tab-separated-values";
    input_path: string;
    output_root: string;
}, {
    run_id: string;
    tenant_ref: string;
    workspace_id: string;
    project_id: string;
    created_by: string;
    media_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" | "application/vnd.ms-excel" | "application/vnd.ms-excel.sheet.macroEnabled.12" | "text/csv" | "text/tab-separated-values";
    input_path: string;
    output_root: string;
    requested_mode?: "easy" | "advanced" | undefined;
}>;
declare const WorkbookAnalysisSchema: z.ZodObject<{
    workbook_ref: z.ZodString;
    worksheet_count: z.ZodNumber;
    sheets: z.ZodArray<z.ZodObject<{
        worksheet_name: z.ZodString;
        row_count: z.ZodNumber;
        column_count: z.ZodNumber;
        headers: z.ZodArray<z.ZodString, "many">;
        columns: z.ZodArray<z.ZodObject<{
            column_name: z.ZodString;
            inferred_type: z.ZodString;
            null_count: z.ZodNumber;
            duplicate_count: z.ZodNumber;
            unique_count: z.ZodNumber;
            key_candidate: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            column_name: string;
            inferred_type: string;
            null_count: number;
            duplicate_count: number;
            unique_count: number;
            key_candidate: boolean;
        }, {
            column_name: string;
            inferred_type: string;
            null_count: number;
            duplicate_count: number;
            unique_count: number;
            key_candidate: boolean;
        }>, "many">;
        sample_rows: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">;
        formula_count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        worksheet_name: string;
        row_count: number;
        column_count: number;
        headers: string[];
        columns: {
            column_name: string;
            inferred_type: string;
            null_count: number;
            duplicate_count: number;
            unique_count: number;
            key_candidate: boolean;
        }[];
        sample_rows: Record<string, unknown>[];
        formula_count: number;
    }, {
        worksheet_name: string;
        row_count: number;
        column_count: number;
        headers: string[];
        columns: {
            column_name: string;
            inferred_type: string;
            null_count: number;
            duplicate_count: number;
            unique_count: number;
            key_candidate: boolean;
        }[];
        sample_rows: Record<string, unknown>[];
        formula_count: number;
    }>, "many">;
    warnings: z.ZodArray<z.ZodString, "many">;
    generated_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    workbook_ref: string;
    worksheet_count: number;
    sheets: {
        worksheet_name: string;
        row_count: number;
        column_count: number;
        headers: string[];
        columns: {
            column_name: string;
            inferred_type: string;
            null_count: number;
            duplicate_count: number;
            unique_count: number;
            key_candidate: boolean;
        }[];
        sample_rows: Record<string, unknown>[];
        formula_count: number;
    }[];
    warnings: string[];
    generated_at: string;
}, {
    workbook_ref: string;
    worksheet_count: number;
    sheets: {
        worksheet_name: string;
        row_count: number;
        column_count: number;
        headers: string[];
        columns: {
            column_name: string;
            inferred_type: string;
            null_count: number;
            duplicate_count: number;
            unique_count: number;
            key_candidate: boolean;
        }[];
        sample_rows: Record<string, unknown>[];
        formula_count: number;
    }[];
    warnings: string[];
    generated_at: string;
}>;
declare const FormulaRecalculationRequestSchema: z.ZodObject<{
    actor_ref: z.ZodString;
    formula_graph_ref: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    actor_ref: string;
    formula_graph_ref?: string | undefined;
}, {
    actor_ref: string;
    formula_graph_ref?: string | undefined;
}>;
declare const PivotRequestSchema: z.ZodObject<{
    actor_ref: z.ZodString;
    source_worksheet: z.ZodString;
    target_worksheet: z.ZodString;
    row_field: z.ZodString;
    column_field: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    value_field: z.ZodString;
    aggregation: z.ZodDefault<z.ZodEnum<["sum", "count", "average", "min", "max"]>>;
    filter_fields: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    slicer_fields: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    calculated_fields: z.ZodDefault<z.ZodArray<z.ZodObject<{
        field_name: z.ZodString;
        formula: z.ZodString;
        source_fields: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        number_format_code: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        field_name: string;
        formula: string;
        source_fields: string[];
        number_format_code: string;
    }, {
        field_name: string;
        formula: string;
        source_fields?: string[] | undefined;
        number_format_code?: string | undefined;
    }>, "many">>;
    refresh_policy: z.ZodDefault<z.ZodEnum<["manual", "on_open", "on_change"]>>;
    rebuild_cache: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    actor_ref: string;
    source_worksheet: string;
    target_worksheet: string;
    row_field: string;
    column_field: string | null;
    value_field: string;
    aggregation: "sum" | "count" | "average" | "min" | "max";
    filter_fields: string[];
    slicer_fields: string[];
    calculated_fields: {
        field_name: string;
        formula: string;
        source_fields: string[];
        number_format_code: string;
    }[];
    refresh_policy: "manual" | "on_open" | "on_change";
    rebuild_cache: boolean;
}, {
    actor_ref: string;
    source_worksheet: string;
    target_worksheet: string;
    row_field: string;
    value_field: string;
    column_field?: string | null | undefined;
    aggregation?: "sum" | "count" | "average" | "min" | "max" | undefined;
    filter_fields?: string[] | undefined;
    slicer_fields?: string[] | undefined;
    calculated_fields?: {
        field_name: string;
        formula: string;
        source_fields?: string[] | undefined;
        number_format_code?: string | undefined;
    }[] | undefined;
    refresh_policy?: "manual" | "on_open" | "on_change" | undefined;
    rebuild_cache?: boolean | undefined;
}>;
declare const PivotCacheSchema: z.ZodObject<{
    cache_id: z.ZodString;
    pivot_id: z.ZodString;
    source_worksheet: z.ZodString;
    target_worksheet: z.ZodString;
    cache_worksheet: z.ZodString;
    snapshot_headers: z.ZodArray<z.ZodString, "many">;
    materialized_headers: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    snapshot_row_count: z.ZodNumber;
    column_fields: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    filter_fields: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    slicer_fields: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    calculated_fields: z.ZodDefault<z.ZodArray<z.ZodObject<{
        field_name: z.ZodString;
        formula: z.ZodString;
        source_fields: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        number_format_code: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        field_name: string;
        formula: string;
        source_fields: string[];
        number_format_code: string;
    }, {
        field_name: string;
        formula: string;
        source_fields?: string[] | undefined;
        number_format_code?: string | undefined;
    }>, "many">>;
    refresh_policy: z.ZodDefault<z.ZodEnum<["manual", "on_open", "on_change"]>>;
    refresh_token: z.ZodString;
    refresh_mode: z.ZodDefault<z.ZodEnum<["rebuild", "incremental"]>>;
    refresh_count: z.ZodNumber;
    last_refreshed_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    source_worksheet: string;
    target_worksheet: string;
    filter_fields: string[];
    slicer_fields: string[];
    calculated_fields: {
        field_name: string;
        formula: string;
        source_fields: string[];
        number_format_code: string;
    }[];
    refresh_policy: "manual" | "on_open" | "on_change";
    cache_id: string;
    pivot_id: string;
    cache_worksheet: string;
    snapshot_headers: string[];
    materialized_headers: string[];
    snapshot_row_count: number;
    column_fields: string[];
    refresh_token: string;
    refresh_mode: "rebuild" | "incremental";
    refresh_count: number;
    last_refreshed_at: string;
}, {
    source_worksheet: string;
    target_worksheet: string;
    cache_id: string;
    pivot_id: string;
    cache_worksheet: string;
    snapshot_headers: string[];
    snapshot_row_count: number;
    refresh_token: string;
    refresh_count: number;
    last_refreshed_at: string;
    filter_fields?: string[] | undefined;
    slicer_fields?: string[] | undefined;
    calculated_fields?: {
        field_name: string;
        formula: string;
        source_fields?: string[] | undefined;
        number_format_code?: string | undefined;
    }[] | undefined;
    refresh_policy?: "manual" | "on_open" | "on_change" | undefined;
    materialized_headers?: string[] | undefined;
    column_fields?: string[] | undefined;
    refresh_mode?: "rebuild" | "incremental" | undefined;
}>;
declare const FormattingRequestSchema: z.ZodObject<{
    actor_ref: z.ZodString;
    style_id: z.ZodString;
    scope: z.ZodEnum<["cell", "row", "column", "worksheet", "table", "pivot", "workbook"]>;
    target_refs: z.ZodArray<z.ZodString, "many">;
    rtl: z.ZodDefault<z.ZodBoolean>;
    number_format_code: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    date_format_code: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    currency_code: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    font: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    fill: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    border: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    alignment: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    auto_width_strategy: z.ZodDefault<z.ZodEnum<["none", "content_based", "header_based", "fixed"]>>;
    freeze_top_row: z.ZodDefault<z.ZodBoolean>;
    freeze_pane: z.ZodDefault<z.ZodNullable<z.ZodObject<{
        top_row_count: z.ZodNumber;
        left_column_count: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        top_row_count: number;
        left_column_count: number;
    }, {
        top_row_count: number;
        left_column_count: number;
    }>>>;
    conditional_rules: z.ZodDefault<z.ZodArray<z.ZodObject<{
        rule_id: z.ZodString;
        type: z.ZodEnum<["cell_is", "contains_text"]>;
        operator: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        formula: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        text: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        style: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    }, "strip", z.ZodTypeAny, {
        type: "cell_is" | "contains_text";
        formula: string | null;
        rule_id: string;
        operator: string | null;
        text: string | null;
        style: Record<string, unknown>;
    }, {
        type: "cell_is" | "contains_text";
        rule_id: string;
        formula?: string | null | undefined;
        operator?: string | null | undefined;
        text?: string | null | undefined;
        style?: Record<string, unknown> | undefined;
    }>, "many">>;
    table_preset: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    template_name: z.ZodDefault<z.ZodNullable<z.ZodEnum<["finance", "ops", "executive", "rtl_report"]>>>;
}, "strip", z.ZodTypeAny, {
    fill: Record<string, unknown>;
    scope: "workbook" | "worksheet" | "cell" | "row" | "column" | "table" | "pivot";
    actor_ref: string;
    number_format_code: string | null;
    style_id: string;
    target_refs: string[];
    rtl: boolean;
    date_format_code: string | null;
    currency_code: string | null;
    font: Record<string, unknown>;
    border: Record<string, unknown>;
    alignment: Record<string, unknown>;
    auto_width_strategy: "none" | "content_based" | "header_based" | "fixed";
    freeze_top_row: boolean;
    freeze_pane: {
        top_row_count: number;
        left_column_count: number;
    } | null;
    conditional_rules: {
        type: "cell_is" | "contains_text";
        formula: string | null;
        rule_id: string;
        operator: string | null;
        text: string | null;
        style: Record<string, unknown>;
    }[];
    table_preset: string | null;
    template_name: "finance" | "ops" | "executive" | "rtl_report" | null;
}, {
    scope: "workbook" | "worksheet" | "cell" | "row" | "column" | "table" | "pivot";
    actor_ref: string;
    style_id: string;
    target_refs: string[];
    fill?: Record<string, unknown> | undefined;
    number_format_code?: string | null | undefined;
    rtl?: boolean | undefined;
    date_format_code?: string | null | undefined;
    currency_code?: string | null | undefined;
    font?: Record<string, unknown> | undefined;
    border?: Record<string, unknown> | undefined;
    alignment?: Record<string, unknown> | undefined;
    auto_width_strategy?: "none" | "content_based" | "header_based" | "fixed" | undefined;
    freeze_top_row?: boolean | undefined;
    freeze_pane?: {
        top_row_count: number;
        left_column_count: number;
    } | null | undefined;
    conditional_rules?: {
        type: "cell_is" | "contains_text";
        rule_id: string;
        formula?: string | null | undefined;
        operator?: string | null | undefined;
        text?: string | null | undefined;
        style?: Record<string, unknown> | undefined;
    }[] | undefined;
    table_preset?: string | null | undefined;
    template_name?: "finance" | "ops" | "executive" | "rtl_report" | null | undefined;
}>;
declare const ChartRequestSchema: z.ZodObject<{
    actor_ref: z.ZodString;
    chart_id: z.ZodString;
    chart_type: z.ZodEnum<["bar", "line", "area", "pie", "combo"]>;
    source_worksheet: z.ZodString;
    category_field: z.ZodString;
    value_field: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    series_name: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    chart_title: z.ZodString;
    target_worksheet: z.ZodString;
    color_hex: z.ZodDefault<z.ZodString>;
    legend_position: z.ZodDefault<z.ZodEnum<["right", "bottom", "top", "none"]>>;
    anchor_range: z.ZodDefault<z.ZodString>;
    mutation_of: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    series: z.ZodDefault<z.ZodArray<z.ZodObject<{
        series_name: z.ZodString;
        value_field: z.ZodString;
        chart_type: z.ZodDefault<z.ZodEnum<["bar", "line", "area"]>>;
        color_hex: z.ZodDefault<z.ZodString>;
        secondary_axis: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        value_field: string;
        chart_type: "bar" | "line" | "area";
        series_name: string;
        color_hex: string;
        secondary_axis: boolean;
    }, {
        value_field: string;
        series_name: string;
        chart_type?: "bar" | "line" | "area" | undefined;
        color_hex?: string | undefined;
        secondary_axis?: boolean | undefined;
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    actor_ref: string;
    source_worksheet: string;
    target_worksheet: string;
    value_field: string | null;
    chart_id: string;
    chart_type: "bar" | "line" | "area" | "pie" | "combo";
    category_field: string;
    series_name: string | null;
    chart_title: string;
    color_hex: string;
    legend_position: "right" | "bottom" | "top" | "none";
    anchor_range: string;
    mutation_of: string | null;
    series: {
        value_field: string;
        chart_type: "bar" | "line" | "area";
        series_name: string;
        color_hex: string;
        secondary_axis: boolean;
    }[];
}, {
    actor_ref: string;
    source_worksheet: string;
    target_worksheet: string;
    chart_id: string;
    chart_type: "bar" | "line" | "area" | "pie" | "combo";
    category_field: string;
    chart_title: string;
    value_field?: string | null | undefined;
    series_name?: string | null | undefined;
    color_hex?: string | undefined;
    legend_position?: "right" | "bottom" | "top" | "none" | undefined;
    anchor_range?: string | undefined;
    mutation_of?: string | null | undefined;
    series?: {
        value_field: string;
        series_name: string;
        chart_type?: "bar" | "line" | "area" | undefined;
        color_hex?: string | undefined;
        secondary_axis?: boolean | undefined;
    }[] | undefined;
}>;
declare const ChartMetadataSchema: z.ZodObject<{
    chart_id: z.ZodString;
    chart_type: z.ZodEnum<["bar", "line", "area", "pie", "combo"]>;
    source_worksheet: z.ZodString;
    target_worksheet: z.ZodString;
    category_field: z.ZodString;
    value_field: z.ZodNullable<z.ZodString>;
    series_name: z.ZodNullable<z.ZodString>;
    chart_title: z.ZodString;
    target_range_ref: z.ZodString;
    cache_ref: z.ZodNullable<z.ZodString>;
    svg_ref: z.ZodNullable<z.ZodString>;
    legend_position: z.ZodEnum<["right", "bottom", "top", "none"]>;
    anchor_range: z.ZodString;
    config_sheet: z.ZodString;
    mutation_of: z.ZodNullable<z.ZodString>;
    chart_revision: z.ZodNumber;
    series: z.ZodArray<z.ZodObject<{
        series_name: z.ZodString;
        value_field: z.ZodString;
        chart_type: z.ZodDefault<z.ZodEnum<["bar", "line", "area"]>>;
        color_hex: z.ZodDefault<z.ZodString>;
        secondary_axis: z.ZodDefault<z.ZodBoolean>;
    } & {
        target_column_index: z.ZodNumber;
        data_points: z.ZodArray<z.ZodObject<{
            category: z.ZodString;
            value: z.ZodNumber;
        }, "strip", z.ZodTypeAny, {
            value: number;
            category: string;
        }, {
            value: number;
            category: string;
        }>, "many">;
    }, "strip", z.ZodTypeAny, {
        value_field: string;
        chart_type: "bar" | "line" | "area";
        series_name: string;
        color_hex: string;
        secondary_axis: boolean;
        target_column_index: number;
        data_points: {
            value: number;
            category: string;
        }[];
    }, {
        value_field: string;
        series_name: string;
        target_column_index: number;
        data_points: {
            value: number;
            category: string;
        }[];
        chart_type?: "bar" | "line" | "area" | undefined;
        color_hex?: string | undefined;
        secondary_axis?: boolean | undefined;
    }>, "many">;
    data_points: z.ZodArray<z.ZodObject<{
        category: z.ZodString;
        value: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        value: number;
        category: string;
    }, {
        value: number;
        category: string;
    }>, "many">;
    export_preserved: z.ZodBoolean;
    generated_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    generated_at: string;
    source_worksheet: string;
    target_worksheet: string;
    value_field: string | null;
    chart_id: string;
    chart_type: "bar" | "line" | "area" | "pie" | "combo";
    category_field: string;
    series_name: string | null;
    chart_title: string;
    legend_position: "right" | "bottom" | "top" | "none";
    anchor_range: string;
    mutation_of: string | null;
    series: {
        value_field: string;
        chart_type: "bar" | "line" | "area";
        series_name: string;
        color_hex: string;
        secondary_axis: boolean;
        target_column_index: number;
        data_points: {
            value: number;
            category: string;
        }[];
    }[];
    target_range_ref: string;
    cache_ref: string | null;
    svg_ref: string | null;
    config_sheet: string;
    chart_revision: number;
    data_points: {
        value: number;
        category: string;
    }[];
    export_preserved: boolean;
}, {
    generated_at: string;
    source_worksheet: string;
    target_worksheet: string;
    value_field: string | null;
    chart_id: string;
    chart_type: "bar" | "line" | "area" | "pie" | "combo";
    category_field: string;
    series_name: string | null;
    chart_title: string;
    legend_position: "right" | "bottom" | "top" | "none";
    anchor_range: string;
    mutation_of: string | null;
    series: {
        value_field: string;
        series_name: string;
        target_column_index: number;
        data_points: {
            value: number;
            category: string;
        }[];
        chart_type?: "bar" | "line" | "area" | undefined;
        color_hex?: string | undefined;
        secondary_axis?: boolean | undefined;
    }[];
    target_range_ref: string;
    cache_ref: string | null;
    svg_ref: string | null;
    config_sheet: string;
    chart_revision: number;
    data_points: {
        value: number;
        category: string;
    }[];
    export_preserved: boolean;
}>;
declare const NativeWorkbookObjectsSchema: z.ZodObject<{
    workbook_object_manifest_id: z.ZodString;
    chart_objects: z.ZodArray<z.ZodObject<{
        chart_id: z.ZodString;
        chart_xml_path: z.ZodString;
        drawing_xml_path: z.ZodString;
        target_sheet: z.ZodString;
        anchor_range: z.ZodString;
        chart_type: z.ZodEnum<["bar", "line", "area", "pie", "combo"]>;
        series_count: z.ZodNumber;
        config_sheet: z.ZodString;
        chart_revision: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        chart_id: string;
        chart_type: "bar" | "line" | "area" | "pie" | "combo";
        anchor_range: string;
        config_sheet: string;
        chart_revision: number;
        chart_xml_path: string;
        drawing_xml_path: string;
        target_sheet: string;
        series_count: number;
    }, {
        chart_id: string;
        chart_type: "bar" | "line" | "area" | "pie" | "combo";
        anchor_range: string;
        config_sheet: string;
        chart_revision: number;
        chart_xml_path: string;
        drawing_xml_path: string;
        target_sheet: string;
        series_count: number;
    }>, "many">;
    pivot_objects: z.ZodArray<z.ZodObject<{
        pivot_id: z.ZodString;
        pivot_table_xml_path: z.ZodString;
        cache_definition_xml_path: z.ZodString;
        cache_records_xml_path: z.ZodString;
        target_sheet: z.ZodString;
        source_sheet: z.ZodString;
        column_fields: z.ZodArray<z.ZodString, "many">;
        calculated_fields: z.ZodArray<z.ZodString, "many">;
        slicer_fields: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        slicer_fields: string[];
        calculated_fields: string[];
        pivot_id: string;
        column_fields: string[];
        target_sheet: string;
        pivot_table_xml_path: string;
        cache_definition_xml_path: string;
        cache_records_xml_path: string;
        source_sheet: string;
    }, {
        slicer_fields: string[];
        calculated_fields: string[];
        pivot_id: string;
        column_fields: string[];
        target_sheet: string;
        pivot_table_xml_path: string;
        cache_definition_xml_path: string;
        cache_records_xml_path: string;
        source_sheet: string;
    }>, "many">;
    slicer_objects: z.ZodArray<z.ZodObject<{
        slicer_id: z.ZodString;
        slicer_cache_name: z.ZodString;
        slicer_xml_path: z.ZodString;
        slicer_cache_xml_path: z.ZodString;
        target_sheet: z.ZodString;
        source_field: z.ZodString;
        drawing_xml_path: z.ZodNullable<z.ZodString>;
        relationship_id: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        drawing_xml_path: string | null;
        target_sheet: string;
        slicer_id: string;
        slicer_cache_name: string;
        slicer_xml_path: string;
        slicer_cache_xml_path: string;
        source_field: string;
        relationship_id: string;
    }, {
        drawing_xml_path: string | null;
        target_sheet: string;
        slicer_id: string;
        slicer_cache_name: string;
        slicer_xml_path: string;
        slicer_cache_xml_path: string;
        source_field: string;
        relationship_id: string;
    }>, "many">;
    generated_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    generated_at: string;
    workbook_object_manifest_id: string;
    chart_objects: {
        chart_id: string;
        chart_type: "bar" | "line" | "area" | "pie" | "combo";
        anchor_range: string;
        config_sheet: string;
        chart_revision: number;
        chart_xml_path: string;
        drawing_xml_path: string;
        target_sheet: string;
        series_count: number;
    }[];
    pivot_objects: {
        slicer_fields: string[];
        calculated_fields: string[];
        pivot_id: string;
        column_fields: string[];
        target_sheet: string;
        pivot_table_xml_path: string;
        cache_definition_xml_path: string;
        cache_records_xml_path: string;
        source_sheet: string;
    }[];
    slicer_objects: {
        drawing_xml_path: string | null;
        target_sheet: string;
        slicer_id: string;
        slicer_cache_name: string;
        slicer_xml_path: string;
        slicer_cache_xml_path: string;
        source_field: string;
        relationship_id: string;
    }[];
}, {
    generated_at: string;
    workbook_object_manifest_id: string;
    chart_objects: {
        chart_id: string;
        chart_type: "bar" | "line" | "area" | "pie" | "combo";
        anchor_range: string;
        config_sheet: string;
        chart_revision: number;
        chart_xml_path: string;
        drawing_xml_path: string;
        target_sheet: string;
        series_count: number;
    }[];
    pivot_objects: {
        slicer_fields: string[];
        calculated_fields: string[];
        pivot_id: string;
        column_fields: string[];
        target_sheet: string;
        pivot_table_xml_path: string;
        cache_definition_xml_path: string;
        cache_records_xml_path: string;
        source_sheet: string;
    }[];
    slicer_objects: {
        drawing_xml_path: string | null;
        target_sheet: string;
        slicer_id: string;
        slicer_cache_name: string;
        slicer_xml_path: string;
        slicer_cache_xml_path: string;
        source_field: string;
        relationship_id: string;
    }[];
}>;
declare const LambdaRegistryEntrySchema: z.ZodObject<{
    lambda_id: z.ZodString;
    lambda_name: z.ZodString;
    parameter_names: z.ZodArray<z.ZodString, "many">;
    body_expression: z.ZodString;
    workbook_defined_name: z.ZodString;
    defined_name_formula: z.ZodString;
    scope: z.ZodDefault<z.ZodEnum<["workbook", "worksheet"]>>;
    worksheet_name: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    recursion_policy: z.ZodDefault<z.ZodEnum<["no_recursion", "bounded"]>>;
    recursion_limit: z.ZodDefault<z.ZodNumber>;
    lifecycle_state: z.ZodDefault<z.ZodEnum<["active", "imported", "exported", "superseded"]>>;
    source: z.ZodDefault<z.ZodEnum<["workbook_defined_name", "runtime_registry", "worksheet_registry"]>>;
}, "strip", z.ZodTypeAny, {
    worksheet_name: string | null;
    lambda_id: string;
    lambda_name: string;
    parameter_names: string[];
    body_expression: string;
    workbook_defined_name: string;
    defined_name_formula: string;
    scope: "workbook" | "worksheet";
    recursion_policy: "no_recursion" | "bounded";
    recursion_limit: number;
    lifecycle_state: "active" | "imported" | "exported" | "superseded";
    source: "workbook_defined_name" | "runtime_registry" | "worksheet_registry";
}, {
    lambda_id: string;
    lambda_name: string;
    parameter_names: string[];
    body_expression: string;
    workbook_defined_name: string;
    defined_name_formula: string;
    worksheet_name?: string | null | undefined;
    scope?: "workbook" | "worksheet" | undefined;
    recursion_policy?: "no_recursion" | "bounded" | undefined;
    recursion_limit?: number | undefined;
    lifecycle_state?: "active" | "imported" | "exported" | "superseded" | undefined;
    source?: "workbook_defined_name" | "runtime_registry" | "worksheet_registry" | undefined;
}>;
declare const MappingPreviewEntrySchema: z.ZodObject<{
    preview_id: z.ZodString;
    worksheet: z.ZodString;
    operation: z.ZodString;
    source_field: z.ZodString;
    target_field: z.ZodString;
    sample_value: z.ZodNullable<z.ZodString>;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    worksheet: string;
    source_field: string;
    preview_id: string;
    operation: string;
    target_field: string;
    sample_value: string | null;
    reason: string;
}, {
    worksheet: string;
    source_field: string;
    preview_id: string;
    operation: string;
    target_field: string;
    sample_value: string | null;
    reason: string;
}>;
declare const PersistenceManifestSchema: z.ZodObject<{
    manifest_id: z.ZodString;
    store_root: z.ZodString;
    workbook_state_path: z.ZodString;
    workbook_versions_path: z.ZodString;
    publications_path: z.ZodString;
    artifacts_path: z.ZodString;
    evidence_path: z.ZodString;
    audit_path: z.ZodString;
    lineage_path: z.ZodString;
    charts_path: z.ZodString;
    exported_workbook_path: z.ZodNullable<z.ZodString>;
    publication_backend_ref: z.ZodNullable<z.ZodString>;
    backend_service_ref: z.ZodNullable<z.ZodString>;
    backend_service_url: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    service_manifest_url: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    backend_manifest_path: z.ZodNullable<z.ZodString>;
    backend_manifest_url: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    backend_object_manifest_path: z.ZodNullable<z.ZodString>;
    backend_object_manifest_url: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    backend_download_url: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    updated_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    manifest_id: string;
    store_root: string;
    workbook_state_path: string;
    workbook_versions_path: string;
    publications_path: string;
    artifacts_path: string;
    evidence_path: string;
    audit_path: string;
    lineage_path: string;
    charts_path: string;
    exported_workbook_path: string | null;
    publication_backend_ref: string | null;
    backend_service_ref: string | null;
    backend_service_url: string | null;
    service_manifest_url: string | null;
    backend_manifest_path: string | null;
    backend_manifest_url: string | null;
    backend_object_manifest_path: string | null;
    backend_object_manifest_url: string | null;
    backend_download_url: string | null;
    updated_at: string;
}, {
    manifest_id: string;
    store_root: string;
    workbook_state_path: string;
    workbook_versions_path: string;
    publications_path: string;
    artifacts_path: string;
    evidence_path: string;
    audit_path: string;
    lineage_path: string;
    charts_path: string;
    exported_workbook_path: string | null;
    publication_backend_ref: string | null;
    backend_service_ref: string | null;
    backend_manifest_path: string | null;
    backend_object_manifest_path: string | null;
    updated_at: string;
    backend_service_url?: string | null | undefined;
    service_manifest_url?: string | null | undefined;
    backend_manifest_url?: string | null | undefined;
    backend_object_manifest_url?: string | null | undefined;
    backend_download_url?: string | null | undefined;
}>;
declare const WorkbookSourceMetadataSchema: z.ZodObject<{
    workbook_id: z.ZodString;
    source_format: z.ZodEnum<["xlsx", "xls", "xlsm", "csv", "tsv"]>;
    original_media_type: z.ZodEnum<["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel", "application/vnd.ms-excel.sheet.macroEnabled.12", "text/csv", "text/tab-separated-values"]>;
    editable_export_format: z.ZodDefault<z.ZodEnum<["xlsx", "xlsm", "xls"]>>;
    contains_vba: z.ZodDefault<z.ZodBoolean>;
    vba_preservation_requested: z.ZodDefault<z.ZodBoolean>;
    vba_preserved: z.ZodDefault<z.ZodBoolean>;
    degrade_behavior: z.ZodDefault<z.ZodEnum<["none", "export_as_xlsx", "export_as_xlsx_without_vba", "export_as_xls"]>>;
    degrade_reason: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    named_range_count: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    workbook_id: string;
    source_format: "xlsx" | "xls" | "xlsm" | "csv" | "tsv";
    original_media_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" | "application/vnd.ms-excel" | "application/vnd.ms-excel.sheet.macroEnabled.12" | "text/csv" | "text/tab-separated-values";
    editable_export_format: "xlsx" | "xls" | "xlsm";
    contains_vba: boolean;
    vba_preservation_requested: boolean;
    vba_preserved: boolean;
    degrade_behavior: "none" | "export_as_xlsx" | "export_as_xlsx_without_vba" | "export_as_xls";
    degrade_reason: string | null;
    named_range_count: number;
}, {
    workbook_id: string;
    source_format: "xlsx" | "xls" | "xlsm" | "csv" | "tsv";
    original_media_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" | "application/vnd.ms-excel" | "application/vnd.ms-excel.sheet.macroEnabled.12" | "text/csv" | "text/tab-separated-values";
    editable_export_format?: "xlsx" | "xls" | "xlsm" | undefined;
    contains_vba?: boolean | undefined;
    vba_preservation_requested?: boolean | undefined;
    vba_preserved?: boolean | undefined;
    degrade_behavior?: "none" | "export_as_xlsx" | "export_as_xlsx_without_vba" | "export_as_xls" | undefined;
    degrade_reason?: string | null | undefined;
    named_range_count?: number | undefined;
}>;
declare const PublishRequestSchema: z.ZodObject<{
    actor_ref: z.ZodString;
    target_ref: z.ZodString;
    published_filename: z.ZodString;
}, "strip", z.ZodTypeAny, {
    actor_ref: string;
    target_ref: string;
    published_filename: string;
}, {
    actor_ref: string;
    target_ref: string;
    published_filename: string;
}>;
declare const SampleRunRequestSchema: z.ZodObject<{
    output_root: z.ZodString;
    tenant_ref: z.ZodDefault<z.ZodString>;
    workspace_id: z.ZodDefault<z.ZodString>;
    project_id: z.ZodDefault<z.ZodString>;
    actor_ref: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    tenant_ref: string;
    workspace_id: string;
    project_id: string;
    output_root: string;
    actor_ref: string;
}, {
    output_root: string;
    tenant_ref?: string | undefined;
    workspace_id?: string | undefined;
    project_id?: string | undefined;
    actor_ref?: string | undefined;
}>;
type ExcelImportRequest = z.infer<typeof ExcelImportRequestSchema>;
type WorkbookAnalysis = z.infer<typeof WorkbookAnalysisSchema>;
type FormulaRecalculationRequest = z.infer<typeof FormulaRecalculationRequestSchema>;
type PivotRequest = z.infer<typeof PivotRequestSchema>;
type PivotCache = z.infer<typeof PivotCacheSchema>;
type FormattingRequest = z.infer<typeof FormattingRequestSchema>;
type ChartRequest = z.infer<typeof ChartRequestSchema>;
type ChartMetadata = z.infer<typeof ChartMetadataSchema>;
type NativeWorkbookObjects = z.infer<typeof NativeWorkbookObjectsSchema>;
type LambdaRegistryEntry = z.infer<typeof LambdaRegistryEntrySchema>;
type MappingPreviewEntry = z.infer<typeof MappingPreviewEntrySchema>;
type PersistenceManifest = z.infer<typeof PersistenceManifestSchema>;
type PublishRequest = z.infer<typeof PublishRequestSchema>;
type SampleRunRequest = z.infer<typeof SampleRunRequestSchema>;
type WorkbookSourceMetadata = z.infer<typeof WorkbookSourceMetadataSchema>;
type StageCheck = {
    check_id: string;
    check_name: string;
    check_type: string;
    passed: boolean;
    severity: "low" | "medium" | "high" | "critical";
    details: string;
    impacted_refs: string[];
};
type StageMetric = {
    metric_name: string;
    metric_value: number;
    metric_unit: string;
};
type ExcelRunState = {
    runId: string;
    mode: "easy" | "advanced";
    actorRef: string;
    tenantRef: string;
    workspaceId: string;
    projectId: string;
    outputRoot: string;
    workbookPath: string;
    workbook: ExcelJS.Workbook;
    workbookRecord: Workbook;
    workbookPackage: WorkbookPackage;
    canonicalRepresentation: CanonicalRepresentation;
    formulaGraph: FormulaGraphState;
    workbookVersions: WorkbookVersion[];
    transformationPlans: TransformationPlan[];
    transformationResults: TransformationResult[];
    pivotMetadata: PivotMetadata[];
    pivotCaches: PivotCache[];
    styleMetadata: StyleMetadata[];
    generatedCharts: ChartMetadata[];
    chartHistory: ChartMetadata[];
    nativeWorkbookObjects: NativeWorkbookObjects;
    lambdaRegistry: LambdaRegistryEntry[];
    mappingPreviews: MappingPreviewEntry[];
    sourceMetadata: WorkbookSourceMetadata;
    sourceVbaPayloadBase64: string | null;
    analysis: WorkbookAnalysis | null;
    artifacts: Artifact[];
    publication: Publication | null;
    persistenceManifest: PersistenceManifest | null;
    auditEvents: AuditEvent[];
    lineageEdges: LineageEdge[];
    checks: StageCheck[];
    metrics: StageMetric[];
    warnings: Warning[];
    failures: FailureReason[];
    sourceArtifactId: string;
    workbookArtifactId: string;
    currentVersionNumber: number;
    lastFormulaExecution: {
        execution_mode: "single_process" | "worker_threads";
        worker_count: number;
        chunk_count: number;
        target_formula_refs: string[];
        handled_warning_codes: string[];
    } | null;
};
export type ExcelSampleArtifacts = {
    output_root: string;
    input_workbook_path: string;
    workbook_package_path: string;
    canonical_representation_path: string;
    analysis_path: string;
    transformation_result_path: string;
    mapping_preview_path: string;
    formula_graph_path: string;
    formula_engine_proof_path: string;
    pivot_metadata_path: string;
    pivot_cache_path: string;
    style_metadata_path: string;
    formatting_proof_path: string;
    fidelity_comparison_proof_path: string;
    easy_advanced_proof_path: string;
    chart_metadata_path: string;
    chart_history_path: string;
    chart_svg_path: string;
    area_chart_svg_path: string;
    easy_mode_export_path: string;
    lambda_import_path: string;
    lambda_registry_path: string;
    lambda_export_path: string;
    native_objects_path: string;
    xls_ingest_analysis_path: string;
    macro_policy_path: string;
    macro_preserved_export_path: string;
    desktop_proof_spec_path: string;
    desktop_proof_workbook_path: string;
    desktop_proof_bundle_path: string;
    desktop_formatting_proof_path: string;
    desktop_chart_coverage_proof_path: string;
    pivot_desktop_proof_path: string;
    exported_workbook_path: string;
    publication_path: string;
    persistence_manifest_path: string;
    backend_service_url: string | null;
    backend_service_manifest_url: string | null;
    backend_publication_manifest_url: string | null;
    backend_object_manifest_url: string | null;
    backend_download_url: string | null;
    evidence_path: string;
    audit_path: string;
    lineage_path: string;
    artifacts_manifest_path: string;
};
export type ExcelSampleRun = {
    state: ExcelRunState;
    evidencePack: EvidencePack;
    artifacts: ExcelSampleArtifacts;
};
type SerializedFormulaScalar = null | string | number | boolean | {
    kind: "date";
    value: string;
};
type SerializedFormulaCellResult = {
    target_ref: string;
    formula_id: string;
    expression: string;
    worksheet_name: string;
    dependency_refs: string[];
    result_kind: "scalar" | "matrix" | "lambda" | "error";
    scalar_result?: SerializedFormulaScalar;
    matrix_result?: SerializedFormulaScalar[][];
    error_code?: string;
};
type FormulaWorkerBatchResult = {
    execution_mode: "worker_threads";
    worker_id: string;
    target_formula_refs: string[];
    volatile_refs: string[];
    spill_edges: Array<{
        anchor_ref: string;
        spill_ref: string;
    }>;
    warnings: Warning[];
    results: SerializedFormulaCellResult[];
};
export declare const evaluateFormulaTargetsFromWorkbookModel: (input: {
    workbookModel: ExcelJS.WorkbookModel;
    targetRefs: string[];
    evalStamp: string;
    workerId: string;
}) => FormulaWorkerBatchResult;
export declare class ExcelEngine {
    importWorkbook(input: ExcelImportRequest): Promise<ExcelRunState>;
    analyzeWorkbook(state: ExcelRunState, actorRef: string): WorkbookAnalysis;
    importLambdaRegistry(state: ExcelRunState, actorRef: string, inputPath: string): Promise<LambdaRegistryEntry[]>;
    exportLambdaRegistry(state: ExcelRunState, actorRef: string, targetPath: string): string;
    recalculateFormulas(state: ExcelRunState, input: FormulaRecalculationRequest): Promise<FormulaGraphState>;
    applyTransformation(state: ExcelRunState, plan: TransformationPlan, actorRef: string): Promise<TransformationResult>;
    generatePivot(state: ExcelRunState, input: PivotRequest): PivotMetadata;
    generateChart(state: ExcelRunState, input: ChartRequest, artifactDir: string): ChartMetadata;
    applyFormatting(state: ExcelRunState, input: FormattingRequest): Promise<StyleMetadata>;
    exportEditableWorkbook(state: ExcelRunState, actorRef: string, targetPath: string): Promise<string>;
    publishWorkbook(state: ExcelRunState, input: PublishRequest, exportPath: string): Publication;
    persistRunState(state: ExcelRunState, evidencePack: EvidencePack, exportedWorkbookPath: string | null, chartPaths: string[]): PersistenceManifest;
    registerExcelCapability(runtime: RegistryBootstrap): void;
    runSample(input: SampleRunRequest): Promise<ExcelSampleRun>;
}
export {};
