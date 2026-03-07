'use client';

/**
 * React hooks for authentication API operations.
 */

import { useCallback } from 'react';
import { useMutation } from './useMutation';
import { User } from '@/types/user';
import {
  LoginFormData,
  RegisterFormData,
  UpdateProfileFormData,
  ChangePasswordFormData,
} from '@/lib/validation';

/**
 * Response data from login
 */
interface LoginResponse {
  user: User;
}

/**
 * Response data from register
 */
interface RegisterResponse {
  user: User;
}

/**
 * Response data from profile update
 */
interface ProfileUpdateResponse {
  user: User;
}

/**
 * Hook for user login
 */
export function useLogin(options?: {
  onSuccess?: (data: LoginResponse) => void;
  onError?: (error: string) => void;
}) {
  return useMutation<LoginResponse, LoginFormData>({
    endpoint: '/api/auth/login',
    method: 'POST',
    transformVariables: (data) => JSON.stringify(data),
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });
}

/**
 * Hook for user registration
 */
export function useRegister(options?: {
  onSuccess?: (data: RegisterResponse) => void;
  onError?: (error: string) => void;
}) {
  return useMutation<RegisterResponse, RegisterFormData>({
    endpoint: '/api/auth/register',
    method: 'POST',
    transformVariables: (data) => JSON.stringify(data),
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });
}

/**
 * Hook for updating user profile
 */
export function useUpdateProfile(options?: {
  onSuccess?: (data: ProfileUpdateResponse) => void;
  onError?: (error: string) => void;
}) {
  return useMutation<ProfileUpdateResponse, UpdateProfileFormData>({
    endpoint: '/api/auth/update-profile',
    method: 'PUT',
    transformVariables: (data) => JSON.stringify(data),
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });
}

/**
 * Hook for changing password
 */
export function useChangePassword(options?: {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}) {
  return useMutation<void, ChangePasswordFormData>({
    endpoint: '/api/auth/change-password',
    method: 'POST',
    transformVariables: (data) => JSON.stringify(data),
    onSuccess: options?.onSuccess,
    onError: options?.onError,
  });
}

/**
 * Hook for logout
 */
export function useLogout(options?: {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}) {
  const logout = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      const result = await response.json();

      if (!result.success) {
        const error = result.error || 'Nepodařilo se odhlásit';
        options?.onError?.(error);
        return { success: false, error };
      }

      options?.onSuccess?.();
      return { success: true };
    } catch {
      const error = 'Nepodařilo se odhlásit';
      options?.onError?.(error);
      return { success: false, error };
    }
  }, [options]);

  return { logout };
}
