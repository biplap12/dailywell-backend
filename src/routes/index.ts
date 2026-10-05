import { Router } from 'express';
import activitiesRoutes from '../modules/activities/routes';
import adminRoutes from '../modules/admin/routes';
import authRoutes from '../modules/auth/routes';
import calendarRoutes from '../modules/calendar/routes';
import configRoutes from '../modules/config/routes';
import habitsRoutes from '../modules/habits/routes';
import notificationsRoutes from '../modules/notifications/routes';
import remindersRoutes from '../modules/reminders/routes';
import routinesRoutes from '../modules/routines/routes';
import sleepRoutes from '../modules/sleep/routes';
import stepsRoutes from '../modules/steps/routes';
import syncRoutes from '../modules/sync/routes';
import usersRoutes from '../modules/users/routes';
import waterRoutes from '../modules/water/routes';

/**
 * Version 1 of the API. A future /api/v2 router can be mounted next to this one
 * in app.ts without touching any of these modules.
 */
export function createV1Router(): Router {
  const v1 = Router();
  v1.use('/auth', authRoutes);
  v1.use('/users', usersRoutes);
  v1.use('/water', waterRoutes);
  v1.use('/sleep', sleepRoutes);
  v1.use('/habits', habitsRoutes);
  v1.use('/routines', routinesRoutes);
  v1.use('/reminders', remindersRoutes);
  v1.use('/steps', stepsRoutes);
  v1.use('/activities', activitiesRoutes);
  v1.use('/calendar', calendarRoutes);
  v1.use('/notifications', notificationsRoutes);
  v1.use('/config', configRoutes);
  v1.use('/sync', syncRoutes);
  v1.use('/admin', adminRoutes);
  return v1;
}
