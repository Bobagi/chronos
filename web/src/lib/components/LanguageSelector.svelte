<script lang="ts">
	import { locale, setLocale, t } from '$lib/i18n';
	import { LOCALE_LABELS, SUPPORTED_LOCALES, type Locale } from '$lib/i18n/config';
	import FlagIcon from './FlagIcon.svelte';

	let open = false;

	function choose(next: Locale) {
		setLocale(next);
		open = false;
	}

	function onDocumentClick(event: MouseEvent) {
		const target = event.target as HTMLElement | null;
		if (open && target && !target.closest('.lang-select')) open = false;
	}
</script>

<svelte:window
	on:click={onDocumentClick}
	on:keydown={(event) => event.key === 'Escape' && (open = false)}
/>

<div class="lang-select">
	<button
		type="button"
		class="lang-trigger"
		aria-haspopup="listbox"
		aria-expanded={open}
		aria-label={$t('language.change')}
		on:click|stopPropagation={() => (open = !open)}
	>
		<FlagIcon locale={$locale} />
		<span class="lang-code">{$locale.toUpperCase()}</span>
		<svg class="chev" class:up={open} viewBox="0 0 12 8" aria-hidden="true">
			<path d="M1 1l5 5 5-5" fill="none" stroke="currentColor" stroke-width="1.6" />
		</svg>
	</button>

	{#if open}
		<ul class="lang-menu" role="listbox" aria-label={$t('language.change')}>
			{#each SUPPORTED_LOCALES as option (option)}
				<li>
					<button
						type="button"
						role="option"
						aria-selected={option === $locale}
						class="lang-option"
						class:active={option === $locale}
						on:click={() => choose(option)}
					>
						<FlagIcon locale={option} />
						<span>{LOCALE_LABELS[option]}</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.lang-select {
		position: relative;
	}

	.lang-trigger {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 7px 10px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.05);
		border: 1px solid var(--border);
		color: var(--text);
		cursor: pointer;
		font: inherit;
		transition:
			background 0.15s ease,
			border-color 0.15s ease;
	}
	.lang-trigger:hover {
		background: rgba(231, 178, 74, 0.12);
		border-color: var(--border-strong);
	}

	.lang-code {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.08em;
	}

	.chev {
		width: 10px;
		height: 7px;
		color: var(--muted);
		transition: transform 0.18s ease;
	}
	.chev.up {
		transform: rotate(180deg);
	}

	.lang-menu {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		margin: 0;
		padding: 6px;
		list-style: none;
		min-width: 168px;
		background: var(--surface-solid);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		box-shadow: var(--shadow);
		z-index: 60;
		animation: lang-fade 0.14s ease both;
	}
	@keyframes lang-fade {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
	}

	.lang-option {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 9px 10px;
		border: none;
		border-radius: var(--radius-xs);
		background: transparent;
		color: var(--text);
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition: background 0.12s ease;
	}
	.lang-option:hover {
		background: rgba(255, 255, 255, 0.06);
	}
	.lang-option.active {
		background: rgba(231, 178, 74, 0.14);
		color: var(--gold-1);
		font-weight: 600;
	}
</style>
