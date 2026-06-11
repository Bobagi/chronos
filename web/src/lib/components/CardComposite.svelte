<script lang="ts">
	import { onMount, tick } from 'svelte';

	export let artImageUrl: string;
	export let frameImageUrl: string;
	export let titleImageUrl: string | null = null;
	export let titleText: string | null = null;
	export let aspectWidth = 430;
	export let aspectHeight = 670;
	export let artObjectFit: 'cover' | 'contain' = 'cover';
	export let titleTopPercent = 3;
	export let titleLeftPercent = 29;
	export let titleTextTopPercent = -1.5;
	export let titleTextLeftPercent = 32;
	export let titleHeightPercent = 18;
	export let enableTilt = true;
	export let tiltMaxRotateDeg = 14;
	export let tiltScale = 1.04;
	export let tiltTransitionMs = 120;
	export let descriptionText: string = '';
	export let magicValue: number = 0;
	export let mightValue: number = 0;
	export let fireValue: number = 0;
	export let cornerNumberValue: number = 1;
	export let titleBaseFontScale = 0.6;
	export let titleMaxFontScale = 0.4;
	export let titleStrokeFactor = 0.035;
	export let titleStrokeColor = '#000';

	let wrapperEl: HTMLDivElement | null = null;
	let cachedBoundingRect: DOMRect | null = null;
	let scheduledAnimationFrameId: number | null = null;
	let pendingRotateXDeg = 0;
	let pendingRotateYDeg = 0;
	let bannerEl: HTMLDivElement | null = null;
	let midEl: HTMLDivElement | null = null;
	let nameEl: HTMLSpanElement | null = null;

	function updateCachedBoundingRect() {
		if (wrapperEl) cachedBoundingRect = wrapperEl.getBoundingClientRect();
	}

	function handlePointerMove(e: PointerEvent) {
		if (!enableTilt || !wrapperEl) return;
		if (!cachedBoundingRect) updateCachedBoundingRect();
		const r = cachedBoundingRect!;
		const px = (e.clientX - r.left) / r.width;
		const py = (e.clientY - r.top) / r.height;
		pendingRotateYDeg = (px - 0.5) * 2 * tiltMaxRotateDeg;
		pendingRotateXDeg = -(py - 0.5) * 2 * tiltMaxRotateDeg;
		if (scheduledAnimationFrameId === null) {
			scheduledAnimationFrameId = requestAnimationFrame(() => {
				if (wrapperEl) {
					wrapperEl.style.transform = `translateZ(0) perspective(900px) rotateX(${pendingRotateXDeg}deg) rotateY(${pendingRotateYDeg}deg) scale(${tiltScale})`;
				}
				scheduledAnimationFrameId = null;
			});
		}
	}

	function handleMouseLeave() {
		if (!wrapperEl) return;
		if (scheduledAnimationFrameId !== null) cancelAnimationFrame(scheduledAnimationFrameId);
		scheduledAnimationFrameId = null;
		wrapperEl.style.transform =
			'translateZ(0) perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)';
	}

	function handleMouseEnter() {
		if (!wrapperEl) return;
		wrapperEl.style.transition = `transform ${tiltTransitionMs}ms ease`;
		updateCachedBoundingRect();
	}

	function makeBadge(iconPath: string, value: number, labelText: string) {
		return { iconPath, value, labelText };
	}

	// The flexbox grows the ribbon with the name; JS only handles the edge case where
	// even at the banner's max width the name overflows — then shrink the font to fit.
	async function fitBannerName() {
		try {
			await tick();
			if (!nameEl || !midEl) return;
			nameEl.style.fontSize = '';
			let guard = 24;
			while (guard-- > 0 && midEl.scrollWidth > midEl.clientWidth + 1) {
				const current = parseFloat(getComputedStyle(nameEl).fontSize);
				if (!current || current < 5) break;
				nameEl.style.fontSize = (current * 0.94).toFixed(2) + 'px';
			}
		} catch {
			/* never let title sizing break the card render */
		}
	}

	$: magicBadge = makeBadge('/icons/magic_icon.png', magicValue, 'MAGIC');
	$: mightBadge = makeBadge('/icons/strength_icon.png', mightValue, 'MIGHT');
	$: fireBadge = makeBadge('/icons/fire_icon.png', fireValue, 'FIRE');

	$: tooltipText = descriptionText
		? `${titleText ?? 'Card'} — ${descriptionText}`
		: (titleText ?? 'Card');

	$: if (titleText !== undefined && nameEl && midEl) fitBannerName();

	onMount(() => {
		const ro = new ResizeObserver(() => {
			updateCachedBoundingRect();
			fitBannerName();
		});
		if (wrapperEl) ro.observe(wrapperEl);
		if ((document as any).fonts && (document as any).fonts.ready) {
			(document as any).fonts.ready.then(() => fitBannerName());
		}
		return () => ro.disconnect();
	});
</script>

<div
	bind:this={wrapperEl}
	on:pointermove={handlePointerMove}
	on:mouseleave={handleMouseLeave}
	on:mouseenter={handleMouseEnter}
	aria-label={titleText ?? 'card'}
	title={tooltipText}
	class="card-font"
	style={`position:relative;width:100%;aspect-ratio:${aspectWidth}/${aspectHeight};overflow:hidden;border-radius:5px;transform:translateZ(0) perspective(900px);will-change:transform;container-type:size;container-name:card;`}
>
	<div style="position:absolute;inset:0;display:flex;flex-direction:column;width:100%;height:100%;">
		<div style="position:relative;width:100%;height:70%;z-index:0;">
			<img
				src={artImageUrl}
				alt={titleText ?? 'card-art'}
				style={`position:absolute;inset:0;width:100%;height:100%;object-fit:${artObjectFit};display:block;padding: 6% 6% 0 6%;`}
				loading="lazy"
				decoding="async"
				draggable="false"
			/>
		</div>

		<div
			style="
        position:relative;height:30%;
        padding:0 2cqw 6cqh 2cqw;
        display:flex;justify-content:center;align-items:center;gap:3cqw;
        background-image:url('/frames/attributeBackground.png');
        background-size:cover;
        background-position:center bottom;
        background-repeat:no-repeat;
        border-top: 0.25cqh solid rgba(255,255,255,.18);
        z-index:0;
      "
		>
			{#each [magicBadge, mightBadge, fireBadge] as b}
				<div style="display:flex;flex-direction:column;align-items:center;gap:1.4cqh;min-width:0;">
					<div
						style="
              position:relative;
              width:15cqh;
              height:15cqh;
              background-image:url({b.iconPath});
              background-size:contain;
              background-repeat:no-repeat;
              background-position:center;
              flex:0 0 auto;
            "
						aria-label={b.labelText}
					>
						<div
							class="card-attribute-value"
							style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-size:5cqh;letter-spacing:-0.12em;text-rendering:optimizeLegibility;font-kerning:normal;transform:translate(var(--cc-val-x,0),var(--cc-val-y,0)) scaleX(0.92);"
						>
							{b.value}
						</div>
					</div>
					<div
						class="card-attribute-label"
						style="font-size:3cqh;line-height:1;white-space:nowrap;"
					>
						{b.labelText}
					</div>
				</div>
			{/each}
		</div>
	</div>

	<img
		src={frameImageUrl}
		alt="card-frame"
		style="position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none;z-index:1;"
		loading="lazy"
		decoding="async"
		draggable="false"
	/>
	<!-- Elastic title banner (3-slice): fixed left/right caps + a middle that stretches
	     with the name. Anchored right, so long names grow the ribbon LEFTWARD, like the
	     printed cards; the font only shrinks once the ribbon hits its max width. The
	     card number rides in the right ornament. Outlines are text-shadows (a centred
	     text-stroke thins the glyph; the print outline is external). Sits above the
	     frame so the name/number are never covered by the stone border. -->
	<div class="cc-banner" bind:this={bannerEl}>
		<div class="cc-cap-l"></div>
		<div class="cc-mid" bind:this={midEl}>
			<span class="cc-name" bind:this={nameEl}>{titleText ?? ''}</span>
		</div>
		<div class="cc-cap-r">
			<span class="cc-num">{cornerNumberValue}</span>
		</div>
	</div>
</div>

<style>
	.cc-banner {
		--hb: var(--cc-banner-h, 19.6cqw);
		position: absolute;
		top: var(--cc-banner-top, 3.4%);
		right: var(--cc-banner-right, 4.6%);
		height: var(--hb);
		display: flex;
		align-items: stretch;
		z-index: 4;
		max-width: 92%;
		pointer-events: none;
		filter: drop-shadow(0 calc(var(--hb) * 0.03) calc(var(--hb) * 0.06) rgba(0, 0, 0, 0.55));
	}
	.cc-cap-l {
		flex: 0 0 auto;
		width: calc(var(--hb) * 0.2687);
		background: url('/frames/title-left.png') no-repeat;
		background-size: 100% 100%;
	}
	.cc-mid {
		flex: 0 1 auto;
		min-width: var(--cc-banner-min, 16cqw);
		background: url('/frames/title-mid.png');
		background-size: 100% 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		padding: calc(var(--hb) * 0.0746) 1.2cqw calc(var(--hb) * 0.5671);
	}
	.cc-cap-r {
		position: relative;
		flex: 0 0 auto;
		width: calc(var(--hb) * 0.6567);
		background: url('/frames/title-right.png') no-repeat;
		background-size: 100% 100%;
	}
	.cc-name {
		font-size: calc(var(--hb) * var(--cc-name-factor, 0.3));
		letter-spacing: 0.04em;
		color: var(--cc-text-color, #fff);
		text-transform: uppercase;
		white-space: nowrap;
		line-height: 1;
		transform: translateY(-4%);
		text-shadow:
			calc(var(--hb) * -0.022) 0 0 #000,
			calc(var(--hb) * 0.022) 0 0 #000,
			0 calc(var(--hb) * -0.022) 0 #000,
			0 calc(var(--hb) * 0.022) 0 #000,
			calc(var(--hb) * -0.016) calc(var(--hb) * -0.016) 0 #000,
			calc(var(--hb) * 0.016) calc(var(--hb) * -0.016) 0 #000,
			calc(var(--hb) * -0.016) calc(var(--hb) * 0.016) 0 #000,
			calc(var(--hb) * 0.016) calc(var(--hb) * 0.016) 0 #000,
			0 calc(var(--hb) * 0.05) calc(var(--hb) * 0.04) rgba(0, 0, 0, 0.6);
	}
	.cc-num {
		position: absolute;
		left: var(--cc-num-x, 46%);
		top: var(--cc-num-y, 39%);
		transform: translate(-50%, -50%);
		font-size: calc(var(--hb) * var(--cc-num-factor, 0.56));
		color: var(--cc-text-color, #fff);
		line-height: 1;
		text-shadow:
			calc(var(--hb) * -0.025) 0 0 #000,
			calc(var(--hb) * 0.025) 0 0 #000,
			0 calc(var(--hb) * -0.025) 0 #000,
			0 calc(var(--hb) * 0.025) 0 #000,
			calc(var(--hb) * -0.018) calc(var(--hb) * -0.018) 0 #000,
			calc(var(--hb) * 0.018) calc(var(--hb) * -0.018) 0 #000,
			calc(var(--hb) * -0.018) calc(var(--hb) * 0.018) 0 #000,
			calc(var(--hb) * 0.018) calc(var(--hb) * 0.018) 0 #000;
	}
</style>
