"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TranscriptionExtractionStore = exports.defaultTranscriptionStorageRoot = void 0;
const node_crypto_1 = require("node:crypto");
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_url_1 = require("node:url");
const contracts_1 = require("@rasid/contracts");
const zod_1 = require("zod");
const PersistedWorkflowStateSchema = zod_1.z.object({
    job: contracts_1.JobSchema,
    bundle_id: zod_1.z.string(),
    artifact_refs: zod_1.z.array(zod_1.z.string()),
    updated_at: zod_1.z.string()
});
const ensureDirectory = (directoryPath) => {
    node_fs_1.default.mkdirSync(directoryPath, { recursive: true });
};
const checksum = (value) => `sha256:${(0, node_crypto_1.createHash)("sha256").update(value).digest("hex")}`;
const writeJson = (filePath, payload) => {
    ensureDirectory(node_path_1.default.dirname(filePath));
    const content = JSON.stringify(payload, null, 2);
    node_fs_1.default.writeFileSync(filePath, `${content}\n`, "utf8");
    return {
        filePath,
        uri: (0, node_url_1.pathToFileURL)(filePath).href,
        checksum: checksum(content)
    };
};
const writeText = (filePath, content) => {
    ensureDirectory(node_path_1.default.dirname(filePath));
    node_fs_1.default.writeFileSync(filePath, content, "utf8");
    return {
        filePath,
        uri: (0, node_url_1.pathToFileURL)(filePath).href,
        checksum: checksum(content)
    };
};
const readJson = (filePath) => JSON.parse(node_fs_1.default.readFileSync(filePath, "utf8"));
const defaultTranscriptionStorageRoot = (root = process.cwd()) => node_path_1.default.join(root, ".runtime", "transcription-extraction-engine");
exports.defaultTranscriptionStorageRoot = defaultTranscriptionStorageRoot;
class TranscriptionExtractionStore {
    constructor(rootDir = (0, exports.defaultTranscriptionStorageRoot)()) {
        this.rootDir = rootDir;
        ensureDirectory(this.rootDir);
    }
    jobRoot(jobId) {
        return node_path_1.default.join(this.rootDir, "jobs", jobId);
    }
    bundleRoot(bundleId) {
        return node_path_1.default.join(this.rootDir, "bundles", bundleId);
    }
    jobFile(jobId, folder, filename) {
        return node_path_1.default.join(this.jobRoot(jobId), folder, filename);
    }
    bundleFile(bundleId, folder, filename) {
        return node_path_1.default.join(this.bundleRoot(bundleId), folder, filename);
    }
    writeInputFile(jobId, fileName, content) {
        const filePath = this.jobFile(jobId, "input", fileName);
        ensureDirectory(node_path_1.default.dirname(filePath));
        node_fs_1.default.writeFileSync(filePath, content);
        return filePath;
    }
    writeInputCopy(jobId, fileName, sourcePath) {
        const filePath = this.jobFile(jobId, "input", fileName);
        ensureDirectory(node_path_1.default.dirname(filePath));
        node_fs_1.default.copyFileSync(sourcePath, filePath);
        return filePath;
    }
    persistWorkflow(result) {
        const jobId = result.job.job_id;
        const bundleId = result.bundle.bundle_id;
        const bundleJson = writeJson(this.bundleFile(bundleId, "records", "bundle.json"), contracts_1.UnifiedContentBundleSchema.parse(result.bundle));
        const transcriptJson = writeJson(this.jobFile(jobId, "artifacts", `${result.transcriptArtifact.artifact_id}.json`), {
            bundle_id: bundleId,
            full_transcript: result.bundle.segments.map((segment) => segment.text).join("\n"),
            sections: result.bundle.sections,
            segments: result.bundle.segments,
            aligned_words: result.bundle.aligned_words
        });
        const transcriptMarkdown = writeText(this.jobFile(jobId, "artifacts", "transcript.md"), result.bundle.segments
            .map((segment) => {
            const timing = segment.start_ms === null || segment.end_ms === null
                ? ""
                : `[${segment.start_ms}-${segment.end_ms}ms] `;
            const speaker = segment.speaker_ref ? `${segment.speaker_ref}: ` : "";
            return `- ${timing}${speaker}${segment.text}`;
        })
            .join("\n"));
        const extractionJson = writeJson(this.jobFile(jobId, "artifacts", `${result.extractionArtifact.artifact_id}.json`), {
            fields: result.bundle.fields,
            entities: result.bundle.entities,
            tables: result.bundle.tables,
            action_items: result.bundle.action_items,
            qa_seeds: result.bundle.qa_seeds,
            on_screen_text: result.bundle.on_screen_text,
            disagreements: result.bundle.disagreements,
            verification_gate: result.bundle.verification_gate
        });
        const summaryJson = writeJson(this.jobFile(jobId, "artifacts", `${result.summaryArtifact.artifact_id}.json`), result.bundle.summaries);
        writeJson(this.jobFile(jobId, "artifacts", "alignment-artifact.json"), {
            aligned_words: result.bundle.aligned_words,
            verification_gate: result.bundle.verification_gate
        });
        writeJson(this.jobFile(jobId, "artifacts", "verification-artifact.json"), {
            verification_gate: result.bundle.verification_gate,
            disagreements: result.bundle.disagreements,
            on_screen_text: result.bundle.on_screen_text
        });
        const reportHandoff = writeJson(this.jobFile(jobId, "artifacts", "report-handoff.json"), result.reportHandoff);
        const queryDataset = writeJson(this.jobFile(jobId, "artifacts", "query-dataset.json"), result.queryDataset);
        const canonicalJson = writeJson(this.jobFile(jobId, "artifacts", `${result.canonical.canonical_id}.json`), contracts_1.CanonicalRepresentationSchema.parse(result.canonical));
        const bundleArtifact = contracts_1.ArtifactSchema.parse({
            ...result.bundleArtifact,
            storage_ref: { ...result.bundleArtifact.storage_ref, uri: bundleJson.uri, checksum: bundleJson.checksum, region: "local" }
        });
        const transcriptArtifact = contracts_1.ArtifactSchema.parse({
            ...result.transcriptArtifact,
            storage_ref: { ...result.transcriptArtifact.storage_ref, uri: transcriptJson.uri, checksum: transcriptJson.checksum, region: "local" },
            export_refs: [
                ...result.transcriptArtifact.export_refs,
                {
                    export_id: `${result.transcriptArtifact.artifact_id}-md`,
                    export_type: "other",
                    explicit_non_editable: false,
                    storage_ref: transcriptMarkdown.uri
                }
            ]
        });
        const extractionArtifact = contracts_1.ArtifactSchema.parse({
            ...result.extractionArtifact,
            storage_ref: { ...result.extractionArtifact.storage_ref, uri: extractionJson.uri, checksum: extractionJson.checksum, region: "local" }
        });
        const summaryArtifact = contracts_1.ArtifactSchema.parse({
            ...result.summaryArtifact,
            storage_ref: { ...result.summaryArtifact.storage_ref, uri: summaryJson.uri, checksum: summaryJson.checksum, region: "local" }
        });
        [bundleArtifact, transcriptArtifact, extractionArtifact, summaryArtifact].forEach((artifact) => writeJson(this.jobFile(jobId, "records", `${artifact.artifact_id}.artifact.json`), artifact));
        writeJson(this.jobFile(jobId, "records", "canonical.record.json"), result.canonical);
        writeJson(this.jobFile(jobId, "records", "report-handoff.record.json"), result.reportHandoff);
        writeJson(this.jobFile(jobId, "records", "query-dataset.record.json"), result.queryDataset);
        writeJson(this.jobFile(jobId, "state", "job.json"), contracts_1.JobSchema.parse(result.job));
        writeJson(this.jobFile(jobId, "state", "workflow.json"), PersistedWorkflowStateSchema.parse({
            job: result.job,
            bundle_id: bundleId,
            artifact_refs: [bundleArtifact.artifact_id, transcriptArtifact.artifact_id, extractionArtifact.artifact_id, summaryArtifact.artifact_id],
            updated_at: result.bundle.updated_at
        }));
        writeJson(this.jobFile(jobId, "state", "status-history.json"), result.auditEvents.map((event) => ({ event_id: event.event_id, timestamp: event.timestamp, action_ref: event.action_ref, metadata: event.metadata })));
        writeJson(this.jobFile(jobId, "evidence", `${result.evidencePack.evidence_pack_id}.json`), contracts_1.EvidencePackSchema.parse(result.evidencePack));
        result.auditEvents.forEach((event) => writeJson(this.jobFile(jobId, "audit", `${event.event_id}.json`), contracts_1.AuditEventSchema.parse(event)));
        result.lineageEdges.forEach((edge) => writeJson(this.jobFile(jobId, "lineage", `${edge.edge_id}.json`), edge));
        if (result.libraryAsset) {
            writeJson(this.jobFile(jobId, "library", `${result.libraryAsset.asset_id}.json`), contracts_1.LibraryAssetSchema.parse(result.libraryAsset));
        }
        writeJson(this.bundleFile(bundleId, "records", "job-link.json"), { job_id: jobId, bundle_artifact_ref: bundleArtifact.artifact_id });
        writeJson(this.bundleFile(bundleId, "artifacts", "canonical.json"), contracts_1.CanonicalRepresentationSchema.parse(result.canonical));
        writeJson(this.bundleFile(bundleId, "artifacts", "bundle-artifact.json"), bundleArtifact);
        writeJson(this.bundleFile(bundleId, "artifacts", "transcript-artifact.json"), transcriptArtifact);
        writeJson(this.bundleFile(bundleId, "artifacts", "extraction-artifact.json"), extractionArtifact);
        writeJson(this.bundleFile(bundleId, "artifacts", "summary-artifact.json"), summaryArtifact);
        writeJson(this.bundleFile(bundleId, "artifacts", "alignment-artifact.json"), {
            aligned_words: result.bundle.aligned_words,
            verification_gate: result.bundle.verification_gate
        });
        writeJson(this.bundleFile(bundleId, "artifacts", "verification-artifact.json"), {
            verification_gate: result.bundle.verification_gate,
            disagreements: result.bundle.disagreements,
            on_screen_text: result.bundle.on_screen_text
        });
        writeJson(this.bundleFile(bundleId, "artifacts", "report-handoff.json"), result.reportHandoff);
        writeJson(this.bundleFile(bundleId, "artifacts", "query-dataset.json"), result.queryDataset);
        writeText(this.bundleFile(bundleId, "artifacts", "transcript.md"), node_fs_1.default.readFileSync(transcriptMarkdown.filePath, "utf8"));
        void canonicalJson;
        void reportHandoff;
        void queryDataset;
        return {
            ...result,
            bundleArtifact,
            transcriptArtifact,
            extractionArtifact,
            summaryArtifact
        };
    }
    persistCompare(jobId, compare) {
        writeJson(this.jobFile(jobId, "compare", `${compare.compareResult.compare_id}.json`), compare.compareResult);
        writeJson(this.jobFile(jobId, "records", `${compare.diffArtifact.artifact_id}.artifact.json`), compare.diffArtifact);
        writeJson(this.jobFile(jobId, "records", `${compare.job.job_id}.job.json`), compare.job);
        writeJson(this.jobFile(jobId, "evidence", `${compare.evidencePack.evidence_pack_id}.json`), compare.evidencePack);
        compare.auditEvents.forEach((event) => writeJson(this.jobFile(jobId, "audit", `${event.event_id}.json`), contracts_1.AuditEventSchema.parse(event)));
        compare.lineageEdges.forEach((edge) => writeJson(this.jobFile(jobId, "lineage", `${edge.edge_id}.json`), edge));
        return compare;
    }
    persistQuestionAnswer(jobId, answer) {
        writeJson(this.jobFile(jobId, "questions", `${answer.answer_id}.json`), contracts_1.TranscriptionQuestionAnswerSchema.parse(answer));
        return answer;
    }
    listJobIds() {
        const jobsRoot = node_path_1.default.join(this.rootDir, "jobs");
        if (!node_fs_1.default.existsSync(jobsRoot)) {
            return [];
        }
        return node_fs_1.default
            .readdirSync(jobsRoot, { withFileTypes: true })
            .filter((entry) => entry.isDirectory())
            .map((entry) => entry.name)
            .sort();
    }
    loadJob(jobId) {
        return contracts_1.JobSchema.parse(readJson(this.jobFile(jobId, "state", "job.json")));
    }
    listJobs() {
        return this.listJobIds().flatMap((jobId) => {
            try {
                return [this.loadJob(jobId)];
            }
            catch {
                return [];
            }
        });
    }
    loadBundle(bundleId) {
        return contracts_1.UnifiedContentBundleSchema.parse(readJson(this.bundleFile(bundleId, "records", "bundle.json")));
    }
    loadBundleByJob(jobId) {
        const workflow = PersistedWorkflowStateSchema.parse(readJson(this.jobFile(jobId, "state", "workflow.json")));
        return this.loadBundle(workflow.bundle_id);
    }
    listAuditEvents(jobId) {
        const auditRoot = this.jobFile(jobId, "audit", "");
        if (!node_fs_1.default.existsSync(auditRoot)) {
            return [];
        }
        return node_fs_1.default
            .readdirSync(auditRoot)
            .filter((fileName) => fileName.endsWith(".json"))
            .map((fileName) => contracts_1.AuditEventSchema.parse(readJson(node_path_1.default.join(auditRoot, fileName))));
    }
    listLineageEdges(jobId) {
        const lineageRoot = this.jobFile(jobId, "lineage", "");
        if (!node_fs_1.default.existsSync(lineageRoot)) {
            return [];
        }
        return node_fs_1.default
            .readdirSync(lineageRoot)
            .filter((fileName) => fileName.endsWith(".json"))
            .map((fileName) => readJson(node_path_1.default.join(lineageRoot, fileName)));
    }
    listQuestions(jobId) {
        const questionsRoot = this.jobFile(jobId, "questions", "");
        if (!node_fs_1.default.existsSync(questionsRoot)) {
            return [];
        }
        return node_fs_1.default
            .readdirSync(questionsRoot)
            .filter((fileName) => fileName.endsWith(".json"))
            .map((fileName) => contracts_1.TranscriptionQuestionAnswerSchema.parse(readJson(node_path_1.default.join(questionsRoot, fileName))));
    }
    loadCompare(jobId, compareId) {
        return contracts_1.TranscriptionCompareResultSchema.parse(readJson(this.jobFile(jobId, "compare", `${compareId}.json`)));
    }
}
exports.TranscriptionExtractionStore = TranscriptionExtractionStore;
