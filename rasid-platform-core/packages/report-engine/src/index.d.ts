import { RegistryBootstrap } from "@rasid/capability-registry";
import { type DashboardPublicationResult, type DashboardWorkflowResult } from "@rasid/dashboard-engine";
import { type PresentationBundle, type PresentationPublicationResult } from "@rasid/presentations-engine";
import { type Artifact, type LibraryAsset, type Publication, type ReportDiffMetadata, type SharedSchedule } from "@rasid/contracts";
import { z } from "zod";
import { ReportEngineStore, type ExternalIngestRecord, type PersistableReportState, type ReportBackSyncRecord, type ReportTransportDeliveryRecord, type ScheduledDispatchRecord, type ScheduledOrchestrationRecord, type StoredExecutionStage } from "./store";
declare const CreateReportRequestSchema: z.ZodObject<{
    report_id: z.ZodOptional<z.ZodString>;
    tenant_ref: z.ZodString;
    workspace_id: z.ZodString;
    project_id: z.ZodString;
    created_by: z.ZodString;
    title: z.ZodString;
    description: z.ZodDefault<z.ZodString>;
    report_type: z.ZodDefault<z.ZodString>;
    mode: z.ZodDefault<z.ZodEnum<["easy", "advanced"]>>;
    language: z.ZodDefault<z.ZodString>;
    template_ref: z.ZodDefault<z.ZodString>;
    brand_preset_ref: z.ZodDefault<z.ZodString>;
    source_refs: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    sections: z.ZodArray<z.ZodObject<{
        section_kind: z.ZodEnum<["cover", "executive_summary", "body", "appendix"]>;
        title: z.ZodString;
        blocks: z.ZodArray<z.ZodObject<{
            block_type: z.ZodEnum<["narrative", "metric_card", "table", "chart", "commentary"]>;
            title: z.ZodString;
            body: z.ZodDefault<z.ZodString>;
            dataset_ref: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            query_ref: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            field_mappings: z.ZodDefault<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">>;
            citations: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            metric_value: z.ZodOptional<z.ZodNumber>;
            table_rows: z.ZodDefault<z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">>;
            chart_series: z.ZodDefault<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber]>>, "many">>;
            caption: z.ZodDefault<z.ZodString>;
            page_number: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
            source_metadata: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            layout_semantics: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            source_lineage_refs: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            title: string;
            body: string;
            block_type: "narrative" | "metric_card" | "table" | "chart" | "commentary";
            dataset_ref: string | null;
            query_ref: string | null;
            field_mappings: Record<string, unknown>[];
            citations: string[];
            table_rows: string[][];
            chart_series: Record<string, string | number>[];
            caption: string;
            page_number: number | null;
            source_metadata: Record<string, unknown>;
            layout_semantics: Record<string, unknown>;
            source_lineage_refs: string[];
            metric_value?: number | undefined;
        }, {
            title: string;
            block_type: "narrative" | "metric_card" | "table" | "chart" | "commentary";
            body?: string | undefined;
            dataset_ref?: string | null | undefined;
            query_ref?: string | null | undefined;
            field_mappings?: Record<string, unknown>[] | undefined;
            citations?: string[] | undefined;
            metric_value?: number | undefined;
            table_rows?: string[][] | undefined;
            chart_series?: Record<string, string | number>[] | undefined;
            caption?: string | undefined;
            page_number?: number | null | undefined;
            source_metadata?: Record<string, unknown> | undefined;
            layout_semantics?: Record<string, unknown> | undefined;
            source_lineage_refs?: string[] | undefined;
        }>, "many">;
        lock_policy: z.ZodDefault<z.ZodEnum<["editable", "soft_lock", "strict_lock"]>>;
    }, "strip", z.ZodTypeAny, {
        title: string;
        section_kind: "cover" | "executive_summary" | "body" | "appendix";
        blocks: {
            title: string;
            body: string;
            block_type: "narrative" | "metric_card" | "table" | "chart" | "commentary";
            dataset_ref: string | null;
            query_ref: string | null;
            field_mappings: Record<string, unknown>[];
            citations: string[];
            table_rows: string[][];
            chart_series: Record<string, string | number>[];
            caption: string;
            page_number: number | null;
            source_metadata: Record<string, unknown>;
            layout_semantics: Record<string, unknown>;
            source_lineage_refs: string[];
            metric_value?: number | undefined;
        }[];
        lock_policy: "editable" | "soft_lock" | "strict_lock";
    }, {
        title: string;
        section_kind: "cover" | "executive_summary" | "body" | "appendix";
        blocks: {
            title: string;
            block_type: "narrative" | "metric_card" | "table" | "chart" | "commentary";
            body?: string | undefined;
            dataset_ref?: string | null | undefined;
            query_ref?: string | null | undefined;
            field_mappings?: Record<string, unknown>[] | undefined;
            citations?: string[] | undefined;
            metric_value?: number | undefined;
            table_rows?: string[][] | undefined;
            chart_series?: Record<string, string | number>[] | undefined;
            caption?: string | undefined;
            page_number?: number | null | undefined;
            source_metadata?: Record<string, unknown> | undefined;
            layout_semantics?: Record<string, unknown> | undefined;
            source_lineage_refs?: string[] | undefined;
        }[];
        lock_policy?: "editable" | "soft_lock" | "strict_lock" | undefined;
    }>, "many">;
    permission_scope: z.ZodDefault<z.ZodObject<{
        visibility: z.ZodEnum<["private", "workspace", "tenant", "shared_link"]>;
        allow_read: z.ZodBoolean;
        allow_write: z.ZodBoolean;
        allow_share: z.ZodBoolean;
        allow_publish: z.ZodBoolean;
        allow_audit_view: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        visibility: "private" | "workspace" | "tenant" | "shared_link";
        allow_read: boolean;
        allow_write: boolean;
        allow_share: boolean;
        allow_publish: boolean;
        allow_audit_view: boolean;
    }, {
        visibility: "private" | "workspace" | "tenant" | "shared_link";
        allow_read: boolean;
        allow_write: boolean;
        allow_share: boolean;
        allow_publish: boolean;
        allow_audit_view: boolean;
    }>>;
    timestamp: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    tenant_ref: string;
    workspace_id: string;
    project_id: string;
    created_by: string;
    title: string;
    description: string;
    report_type: string;
    mode: "easy" | "advanced";
    language: string;
    template_ref: string;
    brand_preset_ref: string;
    source_refs: string[];
    sections: {
        title: string;
        section_kind: "cover" | "executive_summary" | "body" | "appendix";
        blocks: {
            title: string;
            body: string;
            block_type: "narrative" | "metric_card" | "table" | "chart" | "commentary";
            dataset_ref: string | null;
            query_ref: string | null;
            field_mappings: Record<string, unknown>[];
            citations: string[];
            table_rows: string[][];
            chart_series: Record<string, string | number>[];
            caption: string;
            page_number: number | null;
            source_metadata: Record<string, unknown>;
            layout_semantics: Record<string, unknown>;
            source_lineage_refs: string[];
            metric_value?: number | undefined;
        }[];
        lock_policy: "editable" | "soft_lock" | "strict_lock";
    }[];
    permission_scope: {
        visibility: "private" | "workspace" | "tenant" | "shared_link";
        allow_read: boolean;
        allow_write: boolean;
        allow_share: boolean;
        allow_publish: boolean;
        allow_audit_view: boolean;
    };
    report_id?: string | undefined;
    timestamp?: string | undefined;
}, {
    tenant_ref: string;
    workspace_id: string;
    project_id: string;
    created_by: string;
    title: string;
    sections: {
        title: string;
        section_kind: "cover" | "executive_summary" | "body" | "appendix";
        blocks: {
            title: string;
            block_type: "narrative" | "metric_card" | "table" | "chart" | "commentary";
            body?: string | undefined;
            dataset_ref?: string | null | undefined;
            query_ref?: string | null | undefined;
            field_mappings?: Record<string, unknown>[] | undefined;
            citations?: string[] | undefined;
            metric_value?: number | undefined;
            table_rows?: string[][] | undefined;
            chart_series?: Record<string, string | number>[] | undefined;
            caption?: string | undefined;
            page_number?: number | null | undefined;
            source_metadata?: Record<string, unknown> | undefined;
            layout_semantics?: Record<string, unknown> | undefined;
            source_lineage_refs?: string[] | undefined;
        }[];
        lock_policy?: "editable" | "soft_lock" | "strict_lock" | undefined;
    }[];
    report_id?: string | undefined;
    description?: string | undefined;
    report_type?: string | undefined;
    mode?: "easy" | "advanced" | undefined;
    language?: string | undefined;
    template_ref?: string | undefined;
    brand_preset_ref?: string | undefined;
    source_refs?: string[] | undefined;
    permission_scope?: {
        visibility: "private" | "workspace" | "tenant" | "shared_link";
        allow_read: boolean;
        allow_write: boolean;
        allow_share: boolean;
        allow_publish: boolean;
        allow_audit_view: boolean;
    } | undefined;
    timestamp?: string | undefined;
}>;
declare const UpdateReportRequestSchema: z.ZodObject<{
    report_id: z.ZodString;
    actor_ref: z.ZodString;
    mutation: z.ZodDiscriminatedUnion<"mutation_kind", [z.ZodObject<{
        mutation_kind: z.ZodLiteral<"add_section">;
        section: z.ZodObject<{
            section_kind: z.ZodEnum<["cover", "executive_summary", "body", "appendix"]>;
            title: z.ZodString;
            blocks: z.ZodArray<z.ZodObject<{
                block_type: z.ZodEnum<["narrative", "metric_card", "table", "chart", "commentary"]>;
                title: z.ZodString;
                body: z.ZodDefault<z.ZodString>;
                dataset_ref: z.ZodDefault<z.ZodNullable<z.ZodString>>;
                query_ref: z.ZodDefault<z.ZodNullable<z.ZodString>>;
                field_mappings: z.ZodDefault<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">>;
                citations: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
                metric_value: z.ZodOptional<z.ZodNumber>;
                table_rows: z.ZodDefault<z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">>;
                chart_series: z.ZodDefault<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber]>>, "many">>;
                caption: z.ZodDefault<z.ZodString>;
                page_number: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
                source_metadata: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                layout_semantics: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
                source_lineage_refs: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            }, "strip", z.ZodTypeAny, {
                title: string;
                body: string;
                block_type: "narrative" | "metric_card" | "table" | "chart" | "commentary";
                dataset_ref: string | null;
                query_ref: string | null;
                field_mappings: Record<string, unknown>[];
                citations: string[];
                table_rows: string[][];
                chart_series: Record<string, string | number>[];
                caption: string;
                page_number: number | null;
                source_metadata: Record<string, unknown>;
                layout_semantics: Record<string, unknown>;
                source_lineage_refs: string[];
                metric_value?: number | undefined;
            }, {
                title: string;
                block_type: "narrative" | "metric_card" | "table" | "chart" | "commentary";
                body?: string | undefined;
                dataset_ref?: string | null | undefined;
                query_ref?: string | null | undefined;
                field_mappings?: Record<string, unknown>[] | undefined;
                citations?: string[] | undefined;
                metric_value?: number | undefined;
                table_rows?: string[][] | undefined;
                chart_series?: Record<string, string | number>[] | undefined;
                caption?: string | undefined;
                page_number?: number | null | undefined;
                source_metadata?: Record<string, unknown> | undefined;
                layout_semantics?: Record<string, unknown> | undefined;
                source_lineage_refs?: string[] | undefined;
            }>, "many">;
            lock_policy: z.ZodDefault<z.ZodEnum<["editable", "soft_lock", "strict_lock"]>>;
        }, "strip", z.ZodTypeAny, {
            title: string;
            section_kind: "cover" | "executive_summary" | "body" | "appendix";
            blocks: {
                title: string;
                body: string;
                block_type: "narrative" | "metric_card" | "table" | "chart" | "commentary";
                dataset_ref: string | null;
                query_ref: string | null;
                field_mappings: Record<string, unknown>[];
                citations: string[];
                table_rows: string[][];
                chart_series: Record<string, string | number>[];
                caption: string;
                page_number: number | null;
                source_metadata: Record<string, unknown>;
                layout_semantics: Record<string, unknown>;
                source_lineage_refs: string[];
                metric_value?: number | undefined;
            }[];
            lock_policy: "editable" | "soft_lock" | "strict_lock";
        }, {
            title: string;
            section_kind: "cover" | "executive_summary" | "body" | "appendix";
            blocks: {
                title: string;
                block_type: "narrative" | "metric_card" | "table" | "chart" | "commentary";
                body?: string | undefined;
                dataset_ref?: string | null | undefined;
                query_ref?: string | null | undefined;
                field_mappings?: Record<string, unknown>[] | undefined;
                citations?: string[] | undefined;
                metric_value?: number | undefined;
                table_rows?: string[][] | undefined;
                chart_series?: Record<string, string | number>[] | undefined;
                caption?: string | undefined;
                page_number?: number | null | undefined;
                source_metadata?: Record<string, unknown> | undefined;
                layout_semantics?: Record<string, unknown> | undefined;
                source_lineage_refs?: string[] | undefined;
            }[];
            lock_policy?: "editable" | "soft_lock" | "strict_lock" | undefined;
        }>;
    }, "strip", z.ZodTypeAny, {
        mutation_kind: "add_section";
        section: {
            title: string;
            section_kind: "cover" | "executive_summary" | "body" | "appendix";
            blocks: {
                title: string;
                body: string;
                block_type: "narrative" | "metric_card" | "table" | "chart" | "commentary";
                dataset_ref: string | null;
                query_ref: string | null;
                field_mappings: Record<string, unknown>[];
                citations: string[];
                table_rows: string[][];
                chart_series: Record<string, string | number>[];
                caption: string;
                page_number: number | null;
                source_metadata: Record<string, unknown>;
                layout_semantics: Record<string, unknown>;
                source_lineage_refs: string[];
                metric_value?: number | undefined;
            }[];
            lock_policy: "editable" | "soft_lock" | "strict_lock";
        };
    }, {
        mutation_kind: "add_section";
        section: {
            title: string;
            section_kind: "cover" | "executive_summary" | "body" | "appendix";
            blocks: {
                title: string;
                block_type: "narrative" | "metric_card" | "table" | "chart" | "commentary";
                body?: string | undefined;
                dataset_ref?: string | null | undefined;
                query_ref?: string | null | undefined;
                field_mappings?: Record<string, unknown>[] | undefined;
                citations?: string[] | undefined;
                metric_value?: number | undefined;
                table_rows?: string[][] | undefined;
                chart_series?: Record<string, string | number>[] | undefined;
                caption?: string | undefined;
                page_number?: number | null | undefined;
                source_metadata?: Record<string, unknown> | undefined;
                layout_semantics?: Record<string, unknown> | undefined;
                source_lineage_refs?: string[] | undefined;
            }[];
            lock_policy?: "editable" | "soft_lock" | "strict_lock" | undefined;
        };
    }>, z.ZodObject<{
        mutation_kind: z.ZodLiteral<"replace_block_content">;
        block_ref: z.ZodString;
        title: z.ZodOptional<z.ZodString>;
        body: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        body: string;
        mutation_kind: "replace_block_content";
        block_ref: string;
        title?: string | undefined;
    }, {
        body: string;
        mutation_kind: "replace_block_content";
        block_ref: string;
        title?: string | undefined;
    }>, z.ZodObject<{
        mutation_kind: z.ZodLiteral<"rebind_block">;
        block_ref: z.ZodString;
        dataset_ref: z.ZodString;
        query_ref: z.ZodString;
        field_mappings: z.ZodDefault<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">>;
    }, "strip", z.ZodTypeAny, {
        dataset_ref: string;
        query_ref: string;
        field_mappings: Record<string, unknown>[];
        mutation_kind: "rebind_block";
        block_ref: string;
    }, {
        dataset_ref: string;
        query_ref: string;
        mutation_kind: "rebind_block";
        block_ref: string;
        field_mappings?: Record<string, unknown>[] | undefined;
    }>, z.ZodObject<{
        mutation_kind: z.ZodLiteral<"reconcile_section">;
        section_title: z.ZodString;
        downstream_capability: z.ZodEnum<["presentations", "dashboards"]>;
        downstream_ref: z.ZodString;
        downstream_publication_ref: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        downstream_version_ref: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        merge_mode: z.ZodDefault<z.ZodEnum<["structural_merge", "conflict_preserving"]>>;
        allow_prune: z.ZodDefault<z.ZodBoolean>;
        blocks: z.ZodDefault<z.ZodArray<z.ZodObject<{
            block_type: z.ZodEnum<["narrative", "metric_card", "table", "chart", "commentary"]>;
            title: z.ZodString;
            body: z.ZodDefault<z.ZodString>;
            dataset_ref: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            query_ref: z.ZodDefault<z.ZodNullable<z.ZodString>>;
            field_mappings: z.ZodDefault<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">>;
            citations: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
            metric_value: z.ZodOptional<z.ZodNumber>;
            table_rows: z.ZodDefault<z.ZodArray<z.ZodArray<z.ZodString, "many">, "many">>;
            chart_series: z.ZodDefault<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnion<[z.ZodString, z.ZodNumber]>>, "many">>;
            caption: z.ZodDefault<z.ZodString>;
            page_number: z.ZodDefault<z.ZodNullable<z.ZodNumber>>;
            source_metadata: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            layout_semantics: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
            source_lineage_refs: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        }, "strip", z.ZodTypeAny, {
            title: string;
            body: string;
            block_type: "narrative" | "metric_card" | "table" | "chart" | "commentary";
            dataset_ref: string | null;
            query_ref: string | null;
            field_mappings: Record<string, unknown>[];
            citations: string[];
            table_rows: string[][];
            chart_series: Record<string, string | number>[];
            caption: string;
            page_number: number | null;
            source_metadata: Record<string, unknown>;
            layout_semantics: Record<string, unknown>;
            source_lineage_refs: string[];
            metric_value?: number | undefined;
        }, {
            title: string;
            block_type: "narrative" | "metric_card" | "table" | "chart" | "commentary";
            body?: string | undefined;
            dataset_ref?: string | null | undefined;
            query_ref?: string | null | undefined;
            field_mappings?: Record<string, unknown>[] | undefined;
            citations?: string[] | undefined;
            metric_value?: number | undefined;
            table_rows?: string[][] | undefined;
            chart_series?: Record<string, string | number>[] | undefined;
            caption?: string | undefined;
            page_number?: number | null | undefined;
            source_metadata?: Record<string, unknown> | undefined;
            layout_semantics?: Record<string, unknown> | undefined;
            source_lineage_refs?: string[] | undefined;
        }>, "many">>;
    }, "strip", z.ZodTypeAny, {
        blocks: {
            title: string;
            body: string;
            block_type: "narrative" | "metric_card" | "table" | "chart" | "commentary";
            dataset_ref: string | null;
            query_ref: string | null;
            field_mappings: Record<string, unknown>[];
            citations: string[];
            table_rows: string[][];
            chart_series: Record<string, string | number>[];
            caption: string;
            page_number: number | null;
            source_metadata: Record<string, unknown>;
            layout_semantics: Record<string, unknown>;
            source_lineage_refs: string[];
            metric_value?: number | undefined;
        }[];
        mutation_kind: "reconcile_section";
        section_title: string;
        downstream_capability: "presentations" | "dashboards";
        downstream_ref: string;
        downstream_publication_ref: string | null;
        downstream_version_ref: string | null;
        merge_mode: "structural_merge" | "conflict_preserving";
        allow_prune: boolean;
    }, {
        mutation_kind: "reconcile_section";
        section_title: string;
        downstream_capability: "presentations" | "dashboards";
        downstream_ref: string;
        blocks?: {
            title: string;
            block_type: "narrative" | "metric_card" | "table" | "chart" | "commentary";
            body?: string | undefined;
            dataset_ref?: string | null | undefined;
            query_ref?: string | null | undefined;
            field_mappings?: Record<string, unknown>[] | undefined;
            citations?: string[] | undefined;
            metric_value?: number | undefined;
            table_rows?: string[][] | undefined;
            chart_series?: Record<string, string | number>[] | undefined;
            caption?: string | undefined;
            page_number?: number | null | undefined;
            source_metadata?: Record<string, unknown> | undefined;
            layout_semantics?: Record<string, unknown> | undefined;
            source_lineage_refs?: string[] | undefined;
        }[] | undefined;
        downstream_publication_ref?: string | null | undefined;
        downstream_version_ref?: string | null | undefined;
        merge_mode?: "structural_merge" | "conflict_preserving" | undefined;
        allow_prune?: boolean | undefined;
    }>]>;
    timestamp: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    report_id: string;
    actor_ref: string;
    mutation: {
        mutation_kind: "add_section";
        section: {
            title: string;
            section_kind: "cover" | "executive_summary" | "body" | "appendix";
            blocks: {
                title: string;
                body: string;
                block_type: "narrative" | "metric_card" | "table" | "chart" | "commentary";
                dataset_ref: string | null;
                query_ref: string | null;
                field_mappings: Record<string, unknown>[];
                citations: string[];
                table_rows: string[][];
                chart_series: Record<string, string | number>[];
                caption: string;
                page_number: number | null;
                source_metadata: Record<string, unknown>;
                layout_semantics: Record<string, unknown>;
                source_lineage_refs: string[];
                metric_value?: number | undefined;
            }[];
            lock_policy: "editable" | "soft_lock" | "strict_lock";
        };
    } | {
        body: string;
        mutation_kind: "replace_block_content";
        block_ref: string;
        title?: string | undefined;
    } | {
        dataset_ref: string;
        query_ref: string;
        field_mappings: Record<string, unknown>[];
        mutation_kind: "rebind_block";
        block_ref: string;
    } | {
        blocks: {
            title: string;
            body: string;
            block_type: "narrative" | "metric_card" | "table" | "chart" | "commentary";
            dataset_ref: string | null;
            query_ref: string | null;
            field_mappings: Record<string, unknown>[];
            citations: string[];
            table_rows: string[][];
            chart_series: Record<string, string | number>[];
            caption: string;
            page_number: number | null;
            source_metadata: Record<string, unknown>;
            layout_semantics: Record<string, unknown>;
            source_lineage_refs: string[];
            metric_value?: number | undefined;
        }[];
        mutation_kind: "reconcile_section";
        section_title: string;
        downstream_capability: "presentations" | "dashboards";
        downstream_ref: string;
        downstream_publication_ref: string | null;
        downstream_version_ref: string | null;
        merge_mode: "structural_merge" | "conflict_preserving";
        allow_prune: boolean;
    };
    timestamp?: string | undefined;
}, {
    report_id: string;
    actor_ref: string;
    mutation: {
        mutation_kind: "add_section";
        section: {
            title: string;
            section_kind: "cover" | "executive_summary" | "body" | "appendix";
            blocks: {
                title: string;
                block_type: "narrative" | "metric_card" | "table" | "chart" | "commentary";
                body?: string | undefined;
                dataset_ref?: string | null | undefined;
                query_ref?: string | null | undefined;
                field_mappings?: Record<string, unknown>[] | undefined;
                citations?: string[] | undefined;
                metric_value?: number | undefined;
                table_rows?: string[][] | undefined;
                chart_series?: Record<string, string | number>[] | undefined;
                caption?: string | undefined;
                page_number?: number | null | undefined;
                source_metadata?: Record<string, unknown> | undefined;
                layout_semantics?: Record<string, unknown> | undefined;
                source_lineage_refs?: string[] | undefined;
            }[];
            lock_policy?: "editable" | "soft_lock" | "strict_lock" | undefined;
        };
    } | {
        body: string;
        mutation_kind: "replace_block_content";
        block_ref: string;
        title?: string | undefined;
    } | {
        dataset_ref: string;
        query_ref: string;
        mutation_kind: "rebind_block";
        block_ref: string;
        field_mappings?: Record<string, unknown>[] | undefined;
    } | {
        mutation_kind: "reconcile_section";
        section_title: string;
        downstream_capability: "presentations" | "dashboards";
        downstream_ref: string;
        blocks?: {
            title: string;
            block_type: "narrative" | "metric_card" | "table" | "chart" | "commentary";
            body?: string | undefined;
            dataset_ref?: string | null | undefined;
            query_ref?: string | null | undefined;
            field_mappings?: Record<string, unknown>[] | undefined;
            citations?: string[] | undefined;
            metric_value?: number | undefined;
            table_rows?: string[][] | undefined;
            chart_series?: Record<string, string | number>[] | undefined;
            caption?: string | undefined;
            page_number?: number | null | undefined;
            source_metadata?: Record<string, unknown> | undefined;
            layout_semantics?: Record<string, unknown> | undefined;
            source_lineage_refs?: string[] | undefined;
        }[] | undefined;
        downstream_publication_ref?: string | null | undefined;
        downstream_version_ref?: string | null | undefined;
        merge_mode?: "structural_merge" | "conflict_preserving" | undefined;
        allow_prune?: boolean | undefined;
    };
    timestamp?: string | undefined;
}>;
declare const RefreshReportRequestSchema: z.ZodObject<{
    report_id: z.ZodString;
    actor_ref: z.ZodString;
    selective_regeneration_refs: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    timestamp: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    report_id: string;
    actor_ref: string;
    selective_regeneration_refs: string[];
    timestamp?: string | undefined;
}, {
    report_id: string;
    actor_ref: string;
    timestamp?: string | undefined;
    selective_regeneration_refs?: string[] | undefined;
}>;
declare const CompareReportsRequestSchema: z.ZodObject<{
    report_id: z.ZodString;
    actor_ref: z.ZodString;
    base_version_ref: z.ZodString;
    target_version_ref: z.ZodString;
    timestamp: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    report_id: string;
    actor_ref: string;
    base_version_ref: string;
    target_version_ref: string;
    timestamp?: string | undefined;
}, {
    report_id: string;
    actor_ref: string;
    base_version_ref: string;
    target_version_ref: string;
    timestamp?: string | undefined;
}>;
declare const ReviewReportRequestSchema: z.ZodObject<{
    report_id: z.ZodString;
    actor_ref: z.ZodString;
    reviewer_refs: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    decision: z.ZodEnum<["in_review", "changes_requested", "reviewed"]>;
    comment: z.ZodDefault<z.ZodString>;
    timestamp: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    report_id: string;
    actor_ref: string;
    reviewer_refs: string[];
    decision: "in_review" | "changes_requested" | "reviewed";
    comment: string;
    timestamp?: string | undefined;
}, {
    report_id: string;
    actor_ref: string;
    decision: "in_review" | "changes_requested" | "reviewed";
    timestamp?: string | undefined;
    reviewer_refs?: string[] | undefined;
    comment?: string | undefined;
}>;
declare const ApproveReportRequestSchema: z.ZodObject<{
    report_id: z.ZodString;
    actor_ref: z.ZodString;
    decision: z.ZodEnum<["approved", "rejected"]>;
    comment: z.ZodDefault<z.ZodString>;
    timestamp: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    report_id: string;
    actor_ref: string;
    decision: "approved" | "rejected";
    comment: string;
    timestamp?: string | undefined;
}, {
    report_id: string;
    actor_ref: string;
    decision: "approved" | "rejected";
    timestamp?: string | undefined;
    comment?: string | undefined;
}>;
declare const PublishReportRequestSchema: z.ZodObject<{
    report_id: z.ZodString;
    actor_ref: z.ZodString;
    target_ref: z.ZodString;
    publish_to_library: z.ZodDefault<z.ZodBoolean>;
    timestamp: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    report_id: string;
    actor_ref: string;
    target_ref: string;
    publish_to_library: boolean;
    timestamp?: string | undefined;
}, {
    report_id: string;
    actor_ref: string;
    target_ref: string;
    timestamp?: string | undefined;
    publish_to_library?: boolean | undefined;
}>;
declare const ScheduleReportRequestSchema: z.ZodObject<{
    report_id: z.ZodString;
    actor_ref: z.ZodString;
    schedule_type: z.ZodDefault<z.ZodString>;
    cadence: z.ZodDefault<z.ZodEnum<["weekly", "monthly", "on_demand", "custom"]>>;
    timezone: z.ZodDefault<z.ZodString>;
    next_run_at: z.ZodNullable<z.ZodString>;
    trigger_policy: z.ZodObject<{
        trigger_mode: z.ZodEnum<["calendar", "manual", "event"]>;
        misfire_policy: z.ZodEnum<["skip", "run_next", "run_immediately"]>;
        require_fresh_inputs: z.ZodBoolean;
        require_approval_before_run: z.ZodBoolean;
        freshness_window_minutes: z.ZodNullable<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        trigger_mode: "calendar" | "manual" | "event";
        misfire_policy: "skip" | "run_next" | "run_immediately";
        require_fresh_inputs: boolean;
        require_approval_before_run: boolean;
        freshness_window_minutes: number | null;
    }, {
        trigger_mode: "calendar" | "manual" | "event";
        misfire_policy: "skip" | "run_next" | "run_immediately";
        require_fresh_inputs: boolean;
        require_approval_before_run: boolean;
        freshness_window_minutes: number | null;
    }>;
    publication_policy: z.ZodObject<{
        publish_mode: z.ZodEnum<["never", "on_success", "on_approval", "always"]>;
        publication_target_refs: z.ZodArray<z.ZodString, "many">;
        export_profile_refs: z.ZodArray<z.ZodString, "many">;
        visibility_scope_ref: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        publish_mode: "never" | "on_success" | "on_approval" | "always";
        publication_target_refs: string[];
        export_profile_refs: string[];
        visibility_scope_ref: string | null;
    }, {
        publish_mode: "never" | "on_success" | "on_approval" | "always";
        publication_target_refs: string[];
        export_profile_refs: string[];
        visibility_scope_ref: string | null;
    }>;
    selective_regeneration_refs: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    enabled: z.ZodDefault<z.ZodBoolean>;
    timestamp: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    report_id: string;
    actor_ref: string;
    selective_regeneration_refs: string[];
    schedule_type: string;
    cadence: "custom" | "weekly" | "monthly" | "on_demand";
    timezone: string;
    next_run_at: string | null;
    trigger_policy: {
        trigger_mode: "calendar" | "manual" | "event";
        misfire_policy: "skip" | "run_next" | "run_immediately";
        require_fresh_inputs: boolean;
        require_approval_before_run: boolean;
        freshness_window_minutes: number | null;
    };
    publication_policy: {
        publish_mode: "never" | "on_success" | "on_approval" | "always";
        publication_target_refs: string[];
        export_profile_refs: string[];
        visibility_scope_ref: string | null;
    };
    enabled: boolean;
    timestamp?: string | undefined;
}, {
    report_id: string;
    actor_ref: string;
    next_run_at: string | null;
    trigger_policy: {
        trigger_mode: "calendar" | "manual" | "event";
        misfire_policy: "skip" | "run_next" | "run_immediately";
        require_fresh_inputs: boolean;
        require_approval_before_run: boolean;
        freshness_window_minutes: number | null;
    };
    publication_policy: {
        publish_mode: "never" | "on_success" | "on_approval" | "always";
        publication_target_refs: string[];
        export_profile_refs: string[];
        visibility_scope_ref: string | null;
    };
    timestamp?: string | undefined;
    selective_regeneration_refs?: string[] | undefined;
    schedule_type?: string | undefined;
    cadence?: "custom" | "weekly" | "monthly" | "on_demand" | undefined;
    timezone?: string | undefined;
    enabled?: boolean | undefined;
}>;
declare const ListReportSchedulesRequestSchema: z.ZodObject<{
    report_id: z.ZodOptional<z.ZodString>;
    include_disabled: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    include_disabled: boolean;
    report_id?: string | undefined;
}, {
    report_id?: string | undefined;
    include_disabled?: boolean | undefined;
}>;
declare const UpdateReportScheduleRequestSchema: z.ZodObject<{
    schedule_id: z.ZodString;
    actor_ref: z.ZodString;
    next_run_at: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    enabled: z.ZodOptional<z.ZodBoolean>;
    publication_target_refs: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    export_profile_refs: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    visibility_scope_ref: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    selective_regeneration_refs: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    timestamp: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    actor_ref: string;
    schedule_id: string;
    timestamp?: string | undefined;
    selective_regeneration_refs?: string[] | undefined;
    next_run_at?: string | null | undefined;
    publication_target_refs?: string[] | undefined;
    export_profile_refs?: string[] | undefined;
    visibility_scope_ref?: string | null | undefined;
    enabled?: boolean | undefined;
}, {
    actor_ref: string;
    schedule_id: string;
    timestamp?: string | undefined;
    selective_regeneration_refs?: string[] | undefined;
    next_run_at?: string | null | undefined;
    publication_target_refs?: string[] | undefined;
    export_profile_refs?: string[] | undefined;
    visibility_scope_ref?: string | null | undefined;
    enabled?: boolean | undefined;
}>;
declare const CancelReportScheduleRequestSchema: z.ZodObject<{
    schedule_id: z.ZodString;
    actor_ref: z.ZodString;
    reason: z.ZodDefault<z.ZodString>;
    timestamp: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    actor_ref: string;
    schedule_id: string;
    reason: string;
    timestamp?: string | undefined;
}, {
    actor_ref: string;
    schedule_id: string;
    timestamp?: string | undefined;
    reason?: string | undefined;
}>;
declare const ResumeReportScheduleRequestSchema: z.ZodObject<{
    schedule_id: z.ZodString;
    actor_ref: z.ZodString;
    next_run_at: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    timestamp: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    actor_ref: string;
    schedule_id: string;
    timestamp?: string | undefined;
    next_run_at?: string | null | undefined;
}, {
    actor_ref: string;
    schedule_id: string;
    timestamp?: string | undefined;
    next_run_at?: string | null | undefined;
}>;
declare const RunReportScheduleRequestSchema: z.ZodObject<{
    schedule_id: z.ZodString;
    actor_ref: z.ZodDefault<z.ZodString>;
    run_at: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    actor_ref: string;
    schedule_id: string;
    run_at?: string | undefined;
}, {
    schedule_id: string;
    actor_ref?: string | undefined;
    run_at?: string | undefined;
}>;
declare const ExportReportRequestSchema: z.ZodObject<{
    report_id: z.ZodString;
    actor_ref: z.ZodString;
    target: z.ZodEnum<["docx", "pdf", "html"]>;
    timestamp: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    report_id: string;
    actor_ref: string;
    target: "docx" | "pdf" | "html";
    timestamp?: string | undefined;
}, {
    report_id: string;
    actor_ref: string;
    target: "docx" | "pdf" | "html";
    timestamp?: string | undefined;
}>;
declare const ConvertReportRequestSchema: z.ZodObject<{
    report_id: z.ZodString;
    actor_ref: z.ZodString;
    target_ref: z.ZodDefault<z.ZodString>;
    timestamp: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    report_id: string;
    actor_ref: string;
    target_ref: string;
    timestamp?: string | undefined;
}, {
    report_id: string;
    actor_ref: string;
    timestamp?: string | undefined;
    target_ref?: string | undefined;
}>;
declare const IngestExternalReportRequestSchema: z.ZodObject<{
    report_id: z.ZodOptional<z.ZodString>;
    tenant_ref: z.ZodString;
    workspace_id: z.ZodString;
    project_id: z.ZodString;
    created_by: z.ZodString;
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodDefault<z.ZodString>;
    report_type: z.ZodDefault<z.ZodString>;
    mode: z.ZodDefault<z.ZodEnum<["easy", "advanced"]>>;
    language: z.ZodDefault<z.ZodString>;
    template_ref: z.ZodDefault<z.ZodString>;
    brand_preset_ref: z.ZodDefault<z.ZodString>;
    source_refs: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    file_path: z.ZodString;
    mime_type: z.ZodOptional<z.ZodString>;
    parser_hint: z.ZodDefault<z.ZodEnum<["auto", "docx", "pdf"]>>;
    permission_scope: z.ZodDefault<z.ZodObject<{
        visibility: z.ZodEnum<["private", "workspace", "tenant", "shared_link"]>;
        allow_read: z.ZodBoolean;
        allow_write: z.ZodBoolean;
        allow_share: z.ZodBoolean;
        allow_publish: z.ZodBoolean;
        allow_audit_view: z.ZodBoolean;
    }, "strip", z.ZodTypeAny, {
        visibility: "private" | "workspace" | "tenant" | "shared_link";
        allow_read: boolean;
        allow_write: boolean;
        allow_share: boolean;
        allow_publish: boolean;
        allow_audit_view: boolean;
    }, {
        visibility: "private" | "workspace" | "tenant" | "shared_link";
        allow_read: boolean;
        allow_write: boolean;
        allow_share: boolean;
        allow_publish: boolean;
        allow_audit_view: boolean;
    }>>;
    timestamp: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    tenant_ref: string;
    workspace_id: string;
    project_id: string;
    created_by: string;
    description: string;
    report_type: string;
    mode: "easy" | "advanced";
    language: string;
    template_ref: string;
    brand_preset_ref: string;
    source_refs: string[];
    permission_scope: {
        visibility: "private" | "workspace" | "tenant" | "shared_link";
        allow_read: boolean;
        allow_write: boolean;
        allow_share: boolean;
        allow_publish: boolean;
        allow_audit_view: boolean;
    };
    file_path: string;
    parser_hint: "docx" | "pdf" | "auto";
    report_id?: string | undefined;
    title?: string | undefined;
    timestamp?: string | undefined;
    mime_type?: string | undefined;
}, {
    tenant_ref: string;
    workspace_id: string;
    project_id: string;
    created_by: string;
    file_path: string;
    report_id?: string | undefined;
    title?: string | undefined;
    description?: string | undefined;
    report_type?: string | undefined;
    mode?: "easy" | "advanced" | undefined;
    language?: string | undefined;
    template_ref?: string | undefined;
    brand_preset_ref?: string | undefined;
    source_refs?: string[] | undefined;
    permission_scope?: {
        visibility: "private" | "workspace" | "tenant" | "shared_link";
        allow_read: boolean;
        allow_write: boolean;
        allow_share: boolean;
        allow_publish: boolean;
        allow_audit_view: boolean;
    } | undefined;
    timestamp?: string | undefined;
    mime_type?: string | undefined;
    parser_hint?: "docx" | "pdf" | "auto" | undefined;
}>;
declare const PublishDegradedReportOutputRequestSchema: z.ZodObject<{
    report_id: z.ZodString;
    actor_ref: z.ZodString;
    target_ref: z.ZodString;
    reason: z.ZodString;
    export_target: z.ZodDefault<z.ZodEnum<["docx", "pdf", "html"]>>;
    timestamp: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    report_id: string;
    actor_ref: string;
    target_ref: string;
    reason: string;
    export_target: "docx" | "pdf" | "html";
    timestamp?: string | undefined;
}, {
    report_id: string;
    actor_ref: string;
    target_ref: string;
    reason: string;
    timestamp?: string | undefined;
    export_target?: "docx" | "pdf" | "html" | undefined;
}>;
export type CreateReportRequest = z.input<typeof CreateReportRequestSchema>;
export type UpdateReportRequest = z.input<typeof UpdateReportRequestSchema>;
export type RefreshReportRequest = z.input<typeof RefreshReportRequestSchema>;
export type CompareReportsRequest = z.input<typeof CompareReportsRequestSchema>;
export type ReviewReportRequest = z.input<typeof ReviewReportRequestSchema>;
export type ApproveReportRequest = z.input<typeof ApproveReportRequestSchema>;
export type PublishReportRequest = z.input<typeof PublishReportRequestSchema>;
export type ScheduleReportRequest = z.input<typeof ScheduleReportRequestSchema>;
export type ListReportSchedulesRequest = z.input<typeof ListReportSchedulesRequestSchema>;
export type UpdateReportScheduleRequest = z.input<typeof UpdateReportScheduleRequestSchema>;
export type CancelReportScheduleRequest = z.input<typeof CancelReportScheduleRequestSchema>;
export type ResumeReportScheduleRequest = z.input<typeof ResumeReportScheduleRequestSchema>;
export type RunReportScheduleRequest = z.input<typeof RunReportScheduleRequestSchema>;
export type ExportReportRequest = z.input<typeof ExportReportRequestSchema>;
export type ConvertReportRequest = z.input<typeof ConvertReportRequestSchema>;
export type IngestExternalReportRequest = z.input<typeof IngestExternalReportRequestSchema>;
export type PublishDegradedReportOutputRequest = z.input<typeof PublishDegradedReportOutputRequestSchema>;
export type ReportEngineOptions = {
    storageDir?: string;
};
export type ReportWorkflowResult = PersistableReportState & StoredExecutionStage;
export type ReportCompareResult = {
    diff: ReportDiffMetadata;
    diffArtifact: Artifact;
} & StoredExecutionStage;
export type ReportExportResult = {
    sourceReport: PersistableReportState;
    exportArtifact: Artifact;
    fileName: string;
    contentType: string;
    payload: string | Uint8Array;
} & StoredExecutionStage;
export type ReportPublicationResult = {
    state: PersistableReportState;
    publication: Publication;
    libraryAsset: LibraryAsset | null;
    transport: ReportPublicationTransport | null;
} & StoredExecutionStage;
export type ReportScheduleResult = {
    state: PersistableReportState;
    schedule: SharedSchedule;
} & StoredExecutionStage;
export type ReportScheduleRunResult = {
    schedule: SharedSchedule;
    dispatch: ScheduledDispatchRecord;
    orchestration: ScheduledOrchestrationRecord;
    transportDeliveries: ReportTransportDeliveryRecord[];
    refreshResult: ReportWorkflowResult;
    publicationResult: ReportPublicationResult | null;
    degradedPublicationResult: ReportPublicationResult | null;
    runnerStage: StoredExecutionStage;
    state: PersistableReportState;
};
export type ReportScheduleListResult = {
    schedules: SharedSchedule[];
};
export type ReportConversionResult = {
    state: PersistableReportState;
    artifact: Artifact;
    payload: Record<string, unknown>;
    backSyncRecord?: ReportBackSyncRecord;
    backSyncStage?: StoredExecutionStage;
    nativePresentationBundle?: PresentationBundle;
    nativePresentationPublication?: PresentationPublicationResult;
    nativeDashboardWorkflow?: DashboardWorkflowResult;
    nativeDashboardPublication?: DashboardPublicationResult;
} & StoredExecutionStage;
export type ReportExternalIngestResult = {
    state: PersistableReportState;
    sourceArtifact: Artifact;
    ingestRecord: ExternalIngestRecord;
    payload: Record<string, unknown>;
} & StoredExecutionStage;
export type ReportPublicationTransport = {
    manifest_path: string;
    manifest_uri: string;
    publish_state_path: string;
    publish_state_uri: string;
    embed_payload_path: string | null;
    embed_payload_uri: string | null;
    embed_html_path: string | null;
    embed_html_uri: string | null;
    export_html_path: string;
    export_html_uri: string;
    outbox_path: string;
    outbox_uri: string;
    served_manifest_url: string;
    served_publish_state_url: string;
    served_embed_payload_url: string | null;
    served_embed_html_url: string | null;
    served_export_html_url: string;
    backend_publication_root: string;
    backend_publication_ref: string;
    backend_manifest_path: string;
    backend_manifest_uri: string;
    backend_access_state_path: string;
    backend_access_state_uri: string;
    backend_bundle_index_path: string;
    backend_bundle_index_uri: string;
    backend_delivery_state_path: string;
    backend_delivery_state_uri: string;
    gateway_bundle_root: string;
    gateway_bundle_ref: string;
    gateway_manifest_path: string;
    gateway_manifest_uri: string;
    gateway_consumable_ref: string;
    access_lifecycle_path: string;
    access_lifecycle_uri: string;
    delivery_receipt_path: string;
    delivery_receipt_uri: string;
    served_access_token: string;
    access_mode: "read_only" | "editable" | "shared";
    remote_bundle_ref?: string | null;
    remote_repository_ref?: string | null;
    remote_manifest_url?: string | null;
    remote_publish_state_url?: string | null;
    remote_embed_payload_url?: string | null;
    remote_embed_html_url?: string | null;
    remote_export_html_url?: string | null;
    remote_gateway_manifest_url?: string | null;
    remote_access_lifecycle_url?: string | null;
    remote_delivery_receipt_url?: string | null;
};
export type ReportRegressionSuiteResult = {
    runId: string;
    ingestedDocx: ReportExternalIngestResult;
    ingestedPdf: ReportExternalIngestResult;
    created: ReportWorkflowResult;
    updated: ReportWorkflowResult;
    refreshed: ReportWorkflowResult;
    compared: ReportCompareResult;
    reviewed: ReportWorkflowResult;
    approved: ReportWorkflowResult;
    exports: ReportExportResult[];
    presentationConversion: ReportConversionResult;
    presentationReconciledConversion: ReportConversionResult;
    dashboardConversion: ReportConversionResult;
    dashboardReconciledConversion: ReportConversionResult;
    published: ReportPublicationResult;
    scheduled: ReportScheduleResult;
    scheduledRuns: ReportScheduleRunResult[];
    degradedPublication: ReportPublicationResult;
};
declare const ReportDispatchRequestSchema: z.ZodObject<{
    action_id: z.ZodString;
    payload: z.ZodUnknown;
    storage_dir: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    action_id: string;
    payload?: unknown;
    storage_dir?: string | undefined;
}, {
    action_id: string;
    payload?: unknown;
    storage_dir?: string | undefined;
}>;
declare const ReportToolDispatchRequestSchema: z.ZodObject<{
    tool_id: z.ZodString;
    payload: z.ZodUnknown;
    storage_dir: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    tool_id: string;
    payload?: unknown;
    storage_dir?: string | undefined;
}, {
    tool_id: string;
    payload?: unknown;
    storage_dir?: string | undefined;
}>;
export type ReportDispatchRequest = z.infer<typeof ReportDispatchRequestSchema>;
export type ReportToolDispatchRequest = z.infer<typeof ReportToolDispatchRequestSchema>;
export type ReportPublicationServiceRegistration = {
    publication_id: string;
    report_id: string;
    backend_ref: string;
    gateway_bundle_ref: string | null;
    access_mode: "read_only" | "editable" | "shared";
    served_manifest_url: string;
    served_publish_state_url: string;
    served_embed_payload_url: string | null;
    served_embed_html_url: string | null;
    served_export_html_url: string;
};
export type ReportPublicationServiceStatus = {
    host: string;
    port: number;
    base_url: string;
    storage_dir: string;
    backend_root: string;
    publications: ReportPublicationServiceRegistration[];
};
declare const ImportFixtureProfileSchema: z.ZodEnum<["basic", "complex"]>;
type ReportImportFixture = {
    bytes: Uint8Array;
    metadata: Record<string, unknown>;
};
export declare const createSampleDocxFixture: (profile?: z.infer<typeof ImportFixtureProfileSchema>) => Promise<ReportImportFixture>;
export declare const createSamplePdfFixture: (profile?: z.infer<typeof ImportFixtureProfileSchema>) => ReportImportFixture;
export declare const createSampleDocx: (_title: string, _lines: string[]) => Promise<Uint8Array>;
export declare const createSamplePdf: (_lines: string[]) => Uint8Array;
export declare class ReportEngine {
    readonly store: ReportEngineStore;
    constructor(options?: ReportEngineOptions);
    private createPresentationEngine;
    private createDashboardEngine;
    private applyBackSyncSection;
    ingestExternalReport(input: IngestExternalReportRequest): Promise<ReportExternalIngestResult>;
    createReport(input: CreateReportRequest): ReportWorkflowResult;
    updateReport(input: UpdateReportRequest): ReportWorkflowResult;
    refreshReport(input: RefreshReportRequest): ReportWorkflowResult;
    compareReports(input: CompareReportsRequest): ReportCompareResult;
    reviewReport(input: ReviewReportRequest): ReportWorkflowResult;
    approveReport(input: ApproveReportRequest): ReportWorkflowResult;
    exportReport(input: ExportReportRequest): Promise<ReportExportResult>;
    exportReportDocx(input: Omit<ExportReportRequest, "target">): Promise<ReportExportResult>;
    exportReportPdf(input: Omit<ExportReportRequest, "target">): Promise<ReportExportResult>;
    exportReportHtml(input: Omit<ExportReportRequest, "target">): Promise<ReportExportResult>;
    convertReportToPresentation(input: ConvertReportRequest): Promise<ReportConversionResult>;
    convertReportToDashboard(input: ConvertReportRequest): Promise<ReportConversionResult>;
    publishReport(input: PublishReportRequest): Promise<ReportPublicationResult>;
    scheduleReport(input: ScheduleReportRequest): ReportScheduleResult;
    listReportSchedules(input?: ListReportSchedulesRequest): ReportScheduleListResult;
    updateReportSchedule(input: UpdateReportScheduleRequest): ReportScheduleResult;
    cancelReportSchedule(input: CancelReportScheduleRequest): ReportScheduleResult;
    resumeReportSchedule(input: ResumeReportScheduleRequest): ReportScheduleResult;
    runReportSchedule(input: RunReportScheduleRequest): Promise<ReportScheduleRunResult[]>;
    runDueSchedules(runAt?: string): Promise<ReportScheduleRunResult[]>;
    publishDegradedReportOutput(input: PublishDegradedReportOutputRequest): Promise<ReportPublicationResult>;
}
export declare const dispatchReportAction: (input: ReportDispatchRequest) => Promise<unknown>;
export declare const dispatchReportTool: (input: ReportToolDispatchRequest) => Promise<unknown>;
export declare const startReportPublicationService: (options?: ReportEngineOptions) => ReportPublicationServiceStatus;
export declare const registerReportCapability: (runtime: RegistryBootstrap) => void;
export declare const runReportRegressionSuite: () => Promise<ReportRegressionSuiteResult>;
export {};
