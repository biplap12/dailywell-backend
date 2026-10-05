import { Schema, model } from 'mongoose';
import { addSyncIndexes } from '../../common/utils/ownedCrud';
import { applyJsonTransform, syncFields } from '../../common/utils/mongoose';
import type { IWaterEntry } from './types';

const waterSchema = new Schema<IWaterEntry>(
  {
    userId: { type: String, required: true },
    amountMl: { type: Number, required: true, min: 1, max: 5000 },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ },
    time: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    ...syncFields,
  },
  { timestamps: true, collection: 'water_entries' },
);

waterSchema.index({ userId: 1, date: 1 });
waterSchema.index({ userId: 1, createdAt: -1 });
addSyncIndexes(waterSchema);
applyJsonTransform(waterSchema);

export const WaterModel = model<IWaterEntry>('WaterEntry', waterSchema);
