export type DuelRoundOutcome = 'a' | 'b' | 'draw';
export type DuelAttribute = 'fire' | 'magic' | 'might';
export type DuelLogTone = 'player' | 'opponent' | 'neutral';

export interface DuelRoundRecord {
	round: number;
	attribute: DuelAttribute;
	aCode: string | null;
	bCode: string | null;
	aName: string;
	bName: string;
	aVal: number | null;
	bVal: number | null;
	outcome: DuelRoundOutcome;
	live: boolean;
}

export type DuelHistoryItem =
	| { kind: 'round'; key: string; record: DuelRoundRecord }
	| { kind: 'note'; key: string; tone: DuelLogTone; icon: string; text: string };

export interface DuelHistoryCardInfo {
	name: string;
	imageUrl: string;
}

export const ATTRIBUTE_META: Record<
	DuelAttribute,
	{ label: string; icon: string; cssClass: string }
> = {
	fire: { label: 'Fire', icon: '/icons/fire_icon.png', cssClass: 'attr-fire' },
	magic: { label: 'Magic', icon: '/icons/magic_icon.png', cssClass: 'attr-magic' },
	might: { label: 'Might', icon: '/icons/strength_icon.png', cssClass: 'attr-might' }
};
