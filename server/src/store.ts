import { randomUUID } from 'node:crypto';
import { connectMongo } from './db';
import { env } from './env';
import { DashboardModel, DatasetModel } from './models';
import { createSeedDashboard, createSeedDatasets, SEED_DASHBOARD_ID } from './seedData';
import type { DashboardRecord, Dataset } from './types';

export interface Store {
  mode: 'mongo';
  listDashboards(): Promise<DashboardRecord[]>;
  getDashboard(id: string): Promise<DashboardRecord | null>;
  createDashboard(name: string): Promise<DashboardRecord>;
  saveDashboard(dashboard: DashboardRecord): Promise<void>;
  deleteDashboard(id: string): Promise<void>;
  listDatasets(): Promise<Dataset[]>;
  getDataset(id: string): Promise<Dataset | null>;
  createDataset(input: Omit<Dataset, 'id'>): Promise<Dataset>;
  saveDataset(dataset: Dataset): Promise<void>;
  deleteDataset(id: string): Promise<void>;
}

interface LeanDashboard {
  _id: string;
  name: string;
  widgets: DashboardRecord['widgets'];
  version: number;
  updatedAt: string;
}

interface LeanDataset {
  _id: string;
  name: string;
  description: string;
  fields: Dataset['fields'];
  rows: Dataset['rows'];
}

function mapDashboard(doc: LeanDashboard): DashboardRecord {
  return {
    id: doc._id,
    name: doc.name,
    widgets: doc.widgets ?? [],
    version: doc.version ?? 1,
    updatedAt: doc.updatedAt ?? new Date().toISOString(),
  };
}

function mapDataset(doc: LeanDataset): Dataset {
  return {
    id: doc._id,
    name: doc.name,
    description: doc.description ?? '',
    fields: doc.fields ?? [],
    rows: doc.rows ?? [],
  };
}

export async function initStore(): Promise<Store> {
  const ok = await connectMongo(env.mongoUri);
  if (!ok) {
    throw new Error(
      'MongoDB 连接失败。请确认 MongoDB 服务已启动：\n' +
        '  winget install MongoDB.Server\n' +
        '  net start MongoDB\n' +
        `  当前连接串：${env.mongoUri}`,
    );
  }

  // 种子数据只在集合为空时写入，不覆盖已有真实数据
  const datasets = createSeedDatasets();
  for (const dataset of datasets) {
    await DatasetModel.updateOne({ _id: dataset.id }, { $setOnInsert: { ...dataset } }, { upsert: true });
  }
  await DashboardModel.updateOne(
    { _id: SEED_DASHBOARD_ID },
    { $setOnInsert: { ...createSeedDashboard() } },
    { upsert: true },
  );

  const store: Store = {
    mode: 'mongo',

    async listDashboards() {
      const docs = await DashboardModel.find().sort({ updatedAt: -1 }).lean<LeanDashboard[]>();
      return docs.map(mapDashboard);
    },

    async getDashboard(id) {
      const doc = await DashboardModel.findById(id).lean<LeanDashboard | null>();
      return doc ? mapDashboard(doc) : null;
    },

    async createDashboard(name) {
      const dashboard: DashboardRecord = {
        id: randomUUID(),
        name,
        widgets: [],
        version: 1,
        updatedAt: new Date().toISOString(),
      };
      await DashboardModel.create({ _id: dashboard.id, ...dashboard });
      return dashboard;
    },

    async saveDashboard(dashboard) {
      await DashboardModel.updateOne(
        { _id: dashboard.id },
        {
          $set: {
            name: dashboard.name,
            widgets: dashboard.widgets,
            version: dashboard.version,
            updatedAt: dashboard.updatedAt,
          },
        },
        { upsert: true },
      );
    },

    async deleteDashboard(id) {
      await DashboardModel.deleteOne({ _id: id });
    },

    async listDatasets() {
      const docs = await DatasetModel.find().lean<LeanDataset[]>();
      return docs.map(mapDataset);
    },

    async getDataset(id) {
      const doc = await DatasetModel.findById(id).lean<LeanDataset | null>();
      return doc ? mapDataset(doc) : null;
    },

    async createDataset(input) {
      const id = randomUUID();
      await DatasetModel.create({ _id: id, ...input });
      return { id, ...input };
    },

    async saveDataset(dataset) {
      await DatasetModel.updateOne(
        { _id: dataset.id },
        { $set: { name: dataset.name, description: dataset.description, fields: dataset.fields, rows: dataset.rows } },
        { upsert: true },
      );
    },

    async deleteDataset(id) {
      await DatasetModel.deleteOne({ _id: id });
    },
  };

  console.log('[store] ✅ 使用 MongoDB 持久化存储');
  return store;
}
