import { MongoMemoryServer } from 'mongodb-memory-server';

let mongod: MongoMemoryServer | undefined;

/**
 * Starts one in-memory MongoDB for the whole run; each test file uses its own database on it.
 * Set TEST_MONGO_URI to use an existing MongoDB instead (e.g. a CI service container).
 */
export async function setup(): Promise<void> {
  if (process.env.TEST_MONGO_URI) return;
  try {
    mongod = await MongoMemoryServer.create();
    process.env.TEST_MONGO_URI = mongod.getUri();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn(
      '\n[tests] Could not start an in-memory MongoDB (offline or blocked download?).\n' +
        '        Database-backed suites will fail. Set TEST_MONGO_URI=mongodb://localhost:27017 to use a local MongoDB,\n' +
        '        or run `npm run test:unit` for the database-free tests.\n' +
        `        Reason: ${(err as Error).message.split('\n')[0]}\n`,
    );
  }
}

export async function teardown(): Promise<void> {
  await mongod?.stop();
}
