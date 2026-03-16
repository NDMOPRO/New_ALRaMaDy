import { RegistryBootstrap } from "@rasid/capability-registry";
import { type Artifact, type AuditEvent, type CanonicalRepresentation, type CulturalFormattingPlan, type CulturalQualityResult, type DirectionTransformationPlan, type EditabilityQualityResult, type EvidencePack, type Job, type LanguageQualityResult, type LayoutQualityResult, type LineageEdge, type LocalizationDegradeReason, type LocalizationPolicy, type LocalizationPreview, type LocalizationQualityResult, type LocalizationRequest, type LocalizationScope, type LocalizedOutputMetadata, type NonTranslatableTerm, type ProtectedTerm, type Publication, type TerminologyProfile, type TerminologyRule, type TypographyRefinementPlan } from "@rasid/contracts";
import { z } from "zod";
declare const SampleContainerSchema: z.ZodObject<{
    container_id: z.ZodString;
    title: z.ZodString;
    width: z.ZodNumber;
    height: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    title: string;
    container_id: string;
    width: number;
    height: number;
}, {
    title: string;
    container_id: string;
    width: number;
    height: number;
}>;
declare const SampleTextNodeSchema: z.ZodObject<{
    node_id: z.ZodString;
    container_id: z.ZodString;
    name: z.ZodString;
    text: z.ZodString;
    x: z.ZodNumber;
    y: z.ZodNumber;
    width: z.ZodNumber;
    height: z.ZodNumber;
    semantic_labels: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    data_binding_refs: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    formula_refs: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    editable: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    editable: boolean;
    text: string;
    container_id: string;
    width: number;
    height: number;
    node_id: string;
    name: string;
    x: number;
    y: number;
    semantic_labels: string[];
    data_binding_refs: string[];
    formula_refs: string[];
}, {
    text: string;
    container_id: string;
    width: number;
    height: number;
    node_id: string;
    name: string;
    x: number;
    y: number;
    editable?: boolean | undefined;
    semantic_labels?: string[] | undefined;
    data_binding_refs?: string[] | undefined;
    formula_refs?: string[] | undefined;
}>;
declare const LocalizationIntegrationSchema: z.ZodObject<{
    provider_mode: z.ZodDefault<z.ZodEnum<["deterministic_local", "filesystem_glossary", "http_json"]>>;
    glossary_file_path: z.ZodOptional<z.ZodString>;
    provider_url: z.ZodOptional<z.ZodString>;
    provider_headers: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
    provider_timeout_ms: z.ZodDefault<z.ZodNumber>;
    provider_retry_count: z.ZodDefault<z.ZodNumber>;
    provider_retry_backoff_ms: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    provider_mode: "deterministic_local" | "filesystem_glossary" | "http_json";
    provider_headers: Record<string, string>;
    provider_timeout_ms: number;
    provider_retry_count: number;
    provider_retry_backoff_ms: number;
    glossary_file_path?: string | undefined;
    provider_url?: string | undefined;
}, {
    provider_mode?: "deterministic_local" | "filesystem_glossary" | "http_json" | undefined;
    glossary_file_path?: string | undefined;
    provider_url?: string | undefined;
    provider_headers?: Record<string, string> | undefined;
    provider_timeout_ms?: number | undefined;
    provider_retry_count?: number | undefined;
    provider_retry_backoff_ms?: number | undefined;
}>;
declare const LocalizationExecutionInputSchema: z.ZodObject<{
    run_id: z.ZodString;
    tenant_ref: z.ZodString;
    workspace_id: z.ZodString;
    project_id: z.ZodString;
    created_by: z.ZodString;
    mode: z.ZodDefault<z.ZodEnum<["easy", "advanced"]>>;
    source_artifact: z.ZodObject<{
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
        artifact_id: z.ZodString;
        artifact_type: z.ZodEnum<["source_file", "normalized_dataset", "workflow_output", "report", "dashboard", "presentation", "spreadsheet", "strict_output", "preview_render", "export_bundle", "evidence_pack"]>;
        artifact_subtype: z.ZodString;
        project_id: z.ZodString;
        workspace_id: z.ZodString;
        source_refs: z.ZodArray<z.ZodString, "many">;
        parent_artifact_refs: z.ZodArray<z.ZodString, "many">;
        canonical_ref: z.ZodString;
        created_by: z.ZodString;
        created_at: z.ZodString;
        mode: z.ZodEnum<["easy", "advanced"]>;
        editable_status: z.ZodEnum<["editable", "partially_editable", "non_editable"]>;
        template_status: z.ZodEnum<["none", "applied", "soft_locked", "strict_locked"]>;
        lineage_ref: z.ZodString;
        evidence_ref: z.ZodString;
        verification_status: z.ZodEnum<["unverified", "verified", "success_with_warnings", "degraded", "failed"]>;
        storage_ref: z.ZodObject<{
            storage_id: z.ZodString;
            storage_class: z.ZodString;
            uri: z.ZodString;
            checksum: z.ZodString;
            region: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            storage_id: string;
            storage_class: string;
            uri: string;
            checksum: string;
            region: string;
        }, {
            storage_id: string;
            storage_class: string;
            uri: string;
            checksum: string;
            region: string;
        }>;
        preview_ref: z.ZodObject<{
            preview_id: z.ZodString;
            preview_type: z.ZodEnum<["thumbnail", "html_canvas", "image_render", "pdf_preview"]>;
            storage_ref: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            preview_id: string;
            preview_type: "thumbnail" | "html_canvas" | "image_render" | "pdf_preview";
            storage_ref: string;
        }, {
            preview_id: string;
            preview_type: "thumbnail" | "html_canvas" | "image_render" | "pdf_preview";
            storage_ref: string;
        }>;
        export_refs: z.ZodArray<z.ZodObject<{
            export_id: z.ZodString;
            export_type: z.ZodEnum<["pdf", "docx", "html", "pptx", "xlsx", "xls", "xlsm", "csv", "png", "json", "zip", "other"]>;
            explicit_non_editable: z.ZodBoolean;
            storage_ref: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            storage_ref: string;
            export_id: string;
            export_type: "pdf" | "docx" | "html" | "pptx" | "xlsx" | "xls" | "xlsm" | "csv" | "png" | "json" | "zip" | "other";
            explicit_non_editable: boolean;
        }, {
            storage_ref: string;
            export_id: string;
            export_type: "pdf" | "docx" | "html" | "pptx" | "xlsx" | "xls" | "xlsm" | "csv" | "png" | "json" | "zip" | "other";
            explicit_non_editable: boolean;
        }>, "many">;
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
        tenant_ref: z.ZodString;
        permission_scope: z.ZodObject<{
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
        }>;
    }, "strip", z.ZodTypeAny, {
        mode: "easy" | "advanced";
        storage_ref: {
            storage_id: string;
            storage_class: string;
            uri: string;
            checksum: string;
            region: string;
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
        evidence_ref: string;
        lineage_ref: string;
        source_refs: string[];
        tenant_ref: string;
        workspace_id: string;
        project_id: string;
        canonical_ref: string;
        created_by: string;
        created_at: string;
        verification_status: "unverified" | "verified" | "success_with_warnings" | "degraded" | "failed";
        editable_status: "editable" | "partially_editable" | "non_editable";
        preview_ref: {
            preview_id: string;
            preview_type: "thumbnail" | "html_canvas" | "image_render" | "pdf_preview";
            storage_ref: string;
        };
        version_ref: {
            version_id: string;
            parent_version_id: string | null;
            version_number: number;
            semantic_version: string;
        };
        export_refs: {
            storage_ref: string;
            export_id: string;
            export_type: "pdf" | "docx" | "html" | "pptx" | "xlsx" | "xls" | "xlsm" | "csv" | "png" | "json" | "zip" | "other";
            explicit_non_editable: boolean;
        }[];
        permission_scope: {
            visibility: "private" | "workspace" | "tenant" | "shared_link";
            allow_read: boolean;
            allow_write: boolean;
            allow_share: boolean;
            allow_publish: boolean;
            allow_audit_view: boolean;
        };
        artifact_id: string;
        artifact_type: "dashboard" | "report" | "presentation" | "spreadsheet" | "source_file" | "normalized_dataset" | "workflow_output" | "strict_output" | "preview_render" | "export_bundle" | "evidence_pack";
        artifact_subtype: string;
        parent_artifact_refs: string[];
        template_status: "applied" | "none" | "soft_locked" | "strict_locked";
    }, {
        mode: "easy" | "advanced";
        storage_ref: {
            storage_id: string;
            storage_class: string;
            uri: string;
            checksum: string;
            region: string;
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
        evidence_ref: string;
        lineage_ref: string;
        source_refs: string[];
        tenant_ref: string;
        workspace_id: string;
        project_id: string;
        canonical_ref: string;
        created_by: string;
        created_at: string;
        verification_status: "unverified" | "verified" | "success_with_warnings" | "degraded" | "failed";
        editable_status: "editable" | "partially_editable" | "non_editable";
        preview_ref: {
            preview_id: string;
            preview_type: "thumbnail" | "html_canvas" | "image_render" | "pdf_preview";
            storage_ref: string;
        };
        version_ref: {
            version_id: string;
            parent_version_id: string | null;
            version_number: number;
            semantic_version: string;
        };
        export_refs: {
            storage_ref: string;
            export_id: string;
            export_type: "pdf" | "docx" | "html" | "pptx" | "xlsx" | "xls" | "xlsm" | "csv" | "png" | "json" | "zip" | "other";
            explicit_non_editable: boolean;
        }[];
        permission_scope: {
            visibility: "private" | "workspace" | "tenant" | "shared_link";
            allow_read: boolean;
            allow_write: boolean;
            allow_share: boolean;
            allow_publish: boolean;
            allow_audit_view: boolean;
        };
        artifact_id: string;
        artifact_type: "dashboard" | "report" | "presentation" | "spreadsheet" | "source_file" | "normalized_dataset" | "workflow_output" | "strict_output" | "preview_render" | "export_bundle" | "evidence_pack";
        artifact_subtype: string;
        parent_artifact_refs: string[];
        template_status: "applied" | "none" | "soft_locked" | "strict_locked";
    }>;
    source_canonical: z.ZodObject<{
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
    target_locale: z.ZodDefault<z.ZodString>;
    publish_target_ref: z.ZodString;
    policy: z.ZodOptional<z.ZodObject<{
        schema_namespace: z.ZodLiteral<"rasid.shared.localization.v1">;
        schema_version: z.ZodLiteral<"1.0.0">;
    } & {
        localization_policy_id: z.ZodString;
        policy_name: z.ZodString;
        capability_id: z.ZodLiteral<"arabic_localization_lct">;
        mode: z.ZodEnum<["strict_localization", "smart_localization", "pro_localization"]>;
        source_language_detection: z.ZodEnum<["auto_detect", "explicit", "mixed_bilingual"]>;
        preview_before_apply: z.ZodBoolean;
        approval_required_for_apply: z.ZodBoolean;
        auto_resolve_terminology_profile: z.ZodBoolean;
        apply_direction_transform: z.ZodBoolean;
        apply_typography_refinement: z.ZodBoolean;
        apply_cultural_formatting: z.ZodBoolean;
        preserve_editability: z.ZodBoolean;
        allow_degraded_apply: z.ZodBoolean;
        blocked_on_binding_break: z.ZodBoolean;
        date_policy: z.ZodString;
        number_policy: z.ZodString;
        currency_policy: z.ZodString;
        locale_phrase_policy: z.ZodEnum<["literal", "culturally_adapted", "brand_constrained"]>;
        numeric_shaping_policy: z.ZodEnum<["preserve_source", "arabic_indic", "latin", "context_aware"]>;
    }, "strip", z.ZodTypeAny, {
        apply_cultural_formatting: boolean;
        preserve_editability: boolean;
        schema_namespace: "rasid.shared.localization.v1";
        schema_version: "1.0.0";
        localization_policy_id: string;
        policy_name: string;
        capability_id: "arabic_localization_lct";
        mode: "strict_localization" | "smart_localization" | "pro_localization";
        source_language_detection: "auto_detect" | "explicit" | "mixed_bilingual";
        preview_before_apply: boolean;
        approval_required_for_apply: boolean;
        auto_resolve_terminology_profile: boolean;
        apply_direction_transform: boolean;
        apply_typography_refinement: boolean;
        allow_degraded_apply: boolean;
        blocked_on_binding_break: boolean;
        date_policy: string;
        number_policy: string;
        currency_policy: string;
        locale_phrase_policy: "literal" | "culturally_adapted" | "brand_constrained";
        numeric_shaping_policy: "context_aware" | "preserve_source" | "arabic_indic" | "latin";
    }, {
        apply_cultural_formatting: boolean;
        preserve_editability: boolean;
        schema_namespace: "rasid.shared.localization.v1";
        schema_version: "1.0.0";
        localization_policy_id: string;
        policy_name: string;
        capability_id: "arabic_localization_lct";
        mode: "strict_localization" | "smart_localization" | "pro_localization";
        source_language_detection: "auto_detect" | "explicit" | "mixed_bilingual";
        preview_before_apply: boolean;
        approval_required_for_apply: boolean;
        auto_resolve_terminology_profile: boolean;
        apply_direction_transform: boolean;
        apply_typography_refinement: boolean;
        allow_degraded_apply: boolean;
        blocked_on_binding_break: boolean;
        date_policy: string;
        number_policy: string;
        currency_policy: string;
        locale_phrase_policy: "literal" | "culturally_adapted" | "brand_constrained";
        numeric_shaping_policy: "context_aware" | "preserve_source" | "arabic_indic" | "latin";
    }>>;
    profiles: z.ZodDefault<z.ZodArray<z.ZodObject<{
        schema_namespace: z.ZodLiteral<"rasid.shared.localization.v1">;
        schema_version: z.ZodLiteral<"1.0.0">;
    } & {
        terminology_profile_id: z.ZodString;
        profile_name: z.ZodString;
        scope: z.ZodEnum<["org", "workspace", "domain", "user", "artifact_override"]>;
        source_locale: z.ZodString;
        target_locale: z.ZodString;
        default_style: z.ZodEnum<["executive", "formal", "government", "technical"]>;
        rule_refs: z.ZodArray<z.ZodString, "many">;
        protected_term_refs: z.ZodArray<z.ZodString, "many">;
        non_translatable_term_refs: z.ZodArray<z.ZodString, "many">;
        parent_profile_refs: z.ZodArray<z.ZodString, "many">;
        brand_preset_ref: z.ZodNullable<z.ZodString>;
        acronym_policy: z.ZodEnum<["preserve", "expand_once", "localize_if_defined"]>;
        title_policy: z.ZodEnum<["localize", "preserve", "conditional"]>;
        caption_policy: z.ZodEnum<["localize", "preserve", "conditional"]>;
    }, "strip", z.ZodTypeAny, {
        schema_namespace: "rasid.shared.localization.v1";
        schema_version: "1.0.0";
        source_locale: string;
        target_locale: string;
        terminology_profile_id: string;
        profile_name: string;
        scope: "org" | "workspace" | "domain" | "user" | "artifact_override";
        default_style: "executive" | "formal" | "government" | "technical";
        rule_refs: string[];
        protected_term_refs: string[];
        non_translatable_term_refs: string[];
        parent_profile_refs: string[];
        brand_preset_ref: string | null;
        acronym_policy: "preserve" | "expand_once" | "localize_if_defined";
        title_policy: "preserve" | "localize" | "conditional";
        caption_policy: "preserve" | "localize" | "conditional";
    }, {
        schema_namespace: "rasid.shared.localization.v1";
        schema_version: "1.0.0";
        source_locale: string;
        target_locale: string;
        terminology_profile_id: string;
        profile_name: string;
        scope: "org" | "workspace" | "domain" | "user" | "artifact_override";
        default_style: "executive" | "formal" | "government" | "technical";
        rule_refs: string[];
        protected_term_refs: string[];
        non_translatable_term_refs: string[];
        parent_profile_refs: string[];
        brand_preset_ref: string | null;
        acronym_policy: "preserve" | "expand_once" | "localize_if_defined";
        title_policy: "preserve" | "localize" | "conditional";
        caption_policy: "preserve" | "localize" | "conditional";
    }>, "many">>;
    rules: z.ZodDefault<z.ZodArray<z.ZodObject<{
        schema_namespace: z.ZodLiteral<"rasid.shared.localization.v1">;
        schema_version: z.ZodLiteral<"1.0.0">;
    } & {
        terminology_rule_id: z.ZodString;
        profile_ref: z.ZodString;
        source_locale: z.ZodString;
        target_locale: z.ZodString;
        source_term: z.ZodString;
        preferred_translation: z.ZodString;
        banned_translations: z.ZodArray<z.ZodString, "many">;
        rule_class: z.ZodEnum<["preferred_translation", "banned_translation", "protected_term", "non_translatable", "acronym", "title", "caption"]>;
        case_sensitive: z.ZodBoolean;
        applies_to_scope_refs: z.ZodArray<z.ZodString, "many">;
        context_notes: z.ZodNullable<z.ZodString>;
        priority: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        schema_namespace: "rasid.shared.localization.v1";
        schema_version: "1.0.0";
        terminology_rule_id: string;
        profile_ref: string;
        source_locale: string;
        target_locale: string;
        source_term: string;
        preferred_translation: string;
        banned_translations: string[];
        rule_class: "preferred_translation" | "banned_translation" | "protected_term" | "non_translatable" | "acronym" | "title" | "caption";
        case_sensitive: boolean;
        applies_to_scope_refs: string[];
        context_notes: string | null;
        priority: number;
    }, {
        schema_namespace: "rasid.shared.localization.v1";
        schema_version: "1.0.0";
        terminology_rule_id: string;
        profile_ref: string;
        source_locale: string;
        target_locale: string;
        source_term: string;
        preferred_translation: string;
        banned_translations: string[];
        rule_class: "preferred_translation" | "banned_translation" | "protected_term" | "non_translatable" | "acronym" | "title" | "caption";
        case_sensitive: boolean;
        applies_to_scope_refs: string[];
        context_notes: string | null;
        priority: number;
    }>, "many">>;
    protected_terms: z.ZodDefault<z.ZodArray<z.ZodObject<{
        schema_namespace: z.ZodLiteral<"rasid.shared.localization.v1">;
        schema_version: z.ZodLiteral<"1.0.0">;
    } & {
        protected_term_id: z.ZodString;
        profile_ref: z.ZodString;
        locale: z.ZodString;
        term: z.ZodString;
        required_output_term: z.ZodNullable<z.ZodString>;
        match_strategy: z.ZodEnum<["exact", "normalized", "regex"]>;
        applies_to_scope_refs: z.ZodArray<z.ZodString, "many">;
        rationale: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        schema_namespace: "rasid.shared.localization.v1";
        schema_version: "1.0.0";
        profile_ref: string;
        applies_to_scope_refs: string[];
        protected_term_id: string;
        locale: string;
        term: string;
        required_output_term: string | null;
        match_strategy: "exact" | "normalized" | "regex";
        rationale: string | null;
    }, {
        schema_namespace: "rasid.shared.localization.v1";
        schema_version: "1.0.0";
        profile_ref: string;
        applies_to_scope_refs: string[];
        protected_term_id: string;
        locale: string;
        term: string;
        required_output_term: string | null;
        match_strategy: "exact" | "normalized" | "regex";
        rationale: string | null;
    }>, "many">>;
    non_translatable_terms: z.ZodDefault<z.ZodArray<z.ZodObject<{
        schema_namespace: z.ZodLiteral<"rasid.shared.localization.v1">;
        schema_version: z.ZodLiteral<"1.0.0">;
    } & {
        non_translatable_term_id: z.ZodString;
        profile_ref: z.ZodString;
        locale: z.ZodString;
        term: z.ZodString;
        match_strategy: z.ZodEnum<["exact", "normalized", "regex"]>;
        preserve_original: z.ZodBoolean;
        applies_to_scope_refs: z.ZodArray<z.ZodString, "many">;
        rationale: z.ZodNullable<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        schema_namespace: "rasid.shared.localization.v1";
        schema_version: "1.0.0";
        profile_ref: string;
        applies_to_scope_refs: string[];
        locale: string;
        term: string;
        match_strategy: "exact" | "normalized" | "regex";
        rationale: string | null;
        non_translatable_term_id: string;
        preserve_original: boolean;
    }, {
        schema_namespace: "rasid.shared.localization.v1";
        schema_version: "1.0.0";
        profile_ref: string;
        applies_to_scope_refs: string[];
        locale: string;
        term: string;
        match_strategy: "exact" | "normalized" | "regex";
        rationale: string | null;
        non_translatable_term_id: string;
        preserve_original: boolean;
    }>, "many">>;
    integration: z.ZodOptional<z.ZodObject<{
        provider_mode: z.ZodDefault<z.ZodEnum<["deterministic_local", "filesystem_glossary", "http_json"]>>;
        glossary_file_path: z.ZodOptional<z.ZodString>;
        provider_url: z.ZodOptional<z.ZodString>;
        provider_headers: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodString>>;
        provider_timeout_ms: z.ZodDefault<z.ZodNumber>;
        provider_retry_count: z.ZodDefault<z.ZodNumber>;
        provider_retry_backoff_ms: z.ZodDefault<z.ZodNumber>;
    }, "strip", z.ZodTypeAny, {
        provider_mode: "deterministic_local" | "filesystem_glossary" | "http_json";
        provider_headers: Record<string, string>;
        provider_timeout_ms: number;
        provider_retry_count: number;
        provider_retry_backoff_ms: number;
        glossary_file_path?: string | undefined;
        provider_url?: string | undefined;
    }, {
        provider_mode?: "deterministic_local" | "filesystem_glossary" | "http_json" | undefined;
        glossary_file_path?: string | undefined;
        provider_url?: string | undefined;
        provider_headers?: Record<string, string> | undefined;
        provider_timeout_ms?: number | undefined;
        provider_retry_count?: number | undefined;
        provider_retry_backoff_ms?: number | undefined;
    }>>;
    roundtrip_tamper_mode: z.ZodDefault<z.ZodEnum<["none", "dashboard_missing_payload", "dashboard_manifest_mismatch"]>>;
    allow_degraded_publish: z.ZodDefault<z.ZodBoolean>;
    output_root: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    tenant_ref: string;
    workspace_id: string;
    project_id: string;
    created_by: string;
    mode: "easy" | "advanced";
    run_id: string;
    source_artifact: {
        mode: "easy" | "advanced";
        storage_ref: {
            storage_id: string;
            storage_class: string;
            uri: string;
            checksum: string;
            region: string;
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
        evidence_ref: string;
        lineage_ref: string;
        source_refs: string[];
        tenant_ref: string;
        workspace_id: string;
        project_id: string;
        canonical_ref: string;
        created_by: string;
        created_at: string;
        verification_status: "unverified" | "verified" | "success_with_warnings" | "degraded" | "failed";
        editable_status: "editable" | "partially_editable" | "non_editable";
        preview_ref: {
            preview_id: string;
            preview_type: "thumbnail" | "html_canvas" | "image_render" | "pdf_preview";
            storage_ref: string;
        };
        version_ref: {
            version_id: string;
            parent_version_id: string | null;
            version_number: number;
            semantic_version: string;
        };
        export_refs: {
            storage_ref: string;
            export_id: string;
            export_type: "pdf" | "docx" | "html" | "pptx" | "xlsx" | "xls" | "xlsm" | "csv" | "png" | "json" | "zip" | "other";
            explicit_non_editable: boolean;
        }[];
        permission_scope: {
            visibility: "private" | "workspace" | "tenant" | "shared_link";
            allow_read: boolean;
            allow_write: boolean;
            allow_share: boolean;
            allow_publish: boolean;
            allow_audit_view: boolean;
        };
        artifact_id: string;
        artifact_type: "dashboard" | "report" | "presentation" | "spreadsheet" | "source_file" | "normalized_dataset" | "workflow_output" | "strict_output" | "preview_render" | "export_bundle" | "evidence_pack";
        artifact_subtype: string;
        parent_artifact_refs: string[];
        template_status: "applied" | "none" | "soft_locked" | "strict_locked";
    };
    source_canonical: {
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
    target_locale: string;
    publish_target_ref: string;
    profiles: {
        schema_namespace: "rasid.shared.localization.v1";
        schema_version: "1.0.0";
        source_locale: string;
        target_locale: string;
        terminology_profile_id: string;
        profile_name: string;
        scope: "org" | "workspace" | "domain" | "user" | "artifact_override";
        default_style: "executive" | "formal" | "government" | "technical";
        rule_refs: string[];
        protected_term_refs: string[];
        non_translatable_term_refs: string[];
        parent_profile_refs: string[];
        brand_preset_ref: string | null;
        acronym_policy: "preserve" | "expand_once" | "localize_if_defined";
        title_policy: "preserve" | "localize" | "conditional";
        caption_policy: "preserve" | "localize" | "conditional";
    }[];
    rules: {
        schema_namespace: "rasid.shared.localization.v1";
        schema_version: "1.0.0";
        terminology_rule_id: string;
        profile_ref: string;
        source_locale: string;
        target_locale: string;
        source_term: string;
        preferred_translation: string;
        banned_translations: string[];
        rule_class: "preferred_translation" | "banned_translation" | "protected_term" | "non_translatable" | "acronym" | "title" | "caption";
        case_sensitive: boolean;
        applies_to_scope_refs: string[];
        context_notes: string | null;
        priority: number;
    }[];
    protected_terms: {
        schema_namespace: "rasid.shared.localization.v1";
        schema_version: "1.0.0";
        profile_ref: string;
        applies_to_scope_refs: string[];
        protected_term_id: string;
        locale: string;
        term: string;
        required_output_term: string | null;
        match_strategy: "exact" | "normalized" | "regex";
        rationale: string | null;
    }[];
    non_translatable_terms: {
        schema_namespace: "rasid.shared.localization.v1";
        schema_version: "1.0.0";
        profile_ref: string;
        applies_to_scope_refs: string[];
        locale: string;
        term: string;
        match_strategy: "exact" | "normalized" | "regex";
        rationale: string | null;
        non_translatable_term_id: string;
        preserve_original: boolean;
    }[];
    roundtrip_tamper_mode: "none" | "dashboard_missing_payload" | "dashboard_manifest_mismatch";
    allow_degraded_publish: boolean;
    policy?: {
        apply_cultural_formatting: boolean;
        preserve_editability: boolean;
        schema_namespace: "rasid.shared.localization.v1";
        schema_version: "1.0.0";
        localization_policy_id: string;
        policy_name: string;
        capability_id: "arabic_localization_lct";
        mode: "strict_localization" | "smart_localization" | "pro_localization";
        source_language_detection: "auto_detect" | "explicit" | "mixed_bilingual";
        preview_before_apply: boolean;
        approval_required_for_apply: boolean;
        auto_resolve_terminology_profile: boolean;
        apply_direction_transform: boolean;
        apply_typography_refinement: boolean;
        allow_degraded_apply: boolean;
        blocked_on_binding_break: boolean;
        date_policy: string;
        number_policy: string;
        currency_policy: string;
        locale_phrase_policy: "literal" | "culturally_adapted" | "brand_constrained";
        numeric_shaping_policy: "context_aware" | "preserve_source" | "arabic_indic" | "latin";
    } | undefined;
    integration?: {
        provider_mode: "deterministic_local" | "filesystem_glossary" | "http_json";
        provider_headers: Record<string, string>;
        provider_timeout_ms: number;
        provider_retry_count: number;
        provider_retry_backoff_ms: number;
        glossary_file_path?: string | undefined;
        provider_url?: string | undefined;
    } | undefined;
    output_root?: string | undefined;
}, {
    tenant_ref: string;
    workspace_id: string;
    project_id: string;
    created_by: string;
    run_id: string;
    source_artifact: {
        mode: "easy" | "advanced";
        storage_ref: {
            storage_id: string;
            storage_class: string;
            uri: string;
            checksum: string;
            region: string;
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
        evidence_ref: string;
        lineage_ref: string;
        source_refs: string[];
        tenant_ref: string;
        workspace_id: string;
        project_id: string;
        canonical_ref: string;
        created_by: string;
        created_at: string;
        verification_status: "unverified" | "verified" | "success_with_warnings" | "degraded" | "failed";
        editable_status: "editable" | "partially_editable" | "non_editable";
        preview_ref: {
            preview_id: string;
            preview_type: "thumbnail" | "html_canvas" | "image_render" | "pdf_preview";
            storage_ref: string;
        };
        version_ref: {
            version_id: string;
            parent_version_id: string | null;
            version_number: number;
            semantic_version: string;
        };
        export_refs: {
            storage_ref: string;
            export_id: string;
            export_type: "pdf" | "docx" | "html" | "pptx" | "xlsx" | "xls" | "xlsm" | "csv" | "png" | "json" | "zip" | "other";
            explicit_non_editable: boolean;
        }[];
        permission_scope: {
            visibility: "private" | "workspace" | "tenant" | "shared_link";
            allow_read: boolean;
            allow_write: boolean;
            allow_share: boolean;
            allow_publish: boolean;
            allow_audit_view: boolean;
        };
        artifact_id: string;
        artifact_type: "dashboard" | "report" | "presentation" | "spreadsheet" | "source_file" | "normalized_dataset" | "workflow_output" | "strict_output" | "preview_render" | "export_bundle" | "evidence_pack";
        artifact_subtype: string;
        parent_artifact_refs: string[];
        template_status: "applied" | "none" | "soft_locked" | "strict_locked";
    };
    source_canonical: {
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
    publish_target_ref: string;
    mode?: "easy" | "advanced" | undefined;
    target_locale?: string | undefined;
    policy?: {
        apply_cultural_formatting: boolean;
        preserve_editability: boolean;
        schema_namespace: "rasid.shared.localization.v1";
        schema_version: "1.0.0";
        localization_policy_id: string;
        policy_name: string;
        capability_id: "arabic_localization_lct";
        mode: "strict_localization" | "smart_localization" | "pro_localization";
        source_language_detection: "auto_detect" | "explicit" | "mixed_bilingual";
        preview_before_apply: boolean;
        approval_required_for_apply: boolean;
        auto_resolve_terminology_profile: boolean;
        apply_direction_transform: boolean;
        apply_typography_refinement: boolean;
        allow_degraded_apply: boolean;
        blocked_on_binding_break: boolean;
        date_policy: string;
        number_policy: string;
        currency_policy: string;
        locale_phrase_policy: "literal" | "culturally_adapted" | "brand_constrained";
        numeric_shaping_policy: "context_aware" | "preserve_source" | "arabic_indic" | "latin";
    } | undefined;
    profiles?: {
        schema_namespace: "rasid.shared.localization.v1";
        schema_version: "1.0.0";
        source_locale: string;
        target_locale: string;
        terminology_profile_id: string;
        profile_name: string;
        scope: "org" | "workspace" | "domain" | "user" | "artifact_override";
        default_style: "executive" | "formal" | "government" | "technical";
        rule_refs: string[];
        protected_term_refs: string[];
        non_translatable_term_refs: string[];
        parent_profile_refs: string[];
        brand_preset_ref: string | null;
        acronym_policy: "preserve" | "expand_once" | "localize_if_defined";
        title_policy: "preserve" | "localize" | "conditional";
        caption_policy: "preserve" | "localize" | "conditional";
    }[] | undefined;
    rules?: {
        schema_namespace: "rasid.shared.localization.v1";
        schema_version: "1.0.0";
        terminology_rule_id: string;
        profile_ref: string;
        source_locale: string;
        target_locale: string;
        source_term: string;
        preferred_translation: string;
        banned_translations: string[];
        rule_class: "preferred_translation" | "banned_translation" | "protected_term" | "non_translatable" | "acronym" | "title" | "caption";
        case_sensitive: boolean;
        applies_to_scope_refs: string[];
        context_notes: string | null;
        priority: number;
    }[] | undefined;
    protected_terms?: {
        schema_namespace: "rasid.shared.localization.v1";
        schema_version: "1.0.0";
        profile_ref: string;
        applies_to_scope_refs: string[];
        protected_term_id: string;
        locale: string;
        term: string;
        required_output_term: string | null;
        match_strategy: "exact" | "normalized" | "regex";
        rationale: string | null;
    }[] | undefined;
    non_translatable_terms?: {
        schema_namespace: "rasid.shared.localization.v1";
        schema_version: "1.0.0";
        profile_ref: string;
        applies_to_scope_refs: string[];
        locale: string;
        term: string;
        match_strategy: "exact" | "normalized" | "regex";
        rationale: string | null;
        non_translatable_term_id: string;
        preserve_original: boolean;
    }[] | undefined;
    integration?: {
        provider_mode?: "deterministic_local" | "filesystem_glossary" | "http_json" | undefined;
        glossary_file_path?: string | undefined;
        provider_url?: string | undefined;
        provider_headers?: Record<string, string> | undefined;
        provider_timeout_ms?: number | undefined;
        provider_retry_count?: number | undefined;
        provider_retry_backoff_ms?: number | undefined;
    } | undefined;
    roundtrip_tamper_mode?: "none" | "dashboard_missing_payload" | "dashboard_manifest_mismatch" | undefined;
    allow_degraded_publish?: boolean | undefined;
    output_root?: string | undefined;
}>;
type LocalizationExecutionInput = z.infer<typeof LocalizationExecutionInputSchema>;
type SampleContainer = z.infer<typeof SampleContainerSchema>;
type SampleTextNode = z.infer<typeof SampleTextNodeSchema>;
type LocalizationIntegration = z.infer<typeof LocalizationIntegrationSchema>;
type GlossaryConflict = {
    source_term: string;
    target_term: string;
    conflict_code: "protected_term_violation" | "non_translatable_violation" | "duplicate_source_conflict";
    affected_terms: string[];
    detail: string;
};
type ProviderAttemptTrace = {
    attempt_number: number;
    outcome: "success" | "http_error" | "timeout" | "malformed_response" | "network_error" | "empty";
    duration_ms: number;
    status_code: number | null;
    translated_count: number;
    timeout_hit: boolean;
    error: string | null;
    failure_classification: string | null;
    retry_decision: "retry" | "fallback_local" | "complete" | null;
    response_excerpt: string | null;
};
type TranslationIntegrationStatus = {
    provider_mode: LocalizationIntegration["provider_mode"];
    glossary_source_path: string | null;
    glossary_rule_count: number;
    glossary_conflicts: GlossaryConflict[];
    provider_url: string | null;
    provider_used: boolean;
    provider_warning: string | null;
    provider_attempt_count: number;
    provider_retry_count: number;
    provider_timeout_hit: boolean;
    provider_final_outcome: "not_used" | "success" | "empty" | "fallback_local";
    fallback_mode: "deterministic_local" | "filesystem_glossary" | null;
    provider_trace: ProviderAttemptTrace[];
    validation_classification: string | null;
};
type TerminologyResolution = {
    profile: TerminologyProfile;
    rules: TerminologyRule[];
    protectedTerms: ProtectedTerm[];
    nonTranslatableTerms: NonTranslatableTerm[];
    integration: TranslationIntegrationStatus;
};
type PersistedFile = {
    filePath: string;
    uri: string;
    checksum: string;
};
type OutputSidecar = {
    relative_path: string;
    content: string | Uint8Array;
};
type ParsedLocalizedOutput = {
    parser_kind: "docx" | "pptx" | "xlsx" | "dashboard_bundle";
    title: string;
    containers: SampleContainer[];
    text_nodes: SampleTextNode[];
    metadata: Record<string, unknown>;
};
type LocalizationRoundTripResult = {
    parser_kind: ParsedLocalizedOutput["parser_kind"] | "failed";
    reingested_canonical: CanonicalRepresentation | null;
    quality: LocalizationQualityResult | null;
    evidence_pack: EvidencePack;
    audit_events: AuditEvent[];
    lineage_edges: LineageEdge[];
    manifest: Record<string, unknown>;
    preservation_report: Record<string, unknown>;
};
export type LocalizationPersistedArtifacts = {
    output_root: string;
    input_payload_path: string;
    input_canonical_path: string;
    request_path: string;
    policy_path: string;
    terminology_profile_path: string;
    direction_plan_path: string;
    typography_plan_path: string;
    cultural_plan_path: string;
    localized_canonical_path: string;
    localized_output_path: string;
    preview_path: string;
    diff_path: string;
    quality_path: string;
    output_metadata_path: string;
    publication_path: string;
    evidence_path: string;
    audit_path: string;
    lineage_path: string;
    artifacts_manifest_path: string;
    translation_integration_path: string;
    native_adapter_metadata_path: string;
    fidelity_report_path: string;
    dashboard_artifact_closure_path: string | null;
    provider_malformed_proof_path: string | null;
    dashboard_package_path: string | null;
    published_sidecar_paths: string[];
    roundtrip_manifest_path: string;
    roundtrip_canonical_path: string;
    roundtrip_quality_path: string;
    roundtrip_evidence_path: string;
    roundtrip_audit_path: string;
    roundtrip_lineage_path: string;
    roundtrip_preservation_path: string;
};
export type LocalizationExecutionBundle = {
    input: LocalizationExecutionInput;
    detected_source_locale: string;
    localization_scope: LocalizationScope;
    localization_policy: LocalizationPolicy;
    terminology_resolution: TerminologyResolution;
    direction_transformation_plan: DirectionTransformationPlan;
    typography_refinement_plan: TypographyRefinementPlan;
    cultural_formatting_plan: CulturalFormattingPlan;
    localization_request: LocalizationRequest;
    localized_canonical: CanonicalRepresentation;
    localized_artifact: Artifact;
    preview_artifact: Artifact;
    diff_artifact: Artifact;
    export_artifacts: Artifact[];
    localized_output_metadata: LocalizedOutputMetadata;
    localization_preview: LocalizationPreview;
    language_quality_result: LanguageQualityResult;
    layout_quality_result: LayoutQualityResult;
    editability_quality_result: EditabilityQualityResult;
    cultural_quality_result: CulturalQualityResult;
    localization_quality_result: LocalizationQualityResult;
    localization_degrade_reasons: LocalizationDegradeReason[];
    publication: Publication;
    evidence_pack: EvidencePack;
    audit_events: AuditEvent[];
    lineage_edges: LineageEdge[];
    job: Job;
    translation_integration: TranslationIntegrationStatus;
    published_output_content: string | Uint8Array;
    published_output_extension: Artifact["export_refs"][number]["export_type"];
    published_output_preview_type: Artifact["preview_ref"]["preview_type"];
    published_output_sidecars: OutputSidecar[];
    native_adapter_metadata: Record<string, unknown>;
    preview_content: string;
    diff_payload: Record<string, unknown>;
    round_trip_result: LocalizationRoundTripResult | null;
    persisted_artifacts: LocalizationPersistedArtifacts | null;
    publish_mode: "localized" | "degraded";
};
export type LocalizationSampleRun = {
    sample_name: string;
    bundle: LocalizationExecutionBundle;
    artifacts: LocalizationPersistedArtifacts;
};
export declare class ArabicLocalizationLctEngine {
    detectSourceLanguage(inputValue: LocalizationExecutionInput): string;
    resolveTerminologyProfile(inputValue: LocalizationExecutionInput, sourceLocale: string): TerminologyResolution;
    buildLocalizationPlan(inputValue: LocalizationExecutionInput, sourceLocale: string, terminology: TerminologyResolution): {
        scope: LocalizationScope;
        policy: LocalizationPolicy;
        directionPlan: DirectionTransformationPlan;
        typographyPlan: TypographyRefinementPlan;
        culturalPlan: CulturalFormattingPlan;
        request: LocalizationRequest;
    };
    transformLanguage(canonicalValue: CanonicalRepresentation, targetLocale: string, terminology: TerminologyResolution): CanonicalRepresentation;
    transformRtlLtrLayout(canonicalValue: CanonicalRepresentation, planValue: DirectionTransformationPlan): CanonicalRepresentation;
    refineTypography(canonicalValue: CanonicalRepresentation, planValue: TypographyRefinementPlan): CanonicalRepresentation;
    applyCulturalFormatting(canonicalValue: CanonicalRepresentation, planValue: CulturalFormattingPlan): CanonicalRepresentation;
    runLocalizationQualityGates(inputValue: LocalizationExecutionInput, requestId: string, localizedCanonical: CanonicalRepresentation, terminology: TerminologyResolution, outputMetadataId: string): {
        language: LanguageQualityResult;
        layout: LayoutQualityResult;
        editability: EditabilityQualityResult;
        cultural: CulturalQualityResult;
        quality: LocalizationQualityResult;
        degradeReasons: LocalizationDegradeReason[];
    };
    run(inputValue: LocalizationExecutionInput, inputPayload?: Record<string, unknown>, inputCanonicalFile?: PersistedFile): Promise<LocalizationExecutionBundle>;
}
export declare const registerArabicLocalizationLctCapability: (runtime: RegistryBootstrap) => void;
export declare const runArabicLocalizationLctRegressionSuite: (options?: {
    outputRoot?: string;
}) => Promise<LocalizationSampleRun[]>;
export {};
