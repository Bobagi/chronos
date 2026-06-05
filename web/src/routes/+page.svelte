<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import type { GameMode } from '$lib/api/chronosTypes';
	import {
		endChronosGameSessionOnServer,
		expireInactiveChronosGames,
		loginChronosUserAccount,
		startAttributeDuelChronosGameForPlayer
	} from '$lib/api/GameClient';
	import FriendsPanel from '$lib/components/FriendsPanel.svelte';
	import {
		extractLastActivityTimestamp,
		formatRelativeLastActivity,
		resolveChronosGameIdentifier
	} from '$lib/services/chronosGameSummaryUtils';
	import type {
		AuthenticatedChronosUser,
		ChronosDashboardData,
		ChronosGameSummaryWithMetadata
	} from '$lib/types/chronos';
	import { setAuthState } from '$lib/stores/authStore';
	import './mainpage.css';

	export let data: {
		authUser: AuthenticatedChronosUser | null;
		dashboard: ChronosDashboardData;
	};

	const avatarFallbackImageUrl = '/avatars/placeholder.png';
	const avatarPrimaryImageUrl = 'https://bobagi.space/images/cards/23.png';

	let usernameInputValue = '';
	let passwordInputValue = '';
	let loginErrorMessage = '';
	let showFriendsPanel = false;

	$: currentUser = data.authUser;
	$: setAuthState(currentUser ?? null);

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
			loginErrorMessage = '';
			showFriendsPanel = false;
			await refreshChronosDashboardData();
		} catch (err) {
			console.error('loginChronosUserAccount failed', err);
			loginErrorMessage = 'Invalid username or password.';
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
				<p class="hero-kicker">Digital Collectible Card Duel</p>
				<h1 class="hero-title">Chronos</h1>
				<p class="hero-tagline">
					Command the Dracomania collection and duel by fire, magic and might. Each round both
					duelists reveal a card and clash on one attribute — capture more cards than your rival to
					claim the match.
				</p>
				<div class="hero-art" aria-hidden="true">
					<div
						class="hero-card tilt-left"
						style="background-image:url('https://bobagi.space/images/cards/3.png')"
					></div>
					<div
						class="hero-card tilt-center"
						style="background-image:url('https://bobagi.space/images/cards/1.png')"
					></div>
					<div
						class="hero-card tilt-right"
						style="background-image:url('https://bobagi.space/images/cards/8.png')"
					></div>
				</div>
				<p class="hero-status">
					Server
					<span
						class="status-dot"
						class:online={backendStatusIcon === '🟢'}
						class:offline={backendStatusIcon === '🔴'}
					></span>
					<span class="mono">{backendHealthMessage}</span>
				</p>
			</div>

			<div class="auth-card">
				<h2 class="auth-card-title">Enter the arena</h2>
				<p class="auth-card-sub">Log in to play, or browse the collection first.</p>
				<form class="controls-col" on:submit|preventDefault={handleChronosLoginSubmission}>
					<div class="auth-fields">
						<label class="input-wrap">
							<span class="input-label">Username</span>
							<input
								class="input-field"
								bind:value={usernameInputValue}
								placeholder="Your nickname"
								autocomplete="username"
							/>
						</label>
						<label class="input-wrap">
							<span class="input-label">Password</span>
							<input
								class="input-field"
								type="password"
								bind:value={passwordInputValue}
								placeholder="••••••••"
								autocomplete="current-password"
							/>
						</label>
					</div>
					{#if loginErrorMessage}
						<p class="empty-text" style="color:#ffbdbd">{loginErrorMessage}</p>
					{/if}
					<button class="button button-primary" type="submit">⚔️ Log in</button>
				</form>
				<div class="auth-divider">or</div>
				<div class="auth-actions">
					<button class="button button-ghost" type="button" on:click={() => goto('/gallery')}>
						🖼️ Browse the gallery
					</button>
					<button class="button button-neutral" type="button" on:click={() => goto('/register')}>
						Create an account
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
							{#if isAdmin}<span class="role-badge admin">Admin</span>{/if}
						</div>
						<div class="profile-actions">
							<button class="button button-neutral" on:click={() => goto('/gallery')}>
								🖼️ Gallery
							</button>
							<button class="button button-neutral" on:click={() => (showFriendsPanel = true)}>
								👥 Friends
							</button>
							{#if isAdmin}
								<button
									class="button button-ghost"
									on:click={expireInactiveChronosGamesAndReloadDashboard}
								>
									⏳ Expire old
								</button>
							{/if}
						</div>
					</div>

					<div class="stats-grid">
						<div class="stat">
							<div class="stat-num">{statGamesWon}</div>
							<div class="stat-label">Wins</div>
						</div>
						<div class="stat">
							<div class="stat-num">{statGamesPlayed}</div>
							<div class="stat-label">Games played</div>
						</div>
						<div class="stat">
							<div class="stat-num">{statGamesDrawn}</div>
							<div class="stat-label">Draws</div>
						</div>
						<div class="stat">
							<div class="stat-num">{statActive}</div>
							<div class="stat-label">Active games</div>
						</div>
						<div class="stat">
							<div class="stat-num">{statRank}</div>
							<div class="stat-label">Rank</div>
						</div>
						<div class="stat">
							<div class="stat-num">{statLastUpdated}</div>
							<div class="stat-label">Last activity</div>
						</div>
					</div>
				</div>
			</div>

			<div class="play-cta">
				<div class="play-cta-copy">
					<h2 class="play-cta-title">Ready to duel?</h2>
					<p class="play-cta-sub">
						Start an Attribute Duel against the bot and grow your collection of victories.
					</p>
				</div>
				<button class="button button-primary" on:click={startNewAttributeDuelChronosGameForPlayer}>
					⚔️ Start Duel
				</button>
			</div>

			<section class="games-section">
				<h2 class="section-title">Your active games</h2>
				{#if myActiveChronosGames.length === 0}
					<p class="empty-text">No active games yet — start a duel above.</p>
				{:else}
					<ul class="games-list">
						{#each myActiveChronosGames as gameSummary}
							<li class="game-card">
								<div class="game-info">
									<p class="game-id mono">{resolveChronosGameIdentifier(gameSummary)}</p>
									<p class="game-meta">
										Mode: <b>{gameSummary.mode}</b>
										{#if extractLastActivityTimestamp(gameSummary)}
											• Updated: {formatRelativeLastActivity(
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
										title="Open game"
									>
										▶ Resume
									</button>
									{#if isAdmin}
										<button
											class="button button-danger"
											on:click={() =>
												endChronosGameSessionOnServer(
													resolveChronosGameIdentifier(gameSummary)
												).then(refreshChronosDashboardData)}
											title="Finish the game"
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
					<h2 class="section-title">All active games (admin)</h2>
					{#if allActiveChronosGames.length === 0}
						<p class="empty-text">No active games on the server.</p>
					{:else}
						<ul class="games-list">
							{#each allActiveChronosGames as gameSummary}
								<li class="game-card">
									<div class="game-info">
										<p class="game-id mono">{resolveChronosGameIdentifier(gameSummary)}</p>
										<p class="game-meta">
											Mode: <b>{gameSummary.mode}</b>
											{#if gameSummary.players}• Players: {gameSummary.players.join(' · ')}{/if}
											{#if extractLastActivityTimestamp(gameSummary)}• Updated: {formatRelativeLastActivity(
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
											▶ Open
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
