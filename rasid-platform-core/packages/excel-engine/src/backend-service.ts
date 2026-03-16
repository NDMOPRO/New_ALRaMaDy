import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const jsonHeaders = { "content-type": "application/json; charset=utf-8" };

const sendJson = (response: http.ServerResponse, statusCode: number, payload: unknown): void => {
  response.writeHead(statusCode, jsonHeaders);
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
};

const safeJoin = (rootDir: string, relativeSegments: string[]): string | null => {
  const candidate = path.resolve(rootDir, ...relativeSegments);
  const normalizedRoot = path.resolve(rootDir);
  return candidate.startsWith(normalizedRoot) ? candidate : null;
};

export class ExcelBackendService {
  readonly backendRootDir: string;
  private server: http.Server | null;
  private port: number | null;

  constructor(backendRootDir: string) {
    this.backendRootDir = backendRootDir;
    this.server = null;
    this.port = null;
  }

  get baseUrl(): string {
    if (this.port == null) {
      throw new Error("Excel backend service is not running");
    }
    return `http://127.0.0.1:${this.port}`;
  }

  publicationManifestUrl(publicationId: string): string {
    return `${this.baseUrl}/publications/${encodeURIComponent(publicationId)}/manifest`;
  }

  publicationDownloadUrl(publicationId: string): string {
    return `${this.baseUrl}/publications/${encodeURIComponent(publicationId)}/download`;
  }

  objectManifestUrl(objectId: string): string {
    return `${this.baseUrl}/objects/${encodeURIComponent(objectId)}/manifest`;
  }

  healthUrl(): string {
    return `${this.baseUrl}/health`;
  }

  serviceManifestUrl(): string {
    return `${this.baseUrl}/services/object-store/manifest`;
  }

  async start(port = 0): Promise<string> {
    if (this.server != null && this.port != null) {
      return this.baseUrl;
    }
    this.server = http.createServer((request, response) => {
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
        if (!manifestPath || !fs.existsSync(manifestPath)) {
          sendJson(response, 404, { error: "publication_manifest_not_found" });
          return;
        }
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { download_path?: string | null };
        if (!manifest.download_path || !fs.existsSync(manifest.download_path)) {
          sendJson(response, 404, { error: "publication_file_not_found" });
          return;
        }
        const extension = path.extname(manifest.download_path).toLowerCase();
        const contentType =
          extension === ".xlsx"
            ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            : extension === ".xlsm"
              ? "application/vnd.ms-excel.sheet.macroEnabled.12"
              : "application/octet-stream";
        response.writeHead(200, { "content-type": contentType });
        fs.createReadStream(manifest.download_path).pipe(response);
        return;
      }

      if (segments.length === 3 && segments[0] === "objects" && segments[2] === "manifest") {
        this.serveFile(["objects", decodeURIComponent(segments[1]), "manifest.json"], response, true);
        return;
      }

      if (segments.length === 3 && segments[0] === "objects" && segments[2] === "download") {
        const manifestPath = safeJoin(this.backendRootDir, ["objects", decodeURIComponent(segments[1]), "manifest.json"]);
        if (!manifestPath || !fs.existsSync(manifestPath)) {
          sendJson(response, 404, { error: "object_manifest_not_found" });
          return;
        }
        const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { object_path?: string | null };
        if (!manifest.object_path || !fs.existsSync(manifest.object_path)) {
          sendJson(response, 404, { error: "object_file_not_found" });
          return;
        }
        response.writeHead(200, { "content-type": "application/octet-stream" });
        fs.createReadStream(manifest.object_path).pipe(response);
        return;
      }

      sendJson(response, 404, { error: "not_found", path: requestUrl.pathname });
    });

    await new Promise<void>((resolve, reject) => {
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

  async stop(): Promise<void> {
    if (!this.server) return;
    await new Promise<void>((resolve, reject) => {
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

  private serveFile(relativeSegments: string[], response: http.ServerResponse, json = false): void {
    const filePath = safeJoin(this.backendRootDir, relativeSegments);
    if (!filePath || !fs.existsSync(filePath)) {
      sendJson(response, 404, { error: "file_not_found" });
      return;
    }
    if (json) {
      response.writeHead(200, jsonHeaders);
    } else {
      response.writeHead(200, { "content-type": "application/octet-stream" });
    }
    fs.createReadStream(filePath).pipe(response);
  }
}
