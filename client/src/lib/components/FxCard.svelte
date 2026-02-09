<script lang="ts">
	import { fx, type FxItem } from '$lib/stores/fx';
	import { onMount, tick } from 'svelte';
	import '$lib/styles/components/FxCard.css';

	export let it: FxItem;

	// animation state
	let run = false; // spawn -> travel
	let fade = false; // fade out at the end
	let killTimer: ReturnType<typeof setTimeout>;

	// helpers
	function centerOf(r: DOMRect) {
		return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
	}

	// “safe” in-flight card size (keeps aspect & avoids cropping)
	const CARD_MIN = 120;
	const CARD_MAX = 320;
	const aspect = 430 / 670; // width/height

	const cardH = Math.min(
		CARD_MAX,
		Math.max(CARD_MIN, 0.26 * Math.min(window.innerWidth, window.innerHeight))
	);
	const cardW = cardH * aspect;

	// start / target (centers)
	const s = centerOf(it.fromRect);
	let t = centerOf(it.targetRect);

	// ↓↓↓ adjust destination when opponent is at the top and we’re dealing damage
	// (makes the impact point lower on the screen to be easier to see)
	if (it.kind === 'damage') {
		const nearTop = t.y < window.innerHeight * 0.35; // “opponent-ish”
		if (nearTop) {
			t = { x: t.x, y: t.y + window.innerHeight * 0.4 };
		}
	}
	// (optional idea)
	// if (it.kind === 'heal' && t.y > window.innerHeight * 0.65) {
	//   t = { x: t.x, y: t.y - window.innerHeight * 0.08 }; // lift a bit when healing self
	// }

	// small random rotation for life
	const rotStart = (Math.random() * 16 - 8).toFixed(1);
	const rotEnd = (Math.random() * 10 - 5).toFixed(1);

	// timings
	const spawnMs = 120;
	const travelMs = Math.max(360, (it.duration ?? 900) - 260);
	const fadeMs = 200;

	onMount(async () => {
		await tick();
		requestAnimationFrame(() => (run = true));

		// schedule fade + removal
		const endAt = spawnMs + travelMs;
		killTimer = setTimeout(() => {
			fade = true;
			setTimeout(() => fx.finish(it.id), fadeMs);
		}, endAt);

		// failsafe in case anything stalls
		setTimeout(() => fx.finish(it.id), (it.duration ?? 900) + 800);

		return () => clearTimeout(killTimer);
	});
</script>

<div
	class="fx-item {run ? 'run' : ''} {fade ? 'fade' : ''} {it.kind}"
	style="
    --sx:{s.x}px; --sy:{s.y}px;
    --tx:{t.x}px; --ty:{t.y}px;
    --cw:{cardW}px; --ch:{cardH}px;
    --rotStart:{rotStart}deg; --rotEnd:{rotEnd}deg;
    --spawnMs:{spawnMs}ms; --travelMs:{travelMs}ms; --fadeMs:{fadeMs}ms;
  "
>
	<div class="card">
		<img class="art" src={it.imgUrl} alt="" loading="lazy" decoding="async" />
		{#if it.frameUrl}
			<img class="frame" src={it.frameUrl} alt="" loading="lazy" decoding="async" />
		{/if}
	</div>

	<div class="pop">
		{it.kind === 'heal' ? `+${it.amount}` : `-${it.amount}`}
	</div>
</div>
