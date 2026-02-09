export interface ChronosCard {
  code: string;
  name: string;
  description: string;
  image: string;
  damage: number;
  heal: number;
  fire: number;
  might: number;
  magic: number;
  number: number;
}

export interface ChronosCardCatalogCollectionInfo {
  id?: string;
  slug?: string;
  name?: string;
  description?: string | null;
  manufacturer?: string | null;
  releaseDate?: string | null;
  totalCards?: number | null;
  imageUrl?: string | null;
}

export interface ChronosCardCatalogItem {
  code: string;
  name: string;
  description: string;
  image?: string;
  imageUrl?: string;
  might: number;
  fire: number;
  magic: number;
  number: number;
  collectionId?: string;
  collectionSlug?: string;
  collectionName?: string;
  collectionImageUrl?: string | null;
  collection?: ChronosCardCatalogCollectionInfo;
}

export interface ChronosCardCollection extends ChronosCardCatalogCollectionInfo {
  name: string;
  cards: ChronosCardCatalogItem[];
}
