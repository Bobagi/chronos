import { Prisma } from '@prisma/client';
import { LocalizedTextContent, SupportedLanguage } from './localization.types';

function getJsonObjectOrEmpty(candidate: Prisma.JsonValue): Prisma.JsonObject {
  if (typeof candidate === 'object' && candidate !== null && !Array.isArray(candidate)) {
    return candidate as Prisma.JsonObject;
  }
  return {};
}

function getTextOrDefault(value: Prisma.JsonValue | undefined, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

export function normalizeLocalizedTextContent(
  content: Prisma.JsonValue,
  fallbackText: string,
): LocalizedTextContent {
  const jsonObject = getJsonObjectOrEmpty(content);
  return {
    portuguese: getTextOrDefault(jsonObject.portuguese, fallbackText),
    english: getTextOrDefault(jsonObject.english, fallbackText),
    spanish: getTextOrDefault(jsonObject.spanish, fallbackText),
    mandarin: getTextOrDefault(jsonObject.mandarin, fallbackText),
    russian: getTextOrDefault(jsonObject.russian, fallbackText),
  };
}

export function createUniformLocalizedTextContent(text: string): LocalizedTextContent {
  return {
    portuguese: text,
    english: text,
    spanish: text,
    mandarin: text,
    russian: text,
  };
}

export function createLocalizedTextContent(
  portuguese: string,
  english: string,
  spanish: string,
  mandarin: string,
  russian: string,
): LocalizedTextContent {
  return {
    portuguese,
    english,
    spanish,
    mandarin,
    russian,
  };
}

export function createLocalizedTextContentFromPortugueseAndEnglish(
  portuguese: string,
  english: string,
): LocalizedTextContent {
  return createLocalizedTextContent(
    portuguese,
    english,
    english,
    english,
    english,
  );
}

export function selectLocalizedText(
  content: LocalizedTextContent,
  language: SupportedLanguage,
): string {
  switch (language) {
    case SupportedLanguage.Portuguese:
      return content.portuguese;
    case SupportedLanguage.English:
      return content.english;
    case SupportedLanguage.Spanish:
      return content.spanish;
    case SupportedLanguage.Mandarin:
      return content.mandarin;
    case SupportedLanguage.Russian:
      return content.russian;
    default:
      return content.english;
  }
}

export function parseSupportedLanguageCode(languageCode: string | undefined): SupportedLanguage {
  if (!languageCode) {
    return SupportedLanguage.English;
  }
  const normalizedCode = languageCode.trim().toLowerCase();
  if (normalizedCode === SupportedLanguage.Portuguese) {
    return SupportedLanguage.Portuguese;
  }
  if (normalizedCode === SupportedLanguage.English) {
    return SupportedLanguage.English;
  }
  if (normalizedCode === SupportedLanguage.Spanish) {
    return SupportedLanguage.Spanish;
  }
  if (normalizedCode === SupportedLanguage.Mandarin) {
    return SupportedLanguage.Mandarin;
  }
  if (normalizedCode === SupportedLanguage.Russian) {
    return SupportedLanguage.Russian;
  }
  return SupportedLanguage.English;
}
