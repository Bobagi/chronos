<script lang="ts">
	export let playerAId: string;
	export let playerBId: string;
	export let viewerId: string; // who is looking at the board
	export let duelStage: 'PICK_CARD' | 'PICK_ATTRIBUTE' | 'REVEAL' | 'RESOLVED';
	export let duelCenter:
		| {
				aCardCode?: string;
				bCardCode?: string;
				chosenAttribute?: 'magic' | 'might' | 'fire';
				revealed?: boolean;
		  }
		| undefined;
	export let isMyTurnToChooseAttribute: boolean;
	export let onChooseAttribute: (attr: 'magic' | 'might' | 'fire') => void;
	export let getImageUrlForCode: (code: string) => string;
	export let frameImageUrl: string;
	export let titleImageUrl: string;

	const cardBack = '/frames/card-back.png';
	const cardW = 'clamp(104px,17.5vw,200px)';

	$: viewerIsA = viewerId === playerAId;
	$: showAface = !!duelCenter?.aCardCode && (duelCenter?.revealed || viewerIsA);
	$: showBface = !!duelCenter?.bCardCode && (duelCenter?.revealed || !viewerIsA);
</script>

<section class="zone center">
	<div class="center-right">
		<div class="status-pill">
			<div class="side"><span class="tag">{playerAId}</span></div>
			<div class="sep">•</div>
			<div class="side"><span class="tag">{playerBId}</span></div>
			<div class="sep">•</div>
			<div class="vs">Duel</div>
		</div>

		{#if duelStage === 'PICK_ATTRIBUTE' && isMyTurnToChooseAttribute}
			<div class="actions">
				<button class="btn" on:click={() => onChooseAttribute('magic')}>Magic</button>
				<button class="btn" on:click={() => onChooseAttribute('might')}>Might</button>
				<button class="btn" on:click={() => onChooseAttribute('fire')}>Fire</button>
			</div>
		{/if}
	</div>

	<div class="center-right">
		<div style="display:flex;gap:16px;align-items:center;">
			<!-- A slot -->
			<div
				style={`position:relative;width:${cardW};height:calc(${cardW} * 1.55);border:2px dashed rgba(255,255,255,.25);border-radius:10px;display:flex;align-items:center;justify-content:center;`}
			>
				{#if !duelCenter?.aCardCode}
					<span class="text-xs opacity-70">A: select…</span>
				{:else if showAface}
					<img
						src={getImageUrlForCode(duelCenter.aCardCode)}
						alt="A"
						style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:8px;"
						loading="lazy"
						decoding="async"
					/>
				{:else}
					<img
						src={cardBack}
						alt="A-back"
						style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:8px;"
						loading="lazy"
						decoding="async"
					/>
				{/if}
			</div>

			<!-- B slot -->
			<div
				style={`position:relative;width:${cardW};height:calc(${cardW} * 1.55);border:2px dashed rgba(255,255,255,.25);border-radius:10px;display:flex;align-items:center;justify-content:center;`}
			>
				{#if !duelCenter?.bCardCode}
					<span class="text-xs opacity-70">B: select…</span>
				{:else if showBface}
					<img
						src={getImageUrlForCode(duelCenter.bCardCode)}
						alt="B"
						style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:8px;"
						loading="lazy"
						decoding="async"
					/>
				{:else}
					<img
						src={cardBack}
						alt="B-back"
						style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:8px;"
						loading="lazy"
						decoding="async"
					/>
				{/if}
			</div>
		</div>
	</div>
</section>
