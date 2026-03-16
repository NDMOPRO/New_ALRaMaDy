import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  ArtifactSchema,
  AuditEventSchema,
  CanonicalRepresentationSchema,
  EvidencePackSchema,
  JobSchema,
  LibraryAssetSchema,
  PublicationSchema,
  ReportApprovalStateSchema,
  ReportBindingSetSchema,
  ReportContentBlockSchema,
  ReportLayoutSchema,
  ReportReviewStateSchema,
  ReportSchema,
  ReportSectionSchema,
  ReportVersionSchema,
  SharedScheduleSchema,
  type Artifact,
  type AuditEvent,
  type CanonicalRepresentation,
  type EvidencePack,
  type Job,
  type LibraryAsset,
  type LineageEdge,
  type Publication,
  type Report,
  type ReportApprovalState,
  type ReportBindingSet,
  type ReportContentBlock,
  type ReportLayout,
  type ReportReviewState,
  type ReportSection,
  type ReportVersion,
  type SharedSchedule
} from "@rasid/contracts";
import { z } from "zod";

export const PersistedReportStateSchema = z.object({
  report: ReportSchema,
  version: ReportVersionSchema,
  layout: ReportLayoutSchema,
  sections: z.array(ReportSectionSchema),
  content_blocks: z.array(ReportContentBlockSchema),
  binding_set: ReportBindingSetSchema,
  review_state: ReportReviewStateSchema,
  approval_state: ReportApprovalStateSchema,
  canonical: CanonicalRepresentationSchema,
  report_artifact_ref: z.string(),
  version_artifact_ref: z.string(),
  publication_refs: z.array(z.string()),
  library_asset_refs: z.array(z.string()),
  schedule_refs: z.array(z.string()),
  derived_artifact_refs: z.array(z.string()),
  updated_at: z.string()
});

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

const ExternalIngestRecordSchema = z.object({
  ingest_id: z.string(),
  report_id: z.string(),
  source_artifact_ref: z.string(),
  parser_kind: z.enum(["docx", "pdf"]),
  parser_profile: z.string(),
  original_file_name: z.string(),
  original_file_path: z.string(),
  extracted_title: z.string(),
  extracted_text: z.string(),
  source_language: z.string().nullable(),
  page_count: z.number().int().nonnegative(),
  section_count: z.number().int().nonnegative(),
  table_count: z.number().int().nonnegative(),
  chart_count: z.number().int().nonnegative(),
  caption_count: z.number().int().nonnegative(),
  rendered_page_refs: z.array(z.string()),
  page_structure: z.array(z.record(z.unknown())),
  layout_semantics: z.array(z.record(z.unknown())),
  geometry_map: z.array(z.record(z.unknown())).default([]),
  page_semantics: z.array(z.record(z.unknown())).default([]),
  section_hierarchy: z.array(z.record(z.unknown())).default([]),
  block_lineage_map: z.array(z.record(z.unknown())).default([]),
  imported_at: z.string(),
  imported_by: z.string(),
  warning_codes: z.array(z.string())
});

const ScheduledDispatchRecordSchema = z.object({
  dispatch_id: z.string(),
  orchestration_ref: z.string(),
  schedule_id: z.string(),
  report_id: z.string(),
  dispatcher_ref: z.string(),
  due_at: z.string(),
  queued_at: z.string(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  refresh_job_ref: z.string().nullable(),
  publication_ref: z.string().nullable(),
  degraded_publication_ref: z.string().nullable(),
  transport_delivery_refs: z.array(z.string()),
  dispatch_target_ref: z.string().nullable(),
  state: z.enum(["queued", "running", "retrying", "completed", "failed", "degraded"]),
  attempt_count: z.number().int().positive(),
  max_attempts: z.number().int().positive(),
  next_retry_at: z.string().nullable(),
  error_message: z.string().nullable(),
  failure_history: z.array(
    z.object({
      attempt_number: z.number().int().positive(),
      error_message: z.string(),
      failed_at: z.string()
    })
  )
});

const ReportBackSyncRecordSchema = z.object({
  sync_id: z.string(),
  report_id: z.string(),
  downstream_capability: z.enum(["presentations", "dashboards"]),
  downstream_ref: z.string(),
  downstream_publication_ref: z.string().nullable(),
  downstream_version_ref: z.string().nullable().default(null),
  source_version_ref: z.string(),
  created_version_ref: z.string(),
  matched_section_ref: z.string().nullable().default(null),
  synced_section_refs: z.array(z.string()),
  synced_block_refs: z.array(z.string()),
  removed_block_refs: z.array(z.string()).default([]),
  conflict_refs: z.array(z.string()).default([]),
  change_kinds: z.array(z.string()),
  reconciliation_mode: z.enum(["append_only", "structural_merge", "conflict_preserving"]).default("append_only"),
  merge_summary: z.record(z.unknown()).default({}),
  summary: z.string(),
  synced_at: z.string(),
  synced_by: z.string()
});

const ScheduledOrchestrationRecordSchema = z.object({
  orchestration_id: z.string(),
  schedule_id: z.string(),
  report_id: z.string(),
  policy_snapshot: z.record(z.unknown()),
  dispatch_refs: z.array(z.string()),
  retry_count: z.number().int().nonnegative(),
  state: z.enum(["queued", "running", "completed", "failed", "degraded"]),
  current_state: z
    .enum(["accepted", "queued", "dispatching", "running", "retrying", "publishing", "completed", "failed", "degraded"])
    .default("queued"),
  remote_dispatch_ref: z.string().nullable().default(null),
  queue_ref: z.string().nullable().default(null),
  state_history: z
    .array(
      z.object({
        state: z.string(),
        entered_at: z.string(),
        detail: z.string().default("")
      })
    )
    .default([]),
  attempt_history: z
    .array(
      z.object({
        attempt_number: z.number().int().positive(),
        state: z.string(),
        dispatch_ref: z.string().nullable().default(null),
        remote_dispatch_ref: z.string().nullable().default(null),
        started_at: z.string(),
        finished_at: z.string().nullable().default(null),
        detail: z.string().default("")
      })
    )
    .default([]),
  degrade_reason: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  completed_at: z.string().nullable()
});

const ReportTransportDeliveryRecordSchema = z.object({
  delivery_id: z.string(),
  report_id: z.string(),
  dispatch_id: z.string().nullable(),
  publication_id: z.string().nullable(),
  target_ref: z.string(),
  backend_ref: z.string().nullable(),
  remote_transport_ref: z.string().nullable().default(null),
  served_target_url: z.string().nullable(),
  delivery_mode: z.enum(["served_http", "backend_bundle", "degraded_export"]),
  access_mode: z.enum(["read_only", "editable", "shared"]).nullable(),
  state: z.enum(["queued", "dispatched", "delivered", "failed", "degraded"]),
  lifecycle_state: z.enum(["prepared", "dispatched", "delivered", "consumed", "expired", "degraded"]).default("prepared"),
  access_state_ref: z.string().nullable().default(null),
  delivery_receipt_ref: z.string().nullable().default(null),
  failure_reason: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string()
});

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

const ensureDirectory = (directoryPath: string): void => {
  fs.mkdirSync(directoryPath, { recursive: true });
};

const hashContent = (content: string): string => createHash("sha256").update(content).digest("hex");
const orchestrationsIdSafe = (value: string): string => value.replace(/[^a-zA-Z0-9_-]+/g, "-");

const writeJson = (filePath: string, payload: unknown) => {
  ensureDirectory(path.dirname(filePath));
  const content = JSON.stringify(payload, null, 2);
  fs.writeFileSync(filePath, `${content}\n`, "utf8");
  return {
    filePath,
    uri: pathToFileURL(filePath).href,
    checksum: `sha256:${hashContent(content)}`
  };
};

const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;

export const defaultReportEngineStorageRoot = (root = process.cwd()): string =>
  path.join(root, ".runtime", "report-engine");

export const defaultReportEngineBackendRoot = (root = process.cwd()): string =>
  path.join(root, ".runtime", "report-engine-backend");

export class ReportEngineStore {
  readonly rootDir: string;
  readonly backendRoot: string;

  constructor(rootDir = defaultReportEngineStorageRoot(), backendRoot = defaultReportEngineBackendRoot()) {
    this.rootDir = rootDir;
    this.backendRoot = backendRoot;
    ensureDirectory(this.rootDir);
    ensureDirectory(this.backendRoot);
  }

  private reportRoot(reportId: string): string {
    return path.join(this.rootDir, "reports", reportId);
  }

  private reportFile(reportId: string, folder: string, filename: string): string {
    return path.join(this.reportRoot(reportId), folder, filename);
  }

  private scheduleRoot(): string {
    return path.join(this.rootDir, "schedules");
  }

  private scheduleFile(scheduleId: string): string {
    return path.join(this.scheduleRoot(), `${scheduleId}.json`);
  }

  private artifactFile(reportId: string, artifactId: string): string {
    return this.reportFile(reportId, "artifacts", `${artifactId}.json`);
  }

  private publicationFile(reportId: string, publicationId: string): string {
    return this.reportFile(reportId, "publications", `${publicationId}.json`);
  }

  private libraryAssetFile(reportId: string, assetId: string): string {
    return this.reportFile(reportId, "library", `${assetId}.json`);
  }

  private canonicalFile(reportId: string, canonicalId: string): string {
    return this.reportFile(reportId, "canonical", `${canonicalId}.json`);
  }

  private currentStateFile(reportId: string): string {
    return this.reportFile(reportId, "state", "current.json");
  }

  private currentEditableArtifactFile(reportId: string): string {
    return this.reportFile(reportId, "state", "editable-report.json");
  }

  private versionSnapshotFile(reportId: string, versionId: string): string {
    return this.reportFile(reportId, "versions", `${versionId}.json`);
  }

  private ingestRecordFile(reportId: string, ingestId: string): string {
    return this.reportFile(reportId, "ingest", `${ingestId}.json`);
  }

  private dispatchRecordFile(reportId: string, dispatchId: string): string {
    return this.reportFile(reportId, "dispatches", `${dispatchId}.json`);
  }

  private backSyncRecordFile(reportId: string, syncId: string): string {
    return this.reportFile(reportId, "back-sync", `${syncId}.json`);
  }

  private orchestrationRecordFile(reportId: string, orchestrationId: string): string {
    return this.reportFile(reportId, "orchestrations", `${orchestrationId}.json`);
  }

  private transportDeliveryFile(reportId: string, deliveryId: string): string {
    return this.reportFile(reportId, "transport-deliveries", `${deliveryId}.json`);
  }

  private publicationTransportFile(reportId: string, publicationId: string, filename: string): string {
    return this.reportFile(reportId, path.join("transport", publicationId), filename);
  }

  private backendPublicationFile(publicationId: string, filename: string): string {
    return path.join(this.backendRoot, "publications", publicationId, filename);
  }

  private backendSchedulerFile(orchestrationId: string, filename: string): string {
    return path.join(this.backendRoot, "scheduler", orchestrationsIdSafe(orchestrationId), filename);
  }

  private writeArtifact(reportId: string, artifact: Artifact): Artifact {
    writeJson(this.artifactFile(reportId, artifact.artifact_id), ArtifactSchema.parse(artifact));
    return artifact;
  }

  persistState(state: PersistableReportState, stage: StoredExecutionStage): PersistableReportState {
    const reportId = state.report.report_id;
    const baseSnapshot = PersistedReportStateSchema.parse({
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
    const reportArtifact = ArtifactSchema.parse({
      ...state.reportArtifact,
      storage_ref: {
        ...state.reportArtifact.storage_ref,
        uri: currentArtifactWrite.uri,
        checksum: currentArtifactWrite.checksum,
        region: "local"
      }
    });
    const versionArtifact = ArtifactSchema.parse({
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
    writeJson(this.currentStateFile(reportId), PersistedReportStateSchema.parse({
      ...baseSnapshot,
      updated_at: persisted.report.updated_at
    }));
    writeJson(this.canonicalFile(reportId, persisted.canonical.canonical_id), CanonicalRepresentationSchema.parse(persisted.canonical));
    this.writeArtifact(reportId, persisted.reportArtifact);
    this.writeArtifact(reportId, persisted.versionArtifact);
    persisted.derivedArtifacts.forEach((artifact) => this.writeArtifact(reportId, artifact));
    persisted.publications.forEach((publication) =>
      writeJson(this.publicationFile(reportId, publication.publication_id), PublicationSchema.parse(publication))
    );
    persisted.libraryAssets.forEach((asset) =>
      writeJson(this.libraryAssetFile(reportId, asset.asset_id), LibraryAssetSchema.parse(asset))
    );
    persisted.schedules.forEach((schedule) =>
      writeJson(this.scheduleFile(schedule.schedule_id), SharedScheduleSchema.parse(schedule))
    );
    writeJson(this.reportFile(reportId, "jobs", `${stage.job.job_id}.json`), JobSchema.parse(stage.job));
    writeJson(
      this.reportFile(reportId, "evidence", `${stage.evidencePack.evidence_pack_id}.json`),
      EvidencePackSchema.parse(stage.evidencePack)
    );
    stage.auditEvents.forEach((event) =>
      writeJson(this.reportFile(reportId, "audit", `${event.event_id}.json`), AuditEventSchema.parse(event))
    );
    stage.lineageEdges.forEach((edge) =>
      writeJson(this.reportFile(reportId, "lineage", `${edge.edge_id}.json`), edge)
    );
    return persisted;
  }

  writeAuxiliaryArtifact(reportId: string, artifact: Artifact, relativePath: string, payload: string | Uint8Array): Artifact {
    const targetPath = this.reportFile(reportId, "artifacts-data", relativePath);
    ensureDirectory(path.dirname(targetPath));
    if (typeof payload === "string") {
      fs.writeFileSync(targetPath, payload, "utf8");
    } else {
      fs.writeFileSync(targetPath, Buffer.from(payload));
    }
    const content = typeof payload === "string" ? payload : Buffer.from(payload).toString("binary");
    const persisted = ArtifactSchema.parse({
      ...artifact,
      storage_ref: {
        ...artifact.storage_ref,
        uri: pathToFileURL(targetPath).href,
        checksum: `sha256:${hashContent(content)}`,
        region: "local"
      }
    });
    this.writeArtifact(reportId, persisted);
    return persisted;
  }

  loadState(reportId: string): PersistableReportState {
    const state = PersistedReportStateSchema.parse(readJson<PersistedReportState>(this.currentStateFile(reportId)));
    const readArtifact = (artifactId: string) => ArtifactSchema.parse(readJson<Artifact>(this.artifactFile(reportId, artifactId)));
    const readPublication = (publicationId: string) =>
      PublicationSchema.parse(readJson<Publication>(this.publicationFile(reportId, publicationId)));
    const readAsset = (assetId: string) =>
      LibraryAssetSchema.parse(readJson<LibraryAsset>(this.libraryAssetFile(reportId, assetId)));
    const readSchedule = (scheduleId: string) =>
      SharedScheduleSchema.parse(readJson<SharedSchedule>(this.scheduleFile(scheduleId)));
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

  loadVersionSnapshot(reportId: string, versionId: string): PersistedReportState {
    return PersistedReportStateSchema.parse(readJson<PersistedReportState>(this.versionSnapshotFile(reportId, versionId)));
  }

  listVersionSnapshots(reportId: string): PersistedReportState[] {
    const directory = this.reportFile(reportId, "versions", "");
    if (!fs.existsSync(directory)) {
      return [];
    }
    return fs
      .readdirSync(directory)
      .filter((entry) => entry.endsWith(".json"))
      .map((entry) => PersistedReportStateSchema.parse(readJson<PersistedReportState>(path.join(directory, entry))))
      .sort((left, right) => left.version.version_ref.version_number - right.version.version_ref.version_number);
  }

  listReportIds(): string[] {
    const directory = path.join(this.rootDir, "reports");
    if (!fs.existsSync(directory)) {
      return [];
    }
    return fs
      .readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  }

  listSchedules(): SharedSchedule[] {
    if (!fs.existsSync(this.scheduleRoot())) return [];
    return fs
      .readdirSync(this.scheduleRoot())
      .filter((entry) => entry.endsWith(".json"))
      .map((entry) => SharedScheduleSchema.parse(readJson<SharedSchedule>(path.join(this.scheduleRoot(), entry))));
  }

  loadSchedule(scheduleId: string): SharedSchedule | null {
    const filePath = this.scheduleFile(scheduleId);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return SharedScheduleSchema.parse(readJson<SharedSchedule>(filePath));
  }

  saveIngestRecord(record: ExternalIngestRecord): ExternalIngestRecord {
    const parsed = ExternalIngestRecordSchema.parse(record);
    writeJson(this.ingestRecordFile(parsed.report_id, parsed.ingest_id), parsed);
    return parsed;
  }

  listIngestRecords(reportId: string): ExternalIngestRecord[] {
    const directory = this.reportFile(reportId, "ingest", "");
    if (!fs.existsSync(directory)) {
      return [];
    }
    return fs
      .readdirSync(directory)
      .filter((entry) => entry.endsWith(".json"))
      .map((entry) => ExternalIngestRecordSchema.parse(readJson<ExternalIngestRecord>(path.join(directory, entry))));
  }

  saveDispatchRecord(record: ScheduledDispatchRecord): ScheduledDispatchRecord {
    const parsed = ScheduledDispatchRecordSchema.parse(record);
    writeJson(this.dispatchRecordFile(parsed.report_id, parsed.dispatch_id), parsed);
    return parsed;
  }

  listDispatchRecords(reportId: string): ScheduledDispatchRecord[] {
    const directory = this.reportFile(reportId, "dispatches", "");
    if (!fs.existsSync(directory)) {
      return [];
    }
    return fs
      .readdirSync(directory)
      .filter((entry) => entry.endsWith(".json"))
      .map((entry) => ScheduledDispatchRecordSchema.parse(readJson<ScheduledDispatchRecord>(path.join(directory, entry))));
  }

  saveBackSyncRecord(record: ReportBackSyncRecord): ReportBackSyncRecord {
    const parsed = ReportBackSyncRecordSchema.parse(record);
    writeJson(this.backSyncRecordFile(parsed.report_id, parsed.sync_id), parsed);
    return parsed;
  }

  listBackSyncRecords(reportId: string): ReportBackSyncRecord[] {
    const directory = this.reportFile(reportId, "back-sync", "");
    if (!fs.existsSync(directory)) {
      return [];
    }
    return fs
      .readdirSync(directory)
      .filter((entry) => entry.endsWith(".json"))
      .map((entry) => ReportBackSyncRecordSchema.parse(readJson<ReportBackSyncRecord>(path.join(directory, entry))));
  }

  saveOrchestrationRecord(record: ScheduledOrchestrationRecord): ScheduledOrchestrationRecord {
    const parsed = ScheduledOrchestrationRecordSchema.parse(record);
    writeJson(this.orchestrationRecordFile(parsed.report_id, parsed.orchestration_id), parsed);
    return parsed;
  }

  listOrchestrationRecords(reportId: string): ScheduledOrchestrationRecord[] {
    const directory = this.reportFile(reportId, "orchestrations", "");
    if (!fs.existsSync(directory)) {
      return [];
    }
    return fs
      .readdirSync(directory)
      .filter((entry) => entry.endsWith(".json"))
      .map((entry) =>
        ScheduledOrchestrationRecordSchema.parse(readJson<ScheduledOrchestrationRecord>(path.join(directory, entry)))
      );
  }

  saveTransportDeliveryRecord(record: ReportTransportDeliveryRecord): ReportTransportDeliveryRecord {
    const parsed = ReportTransportDeliveryRecordSchema.parse(record);
    writeJson(this.transportDeliveryFile(parsed.report_id, parsed.delivery_id), parsed);
    return parsed;
  }

  listTransportDeliveryRecords(reportId: string): ReportTransportDeliveryRecord[] {
    const directory = this.reportFile(reportId, "transport-deliveries", "");
    if (!fs.existsSync(directory)) {
      return [];
    }
    return fs
      .readdirSync(directory)
      .filter((entry) => entry.endsWith(".json"))
      .map((entry) =>
        ReportTransportDeliveryRecordSchema.parse(readJson<ReportTransportDeliveryRecord>(path.join(directory, entry)))
      );
  }

  writePublicationTransportJson(
    reportId: string,
    publicationId: string,
    filename: string,
    payload: unknown
  ): { filePath: string; uri: string; checksum: string } {
    return writeJson(this.publicationTransportFile(reportId, publicationId, filename), payload);
  }

  writePublicationTransportText(
    reportId: string,
    publicationId: string,
    filename: string,
    content: string
  ): { filePath: string; uri: string; checksum: string } {
    ensureDirectory(path.dirname(this.publicationTransportFile(reportId, publicationId, filename)));
    fs.writeFileSync(this.publicationTransportFile(reportId, publicationId, filename), content, "utf8");
    return {
      filePath: this.publicationTransportFile(reportId, publicationId, filename),
      uri: pathToFileURL(this.publicationTransportFile(reportId, publicationId, filename)).href,
      checksum: `sha256:${hashContent(content)}`
    };
  }

  writeBackendPublicationJson(
    publicationId: string,
    filename: string,
    payload: unknown
  ): { filePath: string; uri: string; checksum: string } {
    return writeJson(this.backendPublicationFile(publicationId, filename), payload);
  }

  writeBackendPublicationText(
    publicationId: string,
    filename: string,
    content: string
  ): { filePath: string; uri: string; checksum: string } {
    ensureDirectory(path.dirname(this.backendPublicationFile(publicationId, filename)));
    fs.writeFileSync(this.backendPublicationFile(publicationId, filename), content, "utf8");
    return {
      filePath: this.backendPublicationFile(publicationId, filename),
      uri: pathToFileURL(this.backendPublicationFile(publicationId, filename)).href,
      checksum: `sha256:${hashContent(content)}`
    };
  }

  writeBackendSchedulerJson(
    orchestrationId: string,
    filename: string,
    payload: unknown
  ): { filePath: string; uri: string; checksum: string } {
    return writeJson(this.backendSchedulerFile(orchestrationId, filename), payload);
  }

  writeBackendSchedulerText(
      orchestrationId: string,
      filename: string,
      content: string
    ): { filePath: string; uri: string; checksum: string } {
    ensureDirectory(path.dirname(this.backendSchedulerFile(orchestrationId, filename)));
    fs.writeFileSync(this.backendSchedulerFile(orchestrationId, filename), content, "utf8");
    return {
      filePath: this.backendSchedulerFile(orchestrationId, filename),
      uri: pathToFileURL(this.backendSchedulerFile(orchestrationId, filename)).href,
        checksum: `sha256:${hashContent(content)}`
      };
    }

  consumeTransientTransportFailure(targetRef: string): boolean {
    const markerFile = path.join(this.backendRoot, "transient-transport-failures", `${hashContent(targetRef)}.json`);
    if (fs.existsSync(markerFile)) {
      return false;
    }
    writeJson(markerFile, {
      target_ref: targetRef,
      failed_once_at: new Date().toISOString()
    });
    return true;
  }

  listBackendPublicationIds(): string[] {
    const directory = path.join(this.backendRoot, "publications");
    if (!fs.existsSync(directory)) {
      return [];
    }
    return fs
      .readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  }

  loadPublicationRoute(publicationId: string): PersistedReportPublicationRoute | null {
    const manifestPath = this.backendPublicationFile(publicationId, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
      return null;
    }
    const manifest = readJson<{
      publication_id: string;
      report_id: string;
      backend_ref: string;
      access_mode?: "read_only" | "editable" | "shared";
      transport_manifest_path?: string;
      transport_publish_state_path?: string;
      transport_embed_payload_path?: string | null;
      transport_embed_html_path?: string | null;
      transport_export_html_path?: string;
    }>(manifestPath);
    const gatewayManifestPath = this.backendPublicationFile(publicationId, "gateway-manifest.json");
    const gatewayManifest = fs.existsSync(gatewayManifestPath)
      ? readJson<{ gateway_bundle_ref?: string }>(gatewayManifestPath)
      : {};
    const reportId = manifest.report_id;
    const publicationTransportRoot = this.reportFile(reportId, path.join("transport", publicationId), "");
    const route: PersistedReportPublicationRoute = {
      publication_id: manifest.publication_id,
      report_id: reportId,
      manifest_path: manifest.transport_manifest_path ?? path.join(publicationTransportRoot, "manifest.json"),
      publish_state_path: manifest.transport_publish_state_path ?? path.join(publicationTransportRoot, "publish-state.json"),
      embed_payload_path:
        manifest.transport_embed_payload_path ?? path.join(publicationTransportRoot, "embed-payload.json"),
      embed_html_path: manifest.transport_embed_html_path ?? path.join(publicationTransportRoot, "embed.html"),
      export_html_path: manifest.transport_export_html_path ?? path.join(publicationTransportRoot, "published-report.html"),
      access_mode: manifest.access_mode ?? "read_only",
      backend_ref: manifest.backend_ref,
      gateway_bundle_ref: gatewayManifest.gateway_bundle_ref ?? null
    };
    return {
      ...route,
      embed_payload_path: route.embed_payload_path && fs.existsSync(route.embed_payload_path) ? route.embed_payload_path : null,
      embed_html_path: route.embed_html_path && fs.existsSync(route.embed_html_path) ? route.embed_html_path : null
    };
  }
}
