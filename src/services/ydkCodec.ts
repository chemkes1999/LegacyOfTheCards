import { CardManager } from '../engine/CardManager';
import { EXTRA_DECK_MAX, MAIN_DECK_MAX, MAX_COPIES_PER_CARD } from '../engine/DeckManager';
import { SavedDeck } from '../types/tcg';

export interface YdkImportResult {
  mainDeckIds: string[];
  extraDeckIds: string[];
  missingYgoIds: number[];
  importedCount: number;
}

/**
 * Parses a standard YGOPro / EDOPro / YGOPRODeck `.ydk` file and resolves
 * numeric card passcodes against all currently registered cards in CardManager.
 */
export function parseYdk(content: string): YdkImportResult {
  const all = CardManager.getAll();
  const byYgoId = new Map<number, { id: string; isExtraDeck: boolean }>();
  for (const c of all) {
    if (c.ygoprodeckId !== undefined && !byYgoId.has(c.ygoprodeckId)) {
      byYgoId.set(c.ygoprodeckId, { id: c.id, isExtraDeck: c.isExtraDeck });
    }
  }

  let section: 'NONE' | 'MAIN' | 'EXTRA' | 'SIDE' = 'NONE';
  const mainDeckIds: string[] = [];
  const extraDeckIds: string[] = [];
  const missingSet = new Set<number>();
  const copyCounts = new Map<string, number>();

  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.startsWith('#main')) {
      section = 'MAIN';
      continue;
    }
    if (line.startsWith('#extra')) {
      section = 'EXTRA';
      continue;
    }
    if (line.startsWith('!side')) {
      section = 'SIDE';
      continue;
    }
    if (line.startsWith('#') || section === 'SIDE') continue;

    const numericId = Number(line);
    if (!Number.isInteger(numericId) || numericId <= 0) continue;

    const found = byYgoId.get(numericId);
    if (!found) {
      missingSet.add(numericId);
      continue;
    }

    const currentCopies = copyCounts.get(found.id) ?? 0;
    if (currentCopies >= MAX_COPIES_PER_CARD) continue;

    if (section === 'EXTRA' || found.isExtraDeck) {
      if (extraDeckIds.length < EXTRA_DECK_MAX) {
        extraDeckIds.push(found.id);
        copyCounts.set(found.id, currentCopies + 1);
      }
    } else {
      if (mainDeckIds.length < MAIN_DECK_MAX) {
        mainDeckIds.push(found.id);
        copyCounts.set(found.id, currentCopies + 1);
      }
    }
  }

  return {
    mainDeckIds,
    extraDeckIds,
    missingYgoIds: Array.from(missingSet),
    importedCount: mainDeckIds.length + extraDeckIds.length,
  };
}

/**
 * Exports a SavedDeck to standard `.ydk` text format for cards with a ygoprodeckId.
 */
export function exportYdk(deck: Pick<SavedDeck, 'name' | 'mainDeckIds' | 'extraDeckIds'>): {
  content: string;
  skippedCount: number;
} {
  let skippedCount = 0;
  const mainLines: string[] = [];
  const extraLines: string[] = [];

  for (const id of deck.mainDeckIds) {
    try {
      const def = CardManager.getDef(id);
      if (def.ygoprodeckId) mainLines.push(String(def.ygoprodeckId));
      else skippedCount++;
    } catch {
      skippedCount++;
    }
  }

  for (const id of deck.extraDeckIds) {
    try {
      const def = CardManager.getDef(id);
      if (def.ygoprodeckId) extraLines.push(String(def.ygoprodeckId));
      else skippedCount++;
    } catch {
      skippedCount++;
    }
  }

  const content = [
    `#created by Legacy of the Cards (${deck.name})`,
    '#main',
    ...mainLines,
    '#extra',
    ...extraLines,
    '!side',
    '',
  ].join('\n');

  return { content, skippedCount };
}
