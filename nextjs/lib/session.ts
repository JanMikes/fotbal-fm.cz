import { getIronSession, IronSession, SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import { SessionData } from '@/types/session';
import { config, constants, isProduction } from './config';

// Session configuration using validated environment variables
export const sessionOptions: SessionOptions = {
  password: config.SESSION_SECRET,
  cookieName: constants.SESSION_COOKIE_NAME,
  cookieOptions: {
    secure: isProduction(),
    httpOnly: true,
    sameSite: 'lax',
    maxAge: constants.SESSION_MAX_AGE,
  },
};

// Default session data
const defaultSession: SessionData = {
  userId: 0,
  email: '',
  jwt: '',
  isLoggedIn: false,
};

/**
 * Get the current session
 * Server-side only - uses Next.js cookies()
 */
export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, sessionOptions);

  // Initialize session if empty
  if (!session.isLoggedIn) {
    session.userId = defaultSession.userId;
    session.email = defaultSession.email;
    session.jwt = defaultSession.jwt;
    session.isLoggedIn = defaultSession.isLoggedIn;
  }

  return session;
}

/**
 * Create a new session with user data
 */
export async function createSession(userId: number, email: string, jwt: string): Promise<void> {
  const session = await getSession();

  session.userId = userId;
  session.email = email;
  session.jwt = jwt;
  session.isLoggedIn = true;

  await session.save();
}

/**
 * Destroy the current session
 */
export async function destroySession(): Promise<void> {
  const session = await getSession();
  session.destroy();
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session.isLoggedIn === true && !!session.jwt;
}

/**
 * Get user ID from session
 */
export async function getUserId(): Promise<number | null> {
  const session = await getSession();
  return session.isLoggedIn ? session.userId : null;
}

/**
 * Get JWT from session
 */
export async function getJWT(): Promise<string | null> {
  const session = await getSession();
  return session.isLoggedIn ? session.jwt : null;
}
