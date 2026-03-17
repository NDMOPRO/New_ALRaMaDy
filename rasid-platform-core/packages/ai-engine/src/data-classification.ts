/**
 * Data Classification module:
 *  - classify file domain
 *  - detect entity keys
 *  - detect time dimension
 *  - detect sensitive columns
 *  - build knowledge graph
 *  - produce executive summary
 */

export type FileDomainClassification = {
  file_ref: string;
  detected_domain: string;
  confidence: number;
  secondary_domains: Array<{ domain: string; confidence: number }>;
  evidence: string[];
};

export type EntityKeyDetection = {
  file_ref: string;
  entity_keys: Array<{
    column: string;
    key_type: "primary" | "foreign" | "composite" | "natural";
    confidence: number;
    referenced_entity?: string;
    evidence: string;
  }>;
};

export type TimeDimensionDetection = {
  file_ref: string;
  time_columns: Array<{
    column: string;
    granularity: "year" | "quarter" | "month" | "week" | "day" | "hour" | "minute" | "timestamp";
    format_detected: string;
    coverage_pct: number;
    confidence: number;
  }>;
};

export type SensitiveColumnDetection = {
  file_ref: string;
  sensitive_columns: Array<{
    column: string;
    sensitivity_type: "pii" | "financial" | "health" | "credential" | "location" | "contact";
    pattern_matched: string;
    confidence: number;
    recommendation: string;
  }>;
};

export type KnowledgeGraphNode = {
  node_id: string;
  node_type: "entity" | "attribute" | "metric" | "dimension" | "relationship";
  label: string;
  properties: Record<string, unknown>;
};

export type KnowledgeGraphEdge = {
  edge_id: string;
  from_node: string;
  to_node: string;
  relationship: string;
  weight: number;
};

export type KnowledgeGraph = {
  file_ref: string;
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  entity_count: number;
  relationship_count: number;
};

export type ExecutiveSummary = {
  file_ref: string;
  domain: string;
  row_count: number;
  column_count: number;
  key_findings: string[];
  data_quality_score: number;
  completeness_pct: number;
  primary_metrics: Array<{ name: string; value: number; interpretation: string }>;
  risk_flags: string[];
  recommended_actions: string[];
};

type RowData = Record<string, unknown>;

const DOMAIN_KEYWORDS: Record<string, string[]> = {
  finance: ["revenue", "expense", "profit", "loss", "balance", "invoice", "payment", "tax", "budget", "cost", "price", "amount", "salary", "income", "debit", "credit", "إيراد", "مصروف", "ربح", "فاتورة", "ميزانية"],
  hr: ["employee", "staff", "hire", "salary", "department", "position", "leave", "attendance", "performance", "موظف", "قسم", "راتب", "إجازة", "حضور"],
  sales: ["customer", "order", "product", "quantity", "discount", "region", "sales", "deal", "pipeline", "عميل", "طلب", "منتج", "كمية", "مبيعات"],
  healthcare: ["patient", "diagnosis", "treatment", "medication", "hospital", "clinic", "مريض", "تشخيص", "علاج", "مستشفى"],
  education: ["student", "course", "grade", "enrollment", "teacher", "semester", "طالب", "مادة", "درجة", "فصل"],
  logistics: ["shipment", "delivery", "warehouse", "tracking", "route", "inventory", "شحنة", "توصيل", "مستودع", "مخزون"],
  government: ["citizen", "service", "permit", "license", "regulation", "compliance", "مواطن", "خدمة", "تصريح", "رخصة"]
};

const SENSITIVE_PATTERNS: Array<{ type: SensitiveColumnDetection["sensitive_columns"][number]["sensitivity_type"]; patterns: RegExp[]; recommendation: string }> = [
  { type: "pii", patterns: [/national.?id/i, /ssn/i, /passport/i, /رقم.?هوية/i, /جواز/i, /identity/i], recommendation: "Mask or encrypt this column before processing." },
  { type: "contact", patterns: [/email/i, /phone/i, /mobile/i, /بريد/i, /هاتف/i, /جوال/i, /address/i, /عنوان/i], recommendation: "Apply access controls; avoid exposing in public dashboards." },
  { type: "financial", patterns: [/account.?num/i, /iban/i, /credit.?card/i, /bank/i, /حساب/i, /بنك/i], recommendation: "Restrict access to authorized financial roles only." },
  { type: "health", patterns: [/diagnosis/i, /medical/i, /blood/i, /allergy/i, /تشخيص/i, /طبي/i], recommendation: "Comply with health data regulations (e.g., HIPAA-equivalent)." },
  { type: "credential", patterns: [/password/i, /secret/i, /token/i, /api.?key/i, /كلمة.?مرور/i], recommendation: "Remove immediately; never store in plain text." },
  { type: "location", patterns: [/latitude/i, /longitude/i, /gps/i, /coordinates/i, /خط.?عرض/i, /خط.?طول/i], recommendation: "Generalize coordinates if precise location is not required." }
];

const TIME_PATTERNS: Array<{ granularity: TimeDimensionDetection["time_columns"][number]["granularity"]; patterns: RegExp[]; format: string }> = [
  { granularity: "timestamp", patterns: [/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/], format: "ISO 8601" },
  { granularity: "day", patterns: [/\d{4}-\d{2}-\d{2}/, /\d{2}\/\d{2}\/\d{4}/], format: "YYYY-MM-DD or DD/MM/YYYY" },
  { granularity: "month", patterns: [/\d{4}-\d{2}$/, /jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i], format: "YYYY-MM or month name" },
  { granularity: "year", patterns: [/^(19|20)\d{2}$/], format: "YYYY" },
  { granularity: "quarter", patterns: [/Q[1-4]/i, /الربع/], format: "Q1-Q4" }
];

const KEY_INDICATORS: Array<{ type: EntityKeyDetection["entity_keys"][number]["key_type"]; patterns: RegExp[] }> = [
  { type: "primary", patterns: [/^id$/i, /_id$/i, /^pk$/i, /^key$/i, /رقم$/] },
  { type: "foreign", patterns: [/_ref$/i, /_fk$/i, /parent_/i, /مرجع$/] },
  { type: "natural", patterns: [/code$/i, /^sku$/i, /^isbn$/i, /^ean$/i, /رمز$/] }
];

export class DataClassifier {
  /**
   * Classify the domain of a dataset based on column names and sample values.
   */
  classifyFileDomain(fileRef: string, columns: string[], sampleRows: RowData[]): FileDomainClassification {
    const allText = [...columns, ...sampleRows.flatMap((row) => Object.values(row).map(String))].join(" ").toLowerCase();
    const scores: Array<{ domain: string; score: number; evidence: string[] }> = [];

    for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
      const evidence: string[] = [];
      let score = 0;
      for (const kw of keywords) {
        if (allText.includes(kw.toLowerCase())) {
          score++;
          evidence.push(kw);
        }
      }
      if (score > 0) {
        scores.push({ domain, score, evidence });
      }
    }

    scores.sort((a, b) => b.score - a.score);
    const maxScore = scores[0]?.score ?? 0;
    const primary = scores[0] ?? { domain: "general", score: 0, evidence: [] };
    const confidence = maxScore > 0 ? Math.min(0.95, 0.4 + primary.score * 0.1) : 0.3;

    return {
      file_ref: fileRef,
      detected_domain: primary.domain,
      confidence: Math.round(confidence * 100) / 100,
      secondary_domains: scores.slice(1, 4).map((s) => ({
        domain: s.domain,
        confidence: Math.round(Math.min(0.9, 0.3 + s.score * 0.08) * 100) / 100
      })),
      evidence: primary.evidence
    };
  }

  /**
   * Detect entity keys (primary, foreign, natural) from column names and value patterns.
   */
  detectEntityKeys(fileRef: string, columns: string[], sampleRows: RowData[]): EntityKeyDetection {
    const keys: EntityKeyDetection["entity_keys"] = [];

    for (const col of columns) {
      for (const indicator of KEY_INDICATORS) {
        if (indicator.patterns.some((p) => p.test(col))) {
          const uniqueValues = new Set(sampleRows.map((r) => String(r[col] ?? "")));
          const uniquenessRatio = sampleRows.length > 0 ? uniqueValues.size / sampleRows.length : 0;
          const isLikelyKey = indicator.type === "primary" ? uniquenessRatio > 0.9 : true;
          if (isLikelyKey) {
            keys.push({
              column: col,
              key_type: indicator.type,
              confidence: Math.round((indicator.type === "primary" ? uniquenessRatio : 0.7) * 100) / 100,
              evidence: `Pattern match: ${indicator.patterns.find((p) => p.test(col))?.source ?? "unknown"}, uniqueness: ${Math.round(uniquenessRatio * 100)}%`
            });
          }
          break;
        }
      }

      // Check for composite keys by detecting high cardinality non-id columns
      if (!keys.some((k) => k.column === col)) {
        const uniqueValues = new Set(sampleRows.map((r) => String(r[col] ?? "")));
        const uniquenessRatio = sampleRows.length > 0 ? uniqueValues.size / sampleRows.length : 0;
        if (uniquenessRatio > 0.95 && sampleRows.length > 5) {
          keys.push({
            column: col,
            key_type: "composite",
            confidence: 0.6,
            evidence: `High uniqueness (${Math.round(uniquenessRatio * 100)}%) suggests possible key component.`
          });
        }
      }
    }

    return { file_ref: fileRef, entity_keys: keys };
  }

  /**
   * Detect time/date dimension columns from column names and sample values.
   */
  detectTimeDimension(fileRef: string, columns: string[], sampleRows: RowData[]): TimeDimensionDetection {
    const timeColumns: TimeDimensionDetection["time_columns"] = [];
    const timeNamePatterns = [/date/i, /time/i, /year/i, /month/i, /day/i, /quarter/i, /period/i, /تاريخ/i, /سنة/i, /شهر/i, /فترة/i];

    for (const col of columns) {
      const nameMatch = timeNamePatterns.some((p) => p.test(col));
      const values = sampleRows.map((r) => String(r[col] ?? "")).filter((v) => v.length > 0);

      for (const tp of TIME_PATTERNS) {
        const matchCount = values.filter((v) => tp.patterns.some((p) => p.test(v))).length;
        const coverage = values.length > 0 ? matchCount / values.length : 0;

        if (coverage > 0.5 || (nameMatch && coverage > 0.2)) {
          timeColumns.push({
            column: col,
            granularity: tp.granularity,
            format_detected: tp.format,
            coverage_pct: Math.round(coverage * 100),
            confidence: Math.round(Math.min(0.95, (nameMatch ? 0.3 : 0) + coverage * 0.65) * 100) / 100
          });
          break;
        }
      }

      // Fallback: column name suggests time but no value pattern matched
      if (nameMatch && !timeColumns.some((tc) => tc.column === col)) {
        timeColumns.push({
          column: col,
          granularity: "day",
          format_detected: "unknown",
          coverage_pct: 0,
          confidence: 0.4
        });
      }
    }

    return { file_ref: fileRef, time_columns: timeColumns };
  }

  /**
   * Detect columns that may contain sensitive/PII data.
   */
  detectSensitiveColumns(fileRef: string, columns: string[], sampleRows: RowData[]): SensitiveColumnDetection {
    const sensitive: SensitiveColumnDetection["sensitive_columns"] = [];

    for (const col of columns) {
      for (const sp of SENSITIVE_PATTERNS) {
        const nameMatch = sp.patterns.some((p) => p.test(col));
        const values = sampleRows.map((r) => String(r[col] ?? ""));
        const valueMatch = values.some((v) => sp.patterns.some((p) => p.test(v)));

        if (nameMatch || valueMatch) {
          sensitive.push({
            column: col,
            sensitivity_type: sp.type,
            pattern_matched: sp.patterns.find((p) => p.test(col))?.source ?? sp.patterns.find((p) => values.some((v) => p.test(v)))?.source ?? "unknown",
            confidence: nameMatch ? 0.9 : 0.65,
            recommendation: sp.recommendation
          });
          break;
        }
      }
    }

    return { file_ref: fileRef, sensitive_columns: sensitive };
  }

  /**
   * Build a knowledge graph from dataset structure and relationships.
   */
  buildKnowledgeGraph(fileRef: string, columns: string[], sampleRows: RowData[]): KnowledgeGraph {
    const nodes: KnowledgeGraphNode[] = [];
    const edges: KnowledgeGraphEdge[] = [];
    let nodeIdx = 0;
    let edgeIdx = 0;

    // Create entity node for the dataset itself
    const datasetNodeId = `kg-node-${nodeIdx++}`;
    nodes.push({
      node_id: datasetNodeId,
      node_type: "entity",
      label: fileRef,
      properties: { row_count: sampleRows.length, column_count: columns.length }
    });

    const numericColumns: string[] = [];
    const dimensionColumns: string[] = [];

    for (const col of columns) {
      const values = sampleRows.map((r) => r[col]);
      const numericCount = values.filter((v) => typeof v === "number" || (typeof v === "string" && v !== "" && !Number.isNaN(Number(v)))).length;
      const isNumeric = sampleRows.length > 0 && numericCount / sampleRows.length > 0.7;

      const nodeId = `kg-node-${nodeIdx++}`;
      const nodeType = isNumeric ? "metric" as const : "dimension" as const;
      nodes.push({
        node_id: nodeId,
        node_type: nodeType,
        label: col,
        properties: { is_numeric: isNumeric, sample_values: values.slice(0, 3).map(String) }
      });

      edges.push({
        edge_id: `kg-edge-${edgeIdx++}`,
        from_node: datasetNodeId,
        to_node: nodeId,
        relationship: isNumeric ? "has_metric" : "has_dimension",
        weight: 1.0
      });

      if (isNumeric) numericColumns.push(col);
      else dimensionColumns.push(col);
    }

    // Detect potential relationships between dimensions and metrics
    for (const dim of dimensionColumns) {
      for (const metric of numericColumns) {
        const dimNode = nodes.find((n) => n.label === dim);
        const metricNode = nodes.find((n) => n.label === metric);
        if (dimNode && metricNode) {
          edges.push({
            edge_id: `kg-edge-${edgeIdx++}`,
            from_node: dimNode.node_id,
            to_node: metricNode.node_id,
            relationship: "groups",
            weight: 0.8
          });
        }
      }
    }

    return {
      file_ref: fileRef,
      nodes,
      edges,
      entity_count: nodes.filter((n) => n.node_type === "entity").length,
      relationship_count: edges.length
    };
  }

  /**
   * Produce an executive summary of the dataset. No auto-success language without evidence.
   */
  produceExecutiveSummary(fileRef: string, columns: string[], rows: RowData[]): ExecutiveSummary {
    const numericCols = columns.filter((col) =>
      rows.some((r) => typeof r[col] === "number" || (typeof r[col] === "string" && r[col] !== "" && !Number.isNaN(Number(r[col]))))
    );

    // Completeness check
    let filledCells = 0;
    const totalCells = rows.length * columns.length;
    for (const row of rows) {
      for (const col of columns) {
        const val = row[col];
        if (val !== null && val !== undefined && val !== "") filledCells++;
      }
    }
    const completeness = totalCells > 0 ? filledCells / totalCells : 0;

    // Primary metrics
    const primaryMetrics: ExecutiveSummary["primary_metrics"] = [];
    for (const col of numericCols.slice(0, 5)) {
      const values = rows.map((r) => Number(r[col])).filter((v) => !Number.isNaN(v));
      if (values.length > 0) {
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);
        primaryMetrics.push({
          name: col,
          value: Math.round(sum * 100) / 100,
          interpretation: `Sum=${Math.round(sum * 100) / 100}, Avg=${Math.round(avg * 100) / 100}, Range=[${min}, ${max}], N=${values.length}`
        });
      }
    }

    // Key findings
    const findings: string[] = [];
    findings.push(`Dataset contains ${rows.length} rows and ${columns.length} columns.`);
    findings.push(`Data completeness: ${Math.round(completeness * 100)}%.`);
    if (numericCols.length > 0) {
      findings.push(`${numericCols.length} numeric column(s) detected: ${numericCols.slice(0, 5).join(", ")}.`);
    }
    const categoricalCols = columns.filter((c) => !numericCols.includes(c));
    if (categoricalCols.length > 0) {
      findings.push(`${categoricalCols.length} categorical column(s): ${categoricalCols.slice(0, 5).join(", ")}.`);
    }

    // Duplicate row check
    const rowHashes = new Set(rows.map((r) => JSON.stringify(r)));
    const duplicates = rows.length - rowHashes.size;
    if (duplicates > 0) {
      findings.push(`${duplicates} duplicate row(s) detected.`);
    }

    // Risk flags
    const riskFlags: string[] = [];
    if (completeness < 0.8) riskFlags.push(`Low data completeness (${Math.round(completeness * 100)}%). Missing values may affect analysis accuracy.`);
    if (duplicates > rows.length * 0.1) riskFlags.push(`High duplicate ratio (${duplicates}/${rows.length}). Consider deduplication.`);
    if (columns.length > 50) riskFlags.push("Wide dataset (>50 columns). Consider feature selection.");
    if (rows.length < 10) riskFlags.push("Very small dataset. Statistical conclusions may be unreliable.");

    // Quality score (evidence-based)
    let qualityScore = 0.5;
    if (completeness > 0.95) qualityScore += 0.2;
    else if (completeness > 0.8) qualityScore += 0.1;
    if (duplicates === 0) qualityScore += 0.15;
    if (numericCols.length > 0) qualityScore += 0.1;
    if (rows.length > 100) qualityScore += 0.05;
    qualityScore = Math.min(1.0, qualityScore);

    // Recommended actions
    const actions: string[] = [];
    if (completeness < 0.95) actions.push("Address missing values before aggregation.");
    if (duplicates > 0) actions.push("Run deduplication pass.");
    if (numericCols.length > 0) actions.push("Build KPI dashboard from numeric columns.");
    if (categoricalCols.length > 0 && numericCols.length > 0) actions.push("Create group-by analysis on categorical dimensions.");

    const domain = this.classifyFileDomain(fileRef, columns, rows);

    return {
      file_ref: fileRef,
      domain: domain.detected_domain,
      row_count: rows.length,
      column_count: columns.length,
      key_findings: findings,
      data_quality_score: Math.round(qualityScore * 100) / 100,
      completeness_pct: Math.round(completeness * 100),
      primary_metrics: primaryMetrics,
      risk_flags: riskFlags,
      recommended_actions: actions
    };
  }
}
