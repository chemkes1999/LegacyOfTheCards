import { DuelLogEntry, DuelPhase, DuelState, PlayerId } from '../types/tcg';

export const PHASE_ORDER: DuelPhase[] = [
  'DRAW',
  'STANDBY',
  'MAIN1',
  'BATTLE',
  'MAIN2',
  'END',
];

export const PHASE_LABELS_ES: Record<DuelPhase, string> = {
  DRAW: 'Fase de Robo',
  STANDBY: 'Standby Phase',
  MAIN1: 'Main Phase 1',
  BATTLE: 'Battle Phase',
  MAIN2: 'Main Phase 2',
  END: 'End Phase',
};

export class TurnManager {
  static addLog(
    state: DuelState,
    actor: PlayerId | 'system',
    message: string,
    type: DuelLogEntry['type'] = 'info'
  ): void {
    state.logs.push({
      id: `log_${state.logs.length + 1}_${state.turnNumber}`,
      turn: state.turnNumber,
      phase: state.phase,
      actor,
      message,
      type,
    });
    if (state.logs.length > 120) {
      state.logs = state.logs.slice(-120);
    }
  }

  static canEnterBattlePhase(state: DuelState): { allowed: boolean; reason?: string } {
    if (state.turnNumber === 1) {
      return {
        allowed: false,
        reason: 'No se puede realizar Battle Phase en el Turno 1 del duelo.',
      };
    }
    if (state.phase !== 'MAIN1') {
      return {
        allowed: false,
        reason: 'Solo puedes entrar a la Battle Phase desde Main Phase 1.',
      };
    }
    return { allowed: true };
  }

  static getAllowedNextPhases(state: DuelState): DuelPhase[] {
    if (state.winner) return [];
    switch (state.phase) {
      case 'DRAW':
        return ['STANDBY'];
      case 'STANDBY':
        return ['MAIN1'];
      case 'MAIN1':
        return state.turnNumber === 1 ? ['END'] : ['BATTLE', 'END'];
      case 'BATTLE':
        return ['MAIN2', 'END'];
      case 'MAIN2':
        return ['END'];
      case 'END':
        return ['DRAW'];
      default:
        return [];
    }
  }

  static drawCard(state: DuelState, playerId: PlayerId, count: number = 1): boolean {
    const ps = playerId === 'player' ? state.player : state.opponent;
    for (let i = 0; i < count; i++) {
      if (ps.deck.length === 0) {
        const opp: PlayerId = playerId === 'player' ? 'opponent' : 'player';
        state.winner = opp;
        state.winReason = `${ps.name} se quedó sin cartas en el Mazo (Deck Out).`;
        this.addLog(state, 'system', state.winReason, 'damage');
        return false;
      }
      const card = ps.deck.shift()!;
      card.location = 'HAND';
      card.zoneIndex = ps.hand.length;
      card.faceUp = playerId === 'player';
      ps.hand.push(card);
    }
    return true;
  }

  static resetTurnFlags(state: DuelState, activePlayer: PlayerId): void {
    const ps = activePlayer === 'player' ? state.player : state.opponent;
    ps.normalSummonsRemaining = 1;
    ps.pendulumSummonedThisTurn = false;

    for (const m of ps.monsters) {
      if (m) {
        m.summonedThisTurn = false;
        m.attackedThisTurn = false;
        m.positionChangedThisTurn = false;
        m.effectUsedThisTurn = false;
        m.restrictions = m.restrictions.filter((r) => r !== 'CANNOT_ATTACK');
      }
    }
    for (const emz of state.extraMonsterZones) {
      if (emz && emz.controller === activePlayer) {
        emz.summonedThisTurn = false;
        emz.attackedThisTurn = false;
        emz.positionChangedThisTurn = false;
        emz.effectUsedThisTurn = false;
        emz.restrictions = emz.restrictions.filter((r) => r !== 'CANNOT_ATTACK');
      }
    }
    for (const st of ps.spellsTraps) {
      if (st) {
        st.effectUsedThisTurn = false;
      }
    }
    if (ps.pendulumLeft) ps.pendulumLeft.effectUsedThisTurn = false;
    if (ps.pendulumRight) ps.pendulumRight.effectUsedThisTurn = false;
  }

  static advancePhase(state: DuelState, targetPhase?: DuelPhase): DuelState {
    if (state.winner) return state;

    const allowed = this.getAllowedNextPhases(state);
    const nextPhase = targetPhase && allowed.includes(targetPhase) ? targetPhase : allowed[0];
    if (!nextPhase) return state;

    // Moving from END -> next player's DRAW
    if (state.phase === 'END' && nextPhase === 'DRAW') {
      state.turnNumber += 1;
      state.stats.turnsPlayed = state.turnNumber;
      state.activePlayer = state.activePlayer === 'player' ? 'opponent' : 'player';
      state.phase = 'DRAW';
      this.resetTurnFlags(state, state.activePlayer);

      const activePs = state.activePlayer === 'player' ? state.player : state.opponent;
      this.addLog(state, state.activePlayer, `Turno ${state.turnNumber} · ${activePs.name}`, 'phase');

      // Standard Master Duel rule: Turn 1 player does NOT draw; all subsequent turns draw 1
      if (state.turnNumber > 1) {
        const drew = this.drawCard(state, state.activePlayer, 1);
        if (!drew) return state;
        this.addLog(state, state.activePlayer, `${activePs.name} roba 1 carta.`, 'info');
      }
      return state;
    }

    state.phase = nextPhase;
    const activePs = state.activePlayer === 'player' ? state.player : state.opponent;
    this.addLog(
      state,
      state.activePlayer,
      `${activePs.name} entra en ${PHASE_LABELS_ES[nextPhase]}.`,
      'phase'
    );
    return state;
  }

  static advanceToInteractivePhase(state: DuelState): DuelState {
    // Automatically step through DRAW -> STANDBY -> MAIN1 cleanly
    while (!state.winner && (state.phase === 'DRAW' || state.phase === 'STANDBY')) {
      this.advancePhase(state);
    }
    return state;
  }
}
