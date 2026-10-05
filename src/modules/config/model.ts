import { Schema, model } from 'mongoose';
import { HOLIDAY_TYPES } from '../../common/constants';
import { applyJsonTransform } from '../../common/utils/mongoose';
import type { IHoliday, IRemoteConfig } from './types';

/** Collection: remote_configs. A single document keyed "app" holds the live values. */
const remoteConfigSchema = new Schema<IRemoteConfig>(
  {
    key: { type: String, required: true, unique: true, default: 'app' },
    maintenanceMode: { type: Boolean, default: false },
    registrationEnabled: { type: Boolean, default: true },
    guestAccessEnabled: { type: Boolean, default: true },
    notificationsEnabled: { type: Boolean, default: true },
    offlineModeEnabled: { type: Boolean, default: true },
    minimumAppVersion: { type: String, default: '1.0.0' },
    latestAppVersion: { type: String, default: '1.0.0' },
  },
  { timestamps: { createdAt: false, updatedAt: true }, collection: 'remote_configs' },
);
export const RemoteConfigModel = model<IRemoteConfig>('RemoteConfig', remoteConfigSchema);

const holidaySchema = new Schema<IHoliday>(
  {
    titleEn: { type: String, required: true, trim: true, maxlength: 200 },
    titleNe: { type: String, required: true, trim: true, maxlength: 200 },
    dateGregorian: { type: String, required: true },
    dateNepali: { type: String, required: true },
    type: { type: String, enum: HOLIDAY_TYPES, default: 'PUBLIC' },
    isNational: { type: Boolean, default: true },
    description: { type: String, default: '', maxlength: 1000 },
  },
  { timestamps: true, collection: 'holidays' },
);
holidaySchema.index({ dateGregorian: 1 });
holidaySchema.index({ dateNepali: 1 });
holidaySchema.index({ type: 1, dateGregorian: 1 });
applyJsonTransform(holidaySchema);
export const HolidayModel = model<IHoliday>('Holiday', holidaySchema);
