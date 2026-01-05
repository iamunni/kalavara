import { getServerSession } from 'next-auth';
import { authOptions } from './options';
import { db, users, initializeDatabase } from '@/lib/db';
import { eq } from 'drizzle-orm';

let dbInitialized = false;
async function ensureDbInitialized() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
}

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return null;
  }

  await ensureDbInitialized();

  const user = await db.query.users.findFirst({
    where: eq(users.email, session.user.email),
  });

  return user;
}

export async function requireUser() {
  const user = await getCurrentUser();

  if (!user) {
    throw new Error('Unauthorized');
  }

  return user;
}
