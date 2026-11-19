import {
  BattlePosition,
  CardInstance,
  DuelState,
  PlayerId,
  SummonMethod,
} from '../types/tcg';
import { CardManager } from './CardManager';
import { TurnManager } from './TurnManager';

export interface SummonValidation {
  canSummon: boolean;
  requiredTributes: number;
  method: SummonMethod;
  reason?: string;
}

export class SummonManager {
  static getFirstEmptyMonsterSlot(state: DuelState, player: PlayerId): number {
    const ps = player === 'player' ? state.player : state.opponent;
    return ps.monsters.findIndex((m) => m === null);
  }

  static getAvailableExtraMonsterSlot(state: DuelState, player: PlayerId): number {
    // Player can occupy an empty EMZ as long as they don't already control one
    const alreadyControls = state.extraMonsterZones.some((m) => m && m.controller === player);
    if (alreadyControls) return -1;
    return state.extraMonsterZones.findIndex((m) => m === null);
  }

  static getRequiredTributes(level: number): number {
    if (level <= 4) return 0;
    if (level <= 6) return 1;
    return 2;
  }

  static validateNormalSummon(
    state: DuelState,
    player: PlayerId,
    cardUid: string,
    isSet: boolean = false
  ): SummonValidation {
    const ps = player === 'player' ? state.player : state.opponent;
    if (state.activePlayer !== player) {
      return { canSummon: false, requiredTributes: 0, method: 'NORMAL', reason: 'No es tu turno.' };
    }
    if (state.phase !== 'MAIN1' && state.phase !== 'MAIN2') {
      return { canSummon: false, requiredTributes: 0, method: 'NORMAL', reason: 'Solo en Main Phase.' };
    }
    if (ps.normalSummonsRemaining <= 0) {
      return { canSummon: false, requiredTributes: 0, method: 'NORMAL', reason: 'Ya usaste tu Invocación Normal este turno.' };
    }

    const card = ps.hand.find((c) => c.uid === cardUid);
    if (!card) {
      return { canSummon: false, requiredTributes: 0, method: 'NORMAL', reason: 'La carta no está en tu mano.' };
    }

    const def = CardManager.getDef(card.cardId);
    if (def.category !== 'MONSTER' || def.isExtraDeck || def.subtype === 'ritual') {
      return { canSummon: false, requiredTributes: 0, method: 'NORMAL', reason: 'No se puede Invocar Normalmente.' };
    }

    const reqTributes = this.getRequiredTributes(def.level);
    const fieldMonsters = CardManager.getAllFieldMonsters(state, player);
    if (fieldMonsters.length < reqTributes) {
      return {
        canSummon: false,
        requiredTributes: reqTributes,
        method: reqTributes > 0 ? 'TRIBUTE' : isSet ? 'SET' : 'NORMAL',
        reason: `Requiere ${reqTributes} sacrificio(s).`,
      };
    }

    const emptySlot = this.getFirstEmptyMonsterSlot(state, player);
    // If sacrificing frees up a main monster zone, allow it
    const mainTributeCount = ps.monsters.filter(Boolean).length;
    if (emptySlot === -1 && (reqTributes === 0 || mainTributeCount === 0)) {
      return { canSummon: false, requiredTributes: reqTributes, method: 'NORMAL', reason: 'Tu zona de monstruos está llena.' };
    }

    return {
      canSummon: true,
      requiredTributes: reqTributes,
      method: reqTributes > 0 ? 'TRIBUTE' : isSet ? 'SET' : 'NORMAL',
    };
  }

  static validateSynchroSummon(state: DuelState, player: PlayerId, extraCardUid: string): {
    canSummon: boolean;
    validCombinations: CardInstance[][];
    reason?: string;
  } {
    const ps = player === 'player' ? state.player : state.opponent;
    if (state.activePlayer !== player || (state.phase !== 'MAIN1' && state.phase !== 'MAIN2')) {
      return { canSummon: false, validCombinations: [], reason: 'Solo disponible en tu Main Phase.' };
    }
    const target = ps.extraDeck.find((c) => c.uid === extraCardUid);
    if (!target) return { canSummon: false, validCombinations: [], reason: 'Carta no encontrada.' };
    const def = CardManager.getDef(target.cardId);
    if (def.subtype !== 'synchro') {
      return { canSummon: false, validCombinations: [], reason: 'No es un monstruo de Sincronía.' };
    }

    const fieldMons = CardManager.getAllFieldMonsters(state, player).filter((m) => {
      const md = CardManager.getDef(m.cardId);
      return m.faceUp && md.subtype !== 'xyz' && md.subtype !== 'link';
    });

    const tuners = fieldMons.filter((m) => CardManager.getDef(m.cardId).isTuner);
    const nonTuners = fieldMons.filter((m) => !CardManager.getDef(m.cardId).isTuner);

    const validCombinations: CardInstance[][] = [];
    for (const tuner of tuners) {
      const tunerLv = CardManager.getDef(tuner.cardId).level;
      // Check 1 non-tuner or 2 non-tuners summing to def.level
      for (let i = 0; i < nonTuners.length; i++) {
        const lv1 = CardManager.getDef(nonTuners[i].cardId).level;
        if (tunerLv + lv1 === def.level) {
          validCombinations.push([tuner, nonTuners[i]]);
        }
        for (let j = i + 1; j < nonTuners.length; j++) {
          const lv2 = CardManager.getDef(nonTuners[j].cardId).level;
          if (tunerLv + lv1 + lv2 === def.level) {
            validCombinations.push([tuner, nonTuners[i], nonTuners[j]]);
          }
        }
      }
    }

    if (validCombinations.length === 0) {
      return {
        canSummon: false,
        validCombinations: [],
        reason: `Necesitas 1 Cantante + No-Cantante(s) que sumen Nivel ${def.level}.`,
      };
    }

    const hasZone =
      this.getAvailableExtraMonsterSlot(state, player) !== -1 ||
      this.getFirstEmptyMonsterSlot(state, player) !== -1 ||
      validCombinations.some((combo) => combo.some((m) => m.location === 'MONSTER'));

    if (!hasZone) {
      return { canSummon: false, validCombinations: [], reason: 'Sin espacio en Zonas de Monstruo.' };
    }

    return { canSummon: true, validCombinations };
  }

  static validateXyzSummon(state: DuelState, player: PlayerId, extraCardUid: string): {
    canSummon: boolean;
    validPairs: CardInstance[][];
    reason?: string;
  } {
    const ps = player === 'player' ? state.player : state.opponent;
    if (state.activePlayer !== player || (state.phase !== 'MAIN1' && state.phase !== 'MAIN2')) {
      return { canSummon: false, validPairs: [], reason: 'Solo disponible en tu Main Phase.' };
    }
    const target = ps.extraDeck.find((c) => c.uid === extraCardUid);
    if (!target) return { canSummon: false, validPairs: [], reason: 'Carta no encontrada.' };
    const def = CardManager.getDef(target.cardId);
    if (def.subtype !== 'xyz') {
      return { canSummon: false, validPairs: [], reason: 'No es un monstruo Xyz.' };
    }

    const matchingMons = CardManager.getAllFieldMonsters(state, player).filter((m) => {
      const md = CardManager.getDef(m.cardId);
      return m.faceUp && md.subtype !== 'xyz' && md.subtype !== 'link' && md.level === def.level;
    });

    const validPairs: CardInstance[][] = [];
    for (let i = 0; i < matchingMons.length; i++) {
      for (let j = i + 1; j < matchingMons.length; j++) {
        validPairs.push([matchingMons[i], matchingMons[j]]);
      }
    }

    if (validPairs.length === 0) {
      return {
        canSummon: false,
        validPairs: [],
        reason: `Necesitas 2 monstruos de Nivel ${def.level} en tu campo.`,
      };
    }

    return { canSummon: true, validPairs };
  }

  static validateLinkSummon(state: DuelState, player: PlayerId, extraCardUid: string): {
    canSummon: boolean;
    validSets: CardInstance[][];
    reason?: string;
  } {
    const ps = player === 'player' ? state.player : state.opponent;
    if (state.activePlayer !== player || (state.phase !== 'MAIN1' && state.phase !== 'MAIN2')) {
      return { canSummon: false, validSets: [], reason: 'Solo disponible en tu Main Phase.' };
    }
    const target = ps.extraDeck.find((c) => c.uid === extraCardUid);
    if (!target) return { canSummon: false, validSets: [], reason: 'Carta no encontrada.' };
    const def = CardManager.getDef(target.cardId);
    if (def.subtype !== 'link') {
      return { canSummon: false, validSets: [], reason: 'No es un monstruo de Enlace.' };
    }

    const ratingNeeded = def.level;
    const faceUpMons = CardManager.getAllFieldMonsters(state, player).filter((m) => m.faceUp);
    const validSets: CardInstance[][] = [];

    // Combinations of 2 or 3 monsters (with Link-2 counting as 2 or 1)
    const linkWeight = (m: CardInstance) => {
      const md = CardManager.getDef(m.cardId);
      return md.subtype === 'link' ? md.level : 1;
    };

    for (let i = 0; i < faceUpMons.length; i++) {
      for (let j = i + 1; j < faceUpMons.length; j++) {
        const w2 = linkWeight(faceUpMons[i]) + linkWeight(faceUpMons[j]);
        if (w2 === ratingNeeded || (1 + 1 === ratingNeeded)) {
          validSets.push([faceUpMons[i], faceUpMons[j]]);
        }
        for (let k = j + 1; k < faceUpMons.length; k++) {
          if (1 + 1 + 1 === ratingNeeded) {
            validSets.push([faceUpMons[i], faceUpMons[j], faceUpMons[k]]);
          }
        }
      }
    }

    if (validSets.length === 0) {
      return {
        canSummon: false,
        validSets: [],
        reason: `Necesitas materiales que sumen Enlace-${ratingNeeded}.`,
      };
    }

    const canPlaceEmz =
      this.getAvailableExtraMonsterSlot(state, player) !== -1 ||
      validSets.some((set) => set.some((m) => m.location === 'EXTRA_MONSTER'));

    if (!canPlaceEmz && this.getFirstEmptyMonsterSlot(state, player) === -1) {
      return { canSummon: false, validSets: [], reason: 'No hay Zona de Monstruo Extra disponible.' };
    }

    return { canSummon: true, validSets };
  }

  static validatePendulumSummon(state: DuelState, player: PlayerId): {
    canSummon: boolean;
    minLevel: number;
    maxLevel: number;
    eligibleHandUids: string[];
    reason?: string;
  } {
    const ps = player === 'player' ? state.player : state.opponent;
    if (state.activePlayer !== player || (state.phase !== 'MAIN1' && state.phase !== 'MAIN2')) {
      return { canSummon: false, minLevel: 0, maxLevel: 0, eligibleHandUids: [], reason: 'Solo en Main Phase.' };
    }
    if (ps.pendulumSummonedThisTurn) {
      return { canSummon: false, minLevel: 0, maxLevel: 0, eligibleHandUids: [], reason: 'Ya realizaste tu Invocación por Péndulo este turno.' };
    }
    if (!ps.pendulumLeft || !ps.pendulumRight) {
      return { canSummon: false, minLevel: 0, maxLevel: 0, eligibleHandUids: [], reason: 'Necesitas 2 Escalas de Péndulo colocadas.' };
    }

    const s1 = CardManager.getDef(ps.pendulumLeft.cardId).pendulumScale ?? 0;
    const s2 = CardManager.getDef(ps.pendulumRight.cardId).pendulumScale ?? 0;
    const low = Math.min(s1, s2) + 1;
    const high = Math.max(s1, s2) - 1;

    if (low > high) {
      return { canSummon: false, minLevel: low, maxLevel: high, eligibleHandUids: [], reason: 'Rango de Escalas insuficiente.' };
    }

    const emptySlots = ps.monsters.filter((m) => m === null).length;
    if (emptySlots === 0) {
      return { canSummon: false, minLevel: low, maxLevel: high, eligibleHandUids: [], reason: 'Campo lleno.' };
    }

    const eligibleHandUids = ps.hand
      .filter((c) => {
        const d = CardManager.getDef(c.cardId);
        return d.category === 'MONSTER' && d.subtype !== 'ritual' && d.level >= low && d.level <= high;
      })
      .map((c) => c.uid);

    if (eligibleHandUids.length === 0) {
      return { canSummon: false, minLevel: low, maxLevel: high, eligibleHandUids: [], reason: `Sin monstruos Nivel ${low}-${high} en mano.` };
    }

    return { canSummon: true, minLevel: low, maxLevel: high, eligibleHandUids };
  }

  static sendToGraveyard(state: DuelState, card: CardInstance): void {
    const ownerPs = card.owner === 'player' ? state.player : state.opponent;
    const ctrlPs = card.controller === 'player' ? state.player : state.opponent;

    // Remove from current zone
    if (card.location === 'HAND') {
      ctrlPs.hand = ctrlPs.hand.filter((c) => c.uid !== card.uid);
    } else if (card.location === 'MONSTER') {
      ctrlPs.monsters[card.zoneIndex] = null;
    } else if (card.location === 'EXTRA_MONSTER') {
      state.extraMonsterZones[card.zoneIndex] = null;
    } else if (card.location === 'SPELL_TRAP') {
      ctrlPs.spellsTraps[card.zoneIndex] = null;
    } else if (card.location === 'FIELD') {
      ctrlPs.fieldZone = null;
    } else if (card.location === 'PENDULUM_LEFT') {
      ctrlPs.pendulumLeft = null;
    } else if (card.location === 'PENDULUM_RIGHT') {
      ctrlPs.pendulumRight = null;
    } else if (card.location === 'EXTRA_DECK') {
      ctrlPs.extraDeck = ctrlPs.extraDeck.filter((c) => c.uid !== card.uid);
    }

    // Send attached Xyz materials to GY too
    if (card.xyzMaterials.length > 0) {
      for (const mat of card.xyzMaterials) {
        const matOwner = mat.owner === 'player' ? state.player : state.opponent;
        mat.location = 'GRAVEYARD';
        mat.faceUp = true;
        matOwner.graveyard.push(mat);
      }
      card.xyzMaterials = [];
    }

    // If this card is an Equip Spell, revert its stat modifiers on the equipped monster
    if (card.equippedToUid) {
      const target = CardManager.findInstance(state, card.equippedToUid);
      if (target) {
        target.atkModifier -= card.equippedAtkDelta ?? 0;
        target.defModifier -= card.equippedDefDelta ?? 0;
      }
      card.equippedToUid = undefined;
      card.equippedAtkDelta = undefined;
      card.equippedDefDelta = undefined;
    }

    const def = CardManager.getDef(card.cardId);
    // Extra Deck monsters return to Extra Deck if sent from field? Standard TCG puts Extra Deck monsters in GY if summoned properly, which allows Monster Reborn!
    card.location = 'GRAVEYARD';
    card.zoneIndex = ownerPs.graveyard.length;
    card.faceUp = true;
    card.atkModifier = 0;
    card.defModifier = 0;
    card.restrictions = [];
    ownerPs.graveyard.push(card);

    // Clean up any equips pointing to this card
    for (const p of [state.player, state.opponent]) {
      for (let i = 0; i < p.spellsTraps.length; i++) {
        const st = p.spellsTraps[i];
        if (st && st.equippedToUid === card.uid) {
          this.sendToGraveyard(state, st);
        }
      }
    }

    if (def.category === 'MONSTER' && def.subtype === 'pendulum' && card.owner === card.controller) {
      // Optional flavor: keep in GY for simplicity so Revival works consistently
    }
  }

  static placeMonsterOnField(
    state: DuelState,
    player: PlayerId,
    card: CardInstance,
    position: BattlePosition,
    faceUp: boolean,
    preferEmz: boolean = false
  ): boolean {
    const ps = player === 'player' ? state.player : state.opponent;

    if (preferEmz) {
      const emzIdx = this.getAvailableExtraMonsterSlot(state, player);
      if (emzIdx !== -1) {
        card.location = 'EXTRA_MONSTER';
        card.zoneIndex = emzIdx;
        card.controller = player;
        card.faceUp = faceUp;
        card.position = position;
        card.summonedThisTurn = true;
        card.attackedThisTurn = false;
        card.positionChangedThisTurn = false;
        card.turnPlaced = state.turnNumber;
        state.extraMonsterZones[emzIdx] = card;
        return true;
      }
    }

    const slot = this.getFirstEmptyMonsterSlot(state, player);
    if (slot === -1) return false;

    card.location = 'MONSTER';
    card.zoneIndex = slot;
    card.controller = player;
    card.faceUp = faceUp;
    card.position = position;
    card.summonedThisTurn = true;
    card.attackedThisTurn = false;
    card.positionChangedThisTurn = false;
    card.turnPlaced = state.turnNumber;
    ps.monsters[slot] = card;
    return true;
  }

  static executeNormalSummon(
    state: DuelState,
    player: PlayerId,
    cardUid: string,
    tributeUids: string[],
    position: BattlePosition = 'ATK',
    isSet: boolean = false
  ): { success: boolean; summoned?: CardInstance; error?: string } {
    const val = this.validateNormalSummon(state, player, cardUid, isSet);
    if (!val.canSummon) return { success: false, error: val.reason };
    if (tributeUids.length !== val.requiredTributes) {
      return { success: false, error: `Debes seleccionar ${val.requiredTributes} sacrificio(s).` };
    }

    const ps = player === 'player' ? state.player : state.opponent;
    const card = ps.hand.find((c) => c.uid === cardUid)!;
    const def = CardManager.getDef(card.cardId);

    for (const tUid of tributeUids) {
      const trib = CardManager.findInstance(state, tUid);
      if (!trib || trib.controller !== player) {
        return { success: false, error: 'Sacrificio inválido.' };
      }
      this.sendToGraveyard(state, trib);
    }

    ps.hand = ps.hand.filter((c) => c.uid !== cardUid);
    const placed = this.placeMonsterOnField(
      state,
      player,
      card,
      isSet ? 'DEF' : position,
      !isSet,
      false
    );
    if (!placed) return { success: false, error: 'No hay espacio en el campo.' };

    ps.normalSummonsRemaining -= 1;
    if (player === 'player') state.stats.playerSummons += 1;

    const method: SummonMethod = val.requiredTributes > 0 ? 'TRIBUTE' : isSet ? 'SET' : 'NORMAL';
    const actionLabel = isSet
      ? 'coloca un monstruo boca abajo'
      : val.requiredTributes > 0
      ? `Invoca por Sacrificio a ${def.name}`
      : `Invoca de Modo Normal a ${def.name}`;

    TurnManager.addLog(state, player, `${ps.name} ${actionLabel}.`, 'summon');
    state.recentCues.push({
      id: `cue_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      kind: !isSet && (def.level >= 7 || Boolean(def.bossImage)) ? 'BOSS_SUMMON' : 'SUMMON',
      cardId: def.id,
      sourceZone: { owner: player, zone: card.location, index: card.zoneIndex },
      summonMethod: method,
      timestamp: Date.now(),
    });

    return { success: true, summoned: card };
  }

  static executeExtraDeckSummon(
    state: DuelState,
    player: PlayerId,
    extraCardUid: string,
    materialUids: string[],
    method: 'FUSION' | 'SYNCHRO' | 'XYZ' | 'LINK'
  ): { success: boolean; summoned?: CardInstance; error?: string } {
    const ps = player === 'player' ? state.player : state.opponent;
    const extraCard = ps.extraDeck.find((c) => c.uid === extraCardUid);
    if (!extraCard) return { success: false, error: 'Carta del Deck Extra no encontrada.' };
    const def = CardManager.getDef(extraCard.cardId);

    const materials: CardInstance[] = [];
    for (const mUid of materialUids) {
      const m = CardManager.findInstance(state, mUid);
      if (!m || m.controller !== player) return { success: false, error: 'Material inválido.' };
      materials.push(m);
    }

    if (method === 'SYNCHRO') {
      const hasTuner = materials.some((m) => CardManager.getDef(m.cardId).isTuner);
      const totalLv = materials.reduce((sum, m) => sum + CardManager.getDef(m.cardId).level, 0);
      if (!hasTuner || totalLv !== def.level) {
        return { success: false, error: `Se requiere 1 Cantante y Nivel total ${def.level}.` };
      }
    } else if (method === 'XYZ') {
      if (materials.length !== 2 || materials.some((m) => CardManager.getDef(m.cardId).level !== def.level)) {
        return { success: false, error: `Se requieren 2 monstruos Nivel ${def.level}.` };
      }
    } else if (method === 'LINK') {
      const sum = materials.reduce((acc, m) => {
        const md = CardManager.getDef(m.cardId);
        return acc + (md.subtype === 'link' ? md.level : 1);
      }, 0);
      if (sum !== def.level && materials.length !== def.level) {
        return { success: false, error: `Materiales insuficientes para Enlace-${def.level}.` };
      }
    }

    // Consume materials
    if (method === 'XYZ') {
      for (const mat of materials) {
        if (mat.location === 'MONSTER') ps.monsters[mat.zoneIndex] = null;
        else if (mat.location === 'EXTRA_MONSTER') state.extraMonsterZones[mat.zoneIndex] = null;
        mat.location = 'MONSTER';
        mat.faceUp = false;
        extraCard.xyzMaterials.push(mat);
      }
    } else {
      for (const mat of materials) {
        this.sendToGraveyard(state, mat);
      }
    }

    ps.extraDeck = ps.extraDeck.filter((c) => c.uid !== extraCardUid);
    const placed = this.placeMonsterOnField(state, player, extraCard, 'ATK', true, true);
    if (!placed) return { success: false, error: 'No hay Zona disponible para Invocar.' };

    if (player === 'player') state.stats.playerSummons += 1;
    const labelMap = {
      FUSION: 'por Fusión',
      SYNCHRO: 'por Sincronía',
      XYZ: 'Xyz',
      LINK: 'por Enlace',
    };
    TurnManager.addLog(state, player, `${ps.name} Invoca ${labelMap[method]} a ${def.name}!`, 'summon');
    state.recentCues.push({
      id: `cue_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      kind: 'BOSS_SUMMON',
      cardId: def.id,
      sourceZone: { owner: player, zone: extraCard.location, index: extraCard.zoneIndex },
      summonMethod: method,
      timestamp: Date.now(),
    });

    return { success: true, summoned: extraCard };
  }

  static placePendulumScale(
    state: DuelState,
    player: PlayerId,
    cardUid: string,
    side: 'LEFT' | 'RIGHT'
  ): { success: boolean; error?: string } {
    const ps = player === 'player' ? state.player : state.opponent;
    if (state.activePlayer !== player || (state.phase !== 'MAIN1' && state.phase !== 'MAIN2')) {
      return { success: false, error: 'Solo en tu Main Phase.' };
    }
    const card = ps.hand.find((c) => c.uid === cardUid);
    if (!card) return { success: false, error: 'Carta no está en mano.' };
    const def = CardManager.getDef(card.cardId);
    if (def.subtype !== 'pendulum') return { success: false, error: 'No es un Monstruo de Péndulo.' };
    if (side === 'LEFT' && (ps.pendulumLeft || ps.spellsTraps[0])) {
      return { success: false, error: 'Zona de Péndulo Izquierda ocupada.' };
    }
    if (side === 'RIGHT' && (ps.pendulumRight || ps.spellsTraps[4])) {
      return { success: false, error: 'Zona de Péndulo Derecha ocupada.' };
    }

    ps.hand = ps.hand.filter((c) => c.uid !== cardUid);
    card.location = side === 'LEFT' ? 'PENDULUM_LEFT' : 'PENDULUM_RIGHT';
    card.faceUp = true;
    card.turnPlaced = state.turnNumber;
    if (side === 'LEFT') ps.pendulumLeft = card;
    else ps.pendulumRight = card;

    TurnManager.addLog(
      state,
      player,
      `${ps.name} activa a ${def.name} en la Escala Péndulo (Escala ${def.pendulumScale}).`,
      'summon'
    );
    return { success: true };
  }

  static executePendulumSummon(
    state: DuelState,
    player: PlayerId,
    handUids: string[]
  ): { success: boolean; error?: string } {
    const check = this.validatePendulumSummon(state, player);
    if (!check.canSummon) return { success: false, error: check.reason };
    const ps = player === 'player' ? state.player : state.opponent;

    let summonedCount = 0;
    for (const uid of handUids) {
      if (!check.eligibleHandUids.includes(uid)) continue;
      const card = ps.hand.find((c) => c.uid === uid);
      if (!card) continue;
      if (this.getFirstEmptyMonsterSlot(state, player) === -1) break;
      ps.hand = ps.hand.filter((c) => c.uid !== uid);
      this.placeMonsterOnField(state, player, card, 'ATK', true, false);
      summonedCount++;
      const def = CardManager.getDef(card.cardId);
      state.recentCues.push({
        id: `cue_${Date.now()}_${summonedCount}`,
        kind: def.level >= 7 ? 'BOSS_SUMMON' : 'SUMMON',
        cardId: def.id,
        sourceZone: { owner: player, zone: card.location, index: card.zoneIndex },
        summonMethod: 'PENDULUM',
        timestamp: Date.now(),
      });
    }

    if (summonedCount === 0) return { success: false, error: 'No se pudo invocar ningún monstruo.' };
    ps.pendulumSummonedThisTurn = true;
    if (player === 'player') state.stats.playerSummons += summonedCount;
    TurnManager.addLog(state, player, `${ps.name} realiza una Invocación por Péndulo (${summonedCount} monstruo/s)!`, 'summon');
    return { success: true };
  }
}
