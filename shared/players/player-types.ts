export type ChronosUserRole = 'USER' | 'ADMIN';

export interface AuthenticatedChronosUser {
  id: string;
  username: string;
  role: ChronosUserRole;
}
