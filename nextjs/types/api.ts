import { User } from './user';

// Strapi API responses
export interface StrapiLoginResponse {
  jwt: string;
  user: StrapiUser;
}

export interface StrapiRegisterResponse {
  jwt: string;
  user: StrapiUser;
}

export interface StrapiUser {
  id: number;
  username: string;
  email: string;
  provider: string;
  confirmed: boolean;
  blocked: boolean;
  createdAt: string;
  updatedAt: string;
  firstname: string;
  lastname: string;
  jobTitle: string;
}

export interface StrapiError {
  error: {
    status: number;
    name: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// Next.js API request types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
}

export interface UpdateProfileRequest {
  firstName: string;
  lastName: string;
  jobTitle: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// Next.js API response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface AuthResponse {
  success: boolean;
  user?: User;
  error?: string;
}
