import { type Artifact, type AuditEvent, type CanonicalRepresentation, type EvidencePack, type Job, type LibraryAsset, type LineageEdge, type Publication, type Report, type ReportApprovalState, type ReportBindingSet, type ReportContentBlock, type ReportLayout, type ReportReviewState, type ReportSection, type ReportVersion, type SharedSchedule } from "@rasid/contracts";
import { z } from "zod";
export declare const PersistedReportStateSchema: z.ZodObject<{
    report: z.ZodObject<{
        contract: z.ZodObject<{
            namespace: z.ZodString;
            contract_name: z.ZodEnum<["canonical", "dashboard", "artifact", "job", "action", "excel", "tool_registry", "evidence", "audit", "library", "mode", "degrade", "strict", "localization", "template_brand", "permission", "source", "publication", "canvas", "report", "presentation", "schedule", "ai", "transcription"]>;
            contract_version: z.ZodString;
            schema_version: z.ZodString;
            status: z.ZodEnum<["draft", "active", "deprecated", "superseded"]>;
            owner_ref: z.ZodString;
            compatibility: z.ZodObject<{
                backward_compatible: z.ZodBoolean;
                forward_compatible: z.ZodBoolean;
            }, "strip", z.ZodTypeAny, {
                backward_compatible: boolean;
                forward_compatible: boolean;
            }, {
                backward_compatible: boolean;
                forward_compatible: boolean;
            }>;
            extension_policy: z.ZodObject<{
                namespaced_extensions_only: z.ZodBoolean;
                mandatory_field_override_forbidden: z.ZodBoolean;
            }, "strip", z.ZodTypeAny, {
                namespaced_extensions_only: boolean;
                mandatory_field_override_forbidden: boolean;
            }, {
                namespaced_extensions_only: boolean;
                mandatory_field_override_forbidden: boolean;
            }>;
        }, "strip", z.ZodTypeAny, {
            status: "draft" | "active" | "deprecated" | "superseded";
            namespace: string;
            contract_name: "canonical" | "dashboard" | "artifact" | "job" | "action" | "excel" | "tool_registry" | "evidence" | "audit" | "library" | "mode" | "degrade" | "strict" | "localization" | "template_brand" | "permission" | "source" | "publication" | "canvas" | "report" | "presentation" | "schedule" | "ai" | "transcription";
            contract_version: string;
            schema_version: string;
            owner_ref: string;
            compatibility: {
                backward_compatible: boolean;
                forward_compatible: boolean;
            };
            extension_policy: {
                namespaced_extensions_only: boolean;
                mandatory_field_override_forbidden: boolean;
            };
        }, {
            status: "draft" | "active" | "deprecated" | "superseded";
            namespace: string;
            contract_name: "canonical" | "dashboard" | "artifact" | "job" | "action" | "excel" | "tool_registry" | "evidence" | "audit" | "library" | "mode" | "degrade" | "strict" | "localization" | "template_brand" | "permission" | "source" | "publication" | "canvas" | "report" | "presentation" | "schedule" | "ai" | "transcription";
            contract_version: string;
            schema_version: string;
            owner_ref: string;
            compatibility: {
                backward_compatible: boolean;
                forward_compatible: boolean;
            };
            extension_policy: {
                namespaced_extensions_only: boolean;
                mandatory_field_override_forbidden: boolean;
            };
        }>;
        schema_namespace: z.ZodLiteral<"rasid.shared.report.v1">;
        schema_version: z.ZodLiteral<"1.0.0">;
        report_id: z.ZodString;
        artifact_ref: z.ZodString;
        canonical_ref: z.ZodString;
        current_version_ref: z.ZodString;
        report_type: z.ZodString;
        mode: z.ZodEnum<["easy", "advanced"]>;
        status: z.ZodEnum<["draft", "binding", "review", "approved", "published", "archived", "degraded"]>;
        template_ref: z.ZodString;
        brand_preset_ref: z.ZodString;
        binding_set_ref: z.ZodString;
        review_state_ref: z.ZodString;
        approval_state_ref: z.ZodString;
        layout_ref: z.ZodString;
        section_refs: z.ZodArray<z.ZodString, "many">;
        schedule_refs: z.ZodArray<z.ZodString, "many">;
        publication_refs: z.ZodArray<z.ZodString, "many">;
        owner_ref: z.ZodString;
        created_by: z.ZodString;
        created_at: z.ZodString;
        updated_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        mode: "easy" | "advanced";
        status: "draft" | "degraded" | "approved" | "binding" | "review" | "published" | "archived";
        schema_version: "1.0.0";
        owner_ref: string;
        contract: {
            status: "draft" | "active" | "deprecated" | "superseded";
            namespace: string;
            contract_name: "canonical" | "dashboard" | "artifact" | "job" | "action" | "excel" | "tool_registry" | "evidence" | "audit" | "library" | "mode" | "degrade" | "strict" | "localization" | "template_brand" | "permission" | "source" | "publication" | "canvas" | "report" | "presentation" | "schedule" | "ai" | "transcription";
            contract_version: string;
            schema_version: string;
            owner_ref: string;
            compatibility: {
                backward_compatible: boolean;
                forward_compatible: boolean;
            };
            extension_policy: {
                namespaced_extensions_only: boolean;
                mandatory_field_override_forbidden: boolean;
            };
        };
        schema_namespace: "rasid.shared.report.v1";
        artifact_ref: string;
        canonical_ref: string;
        created_by: string;
        created_at: string;
        updated_at: string;
        brand_preset_ref: string;
        template_ref: string;
        layout_ref: string;
        publication_refs: string[];
        binding_set_ref: string;
        current_version_ref: string;
        review_state_ref: string;
        approval_state_ref: string;
        section_refs: string[];
        report_id: string;
        report_type: string;
        schedule_refs: string[];
    }, {
        mode: "easy" | "advanced";
        status: "draft" | "degraded" | "approved" | "binding" | "review" | "published" | "archived";
        schema_version: "1.0.0";
        owner_ref: string;
        contract: {
            status: "draft" | "active" | "deprecated" | "superseded";
            namespace: string;
            contract_name: "canonical" | "dashboard" | "artifact" | "job" | "action" | "excel" | "tool_registry" | "evidence" | "audit" | "library" | "mode" | "degrade" | "strict" | "localization" | "template_brand" | "permission" | "source" | "publication" | "canvas" | "report" | "presentation" | "schedule" | "ai" | "transcription";
            contract_version: string;
            schema_version: string;
            owner_ref: string;
            compatibility: {
                backward_compatible: boolean;
                forward_compatible: boolean;
            };
            extension_policy: {
                namespaced_extensions_only: boolean;
                mandatory_field_override_forbidden: boolean;
            };
        };
        schema_namespace: "rasid.shared.report.v1";
        artifact_ref: string;
        canonical_ref: string;
        created_by: string;
        created_at: string;
        updated_at: string;
        brand_preset_ref: string;
        template_ref: string;
        layout_ref: string;
        publication_refs: string[];
        binding_set_ref: string;
        current_version_ref: string;
        review_state_ref: string;
        approval_state_ref: string;
        section_refs: string[];
        report_id: string;
        report_type: string;
        schedule_refs: string[];
    }>;
    version: z.ZodObject<{
        schema_namespace: z.ZodLiteral<"rasid.shared.report.v1">;
        schema_version: z.ZodLiteral<"1.0.0">;
    } & {
        report_version_id: z.ZodString;
        report_ref: z.ZodString;
        version_ref: z.ZodObject<{
            version_id: z.ZodString;
            parent_version_id: z.ZodNullable<z.ZodString>;
            version_number: z.ZodNumber;
            semantic_version: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            version_id: string;
            parent_version_id: string | null;
            version_number: number;
            semantic_version: string;
        }, {
            version_id: string;
            parent_version_id: string | null;
            version_number: number;
            semantic_version: string;
        }>;
        change_reason: z.ZodString;
        created_from: z.ZodEnum<["manual_edit", "dataset_refresh", "template_rebuild", "period_compare", "external_pattern_rebuild"]>;
        draft_state: z.ZodEnum<["draft", "ready_for_review", "changes_requested", "finalized"]>;
        review_state_ref: z.ZodString;
        approval_state_ref: z.ZodString;
        diff_base_version_ref: z.ZodNullable<z.ZodString>;
        section_refs: z.ZodArray<z.ZodString, "many">;
        layout_ref: z.ZodString;
        content_block_refs: z.ZodArray<z.ZodString, "many">;
        binding_set_ref: z.ZodString;
        created_by: z.ZodString;
        created_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        schema_version: "1.0.0";
        schema_namespace: "rasid.shared.report.v1";
        created_by: string;
        created_at: string;
        version_ref: {
            version_id: string;
            parent_version_id: string | null;
            version_number: number;
            semantic_version: string;
        };
        layout_ref: string;
        change_reason: string;
        created_from: "manual_edit" | "dataset_refresh" | "template_rebuild" | "period_compare" | "external_pattern_rebuild";
        binding_set_ref: string;
        report_ref: string;
        report_version_id: string;
        draft_state: "draft" | "ready_for_review" | "changes_requested" | "finalized";
        review_state_ref: string;
        approval_state_ref: string;
        diff_base_version_ref: string | null;
        section_refs: string[];
        content_block_refs: string[];
    }, {
        schema_version: "1.0.0";
        schema_namespace: "rasid.shared.report.v1";
        created_by: string;
        created_at: string;
        version_ref: {
            version_id: string;
            parent_version_id: string | null;
            version_number: number;
            semantic_version: string;
        };
        layout_ref: string;
        change_reason: string;
        created_from: "manual_edit" | "dataset_refresh" | "template_rebuild" | "period_compare" | "external_pattern_rebuild";
        binding_set_ref: string;
        report_ref: string;
        report_version_id: string;
        draft_state: "draft" | "ready_for_review" | "changes_requested" | "finalized";
        review_state_ref: string;
        approval_state_ref: string;
        diff_base_version_ref: string | null;
        section_refs: string[];
        content_block_refs: string[];
    }>;
    layout: z.ZodObject<{
        schema_namespace: z.ZodLiteral<"rasid.shared.report.v1">;
        schema_version: z.ZodLiteral<"1.0.0">;
    } & {
        layout_id: z.ZodString;
        report_ref: z.ZodString;
        version_ref: z.ZodString;
        template_ref: z.ZodString;
        brand_preset_ref: z.ZodString;
        page_size: z.ZodEnum<["a4", "a3", "letter", "legal", "custom"]>;
        orientation: z.ZodEnum<["portrait", "landscape"]>;
        page_margin_profile: z.ZodString;
        toc_enabled: z.ZodBoolean;
        appendix_enabled: z.ZodBoolean;
        region_refs: z.ZodArray<z.ZodString, "many">;
        regions: z.ZodArray<z.ZodObject<{
            schema_namespace: z.ZodLiteral<"rasid.shared.report.v1">;
            schema_version: z.ZodLiteral<"1.0.0">;
        } & {
            region_id: z.ZodString;
            region_name: z.ZodString;
            anchor_ref: z.ZodString;
            placement_rules: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">;
            lock_policy: z.ZodEnum<["editable", "soft_lock", "strict_lock"]>;
        }, "strip", z.ZodTypeAny, {
            schema_version: "1.0.0";
            schema_namespace: "rasid.shared.report.v1";
            region_id: string;
            region_name: string;
            anchor_ref: string;
            placement_rules: Record<string, unknown>[];
            lock_policy: "editable" | "soft_lock" | "strict_lock";
        }, {
            schema_version: "1.0.0";
            schema_namespace: "rasid.shared.report.v1";
            region_id: string;
            region_name: string;
            anchor_ref: string;
            placement_rules: Record<string, unknown>[];
            lock_policy: "editable" | "soft_lock" | "strict_lock";
        }>, "many">;
        layout_metadata: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">;
    }, "strip", z.ZodTypeAny, {
        schema_version: "1.0.0";
        schema_namespace: "rasid.shared.report.v1";
        brand_preset_ref: string;
        template_ref: string;
        version_ref: string;
        layout_id: string;
        report_ref: string;
        page_size: "custom" | "a4" | "a3" | "letter" | "legal";
        orientation: "portrait" | "landscape";
        page_margin_profile: string;
        toc_enabled: boolean;
        appendix_enabled: boolean;
        region_refs: string[];
        regions: {
            schema_version: "1.0.0";
            schema_namespace: "rasid.shared.report.v1";
            region_id: string;
            region_name: string;
            anchor_ref: string;
            placement_rules: Record<string, unknown>[];
            lock_policy: "editable" | "soft_lock" | "strict_lock";
        }[];
        layout_metadata: Record<string, unknown>[];
    }, {
        schema_version: "1.0.0";
        schema_namespace: "rasid.shared.report.v1";
        brand_preset_ref: string;
        template_ref: string;
        version_ref: string;
        layout_id: string;
        report_ref: string;
        page_size: "custom" | "a4" | "a3" | "letter" | "legal";
        orientation: "portrait" | "landscape";
        page_margin_profile: string;
        toc_enabled: boolean;
        appendix_enabled: boolean;
        region_refs: string[];
        regions: {
            schema_version: "1.0.0";
            schema_namespace: "rasid.shared.report.v1";
            region_id: string;
            region_name: string;
            anchor_ref: string;
            placement_rules: Record<string, unknown>[];
            lock_policy: "editable" | "soft_lock" | "strict_lock";
        }[];
        layout_metadata: Record<string, unknown>[];
    }>;
    sections: z.ZodArray<z.ZodObject<{
        schema_namespace: z.ZodLiteral<"rasid.shared.report.v1">;
        schema_version: z.ZodLiteral<"1.0.0">;
    } & {
        section_id: z.ZodString;
        report_ref: z.ZodString;
        version_ref: z.ZodString;
        parent_section_ref: z.ZodNullable<z.ZodString>;
        section_kind: z.ZodEnum<["cover", "executive_summary", "table_of_contents", "body", "appendix", "footnotes"]>;
        title: z.ZodArray<z.ZodObject<{
            value: z.ZodString;
            locale: z.ZodString;
            rtl: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            value: string;
            locale: string;
            rtl: boolean;
        }, {
            value: string;
            locale: string;
            rtl: boolean;
        }>, "many">;
        order_index: z.ZodNumber;
        block_refs: z.ZodArray<z.ZodString, "many">;
        child_section_refs: z.ZodArray<z.ZodString, "many">;
        layout_ref: z.ZodString;
        page_anchor_ref: z.ZodNullable<z.ZodString>;
        citation_refs: z.ZodArray<z.ZodString, "many">;
        visibility_state: z.ZodEnum<["visible", "hidden"]>;
        lock_policy: z.ZodEnum<["editable", "soft_lock", "strict_lock"]>;
    }, "strip", z.ZodTypeAny, {
        schema_version: "1.0.0";
        schema_namespace: "rasid.shared.report.v1";
        section_id: string;
        title: {
            value: string;
            locale: string;
            rtl: boolean;
        }[];
        section_kind: "cover" | "body" | "appendix" | "executive_summary" | "table_of_contents" | "footnotes";
        order_index: number;
        version_ref: string;
        layout_ref: string;
        lock_policy: "editable" | "soft_lock" | "strict_lock";
        report_ref: string;
        citation_refs: string[];
        parent_section_ref: string | null;
        block_refs: string[];
        child_section_refs: string[];
        page_anchor_ref: string | null;
        visibility_state: "visible" | "hidden";
    }, {
        schema_version: "1.0.0";
        schema_namespace: "rasid.shared.report.v1";
        section_id: string;
        title: {
            value: string;
            locale: string;
            rtl: boolean;
        }[];
        section_kind: "cover" | "body" | "appendix" | "executive_summary" | "table_of_contents" | "footnotes";
        order_index: number;
        version_ref: string;
        layout_ref: string;
        lock_policy: "editable" | "soft_lock" | "strict_lock";
        report_ref: string;
        citation_refs: string[];
        parent_section_ref: string | null;
        block_refs: string[];
        child_section_refs: string[];
        page_anchor_ref: string | null;
        visibility_state: "visible" | "hidden";
    }>, "many">;
    content_blocks: z.ZodArray<z.ZodObject<{
        schema_namespace: z.ZodLiteral<"rasid.shared.report.v1">;
        schema_version: z.ZodLiteral<"1.0.0">;
    } & {
        block_id: z.ZodString;
        report_ref: z.ZodString;
        version_ref: z.ZodString;
        section_ref: z.ZodString;
        block_type: z.ZodEnum<["cover", "executive_summary", "narrative", "table", "chart", "metric_card", "commentary", "infographic_plan", "appendix", "toc"]>;
        order_index: z.ZodNumber;
        title: z.ZodArray<z.ZodObject<{
            value: z.ZodString;
            locale: z.ZodString;
            rtl: z.ZodBoolean;
        }, "strip", z.ZodTypeAny, {
            value: string;
            locale: string;
            rtl: boolean;
        }, {
            value: string;
            locale: string;
            rtl: boolean;
        }>, "many">;
        canonical_node_ref: z.ZodNullable<z.ZodString>;
        binding_refs: z.ZodArray<z.ZodString, "many">;
        citation_refs: z.ZodArray<z.ZodString, "many">;
        lineage_refs: z.ZodArray<z.ZodString, "many">;
        content_payload: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        editability: z.ZodEnum<["editable", "template_locked", "approval_locked"]>;
        generated_by: z.ZodEnum<["manual", "template", "ai_assisted", "data_bound"]>;
    }, "strip", z.ZodTypeAny, {
        schema_version: "1.0.0";
        schema_namespace: "rasid.shared.report.v1";
        title: {
            value: string;
            locale: string;
            rtl: boolean;
        }[];
        order_index: number;
        section_ref: string;
        lineage_refs: string[];
        binding_refs: string[];
        editability: "editable" | "template_locked" | "approval_locked";
        version_ref: string;
        canonical_node_ref: string | null;
        generated_by: "manual" | "template" | "ai_assisted" | "data_bound";
        report_ref: string;
        block_id: string;
        block_type: "table" | "cover" | "appendix" | "chart" | "metric_card" | "executive_summary" | "narrative" | "commentary" | "infographic_plan" | "toc";
        citation_refs: string[];
        content_payload: Record<string, unknown>;
    }, {
        schema_version: "1.0.0";
        schema_namespace: "rasid.shared.report.v1";
        title: {
            value: string;
            locale: string;
            rtl: boolean;
        }[];
        order_index: number;
        section_ref: string;
        lineage_refs: string[];
        binding_refs: string[];
        editability: "editable" | "template_locked" | "approval_locked";
        version_ref: string;
        canonical_node_ref: string | null;
        generated_by: "manual" | "template" | "ai_assisted" | "data_bound";
        report_ref: string;
        block_id: string;
        block_type: "table" | "cover" | "appendix" | "chart" | "metric_card" | "executive_summary" | "narrative" | "commentary" | "infographic_plan" | "toc";
        citation_refs: string[];
        content_payload: Record<string, unknown>;
    }>, "many">;
    binding_set: z.ZodObject<{
        schema_namespace: z.ZodLiteral<"rasid.shared.report.v1">;
        schema_version: z.ZodLiteral<"1.0.0">;
    } & {
        binding_set_id: z.ZodString;
        report_ref: z.ZodString;
        version_ref: z.ZodString;
        source_artifact_refs: z.ZodArray<z.ZodString, "many">;
        dataset_binding_refs: z.ZodArray<z.ZodString, "many">;
        bindings: z.ZodArray<z.ZodObject<{
            schema_namespace: z.ZodLiteral<"rasid.shared.report.v1">;
            schema_version: z.ZodLiteral<"1.0.0">;
        } & {
            binding_id: z.ZodString;
            dataset_ref: z.ZodString;
            query_ref: z.ZodString;
            target_node_ref: z.ZodString;
            target_block_ref: z.ZodString;
            field_mappings: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">;
            snapshot_version_ref: z.ZodNullable<z.ZodString>;
            last_refresh_at: z.ZodNullable<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            schema_version: "1.0.0";
            schema_namespace: "rasid.shared.report.v1";
            snapshot_version_ref: string | null;
            binding_id: string;
            target_block_ref: string;
            target_node_ref: string;
            dataset_ref: string;
            query_ref: string;
            field_mappings: Record<string, unknown>[];
            last_refresh_at: string | null;
        }, {
            schema_version: "1.0.0";
            schema_namespace: "rasid.shared.report.v1";
            snapshot_version_ref: string | null;
            binding_id: string;
            target_block_ref: string;
            target_node_ref: string;
            dataset_ref: string;
            query_ref: string;
            field_mappings: Record<string, unknown>[];
            last_refresh_at: string | null;
        }>, "many">;
        staleness_status: z.ZodEnum<["live", "partially_live", "snapshot", "stale", "broken"]>;
        refresh_policy: z.ZodObject<{
            refresh_mode: z.ZodEnum<["manual", "scheduled", "event_driven"]>;
            selective_regeneration_enabled: z.ZodBoolean;
            stale_after_minutes: z.ZodNullable<z.ZodNumber>;
        }, "strip", z.ZodTypeAny, {
            refresh_mode: "manual" | "scheduled" | "event_driven";
            selective_regeneration_enabled: boolean;
            stale_after_minutes: number | null;
        }, {
            refresh_mode: "manual" | "scheduled" | "event_driven";
            selective_regeneration_enabled: boolean;
            stale_after_minutes: number | null;
        }>;
        selective_regeneration_refs: z.ZodArray<z.ZodString, "many">;
        broken_binding_refs: z.ZodArray<z.ZodString, "many">;
        last_refresh_at: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        schema_version: "1.0.0";
        schema_namespace: "rasid.shared.report.v1";
        bindings: {
            schema_version: "1.0.0";
            schema_namespace: "rasid.shared.report.v1";
            snapshot_version_ref: string | null;
            binding_id: string;
            target_block_ref: string;
            target_node_ref: string;
            dataset_ref: string;
            query_ref: string;
            field_mappings: Record<string, unknown>[];
            last_refresh_at: string | null;
        }[];
        version_ref: string;
        last_refresh_at: string | null;
        source_artifact_refs: string[];
        dataset_binding_refs: string[];
        staleness_status: "broken" | "live" | "partially_live" | "snapshot" | "stale";
        refresh_policy: {
            refresh_mode: "manual" | "scheduled" | "event_driven";
            selective_regeneration_enabled: boolean;
            stale_after_minutes: number | null;
        };
        selective_regeneration_refs: string[];
        broken_binding_refs: string[];
        report_ref: string;
        binding_set_id: string;
    }, {
        schema_version: "1.0.0";
        schema_namespace: "rasid.shared.report.v1";
        bindings: {
            schema_version: "1.0.0";
            schema_namespace: "rasid.shared.report.v1";
            snapshot_version_ref: string | null;
            binding_id: string;
            target_block_ref: string;
            target_node_ref: string;
            dataset_ref: string;
            query_ref: string;
            field_mappings: Record<string, unknown>[];
            last_refresh_at: string | null;
        }[];
        version_ref: string;
        last_refresh_at: string | null;
        source_artifact_refs: string[];
        dataset_binding_refs: string[];
        staleness_status: "broken" | "live" | "partially_live" | "snapshot" | "stale";
        refresh_policy: {
            refresh_mode: "manual" | "scheduled" | "event_driven";
            selective_regeneration_enabled: boolean;
            stale_after_minutes: number | null;
        };
        selective_regeneration_refs: string[];
        broken_binding_refs: string[];
        report_ref: string;
        binding_set_id: string;
    }>;
    review_state: z.ZodObject<{
        schema_namespace: z.ZodLiteral<"rasid.shared.report.v1">;
        schema_version: z.ZodLiteral<"1.0.0">;
    } & {
        review_state_id: z.ZodString;
        report_ref: z.ZodString;
        version_ref: z.ZodString;
        state: z.ZodEnum<["draft", "in_review", "changes_requested", "reviewed"]>;
        reviewer_refs: z.ZodArray<z.ZodString, "many">;
        review_comment_refs: z.ZodArray<z.ZodString, "many">;
        latest_comment: z.ZodNullable<z.ZodString>;
        last_reviewed_at: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        schema_version: "1.0.0";
        schema_namespace: "rasid.shared.report.v1";
        state: "draft" | "changes_requested" | "in_review" | "reviewed";
        version_ref: string;
        report_ref: string;
        review_state_id: string;
        reviewer_refs: string[];
        review_comment_refs: string[];
        latest_comment: string | null;
        last_reviewed_at: string | null;
    }, {
        schema_version: "1.0.0";
        schema_namespace: "rasid.shared.report.v1";
        state: "draft" | "changes_requested" | "in_review" | "reviewed";
        version_ref: string;
        report_ref: string;
        review_state_id: string;
        reviewer_refs: string[];
        review_comment_refs: string[];
        latest_comment: string | null;
        last_reviewed_at: string | null;
    }>;
    approval_state: z.ZodObject<{
        schema_namespace: z.ZodLiteral<"rasid.shared.report.v1">;
        schema_version: z.ZodLiteral<"1.0.0">;
    } & {
        approval_state_id: z.ZodString;
        report_ref: z.ZodString;
        version_ref: z.ZodString;
        state: z.ZodEnum<["not_required", "pending", "approved", "rejected"]>;
        approver_ref: z.ZodNullable<z.ZodString>;
        decision_comment: z.ZodNullable<z.ZodString>;
        decided_at: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        schema_version: "1.0.0";
        schema_namespace: "rasid.shared.report.v1";
        state: "not_required" | "pending" | "approved" | "rejected";
        version_ref: string;
        report_ref: string;
        approval_state_id: string;
        approver_ref: string | null;
        decision_comment: string | null;
        decided_at: string | null;
    }, {
        schema_version: "1.0.0";
        schema_namespace: "rasid.shared.report.v1";
        state: "not_required" | "pending" | "approved" | "rejected";
        version_ref: string;
        report_ref: string;
        approval_state_id: string;
        approver_ref: string | null;
        decision_comment: string | null;
        decided_at: string | null;
    }>;
    canonical: z.ZodObject<{
        contract: z.ZodObject<{
            namespace: z.ZodString;
            contract_name: z.ZodEnum<["canonical", "dashboard", "artifact", "job", "action", "excel", "tool_registry", "evidence", "audit", "library", "mode", "degrade", "strict", "localization", "template_brand", "permission", "source", "publication", "canvas", "report", "presentation", "schedule", "ai", "transcription"]>;
            contract_version: z.ZodString;
            schema_version: z.ZodString;
            status: z.ZodEnum<["draft", "active", "deprecated", "superseded"]>;
            owner_ref: z.ZodString;
            compatibility: z.ZodObject<{
                backward_compatible: z.ZodBoolean;
                forward_compatible: z.ZodBoolean;
            }, "strip", z.ZodTypeAny, {
                backward_compatible: boolean;
                forward_compatible: boolean;
            }, {
                backward_compatible: boolean;
                forward_compatible: boolean;
            }>;
            extension_policy: z.ZodObject<{
                namespaced_extensions_only: z.ZodBoolean;
                mandatory_field_override_forbidden: z.ZodBoolean;
            }, "strip", z.ZodTypeAny, {
                namespaced_extensions_only: boolean;
                mandatory_field_override_forbidden: boolean;
            }, {
                namespaced_extensions_only: boolean;
                mandatory_field_override_forbidden: boolean;
            }>;
        }, "strip", z.ZodTypeAny, {
            status: "draft" | "active" | "deprecated" | "superseded";
            namespace: string;
            contract_name: "canonical" | "dashboard" | "artifact" | "job" | "action" | "excel" | "tool_registry" | "evidence" | "audit" | "library" | "mode" | "degrade" | "strict" | "localization" | "template_brand" | "permission" | "source" | "publication" | "canvas" | "report" | "presentation" | "schedule" | "ai" | "transcription";
            contract_version: string;
            schema_version: string;
            owner_ref: string;
            compatibility: {
                backward_compatible: boolean;
                forward_compatible: boolean;
            };
            extension_policy: {
                namespaced_extensions_only: boolean;
                mandatory_field_override_forbidden: boolean;
            };
        }, {
            status: "draft" | "active" | "deprecated" | "superseded";
            namespace: string;
            contract_name: "canonical" | "dashboard" | "artifact" | "job" | "action" | "excel" | "tool_registry" | "evidence" | "audit" | "library" | "mode" | "degrade" | "strict" | "localization" | "template_brand" | "permission" | "source" | "publication" | "canvas" | "report" | "presentation" | "schedule" | "ai" | "transcription";
            contract_version: string;
            schema_version: string;
            owner_ref: string;
            compatibility: {
                backward_compatible: boolean;
                forward_compatible: boolean;
            };
            extension_policy: {
                namespaced_extensions_only: boolean;
                mandatory_field_override_forbidden: boolean;
            };
        }>;
        canonical_id: z.ZodString;
        tenant_ref: z.ZodString;
        workspace_id: z.ZodString;
        project_id: z.ZodString;
        source_descriptors: z.ZodArray<z.ZodObject<{
            source_ref: z.ZodString;
            source_type: z.ZodString;
            source_revision_ref: z.ZodString;
            parser_profile: z.ZodString;
            connector_ref: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            source_ref: string;
            source_type: string;
            connector_ref: string;
            source_revision_ref: string;
            parser_profile: string;
        }, {
            source_ref: string;
            source_type: string;
            connector_ref: string;
            source_revision_ref: string;
            parser_profile: string;
        }>, "many">;
        representation_kind: z.ZodEnum<["document", "spreadsheet", "presentation", "dashboard", "report", "multimodal_content", "intermediate_converted_artifact"]>;
        strictness_mode: z.ZodEnum<["strict", "smart", "flex"]>;
        localization: z.ZodObject<{
            locale: z.ZodString;
            rtl: z.ZodBoolean;
            numeral_system: z.ZodString;
            fallback_locales: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            locale: string;
            rtl: boolean;
            numeral_system: string;
            fallback_locales: string[];
        }, {
            locale: string;
            rtl: boolean;
            numeral_system: string;
            fallback_locales: string[];
        }>;
        root_node_refs: z.ZodArray<z.ZodString, "many">;
        nodes: z.ZodObject<{
            documents: z.ZodArray<z.ZodObject<{
                node_id: z.ZodString;
                parent_node_ref: z.ZodNullable<z.ZodString>;
                child_node_refs: z.ZodArray<z.ZodString, "many">;
                name: z.ZodString;
                semantic_labels: z.ZodArray<z.ZodString, "many">;
                layout_ref: z.ZodString;
                data_binding_refs: z.ZodArray<z.ZodString, "many">;
                formula_refs: z.ZodArray<z.ZodString, "many">;
                lineage_refs: z.ZodArray<z.ZodString, "many">;
                template_refs: z.ZodArray<z.ZodString, "many">;
                evidence_refs: z.ZodArray<z.ZodString, "many">;
                editable: z.ZodBoolean;
            } & {
                node_type: z.ZodLiteral<"document">;
                page_refs: z.ZodArray<z.ZodString, "many">;
                section_refs: z.ZodArray<z.ZodString, "many">;
            }, "strip", z.ZodTypeAny, {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "document";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                section_refs: string[];
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                page_refs: string[];
            }, {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "document";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                section_refs: string[];
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                page_refs: string[];
            }>, "many">;
            pages: z.ZodArray<z.ZodObject<{
                node_id: z.ZodString;
                parent_node_ref: z.ZodNullable<z.ZodString>;
                child_node_refs: z.ZodArray<z.ZodString, "many">;
                name: z.ZodString;
                semantic_labels: z.ZodArray<z.ZodString, "many">;
                layout_ref: z.ZodString;
                data_binding_refs: z.ZodArray<z.ZodString, "many">;
                formula_refs: z.ZodArray<z.ZodString, "many">;
                lineage_refs: z.ZodArray<z.ZodString, "many">;
                template_refs: z.ZodArray<z.ZodString, "many">;
                evidence_refs: z.ZodArray<z.ZodString, "many">;
                editable: z.ZodBoolean;
            } & {
                node_type: z.ZodLiteral<"page">;
                width: z.ZodNumber;
                height: z.ZodNumber;
                unit: z.ZodString;
                layer_refs: z.ZodArray<z.ZodString, "many">;
            }, "strip", z.ZodTypeAny, {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "page";
                lineage_refs: string[];
                width: number;
                height: number;
                unit: string;
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                layer_refs: string[];
            }, {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "page";
                lineage_refs: string[];
                width: number;
                height: number;
                unit: string;
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                layer_refs: string[];
            }>, "many">;
            sheets: z.ZodArray<z.ZodObject<{
                node_id: z.ZodString;
                parent_node_ref: z.ZodNullable<z.ZodString>;
                child_node_refs: z.ZodArray<z.ZodString, "many">;
                name: z.ZodString;
                semantic_labels: z.ZodArray<z.ZodString, "many">;
                layout_ref: z.ZodString;
                data_binding_refs: z.ZodArray<z.ZodString, "many">;
                formula_refs: z.ZodArray<z.ZodString, "many">;
                lineage_refs: z.ZodArray<z.ZodString, "many">;
                template_refs: z.ZodArray<z.ZodString, "many">;
                evidence_refs: z.ZodArray<z.ZodString, "many">;
                editable: z.ZodBoolean;
            } & {
                node_type: z.ZodLiteral<"sheet">;
                table_refs: z.ZodArray<z.ZodString, "many">;
                chart_refs: z.ZodArray<z.ZodString, "many">;
                grid_bounds: z.ZodObject<{
                    row_count: z.ZodNumber;
                    column_count: z.ZodNumber;
                }, "strip", z.ZodTypeAny, {
                    row_count: number;
                    column_count: number;
                }, {
                    row_count: number;
                    column_count: number;
                }>;
            }, "strip", z.ZodTypeAny, {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "sheet";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                table_refs: string[];
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                chart_refs: string[];
                grid_bounds: {
                    row_count: number;
                    column_count: number;
                };
            }, {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "sheet";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                table_refs: string[];
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                chart_refs: string[];
                grid_bounds: {
                    row_count: number;
                    column_count: number;
                };
            }>, "many">;
            slides: z.ZodArray<z.ZodObject<{
                node_id: z.ZodString;
                parent_node_ref: z.ZodNullable<z.ZodString>;
                child_node_refs: z.ZodArray<z.ZodString, "many">;
                name: z.ZodString;
                semantic_labels: z.ZodArray<z.ZodString, "many">;
                layout_ref: z.ZodString;
                data_binding_refs: z.ZodArray<z.ZodString, "many">;
                formula_refs: z.ZodArray<z.ZodString, "many">;
                lineage_refs: z.ZodArray<z.ZodString, "many">;
                template_refs: z.ZodArray<z.ZodString, "many">;
                evidence_refs: z.ZodArray<z.ZodString, "many">;
                editable: z.ZodBoolean;
            } & {
                node_type: z.ZodLiteral<"slide">;
                slide_index: z.ZodNumber;
                master_ref: z.ZodString;
                element_refs: z.ZodArray<z.ZodString, "many">;
            }, "strip", z.ZodTypeAny, {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "slide";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                slide_index: number;
                master_ref: string;
                element_refs: string[];
            }, {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "slide";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                slide_index: number;
                master_ref: string;
                element_refs: string[];
            }>, "many">;
            tables: z.ZodArray<z.ZodObject<{
                node_id: z.ZodString;
                parent_node_ref: z.ZodNullable<z.ZodString>;
                child_node_refs: z.ZodArray<z.ZodString, "many">;
                name: z.ZodString;
                semantic_labels: z.ZodArray<z.ZodString, "many">;
                layout_ref: z.ZodString;
                data_binding_refs: z.ZodArray<z.ZodString, "many">;
                formula_refs: z.ZodArray<z.ZodString, "many">;
                lineage_refs: z.ZodArray<z.ZodString, "many">;
                template_refs: z.ZodArray<z.ZodString, "many">;
                evidence_refs: z.ZodArray<z.ZodString, "many">;
                editable: z.ZodBoolean;
            } & {
                node_type: z.ZodLiteral<"table">;
                row_count: z.ZodNumber;
                column_count: z.ZodNumber;
                schema_ref: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                editable: boolean;
                row_count: number;
                column_count: number;
                evidence_refs: string[];
                node_id: string;
                node_type: "table";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                schema_ref: string;
            }, {
                editable: boolean;
                row_count: number;
                column_count: number;
                evidence_refs: string[];
                node_id: string;
                node_type: "table";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                schema_ref: string;
            }>, "many">;
            charts: z.ZodArray<z.ZodObject<{
                node_id: z.ZodString;
                parent_node_ref: z.ZodNullable<z.ZodString>;
                child_node_refs: z.ZodArray<z.ZodString, "many">;
                name: z.ZodString;
                semantic_labels: z.ZodArray<z.ZodString, "many">;
                layout_ref: z.ZodString;
                data_binding_refs: z.ZodArray<z.ZodString, "many">;
                formula_refs: z.ZodArray<z.ZodString, "many">;
                lineage_refs: z.ZodArray<z.ZodString, "many">;
                template_refs: z.ZodArray<z.ZodString, "many">;
                evidence_refs: z.ZodArray<z.ZodString, "many">;
                editable: z.ZodBoolean;
            } & {
                node_type: z.ZodLiteral<"chart">;
                chart_type: z.ZodString;
                series_refs: z.ZodArray<z.ZodString, "many">;
                axis_refs: z.ZodArray<z.ZodString, "many">;
            }, "strip", z.ZodTypeAny, {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "chart";
                lineage_refs: string[];
                formula_refs: string[];
                chart_type: string;
                series_refs: string[];
                axis_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
            }, {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "chart";
                lineage_refs: string[];
                formula_refs: string[];
                chart_type: string;
                series_refs: string[];
                axis_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
            }>, "many">;
            shapes: z.ZodArray<z.ZodObject<{
                node_id: z.ZodString;
                parent_node_ref: z.ZodNullable<z.ZodString>;
                child_node_refs: z.ZodArray<z.ZodString, "many">;
                name: z.ZodString;
                semantic_labels: z.ZodArray<z.ZodString, "many">;
                layout_ref: z.ZodString;
                data_binding_refs: z.ZodArray<z.ZodString, "many">;
                formula_refs: z.ZodArray<z.ZodString, "many">;
                lineage_refs: z.ZodArray<z.ZodString, "many">;
                template_refs: z.ZodArray<z.ZodString, "many">;
                evidence_refs: z.ZodArray<z.ZodString, "many">;
                editable: z.ZodBoolean;
            } & {
                node_type: z.ZodLiteral<"shape">;
                shape_type: z.ZodString;
                style_ref: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "shape";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                style_ref: string;
                data_binding_refs: string[];
                template_refs: string[];
                shape_type: string;
            }, {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "shape";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                style_ref: string;
                data_binding_refs: string[];
                template_refs: string[];
                shape_type: string;
            }>, "many">;
            text: z.ZodArray<z.ZodObject<{
                node_id: z.ZodString;
                parent_node_ref: z.ZodNullable<z.ZodString>;
                child_node_refs: z.ZodArray<z.ZodString, "many">;
                name: z.ZodString;
                semantic_labels: z.ZodArray<z.ZodString, "many">;
                layout_ref: z.ZodString;
                data_binding_refs: z.ZodArray<z.ZodString, "many">;
                formula_refs: z.ZodArray<z.ZodString, "many">;
                lineage_refs: z.ZodArray<z.ZodString, "many">;
                template_refs: z.ZodArray<z.ZodString, "many">;
                evidence_refs: z.ZodArray<z.ZodString, "many">;
                editable: z.ZodBoolean;
            } & {
                node_type: z.ZodLiteral<"text">;
                content: z.ZodArray<z.ZodObject<{
                    value: z.ZodString;
                    locale: z.ZodString;
                    rtl: z.ZodBoolean;
                }, "strip", z.ZodTypeAny, {
                    value: string;
                    locale: string;
                    rtl: boolean;
                }, {
                    value: string;
                    locale: string;
                    rtl: boolean;
                }>, "many">;
                typography_ref: z.ZodString;
            }, "strip", z.ZodTypeAny, {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "text";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                content: {
                    value: string;
                    locale: string;
                    rtl: boolean;
                }[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                typography_ref: string;
            }, {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "text";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                content: {
                    value: string;
                    locale: string;
                    rtl: boolean;
                }[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                typography_ref: string;
            }>, "many">;
            images: z.ZodArray<z.ZodObject<{
                node_id: z.ZodString;
                parent_node_ref: z.ZodNullable<z.ZodString>;
                child_node_refs: z.ZodArray<z.ZodString, "many">;
                name: z.ZodString;
                semantic_labels: z.ZodArray<z.ZodString, "many">;
                layout_ref: z.ZodString;
                data_binding_refs: z.ZodArray<z.ZodString, "many">;
                formula_refs: z.ZodArray<z.ZodString, "many">;
                lineage_refs: z.ZodArray<z.ZodString, "many">;
                template_refs: z.ZodArray<z.ZodString, "many">;
                evidence_refs: z.ZodArray<z.ZodString, "many">;
                editable: z.ZodBoolean;
            } & {
                node_type: z.ZodLiteral<"image">;
                image_asset_ref: z.ZodString;
                crop_metadata: z.ZodRecord<z.ZodString, z.ZodUnknown>;
            }, "strip", z.ZodTypeAny, {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "image";
                lineage_refs: string[];
                image_asset_ref: string;
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                crop_metadata: Record<string, unknown>;
            }, {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "image";
                lineage_refs: string[];
                image_asset_ref: string;
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                crop_metadata: Record<string, unknown>;
            }>, "many">;
        }, "strip", z.ZodTypeAny, {
            text: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "text";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                content: {
                    value: string;
                    locale: string;
                    rtl: boolean;
                }[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                typography_ref: string;
            }[];
            tables: {
                editable: boolean;
                row_count: number;
                column_count: number;
                evidence_refs: string[];
                node_id: string;
                node_type: "table";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                schema_ref: string;
            }[];
            pages: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "page";
                lineage_refs: string[];
                width: number;
                height: number;
                unit: string;
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                layer_refs: string[];
            }[];
            documents: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "document";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                section_refs: string[];
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                page_refs: string[];
            }[];
            sheets: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "sheet";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                table_refs: string[];
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                chart_refs: string[];
                grid_bounds: {
                    row_count: number;
                    column_count: number;
                };
            }[];
            slides: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "slide";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                slide_index: number;
                master_ref: string;
                element_refs: string[];
            }[];
            charts: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "chart";
                lineage_refs: string[];
                formula_refs: string[];
                chart_type: string;
                series_refs: string[];
                axis_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
            }[];
            shapes: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "shape";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                style_ref: string;
                data_binding_refs: string[];
                template_refs: string[];
                shape_type: string;
            }[];
            images: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "image";
                lineage_refs: string[];
                image_asset_ref: string;
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                crop_metadata: Record<string, unknown>;
            }[];
        }, {
            text: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "text";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                content: {
                    value: string;
                    locale: string;
                    rtl: boolean;
                }[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                typography_ref: string;
            }[];
            tables: {
                editable: boolean;
                row_count: number;
                column_count: number;
                evidence_refs: string[];
                node_id: string;
                node_type: "table";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                schema_ref: string;
            }[];
            pages: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "page";
                lineage_refs: string[];
                width: number;
                height: number;
                unit: string;
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                layer_refs: string[];
            }[];
            documents: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "document";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                section_refs: string[];
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                page_refs: string[];
            }[];
            sheets: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "sheet";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                table_refs: string[];
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                chart_refs: string[];
                grid_bounds: {
                    row_count: number;
                    column_count: number;
                };
            }[];
            slides: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "slide";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                slide_index: number;
                master_ref: string;
                element_refs: string[];
            }[];
            charts: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "chart";
                lineage_refs: string[];
                formula_refs: string[];
                chart_type: string;
                series_refs: string[];
                axis_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
            }[];
            shapes: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "shape";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                style_ref: string;
                data_binding_refs: string[];
                template_refs: string[];
                shape_type: string;
            }[];
            images: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "image";
                lineage_refs: string[];
                image_asset_ref: string;
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                crop_metadata: Record<string, unknown>;
            }[];
        }>;
        layout_metadata: z.ZodObject<{
            coordinate_space: z.ZodEnum<["page", "sheet", "slide", "canvas"]>;
            bounding_boxes: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">;
            z_order: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">;
            grid_rules: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">;
            alignment_rules: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">;
        }, "strip", z.ZodTypeAny, {
            coordinate_space: "canvas" | "page" | "sheet" | "slide";
            bounding_boxes: Record<string, unknown>[];
            z_order: Record<string, unknown>[];
            grid_rules: Record<string, unknown>[];
            alignment_rules: Record<string, unknown>[];
        }, {
            coordinate_space: "canvas" | "page" | "sheet" | "slide";
            bounding_boxes: Record<string, unknown>[];
            z_order: Record<string, unknown>[];
            grid_rules: Record<string, unknown>[];
            alignment_rules: Record<string, unknown>[];
        }>;
        data_binding_refs: z.ZodArray<z.ZodObject<{
            binding_id: z.ZodString;
            dataset_ref: z.ZodString;
            query_ref: z.ZodString;
            target_node_ref: z.ZodString;
            field_mappings: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">;
        }, "strip", z.ZodTypeAny, {
            binding_id: string;
            target_node_ref: string;
            dataset_ref: string;
            query_ref: string;
            field_mappings: Record<string, unknown>[];
        }, {
            binding_id: string;
            target_node_ref: string;
            dataset_ref: string;
            query_ref: string;
            field_mappings: Record<string, unknown>[];
        }>, "many">;
        formula_refs: z.ZodArray<z.ZodObject<{
            formula_id: z.ZodString;
            expression: z.ZodString;
            dialect: z.ZodString;
            target_ref: z.ZodString;
            dependency_refs: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            target_ref: string;
            dependency_refs: string[];
            formula_id: string;
            expression: string;
            dialect: string;
        }, {
            target_ref: string;
            dependency_refs: string[];
            formula_id: string;
            expression: string;
            dialect: string;
        }>, "many">;
        semantic_labels: z.ZodArray<z.ZodObject<{
            label_id: z.ZodString;
            label_type: z.ZodString;
            label_value: z.ZodString;
            target_ref: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            target_ref: string;
            label_id: string;
            label_type: string;
            label_value: string;
        }, {
            target_ref: string;
            label_id: string;
            label_type: string;
            label_value: string;
        }>, "many">;
        lineage_refs: z.ZodArray<z.ZodString, "many">;
        template_refs: z.ZodArray<z.ZodString, "many">;
        editability_flags: z.ZodObject<{
            default_editable: z.ZodBoolean;
            locked_region_refs: z.ZodArray<z.ZodString, "many">;
            lock_reason_codes: z.ZodArray<z.ZodString, "many">;
        }, "strip", z.ZodTypeAny, {
            default_editable: boolean;
            locked_region_refs: string[];
            lock_reason_codes: string[];
        }, {
            default_editable: boolean;
            locked_region_refs: string[];
            lock_reason_codes: string[];
        }>;
        evidence_refs: z.ZodArray<z.ZodString, "many">;
        created_at: z.ZodString;
        updated_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        localization: {
            locale: string;
            rtl: boolean;
            numeral_system: string;
            fallback_locales: string[];
        };
        contract: {
            status: "draft" | "active" | "deprecated" | "superseded";
            namespace: string;
            contract_name: "canonical" | "dashboard" | "artifact" | "job" | "action" | "excel" | "tool_registry" | "evidence" | "audit" | "library" | "mode" | "degrade" | "strict" | "localization" | "template_brand" | "permission" | "source" | "publication" | "canvas" | "report" | "presentation" | "schedule" | "ai" | "transcription";
            contract_version: string;
            schema_version: string;
            owner_ref: string;
            compatibility: {
                backward_compatible: boolean;
                forward_compatible: boolean;
            };
            extension_policy: {
                namespaced_extensions_only: boolean;
                mandatory_field_override_forbidden: boolean;
            };
        };
        evidence_refs: string[];
        tenant_ref: string;
        workspace_id: string;
        project_id: string;
        lineage_refs: string[];
        created_at: string;
        updated_at: string;
        formula_refs: {
            target_ref: string;
            dependency_refs: string[];
            formula_id: string;
            expression: string;
            dialect: string;
        }[];
        editability_flags: {
            default_editable: boolean;
            locked_region_refs: string[];
            lock_reason_codes: string[];
        };
        layout_metadata: {
            coordinate_space: "canvas" | "page" | "sheet" | "slide";
            bounding_boxes: Record<string, unknown>[];
            z_order: Record<string, unknown>[];
            grid_rules: Record<string, unknown>[];
            alignment_rules: Record<string, unknown>[];
        };
        semantic_labels: {
            target_ref: string;
            label_id: string;
            label_type: string;
            label_value: string;
        }[];
        data_binding_refs: {
            binding_id: string;
            target_node_ref: string;
            dataset_ref: string;
            query_ref: string;
            field_mappings: Record<string, unknown>[];
        }[];
        template_refs: string[];
        canonical_id: string;
        source_descriptors: {
            source_ref: string;
            source_type: string;
            connector_ref: string;
            source_revision_ref: string;
            parser_profile: string;
        }[];
        representation_kind: "dashboard" | "report" | "presentation" | "document" | "spreadsheet" | "multimodal_content" | "intermediate_converted_artifact";
        strictness_mode: "strict" | "smart" | "flex";
        root_node_refs: string[];
        nodes: {
            text: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "text";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                content: {
                    value: string;
                    locale: string;
                    rtl: boolean;
                }[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                typography_ref: string;
            }[];
            tables: {
                editable: boolean;
                row_count: number;
                column_count: number;
                evidence_refs: string[];
                node_id: string;
                node_type: "table";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                schema_ref: string;
            }[];
            pages: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "page";
                lineage_refs: string[];
                width: number;
                height: number;
                unit: string;
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                layer_refs: string[];
            }[];
            documents: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "document";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                section_refs: string[];
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                page_refs: string[];
            }[];
            sheets: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "sheet";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                table_refs: string[];
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                chart_refs: string[];
                grid_bounds: {
                    row_count: number;
                    column_count: number;
                };
            }[];
            slides: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "slide";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                slide_index: number;
                master_ref: string;
                element_refs: string[];
            }[];
            charts: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "chart";
                lineage_refs: string[];
                formula_refs: string[];
                chart_type: string;
                series_refs: string[];
                axis_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
            }[];
            shapes: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "shape";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                style_ref: string;
                data_binding_refs: string[];
                template_refs: string[];
                shape_type: string;
            }[];
            images: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "image";
                lineage_refs: string[];
                image_asset_ref: string;
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                crop_metadata: Record<string, unknown>;
            }[];
        };
    }, {
        localization: {
            locale: string;
            rtl: boolean;
            numeral_system: string;
            fallback_locales: string[];
        };
        contract: {
            status: "draft" | "active" | "deprecated" | "superseded";
            namespace: string;
            contract_name: "canonical" | "dashboard" | "artifact" | "job" | "action" | "excel" | "tool_registry" | "evidence" | "audit" | "library" | "mode" | "degrade" | "strict" | "localization" | "template_brand" | "permission" | "source" | "publication" | "canvas" | "report" | "presentation" | "schedule" | "ai" | "transcription";
            contract_version: string;
            schema_version: string;
            owner_ref: string;
            compatibility: {
                backward_compatible: boolean;
                forward_compatible: boolean;
            };
            extension_policy: {
                namespaced_extensions_only: boolean;
                mandatory_field_override_forbidden: boolean;
            };
        };
        evidence_refs: string[];
        tenant_ref: string;
        workspace_id: string;
        project_id: string;
        lineage_refs: string[];
        created_at: string;
        updated_at: string;
        formula_refs: {
            target_ref: string;
            dependency_refs: string[];
            formula_id: string;
            expression: string;
            dialect: string;
        }[];
        editability_flags: {
            default_editable: boolean;
            locked_region_refs: string[];
            lock_reason_codes: string[];
        };
        layout_metadata: {
            coordinate_space: "canvas" | "page" | "sheet" | "slide";
            bounding_boxes: Record<string, unknown>[];
            z_order: Record<string, unknown>[];
            grid_rules: Record<string, unknown>[];
            alignment_rules: Record<string, unknown>[];
        };
        semantic_labels: {
            target_ref: string;
            label_id: string;
            label_type: string;
            label_value: string;
        }[];
        data_binding_refs: {
            binding_id: string;
            target_node_ref: string;
            dataset_ref: string;
            query_ref: string;
            field_mappings: Record<string, unknown>[];
        }[];
        template_refs: string[];
        canonical_id: string;
        source_descriptors: {
            source_ref: string;
            source_type: string;
            connector_ref: string;
            source_revision_ref: string;
            parser_profile: string;
        }[];
        representation_kind: "dashboard" | "report" | "presentation" | "document" | "spreadsheet" | "multimodal_content" | "intermediate_converted_artifact";
        strictness_mode: "strict" | "smart" | "flex";
        root_node_refs: string[];
        nodes: {
            text: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "text";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                content: {
                    value: string;
                    locale: string;
                    rtl: boolean;
                }[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                typography_ref: string;
            }[];
            tables: {
                editable: boolean;
                row_count: number;
                column_count: number;
                evidence_refs: string[];
                node_id: string;
                node_type: "table";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                schema_ref: string;
            }[];
            pages: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "page";
                lineage_refs: string[];
                width: number;
                height: number;
                unit: string;
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                layer_refs: string[];
            }[];
            documents: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "document";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                section_refs: string[];
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                page_refs: string[];
            }[];
            sheets: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "sheet";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                table_refs: string[];
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                chart_refs: string[];
                grid_bounds: {
                    row_count: number;
                    column_count: number;
                };
            }[];
            slides: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "slide";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                slide_index: number;
                master_ref: string;
                element_refs: string[];
            }[];
            charts: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "chart";
                lineage_refs: string[];
                formula_refs: string[];
                chart_type: string;
                series_refs: string[];
                axis_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
            }[];
            shapes: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "shape";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                style_ref: string;
                data_binding_refs: string[];
                template_refs: string[];
                shape_type: string;
            }[];
            images: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "image";
                lineage_refs: string[];
                image_asset_ref: string;
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                crop_metadata: Record<string, unknown>;
            }[];
        };
    }>;
    report_artifact_ref: z.ZodString;
    version_artifact_ref: z.ZodString;
    publication_refs: z.ZodArray<z.ZodString, "many">;
    library_asset_refs: z.ZodArray<z.ZodString, "many">;
    schedule_refs: z.ZodArray<z.ZodString, "many">;
    derived_artifact_refs: z.ZodArray<z.ZodString, "many">;
    updated_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    updated_at: string;
    canonical: {
        localization: {
            locale: string;
            rtl: boolean;
            numeral_system: string;
            fallback_locales: string[];
        };
        contract: {
            status: "draft" | "active" | "deprecated" | "superseded";
            namespace: string;
            contract_name: "canonical" | "dashboard" | "artifact" | "job" | "action" | "excel" | "tool_registry" | "evidence" | "audit" | "library" | "mode" | "degrade" | "strict" | "localization" | "template_brand" | "permission" | "source" | "publication" | "canvas" | "report" | "presentation" | "schedule" | "ai" | "transcription";
            contract_version: string;
            schema_version: string;
            owner_ref: string;
            compatibility: {
                backward_compatible: boolean;
                forward_compatible: boolean;
            };
            extension_policy: {
                namespaced_extensions_only: boolean;
                mandatory_field_override_forbidden: boolean;
            };
        };
        evidence_refs: string[];
        tenant_ref: string;
        workspace_id: string;
        project_id: string;
        lineage_refs: string[];
        created_at: string;
        updated_at: string;
        formula_refs: {
            target_ref: string;
            dependency_refs: string[];
            formula_id: string;
            expression: string;
            dialect: string;
        }[];
        editability_flags: {
            default_editable: boolean;
            locked_region_refs: string[];
            lock_reason_codes: string[];
        };
        layout_metadata: {
            coordinate_space: "canvas" | "page" | "sheet" | "slide";
            bounding_boxes: Record<string, unknown>[];
            z_order: Record<string, unknown>[];
            grid_rules: Record<string, unknown>[];
            alignment_rules: Record<string, unknown>[];
        };
        semantic_labels: {
            target_ref: string;
            label_id: string;
            label_type: string;
            label_value: string;
        }[];
        data_binding_refs: {
            binding_id: string;
            target_node_ref: string;
            dataset_ref: string;
            query_ref: string;
            field_mappings: Record<string, unknown>[];
        }[];
        template_refs: string[];
        canonical_id: string;
        source_descriptors: {
            source_ref: string;
            source_type: string;
            connector_ref: string;
            source_revision_ref: string;
            parser_profile: string;
        }[];
        representation_kind: "dashboard" | "report" | "presentation" | "document" | "spreadsheet" | "multimodal_content" | "intermediate_converted_artifact";
        strictness_mode: "strict" | "smart" | "flex";
        root_node_refs: string[];
        nodes: {
            text: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "text";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                content: {
                    value: string;
                    locale: string;
                    rtl: boolean;
                }[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                typography_ref: string;
            }[];
            tables: {
                editable: boolean;
                row_count: number;
                column_count: number;
                evidence_refs: string[];
                node_id: string;
                node_type: "table";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                schema_ref: string;
            }[];
            pages: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "page";
                lineage_refs: string[];
                width: number;
                height: number;
                unit: string;
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                layer_refs: string[];
            }[];
            documents: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "document";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                section_refs: string[];
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                page_refs: string[];
            }[];
            sheets: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "sheet";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                table_refs: string[];
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                chart_refs: string[];
                grid_bounds: {
                    row_count: number;
                    column_count: number;
                };
            }[];
            slides: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "slide";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                slide_index: number;
                master_ref: string;
                element_refs: string[];
            }[];
            charts: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "chart";
                lineage_refs: string[];
                formula_refs: string[];
                chart_type: string;
                series_refs: string[];
                axis_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
            }[];
            shapes: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "shape";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                style_ref: string;
                data_binding_refs: string[];
                template_refs: string[];
                shape_type: string;
            }[];
            images: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "image";
                lineage_refs: string[];
                image_asset_ref: string;
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                crop_metadata: Record<string, unknown>;
            }[];
        };
    };
    report: {
        mode: "easy" | "advanced";
        status: "draft" | "degraded" | "approved" | "binding" | "review" | "published" | "archived";
        schema_version: "1.0.0";
        owner_ref: string;
        contract: {
            status: "draft" | "active" | "deprecated" | "superseded";
            namespace: string;
            contract_name: "canonical" | "dashboard" | "artifact" | "job" | "action" | "excel" | "tool_registry" | "evidence" | "audit" | "library" | "mode" | "degrade" | "strict" | "localization" | "template_brand" | "permission" | "source" | "publication" | "canvas" | "report" | "presentation" | "schedule" | "ai" | "transcription";
            contract_version: string;
            schema_version: string;
            owner_ref: string;
            compatibility: {
                backward_compatible: boolean;
                forward_compatible: boolean;
            };
            extension_policy: {
                namespaced_extensions_only: boolean;
                mandatory_field_override_forbidden: boolean;
            };
        };
        schema_namespace: "rasid.shared.report.v1";
        artifact_ref: string;
        canonical_ref: string;
        created_by: string;
        created_at: string;
        updated_at: string;
        brand_preset_ref: string;
        template_ref: string;
        layout_ref: string;
        publication_refs: string[];
        binding_set_ref: string;
        current_version_ref: string;
        review_state_ref: string;
        approval_state_ref: string;
        section_refs: string[];
        report_id: string;
        report_type: string;
        schedule_refs: string[];
    };
    sections: {
        schema_version: "1.0.0";
        schema_namespace: "rasid.shared.report.v1";
        section_id: string;
        title: {
            value: string;
            locale: string;
            rtl: boolean;
        }[];
        section_kind: "cover" | "body" | "appendix" | "executive_summary" | "table_of_contents" | "footnotes";
        order_index: number;
        version_ref: string;
        layout_ref: string;
        lock_policy: "editable" | "soft_lock" | "strict_lock";
        report_ref: string;
        citation_refs: string[];
        parent_section_ref: string | null;
        block_refs: string[];
        child_section_refs: string[];
        page_anchor_ref: string | null;
        visibility_state: "visible" | "hidden";
    }[];
    version: {
        schema_version: "1.0.0";
        schema_namespace: "rasid.shared.report.v1";
        created_by: string;
        created_at: string;
        version_ref: {
            version_id: string;
            parent_version_id: string | null;
            version_number: number;
            semantic_version: string;
        };
        layout_ref: string;
        change_reason: string;
        created_from: "manual_edit" | "dataset_refresh" | "template_rebuild" | "period_compare" | "external_pattern_rebuild";
        binding_set_ref: string;
        report_ref: string;
        report_version_id: string;
        draft_state: "draft" | "ready_for_review" | "changes_requested" | "finalized";
        review_state_ref: string;
        approval_state_ref: string;
        diff_base_version_ref: string | null;
        section_refs: string[];
        content_block_refs: string[];
    };
    approval_state: {
        schema_version: "1.0.0";
        schema_namespace: "rasid.shared.report.v1";
        state: "not_required" | "pending" | "approved" | "rejected";
        version_ref: string;
        report_ref: string;
        approval_state_id: string;
        approver_ref: string | null;
        decision_comment: string | null;
        decided_at: string | null;
    };
    layout: {
        schema_version: "1.0.0";
        schema_namespace: "rasid.shared.report.v1";
        brand_preset_ref: string;
        template_ref: string;
        version_ref: string;
        layout_id: string;
        report_ref: string;
        page_size: "custom" | "a4" | "a3" | "letter" | "legal";
        orientation: "portrait" | "landscape";
        page_margin_profile: string;
        toc_enabled: boolean;
        appendix_enabled: boolean;
        region_refs: string[];
        regions: {
            schema_version: "1.0.0";
            schema_namespace: "rasid.shared.report.v1";
            region_id: string;
            region_name: string;
            anchor_ref: string;
            placement_rules: Record<string, unknown>[];
            lock_policy: "editable" | "soft_lock" | "strict_lock";
        }[];
        layout_metadata: Record<string, unknown>[];
    };
    content_blocks: {
        schema_version: "1.0.0";
        schema_namespace: "rasid.shared.report.v1";
        title: {
            value: string;
            locale: string;
            rtl: boolean;
        }[];
        order_index: number;
        section_ref: string;
        lineage_refs: string[];
        binding_refs: string[];
        editability: "editable" | "template_locked" | "approval_locked";
        version_ref: string;
        canonical_node_ref: string | null;
        generated_by: "manual" | "template" | "ai_assisted" | "data_bound";
        report_ref: string;
        block_id: string;
        block_type: "table" | "cover" | "appendix" | "chart" | "metric_card" | "executive_summary" | "narrative" | "commentary" | "infographic_plan" | "toc";
        citation_refs: string[];
        content_payload: Record<string, unknown>;
    }[];
    binding_set: {
        schema_version: "1.0.0";
        schema_namespace: "rasid.shared.report.v1";
        bindings: {
            schema_version: "1.0.0";
            schema_namespace: "rasid.shared.report.v1";
            snapshot_version_ref: string | null;
            binding_id: string;
            target_block_ref: string;
            target_node_ref: string;
            dataset_ref: string;
            query_ref: string;
            field_mappings: Record<string, unknown>[];
            last_refresh_at: string | null;
        }[];
        version_ref: string;
        last_refresh_at: string | null;
        source_artifact_refs: string[];
        dataset_binding_refs: string[];
        staleness_status: "broken" | "live" | "partially_live" | "snapshot" | "stale";
        refresh_policy: {
            refresh_mode: "manual" | "scheduled" | "event_driven";
            selective_regeneration_enabled: boolean;
            stale_after_minutes: number | null;
        };
        selective_regeneration_refs: string[];
        broken_binding_refs: string[];
        report_ref: string;
        binding_set_id: string;
    };
    review_state: {
        schema_version: "1.0.0";
        schema_namespace: "rasid.shared.report.v1";
        state: "draft" | "changes_requested" | "in_review" | "reviewed";
        version_ref: string;
        report_ref: string;
        review_state_id: string;
        reviewer_refs: string[];
        review_comment_refs: string[];
        latest_comment: string | null;
        last_reviewed_at: string | null;
    };
    report_artifact_ref: string;
    version_artifact_ref: string;
    publication_refs: string[];
    library_asset_refs: string[];
    schedule_refs: string[];
    derived_artifact_refs: string[];
}, {
    updated_at: string;
    canonical: {
        localization: {
            locale: string;
            rtl: boolean;
            numeral_system: string;
            fallback_locales: string[];
        };
        contract: {
            status: "draft" | "active" | "deprecated" | "superseded";
            namespace: string;
            contract_name: "canonical" | "dashboard" | "artifact" | "job" | "action" | "excel" | "tool_registry" | "evidence" | "audit" | "library" | "mode" | "degrade" | "strict" | "localization" | "template_brand" | "permission" | "source" | "publication" | "canvas" | "report" | "presentation" | "schedule" | "ai" | "transcription";
            contract_version: string;
            schema_version: string;
            owner_ref: string;
            compatibility: {
                backward_compatible: boolean;
                forward_compatible: boolean;
            };
            extension_policy: {
                namespaced_extensions_only: boolean;
                mandatory_field_override_forbidden: boolean;
            };
        };
        evidence_refs: string[];
        tenant_ref: string;
        workspace_id: string;
        project_id: string;
        lineage_refs: string[];
        created_at: string;
        updated_at: string;
        formula_refs: {
            target_ref: string;
            dependency_refs: string[];
            formula_id: string;
            expression: string;
            dialect: string;
        }[];
        editability_flags: {
            default_editable: boolean;
            locked_region_refs: string[];
            lock_reason_codes: string[];
        };
        layout_metadata: {
            coordinate_space: "canvas" | "page" | "sheet" | "slide";
            bounding_boxes: Record<string, unknown>[];
            z_order: Record<string, unknown>[];
            grid_rules: Record<string, unknown>[];
            alignment_rules: Record<string, unknown>[];
        };
        semantic_labels: {
            target_ref: string;
            label_id: string;
            label_type: string;
            label_value: string;
        }[];
        data_binding_refs: {
            binding_id: string;
            target_node_ref: string;
            dataset_ref: string;
            query_ref: string;
            field_mappings: Record<string, unknown>[];
        }[];
        template_refs: string[];
        canonical_id: string;
        source_descriptors: {
            source_ref: string;
            source_type: string;
            connector_ref: string;
            source_revision_ref: string;
            parser_profile: string;
        }[];
        representation_kind: "dashboard" | "report" | "presentation" | "document" | "spreadsheet" | "multimodal_content" | "intermediate_converted_artifact";
        strictness_mode: "strict" | "smart" | "flex";
        root_node_refs: string[];
        nodes: {
            text: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "text";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                content: {
                    value: string;
                    locale: string;
                    rtl: boolean;
                }[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                typography_ref: string;
            }[];
            tables: {
                editable: boolean;
                row_count: number;
                column_count: number;
                evidence_refs: string[];
                node_id: string;
                node_type: "table";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                schema_ref: string;
            }[];
            pages: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "page";
                lineage_refs: string[];
                width: number;
                height: number;
                unit: string;
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                layer_refs: string[];
            }[];
            documents: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "document";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                section_refs: string[];
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                page_refs: string[];
            }[];
            sheets: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "sheet";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                table_refs: string[];
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                chart_refs: string[];
                grid_bounds: {
                    row_count: number;
                    column_count: number;
                };
            }[];
            slides: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "slide";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                slide_index: number;
                master_ref: string;
                element_refs: string[];
            }[];
            charts: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "chart";
                lineage_refs: string[];
                formula_refs: string[];
                chart_type: string;
                series_refs: string[];
                axis_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
            }[];
            shapes: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "shape";
                lineage_refs: string[];
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                style_ref: string;
                data_binding_refs: string[];
                template_refs: string[];
                shape_type: string;
            }[];
            images: {
                editable: boolean;
                evidence_refs: string[];
                node_id: string;
                node_type: "image";
                lineage_refs: string[];
                image_asset_ref: string;
                formula_refs: string[];
                parent_node_ref: string | null;
                child_node_refs: string[];
                layout_ref: string;
                name: string;
                semantic_labels: string[];
                data_binding_refs: string[];
                template_refs: string[];
                crop_metadata: Record<string, unknown>;
            }[];
        };
    };
    report: {
        mode: "easy" | "advanced";
        status: "draft" | "degraded" | "approved" | "binding" | "review" | "published" | "archived";
        schema_version: "1.0.0";
        owner_ref: string;
        contract: {
            status: "draft" | "active" | "deprecated" | "superseded";
            namespace: string;
            contract_name: "canonical" | "dashboard" | "artifact" | "job" | "action" | "excel" | "tool_registry" | "evidence" | "audit" | "library" | "mode" | "degrade" | "strict" | "localization" | "template_brand" | "permission" | "source" | "publication" | "canvas" | "report" | "presentation" | "schedule" | "ai" | "transcription";
            contract_version: string;
            schema_version: string;
            owner_ref: string;
            compatibility: {
                backward_compatible: boolean;
                forward_compatible: boolean;
            };
            extension_policy: {
                namespaced_extensions_only: boolean;
                mandatory_field_override_forbidden: boolean;
            };
        };
        schema_namespace: "rasid.shared.report.v1";
        artifact_ref: string;
        canonical_ref: string;
        created_by: string;
        created_at: string;
        updated_at: string;
        brand_preset_ref: string;
        template_ref: string;
        layout_ref: string;
        publication_refs: string[];
        binding_set_ref: string;
        current_version_ref: string;
        review_state_ref: string;
        approval_state_ref: string;
        section_refs: string[];
        report_id: string;
        report_type: string;
        schedule_refs: string[];
    };
    sections: {
        schema_version: "1.0.0";
        schema_namespace: "rasid.shared.report.v1";
        section_id: string;
        title: {
            value: string;
            locale: string;
            rtl: boolean;
        }[];
        section_kind: "cover" | "body" | "appendix" | "executive_summary" | "table_of_contents" | "footnotes";
        order_index: number;
        version_ref: string;
        layout_ref: string;
        lock_policy: "editable" | "soft_lock" | "strict_lock";
        report_ref: string;
        citation_refs: string[];
        parent_section_ref: string | null;
        block_refs: string[];
        child_section_refs: string[];
        page_anchor_ref: string | null;
        visibility_state: "visible" | "hidden";
    }[];
    version: {
        schema_version: "1.0.0";
        schema_namespace: "rasid.shared.report.v1";
        created_by: string;
        created_at: string;
        version_ref: {
            version_id: string;
            parent_version_id: string | null;
            version_number: number;
            semantic_version: string;
        };
        layout_ref: string;
        change_reason: string;
        created_from: "manual_edit" | "dataset_refresh" | "template_rebuild" | "period_compare" | "external_pattern_rebuild";
        binding_set_ref: string;
        report_ref: string;
        report_version_id: string;
        draft_state: "draft" | "ready_for_review" | "changes_requested" | "finalized";
        review_state_ref: string;
        approval_state_ref: string;
        diff_base_version_ref: string | null;
        section_refs: string[];
        content_block_refs: string[];
    };
    approval_state: {
        schema_version: "1.0.0";
        schema_namespace: "rasid.shared.report.v1";
        state: "not_required" | "pending" | "approved" | "rejected";
        version_ref: string;
        report_ref: string;
        approval_state_id: string;
        approver_ref: string | null;
        decision_comment: string | null;
        decided_at: string | null;
    };
    layout: {
        schema_version: "1.0.0";
        schema_namespace: "rasid.shared.report.v1";
        brand_preset_ref: string;
        template_ref: string;
        version_ref: string;
        layout_id: string;
        report_ref: string;
        page_size: "custom" | "a4" | "a3" | "letter" | "legal";
        orientation: "portrait" | "landscape";
        page_margin_profile: string;
        toc_enabled: boolean;
        appendix_enabled: boolean;
        region_refs: string[];
        regions: {
            schema_version: "1.0.0";
            schema_namespace: "rasid.shared.report.v1";
            region_id: string;
            region_name: string;
            anchor_ref: string;
            placement_rules: Record<string, unknown>[];
            lock_policy: "editable" | "soft_lock" | "strict_lock";
        }[];
        layout_metadata: Record<string, unknown>[];
    };
    content_blocks: {
        schema_version: "1.0.0";
        schema_namespace: "rasid.shared.report.v1";
        title: {
            value: string;
            locale: string;
            rtl: boolean;
        }[];
        order_index: number;
        section_ref: string;
        lineage_refs: string[];
        binding_refs: string[];
        editability: "editable" | "template_locked" | "approval_locked";
        version_ref: string;
        canonical_node_ref: string | null;
        generated_by: "manual" | "template" | "ai_assisted" | "data_bound";
        report_ref: string;
        block_id: string;
        block_type: "table" | "cover" | "appendix" | "chart" | "metric_card" | "executive_summary" | "narrative" | "commentary" | "infographic_plan" | "toc";
        citation_refs: string[];
        content_payload: Record<string, unknown>;
    }[];
    binding_set: {
        schema_version: "1.0.0";
        schema_namespace: "rasid.shared.report.v1";
        bindings: {
            schema_version: "1.0.0";
            schema_namespace: "rasid.shared.report.v1";
            snapshot_version_ref: string | null;
            binding_id: string;
            target_block_ref: string;
            target_node_ref: string;
            dataset_ref: string;
            query_ref: string;
            field_mappings: Record<string, unknown>[];
            last_refresh_at: string | null;
        }[];
        version_ref: string;
        last_refresh_at: string | null;
        source_artifact_refs: string[];
        dataset_binding_refs: string[];
        staleness_status: "broken" | "live" | "partially_live" | "snapshot" | "stale";
        refresh_policy: {
            refresh_mode: "manual" | "scheduled" | "event_driven";
            selective_regeneration_enabled: boolean;
            stale_after_minutes: number | null;
        };
        selective_regeneration_refs: string[];
        broken_binding_refs: string[];
        report_ref: string;
        binding_set_id: string;
    };
    review_state: {
        schema_version: "1.0.0";
        schema_namespace: "rasid.shared.report.v1";
        state: "draft" | "changes_requested" | "in_review" | "reviewed";
        version_ref: string;
        report_ref: string;
        review_state_id: string;
        reviewer_refs: string[];
        review_comment_refs: string[];
        latest_comment: string | null;
        last_reviewed_at: string | null;
    };
    report_artifact_ref: string;
    version_artifact_ref: string;
    publication_refs: string[];
    library_asset_refs: string[];
    schedule_refs: string[];
    derived_artifact_refs: string[];
}>;
export type PersistedReportState = z.infer<typeof PersistedReportStateSchema>;
export type PersistableReportState = {
    report: Report;
    version: ReportVersion;
    layout: ReportLayout;
    sections: ReportSection[];
    contentBlocks: ReportContentBlock[];
    bindingSet: ReportBindingSet;
    reviewState: ReportReviewState;
    approvalState: ReportApprovalState;
    canonical: CanonicalRepresentation;
    reportArtifact: Artifact;
    versionArtifact: Artifact;
    publications: Publication[];
    libraryAssets: LibraryAsset[];
    schedules: SharedSchedule[];
    derivedArtifacts: Artifact[];
};
export type StoredExecutionStage = {
    job: Job;
    evidencePack: EvidencePack;
    auditEvents: AuditEvent[];
    lineageEdges: LineageEdge[];
};
declare const ExternalIngestRecordSchema: z.ZodObject<{
    ingest_id: z.ZodString;
    report_id: z.ZodString;
    source_artifact_ref: z.ZodString;
    parser_kind: z.ZodEnum<["docx", "pdf"]>;
    parser_profile: z.ZodString;
    original_file_name: z.ZodString;
    original_file_path: z.ZodString;
    extracted_title: z.ZodString;
    extracted_text: z.ZodString;
    source_language: z.ZodNullable<z.ZodString>;
    page_count: z.ZodNumber;
    section_count: z.ZodNumber;
    table_count: z.ZodNumber;
    chart_count: z.ZodNumber;
    caption_count: z.ZodNumber;
    rendered_page_refs: z.ZodArray<z.ZodString, "many">;
    page_structure: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">;
    layout_semantics: z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">;
    geometry_map: z.ZodDefault<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">>;
    page_semantics: z.ZodDefault<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">>;
    section_hierarchy: z.ZodDefault<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">>;
    block_lineage_map: z.ZodDefault<z.ZodArray<z.ZodRecord<z.ZodString, z.ZodUnknown>, "many">>;
    imported_at: z.ZodString;
    imported_by: z.ZodString;
    warning_codes: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    report_id: string;
    layout_semantics: Record<string, unknown>[];
    parser_kind: "pdf" | "docx";
    section_count: number;
    ingest_id: string;
    source_artifact_ref: string;
    parser_profile: string;
    original_file_name: string;
    original_file_path: string;
    extracted_title: string;
    extracted_text: string;
    source_language: string | null;
    page_count: number;
    table_count: number;
    chart_count: number;
    caption_count: number;
    rendered_page_refs: string[];
    page_structure: Record<string, unknown>[];
    geometry_map: Record<string, unknown>[];
    page_semantics: Record<string, unknown>[];
    section_hierarchy: Record<string, unknown>[];
    block_lineage_map: Record<string, unknown>[];
    imported_at: string;
    imported_by: string;
    warning_codes: string[];
}, {
    report_id: string;
    layout_semantics: Record<string, unknown>[];
    parser_kind: "pdf" | "docx";
    section_count: number;
    ingest_id: string;
    source_artifact_ref: string;
    parser_profile: string;
    original_file_name: string;
    original_file_path: string;
    extracted_title: string;
    extracted_text: string;
    source_language: string | null;
    page_count: number;
    table_count: number;
    chart_count: number;
    caption_count: number;
    rendered_page_refs: string[];
    page_structure: Record<string, unknown>[];
    imported_at: string;
    imported_by: string;
    warning_codes: string[];
    geometry_map?: Record<string, unknown>[] | undefined;
    page_semantics?: Record<string, unknown>[] | undefined;
    section_hierarchy?: Record<string, unknown>[] | undefined;
    block_lineage_map?: Record<string, unknown>[] | undefined;
}>;
declare const ScheduledDispatchRecordSchema: z.ZodObject<{
    dispatch_id: z.ZodString;
    orchestration_ref: z.ZodString;
    schedule_id: z.ZodString;
    report_id: z.ZodString;
    dispatcher_ref: z.ZodString;
    due_at: z.ZodString;
    queued_at: z.ZodString;
    started_at: z.ZodNullable<z.ZodString>;
    finished_at: z.ZodNullable<z.ZodString>;
    refresh_job_ref: z.ZodNullable<z.ZodString>;
    publication_ref: z.ZodNullable<z.ZodString>;
    degraded_publication_ref: z.ZodNullable<z.ZodString>;
    transport_delivery_refs: z.ZodArray<z.ZodString, "many">;
    dispatch_target_ref: z.ZodNullable<z.ZodString>;
    state: z.ZodEnum<["queued", "running", "retrying", "completed", "failed", "degraded"]>;
    attempt_count: z.ZodNumber;
    max_attempts: z.ZodNumber;
    next_retry_at: z.ZodNullable<z.ZodString>;
    error_message: z.ZodNullable<z.ZodString>;
    failure_history: z.ZodArray<z.ZodObject<{
        attempt_number: z.ZodNumber;
        error_message: z.ZodString;
        failed_at: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        error_message: string;
        attempt_number: number;
        failed_at: string;
    }, {
        error_message: string;
        attempt_number: number;
        failed_at: string;
    }>, "many">;
}, "strip", z.ZodTypeAny, {
    report_id: string;
    schedule_id: string;
    state: "degraded" | "failed" | "completed" | "running" | "queued" | "retrying";
    error_message: string | null;
    dispatch_id: string;
    orchestration_ref: string;
    dispatcher_ref: string;
    due_at: string;
    queued_at: string;
    started_at: string | null;
    finished_at: string | null;
    refresh_job_ref: string | null;
    publication_ref: string | null;
    degraded_publication_ref: string | null;
    transport_delivery_refs: string[];
    dispatch_target_ref: string | null;
    attempt_count: number;
    max_attempts: number;
    next_retry_at: string | null;
    failure_history: {
        error_message: string;
        attempt_number: number;
        failed_at: string;
    }[];
}, {
    report_id: string;
    schedule_id: string;
    state: "degraded" | "failed" | "completed" | "running" | "queued" | "retrying";
    error_message: string | null;
    dispatch_id: string;
    orchestration_ref: string;
    dispatcher_ref: string;
    due_at: string;
    queued_at: string;
    started_at: string | null;
    finished_at: string | null;
    refresh_job_ref: string | null;
    publication_ref: string | null;
    degraded_publication_ref: string | null;
    transport_delivery_refs: string[];
    dispatch_target_ref: string | null;
    attempt_count: number;
    max_attempts: number;
    next_retry_at: string | null;
    failure_history: {
        error_message: string;
        attempt_number: number;
        failed_at: string;
    }[];
}>;
declare const ReportBackSyncRecordSchema: z.ZodObject<{
    sync_id: z.ZodString;
    report_id: z.ZodString;
    downstream_capability: z.ZodEnum<["presentations", "dashboards"]>;
    downstream_ref: z.ZodString;
    downstream_publication_ref: z.ZodNullable<z.ZodString>;
    downstream_version_ref: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    source_version_ref: z.ZodString;
    created_version_ref: z.ZodString;
    matched_section_ref: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    synced_section_refs: z.ZodArray<z.ZodString, "many">;
    synced_block_refs: z.ZodArray<z.ZodString, "many">;
    removed_block_refs: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    conflict_refs: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    change_kinds: z.ZodArray<z.ZodString, "many">;
    reconciliation_mode: z.ZodDefault<z.ZodEnum<["append_only", "structural_merge", "conflict_preserving"]>>;
    merge_summary: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
    summary: z.ZodString;
    synced_at: z.ZodString;
    synced_by: z.ZodString;
}, "strip", z.ZodTypeAny, {
    report_id: string;
    downstream_capability: "presentations" | "dashboards";
    downstream_ref: string;
    downstream_publication_ref: string | null;
    downstream_version_ref: string | null;
    summary: string;
    sync_id: string;
    source_version_ref: string;
    created_version_ref: string;
    matched_section_ref: string | null;
    synced_section_refs: string[];
    synced_block_refs: string[];
    removed_block_refs: string[];
    conflict_refs: string[];
    change_kinds: string[];
    reconciliation_mode: "structural_merge" | "conflict_preserving" | "append_only";
    merge_summary: Record<string, unknown>;
    synced_at: string;
    synced_by: string;
}, {
    report_id: string;
    downstream_capability: "presentations" | "dashboards";
    downstream_ref: string;
    downstream_publication_ref: string | null;
    summary: string;
    sync_id: string;
    source_version_ref: string;
    created_version_ref: string;
    synced_section_refs: string[];
    synced_block_refs: string[];
    change_kinds: string[];
    synced_at: string;
    synced_by: string;
    downstream_version_ref?: string | null | undefined;
    matched_section_ref?: string | null | undefined;
    removed_block_refs?: string[] | undefined;
    conflict_refs?: string[] | undefined;
    reconciliation_mode?: "structural_merge" | "conflict_preserving" | "append_only" | undefined;
    merge_summary?: Record<string, unknown> | undefined;
}>;
declare const ScheduledOrchestrationRecordSchema: z.ZodObject<{
    orchestration_id: z.ZodString;
    schedule_id: z.ZodString;
    report_id: z.ZodString;
    policy_snapshot: z.ZodRecord<z.ZodString, z.ZodUnknown>;
    dispatch_refs: z.ZodArray<z.ZodString, "many">;
    retry_count: z.ZodNumber;
    state: z.ZodEnum<["queued", "running", "completed", "failed", "degraded"]>;
    current_state: z.ZodDefault<z.ZodEnum<["accepted", "queued", "dispatching", "running", "retrying", "publishing", "completed", "failed", "degraded"]>>;
    remote_dispatch_ref: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    queue_ref: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    state_history: z.ZodDefault<z.ZodArray<z.ZodObject<{
        state: z.ZodString;
        entered_at: z.ZodString;
        detail: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        state: string;
        entered_at: string;
        detail: string;
    }, {
        state: string;
        entered_at: string;
        detail?: string | undefined;
    }>, "many">>;
    attempt_history: z.ZodDefault<z.ZodArray<z.ZodObject<{
        attempt_number: z.ZodNumber;
        state: z.ZodString;
        dispatch_ref: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        remote_dispatch_ref: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        started_at: z.ZodString;
        finished_at: z.ZodDefault<z.ZodNullable<z.ZodString>>;
        detail: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        state: string;
        started_at: string;
        finished_at: string | null;
        attempt_number: number;
        remote_dispatch_ref: string | null;
        detail: string;
        dispatch_ref: string | null;
    }, {
        state: string;
        started_at: string;
        attempt_number: number;
        finished_at?: string | null | undefined;
        remote_dispatch_ref?: string | null | undefined;
        detail?: string | undefined;
        dispatch_ref?: string | null | undefined;
    }>, "many">>;
    degrade_reason: z.ZodNullable<z.ZodString>;
    created_at: z.ZodString;
    updated_at: z.ZodString;
    completed_at: z.ZodNullable<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    updated_at: string;
    degrade_reason: string | null;
    report_id: string;
    schedule_id: string;
    state: "degraded" | "failed" | "completed" | "running" | "queued";
    orchestration_id: string;
    policy_snapshot: Record<string, unknown>;
    dispatch_refs: string[];
    retry_count: number;
    current_state: "degraded" | "failed" | "accepted" | "completed" | "running" | "queued" | "retrying" | "dispatching" | "publishing";
    remote_dispatch_ref: string | null;
    queue_ref: string | null;
    state_history: {
        state: string;
        entered_at: string;
        detail: string;
    }[];
    attempt_history: {
        state: string;
        started_at: string;
        finished_at: string | null;
        attempt_number: number;
        remote_dispatch_ref: string | null;
        detail: string;
        dispatch_ref: string | null;
    }[];
    created_at: string;
    completed_at: string | null;
}, {
    updated_at: string;
    degrade_reason: string | null;
    report_id: string;
    schedule_id: string;
    state: "degraded" | "failed" | "completed" | "running" | "queued";
    orchestration_id: string;
    policy_snapshot: Record<string, unknown>;
    dispatch_refs: string[];
    retry_count: number;
    created_at: string;
    completed_at: string | null;
    current_state?: "degraded" | "failed" | "accepted" | "completed" | "running" | "queued" | "retrying" | "dispatching" | "publishing" | undefined;
    remote_dispatch_ref?: string | null | undefined;
    queue_ref?: string | null | undefined;
    state_history?: {
        state: string;
        entered_at: string;
        detail?: string | undefined;
    }[] | undefined;
    attempt_history?: {
        state: string;
        started_at: string;
        attempt_number: number;
        finished_at?: string | null | undefined;
        remote_dispatch_ref?: string | null | undefined;
        detail?: string | undefined;
        dispatch_ref?: string | null | undefined;
    }[] | undefined;
}>;
declare const ReportTransportDeliveryRecordSchema: z.ZodObject<{
    delivery_id: z.ZodString;
    report_id: z.ZodString;
    dispatch_id: z.ZodNullable<z.ZodString>;
    publication_id: z.ZodNullable<z.ZodString>;
    target_ref: z.ZodString;
    backend_ref: z.ZodNullable<z.ZodString>;
    remote_transport_ref: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    served_target_url: z.ZodNullable<z.ZodString>;
    delivery_mode: z.ZodEnum<["served_http", "backend_bundle", "degraded_export"]>;
    access_mode: z.ZodNullable<z.ZodEnum<["read_only", "editable", "shared"]>>;
    state: z.ZodEnum<["queued", "dispatched", "delivered", "failed", "degraded"]>;
    lifecycle_state: z.ZodDefault<z.ZodEnum<["prepared", "dispatched", "delivered", "consumed", "expired", "degraded"]>>;
    access_state_ref: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    delivery_receipt_ref: z.ZodDefault<z.ZodNullable<z.ZodString>>;
    failure_reason: z.ZodNullable<z.ZodString>;
    created_at: z.ZodString;
    updated_at: z.ZodString;
}, "strip", z.ZodTypeAny, {
    lifecycle_state: "degraded" | "dispatched" | "delivered" | "prepared" | "consumed" | "expired";
    target_ref: string;
    updated_at: string;
    report_id: string;
    state: "degraded" | "failed" | "queued" | "dispatched" | "delivered";
    publication_id: string | null;
    dispatch_id: string | null;
    created_at: string;
    delivery_id: string;
    backend_ref: string | null;
    remote_transport_ref: string | null;
    served_target_url: string | null;
    delivery_mode: "served_http" | "backend_bundle" | "degraded_export";
    access_mode: "editable" | "read_only" | "shared" | null;
    access_state_ref: string | null;
    delivery_receipt_ref: string | null;
    failure_reason: string | null;
}, {
    target_ref: string;
    updated_at: string;
    report_id: string;
    state: "degraded" | "failed" | "queued" | "dispatched" | "delivered";
    publication_id: string | null;
    dispatch_id: string | null;
    created_at: string;
    delivery_id: string;
    backend_ref: string | null;
    served_target_url: string | null;
    delivery_mode: "served_http" | "backend_bundle" | "degraded_export";
    access_mode: "editable" | "read_only" | "shared" | null;
    failure_reason: string | null;
    lifecycle_state?: "degraded" | "dispatched" | "delivered" | "prepared" | "consumed" | "expired" | undefined;
    remote_transport_ref?: string | null | undefined;
    access_state_ref?: string | null | undefined;
    delivery_receipt_ref?: string | null | undefined;
}>;
export type ExternalIngestRecord = z.infer<typeof ExternalIngestRecordSchema>;
export type ScheduledDispatchRecord = z.infer<typeof ScheduledDispatchRecordSchema>;
export type ReportBackSyncRecord = z.infer<typeof ReportBackSyncRecordSchema>;
export type ScheduledOrchestrationRecord = z.infer<typeof ScheduledOrchestrationRecordSchema>;
export type ReportTransportDeliveryRecord = z.infer<typeof ReportTransportDeliveryRecordSchema>;
export type PersistedReportPublicationRoute = {
    publication_id: string;
    report_id: string;
    manifest_path: string;
    publish_state_path: string;
    embed_payload_path: string | null;
    embed_html_path: string | null;
    export_html_path: string;
    access_mode: "read_only" | "editable" | "shared";
    backend_ref: string;
    gateway_bundle_ref: string | null;
};
export declare const defaultReportEngineStorageRoot: (root?: string) => string;
export declare const defaultReportEngineBackendRoot: (root?: string) => string;
export declare class ReportEngineStore {
    readonly rootDir: string;
    readonly backendRoot: string;
    constructor(rootDir?: string, backendRoot?: string);
    private reportRoot;
    private reportFile;
    private scheduleRoot;
    private scheduleFile;
    private artifactFile;
    private publicationFile;
    private libraryAssetFile;
    private canonicalFile;
    private currentStateFile;
    private currentEditableArtifactFile;
    private versionSnapshotFile;
    private ingestRecordFile;
    private dispatchRecordFile;
    private backSyncRecordFile;
    private orchestrationRecordFile;
    private transportDeliveryFile;
    private publicationTransportFile;
    private backendPublicationFile;
    private backendSchedulerFile;
    private writeArtifact;
    persistState(state: PersistableReportState, stage: StoredExecutionStage): PersistableReportState;
    writeAuxiliaryArtifact(reportId: string, artifact: Artifact, relativePath: string, payload: string | Uint8Array): Artifact;
    loadState(reportId: string): PersistableReportState;
    loadVersionSnapshot(reportId: string, versionId: string): PersistedReportState;
    listVersionSnapshots(reportId: string): PersistedReportState[];
    listReportIds(): string[];
    listSchedules(): SharedSchedule[];
    loadSchedule(scheduleId: string): SharedSchedule | null;
    saveIngestRecord(record: ExternalIngestRecord): ExternalIngestRecord;
    listIngestRecords(reportId: string): ExternalIngestRecord[];
    saveDispatchRecord(record: ScheduledDispatchRecord): ScheduledDispatchRecord;
    listDispatchRecords(reportId: string): ScheduledDispatchRecord[];
    saveBackSyncRecord(record: ReportBackSyncRecord): ReportBackSyncRecord;
    listBackSyncRecords(reportId: string): ReportBackSyncRecord[];
    saveOrchestrationRecord(record: ScheduledOrchestrationRecord): ScheduledOrchestrationRecord;
    listOrchestrationRecords(reportId: string): ScheduledOrchestrationRecord[];
    saveTransportDeliveryRecord(record: ReportTransportDeliveryRecord): ReportTransportDeliveryRecord;
    listTransportDeliveryRecords(reportId: string): ReportTransportDeliveryRecord[];
    writePublicationTransportJson(reportId: string, publicationId: string, filename: string, payload: unknown): {
        filePath: string;
        uri: string;
        checksum: string;
    };
    writePublicationTransportText(reportId: string, publicationId: string, filename: string, content: string): {
        filePath: string;
        uri: string;
        checksum: string;
    };
    writeBackendPublicationJson(publicationId: string, filename: string, payload: unknown): {
        filePath: string;
        uri: string;
        checksum: string;
    };
    writeBackendPublicationText(publicationId: string, filename: string, content: string): {
        filePath: string;
        uri: string;
        checksum: string;
    };
    writeBackendSchedulerJson(orchestrationId: string, filename: string, payload: unknown): {
        filePath: string;
        uri: string;
        checksum: string;
    };
    writeBackendSchedulerText(orchestrationId: string, filename: string, content: string): {
        filePath: string;
        uri: string;
        checksum: string;
    };
    consumeTransientTransportFailure(targetRef: string): boolean;
    listBackendPublicationIds(): string[];
    loadPublicationRoute(publicationId: string): PersistedReportPublicationRoute | null;
}
export {};
