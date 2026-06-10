<script lang="ts">
	// Small line-style icon set (stroke = currentColor) so buttons inherit the gold
	// theme. Replaces the emoji icons across the UI for a more cohesive look.
	export let name:
		| 'gallery'
		| 'friends'
		| 'settings'
		| 'flask'
		| 'hourglass'
		| 'logout'
		| 'play'
		| 'home'
		| 'surrender'
		| 'layout';
	export let size = '1.1em';
</script>

<svg
	class="ui-icon"
	width={size}
	height={size}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.7"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	focusable="false"
>
	{#if name === 'gallery'}
		<rect x="3" y="6" width="12" height="15" rx="2" />
		<path d="M8 6V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2h-1" />
		<path d="M6 16l2.5-3 2 2L13 12l2 3" />
	{:else if name === 'friends'}
		<circle cx="9" cy="8" r="3.2" />
		<path d="M3.5 20a5.5 5.5 0 0 1 11 0" />
		<path d="M16 5.2a3.2 3.2 0 0 1 0 6.2" />
		<path d="M16.5 20a5.5 5.5 0 0 0-2-4.3" />
	{:else if name === 'settings'}
		<line x1="4" y1="8" x2="20" y2="8" />
		<circle cx="9" cy="8" r="2.3" fill="currentColor" stroke="none" />
		<line x1="4" y1="16" x2="20" y2="16" />
		<circle cx="15" cy="16" r="2.3" fill="currentColor" stroke="none" />
	{:else if name === 'flask'}
		<path d="M9 3h6" />
		<path d="M10 3v6.5L4.8 18.4A2 2 0 0 0 6.5 21.5h11a2 2 0 0 0 1.7-3.1L14 9.5V3" />
		<path d="M7.5 15h9" />
	{:else if name === 'hourglass'}
		<path d="M6 3h12M6 21h12" />
		<path d="M8 3c0 4 8 5.5 8 9s-8 5-8 9" />
		<path d="M16 3c0 4-8 5.5-8 9s8 5 8 9" />
	{:else if name === 'logout'}
		<path d="M14 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8" />
		<path d="M16 8l4 4-4 4" />
		<line x1="20" y1="12" x2="10" y2="12" />
	{:else if name === 'play'}
		<path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none" />
	{:else if name === 'home'}
		<path d="M4 11l8-7 8 7" />
		<path d="M6 10v10h12V10" />
	{:else if name === 'surrender'}
		<line x1="5" y1="3" x2="5" y2="21" />
		<path d="M5 4h11l-1.6 3.2L16 11H5" />
	{:else if name === 'layout'}
		<rect x="3" y="4" width="18" height="16" rx="2" />
		<line x1="14" y1="4" x2="14" y2="20" />
	{/if}
</svg>

<style>
	.ui-icon {
		display: inline-block;
		vertical-align: -0.16em;
		flex: 0 0 auto;
	}
</style>
