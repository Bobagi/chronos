import type { AuthenticatedChronosUser } from '../types/chronos';

export interface ChronosAuthenticationDependencies {
	loginChronosUserAccount: (
		username: string,
		password: string
	) => Promise<{
		accessToken: string;
		user: AuthenticatedChronosUser;
	}>;
	fetchAuthenticatedChronosUserProfile: (token: string) => Promise<AuthenticatedChronosUser>;
	storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
}

export async function authenticateChronosUser(
	username: string,
	password: string,
	dependencies: ChronosAuthenticationDependencies
): Promise<{ token: string; user: AuthenticatedChronosUser }> {
	const trimmedUsername = username.trim();
	if (!trimmedUsername || !password) {
		throw new Error('Username and password are required to authenticate');
	}
	const authenticationResponse = await dependencies.loginChronosUserAccount(
		trimmedUsername,
		password
	);
	dependencies.storage?.setItem('token', authenticationResponse.accessToken);
	return {
		token: authenticationResponse.accessToken,
		user: authenticationResponse.user
	};
}

export async function restoreChronosAuthentication(
	dependencies: ChronosAuthenticationDependencies
): Promise<{ token: string | null; user: AuthenticatedChronosUser | null }> {
	const token = dependencies.storage?.getItem('token') ?? null;
	if (!token) {
		return { token: null, user: null };
	}
	try {
		const user = await dependencies.fetchAuthenticatedChronosUserProfile(token);
		return { token, user };
	} catch (error) {
		dependencies.storage?.removeItem('token');
		console.error('Failed to restore authentication state', error);
		return { token: null, user: null };
	}
}

export function clearChronosAuthenticationState(
	dependencies: ChronosAuthenticationDependencies
): void {
	dependencies.storage?.removeItem('token');
}
