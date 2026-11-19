import { CARD_BY_ID, CARD_CATALOG } from '../data/cards';
import {
  Attribute,
  CardCategory,
  CardDefinition,
  CardInstance,
  CardSubtype,
  DuelState,
  PlayerId,
} from '../types/tcg';

export interface CardFilterOptions {
  query?: string;
  category?: CardCategory | 'ALL';
  subtype?: CardSubtype | 'ALL';
  attribute?: Attribute | 'ALL';
  minLevel?: number;
  maxLevel?: number;
  sortBy?: 'NAME' | 'ATK' | 'DEF' | 'LEVEL' | 'RARITY';
  sortDir?: 'ASC' | 'DESC';
  extraDeckOnly?: boolean;
  mainDeckOnly?: boolean;
}

const RARITY_ORDER: Record<string, number> = { UR: 4, SR: 3, R: 2, N: 1 };

export const SUBTYPE_LABELS_ES: Record<CardSubtype, string> = {
  normal: 'Normal',
  effect: 'Efecto',
  fusion: 'Fusión',
  synchro: 'Sincronía',
  xyz: 'Xyz',
  pendulum: 'Péndulo',
  link: 'Enlace',
  ritual: 'Ritual',
  continuous: 'Continua',
  equip: 'Equipo',
  field: 'Campo',
  quickplay: 'Juego Rápido',
  counter: 'Contraefecto',
};

export const ATTRIBUTE_LABELS_ES: Record<Attribute, string> = {
  LIGHT: 'LUZ',
  DARK: 'OSCURIDAD',
  FIRE: 'FUEGO',
  WATER: 'AGUA',
  WIND: 'VIENTO',
  EARTH: 'TIERRA',
  DIVINE: 'DIVINO',
};

export class CardManager {
  private static customCards: CardDefinition[] = [];
  private static customCardMap: Record<string, CardDefinition> = {};

  static registerCustomCards(cards: CardDefinition[]): void {
    this.customCards = [...cards];
    this.customCardMap = Object.fromEntries(cards.map((c) => [c.id, c]));
  }

  static getAll(): CardDefinition[] {
    if (this.customCards.length === 0) return CARD_CATALOG;
    const seen = new Set(CARD_CATALOG.map((c) => c.id));
    const extras = this.customCards.filter((c) => !seen.has(c.id));
    return [...CARD_CATALOG, ...extras];
  }

  static getDef(cardId: string): CardDefinition {
    const def = this.customCardMap[cardId] ?? CARD_BY_ID[cardId];
    if (!def) {
      throw new Error(`Carta desconocida en el registro: ${cardId}`);
    }
    return def;
  }

  static searchAndFilter(options: CardFilterOptions = {}): CardDefinition[] {
    const {
      query = '',
      category = 'ALL',
      subtype = 'ALL',
      attribute = 'ALL',
      minLevel = 0,
      maxLevel = 12,
      sortBy = 'ATK',
      sortDir = 'DESC',
      extraDeckOnly = false,
      mainDeckOnly = false,
    } = options;

    const q = query.trim().toLowerCase();

    const filtered = CARD_CATALOG.filter((card) => {
      if (q) {
        const matchesName = card.name.toLowerCase().includes(q);
        const matchesDesc = card.description.toLowerCase().includes(q);
        const matchesRace = (card.race ?? '').toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesRace) return false;
      }
      if (category !== 'ALL' && card.category !== category) return false;
      if (subtype !== 'ALL' && card.subtype !== subtype) return false;
      if (attribute !== 'ALL' && card.attribute !== attribute) return false;
      if (card.category === 'MONSTER') {
        if (card.level < minLevel || card.level > maxLevel) return false;
      }
      if (extraDeckOnly && !card.isExtraDeck) return false;
      if (mainDeckOnly && card.isExtraDeck) return false;
      return true;
    });

    const dir = sortDir === 'ASC' ? 1 : -1;
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'NAME':
          return a.name.localeCompare(b.name, 'es') * dir;
        case 'ATK':
          return (a.atk - b.atk || a.name.localeCompare(b.name, 'es')) * dir;
        case 'DEF':
          return (a.def - b.def || a.name.localeCompare(b.name, 'es')) * dir;
        case 'LEVEL':
          return (a.level - b.level || a.atk - b.atk) * dir;
        case 'RARITY':
          return ((RARITY_ORDER[a.rarity] ?? 0) - (RARITY_ORDER[b.rarity] ?? 0)) * dir;
        default:
          return 0;
      }
    });
  }

  static getContinuousFieldBonus(state: DuelState, controller: PlayerId): { atk: number; def: number } {
    const playerState = controller === 'player' ? state.player : state.opponent;
    let atk = 0;
    let def = 0;

    if (playerState.fieldZone && playerState.fieldZone.faceUp) {
      const fDef = this.getDef(playerState.fieldZone.cardId);
      for (const eff of fDef.effects) {
        if (eff.trigger === 'CONTINUOUS') {
          for (const op of eff.operations) {
            if (op.type === 'MODIFY_STATS') {
              atk += op.atkDelta ?? 0;
              def += op.defDelta ?? 0;
            }
          }
        }
      }
    }

    for (const st of playerState.spellsTraps) {
      if (!st || !st.faceUp) continue;
      const stDef = this.getDef(st.cardId);
      if (stDef.subtype === 'continuous') {
        for (const eff of stDef.effects) {
          if (eff.trigger === 'CONTINUOUS') {
            for (const op of eff.operations) {
              if (op.type === 'MODIFY_STATS') {
                atk += op.atkDelta ?? 0;
                def += op.defDelta ?? 0;
              }
            }
          }
        }
      }
    }

    return { atk, def };
  }

  static getEffectiveStats(state: DuelState, instance: CardInstance): { atk: number; def: number } {
    const def = this.getDef(instance.cardId);
    const onField = instance.location === 'MONSTER' || instance.location === 'EXTRA_MONSTER';
    const aura = onField && instance.faceUp
      ? this.getContinuousFieldBonus(state, instance.controller)
      : { atk: 0, def: 0 };

    return {
      atk: Math.max(0, def.atk + instance.atkModifier + aura.atk),
      def: Math.max(0, def.def + instance.defModifier + aura.def),
    };
  }

  static getAllFieldMonsters(state: DuelState, player: PlayerId): CardInstance[] {
    const ps = player === 'player' ? state.player : state.opponent;
    const list: CardInstance[] = [];
    for (const m of ps.monsters) {
      if (m) list.push(m);
    }
    for (const emz of state.extraMonsterZones) {
      if (emz && emz.controller === player) list.push(emz);
    }
    return list;
  }

  static getAllFieldCards(state: DuelState, player: PlayerId): CardInstance[] {
    const ps = player === 'player' ? state.player : state.opponent;
    const list = this.getAllFieldMonsters(state, player);
    for (const st of ps.spellsTraps) {
      if (st) list.push(st);
    }
    if (ps.fieldZone) list.push(ps.fieldZone);
    if (ps.pendulumLeft) list.push(ps.pendulumLeft);
    if (ps.pendulumRight) list.push(ps.pendulumRight);
    return list;
  }

  static findInstance(state: DuelState, uid: string): CardInstance | null {
    const players = [state.player, state.opponent];
    for (const p of players) {
      for (const m of p.monsters) if (m?.uid === uid) return m;
      for (const st of p.spellsTraps) if (st?.uid === uid) return st;
      if (p.fieldZone?.uid === uid) return p.fieldZone;
      if (p.pendulumLeft?.uid === uid) return p.pendulumLeft;
      if (p.pendulumRight?.uid === uid) return p.pendulumRight;
      for (const c of p.hand) if (c.uid === uid) return c;
      for (const c of p.deck) if (c.uid === uid) return c;
      for (const c of p.extraDeck) if (c.uid === uid) return c;
      for (const c of p.graveyard) if (c.uid === uid) return c;
      for (const c of p.banished) if (c.uid === uid) return c;
    }
    for (const emz of state.extraMonsterZones) {
      if (emz?.uid === uid) return emz;
    }
    return null;
  }
}
