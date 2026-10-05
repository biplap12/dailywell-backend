export interface INotification {
  userId: string;
  titleEn: string;
  titleNe: string;
  messageEn: string;
  messageNe: string;
  category: string;
  priority: string;
  actionType: string | null;
  isRead: boolean;
  readAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateNotificationInput {
  userId: string;
  titleEn: string;
  titleNe: string;
  messageEn: string;
  messageNe: string;
  category?: string;
  priority?: string;
  actionType?: string | null;
}
