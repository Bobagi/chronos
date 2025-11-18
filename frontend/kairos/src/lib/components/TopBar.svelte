<script lang="ts">
	import { assets } from '$app/paths';
	import { createEventDispatcher } from 'svelte';
	export let isUserAuthenticated: boolean = false;
	const dispatch = createEventDispatcher();

	function requestLogout() {
		dispatch('logout');
	}
	const brandLogoUrl = `${assets}/world_icon.png`;
</script>

<header class="site-topbar" aria-label="Chronos top bar">
	<div class="topbar-inner">
		<a href="/" class="brand-link">
			<img class="brand-logo" src={brandLogoUrl} alt="Kairos" />
			<span class="brand-name">Kairos</span>
		</a>
		<nav class="topbar-nav" aria-label="Primary">
			{#if isUserAuthenticated}
				<button type="button" class="button button-primary" on:click={requestLogout}>Logout</button>
			{/if}
		</nav>
	</div>
</header>
