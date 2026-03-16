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
  TranscriptionCompareResultSchema,
  TranscriptionQuestionAnswerSchema,
  UnifiedContentBundleSchema,
  type Artifact,
  type AuditEvent,
  type CanonicalRepresentation,
  type EvidencePack,
  type Job,
  type LibraryAsset,
  type LineageEdge,
  type TranscriptionCompareResult,
  type TranscriptionQuestionAnswer,
  type UnifiedContentBundle
} from "@rasid/contracts";
import { z } from "zod";

const PersistedWorkflowStateSchema = z.object({
  job: JobSchema,
  bundle_id: z.string(),
  artifact_refs: z.array(z.string()),
  updated_at: z.string()
});

export type StoredWorkflowResult = {
  bundle: UnifiedContentBundle;
  bundleArtifact: Artifact;
  transcriptArtifact: Artifact;
  extractionArtifact: Artifact;
  summaryArtifact: Artifact;
  canonical: CanonicalRepresentation;
  job: Job;
  evidencePack: EvidencePack;
  auditEvents: AuditEvent[];
  lineageEdges: LineageEdge[];
  libraryAsset: LibraryAsset | null;
  reportHandoff: Record<string, unknown>;
  queryDataset: Record<string, unknown>;
};

export type StoredCompareResult = {
  compareResult: TranscriptionCompareResult;
  diffArtifact: Artifact;
  job: Job;
  evidencePack: EvidencePack;
  auditEvents: AuditEvent[];
  lineageEdges: LineageEdge[];
};

const ensureDirectory = (directoryPath: string): void => {
  fs.mkdirSync(directoryPath, { recursive: true });
};

const checksum = (value: string): string => `sha256:${createHash("sha256").update(value).digest("hex")}`;

const writeJson = (filePath: string, payload: unknown): { filePath: string; uri: string; checksum: string } => {
  ensureDirectory(path.dirname(filePath));
  const content = JSON.stringify(payload, null, 2);
  fs.writeFileSync(filePath, `${content}\n`, "utf8");
  return {
    filePath,
    uri: pathToFileURL(filePath).href,
    checksum: checksum(content)
  };
};

const writeText = (filePath: string, content: string): { filePath: string; uri: string; checksum: string } => {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf8");
  return {
    filePath,
    uri: pathToFileURL(filePath).href,
    checksum: checksum(content)
  };
};

const readJson = <T>(filePath: string): T => JSON.parse(fs.readFileSync(filePath, "utf8")) as T;

export const defaultTranscriptionStorageRoot = (root = process.cwd()): string =>
  path.join(root, ".runtime", "transcription-extraction-engine");

export class TranscriptionExtractionStore {
  readonly rootDir: string;

  constructor(rootDir = defaultTranscriptionStorageRoot()) {
    this.rootDir = rootDir;
    ensureDirectory(this.rootDir);
  }

  private jobRoot(jobId: string): string {
    return path.join(this.rootDir, "jobs", jobId);
  }

  private bundleRoot(bundleId: string): string {
    return path.join(this.rootDir, "bundles", bundleId);
  }

  private jobFile(jobId: string, folder: string, filename: string): string {
    return path.join(this.jobRoot(jobId), folder, filename);
  }

  private bundleFile(bundleId: string, folder: string, filename: string): string {
    return path.join(this.bundleRoot(bundleId), folder, filename);
  }

  writeInputFile(jobId: string, fileName: string, content: Buffer): string {
    const filePath = this.jobFile(jobId, "input", fileName);
    ensureDirectory(path.dirname(filePath));
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  writeInputCopy(jobId: string, fileName: string, sourcePath: string): string {
    const filePath = this.jobFile(jobId, "input", fileName);
    ensureDirectory(path.dirname(filePath));
    fs.copyFileSync(sourcePath, filePath);
    return filePath;
  }

  persistWorkflow(result: StoredWorkflowResult): StoredWorkflowResult {
    const jobId = result.job.job_id;
    const bundleId = result.bundle.bundle_id;
    const bundleJson = writeJson(this.bundleFile(bundleId, "records", "bundle.json"), UnifiedContentBundleSchema.parse(result.bundle));
    const transcriptJson = writeJson(
      this.jobFile(jobId, "artifacts", `${result.transcriptArtifact.artifact_id}.json`),
      {
        bundle_id: bundleId,
        full_transcript: result.bundle.segments.map((segment) => segment.text).join("\n"),
        sections: result.bundle.sections,
        segments: result.bundle.segments,
        aligned_words: result.bundle.aligned_words
      }
    );
    const transcriptMarkdown = writeText(
      this.jobFile(jobId, "artifacts", "transcript.md"),
      result.bundle.segments
        .map((segment) => {
          const timing =
            segment.start_ms === null || segment.end_ms === null
              ? ""
              : `[${segment.start_ms}-${segment.end_ms}ms] `;
          const speaker = segment.speaker_ref ? `${segment.speaker_ref}: ` : "";
          return `- ${timing}${speaker}${segment.text}`;
        })
        .join("\n")
    );
    const extractionJson = writeJson(
      this.jobFile(jobId, "artifacts", `${result.extractionArtifact.artifact_id}.json`),
      {
        fields: result.bundle.fields,
        entities: result.bundle.entities,
        tables: result.bundle.tables,
        action_items: result.bundle.action_items,
        qa_seeds: result.bundle.qa_seeds,
        on_screen_text: result.bundle.on_screen_text,
        disagreements: result.bundle.disagreements,
        verification_gate: result.bundle.verification_gate
      }
    );
    const summaryJson = writeJson(
      this.jobFile(jobId, "artifacts", `${result.summaryArtifact.artifact_id}.json`),
      result.bundle.summaries
    );
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
    const canonicalJson = writeJson(
      this.jobFile(jobId, "artifacts", `${result.canonical.canonical_id}.json`),
      CanonicalRepresentationSchema.parse(result.canonical)
    );
    const bundleArtifact = ArtifactSchema.parse({
      ...result.bundleArtifact,
      storage_ref: { ...result.bundleArtifact.storage_ref, uri: bundleJson.uri, checksum: bundleJson.checksum, region: "local" }
    });
    const transcriptArtifact = ArtifactSchema.parse({
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
    const extractionArtifact = ArtifactSchema.parse({
      ...result.extractionArtifact,
      storage_ref: { ...result.extractionArtifact.storage_ref, uri: extractionJson.uri, checksum: extractionJson.checksum, region: "local" }
    });
    const summaryArtifact = ArtifactSchema.parse({
      ...result.summaryArtifact,
      storage_ref: { ...result.summaryArtifact.storage_ref, uri: summaryJson.uri, checksum: summaryJson.checksum, region: "local" }
    });
    [bundleArtifact, transcriptArtifact, extractionArtifact, summaryArtifact].forEach((artifact) =>
      writeJson(this.jobFile(jobId, "records", `${artifact.artifact_id}.artifact.json`), artifact)
    );
    writeJson(this.jobFile(jobId, "records", "canonical.record.json"), result.canonical);
    writeJson(this.jobFile(jobId, "records", "report-handoff.record.json"), result.reportHandoff);
    writeJson(this.jobFile(jobId, "records", "query-dataset.record.json"), result.queryDataset);
    writeJson(this.jobFile(jobId, "state", "job.json"), JobSchema.parse(result.job));
    writeJson(
      this.jobFile(jobId, "state", "workflow.json"),
      PersistedWorkflowStateSchema.parse({
        job: result.job,
        bundle_id: bundleId,
        artifact_refs: [bundleArtifact.artifact_id, transcriptArtifact.artifact_id, extractionArtifact.artifact_id, summaryArtifact.artifact_id],
        updated_at: result.bundle.updated_at
      })
    );
    writeJson(
      this.jobFile(jobId, "state", "status-history.json"),
      result.auditEvents.map((event) => ({ event_id: event.event_id, timestamp: event.timestamp, action_ref: event.action_ref, metadata: event.metadata }))
    );
    writeJson(this.jobFile(jobId, "evidence", `${result.evidencePack.evidence_pack_id}.json`), EvidencePackSchema.parse(result.evidencePack));
    result.auditEvents.forEach((event) =>
      writeJson(this.jobFile(jobId, "audit", `${event.event_id}.json`), AuditEventSchema.parse(event))
    );
    result.lineageEdges.forEach((edge) => writeJson(this.jobFile(jobId, "lineage", `${edge.edge_id}.json`), edge));
    if (result.libraryAsset) {
      writeJson(this.jobFile(jobId, "library", `${result.libraryAsset.asset_id}.json`), LibraryAssetSchema.parse(result.libraryAsset));
    }
    writeJson(this.bundleFile(bundleId, "records", "job-link.json"), { job_id: jobId, bundle_artifact_ref: bundleArtifact.artifact_id });
    writeJson(this.bundleFile(bundleId, "artifacts", "canonical.json"), CanonicalRepresentationSchema.parse(result.canonical));
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
    writeText(this.bundleFile(bundleId, "artifacts", "transcript.md"), fs.readFileSync(transcriptMarkdown.filePath, "utf8"));
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

  persistCompare(jobId: string, compare: StoredCompareResult): StoredCompareResult {
    writeJson(this.jobFile(jobId, "compare", `${compare.compareResult.compare_id}.json`), compare.compareResult);
    writeJson(this.jobFile(jobId, "records", `${compare.diffArtifact.artifact_id}.artifact.json`), compare.diffArtifact);
    writeJson(this.jobFile(jobId, "records", `${compare.job.job_id}.job.json`), compare.job);
    writeJson(this.jobFile(jobId, "evidence", `${compare.evidencePack.evidence_pack_id}.json`), compare.evidencePack);
    compare.auditEvents.forEach((event) =>
      writeJson(this.jobFile(jobId, "audit", `${event.event_id}.json`), AuditEventSchema.parse(event))
    );
    compare.lineageEdges.forEach((edge) => writeJson(this.jobFile(jobId, "lineage", `${edge.edge_id}.json`), edge));
    return compare;
  }

  persistQuestionAnswer(jobId: string, answer: TranscriptionQuestionAnswer): TranscriptionQuestionAnswer {
    writeJson(this.jobFile(jobId, "questions", `${answer.answer_id}.json`), TranscriptionQuestionAnswerSchema.parse(answer));
    return answer;
  }

  listJobIds(): string[] {
    const jobsRoot = path.join(this.rootDir, "jobs");
    if (!fs.existsSync(jobsRoot)) {
      return [];
    }
    return fs
      .readdirSync(jobsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  }

  loadJob(jobId: string): Job {
    return JobSchema.parse(readJson(this.jobFile(jobId, "state", "job.json")));
  }

  listJobs(): Job[] {
    return this.listJobIds().flatMap((jobId) => {
      try {
        return [this.loadJob(jobId)];
      } catch {
        return [];
      }
    });
  }

  loadBundle(bundleId: string): UnifiedContentBundle {
    return UnifiedContentBundleSchema.parse(readJson(this.bundleFile(bundleId, "records", "bundle.json")));
  }

  loadBundleByJob(jobId: string): UnifiedContentBundle {
    const workflow = PersistedWorkflowStateSchema.parse(readJson(this.jobFile(jobId, "state", "workflow.json")));
    return this.loadBundle(workflow.bundle_id);
  }

  listAuditEvents(jobId: string): AuditEvent[] {
    const auditRoot = this.jobFile(jobId, "audit", "");
    if (!fs.existsSync(auditRoot)) {
      return [];
    }
    return fs
      .readdirSync(auditRoot)
      .filter((fileName) => fileName.endsWith(".json"))
      .map((fileName) => AuditEventSchema.parse(readJson(path.join(auditRoot, fileName))));
  }

  listLineageEdges(jobId: string): LineageEdge[] {
    const lineageRoot = this.jobFile(jobId, "lineage", "");
    if (!fs.existsSync(lineageRoot)) {
      return [];
    }
    return fs
      .readdirSync(lineageRoot)
      .filter((fileName) => fileName.endsWith(".json"))
      .map((fileName) => readJson(path.join(lineageRoot, fileName)) as LineageEdge);
  }

  listQuestions(jobId: string): TranscriptionQuestionAnswer[] {
    const questionsRoot = this.jobFile(jobId, "questions", "");
    if (!fs.existsSync(questionsRoot)) {
      return [];
    }
    return fs
      .readdirSync(questionsRoot)
      .filter((fileName) => fileName.endsWith(".json"))
      .map((fileName) => TranscriptionQuestionAnswerSchema.parse(readJson(path.join(questionsRoot, fileName))));
  }

  loadCompare(jobId: string, compareId: string): TranscriptionCompareResult {
    return TranscriptionCompareResultSchema.parse(readJson(this.jobFile(jobId, "compare", `${compareId}.json`)));
  }
}
