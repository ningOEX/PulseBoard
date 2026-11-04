import type { Aggregation, Dataset } from './types';

type Row = Record<string, string | number>;

export interface AggregateRequest {
  dimension: string;
  breakdown?: string;
  metric: string;
  aggregation: Aggregation;
  topN?: number;
  filters?: Record<string, string>;
}

export interface AggregateSeries {
  name: string;
  values: number[];
}

export interface AggregateResponse {
  categories: string[];
  series: AggregateSeries[];
  metricLabel: string;
  dimensionLabel: string;
  breakdownLabel: string | null;
  isCount: boolean;
}

function distinct(rows: Row[], key: string): string[] {
  const result = new Set<string>();
  for (const row of rows) {
    const value = String(row[key] ?? '');
    if (value) result.add(value);
  }
  return [...result];
}

function toNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function aggregate(rows: Row[], metric: string, mode: Aggregation): number {
  if (mode === 'count') return rows.length;
  if (!rows.length) return 0;
  const total = rows.reduce((sum, row) => sum + toNumber(row[metric]), 0);
  return mode === 'avg' ? Math.round((total / rows.length) * 100) / 100 : Math.round(total);
}

function applyFilters(rows: Row[], filters?: Record<string, string>): Row[] {
  if (!filters) return rows;
  const entries = Object.entries(filters).filter(([, value]) => value !== undefined && value !== null && value !== '');
  if (!entries.length) return rows;
  return rows.filter((row) => entries.every(([key, value]) => String(row[key]) === String(value)));
}

/** 通用聚合：按维度分组，可选再按 breakdown 拆成多系列 */
export function computeAggregation(dataset: Dataset, request: AggregateRequest): AggregateResponse {
  const { dimension, breakdown, metric, aggregation, topN, filters } = request;
  const rows = applyFilters(dataset.rows, filters);

  const dimensionField = dataset.fields.find((f) => f.key === dimension);
  const metricField = dataset.fields.find((f) => f.key === metric);
  const breakdownField = breakdown ? dataset.fields.find((f) => f.key === breakdown) : undefined;

  let categories = distinct(rows, dimension);
  const breakdowns = breakdown ? distinct(rows, breakdown) : [breakdownField?.label ?? metricField?.label ?? metric];

  // topN：按第一系列的值截断
  if (topN && topN > 0 && categories.length > topN) {
    const firstBreakdown = breakdowns[0];
    const scored = categories.map((cat) => {
      const filtered = breakdown
        ? rows.filter((row) => String(row[dimension]) === cat && String(row[breakdown]) === firstBreakdown)
        : rows.filter((row) => String(row[dimension]) === cat);
      return { cat, score: aggregate(filtered, metric, aggregation) };
    });
    categories = scored
      .sort((a, b) => b.score - a.score)
      .slice(0, topN)
      .map((item) => item.cat);
  }

  const series = breakdowns.map((group) => ({
    name: breakdown ? group : metricField?.label ?? metric,
    values: categories.map((category) => {
      const filtered = breakdown
        ? rows.filter((row) => String(row[dimension]) === category && String(row[breakdown]) === group)
        : rows.filter((row) => String(row[dimension]) === category);
      return aggregate(filtered, metric, aggregation);
    }),
  }));

  return {
    categories,
    series,
    metricLabel: metricField?.label ?? metric,
    dimensionLabel: dimensionField?.label ?? dimension,
    breakdownLabel: breakdownField?.label ?? null,
    isCount: aggregation === 'count',
  };
}

/** 仪表盘/指标图用：直接聚合整个数据集 */
export function computeTotal(dataset: Dataset, metric: string, aggregation: Aggregation, filters?: Record<string, string>): number {
  const rows = applyFilters(dataset.rows, filters);
  return aggregate(rows, metric, aggregation);
}

/** 取所有 measure 字段的 topN 汇总，用于概览卡片 */
export function computeOverview(dataset: Dataset, filters?: Record<string, string>): Record<string, number> {
  const rows = applyFilters(dataset.rows, filters);
  const measures = dataset.fields.filter((f) => f.type === 'measure');
  const result: Record<string, number> = {};
  for (const m of measures) result[m.key] = aggregate(rows, m.key, 'sum');
  return result;
}
