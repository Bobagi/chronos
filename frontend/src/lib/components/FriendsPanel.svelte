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
					text: 'Your Chronos session expired. Please sign in again to manage friends.',
					tone: 'warning'
				};
			}

			if (error.status === 500 && error.path.startsWith('/friends')) {
				return {
					text: 'Chronos backend is missing the friendship tables. Execute the latest Prisma migrations in Chronos (e.g. pnpm prisma migrate deploy) and seed the database before testing the friends features.',
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
			const notice = interpretFriendServiceError(error, 'Unable to load friend data.');
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
			announceFriendServiceIssue(error, 'Failed to search players.');
		} finally {
			searchInFlight = false;
		}
	}

	async function sendRequest(targetId: string) {
		try {
			await sendChronosFriendRequest(targetId);
			await loadInitialData();
			scheduleEphemeralNotice({ text: 'Friend request sent.', tone: 'success' });
		} catch (error) {
			console.error('Failed to send friend request', error);
			announceFriendServiceIssue(error, 'Unable to send friend request.');
		}
	}

	async function handleRequestResponse(friendshipId: string, accept: boolean) {
		try {
			await respondChronosFriendRequest(friendshipId, accept);
			await loadInitialData();
			dispatch('refreshDashboard');
			scheduleEphemeralNotice({
				text: accept ? 'Friend request accepted.' : 'Friend request dismissed.',
				tone: 'success'
			});
		} catch (error) {
			console.error('Failed to resolve friend request', error);
			announceFriendServiceIssue(error, 'Unable to resolve friend request.');
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
			scheduleEphemeralNotice({ text: 'Friend removed.', tone: 'info' });
		} catch (error) {
			console.error('Failed to remove friend', error);
			announceFriendServiceIssue(error, 'Unable to remove friend.');
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
			scheduleEphemeralNotice({ text: 'Player blocked.', tone: 'info' });
		} catch (error) {
			console.error('Failed to block player', error);
			announceFriendServiceIssue(error, 'Unable to block player.');
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
			announceFriendServiceIssue(error, 'Unable to load chat history.');
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
			announceFriendServiceIssue(error, 'Unable to send message.');
		}
	}

	async function startFriendMatch(friendship: ChronosFriendSummary, mode: GameMode) {
		if (friendship.status !== 'ACCEPTED' || friendship.blockedByMe) return;
		try {
			const { gameId } = await startChronosGameWithFriend(friendship.friend.id, mode);
			dispatch('navigateToGame', { gameId, mode });
			dispatch('refreshDashboard');
			scheduleEphemeralNotice({ text: 'Match created.', tone: 'success' });
		} catch (error) {
			console.error('Failed to start friend match', error);
			announceFriendServiceIssue(error, 'Unable to start match with friend.');
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
</script>

<div class="friends-overlay" role="dialog" aria-modal="true">
	<div class="friends-panel">
		<header class="friends-header">
			<h2>Allies & Rivals</h2>
			<button
				type="button"
				class="button button-ghost small"
				on:click={() => dispatch('close')}
				aria-label="Close friends panel"
			>
				✕ Close
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
						<h3>Search players</h3>
						<p class="card-hint">Challenge someone new or send a request.</p>
					</div>
					<form class="search-form" on:submit|preventDefault={searchPlayers}>
						<input
							type="search"
							placeholder="Search usernames"
							bind:value={searchTerm}
							aria-label="Search players"
						/>
						<button type="submit" class="button button-accent" disabled={searchInFlight}
							>Search</button
						>
					</form>
					{#if searchInFlight}
						<div class="hint">Searching…</div>
					{:else if searchResults.length === 0 && searchTerm.trim()}
						<div class="hint">No players found.</div>
					{:else if searchResults.length > 0}
						<ul class="list">
							{#each searchResults as user}
								<li class="list-item">
									<div class="list-primary">
										<strong>{user.username}</strong>
										{#if isSelf(user.id)}
											<span class="status-pill neutral">You</span>
										{/if}
									</div>
									<button
										type="button"
										class="button button-accent small"
										disabled={isSelf(user.id)}
										on:click={() => sendRequest(user.id)}
									>
										Send request
									</button>
								</li>
							{/each}
						</ul>
					{/if}
				</section>

				<section class="card">
					<div class="card-header">
						<h3>Incoming requests</h3>
						<p class="card-hint">Respond to challengers awaiting your answer.</p>
					</div>
					{#if requests.length === 0}
						<div class="hint">No pending requests.</div>
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
											Accept
										</button>
										<button
											type="button"
											class="button button-ghost small"
											on:click={() => handleRequestResponse(request.friendshipId, false)}
										>
											Dismiss
										</button>
									</div>
								</li>
							{/each}
						</ul>
					{/if}
				</section>

				<section class="card">
					<div class="card-header">
						<h3>Friends roster</h3>
						<p class="card-hint">Manage alliances, duels, and rivalries.</p>
					</div>
					{#if friends.length === 0}
						<div class="hint">You have no allies yet. Send a request above.</div>
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
												{friendship.status}
											</span>
											{#if friendship.blockedByMe}
												<span class="status-pill danger">Blocked</span>
											{/if}
										</div>
									</div>
									<button
										type="button"
										class="button button-neutral small"
										on:click={() => selectFriend(friendship)}
									>
										View
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
						<h3>Friend details</h3>
						<p class="card-hint">Invite to a battle or manage your connection.</p>
					</div>
					{#if !selectedFriendship}
						<div class="hint">Select a friend to see more options.</div>
					{:else}
						<div class="friend-detail">
							<h4>{selectedFriendship.friend.username}</h4>
							<div class="status-group">
								<span
									class={`status-pill ${selectedFriendship.status === 'ACCEPTED' ? 'success' : selectedFriendship.status === 'PENDING' ? 'warning' : 'danger'}`}
								>
									{selectedFriendship.status}
								</span>
								{#if selectedFriendship.blockedByMe}
									<span class="status-pill danger">Blocked</span>
								{/if}
							</div>
							{#if selectedFriendship.status === 'ACCEPTED' && !selectedFriendship.blockedByMe}
								<div class="button-grid">
									<button
										type="button"
										class="button button-accent"
										on:click={() => startFriendMatch(selectedFriendship, 'CLASSIC')}
									>
										Start classic match
									</button>
									<button
										type="button"
										class="button button-accent"
										on:click={() => startFriendMatch(selectedFriendship, 'ATTRIBUTE_DUEL')}
									>
										Start duel
									</button>
									<button
										type="button"
										class="button button-neutral"
										on:click={() => selectFriend(selectedFriendship)}
									>
										Open chat
									</button>
								</div>
							{/if}
							<div class="button-grid secondary">
								<button
									type="button"
									class="button button-ghost"
									on:click={() => removeFriend(selectedFriendship.friendshipId)}
								>
									Remove friend
								</button>
								<button
									type="button"
									class="button button-danger"
									on:click={() => blockFriend(selectedFriendship.friend.id)}
								>
									Block player
								</button>
							</div>
						</div>
					{/if}
				</section>

				<section class="card chat-card">
					<div class="card-header">
						<h3>Friend chat</h3>
						<p class="card-hint">Exchange messages with your allies.</p>
					</div>
					{#if !selectedFriendship}
						<div class="hint">Pick a friend from the roster to view your chat history.</div>
					{:else}
						<div class="chat-panel">
							{#if chatLoading}
								<div class="hint">Loading chat…</div>
							{:else if chatMessages.length === 0}
								<div class="hint">No messages yet.</div>
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
									placeholder="Type a message"
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
									Send
								</button>
							</form>
						</div>
					{/if}
				</section>
			</div>
		</div>
	</div>
</div>
