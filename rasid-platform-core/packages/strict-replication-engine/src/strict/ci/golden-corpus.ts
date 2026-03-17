/**
 * Golden Corpus Management — Section 4
 *
 * Maintains a corpus of reference entries with expected pixel, structural,
 * and layout hashes. Used in CI to prevent regressions by verifying that
 * every conversion still produces bit-identical output.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'crypto';
import type { HashBundle } from '../cdr/types';

// ─── Types ──────────────────────────────────────────────────────────

export interface GoldenCorpusEntry {
  entry_id: string;
  source_asset_path: string;
  source_format: string;
  target_format: string;
  expected_pixel_hash: string;
  expected_structural_hash: string;
  expected_layout_hash: string;
  created_at: string;
  last_verified_at: string;
}

export interface GoldenCorpusVerifyFailure {
  entry_id: string;
  field: string;
  expected: string;
  actual: string;
}

export interface GoldenCorpusResult {
  pass: boolean;
  entries_checked: number;
  entries_passed: number;
  entries_failed: number;
  failures: GoldenCorpusVerifyFailure[];
}

export interface ActualHashes {
  pixel_hash: string;
  structural_hash: string;
  layout_hash: string;
}

/**
 * A function that, given a GoldenCorpusEntry, produces the actual hashes
 * for the current conversion pipeline run. Used by verifyAll to obtain
 * hashes for each entry without the corpus needing to know how rendering works.
 */
export type HashProvider = (entry: GoldenCorpusEntry) => Promise<ActualHashes>;

// ─── Manifest shape (serialized to/from JSON) ──────────────────────

interface CorpusManifest {
  version: string;
  generated_at: string;
  corpus_hash: string;
  entry_count: number;
  entries: GoldenCorpusEntry[];
}

// ─── GoldenCorpus Class ─────────────────────────────────────────────

export class GoldenCorpus {
  private entries: Map<string, GoldenCorpusEntry> = new Map();

  /**
   * Load corpus entries from a directory. Each .json file in the directory
   * is expected to contain either a single GoldenCorpusEntry or an array
   * of GoldenCorpusEntry objects. Also supports manifest files that wrap
   * entries in an { entries: [...] } envelope.
   */
  loadFromDir(dir: string): void {
    const resolvedDir = path.resolve(dir);

    if (!fs.existsSync(resolvedDir)) {
      throw new Error(`Golden corpus directory does not exist: ${resolvedDir}`);
    }

    const stat = fs.statSync(resolvedDir);
    if (!stat.isDirectory()) {
      throw new Error(`Path is not a directory: ${resolvedDir}`);
    }

    const files = this.collectJsonFiles(resolvedDir);

    if (files.length === 0) {
      throw new Error(`No JSON files found in golden corpus directory: ${resolvedDir}`);
    }

    for (const filePath of files) {
      let raw: string;
      try {
        raw = fs.readFileSync(filePath, 'utf-8');
      } catch (err) {
        throw new Error(`Failed to read corpus file ${filePath}: ${String(err)}`);
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        throw new Error(`Failed to parse corpus file ${filePath}: ${String(err)}`);
      }

      const entriesToAdd = this.extractEntries(parsed, filePath);
      for (const entry of entriesToAdd) {
        this.validateEntry(entry, filePath);
        this.entries.set(entry.entry_id, entry);
      }
    }
  }

  /**
   * Add a single entry to the corpus. Throws if an entry with the same
   * entry_id already exists (use a unique ID).
   */
  addEntry(entry: GoldenCorpusEntry): void {
    this.validateEntry(entry, '<addEntry>');

    if (this.entries.has(entry.entry_id)) {
      throw new Error(
        `Duplicate entry_id "${entry.entry_id}" — corpus entries must have unique IDs`
      );
    }

    this.entries.set(entry.entry_id, { ...entry });
  }

  /**
   * Verify a single entry against actual hashes. Returns a list of failures
   * (empty if the entry passes).
   */
  verifyEntry(
    entry: GoldenCorpusEntry,
    actualHashes: ActualHashes,
  ): GoldenCorpusVerifyFailure[] {
    const failures: GoldenCorpusVerifyFailure[] = [];

    if (entry.expected_pixel_hash !== actualHashes.pixel_hash) {
      failures.push({
        entry_id: entry.entry_id,
        field: 'pixel_hash',
        expected: entry.expected_pixel_hash,
        actual: actualHashes.pixel_hash,
      });
    }

    if (entry.expected_structural_hash !== actualHashes.structural_hash) {
      failures.push({
        entry_id: entry.entry_id,
        field: 'structural_hash',
        expected: entry.expected_structural_hash,
        actual: actualHashes.structural_hash,
      });
    }

    if (entry.expected_layout_hash !== actualHashes.layout_hash) {
      failures.push({
        entry_id: entry.entry_id,
        field: 'layout_hash',
        expected: entry.expected_layout_hash,
        actual: actualHashes.layout_hash,
      });
    }

    return failures;
  }

  /**
   * Verify all entries in the corpus using the provided hash provider.
   * The hashProvider is called for each entry and must return the actual
   * hashes produced by the current pipeline. Returns a full result summary.
   */
  async verifyAll(hashProvider: HashProvider): Promise<GoldenCorpusResult> {
    const allFailures: GoldenCorpusVerifyFailure[] = [];
    let entriesPassed = 0;
    let entriesFailed = 0;

    const entriesList = Array.from(this.entries.values());

    for (const entry of entriesList) {
      let actualHashes: ActualHashes;
      try {
        actualHashes = await hashProvider(entry);
      } catch (err) {
        allFailures.push({
          entry_id: entry.entry_id,
          field: 'hash_provider_error',
          expected: 'successful hash computation',
          actual: String(err),
        });
        entriesFailed++;
        continue;
      }

      const entryFailures = this.verifyEntry(entry, actualHashes);

      if (entryFailures.length === 0) {
        entriesPassed++;

        // Update last_verified_at timestamp on successful verification
        const stored = this.entries.get(entry.entry_id);
        if (stored) {
          stored.last_verified_at = new Date().toISOString();
        }
      } else {
        entriesFailed++;
        allFailures.push(...entryFailures);
      }
    }

    return {
      pass: entriesFailed === 0 && entriesList.length > 0,
      entries_checked: entriesList.length,
      entries_passed: entriesPassed,
      entries_failed: entriesFailed,
      failures: allFailures,
    };
  }

  /**
   * Export the corpus as a JSON manifest suitable for CI consumption.
   * The manifest includes a SHA-256 hash of all entry data for
   * tamper detection.
   */
  exportManifest(): string {
    const entriesList = Array.from(this.entries.values()).sort((a, b) =>
      a.entry_id.localeCompare(b.entry_id)
    );

    const corpusHash = this.computeCorpusHash(entriesList);

    const manifest: CorpusManifest = {
      version: '1.0.0',
      generated_at: new Date().toISOString(),
      corpus_hash: corpusHash,
      entry_count: entriesList.length,
      entries: entriesList,
    };

    return JSON.stringify(manifest, null, 2);
  }

  /**
   * Returns the number of entries currently loaded.
   */
  get size(): number {
    return this.entries.size;
  }

  /**
   * Returns all entries as an array (read-only copies).
   */
  getEntries(): GoldenCorpusEntry[] {
    return Array.from(this.entries.values()).map((e) => ({ ...e }));
  }

  /**
   * Retrieve a single entry by ID, or undefined if not found.
   */
  getEntry(entryId: string): GoldenCorpusEntry | undefined {
    const entry = this.entries.get(entryId);
    return entry ? { ...entry } : undefined;
  }

  // ─── Private Helpers ────────────────────────────────────────────────

  private collectJsonFiles(dir: string): string[] {
    const results: string[] = [];
    const dirEntries = fs.readdirSync(dir, { withFileTypes: true });

    for (const dirEntry of dirEntries) {
      const fullPath = path.join(dir, dirEntry.name);

      if (dirEntry.isDirectory()) {
        if (dirEntry.name !== 'node_modules' && !dirEntry.name.startsWith('.')) {
          results.push(...this.collectJsonFiles(fullPath));
        }
      } else if (dirEntry.isFile() && dirEntry.name.endsWith('.json')) {
        results.push(fullPath);
      }
    }

    return results;
  }

  private extractEntries(parsed: unknown, sourceFile: string): GoldenCorpusEntry[] {
    // Case 1: Array of entries
    if (Array.isArray(parsed)) {
      return parsed as GoldenCorpusEntry[];
    }

    // Case 2: Manifest envelope with entries array
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'entries' in parsed &&
      Array.isArray((parsed as Record<string, unknown>).entries)
    ) {
      return (parsed as Record<string, unknown>).entries as GoldenCorpusEntry[];
    }

    // Case 3: Single entry object
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      'entry_id' in parsed &&
      'source_asset_path' in parsed
    ) {
      return [parsed as GoldenCorpusEntry];
    }

    throw new Error(
      `Unrecognized format in ${sourceFile}: expected a GoldenCorpusEntry, ` +
      `an array of entries, or a manifest with an "entries" field`
    );
  }

  private validateEntry(entry: GoldenCorpusEntry, source: string): void {
    if (!entry.entry_id || typeof entry.entry_id !== 'string') {
      throw new Error(`${source}: entry missing required field "entry_id"`);
    }
    if (!entry.source_asset_path || typeof entry.source_asset_path !== 'string') {
      throw new Error(`${source}: entry "${entry.entry_id}" missing "source_asset_path"`);
    }
    if (!entry.source_format || typeof entry.source_format !== 'string') {
      throw new Error(`${source}: entry "${entry.entry_id}" missing "source_format"`);
    }
    if (!entry.target_format || typeof entry.target_format !== 'string') {
      throw new Error(`${source}: entry "${entry.entry_id}" missing "target_format"`);
    }
    if (!entry.expected_pixel_hash || typeof entry.expected_pixel_hash !== 'string') {
      throw new Error(`${source}: entry "${entry.entry_id}" missing "expected_pixel_hash"`);
    }
    if (!entry.expected_structural_hash || typeof entry.expected_structural_hash !== 'string') {
      throw new Error(`${source}: entry "${entry.entry_id}" missing "expected_structural_hash"`);
    }
    if (!entry.expected_layout_hash || typeof entry.expected_layout_hash !== 'string') {
      throw new Error(`${source}: entry "${entry.entry_id}" missing "expected_layout_hash"`);
    }
    if (!entry.created_at || typeof entry.created_at !== 'string') {
      throw new Error(`${source}: entry "${entry.entry_id}" missing "created_at"`);
    }
    if (!entry.last_verified_at || typeof entry.last_verified_at !== 'string') {
      throw new Error(`${source}: entry "${entry.entry_id}" missing "last_verified_at"`);
    }
  }

  private computeCorpusHash(entries: GoldenCorpusEntry[]): string {
    const hashInput = entries
      .map(
        (e) =>
          `${e.entry_id}|${e.source_asset_path}|${e.source_format}|${e.target_format}|` +
          `${e.expected_pixel_hash}|${e.expected_structural_hash}|${e.expected_layout_hash}`
      )
      .join('\n');

    return createHash('sha256').update(hashInput).digest('hex');
  }
}
