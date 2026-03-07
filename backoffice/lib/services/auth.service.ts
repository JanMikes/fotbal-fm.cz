/**
 * Auth Service.
 * Handles authentication business logic including login, registration, and user management.
 */

import * as Sentry from '@sentry/nextjs';
import { User } from '@/types/user';
import { Result, ok, err } from '@/lib/core/result';
import { AppError, AuthError, ValidationError, ErrorCode } from '@/lib/core/errors';
import { getStrapiClient, getUserStrapiClient } from '@/lib/infrastructure/strapi';
import { mapUser } from '@/lib/infrastructure/strapi/mappers';
import { notifyUserRegistered } from '@/lib/notifications';

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Registration data
 */
export interface RegistrationData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
}

/**
 * Profile update data
 */
export interface ProfileUpdateData {
  firstName: string;
  lastName: string;
  jobTitle: string;
}

/**
 * Authentication result with user and JWT
 */
export interface AuthResult {
  user: User;
  jwt: string;
}

/**
 * Strapi auth response structure
 */
interface StrapiAuthResponse {
  jwt: string;
  user: {
    id: number;
    username: string;
    email: string;
    firstname?: string;
    lastname?: string;
    jobTitle?: string;
    confirmed?: boolean;
    blocked?: boolean;
    createdAt: string;
    updatedAt: string;
  };
}

/**
 * Strapi user response structure
 */
interface StrapiUserResponse {
  id: number;
  username: string;
  email: string;
  firstname?: string;
  lastname?: string;
  jobTitle?: string;
  confirmed?: boolean;
  blocked?: boolean;
  createdAt: string;
  updatedAt: string;
}

export class AuthService {
  private readonly strapiUrl: string;

  constructor() {
    this.strapiUrl = process.env.STRAPI_URL || 'http://strapi:1337';
  }

  /**
   * Login user with email and password
   */
  async login(credentials: LoginCredentials): Promise<Result<AuthResult, AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'User login attempt',
        level: 'info',
        data: { email: credentials.email },
      });

      const response = await fetch(`${this.strapiUrl}/api/auth/local`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          identifier: credentials.email,
          password: credentials.password,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        return this.handleAuthError(error, response.status);
      }

      const data: StrapiAuthResponse = await response.json();

      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'User login successful',
        level: 'info',
        data: { userId: data.user.id },
      });

      return ok({
        user: this.mapStrapiUser(data.user),
        jwt: data.jwt,
      });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'AuthService', method: 'login' },
        extra: { email: credentials.email },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při přihlašování',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Register new user
   * Two-step process:
   * 1. Register with basic fields (username, email, password)
   * 2. Update profile with custom fields (firstname, lastname, jobTitle)
   */
  async register(data: RegistrationData): Promise<Result<AuthResult, AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'User registration attempt',
        level: 'info',
        data: { email: data.email },
      });

      // Step 1: Register with basic fields
      const registerResponse = await fetch(`${this.strapiUrl}/api/auth/local/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: data.email,
          email: data.email,
          password: data.password,
        }),
      });

      if (!registerResponse.ok) {
        const error = await registerResponse.json().catch(() => ({}));
        return this.handleAuthError(error, registerResponse.status);
      }

      const registerData: StrapiAuthResponse = await registerResponse.json();

      // Step 2: Update profile with custom fields
      const updateResponse = await fetch(`${this.strapiUrl}/api/users/${registerData.user.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${registerData.jwt}`,
        },
        body: JSON.stringify({
          firstname: data.firstName,
          lastname: data.lastName,
          jobTitle: data.jobTitle,
        }),
      });

      if (!updateResponse.ok) {
        const error = await updateResponse.json().catch(() => ({}));
        // Log but don't fail - user was created
        Sentry.captureMessage('Failed to update user profile after registration', {
          level: 'warning',
          extra: { userId: registerData.user.id, error },
        });
      }

      const updatedUser: StrapiUserResponse = updateResponse.ok
        ? await updateResponse.json()
        : registerData.user;

      const user = this.mapStrapiUser(updatedUser);

      // Send notification about new registration
      notifyUserRegistered(user);

      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'User registration successful',
        level: 'info',
        data: { userId: user.id },
      });

      return ok({
        user,
        jwt: registerData.jwt,
      });
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'AuthService', method: 'register' },
        extra: { email: data.email },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při registraci',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Get current user data from JWT
   */
  async getCurrentUser(jwt: string): Promise<Result<User, AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'Getting current user',
        level: 'info',
      });

      const response = await fetch(`${this.strapiUrl}/api/users/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          return err(new AuthError('Vaše přihlášení vypršelo'));
        }
        const error = await response.json().catch(() => ({}));
        return this.handleAuthError(error, response.status);
      }

      const data: StrapiUserResponse = await response.json();
      return ok(this.mapStrapiUser(data));
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'AuthService', method: 'getCurrentUser' },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při načítání uživatelských dat',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Change user password
   */
  async changePassword(
    jwt: string,
    currentPassword: string,
    newPassword: string
  ): Promise<Result<void, AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'Changing user password',
        level: 'info',
      });

      const response = await fetch(`${this.strapiUrl}/api/auth/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          currentPassword,
          password: newPassword,
          passwordConfirmation: newPassword,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        const message = this.extractErrorMessage(error);

        if (message.includes('password is invalid') || message.includes('Wrong password')) {
          return err(new AuthError('Nesprávné současné heslo'));
        }

        return this.handleAuthError(error, response.status);
      }

      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'Password change successful',
        level: 'info',
      });

      return ok(undefined);
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'AuthService', method: 'changePassword' },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při změně hesla',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Update user profile
   */
  async updateProfile(
    jwt: string,
    userId: number,
    data: ProfileUpdateData
  ): Promise<Result<User, AppError>> {
    try {
      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'Updating user profile',
        level: 'info',
        data: { userId },
      });

      const response = await fetch(`${this.strapiUrl}/api/users/${userId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${jwt}`,
        },
        body: JSON.stringify({
          firstname: data.firstName,
          lastname: data.lastName,
          jobTitle: data.jobTitle,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          return err(new AuthError('Vaše přihlášení vypršelo'));
        }
        if (response.status === 403) {
          return err(new AuthError('Nemáte oprávnění upravovat tento profil'));
        }
        const error = await response.json().catch(() => ({}));
        return this.handleAuthError(error, response.status);
      }

      const updatedUser: StrapiUserResponse = await response.json();

      Sentry.addBreadcrumb({
        category: 'auth',
        message: 'Profile update successful',
        level: 'info',
        data: { userId },
      });

      return ok(this.mapStrapiUser(updatedUser));
    } catch (error) {
      Sentry.captureException(error, {
        tags: { service: 'AuthService', method: 'updateProfile' },
        extra: { userId },
      });

      if (error instanceof AppError) {
        return err(error);
      }
      return err(new AppError(
        'Chyba při aktualizaci profilu',
        ErrorCode.STRAPI_ERROR
      ));
    }
  }

  /**
   * Map Strapi user to domain User
   */
  private mapStrapiUser(data: StrapiUserResponse | StrapiAuthResponse['user']): User {
    return {
      id: data.id,
      email: data.email,
      username: data.username,
      firstName: data.firstname || '',
      lastName: data.lastname || '',
      jobTitle: data.jobTitle || '',
      confirmed: data.confirmed ?? true,
      blocked: data.blocked ?? false,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  }

  /**
   * Handle Strapi auth errors and return appropriate AppError
   */
  private handleAuthError(error: unknown, statusCode: number): Result<never, AppError> {
    // Extract error message from Strapi error structure
    const message = this.extractErrorMessage(error);

    // Map common auth errors to user-friendly messages
    if (message.includes('Invalid identifier or password')) {
      return err(new AuthError('Nesprávný email nebo heslo'));
    }
    if (message.includes('Email is already taken') || message.includes('already registered')) {
      return err(new ValidationError('Tento email je již zaregistrován'));
    }
    if (message.includes('blocked')) {
      return err(new AuthError('Váš účet byl zablokován'));
    }

    // Generic error based on status code
    if (statusCode === 400) {
      return err(new ValidationError(message || 'Neplatné údaje'));
    }
    if (statusCode === 401) {
      return err(new AuthError('Nesprávné přihlašovací údaje'));
    }
    if (statusCode === 403) {
      return err(new AuthError('Přístup zamítnut'));
    }

    return err(new AppError(message || 'Chyba autentizace', ErrorCode.STRAPI_ERROR));
  }

  /**
   * Extract error message from Strapi error response
   */
  private extractErrorMessage(error: unknown): string {
    if (!error || typeof error !== 'object') {
      return '';
    }

    const errorObj = error as Record<string, unknown>;

    // Strapi v5 error structure: { error: { message: string } }
    if (errorObj.error && typeof errorObj.error === 'object') {
      const innerError = errorObj.error as Record<string, unknown>;
      if (typeof innerError.message === 'string') {
        return innerError.message;
      }
    }

    // Strapi v4 error structure: { message: string }
    if (typeof errorObj.message === 'string') {
      return errorObj.message;
    }

    // Array of messages
    if (Array.isArray(errorObj.message)) {
      const firstMessage = errorObj.message[0];
      if (typeof firstMessage === 'string') {
        return firstMessage;
      }
      if (typeof firstMessage?.messages?.[0]?.message === 'string') {
        return firstMessage.messages[0].message;
      }
    }

    return '';
  }
}

// Singleton instance
let authServiceInstance: AuthService | null = null;

/**
 * Get the auth service singleton
 */
export function getAuthService(): AuthService {
  if (!authServiceInstance) {
    authServiceInstance = new AuthService();
  }
  return authServiceInstance;
}
