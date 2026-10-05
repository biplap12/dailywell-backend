import { Schema, model } from 'mongoose';
import { ROUTINE_CATEGORIES } from '../../common/constants';
import { addSyncIndexes } from '../../common/utils/ownedCrud';
import { applyJsonTransform, syncFields } from '../../common/utils/mongoose';
import type { IRoutineItem } from './types';

const routineSchema = new Schema<IRoutineItem>(
  {
    userId: { type: String, required: true },
    title: { type: String, required: true, trim: true, minlength: 1, maxlength: 150 },
    time: { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ },
    sortOrder: { type: Number, default: 0 },
    category: { type: String, enum: ROUTINE_CATEGORIES, default: 'CUSTOM' },
    isCompleted: { type: Boolean, default: false },
    ...syncFields,
  },
  { timestamps: true, collection: 'routine_items' },
);
routineSchema.index({ userId: 1, sortOrder: 1 });
addSyncIndexes(routineSchema);
applyJsonTransform(routineSchema);

export const RoutineModel = model<IRoutineItem>('RoutineItem', routineSchema);
