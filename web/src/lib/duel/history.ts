import { detectChosenAttributeMode, type DuelCenter } from './duelCenter';
import type { DuelAttribute, DuelHistoryItem, DuelLogTone, DuelRoundOutcome } from './historyTypes';

// Backend round lines look like:
//   "FIRE duel(Alice): Red Dragon(12) vs Mage(7) => Alice"
// We parse them back into structured rounds so the timeline survives reloads,
// and synthesize the in-progress round straight from the duel center.
export const DUEL_LOG_PATTERN =
	/^([A-Za-z]+) duel\((.*)\): (.*)\((-?\d+)\) vs (.*)\((-?\d+)\) => (.*)$/;

export function attributeFromText(text: string): DuelAttribute {
	const normalized = (text ?? '').toLowerCase();
	if (normalized.includes('mag')) return 'magic';
	if (normalized.includes('fire') || normalized.includes('fog')) return 'fire';
	return 'might';
}

export function outcomeFromValues(aVal: number | null, bVal: number | null): DuelRoundOutcome {
	if (typeof aVal === 'number' && typeof bVal === 'number') {
		if (aVal > bVal) return 'a';
		if (bVal > aVal) return 'b';
	}
	return 'draw';
}

export interface HistoryLogContext {
	resolveCodeByName: (name: string | null | undefined) => string | null;
	getLogPresentation: (line: string) => { category: DuelLogTone; icon: string; text: string };
	/** Localized text for the "a player surrendered" note. */
	surrenderedText: string;
}

/** Parse the backend log into structured timeline items (survives reloads). */
export function buildHistoryFromLog(logs: string[], ctx: HistoryLogContext): DuelHistoryItem[] {
	const items: DuelHistoryItem[] = [];
	let roundCounter = 0;
	logs.forEach((line, index) => {
		const raw = (line ?? '').trim();
		if (!raw) return;
		const match = raw.match(DUEL_LOG_PATTERN);
		if (match) {
			roundCounter += 1;
			const aName = match[3].trim();
			const bName = match[5].trim();
			const aValParsed = Number(match[4]);
			const bValParsed = Number(match[6]);
			const aVal = Number.isFinite(aValParsed) ? aValParsed : null;
			const bVal = Number.isFinite(bValParsed) ? bValParsed : null;
			items.push({
				kind: 'round',
				key: `log-${index}`,
				record: {
					round: roundCounter,
					attribute: attributeFromText(match[1]),
					aCode: ctx.resolveCodeByName(aName),
					bCode: ctx.resolveCodeByName(bName),
					aName,
					bName,
					aVal,
					bVal,
					outcome: outcomeFromValues(aVal, bVal),
					live: false
				}
			});
			return;
		}
		if (/^game created$/i.test(raw)) return;
		if (/\bdraws$/i.test(raw)) return;
		if (/surrender/i.test(raw)) {
			items.push({
				kind: 'note',
				key: `log-${index}`,
				tone: 'neutral',
				icon: '🏳️',
				text: ctx.surrenderedText
			});
			return;
		}
		const presentation = ctx.getLogPresentation(raw);
		items.push({
			kind: 'note',
			key: `log-${index}`,
			tone: presentation.category,
			icon: presentation.icon,
			text: presentation.text
		});
	});
	return items;
}

export interface CardStatLookup {
	name: string;
	magic: number;
	might: number;
	fire: number;
}

export interface LiveRoundContext {
	roundNumber: number;
	center: DuelCenter;
	resolveDetails: (code: string) => CardStatLookup | null;
	playerA: string;
	playerB: string;
	revealCycle: number;
}

/** Synthesize the in-progress (not-yet-committed) round from the duel center. */
export function buildLiveRound(ctx: LiveRoundContext): DuelHistoryItem | null {
	const { center, roundNumber, resolveDetails, playerA, playerB, revealCycle } = ctx;
	if (!center) return null;
	const aCode = center.aCardCode ?? null;
	const bCode = center.bCardCode ?? null;
	if (!aCode || !bCode) return null;
	const attribute = detectChosenAttributeMode(center);
	const aDetails = resolveDetails(aCode);
	const bDetails = resolveDetails(bCode);
	const aVal = typeof center.aVal === 'number' ? center.aVal : (aDetails?.[attribute] ?? null);
	const bVal = typeof center.bVal === 'number' ? center.bVal : (bDetails?.[attribute] ?? null);
	const winner = center.roundWinner ?? null;
	let outcome: DuelRoundOutcome = outcomeFromValues(aVal, bVal);
	if (winner === playerA) outcome = 'a';
	else if (winner === playerB) outcome = 'b';
	return {
		kind: 'round',
		key: `live-${revealCycle}`,
		record: {
			round: roundNumber,
			attribute,
			aCode,
			bCode,
			aName: aDetails?.name ?? aCode,
			bName: bDetails?.name ?? bCode,
			aVal,
			bVal,
			outcome,
			live: true
		}
	};
}
