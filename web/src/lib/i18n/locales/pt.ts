// Português (Brasil)
import type en from './en';

const pt: typeof en = {
	language: {
		change: 'Mudar idioma'
	},
	nav: {
		logout: 'Sair'
	},
	footer: {
		tagline: 'Batalhas estratégicas de cartas mitológicas no seu navegador.',
		community: 'Comunidade',
		privacy: 'Privacidade',
		terms: 'Termos',
		rights: '© {year} Chronos'
	},
	home: {
		kicker: 'Duelo de Cartas Colecionáveis',
		tagline:
			'Comande a coleção Dracomania e duele por fogo, magia e força. A cada rodada os dois duelistas revelam uma carta e se enfrentam em um atributo — capture mais cartas que seu rival para vencer a partida.',
		serverLabel: 'Servidor',
		auth: {
			title: 'Entre na arena',
			subtitle: 'Faça login para jogar, ou veja a coleção primeiro.',
			username: 'Usuário',
			usernamePlaceholder: 'Seu apelido',
			password: 'Senha',
			login: 'Entrar',
			or: 'ou',
			browseGallery: 'Ver a galeria',
			createAccount: 'Criar uma conta',
			invalidCredentials: 'Usuário ou senha inválidos.'
		},
		dashboard: {
			adminBadge: 'Admin',
			gallery: 'Galeria',
			friends: 'Amigos',
			expireOld: 'Expirar antigos',
			readyTitle: 'Pronto para duelar?',
			readySub: 'Inicie um Duelo de Atributos contra o bot e aumente sua coleção de vitórias.',
			startDuel: 'Iniciar Duelo',
			yourGames: 'Seus jogos ativos',
			noGames: 'Nenhum jogo ativo ainda — inicie um duelo acima.',
			mode: 'Modo',
			updated: 'Atualizado',
			resume: 'Retomar',
			openGame: 'Abrir jogo',
			finishGame: 'Encerrar o jogo',
			allGames: 'Todos os jogos ativos (admin)',
			noServerGames: 'Nenhum jogo ativo no servidor.',
			players: 'Jogadores',
			open: 'Abrir',
			stats: {
				wins: 'Vitórias',
				played: 'Partidas jogadas',
				draws: 'Empates',
				active: 'Jogos ativos',
				rank: 'Rank',
				lastActivity: 'Última atividade'
			}
		}
	},
	gallery: {
		home: 'Início',
		title: 'Coleções',
		subtitle: 'Clique em uma carta para ampliá-la.',
		loading: 'Carregando cartas…',
		error: 'Erro: {message}',
		noCollections: 'Nenhuma coleção encontrada.',
		noCards: 'Nenhuma carta encontrada nesta coleção.',
		cardCount: '{count} cartas',
		close: 'Fechar',
		card: 'Carta',
		stats: {
			magic: 'Magia',
			might: 'Força',
			fire: 'Fogo'
		}
	},
	register: {
		title: 'Crie sua conta',
		subtitle: 'É rápido e gratuito.',
		username: 'Usuário',
		usernamePlaceholder: 'Apelido',
		password: 'Senha',
		confirmPassword: 'Confirmar senha',
		submit: 'Criar conta',
		back: 'Voltar',
		errors: {
			usernameRequired: 'O usuário é obrigatório.',
			passwordRequired: 'A senha é obrigatória.',
			passwordMismatch: 'As senhas não coincidem.',
			generic: 'Não foi possível criar a conta.'
		}
	},
	auth: {
		googleContinue: 'Continuar com o Google',
		googleComingSoon: 'Login com Google em breve.'
	}
};

export default pt;
