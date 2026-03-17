/**
 * Predictive & What-If module:
 *  - Forecasting (time-series extrapolation)
 *  - Scenario simulation (what-if analysis)
 *  - Label confidence + assumptions
 *  - Must NOT invent inputs — only operates on real platform data
 */

type RowData = Record<string, unknown>;

export type ForecastPoint = {
  period_index: number;
  period_label: string;
  predicted_value: number;
  lower_bound: number;
  upper_bound: number;
  confidence: number;
};

export type ForecastResult = {
  forecast_id: string;
  file_ref: string;
  metric_column: string;
  time_column: string;
  method: "linear_trend" | "moving_average" | "exponential_smoothing";
  historical_points: number;
  forecast_horizon: number;
  forecasted_points: ForecastPoint[];
  model_confidence: number;
  assumptions: string[];
  limitations: string[];
  source_refs: string[];
  created_at: string;
};

export type ScenarioParam = {
  column: string;
  adjustment_type: "absolute" | "percentage" | "replace";
  adjustment_value: number;
  description: string;
};

export type ScenarioResult = {
  scenario_id: string;
  file_ref: string;
  scenario_name: string;
  parameters: ScenarioParam[];
  baseline_metrics: Record<string, number>;
  scenario_metrics: Record<string, number>;
  delta_metrics: Record<string, { absolute: number; percentage: number }>;
  impact_summary: string;
  confidence: number;
  assumptions: string[];
  limitations: string[];
  source_refs: string[];
  created_at: string;
};

let forecastCounter = 0;
let scenarioCounter = 0;
const nextForecastId = (): string => `forecast-${++forecastCounter}-${Date.now()}`;
const nextScenarioId = (): string => `scenario-${++scenarioCounter}-${Date.now()}`;

/**
 * Simple linear regression for trend extrapolation.
 */
const linearRegression = (values: number[]): { slope: number; intercept: number; r_squared: number } => {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0, r_squared: 0 };

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i]!;
    sumXY += i * values[i]!;
    sumX2 += i * i;
    sumY2 += values[i]! * values[i]!;
  }

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n, r_squared: 0 };

  const slope = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  // R-squared
  const yMean = sumY / n;
  const ssTot = values.reduce((s, v) => s + (v - yMean) ** 2, 0);
  const ssRes = values.reduce((s, v, i) => s + (v - (intercept + slope * i)) ** 2, 0);
  const rSquared = ssTot === 0 ? 0 : 1 - ssRes / ssTot;

  return { slope, intercept, r_squared: Math.max(0, rSquared) };
};

/**
 * Moving average calculation.
 */
const movingAverage = (values: number[], window: number): number[] => {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    result.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return result;
};

/**
 * Simple exponential smoothing.
 */
const exponentialSmoothing = (values: number[], alpha = 0.3): number[] => {
  if (values.length === 0) return [];
  const result: number[] = [values[0]!];
  for (let i = 1; i < values.length; i++) {
    result.push(alpha * values[i]! + (1 - alpha) * result[i - 1]!);
  }
  return result;
};

export class PredictiveEngine {
  /**
   * Generate time-series forecast from real data.
   * Must NOT invent inputs. Only extrapolates from provided data.
   */
  forecast(params: {
    file_ref: string;
    rows: RowData[];
    metric_column: string;
    time_column: string;
    horizon?: number;
    method?: ForecastResult["method"];
    source_refs?: string[];
  }): ForecastResult {
    const forecastId = nextForecastId();
    const horizon = params.horizon ?? 6;
    const method = params.method ?? "linear_trend";
    const assumptions: string[] = [];
    const limitations: string[] = [];

    // Extract time-ordered numeric values from real data
    const sortedRows = [...params.rows].sort((a, b) =>
      String(a[params.time_column] ?? "").localeCompare(String(b[params.time_column] ?? ""))
    );

    const values = sortedRows
      .map((r) => Number(r[params.metric_column]))
      .filter((v) => !Number.isNaN(v));

    const timeLabels = sortedRows.map((r) => String(r[params.time_column] ?? ""));

    if (values.length < 3) {
      limitations.push("Insufficient data points for reliable forecasting (minimum 3 required).");
      return {
        forecast_id: forecastId,
        file_ref: params.file_ref,
        metric_column: params.metric_column,
        time_column: params.time_column,
        method,
        historical_points: values.length,
        forecast_horizon: horizon,
        forecasted_points: [],
        model_confidence: 0.1,
        assumptions: ["Data is insufficient for extrapolation."],
        limitations,
        source_refs: params.source_refs ?? [params.file_ref],
        created_at: new Date().toISOString()
      };
    }

    assumptions.push("Historical trend continues into forecast period.");
    assumptions.push(`Using ${method.replace(/_/g, " ")} method.`);
    assumptions.push("No structural breaks or regime changes assumed.");
    limitations.push("Forecast is purely mechanical extrapolation, not causal prediction.");
    limitations.push("External factors not modeled.");

    let forecasted: ForecastPoint[] = [];
    let modelConfidence = 0.5;

    if (method === "linear_trend") {
      const { slope, intercept, r_squared } = linearRegression(values);
      modelConfidence = Math.min(0.9, 0.3 + r_squared * 0.6);

      // Compute residual std for confidence intervals
      const residuals = values.map((v, i) => v - (intercept + slope * i));
      const residualStd = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / Math.max(1, residuals.length - 2));

      forecasted = Array.from({ length: horizon }, (_, i) => {
        const idx = values.length + i;
        const predicted = intercept + slope * idx;
        const uncertainty = residualStd * Math.sqrt(1 + 1 / values.length + (idx - values.length / 2) ** 2 / (values.reduce((s, _, j) => s + (j - values.length / 2) ** 2, 0) || 1));
        const confidence = Math.max(0.1, modelConfidence - i * 0.05);
        return {
          period_index: idx,
          period_label: `T+${i + 1}`,
          predicted_value: Math.round(predicted * 100) / 100,
          lower_bound: Math.round((predicted - 1.96 * uncertainty) * 100) / 100,
          upper_bound: Math.round((predicted + 1.96 * uncertainty) * 100) / 100,
          confidence: Math.round(confidence * 100) / 100
        };
      });

      assumptions.push(`R² = ${Math.round(r_squared * 1000) / 1000}. Slope = ${Math.round(slope * 1000) / 1000} per period.`);
    } else if (method === "moving_average") {
      const window = Math.min(5, Math.floor(values.length / 2));
      const smoothed = movingAverage(values, window);
      const lastSmoothed = smoothed[smoothed.length - 1] ?? values[values.length - 1]!;
      const trend = smoothed.length > 1 ? (smoothed[smoothed.length - 1]! - smoothed[smoothed.length - 2]!) : 0;
      modelConfidence = 0.5;

      const residuals = values.map((v, i) => v - smoothed[i]!);
      const residualStd = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / Math.max(1, residuals.length));

      forecasted = Array.from({ length: horizon }, (_, i) => {
        const predicted = lastSmoothed + trend * (i + 1);
        const confidence = Math.max(0.1, modelConfidence - i * 0.06);
        return {
          period_index: values.length + i,
          period_label: `T+${i + 1}`,
          predicted_value: Math.round(predicted * 100) / 100,
          lower_bound: Math.round((predicted - 1.96 * residualStd) * 100) / 100,
          upper_bound: Math.round((predicted + 1.96 * residualStd) * 100) / 100,
          confidence: Math.round(confidence * 100) / 100
        };
      });

      assumptions.push(`Window size = ${window}. Last smoothed value = ${Math.round(lastSmoothed * 100) / 100}.`);
    } else {
      // exponential_smoothing
      const alpha = 0.3;
      const smoothed = exponentialSmoothing(values, alpha);
      const lastSmoothed = smoothed[smoothed.length - 1] ?? values[values.length - 1]!;
      modelConfidence = 0.55;

      const residuals = values.map((v, i) => v - smoothed[i]!);
      const residualStd = Math.sqrt(residuals.reduce((s, r) => s + r * r, 0) / Math.max(1, residuals.length));

      forecasted = Array.from({ length: horizon }, (_, i) => {
        const predicted = lastSmoothed;
        const confidence = Math.max(0.1, modelConfidence - i * 0.07);
        return {
          period_index: values.length + i,
          period_label: `T+${i + 1}`,
          predicted_value: Math.round(predicted * 100) / 100,
          lower_bound: Math.round((predicted - 1.96 * residualStd * Math.sqrt(i + 1)) * 100) / 100,
          upper_bound: Math.round((predicted + 1.96 * residualStd * Math.sqrt(i + 1)) * 100) / 100,
          confidence: Math.round(confidence * 100) / 100
        };
      });

      assumptions.push(`Smoothing factor α = ${alpha}. Flat forecast from last smoothed level.`);
    }

    if (values.length < 10) {
      limitations.push(`Only ${values.length} data points. Forecast reliability is limited.`);
      modelConfidence = Math.min(modelConfidence, 0.5);
    }

    return {
      forecast_id: forecastId,
      file_ref: params.file_ref,
      metric_column: params.metric_column,
      time_column: params.time_column,
      method,
      historical_points: values.length,
      forecast_horizon: horizon,
      forecasted_points: forecasted,
      model_confidence: Math.round(modelConfidence * 100) / 100,
      assumptions,
      limitations,
      source_refs: params.source_refs ?? [params.file_ref],
      created_at: new Date().toISOString()
    };
  }

  /**
   * Run scenario simulation (what-if analysis).
   * Applies adjustments to actual data and computes impact. Must NOT invent inputs.
   */
  simulateScenario(params: {
    file_ref: string;
    rows: RowData[];
    scenario_name: string;
    parameters: ScenarioParam[];
    metric_columns: string[];
    source_refs?: string[];
  }): ScenarioResult {
    const scenarioId = nextScenarioId();
    const assumptions: string[] = [];
    const limitations: string[] = [];

    if (params.rows.length === 0) {
      return {
        scenario_id: scenarioId,
        file_ref: params.file_ref,
        scenario_name: params.scenario_name,
        parameters: params.parameters,
        baseline_metrics: {},
        scenario_metrics: {},
        delta_metrics: {},
        impact_summary: "Cannot simulate: no data provided.",
        confidence: 0.1,
        assumptions: ["No data available for simulation."],
        limitations: ["Empty dataset."],
        source_refs: params.source_refs ?? [params.file_ref],
        created_at: new Date().toISOString()
      };
    }

    // Compute baseline metrics from real data
    const baseline: Record<string, number> = {};
    for (const metric of params.metric_columns) {
      const values = params.rows.map((r) => Number(r[metric])).filter((v) => !Number.isNaN(v));
      baseline[metric] = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100 : 0;
    }

    // Apply scenario adjustments
    const adjustedRows = params.rows.map((row) => {
      const adjusted = { ...row };
      for (const param of params.parameters) {
        const currentValue = Number(adjusted[param.column]);
        if (Number.isNaN(currentValue)) continue;

        switch (param.adjustment_type) {
          case "absolute":
            adjusted[param.column] = currentValue + param.adjustment_value;
            break;
          case "percentage":
            adjusted[param.column] = currentValue * (1 + param.adjustment_value / 100);
            break;
          case "replace":
            adjusted[param.column] = param.adjustment_value;
            break;
        }
      }
      return adjusted;
    });

    // Compute scenario metrics
    const scenarioMetrics: Record<string, number> = {};
    for (const metric of params.metric_columns) {
      const values = adjustedRows.map((r) => Number(r[metric])).filter((v) => !Number.isNaN(v));
      scenarioMetrics[metric] = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) * 100) / 100 : 0;
    }

    // Compute deltas
    const deltaMetrics: Record<string, { absolute: number; percentage: number }> = {};
    for (const metric of params.metric_columns) {
      const baseVal = baseline[metric] ?? 0;
      const scenVal = scenarioMetrics[metric] ?? 0;
      const absolute = Math.round((scenVal - baseVal) * 100) / 100;
      const percentage = baseVal !== 0 ? Math.round(((scenVal - baseVal) / Math.abs(baseVal)) * 10000) / 100 : 0;
      deltaMetrics[metric] = { absolute, percentage };
    }

    // Build impact summary
    const impactParts: string[] = [];
    for (const [metric, delta] of Object.entries(deltaMetrics)) {
      const direction = delta.absolute > 0 ? "increase" : delta.absolute < 0 ? "decrease" : "no change";
      impactParts.push(`${metric}: ${direction} of ${Math.abs(delta.absolute)} (${delta.percentage >= 0 ? "+" : ""}${delta.percentage}%)`);
    }

    // Confidence based on data quality and adjustment magnitude
    let confidence = 0.7;
    for (const param of params.parameters) {
      if (param.adjustment_type === "percentage" && Math.abs(param.adjustment_value) > 50) {
        confidence -= 0.1;
        limitations.push(`Large adjustment (${param.adjustment_value}%) on ${param.column} may produce unrealistic results.`);
      }
    }
    if (params.rows.length < 10) {
      confidence -= 0.15;
      limitations.push("Small dataset. Scenario results may not generalize.");
    }

    assumptions.push("Adjustments are applied independently (no interaction effects).");
    assumptions.push("All other factors remain constant (ceteris paribus).");
    assumptions.push("Scenario operates on actual platform data — no synthetic inputs.");

    return {
      scenario_id: scenarioId,
      file_ref: params.file_ref,
      scenario_name: params.scenario_name,
      parameters: params.parameters,
      baseline_metrics: baseline,
      scenario_metrics: scenarioMetrics,
      delta_metrics: deltaMetrics,
      impact_summary: impactParts.join("; ") || "No measurable impact.",
      confidence: Math.round(Math.max(0.1, confidence) * 100) / 100,
      assumptions,
      limitations,
      source_refs: params.source_refs ?? [params.file_ref],
      created_at: new Date().toISOString()
    };
  }
}
