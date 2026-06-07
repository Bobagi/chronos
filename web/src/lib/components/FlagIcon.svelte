<script lang="ts">
	import type { Locale } from '$lib/i18n/config';

	export let locale: Locale;
	export let size = 22;
</script>

<span class="flag" style="--flag-size:{size}px">
	{#if locale === 'pt'}
		<!-- Brazil -->
		<svg viewBox="0 0 24 16" role="img" aria-label="Português (Brasil)">
			<rect width="24" height="16" fill="#009b3a" />
			<polygon points="12,1.6 22.4,8 12,14.4 1.6,8" fill="#ffdf00" />
			<circle cx="12" cy="8" r="3.4" fill="#002776" />
		</svg>
	{:else if locale === 'es'}
		<!-- Spain -->
		<svg viewBox="0 0 24 16" role="img" aria-label="Español">
			<rect width="24" height="16" fill="#c60b1e" />
			<rect y="4" width="24" height="8" fill="#ffc400" />
		</svg>
	{:else}
		<!-- United Kingdom (English) -->
		<svg viewBox="0 0 24 16" role="img" aria-label="English">
			<rect width="24" height="16" fill="#012169" />
			<path d="M0,0 24,16 M24,0 0,16" stroke="#fff" stroke-width="3.2" fill="none" />
			<path d="M0,0 24,16 M24,0 0,16" stroke="#c8102e" stroke-width="1.3" fill="none" />
			<rect x="9.4" width="5.2" height="16" fill="#fff" />
			<rect y="5.4" width="24" height="5.2" fill="#fff" />
			<rect x="10.6" width="2.8" height="16" fill="#c8102e" />
			<rect y="6.6" width="24" height="2.8" fill="#c8102e" />
		</svg>
	{/if}
</span>

<style>
	.flag {
		display: inline-block;
		width: var(--flag-size);
		height: calc(var(--flag-size) * 0.6667);
		border-radius: 3px;
		overflow: hidden;
		box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.3);
		line-height: 0;
		flex: 0 0 auto;
	}
	.flag svg {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
