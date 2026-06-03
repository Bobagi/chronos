<script lang="ts">
	import FxCard from '$lib/components/FxCard.svelte';
	import { fx, type FxItem } from '$lib/stores/fx';
	import { onMount } from 'svelte';
	import '$lib/styles/components/PlayFXOverlay.css';

	let items: FxItem[] = [];
	let unsub: () => void;

	onMount(() => {
		unsub = fx.subscribe((v) => (items = v));
		return () => unsub?.();
	});
</script>

<!-- overlay ocupa a viewport e NÃO bloqueia cliques -->
<div class="fx-overlay" aria-hidden="true">
	{#each items as it (it.id)}
		<FxCard {it} />
	{/each}
</div>
