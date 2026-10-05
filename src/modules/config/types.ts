export interface IRemoteConfig {
  key: string;
  maintenanceMode: boolean;
  registrationEnabled: boolean;
  guestAccessEnabled: boolean;
  notificationsEnabled: boolean;
  offlineModeEnabled: boolean;
  minimumAppVersion: string;
  latestAppVersion: string;
  updatedAt: Date;
}

export type PublicRemoteConfig = Omit<IRemoteConfig, 'key' | 'updatedAt'>;

export interface IHoliday {
  titleEn: string;
  titleNe: string;
  dateGregorian: string;
  dateNepali: string;
  type: string;
  isNational: boolean;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}
