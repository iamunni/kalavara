import { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { db, users, accounts, initializeDatabase } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

// Initialize database on module load
let dbInitialized = false;
async function ensureDbInitialized() {
  if (!dbInitialized) {
    await initializeDatabase();
    dbInitialized = true;
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'openid email profile https://www.googleapis.com/auth/gmail.readonly',
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!account || !user.email) return false;

      try {
        await ensureDbInitialized();
        // Check if user exists
        const existingUser = await db.query.users.findFirst({
          where: eq(users.email, user.email),
        });

        const userId = existingUser?.id || uuidv4();
        const now = new Date();

        if (!existingUser) {
          // Create new user
          await db.insert(users).values({
            id: userId,
            email: user.email,
            name: user.name || null,
            image: user.image || null,
            googleAccessToken: account.access_token || null,
            googleRefreshToken: account.refresh_token || null,
            createdAt: now,
          });
        } else {
          // Update tokens
          await db
            .update(users)
            .set({
              googleAccessToken: account.access_token || existingUser.googleAccessToken,
              googleRefreshToken: account.refresh_token || existingUser.googleRefreshToken,
              name: user.name || existingUser.name,
              image: user.image || existingUser.image,
            })
            .where(eq(users.id, existingUser.id));
        }

        // Store account info
        const existingAccount = await db.query.accounts.findFirst({
          where: eq(accounts.providerAccountId, account.providerAccountId),
        });

        if (!existingAccount) {
          await db.insert(accounts).values({
            id: uuidv4(),
            userId,
            type: account.type,
            provider: account.provider,
            providerAccountId: account.providerAccountId,
            refresh_token: account.refresh_token,
            access_token: account.access_token,
            expires_at: account.expires_at,
            token_type: account.token_type,
            scope: account.scope,
            id_token: account.id_token,
          });
        } else {
          await db
            .update(accounts)
            .set({
              refresh_token: account.refresh_token || existingAccount.refresh_token,
              access_token: account.access_token,
              expires_at: account.expires_at,
            })
            .where(eq(accounts.id, existingAccount.id));
        }

        return true;
      } catch (error) {
        console.error('Error in signIn callback:', error);
        return false;
      }
    },
    async jwt({ token, account, user }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
      }
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        await ensureDbInitialized();
        // Get user from database to get the actual user ID
        const dbUser = await db.query.users.findFirst({
          where: eq(users.email, session.user.email!),
        });

        if (dbUser) {
          session.user.id = dbUser.id;
          session.accessToken = token.accessToken as string;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
  },
  secret: process.env.NEXTAUTH_SECRET,
};

// Extend next-auth types
declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
    };
    accessToken?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    userId?: string;
  }
}
