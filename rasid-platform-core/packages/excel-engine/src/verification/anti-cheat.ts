/**
 * Anti-Cheating Verification Engine
 * Namespace: rasid.excel.verification
 *
 * Enforces: no dummy code, no mock outputs, no "done" without artifact + evidence,
 * build determinism for strict claims, screenshots/renders where applicable.
 *
 * Every claim must be backed by:
 * 1. A real artifact file
 * 2. A verifiable evidence pack
 * 3. Audit trail entries
 * 4. Lineage chain
 * 5. Deterministic hash verification
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { SVMWorkbook } from '../svm/types';
import type { SVMPipelineResult } from '../svm/svm-engine';
import type { ExportResult } from '../export/export-pipeline';
import type { AutoAnalyzeResult } from '../analyze/auto-analyze';

// ─── Verification Types ─────────────────────────────────────────────────────

export interface VerificationResult {
  verificationId: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  checks: VerificationCheck[];
  passedCount: number;
  failedCount: number;
  warningCount: number;
  antiCheatScore: number; // 0-100
  evidencePack: VerificationEvidencePack;
  timestamp: string;
}

export interface VerificationCheck {
  checkId: string;
  category: VerificationCategory;
  name: string;
  passed: boolean;
  severity: 'info' | 'warning' | 'error' | 'critical';
  details: string;
  evidence: string | null;
  codeLocation: string | null;
}

export type VerificationCategory =
  | 'no_dummy_code' | 'no_mock_outputs' | 'artifact_exists'
  | 'evidence_exists' | 'determinism' | 'drift_gate'
  | 'audit_trail' | 'lineage_chain' | 'build_determinism'
  | 'export_validity' | 'runtime_integrity';

export interface VerificationEvidencePack {
  packId: string;
  verificationId: string;
  workbookId: string;
  svmPipelineHash: string | null;
  exportHashes: Map<string, string>;
  artifactPaths: string[];
  auditEventCount: number;
  lineageEdgeCount: number;
  deterministicRecalcProof: DeterministicProof | null;
  timestamp: string;
}

export interface DeterministicProof {
  runCount: number;
  allHashesMatch: boolean;
  hashes: string[];
  executionSeeds: string[];
  durationMs: number[];
}

// ─── Anti-Cheat Engine ──────────────────────────────────────────────────────

export class AntiCheatVerifier {
  /**
   * Run full anti-cheating verification on a workbook and its outputs.
   */
  verify(input: AntiCheatInput): VerificationResult {
    const verificationId = `verify-${crypto.randomUUID()}`;
    const checks: VerificationCheck[] = [];

    // 1. No dummy code checks
    checks.push(...this.checkNoDummyCode(input));

    // 2. No mock outputs
    checks.push(...this.checkNoMockOutputs(input));

    // 3. Artifact existence
    checks.push(...this.checkArtifactExistence(input));

    // 4. Evidence existence
    checks.push(...this.checkEvidenceExistence(input));

    // 5. Determinism checks
    checks.push(...this.checkDeterminism(input));

    // 6. Drift gate
    checks.push(...this.checkDriftGate(input));

    // 7. Audit trail
    checks.push(...this.checkAuditTrail(input));

    // 8. Lineage chain
    checks.push(...this.checkLineageChain(input));

    // 9. Build determinism
    checks.push(...this.checkBuildDeterminism(input));

    // 10. Export validity
    checks.push(...this.checkExportValidity(input));

    // Compute results
    const passedCount = checks.filter(c => c.passed).length;
    const failedCount = checks.filter(c => !c.passed && (c.severity === 'error' || c.severity === 'critical')).length;
    const warningCount = checks.filter(c => !c.passed && c.severity === 'warning').length;
    const antiCheatScore = checks.length > 0 ? Math.round((passedCount / checks.length) * 100) : 0;

    const status: VerificationResult['status'] =
      failedCount > 0 ? 'FAIL' : warningCount > 0 ? 'WARN' : 'PASS';

    // Build evidence pack
    const evidencePack = this.buildEvidencePack(verificationId, input, checks);

    return {
      verificationId,
      status,
      checks,
      passedCount,
      failedCount,
      warningCount,
      antiCheatScore,
      evidencePack,
      timestamp: new Date().toISOString(),
    };
  }

  // ─── Check: No Dummy Code ────────────────────────────────────────────

  private checkNoDummyCode(input: AntiCheatInput): VerificationCheck[] {
    const checks: VerificationCheck[] = [];

    // Check SVM has real cells
    if (input.workbook) {
      let totalCells = 0;
      for (const [, sheet] of input.workbook.sheets) {
        totalCells += sheet.cells.size;
      }

      checks.push({
        checkId: `chk-${crypto.randomUUID().slice(0, 8)}`,
        category: 'no_dummy_code',
        name: 'SVM contains real cell data',
        passed: totalCells > 0,
        severity: 'critical',
        details: `SVM workbook contains ${totalCells} cells`,
        evidence: null,
        codeLocation: 'svm/svm-engine.ts',
      });
    }

    // Check pipeline result is not empty
    if (input.pipelineResult) {
      checks.push({
        checkId: `chk-${crypto.randomUUID().slice(0, 8)}`,
        category: 'no_dummy_code',
        name: 'Pipeline executed with real results',
        passed: input.pipelineResult.recalcResult.cellsEvaluated > 0 || input.pipelineResult.dagNodeCount === 0,
        severity: 'error',
        details: `Evaluated ${input.pipelineResult.recalcResult.cellsEvaluated} cells, ${input.pipelineResult.dagNodeCount} DAG nodes`,
        evidence: input.pipelineResult.recalcResult.resultHash,
        codeLocation: 'svm/recalc-engine.ts',
      });

      // Check determinism flag
      checks.push({
        checkId: `chk-${crypto.randomUUID().slice(0, 8)}`,
        category: 'no_dummy_code',
        name: 'Pipeline claims deterministic execution',
        passed: input.pipelineResult.recalcResult.deterministic,
        severity: 'error',
        details: input.pipelineResult.recalcResult.deterministic
          ? 'Recalculation was deterministic'
          : 'Recalculation was NOT deterministic (errors occurred)',
        evidence: null,
        codeLocation: 'svm/recalc-engine.ts',
      });
    }

    return checks;
  }

  // ─── Check: No Mock Outputs ───────────────────────────────────────────

  private checkNoMockOutputs(input: AntiCheatInput): VerificationCheck[] {
    const checks: VerificationCheck[] = [];

    for (const exportResult of input.exports) {
      // Check file actually exists
      checks.push({
        checkId: `chk-${crypto.randomUUID().slice(0, 8)}`,
        category: 'no_mock_outputs',
        name: `Export file exists: ${path.basename(exportResult.outputPath)}`,
        passed: fs.existsSync(exportResult.outputPath),
        severity: 'critical',
        details: `Checking ${exportResult.outputPath}`,
        evidence: exportResult.checksum,
        codeLocation: 'export/export-pipeline.ts',
      });

      // Check file is not empty
      if (fs.existsSync(exportResult.outputPath)) {
        const size = fs.statSync(exportResult.outputPath).size;
        checks.push({
          checkId: `chk-${crypto.randomUUID().slice(0, 8)}`,
          category: 'no_mock_outputs',
          name: `Export file non-empty: ${path.basename(exportResult.outputPath)}`,
          passed: size > 0,
          severity: 'critical',
          details: `File size: ${size} bytes`,
          evidence: null,
          codeLocation: 'export/export-pipeline.ts',
        });

        // Check file content is valid (not just "{}" or "[]")
        if (size < 10) {
          checks.push({
            checkId: `chk-${crypto.randomUUID().slice(0, 8)}`,
            category: 'no_mock_outputs',
            name: `Export file has substantial content: ${path.basename(exportResult.outputPath)}`,
            passed: false,
            severity: 'error',
            details: `File is suspiciously small (${size} bytes)`,
            evidence: null,
            codeLocation: 'export/export-pipeline.ts',
          });
        }
      }

      // Check lineage metadata exists alongside export
      const lineagePath = exportResult.outputPath.replace(/\.[^.]+$/, '.lineage.json');
      checks.push({
        checkId: `chk-${crypto.randomUUID().slice(0, 8)}`,
        category: 'no_mock_outputs',
        name: `Lineage metadata exists for: ${path.basename(exportResult.outputPath)}`,
        passed: fs.existsSync(lineagePath),
        severity: 'error',
        details: `Checking ${lineagePath}`,
        evidence: null,
        codeLocation: 'export/export-pipeline.ts',
      });
    }

    return checks;
  }

  // ─── Check: Artifact Existence ────────────────────────────────────────

  private checkArtifactExistence(input: AntiCheatInput): VerificationCheck[] {
    const checks: VerificationCheck[] = [];

    for (const artifactPath of input.artifactPaths) {
      checks.push({
        checkId: `chk-${crypto.randomUUID().slice(0, 8)}`,
        category: 'artifact_exists',
        name: `Artifact exists: ${path.basename(artifactPath)}`,
        passed: fs.existsSync(artifactPath),
        severity: 'critical',
        details: `Checking ${artifactPath}`,
        evidence: fs.existsSync(artifactPath)
          ? crypto.createHash('sha256').update(fs.readFileSync(artifactPath)).digest('hex')
          : null,
        codeLocation: null,
      });
    }

    return checks;
  }

  // ─── Check: Evidence Existence ────────────────────────────────────────

  private checkEvidenceExistence(input: AntiCheatInput): VerificationCheck[] {
    const checks: VerificationCheck[] = [];

    if (input.pipelineResult) {
      checks.push({
        checkId: `chk-${crypto.randomUUID().slice(0, 8)}`,
        category: 'evidence_exists',
        name: 'SVM pipeline has snapshot evidence',
        passed: input.pipelineResult.snapshotId.length > 0,
        severity: 'error',
        details: `Snapshot ID: ${input.pipelineResult.snapshotId}`,
        evidence: input.pipelineResult.snapshotId,
        codeLocation: 'svm/snapshot.ts',
      });

      checks.push({
        checkId: `chk-${crypto.randomUUID().slice(0, 8)}`,
        category: 'evidence_exists',
        name: 'DAG hash is computed',
        passed: input.pipelineResult.formulaDAGHash.length > 0,
        severity: 'error',
        details: `DAG hash: ${input.pipelineResult.formulaDAGHash.slice(0, 16)}...`,
        evidence: input.pipelineResult.formulaDAGHash,
        codeLocation: 'svm/formula-dag.ts',
      });
    }

    if (input.analysisResult) {
      checks.push({
        checkId: `chk-${crypto.randomUUID().slice(0, 8)}`,
        category: 'evidence_exists',
        name: 'Auto-analysis produced real results',
        passed: input.analysisResult.columnProfiles.length > 0,
        severity: 'error',
        details: `${input.analysisResult.columnProfiles.length} column profiles, ${input.analysisResult.issues.length} issues detected`,
        evidence: input.analysisResult.analysisId,
        codeLocation: 'analyze/auto-analyze.ts',
      });
    }

    return checks;
  }

  // ─── Check: Determinism ───────────────────────────────────────────────

  private checkDeterminism(input: AntiCheatInput): VerificationCheck[] {
    const checks: VerificationCheck[] = [];

    if (input.pipelineResult) {
      // Check recalc determinism
      checks.push({
        checkId: `chk-${crypto.randomUUID().slice(0, 8)}`,
        category: 'determinism',
        name: 'Recalculation is deterministic',
        passed: input.pipelineResult.recalcResult.deterministic,
        severity: 'critical',
        details: `Result hash: ${input.pipelineResult.recalcResult.resultHash.slice(0, 16)}...`,
        evidence: input.pipelineResult.recalcResult.resultHash,
        codeLocation: 'svm/recalc-engine.ts',
      });

      // Check pivot determinism
      for (const pivot of input.pipelineResult.pivotResults) {
        checks.push({
          checkId: `chk-${crypto.randomUUID().slice(0, 8)}`,
          category: 'determinism',
          name: `Pivot reconstruction deterministic: ${pivot.pivotId}`,
          passed: pivot.deterministic,
          severity: 'error',
          details: `Cache hash: ${pivot.cacheHash.slice(0, 16)}...`,
          evidence: pivot.cacheHash,
          codeLocation: 'svm/pivot-reconstruct.ts',
        });
      }

      // Check CF determinism
      for (const cf of input.pipelineResult.conditionalFormatResults) {
        checks.push({
          checkId: `chk-${crypto.randomUUID().slice(0, 8)}`,
          category: 'determinism',
          name: `Conditional formatting deterministic: ${cf.sheet}`,
          passed: cf.deterministic,
          severity: 'error',
          details: `Result hash: ${cf.resultHash.slice(0, 16)}...`,
          evidence: cf.resultHash,
          codeLocation: 'svm/conditional-format.ts',
        });
      }

      // Check drift policy
      checks.push({
        checkId: `chk-${crypto.randomUUID().slice(0, 8)}`,
        category: 'determinism',
        name: 'Drift policy is FAIL_STRICT',
        passed: input.pipelineResult.driftPolicy === 'FAIL_STRICT',
        severity: 'critical',
        details: `Drift policy: ${input.pipelineResult.driftPolicy}`,
        evidence: null,
        codeLocation: 'svm/drift-gate.ts',
      });

      // Check rounding policy
      checks.push({
        checkId: `chk-${crypto.randomUUID().slice(0, 8)}`,
        category: 'determinism',
        name: 'Integer precision is exact',
        passed: input.pipelineResult.roundingPolicy.integerExact,
        severity: 'critical',
        details: `Rounding mode: ${input.pipelineResult.roundingPolicy.mode}, integerExact: ${input.pipelineResult.roundingPolicy.integerExact}`,
        evidence: null,
        codeLocation: 'svm/recalc-engine.ts',
      });
    }

    return checks;
  }

  // ─── Check: Drift Gate ────────────────────────────────────────────────

  private checkDriftGate(input: AntiCheatInput): VerificationCheck[] {
    const checks: VerificationCheck[] = [];

    if (input.driftCheckPassed !== null) {
      checks.push({
        checkId: `chk-${crypto.randomUUID().slice(0, 8)}`,
        category: 'drift_gate',
        name: 'Drift gate passed',
        passed: input.driftCheckPassed,
        severity: 'critical',
        details: input.driftCheckPassed
          ? 'No drift between SVM, rendered, and exported outputs'
          : 'DRIFT DETECTED between SVM and rendered/exported outputs',
        evidence: null,
        codeLocation: 'svm/drift-gate.ts',
      });
    }

    return checks;
  }

  // ─── Check: Audit Trail ───────────────────────────────────────────────

  private checkAuditTrail(input: AntiCheatInput): VerificationCheck[] {
    return [{
      checkId: `chk-${crypto.randomUUID().slice(0, 8)}`,
      category: 'audit_trail',
      name: 'Audit events recorded',
      passed: input.auditEventCount > 0,
      severity: 'error',
      details: `${input.auditEventCount} audit event(s) recorded`,
      evidence: null,
      codeLocation: null,
    }];
  }

  // ─── Check: Lineage Chain ────────────────────────────────────────────

  private checkLineageChain(input: AntiCheatInput): VerificationCheck[] {
    return [{
      checkId: `chk-${crypto.randomUUID().slice(0, 8)}`,
      category: 'lineage_chain',
      name: 'Lineage edges recorded',
      passed: input.lineageEdgeCount > 0,
      severity: 'error',
      details: `${input.lineageEdgeCount} lineage edge(s) recorded`,
      evidence: null,
      codeLocation: null,
    }];
  }

  // ─── Check: Build Determinism ─────────────────────────────────────────

  private checkBuildDeterminism(input: AntiCheatInput): VerificationCheck[] {
    const checks: VerificationCheck[] = [];

    if (input.deterministicProof) {
      checks.push({
        checkId: `chk-${crypto.randomUUID().slice(0, 8)}`,
        category: 'build_determinism',
        name: 'Multiple recalc runs produce identical hashes',
        passed: input.deterministicProof.allHashesMatch,
        severity: 'critical',
        details: `${input.deterministicProof.runCount} runs, hashes match: ${input.deterministicProof.allHashesMatch}`,
        evidence: input.deterministicProof.hashes.join(','),
        codeLocation: 'svm/recalc-engine.ts',
      });
    }

    return checks;
  }

  // ─── Check: Export Validity ───────────────────────────────────────────

  private checkExportValidity(input: AntiCheatInput): VerificationCheck[] {
    const checks: VerificationCheck[] = [];

    for (const exportResult of input.exports) {
      checks.push({
        checkId: `chk-${crypto.randomUUID().slice(0, 8)}`,
        category: 'export_validity',
        name: `Export verification status: ${exportResult.format}`,
        passed: exportResult.evidence.verificationStatus === 'verified',
        severity: 'critical',
        details: `Status: ${exportResult.evidence.verificationStatus}, checksum: ${exportResult.checksum.slice(0, 16)}...`,
        evidence: exportResult.checksum,
        codeLocation: 'export/export-pipeline.ts',
      });
    }

    return checks;
  }

  // ─── Evidence Pack Builder ────────────────────────────────────────────

  private buildEvidencePack(
    verificationId: string,
    input: AntiCheatInput,
    checks: VerificationCheck[]
  ): VerificationEvidencePack {
    return {
      packId: `evpack-${crypto.randomUUID()}`,
      verificationId,
      workbookId: input.workbook?.workbookId ?? 'unknown',
      svmPipelineHash: input.pipelineResult?.recalcResult.resultHash ?? null,
      exportHashes: new Map(
        input.exports.map(e => [e.format, e.checksum])
      ),
      artifactPaths: input.artifactPaths,
      auditEventCount: input.auditEventCount,
      lineageEdgeCount: input.lineageEdgeCount,
      deterministicRecalcProof: input.deterministicProof ?? null,
      timestamp: new Date().toISOString(),
    };
  }
}

// ─── Input Type ─────────────────────────────────────────────────────────────

export interface AntiCheatInput {
  workbook: SVMWorkbook | null;
  pipelineResult: SVMPipelineResult | null;
  analysisResult: AutoAnalyzeResult | null;
  exports: ExportResult[];
  artifactPaths: string[];
  auditEventCount: number;
  lineageEdgeCount: number;
  driftCheckPassed: boolean | null;
  deterministicProof: DeterministicProof | null;
}
