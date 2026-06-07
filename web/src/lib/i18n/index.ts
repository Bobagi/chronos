import { browser } from '$app/environment';
import { derived, writable } from 'svelte/store';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from './config';
import en from './locales/en';
import es from './locales/es';
import pt from './locales/pt';

export type TranslationVars = Record<string, string | number>;

const dictionaries: Record<Locale, typeof en> = { en, pt, es };

/** The active locale. Driven from the server-resolved value in the root layout. */
export const locale = writable<Locale>(DEFAULT_LOCALE);

function lookup(dictionary: unknown, key: string): string | undefined {
	const value = key.split('.').reduce<unknown>((accumulator, part) => {
		if (accumulator && typeof accumulator === 'object' && part in accumulator) {
			return (accumulator as Record<string, unknown>)[part];
		}
		return undefined;
	}, dictionary);
	return typeof value === 'string' ? value : undefined;
}

function interpolate(template: string, vars?: TranslationVars): string {
	if (!vars) return template;
	return template.replace(/\{(\w+)\}/g, (match, name) =>
		name in vars ? String(vars[name]) : match
	);
}

function translate(activeLocale: Locale, key: string, vars?: TranslationVars): string {
	const raw = lookup(dictionaries[activeLocale], key) ?? lookup(dictionaries[DEFAULT_LOCALE], key);
	return raw === undefined ? key : interpolate(raw, vars);
}

/**
 * Reactive translator. Usage in markup:
 *   {$t('home.auth.title')}
 *   {$t('gallery.error', { message })}
 * Falls back to English, then to the key itself, so missing strings are visible
 * but never crash a page.
 */
export const t = derived(
	locale,
	($locale) =>
		(key: string, vars?: TranslationVars): string =>
			translate($locale, key, vars)
);

/** Set the initial locale (called from the root layout with the SSR value). */
export function initLocale(value: Locale): void {
	locale.set(value);
}

/** Switch language: updates the store (instant UI) and persists a cookie. */
export function setLocale(value: Locale): void {
	if (!isLocale(value)) return;
	locale.set(value);
	if (browser) {
		document.cookie = `${LOCALE_COOKIE}=${value}; path=/; max-age=31536000; SameSite=Lax`;
		document.documentElement.lang = value;
	}
}
