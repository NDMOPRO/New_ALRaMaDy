import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const excelEngine = await import(pathToFileURL(path.join(root, "packages/excel-engine/dist/index.js")).href);

const backendRoot = path.join(root, ".runtime", "excel-engine-backend");
const requestedPort = Number(process.env.EXCEL_BACKEND_PORT ?? "4310");
const service = new excelEngine.ExcelBackendService(backendRoot);

await service.start(requestedPort);

console.log(`excel-backend-service-url=${service.baseUrl}`);
console.log(`excel-backend-service-manifest=${service.serviceManifestUrl()}`);

const stop = async () => {
  await service.stop();
  process.exit(0);
};

process.on("SIGINT", () => {
  void stop();
});

process.on("SIGTERM", () => {
  void stop();
});
