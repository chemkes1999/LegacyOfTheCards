import { CardDefinition } from '../types/tcg';
import { mapYgoCardToDefinition, YgoApiCard } from './ygoprodeckAdapter';

const API_BASE = 'https://db.ygoprodeck.com/api/v7/cardinfo.php';
const CACHE_PREFIX = 'ygo_api_cache_v1_';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

export type YgoApiLanguage = 'en' | 'fr' | 'de' | 'it' | 'pt';

export interface YgoSearchParams {
  fname?: string;
  type?: string;
  attribute?: string;
  num?: number;
  offset?: number;
  language?: YgoApiLanguage;
}

export interface YgoSearchResponse {
  cards: CardDefinition[];
  totalRows: number;
  hasMore: boolean;
}

interface CachedEntry {
  timestamp: number;
  payload: YgoSearchResponse;
}

const memoryCache = new Map<string, CachedEntry>();

function readCache(key: string): YgoSearchResponse | null {
  const mem = memoryCache.get(key);
  if (mem && Date.now() - mem.timestamp < CACHE_TTL_MS) {
    return mem.payload;
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(CACHE_PREFIX + key);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CachedEntry;
      if (Date.now() - parsed.timestamp < CACHE_TTL_MS) {
        memoryCache.set(key, parsed);
        return parsed.payload;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function writeCache(key: string, payload: YgoSearchResponse): void {
  const entry: CachedEntry = { timestamp: Date.now(), payload };
  memoryCache.set(key, entry);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
    } catch {
      // Ignore quota errors
    }
  }
}

export async function searchOfficialCards(
  params: YgoSearchParams,
  signal?: AbortSignal
): Promise<YgoSearchResponse> {
  const url = new URL(API_BASE);
  const num = params.num ?? 24;
  const offset = params.offset ?? 0;

  if (params.fname?.trim()) url.searchParams.set('fname', params.fname.trim());
  if (params.type && params.type !== 'ALL') url.searchParams.set('type', params.type);
  if (params.attribute && params.attribute !== 'ALL') url.searchParams.set('attribute', params.attribute);
  if (params.language && params.language !== 'en') {
    url.searchParams.set('language', params.language);
  }
  url.searchParams.set('num', String(num));
  url.searchParams.set('offset', String(offset));

  const cacheKey = url.search;
  const cached = readCache(cacheKey);
  if (cached) return cached;

  const res = await fetch(url.toString(), { signal });
  if (res.status === 400) {
    // YGOPRODeck returns 400 when no cards match the query
    const empty: YgoSearchResponse = { cards: [], totalRows: 0, hasMore: false };
    writeCache(cacheKey, empty);
    return empty;
  }
  if (!res.ok) {
    throw new Error(`Error al consultar YGOPRODeck (HTTP ${res.status})`);
  }

  const json = (await res.json()) as {
    data?: YgoApiCard[];
    meta?: { total_rows?: number; rows_remaining?: number };
  };

  const cards = (json.data ?? []).map((raw) => mapYgoCardToDefinition(raw));
  const totalRows = json.meta?.total_rows ?? cards.length;
  const hasMore = (json.meta?.rows_remaining ?? 0) > 0;
  const payload: YgoSearchResponse = { cards, totalRows, hasMore };
  writeCache(cacheKey, payload);
  return payload;
}

export async function fetchAllOfficialCards(
  onProgress?: (status: string) => void,
  signal?: AbortSignal
): Promise<CardDefinition[]> {
  const { inferCardEffectsFromDescription } = await import('./ygoprodeckEffectParser');

  onProgress?.('Descargando catálogo completo desde YGOPRODeck (~15 MB)...');
  const res = await fetch(API_BASE, { signal });
  if (!res.ok) {
    throw new Error(`Error al descargar el catálogo completo (HTTP ${res.status})`);
  }

  onProgress?.('Procesando cartas y detectando efectos jugables...');
  const json = (await res.json()) as { data?: YgoApiCard[] };
  const rawList = json.data ?? [];

  const result: CardDefinition[] = [];
  for (const raw of rawList) {
    const t = (raw.type || '').toLowerCase();
    // Skip non-deck cards such as Tokens and Speed Duel Skill Cards
    if (t.includes('token') || t.includes('skill')) continue;

    const base = mapYgoCardToDefinition(raw);
    const effects = inferCardEffectsFromDescription(base);
    result.push(effects.length > 0 ? { ...base, effects } : base);
  }

  return result;
}
