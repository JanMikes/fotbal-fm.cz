/**
 * User repository.
 * Handles user authentication and profile operations.
 */

import { User } from '@/types/user';
import { StrapiClient, mapUser } from '@/lib/infrastructure/strapi';
import { AuthError, ErrorCode } from '@/lib/core/errors';

export interface LoginResult {
  user: User;
  jwt: string;
}

export interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
}

export interface UpdateProfileData {
  firstName?: string;
  lastName?: string;
  jobTitle?: string;
}

export class UserRepository {
  constructor(private readonly client: StrapiClient) {}

  /**
   * Login user with email and password
   */
  async login(email: string, password: string): Promise<LoginResult> {
    const result = await this.client.login(email, password);
    return {
      user: mapUser(result.user),
      jwt: result.jwt,
    };
  }

  /**
   * Register a new user
   * Two-step process:
   * 1. Register with basic fields (username, email, password)
   * 2. Update profile with custom fields (firstname, lastname, jobTitle)
   */
  async register(data: RegisterData): Promise<LoginResult> {
    // Step 1: Register with basic fields
    const registerResult = await this.client.register(
      data.email, // username = email
      data.email,
      data.password
    );

    // Step 2: Update profile with custom fields
    const userClient = this.client.withUserAuth(registerResult.jwt);
    const userId = (registerResult.user as { id: number }).id;

    await userClient.updateUser(userId, {
      firstname: data.firstName,
      lastname: data.lastName,
      jobTitle: data.jobTitle,
    });

    // Fetch updated user
    const updatedUser = await userClient.getMe();

    return {
      user: mapUser(updatedUser),
      jwt: registerResult.jwt,
    };
  }

  /**
   * Get current user data using JWT
   */
  async getMe(): Promise<User> {
    const rawUser = await this.client.getMe();
    return mapUser(rawUser);
  }

  /**
   * Update user profile
   */
  async updateProfile(userId: number, data: UpdateProfileData): Promise<User> {
    const updateData: Record<string, unknown> = {};

    if (data.firstName !== undefined) {
      updateData.firstname = data.firstName;
    }
    if (data.lastName !== undefined) {
      updateData.lastname = data.lastName;
    }
    if (data.jobTitle !== undefined) {
      updateData.jobTitle = data.jobTitle;
    }

    const rawUser = await this.client.updateUser(userId, updateData);
    return mapUser(rawUser);
  }

  /**
   * Change user password
   */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.client.changePassword(currentPassword, newPassword);
  }
}
