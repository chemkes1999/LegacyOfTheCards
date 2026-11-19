import {
  AIDifficulty,
  BattlePosition,
  CardEffectDef,
  CardInstance,
  DuelPhase,
  DuelState,
  GameMode,
  PlayerId,
  PlayerState,
} from '../types/tcg';
import { BattleManager } from './BattleManager';
import { CardManager } from './CardManager';
import { ChainManager } from './ChainManager';
import { EffectManager } from './EffectManager';
import { SummonManager } from './SummonManager';
import { PHASE_LABELS_ES, TurnManager } from './TurnManager';

export interface DuelInitConfig {
  mode: GameMode;
  playerName?: string;
  opponentName?: string;
  playerDeckIds: string[];
  playerExtraIds: string[];
  opponentDeckIds: string[];
  opponentExtraIds: string[];
  startingLP?: number;
  startingHandSize?: number;
  aiDifficulty?: AIDifficulty;
  campaignStageId?: string;
  shuffle?: boolean;
}

let uidCounter = 1;
function nextUid(prefix: string): string {
  uidCounter += 1;
  return `${prefix}_${uidCounter}_${Math.random().toString(36).slice(2, 6)}`;
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function makeInstances(cardIds: string[], owner: PlayerId, isExtra: boolean): CardInstance[] {
  return cardIds.map((cardId, idx) => ({
    uid: nextUid(owner === 'player' ? 'p' : 'o'),
    cardId,
    owner,
    controller: owner,
    location: isExtra ? 'EXTRA_DECK' : 'DECK',
    zoneIndex: idx,
    faceUp: false,
    position: 'ATK',
    summonedThisTurn: false,
    attackedThisTurn: false,
    positionChangedThisTurn: false,
    effectUsedThisTurn: false,
    atkModifier: 0,
    defModifier: 0,
    xyzMaterials: [],
    restrictions: [],
    turnPlaced: 0,
  }));
}

export class DuelManager {
  static cloneState(state: DuelState): DuelState {
    return structuredClone(state);
  }

  static createDuel(config: DuelInitConfig): DuelState {
    const startingLP = config.startingLP ?? 8000;
    const startingHandSize = config.startingHandSize ?? 5;
    const shouldShuffle = config.shuffle ?? true;

    const pMainIds = shouldShuffle ? shuffleArray(config.playerDeckIds) : [...config.playerDeckIds];
    const oMainIds = shouldShuffle ? shuffleArray(config.opponentDeckIds) : [...config.opponentDeckIds];

    const player: PlayerState = {
      id: 'player',
      name: config.playerName ?? 'Duelista',
      lp: startingLP,
      maxLp: startingLP,
      deck: makeInstances(pMainIds, 'player', false),
      extraDeck: makeInstances(config.playerExtraIds, 'player', true),
      hand: [],
      monsters: [null, null, null, null, null],
      spellsTraps: [null, null, null, null, null],
      fieldZone: null,
      pendulumLeft: null,
      pendulumRight: null,
      graveyard: [],
      banished: [],
      normalSummonsRemaining: 1,
      pendulumSummonedThisTurn: false,
    };

    const opponent: PlayerState = {
      id: 'opponent',
      name: config.opponentName ?? 'Rival IA',
      lp: startingLP,
      maxLp: startingLP,
      deck: makeInstances(oMainIds, 'opponent', false),
      extraDeck: makeInstances(config.opponentExtraIds, 'opponent', true),
      hand: [],
      monsters: [null, null, null, null, null],
      spellsTraps: [null, null, null, null, null],
      fieldZone: null,
      pendulumLeft: null,
      pendulumRight: null,
      graveyard: [],
      banished: [],
      normalSummonsRemaining: 1,
      pendulumSummonedThisTurn: false,
    };

    const state: DuelState = {
      duelId: nextUid('duel'),
      mode: config.mode,
      turnNumber: 1,
      activePlayer: 'player',
      phase: 'DRAW',
      player,
      opponent,
      extraMonsterZones: [null, null],
      chainStack: [],
      pendingInteraction: null,
      winner: null,
      winReason: null,
      logs: [],
      recentCues: [],
      stats: {
        turnsPlayed: 1,
        playerDamageDealt: 0,
        opponentDamageDealt: 0,
        playerSummons: 0,
        playerSpellsTraps: 0,
        chainsResolved: 0,
      },
      startingLP,
      startingHandSize,
      aiDifficulty: config.aiDifficulty ?? 'NORMAL',
      campaignStageId: config.campaignStageId,
      tutorialStep: config.mode === 'PRACTICE' ? 0 : undefined,
    };

    TurnManager.drawCard(state, 'player', startingHandSize);
    TurnManager.drawCard(state, 'opponent', startingHandSize);
    TurnManager.addLog(
      state,
      'system',
      `¡Comienza el Duelo! ${player.name} vs ${opponent.name} (${startingLP} LP).`,
      'phase'
    );
    TurnManager.advanceToInteractivePhase(state);
    return state;
  }

  static normalSummonOrSet(
    prevState: DuelState,
    actor: PlayerId,
    cardUid: string,
    tributeUids: string[],
    position: BattlePosition = 'ATK',
    isSet: boolean = false
  ): { state: DuelState; error?: string } {
    const state = this.cloneState(prevState);
    const res = SummonManager.executeNormalSummon(state, actor, cardUid, tributeUids, position, isSet);
    if (!res.success) return { state: prevState, error: res.error };
    if (state.tutorialStep === 0 && actor === 'player') state.tutorialStep = 1;
    return { state };
  }

  static extraSummon(
    prevState: DuelState,
    actor: PlayerId,
    extraCardUid: string,
    materialUids: string[],
    method: 'FUSION' | 'SYNCHRO' | 'XYZ' | 'LINK'
  ): { state: DuelState; error?: string } {
    const state = this.cloneState(prevState);
    const res = SummonManager.executeExtraDeckSummon(state, actor, extraCardUid, materialUids, method);
    if (!res.success) return { state: prevState, error: res.error };
    return { state };
  }

  static placePendulum(
    prevState: DuelState,
    actor: PlayerId,
    cardUid: string,
    side: 'LEFT' | 'RIGHT'
  ): { state: DuelState; error?: string } {
    const state = this.cloneState(prevState);
    const res = SummonManager.placePendulumScale(state, actor, cardUid, side);
    if (!res.success) return { state: prevState, error: res.error };
    return { state };
  }

  static pendulumSummon(
    prevState: DuelState,
    actor: PlayerId,
    handUids: string[]
  ): { state: DuelState; error?: string } {
    const state = this.cloneState(prevState);
    const res = SummonManager.executePendulumSummon(state, actor, handUids);
    if (!res.success) return { state: prevState, error: res.error };
    return { state };
  }

  static setSpellOrTrap(
    prevState: DuelState,
    actor: PlayerId,
    cardUid: string
  ): { state: DuelState; error?: string } {
    const state = this.cloneState(prevState);
    if (state.activePlayer !== actor || (state.phase !== 'MAIN1' && state.phase !== 'MAIN2')) {
      return { state: prevState, error: 'Solo puedes colocar cartas en tu Main Phase.' };
    }
    const ps = actor === 'player' ? state.player : state.opponent;
    const card = ps.hand.find((c) => c.uid === cardUid);
    if (!card) return { state: prevState, error: 'Carta no encontrada en mano.' };
    const def = CardManager.getDef(card.cardId);
    if (def.category === 'MONSTER') return { state: prevState, error: 'Usa Invocar/Colocar monstruo.' };

    if (def.subtype === 'field') {
      if (ps.fieldZone) SummonManager.sendToGraveyard(state, ps.fieldZone);
      ps.hand = ps.hand.filter((c) => c.uid !== cardUid);
      card.location = 'FIELD';
      card.faceUp = false;
      card.turnPlaced = state.turnNumber;
      ps.fieldZone = card;
      TurnManager.addLog(state, actor, `${ps.name} coloca una Carta Mágica de Campo.`, 'info');
      return { state };
    }

    const findFreeStSlot = (playerState: PlayerState): number => {
      const order = [1, 2, 3, 0, 4];
      for (const idx of order) {
        if (playerState.spellsTraps[idx] !== null) continue;
        if (idx === 0 && playerState.pendulumLeft) continue;
        if (idx === 4 && playerState.pendulumRight) continue;
        return idx;
      }
      return -1;
    };

    const slot = findFreeStSlot(ps);
    if (slot === -1) return { state: prevState, error: 'Tu Zona de Mágicas y Trampas está llena.' };

    ps.hand = ps.hand.filter((c) => c.uid !== cardUid);
    card.location = 'SPELL_TRAP';
    card.zoneIndex = slot;
    card.faceUp = false;
    card.turnPlaced = state.turnNumber;
    ps.spellsTraps[slot] = card;
    if (actor === 'player') state.stats.playerSpellsTraps += 1;

    TurnManager.addLog(state, actor, `${ps.name} coloca una carta boca abajo en su zona M/T.`, 'info');
    return { state };
  }

  static activateCard(
    prevState: DuelState,
    actor: PlayerId,
    cardUid: string,
    effectIndex: number = 0,
    targetUid?: string
  ): { state: DuelState; error?: string } {
    const state = this.cloneState(prevState);
    const card = CardManager.findInstance(state, cardUid);
    if (!card || card.controller !== actor) {
      return { state: prevState, error: 'Carta no encontrada.' };
    }
    const def = CardManager.getDef(card.cardId);
    const effect = def.effects[effectIndex];
    if (!effect) {
      return { state: prevState, error: 'Esta carta no tiene efectos activables.' };
    }

    const ps = actor === 'player' ? state.player : state.opponent;
    const can = EffectManager.canActivateEffect(state, actor, card, effect);
    if (!can.allowed) return { state: prevState, error: can.reason };

    // If played from Hand (Spell), place it onto Field or Spell/Trap zone first
    if (card.location === 'HAND') {
      if (def.category === 'TRAP') {
        return { state: prevState, error: 'Las Cartas de Trampa deben colocarse boca abajo primero.' };
      }
      if (def.subtype === 'field') {
        if (ps.fieldZone) SummonManager.sendToGraveyard(state, ps.fieldZone);
        ps.hand = ps.hand.filter((c) => c.uid !== card.uid);
        card.location = 'FIELD';
        card.faceUp = true;
        card.turnPlaced = state.turnNumber;
        ps.fieldZone = card;
        if (actor === 'player') state.stats.playerSpellsTraps += 1;
        TurnManager.addLog(state, actor, `${ps.name} activa la Mágica de Campo "${def.name}".`, 'effect');
        state.recentCues.push({
          id: `cue_eff_${Date.now()}`,
          kind: 'EFFECT',
          cardId: def.id,
          sourceZone: { owner: actor, zone: 'FIELD', index: 0 },
          timestamp: Date.now(),
        });
        return { state };
      }

      const slotOrder = [1, 2, 3, 0, 4];
      const slot = slotOrder.find((idx) => {
        if (ps.spellsTraps[idx] !== null) return false;
        if (idx === 0 && ps.pendulumLeft) return false;
        if (idx === 4 && ps.pendulumRight) return false;
        return true;
      }) ?? -1;
      if (slot === -1) return { state: prevState, error: 'Zona de Mágicas y Trampas llena.' };
      ps.hand = ps.hand.filter((c) => c.uid !== card.uid);
      card.location = 'SPELL_TRAP';
      card.zoneIndex = slot;
      card.faceUp = true;
      card.turnPlaced = state.turnNumber;
      ps.spellsTraps[slot] = card;
      if (actor === 'player') state.stats.playerSpellsTraps += 1;

      if (def.subtype === 'continuous' && effect.trigger === 'CONTINUOUS') {
        TurnManager.addLog(state, actor, `${ps.name} activa la Mágica Continua "${def.name}".`, 'effect');
        state.recentCues.push({
          id: `cue_eff_${Date.now()}`,
          kind: 'EFFECT',
          cardId: def.id,
          sourceZone: { owner: actor, zone: 'SPELL_TRAP', index: slot },
          timestamp: Date.now(),
        });
        return { state };
      }
    }

    // Push to Chain Stack
    ChainManager.pushLink(state, actor, card.uid, effect, targetUid);
    state.recentCues.push({
      id: `cue_chain_${Date.now()}`,
      kind: 'EFFECT',
      cardId: def.id,
      sourceZone: { owner: actor, zone: card.location, index: card.zoneIndex },
      timestamp: Date.now(),
    });

    // Check if opponent can respond in a Chain
    const opp: PlayerId = actor === 'player' ? 'opponent' : 'player';
    const oppResp = ChainManager.canRespond(state, opp);

    if (opp === 'player' && oppResp.canRespond) {
      state.pendingInteraction = {
        type: 'CHAIN_RESPONSE',
        actor: 'player',
        title: 'Ventana de Cadena',
        subtitle: `${state.opponent.name} activó "${def.name}". ¿Deseas encadenar una carta?`,
        minCount: 0,
        maxCount: 1,
        candidateUids: oppResp.availableOptions.map((o) => o.cardUid),
      };
      return { state };
    }

    // If AI can respond and has a Counter Trap or Quick Effect when appropriate, let AI chain or resolve
    if (opp === 'opponent' && oppResp.canRespond && state.aiDifficulty !== 'EASY') {
      const counter = oppResp.availableOptions.find((o) => o.effect.spellSpeed === 3 && o.effect.operations.some((op) => op.type === 'NEGATE_CHAIN_LINK'));
      if (counter) {
        ChainManager.pushLink(state, 'opponent', counter.cardUid, counter.effect);
      }
    }

    EffectManager.resolveChainStack(state);
    return { state };
  }

  static respondToChain(
    prevState: DuelState,
    actor: PlayerId,
    respondCardUid?: string,
    targetUid?: string
  ): DuelState {
    const state = this.cloneState(prevState);
    const attackCtx = state.pendingInteraction?.attackContext;
    state.pendingInteraction = null;

    if (respondCardUid) {
      const card = CardManager.findInstance(state, respondCardUid);
      if (card) {
        const def = CardManager.getDef(card.cardId);
        const eff = def.effects.find((e) => e.trigger === 'QUICK' || e.trigger === 'COUNTER' || e.trigger === 'ON_ATTACK_DECLARE');
        if (eff) {
          let chosenTarget = targetUid;
          if (!chosenTarget && eff.targetRequirement !== 'NONE') {
            chosenTarget = EffectManager.getValidTargetUids(state, actor, eff)[0];
          }
          ChainManager.pushLink(state, actor, card.uid, eff, chosenTarget);
        }
      }
    }

    const { attackNegated } = EffectManager.resolveChainStack(state);
    if (attackCtx && !attackNegated && !state.winner) {
      const attackerStillOnField = CardManager.findInstance(state, attackCtx.attackerUid);
      if (attackerStillOnField && (attackerStillOnField.location === 'MONSTER' || attackerStillOnField.location === 'EXTRA_MONSTER')) {
        BattleManager.executeAttack(state, attackCtx.attackerUid, attackCtx.targetUid);
      }
    }

    return state;
  }

  static changePosition(
    prevState: DuelState,
    actor: PlayerId,
    cardUid: string
  ): { state: DuelState; error?: string } {
    const state = this.cloneState(prevState);
    if (state.activePlayer !== actor || (state.phase !== 'MAIN1' && state.phase !== 'MAIN2')) {
      return { state: prevState, error: 'Solo puedes cambiar posiciones en tu Main Phase.' };
    }
    const monster = CardManager.findInstance(state, cardUid);
    if (!monster || monster.controller !== actor) {
      return { state: prevState, error: 'Monstruo inválido.' };
    }
    const def = CardManager.getDef(monster.cardId);
    if (def.subtype === 'link') {
      return { state: prevState, error: 'Los monstruos Enlace no tienen posición de Defensa.' };
    }
    if (monster.summonedThisTurn) {
      return { state: prevState, error: 'No puedes cambiar la posición de un monstruo el turno que fue Invocado.' };
    }
    if (monster.positionChangedThisTurn) {
      return { state: prevState, error: 'Ya cambiaste la posición de este monstruo este turno.' };
    }

    monster.faceUp = true;
    monster.position = monster.position === 'ATK' ? 'DEF' : 'ATK';
    monster.positionChangedThisTurn = true;
    TurnManager.addLog(state, actor, `${def.name} cambia a Posición de ${monster.position}.`, 'info');
    return { state };
  }

  static declareAttack(
    prevState: DuelState,
    actor: PlayerId,
    attackerUid: string,
    targetUid?: string
  ): { state: DuelState; error?: string } {
    const state = this.cloneState(prevState);
    const check = BattleManager.canDeclareAttack(state, attackerUid, targetUid);
    if (!check.allowed) return { state: prevState, error: check.reason };

    const defender: PlayerId = actor === 'player' ? 'opponent' : 'player';
    const defPs = defender === 'player' ? state.player : state.opponent;

    // Check ON_ATTACK_DECLARE traps set on previous turns
    const attackTraps: { card: CardInstance; eff: CardEffectDef }[] = [];
    for (const st of defPs.spellsTraps) {
      if (!st || st.turnPlaced >= state.turnNumber) continue;
      const def = CardManager.getDef(st.cardId);
      for (const eff of def.effects) {
        if (eff.trigger === 'ON_ATTACK_DECLARE') {
          attackTraps.push({ card: st, eff });
        }
      }
    }

    if (defender === 'player' && attackTraps.length > 0) {
      const attacker = CardManager.findInstance(state, attackerUid)!;
      const atkName = CardManager.getDef(attacker.cardId).name;
      state.pendingInteraction = {
        type: 'CHAIN_RESPONSE',
        actor: 'player',
        title: 'Declaración de Ataque',
        subtitle: `${atkName} ha declarado un ataque. ¿Activar Trampa de respuesta?`,
        minCount: 0,
        maxCount: 1,
        candidateUids: attackTraps.map((t) => t.card.uid),
        attackContext: { attackerUid, targetUid },
      };
      return { state };
    }

    if (defender === 'opponent' && attackTraps.length > 0 && state.aiDifficulty !== 'EASY') {
      const chosen = attackTraps[0];
      ChainManager.pushLink(state, 'opponent', chosen.card.uid, chosen.eff);
      const { attackNegated } = EffectManager.resolveChainStack(state);
      if (attackNegated || state.winner) return { state };
      const attackerStillOnField = CardManager.findInstance(state, attackerUid);
      if (
        !attackerStillOnField ||
        (attackerStillOnField.location !== 'MONSTER' && attackerStillOnField.location !== 'EXTRA_MONSTER')
      ) {
        return { state };
      }
    }

    BattleManager.executeAttack(state, attackerUid, targetUid);
    if (state.tutorialStep === 2 && actor === 'player') state.tutorialStep = 3;
    return { state };
  }

  static advancePhase(prevState: DuelState, targetPhase?: DuelPhase): { state: DuelState; error?: string } {
    const state = this.cloneState(prevState);
    if (targetPhase === 'BATTLE') {
      const can = TurnManager.canEnterBattlePhase(state);
      if (!can.allowed) return { state: prevState, error: can.reason };
    }
    const prevTurn = state.turnNumber;
    TurnManager.advancePhase(state, targetPhase);
    if (state.phase === 'DRAW' && state.turnNumber > prevTurn) {
      TurnManager.advanceToInteractivePhase(state);
    }
    if (state.phase === 'BATTLE' && state.tutorialStep === 1 && state.activePlayer === 'player') {
      state.tutorialStep = 2;
    }
    return { state };
  }

  static endTurn(prevState: DuelState): DuelState {
    const state = this.cloneState(prevState);
    if (state.winner) return state;
    state.phase = 'END';
    const activePs = state.activePlayer === 'player' ? state.player : state.opponent;
    TurnManager.addLog(state, state.activePlayer, `${activePs.name} finaliza su turno.`, 'phase');
    TurnManager.advancePhase(state, 'DRAW');
    if (!state.winner) {
      TurnManager.advanceToInteractivePhase(state);
    }
    return state;
  }

  static surrender(prevState: DuelState, actor: PlayerId): DuelState {
    const state = this.cloneState(prevState);
    const opp: PlayerId = actor === 'player' ? 'opponent' : 'player';
    const ps = actor === 'player' ? state.player : state.opponent;
    state.winner = opp;
    state.winReason = `${ps.name} se ha rendido.`;
    TurnManager.addLog(state, actor, state.winReason, 'phase');
    return state;
  }

  static getPhaseLabel(phase: DuelPhase): string {
    return PHASE_LABELS_ES[phase];
  }
}
