export interface User {
  id: number;
  email: string;
  username: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  confirmed: boolean;
  blocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  jobTitle: string;
}
