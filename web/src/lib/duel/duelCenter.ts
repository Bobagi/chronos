import type { GameState } from '$lib/stores/game';
import type { DuelAttribute } from './historyTypes';

export type DuelCenter = GameState['duelCenter'];

/**
 * The backend persists the duel center with internal field names
 * (playerACardCode, roundWinnerId, isRevealed, …). The UI was written against
 * the public contract (aCardCode, roundWinner, revealed, aVal/bVal). Normalize
 * to a single shape so the rest of the page never has to care which it got.
 */
export function normalizeDuelCenterForView(rawCenter: unknown): DuelCenter {
	if (!rawCenter || typeof rawCenter !== 'object') return null;
	const center = rawCenter as Record<string, unknown>;
	const pickString = (...keys: string[]): string | undefined => {
		for (const key of keys) {
			const value = center[key];
			if (typeof value === 'string' && value.length > 0) return value;
		}
		return undefined;
	};
	const pickNumber = (...keys: string[]): number | undefined => {
		for (const key of keys) {
			const value = center[key];
			if (typeof value === 'number' && Number.isFinite(value)) return value;
		}
		return undefined;
	};
	const pickBool = (...keys: string[]): boolean => {
		for (const key of keys) if (center[key] === true) return true;
		return false;
	};
	const attribute = pickString('chosenAttribute', 'attribute', 'attr');
	return {
		aCardCode: pickString('aCardCode', 'playerACardCode'),
		bCardCode: pickString('bCardCode', 'playerBCardCode'),
		chosenAttribute: attribute as DuelAttribute | undefined,
		revealed: pickBool('revealed', 'isRevealed'),
		chooserId: pickString('chooserId'),
		deadlineAt: pickNumber('deadlineAt') ?? null,
		aVal: pickNumber('aVal', 'playerAAttributeValue'),
		bVal: pickNumber('bVal', 'playerBAttributeValue'),
		roundWinner: pickString('roundWinner', 'roundWinnerId') ?? null
	};
}

/** Resolve the dueled attribute from whichever key/spelling the center carries. */
export function detectChosenAttributeMode(center: DuelCenter | null | undefined): DuelAttribute {
	const c = (center ?? {}) as Record<string, unknown>;
	const rawAttributeText = (
		c.chosenAttribute ??
		c.attribute ??
		c.attributeName ??
		c.attr ??
		c.chosenAttr ??
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
