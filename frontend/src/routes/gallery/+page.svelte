<script lang="ts">
	import type { ChronosCardCatalogItem, ChronosCardCollection } from '$lib/api/GameClient';
	import { fetchChronosCardCatalog } from '$lib/api/GameClient';
	import CardComposite from '$lib/components/CardComposite.svelte';
	import '$lib/styles/routes/galleryPage.css';
	import { onMount } from 'svelte';
	import '../game/game.css';

	const defaultFrameOverlayImageUrl = '/frames/default.png';
	const titleOverlayImageUrl = '/frames/title.png';
	const defaultCollectionImageUrl = '/icons/logo.png';
	const localCollectionLogoDirectoryPath = '/collection';
	const localCollectionLogoFileExtension = 'png';

	let isLoadingCards = true;
	let errorMessageText: string | null = null;
	let chronosCollections: ChronosCardCollection[] = [];
	let selectedCardItem: ChronosCardCatalogItem | null = null;

	function getCollectionDisplayName(collection: ChronosCardCollection): string {
		return (
			collection.name?.trim() ||
			collection.slug?.trim() ||
			collection.id?.trim() ||
			'Card Collection'
		);
	}

	function resolveAssetUrl(imageUrl?: string | null): string | null {
		if (!imageUrl) {
			return null;
		}
		if (/^https?:\/\//i.test(imageUrl)) {
			return imageUrl;
		}
		if (imageUrl.startsWith('/')) {
			return imageUrl;
		}
		return `/${imageUrl.replace(/^\/+/, '')}`;
	}

	function sanitizeCollectionIdentifier(candidateIdentifier?: string | null): string | null {
		if (!candidateIdentifier) {
			return null;
		}
		const trimmedIdentifier = candidateIdentifier.trim();
		if (!trimmedIdentifier) {
			return null;
		}
		const normalizedIdentifier = trimmedIdentifier
			.normalize('NFD')
			.replace(/[\u0300-\u036f]/g, '')
			.replace(/[^a-zA-Z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.toLowerCase();
		return normalizedIdentifier || null;
	}

	function extractIdentifierFromImagePath(imagePath?: string | null): string | null {
		if (!imagePath) {
			return null;
		}
		const trimmedPath = imagePath.trim();
		if (!trimmedPath) {
			return null;
		}
		const segments = trimmedPath.split(/[\\/]/);
		const filename = segments[segments.length - 1];
		if (!filename) {
			return null;
		}
		const baseName = filename.split('.').shift();
		if (!baseName) {
			return null;
		}
		return sanitizeCollectionIdentifier(baseName);
	}

	function resolveLocalCollectionLogoImageUrl(collection: ChronosCardCollection): string | null {
		const possibleIdentifiers: Array<string | null | undefined> = [
			collection.slug,
			extractIdentifierFromImagePath(collection.imageUrl),
			collection.id,
			collection.name
		];
		for (const identifier of possibleIdentifiers) {
			const sanitizedIdentifier = sanitizeCollectionIdentifier(identifier);
			if (sanitizedIdentifier) {
				return `${localCollectionLogoDirectoryPath}/${sanitizedIdentifier}.${localCollectionLogoFileExtension}`;
			}
		}
		return null;
	}

	function getCollectionLogoImageUrl(collection: ChronosCardCollection): string {
		return (
			resolveLocalCollectionLogoImageUrl(collection) ??
			resolveAssetUrl(collection.imageUrl) ??
			defaultCollectionImageUrl
		);
	}

	onMount(async () => {
		isLoadingCards = true;
		errorMessageText = null;
		try {
			const data = await fetchChronosCardCatalog();
			chronosCollections = data;
		} catch (e) {
			errorMessageText = (e as Error).message;
		} finally {
			isLoadingCards = false;
		}
	});

	function openCardModal(cardItem: ChronosCardCatalogItem) {
		selectedCardItem = cardItem;
	}
	function closeCardModal() {
		selectedCardItem = null;
	}
</script>

<svelte:window on:keydown={(e) => e.key === 'Escape' && (selectedCardItem = null)} />

<div class="gallery-panel">
	<header class="panel-header">
		<div style="display: flex; justify-content: space-between; width: 100%;">
			<a href="/" class="home-btn" style="min-width: 10vw;">← Home</a>
			<h1 class="panel-title">Collections</h1>
			<span style="min-width: 10vw;"></span>
		</div>
		<p class="panel-sub">Click a card to enlarge it.</p>
	</header>

	{#if isLoadingCards}
		<p class="status">Loading cards…</p>
	{:else if errorMessageText}
		<p class="status error">Error: {errorMessageText}</p>
	{:else if !chronosCollections.length}
		<p class="status">No collections found.</p>
	{:else}
		{#each chronosCollections as collection (collection.slug ?? collection.id ?? collection.name)}
			<fieldset style="border-radius: 10px; border-color: rgba(255, 255, 255, 0.15);">
				<legend>{getCollectionDisplayName(collection)}</legend>
				<div class="collection-header">
					<img
						class="gallery-logo"
						src={getCollectionLogoImageUrl(collection)}
						alt={getCollectionDisplayName(collection)}
						loading="lazy"
						decoding="async"
					/>
					{#if collection.description}
						<p class="collection-description">{collection.description}</p>
					{/if}
				</div>
				{#if !collection.cards.length}
					<p class="status">No cards found in this collection.</p>
				{:else}
					<div class="gallery-grid">
						{#each collection.cards as cardItem (cardItem.code + cardItem.name)}
							<button
								type="button"
								class="card-tile"
								title={cardItem.name}
								on:click={() => openCardModal(cardItem)}
							>
								<div class="card-wrap">
									<CardComposite
										artImageUrl={resolveAssetUrl(cardItem.imageUrl) ?? ''}
										frameImageUrl={defaultFrameOverlayImageUrl}
										titleImageUrl={titleOverlayImageUrl}
										titleText={cardItem.name ?? cardItem.code}
										aspectWidth={430}
										aspectHeight={670}
										artObjectFit="cover"
										enableTilt={true}
										descriptionText={cardItem.description ?? ''}
										magicValue={cardItem.magic ?? 0}
										mightValue={cardItem.might ?? 0}
										fireValue={cardItem.fire ?? 0}
										cornerNumberValue={cardItem.number ?? 0}
									/>
								</div>
							</button>
						{/each}
					</div>
				{/if}
			</fieldset>
		{/each}
	{/if}
</div>

{#if selectedCardItem}
	<div
		class="modal-backdrop"
		role="button"
		tabindex="0"
		on:click|self={closeCardModal}
		on:keydown={(e) => (e.key === 'Enter' || e.key === ' ') && closeCardModal()}
	>
		<div class="modal-card">
			<button class="modal-close" on:click={closeCardModal} aria-label="Close">×</button>
			<div class="modal-body">
				<div class="modal-inner">
					<div class="modal-card-wrap">
						<CardComposite
							artImageUrl={resolveAssetUrl(selectedCardItem.imageUrl) ?? ''}
							frameImageUrl={defaultFrameOverlayImageUrl}
							titleImageUrl={titleOverlayImageUrl}
							titleText={selectedCardItem.name ?? selectedCardItem.code}
							aspectWidth={430}
							aspectHeight={670}
							artObjectFit="cover"
							enableTilt={true}
							descriptionText={selectedCardItem.description ?? ''}
							magicValue={selectedCardItem.magic ?? 0}
							mightValue={selectedCardItem.might ?? 0}
							fireValue={selectedCardItem.fire ?? 0}
							cornerNumberValue={selectedCardItem.number ?? 0}
						/>
					</div>

					<div class="meta">
						<h2>{selectedCardItem.name ?? selectedCardItem.code}</h2>
						<p class="mono code">{selectedCardItem.code}</p>
						<div class="attrs">
							<span>🧙 {selectedCardItem.magic ?? 0}</span>
							<span>💪 {selectedCardItem.might ?? 0}</span>
							<span>🔥 {selectedCardItem.fire ?? 0}</span>
						</div>
						{#if selectedCardItem.description}
							<p class="desc">{selectedCardItem.description}</p>
						{/if}
					</div>
				</div>
			</div>
		</div>
	</div>
{/if}
