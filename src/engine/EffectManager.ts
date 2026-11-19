import {
  CardEffectDef,
  CardInstance,
  ChainLink,
  DuelState,
  PlayerId,
} from '../types/tcg';
import { CardManager } from './CardManager';
import { SummonManager } from './SummonManager';
import { TurnManager } from './TurnManager';

export class EffectManager {
  static canActivateEffect(
    state: DuelState,
    controller: PlayerId,
    card: CardInstance,
    effect: CardEffectDef
  ): { allowed: boolean; reason?: string } {
    if (state.winner) return { allowed: false, reason: 'El duelo ha terminado.' };

    const ps = controller === 'player' ? state.player : state.opponent;
    const opp: PlayerId = controller === 'player' ? 'opponent' : 'player';
    const oppPs = opp === 'player' ? state.player : state.opponent;
    const def = CardManager.getDef(card.cardId);

    if (effect.oncePerTurn && card.effectUsedThisTurn) {
      return { allowed: false, reason: 'Efecto ya usado este turno.' };
    }

    if (
      card.location === 'HAND' &&
      def.category === 'SPELL' &&
      def.subtype !== 'field' &&
      !ps.spellsTraps.some((s) => s === null)
    ) {
      return { allowed: false, reason: 'Zona de Mágicas y Trampas llena.' };
    }

    if (effect.trigger === 'CONTINUOUS') {
      // Field/Continuous spells just need activation placement
      return { allowed: true };
    }

    if (effect.trigger === 'IGNITION') {
      if (state.activePlayer !== controller) {
        return { allowed: false, reason: 'Solo en tu turno.' };
      }
      if (state.phase !== 'MAIN1' && state.phase !== 'MAIN2') {
        return { allowed: false, reason: 'Solo en Main Phase.' };
      }
    }

    if (def.category === 'TRAP' && card.location === 'SPELL_TRAP' && card.turnPlaced >= state.turnNumber) {
      return { allowed: false, reason: 'Las Trampas colocadas este turno no pueden activarse aún.' };
    }

    if (effect.requiresXyzMaterial && card.xyzMaterials.length < effect.requiresXyzMaterial) {
      return { allowed: false, reason: 'Sin Materiales Xyz suficientes.' };
    }

    if (effect.condition?.minLP && ps.lp < effect.condition.minLP) {
      return { allowed: false, reason: `Requiere al menos ${effect.condition.minLP} LP.` };
    }

    if (effect.condition?.minOwnMonsters) {
      if (CardManager.getAllFieldMonsters(state, controller).length < effect.condition.minOwnMonsters) {
        return { allowed: false, reason: `Requiere ${effect.condition.minOwnMonsters} monstruos propios.` };
      }
    }

    if (effect.condition?.minOpponentMonsters) {
      if (CardManager.getAllFieldMonsters(state, opp).length < effect.condition.minOpponentMonsters) {
        return { allowed: false, reason: 'El oponente no controla monstruos.' };
      }
    }

    // Check target availability
    if (effect.targetRequirement === 'OPPONENT_MONSTER') {
      if (CardManager.getAllFieldMonsters(state, opp).length === 0) {
        return { allowed: false, reason: 'No hay monstruos rivales que seleccionar.' };
      }
    } else if (effect.targetRequirement === 'OPPONENT_SPELL_TRAP') {
      if (!oppPs.spellsTraps.some(Boolean) && !oppPs.fieldZone) {
        return { allowed: false, reason: 'El oponente no tiene Mágicas o Trampas.' };
      }
    } else if (effect.targetRequirement === 'OPPONENT_ANY_CARD') {
      if (CardManager.getAllFieldCards(state, opp).length === 0) {
        return { allowed: false, reason: 'El oponente no tiene cartas en el campo.' };
      }
    } else if (effect.targetRequirement === 'OWN_MONSTER') {
      if (CardManager.getAllFieldMonsters(state, controller).filter((m) => m.faceUp).length === 0) {
        return { allowed: false, reason: 'No controlas monstruos boca arriba.' };
      }
    } else if (effect.targetRequirement === 'OWN_GY_MONSTER') {
      const hasGyMonster = ps.graveyard.some((c) => CardManager.getDef(c.cardId).category === 'MONSTER');
      if (!hasGyMonster || SummonManager.getFirstEmptyMonsterSlot(state, controller) === -1) {
        return { allowed: false, reason: 'Sin monstruos en el Cementerio o campo lleno.' };
      }
    }

    // Special checks for Fusion / Ritual spells
    for (const op of effect.operations) {
      if (op.type === 'FUSION_SUMMON') {
        const fusionCount = ps.extraDeck.filter((c) => CardManager.getDef(c.cardId).subtype === 'fusion').length;
        const poolCount =
          ps.hand.filter((c) => c.uid !== card.uid && CardManager.getDef(c.cardId).category === 'MONSTER').length +
          CardManager.getAllFieldMonsters(state, controller).length;
        if (fusionCount === 0 || poolCount < 2) {
          return { allowed: false, reason: 'Necesitas 1 Fusión en Extra Deck y 2 monstruos en mano/campo.' };
        }
      } else if (op.type === 'RITUAL_SUMMON') {
        const ritualMonster = ps.hand.find((c) => CardManager.getDef(c.cardId).subtype === 'ritual');
        if (!ritualMonster) {
          return { allowed: false, reason: 'No tienes un Monstruo Ritual en tu mano.' };
        }
        const rDef = CardManager.getDef(ritualMonster.cardId);
        const totalLv = [
          ...ps.hand.filter((c) => c.uid !== card.uid && c.uid !== ritualMonster.uid && CardManager.getDef(c.cardId).category === 'MONSTER'),
          ...CardManager.getAllFieldMonsters(state, controller),
        ].reduce((acc, m) => acc + CardManager.getDef(m.cardId).level, 0);
        if (totalLv < rDef.level) {
          return { allowed: false, reason: `Los niveles disponibles (${totalLv}) no alcanzan Nivel ${rDef.level}.` };
        }
      } else if (op.type === 'DESTROY_ALL_SPELLS_TRAPS') {
        if (!oppPs.spellsTraps.some(Boolean) && !oppPs.fieldZone && !oppPs.pendulumLeft && !oppPs.pendulumRight) {
          return { allowed: false, reason: 'El oponente no controla Mágicas ni Trampas.' };
        }
      }
    }

    return { allowed: true };
  }

  static getValidTargetUids(state: DuelState, controller: PlayerId, effect: CardEffectDef): string[] {
    const opp: PlayerId = controller === 'player' ? 'opponent' : 'player';
    const ps = controller === 'player' ? state.player : state.opponent;
    const oppPs = opp === 'player' ? state.player : state.opponent;

    switch (effect.targetRequirement) {
      case 'OPPONENT_MONSTER':
        return CardManager.getAllFieldMonsters(state, opp).map((c) => c.uid);
      case 'OPPONENT_SPELL_TRAP': {
        const list = oppPs.spellsTraps.filter(Boolean).map((c) => c!.uid);
        if (oppPs.fieldZone) list.push(oppPs.fieldZone.uid);
        return list;
      }
      case 'OPPONENT_ANY_CARD':
        return CardManager.getAllFieldCards(state, opp).map((c) => c.uid);
      case 'OWN_MONSTER':
        return CardManager.getAllFieldMonsters(state, controller)
          .filter((m) => m.faceUp)
          .map((m) => m.uid);
      case 'ANY_MONSTER':
        return [
          ...CardManager.getAllFieldMonsters(state, controller),
          ...CardManager.getAllFieldMonsters(state, opp),
        ].map((m) => m.uid);
      case 'OWN_GY_MONSTER':
        return ps.graveyard
          .filter((c) => CardManager.getDef(c.cardId).category === 'MONSTER')
          .map((c) => c.uid);
      case 'PREVIOUS_CHAIN_LINK':
        return state.chainStack.length > 0
          ? [state.chainStack[state.chainStack.length - 1].sourceUid]
          : [];
      default:
        return [];
    }
  }

  static banishCard(state: DuelState, card: CardInstance): void {
    const ownerPs = card.owner === 'player' ? state.player : state.opponent;
    SummonManager.sendToGraveyard(state, card);
    ownerPs.graveyard = ownerPs.graveyard.filter((c) => c.uid !== card.uid);
    card.location = 'BANISHED';
    card.zoneIndex = ownerPs.banished.length;
    card.faceUp = true;
    ownerPs.banished.push(card);
  }

  static resolveChainLink(state: DuelState, link: ChainLink): boolean {
    // Returns true if attack should be negated
    let attackNegated = false;
    const def = CardManager.getDef(link.cardId);

    if (link.negated) {
      TurnManager.addLog(
        state,
        'system',
        `Cadena Eslabón ${link.linkNumber} (${def.name}) fue NEGADO.`,
        'chain'
      );
      const src = CardManager.findInstance(state, link.sourceUid);
      if (src && (def.category === 'SPELL' || def.category === 'TRAP')) {
        SummonManager.sendToGraveyard(state, src);
      }
      return false;
    }

    const controller = link.controller;
    const opp: PlayerId = controller === 'player' ? 'opponent' : 'player';
    const ps = controller === 'player' ? state.player : state.opponent;
    const oppPs = opp === 'player' ? state.player : state.opponent;
    const sourceCard = CardManager.findInstance(state, link.sourceUid);

    for (const op of link.effect.operations) {
      switch (op.type) {
        case 'DRAW': {
          const amount = op.value ?? 1;
          TurnManager.drawCard(state, controller, amount);
          TurnManager.addLog(state, controller, `${ps.name} roba ${amount} carta(s) por ${def.name}.`, 'effect');
          break;
        }
        case 'DAMAGE_OPPONENT': {
          const dmg = op.value ?? 500;
          oppPs.lp = Math.max(0, oppPs.lp - dmg);
          if (controller === 'player') state.stats.playerDamageDealt += dmg;
          else state.stats.opponentDamageDealt += dmg;
          TurnManager.addLog(state, controller, `${def.name} inflige ${dmg} de daño a ${oppPs.name}.`, 'damage');
          state.recentCues.push({
            id: `cue_dmg_${Date.now()}`,
            kind: 'DAMAGE',
            amount: dmg,
            targetZone: { owner: opp, zone: 'MONSTER', index: 2 },
            timestamp: Date.now(),
          });
          break;
        }
        case 'HEAL_SELF': {
          const heal = op.value ?? 500;
          ps.lp += heal;
          TurnManager.addLog(state, controller, `${ps.name} recupera ${heal} LP por ${def.name}.`, 'effect');
          break;
        }
        case 'DESTROY_TARGET': {
          const target = link.targetUid ? CardManager.findInstance(state, link.targetUid) : null;
          if (target && !target.restrictions.includes('IMMUNE_DESTROY')) {
            const tDef = CardManager.getDef(target.cardId);
            const tLoc = { owner: target.controller, zone: target.location, index: target.zoneIndex };
            SummonManager.sendToGraveyard(state, target);
            TurnManager.addLog(state, controller, `${def.name} destruye a ${tDef.name}.`, 'effect');
            state.recentCues.push({
              id: `cue_dest_${Date.now()}`,
              kind: 'DESTROY',
              targetZone: tLoc,
              timestamp: Date.now(),
            });
          }
          break;
        }
        case 'DESTROY_ALL_OPPONENT_MONSTERS': {
          const oppMons = CardManager.getAllFieldMonsters(state, opp);
          let destroyed = 0;
          for (const m of oppMons) {
            if (!m.restrictions.includes('IMMUNE_DESTROY')) {
              SummonManager.sendToGraveyard(state, m);
              destroyed++;
            }
          }
          TurnManager.addLog(state, controller, `${def.name} destruye ${destroyed} monstruo(s) de ${oppPs.name}.`, 'effect');
          state.recentCues.push({
            id: `cue_wipe_${Date.now()}`,
            kind: 'DESTROY',
            targetZone: { owner: opp, zone: 'MONSTER', index: 2 },
            timestamp: Date.now(),
          });
          break;
        }
        case 'DESTROY_ALL_SPELLS_TRAPS': {
          let count = 0;
          for (const st of [...oppPs.spellsTraps]) {
            if (st) {
              SummonManager.sendToGraveyard(state, st);
              count++;
            }
          }
          if (oppPs.fieldZone) {
            SummonManager.sendToGraveyard(state, oppPs.fieldZone);
            count++;
          }
          if (oppPs.pendulumLeft) {
            SummonManager.sendToGraveyard(state, oppPs.pendulumLeft);
            count++;
          }
          if (oppPs.pendulumRight) {
            SummonManager.sendToGraveyard(state, oppPs.pendulumRight);
            count++;
          }
          TurnManager.addLog(state, controller, `${def.name} destruye ${count} Mágica(s)/Trampa(s) de ${oppPs.name}.`, 'effect');
          break;
        }
        case 'BANISH_TARGET': {
          const target = link.targetUid ? CardManager.findInstance(state, link.targetUid) : null;
          if (target) {
            const tDef = CardManager.getDef(target.cardId);
            this.banishCard(state, target);
            TurnManager.addLog(state, controller, `${def.name} destierra a ${tDef.name}.`, 'effect');
          }
          break;
        }
        case 'MODIFY_STATS': {
          const target = link.targetUid ? CardManager.findInstance(state, link.targetUid) : null;
          if (target) {
            target.atkModifier += op.atkDelta ?? 0;
            target.defModifier += op.defDelta ?? 0;
            if (sourceCard && def.subtype === 'equip') {
              sourceCard.equippedToUid = target.uid;
            }
            const tDef = CardManager.getDef(target.cardId);
            const delta = op.atkDelta ?? 0;
            TurnManager.addLog(
              state,
              controller,
              `${tDef.name} modifica ATK ${delta >= 0 ? '+' : ''}${delta}.`,
              'effect'
            );
          }
          break;
        }
        case 'DETACH_XYZ_BOOST': {
          if (sourceCard && sourceCard.xyzMaterials.length > 0) {
            const detached = sourceCard.xyzMaterials.pop()!;
            const ownerPs = detached.owner === 'player' ? state.player : state.opponent;
            detached.location = 'GRAVEYARD';
            detached.faceUp = true;
            ownerPs.graveyard.push(detached);
            sourceCard.atkModifier += op.atkDelta ?? 0;
            TurnManager.addLog(
              state,
              controller,
              `${def.name} desacopla 1 Material Xyz y gana +${op.atkDelta ?? 0} ATK.`,
              'effect'
            );
          }
          break;
        }
        case 'SPECIAL_SUMMON_FROM_GY': {
          const target = link.targetUid ? ps.graveyard.find((c) => c.uid === link.targetUid) : null;
          if (target && SummonManager.getFirstEmptyMonsterSlot(state, controller) !== -1) {
            ps.graveyard = ps.graveyard.filter((c) => c.uid !== target.uid);
            SummonManager.placeMonsterOnField(state, controller, target, 'ATK', true, false);
            const tDef = CardManager.getDef(target.cardId);
            TurnManager.addLog(state, controller, `${tDef.name} es Invocado Especialmente desde el Cementerio.`, 'summon');
            state.recentCues.push({
              id: `cue_reborn_${Date.now()}`,
              kind: tDef.level >= 7 ? 'BOSS_SUMMON' : 'SUMMON',
              cardId: tDef.id,
              sourceZone: { owner: controller, zone: target.location, index: target.zoneIndex },
              summonMethod: 'SPECIAL',
              timestamp: Date.now(),
            });
          }
          break;
        }
        case 'SEARCH_TO_HAND': {
          const idx = ps.deck.findIndex((c) => {
            const d = CardManager.getDef(c.cardId);
            return !op.filterCategory || d.category === op.filterCategory;
          });
          if (idx !== -1) {
            const [found] = ps.deck.splice(idx, 1);
            found.location = 'HAND';
            found.faceUp = controller === 'player';
            ps.hand.push(found);
            TurnManager.addLog(
              state,
              controller,
              `${ps.name} añade "${CardManager.getDef(found.cardId).name}" del Deck a su mano.`,
              'effect'
            );
          }
          break;
        }
        case 'CHANGE_POSITION': {
          const target = link.targetUid ? CardManager.findInstance(state, link.targetUid) : null;
          if (target) {
            target.faceUp = true;
            target.position = target.position === 'ATK' ? 'DEF' : 'ATK';
            TurnManager.addLog(
              state,
              controller,
              `${CardManager.getDef(target.cardId).name} cambia a Posición de ${target.position}.`,
              'effect'
            );
          }
          break;
        }
        case 'APPLY_RESTRICTION': {
          const target = link.targetUid ? CardManager.findInstance(state, link.targetUid) : null;
          if (target && op.restriction) {
            target.restrictions.push(op.restriction);
          }
          break;
        }
        case 'NEGATE_CHAIN_LINK': {
          const targetLink = state.chainStack.find((l) => l.linkNumber === link.linkNumber - 1);
          if (targetLink) {
            targetLink.negated = true;
            TurnManager.addLog(
              state,
              controller,
              `${def.name} NIEGA la activación de ${CardManager.getDef(targetLink.cardId).name}!`,
              'chain'
            );
          }
          break;
        }
        case 'NEGATE_ATTACK': {
          attackNegated = true;
          TurnManager.addLog(state, controller, `${def.name} niega el ataque!`, 'battle');
          break;
        }
        case 'FUSION_SUMMON': {
          // Pick best Fusion monster in Extra Deck and 2 materials from hand/field
          const fusion = ps.extraDeck.find((c) => CardManager.getDef(c.cardId).subtype === 'fusion');
          const candidates = [
            ...CardManager.getAllFieldMonsters(state, controller),
            ...ps.hand.filter((c) => c.uid !== link.sourceUid && CardManager.getDef(c.cardId).category === 'MONSTER'),
          ];
          if (fusion && candidates.length >= 2) {
            // Prefer low-level materials first to preserve aces
            const sorted = [...candidates].sort(
              (a, b) => CardManager.getDef(a.cardId).level - CardManager.getDef(b.cardId).level
            );
            SummonManager.executeExtraDeckSummon(
              state,
              controller,
              fusion.uid,
              [sorted[0].uid, sorted[1].uid],
              'FUSION'
            );
          }
          break;
        }
        case 'RITUAL_SUMMON': {
          const ritualMonster = ps.hand.find((c) => CardManager.getDef(c.cardId).subtype === 'ritual');
          if (ritualMonster) {
            const rDef = CardManager.getDef(ritualMonster.cardId);
            const pool = [
              ...CardManager.getAllFieldMonsters(state, controller),
              ...ps.hand.filter(
                (c) =>
                  c.uid !== link.sourceUid &&
                  c.uid !== ritualMonster.uid &&
                  CardManager.getDef(c.cardId).category === 'MONSTER'
              ),
            ].sort((a, b) => CardManager.getDef(a.cardId).level - CardManager.getDef(b.cardId).level);

            const tributes: CardInstance[] = [];
            let sum = 0;
            for (const cand of pool) {
              tributes.push(cand);
              sum += CardManager.getDef(cand.cardId).level;
              if (sum >= rDef.level) break;
            }
            if (sum >= rDef.level) {
              for (const t of tributes) {
                SummonManager.sendToGraveyard(state, t);
              }
              ps.hand = ps.hand.filter((c) => c.uid !== ritualMonster.uid);
              SummonManager.placeMonsterOnField(state, controller, ritualMonster, 'ATK', true, false);
              TurnManager.addLog(state, controller, `${ps.name} Invoca por Ritual a ${rDef.name}!`, 'summon');
              state.recentCues.push({
                id: `cue_ritual_${Date.now()}`,
                kind: 'BOSS_SUMMON',
                cardId: rDef.id,
                sourceZone: { owner: controller, zone: ritualMonster.location, index: ritualMonster.zoneIndex },
                summonMethod: 'RITUAL',
                timestamp: Date.now(),
              });
            }
          }
          break;
        }
      }
    }

    // Send Normal/Quick-Play/Ritual Spells and Normal/Counter Traps to GY after resolution
    if (sourceCard) {
      if (def.category === 'SPELL' && (def.subtype === 'normal' || def.subtype === 'quickplay' || def.subtype === 'ritual')) {
        SummonManager.sendToGraveyard(state, sourceCard);
      } else if (def.category === 'TRAP' && (def.subtype === 'normal' || def.subtype === 'counter')) {
        SummonManager.sendToGraveyard(state, sourceCard);
      }
    }

    return attackNegated;
  }

  static resolveChainStack(state: DuelState): { attackNegated: boolean } {
    let attackNegated = false;
    if (state.chainStack.length === 0) return { attackNegated };

    const links = [...state.chainStack].reverse();
    for (const link of links) {
      const negatedAtk = this.resolveChainLink(state, link);
      if (negatedAtk) attackNegated = true;
    }

    state.stats.chainsResolved += 1;
    state.chainStack = [];
    this.checkLifePointsWinner(state);
    return { attackNegated };
  }

  static checkLifePointsWinner(state: DuelState): void {
    if (state.winner) return;
    if (state.player.lp <= 0 && state.opponent.lp <= 0) {
      state.winner = 'opponent';
      state.winReason = 'Ambos duelistas alcanzaron 0 LP simultáneamente.';
    } else if (state.opponent.lp <= 0) {
      state.winner = 'player';
      state.winReason = `${state.opponent.name} cayó a 0 LP.`;
    } else if (state.player.lp <= 0) {
      state.winner = 'opponent';
      state.winReason = `${state.player.name} cayó a 0 LP.`;
    }
  }
}
