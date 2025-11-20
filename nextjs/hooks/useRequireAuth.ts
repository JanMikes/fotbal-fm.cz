import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@/contexts/UserContext';

interface UseRequireAuthOptions {
  /** Path to redirect to if user is not authenticated */
  redirectTo?: string;
  /** If true, redirects authenticated users away (for login/register pages) */
  redirectIfAuthenticated?: boolean;
  /** Path to redirect authenticated users to */
  authenticatedRedirectTo?: string;
}

/**
 * Custom hook that handles authentication redirects
 * Redirects unauthenticated users to login page (or custom path)
 * Optionally redirects authenticated users away (useful for login/register pages)
 *
 * @param options - Configuration options for auth behavior
 * @returns User context with user data and loading state
 *
 * @example
 * // Protect a page - redirect to login if not authenticated
 * const { user, loading } = useRequireAuth();
 *
 * @example
 * // Login page - redirect to dashboard if already authenticated
 * const { user, loading } = useRequireAuth({
 *   redirectIfAuthenticated: true,
 *   authenticatedRedirectTo: '/dashboard'
 * });
 */
export function useRequireAuth(options: UseRequireAuthOptions = {}) {
  const {
    redirectTo = '/prihlaseni',
    redirectIfAuthenticated = false,
    authenticatedRedirectTo = '/dashboard',
  } = options;

  const { user, loading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    if (redirectIfAuthenticated && user) {
      // Redirect authenticated users away (for login/register pages)
      router.replace(authenticatedRedirectTo);
    } else if (!redirectIfAuthenticated && !user) {
      // Redirect unauthenticated users to login
      router.push(redirectTo);
    }
  }, [user, loading, router, redirectTo, redirectIfAuthenticated, authenticatedRedirectTo]);

  return { user, loading };
}
