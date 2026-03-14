import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const files = [];
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory() && !["node_modules", ".git"].includes(f)) walk(full);
    if (stat.isFile() && /\.(mjs|d\.ts|json)$/.test(f)) files.push(full);
  }
}
walk(path.join(root, "packages"));
walk(path.join(root, "apps"));
walk(path.join(root, "tools"));
walk(path.join(root, "tests"));
for (const file of files) {
  const text = fs.readFileSync(file, "utf8");
  if (text.includes("\t")) throw new Error(`lint: tabs not allowed ${file}`);
  if (/\bTODO\b/.test(text) && !file.endsWith("tools/lint.mjs")) throw new Error(`lint: unresolved todo-marker ${file}`);
}
console.log(`lint: ok (${files.length} files scanned)`);
