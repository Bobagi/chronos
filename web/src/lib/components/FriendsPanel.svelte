<script lang="ts">
	import { createEventDispatcher, onDestroy, onMount } from 'svelte';

	import {
		blockChronosPlayer,
		fetchChronosFriendChat,
		listChronosFriendRequests,
		listChronosFriends,
		respondChronosFriendRequest,
		searchChronosPlayers,
		sendChronosFriendMessage,
		sendChronosFriendRequest,
		removeChronosFriend,
		startChronosGameWithFriend,
		ChronosApiError,
		type ChronosFriendChatMessage,
		type ChronosFriendSummary,
		type ChronosIncomingFriendRequest,
		type ChronosPlayerSummary,
		type GameMode
	} from '$lib/api/GameClient';
	import { t } from '$lib/i18n';
	import '$lib/styles/components/FriendsPanel.css';

	const dispatch = createEventDispatcher<{
		close: void;
		navigateToGame: { gameId: string; mode: GameMode };
		refreshDashboard: void;
	}>();

	export let currentUserId: string;

	let friends: ChronosFriendSummary[] = [];
	let requests: ChronosIncomingFriendRequest[] = [];
	let searchTerm = '';
	let searchResults: ChronosPlayerSummary[] = [];
	let searchInFlight = false;
	let loadError: string | null = null;
	type PanelNotice = {
		text: string;
		tone: 'info' | 'success' | 'warning' | 'error';
	};

	let persistentNotice: PanelNotice | null = null;
	let ephemeralNotice: PanelNotice | null = null;
	let ephemeralNoticeTimer: ReturnType<typeof setTimeout> | null = null;
	let selectedFriendshipId: string | null = null;
	let chatMessages: ChronosFriendChatMessage[] = [];
	let chatLoading = false;
	let chatMessageDraft = '';

	function scheduleEphemeralNotice(notice: PanelNotice) {
		if (ephemeralNoticeTimer) {
			clearTimeout(ephemeralNoticeTimer);
			ephemeralNoticeTimer = null;
		}
		ephemeralNotice = notice;
		ephemeralNoticeTimer = setTimeout(() => {
			ephemeralNotice = null;
			ephemeralNoticeTimer = null;
		}, 3400);
	}

	function interpretFriendServiceError(
		error: unknown,
		fallback: string,
		defaultTone: PanelNotice['tone'] = 'error'
	): PanelNotice {
		if (error instanceof ChronosApiError) {
			if (error.status === 401) {
				return {
					text: $t('friends.sessionExpired'),
					tone: 'warning'
				};
			}

			if (error.status === 500 && error.path.startsWith('/friends')) {
				return {
					text: $t('friends.missingTables'),
					tone: 'warning'
				};
			}

			let bodyMessage = '';
			if (typeof error.bodyJson === 'object' && error.bodyJson !== null) {
				const messageCandidate = (error.bodyJson as { message?: unknown }).message;
				if (typeof messageCandidate === 'string') {
					bodyMessage = messageCandidate.trim();
				}
			}

			const text = bodyMessage || error.bodyText.trim() || fallback;
			return { text, tone: defaultTone };
		}

		if (error instanceof Error && error.message) {
			return { text: error.message, tone: defaultTone };
		}

		if (typeof error === 'string' && error.trim().length > 0) {
			return { text: error.trim(), tone: defaultTone };
		}

		return { text: fallback, tone: defaultTone };
	}

	function announceFriendServiceIssue(
		error: unknown,
		fallback: string,
		defaultTone: PanelNotice['tone'] = 'error'
	) {
		const notice = interpretFriendServiceError(error, fallback, defaultTone);
		if (notice.tone === 'warning') {
			persistentNotice = notice;
		} else {
			scheduleEphemeralNotice(notice);
		}
	}

	onDestroy(() => {
		if (ephemeralNoticeTimer) {
			clearTimeout(ephemeralNoticeTimer);
			ephemeralNoticeTimer = null;
		}
	});

	async function loadInitialData() {
		try {
			const [friendList, requestList] = await Promise.all([
				listChronosFriends(),
				listChronosFriendRequests()
			]);
			friends = friendList;
			requests = requestList;
			reselectFriendship();
			persistentNotice = null;
			loadError = null;
		} catch (error) {
			console.error('Failed to load friends data', error);
			const notice = interpretFriendServiceError(error, $t('friends.loadFail'));
			if (notice.tone === 'error') {
				loadError = notice.text;
			} else {
				loadError = null;
				persistentNotice = notice;
			}
		}
	}

	function reselectFriendship() {
		if (!selectedFriendshipId) {
			chatMessages = [];
			return;
		}
		const next = friends.find((f) => f.friendshipId === selectedFriendshipId) ?? null;
		if (!next || next.status !== 'ACCEPTED' || next.blockedByMe) {
			selectedFriendshipId = null;
			chatMessages = [];
			return;
		}
		void loadChatFor(next.friend.id);
	}

	onMount(async () => {
		await loadInitialData();
	});

	async function searchPlayers() {
		const term = searchTerm.trim();
		if (!term) {
			searchResults = [];
			return;
		}
		searchInFlight = true;
		try {
			searchResults = await searchChronosPlayers(term);
		} catch (error) {
			console.error('Search failed', error);
			announceFriendServiceIssue(error, $t('friends.searchFail'));
		} finally {
			searchInFlight = false;
		}
	}

	async function sendRequest(targetId: string) {
		try {
			await sendChronosFriendRequest(targetId);
			await loadInitialData();
			scheduleEphemeralNotice({ text: $t('friends.requestSent'), tone: 'success' });
		} catch (error) {
			console.error('Failed to send friend request', error);
			announceFriendServiceIssue(error, $t('friends.requestSendFail'));
		}
	}

	async function handleRequestResponse(friendshipId: string, accept: boolean) {
		try {
			await respondChronosFriendRequest(friendshipId, accept);
			await loadInitialData();
			dispatch('refreshDashboard');
			scheduleEphemeralNotice({
				text: accept ? $t('friends.requestAccepted') : $t('friends.requestDismissed'),
				tone: 'success'
			});
		} catch (error) {
			console.error('Failed to resolve friend request', error);
			announceFriendServiceIssue(error, $t('friends.requestResolveFail'));
		}
	}

	async function removeFriend(friendshipId: string) {
		try {
			await removeChronosFriend(friendshipId);
			if (selectedFriendshipId === friendshipId) {
				selectedFriendshipId = null;
				chatMessages = [];
			}
			await loadInitialData();
			dispatch('refreshDashboard');
			scheduleEphemeralNotice({ text: $t('friends.friendRemoved'), tone: 'info' });
		} catch (error) {
			console.error('Failed to remove friend', error);
			announceFriendServiceIssue(error, $t('friends.friendRemoveFail'));
		}
	}

	async function blockFriend(targetId: string) {
		try {
			await blockChronosPlayer(targetId);
			if (selectedFriendshipId) {
				const active = friends.find((f) => f.friendshipId === selectedFriendshipId);
				if (active && active.friend.id === targetId) {
					selectedFriendshipId = null;
					chatMessages = [];
				}
			}
			await loadInitialData();
			dispatch('refreshDashboard');
			scheduleEphemeralNotice({ text: $t('friends.playerBlocked'), tone: 'info' });
		} catch (error) {
			console.error('Failed to block player', error);
			announceFriendServiceIssue(error, $t('friends.playerBlockFail'));
		}
	}

	async function loadChatFor(friendId: string) {
		chatLoading = true;
		try {
			const history = await fetchChronosFriendChat(friendId);
			selectedFriendshipId = history.friendshipId;
			chatMessages = history.messages ?? [];
		} catch (error) {
			console.error('Failed to fetch chat history', error);
			announceFriendServiceIssue(error, $t('friends.chatLoadFail'));
		} finally {
			chatLoading = false;
		}
	}

	function selectFriend(friendship: ChronosFriendSummary) {
		if (friendship.status !== 'ACCEPTED' || friendship.blockedByMe) {
			selectedFriendshipId = null;
			chatMessages = [];
			return;
		}
		void loadChatFor(friendship.friend.id);
	}

	async function sendChatMessage(friendship: ChronosFriendSummary) {
		const trimmed = chatMessageDraft.trim();
		if (!trimmed || friendship.status !== 'ACCEPTED' || friendship.blockedByMe) return;
		try {
			const message = await sendChronosFriendMessage(friendship.friend.id, trimmed);
			chatMessages = [...chatMessages, message];
			chatMessageDraft = '';
		} catch (error) {
			console.error('Failed to send chat message', error);
			announceFriendServiceIssue(error, $t('friends.messageSendFail'));
		}
	}

	async function startFriendMatch(friendship: ChronosFriendSummary, mode: GameMode) {
		if (friendship.status !== 'ACCEPTED' || friendship.blockedByMe) return;
		try {
			const { gameId } = await startChronosGameWithFriend(friendship.friend.id, mode);
			dispatch('navigateToGame', { gameId, mode });
			dispatch('refreshDashboard');
			scheduleEphemeralNotice({ text: $t('friends.matchCreated'), tone: 'success' });
		} catch (error) {
			console.error('Failed to start friend match', error);
			announceFriendServiceIssue(error, $t('friends.matchStartFail'));
		}
	}

	function formatRequestTimestamp(value: string) {
		const parsed = Number(new Date(value));
		if (Number.isNaN(parsed)) return '';
		return new Date(parsed).toLocaleString();
	}

	$: selectedFriendship = selectedFriendshipId
		? (friends.find((f) => f.friendshipId === selectedFriendshipId) ?? null)
		: null;

	const isSelf = (playerId: string) => playerId === currentUserId;

	// Reactive so the status pills re-translate when the language changes.
	$: friendshipStatusLabels = {
		ACCEPTED: $t('friends.statusAccepted'),
		PENDING: $t('friends.statusPending'),
		DECLINED: $t('friends.statusDeclined'),
		BLOCKED: $t('friends.statusBlocked')
	} as Record<string, string>;
</script>

<div class="friends-overlay" role="dialog" aria-modal="true">
	<div class="friends-panel">
		<header class="friends-header">
			<h2>{$t('friends.title')}</h2>
			<button
				type="button"
				class="button button-ghost small"
				on:click={() => dispatch('close')}
				aria-label={$t('friends.closeAria')}
			>
				✕ {$t('friends.close')}
			</button>
		</header>

		{#if loadError}
			<div class="notice-banner error">{loadError}</div>
		{/if}
		{#if persistentNotice}
			<div class={`notice-banner ${persistentNotice.tone}`}>{persistentNotice.text}</div>
		{/if}
		{#if ephemeralNotice}
			<div class={`notice-banner ephemeral ${ephemeralNotice.tone}`}>{ephemeralNotice.text}</div>
		{/if}

		<div class="panel-grid">
			<div class="column column-left">
				<section class="card">
					<div class="card-header">
						<h3>{$t('friends.searchTitle')}</h3>
						<p class="card-hint">{$t('friends.searchHint')}</p>
					</div>
					<form class="search-form" on:submit|preventDefault={searchPlayers}>
						<input
							type="search"
							placeholder={$t('friends.searchPlaceholder')}
							bind:value={searchTerm}
							aria-label={$t('friends.searchAria')}
						/>
						<button type="submit" class="button button-accent" disabled={searchInFlight}
							>{$t('friends.search')}</button
						>
					</form>
					{#if searchInFlight}
						<div class="hint">{$t('friends.searching')}</div>
					{:else if searchResults.length === 0 && searchTerm.trim()}
						<div class="hint">{$t('friends.noPlayers')}</div>
					{:else if searchResults.length > 0}
						<ul class="list">
							{#each searchResults as user}
								<li class="list-item">
									<div class="list-primary">
										<strong>{user.username}</strong>
										{#if isSelf(user.id)}
											<span class="status-pill neutral">{$t('friends.you')}</span>
										{/if}
									</div>
									<button
										type="button"
										class="button button-accent small"
										disabled={isSelf(user.id)}
										on:click={() => sendRequest(user.id)}
									>
										{$t('friends.sendRequest')}
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</section>

				<section class="card">
					<div class="card-header">
						<h3>{$t('friends.requestsTitle')}</h3>
						<p class="card-hint">{$t('friends.requestsHint')}</p>
					</div>
					{#if requests.length === 0}
						<div class="hint">{$t('friends.noRequests')}</div>
					{:else}
						<ul class="list">
							{#each requests as request}
								<li class="list-item">
									<div class="list-primary">
										<strong>{request.requester.username}</strong>
										<span class="status-pill neutral"
											>{formatRequestTimestamp(request.createdAt)}</span
										>
									</div>
									<div class="button-row">
										<button
											type="button"
											class="button button-accent small"
											on:click={() => handleRequestResponse(request.friendshipId, true)}
										>
											{$t('friends.accept')}
										</button>
										<button
											type="button"
											class="button button-ghost small"
											on:click={() => handleRequestResponse(request.friendshipId, false)}
										>
											{$t('friends.dismiss')}
										</button>
									</div>
								</li>
							{/each}
						</ul>
					{/if}
				</section>

				<section class="card">
					<div class="card-header">
						<h3>{$t('friends.rosterTitle')}</h3>
						<p class="card-hint">{$t('friends.rosterHint')}</p>
					</div>
					{#if friends.length === 0}
						<div class="hint">{$t('friends.noFriends')}</div>
					{:else}
						<ul class="list">
							{#each friends as friendship}
								<li
									class="list-item"
									class:selected={friendship.friendshipId === selectedFriendshipId}
								>
									<div class="list-primary">
										<strong>{friendship.friend.username}</strong>
										<div class="status-group">
											<span
												class={`status-pill ${friendship.status === 'ACCEPTED' ? 'success' : friendship.status === 'PENDING' ? 'warning' : 'danger'}`}
											>
												{friendshipStatusLabels[friendship.status] ?? friendship.status}
											</span>
											{#if friendship.blockedByMe}
												<span class="status-pill danger">{$t('friends.blocked')}</span>
											{/if}
										</div>
									</div>
									<button
										type="button"
										class="button button-neutral small"
										on:click={() => selectFriend(friendship)}
									>
										{$t('friends.view')}
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</section>
			</div>

			<div class="column column-right">
				<section class="card">
					<div class="card-header">
						<h3>{$t('friends.detailsTitle')}</h3>
						<p class="card-hint">{$t('friends.detailsHint')}</p>
					</div>
					{#if !selectedFriendship}
						<div class="hint">{$t('friends.selectFriend')}</div>
					{:else}
						<div class="friend-detail">
							<h4>{selectedFriendship.friend.username}</h4>
							<div class="status-group">
								<span
									class={`status-pill ${selectedFriendship.status === 'ACCEPTED' ? 'success' : selectedFriendship.status === 'PENDING' ? 'warning' : 'danger'}`}
								>
									{friendshipStatusLabels[selectedFriendship.status] ?? selectedFriendship.status}
								</span>
								{#if selectedFriendship.blockedByMe}
									<span class="status-pill danger">{$t('friends.blocked')}</span>
								{/if}
							</div>
							{#if selectedFriendship.status === 'ACCEPTED' && !selectedFriendship.blockedByMe}
								<div class="button-grid">
									<button
										type="button"
										class="button button-accent"
										on:click={() => startFriendMatch(selectedFriendship, 'CLASSIC')}
									>
										{$t('friends.startClassic')}
									</button>
									<button
										type="button"
										class="button button-accent"
										on:click={() => startFriendMatch(selectedFriendship, 'ATTRIBUTE_DUEL')}
									>
										{$t('friends.startDuel')}
									</button>
									<button
										type="button"
										class="button button-neutral"
										on:click={() => selectFriend(selectedFriendship)}
									>
										{$t('friends.openChat')}
									</button>
								</div>
							{/if}
							<div class="button-grid secondary">
								<button
									type="button"
									class="button button-ghost"
									on:click={() => removeFriend(selectedFriendship.friendshipId)}
								>
									{$t('friends.removeFriend')}
								</button>
								<button
									type="button"
									class="button button-danger"
									on:click={() => blockFriend(selectedFriendship.friend.id)}
								>
									{$t('friends.blockPlayer')}
								</button>
							</div>
						</div>
					{/if}
				</section>

				<section class="card chat-card">
					<div class="card-header">
						<h3>{$t('friends.chatTitle')}</h3>
						<p class="card-hint">{$t('friends.chatHint')}</p>
					</div>
					{#if !selectedFriendship}
						<div class="hint">{$t('friends.chatPickFriend')}</div>
					{:else}
						<div class="chat-panel">
							{#if chatLoading}
								<div class="hint">{$t('friends.chatLoading')}</div>
							{:else if chatMessages.length === 0}
								<div class="hint">{$t('friends.noMessages')}</div>
							{:else}
								<ul class="chat-list">
									{#each chatMessages as message}
										<li class:mine={message.senderId === currentUserId}>
											<div class="bubble">
												<p>{message.body}</p>
												<span class="timestamp">{new Date(message.createdAt).toLocaleString()}</span
												>
											</div>
										</li>
									{/each}
								</ul>
							{/if}

							<form
								class="chat-form"
								on:submit|preventDefault={() =>
									selectedFriendship && sendChatMessage(selectedFriendship)}
							>
								<input
									type="text"
									placeholder={$t('friends.messagePlaceholder')}
									bind:value={chatMessageDraft}
									disabled={!selectedFriendship || selectedFriendship.blockedByMe}
								/>
								<button
									type="submit"
									class="button button-accent"
									disabled={!chatMessageDraft.trim() ||
										!selectedFriendship ||
										selectedFriendship.blockedByMe}
								>
									{$t('friends.send')}
								</button>
							</form>
						</div>
					{/if}
				</section>
			</div>
		</div>
	</div>
</div>
