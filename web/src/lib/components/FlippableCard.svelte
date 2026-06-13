<script lang="ts">
	import CardComposite from './CardComposite.svelte';
	import '$lib/styles/components/FlippableCard.css';

	export let backImageUrl: string;
	export let artImageUrl: string;
	export let frameImageUrl: string;
	export let titleImageUrl: string | null = null;
	export let titleText: string | null = null;

	export let aspectWidth = 1444;
	export let aspectHeight = 1920;
	export let artObjectFit: 'cover' | 'contain' = 'cover';

	export let startFace: 'front' | 'back' = 'front';
	export let autoFlipKey: number = 0;
	export let flipDelayMs = 150;
	export let flipDurationMs = 700;

	let flipperEl: HTMLDivElement | null = null;
	let initialApplied = false;

	$: if (flipperEl && !initialApplied) {
		flipperEl.style.transform = startFace === 'back' ? 'rotateY(180deg)' : 'rotateY(0deg)';
		initialApplied = true;
	}

	$: if (autoFlipKey > 0 && startFace === 'back' && flipperEl) {
		setTimeout(() => {
			if (!flipperEl) return;
			flipperEl.classList.remove('reveal');
			void flipperEl.offsetWidth;
			flipperEl.style.setProperty('--flip-ms', `${flipDurationMs}ms`);
			flipperEl.classList.add('reveal');
		}, flipDelayMs);
	}
</script>

<div
	style="position:relative;width:100%;aspect-ratio:{aspectWidth}/{aspectHeight};perspective:1000px;"
>
	<div
		bind:this={flipperEl}
		style="position:absolute;inset:0;transform-style:preserve-3d;border-radius:10px;overflow:hidden;"
	>
		<div
			style="position:absolute;inset:0;backface-visibility:hidden;transform:rotateY(0deg);z-index:2;"
		>
			<CardComposite
				{artImageUrl}
				{frameImageUrl}
				{titleImageUrl}
				{titleText}
				{aspectWidth}
				{aspectHeight}
				{artObjectFit}
			/>
		</div>

		<div
			style="position:absolute;inset:0;backface-visibility:hidden;transform:rotateY(180deg);z-index:1;"
		>
			<img
				src={backImageUrl}
				alt="card-back"
				style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block;"
				loading="lazy"
				decoding="async"
				draggable="false"
			/>
		</div>
	</div>
</div>
