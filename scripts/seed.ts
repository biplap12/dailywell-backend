/**
 * Development seed data. Uses obviously fake people and *.example.com addresses only.
 * Usage: npm run seed            (adds/refreshes seed data)
 *        npm run seed -- --reset (wipes seeded users' data first)
 */
import argon2 from 'argon2';
import 'dotenv/config';
import mongoose from 'mongoose';
import { env } from '../src/config/env';
import { ActivityModel } from '../src/modules/activities/model';
import { CalendarModel } from '../src/modules/calendar/model';
import { HolidayModel, RemoteConfigModel } from '../src/modules/config/model';
import { HabitCompletionModel, HabitModel } from '../src/modules/habits/model';
import { NotificationModel } from '../src/modules/notifications/model';
import { ReminderModel } from '../src/modules/reminders/model';
import { RoutineModel } from '../src/modules/routines/model';
import { SleepModel } from '../src/modules/sleep/model';
import { StepModel } from '../src/modules/steps/model';
import { UserModel } from '../src/modules/users/model';
import { WaterModel } from '../src/modules/water/model';

const PASSWORD = 'Password123!'; // development only
const day = (offset: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - offset);
  return d.toISOString().slice(0, 10);
};

const USERS = [
  { name: 'Super Admin', email: 'superadmin@dailywell.example.com', phone: '9800000001', role: 'SUPER_ADMIN' as const },
  { name: 'Admin User', email: 'admin@dailywell.example.com', phone: '9800000002', role: 'ADMIN' as const },
  { name: 'Demo User', email: 'demo@dailywell.example.com', phone: '9800000003', role: 'USER' as const },
  { name: 'Second Demo', email: 'demo2@dailywell.example.com', phone: '9800000004', role: 'USER' as const },
];

async function main() {
  const reset = process.argv.includes('--reset');
  if (env.isProd) throw new Error('Refusing to seed a production database');
  await mongoose.connect(env.MONGODB_URI);
  await mongoose.syncIndexes();

  const passwordHash = await argon2.hash(PASSWORD, { type: argon2.argon2id });
  const ids: Record<string, string> = {};
  for (const u of USERS) {
    const doc = await UserModel.findOneAndUpdate(
      { email: u.email },
      { $set: { ...u, passwordHash, isActive: true, isSuspended: false } },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
    ids[u.email] = String(doc._id);
  }
  const demoId = ids['demo@dailywell.example.com'];
  const demo2Id = ids['demo2@dailywell.example.com'];

  if (reset) {
    const owners = [demoId, demo2Id];
    await Promise.all(
      [WaterModel, SleepModel, HabitModel, HabitCompletionModel, RoutineModel, ReminderModel, StepModel, ActivityModel, CalendarModel, NotificationModel].map((m) =>
        (m as mongoose.Model<any>).deleteMany({ userId: { $in: owners } }),
      ),
    );
  }

  // Water: 7 days, a few glasses a day
  for (let i = 0; i < 7; i++) {
    for (const [t, ml] of [['08:00', 250], ['11:30', 300], ['15:00', 500], ['19:00', 250]] as const) {
      await WaterModel.updateOne(
        { userId: demoId, deviceId: 'seed', localId: `water-${i}-${t}` },
        { $setOnInsert: { amountMl: ml, date: day(i), time: t, version: 1, deletedAt: null } },
        { upsert: true },
      );
    }
  }

  // Sleep: 7 nights
  for (let i = 0; i < 7; i++) {
    const end = new Date(`${day(i)}T06:30:00.000Z`);
    const minutes = 420 + ((i * 25) % 90);
    const start = new Date(end.getTime() - minutes * 60000);
    await SleepModel.updateOne(
      { userId: demoId, deviceId: 'seed', localId: `sleep-${i}` },
      { $setOnInsert: { date: day(i), startTime: start, endTime: end, durationMinutes: minutes, qualityScore: 3 + (i % 3), version: 1, deletedAt: null } },
      { upsert: true },
    );
  }

  // Habits + completions (gives visible streaks)
  const habitDefs = [
    { name: 'Morning meditation', description: '10 minutes of quiet', reminderTime: '06:30', colorHex: '#7E57C2', streak: 5 },
    { name: 'Read 20 pages', description: 'Any book', reminderTime: '21:00', colorHex: '#26A69A', streak: 3 },
    { name: 'Evening walk', description: '', reminderTime: '18:30', colorHex: '#FFA726', streak: 0 },
  ];
  for (const [order, h] of habitDefs.entries()) {
    const habit = await HabitModel.findOneAndUpdate(
      { userId: demoId, deviceId: 'seed', localId: `habit-${order}` },
      { $setOnInsert: { name: h.name, description: h.description, reminderTime: h.reminderTime, colorHex: h.colorHex, sortOrder: order, streakCount: h.streak, version: 1, deletedAt: null } },
      { upsert: true, new: true },
    );
    for (let i = 0; i < h.streak; i++) {
      await HabitCompletionModel.updateOne(
        { habitId: String(habit!._id), date: day(i) },
        { $setOnInsert: { userId: demoId, isCompleted: true, completedAt: new Date(), version: 1, deletedAt: null } },
        { upsert: true },
      );
    }
  }

  // Routines
  const routines: Array<[string, string, string]> = [
    ['Wake up & stretch', '06:00', 'MORNING'], ['Healthy breakfast', '07:00', 'HEALTH'], ['Deep work block', '09:00', 'WORK'],
    ['Study session', '16:00', 'STUDY'], ['Workout', '18:00', 'EXERCISE'], ['Wind down', '21:30', 'EVENING'], ['Lights out', '22:30', 'SLEEP'],
  ];
  for (const [i, [title, time, category]] of routines.entries()) {
    await RoutineModel.updateOne(
      { userId: demoId, deviceId: 'seed', localId: `routine-${i}` },
      { $setOnInsert: { title, time, category, sortOrder: i, isCompleted: false, version: 1, deletedAt: null } },
      { upsert: true },
    );
  }

  // Reminders
  const reminders = [
    { title: 'Drink water', description: 'Stay hydrated', time: '10:00', repeatType: 'DAILY', daysOfWeek: [] },
    { title: 'Weekly review', description: 'Plan the week', time: '19:00', repeatType: 'WEEKLY', daysOfWeek: [0] },
    { title: 'Stretch break', description: '', time: '15:30', repeatType: 'CUSTOM', daysOfWeek: [1, 2, 3, 4, 5] },
  ];
  for (const [i, r] of reminders.entries()) {
    await ReminderModel.updateOne(
      { userId: demoId, deviceId: 'seed', localId: `reminder-${i}` },
      { $setOnInsert: { ...r, isEnabled: true, version: 1, deletedAt: null } },
      { upsert: true },
    );
  }

  // Steps: 14 days
  for (let i = 0; i < 14; i++) {
    const steps = 4000 + ((i * 1373) % 7000);
    await StepModel.updateOne(
      { userId: demoId, date: day(i) },
      { $setOnInsert: { steps, goal: 8000, distanceMeters: Math.round(steps * 0.76), caloriesKcal: Math.round(steps * 0.04), activeMinutes: Math.round(steps / 110), deviceId: 'seed', version: 1, deletedAt: null } },
      { upsert: true },
    );
  }

  // Activities
  const activities: Array<[string, number, number, string]> = [['Running', 30, 1, '06:45'], ['Yoga', 45, 2, '07:00'], ['Cycling', 60, 4, '17:00']];
  for (const [i, [activityType, durationMinutes, ago, time]] of activities.entries()) {
    await ActivityModel.updateOne(
      { userId: demoId, deviceId: 'seed', localId: `activity-${i}` },
      { $setOnInsert: { activityType, durationMinutes, date: day(ago), time, notes: 'Seed data', version: 1, deletedAt: null } },
      { upsert: true },
    );
  }

  // Calendar events (Gregorian + Bikram Sambat)
  const events = [
    { title: 'Doctor check-up', dateGregorian: day(-3), dateNepali: '2083-06-21', time: '10:30', category: 'HEALTH', colorHex: '#EF5350' },
    { title: 'Family dinner', dateGregorian: day(-6), dateNepali: '2083-06-24', time: '19:00', category: 'PERSONAL', colorHex: '#42A5F5' },
  ];
  for (const [i, e] of events.entries()) {
    await CalendarModel.updateOne(
      { userId: demoId, deviceId: 'seed', localId: `event-${i}` },
      { $setOnInsert: { ...e, description: 'Seed data', version: 1, deletedAt: null } },
      { upsert: true },
    );
  }

  // Notifications (English + Nepali)
  if ((await NotificationModel.countDocuments({ userId: demoId })) === 0) {
    await NotificationModel.create([
      { userId: demoId, titleEn: 'Welcome to DailyWell', titleNe: 'डेलीवेलमा स्वागत छ', messageEn: 'Start by logging your first glass of water.', messageNe: 'आफ्नो पहिलो गिलास पानी लग गरेर सुरु गर्नुहोस्।', category: 'SYSTEM', priority: 'NORMAL' },
      { userId: demoId, titleEn: 'Hydration goal reached', titleNe: 'पानीको लक्ष्य पूरा भयो', messageEn: 'You hit your daily water goal. Great job!', messageNe: 'तपाईंले दैनिक पानीको लक्ष्य पूरा गर्नुभयो। राम्रो!', category: 'ACHIEVEMENT', priority: 'LOW', isRead: true },
      { userId: demoId, titleEn: 'Time to wind down', titleNe: 'आराम गर्ने समय भयो', messageEn: 'A consistent bedtime improves sleep quality.', messageNe: 'नियमित सुत्ने समयले निद्राको गुणस्तर सुधार्छ।', category: 'HEALTH', priority: 'HIGH', actionType: 'OPEN_SLEEP' },
    ]);
  }

  // A little data for the second user so IDOR behaviour is easy to try by hand
  await WaterModel.updateOne(
    { userId: demo2Id, deviceId: 'seed', localId: 'water-d2' },
    { $setOnInsert: { amountMl: 400, date: day(0), time: '09:00', version: 1, deletedAt: null } },
    { upsert: true },
  );

  // Public holidays (Gregorian + BS). Dates are illustrative sample data.
  const holidays = [
    { titleEn: 'Constitution Day', titleNe: 'संविधान दिवस', dateGregorian: '2026-09-19', dateNepali: '2083-06-03', type: 'PUBLIC', isNational: true, description: 'Anniversary of the promulgation of the constitution.' },
    { titleEn: 'Ghatasthapana', titleNe: 'घटस्थापना', dateGregorian: '2026-10-11', dateNepali: '2083-06-25', type: 'RELIGIOUS', isNational: true, description: 'First day of Dashain.' },
    { titleEn: 'Vijaya Dashami', titleNe: 'विजया दशमी', dateGregorian: '2026-10-20', dateNepali: '2083-07-03', type: 'RELIGIOUS', isNational: true, description: 'Main day of Dashain.' },
    { titleEn: 'Laxmi Puja', titleNe: 'लक्ष्मी पूजा', dateGregorian: '2026-11-08', dateNepali: '2083-07-22', type: 'RELIGIOUS', isNational: true, description: 'Festival of lights (Tihar).' },
    { titleEn: 'Nepali New Year', titleNe: 'नयाँ वर्ष', dateGregorian: '2027-04-14', dateNepali: '2084-01-01', type: 'PUBLIC', isNational: true, description: 'Start of the Bikram Sambat year.' },
  ];
  for (const h of holidays) {
    await HolidayModel.updateOne({ titleEn: h.titleEn, dateGregorian: h.dateGregorian }, { $set: h }, { upsert: true });
  }

  await RemoteConfigModel.updateOne({ key: 'app' }, { $setOnInsert: { key: 'app' } }, { upsert: true });

  // eslint-disable-next-line no-console
  console.log(`\nSeed complete. Password for every seeded account: ${PASSWORD}\n` + USERS.map((u) => `  ${u.role.padEnd(11)} ${u.email}`).join('\n') + '\n');
  await mongoose.disconnect();
}

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error('Seed failed:', err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
