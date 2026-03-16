"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExcelEngineStore = exports.defaultExcelEngineBackendRoot = exports.defaultExcelEngineStorageRoot = exports.ExcelStoreManifestSchema = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const zod_1 = require("zod");
exports.ExcelStoreManifestSchema = zod_1.z.object({
    manifest_id: zod_1.z.string(),
    store_root: zod_1.z.string(),
    workbook_state_path: zod_1.z.string(),
    workbook_versions_path: zod_1.z.string(),
    publications_path: zod_1.z.string(),
    artifacts_path: zod_1.z.string(),
    evidence_path: zod_1.z.string(),
    audit_path: zod_1.z.string(),
    lineage_path: zod_1.z.string(),
    charts_path: zod_1.z.string(),
    exported_workbook_path: zod_1.z.string().nullable(),
    publication_backend_ref: zod_1.z.string().nullable(),
    backend_service_ref: zod_1.z.string().nullable(),
    backend_service_url: zod_1.z.string().nullable().default(null),
    service_manifest_url: zod_1.z.string().nullable().default(null),
    backend_manifest_path: zod_1.z.string().nullable(),
    backend_manifest_url: zod_1.z.string().nullable().default(null),
    backend_object_manifest_path: zod_1.z.string().nullable(),
    backend_object_manifest_url: zod_1.z.string().nullable().default(null),
    backend_download_url: zod_1.z.string().nullable().default(null),
    updated_at: zod_1.z.string()
});
const ensureDirectory = (directoryPath) => {
    node_fs_1.default.mkdirSync(directoryPath, { recursive: true });
};
const writeJson = (filePath, payload) => {
    ensureDirectory(node_path_1.default.dirname(filePath));
    node_fs_1.default.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    return filePath;
};
const defaultExcelEngineStorageRoot = (root = process.cwd()) => node_path_1.default.join(root, ".runtime", "excel-engine");
exports.defaultExcelEngineStorageRoot = defaultExcelEngineStorageRoot;
const defaultExcelEngineBackendRoot = (root = process.cwd()) => node_path_1.default.join(root, ".runtime", "excel-engine-backend");
exports.defaultExcelEngineBackendRoot = defaultExcelEngineBackendRoot;
class ExcelEngineStore {
    constructor(rootDir = (0, exports.defaultExcelEngineStorageRoot)(), backendRootDir = (0, exports.defaultExcelEngineBackendRoot)()) {
        this.rootDir = rootDir;
        this.backendRootDir = backendRootDir;
        ensureDirectory(this.rootDir);
        ensureDirectory(this.backendRootDir);
    }
    workbookRoot(workbookId) {
        return node_path_1.default.join(this.rootDir, "workbooks", workbookId);
    }
    backendPublicationRoot(publicationId) {
        return node_path_1.default.join(this.backendRootDir, "publications", publicationId);
    }
    backendObjectRoot(objectId) {
        return node_path_1.default.join(this.backendRootDir, "objects", objectId);
    }
    backendServiceRoot(serviceName) {
        return node_path_1.default.join(this.backendRootDir, "services", serviceName);
    }
    persistBundle(bundle) {
        const workbookRoot = this.workbookRoot(bundle.workbookId);
        const workbookStatePath = writeJson(node_path_1.default.join(workbookRoot, "state", "workbook-package.json"), bundle.workbookPackage);
        const workbookVersionsPath = writeJson(node_path_1.default.join(workbookRoot, "state", "workbook-versions.json"), bundle.workbookPackage.workbook_versions);
        writeJson(node_path_1.default.join(workbookRoot, "canonical", `${bundle.canonicalRepresentation.canonical_id}.json`), bundle.canonicalRepresentation);
        writeJson(node_path_1.default.join(workbookRoot, "formulas", `${bundle.formulaGraph.graph_id}.json`), bundle.formulaGraph);
        writeJson(node_path_1.default.join(workbookRoot, "analysis", "analysis.json"), bundle.analysis);
        writeJson(node_path_1.default.join(workbookRoot, "transformations", "results.json"), bundle.transformationResults);
        writeJson(node_path_1.default.join(workbookRoot, "pivots", "metadata.json"), bundle.pivotMetadata);
        writeJson(node_path_1.default.join(workbookRoot, "pivots", "cache.json"), bundle.pivotCaches);
        writeJson(node_path_1.default.join(workbookRoot, "styles", "styles.json"), bundle.styleMetadata);
        writeJson(node_path_1.default.join(workbookRoot, "state", "source-metadata.json"), bundle.sourceMetadata);
        writeJson(node_path_1.default.join(workbookRoot, "formulas", "lambda-registry.json"), bundle.lambdaRegistry);
        writeJson(node_path_1.default.join(workbookRoot, "transformations", "mapping-preview.json"), bundle.mappingPreviews);
        writeJson(node_path_1.default.join(workbookRoot, "charts", "charts.json"), bundle.generatedCharts);
        writeJson(node_path_1.default.join(workbookRoot, "charts", "chart-history.json"), bundle.chartHistory);
        writeJson(node_path_1.default.join(workbookRoot, "charts", "native-objects.json"), bundle.nativeWorkbookObjects);
        writeJson(node_path_1.default.join(workbookRoot, "artifacts", "artifact-records.json"), bundle.artifacts);
        writeJson(node_path_1.default.join(workbookRoot, "evidence", `${bundle.evidencePack.evidence_pack_id}.json`), bundle.evidencePack);
        bundle.auditEvents.forEach((event) => writeJson(node_path_1.default.join(workbookRoot, "audit", `${event.event_id}.json`), event));
        bundle.lineageEdges.forEach((edge) => writeJson(node_path_1.default.join(workbookRoot, "lineage", `${edge.edge_id}.json`), edge));
        if (bundle.publication) {
            writeJson(node_path_1.default.join(workbookRoot, "publications", `${bundle.publication.publication_id}.json`), bundle.publication);
        }
        let persistedWorkbookPath = null;
        if (bundle.exportedWorkbookPath && node_fs_1.default.existsSync(bundle.exportedWorkbookPath)) {
            persistedWorkbookPath = node_path_1.default.join(workbookRoot, "published", node_path_1.default.basename(bundle.exportedWorkbookPath));
            ensureDirectory(node_path_1.default.dirname(persistedWorkbookPath));
            node_fs_1.default.copyFileSync(bundle.exportedWorkbookPath, persistedWorkbookPath);
        }
        const chartsPath = node_path_1.default.join(workbookRoot, "charts");
        ensureDirectory(chartsPath);
        bundle.chartPaths.forEach((chartPath) => {
            if (!node_fs_1.default.existsSync(chartPath))
                return;
            node_fs_1.default.copyFileSync(chartPath, node_path_1.default.join(chartsPath, node_path_1.default.basename(chartPath)));
        });
        let backendManifestPath = null;
        let backendObjectManifestPath = null;
        let backendServiceRef = null;
        let publicationBackendRef = null;
        const serviceRoot = this.backendServiceRoot("object-store");
        ensureDirectory(serviceRoot);
        const serviceManifestPath = writeJson(node_path_1.default.join(serviceRoot, "manifest.json"), {
            service_name: "excel-engine-object-store",
            service_ref: "backend://excel-engine/services/object-store",
            object_root: node_path_1.default.join(this.backendRootDir, "objects"),
            publication_root: node_path_1.default.join(this.backendRootDir, "publications"),
            updated_at: new Date().toISOString()
        });
        backendServiceRef = "backend://excel-engine/services/object-store";
        if (bundle.publication) {
            const backendRoot = this.backendPublicationRoot(bundle.publication.publication_id);
            ensureDirectory(backendRoot);
            const backendWorkbookPath = persistedWorkbookPath ? node_path_1.default.join(backendRoot, node_path_1.default.basename(persistedWorkbookPath)) : null;
            if (persistedWorkbookPath && backendWorkbookPath) {
                node_fs_1.default.copyFileSync(persistedWorkbookPath, backendWorkbookPath);
            }
            let objectRef = null;
            if (persistedWorkbookPath) {
                const checksum = node_crypto_1.default.createHash("sha256").update(node_fs_1.default.readFileSync(persistedWorkbookPath)).digest("hex");
                const objectId = `object-${checksum.slice(0, 16)}`;
                const objectRoot = this.backendObjectRoot(objectId);
                ensureDirectory(objectRoot);
                const objectPath = node_path_1.default.join(objectRoot, node_path_1.default.basename(persistedWorkbookPath));
                node_fs_1.default.copyFileSync(persistedWorkbookPath, objectPath);
                objectRef = `backend://excel-engine/objects/${objectId}`;
                backendObjectManifestPath = writeJson(node_path_1.default.join(objectRoot, "manifest.json"), {
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
            backendManifestPath = writeJson(node_path_1.default.join(backendRoot, "manifest.json"), {
                publication_id: bundle.publication.publication_id,
                backend_ref: publicationBackendRef,
                service_ref: backendServiceRef,
                artifact_ref: bundle.publication.artifact_ref,
                workbook_ref: bundle.workbookId,
                download_path: backendWorkbookPath,
                object_manifest_path: backendObjectManifestPath,
                object_ref: objectRef,
                audit_path: node_path_1.default.join(workbookRoot, "audit"),
                evidence_path: node_path_1.default.join(workbookRoot, "evidence", `${bundle.evidencePack.evidence_pack_id}.json`),
                updated_at: new Date().toISOString()
            });
            writeJson(node_path_1.default.join(this.backendRootDir, "publication-index.json"), {
                latest_publication_id: bundle.publication.publication_id,
                backend_ref: publicationBackendRef,
                service_ref: backendServiceRef,
                manifest_path: backendManifestPath,
                object_manifest_path: backendObjectManifestPath,
                workbook_id: bundle.workbookId,
                artifact_ref: bundle.publication.artifact_ref,
                updated_at: new Date().toISOString()
            });
            writeJson(node_path_1.default.join(this.backendRootDir, "artifact-index.json"), {
                workbook_id: bundle.workbookId,
                artifact_ids: bundle.artifacts.map((artifact) => artifact.artifact_id),
                service_manifest_path: serviceManifestPath,
                updated_at: new Date().toISOString()
            });
        }
        return exports.ExcelStoreManifestSchema.parse({
            manifest_id: `excel-store-${bundle.workbookId}`,
            store_root: this.rootDir,
            workbook_state_path: workbookStatePath,
            workbook_versions_path: workbookVersionsPath,
            publications_path: node_path_1.default.join(workbookRoot, "publications"),
            artifacts_path: node_path_1.default.join(workbookRoot, "artifacts", "artifact-records.json"),
            evidence_path: node_path_1.default.join(workbookRoot, "evidence", `${bundle.evidencePack.evidence_pack_id}.json`),
            audit_path: node_path_1.default.join(workbookRoot, "audit"),
            lineage_path: node_path_1.default.join(workbookRoot, "lineage"),
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
exports.ExcelEngineStore = ExcelEngineStore;
