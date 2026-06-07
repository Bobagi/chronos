<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import type { GameMode } from '$lib/api/chronosTypes';
	import {
		endChronosGameSessionOnServer,
		expireInactiveChronosGames,
		loginChronosUserAccount,
		startAttributeDuelChronosGameForPlayer
	} from '$lib/api/GameClient';
	import CardComposite from '$lib/components/CardComposite.svelte';
	import FriendsPanel from '$lib/components/FriendsPanel.svelte';
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
	const avatarPrimaryImageUrl = 'https://bobagi.space/images/cards/23.png';

	// Same frame + title overlays the gallery and the duel board use, so the hero
	// shows the exact cards as they appear in-game (not bare art tiles).
	const heroCardFrameImageUrl = '/frames/default.png';
	const heroCardTitleImageUrl = '/frames/title.png';
	const heroCardTiltClasses = ['tilt-left', 'tilt-center', 'tilt-right'];

	let usernameInputValue = '';
	let passwordInputValue = '';
	let loginErrorKey: string | null = null;
	let showFriendsPanel = false;

	$: currentUser = data.authUser;
	$: setAuthState(currentUser ?? null);

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
				<h1 class="hero-title">Chronos</h1>
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
				<div class="auth-actions">
					<button class="button button-ghost" type="button" on:click={() => goto('/gallery')}>
						🖼️ {$t('home.auth.browseGallery')}
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
				<div class="avatar-wrap" aria-hidden="true">
					<img
						src={avatarPrimaryImageUrl}
						alt="User avatar"
						loading="lazy"
						on:error={replaceBrokenAvatarWithFallbackImage}
					/>
				</div>

				<div class="profile-main">
					<div class="profile-top">
						<div class="user-name">
							{currentUser.username}
							{#if isAdmin}<span class="role-badge admin">{$t('home.dashboard.adminBadge')}</span
								>{/if}
						</div>
						<div class="profile-actions">
							<button class="button button-neutral" on:click={() => goto('/gallery')}>
								🖼️ {$t('home.dashboard.gallery')}
							</button>
							<button class="button button-neutral" on:click={() => (showFriendsPanel = true)}>
								👥 {$t('home.dashboard.friends')}
							</button>
							{#if isAdmin}
								<button
									class="button button-ghost"
									on:click={expireInactiveChronosGamesAndReloadDashboard}
								>
									⏳ {$t('home.dashboard.expireOld')}
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
		</div>
	{/if}
</div>
