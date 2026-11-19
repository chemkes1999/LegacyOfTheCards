import { CardInstance, DuelState } from '../types/tcg';
import { BattleManager } from './BattleManager';
import { CardManager } from './CardManager';
import { DuelManager } from './DuelManager';
import { EffectManager } from './EffectManager';
import { SummonManager } from './SummonManager';
import { TurnManager } from './TurnManager';

export interface AIStepAction {
  description: string;
  apply: (state: DuelState) => DuelState;
}

export class AIController {
  /**
   * Computes a sequence of discrete, rule-legal AI actions for the AI's turn
   * so the UI/3D field can animate each step cleanly with tactical pacing!
   */
  static computeNextAction(state: DuelState): AIStepAction | null {
    if (state.winner || state.activePlayer !== 'opponent' || state.pendingInteraction) {
      return null;
    }

    const diff = state.aiDifficulty;
    const ai = state.opponent;
    const playerMons = CardManager.getAllFieldMonsters(state, 'player');
    const aiMons = CardManager.getAllFieldMonsters(state, 'opponent');

    if (state.phase === 'MAIN1') {
      // 1. Activate Spell cards from hand (Field Spell, Pot of Greed, Raigeki, Monster Reborn, Equip)
      for (const card of ai.hand) {
        const def = CardManager.getDef(card.cardId);
        if (def.category !== 'SPELL') continue;

        if (def.subtype === 'field' && !ai.fieldZone) {
          return {
            description: `IA activa Campo: ${def.name}`,
            apply: (s) => DuelManager.activateCard(s, 'opponent', card.uid).state,
          };
        }

        const eff = def.effects[0];
        if (!eff) continue;
        const can = EffectManager.canActivateEffect(state, 'opponent', card, eff);
        if (!can.allowed) continue;

        // Easy AI skips complex board wipes sometimes; Normal/Expert use them smartly
        if (eff.operations.some((op) => op.type === 'DESTROY_ALL_OPPONENT_MONSTERS')) {
          const threshold = diff === 'EXPERT' ? 1 : 2;
          if (playerMons.length < threshold && diff !== 'EASY') continue;
        }

        const targets = EffectManager.getValidTargetUids(state, 'opponent', eff);
        let chosenTarget: string | undefined = targets[0];
        if (eff.targetRequirement === 'OPPONENT_MONSTER' && targets.length > 0) {
          // Target highest ATK player monster
          chosenTarget = targets.sort((a, b) => {
            const ma = CardManager.findInstance(state, a)!;
            const mb = CardManager.findInstance(state, b)!;
            return CardManager.getEffectiveStats(state, mb).atk - CardManager.getEffectiveStats(state, ma).atk;
          })[0];
        } else if (eff.targetRequirement === 'OWN_MONSTER' && targets.length > 0) {
          chosenTarget = targets.sort((a, b) => {
            const ma = CardManager.findInstance(state, a)!;
            const mb = CardManager.findInstance(state, b)!;
            return CardManager.getEffectiveStats(state, mb).atk - CardManager.getEffectiveStats(state, ma).atk;
          })[0];
        } else if (eff.targetRequirement === 'OWN_GY_MONSTER' && targets.length > 0) {
          chosenTarget = targets.sort((a, b) => {
            const ma = CardManager.findInstance(state, a)!;
            const mb = CardManager.findInstance(state, b)!;
            return CardManager.getDef(mb.cardId).atk - CardManager.getDef(ma.cardId).atk;
          })[0];
        }

        if (eff.targetRequirement !== 'NONE' && !chosenTarget) continue;

        return {
          description: `IA activa ${def.name}`,
          apply: (s) => DuelManager.activateCard(s, 'opponent', card.uid, 0, chosenTarget).state,
        };
      }

      // 2. Normal / Tribute Summon from hand
      if (ai.normalSummonsRemaining > 0) {
        const handMonsters = ai.hand
          .filter((c) => {
            const d = CardManager.getDef(c.cardId);
            return d.category === 'MONSTER' && !d.isExtraDeck && d.subtype !== 'ritual';
          })
          .sort((a, b) => CardManager.getDef(b.cardId).atk - CardManager.getDef(a.cardId).atk);

        for (const m of handMonsters) {
          const val = SummonManager.validateNormalSummon(state, 'opponent', m.uid, false);
          if (!val.canSummon) continue;
          const def = CardManager.getDef(m.cardId);

          // Select lowest-ATK tributes if needed
          const sortedField = [...aiMons].sort(
            (a, b) => CardManager.getEffectiveStats(state, a).atk - CardManager.getEffectiveStats(state, b).atk
          );
          const tributes = sortedField.slice(0, val.requiredTributes);

          // Expert AI won't tribute a stronger monster for a weaker one
          if (diff === 'EXPERT' && val.requiredTributes > 0) {
            const tributeMaxAtk = Math.max(...tributes.map((t) => CardManager.getEffectiveStats(state, t).atk));
            if (def.atk <= tributeMaxAtk) continue;
          }

          const shouldSet = def.def > def.atk + 300 && playerMons.some((pm) => CardManager.getEffectiveStats(state, pm).atk > def.atk);
          return {
            description: `IA invoca a ${def.name}`,
            apply: (s) =>
              DuelManager.normalSummonOrSet(
                s,
                'opponent',
                m.uid,
                tributes.map((t) => t.uid),
                shouldSet ? 'DEF' : 'ATK',
                shouldSet
              ).state,
          };
        }
      }

      // 3. Extra Deck Summons (Synchro, Xyz, Link) for Normal & Expert AI!
      if (diff !== 'EASY') {
        for (const extra of ai.extraDeck) {
          const def = CardManager.getDef(extra.cardId);
          if (def.subtype === 'synchro') {
            const syncCheck = SummonManager.validateSynchroSummon(state, 'opponent', extra.uid);
            if (syncCheck.canSummon && syncCheck.validCombinations.length > 0) {
              const mats = syncCheck.validCombinations[0];
              const maxMatAtk = Math.max(...mats.map((m) => CardManager.getEffectiveStats(state, m).atk));
              if (def.atk > maxMatAtk) {
                return {
                  description: `IA Invoca por Sincronía a ${def.name}`,
                  apply: (s) =>
                    DuelManager.extraSummon(
                      s,
                      'opponent',
                      extra.uid,
                      mats.map((m) => m.uid),
                      'SYNCHRO'
                    ).state,
                };
              }
            }
          } else if (def.subtype === 'xyz') {
            const xyzCheck = SummonManager.validateXyzSummon(state, 'opponent', extra.uid);
            if (xyzCheck.canSummon && xyzCheck.validPairs.length > 0) {
              const pair = xyzCheck.validPairs[0];
              const maxMatAtk = Math.max(...pair.map((m) => CardManager.getEffectiveStats(state, m).atk));
              if (def.atk >= maxMatAtk) {
                return {
                  description: `IA Invoca Xyz a ${def.name}`,
                  apply: (s) =>
                    DuelManager.extraSummon(
                      s,
                      'opponent',
                      extra.uid,
                      pair.map((m) => m.uid),
                      'XYZ'
                    ).state,
                };
              }
            }
          } else if (def.subtype === 'link' && diff === 'EXPERT') {
            const linkCheck = SummonManager.validateLinkSummon(state, 'opponent', extra.uid);
            if (linkCheck.canSummon && linkCheck.validSets.length > 0) {
              const set = linkCheck.validSets[0];
              const maxMatAtk = Math.max(...set.map((m) => CardManager.getEffectiveStats(state, m).atk));
              if (def.atk > maxMatAtk) {
                return {
                  description: `IA Invoca por Enlace a ${def.name}`,
                  apply: (s) =>
                    DuelManager.extraSummon(
                      s,
                      'opponent',
                      extra.uid,
                      set.map((m) => m.uid),
                      'LINK'
                    ).state,
                };
              }
            }
          }
        }
      }

      // 4. Activate Ignition monster effects on field
      for (const m of aiMons) {
        if (!m.faceUp || m.effectUsedThisTurn) continue;
        const def = CardManager.getDef(m.cardId);
        for (let i = 0; i < def.effects.length; i++) {
          const eff = def.effects[i];
          if (eff.trigger !== 'IGNITION') continue;
          const can = EffectManager.canActivateEffect(state, 'opponent', m, eff);
          if (!can.allowed) continue;

          const targets = EffectManager.getValidTargetUids(state, 'opponent', eff);
          let targetUid = targets[0];
          if (eff.targetRequirement === 'OPPONENT_MONSTER' && targets.length > 0) {
            targetUid = targets.sort((a, b) => {
              const ma = CardManager.findInstance(state, a)!;
              const mb = CardManager.findInstance(state, b)!;
              return CardManager.getEffectiveStats(state, mb).atk - CardManager.getEffectiveStats(state, ma).atk;
            })[0];
          }
          if (eff.targetRequirement !== 'NONE' && !targetUid) continue;
          return {
            description: `IA activa efecto de ${def.name}`,
            apply: (s) => DuelManager.activateCard(s, 'opponent', m.uid, i, targetUid).state,
          };
        }
      }

      // 5. Set Traps / Quick-Play spells
      for (const card of ai.hand) {
        const def = CardManager.getDef(card.cardId);
        if ((def.category === 'TRAP' || def.subtype === 'quickplay') && ai.spellsTraps.some((s) => s === null)) {
          return {
            description: 'IA coloca una carta boca abajo',
            apply: (s) => DuelManager.setSpellOrTrap(s, 'opponent', card.uid).state,
          };
        }
      }

      // 6. Enter Battle Phase (if Turn > 1 and has ATK monsters) or End Turn
      const hasAttackers = aiMons.some((m) => m.faceUp && m.position === 'ATK' && !m.attackedThisTurn);
      if (state.turnNumber > 1 && hasAttackers) {
        return {
          description: 'IA entra en Battle Phase',
          apply: (s) => DuelManager.advancePhase(s, 'BATTLE').state,
        };
      }

      return {
        description: 'IA termina su turno',
        apply: (s) => DuelManager.endTurn(s),
      };
    }

    if (state.phase === 'BATTLE') {
      const attackers = aiMons
        .filter((m) => m.faceUp && m.position === 'ATK' && !m.attackedThisTurn && !m.restrictions.includes('CANNOT_ATTACK'))
        .sort((a, b) => CardManager.getEffectiveStats(state, a).atk - CardManager.getEffectiveStats(state, b).atk);

      for (const atkMon of attackers) {
        const atkVal = CardManager.getEffectiveStats(state, atkMon).atk;

        if (playerMons.length === 0) {
          return {
            description: `IA ataca directamente con ${CardManager.getDef(atkMon.cardId).name}`,
            apply: (s) => DuelManager.declareAttack(s, 'opponent', atkMon.uid).state,
          };
        }

        // Find best winnable target
        const winnable = playerMons
          .filter((pm) => {
            if (!pm.faceUp) return diff === 'EASY' ? true : atkVal >= 1700;
            const pStats = CardManager.getEffectiveStats(state, pm);
            return pm.position === 'ATK' ? atkVal > pStats.atk : atkVal > pStats.def;
          })
          .sort((a, b) => {
            const sa = CardManager.getEffectiveStats(state, a);
            const sb = CardManager.getEffectiveStats(state, b);
            return sb.atk - sa.atk;
          });

        if (winnable.length > 0) {
          const target = winnable[0];
          return {
            description: `IA ataca a ${target.faceUp ? CardManager.getDef(target.cardId).name : 'monstruo oculto'}`,
            apply: (s) => DuelManager.declareAttack(s, 'opponent', atkMon.uid, target.uid).state,
          };
        }

        // Easy AI might make reckless trades
        if (diff === 'EASY' && playerMons.length > 0 && Math.random() < 0.35) {
          return {
            description: 'IA declara ataque arriesgado',
            apply: (s) => DuelManager.declareAttack(s, 'opponent', atkMon.uid, playerMons[0].uid).state,
          };
        }
      }

      return {
        description: 'IA pasa a Main Phase 2 y termina turno',
        apply: (s) => DuelManager.endTurn(s),
      };
    }

    // Fallback: advance/end
    return {
      description: 'IA finaliza turno',
      apply: (s) => {
        const next = DuelManager.cloneState(s);
        TurnManager.advancePhase(next);
        if (next.phase === 'END' || next.phase === 'MAIN2') {
          return DuelManager.endTurn(next);
        }
        return next;
      },
    };
  }
}
