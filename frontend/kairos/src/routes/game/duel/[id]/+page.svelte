<script lang="ts">
	import { browser } from '$app/environment';
	import { page as sveltePageStore } from '$app/stores';
	import {
		advanceChronosDuel,
		chooseChronosDuelAttribute,
		chooseChronosDuelCard,
		fetchChronosCardCatalog,
		fetchChronosGameResult,
		fetchChronosGameStateById,
		fetchMultipleChronosCardMetadata,
		surrenderChronosGame,
		unchooseChronosDuelCard
	} from '$lib/api/GameClient';
	import CardComposite from '$lib/components/CardComposite.svelte';
	import DeckStack from '$lib/components/DeckStack.svelte';
	import { authUser } from '$lib/stores/authStore';
	import { game as gameStateStore, type GameState } from '$lib/stores/game';
	import '$lib/styles/routes/gameDuelPage.css';
	import { onDestroy, onMount } from 'svelte';
	import '../../game.css';

	export const REVEAL_PAUSE_MS = 3000;
	export const DRAW_TRAVEL_MS = 420;
	export const FLIP_MS = 500;
	export const LOSER_SHAKE_BEFORE_DEFEAT_EFFECT_MS = 2000;
	export const DEFEAT_EFFECT_DURATION_MS = 2200;
	export const REVEAL_EXTRA_BUFFER_MS = 400;

	type CardDetails = {
		code: string;
		name: string;
		description: string;
		imageUrl: string;
		might: number;
		fire: number;
		magic: number;
		number: number;
	};

	let frameOverlayImageUrl: string | null = '/frames/default.png';
	const titleOverlayImageUrl = '/frames/title.png';
	const cardBackImageUrl = '/frames/card-back.png';

	let errorMessageText: string | null = null;
	let finalGameResult: { winner: string | null; log: string[] } | null = null;

	type RawDuelCenterPayload = GameState['duelCenter'] | Record<string, unknown> | null | undefined;

	function coerceNullableString(value: unknown): string | null {
		if (typeof value === 'string') {
			const trimmed = value.trim();
			return trimmed.length ? trimmed : null;
		}
		return null;
	}

	function coerceNullableNumber(value: unknown): number | null {
		if (typeof value === 'number' && Number.isFinite(value)) {
			return value;
		}
		if (typeof value === 'string') {
			const trimmed = value.trim();
			if (!trimmed) return null;
			const parsed = Number(trimmed);
			return Number.isFinite(parsed) ? parsed : null;
		}
		return null;
	}

	function coerceBoolean(value: unknown): boolean | null {
		if (typeof value === 'boolean') return value;
		if (typeof value === 'number') return value !== 0;
		if (typeof value === 'string') {
			const normalized = value.trim().toLowerCase();
			if (!normalized) return null;
			if (['true', '1', 'yes', 'y', 'on', 'revealed'].includes(normalized)) return true;
			if (['false', '0', 'no', 'n', 'off', 'hidden'].includes(normalized)) return false;
		}
		return null;
	}

	function extractCardCodeFromUnknown(value: unknown): string | null {
		if (typeof value === 'string') {
			const trimmed = value.trim();
			return trimmed.length ? trimmed : null;
		}
		if (typeof value === 'number' && Number.isFinite(value)) {
			return value.toString();
		}
		if (value && typeof value === 'object') {
			const record = value as Record<string, unknown>;
			const candidateKeys = ['code', 'cardCode', 'card', 'card_id', 'cardId'];
			for (const key of candidateKeys) {
				if (key in record) {
					const nestedValue = record[key];
					const resolved = extractCardCodeFromUnknown(nestedValue);
					if (resolved) return resolved;
				}
			}
		}
		return null;
	}

	function resolveCardCodeFromCenter(
		record: Record<string, unknown>,
		keys: string[]
	): string | null {
		for (const key of keys) {
			if (key in record) {
				const resolved = extractCardCodeFromUnknown(record[key]);
				if (resolved) return resolved;
			}
			const snakeCaseKey = key
				.replace(/([A-Z])/g, '_$1')
				.replace(/_{2,}/g, '_')
				.toLowerCase();
			if (snakeCaseKey in record) {
				const resolved = extractCardCodeFromUnknown(record[snakeCaseKey]);
				if (resolved) return resolved;
			}
		}
		return null;
	}

	function normalizeAttributeName(value: unknown): 'magic' | 'might' | 'fire' | null {
		const normalized = (value ?? '').toString().trim().toLowerCase();
		if (!normalized) return null;
		if (normalized.startsWith('mag')) return 'magic';
		if (
			normalized.startsWith('mig') ||
			normalized.startsWith('str') ||
			normalized.includes('forc') ||
			normalized.includes('power')
		) {
			return 'might';
		}
		if (
			normalized.startsWith('fir') ||
			normalized.includes('fogo') ||
			normalized.includes('pyro')
		) {
			return 'fire';
		}
		if (normalized === 'magic' || normalized === 'might' || normalized === 'fire') {
			return normalized as 'magic' | 'might' | 'fire';
		}
		return null;
	}

	function normalizeRoundWinnerIdentity(
		rawWinner: unknown,
		orderedPlayerIds: string[],
		usernameMap: Record<string, string> | undefined | null
	): string | null {
		const winnerText = coerceNullableString(rawWinner);
		if (!winnerText) return null;
		const normalized = winnerText.trim().toLowerCase();
		const sanitized = normalized.replace(/[^a-z0-9]/g, '');
		const drawSynonyms = ['draw', 'tie', 'empate'];
		if (drawSynonyms.includes(sanitized)) {
			return 'DRAW';
		}

		const aliasMap = new Map<string, string>();
		const addAlias = (alias: string | null | undefined, canonical: string) => {
			if (!alias) return;
			const key = alias.toLowerCase().replace(/[^a-z0-9]/g, '');
			if (!key) return;
			if (!aliasMap.has(key)) {
				aliasMap.set(key, canonical);
			}
		};

		orderedPlayerIds.forEach((playerId, index) => {
			if (!playerId) return;
			addAlias(playerId, playerId);
			if (usernameMap && usernameMap[playerId]) {
				addAlias(usernameMap[playerId], playerId);
			}
			if (index === 0) {
				addAlias('playerA', playerId);
				addAlias('player_a', playerId);
				addAlias('player1', playerId);
				addAlias('jogador1', playerId);
			} else if (index === 1) {
				addAlias('playerB', playerId);
				addAlias('player_b', playerId);
				addAlias('player2', playerId);
				addAlias('jogador2', playerId);
			}
		});

		const resolved = aliasMap.get(sanitized);
		return resolved ?? null;
	}

	function normalizeDuelCenterPayload(
		rawCenter: RawDuelCenterPayload,
		orderedPlayerIds: string[],
		usernameMap: Record<string, string> | undefined | null
	): GameState['duelCenter'] | null {
		if (!rawCenter || typeof rawCenter !== 'object') {
			return rawCenter ?? null;
		}
		const record = rawCenter as Record<string, unknown>;
		const normalizedCenter: GameState['duelCenter'] = {};

		const aCardCode = resolveCardCodeFromCenter(record, [
			'aCardCode',
			'aCard',
			'playerACard',
			'playerA',
			'cardA',
			'slotA',
			'firstCard',
			'card1',
			'playerACardCode',
			'cardCodeA'
		]);
		if (aCardCode) normalizedCenter.aCardCode = aCardCode;

		const bCardCode = resolveCardCodeFromCenter(record, [
			'bCardCode',
			'bCard',
			'playerBCard',
			'playerB',
			'cardB',
			'slotB',
			'secondCard',
			'card2',
			'playerBCardCode',
			'cardCodeB'
		]);
		if (bCardCode) normalizedCenter.bCardCode = bCardCode;

		const chosenAttr = normalizeAttributeName(
			record.chosenAttribute ??
				record.attribute ??
				record.attributeName ??
				record.attr ??
				record.chosenAttr ??
				record.attributeCode ??
				record.attributeChoice ??
				record.chosen_attribute ??
				record.attribute_name ??
				record.attribute_code ??
				record.attribute_choice
		);
		if (chosenAttr) normalizedCenter.chosenAttribute = chosenAttr;

		const revealed = coerceBoolean(
			record.revealed ?? record.cardsRevealed ?? record.showdownRevealed ?? record.cards_revealed
		);
		if (revealed !== null) normalizedCenter.revealed = revealed;

		const chooserId = coerceNullableString(
			record.chooserId ??
				record.chooser ??
				record.currentChooser ??
				record.playerChoosing ??
				record.chooser_id ??
				record.current_chooser ??
				record.player_choosing
		);
		if (chooserId) normalizedCenter.chooserId = chooserId;

		const deadlineAt = coerceNullableNumber(
			record.deadlineAt ??
				record.deadline ??
				record.deadlineTime ??
				record.attributeDeadline ??
				record.deadline_at ??
				record.deadline_time ??
				record.attribute_deadline
		);
		if (deadlineAt !== null) normalizedCenter.deadlineAt = deadlineAt;

		const aVal = coerceNullableNumber(
			record.aVal ?? record.aValue ?? record.valueA ?? record.a_val
		);
		if (aVal !== null) normalizedCenter.aVal = aVal;

		const bVal = coerceNullableNumber(
			record.bVal ?? record.bValue ?? record.valueB ?? record.b_val
		);
		if (bVal !== null) normalizedCenter.bVal = bVal;

		const roundWinner =
			normalizeRoundWinnerIdentity(
				record.roundWinner ??
					record.winner ??
					record.roundVictory ??
					record.duelRoundWinner ??
					record.round_winner ??
					record.duel_round_winner,
				orderedPlayerIds,
				usernameMap
			) ?? null;
		normalizedCenter.roundWinner = roundWinner;

		return normalizedCenter;
	}

	function coerceDiscardPileRecord(value: unknown): Record<string, string[]> | null {
		if (!value || typeof value !== 'object') {
			return null;
		}
		const record = value as Record<string, unknown>;
		const normalized: Record<string, string[]> = {};
		let hasEntries = false;
		for (const [playerId, pile] of Object.entries(record)) {
			if (!Array.isArray(pile)) continue;
			const validCards = pile.filter((card): card is string => typeof card === 'string');
			normalized[playerId] = validCards;
			hasEntries = true;
		}
		return hasEntries ? normalized : null;
	}

	function normalizeDiscardPilesPayload(state: GameState): Record<string, string[]> | null {
		if (state.discardPiles && typeof state.discardPiles === 'object') {
			return state.discardPiles;
		}
		const fallback = (state as Record<string, unknown>).discard_piles;
		return coerceDiscardPileRecord(fallback);
	}

	function normalizeGameStateFromServer(state: GameState): GameState {
		if (state.mode !== 'ATTRIBUTE_DUEL') {
			return state;
		}
		let normalizedState = state;
		const normalizedCenter = normalizeDuelCenterPayload(
			state.duelCenter,
			state.players,
			state.playerUsernames ?? null
		);
		if (normalizedCenter !== state.duelCenter) {
			normalizedState = {
				...normalizedState,
				duelCenter: normalizedCenter
			};
		}

		const normalizedDiscardPiles = normalizeDiscardPilesPayload(state);
		if (normalizedDiscardPiles && normalizedDiscardPiles !== state.discardPiles) {
			normalizedState = {
				...normalizedState,
				discardPiles: normalizedDiscardPiles
			};
		}

		return normalizedState;
	}

	$: currentGameId = $sveltePageStore.params.id;
	$: currentDuelCenter = $gameStateStore?.duelCenter ?? null;
	$: currentDuelStage = $gameStateStore?.duelStage ?? null;
	$: currentDuelRoundWinner = currentDuelCenter?.roundWinner ?? null;
	const cardWidthCssValue = 'clamp(104px, 17.5vw, 200px)';

	let now = Date.now();
	let duelTimerHandle: ReturnType<typeof setInterval> | null = null;
	let duelTimeoutSignature: string | null = null;
	let duelTimeoutHandledForSignature = false;
	let duelTimeoutResolver: Promise<void> | null = null;

	function formatRemainingTime(milliseconds: number): string {
		const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
		const minutes = Math.floor(totalSeconds / 60);
		const seconds = totalSeconds % 60;
		return `${minutes}:${seconds.toString().padStart(2, '0')}`;
	}

	type HandCardItem = {
		code: string;
		uid: string;
		name?: string;
		description?: string;
		imageUrl?: string;
		might?: number;
		fire?: number;
		magic?: number;
		number: number;
	};

	let playerHandCardItems: HandCardItem[] = [];
	let pendingCardRevealUidSet = new Set<string>();
	let pendingHiddenUidSet = new Set<string>();
	let autoFlipCycleCounter = 0;

	let centerRevealCycle = 0;
	let advanceTimer: number | null = null;

	let fxLayerElement: HTMLDivElement | null = null;
	let playerDeckAnchorElement: HTMLDivElement | null = null;
	let opponentDeckAnchorElement: HTMLDivElement | null = null;
	let opponentHandContainerElement: HTMLDivElement | null = null;
	let centerSlotAElement: HTMLDivElement | null = null;
	let centerSlotBElement: HTMLDivElement | null = null;
	let lastDefeatEffectCycleId: number | null = null;

	let hasInitialStateLoaded = false;
	let previousOppHandCount: number | null = null;

	let playerA: string = 'playerA';
	let playerB: string = 'playerB';
	let playerAUsername: string = 'playerA';
	let playerBUsername: string = 'playerB';

	let historyScrollContainerElement: HTMLDivElement | null = null;
	let lastReturnedCode: string | null = null;
	let lastAppliedLogLength = -1;
	let provisionalRevealHistoryEntries: string[] = [];
	let lastProvisionalRevealCycleId: number | null = null;
	let lastAcknowledgedOfficialLogLength = 0;
	let officialHistoryLogEntries: string[] = [];
	let combinedHistoryLogEntries: string[] = [];

	type LogCategory = 'player' | 'opponent' | 'neutral';

	function getLogPresentation(line: string): {
		category: LogCategory;
		icon: string;
		text: string;
	} {
		const safeLine = line ?? '';
		const normalizedLine = safeLine.toLowerCase();
		const normalizedPlayer = (playerAUsername ?? '').toLowerCase();
		const normalizedOpponent = (playerBUsername ?? '').toLowerCase();

		const victoryMatch = safeLine.match(/victory:\s*([^]+?) defeats/i);
		if (victoryMatch && victoryMatch[1]) {
			const winnerText = victoryMatch[1].toLowerCase();
			if (normalizedPlayer && winnerText.includes(normalizedPlayer)) {
				return { category: 'player', icon: '🛡️', text: safeLine };
			}
			if (normalizedOpponent && winnerText.includes(normalizedOpponent)) {
				return { category: 'opponent', icon: '⚔️', text: safeLine };
			}
		}

		if (normalizedPlayer && normalizedLine.includes(normalizedPlayer)) {
			return { category: 'player', icon: '🛡️', text: safeLine };
		}
		if (normalizedOpponent && normalizedLine.includes(normalizedOpponent)) {
			return { category: 'opponent', icon: '⚔️', text: safeLine };
		}
		return { category: 'neutral', icon: '✨', text: safeLine };
	}

	function formatCardNameForHistory(cardCode: string | undefined | null): string | null {
		if (!cardCode) return null;
		const details = cardDetailsCacheByCode.get(cardCode);
		if (details?.name) return details.name;
		return cardCode;
	}

	function formatAttributeLabel(attribute: 'fire' | 'magic' | 'might'): {
		label: string;
		icon: string;
	} {
		if (attribute === 'fire') {
			return { label: 'Fire', icon: '🔥' };
		}
		if (attribute === 'magic') {
			return { label: 'Magic', icon: '🪄' };
		}
		return { label: 'Might', icon: '💪' };
	}

	function buildProvisionalHistoryLineForReveal(
		center: NonNullable<GameState['duelCenter']>,
		roundWinner: string | null
	): string | null {
		const attributeMode = detectChosenAttributeMode(center);
		const { label: attributeLabel, icon: attributeIcon } = formatAttributeLabel(attributeMode);
		const playerACardCode = center.aCardCode ?? null;
		const playerBCardCode = center.bCardCode ?? null;
		const playerACard = playerACardCode
			? (cardDetailsCacheByCode.get(playerACardCode) ?? null)
			: null;
		const playerBCard = playerBCardCode
			? (cardDetailsCacheByCode.get(playerBCardCode) ?? null)
			: null;
		const playerACardName = formatCardNameForHistory(playerACardCode);
		const playerBCardName = formatCardNameForHistory(playerBCardCode);
		const playerAStat = playerACard ? (playerACard[attributeMode] ?? null) : null;
		const playerBStat = playerBCard ? (playerBCard[attributeMode] ?? null) : null;

		if (!roundWinner || roundWinner === 'DRAW') {
			const statText =
				typeof playerAStat === 'number' && typeof playerBStat === 'number'
					? ` (${playerAStat} vs ${playerBStat})`
					: '';
			const cardNamesText =
				playerACardName && playerBCardName
					? ` between ${playerACardName} and ${playerBCardName}`
					: '';
			return `${attributeIcon} ${attributeLabel} tie: ${playerAUsername} and ${playerBUsername}${cardNamesText}${statText}.`;
		}

		const isPlayerAWinner = roundWinner === playerA;
		const winnerName = isPlayerAWinner
			? playerAUsername
			: roundWinner === playerB
				? playerBUsername
				: roundWinner;
		const loserName = isPlayerAWinner ? playerBUsername : playerAUsername;
		const winnerCardCode = isPlayerAWinner ? playerACardCode : playerBCardCode;
		const loserCardCode = isPlayerAWinner ? playerBCardCode : playerACardCode;
		const winnerCard = winnerCardCode ? (cardDetailsCacheByCode.get(winnerCardCode) ?? null) : null;
		const loserCard = loserCardCode ? (cardDetailsCacheByCode.get(loserCardCode) ?? null) : null;
		const winnerStat = winnerCard ? (winnerCard[attributeMode] ?? null) : null;
		const loserStat = loserCard ? (loserCard[attributeMode] ?? null) : null;
		const statSummary =
			typeof winnerStat === 'number' && typeof loserStat === 'number'
				? ` (${winnerStat} vs ${loserStat})`
				: '';
		const winnerCardName = isPlayerAWinner ? playerACardName : playerBCardName;
		const loserCardName = isPlayerAWinner ? playerBCardName : playerACardName;
		const cardSummary =
			winnerCardName && loserCardName
				? ` with ${winnerCardName} against ${loserCardName}`
				: winnerCardName
					? ` with ${winnerCardName}`
					: '';
		return `${attributeIcon} ${attributeLabel} victory: ${winnerName} defeats ${loserName}${cardSummary}${statSummary}.`;
	}

	function isHighlightedAttribute(attr: 'magic' | 'might' | 'fire'): boolean {
		if (!chooserCardDetails) return false;
		const stats = {
			magic: chooserCardDetails.magic ?? 0,
			might: chooserCardDetails.might ?? 0,
			fire: chooserCardDetails.fire ?? 0
		};
		const highest = Math.max(stats.magic, stats.might, stats.fire);
		return stats[attr] === highest && highest > 0;
	}

	function resolveStrongestAttributeFromDetails(
		details: Pick<CardDetails, 'magic' | 'might' | 'fire'> | null | undefined
	): 'magic' | 'might' | 'fire' | null {
		if (!details) return null;
		const stats: Record<'magic' | 'might' | 'fire', number> = {
			magic: Number(details.magic ?? 0),
			might: Number(details.might ?? 0),
			fire: Number(details.fire ?? 0)
		};
		let best: 'magic' | 'might' | 'fire' = 'magic';
		let bestValue = -Infinity;
		for (const attribute of ['magic', 'might', 'fire'] as const) {
			const value = stats[attribute];
			if (value > bestValue) {
				best = attribute;
				bestValue = value;
			}
		}
		return bestValue > -Infinity ? best : null;
	}

	function resolveStrongestAttributeForCard(
		cardCode: string | null | undefined
	): 'magic' | 'might' | 'fire' | null {
		if (!cardCode) return null;
		const details = cardDetailsCacheByCode.get(cardCode) ?? null;
		return resolveStrongestAttributeFromDetails(details);
	}

	function resolvePreferredAttributeForChooser(
		chooser: string | null | undefined
	): 'magic' | 'might' | 'fire' {
		const cardCode = chooser
			? chooser === playerA
				? (currentDuelCenter?.aCardCode ?? null)
				: (currentDuelCenter?.bCardCode ?? null)
			: null;
		const preferred =
			resolveStrongestAttributeForCard(cardCode) ??
			resolveStrongestAttributeFromDetails(chooser === playerA ? chooserCardDetails : null);
		return preferred ?? 'magic';
	}

	function isBotIdentity(
		playerId: string | null | undefined,
		username: string | null | undefined
	): boolean {
		const normalizedId = (playerId ?? '').trim().toUpperCase();
		if (normalizedId === 'BOT') return true;
		const normalizedName = (username ?? '').toLowerCase();
		return /\bbot\b/.test(normalizedName);
	}

	const makeUid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

	function reconcile(prev: HandCardItem[], nextCodes: string[]) {
		const buckets = new Map<string, HandCardItem[]>();
		for (const it of prev) {
			const arr = buckets.get(it.code) ?? [];
			arr.push(it);
			buckets.set(it.code, arr);
		}
		const created: string[] = [];
		const items: HandCardItem[] = [];
		for (const code of nextCodes) {
			const q = buckets.get(code);
			if (q && q.length) {
				items.push(q.shift() as HandCardItem);
			} else {
				const uid = makeUid();
				items.push({ code, uid, number: 1 });
				created.push(uid);
			}
		}
		return { items, created };
	}

	let cardDetailsCacheByCode = new Map<string, CardDetails>();
	let catalogNumberByCode = new Map<string, number>();
	let catalogLoaded = false;
	let chooserCardDetails: CardDetails | null = null;

	async function ensureCatalogLoaded() {
		if (catalogLoaded) return;
		try {
			const catalogCollections = await fetchChronosCardCatalog();
			for (const collection of catalogCollections) {
				for (const catalogEntry of collection.cards) {
					catalogNumberByCode.set(catalogEntry.code, catalogEntry.number);
				}
			}
		} finally {
			catalogLoaded = true;
		}
	}

	async function ensureCodesCached(codes: string[]) {
		const missingCodes = codes.filter((code) => {
			const cachedCard = cardDetailsCacheByCode.get(code);
			return !cachedCard || Number.isNaN(cachedCard.number);
		});
		if (!missingCodes.length) return;

		await ensureCatalogLoaded();

		const chronosCards = await fetchMultipleChronosCardMetadata(missingCodes);
		for (const chronosCard of chronosCards) {
			const resolvedNumber = chronosCard.number || catalogNumberByCode.get(chronosCard.code) || 0;
			cardDetailsCacheByCode.set(chronosCard.code, {
				code: chronosCard.code,
				name: chronosCard.name,
				description: chronosCard.description,
				imageUrl: chronosCard.image,
				might: chronosCard.might,
				fire: chronosCard.fire,
				magic: chronosCard.magic,
				number: resolvedNumber
			});
		}
		cardDetailsCacheByCode = new Map(cardDetailsCacheByCode);
	}

	function startDrawFx(fromEl: Element | null, toEl: Element | null, copies: number): number {
		if (!fromEl || !toEl || !fxLayerElement || copies <= 0) return 0;
		const fromRect = fromEl.getBoundingClientRect();
		const toRect = toEl.getBoundingClientRect();
		const fromCx = fromRect.left + fromRect.width / 2;
		const fromCy = fromRect.top + fromRect.height / 2;
		const toCx = toRect.left + toRect.width / 2;
		const toCy = toRect.top + toRect.height / 2;
		const dx = toCx - fromCx;
		const dy = toCy - fromCy;
		for (let i = 0; i < copies; i++) {
			const fxCardElement = document.createElement('div');
			fxCardElement.className = 'fx-card';
			fxCardElement.style.left = `${fromCx - fromRect.width / 2}px`;
			fxCardElement.style.top = `${fromCy - fromRect.height / 2}px`;
			fxCardElement.style.width = `${Math.min(fromRect.width, toRect.width)}px`;
			const fxImgElement = document.createElement('img');
			fxImgElement.src = cardBackImageUrl;
			fxImgElement.alt = '';
			fxCardElement.appendChild(fxImgElement);
			fxLayerElement.appendChild(fxCardElement);
			const rotateDeg = (Math.random() * 10 - 5).toFixed(2);
			const animation = fxCardElement.animate(
				[
					{ transform: 'translate(0px,0px) rotate(0deg)', opacity: 0.9 },
					{ transform: `translate(${dx}px,${dy}px) rotate(${rotateDeg}deg)`, opacity: 0.0 }
				],
				{ duration: DRAW_TRAVEL_MS, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'forwards' }
			);
			animation.onfinish = () => fxCardElement.remove();
		}
		return DRAW_TRAVEL_MS;
	}

	function addPendingFlipsFor(uids: string[]) {
		const next = new Set(pendingCardRevealUidSet);
		for (const u of uids) next.add(u);
		pendingCardRevealUidSet = next;
		autoFlipCycleCounter++;
	}

	function clearPendingFlipFor(uid: string) {
		const next = new Set(pendingCardRevealUidSet);
		next.delete(uid);
		pendingCardRevealUidSet = next;
	}

	function hideUids(uids: string[]) {
		const next = new Set(pendingHiddenUidSet);
		for (const u of uids) next.add(u);
		pendingHiddenUidSet = next;
	}

	function unhideUids(uids: string[]) {
		const next = new Set(pendingHiddenUidSet);
		for (const u of uids) next.delete(u);
		pendingHiddenUidSet = next;
	}

	async function loadGameStateOrFinalResult() {
		errorMessageText = null;
		try {
			const fetchedState = (await fetchChronosGameStateById(currentGameId)) as GameState | null;
			if (fetchedState && typeof fetchedState === 'object') {
				finalGameResult = null;
				const normalizedState = normalizeGameStateFromServer(fetchedState);
				gameStateStore.set({ ...normalizedState, gameId: currentGameId });

				const me = normalizedState.players[0];
				const opp = normalizedState.players[1] ?? 'playerB';

				const myCodes = Array.isArray(normalizedState.hands?.[me])
					? (normalizedState.hands[me] as string[])
					: [];
				const { items, created } = reconcile(playerHandCardItems, myCodes);
				playerHandCardItems = items;

				let createdFromUnchoose: string[] = [];
				if (lastReturnedCode) {
					createdFromUnchoose = playerHandCardItems
						.filter((it) => it.code === lastReturnedCode && created.includes(it.uid))
						.map((it) => it.uid);
				}
				const createdFromDeck = created.filter((uid) => !createdFromUnchoose.includes(uid));

				if (myCodes.length) await ensureCodesCached(myCodes);
				const centers: string[] = [];
				if (normalizedState.duelCenter?.aCardCode)
					centers.push(normalizedState.duelCenter.aCardCode);
				if (normalizedState.duelCenter?.bCardCode)
					centers.push(normalizedState.duelCenter.bCardCode);
				if (centers.length) await ensureCodesCached(centers);

				playerHandCardItems = playerHandCardItems.map((it) => {
					const d = cardDetailsCacheByCode.get(it.code);
					return d
						? {
								...it,
								name: d.name,
								description: d.description,
								imageUrl: d.imageUrl,
								might: d.might,
								fire: d.fire,
								magic: d.magic,
								number: d.number
							}
						: it;
				});

				const newOppCount = Array.isArray(normalizedState.hands?.[opp])
					? normalizedState.hands[opp].length
					: 0;

				if (normalizedState.mode === 'ATTRIBUTE_DUEL' && normalizedState.duelStage === 'REVEAL') {
					centerRevealCycle++;
					if (advanceTimer) window.clearTimeout(advanceTimer);
					advanceTimer = window.setTimeout(
						async () => {
							try {
								await advanceChronosDuel(currentGameId);
							} finally {
								await loadGameStateOrFinalResult();
							}
						},
						Math.max(
							REVEAL_PAUSE_MS,
							LOSER_SHAKE_BEFORE_DEFEAT_EFFECT_MS +
								DEFEAT_EFFECT_DURATION_MS +
								REVEAL_EXTRA_BUFFER_MS
						)
					);
				} else if (advanceTimer) {
					window.clearTimeout(advanceTimer);
					advanceTimer = null;
				}

				if (hasInitialStateLoaded) {
					if (createdFromDeck.length) {
						hideUids(createdFromDeck);
						const totalMs = startDrawFx(
							playerDeckAnchorElement,
							myHandContainerElement,
							createdFromDeck.length
						);
						window.setTimeout(() => {
							unhideUids(createdFromDeck);
							addPendingFlipsFor(createdFromDeck);
						}, totalMs);
					}
					if (createdFromUnchoose.length) {
						unhideUids(createdFromUnchoose);
					}
					if (previousOppHandCount !== null && newOppCount > previousOppHandCount) {
						startDrawFx(
							opponentDeckAnchorElement,
							opponentHandContainerElement,
							newOppCount - previousOppHandCount
						);
					}
				}

				previousOppHandCount = newOppCount;
				hasInitialStateLoaded = true;
				lastReturnedCode = null;
				return;
			}
		} catch {}
		try {
			finalGameResult = await fetchChronosGameResult(currentGameId);
		} catch {
			errorMessageText = 'Could not load game state';
		}
	}

	function isGameOver(): boolean {
		return Boolean(($gameStateStore?.winner ?? finalGameResult?.winner ?? null) !== null);
	}

	async function onHandCardClick(e: MouseEvent, cardCode: string) {
		const state = $gameStateStore;
		if (!state || isGameOver()) return;
		if (state.mode !== 'ATTRIBUTE_DUEL') return;
		if (state.duelCenter?.aCardCode) return;
		if (state.duelStage !== 'PICK_CARD') return;
		const me = state.players[0];
		await chooseChronosDuelCard(currentGameId, me, cardCode);
		await loadGameStateOrFinalResult();
	}

	async function onCenterCardReturnToHand() {
		const state = $gameStateStore;
		if (!state) return;
		if (state.mode !== 'ATTRIBUTE_DUEL') return;
		if (state.duelStage === 'REVEAL') return;
		if (!state.duelCenter?.aCardCode) return;
		const me = state.players[0];
		lastReturnedCode = state.duelCenter.aCardCode || null;
		await unchooseChronosDuelCard(currentGameId, me);
		await loadGameStateOrFinalResult();
	}

	async function surrenderDuelGame() {
		if (isGameOver()) return;
		if (!$authUser) {
			errorMessageText = 'Login required to surrender.';
			return;
		}
		if (browser && !window.confirm('Certeza que quer desistir?')) {
			return;
		}
		try {
			await surrenderChronosGame(currentGameId);
			await loadGameStateOrFinalResult();
		} catch (error) {
			console.error('Failed to surrender duel game', error);
			errorMessageText = 'Unable to surrender match.';
		}
	}

	async function chooseAttr(attr: 'magic' | 'might' | 'fire') {
		if (isGameOver()) return;
		const me = $gameStateStore?.players?.[0] ?? 'playerA';
		await chooseChronosDuelAttribute(currentGameId, me, attr);
		await loadGameStateOrFinalResult();
	}

	function detectChosenAttributeMode(
		center: GameState['duelCenter'] | null | undefined
	): 'fire' | 'magic' | 'might' {
		const rawAttributeText = (
			center?.chosenAttribute ??
			center?.attribute ??
			center?.attributeName ??
			center?.attr ??
			center?.chosenAttr ??
			''
		)
			.toString()
			.toLowerCase();
		if (rawAttributeText.includes('mag')) return 'magic';
		if (rawAttributeText.includes('fire')) return 'fire';
		if (
			rawAttributeText.includes('might') ||
			rawAttributeText.includes('strength') ||
			rawAttributeText.includes('power') ||
			rawAttributeText.includes('forc')
		) {
			return 'might';
		}
		return 'fire';
	}

	type FireDefeatParticle = {
		type: 'fire';
		px: number;
		py: number;
		vx: number;
		vy: number;
		life: number;
		maxLife: number;
		size: number;
		flickerSpeed: number;
	};

	type MagicDefeatParticle = {
		type: 'magic';
		angle: number;
		radius: number;
		angularVelocity: number;
		radiusVelocity: number;
		px: number;
		py: number;
		life: number;
		maxLife: number;
		size: number;
	};

	type MightDefeatParticle = {
		type: 'might';
		px: number;
		py: number;
		vx: number;
		vy: number;
		rotation: number;
		rotationVelocity: number;
		life: number;
		maxLife: number;
		width: number;
		height: number;
		notchOffsetLeft: number;
		notchOffsetRight: number;
		fractureDepth: number;
		baseAlpha: number;
	};

	type DefeatParticle = FireDefeatParticle | MagicDefeatParticle | MightDefeatParticle;

	function startAttributeThemedDefeatAnimationOnElement(
		targetEl: HTMLElement,
		mode: 'fire' | 'magic' | 'might',
		durationMs: number = DEFEAT_EFFECT_DURATION_MS
	) {
		if (!targetEl || targetEl.dataset.defeatEffectActive === '1') {
			return;
		}
		const boundingRect = targetEl.getBoundingClientRect();
		const deviceScale = Math.max(1, Math.min(window.devicePixelRatio || 1, 2.5));
		const canvasWidth = Math.max(2, Math.round(boundingRect.width * deviceScale));
		const canvasHeight = Math.max(2, Math.round(boundingRect.height * deviceScale));
		const overlayCanvas = document.createElement('canvas');
		overlayCanvas.width = canvasWidth;
		overlayCanvas.height = canvasHeight;
		overlayCanvas.style.position = 'absolute';
		overlayCanvas.style.inset = '0';
		overlayCanvas.style.width = '100%';
		overlayCanvas.style.height = '100%';
		overlayCanvas.style.pointerEvents = 'none';
		const targetBorderRadius = getComputedStyle(targetEl).borderRadius || '10px';
		overlayCanvas.style.borderRadius = targetBorderRadius;
		overlayCanvas.style.zIndex = '5';
		overlayCanvas.style.mixBlendMode = mode === 'might' ? 'hard-light' : 'screen';
		overlayCanvas.style.filter =
			mode === 'might'
				? 'brightness(1.05) contrast(1.25) saturate(1.1)'
				: 'brightness(1.15) saturate(1.35)';
		const overlayCtx = overlayCanvas.getContext('2d');
		if (!overlayCtx) return;

		const maskedContentWrapper = document.createElement('div');
		maskedContentWrapper.className = 'defeat-mask-wrapper';
		maskedContentWrapper.style.position = 'relative';
		maskedContentWrapper.style.inset = '0';
		maskedContentWrapper.style.width = '100%';
		maskedContentWrapper.style.height = '100%';
		maskedContentWrapper.style.borderRadius = targetBorderRadius;
		maskedContentWrapper.style.overflow = 'hidden';
		maskedContentWrapper.style.zIndex = '0';

		while (targetEl.firstChild) {
			maskedContentWrapper.appendChild(targetEl.firstChild);
		}
		targetEl.appendChild(maskedContentWrapper);
		targetEl.appendChild(overlayCanvas);

		const maskCanvas = document.createElement('canvas');
		maskCanvas.width = canvasWidth;
		maskCanvas.height = canvasHeight;
		const maskCtx = maskCanvas.getContext('2d');
		if (maskCtx) {
			maskCtx.fillStyle = '#ffffff';
			maskCtx.fillRect(0, 0, canvasWidth, canvasHeight);
		}

		type VendorMaskStyle = CSSStyleDeclaration & {
			webkitMaskImage?: string;
			webkitMaskSize?: string;
			webkitMaskRepeat?: string;
			webkitMaskPosition?: string;
		};
		const styleWithVendorMasks = maskedContentWrapper.style as VendorMaskStyle;
		const originalPositionStyle = targetEl.style.position;
		const computedPosition = getComputedStyle(targetEl).position;
		if (!computedPosition || computedPosition === 'static') {
			targetEl.style.position = 'relative';
		}

		targetEl.dataset.defeatEffectActive = '1';
		targetEl.classList.add('defeat-active', `defeat-${mode}`);

		let maskPendingUpload = false;
		let lastMaskUploadTimestamp = performance.now();
		const maskUploadIntervalMs = 60;
		const applyMaskTexture = (stamp?: number) => {
			if (!maskCtx) return;
			const maskDataUrl = maskCanvas.toDataURL('image/png');
			maskedContentWrapper.style.maskImage = `url(${maskDataUrl})`;
			maskedContentWrapper.style.maskSize = '100% 100%';
			maskedContentWrapper.style.maskRepeat = 'no-repeat';
			maskedContentWrapper.style.maskPosition = '0 0';
			maskedContentWrapper.style.maskMode = 'alpha';
			styleWithVendorMasks.webkitMaskImage = `url(${maskDataUrl})`;
			styleWithVendorMasks.webkitMaskSize = '100% 100%';
			styleWithVendorMasks.webkitMaskRepeat = 'no-repeat';
			styleWithVendorMasks.webkitMaskPosition = '0 0';
			maskPendingUpload = false;
			lastMaskUploadTimestamp = stamp ?? performance.now();
		};
		if (maskCtx) {
			applyMaskTexture();
		}

		const particleCount = Math.min(
			260,
			Math.max(110, Math.round((canvasWidth * canvasHeight) / 950))
		);
		const particles: DefeatParticle[] = [];

		const carveCircleIntoMask = (px: number, py: number, radiusPx: number, strength: number) => {
			if (!maskCtx) return;
			const effectiveStrength = Math.max(0.05, Math.min(1, strength));
			maskCtx.save();
			maskCtx.globalCompositeOperation = 'destination-out';
			const gradient = maskCtx.createRadialGradient(px, py, radiusPx * 0.25, px, py, radiusPx);
			gradient.addColorStop(0, `rgba(0, 0, 0, ${effectiveStrength})`);
			gradient.addColorStop(0.55, `rgba(0, 0, 0, ${effectiveStrength * 0.6})`);
			gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
			maskCtx.fillStyle = gradient;
			maskCtx.beginPath();
			maskCtx.arc(px, py, radiusPx, 0, Math.PI * 2);
			maskCtx.fill();
			maskCtx.restore();
			maskPendingUpload = true;
		};

		const carveImpactIntoMask = (
			px: number,
			py: number,
			widthPx: number,
			heightPx: number,
			rotation: number,
			strength: number
		) => {
			if (!maskCtx) return;
			const impactStrength = Math.max(0.05, Math.min(1, strength));
			maskCtx.save();
			maskCtx.translate(px, py);
			maskCtx.rotate(rotation);
			maskCtx.globalCompositeOperation = 'destination-out';
			maskCtx.fillStyle = `rgba(0, 0, 0, ${impactStrength})`;
			maskCtx.beginPath();
			maskCtx.moveTo(-widthPx * 0.5, heightPx * 0.5);
			maskCtx.lineTo(-widthPx * 0.2, -heightPx * 0.4);
			maskCtx.lineTo(widthPx * 0.15, -heightPx * 0.2);
			maskCtx.lineTo(widthPx * 0.5, heightPx * 0.5);
			maskCtx.closePath();
			maskCtx.fill();
			maskCtx.restore();
			maskPendingUpload = true;
		};

		const spawnFireParticle = (): FireDefeatParticle => ({
			type: 'fire',
			px: Math.random(),
			py: 0.55 + Math.random() * 0.4,
			vx: (Math.random() - 0.5) * 0.24,
			vy: -0.55 - Math.random() * 0.42,
			life: 0,
			maxLife: 0.85 + Math.random() * 1.1,
			size: 0.07 + Math.random() * 0.11,
			flickerSpeed: 6 + Math.random() * 7
		});

		const spawnMagicParticle = (): MagicDefeatParticle => {
			const baseRadius = 0.06 + Math.random() * 0.32;
			return {
				type: 'magic',
				angle: Math.random() * Math.PI * 2,
				radius: baseRadius,
				angularVelocity: (Math.random() * 1.6 + 0.7) * (Math.random() > 0.5 ? 1 : -1),
				radiusVelocity: 0.22 + Math.random() * 0.28,
				px: 0.5,
				py: 0.5,
				life: 0,
				maxLife: 1.25 + Math.random() * 1.2,
				size: 0.06 + Math.random() * 0.09
			};
		};

		const spawnMightParticle = (): MightDefeatParticle => {
			const width = 0.05 + Math.random() * 0.09;
			const height = 0.16 + Math.random() * 0.26;
			return {
				type: 'might',
				px: 0.25 + Math.random() * 0.5,
				py: 0.18 + Math.random() * 0.45,
				vx: (Math.random() - 0.5) * 0.68,
				vy: 0.6 + Math.random() * 0.7,
				rotation: (Math.random() - 0.5) * 0.8,
				rotationVelocity: (Math.random() - 0.5) * 6,
				life: 0,
				maxLife: 1 + Math.random() * 1.2,
				width,
				height,
				notchOffsetLeft: (Math.random() - 0.5) * 0.6,
				notchOffsetRight: (Math.random() - 0.5) * 0.6,
				fractureDepth: 0.35 + Math.random() * 0.45,
				baseAlpha: 0.75 + Math.random() * 0.25
			};
		};

		const buildParticle = (): DefeatParticle => {
			if (mode === 'fire') return spawnFireParticle();
			if (mode === 'magic') return spawnMagicParticle();
			return spawnMightParticle();
		};

		for (let i = 0; i < particleCount; i++) {
			particles.push(buildParticle());
		}

		const rotationTarget = mode === 'might' ? -8 : mode === 'magic' ? 4 : 9;
		const translationTarget = mode === 'might' ? 18 : 12;
		const scaleTarget = mode === 'might' ? 0.82 : 0.78;

		let cleanedUp = false;
		const fadeAnimation = targetEl.animate(
			[
				{
					transform: 'translateZ(0) scale(1)',
					filter: 'saturate(1) brightness(1)',
					opacity: 1
				},
				{
					transform: 'translateZ(0) translateY(6px) scale(0.94)',
					filter: 'saturate(0.7) brightness(0.85)',
					opacity: 0.68
				},
				{
					transform: `translateZ(0) translateY(${translationTarget}px) rotate(${rotationTarget}deg) scale(${scaleTarget})`,
					filter: 'saturate(0.2) brightness(0.55) blur(2px)',
					opacity: 0
				}
			],
			{ duration: durationMs, easing: 'ease-in', fill: 'forwards' }
		);

		const startTimestamp = performance.now();
		let lastTimestamp = startTimestamp;

		const drawFrame = (timestamp: number) => {
			const elapsedMs = timestamp - startTimestamp;
			const deltaSeconds = Math.max(0.001, (timestamp - lastTimestamp) / 1000);
			lastTimestamp = timestamp;
			const normalized = Math.min(1, elapsedMs / durationMs);

			overlayCtx.globalCompositeOperation = 'source-over';
			overlayCtx.clearRect(0, 0, canvasWidth, canvasHeight);
			overlayCtx.globalCompositeOperation = mode === 'might' ? 'screen' : 'lighter';
			if (maskCtx) {
				const erosionStrength = Math.min(0.18, normalized * 0.14);
				if (erosionStrength > 0.01) {
					maskCtx.save();
					maskCtx.globalCompositeOperation = 'destination-out';
					maskCtx.fillStyle = `rgba(0, 0, 0, ${erosionStrength})`;
					maskCtx.fillRect(
						canvasWidth * 0.08,
						canvasHeight * (0.65 + normalized * 0.25),
						canvasWidth * 0.84,
						canvasHeight * 0.45
					);
					maskCtx.restore();
					maskPendingUpload = true;
				}
			}

			if (mode === 'might') {
				const smashFlashStrength = Math.max(0, 1 - normalized * 1.05);
				if (smashFlashStrength > 0.01) {
					overlayCtx.save();
					overlayCtx.globalAlpha = smashFlashStrength * 0.55;
					overlayCtx.fillStyle = 'rgba(255, 242, 210, 1)';
					overlayCtx.beginPath();
					overlayCtx.ellipse(
						canvasWidth * 0.5,
						canvasHeight * 0.58,
						canvasWidth * (0.26 + smashFlashStrength * 0.28),
						canvasHeight * (0.2 + smashFlashStrength * 0.18),
						0,
						0,
						Math.PI * 2
					);
					overlayCtx.fill();
					overlayCtx.globalAlpha = smashFlashStrength * 0.45;
					overlayCtx.lineWidth = Math.max(2, canvasWidth * 0.012);
					overlayCtx.strokeStyle = 'rgba(255, 210, 130, 1)';
					overlayCtx.beginPath();
					overlayCtx.moveTo(canvasWidth * 0.5, canvasHeight * 0.18);
					overlayCtx.lineTo(canvasWidth * 0.5, canvasHeight * 0.88);
					overlayCtx.moveTo(canvasWidth * 0.32, canvasHeight * 0.32);
					overlayCtx.lineTo(canvasWidth * 0.68, canvasHeight * 0.78);
					overlayCtx.moveTo(canvasWidth * 0.68, canvasHeight * 0.32);
					overlayCtx.lineTo(canvasWidth * 0.32, canvasHeight * 0.78);
					overlayCtx.stroke();
					overlayCtx.restore();
				}
			}

			const centerX = 0.5;
			const centerY = 0.5;

			for (let i = 0; i < particles.length; i++) {
				const particle = particles[i];
				const lifeRatio = Math.min(1, particle.life / particle.maxLife);
				const remaining = 1 - lifeRatio;

				if (particle.type === 'fire') {
					particle.life += deltaSeconds * (1.1 + normalized * 0.6);
					particle.px += particle.vx * deltaSeconds;
					particle.py += particle.vy * deltaSeconds * (0.9 + normalized * 0.7);
					if (particle.py < -0.1 || particle.life >= particle.maxLife) {
						particles[i] = spawnFireParticle();
						continue;
					}
					const px = particle.px * canvasWidth;
					const py = particle.py * canvasHeight;
					const sizePx = particle.size * canvasWidth;
					const flicker = 0.7 + Math.sin((timestamp / 1000) * particle.flickerSpeed) * 0.35;
					const alpha = Math.min(1.2, remaining * 1.35) * 1.05 * flicker;
					const gradient = overlayCtx.createRadialGradient(px, py, sizePx * 0.12, px, py, sizePx);
					gradient.addColorStop(0, `rgba(255, 250, 200, ${Math.min(1, alpha * 1.1)})`);
					gradient.addColorStop(0.35, `rgba(255, 170, 60, ${alpha})`);
					gradient.addColorStop(0.7, `rgba(255, 80, 30, ${alpha * 0.8})`);
					gradient.addColorStop(1, 'rgba(60, 10, 0, 0)');
					overlayCtx.fillStyle = gradient;
					overlayCtx.beginPath();
					overlayCtx.arc(px, py, sizePx, 0, Math.PI * 2);
					overlayCtx.fill();
					carveCircleIntoMask(px, py, sizePx * (1.6 + normalized * 0.8), 0.6 + normalized * 0.45);
					continue;
				}

				if (particle.type === 'magic') {
					particle.life += deltaSeconds;
					particle.radius += particle.radiusVelocity * deltaSeconds * (0.9 + normalized * 0.4);
					particle.angle += particle.angularVelocity * deltaSeconds;
					const spiralLift = 0.04 + normalized * 0.08;
					particle.py =
						centerY + Math.sin(particle.angle) * particle.radius * 0.7 - normalized * spiralLift;
					particle.px = centerX + Math.cos(particle.angle) * particle.radius * 0.9;
					if (particle.life >= particle.maxLife) {
						particles[i] = spawnMagicParticle();
						continue;
					}
					const px = particle.px * canvasWidth;
					const py = particle.py * canvasHeight;
					const sizePx = particle.size * canvasWidth;
					const alpha = Math.min(1.15, remaining * 1.35);
					const gradient = overlayCtx.createRadialGradient(px, py, sizePx * 0.16, px, py, sizePx);
					gradient.addColorStop(0, `rgba(230, 245, 255, ${Math.min(1, alpha * 1.1)})`);
					gradient.addColorStop(0.45, `rgba(150, 190, 255, ${alpha})`);
					gradient.addColorStop(0.82, `rgba(70, 110, 255, ${alpha * 0.65})`);
					gradient.addColorStop(1, 'rgba(15, 0, 80, 0)');
					overlayCtx.fillStyle = gradient;
					overlayCtx.beginPath();
					overlayCtx.arc(px, py, sizePx, 0, Math.PI * 2);
					overlayCtx.fill();
					carveCircleIntoMask(px, py, sizePx * (1.8 + normalized * 1.1), 0.5 + normalized * 0.5);
					continue;
				}

				particle.life += deltaSeconds * (0.9 + normalized * 0.5);
				particle.vy += 1.4 * deltaSeconds;
				particle.px += particle.vx * deltaSeconds;
				particle.py += particle.vy * deltaSeconds;
				particle.rotation += particle.rotationVelocity * deltaSeconds;
				const offscreen =
					particle.py > 1.2 ||
					particle.px < -0.2 ||
					particle.px > 1.2 ||
					particle.life >= particle.maxLife;
				if (offscreen) {
					particles[i] = spawnMightParticle();
					continue;
				}
				const px = particle.px * canvasWidth;
				const py = particle.py * canvasHeight;
				const widthPx = particle.width * canvasWidth;
				const heightPx = particle.height * canvasHeight;
				const alpha = Math.min(1, remaining * 1.15) * particle.baseAlpha;
				overlayCtx.save();
				overlayCtx.translate(px, py);
				overlayCtx.rotate(particle.rotation);
				overlayCtx.beginPath();
				overlayCtx.moveTo(-widthPx * 0.5, heightPx * 0.5);
				overlayCtx.lineTo(
					-widthPx * (0.25 + particle.notchOffsetLeft * 0.25),
					-heightPx * particle.fractureDepth
				);
				overlayCtx.lineTo(widthPx * (0.2 + particle.notchOffsetRight * 0.25), -heightPx * 0.25);
				overlayCtx.lineTo(widthPx * 0.5, heightPx * 0.5);
				overlayCtx.closePath();
				overlayCtx.fillStyle = `rgba(185, 130, 55, ${alpha})`;
				overlayCtx.fill();
				overlayCtx.strokeStyle = `rgba(85, 45, 10, ${Math.min(1, alpha * 1.1)})`;
				overlayCtx.lineWidth = Math.max(1.2, widthPx * 0.1);
				overlayCtx.stroke();
				overlayCtx.beginPath();
				overlayCtx.moveTo(0, -heightPx * 0.3);
				overlayCtx.lineTo(0, heightPx * 0.5);
				overlayCtx.moveTo(-widthPx * 0.18, -heightPx * 0.1);
				overlayCtx.lineTo(-widthPx * 0.05, heightPx * 0.4);
				overlayCtx.moveTo(widthPx * 0.18, -heightPx * 0.05);
				overlayCtx.lineTo(widthPx * 0.05, heightPx * 0.45);
				overlayCtx.strokeStyle = `rgba(255, 230, 190, ${alpha * 0.7})`;
				overlayCtx.lineWidth = Math.max(0.8, widthPx * 0.06);
				overlayCtx.stroke();
				overlayCtx.restore();
				carveImpactIntoMask(
					px,
					py,
					widthPx * (1.2 + normalized * 0.8),
					heightPx * (1.1 + normalized * 0.6),
					particle.rotation,
					0.65 + normalized * 0.5
				);
			}

			if (
				maskCtx &&
				maskPendingUpload &&
				(timestamp - lastMaskUploadTimestamp >= maskUploadIntervalMs || normalized >= 1)
			) {
				applyMaskTexture(timestamp);
			}

			if (normalized < 1) {
				requestAnimationFrame(drawFrame);
			} else {
				cleanup();
			}
		};

		const cleanup = () => {
			if (cleanedUp) return;
			cleanedUp = true;
			if (typeof fadeAnimation.commitStyles === 'function') {
				fadeAnimation.commitStyles();
			}
			fadeAnimation.cancel();
			targetEl.style.opacity = '0';
			targetEl.style.transform = `translateZ(0) translateY(${translationTarget}px) scale(${scaleTarget})`;
			targetEl.style.filter = 'saturate(0.15) brightness(0.4) blur(2px)';
			targetEl.style.pointerEvents = 'none';
			targetEl.classList.remove('defeat-active', `defeat-${mode}`);
			delete targetEl.dataset.defeatEffectActive;
			if (maskCtx) {
				maskedContentWrapper.style.maskImage = '';
				maskedContentWrapper.style.maskSize = '';
				maskedContentWrapper.style.maskRepeat = '';
				maskedContentWrapper.style.maskPosition = '';
				maskedContentWrapper.style.maskMode = '';
				styleWithVendorMasks.webkitMaskImage = '';
				styleWithVendorMasks.webkitMaskSize = '';
				styleWithVendorMasks.webkitMaskRepeat = '';
				styleWithVendorMasks.webkitMaskPosition = '';
			}
			overlayCanvas.remove();
			while (maskedContentWrapper.firstChild) {
				targetEl.appendChild(maskedContentWrapper.firstChild);
			}
			maskedContentWrapper.remove();
			fadeAnimation.removeEventListener('finish', cleanup);
			if (!originalPositionStyle && computedPosition === 'static') {
				targetEl.style.position = '';
			} else {
				targetEl.style.position = originalPositionStyle;
			}
		};

		fadeAnimation.addEventListener('finish', cleanup);

		requestAnimationFrame(drawFrame);
	}

	function findLoserCenterElement(): HTMLElement | null {
		const winner = currentDuelRoundWinner;
		if (!winner) return null;
		if (winner === playerA) return centerSlotBElement;
		if (winner === playerB) return centerSlotAElement;
		return null;
	}

	onMount(async () => {
		if (browser) {
			duelTimerHandle = window.setInterval(() => {
				now = Date.now();
			}, 250);
		}
		await loadGameStateOrFinalResult();
		setupMyHandResizeObserver();
	});

	onDestroy(() => {
		if (advanceTimer) window.clearTimeout(advanceTimer);
		if (duelTimerHandle) {
			window.clearInterval(duelTimerHandle);
			duelTimerHandle = null;
		}
	});

	$: playerA = $gameStateStore?.players?.[0] ?? 'playerA';
	$: playerB = $gameStateStore?.players?.[1] ?? 'playerB';
	$: playerAUsername = $gameStateStore?.playerUsernames?.[playerA] ?? playerA;
	$: playerBUsername = $gameStateStore?.playerUsernames?.[playerB] ?? playerB;
	$: opponentLooksLikeBot = isBotIdentity(playerB, playerBUsername);
	$: duelStage = currentDuelStage ?? null;
	$: duelCenter = currentDuelCenter ?? null;
	$: chooserId = duelCenter?.chooserId ?? playerA;
	$: discardPiles = $gameStateStore?.discardPiles ?? null;
	$: hpA = $gameStateStore?.hp?.[playerA] ?? 0;
	$: hpB = $gameStateStore?.hp?.[playerB] ?? 0;
	$: deckA = Array.isArray($gameStateStore?.decks?.[playerA])
		? $gameStateStore!.decks[playerA].length
		: 0;
	$: deckB = Array.isArray($gameStateStore?.decks?.[playerB])
		? $gameStateStore!.decks[playerB].length
		: 0;
	$: oppHandCount = Array.isArray($gameStateStore?.hands?.[playerB])
		? $gameStateStore!.hands[playerB].length
		: 0;

	let myHandContainerElement: HTMLDivElement | null = null;
	let myHandCardSpreadPixels: number | null = null;
	function computeSpread() {
		const count = Math.max(1, playerHandCardItems.length);
		const w = myHandContainerElement?.clientWidth ?? 0;
		myHandCardSpreadPixels = Math.min(46, Math.max(10, (w / count) * 0.24));
	}
	function setupMyHandResizeObserver() {
		const ro = new ResizeObserver(() => computeSpread());
		if (myHandContainerElement) ro.observe(myHandContainerElement);
	}
	$: computeSpread();

	$: canReturnSelectedCardToHand =
		!($gameStateStore?.winner ?? finalGameResult?.winner ?? null) &&
		$gameStateStore?.mode === 'ATTRIBUTE_DUEL' &&
		Boolean(currentDuelCenter?.aCardCode) &&
		currentDuelStage !== 'REVEAL' &&
		($gameStateStore?.players?.[0] ?? '') === chooserId;
	$: duelDeadlineAt =
		typeof currentDuelCenter?.deadlineAt === 'number' ? currentDuelCenter.deadlineAt : null;
	$: duelTimerWinner = $gameStateStore?.winner ?? finalGameResult?.winner ?? null;
	$: duelRemainingMs =
		duelTimerWinner === null && duelDeadlineAt ? Math.max(0, duelDeadlineAt - now) : null;
	$: duelCountdownText = duelRemainingMs !== null ? formatRemainingTime(duelRemainingMs) : null;
	$: duelTimerLabel = (() => {
		if (!duelCountdownText) return null;
		if (currentDuelStage === 'PICK_ATTRIBUTE') {
			return chooserId === playerA ? 'Choose attribute' : 'Opponent choosing';
		}
		if (currentDuelStage === 'PICK_CARD') {
			return 'Select cards';
		}
		return null;
	})();
	$: showDuelCountdown = Boolean(duelCountdownText && duelTimerLabel);
	$: duelCountdownCritical = Boolean(duelRemainingMs !== null && duelRemainingMs <= 3000);
	async function autoResolveExpiredDuelTurn(stageHint: GameState['duelStage'] | null) {
		if (!currentGameId || duelTimeoutResolver) return;

		const enqueue = (work: () => Promise<void>) => {
			duelTimeoutResolver = work().finally(() => {
				duelTimeoutResolver = null;
			});
		};

		enqueue(async () => {
			const ensureLatestState = async () => {
				if ($gameStateStore) return $gameStateStore;
				await loadGameStateOrFinalResult();
				return $gameStateStore;
			};

			let state = await ensureLatestState();
			if (!state) return;

			const pickFallbackCardFromHand = (hand: string[] | undefined | null) => {
				if (!hand || hand.length === 0) return null;
				return hand[0] ?? null;
			};

			const resolveAutoCards = async () => {
				const center = state?.duelCenter ?? null;
				if (!center) return false;

				const hands = state.hands ?? {};

				const pendingSelections: Array<Promise<void>> = [];

				if (!center.aCardCode) {
					const autoCard = pickFallbackCardFromHand(hands[playerA] as string[] | undefined);
					if (autoCard) {
						pendingSelections.push(
							chooseChronosDuelCard(currentGameId, playerA, autoCard).catch((error) => {
								console.error('Failed to auto-pick card for playerA after timeout', error);
							})
						);
					}
				}

				const botControlsOpponent = !center.bCardCode && isBotIdentity(playerB, playerBUsername);
				if (botControlsOpponent) {
					const autoCard = pickFallbackCardFromHand(hands[playerB] as string[] | undefined);
					if (autoCard) {
						pendingSelections.push(
							chooseChronosDuelCard(currentGameId, playerB, autoCard).catch((error) => {
								console.error('Failed to auto-pick card for playerB after timeout', error);
							})
						);
					}
				}

				if (!pendingSelections.length) return false;
				await Promise.all(pendingSelections);
				await loadGameStateOrFinalResult();
				state = $gameStateStore ?? state;
				return true;
			};

			const cardsResolved =
				stageHint === 'PICK_CARD' || state?.duelStage === 'PICK_CARD'
					? await resolveAutoCards()
					: false;

			state = $gameStateStore ?? state;
			if (!state) return;

			const centerAfter = state.duelCenter ?? null;
			const readyForAttribute = Boolean(
				centerAfter?.aCardCode && centerAfter?.bCardCode && !centerAfter?.chosenAttribute
			);
			const chooser = centerAfter?.chooserId ?? playerA;
			const chooserIsLocal = chooser === playerA;
			const chooserIsBot = isBotIdentity(
				chooser,
				chooser === playerA ? playerAUsername : playerBUsername
			);

			if (
				readyForAttribute &&
				(state.duelStage === 'PICK_ATTRIBUTE' || cardsResolved) &&
				(chooserIsLocal || chooserIsBot)
			) {
				const attribute = resolvePreferredAttributeForChooser(chooser);
				try {
					await chooseChronosDuelAttribute(currentGameId, chooser, attribute);
				} catch (error) {
					console.error('Failed to auto-select duel attribute after timeout', error);
					return;
				}
				await loadGameStateOrFinalResult();
			}
		});
	}

	$: {
		const deadline = duelDeadlineAt ?? null;
		const stageKey = currentDuelStage ?? 'NONE';
		const nextSignature = `${stageKey}:${deadline ?? 'none'}`;
		if (nextSignature !== duelTimeoutSignature) {
			duelTimeoutSignature = nextSignature;
			duelTimeoutHandledForSignature = false;
		}

		const deadlineReached =
			duelRemainingMs !== null ? duelRemainingMs <= 0 : deadline !== null && Date.now() >= deadline;

		if (
			browser &&
			!duelTimeoutHandledForSignature &&
			deadlineReached &&
			!(duelTimerWinner ?? null) &&
			currentGameId
		) {
			duelTimeoutHandledForSignature = true;
			autoResolveExpiredDuelTurn(currentDuelStage ?? null);
		}
	}

	$: chooserCardDetails =
		duelStage === 'PICK_ATTRIBUTE' && chooserId === playerA && currentDuelCenter?.aCardCode
			? (cardDetailsCacheByCode.get(currentDuelCenter.aCardCode) ?? null)
			: null;

	$: officialHistoryLogEntries = $gameStateStore?.log ?? [];
	$: {
		const officialLength = officialHistoryLogEntries.length;
		if (officialLength !== lastAcknowledgedOfficialLogLength) {
			lastAcknowledgedOfficialLogLength = officialLength;
			if (provisionalRevealHistoryEntries.length) {
				provisionalRevealHistoryEntries = [];
			}
			if (duelStage === 'REVEAL' && typeof centerRevealCycle === 'number') {
				lastProvisionalRevealCycleId = centerRevealCycle;
			} else if (duelStage !== 'REVEAL') {
				lastProvisionalRevealCycleId = null;
			}
		}
	}

	$: {
		if (
			duelStage === 'REVEAL' &&
			typeof centerRevealCycle === 'number' &&
			centerRevealCycle > 0 &&
			centerRevealCycle !== lastProvisionalRevealCycleId &&
			currentDuelCenter &&
			provisionalRevealHistoryEntries.length === 0
		) {
			const provisionalLine = buildProvisionalHistoryLineForReveal(
				currentDuelCenter,
				currentDuelRoundWinner
			);
			if (provisionalLine) {
				provisionalRevealHistoryEntries = [provisionalLine];
				lastProvisionalRevealCycleId = centerRevealCycle;
			}
		} else if (duelStage !== 'REVEAL' && provisionalRevealHistoryEntries.length) {
			provisionalRevealHistoryEntries = [];
			lastProvisionalRevealCycleId = null;
		}
	}

	$: combinedHistoryLogEntries = [...officialHistoryLogEntries, ...provisionalRevealHistoryEntries];

	$: historyLogLength = combinedHistoryLogEntries.length;
	$: {
		if (historyLogLength < lastAppliedLogLength) {
			lastAppliedLogLength = historyLogLength;
		}
		if (historyScrollContainerElement && historyLogLength > lastAppliedLogLength) {
			lastAppliedLogLength = historyLogLength;
			requestAnimationFrame(() => {
				if (historyScrollContainerElement) {
					historyScrollContainerElement.scrollTop = historyScrollContainerElement.scrollHeight;
				}
			});
		}
	}

	$: {
		if (
			duelStage === 'REVEAL' &&
			currentDuelRoundWinner &&
			centerRevealCycle !== null &&
			centerRevealCycle !== lastDefeatEffectCycleId
		) {
			const loserEl = findLoserCenterElement();
			const mode = detectChosenAttributeMode(currentDuelCenter);
			lastDefeatEffectCycleId = centerRevealCycle;
			if (loserEl) {
				window.setTimeout(() => {
					(loserEl as HTMLElement).style.animation = 'none';
					startAttributeThemedDefeatAnimationOnElement(
						loserEl as HTMLElement,
						mode,
						DEFEAT_EFFECT_DURATION_MS
					);
				}, LOSER_SHAKE_BEFORE_DEFEAT_EFFECT_MS);
			}
		}
	}

	$: resolvedWinner = $gameStateStore?.winner ?? finalGameResult?.winner ?? null;
</script>

<svelte:head>
	<title>Duel – Chronos</title>
</svelte:head>

<div class="fixed-top-bar">
	<div class="topbar-left">
		<a href="/" class="home-btn">← Home</a>
		<div class="mode-pill"><strong>Mode:</strong> ATTRIBUTE_DUEL</div>
	</div>
	<div class="topbar-right">
		{#if showDuelCountdown}
			<div class={`turn-timer ${duelCountdownCritical ? 'critical' : ''}`}>
				<span class="label">{duelTimerLabel}</span>
				<span class="time">{duelCountdownText}</span>
			</div>
		{/if}
		{#if resolvedWinner === null}
			<div class="surrender-row">
				<button
					type="button"
					class="surrender-button"
					on:click={surrenderDuelGame}
					disabled={!$authUser}
				>
					🏳️ Surrender
				</button>
				{#if !$authUser}
					<span class="surrender-hint">Login required to surrender.</span>
				{/if}
			</div>
		{/if}
	</div>
</div>

<div class="board">
	<section class="zone opponent">
		<div class="zone-header">
			<span class="pill name">👤 {playerBUsername}</span>
			<span class="pill hp">❤️ {hpB}</span>
			<span class="pill deck">🃏 {deckB}</span>
		</div>
		<div class="zone-row two-cols">
			<div class="deck-col" bind:this={opponentDeckAnchorElement}>
				<DeckStack
					deckCount={deckB}
					cardBackImageUrl="/frames/card-back.png"
					aspectWidth={430}
					aspectHeight={670}
					cardWidthCss={cardWidthCssValue}
					maxVisible={7}
					offsetXPx={4}
					offsetYPx={3}
					direction="right"
				/>
			</div>
			<div class="hand opp-hand fan" bind:this={opponentHandContainerElement}>
				{#each Array.from({ length: oppHandCount }) as _, i}
					<div
						class="card-socket"
						style={`width:${cardWidthCssValue}; --i:${i}; --n:${oppHandCount}`}
					>
						<div class="card-back-wrap" title="Opponent card">
							<img
								src="/frames/card-back.png"
								alt="card-back"
								style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:10px;display:block;"
								loading="lazy"
								decoding="async"
							/>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<section class="zone center" style="margin:10px auto; max-width:1200px;">
		<div class="center-content">
			<div class="center-left">
				<div
					class="zone-row two-cols"
					style="gap:24px; align-items:center; justify-content:center; grid-template-columns:auto auto;"
				>
					<div
						class="duel-slot"
						class:slot-removable={canReturnSelectedCardToHand}
						style={`width:${cardWidthCssValue}; height:calc(${cardWidthCssValue} * 1.55);`}
					>
						{#if currentDuelCenter?.aCardCode}
							<div
								bind:this={centerSlotAElement}
								class={`result-wrap ${currentDuelStage === 'REVEAL' && currentDuelRoundWinner === playerA ? 'winner-glow' : currentDuelStage === 'REVEAL' && currentDuelRoundWinner && currentDuelRoundWinner !== playerA ? 'loser-shake' : ''}`}
								on:click={onCenterCardReturnToHand}
								title="Return card to hand"
							>
								<CardComposite
									artImageUrl={cardDetailsCacheByCode.get($gameStateStore.duelCenter.aCardCode)
										?.imageUrl ?? ''}
									frameImageUrl={frameOverlayImageUrl ?? '/frames/default.png'}
									titleImageUrl={titleOverlayImageUrl}
									titleText={cardDetailsCacheByCode.get($gameStateStore.duelCenter.aCardCode)
										?.name ?? $gameStateStore.duelCenter.aCardCode}
									aspectWidth={430}
									aspectHeight={670}
									artObjectFit="cover"
									enableTilt={false}
									descriptionText={cardDetailsCacheByCode.get($gameStateStore.duelCenter.aCardCode)
										?.description ?? ''}
									magicValue={cardDetailsCacheByCode.get($gameStateStore.duelCenter.aCardCode)
										?.magic ?? 0}
									mightValue={cardDetailsCacheByCode.get($gameStateStore.duelCenter.aCardCode)
										?.might ?? 0}
									fireValue={cardDetailsCacheByCode.get($gameStateStore.duelCenter.aCardCode)
										?.fire ?? 0}
									cornerNumberValue={cardDetailsCacheByCode.get(
										$gameStateStore.duelCenter.aCardCode
									)?.number ?? 0}
								/>
							</div>
						{:else}
							<div class="slot-empty">
								<span class="slot-icon">🃏</span>
							</div>
						{/if}
					</div>

					<div
						class="duel-slot"
						style={`width:${cardWidthCssValue}; height:calc(${cardWidthCssValue} * 1.55);`}
					>
						{#if currentDuelCenter?.bCardCode}
							<div class="flip-wrap" data-cycle={centerRevealCycle}>
								<div
									class="flipper"
									class:start-back={currentDuelStage !== 'REVEAL'}
									class:animate={currentDuelStage === 'REVEAL'}
									style={`--flip-ms:${FLIP_MS}ms;`}
								>
									<div class="face front">
										<div
											bind:this={centerSlotBElement}
											class={`result-wrap ${currentDuelStage === 'REVEAL' && currentDuelRoundWinner === playerB ? 'winner-glow' : currentDuelStage === 'REVEAL' && currentDuelRoundWinner && currentDuelRoundWinner !== playerB ? 'loser-shake' : ''}`}
										>
											<CardComposite
												artImageUrl={cardDetailsCacheByCode.get(
													$gameStateStore.duelCenter.bCardCode
												)?.imageUrl ?? ''}
												frameImageUrl={frameOverlayImageUrl ?? '/frames/default.png'}
												titleImageUrl={titleOverlayImageUrl}
												titleText={cardDetailsCacheByCode.get($gameStateStore.duelCenter.bCardCode)
													?.name ?? $gameStateStore.duelCenter.bCardCode}
												aspectWidth={430}
												aspectHeight={670}
												artObjectFit="cover"
												enableTilt={false}
												descriptionText={cardDetailsCacheByCode.get(
													$gameStateStore.duelCenter.bCardCode
												)?.description ?? ''}
												magicValue={cardDetailsCacheByCode.get($gameStateStore.duelCenter.bCardCode)
													?.magic ?? 0}
												mightValue={cardDetailsCacheByCode.get($gameStateStore.duelCenter.bCardCode)
													?.might ?? 0}
												fireValue={cardDetailsCacheByCode.get($gameStateStore.duelCenter.bCardCode)
													?.fire ?? 0}
												cornerNumberValue={cardDetailsCacheByCode.get(
													$gameStateStore.duelCenter.bCardCode
												)?.number ?? 0}
											/>
										</div>
									</div>
									<div class="face back">
										<img
											src={cardBackImageUrl}
											alt="hidden"
											style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:10px;display:block;"
											loading="lazy"
											decoding="async"
										/>
									</div>
								</div>
							</div>
						{:else if opponentLooksLikeBot && duelStage === 'PICK_CARD'}
							<div class="slot-placeholder bot-card-back">
								<img src={cardBackImageUrl} alt="Bot card hidden" loading="lazy" decoding="async" />
							</div>
						{:else}
							<div class="slot-empty slot-empty-opp">
								<span class="slot-icon">⚔️</span>
							</div>
						{/if}
					</div>
				</div>

				{#if duelStage === 'PICK_ATTRIBUTE' && chooserId === playerA}
					<div class="notice chooser" style="margin-top:12px; text-align:center;">
						<span>Choose attribute:</span>
						<div>
							<button
								class="btn attribute-option"
								class:attribute-highlight={isHighlightedAttribute('magic')}
								disabled={isGameOver()}
								on:click={() => chooseAttr('magic')}
								title={`Choose magic (${chooserCardDetails?.magic ?? '–'})`}
								aria-label={`Choose magic (${chooserCardDetails?.magic ?? 'unknown'})`}
							>
								<img src="/icons/magic_icon.png" alt="Magic icon" loading="lazy" decoding="async" />
								{#if chooserCardDetails}
									<span class="attribute-value">{chooserCardDetails.magic}</span>
								{/if}
							</button>
							<button
								class="btn attribute-option"
								class:attribute-highlight={isHighlightedAttribute('might')}
								disabled={isGameOver()}
								on:click={() => chooseAttr('might')}
								title={`Choose might (${chooserCardDetails?.might ?? '–'})`}
								aria-label={`Choose might (${chooserCardDetails?.might ?? 'unknown'})`}
							>
								<img
									src="/icons/strength_icon.png"
									alt="Might icon"
									loading="lazy"
									decoding="async"
								/>
								{#if chooserCardDetails}
									<span class="attribute-value">{chooserCardDetails.might}</span>
								{/if}
							</button>
							<button
								class="btn attribute-option"
								class:attribute-highlight={isHighlightedAttribute('fire')}
								disabled={isGameOver()}
								on:click={() => chooseAttr('fire')}
								title={`Choose fire (${chooserCardDetails?.fire ?? '–'})`}
								aria-label={`Choose fire (${chooserCardDetails?.fire ?? 'unknown'})`}
							>
								<img src="/icons/fire_icon.png" alt="Fire icon" loading="lazy" decoding="async" />
								{#if chooserCardDetails}
									<span class="attribute-value">{chooserCardDetails.fire}</span>
								{/if}
							</button>
						</div>
					</div>
				{:else if duelStage === 'PICK_ATTRIBUTE'}
					<div class="notice warn" style="margin-top:12px; text-align:center;">
						Waiting for {chooserId} to choose the attribute…
					</div>
				{/if}

				{#if duelStage === 'REVEAL' && !currentDuelRoundWinner}
					<div class="notice chooser" style="margin-top:12px; text-align:center;">
						Rodada empatada!
					</div>
				{/if}
			</div>

			<div class="center-right">
				<div class="zone-header">
					<span class="pill name">⚔️ Attribute Duel</span>
					{#if discardPiles}
						<span class="pill">{playerAUsername} pile: {(discardPiles[playerA] ?? []).length}</span>
						<span class="pill">{playerBUsername} pile: {(discardPiles[playerB] ?? []).length}</span>
					{/if}
				</div>

				{#if combinedHistoryLogEntries.length}
					<div class="history">
						<div class="title">History</div>
						<div class="scroll" bind:this={historyScrollContainerElement}>
							{#each combinedHistoryLogEntries as line, index (index)}
								{@const presentation = getLogPresentation(line)}
								<div class={`log-entry ${presentation.category}`}>
									<span class="log-marker" aria-hidden="true">
										{presentation.icon}
									</span>
									<span class="log-text">{presentation.text}</span>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		</div>
	</section>

	{#if resolvedWinner !== null}
		<div class="notice success" style="margin-top:12px; text-align:center;">
			{resolvedWinner === 'DRAW' ? 'Partida empatada' : `Winner: ${resolvedWinner}`}
		</div>
		<div style="margin-top:8px;text-align:center;">
			<a href="/" class="btn" style="text-decoration:none;">Back to home</a>
		</div>
	{/if}

	<section class="zone player">
		<div class="zone-header">
			<span class="pill name">👤 {playerAUsername}</span>
			<span class="pill hp">❤️ {hpA}</span>
			<span class="pill deck">🃏 {deckA}</span>
		</div>
		<div class="zone-row two-cols">
			<div class="deck-col" bind:this={playerDeckAnchorElement}>
				<DeckStack
					deckCount={deckA}
					cardBackImageUrl="/frames/card-back.png"
					aspectWidth={430}
					aspectHeight={670}
					cardWidthCss={cardWidthCssValue}
					maxVisible={7}
					offsetXPx={4}
					offsetYPx={3}
					direction="right"
				/>
			</div>
			<div
				class="hand my-hand fan"
				bind:this={myHandContainerElement}
				style={`--spread-override:${myHandCardSpreadPixels ? myHandCardSpreadPixels + 'px' : ''}`}
			>
				{#each playerHandCardItems as it, i (it.uid)}
					{#key it.uid}
						<button
							type="button"
							class="card-socket focus:outline-none"
							disabled={Boolean($gameStateStore?.winner)}
							style={`width:${cardWidthCssValue}; --i:${i}; --n:${playerHandCardItems.length}; ${$gameStateStore?.winner ? 'opacity:.6;cursor:not-allowed;' : ''}${pendingHiddenUidSet.has(it.uid) ? ';visibility:hidden;' : ''}`}
							title={`Play ${it.name ?? it.code}`}
							on:click={(e) => onHandCardClick(e, it.code)}
						>
							<div class="flip-wrap" data-cycle={autoFlipCycleCounter}>
								<div
									class="flipper"
									class:animate={pendingCardRevealUidSet.has(it.uid)}
									class:start-back={pendingCardRevealUidSet.has(it.uid)}
									on:animationend={() => clearPendingFlipFor(it.uid)}
									style={`--flip-ms:${FLIP_MS}ms;`}
								>
									<div class="face front">
										<CardComposite
											artImageUrl={it.imageUrl ?? ''}
											frameImageUrl={frameOverlayImageUrl ?? '/frames/default.png'}
											titleImageUrl={titleOverlayImageUrl}
											titleText={it.name ?? it.code}
											aspectWidth={430}
											aspectHeight={670}
											artObjectFit="cover"
											enableTilt={true}
											descriptionText={it.description ?? ''}
											magicValue={it.magic ?? 0}
											mightValue={it.might ?? 0}
											fireValue={it.fire ?? 0}
											cornerNumberValue={it.number ?? 0}
										/>
									</div>
									<div class="face back">
										<img
											src="/frames/card-back.png"
											alt="card-back"
											style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:10px;display:block;"
											loading="lazy"
											decoding="async"
										/>
									</div>
								</div>
							</div>
						</button>
					{/key}
				{/each}
			</div>
		</div>
	</section>
</div>

<div class="fx-layer" bind:this={fxLayerElement}></div>
