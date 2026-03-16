"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExcelBackendService = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_http_1 = __importDefault(require("node:http"));
const node_path_1 = __importDefault(require("node:path"));
const jsonHeaders = { "content-type": "application/json; charset=utf-8" };
const sendJson = (response, statusCode, payload) => {
    response.writeHead(statusCode, jsonHeaders);
    response.end(`${JSON.stringify(payload, null, 2)}\n`);
};
const safeJoin = (rootDir, relativeSegments) => {
    const candidate = node_path_1.default.resolve(rootDir, ...relativeSegments);
    const normalizedRoot = node_path_1.default.resolve(rootDir);
    return candidate.startsWith(normalizedRoot) ? candidate : null;
};
class ExcelBackendService {
    constructor(backendRootDir) {
        this.backendRootDir = backendRootDir;
        this.server = null;
        this.port = null;
    }
    get baseUrl() {
        if (this.port == null) {
            throw new Error("Excel backend service is not running");
        }
        return `http://127.0.0.1:${this.port}`;
    }
    publicationManifestUrl(publicationId) {
        return `${this.baseUrl}/publications/${encodeURIComponent(publicationId)}/manifest`;
    }
    publicationDownloadUrl(publicationId) {
        return `${this.baseUrl}/publications/${encodeURIComponent(publicationId)}/download`;
    }
    objectManifestUrl(objectId) {
        return `${this.baseUrl}/objects/${encodeURIComponent(objectId)}/manifest`;
    }
    healthUrl() {
        return `${this.baseUrl}/health`;
    }
    serviceManifestUrl() {
        return `${this.baseUrl}/services/object-store/manifest`;
    }
    async start(port = 0) {
        if (this.server != null && this.port != null) {
            return this.baseUrl;
        }
        this.server = node_http_1.default.createServer((request, response) => {
            const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
            const segments = requestUrl.pathname.split("/").filter(Boolean);
            if (request.method !== "GET") {
                sendJson(response, 405, { error: "method_not_allowed" });
                return;
            }
            if (requestUrl.pathname === "/health") {
                sendJson(response, 200, {
                    service: "excel-engine-backend",
                    status: "ok",
                    backend_root: this.backendRootDir,
                    updated_at: new Date().toISOString()
                });
                return;
            }
            if (segments.length === 3 && segments[0] === "services" && segments[1] === "object-store" && segments[2] === "manifest") {
                this.serveFile(["services", "object-store", "manifest.json"], response, true);
                return;
            }
            if (segments.length === 3 && segments[0] === "publications" && segments[2] === "manifest") {
                this.serveFile(["publications", decodeURIComponent(segments[1]), "manifest.json"], response, true);
                return;
            }
            if (segments.length === 3 && segments[0] === "publications" && segments[2] === "download") {
                const manifestPath = safeJoin(this.backendRootDir, ["publications", decodeURIComponent(segments[1]), "manifest.json"]);
                if (!manifestPath || !node_fs_1.default.existsSync(manifestPath)) {
                    sendJson(response, 404, { error: "publication_manifest_not_found" });
                    return;
                }
                const manifest = JSON.parse(node_fs_1.default.readFileSync(manifestPath, "utf8"));
                if (!manifest.download_path || !node_fs_1.default.existsSync(manifest.download_path)) {
                    sendJson(response, 404, { error: "publication_file_not_found" });
                    return;
                }
                const extension = node_path_1.default.extname(manifest.download_path).toLowerCase();
                const contentType = extension === ".xlsx"
                    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    : extension === ".xlsm"
                        ? "application/vnd.ms-excel.sheet.macroEnabled.12"
                        : "application/octet-stream";
                response.writeHead(200, { "content-type": contentType });
                node_fs_1.default.createReadStream(manifest.download_path).pipe(response);
                return;
            }
            if (segments.length === 3 && segments[0] === "objects" && segments[2] === "manifest") {
                this.serveFile(["objects", decodeURIComponent(segments[1]), "manifest.json"], response, true);
                return;
            }
            if (segments.length === 3 && segments[0] === "objects" && segments[2] === "download") {
                const manifestPath = safeJoin(this.backendRootDir, ["objects", decodeURIComponent(segments[1]), "manifest.json"]);
                if (!manifestPath || !node_fs_1.default.existsSync(manifestPath)) {
                    sendJson(response, 404, { error: "object_manifest_not_found" });
                    return;
                }
                const manifest = JSON.parse(node_fs_1.default.readFileSync(manifestPath, "utf8"));
                if (!manifest.object_path || !node_fs_1.default.existsSync(manifest.object_path)) {
                    sendJson(response, 404, { error: "object_file_not_found" });
                    return;
                }
                response.writeHead(200, { "content-type": "application/octet-stream" });
                node_fs_1.default.createReadStream(manifest.object_path).pipe(response);
                return;
            }
            sendJson(response, 404, { error: "not_found", path: requestUrl.pathname });
        });
        await new Promise((resolve, reject) => {
            this.server?.once("error", reject);
            this.server?.listen(port, "127.0.0.1", () => resolve());
        });
        const address = this.server.address();
        if (!address || typeof address === "string") {
            throw new Error("Unable to resolve backend service address");
        }
        this.port = address.port;
        return this.baseUrl;
    }
    async stop() {
        if (!this.server)
            return;
        await new Promise((resolve, reject) => {
            this.server?.close((error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });
        this.server = null;
        this.port = null;
    }
    serveFile(relativeSegments, response, json = false) {
        const filePath = safeJoin(this.backendRootDir, relativeSegments);
        if (!filePath || !node_fs_1.default.existsSync(filePath)) {
            sendJson(response, 404, { error: "file_not_found" });
            return;
        }
        if (json) {
            response.writeHead(200, jsonHeaders);
        }
        else {
            response.writeHead(200, { "content-type": "application/octet-stream" });
        }
        node_fs_1.default.createReadStream(filePath).pipe(response);
    }
}
exports.ExcelBackendService = ExcelBackendService;
