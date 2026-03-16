import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  ArtifactSchema,
  AuditEventSchema,
  CanonicalRepresentationSchema,
  DashboardCompareResultSchema,
  DashboardSchema,
  DashboardVersionSchema,
  EvidencePackSchema,
  JobSchema,
  LibraryAssetSchema,
  PublicationSchema,
  type Artifact,
  type AuditEvent,
  type CanonicalRepresentation,
  type DashboardCompareResult,
  type Dashboard,
  type DashboardVersion,
  type EvidencePack,
  type Job,
  type LibraryAsset,
  type LineageEdge,
  type Publication
} from "@rasid/contracts";
import { z } from "zod";
import type { DashboardPublicationTransport } from "./index";

const PersistedDashboardStateSchema = z.object({
  dashboard: DashboardSchema,
  version: DashboardVersionSchema,
  dashboard_artifact_ref: z.string(),
  version_artifact_ref: z.string(),
  canonical_ref: z.string(),
  version_canonical_ref: z.string(),
  updated_at: z.string()
});

const PersistedCompareStateSchema = z.object({
  compare_id: z.string(),
  dashboard_id: z.string(),
  diff_artifact_ref: z.string(),
  base_version_ref: z.string(),
  target_version_ref: z.string(),
  updated_at: z.string(),
  payload: z.record(z.unknown())
});

const ScheduledRefreshEntrySchema = z.object({
  schedule_id: z.string(),
  dashboard_id: z.string(),
  dashboard_ref: z.string(),
  version_ref: z.string(),
  actor_ref: z.string(),
  refresh_binding_refs: z.array(z.string()),
  schedule_kind: z.enum(["manual", "hourly", "daily", "weekly", "monthly"]),
  schedule_ref: z.string(),
  stale_after_minutes: z.number().int().nonnegative(),
  due_at: z.string(),
  next_due_at: z.string(),
  status: z.enum(["scheduled", "running", "failed"]),
  last_run_at: z.string().nullable(),
  last_job_ref: z.string().nullable(),
  last_runner_job_ref: z.string().nullable(),
  updated_at: z.string(),
  error_message: z.string().nullable()
});

const ScheduledRefreshRunnerJobSchema = z.object({
  runner_job_id: z.string(),
  schedule_id: z.string(),
  dashboard_id: z.string(),
  dashboard_version_ref: z.string(),
  refresh_job_ref: z.string().nullable(),
  evidence_ref: z.string().nullable(),
  due_at: z.string(),
  queued_at: z.string(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
  state: z.enum(["queued", "running", "completed", "failed"]),
  output_version_ref: z.string().nullable(),
  error_message: z.string().nullable()
});

export type PersistedDashboardState = z.infer<typeof PersistedDashboardStateSchema>;
export type ScheduledRefreshEntry = z.infer<typeof ScheduledRefreshEntrySchema>;
export type ScheduledRefreshRunnerJob = z.infer<typeof ScheduledRefreshRunnerJobSchema>;

export type StoredWorkflowResult = {
  dashboard: Dashboard;
  version: DashboardVersion;
  dashboardArtifact: Artifact;
  versionArtifact: Artifact;
  canonical: CanonicalRepresentation;
  versionCanonical: CanonicalRepresentation;
  job: Job;
  evidencePack: EvidencePack;
  auditEvents: AuditEvent[];
  lineageEdges: LineageEdge[];
};

export type StoredPublicationResult = {
  dashboard: Dashboard;
  version: DashboardVersion;
  publication: Publication;
  libraryAsset: LibraryAsset | null;
  transport: DashboardPublicationTransport;
  job: Job;
  evidencePack: EvidencePack;
  auditEvents: AuditEvent[];
  lineageEdges: LineageEdge[];
};

export type StoredCompareBundle = {
  compareResult: DashboardCompareResult;
  diffArtifact: Artifact;
  job: Job;
  evidencePack: EvidencePack;
  auditEvents: AuditEvent[];
  lineageEdges: LineageEdge[];
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const ensureDirectory = (directoryPath: string): void => {
  fs.mkdirSync(directoryPath, { recursive: true });
};

const hashContent = (content: string): string => createHash("sha256").update(content).digest("hex");

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

const writeText = (filePath: string, content: string) => {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
  return {
    filePath,
    uri: pathToFileURL(filePath).href,
    checksum: `sha256:${hashContent(content)}`
  };
};

const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;

const readJsonArray = <T>(directory: string, parser: (value: unknown) => T): T[] => {
  if (!fs.existsSync(directory)) {
    return [];
  }
  return fs
    .readdirSync(directory)
    .filter((fileName) => fileName.endsWith(".json"))
    .map((fileName) => parser(readJson(path.join(directory, fileName))))
    .sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
};

export const defaultDashboardEngineStorageRoot = (root = process.cwd()): string =>
  path.join(root, ".runtime", "dashboard-engine");

export class DashboardEngineStore {
  readonly rootDir: string;

  constructor(rootDir = defaultDashboardEngineStorageRoot()) {
    this.rootDir = rootDir;
    ensureDirectory(this.rootDir);
  }

  private dashboardRoot(dashboardId: string): string {
    return path.join(this.rootDir, "dashboards", dashboardId);
  }

  private dashboardFile(dashboardId: string, folder: string, filename: string): string {
    return path.join(this.dashboardRoot(dashboardId), folder, filename);
  }

  private schedulesRoot(): string {
    return path.join(this.rootDir, "schedules");
  }

  private scheduleFile(dashboardId: string): string {
    return path.join(this.schedulesRoot(), `${dashboardId}.json`);
  }

  private publicationTransportFile(dashboardId: string, publicationId: string, filename: string): string {
    return this.dashboardFile(dashboardId, path.join("publications", publicationId), filename);
  }

  private backendRoot(): string {
    return path.join(this.rootDir, "..", "dashboard-engine-backend");
  }

  private backendPublicationFile(publicationId: string, filename: string): string {
    return path.join(this.backendRoot(), "publications", publicationId, filename);
  }

  private writeArtifactMetadata(dashboardId: string, artifact: Artifact): Artifact {
    const metadataPath = this.dashboardFile(dashboardId, "artifacts", `${artifact.artifact_id}.json`);
    writeJson(metadataPath, ArtifactSchema.parse(artifact));
    return artifact;
  }

  private writeDashboardState(dashboardId: string, result: StoredWorkflowResult | StoredPublicationResult) {
    const state = PersistedDashboardStateSchema.parse({
      dashboard: result.dashboard,
      version: result.version,
      dashboard_artifact_ref: "dashboardArtifact" in result ? result.dashboardArtifact.artifact_id : result.version.snapshot_artifact_ref,
      version_artifact_ref: "versionArtifact" in result ? result.versionArtifact.artifact_id : result.version.snapshot_artifact_ref,
      canonical_ref: "canonical" in result ? result.canonical.canonical_id : result.dashboard.canonical_ref,
      version_canonical_ref: "versionCanonical" in result ? result.versionCanonical.canonical_id : result.version.snapshot_canonical_ref,
      updated_at: result.dashboard.updated_at
    });
    return writeJson(this.dashboardFile(dashboardId, "state", "current.json"), state);
  }

  persistWorkflow(result: StoredWorkflowResult): StoredWorkflowResult {
    const dashboardId = result.dashboard.dashboard_id;
    const currentStatePath = this.dashboardFile(dashboardId, "state", "current-dashboard.json");
    const versionStatePath = this.dashboardFile(dashboardId, "versions", `${result.version.version_id}.json`);
    const currentStateWrite = writeJson(currentStatePath, {
      dashboard: result.dashboard,
      version: result.version,
      widgets: result.dashboard.widgets,
      bindings: result.dashboard.bindings,
      pages: result.dashboard.pages,
      layout_items: result.dashboard.layout_items,
      filter_sets: result.dashboard.filter_sets,
      interaction_rules: result.dashboard.interaction_rules
    });
    const versionStateWrite = writeJson(versionStatePath, {
      dashboard: result.dashboard,
      version: result.version,
      widgets: result.dashboard.widgets,
      bindings: result.dashboard.bindings,
      pages: result.dashboard.pages,
      layout_items: result.dashboard.layout_items,
      filter_sets: result.dashboard.filter_sets,
      interaction_rules: result.dashboard.interaction_rules
    });
    const dashboardArtifact = ArtifactSchema.parse({
      ...clone(result.dashboardArtifact),
      storage_ref: {
        ...result.dashboardArtifact.storage_ref,
        uri: currentStateWrite.uri,
        checksum: currentStateWrite.checksum,
        region: "local"
      }
    });
    const versionArtifact = ArtifactSchema.parse({
      ...clone(result.versionArtifact),
      storage_ref: {
        ...result.versionArtifact.storage_ref,
        uri: versionStateWrite.uri,
        checksum: versionStateWrite.checksum,
        region: "local"
      }
    });
    writeJson(this.dashboardFile(dashboardId, "canonical", `${result.canonical.canonical_id}.json`), CanonicalRepresentationSchema.parse(result.canonical));
    writeJson(this.dashboardFile(dashboardId, "canonical", `${result.versionCanonical.canonical_id}.json`), CanonicalRepresentationSchema.parse(result.versionCanonical));
    this.writeArtifactMetadata(dashboardId, dashboardArtifact);
    this.writeArtifactMetadata(dashboardId, versionArtifact);
    writeJson(this.dashboardFile(dashboardId, "jobs", `${result.job.job_id}.json`), JobSchema.parse(result.job));
    writeJson(this.dashboardFile(dashboardId, "evidence", `${result.evidencePack.evidence_pack_id}.json`), EvidencePackSchema.parse(result.evidencePack));
    result.auditEvents.forEach((event) =>
      writeJson(this.dashboardFile(dashboardId, "audit", `${event.event_id}.json`), AuditEventSchema.parse(event))
    );
    result.lineageEdges.forEach((edge) =>
      writeJson(this.dashboardFile(dashboardId, "lineage", `${edge.edge_id}.json`), edge)
    );
    writeJson(this.dashboardFile(dashboardId, "versions", `${result.version.version_id}.meta.json`), DashboardVersionSchema.parse(result.version));
    this.writeDashboardState(dashboardId, result);
    return {
      ...result,
      dashboardArtifact,
      versionArtifact
    };
  }

  persistPublication(result: StoredPublicationResult): StoredPublicationResult {
    const dashboardId = result.dashboard.dashboard_id;
    const backendRef = `backend://dashboard-engine/publications/${result.publication.publication_id}`;
    const versionStatePath = this.dashboardFile(dashboardId, "versions", `${result.version.version_id}.json`);
    writeJson(versionStatePath, {
      dashboard: result.dashboard,
      version: result.version,
      publication: result.publication,
      library_asset: result.libraryAsset,
      backend_ref: backendRef
    });
    writeJson(this.dashboardFile(dashboardId, "publications", `${result.publication.publication_id}.json`), PublicationSchema.parse(result.publication));
    writeJson(this.dashboardFile(dashboardId, "publications", `${result.publication.publication_id}.transport.json`), result.transport);
    const backendManifest = writeJson(this.backendPublicationFile(result.publication.publication_id, "manifest.json"), {
      backend_ref: backendRef,
      publication_id: result.publication.publication_id,
      dashboard_id: dashboardId,
      version_id: result.version.version_id,
      artifact_ref: result.publication.artifact_ref,
      publication_record_path: this.dashboardFile(dashboardId, "publications", `${result.publication.publication_id}.json`),
      transport_record_path: this.dashboardFile(dashboardId, "publications", `${result.publication.publication_id}.transport.json`),
      manifest_path: result.transport.manifest_path,
      publish_state_path: result.transport.publish_state_path,
      embed_payload_path: result.transport.embed_payload_path,
      embed_html_path: result.transport.embed_html_path,
      served_manifest_url: result.transport.served_manifest_url,
      served_publish_state_url: result.transport.served_publish_state_url,
      served_embed_payload_url: result.transport.served_embed_payload_url,
      served_embed_html_url: result.transport.served_embed_html_url,
      served_access_token: result.transport.served_access_token,
      access_mode: result.transport.access_mode,
      updated_at: result.job.finished_at ?? result.job.started_at
    });
    writeJson(path.join(this.backendRoot(), "publication-index.json"), {
      latest_publication_id: result.publication.publication_id,
      backend_ref: backendRef,
      backend_manifest_path: backendManifest.filePath,
      dashboard_id: dashboardId,
      artifact_ref: result.publication.artifact_ref,
      updated_at: result.job.finished_at ?? result.job.started_at
    });
    if (result.libraryAsset) {
      writeJson(this.dashboardFile(dashboardId, "library", `${result.libraryAsset.asset_id}.json`), LibraryAssetSchema.parse(result.libraryAsset));
    }
    writeJson(this.dashboardFile(dashboardId, "jobs", `${result.job.job_id}.json`), JobSchema.parse(result.job));
    writeJson(this.dashboardFile(dashboardId, "evidence", `${result.evidencePack.evidence_pack_id}.json`), EvidencePackSchema.parse(result.evidencePack));
    result.auditEvents.forEach((event) =>
      writeJson(this.dashboardFile(dashboardId, "audit", `${event.event_id}.json`), AuditEventSchema.parse(event))
    );
    result.lineageEdges.forEach((edge) =>
      writeJson(this.dashboardFile(dashboardId, "lineage", `${edge.edge_id}.json`), edge)
    );
    this.writeDashboardState(dashboardId, result);
    return result;
  }

  persistCompare(bundle: StoredCompareBundle, payload: Record<string, unknown>): StoredCompareBundle {
    const dashboardId = bundle.compareResult.dashboard_ref;
    const diffPath = this.dashboardFile(dashboardId, "compare", `${bundle.compareResult.compare_id}.json`);
    const diffWrite = writeJson(
      diffPath,
      DashboardCompareResultSchema.parse(bundle.compareResult)
    );
    const diffArtifact = ArtifactSchema.parse({
      ...clone(bundle.diffArtifact),
      storage_ref: {
        ...bundle.diffArtifact.storage_ref,
        uri: diffWrite.uri,
        checksum: diffWrite.checksum,
        region: "local"
      }
    });
    this.writeArtifactMetadata(dashboardId, diffArtifact);
    writeJson(
      this.dashboardFile(dashboardId, "compare", `${bundle.compareResult.compare_id}.meta.json`),
      PersistedCompareStateSchema.parse({
        compare_id: bundle.compareResult.compare_id,
        dashboard_id: dashboardId,
        diff_artifact_ref: bundle.compareResult.diff_artifact_ref,
        base_version_ref: bundle.compareResult.base_version_ref,
        target_version_ref: bundle.compareResult.target_version_ref,
        updated_at: bundle.job.finished_at ?? bundle.job.started_at,
        payload
      })
    );
    writeJson(this.dashboardFile(dashboardId, "jobs", `${bundle.job.job_id}.json`), JobSchema.parse(bundle.job));
    writeJson(this.dashboardFile(dashboardId, "evidence", `${bundle.evidencePack.evidence_pack_id}.json`), EvidencePackSchema.parse(bundle.evidencePack));
    bundle.auditEvents.forEach((event) =>
      writeJson(this.dashboardFile(dashboardId, "audit", `${event.event_id}.json`), AuditEventSchema.parse(event))
    );
    bundle.lineageEdges.forEach((edge) =>
      writeJson(this.dashboardFile(dashboardId, "lineage", `${edge.edge_id}.json`), edge)
    );
    return {
      ...bundle,
      diffArtifact
    };
  }

  loadDashboardState(dashboardId: string): PersistedDashboardState {
    return PersistedDashboardStateSchema.parse(readJson(this.dashboardFile(dashboardId, "state", "current.json")));
  }

  loadDashboardVersion(dashboardId: string, versionId: string): { dashboard: Dashboard; version: DashboardVersion } {
    const payload = readJson<{ dashboard: Dashboard; version: DashboardVersion }>(
      this.dashboardFile(dashboardId, "versions", `${versionId}.json`)
    );
    return {
      dashboard: DashboardSchema.parse(payload.dashboard),
      version: DashboardVersionSchema.parse(payload.version)
    };
  }

  saveSchedule(entry: ScheduledRefreshEntry): ScheduledRefreshEntry {
    const schedule = ScheduledRefreshEntrySchema.parse(entry);
    writeJson(this.scheduleFile(schedule.dashboard_id), schedule);
    return schedule;
  }

  loadSchedule(dashboardId: string): ScheduledRefreshEntry | null {
    const filePath = this.scheduleFile(dashboardId);
    if (!fs.existsSync(filePath)) {
      return null;
    }
    return ScheduledRefreshEntrySchema.parse(readJson(filePath));
  }

  listSchedules(): ScheduledRefreshEntry[] {
    const directory = this.schedulesRoot();
    if (!fs.existsSync(directory)) {
      return [];
    }
    return fs
      .readdirSync(directory)
      .filter((fileName) => fileName.endsWith(".json"))
      .map((fileName) => ScheduledRefreshEntrySchema.parse(readJson(path.join(directory, fileName))));
  }

  listDueSchedules(at: string): ScheduledRefreshEntry[] {
    const cutoff = new Date(at).getTime();
    return this.listSchedules()
      .filter((entry) => entry.status === "scheduled")
      .filter((entry) => new Date(entry.due_at).getTime() <= cutoff);
  }

  saveRunnerJob(job: ScheduledRefreshRunnerJob): ScheduledRefreshRunnerJob {
    const parsed = ScheduledRefreshRunnerJobSchema.parse(job);
    writeJson(this.dashboardFile(parsed.dashboard_id, "runner-jobs", `${parsed.runner_job_id}.json`), parsed);
    return parsed;
  }

  loadRunnerJob(dashboardId: string, runnerJobId: string): ScheduledRefreshRunnerJob {
    return ScheduledRefreshRunnerJobSchema.parse(
      readJson(this.dashboardFile(dashboardId, "runner-jobs", `${runnerJobId}.json`))
    );
  }

  listRunnerJobs(dashboardId: string): ScheduledRefreshRunnerJob[] {
    const directory = this.dashboardFile(dashboardId, "runner-jobs", "");
    if (!fs.existsSync(directory)) {
      return [];
    }
    return fs
      .readdirSync(directory)
      .filter((fileName) => fileName.endsWith(".json"))
      .map((fileName) => ScheduledRefreshRunnerJobSchema.parse(readJson(path.join(directory, fileName))));
  }

  writePublicationTransportJson(
    dashboardId: string,
    publicationId: string,
    filename: string,
    payload: unknown
  ): { filePath: string; uri: string; checksum: string } {
    return writeJson(this.publicationTransportFile(dashboardId, publicationId, filename), payload);
  }

  writePublicationTransportText(
    dashboardId: string,
    publicationId: string,
    filename: string,
    content: string
  ): { filePath: string; uri: string; checksum: string } {
    return writeText(this.publicationTransportFile(dashboardId, publicationId, filename), content);
  }

  loadPublicationTransport(publicationId: string): DashboardPublicationTransport | null {
    const filePath = this.backendPublicationFile(publicationId, "manifest.json");
    if (!fs.existsSync(filePath)) {
      return null;
    }
    const manifest = readJson<{
      transport_record_path: string;
    }>(filePath);
    return readJson<DashboardPublicationTransport>(manifest.transport_record_path);
  }

  listDashboardIds(): string[] {
    const dashboardsRoot = path.join(this.rootDir, "dashboards");
    if (!fs.existsSync(dashboardsRoot)) {
      return [];
    }
    return fs
      .readdirSync(dashboardsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  }

  listDashboardStates(): PersistedDashboardState[] {
    return this.listDashboardIds().map((dashboardId) => this.loadDashboardState(dashboardId));
  }

  listEvidencePacks(dashboardId: string): EvidencePack[] {
    return readJsonArray(this.dashboardFile(dashboardId, "evidence", ""), (value) => EvidencePackSchema.parse(value));
  }

  listAuditEvents(dashboardId: string): AuditEvent[] {
    return readJsonArray(this.dashboardFile(dashboardId, "audit", ""), (value) => AuditEventSchema.parse(value));
  }

  listLineageEdges(dashboardId: string): LineageEdge[] {
    return readJsonArray(this.dashboardFile(dashboardId, "lineage", ""), (value) => value as LineageEdge);
  }

  listPublications(dashboardId: string): Publication[] {
    const directory = this.dashboardFile(dashboardId, "publications", "");
    if (!fs.existsSync(directory)) {
      return [];
    }
    return fs
      .readdirSync(directory)
      .filter((fileName) => fileName.endsWith(".json") && !fileName.endsWith(".transport.json"))
      .map((fileName) => PublicationSchema.parse(readJson(path.join(directory, fileName))));
  }

  listCompareResults(dashboardId: string): DashboardCompareResult[] {
    const directory = this.dashboardFile(dashboardId, "compare", "");
    if (!fs.existsSync(directory)) {
      return [];
    }
    return fs
      .readdirSync(directory)
      .filter((fileName) => fileName.endsWith(".json") && !fileName.endsWith(".meta.json"))
      .map((fileName) => DashboardCompareResultSchema.parse(readJson(path.join(directory, fileName))));
  }

  loadLatestPublication(dashboardId: string): Publication | null {
    const publications = this.listPublications(dashboardId);
    if (publications.length === 0) {
      return null;
    }
    const ordered = publications.sort((left, right) => left.published_at.localeCompare(right.published_at));
    return ordered[ordered.length - 1] ?? null;
  }
}
