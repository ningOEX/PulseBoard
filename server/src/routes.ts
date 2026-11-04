import { Router } from 'express';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import { computeAggregation, computeOverview, computeTotal } from './aggregation';
import type { Store } from './store';
import type { Dataset, DatasetField } from './types';

// 种子看板 ID，受保护不允许删除
const PROTECTED_DASHBOARD_IDS = new Set(['team-sales']);

/** 推断字段类型：整列均为数字 → measure，否则 dimension */
function inferFields(rows: Record<string, string | number>[]): DatasetField[] {
  const keys = Object.keys(rows[0] ?? {});
  return keys.map((key) => {
    const allNumeric = rows.every((row) => {
      const value = row[key];
      return value === '' || value === null || value === undefined || !Number.isNaN(Number(value));
    });
    return { key, label: key, type: allNumeric ? 'measure' : 'dimension' };
  });
}

/** 按字段类型把行值标准化（measure 转 number，其余保留原始字符串） */
function normalizeRows(rows: Record<string, string | number>[], fields: DatasetField[]): Record<string, string | number>[] {
  return rows.map((row) => {
    const next: Record<string, string | number> = {};
    for (const field of fields) {
      const value = row[field.key];
      if (field.type === 'measure' && value !== '' && value !== null && value !== undefined) {
        const number = Number(value);
        next[field.key] = Number.isFinite(number) ? number : 0;
      } else {
        next[field.key] = (value ?? '') as string;
      }
    }
    return next;
  });
}

export function createRouter(store: Store): Router {
  const router = Router();

  router.get('/health', async (_req, res) => {
    const datasetCount = (await store.listDatasets()).length;
    const dashboardCount = (await store.listDashboards()).length;
    res.json({ ok: true, mode: store.mode, datasetCount, dashboardCount });
  });

  // -------- 看板 --------
  router.get('/dashboards', async (_req, res) => {
    const dashboards = await store.listDashboards();
    res.json(
      dashboards.map((item) => ({
        id: item.id,
        name: item.name,
        version: item.version,
        updatedAt: item.updatedAt,
        widgetCount: item.widgets.length,
        isProtected: PROTECTED_DASHBOARD_IDS.has(item.id),
      })),
    );
  });

  router.post('/dashboards', async (req, res) => {
    const name = String(req.body?.name ?? '').trim().slice(0, 30);
    if (!name) {
      res.status(400).json({ error: '看板名称不能为空' });
      return;
    }
    const dashboard = await store.createDashboard(name);
    res.status(201).json(dashboard);
  });

  router.get('/dashboards/:id', async (req, res) => {
    const dashboard = await store.getDashboard(req.params.id);
    if (!dashboard) {
      res.status(404).json({ error: '看板不存在' });
      return;
    }
    res.json(dashboard);
  });

  router.delete('/dashboards/:id', async (req, res) => {
    if (PROTECTED_DASHBOARD_IDS.has(req.params.id)) {
      res.status(403).json({ error: '种子看板受保护，不允许删除' });
      return;
    }
    const dashboard = await store.getDashboard(req.params.id);
    if (!dashboard) {
      res.status(404).json({ error: '看板不存在' });
      return;
    }
    await store.deleteDashboard(req.params.id);
    res.json({ ok: true });
  });

  // -------- 数据集 --------
  router.get('/datasets/summaries', async (_req, res) => {
    const datasets = await store.listDatasets();
    res.json(
      datasets.map((dataset) => ({
        id: dataset.id,
        name: dataset.name,
        description: dataset.description,
        fieldCount: dataset.fields.length,
        rowCount: dataset.rows.length,
      })),
    );
  });

  router.get('/datasets', async (_req, res) => {
    const datasets = await store.listDatasets();
    res.json(datasets);
  });

  router.get('/datasets/:id', async (req, res) => {
    const dataset = await store.getDataset(req.params.id);
    if (!dataset) {
      res.status(404).json({ error: '数据集不存在' });
      return;
    }
    res.json(dataset);
  });

  router.post('/datasets', async (req, res) => {
    const name = String(req.body?.name ?? '').trim().slice(0, 40);
    if (!name) {
      res.status(400).json({ error: '名称不能为空' });
      return;
    }
    const dataset: Omit<Dataset, 'id'> = {
      name,
      description: String(req.body?.description ?? '').slice(0, 200),
      fields: Array.isArray(req.body?.fields) ? req.body.fields : [],
      rows: Array.isArray(req.body?.rows) ? req.body.rows : [],
    };
    const created = await store.createDataset(dataset);
    res.status(201).json(created);
  });

  router.put('/datasets/:id', async (req, res) => {
    const existing = await store.getDataset(req.params.id);
    if (!existing) {
      res.status(404).json({ error: '数据集不存在' });
      return;
    }
    const dataset: Dataset = {
      ...existing,
      name: String(req.body?.name ?? existing.name).trim().slice(0, 40) || existing.name,
      description: String(req.body?.description ?? existing.description),
      fields: Array.isArray(req.body?.fields) ? req.body.fields : existing.fields,
      rows: Array.isArray(req.body?.rows) ? req.body.rows : existing.rows,
    };
    await store.saveDataset(dataset);
    res.json(dataset);
  });

  router.delete('/datasets/:id', async (req, res) => {
    await store.deleteDataset(req.params.id);
    res.status(204).end();
  });

  router.post('/datasets/:id/rows', async (req, res) => {
    const dataset = await store.getDataset(req.params.id);
    if (!dataset) {
      res.status(404).json({ error: '数据集不存在' });
      return;
    }
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : Array.isArray(req.body) ? req.body : null;
    if (!rows) {
      res.status(400).json({ error: 'rows 字段不能为空' });
      return;
    }
    dataset.rows = [...dataset.rows, ...rows];
    await store.saveDataset(dataset);
    res.json({ rowCount: dataset.rows.length, added: rows.length });
  });

  router.post('/datasets/:id/rows/replace', async (req, res) => {
    const dataset = await store.getDataset(req.params.id);
    if (!dataset) {
      res.status(404).json({ error: '数据集不存在' });
      return;
    }
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : null;
    if (!rows) {
      res.status(400).json({ error: 'rows 字段不能为空' });
      return;
    }
    dataset.rows = rows;
    await store.saveDataset(dataset);
    res.json({ rowCount: dataset.rows.length });
  });

  // -------- 聚合 --------
  router.post('/datasets/:id/aggregate', async (req, res) => {
    const dataset = await store.getDataset(req.params.id);
    if (!dataset) {
      res.status(404).json({ error: '数据集不存在' });
      return;
    }
    const { dimension, breakdown, metric, aggregation, topN, filters } = req.body ?? {};
    if (!dimension || !metric || !aggregation) {
      res.status(400).json({ error: 'dimension / metric / aggregation 必填' });
      return;
    }
    const result = computeAggregation(dataset, {
      dimension: String(dimension),
      breakdown: breakdown ? String(breakdown) : undefined,
      metric: String(metric),
      aggregation: String(aggregation) as never,
      topN: Number(topN) || undefined,
      filters: filters && typeof filters === 'object' ? (filters as Record<string, string>) : undefined,
    });
    res.json(result);
  });

  router.post('/datasets/:id/aggregate-total', async (req, res) => {
    const dataset = await store.getDataset(req.params.id);
    if (!dataset) {
      res.status(404).json({ error: '数据集不存在' });
      return;
    }
    const { metric, aggregation, filters } = req.body ?? {};
    if (!metric || !aggregation) {
      res.status(400).json({ error: 'metric / aggregation 必填' });
      return;
    }
    const total = computeTotal(dataset, String(metric), String(aggregation) as never, filters);
    res.json({ total });
  });

  router.post('/datasets/:id/overview', async (req, res) => {
    const dataset = await store.getDataset(req.params.id);
    if (!dataset) {
      res.status(404).json({ error: '数据集不存在' });
      return;
    }
    const result = computeOverview(dataset, req.body?.filters as Record<string, string> | undefined);
    res.json(result);
  });

  // -------- CSV 导入 --------
  router.post('/datasets/csv', async (req, res) => {
    const csv = typeof req.body === 'string' ? req.body : String(req.body?.csv ?? '');
    const name = String(req.body?.name ?? 'CSV 导入数据集').trim().slice(0, 40);
    if (!csv.trim()) {
      res.status(400).json({ error: 'CSV 内容不能为空' });
      return;
    }

    let rows: Record<string, string | number>[];
    try {
      rows = parse(csv.trim(), { columns: true, skip_empty_lines: true, trim: true });
    } catch (error) {
      res.status(400).json({ error: `CSV 解析失败：${(error as Error).message}` });
      return;
    }

    if (!rows.length) {
      res.status(400).json({ error: 'CSV 没有数据行' });
      return;
    }

    const fields = inferFields(rows);
    const normalized = normalizeRows(rows, fields);

    const created = await store.createDataset({
      name,
      description: `CSV 导入 ${new Date().toLocaleString('zh-CN')}`,
      fields,
      rows: normalized,
    });
    res.status(201).json(created);
  });

  // -------- Excel 导入 --------
  router.post('/datasets/excel', async (req, res) => {
    const base64 = String(req.body?.base64 ?? '');
    const name = String(req.body?.name ?? 'Excel 导入数据集').trim().slice(0, 40);
    if (!base64) {
      res.status(400).json({ error: 'Excel 文件内容不能为空' });
      return;
    }

    let rows: Record<string, string | number>[];
    try {
      const buffer = Buffer.from(base64, 'base64');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      if (!sheetName) {
        res.status(400).json({ error: 'Excel 文件中没有工作表' });
        return;
      }
      const sheet = workbook.Sheets[sheetName];
      rows = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { defval: '' });
    } catch (error) {
      res.status(400).json({ error: `Excel 解析失败：${(error as Error).message}` });
      return;
    }

    if (!rows.length) {
      res.status(400).json({ error: 'Excel 没有数据行（请确认第一行为表头）' });
      return;
    }

    const fields = inferFields(rows);
    const normalized = normalizeRows(rows, fields);

    const created = await store.createDataset({
      name,
      description: `Excel 导入 ${new Date().toLocaleString('zh-CN')}`,
      fields,
      rows: normalized,
    });
    res.status(201).json(created);
  });

  router.put('/datasets/:id/csv', async (req, res) => {
    const dataset = await store.getDataset(req.params.id);
    if (!dataset) {
      res.status(404).json({ error: '数据集不存在' });
      return;
    }
    const csv = typeof req.body === 'string' ? req.body : String(req.body?.csv ?? '');
    if (!csv.trim()) {
      res.status(400).json({ error: 'CSV 内容不能为空' });
      return;
    }
    let rows: Record<string, string | number>[];
    try {
      rows = parse(csv.trim(), { columns: true, skip_empty_lines: true, trim: true });
    } catch (error) {
      res.status(400).json({ error: `CSV 解析失败：${(error as Error).message}` });
      return;
    }
    dataset.rows = rows;
    await store.saveDataset(dataset);
    res.json({ rowCount: rows.length });
  });

  return router;
}
