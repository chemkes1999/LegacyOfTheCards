import { SavedDeck } from '../types/tcg';
import { CardManager } from './CardManager';

export interface DeckValidationResult {
  valid: boolean;
  mainCount: number;
  extraCount: number;
  errors: string[];
}

export interface DeckStatistics {
  mainCount: number;
  extraCount: number;
  monsters: number;
  spells: number;
  traps: number;
  avgAtk: number;
  levelCounts: Record<number, number>;
  attributeCounts: Record<string, number>;
}

export const MAIN_DECK_MIN = 40;
export const MAIN_DECK_MAX = 60;
export const EXTRA_DECK_MAX = 15;
export const MAX_COPIES_PER_CARD = 3;

export class DeckManager {
  static validateDeck(deck: Pick<SavedDeck, 'mainDeckIds' | 'extraDeckIds'>): DeckValidationResult {
    const errors: string[] = [];
    const mainCount = deck.mainDeckIds.length;
    const extraCount = deck.extraDeckIds.length;

    if (mainCount < MAIN_DECK_MIN) {
      errors.push(`El Mazo Principal requiere al menos ${MAIN_DECK_MIN} cartas (actual: ${mainCount}).`);
    }
    if (mainCount > MAIN_DECK_MAX) {
      errors.push(`El Mazo Principal no puede superar ${MAIN_DECK_MAX} cartas (actual: ${mainCount}).`);
    }
    if (extraCount > EXTRA_DECK_MAX) {
      errors.push(`El Deck Extra no puede superar ${EXTRA_DECK_MAX} cartas (actual: ${extraCount}).`);
    }

    const counts: Record<string, number> = {};
    for (const id of deck.mainDeckIds) {
      const def = CardManager.getDef(id);
      if (def.isExtraDeck) {
        errors.push(`"${def.name}" pertenece al Deck Extra, no al Mazo Principal.`);
      }
      counts[id] = (counts[id] ?? 0) + 1;
    }
    for (const id of deck.extraDeckIds) {
      const def = CardManager.getDef(id);
      if (!def.isExtraDeck) {
        errors.push(`"${def.name}" pertenece al Mazo Principal, no al Deck Extra.`);
      }
      counts[id] = (counts[id] ?? 0) + 1;
    }

    for (const [id, count] of Object.entries(counts)) {
      if (count > MAX_COPIES_PER_CARD) {
        const def = CardManager.getDef(id);
        errors.push(`Máximo ${MAX_COPIES_PER_CARD} copias de "${def.name}" (tienes ${count}).`);
      }
    }

    return {
      valid: errors.length === 0,
      mainCount,
      extraCount,
      errors,
    };
  }

  static getCopyCount(deck: Pick<SavedDeck, 'mainDeckIds' | 'extraDeckIds'>, cardId: string): number {
    let count = 0;
    for (const id of deck.mainDeckIds) if (id === cardId) count++;
    for (const id of deck.extraDeckIds) if (id === cardId) count++;
    return count;
  }

  static addCardToDeck(deck: SavedDeck, cardId: string): { deck: SavedDeck; error?: string } {
    const def = CardManager.getDef(cardId);
    const currentCopies = this.getCopyCount(deck, cardId);
    if (currentCopies >= MAX_COPIES_PER_CARD) {
      return { deck, error: `Ya tienes el máximo de ${MAX_COPIES_PER_CARD} copias de "${def.name}".` };
    }

    if (def.isExtraDeck) {
      if (deck.extraDeckIds.length >= EXTRA_DECK_MAX) {
        return { deck, error: `El Deck Extra está lleno (${EXTRA_DECK_MAX}/${EXTRA_DECK_MAX}).` };
      }
      return {
        deck: {
          ...deck,
          extraDeckIds: [...deck.extraDeckIds, cardId],
          updatedAt: Date.now(),
        },
      };
    } else {
      if (deck.mainDeckIds.length >= MAIN_DECK_MAX) {
        return { deck, error: `El Mazo Principal está lleno (${MAIN_DECK_MAX}/${MAIN_DECK_MAX}).` };
      }
      return {
        deck: {
          ...deck,
          mainDeckIds: [...deck.mainDeckIds, cardId],
          updatedAt: Date.now(),
        },
      };
    }
  }

  static removeCardFromDeck(deck: SavedDeck, cardId: string): SavedDeck {
    const def = CardManager.getDef(cardId);
    if (def.isExtraDeck) {
      const idx = deck.extraDeckIds.indexOf(cardId);
      if (idx === -1) return deck;
      const next = [...deck.extraDeckIds];
      next.splice(idx, 1);
      return { ...deck, extraDeckIds: next, updatedAt: Date.now() };
    } else {
      const idx = deck.mainDeckIds.indexOf(cardId);
      if (idx === -1) return deck;
      const next = [...deck.mainDeckIds];
      next.splice(idx, 1);
      return { ...deck, mainDeckIds: next, updatedAt: Date.now() };
    }
  }

  static computeStats(deck: Pick<SavedDeck, 'mainDeckIds' | 'extraDeckIds'>): DeckStatistics {
    let monsters = 0;
    let spells = 0;
    let traps = 0;
    let totalAtk = 0;
    const levelCounts: Record<number, number> = {};
    const attributeCounts: Record<string, number> = {};

    for (const id of deck.mainDeckIds) {
      const def = CardManager.getDef(id);
      if (def.category === 'MONSTER') {
        monsters++;
        totalAtk += def.atk;
        levelCounts[def.level] = (levelCounts[def.level] ?? 0) + 1;
        if (def.attribute) {
          attributeCounts[def.attribute] = (attributeCounts[def.attribute] ?? 0) + 1;
        }
      } else if (def.category === 'SPELL') {
        spells++;
      } else {
        traps++;
      }
    }

    return {
      mainCount: deck.mainDeckIds.length,
      extraCount: deck.extraDeckIds.length,
      monsters,
      spells,
      traps,
      avgAtk: monsters > 0 ? Math.round(totalAtk / monsters) : 0,
      levelCounts,
      attributeCounts,
    };
  }
}
