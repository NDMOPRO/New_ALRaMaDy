import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type {
  Artifact,
  AuditEvent,
  CanonicalRepresentation,
  EvidencePack,
  FormulaGraphState,
  LineageEdge,
  PivotMetadata,
  Publication,
  StyleMetadata,
  TransformationResult,
  WorkbookPackage
} from "@rasid/contracts";
import { z } from "zod";

export const ExcelStoreManifestSchema = z.object({
  manifest_id: z.string(),
  store_root: z.string(),
  workbook_state_path: z.string(),
  workbook_versions_path: z.string(),
  publications_path: z.string(),
  artifacts_path: z.string(),
  evidence_path: z.string(),
  audit_path: z.string(),
  lineage_path: z.string(),
  charts_path: z.string(),
  exported_workbook_path: z.string().nullable(),
  publication_backend_ref: z.string().nullable(),
  backend_service_ref: z.string().nullable(),
  backend_service_url: z.string().nullable().default(null),
  service_manifest_url: z.string().nullable().default(null),
  backend_manifest_path: z.string().nullable(),
  backend_manifest_url: z.string().nullable().default(null),
  backend_object_manifest_path: z.string().nullable(),
  backend_object_manifest_url: z.string().nullable().default(null),
  backend_download_url: z.string().nullable().default(null),
  updated_at: z.string()
});

export type ExcelStoreManifest = z.infer<typeof ExcelStoreManifestSchema>;

export type ExcelStoreBundle = {
  workbookId: string;
  workbookPackage: WorkbookPackage;
  canonicalRepresentation: CanonicalRepresentation;
  formulaGraph: FormulaGraphState;
  analysis: unknown;
  transformationResults: TransformationResult[];
  pivotMetadata: PivotMetadata[];
  pivotCaches: unknown[];
  styleMetadata: StyleMetadata[];
  lambdaRegistry: unknown[];
  chartHistory: unknown[];
  mappingPreviews: unknown[];
  generatedCharts: unknown[];
  nativeWorkbookObjects: unknown;
  sourceMetadata: unknown;
  artifacts: Artifact[];
  evidencePack: EvidencePack;
  auditEvents: AuditEvent[];
  lineageEdges: LineageEdge[];
  publication: Publication | null;
  exportedWorkbookPath: string | null;
  chartPaths: string[];
};

const ensureDirectory = (directoryPath: string): void => {
  fs.mkdirSync(directoryPath, { recursive: true });
};

const writeJson = (filePath: string, payload: unknown): string => {
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
};

export const defaultExcelEngineStorageRoot = (root = process.cwd()): string =>
  path.join(root, ".runtime", "excel-engine");

export const defaultExcelEngineBackendRoot = (root = process.cwd()): string =>
  path.join(root, ".runtime", "excel-engine-backend");

export class ExcelEngineStore {
  readonly rootDir: string;
  readonly backendRootDir: string;

  constructor(rootDir = defaultExcelEngineStorageRoot(), backendRootDir = defaultExcelEngineBackendRoot()) {
    this.rootDir = rootDir;
    this.backendRootDir = backendRootDir;
    ensureDirectory(this.rootDir);
    ensureDirectory(this.backendRootDir);
  }

  private workbookRoot(workbookId: string): string {
    return path.join(this.rootDir, "workbooks", workbookId);
  }

  private backendPublicationRoot(publicationId: string): string {
    return path.join(this.backendRootDir, "publications", publicationId);
  }

  private backendObjectRoot(objectId: string): string {
    return path.join(this.backendRootDir, "objects", objectId);
  }

  private backendServiceRoot(serviceName: string): string {
    return path.join(this.backendRootDir, "services", serviceName);
  }

  persistBundle(bundle: ExcelStoreBundle): ExcelStoreManifest {
    const workbookRoot = this.workbookRoot(bundle.workbookId);
    const workbookStatePath = writeJson(path.join(workbookRoot, "state", "workbook-package.json"), bundle.workbookPackage);
    const workbookVersionsPath = writeJson(
      path.join(workbookRoot, "state", "workbook-versions.json"),
      bundle.workbookPackage.workbook_versions
    );
    writeJson(path.join(workbookRoot, "canonical", `${bundle.canonicalRepresentation.canonical_id}.json`), bundle.canonicalRepresentation);
    writeJson(path.join(workbookRoot, "formulas", `${bundle.formulaGraph.graph_id}.json`), bundle.formulaGraph);
    writeJson(path.join(workbookRoot, "analysis", "analysis.json"), bundle.analysis);
    writeJson(path.join(workbookRoot, "transformations", "results.json"), bundle.transformationResults);
    writeJson(path.join(workbookRoot, "pivots", "metadata.json"), bundle.pivotMetadata);
    writeJson(path.join(workbookRoot, "pivots", "cache.json"), bundle.pivotCaches);
    writeJson(path.join(workbookRoot, "styles", "styles.json"), bundle.styleMetadata);
    writeJson(path.join(workbookRoot, "state", "source-metadata.json"), bundle.sourceMetadata);
    writeJson(path.join(workbookRoot, "formulas", "lambda-registry.json"), bundle.lambdaRegistry);
    writeJson(path.join(workbookRoot, "transformations", "mapping-preview.json"), bundle.mappingPreviews);
    writeJson(path.join(workbookRoot, "charts", "charts.json"), bundle.generatedCharts);
    writeJson(path.join(workbookRoot, "charts", "chart-history.json"), bundle.chartHistory);
    writeJson(path.join(workbookRoot, "charts", "native-objects.json"), bundle.nativeWorkbookObjects);
    writeJson(path.join(workbookRoot, "artifacts", "artifact-records.json"), bundle.artifacts);
    writeJson(path.join(workbookRoot, "evidence", `${bundle.evidencePack.evidence_pack_id}.json`), bundle.evidencePack);
    bundle.auditEvents.forEach((event) => writeJson(path.join(workbookRoot, "audit", `${event.event_id}.json`), event));
    bundle.lineageEdges.forEach((edge) => writeJson(path.join(workbookRoot, "lineage", `${edge.edge_id}.json`), edge));

    if (bundle.publication) {
      writeJson(path.join(workbookRoot, "publications", `${bundle.publication.publication_id}.json`), bundle.publication);
    }
    let persistedWorkbookPath: string | null = null;
    if (bundle.exportedWorkbookPath && fs.existsSync(bundle.exportedWorkbookPath)) {
      persistedWorkbookPath = path.join(workbookRoot, "published", path.basename(bundle.exportedWorkbookPath));
      ensureDirectory(path.dirname(persistedWorkbookPath));
      fs.copyFileSync(bundle.exportedWorkbookPath, persistedWorkbookPath);
    }
    const chartsPath = path.join(workbookRoot, "charts");
    ensureDirectory(chartsPath);
    bundle.chartPaths.forEach((chartPath) => {
      if (!fs.existsSync(chartPath)) return;
      fs.copyFileSync(chartPath, path.join(chartsPath, path.basename(chartPath)));
    });
    let backendManifestPath: string | null = null;
    let backendObjectManifestPath: string | null = null;
    let backendServiceRef: string | null = null;
    let publicationBackendRef: string | null = null;
    const serviceRoot = this.backendServiceRoot("object-store");
    ensureDirectory(serviceRoot);
    const serviceManifestPath = writeJson(path.join(serviceRoot, "manifest.json"), {
      service_name: "excel-engine-object-store",
      service_ref: "backend://excel-engine/services/object-store",
      object_root: path.join(this.backendRootDir, "objects"),
      publication_root: path.join(this.backendRootDir, "publications"),
      updated_at: new Date().toISOString()
    });
    backendServiceRef = "backend://excel-engine/services/object-store";
    if (bundle.publication) {
      const backendRoot = this.backendPublicationRoot(bundle.publication.publication_id);
      ensureDirectory(backendRoot);
      const backendWorkbookPath = persistedWorkbookPath ? path.join(backendRoot, path.basename(persistedWorkbookPath)) : null;
      if (persistedWorkbookPath && backendWorkbookPath) {
        fs.copyFileSync(persistedWorkbookPath, backendWorkbookPath);
      }
      let objectRef: string | null = null;
      if (persistedWorkbookPath) {
        const checksum = crypto.createHash("sha256").update(fs.readFileSync(persistedWorkbookPath)).digest("hex");
        const objectId = `object-${checksum.slice(0, 16)}`;
        const objectRoot = this.backendObjectRoot(objectId);
        ensureDirectory(objectRoot);
        const objectPath = path.join(objectRoot, path.basename(persistedWorkbookPath));
        fs.copyFileSync(persistedWorkbookPath, objectPath);
        objectRef = `backend://excel-engine/objects/${objectId}`;
        backendObjectManifestPath = writeJson(path.join(objectRoot, "manifest.json"), {
          object_id: objectId,
          object_ref: objectRef,
          workbook_id: bundle.workbookId,
          source_publication_id: bundle.publication.publication_id,
          media_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          object_path: objectPath,
          checksum_sha256: checksum,
          updated_at: new Date().toISOString()
        });
      }
      publicationBackendRef = `backend://excel-engine/publications/${bundle.publication.publication_id}`;
      backendManifestPath = writeJson(path.join(backendRoot, "manifest.json"), {
        publication_id: bundle.publication.publication_id,
        backend_ref: publicationBackendRef,
        service_ref: backendServiceRef,
        artifact_ref: bundle.publication.artifact_ref,
        workbook_ref: bundle.workbookId,
        download_path: backendWorkbookPath,
        object_manifest_path: backendObjectManifestPath,
        object_ref: objectRef,
        audit_path: path.join(workbookRoot, "audit"),
        evidence_path: path.join(workbookRoot, "evidence", `${bundle.evidencePack.evidence_pack_id}.json`),
        updated_at: new Date().toISOString()
      });
      writeJson(path.join(this.backendRootDir, "publication-index.json"), {
        latest_publication_id: bundle.publication.publication_id,
        backend_ref: publicationBackendRef,
        service_ref: backendServiceRef,
        manifest_path: backendManifestPath,
        object_manifest_path: backendObjectManifestPath,
        workbook_id: bundle.workbookId,
        artifact_ref: bundle.publication.artifact_ref,
        updated_at: new Date().toISOString()
      });
      writeJson(path.join(this.backendRootDir, "artifact-index.json"), {
        workbook_id: bundle.workbookId,
        artifact_ids: bundle.artifacts.map((artifact) => artifact.artifact_id),
        service_manifest_path: serviceManifestPath,
        updated_at: new Date().toISOString()
      });
    }

    return ExcelStoreManifestSchema.parse({
      manifest_id: `excel-store-${bundle.workbookId}`,
      store_root: this.rootDir,
      workbook_state_path: workbookStatePath,
      workbook_versions_path: workbookVersionsPath,
      publications_path: path.join(workbookRoot, "publications"),
      artifacts_path: path.join(workbookRoot, "artifacts", "artifact-records.json"),
      evidence_path: path.join(workbookRoot, "evidence", `${bundle.evidencePack.evidence_pack_id}.json`),
      audit_path: path.join(workbookRoot, "audit"),
      lineage_path: path.join(workbookRoot, "lineage"),
      charts_path: chartsPath,
      exported_workbook_path: persistedWorkbookPath,
      publication_backend_ref: publicationBackendRef,
      backend_service_ref: backendServiceRef,
      backend_service_url: null,
      service_manifest_url: null,
      backend_manifest_path: backendManifestPath,
      backend_manifest_url: null,
      backend_object_manifest_path: backendObjectManifestPath,
      backend_object_manifest_url: null,
      backend_download_url: null,
      updated_at: new Date().toISOString()
    });
  }
}
