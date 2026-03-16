"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReportEngineStore = exports.defaultReportEngineBackendRoot = exports.defaultReportEngineStorageRoot = exports.PersistedReportStateSchema = void 0;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_url_1 = require("node:url");
const contracts_1 = require("@rasid/contracts");
const zod_1 = require("zod");
exports.PersistedReportStateSchema = zod_1.z.object({
    report: contracts_1.ReportSchema,
    version: contracts_1.ReportVersionSchema,
    layout: contracts_1.ReportLayoutSchema,
    sections: zod_1.z.array(contracts_1.ReportSectionSchema),
    content_blocks: zod_1.z.array(contracts_1.ReportContentBlockSchema),
    binding_set: contracts_1.ReportBindingSetSchema,
    review_state: contracts_1.ReportReviewStateSchema,
    approval_state: contracts_1.ReportApprovalStateSchema,
    canonical: contracts_1.CanonicalRepresentationSchema,
    report_artifact_ref: zod_1.z.string(),
    version_artifact_ref: zod_1.z.string(),
    publication_refs: zod_1.z.array(zod_1.z.string()),
    library_asset_refs: zod_1.z.array(zod_1.z.string()),
    schedule_refs: zod_1.z.array(zod_1.z.string()),
    derived_artifact_refs: zod_1.z.array(zod_1.z.string()),
    updated_at: zod_1.z.string()
});
const ExternalIngestRecordSchema = zod_1.z.object({
    ingest_id: zod_1.z.string(),
    report_id: zod_1.z.string(),
    source_artifact_ref: zod_1.z.string(),
    parser_kind: zod_1.z.enum(["docx", "pdf"]),
    parser_profile: zod_1.z.string(),
    original_file_name: zod_1.z.string(),
    original_file_path: zod_1.z.string(),
    extracted_title: zod_1.z.string(),
    extracted_text: zod_1.z.string(),
    source_language: zod_1.z.string().nullable(),
    page_count: zod_1.z.number().int().nonnegative(),
    section_count: zod_1.z.number().int().nonnegative(),
    table_count: zod_1.z.number().int().nonnegative(),
    chart_count: zod_1.z.number().int().nonnegative(),
    caption_count: zod_1.z.number().int().nonnegative(),
    rendered_page_refs: zod_1.z.array(zod_1.z.string()),
    page_structure: zod_1.z.array(zod_1.z.record(zod_1.z.unknown())),
    layout_semantics: zod_1.z.array(zod_1.z.record(zod_1.z.unknown())),
    geometry_map: zod_1.z.array(zod_1.z.record(zod_1.z.unknown())).default([]),
    page_semantics: zod_1.z.array(zod_1.z.record(zod_1.z.unknown())).default([]),
    section_hierarchy: zod_1.z.array(zod_1.z.record(zod_1.z.unknown())).default([]),
    block_lineage_map: zod_1.z.array(zod_1.z.record(zod_1.z.unknown())).default([]),
    imported_at: zod_1.z.string(),
    imported_by: zod_1.z.string(),
    warning_codes: zod_1.z.array(zod_1.z.string())
});
const ScheduledDispatchRecordSchema = zod_1.z.object({
    dispatch_id: zod_1.z.string(),
    orchestration_ref: zod_1.z.string(),
    schedule_id: zod_1.z.string(),
    report_id: zod_1.z.string(),
    dispatcher_ref: zod_1.z.string(),
    due_at: zod_1.z.string(),
    queued_at: zod_1.z.string(),
    started_at: zod_1.z.string().nullable(),
    finished_at: zod_1.z.string().nullable(),
    refresh_job_ref: zod_1.z.string().nullable(),
    publication_ref: zod_1.z.string().nullable(),
    degraded_publication_ref: zod_1.z.string().nullable(),
    transport_delivery_refs: zod_1.z.array(zod_1.z.string()),
    dispatch_target_ref: zod_1.z.string().nullable(),
    state: zod_1.z.enum(["queued", "running", "retrying", "completed", "failed", "degraded"]),
    attempt_count: zod_1.z.number().int().positive(),
    max_attempts: zod_1.z.number().int().positive(),
    next_retry_at: zod_1.z.string().nullable(),
    error_message: zod_1.z.string().nullable(),
    failure_history: zod_1.z.array(zod_1.z.object({
        attempt_number: zod_1.z.number().int().positive(),
        error_message: zod_1.z.string(),
        failed_at: zod_1.z.string()
    }))
});
const ReportBackSyncRecordSchema = zod_1.z.object({
    sync_id: zod_1.z.string(),
    report_id: zod_1.z.string(),
    downstream_capability: zod_1.z.enum(["presentations", "dashboards"]),
    downstream_ref: zod_1.z.string(),
    downstream_publication_ref: zod_1.z.string().nullable(),
    downstream_version_ref: zod_1.z.string().nullable().default(null),
    source_version_ref: zod_1.z.string(),
    created_version_ref: zod_1.z.string(),
    matched_section_ref: zod_1.z.string().nullable().default(null),
    synced_section_refs: zod_1.z.array(zod_1.z.string()),
    synced_block_refs: zod_1.z.array(zod_1.z.string()),
    removed_block_refs: zod_1.z.array(zod_1.z.string()).default([]),
    conflict_refs: zod_1.z.array(zod_1.z.string()).default([]),
    change_kinds: zod_1.z.array(zod_1.z.string()),
    reconciliation_mode: zod_1.z.enum(["append_only", "structural_merge", "conflict_preserving"]).default("append_only"),
    merge_summary: zod_1.z.record(zod_1.z.unknown()).default({}),
    summary: zod_1.z.string(),
    synced_at: zod_1.z.string(),
    synced_by: zod_1.z.string()
});
const ScheduledOrchestrationRecordSchema = zod_1.z.object({
    orchestration_id: zod_1.z.string(),
    schedule_id: zod_1.z.string(),
    report_id: zod_1.z.string(),
    policy_snapshot: zod_1.z.record(zod_1.z.unknown()),
    dispatch_refs: zod_1.z.array(zod_1.z.string()),
    retry_count: zod_1.z.number().int().nonnegative(),
    state: zod_1.z.enum(["queued", "running", "completed", "failed", "degraded"]),
    current_state: zod_1.z
        .enum(["accepted", "queued", "dispatching", "running", "retrying", "publishing", "completed", "failed", "degraded"])
        .default("queued"),
    remote_dispatch_ref: zod_1.z.string().nullable().default(null),
    queue_ref: zod_1.z.string().nullable().default(null),
    state_history: zod_1.z
        .array(zod_1.z.object({
        state: zod_1.z.string(),
        entered_at: zod_1.z.string(),
        detail: zod_1.z.string().default("")
    }))
        .default([]),
    attempt_history: zod_1.z
        .array(zod_1.z.object({
        attempt_number: zod_1.z.number().int().positive(),
        state: zod_1.z.string(),
        dispatch_ref: zod_1.z.string().nullable().default(null),
        remote_dispatch_ref: zod_1.z.string().nullable().default(null),
        started_at: zod_1.z.string(),
        finished_at: zod_1.z.string().nullable().default(null),
        detail: zod_1.z.string().default("")
    }))
        .default([]),
    degrade_reason: zod_1.z.string().nullable(),
    created_at: zod_1.z.string(),
    updated_at: zod_1.z.string(),
    completed_at: zod_1.z.string().nullable()
});
const ReportTransportDeliveryRecordSchema = zod_1.z.object({
    delivery_id: zod_1.z.string(),
    report_id: zod_1.z.string(),
    dispatch_id: zod_1.z.string().nullable(),
    publication_id: zod_1.z.string().nullable(),
    target_ref: zod_1.z.string(),
    backend_ref: zod_1.z.string().nullable(),
    remote_transport_ref: zod_1.z.string().nullable().default(null),
    served_target_url: zod_1.z.string().nullable(),
    delivery_mode: zod_1.z.enum(["served_http", "backend_bundle", "degraded_export"]),
    access_mode: zod_1.z.enum(["read_only", "editable", "shared"]).nullable(),
    state: zod_1.z.enum(["queued", "dispatched", "delivered", "failed", "degraded"]),
    lifecycle_state: zod_1.z.enum(["prepared", "dispatched", "delivered", "consumed", "expired", "degraded"]).default("prepared"),
    access_state_ref: zod_1.z.string().nullable().default(null),
    delivery_receipt_ref: zod_1.z.string().nullable().default(null),
    failure_reason: zod_1.z.string().nullable(),
    created_at: zod_1.z.string(),
    updated_at: zod_1.z.string()
});
const ensureDirectory = (directoryPath) => {
    node_fs_1.default.mkdirSync(directoryPath, { recursive: true });
};
const hashContent = (content) => (0, node_crypto_1.createHash)("sha256").update(content).digest("hex");
const orchestrationsIdSafe = (value) => value.replace(/[^a-zA-Z0-9_-]+/g, "-");
const writeJson = (filePath, payload) => {
    ensureDirectory(node_path_1.default.dirname(filePath));
    const content = JSON.stringify(payload, null, 2);
    node_fs_1.default.writeFileSync(filePath, `${content}\n`, "utf8");
    return {
        filePath,
        uri: (0, node_url_1.pathToFileURL)(filePath).href,
        checksum: `sha256:${hashContent(content)}`
    };
};
const readJson = (filePath) => JSON.parse(node_fs_1.default.readFileSync(filePath, "utf8"));
const defaultReportEngineStorageRoot = (root = process.cwd()) => node_path_1.default.join(root, ".runtime", "report-engine");
exports.defaultReportEngineStorageRoot = defaultReportEngineStorageRoot;
const defaultReportEngineBackendRoot = (root = process.cwd()) => node_path_1.default.join(root, ".runtime", "report-engine-backend");
exports.defaultReportEngineBackendRoot = defaultReportEngineBackendRoot;
class ReportEngineStore {
    constructor(rootDir = (0, exports.defaultReportEngineStorageRoot)(), backendRoot = (0, exports.defaultReportEngineBackendRoot)()) {
        this.rootDir = rootDir;
        this.backendRoot = backendRoot;
        ensureDirectory(this.rootDir);
        ensureDirectory(this.backendRoot);
    }
    reportRoot(reportId) {
        return node_path_1.default.join(this.rootDir, "reports", reportId);
    }
    reportFile(reportId, folder, filename) {
        return node_path_1.default.join(this.reportRoot(reportId), folder, filename);
    }
    scheduleRoot() {
        return node_path_1.default.join(this.rootDir, "schedules");
    }
    scheduleFile(scheduleId) {
        return node_path_1.default.join(this.scheduleRoot(), `${scheduleId}.json`);
    }
    artifactFile(reportId, artifactId) {
        return this.reportFile(reportId, "artifacts", `${artifactId}.json`);
    }
    publicationFile(reportId, publicationId) {
        return this.reportFile(reportId, "publications", `${publicationId}.json`);
    }
    libraryAssetFile(reportId, assetId) {
        return this.reportFile(reportId, "library", `${assetId}.json`);
    }
    canonicalFile(reportId, canonicalId) {
        return this.reportFile(reportId, "canonical", `${canonicalId}.json`);
    }
    currentStateFile(reportId) {
        return this.reportFile(reportId, "state", "current.json");
    }
    currentEditableArtifactFile(reportId) {
        return this.reportFile(reportId, "state", "editable-report.json");
    }
    versionSnapshotFile(reportId, versionId) {
        return this.reportFile(reportId, "versions", `${versionId}.json`);
    }
    ingestRecordFile(reportId, ingestId) {
        return this.reportFile(reportId, "ingest", `${ingestId}.json`);
    }
    dispatchRecordFile(reportId, dispatchId) {
        return this.reportFile(reportId, "dispatches", `${dispatchId}.json`);
    }
    backSyncRecordFile(reportId, syncId) {
        return this.reportFile(reportId, "back-sync", `${syncId}.json`);
    }
    orchestrationRecordFile(reportId, orchestrationId) {
        return this.reportFile(reportId, "orchestrations", `${orchestrationId}.json`);
    }
    transportDeliveryFile(reportId, deliveryId) {
        return this.reportFile(reportId, "transport-deliveries", `${deliveryId}.json`);
    }
    publicationTransportFile(reportId, publicationId, filename) {
        return this.reportFile(reportId, node_path_1.default.join("transport", publicationId), filename);
    }
    backendPublicationFile(publicationId, filename) {
        return node_path_1.default.join(this.backendRoot, "publications", publicationId, filename);
    }
    backendSchedulerFile(orchestrationId, filename) {
        return node_path_1.default.join(this.backendRoot, "scheduler", orchestrationsIdSafe(orchestrationId), filename);
    }
    writeArtifact(reportId, artifact) {
        writeJson(this.artifactFile(reportId, artifact.artifact_id), contracts_1.ArtifactSchema.parse(artifact));
        return artifact;
    }
    persistState(state, stage) {
        const reportId = state.report.report_id;
        const baseSnapshot = exports.PersistedReportStateSchema.parse({
            report: state.report,
            version: state.version,
            layout: state.layout,
            sections: state.sections,
            content_blocks: state.contentBlocks,
            binding_set: state.bindingSet,
            review_state: state.reviewState,
            approval_state: state.approvalState,
            canonical: state.canonical,
            report_artifact_ref: state.reportArtifact.artifact_id,
            version_artifact_ref: state.versionArtifact.artifact_id,
            publication_refs: state.publications.map((publication) => publication.publication_id),
            library_asset_refs: state.libraryAssets.map((asset) => asset.asset_id),
            schedule_refs: state.schedules.map((schedule) => schedule.schedule_id),
            derived_artifact_refs: state.derivedArtifacts.map((artifact) => artifact.artifact_id),
            updated_at: state.report.updated_at
        });
        const currentArtifactWrite = writeJson(this.currentEditableArtifactFile(reportId), baseSnapshot);
        const versionArtifactWrite = writeJson(this.versionSnapshotFile(reportId, state.version.version_ref.version_id), baseSnapshot);
        const reportArtifact = contracts_1.ArtifactSchema.parse({
            ...state.reportArtifact,
            storage_ref: {
                ...state.reportArtifact.storage_ref,
                uri: currentArtifactWrite.uri,
                checksum: currentArtifactWrite.checksum,
                region: "local"
            }
        });
        const versionArtifact = contracts_1.ArtifactSchema.parse({
            ...state.versionArtifact,
            storage_ref: {
                ...state.versionArtifact.storage_ref,
                uri: versionArtifactWrite.uri,
                checksum: versionArtifactWrite.checksum,
                region: "local"
            }
        });
        const persisted = {
            ...state,
            reportArtifact,
            versionArtifact
        };
        writeJson(this.currentStateFile(reportId), exports.PersistedReportStateSchema.parse({
            ...baseSnapshot,
            updated_at: persisted.report.updated_at
        }));
        writeJson(this.canonicalFile(reportId, persisted.canonical.canonical_id), contracts_1.CanonicalRepresentationSchema.parse(persisted.canonical));
        this.writeArtifact(reportId, persisted.reportArtifact);
        this.writeArtifact(reportId, persisted.versionArtifact);
        persisted.derivedArtifacts.forEach((artifact) => this.writeArtifact(reportId, artifact));
        persisted.publications.forEach((publication) => writeJson(this.publicationFile(reportId, publication.publication_id), contracts_1.PublicationSchema.parse(publication)));
        persisted.libraryAssets.forEach((asset) => writeJson(this.libraryAssetFile(reportId, asset.asset_id), contracts_1.LibraryAssetSchema.parse(asset)));
        persisted.schedules.forEach((schedule) => writeJson(this.scheduleFile(schedule.schedule_id), contracts_1.SharedScheduleSchema.parse(schedule)));
        writeJson(this.reportFile(reportId, "jobs", `${stage.job.job_id}.json`), contracts_1.JobSchema.parse(stage.job));
        writeJson(this.reportFile(reportId, "evidence", `${stage.evidencePack.evidence_pack_id}.json`), contracts_1.EvidencePackSchema.parse(stage.evidencePack));
        stage.auditEvents.forEach((event) => writeJson(this.reportFile(reportId, "audit", `${event.event_id}.json`), contracts_1.AuditEventSchema.parse(event)));
        stage.lineageEdges.forEach((edge) => writeJson(this.reportFile(reportId, "lineage", `${edge.edge_id}.json`), edge));
        return persisted;
    }
    writeAuxiliaryArtifact(reportId, artifact, relativePath, payload) {
        const targetPath = this.reportFile(reportId, "artifacts-data", relativePath);
        ensureDirectory(node_path_1.default.dirname(targetPath));
        if (typeof payload === "string") {
            node_fs_1.default.writeFileSync(targetPath, payload, "utf8");
        }
        else {
            node_fs_1.default.writeFileSync(targetPath, Buffer.from(payload));
        }
        const content = typeof payload === "string" ? payload : Buffer.from(payload).toString("binary");
        const persisted = contracts_1.ArtifactSchema.parse({
            ...artifact,
            storage_ref: {
                ...artifact.storage_ref,
                uri: (0, node_url_1.pathToFileURL)(targetPath).href,
                checksum: `sha256:${hashContent(content)}`,
                region: "local"
            }
        });
        this.writeArtifact(reportId, persisted);
        return persisted;
    }
    loadState(reportId) {
        const state = exports.PersistedReportStateSchema.parse(readJson(this.currentStateFile(reportId)));
        const readArtifact = (artifactId) => contracts_1.ArtifactSchema.parse(readJson(this.artifactFile(reportId, artifactId)));
        const readPublication = (publicationId) => contracts_1.PublicationSchema.parse(readJson(this.publicationFile(reportId, publicationId)));
        const readAsset = (assetId) => contracts_1.LibraryAssetSchema.parse(readJson(this.libraryAssetFile(reportId, assetId)));
        const readSchedule = (scheduleId) => contracts_1.SharedScheduleSchema.parse(readJson(this.scheduleFile(scheduleId)));
        return {
            report: state.report,
            version: state.version,
            layout: state.layout,
            sections: state.sections,
            contentBlocks: state.content_blocks,
            bindingSet: state.binding_set,
            reviewState: state.review_state,
            approvalState: state.approval_state,
            canonical: state.canonical,
            reportArtifact: readArtifact(state.report_artifact_ref),
            versionArtifact: readArtifact(state.version_artifact_ref),
            publications: state.publication_refs.map(readPublication),
            libraryAssets: state.library_asset_refs.map(readAsset),
            schedules: state.schedule_refs.map(readSchedule),
            derivedArtifacts: state.derived_artifact_refs.map(readArtifact)
        };
    }
    loadVersionSnapshot(reportId, versionId) {
        return exports.PersistedReportStateSchema.parse(readJson(this.versionSnapshotFile(reportId, versionId)));
    }
    listVersionSnapshots(reportId) {
        const directory = this.reportFile(reportId, "versions", "");
        if (!node_fs_1.default.existsSync(directory)) {
            return [];
        }
        return node_fs_1.default
            .readdirSync(directory)
            .filter((entry) => entry.endsWith(".json"))
            .map((entry) => exports.PersistedReportStateSchema.parse(readJson(node_path_1.default.join(directory, entry))))
            .sort((left, right) => left.version.version_ref.version_number - right.version.version_ref.version_number);
    }
    listReportIds() {
        const directory = node_path_1.default.join(this.rootDir, "reports");
        if (!node_fs_1.default.existsSync(directory)) {
            return [];
        }
        return node_fs_1.default
            .readdirSync(directory, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name);
    }
    listSchedules() {
        if (!node_fs_1.default.existsSync(this.scheduleRoot()))
            return [];
        return node_fs_1.default
            .readdirSync(this.scheduleRoot())
            .filter((entry) => entry.endsWith(".json"))
            .map((entry) => contracts_1.SharedScheduleSchema.parse(readJson(node_path_1.default.join(this.scheduleRoot(), entry))));
    }
    loadSchedule(scheduleId) {
        const filePath = this.scheduleFile(scheduleId);
        if (!node_fs_1.default.existsSync(filePath)) {
            return null;
        }
        return contracts_1.SharedScheduleSchema.parse(readJson(filePath));
    }
    saveIngestRecord(record) {
        const parsed = ExternalIngestRecordSchema.parse(record);
        writeJson(this.ingestRecordFile(parsed.report_id, parsed.ingest_id), parsed);
        return parsed;
    }
    listIngestRecords(reportId) {
        const directory = this.reportFile(reportId, "ingest", "");
        if (!node_fs_1.default.existsSync(directory)) {
            return [];
        }
        return node_fs_1.default
            .readdirSync(directory)
            .filter((entry) => entry.endsWith(".json"))
            .map((entry) => ExternalIngestRecordSchema.parse(readJson(node_path_1.default.join(directory, entry))));
    }
    saveDispatchRecord(record) {
        const parsed = ScheduledDispatchRecordSchema.parse(record);
        writeJson(this.dispatchRecordFile(parsed.report_id, parsed.dispatch_id), parsed);
        return parsed;
    }
    listDispatchRecords(reportId) {
        const directory = this.reportFile(reportId, "dispatches", "");
        if (!node_fs_1.default.existsSync(directory)) {
            return [];
        }
        return node_fs_1.default
            .readdirSync(directory)
            .filter((entry) => entry.endsWith(".json"))
            .map((entry) => ScheduledDispatchRecordSchema.parse(readJson(node_path_1.default.join(directory, entry))));
    }
    saveBackSyncRecord(record) {
        const parsed = ReportBackSyncRecordSchema.parse(record);
        writeJson(this.backSyncRecordFile(parsed.report_id, parsed.sync_id), parsed);
        return parsed;
    }
    listBackSyncRecords(reportId) {
        const directory = this.reportFile(reportId, "back-sync", "");
        if (!node_fs_1.default.existsSync(directory)) {
            return [];
        }
        return node_fs_1.default
            .readdirSync(directory)
            .filter((entry) => entry.endsWith(".json"))
            .map((entry) => ReportBackSyncRecordSchema.parse(readJson(node_path_1.default.join(directory, entry))));
    }
    saveOrchestrationRecord(record) {
        const parsed = ScheduledOrchestrationRecordSchema.parse(record);
        writeJson(this.orchestrationRecordFile(parsed.report_id, parsed.orchestration_id), parsed);
        return parsed;
    }
    listOrchestrationRecords(reportId) {
        const directory = this.reportFile(reportId, "orchestrations", "");
        if (!node_fs_1.default.existsSync(directory)) {
            return [];
        }
        return node_fs_1.default
            .readdirSync(directory)
            .filter((entry) => entry.endsWith(".json"))
            .map((entry) => ScheduledOrchestrationRecordSchema.parse(readJson(node_path_1.default.join(directory, entry))));
    }
    saveTransportDeliveryRecord(record) {
        const parsed = ReportTransportDeliveryRecordSchema.parse(record);
        writeJson(this.transportDeliveryFile(parsed.report_id, parsed.delivery_id), parsed);
        return parsed;
    }
    listTransportDeliveryRecords(reportId) {
        const directory = this.reportFile(reportId, "transport-deliveries", "");
        if (!node_fs_1.default.existsSync(directory)) {
            return [];
        }
        return node_fs_1.default
            .readdirSync(directory)
            .filter((entry) => entry.endsWith(".json"))
            .map((entry) => ReportTransportDeliveryRecordSchema.parse(readJson(node_path_1.default.join(directory, entry))));
    }
    writePublicationTransportJson(reportId, publicationId, filename, payload) {
        return writeJson(this.publicationTransportFile(reportId, publicationId, filename), payload);
    }
    writePublicationTransportText(reportId, publicationId, filename, content) {
        ensureDirectory(node_path_1.default.dirname(this.publicationTransportFile(reportId, publicationId, filename)));
        node_fs_1.default.writeFileSync(this.publicationTransportFile(reportId, publicationId, filename), content, "utf8");
        return {
            filePath: this.publicationTransportFile(reportId, publicationId, filename),
            uri: (0, node_url_1.pathToFileURL)(this.publicationTransportFile(reportId, publicationId, filename)).href,
            checksum: `sha256:${hashContent(content)}`
        };
    }
    writeBackendPublicationJson(publicationId, filename, payload) {
        return writeJson(this.backendPublicationFile(publicationId, filename), payload);
    }
    writeBackendPublicationText(publicationId, filename, content) {
        ensureDirectory(node_path_1.default.dirname(this.backendPublicationFile(publicationId, filename)));
        node_fs_1.default.writeFileSync(this.backendPublicationFile(publicationId, filename), content, "utf8");
        return {
            filePath: this.backendPublicationFile(publicationId, filename),
            uri: (0, node_url_1.pathToFileURL)(this.backendPublicationFile(publicationId, filename)).href,
            checksum: `sha256:${hashContent(content)}`
        };
    }
    writeBackendSchedulerJson(orchestrationId, filename, payload) {
        return writeJson(this.backendSchedulerFile(orchestrationId, filename), payload);
    }
    writeBackendSchedulerText(orchestrationId, filename, content) {
        ensureDirectory(node_path_1.default.dirname(this.backendSchedulerFile(orchestrationId, filename)));
        node_fs_1.default.writeFileSync(this.backendSchedulerFile(orchestrationId, filename), content, "utf8");
        return {
            filePath: this.backendSchedulerFile(orchestrationId, filename),
            uri: (0, node_url_1.pathToFileURL)(this.backendSchedulerFile(orchestrationId, filename)).href,
            checksum: `sha256:${hashContent(content)}`
        };
    }
    consumeTransientTransportFailure(targetRef) {
        const markerFile = node_path_1.default.join(this.backendRoot, "transient-transport-failures", `${hashContent(targetRef)}.json`);
        if (node_fs_1.default.existsSync(markerFile)) {
            return false;
        }
        writeJson(markerFile, {
            target_ref: targetRef,
            failed_once_at: new Date().toISOString()
        });
        return true;
    }
    listBackendPublicationIds() {
        const directory = node_path_1.default.join(this.backendRoot, "publications");
        if (!node_fs_1.default.existsSync(directory)) {
            return [];
        }
        return node_fs_1.default
            .readdirSync(directory, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name);
    }
    loadPublicationRoute(publicationId) {
        const manifestPath = this.backendPublicationFile(publicationId, "manifest.json");
        if (!node_fs_1.default.existsSync(manifestPath)) {
            return null;
        }
        const manifest = readJson(manifestPath);
        const gatewayManifestPath = this.backendPublicationFile(publicationId, "gateway-manifest.json");
        const gatewayManifest = node_fs_1.default.existsSync(gatewayManifestPath)
            ? readJson(gatewayManifestPath)
            : {};
        const reportId = manifest.report_id;
        const publicationTransportRoot = this.reportFile(reportId, node_path_1.default.join("transport", publicationId), "");
        const route = {
            publication_id: manifest.publication_id,
            report_id: reportId,
            manifest_path: manifest.transport_manifest_path ?? node_path_1.default.join(publicationTransportRoot, "manifest.json"),
            publish_state_path: manifest.transport_publish_state_path ?? node_path_1.default.join(publicationTransportRoot, "publish-state.json"),
            embed_payload_path: manifest.transport_embed_payload_path ?? node_path_1.default.join(publicationTransportRoot, "embed-payload.json"),
            embed_html_path: manifest.transport_embed_html_path ?? node_path_1.default.join(publicationTransportRoot, "embed.html"),
            export_html_path: manifest.transport_export_html_path ?? node_path_1.default.join(publicationTransportRoot, "published-report.html"),
            access_mode: manifest.access_mode ?? "read_only",
            backend_ref: manifest.backend_ref,
            gateway_bundle_ref: gatewayManifest.gateway_bundle_ref ?? null
        };
        return {
            ...route,
            embed_payload_path: route.embed_payload_path && node_fs_1.default.existsSync(route.embed_payload_path) ? route.embed_payload_path : null,
            embed_html_path: route.embed_html_path && node_fs_1.default.existsSync(route.embed_html_path) ? route.embed_html_path : null
        };
    }
}
exports.ReportEngineStore = ReportEngineStore;
