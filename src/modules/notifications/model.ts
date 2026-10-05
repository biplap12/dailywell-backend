import { Schema, model } from 'mongoose';
import { NOTIFICATION_CATEGORIES, NOTIFICATION_PRIORITIES } from '../../common/constants';
import { applyJsonTransform } from '../../common/utils/mongoose';
import type { INotification } from './types';

const notificationSchema = new Schema<INotification>(
  {
    userId: { type: String, required: true },
    titleEn: { type: String, required: true, trim: true, maxlength: 200 },
    titleNe: { type: String, required: true, trim: true, maxlength: 200 },
    messageEn: { type: String, required: true, trim: true, maxlength: 2000 },
    messageNe: { type: String, required: true, trim: true, maxlength: 2000 },
    category: { type: String, enum: NOTIFICATION_CATEGORIES, default: 'SYSTEM' },
    priority: { type: String, enum: NOTIFICATION_PRIORITIES, default: 'NORMAL' },
    actionType: { type: String, default: null, maxlength: 60 },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
  },
  { timestamps: true, collection: 'notifications' },
);
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ userId: 1, createdAt: -1 });
applyJsonTransform(notificationSchema);

export const NotificationModel = model<INotification>('Notification', notificationSchema);
