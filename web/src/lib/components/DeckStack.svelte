<script lang="ts">
	/** Number of cards left in the deck */
	export let deckCount: number;

	/** Image URL for the back of the card */
	export let cardBackImageUrl: string;

	/** Card aspect ratio (keeps the back art crisp at any size) */
	export let aspectWidth = 1444;
	export let aspectHeight = 1920;

	/** Responsive width identical to the hand cards (controlled by the page) */
	export let cardWidthCss = 'clamp(104px, 17.5vw, 200px)';

	/** Maximum number of cards to render in the stack (prevents 100+ layers) */
	export let maxVisible = 20;

	/** Offset between layers in pixels */
	export let offsetXPx = 1;
	export let offsetYPx = 0.5;

	/** Stacking direction */
	export let direction: 'right' | 'left' = 'right';

	/** `cover` fills + crops so every back looks identical to the cards on the field */
	export let imageFit: 'contain' | 'cover' = 'cover';

	// Reactive derivations
	$: visibleCount = Math.min(Math.max(0, deckCount), maxVisible);
	$: layers = Array.from({ length: visibleCount }, (_, i) => i);
	$: dir = direction === 'left' ? -1 : 1; // sign used in translateX
</script>

<!-- Wrapper that matches the width of the cards in hand -->
<div
	class="deck-root"
	aria-label="Deck"
	style="position:relative;width:{cardWidthCss};aspect-ratio:{aspectWidth}/{aspectHeight};"
>
	{#each layers as i (i)}
		<div
			style="
        position:absolute; inset:0;
        overflow:visible; pointer-events:none;height:100%;
        transform: translate({dir * i * offsetXPx}px, {i * offsetYPx}px);
        z-index:{i};
        filter: drop-shadow(0 2px 8px rgba(0,0,0,.35));
      "
		>
			<img
				src={cardBackImageUrl}
				alt="deck-card-back"
				style="
          position:absolute; inset:0; width:100%; height:100%;
          object-fit:{imageFit};
          display:block; border-radius:6px;
        "
				loading="lazy"
				decoding="async"
				draggable="false"
			/>
		</div>
	{/each}
</div>
