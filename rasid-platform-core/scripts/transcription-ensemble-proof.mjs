/**
 * Transcription ASR Ensemble Strict — Proof Artifact Generator
 *
 * Exercises the ensemble path of TranscriptionExtractionEngine:
 *  - Configures an ensemble with vosk (local) + simulated external engines
 *  - Falls back gracefully when no API keys are provided
 *  - Generates proof artifacts showing config, per-engine results, agreement scoring
 *  - Writes output to packages/transcription-extraction-engine/artifacts/latest-run/
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const stamp = () => new Date().toISOString().replace(/[:.]/g, "");
const ensureDir = (p) => fs.mkdirSync(p, { recursive: true });
const writeJson = (filePath, payload) => {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
};

const proofId = `ensemble-proof-${stamp()}`;
const artifactsBase = path.join(root, "packages", "transcription-extraction-engine", "artifacts", "latest-run", proofId);
const evidenceDir = path.join(artifactsBase, "evidence");
const configDir = path.join(artifactsBase, "config");
const resultsDir = path.join(artifactsBase, "results");
const matrixDir = path.join(artifactsBase, "matrix");
[artifactsBase, evidenceDir, configDir, resultsDir, matrixDir].forEach(ensureDir);

console.log(`[ensemble-proof] proof directory: ${artifactsBase}`);

// Dynamic import of the compiled engine (use file:// URLs on Windows)
let TranscriptionExtractionEngine;
try {
  const mod = await import(pathToFileURL(path.join(root, "packages", "transcription-extraction-engine", "dist", "index.js")).href);
  TranscriptionExtractionEngine = mod.TranscriptionExtractionEngine;
} catch (err) {
  console.error("[ensemble-proof] WARN: Could not import compiled engine:", err.message);
  try {
    const mod = await import(pathToFileURL(path.join(root, "packages", "transcription-extraction-engine", "src", "index.js")).href);
    TranscriptionExtractionEngine = mod.TranscriptionExtractionEngine;
  } catch (err2) {
    console.error("[ensemble-proof] ERROR: Could not import engine:", err2.message);
    process.exit(1);
  }
}

// 1. Write the ensemble config artifact
const ensembleConfig = {
  engines: [
    {
      engine_id: "vosk-local",
      engine_name: "Vosk Local ASR",
      engine_type: "vosk",
      weight: 1.0,
      timeout_ms: 30000,
      endpoint_url: "",
      api_key: "",
      model_ref: "vosk-model-small-en-us-0.15",
      enabled: true
    },
    {
      engine_id: "whisper-local-1",
      engine_name: "Whisper Local (fallback)",
      engine_type: "whisper_local",
      weight: 0.8,
      timeout_ms: 30000,
      endpoint_url: process.env.WHISPER_ENDPOINT || "http://localhost:9999",
      api_key: process.env.WHISPER_API_KEY || "",
      model_ref: "whisper-1",
      enabled: Boolean(process.env.WHISPER_ENDPOINT)
    },
    {
      engine_id: "google-cloud-1",
      engine_name: "Google Cloud Speech",
      engine_type: "google_cloud",
      weight: 1.2,
      timeout_ms: 15000,
      endpoint_url: "https://speech.googleapis.com",
      api_key: process.env.GOOGLE_SPEECH_API_KEY || "",
      model_ref: "default",
      enabled: Boolean(process.env.GOOGLE_SPEECH_API_KEY)
    },
    {
      engine_id: "azure-speech-1",
      engine_name: "Azure Cognitive Speech",
      engine_type: "azure_speech",
      weight: 1.1,
      timeout_ms: 15000,
      endpoint_url: process.env.AZURE_SPEECH_ENDPOINT || "https://eastus.api.cognitive.microsoft.com",
      api_key: process.env.AZURE_SPEECH_KEY || "",
      model_ref: "default",
      enabled: Boolean(process.env.AZURE_SPEECH_KEY)
    },
    {
      engine_id: "aws-transcribe-1",
      engine_name: "AWS Transcribe",
      engine_type: "aws_transcribe",
      weight: 1.0,
      timeout_ms: 20000,
      endpoint_url: "https://transcribe.us-east-1.amazonaws.com",
      api_key: process.env.AWS_TRANSCRIBE_KEY || "",
      model_ref: "default",
      enabled: Boolean(process.env.AWS_TRANSCRIBE_KEY)
    }
  ],
  voting_method: "weighted_majority",
  strict_threshold: 0.7,
  min_engines_required: 1,
  fallback_to_single: true
};

writeJson(path.join(configDir, "ensemble-config.json"), ensembleConfig);
console.log("[ensemble-proof] Ensemble config written.");

const enabledCount = ensembleConfig.engines.filter((e) => e.enabled).length;
console.log(`[ensemble-proof] Enabled engines: ${enabledCount} / ${ensembleConfig.engines.length}`);

// 2. Create a small synthetic WAV fixture for testing
const fixtureDir = path.join(artifactsBase, "fixtures");
ensureDir(fixtureDir);
const sampleWavPath = path.join(fixtureDir, "sample-ensemble-test.wav");

// Generate a minimal valid WAV file header (empty 16-bit PCM, 16kHz, mono, ~0.1s)
const sampleRate = 16000;
const numChannels = 1;
const bitsPerSample = 16;
const durationSamples = Math.floor(sampleRate * 0.1);
const dataSize = durationSamples * numChannels * (bitsPerSample / 8);
const wavBuffer = Buffer.alloc(44 + dataSize);
wavBuffer.write("RIFF", 0);
wavBuffer.writeUInt32LE(36 + dataSize, 4);
wavBuffer.write("WAVE", 8);
wavBuffer.write("fmt ", 12);
wavBuffer.writeUInt32LE(16, 16);
wavBuffer.writeUInt16LE(1, 20);
wavBuffer.writeUInt16LE(numChannels, 22);
wavBuffer.writeUInt32LE(sampleRate, 24);
wavBuffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
wavBuffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
wavBuffer.writeUInt16LE(bitsPerSample, 34);
wavBuffer.write("data", 36);
wavBuffer.writeUInt32LE(dataSize, 40);
fs.writeFileSync(sampleWavPath, wavBuffer);
console.log("[ensemble-proof] Synthetic WAV fixture written.");

// 3. Run the ensemble
const engine = new TranscriptionExtractionEngine({
  storageDir: path.join(artifactsBase, ".runtime")
});

let ensembleResult = null;
let ensembleError = null;

try {
  ensembleResult = await engine.runASREnsemble(sampleWavPath, ensembleConfig);
  console.log("[ensemble-proof] Ensemble completed successfully.");
  console.log(`  ensemble_id: ${ensembleResult.ensemble_id}`);
  console.log(`  engines_invoked: ${ensembleResult.engines_invoked}`);
  console.log(`  engines_succeeded: ${ensembleResult.engines_succeeded}`);
  console.log(`  engines_failed: ${ensembleResult.engines_failed}`);
  console.log(`  agreement_score: ${ensembleResult.agreement_score}`);
  console.log(`  strict_pass: ${ensembleResult.strict_pass}`);
  console.log(`  consensus_transcript length: ${ensembleResult.consensus_transcript.length}`);
  console.log(`  disagreements: ${ensembleResult.disagreements.length}`);
} catch (err) {
  ensembleError = err.message || String(err);
  console.log(`[ensemble-proof] Ensemble failed (expected if no Vosk model): ${ensembleError}`);
}

// 4. Write per-engine results
writeJson(path.join(resultsDir, "ensemble-result.json"), ensembleResult ?? { error: ensembleError });

if (ensembleResult) {
  for (const engineResult of ensembleResult.per_engine_results) {
    writeJson(path.join(resultsDir, `engine-${engineResult.engine_id}.json`), engineResult);
  }
  writeJson(path.join(resultsDir, "agreement-scoring.json"), {
    agreement_score: ensembleResult.agreement_score,
    strict_pass: ensembleResult.strict_pass,
    strict_threshold: ensembleResult.strict_threshold,
    voting_method: ensembleResult.voting_method,
    consensus_word_count: ensembleResult.consensus_words.length,
    disagreement_count: ensembleResult.disagreements.length,
    engines_invoked: ensembleResult.engines_invoked,
    engines_succeeded: ensembleResult.engines_succeeded,
    engines_failed: ensembleResult.engines_failed
  });
}

// 5. Also run through the main ingestAndExtract flow with ensemble_config
let workflowResult = null;
let workflowError = null;

try {
  workflowResult = await engine.ingestAndExtract(
    {
      schema_namespace: "rasid.shared.transcription.v1",
      schema_version: "1.0.0",
      request_id: `ensemble-proof-${Date.now()}`,
      tenant_ref: "tenant-proof",
      workspace_id: "workspace-proof",
      project_id: "project-proof",
      created_by: "ensemble-proof-script",
      mode: "advanced",
      attachments: [
        {
          schema_namespace: "rasid.shared.transcription.v1",
          schema_version: "1.0.0",
          attachment_id: "att-ensemble-wav",
          file_name: "sample-ensemble-test.wav",
          file_path: sampleWavPath,
          content_base64: null,
          media_type: "audio/wav",
          input_kind: "audio_file",
          external_ref: null,
          batch_ref: null
        }
      ],
      options: {
        language_hint: "en",
        enable_ocr: false,
        enable_table_extraction: false,
        enable_qa_seeds: true,
        enable_comparisons: false
      },
      requested_at: new Date().toISOString()
    },
    ensembleConfig
  );
  console.log("[ensemble-proof] ingestAndExtract with ensemble completed.");
  const meta = workflowResult?.bundle?.metadata ?? {};
  console.log(`  bundle has ensemble_result: ${Boolean(meta.ensemble_result)}`);
} catch (err) {
  workflowError = err.message || String(err);
  console.log(`[ensemble-proof] ingestAndExtract with ensemble failed (expected if no Vosk): ${workflowError}`);
}

writeJson(path.join(resultsDir, "workflow-with-ensemble.json"), workflowResult
  ? {
      bundle_id: workflowResult.bundle?.bundle_id,
      segment_count: workflowResult.bundle?.segments?.length,
      field_count: workflowResult.bundle?.fields?.length,
      entity_count: workflowResult.bundle?.entities?.length,
      has_ensemble_in_metadata: Boolean(workflowResult.bundle?.metadata?.ensemble_result),
      ensemble_metadata: workflowResult.bundle?.metadata?.ensemble_result ?? null,
      verification_score: workflowResult.bundle?.verification_gate?.verification_score
    }
  : { error: workflowError }
);

// 6. Write the implementation matrix
const matrix = TranscriptionExtractionEngine.getImplementationMatrix();
writeJson(path.join(matrixDir, "implementation-matrix.json"), matrix);

const matrixSummary = {
  total: matrix.length,
  implemented: matrix.filter((r) => r.status === "implemented").length,
  pending: matrix.filter((r) => r.status === "pending").length,
  deferred: matrix.filter((r) => r.status === "deferred").length,
  unsupported: matrix.filter((r) => r.status === "unsupported").length
};
writeJson(path.join(matrixDir, "matrix-summary.json"), matrixSummary);
console.log(`[ensemble-proof] Implementation matrix: ${matrixSummary.implemented} implemented, ${matrixSummary.pending} pending, ${matrixSummary.deferred} deferred`);

// 7. Write the final evidence artifact
const evidenceArtifact = {
  proof_id: proofId,
  created_at: new Date().toISOString(),
  ensemble_config_path: path.join(configDir, "ensemble-config.json"),
  ensemble_result_path: path.join(resultsDir, "ensemble-result.json"),
  workflow_result_path: path.join(resultsDir, "workflow-with-ensemble.json"),
  matrix_path: path.join(matrixDir, "implementation-matrix.json"),
  ensemble_ran_successfully: ensembleResult !== null,
  workflow_ran_successfully: workflowResult !== null,
  enabled_engines: enabledCount,
  total_engines_configured: ensembleConfig.engines.length,
  fallback_to_single_engine: ensembleConfig.fallback_to_single,
  features: matrixSummary
};

writeJson(path.join(evidenceDir, "ensemble-proof-evidence.json"), evidenceArtifact);
console.log(`[ensemble-proof] All proof artifacts written to: ${artifactsBase}`);
console.log("[ensemble-proof] Done.");
