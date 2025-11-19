export interface SessionData {
  userId: number;
  email: string;
  jwt: string;
  isLoggedIn: boolean;
}

export interface IronSessionOptions {
  password: string;
  cookieName: string;
  cookieOptions: {
    secure: boolean;
    httpOnly: boolean;
    sameSite: 'lax' | 'strict' | 'none';
    maxAge: number;
  };
}
