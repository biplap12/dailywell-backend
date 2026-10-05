export interface ICalendarEvent {
  userId: string;
  localId: string | null;
  clientId: string | null;
  title: string;
  description: string;
  dateGregorian: string;
  dateNepali: string | null;
  time: string | null;
  category: string;
  colorHex: string;
  deviceId: string | null;
  version: number;
  deletedAt: Date | null;
  syncStatus: 'SYNCED' | 'PENDING' | 'CONFLICT';
  createdAt: Date;
  updatedAt: Date;
}
