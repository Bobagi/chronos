// Español
import type en from './en';

const es: typeof en = {
	language: {
		change: 'Cambiar idioma'
	},
	nav: {
		logout: 'Cerrar sesión'
	},
	footer: {
		tagline: 'Batallas estratégicas de cartas mitológicas en tu navegador.',
		community: 'Comunidad',
		privacy: 'Privacidad',
		terms: 'Términos',
		rights: '© {year} Chronos'
	},
	home: {
		kicker: 'Duelo de Cartas Coleccionables',
		tagline:
			'Comanda la colección Dracomania y duela por fuego, magia y fuerza. En cada ronda ambos duelistas revelan una carta y se enfrentan en un atributo: captura más cartas que tu rival para ganar la partida.',
		serverLabel: 'Servidor',
		auth: {
			title: 'Entra en la arena',
			subtitle: 'Inicia sesión para jugar, o explora la colección primero.',
			username: 'Usuario',
			usernamePlaceholder: 'Tu apodo',
			password: 'Contraseña',
			login: 'Iniciar sesión',
			or: 'o',
			browseGallery: 'Explorar la galería',
			createAccount: 'Crear una cuenta',
			invalidCredentials: 'Usuario o contraseña inválidos.'
		},
		dashboard: {
			adminBadge: 'Admin',
			gallery: 'Galería',
			friends: 'Amigos',
			expireOld: 'Expirar antiguos',
			readyTitle: '¿Listo para duelar?',
			readySub: 'Inicia un Duelo de Atributos contra el bot y aumenta tu colección de victorias.',
			startDuel: 'Iniciar Duelo',
			yourGames: 'Tus partidas activas',
			noGames: 'Aún no hay partidas activas: inicia un duelo arriba.',
			mode: 'Modo',
			updated: 'Actualizado',
			resume: 'Reanudar',
			openGame: 'Abrir partida',
			finishGame: 'Finalizar la partida',
			allGames: 'Todas las partidas activas (admin)',
			noServerGames: 'No hay partidas activas en el servidor.',
			players: 'Jugadores',
			open: 'Abrir',
			stats: {
				wins: 'Victorias',
				played: 'Partidas jugadas',
				draws: 'Empates',
				active: 'Partidas activas',
				rank: 'Rango',
				lastActivity: 'Última actividad'
			}
		}
	},
	gallery: {
		home: 'Inicio',
		title: 'Colecciones',
		subtitle: 'Haz clic en una carta para ampliarla.',
		loading: 'Cargando cartas…',
		error: 'Error: {message}',
		noCollections: 'No se encontraron colecciones.',
		noCards: 'No se encontraron cartas en esta colección.',
		cardCount: '{count} cartas',
		close: 'Cerrar',
		card: 'Carta',
		stats: {
			magic: 'Magia',
			might: 'Fuerza',
			fire: 'Fuego'
		}
	},
	register: {
		title: 'Crea tu cuenta',
		subtitle: 'Es rápido y gratis.',
		username: 'Usuario',
		usernamePlaceholder: 'Apodo',
		password: 'Contraseña',
		confirmPassword: 'Confirmar contraseña',
		submit: 'Crear cuenta',
		back: 'Volver',
		errors: {
			usernameRequired: 'El usuario es obligatorio.',
			passwordRequired: 'La contraseña es obligatoria.',
			passwordMismatch: 'Las contraseñas no coinciden.',
			generic: 'No se pudo crear la cuenta.'
		}
	},
	auth: {
		googleContinue: 'Continuar con Google',
		googleComingSoon: 'El inicio de sesión con Google llegará pronto.'
	}
};

export default es;
