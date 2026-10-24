export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'candidate' | 'teacher';
  avatar?: string;
  joinedDate: string;
}

const AUTH_USER_KEY = 'interviewready-auth-user';

export function getStoredUser(): UserProfile | null {
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return {
    id: 'user-default',
    name: 'Megha V',
    email: 'meghavmeti123@gmail.com',
    role: 'candidate',
    joinedDate: 'Joined Oct 2026',
  };
}

export function saveStoredUser(user: UserProfile | null): void {
  try {
    if (user) {
      localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(AUTH_USER_KEY);
    }
  } catch {
    // ignore
  }
}
