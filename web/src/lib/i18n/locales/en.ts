// English — the canonical dictionary; its shape is the source of truth for the
// other locales (see src/lib/i18n/index.ts).
const en = {
	language: {
		change: 'Change language'
	},
	nav: {
		logout: 'Log out'
	},
	footer: {
		tagline: 'Strategic mythology card battles in your browser.',
		community: 'Community',
		privacy: 'Privacy',
		terms: 'Terms',
		rights: '© {year} Chronos'
	},
	home: {
		kicker: 'Digital Collectible Card Duel',
		tagline:
			'Command the Dracomania collection and duel by fire, magic and might. Each round both duelists reveal a card and clash on one attribute — capture more cards than your rival to claim the match.',
		serverLabel: 'Server',
		auth: {
			title: 'Enter the arena',
			subtitle: 'Log in to play, or browse the collection first.',
			username: 'Username',
			usernamePlaceholder: 'Your nickname',
			password: 'Password',
			login: 'Log in',
			or: 'or',
			browseGallery: 'Browse the gallery',
			createAccount: 'Create an account',
			invalidCredentials: 'Invalid username or password.'
		},
		dashboard: {
			adminBadge: 'Admin',
			gallery: 'Gallery',
			friends: 'Friends',
			expireOld: 'Expire old',
			readyTitle: 'Ready to duel?',
			readySub: 'Start an Attribute Duel against the bot and grow your collection of victories.',
			startDuel: 'Start Duel',
			yourGames: 'Your active games',
			noGames: 'No active games yet — start a duel above.',
			mode: 'Mode',
			updated: 'Updated',
			resume: 'Resume',
			openGame: 'Open game',
			finishGame: 'Finish the game',
			allGames: 'All active games (admin)',
			noServerGames: 'No active games on the server.',
			players: 'Players',
			open: 'Open',
			stats: {
				wins: 'Wins',
				played: 'Games played',
				draws: 'Draws',
				active: 'Active games',
				rank: 'Rank',
				lastActivity: 'Last activity'
			}
		}
	},
	gallery: {
		home: 'Home',
		title: 'Collections',
		subtitle: 'Click a card to enlarge it.',
		loading: 'Loading cards…',
		error: 'Error: {message}',
		noCollections: 'No collections found.',
		noCards: 'No cards found in this collection.',
		cardCount: '{count} cards',
		close: 'Close',
		card: 'Card',
		stats: {
			magic: 'Magic',
			might: 'Might',
			fire: 'Fire'
		}
	},
	register: {
		title: 'Create your account',
		subtitle: 'It’s quick and free.',
		username: 'Username',
		usernamePlaceholder: 'Nickname',
		password: 'Password',
		confirmPassword: 'Confirm password',
		submit: 'Create account',
		back: 'Back',
		errors: {
			usernameRequired: 'Username is required.',
			passwordRequired: 'Password is required.',
			passwordMismatch: 'Passwords do not match.',
			generic: 'Could not create account.'
		}
	},
	auth: {
		googleContinue: 'Continue with Google',
		googleComingSoon: 'Google sign-in is coming soon.'
	}
};

export default en;
