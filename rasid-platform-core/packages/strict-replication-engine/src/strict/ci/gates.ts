/**
 * CI/CD Gates for STRICT Mode — Section 4 Enforcement
 *
 * All gates MUST pass for merge and release. Failure on any gate blocks both.
 *
 * Gates:
 *   1. AntiDummyCodeGate  — scans source for placeholder/stub/mock/TODO in runtime paths
 *   2. PixelGate          — validates PixelDiff==0 for all golden corpus entries
 *   3. StructuralGate     — validates structural equivalence for all entries
 *   4. DeterminismGate    — validates deterministic rendering for all entries
 *   5. FunctionalGate     — validates functional tests (dashboard filters/drill/export, excel recalc)
 *   6. PerformanceEnvelopeGate — validates pipeline runs within time/memory budget
 */

import * as fs from 'fs';
import * as path from 'path';
import type { EvidencePack, HashBundle, DiffRef } from '../cdr/types';

// ─── Types ──────────────────────────────────────────────────────────

export interface GateResult {
  gate_name: string;
  pass: boolean;
  violations: string[];
  duration_ms: number;
  timestamp: string;
}

export interface CIRunResult {
  pass: boolean;
  gates: GateResult[];
  fail_means_no_merge: true;
  fail_means_no_release: true;
}

// ─── Anti-Dummy Pattern Definitions ─────────────────────────────────

interface PatternRule {
  pattern: RegExp;
  description: string;
  /** If true, only flag when the match is NOT inside a comment */
  runtime_only: boolean;
}

const ANTI_DUMMY_PATTERNS: PatternRule[] = [
  {
    pattern: /\bTODO\b/,
    description: 'TODO marker found in runtime code',
    runtime_only: true,
  },
  {
    pattern: /In production:/i,
    description: 'Stub comment indicating incomplete implementation',
    runtime_only: false,
  },
  {
    pattern: /\bplaceholder\b/i,
    description: 'Placeholder reference in runtime code',
    runtime_only: true,
  },
  {
    pattern: /\bmock\b/i,
    description: 'Mock reference in runtime code',
    runtime_only: true,
  },
  {
    pattern: /\bfake\b/i,
    description: 'Fake reference in runtime code',
    runtime_only: true,
  },
  {
    pattern: /demo fixture/i,
    description: 'Demo fixture reference in runtime code',
    runtime_only: true,
  },
  {
    pattern: /throw new Error\(\s*['"]not implemented['"]\s*\)/i,
    description: 'Not-implemented error thrown at runtime',
    runtime_only: true,
  },
  {
    pattern: /return\s+['"][^'"]*['"];?\s*$/,
    description: 'Function returning hardcoded string literal without logic',
    runtime_only: true,
  },
  {
    pattern: /return\s+\d+\s*;?\s*$/,
    description: 'Function returning hardcoded numeric literal without logic',
    runtime_only: true,
  },
  {
    pattern: /app\.(get|post|put|patch|delete)\s*\([^)]*,\s*\(_?req\s*,\s*_?res\)\s*=>\s*\{\s*\}\s*\)/,
    description: 'Route handler with empty body (no real handler)',
    runtime_only: true,
  },
  {
    pattern: /FIXME:\s*stub/i,
    description: 'FIXME stub marker',
    runtime_only: false,
  },
  {
    pattern: /\/\/\s*DUMMY/i,
    description: 'DUMMY comment marker',
    runtime_only: false,
  },
  {
    pattern: /console\.log\(\s*['"]FAKE/i,
    description: 'Console log with FAKE prefix indicating stub behavior',
    runtime_only: true,
  },
];

// ─── Utility: Comment Detection ─────────────────────────────────────

/**
 * Determines whether a given position in a line falls inside a comment.
 * Handles single-line comments (//) and does a best-effort check.
 * Does NOT handle multi-line block comments spanning multiple lines —
 * callers should strip block comments from file content before scanning.
 */
function isInsideLineComment(line: string, matchIndex: number): boolean {
  const singleLineCommentStart = line.indexOf('//');
  if (singleLineCommentStart !== -1 && singleLineCommentStart < matchIndex) {
    return true;
  }
  return false;
}

/**
 * Strips block comments from source content, replacing them with
 * equivalent whitespace to preserve line numbers.
 */
function stripBlockComments(content: string): string {
  let result = '';
  let i = 0;
  let inBlock = false;

  while (i < content.length) {
    if (!inBlock && content[i] === '/' && content[i + 1] === '*') {
      inBlock = true;
      result += '  ';
      i += 2;
      continue;
    }
    if (inBlock && content[i] === '*' && content[i + 1] === '/') {
      inBlock = false;
      result += '  ';
      i += 2;
      continue;
    }
    if (inBlock) {
      // Preserve newlines so line numbers stay correct
      result += content[i] === '\n' ? '\n' : ' ';
    } else {
      result += content[i];
    }
    i++;
  }
  return result;
}

/**
 * Checks if a line is inside a string literal context (rough heuristic).
 * We skip lines that are purely inside template literals or string assignments
 * for test/spec files.
 */
function isTestOrSpecFile(filePath: string): boolean {
  const lower = filePath.toLowerCase();
  return (
    lower.includes('.spec.') ||
    lower.includes('.test.') ||
    lower.includes('__tests__') ||
    lower.includes('__mocks__') ||
    lower.includes('/test/') ||
    lower.includes('/tests/')
  );
}

// ─── Gate Implementations ───────────────────────────────────────────

/**
 * Gate 1: AntiDummyCodeGate
 *
 * Scans .ts source files for placeholder/stub/mock/TODO patterns in runtime
 * paths. Skips test files and spec files. For runtime_only patterns, only
 * flags matches that are NOT inside comments.
 */
function runAntiDummyCodeGate(corpusDir: string): GateResult {
  const start = Date.now();
  const violations: string[] = [];

  const tsFiles = collectTypeScriptFiles(corpusDir);

  for (const filePath of tsFiles) {
    // Skip test/spec files — we only care about runtime paths
    if (isTestOrSpecFile(filePath)) {
      continue;
    }

    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      violations.push(`${filePath}: unable to read file`);
      continue;
    }

    const strippedContent = stripBlockComments(content);
    const lines = strippedContent.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const lineNumber = lineIndex + 1;

      for (const rule of ANTI_DUMMY_PATTERNS) {
        const match = rule.pattern.exec(line);
        if (!match) continue;

        if (rule.runtime_only) {
          // Only flag if match is NOT inside a single-line comment
          if (isInsideLineComment(line, match.index)) {
            continue;
          }
        }

        violations.push(
          `${path.relative(corpusDir, filePath)}:${lineNumber}: ${rule.description} — matched "${match[0]}"`
        );
      }
    }
  }

  // Additional scan: detect functions that return static values without branching
  for (const filePath of tsFiles) {
    if (isTestOrSpecFile(filePath)) continue;

    let content: string;
    try {
      content = fs.readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }

    const strippedContent = stripBlockComments(content);
    const functionBodyRegex = /(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s*)?\([^)]*\)\s*(?::\s*[^=>{]+)?\s*=>)\s*\{([^{}]*)\}/g;
    let fnMatch: RegExpExecArray | null;

    while ((fnMatch = functionBodyRegex.exec(strippedContent)) !== null) {
      const body = fnMatch[1].trim();
      // Flag trivial function bodies that just return a literal with no logic
      if (/^return\s+(?:['"`][^'"`]*['"`]|\d+|true|false|null|undefined|\[\]|\{\})\s*;?\s*$/.test(body)) {
        const linesBefore = strippedContent.substring(0, fnMatch.index).split('\n').length;
        violations.push(
          `${path.relative(corpusDir, filePath)}:${linesBefore}: function body returns hardcoded value without real logic`
        );
      }
    }
  }

  return {
    gate_name: 'AntiDummyCodeGate',
    pass: violations.length === 0,
    violations,
    duration_ms: Date.now() - start,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Gate 2: PixelGate
 *
 * Validates that PixelDiff==0 for ALL golden corpus entries.
 * Reads evidence packs from the corpus directory and checks every
 * pixel diff report.
 */
function runPixelGate(corpusDir: string): GateResult {
  const start = Date.now();
  const violations: string[] = [];

  const evidencePacks = loadEvidencePacks(corpusDir);

  if (evidencePacks.length === 0) {
    violations.push('No evidence packs found in corpus directory — gate cannot pass without evidence');
    return makeGateResult('PixelGate', false, violations, start);
  }

  for (const { fileName, pack } of evidencePacks) {
    if (!pack.pixel_diff_reports || pack.pixel_diff_reports.length === 0) {
      violations.push(`${fileName}: no pixel diff reports found in evidence pack`);
      continue;
    }

    for (const diff of pack.pixel_diff_reports) {
      if (diff.pixel_diff !== 0) {
        violations.push(
          `${fileName}: diff ${diff.diff_id} has pixel_diff=${diff.pixel_diff} (required: 0)`
        );
      }
      if (!diff.pass) {
        violations.push(
          `${fileName}: diff ${diff.diff_id} has pass=false`
        );
      }
    }
  }

  return makeGateResult('PixelGate', violations.length === 0, violations, start);
}

/**
 * Gate 3: StructuralGate
 *
 * Validates structural equivalence by comparing structural_hash,
 * layout_hash, and typography_hash across all source/target render
 * pairs in each evidence pack.
 */
function runStructuralGate(corpusDir: string): GateResult {
  const start = Date.now();
  const violations: string[] = [];

  const evidencePacks = loadEvidencePacks(corpusDir);

  if (evidencePacks.length === 0) {
    violations.push('No evidence packs found — structural gate cannot pass without evidence');
    return makeGateResult('StructuralGate', false, violations, start);
  }

  for (const { fileName, pack } of evidencePacks) {
    if (!pack.structural_hashes || pack.structural_hashes.length === 0) {
      violations.push(`${fileName}: no structural hashes in evidence pack`);
      continue;
    }

    for (let i = 0; i < pack.structural_hashes.length; i++) {
      const hashBundle = pack.structural_hashes[i];

      if (!hashBundle.structural_hash || hashBundle.structural_hash.length < 16) {
        violations.push(
          `${fileName}: structural_hashes[${i}] has invalid structural_hash (must be at least 16 chars)`
        );
      }
      if (!hashBundle.layout_hash || hashBundle.layout_hash.length < 16) {
        violations.push(
          `${fileName}: structural_hashes[${i}] has invalid layout_hash (must be at least 16 chars)`
        );
      }
      if (!hashBundle.typography_hash || hashBundle.typography_hash.length < 16) {
        violations.push(
          `${fileName}: structural_hashes[${i}] has invalid typography_hash (must be at least 16 chars)`
        );
      }
    }

    // Cross-validate: source and target renders must produce matching structural hashes
    if (pack.source_renders && pack.target_renders) {
      for (let i = 0; i < Math.min(pack.source_renders.length, pack.target_renders.length); i++) {
        const srcFp = pack.source_renders[i].fingerprint;
        const tgtFp = pack.target_renders[i].fingerprint;

        if (srcFp.structural_hash !== tgtFp.structural_hash) {
          violations.push(
            `${fileName}: render pair [${i}] structural_hash mismatch — ` +
            `source=${srcFp.structural_hash.slice(0, 16)} vs target=${tgtFp.structural_hash.slice(0, 16)}`
          );
        }
        if (srcFp.layout_hash !== tgtFp.layout_hash) {
          violations.push(
            `${fileName}: render pair [${i}] layout_hash mismatch — ` +
            `source=${srcFp.layout_hash.slice(0, 16)} vs target=${tgtFp.layout_hash.slice(0, 16)}`
          );
        }
      }
    }
  }

  return makeGateResult('StructuralGate', violations.length === 0, violations, start);
}

/**
 * Gate 4: DeterminismGate
 *
 * Validates that rendering is deterministic: same input always produces
 * same output. Checks the determinism_report in each evidence pack.
 */
function runDeterminismGate(corpusDir: string): GateResult {
  const start = Date.now();
  const violations: string[] = [];

  const evidencePacks = loadEvidencePacks(corpusDir);

  if (evidencePacks.length === 0) {
    violations.push('No evidence packs found — determinism gate cannot pass without evidence');
    return makeGateResult('DeterminismGate', false, violations, start);
  }

  for (const { fileName, pack } of evidencePacks) {
    if (!pack.determinism_report) {
      violations.push(`${fileName}: no determinism_report in evidence pack`);
      continue;
    }

    const report = pack.determinism_report;

    if (!report.same_input_rerun_equals) {
      violations.push(
        `${fileName}: same_input_rerun_equals is false — renders are non-deterministic`
      );
    }

    const checks = report.checks;
    if (!checks) {
      violations.push(`${fileName}: no determinism checks present`);
      continue;
    }

    if (checks.anti_aliasing_policy !== 'locked') {
      violations.push(
        `${fileName}: anti_aliasing_policy="${checks.anti_aliasing_policy}" (required: "locked")`
      );
    }
    if (checks.float_norm_policy !== 'locked') {
      violations.push(
        `${fileName}: float_norm_policy="${checks.float_norm_policy}" (required: "locked")`
      );
    }
    if (!checks.random_seed_locked) {
      violations.push(
        `${fileName}: random_seed_locked is false (required: true)`
      );
    }
    if (checks.gpu_cpu_parity !== 'validated' && checks.gpu_cpu_parity !== 'forced_single_path') {
      violations.push(
        `${fileName}: gpu_cpu_parity="${checks.gpu_cpu_parity}" (required: "validated" or "forced_single_path")`
      );
    }
  }

  return makeGateResult('DeterminismGate', violations.length === 0, violations, start);
}

/**
 * Gate 5: FunctionalGate
 *
 * Validates functional tests: dashboard filters, drill-down, export,
 * and Excel recalculation. Reads functional_tests_report from evidence packs.
 */
function runFunctionalGate(corpusDir: string): GateResult {
  const start = Date.now();
  const violations: string[] = [];

  const evidencePacks = loadEvidencePacks(corpusDir);

  if (evidencePacks.length === 0) {
    violations.push('No evidence packs found — functional gate cannot pass without evidence');
    return makeGateResult('FunctionalGate', false, violations, start);
  }

  for (const { fileName, pack } of evidencePacks) {
    const ft = pack.functional_tests_report;
    if (!ft) {
      violations.push(`${fileName}: no functional_tests_report in evidence pack`);
      continue;
    }

    // Dashboard functional tests
    if (ft.dashboard_filters === false) {
      violations.push(`${fileName}: dashboard_filters test FAILED`);
    }
    if (ft.dashboard_drill === false) {
      violations.push(`${fileName}: dashboard_drill test FAILED`);
    }
    if (ft.dashboard_export === false) {
      violations.push(`${fileName}: dashboard_export test FAILED`);
    }

    // Excel functional tests
    if (ft.excel_recalc === false) {
      violations.push(`${fileName}: excel_recalc test FAILED`);
    }

    // Ensure at least one functional test was actually executed
    const hasAnyTest =
      ft.dashboard_filters !== undefined ||
      ft.dashboard_drill !== undefined ||
      ft.dashboard_export !== undefined ||
      ft.excel_recalc !== undefined;

    if (!hasAnyTest) {
      violations.push(
        `${fileName}: functional_tests_report is empty — no tests were executed`
      );
    }
  }

  return makeGateResult('FunctionalGate', violations.length === 0, violations, start);
}

/**
 * Gate 6: PerformanceEnvelopeGate
 *
 * Validates that the pipeline ran within time and memory budgets.
 * Reads performance metrics from performance-metrics.json files in the corpus.
 */

export interface PerformanceEnvelope {
  max_pipeline_duration_ms: number;
  max_render_duration_ms: number;
  max_export_duration_ms: number;
  max_memory_mb: number;
}

const DEFAULT_ENVELOPE: PerformanceEnvelope = {
  max_pipeline_duration_ms: 300_000,  // 5 minutes
  max_render_duration_ms: 60_000,     // 1 minute
  max_export_duration_ms: 120_000,    // 2 minutes
  max_memory_mb: 4096,                // 4GB
};

interface PerformanceMetrics {
  pipeline_duration_ms: number;
  render_duration_ms: number;
  export_duration_ms: number;
  peak_memory_mb: number;
}

function runPerformanceEnvelopeGate(
  corpusDir: string,
  envelope: PerformanceEnvelope = DEFAULT_ENVELOPE,
): GateResult {
  const start = Date.now();
  const violations: string[] = [];

  const metricsFiles = collectFiles(corpusDir, (f) => f.endsWith('performance-metrics.json'));

  if (metricsFiles.length === 0) {
    violations.push('No performance-metrics.json files found in corpus directory');
    return makeGateResult('PerformanceEnvelopeGate', false, violations, start);
  }

  for (const metricsFile of metricsFiles) {
    let metrics: PerformanceMetrics;
    try {
      const raw = fs.readFileSync(metricsFile, 'utf-8');
      metrics = JSON.parse(raw) as PerformanceMetrics;
    } catch (err) {
      violations.push(`${path.relative(corpusDir, metricsFile)}: failed to parse — ${String(err)}`);
      continue;
    }

    const relPath = path.relative(corpusDir, metricsFile);

    if (typeof metrics.pipeline_duration_ms !== 'number') {
      violations.push(`${relPath}: missing pipeline_duration_ms`);
    } else if (metrics.pipeline_duration_ms > envelope.max_pipeline_duration_ms) {
      violations.push(
        `${relPath}: pipeline_duration_ms=${metrics.pipeline_duration_ms} exceeds max ${envelope.max_pipeline_duration_ms}`
      );
    }

    if (typeof metrics.render_duration_ms !== 'number') {
      violations.push(`${relPath}: missing render_duration_ms`);
    } else if (metrics.render_duration_ms > envelope.max_render_duration_ms) {
      violations.push(
        `${relPath}: render_duration_ms=${metrics.render_duration_ms} exceeds max ${envelope.max_render_duration_ms}`
      );
    }

    if (typeof metrics.export_duration_ms !== 'number') {
      violations.push(`${relPath}: missing export_duration_ms`);
    } else if (metrics.export_duration_ms > envelope.max_export_duration_ms) {
      violations.push(
        `${relPath}: export_duration_ms=${metrics.export_duration_ms} exceeds max ${envelope.max_export_duration_ms}`
      );
    }

    if (typeof metrics.peak_memory_mb !== 'number') {
      violations.push(`${relPath}: missing peak_memory_mb`);
    } else if (metrics.peak_memory_mb > envelope.max_memory_mb) {
      violations.push(
        `${relPath}: peak_memory_mb=${metrics.peak_memory_mb} exceeds max ${envelope.max_memory_mb}`
      );
    }
  }

  return makeGateResult('PerformanceEnvelopeGate', violations.length === 0, violations, start);
}

// ─── Helper: Collect TypeScript Files ───────────────────────────────

function collectTypeScriptFiles(dir: string): string[] {
  return collectFiles(dir, (fileName) => fileName.endsWith('.ts') || fileName.endsWith('.tsx'));
}

function collectFiles(dir: string, predicate: (fileName: string) => boolean): string[] {
  const results: string[] = [];

  if (!fs.existsSync(dir)) {
    return results;
  }

  const stat = fs.statSync(dir);
  if (!stat.isDirectory()) {
    return results;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      // Skip node_modules and hidden directories
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
        continue;
      }
      results.push(...collectFiles(fullPath, predicate));
    } else if (entry.isFile() && predicate(entry.name)) {
      results.push(fullPath);
    }
  }

  return results;
}

// ─── Helper: Load Evidence Packs ────────────────────────────────────

function loadEvidencePacks(
  corpusDir: string,
): Array<{ fileName: string; pack: EvidencePack }> {
  const results: Array<{ fileName: string; pack: EvidencePack }> = [];

  const jsonFiles = collectFiles(corpusDir, (f) =>
    f.endsWith('.json') && (f.includes('evidence') || f.includes('pack'))
  );

  // Also check for a flat evidence-packs directory
  const evidenceDir = path.join(corpusDir, 'evidence-packs');
  if (fs.existsSync(evidenceDir)) {
    const extraFiles = collectFiles(evidenceDir, (f) => f.endsWith('.json'));
    for (const ef of extraFiles) {
      if (!jsonFiles.includes(ef)) {
        jsonFiles.push(ef);
      }
    }
  }

  for (const jsonFile of jsonFiles) {
    try {
      const raw = fs.readFileSync(jsonFile, 'utf-8');
      const parsed = JSON.parse(raw);

      // Validate it looks like an EvidencePack by checking for required fields
      if (
        parsed &&
        typeof parsed.run_id === 'string' &&
        typeof parsed.timestamp === 'string' &&
        Array.isArray(parsed.source_renders)
      ) {
        results.push({
          fileName: path.relative(corpusDir, jsonFile),
          pack: parsed as EvidencePack,
        });
      }
    } catch {
      // Skip files that cannot be parsed or don't match the schema
    }
  }

  return results;
}

// ─── Helper: Make Gate Result ───────────────────────────────────────

function makeGateResult(
  gateName: string,
  pass: boolean,
  violations: string[],
  startTime: number,
): GateResult {
  return {
    gate_name: gateName,
    pass,
    violations,
    duration_ms: Date.now() - startTime,
    timestamp: new Date().toISOString(),
  };
}

// ─── Gate Name Registry ─────────────────────────────────────────────

type GateName =
  | 'AntiDummyCodeGate'
  | 'PixelGate'
  | 'StructuralGate'
  | 'DeterminismGate'
  | 'FunctionalGate'
  | 'PerformanceEnvelopeGate';

const ALL_GATE_NAMES: GateName[] = [
  'AntiDummyCodeGate',
  'PixelGate',
  'StructuralGate',
  'DeterminismGate',
  'FunctionalGate',
  'PerformanceEnvelopeGate',
];

// ─── CIGateRunner ───────────────────────────────────────────────────

export class CIGateRunner {
  private readonly corpusDir: string;
  private readonly performanceEnvelope: PerformanceEnvelope;

  constructor(corpusDir: string, performanceEnvelope?: Partial<PerformanceEnvelope>) {
    this.corpusDir = path.resolve(corpusDir);
    this.performanceEnvelope = { ...DEFAULT_ENVELOPE, ...performanceEnvelope };
  }

  /**
   * Run a single gate by name.
   */
  async runGate(gateName: GateName): Promise<GateResult> {
    switch (gateName) {
      case 'AntiDummyCodeGate':
        return runAntiDummyCodeGate(this.corpusDir);
      case 'PixelGate':
        return runPixelGate(this.corpusDir);
      case 'StructuralGate':
        return runStructuralGate(this.corpusDir);
      case 'DeterminismGate':
        return runDeterminismGate(this.corpusDir);
      case 'FunctionalGate':
        return runFunctionalGate(this.corpusDir);
      case 'PerformanceEnvelopeGate':
        return runPerformanceEnvelopeGate(this.corpusDir, this.performanceEnvelope);
      default: {
        const _exhaustive: never = gateName;
        throw new Error(`Unknown gate: ${_exhaustive}`);
      }
    }
  }

  /**
   * Run all six CI gates. ALL must pass for merge and release.
   */
  async runAllGates(): Promise<CIRunResult> {
    const gates: GateResult[] = [];

    for (const gateName of ALL_GATE_NAMES) {
      const result = await this.runGate(gateName);
      gates.push(result);
    }

    const allPass = gates.every((g) => g.pass);

    return {
      pass: allPass,
      gates,
      fail_means_no_merge: true as const,
      fail_means_no_release: true as const,
    };
  }
}
