import fs from "node:fs";
import path from "node:path";
import type {
  AiExecutionPlan,
  AiExecutionRequest,
  AiExecutionSummary,
  AiPageContext,
  Artifact,
  AuditEvent,
  EvidencePack,
  Job,
  LineageEdge
} from "@rasid/contracts";

export type AiSessionState = {
  session_id: string;
  page_path: string;
  tenant_ref: string;
  workspace_id: string;
  project_id: string;
  current_artifact_ref: string | null;
  recent_job_refs: string[];
  recent_output_refs: string[];
  updated_at: string;
};

export type AiPersistedBundle = {
  request: AiExecutionRequest;
  context: AiPageContext;
  plan: AiExecutionPlan;
  summary: AiExecutionSummary;
  phases: unknown[];
  job: Job;
  artifacts: Artifact[];
  evidencePack: EvidencePack;
  auditEvents: AuditEvent[];
  lineageEdges: LineageEdge[];
  open_path: string | null;
  classification?: unknown;
  proactive_analysis?: unknown;
  conversational_query?: unknown;
  forecast?: unknown;
  scenario?: unknown;
  knowledge_graph?: unknown;
  guided_questions?: unknown;
  recipe_ref?: string | null;
};

const ensureDir = (targetPath: string): void => {
  fs.mkdirSync(targetPath, { recursive: true });
};

const writeJson = (filePath: string, payload: unknown): string => {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
};

const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;

export const defaultAiEngineStorageRoot = (root = process.cwd()): string => path.join(root, ".runtime", "ai-engine");

export class AiEngineStore {
  readonly rootDir: string;

  constructor(rootDir = defaultAiEngineStorageRoot()) {
    this.rootDir = rootDir;
    ensureDir(this.rootDir);
  }

  private sessionFile(sessionId: string): string {
    return path.join(this.rootDir, "sessions", `${sessionId}.json`);
  }

  private jobRoot(jobId: string): string {
    return path.join(this.rootDir, "jobs", jobId);
  }

  loadSession(sessionId: string): AiSessionState | null {
    const filePath = this.sessionFile(sessionId);
    return fs.existsSync(filePath) ? readJson<AiSessionState>(filePath) : null;
  }

  persistSession(session: AiSessionState): AiSessionState {
    writeJson(this.sessionFile(session.session_id), session);
    return session;
  }

  persistBundle(bundle: AiPersistedBundle): AiPersistedBundle {
    const root = this.jobRoot(bundle.job.job_id);
    writeJson(path.join(root, "request.json"), bundle.request);
    writeJson(path.join(root, "context.json"), bundle.context);
    writeJson(path.join(root, "plan.json"), bundle.plan);
    writeJson(path.join(root, "summary.json"), bundle.summary);
    writeJson(path.join(root, "phases.json"), bundle.phases);
    writeJson(path.join(root, "job.json"), bundle.job);
    writeJson(path.join(root, "artifacts.json"), bundle.artifacts);
    writeJson(path.join(root, "evidence", `${bundle.evidencePack.evidence_pack_id}.json`), bundle.evidencePack);
    writeJson(path.join(root, "audit", "audit-events.json"), bundle.auditEvents);
    writeJson(path.join(root, "lineage", "lineage-edges.json"), bundle.lineageEdges);
    if (bundle.classification) {
      writeJson(path.join(root, "classification.json"), bundle.classification);
    }
    if (bundle.proactive_analysis) {
      writeJson(path.join(root, "proactive-analysis.json"), bundle.proactive_analysis);
    }
    if (bundle.conversational_query) {
      writeJson(path.join(root, "conversational-query.json"), bundle.conversational_query);
    }
    if (bundle.forecast) {
      writeJson(path.join(root, "forecast.json"), bundle.forecast);
    }
    if (bundle.scenario) {
      writeJson(path.join(root, "scenario.json"), bundle.scenario);
    }
    if (bundle.knowledge_graph) {
      writeJson(path.join(root, "knowledge-graph.json"), bundle.knowledge_graph);
    }
    if (bundle.guided_questions) {
      writeJson(path.join(root, "guided-questions.json"), bundle.guided_questions);
    }
    writeJson(path.join(root, "result.json"), {
      summary_ref: bundle.summary.summary_id,
      artifact_refs: bundle.artifacts.map((artifact) => artifact.artifact_id),
      open_path: bundle.open_path,
      recipe_ref: bundle.recipe_ref ?? null
    });
    return bundle;
  }

  loadBundle(jobId: string): AiPersistedBundle {
    const root = this.jobRoot(jobId);
    return {
      request: readJson<AiExecutionRequest>(path.join(root, "request.json")),
      context: readJson<AiPageContext>(path.join(root, "context.json")),
      plan: readJson<AiExecutionPlan>(path.join(root, "plan.json")),
      summary: readJson<AiExecutionSummary>(path.join(root, "summary.json")),
      phases: readJson<unknown[]>(path.join(root, "phases.json")),
      job: readJson<Job>(path.join(root, "job.json")),
      artifacts: readJson<Artifact[]>(path.join(root, "artifacts.json")),
      evidencePack: readJson<EvidencePack>(path.join(root, "evidence", `${readJson<AiExecutionSummary>(path.join(root, "summary.json")).evidence_refs[0]}.json`)),
      auditEvents: readJson<AuditEvent[]>(path.join(root, "audit", "audit-events.json")),
      lineageEdges: readJson<LineageEdge[]>(path.join(root, "lineage", "lineage-edges.json")),
      open_path: readJson<{ open_path: string | null }>(path.join(root, "result.json")).open_path
    };
  }

  listJobIds(sessionId?: string): string[] {
    const jobsRoot = path.join(this.rootDir, "jobs");
    if (!fs.existsSync(jobsRoot)) {
      return [];
    }
    const jobIds = fs
      .readdirSync(jobsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
      .reverse();
    if (!sessionId) {
      return jobIds;
    }
    return jobIds.filter((jobId) => {
      const requestPath = path.join(jobsRoot, jobId, "request.json");
      return fs.existsSync(requestPath) && readJson<AiExecutionRequest>(requestPath).session_id === sessionId;
    });
  }
}
