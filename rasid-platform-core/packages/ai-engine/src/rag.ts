/**
 * RAG (Retrieval-Augmented Generation) module with full workspace/tenant isolation.
 * Each workspace maintains its own vector index and document store.
 */
import { createHash } from "node:crypto";

export type RagChunk = {
  chunk_id: string;
  document_ref: string;
  content: string;
  embedding: number[];
  metadata: Record<string, unknown>;
  tenant_ref: string;
  workspace_id: string;
  created_at: string;
};

export type RagDocument = {
  document_ref: string;
  file_name: string;
  file_domain: string;
  tenant_ref: string;
  workspace_id: string;
  chunk_refs: string[];
  indexed_at: string;
  token_count: number;
};

export type RagQueryResult = {
  query: string;
  tenant_ref: string;
  workspace_id: string;
  retrieved_chunks: Array<{
    chunk_id: string;
    document_ref: string;
    content: string;
    similarity_score: number;
    metadata: Record<string, unknown>;
  }>;
  context_window: string;
  total_tokens: number;
};

export type RagIndexStats = {
  tenant_ref: string;
  workspace_id: string;
  document_count: number;
  chunk_count: number;
  total_tokens: number;
  last_indexed_at: string | null;
};

const hashId = (value: string): string => createHash("sha256").update(value).digest("hex").slice(0, 16);
const now = (): string => new Date().toISOString();

/**
 * Simple cosine similarity for lightweight local retrieval.
 */
const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    magA += a[i]! * a[i]!;
    magB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
};

/**
 * Deterministic text-to-embedding for offline/test use.
 * Production should swap this with an actual embedding provider.
 */
const deterministicEmbed = (text: string, dimensions = 64): number[] => {
  const h = createHash("sha256").update(text).digest();
  const vec: number[] = [];
  for (let i = 0; i < dimensions; i++) {
    vec.push((h[i % h.length]! - 128) / 128);
  }
  const mag = Math.sqrt(vec.reduce((s, v) => s + v * v, 0));
  return mag === 0 ? vec : vec.map((v) => v / mag);
};

/**
 * Split text into overlapping chunks for indexing.
 */
const chunkText = (text: string, chunkSize = 512, overlap = 64): string[] => {
  const words = text.split(/\s+/);
  const chunks: string[] = [];
  let start = 0;
  while (start < words.length) {
    const end = Math.min(start + chunkSize, words.length);
    chunks.push(words.slice(start, end).join(" "));
    if (end >= words.length) break;
    start = end - overlap;
  }
  return chunks.length === 0 ? [text] : chunks;
};

export class RagEngine {
  /** In-memory stores keyed by `${tenant_ref}::${workspace_id}` for strict isolation */
  private stores = new Map<string, { documents: Map<string, RagDocument>; chunks: Map<string, RagChunk> }>();

  private storeKey(tenantRef: string, workspaceId: string): string {
    return `${tenantRef}::${workspaceId}`;
  }

  private getStore(tenantRef: string, workspaceId: string) {
    const key = this.storeKey(tenantRef, workspaceId);
    if (!this.stores.has(key)) {
      this.stores.set(key, { documents: new Map(), chunks: new Map() });
    }
    return this.stores.get(key)!;
  }

  /**
   * Index a document: chunk it, embed each chunk, store with tenant/workspace isolation.
   */
  indexDocument(params: {
    document_ref: string;
    file_name: string;
    file_domain: string;
    content: string;
    tenant_ref: string;
    workspace_id: string;
    metadata?: Record<string, unknown>;
  }): RagDocument {
    const store = this.getStore(params.tenant_ref, params.workspace_id);
    const textChunks = chunkText(params.content);
    const chunkRefs: string[] = [];
    let totalTokens = 0;

    for (const text of textChunks) {
      const chunkId = `chunk-${hashId(`${params.document_ref}:${text}`)}`;
      const tokens = text.split(/\s+/).length;
      totalTokens += tokens;
      const chunk: RagChunk = {
        chunk_id: chunkId,
        document_ref: params.document_ref,
        content: text,
        embedding: deterministicEmbed(text),
        metadata: { ...params.metadata, file_domain: params.file_domain },
        tenant_ref: params.tenant_ref,
        workspace_id: params.workspace_id,
        created_at: now()
      };
      store.chunks.set(chunkId, chunk);
      chunkRefs.push(chunkId);
    }

    const doc: RagDocument = {
      document_ref: params.document_ref,
      file_name: params.file_name,
      file_domain: params.file_domain,
      tenant_ref: params.tenant_ref,
      workspace_id: params.workspace_id,
      chunk_refs: chunkRefs,
      indexed_at: now(),
      token_count: totalTokens
    };
    store.documents.set(params.document_ref, doc);
    return doc;
  }

  /**
   * Query the RAG index. Only retrieves from the specified tenant+workspace.
   */
  query(params: {
    query: string;
    tenant_ref: string;
    workspace_id: string;
    top_k?: number;
    min_similarity?: number;
  }): RagQueryResult {
    const store = this.getStore(params.tenant_ref, params.workspace_id);
    const queryEmbedding = deterministicEmbed(params.query);
    const topK = params.top_k ?? 5;
    const minSim = params.min_similarity ?? 0.1;

    const scored: Array<{ chunk: RagChunk; score: number }> = [];
    for (const chunk of store.chunks.values()) {
      const score = cosineSimilarity(queryEmbedding, chunk.embedding);
      if (score >= minSim) {
        scored.push({ chunk, score });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, topK);

    const contextParts = top.map((item) => item.chunk.content);
    const contextWindow = contextParts.join("\n---\n");
    const totalTokens = contextParts.reduce((sum, text) => sum + text.split(/\s+/).length, 0);

    return {
      query: params.query,
      tenant_ref: params.tenant_ref,
      workspace_id: params.workspace_id,
      retrieved_chunks: top.map((item) => ({
        chunk_id: item.chunk.chunk_id,
        document_ref: item.chunk.document_ref,
        content: item.chunk.content,
        similarity_score: Math.round(item.score * 1000) / 1000,
        metadata: item.chunk.metadata
      })),
      context_window: contextWindow,
      total_tokens: totalTokens
    };
  }

  /**
   * Remove a document and its chunks from the store.
   */
  removeDocument(params: { document_ref: string; tenant_ref: string; workspace_id: string }): boolean {
    const store = this.getStore(params.tenant_ref, params.workspace_id);
    const doc = store.documents.get(params.document_ref);
    if (!doc) return false;
    for (const chunkRef of doc.chunk_refs) {
      store.chunks.delete(chunkRef);
    }
    store.documents.delete(params.document_ref);
    return true;
  }

  /**
   * Get index statistics for a workspace.
   */
  getStats(tenantRef: string, workspaceId: string): RagIndexStats {
    const store = this.getStore(tenantRef, workspaceId);
    let totalTokens = 0;
    let lastIndexed: string | null = null;
    for (const doc of store.documents.values()) {
      totalTokens += doc.token_count;
      if (!lastIndexed || doc.indexed_at > lastIndexed) {
        lastIndexed = doc.indexed_at;
      }
    }
    return {
      tenant_ref: tenantRef,
      workspace_id: workspaceId,
      document_count: store.documents.size,
      chunk_count: store.chunks.size,
      total_tokens: totalTokens,
      last_indexed_at: lastIndexed
    };
  }

  /**
   * Clear all data for a specific workspace (tenant isolation).
   */
  clearWorkspace(tenantRef: string, workspaceId: string): void {
    this.stores.delete(this.storeKey(tenantRef, workspaceId));
  }
}
