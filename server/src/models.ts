import mongoose, { Schema } from 'mongoose';

const widgetSchema = new Schema(
  {
    id: { type: String, required: true },
    title: { type: String, required: true },
    chartType: { type: String, required: true },
    datasetId: { type: String, required: true },
    dimension: { type: String, default: '' },
    breakdown: { type: String, default: '' },
    metric: { type: String, default: '' },
    aggregation: { type: String, default: 'sum' },
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    w: { type: Number, default: 6 },
    h: { type: Number, default: 4 },
    updatedBy: { type: String, default: '' },
    updatedAt: { type: String, default: '' },
  },
  { _id: false },
);

const dashboardSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    widgets: { type: [widgetSchema], default: [] },
    version: { type: Number, default: 1 },
    updatedAt: { type: String, default: () => new Date().toISOString() },
  },
  { versionKey: false },
);

const datasetSchema = new Schema(
  {
    _id: { type: String, required: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    fields: {
      type: [
        new Schema(
          {
            key: { type: String, required: true },
            label: { type: String, required: true },
            type: { type: String, default: 'dimension' },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    rows: { type: [Schema.Types.Mixed], default: [] },
  },
  { versionKey: false },
);

export const DashboardModel = mongoose.model('Dashboard', dashboardSchema);
export const DatasetModel = mongoose.model('Dataset', datasetSchema);
