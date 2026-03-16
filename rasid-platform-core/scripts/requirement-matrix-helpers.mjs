import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

export const root = process.cwd();

export const now = () => new Date().toISOString();
export const stamp = () => now().replace(/[:.]/g, "-");
export const exists = (targetPath) => fs.existsSync(targetPath);
export const ensureDir = (targetPath) => fs.mkdirSync(targetPath, { recursive: true });

export const writeJson = (filePath, payload) => {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
};

export const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, "utf8"));

export const latestCompleteDirectory = (directoryPath, prefix, requiredRelativePath) => {
  if (!exists(directoryPath)) return null;
  const matches = fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
    .map((entry) => path.join(directoryPath, entry.name))
    .filter((candidate) => exists(path.join(candidate, requiredRelativePath)));
  if (matches.length === 0) return null;
  return matches.sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs)[0] ?? null;
};

export const runChecked = (command, args, options = {}) => {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    ...options
  });
  if (result.status !== 0) {
    throw new Error(
      [
        `${command} ${args.join(" ")} failed with status ${result.status ?? "null"}`,
        result.stdout ?? "",
        result.stderr ?? ""
      ].join("\n")
    );
  }
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? ""
  };
};

export const runNodeScript = (relativeScriptPath, options = {}) => runChecked("node", [relativeScriptPath], options);

export const summarizeCounts = (matrix, statuses) =>
  Object.fromEntries(statuses.map((status) => [status, matrix.filter((entry) => entry.status === status).length]));

export const unique = (values) => [...new Set(values)];
