"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AiEngineStore = exports.defaultAiEngineStorageRoot = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const ensureDir = (targetPath) => {
    node_fs_1.default.mkdirSync(targetPath, { recursive: true });
};
const writeJson = (filePath, payload) => {
    ensureDir(node_path_1.default.dirname(filePath));
    node_fs_1.default.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    return filePath;
};
const readJson = (filePath) => JSON.parse(node_fs_1.default.readFileSync(filePath, "utf8"));
const defaultAiEngineStorageRoot = (root = process.cwd()) => node_path_1.default.join(root, ".runtime", "ai-engine");
exports.defaultAiEngineStorageRoot = defaultAiEngineStorageRoot;
class AiEngineStore {
    constructor(rootDir = (0, exports.defaultAiEngineStorageRoot)()) {
        this.rootDir = rootDir;
        ensureDir(this.rootDir);
    }
    sessionFile(sessionId) {
        return node_path_1.default.join(this.rootDir, "sessions", `${sessionId}.json`);
    }
    jobRoot(jobId) {
        return node_path_1.default.join(this.rootDir, "jobs", jobId);
    }
    loadSession(sessionId) {
        const filePath = this.sessionFile(sessionId);
        return node_fs_1.default.existsSync(filePath) ? readJson(filePath) : null;
    }
    persistSession(session) {
        writeJson(this.sessionFile(session.session_id), session);
        return session;
    }
    persistBundle(bundle) {
        const root = this.jobRoot(bundle.job.job_id);
        writeJson(node_path_1.default.join(root, "request.json"), bundle.request);
        writeJson(node_path_1.default.join(root, "context.json"), bundle.context);
        writeJson(node_path_1.default.join(root, "plan.json"), bundle.plan);
        writeJson(node_path_1.default.join(root, "summary.json"), bundle.summary);
        writeJson(node_path_1.default.join(root, "phases.json"), bundle.phases);
        writeJson(node_path_1.default.join(root, "job.json"), bundle.job);
        writeJson(node_path_1.default.join(root, "artifacts.json"), bundle.artifacts);
        writeJson(node_path_1.default.join(root, "evidence", `${bundle.evidencePack.evidence_pack_id}.json`), bundle.evidencePack);
        writeJson(node_path_1.default.join(root, "audit", "audit-events.json"), bundle.auditEvents);
        writeJson(node_path_1.default.join(root, "lineage", "lineage-edges.json"), bundle.lineageEdges);
        writeJson(node_path_1.default.join(root, "result.json"), {
            summary_ref: bundle.summary.summary_id,
            artifact_refs: bundle.artifacts.map((artifact) => artifact.artifact_id),
            open_path: bundle.open_path
        });
        return bundle;
    }
    loadBundle(jobId) {
        const root = this.jobRoot(jobId);
        return {
            request: readJson(node_path_1.default.join(root, "request.json")),
            context: readJson(node_path_1.default.join(root, "context.json")),
            plan: readJson(node_path_1.default.join(root, "plan.json")),
            summary: readJson(node_path_1.default.join(root, "summary.json")),
            phases: readJson(node_path_1.default.join(root, "phases.json")),
            job: readJson(node_path_1.default.join(root, "job.json")),
            artifacts: readJson(node_path_1.default.join(root, "artifacts.json")),
            evidencePack: readJson(node_path_1.default.join(root, "evidence", `${readJson(node_path_1.default.join(root, "summary.json")).evidence_refs[0]}.json`)),
            auditEvents: readJson(node_path_1.default.join(root, "audit", "audit-events.json")),
            lineageEdges: readJson(node_path_1.default.join(root, "lineage", "lineage-edges.json")),
            open_path: readJson(node_path_1.default.join(root, "result.json")).open_path
        };
    }
    listJobIds(sessionId) {
        const jobsRoot = node_path_1.default.join(this.rootDir, "jobs");
        if (!node_fs_1.default.existsSync(jobsRoot)) {
            return [];
        }
        const jobIds = node_fs_1.default
            .readdirSync(jobsRoot, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .sort()
            .reverse();
        if (!sessionId) {
            return jobIds;
        }
        return jobIds.filter((jobId) => {
            const requestPath = node_path_1.default.join(jobsRoot, jobId, "request.json");
            return node_fs_1.default.existsSync(requestPath) && readJson(requestPath).session_id === sessionId;
        });
    }
}
exports.AiEngineStore = AiEngineStore;
