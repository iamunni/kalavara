import { google } from 'googleapis';
import { db, users, accounts } from '@/lib/db';
import { eq } from 'drizzle-orm';

export async function getGmailClient(userId: string) {
  // Get user and account info
  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
  });

  if (!user) {
    throw new Error('User not found');
  }

  const account = await db.query.accounts.findFirst({
    where: eq(accounts.userId, userId),
  });

  if (!account?.access_token) {
    throw new Error('No access token found. Please sign in again.');
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
  );

  oauth2Client.setCredentials({
    access_token: account.access_token,
    refresh_token: account.refresh_token,
  });

  // Handle token refresh
  oauth2Client.on('tokens', async (tokens) => {
    if (tokens.access_token) {
      await db
        .update(accounts)
        .set({
          access_token: tokens.access_token,
          expires_at: tokens.expiry_date ? Math.floor(tokens.expiry_date / 1000) : null,
        })
        .where(eq(accounts.userId, userId));

      await db
        .update(users)
        .set({
          googleAccessToken: tokens.access_token,
        })
        .where(eq(users.id, userId));
    }

    if (tokens.refresh_token) {
      await db
        .update(accounts)
        .set({
          refresh_token: tokens.refresh_token,
        })
        .where(eq(accounts.userId, userId));

      await db
        .update(users)
        .set({
          googleRefreshToken: tokens.refresh_token,
        })
        .where(eq(users.id, userId));
    }
  });

  return google.gmail({ version: 'v1', auth: oauth2Client });
}
