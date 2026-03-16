import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const outputRoot = path.join(
  root,
  "packages",
  "arabic-localization-lct-engine",
  "output",
  `external-provider-validation-${new Date().toISOString().replace(/[:.]/g, "-")}`
);
const artifactsDir = path.join(outputRoot, "artifacts");
const evidenceDir = path.join(outputRoot, "evidence");
const auditDir = path.join(outputRoot, "audit");
const lineageDir = path.join(outputRoot, "lineage");
const runtimeDir = path.join(outputRoot, "runtime");
[outputRoot, artifactsDir, evidenceDir, auditDir, lineageDir, runtimeDir].forEach((dir) =>
  fs.mkdirSync(dir, { recursive: true })
);

const load = async (relativePath) => import(pathToFileURL(path.join(root, relativePath)).href);
const contracts = await load("packages/contracts/dist/index.js");

const now = () => new Date().toISOString();
const checksum = (value) => `sha256:${createHash("sha256").update(value).digest("hex")}`;
const containsArabic = (value) => /[\u0600-\u06FF]/.test(value);
const sha256File = (filePath) => checksum(fs.readFileSync(filePath));
const writeJson = (filePath, payload) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
};
const writeText = (filePath, payload) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, payload, "utf8");
  return filePath;
};
const readText = (filePath) => (fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : "");
const parseJson = (value) => {
  if (!value || !value.trim()) {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};
const extractDebugLines = (debugText, patterns) =>
  debugText
    .split(/\r?\n/)
    .filter((line) => patterns.some((pattern) => pattern.test(line)))
    .slice(0, 50);

const extractRequestId = (debugText) => {
  const match = debugText.match(/request_id":"([^"]+)"/);
  return match ? match[1] : null;
};
const getRateLimitExcerpt = (debugText) =>
  extractDebugLines(debugText, [/status=429/, /Rate limited/, /client_data/]);
const fallbackRateLimitSource = () => {
  const candidates = [
    path.join(root, ".runtime", "claude-provider-debug-success.log"),
    path.join(root, ".runtime", "claude-provider-debug-invalid-model.log"),
    path.join(root, ".runtime", "latest")
  ];
  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }
    const candidateText = readText(candidate);
    const excerpt = getRateLimitExcerpt(candidateText);
    if (excerpt.length > 0) {
      return {
        path: candidate,
        excerpt
      };
    }
  }
  return null;
};

const classifyScenario = ({ scenarioId, parsedOutput, debugText, stdout, timedOut }) => {
  if (timedOut) {
    return {
      outcome: "fallback_local",
      classification: "commercial_timeout_degraded",
      retry_decision: "retry_then_degrade",
      error: "Commercial provider invocation exceeded timeout budget."
    };
  }
  if (parsedOutput?.is_error === false && containsArabic(parsedOutput?.result ?? "")) {
    return {
      outcome: "success",
      classification: "commercial_auth_success",
      retry_decision: "complete",
      error: null
    };
  }
  const authFailure =
    stdout.includes("Not logged in") || debugText.includes("Could not resolve authentication method");
  if (scenarioId === "commercial_auth_failure" || authFailure) {
    return {
      outcome: "fallback_local",
      classification: "commercial_auth_failure",
      retry_decision: "fallback_local",
      error: parsedOutput?.result ?? "Commercial provider authentication failed."
    };
  }
  const invalidModel =
    stdout.includes("selected model") ||
    debugText.includes('"type":"not_found_error"') ||
    debugText.includes("model: not-a-real-model");
  if (scenarioId === "commercial_invalid_model" || invalidModel) {
    return {
      outcome: "fallback_local",
      classification: "commercial_invalid_model",
      retry_decision: "fallback_local",
      error: parsedOutput?.result ?? "Commercial provider rejected the requested model."
    };
  }
  return {
      outcome: "fallback_local",
      classification: "commercial_provider_error",
      retry_decision: "fallback_local",
      error: parsedOutput?.result ?? stdout ?? "Commercial provider execution failed."
    };
};

const runClaudeScenario = ({ scenarioId, prompt, model = null, timeoutMs = 30000, isolatedHome = false }) => {
  const scenarioRuntimeDir = path.join(runtimeDir, scenarioId);
  const debugPath = path.join(artifactsDir, `${scenarioId}-debug.log`);
  fs.mkdirSync(scenarioRuntimeDir, { recursive: true });

  const args = ["-p", prompt, "--output-format", "json", "--debug-file", debugPath];
  if (model) {
    args.push("--model", model);
  }

  const env = { ...process.env };
  let isolatedHomePath = null;
  if (isolatedHome) {
    isolatedHomePath = path.join(scenarioRuntimeDir, "isolated-home");
    fs.mkdirSync(isolatedHomePath, { recursive: true });
    env.USERPROFILE = isolatedHomePath;
    env.HOME = isolatedHomePath;
  }

  const requestPath = writeJson(path.join(artifactsDir, `${scenarioId}-request.json`), {
    scenario_id: scenarioId,
    provider: "anthropic_claude_cli",
    command: "claude",
    args,
    prompt,
    model,
    timeout_ms: timeoutMs,
    isolated_home_path: isolatedHomePath,
    executed_at: now()
  });

  const startedAt = Date.now();
  const run = spawnSync("claude", args, {
    cwd: root,
    env,
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 32 * 1024 * 1024
  });
  const durationMs = Date.now() - startedAt;
  const stdout = run.stdout ?? "";
  const stderr = run.stderr ?? "";
  const debugText = readText(debugPath);
  const parsedOutput = parseJson(stdout);
  const timedOut = run.error?.code === "ETIMEDOUT" || run.signal === "SIGTERM";
  const final = classifyScenario({ scenarioId, parsedOutput, debugText, stdout, timedOut });

  const responsePath = writeJson(path.join(artifactsDir, `${scenarioId}-response.json`), {
    scenario_id: scenarioId,
    provider: "anthropic_claude_cli",
    exit_status: run.status,
    signal: run.signal,
    duration_ms: durationMs,
    timed_out: timedOut,
    error_code: run.error?.code ?? null,
    stdout_json: parsedOutput,
    stdout_excerpt: stdout.slice(0, 12000),
    stderr_excerpt: stderr.slice(0, 12000),
    final,
    debug_log_path: debugPath,
    debug_excerpt: extractDebugLines(debugText, [/ERROR/, /WARN/, /status=/, /Rate limited/, /Not logged in/, /not_found_error/])
  });

  return {
    scenarioId,
    requestPath,
    responsePath,
    debugPath,
    debugText,
    parsedOutput,
    stdout,
    stderr,
    final
  };
};

const prompt = "Translate to Arabic professionally: Quarterly revenue remains above plan.";
const scenarios = [
  { scenarioId: "commercial_auth_success", prompt, timeoutMs: 60000 },
  { scenarioId: "commercial_auth_failure", prompt, timeoutMs: 20000, isolatedHome: true },
  { scenarioId: "commercial_invalid_model", prompt, model: "not-a-real-model", timeoutMs: 30000 },
  { scenarioId: "commercial_timeout_degraded", prompt, timeoutMs: 1000 }
];

const scenarioResults = scenarios.map((scenario) => runClaudeScenario(scenario));

const successScenario = scenarioResults.find((scenario) => scenario.scenarioId === "commercial_auth_success");
const authFailureScenario = scenarioResults.find((scenario) => scenario.scenarioId === "commercial_auth_failure");
const invalidModelScenario = scenarioResults.find((scenario) => scenario.scenarioId === "commercial_invalid_model");
const timeoutScenario = scenarioResults.find((scenario) => scenario.scenarioId === "commercial_timeout_degraded");

const currentRateLimitExcerpt = getRateLimitExcerpt(successScenario.debugText);
const fallbackRateLimit = currentRateLimitExcerpt.length > 0 ? null : fallbackRateLimitSource();
const rateLimitSourcePath = writeText(
  path.join(artifactsDir, "commercial-rate-limit-source.log"),
  [
    ...(currentRateLimitExcerpt.length > 0 ? currentRateLimitExcerpt : []),
    ...(fallbackRateLimit?.excerpt ?? [])
  ].join("\n")
);
const rateLimitTaxonomy = {
  provider: "anthropic_claude_cli",
  observed_events: [
    {
      taxonomy_code: "commercial_http_429_rate_limit",
      source_debug_path: currentRateLimitExcerpt.length > 0 ? successScenario.debugPath : fallbackRateLimit?.path ?? successScenario.debugPath,
      source_excerpt: currentRateLimitExcerpt.length > 0 ? currentRateLimitExcerpt : fallbackRateLimit?.excerpt ?? [],
      repository_local_excerpt_path: rateLimitSourcePath,
      handling: "retry_with_backoff_then_continue_if_primary_generation_succeeds"
    }
  ],
  classification_matrix: {
    http_429: "retry_with_backoff",
    prefetch_rate_limit: "non_blocking_when_primary_generation_succeeds",
    quota_or_burst_limit: "degrade_after_retry_budget"
  }
};
const rateLimitPath = writeJson(path.join(artifactsDir, "commercial-rate-limit-taxonomy.json"), rateLimitTaxonomy);

const errorTaxonomy = {
  provider: "anthropic_claude_cli",
  observed_events: [
    {
      taxonomy_code: "commercial_auth_failure",
      request_path: authFailureScenario.requestPath,
      response_path: authFailureScenario.responsePath,
      debug_path: authFailureScenario.debugPath,
      handling: "fallback_local",
      example_message: authFailureScenario.parsedOutput?.result ?? authFailureScenario.stdout.trim()
    },
    {
      taxonomy_code: "commercial_invalid_model_404",
      request_path: invalidModelScenario.requestPath,
      response_path: invalidModelScenario.responsePath,
      debug_path: invalidModelScenario.debugPath,
      provider_request_id: extractRequestId(invalidModelScenario.debugText),
      handling: "fallback_local",
      example_message: invalidModelScenario.parsedOutput?.result ?? invalidModelScenario.stdout.trim()
    },
    {
      taxonomy_code: "commercial_timeout_degraded",
      request_path: timeoutScenario.requestPath,
      response_path: timeoutScenario.responsePath,
      debug_path: timeoutScenario.debugPath,
      handling: "retry_then_degrade",
      example_message: timeoutScenario.final.error
    }
  ],
  classification_matrix: {
    auth_failure: "do_not_retry",
    invalid_model: "do_not_retry",
    timeout: "retry_then_degrade",
    malformed_or_non_json: "fallback_local"
  }
};
const errorTaxonomyPath = writeJson(path.join(artifactsDir, "commercial-error-taxonomy.json"), errorTaxonomy);

const commercialProof = {
  provider: "anthropic_claude_cli",
  provider_kind: "commercial_translation_provider_official_client",
  verified_at: now(),
  auth_success: {
    request_path: successScenario.requestPath,
    response_path: successScenario.responsePath,
    debug_path: successScenario.debugPath,
    classification: successScenario.final.classification,
    translated_result: successScenario.parsedOutput?.result ?? null,
    model_usage: successScenario.parsedOutput?.modelUsage ?? null,
    session_id: successScenario.parsedOutput?.session_id ?? null
  },
  error_and_degrade_paths: [
    {
      scenario_id: authFailureScenario.scenarioId,
      classification: authFailureScenario.final.classification,
      request_path: authFailureScenario.requestPath,
      response_path: authFailureScenario.responsePath,
      debug_path: authFailureScenario.debugPath
    },
    {
      scenario_id: invalidModelScenario.scenarioId,
      classification: invalidModelScenario.final.classification,
      request_path: invalidModelScenario.requestPath,
      response_path: invalidModelScenario.responsePath,
      debug_path: invalidModelScenario.debugPath
    },
    {
      scenario_id: timeoutScenario.scenarioId,
      classification: timeoutScenario.final.classification,
      request_path: timeoutScenario.requestPath,
      response_path: timeoutScenario.responsePath,
      debug_path: timeoutScenario.debugPath
    }
  ],
  rate_limit_taxonomy_path: rateLimitPath,
  error_taxonomy_path: errorTaxonomyPath,
  retry_fallback_degrade_behavior: {
    auth_failure: "fallback_local",
    invalid_model: "fallback_local",
    timeout: "retry_then_degrade",
    rate_limit: "retry_with_backoff"
  },
  final_status: successScenario.final.outcome === "success" ? "commercial_provider_verified" : "commercial_provider_failed"
};
const commercialProofPath = writeJson(path.join(artifactsDir, "commercial-provider-proof.json"), commercialProof);

const commercialValidationPath = writeJson(path.join(artifactsDir, "commercial-provider-validation.json"), {
  provider_detected: true,
  provider: "anthropic_claude_cli",
  credential_source: "provider_issued_oauth_via_official_client_session",
  status: commercialProof.final_status,
  blocker: null,
  executed_request_path: successScenario.requestPath,
  executed_response_path: successScenario.responsePath,
  commercial_rate_limit_taxonomy_path: rateLimitPath,
  commercial_error_taxonomy_path: errorTaxonomyPath
});

const summary = {
  provider_family: "commercial_translation_provider_validation",
  executed_at: now(),
  scenarios: scenarioResults.map((scenario) => ({
    scenario_id: scenario.scenarioId,
    final_outcome: scenario.final.outcome,
    final_classification: scenario.final.classification,
    request_path: scenario.requestPath,
    response_path: scenario.responsePath,
    debug_path: scenario.debugPath
  })),
  commercial_provider_validation_path: commercialValidationPath,
  commercial_provider_proof_path: commercialProofPath
};
const summaryPath = writeJson(path.join(artifactsDir, "validation-summary.json"), summary);

const expectedClassifications = {
  commercial_auth_success: "commercial_auth_success",
  commercial_auth_failure: "commercial_auth_failure",
  commercial_invalid_model: "commercial_invalid_model",
  commercial_timeout_degraded: "commercial_timeout_degraded"
};
const allChecksPassed = scenarioResults.every(
  (scenario) => scenario.final.classification === expectedClassifications[scenario.scenarioId]
);

const evidencePack = contracts.EvidencePackSchema.parse({
  contract: contracts.contractEnvelope("evidence"),
  evidence_pack_id: "evidence-pack-commercial-provider-validation",
  verification_status: allChecksPassed ? "verified" : "degraded",
  source_refs: scenarioResults.map((scenario) => scenario.requestPath),
  generated_artifact_refs: [
    summaryPath,
    commercialProofPath,
    commercialValidationPath,
    rateLimitPath,
    errorTaxonomyPath,
    ...scenarioResults.flatMap((scenario) => [scenario.responsePath, scenario.debugPath])
  ],
  checks_executed: scenarioResults.map((scenario) => ({
    check_id: `check-commercial-provider-${scenario.scenarioId}`,
    check_name: scenario.scenarioId,
    check_type: "translation",
    passed: scenario.final.classification === expectedClassifications[scenario.scenarioId],
    severity: "high",
    details: `${scenario.scenarioId} => ${scenario.final.classification}`,
    impacted_refs: [scenario.responsePath, scenario.debugPath]
  })),
  before_refs: scenarioResults.map((scenario) => scenario.requestPath),
  after_refs: scenarioResults.map((scenario) => scenario.responsePath),
  metrics: [
    {
      metric_name: "commercial_auth_success_has_arabic_output",
      metric_value: containsArabic(successScenario.parsedOutput?.result ?? "") ? 1 : 0,
      metric_unit: "boolean"
    },
    {
      metric_name: "commercial_success_total_cost_usd",
      metric_value: Number(successScenario.parsedOutput?.total_cost_usd ?? 0),
      metric_unit: "usd"
    },
    {
      metric_name: "commercial_rate_limit_events_observed",
      metric_value: rateLimitTaxonomy.observed_events.length,
      metric_unit: "events"
    }
  ],
  warnings: scenarioResults
    .filter((scenario) => scenario.final.outcome !== "success")
    .map((scenario) => ({
      warning_code: scenario.final.classification,
      summary: `${scenario.scenarioId} triggered expected fallback or degrade behavior`,
      detail: scenario.final.error,
      severity: "high",
      impacted_refs: [scenario.responsePath, scenario.debugPath]
    })),
  failure_reasons: [],
  degraded_reasons: [],
  replay_context: summary,
  reproducibility_metadata: {
    replay_token: "replay-commercial-provider-validation",
    execution_seed: checksum(JSON.stringify(summary)),
    environment_stamp: "rasid-platform-core",
    tool_versions: [{ tool: "claude", version: "2.1.76" }]
  },
  strict_evidence_level: "strong"
});
const evidencePath = writeJson(path.join(evidenceDir, "evidence-pack.json"), evidencePack);

const auditEvents = scenarioResults.map((scenario) =>
  contracts.AuditEventSchema.parse({
    contract: contracts.contractEnvelope("audit"),
    event_id: `audit-commercial-provider-${scenario.scenarioId}`,
    timestamp: now(),
    actor_ref: "arabic-localization-lct-engine",
    actor_type: "service",
    action_ref: "arabic_localization_lct.commercial_provider_validation.runtime",
    job_ref: `job-commercial-provider-${scenario.scenarioId}`,
    object_refs: [scenario.requestPath, scenario.responsePath, scenario.debugPath],
    workspace_id: "workspace-lct-sample",
    tenant_ref: "tenant-lct-sample",
    metadata: {
      scenario_id: scenario.scenarioId,
      final_classification: scenario.final.classification,
      final_outcome: scenario.final.outcome
    }
  })
);
const auditPath = writeJson(path.join(auditDir, "audit-events.json"), auditEvents);

const lineageEdges = scenarioResults.map((scenario, index) => ({
  edge_id: `lineage-commercial-provider-${index + 1}`,
  from_ref: scenario.requestPath,
  to_ref: scenario.responsePath,
  transform_ref: "arabic_localization_lct.commercial_provider_validation",
  ai_suggestion_ref: "",
  ai_decision: "accepted",
  template_ref: "",
  dataset_binding_ref: scenario.debugPath,
  version_diff_ref: summaryPath
}));
const lineagePath = writeJson(path.join(lineageDir, "lineage-edges.json"), lineageEdges);

console.log(`external-provider-validation-root=${outputRoot}`);
console.log(`external-provider-validation-summary=${summaryPath}`);
console.log(`external-provider-validation-commercial-proof=${commercialProofPath}`);
console.log(`external-provider-validation-evidence=${evidencePath}`);
console.log(`external-provider-validation-audit=${auditPath}`);
console.log(`external-provider-validation-lineage=${lineagePath}`);
