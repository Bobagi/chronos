import { LocalizedTextContent } from '../localization/localization.types';

export interface CardCatalogEntry {
  id: string;
  code: string;
  localizedName: LocalizedTextContent;
  localizedDescription: LocalizedTextContent;
  displayName: string;
  displayDescription: string;
  number: number;
  damage: number | null;
  heal: number | null;
  imageUrl: string;
  might: number;
  fire: number;
  magic: number;
  collectionId: string;
  createdAt: Date;
  updatedAt: Date;
}
