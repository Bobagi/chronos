<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { onMount, onDestroy } from 'svelte';
	import type { GameMode } from '$lib/api/chronosTypes';
	import {
		endChronosGameSessionOnServer,
		expireInactiveChronosGames,
		loginChronosUserAccount,
		startAttributeDuelChronosGameForPlayer,
		listAuthenticatedChronosPlayerActiveGames,
		listChronosFriends,
		surrenderChronosGame
	} from '$lib/api/GameClient';
	import AvatarPicker from '$lib/components/AvatarPicker.svelte';
	import CardComposite from '$lib/components/CardComposite.svelte';
	import FriendsPanel from '$lib/components/FriendsPanel.svelte';
	import UiIcon from '$lib/components/UiIcon.svelte';
	import GoogleAuthButton from '$lib/components/GoogleAuthButton.svelte';
	import { DEFAULT_AVATAR_URL } from '$lib/config/avatarOptions';
	import {
		extractLastActivityTimestamp,
		formatRelativeLastActivity,
		resolveChronosGameIdentifier
	} from '$lib/services/chronosGameSummaryUtils';
	import { t } from '$lib/i18n';
	import type { FeaturedHeroCard } from '$lib/services/featuredHeroCards';
	import type {
		AuthenticatedChronosUser,
		ChronosDashboardData,
		ChronosGameSummaryWithMetadata
	} from '$lib/types/chronos';
	import { setAuthState } from '$lib/stores/authStore';
	import './game/fonts.css';
	import './mainpage.css';

	export let data: {
		authUser: AuthenticatedChronosUser | null;
		dashboard: ChronosDashboardData;
		featuredCards: FeaturedHeroCard[];
	};

	const avatarFallbackImageUrl = '/avatars/placeholder.png';

	// Same frame + title overlays the gallery and the duel board use, so the hero
	// shows the exact cards as they appear in-game (not bare art tiles).
	const heroCardFrameImageUrl = '/frames/default.png';
	const heroCardTitleImageUrl = '/frames/title.png';
	const heroCardTiltClasses = ['tilt-left', 'tilt-center', 'tilt-right'];

	const BOT_ID = '70dc2eb8-b3a5-4c21-9e2b-c6cf901078b0';

	let usernameInputValue = '';
	let passwordInputValue = '';
	let loginErrorKey: string | null = null;
	let showFriendsPanel = false;
	let showAvatarPicker = false;

	// --- Challenge notification polling ---
	type PendingChallenge = { gameId: string; challengerName: string; mode: string };
	let pendingChallenges: PendingChallenge[] = [];
	let seenGameIds = new Set<string>();
	let friendsCache = new Map<string, string>(); // playerId → username
	let challengePollInterval: ReturnType<typeof setInterval> | null = null;
	let firstPollDone = false;

	function loadSeenGames() {
		try {
			const raw = localStorage.getItem('cartomania-seen-games');
			if (raw) seenGameIds = new Set<string>(JSON.parse(raw) as string[]);
		} catch {}
	}

	function saveSeenGames() {
		try {
			localStorage.setItem('cartomania-seen-games', JSON.stringify([...seenGameIds]));
		} catch {}
	}

	function markChallengeSeen(gameId: string) {
		seenGameIds.add(gameId);
		saveSeenGames();
		pendingChallenges = pendingChallenges.filter((c) => c.gameId !== gameId);
	}

	async function refreshFriendsCache() {
		if (!currentUser) return;
		try {
			const friends = await listChronosFriends();
			friends.forEach((f) => friendsCache.set(f.friend.id, f.friend.username));
		} catch {}
	}

	async function pollForChallenges() {
		if (!currentUser) return;
		try {
			const games = await listAuthenticatedChronosPlayerActiveGames();
			for (const game of games) {
				const g = game as Record<string, unknown>;
				const gameId = (g.gameId as string) || (g.id as string);
				if (!gameId) continue;
				if (firstPollDone && !seenGameIds.has(gameId)) {
					const players = g.players as string[] | undefined;
					if (players && players.length >= 2 && players[1] === currentUser.id && players[0] !== BOT_ID) {
						seenGameIds.add(gameId);
						saveSeenGames();
						const challengerName = friendsCache.get(players[0]) || 'Um amigo';
						const mode = (g.mode as string) || 'ATTRIBUTE_DUEL';
						pendingChallenges = [...pendingChallenges, { gameId, challengerName, mode }];
					}
				} else if (!firstPollDone) {
					seenGameIds.add(gameId);
				}
			}
			if (!firstPollDone) {
				firstPollDone = true;
				saveSeenGames();
			}
		} catch {}
	}

	async function acceptChallenge(challenge: PendingChallenge) {
		markChallengeSeen(challenge.gameId);
		if (challenge.mode === 'CLASSIC') goto(`/game/classic/${challenge.gameId}`);
		else goto(`/game/duel/${challenge.gameId}`);
	}

	async function declineChallenge(challenge: PendingChallenge) {
		markChallengeSeen(challenge.gameId);
		try { await surrenderChronosGame(challenge.gameId); } catch {}
	}

	function startChallengePoll() {
		loadSeenGames();
		firstPollDone = false;
		void refreshFriendsCache();
		void pollForChallenges();
		challengePollInterval = setInterval(() => void pollForChallenges(), 4000);
	}

	function stopChallengePoll() {
		if (challengePollInterval) { clearInterval(challengePollInterval); challengePollInterval = null; }
	}

	onMount(() => {
		if (currentUser) startChallengePoll();
	});

	onDestroy(() => {
		stopChallengePoll();
	});

	$: currentUser = data.authUser;
	$: setAuthState(currentUser ?? null);
	$: avatarPrimaryImageUrl = currentUser?.avatarUrl || DEFAULT_AVATAR_URL;

	function handleAvatarUpdated(event: CustomEvent<{ user: AuthenticatedChronosUser }>) {
		setAuthState(event.detail.user);
		showAvatarPicker = false;
		void refreshChronosDashboardData();
	}

	$: featuredCards = data.featuredCards ?? [];

	$: dashboardData = data.dashboard;
	$: backendHealthMessage = dashboardData?.backendHealthMessage ?? 'Checking server…';
	$: myActiveChronosGames =
		dashboardData?.myActiveChronosGames ?? ([] as ChronosGameSummaryWithMetadata[]);
	$: allActiveChronosGames =
		dashboardData?.allActiveChronosGames ?? ([] as ChronosGameSummaryWithMetadata[]);
	$: statistics = dashboardData?.statistics ?? { gamesPlayed: 0, gamesWon: 0, gamesDrawn: 0 };

	$: statGamesPlayed = statistics.gamesPlayed ?? 0;
	$: statGamesWon = statistics.gamesWon ?? 0;
	$: statGamesDrawn = statistics.gamesDrawn ?? 0;
	$: statActive = myActiveChronosGames.length;
	$: statLastUpdated =
		myActiveChronosGames.length > 0
			? formatRelativeLastActivity(
					Math.max(...myActiveChronosGames.map((g) => extractLastActivityTimestamp(g) || 0))
				)
			: '—';
	$: statRank = 'Bronze I';
	$: backendStatusIcon = backendHealthMessage.toLowerCase().includes('online')
		? '🟢'
		: backendHealthMessage.toLowerCase().includes('offline')
			? '🟡'
			: '🔴';
	$: isAdmin = currentUser?.role === 'ADMIN';

	async function refreshChronosDashboardData() {
		await invalidateAll();
	}

	async function handleChronosLoginSubmission() {
		try {
			const { user } = await loginChronosUserAccount(usernameInputValue.trim(), passwordInputValue);
			setAuthState(user);
			passwordInputValue = '';
			loginErrorKey = null;
			showFriendsPanel = false;
			await refreshChronosDashboardData();
		} catch (err) {
			console.error('loginChronosUserAccount failed', err);
			loginErrorKey = 'home.auth.invalidCredentials';
		}
	}

	async function startNewAttributeDuelChronosGameForPlayer() {
		if (!currentUser) return;
		try {
			const { gameId } = await startAttributeDuelChronosGameForPlayer(currentUser.id);
			goto(`/game/duel/${gameId}`);
			return;
		} catch (error) {
			console.error('Failed to start duel', error);
		}
		await refreshChronosDashboardData();
	}

	async function expireInactiveChronosGamesAndReloadDashboard() {
		if (!isAdmin) return;
		try {
			await expireInactiveChronosGames();
		} catch (error) {
			console.error('Failed to expire games', error);
		}
		await refreshChronosDashboardData();
	}

	function navigateToExistingChronosGame(gameIdentifier: string, gameMode: string) {
		if (gameMode === 'CLASSIC') goto(`/game/classic/${gameIdentifier}`);
		else if (gameMode === 'ATTRIBUTE_DUEL' || gameMode === 'DUEL')
			goto(`/game/duel/${gameIdentifier}`);
		else goto(`/game/${gameIdentifier}`);
	}

	function handleFriendMatchSelection(
		event: CustomEvent<{
			gameId: string;
			mode: GameMode;
		}>
	) {
		const { gameId, mode } = event.detail;
		showFriendsPanel = false;
		if (mode === 'CLASSIC') goto(`/game/classic/${gameId}`);
		else goto(`/game/duel/${gameId}`);
	}

	async function refreshDashboardAfterFriendPanelInteraction() {
		await refreshChronosDashboardData();
	}

	$: if (!currentUser) {
		showFriendsPanel = false;
		stopChallengePoll();
		pendingChallenges = [];
	}

	let _prevUserId: string | null = null;
	$: {
		const uid = currentUser?.id ?? null;
		if (uid && uid !== _prevUserId) {
			stopChallengePoll();
			startChallengePoll();
		}
		_prevUserId = uid;
	}

	function replaceBrokenAvatarWithFallbackImage(event: Event) {
		const imageElement = event.currentTarget as HTMLImageElement | null;
		if (!imageElement) return;
		imageElement.onerror = null;
		imageElement.src = avatarFallbackImageUrl;
	}
</script>

<div class="page-shell">
	{#if !currentUser}
		<div class="landing">
			<div class="landing-hero">
				<p class="hero-kicker">{$t('home.kicker')}</p>
				<h1 class="hero-title">Cartomania</h1>
				<p class="hero-tagline">{$t('home.tagline')}</p>
				{#if featuredCards.length}
					<div class="hero-art" aria-hidden="true">
						{#each featuredCards as heroCard, index (heroCard.code)}
							<div class="hero-card {heroCardTiltClasses[index] ?? ''}">
								<CardComposite
									artImageUrl={heroCard.imageUrl}
									frameImageUrl={heroCardFrameImageUrl}
									titleImageUrl={heroCardTitleImageUrl}
									titleText={heroCard.name}
									descriptionText={heroCard.description}
									magicValue={heroCard.magic}
									mightValue={heroCard.might}
									fireValue={heroCard.fire}
									cornerNumberValue={heroCard.number}
									enableTilt={false}
								/>
							</div>
						{/each}
					</div>
				{/if}
				<p class="hero-status">
					{$t('home.serverLabel')}
					<span
						class="status-dot"
						class:online={backendStatusIcon === '🟢'}
						class:offline={backendStatusIcon === '🔴'}
					></span>
					<span class="mono">{backendHealthMessage}</span>
				</p>
			</div>

			<div class="auth-card">
				<h2 class="auth-card-title">{$t('home.auth.title')}</h2>
				<p class="auth-card-sub">{$t('home.auth.subtitle')}</p>
				<form class="controls-col" on:submit|preventDefault={handleChronosLoginSubmission}>
					<div class="auth-fields">
						<label class="input-wrap">
							<span class="input-label">{$t('home.auth.username')}</span>
							<input
								class="input-field"
								bind:value={usernameInputValue}
								placeholder={$t('home.auth.usernamePlaceholder')}
								autocomplete="username"
							/>
						</label>
						<label class="input-wrap">
							<span class="input-label">{$t('home.auth.password')}</span>
							<input
								class="input-field"
								type="password"
								bind:value={passwordInputValue}
								placeholder="••••••••"
								autocomplete="current-password"
							/>
						</label>
					</div>
					{#if loginErrorKey}
						<p class="empty-text" style="color:#ffbdbd">{$t(loginErrorKey)}</p>
					{/if}
					<button class="button button-primary" type="submit">⚔️ {$t('home.auth.login')}</button>
				</form>
				<div class="auth-divider">{$t('home.auth.or')}</div>
				<GoogleAuthButton />
				<div class="auth-actions">
					<button class="button button-ghost" type="button" on:click={() => goto('/gallery')}>
						<UiIcon name="gallery" />
						{$t('home.auth.browseGallery')}
					</button>
					<button class="button button-neutral" type="button" on:click={() => goto('/register')}>
						{$t('home.auth.createAccount')}
					</button>
				</div>
			</div>
		</div>
	{:else}
		<div class="dashboard">
			<div class="profile-card">
				<button
					type="button"
					class="avatar-wrap"
					on:click={() => (showAvatarPicker = true)}
					title={$t('account.chooseAvatar')}
				>
					<img
						src={avatarPrimaryImageUrl}
						alt="User avatar"
						loading="lazy"
						on:error={replaceBrokenAvatarWithFallbackImage}
					/>
				</button>

				<div class="profile-main">
					<div class="profile-top">
						<div class="user-name">
							{currentUser.username}
							{#if isAdmin}<span class="role-badge admin">{$t('home.dashboard.adminBadge')}</span
								>{/if}
						</div>
						<div class="profile-actions">
							<button class="button button-neutral" on:click={() => goto('/gallery')}>
								<UiIcon name="gallery" />
								{$t('home.dashboard.gallery')}
							</button>
							<button class="button button-neutral" on:click={() => (showFriendsPanel = true)}>
								<UiIcon name="friends" />
								{$t('home.dashboard.friends')}
							</button>
							<button class="button button-neutral" on:click={() => goto('/account')}>
								<UiIcon name="settings" />
								{$t('account.navLabel')}
							</button>
							{#if isAdmin}
								<button class="button button-neutral" on:click={() => goto('/cards-lab')}>
									<UiIcon name="flask" />
									{$t('home.dashboard.cardsLab')}
								</button>
								<button
									class="button button-ghost"
									on:click={expireInactiveChronosGamesAndReloadDashboard}
								>
									<UiIcon name="hourglass" />
									{$t('home.dashboard.expireOld')}
								</button>
							{/if}
						</div>
					</div>

					<div class="stats-grid">
						<div class="stat">
							<div class="stat-num">{statGamesWon}</div>
							<div class="stat-label">{$t('home.dashboard.stats.wins')}</div>
						</div>
						<div class="stat">
							<div class="stat-num">{statGamesPlayed}</div>
							<div class="stat-label">{$t('home.dashboard.stats.played')}</div>
						</div>
						<div class="stat">
							<div class="stat-num">{statGamesDrawn}</div>
							<div class="stat-label">{$t('home.dashboard.stats.draws')}</div>
						</div>
						<div class="stat">
							<div class="stat-num">{statActive}</div>
							<div class="stat-label">{$t('home.dashboard.stats.active')}</div>
						</div>
						<div class="stat">
							<div class="stat-num">{statRank}</div>
							<div class="stat-label">{$t('home.dashboard.stats.rank')}</div>
						</div>
						<div class="stat">
							<div class="stat-num">{statLastUpdated}</div>
							<div class="stat-label">{$t('home.dashboard.stats.lastActivity')}</div>
						</div>
					</div>
				</div>
			</div>

			<div class="play-cta">
				<div class="play-cta-copy">
					<h2 class="play-cta-title">{$t('home.dashboard.readyTitle')}</h2>
					<p class="play-cta-sub">{$t('home.dashboard.readySub')}</p>
				</div>
				<button class="button button-primary" on:click={startNewAttributeDuelChronosGameForPlayer}>
					⚔️ {$t('home.dashboard.startDuel')}
				</button>
			</div>

			<section class="games-section">
				<h2 class="section-title">{$t('home.dashboard.yourGames')}</h2>
				{#if myActiveChronosGames.length === 0}
					<p class="empty-text">{$t('home.dashboard.noGames')}</p>
				{:else}
					<ul class="games-list">
						{#each myActiveChronosGames as gameSummary}
							<li class="game-card">
								<div class="game-info">
									<p class="game-id mono">{resolveChronosGameIdentifier(gameSummary)}</p>
									<p class="game-meta">
										{$t('home.dashboard.mode')}: <b>{gameSummary.mode}</b>
										{#if extractLastActivityTimestamp(gameSummary)}
											• {$t('home.dashboard.updated')}: {formatRelativeLastActivity(
												extractLastActivityTimestamp(gameSummary)
											)}
										{/if}
									</p>
								</div>
								<div class="game-actions">
									<button
										class="button button-primary"
										on:click={() =>
											navigateToExistingChronosGame(
												resolveChronosGameIdentifier(gameSummary),
												gameSummary.mode
											)}
										title={$t('home.dashboard.openGame')}
									>
										▶ {$t('home.dashboard.resume')}
									</button>
									{#if isAdmin}
										<button
											class="button button-danger"
											on:click={() =>
												endChronosGameSessionOnServer(
													resolveChronosGameIdentifier(gameSummary)
												).then(refreshChronosDashboardData)}
											title={$t('home.dashboard.finishGame')}
										>
											🗑️
										</button>
									{/if}
								</div>
							</li>
						{/each}
					</ul>
				{/if}
			</section>

			{#if isAdmin}
				<section class="games-section">
					<h2 class="section-title">{$t('home.dashboard.allGames')}</h2>
					{#if allActiveChronosGames.length === 0}
						<p class="empty-text">{$t('home.dashboard.noServerGames')}</p>
					{:else}
						<ul class="games-list">
							{#each allActiveChronosGames as gameSummary}
								<li class="game-card">
									<div class="game-info">
										<p class="game-id mono">{resolveChronosGameIdentifier(gameSummary)}</p>
										<p class="game-meta">
											{$t('home.dashboard.mode')}: <b>{gameSummary.mode}</b>
											{#if gameSummary.players}• {$t('home.dashboard.players')}: {gameSummary.players.join(
													' · '
												)}{/if}
											{#if extractLastActivityTimestamp(gameSummary)}• {$t(
													'home.dashboard.updated'
												)}: {formatRelativeLastActivity(
													extractLastActivityTimestamp(gameSummary)
												)}{/if}
										</p>
									</div>
									<div class="game-actions">
										<button
											class="button button-neutral"
											on:click={() =>
												navigateToExistingChronosGame(
													resolveChronosGameIdentifier(gameSummary),
													gameSummary.mode
												)}
										>
											▶ {$t('home.dashboard.open')}
										</button>
										<button
											class="button button-danger"
											on:click={() =>
												endChronosGameSessionOnServer(
													resolveChronosGameIdentifier(gameSummary)
												).then(refreshChronosDashboardData)}
										>
											🗑️
										</button>
									</div>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			{/if}

			{#if showFriendsPanel}
				<FriendsPanel
					currentUserId={currentUser.id}
					on:close={() => (showFriendsPanel = false)}
					on:navigateToGame={handleFriendMatchSelection}
					on:refreshDashboard={refreshDashboardAfterFriendPanelInteraction}
				/>
			{/if}

			{#each pendingChallenges as challenge (challenge.gameId)}
				<div class="challenge-toast" role="alert">
					<span class="ct-icon">⚔</span>
					<div class="ct-body">
						<strong>{challenge.challengerName}</strong> te desafiou para um duelo!
					</div>
					<button class="ct-accept button" on:click={() => acceptChallenge(challenge)}>Aceitar</button>
					<button class="ct-decline" on:click={() => declineChallenge(challenge)}>Recusar</button>
				</div>
			{/each}

			{#if showAvatarPicker}
				<AvatarPicker
					currentAvatarUrl={currentUser.avatarUrl ?? null}
					on:close={() => (showAvatarPicker = false)}
					on:updated={handleAvatarUpdated}
				/>
			{/if}
		</div>
	{/if}
</div>
