import { DuelState, PlayerId } from '../types/tcg';
import { CardManager } from './CardManager';
import { EffectManager } from './EffectManager';
import { SummonManager } from './SummonManager';
import { TurnManager } from './TurnManager';

export interface BattleResult {
  executed: boolean;
  attackerDestroyed: boolean;
  defenderDestroyed: boolean;
  damageToDefender: number;
  damageToAttacker: number;
  reason?: string;
}

export class BattleManager {
  static canDeclareAttack(
    state: DuelState,
    attackerUid: string,
    targetUid?: string
  ): { allowed: boolean; reason?: string } {
    if (state.winner) return { allowed: false, reason: 'El duelo ha terminado.' };
    if (state.turnNumber === 1) {
      return { allowed: false, reason: 'No se puede atacar en el Turno 1.' };
    }
    if (state.phase !== 'BATTLE') {
      return { allowed: false, reason: 'Solo puedes atacar en la Battle Phase.' };
    }

    const attacker = CardManager.findInstance(state, attackerUid);
    if (
      !attacker ||
      attacker.controller !== state.activePlayer ||
      (attacker.location !== 'MONSTER' && attacker.location !== 'EXTRA_MONSTER')
    ) {
      return { allowed: false, reason: 'Atacante inválido.' };
    }
    if (!attacker.faceUp || attacker.position !== 'ATK') {
      return { allowed: false, reason: 'El monstruo debe estar en Posición de Ataque boca arriba.' };
    }
    if (attacker.attackedThisTurn) {
      return { allowed: false, reason: 'Este monstruo ya atacó este turno.' };
    }
    if (attacker.restrictions.includes('CANNOT_ATTACK')) {
      return { allowed: false, reason: 'Este monstruo tiene restringido atacar.' };
    }

    const opp: PlayerId = attacker.controller === 'player' ? 'opponent' : 'player';
    const oppMonsters = CardManager.getAllFieldMonsters(state, opp);

    if (!targetUid) {
      if (oppMonsters.length > 0) {
        return { allowed: false, reason: 'El oponente controla monstruos; debes elegir un objetivo.' };
      }
      return { allowed: true };
    }

    const target = CardManager.findInstance(state, targetUid);
    if (!target || target.controller !== opp || (target.location !== 'MONSTER' && target.location !== 'EXTRA_MONSTER')) {
      return { allowed: false, reason: 'Objetivo de ataque inválido.' };
    }

    return { allowed: true };
  }

  static executeAttack(state: DuelState, attackerUid: string, targetUid?: string): BattleResult {
    const validation = this.canDeclareAttack(state, attackerUid, targetUid);
    if (!validation.allowed) {
      return {
        executed: false,
        attackerDestroyed: false,
        defenderDestroyed: false,
        damageToDefender: 0,
        damageToAttacker: 0,
        reason: validation.reason,
      };
    }

    const attacker = CardManager.findInstance(state, attackerUid)!;
    const atkPlayer = attacker.controller;
    const defPlayer: PlayerId = atkPlayer === 'player' ? 'opponent' : 'player';
    const atkPs = atkPlayer === 'player' ? state.player : state.opponent;
    const defPs = defPlayer === 'player' ? state.player : state.opponent;

    const atkDef = CardManager.getDef(attacker.cardId);
    const atkStats = CardManager.getEffectiveStats(state, attacker);
    attacker.attackedThisTurn = true;

    state.recentCues.push({
      id: `cue_atk_${Date.now()}`,
      kind: 'ATTACK',
      cardId: atkDef.id,
      sourceZone: { owner: atkPlayer, zone: attacker.location, index: attacker.zoneIndex },
      timestamp: Date.now(),
    });

    // Direct Attack
    if (!targetUid) {
      const dmg = atkStats.atk;
      defPs.lp = Math.max(0, defPs.lp - dmg);
      if (atkPlayer === 'player') state.stats.playerDamageDealt += dmg;
      else state.stats.opponentDamageDealt += dmg;

      TurnManager.addLog(
        state,
        atkPlayer,
        `${atkDef.name} ataca directamente e inflige ${dmg} de daño a ${defPs.name}!`,
        'battle'
      );
      state.recentCues.push({
        id: `cue_direct_${Date.now()}`,
        kind: 'DAMAGE',
        amount: dmg,
        targetZone: { owner: defPlayer, zone: 'MONSTER', index: 2 },
        timestamp: Date.now(),
      });

      EffectManager.checkLifePointsWinner(state);
      return {
        executed: true,
        attackerDestroyed: false,
        defenderDestroyed: false,
        damageToDefender: dmg,
        damageToAttacker: 0,
      };
    }

    const defender = CardManager.findInstance(state, targetUid)!;
    const defCardDef = CardManager.getDef(defender.cardId);
    defender.faceUp = true; // Flip face-up if attacked while Set
    const defStats = CardManager.getEffectiveStats(state, defender);

    let attackerDestroyed = false;
    let defenderDestroyed = false;
    let damageToDefender = 0;
    let damageToAttacker = 0;

    if (defender.position === 'ATK') {
      if (atkStats.atk > defStats.atk) {
        damageToDefender = atkStats.atk - defStats.atk;
        defPs.lp = Math.max(0, defPs.lp - damageToDefender);
        if (!defender.restrictions.includes('IMMUNE_DESTROY')) {
          SummonManager.sendToGraveyard(state, defender);
          defenderDestroyed = true;
        }
        TurnManager.addLog(
          state,
          atkPlayer,
          `${atkDef.name} (${atkStats.atk}) destruye a ${defCardDef.name} (${defStats.atk}). Daño: ${damageToDefender}.`,
          'battle'
        );
      } else if (atkStats.atk < defStats.atk) {
        damageToAttacker = defStats.atk - atkStats.atk;
        atkPs.lp = Math.max(0, atkPs.lp - damageToAttacker);
        if (!attacker.restrictions.includes('IMMUNE_DESTROY')) {
          SummonManager.sendToGraveyard(state, attacker);
          attackerDestroyed = true;
        }
        TurnManager.addLog(
          state,
          atkPlayer,
          `${atkDef.name} (${atkStats.atk}) es destruido por ${defCardDef.name} (${defStats.atk}). Contraataque: ${damageToAttacker}.`,
          'battle'
        );
      } else {
        // Mutual destruction in ATK vs ATK tie
        if (!defender.restrictions.includes('IMMUNE_DESTROY')) {
          SummonManager.sendToGraveyard(state, defender);
          defenderDestroyed = true;
        }
        if (!attacker.restrictions.includes('IMMUNE_DESTROY')) {
          SummonManager.sendToGraveyard(state, attacker);
          attackerDestroyed = true;
        }
        TurnManager.addLog(
          state,
          atkPlayer,
          `Empate en batalla (${atkStats.atk} vs ${defStats.atk}): ambos monstruos son destruidos.`,
          'battle'
        );
      }
    } else {
      // ATK vs DEF
      if (atkStats.atk > defStats.def) {
        if (!defender.restrictions.includes('IMMUNE_DESTROY')) {
          SummonManager.sendToGraveyard(state, defender);
          defenderDestroyed = true;
        }
        TurnManager.addLog(
          state,
          atkPlayer,
          `${atkDef.name} (${atkStats.atk}) destruye en defensa a ${defCardDef.name} (${defStats.def} DEF).`,
          'battle'
        );
      } else if (atkStats.atk < defStats.def) {
        damageToAttacker = defStats.def - atkStats.atk;
        atkPs.lp = Math.max(0, atkPs.lp - damageToAttacker);
        TurnManager.addLog(
          state,
          atkPlayer,
          `La defensa de ${defCardDef.name} (${defStats.def} DEF) resiste! ${atkPs.name} recibe ${damageToAttacker} de daño.`,
          'battle'
        );
      } else {
        TurnManager.addLog(
          state,
          atkPlayer,
          `Empate contra Defensa (${atkStats.atk} vs ${defStats.def}): ningún monstruo es destruido.`,
          'battle'
        );
      }
    }

    if (damageToDefender > 0) {
      if (atkPlayer === 'player') state.stats.playerDamageDealt += damageToDefender;
      else state.stats.opponentDamageDealt += damageToDefender;
      state.recentCues.push({
        id: `cue_bdmg_${Date.now()}`,
        kind: 'DAMAGE',
        amount: damageToDefender,
        targetZone: { owner: defPlayer, zone: 'MONSTER', index: 2 },
        timestamp: Date.now(),
      });
    }
    if (damageToAttacker > 0) {
      if (defPlayer === 'player') state.stats.playerDamageDealt += damageToAttacker;
      else state.stats.opponentDamageDealt += damageToAttacker;
      state.recentCues.push({
        id: `cue_rcdmg_${Date.now()}`,
        kind: 'DAMAGE',
        amount: damageToAttacker,
        targetZone: { owner: atkPlayer, zone: 'MONSTER', index: 2 },
        timestamp: Date.now(),
      });
    }

    EffectManager.checkLifePointsWinner(state);
    return {
      executed: true,
      attackerDestroyed,
      defenderDestroyed,
      damageToDefender,
      damageToAttacker,
    };
  }
}
