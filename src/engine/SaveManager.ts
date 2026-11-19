import { CARD_CATALOG } from '../data/cards';
import { DEFAULT_SAVED_DECKS } from '../data/decks';
import {
  CardDefinition,
  DuelHistoryRecord,
  GameSettings,
  PlayerProfileSave,
  SavedDeck,
} from '../types/tcg';

const STORAGE_KEY = 'duel_arena_legacy_save_v1';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export const DEFAULT_SETTINGS: GameSettings = {
  masterVolume: 0.65,
  musicEnabled: true,
  sfxEnabled: true,
  cameraDynamics: true,
  autoChainPrompt: true,
  duelSpeed: 'NORMAL',
};

function createInitialCollection(): Record<string, number> {
  const collection: Record<string, number> = {};
  for (const card of CARD_CATALOG) {
    collection[card.id] = 3;
  }
  return collection;
}

export function createDefaultSave(): PlayerProfileSave {
  return {
    activeDeckId: DEFAULT_SAVED_DECKS[0].id,
    decks: DEFAULT_SAVED_DECKS.map((d) => ({ ...d })),
    unlockedCardIds: createInitialCollection(),
    customImportedCards: [],
    completedStageIds: [],
    duelPoints: 500,
    history: [],
    settings: { ...DEFAULT_SETTINGS },
  };
}

export class SaveManager {
  private static memoryFallback: Record<string, string> = {};

  private static getStorage(customStorage?: StorageLike): StorageLike {
    if (customStorage) return customStorage;
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    return {
      getItem: (k) => this.memoryFallback[k] ?? null,
      setItem: (k, v) => {
        this.memoryFallback[k] = v;
      },
      removeItem: (k) => {
        delete this.memoryFallback[k];
      },
    };
  }

  static load(customStorage?: StorageLike): PlayerProfileSave {
    const storage = this.getStorage(customStorage);
    try {
      const raw = storage.getItem(STORAGE_KEY);
      if (!raw) {
        const fresh = createDefaultSave();
        this.save(fresh, storage);
        return fresh;
      }
      const parsed = JSON.parse(raw) as Partial<PlayerProfileSave>;
      const fallback = createDefaultSave();
      const customImportedCards = Array.isArray(parsed.customImportedCards)
        ? parsed.customImportedCards
        : [];
      return {
        activeDeckId: parsed.activeDeckId || fallback.activeDeckId,
        decks: Array.isArray(parsed.decks) && parsed.decks.length > 0 ? parsed.decks : fallback.decks,
        unlockedCardIds: { ...fallback.unlockedCardIds, ...(parsed.unlockedCardIds || {}) },
        customImportedCards,
        completedStageIds: Array.isArray(parsed.completedStageIds) ? parsed.completedStageIds : [],
        duelPoints: typeof parsed.duelPoints === 'number' ? parsed.duelPoints : fallback.duelPoints,
        history: Array.isArray(parsed.history) ? parsed.history : [],
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
      };
    } catch {
      return createDefaultSave();
    }
  }

  static save(profile: PlayerProfileSave, customStorage?: StorageLike): void {
    const storage = this.getStorage(customStorage);
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(profile));
    } catch {
      // Ignore quota errors gracefully
    }
  }

  static importCustomCard(
    profile: PlayerProfileSave,
    card: CardDefinition,
    customStorage?: StorageLike
  ): PlayerProfileSave {
    const existing = profile.customImportedCards ?? [];
    const filtered = existing.filter((c) => c.id !== card.id);
    const next: PlayerProfileSave = {
      ...profile,
      customImportedCards: [...filtered, card],
      unlockedCardIds: {
        ...profile.unlockedCardIds,
        [card.id]: 3,
      },
    };
    this.save(next, customStorage);
    return next;
  }

  static removeCustomCard(
    profile: PlayerProfileSave,
    cardId: string,
    customStorage?: StorageLike
  ): PlayerProfileSave {
    const existing = profile.customImportedCards ?? [];
    const next: PlayerProfileSave = {
      ...profile,
      customImportedCards: existing.filter((c) => c.id !== cardId),
    };
    this.save(next, customStorage);
    return next;
  }

  static upsertDeck(profile: PlayerProfileSave, deck: SavedDeck, customStorage?: StorageLike): PlayerProfileSave {
    const exists = profile.decks.some((d) => d.id === deck.id);
    const decks = exists
      ? profile.decks.map((d) => (d.id === deck.id ? deck : d))
      : [...profile.decks, deck];
    const next = { ...profile, decks };
    this.save(next, customStorage);
    return next;
  }

  static deleteDeck(profile: PlayerProfileSave, deckId: string, customStorage?: StorageLike): PlayerProfileSave {
    if (profile.decks.length <= 1) return profile;
    const decks = profile.decks.filter((d) => d.id !== deckId);
    const activeDeckId = profile.activeDeckId === deckId ? decks[0].id : profile.activeDeckId;
    const next = { ...profile, decks, activeDeckId };
    this.save(next, customStorage);
    return next;
  }

  static recordDuelResult(
    profile: PlayerProfileSave,
    record: DuelHistoryRecord,
    rewardPoints: number,
    completedStageId?: string,
    unlockedCardId?: string,
    customStorage?: StorageLike
  ): PlayerProfileSave {
    const completedStageIds =
      completedStageId && !profile.completedStageIds.includes(completedStageId)
        ? [...profile.completedStageIds, completedStageId]
        : profile.completedStageIds;

    const unlockedCardIds = { ...profile.unlockedCardIds };
    if (unlockedCardId) {
      unlockedCardIds[unlockedCardId] = Math.min(3, (unlockedCardIds[unlockedCardId] ?? 0) + 1);
    }

    const next: PlayerProfileSave = {
      ...profile,
      duelPoints: profile.duelPoints + rewardPoints,
      completedStageIds,
      unlockedCardIds,
      history: [record, ...profile.history].slice(0, 40),
    };
    this.save(next, customStorage);
    return next;
  }

  static resetSave(customStorage?: StorageLike): PlayerProfileSave {
    const storage = this.getStorage(customStorage);
    storage.removeItem(STORAGE_KEY);
    const fresh = createDefaultSave();
    this.save(fresh, storage);
    return fresh;
  }
}
