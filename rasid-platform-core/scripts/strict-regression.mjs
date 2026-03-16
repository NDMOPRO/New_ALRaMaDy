import { spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const scriptPath = path.join(root, "packages", "strict-replication-engine", "runtime", "real_pipeline.py");

const result = spawnSync("python", [scriptPath], {
  cwd: root,
  stdio: "inherit"
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
