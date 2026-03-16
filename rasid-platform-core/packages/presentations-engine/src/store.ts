import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import {
  ArtifactSchema,
  CanonicalRepresentationSchema,
  DeckAggregateSchema,
  DeckOutlineSchema,
  DeckVersionSchema,
  EvidencePackSchema,
  GroupedInfographicPlanSchema,
  InfographicBlockPlanSchema,
  JobSchema,
  LibraryAssetSchema,
  MediaBlockPlanSchema,
  MotionMetadataSchema,
  PresentationBindingSetSchema,
  PresentationIntentManifestSchema,
  PresentationOutputMetadataSchema,
  PresentationOutputStatusSchema,
  PublicationSchema,
  RenderParityValidationSchema,
  SlideBlockSchema,
  SpeakerNotesSchema,
  StoryboardSlidePlanSchema,
  TemplateLockStateSchema,
  type Artifact,
  type AuditEvent,
  type CanonicalRepresentation,
  type DeckAggregate,
  type DeckOutline,
  type DeckVersion,
  type EvidencePack,
  type Job,
  type LibraryAsset,
  type LineageEdge,
  type PresentationBindingSet,
  type PresentationIntentManifest,
  type PresentationOutputMetadata,
  type Publication,
  type RenderParityValidation,
  type SpeakerNotes,
  type StoryboardSlidePlan,
  type TemplateLockState
} from "@rasid/contracts";

export type PersistablePresentationExport = {
  target: string;
  artifact: Artifact;
  validation: unknown;
  contentType: string;
  fileName: string;
  content: string | Uint8Array;
};

export type PersistablePresentationBundle = {
  inputSources?: Array<Record<string, unknown>>;
  deck: DeckAggregate;
  version: DeckVersion;
  intentManifest: PresentationIntentManifest;
  outline: DeckOutline;
  storyboard: StoryboardSlidePlan[];
  slideBlocks?: Array<Record<string, unknown>>;
  speakerNotes: SpeakerNotes[];
  motionMetadata?: Array<Record<string, unknown>>;
  infographicPlans?: Array<Record<string, unknown>>;
  mediaPlans?: Array<Record<string, unknown>>;
  groupedInfographicPlans?: Array<Record<string, unknown>>;
  bindingSet: PresentationBindingSet;
  templateLockState: TemplateLockState;
  canonical: CanonicalRepresentation;
  outputMetadata: PresentationOutputMetadata;
  parityValidation: RenderParityValidation | null;
  outputStatuses?: Array<Record<string, unknown>>;
  deckArtifact: Artifact;
  versionArtifact: Artifact;
  previewArtifact: Artifact | null;
  exportArtifacts: PersistablePresentationExport[];
  publications: Publication[];
  libraryAssets: LibraryAsset[];
  jobs: Job[];
  evidencePacks: EvidencePack[];
  auditEvents: AuditEvent[];
  lineageEdges: LineageEdge[];
  parsedSourceRecords?: Array<Record<string, unknown>>;
  roundTripValidations?: Array<Record<string, unknown>>;
};

const ensureDirectory = (directoryPath: string): void => {
  fs.mkdirSync(directoryPath, { recursive: true });
};

const hashContent = (content: string | Uint8Array): string =>
  createHash("sha256")
    .update(typeof content === "string" ? Buffer.from(content, "utf8") : Buffer.from(content))
    .digest("hex");

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

const writeContent = (filePath: string, payload: string | Uint8Array) => {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, typeof payload === "string" ? payload : Buffer.from(payload));
  return {
    filePath,
    uri: pathToFileURL(filePath).href,
    checksum: `sha256:${hashContent(payload)}`
  };
};

export const defaultPresentationsEngineStorageRoot = (root = process.cwd()): string =>
  path.join(root, ".runtime", "presentations-engine");

export class PresentationEngineStore {
  readonly rootDir: string;

  constructor(rootDir = defaultPresentationsEngineStorageRoot()) {
    this.rootDir = rootDir;
    ensureDirectory(this.rootDir);
  }

  private deckRoot(deckId: string): string {
    return path.join(this.rootDir, "decks", deckId);
  }

  private deckFile(deckId: string, folder: string, filename: string): string {
    return path.join(this.deckRoot(deckId), folder, filename);
  }

  persistBundle(bundle: PersistablePresentationBundle): void {
    const deckId = bundle.deck.deck_id;
    writeJson(this.deckFile(deckId, "state", "current.json"), {
      deck_id: bundle.deck.deck_id,
      version_id: bundle.version.version_ref.version_id,
      updated_at: bundle.deck.updated_at,
      preview_artifact_ref: bundle.previewArtifact?.artifact_id ?? null,
      export_artifact_refs: bundle.exportArtifacts.map((item) => item.artifact.artifact_id),
      publication_refs: bundle.publications.map((item) => item.publication_id)
    });
    if (bundle.inputSources) {
      writeJson(this.deckFile(deckId, "records", "input-sources.json"), bundle.inputSources);
    }
    writeJson(this.deckFile(deckId, "records", "intent-manifest.json"), PresentationIntentManifestSchema.parse(bundle.intentManifest));
    writeJson(this.deckFile(deckId, "records", "deck-outline.json"), DeckOutlineSchema.parse(bundle.outline));
    writeJson(this.deckFile(deckId, "records", "storyboard.json"), bundle.storyboard.map((item) => StoryboardSlidePlanSchema.parse(item)));
    if (bundle.slideBlocks) {
      writeJson(this.deckFile(deckId, "records", "slide-blocks.json"), bundle.slideBlocks.map((item) => SlideBlockSchema.parse(item)));
    }
    writeJson(this.deckFile(deckId, "records", "speaker-notes.json"), bundle.speakerNotes.map((item) => SpeakerNotesSchema.parse(item)));
    if (bundle.motionMetadata) {
      writeJson(this.deckFile(deckId, "records", "motion-metadata.json"), bundle.motionMetadata.map((item) => MotionMetadataSchema.parse(item)));
    }
    if (bundle.infographicPlans) {
      writeJson(this.deckFile(deckId, "records", "infographic-plans.json"), bundle.infographicPlans.map((item) => InfographicBlockPlanSchema.parse(item)));
    }
    if (bundle.mediaPlans) {
      writeJson(this.deckFile(deckId, "records", "media-plans.json"), bundle.mediaPlans.map((item) => MediaBlockPlanSchema.parse(item)));
    }
    if (bundle.groupedInfographicPlans) {
      writeJson(this.deckFile(deckId, "records", "grouped-infographic-plans.json"), bundle.groupedInfographicPlans.map((item) => GroupedInfographicPlanSchema.parse(item)));
    }
    writeJson(this.deckFile(deckId, "records", "binding-set.json"), PresentationBindingSetSchema.parse(bundle.bindingSet));
    writeJson(this.deckFile(deckId, "records", "template-lock-state.json"), TemplateLockStateSchema.parse(bundle.templateLockState));
    writeJson(this.deckFile(deckId, "records", "canonical.json"), CanonicalRepresentationSchema.parse(bundle.canonical));
    writeJson(this.deckFile(deckId, "records", "deck-aggregate.json"), DeckAggregateSchema.parse(bundle.deck));
    writeJson(this.deckFile(deckId, "records", "deck-version.json"), DeckVersionSchema.parse(bundle.version));
    writeJson(this.deckFile(deckId, "records", "output-metadata.json"), PresentationOutputMetadataSchema.parse(bundle.outputMetadata));
    if (bundle.outputStatuses) {
      writeJson(this.deckFile(deckId, "records", "output-statuses.json"), bundle.outputStatuses.map((item) => PresentationOutputStatusSchema.parse(item)));
    }
    if (bundle.parityValidation) {
      writeJson(this.deckFile(deckId, "records", "parity-validation.json"), RenderParityValidationSchema.parse(bundle.parityValidation));
    }
    writeJson(this.deckFile(deckId, "artifacts", `${bundle.deckArtifact.artifact_id}.json`), ArtifactSchema.parse(bundle.deckArtifact));
    writeJson(this.deckFile(deckId, "artifacts", `${bundle.versionArtifact.artifact_id}.json`), ArtifactSchema.parse(bundle.versionArtifact));
    if (bundle.previewArtifact) {
      writeJson(this.deckFile(deckId, "artifacts", `${bundle.previewArtifact.artifact_id}.json`), ArtifactSchema.parse(bundle.previewArtifact));
    }
    bundle.exportArtifacts.forEach((item) => {
      writeJson(this.deckFile(deckId, "artifacts", `${item.artifact.artifact_id}.json`), ArtifactSchema.parse(item.artifact));
      writeJson(this.deckFile(deckId, "records", `${item.target}-validation.json`), item.validation);
    });
    bundle.publications.forEach((item) =>
      writeJson(this.deckFile(deckId, "publication", `${item.publication_id}.json`), PublicationSchema.parse(item))
    );
    bundle.libraryAssets.forEach((item) =>
      writeJson(this.deckFile(deckId, "library", `${item.asset_id}.json`), LibraryAssetSchema.parse(item))
    );
    bundle.jobs.forEach((item) => writeJson(this.deckFile(deckId, "jobs", `${item.job_id}.json`), JobSchema.parse(item)));
    bundle.evidencePacks.forEach((item) =>
      writeJson(this.deckFile(deckId, "evidence", `${item.evidence_pack_id}.json`), EvidencePackSchema.parse(item))
    );
    writeJson(this.deckFile(deckId, "audit", "events.json"), bundle.auditEvents);
    writeJson(this.deckFile(deckId, "lineage", "edges.json"), bundle.lineageEdges);
    if (bundle.parsedSourceRecords) {
      writeJson(this.deckFile(deckId, "parsers", "parsed-sources.json"), bundle.parsedSourceRecords);
    }
    if (bundle.roundTripValidations) {
      writeJson(this.deckFile(deckId, "parity", "round-trip.json"), bundle.roundTripValidations);
    }
  }

  persistPreview(deckId: string, fileName: string, html: string): void {
    writeContent(this.deckFile(deckId, "files", fileName), html);
  }

  persistExport(deckId: string, fileName: string, content: string | Uint8Array): void {
    writeContent(this.deckFile(deckId, "files", fileName), content);
  }

  persistParserRecord(deckId: string, sourceRef: string, record: unknown): void {
    writeJson(this.deckFile(deckId, "parsers", `${sourceRef}.json`), record);
  }

  persistRoundTripReport(deckId: string, target: string, record: unknown): void {
    writeJson(this.deckFile(deckId, "parity", `${target}-round-trip.json`), record);
  }

  persistRuntimeBundleSnapshot(deckId: string, snapshot: unknown): void {
    writeJson(this.deckFile(deckId, "state", "bundle-snapshot.json"), snapshot);
  }

  persistJson(deckId: string, folder: string, filename: string, payload: unknown): void {
    writeJson(this.deckFile(deckId, folder, filename), payload);
  }

  persistText(deckId: string, folder: string, filename: string, content: string): void {
    writeContent(this.deckFile(deckId, folder, filename), content);
  }

  persistBinary(deckId: string, folder: string, filename: string, content: Uint8Array): void {
    writeContent(this.deckFile(deckId, folder, filename), content);
  }

  loadRuntimeBundleSnapshot(deckId: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(this.deckFile(deckId, "state", "bundle-snapshot.json"), "utf8")) as Record<string, unknown>;
  }

  loadStoredDeckState(deckId: string): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(this.deckFile(deckId, "state", "current.json"), "utf8")) as Record<string, unknown>;
  }

  listStoredDeckStates(): Array<Record<string, unknown>> {
    const decksRoot = path.join(this.rootDir, "decks");
    if (!fs.existsSync(decksRoot)) {
      return [];
    }
    return fs
      .readdirSync(decksRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(decksRoot, entry.name, "state", "current.json"))
      .filter((filePath) => fs.existsSync(filePath))
      .map((filePath) => JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>);
  }

  resolveDeckFile(deckId: string, folder: string, filename: string): string {
    return this.deckFile(deckId, folder, filename);
  }

  loadJson<T>(deckId: string, folder: string, filename: string, fallback: T): T {
    const target = this.deckFile(deckId, folder, filename);
    if (!fs.existsSync(target)) {
      return fallback;
    }
    return JSON.parse(fs.readFileSync(target, "utf8")) as T;
  }

  deckFileExists(deckId: string, folder: string, filename: string): boolean {
    return fs.existsSync(this.deckFile(deckId, folder, filename));
  }
}
